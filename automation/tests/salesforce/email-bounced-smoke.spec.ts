// Production smoke test: Email is Bounced in Saleshandy, Salesforce (AL-4138, fix AL-4168).
// Checklist: notes/production-testing/25-salesforce-email-bounced.md (approved by QA 2026-11-05, 9 checks:
// check 1 is the only send (real bounce), checks 2 to 8 use Mark as bounced, check 9 is the AL-4168 field check).
// Each check follows the staging row of the same activity in tests/salesforce/email-bounced.spec.ts (34 rows, all
// passed at least once on 2026-11-05). Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts) and the Salesforce
//    org is the same dev org (saleshandy-dev-ed);
//  - the sequence comes from SMOKE_SEQUENCE_ID, nothing production is hard-coded;
//  - every check is pass/fail, a Logs Error is a failure to read, not an assumption (QA decides). Check 1 passes
//    when one of the Bounced Logs entries of the real bounce is Success (a second entry can be Error with
//    DUPLICATES_DETECTED, as on HubSpot);
//  - after a trigger is saved the page is reloaded and the saved activities are read back, and the check
//    stops before any bounce when another trigger is on.
// A failure whose message starts with "PRODUCT:" is a product finding for QA; any other failure is the
// script or the setup. The checks do not delete what they create.
//
// Run through scripts/run-salesforce-email-bounced-smoke.sh (npm run smoke:salesforce-email-bounced), which runs
// the gate first. Runs alone on emailopenedprod (QA, 2026-11-05). Needs, once:
//   npm run login:saleshandy -- emailopenedprod
//   npm run login:salesforce -- emailopenedprod
// Data: test-data/salesforce/email-bounced-smoke.csv (scripts/make-salesforce-email-bounced-smoke-data.ts).
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { bounceAndReadLog, realBounceEmail, TRIGGER, EMAIL_SENT_TRIGGER, type BounceResult } from '../../src/flows/salesforce-email-bounced.ts';
import { OPENED_TRIGGER, TRIGGER as LINK_CLICKED_TRIGGER } from '../../src/flows/salesforce-link-clicked.ts';
import { fullName } from '../../src/flows/saleshandy-to-salesforce.ts';
import { readRecordTab } from '../../src/pages/salesforce/object.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';
import type { Page } from '@playwright/test';
import type { SalesforceEmailSentPage } from '../../src/pages/saleshandy/salesforce-email-sent.page.ts';
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

const test = base.extend<{ fx: Fx }>({
  fx: async ({ salesforceEmailSent, saleshandySequence, salesforceLeads, salesforceContacts, salesforceAccounts, salesforceOpportunities }, use) =>
    use({ salesforceEmailSent, saleshandySequence, salesforceLeads, salesforceContacts, salesforceAccounts, salesforceOpportunities }),
});

test.use({ account: 'emailopenedprod', actionTimeout: 30_000 });

const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '';
const CSV = 'salesforce/email-bounced-smoke.csv';
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
  record: 'Record(log) an Email Activity in Salesforce',
} as const;

const CREATE_OPP = { stage: 'Prospecting', days: 7 };
const UPDATE_OPP = { stage: 'Qualification', days: 14 };

// What a record already holds before the bounce, so a change by the workflow is visible.
const PRE = { company: 'Brightpath Logistics', title: 'Operations Manager', phone: '+1 555-0100-4821', department: 'Operations', city: 'Austin' };

// A manual bounce = add the prospect, Mark as bounced, 15 s Logs wait and the Logs poll. The real bounce also
// sends (Send now), waits for Bounced and then 90 s for every Logs entry.
const MANUAL_TIMEOUT = 8 * 60_000;
const REAL_TIMEOUT = 16 * 60_000;

const product = <T>(value: T, what: string) => expect(value, `PRODUCT: ${what}`);
const digits = (text: string) => text.replace(/\D/g, '');

type Prospect = { row: Row; used: string };

// The Scenario column holds "Smoke > <#>". `real` swaps the email for name@<company>.mailinator.com, which
// bounces by itself. The CSV row is retired by the original email.
function prospect(n: number, real = false): Prospect {
  const scenario = `Smoke > ${n}`;
  const row = readCsv(CSV).find((r) => r['Scenario'] === scenario);
  if (!row) throw new Error(`No row "${scenario}" in test-data/${CSV}. Run scripts/make-salesforce-email-bounced-smoke-data.ts.`);
  return { row: real ? { ...row, Email: realBounceEmail(row) } : row, used: row['Email'] };
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
// Stops before any bounce when another trigger is on: a send would run Email Sent, and an open or a click
// would run its own trigger.
async function useTrigger(fx: Fx, activities: Parameters<SalesforceEmailSentPage['configureTrigger']>[1]): Promise<void> {
  await fx.salesforceEmailSent.configureTrigger(TRIGGER, activities);
  await test.step('Reload and read the saved trigger back', async () => {
    await fx.salesforceEmailSent.page.reload();
    await fx.salesforceEmailSent.openTriggers();
    expect(await fx.salesforceEmailSent.isTriggerOn(TRIGGER), `"${TRIGGER}" is on after the reload`).toBe(true);
    expect([...(await fx.salesforceEmailSent.selectedActivities(TRIGGER))].sort(), 'Saved activities after the reload').toEqual(activities.map((a) => a.name).sort());
    for (const sibling of SIBLING_TRIGGERS) {
      expect(await fx.salesforceEmailSent.isTriggerOn(sibling), `"${sibling}" is on. Turn it off and run again. No bounce was made.`).toBe(false);
    }
  });
}

function bounce(fx: Fx, p: Prospect, real = false): Promise<BounceResult> {
  if (!SEQUENCE_ID) throw new Error('SMOKE_SEQUENCE_ID is not set. Use scripts/run-salesforce-email-bounced-smoke.sh.');
  return bounceAndReadLog(
    { salesforceIntegration: fx.salesforceEmailSent, saleshandySequence: fx.saleshandySequence },
    { sequenceId: SEQUENCE_ID, row: p.row, csv: CSV, usedEmail: p.used, real },
  );
}

// The Logs entry must be Success. An Error goes to QA (not assumed a script failure).
function logSuccess(result: BounceResult): void {
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

test.describe('Email is Bounced in Saleshandy: Salesforce production smoke', () => {
  test.setTimeout(MANUAL_TIMEOUT);

  // 1. Create a Lead (baseline), the only send: a real bounce
  test('Check 1: Create a Lead, real bounce, new prospect with an apostrophe in the last name (baseline)', async ({ fx }) => {
    test.setTimeout(REAL_TIMEOUT);
    const p = prospect(1, true);
    await useTrigger(fx, [{ name: A.createLead }]);
    const result = await bounce(fx, p, true);
    record('Logs entries of the real bounce', `${result.newEntries} new, status ${result.status}: ${result.logRow}`);
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

  // 2. Update a Lead + Record(log) an Email Activity (Select Object Lead)
  test('Check 2: Update a Lead + Record(log) an Email Activity with Lead ticked, Lead exists with an old Job Title, Phone and Company', async ({ fx }) => {
    const p = prospect(2);
    await leadFirst(fx, p);
    await useTrigger(fx, [{ name: A.updateLead }, { name: A.record, objects: ['Lead'] }]);
    const result = await bounce(fx, p);
    logSuccess(result);
    expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(1);
    const f = await fx.salesforceLeads.leadFields(p.row['Email']);
    product(f.title, 'Lead Title not updated with the prospect value').toBe(p.row['Job Title']);
    expect(f.company, 'Lead Company').toBe(p.row['Company']);
    expect(digits(f.phone), 'Lead Phone').toBe(digits(p.row['Phone Number']));
    let activity = '';
    await untilPasses('the Lead Activity tab shows the logged email', async () => {
      await fx.salesforceLeads.leadFields(p.row['Email']);
      await fx.salesforceLeads.page.locator('lightning-spinner').first().waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
      activity = await tab(fx.salesforceLeads.page, 'Activity');
      expect(activity, 'Lead Activity tab').toMatch(/email/i);
    });
    record('Lead Activity tab (Subject and body for QA)', clip(activity, 1200));
  });

  // 3. Create a Contact + Attach Note
  test('Check 3: Create a Contact + Attach Note, new prospect with phone, department and city', async ({ fx }) => {
    const p = prospect(3);
    await useTrigger(fx, [{ name: A.createContact }, { name: A.note }]);
    const result = await bounce(fx, p);
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
    await fx.salesforceContacts.openRecord(p.row['Email']);
    let related = '';
    await untilPasses('the Contact shows one Note', async () => {
      await fx.salesforceContacts.page.reload();
      related = await tab(fx.salesforceContacts.page, 'Related');
      const count = related.match(/Notes(?: & Attachments)? \((\d+)\)/);
      expect(count ? Number(count[1]) : 0, 'Notes on the Contact').toBeGreaterThanOrEqual(1);
    });
    const activity = await tab(fx.salesforceContacts.page, 'Activity');
    record('Note shows "Bounce Reason"', String(`${activity} ${related}`.includes('Bounce Reason')));
    record('Contact Related tab (Note text for QA, Bounce Reason blank)', clip(related, 1200));
  });

  // 4. Update a Contact
  test('Check 4: Update a Contact, Contact exists with an old Phone and Department', async ({ fx }) => {
    const p = prospect(4);
    await contactFirst(fx, p);
    await useTrigger(fx, [{ name: A.updateContact }]);
    const result = await bounce(fx, p);
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
    const result = await bounce(fx, p);
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
    const result = await bounce(fx, p);
    logSuccess(result);
    await untilPasses('the Account shows the prospect City', async () => {
      const f = await fx.salesforceAccounts.accountFields(fullName(p.row));
      expect(f.billingAddress, 'Billing address has the City').toContain(p.row['City']);
    });
    expect(await fx.salesforceAccounts.countByName(fullName(p.row)), 'Accounts with the name').toBe(before);
  });

  // Checks 7 and 8: Closing Date is unmapped around the Opportunity checks (dev kit: a mapped Closing Date gives a
  // format error) and mapped to Close Date again right after them, so the next smoke gate finds the mapping
  // complete. This run is alone on the account (QA, 2026-11-05), so nothing flips it under another run.
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
    const result = await bounce(fx, p);
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
      expect((await fx.salesforceOpportunities.rowTexts(p.row['Email'])).length, `Opportunities for ${p.row['Email']} before the bounce`).toBe(3);
    });
    await useTrigger(fx, [{ name: A.updateOpp, opportunity: UPDATE_OPP }]);
    const result = await bounce(fx, p);
    logSuccess(result);
    await untilPasses('one Opportunity moves to Qualification', async () => {
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

  // 9. AL-4168: Closing date 0 is rejected in both Opportunity modals. No bounce.
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
