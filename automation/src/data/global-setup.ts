import { csvsWithUsedRows, refreshUsed } from './generate.ts';

// Before every run: rows used by earlier runs or walkthroughs are replaced by
// new people in the same CSV, so QA only has to run the tests (QA, 2026-10-09).
// TEST_DATA_ONLY=hubspot/link-clicked limits this to one workflow's CSV, so a
// session's run does not replace rows another session is still walking through.
export default function globalSetup(): void {
  const only = process.env.TEST_DATA_ONLY;
  for (const csv of csvsWithUsedRows()) {
    if (only && csv !== `${only}.csv`) continue;
    const replaced = refreshUsed(csv);
    if (replaced.length > 0) console.log(`Test data: replaced ${replaced.length} used row(s) in test-data/${csv}.`);
  }
}
