// Usage: node scripts/login-salesforce-api.ts
//
// Logs in to Salesforce through the API (no code: src/utils/salesforce-login.ts) and
// opens a visible browser already logged in, on the Lead list. The window stays open
// until you close it. Nothing is saved; the tests log in by themselves.
import { chromium } from '@playwright/test';
import { salesforceFrontdoorUrl } from '../src/utils/salesforce-login.ts';

let frontdoor: string;
try {
  frontdoor = await salesforceFrontdoorUrl('/lightning/o/Lead/list?filterName=__Recent');
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
console.log('Salesforce API login OK. Opening the browser...');

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: null });
await page.goto(frontdoor, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.getByPlaceholder('Search this list...').waitFor({ timeout: 60_000 });
console.log(`Logged in. Browser is open at ${new URL(page.url()).origin}. Close the window to exit.`);

await page.waitForEvent('close', { timeout: 0 });
await browser.close();
