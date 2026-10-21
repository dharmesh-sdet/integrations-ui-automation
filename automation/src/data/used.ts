import fs from 'node:fs';
import path from 'node:path';
import type { Row } from './csv.ts';

// Created records stay on the site and names have no prefix, so each CSV row
// can be created only once. Emails already used are listed one per line in
// test-data/<csv name>.used.txt, next to the CSV.
function usedFile(csvFile: string): string {
  return path.resolve(import.meta.dirname, '../../test-data', csvFile.replace(/\.csv$/, '.used.txt'));
}

function usedEmails(csvFile: string): Set<string> {
  const file = usedFile(csvFile);
  if (!fs.existsSync(file)) return new Set();
  return new Set(fs.readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean));
}

// The first `count` rows whose Email is not used yet.
export function unusedRows(csvFile: string, rows: Row[], count: number): Row[] {
  const used = usedEmails(csvFile);
  const fresh = rows.filter((r) => !used.has(r.Email)).slice(0, count);
  if (fresh.length < count) {
    throw new Error(`Only ${fresh.length} unused contacts left in test-data/${csvFile}; add more rows (need ${count})`);
  }
  return fresh;
}

export function markUsed(csvFile: string, email: string): void {
  if (usedEmails(csvFile).has(email)) return;
  fs.appendFileSync(usedFile(csvFile), `${email}\n`);
}
