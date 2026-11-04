import { test } from '../../src/fixtures/index.ts';

// Throwaway (QA 2026-10-31): add the custom tracking domain cd1.shengage02.com to notemailsentzoho, as QA did on gpipedrive.
// Without ZOHO_DOMAIN_SAVE=1 it only opens the Email Accounts list and prints it.
//   ZOHO_DOMAIN_ADD=1 [ZOHO_DOMAIN_SAVE=1] KEEP_TEST_DATA=1 npx playwright test tests/setup/zoho-tracking-domain-add.spec.ts --project=chromium --workers=1
const DOMAIN = 'cd1.shengage02.com';
test.describe('Zoho tracking domain add', () => {
  test.skip(process.env.ZOHO_DOMAIN_ADD !== '1', 'Set ZOHO_DOMAIN_ADD=1');
  test.use({ account: 'notemailsentzoho' });
  test('add the domain', async ({ saleshandyPage: page }) => {
    test.setTimeout(120_000);
    await page.goto('/settings/custom-domain');
    await page.getByRole('button', { name: 'Add Custom Domain' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ timeout: 15_000 });
    await dialog.locator('.multi-select__control').first().click();
    await page.waitForTimeout(1500);
    console.log('OPTIONS\n' + (await page.locator('body').innerText()).split('Email Accounts').slice(-1)[0].slice(0, 1500));
    await page.screenshot({ path: 'test-results-domain-add/options.png' });
    if (process.env.ZOHO_DOMAIN_SAVE !== '1') return;
    for (let i = 0; i < 11; i++) {
      const option = page.locator('.multi-select__option').first();
      if (!(await option.isVisible().catch(() => false))) await dialog.locator('.multi-select__control').first().click();
      if (!(await option.isVisible({ timeout: 3000 }).catch(() => false))) break;
      await option.click();
    }
    console.log('SELECTED', await dialog.locator('.multi-select__multi-value').count());
    await page.keyboard.press('Escape');
    await dialog.getByPlaceholder('e.g. go.getsaleshandy.com').fill(DOMAIN);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results-domain-add/filled.png' });
    await dialog.getByRole('button', { name: 'Verify & Save', exact: true }).click();
    await page.waitForTimeout(8000);
    console.log('AFTER SAVE alerts', JSON.stringify(await page.getByRole('alert').allInnerTexts()));
    console.log('AFTER SAVE TEXT\n' + (await page.locator('body').innerText()).slice(-1800));
    await page.screenshot({ path: 'test-results-domain-add/saved.png' });
  });
});
