import type { Locator } from '@playwright/test';
import type { MappingObject } from '../../config/account-setup.ts';
import { SaleshandyPage } from './saleshandy.page.ts';

// API & Integrations > Integrations > Hubspot > Field Mapping (seen 2026-10-09).
// Each card opens a list of rows: a Saleshandy field label and a react-select
// dropdown of HubSpot properties.
export class FieldMappingPage extends SaleshandyPage {
  private readonly path = '/api-and-integrations/integrations/hubspot';

  async open(object: MappingObject): Promise<void> {
    await this.goto(this.path);
    await this.closeSidebar();
    // The card's accessible name includes its two logos' alt texts.
    await this.page.getByRole('button', { name: `logo Prospects in Saleshandy icon ${object}`, exact: true }).click();
    await this.rows().nth(2).waitFor();
  }

  // Rows have no roles or names; CSS is the only hook.
  private rows(): Locator {
    return this.page.locator('.mapping__header-content > div');
  }

  // Matched on the Saleshandy label only: a saved HubSpot value can have the
  // same text (Company Industry shows "Industry", seen 2026-10-09).
  private row(field: string): Locator {
    return this.rows().filter({ has: this.page.locator('.default-filed').getByText(field, { exact: true }) });
  }

  async choose(field: string, property: string): Promise<void> {
    await this.row(field).getByRole('combobox').click();
    await this.page.getByRole('option', { name: property, exact: true }).click();
  }

  // Saleshandy field to the HubSpot property shown, for mapped rows only.
  async mapped(): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const row of await this.rows().all()) {
      const value = row.locator('.cs__single-value');
      if (!(await value.count())) continue;
      result[(await row.locator('.default-filed').innerText()).trim()] = (await value.innerText()).trim();
    }
    return result;
  }

  async save(): Promise<void> {
    await this.page.getByRole('button', { name: 'Save', exact: true }).click();
    await this.page.getByRole('alert').filter({ hasText: 'Configuration Updated Successfully' }).waitFor();
  }
}
