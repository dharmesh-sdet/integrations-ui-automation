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
    await expect(this.page.getByText('Successfully Moved')).toBeVisible();
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

  async clickedCount(sequenceId: string, fullName: string, step = 1): Promise<number> {
    await this.openEmails(sequenceId);
    const row = this.emailRow(fullName, step);
    await expect(row).toBeVisible();
    return Number((await (await this.cell(row, 'Clicked')).innerText()).trim()) || 0;
  }

  private async cell(row: Locator, header: string): Promise<Locator> {
    const headers = (await this.page.getByRole('columnheader').allInnerTexts()).map((h) => h.trim());
    return row.getByRole('cell').nth(headers.indexOf(header));
  }
}
