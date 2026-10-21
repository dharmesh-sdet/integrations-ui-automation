import type { Page } from '@playwright/test';
import type { Platform } from '../config/environments.ts';
import { gotoWithRetry, waitForPageLoad } from '../utils/wait.ts';

export abstract class BasePage {
  readonly page: Page;
  abstract readonly platform: Platform;

  constructor(page: Page) {
    this.page = page;
  }

  // `page` is hubspotPage or saleshandyPage from the fixtures, so the path is
  // relative to that platform's base URL.
  async goto(path: string): Promise<void> {
    // Tries again on net::ERR_CONNECTION_CLOSED and similar (see gotoWithRetry).
    await gotoWithRetry(this.page, path);
    await this.assertNotOnLogin();
  }

  // For pages reached by a click or a redirect instead of goto: waits for the
  // load and reloads when the page is an error or blank page (see wait.ts).
  async waitForPageLoad(): Promise<void> {
    await waitForPageLoad(this.page);
    await this.assertNotOnLogin();
  }

  // A saved session can still be rejected by the server before 7 days (HubSpot:
  // "Your authentication has expired due to inactivity"). Both login pages have
  // /login in the URL (seen 2026-10-09: app-na2.hubspot.com/login/?...,
  // pyxis.lifeisgoodforlearner.com/login), so fail at once instead of waiting
  // for a button that never comes.
  async assertNotOnLogin(): Promise<void> {
    if (/\/login(\/|$)/.test(new URL(this.page.url()).pathname)) {
      throw new Error(
        `${this.platform} login expired (the page went to ${this.page.url().split('?')[0]}). ` +
          `Run npm run login:${this.platform} -- <account> in automation/ and log in again.`,
      );
    }
  }
}
