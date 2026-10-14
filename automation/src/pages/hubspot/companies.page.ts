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
    // When HubSpot lists companies with the same domain ("Gosh, that looks
    // familiar"), the form's "Create" is disabled and the button reads "Create
    // a new company" (seen 2026-10-12); click whichever one is enabled.
    // The same-domain check swaps the button a moment after the fields are
    // filled; a click that lands in the swap does nothing (seen 2026-10-13:
    // the form stayed open for 5 minutes). So click again until the record opens.
    const recordUrl = /\/record\/0-2\/\d+/;
    // 'commit', not the default 'load': the record page can take over 15 s to
    // load, and a slow success must not look like a lost click (Email Bounced
    // trace, 2026-10-13). Click again only while the form is still open.
    const buttonName = /^Create( a new company)?$/;
    for (let attempt = 1; ; attempt++) {
      await this.panel.getByRole('button', { name: buttonName, disabled: false }).click();
      try {
        await this.page.waitForURL(recordUrl, { timeout: 15_000, waitUntil: 'commit' });
        break;
      } catch (e) {
        if ((await this.panel.getByRole('button', { name: buttonName }).count()) === 0) {
          // The form is gone: the company is being created, so wait for the record.
          await this.page.waitForURL(recordUrl, { timeout: 90_000, waitUntil: 'commit' });
          break;
        }
        if (attempt === 4) throw e;
      }
    }
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

  // A property's value from the company record's "About this company" card
  // ("--" when empty), e.g. property(id, 'City'). NOT walked yet (2026-10-12):
  // the card's test id prefix follows the deal record's
  // (`card-wrapper-PROPERTIES_V3/0-3`), and the label-then-value line order is
  // the one deals.page.ts reads on "About this deal".
  async property(companyId: string, label: string): Promise<string> {
    await this.goto(`/contacts/${HUBSPOT_PORTAL_ID}/record/0-2/${companyId}`);
    // Seen 2026-10-12: the left card is "Key information" and shows only some
    // fields (City, but not State/Region, domain or Country). "View all
    // properties" has every row as "<label>\n<value>", e.g. "City", "State/Region",
    // "Company domain name", "Country/Region"; empty shows "--".
    await this.page.locator('[data-test-id="card-wrapper-PROPERTIES_V3/0-2/V2"]').getByRole('button', { name: 'Actions', exact: true }).click();
    await this.page.getByRole('button', { name: 'View all properties' }).click();
    await this.page.getByRole('searchbox', { name: 'Search property' }).fill(label);
    const row = this.page.locator('[data-test-id^="group-accordion-"]').getByRole('button', { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')} View property history`) }).first();
    await row.waitFor();
    const lines = (await row.innerText()).split('\n').map((l) => l.trim()).filter(Boolean);
    return lines[1] ?? '--';
  }
}
