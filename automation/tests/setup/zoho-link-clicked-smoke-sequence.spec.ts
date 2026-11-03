import { expect, test } from '../../src/fixtures/index.ts';

// Production setup for the Zoho "Link is Clicked in Saleshandy" smoke run
// (notes/production-testing/17-zoho-link-clicked.md), run by scripts/run-zoho-link-clicked-smoke.sh after the
// gate. Creates a sequence for the day, "Zoho Link Clicked Smoke <date>": one step with two links in the body,
// Track link clicks on, Track email opens off (a click must not also fire Email Opened), the production email
// accounts added in Settings > Email Account, then activated. If today's sequence is already in the list it is
// reused: missing email accounts are added and it is activated if paused. A production write, so it only runs
// with SETUP_SMOKE_SEQUENCE=1 and is never retried.
//   SETUP_SMOKE_SEQUENCE=1 REPORT_OPEN=never npx playwright test tests/setup/zoho-link-clicked-smoke-sequence.spec.ts --project=chromium --workers=1
// Email accounts: the two read on the Email Accounts page on 2026-10-22. Read the page again before the run
// (notes/production-testing/README.md). SMOKE_EMAIL_ACCOUNTS=a@x.com,b@y.com overrides them. The run sends 8
// emails, under the cap of 20 a day.
const NAME = process.env.SMOKE_SEQUENCE_NAME ?? `Zoho Link Clicked Smoke ${new Date().toISOString().slice(0, 10)}`;
const EMAIL_ACCOUNTS = (process.env.SMOKE_EMAIL_ACCOUNTS ?? 'Rachelgreen47sh+3@gmail.com,rudra+emailsentprod@saleshandy.com').split(',').map((e) => e.trim());
// The smoke spec reads this subject as SMOKE_STEP1_SUBJECT (printed at the end).
const STEP_1_SUBJECT = 'Quick question about your outreach';
const LINKS = ['https://www.saleshandy.com', 'https://www.saleshandy.com/pricing/'];
const BODY_HTML = `<p>Hello, please see <a href="${LINKS[0]}">home</a> and <a href="${LINKS[1]}">pricing</a>.</p>`;

test.describe('Production setup: Zoho Link Clicked smoke sequence', () => {
  test.skip(process.env.SETUP_SMOKE_SEQUENCE !== '1', 'Set SETUP_SMOKE_SEQUENCE=1 to create the production sequence');
  test.use({ account: 'emailopenedprod' });
  test.describe.configure({ retries: 0 });

  test(`Create "${NAME}", add step 1 with two links, turn on link tracking, add the email accounts, activate it`, async ({ saleshandySequenceBuilder: builder, saleshandySequence }) => {
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
      await test.step('Add step 1 with the subject and two links in the body', async () => {
        await builder.addEmailStepWithLinks(STEP_1_SUBJECT, BODY_HTML, LINKS);
      });
      await test.step('Turn on Track link clicks and turn off Track email opens in Safety Settings', async () => {
        await builder.enableLinkTrackingIfOff();
        await builder.setSafetySetting('Track email opens', false);
      });
      await test.step('Check Track link clicks is on and the other two switches are off', async () => {
        expect(await builder.safetySettingChecked('Track link clicks')).toBe(true);
        expect(await builder.safetySettingChecked('Track email opens')).toBe(false);
        expect(await builder.safetySettingChecked('Send emails as text only')).toBe(false);
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
    console.log(`STEP_1_SUBJECT=${STEP_1_SUBJECT}`);
  });
});
