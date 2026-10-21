import { expect, test } from '../../src/fixtures/index.ts';
import { libraryTemplates } from '../../src/config/account-setup.ts';

// One-time setup of the sequence for the Salesforce "Email Sent from Saleshandy"
// tests (AL-4132) on the sfemailsent account. Two steps (the "Create a Lead +
// Attach Note" row 2 sends step 2), no A/B variants, sender left as the account
// default. The onboarding sequence 196794 ("Salesforce's First Sequence") is left
// as it is. Creates nothing if the sequence is already in the list.
//   SETUP_SEQUENCE=1 REPORT_OPEN=never npx playwright test tests/setup/email-sent-salesforce-sequence.spec.ts --project=chromium --workers=1
// The id printed at the end (SEQUENCE_ID=...) goes into tests/salesforce/email-sent.spec.ts.
const NAME = 'Salesforce Email Sent Regression';

test.describe('Setup: Salesforce Email Sent sequence', () => {
  test.skip(process.env.SETUP_SEQUENCE !== '1', 'Set SETUP_SEQUENCE=1 to create the sequence');
  test.use({ account: 'sfemailsent' });

  test(`Create "${NAME}", add steps 1 and 2 and activate it`, async ({ saleshandySequenceBuilder: builder, saleshandySequence }) => {
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
