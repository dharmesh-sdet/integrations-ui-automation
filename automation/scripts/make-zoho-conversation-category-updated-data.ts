// Builds test-data/zoho/conversation-category-updated.csv: one new prospect for each row of
// test-cases/zoho/conversation-category-updated.md that has a prospect (19; "Trigger and category gate > 2" is a
// page check with none). The Scenario column is what the spec looks rows up by, written "<section> > <#>".
// Columns are copied from the Reply Received CSV (Deal Value 5500 on the Deal and Combined rows), then every
// person is replaced by a new one (src/data/generate.ts, all @mailinator.com).
// Writes only conversation-category-updated.csv. A row that needs a blank field (no Company) is blanked in the spec.
//   node scripts/make-zoho-conversation-category-updated-data.ts [--force]
import fs from 'node:fs';
import path from 'node:path';
import { generateFrom } from '../src/data/generate.ts';
import { readCsv } from '../src/data/csv.ts';
import { REAL_MADRID_PLAYERS } from '../src/data/real-madrid-players.ts';

const dir = path.resolve(import.meta.dirname, '../test-data/zoho');
const OUT = 'zoho/conversation-category-updated.csv';
const TMP = 'zoho/conversation-category-updated.source.tmp.csv';
const SOURCE = 'zoho/reply-received.csv';

// [Conversation Category row, Reply Received row to copy the columns from]
const ROWS: Array<[string, string]> = [
  ['Trigger and category gate > 1', 'Contact > 1'],
  ['Trigger and category gate > 3', 'Contact > 1'],
  ['Trigger and category gate > 4', 'Contact > 1'],
  ['Trigger and category gate > 5', 'Contact > 1'],
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
  ['Deal > 1', 'Deal > 1'],
  ['Deal > 2', 'Deal > 1'],
  ['Task > 1', 'Task > 1'],
  ['Task > 2', 'Task > 1'],
  ['Combined > 1', 'Combined > 1'],
];

if (fs.existsSync(path.join(dir, 'conversation-category-updated.csv')) && !process.argv.includes('--force')) {
  console.error('test-data/zoho/conversation-category-updated.csv already exists. Add --force to replace it.');
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
const tmp = path.join(dir, 'conversation-category-updated.source.tmp.csv');
fs.writeFileSync(tmp, `${[header.join(','), ...lines].join('\n')}\n`);
try {
  generateFrom(OUT, TMP);
} finally {
  fs.rmSync(tmp, { force: true });
}
// QA 2026-11-03: each prospect is a Real Madrid player (2000 to 2026). A player whose email is in any Zoho file
// (CSV or used list) is skipped, so a rerun never meets a record an earlier run made.
// Run 2026-11-03: gzoho already had iker.casillas@mailinator.com as a prospect, so each email also gets a 3-digit number.
const seen = fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), 'utf8').toLowerCase()).join('\n');
const slug = (v: string) => v.toLowerCase().replace(/[^a-z]/g, '');
const free = REAL_MADRID_PLAYERS.filter(([f, l]) => !seen.includes(`${slug(f)}.${slug(l)}`));
const rows = readCsv(OUT);
if (free.length < rows.length) throw new Error(`Only ${free.length} unused players left for ${rows.length} rows`);
const out = rows.map((row, i) => {
  const [first, last] = free[i];
  const [of, ol] = [row['First Name'], row['Last Name']];
  const swap = (v: string) =>
    v.split(`${slug(of)}.${slug(ol)}`).join(`${slug(first)}.${slug(last)}`)
      .split(`${slug(of)}${slug(ol)}`).join(`${slug(first)}${slug(last)}`);
  const next: Record<string, string> = {};
  for (const h of header) next[h] = swap(row[h] ?? '');
  next['First Name'] = first;
  next['Last Name'] = last;
  next['Email'] = `${slug(first)}.${slug(last)}${100 + Math.floor(Math.random() * 900)}@mailinator.com`;
  return header.map((h) => cell(next[h])).join(',');
});
fs.writeFileSync(path.join(dir, 'conversation-category-updated.csv'), `${[header.join(','), ...out].join('\n')}\n`);
console.log(`Wrote test-data/${OUT} with ${rows.length} rows.`);
