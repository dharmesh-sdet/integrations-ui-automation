import { expect, test } from '@playwright/test';
import type { Row } from '../data/csv.ts';
import { markUsed } from '../data/used.ts';
import type { SalesforceIntegrationPage } from '../pages/saleshandy/salesforce-integration.page.ts';
import type { MailinatorPage } from '../pages/mailinator.page.ts';
import type { SaleshandySequencePage } from '../pages/saleshandy/sequence.page.ts';
import { staysTrue, untilPasses } from '../utils/wait.ts';
import { fullName } from './saleshandy-to-salesforce.ts';

// Steps only the Salesforce Email Opened spec needs (AL-4135). Same open logic as the Zoho flow.
// Trigger name on Triggers & Activity and in Logs.
export const TRIGGER = 'Sequence Email is Opened in Saleshandy';
export const EMAIL_SENT_TRIGGER = 'Email Sent from Saleshandy';
// Subject of step 1 of "Salesforce Email Opened Regression", built by tests/setup/salesforce-email-opened-sequence.spec.ts.
export const STEP_1_SUBJECT = 'Quick question about your outreach';
export const STEP_2_SUBJECT = 'Following up on my last note';
// Staging: an open counts 10 s after the send, a later one 10 s after the one before (QA, 2026-10-12).
export const OPEN_AFTER_MS = 10_000;
export const OPEN_SETTLE_MS = 10_000;

// Opens the email of `step` in the Mailinator inbox (images load, which is the open). Calling it again
// for the same prospect is a second open. Returns the Opened count read 10 s later.
export async function openOnly(seq: SaleshandySequencePage, mailinator: MailinatorPage, sequenceId: string, row: Row, step = 1): Promise<number> {
  await seq.page.waitForTimeout(OPEN_AFTER_MS);
  await mailinator.openEmail(row['Email'], step === 1 ? STEP_1_SUBJECT : STEP_2_SUBJECT);
  await seq.page.waitForTimeout(OPEN_SETTLE_MS);
  return seq.openedCount(sequenceId, fullName(row), step);
}

// Opens the email, then refreshes the Opened count of the step until it rises. Returns the count.
export async function openEmail(seq: SaleshandySequencePage, mailinator: MailinatorPage, sequenceId: string, row: Row, step = 1): Promise<number> {
  const opened = () => seq.openedCount(sequenceId, fullName(row), step);
  const before = await opened();
  let after = await openOnly(seq, mailinator, sequenceId, row, step);
  if (after > before) return after;
  await untilPasses(`Opened count of step ${step} for ${row['Email']} did not rise above ${before}`, async () => {
    after = await opened();
    expect(after).toBeGreaterThan(before);
  }, 90_000);
  return after;
}

// ---- send, open, read Logs ----

export type OpenResult = { status: string; logRow: string; opened: number; newEntries: number };

type Pages = {
  salesforceIntegration: SalesforceIntegrationPage;
  saleshandySequence: SaleshandySequencePage;
  mailinator: MailinatorPage;
};

type OpenOptions = {
  sequenceId: string;
  row: Row;
  csv: string;
  usedEmail: string;
  // The step whose email is opened. Step 1 adds the prospect and sends it. A later step first sends step 1,
  // moves the prospect to that step and sends it. Only the opened step's Logs entry is under test.
  step?: number;
};

export async function knownLogIds(pages: Pages, trigger = TRIGGER): Promise<Set<string>> {
  await pages.salesforceIntegration.openLogs();
  return new Set((await pages.salesforceIntegration.logEntries(trigger)).map((e) => e.id));
}

// Adds the prospect, sends the step with Send now, and leaves the email unopened.
export async function addAndSend(pages: Pages, options: OpenOptions): Promise<void> {
  const { sequenceId, row, csv, usedEmail, step = 1 } = options;
  const name = fullName(row);
  await test.step(`Add ${name} to the sequence and send step 1`, async () => {
    await pages.saleshandySequence.createAndAddProspect(sequenceId, row);
    markUsed(csv, usedEmail);
    await pages.saleshandySequence.sendNow(sequenceId, name, 1);
  });
  if (step > 1) {
    await test.step(`Move ${name} to step ${step} and send it`, async () => {
      await pages.saleshandySequence.moveToStep(sequenceId, row['Email'], step);
      await pages.saleshandySequence.sendNow(sequenceId, name, step);
    });
  }
}

// Waits for new Logs entries of `trigger` that reached a final status and returns the first one.
// The Logs page is read 15 s after the open is counted, then every 10 s (QA rule).
export async function readNewLog(pages: Pages, known: Set<string>, trigger = TRIGGER, row?: Row): Promise<OpenResult> {
  let result: OpenResult = { status: '', logRow: '', opened: 0, newEntries: 0 };
  await test.step('Wait for the new Logs entry and read its status', async () => {
    await pages.saleshandySequence.page.waitForTimeout(15_000);
    await pages.salesforceIntegration.openLogs();
    await untilPasses(`No finished new "${trigger}" Logs entry${row ? ` for ${row['Email']}` : ''}`, async () => {
      await pages.salesforceIntegration.refreshLogs();
      const fresh = (await pages.salesforceIntegration.logEntries(trigger)).filter((e) => !known.has(e.id));
      expect(fresh.length, 'new Logs entries').toBeGreaterThan(0);
      const finished = fresh.find((e) => e.status === 'Success' || e.status === 'Error');
      expect(finished, `new entries: ${fresh.map((e) => e.text).join(' | ')}`).toBeTruthy();
      result = { status: finished!.status, logRow: finished!.text, opened: 0, newEntries: fresh.length };
    });
  });
  test.info().annotations.push({ type: 'Logs row', description: result.logRow });
  test.info().annotations.push({ type: 'Logs status', description: result.status });
  return result;
}

// One open of the step's email: add and send as needed, open it, read the Opened count and the new Logs entry.
export async function openAndReadLog(pages: Pages, options: OpenOptions): Promise<OpenResult> {
  const { sequenceId, row, step = 1 } = options;
  const known = await knownLogIds(pages);
  await addAndSend(pages, options);
  let opened = 0;
  await test.step(`Open the step ${step} email in Mailinator`, async () => {
    opened = await openEmail(pages.saleshandySequence, pages.mailinator, sequenceId, row, step);
    test.info().annotations.push({ type: 'Opened count', description: String(opened) });
  });
  const result = await readNewLog(pages, known, TRIGGER, row);
  return { ...result, opened };
}

// For "nothing should be logged": the email is opened and the Opened count rises, but no new entry shows.
export async function openAndExpectNoLog(pages: Pages, options: OpenOptions): Promise<number> {
  const { sequenceId, row, step = 1 } = options;
  const known = await knownLogIds(pages);
  await addAndSend(pages, options);
  let opened = 0;
  await test.step(`Open the step ${step} email in Mailinator`, async () => {
    opened = await openEmail(pages.saleshandySequence, pages.mailinator, sequenceId, row, step);
  });
  await test.step(`No new "${TRIGGER}" Logs entry appears`, async () => {
    await staysTrue(
      pages.salesforceIntegration.page,
      async () => {
        await pages.salesforceIntegration.refreshLogs();
        const fresh = (await pages.salesforceIntegration.logEntries(TRIGGER)).filter((e) => !known.has(e.id));
        expect(fresh.length, `new "${TRIGGER}" Logs entries: ${fresh.map((e) => e.text).join(' | ')}`).toBe(0);
      },
      3,
    );
  });
  return opened;
}
