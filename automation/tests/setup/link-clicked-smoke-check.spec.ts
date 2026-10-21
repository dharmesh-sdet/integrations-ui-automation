import { expect, test } from '../../src/fixtures/index.ts';

// Read-only look at the production Link Clicked smoke sequence (974015) after the
// 2026-10-15 run: Clicked counts of the two prospects and the Safety Settings
// switches. Nothing is clicked except tabs; no sends, no writes.
//   CHECK_SMOKE_SEQUENCE=1 npx playwright test tests/setup/link-clicked-smoke-check.spec.ts --project=chromium --workers=1
const ID = '974015';
const PEOPLE = ['Olena Kravchenko', 'Zawadi Swai'];

test.describe('Production check: Link Clicked smoke sequence', () => {
  test.skip(process.env.CHECK_SMOKE_SEQUENCE !== '1', 'Set CHECK_SMOKE_SEQUENCE=1');
  test.use({ account: 'emailopenedprod' });
  test.describe.configure({ retries: 0 });

  test('Read Clicked counts and Safety Settings', async ({ saleshandySequence, saleshandySequenceBuilder: builder }) => {
    for (const name of PEOPLE) {
      let value = 'row not found';
      try {
        value = String(await saleshandySequence.clickedCount(ID, name, 1));
      } catch (e) {
        value = `error: ${String(e).slice(0, 120)}`;
      }
      console.log(`CLICKED ${name} = ${value}`);
    }
    await builder.goto(`/sequence/${ID}/settings`);
    await builder.page.getByRole('button', { name: 'Safety Settings' }).click();
    for (const label of ['Track link clicks', 'Track email opens', 'Send emails as text only']) {
      console.log(`SWITCH ${label} = ${await builder.safetySettingChecked(label)}`);
    }
    expect(true).toBe(true);
  });
});
