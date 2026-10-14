import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { FullConfig, FullResult, Reporter, TestCase, TestResult, TestStep } from '@playwright/test/reporter';
import { plainError, readScenarios, scenarioKey, type Scenarios } from './plain-english.ts';
import { DATA_FILE, renderReport } from './render.ts';

// The spec file a test belongs to. Shared test bodies (src/flows/activity-rows.ts)
// put test.location in the shared file, so use the file-level suite instead.
function specFile(test: TestCase): string {
  let suite = test.parent;
  while (suite && suite.type !== 'file') suite = suite.parent!;
  return suite?.location?.file ?? test.location.file;
}

// Writes reports/report.html as soon as the workers finish: a plain-English
// page for QA review, with a Jira bug draft per failure and a "tested" comment
// draft per workflow. It opens in the browser only when REPORT_OPEN=always (QA, 2026-10-13: never open it by default).
// The page keeps the latest run of every workflow (QA, 2026-10-09): a run
// replaces only the sections of the spec files it ran. Sections go
// Integration > Workflow > Activity. The data is kept in report-data.json, and
// screenshots and traces are copied to artifacts/<spec>/ because test-results/
// is emptied when the next run starts. render.ts builds the page.

type Step = { title: string; status: 'passed' | 'failed' };
type Shot = { path: string; failed: boolean };

const STATUS: Record<string, string> = {
  expected: 'passed',
  unexpected: 'failed',
  flaky: 'flaky',
  skipped: 'did not run',
};

export default class PlainReport implements Reporter {
  private config!: FullConfig;
  private startTime = new Date();
  private results = new Map<string, { test: TestCase; result: TestResult }>();
  private outputFile: string;

  constructor(options: { outputFile?: string } = {}) {
    this.outputFile = options.outputFile ?? 'reports/report.html';
  }

  printsToStdio(): boolean {
    return false;
  }

  onBegin(config: FullConfig): void {
    this.config = config;
    this.startTime = new Date();
  }

  // Retries report again; the last result is the one that counts.
  onTestEnd(test: TestCase, result: TestResult): void {
    this.results.set(test.id, { test, result });
  }

  async onEnd(result: FullResult): Promise<void> {
    // Nothing ran (e.g. --list): keep the last report.
    if (!this.results.size) return;
    const root = this.config.configFile ? path.dirname(this.config.configFile) : process.cwd();
    const out = path.resolve(root, this.outputFile);
    const outDir = path.dirname(out);
    const scenarios = new Map<string, Scenarios>();
    const runId = this.startTime.toISOString();
    const startedAt = this.startTime.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

    // Fresh artifacts folder per spec file in this run.
    const artifactsDir = (file: string) => path.join(outDir, 'artifacts', file.replace(/[\\/]/g, '__').replace(/\.spec\.ts$/, ''));
    for (const file of new Set([...this.results.values()].map(({ test }) => path.relative(root, specFile(test))))) {
      rmSync(artifactsDir(file), { recursive: true, force: true });
    }
    const keep = (file: string, src: string): string => {
      const dir = artifactsDir(file);
      mkdirSync(dir, { recursive: true });
      const dest = path.join(dir, `${path.basename(path.dirname(src))}-${path.basename(src)}`);
      copyFileSync(src, dest);
      return dest;
    };

    const tests = [...this.results.values()].map(({ test, result: r }) => {
      const file = path.relative(root, specFile(test));
      if (!scenarios.has(file)) scenarios.set(file, readScenarios(root, file));
      const scenario = scenarios.get(file)!.rows.get(scenarioKey(test.title));
      const steps = userSteps(r.steps);
      const shots: Shot[] = r.attachments
        .filter((a) => a.contentType.startsWith('image/') && a.path && existsSync(a.path))
        .map((a) => ({ path: rel(outDir, keep(file, a.path!)), failed: /test-failed/.test(a.path!) }));
      const tracePath = r.attachments.find((a) => a.name === 'trace' && a.path && existsSync(a.path))?.path;
      const trace = tracePath ? keep(file, tracePath) : undefined;
      const outcome = STATUS[test.outcome()] ?? test.outcome();
      return {
        // Per run, so review marks of other workflows' runs are kept.
        id: `${runId}:${test.id}`,
        file,
        integration: integrationOf(file),
        workflow: test.parent.title,
        // Titles read "<Activity> > <#>: <Scenario>".
        activity: test.title.includes(' > ') ? test.title.split(' > ')[0] : 'Other',
        browser: test.parent.project()?.name ?? '',
        title: test.title,
        outcome,
        durationSec: Math.round(r.duration / 1000),
        expected: scenario?.expected ?? '',
        ticket: scenario?.ticket ?? '',
        steps,
        failedStep:
          outcome === 'failed'
            ? (steps.find((s) => s.status === 'failed')?.title ?? 'Before the first step (setup, for example the saved login)')
            : '',
        whatHappened: outcome === 'failed' ? plainError(r.errors.map((e) => e.message ?? e.value ?? '')) : '',
        shots,
        trace: trace ? `npx playwright show-trace "${path.relative(root, trace)}"` : '',
      };
    });

    const workflows = [...new Set(tests.map((t) => t.file))].map((file) => ({
      file,
      integration: integrationOf(file),
      title: tests.find((t) => t.file === file)!.workflow,
      ticket: scenarios.get(file)?.workflowTicket ?? '',
      runId,
      startedAt,
      durationMin: Math.round(result.duration / 6000) / 10,
      status: result.status,
    }));

    // Merge with the kept sections: this run's spec files replace theirs, newest first.
    const storeFile = path.join(outDir, DATA_FILE);
    let kept: { workflows: typeof workflows; tests: typeof tests } = { workflows: [], tests: [] };
    try {
      kept = JSON.parse(readFileSync(storeFile, 'utf8'));
    } catch {
      // First run, or an unreadable file: start fresh.
    }
    const ran = new Set(workflows.map((w) => w.file));
    const data = {
      // Fixed, so review marks (keyed by per-run test ids) live across runs.
      runId: 'all',
      workflows: [...workflows, ...kept.workflows.filter((w) => !ran.has(w.file))],
      tests: [...tests, ...kept.tests.filter((t) => !ran.has(t.file))],
    };

    mkdirSync(outDir, { recursive: true });
    writeFileSync(storeFile, JSON.stringify(data));
    renderReport(out);
    console.log(`\nPlain-English report: ${path.relative(process.cwd(), out)}`);
    if (!process.env.CI && process.env.REPORT_OPEN === 'always') open(out);
  }
}

// Only the test.step() titles: those are the plain-English steps QA reads.
function userSteps(steps: TestStep[]): Step[] {
  const out: Step[] = [];
  for (const step of steps) {
    if (step.category === 'test.step') {
      out.push({ title: step.title, status: step.error ? 'failed' : 'passed' });
    } else {
      out.push(...userSteps(step.steps));
    }
  }
  return out;
}

// tests/<integration>/... gives the top section of the page.
const INTEGRATIONS: Record<string, string> = { hubspot: 'HubSpot', salesforce: 'Salesforce', saleshandy: 'Saleshandy', setup: 'Account setup' };
function integrationOf(file: string): string {
  const dir = file.split(/[\\/]/)[1] ?? '';
  return INTEGRATIONS[dir] ?? (dir ? dir[0].toUpperCase() + dir.slice(1) : 'Other');
}

function rel(from: string, to: string): string {
  return path.relative(from, to).split(path.sep).join('/');
}

function open(file: string): void {
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', [file]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '""', file]]
        : ['xdg-open', [file]];
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  } catch {
    // No browser opener on this machine; the path is printed above.
  }
}
