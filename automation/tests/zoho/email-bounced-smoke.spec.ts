// Production smoke test: Email is Bounced in Saleshandy, Zoho.
// Checklist: notes/production-testing/18-zoho-email-bounced.md (approved by QA 2026-11-03, 8 checks, no fixed
// bug ticket; AL-4195 is the workflow ticket). Each test body follows the staging test of the same action in
// tests/zoho/email-bounced.spec.ts (22 of 22, 2026-11-03), so a check passes or fails on the same assertions.
// Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts); Zoho CRM is the same
//    org (crm.zoho.com), read in a headed browser on its own copy of the saved profile;
//  - the sequence comes from SMOKE_SEQUENCE_ID, nothing production is hard-coded;
//  - production shows the bounce in Zoho 1 to 3 minutes after it, so every look waits up to 3 minutes;
//  - after a trigger is saved the page is reloaded and the saved action is read back, and the check stops
//    before any bounce when "Email Sent from Saleshandy" is on;
//  - Logs are not read for Zoho (QA, 2026-10-29).
// Only check 8 sends an email (a real bounce, Send now). Checks 1 to 7 use Mark as bounced.
// Checks do not delete what they create.
//
// Run through scripts/run-zoho-email-bounced-smoke.sh (npm run smoke:zoho-email-bounced), which runs the gate
// (tests/setup/zoho-prod-gate.spec.ts) first. Needs, once:
//   npm run login:saleshandy -- emailopenedprod    (headed, Cloudflare blocks headless)
//   auth/zoho-email-bounced-smoke-profile          (copy of the saved Zoho profile, made by the run script)
// Data: test-data/zoho/email-bounced-smoke.csv (scripts/make-zoho-email-bounced-smoke-data.ts).
import path from 'node:path';
import { chromium } from 'playwright';
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { ZOHO_ACTION, configure, fullName } from '../../src/flows/saleshandy-to-zoho.ts';
import { inDays, sendStep } from '../../src/flows/zoho-email-sent.ts';
import { NOTE_TITLE, TRIGGER, bounce, realBounceEmail } from '../../src/flows/zoho-email-bounced.ts';
import { ZOHO_ORG, ZohoCrmPage } from '../../src/pages/zoho/zoho-crm.page.ts';
import { ZohoForms } from '../../src/pages/zoho/zoho-forms.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';

// Other smoke runs may share emailopenedprod, so saving a trigger leaves the other triggers as they are.
process.env.KEEP_OTHER_TRIGGERS ??= '1';

const CSV = 'zoho/email-bounced-smoke.csv';
const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '';
const PROFILE = path.resolve(import.meta.dirname, '../../auth/zoho-email-bounced-smoke-profile');
const SIBLING_TRIGGERS = ['Email Sent from Saleshandy'];

// Production shows the bounce in Zoho 1 to 3 minutes after it, so each look waits up to 3 minutes.
const LOOK = 3 * 60_000;
// One check = a trigger save, records made by hand, a Mark as bounced, the wait and slow production pages.
const ROW_TIMEOUT = 10 * 60_000;
// The real bounce adds the send and the wait for Saleshandy to set Bounced (up to 5 minutes).
const REAL_ROW_TIMEOUT = 16 * 60_000;
const TASK = { subject: 'Follow up after bounce', status: 'Not Started', priority: 'Normal', dueIn: '3' };

const test = base.extend<object, { crm: ZohoCrmPage }>({
  crm: [
    async ({}, use) => {
      // Zoho page loads time out now and then (net::ERR_TIMED_OUT in 150 ms, seen 2026-11-03, also on the first
      // load of the profile, which killed checks 1 and 4 of the first run). So the profile is opened here and
      // every load, the first one too, is retried up to 4 times. The shared openZohoProfile is owned by another session.
      const context = await chromium.launchPersistentContext(PROFILE, { headless: false, viewport: { width: 1500, height: 1200 } });
      const crm = new ZohoCrmPage(context.pages()[0] ?? (await context.newPage()));
      const openOnce = crm.open.bind(crm);
      crm.open = async (url: string) => {
        for (let attempt = 1; ; attempt++) {
          try {
            return await openOnce(url);
          } catch (e) {
            if (attempt >= 4 || !/ERR_TIMED_OUT|ERR_CONNECTION|ERR_NETWORK|ERR_NAME|Timeout/.test(String(e))) throw e;
            await crm.page.waitForTimeout(3_000);
          }
        }
      };
      await crm.open(`${ZOHO_ORG}/tab/Contacts`).catch(async (e) => {
        await context.close();
        throw e;
      });
      await use(crm);
      await context.close();
    },
    { scope: 'worker' },
  ],
});
test.use({ account: 'emailopenedprod' });

// A fresh company name, so a record made by an earlier run never matches.
const stamp = String(Date.now()).slice(-6);

type Fx = Parameters<Parameters<typeof test>[2]>[0];
type Env = Pick<Fx, 'zohoIntegration' | 'saleshandyPage' | 'saleshandySequence' | 'crm'>;

// The Scenario column holds "Smoke > <#>".
function prospect(scenario: string): Row {
  const found = readCsv(CSV).find((r) => r['Scenario'] === scenario);
  if (!found) throw new Error(`No row "${scenario}" in test-data/${CSV}. Run scripts/make-zoho-email-bounced-smoke-data.ts.`);
  // Twitter in Zoho is a handle, not a URL (Z-1: a wrong-type value makes Zoho reject the whole record).
  const handle = found['Twitter'].split('/').filter(Boolean).pop() ?? '';
  const company = found['Company'] ? `${found['Company']} ${stamp}` : '';
  const row: Row = { ...found, Twitter: handle, Company: company };
  markUsed(CSV, row['Email']);
  return row;
}

// Saves the trigger with the check's action, reloads the page and reads the saved action back.
// Stops before any bounce when Email Sent is on: a send would run its own actions.
async function useTrigger(fx: Env, picks: Parameters<typeof configure>[3]): Promise<void> {
  await configure(fx.zohoIntegration, fx.saleshandyPage, TRIGGER, picks);
  await test.step('Reload and read the saved trigger back', async () => {
    await fx.saleshandyPage.reload();
    await fx.zohoIntegration.openTriggers();
    expect(await fx.zohoIntegration.isTriggerOn(TRIGGER), `"${TRIGGER}" is on after the reload`).toBe(true);
    expect(await fx.zohoIntegration.selectedActivities(TRIGGER), 'Saved actions after the reload').toEqual(picks.map((p) => p.action));
    for (const sibling of SIBLING_TRIGGERS) {
      expect(await fx.zohoIntegration.isTriggerOn(sibling), `"${sibling}" is on. Turn it off and run again. No bounce was made.`).toBe(false);
    }
  });
}

// Adds the prospect and marks the step 1 email as bounced (no send).
async function markBounced(fx: Env, row: Row): Promise<void> {
  if (!SEQUENCE_ID) throw new Error('SMOKE_SEQUENCE_ID is not set. Use scripts/run-zoho-email-bounced-smoke.sh.');
  await test.step(`Add ${fullName(row)} to the sequence and mark the step 1 email as bounced`, () => bounce(fx.saleshandySequence, SEQUENCE_ID, row));
}

const phoneDigits = (s: string): string => s.replace(/\D/g, '');

test.describe('Zoho Email Bounced (production smoke)', () => {
  test.setTimeout(ROW_TIMEOUT);

  // ---- Create/Update a Contact in Zoho ----

  test('1 Contact: prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 1');
    await useTrigger(fx, [{ action: ZOHO_ACTION.contact }]);
    await markBounced(fx, row);
    const found = await crm.waitForRecord('Contacts', row['Email'], LOOK);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    const text = await crm.waitForNotes('Contacts', found!.id, 1, LOOK);
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    for (const value of [row['Job Title'], row['Department'], row['Twitter'], row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(phoneDigits(text)).toContain(phoneDigits(row['Phone Number']));
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
    expect(text).toContain(NOTE_TITLE);
    expect((await crm.find('Contacts', row['Email'])).length, 'One bounce must make one contact').toBe(1);
  });

  test('2 Contact: contact exists with an old Title', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 2');
    const id = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'], title: 'Old Title' });
    await useTrigger(fx, [{ action: ZOHO_ACTION.contact }]);
    await markBounced(fx, row);
    await untilPasses('the contact is updated', async () => {
      const text = await crm.recordText('Contacts', id);
      expect(text).toContain(row['Job Title']);
      expect(text).not.toContain('Old Title');
    }, LOOK);
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'Still one contact').toEqual([id]);
  });

  // ---- Create/Update a Lead in Zoho ----

  test('3 Lead: prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 3');
    await useTrigger(fx, [{ action: ZOHO_ACTION.lead }]);
    await markBounced(fx, row);
    const found = await crm.waitForRecord('Leads', row['Email'], LOOK);
    expect(found, `No Zoho lead for ${row['Email']}`).toBeTruthy();
    const text = await crm.waitForNotes('Leads', found!.id, 1, LOOK);
    expect(ZohoCrmPage.field(text, 'Company')).toBe(row['Company']);
    for (const value of [row['Job Title'], row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
    expect((await crm.find('Leads', row['Email'])).length, 'One bounce must make one lead').toBe(1);
  });

  // ---- Create/Update Account in Zoho ----

  test('4 Account: prospect has a company, no contact, no account', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 4');
    await useTrigger(fx, [{ action: ZOHO_ACTION.account }]);
    await markBounced(fx, row);
    const found = await crm.waitForRecord('Accounts', row['Company'], LOOK);
    expect(found, `No Zoho account named ${row['Company']}`).toBeTruthy();
    const text = await crm.waitForNotes('Accounts', found!.id, 1, LOOK);
    expect(ZohoCrmPage.field(text, 'Account Name')).toBe(row['Company']);
    for (const value of [row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
    expect((await crm.find('Accounts', row['Company'])).length).toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The Account action must not link a contact').toBe(0);
  });

  // ---- Create/Update a Deal in Zoho ----

  test('5 Deal: contact exists and has 2 deals', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 5');
    const forms = new ZohoForms(crm);
    await forms.createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    const olderId = await forms.createDeal({ name: `Older Deal ${stamp} ${row['Last Name']}`, closing: inDays(30), contact: fullName(row), amount: '100' });
    const newerId = await forms.createDeal({ name: `Newer Deal ${stamp} ${row['Last Name']}`, closing: inDays(30), contact: fullName(row), amount: '200' });
    await useTrigger(fx, [{ action: ZOHO_ACTION.deal, closingDays: '0' }]);
    await markBounced(fx, row);
    await untilPasses('the newest deal is updated', async () => {
      const text = await crm.recordText('Deals', newerId);
      expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
      expect(ZohoCrmPage.noteCount(text)).toBeGreaterThanOrEqual(1);
    }, LOOK);
    const older = await crm.recordText('Deals', olderId);
    expect(ZohoCrmPage.field(older, 'Amount'), 'The older deal is unchanged').toContain('100.00');
    expect(ZohoCrmPage.noteCount(older)).toBe(0);
  });

  test('6 Deal: prospect not in Zoho, has a company, Closing date 0', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 6');
    await useTrigger(fx, [{ action: ZOHO_ACTION.deal, closingDays: '0' }]);
    await markBounced(fx, row);
    const found = await crm.waitForRecord('Deals', fullName(row), LOOK);
    expect(found, `No Zoho deal named ${fullName(row)}`).toBeTruthy();
    const text = await crm.waitForNotes('Deals', found!.id, 1, LOOK);
    expect(ZohoCrmPage.field(text, 'Deal Name')).toBe(fullName(row));
    expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
    expect(ZohoCrmPage.field(text, 'Stage')).toBe('Qualification');
    expect(ZohoCrmPage.field(text, 'Closing Date')).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
    expect((await crm.find('Deals', fullName(row))).length, 'One bounce must make one deal').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The Deal action must not create a contact').toBe(0);
    // Z-5 (known): the deal also makes an account named after the company.
    expect(await crm.waitForRecord('Accounts', row['Company'], 30_000)).toBeTruthy();
  });

  // ---- Create a Task in Zoho ----

  test('7 Task: prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 7');
    await useTrigger(fx, [{ action: ZOHO_ACTION.task, task: TASK }]);
    await markBounced(fx, row);
    const found = await crm.waitForRecord('Tasks', fullName(row), LOOK);
    expect(found, `No Zoho task for ${fullName(row)}`).toBeTruthy();
    const text = await crm.recordText('Tasks', found!.id);
    expect(ZohoCrmPage.field(text, 'Subject')).toBe(TASK.subject);
    expect(ZohoCrmPage.field(text, 'Status')).toBe(TASK.status);
    expect(ZohoCrmPage.field(text, 'Priority')).toBe(TASK.priority);
    expect(ZohoCrmPage.field(text, 'Due Date')).toBe(inDays(3));
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    expect((await crm.find('Tasks', fullName(row))).length, 'One bounce must make one task').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The contact is created first').toBe(1);
  });

  // ---- Real bounce ----

  test('8 Real bounce: Contact action, prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    test.setTimeout(REAL_ROW_TIMEOUT);
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const found = prospect('Smoke > 8');
    const email = realBounceEmail(found);
    const row: Row = { ...found, Email: email };
    markUsed(CSV, email);
    await useTrigger(fx, [{ action: ZOHO_ACTION.contact }]);
    if (!SEQUENCE_ID) throw new Error('SMOKE_SEQUENCE_ID is not set. Use scripts/run-zoho-email-bounced-smoke.sh.');
    await test.step(`Add ${fullName(row)} to the sequence and send step 1`, () => sendStep(saleshandySequence, SEQUENCE_ID, row));
    await test.step('Wait until the Emails tab shows Bounced', () => saleshandySequence.waitUntilBounced(SEQUENCE_ID, fullName(row)));
    const contact = await crm.waitForRecord('Contacts', email, LOOK);
    expect(contact, `No Zoho contact for ${email}`).toBeTruthy();
    const text = await crm.waitForNotes('Contacts', contact!.id, 1, LOOK);
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
    expect(text).toContain(NOTE_TITLE);
    expect((await crm.find('Contacts', email)).length, 'One bounce must make one contact').toBe(1);
  });
});
