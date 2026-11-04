import { expect, test } from '@playwright/test';
import type { Row } from '../data/csv.ts';
import { markUsed } from '../data/used.ts';
import type { SalesforceIntegrationPage } from '../pages/saleshandy/salesforce-integration.page.ts';
import type { MailinatorPage } from '../pages/mailinator.page.ts';
import type { SaleshandySequencePage } from '../pages/saleshandy/sequence.page.ts';
import { staysTrue, untilPasses } from '../utils/wait.ts';
import { fullName } from './saleshandy-to-salesforce.ts';

// Steps only the Salesforce Link Clicked spec needs (AL-4136). Same shape as salesforce-email-opened.ts, with a
// click on a link of the email in place of the open.
// Trigger names on Triggers & Activity and in Logs.
export const TRIGGER = 'Link is Clicked in Saleshandy';
export const EMAIL_SENT_TRIGGER = 'Email Sent from Saleshandy';
export const OPENED_TRIGGER = 'Sequence Email is Opened in Saleshandy';
// Subjects of the two steps of "Salesforce Link Clicked Regression", built by
// tests/setup/salesforce-link-clicked-sequence.spec.ts.
export const STEP_1_SUBJECT = 'Quick question about your outreach';
export const STEP_2_SUBJECT = 'Following up on my last note';
// Staging: a click counts 10 s after the send, a later one 10 s after the one before (QA, 2026-10-12).
// Production: 90 s after the send (developer, 2026-10-15); the smoke runner sets CLICK_AFTER_MS=90000 and
// CLICK_COUNT_TIMEOUT_MS, the staging runs keep the defaults.
export const CLICK_AFTER_MS = Number(process.env.CLICK_AFTER_MS ?? 10_000);
export const CLICK_SETTLE_MS = 10_000;

// Clicks link `link` (0 = link 1, 1 = link 2) of the step's email in the Mailinator inbox, 10 s after the send
// or after the click before it. Returns the Clicked count read 10 s later.
export async function clickOnly(
  seq: SaleshandySequencePage,
  mailinator: MailinatorPage,
  sequenceId: string,
  row: Row,
  step = 1,
  link = 0,
): Promise<number> {
  await seq.page.waitForTimeout(CLICK_AFTER_MS);
  await mailinator.clickFirstLink(row['Email'], step === 1 ? STEP_1_SUBJECT : STEP_2_SUBJECT, link);
  await seq.page.waitForTimeout(CLICK_SETTLE_MS);
  return seq.clickedCount(sequenceId, fullName(row), step, row['Email']);
}

// Clicks the link, then refreshes the Clicked count of the step until it rises. Returns the count.
export async function clickLink(
  seq: SaleshandySequencePage,
  mailinator: MailinatorPage,
  sequenceId: string,
  row: Row,
  step = 1,
  link = 0,
): Promise<number> {
  const clicked = () => seq.clickedCount(sequenceId, fullName(row), step, row['Email']);
  const before = await clicked();
  let after = await clickOnly(seq, mailinator, sequenceId, row, step, link);
  if (after > before) return after;
  await untilPasses(`Clicked count of step ${step} for ${row['Email']} did not rise above ${before}`, async () => {
    after = await clicked();
    expect(after).toBeGreaterThan(before);
  }, Number(process.env.CLICK_COUNT_TIMEOUT_MS ?? 90_000));
  return after;
}

// ---- send, click, read Logs ----

export type ClickResult = { status: string; logRow: string; clicked: number; newEntries: number };

type Pages = {
  salesforceIntegration: SalesforceIntegrationPage;
  saleshandySequence: SaleshandySequencePage;
  mailinator: MailinatorPage;
};

type ClickOptions = {
  sequenceId: string;
  row: Row;
  csv: string;
  usedEmail: string;
  // The step whose email is clicked. Step 1 adds the prospect and sends it. A later step first sends step 1,
  // moves the prospect to that step and sends it. Only the clicked step's Logs entry is under test.
  step?: number;
  // 0 = link 1, 1 = link 2.
  link?: number;
  // Trigger whose Logs entries are read. Default: Link is Clicked.
  trigger?: string;
};

export async function knownLogIds(pages: Pages, trigger = TRIGGER): Promise<Set<string>> {
  await pages.salesforceIntegration.openLogs();
  return new Set((await pages.salesforceIntegration.logEntries(trigger)).map((e) => e.id));
}

// Adds the prospect, sends the step with Send now, and leaves the email unclicked.
export async function addAndSend(pages: Pages, options: ClickOptions): Promise<void> {
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
// The Logs page is read 15 s after the click is counted, then every 10 s (QA rule).
export async function readNewLog(pages: Pages, known: Set<string>, trigger = TRIGGER, row?: Row): Promise<ClickResult> {
  let result: ClickResult = { status: '', logRow: '', clicked: 0, newEntries: 0 };
  await test.step('Wait for the new Logs entry and read its status', async () => {
    await pages.saleshandySequence.page.waitForTimeout(15_000);
    await pages.salesforceIntegration.openLogs();
    await untilPasses(`No finished new "${trigger}" Logs entry${row ? ` for ${row['Email']}` : ''}`, async () => {
      await pages.salesforceIntegration.refreshLogs();
      const fresh = (await pages.salesforceIntegration.logEntries(trigger)).filter((e) => !known.has(e.id));
      expect(fresh.length, 'new Logs entries').toBeGreaterThan(0);
      const finished = fresh.find((e) => e.status === 'Success' || e.status === 'Error');
      expect(finished, `new entries: ${fresh.map((e) => e.text).join(' | ')}`).toBeTruthy();
      result = { status: finished!.status, logRow: finished!.text, clicked: 0, newEntries: fresh.length };
    });
  });
  test.info().annotations.push({ type: 'Logs row', description: result.logRow });
  test.info().annotations.push({ type: 'Logs status', description: result.status });
  return result;
}

// One click on the step's email: add and send as needed, click, read the Clicked count and the new Logs entry.
export async function clickAndReadLog(pages: Pages, options: ClickOptions): Promise<ClickResult> {
  const { sequenceId, row, step = 1, link = 0, trigger = TRIGGER } = options;
  const known = await knownLogIds(pages, trigger);
  await addAndSend(pages, options);
  let clicked = 0;
  await test.step(`Click link ${link + 1} of the step ${step} email in Mailinator`, async () => {
    clicked = await clickLink(pages.saleshandySequence, pages.mailinator, sequenceId, row, step, link);
    test.info().annotations.push({ type: 'Clicked count', description: String(clicked) });
  });
  const result = await readNewLog(pages, known, trigger, row);
  return { ...result, clicked };
}

// For "nothing should be logged": the email is clicked, but no new entry shows. `expectCountRise` is false when
// the click must not register at all (link tracking off): the Clicked count is read and returned, not awaited.
export async function clickAndExpectNoLog(pages: Pages, options: ClickOptions & { expectCountRise?: boolean }): Promise<number> {
  const { sequenceId, row, step = 1, link = 0, expectCountRise = true } = options;
  const known = await knownLogIds(pages);
  await addAndSend(pages, options);
  let clicked = 0;
  await test.step(`Click link ${link + 1} of the step ${step} email in Mailinator`, async () => {
    clicked = expectCountRise
      ? await clickLink(pages.saleshandySequence, pages.mailinator, sequenceId, row, step, link)
      : await clickOnly(pages.saleshandySequence, pages.mailinator, sequenceId, row, step, link);
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
  return clicked;
}
