import { SalesforceObjectPage, waitForCreated } from './object.page.ts';

// Salesforce Contacts. Details API names follow the Contact Properties mapping on
// sfemailsent: First/Last Name -> Name, Email, Phone Number -> Phone (Business
// Phone), Department, City -> Other City (compound OtherAddress).
export class SalesforceContactsPage extends SalesforceObjectPage {
  protected readonly objectName = 'Contact';

  async countByEmail(email: string): Promise<number> {
    return this.countByText(email);
  }

  // Creates a Contact through the standard Lightning New Contact form. Setup
  // for scenarios that need a Contact to exist first. Not run on this org yet:
  // the locators follow the standard field labels.
  async createContact(person: { firstName: string; lastName: string; email: string; phone?: string; department?: string }): Promise<void> {
    // Opened from the list's New button; the direct /new URL loaded blank for Lead.
    await this.openList();
    await this.page.getByRole('button', { name: 'New', exact: true }).click();
    const form = this.page.getByRole('dialog');
    await form.getByRole('textbox', { name: 'Last Name' }).waitFor({ timeout: 30_000 });
    await form.getByRole('textbox', { name: 'Last Name' }).fill(person.lastName);
    await form.getByRole('textbox', { name: 'First Name' }).fill(person.firstName);
    await form.getByRole('textbox', { name: 'Email' }).fill(person.email);
    // Phone and Department are the standard Contact form labels (not run on this org yet).
    if (person.phone) await form.getByRole('textbox', { name: 'Phone', exact: true }).fill(person.phone);
    if (person.department) await form.getByRole('textbox', { name: 'Department' }).fill(person.department);
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await waitForCreated(this.page, 'Contact');
  }

  // Opens the Contact, its Related tab, then the first Note whose title is
  // `title`, and returns the Note's Body text (seen 2026-10-20: the Note record
  // page shows Title, Parent, Body, Created Date). '' when there is no such Note.
  async noteBody(email: string, title: string): Promise<string> {
    await this.openRecord(email);
    await this.page.getByRole('tab', { name: 'Related' }).click();
    const note = this.page.getByRole('link', { name: title }).first();
    if (!(await note.waitFor({ timeout: 15_000 }).then(() => true, () => false))) return '';
    await note.click();
    await this.page.getByText('Created Date').first().waitFor({ timeout: 20_000 });
    const text = (await this.page.locator('body').innerText()).replace(/\s+/g, ' ');
    return text.match(/Body (.*?) (?:Created Date|Created By)/)?.[1]?.trim() ?? '';
  }

  async contactFields(email: string): Promise<{
    name: string;
    email: string;
    phone: string;
    department: string;
    title: string;
    otherAddress: string;
  }> {
    await this.openRecord(email);
    return {
      name: await this.field('Name'),
      email: await this.field('Email'),
      phone: await this.field('Phone'),
      department: await this.field('Department'),
      title: await this.field('Title'),
      otherAddress: await this.field('OtherAddress'),
    };
  }
}
