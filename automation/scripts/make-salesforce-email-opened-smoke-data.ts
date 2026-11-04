// Builds test-data/salesforce/email-opened-smoke.csv for the production smoke of
// notes/production-testing/23-salesforce-email-opened.md: one named prospect per check that sends (10 rows).
// The Scenario column is "Smoke > <#>" (the check number in the note).
//
// The Salesforce org is never cleaned and shared with the Reply Received smoke, so every run gets new emails
// (Saleshandy refuses an email it has seen, code 1001) and the next person from each row's list (Salesforce
// says "Similar Records Exist" for the same name). Names here differ from the Reply Received smoke names.
//   node scripts/make-salesforce-email-opened-smoke-data.ts
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, '../test-data/salesforce/email-opened-smoke.csv');
const RUNS = path.resolve(import.meta.dirname, '../test-data/salesforce/email-opened-smoke.runs.txt');
const HEADER = ['Scenario', 'First Name', 'Last Name', 'Email', 'Phone Number', 'Job Title', 'Department', 'Industry', 'Experience', 'LinkedIn', 'Twitter', 'Facebook', 'Website', 'Icebreaker', 'City', 'State', 'Country', 'Company', 'Company Website', 'Company Industry', 'Company Founded Year', 'Company LinkedIn', 'Deal Value', 'Note'];

type P = { first: string; last: string; phone: string; title: string; dept: string; city: string; state: string; country: string; company: string; industry: string; site: string; founded: string; deal?: string };
const p = (first: string, last: string, phone: string, title: string, dept: string, city: string, state: string, country: string, company: string, industry: string, site: string, founded: string, deal?: string): P =>
  ({ first, last, phone, title, dept, city, state, country, company, industry, site, founded, deal });

// Three people per check, the run counter picks one.
const PEOPLE: Record<number, P[]> = {
  1: [
    p('Siobhán', "O'Brien", '+353 555-0301-1101', 'Revenue Operations Manager', 'Operations', 'Galway', 'Connacht', 'Ireland', 'Corrib Freight', 'Logistics', 'corribfreight.com', '2010'),
    p('Aoife', "O'Sullivan", '+353 555-0301-1102', 'Director of Revenue Operations', 'Operations', 'Cork', 'Munster', 'Ireland', 'Lee Valley Cargo', 'Logistics', 'leevalleycargo.com', '2012'),
    p('Niamh', "O'Reilly", '+353 555-0301-1103', 'Revenue Operations Lead', 'Operations', 'Limerick', 'Munster', 'Ireland', 'Shannon Haulage', 'Logistics', 'shannonhaulage.com', '2008'),
  ],
  2: [
    p('Elin', 'Bergstrom', '+46 555-0302-2201', 'Head of Marketing', 'Marketing', 'Gothenburg', 'Vastra Gotaland', 'Sweden', 'Skargard Print Studio', 'Printing', 'skargardprint.com', '2014'),
    p('Astrid', 'Nilsson', '+46 555-0302-2202', 'Marketing Director', 'Marketing', 'Vasteras', 'Vastmanland', 'Sweden', 'Malaren Print House', 'Printing', 'malarenprint.com', '2011'),
    p('Sigrid', 'Holm', '+46 555-0302-2203', 'Head of Brand', 'Marketing', 'Orebro', 'Orebro', 'Sweden', 'Hjalmaren Print Works', 'Printing', 'hjalmarenprint.com', '2009'),
  ],
  3: [
    p('Katarzyna', 'Mazur', '+48 555-0303-3301', 'Procurement Lead', 'Procurement', 'Lublin', 'Lublin', 'Poland', 'Bug River Textiles', 'Textiles', 'bugrivertextiles.com', '2007'),
    p('Agnieszka', 'Kaminska', '+48 555-0303-3302', 'Procurement Manager', 'Procurement', 'Katowice', 'Silesia', 'Poland', 'Silesian Fabrics', 'Textiles', 'silesianfabrics.com', '2013'),
    p('Joanna', 'Lewandowska', '+48 555-0303-3303', 'Buying Lead', 'Procurement', 'Poznan', 'Greater Poland', 'Poland', 'Warta Weaving Co', 'Textiles', 'wartaweaving.com', '2006'),
  ],
  4: [
    p('Ondrej', 'Prochazka', '+420 555-0304-4401', 'Operations Lead', 'Operations', 'Olomouc', 'Olomouc', 'Czechia', 'Hana Tooling', 'Manufacturing', 'hanatooling.com', '2005'),
    p('Marek', 'Kral', '+420 555-0304-4402', 'Plant Operations Lead', 'Operations', 'Liberec', 'Liberec', 'Czechia', 'Jizera Metalworks', 'Manufacturing', 'jizerametalworks.com', '2009'),
    p('Lukas', 'Cerny', '+420 555-0304-4403', 'Operations Supervisor', 'Operations', 'Pardubice', 'Pardubice', 'Czechia', 'Elbe Machining', 'Manufacturing', 'elbemachining.com', '2011'),
  ],
  5: [
    p('Meera', 'Iyer', '+91 555-0305-5501', 'Purchasing Manager', 'Procurement', 'Pune', 'Maharashtra', 'India', 'Sahyadri Marine Supplies', 'Marine', 'sahyadrimarine.com', '2004'),
    p('Anjali', 'Menon', '+91 555-0305-5502', 'Purchasing Lead', 'Procurement', 'Kochi', 'Kerala', 'India', 'Malabar Boat Supplies', 'Marine', 'malabarboat.com', '2008'),
    p('Divya', 'Raghavan', '+91 555-0305-5503', 'Purchasing Director', 'Procurement', 'Chennai', 'Tamil Nadu', 'India', 'Coromandel Chandlery', 'Marine', 'coromandelchandlery.com', '2002'),
  ],
  6: [
    p('Rohan', 'Deshpande', '+1 555-0306-6601', 'Vice President of Sales', 'Sales', 'Santa Clara', 'California', 'United States', 'Peninsula Software', 'Software', 'peninsulasoftware.com', '2015'),
    p('Vikram', 'Subramanian', '+1 555-0306-6602', 'VP Sales', 'Sales', 'Sunnyvale', 'California', 'United States', 'Southbay Systems', 'Software', 'southbaysystems.com', '2013'),
    p('Aditya', 'Narayanan', '+1 555-0306-6603', 'Sales Vice President', 'Sales', 'Mountain View', 'California', 'United States', 'Shoreline Digital', 'Software', 'shorelinedigital.com', '2017'),
  ],
  7: [
    p('Elodie', 'Marchand', '+33 555-0307-7701', 'Chief Operating Officer', 'Operations', 'Lyon', 'Auvergne-Rhone-Alpes', 'France', 'Rhone Vineyards Group', 'Wine', 'rhonevineyards.com', '2001', '12000'),
    p('Manon', 'Girard', '+33 555-0307-7702', 'Chief Operating Officer', 'Operations', 'Dijon', 'Bourgogne', 'France', 'Cote Wine Estates', 'Wine', 'cotewine.com', '2003', '12000'),
    p('Lucie', 'Fontaine', '+33 555-0307-7703', 'COO', 'Operations', 'Montpellier', 'Occitanie', 'France', 'Languedoc Trading', 'Wine', 'languedoctrading.com', '2000', '12000'),
  ],
  8: [
    p('Mateo', 'Castillo', '+34 555-0308-8801', 'Commercial Director', 'Sales', 'Valencia', 'Valencia', 'Spain', 'Turia Olive Co', 'Food', 'turiaolive.com', '1998'),
    p('Alvaro', 'Ortega', '+34 555-0308-8802', 'Sales Director', 'Sales', 'Alicante', 'Valencia', 'Spain', 'Costa Blanca Aceites', 'Food', 'costablancaaceites.com', '2002'),
    p('Sergio', 'Vidal', '+34 555-0308-8803', 'Commercial Manager', 'Sales', 'Murcia', 'Murcia', 'Spain', 'Segura Olives', 'Food', 'seguraolives.com', '2005'),
  ],
  9: [
    p('Yusuf', 'Al-Rashdi', '+968 555-0309-9901', 'Marketing Director', 'Marketing', 'Nizwa', 'Ad Dakhiliyah', 'Oman', 'Jabal Dates Trading', 'Food', 'jabaldates.com', '2011'),
    p('Fatma', 'Al-Siyabi', '+968 555-0309-9902', 'Head of Marketing', 'Marketing', 'Sur', 'Ash Sharqiyah', 'Oman', 'Sharqiyah Frankincense Co', 'Retail', 'sharqiyahfrankincense.com', '2009'),
    p('Aisha', 'Al-Kindi', '+968 555-0309-9903', 'Marketing Lead', 'Marketing', 'Rustaq', 'Al Batinah', 'Oman', 'Rustaq Harvest Foods', 'Food', 'rustaqharvest.com', '2014'),
  ],
  10: [
    p('Wei', 'Chen', '+65 555-0310-1001', 'Procurement Manager', 'Procurement', 'Singapore', 'Singapore', 'Singapore', 'Marina Components', 'Electronics', 'marinacomponents.com', '2010'),
    p('Hui', 'Ng', '+65 555-0310-1002', 'Sourcing Manager', 'Procurement', 'Singapore', 'Singapore', 'Singapore', 'Jurong Circuit Supply', 'Electronics', 'jurongcircuit.com', '2012'),
    p('Xin', 'Goh', '+65 555-0310-1003', 'Procurement Lead', 'Procurement', 'Singapore', 'Singapore', 'Singapore', 'Changi Electronics', 'Electronics', 'changielectronics.com', '2008'),
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
  };
  return HEADER.map((h) => cell(row[h] ?? '')).join(',');
});
fs.writeFileSync(OUT, `${[HEADER.join(','), ...lines].join('\n')}\n`);
console.log(`Wrote ${OUT} with ${lines.length} rows (run ${run}).`);
