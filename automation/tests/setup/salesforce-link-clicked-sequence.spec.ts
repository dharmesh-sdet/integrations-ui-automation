import { expect, test } from '../../src/fixtures/index.ts';
import { STEP_1_SUBJECT, STEP_2_SUBJECT } from '../../src/flows/salesforce-link-clicked.ts';

// One-time setup of the sequence for the Salesforce "Link is Clicked in Saleshandy" (AL-4136) tests on the
// sflinkclicked account. Two steps, step 1 with two different links (link 1 and link 2), Track link clicks on,
// Track email opens off. Creates nothing that is already there; the id is printed either way.
// Sender: set SF_LC_SENDER to the mailbox address. Without it the spec adds no sender and prints the mailboxes
// that can be added, then stops before activating.
//   SETUP_SEQUENCE=1 REPORT_OPEN=never npx playwright test tests/setup/salesforce-link-clicked-sequence.spec.ts --project=chromium --workers=1
// The id printed at the end (SEQUENCE_ID=...) goes into SF_LC_SEQUENCE_ID.
const NAME = 'Salesforce Link Clicked Regression';
const LINK_1 = 'https://www.saleshandy.com';
const LINK_2 = 'https://www.saleshandy.com/pricing';
const step1Body = (text: string) => `<p>${text} <a href="${LINK_1}">saleshandy.com</a> and <a href="${LINK_2}">our pricing</a>.</p>`;
const step2Body = (text: string) => `<p>${text} <a href="${LINK_1}">saleshandy.com</a>.</p>`;
const SENDER = process.env.SF_LC_SENDER ?? '';

test.describe('Setup: Salesforce Link Clicked sequence', () => {
  test.skip(process.env.SETUP_SEQUENCE !== '1', 'Set SETUP_SEQUENCE=1 to create the sequence');
  test.use({ account: 'sflinkclicked' });
  test.describe.configure({ retries: 0 });

  test(`Create "${NAME}", add steps 1 and 2, turn link tracking on and open tracking off, add the sender, activate it`, async ({
    saleshandySequenceBuilder: builder,
    saleshandySequence,
  }) => {
    // The Sequences list is no longer a table (2026-11-02: no role "row" or "table"), so the shared
    // openList, exists and idOf cannot be used. The id is read from the list request instead.
    let id = await test.step('Open the Sequences list and look for the sequence by name', async () => {
      const listLoaded = builder.page.waitForResponse((r) => r.url().includes('/api/edge/sequences?') && r.ok());
      await builder.goto('/sequence');
      const body = await (await listLoaded).json();
      const found = JSON.stringify(body).match(new RegExp(`"id":(\\d+)[^{}]*"title":"${NAME}"|"title":"${NAME}"[^{}]*"id":(\\d+)`));
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
          await builder.addEmailStepWithLinks(STEP_1_SUBJECT, step1Body('Hello, I wanted to ask a quick question about your outreach.'), [LINK_1, LINK_2]);
        }
        if ((await builder.page.getByText(STEP_2_SUBJECT).count()) === 0) {
          await builder.page.getByRole('button', { name: /Add Step/ }).first().click();
          await builder.addEmailStepWithLinks(STEP_2_SUBJECT, step2Body('Hi again, I am following up on my last note.'), [LINK_1]);
        }
      });
    } else {
      await test.step(`Create the sequence "${NAME}"`, async () => {
        id = await builder.create(NAME);
      });
      await test.step('Add step 1', async () => {
        await builder.addEmailStepWithLinks(STEP_1_SUBJECT, step1Body('Hello, I wanted to ask a quick question about your outreach.'), [LINK_1, LINK_2]);
      });
      await test.step('Add step 2', async () => {
        await builder.page.getByRole('button', { name: /Add Step/ }).first().click();
        await builder.addEmailStepWithLinks(STEP_2_SUBJECT, step2Body('Hi again, I am following up on my last note.'), [LINK_1]);
      });
    }
    await test.step('Turn on Track link clicks in Safety Settings (left alone when on)', async () => {
      await builder.setSafetySetting('Track link clicks', true);
    });
    await test.step('Turn off Track email opens in Safety Settings (left alone when off)', async () => {
      await builder.setSafetySetting('Track email opens', false);
    });
    await test.step('Check the two switches', async () => {
      expect(await builder.safetySettingChecked('Track link clicks')).toBe(true);
      expect(await builder.safetySettingChecked('Track email opens')).toBe(false);
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
        // SF_LC_LIST_FILTER narrows the list (the dialog shows only the first accounts until searched).
        if (process.env.SF_LC_LIST_FILTER) {
          await dialog.getByPlaceholder('Search').fill(process.env.SF_LC_LIST_FILTER);
          await builder.page.keyboard.press('Enter');
          await builder.page.waitForTimeout(3_000);
        }
        console.log(`MAILBOXES=\n${(await dialog.innerText()).replace(/\n{2,}/g, '\n')}`);
        await builder.page.keyboard.press('Escape');
      });
      return;
    }
    await test.step(`Add the sender ${SENDER}`, async () => {
      // The shared addEmailAccounts looks for table rows, which the list no longer has (2026-11-02).
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
