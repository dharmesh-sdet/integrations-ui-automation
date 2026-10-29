// Builds test-data/pipedrive/unsubscribed-smoke.csv: the 10 staging rows the production smoke run
// uses (notes/production-testing/14-pipedrive-unsubscribed.md), header included. The Scenario column keeps
// the staging row name, which the smoke spec looks rows up by.
// The people are replaced with new ones at the start of every run (src/data/global-setup.ts).
//   node scripts/make-pipedrive-unsubscribed-smoke-data.ts
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(import.meta.dirname, '../test-data/pipedrive');
const SCENARIOS = [
  'Combined actions > 1',
  'Create a Deal > 3',
  'Create a Deal > 2',
  'Update a Person > 1',
  'Update a Deal > 1',
  'Delete Deal > 1',
  'Delete Person > 1',
  'Create Organization > 1',
  'Update Organization > 1',
  'Delete Organization > 1',
];

const lines = fs.readFileSync(path.join(dir, 'prospect-unsubscribed.csv'), 'utf8').split('\n');
const picked = SCENARIOS.map((name) => {
  const line = lines.find((l) => l.startsWith(`${name},`));
  if (!line) throw new Error(`No row "${name}" in test-data/pipedrive/prospect-unsubscribed.csv. Generate the staging data first.`);
  return line;
});
fs.writeFileSync(path.join(dir, 'unsubscribed-smoke.csv'), `${[lines[0], ...picked].join('\n')}\n`);
console.log(`Wrote test-data/pipedrive/unsubscribed-smoke.csv with ${picked.length} rows.`);
