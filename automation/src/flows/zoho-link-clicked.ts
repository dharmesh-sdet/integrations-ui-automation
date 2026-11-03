import { expect } from '@playwright/test';
import type { Row } from '../data/csv.ts';
import type { MailinatorPage } from '../pages/mailinator.page.ts';
import type { SaleshandySequencePage } from '../pages/saleshandy/sequence.page.ts';
import { untilPasses } from '../utils/wait.ts';
import { fullName } from './saleshandy-to-zoho.ts';

// Steps only the Zoho Link Clicked spec needs. The steps shared with the other Zoho workflows stay in
// saleshandy-to-zoho.ts, which another session owns (QA 2026-10-29), so nothing is added there.
export const TRIGGER = 'Link is Clicked in Saleshandy';
export const OPENED_TRIGGER = 'Email is Opened in Saleshandy';
// Subjects of the two steps, from tests/setup/zoho-link-clicked-sequence.spec.ts.
export const STEP_1_SUBJECT = 'Quick question about your outreach';
export const STEP_2_SUBJECT = 'Following up on my last note';

// Clicks link `link` (0 = first) of the step's email in the Mailinator inbox, then waits until the Clicked
// count of that step rises. Returns the count, which a link scanner can push above the number of clicks (Z-10).
export async function clickLink(
  seq: SaleshandySequencePage,
  mailinator: MailinatorPage,
  sequenceId: string,
  row: Row,
  link = 0,
  step = 1,
): Promise<number> {
  const clicked = () => seq.clickedCount(sequenceId, fullName(row), step, row['Email']);
  const before = await clicked();
  await mailinator.clickFirstLink(row['Email'], step === 1 ? STEP_1_SUBJECT : STEP_2_SUBJECT, link);
  let after = before;
  await untilPasses(`Clicked count of step ${step} for ${row['Email']} did not rise above ${before}`, async () => {
    after = await clicked();
    expect(after).toBeGreaterThan(before);
  }, 90_000);
  return after;
}

// The note text carries "Click Count" (run L1). The note title is not recorded yet, so notes are counted by it.
export const clickNotes = (text: string): number => text.split('Click Count').length - 1;
