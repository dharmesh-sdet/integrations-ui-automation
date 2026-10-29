// Production smoke test: Prospect is Unsubscribed in Saleshandy, Pipedrive.
// Checklist: notes/production-testing/14-pipedrive-unsubscribed.md (approved by QA 2026-10-29, 10 rows;
// fixed tickets AL-4177, AL-4178, AL-4179, AL-4180, AL-4185; AL-4176 is the workflow ticket). Each test body
// follows the staging test of the same activity in tests/pipedrive/prospect-unsubscribed.spec.ts (the 12
// bug-retest rows passed 2026-10-29), so a row passes or fails on the same assertions. Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts); the Pipedrive
//    company is the same one (saleshandy.pipedrive.com);
//  - the sequence comes from SMOKE_SEQUENCE_ID and the email subject is read from the Mailinator inbox,
//    so any sequence with "Unsubscribe as Link" saved works;
//  - every row adds its prospect and sends step 1 (Send now), the UI rows too (checklist: 10 sends);
//  - checks 1 and 2 use the real "Unsubscribe here" link, the others Mark as Unsubscribe on the Prospects tab.
//    The HubSpot smoke found that the UI action did not fire on production (QA, 2026-10-19). If it does not
//    fire here, the UI rows fail on the Pipedrive look and QA decides;
//  - Create a Lead, Create a Deal and Create a Person are one row;
//  - realistic old values and deal titles, no "Legacy" names (QA, 2026-10-28);
//  - after a trigger is saved the page is reloaded and the saved activities are read back, and the row
//    stops before any send when "Email Sent from Saleshandy" or "Email is Opened in Saleshandy" is on.
// Rows do not delete what they create (QA, 2026-10-26).
//
// Run through scripts/run-pipedrive-unsubscribed-smoke.sh (npm run smoke:pipedrive-unsubscribed), which
// runs the gate (tests/setup/pipedrive-email-sent-prod-gate.spec.ts) first. Needs, once:
//   npm run login:saleshandy -- emailopenedprod    (headed, Cloudflare blocks headless)
//   npm run login:pipedrive -- emailopenedprod
// Data: test-data/pipedrive/unsubscribed-smoke.csv (scripts/make-pipedrive-unsubscribed-smoke-data.ts).
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

const TRIGGER = 'Prospect is Unsubscribed in Saleshandy';
// An open of the step 1 email in Mailinator counts as an open, so both siblings must be off.
const SIBLING_TRIGGERS = ['Email Sent from Saleshandy', 'Email is Opened in Saleshandy'];
const SUBJECT = TRIGGER;
const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '';
const CSV = 'pipedrive/unsubscribed-smoke.csv';
const UNSUBSCRIBED_TEXT = 'You will no longer receive emails from us';

const QUALIFIED = { pipeline: PIPEDRIVE_PIPELINE, stage: 'Qualified' };
const CONTACT_MADE = { pipeline: PIPEDRIVE_PIPELINE, stage: 'Contact Made' };

// Production registers a link unsubscribe only after the email has been open for a while (HubSpot smoke,
// 2026-10-19): the link is used 93 s after the email is open.
const LINK_WAIT = 93_000;
// A UI row is one trigger save, one send, one Mark as Unsubscribe and a Pipedrive look. A link row adds the
// 93 s wait and the Mailinator steps.
const UI_ROW = 8 * 60_000;
const LINK_ROW = 14 * 60_000;

// Realistic deal names for the deals a row creates first (QA, 2026-10-28: no "Legacy" names).
const OLDER_DEAL = 'Annual renewal';
const NEWER_DEAL = 'Onboarding package';

// Organization Industry is a picklist in Pipedrive: one of the 20 options (organization-industry-list.md).
// Both columns are set because the Organisation Fields card maps both to the same Pipedrive field.
const PICKLIST_INDUSTRY = { Industry: 'Retail', 'Company Industry': 'Retail' };

// `subject` is read from the prospect's Mailinator inbox after the send, so any sequence works.
type Prospect = { row: Row; email: string; name: string; subject: string };

// The Scenario column holds the name of the staging row the smoke row is built from.
function prospect(scenario: string, override: Record<string, string> = {}): Prospect {
  const found = readCsv(CSV).find((r) => r['Scenario'] === scenario);
  if (!found) throw new Error(`No row "${scenario}" in test-data/${CSV}. Run scripts/make-pipedrive-unsubscribed-smoke-data.ts.`);
  const row = { ...found, ...override };
  return { row, email: row['Email'], name: fullName(row), subject: '' };
}

// Saves the trigger with the row's activities, reloads the page and reads the saved activities back.
// Stops before any send when Email Sent or Email Opened is on: a send would create the person first.
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

// Adds the prospect and sends step 1 (Send now), then reads the subject from the Mailinator inbox.
async function send(fx: Fx, p: Prospect): Promise<void> {
  if (!SEQUENCE_ID) throw new Error('SMOKE_SEQUENCE_ID is not set. Use scripts/run-pipedrive-unsubscribed-smoke.sh.');
  await sendEmail(fx, { sequenceId: SEQUENCE_ID, row: p.row, csv: CSV, step: 1 });
  p.subject = await test.step(`Read the subject of the step 1 email in the Mailinator inbox of ${p.email}`, () => fx.mailinator.latestSubject(p.email));
}

// Unsubscribe (link): the real "Unsubscribe here" link of the delivered email, used once the email has been
// open for LINK_WAIT. The Prospects tab must then read Unsubscribed.
async function unsubscribeByLink(fx: Fx, p: Prospect): Promise<void> {
  await test.step('Open the "Unsubscribe here" link from the Mailinator inbox', async () => {
    const page = await fx.mailinator.openUnsubscribeLink(p.email, p.subject, LINK_WAIT);
    await expect(page.getByText(UNSUBSCRIBED_TEXT)).toBeVisible({ timeout: 30_000 });
  });
  await fx.saleshandySequence.expectProspectStatusAfterRefresh(SEQUENCE_ID, p.email, 'Unsubscribed');
}

// Unsubscribe (UI): Mark as Unsubscribe on the Prospects tab (it also reads Unsubscribed afterwards).
async function unsubscribeByUi(fx: Fx, p: Prospect): Promise<void> {
  await test.step('Mark as Unsubscribe on the Prospects tab', async () => {
    await fx.saleshandySequence.markAsUnsubscribed(SEQUENCE_ID, p.email);
  });
  await fx.saleshandySequence.expectProspectStatusAfterRefresh(SEQUENCE_ID, p.email, 'Unsubscribed');
}

// Records made by hand before the unsubscribe, so a change is visible. markUsed retires the CSV row at once:
// the record now exists, so a failed run must not reuse the person.
async function personFirst(fx: Fx, p: Prospect, name = p.name): Promise<string> {
  return test.step(`Create the person ${p.email} in Pipedrive`, async () => {
    markUsed(CSV, p.email);
    return fx.people.create({ name, email: p.email });
  });
}

async function dealsOnPerson(fx: Fx, personId: string, titles: string[]): Promise<void> {
  await test.step(`Create ${titles.length} deal(s) on the person`, async () => {
    for (const [i, title] of titles.entries()) await fx.deals.createOnPerson(personId, { title, value: 1800 + 600 * i });
  });
}

// Ids of the person's deals, oldest first. The Deals block can show after the page loads (production,
// 2026-10-29: only one tile was read, so the newest id was empty and the script opened /deal/undefined).
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

// Lead and deal titled with the prospect email on the person, then a last look at the person count: a double
// run (AL-4177) shows up as a second person or a second lead after the first look passed.
async function expectLeadAndDeal(fx: Fx, p: Prospect, id: string, olderDeals: string[]): Promise<void> {
  let deals: string[] = [];
  await untilInPipedrive(fx, TRIGGER, 'Lead and deal not both on the person', async () => {
    await fx.people.open(id);
    expect(await fx.people.leadTitles()).toEqual([p.email]);
    deals = await fx.people.dealTitles();
    expect([...deals].sort(), 'existing deals unchanged, one new deal').toEqual([...olderDeals, p.email].sort());
  });
  const ids = await fx.people.dealIds();
  expect(await fx.deals.read(ids[ids.length - 1])).toMatchObject({ title: p.email, pipeline: PIPEDRIVE_PIPELINE, stage: 'Qualified' });
  expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
}

test.describe('Prospect is Unsubscribed in Saleshandy, Pipedrive (production smoke)', () => {
  // 1. Create a Lead, Create a Deal and Create a Person, prospect not in Pipedrive, link (staging: Combined actions > 1)
  test('Create a Lead, Create a Deal and Create a Person: prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(LINK_ROW);
    const p = prospect('Combined actions > 1');
    await useTrigger(fx, [PD.createLead, { activity: PD.createDeal, extra: QUALIFIED }, PD.createPerson]);
    await send(fx, p);
    await unsubscribeByLink(fx, p);
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Lead, deal and activity not all on the person', async () => {
      await fx.people.open(id);
      expect(await fx.people.leadTitles()).toEqual([p.email]);
      expect(await fx.people.dealTitles()).toEqual([p.email]);
      expect(await fx.people.activityCount()).toBe(1);
    });
    expect(await fx.people.idsByEmail(p.email), 'exactly one person').toEqual([id]);
  });

  // 2. Same three activities, person exists with no deal, link (staging: Create a Deal > 3)
  test('Create a Lead, Create a Deal and Create a Person: person exists with no deal', async ({ fx }) => {
    test.setTimeout(LINK_ROW);
    const p = prospect('Create a Deal > 3');
    const id = await personFirst(fx, p);
    await useTrigger(fx, [PD.createLead, { activity: PD.createDeal, extra: QUALIFIED }, PD.createPerson]);
    await send(fx, p);
    await unsubscribeByLink(fx, p);
    await expectLeadAndDeal(fx, p, id, []);
    await fx.people.open(id);
    test.info().annotations.push({ type: 'activities on the person', description: String(await fx.people.activityCount()) });
  });

  // 3. Same three activities, person has 1 deal, UI (staging: Create a Deal > 2)
  test('Create a Lead, Create a Deal and Create a Person: person has 1 deal', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Create a Deal > 2');
    const id = await personFirst(fx, p);
    await dealsOnPerson(fx, id, [OLDER_DEAL]);
    const [older] = await dealIdsOf(fx, id, 1);
    await useTrigger(fx, [PD.createLead, { activity: PD.createDeal, extra: QUALIFIED }, PD.createPerson]);
    await send(fx, p);
    await unsubscribeByUi(fx, p);
    await expectLeadAndDeal(fx, p, id, [OLDER_DEAL]);
    expect(await fx.deals.read(older), 'existing deal unchanged').toMatchObject({ title: OLDER_DEAL });
  });

  // 4. Update a Person (staging: Update a Person > 1). The person is known by first name only, so the update to
  // the full name shows.
  test('Update a Person: person exists with an old value in a mapped field', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Update a Person > 1');
    const id = await personFirst(fx, p, p.row['First Name']);
    await useTrigger(fx, [PD.updatePerson]);
    await send(fx, p);
    await unsubscribeByUi(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Person not updated, or activity not added', async () => {
      await fx.people.open(id);
      expect(await fx.people.name()).toBe(p.name);
      expect(await fx.people.activityCount()).toBe(1);
    });
    const [activity] = await fx.people.activities();
    expect(activity).toMatchObject({ subject: SUBJECT, type: 'Email', done: true });
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });

  // 5. Update a Deal (staging: Update a Deal > 1)
  test('Update a Deal: person has 2 deals', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Update a Deal > 1');
    const id = await personFirst(fx, p);
    await dealsOnPerson(fx, id, [OLDER_DEAL, NEWER_DEAL]);
    const [older, newest] = await dealIdsOf(fx, id, 2);
    await useTrigger(fx, [{ activity: PD.updateDeal, extra: CONTACT_MADE }]);
    await send(fx, p);
    await unsubscribeByUi(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not updated', async () => {
      expect(await fx.deals.read(newest)).toMatchObject({ title: p.email, pipeline: PIPEDRIVE_PIPELINE, stage: 'Contact Made' });
    });
    expect(await fx.deals.read(older), 'older deal unchanged').toMatchObject({ title: OLDER_DEAL, stage: 'Qualified' });
    // AL-4185: the v2 run shows "Find person's latest deal" in the run detail. The Logs list shows only the
    // row text, so the row is recorded for QA and the node names are not asserted.
    await recordLog(fx, TRIGGER);
  });

  // 6. Delete Deal (staging: Delete Deal > 1)
  test('Delete Deal: person has 2 deals', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Delete Deal > 1');
    const id = await personFirst(fx, p);
    await dealsOnPerson(fx, id, [OLDER_DEAL, NEWER_DEAL]);
    const [older] = await dealIdsOf(fx, id, 2);
    await useTrigger(fx, [PD.deleteDeal]);
    await send(fx, p);
    await unsubscribeByUi(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not deleted', async () => {
      await fx.people.open(id);
      expect(await fx.people.dealIds()).toEqual([older]);
    });
    await recordLog(fx, TRIGGER);
  });

  // 7. Delete Person (staging: Delete Person > 1)
  test('Delete Person: person exists', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Delete Person > 1');
    await personFirst(fx, p);
    await useTrigger(fx, [PD.deletePerson]);
    await send(fx, p);
    await unsubscribeByUi(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Person ${p.email} not deleted`, async () => {
      expect(await fx.people.idsByEmail(p.email)).toHaveLength(0);
    });
  });

  // 8. Create Organization (staging: Create Organization > 1). Earlier runs leave organizations behind, so
  // the count before the event is the base and exactly one more is expected.
  test('Create Organization: prospect has a company, no organization with that name', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Create Organization > 1', PICKLIST_INDUSTRY);
    const before = await fx.orgs.countByName(p.row['Company']);
    markUsed(CSV, p.email);
    await useTrigger(fx, [PD.createOrganization]);
    await send(fx, p);
    await unsubscribeByUi(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not created`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBeGreaterThanOrEqual(before + 1);
    });
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company']), 'exactly one new organization').toBe(before + 1);
    });
    expect(await fx.people.idsByEmail(p.email), 'not linked to any person').toHaveLength(0);
    // The organizations page object has no Details reader, so the mapped Organisation Fields are not
    // read (same gap as staging). The Logs entry is recorded for QA.
    await recordLog(fx, TRIGGER);
  });

  // 9. Update Organization (staging: Update Organization > 1)
  test('Update Organization: an organization with the exact company name exists', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Update Organization > 1', PICKLIST_INDUSTRY);
    const before = await fx.orgs.countByName(p.row['Company']);
    await orgFirst(fx, p, p.row['Company']);
    await useTrigger(fx, [PD.updateOrganization]);
    await send(fx, p);
    await unsubscribeByUi(fx, p);
    // Mapped fields are not read: the visible result is no second organization and a Logs entry.
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before + 1);
    });
    await recordLog(fx, TRIGGER);
  });

  // 10. Delete Organization (staging: Delete Organization > 1)
  test('Delete Organization: an organization with the exact company name exists', async ({ fx }) => {
    test.setTimeout(UI_ROW);
    const p = prospect('Delete Organization > 1');
    const before = await fx.orgs.countByName(p.row['Company']);
    await orgFirst(fx, p, p.row['Company']);
    await useTrigger(fx, [PD.deleteOrganization]);
    await send(fx, p);
    await unsubscribeByUi(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not deleted`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before);
    });
  });
});
