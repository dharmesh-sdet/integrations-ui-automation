// Production smoke test: Opportunity is created in Salesforce (AL-4142, parent AL-4131). No fixed bug ticket: a baseline.
// Checklist: notes/production-testing/28-salesforce-opportunity-created.md (approved by QA 2026-11-12): 12 checks and a
// last test that turns the trigger off. Each check follows the staging row of the same activity in
// tests/salesforce/opportunity-created.spec.ts (27 rows, commit 992e7a1). Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts); the Salesforce org is the same
//    dev org (saleshandy-dev-ed);
//  - the sequence is the day's smoke sequence (SMOKE_SEQUENCE_NAME, made by the setup spec), nothing production is
//    hard-coded;
//  - the Logs tab is not opened (the run status comes from run-now). A prospect still missing after 3 minutes fails the
//    check and QA decides if it is a bug;
//  - other triggers are never switched (KEEP_OTHER_TRIGGERS). Every check stops before it saves or runs when any
//    trigger besides this one is on, so no step 1 send starts another workflow;
//  - the window of the run is kept in its own file (OPP_LAST_RUN_FILE), so staging runs do not move it. A check that
//    would reach other people's deals (Move, Unsubscribed, Blacklist) is skipped, not failed;
//  - a status check acts on a prospect that is already in the sequence, so it creates a second deal for the same
//    Contact (a run reads only deals created since the last run, so a follow-up run needs a new deal);
//  - each Move run is one send, counted against SEND_CAP. No production setting is changed. The last test turns the
//    Opportunity trigger off so the 3-hour cron does not import the org's deals. OPPORTUNITY_TRIGGER_NAME overrides the name.
// The checks do not delete what they create, except the Blacklist domain.
//
// Run through scripts/run-salesforce-opportunity-created-smoke.sh (npm run smoke:salesforce-opportunity-created), which
// runs the gate and the setup spec first. Needs, once:
//   npm run login:saleshandy -- emailopenedprod
// The Salesforce REST login needs a trusted IP (Setup > Network Access).
process.env.KEEP_OTHER_TRIGGERS ??= '1';

import { expect, test } from '../../src/fixtures/index.ts';
import { checkSendCap, recordSend } from '../../src/data/send-cap.ts';
import { OPP_TRIGGER, opportunitiesInWindow, runOpportunityNow } from '../../src/flows/salesforce-opportunity-created.ts';
import { expectProspect } from '../../src/flows/salesforce-lead-created.ts';
import { ACTIVITY, RUN_STAMP, pausedIn, sequence, tagged, useActivities, type Pick } from '../../src/flows/salesforce-to-saleshandy.ts';
import type { SalesforceIntegrationPage } from '../../src/pages/saleshandy/salesforce-integration.page.ts';
import { SalesforceApi } from '../../src/utils/salesforce-api.ts';
import { untilPasses } from '../../src/utils/wait.ts';

// SIBLING_TRIGGERS: triggers of a parallel smoke run (scripts/run-salesforce-lead-opportunity-pair-smoke.sh), comma separated.
// They may be on while this check saves and runs. Any other trigger still stops the check.
const SIBLINGS = (process.env.SIBLING_TRIGGERS ?? '').split(',').map((n) => n.trim()).filter(Boolean);

test.use({ account: 'emailopenedprod', actionTimeout: 30_000 });
test.setTimeout(25 * 60_000);

const SEQ = process.env.SMOKE_SEQUENCE_NAME ?? '';
const TAG = 'TagA';
type Made = { email: string; name: string; first: string; last: string; id: string };
type Crm = Parameters<typeof expectProspect>[0];

let sf: SalesforceApi;
test.beforeAll(async () => {
  if (!SEQ) throw new Error('SMOKE_SEQUENCE_NAME is not set. Use scripts/run-salesforce-opportunity-created-smoke.sh.');
  process.env.OPP_LAST_RUN_FILE ??= `${process.env.TMPDIR ?? '/tmp'}/opportunity-created-smoke-lastrun.txt`;
  sf = await SalesforceApi.login();
});

// A prospect that is still missing 3 minutes after the run fails the check, and QA decides if it is a bug (QA 2026-11-05).
const expectP = (crm: Crm, email: string, fullName: string, want: Parameters<typeof expectProspect>[3]) => expectProspect(crm, email, fullName, want, 3 * 60_000);

const MOVE: Pick = { activity: ACTIVITY.move, config: sequence(true, SEQ) };
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const closeDate = () => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
let counter = 0;

// One Contact with a new email on every run.
async function makeContact(p: { first: string; last: string; local: string; domain?: string; title?: string; phone?: string; department?: string }): Promise<Made> {
  counter += 1;
  const email = `${p.local}.${RUN_STAMP}${counter}@${p.domain ?? 'mailinator.com'}`;
  const id = await test.step(`Create the Salesforce Contact ${p.first} ${p.last}`, () =>
    sf.createContact({ firstName: p.first, lastName: p.last, email, title: p.title, phone: p.phone, department: p.department }),
  );
  return { email, name: `${p.first} ${p.last}`, first: p.first, last: p.last, id };
}

// One Opportunity whose contact roles are `contacts` (the first one primary).
async function makeDeal(deal: string, contacts: Made[], amount?: number): Promise<void> {
  counter += 1;
  const name = `${deal} ${RUN_STAMP}${counter}`;
  await test.step(`Create the Salesforce Opportunity "${name}" with ${contacts.length} contact role(s)`, async () => {
    await sf.createOpportunity({ name, stage: 'Prospecting', closeDate: closeDate(), amount, contactIds: contacts.map((c) => c.id) });
  });
}

// Sets the trigger and its activities. Stops first when any other trigger is on: a Move run sends step 1, which would
// start Email Sent, Email Opened or Link Clicked. Nothing was sent or saved when it stops.
async function use(i: SalesforceIntegrationPage, picks: Pick[]): Promise<void> {
  await i.openTriggers();
  const others = (await i.onTriggers()).filter((name) => name !== OPP_TRIGGER && !SIBLINGS.includes(name));
  expect(others, `Other triggers are on: ${others.join(', ')}. Turn them off and run again. Nothing was sent.`).toEqual([]);
  await useActivities(i, OPP_TRIGGER, picks);
}

const names = (picks: Pick[]) => picks.map((p) => `"${p.activity}"`).join(' + ');

// A new Contact and deal, trigger set with `picks`, run now.
async function newDealRun(i: SalesforceIntegrationPage, picks: Pick[], p: Parameters<typeof makeContact>[0], deal: string, amount?: number): Promise<Made> {
  await test.step(`Select ${names(picks)} and Save`, () => use(i, picks));
  const c = await makeContact(p);
  await makeDeal(deal, [c], amount);
  await test.step('Run the workflow now and wait for COMPLETED', () => runOpportunityNow(i.page));
  return c;
}

// A Contact whose prospect goes into the smoke sequence. One send, counted.
async function moveIn(i: SalesforceIntegrationPage, crm: Crm, p: Parameters<typeof makeContact>[0], deal: string): Promise<Made> {
  checkSendCap();
  await test.step(`Select ${names([MOVE])} and Save`, () => use(i, [MOVE]));
  const c = await makeContact(p);
  await makeDeal(deal, [c]);
  // A Move run sends step 1 for every deal contact in the window, so the send count holds only if this deal is the only one.
  const n = await opportunitiesInWindow(sf);
  test.skip(n > 1, `${n} Opportunities are in the window since the last run; the Move run would send step 1 for all their contacts`);
  await test.step('Run the workflow now and wait for COMPLETED', () => runOpportunityNow(i.page));
  recordSend('Opportunity is created smoke: Move run, step 1');
  await test.step(`Check ${c.name} is in ${SEQ}`, () => expectP(crm, c.email, c.name, { sequence: SEQ }));
  return c;
}

// A second deal for the same Contact runs `picks` alone on a prospect that is already in the sequence.
async function followUp(i: SalesforceIntegrationPage, c: Made, picks: Pick[], what: string, windowCheck = false): Promise<void> {
  await test.step(`Select ${names(picks)}, second deal for ${c.name}, run now`, async () => {
    await use(i, picks);
    await makeDeal(`Northwind Foods, ${what} follow-up`, [c]);
    if (windowCheck) {
      const n = await opportunitiesInWindow(sf);
      test.skip(n > 1, `${n} Opportunities are in the window since the last run; this action would reach their contacts too`);
    }
    await runOpportunityNow(i.page);
  });
}

// Removes a domain from the Do Not Contact list (the Blacklist action lists the domain of every deal contact in the window).
async function clearDnc(dnc: { openGlobalList(): Promise<void>; hasEntry(e: string): Promise<boolean>; removeEntry(e: string): Promise<void> }, domains: string[]): Promise<void> {
  for (const d of domains) {
    await dnc.openGlobalList();
    if (await dnc.hasEntry(d)) await dnc.removeEntry(d);
  }
}

// The Contact fields the account maps, read on Field Mapping. A field that is not mapped is not asserted and is noted.
async function mappedContactFields(i: SalesforceIntegrationPage, wanted: Record<string, string>): Promise<Record<string, string>> {
  await i.openMapping('Contact');
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const [label, value] of Object.entries(wanted)) {
    const mapped = (await i.mappedValue(label).catch(() => '')) ?? '';
    if (mapped && !/^select/i.test(mapped.trim())) out[label] = value;
    else missing.push(label);
  }
  if (missing.length) test.info().annotations.push({ type: 'Not mapped on production', description: `${missing.join(', ')} (Contact Properties). Not asserted.` });
  return out;
}

const LIST = [ACTIVITY.add, ACTIVITY.move, ACTIVITY.unsubscribed, ACTIVITY.finished, ACTIVITY.replied, ACTIVITY.paused, ACTIVITY.resume, ACTIVITY.tag, ACTIVITY.blacklist];

test.describe(`${OPP_TRIGGER}: production smoke`, () => {
  test('Smoke 1: the activity list opens with nine activities in order and no "No Data" box', async ({ salesforceIntegration: i }) => {
    await use(i, [{ activity: ACTIVITY.add }]);
    await i.openTriggers();
    await i.openActivityList(OPP_TRIGGER);
    const tops: number[] = [];
    for (const name of LIST) {
      const option = i.activityOption(name);
      await expect(option, name).toBeVisible({ timeout: 15_000 });
      tops.push((await option.boundingBox())?.y ?? -1);
    }
    expect(tops, 'activities in list order, top to bottom').toEqual([...tops].sort((a, b) => a - b));
    await expect(i.page.getByText('No Data'), '"No Data" box').toHaveCount(0);
    await i.openTriggers();
  });

  test('Smoke 2: Add Prospect, new deal, one prospect with the mapped fields', async ({ salesforceIntegration: i, saleshandyCrm: crm }) => {
    const wanted = { 'Job Title': 'Procurement Manager', 'Phone Number': '+1 415 555 0132', Department: 'Procurement' };
    const fields = await test.step('Read Contact Properties on Field Mapping', () => mappedContactFields(i, wanted));
    const c = await newDealRun(i, [{ activity: ACTIVITY.add }], { first: 'Priya', last: 'Nair', local: 'priya.nair', title: wanted['Job Title'], phone: wanted['Phone Number'], department: wanted.Department }, 'Northwind Foods, 500 seats');
    await test.step(`Check ${c.name} in Saleshandy`, () => expectP(crm, c.email, c.name, { status: 'Inactive', fields }));
  });

  test('Smoke 3: Add Prospect, a Deal Value of 4321 reaches the prospect', async ({ salesforceIntegration: i, saleshandyCrm: crm }) => {
    await i.openMapping('Opportunity');
    const mapped = (await i.mappedValue('Deal Value').catch(() => '')) ?? '';
    test.skip(!mapped || /^select/i.test(mapped.trim()), 'Deal Value is not mapped on Opportunity Properties on production');
    const c = await newDealRun(i, [{ activity: ACTIVITY.add }], { first: 'Marta', last: 'Kowalski', local: 'marta.kowalski', title: 'Purchasing Lead' }, 'Kowalski Packaging, annual contract', 4321);
    await test.step(`Check ${c.name} has Deal Value 4321`, async () => {
      await expectP(crm, c.email, c.name, {});
      await untilPasses('Deal Value 4321 on the prospect', async () => {
        await crm.search(c.email);
        await crm.openProspect(c.name);
        await expect(crm.field('Deal Value')).toHaveText(/4,?321/);
        await crm.page.keyboard.press('Escape');
      }, 60_000);
    });
  });

  test('Smoke 4: Add Prospect, two contact roles on one deal become two prospects', async ({ salesforceIntegration: i, saleshandyCrm: crm }) => {
    await test.step(`Select ${names([{ activity: ACTIVITY.add }])} and Save`, () => use(i, [{ activity: ACTIVITY.add }]));
    const priya = await makeContact({ first: 'Priya', last: 'Nair', local: 'priya.nair.roles', title: 'Procurement Manager' });
    const daniel = await makeContact({ first: 'Daniel', last: 'Okafor', local: 'daniel.okafor', title: 'Finance Director' });
    await makeDeal('Northwind Foods, two sponsors', [priya, daniel]);
    await test.step('Run the workflow now and wait for COMPLETED', () => runOpportunityNow(i.page));
    await test.step(`Check ${priya.name} in Saleshandy`, () => expectP(crm, priya.email, priya.name, {}));
    await test.step(`Check ${daniel.name} in Saleshandy`, () => expectP(crm, daniel.email, daniel.name, {}));
  });

  test('Smoke 5: Move Prospect to another Sequence', async ({ salesforceIntegration: i, saleshandyCrm: crm }) => {
    await moveIn(i, crm, { first: 'Marcus', last: 'Hallberg', local: 'marcus.hallberg', title: 'Logistics Director' }, 'Hallberg Freight, fleet tracking');
  });

  test('Smoke 6: Assign a tag to Prospect', async ({ salesforceIntegration: i, saleshandyCrm: crm }) => {
    const c = await newDealRun(i, [{ activity: ACTIVITY.tag, config: tagged }], { first: 'Fiona', last: 'Brandt', local: 'fiona.brandt', title: 'Operations Lead' }, 'Brandt Events, venue hire');
    await test.step(`Check ${c.name} is tagged ${TAG}`, () => expectP(crm, c.email, c.name, { tag: TAG }));
  });

  test('Smoke 7: Mark Prospect as Paused', async ({ salesforceIntegration: i, saleshandyCrm: crm }) => {
    const c = await moveIn(i, crm, { first: 'Hannah', last: 'Lindqvist', local: 'hannah.lindqvist' }, 'Lindqvist Design, brand refresh');
    await followUp(i, c, [{ activity: ACTIVITY.paused, config: pausedIn(SEQ) }], 'pause');
    // The page renders the sequence name as a link, so the text has two spaces before it.
    await test.step(`Check ${c.name}: Paused, with the number of days in Activities`, () =>
      expectP(crm, c.email, c.name, { status: 'Paused', activity: new RegExp(`has been paused for \\d+ days for sequence\\s+${escape(SEQ)}`) }));
  });

  test('Smoke 8: Mark Prospect as Resume(Un-pause)', async ({ salesforceIntegration: i, saleshandyCrm: crm }) => {
    const c = await moveIn(i, crm, { first: 'Elena', last: 'Marchetti', local: 'elena.marchetti' }, 'Marchetti Catering, summer programme');
    await followUp(i, c, [{ activity: ACTIVITY.paused, config: pausedIn(SEQ) }], 'pause');
    await test.step(`Check ${c.name} is Paused first`, () => expectP(crm, c.email, c.name, { status: 'Paused' }));
    await followUp(i, c, [{ activity: ACTIVITY.resume, config: sequence(false, SEQ) }], 'resume');
    await test.step(`Check ${c.name} is Active again`, () => expectP(crm, c.email, c.name, { status: 'Active' }));
  });

  test('Smoke 9: Mark Prospect as Replied', async ({ salesforceIntegration: i, saleshandyCrm: crm }) => {
    const c = await moveIn(i, crm, { first: 'Lucas', last: 'Moreau', local: 'lucas.moreau' }, 'Moreau Wines, distributor deal');
    await followUp(i, c, [{ activity: ACTIVITY.replied, config: sequence(false, SEQ) }], 'reply');
    // The smoke sequence keeps sending after a reply, so the status stays Replied, not Finished.
    await test.step(`Check ${c.name} is Replied`, () => expectP(crm, c.email, c.name, { status: 'Replied' }));
  });

  test('Smoke 10: Mark Prospect as Finished', async ({ salesforceIntegration: i, saleshandyCrm: crm }) => {
    const c = await moveIn(i, crm, { first: 'Oliver', last: 'Grant', local: 'oliver.grant' }, 'Grant Surveyors, office fit-out');
    await followUp(i, c, [{ activity: ACTIVITY.finished, config: sequence(false, SEQ) }], 'finish');
    await test.step(`Check ${c.name} is Finished`, () => expectP(crm, c.email, c.name, { status: 'Finished' }));
  });

  test('Smoke 11: Mark Prospect as Unsubscribed, window holds only this deal', async ({ salesforceIntegration: i, saleshandyCrm: crm }) => {
    const c = await moveIn(i, crm, { first: 'Rahul', last: 'Mehta', local: 'rahul.mehta.unsub', title: 'Fleet Manager' }, 'Kestrel Logistics, fleet audit');
    await followUp(i, c, [{ activity: ACTIVITY.unsubscribed }], 'unsubscribe', true);
    await test.step(`Check ${c.name} is Unsubscribed`, () => expectP(crm, c.email, c.name, { status: 'Unsubscribed' }));
  });

  test('Smoke 12: Blacklist a Domain, new deal contact on a reserved test domain, window holds only this deal', async ({ salesforceIntegration: i, saleshandyCrm: crm, saleshandyDnc: dnc }) => {
    const domain = `opp${Date.now().toString(36)}.example.com`;
    await use(i, [{ activity: ACTIVITY.blacklist }]);
    const c = await makeContact({ first: 'Greta', last: 'Lindholm', local: 'greta.lindholm', domain, title: 'Fleet Manager' });
    await makeDeal('Harbor Freight, do not contact', [c]);
    const n = await opportunitiesInWindow(sf);
    test.skip(n > 1, `${n} Opportunities are in the window since the last run; their contact domains would be listed too`);
    await runOpportunityNow(i.page);
    try {
      await untilPasses(`${domain} not on the Do Not Contact list`, async () => {
        await dnc.openGlobalList();
        expect(await dnc.hasEntry(domain), `${domain} on the list`).toBe(true);
      });
      expect(await crm.search(c.email), 'prospects with the blacklisted domain').toBe(0);
    } finally {
      await clearDnc(dnc, [domain]);
    }
  });

  // Last: the trigger goes off, so the 3-hour cron does not import the org's deals into the production account.
  test('Restore: Opportunity is created in Salesforce is off', async ({ salesforceIntegration: i }) => {
    await i.openTriggers();
    await i.disable(OPP_TRIGGER);
    await i.save();
    await expect(i.savedToast(), 'save confirmation').toBeVisible();
    await i.page.reload();
    await i.openTriggers();
    expect(await i.isTriggerOn(OPP_TRIGGER), `"${OPP_TRIGGER}" is on after the reload`).toBe(false);
  });
});
