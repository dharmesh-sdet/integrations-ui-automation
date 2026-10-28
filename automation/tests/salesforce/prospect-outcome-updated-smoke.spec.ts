// Production smoke test: Prospect Outcome is updated in Saleshandy, Salesforce (AL-4134).
// Checklist: notes/production-testing/08-salesforce-prospect-outcome-updated.md (approved by QA
// 2026-10-22; Attach Note rides on Create a Contact row 1, so 10 rows). Each row follows the staging row of the same name in
// tests/salesforce/prospect-outcome-updated.spec.ts (QA signed those off as passed 2026-10-22).
// Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts) and the
//    Salesforce org is the same dev org (saleshandy-dev-ed);
//  - the sequence comes from SMOKE_SEQUENCE_ID, nothing production is hard-coded;
//  - every row is pass/fail (staging recorded the "proposed, unconfirmed" rows); values staging
//    showed only as formatted text (note text, activity description) are recorded, not asserted;
//  - "Prepare data" makes the Salesforce records, adds the prospects and sends step 1 for all 10 rows
//    side by side before the first row (as the staging spec does), so a row only sets its trigger,
//    changes the outcome and checks. The runner runs it as its own step right after the gate
//    (-g "Prepare data") and the rows without it (--grep-invert), so the report shows 10 checks.
//    If a step 1 send ends up Scheduled for tomorrow, it fails with "NOT SENT" and the runner stops.
//    10 sends in all.
// A failure whose message starts with "PRODUCT:" is a product finding for QA; any other failure
// is the script or the setup.
//
// Run through scripts/run-salesforce-outcome-updated-smoke.sh
// (npm run smoke:salesforce-outcome-updated), which runs the gate, then Prepare data, then the rows. Needs, once:
//   npm run login:saleshandy -- emailopenedprod
//   Salesforce (the dev org) logs in by itself through the API (src/utils/salesforce-login.ts)
// Data: test-data/salesforce/prospect-outcome-updated-smoke.csv (scripts/make-outcome-smoke-data.ts).
import type { Page } from '@playwright/test';
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markStage, stageDone, type SetupStage } from '../../src/data/setup-state.ts';
import { markUsed } from '../../src/data/used.ts';
import { TRIGGER, finishedEntry, pollFor, watchLogs } from '../../src/flows/salesforce-outcome.ts';
import { SaleshandySequencePage } from '../../src/pages/saleshandy/sequence.page.ts';
import type { OutcomeActivity, SalesforceOutcomePage } from '../../src/pages/saleshandy/salesforce-outcome.page.ts';
import type { SalesforceAccountsPage } from '../../src/pages/salesforce/accounts.page.ts';
import type { SalesforceContactsPage } from '../../src/pages/salesforce/contacts.page.ts';
import type { SalesforceLeadsPage } from '../../src/pages/salesforce/leads.page.ts';
import type { SalesforceOpportunitiesPage } from '../../src/pages/salesforce/opportunities.page.ts';

type Ctx = {
  seq: SaleshandySequencePage;
  sf: SalesforceOutcomePage;
  accounts: SalesforceAccountsPage;
  contacts: SalesforceContactsPage;
  leads: SalesforceLeadsPage;
  opps: SalesforceOpportunitiesPage;
};

async function keptPage(platform: 'saleshandy' | 'salesforce', sessions: { get: (...a: any[]) => Promise<any> }, account: any, browserName: any): Promise<Page> {
  const kept = keptPages.get(platform);
  if (kept && !kept.isClosed()) return kept;
  const page: Page = await (await sessions.get(platform, account, browserName)).newPage();
  // Start loading the app right away, so the window is not blank until its first use.
  void page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  keptPages.set(platform, page);
  return page;
}

// One Saleshandy page and one Salesforce page for the whole run, so the app is not reloaded for every row.
const keptPages = new Map<string, Page>();

const test = base.extend<{ ctx: Ctx }>({
  saleshandyPage: async ({ sessionContexts, account }, use, testInfo) => {
    await use(await keptPage('saleshandy', sessionContexts, account, testInfo.project.metadata.browser));
  },
  salesforcePage: async ({ sessionContexts, account }, use, testInfo) => {
    await use(await keptPage('salesforce', sessionContexts, account, testInfo.project.metadata.browser));
  },
  ctx: async ({ saleshandySequence, salesforceOutcome, salesforceAccounts, salesforceContacts, salesforceLeads, salesforceOpportunities }, use) =>
    use({ seq: saleshandySequence, sf: salesforceOutcome, accounts: salesforceAccounts, contacts: salesforceContacts, leads: salesforceLeads, opps: salesforceOpportunities }),
});

test.use({ account: 'emailopenedprod', actionTimeout: 30_000 });

const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '';
const CSV = 'salesforce/prospect-outcome-updated-smoke.csv';

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

// Extra Configuration per activity (checklist, under each heading).
const CONFIG: Record<string, OutcomeActivity[]> = {
  [CA]: [{ name: CA, outcome: 'Uncategorized' }],
  [UA]: [{ name: UA, outcome: 'Interested' }],
  [CC]: [{ name: CC, outcome: 'Not Interested' }, { name: AN }],
  [UC]: [{ name: UC, outcome: 'Meeting Booked' }],
  [CL]: [{ name: CL, outcome: 'Out of Office' }],
  [UL]: [{ name: UL, outcome: 'Closed' }],
  [CO]: [{ name: CO, outcome: 'Not Now', stage: 'Prospecting', days: 1 }],
  [UO]: [{ name: UO, outcome: 'Do Not Contact', stage: 'Qualification', days: 1 }],
  [RE]: [{ name: RE, objects: ['Contact'] }],
};

// Legacy values of the Salesforce records made by hand before an Update row.
const LEGACY = { company: 'Legacy Co', title: 'Legacy Title QA', phone: '+1 555-0100-0000', city: 'Legacyville', amount: '100' };

type Needs = { account?: boolean; contact?: boolean; lead?: boolean; opp?: boolean };
const NEEDS: Record<string, Needs> = {
  [`${UA} > 1`]: { account: true },
  [`${UC} > 1`]: { contact: true },
  [`${UL} > 1`]: { lead: true },
  [`${UO} > 1`]: { opp: true },
  [`${RE} > 1`]: { contact: true },
};

const rowOf = (id: string): Row => {
  const row = readCsv(CSV).find((r) => r['Scenario'] === id);
  if (!row) throw new Error(`No row "${id}" in test-data/${CSV}. Run scripts/make-outcome-smoke-data.ts.`);
  return row;
};
const fullName = (row: Row) => `${row['First Name']} ${row['Last Name']}`;
const note = (type: string, description: string) => test.info().annotations.push({ type, description });
const product = <T>(value: T, what: string) => expect(value, `PRODUCT: ${what}`);
const clip = (text: string, max = 700): string => (text.length > max ? `${text.slice(0, max)}...` : text);

// DD/MM/YYYY, the way this org shows dates.
const inDays = (days: number): string => {
  const d = new Date(Date.now() + days * 86_400_000);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// What is already done per row, kept in a file (src/data/setup-state.ts), so a rerun in a new
// process does not make a record, prospect or send twice.
const stage = (kind: SetupStage) => ({
  has: (row: Row) => stageDone(CSV, row['Email'], kind),
  add: (row: Row) => markStage(CSV, row['Email'], kind),
});
const done = { record: stage('record'), added: stage('added'), sent: stage('sent') };

// Salesforce records the row needs before the outcome changes; the prospect keeps its own values.
async function addRecords(ctx: Ctx, id: string, row: Row): Promise<void> {
  const needs = NEEDS[id];
  if (!needs || done.record.has(row)) return;
  console.log(`[prepare] Salesforce records for ${row['Email']}`);
  await test.step(`Create the Salesforce records for ${row['Email']}`, async () => {
    if (needs.account) await ctx.accounts.createAccount({ name: row['Company'], billingCity: LEGACY.city });
    if (needs.contact) await ctx.contacts.createContact({ firstName: row['First Name'], lastName: row['Last Name'], email: row['Email'] });
    if (needs.lead) await ctx.leads.createLead({ firstName: row['First Name'], lastName: row['Last Name'], email: row['Email'], company: LEGACY.company, title: LEGACY.title, phone: LEGACY.phone });
    if (needs.opp) await ctx.opps.createOpportunity({ name: row['Email'], stage: 'Prospecting', closeDate: inDays(30), amount: LEGACY.amount });
  });
  done.record.add(row);
}

// The row is retired first: a failed add can still leave the prospect in Saleshandy.
async function addProspect(seq: SaleshandySequencePage, row: Row): Promise<void> {
  if (done.added.has(row)) return;
  markUsed(CSV, row['Email']);
  console.log(`[prepare] adding ${fullName(row)} to the sequence`);
  await test.step(`Add ${fullName(row)} to the sequence`, () => seq.createAndAddProspect(SEQUENCE_ID, row));
  done.added.add(row);
}

async function sendOut(seq: SaleshandySequencePage, row: Row): Promise<void> {
  if (done.sent.has(row)) return;
  console.log(`[prepare] sending step 1 to ${fullName(row)}`);
  try {
    await test.step(`Send step 1 to ${fullName(row)}`, () => seq.sendNow(SEQUENCE_ID, fullName(row)));
  } catch (error) {
    // Saleshandy pushed the email to a later day instead of sending it (seen 2026-10-22: Scheduled, Tomorrow 09:04 AM).
    if (/Scheduled/.test(String(error))) {
      throw new Error(`NOT SENT: Saleshandy scheduled step 1 for ${fullName(row)} for later instead of sending it (probably the mailbox daily limit or the sequence sending hours). No checks were run. ${String(error).split('\n')[0]}`);
    }
    throw error;
  }
  done.sent.add(row);
}

async function prepare(ctx: Ctx, id: string, row: Row): Promise<void> {
  if (!SEQUENCE_ID) throw new Error('SMOKE_SEQUENCE_ID is not set. Use scripts/run-salesforce-outcome-updated-smoke.sh.');
  await addRecords(ctx, id, row);
  await addProspect(ctx.seq, row);
  await sendOut(ctx.seq, row);
}

// Another smoke run on the same account (Email Sent) saves the same Triggers page, and a Save
// from a page loaded before the other run's Save can undo it. So after saving, the page is
// opened again and the trigger must be on with exactly the row's activities; otherwise it is set
// again (3 tries).
async function setTrigger(ctx: Ctx, activity: string): Promise<void> {
  const names = CONFIG[activity].map((a) => a.name).sort();
  for (let attempt = 1; ; attempt++) {
    await ctx.sf.configureOutcomeTrigger(CONFIG[activity]);
    // SKIP_TRIGGER_RECHECK=1: no other run on the account, so nothing can overwrite the Save.
    if (process.env.SKIP_TRIGGER_RECHECK === '1') return;
    await ctx.sf.openTriggers();
    const on = await ctx.sf.isTriggerOn(TRIGGER);
    const chips = (await ctx.sf.selectedActivities(TRIGGER)).sort();
    if (on && chips.length === names.length && names.every((n, i) => chips[i].startsWith(n.replace(/ in Salesforce$/, '')))) return;
    if (attempt === 3) throw new Error(`The trigger "${TRIGGER}" did not keep its setting after 3 saves (on: ${on}, activities: ${chips.join(', ') || 'none'}). Another run on the same account probably overwrote it.`);
  }
}

// Sets the trigger, makes sure the records, the prospect and the step 1 send are done, then
// changes the outcome. Returns the time of the change.
async function changeOutcome(ctx: Ctx, id: string, row: Row, activity: string, outcome: string): Promise<number> {
  await test.step(`Set the trigger "${TRIGGER}" to: ${CONFIG[activity].map((a) => a.name).join(' + ')}`, () => setTrigger(ctx, activity));
  await test.step('Make sure the Salesforce records, the prospect and the step 1 send are ready', () => prepare(ctx, id, row));
  const at = Date.now();
  await test.step(`Change the prospect outcome to ${outcome}`, () => ctx.seq.setProspectOutcome(SEQUENCE_ID, row['Email'], outcome));
  return at;
}

// Matching row: polls Salesforce for up to 3 minutes. If nothing shows, records the Logs entry.
async function matching<T>(ctx: Ctx, at: number, look: () => Promise<T | undefined>): Promise<T | undefined> {
  const found = await test.step('Poll Salesforce for up to 3 minutes (15 s after the change, then every 10 s)', () => pollFor(ctx.accounts.page, look));
  if (found !== undefined) return found;
  const entry = await test.step('Not in Salesforce: read the Logs status', () => finishedEntry(ctx.sf, at));
  note('Logs row', entry?.text ?? 'no finished Logs entry within 2 minutes');
  note('Logs status', entry?.status ?? 'none');
  if (entry?.status === 'Error') note('Needs QA', 'Logs shows Error and the record is not in Salesforce. Reported to QA, not judged.');
  return undefined;
}

// Non-matching row: waits the 3 minutes with the Logs refreshes; the caller then checks Salesforce.
async function nonMatching(ctx: Ctx, at: number): Promise<void> {
  const entries = await test.step('Wait 3 minutes, refreshing Logs (15 s, then every 10 s)', () => watchLogs(ctx.sf, at));
  note('Logs rows during the wait', entries.length ? entries.map((e) => e.text).join(' | ') : 'none');
  note('Logs status', entries.map((e) => e.status).join(', ') || 'none');
}

const ROW_TIMEOUT = 15 * 60_000;

// The rows in checklist order; Prepare data prepares every one of them.
const IDS = [`${CA} > 1`, `${UA} > 1`, `${CC} > 1`, `${CC} > 2`, `${UC} > 1`, `${CL} > 1`, `${UL} > 1`, `${CO} > 1`, `${UO} > 1`, `${RE} > 1`];

test.describe('Prospect Outcome is updated in Saleshandy, Salesforce (production smoke)', () => {
  // Not serial. Each row still prepares itself (changeOutcome > prepare), and the setup-state file keeps a
  // record, prospect or send from being done twice, so a row run alone also works.

  test('Prepare data: Salesforce records, prospects and step 1 sends for all 10 rows', async ({ saleshandyPage, ctx }) => {
    test.setTimeout(30 * 60_000);
    if (!SEQUENCE_ID) throw new Error('SMOKE_SEQUENCE_ID is not set. Use scripts/run-salesforce-outcome-updated-smoke.sh.');
    const senderPage = await saleshandyPage.context().newPage();
    void senderPage.goto(`/sequence/${SEQUENCE_ID}/emails`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    const sender = new SaleshandySequencePage(senderPage);
    const rows = IDS.map((id) => ({ id, row: rowOf(id) }));
    // A send waits for its row's prospect AND its Salesforce record, and stops when any part has
    // failed, so a failed record never wastes the day's sends.
    const gate = () => {
      let resolve!: () => void;
      const promise = new Promise<void>((r) => (resolve = r));
      return { promise, resolve };
    };
    const added = rows.map(gate);
    const recorded = rows.map(gate);
    let failure: unknown;
    const stop = (error: unknown) => {
      failure ??= error;
      for (const g of [...added, ...recorded]) g.resolve();
    };
    await test.step('Create records, add prospects and send step 1, side by side', async () => {
      const records = async () => {
        try {
          for (const [i, { id, row }] of rows.entries()) {
            await addRecords(ctx, id, row);
            recorded[i].resolve();
          }
        } catch (error) {
          stop(error);
        }
      };
      const prospects = async () => {
        try {
          for (const [i, { row }] of rows.entries()) {
            if (failure) return;
            await addProspect(ctx.seq, row);
            added[i].resolve();
          }
        } catch (error) {
          stop(error);
        }
      };
      const sends = async () => {
        try {
          for (const [i, { row }] of rows.entries()) {
            await Promise.all([added[i].promise, recorded[i].promise]);
            if (failure) return;
            await sendOut(sender, row);
          }
        } catch (error) {
          stop(error);
        }
      };
      await Promise.all([records(), prospects(), sends()]);
      if (failure) throw failure;
    });
  });

  test(`${CA} > 1: new prospect with a Company, no Account`, async ({ ctx }) => {
    test.setTimeout(ROW_TIMEOUT);
    const id = `${CA} > 1`;
    const row = rowOf(id);
    const before = await ctx.accounts.countByName(row['Company']);
    const at = await changeOutcome(ctx, id, row, CA, 'Uncategorized');
    const count = await matching(ctx, at, async () => {
      const n = await ctx.accounts.countByName(row['Company']);
      return n > before ? n : undefined;
    });
    product(count, `an Account named "${row['Company']}" is created (had ${before} before)`).toBe(before + 1);
    const addresses = await ctx.accounts.billingAddresses(row['Company']);
    product(addresses.join(' | '), `Billing City of the new Account is the prospect City "${row['City']}"`).toContain(row['City']);
  });

  test(`${UA} > 1: Account named after the Company exists with an old Billing City`, async ({ ctx }) => {
    test.setTimeout(ROW_TIMEOUT);
    const id = `${UA} > 1`;
    const row = rowOf(id);
    const at = await changeOutcome(ctx, id, row, UA, 'Interested');
    const addresses = await matching(ctx, at, async () => {
      const a = await ctx.accounts.billingAddresses(row['Company']);
      return a.some((x) => x.includes(row['City'])) ? a : undefined;
    });
    product(addresses, `the Account shows the prospect City "${row['City']}" as Billing City`).toBeDefined();
    product((await ctx.accounts.billingAddresses(row['Company'])).length, `Accounts named "${row['Company']}" (no new Account)`).toBe(1);
  });

  test(`${CC} > 1: new prospect with all mapped fields, no Contact (Attach Note saved with it)`, async ({ ctx }) => {
    test.setTimeout(ROW_TIMEOUT);
    const id = `${CC} > 1`;
    const row = rowOf(id);
    const at = await changeOutcome(ctx, id, row, CC, 'Not Interested');
    const count = await matching(ctx, at, async () => {
      const n = await ctx.contacts.countByEmail(row['Email']);
      return n > 0 ? n : undefined;
    });
    product(count, 'one Contact is created for the prospect').toBe(1);
    const f = await ctx.contacts.contactFields(row['Email']);
    product(f.name, 'Contact Name').toBe(fullName(row));
    product(f.phone, 'Contact Business Phone').toBe(row['Phone Number']);
    product(f.department, 'Contact Department').toBe(row['Department']);
    product(f.otherAddress, 'Contact Other Address').toContain(row['City']);
    product(await ctx.leads.countByEmail(row['Email']), 'no Lead is created').toBe(0);
    // Attach Note is saved with Create a Contact (QA, 2026-10-22), so the same send also covers the Note.
    await ctx.contacts.openRecord(row['Email']);
    const related = await ctx.contacts.relatedText();
    note('Contact Related tab', clip(related, 1200));
    const notes = related.match(/Notes(?: & Attachments)? \((\d+)\)/);
    product(notes ? Number(notes[1]) : 0, 'Notes on the Contact (Attach Note)').toBe(1);
  });

  test(`${CC} > 2: same setup, outcome not matching`, async ({ ctx }) => {
    test.setTimeout(ROW_TIMEOUT);
    const id = `${CC} > 2`;
    const row = rowOf(id);
    const at = await changeOutcome(ctx, id, row, CC, 'Meeting Booked');
    await nonMatching(ctx, at);
    product(await ctx.contacts.countByEmail(row['Email']), 'no Contact is created').toBe(0);
    product(await ctx.leads.countByEmail(row['Email']), 'no Lead is created').toBe(0);
  });

  test(`${UC} > 1: Contact exists with no Department and no Business Phone`, async ({ ctx }) => {
    test.setTimeout(ROW_TIMEOUT);
    const id = `${UC} > 1`;
    const row = rowOf(id);
    const at = await changeOutcome(ctx, id, row, UC, 'Meeting Booked');
    const f = await matching(ctx, at, async () => {
      const c = await ctx.contacts.contactFields(row['Email']);
      return c.department !== '' && c.phone !== '' ? c : undefined;
    });
    product(f, 'the Contact shows the prospect Department and Business Phone').toBeDefined();
    product(f!.department, 'Contact Department').toBe(row['Department']);
    product(f!.phone, 'Contact Business Phone').toBe(row['Phone Number']);
    product(f!.otherAddress, 'Contact Other Address').toContain(row['City']);
    product(await ctx.contacts.countByEmail(row['Email']), 'still one Contact').toBe(1);
  });

  test(`${CL} > 1: new prospect with all mapped fields, no Lead`, async ({ ctx }) => {
    test.setTimeout(ROW_TIMEOUT);
    const id = `${CL} > 1`;
    const row = rowOf(id);
    const at = await changeOutcome(ctx, id, row, CL, 'Out of Office');
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

  test(`${UL} > 1: Lead exists with an old Title, Phone and Company`, async ({ ctx }) => {
    test.setTimeout(ROW_TIMEOUT);
    const id = `${UL} > 1`;
    const row = rowOf(id);
    const at = await changeOutcome(ctx, id, row, UL, 'Closed');
    const lead = await matching(ctx, at, async () => {
      const l = await ctx.leads.leadFields(row['Email']);
      return l.title === row['Job Title'] ? l : undefined;
    });
    product(lead, `the Lead shows the prospect Title "${row['Job Title']}"`).toBeDefined();
    product(lead!.phone, 'Lead Phone').toBe(row['Phone Number']);
    product(await ctx.leads.countByEmail(row['Email']), 'still one Lead for the email').toBe(1);
  });

  test(`${CO} > 1: new prospect with a Deal Value, no Opportunity`, async ({ ctx }) => {
    test.setTimeout(ROW_TIMEOUT);
    const id = `${CO} > 1`;
    const row = rowOf(id);
    const at = await changeOutcome(ctx, id, row, CO, 'Not Now');
    const count = await matching(ctx, at, async () => {
      const n = await ctx.opps.countByName(row['Email']);
      return n > 0 ? n : undefined;
    });
    product(count, 'one Opportunity named with the prospect email is created').toBe(1);
    const o = await ctx.opps.opportunityFields(row['Email']);
    product(o.stage, 'Opportunity Stage').toBe('Prospecting');
    product(o.closeDate, 'Opportunity Close Date (today + 1)').toBe(inDays(1));
    product(o.amount, 'Opportunity Amount').toMatch(new RegExp(row['Deal Value'].replace(/(\d)(?=(\d{3})+$)/g, '$1,?')));
  });

  test(`${UO} > 1: Opportunity at Prospecting with an old Amount`, async ({ ctx }) => {
    test.setTimeout(ROW_TIMEOUT);
    const id = `${UO} > 1`;
    const row = rowOf(id);
    const at = await changeOutcome(ctx, id, row, UO, 'Do Not Contact');
    const opp = await matching(ctx, at, async () => {
      const o = await ctx.opps.opportunityFields(row['Email']);
      return o.stage === 'Qualification' ? o : undefined;
    });
    product(opp, 'the Opportunity shows Stage Qualification').toBeDefined();
    product(opp!.closeDate, 'Opportunity Close Date (today + 1)').toBe(inDays(1));
    product(opp!.amount, 'Opportunity Amount = Deal Value').toMatch(new RegExp(row['Deal Value'].replace(/(\d)(?=(\d{3})+$)/g, '$1,?')));
    product(await ctx.opps.countByName(row['Email']), 'still one Opportunity').toBe(1);
  });

  test(`${RE} > 1: Contact exists, Contact checked`, async ({ ctx }) => {
    test.setTimeout(ROW_TIMEOUT);
    const id = `${RE} > 1`;
    const row = rowOf(id);
    const at = await changeOutcome(ctx, id, row, RE, 'Interested');
    const entry = await finishedEntry(ctx.sf, at);
    note('Logs status', entry?.status ?? 'none');
    note('Logs row', entry?.text ?? 'no finished Logs entry within 2 minutes');
    product(entry?.status, 'Logs status of the outcome change').toBe('Success');
    await ctx.contacts.openRecord(row['Email']);
    const activity = await ctx.contacts.activityText();
    note('Contact Activity tab', clip(activity, 1200));
    product(activity, 'the Contact Activity tab shows the logged email').toMatch(/email/i);
  });
});
