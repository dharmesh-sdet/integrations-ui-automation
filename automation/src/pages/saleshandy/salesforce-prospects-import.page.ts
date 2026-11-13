import { expect, type Locator } from '@playwright/test';
import { SalesforceIntegrationPage } from './salesforce-integration.page.ts';

// API & Integrations > Integrations > Salesforce > Prospects Import (seen on staging 2026-11-12 and 2026-11-13).
// One row "Import Prospects from Salesforce" with a toggle, an activity select and the button "Import Prospects".
// It has the same structure as Triggers & Activity (.switchToggle row, .bs-select-box, chips), so the locators
// and the Extra Configuration dialog come from SalesforceIntegrationPage.
export const IMPORT_TRIGGER = 'Import Prospects from Salesforce';
export const ADD_ACTIVITY = 'Add Prospect in Saleshandy';
export const MOVE_ACTIVITY = 'Move Prospect to another Sequence in Saleshandy';
export const ADD_LIST = 'List View(while adding)';
export const MOVE_LIST = 'List View(while adding to Seq)';

export class SalesforceProspectsImportPage extends SalesforceIntegrationPage {
  async open(): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      await this.goto(`${this.path}?tab=prospects-import`);
      if (await this.triggerRows().first().waitFor({ timeout: 30_000 }).then(() => true, () => false)) return;
      if (attempt === 3) throw new Error('The Prospects Import tab showed no row after 3 loads.');
    }
  }

  isOn(): Promise<boolean> {
    return this.isTriggerOn(IMPORT_TRIGGER);
  }

  async turnOn(): Promise<void> {
    await this.closeSidebar();
    await this.setTrigger(this.triggerRow(IMPORT_TRIGGER), true);
  }

  importButton(): Locator {
    return this.page.getByRole('button', { name: 'Import Prospects', exact: true });
  }

  chips(): Promise<string[]> {
    return this.selectedActivities(IMPORT_TRIGGER);
  }

  // Picks an activity. Its Extra Configuration dialog opens by itself and stays open. The toggle must be on:
  // the activity select is disabled while it is off. The tab has no Save button of its own (seen 2026-11-13):
  // the toggle and the chips are stored by the dialog's Save, which sends them all at once.
  async pick(activity: string): Promise<void> {
    if (!(await this.isOn())) await this.turnOn();
    await this.selectActivity(IMPORT_TRIGGER, activity);
    await this.extraConfiguration().waitFor();
  }

  // The activity's dialog: reopened from its chip when it is saved, else picked.
  async openDialog(activity: string): Promise<void> {
    if ((await this.chips()).includes(activity)) await this.editChip(activity);
    else await this.pick(activity);
  }

  async editChip(activity: string): Promise<void> {
    await this.reopenExtraConfiguration(IMPORT_TRIGGER, activity);
    await this.extraConfiguration().waitFor();
  }

  // Saves the open dialog. It stores the toggle, the chips and every field, and shows "Configuration Updated
  // Successfully" (seen 2026-11-13). Save with every field empty closes it with no validation message.
  async saveDialog(): Promise<void> {
    await this.configSaveButton().click();
    await this.extraConfiguration().waitFor({ state: 'hidden', timeout: 15_000 });
    await expect(this.savedToast()).toBeVisible({ timeout: 30_000 });
  }

  // Fills the open dialog. Only the fields given are touched.
  async fill(f: { listLabel?: string; listView?: string; sequence?: string; step?: string }): Promise<void> {
    if (f.listView) await this.chooseConfigOption(f.listLabel ?? ADD_LIST, f.listView);
    if (f.sequence) await this.chooseConfigOption('Sequence', f.sequence);
    if (f.step) await this.chooseConfigOption('Sequence Steps', f.step);
  }

  // The dialog's field labels, in order.
  async dialogText(): Promise<string> {
    return (await this.extraConfiguration().innerText()).replace(/\s+/g, ' ');
  }

  // The activity select lists both activities.
  async openActivityListAndRead(): Promise<string[]> {
    await this.openActivityList(IMPORT_TRIGGER);
    return (await this.page.getByRole('button', { name: /in Saleshandy$/ }).allInnerTexts()).map((t) => t.trim());
  }

  // The options of a List View dropdown in the open dialog.
  async listViewOptions(label: string): Promise<string[]> {
    await expect(this.extraConfiguration().getByText('Loading...')).toHaveCount(0, { timeout: 30_000 });
    await this.extraConfiguration()
      .locator('div:has(> .bs-select-box)')
      .filter({ has: this.page.getByText(label, { exact: true }) })
      .locator(':scope > .bs-select-box')
      .click();
    const options = await this.page.locator('.transfer-body').getByRole('list').getByRole('button').allInnerTexts();
    await this.extraConfiguration().getByText('Extra Configuration').first().click();
    return options.map((t) => t.trim());
  }

  // Click "Import Prospects". Returns the red message when the page refuses to send it, else 'started'.
  async clickImport(): Promise<'started' | string> {
    await this.closeSidebar();
    await this.importButton().click();
    const started = this.page.getByRole('alert').filter({ hasText: 'Prospect import started successfully' }).first();
    const refused = this.page.getByRole('alert').filter({ hasText: 'Please select' }).first();
    await started.or(refused).first().waitFor({ timeout: 30_000 });
    return (await started.isVisible()) ? 'started' : (await refused.innerText()).trim();
  }
}
