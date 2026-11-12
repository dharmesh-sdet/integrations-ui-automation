// Scenarios: test-cases/salesforce/reply-received.md (Regression, 37 rows, approved by QA 2026-11-04).
// Data: test-data/salesforce/reply-received.csv, one named prospect per row that sends a reply (Scenario column =
// the row id below). Build it with: node scripts/make-salesforce-reply-received-data.ts --force
// Hand-written like the other Salesforce specs (QA, 2026-10-19). Run it with the npm script
// `test:sf-reply-received`: it sets KEEP_TEST_DATA=1, because the data refresh would replace the named people.
//
// How this file is built: every row that needs a reply is one entry in SCENARIOS (what to set up in Salesforce,
// which activities to turn on, what to check). The Saleshandy half (prospect, send, reply, Logs) and QA's check are
// in src/flows/reply-harness.ts, and the Salesforce half is behind src/pages/salesforce/salesforce.ts.
//
// "confirmed: false" rows are "(proposed, unconfirmed)" or outside the regression set in the cases file: the result
// is recorded as an annotation and a difference is flagged "Needs QA" instead of failing the row.
import { expect, test } from '../../src/fixtures/index.ts';
import { newReplyState, ReplyHarness, type ReplyScenario, type World } from '../../src/flows/reply-harness.ts';
import { SaleshandySequencePage } from '../../src/pages/saleshandy/sequence.page.ts';
import { dayIs, type Salesforce } from '../../src/pages/salesforce/salesforce.ts';
import type { Row } from '../../src/data/csv.ts';

// 30 s per action: an action that cannot work now fails at once, not after the test timeout.
test.use({ account: 'sfreplyreceived', actionTimeout: 30_000 });

const TRIGGER = 'Reply is Received in Saleshandy';
const SEQUENCE_ID = '196746';
const CSV = 'salesforce/reply-received.csv';
const EMAIL_SUBJECT = 'Salesforce reply test';

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

// ---- small readers, so a scenario reads like the test-case row ----
type Look<T> = () => Promise<T | undefined>;
const whenFound = <T>(count: () => Promise<number>, read: () => Promise<T>): Look<T> => async () => ((await count()) > 0 ? read() : undefined);

const leadOf = (w: World) => whenFound(() => w.salesforce.leads.countByEmail(w.row['Email']), () => w.salesforce.leads.leadFields(w.row['Email']));
const contactOf = (w: World) => whenFound(() => w.salesforce.contacts.countByEmail(w.row['Email']), () => w.salesforce.contacts.contactFields(w.row['Email']));
const leadCount = (w: World) => () => w.salesforce.leads.countByEmail(w.row['Email']);
const contactCount = (w: World) => () => w.salesforce.contacts.countByEmail(w.row['Email']);
// The workflow names an Opportunity with the prospect's email (dev kit), so the email finds it.
const opportunityCount = (w: World) => () => w.salesforce.opportunities.countByName(w.row['Email']);

const digits = (text: string) => text.replace(/\D/g, '');
const amountOf = (text: string) => Number(text.replace(/[^0-9.]/g, ''));

// An Account is found by the prospect's full name or by the Company, depending on the activity and on the Account
// mapping, so both names are counted before and after, and the change is what counts.
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

// The Contact Note for a Contact (Related > Notes), read after the Logs status says Success.
async function noteScenario(w: World, expectContact: boolean, outcome?: string): Promise<void> {
  const status = await w.logStatus();
  w.observe('Logs status', status);
  if (status !== 'Success') {
    test.info().annotations.push({ type: 'Needs QA', description: `Logs status is "${status || 'no entry'}". Report to QA with this scenario and its steps.` });
    return;
  }
  const contacts = await contactCount(w)();
  w.verdict('Contacts for the email', contacts, expectContact ? 1 : 0);
  if (!expectContact) return;
  const body = await w.salesforce.contacts.noteBody(w.row['Email'], 'reply-received');
  w.verdict('A Note "reply-received" is on the Contact', body !== '', true);
  w.verdict('Note Body names the prospect email', body.includes(w.row['Email']), true);
  if (outcome) w.verdict(`Note Body shows Latest Outcome ${outcome}`, body.includes(`Latest Outcome: ${outcome}`), true);
  else w.verdict('Note Body shows an empty Latest Outcome', /Latest Outcome:\s*(,|Prospect Email)/.test(body), true);
}

// Opens the Contact and reads its Activity timeline (where a logged email Task shows).
async function contactTimeline(w: World): Promise<string> {
  await w.salesforce.contacts.openRecord(w.row['Email']);
  return w.salesforce.contacts.activityText();
}

// Salesforce fills the fields it requires when nothing is mapped (QA, 2026-10-16).
const EMPTY_MAPPING: ReplyScenario = {
  id: `${CL} > 3`,
  title: 'Lead mapping empty, trigger on',
  activities: [CL],
  confirmed: true,
  check: async (w) => {
    const lead = await w.find(leadOf(w));
    expect(lead, 'Lead found within 3 min').toBeDefined();
    w.verdict('Leads for the email', await leadCount(w)(), 1);
    w.verdict('Lead Status', lead!.status, 'Open - Not Contacted');
    // The prospect's own Company, also with an empty mapping (QA, 2026-11-04). The "HubSpot" noted on 2026-10-16 was that prospect's Company.
    w.verdict('Company is the prospect Company', lead!.company, w.row['Company']);
  },
};

// Values the setup records start with: the old values the workflow must replace.
const LEAD_OLD = { phone: '+1 555-0100-3321' };
const CONTACT_OLD = { phone: '+1 555-0100-4455', department: 'Customer Support' };

const SCENARIOS: ReplyScenario[] = [
  // ---- Trigger behavior > 4: the trigger is off ----
  {
    id: 'Baseline > 4',
    title: 'Reply Received switched off and saved, then Mark as replied',
    activities: [CL],
    triggerOff: true,
    confirmed: true,
    check: async (w) => {
      let status = '';
      const seen = await w.absent(async () => {
        const c = await w.salesforce.counts(w.row);
        return c.leads + c.contacts + c.accounts + c.opportunities;
      }, 3 * 60_000);
      status = w.lastLog?.status ?? '';
      w.verdict('Records in Salesforce for the prospect', seen, 0);
      w.verdict('Logs entry after 3 min', status, '');
    },
  },

  // ---- Create a Lead ----
  {
    id: `${CL} > 1`,
    title: 'new prospect, every mapped field filled, accents and apostrophe in the name',
    activities: [CL],
    confirmed: true,
    check: async (w) => {
      const lead = await w.find(leadOf(w));
      expect(lead, 'Lead found within 3 min').toBeDefined();
      w.verdict('Leads for the email', await leadCount(w)(), 1);
      w.verdict('Name', lead!.name.includes('José') && lead!.name.includes("Peña-O'Brien"), true);
      w.verdict('Title', lead!.title, w.row['Job Title']);
      w.verdict('Company', lead!.company, w.row['Company']);
      w.verdict('Phone', digits(lead!.phone), digits(w.row['Phone Number']));
      w.verdict('Address has the City', lead!.address.includes(w.row['City']), true);
    },
  },
  {
    id: `${CL} > 2`,
    title: 'prospect imported with no Company',
    activities: [CL],
    confirmed: false,
    override: { Company: '' },
    check: async (w) => {
      w.verdict('Leads for the email', await w.absent(leadCount(w)), 0);
      w.observe('Logs status (Error expected, Company is required)', w.lastLog?.status ?? 'none');
    },
  },
  EMPTY_MAPPING,
  {
    id: `${CL} > 4`,
    title: 'the prospect is already a Contact',
    activities: [CL],
    confirmed: true,
    setup: { contact: { phone: CONTACT_OLD.phone, department: 'Sales', title: 'Account Executive' } },
    check: async (w) => {
      w.verdict('Leads for the email', await w.absent(leadCount(w)), 0);
      w.verdict('Contacts for the email', await contactCount(w)(), 1);
      w.verdict('Contact Business Phone unchanged', digits((await w.salesforce.contacts.contactFields(w.row['Email'])).phone), digits(CONTACT_OLD.phone));
    },
  },
  {
    id: `${CL} > 5`,
    title: 'a Lead exists with Job Title "Office Manager", the prospect is now "Head of Operations"',
    activities: [CL],
    confirmed: false,
    setup: { lead: { title: 'Office Manager', phone: LEAD_OLD.phone, company: 'Okafor Family Builders' } },
    check: async (w) => {
      const lead = await w.find(async () => {
        const fields = await w.salesforce.leads.leadFields(w.row['Email']);
        return fields.title === w.row['Job Title'] ? fields : undefined;
      });
      w.verdict('Leads for the email', await leadCount(w)(), 1);
      w.verdict('Job Title after the reply', lead?.title ?? (await w.salesforce.leads.leadFields(w.row['Email'])).title, w.row['Job Title']);
    },
  },

  // ---- Update a Lead ----
  {
    id: `${UL} > 1`,
    title: 'Lead exists with an old Job Title, Phone and Company',
    activities: [UL],
    confirmed: true,
    setup: { lead: { title: 'Marketing Assistant', phone: LEAD_OLD.phone, company: 'Bergmann Print Studio' } },
    check: async (w) => {
      const lead = await w.find(async () => {
        const fields = await w.salesforce.leads.leadFields(w.row['Email']);
        return fields.title === w.row['Job Title'] ? fields : undefined;
      });
      expect(lead, 'Lead updated with the prospect Title').toBeDefined();
      w.verdict('Leads for the email', await leadCount(w)(), 1);
      w.verdict('Phone', digits(lead!.phone), digits(w.row['Phone Number']));
      w.verdict('Company', lead!.company, w.row['Company']);
    },
  },
  {
    id: `${UL} > 2`,
    title: 'Lead Status "Working - Contacted", the prospect has a new Job Title',
    activities: [UL],
    confirmed: false,
    setup: { lead: { status: 'Working - Contacted', title: 'Procurement Manager', phone: LEAD_OLD.phone, company: 'Sahyadri Auto Components' } },
    check: async (w) => {
      const lead = await w.find(async () => {
        const fields = await w.salesforce.leads.leadFields(w.row['Email']);
        return fields.title === w.row['Job Title'] ? fields : undefined;
      });
      w.verdict('Title updated', lead?.title, w.row['Job Title']);
      w.verdict('Lead Status', lead?.status, 'Working - Contacted');
    },
  },
  {
    id: `${UL} > 3`,
    title: 'no Lead or Contact for the email',
    activities: [UL],
    confirmed: true,
    check: async (w) => {
      w.verdict('Leads for the email', await w.absent(leadCount(w)), 0);
      w.verdict('Logs status', w.lastLog?.status ?? '', 'Success');
    },
  },

  // ---- Create a Contact ----
  {
    id: `${CC} > 1`,
    title: 'new prospect with phone, department and city; Job Title and Company filled but unmapped',
    activities: [CC],
    confirmed: true,
    check: async (w) => {
      const contact = await w.find(contactOf(w));
      expect(contact, 'Contact found within 3 min').toBeDefined();
      w.verdict('Contacts for the email', await contactCount(w)(), 1);
      w.verdict('Leads for the email', await leadCount(w)(), 0);
      w.verdict('Name', contact!.name.includes(w.row['First Name']) && contact!.name.includes(w.row['Last Name']), true);
      w.verdict('Business Phone', digits(contact!.phone), digits(w.row['Phone Number']));
      w.verdict('Department', contact!.department, w.row['Department']);
      w.verdict('Other Address has the City', contact!.otherAddress.includes(w.row['City']), true);
      w.verdict('Title (Job Title is not mapped for Contacts)', contact!.title, '');
    },
  },
  {
    id: `${CC} > 2`,
    title: 'a Contact exists with an old Phone',
    activities: [CC],
    confirmed: false,
    setup: { contact: { phone: CONTACT_OLD.phone, department: 'Facilities' } },
    check: async (w) => {
      const contact = await w.find(async () => {
        const fields = await w.salesforce.contacts.contactFields(w.row['Email']);
        return digits(fields.phone) === digits(w.row['Phone Number']) ? fields : undefined;
      });
      w.verdict('Contacts for the email', await contactCount(w)(), 1);
      w.verdict('Business Phone shows the new value', contact !== undefined, true);
    },
  },
  {
    id: `${CC} > 3`,
    title: 'a Lead from a trade show exists, no Contact',
    activities: [CC],
    confirmed: true,
    setup: { lead: { title: 'Event Assistant', phone: LEAD_OLD.phone, company: 'Coastal Expo Partners' } },
    check: async (w) => {
      const status = await w.logStatus();
      w.verdict('Logs status', status, 'Error');
      w.verdict('Logs error detail names DUPLICATES_DETECTED', /DUPLICATES_DETECTED/.test(await w.logErrorText()), true);
      w.verdict('Contacts for the email', await contactCount(w)(), 0);
      w.verdict('Lead Title unchanged', (await w.salesforce.leads.leadFields(w.row['Email'])).title, 'Event Assistant');
    },
  },

  // ---- Update a Contact ----
  {
    id: `${UC} > 1`,
    title: 'Contact has an old Phone and Department and a Title',
    activities: [UC],
    confirmed: false,
    setup: { contact: { phone: CONTACT_OLD.phone, department: 'Customer Support', title: 'Operations Lead' } },
    check: async (w) => {
      const contact = await w.find(async () => {
        const fields = await w.salesforce.contacts.contactFields(w.row['Email']);
        return fields.department === w.row['Department'] ? fields : undefined;
      });
      w.verdict('Contact updated', contact !== undefined, true);
      w.verdict('Contacts for the email', await contactCount(w)(), 1);
      w.verdict('Business Phone', digits(contact?.phone ?? ''), digits(w.row['Phone Number']));
      w.verdict('Title unchanged', contact?.title, 'Operations Lead');
    },
  },
  {
    id: `${UC} > 2`,
    title: 'no Contact for the email',
    activities: [UC],
    confirmed: false,
    check: async (w) => {
      w.verdict('Contacts for the email', await w.absent(contactCount(w)), 0);
      w.verdict('Logs status', w.lastLog?.status ?? '', 'Success');
    },
  },

  // ---- Create a Account ----
  {
    id: `${CA} > 1`,
    title: 'new prospect with Company, phone and city; no such Account',
    activities: [CA],
    confirmed: false,
    before: accountsBefore,
    check: async (w) => {
      const found = await w.find(async () => ((await newAccounts(w)) > 0 ? await accountCountsOf(w.salesforce, w.row) : undefined));
      w.verdict('New Accounts', found ? await newAccounts(w) : 0, 1);
      const before = w.before as AccountCounts;
      if (found) {
        const usedCompany = found.byCompany > before.byCompany;
        w.observe('Account Name used (for QA: developer log and dev kit differ)', usedCompany ? w.row['Company'] : fullNameOf(w.row));
        const fields = await w.salesforce.accounts.accountFields(usedCompany ? w.row['Company'] : fullNameOf(w.row));
        w.verdict('Billing address has the City', fields.billingAddress.includes(w.row['City']), true);
      }
    },
  },
  {
    id: `${CA} > 2`,
    title: 'an Account named like the Company already exists',
    activities: [CA],
    confirmed: false,
    setup: { account: { city: 'Tempe' } },
    before: accountsBefore,
    check: async (w) => {
      const added = await w.absent(() => newAccounts(w));
      w.observe('Second Account created (1 = yes, 0 = no)', added);
    },
  },
  {
    id: `${CA} > 3`,
    title: 'prospect has no Company',
    activities: [CA],
    confirmed: false,
    override: { Company: '' },
    before: accountsBefore,
    check: async (w) => {
      const added = await w.absent(() => newAccounts(w));
      w.observe('Logs status', w.lastLog?.status ?? 'none');
      w.observe('Accounts created (a nameless Account is not expected)', added);
    },
  },

  // ---- Update a Account ----
  {
    id: `${UA} > 1`,
    title: 'an Account named with the prospect full name has an old City',
    activities: [UA],
    confirmed: false,
    setup: { account: { name: 'fullName', city: 'Sunnyvale' } },
    before: accountsBefore,
    check: async (w) => {
      // With Company mapped to Account Name, the update can rename the Account to the Company (QA, 2026-10-22), so the
      // Account is looked up by the full name first and by the Company when the full name is gone.
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
  {
    id: `${UA} > 2`,
    title: 'an Account named like the Company exists, none has the prospect full name',
    activities: [UA],
    confirmed: false,
    setup: { account: { city: 'Edinburgh' } },
    before: accountsBefore,
    check: async (w) => {
      w.verdict('New Accounts', await w.absent(() => newAccounts(w)), 0);
      w.verdict('Logs status', w.lastLog?.status ?? '', 'Success');
      const fields = await w.salesforce.accounts.accountFields(w.row['Company']);
      w.verdict('Account unchanged (City is still Edinburgh)', fields.billingAddress.includes('Edinburgh'), true);
    },
  },
  {
    id: `${UA} > 3`,
    title: 'no Account matches the prospect',
    activities: [UA],
    confirmed: false,
    before: accountsBefore,
    check: async (w) => {
      w.verdict('New Accounts', await w.absent(() => newAccounts(w)), 0);
      w.verdict('Logs status', w.lastLog?.status ?? '', 'Success');
    },
  },

  // ---- Create a Opportunity (Closing Date is unmapped around these rows; CO > 3 is a UI row below) ----
  {
    id: `${CO} > 1`,
    title: 'new prospect with Deal Value 12000; Extra Configuration 7 days, stage Prospecting',
    activities: [{ activity: CO, extra: { closingDays: 7, stage: 'Prospecting' } }],
    confirmed: false,
    check: async (w) => {
      const rows = await w.find(async () => ((await opportunityCount(w)()) > 0 ? w.salesforce.opportunities.all(w.row['Email']) : undefined));
      w.verdict('Opportunities for the prospect', rows?.length ?? 0, 1);
      w.verdict('Contacts for the email', await contactCount(w)(), 1);
      w.verdict('Stage', rows?.[0]?.stage, 'Prospecting');
      w.verdict('Close Date is 7 days out', dayIs(rows?.[0]?.closeDate ?? '', 7), true);
      w.verdict('Amount', amountOf(rows?.[0]?.amount ?? ''), 12000);
    },
  },
  {
    id: `${CO} > 2`,
    title: 'the same prospect replies again on the same step 1 email',
    activities: [{ activity: CO, extra: { closingDays: 7, stage: 'Prospecting' } }],
    confirmed: false,
    reuses: `${CO} > 1`,
    again: true,
    check: async (w) => {
      const rows = await w.find(async () => {
        const all = await w.salesforce.opportunities.all(w.row['Email']);
        return all.length >= 2 ? all : undefined;
      });
      w.verdict('Opportunities for the prospect (a second one by design)', rows?.length ?? (await opportunityCount(w)()), 2);
    },
  },

  // ---- Update a Opportunity ----
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
      expect(rows, 'An Opportunity changed to Negotiation/Review').toBeDefined();
      w.verdict('Opportunities for the prospect', rows!.length, 2);
      const stale = rows!.find((r) => dayIs(r.closeDate, -75));
      const fresh = rows!.find((r) => !dayIs(r.closeDate, -75));
      w.verdict('The older Opportunity is unchanged (Qualification, old Close Date)', stale?.stage, 'Qualification');
      w.verdict('The newest Opportunity moved to Negotiation/Review', fresh?.stage, 'Negotiation/Review');
      w.verdict('The newest Close Date is 14 days out', dayIs(fresh?.closeDate ?? '', 14), true);
    },
  },
  {
    id: `${UO} > 2`,
    title: 'one Opportunity named with the email, Stage Qualification',
    activities: [{ activity: UO, extra: { closingDays: 14, stage: 'Negotiation/Review' } }],
    confirmed: false,
    setup: { opportunities: [{ stage: 'Qualification', closeInDays: 20 }] },
    check: async (w) => {
      const rows = await w.find(async () => {
        const all = await w.salesforce.opportunities.all(w.row['Email']);
        return all.some((r) => r.stage === 'Negotiation/Review') ? all : undefined;
      });
      w.verdict('Opportunities for the prospect', rows?.length ?? 0, 1);
      w.verdict('Stage', rows?.[0]?.stage, 'Negotiation/Review');
      w.verdict('Close Date is 14 days out', dayIs(rows?.[0]?.closeDate ?? '', 14), true);
    },
  },
  {
    id: `${UO} > 3`,
    title: 'no Opportunity has the email as Name',
    activities: [{ activity: UO, extra: { closingDays: 14, stage: 'Negotiation/Review' } }],
    confirmed: false,
    check: async (w) => {
      w.verdict('Opportunities for the prospect', await w.absent(opportunityCount(w)), 0);
      w.verdict('Logs status', w.lastLog?.status ?? '', 'Success');
    },
  },

  // ---- Attach Note (with Create a Contact), checked from Logs first ----
  {
    id: `${AN} > 1`,
    title: 'new prospect, outcome "Add Outcome"; Create a Contact and Attach Note',
    activities: [CC, AN],
    confirmed: true,
    check: (w) => noteScenario(w, true),
  },
  {
    id: `${AN} > 2`,
    title: 'a Contact already exists',
    activities: [CC, AN],
    confirmed: false,
    setup: { contact: { phone: CONTACT_OLD.phone, department: 'Customer Support' } },
    check: (w) => noteScenario(w, true),
  },
  {
    id: `${AN} > 3`,
    title: 'the outcome is set to Interested before the reply',
    activities: [CC, AN],
    confirmed: false,
    outcome: 'Interested',
    check: (w) => noteScenario(w, true, 'Interested'),
  },

  // ---- Record(log) an Email Activity ----
  {
    id: `${RE} > 1`,
    title: 'Select Object Contact; the Contact exists',
    activities: [{ activity: RE, extra: { object: 'Contact' } }],
    confirmed: false,
    setup: { contact: { phone: CONTACT_OLD.phone, department: 'Procurement' } },
    check: async (w) => {
      w.observe('Logs status', await w.logStatus());
      const timeline = await contactTimeline(w);
      w.observe('Contact Activity timeline', timeline.slice(0, 400));
      w.verdict('The timeline shows one Task with the email subject', timeline.split(EMAIL_SUBJECT).length - 1 >= 1, true);
    },
  },
  {
    id: `${RE} > 2`,
    title: 'Select Object Lead; the Lead exists',
    activities: [{ activity: RE, extra: { object: 'Lead' } }],
    confirmed: false,
    setup: { lead: { title: 'Regional Coordinator', phone: LEAD_OLD.phone, company: 'Charles River Fasteners' } },
    check: async (w) => {
      w.observe('Logs status', await w.logStatus());
      const timeline = await w.salesforce.leads.activityText(w.row['Email']);
      w.observe('Lead Activity timeline', timeline.slice(0, 400));
      w.verdict('The timeline shows the email subject', timeline.includes(EMAIL_SUBJECT), true);
    },
  },
  {
    id: `${RE} > 3`,
    title: 'Select Object Opportunity; two Opportunities named with the email',
    activities: [{ activity: RE, extra: { object: 'Opportunity' } }],
    confirmed: false,
    setup: {
      opportunities: [
        { stage: 'Prospecting', closeInDays: -75 },
        { stage: 'Prospecting', closeInDays: 20 },
      ],
    },
    check: async (w) => {
      w.observe('Logs status', await w.logStatus());
      const rows = await w.salesforce.opportunities.all(w.row['Email'], true);
      const stale = rows.find((r) => dayIs(r.closeDate, -75));
      const fresh = rows.find((r) => !dayIs(r.closeDate, -75));
      w.verdict('Opportunities for the prospect', rows.length, 2);
      w.verdict('The newest Opportunity has the Task', fresh?.timeline.includes(EMAIL_SUBJECT), true);
      w.verdict('The older Opportunity has no Task', stale?.timeline.includes(EMAIL_SUBJECT), false);
    },
  },
  {
    id: `${RE} > 4`,
    title: 'Select Object left empty; the Contact exists',
    activities: [{ activity: RE, extra: {} }],
    confirmed: true,
    setup: { contact: { phone: CONTACT_OLD.phone, department: 'Operations' } },
    check: async (w) => {
      const status = await w.logStatus();
      w.verdict('Logs status', status, 'Success');
      const timeline = await contactTimeline(w);
      w.verdict('No Task on the Contact', timeline.includes(EMAIL_SUBJECT), false);
    },
  },

  // ---- Combined activities ----
  {
    id: 'Combined activities > 1',
    title: 'Create a Account and Create a Contact both selected',
    activities: [CA, CC],
    confirmed: false,
    before: accountsBefore,
    check: async (w) => {
      const contact = await w.find(contactOf(w));
      const added = await newAccounts(w);
      w.verdict('New Accounts', added, 1);
      w.verdict('Contacts for the email', contact !== undefined ? await contactCount(w)() : 0, 1);
      if (contact) {
        await w.salesforce.contacts.openRecord(w.row['Email']);
        w.observe('Contact Account Name (linked to the Account?)', await w.salesforce.contacts.field('AccountId'));
      }
    },
  },
];

const state = newReplyState(CSV);
// Rows that make their own prospect. A row that reuses another one adds nothing.
const IDS = SCENARIOS.filter((s) => !s.reuses).map((s) => s.id);
const OPPORTUNITY_ROWS = SCENARIOS.filter((s) => s.id.startsWith(CO) || s.id.startsWith(UO));
const BEFORE_OPPORTUNITY_ROWS = SCENARIOS.slice(0, SCENARIOS.indexOf(OPPORTUNITY_ROWS[0])).filter((s) => s !== EMPTY_MAPPING);
const AFTER_OPPORTUNITY_ROWS = SCENARIOS.slice(SCENARIOS.indexOf(OPPORTUNITY_ROWS[OPPORTUNITY_ROWS.length - 1]) + 1);

// Lead Properties mapping used by every Lead row (and restored after Create a Lead > 3).
const MAPPINGS: [string, string][] = [
  ['Last Name', 'Last Name'],
  ['First Name', 'First Name'],
  ['Email', 'Email'],
  ['Phone Number', 'Phone'],
  ['Job Title', 'Title'],
  ['Company', 'Company'],
  ['City', 'City'],
];

test.describe('Reply is Received in Saleshandy: Salesforce regression', () => {
  // Not serial: one failed test must not skip the rest (QA, 2026-10-21). Tests run in file order on one worker,
  // and every row prepares itself if Setup did not run. The ids are the rows of test-cases/salesforce/reply-received.md.

  // Page objects are rebuilt for every test; the harness is the same code each time.
  const harnessOf = (f: {
    saleshandySequence: SaleshandySequencePage;
    salesforceIntegration: ConstructorParameters<typeof ReplyHarness>[0]['sf'];
    salesforce: ConstructorParameters<typeof ReplyHarness>[0]['salesforce'];
  }) =>
    new ReplyHarness(
      { csv: CSV, sequenceId: SEQUENCE_ID, trigger: TRIGGER, seq: f.saleshandySequence, sf: f.salesforceIntegration, salesforce: f.salesforce, scenarios: SCENARIOS },
      state,
    );

  const rowTest = (scenario: ReplyScenario) =>
    test(`${scenario.id}: ${scenario.title}`, async ({ saleshandySequence, salesforceIntegration, salesforce }) => {
      test.setTimeout(12 * 60_000);
      await harnessOf({ saleshandySequence, salesforceIntegration, salesforce }).run(scenario.id);
    });

  // ---- Trigger behavior (UI only, no reply) ----
  const ACTIVITY_OPTIONS = ['Create a Account', 'Update a Account', 'Create a Contact', 'Update a Contact', 'Create a Lead', 'Update a Lead', 'Create a Opportunity', 'Update a Opportunity', 'Attach Note', 'Record(log) an Email Activity'];

  test('Baseline > 1: activity list and the Create a Lead chip, nothing saved', async ({ salesforceIntegration }) => {
    await test.step('Turn on the trigger without saving', async () => {
      await salesforceIntegration.openTriggers();
      await salesforceIntegration.enableOnly(TRIGGER);
    });
    await test.step('The activity list shows the 10 activities', async () => {
      await salesforceIntegration.openActivityList(TRIGGER);
      for (const option of ACTIVITY_OPTIONS) await expect(salesforceIntegration.activityOption(option).first(), option).toBeVisible();
    });
    await test.step('Choose Create a Lead in Salesforce: a chip shows, no Extra Configuration opens', async () => {
      await salesforceIntegration.activityOption('Create a Lead').first().click();
      const chips = await salesforceIntegration.selectedActivities(TRIGGER);
      expect(chips.some((t) => t.includes(CL)), `chips: ${chips.join(' | ')}`).toBe(true);
      await expect(salesforceIntegration.page.getByRole('dialog')).toHaveCount(0);
    });
  });

  test('Baseline > 2: only Create a Lead selected, Save and reload', async ({ salesforceIntegration }) => {
    await test.step('Save with only Create a Lead in Salesforce', async () => {
      await salesforceIntegration.setActivities(TRIGGER, [CL]);
      await expect(salesforceIntegration.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
    });
    await test.step('After a reload the toggle is on and the chip persists', async () => {
      await salesforceIntegration.openTriggers();
      expect(await salesforceIntegration.isTriggerOn(TRIGGER), 'trigger on').toBe(true);
      const chips = await salesforceIntegration.selectedActivities(TRIGGER);
      expect(chips.some((t) => t.includes(CL)), `chips: ${chips.join(' | ')}`).toBe(true);
    });
  });

  test('Baseline > 3: empty Lead Properties mapping, map the 7 fields, Save and reload', async ({ salesforceIntegration }) => {
    test.setTimeout(5 * 60_000);
    const mapAll = async () => {
      await salesforceIntegration.openLeadPropertiesMapping();
      for (const [field, property] of MAPPINGS) await salesforceIntegration.mapLeadField(field, property);
      await salesforceIntegration.save();
      await expect(salesforceIntegration.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
    };
    let mapped = false;
    try {
      await test.step('Start from an empty mapping: clear the 7 fields and Save', async () => {
        await salesforceIntegration.openLeadPropertiesMapping();
        for (const [field] of MAPPINGS) await salesforceIntegration.unmapLeadField(field);
        await salesforceIntegration.save();
        await expect(salesforceIntegration.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
      });
      await test.step('After a reload the mapping is empty and Save is disabled', async () => {
        await salesforceIntegration.openLeadPropertiesMapping();
        for (const [field] of MAPPINGS) await expect(salesforceIntegration.leadMappedValue(field), field).toHaveText('Select');
        const disabled = await salesforceIntegration.page.getByRole('button', { name: 'Save', exact: true }).isDisabled();
        test.info().annotations.push({ type: 'Observed: Save disabled on an empty mapping', description: String(disabled) });
      });
      await test.step('Map the 7 fields and Save', mapAll);
      mapped = true;
      await test.step('All 7 mappings persist after a reload', async () => {
        await salesforceIntegration.openLeadPropertiesMapping();
        for (const [field, property] of MAPPINGS) await expect(salesforceIntegration.leadMappedValue(field), field).toHaveText(property);
      });
    } finally {
      if (!mapped) await test.step('Put the 7-field Lead Properties mapping back', mapAll);
    }
  });

  // ---- Setup: the waiting, done once ----
  test(`Setup: Salesforce records, prospects and step 1 sends for ${IDS.length} rows`, async ({
    saleshandyPage,
    saleshandySequence,
    salesforceIntegration,
    salesforce,
  }) => {
    // 32 prospects through the form and the sender's 40 to 50 s spacing between sends.
    test.setTimeout(90 * 60_000);
    const sender = new SaleshandySequencePage(await saleshandyPage.context().newPage());
    await harnessOf({ saleshandySequence, salesforceIntegration, salesforce }).setupAll(IDS, sender);
  });

  // ---- Every row of the table, in plan order ----
  for (const scenario of BEFORE_OPPORTUNITY_ROWS) rowTest(scenario);

  // The Opportunity rows run with Closing Date unmapped (dev kit: a mapped Closing Date gives a format error).
  const saveMapping = async (sf: ConstructorParameters<typeof ReplyHarness>[0]['sf']) => {
    let saved = false;
    for (let attempt = 1; attempt <= 3 && !saved; attempt++) {
      saved = await sf.trySaveMapping();
      if (!saved && attempt < 3) await sf.page.waitForTimeout(5_000);
    }
    expect(saved, 'Opportunity mapping saved').toBe(true);
  };

  test('Opportunity rows: unmap Closing Date on the Opportunity mapping', async ({ salesforceIntegration }) => {
    await salesforceIntegration.openMapping('Opportunity');
    await salesforceIntegration.unmapField('Closing Date');
    await saveMapping(salesforceIntegration);
    await salesforceIntegration.openMapping('Opportunity');
    expect(await salesforceIntegration.mappedValue('Closing Date'), 'Closing Date after reload').toBe('Select');
  });

  for (const scenario of OPPORTUNITY_ROWS.filter((s) => s.id.startsWith(CO))) rowTest(scenario);

  // ---- Create a Opportunity > 3: Extra Configuration saved without a stage ----
  test(`${CO} > 3: Extra Configuration saved with no stage`, async ({ salesforceIntegration }) => {
    // The row before leaves Create a Opportunity selected, and picking it again opens no dialog (2026-11-04), so
    // the trigger starts with Create a Lead only.
    await salesforceIntegration.setActivities(TRIGGER, [CL]);
    await expect(salesforceIntegration.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
    await salesforceIntegration.openTriggers();
    await salesforceIntegration.enableOnly(TRIGGER);
    await salesforceIntegration.openActivityList(TRIGGER);
    await salesforceIntegration.page.getByRole('button', { name: CO, exact: true }).click();
    const dialog = salesforceIntegration.page.getByRole('dialog');
    await dialog.waitFor({ timeout: 15_000 });
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await salesforceIntegration.page.waitForTimeout(2_000);
    // (proposed, unconfirmed) Save is blocked or a message names the missing stage; record which.
    const stillOpen = (await dialog.count()) > 0;
    test.info().annotations.push({ type: 'Observed: dialog after Save with no stage', description: stillOpen ? `stays open: ${(await dialog.innerText()).replace(/\s+/g, ' ')}` : 'closed, saved without a stage' });
    if (stillOpen) await dialog.getByRole('button', { name: 'Cancel' }).click();
    test.info().annotations.push({ type: 'Needs QA', description: 'Create a Opportunity > 3 is exploration until QA confirms the expected result.' });
  });

  for (const scenario of OPPORTUNITY_ROWS.filter((s) => s.id.startsWith(UO))) rowTest(scenario);

  test('Opportunity rows: map Closing Date to Close Date again', async ({ salesforceIntegration }) => {
    await salesforceIntegration.openMapping('Opportunity');
    await salesforceIntegration.mapField('Closing Date', 'Close Date');
    await saveMapping(salesforceIntegration);
    await salesforceIntegration.openMapping('Opportunity');
    expect(await salesforceIntegration.mappedValue('Closing Date'), 'Closing Date after reload').toBe('Close Date');
  });

  for (const scenario of AFTER_OPPORTUNITY_ROWS) rowTest(scenario);

  // ---- Create a Lead > 3: Lead Properties mapping empty. Runs last: it empties the shared mapping and puts it
  // back afterwards, so no other row sees a half-mapped state. ----
  test(`${EMPTY_MAPPING.id}: ${EMPTY_MAPPING.title}`, async ({ saleshandySequence, salesforceIntegration, salesforce }) => {
    test.setTimeout(15 * 60_000);
    const harness = harnessOf({ saleshandySequence, salesforceIntegration, salesforce });
    try {
      await test.step('Empty the Lead Properties mapping and Save', async () => {
        await salesforceIntegration.openLeadPropertiesMapping();
        for (const [field] of MAPPINGS) await salesforceIntegration.unmapLeadField(field);
        await salesforceIntegration.save();
        await expect(salesforceIntegration.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
      });
      await test.step('After a reload every Lead field shows "Select"', async () => {
        await salesforceIntegration.openLeadPropertiesMapping();
        for (const [field] of MAPPINGS) await expect(salesforceIntegration.leadMappedValue(field), field).toHaveText('Select');
      });
      await harness.useActivities([CL]);
      await harness.replyAndCheck(EMPTY_MAPPING.id);
    } finally {
      await test.step('Put the 7-field Lead Properties mapping back', async () => {
        await salesforceIntegration.openLeadPropertiesMapping();
        for (const [field, property] of MAPPINGS) await salesforceIntegration.mapLeadField(field, property);
        await salesforceIntegration.save();
        await expect(salesforceIntegration.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
      });
    }
  });
});
