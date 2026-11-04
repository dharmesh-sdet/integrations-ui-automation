import { expect, test } from '../../src/fixtures/index.ts';
import { TRIGGER, configureCategory, expectSavedCategory } from '../../src/flows/zoho-conversation-category-updated.ts';
import { ZOHO_ACTION } from '../../src/flows/saleshandy-to-zoho.ts';

// Production probe, not committed. Turns on "Conversation Category is Updated in Saleshandy" with the Contact action and
// category Interested, saves, reloads and reads it back. Sends nothing. QA asked for it on 2026-11-04.
//   CC_PROD_PROBE=1 KEEP_TEST_DATA=1 KEEP_OTHER_TRIGGERS=1 npx playwright test tests/setup/zoho-cc-prod-probe.spec.ts --project=chromium --workers=1
test.skip(process.env.CC_PROD_PROBE !== '1', 'CC_PROD_PROBE=1');
test.use({ account: 'emailopenedprod' });
test.describe.configure({ retries: 0 });
const SHOTS = process.env.PROBE_SHOTS ?? '/tmp';

test('production: trigger can be turned on, saved and read back', async ({ zohoIntegration, saleshandyPage }) => {
  await zohoIntegration.openTriggers();
  console.log('URL=' + saleshandyPage.url());
  await saleshandyPage.screenshot({ path: `${SHOTS}/cc-prod-1-triggers.png`, fullPage: true });
  const body = (await saleshandyPage.locator('body').innerText()).replace(/\n+/g, ' | ');
  console.log('RECONNECT=' + /Re-?connect/i.test(body));
  console.log('HAS_TRIGGER_TEXT=' + body.includes(TRIGGER));
  console.log('BODY=' + body.slice(0, 1500));
  expect(body.includes(TRIGGER), `"${TRIGGER}" is not listed on production`).toBe(true);
  for (const t of ['Email Sent from Saleshandy', 'Email is Opened in Saleshandy', TRIGGER]) console.log(`ON ${t}=${await zohoIntegration.isTriggerOn(t)}`);
  await configureCategory(zohoIntegration, saleshandyPage, [{ action: ZOHO_ACTION.contact, category: 'Interested' }]);
  await saleshandyPage.reload();
  await zohoIntegration.openTriggers();
  console.log('SAVED_ON=' + (await zohoIntegration.isTriggerOn(TRIGGER)));
  console.log('SAVED_ACTIONS=' + JSON.stringify(await zohoIntegration.selectedActivities(TRIGGER)));
  await expectSavedCategory(zohoIntegration, saleshandyPage, ZOHO_ACTION.contact, 'Interested');
  await saleshandyPage.screenshot({ path: `${SHOTS}/cc-prod-2-saved.png`, fullPage: true });
});
