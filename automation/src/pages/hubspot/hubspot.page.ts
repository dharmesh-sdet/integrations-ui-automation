import type { Page } from '@playwright/test';
import { BasePage } from '../base.page.ts';

// Portal of the saved HubSpot test account, seen in every URL during the
// 2026-10-08 walkthrough (e.g. /contacts/247419080/...).
export const HUBSPOT_PORTAL_ID = '247419080';

export abstract class HubSpotPage extends BasePage {
  readonly platform = 'hubspot' as const;

  // HubSpot's "Hi there, have any questions?" tooltip covers buttons
  // (it blocked "Add contacts" in the walkthrough). Close it whenever it shows.
  static async closePopups(page: Page): Promise<void> {
    await page.addLocatorHandler(page.getByRole('tooltip', { name: /have any questions/ }), async (tooltip) => {
      await tooltip.getByRole('button', { name: 'Close' }).click();
    });
  }
}
