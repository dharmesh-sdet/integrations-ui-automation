// Builds test-data/salesforce/reply-received-smoke.csv for the production smoke of
// notes/production-testing/22-salesforce-reply-received.md: one named prospect per check (10 rows).
// The Scenario column is the staging row id the check is built from ("<activity> > 1").
//
// The Salesforce org is never cleaned and the staging runs already used the staging names, so the smoke
// uses its own people. Every run gets new emails (Saleshandy refuses an email it has seen, code 1001)
// and the next person from each row's list (Salesforce says "Similar Records Exist" for the same name).
//   node scripts/make-salesforce-reply-received-smoke-data.ts
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, '../test-data/salesforce/reply-received-smoke.csv');
const RUNS = path.resolve(import.meta.dirname, '../test-data/salesforce/reply-received-smoke.runs.txt');
const HEADER = ['Scenario', 'First Name', 'Last Name', 'Email', 'Phone Number', 'Job Title', 'Department', 'Industry', 'City', 'State', 'Country', 'Company', 'Company Website', 'Company Industry', 'Company Founded Year', 'Deal Value'];

const CL = 'Create a Lead in Salesforce';
const UL = 'Update a Lead in Salesforce';
const CC = 'Create a Contact in Salesforce';
const UC = 'Update a Contact in Salesforce';
const CA = 'Create a Account in Salesforce';
const UA = 'Update a Account in Salesforce';
const CO = 'Create a Opportunity in Salesforce';
const UO = 'Update a Opportunity in Salesforce';
const AN = 'Attach Note in Salesforce';
const RE = 'Record(log) an Email Activity in Salesforce';

type P = { first: string; last: string; phone: string; title: string; dept: string; city: string; state: string; country: string; company: string; industry: string; site: string; founded: string; deal?: string };

const p = (first: string, last: string, phone: string, title: string, dept: string, city: string, state: string, country: string, company: string, industry: string, site: string, founded: string, deal?: string): P =>
  ({ first, last, phone, title, dept, city, state, country, company, industry, site, founded, deal });

// Three people per row, one is used per run (the run counter picks it).
const PEOPLE: Record<string, P[]> = {
  [`${CL} > 1`]: [
    p('André', "D'Angelo", '+1 555-0201-1101', 'Revenue Operations Manager', 'Operations', 'Austin', 'Texas', 'United States', 'Harborview Logistics', 'Logistics', 'harborviewlogistics.com', '2009'),
    p('Renée', "O'Connell", '+1 555-0201-1102', 'Director of Revenue Operations', 'Operations', 'Dallas', 'Texas', 'United States', 'Ridgeline Freight', 'Logistics', 'ridgelinefreight.com', '2011'),
    p('Zoë', "D'Souza", '+1 555-0201-1103', 'Revenue Operations Lead', 'Operations', 'Houston', 'Texas', 'United States', 'Bayou Cargo Group', 'Logistics', 'bayoucargogroup.com', '2013'),
  ],
  [`${UL} > 1`]: [
    p('Greta', 'Lindholm', '+46 555-0202-2201', 'Head of Marketing', 'Marketing', 'Malmo', 'Skane', 'Sweden', 'Nordhamn Print Studio', 'Printing', 'nordhamnprint.com', '2015'),
    p('Freya', 'Eriksson', '+46 555-0202-2202', 'Marketing Director', 'Marketing', 'Uppsala', 'Uppsala', 'Sweden', 'Solvik Print House', 'Printing', 'solvikprint.com', '2012'),
    p('Ingrid', 'Sandberg', '+46 555-0202-2203', 'Head of Brand', 'Marketing', 'Lund', 'Skane', 'Sweden', 'Kullen Print Works', 'Printing', 'kullenprint.com', '2010'),
  ],
  [`${CC} > 1`]: [
    p('Marta', 'Kowalczyk', '+48 555-0203-3301', 'Procurement Lead', 'Procurement', 'Krakow', 'Lesser Poland', 'Poland', 'Vistula Textiles', 'Textiles', 'vistulatextiles.com', '2008'),
    p('Anna', 'Wisniewska', '+48 555-0203-3302', 'Procurement Manager', 'Procurement', 'Gdansk', 'Pomerania', 'Poland', 'Baltic Fabrics', 'Textiles', 'balticfabrics.com', '2014'),
    p('Ewa', 'Zielinska', '+48 555-0203-3303', 'Buying Lead', 'Procurement', 'Wroclaw', 'Lower Silesia', 'Poland', 'Oder Weaving Co', 'Textiles', 'oderweaving.com', '2007'),
  ],
  [`${UC} > 1`]: [
    p('Tomas', 'Novak', '+420 555-0204-4401', 'Operations Lead', 'Operations', 'Brno', 'South Moravia', 'Czechia', 'Moravia Tooling', 'Manufacturing', 'moraviatooling.com', '2006'),
    p('Pavel', 'Dvorak', '+420 555-0204-4402', 'Plant Operations Lead', 'Operations', 'Ostrava', 'Moravia-Silesia', 'Czechia', 'Silesia Metalworks', 'Manufacturing', 'silesiametalworks.com', '2010'),
    p('Jan', 'Svoboda', '+420 555-0204-4403', 'Operations Supervisor', 'Operations', 'Plzen', 'Plzen', 'Czechia', 'Radbuza Machining', 'Manufacturing', 'radbuzamachining.com', '2012'),
  ],
  [`${CA} > 1`]: [
    p('Helena', 'Marchetti', '+39 555-0205-5501', 'Purchasing Manager', 'Procurement', 'Turin', 'Piedmont', 'Italy', 'Alpina Marine Supplies', 'Marine', 'alpinamarine.com', '2005'),
    p('Chiara', 'Bianchi', '+39 555-0205-5502', 'Purchasing Lead', 'Procurement', 'Genoa', 'Liguria', 'Italy', 'Ligure Boat Supplies', 'Marine', 'ligureboat.com', '2009'),
    p('Silvia', 'Romano', '+39 555-0205-5503', 'Purchasing Director', 'Procurement', 'Trieste', 'Friuli', 'Italy', 'Adriatica Chandlery', 'Marine', 'adriaticachandlery.com', '2003'),
  ],
  [`${UA} > 1`]: [
    p('Nikhil', 'Chandrasekaran', '+1 555-0206-6601', 'Vice President of Sales', 'Sales', 'San Jose', 'California', 'United States', 'Bayline Software', 'Software', 'baylinesoftware.com', '2016'),
    p('Arjun', 'Balakrishnan', '+1 555-0206-6602', 'VP Sales', 'Sales', 'Fremont', 'California', 'United States', 'Eastbay Systems', 'Software', 'eastbaysystems.com', '2014'),
    p('Karthik', 'Venkatesan', '+1 555-0206-6603', 'Sales Vice President', 'Sales', 'Oakland', 'California', 'United States', 'Lakemerritt Digital', 'Software', 'lakemerrittdigital.com', '2018'),
  ],
  [`${CO} > 1`]: [
    p('Camille', 'Laurent', '+33 555-0207-7701', 'Chief Operating Officer', 'Operations', 'Nantes', 'Pays de la Loire', 'France', 'Loire Vineyards Group', 'Wine', 'loirevineyards.com', '2002', '12000'),
    p('Sophie', 'Dubois', '+33 555-0207-7702', 'Chief Operating Officer', 'Operations', 'Bordeaux', 'Nouvelle-Aquitaine', 'France', 'Garonne Wine Estates', 'Wine', 'garonnewine.com', '2004', '12000'),
    p('Margaux', 'Petit', '+33 555-0207-7703', 'COO', 'Operations', 'Reims', 'Grand Est', 'France', 'Champagne Route Trading', 'Wine', 'champagneroute.com', '2001', '12000'),
  ],
  [`${UO} > 1`]: [
    p('Diego', 'Navarro', '+34 555-0208-8801', 'Commercial Director', 'Sales', 'Seville', 'Andalusia', 'Spain', 'Guadalquivir Olive Co', 'Food', 'guadalquivirolive.com', '1999'),
    p('Pablo', 'Herrera', '+34 555-0208-8802', 'Sales Director', 'Sales', 'Malaga', 'Andalusia', 'Spain', 'Costa Aceites', 'Food', 'costaaceites.com', '2003'),
    p('Javier', 'Molina', '+34 555-0208-8803', 'Commercial Manager', 'Sales', 'Granada', 'Andalusia', 'Spain', 'Sierra Nevada Olives', 'Food', 'sierranevadaolives.com', '2006'),
  ],
  [`${AN} > 1`]: [
    p('Noor', 'Al-Farsi', '+968 555-0209-9901', 'Marketing Director', 'Marketing', 'Muscat', 'Muscat', 'Oman', 'Gulf Dates Trading', 'Food', 'gulfdatestrading.com', '2012'),
    p('Layla', 'Al-Harthy', '+968 555-0209-9902', 'Head of Marketing', 'Marketing', 'Salalah', 'Dhofar', 'Oman', 'Dhofar Frankincense Co', 'Retail', 'dhofarfrankincense.com', '2010'),
    p('Mariam', 'Al-Balushi', '+968 555-0209-9903', 'Marketing Lead', 'Marketing', 'Sohar', 'Al Batinah', 'Oman', 'Batinah Harvest Foods', 'Food', 'batinahharvest.com', '2015'),
  ],
  [`${RE} > 1`]: [
    p('Lin', 'Zhao', '+65 555-0210-1001', 'Procurement Manager', 'Procurement', 'Singapore', 'Singapore', 'Singapore', 'Merlion Components', 'Electronics', 'merlioncomponents.com', '2011'),
    p('Mei', 'Tan', '+65 555-0210-1002', 'Sourcing Manager', 'Procurement', 'Singapore', 'Singapore', 'Singapore', 'Raffles Circuit Supply', 'Electronics', 'rafflescircuit.com', '2013'),
    p('Jia', 'Lim', '+65 555-0210-1003', 'Procurement Lead', 'Procurement', 'Singapore', 'Singapore', 'Singapore', 'Sentosa Electronics', 'Electronics', 'sentosaelectronics.com', '2009'),
  ],
};

const cell = (v = '') => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const plain = (s: string) => s.normalize('NFKD').replace(/[^A-Za-z]/g, '').toLowerCase();
const tag = () => Math.floor(Date.now() / 1000).toString(36).slice(-5);

const run = (fs.existsSync(RUNS) ? Number(fs.readFileSync(RUNS, 'utf8').trim()) || 0 : 0) + 1;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(RUNS, `${run}\n`);

const emailTag = tag();
const lines = Object.entries(PEOPLE).map(([id, list]) => {
  const x = list[(run - 1) % list.length];
  const email = `${plain(x.first)}.${plain(x.last)}.${emailTag}@mailinator.com`;
  return [id, x.first, x.last, email, x.phone, x.title, x.dept, x.industry, x.city, x.state, x.country, x.company, `https://www.${x.site}`, x.industry, x.founded, x.deal ?? ''].map(cell).join(',');
});
fs.writeFileSync(OUT, `${[HEADER.join(','), ...lines].join('\n')}\n`);
console.log(`Wrote ${OUT} with ${lines.length} rows (run ${run}).`);
