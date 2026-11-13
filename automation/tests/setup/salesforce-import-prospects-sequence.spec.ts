import { isAccount } from '../../src/config/accounts.ts';
import { expect, test } from '../../src/fixtures/index.ts';

// One-time setup of the sequence for the Salesforce "Import Prospects from Salesforce" exploration and tests on the
// sfemailopened account. Two steps, no sender and no activation, so the sequence stays a draft and sends nothing.
// Creates nothing that is already there; the id is printed either way.
//   SETUP_SEQUENCE=1 KEEP_TEST_DATA=1 REPORT_OPEN=never npx playwright test tests/setup/salesforce-import-prospects-sequence.spec.ts --project=chromium --workers=1
const NAME = 'Salesforce Import Prospects QA';
const STEP_1_SUBJECT = 'Import test, step one';
const STEP_2_SUBJECT = 'Import test, step two';
const LINK = 'https://www.saleshandy.com';
const body = (text: string) => `<p>${text} <a href="${LINK}">saleshandy.com</a>.</p>`;

test.describe('Setup: Salesforce Import Prospects sequence', () => {
  test.skip(process.env.SETUP_SEQUENCE !== '1', 'Set SETUP_SEQUENCE=1 to create the sequence');
  // Default sfemailopened. SETUP_ACCOUNT=importprospects builds it on the fresh account (QA 2026-11-13).
  test.use({ account: isAccount(process.env.SETUP_ACCOUNT) ? process.env.SETUP_ACCOUNT : 'sfemailopened' });
  test.describe.configure({ retries: 0 });

  test(`Create the draft sequence "${NAME}" with steps 1 and 2`, async ({ saleshandySequenceBuilder: builder }) => {
    let id = await test.step('Open the Sequences list and look for the sequence by name', async () => {
      const listLoaded = builder.page.waitForResponse((r) => r.url().includes('/api/edge/sequences?') && r.ok());
      await builder.goto('/sequence');
      const body = await (await listLoaded).json();
      const found = JSON.stringify(body).match(new RegExp(`"id":(\\d+)[^{}]*"title":"${NAME}"|"title":"${NAME}"[^{}]*"id":(\\d+)`));
      return found?.[1] ?? found?.[2] ?? '';
    });
    if (!id) {
      await test.step(`Create the sequence "${NAME}"`, async () => {
        id = await builder.create(NAME);
      });
      await test.step('Add step 1', async () => {
        await builder.addEmailStepWithLinks(STEP_1_SUBJECT, body('Hello, this is a test message for the import.'), [LINK]);
      });
      await test.step('Add step 2', async () => {
        await builder.page.getByRole('button', { name: /Add Step/ }).first().click();
        await builder.addEmailStepWithLinks(STEP_2_SUBJECT, body('Hi again, this is the second test message.'), [LINK]);
      });
    }
    expect(id).not.toBe('');
    test.info().annotations.push({ type: 'sequence id', description: id });
    console.log(`SEQUENCE_ID=${id}`);
  });
});
