import { expect, type Locator } from '@playwright/test';
import { SaleshandyPage } from './saleshandy.page.ts';

// CRM > All Prospects list and the prospect details dialog.
export class SaleshandyCrmPage extends SaleshandyPage {
  // Searches by email and returns the "Showing N out of M" total.
  async search(email: string): Promise<number> {
    await this.goto('/crm/list');
    const total = this.page.getByText(/^out of \d+$/);
    const before = await total.innerText();
    const box = this.page.getByRole('textbox', { name: 'Search Name or Email' });
    await box.fill(email);
    await box.press('Enter');
    // The unfiltered list may already show this email at the top, so wait for
    // the total to change (all prospects, e.g. 136, to the search result). On an
    // account with one prospect it stays "out of 1", so give up after 10 s.
    await expect(total).not.toHaveText(before, { timeout: 10_000 }).catch(() => {});
    return Number((await total.innerText()).replace('out of ', ''));
  }

  // The "Sequence Associated" cell of a prospect's row in the list ("-" when
  // none). The list is a grid of plain divs: the row is the nearest ancestor of
  // the email text with 5 or more children, and the column is the 5th (Name,
  // Email, Job Title, Latest Status, Sequence Associated; walked 2026-10-15).
  // Call search(email) first.
  async sequenceAssociated(email: string): Promise<string> {
    return this.listCell(email, 5);
  }

  // Latest Status (4th cell: Active, Paused, Replied, Finished, Unsubscribed,
  // Blacklisted, ... per the KB; the exact texts are confirmed on first run).
  async latestStatus(email: string): Promise<string> {
    return this.listCell(email, 4);
  }

  // Prospect Tags (7th cell: Name, Email, Job Title, Latest Status, Sequence
  // Associated, Prospect Outcomes, Prospect Tags; walked 2026-10-15).
  async prospectTags(email: string): Promise<string> {
    return this.listCell(email, 7);
  }

  private async listCell(email: string, n: number): Promise<string> {
    const row = this.page.getByText(email, { exact: true }).locator('xpath=ancestor::*[count(*)>=5][1]');
    return (await row.locator(`xpath=*[${n}]`).innerText()).replace(/\n/g, ' ').trim();
  }

  async openProspect(fullName: string): Promise<void> {
    await this.page.getByRole('button', { name: fullName, exact: true }).click();
    await this.page.getByRole('dialog').waitFor();
  }

  // A field's value in the open prospect dialog, e.g. field('City').
  // Fields have no accessible name, so they are found by CSS plus the label text.
  field(label: string): Locator {
    return this.page
      .getByRole('dialog')
      .locator('.prospect-profile-section-fields')
      .filter({ has: this.page.locator('.prospect-profile-section-fields-label', { hasText: new RegExp(`^${label}$`) }) })
      .locator('.prospect-profile-section-field-detail');
  }

  // Changes a field in the open prospect dialog (seen 2026-10-09): find it with
  // "Search Prospect Fields", hover to show the pencil, type, Enter saves. The
  // pencil has no accessible name, so CSS.
  async editField(label: string, value: string): Promise<void> {
    const dialog = this.page.getByRole('dialog');
    await dialog.getByPlaceholder('Search Prospect Fields').fill(label);
    const field = dialog
      .locator('.prospect-profile-section-fields')
      .filter({ has: this.page.locator('.prospect-profile-section-fields-label', { hasText: new RegExp(`^${label}$`) }) });
    await field.locator('.prospect-profile-section-field-detail').hover();
    await field.locator('.prospect-profile-edit-action').click();
    const box = dialog.getByRole('textbox', { name: `Enter ${label.toLowerCase()}`, exact: true });
    await box.fill(value);
    await box.press('Enter');
    await expect(this.field(label)).toHaveText(value);
  }
}
