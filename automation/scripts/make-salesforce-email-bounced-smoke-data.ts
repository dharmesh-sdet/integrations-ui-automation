// Builds test-data/salesforce/email-bounced-smoke.csv for the production smoke of
// notes/production-testing/25-salesforce-email-bounced.md: one named prospect per check that bounces an email
// (8 rows). The Scenario column is "Smoke > <#>" (the check number in the note). Check 9 needs no prospect.
//
// The Salesforce org is never cleaned and shared with the other smoke runs, so every run gets new emails
// (Saleshandy refuses an email it has seen, code 1001) and the next person from each row's list (Salesforce says
// "Similar Records Exist" for the same name, and Create a Account finds an Account by full name and creates
// nothing). Names here differ from the other Salesforce smoke names and from the staging Email Bounced names.
// Check 1 is the real bounce: its company is letters only, so the spec can build name@<company>.mailinator.com.
//   node scripts/make-salesforce-email-bounced-smoke-data.ts
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, '../test-data/salesforce/email-bounced-smoke.csv');
const RUNS = path.resolve(import.meta.dirname, '../test-data/salesforce/email-bounced-smoke.runs.txt');
const HEADER = ['Scenario', 'First Name', 'Last Name', 'Email', 'Phone Number', 'Job Title', 'Department', 'Industry', 'Experience', 'LinkedIn', 'Twitter', 'Facebook', 'Website', 'Icebreaker', 'City', 'State', 'Country', 'Company', 'Company Website', 'Company Industry', 'Company Founded Year', 'Company LinkedIn', 'Deal Value', 'Note'];

type P = { first: string; last: string; phone: string; title: string; dept: string; city: string; state: string; country: string; company: string; industry: string; site: string; founded: string; deal?: string };
const p = (first: string, last: string, phone: string, title: string, dept: string, city: string, state: string, country: string, company: string, industry: string, site: string, founded: string, deal?: string): P =>
  ({ first, last, phone, title, dept, city, state, country, company, industry, site, founded, deal });

// Three people per check, the run counter picks one.
const PEOPLE: Record<number, P[]> = {
  // 1: real bounce, apostrophe in the last name, company in letters only.
  1: [
    p('Fionnuala', "O'Reilly", '+353 555-0501-1101', 'Revenue Operations Manager', 'Operations', 'Dundalk', 'Leinster', 'Ireland', 'Cooley Freight', 'Logistics', 'cooleyfreight.com', '2010'),
    p('Aoibhinn', "O'Shea", '+353 555-0501-1102', 'Director of Revenue Operations', 'Operations', 'Tralee', 'Munster', 'Ireland', 'Kerry Cargo Services', 'Logistics', 'kerrycargo.com', '2012'),
    p('Roisin', "O'Malley", '+353 555-0501-1103', 'Revenue Operations Lead', 'Operations', 'Westport', 'Connacht', 'Ireland', 'Clew Bay Haulage', 'Logistics', 'clewbayhaulage.com', '2008'),
  ],
  2: [
    p('Ingeborg', 'Halvorsen', '+47 555-0502-2201', 'Head of Marketing', 'Marketing', 'Trondheim', 'Trondelag', 'Norway', 'Nidelva Print Studio', 'Printing', 'nidelvaprint.com', '2014'),
    p('Solveig', 'Berntsen', '+47 555-0502-2202', 'Marketing Director', 'Marketing', 'Stavanger', 'Rogaland', 'Norway', 'Hafrsfjord Print House', 'Printing', 'hafrsfjordprint.com', '2011'),
    p('Astrid', 'Moen', '+47 555-0502-2203', 'Head of Brand', 'Marketing', 'Tromso', 'Troms', 'Norway', 'Polar Print Works', 'Printing', 'polarprintworks.com', '2009'),
  ],
  3: [
    p('Zsofia', 'Horvath', '+36 555-0503-3301', 'Procurement Lead', 'Procurement', 'Debrecen', 'Hajdu-Bihar', 'Hungary', 'Tisza Textiles', 'Textiles', 'tiszatextiles.com', '2007'),
    p('Eszter', 'Kovacs', '+36 555-0503-3302', 'Procurement Manager', 'Procurement', 'Szeged', 'Csongrad', 'Hungary', 'Maros Fabrics', 'Textiles', 'marosfabrics.com', '2013'),
    p('Reka', 'Szabo', '+36 555-0503-3303', 'Buying Lead', 'Procurement', 'Pecs', 'Baranya', 'Hungary', 'Mecsek Weaving Co', 'Textiles', 'mecsekweaving.com', '2006'),
  ],
  4: [
    p('Mihai', 'Popescu', '+40 555-0504-4401', 'Operations Lead', 'Operations', 'Cluj-Napoca', 'Cluj', 'Romania', 'Somes Tooling', 'Manufacturing', 'somestooling.com', '2005'),
    p('Andrei', 'Ionescu', '+40 555-0504-4402', 'Plant Operations Lead', 'Operations', 'Brasov', 'Brasov', 'Romania', 'Tampa Metalworks', 'Manufacturing', 'tampametalworks.com', '2009'),
    p('Radu', 'Stanescu', '+40 555-0504-4403', 'Operations Supervisor', 'Operations', 'Timisoara', 'Timis', 'Romania', 'Bega Machining', 'Manufacturing', 'begamachining.com', '2011'),
  ],
  5: [
    p('Wanjiru', 'Kamau', '+254 555-0505-5501', 'Purchasing Manager', 'Procurement', 'Nakuru', 'Rift Valley', 'Kenya', 'Menengai Tea Traders', 'Food', 'menengaitea.com', '2004'),
    p('Achieng', 'Otieno', '+254 555-0505-5502', 'Purchasing Lead', 'Procurement', 'Kisumu', 'Nyanza', 'Kenya', 'Winam Fish Exports', 'Food', 'winamfish.com', '2008'),
    p('Njeri', 'Mwangi', '+254 555-0505-5503', 'Purchasing Director', 'Procurement', 'Eldoret', 'Rift Valley', 'Kenya', 'Uasin Gishu Grains', 'Food', 'uasingishugrains.com', '2002'),
  ],
  6: [
    p('Thandiwe', 'Mokoena', '+27 555-0506-6601', 'Vice President of Sales', 'Sales', 'Durban', 'KwaZulu-Natal', 'South Africa', 'Umgeni Software', 'Software', 'umgenisoftware.com', '2015'),
    p('Lerato', 'Dlamini', '+27 555-0506-6602', 'VP Sales', 'Sales', 'Pretoria', 'Gauteng', 'South Africa', 'Apies Cloud Systems', 'Software', 'apiescloud.com', '2013'),
    p('Naledi', 'Khumalo', '+27 555-0506-6603', 'Sales Vice President', 'Sales', 'Bloemfontein', 'Free State', 'South Africa', 'Mangaung Digital', 'Software', 'mangaungdigital.com', '2017'),
  ],
  7: [
    p('Giulia', 'Ferrari', '+39 555-0507-7701', 'Chief Operating Officer', 'Operations', 'Verona', 'Veneto', 'Italy', 'Adige Wine Group', 'Wine', 'adigewine.com', '2001', '12000'),
    p('Chiara', 'Bianchi', '+39 555-0507-7702', 'Chief Operating Officer', 'Operations', 'Siena', 'Tuscany', 'Italy', 'Chianti Estates Trading', 'Wine', 'chiantiestates.com', '2003', '12000'),
    p('Elena', 'Moretti', '+39 555-0507-7703', 'COO', 'Operations', 'Asti', 'Piedmont', 'Italy', 'Tanaro Vineyards', 'Wine', 'tanarovineyards.com', '2000', '12000'),
  ],
  8: [
    p('Henrik', 'Lindholm', '+358 555-0508-8801', 'Commercial Director', 'Sales', 'Tampere', 'Pirkanmaa', 'Finland', 'Pyynikki Timber Co', 'Forestry', 'pyynikkitimber.com', '1998'),
    p('Mikko', 'Virtanen', '+358 555-0508-8802', 'Sales Director', 'Sales', 'Oulu', 'North Ostrobothnia', 'Finland', 'Oulujoki Wood Products', 'Forestry', 'oulujokiwood.com', '2002'),
    p('Jari', 'Koskinen', '+358 555-0508-8803', 'Commercial Manager', 'Sales', 'Kuopio', 'North Savo', 'Finland', 'Kallavesi Sawmill', 'Forestry', 'kallavesisawmill.com', '2005'),
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
    Note: n === '1' ? 'Real bounce' : '',
  };
  return HEADER.map((h) => cell(row[h] ?? '')).join(',');
});
fs.writeFileSync(OUT, `${[HEADER.join(','), ...lines].join('\n')}\n`);
console.log(`Wrote ${OUT} with ${lines.length} rows (run ${run}).`);
