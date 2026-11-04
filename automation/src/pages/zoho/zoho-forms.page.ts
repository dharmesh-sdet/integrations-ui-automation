import type { Page } from 'playwright';
import { ZOHO_ORG, type ZohoCrmPage } from './zoho-crm.page.ts';

// Records an Email Sent row needs in Zoho before the email goes out (QA: made by hand with unique names).
// Account has `ZohoCrmPage.createAccount`, which another session owns; Contact, Lead and Deal are here.
// Field ids are the ones the create forms showed on 2026-10-29 (Crm_<Module>_<FIELD>_LInput).
// The lookup picker, the Stage list and the Lead Company box were confirmed on 2026-10-31.
export class ZohoForms {
  private readonly page: Page;
  private readonly crm: ZohoCrmPage;

  constructor(crm: ZohoCrmPage) {
    this.crm = crm;
    this.page = crm.page;
  }

  async createContact(c: { first: string; last: string; email: string; phone?: string; title?: string; account?: string }): Promise<string> {
    await this.openForm('Contacts', 'Create Contact', '#Crm_Contacts_LASTNAME_LInput');
    await this.page.locator('#Crm_Contacts_FIRSTNAME_LInput').fill(c.first);
    await this.page.locator('#Crm_Contacts_LASTNAME_LInput').fill(c.last);
    await this.page.locator('#Crm_Contacts_EMAIL_LInput').fill(c.email);
    if (c.phone) await this.page.locator('#Crm_Contacts_PHONE_LInput').fill(c.phone);
    if (c.title) await this.page.locator('#Crm_Contacts_TITLE_LInput').fill(c.title);
    if (c.account) await this.pickLookup('#Crm_Contacts_ACCOUNTID', c.account);
    return this.save('Contacts');
  }

  async createLead(l: { first: string; last: string; email: string; company: string }): Promise<string> {
    await this.openForm('Leads', 'Create Lead', '#Crm_Leads_LASTNAME_LInput');
    await this.page.locator('#Crm_Leads_FIRSTNAME_LInput').fill(l.first);
    await this.page.locator('#Crm_Leads_LASTNAME_LInput').fill(l.last);
    await this.page.locator('#Crm_Leads_EMAIL_LInput').fill(l.email);
    // The Company box has the id "inputId" on this form (confirmed 2026-10-31, the only visible one).
    await this.page.locator('input#inputId:visible').first().fill(l.company);
    return this.save('Leads');
  }

  // closing is dd/mm/yyyy. The stage list opens from the box that shows the default "Qualification".
  async createDeal(d: { name: string; closing: string; contact?: string; stage?: string; amount?: string; account?: string }): Promise<string> {
    // Account Name is required on the Deal form ("Account Name cannot be empty", 2026-10-31): make one when the row gives none.
    const account = d.account ?? `Deal Account ${Date.now()}`;
    if (!d.account) await this.crm.createAccount(account);
    await this.openForm('Potentials', 'Create Deal', '#Crm_Potentials_POTENTIALNAME_LInput');
    await this.page.locator('#Crm_Potentials_POTENTIALNAME_LInput').fill(d.name);
    await this.page.locator('#Crm_Potentials_CLOSINGDATE_LInput').fill(d.closing);
    if (d.amount) await this.page.locator('#Crm_Potentials_AMOUNT_LInput').fill(d.amount);
    await this.pickLookup('#Crm_Potentials_ACCOUNTID', account);
    if (d.contact) await this.pickLookup('#Crm_Potentials_CONTACTID', d.contact);
    if (d.stage) {
      // Stage is a pick list; its options are <lyte-drop-item role="option"> (confirmed 2026-10-31).
      await this.page.getByText('Qualification', { exact: true }).first().click();
      await this.page.locator('lyte-drop-item[role="option"]').filter({ hasText: new RegExp(`^\\s*${d.stage}\\s*$`) }).first().click();
    }
    return this.save('Potentials');
  }

  private async openForm(tab: string, button: string, firstField: string): Promise<void> {
    await this.crm.open(`${ZOHO_ORG}/tab/${tab}`);
    const create = this.page.getByRole('button', { name: button }).first();
    await create.waitFor({ timeout: 60_000 });
    await this.page.waitForTimeout(4_000);
    await create.click();
    await this.page.locator(firstField).waitFor({ timeout: 30_000 });
  }

  // Types the record's name in a lookup box and picks the matching entry of the list that opens.
  private async pickLookup(input: string, text: string): Promise<void> {
    // A record made seconds before (the account of a new deal) is not in the lookup list at once: the Zoho search lags
    // (2026-11-03, Deal 2 and 3: the account existed in Zoho but the option never showed). Retype after a pause, up to 8 times (2026-11-04 production smoke: 4 tries were not enough).
    const option = this.page.locator('lyte-drop-item[role="option"]').filter({ hasText: text }).first();
    for (let attempt = 1; ; attempt++) {
      await this.page.locator(input).click();
      await this.page.locator(input).fill('');
      await this.page.locator(input).pressSequentially(text, { delay: 40 });
      // Options are <lyte-drop-item role="option"> (confirmed 2026-10-31); the label has a trailing space.
      const shown = await option.waitFor({ state: 'visible', timeout: 12_000 }).then(() => true, () => false);
      if (shown) break;
      if (attempt === 8) throw new Error(`"${text}" never showed in the lookup list after ${attempt} tries`);
      await this.page.waitForTimeout(20_000);
    }
    await option.click({ timeout: 20_000 });
  }

  private async save(tab: string): Promise<string> {
    await this.page.getByRole('button', { name: 'Save', exact: true }).first().click();
    await this.page.waitForURL(new RegExp(`/tab/${tab}/\\d{8,}`), { timeout: 30_000 });
    return this.page.url().match(new RegExp(`/tab/${tab}/(\\d+)`))![1];
  }
}
