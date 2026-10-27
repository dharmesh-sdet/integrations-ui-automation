// Builds the CSVs of the four Salesforce-side workflows, one row per scenario, with new
// people: test-data/salesforce/{lead,contact,account,opportunity}-created.csv.
//   node scripts/make-salesforce-side-data.ts
// Run it once (or again after deleting a CSV). Before every test run the people are
// replaced with new ones by src/data/global-setup.ts, as for every other workflow.
import fs from 'node:fs';
import path from 'node:path';
import { dataDir, refreshAll, TEMPLATE_FIELDS } from '../src/data/generate.ts';
import { LEAD_ONLY_SCENARIOS, SALESFORCE_SIDE_SCENARIOS, SALESFORCE_SIDE_WORKFLOWS } from '../src/data/salesforce-side-scenarios.ts';

const header = ['Scenario', ...TEMPLATE_FIELDS];
fs.mkdirSync(path.join(dataDir, 'salesforce'), { recursive: true });
for (const [slug, leadOnly] of Object.entries(SALESFORCE_SIDE_WORKFLOWS)) {
  const csv = `salesforce/${slug}.csv`;
  if (fs.existsSync(path.join(dataDir, csv))) {
    console.log(`test-data/${csv} exists, kept.`);
    continue;
  }
  const scenarios = [...SALESFORCE_SIDE_SCENARIOS, ...(leadOnly ? LEAD_ONLY_SCENARIOS : [])];
  // Placeholder people (an email and a company are what the generator replaces), then new ones.
  const rows = scenarios.map((s, i) => header.map((h) => (h === 'Scenario' ? s : h === 'Email' ? `placeholder-${slug}-${i}@example.invalid` : h === 'Company' ? 'Placeholder' : '')).join(','));
  fs.writeFileSync(path.join(dataDir, csv), `${[header.join(','), ...rows].join('\n')}\n`);
  console.log(`Wrote test-data/${csv}: ${refreshAll(csv).length} new people.`);
}
