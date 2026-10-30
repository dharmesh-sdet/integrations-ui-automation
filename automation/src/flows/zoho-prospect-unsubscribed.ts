import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { Row } from '../data/csv.ts';
import type { MailinatorPage } from '../pages/mailinator.page.ts';
import type { SaleshandySequencePage } from '../pages/saleshandy/sequence.page.ts';
import { sendStep } from './zoho-email-sent.ts';

// Steps only the Zoho Prospect Unsubscribed spec needs. The steps shared with the other Zoho workflows stay in
// saleshandy-to-zoho.ts, which another session owns (QA 2026-10-29), so nothing is added there.
export const TRIGGER = 'Prospect is Unsubscribed in Saleshandy';
// The tag from the developer log (runs U1, U2, VU1) and the public docs. It replaces the contact's other tags (Z-6, known).
export const TAG = 'Unsubscribed-Saleshandy';
// Texts of the unsubscribe page (seen on staging for Pipedrive, 2026-10-26).
export const UNSUBSCRIBED_TEXT = 'You will no longer receive emails from us';
export const SUBSCRIBED_TEXT = 'You have successfully subscribed and added to our list for future communication';

// The cases file says step 1 shows Sent before the unsubscribe, so UI rows send it (counts against the send cap).
// For Pipedrive, Mark as Unsubscribe fired the workflow without a send (2026-10-26). ZOHO_PU_SKIP_SEND=1 skips the
// send to save the cap. TODO(needs-input): the same is not seen for Zoho yet; QA decides which is the default.
const SKIP_SEND = process.env.ZOHO_PU_SKIP_SEND === '1';

// Unsubscribe (UI): adds the prospect to the sequence, sends step 1 (unless skipped), then Prospects tab > tick the
// prospect > Mark as Unsubscribe. markAsUnsubscribed waits until the row reads "Unsubscribed".
export async function unsubscribeUi(seq: SaleshandySequencePage, sequenceId: string, row: Row): Promise<void> {
  if (SKIP_SEND) await seq.createAndAddProspect(sequenceId, row);
  else await sendStep(seq, sequenceId, row);
  await seq.markAsUnsubscribed(sequenceId, row['Email']);
}

// Unsubscribe (link), part 1: sends step 1, then opens the "Unsubscribe here" link of the delivered email from
// the Mailinator inbox (the sequence needs Sequence Settings > Unsubscribe > "Unsubscribe as Link" saved).
// Returns the unsubscribe page and the email subject (a second open needs it).
export async function unsubscribeByLink(
  seq: SaleshandySequencePage,
  mailinator: MailinatorPage,
  sequenceId: string,
  row: Row,
): Promise<{ page: Page; subject: string }> {
  await sendStep(seq, sequenceId, row);
  const subject = await mailinator.latestSubject(row['Email']);
  return { page: await openLink(mailinator, row, subject), subject };
}

// Opens the link of an email already delivered (also the second open of Trigger and setup 5).
export async function openLink(mailinator: MailinatorPage, row: Row, subject: string): Promise<Page> {
  const page = await mailinator.openUnsubscribeLink(row['Email'], subject);
  await expect(page.getByText(UNSUBSCRIBED_TEXT), 'The unsubscribe page').toBeVisible({ timeout: 30_000 });
  return page;
}

export const hasTag = (text: string): boolean => text.includes(TAG);

// The note title and text of this trigger are not recorded yet. The lines of a record page that mention the
// unsubscribe are kept as a test annotation, so the first run shows them for the cases file.
export const noteLines = (text: string): string =>
  text.split('\n').map((l) => l.trim()).filter((l) => /unsubscrib/i.test(l)).slice(0, 6).join(' | ').slice(0, 400) || 'none';
