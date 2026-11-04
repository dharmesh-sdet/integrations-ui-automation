import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { Row } from '../data/csv.ts';
import type { MailinatorPage } from '../pages/mailinator.page.ts';
import type { SaleshandySequencePage } from '../pages/saleshandy/sequence.page.ts';
import { configureWaiting, sendStep } from './zoho-email-sent.ts';
import type { ZohoAction } from './saleshandy-to-zoho.ts';
import type { ZohoIntegrationPage } from '../pages/saleshandy/zoho-integration.page.ts';

// Steps only the Zoho Prospect Unsubscribed spec needs. The steps shared with the other Zoho workflows stay in
// saleshandy-to-zoho.ts, which another session owns (QA 2026-10-29), so nothing is added there.
export const TRIGGER = 'Prospect is Unsubscribed in Saleshandy';
// The tag from the developer log (runs U1, U2, VU1) and the public docs. It replaces the contact's other tags (Z-6, known).
export const TAG = 'Unsubscribed-Saleshandy';
// Title of the note this trigger writes, seen on a contact on 2026-11-03 (first line of the note, then the sequence name,
// sequence link, step, sender, prospect email, prospect name and user).
export const NOTE_TITLE = 'Saleshandy Prospect is Unsubscribed';
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
  await prospectsTabReady(seq, sequenceId);
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
  await prospectsTabReady(seq, sequenceId);
  await sendStep(seq, sequenceId, row);
  const subject = await mailinator.latestSubject(row['Email']);
  return { page: await openLink(mailinator, row, subject), subject };
}

// Opens the link of an email already delivered (also the second open of Trigger and setup 5).
export async function openLink(mailinator: MailinatorPage, row: Row, subject: string): Promise<Page> {
  // The unsubscribe registers only when the email stayed open for a while (seen 2026-10-31: 20 s works, 0 s stayed Active for 120 s).
  const page = await mailinator.openUnsubscribeLink(row['Email'], subject, Number(process.env.ZOHO_PU_LINK_WAIT_MS ?? 20_000));
  await expect(page.getByText(UNSUBSCRIBED_TEXT), 'The unsubscribe page').toBeVisible({ timeout: 30_000 });
  return page;
}

export const hasTag = (text: string): boolean => text.includes(TAG);

// The note title is known (NOTE_TITLE). The note text is not recorded yet, so the lines of a record page that mention
// the unsubscribe are kept as a test annotation, for the cases file.
export const noteLines = (text: string): string =>
  text.split('\n').map((l) => l.trim()).filter((l) => /unsubscrib/i.test(l)).slice(0, 6).join(' | ').slice(0, 400) || 'none';

// Staging pages sometimes stay on grey placeholder boxes for a minute (2026-11-03: 4 rows failed on "Search & Add" with the
// page still a skeleton). The shared createAndAddProspect waits 15 s, reloads once, then waits 30 s. This opens the
// Prospects tab first and reloads up to 3 times until a button to add prospects shows, so the shared step starts on a
// loaded page. It changes nothing in Saleshandy.
export async function prospectsTabReady(seq: SaleshandySequencePage, sequenceId: string): Promise<void> {
  const page = seq.page;
  const addButtons = page.getByRole('button', { name: 'Search & Add' }).filter({ visible: true }).or(page.getByRole('button', { name: 'Add Prospects', exact: true })).first();
  for (let attempt = 1; attempt <= 3; attempt++) {
    await seq.goto(`/sequence/${sequenceId}/prospects`);
    if (await addButtons.waitFor({ state: 'visible', timeout: 60_000 }).then(() => true, () => false)) return;
  }
  throw new Error(`The Prospects tab of sequence ${sequenceId} showed no add button after 3 loads of 60 s`);
}

// Records what a Zoho record page shows about the tag. The tag text is not on any record page seen so far (QA to say
// where it shows), so it is recorded for the cases file and never asserted.
export function tagAnnotation(text: string): { type: string; description: string } {
  return { type: `tag ${TAG} in the record text (not asserted, QA to say where it shows)`, description: String(hasTag(text)) };
}

// Saves the trigger's actions, but only when they differ from what this worker saved last. Most rows use the same actions
// as the row before (Contact only), and a full save costs about a minute. Only this trigger is touched, and no other
// session changes it, so the saved state is what this worker saved. A new worker (after a failed test) saves again.
let lastSaved = '';
export async function configureOnce(zoho: ZohoIntegrationPage, page: Page, trigger: string, actions: ZohoAction[]): Promise<void> {
  const key = JSON.stringify(actions);
  if (key === lastSaved) return;
  lastSaved = '';
  // configureWaiting waits for the saved message after each Deal and Task dialog (plain configure lost the last chip).
  await configureWaiting(zoho, page, trigger, actions);
  lastSaved = key;
}

// Call after a test changed the saved actions outside configureOnce (Trigger and setup 1 switches the trigger off).
export const forgetSaved = (): void => {
  lastSaved = '';
};
