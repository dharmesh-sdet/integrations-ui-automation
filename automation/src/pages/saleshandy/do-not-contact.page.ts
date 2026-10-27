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

  // Whether the global list shows an entry (an email or a domain).
  async hasEntry(entry: string): Promise<boolean> {
    await this.openGlobalList();
    return this.page.getByRole('row').filter({ hasText: entry }).first().waitFor({ timeout: 15_000 }).then(() => true, () => false);
  }

  // Removes one entry (an email or a domain) from the global list.
  async removeEntry(entry: string): Promise<void> {
    await this.openGlobalList();
    const row = this.page.getByRole('row').filter({ hasText: entry });
    await row.last().locator('.icon-element').click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toContainText('Delete Entry');
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(this.page.getByRole('row').filter({ hasText: entry })).toHaveCount(0);
  }
}
