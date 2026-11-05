// Builds test-data/salesforce/email-bounced.csv: one named prospect for each of the 31 rows of
// test-cases/salesforce/email-bounced.md that bounces an email (the three UI-only rows need none). The Scenario
// column is what the spec finds the row by, written "<section> > <#>".
//
// Only the email is new on every run (the two digits before the @), because Saleshandy refuses an email it has
// seen before (code 1001) and the Salesforce org is never cleaned. Create a Account 1 and 3 use names no earlier
// run left an Account for (the cases file says "Priya Nair" and "Sean O'Brien", which Link Clicked already created:
// Create a Account finds an existing Account by full name and creates nothing). The rows whose Account is found by the
// prospect's full name (Update a Account 2) keep a name nobody else uses.
//
//   node scripts/make-salesforce-email-bounced-data.ts            first build, refuses to overwrite
//   node scripts/make-salesforce-email-bounced-data.ts --force    all rows get new emails
//   node scripts/make-salesforce-email-bounced-data.ts --rows "Create a Lead in Salesforce > 1,Baseline > 2"
//        only those rows get a new email
import fs from 'node:fs';
import path from 'node:path';
import { readCsv } from '../src/data/csv.ts';

const OUT = path.resolve(import.meta.dirname, '../test-data/salesforce/email-bounced.csv');
const RUNS = path.resolve(import.meta.dirname, '../test-data/salesforce/email-bounced.runs.txt');
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
const CB = 'Combined activities';

type P = { id: string; first: string; last: string; phone: string; title: string; dept: string; city: string; state: string; country: string; company: string; industry: string; site: string; founded: string; deal?: string; note?: string };

const PEOPLE: P[] = [
  { id: `${T} > 2`, first: 'Marcus', last: 'Oyelaran', phone: '+1 555-0131-2204', title: 'Regional Sales Manager', dept: 'Sales', city: 'Houston', state: 'Texas', country: 'United States', company: 'Tidewater Freight Services', industry: 'Logistics', site: 'tidewaterfreight.com', founded: '2009' },
  { id: `${T} > 3`, first: 'Elin', last: 'Sjoberg', phone: '+46 555-0140-3318', title: 'Sales Operations Lead', dept: 'Sales', city: 'Malmo', state: 'Skane', country: 'Sweden', company: 'Oresund Cold Storage', industry: 'Logistics', site: 'oresundcold.se', founded: '2012', note: 'Sequence paused after being Active' },
  { id: `${T} > 4`, first: 'Dmitri', last: 'Volkov', phone: '+1 555-0152-9047', title: 'Procurement Manager', dept: 'Procurement', city: 'Cleveland', state: 'Ohio', country: 'United States', company: 'Lakefront Steel Supply', industry: 'Metals', site: 'lakefrontsteel.com', founded: '1999', note: 'Moved to step 2, step 2 email not sent' },
  { id: `${T} > 5`, first: 'Grace', last: 'Adeyemi', phone: '+44 555-0161-7720', title: 'Customer Success Manager', dept: 'Customer Success', city: 'Leeds', state: 'England', country: 'United Kingdom', company: 'Pennine Software', industry: 'Software', site: 'pennine.co.uk', founded: '2015', note: 'Only the Email Sent trigger on' },
  { id: `${T} > 6`, first: 'Rowan', last: 'Ellisson', phone: '+1 555-0173-4486', title: 'Marketing Director', dept: 'Marketing', city: 'Boulder', state: 'Colorado', country: 'United States', company: 'Granite Peak Outfitters', industry: 'Retail', site: 'granitepeakoutfitters.com', founded: '2008', note: 'Real bounce' },
  { id: `${CL} > 1`, first: 'Siobhán', last: "O'Brien", phone: '+353 555-0184-2215', title: 'Revenue Operations Manager', dept: 'Operations', city: 'Cork', state: 'Munster', country: 'Ireland', company: 'Harbourview Logistics', industry: 'Logistics', site: 'harbourviewlogistics.ie', founded: '2014' },
  { id: `${CL} > 2`, first: 'Amelia', last: 'Kowalski', phone: '+1 555-0156-3390', title: 'Operations Coordinator', dept: 'Operations', city: 'Chicago', state: 'Illinois', country: 'United States', company: 'Lakeshore Print Works', industry: 'Printing', site: 'lakeshoreprint.com', founded: '2003' },
  { id: `${CL} > 3`, first: 'Tobias', last: 'Lindqvist', phone: '+46 555-0188-4410', title: 'Logistics Director', dept: 'Logistics', city: 'Gothenburg', state: 'Vastra Gotaland', country: 'Sweden', company: 'Northgate Freight', industry: 'Freight', site: 'northgatefreight.com', founded: '2001' },
  { id: `${UL} > 1`, first: 'Chloe', last: 'Bergmann', phone: '+41 555-0177-4402', title: 'Head of Marketing', dept: 'Marketing', city: 'Zurich', state: 'Zurich', country: 'Switzerland', company: 'Alpine Packaging Co', industry: 'Packaging', site: 'alpinepackaging.ch', founded: '2007' },
  { id: `${UL} > 2`, first: 'Ravi', last: 'Menon', phone: '+91 555-0123-7788', title: 'Director of Procurement', dept: 'Procurement', city: 'Pune', state: 'Maharashtra', country: 'India', company: 'Sahyadri Auto Components', industry: 'Automotive', site: 'sahyadriauto.in', founded: '2005' },
  { id: `${CC} > 1`, first: 'Sofia', last: 'Marchetti', phone: '+39 555-0121-5530', title: 'Procurement Lead', dept: 'Procurement', city: 'Milan', state: 'Lombardy', country: 'Italy', company: 'Alder & Finch Textiles', industry: 'Textiles', site: 'alderfinch.it', founded: '1996' },
  { id: `${CC} > 2`, first: 'Kwame', last: 'Mensah', phone: '+233 555-0136-8841', title: 'Supply Chain Analyst', dept: 'Logistics', city: 'Accra', state: 'Greater Accra', country: 'Ghana', company: 'Gold Coast Cocoa Traders', industry: 'Food', site: 'goldcoastcocoa.com', founded: '2010' },
  { id: `${UC} > 1`, first: 'Lucia', last: 'Fernandez', phone: '+34 555-0145-2209', title: 'Customer Support Manager', dept: 'Support', city: 'Valencia', state: 'Valencia', country: 'Spain', company: 'Levante Ceramics', industry: 'Manufacturing', site: 'levanteceramics.es', founded: '2002' },
  { id: `${UC} > 2`, first: 'Owen', last: 'Pritchard', phone: '+44 555-0197-6633', title: 'IT Manager', dept: 'IT', city: 'Cardiff', state: 'Wales', country: 'United Kingdom', company: 'Taff Valley Systems', industry: 'IT Services', site: 'taffvalley.co.uk', founded: '2013' },
  { id: `${CA} > 1`, first: 'Rukmini', last: 'Varadarajan', phone: '+91 555-0118-4472', title: 'Finance Controller', dept: 'Finance', city: 'Kochi', state: 'Kerala', country: 'India', company: 'Malabar Spice Exports', industry: 'Food', site: 'malabarspice.in', founded: '2006' },
  { id: `${CA} > 2`, first: 'Henrik', last: 'Nygaard', phone: '+47 555-0166-1190', title: 'Operations Director', dept: 'Operations', city: 'Bergen', state: 'Vestland', country: 'Norway', company: 'Fjordline Marine', industry: 'Marine', site: 'fjordlinemarine.no', founded: '1994' },
  { id: `${CA} > 3`, first: 'Grainne', last: "O'Dwyer", phone: '+353 555-0129-3057', title: 'Plant Manager', dept: 'Operations', city: 'Galway', state: 'Connacht', country: 'Ireland', company: 'Charles River Packaging', industry: 'Packaging', site: 'charlesriverpack.com', founded: '1991' },
  { id: `${UA} > 1`, first: 'Mei', last: 'Tanaka', phone: '+81 555-0134-7765', title: 'Sales Manager', dept: 'Sales', city: 'Osaka', state: 'Osaka', country: 'Japan', company: 'Kansai Precision Tools', industry: 'Manufacturing', site: 'kansaiprecision.jp', founded: '1988' },
  { id: `${UA} > 2`, first: 'Leila', last: 'Haddad', phone: '+961 555-0143-2281', title: 'Business Development Manager', dept: 'Sales', city: 'Beirut', state: 'Beirut', country: 'Lebanon', company: 'Cedar Hill Trading', industry: 'Trading', site: 'cedarhilltrading.com', founded: '2004' },
  { id: `${CO} > 1`, first: 'Andre', last: 'Costa', phone: '+55 555-0112-9034', title: 'Head of Procurement', dept: 'Procurement', city: 'Sao Paulo', state: 'Sao Paulo', country: 'Brazil', company: 'Paulista Auto Parts', industry: 'Automotive', site: 'paulistaauto.com.br', founded: '2000', deal: '12000' },
  { id: `${CO} > 2`, first: 'Ingrid', last: 'Haugland', phone: '+47 555-0158-6620', title: 'Procurement Lead', dept: 'Operations', city: 'Oslo', state: 'Oslo', country: 'Norway', company: 'Nordlys Energy', industry: 'Energy', site: 'nordlysenergy.no', founded: '2011' },
  { id: `${UO} > 1`, first: 'Tariq', last: 'Hussain', phone: '+92 555-0139-5518', title: 'Regional Director', dept: 'Sales', city: 'Karachi', state: 'Sindh', country: 'Pakistan', company: 'Indus Textile Mills', industry: 'Textiles', site: 'industextile.pk', founded: '1985' },
  { id: `${AN} > 1`, first: 'Camille', last: 'Dubois', phone: '+33 555-0127-3340', title: 'Marketing Manager', dept: 'Marketing', city: 'Lyon', state: 'Auvergne-Rhone-Alpes', country: 'France', company: 'Rhone Valley Wines', industry: 'Beverages', site: 'rhonevalleywines.fr', founded: '1997' },
  { id: `${AN} > 2`, first: 'Jonas', last: 'Weber', phone: '+49 555-0165-2278', title: 'Product Manager', dept: 'Product', city: 'Stuttgart', state: 'Baden-Wurttemberg', country: 'Germany', company: 'Neckar Robotics', industry: 'Robotics', site: 'neckarrobotics.de', founded: '2017' },
  { id: `${AN} > 3`, first: 'Aisha', last: 'Khan', phone: '+971 555-0148-7712', title: 'Operations Manager', dept: 'Operations', city: 'Dubai', state: 'Dubai', country: 'United Arab Emirates', company: 'Gulfstream Freight', industry: 'Freight', site: 'gulfstreamfreight.ae', founded: '2008' },
  { id: `${AN} > 4`, first: 'Peter', last: 'Novak', phone: '+420 555-0171-4406', title: 'Purchasing Manager', dept: 'Procurement', city: 'Brno', state: 'South Moravia', country: 'Czechia', company: 'Moravian Glassworks', industry: 'Manufacturing', site: 'moravianglass.cz', founded: '1993' },
  { id: `${RE} > 1`, first: 'Beatriz', last: 'Santos', phone: '+351 555-0132-6609', title: 'Customer Success Lead', dept: 'Customer Success', city: 'Porto', state: 'Porto', country: 'Portugal', company: 'Douro Cork Company', industry: 'Manufacturing', site: 'dourocork.pt', founded: '1989' },
  { id: `${RE} > 2`, first: 'Callum', last: 'MacLeod', phone: '+44 555-0181-9935', title: 'Sales Director', dept: 'Sales', city: 'Glasgow', state: 'Scotland', country: 'United Kingdom', company: 'Clydeside Engineering', industry: 'Engineering', site: 'clydesideeng.co.uk', founded: '1979' },
  { id: `${RE} > 3`, first: 'Yara', last: 'Nasser', phone: '+20 555-0147-3381', title: 'Account Manager', dept: 'Sales', city: 'Cairo', state: 'Cairo', country: 'Egypt', company: 'Delta Fresh Produce', industry: 'Food', site: 'deltafresh.com.eg', founded: '2007' },
  { id: `${CB} > 1`, first: 'Magnus', last: 'Eriksen', phone: '+45 555-0155-8827', title: 'Head of Sales', dept: 'Sales', city: 'Aarhus', state: 'Central Jutland', country: 'Denmark', company: 'Jutland Wind Services', industry: 'Energy', site: 'jutlandwind.dk', founded: '2010', note: 'Real bounce' },
  { id: `${CB} > 2`, first: 'Nadia', last: 'Petrova', phone: '+359 555-0169-2243', title: 'Procurement Specialist', dept: 'Procurement', city: 'Plovdiv', state: 'Plovdiv', country: 'Bulgaria', company: 'Rhodope Dairy', industry: 'Food', site: 'rhodopedairy.bg', founded: '2002' },
];

const slug = (s: string): string => s.normalize('NFKD').replace(/[^A-Za-z]/g, '').toLowerCase();
const cell = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

function nextRun(): number {
  const n = fs.existsSync(RUNS) ? Number(fs.readFileSync(RUNS, 'utf8').trim().split('\n').pop()) + 1 : 20;
  fs.appendFileSync(RUNS, `${n}\n`);
  return n;
}

function toRow(p: P, run: number): string[] {
  const first = slug(p.first);
  const last = slug(p.last);
  const email = `${first}.${last}${run}@mailinator.com`;
  return [
    p.id, p.first, p.last, email, p.phone, p.title, p.dept, p.industry, '5',
    `https://www.linkedin.com/in/${first}${last}${run}/`, `https://x.com/${first}${last}`, `https://www.facebook.com/${first}.${last}.${run}`,
    `https://www.${first}${last}.com`, '', p.city, p.state, p.country, p.company, `https://www.${p.site}`, p.industry, p.founded,
    `https://www.linkedin.com/company/${slug(p.company)}/`, p.deal ?? '', p.note ?? '',
  ];
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const rowsArg = args.indexOf('--rows');
const only = rowsArg >= 0 ? new Set(args[rowsArg + 1].split(',').map((s) => s.trim())) : null;

if (fs.existsSync(OUT) && !force && !only) {
  console.error(`${OUT} exists. Use --force for new emails on every row or --rows "<ids>" for some rows.`);
  process.exit(1);
}

const run = nextRun();
const old = only ? new Map(readCsv('salesforce/email-bounced.csv').map((r) => [r['Scenario'], HEADER.map((h) => r[h] ?? '')])) : new Map<string, string[]>();
const lines = [HEADER.join(',')];
for (const p of PEOPLE) {
  const keep = only && !only.has(p.id) ? old.get(p.id) : undefined;
  lines.push((keep ?? toRow(p, run)).map(cell).join(','));
}
fs.writeFileSync(OUT, `${lines.join('\n')}\n`);
console.log(`Wrote ${PEOPLE.length} rows to ${OUT} (run ${run})`);
