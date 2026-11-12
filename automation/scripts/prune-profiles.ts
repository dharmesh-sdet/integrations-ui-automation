// Finds saved browser profiles in auth/ whose login is gone and, with --delete, removes them.
// It opens each profile, visits the platform and checks whether the page went to a login page.
// Dry run by default: it only prints. A profile that a browser holds is skipped.
//   npm run profiles:prune                      # report only
//   npm run profiles:prune -- --delete          # delete the expired ones
//   npm run profiles:prune -- zoho-link-clicked-profile   # only the named profiles
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { dropProfile, isLoggedOutUrl } from '../src/utils/profile.ts';

const authDir = path.resolve(import.meta.dirname, '../auth');
const args = process.argv.slice(2);
const doDelete = args.includes('--delete');
const only = args.filter((a) => !a.startsWith('--'));

// Only profiles we know are checked. Any other name is skipped, never guessed,
// because --delete would remove a live profile that was tested on the wrong platform.
const HUBSPOT = new Set(['mcp-companycreated-profile', 'mcp-emailopened-profile']);
const SALESHANDY = new Set(['mcp-localproject-profile', 'mcp-chromium-profile']);
function urlFor(name: string): string | undefined {
  if (/^(mcp-)?zoho-/.test(name) || name.startsWith('mcp-zoho')) return 'https://crm.zoho.com/crm/ShowHomePage.do';
  if (HUBSPOT.has(name)) return 'https://app-na2.hubspot.com/';
  if (SALESHANDY.has(name)) return 'https://pyxis.lifeisgoodforlearner.com/crm/list';
  return undefined;
}

const names = fs
  .readdirSync(authDir)
  .filter((n) => /-profile/.test(n) && fs.statSync(path.join(authDir, n)).isDirectory())
  .filter((n) => only.length === 0 || only.includes(n));

let freedDirs = 0;
for (const name of names) {
  const url = urlFor(name);
  if (!url) {
    console.log(name.padEnd(48), 'SKIPPED (platform unknown)');
    continue;
  }
  try {
    const ctx = await chromium.launchPersistentContext(path.join(authDir, name), { headless: false, viewport: { width: 1280, height: 800 } });
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(10000);
    const landed = page.url().split('?')[0];
    const expired = isLoggedOutUrl(landed);
    await ctx.close();
    if (expired && doDelete) freedDirs += dropProfile(name) ? 1 : 0;
    console.log(name.padEnd(48), expired ? (doDelete ? 'EXPIRED, deleted' : 'EXPIRED') : 'LIVE', landed);
  } catch (e) {
    console.log(name.padEnd(48), 'ERROR (kept)', (e as Error).message.split('\n')[0]);
  }
}
console.log(doDelete ? `Deleted ${freedDirs} profile(s).` : 'Dry run. Add --delete to remove the expired ones.');
