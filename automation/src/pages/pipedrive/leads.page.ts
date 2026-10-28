import { PipedrivePage } from './pipedrive.page.ts';

// Pipedrive Leads Inbox (seen 2026-10-24): /leads/inbox is a grid whose rows read "<title> No
// activity Manually created <date> <owner>". A lead made by the workflow shows the same way. A
// person's page lists its leads under History > Leads (PipedrivePeoplePage.leadTitles); this page
// reads and removes them account-wide, which is how a test cleans up after itself.
export class PipedriveLeadsPage extends PipedrivePage {
  async openInbox(): Promise<void> {
    await this.goto('/leads/inbox');
    // An empty inbox shows "Add your first lead" instead of the grid. The grid itself shows before its
    // rows load (seen 2026-10-24: a read right after it found no row), so wait for a lead row.
    await this.rows().first().or(this.page.getByText('Add your first lead')).first().waitFor();
  }

  // Grid rows that are leads: the header row sits directly in the grid with a select-all checkbox,
  // while lead rows are inside the grid's rowgroup, which also holds empty placeholder rows (seen
  // 2026-10-24: 10 of them), so a lead row is a rowgroup row with a checkbox.
  private rows() {
    return this.page.getByRole('grid').getByRole('rowgroup').getByRole('row').filter({ has: this.page.getByRole('checkbox') });
  }

  // Titles of all leads in the inbox, in the order Pipedrive lists them. The title is the first
  // line of the row's text (seen 2026-10-24: "pd-lead-check", then "No activity", the source and the date).
  async titles(): Promise<string[]> {
    await this.openInbox();
    return this.rows().evaluateAll((rs) =>
      rs.map((r) => (r as HTMLElement).innerText.split('\n').map((t) => t.trim()).filter(Boolean)[0] ?? ''),
    );
  }

  async countByTitle(title: string): Promise<number> {
    return (await this.titles()).filter((t) => t === title).length;
  }

  // Add lead dialog (Inbox > Lead button, seen 2026-10-27): Contact person, Organization, Title, Value,
  // Labels, Owner, and so on. A lead needs a person or an organization, so the person is picked first
  // (typed by name, picked from the list). The dialog is not confirmed on a page yet, so the check is
  // that the title shows in the Inbox afterwards.
  async createForPerson(personName: string, title: string): Promise<void> {
    await this.openInbox();
    await this.page.getByRole('button', { name: 'Lead', exact: true }).click();
    const dialog = this.page.getByRole('dialog').filter({ hasText: 'Add lead' });
    await dialog.getByText('Contact person', { exact: true }).waitFor();
    await dialog.getByRole('combobox').first().getByRole('textbox').fill(personName);
    await this.page.getByRole('option', { name: personName }).first().click();
    await dialog.getByText('Title', { exact: true }).locator('xpath=following::input[1]').fill(title);
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
  }

  // Deletes every lead with exactly this title: tick each row, Delete in the toolbar, confirm.
  // Pipedrive keeps deleted leads in "Restore data" for 30 days.
  async deleteByTitle(title: string): Promise<void> {
    const titles = await this.titles();
    const wanted = titles.flatMap((t, i) => (t === title ? [i] : []));
    if (wanted.length === 0) return;
    for (const i of wanted) {
      // The checkbox input sits under its own check icon, which takes the click.
      await this.rows().nth(i).locator('svg.cui5-checkbox__checkmark').click();
    }
    // The toolbar's buttons can sit under the page header; a script click reaches them.
    await this.page.locator('button[aria-label="Delete"]').evaluate((b: HTMLElement) => b.click());
    await this.page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await this.page.getByRole('dialog').waitFor({ state: 'hidden' });
  }
}
