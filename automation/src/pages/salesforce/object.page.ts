import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../base.page.ts';

// Clicks a tab of the open record and returns the text of the tab panel. The
// timeline and related lists fill in after the tab opens, so it waits 3 s first.
// Works on any Lightning record page, including a Lead opened by leads.page.ts.
export async function readRecordTab(page: Page, tab: string): Promise<string> {
  await page.getByRole('tab', { name: tab }).click({ timeout: 10_000 });
  await page.waitForTimeout(3_000);
  return (await page.getByRole('tabpanel').filter({ visible: true }).first().innerText()).replace(/\s+/g, ' ').trim();
}

// Salesforce Lightning list and record pages for a standard object other than
// Lead (Lead has its own proven page, leads.page.ts). The list and record
// conventions below were proven on Lead in this org (2026-10-19) and are the
// standard Lightning markup for every standard object:
// - the list has a "Search this list..." box and rows that link to the record;
// - the record has tabs Activity, Details, Chatter (Contact and Opportunity also Related);
// - every Details row is tagged data-target-selection-name="sfdc:RecordField.<Object>.<ApiName>"
//   and its value sits in .test-id__field-value.
// TODO(needs-input): these two objects have not been opened on this org yet; the
// first run confirms the list filter, the search and the tab names.
// After Save on a New Lead / New Contact form: Lightning shows either a "was
// created" toast or, when a record with the same details exists, a "Similar
// Records Exist" warning and keeps the form open (seen 2026-10-20). Fail at once
// on the warning: a duplicate setup record would change what the scenario tests.
export async function waitForCreated(page: Page, what: string): Promise<void> {
  const created = page.getByText(/was created/).first();
  const duplicate = page.getByText('Similar Records Exist').first();
  await Promise.race([
    created.waitFor({ timeout: 15_000 }),
    duplicate.waitFor({ timeout: 15_000 }).then(() => {
      throw new Error(`Salesforce says a similar ${what} already exists ("Similar Records Exist"); use a new prospect for this setup record.`);
    }),
  ]);
}

export abstract class SalesforceObjectPage extends BasePage {
  readonly platform = 'salesforce' as const;

  protected abstract readonly objectName: string;

  // "Recently Viewed" may not list a record nobody opened; same caveat as Leads.
  private get listPath(): string {
    return `/lightning/o/${this.objectName}/list?filterName=__Recent`;
  }

  // 'networkidle' never settles on Lightning (background polling), so wait for
  // the search box, the concrete thing the next step needs.
  async openList(): Promise<void> {
    await this.page.goto(this.listPath, { waitUntil: 'domcontentloaded' });
    if ((await this.page.title()).startsWith('Login')) {
      throw new Error('salesforce session expired (the page shows the Salesforce Login). Run npm run login:salesforce -- <account of the spec> in automation/ and log in again (npm run login:salesforce:fresh if that session is rejected again).');
    }
    await this.page.getByPlaceholder('Search this list...').waitFor();
  }

  private async search(text: string): Promise<void> {
    const box = this.page.getByPlaceholder('Search this list...');
    await box.fill(text);
    await box.press('Enter');
  }

  // Number of rows whose text shows `text`, after searching the list for it.
  async countByText(text: string): Promise<number> {
    await this.openList();
    await this.search(text);
    await this.page.getByRole('row').filter({ hasText: text }).first().waitFor({ timeout: 15_000 }).catch(() => {});
    return this.page.getByRole('row').filter({ hasText: text }).count();
  }

  // Text of every row that shows `text` (the list columns), for annotations.
  async rowTexts(text: string): Promise<string[]> {
    await this.countByText(text);
    return (await this.page.getByRole('row').filter({ hasText: text }).allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  }

  // Opens the first record found for `text` and its Details tab.
  async openRecord(text: string): Promise<void> {
    // Same bounded search as the Leads list: a record created a moment ago may not
    // be listed yet (seen 2026-10-20), so reload and search again, up to 6 times.
    const attempts = 6;
    let row = this.page.getByRole('row').filter({ hasText: text }).first();
    for (let attempt = 1; attempt <= attempts; attempt++) {
      await this.openList();
      await this.search(text);
      row = this.page.getByRole('row').filter({ hasText: text }).first();
      if (await row.waitFor({ timeout: 10_000 }).then(() => true, () => false)) break;
      if (attempt === attempts) throw new Error(`No ${this.objectName} for ${text} in the list after ${attempts} searches.`);
      await this.page.waitForTimeout(5_000);
    }
    // Same spinner wait as the Leads list (seen 2026-10-20).
    await this.page.locator('lightning-spinner').first().waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
    await row.getByRole('link').first().click({ timeout: 30_000 });
    await this.page.getByRole('tab', { name: 'Details' }).waitFor();
    await this.page.getByRole('tab', { name: 'Details' }).click();
  }

  private fieldLocator(apiName: string): Locator {
    return this.page.locator(`[data-target-selection-name="sfdc:RecordField.${this.objectName}.${apiName}"] .test-id__field-value`);
  }

  // The value of a Details field on the open record; '' when the row is absent or empty.
  async field(apiName: string): Promise<string> {
    // The Details tab first shows grey placeholder bars (seen 2026-10-20, which made
    // every field read ''), so wait for the first real value.
    await this.page.locator('.test-id__field-value').first().waitFor({ timeout: 15_000 }).catch(() => {});
    const locator = this.fieldLocator(apiName);
    if (!(await locator.count())) return '';
    return (await locator.first().innerText()).replace(/\s+/g, ' ').trim();
  }

  // Text of the record's Activity tab (the timeline: logged emails, tasks, notes).
  async activityText(): Promise<string> {
    return readRecordTab(this.page, 'Activity');
  }

  // Text of the record's Related tab (related lists such as Notes, Opportunities, Contact Roles).
  async relatedText(): Promise<string> {
    return readRecordTab(this.page, 'Related');
  }
}
