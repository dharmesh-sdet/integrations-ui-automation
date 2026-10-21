import { expect, type Locator } from '@playwright/test';
import { SalesforceEmailSentPage } from './salesforce-email-sent.page.ts';

// One activity under "Prospect Outcome is updated in Saleshandy" and what its
// Extra Configuration gets.
export type OutcomeActivity = {
  name: string;
  // Select Outcome (one value). Record(log) an Email Activity and Attach Note have none.
  outcome?: string;
  // Create / Update a Opportunity only.
  stage?: string;
  days?: number;
  // Record(log) an Email Activity only: the Select Object checkboxes.
  objects?: string[];
};

// Triggers & Activity for "Prospect Outcome is updated in Saleshandy". Adds the
// Select Outcome field to the Extra Configuration dialogs of
// salesforce-email-sent.page.ts (seen 2026-10-20: Create / Update a Opportunity
// have Closing date, Opportunity Stage and Select Outcome; the Account, Contact
// and Lead activities have Select Outcome only).
// TODO(needs-input): the Select Outcome box is assumed to behave like the other
// searchable lists in the dialog (a .bs-select-box next to its label, options as
// buttons in .transfer-body); the first run confirms it.
export class SalesforceOutcomePage extends SalesforceEmailSentPage {
  readonly trigger = 'Prospect Outcome is updated in Saleshandy';

  private dialog(): Locator {
    return this.page.getByRole('dialog').filter({ hasText: 'Extra Configuration' });
  }

  // The select box next to a label that starts with `label` (the label text
  // carries "(while creating)" and similar endings).
  private selectBox(label: string): Locator {
    return this.dialog()
      .locator('div:has(> .bs-select-box)')
      .filter({ has: this.page.getByText(new RegExp(`^${label}`, 'i')) })
      .locator(':scope > .bs-select-box');
  }

  private async choose(label: string, option: string): Promise<void> {
    const box = this.selectBox(label);
    await expect(box).not.toHaveText('Loading...', { timeout: 30_000 });
    await box.click();
    const choice = this.page.getByRole('button', { name: option, exact: true });
    try {
      await choice.waitFor({ timeout: 30_000 });
    } catch {
      const offered = await this.page.locator('.transfer-body').getByRole('list').getByRole('button').allInnerTexts();
      throw new Error(`"${option}" is not in the ${label} list. The list offers: ${offered.map((t) => t.trim()).join(' | ') || '(nothing)'}`);
    }
    await choice.click();
  }

  // Fills the dialog the activity just opened and saves it.
  async fillDialog(activity: OutcomeActivity): Promise<void> {
    const dialog = this.dialog();
    await dialog.waitFor({ state: 'visible', timeout: 20_000 });
    if (activity.days !== undefined) await dialog.getByRole('spinbutton').fill(String(activity.days));
    if (activity.stage) await this.choose('Opportunity Stage', activity.stage);
    if (activity.outcome) await this.choose('Select Outcome', activity.outcome);
    if (activity.objects?.length) {
      await dialog.locator('.bs-select-box').click();
      for (const object of activity.objects) await this.page.getByRole('button', { name: object, exact: true }).click();
      // Escape would close the whole dialog; clicking its title only closes the list.
      await dialog.getByText('Extra Configuration', { exact: true }).click();
    }
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 15_000 });
  }

  private opensDialog(name: string): boolean {
    return !/^Attach Note/.test(name);
  }

  // Makes the trigger the only one on, with exactly `activities` and their Extra
  // Configuration, and saves.
  async configureOutcomeTrigger(activities: OutcomeActivity[]): Promise<void> {
    await this.openTriggers();
    for (let i = 0; i < 10; i++) {
      const selected = await this.selectedActivities(this.trigger);
      if (!selected.length) break;
      await this.removeActivity(this.trigger, selected[0]);
    }
    await this.enableOnly(this.trigger);
    for (const activity of activities) {
      await this.selectActivity(this.trigger, activity.name);
      if (this.opensDialog(activity.name)) await this.fillDialog(activity);
    }
    await this.save();
    await expect(this.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
  }

  // Baseline rows: turn the trigger on, open the list and read the offered activities.
  async offeredActivities(): Promise<string[]> {
    await this.openTriggers();
    await this.enableOnly(this.trigger);
    await this.openActivityList(this.trigger);
    const options = this.page.locator('.transfer-body').getByRole('list').getByRole('button');
    await options.first().waitFor();
    return (await options.allInnerTexts()).map((t) => t.trim());
  }

  // Baseline rows: pick an activity and return the Extra Configuration dialog text, without saving.
  async dialogTextOf(activity: string): Promise<string> {
    await this.selectActivity(this.trigger, activity);
    await this.dialog().waitFor({ state: 'visible', timeout: 20_000 });
    await this.dialog().locator('.bs-select-box').first().waitFor();
    const text = (await this.dialog().innerText()).replace(/\s+/g, ' ');
    await this.page.keyboard.press('Escape');
    return text;
  }
}
