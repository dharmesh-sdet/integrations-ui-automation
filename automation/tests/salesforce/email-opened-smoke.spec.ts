// Production smoke test: Sequence Email is Opened in Saleshandy, Salesforce (AL-4135, fix AL-4168).
// Checklist: notes/production-testing/23-salesforce-email-opened.md (approved by QA 2026-11-04, 11 checks:
// 10 with a send, one per activity, and the AL-4168 field check). Each check follows the staging row of the
// same activity in tests/salesforce/email-opened.spec.ts (QA approved those rows 2026-11-04).
// Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts) and the Salesforce
//    org is the same dev org (saleshandy-dev-ed);
//  - the sequence comes from SMOKE_SEQUENCE_ID, nothing production is hard-coded;
//  - production counts a first open only 60 s after the send (developer, 2026-10-15), so the runner sets
//    OPEN_AFTER_MS=60000 and OPEN_COUNT_TIMEOUT_MS (src/flows/salesforce-email-opened.ts);
//  - every check is pass/fail, a Logs Error is a failure to read, not an assumption (QA decides);
//  - after a trigger is saved the page is reloaded and the saved activities are read back, and the check
//    stops before any send when "Email Sent from Saleshandy" or "Link is Clicked in Saleshandy" is on.
// A failure whose message starts with "PRODUCT:" is a product finding for QA; any other failure is the
// script or the setup. The checks do not delete what they create.
//
// Run through scripts/run-salesforce-email-opened-smoke.sh (npm run smoke:salesforce-email-opened), which runs
// the gate first. Pair run with Reply Received: npm run smoke:salesforce-pair. Needs, once:
//   npm run login:saleshandy -- emailopenedprod
//   npm run login:salesforce -- emailopenedprod
// Data: test-data/salesforce/email-opened-smoke.csv (scripts/make-salesforce-email-opened-smoke-data.ts).
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { openAndReadLog, TRIGGER, type OpenResult } from '../../src/flows/salesforce-email-opened.ts';
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

// Other smoke runs share emailopenedprod, so saving a trigger leaves the other triggers as they are.
process.env.KEEP_OTHER_TRIGGERS ??= '1';

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

test.use({ account: 'emailopenedprod', actionTimeout: 30_000 });

const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '';
const CSV = 'salesforce/email-opened-smoke.csv';
const SIBLING_TRIGGERS = ['Email Sent from Saleshandy', 'Link is Clicked in Saleshandy'];

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

const CREATE_OPP = { stage: 'Prospecting', days: 7 };
const UPDATE_OPP = { stage: 'Qualification', days: 14 };

// What a record already holds before the open, so a change by the workflow is visible.
const PRE = { company: 'Brightpath Logistics', title: 'Operations Manager', phone: '+1 555-0100-4821', department: 'Operations', city: 'Austin' };

// One check = a trigger save, records made by hand, Send now, 60 s wait, the open, the 1 to 3 min Logs wait.
const ROW_TIMEOUT = 14 * 60_000;

const product = <T>(value: T, what: string) => expect(value, `PRODUCT: ${what}`);
const digits = (text: string) => text.replace(/\D/g, '');

type Prospect = { row: Row; used: string };

// The Scenario column holds "Smoke > <#>".
function prospect(n: number): Prospect {
  const scenario = `Smoke > ${n}`;
  const row = readCsv(CSV).find((r) => r['Scenario'] === scenario);
  if (!row) throw new Error(`No row "${scenario}" in test-data/${CSV}. Run scripts/make-salesforce-email-opened-smoke-data.ts.`);
  return { row, used: row['Email'] };
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

// Saves the trigger with the check's activities, reloads the page and reads the saved activities back.
// Stops before any send when Email Sent or Link is Clicked is on: a send would create the record first,
// and a link click also counts as an open.
async function useTrigger(fx: Fx, activities: Parameters<SalesforceEmailSentPage['configureTrigger']>[1]): Promise<void> {
  await fx.salesforceEmailSent.configureTrigger(TRIGGER, activities);
  await test.step('Reload and read the saved trigger back', async () => {
    await fx.salesforceEmailSent.page.reload();
    await fx.salesforceEmailSent.openTriggers();
    expect(await fx.salesforceEmailSent.isTriggerOn(TRIGGER), `"${TRIGGER}" is on after the reload`).toBe(true);
    expect([...(await fx.salesforceEmailSent.selectedActivities(TRIGGER))].sort(), 'Saved activities after the reload').toEqual(activities.map((a) => a.name).sort());
    for (const sibling of SIBLING_TRIGGERS) {
      expect(await fx.salesforceEmailSent.isTriggerOn(sibling), `"${sibling}" is on. Turn it off and run again. No send was made.`).toBe(false);
    }
  });
}

function open(fx: Fx, p: Prospect): Promise<OpenResult> {
  if (!SEQUENCE_ID) throw new Error('SMOKE_SEQUENCE_ID is not set. Use scripts/run-salesforce-email-opened-smoke.sh.');
  return openAndReadLog(
    { salesforceIntegration: fx.salesforceEmailSent, saleshandySequence: fx.saleshandySequence, mailinator: fx.mailinator },
    { sequenceId: SEQUENCE_ID, row: p.row, csv: CSV, usedEmail: p.used },
  );
}

// The Logs entry must be Success. An Error goes to QA (not assumed a script failure).
function logSuccess(result: OpenResult): void {
  product(result.opened, 'Opened count did not reach 1').toBeGreaterThanOrEqual(1);
  product(result.status, `Logs status is ${result.status}: ${result.logRow}`).toBe('Success');
}

async function leadFirst(fx: Fx, p: Prospect): Promise<void> {
  await test.step(`Create the Lead in Salesforce for ${p.row['Email']}`, async () => {
    markUsed(CSV, p.used);
    await fx.salesforceLeads.createLead({ firstName: p.row['First Name'], lastName: p.row['Last Name'], email: p.row['Email'], company: PRE.company, title: PRE.title, phone: PRE.phone });
  });
}

async function contactFirst(fx: Fx, p: Prospect): Promise<void> {
  await test.step(`Create the Contact in Salesforce for ${p.row['Email']}`, async () => {
    markUsed(CSV, p.used);
    await fx.salesforceContacts.createContact({ firstName: p.row['First Name'], lastName: p.row['Last Name'], email: p.row['Email'], phone: PRE.phone, department: PRE.department });
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

async function saveMapping(fx: Fx): Promise<void> {
  let saved = false;
  for (let attempt = 1; attempt <= 3 && !saved; attempt++) {
    saved = await fx.salesforceEmailSent.trySaveMapping();
    if (!saved && attempt < 3) await fx.salesforceEmailSent.page.waitForTimeout(5_000);
  }
  expect(saved, 'Opportunity mapping saved').toBe(true);
}

test.describe('Sequence Email is Opened in Saleshandy: Salesforce production smoke', () => {
  test.setTimeout(ROW_TIMEOUT);

  // 1. Create a Lead (baseline)
  test('Check 1: Create a Lead, new prospect with an apostrophe in the last name (baseline)', async ({ fx }) => {
    const p = prospect(1);
    await useTrigger(fx, [{ name: A.createLead }]);
    const result = await open(fx, p);
    expect(result.opened, 'Opened count after the first open').toBe(1);
    logSuccess(result);
    await untilPasses('the Lead appears in Salesforce', async () => {
      expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(1);
    });
    const f = await fx.salesforceLeads.leadFields(p.row['Email']);
    expect(f.name, 'Lead Name').toBe(fullName(p.row));
    expect(f.company, 'Lead Company').toBe(p.row['Company']);
    expect(f.title, 'Lead Title').toBe(p.row['Job Title']);
    expect(digits(f.phone), 'Lead Phone').toBe(digits(p.row['Phone Number']));
    expect(f.address, 'Lead address has the City').toContain(p.row['City']);
    expect(f.status, 'Lead Status').toBe('Open - Not Contacted');
  });

  // 2. Update a Lead
  test('Check 2: Update a Lead, Lead exists with an old Job Title, Phone and Company', async ({ fx }) => {
    const p = prospect(2);
    await leadFirst(fx, p);
    await useTrigger(fx, [{ name: A.updateLead }]);
    const result = await open(fx, p);
    logSuccess(result);
    const f = await fx.salesforceLeads.leadFields(p.row['Email']);
    expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(1);
    product(f.title, 'Lead Title not updated with the prospect value').toBe(p.row['Job Title']);
    expect(f.company, 'Lead Company').toBe(p.row['Company']);
    expect(digits(f.phone), 'Lead Phone').toBe(digits(p.row['Phone Number']));
  });

  // 3. Create a Contact
  test('Check 3: Create a Contact, new prospect with phone, department and city', async ({ fx }) => {
    const p = prospect(3);
    await useTrigger(fx, [{ name: A.createContact }]);
    const result = await open(fx, p);
    logSuccess(result);
    await untilPasses('the Contact appears in Salesforce', async () => {
      await fx.salesforceContacts.openList();
      expect(await fx.salesforceContacts.countByEmail(p.row['Email']), `Contacts for ${p.row['Email']}`).toBe(1);
    });
    const f = await fx.salesforceContacts.contactFields(p.row['Email']);
    expect(f.name, 'Contact Name').toContain(fullName(p.row));
    expect(digits(f.phone), 'Business Phone').toBe(digits(p.row['Phone Number']));
    expect(f.department, 'Department').toBe(p.row['Department']);
    expect(f.otherAddress, 'Other address has the City').toContain(p.row['City']);
    expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(0);
  });

  // 4. Update a Contact
  test('Check 4: Update a Contact, Contact exists with an old Phone and Department', async ({ fx }) => {
    const p = prospect(4);
    await contactFirst(fx, p);
    await useTrigger(fx, [{ name: A.updateContact }]);
    const result = await open(fx, p);
    logSuccess(result);
    expect(await fx.salesforceContacts.countByEmail(p.row['Email']), `Contacts for ${p.row['Email']}`).toBe(1);
    const f = await fx.salesforceContacts.contactFields(p.row['Email']);
    product(f.department, 'Contact Department not updated with the prospect value').toBe(p.row['Department']);
    expect(digits(f.phone), 'Business Phone').toBe(digits(p.row['Phone Number']));
  });

  // 5. Create a Account
  test('Check 5: Create a Account, new prospect, no Account named like the prospect', async ({ fx }) => {
    const p = prospect(5);
    await useTrigger(fx, [{ name: A.createAccount }]);
    const before = await fx.salesforceAccounts.countByName(fullName(p.row));
    const result = await open(fx, p);
    logSuccess(result);
    await untilPasses('the Account appears in Salesforce', async () => {
      expect((await fx.salesforceAccounts.countByName(fullName(p.row))) - before, 'Accounts created').toBe(1);
    });
    const f = await fx.salesforceAccounts.accountFields(fullName(p.row));
    expect(f.billingAddress, 'Billing address has the City').toContain(p.row['City']);
    expect(f.billingAddress, 'Billing address has the State').toContain(p.row['State']);
    expect(f.billingAddress, 'Billing address has the Country').toContain(p.row['Country']);
    record('Account', `Billing address "${f.billingAddress}", Website "${f.website}"; prospect Website "${p.row['Website']}"`);
  });

  // 6. Update a Account
  test('Check 6: Update a Account, Account named like the prospect has an old Phone and City', async ({ fx }) => {
    const p = prospect(6);
    await accountFirst(fx, p);
    await useTrigger(fx, [{ name: A.updateAccount }]);
    const before = await fx.salesforceAccounts.countByName(fullName(p.row));
    const result = await open(fx, p);
    logSuccess(result);
    await untilPasses('the Account shows the prospect City', async () => {
      const f = await fx.salesforceAccounts.accountFields(fullName(p.row));
      expect(f.billingAddress, 'Billing address has the City').toContain(p.row['City']);
    });
    expect(await fx.salesforceAccounts.countByName(fullName(p.row)), 'Accounts with the name').toBe(before);
  });

  // Checks 7 and 8: Closing Date is unmapped around the Opportunity checks (dev kit: a mapped Closing Date gives a
  // format error). The Reply Received run maps it again at its end; this spec leaves the mapping as it finds it
  // after the unmap, so two runs in parallel never flip it back under each other.
  test('Opportunity checks: unmap Closing Date on the Opportunity mapping', async ({ fx }) => {
    await fx.salesforceEmailSent.openMapping('Opportunity');
    await fx.salesforceEmailSent.unmapField('Closing Date');
    await saveMapping(fx);
    await fx.salesforceEmailSent.openMapping('Opportunity');
    expect(await fx.salesforceEmailSent.mappedValue('Closing Date'), 'Closing Date after reload').toBe('Select');
  });

  // 7. Create a Opportunity
  test('Check 7: Create a Opportunity, Contact exists, Deal Value 12000, 7 days, Prospecting', async ({ fx }) => {
    const p = prospect(7);
    await contactFirst(fx, p);
    await useTrigger(fx, [{ name: A.createOpp, opportunity: CREATE_OPP }]);
    const result = await open(fx, p);
    logSuccess(result);
    await untilPasses('the Opportunity appears in Salesforce', async () => {
      expect((await fx.salesforceOpportunities.rowTexts(p.row['Email'])).length, `Opportunities for ${p.row['Email']}`).toBe(1);
    });
    const f = await fx.salesforceOpportunities.opportunityFields(p.row['Email']);
    expect(f.stage, 'Stage').toBe('Prospecting');
    expect(f.closeDate, 'Close Date is 7 days out').toContain(dayMonthYear(7));
    expect(f.amount, 'Amount').toContain('12,000');
    expect(await fx.salesforceContacts.countByEmail(p.row['Email']), `Contacts for ${p.row['Email']}`).toBe(1);
  });

  // 8. Update a Opportunity
  test('Check 8: Update a Opportunity, Contact has 3 Opportunities named with the email', async ({ fx }) => {
    const p = prospect(8);
    await contactFirst(fx, p);
    await test.step('Create 3 Opportunities on the Contact', async () => {
      for (const days of [10, 20, 30]) {
        await fx.salesforceContacts.newOpportunity(p.row['Email'], { name: p.row['Email'], stage: 'Prospecting', closeDate: dayMonthYear(days) });
      }
      expect((await fx.salesforceOpportunities.rowTexts(p.row['Email'])).length, `Opportunities for ${p.row['Email']} before the open`).toBe(3);
    });
    await useTrigger(fx, [{ name: A.updateOpp, opportunity: UPDATE_OPP }]);
    const result = await open(fx, p);
    logSuccess(result);
    await untilPasses('one Opportunity moves to Qualification', async () => {
      const rows = await fx.salesforceOpportunities.rowTexts(p.row['Email']);
      expect(rows.filter((r) => r.includes('Qualification')).length, 'Opportunities in Qualification').toBe(1);
    });
    const rows = await fx.salesforceOpportunities.rowTexts(p.row['Email']);
    expect(rows.length, `Opportunities for ${p.row['Email']}`).toBe(3);
    expect(rows.find((r) => r.includes('Qualification')), 'Close Date of the changed Opportunity').toContain(dayMonthYear(14));
  });

  // 9. Attach Note (with Create a Contact)
  test('Check 9: Attach Note with Create a Contact, new prospect', async ({ fx }) => {
    const p = prospect(9);
    await useTrigger(fx, [{ name: A.createContact }, { name: A.note }]);
    const result = await open(fx, p);
    logSuccess(result);
    await untilPasses('the Contact appears in Salesforce', async () => {
      await fx.salesforceContacts.openList();
      expect(await fx.salesforceContacts.countByEmail(p.row['Email']), `Contacts for ${p.row['Email']}`).toBe(1);
    });
    await fx.salesforceContacts.openRecord(p.row['Email']);
    let related = '';
    await untilPasses('the Contact shows one Note', async () => {
      await fx.salesforceContacts.page.reload();
      related = await tab(fx.salesforceContacts.page, 'Related');
      const count = related.match(/Notes(?: & Attachments)? \((\d+)\)/);
      expect(count ? Number(count[1]) : 0, 'Notes on the Contact').toBeGreaterThanOrEqual(1);
    });
    record('Contact Related tab (Note text for QA)', clip(related, 1200));
  });

  // 10. Record(log) an Email Activity
  test('Check 10: Record(log) an Email Activity, Select Object Contact, Contact exists', async ({ fx }) => {
    const p = prospect(10);
    await contactFirst(fx, p);
    await useTrigger(fx, [{ name: A.record, objects: ['Contact'] }]);
    const result = await open(fx, p);
    logSuccess(result);
    let activity = '';
    await untilPasses('the Contact Activity tab shows the logged email', async () => {
      await fx.salesforceContacts.openList();
      await fx.salesforceContacts.openRecord(p.row['Email']);
      await fx.salesforceContacts.page.locator('lightning-spinner').first().waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
      activity = await tab(fx.salesforceContacts.page, 'Activity');
      expect(activity, 'Contact Activity tab').toMatch(/email/i);
    });
    record('Contact Activity tab (Subject and body for QA)', clip(activity, 1200));
  });

  // 11. AL-4168: Closing date 0 is rejected in both Opportunity modals. No send.
  test('Check 11: Closing date 0 Days, Create and Update a Opportunity modals (AL-4168)', async ({ fx }) => {
    for (const activity of [A.createOpp, A.updateOpp]) {
      const state = await fx.salesforceEmailSent.zeroClosingDateState(TRIGGER, activity);
      record(`${activity}: Closing date field`, state.invalid);
      product(state.saveDisabled, `${activity}: Save is enabled with Closing date 0 Days (AL-4168)`).toBe(true);
    }
  });
});
