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
import { activityTests } from '../../src/flows/activity-rows.ts';
import { createFlow, fullName } from '../../src/flows/saleshandy-to-hubspot.ts';
import { untilPasses } from '../../src/utils/wait.ts';

test.use({ account: 'linkclick' });

// Name on Triggers & Activity and in Logs (seen 2026-10-09). The context calls
// it "Link Clicked in Saleshandy".
const TRIGGER = 'Link is Clicked in Saleshandy';

// Sequence "HubSpot Link Clicked QA" on the linkclick account (2 steps, 2 links
// each, Track link clicks on), set up 2026-10-09. Step 1 subject below.
const SEQUENCE_ID = '196221';
const STEP_1_SUBJECT = 'Quick question about your team';
// Developer's maximum is 1 to 1.5 minutes for a click to show in Saleshandy.
const CLICK_TIMEOUT_MS = 3 * 60_000;

// Shared Saleshandy-to-HubSpot steps; Link Clicked's own event is the click.
const flow = createFlow({
  trigger: TRIGGER,
  sequenceId: SEQUENCE_ID,
  csv: 'hubspot/link-clicked.csv',
  fireEvent: async ({ sequence, mailinator }, row) => {
    await test.step('Click the first link in the email (Mailinator)', async () => {
      await mailinator!.clickFirstLink(row['Email'], STEP_1_SUBJECT);
    });
    await test.step('Wait until Saleshandy counts the click', async () => {
      await untilPasses(
        `Clicked count for ${row['Email']} did not reach 1`,
        async () => expect(await sequence.clickedCount(SEQUENCE_ID, fullName(row)), 'Clicked').toBeGreaterThanOrEqual(1),
        CLICK_TIMEOUT_MS,
      );
    });
  },
});

activityTests(flow, 'Link Clicked in Saleshandy');
