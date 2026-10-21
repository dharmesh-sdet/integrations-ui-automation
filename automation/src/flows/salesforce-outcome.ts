import { expect, type Page } from '@playwright/test';
import type { SalesforceIntegrationPage, SalesforceLogEntry } from '../pages/saleshandy/salesforce-integration.page.ts';
import { logEntryTime } from './salesforce-reply.ts';

// Name on Triggers & Activity and in Logs.
export const TRIGGER = 'Prospect Outcome is updated in Saleshandy';

// QA, 2026-10-20: a matching row polls Salesforce for up to 3 minutes; a
// non-matching row waits the full 3 minutes and then checks Salesforce.
export const WINDOW_MS = 3 * 60_000;

// Looks in Salesforce 15 s after the outcome change, then every 10 s, until `look`
// returns a value or the window ends. Each look loads the Salesforce list fresh.
export async function pollFor<T>(page: Page, look: () => Promise<T | undefined>, windowMs = WINDOW_MS): Promise<T | undefined> {
  const end = Date.now() + windowMs;
  await page.waitForTimeout(15_000);
  for (;;) {
    const found = await look();
    if (found !== undefined) return found;
    if (Date.now() + 10_000 > end) return undefined;
    await page.waitForTimeout(10_000);
  }
}

// Logs entries of this trigger created since `sinceMs` (20 s of clock difference
// allowed). Entries are read from the list, never opened.
async function entriesSince(sf: SalesforceIntegrationPage, sinceMs: number): Promise<SalesforceLogEntry[]> {
  await sf.refreshLogs();
  return (await sf.logEntries(TRIGGER)).filter((e) => e.id !== '' && logEntryTime(e.id) >= sinceMs - 20_000);
}

// Non-matching rows: waits the 3 minutes, refreshing Logs 15 s after the change and
// then every 10 s, and returns the entries seen. A Logs row is allowed on a
// non-matching outcome (QA, 2026-10-20), so entries are returned for the record, not judged.
export async function watchLogs(sf: SalesforceIntegrationPage, sinceMs: number, windowMs = WINDOW_MS): Promise<SalesforceLogEntry[]> {
  await sf.openLogs();
  const end = sinceMs + windowMs;
  await sf.page.waitForTimeout(15_000);
  let seen: SalesforceLogEntry[] = [];
  for (;;) {
    seen = await entriesSince(sf, sinceMs);
    if (Date.now() + 10_000 > end) return seen;
    await sf.page.waitForTimeout(10_000);
  }
}

// Fallback when a matching row's record is not in Salesforce after the window:
// the finished Logs entry of this change (retries up to 2 minutes while it runs).
export async function finishedEntry(sf: SalesforceIntegrationPage, sinceMs: number): Promise<SalesforceLogEntry | undefined> {
  await sf.openLogs();
  let entry: SalesforceLogEntry | undefined;
  await expect(async () => {
    const fresh = await entriesSince(sf, sinceMs);
    entry = fresh.find((e) => e.status === 'Success' || e.status === 'Error');
    expect(entry, `Logs entries since the change: ${fresh.map((e) => e.text).join(' | ') || 'none'}`).toBeTruthy();
  }).toPass({ timeout: 2 * 60_000, intervals: [10_000] }).catch(() => {});
  return entry;
}
