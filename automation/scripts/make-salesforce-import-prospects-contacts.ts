// Makes the 6 Salesforce Contacts for the "Import Prospects from Salesforce" regression (QA 2026-11-13).
// They share Mailing City "Rotterdam" so one custom List View ("Import Prospects QA") can hold exactly them.
// Mailing City is not mapped to any Saleshandy field. Each Contact covers rows of
// test-cases/salesforce/import-prospects.md:
//   1 Anna Van Dyke   full name, Account, Title, Phone, Department   (Add Prospect 1, 2, 6, 7)
//   2 Solo            last name only, valid email                    (Add Prospect 3)
//   3 Jonas Lindqvist no email                                       (Add Prospect 4)
//   4 Priya Raman     Title with a comma                             (Add Prospect 8)
//   5 Marek Novak     empty Department                               (Add Prospect 14)
//   6 Elise Dubois    prospect added by hand first, other Title      (Add Prospect 13, 15)
// Safe to run again: it stops when Contacts with Mailing City Rotterdam already exist. Prints the Ids.
//   node --env-file-if-exists=.env scripts/make-salesforce-import-prospects-contacts.ts
import fs from 'node:fs';
import path from 'node:path';
import { SalesforceApi } from '../src/utils/salesforce-api.ts';

const CITY = 'Rotterdam';
const OUT = path.resolve(import.meta.dirname, '../test-data/salesforce/import-prospects-contacts.txt');

const sf = await SalesforceApi.login();
const existing = await sf.query(`SELECT Id, FirstName, LastName, Email FROM Contact WHERE MailingCity = '${CITY}'`);
if (existing.length > 0) {
  console.log(`Already ${existing.length} Contacts with Mailing City ${CITY}. Nothing made.`);
  console.log(JSON.stringify(existing.map((c) => ({ id: c.Id, name: `${c.FirstName ?? ''} ${c.LastName}`.trim(), email: c.Email }))));
  process.exit(0);
}

// A new tag in every email, so Saleshandy has never seen it.
const tag = Date.now().toString(36);
const email = (name: string) => `${name}.${tag}@mailinator.com`;

const accountId = await sf.createAccount('Noordzee Shipping Supplies', { website: 'noordzeeshipping.example.com', industry: 'Transportation' });
const people = [
  { firstName: 'Anna', lastName: 'Van Dyke', email: email('anna.vandyke'), title: 'Head of Finance Operations', phone: '+31 10 555 0141', department: 'Finance', accountId },
  { lastName: 'Solo', email: email('solo') },
  { firstName: 'Jonas', lastName: 'Lindqvist', title: 'Logistics Coordinator', phone: '+31 10 555 0143', department: 'Operations' },
  { firstName: 'Priya', lastName: 'Raman', email: email('priya.raman'), title: 'SVP, Operations', phone: '+31 10 555 0144', department: 'Operations' },
  { firstName: 'Marek', lastName: 'Novak', email: email('marek.novak'), title: 'Account Executive', phone: '+31 10 555 0145' },
  { firstName: 'Elise', lastName: 'Dubois', email: email('elise.dubois'), title: 'Sales Manager', phone: '+31 10 555 0146', department: 'Sales' },
];

const lines: string[] = [`Made ${new Date().toISOString()} in org, Mailing City ${CITY}, Account ${accountId}`];
for (const p of people) {
  const id = await sf.createContact({ ...p, mailingCity: CITY });
  const line = `${id}\t${p.firstName ?? ''} ${p.lastName}\t${p.email ?? '(no email)'}`.replace(/\t\s/, '\t');
  lines.push(line);
  console.log(line);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, lines.join('\n') + '\n');
console.log(`Saved ${OUT}`);
