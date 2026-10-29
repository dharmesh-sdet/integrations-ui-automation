import { chromium, type BrowserContext, type Page } from 'playwright';

// Zoho CRM, org 941113438 (US data center). Seen on staging 2026-10-29.
// Zoho CRM cannot be read headless ("Verify your identity"), and a visible window takes the user's focus.
// A headed browser on a virtual display does neither, so run the spec with `xvfb-run -a`. The saved browser
// profile keeps the login (cookie files do not). The profile cannot be open twice, so close any MCP Zoho window.
export const ZOHO_ORG = 'https://crm.zoho.com/crm/org941113438';

export type ZohoModule = 'Contacts' | 'Leads' | 'Accounts' | 'Deals' | 'Tasks';

// The bare /tab/Potentials and /tab/Tasks open a Kanban view with no rows (QA session notes, 2026-10-29).
const LIST: Record<ZohoModule, string> = {
  Contacts: '/tab/Contacts',
  Leads: '/tab/Leads',
  Accounts: '/tab/Accounts',
  Deals: '/tab/Potentials/custom-view/7636887000000087545/list',
  Tasks: '/tab/Tasks/custom-view/7636887000000331292/list',
};
const TAB: Record<ZohoModule, string> = { Contacts: 'Contacts', Leads: 'Leads', Accounts: 'Accounts', Deals: 'Potentials', Tasks: 'Tasks' };

export type ZohoRecord = { id: string; row: string };

export async function openZohoProfile(profileDir: string): Promise<{ context: BrowserContext; crm: ZohoCrmPage }> {
  const context = await chromium.launchPersistentContext(profileDir, { headless: false, viewport: { width: 1500, height: 1200 } });
  const page = context.pages()[0] ?? (await context.newPage());
  const crm = new ZohoCrmPage(page);
  await crm.open(`${ZOHO_ORG}${LIST.Contacts}`).catch(async (e) => { await context.close(); throw e; });
  return { context, crm };
}

export class ZohoCrmPage {
  readonly page: Page;
  constructor(page: Page) {
    this.page = page;
  }

  // Opens a Zoho page. Zoho sometimes asks "Verify your identity" (password), at the start or later in a run,
  // so every page load goes through here: try ZOHO_PASSWORD once, else stop with a clear message.
  async open(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const verify = this.page.getByText('Verify your identity');
    const loaded = this.page.getByRole('button', { name: 'Sort' }).first().or(this.page.getByText('Total Records')).or(this.page.getByText('Related List'));
    await loaded.first().or(verify).first().waitFor({ timeout: 60_000 }).catch(() => undefined);
    if (!(await verify.isVisible())) return;
    // The Zoho test scripts do not load automation/.env, so read the password from it here.
    if (!process.env.ZOHO_PASSWORD) {
      try { process.loadEnvFile(); } catch { /* no .env file */ }
    }
    const password = this.page.locator('input[type="password"]:visible').first();
    if (process.env.ZOHO_PASSWORD && (await password.isVisible())) {
      await password.fill(process.env.ZOHO_PASSWORD);
      await password.press('Enter');
      await verify.waitFor({ state: 'hidden', timeout: 60_000 }).catch(() => undefined);
    }
    if (await verify.isVisible()) throw new Error('Zoho asks "Verify your identity" and ZOHO_PASSWORD did not clear it. Sign in once in the Zoho profile.');
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  }

  // Opens a module list, newest first, and returns the rows whose text holds `needle` (case-insensitive).
  // Each record shows twice in the page (table and row role), so records are counted by id.
  async find(module: ZohoModule, needle: string): Promise<ZohoRecord[]> {
    await this.open(`${ZOHO_ORG}${LIST[module]}`);
    await this.page.getByRole('button', { name: 'Sort' }).first().waitFor({ timeout: 60_000 });
    await this.page.waitForTimeout(4_000);
    await this.sortNewestFirst();
    const tab = TAB[module];
    const rows = await this.page.locator('[role="row"]').evaluateAll(
      (els, args) =>
        els.map((el) => {
          const link = el.querySelector(`a[href*="/tab/${args.tab}/"]`) as HTMLAnchorElement | null;
          const id = link?.href.match(/\/tab\/[A-Za-z]+\/(\d{8,})/)?.[1] ?? '';
          return { id, row: (el as HTMLElement).innerText.replace(/\s*\n\s*/g, ' | ') };
        }),
      { tab },
    );
    const seen = new Set<string>();
    return rows.filter((r) => r.id && r.row.toLowerCase().includes(needle.toLowerCase()) && !seen.has(r.id) && !!seen.add(r.id));
  }

  private async sortNewestFirst(): Promise<void> {
    const sort = this.page.getByRole('button', { name: 'Sort' }).first();
    await sort.click();
    // Zoho keeps the sort per user and view. Once it is Created Time, Descending, the dialog has no "None"
    // option (seen by the Email Sent session, 2026-10-29), so leave it as it is.
    const none = this.page.getByText('None', { exact: true }).first();
    const alreadyNewestFirst = !(await none.isVisible({ timeout: 2_000 }).catch(() => false))
      && (await this.page.getByText('Created Time', { exact: true }).first().isVisible())
      && (await this.page.getByText('Descending', { exact: true }).first().isVisible());
    if (alreadyNewestFirst) {
      await this.page.keyboard.press('Escape');
      return;
    }
    await none.click();
    await this.page.getByText('Created Time', { exact: true }).last().click();
    await this.page.getByText('Ascending', { exact: true }).first().click();
    await this.page.getByText('Descending', { exact: true }).last().click();
    await this.page.getByRole('button', { name: 'Apply' }).click();
    await this.page.waitForTimeout(5_000);
  }

  // QA rule: look in Zoho first, 15 s after the Emails tab shows Sent, then every 10 s.
  async waitForRecord(module: ZohoModule, needle: string, timeoutMs = 90_000): Promise<ZohoRecord | undefined> {
    await this.page.waitForTimeout(15_000);
    const end = Date.now() + timeoutMs;
    for (;;) {
      const [first] = await this.find(module, needle);
      if (first || Date.now() > end) return first;
      await this.page.waitForTimeout(10_000);
    }
  }

  async recordText(module: ZohoModule, id: string): Promise<string> {
    await this.open(`${ZOHO_ORG}/tab/${TAB[module]}/${id}`);
    await this.page.getByText('Overview', { exact: true }).first().waitFor({ timeout: 60_000 });
    await this.page.waitForTimeout(6_000);
    return (await this.page.locator('body').innerText()).replace(/\n\s*\n+/g, '\n');
  }

  // Value on the line after a label in a record page's text, or '' when the field is empty.
  static field(text: string, label: string): string {
    const lines = text.split('\n').map((l) => l.trim());
    const i = lines.findIndex((l) => l === label);
    const next = i >= 0 ? (lines[i + 1] ?? '') : '';
    return next === '-' ? '' : next;
  }

  static noteCount(text: string): number {
    return Number(text.match(/\bNotes\s*\n\s*(\d+)/)?.[1] ?? 0);
  }

  // Test data a row needs first (QA: made by hand in Zoho). The form's first text box is the record's name field.
  async createAccount(name: string): Promise<string> {
    await this.open(`${ZOHO_ORG}${LIST.Accounts}`);
    await this.page.getByRole('button', { name: 'Create Account' }).first().waitFor({ timeout: 60_000 });
    await this.page.waitForTimeout(4_000);
    await this.page.getByRole('button', { name: 'Create Account' }).first().click();
    const field = this.page.getByRole('textbox', { name: /Account Name/ }).first();
    await field.waitFor({ timeout: 30_000 });
    await field.fill(name);
    await this.page.getByRole('button', { name: 'Save', exact: true }).first().click();
    await this.page.waitForURL(/\/tab\/Accounts\/\d{8,}/, { timeout: 30_000 });
    return this.page.url().match(/\/tab\/Accounts\/(\d+)/)![1];
  }

  // ---- Helpers for the rows that need records first, and for records the run creates ----
  // The forms and the deal stage bar below were not seen yet (written 2026-10-29). Heal them on the first run.

  async ids(module: ZohoModule): Promise<string[]> {
    return (await this.find(module, '')).map((r) => r.id);
  }

  // First record that was not in `before`: for records the run creates that have no email or name to search by.
  async waitForNewRecord(module: ZohoModule, before: string[], timeoutMs = 90_000): Promise<ZohoRecord | undefined> {
    await this.page.waitForTimeout(15_000);
    const end = Date.now() + timeoutMs;
    for (;;) {
      const fresh = (await this.find(module, '')).find((r) => !before.includes(r.id));
      if (fresh || Date.now() > end) return fresh;
      await this.page.waitForTimeout(10_000);
    }
  }

  // Record page text once it shows at least `count` notes (a second reply adds its note a few seconds late).
  async waitForNotes(module: ZohoModule, id: string, count: number, timeoutMs = 90_000): Promise<string> {
    const end = Date.now() + timeoutMs;
    for (;;) {
      const text = await this.recordText(module, id);
      if (ZohoCrmPage.noteCount(text) >= count || Date.now() > end) return text;
      await this.page.waitForTimeout(10_000);
    }
  }

  // Zoho shows a date as "Nov 5, 2026" or "11/05/2026" depending on the org, so match both.
  static dateText(daysFromToday: number): RegExp {
    const d = new Date(Date.now() + daysFromToday * 86_400_000);
    const month = d.toLocaleString('en-US', { month: 'short' });
    return new RegExp(`(${month} 0?${d.getDate()}, ${d.getFullYear()}|0?${d.getMonth() + 1}/0?${d.getDate()}/${d.getFullYear()})`);
  }

  // The text to type into a Zoho date box (MM/DD/YYYY), `daysFromToday` days from now.
  static dateInput(daysFromToday: number): string {
    const d = new Date(Date.now() + daysFromToday * 86_400_000);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  }

  private async createRecord(module: ZohoModule, button: string, fields: Record<string, string | undefined>, lookups: Record<string, string | undefined> = {}): Promise<string> {
    await this.open(`${ZOHO_ORG}${LIST[module]}`);
    await this.page.getByRole('button', { name: button }).first().waitFor({ timeout: 60_000 });
    await this.page.waitForTimeout(4_000);
    await this.page.getByRole('button', { name: button }).first().click();
    await this.page.getByRole('textbox', { name: /^(First Name|Last Name|Deal Name|Account Name)/ }).first().waitFor({ timeout: 30_000 });
    for (const [label, value] of Object.entries(fields)) {
      if (value) await this.page.getByRole('textbox', { name: new RegExp(`^${label}`) }).first().fill(value);
    }
    for (const [label, value] of Object.entries(lookups)) {
      if (!value) continue;
      const box = this.page.getByRole('textbox', { name: new RegExp(`^${label}`) }).first();
      await box.click();
      await box.fill(value);
      await this.page.getByText(value, { exact: true }).last().click();
    }
    await this.page.getByRole('button', { name: 'Save', exact: true }).first().click();
    await this.page.waitForURL(new RegExp(`/tab/${TAB[module]}/\\d{8,}`), { timeout: 30_000 });
    return this.page.url().match(new RegExp(`/tab/${TAB[module]}/(\\d+)`))![1];
  }

  createContact(c: { first: string; last: string; email: string; title?: string; phone?: string; account?: string }): Promise<string> {
    return this.createRecord('Contacts', 'Create Contact', { 'First Name': c.first, 'Last Name': c.last, Email: c.email, Title: c.title, Phone: c.phone }, { 'Account Name': c.account });
  }

  createLead(l: { first: string; last: string; email: string; company: string }): Promise<string> {
    return this.createRecord('Leads', 'Create Lead', { 'First Name': l.first, 'Last Name': l.last, Email: l.email, Company: l.company });
  }

  // Closing Date is required on a Deal, so a hand-made deal gets one. Stage keeps Zoho's default.
  createDeal(d: { name: string; closingDate: string; contact?: string; account?: string }): Promise<string> {
    return this.createRecord('Deals', 'Create Deal', { 'Deal Name': d.name, 'Closing Date': d.closingDate }, { 'Contact Name': d.contact, 'Account Name': d.account });
  }

  // The deal page has a stage bar: click the stage, then confirm if Zoho asks.
  async setDealStage(id: string, stage: string): Promise<void> {
    await this.open(`${ZOHO_ORG}/tab/${TAB.Deals}/${id}`);
    await this.page.getByText('Overview', { exact: true }).first().waitFor({ timeout: 60_000 });
    await this.page.getByText(stage, { exact: true }).first().click();
    const confirm = this.page.getByRole('button', { name: /^(Update|Save|Done)$/ }).first();
    if (await confirm.isVisible({ timeout: 3_000 }).catch(() => false)) await confirm.click();
    await this.page.waitForTimeout(3_000);
  }
}
