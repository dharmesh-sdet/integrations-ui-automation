// Usage: npm run prospect:delete -- <account> <email>
// Deletes ONE prospect (exact email) from that account's Saleshandy CRM list.
// Does nothing unless the search finds exactly one matching row, so a typo
// cannot delete the wrong prospect. Uses the saved session from npm run login.
import { chromium, devices } from '@playwright/test';
import { isAccount } from '../src/config/accounts.ts';
import { platforms } from '../src/config/environments.ts';
import { assertSessionFresh } from '../src/utils/session.ts';

const [account, email] = process.argv.slice(2);
if (!isAccount(account) || !email) {
  console.error('Usage: npm run prospect:delete -- <account> <email>');
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices['Desktop Chrome'],
  viewport: { width: 1440, height: 900 },
  storageState: assertSessionFresh('saleshandy', account, 'chromium'),
});
const page = await context.newPage();
await page.goto(new URL('/crm/list', platforms.saleshandy.baseURL).toString());

const searchBox = page.getByRole('textbox', { name: 'Search Name or Email' });
const search = async () => {
  await searchBox.fill(email);
  await searchBox.press('Enter');
  await page.waitForTimeout(4000);
};
// The CRM list is a div grid, not a table: each row is .shd-table--tr.
const rows = page.locator('.shd-table--tr').filter({ hasText: email });

await search();
const found = await rows.count();
console.log(`rows matching: ${found}`);
if (found !== 1) {
  console.log('Not deleting: expected exactly 1 row.');
  await browser.close();
  process.exit(2);
}

// The pinned checkbox sits under the sidebar overlay at this viewport, so a
// real click is intercepted. Click it through the DOM instead.
await rows.first().getByRole('checkbox').evaluate((el: HTMLElement) => el.click());
await page.locator('button:has(.sh-trash)').click();
await page.getByRole('button', { name: 'Delete', exact: true }).click();
await page.waitForTimeout(3000);

await search();
const left = await rows.count();
console.log(`rows after delete: ${left}`);
await browser.close();
process.exit(left === 0 ? 0 : 3);
