// Builds test-data/pipedrive/reply-received-smoke.csv: the 9 staging rows the production smoke run
// uses (notes/production-testing/15-pipedrive-reply-received.md), header included. The Scenario column keeps
// the staging row name, which the smoke spec looks rows up by.
// The people are replaced with new ones at the start of every run (src/data/global-setup.ts).
//   node scripts/make-pipedrive-reply-received-smoke-data.ts
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(import.meta.dirname, '../test-data/pipedrive');
const SCENARIOS = [
  'Combined actions > 1',
  'Create a Person > 2',
  'Update a Person > 1',
  'Update a Deal > 1',
  'Delete Deal > 1',
  'Delete Person > 1',
  'Create Organization > 3',
  'Update Organization > 1',
  'Delete Organization > 1',
];

const lines = fs.readFileSync(path.join(dir, 'reply-received.csv'), 'utf8').split('\n');
const picked = SCENARIOS.map((name) => {
  const line = lines.find((l) => l.startsWith(`${name},`));
  if (!line) throw new Error(`No row "${name}" in test-data/pipedrive/reply-received.csv. Generate the staging data first.`);
  return line;
});
fs.writeFileSync(path.join(dir, 'reply-received-smoke.csv'), `${[lines[0], ...picked].join('\n')}\n`);
console.log(`Wrote test-data/pipedrive/reply-received-smoke.csv with ${picked.length} rows.`);
