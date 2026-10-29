// Scenarios: test-cases/pipedrive/prospect-unsubscribed.md (Regression, 29 rows, QA OK 2026-10-24;
//   no Jira ticket). One test per row, named "<section>: <n>".
// Data: test-data/pipedrive/prospect-unsubscribed.csv, one prospect per row, found by the Scenario
//   column. A record that must exist first is made by hand in Pipedrive with the prospect's email.
// Sequence: "Pipedrive Unsubscribed QA" (197339) on gpipedrive, one step, sender Kartik 60,
//   "Unsubscribe as Link" saved (tests/setup/pipedrive-unsubscribed-sequence.spec.ts).
// Page objects and flow: same as tests/pipedrive/email-sent.spec.ts.
//
// How a row unsubscribes (seen on staging 2026-10-26): Unsubscribe (UI) is Mark as Unsubscribe on the
// Prospects tab and fires the workflow even though the prospect was never sent anything, so UI rows
// send no email (the case file's "Step 1 shows Sent" is not needed, and it keeps Email Sent, which the
// Email Sent session leaves on in the same account, out of these rows). Unsubscribe (link) needs the
// real email: the row sends step 1, waits for the Email Sent run of the other session to finish,
// removes whatever it made in Pipedrive, then opens the link from Mailinator.
//
// Other triggers are left as they are (KEEP_OTHER_TRIGGERS), so this file can run beside the Email Sent
// and Outcome Updated sessions on the same account. Rows whose Expected result is marked
// "(proposed, unconfirmed)" record what happened as a test annotation instead of asserting it.
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { companyFields, companyNames } from '../../src/data/generate.ts';
import { markUsed } from '../../src/data/used.ts';
import { pipedriveIndustry } from '../../src/data/pipedrive-industries.ts';
import { configure, fullName, recordLog, sendEmail, staysUnchanged, untilInPipedrive } from '../../src/flows/saleshandy-to-pipedrive.ts';
import { PD, PIPEDRIVE_PIPELINE } from '../../src/pages/saleshandy/pipedrive-integration.page.ts';
import type { Page } from '@playwright/test';
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

// Ctrl+Shift+R after the first load, so both sites start from a fresh cache (QA, 2026-10-27).
// Waits for DOMContentLoaded only: the Saleshandy start page never reached "load" in 3 of 7 rows
// (2026-10-27, 5 min test timeout), and goto has no time limit of its own here.
async function hardRefresh(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.keyboard.press('Control+Shift+R');
  await page.waitForLoadState('domcontentloaded', { timeout: 60_000 });
}

const test = base.extend<{ fx: Fx }>({
  fx: async ({ pipedriveIntegration, saleshandySequence, pipedrivePeople, pipedriveDeals, pipedriveLeads, pipedriveOrganizations, mailinator }, use) => {
    await hardRefresh(saleshandySequence.page, '/');
    await hardRefresh(pipedrivePeople.page, '/');
    await use({ pipedriveIntegration, saleshandySequence, people: pipedrivePeople, deals: pipedriveDeals, leads: pipedriveLeads, orgs: pipedriveOrganizations, mailinator });
  },
});

test.use({ account: 'gpipedrive' });

// Name on Triggers & Activity and in Logs, and the subject of the activity it adds.
const TRIGGER = 'Prospect is Unsubscribed in Saleshandy';
const SUBJECT = TRIGGER;
const SEQUENCE_ID = '197339';
const CSV = 'pipedrive/prospect-unsubscribed.csv';
const STEP_1_SUBJECT = 'Save cost & achieve more!';
const UNSUBSCRIBED_TEXT = 'You will no longer receive emails from us';
const SUBSCRIBED_TEXT = 'You have successfully subscribed and added to our list for future communication';

const QUALIFIED = { pipeline: PIPEDRIVE_PIPELINE, stage: 'Qualified' };
const CONTACT_MADE = { pipeline: PIPEDRIVE_PIPELINE, stage: 'Contact Made' };

// A UI row is one trigger save, one add, one click and a Pipedrive look. A link row adds a send, a
// Mailinator wait and the clean-up of the Email Sent run.
const UI_ROW = 4 * 60_000;
const LINK_ROW = 12 * 60_000;

type Prospect = { row: Row; email: string; name: string };

function prospect(scenario: string): Prospect {
  const found = readCsv(CSV).find((r) => r['Scenario'] === scenario);
  if (!found) throw new Error(`No row "${scenario}" in test-data/${CSV}`);
  // Rows made before the generator used Pipedrive's industry list still hold other values (see src/data/pipedrive-industries.ts).
  const row: Row = { ...found, 'Company Industry': pipedriveIndustry(found['Company Industry']) };
  // Used from the moment a test takes the row, not after the unsubscribe: rows no longer clean up Pipedrive,
  // so a row that stopped in its setup (after the person was made) would otherwise return with the same
  // email and find two persons (Combined actions 2, 2026-10-26).
  markUsed(CSV, row['Email']);
  return { row, email: row['Email'], name: fullName(row) };
}

// Create Organization 1 needs a company that has no organization yet. Rows no longer delete their records, so
// the pool's names fill up in Pipedrive ("Zapier" had 2, 2026-10-28): take a random pool name that is not on the
// Organizations list and give the prospect that company.
async function useFreeCompany(fx: Fx, p: Prospect): Promise<void> {
  const taken = new Set(await fx.orgs.names());
  const free = companyNames().filter((n) => !taken.has(n));
  if (!free.length) throw new Error('Every company of the pool already has an organization in Pipedrive; add companies to COMPANIES in src/data/generate.ts');
  const fields = companyFields(free[Math.floor(Math.random() * free.length)]);
  Object.assign(p.row, fields, { 'Company Industry': pipedriveIndustry(fields['Company Industry']) });
}

// Used only by sendAndClear, before the row starts (QA 2026-10-26: no clean-up after a row). Removes what the
// Email Sent trigger made for the prospect: persons (with their deals), leads and organizations.
async function wipe(fx: Fx, p: Prospect): Promise<void> {
  for (const id of await fx.people.idsByEmail(p.email)) {
    await fx.people.open(id);
    for (const dealId of await fx.people.dealIds()) {
      await fx.deals.open(dealId);
      await fx.deals.deleteOpen();
    }
    await fx.people.open(id);
    await fx.people.deleteOpen();
  }
  await fx.leads.deleteByTitle(p.email);
  for (const name of [p.row['Company'], p.row['Company'].toUpperCase()]) {
    for (const id of await fx.orgs.idsByName(name)) {
      await fx.orgs.open(id);
      await fx.orgs.deleteOpen();
    }
  }
}

// Records a row needs before the unsubscribe: made by hand with the prospect's email and a legacy name,
// so a change by the workflow is visible.
async function personFirst(fx: Fx, p: Prospect): Promise<string> {
  return test.step(`Create the person ${p.email} in Pipedrive (legacy name)`, async () => fx.people.create({ name: 'Legacy Person', email: p.email }));
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

// Unsubscribe (UI): the prospect is added to the sequence and marked unsubscribed on the Prospects tab.
async function unsubscribeUi(fx: Fx, p: Prospect): Promise<void> {
  await test.step(`Add ${p.name} to the sequence`, async () => {
    await fx.saleshandySequence.createAndAddProspect(SEQUENCE_ID, p.row);
  });
  await test.step('Mark as Unsubscribe on the Prospects tab', async () => {
    await fx.saleshandySequence.markAsUnsubscribed(SEQUENCE_ID, p.email);
  });
}

// Unsubscribe (link), part 1: add, send step 1 and clear what the Email Sent trigger made in Pipedrive,
// so the row starts from "not in Pipedrive".
async function sendAndClear(fx: Fx, p: Prospect): Promise<void> {
  await sendEmail(fx, { sequenceId: SEQUENCE_ID, row: p.row, csv: CSV });
  await test.step('Wait for the Email Sent run of the other session, then clear what it made in Pipedrive', async () => {
    // Runs took 2 to 42 s on 2026-10-26; look twice so a late run does not leave a person behind.
    for (const wait of [45_000, 15_000]) {
      await fx.saleshandySequence.page.waitForTimeout(wait);
      await wipe(fx, p);
    }
  });
}

// Part 2: the real "Unsubscribe here" link of the delivered email. Returns the unsubscribe page.
async function openLink(fx: Fx, p: Prospect) {
  return test.step('Open the "Unsubscribe here" link from the Mailinator inbox', async () => {
    const page = await fx.mailinator.openUnsubscribeLink(p.email, STEP_1_SUBJECT);
    await expect(page.getByText(UNSUBSCRIBED_TEXT)).toBeVisible({ timeout: 30_000 });
    return page;
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
    test.setTimeout(UI_ROW);
    await configure(fx, TRIGGER, [PD.createPerson]);
  });

  test('2: Unsubscribe (link), Create a Person, prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(LINK_ROW);
    const p = prospect('Trigger behavior > 2');
    await configure(fx, TRIGGER, [PD.createPerson]);
    await sendAndClear(fx, p);
    const page = await openLink(fx, p);
    await expect(page.getByRole('link', { name: 'Subscribe here' })).toBeVisible();
    await fx.saleshandySequence.expectProspectStatusAfterRefresh(SEQUENCE_ID, p.email, 'Unsubscribed');
    // Proposed, unconfirmed: the person and one activity. Several persons are recorded, not asserted.
    let ids: string[] = [];
    await untilInPipedrive(fx, TRIGGER, `No person for ${p.email} in Pipedrive`, async () => {
      ids = await fx.people.idsByEmail(p.email);
      expect(ids.length).toBeGreaterThan(0);
    });
    await fx.people.open(ids[0]);
    test.info().annotations.push({ type: 'persons / activities (proposed, unconfirmed)', description: `${ids.length} person(s); first has ${await fx.people.activityCount()} activity` });
  });

  test('3: the same link opened a second time', async ({ fx }) => {
    test.setTimeout(LINK_ROW);
    const p = prospect('Trigger behavior > 3');
    await configure(fx, TRIGGER, [PD.createPerson]);
    await sendAndClear(fx, p);
    await openLink(fx, p);
    let before: string[] = [];
    await untilInPipedrive(fx, TRIGGER, `No person for ${p.email} after the first open`, async () => {
      before = await fx.people.idsByEmail(p.email);
      expect(before.length).toBeGreaterThan(0);
    });
    await fx.people.open(before[0]);
    const activitiesBefore = await fx.people.activityCount();
    await openLink(fx, p);
    await staysUnchanged(fx, async () => {
      expect(await fx.people.idsByEmail(p.email), 'no second person after the second open').toEqual(before);
    });
    await fx.people.open(before[0]);
    test.info().annotations.push({ type: 'activities before / after the second open (proposed, unconfirmed)', description: `${activitiesBefore} / ${await fx.people.activityCount()}` });
  });

  test('4: Subscribe here after an unsubscribe by link', async ({ fx }) => {
    test.setTimeout(LINK_ROW);
    const p = prospect('Trigger behavior > 4');
    await configure(fx, TRIGGER, [PD.createPerson]);
    await sendAndClear(fx, p);
    const rowBefore = await fx.saleshandySequence.prospectRowText(SEQUENCE_ID, p.email);
    const page = await openLink(fx, p);
    await fx.saleshandySequence.expectProspectStatusAfterRefresh(SEQUENCE_ID, p.email, 'Unsubscribed');
    let ids: string[] = [];
    await untilInPipedrive(fx, TRIGGER, `No person for ${p.email} after the unsubscribe`, async () => {
      ids = await fx.people.idsByEmail(p.email);
      expect(ids.length).toBeGreaterThan(0);
    });
    await fx.people.open(ids[0]);
    const activitiesBefore = await fx.people.activityCount();
    await page.getByRole('link', { name: 'Subscribe here' }).click();
    await expect(page.getByText(SUBSCRIBED_TEXT)).toBeVisible({ timeout: 30_000 });
    const rowAfter = await fx.saleshandySequence.prospectRowText(SEQUENCE_ID, p.email);
    expect(rowAfter, 'the Prospects tab no longer says Unsubscribed').not.toContain('Unsubscribed');
    test.info().annotations.push({ type: 'prospect row before / after', description: `${rowBefore} / ${rowAfter}` });
    await staysUnchanged(fx, async () => {});
    await fx.people.open(ids[0]);
    test.info().annotations.push({ type: 'activities before / after Subscribe here (proposed, unconfirmed)', description: `${activitiesBefore} / ${await fx.people.activityCount()}` });
  });

  test('5: Unsubscribe (UI) then Mark as Resume', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Trigger behavior > 5');
    await configure(fx, TRIGGER, [PD.createPerson]);
    await unsubscribeUi(fx, p);
    await fx.saleshandySequence.markAsResumed(SEQUENCE_ID, p.email);
    await fx.saleshandySequence.expectProspectStatusAfterRefresh(SEQUENCE_ID, p.email, 'Unsubscribed');
  });
});

// ---- Create a Person ----

test.describe('Create a Person', () => {
  test('1: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Create a Person > 1');
    await configure(fx, TRIGGER, [PD.createPerson]);
    await unsubscribeUi(fx, p);
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
    test.setTimeout(UI_ROW);
    const p = prospect('Create a Person > 2');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.createPerson]);
    await unsubscribeUi(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Person not updated, or activity not added', async () => {
      await fx.people.open(id);
      expect(await fx.people.name()).toBe(p.name);
      expect(await fx.people.activityCount()).toBe(1);
    });
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });
});

// ---- Create a Lead ----

test.describe('Create a Lead', () => {
  test('1: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Create a Lead > 1');
    await configure(fx, TRIGGER, [PD.createLead]);
    await unsubscribeUi(fx, p);
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Lead "${p.email}" not on the person`, async () => {
      await fx.people.open(id);
      expect(await fx.people.leadTitles()).toEqual([p.email]);
    });
    expect(await fx.people.activityCount(), 'no activity from a lead').toBe(0);
  });

  test('2: person exists', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Create a Lead > 2');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.createLead]);
    await unsubscribeUi(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Lead "${p.email}" not on the person`, async () => {
      await fx.people.open(id);
      expect(await fx.people.leadTitles()).toEqual([p.email]);
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
    expect([...titles].sort(), 'existing deals unchanged, one new deal').toEqual([...legacy, p.email].sort());
    const ids = await fx.people.dealIds();
    const created = await fx.deals.read(ids[ids.length - 1]);
    expect(created).toMatchObject({ title: p.email, pipeline: PIPEDRIVE_PIPELINE, stage: 'Qualified' });
    test.info().annotations.push({ type: 'new deal', description: JSON.stringify(created) });
  }

  test('1: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Create a Deal > 1');
    await configure(fx, TRIGGER, picks);
    await unsubscribeUi(fx, p);
    const id = await expectOnePerson(fx, p);
    await expectNewDeal(fx, p, id, []);
    await fx.people.open(id);
    expect(await fx.people.activityCount(), 'no activity from a deal').toBe(0);
    expect(await fx.people.organization(), 'no organization link').toBeUndefined();
  });

  test('2: person has 1 deal', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Create a Deal > 2');
    const id = await personFirst(fx, p);
    const legacy = await legacyDeals(fx, id, 1);
    await configure(fx, TRIGGER, picks);
    await unsubscribeUi(fx, p);
    await expectNewDeal(fx, p, id, legacy);
  });

  test('3: person exists, no deal, Unsubscribe (link)', async ({ fx }) => {
    test.setTimeout(LINK_ROW);
    const p = prospect('Create a Deal > 3');
    await configure(fx, TRIGGER, picks);
    await sendAndClear(fx, p);
    const id = await personFirst(fx, p);
    await openLink(fx, p);
    await expectNewDeal(fx, p, id, []);
  });
});

// ---- Update a Person ----

test.describe('Update a Person', () => {
  test('1: person exists with an old value in a mapped field', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Update a Person > 1');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.updatePerson]);
    await unsubscribeUi(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Person not updated, or activity not added', async () => {
      await fx.people.open(id);
      expect(await fx.people.name()).toBe(p.name);
      expect(await fx.people.activityCount()).toBe(1);
    });
  });

  test('2: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Update a Person > 2');
    await configure(fx, TRIGGER, [PD.updatePerson]);
    await unsubscribeUi(fx, p);
    await expectNoPerson(fx, p);
    // Known B1: the run ends in Error. Recorded, not failed.
    await recordLog(fx, TRIGGER);
  });

  test('3: person exists with an old value, Unsubscribe (link)', async ({ fx }) => {
    test.setTimeout(LINK_ROW);
    const p = prospect('Update a Person > 3');
    await configure(fx, TRIGGER, [PD.updatePerson]);
    await sendAndClear(fx, p);
    const id = await personFirst(fx, p);
    await openLink(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Person not updated', async () => {
      await fx.people.open(id);
      expect(await fx.people.name()).toBe(p.name);
    });
  });
});

// ---- Update a Deal ----

test.describe('Update a Deal', () => {
  const picks = [{ activity: PD.updateDeal, extra: CONTACT_MADE }];

  test('1: person has 2 deals', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Update a Deal > 1');
    const id = await personFirst(fx, p);
    await legacyDeals(fx, id, 2);
    await fx.people.open(id);
    const [older, newest] = await fx.people.dealIds();
    await configure(fx, TRIGGER, picks);
    await unsubscribeUi(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not updated', async () => {
      expect(await fx.deals.read(newest)).toMatchObject({ title: p.email, pipeline: PIPEDRIVE_PIPELINE, stage: 'Contact Made' });
    });
    expect(await fx.deals.read(older), 'older deal unchanged').toMatchObject({ title: 'Legacy deal 1', stage: 'Qualified' });
  });

  test('2: person exists with no deal', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Update a Deal > 2');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, picks);
    await unsubscribeUi(fx, p);
    await staysUnchanged(fx, async () => {
      await fx.people.open(id);
      expect(await fx.people.dealTitles(), 'nothing created').toEqual([]);
    });
    await recordLog(fx, TRIGGER);
  });

  test('3: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Update a Deal > 3');
    await configure(fx, TRIGGER, picks);
    await unsubscribeUi(fx, p);
    await expectNoPerson(fx, p);
    // Known B2: the run ends in Error. Recorded, not failed.
    await recordLog(fx, TRIGGER);
  });
});

// ---- Delete Deal ----

test.describe('Delete Deal', () => {
  test('1: person has 2 deals', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Delete Deal > 1');
    const id = await personFirst(fx, p);
    await legacyDeals(fx, id, 2);
    await fx.people.open(id);
    const [older] = await fx.people.dealIds();
    await configure(fx, TRIGGER, [PD.deleteDeal]);
    await unsubscribeUi(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not deleted', async () => {
      await fx.people.open(id);
      expect(await fx.people.dealIds()).toEqual([older]);
    });
  });

  test('2: person exists with no deal', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Delete Deal > 2');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.deleteDeal]);
    await unsubscribeUi(fx, p);
    await staysUnchanged(fx, async () => {
      expect(await fx.people.idsByEmail(p.email), 'person kept').toEqual([id]);
    });
    await recordLog(fx, TRIGGER);
  });
});

// ---- Delete Person ----

test.describe('Delete Person', () => {
  test('1: person exists', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Delete Person > 1');
    await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.deletePerson]);
    await unsubscribeUi(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Person ${p.email} not deleted`, async () => {
      expect(await fx.people.idsByEmail(p.email)).toHaveLength(0);
    });
  });

  test('2: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Delete Person > 2');
    await configure(fx, TRIGGER, [PD.deletePerson]);
    await unsubscribeUi(fx, p);
    await expectNoPerson(fx, p);
  });
});

// ---- Create Organization ----

test.describe('Create Organization', () => {
  test('1: prospect has a company, no organization with that name', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Create Organization > 1');
    await useFreeCompany(fx, p);
    expect(await fx.orgs.countByName(p.row['Company']), 'the company name is free').toBe(0);
    await configure(fx, TRIGGER, [PD.createOrganization]);
    await unsubscribeUi(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not created`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(1);
    });
    expect(await fx.people.idsByEmail(p.email), 'not linked to any person').toHaveLength(0);
  });

  test('2: an organization with that name already exists', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Create Organization > 2');
    await orgFirst(fx, p.row['Company']);
    // Rows no longer delete what they create, so earlier runs can have left organizations with this
    // company name (8 "Shopify" on 2026-10-29). Count before the event and expect one more.
    const before = await fx.orgs.countByName(p.row['Company']);
    expect(before, 'the organization made for the row is on the list').toBeGreaterThanOrEqual(1);
    await configure(fx, TRIGGER, [PD.createOrganization]);
    await unsubscribeUi(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Second organization "${p.row['Company']}" not created`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before + 1);
    });
  });
});

// ---- Update Organization ----

test.describe('Update Organization', () => {
  test('1: an organization with the exact company name exists', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Update Organization > 1');
    await orgFirst(fx, p.row['Company']);
    await configure(fx, TRIGGER, [PD.updateOrganization]);
    await unsubscribeUi(fx, p);
    // The mapped fields are not read by the organization page yet: the visible result is that no second
    // organization appears and the Logs entry is Success.
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(1);
    });
    await recordLog(fx, TRIGGER);
  });

  test('2: no organization with that exact name', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Update Organization > 2');
    await configure(fx, TRIGGER, [PD.updateOrganization]);
    await unsubscribeUi(fx, p);
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company']), 'nothing created').toBe(0);
    });
  });
});

// ---- Delete Organization ----

test.describe('Delete Organization', () => {
  test('1: an organization with the exact company name exists', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Delete Organization > 1');
    await orgFirst(fx, p.row['Company']);
    await configure(fx, TRIGGER, [PD.deleteOrganization]);
    await unsubscribeUi(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not deleted`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(0);
    });
  });
});

// ---- Combined actions ----

test.describe('Combined actions', () => {
  test('1: Create a Lead, Create a Deal and Create a Person, prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Combined actions > 1');
    await configure(fx, TRIGGER, [PD.createLead, { activity: PD.createDeal, extra: QUALIFIED }, PD.createPerson]);
    await unsubscribeUi(fx, p);
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
    test.setTimeout(UI_ROW);
    const p = prospect('Combined actions > 2');
    const id = await personFirst(fx, p);
    await configure(fx, TRIGGER, [PD.createPerson, PD.updatePerson]);
    await unsubscribeUi(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Two activities not on the person', async () => {
      await fx.people.open(id);
      expect(await fx.people.activityCount()).toBe(2);
    });
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });
});
