import { expect, test } from '../../src/fixtures/index.ts';
import { TRIGGER } from '../../src/flows/zoho-conversation-category-updated.ts';
import { ZOHO_ACTION } from '../../src/flows/saleshandy-to-zoho.ts';

// Read only probe (not committed): prints what the Contact action under the trigger holds after a reload.
test.skip(process.env.CC_PROBE !== '1', 'CC_PROBE=1');
test.use({ account: 'notemailsentzoho' });
test('probe saved category', async ({ zohoIntegration, saleshandyPage }) => {
  await zohoIntegration.openTriggers();
  await zohoIntegration.reopenExtraConfiguration(TRIGGER, ZOHO_ACTION.contact);
  const dialog = saleshandyPage.getByRole('dialog');
  await dialog.waitFor({ timeout: 15_000 });
  console.log('DIALOG=' + (await dialog.innerText()).replace(/\n+/g, ' | '));
  console.log('TEXTBOX=' + JSON.stringify(await dialog.getByRole('textbox').last().inputValue().catch(() => 'n/a')));
  await saleshandyPage.screenshot({ path: '/tmp/claude-1002/cc-probe.png' });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(true).toBe(true);
});
