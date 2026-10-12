import { expect, type BrowserContext, type Page } from '@playwright/test';

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

  // Opens the email with this subject and clicks its first link right away
  // (QA: no wait before the click). The tracked link opens a new tab, which is
  // closed again.
  async clickFirstLink(email: string, subject: string): Promise<void> {
    const page = await this.context.newPage();
    try {
      await this.clickIn(page, email, subject);
    } finally {
      await page.close();
    }
  }

  private async clickIn(page: Page, email: string, subject: string): Promise<void> {
    await page.goto(MAILINATOR_URL);
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

    // The HTML body is in an iframe; its links go through the tracking domain.
    const link = page.locator('#html_msg_body').contentFrame().getByRole('link').first();
    const opened = page.context().waitForEvent('page');
    await link.click();
    await (await opened).close();
  }
}
