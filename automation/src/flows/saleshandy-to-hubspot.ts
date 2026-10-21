// Shared steps for the Saleshandy-side HubSpot workflows (Email Sent, Reply is
// Received, Prospect Outcome is updated, Link is Clicked). They have the same
// activities, Extra Configuration and HubSpot results; only the trigger event
// differs, so each workflow passes its own `fireEvent` (QA, 2026-10-09).
//
// Usage in a spec:
//   const flow = createFlow({ trigger: 'Link is Clicked in Saleshandy', sequenceId: '196221',
//     csv: 'hubspot/link-clicked.csv', fireEvent: async (ctx, row) => { ... } });
//   await flow.useOnly(saleshandyIntegration, 'Create a Contact in Hubspot', {...}, []);
//   const known = await flow.runTrigger(ctx, row);
//   await flow.expectNewLogsSuccess(saleshandyIntegration, known);
import { expect, test } from '../fixtures/index.ts';
import { readCsv, type Row } from '../data/csv.ts';
import { markUsed } from '../data/used.ts';
import type { HubSpotContactsPage } from '../pages/hubspot/contacts.page.ts';
import type { MailinatorPage } from '../pages/mailinator.page.ts';
import type { SaleshandyCrmPage } from '../pages/saleshandy/crm.page.ts';
import type { HubSpotIntegrationPage } from '../pages/saleshandy/hubspot-integration.page.ts';
import type { SaleshandySequencePage } from '../pages/saleshandy/sequence.page.ts';
import { stopOnErrorLogs, untilPasses } from '../utils/wait.ts';

// Page objects a trigger step may need (fixtures from src/fixtures/index.ts).
export type FlowContext = {
  sequence: SaleshandySequencePage;
  integration: HubSpotIntegrationPage;
  mailinator?: MailinatorPage;
  crm?: SaleshandyCrmPage;
};

export type FlowConfig = {
  // Trigger name as Triggers & Activity and Logs show it, e.g. 'Link is Clicked in Saleshandy'.
  trigger: string;
  // Sequence the prospects are added to (one per workflow account).
  sequenceId: string;
  // Workflow CSV under test-data/, e.g. 'hubspot/link-clicked.csv'.
  csv: string;
  // The workflow's own trigger event, done after the step's email is sent
  // (Email Sent: nothing). `step` is 1 unless a row needs the event on step 2
  // (e.g. Reply rows that reply to the follow-up). `link` is the 0-based link
  // of the email for "click the second link" rows (Link Clicked only; other
  // workflows fire the same event again).
  fireEvent: (ctx: FlowContext, row: Row, step: number, link?: number) => Promise<void>;
  // True when `fireEvent` can fire the event on the step 2 email (rows that
  // continue "from row N, step 2 sent"). Default false: those rows are not added.
  step2Events?: boolean;
  // True when the shared "second event on the same email" row (Update a deal
  // 3) should be added. Default false: Reply Received writes its own.
  secondEventRows?: boolean;
  // Subject of the step 1 email, for checks on the logged email (optional).
  emailSubject?: string;
  // Texts the HubSpot note must contain. Default: Step, Variant and the
  // prospect's email, which every Saleshandy-side workflow writes (Reply
  // Received: Step 1, Variant A, empty Latest Outcome). Return [] to skip.
  noteContains?: (row: Row, step: number) => string[];
  // Texts the logged email activity must contain. Default: the step 1
  // subject when `emailSubject` is set, else the prospect's full name.
  loggedEmailContains?: (row: Row, step: number) => string[];
};

export const fullName = (r: Row) => `${r['First Name']} ${r['Last Name']}`;

// Mapped fields checked on every contact (QA: tests edit only City, Company
// name and Job title, so these labels are unambiguous).
export const mapped = (r: Row) => ({ 'Job title': r['Job Title'], City: r['City'], 'Company name': r['Company'] });

// Create a Deal Extra Configuration used by the deal rows; Closing Date varies.
export const dealConfig = (closingDays: string) => ({
  'Select Pipeline (when to create)': 'Sales Pipeline',
  'Select Pipeline Stage (when to create)': 'Initial Contact',
  'Deal Type (while creating)': 'New Business',
  'Deal Priority (while creating)': 'High',
  'Closing Date (while creating)': closingDays,
});

// Update a Deal Extra Configuration (labels seen 2026-10-09), same values as
// Create a Deal; Closing Date varies.
export const dealUpdateConfig = (closingDays: string) => ({
  'Select Pipeline (when to update)': 'Sales Pipeline',
  'Select Pipeline Stage (when to update)': 'Initial Contact',
  'Deal Type (while updating)': 'New Business',
  'Deal Priority (while updating)': 'High',
  'Closing Date (while updating)': closingDays,
});

// A date N days from today as the deal header shows it, MM/DD/YYYY (e.g.
// "10/10/2026", seen 2026-10-09; the contact's Deals card uses "October 10, 2026").
export const daysFromToday = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
};

// Waits until the contact has `expectedCount` deals and returns the ones not
// in `existingNames` (the deals the test made itself).
export async function newDealsOf(contacts: HubSpotContactsPage, contactId: string, expectedCount: number, existingNames: string[]) {
  let fresh: { id: string; name: string }[] = [];
  await untilPasses('New deal not on the contact in HubSpot', async () => {
    const list = await contacts.associations(contactId, 'deals');
    expect(list.count, 'deals on the contact').toBe(expectedCount);
    fresh = list.records.filter((r) => !existingNames.includes(r.name));
  });
  return fresh;
}

// Checks HubSpot contact properties (label to expected value; "--" is empty).
export async function expectContact(contacts: HubSpotContactsPage, row: Row, values: Record<string, string>): Promise<void> {
  let id = '';
  await untilPasses(`Contact ${row['Email']} not found in HubSpot`, async () => {
    id = await contacts.findContactId(row['Email'], fullName(row));
  });
  await contacts.openAllProperties(id);
  for (const [label, value] of Object.entries(values)) {
    await expect(await contacts.propertyRow(label, value), `HubSpot ${label}`).toBeVisible();
  }
}

export function createFlow(cfg: FlowConfig) {
  const { trigger, sequenceId, csv } = cfg;
  const rows = readCsv(csv);
  const sideCsv = (suffix: string) => {
    try {
      return readCsv(csv.replace(/\.csv$/, `-${suffix}.csv`));
    } catch {
      return [];
    }
  };

  const rowFor = (scenario: string): Row => {
    const row = rows.find((r) => r['Scenario'] === scenario);
    if (!row) throw new Error(`No row "${scenario}" in test-data/${csv}`);
    return row;
  };

  // Every other trigger off, this one on, and no activity left selected from earlier rows.
  async function startClean(integration: HubSpotIntegrationPage): Promise<void> {
    await integration.openTriggers();
    await integration.enableOnly(trigger);
    for (const activity of await integration.selectedActivities(trigger)) {
      await integration.removeActivity(trigger, activity);
    }
    await expect.poll(() => integration.selectedActivities(trigger), 'activities left selected').toEqual([]);
  }

  // Selects only `activity` and saves its Extra Configuration with `values`
  // (label to option). With `values` empty nothing is chosen ("skipped"); if
  // the activity already has saved values (checked on `labels`), the row cannot
  // run here and is skipped: saved Extra Configuration can never be cleared.
  async function useOnly(integration: HubSpotIntegrationPage, activity: string, values: Record<string, string>, labels: string[]): Promise<void> {
    await startClean(integration);
    await integration.selectActivity(trigger, activity);
    if (Object.keys(values).length === 0) {
      const saved = [];
      for (const label of labels) {
        const text = (await integration.configDropdown(label).innerText()).trim();
        if (text !== 'Select') saved.push(`${label}: ${text}`);
      }
      if (saved.length > 0) {
        await integration.cancelExtraConfiguration();
        test.skip(true, `${activity} already has saved Extra Configuration on this account (${saved.join(', ')}); this row needs a new account`);
      }
    }
    // Activities without Extra Configuration (e.g. Create a Company) open no
    // dialog; then the page Save stores the selection (seen 2026-10-09).
    const hasDialog = await integration.extraConfiguration().waitFor({ timeout: 5_000 }).then(() => true, () => false);
    if (!hasDialog) {
      await integration.save();
      await expect(integration.savedToast(), 'save confirmation').toBeVisible();
      return;
    }
    for (const [label, option] of Object.entries(values)) {
      // Closing Date is a number box (Days), the others are dropdowns.
      if (label.startsWith('Closing Date')) await integration.dueIn().fill(option);
      else await integration.chooseConfigOption(label, option);
    }
    await integration.configSaveButton().click();
    // Saving a Create a Deal with nothing chosen showed "Loading..." for longer
    // than 5 s on emailbounced (2026-10-12), so wait longer for the toast.
    await expect(integration.savedToast(), 'save confirmation').toBeVisible({ timeout: 30_000 });
  }

  async function knownLogIds(integration: HubSpotIntegrationPage): Promise<Set<string>> {
    await integration.openLogs();
    const entries = await integration.logEntries(trigger).catch(() => []);
    return new Set(entries.map((e) => e.id));
  }

  // Adds the prospect, waits until step 1 is sent, then fires the workflow's
  // trigger event. Returns the log ids that existed before the event.
  async function runTrigger(ctx: FlowContext, row: Row, beforeSend?: () => Promise<void>): Promise<Set<string>> {
    // Waits for the send, the event and the sync.
    // Never lowers a longer timeout a spec set earlier (a spec's own set-up can take minutes).
    test.setTimeout(Math.max(test.info().timeout, 10 * 60_000));
    await test.step('Add the prospect to the sequence', async () => {
      await ctx.sequence.createAndAddProspect(sequenceId, row);
      markUsed(csv, row['Email']);
    });
    if (beforeSend) await beforeSend();
    // Email Sent: the send is the event, so take the log ids before it.
    const known = await knownLogIds(ctx.integration);
    await test.step('Wait until Saleshandy sends step 1', async () => {
      await ctx.sequence.ensureSent(sequenceId, fullName(row), 1);
    });
    await cfg.fireEvent(ctx, row, 1);
    return known;
  }

  // timeout: Update a Deal logs stay RUNNING for about 7.5 minutes (2026-10-12), so those rows pass a longer one.
  async function expectNewLogsSuccess(integration: HubSpotIntegrationPage, known: Set<string>, timeout?: number): Promise<void> {
    await integration.openLogs();
    await untilPasses(`New "${trigger}" log entries did not all reach Success`, async () => {
      await integration.refreshLogs();
      const fresh = (await integration.logEntries(trigger)).filter((e) => !known.has(e.id));
      expect(fresh.length, 'new log entries for this trigger').toBeGreaterThan(0);
      stopOnErrorLogs(trigger, fresh);
      expect(fresh.map((e) => e.status), 'status of each new log entry').toEqual(fresh.map(() => 'Success'));
    }, timeout);
  }

  // For "nothing created or updated" rows: waits until the new log entries
  // are no longer running and returns their statuses (not asserted here).
  async function newLogsFinished(integration: HubSpotIntegrationPage, known: Set<string>, timeout?: number): Promise<string[]> {
    let statuses: string[] = [];
    await integration.openLogs();
    await untilPasses(`New "${trigger}" log entries did not finish`, async () => {
      await integration.refreshLogs();
      const fresh = (await integration.logEntries(trigger)).filter((e) => !known.has(e.id));
      expect(fresh.length, 'new log entries for this trigger').toBeGreaterThan(0);
      statuses = fresh.map((e) => e.status);
      for (const status of statuses) expect(status, 'log entry status').not.toMatch(/running|progress/i);
    }, timeout);
    return statuses;
  }

  const noteContains = cfg.noteContains ?? ((row: Row, step: number) => [`Step: ${step}`, 'Variant: A', `Prospect Email: ${row['Email']}`]);
  const loggedEmailContains = cfg.loggedEmailContains ?? ((row: Row) => [cfg.emailSubject ?? fullName(row)]);

  return {
    trigger,
    rows,
    fireEvent: cfg.fireEvent,
    step2Events: cfg.step2Events === true,
    secondEventRows: cfg.secondEventRows === true,
    noteContains,
    loggedEmailContains,
    newLogsFinished,
    deals: sideCsv('deals'),
    companies: sideCsv('companies'),
    rowFor,
    // For a spec that creates the row's HubSpot contact before the prospect is added.
    markUsed: (row: Row) => markUsed(csv, row['Email']),
    startClean,
    useOnly,
    knownLogIds,
    runTrigger,
    expectNewLogsSuccess,
  };
}
