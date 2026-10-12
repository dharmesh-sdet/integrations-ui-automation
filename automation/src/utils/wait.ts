import { expect, type Page } from '@playwright/test';

// Saleshandy Logs cadence, from QA (2026-10-08): refresh 15 seconds after the
// action, then every 10 seconds, because a third party (Refold) delivers the
// data late. Observed on staging: Success after about 1 to 1.5 minutes.
export const FIRST_CHECK_MS = 15_000;
export const RETRY_MS = 10_000;
export const LOG_TIMEOUT_MS = 3 * 60_000;

// Retries `check` (which should refresh the screen, then assert) on that
// cadence until it passes or the timeout runs out.
export async function untilPasses(
  what: string,
  check: () => Promise<void>,
  timeout = LOG_TIMEOUT_MS,
): Promise<void> {
  await expect(check, `${what} (gave up after ${timeout / 1000} seconds)`).toPass({
    timeout,
    intervals: [FIRST_CHECK_MS, RETRY_MS],
  });
}

// For "nothing should happen" checks: runs `check` 15 seconds after the action,
// then every 10 seconds, `times` times in total. A negative check needs to wait
// out the window, so this is the one place with deliberate waits.
export async function staysTrue(page: Page, check: () => Promise<void>, times = 4): Promise<void> {
  for (let i = 0; i < times; i++) {
    await page.waitForTimeout(i === 0 ? FIRST_CHECK_MS : RETRY_MS);
    await check();
  }
}
