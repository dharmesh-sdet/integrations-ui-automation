// Production smoke test: Link is Clicked in Saleshandy, Pipedrive.
// Checklist: notes/production-testing/11-pipedrive-link-clicked.md (approved by QA 2026-10-28, 11 rows,
// no fixed bug ticket; AL-4175 is the workflow ticket). Each test body follows the staging test of the
// same activity in tests/pipedrive/link-clicked.spec.ts (32 of 32, 2026-10-28), so a row passes or fails
// on the same assertions. Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts); the Pipedrive
//    company is the same one (saleshandy.pipedrive.com);
//  - the sequence comes from SMOKE_SEQUENCE_ID, nothing production is hard-coded;
//  - the Pipedrive session is auth/pipedrive-emailopenedprod-chromium.json;
//  - Create a Lead, Create a Deal and Create a Person are one row;
//  - production counts a first click only 90 s after the send and a second click 180 s after it
//    (developer, 2026-10-15), so a click waits for that time first;
//  - after a trigger is saved the page is reloaded and the saved activities are read back, and the row
//    stops before any send when "Email Sent from Saleshandy" or "Email is Opened in Saleshandy" is on;
//  - a row adds its prospect and sends step 1 itself, so there is no Setup test.
// Rows do not delete what they create (QA, 2026-10-26).
//
// Run through scripts/run-pipedrive-link-clicked-smoke.sh (npm run smoke:pipedrive-link-clicked), which
// runs the gate (tests/setup/pipedrive-email-sent-prod-gate.spec.ts) first. Needs, once:
//   npm run login:saleshandy -- emailopenedprod    (headed, Cloudflare blocks headless)
//   npm run login:pipedrive -- emailopenedprod
// Data: test-data/pipedrive/link-clicked-smoke.csv (scripts/make-pipedrive-link-clicked-smoke-data.ts).
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

const TRIGGER = 'Link is Clicked in Saleshandy';
const SIBLING_TRIGGERS = ['Email Sent from Saleshandy', 'Email is Opened in Saleshandy'];
const SUBJECT = 'Link is clicked in Saleshandy';
const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '';
// Printed by the setup spec; the same text is the subject of step 1.
const STEP_1_SUBJECT = process.env.SMOKE_STEP1_SUBJECT ?? 'Quick question about your outreach';
const CSV = 'pipedrive/link-clicked-smoke.csv';

const CONTACT_MADE = { pipeline: PIPEDRIVE_PIPELINE, stage: 'Contact Made' };
const QUALIFIED = { pipeline: PIPEDRIVE_PIPELINE, stage: 'Qualified' };

// Production click timing (developer, 2026-10-15): counted 90 s and 180 s after the send.
const FIRST_CLICK_AFTER = 90_000;
const SECOND_CLICK_AFTER = 180_000;
// Wait for the Clicked count on production, then the Pipedrive look. Row 3 clicks twice and the
// non-matching row waits 3 minutes.
const ROW_TIMEOUT = 14 * 60_000;
const NO_CLICK_WAIT = 3 * 60_000;

// Realistic deal names for the two deals a row creates first (QA, 2026-10-28: no "Legacy" names).
const OLDER_DEAL = 'Annual renewal';
const NEWER_DEAL = 'Onboarding package';

// Organization Industry is a picklist in Pipedrive: one of the 20 options (organization-industry-list.md).
// Both columns are set because the Organisation Fields card maps both to the same Pipedrive field.
const PICKLIST_INDUSTRY = { Industry: 'Retail', 'Company Industry': 'Retail' };

type Prospect = { row: Row; email: string; name: string; sentAt: number };

// The Scenario column holds the name of the staging row the smoke row is built from.
function prospect(scenario: string, override: Record<string, string> = {}): Prospect {
  const found = readCsv(CSV).find((r) => r['Scenario'] === scenario);
  if (!found) throw new Error(`No row "${scenario}" in test-data/${CSV}. Run scripts/make-pipedrive-link-clicked-smoke-data.ts.`);
  const row = { ...found, ...override };
  return { row, email: row['Email'], name: fullName(row), sentAt: 0 };
}

// Saves the trigger with the row's activities, reloads the page and reads the saved activities back.
// Stops before any send when Email Sent or Email Opened is on: a send would create the person first,
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

// Adds the prospect and sends step 1 (Send now). The send time starts the production click clock.
async function send(fx: Fx, p: Prospect): Promise<void> {
  if (!SEQUENCE_ID) throw new Error('SMOKE_SEQUENCE_ID is not set. Use scripts/run-pipedrive-link-clicked-smoke.sh.');
  await sendEmail(fx, { sequenceId: SEQUENCE_ID, row: p.row, csv: CSV, step: 1 });
  p.sentAt = Date.now();
}

// Clicks link `link` (0 = first) of the step 1 email once production counts it, then waits until the
// Clicked count rises. Returns the count, which a link scanner can push above the number of clicks.
async function click(fx: Fx, p: Prospect, link = 0): Promise<number> {
  const after = link === 0 ? FIRST_CLICK_AFTER : SECOND_CLICK_AFTER;
  const wait = p.sentAt + after - Date.now();
  if (wait > 0) await test.step(`Wait ${Math.ceil(wait / 1000)} s so production counts the click`, () => fx.saleshandySequence.page.waitForTimeout(wait));
  const clicked = () => fx.saleshandySequence.clickedCount(SEQUENCE_ID, p.name, 1, p.email);
  const before = await clicked();
  await test.step(`Click link ${link + 1} of the step 1 email in the Mailinator inbox of ${p.email}`, () =>
    fx.mailinator.clickFirstLink(p.email, STEP_1_SUBJECT, link),
  );
  let count = before;
  await test.step(`Wait until the Clicked count is above ${before}`, () =>
    untilPasses(`Clicked count for ${p.email} did not rise above ${before}`, async () => {
      count = await clicked();
      expect(count).toBeGreaterThan(before);
    }, 4 * 60_000),
  );
  test.info().annotations.push({ type: `Clicked count (link ${link + 1})`, description: String(count) });
  return count;
}

async function sendAndClick(fx: Fx, p: Prospect): Promise<void> {
  await send(fx, p);
  await click(fx, p);
}

// Records made by hand before the click, so a change is visible. markUsed retires the CSV row at once:
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

async function expectNoPerson(fx: Fx, p: Prospect): Promise<void> {
  await staysUnchanged(fx, async () => {
    expect(await fx.people.idsByEmail(p.email), `persons with ${p.email}`).toHaveLength(0);
  });
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

test.describe('Link is Clicked in Saleshandy, Pipedrive (production smoke)', () => {
  test.describe.configure({ timeout: ROW_TIMEOUT });

  // 1. Create a Lead, Create a Deal and Create a Person (staging: Trigger behavior > 5)
  test('Create a Lead, Create a Deal and Create a Person: prospect not in Pipedrive', async ({ fx }) => {
    const p = prospect('Trigger behavior > 5');
    await useTrigger(fx, [PD.createLead, { activity: PD.createDeal, extra: QUALIFIED }, PD.createPerson]);
    await sendAndClick(fx, p);
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Lead, deal and activity not all on the person', async () => {
      await fx.people.open(id);
      expect(await fx.people.leadTitles()).toEqual([p.email]);
      expect(await fx.people.dealTitles()).toEqual([p.email]);
      expect(await fx.people.activityCount()).toBe(1);
    });
    expect(await fx.people.idsByEmail(p.email), 'exactly one person').toEqual([id]);
  });

  // 2. Create a Person (staging: Create a Person > 1)
  test('Create a Person: person exists with an old value in a mapped field', async ({ fx }) => {
    const p = prospect('Create a Person > 1');
    const id = await personFirst(fx, p);
    await useTrigger(fx, [PD.createPerson]);
    await sendAndClick(fx, p);
    await activitiesAtLeast(fx, id, 1);
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
    // people.create takes name and email only, so the old value is not set. The details after the update
    // are recorded for QA, not asserted (same as staging).
    test.info().annotations.push({ type: 'person details after the update', description: JSON.stringify(await fx.people.details()) });
  });

  // 3. Create a Person, second link (staging: Trigger behavior > 3)
  test('Create a Person: prospect already clicked the first link, second link', async ({ fx }) => {
    const p = prospect('Trigger behavior > 3');
    await useTrigger(fx, [PD.createPerson]);
    await sendAndClick(fx, p);
    const id = await expectOnePerson(fx, p);
    const first = await activitiesAtLeast(fx, id, 1);
    const count = await click(fx, p, 1);
    expect(count, 'Clicked count after the second link').toBeGreaterThanOrEqual(2);
    await activitiesAtLeast(fx, id, first + 1);
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });

  // 4. Update a Deal (staging: Update a Deal > 1)
  test('Update a Deal: person has 2 deals', async ({ fx }) => {
    const p = prospect('Update a Deal > 1');
    const id = await personFirst(fx, p);
    await twoDeals(fx, id);
    await fx.people.open(id);
    const [older, newest] = await fx.people.dealIds();
    await useTrigger(fx, [{ activity: PD.updateDeal, extra: CONTACT_MADE }]);
    await sendAndClick(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not updated', async () => {
      expect(await fx.deals.read(newest)).toMatchObject({ title: p.email, pipeline: PIPEDRIVE_PIPELINE, stage: 'Contact Made' });
    });
    expect(await fx.deals.read(older), 'older deal unchanged').toMatchObject({ title: OLDER_DEAL, stage: 'Qualified' });
  });

  // 5. Update a Person (staging: Update a Person > 1)
  test('Update a Person: person exists with an old value in a mapped field', async ({ fx }) => {
    const p = prospect('Update a Person > 1');
    const id = await personFirst(fx, p);
    await useTrigger(fx, [PD.updatePerson]);
    await sendAndClick(fx, p);
    await activitiesAtLeast(fx, id, 1);
    const [activity] = await fx.people.activities();
    expect(activity).toMatchObject({ subject: SUBJECT, type: 'Email', done: true });
    test.info().annotations.push({ type: 'activity note', description: activity.note.slice(0, 300) });
    test.info().annotations.push({ type: 'person details after the update', description: JSON.stringify(await fx.people.details()) });
  });

  // 6. Delete Deal (staging: Delete Deal > 1)
  test('Delete Deal: person has 2 deals', async ({ fx }) => {
    const p = prospect('Delete Deal > 1');
    const id = await personFirst(fx, p);
    await twoDeals(fx, id);
    await fx.people.open(id);
    const [older] = await fx.people.dealIds();
    await useTrigger(fx, [PD.deleteDeal]);
    await sendAndClick(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not deleted', async () => {
      await fx.people.open(id);
      expect(await fx.people.dealIds()).toEqual([older]);
    });
  });

  // 7. Delete Person (staging: Delete Person > 1)
  test('Delete Person: person exists', async ({ fx }) => {
    const p = prospect('Delete Person > 1');
    await personFirst(fx, p);
    await useTrigger(fx, [PD.deletePerson]);
    await sendAndClick(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Person ${p.email} not deleted`, async () => {
      expect(await fx.people.idsByEmail(p.email)).toHaveLength(0);
    });
  });

  // 8. Create Organization (staging: Create Organization > 1)
  test('Create Organization: prospect has a company, no organization with that name', async ({ fx }) => {
    const p = prospect('Create Organization > 1', PICKLIST_INDUSTRY);
    const before = await fx.orgs.countByName(p.row['Company']);
    markUsed(CSV, p.email);
    await useTrigger(fx, [PD.createOrganization]);
    await sendAndClick(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not created`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBeGreaterThanOrEqual(before + 1);
    });
    expect(await fx.people.idsByEmail(p.email), 'not linked to any person').toHaveLength(0);
    // The organizations page object has no Details reader, so the mapped Organisation Fields are not
    // read (same gap as staging). The Logs entry is recorded for QA.
    await recordLog(fx, TRIGGER);
  });

  // 9. Update Organization (staging: Update Organization > 1)
  test('Update Organization: an organization with the exact company name exists', async ({ fx }) => {
    const p = prospect('Update Organization > 1', PICKLIST_INDUSTRY);
    const before = await fx.orgs.countByName(p.row['Company']);
    await orgFirst(fx, p, p.row['Company']);
    await useTrigger(fx, [PD.updateOrganization]);
    await sendAndClick(fx, p);
    // Mapped fields are not read: the visible result is no second organization and a Logs entry.
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before + 1);
    });
    await recordLog(fx, TRIGGER);
  });

  // 10. Delete Organization (staging: Delete Organization > 1)
  test('Delete Organization: an organization with the exact company name exists', async ({ fx }) => {
    const p = prospect('Delete Organization > 1');
    const before = await fx.orgs.countByName(p.row['Company']);
    await orgFirst(fx, p, p.row['Company']);
    await useTrigger(fx, [PD.deleteOrganization]);
    await sendAndClick(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not deleted`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before);
    });
  });

  // 11. Create a Person, open without a click (staging: Trigger behavior > 6, proposed, unconfirmed)
  test('Create a Person: prospect opens the step 1 email and does not click', async ({ fx }) => {
    const p = prospect('Trigger behavior > 6');
    await useTrigger(fx, [PD.createPerson]);
    await send(fx, p);
    await test.step(`Open the step 1 email in the Mailinator inbox of ${p.email}`, () => fx.mailinator.openEmail(p.email, STEP_1_SUBJECT));
    await fx.saleshandySequence.page.waitForTimeout(NO_CLICK_WAIT);
    await expectNoPerson(fx, p);
    expect(await fx.saleshandySequence.clickedCount(SEQUENCE_ID, p.name, 1, p.email), 'Clicked count').toBe(0);
    await recordLog(fx, TRIGGER);
  });
});
