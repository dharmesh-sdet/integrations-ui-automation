import { expect, test } from '@playwright/test';
import { readCsv, type Row } from '../data/csv.ts';
import { markUsed } from '../data/used.ts';
import type { ActivityPick, SalesforceIntegrationPage, SalesforceLogEntry } from '../pages/saleshandy/salesforce-integration.page.ts';
import type { SaleshandySequencePage } from '../pages/saleshandy/sequence.page.ts';
import type { Salesforce, Setup } from '../pages/salesforce/salesforce.ts';
import { lookAfterReply, newLogEntry } from './salesforce-reply.ts';

// The engine behind every "Reply is Received in Saleshandy" scenario. A spec is a
// table of ReplyScenario objects (what to set up, which activities to turn on, what
// to check); this file does the rest. The Saleshandy half (prospect, send, reply,
// Logs) is the same code HubSpot and Salesforce specs already share, so a new
// Salesforce scenario is one table entry and, for a new object, one page object.

export type ReplyScenario = {
  // "<Activity> > <n>", the same id as the test-case row and the CSV's Scenario column.
  id: string;
  title: string;
  // Activity chips to select on the trigger, with their Extra Configuration if any.
  activities: ActivityPick[];
  // true: Expected is confirmed, a mismatch fails the row. false: "(proposed,
  // unconfirmed)", the result is recorded for QA and never fails the row.
  confirmed: boolean;
  // Records created in Salesforce before the reply.
  setup?: Setup;
  // Values of the prospect that differ from the CSV row (for example no Phone).
  override?: Partial<Row>;
  // Prospect outcome set in Saleshandy before the reply.
  outcome?: string;
  // true: the trigger is turned off (and saved) instead of set to `activities`.
  triggerOff?: boolean;
  check: (world: World) => Promise<void>;
};

export type HarnessOptions = {
  csv: string;
  sequenceId: string;
  trigger: string;
  seq: SaleshandySequencePage;
  sf: SalesforceIntegrationPage;
  salesforce: Salesforce;
  scenarios: ReplyScenario[];
};

const note = (type: string, description: string) => test.info().annotations.push({ type, description });

// What a check can do after the reply. Each helper is one step QA would do by hand.
export class World {
  readonly scenario: ReplyScenario;
  readonly row: Row;
  readonly repliedAt: number;
  private readonly harness: ReplyHarness;

  constructor(harness: ReplyHarness, scenario: ReplyScenario, row: Row, repliedAt: number) {
    this.harness = harness;
    this.scenario = scenario;
    this.row = row;
    this.repliedAt = repliedAt;
  }

  get salesforce(): Salesforce {
    return this.harness.options.salesforce;
  }

  get fullName(): string {
    return `${this.row['First Name']} ${this.row['Last Name']}`;
  }

  observe(label: string, value: unknown): void {
    note(`Observed: ${label}`, typeof value === 'string' ? value : JSON.stringify(value));
  }

  // Confirmed row: the result must match, or the row fails. Proposed row: the result
  // is recorded, and a difference is flagged for QA instead of failing the row.
  verdict<T>(label: string, actual: T, expected: T): void {
    if (this.scenario.confirmed) {
      expect<unknown>(actual, label).toEqual(expected);
      return;
    }
    this.observe(label, actual);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      note('Needs QA', `${label}: got ${JSON.stringify(actual)}, proposed ${JSON.stringify(expected)}`);
    }
  }

  // QA's check (2026-10-20): wait 15 s, look in Salesforce; 5 s and a reload, look
  // again; only then Logs. A Logs Error is recorded for QA, never a failure.
  // `look` returns the record's data, or undefined while it is not there.
  async find<T>(look: () => Promise<T | undefined>): Promise<T | undefined> {
    const { sf } = this.harness.options;
    const found = await test.step('Wait 15 s, then look in Salesforce (5 s and a reload if it is not there)', () =>
      lookAfterReply(this.salesforce.leads.page, look),
    );
    if (found !== undefined) return found;
    const entry = await test.step('Not in Salesforce: open Logs for the status', () => newLogEntry(sf, this.repliedAt));
    note('Logs row', entry.text);
    if (entry.status === 'Error') {
      note('Needs QA', 'Logs shows Error and the record is not in Salesforce. Ask QA with this scenario and its steps.');
      return undefined;
    }
    return test.step('Logs shows Success: look in Salesforce again', () => look());
  }

  // For "no record should appear": looks 15 s and 20 s after the reply and returns
  // the highest count seen, then records the Logs status (no entry is not a failure).
  async absent(count: () => Promise<number>): Promise<number> {
    let seen = 0;
    await test.step('Wait 15 s, look in Salesforce; wait 5 s, look again', async () => {
      await this.salesforce.leads.page.waitForTimeout(15_000);
      seen = await count();
      if (seen === 0) {
        await this.salesforce.leads.page.waitForTimeout(5_000);
        seen = await count();
      }
    });
    await this.logStatus(60_000);
    return seen;
  }

  // Reads the status of the Logs entry this reply created. '' when none shows in `timeoutMs`.
  async logStatus(timeoutMs = 2 * 60_000): Promise<string> {
    const { sf } = this.harness.options;
    let entry: SalesforceLogEntry | undefined;
    await test.step('Open Logs and read the entry this reply created', async () => {
      entry = await newLogEntry(sf, this.repliedAt, timeoutMs).catch(() => undefined);
    });
    note('Logs row', entry?.text ?? 'no entry after the reply');
    note('Logs status', entry?.status ?? 'none');
    return entry?.status ?? '';
  }
}

// What has been done so far. Playwright builds the page objects again for every
// test, so the spec keeps one ReplyState at module level and hands it to each
// ReplyHarness; a row run after Setup then skips what Setup already did.
export type ReplyState = { record: Set<string>; added: Set<string>; sent: Set<string>; configured: string };

export function newReplyState(): ReplyState {
  return { record: new Set(), added: new Set(), sent: new Set(), configured: '' };
}

export class ReplyHarness {
  readonly options: HarnessOptions;
  private readonly state: ReplyState;

  constructor(options: HarnessOptions, state: ReplyState) {
    this.options = options;
    this.state = state;
  }

  scenario(id: string): ReplyScenario {
    const found = this.options.scenarios.find((s) => s.id === id);
    if (!found) throw new Error(`No scenario "${id}"`);
    return found;
  }

  // The CSV row with the scenario's own values on top.
  rowOf(id: string): Row {
    const base = readCsv(this.options.csv).find((r) => r['Scenario'] === id);
    if (!base) throw new Error(`No row "${id}" in test-data/${this.options.csv}`);
    const override = Object.fromEntries(Object.entries(this.scenario(id).override ?? {}).filter((e): e is [string, string] => e[1] !== undefined));
    return { ...base, ...override };
  }

  private fullName(row: Row): string {
    return `${row['First Name']} ${row['Last Name']}`;
  }

  private async addRecords(id: string, row: Row): Promise<void> {
    const { setup } = this.scenario(id);
    if (!setup || this.state.record.has(id)) return;
    await this.options.salesforce.seed(setup, row);
    this.state.record.add(id);
  }

  // The row is marked used first: a failed add can still leave the prospect in Saleshandy.
  private async addProspect(seq: SaleshandySequencePage, id: string, row: Row): Promise<void> {
    if (this.state.added.has(id)) return;
    markUsed(this.options.csv, readCsv(this.options.csv).find((r) => r['Scenario'] === id)!['Email']);
    await seq.createAndAddProspect(this.options.sequenceId, row);
    this.state.added.add(id);
  }

  private async sendOut(seq: SaleshandySequencePage, id: string, row: Row): Promise<void> {
    if (this.state.sent.has(id)) return;
    await seq.sendNow(this.options.sequenceId, this.fullName(row), 1, row['Email']);
    this.state.sent.add(id);
  }

  // Everything before the reply that Setup has not done yet. A row run on its own
  // (-g) prepares itself, so no row depends on Setup having run.
  async prepare(id: string): Promise<void> {
    const row = this.rowOf(id);
    await this.addRecords(id, row);
    await this.addProspect(this.options.seq, id, row);
    await this.sendOut(this.options.seq, id, row);
  }

  // The waiting happens once, up front (QA, 2026-10-20): Salesforce records, prospects
  // and step 1 sends for every scenario side by side, so the sender's 40 to 50 s
  // spacing runs while the rows are being checked. `sender` is a second Saleshandy tab.
  async setupAll(ids: string[], sender: SaleshandySequencePage): Promise<void> {
    const added = ids.map(() => {
      let resolve!: () => void;
      const promise = new Promise<void>((r) => (resolve = r));
      return { promise, resolve };
    });
    const records = async () => {
      for (const id of ids) await this.addRecords(id, this.rowOf(id));
    };
    const prospects = async () => {
      for (const [i, id] of ids.entries()) {
        await this.addProspect(this.options.seq, id, this.rowOf(id));
        added[i].resolve();
      }
    };
    const sends = async () => {
      for (const [i, id] of ids.entries()) {
        await added[i].promise;
        await this.sendOut(sender, id, this.rowOf(id));
      }
    };
    await test.step('Create records, add prospects and send step 1, side by side', () => Promise.all([records(), prospects(), sends()]).then(() => undefined));
  }

  // Makes `picks` the only activities on the trigger and saves; skipped when the
  // trigger already holds exactly them.
  async useActivities(picks: ActivityPick[]): Promise<void> {
    const key = JSON.stringify(picks);
    if (this.state.configured === key) return;
    const names = picks.map((p) => (typeof p === 'string' ? p : p.activity)).join(' + ');
    await test.step(`Set the trigger "${this.options.trigger}" to: ${names}`, async () => {
      await this.options.sf.setActivities(this.options.trigger, picks);
      await expect(this.options.sf.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
      this.state.configured = key;
    });
  }

  async turnTriggersOff(): Promise<void> {
    await test.step('Turn every trigger off and save', async () => {
      await this.options.sf.openTriggers();
      await this.options.sf.enableOnly('');
      await this.options.sf.save();
      await expect(this.options.sf.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
      this.state.configured = '';
    });
  }

  // Mark the step 1 email as replied; returns the moment of the reply.
  async reply(id: string): Promise<number> {
    const { seq, sequenceId } = this.options;
    const row = this.rowOf(id);
    const { outcome } = this.scenario(id);
    await test.step('Make sure the Salesforce records, the prospect and the step 1 send are ready', () => this.prepare(id));
    await test.step('Wait until the step 1 email shows Sent', () => seq.ensureSent(sequenceId, this.fullName(row), 1, row['Email']));
    if (outcome) await test.step(`Set the prospect outcome to ${outcome}`, () => seq.setProspectOutcome(sequenceId, row['Email'], outcome));
    const at = Date.now();
    await test.step('Mark the step 1 email as replied', () => seq.markAsReplied(sequenceId, this.fullName(row), 1, row['Email']));
    return at;
  }

  // The reply and the scenario's check, for a row whose trigger is already set.
  async replyAndCheck(id: string): Promise<void> {
    const scenario = this.scenario(id);
    const at = await this.reply(id);
    await scenario.check(new World(this, scenario, this.rowOf(id), at));
  }

  // One full row: configure the trigger, reply, run the scenario's check.
  async run(id: string): Promise<void> {
    const scenario = this.scenario(id);
    if (scenario.triggerOff) await this.turnTriggersOff();
    else await this.useActivities(scenario.activities);
    await this.replyAndCheck(id);
  }
}
