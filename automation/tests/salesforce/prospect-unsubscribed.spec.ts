// Scenarios: test-cases/salesforce/prospect-unsubscribed.md (Regression, 32 rows after QA cut 6 on 2026-11-05;
//   30 automated here, trigger rows 5 and 9 are manual; AL-4137). One test per row.
// Data: test-data/salesforce/prospect-unsubscribed.csv (npm run data:sf-prospect-unsubscribed), one prospect per
//   row, found by the Scenario column. Saleshandy accepts an email once per account, so a record a row needs first
//   is made by hand in Salesforce with the prospect's email and different values (PRE below), never by adding a
//   second prospect with the same email.
// Page objects: src/pages/saleshandy/salesforce-email-sent.page.ts (Triggers & Activity incl. the Extra
//   Configuration dialogs), src/pages/salesforce/*.page.ts, the sequence page and src/pages/mailinator.page.ts.
// Flow: src/flows/salesforce-prospect-unsubscribed.ts (add, Send now, open "Unsubscribe here" in Mailinator, read the
//   Prospects tab).
//
// The Logs tab is never opened (QA, 2026-11-05). Every check reads the Prospects tab or Salesforce:
// - A record the workflow must make or change is looked for 15 s after the unsubscribe, then every 10 s, up to
//   UNSUB_RECORD_TIMEOUT_MS (3 min). A record still missing fails the row with "Report to QA". Without Logs the
//   script cannot tell a slow run from a failed one, so QA decides.
// - A record the workflow must not make is looked for UNSUB_QUIET_CHECKS times (15 s, then every 10 s).
// - Rows marked "(proposed, unconfirmed)" in the cases file record what happened as test annotations for QA to
//   confirm, then become assertions. They never fail on the proposed value.
//
// Sequence: "Salesforce Link Clicked Regression" (197704) on sflinkclicked, 2 steps, active. Its Unsubscribe setting
// is "Unsubscribe as Link" (set 2026-11-05). SF_UNSUB_SEQUENCE_ID overrides the id.
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import {
  addAndSend,
  appearsWithin,
  nothingHappens,
  openLink,
  recordAppears,
  sendAndMarkUnsubscribed,
  sendAndUnsubscribeByLink,
  unsubscribeByLink,
  RECORD_TIMEOUT_MS,
  SUBSCRIBED_TEXT,
  TRIGGER,
} from '../../src/flows/salesforce-prospect-unsubscribed.ts';
import { fullName } from '../../src/flows/saleshandy-to-salesforce.ts';
import { readRecordTab } from '../../src/pages/salesforce/object.page.ts';
import type { Page } from '@playwright/test';
import type { SalesforceEmailSentPage } from '../../src/pages/saleshandy/salesforce-email-sent.page.ts';
import type { SaleshandySequencePage } from '../../src/pages/saleshandy/sequence.page.ts';
import type { MailinatorPage } from '../../src/pages/mailinator.page.ts';
import type { SalesforceAccountsPage } from '../../src/pages/salesforce/accounts.page.ts';
import type { SalesforceContactsPage } from '../../src/pages/salesforce/contacts.page.ts';
import type { SalesforceLeadsPage } from '../../src/pages/salesforce/leads.page.ts';
import type { SalesforceOpportunitiesPage } from '../../src/pages/salesforce/opportunities.page.ts';

type Fx = {
  salesforceEmailSent: SalesforceEmailSentPage;
  saleshandySequence: SaleshandySequencePage;
  mailinator: MailinatorPage;
  salesforceLeads: SalesforceLeadsPage;
  salesforceContacts: SalesforceContactsPage;
  salesforceAccounts: SalesforceAccountsPage;
  salesforceOpportunities: SalesforceOpportunitiesPage;
};

const test = base.extend<{ fx: Fx }>({
  fx: async ({ salesforceEmailSent, saleshandySequence, mailinator, salesforceLeads, salesforceContacts, salesforceAccounts, salesforceOpportunities }, use) =>
    use({ salesforceEmailSent, saleshandySequence, mailinator, salesforceLeads, salesforceContacts, salesforceAccounts, salesforceOpportunities }),
});

test.use({ account: 'sflinkclicked' });

const SEQUENCE_ID = process.env.SF_UNSUB_SEQUENCE_ID ?? '197704';
const CSV = 'salesforce/prospect-unsubscribed.csv';

const A = {
  createLead: 'Create a Lead in Salesforce',
  updateLead: 'Update a Lead in Salesforce',
  createContact: 'Create a Contact in Salesforce',
  updateContact: 'Update a Contact in Salesforce',
  createAccount: 'Create a Account in Salesforce',
  updateAccount: 'Update a Account in Salesforce',
  createOpp: 'Create a Opportunity in Salesforce',
  updateOpp: 'Update a Opportunity in Salesforce',
  note: 'Attach Note in Salesforce',
  record: 'Record(log) an Email Activity in Salesforce',
} as const;

// Extra Configuration of the cases file.
const CREATE_OPP = { stage: 'Prospecting', days: 7 };
const UPDATE_OPP = { stage: 'Qualification', days: 14 };

// What a record already holds before the unsubscribe, so a change by the workflow is visible.
const PRE = { company: 'Brightpath Logistics', title: 'Operations Manager', phone: '+1 555-0100-4821', department: 'Operations', city: 'Austin' };

// One row = Send now (40 to 50 s sender gap) + the 93 s link wait + the status wait + the record wait.
const minutes = (units: number): number => units * 6 * 60_000;

type Prospect = { row: Row; used: string };

function prospect(scenario: string): Prospect {
  const row = readCsv(CSV).find((r) => r['Scenario'] === scenario);
  if (!row) throw new Error(`No row "${scenario}" in test-data/${CSV}`);
  return { row, used: row['Email'] };
}

const pagesOf = (fx: Fx) => ({ saleshandySequence: fx.saleshandySequence, mailinator: fx.mailinator });
const opts = (p: Prospect, step = 1) => ({ sequenceId: SEQUENCE_ID, row: p.row, csv: CSV, step });

// Add, send and unsubscribe by the real link. Returns the unsubscribe page (kept open).
const unsubscribe = (fx: Fx, p: Prospect, step = 1): Promise<Page> => sendAndUnsubscribeByLink(pagesOf(fx), opts(p, step));

const record = (type: string, description: string): void => {
  test.info().annotations.push({ type, description });
};

const clip = (text: string, max = 700): string => (text.length > max ? `${text.slice(0, max)}...` : text);

// DD/MM/YYYY, the way this org shows and reads dates.
function dayMonthYear(daysFromToday: number): string {
  const d = new Date(Date.now() + daysFromToday * 86_400_000);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// Records a row needs before the unsubscribe, made from the prospect's own row. markUsed retires the CSV row at
// once: the record now exists, so a failed run must not reuse the person.
async function leadFirst(fx: Fx, p: Prospect): Promise<void> {
  await test.step(`Create the Lead in Salesforce for ${p.row['Email']}`, async () => {
    markUsed(CSV, p.used);
    await fx.salesforceLeads.createLead({
      firstName: p.row['First Name'],
      lastName: p.row['Last Name'],
      email: p.row['Email'],
      company: PRE.company,
      title: PRE.title,
      phone: PRE.phone,
    });
  });
}

async function contactFirst(fx: Fx, p: Prospect): Promise<void> {
  await test.step(`Create the Contact in Salesforce for ${p.row['Email']}`, async () => {
    markUsed(CSV, p.used);
    await fx.salesforceContacts.createContact({
      firstName: p.row['First Name'],
      lastName: p.row['Last Name'],
      email: p.row['Email'],
      phone: PRE.phone,
      department: PRE.department,
    });
  });
}

// Update a Account looks the Account up by the prospect's full name (QA, 2026-10-22).
async function accountFirst(fx: Fx, p: Prospect): Promise<void> {
  await test.step(`Create the Account "${fullName(p.row)}" in Salesforce`, async () => {
    markUsed(CSV, p.used);
    await fx.salesforceAccounts.createAccount({ name: fullName(p.row), billingCity: PRE.city, phone: PRE.phone });
  });
}

async function tab(page: Page, name: string): Promise<string> {
  return readRecordTab(page, name).catch(() => `(no "${name}" tab on this record)`);
}

async function describeLead(fx: Fx, p: Prospect, label: string): Promise<number> {
  const email = p.row['Email'];
  const count = await fx.salesforceLeads.countByEmail(email);
  record(`${label}: Leads for ${email}`, String(count));
  if (count >= 1) {
    const f = await fx.salesforceLeads.leadFields(email);
    record(`${label}: Lead`, `Name "${f.name}", Company "${f.company}", Title "${f.title}", Phone "${f.phone}", Status "${f.status}"; prospect Title "${p.row['Job Title']}", Phone "${p.row['Phone Number']}", Company "${p.row['Company']}"`);
  }
  return count;
}

async function describeContact(fx: Fx, p: Prospect, label: string, tabs = false): Promise<number> {
  const email = p.row['Email'];
  const count = await fx.salesforceContacts.countByEmail(email);
  record(`${label}: Contacts for ${email}`, String(count));
  if (count >= 1) {
    const f = await fx.salesforceContacts.contactFields(email);
    record(`${label}: Contact`, `Name "${f.name}", Title "${f.title}", Department "${f.department}", Phone "${f.phone}", Other address "${f.otherAddress}"; prospect Phone "${p.row['Phone Number']}", Department "${p.row['Department']}", City "${p.row['City']}"`);
    if (tabs) {
      record(`${label}: Contact Activity tab`, clip(await tab(fx.salesforceContacts.page, 'Activity')));
      record(`${label}: Contact Related tab`, clip(await tab(fx.salesforceContacts.page, 'Related')));
    }
  }
  return count;
}

async function describeAccount(fx: Fx, p: Prospect, label: string): Promise<number> {
  const name = fullName(p.row);
  const count = await fx.salesforceAccounts.countByName(name);
  record(`${label}: Accounts named "${name}"`, String(count));
  if (count >= 1) {
    const f = await fx.salesforceAccounts.accountFields(name);
    record(`${label}: Account`, `Name "${f.name}", Billing address "${f.billingAddress}", Website "${f.website}", Phone "${f.phone}"; prospect City "${p.row['City']}", State "${p.row['State']}", Country "${p.row['Country']}", Website "${p.row['Company Website']}"`);
  }
  return count;
}

// The integration names the Opportunity with the prospect's email (seen 2026-10-21).
async function describeOpportunity(fx: Fx, p: Prospect, label: string): Promise<string[]> {
  const email = p.row['Email'];
  const rows = await fx.salesforceOpportunities.rowTexts(email);
  record(`${label}: Opportunity rows matching "${email}"`, rows.length ? rows.join(' || ') : '(none)');
  if (rows.length) {
    const f = await fx.salesforceOpportunities.opportunityFields(email);
    record(`${label}: Opportunity`, `Name "${f.name}", Stage "${f.stage}", Close Date "${f.closeDate}", Amount "${f.amount}", Description "${f.description}"`);
  }
  return rows;
}

// Number in "Notes (n)" or "Notes & Attachments (n)" on the open record, 0 when no such list shows.
async function noteCount(page: Page): Promise<number> {
  const all = `${await tab(page, 'Activity')} ${await tab(page, 'Related')}`;
  return Number(all.match(/Notes(?: & Attachments)? \((\d+)\)/)?.[1] ?? 0);
}

// Where the Note shows: the record's Activity and Related tabs. The Note text is recorded for QA.
async function describeNote(page: Page, label: string): Promise<void> {
  const activity = await tab(page, 'Activity');
  const related = await tab(page, 'Related');
  const all = `${activity} ${related}`;
  record(`${label}: Notes list`, all.match(/Notes(?: & Attachments)? \(\d+\)/)?.[0] ?? '(no Notes list found)');
  for (const text of ['Unsubscribed', 'Manually Unsubscribed', 'Sequence', 'Step 1', 'Sender']) record(`${label}: Note shows "${text}"`, String(all.includes(text)));
  record(`${label}: Activity tab`, clip(activity, 1200));
  record(`${label}: Related tab`, clip(related, 1200));
}

// "Nothing is created": looks QUIET_CHECKS times and fails when the count is not 0.
const noRecord = (fx: Fx, count: () => Promise<number>, what: string) =>
  nothingHappens(fx.saleshandySequence.page, async () => {
    expect(await count(), what).toBe(0);
  });

test.describe('Prospect is Unsubscribed in Saleshandy', () => {
  // ================= Trigger behavior =================

  test('Trigger behavior > 1: trigger off, enable it with Create a Lead and Save', async ({ fx }) => {
    await test.step('Turn every trigger off and save', async () => {
      await fx.salesforceEmailSent.turnAllTriggersOff();
    });
    await test.step(`Enable "${TRIGGER}", select Create a Lead in Salesforce and Save`, async () => {
      await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    });
    await test.step('Reload: the trigger and the activity are still selected', async () => {
      await fx.salesforceEmailSent.page.reload();
      await fx.salesforceEmailSent.openTriggers();
      expect(await fx.salesforceEmailSent.selectedActivities(TRIGGER), 'selected activities after reload').toContain(A.createLead);
    });
  });

  test('Trigger behavior > 2: new prospect got step 1, open the real unsubscribe link', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    const p = prospect('Trigger behavior > 2');
    const start = Date.now();
    await unsubscribe(fx, p);
    await recordAppears('the Lead', async () => {
      expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(1);
    });
    // Sizes the "nothing happens" windows: seconds from the unsubscribe page to the Lead.
    record('Seconds from the send to the Lead', String(Math.round((Date.now() - start) / 1000)));
  });

  test('Trigger behavior > 3: Mark as Unsubscribe in the Prospects tab', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    const p = prospect('Trigger behavior > 3');
    await sendAndMarkUnsubscribed(pagesOf(fx), opts(p));
    // HubSpot production fired only on the link. Record whether a Lead appears; the row never fails on it.
    const appeared = await appearsWithin(RECORD_TIMEOUT_MS, async () => {
      expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(1);
    });
    record('Mark as Unsubscribe fired the workflow (a Lead appeared)', String(appeared));
  });

  test('Trigger behavior > 4: link already opened once, open the same link again', async ({ fx }) => {
    test.setTimeout(minutes(2));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    const p = prospect('Trigger behavior > 4');
    await unsubscribe(fx, p);
    await recordAppears('the Lead', async () => {
      expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(1);
    });
    await test.step('Open the same link again', async () => {
      await openLink(fx.mailinator, p.row, 1, 0);
    });
    let last = 0;
    await nothingHappens(fx.saleshandySequence.page, async () => {
      last = await fx.salesforceLeads.countByEmail(p.row['Email']);
    });
    record('Leads after the second open', String(last));
  });

  test('Trigger behavior > 5: prospect in no sequence, Mark as Unsubscribe on the Prospects page', async () => {
    test.fixme(true, 'Not automated: needs a prospect that is in no sequence and the global Prospects page, which no page object covers yet. Manual for QA.');
  });

  test('Trigger behavior > 6: all triggers off, open the real link', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.turnAllTriggersOff();
    const p = prospect('Trigger behavior > 6');
    await unsubscribe(fx, p);
    await test.step('No Lead is created', async () => {
      await noRecord(fx, () => fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`);
    });
  });

  test('Trigger behavior > 7: Subscribe here after the unsubscribe, Lead exists', async ({ fx }) => {
    test.setTimeout(minutes(2));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    const p = prospect('Trigger behavior > 7');
    const page = await unsubscribe(fx, p);
    await recordAppears('the Lead', async () => {
      expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(1);
    });
    await test.step('Click "Subscribe here" on the link page', async () => {
      await page.getByText('Subscribe here').first().click();
      await expect(page.getByText(SUBSCRIBED_TEXT), 'The subscribe page').toBeVisible({ timeout: 30_000 });
    });
    record('Prospect row after Subscribe here', await fx.saleshandySequence.prospectRowText(SEQUENCE_ID, p.row['Email']));
    let last = 0;
    await nothingHappens(fx.saleshandySequence.page, async () => {
      last = await fx.salesforceLeads.countByEmail(p.row['Email']);
    });
    record('Leads after Subscribe here', String(last));
  });

  test('Trigger behavior > 8: prospect moved to step 2 and step 2 sent, open the link in the step 2 email', async ({ fx }) => {
    test.setTimeout(minutes(3));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    const p = prospect('Trigger behavior > 8');
    await addAndSend(pagesOf(fx), opts(p, 2));
    await unsubscribeByLink(pagesOf(fx), opts(p, 2));
    const appeared = await appearsWithin(RECORD_TIMEOUT_MS, async () => {
      expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(1);
    });
    record('A Lead appeared after the step 2 unsubscribe', String(appeared));
  });

  test('Trigger behavior > 9: prospect in two sequences, link of the first sequence', async () => {
    test.fixme(true, 'Not automated: needs a second active sequence with "Unsubscribe as Link" and a way to add an existing prospect to it. Manual for QA.');
  });

  test('Trigger behavior > 10: prospect already replied, open the real link', async ({ fx }) => {
    test.setTimeout(minutes(2));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    const p = prospect('Trigger behavior > 10');
    await addAndSend(pagesOf(fx), opts(p));
    await test.step('Mark the prospect as replied', async () => {
      await fx.saleshandySequence.markAsReplied(SEQUENCE_ID, fullName(p.row), 1, p.row['Email']);
    });
    await test.step('Open the real link', async () => {
      await openLink(fx.mailinator, p.row);
    });
    const status = await appearsWithin(3 * 60_000, async () => {
      await fx.saleshandySequence.expectProspectStatusAfterRefresh(SEQUENCE_ID, p.row['Email'], 'Unsubscribed');
    });
    record('Prospect shows Unsubscribed after a reply', String(status));
    record('Prospect row', await fx.saleshandySequence.prospectRowText(SEQUENCE_ID, p.row['Email']));
    const appeared = await appearsWithin(RECORD_TIMEOUT_MS, async () => {
      expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(1);
    });
    record('A Lead appeared', String(appeared));
  });

  // ================= Create a Lead in Salesforce =================

  test('Create a Lead in Salesforce > 1: new prospect with an apostrophe in the last name', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    const p = prospect('Create a Lead in Salesforce > 1');
    await unsubscribe(fx, p);
    await recordAppears('the Lead', async () => {
      expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(1);
    });
    await test.step('One Lead with the prospect values and Lead Status "Open - Not Contacted"', async () => {
      const f = await fx.salesforceLeads.leadFields(p.row['Email']);
      expect(f.name, 'Lead Name').toBe(fullName(p.row));
      expect(f.email, 'Lead Email').toBe(p.row['Email']);
      expect(f.company, 'Lead Company').toBe(p.row['Company']);
      expect(f.status, 'Lead Status').toBe('Open - Not Contacted');
      record('Lead', `Title "${f.title}" (prospect "${p.row['Job Title']}"), Phone "${f.phone}" (prospect "${p.row['Phone Number']}"), Address "${f.address}"`);
    });
  });

  test('Create a Lead in Salesforce > 2: a Lead with the email exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Lead in Salesforce > 2');
    await leadFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    await unsubscribe(fx, p);
    await test.step('Still one Lead', async () => {
      await nothingHappens(fx.saleshandySequence.page, async () => {
        expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(1);
      });
      await describeLead(fx, p, 'After the unsubscribe');
    });
  });

  test('Create a Lead in Salesforce > 3: a Contact with the email exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Lead in Salesforce > 3');
    await contactFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    await unsubscribe(fx, p);
    await test.step('No Lead is created', async () => {
      await noRecord(fx, () => fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`);
    });
  });

  // ================= Update a Lead in Salesforce =================

  test('Update a Lead in Salesforce > 1: Lead exists with another Job Title, Phone and Company', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update a Lead in Salesforce > 1');
    await leadFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateLead }]);
    await unsubscribe(fx, p);
    await test.step('One Lead, mapped values show the prospect values', async () => {
      await recordAppears('the Lead update (Title)', async () => {
        expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(1);
        const f = await fx.salesforceLeads.leadFields(p.row['Email']);
        expect(f.title, 'Lead Title').toBe(p.row['Job Title']);
      });
      await describeLead(fx, p, 'After Update a Lead');
      record('Result', `Created with Title "${PRE.title}", Phone "${PRE.phone}", Company "${PRE.company}"`);
    });
  });

  test('Update a Lead in Salesforce > 2: no Lead or Contact with the email', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateLead }]);
    const p = prospect('Update a Lead in Salesforce > 2');
    await unsubscribe(fx, p);
    await test.step('Nothing is created', async () => {
      await noRecord(fx, () => fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`);
      expect(await fx.salesforceContacts.countByEmail(p.row['Email']), `Contacts for ${p.row['Email']}`).toBe(0);
    });
  });

  // ================= Create a Contact in Salesforce =================

  test('Create a Contact in Salesforce > 1: new prospect, not in Salesforce', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createContact }]);
    const p = prospect('Create a Contact in Salesforce > 1');
    await unsubscribe(fx, p);
    await recordAppears('the Contact', async () => {
      await fx.salesforceContacts.openList();
      expect(await fx.salesforceContacts.countByEmail(p.row['Email']), `Contacts for ${p.row['Email']}`).toBe(1);
    });
    await test.step('One Contact with the prospect Name and Email; no Lead', async () => {
      const f = await fx.salesforceContacts.contactFields(p.row['Email']);
      expect(f.name, 'Contact Name').toContain(fullName(p.row));
      expect(f.email, 'Contact Email').toBe(p.row['Email']);
      record('Contact', `Title "${f.title}", Department "${f.department}" (prospect "${p.row['Department']}"), Phone "${f.phone}" (prospect "${p.row['Phone Number']}"), Other address "${f.otherAddress}"`);
      expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(0);
    });
  });

  test('Create a Contact in Salesforce > 2: a Contact with the email exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Contact in Salesforce > 2');
    await contactFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createContact }]);
    await unsubscribe(fx, p);
    await test.step('Still one Contact; Business Phone updated', async () => {
      await recordAppears('the Business Phone change', async () => {
        expect(await fx.salesforceContacts.countByEmail(p.row['Email']), `Contacts for ${p.row['Email']}`).toBe(1);
        const f = await fx.salesforceContacts.contactFields(p.row['Email']);
        expect(f.phone, 'Contact Phone').not.toBe(PRE.phone);
      });
      await describeContact(fx, p, 'After the unsubscribe');
      record('Result', `Created with Phone "${PRE.phone}", Department "${PRE.department}"`);
    });
  });

  // ================= Update a Contact in Salesforce =================

  test('Update a Contact in Salesforce > 1: Contact exists with another Phone and Department', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update a Contact in Salesforce > 1');
    await contactFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateContact }]);
    await unsubscribe(fx, p);
    await test.step('One Contact; both fields show the prospect values', async () => {
      await recordAppears('the Contact update (Department)', async () => {
        expect(await fx.salesforceContacts.countByEmail(p.row['Email']), `Contacts for ${p.row['Email']}`).toBe(1);
        const f = await fx.salesforceContacts.contactFields(p.row['Email']);
        expect(f.department, 'Contact Department').toBe(p.row['Department']);
      });
      await describeContact(fx, p, 'After Update a Contact');
      record('Result', `Created with Phone "${PRE.phone}", Department "${PRE.department}"`);
    });
  });

  test('Update a Contact in Salesforce > 2: no Contact with the email', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateContact }]);
    const p = prospect('Update a Contact in Salesforce > 2');
    await unsubscribe(fx, p);
    await test.step('Nothing is created', async () => {
      await noRecord(fx, () => fx.salesforceContacts.countByEmail(p.row['Email']), `Contacts for ${p.row['Email']}`);
    });
  });

  // ================= Create a Account in Salesforce =================

  test('Create a Account in Salesforce > 1: new prospect with Website, City, State, Country', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createAccount }]);
    const p = prospect('Create a Account in Salesforce > 1');
    const before = await fx.salesforceAccounts.countByName(fullName(p.row));
    await unsubscribe(fx, p);
    await test.step('One Account named like the prospect', async () => {
      await recordAppears('the Account', async () => {
        expect((await fx.salesforceAccounts.countByName(fullName(p.row))) - before, 'Accounts created').toBe(1);
      });
      const after = await describeAccount(fx, p, 'After the unsubscribe');
      record('Result', `Accounts named "${fullName(p.row)}": ${before} before, ${after} after`);
    });
  });

  test('Create a Account in Salesforce > 2: an Account named like the prospect exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Account in Salesforce > 2');
    await accountFirst(fx, p);
    const before = await fx.salesforceAccounts.countByName(fullName(p.row));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createAccount }]);
    await unsubscribe(fx, p);
    await test.step('Still the same number of Accounts', async () => {
      await nothingHappens(fx.saleshandySequence.page, async () => {
        expect(await fx.salesforceAccounts.countByName(fullName(p.row)), `Accounts named "${fullName(p.row)}"`).toBe(before);
      });
      await describeAccount(fx, p, 'After the unsubscribe');
    });
  });

  test('Create a Account in Salesforce > 3: new prospect with an apostrophe in the name', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createAccount }]);
    const p = prospect('Create a Account in Salesforce > 3');
    const before = await fx.salesforceAccounts.countByName(fullName(p.row));
    await unsubscribe(fx, p);
    await test.step(`One Account named "${fullName(p.row)}"`, async () => {
      await recordAppears('the Account', async () => {
        expect((await fx.salesforceAccounts.countByName(fullName(p.row))) - before, 'Accounts created').toBe(1);
      });
      await describeAccount(fx, p, 'After the unsubscribe');
    });
  });

  // ================= Update a Account in Salesforce =================

  test('Update a Account in Salesforce > 1: Account named like the prospect exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update a Account in Salesforce > 1');
    await accountFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateAccount }]);
    await unsubscribe(fx, p);
    await test.step('One Account; mapped values show the prospect values', async () => {
      await recordAppears('the Account update (Billing City)', async () => {
        expect(await fx.salesforceAccounts.countByName(fullName(p.row)), `Accounts named "${fullName(p.row)}"`).toBe(1);
        const f = await fx.salesforceAccounts.accountFields(fullName(p.row));
        expect(f.billingAddress, 'Account Billing address').toContain(p.row['City']);
      });
      await describeAccount(fx, p, 'After Update a Account');
      record('Result', `Created with Billing City "${PRE.city}", Phone "${PRE.phone}"`);
    });
  });

  test('Update a Account in Salesforce > 2: no Account with the prospect full name', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateAccount }]);
    const p = prospect('Update a Account in Salesforce > 2');
    await unsubscribe(fx, p);
    await test.step('No Account is created', async () => {
      await noRecord(fx, () => fx.salesforceAccounts.countByName(fullName(p.row)), `Accounts named "${fullName(p.row)}"`);
    });
  });

  // ================= Create a Opportunity in Salesforce =================
  // The empty-values row (3) runs first: saved Extra Configuration cannot be cleared again, so the empty values must be saved before
  // any row saves Stage and Closing date.

  test('Create a Opportunity in Salesforce > 3: Extra Configuration saved with Stage and Closing date empty', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Opportunity in Salesforce > 3');
    await contactFirst(fx, p);
    try {
      await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createOpp }]);
    } catch (e) {
      // The dialog may refuse empty values. That is the result for QA, not a crash.
      record('Empty Extra Configuration', `Not saved: ${(e as Error).message}`);
      return;
    }
    await unsubscribe(fx, p);
    const appeared = await appearsWithin(RECORD_TIMEOUT_MS, async () => {
      expect((await fx.salesforceOpportunities.rowTexts(p.row['Email'])).length, `Opportunities for ${p.row['Email']}`).toBe(1);
    });
    record('An Opportunity appeared', String(appeared));
    await test.step('Record the Opportunity: Prospecting and Close Date today + 1 expected', async () => {
      await describeOpportunity(fx, p, 'Empty Extra Configuration');
      record('Expected Close Date today + 1', dayMonthYear(1));
    });
  });

  test('Create a Opportunity in Salesforce > 1: Contact exists, Deal Value 12000', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Opportunity in Salesforce > 1');
    await contactFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createOpp, opportunity: CREATE_OPP }]);
    await unsubscribe(fx, p);
    await recordAppears('the Opportunity', async () => {
      expect((await fx.salesforceOpportunities.rowTexts(p.row['Email'])).length, `Opportunities for ${p.row['Email']}`).toBe(1);
    });
    await test.step('One Opportunity named with the email, Prospecting, Close Date today + 7, Amount 12,000.00', async () => {
      await describeOpportunity(fx, p, 'Create a Opportunity');
      const f = await fx.salesforceOpportunities.opportunityFields(p.row['Email']);
      expect(f.stage, 'Stage').toBe('Prospecting');
      expect(f.closeDate, 'Close Date').toContain(dayMonthYear(7));
      expect(f.amount, 'Amount').toContain('12,000');
      await describeContact(fx, p, 'Contact', true);
    });
  });

  test('Create a Opportunity in Salesforce > 2: Closing date 0 Days in the modal', async ({ fx }) => {
    // The row before leaves this activity selected, and picking a selected activity opens no dialog: reset first.
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    const state = await fx.salesforceEmailSent.zeroClosingDateState(TRIGGER, A.createOpp);
    record('Closing date field', state.invalid);
    record('Save disabled', String(state.saveDisabled));
    // AL-4168: Save is disabled and the field turns red. The red state is recorded above for QA to read.
    expect(state.saveDisabled, 'Save is disabled for Closing date 0 Days').toBe(true);
  });

  // ================= Update a Opportunity in Salesforce =================

  test('Update a Opportunity in Salesforce > 1: Contact has 3 Opportunities with the email as name', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update a Opportunity in Salesforce > 1');
    await contactFirst(fx, p);
    await test.step('Create 3 Opportunities on the Contact', async () => {
      for (const days of [10, 20, 30]) {
        await fx.salesforceContacts.newOpportunity(p.row['Email'], { name: p.row['Email'], stage: 'Prospecting', closeDate: dayMonthYear(days) });
      }
      const before = await fx.salesforceOpportunities.rowTexts(p.row['Email']);
      record('Opportunities before the unsubscribe', before.join(' || '));
      expect(before.length, `Opportunities for ${p.row['Email']} before the unsubscribe`).toBe(3);
    });
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateOpp, opportunity: UPDATE_OPP }]);
    await unsubscribe(fx, p);
    await recordAppears('the Opportunity update (Qualification)', async () => {
      const rows = await fx.salesforceOpportunities.rowTexts(p.row['Email']);
      expect(rows.filter((r) => r.includes('Qualification')).length, 'Opportunities in Qualification').toBe(1);
    });
    await test.step('Only one Opportunity changed: Qualification, Close Date today + 14', async () => {
      const after = await describeOpportunity(fx, p, 'After the unsubscribe');
      expect(after.length, `Opportunities for ${p.row['Email']}`).toBe(3);
      const changed = after.filter((r) => r.includes('Qualification'));
      record('Changed rows', changed.join(' || ') || '(none)');
      expect(changed.length, 'Opportunities in Qualification').toBe(1);
      expect(changed[0], 'Close Date of the changed Opportunity').toContain(dayMonthYear(14));
    });
  });

  test('Update a Opportunity in Salesforce > 2: Closing date 0 Days in the modal', async ({ fx }) => {
    // The row before leaves this activity selected, and picking a selected activity opens no dialog: reset first.
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    const state = await fx.salesforceEmailSent.zeroClosingDateState(TRIGGER, A.updateOpp);
    record('Closing date field', state.invalid);
    record('Save disabled', String(state.saveDisabled));
    expect(state.saveDisabled, 'Save is disabled for Closing date 0 Days').toBe(true);
  });

  // ================= Attach Note in Salesforce =================

  test('Attach Note in Salesforce > 1: with Create a Contact, new prospect', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createContact }, { name: A.note }]);
    const p = prospect('Attach Note in Salesforce > 1');
    await unsubscribe(fx, p);
    await recordAppears('the Contact and its Note', async () => {
      expect(await fx.salesforceContacts.countByEmail(p.row['Email']), `Contacts for ${p.row['Email']}`).toBe(1);
      await fx.salesforceContacts.contactFields(p.row['Email']);
      expect(await noteCount(fx.salesforceContacts.page), 'Notes on the Contact').toBeGreaterThanOrEqual(1);
    });
    await test.step('One Contact and the Note on it (record the Note text)', async () => {
      await describeNote(fx.salesforceContacts.page, 'Contact');
    });
  });

  test('Attach Note in Salesforce > 2: with Create a Lead, new prospect', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }, { name: A.note }]);
    const p = prospect('Attach Note in Salesforce > 2');
    await unsubscribe(fx, p);
    const appeared = await appearsWithin(RECORD_TIMEOUT_MS, async () => {
      expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(1);
      await fx.salesforceLeads.openLead(p.row['Email']);
      expect(await noteCount(fx.salesforceLeads.page), 'Notes on the Lead').toBeGreaterThanOrEqual(1);
    });
    record('A Lead and a Note appeared', String(appeared));
    await test.step('Record the Lead and the Note on it', async () => {
      await describeLead(fx, p, 'Create a Lead + Attach Note');
      await fx.salesforceLeads.openLead(p.row['Email']);
      await describeNote(fx.salesforceLeads.page, 'Lead');
    });
  });

  // ================= Record(log) an Email Activity in Salesforce =================

  test('Record(log) an Email Activity > 1: Contact ticked with Update a Contact', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Record(log) an Email Activity in Salesforce > 1');
    await contactFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateContact }, { name: A.record, objects: ['Contact'] }]);
    await fx.salesforceContacts.contactFields(p.row['Email']);
    const before = await tab(fx.salesforceContacts.page, 'Activity');
    await unsubscribe(fx, p);
    await recordAppears('the Email Task on the Contact', async () => {
      await fx.salesforceContacts.contactFields(p.row['Email']);
      expect(await tab(fx.salesforceContacts.page, 'Activity'), 'Activity tab of the Contact').not.toBe(before);
    });
    await test.step('Record the Contact timeline (Subject and body)', async () => {
      await describeContact(fx, p, 'Update a Contact + Record', true);
    });
  });

});
