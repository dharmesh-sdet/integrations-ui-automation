// Scenarios: test-cases/salesforce/email-opened.md (Regression, 31 rows, approved by QA
//   2026-11-04; AL-4135). One test per row.
// Data: test-data/salesforce/email-opened.csv, one prospect per row, found by the Scenario
//   column. Saleshandy accepts an email once per account, so a record a row needs first is made
//   by hand in Salesforce with the prospect's email and different values (PRE below), never by
//   adding a second prospect with the same email.
// Page objects: src/pages/saleshandy/salesforce-email-sent.page.ts (Triggers & Activity incl. the
//   Extra Configuration dialogs, Logs), src/pages/salesforce/*.page.ts, the sequence page and
//   src/pages/mailinator.page.ts.
// Flow: src/flows/salesforce-email-opened.ts (add, Send now, open in Mailinator, read the new Logs entry).
//
// Pass/fail: rows whose Expected result comes from the developer log or QA assert it. Rows marked
// "(proposed, unconfirmed)" in the cases file are recorded as test annotations for QA to confirm,
// then turned into assertions. Every row also asserts that the Logs entry reached a final status.
// Error in Logs is reported to QA, not failed.
//
// Sequence: "Salesforce Email Opened Regression" (197671) on sfemailopened, 2 steps, active, Track
// email opens on, Track link clicks off. Built by tests/setup/salesforce-email-opened-sequence.spec.ts.
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import {
  knownLogIds,
  openAndExpectNoLog,
  openAndReadLog,
  readNewLog,
  openEmail,
  TRIGGER,
  EMAIL_SENT_TRIGGER,
  type OpenResult,
} from '../../src/flows/salesforce-email-opened.ts';
import { fullName } from '../../src/flows/saleshandy-to-salesforce.ts';
import { readRecordTab } from '../../src/pages/salesforce/object.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';
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

test.use({ account: 'sfemailopened' });

const SEQUENCE_ID = '197671';
const CSV = 'salesforce/email-opened.csv';

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

// What a record already holds before the open, so a change by the workflow is visible.
const PRE = { company: 'Brightpath Logistics', title: 'Operations Manager', phone: '+1 555-0100-4821', department: 'Operations', city: 'Austin' };

// One open = Send now (40 to 50 s sender gap), 10 s + 10 s open wait, 15 s Logs wait, and the Logs poll.
const minutes = (sends: number): number => sends * 4 * 60_000;

type Prospect = { row: Row; used: string };

function prospect(scenario: string): Prospect {
  const row = readCsv(CSV).find((r) => r['Scenario'] === scenario);
  if (!row) throw new Error(`No row "${scenario}" in test-data/${CSV}`);
  return { row, used: row['Email'] };
}

const pagesOf = (fx: Fx) => ({ salesforceIntegration: fx.salesforceEmailSent, saleshandySequence: fx.saleshandySequence, mailinator: fx.mailinator });

function open(fx: Fx, p: Prospect, step = 1): Promise<OpenResult> {
  return openAndReadLog(pagesOf(fx), { sequenceId: SEQUENCE_ID, row: p.row, csv: CSV, usedEmail: p.used, step });
}

const record = (type: string, description: string): void => {
  test.info().annotations.push({ type, description });
};

const clip = (text: string, max = 700): string => (text.length > max ? `${text.slice(0, max)}...` : text);

// DD/MM/YYYY, the way this org shows and reads dates.
function dayMonthYear(daysFromToday: number): string {
  const d = new Date(Date.now() + daysFromToday * 86_400_000);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// Records a row needs before the open, made from the prospect's own row. markUsed retires the CSV
// row at once: the record now exists, so a failed run must not reuse the person.
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

// Where the Note shows: the record's Activity and Related tabs. The Note text is recorded for QA.
async function describeNote(page: Page, label: string): Promise<void> {
  const activity = await tab(page, 'Activity');
  const related = await tab(page, 'Related');
  const all = `${activity} ${related}`;
  record(`${label}: Notes list`, all.match(/Notes(?: & Attachments)? \(\d+\)/)?.[0] ?? '(no Notes list found)');
  for (const text of ['Step 1', 'Step 2', 'Variant A', 'Open Count']) record(`${label}: Note shows "${text}"`, String(all.includes(text)));
  record(`${label}: Activity tab`, clip(activity, 1200));
  record(`${label}: Related tab`, clip(related, 1200));
}

function reachedFinalStatus(result: OpenResult): void {
  expect(['Success', 'Error'], 'Logs reached a final status').toContain(result.status);
}

test.describe('Sequence Email is Opened in Saleshandy', () => {
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

  test('Trigger behavior > 2: new prospect got step 1, first open', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    const p = prospect('Trigger behavior > 2');
    const result = await open(fx, p);
    expect(result.opened, 'Opened count').toBeGreaterThanOrEqual(1);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('One Lead exists', async () => {
      await untilPasses('the Lead appears in Salesforce', async () => {
        expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(1);
      });
    });
  });

  test('Trigger behavior > 3: first open done, second open after 10 s', async ({ fx }) => {
    test.setTimeout(minutes(2));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    const p = prospect('Trigger behavior > 3');
    const first = await open(fx, p);
    record('First open Logs status', first.status);
    const known = await knownLogIds(pagesOf(fx));
    let opened = 0;
    await test.step('Open the same email again', async () => {
      opened = await openEmail(fx.saleshandySequence, fx.mailinator, SEQUENCE_ID, p.row, 1);
    });
    record('Opened count after the second open', String(opened));
    expect(opened, 'Opened count').toBeGreaterThanOrEqual(2);
    const second = await readNewLog(pagesOf(fx), known, TRIGGER, p.row);
    record('Second open Logs status', second.status);
    reachedFinalStatus(second);
    await test.step('Still one Lead', async () => {
      record('Leads for the email', String(await fx.salesforceLeads.countByEmail(p.row['Email'])));
    });
  });

  test('Trigger behavior > 4: prospect moved to step 2 and sent, open the step 2 email', async ({ fx }) => {
    test.setTimeout(minutes(3));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    const p = prospect('Trigger behavior > 4');
    const result = await open(fx, p, 2);
    record('Step 2 open Logs status', result.status);
    record('Step 2 Opened count', String(result.opened));
    reachedFinalStatus(result);
  });

  test('Trigger behavior > 5: only Email Sent trigger on', async ({ fx }) => {
    test.setTimeout(minutes(2));
    // Update a Lead matches nothing for a new prospect, so the send itself creates no Lead.
    await fx.salesforceEmailSent.configureTrigger(EMAIL_SENT_TRIGGER, [{ name: A.updateLead }]);
    const p = prospect('Trigger behavior > 5');
    const opened = await openAndExpectNoLog(pagesOf(fx), { sequenceId: SEQUENCE_ID, row: p.row, csv: CSV, usedEmail: p.used });
    expect(opened, 'Opened count').toBeGreaterThanOrEqual(1);
    await test.step('No Lead exists', async () => {
      expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(0);
    });
  });

  // ================= Create a Lead in Salesforce =================

  test('Create a Lead in Salesforce > 1: new prospect with an apostrophe in the last name', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    const p = prospect('Create a Lead in Salesforce > 1');
    const result = await open(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('One Lead with the prospect values and Lead Status "Open - Not Contacted"', async () => {
      await fx.salesforceLeads.openLeads();
      await untilPasses('the Lead appears in Salesforce', async () => {
        expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(1);
      });
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
    const result = await open(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('Still one Lead', async () => {
      const count = await describeLead(fx, p, 'After the open');
      record('Result', `Logs ${result.status}, ${count} Lead(s); created with Title "${PRE.title}", Company "${PRE.company}"`);
      expect(count, `Leads for ${p.row['Email']}`).toBe(1);
    });
  });

  test('Create a Lead in Salesforce > 3: a Contact with the email exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Lead in Salesforce > 3');
    await contactFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    const result = await open(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('No Lead is created', async () => {
      expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(0);
    });
  });

  // ================= Update a Lead in Salesforce =================

  test('Update a Lead in Salesforce > 1: Lead exists with another Job Title, Phone and Company', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update a Lead in Salesforce > 1');
    await leadFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateLead }]);
    const result = await open(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('One Lead, mapped values show the prospect values', async () => {
      const count = await describeLead(fx, p, 'After Update a Lead');
      expect(count, `Leads for ${p.row['Email']}`).toBe(1);
      const f = await fx.salesforceLeads.leadFields(p.row['Email']);
      record('Result', `Created with Title "${PRE.title}", Phone "${PRE.phone}", Company "${PRE.company}"; now Title "${f.title}", Phone "${f.phone}", Company "${f.company}"`);
      expect(f.title, 'Lead Title').toBe(p.row['Job Title']);
    });
  });

  test('Update a Lead in Salesforce > 2: no Lead or Contact with the email', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateLead }]);
    const p = prospect('Update a Lead in Salesforce > 2');
    const result = await open(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('Nothing is created', async () => {
      expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(0);
      expect(await fx.salesforceContacts.countByEmail(p.row['Email']), `Contacts for ${p.row['Email']}`).toBe(0);
    });
  });

  // ================= Create a Contact in Salesforce =================

  test('Create a Contact in Salesforce > 1: new prospect, not in Salesforce', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createContact }]);
    const p = prospect('Create a Contact in Salesforce > 1');
    const result = await open(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('One Contact with the prospect Name and Email; no Lead', async () => {
      await untilPasses('the Contact appears in Salesforce', async () => {
        await fx.salesforceContacts.openList();
        expect(await fx.salesforceContacts.countByEmail(p.row['Email']), `Contacts for ${p.row['Email']}`).toBe(1);
      });
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
    const result = await open(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('Still one Contact; record its values', async () => {
      const count = await describeContact(fx, p, 'After the open');
      record('Result', `Created with Phone "${PRE.phone}", Department "${PRE.department}"`);
      expect(count, `Contacts for ${p.row['Email']}`).toBe(1);
    });
  });

  // ================= Update a Contact in Salesforce =================

  test('Update a Contact in Salesforce > 1: Contact exists with another Phone and Department', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update a Contact in Salesforce > 1');
    await contactFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateContact }]);
    const result = await open(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('One Contact; record its values', async () => {
      const count = await describeContact(fx, p, 'After Update a Contact');
      record('Result', `Created with Phone "${PRE.phone}", Department "${PRE.department}"`);
      expect(count, `Contacts for ${p.row['Email']}`).toBe(1);
      const f = await fx.salesforceContacts.contactFields(p.row['Email']);
      expect(f.department, 'Contact Department').toBe(p.row['Department']);
    });
  });

  test('Update a Contact in Salesforce > 2: no Contact with the email', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateContact }]);
    const p = prospect('Update a Contact in Salesforce > 2');
    const result = await open(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('No Contact is created', async () => {
      expect(await fx.salesforceContacts.countByEmail(p.row['Email']), `Contacts for ${p.row['Email']}`).toBe(0);
    });
  });

  // ================= Create a Account in Salesforce =================

  test('Create a Account in Salesforce > 1: new prospect "Priya Nair"', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createAccount }]);
    const p = prospect('Create a Account in Salesforce > 1');
    const before = await fx.salesforceAccounts.countByName(fullName(p.row));
    const result = await open(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('One Account named like the prospect', async () => {
      const after = await describeAccount(fx, p, 'After the open');
      record('Result', `Accounts named "${fullName(p.row)}": ${before} before, ${after} after`);
      expect(after - before, 'Accounts created').toBe(1);
    });
  });

  test('Create a Account in Salesforce > 2: an Account named like the prospect exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Account in Salesforce > 2');
    await accountFirst(fx, p);
    const before = await fx.salesforceAccounts.countByName(fullName(p.row));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createAccount }]);
    const result = await open(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('Still the same number of Accounts', async () => {
      const after = await describeAccount(fx, p, 'After the open');
      record('Result', `Accounts named "${fullName(p.row)}": ${before} before, ${after} after`);
      expect(after, 'Accounts with the name').toBe(before);
    });
  });

  test('Create a Account in Salesforce > 3: new prospect "Sean O\'Brien"', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createAccount }]);
    const p = prospect('Create a Account in Salesforce > 3');
    const before = await fx.salesforceAccounts.countByName(fullName(p.row));
    const result = await open(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step("One Account named \"Sean O'Brien\"", async () => {
      const after = await describeAccount(fx, p, 'After the open');
      record('Result', `Accounts named "${fullName(p.row)}": ${before} before, ${after} after`);
      expect(after - before, 'Accounts created').toBe(1);
    });
  });

  // ================= Update a Account in Salesforce =================

  test('Update a Account in Salesforce > 1: Account named like the prospect exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update a Account in Salesforce > 1');
    await accountFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateAccount }]);
    const result = await open(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('One Account; record its values', async () => {
      const count = await describeAccount(fx, p, 'After Update a Account');
      record('Result', `Created with Billing City "${PRE.city}", Phone "${PRE.phone}"`);
      expect(count, `Accounts named "${fullName(p.row)}"`).toBe(1);
    });
  });

  test('Update a Account in Salesforce > 2: no Account with the prospect full name', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateAccount }]);
    const p = prospect('Update a Account in Salesforce > 2');
    const result = await open(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('No Account is created', async () => {
      expect(await fx.salesforceAccounts.countByName(fullName(p.row)), `Accounts named "${fullName(p.row)}"`).toBe(0);
    });
  });

  // ================= Create a Opportunity in Salesforce =================

  test('Create a Opportunity in Salesforce > 1: Contact exists, Deal Value 12000', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Opportunity in Salesforce > 1');
    await contactFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createOpp, opportunity: CREATE_OPP }]);
    const result = await open(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('One Opportunity named with the email, Prospecting, Close Date today + 7, Amount 12,000.00', async () => {
      const rows = await describeOpportunity(fx, p, 'Create a Opportunity');
      expect(rows.length, `Opportunities for ${p.row['Email']}`).toBe(1);
      const f = await fx.salesforceOpportunities.opportunityFields(p.row['Email']);
      expect(f.stage, 'Stage').toBe('Prospecting');
      expect(f.closeDate, 'Close Date').toContain(dayMonthYear(7));
      expect(f.amount, 'Amount').toContain('12,000');
      await describeContact(fx, p, 'Contact', true);
    });
  });

  test('Create a Opportunity in Salesforce > 2: Contact not in Salesforce', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createOpp, opportunity: CREATE_OPP }]);
    const p = prospect('Create a Opportunity in Salesforce > 2');
    const result = await open(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('A Contact and the Opportunity are created', async () => {
      const rows = await describeOpportunity(fx, p, 'No Contact beforehand');
      const contacts = await describeContact(fx, p, 'Contact', true);
      expect(rows.length, `Opportunities for ${p.row['Email']}`).toBe(1);
      expect(contacts, `Contacts for ${p.row['Email']}`).toBe(1);
    });
  });

  test('Create a Opportunity in Salesforce > 3: Closing date 0 Days in the modal', async ({ fx }) => {
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
      record('Opportunities before the open', before.join(' || '));
      expect(before.length, `Opportunities for ${p.row['Email']} before the open`).toBe(3);
    });
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateOpp, opportunity: UPDATE_OPP }]);
    const result = await open(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('Only one Opportunity changed: Qualification, Close Date today + 14', async () => {
      const after = await describeOpportunity(fx, p, 'After the open');
      expect(after.length, `Opportunities for ${p.row['Email']}`).toBe(3);
      const changed = after.filter((r) => r.includes('Qualification'));
      record('Changed rows', changed.join(' || ') || '(none)');
      expect(changed.length, 'Opportunities in Qualification').toBe(1);
      expect(changed[0], 'Close Date of the changed Opportunity').toContain(dayMonthYear(14));
    });
  });

  test('Update a Opportunity in Salesforce > 2: Closing date 0 Days in the modal', async ({ fx }) => {
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
    const result = await open(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('One Contact and the Note on it (record the Note text)', async () => {
      const count = await describeContact(fx, p, 'Create a Contact + Attach Note');
      expect(count, `Contacts for ${p.row['Email']}`).toBe(1);
      await describeNote(fx.salesforceContacts.page, 'Contact');
    });
  });

  test('Attach Note in Salesforce > 2: with Create a Lead, new prospect', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }, { name: A.note }]);
    const p = prospect('Attach Note in Salesforce > 2');
    const result = await open(fx, p);
    await test.step('Record the Lead and the Note on it', async () => {
      record('Result', `Logs ${result.status}`);
      await describeLead(fx, p, 'Create a Lead + Attach Note');
      await fx.salesforceLeads.openLead(p.row['Email']);
      await describeNote(fx.salesforceLeads.page, 'Lead');
    });
    reachedFinalStatus(result);
  });

  test('Attach Note in Salesforce > 3: with Create a Account, new prospect', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createAccount }, { name: A.note }]);
    const p = prospect('Attach Note in Salesforce > 3');
    const result = await open(fx, p);
    await test.step('Record the Account and the Note on it', async () => {
      record('Result', `Logs ${result.status}`);
      await describeAccount(fx, p, 'Create a Account + Attach Note');
      await fx.salesforceAccounts.openRecord(fullName(p.row));
      await describeNote(fx.salesforceAccounts.page, 'Account');
    });
    reachedFinalStatus(result);
  });

  test('Attach Note in Salesforce > 4: with Create a Opportunity, new prospect', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createOpp, opportunity: CREATE_OPP }, { name: A.note }]);
    const p = prospect('Attach Note in Salesforce > 4');
    const result = await open(fx, p);
    await test.step('Record the Opportunity and the Note on it', async () => {
      record('Result', `Logs ${result.status}`);
      await describeOpportunity(fx, p, 'Create a Opportunity + Attach Note');
      await fx.salesforceOpportunities.openRecord(p.row['Email']);
      await describeNote(fx.salesforceOpportunities.page, 'Opportunity');
    });
    reachedFinalStatus(result);
  });

  // ================= Record(log) an Email Activity in Salesforce =================

  test('Record(log) an Email Activity > 1: Contact ticked with Update a Contact', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Record(log) an Email Activity in Salesforce > 1');
    await contactFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateContact }, { name: A.record, objects: ['Contact'] }]);
    const result = await open(fx, p);
    await test.step('Record the Contact timeline (From, To, Subject, body)', async () => {
      record('Result', `Logs ${result.status}`);
      await describeContact(fx, p, 'Update a Contact + Record', true);
    });
    reachedFinalStatus(result);
  });

  test('Record(log) an Email Activity > 2: Lead ticked with Update a Lead', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Record(log) an Email Activity in Salesforce > 2');
    await leadFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateLead }, { name: A.record, objects: ['Lead'] }]);
    const result = await open(fx, p);
    await test.step('Record the Lead and its timeline', async () => {
      record('Result', `Logs ${result.status}`);
      await describeLead(fx, p, 'Update a Lead + Record');
      record('Lead Activity tab', clip(await tab(fx.salesforceLeads.page, 'Activity')));
    });
    reachedFinalStatus(result);
  });

  test('Record(log) an Email Activity > 3: no object ticked, Contact exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Record(log) an Email Activity in Salesforce > 3');
    await contactFirst(fx, p);
    // No object ticked in "Select Object": saves fine and must not crash (old bug: empty Select Object).
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.record }]);
    const result = await open(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('Record the Contact timeline: nothing is logged', async () => {
      await describeContact(fx, p, 'Record alone', true);
    });
  });
});
