import { expect } from '@playwright/test';
import { SaleshandyPage } from './saleshandy.page.ts';

// Settings > Do Not Contact List (walked 2026-10-15): the list page shows
// "Global Do Not Contact List"; opening it lists each entry as a table row
// (Email / Domain, Added By, Added On, Action). The Action cell holds one
// unnamed icon button; it opens "Delete Entry" ("all the related prospects
// will become active") with Cancel and Delete.
export class DoNotContactPage extends SaleshandyPage {
  async openGlobalList(): Promise<void> {
    await this.goto('/settings/dnc-list');
    await this.page.getByText('Global Do Not Contact List').first().click();
  }

  // Entry rows. Staging draws the list as div.tanstack-table--tr with no ARIA role (seen
  // 2026-11-11), so getByRole('row') matched nothing: hasEntry was always false and
  // the cleanup never removed a domain. A row is one that has the Action icon.
  private entryRows() {
    return this.page.locator('tr, [role="row"], .tanstack-table--tr').filter({ has: this.page.locator('.icon-element') });
  }

  // Whether the global list shows an entry (an email or a domain).
  async hasEntry(entry: string): Promise<boolean> {
    await this.openGlobalList();
    return this.entryRows().filter({ hasText: entry }).first().waitFor({ timeout: 15_000 }).then(() => true, () => false);
  }

  // Every entry (email or domain) of the global list: the first cell of each table row.
  // Only the rows on the first page are read; the list is not paged on staging while it
  // holds a few dozen entries (not walked with more).
  async entries(): Promise<string[]> {
    await this.openGlobalList();
    const rows = this.entryRows();
    await rows.first().waitFor({ timeout: 15_000 }).catch(() => undefined);
    // The first column is Email / Domain. Staging rows have no td or role=cell inside the row (seen 2026-11-11:
    // the cell lookup returned nothing for two real entries, so the cleanup never removed them), so the entry is
    // the first line of the row text ("harborfreight.example ZI Zoho Integration 11 Nov, 2026 12:43 PM").
    const cells = await rows.evaluateAll((rs) => rs.map((r) => ((r as HTMLElement).innerText.split('\n').map((l) => l.trim()).find(Boolean) ?? '')));
    return cells.filter(Boolean);
  }

  // Adds emails or domains to the global list. Walked on staging 2026-11-12: the global list page has an
  // inline box "Add entries with comma, semicolon, space or line breaks". Enter turns the text into chips and
  // only then the Save button is enabled. Every prospect matching an entry is blacklisted in all sequences.
  async addEntries(entries: string[]): Promise<string[]> {
    if (entries.length === 0) return [];
    // 25 entries at once showed "Invalid entrie(s) found" and kept Save disabled (2026-11-12, run 3). A batch of 10
    // then saved and the next batch was rejected again, so the box refuses some single addresses (the four tried alone
    // were accepted: a_young@dickenson.com, mujoshi+03949@gmail.com, nikita@saleshandy.com, rudra+sf-cc-i1@saleshandy.com).
    // A rejected batch is added one entry at a time. Returns the entries the box refused.
    const rejected: string[] = [];
    const save = this.page.getByRole('button', { name: 'Save', exact: true });
    const tryAdd = async (batch: string[]): Promise<boolean> => {
      await this.openGlobalList();
      const box = this.page.getByRole('textbox', { name: /Add entries with comma/ });
      await box.fill(batch.join(', '));
      await box.press('Enter');
      const enabled = await expect(save).toBeEnabled({ timeout: 8_000 }).then(() => true, () => false);
      if (!enabled) return false;
      await save.click();
      await expect(this.entryRows().filter({ hasText: batch[batch.length - 1] }).first()).toBeVisible({ timeout: 30_000 });
      return true;
    };
    for (let i = 0; i < entries.length; i += 10) {
      const batch = entries.slice(i, i + 10);
      if (await tryAdd(batch)) continue;
      for (const entry of batch) if (!(await tryAdd([entry]))) rejected.push(entry);
    }
    return rejected;
  }

  // Removes one entry (an email or a domain) from the global list.
  async removeEntry(entry: string): Promise<void> {
    await this.openGlobalList();
    const row = this.entryRows().filter({ hasText: entry });
    await row.last().locator('.icon-element').click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toContainText('Delete Entry');
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(this.entryRows().filter({ hasText: entry })).toHaveCount(0);
  }
}
