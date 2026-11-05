import { expect, test } from '../../src/fixtures/index.ts';
import { STEP_1_SUBJECT, STEP_2_SUBJECT } from '../../src/flows/salesforce-email-bounced.ts';

// One-time setup of the sequence for the Salesforce "Email is Bounced in Saleshandy" (AL-4138) tests on the
// sfemailopened account. Two steps, active, no A/B variants, so the prospect gets an Emails tab row. A bounce
// needs no open or click tracking, so the Safety Settings stay as they are. Creates nothing that is already
// there; the id is printed either way.
// Sender: set SF_EB_SENDER to the mailbox address. Without it the spec adds no sender and prints the mailboxes
// that can be added, then stops before activating.
//   SETUP_SEQUENCE=1 KEEP_TEST_DATA=1 REPORT_OPEN=never npx playwright test tests/setup/salesforce-email-bounced-sequence.spec.ts --project=chromium --workers=1
// The id printed at the end (SEQUENCE_ID=...) goes into SF_EB_SEQUENCE_ID.
const NAME = 'Salesforce Email Bounced Regression';
const LINK = 'https://www.saleshandy.com';
const body = (text: string) => `<p>${text} <a href="${LINK}">saleshandy.com</a>.</p>`;
const SENDER = process.env.SF_EB_SENDER ?? '';

test.describe('Setup: Salesforce Email Bounced sequence', () => {
  test.skip(process.env.SETUP_SEQUENCE !== '1', 'Set SETUP_SEQUENCE=1 to create the sequence');
  test.use({ account: 'sfemailopened' });
  test.describe.configure({ retries: 0 });

  test(`Create "${NAME}", add steps 1 and 2, add the sender, activate it`, async ({ saleshandySequenceBuilder: builder, saleshandySequence }) => {
    // The Sequences list is no longer a table (2026-11-02), so the id is read from the list request.
    let id = await test.step('Open the Sequences list and look for the sequence by name', async () => {
      const listLoaded = builder.page.waitForResponse((r) => r.url().includes('/api/edge/sequences?') && r.ok());
      await builder.goto('/sequence');
      const bodyJson = await (await listLoaded).json();
      const found = JSON.stringify(bodyJson).match(new RegExp(`"id":(\\d+)[^{}]*"title":"${NAME}"|"title":"${NAME}"[^{}]*"id":(\\d+)`));
      return found?.[1] ?? found?.[2] ?? '';
    });
    if (id) {
      await test.step(`Open the existing "${NAME}" (id ${id})`, async () => {
        await builder.goto(`/sequence/${id}/steps`);
      });
      await test.step('Add the steps that are missing', async () => {
        await builder.page
          .getByText(STEP_1_SUBJECT)
          .or(builder.page.getByRole('button', { name: 'Email', exact: true }))
          .first()
          .waitFor({ timeout: 30_000 });
        if ((await builder.page.getByText(STEP_1_SUBJECT).count()) === 0) {
          await builder.addEmailStepWithLinks(STEP_1_SUBJECT, body('Hello, I wanted to ask a quick question about your outreach.'), [LINK]);
        }
        if ((await builder.page.getByText(STEP_2_SUBJECT).count()) === 0) {
          await builder.page.getByRole('button', { name: /Add Step/ }).first().click();
          await builder.addEmailStepWithLinks(STEP_2_SUBJECT, body('Hi again, I am following up on my last note.'), [LINK]);
        }
      });
    } else {
      await test.step(`Create the sequence "${NAME}"`, async () => {
        id = await builder.create(NAME);
      });
      await test.step('Add step 1', async () => {
        await builder.addEmailStepWithLinks(STEP_1_SUBJECT, body('Hello, I wanted to ask a quick question about your outreach.'), [LINK]);
      });
      await test.step('Add step 2', async () => {
        await builder.page.getByRole('button', { name: /Add Step/ }).first().click();
        await builder.addEmailStepWithLinks(STEP_2_SUBJECT, body('Hi again, I am following up on my last note.'), [LINK]);
      });
    }
    test.info().annotations.push({ type: 'sequence id', description: id });
    console.log(`SEQUENCE_ID=${id}`);

    if (!SENDER) {
      await test.step('List the mailboxes that can be added (nothing is added)', async () => {
        await builder.goto(`/sequence/${id}/settings`);
        const add = builder.page.getByRole('button', { name: /Add (more )?email accounts?/i }).first();
        await add.waitFor({ timeout: 30_000 });
        await add.click();
        const dialog = builder.page.getByRole('dialog').filter({ hasText: 'Select email accounts to add to the sequence' });
        await dialog.waitFor({ state: 'visible', timeout: 20_000 });
        await builder.page.waitForTimeout(3_000);
        console.log(`MAILBOXES=\n${(await dialog.innerText()).replace(/\n{2,}/g, '\n')}`);
        await builder.page.keyboard.press('Escape');
      });
      return;
    }
    await test.step(`Add the sender ${SENDER}`, async () => {
      await builder.goto(`/sequence/${id}/settings`);
      const settings = builder.page.locator('body');
      await builder.page.getByRole('button', { name: /Add (more )?email accounts?/i }).first().waitFor({ timeout: 30_000 });
      await builder.page.waitForTimeout(3_000);
      if ((await settings.getByText(SENDER, { exact: false }).count()) === 0) {
        await builder.page.getByRole('button', { name: /Add (more )?email accounts?/i }).first().click();
        const dialog = builder.page.getByRole('dialog').filter({ hasText: 'Select email accounts to add to the sequence' });
        await dialog.waitFor({ state: 'visible', timeout: 20_000 });
        await dialog.getByPlaceholder('Search').fill(SENDER);
        await builder.page.keyboard.press('Enter');
        await builder.page.waitForTimeout(3_000);
        const entry = dialog.getByText(SENDER, { exact: false }).first();
        await entry.waitFor({ timeout: 20_000 });
        await entry.locator('xpath=ancestor::*[.//input[@type="checkbox"]][1]').locator('input[type="checkbox"]').first().check();
        await dialog.getByRole('button', { name: 'Add to Sequence', exact: true }).click();
        await dialog.waitFor({ state: 'hidden', timeout: 20_000 });
      }
      await expect(settings.getByText(SENDER, { exact: false }).first(), `${SENDER} on the sequence's Email Account list`).toBeVisible({ timeout: 20_000 });
    });
    await test.step('Activate the sequence', async () => {
      await saleshandySequence.resumeSequence(id);
    });
  });
});
