import { expect, test } from '../../src/fixtures/index.ts';
import { libraryTemplates } from '../../src/config/account-setup.ts';

// Production setup for the Salesforce "Email Sent from Saleshandy" smoke run
// (notes/production-testing/07-salesforce-email-sent.md), run by
// scripts/run-salesforce-email-sent-smoke.sh after the gate (Field Mapping complete).
// Creates a new sequence for the day, "Salesforce Email Sent Smoke <date>": one step, no A/B
// variants, the two production email accounts added in Settings > Email Account, then
// activated. If today's sequence is already in the list it is reused: missing email accounts
// are added and it is activated if paused. A production write, so it only runs with
// SETUP_SMOKE_SEQUENCE=1 and is never retried.
//   SETUP_SMOKE_SEQUENCE=1 REPORT_OPEN=never npx playwright test tests/setup/email-sent-salesforce-smoke-sequence.spec.ts --project=chromium --workers=1
// Email accounts on the production account (read 2026-10-22): Salesforce EmailSent SMTP Default
// (50 a day) and Rudra EmailSent SMTP (150 a day). SMOKE_EMAIL_ACCOUNTS=a@x.com,b@y.com overrides.
const NAME = `Salesforce Email Sent Smoke ${new Date().toISOString().slice(0, 10)}`;
const TEMPLATE = libraryTemplates[0];
const EMAIL_ACCOUNTS = (process.env.SMOKE_EMAIL_ACCOUNTS ?? 'Rachelgreen47sh+3@gmail.com,rudra+emailsentprod@saleshandy.com').split(',').map((e) => e.trim());

test.describe('Production setup: Salesforce Email Sent smoke sequence', () => {
  test.skip(process.env.SETUP_SMOKE_SEQUENCE !== '1', 'Set SETUP_SMOKE_SEQUENCE=1 to create the production sequence');
  test.use({ account: 'emailopenedprod' });

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
      await test.step(`Add Step 1 from the "${TEMPLATE}" library template`, async () => {
        await builder.addEmailStep(TEMPLATE, `${NAME} step 1`);
      });
    }
    await test.step(`Add the email accounts ${EMAIL_ACCOUNTS.join(' and ')}`, async () => {
      await builder.addEmailAccounts(id, EMAIL_ACCOUNTS);
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
