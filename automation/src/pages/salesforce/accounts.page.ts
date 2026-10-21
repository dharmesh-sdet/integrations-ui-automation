import { SalesforceObjectPage, waitForCreated } from './object.page.ts';

// Salesforce Accounts. Account Properties mapping (context/salesforce/00-overview.md):
// Company -> Account Name, City -> Billing City, Website -> Website.
// TODO(needs-input): the New Account form labels follow the standard Lightning
// form and have not been opened on this org yet; the first run confirms them.
export class SalesforceAccountsPage extends SalesforceObjectPage {
  protected readonly objectName = 'Account';

  // Number of Account rows whose text shows `name`.
  async countByName(name: string): Promise<number> {
    return this.countByText(name);
  }

  // Creates an Account through the list's New button (same path as Lead and Contact).
  async createAccount(account: { name: string; billingCity?: string; phone?: string }): Promise<void> {
    await this.openList();
    await this.page.getByRole('button', { name: 'New', exact: true }).click();
    const form = this.page.getByRole('dialog');
    await form.getByRole('textbox', { name: 'Account Name' }).waitFor({ timeout: 30_000 });
    await form.getByRole('textbox', { name: 'Account Name' }).fill(account.name);
    if (account.billingCity) await form.getByRole('textbox', { name: 'Billing City' }).fill(account.billingCity);
    if (account.phone) await form.getByRole('textbox', { name: 'Phone', exact: true }).fill(account.phone);
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await waitForCreated(this.page, 'Account');
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
