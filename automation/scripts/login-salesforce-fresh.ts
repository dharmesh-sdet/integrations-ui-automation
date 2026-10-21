// Usage: npm run login:salesforce:fresh
// Opens a new, logged-out, throwaway browser (no saved session, no MCP profile, no
// attach to a running browser). You log in to the Salesforce org yourself (SSO/MFA
// included), then press Enter here. The script opens a Lead list to check that
// Lightning really loaded, and only then saves the session to a new file
// auth/salesforce-fresh-<timestamp>-chromium.json. It never overwrites a file.
// It does not touch Saleshandy's "Reconnect to Salesforce" prompt; that is a separate issue.
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { browsers, platforms } from '../src/config/environments.ts';

const { baseURL, loginPath } = platforms.salesforce;
const { device, channel } = browsers.chromium;
const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const file = path.resolve(import.meta.dirname, '../auth', `salesforce-fresh-${stamp}-chromium.json`);
if (fs.existsSync(file)) {
  console.error(`auth/${path.basename(file)} already exists; run again in a second.`);
  process.exit(1);
}

const browser = await chromium.launch({ headless: false, channel });
const context = await browser.newContext({ ...devices[device] });
const page = await context.newPage();
await page.goto(new URL(loginPath, baseURL).toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
await rl.question('Log in to Salesforce in the opened browser (SSO/MFA included), wait for the home page, then press Enter here... ');
rl.close();

// Same check the Salesforce page objects use (object.page.ts openList): the
// Lead list loads with its search box and the title is not the Salesforce Login.
let verified = false;
try {
  await page.goto(new URL('/lightning/o/Lead/list?filterName=__Recent', baseURL).toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const onOrg = new URL(page.url()).origin === new URL(baseURL).origin;
  const loginPage = (await page.title()).startsWith('Login');
  await page.getByPlaceholder('Search this list...').waitFor({ timeout: 30_000 });
  verified = onOrg && !loginPage;
} catch {
  verified = false;
}

if (!verified) {
  await browser.close();
  console.error('Salesforce login is not complete (Lead list did not load as a logged-in user). Nothing was saved. Run it again.');
  process.exit(1);
}

fs.mkdirSync(path.dirname(file), { recursive: true });
await context.storageState({ path: file });
await browser.close();
console.log(`Verified Salesforce login. Saved session to auth/${path.basename(file)}.`);
