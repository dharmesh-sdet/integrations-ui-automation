// The Test tab of the Salesforce and HubSpot pages: the newest result of every test,
// merged from all the run folders under reports/. A run folder only holds the tests that
// run executed (for example one test run alone), so "latest" is decided per test, not
// per run. Screenshot paths are rewritten to be relative to reports/ so the server can
// serve them, and each run's failure notes are applied.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

type Shot = { path: string; failed?: boolean };
type Test = { id: string; file: string; title: string; shots: Shot[]; likelyReason?: string; [k: string]: unknown };
type Workflow = { integration: string; title: string; file: string; startedAt: string; [k: string]: unknown };
type RunData = { workflows: Workflow[]; tests: Test[] };

const readJson = <T>(file: string, fallback: T): T => {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
};

// Folders that hold a report-data.json, at most two levels below reports/.
function runFolders(reportsDir: string): string[] {
  const found: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (existsSync(path.join(dir, 'report-data.json'))) found.push(dir);
    if (depth === 0) return;
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (name !== 'artifacts' && name !== 'html' && name !== 'test-results' && statSync(full).isDirectory()) walk(full, depth - 1);
    }
  };
  walk(reportsDir, 2);
  return found;
}

// Exploration and pilot specs start with "_" (for example _pilot-read-p1.spec.ts); they are not workflows.
const isScratch = (file: string) => path.basename(file).startsWith('_');

// Run time is the ISO timestamp the test id starts with.
const runTime = (t: Test) => t.id.split(':').slice(0, 3).join(':');

export function mergedTests(reportsDir: string, root: string): RunData {
  const latest = new Map<string, Test>();
  const workflows = new Map<string, Workflow & { size: number }>();
  for (const dir of runFolders(reportsDir)) {
    const rel = path.relative(reportsDir, dir).split(path.sep).join('/');
    const prefix = rel ? rel + '/' : '';
    const data = readJson<RunData>(path.join(dir, 'report-data.json'), { workflows: [], tests: [] });
    const notes = readJson<Record<string, { likelyReason: string }>>(path.join(dir, 'failure-notes.json'), {});
    for (const t of data.tests) {
      if (isScratch(t.file)) continue;
      const key = `${t.file}::${t.title}`;
      const prior = latest.get(key);
      if (prior && runTime(prior) >= runTime(t)) continue;
      latest.set(key, {
        ...t,
        shots: t.shots.map((s) => ({ ...s, path: /^(https?:|\/)/.test(s.path) ? s.path : prefix + s.path })),
        likelyReason: notes[key]?.likelyReason ?? '',
      });
    }
    for (const w of data.workflows) {
      if (isScratch(w.file)) continue;
      // One workflow per spec file: older runs named the same file after other workflows
      // (the plan changed), which would repeat its tests in several cards. The newest wins.
      // The title comes from the run with the most tests (a small run of a few tests can carry
      // another workflow's name); "last run" is the newest run that touched the file.
      const key = w.file;
      const size = data.tests.filter((t) => t.file === w.file).length;
      const prior = workflows.get(key);
      const newest = prior && new Date(prior.startedAt) > new Date(w.startedAt) ? prior.startedAt : w.startedAt;
      workflows.set(key, !prior || size > prior.size ? { ...w, size, startedAt: newest } : { ...prior, startedAt: newest });
    }
  }
  // Drop tests that are no longer in their spec (renamed or removed in a later plan).
  // Skipped when most titles are not found in the source (titles built at run time).
  const bySpec = new Map<string, Test[]>();
  for (const t of latest.values()) bySpec.set(t.file, [...(bySpec.get(t.file) ?? []), t]);
  const kept: Test[] = [];
  for (const [file, tests] of bySpec) {
    const specFile = path.join(root, file);
    const source = existsSync(specFile) ? readFileSync(specFile, 'utf8') : '';
    const inSource = tests.filter((t) => source.includes(t.title));
    kept.push(...(source && inSource.length >= tests.length / 2 ? inSource : tests));
  }
  const files = new Set(kept.map((t) => t.file));
  // The card title is the heading of the spec's test-case file (test-cases/<integration>/<name>.md),
  // because the title in older run data was taken from whichever scenario section the run matched.
  const titleOf = (w: Workflow): string => {
    const m = w.file.match(/^tests\/([^/]+)\/(.+)\.spec\.ts$/);
    const md = m ? path.join(root, 'test-cases', m[1], `${m[2]}.md`) : '';
    const heading = md && existsSync(md) ? readFileSync(md, 'utf8').split('\n')[0].replace(/^#\s*/, '') : '';
    return heading ? heading.replace(/,? ?:? ?(Lightweight )?Regression (scenarios|plan|proposal)$/, '') + (/Lightweight/.test(heading) ? ' (lightweight)' : '') : w.title;
  };
  for (const w of workflows.values()) w.title = titleOf(w);
  return { workflows: [...workflows.values()].filter((w) => files.has(w.file)).map(({ size: _size, ...w }) => w), tests: kept };
}
