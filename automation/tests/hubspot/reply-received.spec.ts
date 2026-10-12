// Scenarios: test-cases/hubspot/reply-received.md (Regression).
// Data: test-data/hubspot/reply-received.csv, one row per scenario (Scenario
// column). Used rows are replaced by new people before every run
// (src/data/global-setup.ts).
// Shared steps live in src/flows/saleshandy-to-hubspot.ts and the activity
// rows in src/flows/activity-rows.ts; this file adds only Reply Received's
// trigger event (Mark as replied).
import { expect, test } from '../../src/fixtures/index.ts';
import { UPDATE_DEAL, activityTests } from '../../src/flows/activity-rows.ts';
import { createFlow, dealUpdateConfig, daysFromToday, fullName } from '../../src/flows/saleshandy-to-hubspot.ts';

test.use({ account: 'replyreceived' });

// Name on Triggers & Activity and in Logs (seen 2026-10-09). The context calls
// it "Reply is received in Saleshandy".
const TRIGGER = 'Reply is Received in Saleshandy';

// Sequence "HubSpot Reply Received QA" on the replyreceived account (2 steps,
// Variant A only), set up 2026-10-09.
const SEQUENCE_ID = '196293';

// Shared Saleshandy-to-HubSpot steps; Reply Received's own event is Mark as
// replied. After a reply no Step 2 row appears (stop on reply), so the event
// is always on the step 1 email.
const flow = createFlow({
  trigger: TRIGGER,
  sequenceId: SEQUENCE_ID,
  csv: 'hubspot/reply-received.csv',
  // QA 2026-10-09: second-reply rows click Mark as replied again on the same
  // step 1 email (no step 2 row exists after a reply), so `step` is ignored.
  fireEvent: async ({ sequence }, row) => {
    await test.step('Mark the step 1 email as replied', async () => {
      await sequence.markAsReplied(SEQUENCE_ID, fullName(row));
    });
  },
});

activityTests(flow, 'Reply is received in Saleshandy');

// Second-reply rows live here (not in activity-rows.ts) until the shared rows
// they pair with exist there. Update a deal 3 needs row 1's flow, then the
// Extra Configuration changed and Mark as replied clicked again on the same
// step 1 email (QA 2026-10-09).
// Update a Deal logs stay RUNNING for about 7.5 minutes (seen 2026-10-12).
const UPDATE_DEAL_LOG_TIMEOUT_MS = 12 * 60_000;

test.describe('Reply is received in Saleshandy: second reply', () => {
  test('Update a deal in HubSpot > 3: Deal updated, Extra Configuration changed, second reply', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
    const row = flow.rowFor('Update a deal in HubSpot > 3');
    await test.step('Select only Update a Deal (0 Days)', async () => {
      await flow.useOnly(saleshandyIntegration, UPDATE_DEAL, dealUpdateConfig('0'), []);
    });
    let dealId = '';
    await test.step('Create the contact in HubSpot with 1 deal', async () => {
      const contactId = await hubspotContacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });
      const deal = flow.deals.find((d) => d['Contact Email'] === row['Email']);
      if (!deal) throw new Error(`No deal for ${row['Email']} in the -deals CSV`);
      dealId = await hubspotDeals.createDealForContact(contactId, { name: deal['Deal Name'], amount: deal['Amount'] });
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    test.setTimeout(45 * 60_000); // two Update a Deal logs, about 7.5 minutes each, plus the sends
    await test.step('First reply: new log entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
    });
    await test.step('First reply: close date is today', async () => {
      await expect(async () => {
        expect((await hubspotDeals.summary(dealId)).closeDate, 'Close Date').toBe(daysFromToday(0));
      }).toPass({ timeout: 60_000 });
    });
    const knownAfterFirst = new Set((await saleshandyIntegration.logEntries(TRIGGER)).map((e) => e.id));
    await test.step('Change Extra Configuration: Closing Date 51 Days', async () => {
      await flow.useOnly(saleshandyIntegration, UPDATE_DEAL, dealUpdateConfig('51'), []);
    });
    await test.step('Mark the same step 1 email as replied again', async () => {
      await saleshandySequence.markAsReplied(SEQUENCE_ID, fullName(row));
    });
    await test.step('Second reply: new log entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, knownAfterFirst, UPDATE_DEAL_LOG_TIMEOUT_MS);
    });
    await test.step('Second reply: close date is 51 days from today', async () => {
      await expect(async () => {
        expect((await hubspotDeals.summary(dealId)).closeDate, 'Close Date').toBe(daysFromToday(51));
      }).toPass({ timeout: 60_000 });
    });
  });
});
