import { HubSpotPage, HUBSPOT_PORTAL_ID } from './hubspot.page.ts';

export type NewContact = { email: string; firstName: string; lastName: string; jobTitle: string };

// Contacts list, the Create Contact panel, and a contact record's properties.
export class HubSpotContactsPage extends HubSpotPage {
  // The Create Contact panel is an iframe; it has no role or name, so CSS.
  private readonly createPanel = this.page.locator('[data-test-id="object-builder-ui-iframe"]').contentFrame();

  // Creates the contact and returns its record id (from the URL HubSpot opens).
  async createContact(contact: NewContact): Promise<string> {
    await this.goto(`/contacts/${HUBSPOT_PORTAL_ID}/objects/0-1/views/all/list`);
    await this.page.getByRole('button', { name: 'Add contacts' }).click();
    // The page header has its own "Create new" button, so the menu item is
    // targeted by its test id.
    await this.page.locator('[data-test-id="create-object-dropdown-create-object"]').click();

    await this.createPanel.getByRole('textbox', { name: 'Email' }).fill(contact.email);
    await this.createPanel.getByRole('textbox', { name: 'First name' }).fill(contact.firstName);
    await this.createPanel.getByRole('textbox', { name: 'Last name' }).fill(contact.lastName);
    // Job title is disabled until Email is filled; fill() waits for it.
    await this.createPanel.getByRole('textbox', { name: 'Job title' }).fill(contact.jobTitle);
    await this.createPanel.getByRole('button', { name: 'Create', exact: true }).click();

    await this.page.waitForURL(/\/(contact|record\/0-1)\/\d+/);
    return this.page.url().match(/\/(?:contact|record\/0-1)\/(\d+)/)![1];
  }

  // Edits properties on the record's "All Properties" panel. Labels match
  // exactly, so "Country/Region" never picks "Country/Region Code"; still, the
  // spec only edits City, Company name and Job title (QA, 2026-10-08). Each edit saves
  // on Enter, so HubSpot sends one update event per property.
  async updateProperties(contactId: string, values: Record<string, string>): Promise<void> {
    await this.goto(`/contacts/${HUBSPOT_PORTAL_ID}/record/0-1/${contactId}`);
    await this.page.locator('[data-test-id="card-wrapper-PROPERTIES_V3/0-1/V2"]').getByRole('button', { name: 'Actions', exact: true }).click();
    await this.page.getByRole('button', { name: 'View all properties' }).click();

    // Some properties (e.g. City) also show in the Key information card behind
    // the panel, so stay inside the panel's property groups (no role or name; CSS).
    const panel = this.page.locator('[data-test-id^="group-accordion-"]');
    for (const [label, value] of Object.entries(values)) {
      await this.page.getByRole('searchbox', { name: 'Search property' }).fill(label);
      await panel.getByRole('button', { name: new RegExp(`^${escape(label)} View property history`) }).click();
      const input = panel.getByRole('textbox', { name: label, exact: true });
      await input.fill(value);
      await input.press('Enter');
      // Saved once the read-only row shows the new value.
      await panel.getByRole('button', { name: new RegExp(`^${escape(label)} View property history.* ${escape(value)}$`) }).waitFor();
    }
  }

  // Sets a dropdown property (e.g. "Lifecycle stage") on the "All Properties"
  // panel. Seen 2026-10-12 (read-only): label casing is the panel's ("Lifecycle
  // stage", "Lead status"); one click on the row opens the picker; the row
  // button is then named "<label> <current value>"; options appear twice in
  // the DOM, so the last match is used.
  async setDropdownProperty(contactId: string, label: string, value: string): Promise<void> {
    await this.openAllProperties(contactId);
    const panel = this.page.locator('[data-test-id^="group-accordion-"]');
    await this.page.getByRole('searchbox', { name: 'Search property' }).fill(label);
    await panel.getByRole('button', { name: new RegExp(`^${escape(label)} View property history`) }).click();
    await this.page.getByRole('option', { name: value, exact: true }).last().click();
    await panel.getByRole('button', { name: new RegExp(`^${escape(label)}.* ${escape(value)}$`) }).waitFor();
  }

  // Finds a contact by email in the contacts list and returns its record id
  // (search URL and result link seen 2026-10-09).
  async findContactId(email: string, fullName: string): Promise<string> {
    await this.goto(`/contacts/${HUBSPOT_PORTAL_ID}/objects/0-1/views/all/list?query=${encodeURIComponent(email)}`);
    await this.page.getByRole('link', { name: new RegExp(escape(fullName)) }).first().click();
    await this.page.waitForURL(/\/record\/0-1\/\d+/);
    return this.page.url().match(/\/record\/0-1\/(\d+)/)![1];
  }

  // True when the contacts list search for the email shows the contact. Waits
  // up to 15 s for the result link, so "false" means it did not appear.
  async contactExists(email: string, fullName: string): Promise<boolean> {
    await this.goto(`/contacts/${HUBSPOT_PORTAL_ID}/objects/0-1/views/all/list?query=${encodeURIComponent(email)}`);
    try {
      await this.page.getByRole('link', { name: new RegExp(escape(fullName)) }).first().waitFor({ timeout: 15_000 });
      return true;
    } catch {
      return false;
    }
  }

  // Opens the record's "All Properties" panel.
  async openAllProperties(contactId: string): Promise<void> {
    await this.goto(`/contacts/${HUBSPOT_PORTAL_ID}/record/0-1/${contactId}`);
    await this.page.locator('[data-test-id="card-wrapper-PROPERTIES_V3/0-1/V2"]').getByRole('button', { name: 'Actions', exact: true }).click();
    await this.page.getByRole('button', { name: 'View all properties' }).click();
  }

  // The contact's Deals or Companies card (right sidebar, needs a 1280 px
  // window): the count from its "Deals (n)" heading and each record's id and
  // name. Seen 2026-10-09.
  async associations(contactId: string, kind: 'deals' | 'companies'): Promise<{ count: number; records: { id: string; name: string }[] }> {
    const [typeId, label] = kind === 'deals' ? ['0-3', 'Deals'] : ['0-2', 'Companies'];
    await this.goto(`/contacts/${HUBSPOT_PORTAL_ID}/record/0-1/${contactId}`);
    const card = this.page.locator(`[data-test-id="card-wrapper-ASSOCIATION_V3/${typeId}"]`);
    await card.scrollIntoViewIfNeeded();
    const heading = card.getByText(new RegExp(`^${label} \\(\\d+\\)$`));
    await heading.waitFor();
    const count = Number((await heading.innerText()).match(/\((\d+)\)/)![1]);
    const links = card.locator(`a[href*="/record/${typeId}/"]`);
    const records = await links.evaluateAll((as) =>
      as.map((a) => ({ id: (a.getAttribute('href') ?? '').match(/\/record\/\d+-\d+\/(\d+)/)?.[1] ?? '', name: (a as HTMLElement).innerText.trim() })),
    );
    return { count, records };
  }

  // In the open panel: the read-only row of a property showing this value
  // (HubSpot shows "--" for empty).
  async propertyRow(label: string, value: string) {
    await this.page.getByRole('searchbox', { name: 'Search property' }).fill(label);
    return this.page
      .locator('[data-test-id^="group-accordion-"]')
      .getByRole('button', { name: new RegExp(`^${escape(label)} View property history.* ${escape(value)}$`) });
  }
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
