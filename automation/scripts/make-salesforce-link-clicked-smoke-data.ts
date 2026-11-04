// Builds test-data/salesforce/link-clicked-smoke.csv for the production smoke of
// notes/production-testing/24-salesforce-link-clicked.md: one named prospect per check that sends (10 rows).
// The Scenario column is "Smoke > <#>" (the check number in the note).
//
// The Salesforce org is never cleaned and shared with the Reply Received smoke, so every run gets new emails
// (Saleshandy refuses an email it has seen, code 1001) and the next person from each row's list (Salesforce
// says "Similar Records Exist" for the same name). Names here differ from the Reply Received and Email Opened smoke names and from the staging Link Clicked names.
//   node scripts/make-salesforce-link-clicked-smoke-data.ts
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, '../test-data/salesforce/link-clicked-smoke.csv');
const RUNS = path.resolve(import.meta.dirname, '../test-data/salesforce/link-clicked-smoke.runs.txt');
const HEADER = ['Scenario', 'First Name', 'Last Name', 'Email', 'Phone Number', 'Job Title', 'Department', 'Industry', 'Experience', 'LinkedIn', 'Twitter', 'Facebook', 'Website', 'Icebreaker', 'City', 'State', 'Country', 'Company', 'Company Website', 'Company Industry', 'Company Founded Year', 'Company LinkedIn', 'Deal Value', 'Note'];

type P = { first: string; last: string; phone: string; title: string; dept: string; city: string; state: string; country: string; company: string; industry: string; site: string; founded: string; deal?: string };
const p = (first: string, last: string, phone: string, title: string, dept: string, city: string, state: string, country: string, company: string, industry: string, site: string, founded: string, deal?: string): P =>
  ({ first, last, phone, title, dept, city, state, country, company, industry, site, founded, deal });

// Three people per check, the run counter picks one.
const PEOPLE: Record<number, P[]> = {
  1: [
    p('Caoimhe', "O'Donnell", '+353 555-0401-1101', 'Revenue Operations Manager', 'Operations', 'Sligo', 'Connacht', 'Ireland', 'Garavogue Freight', 'Logistics', 'garavoguefreight.com', '2010'),
    p('Orla', "O'Connell", '+353 555-0401-1102', 'Director of Revenue Operations', 'Operations', 'Waterford', 'Munster', 'Ireland', 'Suir Cargo', 'Logistics', 'suircargo.com', '2012'),
    p('Sinead', "O'Hara", '+353 555-0401-1103', 'Revenue Operations Lead', 'Operations', 'Kilkenny', 'Leinster', 'Ireland', 'Nore Haulage', 'Logistics', 'norehaulage.com', '2008'),
  ],
  2: [
    p('Linnea', 'Ekstrom', '+46 555-0402-2201', 'Head of Marketing', 'Marketing', 'Lund', 'Skane', 'Sweden', 'Kullen Print Studio', 'Printing', 'kullenprint.com', '2014'),
    p('Maja', 'Lindqvist', '+46 555-0402-2202', 'Marketing Director', 'Marketing', 'Uppsala', 'Uppsala', 'Sweden', 'Fyris Print House', 'Printing', 'fyrisprint.com', '2011'),
    p('Ebba', 'Sandberg', '+46 555-0402-2203', 'Head of Brand', 'Marketing', 'Linkoping', 'Ostergotland', 'Sweden', 'Stangan Print Works', 'Printing', 'stanganprint.com', '2009'),
  ],
  3: [
    p('Magdalena', 'Wojcik', '+48 555-0403-3301', 'Procurement Lead', 'Procurement', 'Bialystok', 'Podlaskie', 'Poland', 'Narew Textiles', 'Textiles', 'narewtextiles.com', '2007'),
    p('Dorota', 'Zielinska', '+48 555-0403-3302', 'Procurement Manager', 'Procurement', 'Gdansk', 'Pomerania', 'Poland', 'Baltic Fabrics', 'Textiles', 'balticfabrics.com', '2013'),
    p('Ewa', 'Kowalczyk', '+48 555-0403-3303', 'Buying Lead', 'Procurement', 'Wroclaw', 'Lower Silesia', 'Poland', 'Odra Weaving Co', 'Textiles', 'odraweaving.com', '2006'),
  ],
  4: [
    p('Tomas', 'Vesely', '+420 555-0404-4401', 'Operations Lead', 'Operations', 'Zlin', 'Zlin', 'Czechia', 'Morava Tooling', 'Manufacturing', 'moravatooling.com', '2005'),
    p('Pavel', 'Horak', '+420 555-0404-4402', 'Plant Operations Lead', 'Operations', 'Opava', 'Moravia-Silesia', 'Czechia', 'Opava Metalworks', 'Manufacturing', 'opavametalworks.com', '2009'),
    p('Jakub', 'Novotny', '+420 555-0404-4403', 'Operations Supervisor', 'Operations', 'Plzen', 'Plzen', 'Czechia', 'Radbuza Machining', 'Manufacturing', 'radbuzamachining.com', '2011'),
  ],
  5: [
    p('Kavya', 'Nair', '+91 555-0405-5501', 'Purchasing Manager', 'Procurement', 'Mangalore', 'Karnataka', 'India', 'Netravati Marine Supplies', 'Marine', 'netravatimarine.com', '2004'),
    p('Lakshmi', 'Pillai', '+91 555-0405-5502', 'Purchasing Lead', 'Procurement', 'Visakhapatnam', 'Andhra Pradesh', 'India', 'Vizag Boat Supplies', 'Marine', 'vizagboat.com', '2008'),
    p('Pooja', 'Krishnan', '+91 555-0405-5503', 'Purchasing Director', 'Procurement', 'Goa', 'Goa', 'India', 'Mandovi Chandlery', 'Marine', 'mandovichandlery.com', '2002'),
  ],
  6: [
    p('Arjun', 'Venkataraman', '+1 555-0406-6601', 'Vice President of Sales', 'Sales', 'Fremont', 'California', 'United States', 'Bayview Software', 'Software', 'bayviewsoftware.com', '2015'),
    p('Karthik', 'Balasubramanian', '+1 555-0406-6602', 'VP Sales', 'Sales', 'San Mateo', 'California', 'United States', 'Peninsula Cloud Systems', 'Software', 'peninsulacloud.com', '2013'),
    p('Nikhil', 'Ramaswamy', '+1 555-0406-6603', 'Sales Vice President', 'Sales', 'Palo Alto', 'California', 'United States', 'Embarcadero Digital', 'Software', 'embarcaderodigital.com', '2017'),
  ],
  7: [
    p('Camille', 'Dubois', '+33 555-0407-7701', 'Chief Operating Officer', 'Operations', 'Bordeaux', 'Nouvelle-Aquitaine', 'France', 'Garonne Vineyards Group', 'Wine', 'garonnevineyards.com', '2001', '12000'),
    p('Chloe', 'Lambert', '+33 555-0407-7702', 'Chief Operating Officer', 'Operations', 'Reims', 'Grand Est', 'France', 'Marne Wine Estates', 'Wine', 'marnewine.com', '2003', '12000'),
    p('Margaux', 'Perrin', '+33 555-0407-7703', 'COO', 'Operations', 'Nimes', 'Occitanie', 'France', 'Gard Trading', 'Wine', 'gardtrading.com', '2000', '12000'),
  ],
  8: [
    p('Javier', 'Navarro', '+34 555-0408-8801', 'Commercial Director', 'Sales', 'Seville', 'Andalusia', 'Spain', 'Guadalquivir Olive Co', 'Food', 'guadalquivirolive.com', '1998'),
    p('Rafael', 'Molina', '+34 555-0408-8802', 'Sales Director', 'Sales', 'Cordoba', 'Andalusia', 'Spain', 'Sierra Aceites', 'Food', 'sierraaceites.com', '2002'),
    p('Diego', 'Herrera', '+34 555-0408-8803', 'Commercial Manager', 'Sales', 'Jaen', 'Andalusia', 'Spain', 'Jaen Olives', 'Food', 'jaenolives.com', '2005'),
  ],
  9: [
    p('Khalid', 'Al-Harthy', '+968 555-0409-9901', 'Marketing Director', 'Marketing', 'Salalah', 'Dhofar', 'Oman', 'Dhofar Dates Trading', 'Food', 'dhofardates.com', '2011'),
    p('Maryam', 'Al-Balushi', '+968 555-0409-9902', 'Head of Marketing', 'Marketing', 'Sohar', 'Al Batinah', 'Oman', 'Sohar Frankincense Co', 'Retail', 'soharfrankincense.com', '2009'),
    p('Noor', 'Al-Hinai', '+968 555-0409-9903', 'Marketing Lead', 'Marketing', 'Ibri', 'Ad Dhahirah', 'Oman', 'Ibri Harvest Foods', 'Food', 'ibriharvest.com', '2014'),
  ],
  10: [
    p('Jun', 'Tan', '+65 555-0410-1001', 'Procurement Manager', 'Procurement', 'Singapore', 'Singapore', 'Singapore', 'Tuas Components', 'Electronics', 'tuascomponents.com', '2010'),
    p('Mei', 'Lim', '+65 555-0410-1002', 'Sourcing Manager', 'Procurement', 'Singapore', 'Singapore', 'Singapore', 'Woodlands Circuit Supply', 'Electronics', 'woodlandscircuit.com', '2012'),
    p('Jia', 'Koh', '+65 555-0410-1003', 'Procurement Lead', 'Procurement', 'Singapore', 'Singapore', 'Singapore', 'Pasir Electronics', 'Electronics', 'pasirelectronics.com', '2008'),
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
