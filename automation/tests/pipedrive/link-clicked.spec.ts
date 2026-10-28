// Scenarios: test-cases/pipedrive/link-clicked.md (Regression, 32 rows, QA "looks good" 2026-10-27;
//   workflow ticket AL-4175, same ticket on every row). One test per row, named "<section>: <n>".
// Data: test-data/pipedrive/link-clicked.csv, one prospect per row, found by the Scenario column.
//   A row that clicks a second link or a step 2 link makes its first click itself, so every row runs alone.
//   A record that must exist first is made by hand in Pipedrive with the prospect's email.
// Sequence: "Pipedrive Link Clicked QA" on gpipedrive, 2 steps with 2 links each, Track link clicks on,
//   sender Kartik 7 (tests/setup/pipedrive-link-clicked-sequence.spec.ts). Put its id in PD_LINK_SEQUENCE_ID.
// Page objects and flow: same as tests/pipedrive/reply-received.spec.ts.
//
// How a row runs: set the trigger (only "Link is Clicked in Saleshandy" on), make the Pipedrive records
// the row needs, add the prospect and send step 1, then click the link in the Mailinator inbox and wait
// until the Clicked count of the Emails tab rises. Then look in Pipedrive 15 s later, every 10 s after
// that; Logs only if the record is missing (QA, 2026-10-23). Rows do not delete what they create
// (QA, 2026-10-26). Other triggers are left as they are (KEEP_OTHER_TRIGGERS), so Email Sent must be OFF
// on gpipedrive before the run.
//
// A link scanner can turn one real click into 2 or 3 runs (Saleshandy event behavior). Rows that expect
// "one activity" or "one lead" check for at least one and record the count; they do not fail on extra runs.
// Rows that expect "still 1 person" are strict. Known issues are recorded, not filed: B1 and B2 (Update a
// Person / Update a Deal / Delete Deal with no person end in Error), double persons from one event (AL-4177).
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
import type { PipedriveLeadsPage } from '../../src/pages/pipedrive/leads.page.ts';
import type { PipedriveOrganizationsPage } from '../../src/pages/pipedrive/organizations.page.ts';
import type { PipedrivePeoplePage } from '../../src/pages/pipedrive/people.page.ts';

process.env.KEEP_OTHER_TRIGGERS ??= '1';

type Fx = {
  pipedriveIntegration: PipedriveIntegrationPage;
  saleshandySequence: SaleshandySequencePage;
  people: PipedrivePeoplePage;
  deals: PipedriveDealsPage;
  leads: PipedriveLeadsPage;
  orgs: PipedriveOrganizationsPage;
  mailinator: MailinatorPage;
};

const test = base.extend<{ fx: Fx }>({
  fx: async ({ pipedriveIntegration, saleshandySequence, pipedrivePeople, pipedriveDeals, pipedriveLeads, pipedriveOrganizations, mailinator }, use) =>
    use({ pipedriveIntegration, saleshandySequence, people: pipedrivePeople, deals: pipedriveDeals, leads: pipedriveLeads, orgs: pipedriveOrganizations, mailinator }),
});

test.use({ account: 'gpipedrive' });

// Name on Triggers & Activity and in Logs, and the subject of the activity it adds.
const TRIGGER = 'Link is Clicked in Saleshandy';
const SUBJECT = 'Link is clicked in Saleshandy';
// TODO(needs-input): id of "Pipedrive Link Clicked QA", printed by the setup spec.
const SEQUENCE_ID = process.env.PD_LINK_SEQUENCE_ID ?? '';
const CSV = 'pipedrive/link-clicked.csv';
// Subjects of the two steps, from the setup spec.
const STEP_1_SUBJECT = 'Quick question about your outreach';
const STEP_2_SUBJECT = 'Following up on my last note';

const QUALIFIED = { pipeline: PIPEDRIVE_PIPELINE, stage: 'Qualified' };
const CONTACT_MADE = { pipeline: PIPEDRIVE_PIPELINE, stage: 'Contact Made' };

// One row = the sequence gap, Send now, the Mailinator click and a Pipedrive look. A row with a second
// click adds a second look.
const minutes = (clicks: number): number => (clicks + 1) * 3 * 60_000;

// Organization Industry is a picklist in Pipedrive; the rows that are not about Industry use a valid
// option (organization-industry-list.md). Both columns are set because the Organisation Fields card
// maps both to the same Pipedrive field.
const PICKLIST_INDUSTRY = { Industry: 'Retail', 'Company Industry': 'Retail' };

type Prospect = { row: Row; email: string; name: string };

function prospect(scenario: string, override: Record<string, string> = {}): Prospect {
  const found = readCsv(CSV).find((r) => r['Scenario'] === scenario);
  if (!found) throw new Error(`No row "${scenario}" in test-data/${CSV}`);
  const row = { ...found, ...override };
  return { row, email: row['Email'], name: fullName(row) };
}

async function personFirst(fx: Fx, p: Prospect): Promise<string> {
  return test.step(`Create the person ${p.email} in Pipedrive`, async () => {
    markUsed(CSV, p.email);
    return fx.people.create({ name: p.name || 'Legacy Person', email: p.email });
  });
}

async function legacyDeals(fx: Fx, personId: string, count: number): Promise<string[]> {
  const titles: string[] = [];
  await test.step(`Create ${count} legacy deal(s) on the person`, async () => {
    for (let i = 1; i <= count; i++) {
      const title = `Legacy deal ${i}`;
      await fx.deals.createOnPerson(personId, { title, value: 100 * i });
      titles.push(title);
    }
  });
  return titles;
}

async function orgFirst(fx: Fx, p: Prospect, name: string): Promise<string> {
  return test.step(`Create the organization "${name}" in Pipedrive`, async () => {
    markUsed(CSV, p.email);
    return fx.orgs.create(name);
  });
}

// Adds the prospect and sends step 1 (step 2 moves the prospect there first).
async function send(fx: Fx, p: Prospect, step = 1): Promise<void> {
  if (!SEQUENCE_ID) throw new Error('Set PD_LINK_SEQUENCE_ID to the id printed by the setup spec');
  await sendEmail(fx, { sequenceId: SEQUENCE_ID, row: p.row, csv: CSV, step });
}

// Clicks link `link` (0 = first) of the step's email in the Mailinator inbox, then waits until the Clicked
// count of that step rises. Returns the count, which a link scanner can push above the number of clicks.
async function click(fx: Fx, p: Prospect, link = 0, step = 1): Promise<number> {
  const subject = step === 1 ? STEP_1_SUBJECT : STEP_2_SUBJECT;
  const clicked = () => fx.saleshandySequence.clickedCount(SEQUENCE_ID, p.name, step, p.email);
  const before = await clicked();
  await test.step(`Click link ${link + 1} of the step ${step} email in the Mailinator inbox of ${p.email}`, () =>
    fx.mailinator.clickFirstLink(p.email, subject, link),
  );
  let after = before;
  await test.step(`Wait until the Clicked count of step ${step} is above ${before}`, () =>
    untilPasses(`Clicked count of step ${step} for ${p.email} did not rise above ${before}`, async () => {
      after = await clicked();
      expect(after).toBeGreaterThan(before);
    }, 90_000),
  );
  test.info().annotations.push({ type: `Clicked count (step ${step}, link ${link + 1})`, description: String(after) });
  return after;
}

// Sends step 1 and makes the first click (the start of every row that needs a click).
async function sendAndClick(fx: Fx, p: Prospect): Promise<void> {
  await send(fx, p);
  await click(fx, p);
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

// Waits until the person has at least `atLeast` leads; every lead must carry the prospect email.
async function leadsAtLeast(fx: Fx, id: string, p: Prospect, atLeast: number): Promise<string[]> {
  let titles: string[] = [];
  await untilInPipedrive(fx, TRIGGER, `Fewer than ${atLeast} lead(s) on the person`, async () => {
    await fx.people.open(id);
    titles = await fx.people.leadTitles();
    expect(titles.length).toBeGreaterThanOrEqual(atLeast);
  });
  expect(titles.every((t) => t === p.email), `lead titles ${titles.join(' | ')}`).toBe(true);
  test.info().annotations.push({ type: 'leads on the person', description: String(titles.length) });
  return titles;
}

// ---- Trigger behavior ----

test.describe('Trigger behavior', () => {
  test('1: trigger off, enable it with Create a Person and Save', async ({ fx }) => {
    await configure(fx, TRIGGER, [PD.createPerson]);
    expect(await fx.pipedriveIntegration.isTriggerOn(TRIGGER)).toBe(true);
  });

  test('2: step 1 sent, prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Trigger behavior > 2');
    await configure(fx, TRIGGER, [PD.createPerson]);
    await sendAndClick(fx, p);
    const id = await expectOnePerson(fx, p);
    await activitiesAtLeast(fx, id, 1);
    expect(await fx.people.name()).toBe(p.name);
    const [activity] = await fx.people.activities();
    expect(activity).toMatchObject({ subject: SUBJECT, type: 'Email', done: true });
    test.info().annotations.push({ type: 'activity note', description: activity.note.slice(0, 300) });
  });

  test('3: second link of the same email', async ({ fx }) => {
    test.setTimeout(minutes(2));
    const p = prospect('Trigger behavior > 3');
    await configure(fx, TRIGGER, [PD.createPerson]);
    await sendAndClick(fx, p);
    const id = await expectOnePerson(fx, p);
    const first = await activitiesAtLeast(fx, id, 1);
    const count = await click(fx, p, 1);
    expect(count, 'Clicked count after the second link').toBeGreaterThanOrEqual(2);
    await activitiesAtLeast(fx, id, first + 1);
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });

  test('4: step 2 sent with Send now, link of the step 2 email', async ({ fx }) => {
    test.setTimeout(minutes(3));
    const p = prospect('Trigger behavior > 4');
    await configure(fx, TRIGGER, [PD.createPerson]);
    await sendAndClick(fx, p);
    const id = await expectOnePerson(fx, p);
    const first = await activitiesAtLeast(fx, id, 1);
    await send(fx, p, 2);
    await click(fx, p, 0, 2);
    await activitiesAtLeast(fx, id, first + 1);
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });

  test('5: Create a Lead, Create a Deal and Create a Person, prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Trigger behavior > 5');
    await configure(fx, TRIGGER, [PD.createLead, { activity: PD.createDeal, extra: QUALIFIED }, PD.createPerson]);
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

  test('6: prospect opens the step 1 email and does not click (proposed, unconfirmed)', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Trigger behavior > 6');
    await configure(fx, TRIGGER, [PD.createPerson]);
    await send(fx, p);
    await test.step(`Open the step 1 email in the Mailinator inbox of ${p.email}`, () => fx.mailinator.openEmail(p.email, STEP_1_SUBJECT));
    await expectNoPerson(fx, p);
    expect(await fx.saleshandySequence.clickedCount(SEQUENCE_ID, p.name, 1, p.email), 'Clicked count').toBe(0);
  });
});

// ---- Create a Person ----

test.describe('Create a Person', () => {
  test('1: person exists with an old value in a mapped field', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Person > 1');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.createPerson]);
    await sendAndClick(fx, p);
    await activitiesAtLeast(fx, id, 1);
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
    // The old value is not set (people.create takes name and email only): the details after the update are
    // recorded, not asserted.
    test.info().annotations.push({ type: 'person details after the update', description: JSON.stringify(await fx.people.details()) });
  });

  test('2: Create a Person and Update a Person both selected, person exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Person > 2');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.createPerson, PD.updatePerson]);
    await sendAndClick(fx, p);
    await activitiesAtLeast(fx, id, 2);
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });

  test('3: prospect has no first and last name', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Person > 3', { 'First Name': '', 'Last Name': '' });
    await configure(fx, TRIGGER, [PD.createPerson]);
    await sendAndClick(fx, p);
    const id = await expectOnePerson(fx, p);
    await activitiesAtLeast(fx, id, 1);
    expect(await fx.people.name()).toBe('(No Name)');
  });
});

// ---- Create a Lead ----

test.describe('Create a Lead', () => {
  test('1: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Lead > 1');
    await configure(fx, TRIGGER, [PD.createLead]);
    await sendAndClick(fx, p);
    const id = await expectOnePerson(fx, p);
    await leadsAtLeast(fx, id, p, 1);
    expect(await fx.people.activityCount(), 'no activity from a lead').toBe(0);
  });

  test('2: person exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Lead > 2');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.createLead]);
    await sendAndClick(fx, p);
    await leadsAtLeast(fx, id, p, 1);
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });

  test('3: second link of the same email', async ({ fx }) => {
    test.setTimeout(minutes(2));
    const p = prospect('Create a Lead > 3');
    await configure(fx, TRIGGER, [PD.createLead]);
    await sendAndClick(fx, p);
    const id = await expectOnePerson(fx, p);
    const first = await leadsAtLeast(fx, id, p, 1);
    await click(fx, p, 1);
    await leadsAtLeast(fx, id, p, first.length + 1);
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });
});

// ---- Create a Deal ----

test.describe('Create a Deal', () => {
  const picks = [{ activity: PD.createDeal, extra: QUALIFIED }];

  // The newest deal is the one the run made: its title is the prospect email (Link Clicked, not First Last).
  async function expectNewDeal(fx: Fx, p: Prospect, personId: string, legacy: string[], atLeast = 1): Promise<string[]> {
    let titles: string[] = [];
    await untilInPipedrive(fx, TRIGGER, `Deal "${p.email}" not on the person`, async () => {
      await fx.people.open(personId);
      titles = await fx.people.dealTitles();
      expect(titles.filter((t) => t === p.email).length).toBeGreaterThanOrEqual(atLeast);
    });
    expect(titles.filter((t) => t !== p.email).sort(), 'legacy deals unchanged').toEqual([...legacy].sort());
    const ids = await fx.people.dealIds();
    const created = await fx.deals.read(ids[ids.length - 1]);
    expect(created).toMatchObject({ title: p.email, pipeline: PIPEDRIVE_PIPELINE, stage: 'Qualified' });
    test.info().annotations.push({ type: 'deal read', description: JSON.stringify(created) });
    return titles;
  }

  test('1: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Deal > 1');
    await configure(fx, TRIGGER, picks);
    await sendAndClick(fx, p);
    const id = await expectOnePerson(fx, p);
    await expectNewDeal(fx, p, id, []);
    await fx.people.open(id);
    expect(await fx.people.activityCount(), 'no activity from a deal').toBe(0);
    expect(await fx.people.organization(), 'no organization link').toBeUndefined();
  });

  test('2: person has 1 deal', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Deal > 2');
    const id = await personFirst(fx, p);
    const legacy = await legacyDeals(fx, id, 1);
    await configure(fx, TRIGGER, picks);
    await sendAndClick(fx, p);
    await expectNewDeal(fx, p, id, legacy);
  });

  test('3: second link of the same email', async ({ fx }) => {
    test.setTimeout(minutes(2));
    const p = prospect('Create a Deal > 3');
    await configure(fx, TRIGGER, picks);
    await sendAndClick(fx, p);
    const id = await expectOnePerson(fx, p);
    const first = await expectNewDeal(fx, p, id, []);
    await click(fx, p, 1);
    await expectNewDeal(fx, p, id, [], first.length + 1);
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });
});

// ---- Update a Person ----

test.describe('Update a Person', () => {
  test('1: person exists with an old value in a mapped field', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update a Person > 1');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.updatePerson]);
    await sendAndClick(fx, p);
    await activitiesAtLeast(fx, id, 1);
    const [activity] = await fx.people.activities();
    expect(activity).toMatchObject({ subject: SUBJECT, type: 'Email', done: true });
    test.info().annotations.push({ type: 'activity note', description: activity.note.slice(0, 300) });
    test.info().annotations.push({ type: 'person details after the update', description: JSON.stringify(await fx.people.details()) });
  });

  test('2: prospect not in Pipedrive (known B1, Error)', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update a Person > 2');
    await configure(fx, TRIGGER, [PD.updatePerson]);
    await sendAndClick(fx, p);
    await expectNoPerson(fx, p);
    await recordLog(fx, TRIGGER);
  });
});

// ---- Update a Deal ----

test.describe('Update a Deal', () => {
  const picks = [{ activity: PD.updateDeal, extra: CONTACT_MADE }];

  test('1: person has 2 deals', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update a Deal > 1');
    const id = await personFirst(fx, p);
    await legacyDeals(fx, id, 2);
    const [older, newest] = await fx.people.open(id).then(() => fx.people.dealIds());
    await configure(fx, TRIGGER, picks);
    await sendAndClick(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not updated', async () => {
      expect(await fx.deals.read(newest)).toMatchObject({ title: p.email, pipeline: PIPEDRIVE_PIPELINE, stage: 'Contact Made' });
    });
    expect(await fx.deals.read(older), 'older deal unchanged').toMatchObject({ title: 'Legacy deal 1', stage: 'Qualified' });
  });

  test('2: person exists with no deal', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update a Deal > 2');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, picks);
    await sendAndClick(fx, p);
    await staysUnchanged(fx, async () => {
      await fx.people.open(id);
      expect(await fx.people.dealTitles(), 'nothing created').toEqual([]);
    });
    await recordLog(fx, TRIGGER);
  });

  test('3: prospect not in Pipedrive (known B2, Error)', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update a Deal > 3');
    await configure(fx, TRIGGER, picks);
    await sendAndClick(fx, p);
    await expectNoPerson(fx, p);
    await recordLog(fx, TRIGGER);
  });
});

// ---- Delete Deal ----

test.describe('Delete Deal', () => {
  test('1: person has 2 deals', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Delete Deal > 1');
    const id = await personFirst(fx, p);
    await legacyDeals(fx, id, 2);
    await fx.people.open(id);
    const [older, newest] = await fx.people.dealIds();
    await configure(fx, TRIGGER, [PD.deleteDeal]);
    await sendAndClick(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not deleted', async () => {
      await fx.people.open(id);
      expect(await fx.people.dealIds()).toEqual([older]);
    });
    expect(newest).not.toBe(older);
  });

  test('2: person exists with no deal', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Delete Deal > 2');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.deleteDeal]);
    await sendAndClick(fx, p);
    await staysUnchanged(fx, async () => {
      await fx.people.open(id);
      expect(await fx.people.dealIds(), 'no deal to delete').toEqual([]);
      expect(await fx.people.idsByEmail(p.email), 'person kept').toEqual([id]);
    });
  });

  test('3: prospect not in Pipedrive (known B2, Error)', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Delete Deal > 3');
    await configure(fx, TRIGGER, [PD.deleteDeal]);
    await sendAndClick(fx, p);
    await expectNoPerson(fx, p);
    await recordLog(fx, TRIGGER);
  });
});

// ---- Delete Person ----

test.describe('Delete Person', () => {
  test('1: person exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Delete Person > 1');
    await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.deletePerson]);
    await sendAndClick(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Person ${p.email} not deleted`, async () => {
      expect(await fx.people.idsByEmail(p.email)).toHaveLength(0);
    });
  });

  test('2: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Delete Person > 2');
    await configure(fx, TRIGGER, [PD.deletePerson]);
    await sendAndClick(fx, p);
    await expectNoPerson(fx, p);
  });
});

// ---- Create Organization ----

test.describe('Create Organization', () => {
  test('1: prospect has a company, no organization with that name', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create Organization > 1', PICKLIST_INDUSTRY);
    const before = await fx.orgs.countByName(p.row['Company']);
    markUsed(CSV, p.email);
    await configure(fx, TRIGGER, [PD.createOrganization]);
    await sendAndClick(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not created`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBeGreaterThanOrEqual(before + 1);
    });
    expect(await fx.people.idsByEmail(p.email), 'not linked to any person').toHaveLength(0);
    // TODO(needs-input): the organizations page object has no Details reader, so the mapped Organisation
    // Fields are not read (same gap as Email Sent). The Logs entry is recorded instead.
    await recordLog(fx, TRIGGER);
  });

  test('2: second link of the same email', async ({ fx }) => {
    test.setTimeout(minutes(2));
    const p = prospect('Create Organization > 2', PICKLIST_INDUSTRY);
    const before = await fx.orgs.countByName(p.row['Company']);
    markUsed(CSV, p.email);
    await configure(fx, TRIGGER, [PD.createOrganization]);
    await sendAndClick(fx, p);
    let first = 0;
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not created`, async () => {
      first = await fx.orgs.countByName(p.row['Company']);
      expect(first).toBeGreaterThanOrEqual(before + 1);
    });
    await click(fx, p, 1);
    await untilInPipedrive(fx, TRIGGER, `Second organization "${p.row['Company']}" not created`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBeGreaterThanOrEqual(first + 1);
    });
    expect(await fx.people.idsByEmail(p.email), 'not linked to any person').toHaveLength(0);
  });
});

// ---- Update Organization ----

test.describe('Update Organization', () => {
  test('1: an organization with the exact company name exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update Organization > 1');
    const before = await fx.orgs.countByName(p.row['Company']);
    await orgFirst(fx, p, p.row['Company']);
    await configure(fx, TRIGGER, [PD.updateOrganization]);
    await sendAndClick(fx, p);
    // Mapped fields are not read yet: the visible result is no second organization and a Logs entry.
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before + 1);
    });
    await recordLog(fx, TRIGGER);
  });

  test('2: organization name differs in letter case from the company', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update Organization > 2');
    const variant = p.row['Company'].toUpperCase();
    const beforeVariant = await fx.orgs.countByName(variant);
    const beforeExact = await fx.orgs.countByName(p.row['Company']);
    await orgFirst(fx, p, variant);
    await configure(fx, TRIGGER, [PD.updateOrganization]);
    await sendAndClick(fx, p);
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(variant), 'case variant kept').toBe(beforeVariant + 1);
      expect(await fx.orgs.countByName(p.row['Company']), 'no organization with the exact name').toBe(beforeExact);
    });
  });

  test('3: no organization with the company name', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update Organization > 3');
    const before = await fx.orgs.countByName(p.row['Company']);
    markUsed(CSV, p.email);
    await configure(fx, TRIGGER, [PD.updateOrganization]);
    await sendAndClick(fx, p);
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company']), 'nothing created').toBe(before);
    });
  });
});

// ---- Delete Organization ----

test.describe('Delete Organization', () => {
  test('1: an organization with the exact company name exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Delete Organization > 1');
    const before = await fx.orgs.countByName(p.row['Company']);
    await orgFirst(fx, p, p.row['Company']);
    await configure(fx, TRIGGER, [PD.deleteOrganization]);
    await sendAndClick(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not deleted`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before);
    });
  });

  test('2: no organization with the company name', async ({ fx }) => {
    test.setTimeout(minutes(1));
    // Rows and other sessions leave organizations behind, so the CSV company can already have one
    // (HashiCorp had 4 on 2026-10-28 and each run deleted one). Take the first company with none.
    let company = '';
    for (const candidate of [prospect('Delete Organization > 2').row['Company'], 'Cloudflare', 'Twilio', 'Okta', 'Segment', 'Datadog']) {
      if ((await fx.orgs.countByName(candidate)) === 0) {
        company = candidate;
        break;
      }
    }
    if (!company) throw new Error('Every candidate company already has an organization in Pipedrive; add more names');
    const p = prospect('Delete Organization > 2', { Company: company });
    const before = await fx.orgs.countByName(p.row['Company']);
    expect(before, 'no organization with the company name before the click').toBe(0);
    markUsed(CSV, p.email);
    await configure(fx, TRIGGER, [PD.deleteOrganization]);
    await sendAndClick(fx, p);
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company']), 'nothing deleted').toBe(before);
    });
  });
});
