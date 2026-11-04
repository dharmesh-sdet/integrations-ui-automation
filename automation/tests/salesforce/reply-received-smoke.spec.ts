// Production smoke test: Reply is Received in Saleshandy, Salesforce (AL-4133, workflow not published on production yet).
// Checklist: notes/production-testing/22-salesforce-reply-received.md (approved by QA 2026-11-04, 10 checks,
// one per activity, 10 sends). Each check follows the staging row of the same id in
// tests/salesforce/reply-received.spec.ts (QA approved those rows 2026-11-04).
// Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts) and the Salesforce
//    org is the same dev org (saleshandy-dev-ed);
//  - the sequence comes from SMOKE_SEQUENCE_ID, nothing production is hard-coded;
//  - every check is pass/fail (a "(proposed, unconfirmed)" staging row is a plain check here);
//  - "Prepare data" makes the Salesforce records, adds the prospects and sends step 1 for all 10 checks
//    side by side before the first check (same engine as staging, src/flows/reply-harness.ts). The runner
//    runs it as its own step (-g "Prepare data") and the checks without it (--grep-invert).
// A failure whose message starts with "PRODUCT:" is a product finding for QA; any other failure is the
// script or the setup.
//
// Run through scripts/run-salesforce-reply-received-smoke.sh (npm run smoke:salesforce-reply-received),
// which runs the gate, makes the day's sequence, then runs this file. Needs, once:
//   npm run login:saleshandy -- emailopenedprod
//   npm run login:salesforce -- emailopenedprod
// Data: test-data/salesforce/reply-received-smoke.csv (scripts/make-salesforce-reply-received-smoke-data.ts).
import { expect, test } from '../../src/fixtures/index.ts';
import { newReplyState, ReplyHarness, type ReplyScenario, type World } from '../../src/flows/reply-harness.ts';
import { SaleshandySequencePage } from '../../src/pages/saleshandy/sequence.page.ts';
import { dayIs, type Salesforce } from '../../src/pages/salesforce/salesforce.ts';
import type { Row } from '../../src/data/csv.ts';

test.use({ account: 'emailopenedprod', actionTimeout: 30_000 });

const TRIGGER = 'Reply is Received in Saleshandy';
const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '';
const CSV = 'salesforce/reply-received-smoke.csv';
// The Task subject on the Contact timeline holds the step 1 subject. The runner sets it from the setup spec.
const EMAIL_SUBJECT = process.env.SMOKE_STEP1_SUBJECT || 'Salesforce Reply Received Smoke';

const CL = 'Create a Lead in Salesforce';
const UL = 'Update a Lead in Salesforce';
const CC = 'Create a Contact in Salesforce';
const UC = 'Update a Contact in Salesforce';
const CA = 'Create a Account in Salesforce';
const UA = 'Update a Account in Salesforce';
const CO = 'Create a Opportunity in Salesforce';
const UO = 'Update a Opportunity in Salesforce';
const AN = 'Attach Note in Salesforce';
const RE = 'Record(log) an Email Activity in Salesforce';

type Look<T> = () => Promise<T | undefined>;
const whenFound = <T>(count: () => Promise<number>, read: () => Promise<T>): Look<T> => async () => ((await count()) > 0 ? read() : undefined);

const leadOf = (w: World) => whenFound(() => w.salesforce.leads.countByEmail(w.row['Email']), () => w.salesforce.leads.leadFields(w.row['Email']));
const contactOf = (w: World) => whenFound(() => w.salesforce.contacts.countByEmail(w.row['Email']), () => w.salesforce.contacts.contactFields(w.row['Email']));
const leadCount = (w: World) => () => w.salesforce.leads.countByEmail(w.row['Email']);
const contactCount = (w: World) => () => w.salesforce.contacts.countByEmail(w.row['Email']);
const opportunityCount = (w: World) => () => w.salesforce.opportunities.countByName(w.row['Email']);

const digits = (text: string) => text.replace(/\D/g, '');
const amountOf = (text: string) => Number(text.replace(/[^0-9.]/g, ''));

type AccountCounts = { byCompany: number; byName: number };
const fullNameOf = (row: Row) => `${row['First Name']} ${row['Last Name']}`;
const accountCountsOf = async (salesforce: Salesforce, row: Row): Promise<AccountCounts> => ({
  byCompany: row['Company'] ? await salesforce.accounts.countByName(row['Company']) : 0,
  byName: await salesforce.accounts.countByName(fullNameOf(row)),
});
const accountsBefore = (salesforce: Salesforce, row: Row) => accountCountsOf(salesforce, row);
const newAccounts = async (w: World): Promise<number> => {
  const before = w.before as AccountCounts;
  const now = await accountCountsOf(w.salesforce, w.row);
  return now.byCompany - before.byCompany + (now.byName - before.byName);
};

const product = <T>(value: T, what: string) => expect(value, `PRODUCT: ${what}`);

// Values the setup records start with: the old values the workflow must replace.
const LEAD_OLD = { phone: '+1 555-0100-3321' };
const CONTACT_OLD = { phone: '+1 555-0100-4455' };

const SCENARIOS: ReplyScenario[] = [
  // 1. Create a Lead
  {
    id: `${CL} > 1`,
    title: 'new prospect, every mapped field filled, accents and apostrophe in the name',
    activities: [CL],
    confirmed: true,
    check: async (w) => {
      const lead = await w.find(leadOf(w));
      product(lead, 'no Lead within 3 min of Mark as replied').toBeDefined();
      w.verdict('Leads for the email', await leadCount(w)(), 1);
      w.verdict('Name has the accents and apostrophe', lead!.name.includes(w.row['First Name']) && lead!.name.includes(w.row['Last Name']), true);
      w.verdict('Title', lead!.title, w.row['Job Title']);
      w.verdict('Company', lead!.company, w.row['Company']);
      w.verdict('Phone', digits(lead!.phone), digits(w.row['Phone Number']));
      w.verdict('Address has the City', lead!.address.includes(w.row['City']), true);
    },
  },
  // 2. Update a Lead
  {
    id: `${UL} > 1`,
    title: 'Lead exists with an old Job Title, Phone and Company',
    activities: [UL],
    confirmed: true,
    setup: { lead: { title: 'Marketing Assistant', phone: LEAD_OLD.phone, company: 'Legacy Print Studio' } },
    check: async (w) => {
      const lead = await w.find(async () => {
        const fields = await w.salesforce.leads.leadFields(w.row['Email']);
        return fields.title === w.row['Job Title'] ? fields : undefined;
      });
      product(lead, 'Lead not updated with the prospect Job Title').toBeDefined();
      w.verdict('Leads for the email', await leadCount(w)(), 1);
      w.verdict('Phone', digits(lead!.phone), digits(w.row['Phone Number']));
      w.verdict('Company', lead!.company, w.row['Company']);
    },
  },
  // 3. Create a Contact
  {
    id: `${CC} > 1`,
    title: 'new prospect with phone, department and city; Job Title and Company filled but unmapped',
    activities: [CC],
    confirmed: true,
    check: async (w) => {
      const contact = await w.find(contactOf(w));
      product(contact, 'no Contact within 3 min of Mark as replied').toBeDefined();
      w.verdict('Contacts for the email', await contactCount(w)(), 1);
      w.verdict('Leads for the email', await leadCount(w)(), 0);
      w.verdict('Name', contact!.name.includes(w.row['First Name']) && contact!.name.includes(w.row['Last Name']), true);
      w.verdict('Business Phone', digits(contact!.phone), digits(w.row['Phone Number']));
      w.verdict('Department', contact!.department, w.row['Department']);
      w.verdict('Other Address has the City', contact!.otherAddress.includes(w.row['City']), true);
      w.verdict('Title (Job Title is not mapped for Contacts)', contact!.title, '');
    },
  },
  // 4. Update a Contact
  {
    id: `${UC} > 1`,
    title: 'Contact has an old Phone and Department and a Title',
    activities: [UC],
    confirmed: true,
    setup: { contact: { phone: CONTACT_OLD.phone, department: 'Customer Support', title: 'Operations Lead' } },
    check: async (w) => {
      const contact = await w.find(async () => {
        const fields = await w.salesforce.contacts.contactFields(w.row['Email']);
        return fields.department === w.row['Department'] ? fields : undefined;
      });
      product(contact, 'Contact not updated with the prospect Department').toBeDefined();
      w.verdict('Contacts for the email', await contactCount(w)(), 1);
      w.verdict('Business Phone', digits(contact?.phone ?? ''), digits(w.row['Phone Number']));
      w.verdict('Title unchanged', contact?.title, 'Operations Lead');
    },
  },
  // 5. Create a Account
  {
    id: `${CA} > 1`,
    title: 'new prospect with Company, phone and city; no such Account',
    activities: [CA],
    confirmed: true,
    before: accountsBefore,
    check: async (w) => {
      const found = await w.find(async () => ((await newAccounts(w)) > 0 ? await accountCountsOf(w.salesforce, w.row) : undefined));
      w.verdict('New Accounts', found ? await newAccounts(w) : 0, 1);
      const before = w.before as AccountCounts;
      if (found) {
        const usedCompany = found.byCompany > before.byCompany;
        const name = usedCompany ? w.row['Company'] : fullNameOf(w.row);
        w.observe('Account Name used (for QA)', name);
        const fields = await w.salesforce.accounts.accountFields(name);
        w.verdict('Billing address has the City', fields.billingAddress.includes(w.row['City']), true);
      }
    },
  },
  // 6. Update a Account
  {
    id: `${UA} > 1`,
    title: 'an Account named with the prospect full name has an old City',
    activities: [UA],
    confirmed: true,
    setup: { account: { name: 'fullName', city: 'Sunnyvale' } },
    before: accountsBefore,
    check: async (w) => {
      // Company is mapped to Account Name on this account (QA, 2026-10-22), so the update can rename the Account to
      // the Company. Look it up by the full name first, then by the Company.
      const account = await w.find(async () => {
        const accounts = w.salesforce.accounts;
        const name = (await accounts.countByName(fullNameOf(w.row))) > 0 ? fullNameOf(w.row) : w.row['Company'] && (await accounts.countByName(w.row['Company'])) > 0 ? w.row['Company'] : undefined;
        if (!name) return undefined;
        const fields = await accounts.accountFields(name);
        return fields.billingAddress.includes(w.row['City']) ? { ...fields, found: name } : undefined;
      });
      w.observe('Account name after the reply (full name = kept, Company = renamed)', account?.found ?? 'not found');
      w.verdict('Account updated with the prospect City', account !== undefined, true);
      w.verdict('New Accounts', await newAccounts(w), 0);
    },
  },
  // 7. Create a Opportunity (Closing Date is unmapped around the Opportunity checks)
  {
    id: `${CO} > 1`,
    title: 'new prospect with Deal Value 12000; Extra Configuration 7 days, stage Prospecting',
    activities: [{ activity: CO, extra: { closingDays: 7, stage: 'Prospecting' } }],
    confirmed: true,
    check: async (w) => {
      const rows = await w.find(async () => ((await opportunityCount(w)()) > 0 ? w.salesforce.opportunities.all(w.row['Email']) : undefined));
      w.verdict('Opportunities for the prospect', rows?.length ?? 0, 1);
      w.verdict('Contacts for the email', await contactCount(w)(), 1);
      w.verdict('Stage', rows?.[0]?.stage, 'Prospecting');
      w.verdict('Close Date is 7 days out', dayIs(rows?.[0]?.closeDate ?? '', 7), true);
      w.verdict('Amount', amountOf(rows?.[0]?.amount ?? ''), 12000);
    },
  },
  // 8. Update a Opportunity
  {
    id: `${UO} > 1`,
    title: 'two Opportunities named with the email (a stale one and a new one), both in Qualification',
    activities: [{ activity: UO, extra: { closingDays: 14, stage: 'Negotiation/Review' } }],
    confirmed: true,
    setup: {
      opportunities: [
        { stage: 'Qualification', closeInDays: -75 },
        { stage: 'Qualification', closeInDays: 20 },
      ],
    },
    check: async (w) => {
      const rows = await w.find(async () => {
        const all = await w.salesforce.opportunities.all(w.row['Email']);
        return all.some((r) => r.stage === 'Negotiation/Review') ? all : undefined;
      });
      product(rows, 'no Opportunity changed to Negotiation/Review').toBeDefined();
      w.verdict('Opportunities for the prospect', rows!.length, 2);
      const stale = rows!.find((r) => dayIs(r.closeDate, -75));
      const fresh = rows!.find((r) => !dayIs(r.closeDate, -75));
      w.verdict('The older Opportunity is unchanged (Qualification, old Close Date)', stale?.stage, 'Qualification');
      w.verdict('The newest Opportunity moved to Negotiation/Review', fresh?.stage, 'Negotiation/Review');
      w.verdict('The newest Close Date is 14 days out', dayIs(fresh?.closeDate ?? '', 14), true);
    },
  },
  // 9. Attach Note (with Create a Contact), Logs first, then the Note on the Contact
  {
    id: `${AN} > 1`,
    title: 'new prospect, outcome "Add Outcome"; Create a Contact and Attach Note',
    activities: [CC, AN],
    confirmed: true,
    check: async (w) => {
      const status = await w.logStatus();
      w.verdict('Logs status', status, 'Success');
      if (status !== 'Success') return;
      w.verdict('Contacts for the email', await contactCount(w)(), 1);
      const body = await w.salesforce.contacts.noteBody(w.row['Email'], 'reply-received');
      w.verdict('A Note "reply-received" is on the Contact', body !== '', true);
      w.verdict('Note Body names the prospect email', body.includes(w.row['Email']), true);
      w.verdict('Note Body shows an empty Latest Outcome', /Latest Outcome:\s*(,|Prospect Email)/.test(body), true);
    },
  },
  // 10. Record(log) an Email Activity
  {
    id: `${RE} > 1`,
    title: 'Select Object Contact; the Contact exists',
    activities: [{ activity: RE, extra: { object: 'Contact' } }],
    confirmed: true,
    setup: { contact: { phone: CONTACT_OLD.phone, department: 'Procurement' } },
    check: async (w) => {
      w.observe('Logs status', await w.logStatus());
      await w.salesforce.contacts.openRecord(w.row['Email']);
      const timeline = await w.salesforce.contacts.activityText();
      w.observe('Contact Activity timeline', timeline.slice(0, 400));
      w.verdict('The timeline shows one Task with the email subject', timeline.split(EMAIL_SUBJECT).length - 1 >= 1, true);
    },
  },
];

const state = newReplyState(CSV);
const IDS = SCENARIOS.map((s) => s.id);
const OPPORTUNITY_ROWS = SCENARIOS.filter((s) => s.id.startsWith(CO) || s.id.startsWith(UO));
const BEFORE_OPPORTUNITY_ROWS = SCENARIOS.slice(0, SCENARIOS.indexOf(OPPORTUNITY_ROWS[0]));
const AFTER_OPPORTUNITY_ROWS = SCENARIOS.slice(SCENARIOS.indexOf(OPPORTUNITY_ROWS[OPPORTUNITY_ROWS.length - 1]) + 1);

test.describe('Reply is Received in Saleshandy: Salesforce production smoke', () => {
  // Not serial: one failed check must not skip the rest. Tests run in file order on one worker, and every check
  // prepares itself if "Prepare data" did not run.
  const harnessOf = (f: {
    saleshandySequence: SaleshandySequencePage;
    salesforceIntegration: ConstructorParameters<typeof ReplyHarness>[0]['sf'];
    salesforce: ConstructorParameters<typeof ReplyHarness>[0]['salesforce'];
  }) => {
    if (!SEQUENCE_ID) throw new Error('SMOKE_SEQUENCE_ID is not set. Use scripts/run-salesforce-reply-received-smoke.sh.');
    return new ReplyHarness(
      { csv: CSV, sequenceId: SEQUENCE_ID, trigger: TRIGGER, seq: f.saleshandySequence, sf: f.salesforceIntegration, salesforce: f.salesforce, scenarios: SCENARIOS },
      state,
    );
  };

  let n = 0;
  const rowTest = (scenario: ReplyScenario) => {
    const number = ++n;
    test(`Check ${number}: ${scenario.id}: ${scenario.title}`, async ({ saleshandySequence, salesforceIntegration, salesforce }) => {
      test.setTimeout(12 * 60_000);
      await harnessOf({ saleshandySequence, salesforceIntegration, salesforce }).run(scenario.id);
    });
  };

  test(`Prepare data: Salesforce records, prospects and step 1 sends for ${IDS.length} checks`, async ({ saleshandyPage, saleshandySequence, salesforceIntegration, salesforce }) => {
    test.setTimeout(60 * 60_000);
    const sender = new SaleshandySequencePage(await saleshandyPage.context().newPage());
    await harnessOf({ saleshandySequence, salesforceIntegration, salesforce }).setupAll(IDS, sender);
  });

  for (const scenario of BEFORE_OPPORTUNITY_ROWS) rowTest(scenario);

  const saveMapping = async (sf: ConstructorParameters<typeof ReplyHarness>[0]['sf']) => {
    let saved = false;
    for (let attempt = 1; attempt <= 3 && !saved; attempt++) {
      saved = await sf.trySaveMapping();
      if (!saved && attempt < 3) await sf.page.waitForTimeout(5_000);
    }
    expect(saved, 'Opportunity mapping saved').toBe(true);
  };

  // The Opportunity checks run with Closing Date unmapped (dev kit: a mapped Closing Date gives a format error).
  test('Opportunity checks: unmap Closing Date on the Opportunity mapping', async ({ salesforceIntegration }) => {
    await salesforceIntegration.openMapping('Opportunity');
    await salesforceIntegration.unmapField('Closing Date');
    await saveMapping(salesforceIntegration);
    await salesforceIntegration.openMapping('Opportunity');
    expect(await salesforceIntegration.mappedValue('Closing Date'), 'Closing Date after reload').toBe('Select');
  });

  for (const scenario of OPPORTUNITY_ROWS) rowTest(scenario);

  test('Opportunity checks: map Closing Date to Close Date again', async ({ salesforceIntegration }) => {
    await salesforceIntegration.openMapping('Opportunity');
    await salesforceIntegration.mapField('Closing Date', 'Close Date');
    await saveMapping(salesforceIntegration);
    await salesforceIntegration.openMapping('Opportunity');
    expect(await salesforceIntegration.mappedValue('Closing Date'), 'Closing Date after reload').toBe('Close Date');
  });

  for (const scenario of AFTER_OPPORTUNITY_ROWS) rowTest(scenario);
});
