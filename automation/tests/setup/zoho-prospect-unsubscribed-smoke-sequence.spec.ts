import type { Page } from '@playwright/test';
import { expect, test } from '../../src/fixtures/index.ts';

// Production setup for the Zoho "Prospect is Unsubscribed in Saleshandy" smoke run
// (notes/production-testing/21-zoho-prospect-unsubscribed.md). QA gave sequence 990987 on 2026-11-04 and asked for a step 2:
// a one-step sequence turns a prospect Completed, and the unsubscribe link does not register on it (QA 2026-11-04, staging).
// The spec adds step 2 when the Steps tab has none, and saves Sequence Settings > Unsubscribe > "Unsubscribe as Link" when it is
// not the saved choice. It changes nothing else, and it prints the sender list and the sequence status for QA.
// A production write, so it only runs with SETUP_SMOKE_SEQUENCE=1 and is never retried.
//   SETUP_SMOKE_SEQUENCE=1 SMOKE_SEQUENCE_ID=990987 REPORT_OPEN=never npx playwright test tests/setup/zoho-prospect-unsubscribed-smoke-sequence.spec.ts --project=chromium --workers=1
const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '990987';
const STEP_2_SUBJECT = 'Following up on my question';
const STEP_2_BODY = 'Hello, I am following up on my earlier question.';

// Same step dialog as tests/setup/zoho-prospect-unsubscribed-sequence.spec.ts (a spec file cannot be imported from another).
async function addStep(page: Page, subject: string, text: string): Promise<void> {
  const email = page.getByRole('button', { name: 'Email', exact: true });
  if (!(await email.isVisible({ timeout: 3_000 }).catch(() => false))) await page.getByRole('button', { name: 'Add Step', exact: true }).click();
  await email.click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await expect(dialog.locator('.mce-content-body'), 'Subject and body editors').toHaveCount(2, { timeout: 30_000 });
  await page.waitForTimeout(4_000);
  const sameThread = dialog.getByRole('checkbox', { name: /same thread/i });
  if ((await sameThread.count()) > 0 && (await sameThread.isChecked())) await sameThread.uncheck();
  const subjectBox = dialog.locator('.editor-editable-content.single-line-content');
  const bodyBox = dialog.locator('.editor-editable-content:not(.single-line-content)');
  await expect(async () => {
    if (!((await bodyBox.textContent()) ?? '').includes(text)) {
      await bodyBox.click();
      await page.keyboard.type(text);
    }
    if (!((await subjectBox.textContent()) ?? '').includes(subject)) {
      await subjectBox.click();
      await page.keyboard.type(subject);
    }
    await expect(bodyBox).toContainText(text, { timeout: 1_500 });
    await expect(subjectBox).toContainText(subject, { timeout: 1_500 });
  }).toPass({ timeout: 30_000 });
  const toast = page.getByRole('alert').filter({ hasText: 'Sequence step created successfully' });
  const save = dialog.getByRole('button', { name: 'Save', exact: true });
  await save.click({ timeout: 15_000 });
  const created = await toast.waitFor({ timeout: 3_000 }).then(() => true, () => false);
  if (!created && (await dialog.count()) > 0) {
    await save.click({ timeout: 15_000 });
    await toast.waitFor();
  }
  await expect(dialog).toHaveCount(0);
}

test.describe('Setup: Zoho Prospect Unsubscribed smoke sequence (production)', () => {
  test.use({ account: 'emailopenedprod' });
  test.describe.configure({ retries: 0 });

  test(`Add step 2 to sequence ${SEQUENCE_ID} and make sure Unsubscribe as Link is saved`, async ({ saleshandySequenceBuilder: builder }) => {
    test.skip(process.env.SETUP_SMOKE_SEQUENCE !== '1', 'Set SETUP_SMOKE_SEQUENCE=1 to change the production sequence');
    const { page } = builder;
    await test.step('Read the Steps tab', async () => {
      await builder.goto(`/sequence/${SEQUENCE_ID}/steps`);
      await page.getByText(/Step 1/).first().waitFor({ timeout: 60_000 });
      await page.waitForTimeout(3_000);
      console.log(`STEPS_BEFORE=\n${(await page.locator('body').innerText()).replace(/\n{2,}/g, '\n').slice(0, 1500)}`);
    });
    await test.step('Add step 2 when the sequence has only one step', async () => {
      if ((await page.getByText(/Step 2/).count()) === 0 && (await page.getByText(STEP_2_SUBJECT).count()) === 0) {
        await addStep(page, STEP_2_SUBJECT, STEP_2_BODY);
      }
      await page.reload();
      await expect(page.getByText(/Step 2/).first(), 'Step 2 on the Steps tab after a reload').toBeVisible({ timeout: 60_000 });
    });
    await test.step('Save Sequence Settings > Unsubscribe > "Unsubscribe as Link" (left alone when saved)', async () => {
      const linkRadio = page
        .getByText('Unsubscribe as Link', { exact: true })
        .locator('xpath=ancestor::*[.//input[@type="radio"]][1]')
        .locator('input[type="radio"]')
        .first();
      const open = async () => {
        await builder.goto(`/sequence/${SEQUENCE_ID}/settings`);
        await page.waitForTimeout(8_000);
        await page.getByText('Unsubscribe', { exact: true }).first().click();
        await linkRadio.waitFor({ timeout: 20_000 });
      };
      await open();
      if (!(await linkRadio.isChecked())) {
        await page.getByText('Unsubscribe as Link', { exact: true }).click();
        await page.getByRole('button', { name: 'Save', exact: true }).last().click({ timeout: 15_000 });
        await page.waitForTimeout(3_000);
        await open();
      }
      await expect(linkRadio, 'Unsubscribe as Link is the saved choice after a reload').toBeChecked();
    });
    await test.step('Print the senders and the status for QA', async () => {
      await builder.goto(`/sequence/${SEQUENCE_ID}/settings`);
      await page.waitForTimeout(8_000);
      console.log(`SETTINGS=\n${(await page.locator('body').innerText()).replace(/\n{2,}/g, '\n').slice(0, 2500)}`);
    });
    console.log(`SEQUENCE_ID=${SEQUENCE_ID}`);
  });
});
