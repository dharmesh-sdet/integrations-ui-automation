// Usage: npm run parallel -- <workflow> <workflow> ... [--yes] [--lanes=4]
//   A workflow is a spec path or name: salesforce/email-sent, hubspot/link-clicked,
//   tests/salesforce/reply-received.spec.ts
// Runs the chosen workflows side by side, one lane per Saleshandy account. Specs of the
// same account run one after another in their lane, because they share its trigger
// settings. Before starting it prints every known clash between the chosen workflows and
// asks whether to go on (--yes skips the question).
// Each lane writes to reports/<time>-<account>/ (report.html there).
// A lane whose account is already in use by another run stops at once and never waits,
// so two runs cannot deadlock. Exit code: 0 every lane passed, 1 otherwise.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';

const ROOT = path.resolve(import.meta.dirname, '..');
const TESTS = path.join(ROOT, 'tests');
const LOCKS = path.join(ROOT, 'locks');
// QA's RAM limit: 4 workers, two browser contexts each (playwright.config.ts).
const lanesArg = process.argv.find((a) => a.startsWith('--lanes='));
const MAX_LANES = Number(lanesArg?.split('=')[1] ?? 4);
// Above this many Salesforce accounts the Re-connect drops are expected to get worse:
// Salesforce keeps about 5 refresh tokens per user and app, one spare (not proven yet).
const MAX_SALESFORCE_ACCOUNTS = 4;

type Spec = { file: string; name: string; account: string; crm: string };

// ---- Pick the specs ----

const allSpecs = fs
  .readdirSync(TESTS, { recursive: true, encoding: 'utf8' })
  .map((f) => f.replace(/\\/g, '/'))
  .filter((f) => /^(hubspot|salesforce)\/.+\.spec\.ts$/.test(f));

function pick(arg: string): Spec {
  const wanted = arg.replace(/^tests\//, '').replace(/\.spec\.ts$/, '');
  const matches = allSpecs.filter((f) => f.replace(/\.spec\.ts$/, '') === wanted || f.replace(/\.spec\.ts$/, '').endsWith(`/${wanted}`));
  if (matches.length !== 1) {
    throw new Error(`"${arg}" matches ${matches.length ? matches.join(', ') : 'no spec'}. Use crm/name, for example salesforce/email-sent.`);
  }
  const file = matches[0];
  // Every workflow spec picks its account with test.use({ account: '<name>' }).
  const account = fs.readFileSync(path.join(TESTS, file), 'utf8').match(/account:\s*'([a-z0-9]+)'/)?.[1];
  if (!account) throw new Error(`tests/${file} sets no account (test.use({ account: ... })).`);
  return { file: `tests/${file}`, name: file.replace(/\.spec\.ts$/, ''), account, crm: file.split('/')[0] };
}

function byAccount(specs: Spec[]): Map<string, Spec[]> {
  const lanes = new Map<string, Spec[]>();
  for (const s of specs) lanes.set(s.account, [...(lanes.get(s.account) ?? []), s]);
  return lanes;
}

// ---- Known clashes (evidence: integration-tests/*/test-log.md and QA's progress files) ----

// CRM-side triggers react to records any lane makes in the shared portal or org.
const crmSide = (s: Spec) => /contact-updated|contact-created|company-created|deal-created|(lead|contact|account|opportunity)-created/.test(s.name) && !s.name.endsWith('-smoke');

function clashes(specs: Spec[]): string[] {
  const found: string[] = [];
  for (const [account, group] of byAccount(specs)) {
    if (group.length < 2) continue;
    found.push(
      `${group.map((s) => s.name).join(' + ')} use the same Saleshandy account (${account}). Each one turns the other's trigger off and ` +
        'sees the other\'s Logs rows, so they will run one after another in one lane, not in parallel. ' +
        'On one account every test that sends an email also fires Email Sent, and a link click also counts as an open (Opened + Link Clicked).',
    );
  }
  for (const side of specs.filter(crmSide)) {
    const others = specs.filter((s) => s !== side && s.crm === side.crm);
    if (others.length === 0) continue;
    found.push(
      side.crm === 'hubspot'
        ? `${side.name} reacts to contacts and companies created or changed anywhere in the shared HubSpot portal. ` +
            `${others.map((s) => s.name).join(', ')} create and update HubSpot records while it runs, so it can get extra Logs rows ` +
            '(its "nothing should happen" checks fail) and import their people (seen: integration-tests hubspot link-is-clicked test-log.md:105).'
        : `${side.name} reads every record created in the shared Salesforce org (up to 200; Contact, Account and Opportunity ` +
            `do not apply their 3-hour window). ${others.map((s) => s.name).join(', ')} create Salesforce records while it runs: ` +
            'it imports their people and gives them its tag or status, and your own record can fall outside the 200 ' +
            '(integration-tests contact-created-in-salesforce test-log.md:27, :109).',
    );
  }
  const salesforceAccounts = new Set(specs.filter((s) => s.crm === 'salesforce').map((s) => s.account));
  if (salesforceAccounts.size > MAX_SALESFORCE_ACCOUNTS) {
    found.push(
      `${salesforceAccounts.size} Salesforce accounts in one run (${[...salesforceAccounts].join(', ')}). They connect the same ` +
        'Salesforce org; Salesforce keeps only about 5 tokens per user and app, so more connections make "Re-connect" drops likelier.',
    );
  }
  return found;
}

// ---- Account locks: fail at once when another run uses the account ----

function lock(account: string): boolean {
  fs.mkdirSync(LOCKS, { recursive: true });
  const file = path.join(LOCKS, `${account}.lock`);
  try {
    fs.writeFileSync(file, String(process.pid), { flag: 'wx' });
    return true;
  } catch {
    const pid = Number(fs.readFileSync(file, 'utf8'));
    try {
      process.kill(pid, 0); // throws when that run is gone
      return false;
    } catch {
      fs.writeFileSync(file, String(process.pid)); // stale lock of a killed run
      return true;
    }
  }
}

const held: string[] = [];
process.on('exit', () => held.forEach((f) => fs.rmSync(f, { force: true })));
process.on('SIGINT', () => process.exit(130));

// ---- Run ----

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (args.length === 0) {
  console.error('Use: npm run parallel -- <workflow> <workflow> ... [--yes] [--lanes=4]   e.g. salesforce/email-sent hubspot/link-clicked');
  process.exit(1);
}
let specs: Spec[];
try {
  specs = [...new Map(args.map(pick).map((s) => [s.file, s])).values()];
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}

const lanes = [...byAccount(specs)];
console.log(`Lanes (${lanes.length}, at most ${MAX_LANES} at once):`);
for (const [account, group] of lanes) console.log(`  ${account}: ${group.map((s) => s.name).join(' -> ')}`);

const found = clashes(specs);
if (found.length > 0) {
  console.log('\nThese workflows are related and may give unexpected errors when run together:');
  found.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
  if (!process.argv.includes('--yes')) {
    if (!process.stdin.isTTY) {
      console.error('\nNot started. Run again with --yes to start anyway.');
      process.exit(1);
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('\nStart anyway? (y/N) ');
    rl.close();
    if (!/^y(es)?$/i.test(answer.trim())) process.exit(1);
  }
}

const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const results: string[] = [];
let failed = false;

async function runLane([account, group]: [string, Spec[]]): Promise<void> {
  if (!lock(account)) {
    failed = true;
    results.push(`${account}: not run, another run is using this account (locks/${account}.lock).`);
    return;
  }
  held.push(path.join(LOCKS, `${account}.lock`));
  const reports = `reports/${stamp}-${account}`;
  const child = spawn('npx', ['playwright', 'test', ...group.map((s) => s.file), '--project=chromium', '--workers=1'], {
    cwd: ROOT,
    stdio: ['ignore', fs.openSync(path.join(ROOT, `${reports}.log`), 'w'), 'inherit'],
    env: { ...process.env, REPORTS_DIR: reports, REPORT_OPEN: 'never' },
  });
  const [code] = await once(child, 'exit');
  if (code !== 0) failed = true;
  results.push(`${account}: ${code === 0 ? 'passed' : 'failures'}, ${reports}/report.html (output: ${reports}.log)`);
}

fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
const queue = [...lanes];
await Promise.all(
  Array.from({ length: Math.min(MAX_LANES, queue.length) }, async (_, i) => {
    // Start lanes a few seconds apart, so their test-data refreshes do not pick the same new person.
    await new Promise((r) => setTimeout(r, i * 5_000));
    for (let lane = queue.shift(); lane; lane = queue.shift()) await runLane(lane);
  }),
);

console.log('\nResults:');
results.forEach((r) => console.log(`  ${r}`));
process.exit(failed ? 1 : 0);
