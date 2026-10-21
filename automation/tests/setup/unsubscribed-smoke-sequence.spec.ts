import { expect, test } from '../../src/fixtures/index.ts';
import { libraryTemplates } from '../../src/config/account-setup.ts';

// One-time setup of the production sequence for the Prospect is Unsubscribed
// smoke run. Same shape as email-bounced-smoke-sequence.spec.ts: one step
// (the staging sequence is also one step, no A/B variants), sender and
// schedule left as the account defaults. A production write, so it only runs
// with SETUP_SMOKE_SEQUENCE=1, creates nothing if the sequence is already in
// the list, and is never retried. Like the staging sequence, this one needs
// "Unsubscribe as Link" saved: the smoke checks use the real link, since
// Mark as Unsubscribe (UI) does not work on production (QA, 2026-10-19; set
// by QA on the production sequence, see 06-unsubscribed.md).
//   SETUP_SMOKE_SEQUENCE=1 REPORT_OPEN=never npx playwright test tests/setup/unsubscribed-smoke-sequence.spec.ts --project=chromium --workers=1
const NAME = 'HubSpot Prospect Unsubscribed Smoke';
// Step 1 only: Mark as Unsubscribe works on the step 1 email once Sent.
const TEMPLATE = libraryTemplates[0];

test.describe('Production setup: Prospect is Unsubscribed smoke sequence', () => {
  test.skip(process.env.SETUP_SMOKE_SEQUENCE !== '1', 'Set SETUP_SMOKE_SEQUENCE=1 to create the production sequence');
  test.use({ account: 'emailopenedprod' });

  test(`Create "${NAME}", add step 1 and activate it`, async ({ saleshandySequenceBuilder: builder, saleshandySequence }) => {
    await test.step('Open the Sequences list', async () => {
      await builder.openList();
    });
    if (await builder.exists(NAME)) {
      test.info().annotations.push({ type: 'skipped', description: `${NAME} already exists, left as it is` });
      await builder.openExisting(NAME);
      console.log(`SEQUENCE_ID=${builder.currentSequenceId()}`);
      return;
    }
    let id = '';
    await test.step(`Create the sequence "${NAME}"`, async () => {
      id = await builder.create(NAME);
    });
    await test.step(`Add Step 1 from the "${TEMPLATE}" library template`, async () => {
      await builder.addEmailStep(TEMPLATE, `${NAME} step 1`);
    });
    await test.step('Activate the sequence', async () => {
      await saleshandySequence.resumeSequence(id);
    });
    await test.step('Check the sequence is in the list', async () => {
      await builder.openList();
      expect(await builder.exists(NAME)).toBe(true);
    });
    test.info().annotations.push({ type: 'sequence id', description: id });
    console.log(`SEQUENCE_ID=${id}`);
  });
});
