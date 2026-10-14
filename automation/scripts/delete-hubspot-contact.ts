// Usage: npm run hubspot:delete-contact -- <email> "<Full Name>"
// Deletes ONE contact (exact email) from the HubSpot test portal. Does nothing
// unless the list search finds exactly one matching row, so a typo cannot
// delete the wrong contact. Uses the saved session from npm run login:hubspot.
// HubSpot keeps deleted contacts for 90 days (restorable).
import { chromium, devices } from '@playwright/test';
import { platforms } from '../src/config/environments.ts';
import { HUBSPOT_PORTAL_ID, HubSpotPage } from '../src/pages/hubspot/hubspot.page.ts';
import { assertSessionFresh } from '../src/utils/session.ts';

const [email, fullName] = process.argv.slice(2);
if (!email || !fullName) {
  console.error('Usage: npm run hubspot:delete-contact -- <email> "<Full Name>"');
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices['Desktop Chrome'],
  viewport: { width: 1440, height: 900 },
  storageState: assertSessionFresh('hubspot', 'linkclick', 'chromium'),
});
const page = await context.newPage();
await HubSpotPage.closePopups(page);
const listUrl = new URL(
  `/contacts/${HUBSPOT_PORTAL_ID}/objects/0-1/views/all/list?query=${encodeURIComponent(email)}`,
  platforms.hubspot.baseURL,
).toString();
await page.goto(listUrl);

const link = page.getByRole('link', { name: fullName, exact: true });
await link.first().waitFor({ timeout: 20_000 }).catch(() => undefined);
const found = await link.count();
console.log(`contacts matching: ${found}`);
if (found !== 1) {
  console.log('Not deleting: expected exactly 1 contact.');
  await browser.close();
  process.exit(2);
}

await link.first().click();
await page.waitForURL(/\/record\/0-1\/\d+/);
await page.getByText('Key information').first().waitFor({ timeout: 30_000 });
await page.getByRole('button', { name: 'Actions', exact: true }).first().click();
// The Actions menu shows a spinner for a few seconds before its items load.
await page.waitForTimeout(8000);
await page.getByText('Delete', { exact: true }).first().click();
const dialog = page.getByRole('dialog');
// The confirmation asks to type "delete" in some portals; fill it when shown.
const confirmBox = dialog.getByRole('textbox');
if (await confirmBox.count()) await confirmBox.fill('delete');
await dialog.getByRole('button', { name: /^Delete/ }).click();
await page.waitForURL(/\/objects\/0-1\//, { timeout: 30_000 });

await page.goto(listUrl);
await page.waitForTimeout(5000);
const left = await link.count();
console.log(`contacts after delete: ${left}`);
await browser.close();
process.exit(left === 0 ? 0 : 3);
