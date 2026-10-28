import fs from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import type { Account } from '../config/accounts.ts';
import { isProduction, type Browser } from '../config/environments.ts';
import { freshSalesforceCookies } from '../utils/salesforce-login.ts';

// Saleshandy shows "Re-connect" on the Salesforce card when Refold's getApp() returns
// reauth_required (saleshandy-webui crm-view.tsx:83). Clicking it opens a "Continue"
// confirmation (connect-confirmation.tsx), then refold-js connect() opens Refold's
// auth_url in a popup and closes the popup itself once Refold reports the account
// active (refold-js refold.ts:633-717). So "the popup closed by itself" = reconnected.
//
// Each reconnect takes one of the few refresh-token slots Salesforce keeps per user,
// so it runs only when the card already shows Re-connect, once per test, one lane at a
// time (lock below), and never on a production account (plan rule 7).

const AUTOMATION_DIR = path.resolve(import.meta.dirname, '../..');
const LOCK = path.join(AUTOMATION_DIR, 'locks', 'salesforce-reconnect');
const LOCK_STALE_MS = 15 * 60_000; // far longer than a reconnect with an API login

type Outcome = 'connected' | 'login' | 'stuck';

export async function reconnectSalesforce(
  page: Page,
  account: Account,
  browser: Browser,
  // The worker's logged-in Salesforce context (the "Salesforce tab"), if it has one.
  salesforceContext: () => Promise<BrowserContext | undefined>,
): Promise<void> {
  if (isProduction(account)) {
    throw new Error(`Salesforce shows "Re-connect" on production account ${account}. Reconnect it by hand (plan rule 7), then run again.`);
  }
  await oneAtATime(async () => {
    // Case 1: Salesforce is logged in in this worker. Its cookies make the popup approve
    // without a login page. The popup opens in the Saleshandy context, so copy them there.
    const sfContext = await salesforceContext();
    if (sfContext) await page.context().addCookies(await sfContext.cookies());
    const first = await clickReconnect(page);
    if (first === 'connected') return;
    if (first === 'stuck') throw new Error('The Re-connect popup neither closed nor showed a login within 2 minutes. Reconnect by hand.');

    // Case 2 and 3: the popup asked for a login. Log in again through the Salesforce
    // API (no code: src/utils/salesforce-login.ts) and retry with the new cookies.
    const cookies = await freshSalesforceCookies(account, browser);
    await page.context().addCookies(cookies);
    await sfContext?.addCookies(cookies); // the worker's Salesforce pages use the new login too
    const second = await clickReconnect(page);
    if (second !== 'connected') {
      throw new Error(
        second === 'login'
          ? 'The Re-connect popup asked for a Salesforce login again right after a fresh login. Reconnect by hand.'
          : 'The Re-connect popup neither closed nor showed a login within 2 minutes. Reconnect by hand.',
      );
    }
  });
}

async function clickReconnect(page: Page): Promise<Outcome> {
  await page.goto('/api-and-integrations/integrations');
  await page.getByText('Re-connect', { exact: true }).first().click();
  const popup = page.waitForEvent('popup', { timeout: 60_000 });
  await page.getByRole('dialog').getByRole('button', { name: 'Continue', exact: true }).click();
  const auth = await popup;

  // Salesforce shows "Allow" only on a user's first approval of the app.
  // TODO(needs-input): confirm the button name on the org's approval page.
  void auth.getByRole('button', { name: 'Allow' }).click({ timeout: 30_000 }).catch(() => {});
  // Each branch catches its own error, so the losing one is never an unhandled rejection.
  const outcome = await Promise.race<Outcome>([
    auth.waitForEvent('close', { timeout: 120_000 }).then(() => 'connected' as const, () => 'stuck' as const),
    auth.locator('#username').waitFor({ timeout: 120_000 }).then(() => 'login' as const, () => 'stuck' as const),
  ]);
  if (outcome !== 'connected' && !auth.isClosed()) await auth.close();
  return outcome;
}

// One reconnect at a time across all lanes: two at once take two token slots and can
// cancel each other. mkdir is atomic. Taken after nothing else and with a time limit,
// so lanes cannot deadlock on it; a folder older than LOCK_STALE_MS is from a killed run.
async function oneAtATime(work: () => Promise<void>): Promise<void> {
  fs.mkdirSync(path.dirname(LOCK), { recursive: true });
  const deadline = Date.now() + LOCK_STALE_MS;
  for (;;) {
    try {
      fs.mkdirSync(LOCK);
      break;
    } catch {
      const age = Date.now() - (fs.statSync(LOCK, { throwIfNoEntry: false })?.mtimeMs ?? Date.now());
      if (age > LOCK_STALE_MS) fs.rmSync(LOCK, { recursive: true, force: true });
      else if (Date.now() > deadline) throw new Error('Another lane has been reconnecting Salesforce for 15 minutes; run this lane again.');
      else await new Promise((r) => setTimeout(r, 5_000));
    }
  }
  try {
    await work();
  } finally {
    fs.rmSync(LOCK, { recursive: true, force: true });
  }
}
