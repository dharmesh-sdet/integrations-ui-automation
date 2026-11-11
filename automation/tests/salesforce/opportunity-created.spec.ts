// Scenarios: test-cases/salesforce/opportunity-created.md (Regression; AL-4142), 28 rows.
// Account: sflinkclicked (QA 2026-11-09, idle account), so it runs in parallel with Lead on sfreplyreceived
// and Contact on sfemailopened: own trigger page, sequences, Do Not Contact list and prospects.
// Each row makes a Contact and an Opportunity by REST (src/utils/salesforce-api.ts). The Contact is
// the Opportunity's contact role, and the workflow imports contact roles, not the Opportunity itself.
// The workflow is started with run-now (src/flows/refold-run-now.ts). Logs and the prospect are read
// in Saleshandy. People are code, not a CSV: names matter to the rows and the email carries the run stamp.
//
// Every run reads up to 200 Opportunities of the org and applies the selected activities to all of
// their contacts (dev log v2, A3). So one prospect's state is changed by every later run and the rows
// run as one chain, in file order: Add Prospect, Tag, Move, status rows (Sequence A first, Sequence B
// last), then the rows that hit every prospect and domain of the account (Unsubscribed, Blacklist),
// then Restore (trigger off, not a case).
//
// Sequence A = 197704 and Sequence B = 197611 are ACTIVE with real senders (QA 2026-11-09), so a Move
// row sends step 1 to every contact it reads. Sequence A stops follow-ups on a reply, Sequence B does not.
// Rows that use a sequence run only with ACCEPT_SENDS=1. "(proposed, unconfirmed)" rows are recorded as
// "Needs QA" annotations, the others are asserted.
//
// Run: KEEP_TEST_DATA=1 ACCEPT_SENDS=1 npx playwright test tests/salesforce/opportunity-created.spec.ts
import { expect, test } from '../../src/fixtures/index.ts';
import {
  ACTIVITY,
  RUN_STAMP,
  check,
  expectLogSuccess,
  expectProspect,
  expectState,
  pausedIn,
  runNow,
  sequence,
  tagged,
  useActivities,
  type Pick,
} from '../../src/flows/salesforce-to-saleshandy.ts';
import { EXPECTED_MAPPING } from '../../src/config/salesforce-field-mapping.ts';
import type { SalesforceIntegrationPage } from '../../src/pages/saleshandy/salesforce-integration.page.ts';
import { SalesforceApi } from '../../src/utils/salesforce-api.ts';
import { staysTrue, untilPasses } from '../../src/utils/wait.ts';

test.use({ account: 'sflinkclicked' });

const TRIGGER = 'Opportunity is created in Salesforce';
const ROW_TIMEOUT_MS = 10 * 60_000;
// The two reusable sequences QA named on sflinkclicked (not called "Sequence A/B").
const SEQ_A = 'Salesforce Link Clicked Regression'; // 197704, stops follow-ups on a reply
const SEQ_B = 'Conversation Category is Updated in Saleshandy'; // 197611, keeps sending after a reply
const ADD: Pick = { activity: ACTIVITY.add };
const MOVE_A: Pick = { activity: ACTIVITY.move, config: sequence(true, SEQ_A) };
const MOVE_B: Pick = { activity: ACTIVITY.move, config: sequence(true, SEQ_B) };

// ---- Salesforce side ----

let session: { api: SalesforceApi; at: number } | undefined;
async function sf(): Promise<SalesforceApi> {
  if (!session || Date.now() - session.at > 20 * 60_000) session = { api: await SalesforceApi.login(), at: Date.now() };
  return session.api;
}

type Person = { first?: string; last: string; local: string; domain?: string; title?: string; phone?: string; department?: string; noEmail?: boolean };
type Made = { email: string; name: string; id: string };

// One Contact, a new email every run (local part + run stamp).
async function makeContact(p: Person): Promise<Made> {
  const email = `${p.local}.${RUN_STAMP}@${p.domain ?? 'mailinator.com'}`;
  const name = [p.first, p.last].filter(Boolean).join(' ');
  const id = await test.step(`Create the Salesforce Contact ${name}`, async () =>
    (await sf()).createContact({ firstName: p.first, lastName: p.last, email: p.noEmail ? undefined : email, title: p.title, phone: p.phone, department: p.department }),
  );
  return { email, name, id };
}

// One Opportunity whose contact roles are `contacts` (the first one primary). No contacts = no role.
async function makeDeal(deal: string, contacts: Made[], amount?: number): Promise<string> {
  const name = `${deal} ${RUN_STAMP}`;
  await test.step(`Create the Salesforce Opportunity "${name}" with ${contacts.length} contact role(s)`, async () => {
    await (await sf()).createOpportunity({ name, stage: 'Prospecting', closeDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10), amount, contactIds: contacts.map((c) => c.id) });
  });
  return name;
}

// A second deal for a contact the workflow already imported. Proven 2026-11-11 (run 1 and run 2, 30 s apart): the
// Salesforce read of a run returned the new deal in run 1 and 0 records in run 2 for the same deal, so a follow-up
// run only has something to act on when a NEW deal exists. The contact is the same, so the prospect is the same one.
const followUpDeal = (c: Made, what: string) => makeDeal(`Northwind Foods, ${what} follow-up`, [c]);

// ---- Saleshandy side ----

const gate = () => test.skip(process.env.ACCEPT_SENDS !== '1', 'Moves every Opportunity contact of the org into an ACTIVE sequence and step 1 sends. Run with ACCEPT_SENDS=1.');

async function runAndLog(sh: SalesforceIntegrationPage): Promise<string> {
  const id = await test.step('Run the workflow now (no 3-hour wait) and wait for COMPLETED', () => runNow(sh.page, TRIGGER));
  await test.step('Find that run in Logs: Success', () => expectLogSuccess(sh, TRIGGER, id));
  return id;
}

const select = (sh: SalesforceIntegrationPage, picks: Pick[]) =>
  test.step(`Select ${picks.map((p) => `"${p.activity}"`).join(' and ')} under "${TRIGGER}" and Save`, () => useActivities(sh, TRIGGER, picks));

// Puts a prospect into a sequence, the setup of the existing-prospect rows.
async function joinSequence(sh: SalesforceIntegrationPage, move: Pick): Promise<void> {
  await select(sh, [move]);
  await runAndLog(sh);
}

// The activities that hit every prospect or domain of the account. Removed again after each of their
// rows, also after a failure, so the 3-hourly cron does not repeat them.
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


test.describe(TRIGGER, () => {
  // Not serial: a product failure on one row must not hide the rows behind it. File order, one worker.

  // ---- Trigger behavior (baseline) ----

  test('Trigger behavior 1: Field Mapping for Contact and Opportunity, then trigger on with Add Prospect', async ({ salesforceIntegration: sh }) => {
    test.setTimeout(10 * 60_000);
    await test.step('Contact Properties: Job Title, Phone Number, Department mapped', async () => {
      await sh.openMapping('Contact');
      // Job Title is not in EXPECTED_MAPPING. It was unmapped on sflinkclicked until 2026-11-09 and is mapped to Title as on Lead.
      expect(await sh.mappedValue('Job Title'), 'Job Title on Contact Properties').toBe('Title');
      for (const field of ['Phone Number', 'Department']) {
        expect(await sh.mappedValue(field), `${field} on Contact Properties`).toBe(EXPECTED_MAPPING.Contact[field]);
      }
    });
    await test.step('Opportunity Properties: Deal Value mapped', async () => {
      await sh.openMapping('Opportunity');
      expect(await sh.mappedValue('Deal Value'), 'Deal Value on Opportunity Properties').toBe(EXPECTED_MAPPING.Opportunity['Deal Value']);
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
  let daniel: Made;

  test('Add Prospect 1: deal contact with phone, title and department becomes one prospect', async ({ salesforceIntegration: sh, saleshandyCrm: crm }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await select(sh, [ADD]);
    priya = await makeContact({ first: 'Priya', last: 'Nair', local: 'priya.nair', title: 'Procurement Manager', phone: '+1 415 555 0132', department: 'Procurement' });
    await makeDeal('Northwind Foods, 500 seats', [priya]);
    await runAndLog(sh);
    await test.step('Check Priya Nair is one prospect with the mapped fields', () =>
      expectProspect(crm, { Email: priya.email, 'First Name': 'Priya', 'Last Name': 'Nair' }, { 'Job Title': 'Procurement Manager', 'Phone Number': '+1 415 555 0132', Department: 'Procurement' }),
    );
  });

  test('Add Prospect 2: run again with no new Opportunity, still one prospect', async ({ salesforceIntegration: sh, saleshandyCrm: crm }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    test.skip(!priya, 'Add Prospect 1 did not create Priya Nair.');
    await select(sh, [ADD]);
    await runAndLog(sh);
    await untilPasses(`Prospects with ${priya.email}`, async () => {
      expect(await crm.search(priya.email)).toBe(1);
    });
  });

  test('Add Prospect 3: a Deal Value of 4321 reaches the prospect', async ({ salesforceIntegration: sh, saleshandyCrm: crm }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await select(sh, [ADD]);
    const c = await makeContact({ first: 'Marta', last: 'Kowalski', local: 'marta.kowalski', title: 'Purchasing Lead' });
    await makeDeal('Kowalski Packaging, annual contract', [c], 4321);
    await runAndLog(sh);
    await expectProspect(crm, { Email: c.email, 'First Name': 'Marta', 'Last Name': 'Kowalski' }, {});
    await untilPasses('Deal Value 4321 on the prospect', async () => {
      await crm.search(c.email);
      await crm.openProspect(c.name);
      await expect(crm.field('Deal Value')).toHaveText(/4,?321/);
    });
  });

  test('Add Prospect 4: two contact roles on one deal become two prospects', async ({ salesforceIntegration: sh, saleshandyCrm: crm }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await select(sh, [ADD]);
    const first = await makeContact({ first: 'Priya', last: 'Nair', local: 'priya.nair.roles', title: 'Procurement Manager' });
    daniel = await makeContact({ first: 'Daniel', last: 'Okafor', local: 'daniel.okafor', title: 'Finance Director' });
    await makeDeal('Northwind Foods, two sponsors', [first, daniel]);
    await runAndLog(sh);
    await expectProspect(crm, { Email: first.email, 'First Name': 'Priya', 'Last Name': 'Nair' }, {});
    await expectProspect(crm, { Email: daniel.email, 'First Name': 'Daniel', 'Last Name': 'Okafor' }, {});
  });

  test('Add Prospect 5: a deal with no contact role makes no prospect', async ({ salesforceIntegration: sh, saleshandyCrm: crm }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await select(sh, [ADD]);
    const deal = await makeDeal('Harbor Freight, no contact yet', []);
    await runAndLog(sh);
    await staysTrue(sh.page, async () => {
      expect(await crm.search(deal), `prospects named ${deal}`).toBe(0);
    });
  });

  test('Add Prospect 6: a deal contact with no Email makes no prospect', async ({ salesforceIntegration: sh, saleshandyCrm: crm }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await select(sh, [ADD]);
    const c = await makeContact({ first: 'Karan', last: 'Iyer', local: 'karan.iyer', phone: '+1 415 555 0177', noEmail: true });
    await makeDeal('Iyer Textiles, phone enquiry', [c]);
    await runAndLog(sh);
    await staysTrue(sh.page, async () => {
      expect(await crm.search('Karan Iyer'), 'prospects named Karan Iyer').toBe(0);
    });
  });

  test('Add Prospect 7: prospect with an old Job Title gets the new Title from a second Contact', async ({ salesforceIntegration: sh, saleshandyCrm: crm }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await select(sh, [ADD]);
    const first = await makeContact({ first: 'Nadia', last: 'Rahman', local: 'nadia.rahman', title: 'Buyer' });
    await makeDeal('Rahman Trading, first order', [first]);
    await runAndLog(sh);
    await untilPasses(`Prospect ${first.email}`, async () => {
      expect(await crm.search(first.email)).toBe(1);
    });
    // Same email, a new Title: two Contacts share the email (duplicates allowed on purpose), each with a deal.
    const second = await (await sf()).createContact({ firstName: 'Nadia', lastName: 'Rahman', email: first.email, title: 'Procurement Manager' });
    await makeDeal('Rahman Trading, renewal', [{ ...first, id: second }]);
    await runAndLog(sh);
    await check(true, 'Add Prospect 7: Job Title updated', () =>
      untilPasses('Job Title', async () => {
        await crm.search(first.email);
        await crm.openProspect(first.name);
        await expect(crm.field('Job Title')).toHaveText('Procurement Manager');
      }),
    );
  });

  test('Tag 1: new deal contact gets the tag TagA', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await select(sh, [{ activity: ACTIVITY.tag, config: tagged }]);
    const c = await makeContact({ first: 'Fiona', last: 'Brandt', local: 'fiona.brandt', title: 'Operations Lead' });
    await makeDeal('Brandt Events, venue hire', [c]);
    await runAndLog(sh);
    await check(true, 'Tag 1', () => expectState(crm, dnc, c.email, { tag: 'TagA' }));
  });

  test('Move 1: new deal contact starts Sequence A, Step 1', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    await select(sh, [MOVE_A]);
    const c = await makeContact({ first: 'Marcus', last: 'Hallberg', local: 'marcus.hallberg', title: 'Logistics Director' });
    await makeDeal('Hallberg Freight, fleet tracking', [c]);
    await runAndLog(sh);
    await check(true, 'Move 1', () => expectState(crm, dnc, c.email, { sequence: SEQ_A }));
  });

  test('Tag 2: Add Prospect, Move and Tag together', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    await select(sh, [ADD, MOVE_A, { activity: ACTIVITY.tag, config: tagged }]);
    const c = await makeContact({ first: 'Elena', last: 'Marchetti', local: 'elena.marchetti', title: 'Event Coordinator' });
    await makeDeal('Marchetti Catering, summer programme', [c]);
    await runAndLog(sh);
    await check(true, 'Tag 2', () => expectState(crm, dnc, c.email, { sequence: SEQ_A, tag: 'TagA' }));
  });

  // ---- Paused, Replied, Finished, Resume ----
  // Sequence A stops follow-ups on a reply (Replied ends Finished), Sequence B does not (QA 2026-11-09).
  // The rows with Sequence A run first, those with Sequence B last: a Move to B adds every contact to B.

  test('Status 1: new deal contact is paused for 1 day after joining Sequence A', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    await select(sh, [MOVE_A, { activity: ACTIVITY.paused, config: pausedIn(SEQ_A) }]);
    const c = await makeContact({ first: 'Hannah', last: 'Lindqvist', local: 'hannah.lindqvist' });
    await makeDeal('Lindqvist Design, brand refresh', [c]);
    await runAndLog(sh);
    await check(true, 'Status 1: prospect in Sequence A', () => expectState(crm, dnc, c.email, { sequence: SEQ_A }));
    test.info().annotations.push({ type: 'Needs QA', description: 'Status 1: read the prospect Activities section by hand, it must say the prospect was marked paused for 1 day.' });
  });

  test('Status 2: new deal contact is finished right after joining Sequence A', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    await select(sh, [MOVE_A, { activity: ACTIVITY.finished, config: sequence(false, SEQ_A) }]);
    const c = await makeContact({ first: 'Oliver', last: 'Grant', local: 'oliver.grant' });
    await makeDeal('Grant Surveyors, office fit-out', [c]);
    await runAndLog(sh);
    await check(true, 'Status 2', () => expectState(crm, dnc, c.email, { status: 'Finished' }));
  });

  test('Status 3: new deal contact marked Replied after joining Sequence A ends Finished', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    await select(sh, [MOVE_A, { activity: ACTIVITY.replied, config: sequence(false, SEQ_A) }]);
    const c = await makeContact({ first: 'Sofia', last: 'Andersson', local: 'sofia.andersson' });
    await makeDeal('Andersson Interiors, showroom', [c]);
    await runAndLog(sh);
    await check(true, 'Status 3', () => expectState(crm, dnc, c.email, { status: 'Finished' }));
  });

  test('Status 5: prospect in Sequence A is paused', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    const c = await makeContact({ first: 'Priya', last: 'Nair', local: 'priya.nair.pause' });
    await makeDeal('Northwind Foods, pause check', [c]);
    await joinSequence(sh, MOVE_A);
    await followUpDeal(c, 'pause');
    await select(sh, [{ activity: ACTIVITY.paused, config: pausedIn(SEQ_A) }]);
    await runAndLog(sh);
    await expectState(crm, dnc, c.email, { status: 'Paused' });
  });

  test('Status 8: paused prospect in Sequence A is resumed', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    const c = await makeContact({ first: 'Priya', last: 'Nair', local: 'priya.nair.resume' });
    await makeDeal('Northwind Foods, resume check', [c]);
    await joinSequence(sh, MOVE_A);
    await followUpDeal(c, 'pause');
    await select(sh, [{ activity: ACTIVITY.paused, config: pausedIn(SEQ_A) }]);
    await runAndLog(sh);
    await expectState(crm, dnc, c.email, { status: 'Paused' });
    await followUpDeal(c, 'resume');
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
    const c = await makeContact({ first: 'Priya', last: 'Nair', local: 'priya.nair.finish' });
    await makeDeal('Northwind Foods, finish check', [c]);
    await joinSequence(sh, MOVE_A);
    await followUpDeal(c, 'finish');
    await select(sh, [{ activity: ACTIVITY.finished, config: sequence(false, SEQ_A) }]);
    await runAndLog(sh);
    await expectState(crm, dnc, c.email, { status: 'Finished' });
  });

  test('Status 4: new deal contact marked Replied after joining Sequence B keeps Replied', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    await select(sh, [MOVE_B, { activity: ACTIVITY.replied, config: sequence(false, SEQ_B) }]);
    const c = await makeContact({ first: 'Lucas', last: 'Moreau', local: 'lucas.moreau' });
    await makeDeal('Moreau Wines, distributor deal', [c]);
    await runAndLog(sh);
    await check(true, 'Status 4', () => expectState(crm, dnc, c.email, { status: 'Replied' }));
  });

  test('Status 7: prospect in Sequence B marked Replied keeps Replied', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    const c = await makeContact({ first: 'Daniel', last: 'Okafor', local: 'daniel.okafor.b' });
    await makeDeal('Okafor Logistics, depot lease', [c]);
    await joinSequence(sh, MOVE_B);
    await followUpDeal(c, 'reply');
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

    test('Unsubscribed 1: new deal contact asks to stop emails', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
      test.setTimeout(ROW_TIMEOUT_MS);
      await select(sh, [{ activity: ACTIVITY.unsubscribed }]);
      const c = await makeContact({ first: 'Rahul', last: 'Mehta', local: 'rahul.mehta.unsub', title: 'Fleet Manager' });
      await makeDeal('Kestrel Logistics, fleet audit', [c]);
      await runAndLog(sh);
      await check(true, 'Unsubscribed 1', () => expectState(crm, dnc, c.email, { status: 'Unsubscribed' }));
    });

    const KESTREL = 'kestrellogistics.example';

    test('Blacklist 1: new deal contact on a company domain that asks never to be contacted', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
      test.setTimeout(ROW_TIMEOUT_MS);
      dncBefore = await dnc.entries();
      await select(sh, [{ activity: ACTIVITY.blacklist }]);
      const c = await makeContact({ first: 'Rahul', last: 'Mehta', local: 'rahul.mehta', domain: KESTREL, title: 'Fleet Manager' });
      await makeDeal('Kestrel Logistics, do not contact', [c]);
      await runAndLog(sh);
      await expectState(crm, dnc, c.email, { dnc: KESTREL });
    });

    test('Blacklist 2: the same run again lists the domain once', async ({ salesforceIntegration: sh, saleshandyDnc: dnc }) => {
      test.setTimeout(ROW_TIMEOUT_MS);
      dncBefore = await dnc.entries();
      await select(sh, [{ activity: ACTIVITY.blacklist }]);
      const c = await makeContact({ first: 'Rahul', last: 'Mehta', local: 'rahul.mehta.again', domain: KESTREL });
      await makeDeal('Kestrel Logistics, second run', [c]);
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
      await makeDeal('Harbor Freight, both activities', [c]);
      await runAndLog(sh);
      await expectState(crm, dnc, c.email, { dnc: 'harborfreight.example' });
    });

    test('Blacklist 4: two new deals on two company domains, both domains are listed once', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
      test.setTimeout(ROW_TIMEOUT_MS);
      dncBefore = await dnc.entries();
      await select(sh, [{ activity: ACTIVITY.blacklist }]);
      const harbor = 'harborfreight.example';
      const first = await makeContact({ first: 'Rahul', last: 'Mehta', local: 'rahul.mehta.all', domain: KESTREL });
      const second = await makeContact({ first: 'Greta', last: 'Lindholm', local: 'greta.lindholm.all', domain: harbor });
      await makeDeal('Kestrel Logistics, all domains', [first]);
      await makeDeal('Harbor Freight, all domains', [second]);
      await runAndLog(sh);
      await expectState(crm, dnc, first.email, { dnc: KESTREL });
      await expectState(crm, dnc, second.email, { dnc: harbor });
      const listed = await dnc.entries();
      expect(listed.filter((e) => e === KESTREL), `${KESTREL} listed once`).toHaveLength(1);
      expect(listed.filter((e) => e === harbor), `${harbor} listed once`).toHaveLength(1);
    });
  });

  // ---- Restore (not a case) ----

  test('Restore: trigger off', async ({ salesforceIntegration: sh }) => {
    await sh.openTriggers();
    await sh.disable(TRIGGER);
    await sh.save();
    await expect(sh.savedToast(), 'save confirmation').toBeVisible();
  });
});
