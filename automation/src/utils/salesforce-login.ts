import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Cookie, Page } from '@playwright/test';
import type { Account } from '../config/accounts.ts';
import type { Browser } from '../config/environments.ts';
import { authFile } from './session.ts';

// Salesforce login without a code (2026-10-28): the SOAP API login() returns a session
// id, and frontdoor.jsp?sid= turns it into a browser login. No code is asked because
// the Tailscale exit node's IP (44.229.234.59) is a trusted range in Setup → Network
// Access; from any other IP Salesforce answers LOGIN_MUST_USE_SECURITY_TOKEN.

const AUTOMATION_DIR = path.resolve(import.meta.dirname, '../..');

// .env first (when someone made one), else .env.example. Never printed.
function credentials(): { username: string; password: string } {
  const example = Object.fromEntries(
    fs
      .readFileSync(path.join(AUTOMATION_DIR, '.env.example'), 'utf8')
      .split('\n')
      .map((line) => line.match(/^([A-Z_]+)=(.*)$/))
      .filter((m) => m !== null)
      .map((m) => [m[1], m[2].trim()]),
  );
  const username = process.env.SALESFORCE_SANDBOX_USERNAME || example.SALESFORCE_SANDBOX_USERNAME;
  const password = process.env.SALESFORCE_SANDBOX_PASSWORD || example.SALESFORCE_SANDBOX_PASSWORD;
  if (!username || !password) throw new Error('SALESFORCE_SANDBOX_USERNAME / SALESFORCE_SANDBOX_PASSWORD are not set in .env or .env.example.');
  return { username, password };
}

// The frontdoor.jsp URL that logs a browser in and then opens retURL (a path on the org).
// It holds a live session id: open it only in a process with no Playwright trace.
export async function salesforceFrontdoorUrl(retURL: string): Promise<string> {
  const { username, password } = credentials();
  const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const res = await fetch('https://login.salesforce.com/services/Soap/u/62.0', {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=UTF-8', SOAPAction: 'login' },
    body: `<?xml version="1.0" encoding="utf-8"?><env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><n1:login xmlns:n1="urn:partner.soap.sforce.com"><n1:username>${xml(username)}</n1:username><n1:password>${xml(password)}</n1:password></n1:login></env:Body></env:Envelope>`,
  });
  const body = await res.text();
  const sessionId = body.match(/<sessionId>([^<]+)/)?.[1];
  const serverUrl = body.match(/<serverUrl>([^<]+)/)?.[1];
  if (!sessionId || !serverUrl) {
    throw new Error(`Salesforce API login failed: ${body.match(/<faultstring>([^<]+)/)?.[1] ?? `HTTP ${res.status}`}`);
  }
  const url = new URL('/secur/frontdoor.jsp', serverUrl);
  url.searchParams.set('sid', sessionId);
  url.searchParams.set('retURL', retURL);
  return url.toString();
}

// Logs in again through the API and saves auth/salesforce-<account>-<browser>.json, in
// its own process (scripts/login-salesforce-auto.ts) so no trace records the session id.
// Returns the new cookies. Throws when the login did not finish.
export async function freshSalesforceCookies(account: Account, browser: Browser): Promise<Cookie[]> {
  const child = spawn(process.execPath, ['--env-file-if-exists=.env', 'scripts/login-salesforce-auto.ts', account, browser], {
    cwd: AUTOMATION_DIR,
    stdio: 'inherit',
  });
  const [code] = await once(child, 'exit');
  if (code !== 0) throw new Error(`Salesforce API login for ${account} did not finish (see the lines above).`);
  return JSON.parse(fs.readFileSync(authFile('salesforce', account, browser), 'utf8')).cookies;
}

// Which account and browser each Salesforce context belongs to, so a page that lands on
// the Salesforce Login mid-test can log its own context in again (gotoSalesforce).
const owners = new WeakMap<BrowserContext, { account: Account; browser: Browser }>();

export function registerSalesforceContext(context: BrowserContext, account: Account, browser: Browser): void {
  owners.set(context, { account, browser });
}

const onLoginPage = async (page: Page) => (await page.title()).startsWith('Login');

// page.goto for a Salesforce page. If the session expired (Salesforce shows its Login
// page), logs in again through the API, gives the context the new cookies and opens
// the page once more, so the test goes on.
export async function gotoSalesforce(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (!(await onLoginPage(page))) return;
  const owner = owners.get(page.context());
  if (!owner) throw new Error('salesforce session expired (the page shows the Salesforce Login), and this page is not from the test fixtures, so it cannot log in again.');
  await page.context().addCookies(await freshSalesforceCookies(owner.account, owner.browser));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (await onLoginPage(page)) throw new Error('salesforce still shows its Login page right after a fresh API login.');
}
