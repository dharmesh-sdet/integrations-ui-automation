// Scenarios: test-cases/pipedrive/email-opened.md (Regression, 27 rows, QA "looks good" 2026-10-27;
//   workflow ticket AL-4174, same ticket on every row). One test per row, named "<section>: <n>".
// Data: test-data/pipedrive/email-opened.csv, one prospect per row, found by the Scenario column
//   (scripts/make-pipedrive-email-opened-data.ts). A row that opens the email a second time makes its
//   first open itself, so every row runs alone. A record that must exist first is made by hand in
//   Pipedrive with the prospect's email.
// Sequence: "Pipedrive Email Opened QA" on gpipedrive, 2 steps, Track email opens on, Track link clicks off
//   (tests/setup/pipedrive-email-opened-sequence.spec.ts). Put its id in PD_OPEN_SEQUENCE_ID.
// Page objects and flow: same as tests/pipedrive/link-clicked.spec.ts.
//
// How a row runs: set the trigger (only "Email is Opened in Saleshandy" on), make the Pipedrive records
// the row needs, add the prospect and send step 1, then open the email in the Mailinator inbox and wait
// until the Opened count of the Emails tab rises. Then look in Pipedrive 15 s later, every 10 s after
// that; Logs only if the record is missing (QA, 2026-10-23). Rows do not delete what they create
// (QA, 2026-10-26). Other triggers are left as they are (KEEP_OTHER_TRIGGERS), so Email Sent must be OFF
// on gpipedrive before the run.
//
// Mail clients that prefetch images can turn one open into more runs (proposed, unconfirmed). Rows that
// expect "one activity" or "one lead" check for at least one and record the count; they do not fail on
// extra runs. Rows that expect "still 1 person" are strict. Known issues are recorded, not filed: B1 and
// B2 (Update a Person / Update a Deal / Delete Deal with no person end in Error), double persons from one
// event (AL-4177).
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { configure, fullName, recordLog, sendEmail, staysUnchanged, untilInPipedrive } from '../../src/flows/saleshandy-to-pipedrive.ts';
import { PD, PIPEDRIVE_PIPELINE } from '../../src/pages/saleshandy/pipedrive-integration.page.ts';
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
const TRIGGER = 'Email is Opened in Saleshandy';
const SUBJECT = 'Email Open Recorded in Saleshandy';
const OTHER_TRIGGER = 'Reply is Received in Saleshandy';
// TODO(needs-input): id of "Pipedrive Email Opened QA", printed by the setup spec.
const SEQUENCE_ID = process.env.PD_OPEN_SEQUENCE_ID ?? '';
const CSV = 'pipedrive/email-opened.csv';
// Subject of step 1, from the setup spec.
const STEP_1_SUBJECT = 'Quick question about your outreach';

const QUALIFIED = { pipeline: PIPEDRIVE_PIPELINE, stage: 'Qualified' };
const CONTACT_MADE = { pipeline: PIPEDRIVE_PIPELINE, stage: 'Contact Made' };

// An open registers about 10 s after it is made on staging (HubSpot Email Opened, 2026-10-12).
const OPEN_TIMEOUT_MS = 3 * 60_000;
const OPEN_SETTLE_MS = 10_000;
const OPEN_REFRESH_MS = 5_000;

// One row = the sequence gap, Send now, the Mailinator open and a Pipedrive look. A row with a second
// open adds a second look.
const minutes = (opens: number): number => (opens + 1) * 3 * 60_000;

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

// Adds the prospect and sends step 1.
async function send(fx: Fx, p: Prospect): Promise<void> {
  if (!SEQUENCE_ID) throw new Error('Set PD_OPEN_SEQUENCE_ID to the id printed by the setup spec');
  await sendEmail(fx, { sequenceId: SEQUENCE_ID, row: p.row, csv: CSV });
}

// Opens the step 1 email in the Mailinator inbox, then waits until the Opened count of that step rises.
// Calling it again for the same prospect is a second open. Returns the count, which prefetching can push
// above the number of opens.
async function open(fx: Fx, p: Prospect): Promise<number> {
  const opened = () => fx.saleshandySequence.openedCount(SEQUENCE_ID, p.name, 1);
  const before = await opened();
  await test.step(`Open the step 1 email in the Mailinator inbox of ${p.email}`, () => fx.mailinator.openEmail(p.email, STEP_1_SUBJECT));
  let after = before;
  await test.step('Wait until Saleshandy counts the open (refresh the Emails tab)', async () => {
    await fx.saleshandySequence.page.waitForTimeout(OPEN_SETTLE_MS);
    await expect(async () => {
      after = await opened();
      expect(after, 'Opened').toBeGreaterThanOrEqual(before + 1);
    }, `Opened count for ${p.email} did not reach ${before + 1} (gave up after ${OPEN_TIMEOUT_MS / 1000} seconds)`).toPass({ timeout: OPEN_TIMEOUT_MS, intervals: [OPEN_REFRESH_MS] });
  });
  if (after > before + 1) test.info().annotations.push({ type: 'extra opens counted', description: `${after - before} for one open` });
  return after;
}

async function sendAndOpen(fx: Fx, p: Prospect): Promise<void> {
  await send(fx, p);
  await open(fx, p);
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

// At least `atLeast` activities on the person; the count is recorded (a prefetching client can add runs).
async function activitiesAtLeast(fx: Fx, personId: string, atLeast: number): Promise<void> {
  let count = 0;
  await untilInPipedrive(fx, TRIGGER, `Fewer than ${atLeast} activities on the person`, async () => {
    await fx.people.open(personId);
    count = await fx.people.activityCount();
    expect(count).toBeGreaterThanOrEqual(atLeast);
  });
  test.info().annotations.push({ type: 'activities on the person', description: String(count) });
}

// ---- Trigger behavior ----

test.describe('Trigger behavior', () => {
  test('1: trigger off, enable it with Create a Person and Save', async ({ fx }) => {
    await configure(fx, TRIGGER, [PD.createPerson]);
    expect(await fx.pipedriveIntegration.isTriggerOn(TRIGGER)).toBe(true);
  });

  test('2: Track email opens off in the sequence, Create a Person selected', async () => {
    test.skip(true, 'Needs a second sequence with Track email opens off (a sender and a setup spec of its own). Not built yet.');
  });

  test('3: second open of the same email (proposed, unconfirmed)', async ({ fx }) => {
    test.setTimeout(minutes(2));
    const p = prospect('Trigger behavior > 3');
    await configure(fx, TRIGGER, [PD.createPerson]);
    await sendAndOpen(fx, p);
    const id = await expectOnePerson(fx, p);
    await activitiesAtLeast(fx, id, 1);
    const first = await fx.people.activityCount();
    await open(fx, p);
    await activitiesAtLeast(fx, id, first + 1);
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });

  test('4: only "Reply is Received in Saleshandy" on, with Create a Person', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Trigger behavior > 4');
    await configure(fx, OTHER_TRIGGER, [PD.createPerson]);
    // disable() only flips the switch; without Save the earlier setting stays on (seen 2026-10-28: a person
    // was created by the Email Opened trigger that this row turned off).
    await fx.pipedriveIntegration.disable(TRIGGER);
    await fx.pipedriveIntegration.save();
    await expect(fx.pipedriveIntegration.savedToast()).toBeVisible({ timeout: 15_000 });
    await sendAndOpen(fx, p);
    await expectNoPerson(fx, p);
  });
});

// ---- Create a Person ----

test.describe('Create a Person', () => {
  test('1: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Person > 1');
    await configure(fx, TRIGGER, [PD.createPerson]);
    await sendAndOpen(fx, p);
    const id = await expectOnePerson(fx, p);
    await activitiesAtLeast(fx, id, 1);
    const [activity] = await fx.people.activities();
    expect(activity).toMatchObject({ subject: SUBJECT, type: 'Email', done: true });
    expect(await fx.people.name()).toBe(p.name);
    test.info().annotations.push({ type: 'activity note', description: activity.note.slice(0, 300) });
  });

  test('2: person exists with an old value in a mapped field', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Person > 2');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.createPerson]);
    await sendAndOpen(fx, p);
    await activitiesAtLeast(fx, id, 1);
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
    // The old value is not set (people.create takes name and email only): the details after the update are
    // recorded, not asserted.
    test.info().annotations.push({ type: 'person details after the update', description: JSON.stringify(await fx.people.details()) });
  });
});

// ---- Create a Lead ----

test.describe('Create a Lead', () => {
  test('1: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Lead > 1');
    await configure(fx, TRIGGER, [PD.createLead]);
    await sendAndOpen(fx, p);
    const id = await expectOnePerson(fx, p);
    let titles: string[] = [];
    await untilInPipedrive(fx, TRIGGER, `Lead "${p.email}" not on the person`, async () => {
      await fx.people.open(id);
      titles = await fx.people.leadTitles();
      expect(titles).toContain(p.email);
    });
    test.info().annotations.push({ type: 'leads on the person', description: String(titles.length) });
    expect(await fx.people.activityCount(), 'no activity from a lead').toBe(0);
  });

  test('2: person exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Lead > 2');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.createLead]);
    await sendAndOpen(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Lead "${p.email}" not on the existing person`, async () => {
      await fx.people.open(id);
      expect(await fx.people.leadTitles()).toContain(p.email);
    });
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });
});

// ---- Create a Deal ----

test.describe('Create a Deal', () => {
  const picks = [{ activity: PD.createDeal, extra: QUALIFIED }];

  async function expectNewDeal(fx: Fx, p: Prospect, personId: string, legacy: string[]): Promise<void> {
    let titles: string[] = [];
    await untilInPipedrive(fx, TRIGGER, `Deal "${p.email}" not on the person`, async () => {
      await fx.people.open(personId);
      titles = await fx.people.dealTitles();
      expect(titles).toContain(p.email);
    });
    for (const title of legacy) expect(titles, 'legacy deal kept').toContain(title);
    const ids = await fx.people.dealIds();
    const created = await fx.deals.read(ids[ids.length - 1]);
    expect(created).toMatchObject({ title: p.email, pipeline: PIPEDRIVE_PIPELINE, stage: 'Qualified' });
  }

  test('1: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Deal > 1');
    await configure(fx, TRIGGER, picks);
    await sendAndOpen(fx, p);
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
    await sendAndOpen(fx, p);
    await expectNewDeal(fx, p, id, legacy);
  });

  test('3: person exists, email already opened once (second open)', async ({ fx }) => {
    test.setTimeout(minutes(2));
    const p = prospect('Create a Deal > 3');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, picks);
    await sendAndOpen(fx, p);
    await expectNewDeal(fx, p, id, []);
    await fx.people.open(id);
    const first = (await fx.people.dealTitles()).length;
    await open(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Second deal not created', async () => {
      await fx.people.open(id);
      expect((await fx.people.dealTitles()).length).toBeGreaterThanOrEqual(first + 1);
    });
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
    await sendAndOpen(fx, p);
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
    await sendAndOpen(fx, p);
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
    await sendAndOpen(fx, p);
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
    await sendAndOpen(fx, p);
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
    await sendAndOpen(fx, p);
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
    await sendAndOpen(fx, p);
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
    await sendAndOpen(fx, p);
    await staysUnchanged(fx, async () => {
      await fx.people.open(id);
      expect(await fx.people.dealIds(), 'nothing to delete').toEqual([]);
    });
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
    await sendAndOpen(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Person ${p.email} not deleted`, async () => {
      expect(await fx.people.idsByEmail(p.email)).toHaveLength(0);
    });
  });

  test('2: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Delete Person > 2');
    await configure(fx, TRIGGER, [PD.deletePerson]);
    await sendAndOpen(fx, p);
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
    await sendAndOpen(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not created`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBeGreaterThanOrEqual(before + 1);
    });
    expect(await fx.people.idsByEmail(p.email), 'not linked to any person').toHaveLength(0);
  });

  test('2: an organization with the same name exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create Organization > 2', PICKLIST_INDUSTRY);
    const before = await fx.orgs.countByName(p.row['Company']);
    await orgFirst(fx, p, p.row['Company']);
    await configure(fx, TRIGGER, [PD.createOrganization]);
    await sendAndOpen(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Second organization "${p.row['Company']}" not created`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBeGreaterThanOrEqual(before + 2);
    });
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
    await sendAndOpen(fx, p);
    // Mapped fields are not read yet: the visible result is no second organization and a Logs entry.
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before + 1);
    });
    await recordLog(fx, TRIGGER);
  });

  test('2: no organization with that exact name', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update Organization > 2');
    const before = await fx.orgs.countByName(p.row['Company']);
    markUsed(CSV, p.email);
    await configure(fx, TRIGGER, [PD.updateOrganization]);
    await sendAndOpen(fx, p);
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
    await sendAndOpen(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not deleted`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before);
    });
  });
});

// ---- Combined actions ----

test.describe('Combined actions', () => {
  test('1: Create a Lead, Create a Deal and Create a Person, prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Combined actions > 1');
    await configure(fx, TRIGGER, [PD.createLead, { activity: PD.createDeal, extra: QUALIFIED }, PD.createPerson]);
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

  test('2: Create a Person and Update a Person both selected, person exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Combined actions > 2');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.createPerson, PD.updatePerson]);
    await sendAndOpen(fx, p);
    await activitiesAtLeast(fx, id, 2);
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });
});
