// Scenarios: test-cases/salesforce/account-created.md (Regression; AL-4143), 29 rows.
// Account: sfemailsent (QA 2026-11-09, idle account: its Email Sent workflow is released), so it runs in
// parallel with Lead on sfreplyreceived, Contact on sfemailopened and Opportunity on sflinkclicked:
// own trigger page, sequences, Do Not Contact list and prospects.
// Each row makes an Account and its Contacts by REST (src/utils/salesforce-api.ts). The workflow imports
// the Contacts of an Account, not the Account itself (an Account has no email, dev log A1).
// The workflow is started with run-now (src/flows/refold-run-now.ts). Logs and the prospect are read
// in Saleshandy. People are code, not a CSV: names matter to the rows and the email carries the run stamp.
//
// Every run reads up to 200 Accounts of the org with their Contacts and applies the selected activities
// to all of them (dev log A4, kept by the developer). On 2026-11-09 that was 134 Accounts and 24 Contacts
// with an email. The 24 are protected before any row that could email them: Setup adds them to the
// Do Not Contact list of this account, Restore removes them. Before Unsubscribed and Blacklist the
// spec reads the Contacts the run will read and skips the row if an unknown person appears.
// The rows run as one chain, in file order, then Restore (trigger off, not a case).
//
// Rows that use a sequence run only with ACCEPT_SENDS=1 (step 1 sends at once to every prospect read
// that is not on the Do Not Contact list). "(proposed, unconfirmed)" rows are recorded as "Needs QA"
// annotations, the others are asserted.
//
// Run: KEEP_TEST_DATA=1 ACCEPT_SENDS=1 npx playwright test tests/salesforce/account-created.spec.ts
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
import type { SaleshandyCrmPage } from '../../src/pages/saleshandy/crm.page.ts';
import type { SalesforceIntegrationPage } from '../../src/pages/saleshandy/salesforce-integration.page.ts';
import { SalesforceApi } from '../../src/utils/salesforce-api.ts';
import { staysTrue, untilPasses } from '../../src/utils/wait.ts';

test.use({ account: 'sfemailsent' });

const TRIGGER = 'Account is created in Salesforce';
const ROW_TIMEOUT_MS = 10 * 60_000;
// The two sequences on sfemailsent, made by QA 2026-11-12 and both active: Sequence A (id 197850, 2 steps)
// and Sequence B (id 197851, 4 steps). Sequence A stops follow-ups on a reply, Sequence B keeps sending after a reply.
const SEQ_A = process.env.SEQ_A ?? 'Sequence A';
const SEQ_B = process.env.SEQ_B ?? 'Sequence B';
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

// Emails this spec created: they are known people for the read-set check.
const made = new Set<string>();

// One Contact on an Account, a new email every run (local part + run stamp).
async function makeContact(p: Person, accountId: string): Promise<Made> {
  const email = `${p.local}.${RUN_STAMP}@${p.domain ?? 'mailinator.com'}`;
  const name = [p.first, p.last].filter(Boolean).join(' ');
  const id = await test.step(`Create the Salesforce Contact ${name} on the Account`, async () =>
    (await sf()).createContact({ firstName: p.first, lastName: p.last, email: p.noEmail ? undefined : email, title: p.title, phone: p.phone, department: p.department, accountId }),
  );
  if (!p.noEmail) made.add(email.toLowerCase());
  return { email, name, id };
}

// One Account named with the run stamp, so it never matches another run's Account.
async function makeAccount(company: string, extra: { website?: string; phone?: string; industry?: string } = {}): Promise<{ id: string; name: string }> {
  const name = `${company} ${RUN_STAMP}`;
  const id = await test.step(`Create the Salesforce Account "${name}"`, async () => (await sf()).createAccount(name, extra));
  return { id, name };
}

// An Account with one new Contact: the shape of most rows.
async function accountWith(company: string, p: Person): Promise<Made> {
  const account = await makeAccount(company);
  return makeContact(p, account.id);
}

// What a run reads (proven 2026-11-12 in the Refold run, node "Get initial timestamp" and the salesforce node):
// SELECT FIELDS(ALL), (SELECT FIELDS(ALL) FROM Contacts LIMIT 200) FROM Account WHERE CreatedDate>={{timestamp}} LIMIT 200,
// with the timestamp 3 hours before the run starts. So a run reads only Accounts created in the last 3 hours,
// not the whole org (the dev log A4 and the first version of this spec said the whole org).
const WINDOW_H = 3;
const isoAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString().replace(/\.\d+Z$/, 'Z');
// Every test person this spec or a sibling made carries a run stamp (8 base-36 characters) after the local part.
const isTestPerson = (email: string) => /\.[0-9a-z]{8}@/.test(email);

// Emails of Contacts on Accounts created in the last `hours` hours: the people a run reads. 4 hours is the window
// plus a margin (the rows that hit every prospect check it), 2 hours is certainly inside it.
async function orgContactEmails(hours = WINDOW_H + 1): Promise<string[]> {
  const rows: { Email: string }[] = await (await sf()).query(`SELECT Email FROM Contact WHERE Email != null AND AccountId != null AND Account.CreatedDate >= ${isoAgo(hours)} LIMIT 2000`);
  return [...new Set(rows.map((r) => r.Email.toLowerCase()))];
}

// Emails of Contacts on Accounts older than the window plus a margin: the org's own people, never read by a run.
// Test people are left out, they age into this set after a few hours.
async function oldContactEmails(): Promise<string[]> {
  const rows: { Email: string }[] = await (await sf()).query(`SELECT Email FROM Contact WHERE Email != null AND AccountId != null AND Account.CreatedDate < ${isoAgo(WINDOW_H + 1)} LIMIT 2000`);
  return [...new Set(rows.map((r) => r.Email.toLowerCase()))].filter((e) => !isTestPerson(e));
}

// The org's own Contacts that were on Accounts before this spec (read once, lazily, so a rerun of one row has them).
let existing: string[] = [];
async function loadExisting(): Promise<string[]> {
  if (existing.length === 0) existing = await oldContactEmails();
  return existing;
}

// Skips the row when a person the spec does not know sits in the read set (the Accounts of the last 4 hours).
async function readSetIsKnown(): Promise<void> {
  await loadExisting();
  const unknown = (await orgContactEmails()).filter((e) => !existing.includes(e) && !made.has(e) && !isTestPerson(e));
  test.skip(unknown.length > 0, `Unknown Contacts on Accounts of the last ${WINDOW_H + 1} hours would be hit by this row (not made by a test): ${unknown.slice(0, 5).join(', ')}${unknown.length > 5 ? ` and ${unknown.length - 5} more` : ''}. Rerun when they are gone or add them to the known list.`);
}

// ---- Saleshandy side ----

const gate = () => test.skip(process.env.ACCEPT_SENDS !== '1', 'Moves every Contact of the org into an ACTIVE sequence and step 1 sends. Run with ACCEPT_SENDS=1.');

async function runAndLog(sh: SalesforceIntegrationPage): Promise<void> {
  const id = await test.step('Run the workflow now (no 3-hour wait) and wait for COMPLETED', () => runNow(sh.page, TRIGGER));
  await test.step('Find that run in Logs: Success', () => expectLogSuccess(sh, TRIGGER, id));
}

const select = (sh: SalesforceIntegrationPage, picks: Pick[]) =>
  test.step(`Select ${picks.map((p) => `"${p.activity}"`).join(' and ')} under "${TRIGGER}" and Save`, () => useActivities(sh, TRIGGER, picks));

// Puts a prospect into a sequence, the setup of the existing-prospect rows.
async function joinSequence(sh: SalesforceIntegrationPage, move: Pick): Promise<void> {
  await select(sh, [move]);
  await runAndLog(sh);
}

// A new Account with a Contact of the same email, made right before a follow-up run (QA 2026-11-12, from the
// Lead and Opportunity runs of 2026-11-11: those workflows read only records created since the last run, so a
// run with no new record does nothing). It works the same if the Account run reads the whole org.
async function againOn(c: Made, first: string | undefined, last: string, company: string): Promise<void> {
  const account = await makeAccount(company);
  await test.step(`Create a second Contact record of ${c.email} on the new Account`, async () =>
    (await sf()).createContact({ firstName: first, lastName: last, email: c.email, accountId: account.id }),
  );
}

// Text in the Activities section of the prospect details, as the Contact and Lead created specs read it (Contact
// lesson, knowledge-base lessons.md 2026-11-12: a pause shows in the Activities section, not only in Latest Status).
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

const mailDomain = (email: string) => email.split('@')[1].toLowerCase();

test.describe(TRIGGER, () => {
  // Not serial: a product failure on one row must not hide the rows behind it. File order, one worker.

  // ---- Trigger behavior (baseline) ----

  test('Trigger behavior 1: Field Mapping for Contact and Account, then trigger on with Add Prospect', async ({ salesforceIntegration: sh }) => {
    test.setTimeout(10 * 60_000);
    await test.step('Contact Properties: Job Title, Phone Number, Department mapped', async () => {
      await sh.openMapping('Contact');
      // Job Title is not in EXPECTED_MAPPING and is unmapped by default: it must be mapped to Title as on Lead.
      expect(await sh.mappedValue('Job Title'), 'Job Title on Contact Properties').toBe('Title');
      for (const field of ['Phone Number', 'Department']) {
        expect(await sh.mappedValue(field), `${field} on Contact Properties`).toBe(EXPECTED_MAPPING.Contact[field]);
      }
    });
    await test.step('Account Properties: Company Website, Company Phone, Company Industry mapped', async () => {
      await sh.openMapping('Account');
      for (const field of ['Company Website', 'Company Phone', 'Company Industry']) {
        expect(await sh.mappedValue(field), `${field} on Account Properties`).toBeTruthy();
      }
    });
    await select(sh, [ADD]);
  });

  test('Trigger behavior 2: after Save and reload, toggle and activity are still saved', async ({ salesforceIntegration: sh }) => {
    await sh.openTriggers();
    expect(await sh.isTriggerOn(TRIGGER), `"${TRIGGER}" on after reload`).toBe(true);
    expect((await sh.selectedActivities(TRIGGER)).some((a) => a.includes(ACTIVITY.add))).toBe(true);
  });

  test('Trigger behavior 3: the org holds 200 Accounts or fewer, so a new Account is inside the read', async () => {
    const accounts: { n: number }[] = await (await sf()).query('SELECT COUNT(Id) n FROM Account');
    test.info().annotations.push({ type: 'Accounts in the org', description: String(accounts[0].n) });
    expect(accounts[0].n, 'Accounts in the Salesforce org (the run reads the first 200)').toBeLessThanOrEqual(200);
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

  test('Add Prospect 1: Account with one Contact with phone, title and department becomes one prospect', async ({ salesforceIntegration: sh, saleshandyCrm: crm }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await loadExisting(); // the org's own people, older than the window
    await select(sh, [ADD]);
    priya = await accountWith('Northwind Foods', { first: 'Priya', last: 'Nair', local: 'priya.nair', title: 'Procurement Manager', phone: '+1 415 555 0132', department: 'Procurement' });
    await runAndLog(sh);
    await test.step('Check Priya Nair is one prospect with the mapped fields', () =>
      expectProspect(crm, { Email: priya.email, 'First Name': 'Priya', 'Last Name': 'Nair' }, { 'Job Title': 'Procurement Manager', 'Phone Number': '+1 415 555 0132', Department: 'Procurement' }),
    );
  });

  test('Add Prospect 2: run again with no new Account, still one prospect', async ({ salesforceIntegration: sh, saleshandyCrm: crm }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    test.skip(!priya, 'Add Prospect 1 did not create Priya Nair.');
    await select(sh, [ADD]);
    await runAndLog(sh);
    await untilPasses(`Prospects with ${priya.email}`, async () => {
      expect(await crm.search(priya.email)).toBe(1);
    });
  });

  test('Add Prospect 3: an Account with two Contacts becomes two prospects', async ({ salesforceIntegration: sh, saleshandyCrm: crm }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await select(sh, [ADD]);
    const account = await makeAccount('Kestrel Logistics');
    const rahul = await makeContact({ first: 'Rahul', last: 'Mehta', local: 'rahul.mehta.two', title: 'Fleet Manager' }, account.id);
    daniel = await makeContact({ first: 'Daniel', last: 'Okafor', local: 'daniel.okafor', title: 'Finance Director' }, account.id);
    await runAndLog(sh);
    await expectProspect(crm, { Email: rahul.email, 'First Name': 'Rahul', 'Last Name': 'Mehta' }, {});
    await expectProspect(crm, { Email: daniel.email, 'First Name': 'Daniel', 'Last Name': 'Okafor' }, {});
  });

  test('Add Prospect 4: an Account with no Contact makes no prospect and no error', async ({ salesforceIntegration: sh, saleshandyCrm: crm }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await select(sh, [ADD]);
    const account = await makeAccount('Harbor Freight, no contact yet');
    await runAndLog(sh);
    await staysTrue(sh.page, async () => {
      expect(await crm.search(account.name), `prospects named ${account.name}`).toBe(0);
    });
  });

  test('Add Prospect 5: of two Contacts one has no Email, only the other becomes a prospect', async ({ salesforceIntegration: sh, saleshandyCrm: crm }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await select(sh, [ADD]);
    const account = await makeAccount('Iyer Textiles');
    const withEmail = await makeContact({ first: 'Meera', last: 'Iyer', local: 'meera.iyer', title: 'Buyer' }, account.id);
    await makeContact({ first: 'Karan', last: 'Iyer', local: 'karan.iyer', phone: '+1 415 555 0177', noEmail: true }, account.id);
    await runAndLog(sh);
    await expectProspect(crm, { Email: withEmail.email, 'First Name': 'Meera', 'Last Name': 'Iyer' }, {});
    await staysTrue(sh.page, async () => {
      expect(await crm.search('Karan Iyer'), 'prospects named Karan Iyer').toBe(0);
    });
  });

  test('Add Prospect 6: Account fields and Contact fields reach the prospect', async ({ salesforceIntegration: sh, saleshandyCrm: crm }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await select(sh, [ADD]);
    const account = await makeAccount('Fabrikam Packaging', { website: 'https://www.fabrikampackaging.example', phone: '+1 415 555 0190', industry: 'Manufacturing' });
    const c = await makeContact({ first: 'Lena', last: 'Fischer', local: 'lena.fischer', title: 'Operations Director', department: 'Operations' }, account.id);
    await runAndLog(sh);
    await expectProspect(crm, { Email: c.email, 'First Name': 'Lena', 'Last Name': 'Fischer' }, { 'Job Title': 'Operations Director', Department: 'Operations' });
    await check(false, 'Add Prospect 6: Company fields from the Account', () =>
      untilPasses('Company fields', async () => {
        await crm.search(c.email);
        await crm.openProspect(c.name);
        await expect(crm.field('Company Website')).toContainText('fabrikampackaging.example');
        await expect(crm.field('Company Phone')).toContainText('415 555 0190');
        await expect(crm.field('Company Industry')).toContainText('Manufacturing');
      }),
    );
    await check(true, 'Add Prospect 6: Company holds the Account Name', () =>
      untilPasses('Company', async () => {
        await expect(crm.field('Company')).toContainText(account.name);
      }),
    );
  });

  test('Add Prospect 7: the Contacts of Accounts older than 3 hours are not imported', async ({ salesforceIntegration: sh, saleshandyCrm: crm }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await loadExisting();
    test.skip(existing.length === 0, 'The org has no Contacts on Accounts older than the window.');
    await select(sh, [ADD]);
    await runAndLog(sh);
    // The run reads only Accounts created in the last 3 hours (Refold query, 2026-11-12), so the org's own
    // Contacts must stay out. A sample of 5, because every search takes about 15 s.
    const sample = existing.slice(0, 5);
    const imported: string[] = [];
    for (const email of sample) {
      if ((await crm.search(email)) !== 0) imported.push(email);
    }
    expect(imported, `of ${sample.length} sampled org Contacts (of ${existing.length}), the ones found as a prospect`).toEqual([]);
  });

  test('Add Prospect 8: prospect with an old Job Title gets the new Title from a second Contact', async ({ salesforceIntegration: sh, saleshandyCrm: crm }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await select(sh, [ADD]);
    const first = await accountWith('Rahman Trading, first order', { first: 'Nadia', last: 'Rahman', local: 'nadia.rahman', title: 'Buyer' });
    await runAndLog(sh);
    await untilPasses(`Prospect ${first.email}`, async () => {
      expect(await crm.search(first.email)).toBe(1);
    });
    // Same email, a new Title, on a new Account (duplicates allowed on purpose).
    const account = await makeAccount('Rahman Trading, renewal');
    await (await sf()).createContact({ firstName: 'Nadia', lastName: 'Rahman', email: first.email, title: 'Procurement Manager', accountId: account.id });
    await runAndLog(sh);
    await check(true, 'Add Prospect 8: Job Title updated', () =>
      untilPasses('Job Title', async () => {
        await crm.search(first.email);
        await crm.openProspect(first.name);
        await expect(crm.field('Job Title')).toHaveText('Procurement Manager');
      }),
    );
  });

  // ---- Protect the existing Contacts, then Assign a tag and Move ----

  test('Setup: the existing org Contacts go on the Do Not Contact list of this account', async ({ saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await loadExisting();
    test.skip(existing.length === 0, 'The org has no Contacts on Accounts older than the window.');
    // Not needed for the import itself (a run never reads these Accounts), a safety margin only.
    const rejected = await dnc.addEntries(existing);
    test.info().annotations.push({ type: 'Do Not Contact box refused', description: rejected.length ? rejected.join(', ') : 'nothing' });
    const listed = await dnc.entries();
    expect(existing.filter((e) => !rejected.includes(e) && !listed.includes(e)), 'accepted Contacts not on the Do Not Contact list').toEqual([]);
  });

  test('Tag 1: new Account contact gets the tag TagA', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await select(sh, [{ activity: ACTIVITY.tag, config: tagged }]);
    const c = await accountWith('Brandt Events', { first: 'Fiona', last: 'Brandt', local: 'fiona.brandt', title: 'Operations Lead' });
    await runAndLog(sh);
    await check(true, 'Tag 1', () => expectState(crm, dnc, c.email, { tag: 'TagA' }));
  });

  test('Move 1: new Account contact starts Sequence A, Step 1', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    await select(sh, [MOVE_A]);
    const c = await accountWith('Hallberg Freight', { first: 'Marcus', last: 'Hallberg', local: 'marcus.hallberg', title: 'Logistics Director' });
    await runAndLog(sh);
    await check(true, 'Move 1', () => expectState(crm, dnc, c.email, { sequence: SEQ_A }));
  });

  test('Tag 2: Add Prospect, Move and Tag together', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    await select(sh, [ADD, MOVE_A, { activity: ACTIVITY.tag, config: tagged }]);
    const c = await accountWith('Marchetti Catering', { first: 'Elena', last: 'Marchetti', local: 'elena.marchetti', title: 'Event Coordinator' });
    await runAndLog(sh);
    await check(true, 'Tag 2', () => expectState(crm, dnc, c.email, { sequence: SEQ_A, tag: 'TagA' }));
  });

  // ---- Paused, Replied, Finished, Resume ----
  // Sequence A stops follow-ups on a reply (Replied ends Finished), Sequence B does not.
  // The rows with Sequence A run first, those with Sequence B last: a Move to B adds every Contact to B.

  // Status 1 (Move and Paused in one run) is dropped, 2026-11-12: two activities in one run do not both apply,
  // Paused needs a prospect already in the sequence (QA 2026-11-11, Lead Paused 1). Status 5 and 8 cover Paused.

  test('Status 2: new Account contact is finished right after joining Sequence A', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    await select(sh, [MOVE_A, { activity: ACTIVITY.finished, config: sequence(false, SEQ_A) }]);
    const c = await accountWith('Grant Surveyors', { first: 'Oliver', last: 'Grant', local: 'oliver.grant' });
    await runAndLog(sh);
    await check(true, 'Status 2', () => expectState(crm, dnc, c.email, { status: 'Finished' }));
  });

  test('Status 3: new Account contact marked Replied after joining Sequence A ends Finished', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    await select(sh, [MOVE_A, { activity: ACTIVITY.replied, config: sequence(false, SEQ_A) }]);
    const c = await accountWith('Andersson Interiors', { first: 'Sofia', last: 'Andersson', local: 'sofia.andersson' });
    await runAndLog(sh);
    await check(true, 'Status 3', () => expectState(crm, dnc, c.email, { status: 'Finished' }));
  });

  test('Status 5: prospect in Sequence A is paused', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    const c = await accountWith('Northwind Foods, pause check', { first: 'Priya', last: 'Nair', local: 'priya.nair.pause' });
    await joinSequence(sh, MOVE_A);
    await againOn(c, 'Priya', 'Nair', 'Northwind Foods, pause check 2');
    await select(sh, [{ activity: ACTIVITY.paused, config: pausedIn(SEQ_A) }]);
    await runAndLog(sh);
    // The Activities text first: it shows whether the pause was applied at all, even when Latest Status lags.
    await expectActivity(crm, c.email, 'Priya Nair', PAUSED_A);
    await expectState(crm, dnc, c.email, { status: 'Paused' });
  });

  test('Status 8: paused prospect in Sequence A is resumed', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    const c = await accountWith('Northwind Foods, resume check', { first: 'Priya', last: 'Nair', local: 'priya.nair.resume' });
    await joinSequence(sh, MOVE_A);
    await againOn(c, 'Priya', 'Nair', 'Northwind Foods, resume check 2');
    await select(sh, [{ activity: ACTIVITY.paused, config: pausedIn(SEQ_A) }]);
    await runAndLog(sh);
    await expectState(crm, dnc, c.email, { status: 'Paused' });
    await againOn(c, 'Priya', 'Nair', 'Northwind Foods, resume check 3');
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
    const c = await accountWith('Northwind Foods, finish check', { first: 'Priya', last: 'Nair', local: 'priya.nair.finish' });
    await joinSequence(sh, MOVE_A);
    await againOn(c, 'Priya', 'Nair', 'Northwind Foods, finish check 2');
    await select(sh, [{ activity: ACTIVITY.finished, config: sequence(false, SEQ_A) }]);
    await runAndLog(sh);
    await expectState(crm, dnc, c.email, { status: 'Finished' });
  });

  test('Status 4: new Account contact marked Replied after joining Sequence B keeps Replied', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    await select(sh, [MOVE_B, { activity: ACTIVITY.replied, config: sequence(false, SEQ_B) }]);
    const c = await accountWith('Moreau Wines', { first: 'Lucas', last: 'Moreau', local: 'lucas.moreau' });
    await runAndLog(sh);
    await check(true, 'Status 4', () => expectState(crm, dnc, c.email, { status: 'Replied' }));
  });

  test('Status 7: prospect in Sequence B marked Replied keeps Replied', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    gate();
    const c = await accountWith('Okafor Logistics', { first: 'Daniel', last: 'Okafor', local: 'daniel.okafor.b' });
    await joinSequence(sh, MOVE_B);
    await againOn(c, 'Daniel', 'Okafor', 'Okafor Logistics, reply check 2');
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

    test('Unsubscribed 1: new Account contact asks to stop emails', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
      test.setTimeout(ROW_TIMEOUT_MS);
      gate();
      await readSetIsKnown();
      // Two steps (QA 2026-11-11, Lead Unsubscribed 1 and 2): the prospect joins Sequence B first, then Unsubscribed runs alone.
      const c = await accountWith('Kestrel Logistics, fleet audit', { first: 'Rahul', last: 'Mehta', local: 'rahul.mehta.unsub', title: 'Fleet Manager' });
      await joinSequence(sh, MOVE_B);
      await againOn(c, 'Rahul', 'Mehta', 'Kestrel Logistics, fleet audit 2');
      await select(sh, [{ activity: ACTIVITY.unsubscribed }]);
      await runAndLog(sh);
      await check(true, 'Unsubscribed 1', () => expectState(crm, dnc, c.email, { status: 'Unsubscribed' }));
    });

    const KESTREL = 'kestrellogistics.example';

    test('Blacklist 1: new Account contact on a company domain that asks never to be contacted', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
      test.setTimeout(ROW_TIMEOUT_MS);
      await readSetIsKnown();
      dncBefore = await dnc.entries();
      await select(sh, [{ activity: ACTIVITY.blacklist }]);
      const c = await accountWith('Kestrel Logistics, do not contact', { first: 'Rahul', last: 'Mehta', local: 'rahul.mehta', domain: KESTREL, title: 'Fleet Manager' });
      await runAndLog(sh);
      await expectState(crm, dnc, c.email, { dnc: KESTREL });
    });

    test('Blacklist 2: the same run again lists the domain once', async ({ salesforceIntegration: sh, saleshandyDnc: dnc }) => {
      test.setTimeout(ROW_TIMEOUT_MS);
      await readSetIsKnown();
      dncBefore = await dnc.entries();
      await select(sh, [{ activity: ACTIVITY.blacklist }]);
      await accountWith('Kestrel Logistics, second run', { first: 'Rahul', last: 'Mehta', local: 'rahul.mehta.again', domain: KESTREL });
      await runAndLog(sh);
      // A second Contact on the listed domain, made after the first run (QA 2026-11-12). On Lead this made
      // "Blacklist Domains (Bulk)" error with 400 "Inserted email or domain already exist in this list"
      // (QA 2026-11-11: expected). Account is not confirmed, so the outcome is recorded, not asserted.
      await accountWith('Kestrel Logistics, third record', { first: 'Rahul', last: 'Mehta', local: 'rahul.mehta.third', domain: KESTREL });
      let secondRun = 'COMPLETED and Success in Logs';
      try {
        await runAndLog(sh);
      } catch (e) {
        secondRun = (e as Error).message.split('\n')[0];
      }
      test.info().annotations.push({ type: 'Blacklist 2 second run', description: secondRun });
      await check(true, 'Blacklist 2: domain listed once', async () => {
        expect((await dnc.entries()).filter((e) => e === KESTREL)).toHaveLength(1);
      });
    });

    test('Blacklist 3: Blacklist and Add Prospect together run only the blacklist', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
      test.setTimeout(ROW_TIMEOUT_MS);
      await readSetIsKnown();
      dncBefore = await dnc.entries();
      await select(sh, [ADD, { activity: ACTIVITY.blacklist }]);
      const c = await accountWith('Harbor Freight, both activities', { first: 'Greta', last: 'Lindholm', local: 'greta.lindholm', domain: 'harborfreight.example' });
      await runAndLog(sh);
      await expectState(crm, dnc, c.email, { dnc: 'harborfreight.example' });
    });

    // Rewritten 2026-11-12 like Opportunity Blacklist 4: the run of the first try listed only the new Account's domain
    // (Refold run 6af54dfee1fba522a333c249, domains ["kestrellogistics.example"]), not mailinator.com or
    // harborfreight.example from earlier rows. Two new Accounts on two domains in one run are the proven shape.
    test('Blacklist 4: two new Accounts on two company domains, both domains are listed once', async ({ salesforceIntegration: sh, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
      test.setTimeout(ROW_TIMEOUT_MS);
      await readSetIsKnown();
      dncBefore = await dnc.entries();
      await select(sh, [{ activity: ACTIVITY.blacklist }]);
      const harbor = 'harborfreight.example';
      const first = await accountWith('Kestrel Logistics, all domains', { first: 'Rahul', last: 'Mehta', local: 'rahul.mehta.all', domain: KESTREL });
      const second = await accountWith('Harbor Freight, all domains', { first: 'Greta', last: 'Lindholm', local: 'greta.lindholm.all', domain: harbor });
      await runAndLog(sh);
      await expectState(crm, dnc, first.email, { dnc: KESTREL });
      await expectState(crm, dnc, second.email, { dnc: harbor });
      const listed = await dnc.entries();
      expect(listed.filter((e) => e === KESTREL), `${KESTREL} listed once`).toHaveLength(1);
      expect(listed.filter((e) => e === harbor), `${harbor} listed once`).toHaveLength(1);
    });
  });

  // ---- Restore (not a case) ----

  test('Restore: trigger off, existing Contacts off the Do Not Contact list', async ({ salesforceIntegration: sh, saleshandyDnc: dnc }) => {
    test.setTimeout(ROW_TIMEOUT_MS);
    await sh.openTriggers();
    await sh.disable(TRIGGER);
    await sh.save();
    await expect(sh.savedToast(), 'save confirmation').toBeVisible();
    const listed = await dnc.entries();
    await loadExisting();
    for (const email of existing.filter((e) => listed.includes(e))) await dnc.removeEntry(email);
  });
});
