import { expect, test } from '@playwright/test';
import type { Row } from '../data/csv.ts';
import { markUsed } from '../data/used.ts';
import type { SalesforceIntegrationPage } from '../pages/saleshandy/salesforce-integration.page.ts';
import type { SaleshandySequencePage } from '../pages/saleshandy/sequence.page.ts';
import { staysTrue, untilPasses } from '../utils/wait.ts';

export type SendResult = { status: string; logRow: string };

type Pages = {
  salesforceIntegration: SalesforceIntegrationPage;
  saleshandySequence: SaleshandySequencePage;
};

type SendOptions = {
  sequenceId: string;
  // Name of the trigger on Triggers & Activity and in Logs.
  trigger: string;
  // Prospect to send to. Its Email may be overridden when a scenario needs an
  // email that already exists in Salesforce.
  row: Row;
  // CSV the row came from, and the CSV row's own email (for markUsed).
  csv: string;
  usedEmail: string;
  // 1 adds the prospect and sends step 1. A later step moves the prospect that
  // is already in the sequence to that step first, then sends it.
  step?: number;
};

export function fullName(row: Row): string {
  return `${row['First Name']} ${row['Last Name']}`;
}

async function logIds(pages: Pages, trigger: string): Promise<Set<string>> {
  await pages.salesforceIntegration.openLogs();
  return new Set((await pages.salesforceIntegration.logEntries(trigger)).map((e) => e.id));
}

// Adds the prospect (or moves it to a later step), sends the step with Send now,
// then waits for the new Logs entry of `trigger` and returns its status. The
// Logs entries that exist before the send are noted first, because the sequence
// can send on its own right after the prospect is added.
export async function sendAndReadLog(pages: Pages, options: SendOptions): Promise<SendResult> {
  const { sequenceId, trigger, row, csv, usedEmail, step = 1 } = options;
  const name = fullName(row);

  let known = new Set<string>();
  await test.step('Note the Logs entries that exist before the send', async () => {
    known = await logIds(pages, trigger);
  });

  if (step === 1) {
    await test.step(`Add ${name} to the sequence`, async () => {
      await pages.saleshandySequence.createAndAddProspect(sequenceId, row);
      markUsed(csv, usedEmail);
    });
  } else {
    await test.step(`Move ${name} to step ${step}`, async () => {
      await pages.saleshandySequence.moveToStep(sequenceId, row['Email'], step);
    });
  }

  await test.step(`Send step ${step} to ${name}`, async () => {
    await pages.saleshandySequence.sendNow(sequenceId, name, step);
  });

  let result: SendResult = { status: '', logRow: '' };
  await test.step('Wait for the new Logs entry and read its status', async () => {
    await pages.salesforceIntegration.openLogs();
    await untilPasses(`No finished new "${trigger}" Logs entry for ${row['Email']}`, async () => {
      await pages.salesforceIntegration.refreshLogs();
      const fresh = (await pages.salesforceIntegration.logEntries(trigger)).filter((e) => !known.has(e.id));
      expect(fresh.length, 'new Logs entries').toBeGreaterThan(0);
      const finished = fresh.find((e) => e.status === 'Success' || e.status === 'Error');
      expect(finished, `new entries: ${fresh.map((e) => e.text).join(' | ')}`).toBeTruthy();
      result = { status: finished!.status, logRow: finished!.text };
    });
  });
  test.info().annotations.push({ type: 'Logs row', description: result.logRow });
  test.info().annotations.push({ type: 'Logs status', description: result.status });
  return result;
}

// For "nothing should be logged": sends step 1 to a new prospect and checks that
// no new entry for `trigger` shows up in the 15 s + 10 s checks.
export async function sendAndExpectNoLog(pages: Pages, options: SendOptions): Promise<void> {
  const { sequenceId, trigger, row, csv, usedEmail } = options;
  const name = fullName(row);

  let known = new Set<string>();
  await test.step('Note the Logs entries that exist before the send', async () => {
    known = await logIds(pages, trigger);
  });
  await test.step(`Add ${name} to the sequence`, async () => {
    await pages.saleshandySequence.createAndAddProspect(sequenceId, row);
    markUsed(csv, usedEmail);
  });
  await test.step(`Send step 1 to ${name}`, async () => {
    await pages.saleshandySequence.sendNow(sequenceId, name, 1);
  });
  await test.step(`No new "${trigger}" Logs entry appears`, async () => {
    await staysTrue(
      pages.salesforceIntegration.page,
      async () => {
        await pages.salesforceIntegration.refreshLogs();
        const fresh = (await pages.salesforceIntegration.logEntries(trigger)).filter((e) => !known.has(e.id));
        expect(fresh.length, `new "${trigger}" Logs entries: ${fresh.map((e) => e.text).join(' | ')}`).toBe(0);
      },
      3,
    );
  });
}
