// Builds test-data/pipedrive/email-bounced.csv: one new prospect for each prospect row of
// test-cases/pipedrive/email-bounced.md (32; the Trigger screen rows need none). The Scenario
// column is what the spec looks rows up by. Rows are copied from the Outcome Updated CSV for their
// columns (Deal Value and so on), then every person is replaced by a new one (src/data/generate.ts).
// Writes only email-bounced.csv.
//   node scripts/make-pipedrive-email-bounced-data.ts [--force]
import fs from 'node:fs';
import path from 'node:path';
import { generateFrom } from '../src/data/generate.ts';
import { readCsv } from '../src/data/csv.ts';

const dir = path.resolve(import.meta.dirname, '../test-data/pipedrive');
const OUT = 'pipedrive/email-bounced.csv';
const TMP = 'pipedrive/email-bounced.source.tmp.csv';
const SOURCE = 'pipedrive/prospect-outcome-updated.csv';

// [Email Bounced row, Outcome Updated row to copy the columns from]
const ROWS: Array<[string, string]> = [
  ['Trigger behavior > 2', 'Trigger behavior > 2'],
  ['Trigger behavior > 3', 'Trigger behavior > 3'],
  ['Trigger behavior > 4', 'Trigger behavior > 4'],
  ['Trigger behavior > 5', 'Trigger behavior > 5'],
  ['Create a Person > 1', 'Create a Person > 1'],
  ['Create a Person > 2', 'Create a Person > 2'],
  ['Create a Person > 3', 'Create a Person > 2'],
  ['Create a Person > 4', 'Create a Person > 3'],
  ['Update a Person > 1', 'Update a Person > 1'],
  ['Update a Person > 2', 'Update a Person > 2'],
  ['Create a Lead > 1', 'Create a Lead > 1'],
  ['Create a Lead > 2', 'Create a Lead > 2'],
  ['Create a Lead > 3', 'Create a Lead > 3'],
  ['Create a Deal > 1', 'Create a Deal > 1'],
  ['Create a Deal > 2', 'Create a Deal > 2'],
  ['Create a Deal > 3', 'Create a Deal > 3'],
  ['Update a Deal > 1', 'Update a Deal > 1'],
  ['Update a Deal > 2', 'Update a Deal > 2'],
  ['Update a Deal > 3', 'Update a Deal > 3'],
  ['Delete Deal > 1', 'Delete Deal > 1'],
  ['Delete Deal > 2', 'Delete Deal > 2'],
  ['Delete Deal > 3', 'Delete Deal > 2'],
  ['Delete Person > 1', 'Delete Person > 1'],
  ['Delete Person > 2', 'Delete Person > 2'],
  ['Create Organization > 1', 'Create Organization > 1'],
  ['Create Organization > 2', 'Create Organization > 2'],
  ['Update Organization > 1', 'Update Organization > 1'],
  ['Update Organization > 2', 'Update Organization > 2'],
  ['Delete Organization > 1', 'Delete Organization > 1'],
  ['Combined actions > 1', 'Create a Deal > 1'],
  ['Combined actions > 2', 'Update a Person > 1'],
  ['Combined actions > 3', 'Create Organization > 1'],
];

if (fs.existsSync(path.join(dir, 'email-bounced.csv')) && !process.argv.includes('--force')) {
  console.error('test-data/pipedrive/email-bounced.csv already exists. Add --force to replace it.');
  process.exit(1);
}

const source = readCsv(SOURCE);
const header = Object.keys(source[0]);
const cell = (v = '') => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const lines = ROWS.map(([name, from]) => {
  const row = source.find((r) => r['Scenario'] === from);
  if (!row) throw new Error(`No row "${from}" in test-data/${SOURCE}`);
  return header.map((h) => cell(h === 'Scenario' ? name : row[h])).join(',');
});
fs.writeFileSync(path.join(dir, 'email-bounced.source.tmp.csv'), `${[header.join(','), ...lines].join('\n')}\n`);
try {
  generateFrom(OUT, TMP);
} finally {
  fs.rmSync(path.join(dir, 'email-bounced.source.tmp.csv'), { force: true });
}

// "Prospect has no first name and no last name" (Create a Person > 4): the person is named "(No Name)".
// The real-bounce address (Trigger behavior > 5) is built in the spec, as in the HubSpot spec, so the
// CSV keeps the plain address.
const out = path.join(dir, 'email-bounced.csv');
const rows = readCsv(OUT);
const text = fs.readFileSync(out, 'utf8').split('\n');
const noName = rows.findIndex((r) => r['Scenario'] === 'Create a Person > 4');
const cols = text[0].split(',');
const cells = text[noName + 1].split(',');
cells[cols.indexOf('First Name')] = '';
cells[cols.indexOf('Last Name')] = '';
text[noName + 1] = cells.join(',');
fs.writeFileSync(out, text.join('\n'));
console.log(`Wrote test-data/${OUT} with ${rows.length} rows.`);
