// Builds test-data/salesforce/email-sent-smoke.csv: the 8 staging rows the production smoke
// run sends to (notes/production-testing/07-salesforce-email-sent.md), header included.
// The Scenario column keeps the staging row name, which the smoke spec looks rows up by.
// The people are replaced with new ones at the start of every run (src/data/global-setup.ts).
//   node scripts/make-email-sent-smoke-data.ts
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(import.meta.dirname, '../test-data/salesforce');
const SCENARIOS = [
  'Create an Account in Salesforce > 1',
  'Update an Account in Salesforce > 1',
  'Create a Contact in Salesforce > 1',
  'Update a Contact in Salesforce > 1',
  'Create a Lead in Salesforce > 1',
  'Update a Lead in Salesforce > 1',
  'Create a Opportunity in Salesforce > 4',
  'Update a Opportunity in Salesforce > 2',
];

const lines = fs.readFileSync(path.join(dir, 'email-sent.csv'), 'utf8').split('\n');
const picked = SCENARIOS.map((name) => {
  const line = lines.find((l) => l.startsWith(`${name},`));
  if (!line) throw new Error(`No row "${name}" in test-data/salesforce/email-sent.csv`);
  return line;
});
fs.writeFileSync(path.join(dir, 'email-sent-smoke.csv'), `${[lines[0], ...picked].join('\n')}\n`);
console.log(`Wrote test-data/salesforce/email-sent-smoke.csv with ${picked.length} rows.`);
