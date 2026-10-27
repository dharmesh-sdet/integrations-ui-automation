import { expect, test } from '@playwright/test';
import type { Row } from '../data/csv.ts';
import { markUsed } from '../data/used.ts';
import type { PipedriveIntegrationPage } from '../pages/saleshandy/pipedrive-integration.page.ts';
import type { ActivityPick } from '../pages/saleshandy/salesforce-integration.page.ts';
import type { SaleshandySequencePage } from '../pages/saleshandy/sequence.page.ts';
import { FIRST_CHECK_MS, untilPasses } from '../utils/wait.ts';

// Shared by the seven Saleshandy to Pipedrive workflows (Email Sent, Reply Received, Link Clicked,
// Email Opened, Email Bounced, Prospect Unsubscribed, Prospect Outcome Updated). A workflow spec
// lists its rows; this file holds the steps they have in common. How a row is checked in Pipedrive
// follows QA's rule of 2026-10-23: the run is done when the prospect's Emails tab row shows "Sent"
// (SaleshandySequencePage.sendNow waits for that), then wait 15 s, look in Pipedrive first, and open
// Logs only if the record is missing. A run that ends in Error is reported, not failed.

type Pages = {
  pipedriveIntegration: PipedriveIntegrationPage;
  saleshandySequence: SaleshandySequencePage;
};

export type EventOptions = {
  sequenceId: string;
  row: Row;
  // CSV the row came from, for markUsed.
  csv: string;
  // 1 adds the prospect and sends step 1. A later step moves the prospect that is already in the
  // sequence to that step first, then sends it.
  step?: number;
};

export function fullName(row: Row): string {
  return `${row['First Name']} ${row['Last Name']}`.trim();
}

// Turns `trigger` on with only the given activities selected (every other trigger off) and saves.
export async function configure(pages: Pages, trigger: string, picks: ActivityPick[]): Promise<void> {
  await test.step(`Select ${picks.map((p) => (typeof p === 'string' ? p : p.activity)).join(', ')} on "${trigger}" and save`, async () => {
    await pages.pipedriveIntegration.setActivities(trigger, picks);
    await expect(pages.pipedriveIntegration.savedToast()).toBeVisible({ timeout: 15_000 });
  });
}

// Email Sent: adds the prospect (or moves it to a later step) and sends the step. Returns when the
// prospect's Emails tab row shows "Sent".
export async function sendEmail(pages: Pages, options: EventOptions): Promise<void> {
  const { sequenceId, row, csv, step = 1 } = options;
  const name = fullName(row);
  if (step === 1) {
    await test.step(`Add ${name || row['Email']} to the sequence`, async () => {
      await pages.saleshandySequence.createAndAddProspect(sequenceId, row);
      markUsed(csv, row['Email']);
    });
  } else {
    await test.step(`Move ${name} to step ${step}`, async () => {
      await pages.saleshandySequence.moveToStep(sequenceId, row['Email'], step);
    });
  }
  await test.step(`Send step ${step} to ${name || row['Email']}`, async () => {
    await pages.saleshandySequence.sendNow(sequenceId, name, step, row['Email']);
  });
}

// Waits until `check` passes in Pipedrive: first look 15 s after the send, then every 10 s. When the
// look still fails after `timeout`, the newest Logs entry of `trigger` is added to the failure as an
// annotation, so QA sees at once whether the run errored (reported, not failed) or never ran.
export async function untilInPipedrive(
  pages: Pages,
  trigger: string,
  what: string,
  check: () => Promise<void>,
  timeout = 90_000,
): Promise<void> {
  try {
    await untilPasses(what, check, timeout);
  } catch (error) {
    const entry = await latestLog(pages, trigger).catch(() => 'Logs could not be read');
    test.info().annotations.push({ type: 'Logs (latest entry)', description: entry });
    throw error;
  }
}

// "Nothing should happen": checks 15 s after the send and once more 10 s later.
export async function staysUnchanged(pages: Pages, check: () => Promise<void>): Promise<void> {
  await pages.saleshandySequence.page.waitForTimeout(FIRST_CHECK_MS);
  await check();
  await pages.saleshandySequence.page.waitForTimeout(10_000);
  await check();
}

// The newest Logs entry of the trigger: its text and status, for the report.
export async function latestLog(pages: Pages, trigger: string): Promise<string> {
  await pages.pipedriveIntegration.openLogs();
  const entries = await pages.pipedriveIntegration.logEntries(trigger);
  return entries[0]?.text ?? `no "${trigger}" entry in Logs`;
}

// Records the Logs entry of a finished row next to the result, for rows whose expected Run status is
// not documented ("record it", QA 2026-10-23).
export async function recordLog(pages: Pages, trigger: string): Promise<void> {
  const entry = await latestLog(pages, trigger);
  test.info().annotations.push({ type: 'Logs row', description: entry });
}
