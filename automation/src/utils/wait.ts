import { expect, type Page } from '@playwright/test';

// Saleshandy Logs cadence, from QA (2026-10-08): refresh 15 seconds after the
// action, then every 10 seconds, because a third party (Refold) delivers the
// data late. Observed on staging: Success after about 1 to 1.5 minutes.
export const FIRST_CHECK_MS = 15_000;
export const RETRY_MS = 10_000;
export const LOG_TIMEOUT_MS = 3 * 60_000;

// Thrown from inside a check to stop the wait at once: waiting longer cannot
// help (for example a Logs entry already shows Error).
export class StopWaiting extends Error {}

// Retries `check` (which should refresh the screen, then assert) on that
// cadence until it passes or the timeout runs out. A check that throws
// StopWaiting ends the wait at once and the test fails with that message.
export async function untilPasses(
  what: string,
  check: () => Promise<void>,
  timeout = LOG_TIMEOUT_MS,
): Promise<void> {
  let stop: StopWaiting | undefined;
  await expect(
    async () => {
      try {
        await check();
      } catch (e) {
        if (!(e instanceof StopWaiting)) throw e;
        stop = e;
      }
    },
    `${what} (gave up after ${timeout / 1000} seconds)`,
  ).toPass({ timeout, intervals: [FIRST_CHECK_MS, RETRY_MS] });
  if (stop) throw stop;
}

// For checks that wait for Success: a log entry that already shows Error will
// not turn into Success (failed runs cannot be re-run), so stop waiting.
// Statuses seen on Logs: Success, Error, In progress/Running.
export function stopOnErrorLogs(trigger: string, entries: { id: string; status: string }[]): void {
  const failed = entries.filter((e) => e.status === 'Error');
  if (failed.length > 0) {
    throw new StopWaiting(
      `"${trigger}" log ${failed.map((e) => e.id).join(', ')} shows Error, so it will not reach Success`,
    );
  }
}

// For "nothing should happen" checks: runs `check` 15 seconds after the action,
// then every 10 seconds, `times` times in total (3 times = checks at 15, 25 and
// 35 seconds; entries always appeared within about 15 seconds). A negative
// check needs to wait out the window, so this is the one place with deliberate
// waits.
export async function staysTrue(page: Page, check: () => Promise<void>, times = 3): Promise<void> {
  for (let i = 0; i < times; i++) {
    await page.waitForTimeout(i === 0 ? FIRST_CHECK_MS : RETRY_MS);
    await check();
  }
}

// Page loads that fail on the network (seen 2026-10-13 and 2026-10-14 on
// staging: "page.goto: net::ERR_CONNECTION_CLOSED" on the Triggers page, the
// test died in 0.3 s). The same URL loads a few seconds later, so try again
// instead of failing the scenario. Only the load is retried, never a whole
// test: a test retry would add the prospect again and use up test data.
const NETWORK_ERROR = /net::ERR_(CONNECTION_|NETWORK_|INTERNET_DISCONNECTED|TIMED_OUT|NAME_NOT_RESOLVED|EMPTY_RESPONSE|SOCKET_NOT_CONNECTED|ABORTED|FAILED|ADDRESS_UNREACHABLE|CERT_)|Navigation timeout|Timeout \d+ms exceeded|ERR_TOO_MANY_REDIRECTS/;
const GOTO_PAUSES_MS = [3_000, 5_000, 10_000, 20_000];

export async function gotoWithRetry(page: Page, url: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await page.goto(url);
      await waitForPageLoad(page);
      return;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (!NETWORK_ERROR.test(message) || attempt >= GOTO_PAUSES_MS.length) throw e;
      console.log(`Page load failed (${message.split('\n')[0]}); try ${attempt + 2} of ${GOTO_PAUSES_MS.length + 1} in ${GOTO_PAUSES_MS[attempt] / 1000} s`);
      await page.waitForTimeout(GOTO_PAUSES_MS[attempt]);
    }
  }
}

// A page that "loaded" but is an error page, not the app. Seen on 2026-10-14:
// HubSpot "Our website provider is having trouble loading this page" (request
// ID in the footer) during a contact search, and Saleshandy's Emails tab blank
// after a script 404 (2026-10-14, full-suite run). Both come back on a reload.
const ERROR_PAGE = /having trouble loading this page|website provider is having trouble/i;
const RELOAD_PAUSES_MS = [5_000, 10_000, 20_000];

async function pageLoadProblem(page: Page): Promise<string | undefined> {
  try {
    // A single-page app can paint a moment after "load", so give it 5 seconds
    // before calling an empty body a blank page.
    await page.waitForFunction(() => (document.body?.innerText ?? '').trim().length > 0, undefined, { timeout: 5_000 });
  } catch {
    return 'the page is blank';
  }
  try {
    const text = await page.evaluate(() => document.body?.innerText ?? '');
    return ERROR_PAGE.test(text) ? 'the site shows its "trouble loading this page" error page' : undefined;
  } catch {
    // The page navigated while it was read (a redirect after load); not an error page.
    return undefined;
  }
}

// A page with a live-updating widget (e.g. polling Logs) may never go fully
// network-idle. Bounding this wait keeps one slow page from hanging the test
// until the whole test timeout forces the browser closed (seen 2026-10-17 on
// the HubSpot Integration page: "page.waitForLoadState: Target page, context
// or browser has been closed" after several minutes). Falling through to
// pageLoadProblem still checks the page actually rendered real content.
// Saleshandy and Lightning pages never reach it (polling), so a long wait here
// cost the full timeout on every page load (about 30 s each in the sf7 trace).
// A short wait is enough: pageLoadProblem below checks the page has content.
const NETWORK_IDLE_TIMEOUT_MS = 3_000;

// Waits for the page to load, then makes sure it is the app and not an error
// or blank page. If it is, reloads (5, 10, 20 s apart) and fails with a clear
// message after the last try. It reloads the page only, never repeats a test
// step, so no test data is used up.
export async function waitForPageLoad(page: Page): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_TIMEOUT_MS }).catch(() => {});
    const problem = await pageLoadProblem(page);
    if (!problem) return;
    if (attempt >= RELOAD_PAUSES_MS.length) {
      throw new Error(`${page.url().split('?')[0]} did not load after ${RELOAD_PAUSES_MS.length} reloads: ${problem}`);
    }
    console.log(`Page load problem (${problem}); reload ${attempt + 1} of ${RELOAD_PAUSES_MS.length} in ${RELOAD_PAUSES_MS[attempt] / 1000} s`);
    await page.waitForTimeout(RELOAD_PAUSES_MS[attempt]);
    await page.reload();
  }
}
