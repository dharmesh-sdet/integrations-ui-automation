import { isAccount } from '../../src/config/accounts.ts';
import { ZOHO_FIELD_MAPPING, ZOHO_MAPPING_CARDS } from '../../src/config/zoho-field-mapping.ts';
import { expect, test } from '../../src/fixtures/index.ts';

// Sets the Zoho Field Mapping on a new account, after QA has created it and connected Zoho.
// The pairs are in src/config/zoho-field-mapping.ts. Safe to run again: each pair is chosen
// again with the same value, and rows that are not listed are left as they are.
// Staging or production follows the account (`environment` in src/config/accounts.ts).
//   SETUP_ACCOUNT=gzoho REPORT_OPEN=never npm test -- tests/setup/zoho-field-mapping.spec.ts --workers=1
// Without SETUP_ACCOUNT it is skipped.
const account = process.env.SETUP_ACCOUNT;

test.describe('Zoho field mapping', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!account, 'Set SETUP_ACCOUNT=<account> to set the Zoho field mapping');
  if (account && !isAccount(account)) throw new Error(`Unknown SETUP_ACCOUNT "${account}" (src/config/accounts.ts)`);
  test.use({ account: isAccount(account) ? account : undefined });

  test('Zoho is connected', async ({ zohoIntegration: zoho }) => {
    // A disconnected account has nothing to map. Stop here and tell QA to connect Zoho first.
    expect(await zoho.isConnected(), 'Zoho is not connected on this account. Connect it by hand, then run again.').toBe(true);
  });

  for (const card of ZOHO_MAPPING_CARDS) {
    test(`Field mapping > ${card}`, async ({ zohoIntegration: zoho }) => {
      const wanted = ZOHO_FIELD_MAPPING[card];

      await test.step(`Open ${card}`, async () => {
        await zoho.openMappingCard(card);
      });

      await test.step('Choose the Zoho field for each Saleshandy field, then Save', async () => {
        for (const [field, zohoField] of Object.entries(wanted)) await zoho.mapField(field, zohoField);
        await zoho.save();
        await zoho.savedToast().waitFor({ timeout: 30_000 });
      });

      await test.step('Reload and check every pair is saved', async () => {
        await zoho.openMappingCard(card);
        await expect
          .poll(
            async () => {
              const wrong: string[] = [];
              for (const [field, zohoField] of Object.entries(wanted)) {
                if ((await zoho.mappedValue(field)) !== zohoField) wrong.push(field);
              }
              return wrong;
            },
            { message: 'Saleshandy fields not saved with the wanted Zoho field', timeout: 15_000 },
          )
          .toEqual([]);
      });
    });
  }
});
