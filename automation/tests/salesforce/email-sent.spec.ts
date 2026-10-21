// Scenarios: test-cases/salesforce/email-sent.md (Regression, 35 rows, approved by QA
//   2026-10-21; AL-4132). One test per row; "Update a Opportunity > 2" is skipped.
// Data: test-data/salesforce/email-sent.csv, one prospect per row, found by the
//   Scenario column. Saleshandy accepts an email once per account, so a record that
//   must exist first is made by hand in Salesforce with the prospect's email and
//   legacy values (LEGACY in src/pages/salesforce/salesforce.ts), never by sending a
//   second prospect with the same email.
// Page objects: src/pages/saleshandy/salesforce-email-sent.page.ts (Triggers &
//   Activity incl. the two Extra Configuration dialogs, Logs),
//   src/pages/salesforce/{leads,contacts,accounts,opportunities}.page.ts, and the
//   sequence page shared with the HubSpot workflows (Add Prospects, Send now).
// Flow: src/flows/saleshandy-to-salesforce.ts (send, then read the new Logs entry).
//
// Pass/fail: the plan marks most Expected results "(proposed, unconfirmed)". Those are
// recorded as test annotations (visible in the report) for QA to confirm, then turned
// into assertions. Asserted: the trigger saves, a plain Create Lead is correct, and the
// Logs entry reaches a final status.
//
// Sequence: "Salesforce Email Sent Regression" (196882) on sfemailsent, 2 steps,
// active, created by tests/setup/email-sent-salesforce-sequence.spec.ts.
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { fullName, sendAndExpectNoLog, sendAndReadLog, type SendResult } from '../../src/flows/saleshandy-to-salesforce.ts';
import { readRecordTab } from '../../src/pages/salesforce/object.page.ts';
import { LEGACY } from '../../src/pages/salesforce/salesforce.ts';
import { staysTrue, untilPasses } from '../../src/utils/wait.ts';
import type { Page } from '@playwright/test';
import type { ActivitySpec, SalesforceEmailSentPage } from '../../src/pages/saleshandy/salesforce-email-sent.page.ts';
import type { SaleshandySequencePage } from '../../src/pages/saleshandy/sequence.page.ts';
import type { SalesforceAccountsPage } from '../../src/pages/salesforce/accounts.page.ts';
import type { SalesforceContactsPage } from '../../src/pages/salesforce/contacts.page.ts';
import type { SalesforceLeadsPage } from '../../src/pages/salesforce/leads.page.ts';
import type { SalesforceOpportunitiesPage } from '../../src/pages/salesforce/opportunities.page.ts';

type Fx = {
  salesforceEmailSent: SalesforceEmailSentPage;
  saleshandySequence: SaleshandySequencePage;
  salesforceLeads: SalesforceLeadsPage;
  salesforceContacts: SalesforceContactsPage;
  salesforceAccounts: SalesforceAccountsPage;
  salesforceOpportunities: SalesforceOpportunitiesPage;
};

// One bundle of the page objects, so each test names a single fixture.
const test = base.extend<{ fx: Fx }>({
  fx: async ({ salesforceEmailSent, saleshandySequence, salesforceLeads, salesforceContacts, salesforceAccounts, salesforceOpportunities }, use) =>
    use({ salesforceEmailSent, saleshandySequence, salesforceLeads, salesforceContacts, salesforceAccounts, salesforceOpportunities }),
});

test.use({ account: 'sfemailsent' });

// Name on Triggers & Activity and in Logs.
const TRIGGER = 'Email Sent from Saleshandy';
const SEQUENCE_ID = '196882';
const CSV = 'salesforce/email-sent.csv';

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

// Extra Configuration used by the plan: Stage = Prospecting, Closing date = 0 Days.
const PROSPECTING = { stage: 'Prospecting', days: 0 };
const QUALIFICATION = { stage: 'Qualification', days: 2 };

// One send = the sequence's 40 to 50 s gap, Send now and a Logs entry (about 2.5 min
// measured 2026-10-21); the budget keeps room for slow pages.
const minutes = (sends: number): number => sends * 4 * 60_000;

type Prospect = { row: Row; used: string };

function prospect(scenario: string): Prospect {
  const row = readCsv(CSV).find((r) => r['Scenario'] === scenario);
  if (!row) throw new Error(`No row "${scenario}" in test-data/${CSV}`);
  return { row, used: row['Email'] };
}

function send(fx: Fx, p: Prospect, step = 1): Promise<SendResult> {
  return sendAndReadLog(
    { salesforceIntegration: fx.salesforceEmailSent, saleshandySequence: fx.saleshandySequence },
    { sequenceId: SEQUENCE_ID, trigger: TRIGGER, row: p.row, csv: CSV, usedEmail: p.used, step },
  );
}

// Records a scenario needs before the send. Each is made from the prospect's own row
// with legacy values, so a change by the workflow is visible. markUsed retires the
// CSV row at once: the record now exists, so a failed run must not reuse the person.
async function leadFirst(fx: Fx, p: Prospect, status?: string): Promise<void> {
  await test.step(`Create the Lead in Salesforce for ${p.row['Email']}`, async () => {
    markUsed(CSV, p.used);
    await fx.salesforceLeads.createLead({
      firstName: p.row['First Name'],
      lastName: p.row['Last Name'],
      email: p.row['Email'],
      company: LEGACY.company,
      title: LEGACY.title,
      phone: LEGACY.phone,
      status,
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
      phone: LEGACY.phone,
      department: LEGACY.department,
    });
  });
}

async function accountFirst(fx: Fx, p: Prospect): Promise<void> {
  await test.step(`Create the Account "${p.row['Company']}" in Salesforce`, async () => {
    markUsed(CSV, p.used);
    await fx.salesforceAccounts.createAccount({ name: p.row['Company'], billingCity: LEGACY.city, phone: LEGACY.phone });
  });
}

const record = (type: string, description: string): void => {
  test.info().annotations.push({ type, description });
};

const clip = (text: string, max = 700): string => (text.length > max ? `${text.slice(0, max)}...` : text);

// A tab the record page may not have (a Lead has no Related tab).
async function tab(page: Page, name: string): Promise<string> {
  return readRecordTab(page, name).catch(() => `(no "${name}" tab on this record)`);
}

async function describeLead(fx: Fx, p: Prospect, label: string, withActivity = false): Promise<number> {
  const email = p.row['Email'];
  const count = await fx.salesforceLeads.countByEmail(email);
  record(`${label}: Leads for ${email}`, String(count));
  if (count >= 1) {
    const f = await fx.salesforceLeads.leadFields(email);
    record(`${label}: Lead`, `Name "${f.name}", Company "${f.company}", Title "${f.title}", Phone "${f.phone}", Status "${f.status}"; prospect Title "${p.row['Job Title']}", Phone "${p.row['Phone Number']}", Company "${p.row['Company']}"`);
    if (withActivity) record(`${label}: Lead Activity tab`, clip(await tab(fx.salesforceLeads.page, 'Activity')));
  }
  return count;
}

async function describeContact(fx: Fx, p: Prospect, label: string): Promise<number> {
  const email = p.row['Email'];
  const count = await fx.salesforceContacts.countByEmail(email);
  record(`${label}: Contacts for ${email}`, String(count));
  if (count >= 1) {
    const f = await fx.salesforceContacts.contactFields(email);
    record(`${label}: Contact`, `Name "${f.name}", Title "${f.title}", Department "${f.department}", Phone "${f.phone}", Other address "${f.otherAddress}"; prospect Phone "${p.row['Phone Number']}", Department "${p.row['Department']}", City "${p.row['City']}"`);
    record(`${label}: Contact Activity tab`, clip(await tab(fx.salesforceContacts.page, 'Activity')));
    record(`${label}: Contact Related tab`, clip(await tab(fx.salesforceContacts.page, 'Related')));
  }
  return count;
}

// Accounts are searched by Company name. The org is shared, so an Account with the
// same name may already exist from another run: scenarios compare counts before and
// after the send instead of expecting an absolute number.
async function describeAccount(fx: Fx, p: Prospect, label: string): Promise<number> {
  const name = p.row['Company'];
  const count = await fx.salesforceAccounts.countByName(name);
  record(`${label}: Accounts named "${name}"`, String(count));
  if (count >= 1) {
    const f = await fx.salesforceAccounts.accountFields(name);
    record(`${label}: Account`, `Name "${f.name}", Billing address "${f.billingAddress}", Website "${f.website}", Phone "${f.phone}"; prospect City "${p.row['City']}", State "${p.row['State']}", Country "${p.row['Country']}", Website "${p.row['Company Website']}"`);
  }
  return count;
}

// The Opportunity name is not documented, so the Opportunities list is searched
// for the prospect's last name; the rows found are recorded either way.
async function describeOpportunity(fx: Fx, p: Prospect, label: string): Promise<void> {
  const last = p.row['Last Name'];
  const rows = await fx.salesforceOpportunities.rowTexts(last);
  record(`${label}: Opportunity rows matching "${last}"`, rows.length ? rows.join(' || ') : '(none)');
  if (rows.length) {
    const f = await fx.salesforceOpportunities.opportunityFields(last);
    record(`${label}: Opportunity`, `Name "${f.name}", Stage "${f.stage}", Close Date "${f.closeDate}", Amount "${f.amount}", Description "${f.description}"`);
  }
}

// The Logs entry reached a final status. Error is recorded for QA, not failed.
function reachedFinalStatus(result: SendResult): void {
  expect(['Success', 'Error'], 'Logs reached a final status').toContain(result.status);
}

test.describe('Email Sent from Saleshandy', () => {
  // ================= Trigger behavior =================

  test('Trigger behavior > 1: trigger off, enable it with Create a Lead and Save', async ({ fx }) => {
    await test.step('Turn every trigger off and save', async () => {
      await fx.salesforceEmailSent.turnAllTriggersOff();
    });
    await test.step('Enable "Email Sent from Saleshandy", select Create a Lead in Salesforce and Save', async () => {
      await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    });
  });

  test('Trigger behavior > 2: only Reply Received on, Email Sent off', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger('Reply is Received in Saleshandy', [{ name: A.createLead }]);
    const p = prospect('Trigger behavior > 2');
    await sendAndExpectNoLog(
      { salesforceIntegration: fx.salesforceEmailSent, saleshandySequence: fx.saleshandySequence },
      { sequenceId: SEQUENCE_ID, trigger: TRIGGER, row: p.row, csv: CSV, usedEmail: p.used },
    );
    await test.step('No Lead was created', async () => {
      // Each look reloads the list, so a Lead created late is still caught.
      await staysTrue(
        fx.salesforceLeads.page,
        async () => {
          expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads in Salesforce for ${p.row['Email']}`).toBe(0);
        },
        3,
      );
    });
  });

  test('Trigger behavior > 3: Create a Lead on, prospect already got step 1', async ({ fx }) => {
    test.setTimeout(minutes(2));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    const p = prospect('Trigger behavior > 3');
    const first = await send(fx, p);
    const second = await send(fx, p, 2);
    // A second entry means step 2 fired the trigger again; sendAndReadLog fails if none appears.
    record('Step 1 Logs status', first.status);
    record('Step 2 Logs status', second.status);
    reachedFinalStatus(second);
  });

  // ================= Create a Lead in Salesforce =================

  test('Create a Lead in Salesforce > 1: new prospect, not in Salesforce', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    const p = prospect('Create a Lead in Salesforce > 1');
    const result = await send(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('Exactly one Lead, with the prospect values and Lead Status "Open - Not Contacted"', async () => {
      await fx.salesforceLeads.openLeads();
      await untilPasses('the Lead appears in Salesforce', async () => {
        expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads in Salesforce for ${p.row['Email']}`).toBe(1);
      });
      const f = await fx.salesforceLeads.leadFields(p.row['Email']);
      expect(f.name, 'Lead Name').toBe(fullName(p.row));
      expect(f.email, 'Lead Email').toBe(p.row['Email']);
      expect(f.company, 'Lead Company').toBe(p.row['Company']);
      expect(f.status, 'Lead Status').toBe('Open - Not Contacted');
      record('Lead', `Title "${f.title}" (prospect "${p.row['Job Title']}"), Phone "${f.phone}" (prospect "${p.row['Phone Number']}"), Address "${f.address}"`);
    });
  });

  test('Create a Lead in Salesforce > 2: prospect Company empty', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    const p = prospect('Create a Lead in Salesforce > 2');
    const result = await send(fx, p);
    await test.step('Record whether a Lead was created', async () => {
      const count = await describeLead(fx, p, 'Company empty');
      record('Result', `Logs ${result.status}, ${count} Lead(s)`);
    });
    reachedFinalStatus(result);
  });

  test('Create a Lead in Salesforce > 3: a Lead with the same email exists', async ({ fx }) => {
    test.setTimeout(minutes(2));
    const p = prospect('Create a Lead in Salesforce > 3');
    await leadFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    const result = await send(fx, p);
    await test.step('Record the Leads for the shared email', async () => {
      const count = await describeLead(fx, p, 'Same email');
      record('Result', `Logs ${result.status}, ${count} Lead(s)`);
    });
    reachedFinalStatus(result);
  });

  test('Create a Lead in Salesforce > 4: prospect already has one Lead, step 2', async ({ fx }) => {
    test.setTimeout(minutes(2));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    const p = prospect('Create a Lead in Salesforce > 4');
    const first = await send(fx, p);
    expect(first.status, 'Logs status of step 1, which creates the Lead').toBe('Success');
    const second = await send(fx, p, 2);
    await test.step('Record the Leads after step 2', async () => {
      const count = await describeLead(fx, p, 'After step 2');
      record('Result', `Logs ${second.status}, ${count} Lead(s)`);
    });
    reachedFinalStatus(second);
  });

  // ================= Update a Lead in Salesforce =================

  test('Update a Lead in Salesforce > 1: Lead exists with different Title, Phone and Company', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update a Lead in Salesforce > 1');
    await leadFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateLead }]);
    const result = await send(fx, p);
    await test.step('Record the Lead after the send', async () => {
      const count = await describeLead(fx, p, 'After Update a Lead');
      record('Result', `Logs ${result.status}, ${count} Lead(s); created with Title "${LEGACY.title}", Phone "${LEGACY.phone}", Company "${LEGACY.company}"`);
    });
    reachedFinalStatus(result);
  });

  test('Update a Lead in Salesforce > 2: Lead Status "Working - Contacted"', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update a Lead in Salesforce > 2');
    await leadFirst(fx, p, 'Working - Contacted');
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateLead }]);
    const result = await send(fx, p);
    await test.step('Record the Lead after the send', async () => {
      await describeLead(fx, p, 'After Update a Lead');
      record('Result', `Logs ${result.status}; Lead Status was "Working - Contacted"`);
    });
    reachedFinalStatus(result);
  });

  test('Update a Lead in Salesforce > 3: no Lead or Contact with the email', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateLead }]);
    const p = prospect('Update a Lead in Salesforce > 3');
    const result = await send(fx, p);
    await test.step('Record whether a Lead was created', async () => {
      const leads = await describeLead(fx, p, 'Nothing beforehand');
      const contacts = await fx.salesforceContacts.countByEmail(p.row['Email']);
      record('Result', `Logs ${result.status}, ${leads} Lead(s), ${contacts} Contact(s)`);
    });
    reachedFinalStatus(result);
  });

  // ================= Create a Contact in Salesforce =================

  test('Create a Contact in Salesforce > 1: Contact not in Salesforce', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createContact }]);
    const p = prospect('Create a Contact in Salesforce > 1');
    const result = await send(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('Exactly one Contact, with the prospect Name and Email; no Lead', async () => {
      await untilPasses('the Contact appears in Salesforce', async () => {
        await fx.salesforceContacts.openList();
        expect(await fx.salesforceContacts.countByEmail(p.row['Email']), `Contacts in Salesforce for ${p.row['Email']}`).toBe(1);
      });
      const f = await fx.salesforceContacts.contactFields(p.row['Email']);
      expect(f.name, 'Contact Name').toContain(fullName(p.row));
      expect(f.email, 'Contact Email').toBe(p.row['Email']);
      record('Contact', `Title "${f.title}", Department "${f.department}" (prospect "${p.row['Department']}"), Phone "${f.phone}" (prospect "${p.row['Phone Number']}"), Other address "${f.otherAddress}"`);
      record('Leads for the email', String(await fx.salesforceLeads.countByEmail(p.row['Email'])));
    });
  });

  test('Create a Contact in Salesforce > 2: a Contact with the same email exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Contact in Salesforce > 2');
    await contactFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createContact }]);
    const result = await send(fx, p);
    await test.step('Record the Contacts for the shared email', async () => {
      const count = await describeContact(fx, p, 'Same email');
      record('Result', `Logs ${result.status}, ${count} Contact(s); created with Phone "${LEGACY.phone}", Department "${LEGACY.department}"`);
    });
    reachedFinalStatus(result);
  });

  test('Create a Contact in Salesforce > 3: a Lead exists, no Contact', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Contact in Salesforce > 3');
    await leadFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createContact }]);
    const result = await send(fx, p);
    await test.step('Record the Contact and the Lead', async () => {
      const contacts = await describeContact(fx, p, 'After the send');
      const leads = await describeLead(fx, p, 'After the send');
      record('Result', `Logs ${result.status}, ${contacts} Contact(s), ${leads} Lead(s)`);
    });
    reachedFinalStatus(result);
  });

  // ================= Update a Contact in Salesforce =================

  test('Update a Contact in Salesforce > 1: Contact exists with different Phone and Department', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update a Contact in Salesforce > 1');
    await contactFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateContact }]);
    const result = await send(fx, p);
    await test.step('Record the Contact after the send', async () => {
      const count = await describeContact(fx, p, 'After Update a Contact');
      record('Result', `Logs ${result.status}, ${count} Contact(s); created with Phone "${LEGACY.phone}", Department "${LEGACY.department}"`);
    });
    reachedFinalStatus(result);
  });

  test('Update a Contact in Salesforce > 2: no Contact with the email', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateContact }]);
    const p = prospect('Update a Contact in Salesforce > 2');
    const result = await send(fx, p);
    await test.step('Record whether a Contact was created', async () => {
      const count = await fx.salesforceContacts.countByEmail(p.row['Email']);
      record('Result', `Logs ${result.status}, ${count} Contact(s)`);
    });
    reachedFinalStatus(result);
  });

  // ================= Create an Account in Salesforce =================

  test('Create an Account in Salesforce > 1: new Company, no such Account', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createAccount }]);
    const p = prospect('Create an Account in Salesforce > 1');
    const before = await fx.salesforceAccounts.countByName(p.row['Company']);
    const result = await send(fx, p);
    await test.step('Record the Account', async () => {
      const after = await describeAccount(fx, p, 'After the send');
      record('Result', `Logs ${result.status}; Accounts named "${p.row['Company']}": ${before} before, ${after} after`);
    });
    reachedFinalStatus(result);
  });

  test('Create an Account in Salesforce > 2: an Account with the Company name exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create an Account in Salesforce > 2');
    await accountFirst(fx, p);
    const before = await fx.salesforceAccounts.countByName(p.row['Company']);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createAccount }]);
    const result = await send(fx, p);
    await test.step('Record the Accounts after the send', async () => {
      const after = await describeAccount(fx, p, 'After the send');
      record('Result', `Logs ${result.status}; Accounts named "${p.row['Company']}": ${before} before, ${after} after`);
    });
    reachedFinalStatus(result);
  });

  test('Create an Account in Salesforce > 3: prospect Company empty', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createAccount }]);
    const p = prospect('Create an Account in Salesforce > 3');
    const result = await send(fx, p);
    // An Account without a name cannot be found by name; the Logs status is the result.
    record('Result', `Logs ${result.status}`);
    reachedFinalStatus(result);
  });

  // ================= Update an Account in Salesforce =================

  test('Update an Account in Salesforce > 1: Account exists with a different City', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update an Account in Salesforce > 1');
    await accountFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateAccount }]);
    const result = await send(fx, p);
    await test.step('Record the Account after the send', async () => {
      const count = await describeAccount(fx, p, 'After Update an Account');
      record('Result', `Logs ${result.status}, ${count} Account(s); created with Billing City "${LEGACY.city}", Phone "${LEGACY.phone}"`);
    });
    reachedFinalStatus(result);
  });

  test('Update an Account in Salesforce > 2: no Account matches the Company', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateAccount }]);
    const p = prospect('Update an Account in Salesforce > 2');
    const before = await fx.salesforceAccounts.countByName(p.row['Company']);
    const result = await send(fx, p);
    await test.step('Record whether an Account was created', async () => {
      const after = await fx.salesforceAccounts.countByName(p.row['Company']);
      record('Result', `Logs ${result.status}; Accounts named "${p.row['Company']}": ${before} before, ${after} after`);
    });
    reachedFinalStatus(result);
  });

  // ================= Create a Opportunity in Salesforce =================

  const P = 'Create a Opportunity in Salesforce';
  const U = 'Update a Opportunity in Salesforce';

  test('Create a Opportunity in Salesforce > 1: Contact exists, no Opportunity', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect(`${P} > 1`);
    await contactFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createOpp, opportunity: PROSPECTING }]);
    const result = await send(fx, p);
    await test.step('Record the Opportunity and the Contact', async () => {
      record('Result', `Logs ${result.status}; today is ${new Date().toISOString().slice(0, 10)}`);
      await describeOpportunity(fx, p, 'Stage Prospecting, 0 Days');
      await describeContact(fx, p, 'Contact');
    });
    reachedFinalStatus(result);
  });

  test('Create a Opportunity in Salesforce > 2: Contact not in Salesforce', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createOpp, opportunity: PROSPECTING }]);
    const p = prospect(`${P} > 2`);
    const result = await send(fx, p);
    await test.step('Record the Opportunity, Contact and Lead', async () => {
      record('Result', `Logs ${result.status}`);
      await describeOpportunity(fx, p, 'No Contact beforehand');
      await describeContact(fx, p, 'Contact');
      await describeLead(fx, p, 'Lead');
    });
    reachedFinalStatus(result);
  });

  test('Create a Opportunity in Salesforce > 3: Contact already has 1 Opportunity', async ({ fx }) => {
    test.setTimeout(minutes(2));
    const p = prospect(`${P} > 3`);
    await contactFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createOpp, opportunity: PROSPECTING }]);
    // Step 1 creates the first Opportunity; step 2 of the same prospect is the send
    // under test (the email can be added to Saleshandy only once).
    const first = await send(fx, p);
    expect(first.status, 'Logs status of step 1, which creates the first Opportunity').toBe('Success');
    const second = await send(fx, p, 2);
    await test.step('Record the Opportunities and the Contact after step 2', async () => {
      record('Result', `Logs ${second.status}`);
      const last = p.row['Last Name'];
      record(`Opportunity rows matching "${last}"`, (await fx.salesforceOpportunities.rowTexts(last)).join(' || ') || '(none)');
      await describeContact(fx, p, 'Contact with 1 Opportunity beforehand');
    });
    reachedFinalStatus(second);
  });

  test('Create a Opportunity in Salesforce > 4: Closing date 1 Day, Deal Value 5000', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createOpp, opportunity: { stage: 'Prospecting', days: 1 } }]);
    const p = prospect(`${P} > 4`);
    const result = await send(fx, p);
    await test.step('Record the Opportunity Close Date and Amount', async () => {
      record('Result', `Logs ${result.status}; today is ${new Date().toISOString().slice(0, 10)}; Deal Value ${p.row['Deal Value']}`);
      await describeOpportunity(fx, p, 'Closing date 1 Day, Deal Value');
    });
    reachedFinalStatus(result);
  });

  test('Create a Opportunity in Salesforce > 5: Extra Configuration saved with Stage empty', async ({ fx }) => {
    test.setTimeout(minutes(1));
    // Saved with Closing date and Stage left empty (the dialog saves empty, confirmed 2026-10-19).
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createOpp }]);
    const p = prospect(`${P} > 5`);
    const result = await send(fx, p);
    await test.step('Record the Opportunity', async () => {
      record('Result', `Logs ${result.status}`);
      await describeOpportunity(fx, p, 'Stage empty');
    });
    reachedFinalStatus(result);
  });

  // ================= Update a Opportunity in Salesforce =================

  test('Update a Opportunity in Salesforce > 1: Contact has 1 Opportunity', async ({ fx }) => {
    test.setTimeout(minutes(2));
    const p = prospect(`${U} > 1`);
    await contactFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createOpp, opportunity: PROSPECTING }]);
    // Step 1 creates the Opportunity; step 2 of the same prospect updates it
    // (the email can be added to Saleshandy only once).
    const created = await send(fx, p);
    expect(created.status, 'Logs status of step 1, which creates the Opportunity').toBe('Success');
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateOpp, opportunity: QUALIFICATION }]);
    const result = await send(fx, p, 2);
    await test.step('Record the Opportunity after the update', async () => {
      record('Result', `Logs ${result.status}; created as Prospecting, updated to Qualification with 2 days`);
      await describeOpportunity(fx, p, 'After Update');
    });
    reachedFinalStatus(result);
  });

  // The 3 Opportunities cannot come from one prospect: the sequence has 2 steps, and an
  // Opportunity made by hand needs its link to the Contact, which the product does not
  // document.
  // TODO(needs-input): QA to decide how to build "Contact has 3 Opportunities".
  test.skip('Update a Opportunity in Salesforce > 2: Contact has 3 Opportunities', async () => {});

  test('Update a Opportunity in Salesforce > 3: Contact has 0 Opportunities', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect(`${U} > 3`);
    await contactFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateOpp, opportunity: QUALIFICATION }]);
    const result = await send(fx, p);
    await test.step('Record that no Opportunity exists for the Contact', async () => {
      record('Result', `Logs ${result.status}`);
      await describeOpportunity(fx, p, 'Contact with 0 Opportunities');
      await describeContact(fx, p, 'Contact');
    });
    reachedFinalStatus(result);
  });

  // ================= Attach Note in Salesforce =================

  test('Attach Note in Salesforce > 1: selected alone, Contact exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Attach Note in Salesforce > 1');
    await contactFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.note }]);
    const result = await send(fx, p);
    await test.step('Record the Contact and its Notes', async () => {
      record('Result', `Logs ${result.status}`);
      await describeContact(fx, p, 'Attach Note alone');
    });
    reachedFinalStatus(result);
  });

  test('Attach Note in Salesforce > 2: with Create a Contact, new prospect', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createContact }, { name: A.note }]);
    const p = prospect('Attach Note in Salesforce > 2');
    const result = await send(fx, p);
    await test.step('Record the Contact and the Note (Step, Variant, Prospect Outcome)', async () => {
      record('Result', `Logs ${result.status}`);
      await describeContact(fx, p, 'Create a Contact + Attach Note');
    });
    reachedFinalStatus(result);
  });

  test('Attach Note in Salesforce > 3: same prospect, step 2', async ({ fx }) => {
    test.setTimeout(minutes(2));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createContact }, { name: A.note }]);
    const p = prospect('Attach Note in Salesforce > 3');
    const first = await send(fx, p);
    const second = await send(fx, p, 2);
    await test.step('Record the Notes on the Contact after step 2', async () => {
      record('Step 1 Logs status', first.status);
      record('Step 2 Logs status', second.status);
      await describeContact(fx, p, 'After step 2');
    });
    reachedFinalStatus(second);
  });

  // ================= Record(log) an Email Activity in Salesforce =================

  test('Record(log) an Email Activity > 1: selected alone, no object ticked', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Record(log) an Email Activity in Salesforce > 1');
    await contactFirst(fx, p);
    // No object ticked in "Select Object" (saves fine, confirmed 2026-10-19).
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.record }]);
    const result = await send(fx, p);
    await test.step('Record the Contact timeline', async () => {
      record('Result', `Logs ${result.status}`);
      await describeContact(fx, p, 'Record alone');
    });
    reachedFinalStatus(result);
  });

  test('Record(log) an Email Activity > 2: Contact ticked with Update a Contact', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Record(log) an Email Activity in Salesforce > 2');
    await contactFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateContact }, { name: A.record, objects: ['Contact'] }]);
    const result = await send(fx, p);
    await test.step('Record the Contact timeline (From, To, Subject, body)', async () => {
      record('Result', `Logs ${result.status}`);
      await describeContact(fx, p, 'Update a Contact + Record');
    });
    reachedFinalStatus(result);
  });

  test('Record(log) an Email Activity > 3: Lead ticked with Update a Lead', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Record(log) an Email Activity in Salesforce > 3');
    await leadFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateLead }, { name: A.record, objects: ['Lead'] }]);
    const result = await send(fx, p);
    await test.step('Record the Lead and its timeline', async () => {
      record('Result', `Logs ${result.status}`);
      await describeLead(fx, p, 'Update a Lead + Record', true);
    });
    reachedFinalStatus(result);
  });

  test('Record(log) an Email Activity > 4: Opportunity and Contact ticked with Create a Opportunity', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Record(log) an Email Activity in Salesforce > 4');
    await contactFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [
      { name: A.createOpp, opportunity: PROSPECTING },
      { name: A.record, objects: ['Opportunity', 'Contact'] },
    ]);
    const result = await send(fx, p);
    await test.step('Record the Opportunity and the Contact timeline', async () => {
      record('Result', `Logs ${result.status}`);
      await describeOpportunity(fx, p, 'Create + Record');
      await describeContact(fx, p, 'Contact');
    });
    reachedFinalStatus(result);
  });
});
