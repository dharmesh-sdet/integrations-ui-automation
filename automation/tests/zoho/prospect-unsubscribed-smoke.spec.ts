// Production smoke test: Prospect is Unsubscribed in Saleshandy, Zoho.
// Checklist: notes/production-testing/21-zoho-prospect-unsubscribed.md (8 checks, no workflow ticket known). Each test body
// follows the staging test of the same action in tests/zoho/prospect-unsubscribed.spec.ts (19 of 19 passed at least once,
// 2026-11-04), so a check passes or fails on the same assertions.
// Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts); Zoho CRM is the same
//    org (crm.zoho.com), read in a headed browser on its own copy of the saved profile;
//  - the sequence comes from SMOKE_SEQUENCE_ID (QA gave 990987, 2 steps, Unsubscribe as Link saved);
//  - production shows the unsubscribe in Zoho 1 to 3 minutes after it, so every look waits up to 3 minutes;
//  - after a trigger is saved the page is reloaded and the saved actions are read back, and the check stops
//    before any send when "Email Sent from Saleshandy" or "Email is Opened in Saleshandy" is on;
//  - the tag is not asserted (it was never seen in a record text); Logs are not read for Zoho (QA, 2026-10-29).
// Check 1 unsubscribes by the real link (93 s after the send). Checks 2 to 8 use Mark as Unsubscribe on the Prospects tab.
// Every check sends step 1 (Send now). Checks do not delete what they create.
//
// Run through scripts/run-zoho-prospect-unsubscribed-smoke.sh (npm run smoke:zoho-prospect-unsubscribed), which runs the gate
// (tests/setup/zoho-prod-gate.spec.ts) first. Needs, once:
//   npm run login:saleshandy -- emailopenedprod    (headed, Cloudflare blocks headless)
//   auth/zoho-prospect-unsubscribed-smoke-profile  (copy of the saved Zoho profile, made by the run script)
// Data: test-data/zoho/prospect-unsubscribed-smoke.csv (scripts/make-zoho-prospect-unsubscribed-smoke-data.ts).
import path from 'node:path';
import { chromium } from 'playwright';
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { ZOHO_ACTION, fullName } from '../../src/flows/saleshandy-to-zoho.ts';
import { configureWaiting, inDays } from '../../src/flows/zoho-email-sent.ts';
import { NOTE_TITLE, TRIGGER, unsubscribeByLink, unsubscribeUi } from '../../src/flows/zoho-prospect-unsubscribed.ts';
import { ZOHO_ORG, ZohoCrmPage } from '../../src/pages/zoho/zoho-crm.page.ts';
import { ZohoForms } from '../../src/pages/zoho/zoho-forms.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';

// Other smoke runs may share emailopenedprod, so saving a trigger leaves the other triggers as they are.
process.env.KEEP_OTHER_TRIGGERS ??= '1';

const CSV = 'zoho/prospect-unsubscribed-smoke.csv';
const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '';
const PROFILE = path.resolve(import.meta.dirname, '../../auth/zoho-prospect-unsubscribed-smoke-profile');
const SIBLING_TRIGGERS = ['Email Sent from Saleshandy', 'Email is Opened in Saleshandy'];

// Production shows the unsubscribe in Zoho 1 to 3 minutes after it, so each look waits up to 3 minutes.
const LOOK = 3 * 60_000;
// One check = a trigger save, records made by hand, a send, the unsubscribe, the wait and slow production pages.
const ROW_TIMEOUT = 14 * 60_000;
const TASK = { subject: 'Follow up after unsubscribe', status: 'Not Started', priority: 'Normal', dueIn: '3' };

const test = base.extend<object, { crm: ZohoCrmPage }>({
  crm: [
    async ({}, use) => {
      // Zoho page loads time out now and then (net::ERR_TIMED_OUT, seen 2026-11-03). Every load is retried up to 4 times.
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
type Env = Pick<Fx, 'zohoIntegration' | 'saleshandyPage' | 'saleshandySequence' | 'mailinator' | 'crm'>;

// The Scenario column holds "Smoke > <#>".
function prospect(scenario: string): Row {
  if (!SEQUENCE_ID) throw new Error('SMOKE_SEQUENCE_ID is not set. Use scripts/run-zoho-prospect-unsubscribed-smoke.sh.');
  const found = readCsv(CSV).find((r) => r['Scenario'] === scenario);
  if (!found) throw new Error(`No row "${scenario}" in test-data/${CSV}. Run scripts/make-zoho-prospect-unsubscribed-smoke-data.ts.`);
  // Twitter in Zoho is a handle, not a URL (Z-1: a wrong-type value makes Zoho reject the whole record).
  const handle = found['Twitter'].split('/').filter(Boolean).pop() ?? '';
  const company = found['Company'] ? `${found['Company']} ${stamp}` : '';
  const row: Row = { ...found, Twitter: handle, Company: company };
  markUsed(CSV, row['Email']);
  return row;
}

// Saves the trigger's actions, reloads the page and reads the saved actions back.
// Stops before any send when Email Sent or Email Opened is on: a send would run their actions too.
async function useTrigger(fx: Pick<Env, 'zohoIntegration' | 'saleshandyPage'>, picks: Parameters<typeof configureWaiting>[3]): Promise<void> {
  await configureWaiting(fx.zohoIntegration, fx.saleshandyPage, TRIGGER, picks);
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

// Adds the prospect, sends step 1 (Send now) and marks it as unsubscribed on the Prospects tab.
const unsubscribe = (fx: Env, row: Row): Promise<void> =>
  test.step(`Add ${fullName(row)} to the sequence, send step 1 and mark it as unsubscribed`, () => unsubscribeUi(fx.saleshandySequence, SEQUENCE_ID, row));

const phoneDigits = (s: string): string => s.replace(/\D/g, '');
// An empty field shows no value in the record text, so ZohoCrmPage.field returns the label on the next line
// (seen 2026-11-02). A field is empty when it reads '' or that next label.
const emptyField = (text: string, label: string, nextLabel: string): boolean => {
  const value = ZohoCrmPage.field(text, label);
  return value === '' || value === nextLabel;
};

test.describe('Zoho Prospect Unsubscribed (production smoke)', () => {
  test.setTimeout(ROW_TIMEOUT);

  // ---- Create/Update a Contact in Zoho ----

  test('1 Contact: prospect not in Zoho, unsubscribe by the link', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Smoke > 1');
    await useTrigger({ zohoIntegration, saleshandyPage }, [{ action: ZOHO_ACTION.contact }]);
    // Sends step 1, then opens "Unsubscribe here" 93 s later (a click sooner after the send is not counted, seen 2026-11-04 on staging).
    await unsubscribeByLink(saleshandySequence, mailinator, SEQUENCE_ID, row);
    await saleshandySequence.expectProspectStatus(SEQUENCE_ID, row['Email'], 'Unsubscribed');
    const found = await crm.waitForRecord('Contacts', row['Email'], LOOK);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    const text = await crm.waitForNotes('Contacts', found!.id, 1, LOOK);
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    for (const value of [row['Job Title'], row['Department'], row['Twitter'], row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(phoneDigits(text)).toContain(phoneDigits(row['Phone Number']));
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
    expect(text, 'The note title').toContain(NOTE_TITLE);
    expect((await crm.find('Contacts', row['Email'])).length, 'One unsubscribe must make one contact').toBe(1);
  });

  test('2 Contact: contact exists with an old Title', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm };
    const row = prospect('Smoke > 2');
    const id = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'], title: 'Old Title' });
    await useTrigger(fx, [{ action: ZOHO_ACTION.contact }]);
    await unsubscribe(fx, row);
    await untilPasses('the contact is updated', async () => {
      const text = await crm.recordText('Contacts', id);
      expect(text).toContain(row['Job Title']);
      expect(text).not.toContain('Old Title');
    }, LOOK);
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'Still one contact').toEqual([id]);
  });

  // ---- Create/Update a Lead in Zoho ----

  test('3 Lead: prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm };
    const row = prospect('Smoke > 3');
    await useTrigger(fx, [{ action: ZOHO_ACTION.lead }]);
    await unsubscribe(fx, row);
    const found = await crm.waitForRecord('Leads', row['Email'], LOOK);
    expect(found, `No Zoho lead for ${row['Email']}`).toBeTruthy();
    const text = await crm.waitForNotes('Leads', found!.id, 1, LOOK);
    expect(ZohoCrmPage.field(text, 'Company')).toBe(row['Company']);
    for (const value of [row['Job Title'], row['City']]) expect(text).toContain(value);
    expect(phoneDigits(text), 'The lead phone').toContain(phoneDigits(row['Phone Number']));
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
    // Seen 2026-10-31: a Lead-only unsubscribe makes no contact.
    expect((await crm.find('Contacts', row['Email'])).length, 'A Lead-only unsubscribe makes no contact').toBe(0);
    expect((await crm.find('Leads', row['Email'])).length, 'One unsubscribe must make one lead').toBe(1);
  });

  // ---- Create/Update Account in Zoho ----

  test('4 Account: prospect has a company, no contact, no account', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm };
    const row = prospect('Smoke > 4');
    await useTrigger(fx, [{ action: ZOHO_ACTION.account }]);
    await unsubscribe(fx, row);
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

  test('5 Deal: prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm };
    const row = prospect('Smoke > 5');
    await useTrigger(fx, [{ action: ZOHO_ACTION.deal, closingDays: '0' }]);
    await unsubscribe(fx, row);
    const found = await crm.waitForRecord('Deals', fullName(row), LOOK);
    expect(found, `No Zoho deal named ${fullName(row)}`).toBeTruthy();
    const text = await crm.recordText('Deals', found!.id);
    expect(ZohoCrmPage.field(text, 'Deal Name')).toBe(fullName(row));
    expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
    expect(emptyField(text, 'Contact Name', 'Modified By'), 'The deal is not linked to a contact').toBe(true);
    expect((await crm.find('Deals', fullName(row))).length, 'One unsubscribe must make one deal').toBe(1);
    // Z-5 (known): the deal also makes an account named after the company.
    expect(await crm.waitForRecord('Accounts', row['Company'], 30_000)).toBeTruthy();
  });

  test('6 Deal: contact has 2 deals', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm };
    const row = prospect('Smoke > 6');
    const forms = new ZohoForms(crm);
    await forms.createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    const olderName = `Older Deal ${stamp} ${row['Last Name']}`;
    const newerName = `Newer Deal ${stamp} ${row['Last Name']}`;
    const olderId = await forms.createDeal({ name: olderName, closing: inDays(30), contact: fullName(row), amount: '100' });
    // The newest deal is the one made last. A pause makes the order clear in Zoho.
    await crm.page.waitForTimeout(60_000);
    const newerId = await forms.createDeal({ name: newerName, closing: inDays(30), contact: fullName(row), amount: '200' });
    await useTrigger(fx, [{ action: ZOHO_ACTION.deal, closingDays: '0' }]);
    await unsubscribe(fx, row);
    await untilPasses('the newest deal is updated', async () => {
      expect(ZohoCrmPage.field(await crm.recordText('Deals', newerId), 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
    }, LOOK);
    const older = await crm.recordText('Deals', olderId);
    expect(ZohoCrmPage.field(older, 'Amount'), 'The older deal is unchanged').toContain('100.00');
    expect(ZohoCrmPage.noteCount(older), 'No note on the older deal').toBe(0);
    expect((await crm.find('Deals', olderName)).length + (await crm.find('Deals', newerName)).length, 'No new deal').toBe(2);
  });

  // ---- Create a Task in Zoho ----

  test('7 Task: prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm };
    const row = prospect('Smoke > 7');
    await useTrigger(fx, [{ action: ZOHO_ACTION.task, task: TASK }]);
    await unsubscribe(fx, row);
    const found = await crm.waitForRecord('Tasks', fullName(row), LOOK);
    expect(found, `No Zoho task for ${fullName(row)}`).toBeTruthy();
    const text = await crm.recordText('Tasks', found!.id);
    expect(ZohoCrmPage.field(text, 'Subject')).toBe(TASK.subject);
    expect(ZohoCrmPage.field(text, 'Status')).toBe(TASK.status);
    expect(ZohoCrmPage.field(text, 'Priority')).toBe(TASK.priority);
    expect(ZohoCrmPage.field(text, 'Due Date')).toBe(inDays(3));
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    expect((await crm.find('Tasks', fullName(row))).length, 'One unsubscribe must make one task').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The contact is created first').toBe(1);
  });

  // ---- Combined actions ----

  test('8 Combined: Contact, Lead, Account, Deal and Task, prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm };
    const row = prospect('Smoke > 8');
    await useTrigger(fx, [
      { action: ZOHO_ACTION.contact },
      { action: ZOHO_ACTION.lead },
      { action: ZOHO_ACTION.account },
      { action: ZOHO_ACTION.deal, closingDays: '0' },
      { action: ZOHO_ACTION.task, task: TASK },
    ]);
    await unsubscribe(fx, row);
    const contact = await crm.waitForRecord('Contacts', row['Email'], LOOK);
    expect(contact, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    expect(await crm.waitForRecord('Leads', row['Email'], LOOK), `No Zoho lead for ${row['Email']}`).toBeTruthy();
    expect(await crm.waitForRecord('Deals', fullName(row), LOOK), `No Zoho deal for ${fullName(row)}`).toBeTruthy();
    expect(await crm.waitForRecord('Tasks', fullName(row), LOOK), `No Zoho task for ${fullName(row)}`).toBeTruthy();
    expect((await crm.find('Contacts', row['Email'])).length, 'One contact').toBe(1);
    expect((await crm.find('Leads', row['Email'])).length, 'One lead').toBe(1);
    expect((await crm.find('Deals', fullName(row))).length, 'One deal').toBe(1);
    expect((await crm.find('Tasks', fullName(row))).length, 'One task').toBe(1);
    expect(await crm.waitForNotes('Contacts', contact!.id, 1, LOOK), 'A note on the contact').toContain(NOTE_TITLE);
    // Accounts: Z-5 (known) allows more than one, so they are not counted.
  });
});
