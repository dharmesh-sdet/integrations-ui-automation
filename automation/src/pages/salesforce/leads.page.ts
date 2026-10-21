import { BasePage } from '../base.page.ts';
import { readRecordTab, waitForCreated } from './object.page.ts';

// Salesforce Lightning, Leads list and record page. List locators proved
// working through the real "> 7" scenario run (2026-10-19). Record-page field
// locators seen directly on the real Lead record for catalina.fuentes@mailinator.com
// (2026-10-19, plain Playwright with the saved sfreplyreceived session; the MCP
// exploration browser still cannot load Salesforce storage state, so this was
// checked with a throwaway script instead). Names come from the planner's notes
// (specs/salesforce-reply-received.md: Leads tab, list columns Name, Title,
// Company, Phone, Mobile, Email, Lead Status, Owner Alias).
export class SalesforceLeadsPage extends BasePage {
  readonly platform = 'salesforce' as const;

  // TODO(needs-input): list view to search. "__Recent" (Recently Viewed) may not
  // list a Lead nobody opened; use the list view that holds every Lead.
  private readonly listPath = '/lightning/o/Lead/list?filterName=__Recent';

  // 'networkidle' is unreliable on this page: Lightning keeps background
  // polling going, so it can hang well past 60s (seen 2026-10-19). Wait for
  // the search box instead, the concrete thing the next step needs.
  async openLeads(): Promise<void> {
    await this.page.goto(this.listPath, { waitUntil: 'domcontentloaded' });
    // The saved session was rejected: Salesforce shows its Login page.
    if ((await this.page.title()).startsWith('Login')) {
      throw new Error('salesforce session expired (the page shows the Salesforce Login). Run npm run login:salesforce in automation/ and log in again.');
    }
    await this.page.getByPlaceholder('Search this list...').waitFor();
  }

  // Number of Lead rows whose text shows the email, after searching the list for it.
  // Loads the list fresh on every call, so a retry sees records created since the
  // last look (the list does not refresh itself).
  async countByEmail(email: string): Promise<number> {
    await this.openLeads();
    const search = this.page.getByPlaceholder('Search this list...');
    await search.fill(email);
    await search.press('Enter');
    // The search re-renders the list; 'networkidle' is unreliable on this page
    // (see openLeads), so wait for the matching row with a generous timeout,
    // falling back to the count (0) if none appears in that window.
    await this.page.getByRole('row').filter({ hasText: email }).first().waitFor({ timeout: 15_000 }).catch(() => {});
    return this.page.getByRole('row').filter({ hasText: email }).count();
  }

  // Creates a Lead through the standard Lightning New Lead form. Setup for
  // scenarios that need a Lead to exist first. Locators follow the standard
  // field labels; not run on this org before 2026-10-20.
  async createLead(lead: {
    firstName: string;
    lastName: string;
    company: string;
    email: string;
    title: string;
    phone: string;
    // Lead Status picklist value; the form's default is "Open - Not Contacted"
    // (combobox "Lead Status", seen 2026-10-20).
    status?: string;
  }): Promise<void> {
    // The direct /new URL loaded a blank page (2026-10-20), so the form is opened
    // from the list's New button, the path already proven for the list itself.
    await this.openLeads();
    await this.page.getByRole('button', { name: 'New', exact: true }).click();
    const form = this.page.getByRole('dialog');
    await form.getByRole('textbox', { name: 'Last Name' }).waitFor({ timeout: 30_000 });
    await form.getByRole('textbox', { name: 'Last Name' }).fill(lead.lastName);
    await form.getByRole('textbox', { name: 'First Name' }).fill(lead.firstName);
    await form.getByRole('textbox', { name: 'Company' }).fill(lead.company);
    await form.getByRole('textbox', { name: 'Email' }).fill(lead.email);
    await form.getByRole('textbox', { name: 'Title' }).fill(lead.title);
    await form.getByRole('textbox', { name: 'Phone' }).fill(lead.phone);
    if (lead.status) {
      // A click alone does not open this picklist (aria-expanded stays false, checked
      // 2026-10-20); a click followed by Enter on the focused combobox does. Pressing
      // Enter without the click first did not open it.
      const status = form.getByRole('combobox', { name: 'Lead Status' });
      await status.click();
      await this.page.waitForTimeout(1_000);
      if ((await status.getAttribute('aria-expanded')) !== 'true') await status.press('Enter');
      await this.page.getByRole('option', { name: lead.status, exact: true }).click();
    }
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await waitForCreated(this.page, 'Lead');
  }

  // Opens the one Lead record found by email from the Leads list, then its
  // Details tab (seen 2026-10-19: Lightning record page tabs are Activity,
  // Details, Chatter; the highlights panel alone does not show Last Name, City
  // etc., only Title/Company/Phone/Email).
  async openLead(email: string): Promise<void> {
    // A Lead created a moment ago may not be in the list search yet (seen
    // 2026-10-20: "0 items" for a Lead the form had just created, and the old
    // unbounded wait ran for 14 minutes). Reload and search again, a bounded
    // number of times.
    const attempts = 6;
    let row = this.page.getByRole('row').filter({ hasText: email }).first();
    for (let attempt = 1; attempt <= attempts; attempt++) {
      await this.openLeads();
      const search = this.page.getByPlaceholder('Search this list...');
      await search.fill(email);
      await search.press('Enter');
      row = this.page.getByRole('row').filter({ hasText: email }).first();
      if (await row.waitFor({ timeout: 10_000 }).then(() => true, () => false)) break;
      if (attempt === attempts) throw new Error(`No Lead for ${email} in the Leads list after ${attempts} searches.`);
      await this.page.waitForTimeout(5_000);
    }
    // The list shows a spinner while it re-renders after the search; a click then
    // lands on the spinner or on a row that is replaced (seen 2026-10-20).
    await this.page.locator('lightning-spinner').first().waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
    await row.getByRole('link').first().click({ timeout: 30_000 });
    await this.page.getByRole('tab', { name: 'Details' }).waitFor();
    await this.page.getByRole('tab', { name: 'Details' }).click();
    await this.leadField('Email').waitFor();
  }

  // Each Details-tab row is a listitem tagged with the field's API name, e.g.
  // data-target-selection-name="sfdc:RecordField.Lead.Company" (seen 2026-10-19).
  // The value sits in .test-id__field-value; innerText also includes the
  // label and an "Edit <field>" button, so read only that inner span.
  private leadField(apiName: string): import('@playwright/test').Locator {
    return this.page.locator(`[data-target-selection-name="sfdc:RecordField.Lead.${apiName}"] .test-id__field-value`);
  }

  private async leadFieldText(apiName: string): Promise<string> {
    return (await this.leadField(apiName).innerText()).replace(/\s+/g, ' ').trim();
  }

  // Reads back the fields this workflow maps and checks (2026-10-19). "name" is
  // the combined First+Last Name Salesforce shows on Lead (there is no separate
  // First Name / Last Name row in Details); "address" is the compound Address
  // field (holds City, State, Country as one rendered block, empty when none of
  // those are mapped/filled).
  async leadFields(email: string): Promise<{
    name: string;
    phone: string;
    company: string;
    title: string;
    email: string;
    address: string;
    status: string;
  }> {
    await this.openLead(email);
    return {
      name: await this.leadFieldText('Name'),
      phone: await this.leadFieldText('Phone'),
      company: await this.leadFieldText('Company'),
      title: await this.leadFieldText('Title'),
      email: await this.leadFieldText('Email'),
      address: await this.leadFieldText('Address'),
      status: await this.leadFieldText('Status'),
    };
  }

  // Text of the Lead's Activity tab (the timeline: logged emails, tasks), for the
  // Record(log) an Email Activity rows. Same reader as the other objects.
  async activityText(email: string): Promise<string> {
    await this.openLead(email);
    return readRecordTab(this.page, 'Activity');
  }
}
