// Production smoke test: Reply is Received in Saleshandy, Pipedrive.
// Checklist: notes/production-testing/15-pipedrive-reply-received.md (approved by QA 2026-10-29, 9 checks;
// fixed tickets AL-4184, AL-4186, AL-4187, AL-4188; AL-4172 is the workflow ticket). Each test body follows
// the staging test of the same activity in tests/pipedrive/reply-received.spec.ts (30 of 32 rows passed
// 2026-10-29), so a check passes or fails on the same assertions. Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts); the Pipedrive
//    company is the same one (saleshandy.pipedrive.com);
//  - the sequence comes from SMOKE_SEQUENCE_ID (one step);
//  - every check adds its prospect, sends step 1 (Send now) and marks that email as replied;
//  - realistic deal titles, no "Legacy" names (QA, 2026-10-28);
//  - after a trigger is saved the page is reloaded and the saved trigger is read back, and the check
//    stops before any send when another trigger is on;
//  - Update a Deal asserts Pipeline and Stage only: the staging title rule (prospect email) is unconfirmed.
// Checks do not delete what they create (QA, 2026-10-26).
//
// Run through scripts/run-pipedrive-reply-received-smoke.sh (npm run smoke:pipedrive-reply-received), which
// runs the gate (tests/setup/pipedrive-email-sent-prod-gate.spec.ts) first. Needs, once:
//   npm run login:saleshandy -- emailopenedprod    (headed, Cloudflare blocks headless)
//   npm run login:pipedrive -- emailopenedprod
// Data: test-data/pipedrive/reply-received-smoke.csv (scripts/make-pipedrive-reply-received-smoke-data.ts).
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { configure, fullName, recordLog, sendEmail, staysUnchanged, untilInPipedrive } from '../../src/flows/saleshandy-to-pipedrive.ts';
import { PD, PIPEDRIVE_PIPELINE } from '../../src/pages/saleshandy/pipedrive-integration.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';
import type { PipedriveIntegrationPage } from '../../src/pages/saleshandy/pipedrive-integration.page.ts';
import type { SaleshandySequencePage } from '../../src/pages/saleshandy/sequence.page.ts';
import type { PipedriveDealsPage } from '../../src/pages/pipedrive/deals.page.ts';
import type { PipedriveOrganizationsPage } from '../../src/pages/pipedrive/organizations.page.ts';
import type { PipedrivePeoplePage } from '../../src/pages/pipedrive/people.page.ts';

// Other smoke runs may share emailopenedprod, so saving a trigger leaves the other triggers as they are.
process.env.KEEP_OTHER_TRIGGERS ??= '1';

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

const TRIGGER = 'Reply is Received in Saleshandy';
// Any other trigger that is on would act on the same send and create records first.
const SIBLING_TRIGGERS = ['Email Sent from Saleshandy', 'Email is Opened in Saleshandy'];
const SUBJECT = TRIGGER;
const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '';
const CSV = 'pipedrive/reply-received-smoke.csv';

const QUALIFIED = { pipeline: PIPEDRIVE_PIPELINE, stage: 'Qualified' };
const CONTACT_MADE = { pipeline: PIPEDRIVE_PIPELINE, stage: 'Contact Made' };

// A check is one trigger save, one send, one Mark as replied and a Pipedrive look.
const CHECK = 8 * 60_000;

// Realistic deal names for the deals a check creates first (QA, 2026-10-28: no "Legacy" names).
const OLDER_DEAL = 'Annual renewal';
const NEWER_DEAL = 'Onboarding package';

// Organization Industry is a picklist in Pipedrive: one of the 20 options (organization-industry-list.md).
// Both columns are set because the Organisation Fields card maps both to the same Pipedrive field.
const PICKLIST_INDUSTRY = { Industry: 'Retail', 'Company Industry': 'Retail' };

type Prospect = { row: Row; email: string; name: string };

// The Scenario column holds the name of the staging row the check is built from.
function prospect(scenario: string, override: Record<string, string> = {}): Prospect {
  const found = readCsv(CSV).find((r) => r['Scenario'] === scenario);
  if (!found) throw new Error(`No row "${scenario}" in test-data/${CSV}. Run scripts/make-pipedrive-reply-received-smoke-data.ts.`);
  const row = { ...found, ...override };
  return { row, email: row['Email'], name: fullName(row) };
}

// Saves the trigger with the check's activities, reloads the page and reads the saved trigger back.
// Stops before any send when another trigger is on: a send would create the person first.
async function useTrigger(fx: Fx, picks: Parameters<typeof configure>[2]): Promise<void> {
  await configure(fx, TRIGGER, picks);
  await test.step('Reload and read the saved trigger back', async () => {
    await fx.pipedriveIntegration.openTriggers();
    expect(await fx.pipedriveIntegration.isTriggerOn(TRIGGER), `"${TRIGGER}" is on after the reload`).toBe(true);
    for (const sibling of SIBLING_TRIGGERS) {
      expect(await fx.pipedriveIntegration.isTriggerOn(sibling), `"${sibling}" is on. Turn it off and run again. No send was made.`).toBe(false);
    }
  });
}

// Adds the prospect, sends step 1 (Send now) and marks that email as replied.
async function reply(fx: Fx, p: Prospect): Promise<void> {
  if (!SEQUENCE_ID) throw new Error('SMOKE_SEQUENCE_ID is not set. Use scripts/run-pipedrive-reply-received-smoke.sh.');
  await sendEmail(fx, { sequenceId: SEQUENCE_ID, row: p.row, csv: CSV, step: 1 });
  await test.step(`Mark the step 1 email of ${p.name || p.email} as replied`, () =>
    fx.saleshandySequence.markAsReplied(SEQUENCE_ID, p.name, 1, p.email),
  );
}

// Records made by hand before the reply, so a change is visible. markUsed retires the CSV row at once:
// the record now exists, so a failed run must not reuse the person.
async function personFirst(fx: Fx, p: Prospect): Promise<string> {
  return test.step(`Create the person ${p.email} in Pipedrive`, async () => {
    markUsed(CSV, p.email);
    return fx.people.create({ name: p.name, email: p.email });
  });
}

async function dealsOnPerson(fx: Fx, personId: string, titles: string[]): Promise<void> {
  await test.step(`Create ${titles.length} deal(s) on the person`, async () => {
    for (const [i, title] of titles.entries()) await fx.deals.createOnPerson(personId, { title, value: 1800 + 600 * i });
  });
}

// Ids of the person's deals, oldest first. The Deals block can show after the page loads.
async function dealIdsOf(fx: Fx, personId: string, count: number): Promise<string[]> {
  let ids: string[] = [];
  await untilPasses(`The person page does not show ${count} deal(s)`, async () => {
    await fx.people.open(personId);
    ids = await fx.people.dealIds();
    expect(ids).toHaveLength(count);
  }, 90_000);
  return ids;
}

async function orgFirst(fx: Fx, p: Prospect, name: string): Promise<void> {
  await test.step(`Create the organization "${name}" in Pipedrive`, async () => {
    markUsed(CSV, p.email);
    await fx.orgs.create(name);
  });
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

test.describe('Reply is Received in Saleshandy, Pipedrive (production smoke)', () => {
  // 1. Create a Lead, Create a Deal and Create a Person, prospect not in Pipedrive (staging: Combined actions > 1, AL-4187)
  test('Create a Lead, Create a Deal and Create a Person: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(CHECK);
    const p = prospect('Combined actions > 1');
    await useTrigger(fx, [PD.createLead, { activity: PD.createDeal, extra: QUALIFIED }, PD.createPerson]);
    await reply(fx, p);
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Lead, deal and activity not all on the person', async () => {
      await fx.people.open(id);
      expect(await fx.people.leadTitles()).toEqual([p.name]);
      expect(await fx.people.dealTitles()).toEqual([p.name]);
      expect(await fx.people.activityCount()).toBe(1);
    });
    expect(await fx.people.idsByEmail(p.email), 'exactly one person').toEqual([id]);
  });

  // 2. Create a Person, person exists (staging: Create a Person > 2, AL-4186)
  test('Create a Person: person exists', async ({ fx }) => {
    test.setTimeout(CHECK);
    const p = prospect('Create a Person > 2');
    const id = await personFirst(fx, p);
    await useTrigger(fx, [PD.createPerson]);
    await reply(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Activity not added', async () => {
      await fx.people.open(id);
      expect(await fx.people.activityCount()).toBeGreaterThanOrEqual(1);
    });
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });

  // 3. Update a Person, person exists (staging: Update a Person > 1, AL-4186)
  test('Update a Person: person exists', async ({ fx }) => {
    test.setTimeout(CHECK);
    const p = prospect('Update a Person > 1');
    const id = await personFirst(fx, p);
    await useTrigger(fx, [PD.updatePerson]);
    await reply(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Activity not added to the person', async () => {
      await fx.people.open(id);
      expect(await fx.people.activityCount()).toBe(1);
    });
    const [activity] = await fx.people.activities();
    expect(activity).toMatchObject({ subject: SUBJECT, type: 'Email', done: true });
    test.info().annotations.push({ type: 'activity note', description: activity.note.slice(0, 300) });
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });

  // 4. Update a Deal, person has 2 deals (staging: Update a Deal > 1, AL-4184)
  test('Update a Deal: person has 2 deals', async ({ fx }) => {
    test.setTimeout(CHECK);
    const p = prospect('Update a Deal > 1');
    const id = await personFirst(fx, p);
    await dealsOnPerson(fx, id, [OLDER_DEAL, NEWER_DEAL]);
    const [older, newest] = await dealIdsOf(fx, id, 2);
    await useTrigger(fx, [{ activity: PD.updateDeal, extra: CONTACT_MADE }]);
    await reply(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not updated', async () => {
      const deal = await fx.deals.read(newest);
      expect(deal).toMatchObject({ pipeline: PIPEDRIVE_PIPELINE, stage: 'Contact Made' });
      test.info().annotations.push({ type: 'newest deal title', description: deal.title });
    });
    expect(await fx.deals.read(older), 'older deal unchanged').toMatchObject({ title: OLDER_DEAL, stage: 'Qualified' });
  });

  // 5. Delete Deal, person has 2 deals (staging: Delete Deal > 1, AL-4184)
  test('Delete Deal: person has 2 deals', async ({ fx }) => {
    test.setTimeout(CHECK);
    const p = prospect('Delete Deal > 1');
    const id = await personFirst(fx, p);
    await dealsOnPerson(fx, id, [OLDER_DEAL, NEWER_DEAL]);
    const [older] = await dealIdsOf(fx, id, 2);
    await useTrigger(fx, [PD.deleteDeal]);
    await reply(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not deleted', async () => {
      await fx.people.open(id);
      expect(await fx.people.dealIds()).toEqual([older]);
    });
  });

  // 6. Delete Person, person exists (staging: Delete Person > 1)
  test('Delete Person: person exists', async ({ fx }) => {
    test.setTimeout(CHECK);
    const p = prospect('Delete Person > 1');
    await personFirst(fx, p);
    await useTrigger(fx, [PD.deletePerson]);
    await reply(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Person ${p.email} not deleted`, async () => {
      expect(await fx.people.idsByEmail(p.email)).toHaveLength(0);
    });
  });

  // 7. Create Organization, Industry not in the Pipedrive list (staging: Create Organization > 3, AL-4188)
  test('Create Organization: Industry is not in the Pipedrive list', async ({ fx }) => {
    test.setTimeout(CHECK);
    const p = prospect('Create Organization > 3', { Industry: 'Cloud Computing', 'Company Industry': 'Cloud Computing' });
    const before = await fx.orgs.countByName(p.row['Company']);
    markUsed(CSV, p.email);
    await useTrigger(fx, [PD.createOrganization]);
    await reply(fx, p);
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company']), 'no organization created').toBe(before);
    });
    await recordLog(fx, TRIGGER);
  });

  // 8. Update Organization, exact company name exists (staging: Update Organization > 1)
  test('Update Organization: an organization with the exact company name exists', async ({ fx }) => {
    test.setTimeout(CHECK);
    const p = prospect('Update Organization > 1', PICKLIST_INDUSTRY);
    const before = await fx.orgs.countByName(p.row['Company']);
    await orgFirst(fx, p, p.row['Company']);
    await useTrigger(fx, [PD.updateOrganization]);
    await reply(fx, p);
    // Mapped fields are not read: the visible result is no second organization and a Logs entry.
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before + 1);
    });
    await recordLog(fx, TRIGGER);
  });

  // 9. Delete Organization, exact company name exists (staging: Delete Organization > 1)
  test('Delete Organization: an organization with the exact company name exists', async ({ fx }) => {
    test.setTimeout(CHECK);
    const p = prospect('Delete Organization > 1');
    const before = await fx.orgs.countByName(p.row['Company']);
    await orgFirst(fx, p, p.row['Company']);
    await useTrigger(fx, [PD.deleteOrganization]);
    await reply(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not deleted`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before);
    });
  });
});
