// Production smoke test: Sequence Email is Opened in Saleshandy.
// Checklist: notes/production-testing/01-email-opened.md (one test per check, same
// order). Data: test-data/hubspot/email-opened-smoke.csv (+ -deals, -companies),
// rows copied from the staging Phase 1 / Phase 2 scenarios of
// test-cases/hubspot/email-opened.md, replaced with new people before every run.
//
// Reuses the staging flow (src/flows/saleshandy-to-hubspot.ts) and page objects;
// the test bodies follow email-opened.spec.ts and email-opened-phase2.spec.ts row
// for row (names of the source rows are in each title). Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts);
//  - production timing (QA via developer, 2026-10-12): the first open counts only
//    60 s after the email was sent, and the log registers 1 to 3 minutes after a
//    counted open, so the open waits and the waits are longer;
//  - the sequence is read from the environment, nothing production is hard-coded.
//
// Needs, before a run (QA / Claude, once):
//   SMOKE_SEQUENCE_ID      id of the production sequence (Track email opens on,
//                          custom tracking domain, activated, one sender)
//   SMOKE_STEP1_SUBJECT    subject of its step 1 email
//   npm run login:saleshandy -- emailopenedprod, and npm run login:hubspot
//   field mapping saved on the production account
// Run: SMOKE_SEQUENCE_ID=... SMOKE_STEP1_SUBJECT="..." TEST_DATA_ONLY=hubspot/email-opened-smoke \
//        npx playwright test tests/hubspot/email-opened-smoke.spec.ts --project=chromium --workers=1
import type { Row } from '../../src/data/csv.ts';
import type { HubSpotContactsPage } from '../../src/pages/hubspot/contacts.page.ts';
import type { HubSpotIntegrationPage } from '../../src/pages/saleshandy/hubspot-integration.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';
import { expect, test } from '../../src/fixtures/index.ts';
import { CREATE_COMPANY, CREATE_CONTACT, CREATE_DEAL, CREATE_NOTE, CREATE_TASK, RECORD_EMAIL, UPDATE_COMPANY, UPDATE_CONTACT, UPDATE_DEAL } from '../../src/flows/activity-rows.ts';
import { createFlow, dealUpdateConfig as sharedDealUpdateConfig, expectContact, fullName, mapped, newDealsOf } from '../../src/flows/saleshandy-to-hubspot.ts';

test.use({ account: 'emailopenedprod' });

const TRIGGER = 'Sequence Email is Opened in Saleshandy';
const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '';
const STEP_1_SUBJECT = process.env.SMOKE_STEP1_SUBJECT ?? '';

// Production timing. The first open counts 60 s after sending, so wait a little
// longer before opening; registering takes 1 to 3 minutes, so allow 10.
const SEND_TO_OPEN_MS = 75_000;
const OPEN_TIMEOUT_MS = 10 * 60_000;
const OPEN_REFRESH_MS = 15_000;
const LOG_TIMEOUT_MS = 10 * 60_000;
// The Update a Deal log stayed RUNNING for about 7.5 minutes on staging.
const UPDATE_DEAL_LOG_TIMEOUT_MS = 15 * 60_000;
const TEST_TIMEOUT_MS = 40 * 60_000;

const CREATE_CONTACT_LABELS = ['Lead Status', 'Lead Lifecycle'];
const UPDATE_CONTACT_LABELS = ['Update Lead Status', 'Update Lead Lifecycle'];
const CREATE_DEAL_LABELS = ['Select Pipeline (when to create)', 'Select Pipeline Stage (when to create)', 'Deal Type (while creating)', 'Deal Priority (while creating)'];
const TASK = { title: 'Follow up from the workflow', type: 'Call', priority: 'Medium', dueDays: 3 };

// Update a Deal with the stage two positions after Prospecting (QA, 2026-10-13).
const dealUpdateConfig = (closingDays: string) => ({
  ...sharedDealUpdateConfig(closingDays),
  'Select Pipeline Stage (when to update)': 'Follow-Up',
});

const flow = createFlow({
  trigger: TRIGGER,
  sequenceId: SEQUENCE_ID,
  csv: 'hubspot/email-opened-smoke.csv',
  emailSubject: STEP_1_SUBJECT,
  // The production account's Default Schedule is closed in the evening: step 1
  // showed "Scheduled, Tomorrow, 09:00 AM" and was never sent (seen 2026-10-14
  // 18:25 IST). Send now from the Emails tab, as Link Clicked does (QA
  // 2026-10-12); the sender and schedule settings are not changed.
  // The card reads "Logged email by <integration name> via Saleshandy" (QA
  // 2026-10-14), and the name is the account's (production: "rehan
  // integration"), so it is matched by pattern in the test, not by name.
  loggedEmailContains: () => ['Logged email by'],
  // Step 1 is sent by Saleshandy by itself; the event is the open in Mailinator.
  fireEvent: async ({ sequence, mailinator }, row, step) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    const before = await sequence.openedCount(SEQUENCE_ID, fullName(row), step);
    await test.step(`Wait ${SEND_TO_OPEN_MS / 1000} s after sending (production counts the first open after 60 s)`, async () => {
      await sequence.page.waitForTimeout(SEND_TO_OPEN_MS);
    });
    await test.step(`Open the step ${step} email (Mailinator)`, async () => {
      await mailinator!.openEmail(row['Email'], STEP_1_SUBJECT);
    });
    await test.step('Wait until Saleshandy counts the open (refresh the Emails tab)', async () => {
      await expect(async () => {
        expect(await sequence.openedCount(SEQUENCE_ID, fullName(row), step), 'Opened').toBeGreaterThanOrEqual(before + 1);
      }, `Opened count for ${row['Email']} did not reach ${before + 1} (gave up after ${OPEN_TIMEOUT_MS / 1000} seconds)`).toPass({ timeout: OPEN_TIMEOUT_MS, intervals: [OPEN_REFRESH_MS] });
    });
  },
});

// ---- helpers (same steps as the staging specs) ----

const newContact = (contacts: HubSpotContactsPage, row: Row) =>
  contacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });

async function findContact(contacts: HubSpotContactsPage, row: Row): Promise<string> {
  let id = '';
  await untilPasses(`Contact ${row['Email']} not found in HubSpot`, async () => {
    id = await contacts.findContactId(row['Email'], fullName(row));
  });
  return id;
}

// Waits until the record's Activities tab shows all texts (reloaded on each try).
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

// Selects `activity` (empty Extra Configuration) and a companion without Extra
// Configuration (Create a Note, Record (log)), then the page Save.
async function usePaired(integration: HubSpotIntegrationPage, activity: string, labels: string[], companion: string): Promise<void> {
  await flow.useOnly(integration, activity, {}, labels);
  // The dialog's own save toast is still up for a moment; wait for it so the next one is the page Save's.
  await expect(integration.savedToast()).toBeHidden({ timeout: 15_000 });
  await integration.selectActivity(TRIGGER, companion);
  await integration.save();
  await expect(integration.savedToast(), 'save confirmation').toBeVisible({ timeout: 30_000 });
}

test.beforeAll(() => {
  if (!SEQUENCE_ID || !STEP_1_SUBJECT) {
    throw new Error('Set SMOKE_SEQUENCE_ID and SMOKE_STEP1_SUBJECT (production sequence id and its step 1 subject) before running the smoke test');
  }
});

// One test per checklist section, in the checklist's order. Each is one run.
test.describe('Production smoke: Sequence Email is Opened in Saleshandy', () => {
  // Baseline > 2 (staging): Create a Contact selected, open once.
  test('01 Baseline: one open, Opened count 1, one log entry Success (AL-4013)', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Trigger behavior (baseline) > 2');
    await test.step('Select only Create a Contact, nothing chosen in Extra Configuration', async () => {
      await flow.useOnly(saleshandyIntegration, CREATE_CONTACT, {}, CREATE_CONTACT_LABELS);
    });
    const known = await flow.runTrigger(ctx, row);
    await test.step('Check the Opened count is 1', async () => {
      expect(await saleshandySequence.openedCount(SEQUENCE_ID, fullName(row), 1), 'Opened').toBe(1);
    });
    await test.step('Check Logs: one new entry, Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, LOG_TIMEOUT_MS);
      const fresh = (await saleshandyIntegration.logEntries(TRIGGER)).filter((e) => !known.has(e.id));
      expect(fresh.length, 'new log entries for this trigger').toBe(1);
    });
  });

  // Create a Contact in HubSpot > 1
  test('02 Create a Contact in HubSpot: contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Create a Contact in HubSpot > 1');
    await flow.useOnly(saleshandyIntegration, CREATE_CONTACT, {}, CREATE_CONTACT_LABELS);
    const known = await flow.runTrigger(ctx, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, LOG_TIMEOUT_MS);
    });
    await test.step('Check the contact in HubSpot has the mapped fields', async () => {
      await expectContact(hubspotContacts, row, mapped(row));
    });
  });

  // Update a Contact in HubSpot > 1
  test('03 Update a Contact in HubSpot: details changed', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Update a Contact in HubSpot > 1');
    await flow.useOnly(saleshandyIntegration, UPDATE_CONTACT, {}, UPDATE_CONTACT_LABELS);
    await newContact(hubspotContacts, row);
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
    await test.step('Check the contact in HubSpot shows the new values', async () => {
      await expectContact(hubspotContacts, row, { 'Job title': row['Updated Job Title'], City: row['Updated City'] });
    });
  });

  // Create a deal in HubSpot > 1
  test('04 Create a Deal in HubSpot: contact in HubSpot, no deal', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Create a deal in HubSpot > 1');
    await flow.useOnly(saleshandyIntegration, CREATE_DEAL, {}, CREATE_DEAL_LABELS);
    const contactId = await newContact(hubspotContacts, row);
    const known = await flow.runTrigger(ctx, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, LOG_TIMEOUT_MS);
    });
    await test.step('Check HubSpot: one deal on the contact', async () => {
      await newDealsOf(hubspotContacts, contactId, 1, []);
    });
  });

  // Update a deal in HubSpot > 2 (Phase 2, Extra Configuration filled). AL-4128.
  test('05 Update a Deal in HubSpot: contact has 3 deals, latest updated (AL-4128)', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Update a deal in HubSpot > 2');
    await test.step('Select only Update a Deal: Sales Pipeline, Follow-Up, New Business, High, 0 Days', async () => {
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
        expect(await hubspotDeals.summary(dealIds[2]), 'latest created deal').toMatchObject({ pipeline: 'Sales Pipeline', stage: 'Follow-Up', dealType: 'New Business', priority: 'High' });
      }).toPass({ timeout: 90_000 });
    });
    await test.step('Check HubSpot: the 2 older deals are unchanged', async () => {
      for (const [i, id] of dealIds.slice(0, 2).entries()) {
        expect(await hubspotDeals.summary(id), `deal ${i + 1}`).toEqual(before[i]);
      }
    });
  });

  // Create a company in HubSpot > 1
  test('06 Create a Company in HubSpot: one company created and associated', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
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

  // Update a company in HubSpot > 2: AL-4126 (City).
  test('07 Update a Company in HubSpot: 2 companies, latest updated incl. City (AL-4126)', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotCompanies }) => {
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

  // Create a Task in HubSpot > 1 (Phase 2, Extra Configuration filled).
  test('08 Create a Task in HubSpot: task created with the configured values', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
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

  // Create a Note in HubSpot > 1
  test('09 Create a Note in HubSpot: paired with Create a Contact', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Create a Note in HubSpot > 1');
    await test.step('Select Create a Contact (empty) and Create a Note', async () => {
      await usePaired(saleshandyIntegration, CREATE_CONTACT, CREATE_CONTACT_LABELS, CREATE_NOTE);
    });
    const known = await flow.runTrigger(ctx, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, LOG_TIMEOUT_MS);
    });
    await test.step('Check HubSpot: note on the contact with Step 1 and Variant A', async () => {
      const contactId = await findContact(hubspotContacts, row);
      await expectOnRecord(hubspotContacts, '0-1', contactId, ['Note created via Saleshandy', ...flow.noteContains(row, 1)], 'Note');
    });
  });

  // Record (log) an email activity in HubSpot > 4
  test('10 Record (log) an Email Activity in HubSpot: paired with Update a Contact', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Record (log) an email activity in HubSpot > 4');
    await test.step('Select Update a Contact (empty) and Record (log) an Email Activity', async () => {
      await usePaired(saleshandyIntegration, UPDATE_CONTACT, UPDATE_CONTACT_LABELS, RECORD_EMAIL);
    });
    const contactId = await newContact(hubspotContacts, row);
    const known = await flow.runTrigger(ctx, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, LOG_TIMEOUT_MS);
    });
    await test.step('Check HubSpot: email logged on the contact', async () => {
      await expectOnRecord(hubspotContacts, '0-1', contactId, [/Logged email by .+ via Saleshandy/], 'Logged email');
    });
  });
});
