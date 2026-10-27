import { expect } from '@playwright/test';
import type { PipedriveMappingCard } from '../../config/pipedrive-field-mapping.ts';
import { SalesforceIntegrationPage, type ExtraConfig } from './salesforce-integration.page.ts';

// Activities that open an Extra Configuration dialog (seen 2026-10-24): the ones that act on deals
// (Create a Deal in Pipedrive and Update a Deal in Pipedrive), with "Select Pipeline" and "Select
// Pipeline Stage". The staging company has one pipeline, "Pipeline", with the stages Qualified,
// Contact Made, Demo Scheduled, Proposal Made and Negotiations Started. Every other activity
// opens no dialog.
export const PIPEDRIVE_PIPELINE = 'Pipeline';
export const PIPEDRIVE_STAGES = ['Qualified', 'Contact Made', 'Demo Scheduled', 'Proposal Made', 'Negotiations Started'] as const;

// The ten activities of every trigger, with the " in Pipedrive" ending the lists show.
export const PD = {
  createLead: 'Create a Lead in Pipedrive',
  createDeal: 'Create a Deal in Pipedrive',
  createPerson: 'Create a Person in Pipedrive',
  updateDeal: 'Update a Deal in Pipedrive',
  updatePerson: 'Update a Person in Pipedrive',
  deleteDeal: 'Delete Deal in Pipedrive',
  deletePerson: 'Delete Person in Pipedrive',
  createOrganization: 'Create Organization in Pipedrive',
  updateOrganization: 'Update Organization in Pipedrive',
  deleteOrganization: 'Delete Organization in Pipedrive',
} as const;

// API & Integrations > Integrations > Pipedrive. Same page structure as the Salesforce one
// (seven trigger rows with a toggle, a "Select" box for the activities, Save, Logs tab), so the
// Triggers & Activity and Logs methods are the Salesforce page's. Only the path and the Extra
// Configuration dialog differ. The tabs are Field Mapping, Triggers & Activity, Custom Workflow and Logs.
export class PipedriveIntegrationPage extends SalesforceIntegrationPage {
  protected readonly path = '/api-and-integrations/integrations/pipedrive';

  // Extra Configuration of a deal activity: two lists in the dialog, the pipeline first and then the
  // stage, both opened as an overlay (.transfer-select-box) like the Salesforce ones. The stage list
  // fills once a pipeline is picked.
  async fillExtraConfiguration(extra: ExtraConfig): Promise<void> {
    const dialog = this.page.getByRole('dialog');
    await dialog.waitFor({ timeout: 15_000 });
    const lists = dialog.locator('.bs-select-box');
    // The stage list can open empty right after the pipeline is picked (seen 2026-10-26: Create a Deal 1
    // waited 4 minutes for "Qualified"), so an empty overlay is closed and the list opened again.
    const pick = async (index: number, choice: string) => {
      const option = this.page
        .locator('.transfer-select-box li')
        .filter({ hasText: new RegExp(`^\\s*${choice.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) });
      for (let attempt = 1; ; attempt++) {
        await lists.nth(index).click();
        try {
          await option.waitFor({ timeout: 8_000 });
          break;
        } catch (error) {
          if (attempt === 4) throw error;
          await this.page.keyboard.press('Escape');
          await this.page.waitForTimeout(1_500);
        }
      }
      await option.click();
    };
    await pick(0, extra.pipeline ?? PIPEDRIVE_PIPELINE);
    if (extra.stage) await pick(1, extra.stage);
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 15_000 });
  }

  // Opens one of the three mapping cards of the Field Mapping tab (seen 2026-10-27: Contact Fields,
  // Deal Fields, Organisation Fields). The rows are the ones the Salesforce page reads with
  // `mappedValue`: a fixed Saleshandy label and a react-select, "Select" when nothing is mapped.
  async openMappingCard(card: PipedriveMappingCard): Promise<void> {
    await this.goto(this.path);
    const button = this.page.getByRole('button', { name: new RegExp(card) });
    // The page shows "Loading..." for a moment after a hard load (seen 2026-10-27).
    await button.waitFor({ timeout: 60_000 });
    await button.click();
    await this.page.locator('div.d-flex.justify-content-between .default-filed').first().waitFor({ timeout: 60_000 });
  }

  // ---- Prospect Outcome is updated in Saleshandy ----
  // Every action added under this trigger opens its own Extra Configuration (seen 2026-10-26): the
  // deal activities show Pipeline, Pipeline Stage and then "Select Saleshandy Conversation Category",
  // every other activity shows the category alone. The category list is the last .bs-select-box.

  readonly outcomeTrigger = 'Prospect Outcome is updated in Saleshandy';

  // Makes the outcome trigger the only one on, with exactly `items` under it, and saves.
  // `category` undefined: the dialog is closed with Cancel (Extra Configuration skipped, never saved).
  async configureOutcome(items: OutcomeItem[]): Promise<void> {
    await this.openTriggers();
    for (let i = 0; i < 12; i++) {
      const chips = await this.selectedActivities(this.outcomeTrigger);
      if (!chips.length) break;
      await this.removeActivity(this.outcomeTrigger, chips[0]);
    }
    await this.enableOnly(this.outcomeTrigger);
    for (const item of items) {
      await this.selectActivity(this.outcomeTrigger, item.activity);
      const dialog = this.page.getByRole('dialog');
      await dialog.waitFor({ timeout: 15_000 });
      if (item.category === undefined) {
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        await dialog.waitFor({ state: 'hidden', timeout: 15_000 });
        continue;
      }
      const lists = dialog.locator('.bs-select-box');
      const pick = async (index: number, choice: string) => {
        await lists.nth(index).click();
        await this.page.locator('.transfer-select-box li').filter({ hasText: new RegExp(`^\\s*${choice}\\s*$`) }).click();
      };
      if (item.stage) {
        await pick(0, item.pipeline ?? PIPEDRIVE_PIPELINE);
        await pick(1, item.stage);
      }
      await pick((await lists.count()) - 1, item.category);
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await dialog.waitFor({ state: 'hidden', timeout: 15_000 });
    }
    await this.save();
    await expect(this.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
  }
}

// One action under the outcome trigger. `category` is a Saleshandy Conversation Category, or
// undefined to skip the Extra Configuration. `stage` is for the deal activities.
export type OutcomeItem = { activity: string; category?: string; pipeline?: string; stage?: string };
