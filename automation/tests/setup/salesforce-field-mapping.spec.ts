import { isAccount } from '../../src/config/accounts.ts';
import { EXPECTED_MAPPING, EXPECTED_UNMAPPED } from '../../src/config/salesforce-field-mapping.ts';
import { expect, test } from '../../src/fixtures/index.ts';
import type { MappingObject } from '../../src/pages/saleshandy/salesforce-integration.page.ts';

// Sets the Salesforce Field Mapping on a staging account, after QA has connected Salesforce.
// The pairs are in src/config/salesforce-field-mapping.ts. Safe to run again: only missing
// or different pairs are changed. Always run with KEEP_TEST_DATA=1.
//   KEEP_TEST_DATA=1 SETUP_ACCOUNT=sfemailopened REPORT_OPEN=never npx playwright test --project=chromium tests/setup/salesforce-field-mapping.spec.ts --workers=1
// Without SETUP_ACCOUNT it is skipped.
const account = process.env.SETUP_ACCOUNT;
const OBJECTS: MappingObject[] = ['Lead', 'Contact', 'Opportunity', 'Account'];

test.describe('Salesforce field mapping', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!account, 'Set SETUP_ACCOUNT=<account> to set the Salesforce field mapping');
  if (account && !isAccount(account)) throw new Error(`Unknown SETUP_ACCOUNT "${account}" (src/config/accounts.ts)`);
  test.use({ account: isAccount(account) ? account : undefined });

  test('Salesforce is connected', async ({ salesforceIntegration }) => {
    test.setTimeout(5 * 60_000);
    let connected = false;
    for (let attempt = 1; attempt <= 3 && !connected; attempt++) {
      connected = await salesforceIntegration.isConnected();
      if (!connected && attempt < 3) await salesforceIntegration.page.waitForTimeout(20_000);
    }
    expect(connected, 'Salesforce shows "Re-connect". Connect it by hand, then run again.').toBe(true);
  });

  for (const object of OBJECTS) {
    test(`Field mapping > ${object} Properties`, async ({ salesforceIntegration }) => {
      test.setTimeout(5 * 60_000);
      const expected: [string, string][] = [
        ...Object.entries(EXPECTED_MAPPING[object]),
        ...(EXPECTED_UNMAPPED[object] ?? []).map((field): [string, string] => [field, 'Select']),
      ];

      await salesforceIntegration.openMapping(object);
      const wrong: string[] = [];
      for (const [field, property] of expected) {
        if ((await salesforceIntegration.mappedValue(field)) !== property) wrong.push(field);
      }
      test.info().annotations.push({ type: `${object}: missing or different`, description: wrong.length ? wrong.join(', ') : 'none' });

      if (wrong.length) {
        for (const field of wrong) {
          if (EXPECTED_UNMAPPED[object]?.includes(field)) await salesforceIntegration.unmapField(field);
          else await salesforceIntegration.mapField(field, EXPECTED_MAPPING[object][field]);
        }
        let saved = false;
        for (let attempt = 1; attempt <= 3 && !saved; attempt++) {
          saved = await salesforceIntegration.trySaveMapping();
          if (!saved && attempt < 3) await salesforceIntegration.page.waitForTimeout(5_000);
        }
        test.info().annotations.push({ type: `${object}: save confirmed`, description: String(saved) });
      }

      await salesforceIntegration.openMapping(object);
      const problems: string[] = [];
      for (const [field, property] of expected) {
        const shown = await salesforceIntegration.mappedValue(field);
        if (shown !== property) problems.push(`${field}: "${shown}" (expected "${property}")`);
      }
      expect(problems, `${object} Properties after reload`).toEqual([]);
    });
  }
});
