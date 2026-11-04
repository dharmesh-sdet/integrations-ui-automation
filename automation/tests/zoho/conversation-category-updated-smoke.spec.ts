// Production smoke test: Conversation Category is Updated in Saleshandy, Zoho.
// Checklist: notes/production-testing/20-zoho-conversation-category-updated.md (QA "looks good" 2026-11-04, 8 checks,
// no workflow ticket known). The workflow is not deployed on production yet, so QA runs the script after the deploy.
// Each test body follows the staging test of the same action in tests/zoho/conversation-category-updated.spec.ts
// (18 of 20, 2026-11-03), so a check passes or fails on the same assertions.
// Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts); Zoho CRM is the same
//    org (crm.zoho.com), read in a headed browser on its own copy of the saved profile;
//  - the sequence comes from SMOKE_SEQUENCE_ID (made by tests/setup/zoho-conversation-category-updated-smoke-sequence.spec.ts);
//  - production shows the record in Zoho 1 to 3 minutes after the outcome change, so every look waits up to 3 minutes;
//  - after a trigger is saved the page is reloaded and the saved actions and categories are read back, and the check
//    stops before any send when "Email Sent from Saleshandy" or "Email is Opened in Saleshandy" is on;
//  - Logs are not read for Zoho (QA, 2026-10-29).
// Every check sends step 1 (Send now), then changes the outcome in Sequence > Prospects. Checks do not delete what
// they create.
//
// Run through scripts/run-zoho-conversation-category-updated-smoke.sh (npm run smoke:zoho-conversation-category-updated),
// which runs the gate (tests/setup/zoho-prod-gate.spec.ts) and the sequence setup first. Needs, once:
//   npm run login:saleshandy -- emailopenedprod    (headed, Cloudflare blocks headless)
//   auth/zoho-conversation-category-updated-smoke-profile (copy of the saved Zoho profile, made by the run script)
// Data: test-data/zoho/conversation-category-updated-smoke.csv (scripts/make-zoho-conversation-category-updated-smoke-data.ts).
import path from 'node:path';
import { chromium } from 'playwright';
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { ZOHO_ACTION, fullName } from '../../src/flows/saleshandy-to-zoho.ts';
import { inDays, sendStep } from '../../src/flows/zoho-email-sent.ts';
import {
  NOTE_PREFIX,
  OUTCOME,
  TRIGGER,
  configureCategory,
  expectSavedCategory,
  outcomeNotes,
  type CategoryAction,
} from '../../src/flows/zoho-conversation-category-updated.ts';
import { ZOHO_ORG, ZohoCrmPage } from '../../src/pages/zoho/zoho-crm.page.ts';
import { ZohoForms } from '../../src/pages/zoho/zoho-forms.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';

// Other smoke runs may share emailopenedprod, so saving a trigger leaves the other triggers as they are.
process.env.KEEP_OTHER_TRIGGERS ??= '1';

const CSV = 'zoho/conversation-category-updated-smoke.csv';
const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '';
// Row 7 puts both deals on an account that already exists in Zoho. A new account takes minutes to show in the Deal form's Account list (2026-11-04, two production runs).
const DEAL_ACCOUNT = process.env.SMOKE_DEAL_ACCOUNT ?? 'Deal Account 1793774511475';
const PROFILE = path.resolve(import.meta.dirname, '../../auth/zoho-conversation-category-updated-smoke-profile');
const SIBLING_TRIGGERS = ['Email Sent from Saleshandy', 'Email is Opened in Saleshandy'];

// Production shows the record in Zoho 1 to 3 minutes after the outcome change, so each look waits up to 3 minutes.
const LOOK = 3 * 60_000;
// One check = a trigger save, records made by hand, a send, an outcome change, the wait and slow production pages.
const ROW_TIMEOUT = 12 * 60_000;
const TASK = { subject: 'Follow up after outcome change', status: 'Not Started', priority: 'Normal', dueIn: '3' };

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
  if (!found) throw new Error(`No row "${scenario}" in test-data/${CSV}. Run scripts/make-zoho-conversation-category-updated-smoke-data.ts.`);
  // Twitter in Zoho is a handle, not a URL (Z-1: a wrong-type value makes Zoho reject the whole record).
  const handle = found['Twitter'].split('/').filter(Boolean).pop() ?? '';
  const company = found['Company'] ? `${found['Company']} ${stamp}` : '';
  const row: Row = { ...found, Twitter: handle, Company: company };
  markUsed(CSV, row['Email']);
  return row;
}

// Saves the trigger, reloads the page and reads the saved actions and categories back.
// Stops before any send when Email Sent or Email Opened is on: a send would run their actions too.
async function useTrigger(fx: Env, actions: CategoryAction[]): Promise<void> {
  await configureCategory(fx.zohoIntegration, fx.saleshandyPage, actions);
  await test.step('Reload and read the saved trigger back', async () => {
    await fx.saleshandyPage.reload();
    await fx.zohoIntegration.openTriggers();
    expect(await fx.zohoIntegration.isTriggerOn(TRIGGER), `"${TRIGGER}" is on after the reload`).toBe(true);
    expect(await fx.zohoIntegration.selectedActivities(TRIGGER), 'Saved actions after the reload').toEqual(actions.map((a) => a.action));
    for (const sibling of SIBLING_TRIGGERS) {
      expect(await fx.zohoIntegration.isTriggerOn(sibling), `"${sibling}" is on. Turn it off and run again. Nothing was sent.`).toBe(false);
    }
    for (const a of actions) if (a.category !== undefined) await expectSavedCategory(fx.zohoIntegration, fx.saleshandyPage, a.action, a.category);
  });
}

// Adds the prospect to the sequence, sends step 1 (Send now, the Emails tab shows Sent), then changes the outcome.
async function sendAndChange(fx: Env, row: Row, outcome: string): Promise<void> {
  if (!SEQUENCE_ID) throw new Error('SMOKE_SEQUENCE_ID is not set. Use scripts/run-zoho-conversation-category-updated-smoke.sh.');
  await test.step(`Add ${fullName(row)} to the sequence, send step 1 and set the outcome to ${outcome}`, async () => {
    await sendStep(fx.saleshandySequence, SEQUENCE_ID, row);
    await fx.saleshandySequence.setProspectOutcome(SEQUENCE_ID, row['Email'], outcome);
  });
}

// Waits until a record's page shows the note of the outcome event; returns the page text.
async function noteText(crm: ZohoCrmPage, module: 'Contacts' | 'Leads' | 'Accounts' | 'Deals' | 'Tasks', id: string, outcome: string): Promise<string> {
  let text = '';
  await untilPasses(`${module} ${id} shows a "${NOTE_PREFIX} ${outcome}" note`, async () => {
    text = await crm.recordText(module, id);
    expect(outcomeNotes(text)).toBeGreaterThanOrEqual(1);
    expect(text).toContain(`${NOTE_PREFIX} ${outcome}`);
  }, LOOK);
  return text;
}

const phoneDigits = (s: string): string => s.replace(/\D/g, '');

test.describe('Zoho Conversation Category is Updated (production smoke)', () => {
  test.setTimeout(ROW_TIMEOUT);

  // ---- Create/Update a Contact in Zoho ----

  const contactPick: CategoryAction[] = [{ action: ZOHO_ACTION.contact, category: OUTCOME.interested }];

  test('1 Contact: prospect not in Zoho, outcome Interested', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 1');
    await useTrigger(fx, contactPick);
    await sendAndChange(fx, row, OUTCOME.interested);
    const found = await crm.waitForRecord('Contacts', row['Email'], LOOK);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    const text = await noteText(crm, 'Contacts', found!.id, OUTCOME.interested);
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    for (const value of [row['Job Title'], row['Department'], row['Twitter'], row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(phoneDigits(text)).toContain(phoneDigits(row['Phone Number']));
    expect(text, 'Note carries the smoke sequence link').toContain(`/sequence/${SEQUENCE_ID}/`);
    expect(outcomeNotes(text), 'One note').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'One outcome change must make one contact').toBe(1);
  });

  test('2 Contact: prospect not in Zoho, outcome Not Interested', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 2');
    await useTrigger(fx, contactPick);
    await sendAndChange(fx, row, OUTCOME.notInterested);
    // Run C2: the category is Interested and the outcome is not, so the gate is false. Wait the full production
    // time, then check that nothing was made.
    expect(await crm.waitForRecord('Contacts', row['Email'], LOOK), 'No contact and no note').toBeUndefined();
  });

  test('3 Contact: contact exists with an old Title', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 3');
    const id = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'], title: 'Old Title' });
    await useTrigger(fx, contactPick);
    await sendAndChange(fx, row, OUTCOME.interested);
    await untilPasses('the contact is updated', async () => {
      const text = await crm.recordText('Contacts', id);
      expect(text).toContain(row['Job Title']);
      expect(text).not.toContain('Old Title');
    }, LOOK);
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'Still one contact').toEqual([id]);
  });

  // ---- Create/Update a Lead in Zoho ----

  test('4 Lead: prospect not in Zoho, has a company, outcome Not Interested', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 4');
    await useTrigger(fx, [{ action: ZOHO_ACTION.lead, category: OUTCOME.notInterested }]);
    await sendAndChange(fx, row, OUTCOME.notInterested);
    const found = await crm.waitForRecord('Leads', row['Email'], LOOK);
    expect(found, `No Zoho lead for ${row['Email']}`).toBeTruthy();
    const text = await noteText(crm, 'Leads', found!.id, OUTCOME.notInterested);
    expect(ZohoCrmPage.field(text, 'Company')).toBe(row['Company']);
    for (const value of [row['Job Title'], row['City']]) expect(text).toContain(value);
    expect(phoneDigits(text)).toContain(phoneDigits(row['Phone Number']));
    expect((await crm.find('Leads', row['Email'])).length, 'One outcome change must make one lead').toBe(1);
  });

  // ---- Create/Update Account in Zoho ----

  test('5 Account: prospect has a company, no contact, no account, outcome Out of Office', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 5');
    await useTrigger(fx, [{ action: ZOHO_ACTION.account, category: OUTCOME.outOfOffice }]);
    await sendAndChange(fx, row, OUTCOME.outOfOffice);
    const found = await crm.waitForRecord('Accounts', row['Company'], LOOK);
    expect(found, `No Zoho account named ${row['Company']}`).toBeTruthy();
    const text = await noteText(crm, 'Accounts', found!.id, OUTCOME.outOfOffice);
    expect(ZohoCrmPage.field(text, 'Account Name')).toBe(row['Company']);
    for (const value of [row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect((await crm.find('Accounts', row['Company'])).length).toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The Account action must not link or create a contact').toBe(0);
  });

  // ---- Create/Update a Deal in Zoho ----

  const dealPick: CategoryAction[] = [{ action: ZOHO_ACTION.deal, closingDays: '0', category: OUTCOME.closed }];

  test('6 Deal: prospect not in Zoho, has a company, outcome Closed', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 6');
    await useTrigger(fx, dealPick);
    await sendAndChange(fx, row, OUTCOME.closed);
    const found = await crm.waitForRecord('Deals', fullName(row), LOOK);
    expect(found, `No Zoho deal named ${fullName(row)}`).toBeTruthy();
    const text = await noteText(crm, 'Deals', found!.id, OUTCOME.closed);
    expect(ZohoCrmPage.field(text, 'Deal Name')).toBe(fullName(row));
    expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
    expect(ZohoCrmPage.field(text, 'Stage')).toBe('Qualification');
    expect(ZohoCrmPage.field(text, 'Closing Date')).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    // An empty Contact Name is followed directly by the next label ("Modified By").
    expect(ZohoCrmPage.field(text, 'Contact Name', 'Modified By')).toBe('');
    expect((await crm.find('Deals', fullName(row))).length, 'One outcome change must make one deal').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The Deal action must not create a contact').toBe(0);
    // Z-5 (known): the deal also makes an account named after the company. Recorded.
    expect(await crm.waitForRecord('Accounts', row['Company'], 30_000)).toBeTruthy();
  });

  test('7 Deal: contact has 2 deals, outcome Closed', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 7');
    const forms = new ZohoForms(crm);
    await forms.createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    const olderName = `Older Deal ${stamp} ${row['Last Name']}`;
    const newerName = `Newer Deal ${stamp} ${row['Last Name']}`;
    const olderId = await forms.createDeal({ name: olderName, closing: inDays(30), contact: fullName(row), amount: '100', account: DEAL_ACCOUNT });
    // The newest deal is the one made last. A pause makes the order clear in Zoho.
    await crm.page.waitForTimeout(60_000);
    const newerId = await forms.createDeal({ name: newerName, closing: inDays(30), contact: fullName(row), amount: '200', account: DEAL_ACCOUNT });
    await useTrigger(fx, dealPick);
    await sendAndChange(fx, row, OUTCOME.closed);
    await untilPasses('the newest deal is updated', async () => {
      const text = await crm.recordText('Deals', newerId);
      expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
      expect(outcomeNotes(text)).toBeGreaterThanOrEqual(1);
    }, LOOK);
    const older = await crm.recordText('Deals', olderId);
    expect(ZohoCrmPage.field(older, 'Amount'), 'The older deal is unchanged').toContain('100.00');
    expect(ZohoCrmPage.noteCount(older), 'No note on the older deal').toBe(0);
    expect((await crm.find('Deals', olderName)).length + (await crm.find('Deals', newerName)).length, 'No new deal').toBe(2);
  });

  // ---- Create a Task in Zoho ----

  test('8 Task: prospect not in Zoho, outcome Do Not Contact', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, crm };
    const row = prospect('Smoke > 8');
    await useTrigger(fx, [{ action: ZOHO_ACTION.task, task: TASK, category: OUTCOME.doNotContact }]);
    await sendAndChange(fx, row, OUTCOME.doNotContact);
    const found = await crm.waitForRecord('Tasks', fullName(row), LOOK);
    expect(found, `No Zoho task for ${fullName(row)}`).toBeTruthy();
    const text = await crm.recordText('Tasks', found!.id);
    expect(ZohoCrmPage.field(text, 'Subject')).toBe(TASK.subject);
    expect(ZohoCrmPage.field(text, 'Status')).toBe(TASK.status);
    expect(ZohoCrmPage.field(text, 'Priority')).toBe(TASK.priority);
    expect(ZohoCrmPage.field(text, 'Due Date')).toBe(inDays(3));
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    expect((await crm.find('Tasks', fullName(row))).length, 'One outcome change must make one task').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The contact is created first').toBe(1);
  });
});
