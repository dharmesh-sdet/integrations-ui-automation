import { expect, test } from '../../src/fixtures/index.ts';
import { libraryTemplates } from '../../src/config/account-setup.ts';

// One-time setup of the production sequence for the Company Created smoke run
// (QA, 2026-10-15: "we have to create a new sequence with the workflow name").
// Same shape as email-bounced-smoke-sequence.spec.ts, with one step (the Move
// check picks "Step 1 - Day 1"). A production write, so it only runs with
// SETUP_SMOKE_SEQUENCE=1, creates nothing if the sequence is already in the
// list, and is never retried. It is NOT activated: this workflow sends no
// email, and an active sequence with a sender would send step 1 to the
// Mailinator prospects the Move check puts in it (the sender's 15 a day are
// shared). Sender, schedule and Stop on reply are left as the account defaults.
//   SETUP_SMOKE_SEQUENCE=1 REPORTS_DIR=reports/company-smoke-setup REPORT_OPEN=never npx playwright test tests/setup/company-created-smoke-sequence.spec.ts --project=chromium --workers=1
const NAME = 'HubSpot Company Created Smoke';
const TEMPLATE = libraryTemplates[0];

test.describe('Production setup: Company Created smoke sequence', () => {
  test.skip(process.env.SETUP_SMOKE_SEQUENCE !== '1', 'Set SETUP_SMOKE_SEQUENCE=1 to create the production sequence');
  test.use({ account: 'emailopenedprod' });

  test(`Create "${NAME}" and add step 1`, async ({ saleshandySequenceBuilder: builder }) => {
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
      console.log(`SEQUENCE_ID=${id}`);
    });
    await test.step(`Add Step 1 from the "${TEMPLATE}" library template`, async () => {
      await builder.addEmailStep(TEMPLATE, `${NAME} step 1`);
    });
    await test.step('Check the sequence is in the list', async () => {
      await builder.openList();
      expect(await builder.exists(NAME)).toBe(true);
    });
    test.info().annotations.push({ type: 'sequence id', description: id });
  });
});
