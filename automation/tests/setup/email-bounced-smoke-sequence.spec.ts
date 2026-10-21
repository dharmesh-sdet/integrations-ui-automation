import { expect, test } from '../../src/fixtures/index.ts';
import { libraryTemplates } from '../../src/config/account-setup.ts';

// One-time setup of the production sequence for the Email Bounced smoke run
// (QA, 2026-10-14: "you will create the sequence"). A production write, so it
// only runs with SETUP_SMOKE_SEQUENCE=1, creates nothing if the sequence is
// already in the list, and is never retried.
//   SETUP_SMOKE_SEQUENCE=1 REPORT_OPEN=never npx playwright test tests/setup/email-bounced-smoke-sequence.spec.ts --project=chromium --workers=1
const NAME = 'HubSpot Email Bounced Smoke';
// Step 1 only: the smoke checks bounce the step 1 email (Note and Record use step 1).
const TEMPLATE = libraryTemplates[0];

test.describe('Production setup: Email Bounced smoke sequence', () => {
  test.skip(process.env.SETUP_SMOKE_SEQUENCE !== '1', 'Set SETUP_SMOKE_SEQUENCE=1 to create the production sequence');
  test.use({ account: 'emailopenedprod' });

  test(`Create "${NAME}", add step 1 and activate it`, async ({ saleshandySequenceBuilder: builder, saleshandySequence }) => {
    await test.step('Open the Sequences list', async () => {
      await builder.openList();
    });
    if (await builder.exists(NAME)) {
      test.info().annotations.push({ type: 'skipped', description: `${NAME} already exists, left as it is` });
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
