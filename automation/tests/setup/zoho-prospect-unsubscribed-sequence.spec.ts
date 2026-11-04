import type { Page } from '@playwright/test';
import { expect, test } from '../../src/fixtures/index.ts';

// One-time setup of the sequence for the Zoho "Prospect is Unsubscribed in Saleshandy" tests on the
// notemailsentzoho account. One step, "Unsubscribe as Link" saved in Sequence Settings > Unsubscribe. Creates nothing that is already there; the id is printed either way.
// The same list and dialog workaround as zoho-email-opened-sequence.spec.ts: the Sequences list and the
// "add email accounts" dialog have no table rows since 2026-11-02, so the shared openList, exists, idOf and
// addEmailAccounts are not used. The shared page object is left unchanged (QA, 2026-11-02).
// Sender: set ZOHO_PU_SENDER to a mailbox that no other Zoho sequence uses. Without it the spec adds no
// sender, prints the mailboxes that can be added, and stops before activating. ZOHO_PU_LIST_FILTER narrows that list.
//   SETUP_SEQUENCE=1 REPORT_OPEN=never npx playwright test tests/setup/zoho-prospect-unsubscribed-sequence.spec.ts --project=chromium --workers=1
// The id printed at the end (SEQUENCE_ID=...) goes into ZOHO_PU_SEQUENCE_ID.
const NAME = 'Zoho Prospect Unsubscribed QA';
const STEP_1_SUBJECT = 'Quick question about your outreach';
// The shared addEmailStepWithLinks waits for `window.tinymce.editors.length` to be 2. On 2026-11-02 that value is
// undefined on staging (the editors are on the page, `.mce-content-body` x2), so it never passes. This local helper
// types a plain-text body (no links needed for bounce rows) and waits for the two editors on the page instead.
async function addStep(page: Page, subject: string, text: string): Promise<void> {
  await page.getByRole('button', { name: 'Email', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await expect(dialog.locator('.mce-content-body'), 'Subject and body editors').toHaveCount(2, { timeout: 30_000 });
  // The editors reset a moment after they appear (2026-11-02: both boxes were empty again at Save), so wait first.
  await page.waitForTimeout(4_000);
  const sameThread = dialog.getByRole('checkbox', { name: /same thread/i });
  if ((await sameThread.count()) > 0 && (await sameThread.isChecked())) await sameThread.uncheck();
  const subjectBox = dialog.locator('.editor-editable-content.single-line-content');
  const bodyBox = dialog.locator('.editor-editable-content:not(.single-line-content)');
  // Type whatever is missing, again and again, until both boxes hold their text together.
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
const STEP_1_BODY = 'Hello, I wanted to ask a quick question about your outreach.';
const SENDER = process.env.ZOHO_PU_SENDER ?? '';

test.describe('Setup: Zoho Prospect Unsubscribed sequence', () => {
  test.skip(process.env.SETUP_SEQUENCE !== '1', 'Set SETUP_SEQUENCE=1 to create the sequence');
  test.use({ account: 'notemailsentzoho' });
  test.describe.configure({ retries: 0 });

  test(`Create "${NAME}", add step 1, save Unsubscribe as Link, add the sender, activate it`, async ({ saleshandySequenceBuilder: builder, saleshandySequence }) => {
    let id = await test.step('Open the Sequences list and look for the sequence by name', async () => {
      const listLoaded = builder.page.waitForResponse((r) => r.url().includes('/api/edge/sequences?') && r.ok());
      await builder.goto('/sequence');
      const data = await (await listLoaded).json();
      const found = JSON.stringify(data).match(new RegExp(`"id":(\\d+)[^{}]*"title":"${NAME}"|"title":"${NAME}"[^{}]*"id":(\\d+)`));
      return found?.[1] ?? found?.[2] ?? '';
    });
    if (id) {
      await test.step(`Open the existing "${NAME}" (id ${id}) and add the step if it is missing`, async () => {
        await builder.goto(`/sequence/${id}/steps`);
        await builder.page
          .getByText(STEP_1_SUBJECT)
          .or(builder.page.getByRole('button', { name: 'Email', exact: true }))
          .first()
          .waitFor({ timeout: 30_000 });
        if ((await builder.page.getByText(STEP_1_SUBJECT).count()) === 0) {
          await addStep(builder.page, STEP_1_SUBJECT, STEP_1_BODY);
        }
      });
    } else {
      await test.step(`Create the sequence "${NAME}"`, async () => {
        id = await builder.create(NAME);
      });
      await test.step('Add step 1', async () => {
        await addStep(builder.page, STEP_1_SUBJECT, STEP_1_BODY);
      });
    }
    await test.step('Save Sequence Settings > Unsubscribe > "Unsubscribe as Link" (left alone when saved)', async () => {
      const { page } = builder;
      const linkRadio = page
        .getByText('Unsubscribe as Link', { exact: true })
        .locator('xpath=ancestor::*[.//input[@type="radio"]][1]')
        .locator('input[type="radio"]')
        .first();
      const open = async () => {
        await builder.goto(`/sequence/${id}/settings`);
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
        if (process.env.ZOHO_PU_LIST_FILTER) {
          await dialog.getByPlaceholder('Search').fill(process.env.ZOHO_PU_LIST_FILTER);
          await builder.page.keyboard.press('Enter');
          await builder.page.waitForTimeout(3_000);
        }
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
