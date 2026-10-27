import type { Locator, Page } from '@playwright/test';
import { SaleshandyPage } from './saleshandy.page.ts';

export type MappingObject = 'Lead' | 'Contact' | 'Opportunity' | 'Account';

export type SalesforceLogEntry ={ id: string; status: string; text: string };

// Extra Configuration dialog of an activity (seen 2026-10-21): Create and Update a
// Opportunity have "Closing date" (Days, spinbutton, default 0) and "Opportunity
// Stage" (list); Record(log) an Email Activity has "Select Object" (Lead,
// Opportunity, Contact). Every other activity opens no dialog.
export type ExtraConfig = { closingDays?: number; stage?: string; object?: 'Lead' | 'Opportunity' | 'Contact'; pipeline?: string };

// An activity chip to select; `extra` is filled in its Extra Configuration dialog.
export type ActivityPick = string | { activity: string; extra: ExtraConfig };

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// API & Integrations > Integrations > Salesforce: Triggers & Activity and Logs
// tabs. Same page structure as the HubSpot one (checked on staging 2026-10-16:
// .switchToggle rows, .bs-select-box activity boxes, .action-container chips),
// so the locators follow src/pages/saleshandy/hubspot-integration.page.ts.
export class SalesforceIntegrationPage extends SaleshandyPage {
  protected readonly path: string = '/api-and-integrations/integrations/salesforce';

  // Set by the fixture (reconnectSalesforce in src/flows/salesforce-connection.ts).
  // Without it a dropped connection fails the test, as before.
  private readonly reconnect?: () => Promise<void>;

  private reconnected = false;

  constructor(page: Page, reconnect?: () => Promise<void>) {
    super(page);
    this.reconnect = reconnect;
  }

  // The page falls back to the integrations list and the Salesforce card says "Re-connect"
  // when Saleshandy lost its Salesforce connection (seen 2026-10-21, sfoutcomeupdated).
  // Reconnects once per test; a second drop in the same test fails it.
  private async reconnectIfDropped(): Promise<boolean> {
    if (!(await this.page.getByRole('link', { name: 'Re-connect' }).or(this.page.getByText('Re-connect', { exact: true })).first().isVisible())) {
      return false;
    }
    if (!this.reconnect || this.reconnected) {
      throw new Error('Saleshandy lost its Salesforce connection: the Salesforce card shows "Re-connect". Click Re-connect on this account and run again.');
    }
    this.reconnected = true;
    await this.reconnect();
    return true;
  }

  // ---- Triggers & Activity ----

  async openTriggers(): Promise<void> {
    await this.goto(`${this.path}?tab=triggers-activity`);
    // The page can stay on its grey loading bars (seen 2026-10-21: 234 s, the test
    // timed out). It renders on a reload, so reload up to 3 times, 30 s apart.
    for (let attempt = 1; ; attempt++) {
      if (await this.triggerRows().first().waitFor({ timeout: 30_000 }).then(() => true, () => false)) return;
      if (await this.reconnectIfDropped()) {
        await this.goto(`${this.path}?tab=triggers-activity`);
        continue;
      }
      if (attempt === 3) throw new Error('The Triggers & Activity page showed no triggers after 3 loads.');
      await this.page.reload();
    }
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
  // KEEP_OTHER_TRIGGERS=1 (production smoke runs that share one account in parallel, QA,
  // 2026-10-22): other triggers are left as they are, so a second run's trigger stays on.
  async enableOnly(name: string): Promise<void> {
    const keepOthers = process.env.KEEP_OTHER_TRIGGERS === '1';
    const rows = await this.triggerRows().all();
    for (const row of rows) {
      const isTarget = (await row.innerText()).trim() === name;
      if (keepOthers && !isTarget) continue;
      await this.setTrigger(row, isTarget);
    }
  }

  async save(): Promise<void> {
    await this.page.getByRole('button', { name: 'Save', exact: true }).click();
  }

  // Seen 2026-10-16 after Save on Salesforce (same text as HubSpot).
  savedToast(): Locator {
    // Two toasts can be on screen at once (a second save before the first closes).
    return this.page.getByRole('alert').filter({ hasText: 'Configuration Updated Successfully' }).first();
  }

  // The trigger's "Select" box sits next to the trigger row, not inside it.
  private activitySelect(trigger: string): Locator {
    return this.page.locator('div:has(> .bs-select-box)').filter({ has: this.triggerRow(trigger) }).locator(':scope > .bs-select-box');
  }

  // Opens the trigger's activity list and picks one. Create a Lead in
  // Salesforce has no Extra Configuration, so no dialog opens (seen 2026-10-16).
  async selectActivity(trigger: string, activity: string, extra?: ExtraConfig): Promise<void> {
    await this.closeSidebar();
    await this.activitySelect(trigger).click();
    await this.page.getByRole('button', { name: activity, exact: true }).click();
    if (extra) await this.fillExtraConfiguration(extra);
  }

  // Fills the Extra Configuration dialog that opens after an activity is picked and
  // saves it. The stage and object lists open as an overlay (.transfer-select-box,
  // seen 2026-10-21) outside the dialog; they stay empty while the Salesforce
  // connection is dropped ("Re-connect" on Settings > Integrations).
  async fillExtraConfiguration(extra: ExtraConfig): Promise<void> {
    const dialog = this.page.getByRole('dialog');
    await dialog.waitFor({ timeout: 15_000 });
    if (extra.closingDays !== undefined) await dialog.getByRole('spinbutton').fill(String(extra.closingDays));
    const choice = extra.stage ?? extra.object;
    if (choice) {
      await dialog.locator('.bs-select-box').click();
      await this.page
        .locator('.transfer-select-box li')
        .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(choice)}\\s*$`) })
        .click();
    }
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 15_000 });
  }

  // Opens the trigger's activity list without picking anything.
  async openActivityList(trigger: string): Promise<void> {
    await this.closeSidebar();
    await this.activitySelect(trigger).click();
  }

  // An option in the open activity list. Matched from the start of its name, so
  // the " in Salesforce" ending of the Create and Update options is not needed.
  activityOption(name: string): Locator {
    return this.page.getByRole('button', { name: new RegExp(`^${name.replace(/[()]/g, '\\$&')}`) });
  }

  // The block holding a trigger row and its selected activities. It exists only
  // once an activity is selected.
  private activityBlock(trigger: string): Locator {
    return this.page
      .locator('div:has(> div > div > .switchToggle):has(> div > div > .action-container)')
      .filter({ has: this.triggerRow(trigger) });
  }

  // A selected activity under the trigger. Its .action-container holds icons
  // with no accessible name; the last one is the X that removes it.
  private selectedActivity(trigger: string, activity: string): Locator {
    return this.activityBlock(trigger)
      .locator('div:has(> .action-container)')
      .filter({ hasText: activity });
  }

  async selectedActivities(trigger: string): Promise<string[]> {
    const chips = this.activityBlock(trigger).locator('div:has(> .action-container)');
    return (await chips.allInnerTexts()).map((t) => t.trim());
  }

  // Makes `activities` the only chips under `trigger`, turns it on (every other
  // trigger off) and clicks Save. The caller checks savedToast().
  // A pick with `extra` is removed and picked again, so its Extra Configuration
  // always holds the values the caller gave, not the last saved ones.
  async setActivities(trigger: string, picks: ActivityPick[]): Promise<void> {
    const wanted = picks.map((p) => (typeof p === 'string' ? { activity: p, extra: undefined } : p));
    await this.openTriggers();
    await this.enableOnly(trigger);
    for (const chip of await this.selectedActivities(trigger)) {
      const pick = wanted.find((w) => w.activity === chip);
      if (!pick || pick.extra) await this.removeActivity(trigger, chip);
    }
    const kept = await this.selectedActivities(trigger);
    for (const { activity, extra } of wanted) {
      if (!kept.includes(activity)) await this.selectActivity(trigger, activity, extra);
    }
    await this.save();
  }

  async removeActivity(trigger: string, activity: string): Promise<void> {
    await this.selectedActivity(trigger, activity).locator('.action-container > svg').last().click();
  }

  // ---- Field Mapping ----

  // The Field Mapping tab is the default tab at this.path (no ?tab= query,
  // seen 2026-10-19), with 5 cards: Lead Properties, Contact Properties,
  // Opportunity Properties, Account Properties, salesforce_api_version.
  async openFieldMapping(): Promise<void> {
    await this.goto(this.path);
    if (await this.leadPropertiesCard().waitFor({ timeout: 30_000 }).then(() => true, () => false)) return;
    if (await this.reconnectIfDropped()) await this.goto(this.path);
    await this.leadPropertiesCard().waitFor();
  }

  private leadPropertiesCard(): Locator {
    return this.page.getByRole('button', { name: /Lead Properties/ });
  }

  // Opens the Lead Properties mapping (44 rows: a fixed Saleshandy field label
  // on the left, a Salesforce-property react-select on the right). Also used
  // as "reload the page" by calling it again from scratch.
  async openLeadPropertiesMapping(): Promise<void> {
    await this.openFieldMapping();
    await this.leadPropertiesCard().click();
    await this.leadMappingRow('Email').getByRole('combobox').waitFor();
  }

  // Each row is a div.d-flex.justify-content-between holding the label (inside
  // a fixed .default-filed span) and the Salesforce-property react-select.
  // Labels are unique per row (seen 2026-10-19), matched with exact text so
  // "Company" does not also match "Company Domain" etc.
  private leadMappingRow(saleshandyField: string): Locator {
    return this.page
      .locator('div.d-flex.justify-content-between')
      .filter({ has: this.page.locator('.default-filed').getByText(saleshandyField, { exact: true }) });
  }

  async mapLeadField(saleshandyField: string, salesforceProperty: string): Promise<void> {
    await this.leadMappingRow(saleshandyField).getByRole('combobox').click();
    await this.page.getByRole('option', { name: salesforceProperty, exact: true }).click();
  }

  // The react-select dropdown has no literal "Select" option (checked
  // 2026-10-19: Lead properties list starts Lead ID, Deleted, Master Record
  // ID, Last Name...). Unmapping is done through the control's own clear (x)
  // indicator, which reverts the row to the "Select" placeholder.
  async unmapLeadField(saleshandyField: string): Promise<void> {
    await this.leadMappingRow(saleshandyField).locator('.cs__clear-indicator, [class*="clearIndicator"]').first().click();
  }

  // The selected value text, or "Select" when nothing is mapped yet. react-select
  // shows the current value in .cs__single-value and the placeholder in
  // .cs__placeholder (seen 2026-10-19); exactly one of the two exists per row.
  leadMappedValue(saleshandyField: string): Locator {
    return this.leadMappingRow(saleshandyField).locator('.cs__single-value, .cs__placeholder');
  }

  // ---- Connection and Field Mapping of any object (production gate) ----

  // Connected: the Salesforce page shows "Disconnect". Not connected: Saleshandy sends the
  // page back to the integrations list, where the Salesforce card says "Re-connect"
  // (seen on staging 2026-10-22 and 2026-10-21; on production the card says "Connected").
  async isConnected(): Promise<boolean> {
    await this.goto(this.path);
    const disconnect = this.page.getByRole('button', { name: 'Disconnect', exact: true });
    const reconnect = this.page.getByText('Re-connect', { exact: true }).first();
    await disconnect.or(reconnect).first().waitFor({ timeout: 60_000 });
    return disconnect.isVisible();
  }

  // Opens one of the four mapping cards (44 rows each, seen on production 2026-10-22).
  async openMapping(object: MappingObject): Promise<void> {
    await this.openFieldMapping();
    await this.page.getByRole('button', { name: `logo Prospects in Saleshandy icon ${object} Properties`, exact: true }).click();
    await this.mappingRows().first().waitFor({ timeout: 60_000 });
  }

  private mappingRows(): Locator {
    return this.page.locator('div.d-flex.justify-content-between').filter({ has: this.page.locator('.default-filed') });
  }

  private mappingRow(saleshandyField: string): Locator {
    return this.mappingRows().filter({ has: this.page.locator('.default-filed').getByText(saleshandyField, { exact: true }) });
  }

  // The Salesforce property shown for a Saleshandy field, or "Select" when unmapped.
  async mappedValue(saleshandyField: string): Promise<string> {
    const value = this.mappingRow(saleshandyField).locator('.cs__single-value, .cs__placeholder');
    return (await value.innerText()).trim();
  }

  async mapField(saleshandyField: string, salesforceProperty: string): Promise<void> {
    await this.mappingRow(saleshandyField).getByRole('combobox').click();
    await this.page.getByRole('option', { name: salesforceProperty, exact: true }).click();
  }

  // Clears a mapped row back to "Select" with the control's own clear (x) indicator
  // (same locator as unmapLeadField, seen on staging 2026-10-19).
  async unmapField(saleshandyField: string): Promise<void> {
    await this.mappingRow(saleshandyField).locator('.cs__clear-indicator, [class*="clearIndicator"]').first().click();
  }

  // One click on Save: true when "Configuration Updated Successfully" shows, false when the red
  // "Something went wrong. Please try again." toast shows or nothing shows in 30 s. Seen on
  // production 2026-10-22: the mapping PUT to the Refold API failed with net::ERR_NETWORK_CHANGED
  // (a network change on the machine); the selections stay in the form, so Save can be clicked again.
  async trySaveMapping(): Promise<boolean> {
    await this.save();
    const failed = this.page.getByRole('alert').filter({ hasText: 'Something went wrong' }).first();
    return this.savedToast().or(failed).first().waitFor({ timeout: 30_000 }).then(() => this.savedToast().isVisible(), () => false);
  }

  // ---- Logs ----

  // One retry: seen 2026-10-19 where a hard navigation straight to ?tab=logs
  // left the Refresh button unrendered for minutes (a stuck load, not slow
  // rendering), consuming a whole test's timeout. A second goto recovers it.
  async openLogs(): Promise<void> {
    await this.goto(`${this.path}?tab=logs`);
    try {
      await this.page.getByRole('button', { name: 'Refresh' }).waitFor({ timeout: 30_000 });
    } catch {
      await this.goto(`${this.path}?tab=logs`);
      await this.page.getByRole('button', { name: 'Refresh' }).waitFor({ timeout: 30_000 });
    }
  }

  // Same stuck-page risk as openLogs(): bound the click and recover by
  // reopening the tab rather than let one hang eat the whole test timeout.
  async refreshLogs(): Promise<void> {
    try {
      await this.page.getByRole('button', { name: 'Refresh' }).click({ timeout: 30_000 });
    } catch {
      await this.openLogs();
    }
  }

  // Entries on the first page for one workflow, newest first. The Logs columns
  // are Workflow / Rule, Date, Duration, Status (seen 2026-10-16); a row reads
  // like "Reply is Received in Saleshandy 6ad1b712f981b2ee4b7e83c9 Oct 16, 2026, 11:03 AM 6.1s Success".
  async logEntries(workflow: string): Promise<SalesforceLogEntry[]> {
    const rows = this.page.getByRole('button', { name: `Open execution detail for ${workflow}`, exact: true });
    // A new account has no logs at all ("No logs yet"), and an account can have
    // logs for other workflows only; any of the three ends the wait.
    const empty = this.page.getByText('No logs yet', { exact: true });
    const anyRow = this.page.getByRole('button', { name: /^Open execution detail for / });
    await rows.first().or(empty).or(anyRow.first()).first().waitFor();
    if (await empty.isVisible()) return [];
    return (await rows.allInnerTexts()).map((raw) => {
      const text = raw.trim().replace(/\s+/g, ' ');
      const words = text.split(' ');
      return { id: words.find((w) => /^[0-9a-f]{24}$/.test(w)) ?? '', status: words[words.length - 1], text };
    });
  }
}
