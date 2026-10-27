// Scenarios: test-cases/pipedrive/email-sent.md (Regression, 34 rows, QA OK 2026-10-23, Create
//   Organization 4 added 2026-10-26; no Jira ticket). One test per row. Rows that need a Field Mapping
//   setting, which has not been read on the Configure screen yet, are skipped and say why.
// Data: test-data/pipedrive/email-sent.csv, one prospect per row, found by the Scenario column.
//   Saleshandy accepts an email once per account, so a record that must exist first is made by
//   hand in Pipedrive with the prospect's email (never by sending a second prospect).
// Page objects: src/pages/saleshandy/pipedrive-integration.page.ts (Triggers & Activity, Logs),
//   src/pages/pipedrive/{people,deals,leads,organizations}.page.ts, and the sequence page shared
//   with every other workflow (Add Prospects, Send now).
// Flow: src/flows/saleshandy-to-pipedrive.ts (select the activities, send, wait for Pipedrive).
//
// Pass/fail follows QA's rule of 2026-10-23: the run is done when the Emails tab row shows "Sent",
// then look in Pipedrive after 15 s; Logs only if the record is missing. Rows whose Expected
// result is marked "(proposed, unconfirmed)" record what happened as a test annotation instead of
// asserting it. Rows do not delete what they create (QA, 2026-10-26).
//
// Sequence: "Pipedrive Regression" (197336) on gpipedrive, 2 steps, active, made by
// tests/setup/pipedrive-sequence.spec.ts.
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { configure, fullName, recordLog, sendEmail, staysUnchanged, untilInPipedrive } from '../../src/flows/saleshandy-to-pipedrive.ts';
import { PD, PIPEDRIVE_PIPELINE } from '../../src/pages/saleshandy/pipedrive-integration.page.ts';
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

// One bundle of the page objects, so each test names a single fixture.
const test = base.extend<{ fx: Fx }>({
  fx: async ({ pipedriveIntegration, saleshandySequence, pipedrivePeople, pipedriveDeals, pipedriveLeads, pipedriveOrganizations }, use) =>
    use({ pipedriveIntegration, saleshandySequence, people: pipedrivePeople, deals: pipedriveDeals, leads: pipedriveLeads, orgs: pipedriveOrganizations }),
});

test.use({ account: 'gpipedrive' });

// Name on Triggers & Activity and in Logs.
const TRIGGER = 'Email Sent from Saleshandy';
const SEQUENCE_ID = '197336';
const CSV = 'pipedrive/email-sent.csv';
const SUBJECT = 'Email sent from Saleshandy';

// Extra Configuration of the deal activities: the staging company has one pipeline.
const QUALIFIED = { pipeline: PIPEDRIVE_PIPELINE, stage: 'Qualified' };
const CONTACT_MADE = { pipeline: PIPEDRIVE_PIPELINE, stage: 'Contact Made' };

// One send = the sequence's gap, Send now and a Pipedrive look; the budget keeps room for slow pages.
const minutes = (sends: number): number => sends * 4 * 60_000;

type Prospect = { row: Row; email: string; name: string };

// Company Industry of the Create Organization rows. Organisation Fields map it to Pipedrive's Industry,
// a picklist, and Pipedrive rejects any other text with 400 (seen 2026-10-26: the refreshed Shopify row
// carried "Ecommerce" and no organization was made). Rows that are not about Industry use a valid
// option; Create Organization 3 sets its own invalid value. Both columns are set because the Organisation
// Fields card maps Industry and Company Industry to the same Pipedrive field and the person's Industry
// won (2026-10-26 rerun: Figma went out with "Design Software" although Company Industry was "Retail").
const PICKLIST_INDUSTRY = { Industry: 'Retail', 'Company Industry': 'Retail' };

function prospect(scenario: string, override: Record<string, string> = {}): Prospect {
  const found = readCsv(CSV).find((r) => r['Scenario'] === scenario);
  if (!found) throw new Error(`No row "${scenario}" in test-data/${CSV}`);
  const row = { ...found, ...override };
  return { row, email: row['Email'], name: fullName(row) };
}

// No cleanup after a row (QA, 2026-10-26): what a row creates stays in Pipedrive.

// Records a row needs before the send. Each is made by hand with the prospect's own email and
// legacy values, so a change by the workflow is visible. markUsed retires the CSV row at once: the
// record now exists, so a failed run must not reuse the person.
async function personFirst(fx: Fx, p: Prospect, email = p.email): Promise<string> {
  return test.step(`Create the person ${email} in Pipedrive`, async () => {
    markUsed(CSV, p.email);
    return fx.people.create({ name: p.name || 'Legacy Person', email });
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

function send(fx: Fx, p: Prospect, step = 1): Promise<void> {
  return sendEmail(fx, { sequenceId: SEQUENCE_ID, row: p.row, csv: CSV, step });
}

// Exactly one person with the prospect's email, once Pipedrive shows it.
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

// ---- Create a Lead ----

test.describe('Create a Lead', () => {
  test('1: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Lead > 1');
    await configure(fx, TRIGGER, [PD.createLead]);
    await send(fx, p);
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Lead "${p.email}" not on the person`, async () => {
      await fx.people.open(id);
      expect(await fx.people.leadTitles()).toEqual([p.email]);
    });
    expect(await fx.people.name()).toBe(p.name);
    expect(await fx.people.activityCount(), 'no activity from a lead').toBe(0);
  });

  test('2: prospect already a person in Pipedrive', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Lead > 2');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.createLead]);
    await send(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Lead "${p.email}" not on the existing person`, async () => {
      await fx.people.open(id);
      expect(await fx.people.leadTitles()).toEqual([p.email]);
    });
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });

  test('3: second lead on the same person (step 2)', async ({ fx }) => {
    test.setTimeout(minutes(2));
    const p = prospect('Create a Lead > 3');
    await configure(fx, TRIGGER, [PD.createLead]);
    await send(fx, p);
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'First lead not created', async () => {
      await fx.people.open(id);
      expect(await fx.people.leadTitles()).toHaveLength(1);
    });
    await send(fx, p, 2);
    await untilInPipedrive(fx, TRIGGER, 'Second lead not created', async () => {
      await fx.people.open(id);
      expect(await fx.people.leadTitles()).toEqual([p.email, p.email]);
    });
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });

  test('4: prospect has no first or last name', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Lead > 4', { 'First Name': '', 'Last Name': '' });
    await configure(fx, TRIGGER, [PD.createLead]);
    await send(fx, p);
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Lead "${p.email}" not on the person`, async () => {
      await fx.people.open(id);
      expect(await fx.people.leadTitles()).toEqual([p.email]);
    });
    expect(await fx.people.name()).toBe('(No Name)');
  });

  test('5: person exists with the email in different letter case', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Lead > 5');
    const id = await personFirst(fx, p, p.email.toUpperCase());
    await configure(fx, TRIGGER, [PD.createLead]);
    await send(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Lead "${p.email}" not on the existing person`, async () => {
      await fx.people.open(id);
      expect(await fx.people.leadTitles()).toEqual([p.email]);
    });
    expect(await fx.people.idsByEmail(p.email), 'no second person').toEqual([id]);
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
    expect([...titles].sort(), 'legacy deals unchanged, one new deal').toEqual([...legacy, p.email].sort());
    const ids = await fx.people.dealIds();
    const created = await fx.deals.read(ids[ids.length - 1]);
    expect(created).toMatchObject({ title: p.email, pipeline: PIPEDRIVE_PIPELINE, stage: 'Qualified' });
  }

  test('1: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Deal > 1');
    await configure(fx, TRIGGER, picks);
    await send(fx, p);
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
    await send(fx, p);
    await expectNewDeal(fx, p, id, legacy);
  });

  test('3: person has 2 deals', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Deal > 3');
    const id = await personFirst(fx, p);
    const legacy = await legacyDeals(fx, id, 2);
    await configure(fx, TRIGGER, picks);
    await send(fx, p);
    await expectNewDeal(fx, p, id, legacy);
  });
});

// ---- Create a Person ----

test.describe('Create a Person', () => {
  test('1: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Person > 1');
    await configure(fx, TRIGGER, [PD.createPerson]);
    await send(fx, p);
    const id = await expectOnePerson(fx, p);
    let count = 0;
    await untilInPipedrive(fx, TRIGGER, 'Activity not on the person', async () => {
      await fx.people.open(id);
      count = await fx.people.activityCount();
      expect(count).toBe(1);
    });
    const [activity] = await fx.people.activities();
    expect(activity).toMatchObject({ subject: SUBJECT, type: 'Email', done: true });
    expect(activity.note.length, 'the note holds the email body').toBeGreaterThan(20);
    test.info().annotations.push({ type: 'activity note', description: activity.note.slice(0, 300) });
  });

  test('2: person exists (second send, step 2)', async ({ fx }) => {
    test.setTimeout(minutes(2));
    const p = prospect('Create a Person > 2');
    await configure(fx, TRIGGER, [PD.createPerson]);
    await send(fx, p);
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'First activity not created', async () => {
      await fx.people.open(id);
      expect(await fx.people.activityCount()).toBe(1);
    });
    await send(fx, p, 2);
    await untilInPipedrive(fx, TRIGGER, 'Second activity not added', async () => {
      await fx.people.open(id);
      expect(await fx.people.activityCount()).toBe(2);
    });
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });

  test('3: Contact Fields mapped and the prospect has values', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create a Person > 3');
    await configure(fx, TRIGGER, [PD.createPerson]);
    await send(fx, p);
    const id = await expectOnePerson(fx, p);
    // Mapped on gpipedrive 2026-10-26: First Name, Last Name, Email, Phone, and Job Title to the custom field "Job Title".
    let details: Record<string, string> = {};
    await untilInPipedrive(fx, TRIGGER, 'Mapped values not on the person', async () => {
      await fx.people.open(id);
      details = await fx.people.details();
      expect(details['Job Title']).toBe(p.row['Job Title']);
    });
    expect(details['First name']).toBe(p.row['First Name']);
    expect(details['Last name']).toBe(p.row['Last Name']);
    test.info().annotations.push({ type: 'person details', description: JSON.stringify(details) });
  });

  test('4: a mapped value has the wrong type for its Pipedrive field', async () => {
    test.skip(true, 'Needs a Contact Fields mapping with a wrong-type pairing, set on the Configure screen first.');
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
    await send(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not updated', async () => {
      expect(await fx.deals.read(newest)).toMatchObject({ title: p.email, pipeline: PIPEDRIVE_PIPELINE, stage: 'Contact Made' });
    });
    expect(await fx.deals.read(older), 'older deal unchanged').toMatchObject({ title: 'Legacy deal 1', stage: 'Qualified' });
  });

  test('2: person has no deal', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update a Deal > 2');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, picks);
    await send(fx, p);
    await staysUnchanged(fx, async () => {
      await fx.people.open(id);
      expect(await fx.people.dealTitles(), 'nothing created').toEqual([]);
    });
    await recordLog(fx, TRIGGER);
  });

  test('3: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update a Deal > 3');
    await configure(fx, TRIGGER, picks);
    await send(fx, p);
    await expectNoPerson(fx, p);
    // Known B2: the run ends in Error. Recorded, not failed.
    await recordLog(fx, TRIGGER);
  });
});

// ---- Update a Person ----

test.describe('Update a Person', () => {
  test('1: person exists', async ({ fx }) => {
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
    expect(activity).toMatchObject({ subject: SUBJECT, done: true });
    test.info().annotations.push({ type: 'activity note (should not hold the email body)', description: activity.note.slice(0, 300) });
    test.info().annotations.push({ type: 'person details after the update', description: JSON.stringify(await fx.people.details()) });
  });

  test('2: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update a Person > 2');
    await configure(fx, TRIGGER, [PD.updatePerson]);
    await send(fx, p);
    await expectNoPerson(fx, p);
    // Known B1: the run ends in Error. Recorded, not failed.
    await recordLog(fx, TRIGGER);
  });

  test('3: Create a Person in slot 1 and Update a Person in slot 2, person exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update a Person > 3');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.createPerson, PD.updatePerson]);
    await send(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Two activities not on the person', async () => {
      await fx.people.open(id);
      expect(await fx.people.activityCount()).toBe(2);
    });
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
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
    await send(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not deleted', async () => {
      await fx.people.open(id);
      expect(await fx.people.dealIds()).toEqual([older]);
    });
    expect(newest).not.toBe(older);
  });

  test('2: person has no deal', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Delete Deal > 2');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.deleteDeal]);
    await send(fx, p);
    await staysUnchanged(fx, async () => {
      expect(await fx.people.idsByEmail(p.email), 'person kept').toEqual([id]);
    });
    // Nothing happens is proposed, unconfirmed: the Logs entry is recorded.
    await recordLog(fx, TRIGGER);
  });

  test('3: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Delete Deal > 3');
    await configure(fx, TRIGGER, [PD.deleteDeal]);
    await send(fx, p);
    await expectNoPerson(fx, p);
    // Known B2: the run ends in Error. Recorded, not failed.
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
    await send(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Person ${p.email} not deleted`, async () => {
      expect(await fx.people.idsByEmail(p.email)).toHaveLength(0);
    });
  });

  test('2: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Delete Person > 2');
    await configure(fx, TRIGGER, [PD.deletePerson]);
    await send(fx, p);
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
    await send(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not created`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before + 1);
    });
    expect(await fx.people.idsByEmail(p.email), 'not linked to any person').toHaveLength(0);
  });

  test('2: an organization with the same name exists', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Create Organization > 2', PICKLIST_INDUSTRY);
    const before = await fx.orgs.countByName(p.row['Company']);
    await orgFirst(fx, p, p.row['Company']);
    await configure(fx, TRIGGER, [PD.createOrganization]);
    await send(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Second organization "${p.row['Company']}" not created`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before + 2);
    });
  });

  test('3: Industry gets free text but the Pipedrive field is a picklist', async ({ fx }) => {
    test.setTimeout(minutes(1));
    // Company Industry is "Cloud Computing", which is not one of the Pipedrive picklist options.
    // Organisation Fields on gpipedrive already map Company Industry to Industry (read 2026-10-26).
    const p = prospect('Create Organization > 3', { Industry: 'Cloud Computing', 'Company Industry': 'Cloud Computing' });
    const before = await fx.orgs.countByName(p.row['Company']);
    markUsed(CSV, p.email);
    await configure(fx, TRIGGER, [PD.createOrganization]);
    await send(fx, p);
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company']), 'no organization created').toBe(before);
    });
    // The run status is not documented (proposed, unconfirmed): the Logs entry is recorded.
    await recordLog(fx, TRIGGER);
  });

  test('4: Company Industry matches a Pipedrive picklist option', async ({ fx }) => {
    test.setTimeout(minutes(1));
    // Company Industry is "Retail", one of the 20 Pipedrive options.
    const p = prospect('Create Organization > 4', PICKLIST_INDUSTRY);
    const before = await fx.orgs.countByName(p.row['Company']);
    markUsed(CSV, p.email);
    await configure(fx, TRIGGER, [PD.createOrganization]);
    await send(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not created`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before + 1);
    });
    // TODO(needs-input): read the Industry value on the organization page; the organizations page
    // object has no Details reader yet and its selectors are not seen. Until then the Logs entry is recorded.
    await recordLog(fx, TRIGGER);
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
    await send(fx, p);
    // The update only changes the name (unchanged) and mapped fields, which are not read yet, so the
    // visible result is that no second organization appears and the Logs entry is Success.
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before + 1);
    });
    await recordLog(fx, TRIGGER);
  });

  test('2: organization exists with the name in different letter case', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update Organization > 2');
    const variant = p.row['Company'].toUpperCase();
    const beforeVariant = await fx.orgs.countByName(variant);
    const beforeExact = await fx.orgs.countByName(p.row['Company']);
    await orgFirst(fx, p, variant);
    await configure(fx, TRIGGER, [PD.updateOrganization]);
    await send(fx, p);
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(variant), 'case variant kept').toBe(beforeVariant + 1);
      expect(await fx.orgs.countByName(p.row['Company']), 'no organization with the exact name').toBe(beforeExact);
    });
  });

  test('3: no organization with that name', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Update Organization > 3');
    const before = await fx.orgs.countByName(p.row['Company']);
    markUsed(CSV, p.email);
    await configure(fx, TRIGGER, [PD.updateOrganization]);
    await send(fx, p);
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
    await send(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not deleted`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before);
    });
  });

  test('2: no organization with that name', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Delete Organization > 2');
    const before = await fx.orgs.countByName(p.row['Company']);
    markUsed(CSV, p.email);
    await configure(fx, TRIGGER, [PD.deleteOrganization]);
    await send(fx, p);
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before);
    });
    // Nothing happens is proposed, unconfirmed: the Logs entry is recorded.
    await recordLog(fx, TRIGGER);
  });
});

// ---- Combined actions ----

test.describe('Combined actions', () => {
  test('1: Create a Lead, Create a Deal and Create a Person, prospect not in Pipedrive', async ({ fx }) => {
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

  test('2: Create Organization and Create a Person, prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(minutes(1));
    const p = prospect('Combined actions > 2', PICKLIST_INDUSTRY);
    const before = await fx.orgs.countByName(p.row['Company']);
    await configure(fx, TRIGGER, [PD.createOrganization, PD.createPerson]);
    await send(fx, p);
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Activity and organization not created', async () => {
      await fx.people.open(id);
      expect(await fx.people.activityCount()).toBe(1);
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before + 1);
    });
    await fx.people.open(id);
    expect(await fx.people.organization(), 'organization not linked to the person').toBeUndefined();
  });
});
