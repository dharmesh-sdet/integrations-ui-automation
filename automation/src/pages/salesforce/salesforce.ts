import type { Row } from '../../data/csv.ts';
import type { SalesforceAccountsPage } from './accounts.page.ts';
import type { SalesforceContactsPage } from './contacts.page.ts';
import type { SalesforceLeadsPage } from './leads.page.ts';
import type { SalesforceOpportunitiesPage } from './opportunities.page.ts';

// Records a scenario needs in Salesforce before the reply. Every record is made
// from the prospect's own row (same email, same company), with values that differ
// from the prospect's so a change by the workflow is visible.
export type Setup = {
  // title, phone and company are the old values the workflow must replace; the defaults are LEGACY.
  lead?: { status?: string; title?: string; phone?: string; company?: string };
  contact?: boolean | { phone?: string; department?: string; title?: string };
  // name: 'fullName' names the Account like the prospect (Update a Account finds it that way).
  account?: boolean | { name?: 'fullName' | 'company'; city?: string };
  opportunity?: { stage: string };
  // Opportunities named with the prospect's email, oldest first. closeInDays is from today.
  opportunities?: { stage: string; closeInDays: number }[];
};

// Values the setup records start with (they differ from every generated prospect).
export const LEGACY = { company: 'Pilot Legacy Co', title: 'Legacy Title QA', phone: '+1 555-0100-0000', city: 'Legacy City', department: 'Legacy Dept' };

// The org shows dates as DD/MM/YYYY (context/salesforce/00-overview.md).
export function inDaysOrg(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// True when `shown` is the date `days` from today, in either day-first or month-first form. One day
// either way is allowed, because the org and this machine can be in different time zones.
export function dayIs(shown: string, days: number): boolean {
  const clean = shown.replace(/\s/g, '');
  return [days - 1, days, days + 1].some((offset) => {
    const d = new Date(Date.now() + offset * 86_400_000);
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const y = d.getFullYear();
    const pad = (n: number) => String(n).padStart(2, '0');
    return [`${day}/${m}/${y}`, `${m}/${day}/${y}`, `${pad(day)}/${pad(m)}/${y}`, `${pad(m)}/${pad(day)}/${y}`].includes(clean);
  });
}

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
    const fullName = `${person.firstName} ${person.lastName}`;
    if (setup.lead) {
      const l = setup.lead;
      await this.leads.createLead({ ...person, company: l.company ?? LEGACY.company, title: l.title ?? LEGACY.title, phone: l.phone ?? LEGACY.phone, status: l.status });
    }
    if (setup.contact) {
      const c = setup.contact === true ? {} : setup.contact;
      await this.contacts.createContact({ ...person, phone: c.phone ?? LEGACY.phone, department: c.department ?? LEGACY.department, title: c.title });
    }
    if (setup.account) {
      const a = setup.account === true ? {} : setup.account;
      await this.accounts.createAccount({ name: a.name === 'fullName' ? fullName : row['Company'], billingCity: a.city ?? LEGACY.city });
    }
    if (setup.opportunity) {
      await this.opportunities.createOpportunity({ name: fullName, stage: setup.opportunity.stage, closeDate: inDays(30) });
    }
    for (const o of setup.opportunities ?? []) {
      await this.opportunities.createOpportunity({ name: person.email, stage: o.stage, closeDate: inDaysOrg(o.closeInDays) });
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
