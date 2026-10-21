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
import { EXTRA_NATIONALITIES, type Nationality } from './countries.ts';

export const dataDir = path.resolve(import.meta.dirname, '../../test-data');

// The 21 template fields, in the template's order.
const TEMPLATE_FIELDS = [
  'First Name', 'Last Name', 'Email', 'Phone Number', 'Job Title', 'Department', 'Industry', 'Experience',
  'LinkedIn', 'Twitter', 'Facebook', 'Website', 'Icebreaker', 'City', 'State', 'Country', 'Company',
  'Company Website', 'Company Industry', 'Company Founded Year', 'Company LinkedIn',
];
const COMPANY_FIELDS = ['Company', 'Company Website', 'Company Industry', 'Company Founded Year', 'Company LinkedIn'];

export const NATIONALITIES: Nationality[] = [
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
  // Added 2026-10-13 (QA): the 11 countries above were reused by every CSV and
  // kept producing people HubSpot already holds. New people come only from the
  // countries below (see RETIRED_COUNTRIES); none of them is in any CSV yet.
  { country: 'Turkey', first: ['Emre', 'Zeynep', 'Burak', 'Elif', 'Kaan', 'Defne', 'Mert', 'Selin', 'Onur', 'Ceren'], last: ['Yildirim', 'Kaplan', 'Aydin', 'Demirci', 'Ozkan', 'Tekin', 'Korkmaz', 'Uysal', 'Bozkurt', 'Gunes'], places: [['Istanbul', 'Istanbul'], ['Ankara', 'Ankara'], ['Izmir', 'Izmir'], ['Bursa', 'Bursa']] },
  { country: 'Portugal', first: ['Tiago', 'Beatriz', 'Duarte', 'Matilde', 'Salvador', 'Leonor', 'Rúben', 'Mafalda', 'Simão', 'Catarina'], last: ['Barbosa', 'Cardoso', 'Furtado', 'Nogueira', 'Sequeira', 'Valente', 'Teixeira', 'Pestana', 'Vasconcelos', 'Albuquerque'], places: [['Lisbon', 'Lisbon'], ['Porto', 'Porto'], ['Braga', 'Braga'], ['Coimbra', 'Coimbra']] },
  { country: 'Netherlands', first: ['Daan', 'Fleur', 'Bram', 'Sanne', 'Jesse', 'Lotte', 'Thijs', 'Noor', 'Ruben', 'Femke'], last: ['Vermeulen', 'Bakker', 'Hendriks', 'Mulder', 'Dekker', 'Verhoeven', 'Smits', 'Kuipers', 'Brouwer', 'Visser'], places: [['Amsterdam', 'North Holland'], ['Utrecht', 'Utrecht'], ['Rotterdam', 'South Holland'], ['Eindhoven', 'North Brabant']] },
  { country: 'Finland', first: ['Aatu', 'Ilona', 'Eino', 'Venla', 'Onni', 'Aino', 'Veeti', 'Helmi', 'Leevi', 'Siiri'], last: ['Korhonen', 'Virtanen', 'Laaksonen', 'Niemi', 'Heikkinen', 'Koskinen', 'Lehtonen', 'Salmela', 'Rantanen', 'Jokinen'], places: [['Helsinki', 'Uusimaa'], ['Tampere', 'Pirkanmaa'], ['Turku', 'Southwest Finland'], ['Oulu', 'North Ostrobothnia']] },
  { country: 'Argentina', first: ['Joaquín', 'Valentina', 'Facundo', 'Agustina', 'Santiago', 'Camila', 'Nicolás', 'Milagros', 'Bautista', 'Florencia'], last: ['Gutiérrez', 'Sosa', 'Acosta', 'Benítez', 'Cabrera', 'Domínguez', 'Medina', 'Peralta', 'Rojas', 'Ledesma'], places: [['Buenos Aires', 'Buenos Aires'], ['Córdoba', 'Córdoba'], ['Rosario', 'Santa Fe'], ['Mendoza', 'Mendoza']] },
  { country: 'Vietnam', first: ['Minh', 'Linh', 'Quang', 'Thao', 'Hieu', 'Trang', 'Khoa', 'Huong', 'Phuc', 'Ngoc'], last: ['Nguyen', 'Tran', 'Pham', 'Hoang', 'Vu', 'Dang', 'Bui', 'Do', 'Ngo', 'Truong'], places: [['Hanoi', 'Hanoi'], ['Da Nang', 'Da Nang'], ['Ho Chi Minh City', 'Ho Chi Minh'], ['Hue', 'Thua Thien Hue']] },
  { country: 'Kenya', first: ['Wanjiru', 'Kipchoge', 'Achieng', 'Otieno', 'Njeri', 'Kamau', 'Atieno', 'Mwangi', 'Chebet', 'Omondi'], last: ['Kariuki', 'Mutiso', 'Odhiambo', 'Wekesa', 'Cheruiyot', 'Nyaga', 'Kimani', 'Onyango', 'Rotich', 'Waweru'], places: [['Nairobi', 'Nairobi'], ['Mombasa', 'Mombasa'], ['Kisumu', 'Kisumu'], ['Nakuru', 'Nakuru']] },
  { country: 'Thailand', first: ['Somchai', 'Nattaya', 'Kritsada', 'Pimchanok', 'Thanakorn', 'Warunee', 'Chaiwat', 'Suda', 'Arthit', 'Malee'], last: ['Wongsakul', 'Chaiyasit', 'Srisuk', 'Boonmee', 'Jaidee', 'Rattanakul', 'Prasert', 'Kaewmanee', 'Sukhum', 'Thongchai'], places: [['Bangkok', 'Bangkok'], ['Chiang Mai', 'Chiang Mai'], ['Phuket', 'Phuket'], ['Khon Kaen', 'Khon Kaen']] },
  // Added 2026-10-19: the pool above was exhausted (the generator's ledger of
  // every email it has ever issued, test-data/_generated-emails.txt, never
  // prunes, so a heavily-used pool runs dry over time). Purely additive.
  { country: 'Georgia', first: ['Giorgi', 'Nino', 'Luka', 'Tamar', 'Nika', 'Mariam', 'Davit', 'Ana', 'Irakli', 'Salome'], last: ['Beridze', 'Kapanadze', 'Gelashvili', 'Tsiklauri', 'Managadze', 'Kiknadze', 'Natadze', 'Jorbenadze', 'Lomidze', 'Abashidze'], places: [['Tbilisi', 'Tbilisi'], ['Batumi', 'Adjara'], ['Kutaisi', 'Imereti'], ['Rustavi', 'Kvemo Kartli']] },
  { country: 'Armenia', first: ['Narek', 'Anahit', 'Armen', 'Lilit', 'Vahan', 'Siranush', 'Davit', 'Mariam', 'Gor', 'Araksya'], last: ['Grigoryan', 'Sargsyan', 'Hakobyan', 'Petrosyan', 'Avetisyan', 'Mkrtchyan', 'Harutyunyan', 'Minasyan', 'Karapetyan', 'Ghazaryan'], places: [['Yerevan', 'Yerevan'], ['Gyumri', 'Shirak'], ['Vanadzor', 'Lori'], ['Dilijan', 'Tavush']] },
  { country: 'Azerbaijan', first: ['Elvin', 'Gunel', 'Rashad', 'Aysel', 'Tural', 'Lamiya', 'Orkhan', 'Nigar', 'Farid', 'Sevinj'], last: ['Mammadov', 'Aliyev', 'Huseynov', 'Ismayilov', 'Quliyev', 'Rzayev', 'Abbasov', 'Hasanov', 'Nabiyev', 'Jafarov'], places: [['Baku', 'Baku'], ['Ganja', 'Ganja'], ['Sumqayit', 'Absheron'], ['Shaki', 'Shaki-Zaqatala']] },
  { country: 'Albania', first: ['Arben', 'Mirela', 'Besnik', 'Elona', 'Gentian', 'Flutura', 'Ardit', 'Vjosa', 'Dritan', 'Blerina'], last: ['Hoxha', 'Krasniqi', 'Berisha', 'Gashi', 'Shala', 'Dervishi', 'Meta', 'Lleshi', 'Shehu', 'Bardhi'], places: [['Tirana', 'Tirana'], ['Durres', 'Durres'], ['Vlore', 'Vlore'], ['Shkoder', 'Shkoder']] },
  { country: 'North Macedonia', first: ['Aleksandar', 'Biljana', 'Filip', 'Elena', 'Stefan', 'Jovana', 'Martin', 'Dragana', 'Goran', 'Snezana'], last: ['Trajkovski', 'Petrovski', 'Nikolovski', 'Stojanovski', 'Ristovski', 'Kostovski', 'Angelovski', 'Jovanovski', 'Dimitrovski', 'Ivanovski'], places: [['Skopje', 'Skopje'], ['Bitola', 'Pelagonia'], ['Ohrid', 'Southwest'], ['Tetovo', 'Polog']] },
  { country: 'Bosnia and Herzegovina', first: ['Amar', 'Amina', 'Haris', 'Lejla', 'Emir', 'Dzenana', 'Tarik', 'Emina', 'Adnan', 'Selma'], last: ['Hodzic', 'Begic', 'Mehmedovic', 'Alic', 'Kovacevic', 'Ibrahimovic', 'Suljic', 'Halilovic', 'Delic', 'Causevic'], places: [['Sarajevo', 'Sarajevo'], ['Mostar', 'Herzegovina-Neretva'], ['Tuzla', 'Tuzla'], ['Banja Luka', 'Republika Srpska']] },
  { country: 'Zimbabwe', first: ['Tendai', 'Rutendo', 'Tapiwa', 'Chiedza', 'Farai', 'Nyasha', 'Tatenda', 'Rumbidzai', 'Kudzai', 'Vimbai'], last: ['Moyo', 'Ncube', 'Dube', 'Sibanda', 'Mutasa', 'Chikwava', 'Gumbo', 'Mapfumo', 'Chirwa', 'Mangwiro'], places: [['Harare', 'Harare'], ['Bulawayo', 'Bulawayo'], ['Mutare', 'Manicaland'], ['Gweru', 'Midlands']] },
  { country: 'Uganda', first: ['Moses', 'Grace', 'Joseph', 'Harriet', 'Simon', 'Betty', 'Daniel', 'Patience', 'Isaac', 'Immaculate'], last: ['Mugisha', 'Ssemwogerere', 'Kato', 'Nansubuga', 'Okello', 'Nakimuli', 'Byaruhanga', 'Namuli', 'Tumusiime', 'Kyomugisha'], places: [['Kampala', 'Central'], ['Gulu', 'Northern'], ['Mbarara', 'Western'], ['Jinja', 'Eastern']] },
];

// 2026-10-13 (QA): many more countries, so new people do not match anyone
// HubSpot already holds. See countries.ts.
NATIONALITIES.push(...EXTRA_NATIONALITIES);

// Countries of the people made before 2026-10-13. Kept in NATIONALITIES because
// refreshUsed looks an existing row's country up there, but not used for new people.
const RETIRED_COUNTRIES = new Set(['United States', 'Spain', 'Greece', 'Japan', 'Italy', 'South Korea', 'Brazil', 'France', 'India', 'Sweden', 'United Arab Emirates']);
const FRESH_NATIONALITIES = NATIONALITIES.filter((n) => !RETIRED_COUNTRIES.has(n.country));

export type Role = { title: string; senior: string; department: string };
export const ROLES: Role[] = [
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
  // Added 2026-10-20 (QA): a wider spread, so rows in one CSV rarely share a title.
  { title: 'Security Engineer', senior: 'Principal Security Engineer', department: 'Security' },
  { title: 'Content Marketing Manager', senior: 'Director of Content Marketing', department: 'Marketing' },
  { title: 'Solutions Architect', senior: 'Principal Solutions Architect', department: 'Pre-Sales' },
  { title: 'Legal Counsel', senior: 'Associate General Counsel', department: 'Legal' },
  { title: 'Business Analyst', senior: 'Lead Business Analyst', department: 'Strategy' },
  { title: 'Support Engineer', senior: 'Senior Support Engineer', department: 'Support' },
  { title: 'QA Engineer', senior: 'Staff QA Engineer', department: 'Engineering' },
  { title: 'Procurement Specialist', senior: 'Head of Procurement', department: 'Procurement' },
  { title: 'Demand Generation Manager', senior: 'Director of Demand Generation', department: 'Marketing' },
  { title: 'IT Administrator', senior: 'IT Operations Manager', department: 'IT' },
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

// Every email this generator ever made, one per line. Created records stay in
// HubSpot after a row leaves its CSV, so a new person must never repeat one
// (QA, 2026-10-13: "the data will not be matched").
const ledgerFile = path.join(dataDir, '_generated-emails.txt');
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
  private usedCountries = new Set<string>();
  private usedRoles = new Set<string>();
  private usedPhones = new Set<string>();
  private companies = shuffled(COMPANIES);

  constructor() {
    if (fs.existsSync(ledgerFile)) {
      for (const line of fs.readFileSync(ledgerFile, 'utf8').split('\n')) if (line.trim()) this.takenEmails.add(line.trim().toLowerCase());
    }
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
    for (let attempt = 0; attempt < 600; attempt++) {
      const nat = pick(FRESH_NATIONALITIES);
      const first = pick(nat.first);
      const last = pick(nat.last);
      const email = `${plain(first)}.${plain(last)}@mailinator.com`;
      const role = pick(ROLES);
      // Unique first and last names, country and job title within a run while
      // possible (a wide spread of data per CSV, QA 2026-10-20); full names and emails always.
      // Strictest first: when countries run out of unused names, the country
      // rule drops before the job title rule.
      if (attempt < 150 && (this.usedFirst.has(first) || this.usedLast.has(last) || this.usedCountries.has(nat.country) || this.usedRoles.has(role.title))) continue;
      if (attempt < 300 && (this.usedFirst.has(first) || this.usedLast.has(last) || this.usedRoles.has(role.title))) continue;
      if (this.takenNames.has(`${first} ${last}`.toLowerCase()) || this.takenEmails.has(email)) continue;
      this.takenNames.add(`${first} ${last}`.toLowerCase());
      this.takenEmails.add(email);
      fs.appendFileSync(ledgerFile, `${email}\n`);
      this.usedFirst.add(first);
      this.usedLast.add(last);
      this.usedCountries.add(nat.country);
      this.usedRoles.add(role.title);

      let phone: string;
      do phone = `+1 555-0${100 + Math.floor(Math.random() * 900)}-${1000 + Math.floor(Math.random() * 9000)}`;
      while (this.usedPhones.has(phone));
      this.usedPhones.add(phone);

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
    throw new Error('Could not find a fresh name after 600 tries; add names to NATIONALITIES in src/data/generate.ts');
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
  return replaceRows(csv, (email) => used.has(email));
}

// Replaces EVERY row of an existing CSV (and its -deals and -companies files)
// with new people (QA, 2026-10-13: each run starts with all-new data).
export function refreshAll(csv: string): string[] {
  return replaceRows(csv, () => true);
}

function replaceRows(csv: string, shouldReplace: (email: string) => boolean): string[] {
  const used = readUsed(csv);
  const header = headerOf(csv);
  const factory = new PersonFactory();
  const changes = new Map<string, [Row, Row]>();
  const rows = readCsv(csv).map((old) => {
    const email = (old['Email'] ?? '').toLowerCase();
    if (!email || !shouldReplace(email)) return old;
    const fresh = replacePerson(old, header, factory);
    changes.set(email, [old, fresh]);
    return fresh;
  });
  if (changes.size > 0) {
    writeCsv(csv, header, rows);
    remapSideFiles(csv, csv, changes);
  }
  // Emails no longer in the CSV are done with; keep any that are still there.
  const stillThere = [...used].filter((e) => !changes.has(e) && rows.some((r) => r['Email']?.toLowerCase() === e));
  if (used.size > 0 || changes.size > 0) fs.writeFileSync(usedFileOf(csv), stillThere.map((e) => `${e}\n`).join(''));
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
