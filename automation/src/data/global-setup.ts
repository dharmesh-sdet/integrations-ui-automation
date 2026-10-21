import fs from 'node:fs';
import path from 'node:path';
import { csvsWithUsedRows, refreshAll, refreshUsed } from './generate.ts';

// Before every run, QA only has to run the tests (QA, 2026-10-09 and 2026-10-13):
// 1. Every row of the CSV of each workflow being run is replaced by a new person
//    (also its -deals and -companies files), so a run never meets a contact an
//    earlier run or walkthrough left in HubSpot. The CSV of a spec is the file
//    with the same name: tests/hubspot/reply-received.spec.ts uses
//    test-data/hubspot/reply-received.csv. Workflows not being run keep their data.
// 2. CSVs of workflows NOT being run are never touched (QA, 2026-10-13: another
//    session may be running that workflow at the same time, and swapping its
//    used people mid-run breaks it). REFRESH_OTHER_USED=1 brings back the old
//    behavior: used rows of every other CSV are replaced too.
//
// Which workflows are being run comes from the command line (a spec path or
// name); with none given, every workflow with a spec is run.
// TEST_DATA_ONLY=hubspot/link-clicked limits all of this to one workflow's CSV.
// KEEP_TEST_DATA=1 replaces used rows only (for a walkthrough that is using the
// CSV's people).
const root = path.resolve(import.meta.dirname, '../..');

function csvsOfSpecsBeingRun(): string[] {
  const testsDir = path.join(root, 'tests');
  const csvs: { slug: string; csv: string }[] = [];
  for (const file of fs.readdirSync(testsDir, { recursive: true, encoding: 'utf8' })) {
    const match = file.replace(/\\/g, '/').match(/^([^/]+)\/(.+)\.spec\.ts$/);
    if (!match) continue;
    const csv = `${match[1]}/${match[2]}.csv`;
    if (fs.existsSync(path.join(root, 'test-data', csv))) csvs.push({ slug: match[2], csv });
  }
  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const named = csvs.filter((c) => args.some((a) => a.includes(c.slug)));
  return (named.length > 0 ? named : csvs).map((c) => c.csv);
}

export default function globalSetup(): void {
  const only = process.env.TEST_DATA_ONLY;
  const keep = process.env.KEEP_TEST_DATA === '1';
  const all = new Set<string>(keep ? [] : csvsOfSpecsBeingRun());

  for (const csv of all) {
    if (only && csv !== `${only}.csv`) continue;
    // REFRESH_USED_ONLY=1: replace only rows a run already used. A row never sent
    // is still new to Saleshandy, and replacing all of them burns names for
    // nothing (36 per run; the name pool had 1,170 combinations left on 2026-10-21).
    if (process.env.REFRESH_USED_ONLY === '1') {
      const replaced = refreshUsed(csv);
      console.log(`Test data: replaced ${replaced.length} used row(s) in test-data/${csv}; unused rows kept.`);
      continue;
    }
    const replaced = refreshAll(csv);
    if (replaced.length > 0) console.log(`Test data: new people for all ${replaced.length} row(s) in test-data/${csv}.`);
  }
  if (process.env.REFRESH_OTHER_USED !== '1') return;
  for (const csv of csvsWithUsedRows()) {
    if (all.has(csv) && !(only && csv !== `${only}.csv`)) continue;
    if (only && csv !== `${only}.csv`) continue;
    const replaced = refreshUsed(csv);
    if (replaced.length > 0) console.log(`Test data: replaced ${replaced.length} used row(s) in test-data/${csv}.`);
  }
}
