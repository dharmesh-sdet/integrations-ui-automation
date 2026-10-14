import { expect, type Locator } from '@playwright/test';
import type { Row } from '../../data/csv.ts';
import { SaleshandyPage } from './saleshandy.page.ts';

// Create & Add Prospect form: CSV column to input (no accessible names; ids
// seen 2026-10-09). Email and phone are textboxes with names, handled below.
const FORM_IDS: Record<string, string> = {
  'First Name': '#firstname',
  'Last Name': '#lastname',
  'Job Title': '#jobtitle',
  Department: '#department',
  Industry: '#industry',
  Experience: '#experience',
  LinkedIn: '#linkedin',
  Twitter: '#twitter',
  Facebook: '#facebook',
  Website: '#website',
  City: '#city',
  State: '#state',
  Country: '#country',
  Company: '#company',
  'Company Website': '#companywebsite',
  'Company Industry': '#companyindustry',
  'Company Founded Year': '[id="companyfounded year"]',
  'Company LinkedIn': '#companylinkedin',
  'Deal Value': '#dealvalue',
};

// A sequence's Prospects and Emails tabs.
export class SaleshandySequencePage extends SaleshandyPage {
  // Creates the prospect from a CSV row and adds it to step 1, one at a time
  // (Search & Add > Create New Prospect; never an import).
  async createAndAddProspect(sequenceId: string, row: Row): Promise<void> {
    await this.goto(`/sequence/${sequenceId}/prospects`);
    await this.closeSidebar();
    // Empty sequence: "Search & Add" is on the page. Otherwise it is an item of
    // the "Add Prospects" menu (both seen 2026-10-09).
    const searchAndAdd = this.page.getByRole('button', { name: 'Search & Add' });
    const addProspects = this.page.getByRole('button', { name: 'Add Prospects', exact: true });
    // The tab renders blank, then a skeleton, before its buttons (can take > 5 s).
    await expect(searchAndAdd.filter({ visible: true }).or(addProspects).first()).toBeVisible({ timeout: 30_000 });
    if (!(await searchAndAdd.filter({ visible: true }).count())) await addProspects.click();
    await searchAndAdd.filter({ visible: true }).click();
    await this.page.getByRole('button', { name: 'Create New Prospect', exact: true }).click();

    const form = this.page.getByRole('dialog').filter({ hasText: 'Create & Add Prospect' });
    await form.getByRole('textbox', { name: 'Enter Email', exact: true }).fill(row['Email']);
    if (row['Phone Number']) {
      await form.getByRole('button', { name: '+ Add Phone Number', exact: true }).click();
      await form.getByRole('textbox', { name: 'Enter Phone Number', exact: true }).fill(row['Phone Number']);
    }
    for (const [column, selector] of Object.entries(FORM_IDS)) {
      if (row[column]) await form.locator(selector).fill(row[column]);
    }
    await form.getByRole('button', { name: 'Create & Add to sequence', exact: true }).click();
    // The form stays open behind a status dialog; "Done" closes both.
    // Creating the prospect can take longer than the default 5 s.
    await expect(this.page.getByText('Successfully Moved')).toBeVisible({ timeout: 30_000 });
    await this.page.getByRole('button', { name: 'Done', exact: true }).click();
  }

  // The prospect's row for one step on the Emails tab (a real table).
  private emailRow(fullName: string, step: number): Locator {
    return this.page.getByRole('row').filter({ hasText: fullName }).filter({ hasText: `Step ${step}` });
  }

  async openEmails(sequenceId: string): Promise<void> {
    await this.goto(`/sequence/${sequenceId}/emails`);
    await this.page.getByRole('columnheader', { name: 'Clicked' }).waitFor();
  }

  // Makes sure the prospect's email for this step is out (QA, 2026-10-09):
  // - step 1, one prospect added: Saleshandy sends it by itself; never Send
  //   now. If it is not "Sent" within 3 minutes the account setup is wrong
  //   (time between emails should be 30-45 s), so fail and say so;
  // - step 1 with prospects added in bulk (e.g. CSV import): Send now;
  // - step 2 and later (days away): Send now.
  async ensureSent(sequenceId: string, fullName: string, step = 1, { bulk = false } = {}): Promise<void> {
    if (step > 1 || bulk) {
      await this.sendNow(sequenceId, fullName, step);
      return;
    }
    await expect(async () => {
      await this.openEmails(sequenceId);
      const row = this.emailRow(fullName, step);
      await expect(row).toBeVisible();
      expect((await (await this.cell(row, 'Scheduled/Sent')).innerText()).trim()).toMatch(/^Sent/);
    }, `Step 1 email to ${fullName} still not sent after 3 minutes; check the sender email account's time between emails (Email Accounts > Sending Settings, should be 30-45 s)`).toPass({ timeout: 3 * 60_000, intervals: [10_000] });
  }

  // Send now from the step's row. Skipped if the row already says "Sent".
  async sendNow(sequenceId: string, fullName: string, step = 1): Promise<void> {
    await this.openEmails(sequenceId);
    const row = this.emailRow(fullName, step);
    await expect(row).toBeVisible();
    if ((await (await this.cell(row, 'Scheduled/Sent')).innerText()).trim().startsWith('Sent')) return;
    // The row's three-dot menu has no accessible name.
    await row.locator('#dropdown-basic').click();
    await this.page.getByText('Send now', { exact: true }).click();
    await this.page.getByRole('dialog').filter({ hasText: 'Send the email now' }).getByRole('button', { name: 'Yes', exact: true }).click();
    // If the scheduler sent it while the table still said "Scheduled", Saleshandy
    // answers "Email has already been sent" (seen 2026-10-09); either way it is out.
    await expect(this.page.getByText('Email sent successfully').or(this.page.getByText('Email has already been sent'))).toBeVisible({ timeout: 15_000 });
  }

  // The prospect's Clicked number for a step ("-" or empty reads as 0).
  // Emails tab > row > three dots > "Mark as replied" (no confirm dialog; seen
  // 2026-10-09). Clicking it again on the same email fires the trigger again.
  async markAsReplied(sequenceId: string, fullName: string, step = 1): Promise<void> {
    await this.openEmails(sequenceId);
    const row = this.emailRow(fullName, step);
    await expect(row).toBeVisible();
    await row.locator('#dropdown-basic').click();
    await row.getByRole('button', { name: /Mark as replied$/ }).click();
    await expect(this.page.getByRole('alert').filter({ hasText: 'Email has been marked as replied' })).toBeVisible({ timeout: 15_000 });
  }

  // Emails tab > row > three dots > "Mark as bounced" (no confirm dialog; seen
  // 2026-10-12). The row then reads "Hard Bounced" and Latest Status Bounced.
  // It works on a sent row and on an Active or paused sequence (QA).
  async markAsBounced(sequenceId: string, fullName: string, step = 1): Promise<void> {
    await this.openEmails(sequenceId);
    const row = this.emailRow(fullName, step);
    await expect(row).toBeVisible();
    await row.locator('#dropdown-basic').click();
    await row.getByRole('button', { name: /Mark as bounced$/ }).click();
    await expect(this.page.getByRole('alert').filter({ hasText: 'Email has been marked as bounced' })).toBeVisible({ timeout: 15_000 });
  }

  // A real bounce: the row's Scheduled/Sent cell turns to a Bounced status by
  // itself after the send (seen as "Hard Bounced" for a manual one, 2026-10-12).
  async waitUntilBounced(sequenceId: string, fullName: string, step = 1, timeout = 5 * 60_000): Promise<void> {
    await expect(async () => {
      await this.openEmails(sequenceId);
      const row = this.emailRow(fullName, step);
      await expect(row).toBeVisible();
      expect((await (await this.cell(row, 'Scheduled/Sent')).innerText()).trim()).toMatch(/Bounced/);
    }, `Email to ${fullName} did not show Bounced within ${timeout / 60_000} minutes`).toPass({ timeout, intervals: [15_000] });
  }

  // The sequence's status switch next to its name (seen 2026-10-12): a confirm
  // dialog "Pause Sequence" or "Activate Sequence" with Yes, then a toast.
  async pauseSequence(sequenceId: string): Promise<void> {
    await this.setSequenceActive(sequenceId, false);
  }

  async resumeSequence(sequenceId: string): Promise<void> {
    await this.setSequenceActive(sequenceId, true);
  }

  private async setSequenceActive(sequenceId: string, active: boolean): Promise<void> {
    await this.goto(`/sequence/${sequenceId}/steps`);
    // The header renders before the sequence's status is known; wait for the
    // Steps tab content first, or the click is lost (seen 2026-10-12).
    await this.page.getByRole('button', { name: 'Add Step' }).first().waitFor();
    const toggle = this.page.locator('.switchToggle').first();
    await toggle.waitFor();
    if ((await toggle.locator('input[name="Switch"]').isChecked()) === active) return;
    await toggle.click();
    const dialog = this.page.getByRole('dialog').filter({ hasText: active ? 'Activate Sequence' : 'Pause Sequence' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Yes', exact: true }).click();
    await expect(this.page.getByRole('alert').filter({ hasText: active ? 'Sequence resumed successfully' : 'Sequence paused successfully' })).toBeVisible({ timeout: 15_000 });
  }

  async clickedCount(sequenceId: string, fullName: string, step = 1): Promise<number> {
    await this.openEmails(sequenceId);
    const row = this.emailRow(fullName, step);
    await expect(row).toBeVisible();
    return Number((await (await this.cell(row, 'Clicked')).innerText()).trim()) || 0;
  }

  // Moves a prospect that is still in step 1 to a later step (QA, 2026-10-13:
  // with the step 2 on Day 3 there is no step 2 row on the Emails tab until
  // then). Prospects tab > tick the row > "Add to Sequence" icon (the send
  // icon, no accessible name) > Sequence: the current one > Sequence Steps:
  // "Step N - Day D" > Add > report "Successfully Moved 1" > Done. The
  // prospect's step 1 row is replaced by a "Step N, Scheduled" row, which
  // Send now can then send.
  async moveToStep(sequenceId: string, email: string, step: number): Promise<void> {
    await this.goto(`/sequence/${sequenceId}/prospects`);
    await this.closeSidebar();
    await this.page.getByRole('columnheader', { name: 'Name' }).waitFor({ timeout: 30_000 });
    // The list is paged and a busy test sequence has many prospects, so the
    // row can be on a later page (seen 2026-10-13, about 40 prospects): search
    // first. The search matches one word or the email, not "First Last" with a
    // space (seen 2026-10-13), so it searches by email.
    await this.page.locator('.sequence-prospect-search-bar-and-filter input').fill(email);
    await this.page.keyboard.press('Enter');
    // The row shows the email cut after about 20 characters; its first 14 are always there.
    const row = this.page.getByRole('row').filter({ hasText: email.slice(0, 14) });
    await expect(row.first(), `prospect ${email} on the Prospects tab`).toBeVisible({ timeout: 30_000 });
    await row.first().getByRole('checkbox').check();
    await this.page.locator('button[icon="send"]').click();
    const dialog = this.page.getByRole('dialog').filter({ hasText: 'Add To Sequence' });
    await dialog.getByText('Select Sequence', { exact: true }).click();
    await this.page.getByText('(Current Sequence)').click();
    // The step list loads after the sequence is picked: a click before that
    // opens nothing (seen 2026-10-13), so click again until the option shows.
    const option = this.page.getByText(new RegExp(`^Step ${step} - Day`)).first();
    await expect(async () => {
      if (!(await option.isVisible())) await dialog.getByText('Select Step of Sequence', { exact: true }).click();
      await expect(option).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000, intervals: [1_000] });
    await option.click();
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(this.page.getByText('Successfully Moved')).toBeVisible({ timeout: 30_000 });
    await expect(this.page.getByText('Failed to move').locator('xpath=following-sibling::*[1]')).toHaveText(/0/);
    await this.page.getByRole('button', { name: 'Done', exact: true }).click();
  }

  // The prospect's Opened number for a step ("-" or empty reads as 0).
  async openedCount(sequenceId: string, fullName: string, step = 1): Promise<number> {
    await this.openEmails(sequenceId);
    const row = this.emailRow(fullName, step);
    await expect(row).toBeVisible();
    return Number((await (await this.cell(row, 'Opened')).innerText()).trim()) || 0;
  }

  private async cell(row: Locator, header: string): Promise<Locator> {
    const headers = (await this.page.getByRole('columnheader').allInnerTexts()).map((h) => h.trim());
    return row.getByRole('cell').nth(headers.indexOf(header));
  }
}
