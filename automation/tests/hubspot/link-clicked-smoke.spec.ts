// Production smoke test: Link Clicked in Saleshandy.
// Checklist: notes/production-testing/02-link-clicked.md (one test per check, same
// order, numbered 00 to 10). Data: test-data/hubspot/link-clicked-smoke.csv (+ -deals,
// -companies), rows copied from the staging scenarios of test-cases/hubspot/link-clicked.md,
// replaced with new people before every run.
//
// Reuses the staging flow (src/flows/saleshandy-to-hubspot.ts) and page objects;
// the test bodies follow link-clicked.spec.ts and src/flows/activity-rows.ts row for
// row (names of the source rows are in each comment). Differences from staging:
//  - the account `emailopenedprod` points at production (src/config/environments.ts);
//  - production timing (QA via developer, 2026-10-12): the click registers in
//    Saleshandy in up to 1 to 1.5 minutes and the log shows 1 to 3 minutes after
//    that, so the waits are longer;
//  - the sequence is read from the environment, nothing production is hard-coded.
//
// Needs, before a run (QA / Claude, once):
//   SMOKE_SEQUENCE_ID      id of the production Link Clicked sequence (NOT the Email
//                          Opened one, 973096): Track Link Clicks on, 2 links in the
//                          step 1 body, custom tracking domain, activated, one sender
//   SMOKE_STEP1_SUBJECT    subject of its step 1 email
//   npm run login:saleshandy -- emailopenedprod, and npm run login:hubspot
//   field mapping saved on the production account
// Run: SMOKE_SEQUENCE_ID=... SMOKE_STEP1_SUBJECT="..." TEST_DATA_ONLY=hubspot/link-clicked-smoke \
//        npx playwright test tests/hubspot/link-clicked-smoke.spec.ts --project=chromium --workers=1
import type { Row } from '../../src/data/csv.ts';
import type { HubSpotContactsPage } from '../../src/pages/hubspot/contacts.page.ts';
import type { HubSpotIntegrationPage } from '../../src/pages/saleshandy/hubspot-integration.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';
import { expect, test } from '../../src/fixtures/index.ts';
import { CREATE_COMPANY, CREATE_CONTACT, CREATE_DEAL, CREATE_NOTE, CREATE_TASK, RECORD_EMAIL, UPDATE_COMPANY, UPDATE_CONTACT, UPDATE_DEAL } from '../../src/flows/activity-rows.ts';
import { createFlow, dealConfig, dealUpdateConfig as sharedDealUpdateConfig, expectContact, fullName, mapped, newDealsOf } from '../../src/flows/saleshandy-to-hubspot.ts';

test.use({ account: 'emailopenedprod' });

// Name as staging shows it on Triggers & Activity and in Logs (seen 2026-10-09);
// not yet seen on production.
const TRIGGER = 'Link is Clicked in Saleshandy';
const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '';
const STEP_1_SUBJECT = process.env.SMOKE_STEP1_SUBJECT ?? '';

// Production timing. A click registers in Saleshandy within 1 to 1.5 minutes and
// the log shows 1 to 3 minutes after that, so allow 10 minutes for each.
const CLICK_SETTLE_MS = 30_000;
const CLICK_TIMEOUT_MS = 10 * 60_000;
const CLICK_REFRESH_MS = 15_000;
const LOG_TIMEOUT_MS = 10 * 60_000;
// The Update a Deal log stayed RUNNING for about 7.5 minutes on staging.
const UPDATE_DEAL_LOG_TIMEOUT_MS = 15 * 60_000;
const TEST_TIMEOUT_MS = 40 * 60_000;

// Same values as the staging Link Clicked rows; Extra Configuration cannot be
// cleared once saved (QA, 2026-10-09).
const UPDATE_CONTACT_VALUES = { 'Update Lead Status': 'Connected', 'Update Lead Lifecycle': 'Sales Qualified Lead' };
const CREATE_CONTACT_VALUES = { 'Lead Status': 'Open', 'Lead Lifecycle': 'Marketing Qualified Lead' };
const TASK = { title: 'Follow up from the workflow', type: 'Call', priority: 'Medium', dueDays: 3 };

// Update a Deal with the stage two positions after Prospecting (QA, 2026-10-13).
const dealUpdateConfig = (closingDays: string) => ({
  ...sharedDealUpdateConfig(closingDays),
  'Select Pipeline Stage (when to update)': 'Follow-Up',
});

const flow = createFlow({
  trigger: TRIGGER,
  sequenceId: SEQUENCE_ID,
  csv: 'hubspot/link-clicked-smoke.csv',
  emailSubject: STEP_1_SUBJECT,
  // The production account's Default Schedule can be closed (step 1 stays
  // "Scheduled"); send now from the Emails tab, as the Email Opened smoke does.
  sendStep1Now: true,
  // Header HubSpot shows for the logged email (QA picked it, 2026-10-14).
  loggedEmailContains: () => ['Logged email by Link Clicked via Saleshandy'],
  // AL-4120: after the first click (step 1) the note must show Click Count: 1.
  noteContains: (row, step) => [`Step: ${step}`, 'Variant: A', `Prospect Email: ${row['Email']}`, ...(step === 1 ? ['Click Count: 1'] : [])],
  // Step 1 is sent by Saleshandy; the event is the click in Mailinator.
  fireEvent: async ({ sequence, mailinator }, row, step) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    const before = await sequence.clickedCount(SEQUENCE_ID, fullName(row), step);
    await test.step(`Click link 1 in the step ${step} email (Mailinator)`, async () => {
      await mailinator!.clickFirstLink(row['Email'], STEP_1_SUBJECT, 0);
    });
    await test.step('Wait until Saleshandy counts the click (refresh the Emails tab)', async () => {
      await sequence.page.waitForTimeout(CLICK_SETTLE_MS);
      await expect(async () => {
        expect(await sequence.clickedCount(SEQUENCE_ID, fullName(row), step), 'Clicked').toBeGreaterThanOrEqual(before + 1);
      }, `Clicked count for ${row['Email']} did not reach ${before + 1} (gave up after ${CLICK_TIMEOUT_MS / 1000} seconds)`).toPass({ timeout: CLICK_TIMEOUT_MS, intervals: [CLICK_REFRESH_MS] });
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

// Selects `activity` (with its Extra Configuration `values`) and a companion
// without Extra Configuration (Create a Note, Record (log)), then the page Save.
async function usePaired(integration: HubSpotIntegrationPage, activity: string, values: Record<string, string>, companion: string): Promise<void> {
  await flow.useOnly(integration, activity, values, []);
  // The dialog's own save toast is still up for a moment; wait for it so the next one is the page Save's.
  await expect(integration.savedToast()).toBeHidden({ timeout: 15_000 });
  await integration.selectActivity(TRIGGER, companion);
  await integration.save();
  await expect(integration.savedToast(), 'save confirmation').toBeVisible({ timeout: 30_000 });
}

test.beforeAll(() => {
  if (!SEQUENCE_ID || !STEP_1_SUBJECT) {
    throw new Error('Set SMOKE_SEQUENCE_ID and SMOKE_STEP1_SUBJECT (production Link Clicked sequence id and its step 1 subject) before running the smoke test');
  }
});

// One test per checklist section, in the checklist's order. Each is one run.
test.describe('Production smoke: Link Clicked in Saleshandy', () => {
  // Trigger behavior (baseline) > 2 (staging): Update a Contact selected, click once.
  test('00 Baseline: one click, Clicked count 1, purple icon, one log entry Success', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Trigger behavior (baseline) > 2');
    await test.step('Select only Update a Contact: Connected, Sales Qualified Lead (already saved on this account)', async () => {
      await flow.useOnly(saleshandyIntegration, UPDATE_CONTACT, UPDATE_CONTACT_VALUES, []);
    });
    const known = await flow.runTrigger(ctx, row);
    await test.step('Check the Clicked count is 1', async () => {
      expect(await saleshandySequence.clickedCount(SEQUENCE_ID, fullName(row), 1), 'Clicked').toBe(1);
    });
    // Purple icon: the third stats icon sits in a span-wrapper that gets "purple-14"
    // once a link was clicked (seen 2026-10-14).
    await test.step('Prospects tab: the link clicked icon is purple', async () => {
      await saleshandySequence.goto(`/sequence/${SEQUENCE_ID}/prospects`);
      await saleshandySequence.closeSidebar();
      const page = saleshandySequence.page;
      await page.locator('.sequence-prospect-search-bar-and-filter input').fill(row['Email']);
      await page.keyboard.press('Enter');
      const prospect = page.getByRole('row').filter({ hasText: row['Email'].slice(0, 14) });
      await expect(async () => {
        await page.reload();
        await page.locator('.sequence-prospect-search-bar-and-filter input').fill(row['Email']);
        await page.keyboard.press('Enter');
        await expect(prospect.locator('.span-wrapper.purple-14'), 'purple link clicked icon').toHaveCount(1);
      }).toPass({ timeout: 90_000, intervals: [5_000] });
    });
    await test.step('Check Logs: one new entry, Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, LOG_TIMEOUT_MS);
      const fresh = (await saleshandyIntegration.logEntries(TRIGGER)).filter((e) => !known.has(e.id));
      expect(fresh.length, 'new log entries for this trigger').toBe(1);
    });
  });

  // Create a Contact in HubSpot > 2
  test('01 Create a Contact in HubSpot: contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Create a Contact in HubSpot > 2');
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

  // Update a Contact in HubSpot > 2
  test('02 Update a Contact in HubSpot: contact in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Update a Contact in HubSpot > 2');
    await test.step('Select only Update a Contact: Lead Status Connected, Lifecycle Sales Qualified Lead', async () => {
      await flow.useOnly(saleshandyIntegration, UPDATE_CONTACT, UPDATE_CONTACT_VALUES, []);
    });
    await test.step('Create the contact in HubSpot', async () => {
      await newContact(hubspotContacts, row);
    });
    const known = await flow.runTrigger(ctx, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, LOG_TIMEOUT_MS);
    });
    await test.step('Check the contact in HubSpot: Lead status Connected, Lifecycle stage Sales Qualified Lead', async () => {
      await expectContact(hubspotContacts, row, { 'Lead status': 'Connected', 'Lifecycle stage': 'Sales Qualified Lead' });
    });
  });

  // Create a deal in HubSpot > 1
  test('03 Create a Deal in HubSpot: contact in HubSpot, no deal', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Create a deal in HubSpot > 1');
    await test.step('Select only Create a Deal: Sales Pipeline, Initial Contact, New Business, High, 0 Days', async () => {
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

  // Update a deal in HubSpot > 2 (Extra Configuration filled). AL-4103.
  test('04 Update a Deal in HubSpot: contact has 3 deals, latest updated (AL-4103)', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
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

  // Update a company in HubSpot > 2: AL-4127 (City).
  test('06 Update a Company in HubSpot: 2 companies, latest updated incl. City (AL-4127)', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotCompanies }) => {
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

  // Create a Note in HubSpot > 3: paired with Create a deal. AL-4121, AL-4120.
  test('08 Create a Note in HubSpot: paired with Create a Deal, note on contact and deal, Click Count 1 (AL-4121, AL-4120)', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Create a Note in HubSpot > 3');
    await test.step('Select Create a Deal (Closing Date 1 Day) and Create a Note', async () => {
      await usePaired(saleshandyIntegration, CREATE_DEAL, dealConfig('1'), CREATE_NOTE);
    });
    const known = await flow.runTrigger(ctx, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, LOG_TIMEOUT_MS);
    });
    await test.step('Check HubSpot: note on both the contact and the deal, with Click Count: 1', async () => {
      const contactId = await findContact(hubspotContacts, row);
      const [deal] = await newDealsOf(hubspotContacts, contactId, 1, []);
      const texts = ['Note created via Saleshandy', ...flow.noteContains(row, 1)];
      await expectOnRecord(hubspotContacts, '0-1', contactId, texts, 'Note on the contact');
      await expectOnRecord(hubspotContacts, '0-3', deal.id, texts, 'Note on the deal');
    });
  });

  // Record (log) an email activity in HubSpot > 5: paired with Create a deal. AL-4122.
  test('09 Record (log) an Email Activity in HubSpot: paired with Create a Deal, email on deal and contact (AL-4122)', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Record (log) an email activity in HubSpot > 5');
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

  // Record (log) an email activity in HubSpot > 6: paired with Update a deal, 3 deals. AL-4123.
  test('10 Record (log) an Email Activity in HubSpot: paired with Update a Deal, contact has 3 deals (AL-4123)', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Record (log) an email activity in HubSpot > 6');
    await test.step('Select Update a Deal (Follow-Up, 0 Days) and Record (log) an Email Activity', async () => {
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
        expect(await hubspotDeals.summary(dealIds[2]), 'latest created deal').toMatchObject({ pipeline: 'Sales Pipeline', stage: 'Follow-Up', dealType: 'New Business', priority: 'High' });
      }).toPass({ timeout: 90_000 });
    });
    // QA, 2026-10-13: Update a deal + Record email logs the email on the latest
    // deal only; the contact gets nothing. The card must not say "Unknown Contact".
    await test.step('Check HubSpot: email logged on the latest deal only, not "Unknown Contact"', async () => {
      const contactId = await findContact(hubspotContacts, row);
      await expectOnRecord(hubspotContacts, '0-3', dealIds[2], flow.loggedEmailContains(row, 1), 'Logged email on the deal');
      expect(await hubspotContacts.activitiesText('0-3', dealIds[2]), 'deal Activities').not.toContain('Unknown Contact');
      for (const [i, id] of dealIds.slice(0, 2).entries()) {
        expect(await hubspotContacts.activitiesText('0-3', id), `older deal ${i + 1} Activities`).not.toContain(flow.loggedEmailContains(row, 1)[0]);
      }
      expect(await hubspotContacts.activitiesText('0-1', contactId), 'contact Activities').not.toContain(flow.loggedEmailContains(row, 1)[0]);
    });
  });
});
