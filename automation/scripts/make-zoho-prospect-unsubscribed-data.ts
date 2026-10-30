// Builds test-data/zoho/prospect-unsubscribed.csv: one new prospect for each row of
// test-cases/zoho/prospect-unsubscribed.md that unsubscribes one (19; "Trigger and setup > 2" only reloads the page).
// The Scenario column is what the spec looks rows up by, written "<section> > <#>". Columns are copied from the
// Reply Received CSV (Deal Value on the Deal and Combined rows), then every person is replaced by a new one
// (src/data/generate.ts, all @mailinator.com). Rows 4 to 6 of Trigger and setup unsubscribe by the real link, so
// they use the Mailinator inbox of their own address. Writes only prospect-unsubscribed.csv. A row that needs a
// blank field (no Company) is blanked in the spec.
//   node scripts/make-zoho-prospect-unsubscribed-data.ts [--force]
import fs from 'node:fs';
import path from 'node:path';
import { generateFrom } from '../src/data/generate.ts';
import { readCsv } from '../src/data/csv.ts';

const dir = path.resolve(import.meta.dirname, '../test-data/zoho');
const OUT = 'zoho/prospect-unsubscribed.csv';
const TMP = 'zoho/prospect-unsubscribed.source.tmp.csv';
const SOURCE = 'zoho/reply-received.csv';

// [Prospect Unsubscribed row, Reply Received row to copy the columns from]
const ROWS: Array<[string, string]> = [
  ['Trigger and setup > 1', 'Contact > 1'],
  ['Trigger and setup > 3', 'Contact > 1'],
  ['Trigger and setup > 4', 'Contact > 1'],
  ['Trigger and setup > 5', 'Contact > 1'],
  ['Trigger and setup > 6', 'Contact > 1'],
  ['Contact > 1', 'Contact > 1'],
  ['Contact > 2', 'Contact > 1'],
  ['Contact > 3', 'Contact > 1'],
  ['Lead > 1', 'Lead > 1'],
  ['Lead > 2', 'Lead > 1'],
  ['Lead > 3', 'Lead > 1'],
  ['Account > 1', 'Account > 1'],
  ['Account > 2', 'Account > 1'],
  ['Deal > 1', 'Deal > 1'],
  ['Deal > 2', 'Deal > 1'],
  ['Deal > 3', 'Deal > 1'],
  ['Task > 1', 'Task > 1'],
  ['Task > 2', 'Task > 1'],
  ['Combined > 1', 'Combined > 1'],
];

if (fs.existsSync(path.join(dir, 'prospect-unsubscribed.csv')) && !process.argv.includes('--force')) {
  console.error('test-data/zoho/prospect-unsubscribed.csv already exists. Add --force to replace it.');
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
const tmp = path.join(dir, 'prospect-unsubscribed.source.tmp.csv');
fs.writeFileSync(tmp, `${[header.join(','), ...lines].join('\n')}\n`);
try {
  generateFrom(OUT, TMP);
} finally {
  fs.rmSync(tmp, { force: true });
}
console.log(`Wrote test-data/${OUT} with ${readCsv(OUT).length} rows.`);
