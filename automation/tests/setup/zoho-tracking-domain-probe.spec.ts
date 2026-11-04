import { test } from '../../src/fixtures/index.ts';

// Throwaway probe (QA 2026-10-31): read the Custom Tracking Domain page of notemailsentzoho. Changes nothing.
//   ZOHO_DOMAIN_PROBE=1 KEEP_TEST_DATA=1 npx playwright test tests/setup/zoho-tracking-domain-probe.spec.ts --project=chromium --workers=1
test.describe('Zoho tracking domain probe', () => {
  test.skip(process.env.ZOHO_DOMAIN_PROBE !== '1', 'Set ZOHO_DOMAIN_PROBE=1');
  test.use({ account: 'notemailsentzoho' });
  test('read the Custom Tracking Domain page', async ({ saleshandyPage: page }) => {
    await page.goto('/conversations');
    await page.waitForTimeout(8000);
    console.log('URL', page.url());
    console.log('PLACEHOLDERS', JSON.stringify(await page.locator('input').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).placeholder))));
    console.log('BUTTONS', JSON.stringify(await page.getByRole('button').allInnerTexts()));
    console.log('TEXT\n' + (await page.locator('main, body').first().innerText()).slice(0, 1800));
    await page.screenshot({ path: 'test-results-domain-probe/conversations.png' });
  });
});
