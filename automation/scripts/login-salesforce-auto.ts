// Usage: npm run login:salesforce:auto -- <account> [chromium|edge]
// Also run by the tests (src/utils/salesforce-login.ts): when a worker opens its
// Salesforce context, when a Salesforce page shows the Login mid-test, and by the
// Re-connect step (src/flows/salesforce-connection.ts) when the popup asks for a login.
//
// Logs in through the Salesforce API with SALESFORCE_SANDBOX_USERNAME and
// SALESFORCE_SANDBOX_PASSWORD (.env, else .env.example), no code asked (this IP is
// trusted in Network Access), opens frontdoor.jsp in a headless browser, and once the
// Lead list loads saves the session to auth/salesforce-<account>-<browser>.json.
// On any failure nothing is saved and the old file stays.
// Its own process, so no Playwright trace or report ever records the session id.
// Values from .env and the session id are never printed.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from '@playwright/test';
import { isAccount } from '../src/config/accounts.ts';
import { browsers, isBrowser, platforms } from '../src/config/environments.ts';
import { authFile } from '../src/utils/session.ts';
import { salesforceFrontdoorUrl } from '../src/utils/salesforce-login.ts';

const [account, browserName = 'chromium'] = process.argv.slice(2);
if (!isAccount(account) || !isBrowser(browserName)) {
  console.error('Use: npm run login:salesforce:auto -- <account> [chromium|edge]');
  process.exit(1);
}

const file = authFile('salesforce', account, browserName);
const { device, channel } = browsers[browserName];
let saved = false;
const browser = await chromium.launch({ channel });
try {
  const frontdoor = await salesforceFrontdoorUrl('/lightning/o/Lead/list?filterName=__Recent');
  const context = await browser.newContext({ ...devices[device] });
  const page = await context.newPage();
  await page.goto(frontdoor, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  // Same check as login-salesforce-fresh.ts: the Lead list loads with its search box.
  await page.getByPlaceholder('Search this list...').waitFor({ timeout: 60_000 });
  if (new URL(page.url()).origin !== new URL(platforms.salesforce.baseURL).origin) throw new Error('The Lead list did not load on the org.');
  // Write then rename: two workers of one account may log in at the same time.
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await context.storageState({ path: `${file}.${process.pid}.tmp` });
  fs.renameSync(`${file}.${process.pid}.tmp`, file);
  saved = true;
} catch (e) {
  console.error(`Salesforce login not finished: ${(e as Error).message.split('\n')[0]} Nothing was saved.`);
} finally {
  await browser.close();
}

if (!saved) process.exit(1);
console.log(`Salesforce API login saved to auth/${path.basename(file)}.`);
