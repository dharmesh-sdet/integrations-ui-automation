import { expect, test } from '../../src/fixtures/index.ts';
import { libraryTemplates } from '../../src/config/account-setup.ts';

// One-time setup of the sequence for the Pipedrive Reply is Received rows on gpipedrive
// (QA, 2026-10-27). Two steps (the second-reply rows send step 2), senders Kartik 54 and Rachel 10 (added by QA, 2026-10-28).
// Creates nothing if the sequence is already in the list.
//   SETUP_SEQUENCE=1 REPORT_OPEN=never npx playwright test tests/setup/pipedrive-reply-received-sequence.spec.ts --project=chromium --workers=1
// The id printed at the end (SEQUENCE_ID=...) goes into tests/pipedrive/reply-received.spec.ts.
const NAME = 'Pipedrive Reply Received QA';
const SENDERS = ['1kartiktest+4@gmail.com', 'Rachelgreen47sh+10@gmail.com'];

test.describe('Setup: Pipedrive Reply Received sequence', () => {
  test.skip(process.env.SETUP_SEQUENCE !== '1', 'Set SETUP_SEQUENCE=1 to create the sequence');
  test.use({ account: 'gpipedrive' });

  test(`Create "${NAME}", add steps 1 and 2, the sender and activate it`, async ({ saleshandySequenceBuilder: builder, saleshandySequence }) => {
    await builder.openList();
    if (await builder.exists(NAME)) {
      const existing = await builder.idOf(NAME);
      await builder.addEmailAccounts(existing, SENDERS);
      await saleshandySequence.resumeSequence(existing);
      console.log(`SEQUENCE_ID=${existing}`);
      return;
    }
    const id = await builder.create(NAME);
    await builder.addEmailStep(libraryTemplates[0], `${NAME} - Step 1`);
    await builder.page.getByRole('button', { name: /Add Step/ }).first().click();
    await builder.addEmailStep(libraryTemplates[1], `${NAME} - Step 2`);
    await builder.addEmailAccounts(id, SENDERS);
    await saleshandySequence.resumeSequence(id);
    await builder.openList();
    expect(await builder.exists(NAME)).toBe(true);
    console.log(`SEQUENCE_ID=${id}`);
  });
});
