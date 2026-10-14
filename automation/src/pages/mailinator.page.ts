import { expect, type BrowserContext, type Page } from '@playwright/test';
import { gotoWithRetry } from '../utils/wait.ts';

// Public Mailinator inboxes, where the test prospects' emails arrive (all CSV
// emails are @mailinator.com). No login. Seen 2026-10-09.
const MAILINATOR_URL = 'https://www.mailinator.com/';

export class MailinatorPage {
  readonly context: BrowserContext;

  // Opens its tab only when needed: in a headed run on 2026-10-09 the empty
  // tab opened at the start of the test was already closed when it was used.
  constructor(context: BrowserContext) {
    this.context = context;
  }

  // Opens the email with this subject and clicks its link right away (QA: no
  // wait before the click); `link` is the 0-based link to click (1 = the second
  // link, for "click the second link" rows). A RegExp subject also matches a
  // "Re: ..." follow-up.
  // QA (2026-10-12): the inbox tab stays open after the click, so the second
  // link is clicked in the same open email (it may not be listed again). The
  // tab is closed with the test's other tabs (fixtures/index.ts). The tracked
  // link opens a new tab, which is closed again.
  async clickFirstLink(email: string, subject: string | RegExp, link = 0): Promise<void> {
    const open = this.opened.get(email);
    if (open && !open.page.isClosed() && String(open.subject) === String(subject)) {
      await this.clickLink(open.page, link);
      return;
    }
    const page = open && !open.page.isClosed() ? open.page : await this.context.newPage();
    this.opened.set(email, { page, subject });
    await this.clickIn(page, email, subject, link);
  }

  private readonly opened = new Map<string, { page: Page; subject: string | RegExp }>();

  private async clickLink(page: Page, link: number): Promise<void> {
    // The HTML body is in an iframe; its links go through the tracking domain.
    const target = page.locator('#html_msg_body').contentFrame().getByRole('link').nth(link);
    const opened = page.context().waitForEvent('page');
    await target.click();
    await (await opened).close();
  }

  // Opens the email with this subject and leaves it open (Sequence Email is
  // Opened: the open itself is the event; the tracking pixel is in the HTML
  // body). Calling it again for the same email reloads the inbox and opens
  // the message again, which is a second open. Same tab per address as
  // clickFirstLink; closed with the test's other tabs.
  async openEmail(email: string, subject: string | RegExp): Promise<void> {
    const open = this.opened.get(email);
    const page = open && !open.page.isClosed() ? open.page : await this.context.newPage();
    this.opened.set(email, { page, subject });
    await this.openMessage(page, email, subject);
  }

  private async clickIn(page: Page, email: string, subject: string | RegExp, link: number): Promise<void> {
    await this.openMessage(page, email, subject);
    await this.clickLink(page, link);
  }

  private async openMessage(page: Page, email: string, subject: string | RegExp): Promise<void> {
    await gotoWithRetry(page, MAILINATOR_URL);
    // The button next to the box is "Search for inbox" in a headed browser but
    // "GO" headless (two page versions, 2026-10-09); Enter works on both once loaded.
    const box = page.getByRole('textbox', { name: 'Enter public inbox', exact: true });
    await box.fill(email);
    await box.press('Enter');
    // Enter does nothing until the page's script has loaded (seen 2026-10-09),
    // so fall back to the button if the inbox has not opened.
    await page.waitForURL(/inboxes\.jsp\?to=/, { timeout: 5_000 }).catch(async () => {
      await page.getByRole('button', { name: /^(Search for inbox|GO)$/ }).first().click();
      await page.waitForURL(/inboxes\.jsp\?to=/);
    });
    // Usually there within seconds of sending; reload until it shows.
    const message = page.getByRole('cell', { name: subject, exact: true }).first();
    await expect(async () => {
      if (!(await message.isVisible())) await page.reload();
      await expect(message).toBeVisible({ timeout: 5_000 });
    }, `email "${subject}" in ${email}`).toPass({ timeout: 2 * 60_000 });
    await message.click();
  }
}
