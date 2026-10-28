// Production smoke test: Email Sent from Saleshandy, Salesforce (AL-4132, fix AL-4168).
// Checklist: notes/production-testing/07-salesforce-email-sent.md (approved by QA 2026-10-22,
// 10 rows). Each test body follows the staging test with the same activity in
// tests/salesforce/email-sent.spec.ts (QA confirmed those rows by hand 2026-10-21).
// Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts) and the
//    Salesforce org is the same dev org (saleshandy-dev-ed);
//  - the sequence comes from SMOKE_SEQUENCE_ID, nothing production is hard-coded;
//  - rows are pass/fail (staging mostly recorded annotations). Only values the staging runs
//    showed as plain text are asserted; formatted ones (phone, timeline text) are recorded.
//  - Attach Note rides on Create a Contact and Create a Lead, Record(log) on Update a Contact
//    and Create a Opportunity, so 8 emails cover all 10 activities.
//
// Run through scripts/run-salesforce-email-sent-smoke.sh (npm run smoke:salesforce-email-sent),
// which runs the gate (tests/setup/salesforce-email-sent-prod-gate.spec.ts) first. Needs, once:
//   npm run login:saleshandy -- emailopenedprod    (already saved)
//   Salesforce (the dev org) logs in by itself through the API (src/utils/salesforce-login.ts)
// Data: test-data/salesforce/email-sent-smoke.csv (scripts/make-email-sent-smoke-data.ts).
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { fullName, sendAndReadLog, type SendResult } from '../../src/flows/saleshandy-to-salesforce.ts';
import { readRecordTab, type SalesforceObjectPage } from '../../src/pages/salesforce/object.page.ts';
import { LEGACY } from '../../src/pages/salesforce/salesforce.ts';
import { untilPasses } from '../../src/utils/wait.ts';
import type { Locator, Page } from '@playwright/test';
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

test.use({ account: 'emailopenedprod' });

const TRIGGER = 'Email Sent from Saleshandy';
const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '';
const CSV = 'salesforce/email-sent-smoke.csv';

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

const PROSPECTING = { stage: 'Prospecting', days: 1 };
const QUALIFICATION = { stage: 'Qualification', days: 2 };

// One send = Send now plus a Logs entry (about 2.5 min on staging); production may be slower.
const minutes = (sends: number): number => sends * 6 * 60_000;

type Prospect = { row: Row; used: string };

// The Scenario column holds the name of the staging row the smoke row is built from.
function prospect(scenario: string): Prospect {
  const row = readCsv(CSV).find((r) => r['Scenario'] === scenario);
  if (!row) throw new Error(`No row "${scenario}" in test-data/${CSV}. Run scripts/make-email-sent-smoke-data.ts.`);
  return { row, used: row['Email'] };
}

function send(fx: Fx, p: Prospect): Promise<SendResult> {
  if (!SEQUENCE_ID) throw new Error('SMOKE_SEQUENCE_ID is not set. Use scripts/run-salesforce-email-sent-smoke.sh.');
  return sendAndReadLog(
    { salesforceIntegration: fx.salesforceEmailSent, saleshandySequence: fx.saleshandySequence },
    { sequenceId: SEQUENCE_ID, trigger: TRIGGER, row: p.row, csv: CSV, usedEmail: p.used },
  );
}

const record = (type: string, description: string): void => {
  test.info().annotations.push({ type, description });
};

const clip = (text: string, max = 700): string => (text.length > max ? `${text.slice(0, max)}...` : text);

async function tab(page: Page, name: string): Promise<string> {
  return readRecordTab(page, name).catch(() => `(no "${name}" tab on this record)`);
}

// Records the smoke row needs before the send. Each uses the prospect's own email and a
// legacy value, so a change by the workflow is visible. markUsed retires the CSV row at once.
async function leadFirst(fx: Fx, p: Prospect): Promise<void> {
  await test.step(`Create the Lead in Salesforce for ${p.row['Email']}`, async () => {
    markUsed(CSV, p.used);
    await fx.salesforceLeads.createLead({
      firstName: p.row['First Name'],
      lastName: p.row['Last Name'],
      email: p.row['Email'],
      company: LEGACY.company,
      title: LEGACY.title,
      phone: LEGACY.phone,
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
  // Named like the prospect (First Name Last Name): Company is not mapped to Account Name (QA,
  // 2026-10-22), and the workflow looks the Account up by the prospect's full name.
  await test.step(`Create the Account "${fullName(p.row)}" in Salesforce`, async () => {
    markUsed(CSV, p.used);
    await fx.salesforceAccounts.createAccount({ name: fullName(p.row), billingCity: LEGACY.city, phone: LEGACY.phone });
  });
}

// DD/MM/YYYY, the way this org shows dates (22/10/2026).
function dayMonthYear(daysFromToday: number): string {
  const d = new Date(Date.now() + daysFromToday * 86_400_000);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// A record page shows grey placeholders and a spinner before its timeline loads (seen
// 2026-10-22: the Activity tab read "" right after the Contact page opened). Reopen the record
// and read the Activity tab until it shows the logged email.
async function expectLoggedEmail(object: SalesforceObjectPage, email: string, label: string): Promise<void> {
  let activity = '';
  await untilPasses(`the ${label} Activity tab shows the logged email`, async () => {
    await object.openList();
    await object.openRecord(email);
    await object.page.locator('lightning-spinner').first().waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
    activity = await tab(object.page, 'Activity');
    expect(activity, `${label} Activity tab`).toMatch(/email/i);
  });
  record(`${label} Activity tab`, clip(activity, 1200));
}

// "Notes & Attachments (1)" or "Notes (1)" on the Related tab; the count, or 0 when no list shows.
async function noteCount(page: Page): Promise<{ count: number; related: string }> {
  const related = await tab(page, 'Related');
  const match = related.match(/Notes(?: & Attachments)? \((\d+)\)/);
  return { count: match ? Number(match[1]) : 0, related };
}

// The Extra Configuration dialog rejects Closing date 0 (AL-4168): Save is disabled. The
// red highlight is recorded, not asserted, because its markup is not known yet.
async function expectZeroDaysBlocked(fx: Fx, activity: string): Promise<void> {
  const page = fx.salesforceEmailSent.page;
  await fx.salesforceEmailSent.openTriggers();
  // Chips are removed on the page only; nothing is saved, so the saved configuration stays.
  for (let i = 0; i < 10; i++) {
    const selected = await fx.salesforceEmailSent.selectedActivities(TRIGGER);
    if (!selected.length) break;
    await fx.salesforceEmailSent.removeActivity(TRIGGER, selected[0]);
  }
  await fx.salesforceEmailSent.enableOnly(TRIGGER);
  await fx.salesforceEmailSent.selectActivity(TRIGGER, activity);
  const dialog = page.getByRole('dialog').filter({ hasText: 'Extra Configuration' });
  await dialog.waitFor({ state: 'visible', timeout: 20_000 });
  const days: Locator = dialog.getByRole('spinbutton');
  await days.fill('0');
  await days.blur();
  await expect(dialog.getByRole('button', { name: 'Save', exact: true }), 'Save in the Extra Configuration modal with Closing date 0').toBeDisabled();
  const red = await days.evaluate((el) => {
    for (let node: Element | null = el, depth = 0; node && depth < 3; node = node.parentElement, depth++) {
      const s = getComputedStyle(node);
      const rgb = (s.borderColor.match(/\d+/g) ?? []).map(Number);
      if (rgb.length >= 3 && rgb[0] > 180 && rgb[1] < 100 && rgb[2] < 100) return true;
    }
    return false;
  });
  record('Closing date field highlighted red', String(red));
  // Close without saving: the activity is not added.
  await page.keyboard.press('Escape');
}

test.describe('Email Sent from Saleshandy, Salesforce (production smoke)', () => {
  // 1. Create a Account
  test('Create a Account in Salesforce > 1: new prospect, no Account named like the prospect', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createAccount }]);
    const p = prospect('Create an Account in Salesforce > 1');
    const before = await fx.salesforceAccounts.countByName(fullName(p.row));
    const result = await send(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('One more Account named like the prospect (First Name Last Name)', async () => {
      await untilPasses('the Account appears in Salesforce', async () => {
        expect(await fx.salesforceAccounts.countByName(fullName(p.row)), `Accounts named "${fullName(p.row)}"`).toBe(before + 1);
      });
      const f = await fx.salesforceAccounts.accountFields(fullName(p.row));
      expect(f.name, 'Account Name (the prospect First and Last Name)').toBe(fullName(p.row));
      record('Account', `Billing address "${f.billingAddress}", Website "${f.website}"; prospect City "${p.row['City']}", State "${p.row['State']}", Country "${p.row['Country']}", Website "${p.row['Company Website']}"`);
    });
  });

  // 2. Update a Account
  test('Update a Account in Salesforce > 1: Account exists with a different Phone and City', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update an Account in Salesforce > 1');
    await accountFirst(fx, p);
    const before = await fx.salesforceAccounts.countByName(fullName(p.row));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateAccount }]);
    const result = await send(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('Same number of Accounts; Billing address shows the prospect City', async () => {
      await untilPasses('the Account shows the prospect City', async () => {
        const addresses = await fx.salesforceAccounts.billingAddresses(fullName(p.row));
        expect(addresses.length, `Accounts named "${fullName(p.row)}"`).toBe(before);
        expect(addresses.join(' | '), 'Billing addresses').toContain(p.row['City']);
      });
      record('Phone', `${(await fx.salesforceAccounts.accountFields(fullName(p.row))).phone} (created with "${LEGACY.phone}", prospect "${p.row['Company Phone'] ?? ''}")`);
    });
  });

  // 3. Create a Contact + Attach Note
  test('Create a Contact in Salesforce > 1: new prospect, with Attach Note', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createContact }, { name: A.note }]);
    const p = prospect('Create a Contact in Salesforce > 1');
    const result = await send(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('One Contact with the prospect Name and Email; no Lead', async () => {
      await untilPasses('the Contact appears in Salesforce', async () => {
        await fx.salesforceContacts.openList();
        expect(await fx.salesforceContacts.countByEmail(p.row['Email']), `Contacts in Salesforce for ${p.row['Email']}`).toBe(1);
      });
      const f = await fx.salesforceContacts.contactFields(p.row['Email']);
      expect(f.name, 'Contact Name').toContain(fullName(p.row));
      expect(f.email, 'Contact Email').toBe(p.row['Email']);
      expect(f.department, 'Contact Department').toBe(p.row['Department']);
      expect(f.title, 'Contact Title (not mapped)').toBe('');
      record('Contact', `Phone "${f.phone}" (prospect "${p.row['Phone Number']}"), Other address "${f.otherAddress}"`);
      expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads in Salesforce for ${p.row['Email']}`).toBe(0);
    });
    await test.step('One Note on the Contact', async () => {
      await fx.salesforceContacts.openList();
      await fx.salesforceContacts.openRecord(p.row['Email']);
      const { count, related } = await noteCount(fx.salesforceContacts.page);
      record('Contact Related tab', clip(related, 1200));
      record('Note shows Step, Variant, Prospect Outcome', ['Step 1', 'Variant A', 'Prospect Outcome'].map((t) => `${t}: ${related.includes(t)}`).join(', '));
      expect(count, 'Notes on the Contact').toBe(1);
    });
  });

  // 4. Update a Contact + Record(log)
  test('Update a Contact in Salesforce > 1: Contact exists, with Record(log) an Email Activity', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update a Contact in Salesforce > 1');
    await contactFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateContact }, { name: A.record, objects: ['Contact'] }]);
    const result = await send(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('One Contact; Department shows the prospect value; the email is on the timeline', async () => {
      await untilPasses('the Contact shows the prospect Department', async () => {
        expect(await fx.salesforceContacts.countByEmail(p.row['Email']), `Contacts for ${p.row['Email']}`).toBe(1);
        const f = await fx.salesforceContacts.contactFields(p.row['Email']);
        expect(f.department, 'Contact Department').toBe(p.row['Department']);
        record('Contact', `Phone "${f.phone}" (created with "${LEGACY.phone}", prospect "${p.row['Phone Number']}")`);
      });
      await expectLoggedEmail(fx.salesforceContacts, p.row['Email'], 'Contact');
    });
  });

  // 5. Create a Lead + Attach Note
  test('Create a Lead in Salesforce > 1: new prospect, with Attach Note', async ({ fx }) => {
    test.setTimeout(minutes(1));
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.createLead }, { name: A.note }]);
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
    // The Lead page has no Related tab; where it lists the Note is not known yet, so the
    // Note is recorded, not asserted. QA reads it in the report.
    await test.step('Record the Note on the Lead', async () => {
      const activity = await tab(fx.salesforceLeads.page, 'Activity');
      const related = await tab(fx.salesforceLeads.page, 'Related');
      record('Lead Activity tab', clip(activity, 1200));
      record('Lead Related tab', clip(related, 1200));
      record('Note shows Step, Variant, Prospect Outcome', ['Step 1', 'Variant A', 'Prospect Outcome'].map((t) => `${t}: ${`${activity} ${related}`.includes(t)}`).join(', '));
    });
  });

  // 6. Update a Lead
  test('Update a Lead in Salesforce > 1: Lead exists with different Title, Phone and Company', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update a Lead in Salesforce > 1');
    await leadFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateLead }]);
    const result = await send(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('Still one Lead; Title and Company show the prospect values', async () => {
      await untilPasses('the Lead shows the prospect values', async () => {
        expect(await fx.salesforceLeads.countByEmail(p.row['Email']), `Leads for ${p.row['Email']}`).toBe(1);
        const f = await fx.salesforceLeads.leadFields(p.row['Email']);
        expect(f.title, 'Lead Title').toBe(p.row['Job Title']);
        expect(f.company, 'Lead Company').toBe(p.row['Company']);
        record('Lead', `Phone "${f.phone}" (created with "${LEGACY.phone}", prospect "${p.row['Phone Number']}")`);
      });
    });
  });

  // 7. Create a Opportunity + Record(log), Deal Value 5000
  test('Create a Opportunity in Salesforce > 1: Contact exists, Deal Value 5000, with Record(log) an Email Activity', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Opportunity in Salesforce > 4');
    expect(p.row['Deal Value'], 'Deal Value of the prospect').toBe('5000');
    await contactFirst(fx, p);
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [
      { name: A.createOpp, opportunity: PROSPECTING },
      { name: A.record, objects: ['Opportunity', 'Contact'] },
    ]);
    const result = await send(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('One Opportunity named with the email: Stage Prospecting, Close Date today + 1, Amount 5000', async () => {
      await untilPasses('the Opportunity appears in Salesforce', async () => {
        const rows = await fx.salesforceOpportunities.rowTexts(p.row['Email']);
        expect(rows.length, `Opportunities matching ${p.row['Email']}: ${rows.join(' || ')}`).toBe(1);
      });
      const f = await fx.salesforceOpportunities.opportunityFields(p.row['Email']);
      expect(f.name, 'Opportunity Name').toContain(p.row['Email']);
      expect(f.stage, 'Opportunity Stage').toBe('Prospecting');
      expect(f.closeDate, 'Opportunity Close Date').toBe(dayMonthYear(1));
      expect(f.amount, 'Opportunity Amount').toMatch(/5,?000/);
    });
    await test.step('The email is on the Opportunity and Contact timelines', async () => {
      await expectLoggedEmail(fx.salesforceOpportunities, p.row['Email'], 'Opportunity');
      await expectLoggedEmail(fx.salesforceContacts, p.row['Email'], 'Contact');
    });
  });

  // 8. AL-4168, Create a Opportunity
  test('Create a Opportunity in Salesforce > 2: Closing date 0 cannot be saved (AL-4168)', async ({ fx }) => {
    await expectZeroDaysBlocked(fx, A.createOpp);
  });

  // 9. Update a Opportunity, Contact with 3 Opportunities
  test('Update a Opportunity in Salesforce > 1: Contact has 3 Opportunities', async ({ fx }) => {
    test.setTimeout(minutes(1) + 8 * 60_000);
    const p = prospect('Update a Opportunity in Salesforce > 2');
    await contactFirst(fx, p);
    // An Opportunity made from the Contact's Opportunities list has the Contact as Contact Role,
    // which is how the product finds it (QA, 2026-10-21). Close Dates tell the three apart.
    await test.step('Create 3 Opportunities on the Contact', async () => {
      for (const days of [10, 20, 30]) {
        await fx.salesforceContacts.newOpportunity(p.row['Email'], { name: p.row['Email'], stage: 'Prospecting', closeDate: dayMonthYear(days) });
      }
      expect((await fx.salesforceOpportunities.rowTexts(p.row['Email'])).length, `Opportunities for ${p.row['Email']} before the send`).toBe(3);
    });
    await fx.salesforceEmailSent.configureTrigger(TRIGGER, [{ name: A.updateOpp, opportunity: QUALIFICATION }]);
    const result = await send(fx, p);
    expect(result.status, 'Logs status').toBe('Success');
    await test.step('The latest Opportunity is Qualification, Close Date today + 2; the other two are unchanged', async () => {
      await untilPasses('the latest Opportunity is updated', async () => {
        const seen: string[] = [];
        for (let i = 0; i < 3; i++) {
          await fx.salesforceOpportunities.openRecord(p.row['Email'], i);
          seen.push(`${await fx.salesforceOpportunities.field('StageName')} ${await fx.salesforceOpportunities.field('CloseDate')}`);
        }
        record('Opportunities after the send (Stage, Close Date)', seen.join(' || '));
        expect(seen.sort(), 'Opportunities after the send').toEqual(
          [`Prospecting ${dayMonthYear(10)}`, `Prospecting ${dayMonthYear(20)}`, `Qualification ${dayMonthYear(2)}`].sort(),
        );
      });
    });
  });

  // 10. AL-4168, Update a Opportunity
  test('Update a Opportunity in Salesforce > 2: Closing date 0 cannot be saved (AL-4168)', async ({ fx }) => {
    await expectZeroDaysBlocked(fx, A.updateOpp);
  });
});
