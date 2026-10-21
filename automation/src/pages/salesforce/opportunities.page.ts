import type { Page } from '@playwright/test';
import { SalesforceObjectPage, waitForCreated } from './object.page.ts';

// Salesforce Opportunities. Opportunity Properties mapping on sfemailsent:
// Prospect Overview -> Description, Deal Value -> Amount, Closing Date -> Close Date.
// TODO(needs-input): what the integration names the Opportunity, and how it ties
// it to the Contact, is not documented. The list is searched for the prospect's
// name, email or company; the first run shows which one matches.
export type OpportunityInput = { name: string; stage: string; closeDate: string; amount?: string };

// Fills the open New Opportunity dialog and saves it. Shared by the Opportunities list
// and a Contact's Opportunities related list (which also adds the Contact as a Contact Role).
export async function fillOpportunityForm(page: Page, opportunity: OpportunityInput): Promise<void> {
  const form = page.getByRole('dialog');
  await form.getByRole('textbox', { name: 'Opportunity Name' }).waitFor({ timeout: 30_000 });
  await form.getByRole('textbox', { name: 'Opportunity Name' }).fill(opportunity.name);
  await form.getByRole('textbox', { name: 'Close Date' }).fill(opportunity.closeDate);
  if (opportunity.amount) await form.getByRole('textbox', { name: 'Amount' }).fill(opportunity.amount);
  // Same picklist handling as the Lead Status combobox: click, then Enter if it stays closed.
  const stage = form.getByRole('combobox', { name: 'Stage' });
  await stage.click();
  await page.waitForTimeout(1_000);
  if ((await stage.getAttribute('aria-expanded')) !== 'true') await stage.press('Enter');
  await page.getByRole('option', { name: opportunity.stage, exact: true }).click();
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await waitForCreated(page, 'Opportunity');
}

export class SalesforceOpportunitiesPage extends SalesforceObjectPage {
  protected readonly objectName = 'Opportunity';
  protected readonly listView = 'AllOpportunities';

  async countByName(text: string): Promise<number> {
    return this.countByText(text);
  }

  // Creates an Opportunity through the list's New button. Setup for Update rows.
  // closeDate is typed as the org shows dates (DD/MM/YYYY, the form says "Format: 31/12/2024").
  // TODO(needs-input): the New Opportunity form has not been opened on this org yet;
  // labels follow the standard form (Opportunity Name, Close Date, Stage, Amount).
  async createOpportunity(opportunity: OpportunityInput): Promise<void> {
    await this.openList();
    await this.page.getByRole('button', { name: 'New', exact: true }).click();
    await fillOpportunityForm(this.page, opportunity);
  }

  async opportunityFields(text: string): Promise<{
    name: string;
    stage: string;
    closeDate: string;
    amount: string;
    description: string;
  }> {
    await this.openRecord(text);
    return {
      name: await this.field('Name'),
      stage: await this.field('StageName'),
      closeDate: await this.field('CloseDate'),
      amount: await this.field('Amount'),
      description: await this.field('Description'),
    };
  }
}
