import { expect, test } from '../../src/fixtures/index.ts';
import { libraryTemplates } from '../../src/config/account-setup.ts';

// One-time setup of the sequence for the Pipedrive workflow tests on the gpipedrive account
// (QA, 2026-10-24). Two steps (the Create a Lead row 3 sends step 2), no A/B variants, sender
// left as the account default. Creates nothing if the sequence is already in the list.
//   SETUP_SEQUENCE=1 REPORT_OPEN=never npx playwright test tests/setup/pipedrive-sequence.spec.ts --project=chromium --workers=1
// The id printed at the end (SEQUENCE_ID=...) goes into tests/pipedrive/email-sent.spec.ts.
const NAME = 'Pipedrive Regression';

test.describe('Setup: Pipedrive sequence', () => {
  test.skip(process.env.SETUP_SEQUENCE !== '1', 'Set SETUP_SEQUENCE=1 to create the sequence');
  test.use({ account: 'gpipedrive' });

  test(`Create "${NAME}", add steps 1 and 2 and activate it`, async ({ saleshandySequenceBuilder: builder, saleshandySequence }) => {
    await test.step('Open the Sequences list', async () => {
      await builder.openList();
    });
    if (await builder.exists(NAME)) {
      // A first run that stopped before the last step leaves a Draft: activate it (no-op when Active).
      const existing = await builder.idOf(NAME);
      // The first run also stopped before Step 2 (seen 2026-10-26: the Steps tab lists only Step 1, so
      // the Add To Sequence dialog offers no "Step 2 - Day" and the step-2 rows fail), so add it here.
      await test.step('Add Step 2 when the sequence has only Step 1', async () => {
        await builder.goto(`/sequence/${existing}/steps`);
        const addStep = builder.page.getByRole('button', { name: /Add Step/ }).first();
        await addStep.waitFor({ timeout: 30_000 });
        if (await builder.page.getByText(`${NAME} - Step 2`).count()) return;
        await addStep.click();
        await builder.addEmailStep(libraryTemplates[1], `${NAME} - Step 2`);
      });
      await saleshandySequence.resumeSequence(existing);
      test.info().annotations.push({ type: 'sequence id', description: existing });
      console.log(`SEQUENCE_ID=${existing}`);
      return;
    }
    let id = '';
    await test.step(`Create the sequence "${NAME}"`, async () => {
      id = await builder.create(NAME);
    });
    await test.step(`Add Step 1 from the "${libraryTemplates[0]}" library template`, async () => {
      await builder.addEmailStep(libraryTemplates[0], `${NAME} - Step 1`);
    });
    await test.step(`Add Step 2 from the "${libraryTemplates[1]}" library template`, async () => {
      await builder.page.getByRole('button', { name: /Add Step/ }).first().click();
      await builder.addEmailStep(libraryTemplates[1], `${NAME} - Step 2`);
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
