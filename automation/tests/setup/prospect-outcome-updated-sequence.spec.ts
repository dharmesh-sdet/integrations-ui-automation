import { expect, test } from '../../src/fixtures/index.ts';
import { libraryTemplates } from '../../src/config/account-setup.ts';

// One-time setup of the sequence for the Salesforce "Prospect Outcome is updated in
// Saleshandy" tests (AL-4134) on the sfoutcomeupdated account. One step, no A/B
// variants, sender left as the account default. Creates nothing if the sequence is
// already in the list; the id is printed either way (SEQUENCE_ID=...) and
// scripts/run-prospect-outcome-updated.sh saves it for the spec.
//   SETUP_SEQUENCE=1 npx playwright test tests/setup/prospect-outcome-updated-sequence.spec.ts --project=chromium --workers=1
const NAME = 'Salesforce Prospect Outcome Regression';

test.describe('Setup: Salesforce Prospect Outcome sequence', () => {
  test.skip(process.env.SETUP_SEQUENCE !== '1', 'Set SETUP_SEQUENCE=1 to create the sequence');
  test.use({ account: 'sfoutcomeupdated' });

  test(`Create "${NAME}", add step 1 and activate it`, async ({ saleshandySequenceBuilder: builder, saleshandySequence }) => {
    await test.step('Open the Sequences list', async () => {
      await builder.openList();
    });
    let id = '';
    if (await builder.exists(NAME)) {
      id = await builder.idOf(NAME);
      test.info().annotations.push({ type: 'skipped', description: `${NAME} already exists (id ${id}), left as it is` });
    } else {
      await test.step(`Create the sequence "${NAME}"`, async () => {
        id = await builder.create(NAME);
      });
      await test.step(`Add Step 1 from the "${libraryTemplates[0]}" library template`, async () => {
        await builder.addEmailStep(libraryTemplates[0], `${NAME} - Step 1`);
      });
      await test.step('Activate the sequence', async () => {
        await saleshandySequence.resumeSequence(id);
      });
      await test.step('Check the sequence is in the list', async () => {
        await builder.openList();
        expect(await builder.exists(NAME)).toBe(true);
      });
    }
    test.info().annotations.push({ type: 'sequence id', description: id });
    console.log(`SEQUENCE_ID=${id}`);
  });
});
