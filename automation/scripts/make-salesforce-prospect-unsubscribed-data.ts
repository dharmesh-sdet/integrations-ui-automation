// Builds test-data/salesforce/prospect-unsubscribed.csv: one named prospect for each row of
// test-cases/salesforce/prospect-unsubscribed.md that needs one (29 of the 32; trigger row 1 and the two
// Closing date 0 Days rows need none). The Scenario column is what the spec finds the row by, written
// "<section> > <#>".
//
// Names: the Salesforce org is shared and never cleaned, and Accounts are found by the prospect's full name,
// so no name may repeat one in any other test-data/salesforce/*.csv. Names are taken from the pool below in
// order and skipped when a CSV already holds them. The two apostrophe rows keep their own names.
// Only the email carries the run number (the two digits before the @), because Saleshandy refuses an email it
// has seen before (code 1001).
//
//   node scripts/make-salesforce-prospect-unsubscribed-data.ts            first build, refuses to overwrite
//   node scripts/make-salesforce-prospect-unsubscribed-data.ts --force    all rows get new emails
//   node scripts/make-salesforce-prospect-unsubscribed-data.ts --rows "Create a Lead in Salesforce > 1,Trigger behavior > 2"
//        only those rows get a new email (same names)
import fs from 'node:fs';
import path from 'node:path';
import { readCsv } from '../src/data/csv.ts';

const DIR = path.resolve(import.meta.dirname, '../test-data/salesforce');
const OUT = path.join(DIR, 'prospect-unsubscribed.csv');
const RUNS = path.join(DIR, 'prospect-unsubscribed.runs.txt');
const HEADER = ['Scenario', 'First Name', 'Last Name', 'Email', 'Phone Number', 'Job Title', 'Department', 'Industry', 'Experience', 'LinkedIn', 'Twitter', 'Facebook', 'Website', 'Icebreaker', 'City', 'State', 'Country', 'Company', 'Company Website', 'Company Industry', 'Company Founded Year', 'Company LinkedIn', 'Deal Value', 'Note'];

const T = 'Trigger behavior';
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

// Row ids in file order, with the note that tells what the row does.
const ROWS: { id: string; note?: string; deal?: string; first?: string; last?: string }[] = [
  { id: `${T} > 2` },
  { id: `${T} > 3`, note: 'Mark as Unsubscribe in the Prospects tab' },
  { id: `${T} > 4`, note: 'Link opened twice' },
  { id: `${T} > 5`, note: 'In no sequence' },
  { id: `${T} > 6`, note: 'All triggers off' },
  { id: `${T} > 7`, note: 'Subscribe here after the unsubscribe' },
  { id: `${T} > 8`, note: 'Unsubscribe from the step 2 email' },
  { id: `${T} > 9`, note: 'In two sequences' },
  { id: `${T} > 10`, note: 'Replied before the unsubscribe' },
  { id: `${CL} > 1`, first: 'Niamh', last: "O'Sullivan" },
  { id: `${CL} > 2` },
  { id: `${CL} > 3` },
  { id: `${UL} > 1` },
  { id: `${UL} > 2` },
  { id: `${CC} > 1` },
  { id: `${CC} > 2` },
  { id: `${UC} > 1` },
  { id: `${UC} > 2` },
  { id: `${CA} > 1` },
  { id: `${CA} > 2` },
  { id: `${CA} > 3`, first: 'Declan', last: "O'Connor" },
  { id: `${UA} > 1` },
  { id: `${UA} > 2` },
  { id: `${CO} > 1`, deal: '12000' },
  { id: `${CO} > 3` },
  { id: `${UO} > 1` },
  { id: `${AN} > 1` },
  { id: `${AN} > 2` },
  { id: `${RE} > 1` },
];

// [first, last, city, state, country, phone, company, industry, site, founded, title, department]
type Seed = [string, string, string, string, string, string, string, string, string, string, string, string];
const POOL: Seed[] = [
  ['Anika', 'Bhattacharya', 'Kolkata', 'West Bengal', 'India', '+91 555-0201-4417', 'Hooghly Jute Mills', 'Textiles', 'hooghlyjute.in', '1992', 'Operations Manager', 'Operations'],
  ['Matteo', 'Ricci', 'Bologna', 'Emilia-Romagna', 'Italy', '+39 555-0202-8830', 'Reno Valley Foods', 'Food', 'renovalleyfoods.it', '2001', 'Procurement Lead', 'Procurement'],
  ['Zainab', 'Abubakar', 'Kano', 'Kano', 'Nigeria', '+234 555-0203-1156', 'Sahel Grain Traders', 'Agriculture', 'sahelgrain.ng', '2008', 'Sales Manager', 'Sales'],
  ['Lars', 'Eriksen', 'Aarhus', 'Central Jutland', 'Denmark', '+45 555-0204-7712', 'Jutland Wind Parts', 'Energy', 'jutlandwind.dk', '2010', 'Supply Chain Manager', 'Logistics'],
  ['Isabela', 'Ferreira', 'Porto', 'Norte', 'Portugal', '+351 555-0205-3398', 'Douro Cork Works', 'Manufacturing', 'dourocork.pt', '1989', 'Finance Controller', 'Finance'],
  ['Kofi', 'Asante', 'Kumasi', 'Ashanti', 'Ghana', '+233 555-0206-9024', 'Ashanti Timber Export', 'Forestry', 'ashantitimber.gh', '2005', 'Export Manager', 'Sales'],
  ['Freya', 'Lindgren', 'Uppsala', 'Uppsala', 'Sweden', '+46 555-0207-5561', 'Fyris Lab Supplies', 'Healthcare', 'fyrislab.se', '2013', 'Head of Marketing', 'Marketing'],
  ['Rafael', 'Quintero', 'Medellin', 'Antioquia', 'Colombia', '+57 555-0208-2247', 'Antioquia Coffee Roasters', 'Beverages', 'antioquiacoffee.co', '2007', 'Customer Success Manager', 'Customer Success'],
  ['Mina', 'Park', 'Busan', 'Busan', 'South Korea', '+82 555-0209-6683', 'Haeundae Port Logistics', 'Logistics', 'haeundaeport.kr', '2003', 'Operations Director', 'Operations'],
  ['Tomasz', 'Zielinski', 'Gdansk', 'Pomerania', 'Poland', '+48 555-0210-4409', 'Baltic Shipyard Supply', 'Marine', 'balticshipyard.pl', '1998', 'Procurement Manager', 'Procurement'],
  ['Aaliyah', 'Brooks', 'Atlanta', 'Georgia', 'United States', '+1 555-0211-7735', 'Peachtree Medical Billing', 'Healthcare', 'peachtreebilling.com', '2012', 'Revenue Operations Lead', 'Operations'],
  ['Viktor', 'Horvat', 'Zagreb', 'Zagreb', 'Croatia', '+385 555-0212-1198', 'Sava Packaging', 'Packaging', 'savapackaging.hr', '2000', 'Plant Manager', 'Operations'],
  ['Noor', 'Rahman', 'Dhaka', 'Dhaka', 'Bangladesh', '+880 555-0213-8846', 'Padma Garments', 'Textiles', 'padmagarments.bd', '2006', 'Merchandising Manager', 'Sales'],
  ['Elias', 'Mutiso', 'Nairobi', 'Nairobi', 'Kenya', '+254 555-0214-3372', 'Rift Valley Flowers', 'Agriculture', 'riftvalleyflowers.ke', '2009', 'Business Development Manager', 'Sales'],
  ['Clara', 'Henriksen', 'Tromso', 'Troms', 'Norway', '+47 555-0215-6620', 'Arctic Fish Processing', 'Food', 'arcticfish.no', '1995', 'Quality Manager', 'Quality'],
  ['Dario', 'Moretti', 'Turin', 'Piedmont', 'Italy', '+39 555-0216-9917', 'Mole Precision Gears', 'Manufacturing', 'moleprecision.it', '1987', 'Sales Director', 'Sales'],
  ['Selin', 'Aydin', 'Izmir', 'Izmir', 'Turkey', '+90 555-0217-2284', 'Aegean Olive Oil Co', 'Food', 'aegeanolive.com.tr', '2004', 'Export Coordinator', 'Sales'],
  ['Mateusz', 'Wrona', 'Krakow', 'Lesser Poland', 'Poland', '+48 555-0218-5503', 'Vistula Software House', 'Software', 'vistulasoft.pl', '2014', 'Engineering Manager', 'Engineering'],
  ['Amara', 'Okafor', 'Lagos', 'Lagos', 'Nigeria', '+234 555-0219-7741', 'Lekki Fintech Labs', 'Software', 'lekkifintech.ng', '2018', 'Product Manager', 'Product'],
  ['Joost', 'van Dijk', 'Rotterdam', 'South Holland', 'Netherlands', '+31 555-0220-1139', 'Maasvlakte Container Services', 'Logistics', 'maasvlaktecs.nl', '2002', 'Terminal Manager', 'Operations'],
  ['Esperanza', 'Villalobos', 'Guadalajara', 'Jalisco', 'Mexico', '+52 555-0221-8865', 'Tapatia Electronics', 'Electronics', 'tapatiaelectronics.mx', '2011', 'Account Executive', 'Sales'],
  ['Hugo', 'Lambert', 'Nantes', 'Pays de la Loire', 'France', '+33 555-0222-4408', 'Loire Boatyards', 'Marine', 'loireboatyards.fr', '1993', 'Operations Manager', 'Operations'],
  ['Parisa', 'Ahmadi', 'Toronto', 'Ontario', 'Canada', '+1 555-0223-6692', 'Lakeshore Cloud Services', 'Software', 'lakeshorecloud.ca', '2016', 'IT Director', 'IT'],
  ['Bjorn', 'Halvorsen', 'Stavanger', 'Rogaland', 'Norway', '+47 555-0224-3350', 'Rogaland Subsea Tools', 'Energy', 'rogalandsubsea.no', '1999', 'Regional Sales Manager', 'Sales'],
  ['Thandi', 'Nkosi', 'Durban', 'KwaZulu-Natal', 'South Africa', '+27 555-0225-9918', 'Indian Ocean Freight', 'Logistics', 'indianoceanfreight.co.za', '2007', 'Customer Support Manager', 'Support'],
  ['Cormac', 'Fitzpatrick', 'Galway', 'Connacht', 'Ireland', '+353 555-0226-2271', 'Corrib Medical Devices', 'Healthcare', 'corribmedical.ie', '2010', 'Marketing Manager', 'Marketing'],
  ['Mirela', 'Popescu', 'Cluj-Napoca', 'Cluj', 'Romania', '+40 555-0227-5547', 'Somes Auto Components', 'Automotive', 'somesauto.ro', '2005', 'Procurement Specialist', 'Procurement'],
  ['Arjun', 'Deshmukh', 'Nagpur', 'Maharashtra', 'India', '+91 555-0228-1163', 'Vidarbha Orange Growers', 'Agriculture', 'vidarbhaorange.in', '1997', 'Sales Head', 'Sales'],
  ['Elodie', 'Marchand', 'Bordeaux', 'Nouvelle-Aquitaine', 'France', '+33 555-0229-8804', 'Garonne Wine Merchants', 'Beverages', 'garonnewine.fr', '1990', 'Export Manager', 'Sales'],
  ['Takumi', 'Hayashi', 'Nagoya', 'Aichi', 'Japan', '+81 555-0230-4426', 'Chubu Machine Tools', 'Manufacturing', 'chubumachine.jp', '1984', 'Sales Manager', 'Sales'],
  ['Ximena', 'Paredes', 'Quito', 'Pichincha', 'Ecuador', '+593 555-0231-7759', 'Andean Rose Exporters', 'Agriculture', 'andeanrose.ec', '2008', 'Operations Coordinator', 'Operations'],
  ['Ruairi', 'Gallagher', 'Belfast', 'Northern Ireland', 'United Kingdom', '+44 555-0232-3315', 'Lagan Aerospace Parts', 'Aerospace', 'laganaero.co.uk', '2001', 'Programme Manager', 'Operations'],
  ['Sunita', 'Kapoor', 'Jaipur', 'Rajasthan', 'India', '+91 555-0233-6670', 'Pink City Jewellers', 'Retail', 'pinkcityjewellers.in', '1996', 'Store Operations Manager', 'Operations'],
  ['Anders', 'Bergstrom', 'Lulea', 'Norrbotten', 'Sweden', '+46 555-0234-9981', 'Norrbotten Steel Works', 'Metals', 'norrbottensteel.se', '1986', 'Maintenance Manager', 'Operations'],
  ['Leyla', 'Mammadov', 'Baku', 'Baku', 'Azerbaijan', '+994 555-0235-2208', 'Caspian Oilfield Supply', 'Energy', 'caspianoilfield.az', '2002', 'Logistics Coordinator', 'Logistics'],
];

const slug = (s: string): string => s.normalize('NFKD').replace(/[^A-Za-z]/g, '').toLowerCase();
const cell = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

function takenNames(): Set<string> {
  const taken = new Set<string>();
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.csv') && x !== 'prospect-unsubscribed.csv')) {
    for (const r of readCsv(`salesforce/${f}`)) taken.add(`${r['First Name']} ${r['Last Name']}`.toLowerCase());
  }
  return taken;
}

function nextRun(): number {
  const n = fs.existsSync(RUNS) ? Number(fs.readFileSync(RUNS, 'utf8').trim().split('\n').pop()) + 1 : 30;
  fs.appendFileSync(RUNS, `${n}\n`);
  return n;
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const rowsArg = args.indexOf('--rows');
const only = rowsArg >= 0 ? new Set(args[rowsArg + 1].split(',').map((s) => s.trim())) : null;

if (fs.existsSync(OUT) && !force && !only) {
  console.error(`${OUT} exists. Use --force for new emails on every row or --rows "<ids>" for some rows.`);
  process.exit(1);
}

const taken = takenNames();
const old = new Map(fs.existsSync(OUT) ? readCsv('salesforce/prospect-unsubscribed.csv').map((r) => [r['Scenario'], r]) : []);
const run = nextRun();
const pool = POOL.filter((s) => !taken.has(`${s[0]} ${s[1]}`.toLowerCase()));
const fixed = ROWS.filter((r) => r.first).map((r) => `${r.first} ${r.last}`.toLowerCase());
for (const name of fixed) if (taken.has(name)) throw new Error(`The name "${name}" is already in another CSV. Pick another.`);
if (pool.length < ROWS.filter((r) => !r.first).length) throw new Error(`Only ${pool.length} fresh names left in the pool, need ${ROWS.filter((r) => !r.first).length}.`);

const lines = [HEADER.join(',')];
let next = 0;
for (const r of ROWS) {
  const seed = r.first ? POOL[next % POOL.length] : pool[next++];
  const [pf, pl, city, state, country, phone, company, industry, site, founded, title, dept] = seed;
  const first = r.first ?? pf;
  const last = r.last ?? pl;
  const email = `${slug(first)}.${slug(last)}${run}@mailinator.com`;
  const row = [
    r.id, first, last, email, phone, title, dept, industry, '5',
    `https://www.linkedin.com/in/${slug(first)}${slug(last)}${run}/`, `https://x.com/${slug(first)}${slug(last)}`, `https://www.facebook.com/${slug(first)}.${slug(last)}.${run}`,
    `https://www.${slug(first)}${slug(last)}.com`, '', city, state, country, company, `https://www.${site}`, industry, founded,
    `https://www.linkedin.com/company/${slug(company)}/`, r.deal ?? '', r.note ?? '',
  ];
  const prev = old.get(r.id);
  const keep = only && !only.has(r.id) ? prev : undefined;
  // A row that gets a new email keeps its stored name and fields; the email is built from that stored name.
  const renewed = only && prev ? HEADER.map((h, i) => (i === 3 ? `${slug(prev['First Name'])}.${slug(prev['Last Name'])}${run}@mailinator.com` : prev[h] ?? row[i])) : undefined;
  const values = keep ? HEADER.map((h) => keep[h] ?? '') : renewed ?? row;
  lines.push(values.map(cell).join(','));
}
fs.writeFileSync(OUT, `${lines.join('\n')}\n`);
console.log(`Wrote ${ROWS.length} rows to ${OUT} (run ${run})`);
