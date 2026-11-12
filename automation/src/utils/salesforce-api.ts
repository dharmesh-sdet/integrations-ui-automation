import { credentials } from './salesforce-login.ts';

// Salesforce REST API with the SOAP login session (same login as salesforce-login.ts,
// no browser, no code from the trusted exit node). Creates and reads records the way the
// developer's API tests did (integration-skills lead-created-in-salesforce.md:3, "created
// by REST"), so a Salesforce-side row needs no Lightning form. Session id is kept in
// memory only and never printed.
const API = 'v62.0';

export type LeadInput = {
  firstName?: string;
  lastName: string;
  company: string;
  email?: string;
  title?: string;
  phone?: string;
  status?: string;
};

export type ContactInput = {
  firstName?: string;
  lastName: string;
  email?: string;
  title?: string;
  // Salesforce "Business Phone" (API name Phone), the field Contact Properties maps to Phone Number.
  phone?: string;
  department?: string;
  accountId?: string;
};

export class SalesforceApi {
  private readonly instance: string;

  private readonly sid: string;

  private constructor(instance: string, sid: string) {
    this.instance = instance;
    this.sid = sid;
  }

  static async login(): Promise<SalesforceApi> {
    const { username, password } = credentials();
    const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const res = await fetch('https://login.salesforce.com/services/Soap/u/62.0', {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=UTF-8', SOAPAction: 'login' },
      body: `<?xml version="1.0" encoding="utf-8"?><env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><n1:login xmlns:n1="urn:partner.soap.sforce.com"><n1:username>${xml(username)}</n1:username><n1:password>${xml(password)}</n1:password></n1:login></env:Body></env:Envelope>`,
    });
    const body = await res.text();
    const sid = body.match(/<sessionId>([^<]+)/)?.[1];
    const serverUrl = body.match(/<serverUrl>([^<]+)/)?.[1];
    if (!sid || !serverUrl) throw new Error(`Salesforce API login failed: ${body.match(/<faultstring>([^<]+)/)?.[1] ?? `HTTP ${res.status}`}`);
    return new SalesforceApi(new URL(serverUrl).origin, sid);
  }

  private async call(method: string, path: string, data?: unknown, extra: Record<string, string> = {}): Promise<any> {
    const res = await fetch(`${this.instance}/services/data/${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.sid}`, 'Content-Type': 'application/json', ...extra },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : undefined;
    if (!res.ok) throw new Error(`Salesforce ${method} ${path.split('?')[0]} answered ${res.status}: ${JSON.stringify(json)}`);
    return json;
  }

  // Returns the new Lead's Id.
  // allowDuplicate saves the Lead although Salesforce's duplicate rule matches an earlier one.
  async createLead(l: LeadInput, allowDuplicate = false): Promise<string> {
    const r = await this.call('POST', '/sobjects/Lead', {
      FirstName: l.firstName,
      LastName: l.lastName,
      Company: l.company,
      Email: l.email,
      Title: l.title,
      Phone: l.phone,
      Status: l.status ?? 'Open - Not Contacted',
    }, allowDuplicate ? { 'Sforce-Duplicate-Rule-Header': 'allowSave=true' } : {});
    return r.id;
  }

  // Returns the new Contact's Id. Duplicates are always allowed: a row makes a second
  // Contact with the same email on purpose (existing-prospect rows), and test people repeat
  // their names from one run to the next.
  async createContact(c: ContactInput): Promise<string> {
    const r = await this.call('POST', '/sobjects/Contact', {
      FirstName: c.firstName,
      LastName: c.lastName,
      Email: c.email,
      Title: c.title,
      Phone: c.phone,
      Department: c.department,
      AccountId: c.accountId,
    }, { 'Sforce-Duplicate-Rule-Header': 'allowSave=true' });
    return r.id;
  }

  // Deletes a Contact by Id (a row deletes only a Contact it created itself a moment before).
  async deleteContact(id: string): Promise<void> {
    await this.call('DELETE', `/sobjects/Contact/${id}`);
  }

  async createAccount(name: string, extra: { website?: string; phone?: string; industry?: string } = {}): Promise<string> {
    const r = await this.call('POST', '/sobjects/Account', { Name: name, Website: extra.website, Phone: extra.phone, Industry: extra.industry }, { 'Sforce-Duplicate-Rule-Header': 'allowSave=true' });
    return r.id;
  }

  // Returns the new Opportunity's Id. Each contact in `contactIds` becomes a contact role, the first one
  // primary: the Opportunity workflow imports an Opportunity's contact roles, not the Opportunity itself
  // (integration-skills opportunity-created-in-salesforce.md, v2). No contact = nothing to import.
  async createOpportunity(o: { name: string; stage?: string; closeDate: string; amount?: number; contactIds?: string[] }): Promise<string> {
    const r = await this.call('POST', '/sobjects/Opportunity', {
      Name: o.name,
      StageName: o.stage ?? 'Prospecting',
      CloseDate: o.closeDate,
      Amount: o.amount,
    });
    for (const [i, contactId] of (o.contactIds ?? []).entries()) {
      await this.call('POST', '/sobjects/OpportunityContactRole', { OpportunityId: r.id, ContactId: contactId, IsPrimary: i === 0 });
    }
    return r.id;
  }

  async query(soql: string): Promise<any[]> {
    return (await this.call('GET', `/query?q=${encodeURIComponent(soql)}`)).records;
  }
}
