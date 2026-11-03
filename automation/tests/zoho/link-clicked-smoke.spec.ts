// Production smoke test: Link is Clicked in Saleshandy, Zoho.
// Checklist: notes/production-testing/17-zoho-link-clicked.md (approved by QA 2026-11-03, 8 checks, no fixed
// bug ticket; AL-4194 is the workflow ticket). Each test body follows the staging test of the same action in
// tests/zoho/link-clicked.spec.ts (23 of 23, 2026-11-03), so a check passes or fails on the same assertions.
// Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts); Zoho CRM is the same
//    org (crm.zoho.com), read in a headed browser on its own copy of the saved profile;
//  - the sequence comes from SMOKE_SEQUENCE_ID, nothing production is hard-coded;
//  - production counts a first click only 90 s after the send and a second click 180 s after the first
//    (developer, 2026-10-15), so a click waits for that time first;
//  - after a trigger is saved the page is reloaded and the saved action is read back, and the check stops
//    before any send when "Email Sent from Saleshandy" or "Email is Opened in Saleshandy" is on;
//  - Logs are not read for Zoho (QA, 2026-10-29).
// Checks do not delete what they create. The workflow is not deployed on production yet (2026-11-03), so do
// not run this file before the deploy.
//
// Run through scripts/run-zoho-link-clicked-smoke.sh (npm run smoke:zoho-link-clicked), which runs the gate
// (tests/setup/zoho-prod-gate.spec.ts) first. Needs, once:
//   npm run login:saleshandy -- emailopenedprod    (headed, Cloudflare blocks headless)
//   auth/zoho-link-clicked-smoke-profile           (copy of the saved Zoho profile, made by the run script)
// Data: test-data/zoho/link-clicked-smoke.csv (scripts/make-zoho-link-clicked-smoke-data.ts).
import path from 'node:path';
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { ZOHO_ACTION, configure, fullName } from '../../src/flows/saleshandy-to-zoho.ts';
import { inDays, sendStep } from '../../src/flows/zoho-email-sent.ts';
import { OPENED_TRIGGER, STEP_1_SUBJECT as DEFAULT_SUBJECT, TRIGGER, clickNotes } from '../../src/flows/zoho-link-clicked.ts';
import { ZohoCrmPage, openZohoProfile } from '../../src/pages/zoho/zoho-crm.page.ts';
import { ZohoForms } from '../../src/pages/zoho/zoho-forms.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';

// Other smoke runs may share emailopenedprod, so saving a trigger leaves the other triggers as they are.
process.env.KEEP_OTHER_TRIGGERS ??= '1';

const CSV = 'zoho/link-clicked-smoke.csv';
const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '';
// Printed by the setup spec; the same text is the subject of step 1.
const STEP_1_SUBJECT = process.env.SMOKE_STEP1_SUBJECT ?? DEFAULT_SUBJECT;
const PROFILE = path.resolve(import.meta.dirname, '../../auth/zoho-link-clicked-smoke-profile');
const SIBLING_TRIGGERS = ['Email Sent from Saleshandy', OPENED_TRIGGER];

// Production click timing (developer, 2026-10-15): a first click is counted 90 s after the send, a second
// click 180 s after the first.
const FIRST_CLICK_AFTER = 90_000;
const SECOND_CLICK_AFTER = 180_000;
// One check = a trigger save, records made by hand, a Send now, the wait, the click and slow production pages.
const ROW_TIMEOUT = 14 * 60_000;
const TASK = { subject: 'Follow up after click', status: 'Not Started', priority: 'Normal', dueIn: '3' };

const test = base.extend<object, { crm: ZohoCrmPage }>({
  crm: [
    async ({}, use) => {
      // The first page load can time out too (seen on the production smoke 2026-11-03), so the open is retried.
      let opened: Awaited<ReturnType<typeof openZohoProfile>> | undefined;
      for (let attempt = 1; !opened; attempt++) {
        try {
          opened = await openZohoProfile(PROFILE);
        } catch (e) {
          if (attempt >= 4 || !/ERR_TIMED_OUT|ERR_CONNECTION|ERR_NETWORK|ERR_NAME|Timeout/.test(String(e))) throw e;
          await new Promise((r) => setTimeout(r, 5_000));
        }
      }
      const { context, crm } = opened;
      // Zoho page loads time out now and then (net::ERR_TIMED_OUT, seen 2026-11-03). Retry a load up to 4 times.
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

type Prospect = { row: Row; email: string; name: string; sentAt: number; firstClickAt: number };
type Fx = Parameters<Parameters<typeof test>[2]>[0];
type Env = Pick<Fx, 'zohoIntegration' | 'saleshandyPage' | 'saleshandySequence' | 'mailinator' | 'crm'>;

// The Scenario column holds "Smoke > <#>".
function prospect(scenario: string): Prospect {
  const found = readCsv(CSV).find((r) => r['Scenario'] === scenario);
  if (!found) throw new Error(`No row "${scenario}" in test-data/${CSV}. Run scripts/make-zoho-link-clicked-smoke-data.ts.`);
  // Twitter in Zoho is a handle, not a URL (Z-1: a wrong-type value makes Zoho reject the whole record).
  const handle = found['Twitter'].split('/').filter(Boolean).pop() ?? '';
  const company = found['Company'] ? `${found['Company']} ${stamp}` : '';
  const row: Row = { ...found, Twitter: handle, Company: company };
  markUsed(CSV, row['Email']);
  return { row, email: row['Email'], name: fullName(row), sentAt: 0, firstClickAt: 0 };
}

// Saves the trigger with the check's action, reloads the page and reads the saved action back.
// Stops before any send when Email Sent or Email is Opened is on: a send would create the contact first,
// and an open would run its own actions.
async function useTrigger(fx: Env, picks: Parameters<typeof configure>[3]): Promise<void> {
  await configure(fx.zohoIntegration, fx.saleshandyPage, TRIGGER, picks);
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

// Adds the prospect and sends step 1 (Send now). The send time starts the production click clock.
async function send(fx: Env, p: Prospect): Promise<void> {
  if (!SEQUENCE_ID) throw new Error('SMOKE_SEQUENCE_ID is not set. Use scripts/run-zoho-link-clicked-smoke.sh.');
  await test.step(`Add ${p.name} to the sequence and send step 1`, () => sendStep(fx.saleshandySequence, SEQUENCE_ID, p.row));
  p.sentAt = Date.now();
}

// Clicks link `link` (0 = first) of the step 1 email in the Mailinator inbox once production counts it (90 s
// after the send for a first click, 180 s after the first for a second one), then waits until the Clicked count
// rises. Returns the count, which a link scanner can push above the number of clicks (Z-10).
async function click(fx: Env, p: Prospect, second = false): Promise<number> {
  const wait = second ? p.firstClickAt + SECOND_CLICK_AFTER - Date.now() : p.sentAt + FIRST_CLICK_AFTER - Date.now();
  if (wait > 0) await test.step(`Wait ${Math.ceil(wait / 1000)} s so production counts the click`, () => fx.saleshandySequence.page.waitForTimeout(wait));
  const clicked = () => fx.saleshandySequence.clickedCount(SEQUENCE_ID, p.name, 1, p.email);
  const before = await clicked();
  await test.step(`Click link ${second ? 2 : 1} of the step 1 email in the Mailinator inbox of ${p.email}`, () =>
    fx.mailinator.clickFirstLink(p.email, STEP_1_SUBJECT, second ? 1 : 0),
  );
  if (!second) p.firstClickAt = Date.now();
  let count = before;
  await test.step(`Wait until the Clicked count is above ${before}`, () =>
    untilPasses(`Clicked count for ${p.email} did not rise above ${before}`, async () => {
      count = await clicked();
      expect(count).toBeGreaterThan(before);
    }, 4 * 60_000),
  );
  test.info().annotations.push({ type: `Clicked count (${second ? 'second' : 'first'} click)`, description: String(count) });
  return count;
}

// Waits until the record's page shows at least `atLeast` "Click Count" notes; returns the count seen.
async function clickNotesAtLeast(crm: ZohoCrmPage, module: 'Contacts' | 'Leads' | 'Accounts' | 'Deals' | 'Tasks', id: string, atLeast: number): Promise<number> {
  let seen = 0;
  await untilPasses(`${module} ${id} shows ${atLeast} Click Count note(s)`, async () => {
    seen = clickNotes(await crm.recordText(module, id));
    expect(seen).toBeGreaterThanOrEqual(atLeast);
  }, 3 * 60_000);
  test.info().annotations.push({ type: `Click Count notes on ${module}`, description: String(seen) });
  return seen;
}

const phoneDigits = (s: string): string => s.replace(/\D/g, '');

test.describe('Zoho Link Clicked (production smoke)', () => {
  test.setTimeout(ROW_TIMEOUT);

  // ---- Create/Update a Contact in Zoho ----

  test('1 Contact: prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm };
    const p = prospect('Smoke > 1');
    await useTrigger(fx, [{ action: ZOHO_ACTION.contact }]);
    await send(fx, p);
    await click(fx, p);
    const found = await crm.waitForRecord('Contacts', p.email);
    expect(found, `No Zoho contact for ${p.email}`).toBeTruthy();
    const text = await crm.recordText('Contacts', found!.id);
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(p.name);
    for (const value of [p.row['Job Title'], p.row['Department'], p.row['Twitter'], p.row['City'], p.row['State'], p.row['Country']]) expect(text).toContain(value);
    expect(phoneDigits(text)).toContain(phoneDigits(p.row['Phone Number']));
    expect(ZohoCrmPage.noteCount(text)).toBeGreaterThanOrEqual(1);
    expect(clickNotes(text)).toBeGreaterThanOrEqual(1);
    expect((await crm.find('Contacts', p.email)).length, 'One click must make one contact').toBe(1);
  });

  test('2 Contact: link clicked a second time', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm };
    const p = prospect('Smoke > 2');
    await useTrigger(fx, [{ action: ZOHO_ACTION.contact }]);
    await send(fx, p);
    await click(fx, p);
    const first = await crm.waitForRecord('Contacts', p.email);
    expect(first, `No Zoho contact for ${p.email}`).toBeTruthy();
    const before = await clickNotesAtLeast(crm, 'Contacts', first!.id, 1);
    const count = await click(fx, p, true);
    expect(count, 'Clicked count after the second link').toBeGreaterThanOrEqual(2);
    // A second note with Click Count 2. A scanner can add more, so "at least one more".
    await clickNotesAtLeast(crm, 'Contacts', first!.id, before + 1);
    expect((await crm.find('Contacts', p.email)).map((r) => r.id), 'Still one contact').toEqual([first!.id]);
  });

  test('3 Contact: contact exists with an old Title', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm };
    const p = prospect('Smoke > 3');
    const id = await new ZohoForms(crm).createContact({ first: p.row['First Name'], last: p.row['Last Name'], email: p.email, title: 'Old Title' });
    await useTrigger(fx, [{ action: ZOHO_ACTION.contact }]);
    await send(fx, p);
    await click(fx, p);
    await untilPasses('the contact is updated', async () => {
      const text = await crm.recordText('Contacts', id);
      expect(text).toContain(p.row['Job Title']);
      expect(text).not.toContain('Old Title');
    }, 3 * 60_000);
    expect((await crm.find('Contacts', p.email)).map((r) => r.id), 'Still one contact').toEqual([id]);
  });

  // ---- Create/Update a Lead in Zoho ----

  test('4 Lead: prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm };
    const p = prospect('Smoke > 4');
    await useTrigger(fx, [{ action: ZOHO_ACTION.lead }]);
    await send(fx, p);
    await click(fx, p);
    const found = await crm.waitForRecord('Leads', p.email);
    expect(found, `No Zoho lead for ${p.email}`).toBeTruthy();
    const text = await crm.recordText('Leads', found!.id);
    expect(ZohoCrmPage.field(text, 'Company')).toBe(p.row['Company']);
    for (const value of [p.row['Job Title'], p.row['City'], p.row['State'], p.row['Country']]) expect(text).toContain(value);
    expect(ZohoCrmPage.noteCount(text)).toBeGreaterThanOrEqual(1);
    expect(clickNotes(text)).toBeGreaterThanOrEqual(1);
    expect((await crm.find('Leads', p.email)).length, 'One click must make one lead').toBe(1);
  });

  // ---- Create/Update Account in Zoho ----

  test('5 Account: prospect has a company, no contact, no account', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm };
    const p = prospect('Smoke > 5');
    await useTrigger(fx, [{ action: ZOHO_ACTION.account }]);
    await send(fx, p);
    await click(fx, p);
    const company = p.row['Company'];
    const found = await crm.waitForRecord('Accounts', company);
    expect(found, `No Zoho account named ${company}`).toBeTruthy();
    const text = await crm.recordText('Accounts', found!.id);
    expect(ZohoCrmPage.field(text, 'Account Name')).toBe(company);
    for (const value of [p.row['City'], p.row['State'], p.row['Country']]) expect(text).toContain(value);
    expect(ZohoCrmPage.noteCount(text)).toBeGreaterThanOrEqual(1);
    expect((await crm.find('Accounts', company)).length).toBe(1);
    expect((await crm.find('Contacts', p.email)).length, 'The Account action must not create a contact').toBe(0);
  });

  // ---- Create/Update a Deal in Zoho ----

  test('6 Deal: prospect not in Zoho, has a company, Closing date 0', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm };
    const p = prospect('Smoke > 6');
    await useTrigger(fx, [{ action: ZOHO_ACTION.deal, closingDays: '0' }]);
    await send(fx, p);
    await click(fx, p);
    const found = await crm.waitForRecord('Deals', p.name);
    expect(found, `No Zoho deal named ${p.name}`).toBeTruthy();
    const text = await crm.recordText('Deals', found!.id);
    expect(ZohoCrmPage.field(text, 'Deal Name')).toBe(p.name);
    expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(p.row['Deal Value']).toLocaleString('en-US'));
    expect(ZohoCrmPage.field(text, 'Stage')).toBe('Qualification');
    expect(ZohoCrmPage.field(text, 'Closing Date')).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(ZohoCrmPage.noteCount(text)).toBeGreaterThanOrEqual(1);
    expect((await crm.find('Deals', p.name)).length, 'One click must make one deal').toBe(1);
    expect((await crm.find('Contacts', p.email)).length, 'The Deal action must not create a contact').toBe(0);
    // Z-5 (known): the deal also makes an account named after the company.
    expect(await crm.waitForRecord('Accounts', p.row['Company'], 30_000)).toBeTruthy();
  });

  test('7 Deal: contact exists and has 2 deals', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm };
    const p = prospect('Smoke > 7');
    const forms = new ZohoForms(crm);
    await forms.createContact({ first: p.row['First Name'], last: p.row['Last Name'], email: p.email });
    // The Account lookup of the deal form can miss a new account for a while (seen 2026-11-03, production). A deal
    // is made only after the lookup, so a retry makes no extra deal.
    const makeDeal = async (name: string, amount: string): Promise<string> => {
      for (let attempt = 1; ; attempt++) {
        try {
          return await forms.createDeal({ name, closing: inDays(30), contact: p.name, amount });
        } catch (e) {
          if (attempt >= 3) throw e;
        }
      }
    };
    const olderId = await makeDeal(`Older Deal ${stamp} ${p.row['Last Name']}`, '100');
    const newerId = await makeDeal(`Newer Deal ${stamp} ${p.row['Last Name']}`, '200');
    await useTrigger(fx, [{ action: ZOHO_ACTION.deal, closingDays: '0' }]);
    await send(fx, p);
    await click(fx, p);
    await untilPasses('the newest deal is updated', async () => {
      const text = await crm.recordText('Deals', newerId);
      expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(p.row['Deal Value']).toLocaleString('en-US'));
      expect(ZohoCrmPage.noteCount(text)).toBeGreaterThanOrEqual(1);
    }, 3 * 60_000);
    const older = await crm.recordText('Deals', olderId);
    expect(ZohoCrmPage.field(older, 'Amount'), 'The older deal is unchanged').toContain('100.00');
    expect(ZohoCrmPage.noteCount(older)).toBe(0);
    expect((await crm.find('Contacts', p.email)).length, 'Still one contact').toBe(1);
  });

  // ---- Create a Task in Zoho ----

  test('8 Task: prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const fx = { zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm };
    const p = prospect('Smoke > 8');
    await useTrigger(fx, [{ action: ZOHO_ACTION.task, task: TASK }]);
    await send(fx, p);
    await click(fx, p);
    const found = await crm.waitForRecord('Tasks', p.name);
    expect(found, `No Zoho task for ${p.name}`).toBeTruthy();
    const text = await crm.recordText('Tasks', found!.id);
    expect(ZohoCrmPage.field(text, 'Subject')).toBe(TASK.subject);
    expect(ZohoCrmPage.field(text, 'Status')).toBe(TASK.status);
    expect(ZohoCrmPage.field(text, 'Priority')).toBe(TASK.priority);
    expect(ZohoCrmPage.field(text, 'Due Date')).toBe(inDays(3));
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(p.name);
    expect(clickNotes(text)).toBeGreaterThanOrEqual(1);
    expect((await crm.find('Tasks', p.name)).length, 'One click must make one task').toBe(1);
    expect((await crm.find('Contacts', p.email)).length).toBe(1);
  });
});
