// Removes old run output: test-results-* folders and logs in automation/, and entries in reports/.
// Dry run by default. It never touches auth/, test-data/, test-cases/, context/ or jira/, and it
// refuses to delete while a Playwright run is active.
//   npm run clean:runs                    # list what is older than 3 days
//   npm run clean:runs -- --days 7        # use another age
//   npm run clean:runs -- --delete        # delete it
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const doDelete = args.includes('--delete');
const daysArg = args.indexOf('--days');
const days = daysArg >= 0 ? Number(args[daysArg + 1]) : 3;
if (!Number.isFinite(days) || days < 0) {
  console.error('Use: npm run clean:runs -- [--days <n>] [--delete]');
  process.exit(1);
}
const limit = Date.now() - days * 24 * 60 * 60 * 1000;

const candidates: string[] = [
  ...fs.readdirSync(root).filter((n) => n.startsWith('test-results-')).map((n) => path.join(root, n)),
  ...(fs.existsSync(path.join(root, 'reports'))
    ? fs.readdirSync(path.join(root, 'reports')).filter((n) => n !== '.gitkeep').map((n) => path.join(root, 'reports', n))
    : []),
];
const old = candidates.filter((p) => fs.statSync(p).mtimeMs < limit);
const sizeKb = (p: string) => Number(execFileSync('du', ['-sk', p]).toString().split('\t')[0]);

let running = false;
try {
  execFileSync('pgrep', ['-f', 'playwright test']);
  running = true;
} catch {
  // pgrep exits 1 when nothing matches
}
if (doDelete && running) {
  console.error('A Playwright run is active. Nothing deleted. Run this again when it ends.');
  process.exit(2);
}

let totalKb = 0;
for (const p of old) {
  totalKb += sizeKb(p);
  if (doDelete) fs.rmSync(p, { recursive: true, force: true });
}
console.log(`${old.length} of ${candidates.length} entries are older than ${days} days (${(totalKb / 1024 / 1024).toFixed(1)} GB).`);
console.log(doDelete ? 'Deleted.' : 'Dry run. Add --delete to remove them.');
