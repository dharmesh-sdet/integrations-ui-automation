// Usage: npm run login:salesforce:auto -- <account> [chromium|edge]
// Also run by the Salesforce Re-connect step (src/flows/salesforce-connection.ts)
// when the Re-connect popup shows the Salesforce login.
//
// Opens a visible browser with the account's old saved Salesforce session (an
// expired one too: its cookies tell Salesforce this browser was verified before),
// opens the org's Lead list and, if Salesforce shows its login page, fills in
// SALESFORCE_SANDBOX_USERNAME and SALESFORCE_SANDBOX_PASSWORD from .env.
// If Salesforce then asks for anything else (an SMS code), it notifies QA and waits
// up to 5 minutes for QA to finish in that window. Only when the Lead list loads is
// the session saved to auth/salesforce-<account>-<browser>.json. On any failure
// nothing is saved and the old file stays.
// Its own process, so no Playwright trace or report ever records the password.
// Values from .env are never printed.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from '@playwright/test';
import { isAccount } from '../src/config/accounts.ts';
import { browsers, isBrowser, platforms } from '../src/config/environments.ts';
import { authFile } from '../src/utils/session.ts';

const QA_WAIT_MS = 5 * 60_000;

const [account, browserName = 'chromium'] = process.argv.slice(2);
if (!isAccount(account) || !isBrowser(browserName)) {
  console.error('Use: npm run login:salesforce:auto -- <account> [chromium|edge]');
  process.exit(1);
}
const { SALESFORCE_SANDBOX_USERNAME: username, SALESFORCE_SANDBOX_PASSWORD: password } = process.env;

function notify(message: string): void {
  console.log(message);
  spawnSync('notify-send', ['Salesforce login', message]); // no-op where notify-send is missing
}

const file = authFile('salesforce', account, browserName);
const { device, channel } = browsers[browserName];
// Visible, so QA can type a code into it when Salesforce asks for one.
const browser = await chromium.launch({ headless: false, channel });
const context = await browser.newContext({ ...devices[device], storageState: fs.existsSync(file) ? file : undefined });
const page = await context.newPage();

// Same check as login-salesforce-fresh.ts: the Lead list loads with its search box.
const leadList = page.getByPlaceholder('Search this list...');
// TODO(needs-input): confirm both ids on the org's login page (plan rule 2). They are
// the standard Salesforce login form ids.
const usernameField = page.locator('#username');

// Where the page is: the Lead list, the Salesforce login form, or a screen only QA can
// finish (the SMS code). The code screen is recognised as 5 s on a page that is not the
// org's own (Lightning) pages and has no login form; the login redirects pass in less.
async function where(): Promise<'list' | 'login' | 'qa'> {
  const lightning = new URL(platforms.salesforce.baseURL).origin;
  let offLightningSince = 0;
  for (const deadline = Date.now() + 90_000; Date.now() < deadline; await page.waitForTimeout(1_000)) {
    if (await leadList.isVisible()) return 'list';
    if (await usernameField.isVisible()) return 'login';
    if (new URL(page.url()).origin === lightning) offLightningSince = 0;
    else if (!offLightningSince) offLightningSince = Date.now();
    else if (Date.now() - offLightningSince >= 5_000) return 'qa';
  }
  return 'qa';
}

let saved = false;
try {
  await page.goto(new URL('/lightning/o/Lead/list?filterName=__Recent', platforms.salesforce.baseURL).toString(), {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  let at = await where();

  if (at === 'login') {
    if (username && password) {
      await usernameField.fill(username);
      await page.locator('#password').fill(password);
      // Wait for the page that answers the login, so the old form is not read as a rejection.
      const answered = page.waitForEvent('framenavigated', { predicate: (f) => f === page.mainFrame(), timeout: 30_000 });
      await page.locator('#Login').click();
      await answered;
      at = await where();
      if (at === 'login') throw new Error('Salesforce rejected the username or password in .env (the login page is still shown).');
    } else {
      console.log('SALESFORCE_SANDBOX_USERNAME / SALESFORCE_SANDBOX_PASSWORD are not set in .env.');
      at = 'qa';
    }
  }

  // An SMS code, an identity check or a missing .env login needs QA in the open window.
  if (at === 'qa') {
    notify(`Salesforce needs you (account ${account}): finish the login in the open browser window (SMS code). Waiting up to 5 minutes.`);
    await leadList.waitFor({ timeout: QA_WAIT_MS });
  }

  const onOrg = new URL(page.url()).origin === new URL(platforms.salesforce.baseURL).origin;
  if (!onOrg || (await page.title()).startsWith('Login')) throw new Error('The Lead list did not load as a logged-in user.');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await context.storageState({ path: file });
  saved = true;
} catch (e) {
  console.error(`Salesforce login not finished: ${(e as Error).message.split('\n')[0]} Nothing was saved.`);
} finally {
  await browser.close();
}

if (!saved) process.exit(1);
console.log(`Salesforce login saved to auth/${path.basename(file)}.`);
