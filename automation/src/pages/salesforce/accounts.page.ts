import { fillContactForm, type ContactInput } from './contacts.page.ts';
import { SalesforceObjectPage, waitForCreated } from './object.page.ts';

// Salesforce Accounts. Account Properties mapping (context/salesforce/00-overview.md):
// Company -> Account Name, City -> Billing City, Website -> Website.
// TODO(needs-input): the New Account form labels follow the standard Lightning
// form and have not been opened on this org yet; the first run confirms them.
export class SalesforceAccountsPage extends SalesforceObjectPage {
  protected readonly objectName = 'Account';
  protected readonly listView = 'AllAccounts';

  // Number of Account rows whose text shows `name`.
  async countByName(name: string): Promise<number> {
    return this.countByText(name);
  }

  // Creates an Account through the list's New button (same path as Lead and Contact).
  async createAccount(account: { name: string; billingCity?: string; phone?: string }): Promise<void> {
    await this.openList();
    await this.page.getByRole('button', { name: 'New', exact: true }).click();
    const form = this.page.getByRole('dialog').last();
    await form.getByRole('textbox', { name: 'Account Name' }).waitFor({ timeout: 30_000 });
    await form.getByRole('textbox', { name: 'Account Name' }).fill(account.name);
    if (account.billingCity) await form.getByRole('textbox', { name: 'Billing City' }).fill(account.billingCity);
    if (account.phone) await form.getByRole('textbox', { name: 'Phone', exact: true }).fill(account.phone);
    const save = form.getByRole('button', { name: 'Save', exact: true });
    await save.click();
    // Company names repeat across runs (the people pool shares 30 companies), so the org's duplicate
    // alert "Similar Records Exist" is normal here (seen 2026-10-21). It is only an alert: a second
    // Save keeps the new Account, as a user would.
    const created = this.page.getByText(/was created/).first();
    const duplicate = this.page.getByText('Similar Records Exist').first();
    await Promise.race([created.waitFor({ timeout: 15_000 }), duplicate.waitFor({ timeout: 15_000 })]);
    // The alert popover hides the form from the accessibility tree (2026-10-21 run: the role lookup
    // timed out although the Save button shows), so the second Save is found by its text.
    // After the second Save the alert text can still be in the DOM while the page moves to the new
    // record (2026-10-21 run: the Account existed, waitForCreated threw on the stale alert), so the
    // record page URL is the proof of creation, not the toast.
    if (await duplicate.isVisible()) {
      await this.page.locator('button:text-is("Save")').click();
      await this.page.waitForURL(/\/lightning\/r\/(?:Account\/)?001\w+\/view/, { timeout: 30_000 });
      return;
    }
    await waitForCreated(this.page, 'Account');
  }

  // Billing Address of every Account named `name`, from each Details tab. The list has no Billing
  // City column (2026-10-21: a row reads "Select Item 1 HashiCorp ChintanS Show Actions"), so its
  // text can never show a city.
  async billingAddresses(name: string): Promise<string[]> {
    const count = await this.countByName(name);
    const addresses: string[] = [];
    for (let i = 0; i < count; i++) {
      await this.openRecord(name, i);
      addresses.push(await this.field('BillingAddress'));
    }
    return addresses;
  }

  // Creates a Contact from the Account's own Contacts related list, so Salesforce links it
  // to the Account (the "Account is created in Salesforce" workflow imports an Account's
  // Contacts). Same path as contacts.page.ts newOpportunity. TODO(needs-input): the
  // Contacts card and its New button are not walked on this org yet.
  async newContact(accountName: string, person: ContactInput): Promise<void> {
    await this.openRecord(accountName);
    await this.page.getByRole('tab', { name: 'Related' }).click();
    const card = this.page.locator('article').filter({ has: this.page.getByRole('heading', { name: /^Contacts/ }) }).first();
    await card.getByRole('button', { name: 'New', exact: true }).click({ timeout: 30_000 });
    await fillContactForm(this.page, person);
  }

  async accountFields(name: string): Promise<{ name: string; billingAddress: string; website: string; phone: string }> {
    await this.openRecord(name);
    return {
      name: await this.field('Name'),
      billingAddress: await this.field('BillingAddress'),
      website: await this.field('Website'),
      phone: await this.field('Phone'),
    };
  }
}
