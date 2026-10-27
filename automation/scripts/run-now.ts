// Usage: npm run sf:run-now -- <account> "<workflow name or id>"
//   e.g. npm run sf:run-now -- <account> "Contact is created in Salesforce"
//   Names as on Triggers & Activity: Lead is created in Salesforce (V1), Contact /
//   Opportunity / Account is created in Salesforce.
// Runs a Salesforce-side workflow (cron "0 */3 * * *") for that account now instead of
// waiting up to 3 hours, waits for the run to end and prints each step's status.
// Uses the account's saved Saleshandy login (npm run login:saleshandy -- <account>).
// Before you run it: the trigger and its actions are set on Triggers & Activity.
// The run reads every record in its window of the shared org, not only yours (up to
// 200; Contact, Account and Opportunity do not apply their 3-hour window), so check only
// your own prospect, and do not select blacklist or unsubscribe while others test.
// Exit code: 0 the run COMPLETED, 1 anything else.
import { chromium, devices } from '@playwright/test';
import { isAccount } from '../src/config/accounts.ts';
import { baseUrlFor, browsers } from '../src/config/environments.ts';
import { RefoldRunNow } from '../src/flows/refold-run-now.ts';
import { assertSessionFresh } from '../src/utils/session.ts';

const [account, workflow] = process.argv.slice(2);
if (!isAccount(account) || !workflow) {
  console.error('Use: npm run sf:run-now -- <account> "<workflow name or id>"');
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices[browsers.chromium.device],
  baseURL: baseUrlFor('saleshandy', account),
  storageState: assertSessionFresh('saleshandy', account, 'chromium'),
});
let ok = false;
try {
  const refold = await RefoldRunNow.open(await context.newPage());
  const executionId = await refold.run(workflow);
  console.log(`Started run ${executionId} (find it in Settings > Integrations > Salesforce > Logs).`);
  const run = await refold.waitForEnd(executionId);
  for (const node of run.nodes ?? []) console.log(`  ${node.node_status ?? '-'}  ${node.node_name}`);
  console.log(`Run ${executionId}: ${run.status}`);
  ok = run.status === 'COMPLETED';
} catch (e) {
  console.error((e as Error).message.split('\n')[0]);
} finally {
  await browser.close();
}
process.exit(ok ? 0 : 1);
