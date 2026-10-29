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
    return (await this.readAll()).filter((f) => f.text === name).map((f) => f.id);
  }

  // The name of every organization on the list (one entry per organization).
  async names(): Promise<string[]> {
    return (await this.readAll()).map((f) => f.text);
  }

  // Same retry as the People list: an organization saved a moment ago can be in the header count, or
  // missing from the grid, for a few seconds (Create Organization 2, "Retool" saved but not on the
  // list, 2026-10-29). An incomplete read is repeated on a fresh page (3 more tries, 5 s apart).
  private async readAll(): Promise<{ id: string; text: string }[]> {
    for (let attempt = 1; ; attempt++) {
      const { total, rows } = await this.readOnce();
      if (rows.length >= Math.min(total, 100)) return rows;
      if (attempt === 4) throw new Error(`The Organizations list shows ${total} organizations but only ${rows.length} were read; the reader would miss records`);
      await this.page.waitForTimeout(5_000);
    }
  }

  private async readOnce(): Promise<{ total: number; rows: { id: string; text: string }[] }> {
    await this.openList();
    const rows = this.page.locator('a[href*="/organization/"]');
    await rows.first().waitFor();
    // Same guard as the People list (QA, 2026-10-26: rows no longer delete what they create): the
    // header reads "2 organizations" (seen 2026-10-26, not a verified element type, so it is only
    // enforced when found). A list longer than what loaded must fail, not hide a record.
    const label = this.page.getByText(/^[\d,]+ organizations?$/).first();
    const total = (await label.count()) ? Number((await label.innerText()).replace(/\D/g, '')) : 0;
    // The list is virtual, like People: only about 48 rows are in the page at once (49 and 50 listed,
    // 48 loaded, 2026-10-28), the rest are swapped in as it scrolls. Read what is there, scroll, and merge
    // by organization id until every organization has been seen. One page holds 100 rows.
    const target = Math.min(total, 100);
    const seen = new Map<string, { id: string; text: string }>();
    let stale = 0;
    // A 1500 px step left no overlap with the 48-row window and skipped rows (99 shown, 97 read,
    // 2026-10-29, Create a Deal 3), the same as on the People list. Scroll 600 px, as People does.
    for (let step = 0; step < 150 && stale < 6; step++) {
      const before = seen.size;
      const found = await rows.evaluateAll((as) => as.map((a) => ({ href: a.getAttribute('href'), text: (a as HTMLElement).innerText.trim() })));
      for (const f of found) seen.set(PipedrivePage.idOf(f.href), { id: PipedrivePage.idOf(f.href), text: f.text });
      stale = seen.size === before ? stale + 1 : 0;
      if (seen.size >= target) break;
      await rows.last().scrollIntoViewIfNeeded();
      await this.page.mouse.wheel(0, 600);
      await this.page.waitForTimeout(1000);
    }
    return { total, rows: [...seen.values()] };
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
    let ids = await this.idsByName(name);
    // The new row can lag behind the save by a few seconds: look again (up to 6 times, 5 s apart).
    for (let attempt = 1; ids.length === 0 && attempt <= 6; attempt++) {
      await this.page.waitForTimeout(5_000);
      ids = await this.idsByName(name);
    }
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
