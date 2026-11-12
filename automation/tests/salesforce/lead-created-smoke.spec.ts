// Production smoke test: Lead is created in Salesforce (AL-4144, fix AL-4224).
// Checklist: notes/production-testing/27-salesforce-lead-created.md (approved by QA 2026-11-12): 11 checks and a
// last test that turns the trigger off. Each check follows the staging row of the same activity in
// tests/salesforce/lead-created.spec.ts (QA approved 2026-11-11). Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts); the Salesforce org is the same
//    dev org (saleshandy-dev-ed);
//  - the sequence is the day's smoke sequence (SMOKE_SEQUENCE_NAME, made by the setup spec), nothing production is
//    hard-coded;
//  - the Logs tab is not opened (the run status comes from run-now). A prospect still missing after 3 minutes fails the
//    check and QA decides if it is a bug;
//  - other triggers are never switched (KEEP_OTHER_TRIGGERS). Every check stops before it saves or runs when any
//    trigger besides this one is on (QA 2026-11-12), so no step 1 send starts another workflow and no Lead appears in the window;
//  - the window of the run is kept in its own file (LEAD_LAST_RUN_FILE), so staging runs do not move it. A check that
//    would reach other people's Leads (Move, Unsubscribed, Blacklist) is skipped, not failed;
//  - each Move run is one send, counted against SEND_CAP. No production setting is changed. The last test turns the
//    Lead trigger off so the 3-hour cron does not import the org's Leads. LEAD_TRIGGER_NAME overrides the trigger name.
// The checks do not delete what they create, except the Blacklist domain.
//
// Run through scripts/run-salesforce-lead-created-smoke.sh (npm run smoke:salesforce-lead-created), which runs the
// gate and the setup spec first. Needs, once:
//   npm run login:saleshandy -- emailopenedprod
// The Salesforce REST login needs a trusted IP (Setup > Network Access).
process.env.KEEP_OTHER_TRIGGERS ??= '1';

import { expect, test } from '../../src/fixtures/index.ts';
import { checkSendCap, recordSend } from '../../src/data/send-cap.ts';
import {
  ACT, TAG, TRIGGER, VIEWS, expectProspect, newLead, runNow, useActivities, windowCount,
  type Pick,
} from '../../src/flows/salesforce-lead-created.ts';
import type { SalesforceIntegrationPage } from '../../src/pages/saleshandy/salesforce-integration.page.ts';
import { SalesforceApi, type LeadInput } from '../../src/utils/salesforce-api.ts';
import { untilPasses } from '../../src/utils/wait.ts';

test.use({ account: 'emailopenedprod', actionTimeout: 30_000 });
test.setTimeout(25 * 60_000);

const SEQ = process.env.SMOKE_SEQUENCE_NAME ?? '';
const TODAY = ["Today's Leads"];
type NewLead = LeadInput & { email: string; fullName: string };

let sf: SalesforceApi;
test.beforeAll(async () => {
  if (!SEQ) throw new Error('SMOKE_SEQUENCE_NAME is not set. Use scripts/run-salesforce-lead-created-smoke.sh.');
  process.env.LEAD_LAST_RUN_FILE ??= `${process.env.TMPDIR ?? '/tmp'}/lead-created-smoke-lastrun.txt`;
  sf = await SalesforceApi.login();
});

// A prospect that is still missing 3 minutes after the run fails the check, and QA decides if it is a bug (QA 2026-11-05).
const expectP = (crm: Parameters<typeof expectProspect>[0], email: string, fullName: string, want: Parameters<typeof expectProspect>[3]) => expectProspect(crm, email, fullName, want, 3 * 60_000);

const move: Pick = { activity: ACT.move, seq: SEQ, step: true };
const mapped = { Company: '', 'Job Title': '', 'Phone Number': '' };
const fieldsOf = (l: LeadInput) => ({ ...mapped, Company: l.company, 'Job Title': l.title ?? '', 'Phone Number': l.phone ?? '' });
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Sets the trigger and its activities. Stops first when any other trigger is on (QA 2026-11-12): a Move run sends
// step 1, which would start Email Sent, Email Opened or Link Clicked, and Unsubscribed or Reply Received with Create a
// Lead could make Leads in the org that the window check then sees. Nothing was sent or saved when it stops.
async function use(i: SalesforceIntegrationPage, picks: Pick[], lists: string[] = []): Promise<void> {
  await i.openTriggers();
  const others = (await i.onTriggers()).filter((name) => name !== TRIGGER);
  expect(others, `Other triggers are on: ${others.join(', ')}. Turn them off and run again. Nothing was sent.`).toEqual([]);
  await useActivities(i, picks, lists);
}

// One new Lead, trigger set with `picks`, run now. Returns the Lead and the run.
async function newLeadRun(i: SalesforceIntegrationPage, picks: Pick[], lists: string[] = [], lead: NewLead = newLead()) {
  await test.step(`Select ${picks.map((p) => `"${p.activity}"`).join(' + ')}${lists.length ? ` with list ${lists.join(', ')}` : ''} and Save`, () => use(i, picks, lists));
  await test.step(`Create the Lead ${lead.fullName} in Salesforce`, async () => {
    await sf.createLead(lead, true);
  });
  const run = await test.step('Run the workflow now and wait for COMPLETED', () => runNow(i.page));
  return { lead, run };
}

// A Lead whose prospect goes into the smoke sequence. One send, counted.
async function moveIn(i: SalesforceIntegrationPage, crm: Parameters<typeof expectProspect>[0]): Promise<NewLead> {
  checkSendCap();
  const lead = newLead();
  await test.step(`Select "${move.activity}" and Save`, () => use(i, [move]));
  await test.step(`Create the Lead ${lead.fullName} in Salesforce`, async () => {
    await sf.createLead(lead, true);
    // A Move run sends step 1 for every Lead in the window, so the send count holds only if this Lead is the only one.
    const n = await windowCount(sf);
    test.skip(n > 1, `${n} Leads are in the window since the last run; the Move run would send step 1 for all of them`);
  });
  await test.step('Run the workflow now and wait for COMPLETED', () => runNow(i.page));
  recordSend('Lead is created smoke: Move run, step 1');
  await test.step(`Check ${lead.fullName} is in ${SEQ}`, () => expectP(crm, lead.email, lead.fullName, { sequence: SEQ }));
  return lead;
}

// A second Lead with the same email runs `picks` alone on a prospect that is already in the sequence.
async function secondRun(i: SalesforceIntegrationPage, lead: NewLead, picks: Pick[], title: string, windowCheck = false): Promise<void> {
  await test.step(`Select ${picks.map((p) => `"${p.activity}"`).join(' + ')}, second Lead with the same email, run now`, async () => {
    await use(i, picks, []);
    await sf.createLead({ ...lead, title }, true);
    if (windowCheck) {
      const n = await windowCount(sf);
      test.skip(n > 1, `${n} Leads are in the window since the last run; this action would reach them too`);
    }
    await runNow(i.page);
  });
}

// Removes a domain from the Do Not Contact list (the Blacklist action lists the domain of every Lead in the window).
async function clearDnc(dnc: { openGlobalList(): Promise<void>; hasEntry(e: string): Promise<boolean>; removeEntry(e: string): Promise<void> }, domains: string[]): Promise<void> {
  for (const d of domains) {
    await dnc.openGlobalList();
    if (await dnc.hasEntry(d)) await dnc.removeEntry(d);
  }
}

test.describe(`${TRIGGER}: production smoke`, () => {
  test('Smoke 1: Add Prospect, Select a list opens and offers six views (AL-4224)', async ({ salesforceIntegration: i }) => {
    await use(i, [{ activity: ACT.add }], []);
    await i.reopenExtraConfiguration(TRIGGER, ACT.add);
    const dialog = i.extraConfiguration();
    await dialog.waitFor();
    await expect(dialog.locator('.bs-select-box').last(), 'Select a list finished loading').not.toHaveText('Loading...', { timeout: 30_000 });
    await dialog.locator('.bs-select-box').last().click();
    const items = i.page.locator('.transfer-list li');
    await items.first().waitFor();
    expect((await items.allInnerTexts()).map((t) => t.trim()).sort(), 'views in Select a list').toEqual([...VIEWS].sort());
    await i.page.keyboard.press('Escape');
  });

  test('Smoke 2: Add Prospect, new Lead, prospect made with the mapped fields', async ({ salesforceIntegration: i, saleshandyCrm }) => {
    const base = newLead();
    const lead: NewLead = { ...base, firstName: 'Siobhán', lastName: "O'Brien", fullName: "Siobhán O'Brien", email: `siobhan.obrien.${Date.now().toString(36)}@mailinator.com` };
    await newLeadRun(i, [{ activity: ACT.add }], [], lead);
    await test.step(`Check ${lead.fullName} in Saleshandy`, () => expectP(saleshandyCrm, lead.email, lead.fullName, { status: 'Inactive', fields: fieldsOf(lead) }));
  });

  test("Smoke 3: Add Prospect with list Today's Leads", async ({ salesforceIntegration: i, saleshandyCrm }) => {
    const { lead, run } = await newLeadRun(i, [{ activity: ACT.add }], TODAY);
    expect(run.skipped.join(' | '), 'skipped steps').toContain('Get Leads if List not provided');
    await test.step(`Check ${lead.fullName} in Saleshandy`, () => expectP(saleshandyCrm, lead.email, lead.fullName, { fields: fieldsOf(lead) }));
  });

  test('Smoke 4: Move Prospect to another Sequence', async ({ salesforceIntegration: i, saleshandyCrm }) => {
    await moveIn(i, saleshandyCrm);
  });

  test('Smoke 5: Assign a tag to Prospect', async ({ salesforceIntegration: i, saleshandyCrm }) => {
    const { lead } = await newLeadRun(i, [{ activity: ACT.tag, tag: true }]);
    await test.step(`Check ${lead.fullName} is tagged ${TAG}`, () => expectP(saleshandyCrm, lead.email, lead.fullName, { tag: TAG }));
  });

  test('Smoke 6: Mark Prospect as Paused', async ({ salesforceIntegration: i, saleshandyCrm }) => {
    const lead = await moveIn(i, saleshandyCrm);
    await secondRun(i, lead, [{ activity: ACT.paused, seq: SEQ, days: true }], 'Dock Manager II');
    // The page renders the sequence name as a link, so the text has two spaces before it.
    await test.step(`Check ${lead.fullName}: Paused, with the number of days in Activities`, () =>
      expectP(saleshandyCrm, lead.email, lead.fullName, { status: 'Paused', activity: new RegExp(`has been paused for \\d+ days for sequence\\s+${escape(SEQ)}`) }));
  });

  test('Smoke 7: Mark Prospect as Resume(Un-pause)', async ({ salesforceIntegration: i, saleshandyCrm }) => {
    const lead = await moveIn(i, saleshandyCrm);
    await secondRun(i, lead, [{ activity: ACT.paused, seq: SEQ, days: true }], 'Studio Owner II');
    await test.step(`Check ${lead.fullName} is Paused first`, () => expectP(saleshandyCrm, lead.email, lead.fullName, { status: 'Paused' }));
    await secondRun(i, lead, [{ activity: ACT.resume, seq: SEQ }], 'Studio Owner III');
    await test.step(`Check ${lead.fullName} is Active again`, () => expectP(saleshandyCrm, lead.email, lead.fullName, { status: 'Active' }));
  });

  test('Smoke 8: Mark Prospect as Replied', async ({ salesforceIntegration: i, saleshandyCrm }) => {
    const lead = await moveIn(i, saleshandyCrm);
    await secondRun(i, lead, [{ activity: ACT.replied, seq: SEQ }], 'Founder II');
    await test.step(`Check ${lead.fullName} is Replied`, () => expectP(saleshandyCrm, lead.email, lead.fullName, { status: 'Replied' }));
  });

  test('Smoke 9: Mark Prospect as Finished', async ({ salesforceIntegration: i, saleshandyCrm }) => {
    const lead = await moveIn(i, saleshandyCrm);
    await secondRun(i, lead, [{ activity: ACT.finished, seq: SEQ }], 'Plant Owner II');
    await test.step(`Check ${lead.fullName} is Finished`, () => expectP(saleshandyCrm, lead.email, lead.fullName, { status: 'Finished' }));
  });

  test('Smoke 10: Mark Prospect as Unsubscribed, window holds only this Lead', async ({ salesforceIntegration: i, saleshandyCrm }) => {
    const lead = await moveIn(i, saleshandyCrm);
    await secondRun(i, lead, [{ activity: ACT.unsubscribed }], 'Fleet Manager II', true);
    await test.step(`Check ${lead.fullName} is Unsubscribed`, () => expectP(saleshandyCrm, lead.email, lead.fullName, { status: 'Unsubscribed' }));
  });

  test('Smoke 11: Blacklist a Domain, new Lead on a reserved test domain, window holds only this Lead', async ({ salesforceIntegration: i, saleshandyCrm, saleshandyDnc }) => {
    const domain = `lead${Date.now().toString(36)}.example.com`;
    const lead = newLead();
    lead.email = `${lead.firstName}.${lead.lastName}@${domain}`.toLowerCase();
    await use(i, [{ activity: ACT.blacklist }], []);
    await sf.createLead(lead, true);
    const n = await windowCount(sf);
    test.skip(n > 1, `${n} Leads are in the window since the last run; their domains would be listed too`);
    await runNow(i.page);
    try {
      await untilPasses(`${domain} not on the Do Not Contact list`, async () => {
        await saleshandyDnc.openGlobalList();
        expect(await saleshandyDnc.hasEntry(domain), `${domain} on the list`).toBe(true);
      });
      expect(await saleshandyCrm.search(lead.email), 'prospects with the blacklisted domain').toBe(0);
    } finally {
      await clearDnc(saleshandyDnc, [domain]);
    }
  });

  // Last: the trigger goes off, so the 3-hour cron does not import the org's Leads into the production account.
  test('Restore: Lead is created in Salesforce is off', async ({ salesforceIntegration: i }) => {
    await i.openTriggers();
    await i.disable(TRIGGER);
    await i.save();
    await expect(i.savedToast(), 'save confirmation').toBeVisible();
    await i.page.reload();
    await i.openTriggers();
    expect(await i.isTriggerOn(TRIGGER), `"${TRIGGER}" is on after the reload`).toBe(false);
  });
});
