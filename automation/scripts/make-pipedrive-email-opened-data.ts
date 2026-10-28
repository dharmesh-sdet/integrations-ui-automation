// Builds test-data/pipedrive/email-opened.csv: one new prospect for each prospect of
// test-cases/pipedrive/email-opened.md. A row that opens the email a second time makes its first open
// itself, so each row runs alone. The Scenario column is what the spec looks rows up by.
// Rows are copied from the Reply Received CSV for their columns (Deal Value and so on), then every
// person is replaced by a new one (src/data/generate.ts). Writes only email-opened.csv.
//   node scripts/make-pipedrive-email-opened-data.ts [--force]
import fs from 'node:fs';
import path from 'node:path';
import { generateFrom } from '../src/data/generate.ts';
import { readCsv } from '../src/data/csv.ts';

const dir = path.resolve(import.meta.dirname, '../test-data/pipedrive');
const OUT = 'pipedrive/email-opened.csv';
const TMP = 'pipedrive/email-opened.source.tmp.csv';
const SOURCE = 'pipedrive/reply-received.csv';

// [Email Opened row, Reply Received row to copy the columns from]
const ROWS: Array<[string, string]> = [
  ['Trigger behavior > 2', 'Create a Person > 1'],
  ['Trigger behavior > 3', 'Create a Person > 1'],
  ['Trigger behavior > 4', 'Create a Person > 1'],
  ['Create a Person > 1', 'Create a Person > 1'],
  ['Create a Person > 2', 'Create a Person > 2'],
  ['Create a Lead > 1', 'Create a Lead > 1'],
  ['Create a Lead > 2', 'Create a Lead > 2'],
  ['Create a Deal > 1', 'Create a Deal > 1'],
  ['Create a Deal > 2', 'Create a Deal > 2'],
  ['Create a Deal > 3', 'Create a Deal > 1'],
  ['Update a Person > 1', 'Update a Person > 1'],
  ['Update a Person > 2', 'Update a Person > 2'],
  ['Update a Deal > 1', 'Update a Deal > 1'],
  ['Update a Deal > 2', 'Update a Deal > 2'],
  ['Update a Deal > 3', 'Update a Deal > 3'],
  ['Delete Deal > 1', 'Delete Deal > 1'],
  ['Delete Deal > 2', 'Delete Deal > 2'],
  ['Delete Person > 1', 'Delete Person > 1'],
  ['Delete Person > 2', 'Delete Person > 2'],
  ['Create Organization > 1', 'Create Organization > 1'],
  ['Create Organization > 2', 'Create Organization > 2'],
  ['Update Organization > 1', 'Update Organization > 1'],
  ['Update Organization > 2', 'Update Organization > 3'],
  ['Delete Organization > 1', 'Delete Organization > 1'],
  ['Combined actions > 1', 'Combined actions > 1'],
  ['Combined actions > 2', 'Combined actions > 2'],
];

if (fs.existsSync(path.join(dir, 'email-opened.csv')) && !process.argv.includes('--force')) {
  console.error('test-data/pipedrive/email-opened.csv already exists. Add --force to replace it.');
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
fs.writeFileSync(path.join(dir, 'email-opened.source.tmp.csv'), `${[header.join(','), ...lines].join('\n')}\n`);
try {
  generateFrom(OUT, TMP);
} finally {
  fs.rmSync(path.join(dir, 'email-opened.source.tmp.csv'), { force: true });
}
console.log(`Wrote test-data/${OUT} with ${readCsv(OUT).length} rows.`);
