import { expect, type Page } from '@playwright/test';
import type { Row } from '../data/csv.ts';
import type { ZohoIntegrationPage } from '../pages/saleshandy/zoho-integration.page.ts';
import { ZOHO_ACTION, type ZohoAction } from './saleshandy-to-zoho.ts';

// Steps only the Zoho Conversation Category spec needs. The steps shared with the other Zoho workflows stay in
// saleshandy-to-zoho.ts, which another session owns (QA 2026-10-29), so nothing is added there.
export const TRIGGER = 'Conversation Category is Updated in Saleshandy';
// Sequence 197611 on gzoho (QA 2026-11-03).
export const SEQUENCE_NAME = 'Conversation Category is Updated in Saleshandy';
// The note text carries "New Outcome Updated: <outcome>" (dev runs C1 to C5). The note title is not recorded yet.
export const NOTE_PREFIX = 'New Outcome Updated:';

// Saleshandy outcomes, from the Pipedrive list. TODO(needs-input): the Zoho category list was never seen on staging
// (it only shows after an action is picked), so these names are unconfirmed.
export const OUTCOME = {
  interested: 'Interested',
  notInterested: 'Not Interested',
  closed: 'Closed',
  meetingBooked: 'Meeting Booked',
  doNotContact: 'Do Not Contact',
  outOfOffice: 'Out of Office',
  notNow: 'Not Now',
} as const;

// One action under the trigger. `category` undefined: the dialog is saved with the box empty, which is how
// the gate is left empty (run C3).
export type CategoryAction = ZohoAction & { category?: string };

// Number of notes the outcome events made on a record page.
export const outcomeNotes = (text: string): number => text.split(NOTE_PREFIX).length - 1;

// Makes this trigger the only one of this workflow that is on, with exactly `actions` under it, each with its
// category, and saves. Other triggers are left alone (KEEP_OTHER_TRIGGERS=1 in the spec).
// TODO(needs-input): the dialog under this trigger is assumed to be the Pipedrive one: Deal shows Closing date,
// Pipelines and Stages (greyed), Task shows Due In, Subject, Status and Priority, and "Select Saleshandy
// Conversation Category" is the LAST .bs-select-box with its values as <li> in .transfer-select-box.
// Whether the box takes a list or free text, and whether each action keeps its own category, is not confirmed.
export async function configureCategory(zoho: ZohoIntegrationPage, page: Page, actions: CategoryAction[]): Promise<void> {
  await zoho.openTriggers();
  await zoho.enableOnly(TRIGGER);
  for (const chip of await zoho.selectedActivities(TRIGGER)) await zoho.removeActivity(TRIGGER, chip);
  for (const [i, a] of actions.entries()) {
    // Pause between actions, like a person adding them one by one (Pipedrive lost an action when added within seconds).
    if (i > 0) await page.waitForTimeout(5_000);
    await zoho.selectActivity(TRIGGER, a.action);
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ timeout: 15_000 });
    // Seen 2026-10-31 (Contact) and 2026-11-03 run (Deal, Task): the category is a plain text box, the last
    // textbox of the dialog. Task's Status and Priority are the only lists.
    const categoryBox = dialog.getByRole('textbox').last();
    if (a.category === undefined) {
      // Seen 2026-10-31: the empty box saves (gate 3). Cancel would leave the trigger without the action.
      // Run 2026-11-03: the box kept "Meeting Booked" from an earlier save, so clear it first.
      await categoryBox.fill('');
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await dialog.waitFor({ state: 'hidden', timeout: 15_000 });
      continue;
    }
    const lists = dialog.locator('.bs-select-box');
    const pick = async (index: number, choice: string) => {
      const option = page.locator('.transfer-select-box li').filter({ hasText: new RegExp(`^\\s*${choice}\\s*$`) });
      for (let attempt = 1; ; attempt++) {
        await lists.nth(index).click({ timeout: 10_000 });
        try {
          await option.click({ timeout: 8_000 });
          return;
        } catch (error) {
          if (attempt === 4) throw error;
          // A click on the heading closes only the open list; Escape can close the whole dialog.
          await dialog.getByText('Extra Configuration').first().click({ timeout: 5_000 });
          await page.waitForTimeout(1_500);
        }
      }
    };
    if (a.action === ZOHO_ACTION.deal && a.closingDays !== undefined) await dialog.getByRole('spinbutton').fill(a.closingDays);
    if (a.action === ZOHO_ACTION.task) {
      const t = a.task;
      if (t.dueIn !== undefined) await dialog.getByRole('spinbutton').fill(t.dueIn);
      if (t.subject !== undefined) await dialog.getByRole('textbox').first().fill(t.subject);
      if (t.status) await pick(0, t.status);
      if (t.priority) await pick(1, t.priority);
    }
    await categoryBox.fill(a.category);
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 15_000 });
  }
  await zoho.save();
  await zoho.savedToast().waitFor({ timeout: 20_000 });
}

// Loads the page again and reads the category the saved action holds (nothing is changed, the dialog is
// cancelled). The trigger only runs when the saved category matches the outcome, so a stale one looks like
// "the workflow did nothing".
export async function expectSavedCategory(zoho: ZohoIntegrationPage, page: Page, action: string, category: string): Promise<void> {
  await zoho.openTriggers();
  await zoho.reopenExtraConfiguration(TRIGGER, action);
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ timeout: 15_000 });
  // The category is the last plain text box in every dialog (seen 2026-10-31 and 2026-11-03).
  const saved = (await dialog.getByRole('textbox').last().inputValue()).trim();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 15_000 });
  expect(saved, `saved category of "${action}" after a reload`).toBe(category);
}

// Sets the conversation category of a replied prospect in Unified Inbox.
// TODO(needs-input): nothing here was seen on staging. The route, the search box, the conversation list and the
// category control are guesses; the first run of Trigger and category gate 5 confirms or corrects them.
export async function setInboxCategory(page: Page, row: Row, category: string): Promise<void> {
  await page.goto(`${new URL(page.url()).origin}/conversations`); // route seen 2026-10-31 (sidebar link); the screen has the search box "Search Conversations..."
  await page.getByPlaceholder(/search/i).first().fill(row['Email']);
  await page.getByText(row['Email'].slice(0, 14)).first().click({ timeout: 30_000 });
  await page.getByRole('button', { name: /categor|outcome/i }).first().click({ timeout: 15_000 });
  await page.locator('li').filter({ hasText: new RegExp(`^\\s*${category}\\s*$`) }).first().click({ timeout: 15_000 });
}
