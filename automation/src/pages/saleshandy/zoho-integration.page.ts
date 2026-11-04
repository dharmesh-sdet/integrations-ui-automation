import type { Locator } from '@playwright/test';
import type { ZohoMappingCard } from '../../config/zoho-field-mapping.ts';
import { SalesforceIntegrationPage } from './salesforce-integration.page.ts';

// API & Integrations > Integrations > Zoho (seen on staging 2026-10-28). Same screens as the Salesforce
// and Pipedrive pages (tabs Field Mapping, Triggers & Activity, Custom Workflow, Logs; mapping rows with
// a fixed Saleshandy label and a react-select), so the mapping, trigger and Logs methods are the
// Salesforce page's. Only the path and the mapping cards differ.
export class ZohoIntegrationPage extends SalesforceIntegrationPage {
  protected readonly path = '/api-and-integrations/integrations/zoho';

  // Opens one of the four cards of the Field Mapping tab: Deal, Contact, Account and Lead Fields.
  // The page title is "Field Mapping" for all four, so the card is the only way to know the type.
  async openMappingCard(card: ZohoMappingCard): Promise<void> {
    await this.goto(this.path);
    const button = this.page.getByRole('button', { name: new RegExp(card) });
    // The page shows "Loading..." for a moment after a hard load (Pipedrive, seen 2026-10-27).
    await button.waitFor({ timeout: 60_000 });
    await button.click();
    await this.page.locator('div.d-flex.justify-content-between .default-filed').first().waitFor({ timeout: 60_000 });
  }

  // Turns one trigger off and leaves the others as they are. Zoho workflows run in parallel on one account,
  // so enableOnly (which turns the others off) is not used to switch a trigger off.
  async turnOff(name: string): Promise<void> {
    await this.setTrigger(this.triggerRow(name), false);
  }

  // Opens the Extra Configuration dialog of a selected action chip. The chip is looked up inside this trigger's block only,
  // because a page-wide lookup took the first Task chip, which belongs to another trigger on the shared account
  // (it read "Follow up after reply", 2026-11-03).
  // TODO(needs-input): the first icon of the chip opening its dialog is a guess (the last one removes it).
  async openActivityConfiguration(trigger: string, activity: string): Promise<Locator> {
    const block = this.page
      .locator('div:has(> div > div > .switchToggle):has(> div > div > .action-container)')
      .filter({ has: this.page.locator('div:has(> .switchToggle)').filter({ hasText: trigger }) });
    const chip = block.locator('div:has(> .action-container)').filter({ hasText: activity }).first();
    await chip.locator('.action-container > svg').first().click();
    const dialog = this.page.getByRole('dialog');
    await dialog.waitFor({ timeout: 15_000 });
    return dialog;
  }
}
