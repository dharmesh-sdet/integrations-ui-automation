import { expect, test } from '../../src/fixtures/index.ts';

// Read-only look at the production Reply Received smoke sequence after the setup
// spec: its id, whether it is in the list, and what its Steps tab shows. Nothing
// is changed.
//   CHECK_SMOKE_SEQUENCE=1 npx playwright test tests/setup/reply-received-smoke-check.spec.ts --project=chromium --workers=1
const NAME = 'HubSpot Reply Received Smoke';

test.describe('Production check: Reply Received smoke sequence', () => {
  test.skip(process.env.CHECK_SMOKE_SEQUENCE !== '1', 'Set CHECK_SMOKE_SEQUENCE=1');
  test.use({ account: 'emailopenedprod' });
  test.describe.configure({ retries: 0 });

  test('Read id and steps', async ({ saleshandySequenceBuilder: builder }) => {
    await builder.openList();
    const rows = await builder.page.getByRole('row').filter({ has: builder.page.getByText(NAME, { exact: true }) }).count();
    console.log(`IN_LIST ${NAME} rows=${rows}`);
    if (rows > 0) {
      await builder.openExisting(NAME);
      console.log(`SEQUENCE_ID=${builder.currentSequenceId()}`);
      await builder.page.getByRole('button', { name: 'Add Step' }).first().waitFor({ timeout: 30_000 }).catch(() => {});
      const text = (await builder.page.locator('body').innerText()).replace(/\s+/g, ' ');
      console.log(`STEPS_TAB ${text.slice(0, 700)}`);
      const names = await builder.page.getByRole('button').evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()).filter((t) => /step/i.test(t)));
      console.log(`STEP_BUTTONS ${JSON.stringify(names)}`);
      console.log(`ADD_STEP_VISIBLE ${await builder.page.getByRole('button', { name: 'Add Step' }).first().isVisible()}`);
      console.log(`ACTIVE ${await builder.page.locator('.switchToggle').first().locator('input[name="Switch"]').isChecked().catch(() => 'unknown')}`);
    }
    expect(true).toBe(true);
  });
});
