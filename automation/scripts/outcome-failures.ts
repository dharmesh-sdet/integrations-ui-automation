// Sorts the failed rows of a run into product findings and script problems.
//   node scripts/outcome-failures.ts [reports/prospect-outcome-updated/<run>]   (default: latest)
// A failure whose message starts with "PRODUCT:" comes from a product check in the spec
// (tests/salesforce/prospect-outcome-updated.spec.ts); any other failure is the script
// or the setup. For product findings it prints scenario, steps, expected and actual.
import fs from 'node:fs';
import path from 'node:path';

type Step = { title: string; error?: unknown; steps?: Step[] };
type Result = { status: string; error?: { message?: string }; steps?: Step[]; attachments?: { name: string; body?: string }[] };
type Test = { results: Result[] };
type Spec = { title: string; tests: Test[]; annotations?: { type: string; description?: string }[] };
type Suite = { title: string; specs?: Spec[]; suites?: Suite[] };

const dir = path.resolve(process.argv[2] ?? 'reports/prospect-outcome-updated/latest');
const results = JSON.parse(fs.readFileSync(path.join(dir, 'results.json'), 'utf8')) as { suites: Suite[] };
// eslint-disable-next-line no-control-regex
const plain = (text = '') => text.replace(/\u001b\[[0-9;]*m/g, '');

const specs: Spec[] = [];
const walk = (suite: Suite) => {
  specs.push(...(suite.specs ?? []));
  for (const child of suite.suites ?? []) walk(child);
};
results.suites.forEach(walk);

const stepTitles = (steps: Step[] = [], depth = 0): string[] =>
  steps.flatMap((s) => (s.title.startsWith('Before Hooks') || s.title.startsWith('After Hooks') || s.title.startsWith('Fixture') ? [] : [`${'  '.repeat(depth)}${s.title}${s.error ? '  <- failed' : ''}`, ...stepTitles(s.steps, depth + 1)]));

let passed = 0;
const product: string[] = [];
const script: string[] = [];
for (const spec of specs) {
  const last = spec.tests.flatMap((t) => t.results).at(-1);
  if (!last) continue;
  if (last.status === 'passed') {
    passed++;
    continue;
  }
  const message = plain(last.error?.message);
  const steps = stepTitles(last.steps).join('\n');
  if (/PRODUCT:/.test(message)) {
    const what = message.match(/PRODUCT: ([^\n]*)/)?.[1] ?? '';
    const expected = message.match(/Expected[^\n]*:\s*([^\n]*)/)?.[1] ?? '';
    const actual = message.match(/Received[^\n]*:\s*([^\n]*)/)?.[1] ?? '';
    product.push(`SCENARIO: ${spec.title}\nSTEPS:\n${steps}\nEXPECTED: ${what}${expected ? ` (${expected})` : ''}\nACTUAL: ${actual || message.split('\n').slice(0, 6).join(' ')}\n`);
  } else {
    script.push(`${spec.title}\n  ${message.split('\n').slice(0, 4).join('\n  ')}\n`);
  }
}
console.log(`Run ${dir}\nPassed ${passed}, product findings ${product.length}, script or setup problems ${script.length}\n`);
if (product.length) console.log(`PRODUCT FINDINGS\n\n${product.join('\n')}`);
if (script.length) console.log(`SCRIPT OR SETUP PROBLEMS (to fix in the script)\n\n${script.join('\n')}`);
