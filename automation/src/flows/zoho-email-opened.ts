import { expect } from '@playwright/test';
import type { Row } from '../data/csv.ts';
import type { MailinatorPage } from '../pages/mailinator.page.ts';
import type { SaleshandySequencePage } from '../pages/saleshandy/sequence.page.ts';
import { untilPasses } from '../utils/wait.ts';
import { fullName } from './saleshandy-to-zoho.ts';

// Steps only the Zoho Email Opened spec needs. The steps shared with the other Zoho workflows stay in
// saleshandy-to-zoho.ts and zoho-email-sent.ts, which other sessions own, so nothing is added there.
// Trigger name as it shows on screen (QA 2026-10-30).
export const TRIGGER = 'Email is Opened in Saleshandy';
export const REPLY_TRIGGER = 'Reply is Received in Saleshandy';
// TODO(needs-input): subject of step 1 of "Zoho Email Opened QA". It is the subject the sequence is built with by hand.
export const STEP_1_SUBJECT = 'Quick question about your outreach';
// Staging: an open counts 10 s after the send, a later one 10 s after the one before (QA, 2026-10-12).
export const OPEN_AFTER_MS = 10_000;
export const OPEN_SETTLE_MS = 10_000;

// Opens the step 1 email in the Mailinator inbox (images load, which is the open), without waiting for a count.
// Calling it again for the same prospect is a second open. Returns the Opened count read 10 s later.
export async function openOnly(seq: SaleshandySequencePage, mailinator: MailinatorPage, sequenceId: string, row: Row): Promise<number> {
  await seq.page.waitForTimeout(OPEN_AFTER_MS);
  await mailinator.openEmail(row['Email'], STEP_1_SUBJECT);
  await seq.page.waitForTimeout(OPEN_SETTLE_MS);
  return seq.openedCount(sequenceId, fullName(row), 1);
}

// Opens the email, then refreshes the Opened count of step 1 until it rises. Returns the count, which an
// image prefetch can push above the number of opens.
export async function openEmail(seq: SaleshandySequencePage, mailinator: MailinatorPage, sequenceId: string, row: Row): Promise<number> {
  const opened = () => seq.openedCount(sequenceId, fullName(row), 1);
  const before = await opened();
  let after = await openOnly(seq, mailinator, sequenceId, row);
  if (after > before) return after;
  await untilPasses(`Opened count of step 1 for ${row['Email']} did not rise above ${before}`, async () => {
    after = await opened();
    expect(after).toBeGreaterThan(before);
  }, 90_000);
  return after;
}

// The note text carries "Open Count". The note title is not recorded yet, so notes are counted by it.
export const openNotes = (text: string): number => text.split('Open Count').length - 1;
