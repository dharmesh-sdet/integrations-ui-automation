import type { Page } from '@playwright/test';
import { BasePage } from '../base.page.ts';

// Portal of the saved HubSpot test account (dharmesh+int@saleshandy.com), seen
// in the session saved 2026-10-19 (e.g. /contacts/247734202/...). The
// 2026-10-08 portal was 247419080.
export const HUBSPOT_PORTAL_ID = '247734202';

export abstract class HubSpotPage extends BasePage {
  readonly platform = 'hubspot' as const;

  // HubSpot's "Hi there, have any questions?" tooltip covers buttons
  // (it blocked "Add contacts" in the walkthrough). Close it whenever it shows.
  static async closePopups(page: Page): Promise<void> {
    await page.addLocatorHandler(page.getByRole('tooltip', { name: /have any questions/ }), async (tooltip) => {
      await tooltip.getByRole('button', { name: 'Close' }).click();
    });
  }

  // The record's Activities tab as text (notes, tasks, logged emails), for
  // "is on the record" checks. `typeId` is HubSpot's object type id (contact
  // 0-1, company 0-2, deal 0-3). Not walked yet (2026-10-12): the tab name
  // comes from the Reply Received walkthrough; the page body is read because
  // the timeline has no known test id.
  async activitiesText(typeId: '0-1' | '0-2' | '0-3', id: string): Promise<string> {
    await this.goto(`/contacts/${HUBSPOT_PORTAL_ID}/record/${typeId}/${id}`);
    // Seen 2026-10-12: the tab is a role=button; the page never reaches
    // "networkidle" (waiting for it timed out), so wait for the timeline events.
    await this.page.getByRole('button', { name: 'Activities', exact: true }).first().click();
    await this.page.locator('[data-test-id="timeline-preview-event"]').first().waitFor({ timeout: 30_000 });
    return this.page.locator('body').innerText();
  }
}
