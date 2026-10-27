import { test } from '../../src/fixtures/index.ts';

// Throwaway (2026-10-26): removes the persons the probe unsubscribe left in Pipedrive.
//   EXPLORE=1 KEEP_TEST_DATA=1 npx playwright test tests/setup/pipedrive-unsubscribed-explore.spec.ts --project=chromium --workers=1 --output=<private dir>
test.skip(process.env.EXPLORE !== '1', 'Set EXPLORE=1');
test.use({ account: 'gpipedrive' });

test('remove the probe persons', async ({ pipedrivePeople }) => {
  test.setTimeout(4 * 60_000);
  for (const id of await pipedrivePeople.idsByEmail('ibrahim.rasheed@mailinator.com')) {
    await pipedrivePeople.open(id);
    await pipedrivePeople.deleteOpen();
  }
  console.log(`left: ${JSON.stringify(await pipedrivePeople.idsByEmail('ibrahim.rasheed@mailinator.com'))}`);
});
