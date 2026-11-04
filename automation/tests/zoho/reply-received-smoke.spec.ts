// Production smoke test: Reply is Received in Saleshandy, Zoho.
// Checklist: notes/production-testing/19-zoho-reply-received.md (QA "looks good" 2026-11-03, 8 checks, no fixed
// bug ticket; AL-4192 is the tracking ticket and AL-4219 the fix that must be deployed). Each test body follows the
// staging test of the same action in tests/zoho/reply-received.spec.ts (22 of 24, 2026-11-03), so a check passes or
// fails on the same assertions.
// Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts); Zoho CRM is the same
//    org (crm.zoho.com), read in a headed browser on its own copy of the saved profile;
//  - the sequence comes from SMOKE_SEQUENCE_ID (QA gave 989765), nothing production is hard-coded;
//  - production shows the reply in Zoho 1 to 3 minutes after it, so every look waits up to 3 minutes;
//  - after a trigger is saved the page is reloaded and the saved actions are read back, and the check stops
//    before any send when "Email Sent from Saleshandy" or "Email is Opened in Saleshandy" is on;
//  - Logs are not read for Zoho (QA, 2026-10-29).
// Every check sends step 1 (Send now) and marks the prospect as replied from the Emails tab three-dot menu
// (QA 2026-11-03: the more reliable way). Checks do not delete what they create.
//
// Run through scripts/run-zoho-reply-received-smoke.sh (npm run smoke:zoho-reply-received), which runs the gate
// (tests/setup/zoho-prod-gate.spec.ts) first. Needs, once:
//   npm run login:saleshandy -- emailopenedprod    (headed, Cloudflare blocks headless)
//   auth/zoho-reply-received-smoke-profile         (copy of the saved Zoho profile, made by the run script)
// Data: test-data/zoho/reply-received-smoke.csv (scripts/make-zoho-reply-received-smoke-data.ts).
import path from 'node:path';
import { chromium } from 'playwright';
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { ZOHO_ACTION, configure, fullName, sendAndReply } from '../../src/flows/saleshandy-to-zoho.ts';
import { configureWaiting, inDays } from '../../src/flows/zoho-email-sent.ts';
import { ZOHO_ORG, ZohoCrmPage } from '../../src/pages/zoho/zoho-crm.page.ts';
import { ZohoForms } from '../../src/pages/zoho/zoho-forms.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';

// Other smoke runs may share emailopenedprod, so saving a trigger leaves the other triggers as they are.
process.env.KEEP_OTHER_TRIGGERS ??= '1';

const CSV = 'zoho/reply-received-smoke.csv';
const TRIGGER = 'Reply is Received in Saleshandy';
const NOTE_TITLE = 'Saleshandy Reply Received On Sequence Email';
const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '';
const PROFILE = path.resolve(import.meta.dirname, '../../auth/zoho-reply-received-smoke-profile');
const SIBLING_TRIGGERS = ['Email Sent from Saleshandy', 'Email is Opened in Saleshandy'];

// Production shows the reply in Zoho 1 to 3 minutes after it, so each look waits up to 3 minutes.
const LOOK = 3 * 60_000;
// One check = a trigger save, records made by hand, a send, a reply, the wait and slow production pages.
const ROW_TIMEOUT = 12 * 60_000;
const TASK = { subject: 'Follow up after reply', status: 'Not Started', priority: 'Normal', dueIn: '3' };

const test = base.extend<object, { crm: ZohoCrmPage }>({
  crm: [
    async ({}, use) => {
      // Zoho page loads time out now and then (net::ERR_TIMED_OUT, seen 2026-11-03). The profile is opened here and
      // every load, the first one too, is retried up to 4 times.
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
  if (!found) throw new Error(`No row "${scenario}" in test-data/${CSV}. Run scripts/make-zoho-reply-received-smoke-data.ts.`);
  // Twitter in Zoho is a handle, not a URL (Z-1: a wrong-type value makes Zoho reject the whole record).
  const handle = found['Twitter'].split('/').filter(Boolean).pop() ?? '';
  const company = found['Company'] ? `${found['Company']} ${stamp}` : '';
  const row: Row = { ...found, Twitter: handle, Company: company };
  markUsed(CSV, row['Email']);
  return row;
}

// Reloads the page after the trigger is saved and reads the saved actions back.
// Stops before any send when Email Sent or Email Opened is on: a send would run their actions too.
async function checkSaved(fx: Env, picks: Array<{ action: string }>): Promise<void> {
  await test.step('Reload and read the saved trigger back', async () => {
    await fx.saleshandyPage.reload();
    await fx.zohoIntegration.openTriggers();
    expect(await fx.zohoIntegration.isTriggerOn(TRIGGER), `"${TRIGGER}" is on after the reload`).toBe(true);
    expect([...(await fx.zohoIntegration.selectedActivities(TRIGGER))].sort(), 'Saved actions after the reload').toEqual([...picks.map((p) => p.action)].sort());
    for (const sibling of SIBLING_TRIGGERS) {
      expect(await fx.zohoIntegration.isTriggerOn(sibling), `"${sibling}" is on. Turn it off and run again. Nothing was sent.`).toBe(false);
    }
  });
}

async function useTrigger(fx: Env, picks: Parameters<typeof configure>[3]): Promise<void> {
  await configure(fx.zohoIntegration, fx.saleshandyPage, TRIGGER, picks);
  await checkSaved(fx, picks);
}

// Adds the prospect, sends step 1 (Send now) and marks it as replied from the Emails tab three-dot menu.
async function reply(fx: Env, row: Row): Promise<void> {
  if (!SEQUENCE_ID) throw new Error('SMOKE_SEQUENCE_ID is not set. Use scripts/run-zoho-reply-received-smoke.sh.');
  await test.step(`Add ${fullName(row)} to the sequence, send step 1 and mark it as replied`, () => sendAndReply(fx.saleshandySequence, SEQUENCE_ID, row));
}

const phoneDigits = (s: string): string => s.replace(/\D/g, '');
// An empty field shows no value in the record text, so ZohoCrmPage.field returns the label on the next line
// (seen 2026-11-02). A field is empty when it reads '' or that next label.
const emptyField = (text: string, label: string, nextLabel: string): boolean => {
  const value = ZohoCrmPage.field(text, label);
  return value === '' || value === nextLabel;
};

test.describe('Zoho Reply Received (production smoke)', () => {
  test.setTimeout(ROW_TIMEOUT);

  // ---- Create/Update a Contact in Zoho ----

  test('1 Contact: prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 1');
    await useTrigger(fx, [{ action: ZOHO_ACTION.contact }]);
    await reply(fx, row);
    const found = await crm.waitForRecord('Contacts', row['Email'], LOOK);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    const text = await crm.waitForNotes('Contacts', found!.id, 1, LOOK);
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    for (const value of [row['Job Title'], row['Department'], row['Twitter'], row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(phoneDigits(text)).toContain(phoneDigits(row['Phone Number']));
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
    expect(text).toContain(NOTE_TITLE);
    expect((await crm.find('Contacts', row['Email'])).length, 'One reply must make one contact').toBe(1);
  });

  test('2 Contact: contact exists with an old Title', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 2');
    const id = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'], title: 'Old Title' });
    await useTrigger(fx, [{ action: ZOHO_ACTION.contact }]);
    await reply(fx, row);
    await untilPasses('the contact is updated', async () => {
      const text = await crm.recordText('Contacts', id);
      expect(text).toContain(row['Job Title']);
      expect(text).not.toContain('Old Title');
    }, LOOK);
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'Still one contact').toEqual([id]);
    // Unconfirmed: whether an update adds a note. Recorded, not asserted.
    test.info().annotations.push({ type: 'Notes on the updated contact', description: String(ZohoCrmPage.noteCount(await crm.recordText('Contacts', id))) });
  });

  // ---- Create/Update a Lead in Zoho ----

  test('3 Lead: prospect not in Zoho, has a company', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 3');
    await useTrigger(fx, [{ action: ZOHO_ACTION.lead }]);
    await reply(fx, row);
    const found = await crm.waitForRecord('Leads', row['Email'], LOOK);
    expect(found, `No Zoho lead for ${row['Email']}`).toBeTruthy();
    const text = await crm.waitForNotes('Leads', found!.id, 1, LOOK);
    expect(ZohoCrmPage.field(text, 'Company')).toBe(row['Company']);
    for (const value of [row['Job Title'], row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
    expect((await crm.find('Leads', row['Email'])).length, 'One reply must make one lead').toBe(1);
  });

  // ---- Create/Update Account in Zoho ----

  test('4 Account: prospect has a company, no contact, no account', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 4');
    await useTrigger(fx, [{ action: ZOHO_ACTION.account }]);
    await reply(fx, row);
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

  test('5 Deal: prospect not in Zoho, Closing date 7', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 5');
    await useTrigger(fx, [{ action: ZOHO_ACTION.deal, closingDays: '7' }]);
    await reply(fx, row);
    const found = await crm.waitForRecord('Deals', fullName(row), LOOK);
    expect(found, `No Zoho deal named ${fullName(row)}`).toBeTruthy();
    const text = await crm.recordText('Deals', found!.id);
    expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
    expect(ZohoCrmPage.field(text, 'Closing Date')).toBe(inDays(7));
    expect(emptyField(text, 'Contact Name', 'Modified By'), 'The deal is not linked to a contact').toBe(true);
    expect((await crm.find('Deals', fullName(row))).length, 'One reply must make one deal').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The Deal action must not create a contact').toBe(0);
    // Z-5 (known): the deal also makes an account named after the company. Recorded.
    expect(await crm.waitForRecord('Accounts', row['Company'], 30_000)).toBeTruthy();
  });

  test('6 Deal: contact has 2 deals', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 6');
    const forms = new ZohoForms(crm);
    await forms.createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    const olderName = `Older Deal ${stamp} ${row['Last Name']}`;
    const newerName = `Newer Deal ${stamp} ${row['Last Name']}`;
    const olderId = await forms.createDeal({ name: olderName, closing: inDays(30), contact: fullName(row), amount: '100' });
    // The newest deal is the one made last. A pause makes the order clear in Zoho.
    await crm.page.waitForTimeout(60_000);
    const newerId = await forms.createDeal({ name: newerName, closing: inDays(30), contact: fullName(row), amount: '200' });
    await useTrigger(fx, [{ action: ZOHO_ACTION.deal, closingDays: '7' }]);
    await reply(fx, row);
    await untilPasses('the newest deal is updated', async () => {
      expect(ZohoCrmPage.field(await crm.recordText('Deals', newerId), 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
    }, LOOK);
    const older = await crm.recordText('Deals', olderId);
    expect(ZohoCrmPage.field(older, 'Amount'), 'The older deal is unchanged').toContain('100.00');
    expect(ZohoCrmPage.noteCount(older), 'No note on the older deal').toBe(0);
    expect((await crm.find('Deals', olderName)).length + (await crm.find('Deals', newerName)).length, 'No new deal').toBe(2);
  });

  // ---- Create a Task in Zoho ----

  test('7 Task: prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 7');
    await useTrigger(fx, [{ action: ZOHO_ACTION.task, task: TASK }]);
    await reply(fx, row);
    const found = await crm.waitForRecord('Tasks', fullName(row), LOOK);
    expect(found, `No Zoho task for ${fullName(row)}`).toBeTruthy();
    const text = await crm.recordText('Tasks', found!.id);
    expect(ZohoCrmPage.field(text, 'Subject')).toBe(TASK.subject);
    expect(ZohoCrmPage.field(text, 'Status')).toBe(TASK.status);
    expect(ZohoCrmPage.field(text, 'Priority')).toBe(TASK.priority);
    expect(ZohoCrmPage.field(text, 'Due Date')).toBe(inDays(3));
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    expect((await crm.find('Tasks', fullName(row))).length, 'One reply must make one task').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The contact is created first').toBe(1);
  });

  // ---- Combined actions ----

  test('8 Combined: Contact, Deal and Task, prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 8');
    const picks = [{ action: ZOHO_ACTION.contact }, { action: ZOHO_ACTION.deal, closingDays: '7' }, { action: ZOHO_ACTION.task, task: TASK }];
    // configureWaiting waits for the saved message after each Deal and Task dialog. Plain configure picks the next
    // action too early and the last chip is lost.
    await configureWaiting(zohoIntegration, saleshandyPage, TRIGGER, picks);
    await checkSaved(fx, picks);
    await reply(fx, row);
    const contact = await crm.waitForRecord('Contacts', row['Email'], LOOK);
    expect(contact, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    const deal = await crm.waitForRecord('Deals', fullName(row), LOOK);
    expect(deal, `No Zoho deal for ${fullName(row)}`).toBeTruthy();
    const task = await crm.waitForRecord('Tasks', fullName(row), LOOK);
    expect(task, `No Zoho task for ${fullName(row)}`).toBeTruthy();
    expect((await crm.find('Contacts', row['Email'])).length, 'One contact').toBe(1);
    expect((await crm.find('Deals', fullName(row))).length, 'One deal').toBe(1);
    expect((await crm.find('Tasks', fullName(row))).length, 'One task').toBe(1);
    await untilPasses('the deal and the task are linked to the contact', async () => {
      expect(ZohoCrmPage.field(await crm.recordText('Deals', deal!.id), 'Contact Name')).toBe(fullName(row));
      expect(ZohoCrmPage.field(await crm.recordText('Tasks', task!.id), 'Contact Name')).toBe(fullName(row));
    }, LOOK);
    expect(ZohoCrmPage.noteCount(await crm.recordText('Contacts', contact!.id)), 'A note on the contact').toBeGreaterThanOrEqual(1);
    expect(ZohoCrmPage.noteCount(await crm.recordText('Deals', deal!.id)), 'A note on the deal').toBeGreaterThanOrEqual(1);
  });
});
