import { expect, test } from '../../src/fixtures/index.ts';
import { OUTCOME } from '../../src/flows/zoho-conversation-category-updated.ts';

// Production read only probe, not committed. Opens the outcome dropdown of the first prospect of a sequence, lists the
// options and closes it without picking one. QA asked for it on 2026-11-04.
test.skip(process.env.CC_PROD_PROBE !== '1', 'CC_PROD_PROBE=1');
test.use({ account: 'emailopenedprod' });
test.describe.configure({ retries: 0 });

test('production: outcome dropdown options', async ({ saleshandySequence, saleshandyPage }) => {
  await saleshandySequence.openProspects(process.env.PROBE_SEQ ?? '989765');
  const selects = saleshandyPage.locator('.prospect-custom-outcome-select');
  await selects.first().waitFor({ timeout: 30_000 });
  console.log('SELECTS=' + (await selects.count()));
  await selects.first().click();
  const items = saleshandyPage.locator('li');
  await items.first().waitFor({ timeout: 10_000 });
  const texts = (await items.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  console.log('OPTIONS=' + JSON.stringify(texts));
  await saleshandyPage.keyboard.press('Escape');
  for (const o of Object.values(OUTCOME)) expect(texts, `option "${o}"`).toContain(o);
});
