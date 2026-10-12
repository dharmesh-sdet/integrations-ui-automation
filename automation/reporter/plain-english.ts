import { existsSync, readFileSync } from 'node:fs';

// Turns Playwright errors and scenario files into sentences a QA reader can use
// without reading code or stack traces.

const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '');

function firstLine(msg: string): string {
  return (msg.split('\n').find((l) => l.trim()) ?? '').replace(/^Error:\s*/, '').trim();
}

// One error message to one or two sentences. Order matters: the most specific
// pattern wins.
function sentence(raw: string): string | undefined {
  const msg = stripAnsi(raw);

  // Follows a timeout; the timeout sentence already says what went wrong.
  if (/Target page, context or browser has been closed/.test(msg) && !/intercepts pointer events/.test(msg)) {
    return undefined;
  }

  const timeout = msg.match(/Test timeout of (\d+)ms exceeded/);
  if (timeout) return `The test ran out of time (${Number(timeout[1]) / 60_000} minutes) and was stopped.`;

  if (/intercepts pointer events/.test(msg)) {
    const covers = [...msg.matchAll(/from <\w+[^>]*class="([^"]+)"[^>]*>/g)].map((m) => m[1]);
    const what = covers.length ? ` (an element named "${covers[covers.length - 1]}")` : '';
    return `The test found what it had to click, but another part of the page${what} was on top of it, so the click never happened. It kept retrying until the time ran out.`;
  }

  const strict = msg.match(/strict mode violation.*?resolved to (\d+) elements/s);
  if (strict) {
    return `The test found ${strict[1]} matching items on the page where it expected exactly one, so it stopped before doing anything.`;
  }

  if (/session expired/.test(msg)) return firstLine(msg);

  const expected = msg.match(/^Expected[^:\n]*:\s*(.*)$/m)?.[1]?.trim();
  const received = msg.match(/^Received[^:\n]*:\s*(.*)$/m)?.[1]?.trim();
  const head = firstLine(msg);
  const label = head.startsWith('expect(') ? '' : head;

  const gaveUp = msg.match(/gave up after (\d+) seconds/);
  if (gaveUp) {
    const last = expected !== undefined ? ` On the last check it expected ${expected} but saw ${received ?? 'nothing'}.` : '';
    return `${label}.${last}`;
  }

  if (expected !== undefined) {
    const what = label ? `"${label}"` : 'The check';
    return `${what}: expected ${expected}, but the page showed ${received ?? 'nothing'}.`;
  }

  const wait = msg.match(/Timeout (\d+)ms exceeded/);
  if (wait) return `The test could not find what it needed on the page within ${Number(wait[1]) / 1000} seconds.`;

  return head || undefined;
}

export function plainError(messages: string[]): string {
  const out = [...new Set(messages.map(sentence).filter((s): s is string => !!s))];
  return out.join(' ') || 'The test failed without an error message.';
}

export type Scenario = { expected: string; ticket: string };
export type Scenarios = { workflowTicket: string; rows: Map<string, Scenario> };

// tests/<integration>/<slug>.spec.ts -> test-cases/<integration>/<slug>.md.
// Rows are keyed "<Activity> > <#>", the start of each test title.
export function readScenarios(rootDir: string, specFile: string): Scenarios {
  const rows = new Map<string, Scenario>();
  const rel = specFile.replace(/\\/g, '/').match(/tests\/(.+)\.spec\.ts$/)?.[1];
  const file = rel ? `${rootDir}/test-cases/${rel}.md` : '';
  if (!file || !existsSync(file)) return { workflowTicket: '', rows };

  const text = readFileSync(file, 'utf8');
  let activity = '';
  for (const line of text.split('\n')) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) activity = heading[1].trim();
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length >= 5 && /^\d+$/.test(cells[0])) {
      rows.set(`${activity} > ${cells[0]}`, {
        expected: cells[3].replace(/\s+-\s+(Pass|Fail\b.*)$/, ''),
        ticket: cells[4] === 'None' ? '' : cells[4],
      });
    }
  }
  const workflowTicket = text.match(/workflow ticket\s+is\s+([A-Z][A-Z0-9]+-\d+)/i)?.[1] ?? '';
  return { workflowTicket, rows };
}

export function scenarioKey(testTitle: string): string {
  return testTitle.match(/^(.*? > \d+):/)?.[1] ?? '';
}
