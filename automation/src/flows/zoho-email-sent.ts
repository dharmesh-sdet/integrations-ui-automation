import type { Page } from '@playwright/test';
import type { Row } from '../data/csv.ts';
import type { ZohoIntegrationPage } from '../pages/saleshandy/zoho-integration.page.ts';
import type { SaleshandySequencePage } from '../pages/saleshandy/sequence.page.ts';
import { ZOHO_ACTION, fullName, type ZohoAction } from './saleshandy-to-zoho.ts';

// Steps only the Zoho Email Sent spec needs. The steps shared with the other Zoho workflows stay in
// saleshandy-to-zoho.ts, which another session owns (QA 2026-10-29), so nothing is added there.
export const TRIGGER = 'Email Sent from Saleshandy';
export const NOTE_TITLE = 'Saleshandy Email Sent from Sequence';

// Adds the prospect to step 1 and sends it, or moves a prospect that is already in the sequence to a
// later step and sends that step. Returns when the Emails tab row shows "Sent" (counts against the send cap).
export async function sendStep(seq: SaleshandySequencePage, sequenceId: string, row: Row, step = 1): Promise<void> {
  if (step === 1) await seq.createAndAddProspect(sequenceId, row);
  else await seq.moveToStep(sequenceId, row['Email'], step);
  await seq.sendNow(sequenceId, fullName(row), step, row['Email']);
}

// Zoho shows dates as dd/mm/yyyy for the test user (seen 29/10/2026 on 2026-10-29).
export function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return [d.getDate(), d.getMonth() + 1].map((n) => String(n).padStart(2, '0')).join('/') + `/${d.getFullYear()}`;
}

// A task page has no Notes count, only the note text, so notes are counted by their title.
export const noteTitles = (text: string): number => text.split(NOTE_TITLE).length - 1;

// Zoho draws an empty field as a dash with CSS, so the page text has no line for it and the next line is the
// next label. A field is blank when its value is empty or is one of these labels.
const RECORD_LABELS = new Set([
  'Phone', 'Mobile', 'Email', 'Lead Name', 'Lead Status', 'Lead Source', 'Contact Name', 'Account Name', 'Company',
  'Title', 'Department', 'Department', 'Fax', 'Website', 'Industry', 'Home Phone', 'Other Phone', 'Assistant',
  'Created By', 'Modified By', 'Skype ID', 'Twitter', 'Reporting To', 'Contact Owner', 'Lead Owner',
]);
export function isBlankField(value: string): boolean {
  return value === '' || RECORD_LABELS.has(value);
}

// Like `configure` in saleshandy-to-zoho.ts (shared, another session owns it), but it waits for the
// "Configuration Updated" message after each Extra Configuration Save, as QA does by hand (2026-11-02).
// Without the wait, the next action is picked while the first save is still running and the last chip
// (the Task) is lost: 3 probes showed 4 chips after a reload. With the wait, all 5 chips stay.
export async function configureWaiting(zoho: ZohoIntegrationPage, page: Page, trigger: string, actions: ZohoAction[]): Promise<void> {
  await zoho.openTriggers();
  await zoho.enableOnly(trigger);
  for (const chip of await zoho.selectedActivities(trigger)) await zoho.removeActivity(trigger, chip);
  const saveDialog = async (fill: (d: ReturnType<Page['getByRole']>) => Promise<void>): Promise<void> => {
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await fill(dialog);
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await zoho.savedToast().waitFor({ timeout: 15_000 });
    await page.waitForTimeout(2_500);
  };
  for (const a of actions) {
    await zoho.selectActivity(trigger, a.action);
    if (a.action === ZOHO_ACTION.deal) await saveDialog(async (d) => {
      if (a.closingDays !== undefined) await d.getByRole('spinbutton').fill(a.closingDays);
    });
    if (a.action === ZOHO_ACTION.task) await saveDialog(async (d) => {
      const t = a.task;
      if (t.dueIn !== undefined) await d.getByRole('spinbutton').fill(t.dueIn);
      if (t.subject !== undefined) await d.getByRole('textbox').first().fill(t.subject);
      for (const [i, option] of [[0, t.status], [1, t.priority]] as const) {
        if (!option) continue;
        await d.locator('.bs-select-box').nth(i).click();
        await page.locator('.transfer-select-box li').filter({ hasText: new RegExp(`^\\s*${option}\\s*$`) }).click();
      }
    });
  }
  await zoho.save();
  await zoho.savedToast().waitFor({ timeout: 20_000 });
}
