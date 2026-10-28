import { expect, test } from '../../src/fixtures/index.ts';
import { libraryTemplates } from '../../src/config/account-setup.ts';

// Production setup for the Pipedrive "Email is Bounced in Saleshandy" smoke run
// (notes/production-testing/12-pipedrive-email-bounced.md), run by scripts/run-pipedrive-email-bounced-smoke.sh
// after the gate. Creates the sequence for the day, "Pipedrive Email Bounced Smoke <date>": one email step,
// the production email accounts added in Settings > Email Account, then activated. If today's sequence is
// already in the list it is reused: missing email accounts are added and it is activated if paused.
// A production write, so it only runs with SETUP_SMOKE_SEQUENCE=1 and is never retried.
//   SETUP_SMOKE_SEQUENCE=1 REPORT_OPEN=never npx playwright test tests/setup/pipedrive-email-bounced-smoke-sequence.spec.ts --project=chromium --workers=1
// Email accounts: the two read on the Email Accounts page on 2026-10-22. SMOKE_EMAIL_ACCOUNTS=a@x.com,b@y.com overrides them.
// The run sends 1 email (check 11), far under the cap of 20 a day.
const NAME = process.env.SMOKE_SEQUENCE_NAME ?? `Pipedrive Email Bounced Smoke ${new Date().toISOString().slice(0, 10)}`;
const EMAIL_ACCOUNTS = (process.env.SMOKE_EMAIL_ACCOUNTS ?? 'Rachelgreen47sh+3@gmail.com,rudra+emailsentprod@saleshandy.com').split(',').map((e) => e.trim());
const STEP_1_HEADING = `${NAME} - Step 1`;

test.describe('Production setup: Pipedrive Email Bounced smoke sequence', () => {
  test.skip(process.env.SETUP_SMOKE_SEQUENCE !== '1', 'Set SETUP_SMOKE_SEQUENCE=1 to create the production sequence');
  test.use({ account: 'emailopenedprod' });
  test.describe.configure({ retries: 0 });

  test(`Create "${NAME}", add step 1 and the email accounts, activate it`, async ({ saleshandySequenceBuilder: builder, saleshandySequence }) => {
    await test.step('Open the Sequences list', async () => {
      await builder.openList();
    });
    let id = '';
    if (await builder.exists(NAME)) {
      test.info().annotations.push({ type: 'reused', description: `${NAME} already exists, only the email accounts and activation are checked` });
      id = await builder.idOf(NAME);
    } else {
      await test.step(`Create the sequence "${NAME}"`, async () => {
        id = await builder.create(NAME);
      });
      await test.step('Add step 1', async () => {
        await builder.addEmailStep(libraryTemplates[0], STEP_1_HEADING);
      });
    }
    await test.step(`Add the email accounts ${EMAIL_ACCOUNTS.join(' and ')}`, async () => {
      await builder.addEmailAccounts(id, EMAIL_ACCOUNTS);
    });
    await test.step('Activate the sequence', async () => {
      await saleshandySequence.resumeSequence(id);
    });
    await test.step('Make sure that the sequence is in the list', async () => {
      await builder.openList();
      expect(await builder.exists(NAME)).toBe(true);
    });
    test.info().annotations.push({ type: 'sequence id', description: id });
    console.log(`SEQUENCE_ID=${id}`);
  });
});
