// Builds test-data/zoho/email-opened-smoke.csv: one new prospect for each of the 7 checks of
// notes/production-testing/16-zoho-email-opened.md. The Scenario column is what the smoke spec looks rows up by,
// written "Smoke > <#>". Columns are copied from the Zoho Reply Received CSV (the same source as the staging
// Email Opened data), then every person is replaced by a new one (src/data/generate.ts, all @mailinator.com).
// Needs test-data/zoho/reply-received.csv. Writes only email-opened-smoke.csv (gitignored).
//   node scripts/make-zoho-email-opened-smoke-data.ts [--force]
import fs from 'node:fs';
import path from 'node:path';
import { generateFrom } from '../src/data/generate.ts';
import { readCsv } from '../src/data/csv.ts';

const dir = path.resolve(import.meta.dirname, '../test-data/zoho');
const OUT = 'zoho/email-opened-smoke.csv';
const TMP = 'zoho/email-opened-smoke.source.tmp.csv';
const SOURCE = 'zoho/reply-received.csv';

// [smoke check, Reply Received row to copy the columns from]
const ROWS: Array<[string, string]> = [
  ['Smoke > 1', 'Contact > 1'],
  ['Smoke > 2', 'Contact > 1'],
  ['Smoke > 3', 'Contact > 1'],
  ['Smoke > 4', 'Lead > 1'],
  ['Smoke > 5', 'Account > 1'],
  ['Smoke > 6', 'Deal > 1'],
  ['Smoke > 7', 'Task > 1'],
];

if (fs.existsSync(path.join(dir, 'email-opened-smoke.csv')) && !process.argv.includes('--force')) {
  console.error('test-data/zoho/email-opened-smoke.csv already exists. Add --force to replace it.');
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
const tmp = path.join(dir, 'email-opened-smoke.source.tmp.csv');
fs.writeFileSync(tmp, `${[header.join(','), ...lines].join('\n')}\n`);
try {
  generateFrom(OUT, TMP);
} finally {
  fs.rmSync(tmp, { force: true });
}
console.log(`Wrote test-data/${OUT} with ${readCsv(OUT).length} rows.`);
