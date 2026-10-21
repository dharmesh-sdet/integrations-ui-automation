import type { Row } from '../../data/csv.ts';
import type { SalesforceAccountsPage } from './accounts.page.ts';
import type { SalesforceContactsPage } from './contacts.page.ts';
import type { SalesforceLeadsPage } from './leads.page.ts';
import type { SalesforceOpportunitiesPage } from './opportunities.page.ts';

// Records a scenario needs in Salesforce before the reply. Every record is made
// from the prospect's own row (same email, same company), with values that differ
// from the prospect's so a change by the workflow is visible.
export type Setup = {
  lead?: { status?: string };
  contact?: boolean;
  account?: boolean;
  opportunity?: { stage: string };
};

// Values the setup records start with (they differ from every generated prospect).
export const LEGACY = { company: 'Pilot Legacy Co', title: 'Legacy Title QA', phone: '+1 555-0100-0000', city: 'Legacy City', department: 'Legacy Dept' };

export type Counts = { leads: number; contacts: number; accounts: number; opportunities: number };

// M/D/YYYY, the way the org's date inputs read.
export function inDays(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

// One door to the four Salesforce objects the integration writes to. A spec talks
// to this class and never to a Lightning page: when a locator changes, only the
// object page changes. Adding an object (Task, Case, ...) means one more page and
// one more line in `seed` and `counts`.
export class Salesforce {
  readonly leads: SalesforceLeadsPage;
  readonly contacts: SalesforceContactsPage;
  readonly accounts: SalesforceAccountsPage;
  readonly opportunities: SalesforceOpportunitiesPage;

  constructor(
    leads: SalesforceLeadsPage,
    contacts: SalesforceContactsPage,
    accounts: SalesforceAccountsPage,
    opportunities: SalesforceOpportunitiesPage,
  ) {
    this.leads = leads;
    this.contacts = contacts;
    this.accounts = accounts;
    this.opportunities = opportunities;
  }

  async seed(setup: Setup, row: Row): Promise<void> {
    const person = { firstName: row['First Name'], lastName: row['Last Name'], email: row['Email'] };
    if (setup.lead) await this.leads.createLead({ ...person, company: LEGACY.company, title: LEGACY.title, phone: LEGACY.phone, status: setup.lead.status });
    if (setup.contact) await this.contacts.createContact({ ...person, phone: LEGACY.phone, department: LEGACY.department });
    if (setup.account) await this.accounts.createAccount({ name: row['Company'], billingCity: LEGACY.city });
    if (setup.opportunity) {
      await this.opportunities.createOpportunity({
        name: `${person.firstName} ${person.lastName}`,
        stage: setup.opportunity.stage,
        closeDate: inDays(30),
      });
    }
  }

  // How many records of each object the prospect has (by email, or by company for
  // Accounts and by full name for Opportunities). Each look loads its list fresh.
  async counts(row: Row): Promise<Counts> {
    return {
      leads: await this.leads.countByEmail(row['Email']),
      contacts: await this.contacts.countByEmail(row['Email']),
      accounts: row['Company'] ? await this.accounts.countByName(row['Company']) : 0,
      opportunities: await this.opportunities.countByName(`${row['First Name']} ${row['Last Name']}`),
    };
  }
}
