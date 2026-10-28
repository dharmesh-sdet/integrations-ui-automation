// Production smoke test: Email is Opened in Saleshandy, Pipedrive.
// Checklist: notes/production-testing/13-pipedrive-email-opened.md (approved by QA 2026-10-28, 9 rows,
// no fixed bug ticket; AL-4174 is the workflow ticket). Each test body follows the staging test of the
// same activity in tests/pipedrive/email-opened.spec.ts (26 of 26, 2026-10-28), so a row passes or fails
// on the same assertions. Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts); the Pipedrive
//    company is the same one (saleshandy.pipedrive.com);
//  - the sequence comes from SMOKE_SEQUENCE_ID, nothing production is hard-coded;
//  - the Pipedrive session is auth/pipedrive-emailopenedprod-chromium.json;
//  - Create a Lead, Create a Deal and Create a Person are one row;
//  - production counts a first open only 60 s after the send and a second open 120 s after the first
//    (developer, 2026-10-15), so an open waits for that time first;
//  - after a trigger is saved the page is reloaded and the saved activities are read back, and the row
//    stops before any send when "Email Sent from Saleshandy" or "Link is Clicked in Saleshandy" is on;
//  - a row adds its prospect and sends step 1 itself, so there is no Setup test.
// Rows do not delete what they create (QA, 2026-10-26).
//
// Run through scripts/run-pipedrive-email-opened-smoke.sh (npm run smoke:pipedrive-email-opened), which
// runs the gate (tests/setup/pipedrive-email-sent-prod-gate.spec.ts) first. Needs, once:
//   npm run login:saleshandy -- emailopenedprod    (headed, Cloudflare blocks headless)
//   npm run login:pipedrive -- emailopenedprod
// Data: test-data/pipedrive/email-opened-smoke.csv (scripts/make-pipedrive-email-opened-smoke-data.ts).
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { configure, fullName, recordLog, sendEmail, staysUnchanged, untilInPipedrive } from '../../src/flows/saleshandy-to-pipedrive.ts';
import { PD, PIPEDRIVE_PIPELINE } from '../../src/pages/saleshandy/pipedrive-integration.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';
import type { MailinatorPage } from '../../src/pages/mailinator.page.ts';
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
  mailinator: MailinatorPage;
};

const test = base.extend<{ fx: Fx }>({
  fx: async ({ pipedriveIntegration, saleshandySequence, pipedrivePeople, pipedriveDeals, pipedriveOrganizations, mailinator }, use) =>
    use({ pipedriveIntegration, saleshandySequence, people: pipedrivePeople, deals: pipedriveDeals, orgs: pipedriveOrganizations, mailinator }),
});

test.use({ account: 'emailopenedprod' });

const TRIGGER = 'Email is Opened in Saleshandy';
const SIBLING_TRIGGERS = ['Email Sent from Saleshandy', 'Link is Clicked in Saleshandy'];
const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '';
// Printed by the setup spec; the same text is the subject of step 1.
const STEP_1_SUBJECT = process.env.SMOKE_STEP1_SUBJECT ?? 'Quick question about your outreach';
const CSV = 'pipedrive/email-opened-smoke.csv';

const CONTACT_MADE = { pipeline: PIPEDRIVE_PIPELINE, stage: 'Contact Made' };
const QUALIFIED = { pipeline: PIPEDRIVE_PIPELINE, stage: 'Qualified' };

// Production open timing (developer, 2026-10-15): a first open is counted 60 s after the send, a second
// open 120 s after the first.
const FIRST_OPEN_AFTER = 60_000;
const SECOND_OPEN_AFTER = 120_000;
// One row = a trigger save, records made by hand, a Send now, the wait, the open and slow production pages.
// The second-open row opens twice.
const ROW_TIMEOUT = 14 * 60_000;

// Realistic deal names for the two deals a row creates first (QA, 2026-10-28: no "Legacy" names).
const OLDER_DEAL = 'Annual renewal';
const NEWER_DEAL = 'Onboarding package';

// Organization Industry is a picklist in Pipedrive: one of the 20 options (organization-industry-list.md).
// Both columns are set because the Organisation Fields card maps both to the same Pipedrive field.
const PICKLIST_INDUSTRY = { Industry: 'Retail', 'Company Industry': 'Retail' };

type Prospect = { row: Row; email: string; name: string; sentAt: number; firstOpenAt: number };

// The Scenario column holds the name of the staging row the smoke row is built from.
function prospect(scenario: string, override: Record<string, string> = {}): Prospect {
  const found = readCsv(CSV).find((r) => r['Scenario'] === scenario);
  if (!found) throw new Error(`No row "${scenario}" in test-data/${CSV}. Run scripts/make-pipedrive-email-opened-smoke-data.ts.`);
  const row = { ...found, ...override };
  return { row, email: row['Email'], name: fullName(row), sentAt: 0, firstOpenAt: 0 };
}

// Saves the trigger with the row's activities, reloads the page and reads the saved trigger back.
// Stops before any send when Email Sent or Link is Clicked is on: a send would create the person first,
// and a link click also counts as an open.
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

// Adds the prospect and sends step 1 (Send now). The send time starts the production open clock.
async function send(fx: Fx, p: Prospect): Promise<void> {
  if (!SEQUENCE_ID) throw new Error('SMOKE_SEQUENCE_ID is not set. Use scripts/run-pipedrive-email-opened-smoke.sh.');
  await sendEmail(fx, { sequenceId: SEQUENCE_ID, row: p.row, csv: CSV, step: 1 });
  p.sentAt = Date.now();
}

// Opens the step 1 email in the Mailinator inbox once production counts it (60 s after the send for a
// first open, 120 s after the first for a second one), then waits until the Opened count rises. Returns
// the count, which an image-prefetching client can push above the number of opens.
async function open(fx: Fx, p: Prospect, second = false): Promise<number> {
  const wait = second ? p.firstOpenAt + SECOND_OPEN_AFTER - Date.now() : p.sentAt + FIRST_OPEN_AFTER - Date.now();
  if (wait > 0) await test.step(`Wait ${Math.ceil(wait / 1000)} s so production counts the open`, () => fx.saleshandySequence.page.waitForTimeout(wait));
  const opened = () => fx.saleshandySequence.openedCount(SEQUENCE_ID, p.name, 1);
  const before = await opened();
  await test.step(`Open the step 1 email in the Mailinator inbox of ${p.email}`, () => fx.mailinator.openEmail(p.email, STEP_1_SUBJECT));
  if (!second) p.firstOpenAt = Date.now();
  let count = before;
  await test.step(`Wait until the Opened count is above ${before}`, () =>
    untilPasses(`Opened count for ${p.email} did not rise above ${before}`, async () => {
      count = await opened();
      expect(count).toBeGreaterThan(before);
    }, 4 * 60_000),
  );
  test.info().annotations.push({ type: `Opened count (${second ? 'second' : 'first'} open)`, description: String(count) });
  return count;
}

async function sendAndOpen(fx: Fx, p: Prospect): Promise<void> {
  await send(fx, p);
  await open(fx, p);
}

// Records made by hand before the open, so a change is visible. markUsed retires the CSV row at once:
// the record now exists, so a failed run must not reuse the person.
async function personFirst(fx: Fx, p: Prospect): Promise<string> {
  return test.step(`Create the person ${p.email} in Pipedrive`, async () => {
    markUsed(CSV, p.email);
    return fx.people.create({ name: p.name, email: p.email });
  });
}

async function twoDeals(fx: Fx, personId: string): Promise<void> {
  await test.step('Create 2 deals on the person', async () => {
    await fx.deals.createOnPerson(personId, { title: OLDER_DEAL, value: 1800 });
    await fx.deals.createOnPerson(personId, { title: NEWER_DEAL, value: 2400 });
  });
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

// Waits until the person has at least `atLeast` activities; returns the count seen.
async function activitiesAtLeast(fx: Fx, id: string, atLeast: number): Promise<number> {
  let count = 0;
  await untilInPipedrive(fx, TRIGGER, `Fewer than ${atLeast} activities on the person`, async () => {
    await fx.people.open(id);
    count = await fx.people.activityCount();
    expect(count).toBeGreaterThanOrEqual(atLeast);
  });
  test.info().annotations.push({ type: 'activities on the person', description: String(count) });
  return count;
}

test.describe('Email is Opened in Saleshandy, Pipedrive (production smoke)', () => {
  test.describe.configure({ timeout: ROW_TIMEOUT });

  // 1. Create a Lead, Create a Deal and Create a Person (staging: Combined actions > 1)
  test('Create a Lead, Create a Deal and Create a Person: prospect not in Pipedrive', async ({ fx }) => {
    const p = prospect('Combined actions > 1');
    await useTrigger(fx, [PD.createLead, { activity: PD.createDeal, extra: QUALIFIED }, PD.createPerson]);
    await sendAndOpen(fx, p);
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Lead, deal and activity not all on the person', async () => {
      await fx.people.open(id);
      expect(await fx.people.leadTitles()).toContain(p.email);
      expect(await fx.people.dealTitles()).toContain(p.email);
      expect(await fx.people.activityCount()).toBeGreaterThanOrEqual(1);
    });
    expect(await fx.people.idsByEmail(p.email), 'exactly one person').toEqual([id]);
  });

  // 2. Create a Person, second open (staging: Trigger behavior > 3)
  test('Create a Person: person exists, email opened a second time', async ({ fx }) => {
    const p = prospect('Trigger behavior > 3');
    await useTrigger(fx, [PD.createPerson]);
    await sendAndOpen(fx, p);
    const id = await expectOnePerson(fx, p);
    const first = await activitiesAtLeast(fx, id, 1);
    const count = await open(fx, p, true);
    expect(count, 'Opened count after the second open').toBeGreaterThanOrEqual(2);
    await activitiesAtLeast(fx, id, first + 1);
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });

  // 3. Update a Person (staging: Update a Person > 1)
  test('Update a Person: person exists with an old value in a mapped field', async ({ fx }) => {
    const p = prospect('Update a Person > 1');
    const id = await personFirst(fx, p);
    await useTrigger(fx, [PD.updatePerson]);
    await sendAndOpen(fx, p);
    await activitiesAtLeast(fx, id, 1);
    const [activity] = await fx.people.activities();
    expect(activity).toMatchObject({ subject: 'Email Open Recorded in Saleshandy', type: 'Email', done: true });
    test.info().annotations.push({ type: 'activity note', description: activity.note.slice(0, 300) });
    // people.create takes name and email only, so the old value is not set. The details after the update
    // are recorded for QA, not asserted (same as staging).
    test.info().annotations.push({ type: 'person details after the update', description: JSON.stringify(await fx.people.details()) });
  });

  // 4. Update a Deal (staging: Update a Deal > 1)
  test('Update a Deal: person has 2 deals', async ({ fx }) => {
    const p = prospect('Update a Deal > 1');
    const id = await personFirst(fx, p);
    await twoDeals(fx, id);
    await fx.people.open(id);
    const [older, newest] = await fx.people.dealIds();
    await useTrigger(fx, [{ activity: PD.updateDeal, extra: CONTACT_MADE }]);
    await sendAndOpen(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not updated', async () => {
      expect(await fx.deals.read(newest)).toMatchObject({ title: p.email, pipeline: PIPEDRIVE_PIPELINE, stage: 'Contact Made' });
    });
    expect(await fx.deals.read(older), 'older deal unchanged').toMatchObject({ title: OLDER_DEAL, stage: 'Qualified' });
  });

  // 5. Delete Deal (staging: Delete Deal > 1)
  test('Delete Deal: person has 2 deals', async ({ fx }) => {
    const p = prospect('Delete Deal > 1');
    const id = await personFirst(fx, p);
    await twoDeals(fx, id);
    await fx.people.open(id);
    const [older] = await fx.people.dealIds();
    await useTrigger(fx, [PD.deleteDeal]);
    await sendAndOpen(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not deleted', async () => {
      await fx.people.open(id);
      expect(await fx.people.dealIds()).toEqual([older]);
    });
  });

  // 6. Delete Person (staging: Delete Person > 1)
  test('Delete Person: person exists', async ({ fx }) => {
    const p = prospect('Delete Person > 1');
    await personFirst(fx, p);
    await useTrigger(fx, [PD.deletePerson]);
    await sendAndOpen(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Person ${p.email} not deleted`, async () => {
      expect(await fx.people.idsByEmail(p.email)).toHaveLength(0);
    });
  });

  // 7. Create Organization (staging: Create Organization > 1)
  test('Create Organization: prospect has a company, no organization with that name', async ({ fx }) => {
    const p = prospect('Create Organization > 1', PICKLIST_INDUSTRY);
    const before = await fx.orgs.countByName(p.row['Company']);
    markUsed(CSV, p.email);
    await useTrigger(fx, [PD.createOrganization]);
    await sendAndOpen(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not created`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBeGreaterThanOrEqual(before + 1);
    });
    expect(await fx.people.idsByEmail(p.email), 'not linked to any person').toHaveLength(0);
    // The organizations page object has no Details reader, so the mapped Organisation Fields are not
    // read (same gap as staging). The Logs entry is recorded for QA.
    await recordLog(fx, TRIGGER);
  });

  // 8. Update Organization (staging: Update Organization > 1)
  test('Update Organization: an organization with the exact company name exists', async ({ fx }) => {
    const p = prospect('Update Organization > 1', PICKLIST_INDUSTRY);
    const before = await fx.orgs.countByName(p.row['Company']);
    await orgFirst(fx, p, p.row['Company']);
    await useTrigger(fx, [PD.updateOrganization]);
    await sendAndOpen(fx, p);
    // Mapped fields are not read: the visible result is no second organization and a Logs entry.
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before + 1);
    });
    await recordLog(fx, TRIGGER);
  });

  // 9. Delete Organization (staging: Delete Organization > 1)
  test('Delete Organization: an organization with the exact company name exists', async ({ fx }) => {
    const p = prospect('Delete Organization > 1', PICKLIST_INDUSTRY);
    const before = await fx.orgs.countByName(p.row['Company']);
    await orgFirst(fx, p, p.row['Company']);
    await useTrigger(fx, [PD.deleteOrganization]);
    await sendAndOpen(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not deleted`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before);
    });
  });
});
