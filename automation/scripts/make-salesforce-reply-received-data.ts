// Builds test-data/salesforce/reply-received.csv: one named prospect for each of the 32 rows of
// test-cases/salesforce/reply-received.md that sends a reply (Create a Opportunity 2 and the UI rows reuse or need
// no prospect). The Scenario column is what the spec finds the row by, written "<section> > <#>".
//
// Names, titles and companies come from the cases file. Only the email is new on every run (the part after the dot
// near the end), because Saleshandy refuses an email it has seen before (code 1001) and the Salesforce org is never
// cleaned. A row that needs a blank field (no Company) is blanked in the spec, not here.
//
//   node scripts/make-salesforce-reply-received-data.ts               first build, refuses to overwrite
//   node scripts/make-salesforce-reply-received-data.ts --force       all 32 rows get new emails
//   node scripts/make-salesforce-reply-received-data.ts --rows "Update a Lead in Salesforce > 1,Baseline > 4"
//        only those rows get a new email; the rows that an Account is found by name (see ALTERNATE) also get the
//        next name from their alternate list, so an Account left by the earlier run cannot be found again.
import fs from 'node:fs';
import path from 'node:path';
import { readCsv } from '../src/data/csv.ts';

const OUT = path.resolve(import.meta.dirname, '../test-data/salesforce/reply-received.csv');
const RUNS = path.resolve(import.meta.dirname, '../test-data/salesforce/reply-received.runs.txt');
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

type P = { id: string; first: string; last: string; phone: string; title: string; dept: string; city: string; state: string; country: string; company: string; industry: string; site: string; founded: string; deal?: string };

const PEOPLE: P[] = [
  { id: 'Baseline > 4', first: 'Marcus', last: 'Oyelaran', phone: '+1 555-0131-2204', title: 'Regional Sales Manager', dept: 'Sales', city: 'Houston', state: 'Texas', country: 'United States', company: 'Tidewater Freight Services', industry: 'Logistics', site: 'tidewaterfreight.com', founded: '2009' },
  { id: `${CL} > 1`, first: 'José', last: "Peña-O'Brien", phone: '+1 555-0142-7781', title: 'Revenue Operations Manager', dept: 'Operations', city: 'Austin', state: 'Texas', country: 'United States', company: 'Brightline Logistics', industry: 'Logistics', site: 'brightlinelogistics.com', founded: '2014' },
  { id: `${CL} > 2`, first: 'Amelia', last: 'Kowalski', phone: '+1 555-0156-3390', title: 'Operations Coordinator', dept: 'Operations', city: 'Chicago', state: 'Illinois', country: 'United States', company: 'Lakeshore Print Works', industry: 'Printing', site: 'lakeshoreprint.com', founded: '2003' },
  { id: `${CL} > 3`, first: 'Tobias', last: 'Lindqvist', phone: '+46 555-0188-4410', title: 'Logistics Director', dept: 'Logistics', city: 'Gothenburg', state: 'Vastra Gotaland', country: 'Sweden', company: 'Northgate Freight', industry: 'Freight', site: 'northgatefreight.com', founded: '2001' },
  { id: `${CL} > 4`, first: 'Fatima', last: 'Rahman', phone: '+1 555-0163-9021', title: 'Account Executive', dept: 'Sales', city: 'Toronto', state: 'Ontario', country: 'Canada', company: 'Crescent Dental Supplies', industry: 'Medical Supplies', site: 'crescentdental.com', founded: '2011' },
  { id: `${CL} > 5`, first: 'Daniel', last: 'Okafor', phone: '+1 555-0175-6612', title: 'Head of Operations', dept: 'Operations', city: 'Atlanta', state: 'Georgia', country: 'United States', company: 'Kestrel Building Supplies', industry: 'Construction', site: 'kestrelbuilding.com', founded: '1998' },
  { id: `${UL} > 1`, first: 'Chloe', last: 'Bergmann', phone: '+41 555-0177-4402', title: 'Head of Marketing', dept: 'Marketing', city: 'Zurich', state: 'Zurich', country: 'Switzerland', company: 'Alpine Packaging Co', industry: 'Packaging', site: 'alpinepackaging.ch', founded: '2007' },
  { id: `${UL} > 2`, first: 'Ravi', last: 'Menon', phone: '+91 555-0123-7788', title: 'Director of Procurement', dept: 'Procurement', city: 'Pune', state: 'Maharashtra', country: 'India', company: 'Sahyadri Auto Components', industry: 'Automotive', site: 'sahyadriauto.in', founded: '2005' },
  { id: `${UL} > 3`, first: 'Hannah', last: 'Whitcombe', phone: '+44 555-0190-2271', title: 'Marketing Manager', dept: 'Marketing', city: 'Bristol', state: 'England', country: 'United Kingdom', company: 'Avonside Outdoor Gear', industry: 'Retail', site: 'avonsideoutdoor.co.uk', founded: '2016' },
  { id: `${CC} > 1`, first: 'Sofia', last: 'Marchetti', phone: '+39 555-0121-5530', title: 'Procurement Lead', dept: 'Procurement', city: 'Milan', state: 'Lombardy', country: 'Italy', company: 'Alder & Finch Textiles', industry: 'Textiles', site: 'alderfinch.it', founded: '1996' },
  { id: `${CC} > 2`, first: 'Elijah', last: 'Brandt', phone: '+1 555-0148-3307', title: 'Facilities Manager', dept: 'Facilities', city: 'Denver', state: 'Colorado', country: 'United States', company: 'Summit Ridge Property Group', industry: 'Real Estate', site: 'summitridgegroup.com', founded: '2010' },
  { id: `${CC} > 3`, first: 'Naomi', last: 'Castellano', phone: '+1 555-0151-8842', title: 'Event Coordinator', dept: 'Marketing', city: 'Miami', state: 'Florida', country: 'United States', company: 'Coastal Expo Partners', industry: 'Events', site: 'coastalexpo.com', founded: '2012' },
  { id: `${UC} > 1`, first: 'Liam', last: 'Ashworth', phone: '+1 555-0166-1190', title: 'Operations Lead', dept: 'Operations', city: 'Boston', state: 'Massachusetts', country: 'United States', company: 'Harbor Point Analytics', industry: 'Analytics', site: 'harborpoint.com', founded: '2015' },
  { id: `${UC} > 2`, first: 'Zainab', last: 'Hakimi', phone: '+1 555-0172-4456', title: 'Finance Manager', dept: 'Finance', city: 'Seattle', state: 'Washington', country: 'United States', company: 'Evergreen Credit Union', industry: 'Finance', site: 'evergreencu.org', founded: '1985' },
  { id: `${CA} > 1`, first: 'Dana', last: 'Whitfield', phone: '+1 555-0183-7765', title: 'Purchasing Manager', dept: 'Procurement', city: 'Portland', state: 'Maine', country: 'United States', company: 'Harbourline Marine Supplies', industry: 'Marine', site: 'harbourlinemarine.com', founded: '2002' },
  { id: `${CA} > 2`, first: 'Rohan', last: 'Desai', phone: '+1 555-0194-2238', title: 'Practice Manager', dept: 'Administration', city: 'Phoenix', state: 'Arizona', country: 'United States', company: 'Pinecrest Dental Group', industry: 'Healthcare', site: 'pinecrestdental.com', founded: '2008' },
  { id: `${CA} > 3`, first: 'Oskar', last: 'Nilsson', phone: '+47 555-0117-9054', title: 'Project Engineer', dept: 'Engineering', city: 'Bergen', state: 'Vestland', country: 'Norway', company: 'Fjordline Engineering', industry: 'Engineering', site: 'fjordline.no', founded: '2013' },
  { id: `${UA} > 1`, first: 'Priya', last: 'Venkataraman', phone: '+1 555-0108-6623', title: 'Vice President of Sales', dept: 'Sales', city: 'San Jose', state: 'California', country: 'United States', company: 'Brightwave Systems', industry: 'Software', site: 'brightwavesystems.com', founded: '2017' },
  { id: `${UA} > 2`, first: 'Callum', last: 'Fraser', phone: '+44 555-0145-3318', title: 'Supply Chain Manager', dept: 'Supply Chain', city: 'Glasgow', state: 'Scotland', country: 'United Kingdom', company: 'Redstone Packaging', industry: 'Packaging', site: 'redstonepackaging.co.uk', founded: '1999' },
  { id: `${UA} > 3`, first: 'Gareth', last: 'Lloyd', phone: '+44 555-0159-7710', title: 'Sales Director', dept: 'Sales', city: 'Cardiff', state: 'Wales', country: 'United Kingdom', company: 'Taff Valley Machinery', industry: 'Machinery', site: 'taffvalley.co.uk', founded: '1990' },
  { id: `${CO} > 1`, first: 'Isabella', last: 'Moreau', phone: '+33 555-0136-4402', title: 'Chief Operating Officer', dept: 'Operations', city: 'Lyon', state: 'Auvergne-Rhone-Alpes', country: 'France', company: 'Rhone Valley Logistics', industry: 'Logistics', site: 'rhonevalleylogistics.fr', founded: '2006', deal: '12000' },
  { id: `${UO} > 1`, first: 'Mateo', last: 'Fernandez', phone: '+34 555-0124-8896', title: 'Commercial Director', dept: 'Sales', city: 'Valencia', state: 'Valencia', country: 'Spain', company: 'Levante Foods', industry: 'Food and Beverage', site: 'levantefoods.es', founded: '2000' },
  { id: `${UO} > 2`, first: 'Yuki', last: 'Tanaka', phone: '+81 555-0112-3340', title: 'General Manager', dept: 'Management', city: 'Osaka', state: 'Osaka', country: 'Japan', company: 'Kansai Precision Tools', industry: 'Manufacturing', site: 'kansaiprecision.jp', founded: '1988' },
  { id: `${UO} > 3`, first: 'Connor', last: 'Reilly', phone: '+353 555-0187-5521', title: 'Business Development Manager', dept: 'Sales', city: 'Cork', state: 'Munster', country: 'Ireland', company: 'Lee Valley Software', industry: 'Software', site: 'leevalleysoftware.ie', founded: '2018' },
  { id: `${AN} > 1`, first: 'Leila', last: 'Haddad', phone: '+971 555-0165-7743', title: 'Marketing Director', dept: 'Marketing', city: 'Dubai', state: 'Dubai', country: 'United Arab Emirates', company: 'Gulfstream Hospitality', industry: 'Hospitality', site: 'gulfstreamhospitality.ae', founded: '2004' },
  { id: `${AN} > 2`, first: 'Henrik', last: 'Solberg', phone: '+47 555-0129-6618', title: 'IT Manager', dept: 'IT', city: 'Oslo', state: 'Oslo', country: 'Norway', company: 'Nordlys Insurance', industry: 'Insurance', site: 'nordlys.no', founded: '1992' },
  { id: `${AN} > 3`, first: 'Amara', last: 'Obi', phone: '+234 555-0140-2209', title: 'Programme Manager', dept: 'Programmes', city: 'Abuja', state: 'FCT', country: 'Nigeria', company: 'Savanna Health Partners', industry: 'Healthcare', site: 'savannahealth.ng', founded: '2010' },
  { id: `${RE} > 1`, first: 'Wei', last: 'Zhang', phone: '+65 555-0133-8815', title: 'Procurement Manager', dept: 'Procurement', city: 'Singapore', state: 'Singapore', country: 'Singapore', company: 'Merlion Electronics', industry: 'Electronics', site: 'merlionelectronics.sg', founded: '2007' },
  { id: `${RE} > 2`, first: 'Patrick', last: 'Doyle', phone: '+1 555-0198-4437', title: 'Regional Manager', dept: 'Sales', city: 'Boston', state: 'Massachusetts', country: 'United States', company: 'Charles River Fasteners', industry: 'Manufacturing', site: 'charlesriverfasteners.com', founded: '1994' },
  { id: `${RE} > 3`, first: 'Sienna', last: 'Ward', phone: '+61 555-0171-2284', title: 'Head of Partnerships', dept: 'Partnerships', city: 'Melbourne', state: 'Victoria', country: 'Australia', company: 'Yarra Design Studio', industry: 'Design', site: 'yarradesign.com.au', founded: '2012' },
  { id: `${RE} > 4`, first: 'Omar', last: 'Haddad', phone: '+1 555-0149-9926', title: 'Fleet Manager', dept: 'Operations', city: 'Dearborn', state: 'Michigan', country: 'United States', company: 'Great Lakes Auto Rental', industry: 'Automotive', site: 'greatlakesrental.com', founded: '2005' },
  { id: 'Combined activities > 1', first: 'Julian', last: 'Okoro', phone: '+1 555-0107-3351', title: 'Operations Manager', dept: 'Operations', city: 'Columbus', state: 'Ohio', country: 'United States', company: 'Silverbrook Hardware', industry: 'Retail', site: 'silverbrookhardware.com', founded: '1989' },
];

// Rows an Account is found by name. A rerun swaps in the next name, so the Account of the earlier run is not found.
// Update a Account 1 uses the prospect's full name; Create a Account 2 and Update a Account 2 use the Company.
const ALTERNATE: Record<string, Partial<Pick<P, 'first' | 'last' | 'company'>>[]> = {
  // Rows that seed a Lead or Contact by hand: Salesforce says "Similar Records Exist" for the same name (2026-11-04).
  [`${RE} > 2`]: [{ first: 'Declan', last: 'Murphy' }, { first: 'Brendan', last: 'Gallagher' }, { first: 'Cormac', last: 'Nolan' }],
  [`${CC} > 3`]: [{ first: 'Giulia', last: 'Bellandi' }, { first: 'Chiara', last: 'Ferraro' }, { first: 'Elena', last: 'Rinaldi' }],
  [`${UA} > 1`]: [{ first: 'Meera', last: 'Subramanian' }, { first: 'Anjali', last: 'Raghavan' }, { first: 'Kavita', last: 'Narayanan' }],
  [`${CA} > 2`]: [{ company: 'Cedar Hollow Dental Partners' }, { company: 'Willow Bend Family Dentistry' }, { company: 'Lakeview Smile Clinic' }],
  [`${UA} > 2`]: [{ company: 'Ironbridge Packaging' }, { company: 'Copperfield Packaging' }, { company: 'Blackthorn Packaging' }],
};

const cell = (v = '') => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const plain = (s: string) => s.normalize('NFKD').replace(/[^A-Za-z]/g, '').toLowerCase();
const tag = () => Math.floor(Date.now() / 1000).toString(36).slice(-5);

function toRow(p: P, emailTag: string): string[] {
  const email = `${plain(p.first)}.${plain(p.last)}.${emailTag}@mailinator.com`;
  return [p.id, p.first, p.last, email, p.phone, p.title, p.dept, p.industry, p.city, p.state, p.country, p.company, `https://www.${p.site}`, p.industry, p.founded, p.deal ?? ''];
}

const args = process.argv.slice(2);
const rowsArg = args.indexOf('--rows') >= 0 ? args[args.indexOf('--rows') + 1] : undefined;

if (!rowsArg) {
  if (fs.existsSync(OUT) && !args.includes('--force')) {
    console.error('test-data/salesforce/reply-received.csv already exists. Add --force to give all 32 rows new emails.');
    process.exit(1);
  }
  fs.writeFileSync(RUNS, '0\n');
  fs.writeFileSync(OUT, `${[HEADER.join(','), ...PEOPLE.map((p) => toRow(p, tag()).map(cell).join(','))].join('\n')}\n`);
  console.log(`Wrote ${OUT} with ${PEOPLE.length} rows.`);
} else {
  const wanted = new Set(rowsArg.split(',').map((s) => s.trim()).filter(Boolean));
  const unknown = [...wanted].filter((id) => !PEOPLE.some((p) => p.id === id));
  if (unknown.length) throw new Error(`No such row: ${unknown.join(', ')}`);
  const rerun = (fs.existsSync(RUNS) ? Number(fs.readFileSync(RUNS, 'utf8').trim()) || 0 : 0) + 1;
  fs.writeFileSync(RUNS, `${rerun}\n`);
  const current = new Map(readCsv('salesforce/reply-received.csv').map((r) => [r['Scenario'], r]));
  const lines = PEOPLE.map((p) => {
    if (!wanted.has(p.id) && current.has(p.id)) return HEADER.map((h) => cell(current.get(p.id)![h])).join(',');
    const alts = ALTERNATE[p.id];
    const swapped = alts ? { ...p, ...alts[(rerun - 1) % alts.length] } : p;
    return toRow(swapped, tag()).map(cell).join(',');
  });
  fs.writeFileSync(OUT, `${[HEADER.join(','), ...lines].join('\n')}\n`);
  console.log(`New emails for ${wanted.size} row(s) (rerun ${rerun}) in ${OUT}.`);
}
