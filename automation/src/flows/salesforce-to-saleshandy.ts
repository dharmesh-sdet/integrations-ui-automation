// Shared rows for the four Salesforce-side workflows (Lead / Contact / Account /
// Opportunity is created in Salesforce). A spec calls salesforceSideTests({...}) with how
// its record is made in Salesforce and which prospect fields to check.
//
// These workflows are not webhooks: Refold runs them on a cron every 3 hours. Each row
// therefore makes its Salesforce record, then starts the workflow at once through
// Refold's run-now call (src/flows/refold-run-now.ts), waits for that run to end, finds
// that same run (by its id) in Saleshandy Logs, and checks the prospect in Saleshandy.
//
// Expected results come from the developer API runs on staging, copied in
// ../../integration-skills/test-logs/salesforce/<workflow>.md (see
// knowledge-base/product/workflow-behaviour-dev-kit.md section 3):
// - Every workflow imports each person as a prospect with the Field Mapping of its object
//   (account-created:103, contact-created:131, lead-created:160, opportunity-created:110).
// - The actions (tag, sequence step, Paused, Replied, Finished, Unsubscribed, Blacklist)
//   were run live on the Lead workflow only (lead-created:137-163). On the other three
//   they are "proposed": the result is recorded as an annotation for QA, not asserted.
//
// Contact, Account and Opportunity read every record of the shared org on each run (up
// to 200; their 3-hour window is not applied, contact-created:84, :109). A row's actions
// therefore also reach other tests' people imported into this account, and a Move to an
// active sequence would email them. Their sequence rows run only with SEQUENCES_PAUSED=1,
// after QA has paused Sequence A and Sequence B.
import type { Page } from '@playwright/test';
import { readCsv, type Row } from '../data/csv.ts';
import { markUsed } from '../data/used.ts';
import { LEAD_ONLY_SCENARIOS, SALESFORCE_SIDE_SCENARIOS } from '../data/salesforce-side-scenarios.ts';
import { EXPECTED_MAPPING } from '../config/salesforce-field-mapping.ts';
import { expect, test } from '../fixtures/index.ts';
import type { SaleshandyCrmPage } from '../pages/saleshandy/crm.page.ts';
import type { DoNotContactPage } from '../pages/saleshandy/do-not-contact.page.ts';
import type { MappingObject, SalesforceIntegrationPage } from '../pages/saleshandy/salesforce-integration.page.ts';
import type { Salesforce } from '../pages/salesforce/salesforce.ts';
import { untilPasses } from '../utils/wait.ts';
import { RefoldRunNow } from './refold-run-now.ts';

// Activity names on Triggers & Activity (saleshandy-webui triggers-and-activity/utils/helper.ts,
// options of salesforceWorkflowIds; "Saleshandy" is the white-label default).
export const ACTIVITY = {
  add: 'Add Prospect in Saleshandy',
  move: 'Move Prospect to another Sequence in Saleshandy',
  tag: 'Assign a tag to Prospect in Saleshandy',
  paused: 'Mark Prospect as Paused in Saleshandy',
  replied: 'Mark Prospect as Replied in Saleshandy',
  finished: 'Mark Prospect as Finished in Saleshandy',
  unsubscribed: 'Mark Prospect as Unsubscribed in Saleshandy',
  blacklist: 'Blacklist a Domain in Saleshandy',
} as const;

// Same names and values as the HubSpot-side rows (tests/hubspot/company-created.spec.ts).
const SEQ_A = 'Sequence A';
const TAG = 'TagA'; // tags cannot have spaces
const PAUSE_DAYS = '1';
const STEP_1 = 'Step 1 - Day 1';
// A run can read up to 200 records and import each one; give it room.
const RUN_TIMEOUT_MS = 10 * 60_000;
const ROW_TIMEOUT_MS = 25 * 60_000;

export const fullName = (r: Row) => `${r['First Name']} ${r['Last Name']}`;
export const person = (r: Row) => ({ firstName: r['First Name'], lastName: r['Last Name'], email: r['Email'] });
// Record names that must not clash with earlier runs (Account and Opportunity names repeat
// in the 30-company pool; "Similar Records Exist" otherwise, accounts.page.ts).
export const RUN_STAMP = Date.now().toString(36);

export type SalesforceSideWorkflow = {
  // Name on Triggers & Activity, in Logs and in Refold.
  trigger: string;
  // test-data/<csv>, rows from scripts/make-salesforce-side-data.ts.
  csv: string;
  // Field Mapping card and the Saleshandy fields `fields` checks; Setup fails early when
  // one is not mapped as in src/config/salesforce-field-mapping.ts.
  mapping: { object: MappingObject; fields: string[] };
  // Makes the Salesforce record(s) for one prospect.
  create: (sf: Salesforce, row: Row) => Promise<void>;
  // Prospect fields (Saleshandy label -> value) the import must fill.
  fields: (row: Row) => Record<string, string>;
  // Actions run live on this workflow (Lead): assert them. Otherwise record them for QA.
  actionsProven: boolean;
  // Reads the whole org on each run (Contact, Account, Opportunity).
  readsWholeOrg: boolean;
};

type Config = (i: SalesforceIntegrationPage) => Promise<void>;
type Pick = { activity: string; config?: Config };
// `dnc`: the domain is on the Do Not Contact list and no prospect was made (blacklist
// skips the import, lead-created:163 "No prospect imported (as designed)").
type Want = { status?: string; sequence?: string; tag?: string; dnc?: string };

const sequence = (step = false): Config => async (i) => {
  await i.chooseConfigOption('Sequence', SEQ_A);
  if (step) await i.chooseConfigOption('Sequence Steps', STEP_1);
};
const pausedIn: Config = async (i) => {
  await i.chooseConfigOption('Sequence', SEQ_A);
  await i.pauseDays().fill(PAUSE_DAYS);
};
const tagged: Config = async (i) => i.createAndSelectTag(TAG);

// Only `picks` selected under the trigger (activities add up, so others are removed),
// each with its Extra Configuration, the trigger on and every other trigger off, saved.
async function useActivities(i: SalesforceIntegrationPage, trigger: string, picks: Pick[]): Promise<void> {
  await i.openTriggers();
  await i.enableOnly(trigger);
  for (const chip of await i.selectedActivities(trigger)) {
    if (!picks.some((p) => chip.includes(p.activity))) await i.removeActivity(trigger, chip);
  }
  for (const p of picks) {
    const selected = (await i.selectedActivities(trigger)).some((a) => a.includes(p.activity));
    if (!selected) await i.selectActivity(trigger, p.activity);
    else if (p.config) await i.reopenExtraConfiguration(trigger, p.activity);
    else continue;
    // On the Lead trigger these actions also carry "Select a list" (helper.ts helpText
    // select_lead_list_salesforce), so a dialog can open with nothing else to set. Left
    // empty, the workflow reads every new Lead (the path proven, lead-created:160).
    const dialog = await i.extraConfiguration().waitFor({ timeout: 5_000 }).then(() => true, () => false);
    if (p.config) await p.config(i);
    if (dialog || p.config) await i.configSaveButton().click();
  }
  await i.save();
  await expect(i.savedToast(), 'save confirmation').toBeVisible();
}

// Starts the workflow now, waits for the run to end and returns its id. An ERRORED run
// fails here with the steps that did not complete.
async function runNow(page: Page, trigger: string): Promise<string> {
  const refold = await RefoldRunNow.open(page);
  const workflowId = await refold.workflowId(trigger);
  const id = await refold.run(workflowId);
  const run = await refold.waitForEnd(id, RUN_TIMEOUT_MS);
  // The workflow id shows which copy ran (knowledge-base workflow-behaviour-dev-kit.md section 6).
  test.info().annotations.push({ type: 'Refold run', description: `${id} of workflow ${workflowId}: ${run.status}` });
  const bad = (run.nodes ?? []).filter((n) => n.node_status && !/complete|success|skip/i.test(n.node_status));
  expect(run.status, `Refold run ${id}; steps not completed: ${bad.map((n) => `${n.node_name} (${n.node_status})`).join(', ') || 'none'}`).toBe('COMPLETED');
  return id;
}

// That same run shows Success in Saleshandy > Integrations > Salesforce > Logs.
async function expectLogSuccess(i: SalesforceIntegrationPage, trigger: string, runId: string): Promise<void> {
  await i.openLogs();
  await untilPasses(`Logs did not show run ${runId} as Success`, async () => {
    await i.refreshLogs();
    const entry = (await i.logEntries(trigger)).find((e) => e.id === runId);
    expect(entry?.status, `Logs entry of run ${runId}`).toBe('Success');
  });
}

async function expectProspect(crm: SaleshandyCrmPage, row: Row, fields: Record<string, string>): Promise<void> {
  await untilPasses(`Prospect ${row['Email']} did not show the mapped values`, async () => {
    expect(await crm.search(row['Email']), `prospects with ${row['Email']}`).toBe(1);
    await crm.openProspect(fullName(row));
    for (const [label, value] of Object.entries(fields)) await expect(crm.field(label), label).toHaveText(value);
  });
}

async function expectState(crm: SaleshandyCrmPage, dnc: DoNotContactPage, email: string, want: Want): Promise<void> {
  await untilPasses(`Prospect ${email} did not reach the expected state`, async () => {
    if (want.dnc) {
      expect(await dnc.hasEntry(want.dnc), `${want.dnc} on the Do Not Contact list`).toBe(true);
      expect(await crm.search(email), `prospects with ${email}`).toBe(0);
      return;
    }
    await crm.search(email);
    if (want.status) expect(await crm.latestStatus(email), `Latest Status of ${email}`).toBe(want.status);
    if (want.sequence) expect(await crm.sequenceAssociated(email), `Sequence of ${email}`).toBe(want.sequence);
    if (want.tag) expect(await crm.prospectTags(email), `Tags of ${email}`).toContain(want.tag);
  });
}

// A proposed result is checked but only recorded (annotation "Needs QA"), as the Salesforce
// Email Sent rows do for unconfirmed Expected results.
async function check(proposed: boolean, what: string, assertion: () => Promise<void>): Promise<void> {
  if (!proposed) return assertion();
  try {
    await assertion();
    test.info().annotations.push({ type: 'Needs QA', description: `${what}: proposed result seen` });
  } catch (e) {
    test.info().annotations.push({ type: 'Needs QA', description: `${what}: proposed result NOT seen. ${(e as Error).message.split('\n')[0]}` });
  }
}

export function salesforceSideTests(w: SalesforceSideWorkflow): void {
  const rows = readCsv(w.csv);
  const rowFor = (scenario: string): Row => {
    const row = rows.find((r) => r['Scenario'] === scenario);
    if (!row) throw new Error(`No row "${scenario}" in test-data/${w.csv}. Run: node scripts/make-salesforce-side-data.ts`);
    return row;
  };
  // Every scenario must have its row before any test runs.
  for (const s of [...SALESFORCE_SIDE_SCENARIOS, ...(w.readsWholeOrg ? [] : LEAD_ONLY_SCENARIOS)]) rowFor(s);

  const createRecord = async (sf: Salesforce, row: Row) => {
    await test.step(`Create the Salesforce record for ${fullName(row)}`, () => w.create(sf, row));
    markUsed(w.csv, row['Email']);
  };

  // One action row: actions set, a new record, run now, Logs, prospect state.
  // `proposed`: recorded, not asserted, even on a workflow whose actions are proven.
  function actionRow(scenario: string, picks: Pick[], want: Want, o: { sendsEmail?: boolean; proposed?: boolean } = {}): void {
    test(`${scenario}: ${picks.map((p) => p.activity).join(' + ')}`, async ({ salesforceIntegration, salesforce, saleshandyCrm, saleshandyDnc }) => {
      test.setTimeout(ROW_TIMEOUT_MS);
      test.skip(
        !!o.sendsEmail && w.readsWholeOrg && process.env.SEQUENCES_PAUSED !== '1',
        'Moves every prospect of the shared org into Sequence A. Pause Sequence A and Sequence B, then run with SEQUENCES_PAUSED=1.',
      );
      const row = rowFor(scenario);
      await test.step(`Select ${picks.map((p) => `"${p.activity}"`).join(' and ')} under "${w.trigger}" and Save`, () =>
        useActivities(salesforceIntegration, w.trigger, picks),
      );
      await createRecord(salesforce, row);
      const runId = await test.step('Run the workflow now (no 3-hour wait) and wait for COMPLETED', () =>
        runNow(salesforceIntegration.page, w.trigger),
      );
      await test.step('Find that run in Logs: Success', () => expectLogSuccess(salesforceIntegration, w.trigger, runId));
      await test.step(`Check ${fullName(row)} in Saleshandy`, () =>
        check(!w.actionsProven || !!o.proposed, scenario, () => expectState(saleshandyCrm, saleshandyDnc, row['Email'], want)),
      );
      if (want.dnc) {
        await test.step(`Remove ${want.dnc} from the Do Not Contact list`, () => saleshandyDnc.removeEntry(want.dnc!));
      }
    });
  }

  test.describe(w.trigger, () => {
    // Not serial: a product Error on one row must not hide the rows behind it. File
    // order, one worker (as the HubSpot-side rows).

    test('Setup: Field Mapping in place, only this trigger on, activity Add Prospect', async ({ salesforceIntegration }) => {
      test.setTimeout(10 * 60_000);
      await test.step(`${w.mapping.object} Properties: ${w.mapping.fields.join(', ')} mapped`, async () => {
        await salesforceIntegration.openMapping(w.mapping.object);
        for (const field of w.mapping.fields) {
          expect(await salesforceIntegration.mappedValue(field), `${field} on ${w.mapping.object} Properties`).toBe(
            EXPECTED_MAPPING[w.mapping.object][field],
          );
        }
      });
      await test.step(`Turn on only "${w.trigger}" with "${ACTIVITY.add}"`, () =>
        useActivities(salesforceIntegration, w.trigger, [{ activity: ACTIVITY.add }]),
      );
    });

    test(`${SALESFORCE_SIDE_SCENARIOS[0]}: new record, prospect made with the mapped fields`, async ({
      salesforceIntegration,
      salesforce,
      saleshandyCrm,
    }) => {
      test.setTimeout(ROW_TIMEOUT_MS);
      const row = rowFor(SALESFORCE_SIDE_SCENARIOS[0]);
      await createRecord(salesforce, row);
      const runId = await test.step('Run the workflow now (no 3-hour wait) and wait for COMPLETED', () =>
        runNow(salesforceIntegration.page, w.trigger),
      );
      await test.step('Find that run in Logs: Success', () => expectLogSuccess(salesforceIntegration, w.trigger, runId));
      await test.step(`Check ${fullName(row)} is one prospect with the mapped fields`, () =>
        expectProspect(saleshandyCrm, row, w.fields(row)),
      );
    });

    test('Add Prospect in Saleshandy > 2: same record, run again: still one prospect', async ({ salesforceIntegration, saleshandyCrm }) => {
      test.setTimeout(ROW_TIMEOUT_MS);
      const row = rowFor(SALESFORCE_SIDE_SCENARIOS[0]);
      await test.step('Run the workflow now again, no new record', () => runNow(salesforceIntegration.page, w.trigger));
      await test.step(`Check ${fullName(row)} is still one prospect`, () =>
        untilPasses(`Prospect ${row['Email']} count`, async () => {
          expect(await saleshandyCrm.search(row['Email']), `prospects with ${row['Email']}`).toBe(1);
        }),
      );
    });

    const move = { activity: ACTIVITY.move, config: sequence(true) };
    actionRow(SALESFORCE_SIDE_SCENARIOS[1], [move], { sequence: SEQ_A }, { sendsEmail: true });
    actionRow(SALESFORCE_SIDE_SCENARIOS[2], [{ activity: ACTIVITY.tag, config: tagged }], { tag: TAG });
    // A new prospect is in no sequence, so the status rows move it into Sequence A in the
    // same run: the workflow adds it to the step, then applies the status
    // (contact-created:13-25; lead-created:144 "add-in-step + finished").
    actionRow(SALESFORCE_SIDE_SCENARIOS[3], [move, { activity: ACTIVITY.paused, config: pausedIn }], { status: 'Paused' }, { sendsEmail: true });
    // Lead run R1 gave status Replied (lead-created:141), but with "stop sending follow-ups
    // on a reply" a replied prospect ends Finished (QA, HubSpot-side, 2026-10-15): recorded.
    actionRow(SALESFORCE_SIDE_SCENARIOS[4], [move, { activity: ACTIVITY.replied, config: sequence() }], { status: 'Replied' }, { sendsEmail: true, proposed: true });
    actionRow(SALESFORCE_SIDE_SCENARIOS[5], [move, { activity: ACTIVITY.finished, config: sequence() }], { status: 'Finished' }, { sendsEmail: true });
    actionRow(SALESFORCE_SIDE_SCENARIOS[6], [{ activity: ACTIVITY.unsubscribed }], { status: 'Unsubscribed' });
    if (!w.readsWholeOrg) {
      // The people are @mailinator.com. The domain is removed again at the end, as in the
      // HubSpot-side Blacklist row, so later runs can import mailinator people.
      actionRow(LEAD_ONLY_SCENARIOS[0], [{ activity: ACTIVITY.blacklist }], { dnc: 'mailinator.com' });
    }

    // Left off, so the 3-hourly cron does not keep importing the org's records with the
    // last row's actions (as the HubSpot Contact Updated spec leaves its trigger off).
    test('Restore: trigger off', async ({ salesforceIntegration }) => {
      await salesforceIntegration.openTriggers();
      await salesforceIntegration.disable(w.trigger);
      await salesforceIntegration.save();
      await expect(salesforceIntegration.savedToast(), 'save confirmation').toBeVisible();
    });
  });
}
