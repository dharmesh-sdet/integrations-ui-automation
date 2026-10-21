import { expect, type Locator } from '@playwright/test';
import { SalesforceIntegrationPage } from './salesforce-integration.page.ts';

export type ActivitySpec = {
  name: string;
  // Create / Update a Opportunity: Extra Configuration "Closing date" (days) and "Opportunity Stage".
  opportunity?: { days?: number; stage?: string };
  // Record(log) an Email Activity: Extra Configuration "Select Object" checkboxes.
  objects?: string[];
};

// Triggers & Activity for "Email Sent from Saleshandy". Builds on the shared
// Salesforce integration page and adds the two Extra Configuration dialogs seen
// on sfemailsent (2026-10-19):
// - Create / Update a Opportunity: "Closing date (while creating|updating)" is a
//   Days spinner (default 0) and "Opportunity Stage" is a select. Saving it empty works.
// - Record(log) an Email Activity: "Select Object" is a multi-select list of
//   checkboxes (Lead, Contact, Opportunity). Saving it with none ticked works.
// - Create / Update a Contact, Create / Update a Lead and Attach Note have no dialog.
// The dialog opens 2 to 3 seconds after the activity is picked (it fetches its
// fields first), so it is waited for, not assumed.
export class SalesforceEmailSentPage extends SalesforceIntegrationPage {
  private extraConfigDialog(): Locator {
    return this.page.getByRole('dialog').filter({ hasText: 'Extra Configuration' });
  }

  private hasExtraConfig(activity: string): boolean {
    return /Opportunity in Salesforce$/.test(activity) || activity.startsWith('Record(log)');
  }

  // Fills the dialog an activity opens and saves it. Does nothing for activities without one.
  async completeExtraConfig(spec: ActivitySpec): Promise<void> {
    if (!this.hasExtraConfig(spec.name)) return;
    const dialog = this.extraConfigDialog();
    await dialog.waitFor({ state: 'visible', timeout: 20_000 });
    if (spec.opportunity?.days !== undefined) {
      await dialog.getByRole('spinbutton').fill(String(spec.opportunity.days));
    }
    if (spec.opportunity?.stage) {
      await dialog.locator('.bs-select-box').click();
      // TODO(needs-input): the Stage options are assumed to be buttons like the
      // activity list; confirm on the first run.
      await this.page.getByRole('button', { name: spec.opportunity.stage, exact: true }).click();
    }
    if (spec.objects?.length) {
      await dialog.locator('.bs-select-box').click();
      for (const object of spec.objects) {
        await this.page.getByRole('button', { name: object, exact: true }).click();
      }
      // Escape would close the whole dialog; clicking its title only closes the list.
      await dialog.getByText('Extra Configuration', { exact: true }).click();
    }
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 15_000 });
  }

  // Makes `trigger` the only trigger on, with exactly `activities` selected, and saves.
  // Removing the last activity also switches its trigger off, so every activity is
  // removed first, then the trigger is switched on, then the activities are added.
  async configureTrigger(trigger: string, activities: ActivitySpec[]): Promise<void> {
    await this.openTriggers();
    for (let i = 0; i < 10; i++) {
      const selected = await this.selectedActivities(trigger);
      if (!selected.length) break;
      await this.removeActivity(trigger, selected[0]);
    }
    await this.enableOnly(trigger);
    for (const spec of activities) {
      await this.selectActivity(trigger, spec.name);
      await this.completeExtraConfig(spec);
    }
    await this.save();
    await expect(this.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
  }

  // Every trigger off, then Save.
  async turnAllTriggersOff(): Promise<void> {
    await this.openTriggers();
    await this.enableOnly('');
    await this.save();
    await expect(this.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
  }
}
