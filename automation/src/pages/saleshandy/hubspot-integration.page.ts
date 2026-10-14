import { expect, type Locator } from '@playwright/test';
import { SaleshandyPage } from './saleshandy.page.ts';

export type LogEntry = { id: string; status: string };

// API & Integrations > Integrations > Hubspot: Triggers & Activity and Logs tabs.
// (The older path Settings > Integrations > HubSpot also exists; QA said either is fine.)
export class HubSpotIntegrationPage extends SaleshandyPage {
  private readonly path = '/api-and-integrations/integrations/hubspot';

  // ---- Triggers & Activity ----

  async openTriggers(): Promise<void> {
    await this.goto(`${this.path}?tab=triggers-activity`);
    await this.triggerRows().first().waitFor();
  }

  // Each trigger row is a div holding the toggle and the trigger name. The
  // toggle has no accessible name, so the row is found by CSS plus its text.
  private triggerRows(): Locator {
    return this.page.locator('div:has(> .switchToggle)');
  }

  private triggerRow(name: string): Locator {
    return this.triggerRows().filter({ hasText: name });
  }

  async isTriggerOn(name: string): Promise<boolean> {
    return this.triggerRow(name).locator('input[name="Switch"]').isChecked();
  }

  private async setTrigger(row: Locator, on: boolean): Promise<void> {
    const checkbox = row.locator('input[name="Switch"]');
    if ((await checkbox.isChecked()) === on) return;
    await this.closeSidebar();
    await row.getByRole('button').click();
  }

  // Turns every other enabled trigger off (QA rule), then this one on.
  async enableOnly(name: string): Promise<void> {
    const rows = await this.triggerRows().all();
    for (const row of rows) {
      const isTarget = (await row.innerText()).trim() === name;
      await this.setTrigger(row, isTarget);
    }
  }

  async disable(name: string): Promise<void> {
    await this.setTrigger(this.triggerRow(name), false);
  }

  async save(): Promise<void> {
    await this.page.getByRole('button', { name: 'Save', exact: true }).click();
  }

  savedToast(): Locator {
    return this.page.getByRole('alert').filter({ hasText: 'Configuration Updated Successfully' });
  }

  // ---- Activities and Extra Configuration (seen 2026-10-09) ----

  // The trigger's "Select" box sits next to the trigger row, not inside it.
  private activitySelect(trigger: string): Locator {
    return this.page.locator('div:has(> .bs-select-box)').filter({ has: this.triggerRow(trigger) }).locator(':scope > .bs-select-box');
  }

  // Opens the trigger's activity list and picks one. Activities with Extra
  // Configuration open it in a dialog. Picking an already selected one again does nothing.
  async selectActivity(trigger: string, activity: string): Promise<void> {
    await this.closeSidebar();
    await this.activitySelect(trigger).click();
    await this.page.getByRole('button', { name: activity, exact: true }).click();
  }

  // The block holding a trigger row and its selected activities. It exists only
  // once an activity is selected (checked 2026-10-09; nested :has is not valid CSS).
  private activityBlock(trigger: string): Locator {
    return this.page
      .locator('div:has(> div > div > .switchToggle):has(> div > div > .action-container)')
      .filter({ has: this.triggerRow(trigger) });
  }

  // A selected activity under the trigger. Its .action-container holds icons
  // with no accessible name: the first is the info icon (Record(log) only) or
  // the reopen Extra Configuration icon, the last is the X that removes it.
  private selectedActivity(trigger: string, activity: string): Locator {
    return this.activityBlock(trigger)
      .locator('div:has(> .action-container)')
      .filter({ hasText: activity });
  }

  async selectedActivities(trigger: string): Promise<string[]> {
    const chips = this.activityBlock(trigger)
      .locator('div:has(> .action-container)');
    return (await chips.allInnerTexts()).map((t) => t.trim());
  }

  async hoverActivityInfo(trigger: string, activity: string): Promise<void> {
    await this.selectedActivity(trigger, activity).locator('.action-container > svg').first().hover();
  }

  async reopenExtraConfiguration(trigger: string, activity: string): Promise<void> {
    await this.selectedActivity(trigger, activity).locator('.action-container > svg').first().click();
  }

  async removeActivity(trigger: string, activity: string): Promise<void> {
    await this.selectedActivity(trigger, activity).locator('.action-container > svg').last().click();
  }

  tooltip(): Locator {
    return this.page.getByRole('tooltip');
  }

  extraConfiguration(): Locator {
    return this.page.getByRole('dialog').filter({ hasText: 'Extra Configuration' });
  }

  // A dropdown in Extra Configuration, found by its label (e.g. "Lead Status").
  configDropdown(label: string): Locator {
    return this.extraConfiguration()
      .locator('div:has(> .bs-select-box)')
      .filter({ has: this.page.getByText(label, { exact: true }) })
      .locator(':scope > .bs-select-box');
  }

  // Opens a dropdown and returns its options, in order. The options open in a
  // popup outside the dialog: a "Search" box and a list of buttons in .transfer-body.
  async openConfigDropdown(label: string): Promise<string[]> {
    await expect(this.configDropdown(label)).not.toHaveText('Loading...', { timeout: 30_000 });
    await this.configDropdown(label).click();
    const options = this.page.locator('.transfer-body').getByRole('list').getByRole('button');
    await options.first().waitFor();
    return (await options.allInnerTexts()).map((t) => t.trim());
  }

  async chooseConfigOption(label: string, option: string): Promise<void> {
    // Some lists load after the dialog opens (e.g. Pipeline Stage after a
    // pipeline is picked, from Refold); wait until the box stops saying "Loading...".
    await expect(this.configDropdown(label)).not.toHaveText('Loading...', { timeout: 30_000 });
    await this.configDropdown(label).click();
    await this.page.getByRole('button', { name: option, exact: true }).click();
  }

  // Text inputs in Extra Configuration have no accessible name: each sits in a
  // .mb-3 block with its label span (checked 2026-10-09).
  configTextbox(label: string): Locator {
    return this.extraConfiguration()
      .locator('.mb-3')
      .filter({ has: this.page.getByText(label, { exact: true }) })
      .locator('input');
  }

  dueIn(): Locator {
    return this.extraConfiguration().getByRole('spinbutton');
  }

  configSaveButton(): Locator {
    return this.extraConfiguration().getByRole('button', { name: 'Save', exact: true });
  }

  async cancelExtraConfiguration(): Promise<void> {
    await this.extraConfiguration().getByRole('button', { name: 'Cancel', exact: true }).click();
  }

  // ---- Logs ----

  async openLogs(): Promise<void> {
    await this.goto(`${this.path}?tab=logs`);
    await this.page.getByRole('button', { name: 'Refresh' }).waitFor();
  }

  async refreshLogs(): Promise<void> {
    await this.page.getByRole('button', { name: 'Refresh' }).click();
  }

  // Entries on the first page for one workflow, newest first. A row reads like
  // "Contact Updated in Hubspot 6ac7397229a2f6774c8a9f0c Oct 8, 2026, 12:04 PM 16.6s Success".
  async logEntries(workflow: string): Promise<LogEntry[]> {
    const rows = this.page.getByRole('button', { name: `Open execution detail for ${workflow}`, exact: true });
    // A new account has no logs at all: the page then shows "No logs yet"
    // (seen 2026-10-13, emailopened) and no row ever appears, so do not wait
    // for one. The caller retries until its new entries show.
    const empty = this.page.getByText('No logs yet', { exact: true });
    // An account can have logs for other workflows but none for this one yet
    // (seen 2026-10-13, emailbounced with the Reply is Received trigger): the
    // list is not empty and no row of this workflow ever appears, so any
    // workflow's row also ends the wait.
    const anyRow = this.page.getByRole('button', { name: /^Open execution detail for / });
    // .first() on the union: when this workflow's row and another workflow's
    // row are both there, the union has two elements and waitFor is strict.
    await rows.first().or(empty).or(anyRow.first()).first().waitFor();
    if (await empty.isVisible()) return [];
    return (await rows.allInnerTexts()).map((text) => {
      const words = text.trim().split(/\s+/);
      return { id: words.find((w) => /^[0-9a-f]{24}$/.test(w)) ?? '', status: words[words.length - 1] };
    });
  }
}
