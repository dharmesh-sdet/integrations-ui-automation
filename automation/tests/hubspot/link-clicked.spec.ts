// Scenarios: test-cases/hubspot/link-clicked.md (Regression).
// Data: test-data/hubspot/link-clicked.csv, one row per scenario (Scenario
// column). Used rows are replaced by new people before every run
// (src/data/global-setup.ts), so each run creates fresh prospects and contacts.
// Rows with "Extra Configuration skipped" come first: saved Extra Configuration
// can never be cleared again (QA, 2026-10-09), so they skip themselves on an
// account where the activity was already configured.
// Shared steps live in src/flows/saleshandy-to-hubspot.ts; this file adds only
// Link Clicked's trigger event (the Mailinator click) and its rows.
import { expect, test } from '../../src/fixtures/index.ts';
import { UPDATE_CONTACT, activityTests } from '../../src/flows/activity-rows.ts';
import { createFlow, fullName } from '../../src/flows/saleshandy-to-hubspot.ts';

test.use({ account: 'linkclick' });

// Name on Triggers & Activity and in Logs (seen 2026-10-09). The context calls
// it "Link Clicked in Saleshandy".
const TRIGGER = 'Link is Clicked in Saleshandy';

// Sequence "HubSpot Link Clicked QA" on the linkclick account (2 steps, 2 links
// each, Track link clicks on), set up 2026-10-09. Step 1 subject below.
const SEQUENCE_ID = '196221';
const STEP_1_SUBJECT = 'Quick question about your team';
// Step 2 is a same-thread follow-up: its subject is not seen yet (2026-10-12),
// so "Re: " is optional. Mailinator lists the newest first.
const STEP_2_SUBJECT = new RegExp(`^(Re: )?${STEP_1_SUBJECT}$`);
// Developer's maximum is 1 to 1.5 minutes for a click to show in Saleshandy.
const CLICK_TIMEOUT_MS = 3 * 60_000;
// QA (2026-10-12): after a click wait 20 to 30 s, then hard-refresh Saleshandy
// back and forth until Clicked goes up; only then click the next link.
const CLICK_SETTLE_MS = 25_000;
const CLICK_REFRESH_MS = 5_000;

// Shared Saleshandy-to-HubSpot steps; Link Clicked's own event is the click.
const flow = createFlow({
  trigger: TRIGGER,
  sequenceId: SEQUENCE_ID,
  csv: 'hubspot/link-clicked.csv',
  emailSubject: STEP_1_SUBJECT,
  // The logged email card shows only its header and body, never the subject
  // (seen 2026-10-13), so check the header. 2026-10-14: HubSpot shows it as
  // "Logged email by Link Clicked via Saleshandy" (QA picked this header), no
  // longer "Logged email with <name> created via Saleshandy".
  loggedEmailContains: () => ['Logged email by Link Clicked via Saleshandy'],
  // AL-4120: the note's "Click Count:" line was empty. After the first click
  // (step 1) it must show 1.
  noteContains: (row, step) => [`Step: ${step}`, 'Variant: A', `Prospect Email: ${row['Email']}`, ...(step === 1 ? ['Click Count: 1'] : [])],
  step2Events: true,
  secondEventRows: true,
  // step 2: Send now first (days away); link: 0 = first link, 1 = second.
  fireEvent: async ({ sequence, mailinator }, row, step, link = 0) => {
    if (step > 1) {
      // Step 2 is on a later day: its Emails row does not exist until the
      // prospect is moved to the step (Email Opened walkthrough, 2026-10-13).
      await test.step(`Move the prospect to step ${step}`, async () => {
        await sequence.moveToStep(SEQUENCE_ID, row['Email'], step);
      });
      await test.step(`Send now on step ${step}`, async () => {
        await sequence.ensureSent(SEQUENCE_ID, fullName(row), step);
      });
    }
    const before = await sequence.clickedCount(SEQUENCE_ID, fullName(row), step);
    await test.step(`Click link ${link + 1} in the step ${step} email (Mailinator)`, async () => {
      await mailinator!.clickFirstLink(row['Email'], step > 1 ? STEP_2_SUBJECT : STEP_1_SUBJECT, link);
    });
    await test.step('Wait until Saleshandy counts the click (refresh the Emails tab)', async () => {
      await sequence.page.waitForTimeout(CLICK_SETTLE_MS);
      await expect(async () => {
        expect(await sequence.clickedCount(SEQUENCE_ID, fullName(row), step), 'Clicked').toBeGreaterThanOrEqual(before + 1);
      }, `Clicked count for ${row['Email']} did not reach ${before + 1} (gave up after ${CLICK_TIMEOUT_MS / 1000} seconds)`).toPass({ timeout: CLICK_TIMEOUT_MS, intervals: [CLICK_REFRESH_MS] });
    });
  },
});

activityTests(flow, 'Link Clicked in Saleshandy');

// Baseline 2 (written 2026-10-14): the click itself, before any HubSpot result.
// Update a Contact (the saved Connected, Sales Qualified Lead) is the only activity selected: with the contact not in
// HubSpot it creates and updates nothing, so the run has no side effect.
// Purple icon: on the Prospects tab the third stats icon sits in a
// span-wrapper that gets "purple-14" once a link was clicked (seen 2026-10-14).
test.describe('Link Clicked in Saleshandy', () => {
  test('Trigger behavior (baseline) > 2: Prospect received the step 1 email', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator }) => {
    const row = flow.rowFor('Trigger behavior (baseline) > 2');
    await test.step('Select only Update a Contact: Connected, Sales Qualified Lead (already saved on this account)', async () => {
      await flow.useOnly(saleshandyIntegration, UPDATE_CONTACT, { 'Update Lead Status': 'Connected', 'Update Lead Lifecycle': 'Sales Qualified Lead' }, []);
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await test.step('Prospects tab: the link clicked icon is purple', async () => {
      await saleshandySequence.goto(`/sequence/${SEQUENCE_ID}/prospects`);
      await saleshandySequence.closeSidebar();
      const page = saleshandySequence.page;
      await page.locator('.sequence-prospect-search-bar-and-filter input').fill(row['Email']);
      await page.keyboard.press('Enter');
      const prospect = page.getByRole('row').filter({ hasText: row['Email'].slice(0, 14) });
      await expect(async () => {
        await page.reload();
        await page.locator('.sequence-prospect-search-bar-and-filter input').fill(row['Email']);
        await page.keyboard.press('Enter');
        await expect(prospect.locator('.span-wrapper.purple-14'), 'purple link clicked icon').toHaveCount(1);
      }).toPass({ timeout: 90_000, intervals: [5_000] });
    });
    await test.step('Logs: a new log entry for the trigger appears and finishes', async () => {
      const statuses = await flow.newLogsFinished(saleshandyIntegration, known);
      expect(statuses.length, 'new log entries for this trigger').toBeGreaterThan(0);
    });
  });
});
