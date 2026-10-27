// Builds test-data/pipedrive/prospect-outcome-updated-smoke.csv: the 9 staging rows the production
// smoke run sends to (notes/production-testing/10-pipedrive-prospect-outcome-updated.md), header
// included. The Scenario column keeps the staging row name, which the smoke spec looks rows up by.
// The people are replaced with new ones at the start of every run (src/data/global-setup.ts).
//   node scripts/make-pipedrive-outcome-updated-smoke-data.ts
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(import.meta.dirname, '../test-data/pipedrive');
const SCENARIOS = [
  'Trigger behavior > 6',
  'Update a Deal > 1',
  'Update a Person > 1',
  'Delete Deal > 1',
  'Delete Person > 1',
  'Create Organization > 1',
  'Update Organization > 1',
  'Delete Organization > 1',
  'Create a Person > 3',
];

const lines = fs.readFileSync(path.join(dir, 'prospect-outcome-updated.csv'), 'utf8').split('\n');
const picked = SCENARIOS.map((name) => {
  const line = lines.find((l) => l.startsWith(`${name},`));
  if (!line) throw new Error(`No row "${name}" in test-data/pipedrive/prospect-outcome-updated.csv`);
  return line;
});
fs.writeFileSync(path.join(dir, 'prospect-outcome-updated-smoke.csv'), `${[lines[0], ...picked].join('\n')}\n`);
console.log(`Wrote test-data/pipedrive/prospect-outcome-updated-smoke.csv with ${picked.length} rows.`);
