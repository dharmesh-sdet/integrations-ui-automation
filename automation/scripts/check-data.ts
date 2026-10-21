// Usage: npm run data:check -- <slug> [--integration hubspot]
// Prints each scenario row of test-data/<integration>/<slug>.csv with its deal
// and company counts (from the -deals and -companies files), and warns when two
// rows share a country, job title or company. Run before handing a spec over.
import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from '../src/data/generate.ts';
import { readCsv } from '../src/data/csv.ts';

const args = process.argv.slice(2);
const integration = args.includes('--integration') ? args[args.indexOf('--integration') + 1] : 'hubspot';
const slug = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--integration');
if (!slug) {
  console.error('Use: npm run data:check -- <slug> [--integration hubspot]');
  process.exit(1);
}
const side = (suffix: string) => {
  const file = `${integration}/${slug}-${suffix}.csv`;
  return fs.existsSync(path.join(dataDir, file)) ? readCsv(file) : [];
};
const rows = readCsv(`${integration}/${slug}.csv`);
const deals = side('deals');
const companies = side('companies');
const count = (list: ReturnType<typeof side>, email: string) => list.filter((r) => r['Contact Email'] === email).length;

console.log(`${'Scenario'.padEnd(48)} deals companies  country | job title | company`);
for (const r of rows) {
  const scenario = Object.values(r)[0] ?? '';
  console.log(`${scenario.slice(0, 47).padEnd(48)} ${String(count(deals, r['Email'])).padStart(5)} ${String(count(companies, r['Email'])).padStart(9)}  ${r['Country']} | ${r['Job Title']} | ${r['Company']}`);
}
for (const field of ['Country', 'Job Title', 'Company']) {
  const seen = new Map<string, number>();
  for (const r of rows) seen.set(r[field], (seen.get(r[field]) ?? 0) + 1);
  const repeats = [...seen].filter(([, n]) => n > 1).map(([v, n]) => `${v} x${n}`);
  console.log(repeats.length ? `WARNING ${field} repeats: ${repeats.join(', ')}` : `${field}: all ${rows.length} different`);
}
