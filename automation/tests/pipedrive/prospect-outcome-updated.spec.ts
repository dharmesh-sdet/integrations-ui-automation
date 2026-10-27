// Scenarios: test-cases/pipedrive/prospect-outcome-updated.md (Regression, 30 rows, QA "looks good"
//   2026-10-24; no Jira ticket). One test per row; "Trigger behavior > 1" is a config row with no prospect.
// Data: test-data/pipedrive/prospect-outcome-updated.csv, one prospect per row (32), found by the Scenario column.
// Hand-written like the Pipedrive Email Sent spec (QA, 2026-10-24).
//
// How a row runs: set the outcome trigger on gpipedrive (only it on, Email Sent off), make the Pipedrive
// records the row needs by hand with legacy values, add the prospect to the sequence and send step 1
// (the prospect starts at "Add Outcome"), change the outcome on the Prospects tab, then look in Pipedrive
// 15 s later (first look), every 10 s after that; Logs only if the record is missing (QA, 2026-10-23).
// "Setup" does the prospect adds and the step 1 sends for all rows up front; a row run on its own
// (-g) prepares itself. What a row already did is kept in test-data/pipedrive/*.setup.json.
//
// Known issues are recorded, not filed: Z-7 (Meeting Booked never matches), B1 and B2
// (Update a Person / Update a Deal / Delete Deal with no person end in Error).
// Sequence: "Pipedrive Outcome Updated QA" (197337), one email step, sender Kartik 5.
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markStage, stageDone } from '../../src/data/setup-state.ts';
import { markUsed } from '../../src/data/used.ts';
import { fullName, recordLog, staysUnchanged, untilInPipedrive } from '../../src/flows/saleshandy-to-pipedrive.ts';
import { PD, PIPEDRIVE_PIPELINE, type OutcomeItem } from '../../src/pages/saleshandy/pipedrive-integration.page.ts';
import type { PipedriveIntegrationPage } from '../../src/pages/saleshandy/pipedrive-integration.page.ts';
import type { SaleshandySequencePage } from '../../src/pages/saleshandy/sequence.page.ts';
import type { PipedriveDealsPage } from '../../src/pages/pipedrive/deals.page.ts';
import type { PipedriveLeadsPage } from '../../src/pages/pipedrive/leads.page.ts';
import type { PipedriveOrganizationsPage } from '../../src/pages/pipedrive/organizations.page.ts';
import type { PipedrivePeoplePage } from '../../src/pages/pipedrive/people.page.ts';

type Fx = {
  pipedriveIntegration: PipedriveIntegrationPage;
  saleshandySequence: SaleshandySequencePage;
  people: PipedrivePeoplePage;
  deals: PipedriveDealsPage;
  leads: PipedriveLeadsPage;
  orgs: PipedriveOrganizationsPage;
};

const test = base.extend<{ fx: Fx }>({
  fx: async ({ pipedriveIntegration, saleshandySequence, pipedrivePeople, pipedriveDeals, pipedriveLeads, pipedriveOrganizations }, use) =>
    use({ pipedriveIntegration, saleshandySequence, people: pipedrivePeople, deals: pipedriveDeals, leads: pipedriveLeads, orgs: pipedriveOrganizations }),
});

test.use({ account: 'gpipedrive' });

const TRIGGER = 'Prospect Outcome is updated in Saleshandy';
const SEQUENCE_ID = '197337';
const CSV = 'pipedrive/prospect-outcome-updated.csv';
const SUBJECT = 'Prospect Outcome is updated in Saleshandy';
const LEGACY_PHONE = '+1 555-0100-0000';
const ROW_TIMEOUT = 12 * 60_000;

// Every row id that has a prospect, in the order of the test cases.
const IDS = [
  ...[3, 6].map((n) => `Trigger behavior > ${n}`),
  ...([['Create a Person', 3], ['Create a Lead', 3], ['Create a Deal', 3], ['Update a Person', 3], ['Update a Deal', 4], ['Delete Deal', 2], ['Delete Person', 2], ['Create Organization', 2], ['Update Organization', 3], ['Delete Organization', 2]] as const)
    .flatMap(([group, n]) => Array.from({ length: n }, (_, i) => `${group} > ${i + 1}`)),
];

type Prospect = { id: string; row: Row; email: string; name: string };

function prospect(id: string): Prospect {
  const row = readCsv(CSV).find((r) => r['Scenario'] === id);
  if (!row) throw new Error(`No row "${id}" in test-data/${CSV}`);
  return { id, row, email: row['Email'], name: fullName(row) };
}

const note = (type: string, description: string) => test.info().annotations.push({ type, description });

// The last trigger configuration saved, so consecutive rows of one section do not save it again.
let configured = '';

async function useTrigger(fx: Fx, items: OutcomeItem[]): Promise<void> {
  const key = JSON.stringify(items);
  if (configured === key) return;
  await test.step(`Set "${TRIGGER}" to: ${items.map((i) => `${i.activity} [${i.category ?? 'Extra Configuration skipped'}${i.stage ? `, ${i.stage}` : ''}]`).join(' + ') || 'no action'}`, async () => {
    await fx.pipedriveIntegration.configureOutcome(items);
    configured = key;
  });
}

// Adds the prospect and sends step 1 once; a rerun in a new process skips what is done (setup-state).
async function prepare(fx: Fx, p: Prospect): Promise<void> {
  if (!stageDone(CSV, p.email, 'added')) {
    await test.step(`Add ${p.name} to the sequence`, async () => {
      markUsed(CSV, p.email);
      // A failed add can still leave the prospect in the sequence; adding it again is rejected as a duplicate.
      if (!(await fx.saleshandySequence.hasProspect(SEQUENCE_ID, p.email))) await fx.saleshandySequence.createAndAddProspect(SEQUENCE_ID, p.row);
      markStage(CSV, p.email, 'added');
    });
  }
  if (!stageDone(CSV, p.email, 'sent')) {
    await test.step(`Send step 1 to ${p.name}`, async () => {
      await fx.saleshandySequence.sendNow(SEQUENCE_ID, p.name, 1, p.email);
      markStage(CSV, p.email, 'sent');
    });
  }
}

// Make sure step 1 shows Sent, then change the outcome.
async function changeOutcome(fx: Fx, p: Prospect, outcome: string): Promise<void> {
  // prepare() marks "sent" only after the Emails tab row showed Sent. The row is not looked up again:
  // with 32 prospects it is no longer on the first page of the Emails tab (seen 2026-10-26).
  await prepare(fx, p);
  await test.step(`Change the outcome to ${outcome}`, () => fx.saleshandySequence.setProspectOutcome(SEQUENCE_ID, p.email, outcome));
}

// Records made by hand before the outcome changes, with legacy values so a change is visible.
async function personFirst(fx: Fx, p: Prospect, phone?: string): Promise<string> {
  return test.step(`Create the person ${p.email} in Pipedrive`, () => fx.people.create({ name: p.name, email: p.email, phone }));
}

async function legacyDeals(fx: Fx, personId: string, count: number): Promise<void> {
  await test.step(`Create ${count} legacy deal(s) on the person`, async () => {
    for (let i = 1; i <= count; i++) await fx.deals.createOnPerson(personId, { title: `Legacy deal ${i}`, value: 100 * i });
  });
}

async function orgFirst(fx: Fx, name: string): Promise<string> {
  return test.step(`Create the organization "${name}" in Pipedrive`, () => fx.orgs.create(name));
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

const digits = (s: string) => s.replace(/\D/g, '');

test.describe.configure({ timeout: ROW_TIMEOUT });

test('Setup: prospects and step 1 sends for all rows', async ({ fx }) => {
  test.setTimeout(3 * 60 * 60_000);
  // Email Sent must be off, or every step 1 send would create a person in Pipedrive first.
  await useTrigger(fx, []);
  for (const id of IDS) await prepare(fx, prospect(id));
});

// ---- Trigger behavior and category gate ----

test.describe('Trigger behavior', () => {
  // Rows 2 and 3 first: an Extra Configuration that was saved once cannot be cleared.
  test('1: trigger off, enable it with Create a Person and a category', async ({ fx }) => {
    await fx.pipedriveIntegration.configureOutcome([{ activity: PD.createPerson, category: 'Interested' }]);
    configured = '';
    expect(await fx.pipedriveIntegration.isTriggerOn(TRIGGER)).toBe(true);
    expect(await fx.pipedriveIntegration.selectedActivities(TRIGGER)).toHaveLength(1);
  });

  test('3: Extra Configuration skipped for Create a Person, outcome Not Now', async ({ fx }) => {
    const p = prospect('Trigger behavior > 3');
    await useTrigger(fx, [{ activity: PD.createPerson }]);
    await changeOutcome(fx, p, 'Not Now');
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Activity not added', async () => {
      await fx.people.open(id);
      expect(await fx.people.activityCount()).toBe(1);
    });
  });

  test('6: Create a Lead, Create a Deal and Create a Person, category Interested, prospect not in Pipedrive', async ({ fx }) => {
    const p = prospect('Trigger behavior > 6');
    await useTrigger(fx, [
      { activity: PD.createLead, category: 'Interested' },
      { activity: PD.createDeal, category: 'Interested', stage: 'Qualified' },
      { activity: PD.createPerson, category: 'Interested' },
    ]);
    await changeOutcome(fx, p, 'Interested');
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, '1 lead, 1 deal and 1 activity not all on the person', async () => {
      await fx.people.open(id);
      expect(await fx.people.leadTitles()).toHaveLength(1);
      expect(await fx.people.dealTitles()).toHaveLength(1);
      expect(await fx.people.activityCount()).toBe(1);
    });
  });
});

// ---- Create a Person ----

test.describe('Create a Person', () => {
  const picks: OutcomeItem[] = [{ activity: PD.createPerson, category: 'Interested' }];

  test('1: prospect not in Pipedrive, outcome Interested', async ({ fx }) => {
    const p = prospect('Create a Person > 1');
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Interested');
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Done activity not on the person', async () => {
      await fx.people.open(id);
      expect(await fx.people.activityCount()).toBe(1);
    });
    expect(await fx.people.name()).toBe(p.name);
    const [activity] = await fx.people.activities();
    expect(activity).toMatchObject({ subject: SUBJECT, done: true });
    expect(activity.type, 'activity type').toBe('Email');
  });

  test('2: person exists with an old value, outcome Interested', async ({ fx }) => {
    const p = prospect('Create a Person > 2');
    const id = await personFirst(fx, p, LEGACY_PHONE);
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Interested');
    await untilInPipedrive(fx, TRIGGER, 'Activity not added to the person', async () => {
      await fx.people.open(id);
      expect(await fx.people.activityCount()).toBeGreaterThanOrEqual(1);
    });
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
    note('person details after the update', JSON.stringify({ ...(await fx.people.details()), Phone: await fx.people.phones() }));
    await untilInPipedrive(fx, TRIGGER, 'Mapped Phone not updated on the person', async () => {
      await fx.people.open(id);
      expect(digits((await fx.people.phones()).join(' ')), 'mapped Phone updated').toContain(digits(p.row['Phone Number']));
    });
  });

  test('3: prospect not in Pipedrive, outcome Not Interested', async ({ fx }) => {
    const p = prospect('Create a Person > 3');
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Not Interested');
    await expectNoPerson(fx, p);
  });
});

// ---- Create a Lead ----

test.describe('Create a Lead', () => {
  const picks: OutcomeItem[] = [{ activity: PD.createLead, category: 'Not Interested' }];

  test('1: prospect not in Pipedrive, outcome Not Interested', async ({ fx }) => {
    const p = prospect('Create a Lead > 1');
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Not Interested');
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Lead "${p.email}" not on the person`, async () => {
      await fx.people.open(id);
      expect(await fx.people.leadTitles()).toEqual([p.email]);
    });
    expect(await fx.people.activityCount(), 'no activity from a lead').toBe(0);
  });

  test('2: person exists, outcome Not Interested', async ({ fx }) => {
    const p = prospect('Create a Lead > 2');
    const id = await personFirst(fx, p);
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Not Interested');
    await untilInPipedrive(fx, TRIGGER, `Lead "${p.email}" not on the existing person`, async () => {
      await fx.people.open(id);
      expect(await fx.people.leadTitles()).toEqual([p.email]);
    });
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });

  test('3: prospect not in Pipedrive, outcome Out of Office', async ({ fx }) => {
    const p = prospect('Create a Lead > 3');
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Out of Office');
    await expectNoPerson(fx, p);
    expect(await fx.leads.countByTitle(p.email), 'no lead').toBe(0);
  });
});

// ---- Create a Deal ----

test.describe('Create a Deal', () => {
  const picks: OutcomeItem[] = [{ activity: PD.createDeal, category: 'Closed', stage: 'Qualified' }];

  test('1: prospect not in Pipedrive, outcome Closed', async ({ fx }) => {
    const p = prospect('Create a Deal > 1');
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Closed');
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Deal "${p.email}" not on the person`, async () => {
      await fx.people.open(id);
      expect(await fx.people.dealTitles()).toEqual([p.email]);
    });
    const [dealId] = await fx.people.dealIds();
    const deal = await fx.deals.read(dealId);
    expect(deal).toMatchObject({ title: p.email, pipeline: PIPEDRIVE_PIPELINE, stage: 'Qualified' });
    expect(digits(deal.value), 'Value from the prospect').toBe(digits(p.row['Deal Value']));
    await fx.people.open(id);
    expect(await fx.people.activityCount(), 'no activity from a deal').toBe(0);
    expect(await fx.people.organization(), 'no organization link').toBeUndefined();
  });

  test('2: person has 1 deal, outcome Closed', async ({ fx }) => {
    const p = prospect('Create a Deal > 2');
    const id = await personFirst(fx, p);
    await legacyDeals(fx, id, 1);
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Closed');
    await untilInPipedrive(fx, TRIGGER, `Deal "${p.email}" not added`, async () => {
      await fx.people.open(id);
      expect([...(await fx.people.dealTitles())].sort()).toEqual(['Legacy deal 1', p.email].sort());
    });
    const [older] = await fx.people.dealIds();
    expect(await fx.deals.read(older), 'existing deal unchanged').toMatchObject({ title: 'Legacy deal 1' });
  });

  test('3: prospect not in Pipedrive, outcome Do Not Contact', async ({ fx }) => {
    const p = prospect('Create a Deal > 3');
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Do Not Contact');
    await expectNoPerson(fx, p);
  });
});

// ---- Update a Person ----

test.describe('Update a Person', () => {
  const picks: OutcomeItem[] = [{ activity: PD.updatePerson, category: 'Out of Office' }];

  test('1: person exists with an old value, outcome Out of Office', async ({ fx }) => {
    const p = prospect('Update a Person > 1');
    const id = await personFirst(fx, p, LEGACY_PHONE);
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Out of Office');
    await untilInPipedrive(fx, TRIGGER, 'Activity not added to the person', async () => {
      await fx.people.open(id);
      expect(await fx.people.activityCount()).toBe(1);
    });
    note('person details after the update', JSON.stringify({ ...(await fx.people.details()), Phone: await fx.people.phones() }));
    await untilInPipedrive(fx, TRIGGER, 'Mapped Phone not updated on the person', async () => {
      await fx.people.open(id);
      expect(digits((await fx.people.phones()).join(' ')), 'mapped Phone updated').toContain(digits(p.row['Phone Number']));
    });
  });

  test('2: prospect not in Pipedrive, outcome Out of Office (known B1, Error)', async ({ fx }) => {
    const p = prospect('Update a Person > 2');
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Out of Office');
    await expectNoPerson(fx, p);
    await recordLog(fx, TRIGGER);
  });

  test('3: person exists with an old value, outcome Closed', async ({ fx }) => {
    const p = prospect('Update a Person > 3');
    const id = await personFirst(fx, p, LEGACY_PHONE);
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Closed');
    await staysUnchanged(fx, async () => {
      await fx.people.open(id);
      expect(await fx.people.activityCount(), 'no activity').toBe(0);
      expect(digits((await fx.people.phones()).join(' ')), 'old value kept').toContain(digits(LEGACY_PHONE));
    });
  });
});

// ---- Update a Deal ----

test.describe('Update a Deal', () => {
  const picks: OutcomeItem[] = [{ activity: PD.updateDeal, category: 'Not Now', stage: 'Contact Made' }];

  test('1: person has 2 deals, outcome Not Now', async ({ fx }) => {
    const p = prospect('Update a Deal > 1');
    const id = await personFirst(fx, p);
    await legacyDeals(fx, id, 2);
    await fx.people.open(id);
    const [older, newest] = await fx.people.dealIds();
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Not Now');
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not updated', async () => {
      expect(await fx.deals.read(newest)).toMatchObject({ title: p.email, pipeline: PIPEDRIVE_PIPELINE, stage: 'Contact Made' });
    });
    expect(digits((await fx.deals.read(newest)).value), 'mapped Value').toBe(digits(p.row['Deal Value']));
    expect(await fx.deals.read(older), 'older deal unchanged').toMatchObject({ title: 'Legacy deal 1', stage: 'Qualified' });
  });

  test('2: person exists with no deal, outcome Not Now', async ({ fx }) => {
    const p = prospect('Update a Deal > 2');
    const id = await personFirst(fx, p);
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Not Now');
    await staysUnchanged(fx, async () => {
      await fx.people.open(id);
      expect(await fx.people.dealTitles(), 'nothing created').toEqual([]);
    });
    await recordLog(fx, TRIGGER);
  });

  test('3: prospect not in Pipedrive, outcome Not Now (known B2, Error)', async ({ fx }) => {
    const p = prospect('Update a Deal > 3');
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Not Now');
    await expectNoPerson(fx, p);
    await recordLog(fx, TRIGGER);
  });

  test('4: person has 1 deal, outcome Interested', async ({ fx }) => {
    const p = prospect('Update a Deal > 4');
    const id = await personFirst(fx, p);
    await legacyDeals(fx, id, 1);
    await fx.people.open(id);
    const [dealId] = await fx.people.dealIds();
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Interested');
    await staysUnchanged(fx, async () => {
      expect(await fx.deals.read(dealId), 'deal unchanged').toMatchObject({ title: 'Legacy deal 1', stage: 'Qualified' });
    });
  });
});

// ---- Delete Deal ----

test.describe('Delete Deal', () => {
  const picks: OutcomeItem[] = [{ activity: PD.deleteDeal, category: 'Do Not Contact' }];

  test('1: person has 2 deals, outcome Do Not Contact', async ({ fx }) => {
    const p = prospect('Delete Deal > 1');
    const id = await personFirst(fx, p);
    await legacyDeals(fx, id, 2);
    await fx.people.open(id);
    const [older] = await fx.people.dealIds();
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Do Not Contact');
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not deleted', async () => {
      await fx.people.open(id);
      expect(await fx.people.dealIds()).toEqual([older]);
    });
  });

  test('2: person has 2 deals, outcome Not Now', async ({ fx }) => {
    const p = prospect('Delete Deal > 2');
    const id = await personFirst(fx, p);
    await legacyDeals(fx, id, 2);
    await fx.people.open(id);
    const before = await fx.people.dealIds();
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Not Now');
    await staysUnchanged(fx, async () => {
      await fx.people.open(id);
      expect(await fx.people.dealIds(), 'both deals stay').toEqual(before);
    });
  });
});

// ---- Delete Person ----

test.describe('Delete Person', () => {
  const picks: OutcomeItem[] = [{ activity: PD.deletePerson, category: 'Not Interested' }];

  test('1: person exists, outcome Not Interested', async ({ fx }) => {
    const p = prospect('Delete Person > 1');
    await personFirst(fx, p);
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Not Interested');
    await untilInPipedrive(fx, TRIGGER, 'Person not deleted', async () => {
      expect(await fx.people.idsByEmail(p.email)).toHaveLength(0);
    });
  });

  test('2: person exists, outcome Do Not Contact', async ({ fx }) => {
    const p = prospect('Delete Person > 2');
    const id = await personFirst(fx, p);
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Do Not Contact');
    await staysUnchanged(fx, async () => {
      expect(await fx.people.idsByEmail(p.email), 'person stays').toEqual([id]);
    });
  });
});

// ---- Create Organization ----

test.describe('Create Organization', () => {
  const picks: OutcomeItem[] = [{ activity: PD.createOrganization, category: 'Interested' }];

  test('1: prospect has a company, no organization with that name, outcome Interested', async ({ fx }) => {
    const p = prospect('Create Organization > 1');
    expect(await fx.orgs.countByName(p.row['Company']), 'the company name is free').toBe(0);
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Interested');
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not created`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(1);
    });
    expect(await fx.people.idsByEmail(p.email), 'not linked to any person').toHaveLength(0);
  });

  test('2: same setup, outcome Meeting Booked', async ({ fx }) => {
    const p = prospect('Create Organization > 2');
    expect(await fx.orgs.countByName(p.row['Company']), 'the company name is free').toBe(0);
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Meeting Booked');
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company']), 'no organization created').toBe(0);
    });
  });
});

// ---- Update Organization ----

test.describe('Update Organization', () => {
  const picks: OutcomeItem[] = [{ activity: PD.updateOrganization, category: 'Not Interested' }];

  test('1: organization with the exact company name exists, outcome Not Interested', async ({ fx }) => {
    const p = prospect('Update Organization > 1');
    await orgFirst(fx, p.row['Company']);
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Not Interested');
    // Mapped fields are not read yet: the visible result is no second organization and a Success entry.
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(1);
    });
    await recordLog(fx, TRIGGER);
  });

  test('2: organization name differs in case, outcome Not Interested', async ({ fx }) => {
    const p = prospect('Update Organization > 2');
    await orgFirst(fx, p.row['Company'].toUpperCase());
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Not Interested');
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company']), 'nothing created for the exact name').toBe(0);
      expect(await fx.orgs.countByName(p.row['Company'].toUpperCase()), 'upper-case organization stays').toBe(1);
    });
    await recordLog(fx, TRIGGER);
  });

  test('3: organization with the exact company name exists, outcome Not Now', async ({ fx }) => {
    const p = prospect('Update Organization > 3');
    await orgFirst(fx, p.row['Company']);
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Not Now');
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(1);
    });
  });
});

// ---- Delete Organization ----

test.describe('Delete Organization', () => {
  const picks: OutcomeItem[] = [{ activity: PD.deleteOrganization, category: 'Closed' }];

  test('1: organization with the exact company name exists, outcome Closed', async ({ fx }) => {
    const p = prospect('Delete Organization > 1');
    await orgFirst(fx, p.row['Company']);
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Closed');
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not deleted`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(0);
    });
  });

  test('2: same setup, outcome Out of Office', async ({ fx }) => {
    const p = prospect('Delete Organization > 2');
    await orgFirst(fx, p.row['Company']);
    await useTrigger(fx, picks);
    await changeOutcome(fx, p, 'Out of Office');
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company']), 'organization stays').toBe(1);
    });
  });
});
