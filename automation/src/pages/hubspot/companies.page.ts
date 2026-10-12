import { HubSpotPage, HUBSPOT_PORTAL_ID } from './hubspot.page.ts';

export type NewCompany = { domain: string; name: string };
// One associated contact, found in the Add panel by its "Name (email)" label.
export type CompanyContact = { email: string; firstName: string; lastName: string };

// Companies list, the Create Company panel, and a company record's Contacts
// card (walked 2026-10-09). The create form has no contact field: contacts
// are associated on the record right after creating it (QA, 2026-10-09).
export class HubSpotCompaniesPage extends HubSpotPage {
  // Create and Add panels open in the same iframe; it has no role or name, so CSS.
  private readonly panel = this.page.locator('[data-test-id="object-builder-ui-iframe"]').contentFrame();

  // Creates the company and returns its record id (HubSpot opens the record).
  // HubSpot may list existing companies under the name ("Gosh ..."); they are
  // only suggestions and Create still makes a new company (QA, 2026-10-09).
  async createCompany(company: NewCompany): Promise<string> {
    await this.goto(`/contacts/${HUBSPOT_PORTAL_ID}/objects/0-2/views/all/list`);
    await this.page.getByRole('button', { name: 'Add companies' }).click();
    // The page header has its own "Create new" button, so the menu item is
    // targeted by its test id (same menu as on Contacts).
    await this.page.locator('[data-test-id="create-object-dropdown-create-object"]').click();
    await this.panel.getByRole('textbox', { name: 'Company domain name' }).fill(company.domain);
    await this.panel.getByRole('textbox', { name: 'Company name' }).fill(company.name);
    await this.panel.getByRole('button', { name: 'Create', exact: true }).click();
    await this.page.waitForURL(/\/record\/0-2\/\d+/);
    return this.page.url().match(/\/record\/0-2\/(\d+)/)![1];
  }

  // On the company record: Contacts card > Add > Add existing (the default
  // tab), search each contact, tick it, Save. Waits for the card's count.
  async associateContacts(companyId: string, contacts: CompanyContact[]): Promise<void> {
    if (!contacts.length) return;
    await this.goto(`/contacts/${HUBSPOT_PORTAL_ID}/record/0-2/${companyId}`);
    // The card has no accessible name; its wrapper's test id is the hook.
    const card = this.page.locator('[data-test-id="card-wrapper-ASSOCIATION_V3/0-1"]');
    await card.getByRole('button', { name: 'Add', exact: true }).click();
    for (const c of contacts) {
      const label = `${c.firstName} ${c.lastName} (${c.email})`;
      await this.panel.getByRole('searchbox', { name: 'Search' }).fill(c.email);
      // A wrapper div covers the checkbox input, so the label text is clicked.
      await this.panel.getByText(label, { exact: true }).click();
      await this.panel.getByRole('checkbox', { name: label }).isChecked().then((on) => {
        if (!on) throw new Error(`Could not tick ${label} in the Add contacts panel`);
      });
    }
    await this.panel.getByRole('button', { name: 'Save', exact: true }).click();
    await this.page.getByRole('button', { name: `Contacts (${contacts.length})`, exact: true }).waitFor();
  }
}
