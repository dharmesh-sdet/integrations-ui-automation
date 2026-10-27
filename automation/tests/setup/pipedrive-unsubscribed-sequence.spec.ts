import { expect, test } from '../../src/fixtures/index.ts';
import { libraryTemplates } from '../../src/config/account-setup.ts';

// One-time setup of the sequence for the Pipedrive Prospect is Unsubscribed rows on gpipedrive
// (QA, 2026-10-26). One step, sender Kartik 60 (Kartik 5 showed
// disconnected in the add dialog, seen 2026-10-26). "Unsubscribe as Link" in Sequence Settings is
// saved by hand (no code for it yet). Creates nothing if the
// sequence is already in the list.
//   SETUP_SEQUENCE=1 REPORT_OPEN=never npx playwright test tests/setup/pipedrive-unsubscribed-sequence.spec.ts --project=chromium --workers=1
const NAME = 'Pipedrive Unsubscribed QA';
const SENDER = '1kartiktest+10@gmail.com';

test.describe('Setup: Pipedrive Unsubscribed sequence', () => {
  test.skip(process.env.SETUP_SEQUENCE !== '1', 'Set SETUP_SEQUENCE=1 to create the sequence');
  test.use({ account: 'gpipedrive' });

  test(`Create "${NAME}", add step 1, the sender and activate it`, async ({ saleshandySequenceBuilder: builder, saleshandySequence }) => {
    await builder.openList();
    if (await builder.exists(NAME)) {
      const existing = await builder.idOf(NAME);
      await builder.addEmailAccounts(existing, [SENDER]);
      await saleshandySequence.resumeSequence(existing);
      console.log(`SEQUENCE_ID=${existing}`);
      return;
    }
    const id = await builder.create(NAME);
    await builder.addEmailStep(libraryTemplates[0], `${NAME} - Step 1`);
    await builder.addEmailAccounts(id, [SENDER]);
    await saleshandySequence.resumeSequence(id);
    await builder.openList();
    expect(await builder.exists(NAME)).toBe(true);
    console.log(`SEQUENCE_ID=${id}`);
  });
});
