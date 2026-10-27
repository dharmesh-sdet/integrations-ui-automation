import { PipedrivePage } from './pipedrive.page.ts';

export type PipedriveOrganization = { id: string; name: string };

// Pipedrive Organizations (seen 2026-10-24): a list at /organizations/list whose rows link to
// /organization/<id>, and an "Organization" button that opens the same Add dialog as People.
export class PipedriveOrganizationsPage extends PipedrivePage {
  async openList(): Promise<void> {
    await this.goto('/organizations/list');
    await this.page.getByRole('button', { name: 'Organization', exact: true }).first().waitFor();
  }

  // Every organization on the list page whose name is exactly `name` (a company can have several,
  // because Create Organization adds a new one on every event).
  async idsByName(name: string): Promise<string[]> {
    await this.openList();
    const rows = this.page.locator('a[href*="/organization/"]');
    await rows.first().waitFor();
    // Same guard as the People list (QA, 2026-10-26: rows no longer delete what they create): the
    // header reads "2 organizations" (seen 2026-10-26, not a verified element type, so it is only
    // enforced when found). A list longer than what loaded must fail, not hide a record.
    const label = this.page.getByText(/^[\d,]+ organizations?$/).first();
    if (await label.count()) {
      const total = Number((await label.innerText()).replace(/\D/g, ''));
      const loaded = await rows.count();
      if (total > loaded) throw new Error(`The Organizations list shows ${total} organizations but only ${loaded} loaded; the reader would miss records`);
    }
    const found = await rows.evaluateAll((as) => as.map((a) => ({ href: a.getAttribute('href'), text: (a as HTMLElement).innerText.trim() })));
    return found.filter((f) => f.text === name).map((f) => PipedrivePage.idOf(f.href));
  }

  async countByName(name: string): Promise<number> {
    return (await this.idsByName(name)).length;
  }

  async create(name: string): Promise<string> {
    await this.openList();
    await this.page.getByRole('button', { name: 'Organization', exact: true }).first().click();
    const dialog = this.addDialog();
    await dialog.getByText('Name', { exact: true }).waitFor();
    await dialog.getByRole('textbox').first().fill(name);
    await this.saveAddDialog();
    const ids = await this.idsByName(name);
    if (ids.length === 0) throw new Error(`Organization "${name}" was saved but is not on the list`);
    return ids[ids.length - 1];
  }

  async open(id: string): Promise<void> {
    await this.goto(`/organization/${id}`);
    await this.page.getByRole('heading', { level: 1 }).last().waitFor();
  }

  // The name on an organization's page (the page title reads "<name> - Organization").
  async name(): Promise<string> {
    return (await this.page.title()).replace(/ - Organization$/, '').trim();
  }

  // Deletes the open organization (Options "..." > Delete > confirm).
  async deleteOpen(): Promise<void> {
    await this.deleteFromHeaderMenu();
  }
}
