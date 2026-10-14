# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: hubspot/reply-received.spec.ts >> Reply is received in Saleshandy >> Create a Contact in HubSpot > 4: Contact already at a later Lifecycle Stage than the configured one
- Location: src/flows/activity-rows.ts:488:5

# Error details

```
Test timeout of 300000ms exceeded.
```

```
Error: locator.fill: Target page, context or browser has been closed
Call log:
  - waiting for locator('[data-test-id="object-builder-ui-iframe"]').contentFrame().getByRole('textbox', { name: 'Job title' })
    - locator resolved to <textarea id="input-44" data-test-id="jobtitle-input" data-selenium-test="property-input-jobtitle" class="TextArea__StyledTextArea-knLkrZ cVpbeo" data-transitional-component="ExpandingTextArea" aria-labelledby="FormControl-property-input-input-44"></textarea>
    - fill("Revenue Operations Manager")
  - attempting fill action
    2 × waiting for element to be visible, enabled and editable
      - element is not enabled
    - retrying fill action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and editable
      - element is not enabled
    - retrying fill action
      - waiting 100ms
    522 × waiting for element to be visible, enabled and editable
        - element is not enabled
      - retrying fill action
        - waiting 500ms

```

# Test source

```ts
  1   | import { HubSpotPage, HUBSPOT_PORTAL_ID } from './hubspot.page.ts';
  2   | 
  3   | export type NewContact = { email: string; firstName: string; lastName: string; jobTitle: string };
  4   | 
  5   | // Contacts list, the Create Contact panel, and a contact record's properties.
  6   | export class HubSpotContactsPage extends HubSpotPage {
  7   |   // The Create Contact panel is an iframe; it has no role or name, so CSS.
  8   |   private readonly createPanel = this.page.locator('[data-test-id="object-builder-ui-iframe"]').contentFrame();
  9   | 
  10  |   // Creates the contact and returns its record id (from the URL HubSpot opens).
  11  |   async createContact(contact: NewContact): Promise<string> {
  12  |     await this.goto(`/contacts/${HUBSPOT_PORTAL_ID}/objects/0-1/views/all/list`);
  13  |     await this.page.getByRole('button', { name: 'Add contacts' }).click();
  14  |     // The page header has its own "Create new" button, so the menu item is
  15  |     // targeted by its test id.
  16  |     await this.page.locator('[data-test-id="create-object-dropdown-create-object"]').click();
  17  | 
  18  |     await this.createPanel.getByRole('textbox', { name: 'Email' }).fill(contact.email);
  19  |     await this.createPanel.getByRole('textbox', { name: 'First name' }).fill(contact.firstName);
  20  |     await this.createPanel.getByRole('textbox', { name: 'Last name' }).fill(contact.lastName);
  21  |     // Job title is disabled until Email is filled; fill() waits for it.
> 22  |     await this.createPanel.getByRole('textbox', { name: 'Job title' }).fill(contact.jobTitle);
      |                                                                        ^ Error: locator.fill: Target page, context or browser has been closed
  23  |     await this.createPanel.getByRole('button', { name: 'Create', exact: true }).click();
  24  | 
  25  |     await this.page.waitForURL(/\/(contact|record\/0-1)\/\d+/);
  26  |     return this.page.url().match(/\/(?:contact|record\/0-1)\/(\d+)/)![1];
  27  |   }
  28  | 
  29  |   // Edits properties on the record's "All Properties" panel. Labels match
  30  |   // exactly, so "Country/Region" never picks "Country/Region Code"; still, the
  31  |   // spec only edits City, Company name and Job title (QA, 2026-10-08). Each edit saves
  32  |   // on Enter, so HubSpot sends one update event per property.
  33  |   async updateProperties(contactId: string, values: Record<string, string>): Promise<void> {
  34  |     await this.goto(`/contacts/${HUBSPOT_PORTAL_ID}/record/0-1/${contactId}`);
  35  |     await this.page.locator('[data-test-id="card-wrapper-PROPERTIES_V3/0-1/V2"]').getByRole('button', { name: 'Actions', exact: true }).click();
  36  |     await this.page.getByRole('button', { name: 'View all properties' }).click();
  37  | 
  38  |     // Some properties (e.g. City) also show in the Key information card behind
  39  |     // the panel, so stay inside the panel's property groups (no role or name; CSS).
  40  |     const panel = this.page.locator('[data-test-id^="group-accordion-"]');
  41  |     for (const [label, value] of Object.entries(values)) {
  42  |       await this.page.getByRole('searchbox', { name: 'Search property' }).fill(label);
  43  |       await panel.getByRole('button', { name: new RegExp(`^${escape(label)} View property history`) }).click();
  44  |       const input = panel.getByRole('textbox', { name: label, exact: true });
  45  |       await input.fill(value);
  46  |       await input.press('Enter');
  47  |       // Saved once the read-only row shows the new value.
  48  |       await panel.getByRole('button', { name: new RegExp(`^${escape(label)} View property history.* ${escape(value)}$`) }).waitFor();
  49  |     }
  50  |   }
  51  | 
  52  |   // Sets a dropdown property (e.g. "Lifecycle stage") on the "All Properties"
  53  |   // panel. Seen 2026-10-12 (read-only): label casing is the panel's ("Lifecycle
  54  |   // stage", "Lead status"); one click on the row opens the picker; the row
  55  |   // button is then named "<label> <current value>"; options appear twice in
  56  |   // the DOM, so the last match is used.
  57  |   async setDropdownProperty(contactId: string, label: string, value: string): Promise<void> {
  58  |     await this.openAllProperties(contactId);
  59  |     const panel = this.page.locator('[data-test-id^="group-accordion-"]');
  60  |     await this.page.getByRole('searchbox', { name: 'Search property' }).fill(label);
  61  |     await panel.getByRole('button', { name: new RegExp(`^${escape(label)} View property history`) }).click();
  62  |     await this.page.getByRole('option', { name: value, exact: true }).last().click();
  63  |     await panel.getByRole('button', { name: new RegExp(`^${escape(label)}.* ${escape(value)}$`) }).waitFor();
  64  |   }
  65  | 
  66  |   // Finds a contact by email in the contacts list and returns its record id
  67  |   // (search URL and result link seen 2026-10-09).
  68  |   async findContactId(email: string, fullName: string): Promise<string> {
  69  |     await this.goto(`/contacts/${HUBSPOT_PORTAL_ID}/objects/0-1/views/all/list?query=${encodeURIComponent(email)}`);
  70  |     await this.page.getByRole('link', { name: new RegExp(escape(fullName)) }).first().click();
  71  |     await this.page.waitForURL(/\/record\/0-1\/\d+/);
  72  |     return this.page.url().match(/\/record\/0-1\/(\d+)/)![1];
  73  |   }
  74  | 
  75  |   // True when the contacts list search for the email shows the contact. Waits
  76  |   // up to 15 s for the result link, so "false" means it did not appear.
  77  |   async contactExists(email: string, fullName: string): Promise<boolean> {
  78  |     await this.goto(`/contacts/${HUBSPOT_PORTAL_ID}/objects/0-1/views/all/list?query=${encodeURIComponent(email)}`);
  79  |     try {
  80  |       await this.page.getByRole('link', { name: new RegExp(escape(fullName)) }).first().waitFor({ timeout: 15_000 });
  81  |       return true;
  82  |     } catch {
  83  |       return false;
  84  |     }
  85  |   }
  86  | 
  87  |   // Opens the record's "All Properties" panel.
  88  |   async openAllProperties(contactId: string): Promise<void> {
  89  |     await this.goto(`/contacts/${HUBSPOT_PORTAL_ID}/record/0-1/${contactId}`);
  90  |     await this.page.locator('[data-test-id="card-wrapper-PROPERTIES_V3/0-1/V2"]').getByRole('button', { name: 'Actions', exact: true }).click();
  91  |     await this.page.getByRole('button', { name: 'View all properties' }).click();
  92  |   }
  93  | 
  94  |   // The contact's Deals or Companies card (right sidebar, needs a 1280 px
  95  |   // window): the count from its "Deals (n)" heading and each record's id and
  96  |   // name. Seen 2026-10-09.
  97  |   async associations(contactId: string, kind: 'deals' | 'companies'): Promise<{ count: number; records: { id: string; name: string }[] }> {
  98  |     const [typeId, label] = kind === 'deals' ? ['0-3', 'Deals'] : ['0-2', 'Companies'];
  99  |     await this.goto(`/contacts/${HUBSPOT_PORTAL_ID}/record/0-1/${contactId}`);
  100 |     const card = this.page.locator(`[data-test-id="card-wrapper-ASSOCIATION_V3/${typeId}"]`);
  101 |     await card.scrollIntoViewIfNeeded();
  102 |     const heading = card.getByText(new RegExp(`^${label} \\(\\d+\\)$`));
  103 |     await heading.waitFor();
  104 |     const count = Number((await heading.innerText()).match(/\((\d+)\)/)![1]);
  105 |     const links = card.locator(`a[href*="/record/${typeId}/"]`);
  106 |     const records = await links.evaluateAll((as) =>
  107 |       as.map((a) => ({ id: (a.getAttribute('href') ?? '').match(/\/record\/\d+-\d+\/(\d+)/)?.[1] ?? '', name: (a as HTMLElement).innerText.trim() })),
  108 |     );
  109 |     return { count, records };
  110 |   }
  111 | 
  112 |   // In the open panel: the read-only row of a property showing this value
  113 |   // (HubSpot shows "--" for empty).
  114 |   async propertyRow(label: string, value: string) {
  115 |     await this.page.getByRole('searchbox', { name: 'Search property' }).fill(label);
  116 |     return this.page
  117 |       .locator('[data-test-id^="group-accordion-"]')
  118 |       .getByRole('button', { name: new RegExp(`^${escape(label)} View property history.* ${escape(value)}$`) });
  119 |   }
  120 | }
  121 | 
  122 | function escape(text: string): string {
```