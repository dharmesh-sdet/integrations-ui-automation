// Production smoke test: Reply is Received in Saleshandy.
// Checklist: notes/production-testing/05-reply-received.md (one test per check, same
// order, numbered 00 to 10). Data: test-data/hubspot/reply-received-smoke.csv (+ -deals,
// -companies), rows copied from the staging scenarios of test-cases/hubspot/reply-received.md,
// replaced with new people before every run.
//
// Reuses the staging flow (src/flows/saleshandy-to-hubspot.ts) and page objects;
// the test bodies follow link-clicked-smoke.spec.ts and email-bounced-smoke.spec.ts.
// Differences:
//  - the event is "Mark as replied" on the step 1 row of the Emails tab (QA,
//    2026-10-09); no Mailinator click, no reply email, so no extra send is used
//    (the sender allows 15 a day in total; this spec sends 11);
//  - a second reply is "Mark as replied" again on the same step 1 email (no step 2
//    row exists after a reply);
//  - the account `emailopenedprod` points at production (src/config/environments.ts);
//  - the sequence is read from the environment, nothing production is hard-coded
//    except the default sequence id created on 2026-10-15.
//
// Needs, before a run (QA, once):
//   SMOKE_SEQUENCE_ID      id of the production Reply Received sequence (default 974166,
//                          "HubSpot Reply Received Smoke": 2 steps, Active, one sender)
//   npm run login:saleshandy -- emailopenedprod, and npm run login:hubspot
//   field mapping saved on the production account
// Runs next to another smoke on the same account (QA, 2026-10-15): other triggers
// are left alone, the 15 emails a day on the sender are shared.
// Run: TEST_DATA_ONLY=hubspot/reply-received-smoke REPORTS_DIR=reports/replysmoke REPORT_OPEN=never \
//        npx playwright test tests/hubspot/reply-received-smoke.spec.ts --project=chromium --workers=1
import type { Row } from '../../src/data/csv.ts';
import type { HubSpotContactsPage } from '../../src/pages/hubspot/contacts.page.ts';
import { HubSpotIntegrationPage } from '../../src/pages/saleshandy/hubspot-integration.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';
import { expect, test } from '../../src/fixtures/index.ts';
import { CREATE_COMPANY, CREATE_CONTACT, CREATE_DEAL, CREATE_NOTE, CREATE_TASK, RECORD_EMAIL, UPDATE_COMPANY, UPDATE_CONTACT, UPDATE_DEAL } from '../../src/flows/activity-rows.ts';
import { createFlow, daysFromToday, dealConfig, dealUpdateConfig as sharedDealUpdateConfig, expectContact, fullName, mapped, newDealsOf } from '../../src/flows/saleshandy-to-hubspot.ts';

test.use({ account: 'emailopenedprod' });

// Parallel run on the shared production account (QA, 2026-10-15, Option C): this
// spec only turns its own trigger on and leaves every other trigger as it is, as
// the Company Created smoke does. The shared flow's startClean calls enableOnly;
// in this spec file only, that call becomes enable() (no shared file edited).
HubSpotIntegrationPage.prototype.enableOnly = function (this: HubSpotIntegrationPage, name: string) {
  return this.enable(name);
};

// Name as staging shows it on Triggers & Activity and in Logs (seen 2026-10-09);
// not yet seen on production.
const TRIGGER = 'Reply is Received in Saleshandy';
const SEQUENCE_ID = process.env.SMOKE_SEQUENCE_ID ?? '974166';
const STEP_1_SUBJECT = process.env.SMOKE_STEP1_SUBJECT ?? 'Save cost & achieve more!';
const PRODUCTION_HOST = (process.env.PROD_URL ?? 'https://my.saleshandy.com').replace(/\/+$/, '');
const STAGING_HOST = 'pyxis.lifeisgoodforlearner.com';

// Production timing: the log shows within minutes of the reply, so allow 10
// minutes (15 for Update a Deal, which stayed RUNNING for about 7.5 minutes on staging).
const LOG_TIMEOUT_MS = 10 * 60_000;
const UPDATE_DEAL_LOG_TIMEOUT_MS = 15 * 60_000;

// Same values as the staging Reply rows; Extra Configuration cannot be cleared once
// saved (QA, 2026-10-09).
const UPDATE_CONTACT_VALUES = { 'Update Lead Status': 'Connected', 'Update Lead Lifecycle': 'Sales Qualified Lead' };
const CREATE_CONTACT_VALUES = { 'Lead Status': 'Open', 'Lead Lifecycle': 'Marketing Qualified Lead' };
const TASK = { title: 'Follow up from the workflow', type: 'Call', priority: 'Medium', dueDays: 3 };

// Update a Deal with the stage two positions after Prospecting (QA, 2026-10-13),
// as the Link Clicked smoke does on this account.
const dealUpdateConfig = (closingDays: string) => ({
  ...sharedDealUpdateConfig(closingDays),
  'Select Pipeline Stage (when to update)': 'Follow-Up',
});

const flow = createFlow({
  trigger: TRIGGER,
  sequenceId: SEQUENCE_ID,
  csv: 'hubspot/reply-received-smoke.csv',
  emailSubject: STEP_1_SUBJECT,
  // The production account's Default Schedule can be closed (step 1 stays
  // "Scheduled"); send now from the Emails tab, as the other smoke specs do.
  // The card reads "Logged email by <integration name> via Saleshandy"; only the
  // common prefix is matched (as in the Link Clicked smoke).
  loggedEmailContains: () => ['Logged email by'],
  // A reply has no reply text, so the note is checked for presence only (checklist).
  noteContains: () => [],
  // The event is Mark as replied on the step 1 email (also for a second reply).
  fireEvent: async ({ sequence }, row) => {
    await test.step('Mark the step 1 email as replied', async () => {
      await sequence.markAsReplied(SEQUENCE_ID, fullName(row));
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
  if (!SEQUENCE_ID) {
    throw new Error('Set SMOKE_SEQUENCE_ID (production Reply Received sequence id) before running the smoke test');
  }
});

// One test per checklist section, in the checklist's order. Each is one run.
test.describe('Production smoke: Reply is Received in Saleshandy', () => {
  // Baseline: Create a Contact selected, one reply.
  test('00 Baseline: one reply, Emails tab counter 1 Replied, Replied badge, one log entry Success', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Trigger behavior (baseline) > 1');
    await test.step('Select only Create a Contact: Lead Status Open, Lead Lifecycle Marketing Qualified Lead (already saved on this account)', async () => {
      await flow.useOnly(saleshandyIntegration, CREATE_CONTACT, CREATE_CONTACT_VALUES, []);
    });
    const known = await flow.runTrigger(ctx, row);
    await test.step('Emails tab: the counter reads 1(100.00%) Replied', async () => {
      await saleshandySequence.openEmails(SEQUENCE_ID);
      await expect(saleshandySequence.page.getByRole('button', { name: /1\(100\.00%\)\s*Replied/ }), 'Replied counter').toBeVisible({ timeout: 60_000 });
    });
    await test.step('Prospects tab: the prospect shows the Replied badge', async () => {
      await saleshandySequence.goto(`/sequence/${SEQUENCE_ID}/prospects`);
      await saleshandySequence.closeSidebar();
      const page = saleshandySequence.page;
      const prospect = page.getByRole('row').filter({ hasText: row['Email'].slice(0, 14) });
      await expect(async () => {
        await page.reload();
        await page.locator('.sequence-prospect-search-bar-and-filter input').fill(row['Email']);
        await page.keyboard.press('Enter');
        await expect(prospect.getByText('Replied', { exact: true }), 'Replied badge').toBeVisible();
      }).toPass({ timeout: 90_000, intervals: [5_000] });
    });
    await test.step('Check Logs: one new entry, Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, LOG_TIMEOUT_MS);
      const fresh = (await saleshandyIntegration.logEntries(TRIGGER)).filter((e) => !known.has(e.id));
      expect(fresh.length, 'new log entries for this trigger').toBe(1);
    });
    await test.step('Check the contact in HubSpot: created with the mapped fields', async () => {
      await expectContact(hubspotContacts, row, mapped(row));
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
  test('02 Update a Contact in HubSpot: details changed', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Update a Contact in HubSpot > 2');
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

  // Update a deal in HubSpot > 2 (Extra Configuration filled), then the second reply (AL-4119).
  test('04 Update a Deal in HubSpot: contact has 3 deals, latest updated, second reply updates it again (AL-4119)', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
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
    // Two Update a Deal logs, up to 15 minutes each, plus the send.
    test.setTimeout(45 * 60_000);
    await test.step('First reply: new log entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
    });
    await test.step('First reply: the latest created deal has the configured values', async () => {
      await expect(async () => {
        expect(await hubspotDeals.summary(dealIds[2]), 'latest created deal').toMatchObject({ pipeline: 'Sales Pipeline', stage: 'Follow-Up', dealType: 'New Business', priority: 'High' });
      }).toPass({ timeout: 90_000 });
    });
    await test.step('First reply: the 2 older deals are unchanged', async () => {
      for (const [i, id] of dealIds.slice(0, 2).entries()) {
        expect(await hubspotDeals.summary(id), `deal ${i + 1}`).toEqual(before[i]);
      }
    });
    const knownAfterFirst = new Set((await saleshandyIntegration.logEntries(TRIGGER)).map((e) => e.id));
    await test.step('Change Extra Configuration: Closing Date 51 Days', async () => {
      await flow.useOnly(saleshandyIntegration, UPDATE_DEAL, dealUpdateConfig('51'), []);
    });
    await test.step('Mark the same step 1 email as replied again', async () => {
      await saleshandySequence.markAsReplied(SEQUENCE_ID, fullName(row));
    });
    await test.step('Second reply: new log entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, knownAfterFirst, UPDATE_DEAL_LOG_TIMEOUT_MS);
    });
    await test.step('Second reply (AL-4119): the latest deal shows the close date 51 days from today', async () => {
      await expect(async () => {
        expect((await hubspotDeals.summary(dealIds[2])).closeDate, 'Close Date').toBe(daysFromToday(51));
      }).toPass({ timeout: 90_000 });
    });
    await test.step('Second reply: the 2 older deals are still unchanged', async () => {
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

  // Create a Note in HubSpot > 3: paired with Create a deal. Presence only; AL-4118 link host.
  test('08 Create a Note in HubSpot: paired with Create a Deal, note on contact and deal, Sequence link on the production host (AL-4118)', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    const row = flow.rowFor('Create a Note in HubSpot > 3');
    await test.step('Select Create a Deal (Closing Date 1 Day) and Create a Note', async () => {
      await usePaired(saleshandyIntegration, CREATE_DEAL, dealConfig('1'), CREATE_NOTE);
    });
    const known = await flow.runTrigger(ctx, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, LOG_TIMEOUT_MS);
    });
    let contactId = '';
    await test.step('Check HubSpot: a note on both the contact and the deal', async () => {
      contactId = await findContact(hubspotContacts, row);
      const [deal] = await newDealsOf(hubspotContacts, contactId, 1, []);
      await expectOnRecord(hubspotContacts, '0-1', contactId, ['Note created via Saleshandy'], 'Note on the contact');
      await expectOnRecord(hubspotContacts, '0-3', deal.id, ['Note created via Saleshandy'], 'Note on the deal');
    });
    // AL-4118 (QA, 2026-10-15): the production issue. The note's Sequence link must
    // use the production host; a staging host means the ticket is reopened.
    await test.step(`AL-4118: the note's Sequence link uses ${PRODUCTION_HOST}, not the staging host`, async () => {
      const text = await hubspotContacts.activitiesText('0-1', contactId);
      expect(text, `AL-4118: staging host ${STAGING_HOST} in the note's Sequence link (reopen AL-4118)`).not.toContain(STAGING_HOST);
      expect(text, `AL-4118: note's Sequence link on ${PRODUCTION_HOST}`).toContain(`${PRODUCTION_HOST}/sequence/${SEQUENCE_ID}`);
    });
  });

  // Record (log) an email activity in HubSpot > 5: paired with Create a deal.
  test('09 Record (log) an Email Activity in HubSpot: paired with Create a Deal, email on deal and contact', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
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

  // Record (log) an email activity in HubSpot > 6: paired with Update a deal, 3 deals. AL-4129.
  test('10 Record (log) an Email Activity in HubSpot: paired with Update a Deal, contact has 3 deals, no "Unknown Contact" (AL-4129)', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
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
    // QA, 2026-10-15: Update a deal + Record email logs the email on the latest
    // deal and the contact, not on the two older deals. The card must not say
    // "Unknown Contact" (AL-4129, fixed).
    await test.step('Check HubSpot: email logged on the latest deal and the contact, not "Unknown Contact"', async () => {
      const contactId = await findContact(hubspotContacts, row);
      await expectOnRecord(hubspotContacts, '0-3', dealIds[2], flow.loggedEmailContains(row, 1), 'Logged email on the deal');
      expect(await hubspotContacts.activitiesText('0-3', dealIds[2]), 'deal Activities').not.toContain('Unknown Contact');
      for (const [i, id] of dealIds.slice(0, 2).entries()) {
        expect(await hubspotContacts.activitiesText('0-3', id), `older deal ${i + 1} Activities`).not.toContain(flow.loggedEmailContains(row, 1)[0]);
      }
      await expectOnRecord(hubspotContacts, '0-1', contactId, flow.loggedEmailContains(row, 1), 'Logged email on the contact');
    });
  });
});
