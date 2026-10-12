// Usage:
//   npm run data:generate -- <slug> --from <source slug> [--integration hubspot] [--force]
//     New test-data/<integration>/<slug>.csv (plus -deals, -companies) from another
//     workflow's CSV, with new people. See src/data/generate.ts.
//   npm run data:generate -- --refresh [<slug>] [--integration hubspot]
//     Replaces used rows (from .used.txt) in place; every CSV with used rows when
//     no slug is given. Also runs automatically before every test run.
import fs from 'node:fs';
import path from 'node:path';
import { csvsWithUsedRows, dataDir, generateFrom, refreshUsed } from '../src/data/generate.ts';

const args = process.argv.slice(2);
const option = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const integration = option('--integration') ?? 'hubspot';
const slug = args.find((a, i) => !a.startsWith('--') && !['--from', '--integration'].includes(args[i - 1]));
const csv = (name: string) => `${integration}/${name}.csv`;

if (args.includes('--refresh')) {
  for (const file of slug ? [csv(slug)] : csvsWithUsedRows()) {
    const replaced = refreshUsed(file);
    console.log(`test-data/${file}: ${replaced.length} used row(s) replaced${replaced.length ? ` (${replaced.join(', ')})` : ''}.`);
  }
  process.exit(0);
}

const source = option('--from');
if (!slug || !source) {
  console.error('Use: npm run data:generate -- <slug> --from <source slug> [--force], or -- --refresh [<slug>]');
  process.exit(1);
}
if (!fs.existsSync(path.join(dataDir, csv(source)))) {
  console.error(`test-data/${csv(source)} not found`);
  process.exit(1);
}
if (fs.existsSync(path.join(dataDir, csv(slug))) && !args.includes('--force')) {
  console.error(`test-data/${csv(slug)} already exists. Add --force to replace it.`);
  process.exit(1);
}
for (const file of generateFrom(csv(slug), csv(source))) console.log(`Wrote test-data/${file}.`);
