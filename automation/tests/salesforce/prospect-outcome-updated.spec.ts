// Scenarios: test-cases/salesforce/prospect-outcome-updated.md (Regression, 25 rows; AL-4134).
// Data: test-data/salesforce/prospect-outcome-updated.csv, one row per scenario that needs a prospect (22).
// Hand-written like the other Salesforce specs (QA, 2026-10-19).
//
// Pass/fail and who owns a failure:
// - Every product check carries a message that starts with "PRODUCT:". A failed check with that
//   prefix is a product finding (scenario, steps, expected, actual go to QA).
// - A failure without the prefix (locator timeout, form not found, sequence missing) is the script
//   or the setup and is fixed in the script.
// - Rows marked "(proposed, unconfirmed)" in the test cases never fail: they record what happened
//   as annotations (the "Needs QA" and "Observed" lines in the report) for QA to confirm.
//
// Waiting is done once, up front (QA, 2026-10-20): "Setup" creates the Salesforce records, the
// prospects and the step 1 sends for all 22 rows side by side. Each row then only changes the
// outcome and checks Salesforce. A row run on its own (-g) prepares itself, so no Setup is needed.
//
// Sequence id: OUTCOME_SEQUENCE_ID (scripts/run-prospect-outcome-updated.sh sets it).
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { TRIGGER, finishedEntry, pollFor, watchLogs } from '../../src/flows/salesforce-outcome.ts';
import { SaleshandySequencePage } from '../../src/pages/saleshandy/sequence.page.ts';
import type { OutcomeActivity, SalesforceOutcomePage } from '../../src/pages/saleshandy/salesforce-outcome.page.ts';
import type { SalesforceAccountsPage } from '../../src/pages/salesforce/accounts.page.ts';
import type { SalesforceContactsPage } from '../../src/pages/salesforce/contacts.page.ts';
import type { SalesforceLeadsPage } from '../../src/pages/salesforce/leads.page.ts';
import type { SalesforceOpportunitiesPage } from '../../src/pages/salesforce/opportunities.page.ts';

// 30 s per action (set with the account below): an action that cannot work now fails at once.

const SEQUENCE_ID = process.env.OUTCOME_SEQUENCE_ID ?? '';
const CSV = 'salesforce/prospect-outcome-updated.csv';

type Ctx = {
  seq: SaleshandySequencePage;
  sf: SalesforceOutcomePage;
  accounts: SalesforceAccountsPage;
  contacts: SalesforceContactsPage;
  leads: SalesforceLeadsPage;
  opps: SalesforceOpportunitiesPage;
};

// One bundle of the page objects, so each test names a single fixture.
const test = base.extend<{ ctx: Ctx }>({
  ctx: async ({ saleshandySequence, salesforceOutcome, salesforceAccounts, salesforceContacts, salesforceLeads, salesforceOpportunities }, use) =>
    use({ seq: saleshandySequence, sf: salesforceOutcome, accounts: salesforceAccounts, contacts: salesforceContacts, leads: salesforceLeads, opps: salesforceOpportunities }),
});

test.use({ account: 'sfoutcomeupdated', actionTimeout: 30_000 });

// Activity names as the product lists them.
const CA = 'Create a Account in Salesforce';
const UA = 'Update a Account in Salesforce';
const CC = 'Create a Contact in Salesforce';
const UC = 'Update a Contact in Salesforce';
const CL = 'Create a Lead in Salesforce';
const UL = 'Update a Lead in Salesforce';
const CO = 'Create a Opportunity in Salesforce';
const UO = 'Update a Opportunity in Salesforce';
const AN = 'Attach Note in Salesforce';
const RE = 'Record(log) an Email Activity in Salesforce';

// Extra Configuration per group (test cases, under each activity heading).
const CONFIG: Record<string, OutcomeActivity[]> = {
  [CA]: [{ name: CA, outcome: 'Uncategorized' }],
  [UA]: [{ name: UA, outcome: 'Interested' }],
  [CC]: [{ name: CC, outcome: 'Not Interested' }],
  [UC]: [{ name: UC, outcome: 'Meeting Booked' }],
  [CL]: [{ name: CL, outcome: 'Out of Office' }],
  [UL]: [{ name: UL, outcome: 'Closed' }],
  [CO]: [{ name: CO, outcome: 'Not Now', stage: 'Prospecting', days: 1 }],
  [UO]: [{ name: UO, outcome: 'Do Not Contact', stage: 'Qualification', days: 1 }],
  [AN]: [{ name: CC, outcome: 'Not Interested' }, { name: AN }],
  [`${AN} alone`]: [{ name: AN }],
  [RE]: [{ name: RE, objects: ['Contact'] }],
};

// Legacy values of the Salesforce records made by hand before an Update row.
const LEGACY = { company: 'Legacy Co', title: 'Legacy Title QA', phone: '+1 555-0100-0000', city: 'Legacyville', amount: '100' };

// What each row needs in Salesforce before the outcome changes.
type Needs = { account?: boolean; contact?: boolean; lead?: boolean; opp?: boolean };
const NEEDS: Record<string, Needs> = {
  [`${UA} > 1`]: { account: true },
  [`${UA} > 2`]: { account: true },
  [`${UC} > 1`]: { contact: true },
  [`${UC} > 2`]: { contact: true },
  [`${CL} > 3`]: { lead: true },
  [`${UL} > 1`]: { lead: true },
  [`${UL} > 2`]: { lead: true },
  [`${UO} > 1`]: { opp: true },
  [`${UO} > 2`]: { opp: true },
  [`${RE} > 1`]: { contact: true },
};
const IDS = [
  [CA, 2], [UA, 2], [CC, 2], [UC, 3], [CL, 3], [UL, 2], [CO, 2], [UO, 2], [AN, 3], [RE, 1],
].flatMap(([activity, n]) => Array.from({ length: n as number }, (_, i) => `${activity} > ${i + 1}`));

const done = { record: new Set<string>(), added: new Set<string>(), sent: new Set<string>() };
let configured = '';

const rowOf = (id: string): Row => {
  const row = readCsv(CSV).find((r) => r['Scenario'] === id);
  if (!row) throw new Error(`No row "${id}" in test-data/${CSV}`);
  return row;
};
const fullName = (row: Row) => `${row['First Name']} ${row['Last Name']}`;
const note = (type: string, description: string) => test.info().annotations.push({ type, description });
// A product check: the "PRODUCT:" prefix is what marks a failure as a product finding.
const product = <T>(value: T, what: string) => expect(value, `PRODUCT: ${what}`);

// This org shows dates as DD/MM/YYYY ("Format: 31/12/2024" on the New Opportunity form).
const inDays = (days: number): string => {
  const d = new Date(Date.now() + days * 86_400_000);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;
};

async function addRecords(ctx: Ctx, id: string, row: Row): Promise<void> {
  const needs = NEEDS[id];
  if (!needs || done.record.has(id)) return;
  if (needs.account) await ctx.accounts.createAccount({ name: row['Company'], billingCity: LEGACY.city });
  if (needs.contact) await ctx.contacts.createContact({ firstName: row['First Name'], lastName: row['Last Name'], email: row['Email'] });
  if (needs.lead) {
    await ctx.leads.createLead({ firstName: row['First Name'], lastName: row['Last Name'], email: row['Email'], company: LEGACY.company, title: LEGACY.title, phone: LEGACY.phone });
  }
  if (needs.opp) {
    await ctx.opps.createOpportunity({ name: row['Email'], stage: 'Prospecting', closeDate: inDays(30), amount: LEGACY.amount });
  }
  done.record.add(id);
}

// The row is marked used first: a failed add can still leave the prospect in Saleshandy.
async function addProspect(seq: SaleshandySequencePage, id: string, row: Row): Promise<void> {
  if (done.added.has(id)) return;
  markUsed(CSV, row['Email']);
  await seq.createAndAddProspect(SEQUENCE_ID, row);
  done.added.add(id);
}

async function sendOut(seq: SaleshandySequencePage, id: string, row: Row): Promise<void> {
  if (done.sent.has(id)) return;
  await seq.sendNow(SEQUENCE_ID, fullName(row));
  done.sent.add(id);
}

async function prepare(ctx: Ctx, id: string, row: Row): Promise<void> {
  await addRecords(ctx, id, row);
  await addProspect(ctx.seq, id, row);
  await sendOut(ctx.seq, id, row);
}

async function useActivities(ctx: Ctx, key: string): Promise<void> {
  if (configured === key) return;
  await test.step(`Set the trigger "${TRIGGER}" to: ${CONFIG[key].map((a) => a.name).join(' + ')}`, async () => {
    await ctx.sf.configureOutcomeTrigger(CONFIG[key]);
    configured = key;
  });
}

// Prepare, make sure step 1 is Sent, change the outcome; returns the time of the change.
async function changeOutcome(ctx: Ctx, id: string, row: Row, outcome: string): Promise<number> {
  await test.step('Make sure the Salesforce records, the prospect and the step 1 send are ready', () => prepare(ctx, id, row));
  await test.step('Wait until the step 1 email shows Sent', () => ctx.seq.ensureSent(SEQUENCE_ID, fullName(row)));
  const at = Date.now();
  await test.step(`Change the prospect outcome to ${outcome}`, () => ctx.seq.setProspectOutcome(SEQUENCE_ID, row['Email'], outcome));
  return at;
}

// Matching row: poll Salesforce for up to 3 minutes. If nothing shows, record the Logs status.
async function matching<T>(ctx: Ctx, at: number, look: () => Promise<T | undefined>): Promise<T | undefined> {
  const found = await test.step('Poll Salesforce for up to 3 minutes (15 s after the change, then every 10 s)', () => pollFor(ctx.accounts.page, look));
  if (found !== undefined) return found;
  const entry = await test.step('Not in Salesforce: read the Logs status', () => finishedEntry(ctx.sf, at));
  note('Logs row', entry?.text ?? 'no finished Logs entry within 2 minutes');
  note('Logs status', entry?.status ?? 'none');
  if (entry?.status === 'Error') note('Needs QA', 'Logs shows Error and the record is not in Salesforce. Ask QA with this scenario and its steps.');
  return undefined;
}

// Non-matching row: wait the 3 minutes with the Logs refreshes; the caller then checks Salesforce.
async function nonMatching(ctx: Ctx, at: number): Promise<void> {
  const entries = await test.step('Wait 3 minutes, refreshing Logs (15 s, then every 10 s)', () => watchLogs(ctx.sf, at));
  note('Logs rows during the wait', entries.length ? entries.map((e) => e.text).join(' | ') : 'none');
  note('Logs status', entries.map((e) => e.status).join(', ') || 'none');
}

const ROW_TIMEOUT = 15 * 60_000;

test.describe('Prospect Outcome is updated in Saleshandy: Salesforce activities', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(() => {
    if (!SEQUENCE_ID) throw new Error('OUTCOME_SEQUENCE_ID is not set. Run scripts/run-prospect-outcome-updated.sh (it creates the sequence and sets the id).');
  });

  test.describe('Trigger behavior (baseline)', () => {
    test('Trigger behavior > 1: trigger on, the activity list offers all 10 activities', async ({ salesforceOutcome }) => {
      const offered = await salesforceOutcome.offeredActivities();
      note('Activities offered', offered.join(' | '));
      for (const activity of [CA, UA, CC, UC, CL, UL, CO, UO, AN, RE]) {
        product(offered.some((o) => o.startsWith(activity.replace(/ in Salesforce$/, ''))), `"${activity}" is in the activity list`).toBe(true);
      }
    });

    for (const [n, activity, label] of [[2, CO, 'creating'], [3, UO, 'updating']] as const) {
      test(`Trigger behavior > ${n}: ${activity} opens Extra Configuration`, async ({ salesforceOutcome }) => {
        await salesforceOutcome.openTriggers();
        await salesforceOutcome.enableOnly(salesforceOutcome.trigger);
        const text = await salesforceOutcome.dialogTextOf(activity);
        note('Extra Configuration text', text);
        product(text, `Extra Configuration shows Closing date (while ${label}) in Days`).toMatch(new RegExp(`Closing date.*${label}`, 'i'));
        product(text, 'Extra Configuration shows Opportunity Stage').toMatch(/Opportunity Stage/i);
        product(text, 'Extra Configuration shows Select Outcome').toMatch(/Select Outcome/i);
      });
    }
  });

  test('Setup: Salesforce records, prospects and step 1 sends for all 22 rows', async ({ saleshandyPage, ctx }) => {
    test.setTimeout(45 * 60_000);
    const saleshandySequence = ctx.seq;
    const sender = new SaleshandySequencePage(await saleshandyPage.context().newPage());
    const added = IDS.map(() => {
      let resolve!: () => void;
      const promise = new Promise<void>((r) => (resolve = r));
      return { promise, resolve };
    });
    await test.step('Create records, add prospects and send step 1, side by side', async () => {
      const records = async () => {
        for (const id of IDS) await addRecords(ctx, id, rowOf(id));
      };
      const prospects = async () => {
        for (const [i, id] of IDS.entries()) {
          await addProspect(saleshandySequence, id, rowOf(id));
          added[i].resolve();
        }
      };
      const sends = async () => {
        for (const [i, id] of IDS.entries()) {
          await added[i].promise;
          await sendOut(sender, id, rowOf(id));
        }
      };
      await Promise.all([records(), prospects(), sends()]);
    });
  });

  test.describe(CA, () => {
    test(`${CA} > 1: new prospect with a Company, matching outcome`, async ({ ctx }) => {
      test.setTimeout(ROW_TIMEOUT);
      const id = `${CA} > 1`;
      const row = rowOf(id);
      await useActivities(ctx, CA);
      await prepare(ctx, id, row);
      const before = await ctx.accounts.countByName(row['Company']);
      const at = await changeOutcome(ctx, id, row, 'Uncategorized');
      const count = await matching(ctx, at, async () => {
        const n = await ctx.accounts.countByName(row['Company']);
        return n > before ? n : undefined;
      });
      product(count, `an Account named "${row['Company']}" is created (had ${before} before)`).toBe(before + 1);
      note('Observed (awaiting QA confirmation)', `Account rows: ${(await ctx.accounts.rowTexts(row['Company'])).join(' | ')}; prospect City: ${row['City']}`);
    });

    test(`${CA} > 2: new prospect with a Company, outcome not matching`, async ({ ctx }) => {
      test.setTimeout(ROW_TIMEOUT);
      const id = `${CA} > 2`;
      const row = rowOf(id);
      await useActivities(ctx, CA);
      await prepare(ctx, id, row);
      const before = await ctx.accounts.countByName(row['Company']);
      const at = await changeOutcome(ctx, id, row, 'Interested');
      await nonMatching(ctx, at);
      product(await ctx.accounts.countByName(row['Company']), `no new Account named "${row['Company']}" (had ${before} before)`).toBe(before);
    });
  });

  test.describe(UA, () => {
    test(`${UA} > 1: Account named after the Company exists with an old Billing City, matching outcome`, async ({ ctx }) => {
      test.setTimeout(ROW_TIMEOUT);
      const id = `${UA} > 1`;
      const row = rowOf(id);
      await useActivities(ctx, UA);
      const at = await changeOutcome(ctx, id, row, 'Interested');
      // (proposed, unconfirmed): recorded, not asserted.
      const rows = await matching(ctx, at, async () => {
        const texts = await ctx.accounts.rowTexts(row['Company']);
        return texts.some((t) => t.includes(row['City'])) ? texts : undefined;
      });
      note('Observed (awaiting QA confirmation)', rows ? `Updated. Account rows: ${rows.join(' | ')}` : `Not updated. Account rows: ${(await ctx.accounts.rowTexts(row['Company'])).join(' | ')}`);
    });

    test(`${UA} > 2: same setup, outcome not matching`, async ({ ctx }) => {
      test.setTimeout(ROW_TIMEOUT);
      const id = `${UA} > 2`;
      const row = rowOf(id);
      await useActivities(ctx, UA);
      const at = await changeOutcome(ctx, id, row, 'Not Interested');
      await nonMatching(ctx, at);
      const texts = await ctx.accounts.rowTexts(row['Company']);
      note('Account rows after the wait', texts.join(' | '));
      // Other Accounts with the same Company name from earlier runs may show the City, so only the old City is asserted.
      product(texts.some((t) => t.includes(LEGACY.city)), `the Account still shows its old Billing City "${LEGACY.city}"`).toBe(true);
    });
  });

  test.describe(CC, () => {
    test(`${CC} > 1: new prospect with all mapped fields, matching outcome`, async ({ ctx }) => {
      test.setTimeout(ROW_TIMEOUT);
      const id = `${CC} > 1`;
      const row = rowOf(id);
      await useActivities(ctx, CC);
      const at = await changeOutcome(ctx, id, row, 'Not Interested');
      const count = await matching(ctx, at, async () => {
        const n = await ctx.contacts.countByEmail(row['Email']);
        return n > 0 ? n : undefined;
      });
      product(count, 'one Contact is created for the prospect').toBe(1);
      const fields = await ctx.contacts.contactFields(row['Email']);
      product(fields.name, 'Contact Name').toBe(fullName(row));
      product(fields.phone, 'Contact Business Phone').toBe(row['Phone Number']);
      product(fields.department, 'Contact Department').toBe(row['Department']);
      product(fields.otherAddress, 'Contact Other Address').toContain(row['City']);
      product(await ctx.leads.countByEmail(row['Email']), 'no Lead is created').toBe(0);
    });

    test(`${CC} > 2: outcome not matching`, async ({ ctx }) => {
      test.setTimeout(ROW_TIMEOUT);
      const id = `${CC} > 2`;
      const row = rowOf(id);
      await useActivities(ctx, CC);
      const at = await changeOutcome(ctx, id, row, 'Meeting Booked');
      await nonMatching(ctx, at);
      product(await ctx.contacts.countByEmail(row['Email']), 'no Contact is created').toBe(0);
      product(await ctx.leads.countByEmail(row['Email']), 'no Lead is created').toBe(0);
    });
  });

  test.describe(UC, () => {
    test(`${UC} > 1: Contact exists with no Department and no Business Phone, matching outcome`, async ({ ctx }) => {
      test.setTimeout(ROW_TIMEOUT);
      const id = `${UC} > 1`;
      const row = rowOf(id);
      await useActivities(ctx, UC);
      const at = await changeOutcome(ctx, id, row, 'Meeting Booked');
      const fields = await matching(ctx, at, async () => {
        const c = await ctx.contacts.contactFields(row['Email']);
        return c.department !== '' || c.phone !== '' ? c : undefined;
      });
      // (proposed, unconfirmed): recorded, not asserted.
      note('Observed (awaiting QA confirmation)', fields ? `Updated: ${JSON.stringify(fields)}` : 'Contact not updated');
      note('Contacts for the email', String(await ctx.contacts.countByEmail(row['Email'])));
    });

    test(`${UC} > 2: same setup, outcome not matching`, async ({ ctx }) => {
      test.setTimeout(ROW_TIMEOUT);
      const id = `${UC} > 2`;
      const row = rowOf(id);
      await useActivities(ctx, UC);
      const at = await changeOutcome(ctx, id, row, 'Out of Office');
      await nonMatching(ctx, at);
      const fields = await ctx.contacts.contactFields(row['Email']);
      product(fields.department, 'Contact Department is still empty').toBe('');
      product(fields.phone, 'Contact Business Phone is still empty').toBe('');
    });

    test(`${UC} > 3: no Contact for the prospect, matching outcome`, async ({ ctx }) => {
      test.setTimeout(ROW_TIMEOUT);
      const id = `${UC} > 3`;
      const row = rowOf(id);
      await useActivities(ctx, UC);
      const at = await changeOutcome(ctx, id, row, 'Meeting Booked');
      await nonMatching(ctx, at);
      // (proposed, unconfirmed): recorded, not asserted.
      note('Observed (awaiting QA confirmation)', `Contacts for the email after the wait: ${await ctx.contacts.countByEmail(row['Email'])}`);
    });
  });

  test.describe(CL, () => {
    test(`${CL} > 1: new prospect with all mapped fields, matching outcome`, async ({ ctx }) => {
      test.setTimeout(ROW_TIMEOUT);
      const id = `${CL} > 1`;
      const row = rowOf(id);
      await useActivities(ctx, CL);
      const at = await changeOutcome(ctx, id, row, 'Out of Office');
      const count = await matching(ctx, at, async () => {
        const n = await ctx.leads.countByEmail(row['Email']);
        return n > 0 ? n : undefined;
      });
      product(count, 'one Lead is created for the prospect').toBe(1);
      const lead = await ctx.leads.leadFields(row['Email']);
      product(lead.name, 'Lead Name').toBe(fullName(row));
      product(lead.email, 'Lead Email').toBe(row['Email']);
      product(lead.company, 'Lead Company').toBe(row['Company']);
      product(lead.title, 'Lead Title').toBe(row['Job Title']);
      product(lead.phone, 'Lead Phone').toBe(row['Phone Number']);
      product(lead.address, 'Lead Address').toContain(row['City']);
    });

    test(`${CL} > 2: outcome not matching`, async ({ ctx }) => {
      test.setTimeout(ROW_TIMEOUT);
      const id = `${CL} > 2`;
      const row = rowOf(id);
      await useActivities(ctx, CL);
      const at = await changeOutcome(ctx, id, row, 'Closed');
      await nonMatching(ctx, at);
      product(await ctx.leads.countByEmail(row['Email']), 'no Lead is created').toBe(0);
    });

    test(`${CL} > 3: a Lead with the prospect's email already exists, matching outcome`, async ({ ctx }) => {
      test.setTimeout(ROW_TIMEOUT);
      const id = `${CL} > 3`;
      const row = rowOf(id);
      await useActivities(ctx, CL);
      const at = await changeOutcome(ctx, id, row, 'Out of Office');
      await nonMatching(ctx, at);
      // (proposed, unconfirmed): recorded, not asserted.
      note('Observed (awaiting QA confirmation)', `Leads for the email after the wait: ${await ctx.leads.countByEmail(row['Email'])}`);
      note('Lead after the wait', JSON.stringify(await ctx.leads.leadFields(row['Email'])));
    });
  });

  test.describe(UL, () => {
    test(`${UL} > 1: Lead exists with an old Title, Phone and Company, matching outcome`, async ({ ctx }) => {
      test.setTimeout(ROW_TIMEOUT);
      const id = `${UL} > 1`;
      const row = rowOf(id);
      await useActivities(ctx, UL);
      const at = await changeOutcome(ctx, id, row, 'Closed');
      const lead = await matching(ctx, at, async () => {
        const l = await ctx.leads.leadFields(row['Email']);
        return l.title === row['Job Title'] ? l : undefined;
      });
      product(lead, `the Lead shows the prospect's Title "${row['Job Title']}"`).toBeDefined();
      product(lead!.phone, 'Lead Phone').toBe(row['Phone Number']);
      product(await ctx.leads.countByEmail(row['Email']), 'still one Lead for the email').toBe(1);
    });

    test(`${UL} > 2: same setup, outcome not matching`, async ({ ctx }) => {
      test.setTimeout(ROW_TIMEOUT);
      const id = `${UL} > 2`;
      const row = rowOf(id);
      await useActivities(ctx, UL);
      const at = await changeOutcome(ctx, id, row, 'Not Now');
      await nonMatching(ctx, at);
      const lead = await ctx.leads.leadFields(row['Email']);
      product(lead.title, 'Lead Title is unchanged').toBe(LEGACY.title);
      product(lead.phone, 'Lead Phone is unchanged').toBe(LEGACY.phone);
    });
  });

  test.describe(CO, () => {
    test(`${CO} > 1: new prospect with a Deal Value, matching outcome`, async ({ ctx }) => {
      test.setTimeout(ROW_TIMEOUT);
      const id = `${CO} > 1`;
      const row = rowOf(id);
      await useActivities(ctx, CO);
      const at = await changeOutcome(ctx, id, row, 'Not Now');
      const count = await matching(ctx, at, async () => {
        const n = await ctx.opps.countByName(row['Email']);
        return n > 0 ? n : undefined;
      });
      // (proposed, unconfirmed): recorded, not asserted.
      note('Observed (awaiting QA confirmation)', count ? `Opportunities named with the email: ${count}` : 'No Opportunity named with the email (it may be named differently, see the Logs row)');
      if (count) note('Opportunity', JSON.stringify(await ctx.opps.opportunityFields(row['Email'])));
      note('Expected values', `Stage Prospecting, Close Date ${inDays(1)}, Amount ${row['Deal Value']}`);
    });

    test(`${CO} > 2: outcome not matching`, async ({ ctx }) => {
      test.setTimeout(ROW_TIMEOUT);
      const id = `${CO} > 2`;
      const row = rowOf(id);
      await useActivities(ctx, CO);
      const at = await changeOutcome(ctx, id, row, 'Do Not Contact');
      await nonMatching(ctx, at);
      product(await ctx.opps.countByName(row['Email']), 'no Opportunity named with the prospect\'s email').toBe(0);
    });
  });

  test.describe(UO, () => {
    test(`${UO} > 1: Opportunity at Prospecting with an old Amount, matching outcome`, async ({ ctx }) => {
      test.setTimeout(ROW_TIMEOUT);
      const id = `${UO} > 1`;
      const row = rowOf(id);
      await useActivities(ctx, UO);
      const at = await changeOutcome(ctx, id, row, 'Do Not Contact');
      const opp = await matching(ctx, at, async () => {
        const o = await ctx.opps.opportunityFields(row['Email']);
        return o.stage === 'Qualification' ? o : undefined;
      });
      // (proposed, unconfirmed): recorded, not asserted.
      note('Observed (awaiting QA confirmation)', opp ? `Updated: ${JSON.stringify(opp)}` : `Not updated: ${JSON.stringify(await ctx.opps.opportunityFields(row['Email']))}`);
      note('Expected values', `Stage Qualification, Close Date ${inDays(1)}, Amount ${row['Deal Value']}`);
      note('Opportunities named with the email', String(await ctx.opps.countByName(row['Email'])));
    });

    test(`${UO} > 2: same setup, outcome not matching`, async ({ ctx }) => {
      test.setTimeout(ROW_TIMEOUT);
      const id = `${UO} > 2`;
      const row = rowOf(id);
      await useActivities(ctx, UO);
      const at = await changeOutcome(ctx, id, row, 'Uncategorized');
      await nonMatching(ctx, at);
      const opp = await ctx.opps.opportunityFields(row['Email']);
      product(opp.stage, 'Opportunity Stage is unchanged').toBe('Prospecting');
      product(opp.amount, 'Opportunity Amount is unchanged').toContain(LEGACY.amount);
    });
  });

  test.describe(AN, () => {
    test(`${AN} > 1: new prospect, Create a Contact and Attach Note saved, matching outcome`, async ({ ctx }) => {
      test.setTimeout(ROW_TIMEOUT);
      const id = `${AN} > 1`;
      const row = rowOf(id);
      await useActivities(ctx, AN);
      const at = await changeOutcome(ctx, id, row, 'Not Interested');
      const count = await matching(ctx, at, async () => {
        const n = await ctx.contacts.countByEmail(row['Email']);
        return n > 0 ? n : undefined;
      });
      product(count, 'one Contact is created for the prospect').toBe(1);
      await ctx.contacts.openRecord(row['Email']);
      // (proposed, unconfirmed): the Note content is recorded, not asserted.
      note('Observed (awaiting QA confirmation)', `Related tab: ${await ctx.contacts.relatedText()}`);
    });

    test(`${AN} > 2: same pair, outcome not matching`, async ({ ctx }) => {
      test.setTimeout(ROW_TIMEOUT);
      const id = `${AN} > 2`;
      const row = rowOf(id);
      await useActivities(ctx, AN);
      const at = await changeOutcome(ctx, id, row, 'Meeting Booked');
      await nonMatching(ctx, at);
      product(await ctx.contacts.countByEmail(row['Email']), 'no Contact (and so no Note) is created').toBe(0);
    });

    test(`${AN} > 3: Attach Note saved alone, no Contact activity`, async ({ ctx }) => {
      test.setTimeout(ROW_TIMEOUT);
      const id = `${AN} > 3`;
      const row = rowOf(id);
      await useActivities(ctx, `${AN} alone`);
      const at = await changeOutcome(ctx, id, row, 'Interested');
      await nonMatching(ctx, at);
      // (proposed, unconfirmed): recorded, not asserted.
      note('Observed (awaiting QA confirmation)', `Contacts for the email after the wait: ${await ctx.contacts.countByEmail(row['Email'])}`);
    });
  });

  test.describe(RE, () => {
    test(`${RE} > 1: Contact exists, Contact checked`, async ({ ctx }) => {
      test.setTimeout(ROW_TIMEOUT);
      const id = `${RE} > 1`;
      const row = rowOf(id);
      await useActivities(ctx, RE);
      const at = await changeOutcome(ctx, id, row, 'Interested');
      const entry = await finishedEntry(ctx.sf, at);
      note('Logs status', entry?.status ?? 'none');
      note('Logs row', entry?.text ?? 'no finished Logs entry within 2 minutes');
      await ctx.contacts.openRecord(row['Email']);
      // (proposed, unconfirmed): recorded, not asserted.
      note('Observed (awaiting QA confirmation)', `Contact Activity tab: ${await ctx.contacts.activityText()}`);
    });
  });

  test('Restore: every trigger off', async ({ salesforceOutcome }) => {
    await salesforceOutcome.turnAllTriggersOff();
  });
});
