import { expect, type Page } from '@playwright/test';
import type { SalesforceIntegrationPage, SalesforceLogEntry } from '../pages/saleshandy/salesforce-integration.page.ts';

// Name on Triggers & Activity and in Logs (seen 2026-10-16).
export const TRIGGER = 'Reply is Received in Saleshandy';

// QA's way of checking a run (2026-10-20): wait 15 s after the trigger event and look
// in Salesforce. If the record is not there, wait 5 s and look again; each look
// loads the Salesforce list fresh, which is the hard refresh. `look` returns the
// record's data, or undefined while it is not there.
export async function lookAfterReply<T>(page: Page, look: () => Promise<T | undefined>): Promise<T | undefined> {
  await page.waitForTimeout(15_000);
  const first = await look();
  if (first !== undefined) return first;
  await page.waitForTimeout(5_000);
  return look();
}

// A Logs entry id is a 24-hex ObjectId; its first 8 hex digits are the creation
// time in seconds (checked 2026-10-20: 6ad737e2 is the entry shown as 3:14 PM IST).
export function logEntryTime(id: string): number {
  return parseInt(id.slice(0, 8), 16) * 1000;
}

// Fallback when the record is not in Salesforce: open Logs once and read the
// finished entry this reply created (newer than `sinceMs`, with 20 s of clock
// difference allowed). Retries for up to `timeoutMs` (2 minutes) while the run is still going.
export async function newLogEntry(sf: SalesforceIntegrationPage, sinceMs: number, timeoutMs = 2 * 60_000): Promise<SalesforceLogEntry> {
  await sf.openLogs();
  let entry: SalesforceLogEntry | undefined;
  await expect(async () => {
    await sf.refreshLogs();
    const fresh = (await sf.logEntries(TRIGGER)).filter((e) => e.id !== '' && logEntryTime(e.id) >= sinceMs - 20_000);
    entry = fresh.find((e) => e.status === 'Success' || e.status === 'Error');
    expect(entry, `Logs entries since the reply: ${fresh.map((e) => e.text).join(' | ') || 'none'}`).toBeTruthy();
  }).toPass({ timeout: timeoutMs, intervals: [10_000] });
  return entry!;
}
