// Scenarios: test-cases/salesforce/contact-created.md (Regression; AL-4141), 30 rows (Add Prospect 3 removed, QA 2026-11-12: a run reads only Contacts created since the previous run).
// Account: sfemailopened (QA 2026-11-09), so it runs in parallel with Lead on sfreplyreceived: own trigger
// page, own sequences, own Do Not Contact list, own prospects. Contacts are made by REST (src/utils/salesforce-api.ts),
// the workflow is started with run-now (src/flows/refold-run-now.ts), Logs and the prospect are
// read in Saleshandy. People are code, not a CSV: their names matter to the rows (last name
// only, "Van Dyke", an apostrophe, no email) and the email carries the run stamp.
//
// Every run reads up to 200 Contacts of the org and applies the selected activities to all
// of them (dev log:81, :84). So one prospect's state is changed by every later run, and the
// rows run as one chain. The order differs from the case file on purpose:
//   Add Prospect, Tag, Move, status rows (Sequence A first, Sequence B last), then the two
//   rows that hit every prospect of the account (Unsubscribed, Blacklist), then Restore.
// The Expected results are the case file's. Rows that use a sequence need Sequence A and B
// paused, so nobody is emailed: run with SEQUENCES_PAUSED=1. "(proposed, unconfirmed)" rows are
// recorded as "Needs QA" annotations, the others are asserted.
//
// The Unsubscribed and Blacklist rows act on every Contact the run reads and list every domain
// of the org on this account's Do Not Contact list. The last rows remove those activities and
// the new Do Not Contact entries again, and Restore turns the trigger off.
//
// Run: KEEP_TEST_DATA=1 SEQUENCES_PAUSED=1 npx playwright test tests/salesforce/contact-created.spec.ts
import { expect, test } from '../../src/fixtures/index.ts';
import {
  ACTIVITY,
  RUN_STAMP,
  SEQ_A,
  SEQ_B,
  check,
  expectLogSuccess,
  expectProspect,
  expectState,
  pausedIn,
  runNow,
  runNowExpectingError,
  sequence,
  tagged,
  useActivities,
  type Pick,
} from '../../src/flows/salesforce-to-saleshandy.ts';
import { EXPECTED_MAPPING } from '../../src/config/salesforce-field-mapping.ts';
import type { SaleshandyCrmPage } from '../../src/pages/saleshandy/crm.page.ts';
import type { SalesforceIntegrationPage } from '../../src/pages/saleshandy/salesforce-integration.page.ts';
import { SalesforceApi } from '../../src/utils/salesforce-api.ts';
import { staysTrue, untilPasses } from '../../src/utils/wait.ts';

test.use({ account: 'sfemailopened' });

const TRIGGER = 'Contact is created in Salesforce';
const ROW_TIMEOUT_MS = 10 * 60_000;
const ADD: Pick = { activity: ACTIVITY.add };
const MOVE_A: Pick = { activity: ACTIVITY.move, config: sequence(true, SEQ_A) };
const MOVE_B: Pick = { activity: ACTIVITY.move, config: sequence(true, SEQ_B) };

// ---- Salesforce side ----

let session: { api: SalesforceApi; at: number } | undefined;
async function sf(): Promise<SalesforceApi> {
  if (!session || Date.now() - session.at > 20 * 60_000) session = { api: await SalesforceApi.login(), at: Date.now() };
  return session.api;
}

type Person = { first?: string; last: string; local: string; domain?: string; title?: string; phone?: string; department?: string; accountId?: string; noEmail?: boolean; email?: string };
type Made = { email: string; name: string; id?: string };

// One Contact, a new email every run (local part + run stamp). `email` reuses an earlier Contact's
// email: a run reads only Contacts it has not read before (proved 2026-11-12, Refold runs of
// Status 5: run 2 returned 0 records for the Contact run 1 read), so a follow-up run needs a new
// Contact record with the same email, like the follow-up deal in Opportunity created.
async function makeContact(p: Person): Promise<Made> {
  const email = p.email ?? `${p.local}.${RUN_STAMP}@${p.domain ?? 'mailinator.com'}`;
  const name = [p.first, p.last].filter(Boolean).join(' ');
  let id: string | undefined;
  await test.step(`Create the Salesforce Contact ${name}`, async () => {
    id = await (await sf()).createContact({ firstName: p.first, lastName: p.last, email: p.noEmail ? undefined : email, title: p.title, phone: p.phone, department: p.department, accountId: p.accountId });
  });
  return { email, name, id };
}

// Text in the Activities section of the prospect details, read like the Lead created spec does.
// The page renders the sequence name as a link, so the text has two spaces before it.
async function expectActivity(crm: SaleshandyCrmPage, email: string, fullName: string, text: RegExp): Promise<void> {
  await untilPasses(`Activities of ${email} did not show ${text}`, async () => {
    expect(await crm.search(email), `prospects with ${email}`).toBe(1);
    await crm.closeSidebar();
    await crm.openProspect(fullName);
    await expect(crm.page.getByRole('dialog'), 'Activities section').toContainText(text);
    await crm.page.keyboard.press('Escape');
  });
}
const PAUSED_A = new RegExp(`has been paused for \\d+ days for sequence\\s+${SEQ_A}`);

// ---- Saleshandy side ----

const gate = () => test.skip(process.env.SEQUENCES_PAUSED !== '1', 'Applies Move to every Contact of the org. Pause Sequence A and Sequence B, then run with SEQUENCES_PAUSED=1.');

async function runAndLog(sh: SalesforceIntegrationPage): Promise<void> {
  const id = await test.step('Run the workflow now (no 3-hour wait) and wait for COMPLETED', () => runNow(sh.page, TRIGGER));
  await test.step('Find that run in Logs: Success', () => expectLogSuccess(sh, TRIGGER, id));
}

const select = (sh: SalesforceIntegrationPage, picks: Pick[]) =>
  test.step(`Select ${picks.map((p) => `"${p.activity}"`).join(' and ')} under "${TRIGGER}" and Save`, () => useActivities(sh, TRIGGER, picks));

// Puts a Contact's prospect into `sequence`, the setup of the existing-prospect rows.
async function joinSequence(sh: SalesforceIntegrationPage, move: Pick): Promise<void> {
  await select(sh, [move]);
  await runAndLog(sh);
}

// The activities that hit every prospect or domain of the account. Removed again after each
// of their rows, also after a failure, so the 3-hourly cron does not repeat them.
const RISKY = ['Unsubscribed', 'Blacklist'];
async function dropRiskyActivities(sh: SalesforceIntegrationPage): Promise<void> {
  try {
    await sh.openTriggers();
    let removed = false;
    for (const chip of await sh.selectedActivities(TRIGGER)) {
      if (RISKY.some((r) => chip.includes(r))) {
        await sh.removeActivity(TRIGGER, chip);
        removed = true;
      }
    }
    if (removed) {
      await sh.save();
      await expect(sh.savedToast(), 'save confirmation').toBeVisible();
    }
  } catch (e) {
    test.info().annotations.push({ type: 'Cleanup failed', description: `Remove Unsubscribed and Blacklist by hand under "${TRIGGER}": ${(e as Error).message.split('\n')[0]}` });
  }
}

const mailDomain = (email: string) => email.split('@')[1].toLowerCase();

test.describe(TRIGGER, () => {
  // Not serial: a product failure on one row must not hide the rows behind it. File order, one worker.

  // A prospect on a listed domain that is in a sequence shows Blacklisted (QA rule, Lead created
  // 2026-11-11). The Blacklist rows list every domain of the org, mailinator.com included, so it
  // must be off the list before the status rows run. Run this row first with -g "Setup".
  test('Setup: mailinator.com is not on the Do Not Contact list', async ({ saleshandyDnc: dnc }) => {
    await dnc.openGlobalList();
    if (await dnc.hasEntry('mailinator.com')) await dnc.removeEntry('mailinator.com');
    await dnc.openGlobalList();
    expect(await dnc.hasEntry('mailinator.com'), 'mailinator.com on the list').toBe(false);
  });

  // ---- Trigger behavior (baseline) ----

  test('Trigger behavior 1: Field Mapping for Contact, then trigger on with Add Prospect', async ({ salesforceIntegration: sh }) => {
    test.setTimeout(10 * 60_000);
    await test.step('Contact Properties: Phone Number, Department mapped', async () => {
      await sh.openMapping('Contact');
      for (const field of ['Phone Number', 'Department']) {
        expect(await sh.mappedValue(field), `${field} on Contact Properties`).toBe(EXPECTED_MAPPING.Contact[field]);
      }
    });
    await select(sh, [ADD]);
  });

  test('Trigger behavior 2: after Save and reload, toggle and activity are still saved', async ({ salesforceIntegration: sh }) => {
    await sh.openTriggers();
    expect(await sh.isTriggerOn(TRIGGER), `"${TRIGGER}" on after reload`).toBe(true);
    expect((await sh.selectedActivities(TRIGGER)).some((a) => a.includes(ACTIVITY.add))).toBe(true);
  });

  // ---- Activities list and Extra Configuration (nothing saved: the page is reloaded after) ----

  const LIST = [ACTIVITY.add, ACTIVITY.move, ACTIVITY.unsubscribed, ACTIVITY.finished, ACTIVITY.replied, ACTIVITY.paused, ACTIVITY.resume, ACTIVITY.tag, ACTIVITY.blacklist];

  test('Activities list 1: nine activities in order, no "No Data" box', async ({ salesforceIntegration: sh }) => {
    await sh.openTriggers();
    await sh.enableOnly(TRIGGER);
    await sh.openActivityList(TRIGGER);
    const tops: number[] = [];
    for (const name of LIST) {
      const option = sh.activityOption(name);
      await expect(option, name).toBeVisible({ timeout: 15_000 });
      tops.push((await option.boundingBox())?.y ?? -1);
    }
    expect(tops, 'activities in list order, top to bottom').toEqual([...tops].sort((a, b) => a - b));
    await expect(sh.page.getByText('No Data')).toHaveCount(0);
    await sh.openTriggers();
  });

  test('Activities list 2: each activity opens the Extra Configuration of the case file', async ({ salesforceIntegration: sh }) => {
    test.setTimeout(10 * 60_000);
    const want: Record<string, { has: string[]; not?: string[] }> = {
      [ACTIVITY.add]: { has: [] },
      [ACTIVITY.move]: { has: ['Sequence', 'Sequence Steps'] },
      [ACTIVITY.unsubscribed]: { has: [] },
      [ACTIVITY.finished]: { has: ['Sequence'], not: ['Sequence Steps'] },
      [ACTIVITY.replied]: { has: ['Sequence'], not: ['Sequence Steps'] },
      [ACTIVITY.paused]: { has: ['Sequence', 'Pause Delay In Days'] },
      [ACTIVITY.resume]: { has: ['Sequence'], not: ['Sequence Steps'] },
      [ACTIVITY.tag]: { has: ['Avoid using tags that have spaces in them'] },
      [ACTIVITY.blacklist]: { has: [] },
    };
    await sh.openTriggers();
    await sh.enableOnly(TRIGGER);
    for (const [activity, { has, not }] of Object.entries(want)) {
      await test.step(activity, async () => {
        await sh.selectActivity(TRIGGER, activity);
        const dialog = sh.extraConfiguration();
        const opened = await dialog.waitFor({ timeout: 5_000 }).then(() => true, () => false);
        expect(opened, `Extra Configuration dialog of ${activity}`).toBe(has.length > 0);
        if (opened) {
          for (const text of has) await expect(dialog, text).toContainText(text);
          for (const text of not ?? []) await expect(dialog, text).not.toContainText(text);
          await expect(dialog, '"Select a list" belongs to Lead only').not.toContainText('Select a list');
          await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        }
        // Cancel keeps the picked activity (seen 2026-11-05), so remove it before the next one.
        await sh.removeActivity(TRIGGER, activity);
      });
    }
    await sh.openTriggers();
  });

  // ---- Add Prospect in Saleshandy ----

  let priya: Made;

  test('Add Prospect 1: new Contact with phone, title and department becomes one prospect', async ({ salesforceIntegration: sh, saleshandyCrm: crm }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await select(sh, [ADD]);
    priya = await makeContact({ first: 'Priya', last: 'Nair', local: 'priya.nair', title: 'Procurement Manager', phone: '+1 415 555 0132', department: 'Procurement' });
    await runAndLog(sh);
    await test.step('Check Priya Nair is one prospect with the mapped fields', () =>
      expectProspect(crm, { Email: priya.email, 'First Name': 'Priya', 'Last Name': 'Nair' }, { 'Phone Number': '+1 415 555 0132', Department: 'Procurement' }),
    );
  });

  test('Add Prospect 2: run again with no new Contact, still one prospect', async ({ salesforceIntegration: sh, saleshandyCrm: crm }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    test.skip(!priya, 'Add Prospect 1 did not create Priya Nair.');
    await select(sh, [ADD]);
    await runAndLog(sh);
    await untilPasses(`Prospects with ${priya.email}`, async () => {
      expect(await crm.search(priya.email)).toBe(1);
    });
  });

  // Job Title and Company are "Select" (unmapped) in the Contact Field Mapping (read live on
  // sfemailopened 2026-11-09), so this row checks Department, a mapped field.
  test('Add Prospect 4: prospect with an old Department gets the new Department from a second Contact', async ({ salesforceIntegration: sh, saleshandyCrm: crm }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await select(sh, [ADD]);
    const first = await makeContact({ first: 'Nadia', last: 'Rahman', local: 'nadia.rahman', department: 'Purchasing' });
    await runAndLog(sh);
    await untilPasses(`Prospect ${first.email}`, async () => {
      expect(await crm.search(first.email)).toBe(1);
    });
    // Same email, a new Department: two Contacts now share the email (duplicates allowed on purpose).
    await (await sf()).createContact({ firstName: 'Nadia', lastName: 'Rahman', email: first.email, department: 'Procurement' });
    await runAndLog(sh);
    await check(true, 'Add Prospect 4: Department updated', () =>
      untilPasses('Department', async () => {
        await crm.search(first.email);
        await crm.openProspect(first.name);
        await expect(crm.field('Department')).toHaveText('Procurement');
      }),
    );
  });

  test('Add Prospect 5: Contact with a Last Name only', async ({ salesforceIntegration: sh, saleshandyCrm: crm }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await select(sh, [ADD]);
    const solanki = await makeContact({ last: 'Solanki', local: 'solanki' });
    await runAndLog(sh);
    await expectProspect(crm, { Email: solanki.email, 'First Name': '', 'Last Name': 'Solanki' }, { 'Last Name': 'Solanki' });
  });

  test("Add Prospect 6: names with a space, an apostrophe and an accent are kept in full", async ({ salesforceIntegration: sh, saleshandyCrm: crm }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await select(sh, [ADD]);
    const anna = await makeContact({ first: 'Anna', last: 'Van Dyke', local: 'anna.vandyke' });
    const sean = await makeContact({ first: 'Sean', last: "O'Connor-Müller", local: 'sean.oconnor' });
    await runAndLog(sh);
    await expectProspect(crm, { Email: anna.email, 'First Name': 'Anna', 'Last Name': 'Van Dyke' }, { 'Last Name': 'Van Dyke' });
    await expectProspect(crm, { Email: sean.email, 'First Name': 'Sean', 'Last Name': "O'Connor-Müller" }, { 'Last Name': "O'Connor-Müller" });
  });

  test('Add Prospect 7: phone-only Contact with no Email makes no prospect', async ({ salesforceIntegration: sh, saleshandyCrm: crm }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await select(sh, [ADD]);
    await makeContact({ first: 'Karan', last: 'Iyer', local: 'karan.iyer', phone: '+1 415 555 0177', noEmail: true });
    // QA 2026-11-12: not a bug. The Email is mandatory for a prospect, so the run ends ERRORED at "Loop on Contacts".
    const id = await test.step('Run the workflow now: it must end ERRORED at "Loop on Contacts"', () => runNowExpectingError(sh.page, TRIGGER, 'Loop on Contacts'));
    // Logs shows the run with status Error (seen 2026-11-12, run 6af5532d8ec2873004585622).
    await sh.openLogs();
    await untilPasses(`Logs did not show run ${id} as Error`, async () => {
      await sh.refreshLogs();
      const entry = (await sh.logEntries(TRIGGER)).find((e) => e.id === id);
      expect(entry?.status, `Logs entry of run ${id}`).toBe('Error');
    });
    await staysTrue(sh.page, async () => {
      expect(await crm.search('Karan Iyer'), 'prospects named Karan Iyer').toBe(0);
    });
  });

  test('Add Prospect 8: Contact linked to the Account Northwind Foods', async ({ salesforceIntegration: sh, saleshandyCrm: crm }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await select(sh, [ADD]);
    const accountId = await (await sf()).createAccount('Northwind Foods');
    const tom = await makeContact({ first: 'Tom', last: 'Whitfield', local: 'tom.whitfield', accountId });
    await runAndLog(sh);
    await untilPasses(`Prospect ${tom.email}`, async () => {
      expect(await crm.search(tom.email)).toBe(1);
    });
    await check(true, 'Add Prospect 8: Company stays empty', async () => {
      await crm.openProspect(tom.name);
      await expect(crm.field('Company')).toHaveText(/^(-|)$/);
    });
  });

  // ---- Assign a tag, Move ----

  test('Tag 1: new Contact gets the tag TagA', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await select(sh, [{ activity: ACTIVITY.tag, config: tagged }]);
    const c = await makeContact({ first: 'Fiona', last: 'Brandt', local: 'fiona.brandt', title: 'Operations Lead' });
    await runAndLog(sh);
    await check(true, 'Tag 1', () => expectState(crm, dnc, c.email, { tag: 'TagA' }));
  });

  test('Move 1: new Contact starts Sequence A, Step 1', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    await select(sh, [MOVE_A]);
    const c = await makeContact({ first: 'Marcus', last: 'Hallberg', local: 'marcus.hallberg', title: 'Logistics Director' });
    await runAndLog(sh);
    await check(true, 'Move 1', () => expectState(crm, dnc, c.email, { sequence: SEQ_A }));
  });

  test('Tag 2: Add Prospect, Move and Tag together', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    await select(sh, [ADD, MOVE_A, { activity: ACTIVITY.tag, config: tagged }]);
    const c = await makeContact({ first: 'Elena', last: 'Marchetti', local: 'elena.marchetti', title: 'Event Coordinator' });
    await runAndLog(sh);
    await check(true, 'Tag 2', () => expectState(crm, dnc, c.email, { sequence: SEQ_A, tag: 'TagA' }));
  });

  // ---- Paused, Replied, Finished, Resume ----
  // Sequence A stops follow-ups on a reply (Replied ends Finished), Sequence B does not (QA 2026-11-09).
  // The rows with Sequence A run first, those with Sequence B last: a Move to B adds every Contact to B.

  test('Status 1: new Contact is paused for 1 day after joining Sequence A', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    await select(sh, [MOVE_A, { activity: ACTIVITY.paused, config: pausedIn(SEQ_A) }]);
    const c = await makeContact({ first: 'Hannah', last: 'Lindqvist', local: 'hannah.lindqvist' });
    await runAndLog(sh);
    await check(true, 'Status 1: prospect in Sequence A', () => expectState(crm, dnc, c.email, { sequence: SEQ_A }));
    test.info().annotations.push({ type: 'Needs QA', description: 'Status 1: read the prospect Activities section by hand, it must say the prospect was marked paused for 1 day.' });
  });

  test('Status 2: new Contact is finished right after joining Sequence A', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    await select(sh, [MOVE_A, { activity: ACTIVITY.finished, config: sequence(false, SEQ_A) }]);
    const c = await makeContact({ first: 'Oliver', last: 'Grant', local: 'oliver.grant' });
    await runAndLog(sh);
    await check(true, 'Status 2', () => expectState(crm, dnc, c.email, { status: 'Finished' }));
  });

  test('Status 3: new Contact marked Replied after joining Sequence A ends Finished', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    await select(sh, [MOVE_A, { activity: ACTIVITY.replied, config: sequence(false, SEQ_A) }]);
    const c = await makeContact({ first: 'Sofia', last: 'Andersson', local: 'sofia.andersson' });
    await runAndLog(sh);
    await check(true, 'Status 3', () => expectState(crm, dnc, c.email, { status: 'Finished' }));
  });

  test('Status 5: prospect in Sequence A is paused', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    const priya = { first: 'Priya', last: 'Nair', local: 'priya.nair.pause' };
    const c = await makeContact(priya);
    await joinSequence(sh, MOVE_A);
    await makeContact({ ...priya, email: c.email }); // the follow-up run reads this new record
    await select(sh, [{ activity: ACTIVITY.paused, config: pausedIn(SEQ_A) }]);
    await runAndLog(sh);
    await expectState(crm, dnc, c.email, { status: 'Paused' });
    await expectActivity(crm, c.email, 'Priya Nair', PAUSED_A);
  });

  test('Status 9: paused prospect in Sequence A is resumed', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    const priya = { first: 'Priya', last: 'Nair', local: 'priya.nair.resume' };
    const c = await makeContact(priya);
    await joinSequence(sh, MOVE_A);
    await makeContact({ ...priya, email: c.email }); // a run reads only new Contacts
    await select(sh, [{ activity: ACTIVITY.paused, config: pausedIn(SEQ_A) }]);
    await runAndLog(sh);
    await expectState(crm, dnc, c.email, { status: 'Paused' });
    await expectActivity(crm, c.email, 'Priya Nair', PAUSED_A);
    await makeContact({ ...priya, email: c.email });
    await select(sh, [{ activity: ACTIVITY.resume, config: sequence(false, SEQ_A) }]);
    await runAndLog(sh);
    await untilPasses(`Latest Status of ${c.email} is not Paused`, async () => {
      await crm.search(c.email);
      expect(await crm.latestStatus(c.email)).not.toBe('Paused');
    });
  });

  test('Status 6: prospect in Sequence A is finished', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    const person = { first: 'Priya', last: 'Nair', local: 'priya.nair.finish' };
    const c = await makeContact(person);
    await joinSequence(sh, MOVE_A);
    await makeContact({ ...person, email: c.email }); // a run reads only new Contacts
    await select(sh, [{ activity: ACTIVITY.finished, config: sequence(false, SEQ_A) }]);
    await runAndLog(sh);
    await expectState(crm, dnc, c.email, { status: 'Finished' });
  });

  test('Status 7: prospect in Sequence A marked Replied ends Finished', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    const person = { first: 'Priya', last: 'Nair', local: 'priya.nair.replied' };
    const c = await makeContact(person);
    await joinSequence(sh, MOVE_A);
    await makeContact({ ...person, email: c.email }); // a run reads only new Contacts
    await select(sh, [{ activity: ACTIVITY.replied, config: sequence(false, SEQ_A) }]);
    await runAndLog(sh);
    await expectState(crm, dnc, c.email, { status: 'Finished' });
  });

  test('Status 4: new Contact marked Replied after joining Sequence B keeps Replied', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    await select(sh, [MOVE_B, { activity: ACTIVITY.replied, config: sequence(false, SEQ_B) }]);
    const c = await makeContact({ first: 'Lucas', last: 'Moreau', local: 'lucas.moreau' });
    await runAndLog(sh);
    await check(true, 'Status 4', () => expectState(crm, dnc, c.email, { status: 'Replied' }));
  });

  test('Status 8: prospect in Sequence B marked Replied keeps Replied', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    const person = { first: 'Daniel', last: 'Okafor', local: 'daniel.okafor' };
    const c = await makeContact(person);
    await joinSequence(sh, MOVE_B);
    await makeContact({ ...person, email: c.email }); // a run reads only new Contacts
    await select(sh, [{ activity: ACTIVITY.replied, config: sequence(false, SEQ_B) }]);
    await runAndLog(sh);
    await expectState(crm, dnc, c.email, { status: 'Replied' });
  });

  // ---- Unsubscribed and Blacklist: they hit every prospect and domain of the account ----

  test.describe('Run last: hits every prospect and domain of the account', () => {
    let dncBefore: string[] | undefined;

    test.afterEach(async ({ salesforceIntegration: sh, saleshandyDnc: dnc }) => {
      await dropRiskyActivities(sh);
      if (!dncBefore) return;
      try {
        const added = (await dnc.entries()).filter((e) => !dncBefore!.includes(e));
        for (const entry of added) await dnc.removeEntry(entry);
        test.info().annotations.push({ type: 'Do Not Contact', description: `removed after the row: ${added.join(', ') || 'nothing new'}` });
      } catch (e) {
        test.info().annotations.push({ type: 'Cleanup failed', description: `Remove the new Do Not Contact entries by hand: ${(e as Error).message.split('\n')[0]}` });
      }
      dncBefore = undefined;
    });

    test('Unsubscribed 1: new Contact asks to stop emails', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
      test.setTimeout(ROW_TIMEOUT_MS);
      await select(sh, [{ activity: ACTIVITY.unsubscribed }]);
      const c = await makeContact({ first: 'Rahul', last: 'Mehta', local: 'rahul.mehta.unsub', title: 'Fleet Manager' });
      await runAndLog(sh);
      await check(true, 'Unsubscribed 1', () => expectState(crm, dnc, c.email, { status: 'Unsubscribed' }));
    });

    test('Unsubscribed 2: prospect in Sequence A asks to be removed', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
      test.setTimeout(ROW_TIMEOUT_MS);
      gate();
      const person = { first: 'Priya', last: 'Nair', local: 'priya.nair.unsub' };
      const c = await makeContact(person);
      await joinSequence(sh, MOVE_A);
      await makeContact({ ...person, email: c.email }); // a run reads only new Contacts
      await select(sh, [{ activity: ACTIVITY.unsubscribed }]);
      await runAndLog(sh);
      await check(true, 'Unsubscribed 2', () => expectState(crm, dnc, c.email, { status: 'Unsubscribed' }));
    });

    test('Unsubscribed 3: Contact deleted and created again, the prospect imported earlier is unsubscribed', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
      test.setTimeout(ROW_TIMEOUT_MS);
      await select(sh, [ADD]);
      const ingrid = { first: 'Ingrid', last: 'Halvorsen', local: 'ingrid.halvorsen' };
      const earlier = await makeContact(ingrid);
      await runAndLog(sh);
      await untilPasses(`Prospect ${earlier.email}`, async () => {
        expect(await crm.search(earlier.email)).toBe(1);
      });
      await test.step('Delete that Contact in Salesforce', async () => {
        await (await sf()).deleteContact(earlier.id!);
      });
      await select(sh, [{ activity: ACTIVITY.unsubscribed }]);
      await makeContact({ ...ingrid, email: earlier.email });
      await runAndLog(sh);
      // A prospect in no sequence keeps Latest Status Inactive. The unsubscribe shows in the
      // Activities section of the prospect details (QA 2026-11-12, seen on staging).
      await untilPasses(`Activities of ${earlier.email} show the unsubscribe`, async () => {
        expect(await crm.search(earlier.email), `prospects with ${earlier.email}`).toBe(1);
        await crm.closeSidebar();
        await crm.openProspect('Ingrid Halvorsen');
        await expect(crm.page.getByRole('dialog'), 'Activities section').toContainText(/Marked as unsubscribed by/);
        await crm.page.keyboard.press('Escape');
      });
    });

    const KESTREL = 'kestrellogistics.example';

    test('Blacklist 1: new Contact on a company domain that asks never to be contacted', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
      test.setTimeout(ROW_TIMEOUT_MS);
      dncBefore = await dnc.entries();
      await select(sh, [{ activity: ACTIVITY.blacklist }]);
      const c = await makeContact({ first: 'Rahul', last: 'Mehta', local: 'rahul.mehta', domain: KESTREL, title: 'Fleet Manager' });
      await runAndLog(sh);
      await expectState(crm, dnc, c.email, { dnc: KESTREL });
    });

    test('Blacklist 2: the same run again lists the domain once', async ({ salesforceIntegration: sh, saleshandyDnc: dnc }) => {
      test.setTimeout(ROW_TIMEOUT_MS);
      dncBefore = await dnc.entries();
      await select(sh, [{ activity: ACTIVITY.blacklist }]);
      await makeContact({ first: 'Rahul', last: 'Mehta', local: 'rahul.mehta.again', domain: KESTREL });
      await runAndLog(sh);
      await runAndLog(sh);
      await check(true, 'Blacklist 2: domain listed once', async () => {
        expect((await dnc.entries()).filter((e) => e === KESTREL)).toHaveLength(1);
      });
    });

    test('Blacklist 3: Blacklist and Add Prospect together run only the blacklist', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
      test.setTimeout(ROW_TIMEOUT_MS);
      dncBefore = await dnc.entries();
      await select(sh, [ADD, { activity: ACTIVITY.blacklist }]);
      const c = await makeContact({ first: 'Greta', last: 'Lindholm', local: 'greta.lindholm', domain: 'harborfreight.example' });
      await runAndLog(sh);
      await expectState(crm, dnc, c.email, { dnc: 'harborfreight.example' });
    });

    test('Blacklist 4: every domain of the Contacts read is listed, not only the new one', async ({ salesforceIntegration: sh, saleshandyDnc: dnc }) => {
      test.setTimeout(ROW_TIMEOUT_MS);
      dncBefore = await dnc.entries();
      await select(sh, [{ activity: ACTIVITY.blacklist }]);
      await makeContact({ first: 'Rahul', last: 'Mehta', local: 'rahul.mehta.all', domain: KESTREL });
      await runAndLog(sh);
      const contacts: { Email: string }[] = await (await sf()).query('SELECT Email FROM Contact WHERE Email != null LIMIT 200');
      const domains = [...new Set(contacts.map((c) => mailDomain(c.Email)))];
      const listed = await dnc.entries();
      const missing = domains.filter((d) => !listed.includes(d));
      // The run reads up to 200 Contacts, in an order we cannot see: at the limit only record it.
      await check(contacts.length >= 200, 'Blacklist 4: all domains listed', async () => {
        expect(missing, `domains of the org's Contacts not on the Do Not Contact list (of ${domains.length})`).toEqual([]);
      });
    });
  });

  // ---- Restore ----

  test('Restore: trigger off', async ({ salesforceIntegration: sh }) => {
    await sh.openTriggers();
    await sh.disable(TRIGGER);
    await sh.save();
    await expect(sh.savedToast(), 'save confirmation').toBeVisible();
  });
});
