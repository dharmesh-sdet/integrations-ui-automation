import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Builds reports/report.html from the kept run data (report-data.json, written
// by plain-report.ts) and the failure notes Claude writes after a run
// (failure-notes.json). Used at the end of every run and by `npm run report`.

// "Likely reason" per failed test, keyed by `<spec file>::<test title>`.
export type FailureNotes = Record<string, { likelyReason: string }>;

export const DATA_FILE = 'report-data.json';
export const NOTES_FILE = 'failure-notes.json';

export function noteKey(file: string, title: string): string {
  return `${file}::${title}`;
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export function renderReport(outFile: string): void {
  const outDir = path.dirname(outFile);
  const data = readJson<{ tests: { file: string; title: string; likelyReason?: string }[] }>(path.join(outDir, DATA_FILE), {
    tests: [],
  });
  const notes = readJson<FailureNotes>(path.join(outDir, NOTES_FILE), {});
  for (const t of data.tests) t.likelyReason = notes[noteKey(t.file, t.title)]?.likelyReason ?? '';
  const template = readFileSync(new URL('./template.html', import.meta.url), 'utf8');
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  writeFileSync(outFile, template.replace('/*__REPORT_DATA__*/null', () => json));
}
