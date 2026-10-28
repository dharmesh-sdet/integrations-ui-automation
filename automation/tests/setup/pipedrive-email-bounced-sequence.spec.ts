import { expect, test } from '../../src/fixtures/index.ts';
import { libraryTemplates } from '../../src/config/account-setup.ts';

// One-time setup of the sequence for the Pipedrive Email is Bounced rows on gpipedrive
// (QA, 2026-10-27). One step, sender dharmesh+pipedrive@saleshandy.com (QA's choice, 2026-10-28).
// Creates nothing if the sequence is already in the list.
//   SETUP_SEQUENCE=1 REPORT_OPEN=never npx playwright test tests/setup/pipedrive-email-bounced-sequence.spec.ts --project=chromium --workers=1
// The id printed at the end (SEQUENCE_ID=...) goes into tests/pipedrive/email-bounced.spec.ts.
const NAME = 'Pipedrive Email Bounced QA';
const SENDER = 'dharmesh+pipedrive@saleshandy.com';

test.describe('Setup: Pipedrive Email Bounced sequence', () => {
  test.skip(process.env.SETUP_SEQUENCE !== '1', 'Set SETUP_SEQUENCE=1 to create the sequence');
  test.use({ account: 'gpipedrive' });

  test(`Create "${NAME}", add step 1, the sender and activate it`, async ({ saleshandySequenceBuilder: builder, saleshandySequence }) => {
    await builder.openList();
    if (await builder.exists(NAME)) {
      const existing = await builder.idOf(NAME);
      // A first run can stop in the template picker (seen 2026-10-27: it stayed open after the template
      // filled), which leaves a Draft with no step. The empty Steps tab is the same page `create` ends on.
      await builder.goto(`/sequence/${existing}/steps`);
      // The empty tab ("Start your Sequence") offers an Email button; a tab with steps offers Add Step.
      await builder.page.getByRole('button', { name: /^Email$|Add Step/ }).first().waitFor({ timeout: 30_000 });
      if (!(await builder.page.getByText(`${NAME} - Step 1`).count())) await builder.addEmailStep(libraryTemplates[0], `${NAME} - Step 1`);
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
