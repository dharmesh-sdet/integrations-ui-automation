import { expect, test } from '@playwright/test';
import type { Row } from '../data/csv.ts';
import { markUsed } from '../data/used.ts';
import type { SalesforceIntegrationPage } from '../pages/saleshandy/salesforce-integration.page.ts';
import type { SaleshandySequencePage } from '../pages/saleshandy/sequence.page.ts';
import { staysTrue } from '../utils/wait.ts';
import { fullName } from './saleshandy-to-salesforce.ts';
import { knownLogIds, readNewLog, type ClickResult } from './salesforce-link-clicked.ts';

// Steps only the Salesforce Email Bounced spec needs (AL-4138). The Logs helpers are shared with
// salesforce-link-clicked.ts: they take the trigger name, so they read the Bounced entries here.
export const TRIGGER = 'Email is Bounced in Saleshandy';
export const EMAIL_SENT_TRIGGER = 'Email Sent from Saleshandy';
// Subjects of the two steps of "Salesforce Email Bounced Regression", built by
// tests/setup/salesforce-email-bounced-sequence.spec.ts.
export const STEP_1_SUBJECT = 'Quick question about your outreach';
export const STEP_2_SUBJECT = 'Following up on my last note';

export type BounceResult = ClickResult;

type Pages = {
  salesforceIntegration: SalesforceIntegrationPage;
  saleshandySequence: SaleshandySequencePage;
};

type BounceOptions = {
  sequenceId: string;
  row: Row;
  csv: string;
  usedEmail: string;
  // 1 = bounce the step 1 row. 2 = move the prospect to step 2 first and bounce that row (the step 2 email is
  // not sent; Mark as bounced works on a scheduled row).
  step?: number;
  // Pause the sequence before the bounce (it was Active when the prospect was added).
  pauseFirst?: boolean;
};

// The real-bounce address: name@<company>.mailinator.com (QA 2026-10-12, used on HubSpot, Zoho and Pipedrive).
// A plain @mailinator.com never bounces.
export function realBounceEmail(row: Row): string {
  const company = row['Company'].normalize('NFKD').replace(/[^A-Za-z]/g, '').toLowerCase();
  if (!company) throw new Error('A real-bounce prospect needs a company (an empty one gives "@.mailinator.com")');
  return row['Email'].replace(/@mailinator\.com$/i, `@${company}.mailinator.com`);
}

// Adds the prospect to the sequence and retires its CSV row.
export async function addProspect(pages: Pages, options: BounceOptions): Promise<void> {
  const { sequenceId, row, csv, usedEmail } = options;
  await test.step(`Add ${fullName(row)} to the sequence`, async () => {
    await pages.saleshandySequence.createAndAddProspect(sequenceId, row);
    markUsed(csv, usedEmail);
  });
}

// Marks the prospect's email as bounced: add, optionally move to step 2 or pause the sequence, then
// Emails tab > row > Actions > Mark as bounced. Send now is not needed.
export async function markBounced(pages: Pages, options: BounceOptions): Promise<void> {
  const { sequenceId, row, step = 1, pauseFirst = false } = options;
  const name = fullName(row);
  await addProspect(pages, options);
  if (step > 1) {
    await test.step(`Move ${name} to step ${step} (not sent)`, async () => {
      await pages.saleshandySequence.moveToStep(sequenceId, row['Email'], step);
    });
  }
  if (pauseFirst) {
    await test.step('Pause the sequence', async () => {
      await pages.saleshandySequence.pauseSequence(sequenceId);
    });
  }
  try {
    await test.step(`Mark the step ${step} email of ${name} as bounced`, async () => {
      await pages.saleshandySequence.markAsBounced(sequenceId, name, step, row['Email']);
    });
  } finally {
    // The next rows need an Active sequence, also after a failure here.
    if (pauseFirst) {
      await test.step('Activate the sequence again', async () => {
        await pages.saleshandySequence.resumeSequence(sequenceId);
      });
    }
  }
}

// A real bounce: add, Send now on step 1, wait for Saleshandy to set Bounced.
export async function sendAndWaitForBounce(pages: Pages, options: BounceOptions): Promise<void> {
  const { sequenceId, row } = options;
  const name = fullName(row);
  await addProspect(pages, options);
  await test.step(`Send step 1 to ${row['Email']}`, async () => {
    await pages.saleshandySequence.sendNow(sequenceId, name, 1);
  });
  await test.step('Wait for the email to show Bounced', async () => {
    await pages.saleshandySequence.waitUntilBounced(sequenceId, name, 1, 6 * 60_000);
  });
}

// One bounce: read the known Logs ids, bounce (manual or real), read the new Logs entry.
export async function bounceAndReadLog(pages: Pages, options: BounceOptions & { real?: boolean }): Promise<BounceResult> {
  const known = await knownLogIds(pages, TRIGGER);
  if (options.real) await sendAndWaitForBounce(pages, options);
  else await markBounced(pages, options);
  const first = await readNewLog(pages, known, TRIGGER, options.row);
  if (!options.real) return first;
  // One real bounce can make two Logs entries (seen on HubSpot 2026-10-12 and on Salesforce 2026-11-05, one of
  // them Error with DUPLICATES_DETECTED). QA default: log it, do not fail the row on it. All new entries are
  // recorded and the row passes when one of them is Success.
  return test.step('Wait 90 s and read every new Bounced Logs entry of the real bounce', async () => {
    await pages.saleshandySequence.page.waitForTimeout(90_000);
    await pages.salesforceIntegration.openLogs();
    await pages.salesforceIntegration.refreshLogs();
    const fresh = (await pages.salesforceIntegration.logEntries(TRIGGER)).filter((e) => !known.has(e.id));
    test.info().annotations.push({ type: 'All new Logs rows of the real bounce', description: fresh.map((e) => e.text).join(' || ') });
    test.info().annotations.push({ type: 'New Logs rows with Error', description: String(fresh.filter((e) => e.status === 'Error').length) });
    const ok = fresh.find((e) => e.status === 'Success');
    return { ...first, status: ok ? 'Success' : first.status, newEntries: fresh.length };
  });
}

// For "nothing should be logged": the email is bounced, but no new Bounced entry shows.
export async function bounceAndExpectNoLog(pages: Pages, options: BounceOptions): Promise<void> {
  const known = await knownLogIds(pages, TRIGGER);
  await markBounced(pages, options);
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
}
