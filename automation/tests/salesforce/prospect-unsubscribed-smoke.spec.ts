// Production smoke test: Prospect is Unsubscribed in Saleshandy, Salesforce (AL-4137, fix AL-4168).
// Checklist: notes/production-testing/26-salesforce-prospect-unsubscribed.md (approved by QA 2026-11-05, 9 checks:
// checks 1 to 8 send step 1 and unsubscribe by the real link, check 9 is the AL-4168 field check, no send).
// Each check follows the staging row of the same activity in tests/salesforce/prospect-unsubscribed.spec.ts (30 of 30
// passed at least once on 2026-11-05). Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts) and the Salesforce
//    org is the same dev org (saleshandy-dev-ed);
//  - the sequence comes from SMOKE_SEQUENCE_ID, nothing production is hard-coded;
//  - the Logs tab is never opened (QA, 2026-11-05). A record still missing after 3 minutes fails the check with
//    "Report to QA", and QA decides if it is a bug;
//  - after a trigger is saved the page is reloaded and the saved activities are read back, and the check stops
//    before any send when Email Sent, Email Opened or Link Clicked is on. Other triggers (for example Email is
//    Bounced in a parallel run) are left as they are (KEEP_OTHER_TRIGGERS).
// A failure whose message starts with "PRODUCT:" is a product finding for QA; any other failure is the script
// or the setup. The checks do not delete what they create.
//
// Run through scripts/run-salesforce-prospect-unsubscribed-smoke.sh (npm run smoke:salesforce-prospect-unsubscribed),
// which runs the gate first. Needs, once:
//   npm run login:saleshandy -- emailopenedprod
//   npm run login:salesforce -- emailopenedprod
// Data: test-data/salesforce/prospect-unsubscribed-smoke.csv (scripts/make-salesforce-prospect-unsubscribed-smoke-data.ts).
process.env.KEEP_OTHER_TRIGGERS ??= '1';

import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { recordAppears, sendAndUnsubscribeByLink, TRIGGER } from '../../src/flows/salesforce-prospect-unsubscribed.ts';
import { EMAIL_SENT_TRIGGER, OPENED_TRIGGER, TRIGGER as LINK_CLICKED_TRIGGER } from '../../src/flows/salesforce-link-clicked.ts';
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

test.use({ account: 'emailopenedprod', actionTimeout: 30_000 });

const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '';
const CSV = 'salesforce/prospect-unsubscribed-smoke.csv';
const SIBLING_TRIGGERS = [EMAIL_SENT_TRIGGER, OPENED_TRIGGER, LINK_CLICKED_TRIGGER];

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
} as const;

const CREATE_OPP = { stage: 'Prospecting', days: 7 };
const UPDATE_OPP = { stage: 'Qualification', days: 14 };

// What a record already holds before the unsubscribe, so a change by the workflow is visible.
const PRE = { company: 'Brightpath Logistics', title: 'Operations Manager', phone: '+1 555-0100-4821', department: 'Operations', city: 'Austin' };

// One check = Send now (a sender gap of 40 to 50 s) + the 93 s link wait + the status wait + the record wait.
const CHECK_TIMEOUT = 10 * 60_000;

const product = <T>(value: T, what: string) => expect(value, `PRODUCT: ${what}`);
const digits = (text: string) => text.replace(/\D/g, '');

type Prospect = { row: Row; used: string };

// The Scenario column holds "Smoke > <#>".
function prospect(n: number): Prospect {
  const scenario = `Smoke > ${n}`;
  const row = readCsv(CSV).find((r) => r['Scenario'] === scenario);
  if (!row) throw new Error(`No row "${scenario}" in test-data/${CSV}. Run scripts/make-salesforce-prospect-unsubscribed-smoke-data.ts.`);
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
// Stops before any send when another trigger is on: a send would run Email Sent, and an open or a click would run its own trigger.
async function useTrigger(fx: Fx, activities: Parameters<SalesforceEmailSentPage['configureTrigger']>[1]): Promise<void> {
  await fx.salesforceEmailSent.configureTrigger(TRIGGER, activities);
  await test.step('Reload and read the saved trigger back', async () => {
    await fx.salesforceEmailSent.page.reload();
    await fx.salesforceEmailSent.openTriggers();
    expect(await fx.salesforceEmailSent.isTriggerOn(TRIGGER), `"${TRIGGER}" is on after the reload`).toBe(true);
    expect([...(await fx.salesforceEmailSent.selectedActivities(TRIGGER))].sort(), 'Saved activities after the reload').toEqual(activities.map((a) => a.name).sort());
    for (const sibling of SIBLING_TRIGGERS) {
      expect(await fx.salesforceEmailSent.isTriggerOn(sibling), `"${sibling}" is on. Turn it off and run again. No email was sent.`).toBe(false);
    }
  });
}

// Add the prospect, Send now on step 1, open the real "Unsubscribe here" link and read Unsubscribed on the Prospects tab.
async function unsubscribe(fx: Fx, p: Prospect): Promise<void> {
  if (!SEQUENCE_ID) throw new Error('SMOKE_SEQUENCE_ID is not set. Use scripts/run-salesforce-prospect-unsubscribed-smoke.sh.');
  await sendAndUnsubscribeByLink({ saleshandySequence: fx.saleshandySequence, mailinator: fx.mailinator }, { sequenceId: SEQUENCE_ID, row: p.row, csv: CSV });
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

test.describe('Prospect is Unsubscribed in Saleshandy: Salesforce production smoke', () => {
  test.setTimeout(CHECK_TIMEOUT);

  // 1. Create a Lead (baseline)
  test('Check 1: Create a Lead, new prospect with an apostrophe in the last name (baseline)', async ({ fx }) => {
    const p = prospect(1);
    await useTrigger(fx, [{ name: A.createLead }]);
    await unsubscribe(fx, p);
    await recordAppears('the Lead', async () => {
      expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(1);
    });
    const f = await fx.salesforceLeads.leadFields(p.row['Email']);
    expect(f.name, 'Lead Name').toBe(fullName(p.row));
    expect(f.email, 'Lead Email').toBe(p.row['Email']);
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
    await unsubscribe(fx, p);
    await recordAppears('the Lead update (Title)', async () => {
      expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(1);
      const f = await fx.salesforceLeads.leadFields(p.row['Email']);
      product(f.title, 'Lead Title not updated with the prospect value').toBe(p.row['Job Title']);
    });
    const f = await fx.salesforceLeads.leadFields(p.row['Email']);
    expect(f.company, 'Lead Company').toBe(p.row['Company']);
    expect(digits(f.phone), 'Lead Phone').toBe(digits(p.row['Phone Number']));
  });

  // 3. Create a Contact + Attach Note
  test('Check 3: Create a Contact + Attach Note, new prospect with phone, department and city', async ({ fx }) => {
    const p = prospect(3);
    await useTrigger(fx, [{ name: A.createContact }, { name: A.note }]);
    await unsubscribe(fx, p);
    await recordAppears('the Contact', async () => {
      await fx.salesforceContacts.openList();
      expect(await fx.salesforceContacts.countByEmail(p.row['Email']), `Contacts for ${p.row['Email']}`).toBe(1);
    });
    const f = await fx.salesforceContacts.contactFields(p.row['Email']);
    expect(f.name, 'Contact Name').toContain(fullName(p.row));
    expect(digits(f.phone), 'Business Phone').toBe(digits(p.row['Phone Number']));
    expect(f.department, 'Department').toBe(p.row['Department']);
    expect(f.otherAddress, 'Other address has the City').toContain(p.row['City']);
    expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(0);
    await fx.salesforceContacts.openRecord(p.row['Email']);
    let related = '';
    await recordAppears('the Note on the Contact', async () => {
      await fx.salesforceContacts.page.reload();
      related = await tab(fx.salesforceContacts.page, 'Related');
      const count = related.match(/Notes(?: & Attachments)? \((\d+)\)/);
      expect(count ? Number(count[1]) : 0, 'Notes on the Contact').toBeGreaterThanOrEqual(1);
    });
    const activity = await tab(fx.salesforceContacts.page, 'Activity');
    record('Contact Activity tab (Note text for QA)', clip(activity, 1200));
    record('Contact Related tab (Note text for QA)', clip(related, 1200));
  });

  // 4. Update a Contact
  test('Check 4: Update a Contact, Contact exists with an old Phone and Department', async ({ fx }) => {
    const p = prospect(4);
    await contactFirst(fx, p);
    await useTrigger(fx, [{ name: A.updateContact }]);
    await unsubscribe(fx, p);
    await recordAppears('the Contact update (Department)', async () => {
      expect(await fx.salesforceContacts.countByEmail(p.row['Email']), `Contacts for ${p.row['Email']}`).toBe(1);
      const f = await fx.salesforceContacts.contactFields(p.row['Email']);
      product(f.department, 'Contact Department not updated with the prospect value').toBe(p.row['Department']);
    });
    const f = await fx.salesforceContacts.contactFields(p.row['Email']);
    expect(digits(f.phone), 'Business Phone').toBe(digits(p.row['Phone Number']));
  });

  // 5. Create a Account
  test('Check 5: Create a Account, new prospect, no Account named like the prospect', async ({ fx }) => {
    const p = prospect(5);
    await useTrigger(fx, [{ name: A.createAccount }]);
    const before = await fx.salesforceAccounts.countByName(fullName(p.row));
    await unsubscribe(fx, p);
    await recordAppears('the Account', async () => {
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
    await unsubscribe(fx, p);
    await recordAppears('the Account update (Billing City)', async () => {
      const f = await fx.salesforceAccounts.accountFields(fullName(p.row));
      expect(f.billingAddress, 'Billing address has the City').toContain(p.row['City']);
    });
    expect(await fx.salesforceAccounts.countByName(fullName(p.row)), 'Accounts with the name').toBe(before);
  });

  // Checks 7 and 8: Closing Date is unmapped around the Opportunity checks (dev kit: a mapped Closing Date gives a
  // format error) and mapped to Close Date again right after them, so the next smoke gate finds the mapping complete.
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
    await unsubscribe(fx, p);
    await recordAppears('the Opportunity', async () => {
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
      expect((await fx.salesforceOpportunities.rowTexts(p.row['Email'])).length, `Opportunities for ${p.row['Email']} before the unsubscribe`).toBe(3);
    });
    await useTrigger(fx, [{ name: A.updateOpp, opportunity: UPDATE_OPP }]);
    await unsubscribe(fx, p);
    await recordAppears('one Opportunity moves to Qualification', async () => {
      const rows = await fx.salesforceOpportunities.rowTexts(p.row['Email']);
      expect(rows.filter((r) => r.includes('Qualification')).length, 'Opportunities in Qualification').toBe(1);
    });
    const rows = await fx.salesforceOpportunities.rowTexts(p.row['Email']);
    expect(rows.length, `Opportunities for ${p.row['Email']}`).toBe(3);
    expect(rows.find((r) => r.includes('Qualification')), 'Close Date of the changed Opportunity').toContain(dayMonthYear(14));
  });

  test('Opportunity checks: map Closing Date to Close Date again', async ({ fx }) => {
    await fx.salesforceEmailSent.openMapping('Opportunity');
    await fx.salesforceEmailSent.mapField('Closing Date', 'Close Date');
    await saveMapping(fx);
    await fx.salesforceEmailSent.openMapping('Opportunity');
    expect(await fx.salesforceEmailSent.mappedValue('Closing Date'), 'Closing Date after reload').toBe('Close Date');
  });

  // 9. AL-4168: Closing date 0 is rejected in both Opportunity modals. No send.
  test('Check 9: Closing date 0 Days, Create and Update a Opportunity modals (AL-4168)', async ({ fx }) => {
    // The check before leaves Update a Opportunity selected, and picking a selected activity opens no dialog: reset first.
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }]);
    for (const activity of [A.createOpp, A.updateOpp]) {
      const state = await fx.salesforceEmailSent.zeroClosingDateState(TRIGGER, activity);
      record(`${activity}: Closing date field`, state.invalid);
      product(state.saveDisabled, `${activity}: Save is enabled with Closing date 0 Days (AL-4168)`).toBe(true);
    }
  });
});
