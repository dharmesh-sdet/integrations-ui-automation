// Production smoke test: Prospect Outcome is updated in Saleshandy, Pipedrive.
// Checklist: notes/production-testing/10-pipedrive-prospect-outcome-updated.md (approved by QA
// 2026-10-27, 9 rows, no Jira ticket). Each test body follows the staging test of the same activity
// in tests/pipedrive/prospect-outcome-updated.spec.ts (30 of 30, 2026-10-27), so a row passes or
// fails on the same assertions. Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts); the Pipedrive
//    company is the same one (saleshandy.pipedrive.com);
//  - the sequence comes from SMOKE_SEQUENCE_ID, nothing production is hard-coded;
//  - the Pipedrive session is auth/pipedrive-emailopenedprod-chromium.json;
//  - Create a Lead, Create a Deal and Create a Person are one row;
//  - a row adds its prospect and sends step 1 itself (sendEmail of the Email Sent flow), so there is
//    no Setup test and no setup-state file;
//  - after a trigger is saved the page is reloaded and the saved activities are read back, and the
//    row stops before any send when "Email Sent from Saleshandy" is on.
// Rows do not delete what they create (QA, 2026-10-26).
//
// Run through scripts/run-pipedrive-outcome-updated-smoke.sh (npm run smoke:pipedrive-outcome-updated),
// which runs the gate (tests/setup/pipedrive-email-sent-prod-gate.spec.ts) first. Needs, once:
//   npm run login:saleshandy -- emailopenedprod    (headed, Cloudflare blocks headless)
//   npm run login:pipedrive -- emailopenedprod
// Data: test-data/pipedrive/prospect-outcome-updated-smoke.csv (scripts/make-pipedrive-outcome-updated-smoke-data.ts).
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { fullName, recordLog, sendEmail, staysUnchanged, untilInPipedrive } from '../../src/flows/saleshandy-to-pipedrive.ts';
import { PD, PIPEDRIVE_PIPELINE, type OutcomeItem } from '../../src/pages/saleshandy/pipedrive-integration.page.ts';
import type { PipedriveIntegrationPage } from '../../src/pages/saleshandy/pipedrive-integration.page.ts';
import type { SaleshandySequencePage } from '../../src/pages/saleshandy/sequence.page.ts';
import type { PipedriveDealsPage } from '../../src/pages/pipedrive/deals.page.ts';
import type { PipedriveOrganizationsPage } from '../../src/pages/pipedrive/organizations.page.ts';
import type { PipedrivePeoplePage } from '../../src/pages/pipedrive/people.page.ts';

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

const TRIGGER = 'Prospect Outcome is updated in Saleshandy';
const EMAIL_SENT_TRIGGER = 'Email Sent from Saleshandy';
const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '';
const CSV = 'pipedrive/prospect-outcome-updated-smoke.csv';
const LEGACY_PHONE = '+1 555-0100-0000';

// One row = a trigger save, records made by hand, a Send now, an outcome change and slow production
// pages. The non-matching row waits 3 minutes on top.
const ROW_TIMEOUT = 12 * 60_000;
const NON_MATCHING_WAIT = 3 * 60_000;

// Industry of the rows that create an organization: one of the 20 Pipedrive picklist options. Both
// columns are set because the Organisation Fields card maps Industry and Company Industry to the same
// Pipedrive field (staging, 2026-10-26).
const PICKLIST_INDUSTRY = { Industry: 'Retail', 'Company Industry': 'Retail' };

type Prospect = { row: Row; email: string; name: string };

// The Scenario column holds the name of the staging row the smoke row is built from.
function prospect(scenario: string, override: Record<string, string> = {}): Prospect {
  const found = readCsv(CSV).find((r) => r['Scenario'] === scenario);
  if (!found) throw new Error(`No row "${scenario}" in test-data/${CSV}. Run scripts/make-pipedrive-outcome-updated-smoke-data.ts.`);
  const row = { ...found, ...override };
  return { row, email: row['Email'], name: fullName(row) };
}

const note = (type: string, description: string) => test.info().annotations.push({ type, description });
const digits = (s: string) => s.replace(/\D/g, '');

// Saves the outcome trigger with the row's activities, reloads the page and reads the saved
// activities back (QA proposal, 2026-10-27: the settings page can show old data until a hard
// refresh). Stops before any send when Email Sent is on: a send would create the person first.
async function useTrigger(fx: Fx, items: OutcomeItem[]): Promise<void> {
  await test.step(`Set "${TRIGGER}" to: ${items.map((i) => `${i.activity} [${i.category}${i.stage ? `, ${i.stage}` : ''}]`).join(' + ')}`, async () => {
    await fx.pipedriveIntegration.configureOutcome(items);
  });
  await test.step('Reload and read the saved activities back', async () => {
    await fx.pipedriveIntegration.openTriggers();
    expect(await fx.pipedriveIntegration.isTriggerOn(TRIGGER), `"${TRIGGER}" is on after the reload`).toBe(true);
    const chips = await fx.pipedriveIntegration.selectedActivities(TRIGGER);
    expect(chips, 'activities saved under the trigger').toHaveLength(items.length);
    for (const item of items) {
      const short = item.activity.replace(/ in Pipedrive$/, '');
      expect(chips.some((c) => c.includes(short)), `${item.activity} saved (found: ${chips.join(', ')})`).toBe(true);
    }
    expect(
      await fx.pipedriveIntegration.isTriggerOn(EMAIL_SENT_TRIGGER),
      `"${EMAIL_SENT_TRIGGER}" is on, a send would create the person first. Turn it off and run again. No send was made.`,
    ).toBe(false);
  });
}

// Adds the prospect, sends step 1 (Send now) and changes the outcome once the Emails tab row shows Sent.
async function changeOutcome(fx: Fx, p: Prospect, outcome: string): Promise<void> {
  if (!SEQUENCE_ID) throw new Error('SMOKE_SEQUENCE_ID is not set. Use scripts/run-pipedrive-outcome-updated-smoke.sh.');
  await sendEmail(fx, { sequenceId: SEQUENCE_ID, row: p.row, csv: CSV, step: 1 });
  await test.step(`Change the outcome to ${outcome}`, () => fx.saleshandySequence.setProspectOutcome(SEQUENCE_ID, p.email, outcome));
}

// Records made by hand before the outcome changes, with legacy values so a change is visible. markUsed
// retires the CSV row at once: the record now exists, so a failed run must not reuse the person.
async function personFirst(fx: Fx, p: Prospect, phone?: string): Promise<string> {
  return test.step(`Create the person ${p.email} in Pipedrive`, async () => {
    markUsed(CSV, p.email);
    return fx.people.create({ name: p.name, email: p.email, phone });
  });
}

async function legacyDeals(fx: Fx, personId: string, count: number): Promise<void> {
  await test.step(`Create ${count} legacy deal(s) on the person`, async () => {
    for (let i = 1; i <= count; i++) await fx.deals.createOnPerson(personId, { title: `Legacy deal ${i}`, value: 100 * i });
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

test.describe('Prospect Outcome is updated in Saleshandy, Pipedrive (production smoke)', () => {
  test.describe.configure({ timeout: ROW_TIMEOUT });

  // 1. Create a Lead, Create a Deal and Create a Person (staging: Trigger behavior > 6)
  test('Create a Lead, Create a Deal and Create a Person: prospect not in Pipedrive, outcome Interested', async ({ fx }) => {
    const p = prospect('Trigger behavior > 6');
    await useTrigger(fx, [
      { activity: PD.createLead, category: 'Interested' },
      { activity: PD.createDeal, category: 'Interested', stage: 'Qualified' },
      { activity: PD.createPerson, category: 'Interested' },
    ]);
    await changeOutcome(fx, p, 'Interested');
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Lead, deal and activity not all on the person', async () => {
      await fx.people.open(id);
      expect(await fx.people.leadTitles()).toEqual([p.email]);
      expect(await fx.people.dealTitles()).toEqual([p.email]);
      expect(await fx.people.activityCount()).toBe(1);
    });
    expect(await fx.people.idsByEmail(p.email), 'exactly one person').toEqual([id]);
  });

  // 2. Update a Deal (staging: Update a Deal > 1)
  test('Update a Deal: person has 2 deals, outcome Not Now', async ({ fx }) => {
    const p = prospect('Update a Deal > 1');
    const id = await personFirst(fx, p);
    await legacyDeals(fx, id, 2);
    await fx.people.open(id);
    const [older, newest] = await fx.people.dealIds();
    await useTrigger(fx, [{ activity: PD.updateDeal, category: 'Not Now', stage: 'Contact Made' }]);
    await changeOutcome(fx, p, 'Not Now');
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not updated', async () => {
      expect(await fx.deals.read(newest)).toMatchObject({ title: p.email, pipeline: PIPEDRIVE_PIPELINE, stage: 'Contact Made' });
    });
    expect(digits((await fx.deals.read(newest)).value), 'mapped Value').toBe(digits(p.row['Deal Value']));
    expect(await fx.deals.read(older), 'older deal unchanged').toMatchObject({ title: 'Legacy deal 1', stage: 'Qualified' });
  });

  // 3. Update a Person (staging: Update a Person > 1)
  test('Update a Person: person exists with an old value, outcome Out of Office', async ({ fx }) => {
    const p = prospect('Update a Person > 1');
    const id = await personFirst(fx, p, LEGACY_PHONE);
    await useTrigger(fx, [{ activity: PD.updatePerson, category: 'Out of Office' }]);
    await changeOutcome(fx, p, 'Out of Office');
    await untilInPipedrive(fx, TRIGGER, 'Activity not added to the person', async () => {
      await fx.people.open(id);
      expect(await fx.people.activityCount()).toBe(1);
    });
    const [activity] = await fx.people.activities();
    expect(activity, 'the activity is done').toMatchObject({ done: true });
    note('activity (subject, type)', `${activity.subject} / ${activity.type}`);
    note('person details after the update', JSON.stringify({ ...(await fx.people.details()), Phone: await fx.people.phones() }));
    await untilInPipedrive(fx, TRIGGER, 'Mapped Phone not updated on the person', async () => {
      await fx.people.open(id);
      expect(digits((await fx.people.phones()).join(' ')), 'mapped Phone updated').toContain(digits(p.row['Phone Number']));
    });
  });

  // 4. Delete Deal (staging: Delete Deal > 1)
  test('Delete Deal: person has 2 deals, outcome Do Not Contact', async ({ fx }) => {
    const p = prospect('Delete Deal > 1');
    const id = await personFirst(fx, p);
    await legacyDeals(fx, id, 2);
    await fx.people.open(id);
    const [older] = await fx.people.dealIds();
    await useTrigger(fx, [{ activity: PD.deleteDeal, category: 'Do Not Contact' }]);
    await changeOutcome(fx, p, 'Do Not Contact');
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not deleted', async () => {
      await fx.people.open(id);
      expect(await fx.people.dealIds()).toEqual([older]);
    });
  });

  // 5. Delete Person (staging: Delete Person > 1)
  test('Delete Person: person exists, outcome Not Interested', async ({ fx }) => {
    const p = prospect('Delete Person > 1');
    await personFirst(fx, p);
    await useTrigger(fx, [{ activity: PD.deletePerson, category: 'Not Interested' }]);
    await changeOutcome(fx, p, 'Not Interested');
    await untilInPipedrive(fx, TRIGGER, 'Person not deleted', async () => {
      expect(await fx.people.idsByEmail(p.email)).toHaveLength(0);
    });
  });

  // 6. Create Organization (staging: Create Organization > 1)
  test('Create Organization: prospect has a company with Industry Retail, no organization with that name, outcome Interested', async ({ fx }) => {
    const p = prospect('Create Organization > 1', PICKLIST_INDUSTRY);
    const before = await fx.orgs.countByName(p.row['Company']);
    await useTrigger(fx, [{ activity: PD.createOrganization, category: 'Interested' }]);
    await changeOutcome(fx, p, 'Interested');
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not created`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before + 1);
    });
    expect(await fx.people.idsByEmail(p.email), 'not linked to any person').toHaveLength(0);
  });

  // 7. Update Organization (staging: Update Organization > 1)
  test('Update Organization: organization with the exact company name exists, outcome Not Interested', async ({ fx }) => {
    const p = prospect('Update Organization > 1', PICKLIST_INDUSTRY);
    const before = await fx.orgs.countByName(p.row['Company']);
    await orgFirst(fx, p, p.row['Company']);
    await useTrigger(fx, [{ activity: PD.updateOrganization, category: 'Not Interested' }]);
    await changeOutcome(fx, p, 'Not Interested');
    // The mapped fields of an organization are not read by the page object (same limit on staging), so
    // the visible result is that no second organization appears; the Logs entry is recorded for QA.
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before + 1);
    });
    await recordLog(fx, TRIGGER);
  });

  // 8. Delete Organization (staging: Delete Organization > 1)
  test('Delete Organization: organization with the exact company name exists, outcome Closed', async ({ fx }) => {
    const p = prospect('Delete Organization > 1', PICKLIST_INDUSTRY);
    const before = await fx.orgs.countByName(p.row['Company']);
    await orgFirst(fx, p, p.row['Company']);
    await useTrigger(fx, [{ activity: PD.deleteOrganization, category: 'Closed' }]);
    await changeOutcome(fx, p, 'Closed');
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not deleted`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(before);
    });
  });

  // 9. Create a Person, outcome not matching (staging: Create a Person > 3)
  test('Create a Person: prospect not in Pipedrive, category Interested, outcome Not Interested', async ({ fx }) => {
    const p = prospect('Create a Person > 3');
    await useTrigger(fx, [{ activity: PD.createPerson, category: 'Interested' }]);
    await changeOutcome(fx, p, 'Not Interested');
    await fx.saleshandySequence.page.waitForTimeout(NON_MATCHING_WAIT);
    await expectNoPerson(fx, p);
    await recordLog(fx, TRIGGER);
  });
});
