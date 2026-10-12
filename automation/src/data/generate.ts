// Fresh test people for workflow CSVs, following test-data/_DATA_TEMPLATE.md.
// - generateFrom(): a new <slug>.csv from another workflow's CSV (same scenario
//   rows and setup columns, new people), plus -deals and -companies files.
// - refreshUsed(): swaps every used row of an existing CSV (emails in its
//   .used.txt) for a new person in place, fixes the -deals and -companies
//   files, and clears those emails from .used.txt. Run before every test run
//   (src/data/global-setup.ts), so QA never prepares data (QA, 2026-10-09).
// Icebreaker is left empty (QA, 2026-10-09). New names and emails are checked
// against every CSV and .used.txt in test-data/.
import fs from 'node:fs';
import path from 'node:path';
import { readCsv, type Row } from './csv.ts';

export const dataDir = path.resolve(import.meta.dirname, '../../test-data');

// The 21 template fields, in the template's order.
const TEMPLATE_FIELDS = [
  'First Name', 'Last Name', 'Email', 'Phone Number', 'Job Title', 'Department', 'Industry', 'Experience',
  'LinkedIn', 'Twitter', 'Facebook', 'Website', 'Icebreaker', 'City', 'State', 'Country', 'Company',
  'Company Website', 'Company Industry', 'Company Founded Year', 'Company LinkedIn',
];
const COMPANY_FIELDS = ['Company', 'Company Website', 'Company Industry', 'Company Founded Year', 'Company LinkedIn'];

type Place = [city: string, state: string];
type Nationality = { country: string; first: string[]; last: string[]; places: Place[] };
const NATIONALITIES: Nationality[] = [
  { country: 'United States', first: ['Caleb', 'Harper', 'Wyatt', 'Avery', 'Graham', 'Quinn', 'Reid', 'Sloane', 'Tucker', 'Brooke'], last: ['Holloway', 'Prescott', 'Whitfield', 'Bramley', 'Kensington', 'Lockhart', 'Ashby', 'Pembroke', 'Thornbury', 'Garrison'], places: [['Denver', 'Colorado'], ['Raleigh', 'North Carolina'], ['Portland', 'Oregon'], ['Madison', 'Wisconsin']] },
  { country: 'Spain', first: ['Íñigo', 'Lucía', 'Álvaro', 'Nerea', 'Gonzalo', 'Ainhoa', 'Rodrigo', 'Itziar', 'Borja', 'Maite'], last: ['Echeverría', 'Larrañaga', 'Villalobos', 'Cifuentes', 'Arrizabalaga', 'Benavides', 'Quintero', 'Olabarri', 'Valdivieso', 'Zubiaurre'], places: [['Valencia', 'Valencia'], ['Seville', 'Andalusia'], ['Zaragoza', 'Aragon'], ['Malaga', 'Andalusia']] },
  { country: 'Greece', first: ['Dimitris', 'Katerina', 'Yannis', 'Sofia', 'Kostas', 'Ioanna', 'Panagiotis', 'Despina', 'Thanos', 'Vasiliki'], last: ['Karagiannis', 'Mavridis', 'Theodorou', 'Kalogeropoulos', 'Spanos', 'Zervas', 'Galanis', 'Lamprou', 'Kontos', 'Rallis'], places: [['Athens', 'Attica'], ['Larissa', 'Thessaly'], ['Volos', 'Thessaly'], ['Ioannina', 'Epirus']] },
  { country: 'Japan', first: ['Ren', 'Yui', 'Sota', 'Hina', 'Kaito', 'Mio', 'Riku', 'Aoi', 'Yuto', 'Rina'], last: ['Takahashi', 'Morikawa', 'Ishikawa', 'Fujimoto', 'Okabe', 'Shimizu', 'Hayashida', 'Kuroda', 'Nishimura', 'Ueda'], places: [['Yokohama', 'Kanagawa'], ['Kobe', 'Hyogo'], ['Sendai', 'Miyagi'], ['Hiroshima', 'Hiroshima']] },
  { country: 'Italy', first: ['Lorenzo', 'Alessia', 'Matteo', 'Federica', 'Tommaso', 'Martina', 'Riccardo', 'Elisa', 'Davide', 'Serena'], last: ['Benedetti', 'Caruso', 'Fontanella', 'Rinaldi', 'Moretti', 'Gallo', 'Zanetti', 'Pellegrini', 'Barbieri', 'Vitale'], places: [['Florence', 'Tuscany'], ['Naples', 'Campania'], ['Genoa', 'Liguria'], ['Padua', 'Veneto']] },
  { country: 'South Korea', first: ['Do-yun', 'Ha-eun', 'Ji-woo', 'Seo-jun', 'Ye-jin', 'Hyun-woo', 'Su-bin', 'Jae-won', 'Na-rae', 'Tae-yang'], last: ['Jang', 'Shin', 'Han', 'Oh', 'Seo', 'Hwang', 'Ahn', 'Song', 'Jeon', 'Ryu'], places: [['Seoul', 'Seoul'], ['Ulsan', 'Ulsan'], ['Daegu', 'Daegu'], ['Cheongju', 'North Chungcheong']] },
  { country: 'Brazil', first: ['João', 'Larissa', 'Caio', 'Fernanda', 'Gustavo', 'Juliana', 'Leonardo', 'Mariana', 'Vinícius', 'Letícia'], last: ['Figueiredo', 'Bittencourt', 'Carvalhaes', 'Damasceno', 'Esteves', 'Guimarães', 'Lacerda', 'Moraes', 'Pimentel', 'Tavares'], places: [['Curitiba', 'Parana'], ['Salvador', 'Bahia'], ['Fortaleza', 'Ceara'], ['Campinas', 'Sao Paulo']] },
  { country: 'France', first: ['Antoine', 'Clémence', 'Baptiste', 'Manon', 'Hugo', 'Juliette', 'Théo', 'Camille', 'Louis', 'Inès'], last: ['Lefebvre', 'Moreau', 'Chevalier', 'Gauthier', 'Marchand', 'Bonnet', 'Lambert', 'Rousseau', 'Faure', 'Mercier'], places: [['Toulouse', 'Occitanie'], ['Lille', 'Hauts-de-France'], ['Strasbourg', 'Grand Est'], ['Montpellier', 'Occitanie']] },
  { country: 'India', first: ['Aditya', 'Meera', 'Kabir', 'Ananya', 'Siddharth', 'Riya', 'Varun', 'Tanvi', 'Karthik', 'Diya'], last: ['Chaturvedi', 'Menon', 'Kapoor', 'Reddy', 'Banerjee', 'Pillai', 'Joshi', 'Agarwal', 'Nair', 'Trivedi'], places: [['Bengaluru', 'Karnataka'], ['Hyderabad', 'Telangana'], ['Ahmedabad', 'Gujarat'], ['Kochi', 'Kerala']] },
  { country: 'Sweden', first: ['Elias', 'Maja', 'Viktor', 'Ebba', 'Gustav', 'Signe', 'Albin', 'Tilda', 'Hugo', 'Alva'], last: ['Ekström', 'Lundberg', 'Holmgren', 'Nyström', 'Sandberg', 'Wallin', 'Forsberg', 'Engström', 'Dahlberg', 'Hedlund'], places: [['Stockholm', 'Stockholm'], ['Gothenburg', 'Vastra Gotaland'], ['Umea', 'Vasterbotten'], ['Orebro', 'Orebro']] },
  { country: 'United Arab Emirates', first: ['Khalid', 'Mariam', 'Yousef', 'Fatima', 'Rashid', 'Huda', 'Saeed', 'Noura', 'Faisal', 'Salma'], last: ['Al-Mazrouei', 'Al-Suwaidi', 'Al-Hashimi', 'Al-Nuaimi', 'Al-Shamsi', 'Al-Ketbi', 'Al-Falasi', 'Al-Dhaheri', 'Al-Marri', 'Al-Qassimi'], places: [['Abu Dhabi', 'Abu Dhabi'], ['Sharjah', 'Sharjah'], ['Al Ain', 'Abu Dhabi'], ['Ajman', 'Ajman']] },
];

type Role = { title: string; senior: string; department: string };
const ROLES: Role[] = [
  { title: 'Account Executive', senior: 'Senior Account Executive', department: 'Sales' },
  { title: 'Sales Development Manager', senior: 'Director of Sales Development', department: 'Sales' },
  { title: 'Revenue Operations Manager', senior: 'Head of Revenue Operations', department: 'Operations' },
  { title: 'Growth Marketing Lead', senior: 'Head of Growth Marketing', department: 'Marketing' },
  { title: 'Product Manager', senior: 'Senior Product Manager', department: 'Product' },
  { title: 'Product Designer', senior: 'Lead Product Designer', department: 'Design' },
  { title: 'Data Engineer', senior: 'Senior Data Engineer', department: 'Data' },
  { title: 'Customer Success Manager', senior: 'Customer Success Director', department: 'Customer Success' },
  { title: 'Platform Engineer', senior: 'Staff Platform Engineer', department: 'Engineering' },
  { title: 'Finance Operations Manager', senior: 'Finance Operations Director', department: 'Finance' },
  { title: 'Talent Acquisition Partner', senior: 'Head of Talent Acquisition', department: 'Human Resources' },
  { title: 'Partnerships Manager', senior: 'Head of Partnerships', department: 'Partnerships' },
];

// Company pool from the template, with industry and founding year.
const COMPANIES: [name: string, industry: string, founded: number][] = [
  ['Notion', 'Productivity Software', 2013], ['Stripe', 'Financial Services', 2010], ['HubSpot', 'CRM Software', 2006],
  ['Figma', 'Design Software', 2012], ['Salesforce', 'CRM Software', 1999], ['AWS', 'Cloud Computing', 2006],
  ['Cohere', 'Artificial Intelligence', 2019], ['Gong', 'Revenue Intelligence', 2015], ['Clari', 'Revenue Platform', 2012],
  ['Outreach', 'Sales Engagement', 2014], ['Lattice', 'HR Software', 2015], ['Klaviyo', 'Marketing Automation', 2012],
  ['Amplitude', 'Product Analytics', 2012], ['Vercel', 'Developer Tools', 2015], ['Snyk', 'Cybersecurity', 2015],
  ['Grafana', 'Observability', 2014], ['HashiCorp', 'Infrastructure Software', 2012], ['dbt Labs', 'Data Software', 2016],
  ['Intercom', 'Customer Service Software', 2011], ['Zapier', 'Automation Software', 2011], ['Greenhouse', 'Recruiting Software', 2012],
  ['Contentful', 'Content Management', 2013], ['Asana', 'Work Management', 2008], ['Partnerstack', 'Partnership Software', 2015],
  ['Substack', 'Publishing', 2017], ['ChurnZero', 'Customer Success Software', 2015], ['Linear', 'Project Management Software', 2019],
  ['Productboard', 'Product Management Software', 2014], ['Shopify', 'Ecommerce', 2006], ['Brex', 'Financial Services', 2017],
];

// Lowercase ASCII with no spaces, hyphens, apostrophes or dots, for emails and URLs.
const plain = (s: string) => s.normalize('NFKD').replace(/[^A-Za-z]/g, '').toLowerCase();
const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
const shuffled = <T>(list: T[]): T[] => [...list].sort(() => Math.random() - 0.5);
const domainOf = (url = '') => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

export const usedFileOf = (csv: string) => path.join(dataDir, csv.replace(/\.csv$/, '.used.txt'));
const readUsed = (csv: string): Set<string> => {
  const file = usedFileOf(csv);
  if (!fs.existsSync(file)) return new Set();
  return new Set(fs.readFileSync(file, 'utf8').split('\n').map((l) => l.trim().toLowerCase()).filter(Boolean));
};

// Makes new people that clash with nothing already in test-data/.
class PersonFactory {
  private takenNames = new Set<string>();
  private takenEmails = new Set<string>();
  private usedFirst = new Set<string>();
  private usedLast = new Set<string>();
  private usedPhones = new Set<string>();
  private companies = shuffled(COMPANIES);

  constructor() {
    for (const file of fs.readdirSync(dataDir, { recursive: true, encoding: 'utf8' })) {
      if (file.endsWith('.used.txt')) for (const email of readUsed(file.replace(/\.used\.txt$/, '.csv'))) this.takenEmails.add(email);
      if (!file.endsWith('.csv')) continue;
      for (const row of readCsv(file)) {
        if (row['First Name']) this.takenNames.add(`${row['First Name']} ${row['Last Name']}`.toLowerCase());
        for (const key of ['Email', 'Contact Email']) if (row[key]) this.takenEmails.add(row[key].toLowerCase());
        if (row['Phone Number']) this.usedPhones.add(row['Phone Number']);
      }
    }
  }

  next(): Row {
    for (let attempt = 0; attempt < 500; attempt++) {
      const nat = pick(NATIONALITIES);
      const first = pick(nat.first);
      const last = pick(nat.last);
      const email = `${plain(first)}.${plain(last)}@mailinator.com`;
      // Unique first and last names within a run while possible; full names and emails always.
      if (attempt < 300 && (this.usedFirst.has(first) || this.usedLast.has(last))) continue;
      if (this.takenNames.has(`${first} ${last}`.toLowerCase()) || this.takenEmails.has(email)) continue;
      this.takenNames.add(`${first} ${last}`.toLowerCase());
      this.takenEmails.add(email);
      this.usedFirst.add(first);
      this.usedLast.add(last);

      let phone: string;
      do phone = `+1 555-0${100 + Math.floor(Math.random() * 900)}-${1000 + Math.floor(Math.random() * 9000)}`;
      while (this.usedPhones.has(phone));
      this.usedPhones.add(phone);

      const role = pick(ROLES);
      const [city, state] = pick(nat.places);
      if (this.companies.length === 0) this.companies = shuffled(COMPANIES);
      const [company, companyIndustry, founded] = this.companies.shift()!;
      const handle = `${plain(first)}${plain(last)}`;
      const n = 10 + Math.floor(Math.random() * 90);
      return {
        'First Name': first, 'Last Name': last, Email: email, 'Phone Number': phone,
        'Job Title': role.title, Department: role.department, Industry: companyIndustry,
        Experience: String(2 + Math.floor(Math.random() * 12)),
        LinkedIn: `https://www.linkedin.com/in/${handle}${n}/`, Twitter: `https://x.com/${handle}`,
        Facebook: `https://www.facebook.com/${plain(first)}.${plain(last)}.${n}`, Website: `https://www.${handle}.com`,
        Icebreaker: '', City: city, State: state, Country: nat.country, Company: company,
        'Company Website': `https://www.${plain(company)}.com`, 'Company Industry': companyIndustry,
        'Company Founded Year': String(founded), 'Company LinkedIn': `https://www.linkedin.com/company/${plain(company)}/`,
      };
    }
    throw new Error('Could not find a fresh name after 500 tries; add names to NATIONALITIES in src/data/generate.ts');
  }
}

// A new person in place of `old`: template fields replaced, other columns
// (Scenario, HubSpot Setup, Deal Value, ...) kept, "Updated ..." values re-made
// to fit the new person. Only columns in `header` are filled.
function replacePerson(old: Row, header: string[], factory: PersonFactory): Row {
  const person = factory.next();
  if (!old['Company']) for (const f of COMPANY_FIELDS) person[f] = '';
  const row: Row = {};
  for (const h of header) row[h] = TEMPLATE_FIELDS.includes(h) ? (person[h] ?? '') : (old[h] ?? '');
  const nat = NATIONALITIES.find((n) => n.country === person['Country'])!;
  const role = ROLES.find((r) => r.title === person['Job Title'])!;
  for (const h of header) {
    if (!old[h]) continue;
    if (/^updated job title$/i.test(h)) row[h] = role.senior;
    else if (/^second updated job title$/i.test(h)) row[h] = `Head of ${person['Department']}`;
    else if (/^updated city$/i.test(h)) {
      const [city, state] = nat.places.find(([c]) => c !== person['City'])!;
      row[h] = city;
      if (header.includes('Updated State')) row['Updated State'] = state;
    } else if (/^updated state$/i.test(h) && !old['Updated City']) row[h] = person['State'];
  }
  return row;
}

function writeCsv(csv: string, header: string[], rows: Row[]): void {
  const cell = (v = '') => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const text = [header, ...rows.map((r) => header.map((h) => r[h]))].map((r) => r.map(cell).join(',')).join('\n');
  fs.writeFileSync(path.join(dataDir, csv), `${text}\n`);
}

const headerOf = (csv: string): string[] => {
  const [first = ''] = fs.readFileSync(path.join(dataDir, csv), 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  return first.split(',').map((h) => h.trim());
};

// Points the -deals and -companies rows of replaced people at their new
// person and company. `changes` maps old email to [old row, new row].
function remapSideFiles(baseCsv: string, outCsv: string, changes: Map<string, [Row, Row]>): string[] {
  const written: string[] = [];
  for (const suffix of ['-deals', '-companies']) {
    const src = baseCsv.replace(/\.csv$/, `${suffix}.csv`);
    if (!fs.existsSync(path.join(dataDir, src))) continue;
    const out = outCsv.replace(/\.csv$/, `${suffix}.csv`);
    const rows = readCsv(src).map((row) => {
      const contact = row['Contact Email']?.toLowerCase();
      // Rows with no contact (e.g. "same domain" company) belong to the person whose company they are named after.
      const change = contact
        ? changes.get(contact)
        : [...changes.values()].find(([old]) => old['Company'] && (row['Company Name'] ?? '').startsWith(old['Company']));
      if (!change) return row;
      const [old, fresh] = change;
      const next: Row = { ...row };
      if (contact) next['Contact Email'] = fresh['Email'];
      for (const key of ['Deal Name', 'Company Name']) {
        if (next[key] && old['Company']) next[key] = next[key].replace(old['Company'], fresh['Company']);
      }
      if (next['Company Domain'] && domainOf(old['Company Website'])) {
        next['Company Domain'] = next['Company Domain'].replace(domainOf(old['Company Website']), domainOf(fresh['Company Website']));
      }
      if ('City' in next && 'State' in next && next['Company Name']) {
        next['City'] = fresh['City'];
        next['State'] = fresh['State'];
      }
      return next;
    });
    writeCsv(out, headerOf(src), rows);
    written.push(out);
  }
  return written;
}

// New <slug> CSV (and side files) from a source workflow's CSV. Paths are
// relative to test-data/, e.g. generateFrom('hubspot/reply-received.csv', 'hubspot/email-sent.csv').
export function generateFrom(outCsv: string, sourceCsv: string): string[] {
  const sourceHeader = headerOf(sourceCsv);
  const extra = sourceHeader.filter((h) => !TEMPLATE_FIELDS.includes(h));
  const lead = extra.filter((h) => sourceHeader.indexOf(h) < sourceHeader.indexOf('First Name'));
  const header = [...lead, ...TEMPLATE_FIELDS, ...extra.filter((h) => !lead.includes(h))];
  const factory = new PersonFactory();
  const changes = new Map<string, [Row, Row]>();
  const rows = readCsv(sourceCsv).map((old) => {
    const fresh = replacePerson(old, header, factory);
    if (old['Email']) changes.set(old['Email'].toLowerCase(), [old, fresh]);
    return fresh;
  });
  writeCsv(outCsv, header, rows);
  return [outCsv, ...remapSideFiles(sourceCsv, outCsv, changes)];
}

// Replaces used rows of an existing CSV in place. Returns the emails replaced.
export function refreshUsed(csv: string): string[] {
  const used = readUsed(csv);
  if (used.size === 0) return [];
  const header = headerOf(csv);
  const factory = new PersonFactory();
  const changes = new Map<string, [Row, Row]>();
  const rows = readCsv(csv).map((old) => {
    if (!used.has((old['Email'] ?? '').toLowerCase())) return old;
    const fresh = replacePerson(old, header, factory);
    changes.set(old['Email'].toLowerCase(), [old, fresh]);
    return fresh;
  });
  if (changes.size > 0) {
    writeCsv(csv, header, rows);
    remapSideFiles(csv, csv, changes);
  }
  // Emails no longer in the CSV are done with; keep any that are still there.
  const stillThere = [...used].filter((e) => !changes.has(e) && rows.some((r) => r['Email']?.toLowerCase() === e));
  fs.writeFileSync(usedFileOf(csv), stillThere.map((e) => `${e}\n`).join(''));
  return [...changes.keys()];
}

// Every CSV in test-data/ that has a .used.txt next to it.
export function csvsWithUsedRows(): string[] {
  return fs
    .readdirSync(dataDir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.used.txt'))
    .map((f) => f.replace(/\.used\.txt$/, '.csv'))
    .filter((csv) => fs.existsSync(path.join(dataDir, csv)));
}
