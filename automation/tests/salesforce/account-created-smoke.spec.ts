// Production smoke test: Account is created in Salesforce (AL-4143, parent AL-4131). No fixed bug ticket: a baseline.
// Checklist: notes/production-testing/30-salesforce-account-created.md (approved by QA 2026-11-12): 12 checks and a
// last test that turns the trigger off. Each check follows the staging row of the same activity in
// tests/salesforce/account-created.spec.ts (28 rows). Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts); the Salesforce org is the same
//    dev org (saleshandy-dev-ed);
//  - the sequence is the day's smoke sequence (SMOKE_SEQUENCE_NAME, made by the setup spec);
//  - the Logs tab is not opened (the run status comes from run-now). A prospect still missing after 3 minutes fails the
//    check and QA decides if it is a bug;
//  - other triggers are never switched (KEEP_OTHER_TRIGGERS). Every check stops before it saves or runs when any
//    trigger besides this one is on, so no step 1 send starts another workflow;
//  - on production a run reads only the Accounts created since its last run (proven 2026-11-12, see the flow file). The
//    start time of the last run is kept in test-data/salesforce/account-created-smoke-lastrun.txt. The window check
//    counts the Accounts since then that do not hold this run's stamp in the name (other people's). A Move,
//    Unsubscribed or Blacklist check is skipped, not failed, when there is one. Skipping happens before anything is
//    created or run;
//  - a status check acts on a prospect that is already in the sequence, so it creates a second Account with a Contact
//    of the same email;
//  - a Move run moves every Contact of the window, also the smoke's earlier ones, so the sends are counted from the
//    Contacts of the window that are not in the sequence yet (usually more than one in the first Move run);
//  - each Move send is counted against SEND_CAP. No production setting is changed. The last test turns the
//    Account trigger off so the 3-hour cron does not import the org's Accounts. ACCOUNT_TRIGGER_NAME overrides the name.
// The checks do not delete what they create. The Do Not Contact entries the Blacklist check adds are removed again.
//
// Run through scripts/run-salesforce-account-created-smoke.sh (npm run smoke:salesforce-account-created), which runs
// the gate and the setup spec first. Needs, once:
//   npm run login:saleshandy -- emailopenedprod
// The Salesforce REST login needs a trusted IP (Setup > Network Access).
process.env.KEEP_OTHER_TRIGGERS ??= '1';

import { expect, test } from '../../src/fixtures/index.ts';
import { checkSendCap, recordSend } from '../../src/data/send-cap.ts';
import { ACC_TRIGGER, contactEmailsInWindow, foreignAccountsInWindow, runAccountNow } from '../../src/flows/salesforce-account-created.ts';
import { expectProspect } from '../../src/flows/salesforce-lead-created.ts';
import { ACTIVITY, RUN_STAMP, pausedIn, sequence, tagged, useActivities, type Pick } from '../../src/flows/salesforce-to-saleshandy.ts';
import type { SalesforceIntegrationPage } from '../../src/pages/saleshandy/salesforce-integration.page.ts';
import { SalesforceApi } from '../../src/utils/salesforce-api.ts';
import { untilPasses } from '../../src/utils/wait.ts';

// SIBLING_TRIGGERS: triggers of a parallel smoke run, comma separated. They may be on while this check saves and runs.
const SIBLINGS = (process.env.SIBLING_TRIGGERS ?? '').split(',').map((n) => n.trim()).filter(Boolean);

test.use({ account: 'emailopenedprod', actionTimeout: 30_000 });
test.setTimeout(25 * 60_000);

const SEQ = process.env.SMOKE_SEQUENCE_NAME ?? '';
const TAG = 'TagA';
type Made = { email: string; name: string; first: string; last: string; id: string };
type Crm = Parameters<typeof expectProspect>[0];
type Person = { first: string; last: string; local: string; domain?: string; title?: string; phone?: string; department?: string };

let sf: SalesforceApi;
test.beforeAll(async () => {
  if (!SEQ) throw new Error('SMOKE_SEQUENCE_NAME is not set. Use scripts/run-salesforce-account-created-smoke.sh.');
  sf = await SalesforceApi.login();
});

// A prospect that is still missing 3 minutes after the run fails the check, and QA decides if it is a bug (QA 2026-11-05).
const expectP = (crm: Crm, email: string, fullName: string, want: Parameters<typeof expectProspect>[3]) => expectProspect(crm, email, fullName, want, 3 * 60_000);

const MOVE: Pick = { activity: ACTIVITY.move, config: sequence(true, SEQ) };
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let counter = 0;

// One Account named with the run stamp (so the window check knows it) and a counter (so names never repeat).
async function makeAccount(company: string, extra: { website?: string; phone?: string; industry?: string } = {}): Promise<{ id: string; name: string }> {
  counter += 1;
  const name = `${company} ${RUN_STAMP}${counter}`;
  const id = await test.step(`Create the Salesforce Account "${name}"`, () => sf.createAccount(name, extra));
  return { id, name };
}

// One Contact on an Account, a new email on every run unless `email` is given.
async function makeContact(p: Person, accountId: string, email?: string): Promise<Made> {
  counter += 1;
  const address = email ?? `${p.local}.${RUN_STAMP}${counter}@${p.domain ?? 'mailinator.com'}`;
  const id = await test.step(`Create the Salesforce Contact ${p.first} ${p.last} on the Account`, () =>
    sf.createContact({ firstName: p.first, lastName: p.last, email: address, title: p.title, phone: p.phone, department: p.department, accountId }),
  );
  return { email: address, name: `${p.first} ${p.last}`, first: p.first, last: p.last, id };
}

// Sets the trigger and its activities. Stops first when any other trigger is on: a Move run sends step 1, which would
// start Email Sent, Email Opened or Link Clicked. Nothing was sent or saved when it stops.
async function use(i: SalesforceIntegrationPage, picks: Pick[]): Promise<void> {
  await i.openTriggers();
  const others = (await i.onTriggers()).filter((name) => name !== ACC_TRIGGER && !SIBLINGS.includes(name));
  expect(others, `Other triggers are on: ${others.join(', ')}. Turn them off and run again. Nothing was sent.`).toEqual([]);
  await useActivities(i, ACC_TRIGGER, picks);
}

const names = (picks: Pick[]) => picks.map((p) => `"${p.activity}"`).join(' + ');

// Skips the check, before anything is created or run, when other people's Accounts were created since the last run.
async function windowIsOurs(what: string): Promise<void> {
  const n = await foreignAccountsInWindow(sf, RUN_STAMP);
  test.skip(n > 0, `${n} Account(s) that this smoke did not create are in the window since the last run; ${what}`);
}

// A new Account and Contact, trigger set with `picks`, run now.
async function newAccountRun(i: SalesforceIntegrationPage, picks: Pick[], p: Person, company: string): Promise<Made> {
  await test.step(`Select ${names(picks)} and Save`, () => use(i, picks));
  const account = await makeAccount(company);
  const c = await makeContact(p, account.id);
  await test.step('Run the workflow now and wait for COMPLETED', () => runAccountNow(i.page));
  return c;
}

// Emails this run already moved into the smoke sequence: a Move run does not send step 1 for them again.
const moved = new Set<string>();

// A Contact whose prospect goes into the smoke sequence. Counts one send for every window Contact not moved yet.
async function moveIn(i: SalesforceIntegrationPage, crm: Crm, p: Person, company: string): Promise<Made> {
  checkSendCap();
  await windowIsOurs('the Move run would send step 1 for their contacts');
  await test.step(`Select ${names([MOVE])} and Save`, () => use(i, [MOVE]));
  const account = await makeAccount(company);
  const c = await makeContact(p, account.id);
  const pending = (await contactEmailsInWindow(sf)).filter((e) => !moved.has(e));
  test.info().annotations.push({ type: 'Move sends', description: `${pending.length} Contact(s) of the window are not in ${SEQ} yet: ${pending.join(', ')}` });
  await test.step('Run the workflow now and wait for COMPLETED', () => runAccountNow(i.page));
  for (const e of pending) {
    recordSend(`Account is created smoke: Move run, step 1 for ${e}`);
    moved.add(e);
  }
  await test.step(`Check ${c.name} is in ${SEQ}`, () => expectP(crm, c.email, c.name, { sequence: SEQ }));
  return c;
}

// A second Account with a Contact of the same email runs `picks` alone on a prospect already in the sequence.
async function followUp(i: SalesforceIntegrationPage, c: Made, picks: Pick[], what: string): Promise<void> {
  await test.step(`Select ${names(picks)}, second Account for ${c.name}, run now`, async () => {
    await use(i, picks);
    const account = await makeAccount(`Northwind Foods, ${what} follow-up`);
    await makeContact({ first: c.first, last: c.last, local: 'unused' }, account.id, c.email);
    await runAccountNow(i.page);
  });
}

// The Contact fields the account maps, read on Field Mapping. A field that is not mapped is not asserted and is noted.
async function mapped(i: SalesforceIntegrationPage, object: 'Contact' | 'Account', wanted: Record<string, string>): Promise<Record<string, string>> {
  await i.openMapping(object);
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const [label, value] of Object.entries(wanted)) {
    const m = (await i.mappedValue(label).catch(() => '')) ?? '';
    if (m && !/^select/i.test(m.trim())) out[label] = value;
    else missing.push(label);
  }
  if (missing.length) test.info().annotations.push({ type: 'Not mapped on production', description: `${missing.join(', ')} (${object} Properties). Not asserted.` });
  return out;
}

const LIST = [ACTIVITY.add, ACTIVITY.move, ACTIVITY.unsubscribed, ACTIVITY.finished, ACTIVITY.replied, ACTIVITY.paused, ACTIVITY.resume, ACTIVITY.tag, ACTIVITY.blacklist];

test.describe(`${ACC_TRIGGER}: production smoke`, () => {
  test('Smoke 1: the activity list opens with nine activities in order, no "No Data" box and no "Select a list" field', async ({ salesforceIntegration: i }) => {
    await use(i, [{ activity: ACTIVITY.add }]);
    await i.openTriggers();
    await i.openActivityList(ACC_TRIGGER);
    const tops: number[] = [];
    for (const name of LIST) {
      const option = i.activityOption(name);
      await expect(option, name).toBeVisible({ timeout: 15_000 });
      tops.push((await option.boundingBox())?.y ?? -1);
    }
    expect(tops, 'activities in list order, top to bottom').toEqual([...tops].sort((a, b) => a - b));
    await expect(i.page.getByText('No Data'), '"No Data" box').toHaveCount(0);
    await expect(i.page.getByText('Select a list'), '"Select a list" field').toHaveCount(0);
    await i.openTriggers();
  });

  test('Smoke 2: Add Prospect, new Account with one Contact, one prospect with the mapped fields', async ({ salesforceIntegration: i, saleshandyCrm: crm }) => {
    const wanted = { 'Job Title': 'Procurement Manager', 'Phone Number': '+1 415 555 0132', Department: 'Procurement' };
    const fields = await test.step('Read Contact Properties on Field Mapping', () => mapped(i, 'Contact', wanted));
    const c = await newAccountRun(i, [{ activity: ACTIVITY.add }], { first: 'Priya', last: 'Nair', local: 'priya.nair', title: wanted['Job Title'], phone: wanted['Phone Number'], department: wanted.Department }, 'Northwind Foods');
    await test.step(`Check ${c.name} in Saleshandy`, () => expectP(crm, c.email, c.name, { status: 'Inactive', fields }));
  });

  test('Smoke 3: Add Prospect, Account Website, Phone and Industry reach the prospect', async ({ salesforceIntegration: i, saleshandyCrm: crm }) => {
    const wanted = { 'Company Website': 'fabrikampackaging.example', 'Company Phone': '415 555 0190', 'Company Industry': 'Manufacturing' };
    const fields = await test.step('Read Account Properties on Field Mapping', () => mapped(i, 'Account', wanted));
    await test.step('Select "Add Prospect" and Save', () => use(i, [{ activity: ACTIVITY.add }]));
    const account = await makeAccount('Fabrikam Packaging', { website: 'https://fabrikampackaging.example', phone: '+1 415 555 0190', industry: 'Manufacturing' });
    const c = await makeContact({ first: 'Marta', last: 'Kowalski', local: 'marta.kowalski', title: 'Purchasing Lead' }, account.id);
    await test.step('Run the workflow now and wait for COMPLETED', () => runAccountNow(i.page));
    await test.step(`Check ${c.name} has the Account fields`, async () => {
      await expectP(crm, c.email, c.name, {});
      await untilPasses('Account fields on the prospect', async () => {
        await crm.search(c.email);
        await crm.openProspect(c.name);
        for (const [label, value] of Object.entries(fields)) await expect(crm.field(label), label).toContainText(value);
        await crm.page.keyboard.press('Escape');
      }, 60_000);
    });
  });

  test('Smoke 4: Add Prospect, two Contacts on one Account become two prospects', async ({ salesforceIntegration: i, saleshandyCrm: crm }) => {
    await test.step('Select "Add Prospect" and Save', () => use(i, [{ activity: ACTIVITY.add }]));
    const account = await makeAccount('Kestrel Logistics');
    const rahul = await makeContact({ first: 'Rahul', last: 'Mehta', local: 'rahul.mehta', title: 'Fleet Manager' }, account.id);
    const daniel = await makeContact({ first: 'Daniel', last: 'Okafor', local: 'daniel.okafor', title: 'Finance Director' }, account.id);
    await test.step('Run the workflow now and wait for COMPLETED', () => runAccountNow(i.page));
    await test.step(`Check ${rahul.name} in Saleshandy`, () => expectP(crm, rahul.email, rahul.name, {}));
    await test.step(`Check ${daniel.name} in Saleshandy`, () => expectP(crm, daniel.email, daniel.name, {}));
  });

  test('Smoke 5: Add Prospect, an Account with no Contact completes with no prospect and no error', async ({ salesforceIntegration: i }) => {
    await test.step('Select "Add Prospect" and Save', () => use(i, [{ activity: ACTIVITY.add }]));
    await makeAccount('Linden Wholesale');
    // runAccountNow expects COMPLETED, so an error fails the check. No new prospect can be tied to this Account.
    await test.step('Run the workflow now and wait for COMPLETED', () => runAccountNow(i.page));
  });

  test('Smoke 6: Move Prospect to another Sequence', async ({ salesforceIntegration: i, saleshandyCrm: crm }) => {
    await moveIn(i, crm, { first: 'Marcus', last: 'Hallberg', local: 'marcus.hallberg', title: 'Logistics Director' }, 'Hallberg Freight');
  });

  test('Smoke 7: Assign a tag to Prospect', async ({ salesforceIntegration: i, saleshandyCrm: crm }) => {
    const c = await newAccountRun(i, [{ activity: ACTIVITY.tag, config: tagged }], { first: 'Fiona', last: 'Brandt', local: 'fiona.brandt', title: 'Operations Lead' }, 'Brandt Events');
    await test.step(`Check ${c.name} is tagged ${TAG}`, () => expectP(crm, c.email, c.name, { tag: TAG }));
  });

  test('Smoke 8: Mark Prospect as Paused', async ({ salesforceIntegration: i, saleshandyCrm: crm }) => {
    const c = await moveIn(i, crm, { first: 'Hannah', last: 'Lindqvist', local: 'hannah.lindqvist' }, 'Lindqvist Design');
    await followUp(i, c, [{ activity: ACTIVITY.paused, config: pausedIn(SEQ) }], 'pause');
    // The page renders the sequence name as a link, so the text has two spaces before it.
    await test.step(`Check ${c.name}: Paused, with the number of days in Activities`, () =>
      expectP(crm, c.email, c.name, { status: 'Paused', activity: new RegExp(`has been paused for \\d+ days for sequence\\s+${escape(SEQ)}`) }));
  });

  test('Smoke 9: Mark Prospect as Resume(Un-pause)', async ({ salesforceIntegration: i, saleshandyCrm: crm }) => {
    const c = await moveIn(i, crm, { first: 'Elena', last: 'Marchetti', local: 'elena.marchetti' }, 'Marchetti Catering');
    await followUp(i, c, [{ activity: ACTIVITY.paused, config: pausedIn(SEQ) }], 'pause');
    await test.step(`Check ${c.name} is Paused first`, () => expectP(crm, c.email, c.name, { status: 'Paused' }));
    await followUp(i, c, [{ activity: ACTIVITY.resume, config: sequence(false, SEQ) }], 'resume');
    await test.step(`Check ${c.name} is Active again`, () => expectP(crm, c.email, c.name, { status: 'Active' }));
  });

  test('Smoke 10: Mark Prospect as Replied', async ({ salesforceIntegration: i, saleshandyCrm: crm }) => {
    const c = await moveIn(i, crm, { first: 'Lucas', last: 'Moreau', local: 'lucas.moreau' }, 'Moreau Wines');
    await followUp(i, c, [{ activity: ACTIVITY.replied, config: sequence(false, SEQ) }], 'reply');
    // The smoke sequence keeps sending after a reply, so the status stays Replied, not Finished.
    await test.step(`Check ${c.name} is Replied`, () => expectP(crm, c.email, c.name, { status: 'Replied' }));
  });

  test('Smoke 11: Mark Prospect as Finished', async ({ salesforceIntegration: i, saleshandyCrm: crm }) => {
    const c = await moveIn(i, crm, { first: 'Oliver', last: 'Grant', local: 'oliver.grant' }, 'Grant Surveyors');
    await followUp(i, c, [{ activity: ACTIVITY.finished, config: sequence(false, SEQ) }], 'finish');
    await test.step(`Check ${c.name} is Finished`, () => expectP(crm, c.email, c.name, { status: 'Finished' }));
  });

  // Unsubscribed, then Blacklist, in one check (QA 2026-11-12, one row). Both stop first when other people's Accounts
  // are in the window, before anything is created. The Do Not Contact entries the run adds are removed in `finally`.
  test('Smoke 12: Mark Prospect as Unsubscribed, then Blacklist a Domain on a reserved test domain', async ({ salesforceIntegration: i, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    checkSendCap();
    await windowIsOurs('Unsubscribed and Blacklist would reach their contacts and domains');
    const domain = `acc${Date.now().toString(36)}.example.com`;
    await dnc.openGlobalList();
    const before = await dnc.entries();
    try {
      const c = await moveIn(i, crm, { first: 'Rahul', last: 'Mehta', local: 'rahul.mehta.unsub', title: 'Fleet Manager' }, 'Kestrel Logistics, fleet audit');
      await followUp(i, c, [{ activity: ACTIVITY.unsubscribed }], 'unsubscribe');
      await test.step(`Check ${c.name} is Unsubscribed`, () => expectP(crm, c.email, c.name, { status: 'Unsubscribed' }));

      await test.step('Select "Blacklist a Domain" and Save', () => use(i, [{ activity: ACTIVITY.blacklist }]));
      const account = await makeAccount('Harbor Freight, do not contact');
      const g = await makeContact({ first: 'Greta', last: 'Lindholm', local: 'greta.lindholm', domain, title: 'Fleet Manager' }, account.id);
      await test.step('Run the workflow now and wait for COMPLETED', () => runAccountNow(i.page));
      await untilPasses(`${domain} not on the Do Not Contact list`, async () => {
        await dnc.openGlobalList();
        expect(await dnc.entries(), `${domain} on the list`).toContain(domain);
      });
      expect(await crm.search(g.email), 'prospects with the blacklisted domain').toBe(0);
    } finally {
      await dnc.openGlobalList();
      const added = (await dnc.entries()).filter((e) => !before.includes(e));
      for (const entry of added) {
        await dnc.openGlobalList();
        await dnc.removeEntry(entry);
      }
      test.info().annotations.push({ type: 'Do Not Contact', description: `removed after the check: ${added.join(', ') || 'nothing new'}` });
    }
  });

  // Last: the trigger goes off, so the 3-hour cron does not import the org's Accounts into the production account.
  test('Restore: Account is created in Salesforce is off', async ({ salesforceIntegration: i }) => {
    await i.openTriggers();
    await i.disable(ACC_TRIGGER);
    await i.save();
    await expect(i.savedToast(), 'save confirmation').toBeVisible();
    await i.page.reload();
    await i.openTriggers();
    expect(await i.isTriggerOn(ACC_TRIGGER), `"${ACC_TRIGGER}" is on after the reload`).toBe(false);
  });
});
