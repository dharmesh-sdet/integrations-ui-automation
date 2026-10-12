import { expect } from '@playwright/test';
import { HubSpotPage, HUBSPOT_PORTAL_ID } from './hubspot.page.ts';

export type NewDeal = { name: string; amount?: string };
export type DealSummary = {
  pipeline: string;
  stage: string;
  dealType: string;
  priority: string;
  amount: string;
  closeDate: string;
};

// Deals created from a contact's record, and a deal record's details (walked
// 2026-10-09). The record page needs a window at least 1280 px wide, or the
// right sidebar with the association cards is hidden.
export class HubSpotDealsPage extends HubSpotPage {
  // Create and Add panels open in the object-builder iframe (no role or name).
  private readonly panel = this.page.locator('[data-test-id="object-builder-ui-iframe"]').contentFrame();

  // Contact record > Deals card > Add > "Create Deal" panel. The contact is
  // already associated there; other fields keep HubSpot's defaults (Sales
  // Pipeline, Prospecting, close date end of month). Returns the deal id.
  async createDealForContact(contactId: string, deal: NewDeal): Promise<string> {
    await this.goto(`/contacts/${HUBSPOT_PORTAL_ID}/record/0-1/${contactId}`);
    // The card has no accessible name; its wrapper's test id is the hook.
    await this.page.locator('[data-test-id="card-wrapper-ASSOCIATION_V3/0-3"]').getByRole('button', { name: 'Add', exact: true }).click();
    await this.panel.getByRole('textbox', { name: 'Deal name *', exact: true }).fill(deal.name);
    if (deal.amount) await this.panel.getByRole('textbox', { name: 'Amount', exact: true }).fill(deal.amount);
    await this.panel.getByRole('button', { name: 'Create', exact: true }).click();
    await this.page.waitForURL(/\/record\/0-3\/\d+/);
    return this.page.url().match(/\/record\/0-3\/(\d+)/)![1];
  }

  // Reads the deal's header (Amount, Close Date, Pipeline, Deal Stage) and its
  // "About this deal" card (Deal Type, Priority). HubSpot shows "--" for empty.
  async summary(dealId: string): Promise<DealSummary> {
    await this.goto(`/contacts/${HUBSPOT_PORTAL_ID}/record/0-3/${dealId}`);
    const header = this.page.locator('[data-test-id="record-highlight-main-content"]');
    const about = this.page.locator('[data-test-id^="card-wrapper-PROPERTIES_V3/0-3"]');
    await about.getByText('Deal Type', { exact: true }).waitFor();
    const lines = async (box: typeof header) =>
      (await box.innerText()).split('\n').map((l) => l.trim()).filter(Boolean);
    const after = (list: string[], label: string) => list[list.findIndex((l) => l.replace(/:$/, '') === label) + 1] ?? '';
    // The header fills in late: Pipeline is blank and Deal Stage shows the
    // stage's internal id (e.g. "4308938453") for a moment (seen 2026-10-09).
    let h: string[] = [];
    await expect(async () => {
      h = await lines(header);
      expect(after(h, 'Pipeline'), 'Pipeline in the deal header').not.toMatch(/:$|^$/);
      expect(after(h, 'Deal Stage'), 'Deal Stage in the deal header').not.toMatch(/^\d+$|:$|^$/);
    }).toPass({ timeout: 30_000 });
    const a = await lines(about);
    // Close Date in the header is an editable date box (input, MM/DD/YYYY), not
    // text, so read its value (seen 2026-10-09). Empty reads as "--".
    const closeDate = (await header.locator('[data-test-id="highlight-property-item-closedate"] input').inputValue()) || '--';
    return {
      pipeline: after(h, 'Pipeline'),
      stage: after(h, 'Deal Stage'),
      amount: after(h, 'Amount'),
      closeDate,
      dealType: after(a, 'Deal Type'),
      priority: after(a, 'Priority'),
    };
  }
}
