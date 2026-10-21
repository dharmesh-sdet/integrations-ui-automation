// Production smoke test: Prospect is Unsubscribed in Saleshandy.
// Checklist: notes/production-testing/06-unsubscribed.md (draft, not yet
// approved by QA; AL-4015 is still "In QA" in Jira, see the checklist's
// intro). Written 2026-10-17, not run. Data: test-data/hubspot/unsubscribed-smoke.csv
// (+ -deals, -companies), generate from the staging unsubscribed rows before
// a real run, rows replaced with new people before every run.
//
// Reuses the staging flow (src/flows/saleshandy-to-hubspot.ts) and page
// objects; test bodies follow unsubscribed.spec.ts and unsubscribed-lite.spec.ts
// row for row (source rows named in each comment). Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts);
//  - the event is the real "Unsubscribe here" link (QA, 2026-10-19: Mark as
//    Unsubscribe in the UI does not work on production): open the delivered
//    email in Mailinator, wait 93s, open the link, then reload the Prospects
//    tab once and expect Unsubscribed. The sequence already has "Unsubscribe
//    as Link" saved (QA);
//  - the sequence is read from the environment, nothing production is hard-coded.
//
// Needs, before a run (QA / Claude, once):
//   SETUP_SMOKE_SEQUENCE=1 run of tests/setup/unsubscribed-smoke-sequence.spec.ts
//   SMOKE_SEQUENCE_ID      id of the production "HubSpot Prospect Unsubscribed Smoke" sequence
//   SMOKE_STEP1_SUBJECT    subject of its step 1 email ("Save cost & achieve more!")
//   npm run login:saleshandy -- emailopenedprod, and npm run login:hubspot
//   field mapping saved on the production account
//   QA's confirmation that AL-4015 is deployed to production (see the checklist)
// Run: SMOKE_SEQUENCE_ID=... SMOKE_STEP1_SUBJECT="..." TEST_DATA_ONLY=hubspot/unsubscribed-smoke \
//        npx playwright test tests/hubspot/unsubscribed-smoke.spec.ts --project=chromium --workers=1
import type { HubSpotContactsPage } from '../../src/pages/hubspot/contacts.page.ts';
import type { HubSpotIntegrationPage } from '../../src/pages/saleshandy/hubspot-integration.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';
import { expect, test } from '../../src/fixtures/index.ts';
import { CREATE_COMPANY, CREATE_CONTACT, CREATE_DEAL, CREATE_NOTE, CREATE_TASK, RECORD_EMAIL, UPDATE_COMPANY, UPDATE_CONTACT, UPDATE_DEAL } from '../../src/flows/activity-rows.ts';
import { createFlow, dealConfig as sharedDealConfig, dealUpdateConfig as sharedDealUpdateConfig, expectContact, fullName, mapped, newDealsOf } from '../../src/flows/saleshandy-to-hubspot.ts';

test.use({ account: 'emailopenedprod' });

// Name as staging shows it on Triggers & Activity and in Logs (seen
// 2026-10-15); not yet seen on production.
const TRIGGER = 'Prospect is Unsubscribed in Saleshandy';
const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '';
const STEP_1_SUBJECT = process.env.SMOKE_STEP1_SUBJECT ?? '';

// The email must stay open this long before the link registers (QA, 2026-10-19).
const LINK_WAIT_MS = 93_000;
const UNSUBSCRIBED_PAGE_TEXT = "You will no longer receive emails from us. We're sorry to see you go.";

const LOG_TIMEOUT_MS = 10 * 60_000;
// The Update a Deal log stayed RUNNING for about 7.5 minutes on staging.
const UPDATE_DEAL_LOG_TIMEOUT_MS = 15 * 60_000;
const TEST_TIMEOUT_MS = 20 * 60_000;

// Same values as the staging Unsubscribed rows; Extra Configuration cannot be
// cleared once saved (QA pattern, every prior workflow).
const UPDATE_CONTACT_VALUES = { 'Update Lead Status': 'Connected', 'Update Lead Lifecycle': 'Sales Qualified Lead' };
const CREATE_CONTACT_VALUES = { 'Lead Status': 'Open', 'Lead Lifecycle': 'Marketing Qualified Lead' };
const TASK = { title: 'Follow up from the workflow', type: 'Call', priority: 'Medium', dueDays: 3 };

// The new HubSpot portal (247734202, QA 2026-10-19) has only the default stages:
// Appointment Scheduled, Qualified To Buy, Presentation Scheduled, Decision Maker
// Bought-In, Contract Sent, Closed Won, Closed Lost. The shared helpers still use
// the old portal's "Initial Contact" / "Follow-Up", so this spec overrides the stage.
const CREATE_STAGE = 'Appointment Scheduled';
const UPDATE_STAGE = 'Qualified To Buy';

const dealConfig = (closingDays: string) => ({
  ...sharedDealConfig(closingDays),
  'Select Pipeline Stage (when to create)': CREATE_STAGE,
});

const dealUpdateConfig = (closingDays: string) => ({
  ...sharedDealUpdateConfig(closingDays),
  'Select Pipeline Stage (when to update)': UPDATE_STAGE,
});

const flow = createFlow({
  trigger: TRIGGER,
  sequenceId: SEQUENCE_ID,
  csv: 'hubspot/unsubscribed-smoke.csv',
  emailSubject: STEP_1_SUBJECT,
  // Trigger's own header text on the logged email is not seen yet (staging
  // unsubscribed.spec.ts only checks the prospect's first name).
  loggedEmailContains: (row) => [row['First Name']],
  noteContains: (row, step) => [`Step: ${step}`, 'Variant: A', `Prospect Email: ${row['Email']}`],
  // The UI action does not work on production; the unsubscribe link does.
  fireEvent: async ({ mailinator, sequence }, row) => {
    await test.step(`Open the delivered email in Mailinator, wait ${LINK_WAIT_MS / 1000}s, open "Unsubscribe here"`, async () => {
      const page = await mailinator!.openUnsubscribeLink(row['Email'], STEP_1_SUBJECT, LINK_WAIT_MS);
      await expect(page.getByText(UNSUBSCRIBED_PAGE_TEXT), 'unsubscribe page').toBeVisible();
    });
    await test.step('Back on the Prospects tab, after a refresh, it shows Unsubscribed', async () => {
      await sequence.expectProspectStatusAfterRefresh(SEQUENCE_ID, row['Email'], 'Unsubscribed');
    });
  },
});

// ---- helpers (same steps as the staging specs) ----

// The row is marked used as soon as its contact exists in HubSpot, so a later
// failure cannot leave a contact behind that the next run tries to create again.
async function newContact(contacts: HubSpotContactsPage, row: ReturnType<typeof flow.rowFor>): Promise<string> {
  const id = await contacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });
  flow.markUsed(row);
  return id;
}

async function findContact(contacts: HubSpotContactsPage, row: ReturnType<typeof flow.rowFor>): Promise<string> {
  let id = '';
  await untilPasses(`Contact ${row['Email']} not found in HubSpot`, async () => {
    id = await contacts.findContactId(row['Email'], fullName(row));
  });
  return id;
}

async function expectOnRecord(
  contacts: HubSpotContactsPage,
  typeId: '0-1' | '0-3',
  id: string,
  texts: (string | RegExp)[],
  what: string,
): Promise<void> {
  await untilPasses(`${what} not found on the HubSpot record ${typeId}/${id}`, async () => {
    const text = await contacts.activitiesText(typeId, id);
    for (const t of texts) {
      if (typeof t === 'string') expect(text, `${what}: "${t}"`).toContain(t);
      else expect(text, `${what}: ${t}`).toMatch(t);
    }
  });
}

function dueDatePattern(days: number): RegExp {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return new RegExp(`${month}[a-z]*\\.?\\s+0?${d.getDate()}\\b`);
}

// Selects `activity` (with its Extra Configuration `values`) and a companion
// without Extra Configuration (Create a Note, Record (log)), then the page Save.
async function usePaired(integration: HubSpotIntegrationPage, activity: string, values: Record<string, string>, companion: string): Promise<void> {
  await flow.useOnly(integration, activity, values, []);
  await expect(integration.savedToast()).toBeHidden({ timeout: 15_000 });
  await integration.selectActivity(TRIGGER, companion);
  await integration.save();
  await expect(integration.savedToast(), 'save confirmation').toBeVisible({ timeout: 30_000 });
}

test.beforeAll(() => {
  if (!SEQUENCE_ID || !STEP_1_SUBJECT) {
    throw new Error('Set SMOKE_SEQUENCE_ID and SMOKE_STEP1_SUBJECT (production Prospect Unsubscribed sequence id and its step 1 subject) before running the smoke test');
  }
});

// One test per checklist section, in the checklist's order. Each is one run.
test.describe('Production smoke: Prospect is Unsubscribed in Saleshandy', () => {
  // Set before the first step: HubSpot pages take about 40 s each to load, so
  // the contact and deal set-up alone used the 5 minute default (04, 06).
  test.beforeEach(() => {
    test.setTimeout(TEST_TIMEOUT_MS);
  });

  test('00 Baseline: the unsubscribe link fires the trigger, Prospects tab Unsubscribed, one log entry Success', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Trigger behavior (baseline) > 1');
    await test.step('Select only Update a Contact: Connected, Sales Qualified Lead', async () => {
      await flow.useOnly(saleshandyIntegration, UPDATE_CONTACT, UPDATE_CONTACT_VALUES, []);
    });
    await test.step('Create the contact in HubSpot', async () => {
      await newContact(hubspotContacts, row);
    });
    const known = await flow.runTrigger(ctx, row);
    await test.step('Check Logs: one new entry, Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, LOG_TIMEOUT_MS);
      const fresh = (await saleshandyIntegration.logEntries(TRIGGER)).filter((e) => !known.has(e.id));
      expect(fresh.length, 'new log entries for this trigger').toBe(1);
    });
  });

  // Create a Contact in HubSpot > 1
  test('01 Create a Contact in HubSpot: contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Create a Contact in HubSpot > 1');
    await test.step('Select only Create a Contact: Lead Status Open, Lead Lifecycle Marketing Qualified Lead', async () => {
      await flow.useOnly(saleshandyIntegration, CREATE_CONTACT, CREATE_CONTACT_VALUES, []);
    });
    const known = await flow.runTrigger(ctx, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, LOG_TIMEOUT_MS);
    });
    await test.step('Check the contact in HubSpot: Lead status, Lifecycle stage and mapped fields', async () => {
      await expectContact(hubspotContacts, row, { ...mapped(row), 'Lead status': 'Open', 'Lifecycle stage': 'Marketing Qualified Lead' });
    });
  });

  // Update a Contact in HubSpot > 1
  test('02 Update a Contact in HubSpot: details changed', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Update a Contact in HubSpot > 1');
    await test.step('Select only Update a Contact: Lead Status Connected, Lifecycle Sales Qualified Lead', async () => {
      await flow.useOnly(saleshandyIntegration, UPDATE_CONTACT, UPDATE_CONTACT_VALUES, []);
    });
    await test.step('Create the contact in HubSpot', async () => {
      await newContact(hubspotContacts, row);
    });
    const known = await flow.runTrigger(ctx, row, async () => {
      await test.step('Change Job Title and City in Saleshandy', async () => {
        await saleshandyCrm.search(row['Email']);
        await saleshandyCrm.openProspect(fullName(row));
        await saleshandyCrm.editField('Job Title', row['Updated Job Title']);
        await saleshandyCrm.editField('City', row['Updated City']);
      });
    });
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, LOG_TIMEOUT_MS);
    });
    await test.step('Check the contact in HubSpot: new Job title and City, Lead status Connected, Lifecycle stage Sales Qualified Lead', async () => {
      await expectContact(hubspotContacts, row, { 'Job title': row['Updated Job Title'], City: row['Updated City'], 'Lead status': 'Connected', 'Lifecycle stage': 'Sales Qualified Lead' });
    });
  });

  // Create a deal in HubSpot > 1
  test('03 Create a Deal in HubSpot: contact in HubSpot, no deal', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Create a deal in HubSpot > 1');
    await test.step(`Select only Create a Deal: Sales Pipeline, ${CREATE_STAGE}, New Business, High, 0 Days`, async () => {
      await flow.useOnly(saleshandyIntegration, CREATE_DEAL, dealConfig('0'), []);
    });
    const contactId = await newContact(hubspotContacts, row);
    const known = await flow.runTrigger(ctx, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, LOG_TIMEOUT_MS);
    });
    await test.step('Check HubSpot: one deal on the contact', async () => {
      await newDealsOf(hubspotContacts, contactId, 1, []);
    });
  });

  // Update a deal in HubSpot > 2 (Extra Configuration filled). AL-4103, not re-confirmed here.
  test('04 Update a Deal in HubSpot: contact has 3 deals, latest updated', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Update a deal in HubSpot > 2');
    await test.step(`Select only Update a Deal: Sales Pipeline, ${UPDATE_STAGE}, New Business, High, 0 Days`, async () => {
      await flow.useOnly(saleshandyIntegration, UPDATE_DEAL, dealUpdateConfig('0'), []);
    });
    const dealIds: string[] = [];
    const before: unknown[] = [];
    await test.step('Create the contact in HubSpot with 3 deals, one after the other', async () => {
      const contactId = await newContact(hubspotContacts, row);
      for (const d of flow.deals.filter((x) => x['Contact Email'] === row['Email'])) {
        dealIds.push(await hubspotDeals.createDealForContact(contactId, { name: d['Deal Name'], amount: d['Amount'] }));
      }
      expect(dealIds.length, 'deals created').toBe(3);
      for (const id of dealIds.slice(0, 2)) before.push(await hubspotDeals.summary(id));
    });
    const known = await flow.runTrigger(ctx, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
    });
    await test.step('Check HubSpot: the latest created deal has the configured values', async () => {
      await expect(async () => {
        expect(await hubspotDeals.summary(dealIds[2]), 'latest created deal').toMatchObject({ pipeline: 'Sales Pipeline', stage: UPDATE_STAGE, dealType: 'New Business', priority: 'High' });
      }).toPass({ timeout: 90_000 });
    });
    await test.step('Check HubSpot: the 2 older deals are unchanged', async () => {
      for (const [i, id] of dealIds.slice(0, 2).entries()) {
        expect(await hubspotDeals.summary(id), `deal ${i + 1}`).toEqual(before[i]);
      }
    });
  });

  // Create a company in HubSpot > 1
  test('05 Create a Company in HubSpot: one company created and associated', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Create a company in HubSpot > 1');
    await flow.useOnly(saleshandyIntegration, CREATE_COMPANY, {}, []);
    const contactId = await newContact(hubspotContacts, row);
    const known = await flow.runTrigger(ctx, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, LOG_TIMEOUT_MS);
    });
    await test.step('Check HubSpot: one company associated to the contact', async () => {
      await untilPasses('Company not on the contact in HubSpot', async () => {
        expect((await hubspotContacts.associations(contactId, 'companies')).count, 'companies on the contact').toBe(1);
      });
    });
  });

  // Update a company in HubSpot > 2
  test('06 Update a Company in HubSpot: 2 companies, latest updated incl. City', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotCompanies }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Update a company in HubSpot > 2');
    await flow.useOnly(saleshandyIntegration, UPDATE_COMPANY, {}, []);
    const companyIds: string[] = [];
    let olderBefore = '';
    await test.step('Create the contact in HubSpot with 2 associated companies, one after the other', async () => {
      await newContact(hubspotContacts, row);
      for (const c of flow.companies.filter((x) => x['Contact Email'] === row['Email'])) {
        const id = await hubspotCompanies.createCompany({ domain: c['Company Domain'], name: c['Company Name'] });
        await hubspotCompanies.associateContacts(id, [{ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'] }]);
        companyIds.push(id);
      }
      expect(companyIds.length, 'companies created').toBe(2);
      olderBefore = await hubspotCompanies.property(companyIds[0], 'City');
    });
    const known = await flow.runTrigger(ctx, row, async () => {
      await test.step('Change City and State in Saleshandy', async () => {
        await saleshandyCrm.search(row['Email']);
        await saleshandyCrm.openProspect(fullName(row));
        await saleshandyCrm.editField('City', row['Updated City']);
        await saleshandyCrm.editField('State', row['Updated State']);
      });
    });
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, LOG_TIMEOUT_MS);
    });
    await test.step('Check HubSpot: the latest associated company shows the new City and State', async () => {
      await untilPasses(`Company ${companyIds[1]} does not show the new values`, async () => {
        expect(await hubspotCompanies.property(companyIds[1], 'City'), 'Company City').toBe(row['Updated City']);
        expect(await hubspotCompanies.property(companyIds[1], 'State/Region'), 'Company State/Region').toBe(row['Updated State']);
      });
    });
    await test.step('Check HubSpot: the other company is unchanged', async () => {
      expect(await hubspotCompanies.property(companyIds[0], 'City'), 'older company City').toBe(olderBefore);
    });
  });

  // Create a Task in HubSpot > 1 (Extra Configuration filled).
  test('07 Create a Task in HubSpot: task created with the configured values', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Create a Task in HubSpot > 1');
    await test.step(`Select only Create a Task: "${TASK.title}", ${TASK.type}, ${TASK.priority}, Due in ${TASK.dueDays}`, async () => {
      await flow.startClean(saleshandyIntegration);
      await saleshandyIntegration.selectActivity(TRIGGER, CREATE_TASK);
      await saleshandyIntegration.configTextbox('Task Title').fill(TASK.title);
      await saleshandyIntegration.chooseConfigOption('Task Type', TASK.type);
      await saleshandyIntegration.chooseConfigOption('Task Priority', TASK.priority);
      await saleshandyIntegration.dueIn().fill(String(TASK.dueDays));
      await saleshandyIntegration.configSaveButton().click();
      await expect(saleshandyIntegration.savedToast(), 'save confirmation').toBeVisible({ timeout: 30_000 });
    });
    const contactId = await newContact(hubspotContacts, row);
    const known = await flow.runTrigger(ctx, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, LOG_TIMEOUT_MS);
    });
    await test.step(`Check HubSpot: task "${TASK.title}" on the contact, due ${TASK.dueDays} days from today`, async () => {
      await expectOnRecord(hubspotContacts, '0-1', contactId, [TASK.title, dueDatePattern(TASK.dueDays)], 'Task');
    });
  });

  // Create a Note in HubSpot > 1: paired with Create a deal.
  test('08 Create a Note in HubSpot: paired with Create a Deal, note on contact and deal', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Create a Note in HubSpot > 1');
    await test.step('Select Create a Deal (Closing Date 1 Day) and Create a Note', async () => {
      await usePaired(saleshandyIntegration, CREATE_DEAL, dealConfig('1'), CREATE_NOTE);
    });
    const known = await flow.runTrigger(ctx, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, LOG_TIMEOUT_MS);
    });
    await test.step('Check HubSpot: note on both the contact and the deal', async () => {
      const contactId = await findContact(hubspotContacts, row);
      const [deal] = await newDealsOf(hubspotContacts, contactId, 1, []);
      const texts = ['Note created via Saleshandy', ...flow.noteContains(row, 1)];
      await expectOnRecord(hubspotContacts, '0-1', contactId, texts, 'Note on the contact');
      await expectOnRecord(hubspotContacts, '0-3', deal.id, texts, 'Note on the deal');
    });
  });

  // Record (log) an email activity in HubSpot > 1: paired with Create a deal.
  test('09 Record (log) an Email Activity in HubSpot: paired with Create a Deal, email on deal and contact', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Record (log) an email activity in HubSpot > 1');
    await test.step('Select Create a Deal (Closing Date 1 Day) and Record (log) an Email Activity', async () => {
      await usePaired(saleshandyIntegration, CREATE_DEAL, dealConfig('1'), RECORD_EMAIL);
    });
    const known = await flow.runTrigger(ctx, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, LOG_TIMEOUT_MS);
    });
    await test.step('Check HubSpot: email logged on both the deal and the contact', async () => {
      const contactId = await findContact(hubspotContacts, row);
      const [deal] = await newDealsOf(hubspotContacts, contactId, 1, []);
      await expectOnRecord(hubspotContacts, '0-1', contactId, flow.loggedEmailContains(row, 1), 'Logged email on the contact');
      await expectOnRecord(hubspotContacts, '0-3', deal.id, flow.loggedEmailContains(row, 1), 'Logged email on the deal');
    });
  });

  // Record (log) an email activity in HubSpot > 3 (paired with Update a deal, 3 deals). AL-4123.
  // The email is logged on every deal of the contact: expected behavior (AL-4130, developer, 2026-10-15).
  test('10 Record (log) an Email Activity in HubSpot: paired with Update a Deal, contact has 3 deals', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Record (log) an email activity in HubSpot > 3');
    await test.step(`Select Update a Deal (${UPDATE_STAGE}, 0 Days) and Record (log) an Email Activity`, async () => {
      await usePaired(saleshandyIntegration, UPDATE_DEAL, dealUpdateConfig('0'), RECORD_EMAIL);
    });
    const dealIds: string[] = [];
    await test.step('Create the contact in HubSpot with 3 deals, one after the other', async () => {
      const contactId = await newContact(hubspotContacts, row);
      for (const d of flow.deals.filter((x) => x['Contact Email'] === row['Email'])) {
        dealIds.push(await hubspotDeals.createDealForContact(contactId, { name: d['Deal Name'], amount: d['Amount'] }));
      }
      expect(dealIds.length, 'deals created').toBe(3);
    });
    const known = await flow.runTrigger(ctx, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
    });
    await test.step('Check HubSpot: the latest created deal is updated', async () => {
      await expect(async () => {
        expect(await hubspotDeals.summary(dealIds[2]), 'latest created deal').toMatchObject({ pipeline: 'Sales Pipeline', stage: UPDATE_STAGE, dealType: 'New Business', priority: 'High' });
      }).toPass({ timeout: 90_000 });
    });
    await test.step('Check HubSpot: email logged on all 3 deals and the contact, not "Unknown Contact"', async () => {
      const contactId = await findContact(hubspotContacts, row);
      await expectOnRecord(hubspotContacts, '0-3', dealIds[2], flow.loggedEmailContains(row, 1), 'Logged email on the deal');
      expect(await hubspotContacts.activitiesText('0-3', dealIds[2]), 'deal Activities').not.toContain('Unknown Contact');
      for (const [i, id] of dealIds.slice(0, 2).entries()) {
        await expectOnRecord(hubspotContacts, '0-3', id, flow.loggedEmailContains(row, 1), `Logged email on older deal ${i + 1}`);
      }
      await expectOnRecord(hubspotContacts, '0-1', contactId, flow.loggedEmailContains(row, 1), 'Logged email on the contact');
    });
  });
});
