// Production smoke test: Email is Bounced in Saleshandy, Pipedrive.
// Checklist: notes/production-testing/12-pipedrive-email-bounced.md (approved by QA 2026-10-28, 11 checks,
// no fixed bug ticket; AL-4183 is the workflow ticket). Each check is built from the staging row of the same
// activity (the Scenario column of the CSV holds its name), so a check passes or fails on the same assertions.
// Differences from staging:
//  - the account `emailopenedprod` points at production; the Pipedrive company is saleshandy.pipedrive.com;
//  - the sequence comes from SMOKE_SEQUENCE_ID, nothing production is hard-coded;
//  - Create a Lead, Create a Deal and Create a Person are one check;
//  - test records carry realistic names, no "Legacy" names (QA, 2026-10-28);
//  - after a trigger is saved the page is reloaded and the saved trigger is read back;
//  - the bounce reaches Pipedrive in 1 to 3 minutes, so every look waits up to 3 minutes.
// Only check 11 sends an email (a real bounce, Send now). The other checks use Mark as bounced.
// Rows do not delete what they create (QA, 2026-10-26).
//
// Run through scripts/run-pipedrive-email-bounced-smoke.sh (npm run smoke:pipedrive-email-bounced), which
// runs the gate first. Needs, once:
//   npm run login:saleshandy -- emailopenedprod    (headed, Cloudflare blocks headless)
//   npm run login:pipedrive -- emailopenedprod
// Data: test-data/pipedrive/email-bounced-smoke.csv (scripts/make-pipedrive-email-bounced-smoke-data.ts).
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { companyFields, companyNames } from '../../src/data/generate.ts';
import { configure, fullName, recordLog, staysUnchanged, untilInPipedrive } from '../../src/flows/saleshandy-to-pipedrive.ts';
import { PD, PIPEDRIVE_PIPELINE } from '../../src/pages/saleshandy/pipedrive-integration.page.ts';
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
};

const test = base.extend<{ fx: Fx }>({
  fx: async ({ pipedriveIntegration, saleshandySequence, pipedrivePeople, pipedriveDeals, pipedriveOrganizations }, use) =>
    use({ pipedriveIntegration, saleshandySequence, people: pipedrivePeople, deals: pipedriveDeals, orgs: pipedriveOrganizations }),
});

test.use({ account: 'emailopenedprod' });

const TRIGGER = 'Email is Bounced in Saleshandy';
const SEND_TRIGGER = 'Email Sent from Saleshandy';
const SUBJECT = 'Email is bounced in Saleshandy';
const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '';
const CSV = 'pipedrive/email-bounced-smoke.csv';

const CONTACT_MADE = { pipeline: PIPEDRIVE_PIPELINE, stage: 'Contact Made' };
const QUALIFIED = { pipeline: PIPEDRIVE_PIPELINE, stage: 'Qualified' };

// Production: the bounce shows in Pipedrive 1 to 3 minutes after Mark as bounced, so each look waits up to 3 minutes.
const LOOK = 3 * 60_000;
const ROW = 8 * 60_000;
// The real bounce adds the send and the wait for Saleshandy to set Bounced (up to 5 minutes).
const REAL_ROW = 14 * 60_000;

// Realistic deal names for the two deals a row creates first.
const OLDER_DEAL = 'Annual renewal';
const NEWER_DEAL = 'Onboarding package';
// Organization Industry is a picklist in Pipedrive; "Retail" is one of its options. Both columns are set because
// the Organisation Fields card maps both to the same Pipedrive field.
const PICKLIST_INDUSTRY = { Industry: 'Retail', 'Company Industry': 'Retail' };

type Prospect = { row: Row; email: string; name: string };

// The Scenario column holds the name of the staging row the check is built from. The row is marked used at
// once: rows do not clean up Pipedrive, so a check that stopped early must not return with the same email.
function prospect(scenario: string, override: Record<string, string> = {}): Prospect {
  const found = readCsv(CSV).find((r) => r['Scenario'] === scenario);
  if (!found) throw new Error(`No row "${scenario}" in test-data/${CSV}. Run scripts/make-pipedrive-email-bounced-smoke-data.ts.`);
  const row = { ...found, ...override };
  markUsed(CSV, row['Email']);
  return { row, email: row['Email'], name: fullName(row) };
}

// Saves the trigger with the row's activities, reloads the page and reads the saved trigger back.
async function useTrigger(fx: Fx, picks: Parameters<typeof configure>[2]): Promise<void> {
  await configure(fx, TRIGGER, picks);
  await test.step('Reload and read the saved trigger back', async () => {
    await fx.pipedriveIntegration.openTriggers();
    expect(await fx.pipedriveIntegration.isTriggerOn(TRIGGER), `"${TRIGGER}" is on after the reload`).toBe(true);
  });
}

function requireSequence(): void {
  if (!SEQUENCE_ID) throw new Error('SMOKE_SEQUENCE_ID is not set. Use scripts/run-pipedrive-email-bounced-smoke.sh.');
}

async function addProspect(fx: Fx, p: Prospect): Promise<void> {
  requireSequence();
  await test.step(`Add ${p.name || p.email} to the sequence`, async () => {
    await fx.saleshandySequence.createAndAddProspect(SEQUENCE_ID, p.row);
  });
}

// "Mark the step 1 email as bounced": adds the prospect, then Emails tab > row > Actions > Mark as bounced.
// Nothing is sent: the manual way works on a row that is still scheduled.
async function bounce(fx: Fx, p: Prospect): Promise<void> {
  await addProspect(fx, p);
  await test.step('Mark the step 1 email as bounced', async () => {
    await fx.saleshandySequence.markAsBounced(SEQUENCE_ID, p.name, 1, p.email);
  });
}

// The person the prospect would be in Pipedrive: same email, an abbreviated name ("A. Keita") so a changed
// name proves the update.
async function personFirst(fx: Fx, p: Prospect): Promise<string> {
  const oldName = `${p.row['First Name'].charAt(0)}. ${p.row['Last Name']}`;
  return test.step(`Create the person ${p.email} in Pipedrive as "${oldName}"`, async () => fx.people.create({ name: oldName, email: p.email }));
}

async function twoDeals(fx: Fx, personId: string): Promise<void> {
  await test.step('Create 2 deals on the person', async () => {
    await fx.deals.createOnPerson(personId, { title: OLDER_DEAL, value: 1800 });
    await fx.deals.createOnPerson(personId, { title: NEWER_DEAL, value: 2400 });
  });
}

async function orgFirst(fx: Fx, name: string): Promise<string> {
  return test.step(`Create the organization "${name}" in Pipedrive`, async () => fx.orgs.create(name));
}

// The organization checks need a company with no organization yet. Rows do not delete their records, so the
// pool names fill up in Pipedrive: take a pool name that is not on the Organizations list (compared without
// case) and give the prospect that company.
async function useFreeCompany(fx: Fx, p: Prospect): Promise<void> {
  const taken = new Set((await fx.orgs.names()).map((n) => n.toLowerCase()));
  const free = companyNames().filter((n) => !taken.has(n.toLowerCase()));
  if (!free.length) throw new Error('Every company of the pool already has an organization in Pipedrive; add companies to COMPANIES in src/data/generate.ts');
  Object.assign(p.row, companyFields(free[Math.floor(Math.random() * free.length)]), PICKLIST_INDUSTRY);
}

async function expectOnePerson(fx: Fx, p: Prospect): Promise<string> {
  let id = '';
  await untilInPipedrive(fx, TRIGGER, `Person ${p.email} not found once in Pipedrive`, async () => {
    const ids = await fx.people.idsByEmail(p.email);
    expect(ids, `persons with ${p.email}`).toHaveLength(1);
    id = ids[0];
  }, LOOK);
  return id;
}

test.describe('Email is Bounced in Saleshandy, Pipedrive (production smoke)', () => {
  test.describe.configure({ timeout: ROW });

  // 1. Create a Lead, Create a Deal and Create a Person (staging: Combined actions > 1)
  test('Create a Lead, Create a Deal and Create a Person: prospect not in Pipedrive', async ({ fx }) => {
    const p = prospect('Combined actions > 1');
    await useTrigger(fx, [PD.createLead, { activity: PD.createDeal, extra: QUALIFIED }, PD.createPerson]);
    await bounce(fx, p);
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Lead, deal and activity not all on the person', async () => {
      await fx.people.open(id);
      expect(await fx.people.leadTitles()).toEqual([p.email]);
      expect(await fx.people.dealTitles()).toEqual([p.email]);
      expect(await fx.people.activityCount()).toBe(1);
    }, LOOK);
    expect(await fx.people.idsByEmail(p.email), 'exactly one person').toEqual([id]);
  });

  // 2. Create a Person (staging: Create a Person > 2)
  test('Create a Person: person exists with an old value in a mapped field', async ({ fx }) => {
    const p = prospect('Create a Person > 2');
    const id = await personFirst(fx, p);
    await useTrigger(fx, [PD.createPerson]);
    await bounce(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Person not updated, or activity not added', async () => {
      await fx.people.open(id);
      expect(await fx.people.name()).toBe(p.name);
      expect(await fx.people.activityCount()).toBe(1);
    }, LOOK);
    expect(await fx.people.idsByEmail(p.email), 'still one person').toEqual([id]);
  });

  // 3. Update a Person (staging: Update a Person > 1)
  test('Update a Person: person exists with an old value in a mapped field', async ({ fx }) => {
    const p = prospect('Update a Person > 1');
    const id = await personFirst(fx, p);
    await useTrigger(fx, [PD.updatePerson]);
    await bounce(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Person not updated, or activity not added', async () => {
      await fx.people.open(id);
      expect(await fx.people.name()).toBe(p.name);
      expect(await fx.people.activityCount()).toBe(1);
    }, LOOK);
  });

  // 4. Update a Deal (staging: Update a Deal > 1)
  test('Update a Deal: person has 2 deals', async ({ fx }) => {
    const p = prospect('Update a Deal > 1');
    const id = await personFirst(fx, p);
    await twoDeals(fx, id);
    await fx.people.open(id);
    const [older, newest] = await fx.people.dealIds();
    await useTrigger(fx, [{ activity: PD.updateDeal, extra: CONTACT_MADE }]);
    await bounce(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not updated', async () => {
      expect(await fx.deals.read(newest)).toMatchObject({ title: p.email, pipeline: PIPEDRIVE_PIPELINE, stage: 'Contact Made' });
    }, LOOK);
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
    await bounce(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Newest deal not deleted', async () => {
      await fx.people.open(id);
      expect(await fx.people.dealIds()).toEqual([older]);
    }, LOOK);
  });

  // 6. Delete Person (staging: Delete Person > 1)
  test('Delete Person: person exists', async ({ fx }) => {
    const p = prospect('Delete Person > 1');
    await personFirst(fx, p);
    await useTrigger(fx, [PD.deletePerson]);
    await bounce(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Person ${p.email} not deleted`, async () => {
      expect(await fx.people.idsByEmail(p.email)).toHaveLength(0);
    }, LOOK);
  });

  // 7. Create Organization (staging: Create Organization > 1)
  test('Create Organization: prospect has a company, no organization with that name', async ({ fx }) => {
    const p = prospect('Create Organization > 1');
    await useFreeCompany(fx, p);
    expect(await fx.orgs.countByName(p.row['Company']), 'the company name is free').toBe(0);
    await useTrigger(fx, [PD.createOrganization]);
    await bounce(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not created`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(1);
    }, LOOK);
    expect(await fx.people.idsByEmail(p.email), 'not linked to any person').toHaveLength(0);
    // The organizations page object has no Details reader, so the mapped Organisation Fields are not read
    // (same gap as staging). The Logs entry is recorded for QA.
    await recordLog(fx, TRIGGER);
  });

  // 8. Update Organization (staging: Update Organization > 1)
  test('Update Organization: an organization with the exact company name exists', async ({ fx }) => {
    const p = prospect('Update Organization > 1');
    await useFreeCompany(fx, p);
    await orgFirst(fx, p.row['Company']);
    await useTrigger(fx, [PD.updateOrganization]);
    await bounce(fx, p);
    // Mapped fields are not read: the visible result is no second organization and a Logs entry.
    await fx.saleshandySequence.page.waitForTimeout(60_000);
    await staysUnchanged(fx, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(1);
    });
    await recordLog(fx, TRIGGER);
  });

  // 9. Delete Organization (staging: Delete Organization > 1)
  test('Delete Organization: an organization with the exact company name exists', async ({ fx }) => {
    const p = prospect('Delete Organization > 1');
    await useFreeCompany(fx, p);
    await orgFirst(fx, p.row['Company']);
    await useTrigger(fx, [PD.deleteOrganization]);
    await bounce(fx, p);
    await untilInPipedrive(fx, TRIGGER, `Organization "${p.row['Company']}" not deleted`, async () => {
      expect(await fx.orgs.countByName(p.row['Company'])).toBe(0);
    }, LOOK);
  });

  // 10. Only Reply Received enabled (staging: Trigger behavior > 4)
  test('Only "Reply is Received in Saleshandy" enabled: bounce creates no person', async ({ fx }) => {
    const p = prospect('Trigger behavior > 4');
    await fx.pipedriveIntegration.setActivities('Reply is Received in Saleshandy', [PD.createPerson]);
    await expect(fx.pipedriveIntegration.savedToast()).toBeVisible({ timeout: 15_000 });
    // KEEP_OTHER_TRIGGERS leaves "Email is Bounced" on from the checks before; this check needs it off.
    await test.step(`Turn "${TRIGGER}" off and save`, async () => {
      await fx.pipedriveIntegration.disable(TRIGGER);
      await fx.pipedriveIntegration.save();
      await expect(fx.pipedriveIntegration.savedToast()).toBeVisible({ timeout: 15_000 });
    });
    await bounce(fx, p);
    // Production needs 1 to 3 minutes to reach Pipedrive, so a person that would come must have time to come.
    await fx.saleshandySequence.page.waitForTimeout(3 * 60_000);
    expect(await fx.people.idsByEmail(p.email), `persons with ${p.email}`).toHaveLength(0);
    await recordLog(fx, TRIGGER).catch(() => test.info().annotations.push({ type: 'Logs', description: 'no Logs entry read' }));
  });

  // 11. Real bounce (staging: Trigger behavior > 5). The only send.
  test('Create a Person: real bounce, prospect not in Pipedrive', async ({ fx }) => {
    test.setTimeout(REAL_ROW);
    const found = prospect('Trigger behavior > 5');
    // @mailinator.com never bounces, @<company>.mailinator.com does (QA 2026-10-12). The CSV keeps the plain
    // address, so the real-bounce one is built here. An empty company would give "@.mailinator.com", which is invalid.
    if (!found.row['Company']) Object.assign(found.row, companyFields(companyNames()[Math.floor(Math.random() * companyNames().length)]));
    const company = found.row['Company'].normalize('NFKD').replace(/[^A-Za-z]/g, '').toLowerCase();
    const email = found.email.replace(/@mailinator\.com$/i, `@${company}.mailinator.com`);
    const p: Prospect = { ...found, email, row: { ...found.row, Email: email } };
    markUsed(CSV, email);
    await useTrigger(fx, [PD.createPerson]);
    // A send with Email Sent on would create the person first. Stop before the send.
    expect(await fx.pipedriveIntegration.isTriggerOn(SEND_TRIGGER), `"${SEND_TRIGGER}" is on. Turn it off and run again. No send was made.`).toBe(false);
    await addProspect(fx, p);
    await test.step('Send step 1 (Send now)', async () => {
      await fx.saleshandySequence.sendNow(SEQUENCE_ID, p.name, 1, p.email);
    });
    await test.step('Wait for Saleshandy to show the email as Bounced (no Mark as bounced)', async () => {
      await fx.saleshandySequence.waitUntilBounced(SEQUENCE_ID, p.name);
    });
    const id = await expectOnePerson(fx, p);
    await untilInPipedrive(fx, TRIGGER, 'Activity not on the person', async () => {
      await fx.people.open(id);
      expect(await fx.people.activityCount()).toBe(1);
    }, LOOK);
    const [activity] = await fx.people.activities();
    expect(activity).toMatchObject({ subject: SUBJECT, type: 'Email', done: true });
  });
});
