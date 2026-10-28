// Scenarios: test-cases/pipedrive/email-bounced.md (Regression, 37 rows, QA OK 2026-10-27; workflow
//   ticket AL-4183, every row None). One test per row, named "<section>: <n>".
// Data: test-data/pipedrive/email-bounced.csv, one prospect per row, found by the Scenario column
//   (scripts/make-pipedrive-email-bounced-data.ts). A record that must exist first is made by hand in
//   Pipedrive with the prospect's email.
// Sequence: "Pipedrive Email Bounced QA" on gpipedrive, one step
//   (tests/setup/pipedrive-email-bounced-sequence.spec.ts).
// Page objects and flow: same as tests/pipedrive/email-sent.spec.ts.
//
// How a row bounces: Emails tab > the prospect's row > Actions > Mark as bounced, with no send (the
// manual way, same as HubSpot). Only Trigger behavior 5 is a real bounce, through a
// <company>.mailinator.com address (cap 1, QA 2026-10-27). Other triggers are left as they are
// (KEEP_OTHER_TRIGGERS), so this file can run beside the other Pipedrive sessions on the same account
// (the Link Clicked session asked for this, 2026-10-27). Only Trigger behavior 5 sends an email, so only
// that row can start an Email Sent run if another session left Email Sent on. Rows whose Expected
// result is marked "(proposed, unconfirmed)" record what happened as a test annotation instead of
// asserting it.
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { pipedriveIndustry } from '../../src/data/pipedrive-industries.ts';
import { companyFields, companyNames } from '../../src/data/generate.ts';
import { configure, fullName, recordLog, staysUnchanged, untilInPipedrive } from '../../src/flows/saleshandy-to-pipedrive.ts';
import { PD, PIPEDRIVE_PIPELINE, PIPEDRIVE_STAGES } from '../../src/pages/saleshandy/pipedrive-integration.page.ts';
import type { Page } from '@playwright/test';
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
};

// Ctrl+Shift+R after the first load, so both sites start from a fresh cache (QA, 2026-10-27).
// Waits for DOMContentLoaded only: the Saleshandy start page did not always reach "load".
async function hardRefresh(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.keyboard.press('Control+Shift+R');
  await page.waitForLoadState('domcontentloaded', { timeout: 60_000 });
}

const test = base.extend<{ fx: Fx }>({
  fx: async ({ pipedriveIntegration, saleshandySequence, pipedrivePeople, pipedriveDeals, pipedriveLeads, pipedriveOrganizations }, use) => {
    await hardRefresh(saleshandySequence.page, '/');
    await hardRefresh(pipedrivePeople.page, '/');
    await use({ pipedriveIntegration, saleshandySequence, people: pipedrivePeople, deals: pipedriveDeals, leads: pipedriveLeads, orgs: pipedriveOrganizations });
  },
});

test.use({ account: 'gpipedrive' });

// Name on Triggers & Activity and in Logs, and the subject of the activity it adds.
const TRIGGER = 'Email is Bounced in Saleshandy';
const SUBJECT = 'Email is bounced in Saleshandy';
const SEQUENCE_ID = '197375'; // "Pipedrive Email Bounced QA" on gpipedrive, made by tests/setup/pipedrive-email-bounced-sequence.spec.ts
const CSV = 'pipedrive/email-bounced.csv';

const QUALIFIED = { pipeline: PIPEDRIVE_PIPELINE, stage: 'Qualified' };
const CONTACT_MADE = { pipeline: PIPEDRIVE_PIPELINE, stage: 'Contact Made' };

// A manual row is one trigger save, one add, one mark and a Pipedrive look. The real bounce adds a send
// and the wait for Saleshandy to set Bounced (up to 5 minutes).
const ROW = 4 * 60_000;
const REAL_ROW = 12 * 60_000;

type Prospect = { row: Row; email: string; name: string };

function prospect(scenario: string): Prospect {
  const found = readCsv(CSV).find((r) => r['Scenario'] === scenario);
  if (!found) throw new Error(`No row "${scenario}" in test-data/${CSV}`);
  // Rows made before the generator used Pipedrive's industry list still hold other values (see src/data/pipedrive-industries.ts).
  const row: Row = { ...found, 'Company Industry': pipedriveIndustry(found['Company Industry']) };
  // Used from the moment a test takes the row, not after the bounce: rows do not clean up Pipedrive
  // (QA 2026-10-26), so a row that stopped in its setup would otherwise return with the same email.
  markUsed(CSV, row['Email']);
  // "No first name and no last name": a data refresh makes new people with names, so the names are blanked here.
  if (scenario === 'Create a Person > 4') Object.assign(row, { 'First Name': '', 'Last Name': '' });
  return { row, email: row['Email'], name: fullName(row) };
}

// The organization rows need a company that has no organization yet. Rows do not delete their records, so the
// pool's names fill up in Pipedrive (Greenhouse, Notion and others had 2 or 3 each, 2026-10-28): take a random pool
// name that is not on the Organizations list (compared without case, for the letter-case row) and give the prospect it.
async function useFreeCompany(fx: Fx, p: Prospect): Promise<void> {
  const taken = new Set((await fx.orgs.names()).map((n) => n.toLowerCase()));
  const free = companyNames().filter((n) => !taken.has(n.toLowerCase()));
  if (!free.length) throw new Error('Every company of the pool already has an organization in Pipedrive; add companies to COMPANIES in src/data/generate.ts');
  const fields = companyFields(free[Math.floor(Math.random() * free.length)]);
  Object.assign(p.row, fields, { 'Company Industry': pipedriveIndustry(fields['Company Industry']) });
}

// Records a row needs before the bounce: made by hand with the prospect's email and a legacy name, so
// a change by the workflow is visible.
async function personFirst(fx: Fx, p: Prospect, email = p.email): Promise<string> {
  return test.step(`Create the person ${email} in Pipedrive (legacy name)`, async () => fx.people.create({ name: 'Legacy Person', email }));
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

async function orgFirst(fx: Fx, name: string): Promise<string> {
  return test.step(`Create the organization "${name}" in Pipedrive`, async () => fx.orgs.create(name));
}

// Adds the prospect to the sequence. The step 1 email is not sent: Mark as bounced works on a row that
// is still scheduled.
async function addProspect(fx: Fx, p: Prospect): Promise<void> {
  await test.step(`Add ${p.name || p.email} to the sequence`, async () => {
    await fx.saleshandySequence.createAndAddProspect(SEQUENCE_ID, p.row);
  });
}

// "Mark the step 1 email as bounced": adds the prospect, then Emails tab > row > Actions > Mark as bounced.
async function bounce(fx: Fx, p: Prospect): Promise<void> {
  await addProspect(fx, p);
  await test.step('Mark the step 1 email as bounced', async () => {
    await fx.saleshandySequence.markAsBounced(SEQUENCE_ID, p.name, 1, p.email);
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

// ---- Trigger behavior (baseline) ----

test.describe('Trigger behavior', () => {
  test('1: trigger on, Create a Person, save', async ({ fx }) => {
    test.setTimeout(ROW);
    await configure(fx, TRIGGER, [PD.createPerson]);
  });

  test('2: Create a Person, prospect not in Pipedrive, sequence Active', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Trigger behavior > 2');
    await configure(fx, TRIGGER, [PD.createPerson]);
    await bounce(fx, p);
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Activity not on the person', async () => {
      await fx.people.open(id);
      expect(await fx.people.activityCount()).toBe(1);
    });
    const [activity] = await fx.people.activities();
    expect(activity).toMatchObject({ subject: SUBJECT, type: 'Email', done: true });
  });

  test('3: Create a Person, sequence paused after being Active', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Trigger behavior > 3');
    await configure(fx, TRIGGER, [PD.createPerson]);
    await addProspect(fx, p);
    try {
      await test.step('Pause the sequence', async () => {
        await fx.saleshandySequence.pauseSequence(SEQUENCE_ID);
      });
      await test.step('Mark the step 1 email as bounced while the sequence is paused', async () => {
        await fx.saleshandySequence.markAsBounced(SEQUENCE_ID, p.name, 1, p.email);
      });
    } finally {
      await fx.saleshandySequence.resumeSequence(SEQUENCE_ID);
    }
    // Proposed, unconfirmed: same result as row 2. Recorded, not asserted.
    let ids: string[] = [];
    await untilInPipedrive(fx, TRIGGER, `No person for ${p.email} in Pipedrive`, async () => {
      ids = await fx.people.idsByEmail(p.email);
      expect(ids.length).toBeGreaterThan(0);
    });
    await fx.people.open(ids[0]);
    test.info().annotations.push({ type: 'persons / activities (proposed, unconfirmed)', description: `${ids.length} person(s); first has ${await fx.people.activityCount()} activity` });
  });

  test('4: only "Reply is Received in Saleshandy" enabled', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Trigger behavior > 4');
    await fx.pipedriveIntegration.setActivities('Reply is Received in Saleshandy', [PD.createPerson]);
    await expect(fx.pipedriveIntegration.savedToast()).toBeVisible({ timeout: 15_000 });
    // KEEP_OTHER_TRIGGERS leaves "Email is Bounced" on from the rows before; this row needs it off (2026-10-28:
    // the bounce created a person while only Reply was meant to be on).
    await test.step(`Turn "${TRIGGER}" off and save`, async () => {
      await fx.pipedriveIntegration.disable(TRIGGER);
      await fx.pipedriveIntegration.save();
      await expect(fx.pipedriveIntegration.savedToast()).toBeVisible({ timeout: 15_000 });
    });
    await bounce(fx, p);
    await expectNoPerson(fx, p);
  });

  test('5: real bounce, Create a Person, prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(REAL_ROW);
    const found = prospect('Trigger behavior > 5');
    // @mailinator.com never bounces, @<company>.mailinator.com does (QA 2026-10-12). The CSV keeps the
    // plain address, so the real-bounce one is built here, as in the HubSpot spec.
    // This row has no company in the data (an empty one made the address "@.mailinator.com", rejected as invalid, 2026-10-28).
    if (!found.row['Company']) Object.assign(found.row, companyFields(companyNames()[Math.floor(Math.random() * companyNames().length)]));
    const company = found.row['Company'].normalize('NFKD').replace(/[^A-Za-z]/g, '').toLowerCase();
    const email = found.email.replace(/@mailinator\.com$/i, `@${company}.mailinator.com`);
    const p: Prospect = { ...found, email, row: { ...found.row, Email: email } };
    markUsed(CSV, email);
    await configure(fx, TRIGGER, [PD.createPerson]);
    await addProspect(fx, p);
    await test.step('Send step 1', async () => {
      await fx.saleshandySequence.sendNow(SEQUENCE_ID, p.name, 1, p.email);
    });
    await test.step('Wait for Saleshandy to show the email as Bounced (no Mark as bounced)', async () => {
      await fx.saleshandySequence.waitUntilBounced(SEQUENCE_ID, p.name);
    });
    // Proposed, unconfirmed: person and one activity, same as row 2. Recorded, not asserted.
    let ids: string[] = [];
    await untilInPipedrive(fx, TRIGGER, `No person for ${p.email} in Pipedrive`, async () => {
      ids = await fx.people.idsByEmail(p.email);
      expect(ids.length).toBeGreaterThan(0);
    });
    await fx.people.open(ids[0]);
    test.info().annotations.push({ type: 'persons / activities (proposed, unconfirmed)', description: `${ids.length} person(s); first has ${await fx.people.activityCount()} activity` });
  });
});

// ---- Create a Person ----

test.describe('Create a Person', () => {
  test('1: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Create a Person > 1');
    await configure(fx, TRIGGER, [PD.createPerson]);
    await bounce(fx, p);
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Activity not on the person', async () => {
      await fx.people.open(id);
      expect(await fx.people.activityCount()).toBe(1);
    });
    expect(await fx.people.name()).toBe(p.name);
    const [activity] = await fx.people.activities();
    expect(activity).toMatchObject({ subject: SUBJECT, type: 'Email', done: true });
  });

  test('2: person exists with an old value in a mapped field', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Create a Person > 2');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.createPerson]);
    await bounce(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Person not updated, or activity not added', async () => {
      await fx.people.open(id);
      expect(await fx.people.name()).toBe(p.name);
      expect(await fx.people.activityCount()).toBe(1);
    });
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });

  test('3: person exists, email stored in a different letter case', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Create a Person > 3');
    const id = await personFirst(fx, p, p.email.toUpperCase());
    await configure(fx, TRIGGER, [PD.createPerson]);
    await bounce(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'The existing person was not updated', async () => {
      await fx.people.open(id);
      expect(await fx.people.name()).toBe(p.name);
    });
    expect(await fx.people.idsByEmail(p.email), 'no second person').toEqual([id]);
  });

  test('4: prospect has no first name and no last name', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Create a Person > 4');
    await configure(fx, TRIGGER, [PD.createPerson]);
    await bounce(fx, p);
    const id = await expectOnePerson(fx, p);
    await fx.people.open(id);
    expect(await fx.people.name()).toBe('(No Name)');
  });
});

// ---- Update a Person ----

test.describe('Update a Person', () => {
  test('1: person exists with an old value in a mapped field', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Update a Person > 1');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.updatePerson]);
    await bounce(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Person not updated, or activity not added', async () => {
      await fx.people.open(id);
      expect(await fx.people.name()).toBe(p.name);
      expect(await fx.people.activityCount()).toBe(1);
    });
  });

  test('2: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Update a Person > 2');
    await configure(fx, TRIGGER, [PD.updatePerson]);
    await bounce(fx, p);
    await expectNoPerson(fx, p);
    // Known B1: the run ends in Error. Recorded, not failed.
    await recordLog(fx, TRIGGER);
  });
});

// ---- Create a Lead ----

test.describe('Create a Lead', () => {
  test('1: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Create a Lead > 1');
    await configure(fx, TRIGGER, [PD.createLead]);
    await bounce(fx, p);
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Lead "${p.email}" not on the person`, async () => {
      await fx.people.open(id);
      expect(await fx.people.leadTitles()).toEqual([p.email]);
    });
    expect(await fx.people.activityCount(), 'no activity from a lead').toBe(0);
  });

  test('2: person exists', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Create a Lead > 2');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.createLead]);
    await bounce(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Lead "${p.email}" not on the person`, async () => {
      await fx.people.open(id);
      expect(await fx.people.leadTitles()).toEqual([p.email]);
    });
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });

  test('3: person already has a lead', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Create a Lead > 3');
    const id = await personFirst(fx, p);
    await test.step('Create a legacy lead on the person', async () => {
      await fx.leads.createForPerson('Legacy Person', 'Legacy lead');
    });
    await configure(fx, TRIGGER, [PD.createLead]);
    await bounce(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Second lead "${p.email}" not on the person`, async () => {
      await fx.people.open(id);
      expect([...(await fx.people.leadTitles())].sort()).toEqual(['Legacy lead', p.email].sort());
    });
  });
});

// ---- Create a Deal ----

test.describe('Create a Deal', () => {
  async function expectNewDeal(fx: Fx, p: Prospect, personId: string, legacy: string[], stage: string): Promise<void> {
    let titles: string[] = [];
    await untilInPipedrive(fx, TRIGGER, `Deal "${p.email}" not on the person`, async () => {
      await fx.people.open(personId);
      titles = await fx.people.dealTitles();
      expect(titles).toContain(p.email);
    });
    expect([...titles].sort(), 'existing deals unchanged, one new deal').toEqual([...legacy, p.email].sort());
    const ids = await fx.people.dealIds();
    const created = await fx.deals.read(ids[ids.length - 1]);
    expect(created).toMatchObject({ title: p.email, pipeline: PIPEDRIVE_PIPELINE, stage });
    test.info().annotations.push({ type: 'new deal', description: JSON.stringify(created) });
  }

  test('1: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Create a Deal > 1');
    await configure(fx, TRIGGER, [{ activity: PD.createDeal, extra: QUALIFIED }]);
    await bounce(fx, p);
    const id = await expectOnePerson(fx, p);
    await expectNewDeal(fx, p, id, [], 'Qualified');
    await fx.people.open(id);
    expect(await fx.people.activityCount(), 'no activity from a deal').toBe(0);
    expect(await fx.people.organization(), 'no organization link').toBeUndefined();
  });

  test('2: person has 1 deal', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Create a Deal > 2');
    const id = await personFirst(fx, p);
    const legacy = await legacyDeals(fx, id, 1);
    await configure(fx, TRIGGER, [{ activity: PD.createDeal, extra: QUALIFIED }]);
    await bounce(fx, p);
    await expectNewDeal(fx, p, id, legacy, 'Qualified');
  });

  test('3: Extra Configuration saved with Stage = Proposal Made', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Create a Deal > 3');
    await configure(fx, TRIGGER, [{ activity: PD.createDeal, extra: { pipeline: PIPEDRIVE_PIPELINE, stage: 'Proposal Made' } }]);
    await bounce(fx, p);
    const id = await expectOnePerson(fx, p);
    await expectNewDeal(fx, p, id, [], 'Proposal Made');
  });
});

// ---- Update a Deal ----

test.describe('Update a Deal', () => {
  const picks = [{ activity: PD.updateDeal, extra: CONTACT_MADE }];

  test('1: person has 2 deals', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Update a Deal > 1');
    const id = await personFirst(fx, p);
    await legacyDeals(fx, id, 2);
    await fx.people.open(id);
    const [older, newest] = await fx.people.dealIds();
    await configure(fx, TRIGGER, picks);
    await bounce(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not updated', async () => {
      expect(await fx.deals.read(newest)).toMatchObject({ title: p.email, pipeline: PIPEDRIVE_PIPELINE, stage: 'Contact Made' });
    });
    expect(await fx.deals.read(older), 'older deal unchanged').toMatchObject({ title: 'Legacy deal 1', stage: 'Qualified' });
  });

  test('2: person exists with no deal', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Update a Deal > 2');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, picks);
    await bounce(fx, p);
    await staysUnchanged(fx, async () => {
      await fx.people.open(id);
      expect(await fx.people.dealTitles(), 'nothing created').toEqual([]);
    });
    await recordLog(fx, TRIGGER);
  });

  test('3: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Update a Deal > 3');
    await configure(fx, TRIGGER, picks);
    await bounce(fx, p);
    await expectNoPerson(fx, p);
    // Known B2: the run ends in Error. Recorded, not failed.
    await recordLog(fx, TRIGGER);
  });
});

// ---- Delete Deal ----

test.describe('Delete Deal', () => {
  test('1: person has 2 deals', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Delete Deal > 1');
    const id = await personFirst(fx, p);
    await legacyDeals(fx, id, 2);
    await fx.people.open(id);
    const [older] = await fx.people.dealIds();
    await configure(fx, TRIGGER, [PD.deleteDeal]);
    await bounce(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not deleted', async () => {
      await fx.people.open(id);
      expect(await fx.people.dealIds()).toEqual([older]);
    });
  });

  test('2: person exists with no deal', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Delete Deal > 2');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.deleteDeal]);
    await bounce(fx, p);
    await staysUnchanged(fx, async () => {
      expect(await fx.people.idsByEmail(p.email), 'person kept').toEqual([id]);
    });
    await recordLog(fx, TRIGGER);
  });

  test('3: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Delete Deal > 3');
    await configure(fx, TRIGGER, [PD.deleteDeal]);
    await bounce(fx, p);
    await expectNoPerson(fx, p);
    // Known B2: the run ends in Error. Recorded, not failed.
    await recordLog(fx, TRIGGER);
  });
});

// ---- Delete Person ----

test.describe('Delete Person', () => {
  test('1: person exists', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Delete Person > 1');
    await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.deletePerson]);
    await bounce(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Person ${p.email} not deleted`, async () => {
      expect(await fx.people.idsByEmail(p.email)).toHaveLength(0);
    });
  });

  test('2: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Delete Person > 2');
    await configure(fx, TRIGGER, [PD.deletePerson]);
    await bounce(fx, p);
    await expectNoPerson(fx, p);
  });
});

// ---- Create Organization ----

test.describe('Create Organization', () => {
  test('1: prospect has a company, no organization with that name', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Create Organization > 1');
    await useFreeCompany(fx, p);
    expect(await fx.orgs.countByName(p.row['Company']), 'the company name is free').toBe(0);
    await configure(fx, TRIGGER, [PD.createOrganization]);
    await bounce(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not created`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(1);
    });
    expect(await fx.people.idsByEmail(p.email), 'not linked to any person').toHaveLength(0);
  });

  test('2: an organization with that name already exists', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Create Organization > 2');
    await useFreeCompany(fx, p);
    await orgFirst(fx, p.row['Company']);
    await configure(fx, TRIGGER, [PD.createOrganization]);
    await bounce(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Second organization "${p.row['Company']}" not created`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(2);
    });
  });
});

// ---- Update Organization ----

test.describe('Update Organization', () => {
  test('1: an organization with the exact company name exists', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Update Organization > 1');
    await useFreeCompany(fx, p);
    await orgFirst(fx, p.row['Company']);
    await configure(fx, TRIGGER, [PD.updateOrganization]);
    await bounce(fx, p);
    // The mapped fields are not read by the organization page yet: the visible result is that no second
    // organization appears and the Logs entry is Success.
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(1);
    });
    await recordLog(fx, TRIGGER);
  });

  test('2: an organization with the same name in a different letter case', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Update Organization > 2');
    await useFreeCompany(fx, p);
    const upper = p.row['Company'].toUpperCase();
    const id = await orgFirst(fx, upper);
    await configure(fx, TRIGGER, [PD.updateOrganization]);
    await bounce(fx, p);
    // The match is case-sensitive: nothing is created and the existing one keeps its name.
    await staysUnchanged(fx, async () => {
      await fx.orgs.open(id);
      expect(await fx.orgs.name()).toBe(upper);
      // idsByName matches the exact case: the upper-case organization is the only one, none exists under the prospect's own case.
      expect(await fx.orgs.idsByName(upper), 'the upper-case organization is the only one').toEqual([id]);
      expect(await fx.orgs.idsByName(p.row['Company']), 'no organization created under the prospect\'s case').toEqual([]);
    });
  });
});

// ---- Delete Organization ----

test.describe('Delete Organization', () => {
  test('1: an organization with the exact company name exists', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Delete Organization > 1');
    await useFreeCompany(fx, p);
    await orgFirst(fx, p.row['Company']);
    await configure(fx, TRIGGER, [PD.deleteOrganization]);
    await bounce(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not deleted`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(0);
    });
  });
});

// ---- Combined actions ----

test.describe('Combined actions', () => {
  test('1: Create a Lead, Create a Deal and Create a Person, prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Combined actions > 1');
    await configure(fx, TRIGGER, [PD.createLead, { activity: PD.createDeal, extra: QUALIFIED }, PD.createPerson]);
    await bounce(fx, p);
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Lead, deal and activity not all on the person', async () => {
      await fx.people.open(id);
      expect(await fx.people.leadTitles()).toEqual([p.email]);
      expect(await fx.people.dealTitles()).toEqual([p.email]);
      expect(await fx.people.activityCount()).toBe(1);
    });
    expect(await fx.people.idsByEmail(p.email), 'exactly one person').toEqual([id]);
  });

  test('2: Create a Person and Update a Person, person exists', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Combined actions > 2');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.createPerson, PD.updatePerson]);
    await bounce(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Two activities not on the person', async () => {
      await fx.people.open(id);
      expect(await fx.people.activityCount()).toBe(2);
    });
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });

  test('3: Create a Person and Create Organization, prospect has a company', async ({ fx }) => {
    test.setTimeout(ROW);
    const p = prospect('Combined actions > 3');
    await useFreeCompany(fx, p);
    expect(await fx.orgs.countByName(p.row['Company']), 'the company name is free').toBe(0);
    await configure(fx, TRIGGER, [PD.createPerson, PD.createOrganization]);
    await bounce(fx, p);
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not created`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(1);
    });
    await fx.people.open(id);
    expect(await fx.people.organization(), 'organization not linked to the person').toBeUndefined();
  });
});

// ---- Trigger screen (UI only, no prospect is bounced) ----

test.describe('Trigger screen', () => {
  test('1: the action list shows the 10 actions', async ({ fx }) => {
    test.setTimeout(ROW);
    await fx.pipedriveIntegration.openTriggers();
    await fx.pipedriveIntegration.enableOnly(TRIGGER);
    await fx.pipedriveIntegration.openActivityList(TRIGGER);
    for (const label of Object.values(PD)) {
      await expect(fx.pipedriveIntegration.activityOption(label), label).toBeVisible();
    }
  });

  test('2: Create a Deal Extra Configuration lists the pipeline and the stages', async ({ fx }) => {
    test.setTimeout(ROW);
    const integration = fx.pipedriveIntegration;
    await integration.openTriggers();
    await integration.enableOnly(TRIGGER);
    await integration.selectActivity(TRIGGER, PD.createDeal);
    const dialog = integration.extraConfiguration();
    await dialog.waitFor({ timeout: 15_000 });
    const lists = dialog.locator('.bs-select-box');
    const overlay = fx.saleshandySequence.page.locator('.transfer-select-box li');
    await lists.nth(0).click();
    expect((await overlay.allInnerTexts()).map((t) => t.trim())).toEqual([PIPEDRIVE_PIPELINE]);
    await overlay.filter({ hasText: PIPEDRIVE_PIPELINE }).click();
    await lists.nth(1).click();
    await expect(overlay.first()).toBeVisible({ timeout: 15_000 });
    expect((await overlay.allInnerTexts()).map((t) => t.trim())).toEqual([...PIPEDRIVE_STAGES]);
  });

  test('3: Create a Deal saved with Stage = Proposal Made, reopened', async ({ fx }) => {
    test.setTimeout(ROW);
    const integration = fx.pipedriveIntegration;
    await configure(fx, TRIGGER, [{ activity: PD.createDeal, extra: { pipeline: PIPEDRIVE_PIPELINE, stage: 'Proposal Made' } }]);
    await integration.reopenExtraConfiguration(TRIGGER, PD.createDeal);
    const dialog = integration.extraConfiguration();
    await dialog.waitFor({ timeout: 15_000 });
    // Proposed, unconfirmed: the saved values are shown. Recorded, not asserted.
    test.info().annotations.push({ type: 'reopened Extra Configuration (proposed, unconfirmed)', description: (await dialog.innerText()).replace(/\s+/g, ' ') });
  });

  test('4: Create a Deal Extra Configuration with Pipeline and Stage empty', async ({ fx }) => {
    test.setTimeout(ROW);
    const integration = fx.pipedriveIntegration;
    await integration.openTriggers();
    await integration.enableOnly(TRIGGER);
    for (const chip of await integration.selectedActivities(TRIGGER)) await integration.removeActivity(TRIGGER, chip);
    await integration.selectActivity(TRIGGER, PD.createDeal);
    await integration.extraConfiguration().waitFor({ timeout: 15_000 });
    // Proposed, unconfirmed: Save is disabled. Recorded, not asserted.
    test.info().annotations.push({ type: 'Save disabled (proposed, unconfirmed)', description: String(await integration.configSaveButton().isDisabled()) });
  });
});
