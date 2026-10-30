// Builds test-data/zoho/email-bounced.csv: one new prospect for each row of test-cases/zoho/email-bounced.md that
// bounces an email (22; "Trigger and setup > 2" bounces nothing). The Scenario column is what the spec looks rows
// up by, written "<section> > <#>". Columns are copied from the Reply Received CSV (Deal Value 5500 on the Deal
// and Combined rows), then every person is replaced by a new one (src/data/generate.ts, all @mailinator.com).
// Writes only email-bounced.csv. A row that needs a blank field (no Company) is blanked in the spec; the one
// real-bounce row (Trigger and setup > 4) gets its @<company>.mailinator.com address in the spec.
//   node scripts/make-zoho-email-bounced-data.ts [--force]
import fs from 'node:fs';
import path from 'node:path';
import { generateFrom } from '../src/data/generate.ts';
import { readCsv } from '../src/data/csv.ts';

const dir = path.resolve(import.meta.dirname, '../test-data/zoho');
const OUT = 'zoho/email-bounced.csv';
const TMP = 'zoho/email-bounced.source.tmp.csv';
const SOURCE = 'zoho/reply-received.csv';

// [Email Bounced row, Reply Received row to copy the columns from]
const ROWS: Array<[string, string]> = [
  ['Trigger and setup > 1', 'Contact > 1'],
  ['Trigger and setup > 3', 'Contact > 1'],
  ['Trigger and setup > 4', 'Contact > 1'],
  ['Contact > 1', 'Contact > 1'],
  ['Contact > 2', 'Contact > 1'],
  ['Contact > 3', 'Contact > 1'],
  ['Contact > 4', 'Contact > 1'],
  ['Lead > 1', 'Lead > 1'],
  ['Lead > 2', 'Lead > 1'],
  ['Lead > 3', 'Lead > 1'],
  ['Account > 1', 'Account > 1'],
  ['Account > 2', 'Account > 1'],
  ['Account > 3', 'Account > 1'],
  ['Account > 4', 'Account > 1'],
  ['Deal > 1', 'Deal > 1'],
  ['Deal > 2', 'Deal > 1'],
  ['Deal > 3', 'Deal > 1'],
  ['Deal > 4', 'Deal > 1'],
  ['Task > 1', 'Task > 1'],
  ['Task > 2', 'Task > 1'],
  ['Task > 3', 'Task > 1'],
  ['Combined > 1', 'Combined > 1'],
];

if (fs.existsSync(path.join(dir, 'email-bounced.csv')) && !process.argv.includes('--force')) {
  console.error('test-data/zoho/email-bounced.csv already exists. Add --force to replace it.');
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
const tmp = path.join(dir, 'email-bounced.source.tmp.csv');
fs.writeFileSync(tmp, `${[header.join(','), ...lines].join('\n')}\n`);
try {
  generateFrom(OUT, TMP);
} finally {
  fs.rmSync(tmp, { force: true });
}
console.log(`Wrote test-data/${OUT} with ${readCsv(OUT).length} rows.`);
