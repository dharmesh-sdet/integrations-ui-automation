// Production smoke test: Email Sent from Saleshandy, Zoho.
// Checklist: notes/production-testing/17-zoho-email-sent.md (approved by QA 2026-11-02, 8 checks, no fixed
// bug ticket). Each test body follows the staging test of the same action in tests/zoho/email-sent.spec.ts
// (22 of 24, 2026-11-02), so a check passes or fails on the same assertions.
// Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts); Zoho CRM is the same
//    org (crm.zoho.com), read in a headed browser on its own copy of the saved profile;
//  - the sequence comes from SMOKE_SEQUENCE_ID, nothing production is hard-coded;
//  - after a trigger is saved the page is reloaded and the saved action is read back, and the check stops
//    before any send when "Email is Opened in Saleshandy" or "Link is Clicked in Saleshandy" is on;
//  - Logs are not read for Zoho (QA, 2026-10-29).
// Checks do not delete what they create. One event must make one record: a repeat is reported to QA, not filed.
//
// Run through scripts/run-zoho-email-sent-smoke.sh (npm run smoke:zoho-email-sent), which runs the gate
// (tests/setup/zoho-prod-gate.spec.ts) first. Needs, once:
//   npm run login:saleshandy -- emailopenedprod    (headed, Cloudflare blocks headless)
//   auth/zoho-email-sent-smoke-profile             (copy of the saved Zoho profile, made by the run script)
// Data: test-data/zoho/email-sent-smoke.csv (scripts/make-zoho-email-sent-smoke-data.ts).
import path from 'node:path';
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { ZOHO_ACTION, fullName } from '../../src/flows/saleshandy-to-zoho.ts';
import { NOTE_TITLE, TRIGGER, configureWaiting, inDays, noteTitles, sendStep } from '../../src/flows/zoho-email-sent.ts';
import { ZohoCrmPage, openZohoProfile } from '../../src/pages/zoho/zoho-crm.page.ts';
import { ZohoForms } from '../../src/pages/zoho/zoho-forms.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';

// Other smoke runs may share emailopenedprod, so saving a trigger leaves the other triggers as they are.
process.env.KEEP_OTHER_TRIGGERS ??= '1';

const CSV = 'zoho/email-sent-smoke.csv';
const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '';
const PROFILE = path.resolve(import.meta.dirname, '../../auth/zoho-email-sent-smoke-profile');
// A send does not start these two, but a run that has one of them on mixes its records into the checks.
const SIBLING_TRIGGERS = ['Email is Opened in Saleshandy', 'Link is Clicked in Saleshandy'];
// One check = a trigger save, a record made by hand, a Send now, the wait and slow production pages.
const ROW_TIMEOUT = 10 * 60_000;
const TASK = { subject: 'Follow up after step 1', status: 'Not Started', priority: 'Normal', dueIn: '3' };

const test = base.extend<object, { crm: ZohoCrmPage }>({
  crm: [
    async ({}, use) => {
      const { context, crm } = await openZohoProfile(PROFILE);
      // Zoho page loads time out now and then (net::ERR_TIMED_OUT, seen 2026-11-02). Retry a load up to 4 times.
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
  if (!found) throw new Error(`No row "${scenario}" in test-data/${CSV}. Run scripts/make-zoho-email-sent-smoke-data.ts.`);
  // Twitter in Zoho is a handle, not a URL (Z-1: a wrong-type value makes Zoho reject the whole record).
  const handle = found['Twitter'].split('/').filter(Boolean).pop() ?? '';
  const company = found['Company'] ? `${found['Company']} ${stamp}` : '';
  const row: Row = { ...found, Twitter: handle, Company: company };
  markUsed(CSV, row['Email']);
  return row;
}

// Saves the trigger with the check's actions, reloads the page and reads the saved actions back. Stops before
// any send when one of the sibling triggers is on.
async function useTrigger(fx: Env, picks: Parameters<typeof configureWaiting>[3]): Promise<void> {
  await configureWaiting(fx.zohoIntegration, fx.saleshandyPage, TRIGGER, picks);
  await test.step('Reload and read the saved trigger back', async () => {
    await fx.saleshandyPage.reload();
    await fx.zohoIntegration.openTriggers();
    expect(await fx.zohoIntegration.isTriggerOn(TRIGGER), `"${TRIGGER}" is on after the reload`).toBe(true);
    expect(await fx.zohoIntegration.selectedActivities(TRIGGER), 'Saved actions after the reload').toEqual(picks.map((p) => p.action));
    for (const sibling of SIBLING_TRIGGERS) {
      expect(await fx.zohoIntegration.isTriggerOn(sibling), `"${sibling}" is on. Turn it off and run again. No send was made.`).toBe(false);
    }
  });
}

// Adds the prospect and sends step 1 (Send now). Returns when the Emails tab row shows Sent.
async function send(fx: Env, row: Row): Promise<void> {
  if (!SEQUENCE_ID) throw new Error('SMOKE_SEQUENCE_ID is not set. Use scripts/run-zoho-email-sent-smoke.sh.');
  await test.step(`Add ${fullName(row)} to the sequence and send step 1`, () => sendStep(fx.saleshandySequence, SEQUENCE_ID, row));
}

const phoneDigits = (s: string): string => s.replace(/\D/g, '');

test.describe('Zoho Email Sent (production smoke)', () => {
  test.setTimeout(ROW_TIMEOUT);

  // ---- Create/Update a Lead in Zoho ----

  test('1 Lead: prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 1');
    await useTrigger(fx, [{ action: ZOHO_ACTION.lead }]);
    await send(fx, row);
    const found = await crm.waitForRecord('Leads', row['Email']);
    expect(found, `No Zoho lead for ${row['Email']}`).toBeTruthy();
    const text = await crm.recordText('Leads', found!.id);
    expect(ZohoCrmPage.field(text, 'Company')).toBe(row['Company']);
    for (const value of [row['Job Title'], row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(ZohoCrmPage.noteCount(text)).toBe(1);
    expect(text).toContain(NOTE_TITLE);
    expect((await crm.find('Leads', row['Email'])).length, 'One event must make one lead').toBe(1);
  });

  // ---- Create/Update a Contact in Zoho ----

  test('2 Contact: prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 2');
    await useTrigger(fx, [{ action: ZOHO_ACTION.contact }]);
    await send(fx, row);
    const found = await crm.waitForRecord('Contacts', row['Email']);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    const text = await crm.recordText('Contacts', found!.id);
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    for (const value of [row['Job Title'], row['Department'], row['Twitter'], row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(phoneDigits(text)).toContain(phoneDigits(row['Phone Number']));
    expect(ZohoCrmPage.noteCount(text)).toBe(1);
    expect(text).toContain(NOTE_TITLE);
    expect((await crm.find('Contacts', row['Email'])).length, 'One event must make one contact').toBe(1);
  });

  test('3 Contact: contact exists with an old Phone and Title', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 3');
    const id = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'], phone: '+1 555-0100-0003', title: 'Old Title' });
    await useTrigger(fx, [{ action: ZOHO_ACTION.contact }]);
    await send(fx, row);
    await untilPasses('the contact is updated', async () => {
      const text = await crm.recordText('Contacts', id);
      expect(text).toContain(row['Job Title']);
      expect(text).not.toContain('Old Title');
      expect(phoneDigits(text)).toContain(phoneDigits(row['Phone Number']));
      expect(ZohoCrmPage.noteCount(text)).toBe(1);
    }, 3 * 60_000);
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'Still one contact').toEqual([id]);
  });

  // ---- Create/Update Account in Zoho ----

  test('4 Account: prospect has a company, no contact, no account', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 4');
    await useTrigger(fx, [{ action: ZOHO_ACTION.account }]);
    await send(fx, row);
    const found = await crm.waitForRecord('Accounts', row['Company']);
    expect(found, `No Zoho account named ${row['Company']}`).toBeTruthy();
    const text = await crm.recordText('Accounts', found!.id);
    expect(ZohoCrmPage.field(text, 'Account Name')).toBe(row['Company']);
    for (const value of [row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(ZohoCrmPage.noteCount(text)).toBe(1);
    expect((await crm.find('Accounts', row['Company'])).length, 'One event must make one account').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The Account action must not create a contact').toBe(0);
  });

  // ---- Create/Update a Deal in Zoho ----

  test('5 Deal: prospect not in Zoho, has a company, Closing date 0', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 5');
    await useTrigger(fx, [{ action: ZOHO_ACTION.deal, closingDays: '0' }]);
    await send(fx, row);
    const found = await crm.waitForRecord('Deals', fullName(row));
    expect(found, `No Zoho deal named ${fullName(row)}`).toBeTruthy();
    const text = await crm.recordText('Deals', found!.id);
    expect(ZohoCrmPage.field(text, 'Deal Name')).toBe(fullName(row));
    expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
    expect(ZohoCrmPage.field(text, 'Stage')).toBe('Qualification');
    expect(ZohoCrmPage.field(text, 'Closing Date')).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(ZohoCrmPage.noteCount(text)).toBe(1);
    expect((await crm.find('Deals', fullName(row))).length, 'One event must make one deal').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The Deal action must not create a contact').toBe(0);
    // Z-5 (known): the deal also makes an account named after the company.
    expect(await crm.waitForRecord('Accounts', row['Company'], 30_000)).toBeTruthy();
  });

  // ---- Create a Task in Zoho ----

  test('6 Task: prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 6');
    await useTrigger(fx, [{ action: ZOHO_ACTION.task, task: TASK }]);
    await send(fx, row);
    const found = await crm.waitForRecord('Tasks', fullName(row));
    expect(found, `No Zoho task for ${fullName(row)}`).toBeTruthy();
    const text = await crm.recordText('Tasks', found!.id);
    expect(ZohoCrmPage.field(text, 'Subject')).toBe(TASK.subject);
    expect(ZohoCrmPage.field(text, 'Status')).toBe(TASK.status);
    expect(ZohoCrmPage.field(text, 'Priority')).toBe(TASK.priority);
    expect(ZohoCrmPage.field(text, 'Due Date')).toBe(inDays(3));
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    expect(noteTitles(text)).toBe(1);
    expect((await crm.find('Tasks', fullName(row))).length, 'One event must make one task').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length).toBe(1);
  });

  // ---- Combined actions ----

  test('7 Combined: Contact and Lead, prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 7');
    await useTrigger(fx, [{ action: ZOHO_ACTION.contact }, { action: ZOHO_ACTION.lead }]);
    await send(fx, row);
    expect(await crm.waitForRecord('Contacts', row['Email']), `No Zoho contact for ${row['Email']}`).toBeTruthy();
    expect((await crm.find('Contacts', row['Email'])).length, 'No duplicate contact').toBe(1);
    expect(await crm.waitForRecord('Leads', row['Email']), 'The lead').toBeTruthy();
    expect((await crm.find('Leads', row['Email'])).length, 'The lead').toBe(1);
  });

  // ---- Trigger and setup ----

  test('8 Trigger OFF: nothing is created', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 8');
    await useTrigger(fx, [{ action: ZOHO_ACTION.contact }]);
    // Switch only Email Sent off. The other triggers stay as they are (the account is shared).
    await test.step('Turn Email Sent off, save, reload and read it back', async () => {
      await zohoIntegration.openTriggers();
      await zohoIntegration.turnOff(TRIGGER);
      await zohoIntegration.save();
      await zohoIntegration.savedToast().waitFor({ timeout: 20_000 });
      await saleshandyPage.reload();
      await zohoIntegration.openTriggers();
      expect(await zohoIntegration.isTriggerOn(TRIGGER), `"${TRIGGER}" is off after the reload`).toBe(false);
    });
    await send(fx, row);
    expect(await crm.waitForRecord('Contacts', row['Email'], 60_000), 'Nothing may be created with the trigger off').toBeUndefined();
    expect((await crm.find('Leads', row['Email'])).length).toBe(0);
  });
});
