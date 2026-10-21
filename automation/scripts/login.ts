// Usage: npm run login:saleshandy -- <account> (Chromium)
//    or: npm run login:saleshandy:edge -- <account>
//        npm run login:hubspot (or :edge), no account: one HubSpot portal for all
// Accounts are listed in src/config/accounts.ts, one per workflow.
// Opens a headed browser. You log in yourself (2FA/OAuth included), then press
// Enter here and the session is saved to auth/<platform>-<account>-<browser>.json.
// If a saved session exists it is loaded first, so you see whether you are still
// logged in. Add --force to start from a clean, logged-out browser.
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { accounts, isAccount, type Account } from '../src/config/accounts.ts';
import { baseUrlFor, browsers, isBrowser, isPlatform, isSharedPlatform, platforms } from '../src/config/environments.ts';
import { authFile } from '../src/utils/session.ts';

// Platform first; account, browser and --force in any order after it.
const [platform, ...rest] = process.argv.slice(2);
const force = rest.includes('--force');
const sharedPlatform = isPlatform(platform) && isSharedPlatform(platform); // one common portal or org, one session per browser
// HubSpot needs no account; any account is ignored (session file is the same).
const account = rest.find(isAccount) ?? (sharedPlatform ? Object.keys(accounts)[0] as Account : undefined);
const browserName = rest.find(isBrowser) ?? 'chromium';
if (!isPlatform(platform)) {
  console.error(`Unknown platform "${platform}". Use one of: ${Object.keys(platforms).join(', ')}`);
  process.exit(1);
}
const unknown = rest.filter((a) => a !== '--force' && !isAccount(a) && !isBrowser(a));
if (!account || unknown.length > 0) {
  console.error(
    `${unknown.length > 0 ? `Unknown argument "${unknown.join(' ')}". ` : 'Missing account. '}` +
      `Use: npm run login:${platform} -- <account>, with one of: ${Object.keys(accounts).join(', ')}`,
  );
  process.exit(1);
}

const { loginPath } = platforms[platform];
const baseURL = baseUrlFor(platform, account);
const { device, channel } = browsers[browserName];
const file = authFile(platform, account, browserName);
const reuse = !force && fs.existsSync(file);
const who = sharedPlatform ? `to the shared ${platform} portal or org` : `as ${accounts[account].saleshandy}`;
const label = sharedPlatform ? platform : `${platform} ${account}`;

const browser = await chromium.launch({ headless: false, channel });
// Same device preset as the tests, so the saved session matches how tests look to the site.
const context = await browser.newContext({
  ...devices[device],
  storageState: reuse ? file : undefined,
});
const page = await context.newPage();
// 'domcontentloaded', not the default 'load': Salesforce Lightning keeps background
// polling/XHR running, so 'load' can time out even once the page is actually usable.
await page.goto(new URL(loginPath, baseURL).toString(), { waitUntil: 'domcontentloaded', timeout: 60000 });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
await rl.question(
  reuse
    ? `Loaded the saved ${label} session in ${browserName}. If you are still logged in ${who}, ` +
        `just press Enter; otherwise log in first, then press Enter... `
    : `Log in to ${platform} ${who} in ${browserName}, then press Enter here to save the session... `,
);
rl.close();

fs.mkdirSync(path.dirname(file), { recursive: true });
await context.storageState({ path: file });
await browser.close();
console.log(`Saved ${label} ${browserName} session to auth/${path.basename(file)} (valid for about 7 days).`);
