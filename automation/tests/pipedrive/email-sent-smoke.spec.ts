// Production smoke test: Email Sent from Saleshandy, Pipedrive.
// Checklist: notes/production-testing/09-pipedrive-email-sent.md (approved by QA 2026-10-27,
// 8 rows, no Jira ticket). Each test body follows the staging test with the same activity in
// tests/pipedrive/email-sent.spec.ts (all passed, 2026-10-27). Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts); the
//    Pipedrive company is the same one (saleshandy.pipedrive.com);
//  - the sequence comes from SMOKE_SEQUENCE_ID, nothing production is hard-coded;
//  - the Pipedrive session is auth/pipedrive-emailopenedprod-chromium.json;
//  - Create a Lead, Create a Deal and Create a Person are one row (Combined actions 1).
// Rows do not delete what they create (QA, 2026-10-26).
//
// Run through scripts/run-pipedrive-email-sent-smoke.sh (npm run smoke:pipedrive-email-sent), which
// runs the gate (tests/setup/pipedrive-email-sent-prod-gate.spec.ts) first. Needs, once:
//   npm run login:saleshandy -- emailopenedprod    (headed, Cloudflare blocks headless)
//   npm run login:pipedrive -- emailopenedprod
// Data: test-data/pipedrive/email-sent-smoke.csv (scripts/make-pipedrive-email-sent-smoke-data.ts).
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { configure, fullName, recordLog, sendEmail, staysUnchanged, untilInPipedrive } from '../../src/flows/saleshandy-to-pipedrive.ts';
import { PD, PIPEDRIVE_PIPELINE } from '../../src/pages/saleshandy/pipedrive-integration.page.ts';
import type { PipedriveIntegrationPage } from '../../src/pages/saleshandy/pipedrive-integration.page.ts';
import type { SaleshandySequencePage } from '../../src/pages/saleshandy/sequence.page.ts';
import type { PipedriveDealsPage } from '../../src/pages/pipedrive/deals.page.ts';
import type { PipedriveOrganizationsPage } from '../../src/pages/pipedrive/organizations.page.ts';
import type { PipedrivePeoplePage } from '../../src/pages/pipedrive/people.page.ts';

type Fx = {
  pipedriveIntegration: PipedriveIntegrationPage;
  saleshandySequence: SaleshandySequencePage;
  people: PipedrivePeoplePage;
  deals: PipedriveDealsPage;
  orgs: PipedriveOrganizationsPage;
};

const test = base.extend<{ fx: Fx }>({
  fx: async ({ pipedriveIntegration, saleshandySequence, pipedrivePeople, pipedriveDeals, pipedriveOrganizations }, use) =>
    use({ pipedriveIntegration, saleshandySequence, people: pipedrivePeople, deals: pipedriveDeals, orgs: pipedriveOrganizations }),
});

test.use({ account: 'emailopenedprod' });

const TRIGGER = 'Email Sent from Saleshandy';
const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '';
const CSV = 'pipedrive/email-sent-smoke.csv';

const QUALIFIED = { pipeline: PIPEDRIVE_PIPELINE, stage: 'Qualified' };
const CONTACT_MADE = { pipeline: PIPEDRIVE_PIPELINE, stage: 'Contact Made' };

// One send = Send now, a Pipedrive look and slow production pages.
const minutes = (sends: number): number => sends * 6 * 60_000;

// Industry of the rows that create an organization: one of the 20 Pipedrive picklist options. Both
// columns are set because the Organisation Fields card maps Industry and Company Industry to the same
// Pipedrive field (staging, 2026-10-26).
const PICKLIST_INDUSTRY = { Industry: 'Retail', 'Company Industry': 'Retail' };

type Prospect = { row: Row; email: string; name: string };

// The Scenario column holds the name of the staging row the smoke row is built from.
function prospect(scenario: string, override: Record<string, string> = {}): Prospect {
  const found = readCsv(CSV).find((r) => r['Scenario'] === scenario);
  if (!found) throw new Error(`No row "${scenario}" in test-data/${CSV}. Run scripts/make-pipedrive-email-sent-smoke-data.ts.`);
  const row = { ...found, ...override };
  return { row, email: row['Email'], name: fullName(row) };
}

// Records a row needs before the send, made by hand with the prospect's own email. markUsed retires
// the CSV row at once: the record now exists, so a failed run must not reuse the person.
async function personFirst(fx: Fx, p: Prospect): Promise<string> {
  return test.step(`Create the person ${p.email} in Pipedrive`, async () => {
    markUsed(CSV, p.email);
    return fx.people.create({ name: p.name || 'Legacy Person', email: p.email });
  });
}

async function legacyDeals(fx: Fx, personId: string, count: number): Promise<void> {
  await test.step(`Create ${count} legacy deal(s) on the person`, async () => {
    for (let i = 1; i <= count; i++) await fx.deals.createOnPerson(personId, { title: `Legacy deal ${i}`, value: 100 * i });
  });
}

async function orgFirst(fx: Fx, p: Prospect, name: string): Promise<void> {
  await test.step(`Create the organization "${name}" in Pipedrive`, async () => {
    markUsed(CSV, p.email);
    await fx.orgs.create(name);
  });
}

function send(fx: Fx, p: Prospect): Promise<void> {
  if (!SEQUENCE_ID) throw new Error('SMOKE_SEQUENCE_ID is not set. Use scripts/run-pipedrive-email-sent-smoke.sh.');
  return sendEmail(fx, { sequenceId: SEQUENCE_ID, row: p.row, csv: CSV, step: 1 });
}

async function expectOnePerson(fx: Fx, p: Prospect): Promise<string> {
  let id = '';
  await untilInPipedrive(fx, TRIGGER, `Person ${p.email} not found once in Pipedrive`, async () => {
    const ids = await fx.people.idsByEmail(p.email);
    expect(ids, `persons with ${p.email}`).toHaveLength(1);
    id = ids[0];
  });
  return id;
}

test.describe('Email Sent from Saleshandy, Pipedrive (production smoke)', () => {
  // 1. Create a Lead, Create a Deal and Create a Person
  test('Create a Lead, Create a Deal and Create a Person > 1: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Combined actions > 1');
    await configure(fx, TRIGGER, [PD.createLead, { activity: PD.createDeal, extra: QUALIFIED }, PD.createPerson]);
    await send(fx, p);
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Lead, deal and activity not all on the person', async () => {
      await fx.people.open(id);
      expect(await fx.people.leadTitles()).toEqual([p.email]);
      expect(await fx.people.dealTitles()).toEqual([p.email]);
      expect(await fx.people.activityCount()).toBe(1);
    });
    expect(await fx.people.idsByEmail(p.email), 'exactly one person').toEqual([id]);
  });

  // 2. Update a Deal
  test('Update a Deal > 1: person has 2 deals', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update a Deal > 1');
    const id = await personFirst(fx, p);
    await legacyDeals(fx, id, 2);
    const [older, newest] = await fx.people.open(id).then(() => fx.people.dealIds());
    await configure(fx, TRIGGER, [{ activity: PD.updateDeal, extra: CONTACT_MADE }]);
    await send(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not updated', async () => {
      expect(await fx.deals.read(newest)).toMatchObject({ title: p.email, pipeline: PIPEDRIVE_PIPELINE, stage: 'Contact Made' });
    });
    expect(await fx.deals.read(older), 'older deal unchanged').toMatchObject({ title: 'Legacy deal 1', stage: 'Qualified' });
  });

  // 3. Update a Person
  test('Update a Person > 1: person exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update a Person > 1');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.updatePerson]);
    await send(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Activity not added to the person', async () => {
      await fx.people.open(id);
      expect(await fx.people.activityCount()).toBe(1);
    });
    const [activity] = await fx.people.activities();
    expect(activity).toMatchObject({ subject: 'Email sent from Saleshandy', done: true });
    test.info().annotations.push({ type: 'activity note (should not hold the email body)', description: activity.note.slice(0, 300) });
    test.info().annotations.push({ type: 'person details after the update', description: JSON.stringify(await fx.people.details()) });
  });

  // 4. Delete Deal
  test('Delete Deal > 1: person has 2 deals', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Delete Deal > 1');
    const id = await personFirst(fx, p);
    await legacyDeals(fx, id, 2);
    await fx.people.open(id);
    const [older, newest] = await fx.people.dealIds();
    await configure(fx, TRIGGER, [PD.deleteDeal]);
    await send(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not deleted', async () => {
      await fx.people.open(id);
      expect(await fx.people.dealIds()).toEqual([older]);
    });
    expect(newest).not.toBe(older);
  });

  // 5. Delete Person
  test('Delete Person > 1: person exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Delete Person > 1');
    await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.deletePerson]);
    await send(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Person ${p.email} not deleted`, async () => {
      expect(await fx.people.idsByEmail(p.email)).toHaveLength(0);
    });
  });

  // 6. Create Organization
  test('Create Organization > 1: prospect has a company with Industry Retail, no organization with that name', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create Organization > 1', PICKLIST_INDUSTRY);
    const before = await fx.orgs.countByName(p.row['Company']);
    markUsed(CSV, p.email);
    await configure(fx, TRIGGER, [PD.createOrganization]);
    await send(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not created`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before + 1);
    });
    expect(await fx.people.idsByEmail(p.email), 'not linked to any person').toHaveLength(0);
  });

  // 7. Update Organization
  test('Update Organization > 1: an organization with the exact company name exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update Organization > 1', PICKLIST_INDUSTRY);
    const before = await fx.orgs.countByName(p.row['Company']);
    await orgFirst(fx, p, p.row['Company']);
    await configure(fx, TRIGGER, [PD.updateOrganization]);
    await send(fx, p);
    // The mapped fields of an organization are not read by the page object, so the visible result is
    // that no second organization appears; the Logs entry is recorded for QA.
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before + 1);
    });
    await recordLog(fx, TRIGGER);
  });

  // 8. Delete Organization
  test('Delete Organization > 1: an organization with the exact company name exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Delete Organization > 1', PICKLIST_INDUSTRY);
    const before = await fx.orgs.countByName(p.row['Company']);
    await orgFirst(fx, p, p.row['Company']);
    await configure(fx, TRIGGER, [PD.deleteOrganization]);
    await send(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not deleted`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before);
    });
  });
});
