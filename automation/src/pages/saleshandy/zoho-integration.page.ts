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
}
