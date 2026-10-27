// Smoke check of the Pipedrive page objects against staging (2026-10-24). No email is sent.
// Creates a person, a deal and an organization, reads them back, deletes them. Run it after a
// Pipedrive screen change, before blaming a workflow spec: KEEP_TEST_DATA=1 npx playwright test
// tests/setup/pipedrive-pages-check.spec.ts --project=chromium
// Leads and activities have no create step here (the workflow makes them); their readers were
// checked by hand on 2026-10-24, see context/pipedrive/RESUME.md.
import { expect, test } from '../../src/fixtures/index.ts';

test.use({ account: 'gpipedrive' });

test('Pipedrive page objects: person, deal, organization', async ({ pipedrivePeople, pipedriveDeals, pipedriveOrganizations }) => {
  const stamp = Date.now();
  const email = `dharmesh+pdcheck${stamp}@saleshandy.com`;
  const company = `PD Check Org ${stamp}`;

  const personId = await pipedrivePeople.create({ name: 'Pd Check', email });
  await pipedrivePeople.open(personId);
  expect(await pipedrivePeople.emails()).toContain(email);
  expect(await pipedrivePeople.activityCount()).toBe(0);
  expect(await pipedrivePeople.organization()).toBeUndefined();
  console.log('details', await pipedrivePeople.details());

  const dealId = await pipedriveDeals.createOnPerson(personId, { title: email, value: 100 });
  const deal = await pipedriveDeals.read(dealId);
  console.log('deal', deal);
  expect(deal.title).toBe(email);

  await pipedrivePeople.open(personId);
  expect(await pipedrivePeople.dealTitles()).toContain(email);

  const orgId = await pipedriveOrganizations.create(company);
  expect(await pipedriveOrganizations.countByName(company)).toBe(1);
  await pipedriveOrganizations.open(orgId);
  expect(await pipedriveOrganizations.name()).toBe(company);

  await pipedriveOrganizations.deleteOpen();
  expect(await pipedriveOrganizations.countByName(company)).toBe(0);
  await pipedriveDeals.open(dealId);
  await pipedriveDeals.deleteOpen();
  await pipedrivePeople.open(personId);
  await pipedrivePeople.deleteOpen();
  expect(await pipedrivePeople.countByEmail(email)).toBe(0);
});
