# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: hubspot/reply-received.spec.ts >> Reply is received in Saleshandy >> Create a Task in HubSpot > 1: Contact in HubSpot
- Location: src/flows/activity-rows.ts:695:5

# Error details

```
Error: Task not found on the HubSpot record 0-1/567363524308 (gave up after 180 seconds)

Timeout 180000ms exceeded while waiting on the predicate
```

# Test source

```ts
  1  | import { expect, type Page } from '@playwright/test';
  2  | 
  3  | // Saleshandy Logs cadence, from QA (2026-10-08): refresh 15 seconds after the
  4  | // action, then every 10 seconds, because a third party (Refold) delivers the
  5  | // data late. Observed on staging: Success after about 1 to 1.5 minutes.
  6  | export const FIRST_CHECK_MS = 15_000;
  7  | export const RETRY_MS = 10_000;
  8  | export const LOG_TIMEOUT_MS = 3 * 60_000;
  9  | 
  10 | // Thrown from inside a check to stop the wait at once: waiting longer cannot
  11 | // help (for example a Logs entry already shows Error).
  12 | export class StopWaiting extends Error {}
  13 | 
  14 | // Retries `check` (which should refresh the screen, then assert) on that
  15 | // cadence until it passes or the timeout runs out. A check that throws
  16 | // StopWaiting ends the wait at once and the test fails with that message.
  17 | export async function untilPasses(
  18 |   what: string,
  19 |   check: () => Promise<void>,
  20 |   timeout = LOG_TIMEOUT_MS,
  21 | ): Promise<void> {
  22 |   let stop: StopWaiting | undefined;
  23 |   await expect(
  24 |     async () => {
  25 |       try {
  26 |         await check();
  27 |       } catch (e) {
  28 |         if (!(e instanceof StopWaiting)) throw e;
  29 |         stop = e;
  30 |       }
  31 |     },
  32 |     `${what} (gave up after ${timeout / 1000} seconds)`,
> 33 |   ).toPass({ timeout, intervals: [FIRST_CHECK_MS, RETRY_MS] });
     |     ^ Error: Task not found on the HubSpot record 0-1/567363524308 (gave up after 180 seconds)
  34 |   if (stop) throw stop;
  35 | }
  36 | 
  37 | // For checks that wait for Success: a log entry that already shows Error will
  38 | // not turn into Success (failed runs cannot be re-run), so stop waiting.
  39 | // Statuses seen on Logs: Success, Error, In progress/Running.
  40 | export function stopOnErrorLogs(trigger: string, entries: { id: string; status: string }[]): void {
  41 |   const failed = entries.filter((e) => e.status === 'Error');
  42 |   if (failed.length > 0) {
  43 |     throw new StopWaiting(
  44 |       `"${trigger}" log ${failed.map((e) => e.id).join(', ')} shows Error, so it will not reach Success`,
  45 |     );
  46 |   }
  47 | }
  48 | 
  49 | // For "nothing should happen" checks: runs `check` 15 seconds after the action,
  50 | // then every 10 seconds, `times` times in total (3 times = checks at 15, 25 and
  51 | // 35 seconds; entries always appeared within about 15 seconds). A negative
  52 | // check needs to wait out the window, so this is the one place with deliberate
  53 | // waits.
  54 | export async function staysTrue(page: Page, check: () => Promise<void>, times = 3): Promise<void> {
  55 |   for (let i = 0; i < times; i++) {
  56 |     await page.waitForTimeout(i === 0 ? FIRST_CHECK_MS : RETRY_MS);
  57 |     await check();
  58 |   }
  59 | }
  60 | 
```