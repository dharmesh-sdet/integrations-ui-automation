import { expect, test } from '../../src/fixtures/index.ts';
import { libraryTemplates } from '../../src/config/account-setup.ts';

// Production setup for the Pipedrive "Prospect is Unsubscribed in Saleshandy" smoke run
// (notes/production-testing/14-pipedrive-unsubscribed.md), run by scripts/run-pipedrive-unsubscribed-smoke.sh
// after the gate. Creates "Pipedrive Prospect Unsubscribed Smoke <date>": one step from the first library
// template, the production email accounts added in Settings > Email Account, then activated. If today's
// sequence is already in the list it is reused: missing email accounts are added and it is activated if
// paused. A production write, so it only runs with SETUP_SMOKE_SEQUENCE=1 and is never retried.
// "Unsubscribe as Link" in Sequence Settings > Unsubscribe has no code: QA saves it by hand on the new
// sequence before the checks run (checks 1 and 2 use the real link).
//   SETUP_SMOKE_SEQUENCE=1 REPORT_OPEN=never npx playwright test tests/setup/pipedrive-unsubscribed-smoke-sequence.spec.ts --project=chromium --workers=1
// Email accounts: the two read on the Email Accounts page on 2026-10-22. SMOKE_EMAIL_ACCOUNTS=a@x.com,b@y.com
// overrides them. The run sends 10 emails, under the cap of 20 a day.
const NAME = process.env.SMOKE_SEQUENCE_NAME ?? `Pipedrive Prospect Unsubscribed Smoke ${new Date().toISOString().slice(0, 10)}`;
const EMAIL_ACCOUNTS = (process.env.SMOKE_EMAIL_ACCOUNTS ?? 'Rachelgreen47sh+3@gmail.com,rudra+emailsentprod@saleshandy.com').split(',').map((e) => e.trim());
const TEMPLATE = libraryTemplates[0];

test.describe('Production setup: Pipedrive Prospect Unsubscribed smoke sequence', () => {
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
    console.log('QA: save Sequence Settings > Unsubscribe > "Unsubscribe as Link" on this sequence before the checks run.');
  });
});
