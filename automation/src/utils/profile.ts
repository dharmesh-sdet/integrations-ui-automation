import fs from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Page } from 'playwright';

const authDir = path.resolve(import.meta.dirname, '../../auth');

// A saved browser profile that lost its login lands on one of these pages.
// Zoho sends every expired or unverified login to accounts.zoho.*; the other
// platforms go to a /login path.
export function isLoggedOutUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return /^accounts\.zoho\./.test(u.hostname) || /\/login(\/|$)/.test(u.pathname);
  } catch {
    return false;
  }
}

// Deletes auth/<name>. Refuses when a browser still holds the profile (Chrome
// keeps a SingletonLock link in it while open) or when the name is not a profile.
export function dropProfile(name: string): boolean {
  if (!/^[\w.-]+-profile[\w.-]*$/.test(name)) return false;
  const dir = path.join(authDir, name);
  if (!fs.existsSync(dir)) return false;
  try {
    fs.lstatSync(path.join(dir, 'SingletonLock'));
    return false;
  } catch {
    // no lock file: not open
  }
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

// Gate for scripts that open a saved profile: when the page landed on a login
// page, close the browser, delete the dead profile, say how to log in again and stop.
export async function exitIfExpired(context: BrowserContext, page: Page, profile: string, loginHint: string): Promise<void> {
  if (!isLoggedOutUrl(page.url())) return;
  const where = page.url().split('?')[0];
  await context.close().catch(() => {});
  const deleted = dropProfile(profile);
  console.error(
    `Login expired (the page went to ${where}). ${deleted ? `Deleted auth/${profile}.` : `Could not delete auth/${profile} (a browser may still hold it).`} Log in again: ${loginHint}`,
  );
  process.exit(3);
}
