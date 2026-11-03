import { expect, test } from '../../src/fixtures/index.ts';

// QA 2026-11-03: on gzoho, Account Fields mapped First Name to Zoho Account Name (set by hand earlier for a check).
// The Conversation Category rows expect the account named after the company, so Company goes to Account Name.
//   KEEP_TEST_DATA=1 npx playwright test tests/setup/zoho-account-name-mapping.spec.ts --project=chromium --workers=1
test.use({ account: 'gzoho' });

test('Account Fields: Company to Account Name, First Name unmapped', async ({ zohoIntegration: zoho }) => {
  await zoho.openMappingCard('Account Fields');
  if ((await zoho.mappedValue('First Name')) === 'Account Name') await zoho.unmapField('First Name');
  await zoho.mapField('Company', 'Account Name');
  await zoho.save();
  await zoho.savedToast().waitFor({ timeout: 30_000 });
  await zoho.openMappingCard('Account Fields');
  await expect.poll(() => zoho.mappedValue('Company'), { timeout: 15_000 }).toBe('Account Name');
  expect(await zoho.mappedValue('First Name')).toBe('Select');
});
