// Builds test-data/salesforce/prospect-unsubscribed-smoke.csv for the production smoke of
// notes/production-testing/26-salesforce-prospect-unsubscribed.md: one named prospect per check that unsubscribes
// (8 rows). The Scenario column is "Smoke > <#>" (the check number in the note). Check 9 needs no prospect.
//
// The Salesforce org is never cleaned and shared with the other smoke runs, so every run gets new emails
// (Saleshandy refuses an email it has seen, code 1001) and the next person from each row's list (Salesforce says
// "Similar Records Exist" for the same name, and Create a Account finds an Account by full name and creates
// nothing). Names here differ from the other Salesforce smoke names and from the staging Prospect Unsubscribed names.
//   node scripts/make-salesforce-prospect-unsubscribed-smoke-data.ts
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, '../test-data/salesforce/prospect-unsubscribed-smoke.csv');
const RUNS = path.resolve(import.meta.dirname, '../test-data/salesforce/prospect-unsubscribed-smoke.runs.txt');
const HEADER = ['Scenario', 'First Name', 'Last Name', 'Email', 'Phone Number', 'Job Title', 'Department', 'Industry', 'Experience', 'LinkedIn', 'Twitter', 'Facebook', 'Website', 'Icebreaker', 'City', 'State', 'Country', 'Company', 'Company Website', 'Company Industry', 'Company Founded Year', 'Company LinkedIn', 'Deal Value', 'Note'];

type P = { first: string; last: string; phone: string; title: string; dept: string; city: string; state: string; country: string; company: string; industry: string; site: string; founded: string; deal?: string };
const p = (first: string, last: string, phone: string, title: string, dept: string, city: string, state: string, country: string, company: string, industry: string, site: string, founded: string, deal?: string): P =>
  ({ first, last, phone, title, dept, city, state, country, company, industry, site, founded, deal });

// Three people per check, the run counter picks one.
const PEOPLE: Record<number, P[]> = {
  // 1: baseline, apostrophe in the last name.
  1: [
    p('Siobhán', "O'Brien", '+353 555-0601-1101', 'Revenue Operations Manager', 'Operations', 'Galway', 'Connacht', 'Ireland', 'Corrib Freight', 'Logistics', 'corribfreight.com', '2010'),
    p('Caoimhe', "O'Donnell", '+353 555-0601-1102', 'Director of Revenue Operations', 'Operations', 'Sligo', 'Connacht', 'Ireland', 'Garavogue Cargo', 'Logistics', 'garavoguecargo.com', '2012'),
    p('Niamh', "O'Connor", '+353 555-0601-1103', 'Revenue Operations Lead', 'Operations', 'Ennis', 'Munster', 'Ireland', 'Fergus Haulage', 'Logistics', 'fergushaulage.com', '2008'),
  ],
  2: [
    p('Kasper', 'Lindqvist', '+46 555-0602-2201', 'Head of Growth', 'Marketing', 'Uppsala', 'Uppsala', 'Sweden', 'Fyris Signage', 'Printing', 'fyrissignage.com', '2014'),
    p('Linnea', 'Bergstrom', '+46 555-0602-2202', 'Growth Director', 'Marketing', 'Lund', 'Skane', 'Sweden', 'Kulturen Print Lab', 'Printing', 'kulturenprint.com', '2011'),
    p('Freja', 'Ekstrom', '+46 555-0602-2203', 'Head of Demand Generation', 'Marketing', 'Umea', 'Vasterbotten', 'Sweden', 'Ume River Press', 'Printing', 'umeriverpress.com', '2009'),
  ],
  3: [
    p('Dragana', 'Petrovic', '+381 555-0603-3301', 'Sourcing Lead', 'Procurement', 'Novi Sad', 'Vojvodina', 'Serbia', 'Dunav Fabrics', 'Textiles', 'dunavfabrics.com', '2007'),
    p('Milica', 'Jovanovic', '+381 555-0603-3302', 'Sourcing Manager', 'Procurement', 'Nis', 'Nisava', 'Serbia', 'Nisava Weaving', 'Textiles', 'nisavaweaving.com', '2013'),
    p('Jelena', 'Nikolic', '+381 555-0603-3303', 'Buying Manager', 'Procurement', 'Kragujevac', 'Sumadija', 'Serbia', 'Lepenica Textiles', 'Textiles', 'lepenicatextiles.com', '2006'),
  ],
  4: [
    p('Tomasz', 'Wisniewski', '+48 555-0604-4401', 'Plant Manager', 'Operations', 'Gdansk', 'Pomerania', 'Poland', 'Motlawa Tooling', 'Manufacturing', 'motlawatooling.com', '2005'),
    p('Piotr', 'Zielinski', '+48 555-0604-4402', 'Production Lead', 'Operations', 'Wroclaw', 'Lower Silesia', 'Poland', 'Odra Metalworks', 'Manufacturing', 'odrametalworks.com', '2009'),
    p('Marek', 'Kaminski', '+48 555-0604-4403', 'Operations Supervisor', 'Operations', 'Lublin', 'Lublin', 'Poland', 'Bystrzyca Machining', 'Manufacturing', 'bystrzycamachining.com', '2011'),
  ],
  5: [
    p('Folasade', 'Adeyemi', '+234 555-0605-5501', 'Procurement Manager', 'Procurement', 'Ibadan', 'Oyo', 'Nigeria', 'Oyo Cocoa Traders', 'Food', 'oyococoa.com', '2004'),
    p('Chiamaka', 'Nwosu', '+234 555-0605-5502', 'Procurement Lead', 'Procurement', 'Enugu', 'Enugu', 'Nigeria', 'Coal City Grains', 'Food', 'coalcitygrains.com', '2008'),
    p('Ngozi', 'Eze', '+234 555-0605-5503', 'Procurement Director', 'Procurement', 'Abeokuta', 'Ogun', 'Nigeria', 'Ogun Palm Exports', 'Food', 'ogunpalm.com', '2002'),
  ],
  6: [
    p('Rangi', 'Parata', '+64 555-0606-6601', 'Head of Sales', 'Sales', 'Hamilton', 'Waikato', 'New Zealand', 'Waikato Software', 'Software', 'waikatosoftware.com', '2015'),
    p('Aroha', 'Tamihana', '+64 555-0606-6602', 'Sales Director', 'Sales', 'Napier', 'Hawkes Bay', 'New Zealand', 'Ahuriri Cloud', 'Software', 'ahuriricloud.com', '2013'),
    p('Maia', 'Ngata', '+64 555-0606-6603', 'VP of Sales', 'Sales', 'Dunedin', 'Otago', 'New Zealand', 'Otago Digital', 'Software', 'otagodigital.com', '2017'),
  ],
  7: [
    p('Beatriz', 'Carvalho', '+351 555-0607-7701', 'Chief Operating Officer', 'Operations', 'Porto', 'Norte', 'Portugal', 'Douro Wine Group', 'Wine', 'dourowinegroup.com', '2001', '12000'),
    p('Ines', 'Monteiro', '+351 555-0607-7702', 'Chief Operating Officer', 'Operations', 'Braga', 'Norte', 'Portugal', 'Minho Vineyards Trading', 'Wine', 'minhovineyards.com', '2003', '12000'),
    p('Sofia', 'Almeida', '+351 555-0607-7703', 'COO', 'Operations', 'Evora', 'Alentejo', 'Portugal', 'Alentejo Cellars', 'Wine', 'alentejocellars.com', '2000', '12000'),
  ],
  8: [
    p('Anders', 'Nygaard', '+45 555-0608-8801', 'Commercial Director', 'Sales', 'Aarhus', 'Central Jutland', 'Denmark', 'Aarhus Timber Co', 'Forestry', 'aarhustimber.com', '1998'),
    p('Mads', 'Kristensen', '+45 555-0608-8802', 'Sales Director', 'Sales', 'Odense', 'Funen', 'Denmark', 'Odense Wood Products', 'Forestry', 'odensewood.com', '2002'),
    p('Lars', 'Pedersen', '+45 555-0608-8803', 'Commercial Manager', 'Sales', 'Aalborg', 'North Jutland', 'Denmark', 'Limfjord Sawmill', 'Forestry', 'limfjordsawmill.com', '2005'),
  ],
};

const cell = (v = '') => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const plain = (s: string) => s.normalize('NFKD').replace(/[^A-Za-z]/g, '').toLowerCase();
const tag = () => Math.floor(Date.now() / 1000).toString(36).slice(-5);

const run = (fs.existsSync(RUNS) ? Number(fs.readFileSync(RUNS, 'utf8').trim()) || 0 : 0) + 1;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(RUNS, `${run}\n`);

const emailTag = tag();
const lines = Object.entries(PEOPLE).map(([n, list]) => {
  const x = list[(run - 1) % list.length];
  const email = `${plain(x.first)}.${plain(x.last)}.${emailTag}@mailinator.com`;
  const row: Record<string, string> = {
    Scenario: `Smoke > ${n}`, 'First Name': x.first, 'Last Name': x.last, Email: email, 'Phone Number': x.phone, 'Job Title': x.title,
    Department: x.dept, Industry: x.industry, City: x.city, State: x.state, Country: x.country, Company: x.company,
    'Company Website': `https://www.${x.site}`, Website: `https://www.${x.site}`, 'Company Industry': x.industry, 'Company Founded Year': x.founded, 'Deal Value': x.deal ?? '',
    Note: '',
  };
  return HEADER.map((h) => cell(row[h] ?? '')).join(',');
});
fs.writeFileSync(OUT, `${[HEADER.join(','), ...lines].join('\n')}\n`);
console.log(`Wrote ${OUT} with ${lines.length} rows (run ${run}).`);
