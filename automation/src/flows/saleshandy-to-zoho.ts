import type { Page } from '@playwright/test';
import type { Row } from '../data/csv.ts';
import type { ZohoIntegrationPage } from '../pages/saleshandy/zoho-integration.page.ts';
import type { SaleshandySequencePage } from '../pages/saleshandy/sequence.page.ts';

// Saleshandy to Zoho steps shared by the Zoho workflow specs: set the trigger and its actions, then
// add a prospect, send step 1 and Mark as replied. Names are as seen on staging, 2026-10-29.
export const ZOHO_ACTION = {
  contact: 'Create/Update a Contact in Zoho',
  lead: 'Create/Update a Lead in Zoho',
  account: 'Create/Update Account in Zoho',
  deal: 'Create/Update a Deal in Zoho',
  task: 'Create a Task in Zoho',
} as const;

export type TaskConfig = { subject?: string; status?: string; priority?: string; dueIn?: string };
export type ZohoAction =
  | { action: typeof ZOHO_ACTION.contact | typeof ZOHO_ACTION.lead | typeof ZOHO_ACTION.account }
  | { action: typeof ZOHO_ACTION.deal; closingDays?: string }
  | { action: typeof ZOHO_ACTION.task; task: TaskConfig };

export const fullName = (row: Row): string => `${row['First Name']} ${row['Last Name']}`.trim();

// Turns only `trigger` on, picks exactly `actions` (in order, Extra Configuration filled) and saves.
export async function configure(zoho: ZohoIntegrationPage, page: Page, trigger: string, actions: ZohoAction[]): Promise<void> {
  await zoho.openTriggers();
  await zoho.enableOnly(trigger);
  for (const chip of await zoho.selectedActivities(trigger)) await zoho.removeActivity(trigger, chip);
  for (const a of actions) {
    await zoho.selectActivity(trigger, a.action);
    if (a.action === ZOHO_ACTION.deal) await fillDialog(page, async (d) => {
      if (a.closingDays !== undefined) await d.getByRole('spinbutton').fill(a.closingDays);
    });
    if (a.action === ZOHO_ACTION.task) await fillDialog(page, async (d) => {
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

async function fillDialog(page: Page, fill: (dialog: ReturnType<Page['getByRole']>) => Promise<void>): Promise<void> {
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await fill(dialog);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
}

// Adds the prospect to step 1, sends it (counts against the send cap) and marks it as replied.
export async function sendAndReply(seq: SaleshandySequencePage, sequenceId: string, row: Row): Promise<void> {
  const name = fullName(row);
  await seq.createAndAddProspect(sequenceId, row);
  await seq.sendNow(sequenceId, name, 1, row['Email']);
  await seq.markAsReplied(sequenceId, name, 1, row['Email']);
}

// A second reply from the same prospect: step 2 is sent and marked as replied.
export async function replyAgain(seq: SaleshandySequencePage, sequenceId: string, row: Row, step = 2): Promise<void> {
  await seq.sendNow(sequenceId, fullName(row), step, row['Email']);
  await seq.markAsReplied(sequenceId, fullName(row), step, row['Email']);
}
