// Scenarios: test-cases/hubspot/reply-received.md (Regression).
// Data: test-data/hubspot/reply-received.csv, one row per scenario (Scenario
// column). Used rows are replaced by new people before every run
// (src/data/global-setup.ts).
// Shared steps live in src/flows/saleshandy-to-hubspot.ts and the activity
// rows in src/flows/activity-rows.ts; this file adds only Reply Received's
// trigger event (Mark as replied).
import { expect, test } from '../../src/fixtures/index.ts';
import { CREATE_NOTE, RECORD_EMAIL, UPDATE_CONTACT, UPDATE_DEAL, activityTests } from '../../src/flows/activity-rows.ts';
import { createFlow, dealUpdateConfig, daysFromToday, fullName } from '../../src/flows/saleshandy-to-hubspot.ts';
import { untilPasses } from '../../src/utils/wait.ts';

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
  // QA 2026-10-14: when the sender has used its daily cap the step 1 email
  // shows "Scheduled, Tomorrow"; Send now sends it (as Link Clicked does).
  // The Reply note reads "Step: 1 (Variant A)" and "Prospect email: <email>"
  // (seen on a contact 2026-10-12), unlike the shared default.
  noteContains: (row, step) => [`Step: ${step} (Variant A)`, `Prospect email: ${row['Email']}`],
  // QA 2026-10-09: second-reply rows click Mark as replied again on the same
  // step 1 email (no step 2 row exists after a reply), so `step` is ignored.
  fireEvent: async ({ sequence }, row) => {
    await test.step('Mark the step 1 email as replied', async () => {
      await sequence.markAsReplied(SEQUENCE_ID, fullName(row));
    });
  },
});

// Create a Contact 6 (second link clicked) is a Link Clicked row; a reply has
// no second link, and it is not in test-cases/hubspot/reply-received.md.
activityTests(flow, 'Reply is received in Saleshandy', { skip: ['Create a Contact in HubSpot > 6'] });

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
    // The test creates the deal with HubSpot's default close date (end of month).
    // Closing Date 0 Days sets no close date (Create a deal 1 expects '--'), so the
    // first reply must leave this value as it is.
    const closeDateBefore = (await hubspotDeals.summary(dealId)).closeDate;
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    test.setTimeout(45 * 60_000); // two Update a Deal logs, about 7.5 minutes each, plus the sends
    await test.step('First reply: new log entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
    });
    await test.step('First reply (0 Days): close date is unchanged', async () => {
      await expect(async () => {
        expect((await hubspotDeals.summary(dealId)).closeDate, 'Close Date').toBe(closeDateBefore);
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

  // ---- Second reply, paired with Update a Contact (written 2026-10-13) ----
  // Same setup as Create a Note 2 / Record (log) 4, then Mark as replied again
  // on the same step 1 email (no step 2 row exists after a reply). Expected:
  // a new, separate note or logged email next to the first one.
  const UPDATE_CONTACT_VALUES = { 'Update Lead Status': 'Connected', 'Update Lead Lifecycle': 'Sales Qualified Lead' };

  const secondReplyPaired = (title: string, scenario: string, companion: string, needle: (row: Record<string, string>) => string) => {
    test(title, async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor(scenario);
      await test.step(`Select Update a Contact (Connected, Sales Qualified Lead) and ${companion}`, async () => {
        await flow.useOnly(saleshandyIntegration, UPDATE_CONTACT, UPDATE_CONTACT_VALUES, []);
        // The dialog's own save toast is still up for a moment; wait for it so the next one is the page Save's.
        await expect(saleshandyIntegration.savedToast()).toBeHidden({ timeout: 15_000 });
        await saleshandyIntegration.selectActivity(TRIGGER, companion);
        await saleshandyIntegration.save();
        await expect(saleshandyIntegration.savedToast(), 'save confirmation').toBeVisible();
      });
      let contactId = '';
      await test.step('Create the contact in HubSpot', async () => {
        contactId = await hubspotContacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      test.setTimeout(20 * 60_000);
      await test.step('First reply: new log entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known);
      });
      // How often the text shows on the contact's Activities tab, waiting until it shows at least `atLeast` times.
      const countOnContact = async (text: string, atLeast: number): Promise<number> => {
        let count = 0;
        await untilPasses(`"${text}" not found ${atLeast} time(s) on the HubSpot contact ${contactId}`, async () => {
          const page = await hubspotContacts.activitiesText('0-1', contactId);
          count = page.split(text).length - 1;
          expect(count, `"${text}" on the contact`).toBeGreaterThanOrEqual(atLeast);
        });
        return count;
      };
      const marker = needle(row);
      let first = 0;
      await test.step('First reply: the contact shows the note or logged email', async () => {
        first = await countOnContact(marker, 1);
      });
      const knownAfterFirst = new Set((await saleshandyIntegration.logEntries(TRIGGER)).map((e) => e.id));
      await test.step('Mark the same step 1 email as replied again', async () => {
        await saleshandySequence.markAsReplied(SEQUENCE_ID, fullName(row));
      });
      await test.step('Second reply: new log entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, knownAfterFirst);
      });
      await test.step('Second reply: a new, separate entry is on the contact next to the first', async () => {
        await countOnContact(marker, first + 1);
      });
    });
  };

  test.describe('Create a Note and Record (log) after a second reply', () => {
    secondReplyPaired(
      'Create a Note in HubSpot > 5: Pairing from row 2, second reply',
      'Create a Note in HubSpot > 5',
      CREATE_NOTE,
      () => 'Note created via Saleshandy',
    );
    secondReplyPaired(
      'Record (log) an email activity in HubSpot > 7: Pairing from row 4, second reply',
      'Record (log) an email activity in HubSpot > 7',
      RECORD_EMAIL,
      (row) => flow.loggedEmailContains(row, 1)[0],
    );
  });
});
