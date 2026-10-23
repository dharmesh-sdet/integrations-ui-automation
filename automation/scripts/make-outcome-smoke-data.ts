// Builds test-data/salesforce/prospect-outcome-updated-smoke.csv: the 10 staging rows the
// production smoke run uses (notes/production-testing/08-salesforce-prospect-outcome-updated.md),
// header included. The Scenario column keeps the staging row name, which the smoke spec looks
// rows up by. The people are replaced with new ones at the start of every run
// (src/data/global-setup.ts).
//   node scripts/make-outcome-smoke-data.ts
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(import.meta.dirname, '../test-data/salesforce');
const SCENARIOS = [
  'Create a Account in Salesforce > 1',
  'Update a Account in Salesforce > 1',
  'Create a Contact in Salesforce > 1',
  'Create a Contact in Salesforce > 2',
  'Update a Contact in Salesforce > 1',
  'Create a Lead in Salesforce > 1',
  'Update a Lead in Salesforce > 1',
  'Create a Opportunity in Salesforce > 1',
  'Update a Opportunity in Salesforce > 1',
  'Record(log) an Email Activity in Salesforce > 1',
];

const lines = fs.readFileSync(path.join(dir, 'prospect-outcome-updated.csv'), 'utf8').split('\n');
const picked = SCENARIOS.map((name) => {
  const line = lines.find((l) => l.startsWith(`${name},`));
  if (!line) throw new Error(`No row "${name}" in test-data/salesforce/prospect-outcome-updated.csv`);
  return line;
});
fs.writeFileSync(path.join(dir, 'prospect-outcome-updated-smoke.csv'), `${[lines[0], ...picked].join('\n')}\n`);
console.log(`Wrote test-data/salesforce/prospect-outcome-updated-smoke.csv with ${picked.length} rows.`);
