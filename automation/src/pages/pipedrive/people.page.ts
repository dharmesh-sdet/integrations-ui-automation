import { PipedrivePage } from './pipedrive.page.ts';

export type PipedrivePerson = { id: string; name: string; emails: string[] };

// An activity of the person as the Edit activity dialog shows it. `type` is the selected type
// button (Call, Meeting, Task, Deadline, Email, Lunch); `note` is the note text.
export type PipedriveActivity = { subject: string; type: string; done: boolean; note: string };

// Pipedrive People (seen 2026-10-24). Contact Fields mapping of the workflow: Saleshandy
// First Name + Last Name -> Name, Email -> Email.
export class PipedrivePeoplePage extends PipedrivePage {
  async openList(): Promise<void> {
    await this.goto('/persons/list');
  }

  async open(id: string): Promise<void> {
    await this.goto(`/person/${id}`);
    await this.page.getByRole('heading', { level: 1 }).last().waitFor();
  }

  // Every row of the People list: the grid has no row element, but each column cell carries
  // data-test="person.name" / "person.email" (seen 2026-10-24), so the Nth name belongs to the Nth
  // email cell. The list shows the newest records at once (no search index to wait for). It
  // holds 100 rows a page; rows no longer delete their records, so the guard below fails when the list outgrows it.
  // A person saved a moment ago can be in the header count before the grid shows the row (408 shown,
  // 407 read right after a save, 2026-10-29, Create a Deal 3), so an incomplete read is repeated on a
  // fresh page (3 more tries, 5 s apart) before it fails.
  async rows(): Promise<PipedrivePerson[]> {
    for (let attempt = 1; ; attempt++) {
      const { total, rows } = await this.readOnce();
      if (rows.length >= total) return rows;
      if (attempt === 4) throw new Error(`The People list shows ${total} people but only ${rows.length} were read; the reader would miss records`);
      await this.page.waitForTimeout(5_000);
    }
  }

  private async readOnce(): Promise<{ total: number; rows: PipedrivePerson[] }> {
    await this.openList();
    await this.byId('person.name').first().waitFor();
    // The list has no search of its own (global search can lag behind new records) and no paging in
    // this reader, so a list longer than what loaded must fail here, not hide a record (QA, 2026-10-26:
    // rows no longer delete what they create). The header button reads "11 people".
    const total = Number((await this.page.getByRole('button', { name: /^[\d,]+ people$/ }).first().innerText()).replace(/\D/g, ''));
    // The list is virtual: only about 49 rows are in the page at once (49 of 58 on 2026-10-27), the
    // rest are swapped in as it scrolls. Read what is there, scroll, and merge by person id until
    // every person has been seen.
    // Scrolling loads past 100 rows: 198 of 198 were read on 2026-10-28, with the list sorted by Name,
    // where a cap of 100 missed new persons (Email Opened, Create a Deal 2 and Update a Deal 2).
    const target = total;
    const seen = new Map<string, PipedrivePerson>();
    let stale = 0;
    // The window is about 49 rows (about 1500 px), so a 1500 px step left no overlap and skipped a block of 12
    // rows (names D to M of 210, 2026-10-28, only on the page that had just saved a person). Scroll 600 px.
    // Six scrolls without a new row before giving up: 3 stopped at 97 of 98 and 98 of 102 on 2026-10-27.
    for (let step = 0; step < 150 && seen.size < target && stale < 6; step++) {
      const before = seen.size;
      for (const row of await this.visibleRows()) seen.set(row.id || `${row.name}|${row.emails.join(',')}`, row);
      stale = seen.size === before ? stale + 1 : 0;
      if (seen.size >= target) break;
      await this.byId('person.name').last().scrollIntoViewIfNeeded();
      await this.page.mouse.wheel(0, 600);
      await this.page.waitForTimeout(1000);
    }
    return { total: target, rows: [...seen.values()] };
  }

  private async visibleRows(): Promise<PipedrivePerson[]> {
    return this.page.evaluate(() => {
      const names = [...document.querySelectorAll('[data-test="person.name"]')];
      const emails = [...document.querySelectorAll('[data-test="person.email"]')];
      return names.map((cell, i) => {
        const link = cell.querySelector('a[href*="/person/"]');
        return {
          id: link?.getAttribute('href')?.match(/\/person\/(\d+)/)?.[1] ?? '',
          name: (link as HTMLElement | null)?.innerText.trim() ?? '',
          // The cell reads "a@b.com(Work)" with no space before the label.
          emails: ((emails[i] as HTMLElement | undefined)?.innerText ?? '').match(/[^\s()]+@[^\s()]+/g) ?? [],
        };
      });
    });
  }

  // Ids of the persons that carry exactly this email (compared without case, as Pipedrive does).
  async idsByEmail(email: string): Promise<string[]> {
    return (await this.rows()).filter((r) => r.emails.some((e) => e.toLowerCase() === email.toLowerCase())).map((r) => r.id);
  }

  async countByEmail(email: string): Promise<number> {
    return (await this.idsByEmail(email)).length;
  }

  // Add person dialog (Name, Organization, Phone, Email, Labels, Owner, Visible to).
  // Returns the new person's id from the success toast link.
  async create(person: { name: string; email: string; phone?: string; organization?: string }): Promise<string> {
    await this.openList();
    await this.page.getByRole('button', { name: 'Person', exact: true }).first().click();
    const dialog = this.addDialog();
    await dialog.getByText('Name', { exact: true }).waitFor();
    await dialog.getByRole('textbox').first().fill(person.name);
    await dialog.getByText('Email', { exact: true }).locator('xpath=following::input[1]').fill(person.email);
    if (person.phone) await dialog.getByText('Phone', { exact: true }).locator('xpath=following::input[1]').fill(person.phone);
    if (person.organization) {
      await dialog.getByRole('combobox').first().getByRole('textbox').fill(person.organization);
      await this.page.getByRole('option', { name: person.organization, exact: true }).first().click();
    }
    await this.saveAddDialog();
    const ids = await this.idsByEmail(person.email);
    if (ids.length !== 1) throw new Error(`Expected 1 person with ${person.email} after saving, found ${ids.length}`);
    return ids[0];
  }

  // ---- A person's page (call open(id) first) ----

  async name(): Promise<string> {
    // The page title reads "<name> - Person"; the heading shows the name with an underscore.
    return (await this.page.title()).replace(/ - Person$/, '').trim();
  }

  // Emails in the Summary block (each is a mailto link).
  async emails(): Promise<string[]> {
    return (await this.byId('person-summary').locator('a[href^="mailto:"]').allInnerTexts()).map((t) => t.trim());
  }

  // Phones in the Summary block (each is a callto link, seen 2026-10-26); the Details block does not list them.
  async phones(): Promise<string[]> {
    return (await this.byId('person-summary').locator('a[href^="callto:"]').allInnerTexts()).map((t) => t.trim());
  }

  // The Details block as label -> value, for example { 'First name': 'Walk', 'Last name': 'Through' }.
  // Each field is a "fields-list-row" whose text is the label, a line break and the value.
  async details(): Promise<Record<string, string>> {
    const rows = await this.byId('detail-block').locator('[data-testid="fields-list-row"]').allInnerTexts();
    const out: Record<string, string> = {};
    for (const row of rows) {
      const [label, ...value] = row.split('\n').map((t) => t.trim()).filter(Boolean);
      if (label) out[label] = value.join(' ');
    }
    return out;
  }

  // The organization linked to the person, or undefined ("No organization is linked to this person.").
  async organization(): Promise<string | undefined> {
    const block = this.byId('organization-block');
    if (await block.getByText('No organization is linked to this person.').isVisible()) return undefined;
    return (await block.getByRole('link').first().innerText()).trim();
  }

  // Titles of the deals in the Deals block (open and closed), newest first as Pipedrive lists them.
  async dealTitles(): Promise<string[]> {
    return (await this.byId('pipeline-deal-tile').getByRole('link').allInnerTexts())
      .map((t) => t.trim())
      .filter((t) => t && !/^\p{Sc}/u.test(t));
  }

  // Ids of the deals in the Deals block, oldest first (ids rise with creation time).
  async dealIds(): Promise<string[]> {
    const hrefs = await this.byId('pipeline-deal-tile').locator('a[href*="/deal/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
    return [...new Set(hrefs.map((h) => PipedrivePage.idOf(h)))].sort((a, b) => Number(a) - Number(b));
  }

  // History on a person page (seen 2026-10-24): filter buttons All, Activities (n), Notes (n), Leads,
  // Deals and Changelog, with data-testid "filter-button-<name>". Only done activities are listed
  // here; a scheduled one that is not done stays under Focus above History.
  private async openHistory(tab: 'activities' | 'leads' | 'deals'): Promise<void> {
    await this.byId(`filter-button-${tab}`).click();
  }

  // The "Activities (n)" button reads the count; 0 means no done activity on the person.
  async activityCount(): Promise<number> {
    const label = await this.byId('filter-button-activities').innerText();
    return Number(label.match(/\d+/)![0]);
  }

  // Titles of the leads on the person, from History > Leads. A lead reads "Lead created: <title>"
  // and its title links to /leads/inbox/<id>. A lead has no block on the person's left column.
  async leadTitles(): Promise<string[]> {
    await this.openHistory('leads');
    const links = this.byId('history-area').locator('a[href*="/leads/inbox/"]');
    // Nothing to wait for when there is no lead: give the list a moment to switch tabs.
    await this.page.waitForTimeout(500);
    return (await links.allInnerTexts()).map((t) => t.trim());
  }

  // The done activities of the person, from History > Activities. Each card shows only the subject,
  // owner and person; its type and note are read in the Edit activity dialog that opens on a click
  // on the title (and closed with Cancel), the way a user would look at them.
  async activities(): Promise<PipedriveActivity[]> {
    await this.openHistory('activities');
    await this.page.waitForTimeout(500);
    const titles = this.byId('history-area').locator('[data-testid="activity-title"]');
    const count = await titles.count();
    const out: PipedriveActivity[] = [];
    for (let i = 0; i < count; i++) {
      await titles.nth(i).click();
      const dialog = this.page.getByRole('dialog').filter({ has: this.byId('add-activity-form') });
      await dialog.waitFor();
      // The selected type's button carries data-cy-active="true" (seen 2026-10-24); it is set a moment
      // after the dialog opens, so wait for it.
      const selected = dialog.locator('[data-test^="activity-type-button-"][data-cy-active="true"]');
      await selected.waitFor();
      const type = ((await selected.getAttribute('data-test')) ?? '').replace('activity-type-button-', '');
      out.push({
        subject: await dialog.locator('[data-test="activity-subject"]').inputValue(),
        type,
        done: await dialog.locator('[data-test="mark-as-done"] input[type="checkbox"], input[type="checkbox"]').first().isChecked(),
        note: (await dialog.locator('[data-test="activity-note"]').innerText()).trim(),
      });
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
    }
    return out;
  }

  // Deletes the person from the page menu (Options "..." > Delete > confirm). Its deals stay.
  async deleteOpen(): Promise<void> {
    await this.deleteFromHeaderMenu();
  }
}
