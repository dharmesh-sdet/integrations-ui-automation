import { expect, test } from '../../src/fixtures/index.ts';

// Extra Field Mapping pair for "Import Prospects from Salesforce" on the importprospects account (QA 2026-11-13):
// Contact Properties > Job Title to Title. src/config/salesforce-field-mapping.ts does not hold it (Job Title is
// unmapped by default on Contact). Run tests/setup/salesforce-field-mapping.spec.ts first for the other pairs.
// Safe to run again.
//   KEEP_TEST_DATA=1 SETUP_ACCOUNT_MAPPING=1 REPORT_OPEN=never npx playwright test --project=chromium tests/setup/salesforce-import-prospects-mapping.spec.ts --workers=1
test.describe('Setup: Import Prospects mapping', () => {
  test.skip(process.env.SETUP_ACCOUNT_MAPPING !== '1', 'Set SETUP_ACCOUNT_MAPPING=1 to change the Field Mapping');
  test.use({ account: 'importprospects' });
  test.describe.configure({ retries: 0 });

  test('Contact Properties: Job Title to Title', async ({ salesforceIntegration: sh }) => {
    test.setTimeout(5 * 60_000);
    await sh.openMapping('Contact');
    if ((await sh.mappedValue('Job Title')) !== 'Title') {
      await sh.mapField('Job Title', 'Title');
      let saved = false;
      for (let attempt = 1; attempt <= 3 && !saved; attempt++) {
        saved = await sh.trySaveMapping();
        if (!saved && attempt < 3) await sh.page.waitForTimeout(5_000);
      }
      expect(saved, 'Save confirmed').toBe(true);
    }
    await sh.openMapping('Contact');
    expect(await sh.mappedValue('Job Title'), 'Job Title after reload').toBe('Title');
  });
});
