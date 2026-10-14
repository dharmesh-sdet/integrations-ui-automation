import fs from 'node:fs';
import path from 'node:path';
import type { Account } from '../config/accounts.ts';
import type { Browser, Platform } from '../config/environments.ts';

// Sessions last about a week. We only look at the file age, never its contents.
const MAX_SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// One session per platform, account and browser: each workflow has its own
// account, and a site may treat browsers differently. HubSpot is one common
// portal for every account, so it has one session per browser.
export function authFile(platform: Platform, account: Account, browser: Browser): string {
  const name = platform === 'hubspot' ? `${platform}-${browser}` : `${platform}-${account}-${browser}`;
  return path.resolve(import.meta.dirname, '../../auth', `${name}.json`);
}

// HubSpot is shared, so its login command has no account.
export function loginCommand(platform: Platform, account: Account, browser: Browser): string {
  const script = `npm run login:${platform}${browser === 'chromium' ? '' : `:${browser}`}`;
  return platform === 'hubspot' ? script : `${script} -- ${account}`;
}

export function assertSessionFresh(platform: Platform, account: Account, browser: Browser): string {
  const file = authFile(platform, account, browser);
  const loginHint = `run ${loginCommand(platform, account, browser)}`;

  if (!fs.existsSync(file)) {
    throw new Error(`No saved ${platform} session${platform === 'hubspot' ? '' : ` for ${account}`} (${browser}), ${loginHint}`);
  }
  const ageMs = Date.now() - fs.statSync(file).mtimeMs;
  if (ageMs > MAX_SESSION_AGE_MS) {
    const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    throw new Error(
      `${platform} session${platform === 'hubspot' ? '' : ` for ${account}`} (${browser}) expired (saved ${days} days ago), ${loginHint}`,
    );
  }
  return file;
}
