import { expect, test, type Page } from '@playwright/test';
import type { Row } from '../data/csv.ts';
import { markUsed } from '../data/used.ts';
import type { MailinatorPage } from '../pages/mailinator.page.ts';
import type { SaleshandySequencePage } from '../pages/saleshandy/sequence.page.ts';
import { untilPasses, staysTrue } from '../utils/wait.ts';
import { fullName } from './saleshandy-to-salesforce.ts';
import { STEP_1_SUBJECT, STEP_2_SUBJECT } from './salesforce-link-clicked.ts';

// Steps only the Salesforce Prospect is Unsubscribed spec needs (AL-4137). The Logs tab is never opened (QA,
// 2026-11-05): every check reads the Prospects tab or Salesforce.
export const TRIGGER = 'Prospect is Unsubscribed in Saleshandy';
export { STEP_1_SUBJECT, STEP_2_SUBJECT };
// Texts of the unsubscribe page (seen on staging for Pipedrive, 2026-10-26).
export const UNSUBSCRIBED_TEXT = 'You will no longer receive emails from us';
export const SUBSCRIBED_TEXT = 'You have successfully subscribed and added to our list for future communication';

// The unsubscribe registers only when the link is used long enough after the email was delivered: 20 s stayed Active,
// 93 s registered (Zoho staging 2026-11-04, HubSpot and Pipedrive production). Override with UNSUB_LINK_WAIT_MS.
export const LINK_WAIT_MS = Number(process.env.UNSUB_LINK_WAIT_MS ?? 93_000);
// How long a record may take to show in Salesforce. A record missing after this is reported to QA.
export const RECORD_TIMEOUT_MS = Number(process.env.UNSUB_RECORD_TIMEOUT_MS ?? 3 * 60_000);
// "Nothing happens" rows look 15 s after the action, then every 10 s, this many times.
export const QUIET_CHECKS = Number(process.env.UNSUB_QUIET_CHECKS ?? 4);

type Pages = { saleshandySequence: SaleshandySequencePage; mailinator: MailinatorPage };

// The Prospects tab is a skeleton for up to a minute on staging, so open it until an add button shows.
async function prospectsTabReady(seq: SaleshandySequencePage, sequenceId: string): Promise<void> {
  const page = seq.page;
  const addButtons = page.getByRole('button', { name: 'Search & Add' }).filter({ visible: true }).or(page.getByRole('button', { name: 'Add Prospects', exact: true })).first();
  for (let attempt = 1; attempt <= 3; attempt++) {
    await seq.goto(`/sequence/${sequenceId}/prospects`);
    if (await addButtons.waitFor({ state: 'visible', timeout: 60_000 }).then(() => true, () => false)) return;
  }
  throw new Error(`The Prospects tab of sequence ${sequenceId} showed no add button after 3 loads of 60 s`);
}

export type SendOptions = {
  sequenceId: string;
  row: Row;
  csv: string;
  // 2: send step 1, move the prospect to step 2 and send it. The unsubscribe is always the last action, because an
  // unsubscribed prospect cannot be added to a sequence or moved to another step (QA, 2026-11-05).
  step?: number;
};

// Adds the new prospect to the sequence and sends the step with Send now. No unsubscribe yet.
export async function addAndSend(pages: Pages, options: SendOptions): Promise<void> {
  const { sequenceId, row, csv, step = 1 } = options;
  const seq = pages.saleshandySequence;
  const name = fullName(row);
  await test.step(`Add ${name} to the sequence and send step 1`, async () => {
    await prospectsTabReady(seq, sequenceId);
    await seq.createAndAddProspect(sequenceId, row);
    markUsed(csv, row['Email']);
    await seq.sendNow(sequenceId, name, 1, row['Email']);
  });
  if (step > 1) {
    await test.step(`Move ${name} to step ${step} and send it`, async () => {
      await seq.moveToStep(sequenceId, row['Email'], step);
      await seq.sendNow(sequenceId, name, step, row['Email']);
    });
  }
}

// Opens "Unsubscribe here" of the delivered email and checks the page text. Returns the unsubscribe page, which stays
// open for "Subscribe here". `waitMs` 0 is for a second open of a link that already registered.
export async function openLink(mailinator: MailinatorPage, row: Row, step = 1, waitMs = LINK_WAIT_MS): Promise<Page> {
  const subject = step === 1 ? STEP_1_SUBJECT : STEP_2_SUBJECT;
  const page = await mailinator.openUnsubscribeLink(row['Email'], subject, waitMs);
  await expect(page.getByText(UNSUBSCRIBED_TEXT), 'The unsubscribe page').toBeVisible({ timeout: 30_000 });
  return page;
}

// Unsubscribe by the real link. The prospect must already be added and sent.
export async function unsubscribeByLink(pages: Pages, options: SendOptions, waitMs = LINK_WAIT_MS): Promise<Page> {
  const { sequenceId, row, step = 1 } = options;
  let page!: Page;
  await test.step(`Open the unsubscribe link of the step ${step} email in Mailinator`, async () => {
    page = await openLink(pages.mailinator, row, step, waitMs);
  });
  await test.step('The Prospects tab shows Unsubscribed', async () => {
    await pages.saleshandySequence.expectProspectStatus(sequenceId, row['Email'], 'Unsubscribed');
  });
  return page;
}

// Add, send and unsubscribe by the link, in one go. Returns the unsubscribe page.
export async function sendAndUnsubscribeByLink(pages: Pages, options: SendOptions): Promise<Page> {
  await addAndSend(pages, options);
  return unsubscribeByLink(pages, options);
}

// Add, send and Mark as Unsubscribe on the Prospects tab.
export async function sendAndMarkUnsubscribed(pages: Pages, options: SendOptions): Promise<void> {
  await addAndSend(pages, options);
  await test.step('Prospects tab > tick the prospect > Mark as Unsubscribe', async () => {
    await pages.saleshandySequence.markAsUnsubscribed(options.sequenceId, options.row['Email']);
  });
}

// A record the workflow must make or change. Checks Salesforce 15 s after the action, then every 10 s. A record that
// is still missing after RECORD_TIMEOUT_MS fails the row with a message for QA: the Logs tab cannot be used to see why.
export async function recordAppears(what: string, check: () => Promise<void>): Promise<void> {
  try {
    await untilPasses(what, check, RECORD_TIMEOUT_MS);
  } catch (e) {
    throw new Error(`Report to QA, not a script failure until QA has looked: ${what} did not show in Salesforce within ${RECORD_TIMEOUT_MS / 1000} s. ${(e as Error).message}`);
  }
}

// A record the workflow must not make or change. Looks QUIET_CHECKS times: 15 s after the action, then every 10 s.
export async function nothingHappens(page: Page, check: () => Promise<void>): Promise<void> {
  await staysTrue(page, check, QUIET_CHECKS);
}

// For rows that only record what happened: true when `check` passes within `ms`, never throws.
export async function appearsWithin(ms: number, check: () => Promise<void>): Promise<boolean> {
  return untilPasses('record', check, ms).then(() => true, () => false);
}
