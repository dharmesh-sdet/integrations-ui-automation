// Scenarios: test-cases/hubspot/email-opened.md (Regression, Phase 1: Extra
// Configuration empty). Data: test-data/hubspot/email-opened.csv, one row per
// scenario (Scenario column), generated from the Email Bounced rows (same Phase 1
// list). Used rows are replaced by new people before every run
// (src/data/global-setup.ts).
// Shared steps live in src/flows/saleshandy-to-hubspot.ts; this file adds the
// trigger event (open the email in Mailinator) and the Phase 1 rows. Phase 2
// (Extra Configuration filled) is not written here: saved values cannot be
// cleared again, so it only runs after Phase 1 is stable. Staging only: the
// open registers after about 10 s there (production: 60 s and 1 to 3 minutes).
import type { Row } from '../../src/data/csv.ts';
import type { HubSpotCompaniesPage } from '../../src/pages/hubspot/companies.page.ts';
import type { HubSpotContactsPage } from '../../src/pages/hubspot/contacts.page.ts';
import type { HubSpotIntegrationPage } from '../../src/pages/saleshandy/hubspot-integration.page.ts';
import type { SaleshandyCrmPage } from '../../src/pages/saleshandy/crm.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';
import { expect, test } from '../../src/fixtures/index.ts';
import { CREATE_COMPANY, CREATE_CONTACT, CREATE_DEAL, CREATE_NOTE, CREATE_TASK, RECORD_EMAIL, UPDATE_COMPANY, UPDATE_CONTACT, UPDATE_DEAL } from '../../src/flows/activity-rows.ts';
import { createFlow, expectContact, fullName, mapped, newDealsOf } from '../../src/flows/saleshandy-to-hubspot.ts';

test.use({ account: 'emailopened' });

// Name on Triggers & Activity and in Logs (seen 2026-10-12).
const TRIGGER = 'Sequence Email is Opened in Saleshandy';

// Sequence "HubSpot Email Opened QA" on the emailopened account (2 steps, Track
// email opens on, custom tracking domain cd1.shengage02.com), activated 2026-10-13.
const SEQUENCE_ID = '196462';
const STEP_1_SUBJECT = 'Save cost & achieve more!';
// Step 2 is a same-thread follow-up, listed as "Re: ..." in Mailinator.
const STEP_2_SUBJECT = new RegExp(`^(Re: )?${STEP_1_SUBJECT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
// Staging: an open registers about 10 s after it is made (QA, 2026-10-12).
const OPEN_TIMEOUT_MS = 3 * 60_000;
const OPEN_SETTLE_MS = 10_000;
const OPEN_REFRESH_MS = 5_000;

const flow = createFlow({
  trigger: TRIGGER,
  sequenceId: SEQUENCE_ID,
  csv: 'hubspot/email-opened.csv',
  emailSubject: STEP_1_SUBJECT,
  // HubSpot's Activities tab shows a logged email as "Logged email with <name>
  // created via Saleshandy" plus the body preview, not the subject (seen
  // 2026-10-13), so the subject cannot be searched for.
  loggedEmailContains: (row) => [`Logged email with ${fullName(row)}`],
  step2Events: true,
  // Step 1 is sent by Saleshandy by itself (one prospect at a time). The event
  // is the open in Mailinator; step 2 needs Send now first (days away). Calling
  // it again for the same email opens it again, which is the second open.
  fireEvent: async ({ sequence, mailinator }, row, step) => {
    if (step > 1) {
      await test.step(`Send now on step ${step}`, async () => {
        await sequence.ensureSent(SEQUENCE_ID, fullName(row), step);
      });
    }
    const before = await sequence.openedCount(SEQUENCE_ID, fullName(row), step);
    await test.step(`Open the step ${step} email (Mailinator)`, async () => {
      await mailinator!.openEmail(row['Email'], step > 1 ? STEP_2_SUBJECT : STEP_1_SUBJECT);
    });
    await test.step('Wait until Saleshandy counts the open (refresh the Emails tab)', async () => {
      await sequence.page.waitForTimeout(OPEN_SETTLE_MS);
      await expect(async () => {
        expect(await sequence.openedCount(SEQUENCE_ID, fullName(row), step), 'Opened').toBeGreaterThanOrEqual(before + 1);
      }, `Opened count for ${row['Email']} did not reach ${before + 1} (gave up after ${OPEN_TIMEOUT_MS / 1000} seconds)`).toPass({ timeout: OPEN_TIMEOUT_MS, intervals: [OPEN_REFRESH_MS] });
    });
  },
});

// Another trigger's name on Triggers & Activity (seen 2026-10-12).
const OTHER_TRIGGER = 'Email Sent from Saleshandy';

// Create a Deal with nothing chosen in Extra Configuration (the dropdown labels
// are checked for values saved earlier).
const CREATE_DEAL_LABELS = ['Select Pipeline (when to create)', 'Select Pipeline Stage (when to create)', 'Deal Type (while creating)', 'Deal Priority (while creating)'];

// Update a Deal with nothing chosen in Extra Configuration.
const UPDATE_DEAL_LABELS = ['Select Pipeline (when to update)', 'Select Pipeline Stage (when to update)', 'Deal Type (while updating)', 'Deal Priority (while updating)'];
// Update a Deal logs stay RUNNING for about 7.5 minutes (seen 2026-10-12).
const UPDATE_DEAL_LOG_TIMEOUT_MS = 12 * 60_000;

// Company helpers (same steps as the shared rows in src/flows/activity-rows.ts,
// which keeps its own copies private).
async function findContact(contacts: HubSpotContactsPage, row: Row): Promise<string> {
  let id = '';
  await untilPasses(`Contact ${row['Email']} not found in HubSpot`, async () => {
    id = await contacts.findContactId(row['Email'], fullName(row));
  });
  return id;
}

async function expectCompanies(contacts: HubSpotContactsPage, contactId: string, count: number) {
  let records: { id: string; name: string }[] = [];
  await untilPasses('Company not on the contact in HubSpot', async () => {
    const list = await contacts.associations(contactId, 'companies');
    expect(list.count, 'companies on the contact').toBe(count);
    records = list.records;
  });
  return records;
}

async function expectCompanyValues(companies: HubSpotCompaniesPage, companyId: string, values: Record<string, string>): Promise<void> {
  await untilPasses(`Company ${companyId} does not show the new values`, async () => {
    for (const [label, value] of Object.entries(values)) {
      expect(await companies.property(companyId, label), `Company ${label}`).toBe(value);
    }
  });
}

// The contact, then its companies from the -companies CSV in file order, each
// associated to the contact (the last one is the latest associated).
async function contactWithCompanies(companiesCsv: Row[], row: Row, contacts: HubSpotContactsPage, companies: HubSpotCompaniesPage): Promise<string[]> {
  await contacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });
  const ids: string[] = [];
  for (const c of companiesCsv.filter((x) => x['Contact Email'] === row['Email'])) {
    const id = await companies.createCompany({ domain: c['Company Domain'], name: c['Company Name'] });
    await companies.associateContacts(id, [{ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'] }]);
    ids.push(id);
  }
  return ids;
}

async function changeProspect(crm: SaleshandyCrmPage, row: Row, values: Record<string, string>): Promise<void> {
  await crm.search(row['Email']);
  await crm.openProspect(fullName(row));
  for (const [label, value] of Object.entries(values)) await crm.editField(label, value);
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

// Waits until the record's Activities tab shows all texts (reloaded on each try).
async function expectOnRecord(contacts: HubSpotContactsPage, id: string, texts: string[], what: string): Promise<void> {
  await untilPasses(`${what} not found on the HubSpot contact ${id}`, async () => {
    const text = await contacts.activitiesText('0-1', id);
    for (const t of texts) expect(text, `${what}: "${t}"`).toContain(t);
  });
}

// Create a Task rows 1 and 2 need an EMPTY Extra Configuration dialog. Saved
// values can never be cleared and Phase 2 saves them, so on a used account the
// dialog opens pre-filled (seen 2026-10-14: "Follow up from the workflow", Call,
// Medium, 3 Days). Same rule as useOnly: skip, the row needs a new account.
async function skipIfTaskConfigSaved(integration: HubSpotIntegrationPage): Promise<void> {
  const title = await integration.extraConfiguration().locator('.mb-3').nth(0).locator('input').inputValue();
  if (title.trim() !== '') {
    await integration.cancelExtraConfiguration();
    test.skip(true, `Create a Task already has saved Extra Configuration on this account (Task Title: ${title.trim()}); this row needs a new account`);
  }
}

const CREATE_CONTACT_LABELS = ['Lead Status', 'Lead Lifecycle'];
const UPDATE_CONTACT_LABELS = ['Update Lead Status', 'Update Lead Lifecycle'];

test.describe('Sequence Email is Opened in Saleshandy', () => {

  test('Trigger behavior (baseline) > 1: Trigger off before the test', async ({ saleshandyIntegration }) => {
    await test.step(`Turn other triggers off and turn on "${TRIGGER}"`, async () => {
      await flow.startClean(saleshandyIntegration);
    });
    await test.step(`Select "${RECORD_EMAIL}" and Save`, async () => {
      await saleshandyIntegration.selectActivity(TRIGGER, RECORD_EMAIL);
      await saleshandyIntegration.save();
      await expect(saleshandyIntegration.savedToast(), 'save confirmation').toBeVisible();
    });
  });

  // Baseline 2 and 3 are one prospect: the first open, then the same email
  // opened again.
  test('Trigger behavior (baseline) > 2: Prospect received the step 1 email, first open', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator }) => {
    const row = flow.rowFor('Trigger behavior (baseline) > 2');
    await test.step('Select only Create a Contact, nothing chosen in Extra Configuration', async () => {
      await flow.useOnly(saleshandyIntegration, CREATE_CONTACT, {}, CREATE_CONTACT_LABELS);
    });
    // runTrigger adds the prospect, waits for Sent, opens the email and waits
    // until the Opened count is up.
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await test.step('Check the Opened count is 1', async () => {
      expect(await saleshandySequence.openedCount(SEQUENCE_ID, fullName(row), 1), 'Opened').toBe(1);
    });
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
  });

  // Self-contained (QA, 2026-10-14): 3 and 4 each have their own prospect (CSV
  // rows 3 and 4), their own trigger setup and their own first open, so a
  // skip or failure in baseline 2 does not take them down.
  test('Trigger behavior (baseline) > 3: Second open of the same email (own first open)', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator }) => {
    const row = flow.rowFor('Trigger behavior (baseline) > 3');
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    test.setTimeout(20 * 60_000);
    await test.step('Select only Create a Contact, nothing chosen in Extra Configuration', async () => {
      await flow.useOnly(saleshandyIntegration, CREATE_CONTACT, {}, CREATE_CONTACT_LABELS);
    });
    const first = await flow.runTrigger(ctx, row);
    await test.step('Check the Opened count is 1 and the first open is Success', async () => {
      expect(await saleshandySequence.openedCount(SEQUENCE_ID, fullName(row), 1), 'Opened').toBe(1);
      await flow.expectNewLogsSuccess(saleshandyIntegration, first);
    });
    const known = await flow.knownLogIds(saleshandyIntegration);
    await test.step('Open the same email again', async () => {
      await flow.fireEvent(ctx, row, 1);
    });
    await test.step('Check the Opened count is 2', async () => {
      expect(await saleshandySequence.openedCount(SEQUENCE_ID, fullName(row), 1), 'Opened').toBe(2);
    });
    await test.step('Check Logs: a new entry is Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
  });

  test('Trigger behavior (baseline) > 4: Prospect in step 2, step 2 email opened (own first open)', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator }) => {
    const row = flow.rowFor('Trigger behavior (baseline) > 4');
    const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
    test.setTimeout(30 * 60_000);
    await test.step('Select only Create a Contact, nothing chosen in Extra Configuration', async () => {
      await flow.useOnly(saleshandyIntegration, CREATE_CONTACT, {}, CREATE_CONTACT_LABELS);
    });
    const first = await flow.runTrigger(ctx, row);
    await test.step('Check the step 1 open is Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, first);
    });
    const known = await flow.knownLogIds(saleshandyIntegration);
    await test.step('Move the prospect from step 1 to step 2 (Prospects tab > Add to Sequence)', async () => {
      await saleshandySequence.moveToStep(SEQUENCE_ID, row['Email'], 2);
    });
    await test.step('Send now on step 2 and open its email', async () => {
      await flow.fireEvent(ctx, row, 2);
    });
    await test.step('Check Logs: a new entry is Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
  });

  test('Trigger behavior (baseline) > 5: Only another trigger enabled', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator }) => {
    const row = flow.rowFor('Trigger behavior (baseline) > 5');
    await test.step(`Turn "${TRIGGER}" off, turn "${OTHER_TRIGGER}" on with ${RECORD_EMAIL} and Save`, async () => {
      await saleshandyIntegration.openTriggers();
      await saleshandyIntegration.enableOnly(OTHER_TRIGGER);
      await saleshandyIntegration.selectActivity(OTHER_TRIGGER, RECORD_EMAIL);
      await saleshandyIntegration.save();
      await expect(saleshandyIntegration.savedToast(), 'save confirmation').toBeVisible();
    });
    // runTrigger waits until the Opened count is up, so the open did register.
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await test.step('Check Logs: no new entry for the opened workflow after 60 seconds', async () => {
      await saleshandyIntegration.page.waitForTimeout(60_000);
      await saleshandyIntegration.openLogs();
      await saleshandyIntegration.refreshLogs();
      const fresh = (await saleshandyIntegration.logEntries(TRIGGER)).filter((e) => !known.has(e.id));
      expect(fresh, 'new log entries for the opened workflow').toEqual([]);
    });
  });

  test('Create a Contact in HubSpot > 1: Contact not in HubSpot, Extra Configuration empty', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Create a Contact in HubSpot > 1');
    await test.step('Select only Create a Contact, nothing chosen in Extra Configuration', async () => {
      await flow.useOnly(saleshandyIntegration, CREATE_CONTACT, {}, ['Lead Status', 'Lead Lifecycle']);
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
    await test.step('Check the contact in HubSpot has the mapped fields', async () => {
      // Lifecycle Stage and Lead Status are set by HubSpot itself (scenario
      // file), so only the mapped fields are asserted.
      await expectContact(hubspotContacts, row, mapped(row));
    });
  });

  test('Create a Contact in HubSpot > 2: Contact already in HubSpot, prospect details changed', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Create a Contact in HubSpot > 2');
    await test.step('Select only Create a Contact, nothing chosen in Extra Configuration', async () => {
      await flow.useOnly(saleshandyIntegration, CREATE_CONTACT, {}, ['Lead Status', 'Lead Lifecycle']);
    });
    await test.step('Create the contact in HubSpot', async () => {
      await hubspotContacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row, async () => {
      await test.step('Change Job Title and City in Saleshandy', async () => {
        await saleshandyCrm.search(row['Email']);
        await saleshandyCrm.openProspect(fullName(row));
        await saleshandyCrm.editField('Job Title', row['Updated Job Title']);
        await saleshandyCrm.editField('City', row['Updated City']);
      });
    });
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
    await test.step('Check the contact in HubSpot shows the new values', async () => {
      await expectContact(hubspotContacts, row, { 'Job title': row['Updated Job Title'], City: row['Updated City'] });
    });
  });

  test('Update a Contact in HubSpot > 1: Contact in HubSpot, prospect details changed', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Update a Contact in HubSpot > 1');
    await test.step('Select only Update a Contact, nothing chosen in Extra Configuration', async () => {
      await flow.useOnly(saleshandyIntegration, UPDATE_CONTACT, {}, ['Update Lead Status', 'Update Lead Lifecycle']);
    });
    await test.step('Create the contact in HubSpot', async () => {
      await hubspotContacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row, async () => {
      await test.step('Change Job Title and City in Saleshandy', async () => {
        await saleshandyCrm.search(row['Email']);
        await saleshandyCrm.openProspect(fullName(row));
        await saleshandyCrm.editField('Job Title', row['Updated Job Title']);
        await saleshandyCrm.editField('City', row['Updated City']);
      });
    });
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
    await test.step('Check the contact in HubSpot shows the new values', async () => {
      await expectContact(hubspotContacts, row, { 'Job title': row['Updated Job Title'], City: row['Updated City'] });
    });
  });

  test('Update a Contact in HubSpot > 2: Contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Update a Contact in HubSpot > 2');
    await test.step('Select only Update a Contact, nothing chosen in Extra Configuration', async () => {
      await flow.useOnly(saleshandyIntegration, UPDATE_CONTACT, {}, ['Update Lead Status', 'Update Lead Lifecycle']);
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
    await test.step('Check HubSpot: no contact was created', async () => {
      expect(await hubspotContacts.contactExists(row['Email'], fullName(row)), `contact ${row['Email']} in HubSpot`).toBe(false);
    });
  });

  test('Update a Contact in HubSpot > 3: Contact in HubSpot, prospect details not changed', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Update a Contact in HubSpot > 3');
    await test.step('Select only Update a Contact, nothing chosen in Extra Configuration', async () => {
      await flow.useOnly(saleshandyIntegration, UPDATE_CONTACT, {}, ['Update Lead Status', 'Update Lead Lifecycle']);
    });
    // QA (2026-10-12): "not changed" means HubSpot already holds the prospect's
    // values, so the contact gets the prospect's Job title and City first.
    await test.step('Create the contact in HubSpot with the prospect\'s Job title and City', async () => {
      const contactId = await hubspotContacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });
      await hubspotContacts.updateProperties(contactId, { City: row['City'] });
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await test.step('Wait until the new log entries have finished', async () => {
      const statuses = await flow.newLogsFinished(saleshandyIntegration, known);
      test.info().annotations.push({ type: 'Log status', description: statuses.join(', ') });
    });
    await test.step('Check the contact in HubSpot keeps the same Job title and City', async () => {
      await expectContact(hubspotContacts, row, { 'Job title': row['Job Title'], City: row['City'] });
    });
  });
  // Create a deal, Extra Configuration empty. QA (2026-10-12): HubSpot fills in
  // Pipeline, Stage, Deal Type and Priority itself (recorded, not asserted);
  // Amount is empty unless the prospect has a Deal Value; no close date.
  test('Create a deal in HubSpot > 1: Contact in HubSpot, no deal', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
    const row = flow.rowFor('Create a deal in HubSpot > 1');
    await test.step('Select only Create a Deal, nothing chosen in Extra Configuration', async () => {
      await flow.useOnly(saleshandyIntegration, CREATE_DEAL, {}, CREATE_DEAL_LABELS);
    });
    let contactId = '';
    await test.step('Create the contact in HubSpot', async () => {
      contactId = await hubspotContacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
    await test.step('Check HubSpot: one deal on the contact, Amount and close date empty', async () => {
      const [deal] = await newDealsOf(hubspotContacts, contactId, 1, []);
      const summary = await hubspotDeals.summary(deal.id);
      test.info().annotations.push({ type: 'Deal filled by HubSpot', description: JSON.stringify(summary) });
      expect(summary, 'deal').toMatchObject({ amount: '--', closeDate: '--' });
    });
  });

  test('Create a deal in HubSpot > 2: Contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
    const row = flow.rowFor('Create a deal in HubSpot > 2');
    await test.step('Select only Create a Deal, nothing chosen in Extra Configuration', async () => {
      await flow.useOnly(saleshandyIntegration, CREATE_DEAL, {}, CREATE_DEAL_LABELS);
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
    await test.step('Check HubSpot: contact created with one associated deal, Amount and close date empty', async () => {
      let contactId = '';
      await untilPasses(`Contact ${row['Email']} not found in HubSpot`, async () => {
        contactId = await hubspotContacts.findContactId(row['Email'], fullName(row));
      });
      const [deal] = await newDealsOf(hubspotContacts, contactId, 1, []);
      expect(await hubspotDeals.summary(deal.id), 'deal').toMatchObject({ amount: '--', closeDate: '--' });
    });
  });

  test('Create a deal in HubSpot > 3: Contact already has 1 deal', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
    const row = flow.rowFor('Create a deal in HubSpot > 3');
    const existing = flow.deals.filter((d) => d['Contact Email'] === row['Email']);
    await test.step('Select only Create a Deal, nothing chosen in Extra Configuration', async () => {
      await flow.useOnly(saleshandyIntegration, CREATE_DEAL, {}, CREATE_DEAL_LABELS);
    });
    let contactId = '';
    await test.step(`Create the contact in HubSpot with ${existing.length} deal`, async () => {
      contactId = await hubspotContacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });
      for (const d of existing) await hubspotDeals.createDealForContact(contactId, { name: d['Deal Name'], amount: d['Amount'] });
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
    await test.step('Check HubSpot: the contact now has one more deal, Amount and close date empty on it', async () => {
      const fresh = await newDealsOf(hubspotContacts, contactId, existing.length + 1, existing.map((d) => d['Deal Name']));
      expect(fresh.length, 'new deals').toBe(1);
      expect(await hubspotDeals.summary(fresh[0].id), 'new deal').toMatchObject({ amount: '--', closeDate: '--' });
    });
  });

  test('Create a deal in HubSpot > 4: Prospect has a Deal Value', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
    const row = flow.rowFor('Create a deal in HubSpot > 4');
    await test.step('Select only Create a Deal, nothing chosen in Extra Configuration', async () => {
      await flow.useOnly(saleshandyIntegration, CREATE_DEAL, {}, CREATE_DEAL_LABELS);
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
    await test.step(`Check HubSpot: Amount = Deal Value ${row['Deal Value']}, close date empty`, async () => {
      let contactId = '';
      await untilPasses(`Contact ${row['Email']} not found in HubSpot`, async () => {
        contactId = await hubspotContacts.findContactId(row['Email'], fullName(row));
      });
      const [deal] = await newDealsOf(hubspotContacts, contactId, 1, []);
      await expect(async () => {
        const summary = await hubspotDeals.summary(deal.id);
        expect(summary.amount.replace(/[^0-9.]/g, ''), 'Amount').toMatch(new RegExp(`^${row['Deal Value']}(\\.0+)?$`));
        expect(summary.closeDate, 'Close Date').toBe('--');
      }).toPass({ timeout: 60_000 });
    });
  });
  // Update a deal, Extra Configuration empty. Rows 1 and 2 are "Open: run once,
  // QA decides" (scenario file): the log status and the deal before and after
  // are recorded as annotations, nothing is asserted about the values.
  for (const [n, count] of [[1, 1], [2, 3]] as const) {
    test(`Update a deal in HubSpot > ${n}: Contact has ${count} deal${count > 1 ? 's' : ''}, Extra Configuration empty (open)`, async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
      const row = flow.rowFor(`Update a deal in HubSpot > ${n}`);
      const existing = flow.deals.filter((d) => d['Contact Email'] === row['Email']);
      await test.step('Select only Update a Deal, nothing chosen in Extra Configuration', async () => {
        await flow.useOnly(saleshandyIntegration, UPDATE_DEAL, {}, UPDATE_DEAL_LABELS);
      });
      const dealIds: string[] = [];
      await test.step(`Create the contact in HubSpot with ${existing.length} deal${existing.length > 1 ? 's' : ''}`, async () => {
        const contactId = await hubspotContacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });
        for (const d of existing) dealIds.push(await hubspotDeals.createDealForContact(contactId, { name: d['Deal Name'], amount: d['Amount'] }));
      });
      const before: unknown[] = [];
      for (const id of dealIds) before.push(await hubspotDeals.summary(id));
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      test.setTimeout(25 * 60_000); // the Update a Deal log alone can take about 7.5 minutes
      await test.step('Wait until the new log entries have finished', async () => {
        const statuses = await flow.newLogsFinished(saleshandyIntegration, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
        test.info().annotations.push({ type: 'Log status', description: statuses.join(', ') });
      });
      await test.step('Record the deals after the open (not asserted, QA decides)', async () => {
        const after: unknown[] = [];
        for (const id of dealIds) after.push(await hubspotDeals.summary(id));
        test.info().annotations.push({ type: 'Deals before', description: JSON.stringify(before) });
        test.info().annotations.push({ type: 'Deals after', description: JSON.stringify(after) });
      });
    });
  }

  test('Update a deal in HubSpot > 3: Contact in HubSpot with 0 deals', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Update a deal in HubSpot > 3');
    await test.step('Select only Update a Deal, nothing chosen in Extra Configuration', async () => {
      await flow.useOnly(saleshandyIntegration, UPDATE_DEAL, {}, UPDATE_DEAL_LABELS);
    });
    let contactId = '';
    await test.step('Create the contact in HubSpot, no deal', async () => {
      contactId = await hubspotContacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    test.setTimeout(25 * 60_000);
    await test.step('Wait until the new log entries have finished', async () => {
      const statuses = await flow.newLogsFinished(saleshandyIntegration, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
      test.info().annotations.push({ type: 'Log status', description: statuses.join(', ') });
    });
    await test.step('Check HubSpot: the contact still has no deal', async () => {
      expect((await hubspotContacts.associations(contactId, 'deals')).count, 'deals on the contact').toBe(0);
    });
  });

  test('Update a deal in HubSpot > 4: Contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Update a deal in HubSpot > 4');
    await test.step('Select only Update a Deal, nothing chosen in Extra Configuration', async () => {
      await flow.useOnly(saleshandyIntegration, UPDATE_DEAL, {}, UPDATE_DEAL_LABELS);
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    test.setTimeout(25 * 60_000);
    await test.step('Wait until the new log entries have finished', async () => {
      const statuses = await flow.newLogsFinished(saleshandyIntegration, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
      test.info().annotations.push({ type: 'Log status', description: statuses.join(', ') });
    });
    await test.step('Check HubSpot: no contact was created', async () => {
      expect(await hubspotContacts.contactExists(row['Email'], fullName(row)), `contact ${row['Email']} in HubSpot`).toBe(false);
    });
  });
  // Create / Update a company: no Extra Configuration, so the page Save stores
  // the selection (useOnly handles it). Company name is not checked (AL-4104).
  test('Create a company in HubSpot > 1: Contact in HubSpot, prospect has company details', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Create a company in HubSpot > 1');
    await test.step('Select only Create a Company (no Extra Configuration)', async () => {
      await flow.useOnly(saleshandyIntegration, CREATE_COMPANY, {}, []);
    });
    let contactId = '';
    await test.step('Create the contact in HubSpot', async () => {
      contactId = await hubspotContacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
    await test.step('Check HubSpot: one company associated to the contact', async () => {
      await expectCompanies(hubspotContacts, contactId, 1);
    });
  });

  test('Create a company in HubSpot > 2: A company with the same domain already exists', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotCompanies }) => {
    const row = flow.rowFor('Create a company in HubSpot > 2');
    const existing = flow.companies.find((c) => !c['Contact Email']);
    if (!existing) throw new Error('No company without a Contact Email in the -companies CSV (the "same domain" company)');
    await test.step('Select only Create a Company (no Extra Configuration)', async () => {
      await flow.useOnly(saleshandyIntegration, CREATE_COMPANY, {}, []);
    });
    let existingId = '';
    await test.step(`Create the company ${existing['Company Name']} (${existing['Company Domain']}) in HubSpot`, async () => {
      existingId = await hubspotCompanies.createCompany({ domain: existing['Company Domain'], name: existing['Company Name'] });
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
    await test.step('Check HubSpot: a new company is associated to the contact, not the existing one', async () => {
      const [company] = await expectCompanies(hubspotContacts, await findContact(hubspotContacts, row), 1);
      expect(company.id, 'associated company is a new one').not.toBe(existingId);
    });
  });

  test('Create a company in HubSpot > 3: Contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Create a company in HubSpot > 3');
    await test.step('Select only Create a Company (no Extra Configuration)', async () => {
      await flow.useOnly(saleshandyIntegration, CREATE_COMPANY, {}, []);
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    test.setTimeout(15 * 60_000); // a log can sit on RUNNING for minutes
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known, 10 * 60_000);
    });
    await test.step('Check HubSpot: contact created with one associated company', async () => {
      await expectCompanies(hubspotContacts, await findContact(hubspotContacts, row), 1);
    });
  });

  test('Create a company in HubSpot > 4: Prospect has empty company details, only a company domain', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Create a company in HubSpot > 4');
    await test.step('Select only Create a Company (no Extra Configuration)', async () => {
      await flow.useOnly(saleshandyIntegration, CREATE_COMPANY, {}, []);
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
    await test.step('Check HubSpot: contact created with one associated company (made from the domain)', async () => {
      await expectCompanies(hubspotContacts, await findContact(hubspotContacts, row), 1);
    });
  });

  test('Update a company in HubSpot > 1: Contact has 1 associated company', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotCompanies }) => {
    const row = flow.rowFor('Update a company in HubSpot > 1');
    await test.step('Select only Update a Company (no Extra Configuration)', async () => {
      await flow.useOnly(saleshandyIntegration, UPDATE_COMPANY, {}, []);
    });
    let companyIds: string[] = [];
    await test.step('Create the contact in HubSpot with 1 associated company', async () => {
      companyIds = await contactWithCompanies(flow.companies, row, hubspotContacts, hubspotCompanies);
      expect(companyIds.length, 'companies created').toBe(1);
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row, async () => {
      await test.step('Change City and State in Saleshandy', async () => {
        await changeProspect(saleshandyCrm, row, { City: row['Updated City'], State: row['Updated State'] });
      });
    });
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
    await test.step('Check HubSpot: the company shows the new City and State', async () => {
      await expectCompanyValues(hubspotCompanies, companyIds[0], { City: row['Updated City'], 'State/Region': row['Updated State'] });
    });
  });

  test('Update a company in HubSpot > 2: Contact has 2 associated companies', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotCompanies }) => {
    const row = flow.rowFor('Update a company in HubSpot > 2');
    await test.step('Select only Update a Company (no Extra Configuration)', async () => {
      await flow.useOnly(saleshandyIntegration, UPDATE_COMPANY, {}, []);
    });
    let companyIds: string[] = [];
    let olderBefore = '';
    await test.step('Create the contact in HubSpot with 2 associated companies, one after the other', async () => {
      companyIds = await contactWithCompanies(flow.companies, row, hubspotContacts, hubspotCompanies);
      expect(companyIds.length, 'companies created').toBe(2);
      olderBefore = await hubspotCompanies.property(companyIds[0], 'City');
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row, async () => {
      await test.step('Change City and State in Saleshandy', async () => {
        await changeProspect(saleshandyCrm, row, { City: row['Updated City'], State: row['Updated State'] });
      });
    });
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
    await test.step('Check HubSpot: the latest associated company is updated', async () => {
      await expectCompanyValues(hubspotCompanies, companyIds[1], { City: row['Updated City'], 'State/Region': row['Updated State'] });
    });
    await test.step('Check HubSpot: the other company is unchanged', async () => {
      expect(await hubspotCompanies.property(companyIds[0], 'City'), 'older company City').toBe(olderBefore);
    });
  });

  test('Update a company in HubSpot > 3: Contact in HubSpot, no associated company', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Update a company in HubSpot > 3');
    await test.step('Select only Update a Company (no Extra Configuration)', async () => {
      await flow.useOnly(saleshandyIntegration, UPDATE_COMPANY, {}, []);
    });
    let contactId = '';
    await test.step('Create the contact in HubSpot, no company', async () => {
      contactId = await hubspotContacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
    await test.step('Check HubSpot: the contact still has no company', async () => {
      expect((await hubspotContacts.associations(contactId, 'companies')).count, 'companies on the contact').toBe(0);
    });
  });

  test('Update a company in HubSpot > 4: Contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Update a company in HubSpot > 4');
    await test.step('Select only Update a Company (no Extra Configuration)', async () => {
      await flow.useOnly(saleshandyIntegration, UPDATE_COMPANY, {}, []);
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
    await test.step('Check HubSpot: no contact was created', async () => {
      expect(await hubspotContacts.contactExists(row['Email'], fullName(row)), `contact ${row['Email']} in HubSpot`).toBe(false);
    });
  });
  // Create a Note and Record (log) an email activity are paired with a contact
  // activity left empty (Phase 1). Note 3 and Record 5 reuse the prospect of
  // Note 2 and Record 4 and open the step 2 email (Send now first).

  // Create a Task, Phase 1: the modal only, nothing is typed or selected and no
  // email is opened (scenario file). Seen on staging 2026-10-13: Save is
  // disabled from the start; after touching the fields only Task Title
  // (class input-error) and Due In (bs-input-number-error) turn red.
  test('Create a Task in HubSpot > 1: Extra Configuration modal just opened', async ({ saleshandyIntegration }) => {
    await test.step('Select Create a Task, touch nothing', async () => {
      await flow.startClean(saleshandyIntegration);
      await saleshandyIntegration.selectActivity(TRIGGER, CREATE_TASK);
      await skipIfTaskConfigSaved(saleshandyIntegration);
    });
    await test.step('No field is highlighted red and Save is disabled', async () => {
      const dialog = saleshandyIntegration.extraConfiguration();
      await expect(dialog.locator('.input-error, .bs-input-number-error'), 'fields highlighted red').toHaveCount(0);
      await expect(saleshandyIntegration.configSaveButton(), 'Save').toBeDisabled();
    });
    await test.step('Close the dialog and remove Create a Task', async () => {
      await saleshandyIntegration.cancelExtraConfiguration();
      await saleshandyIntegration.removeActivity(TRIGGER, CREATE_TASK);
    });
  });

  test('Create a Task in HubSpot > 2: Fields touched and left empty', async ({ saleshandyIntegration }) => {
    const dialog = saleshandyIntegration.extraConfiguration();
    await test.step('Select Create a Task', async () => {
      await flow.startClean(saleshandyIntegration);
      await saleshandyIntegration.selectActivity(TRIGGER, CREATE_TASK);
      await skipIfTaskConfigSaved(saleshandyIntegration);
    });
    await test.step('Click into each field and leave it, typing and selecting nothing', async () => {
      await dialog.locator('.mb-3').nth(0).locator('input').click();
      await dialog.locator('.mb-3').nth(1).locator('.bs-select-box').click();
      await dialog.getByText('Extra Configuration').click();
      await dialog.locator('.mb-3').nth(2).locator('.bs-select-box').click();
      await dialog.getByText('Extra Configuration').click();
      await dialog.locator('.mb-3').nth(3).locator('input').click();
      await dialog.locator('.mb-3').nth(4).locator('input').click();
      await dialog.getByText('Extra Configuration').click();
    });
    await test.step('Task Title and Due In are red; Save stays disabled', async () => {
      await expect(dialog.locator('.mb-3').nth(0).locator('.input-error'), 'Task Title red').toHaveCount(1);
      await expect(dialog.locator('.mb-3').nth(3).locator('.bs-input-number-error'), 'Due In red').toHaveCount(1);
      await expect(saleshandyIntegration.configSaveButton(), 'Save').toBeDisabled();
    });
    // Scenario: "each empty required field is highlighted red". Task Type, Task
    // Priority and Task Associated With did not turn red on staging when
    // touched (2026-10-13); recorded for QA, not asserted.
    await test.step('Record the other fields (Task Type, Task Priority, Task Associated With), not asserted', async () => {
      const notRed: string[] = [];
      for (const [i, label] of [[1, 'Task Type'], [2, 'Task Priority'], [4, 'Task Associated With']] as const) {
        const cls = await dialog.locator('.mb-3').nth(i).evaluate((el) => [...el.querySelectorAll('*')].flatMap((e) => [...e.classList]).filter((c) => /error/i.test(c)));
        if (cls.length === 0) notRed.push(label);
      }
      test.info().annotations.push({ type: 'Not highlighted red when touched', description: notRed.join(', ') || 'none' });
    });
    await test.step('Close the dialog and remove Create a Task', async () => {
      await saleshandyIntegration.cancelExtraConfiguration();
      await saleshandyIntegration.removeActivity(TRIGGER, CREATE_TASK);
    });
  });

  test('Create a Note in HubSpot > 1: Paired with Create a Contact, contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Create a Note in HubSpot > 1');
    await test.step('Select Create a Contact (empty) and Create a Note', async () => {
      await usePaired(saleshandyIntegration, CREATE_CONTACT, CREATE_CONTACT_LABELS, CREATE_NOTE);
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
    await test.step('Check HubSpot: contact created, note on it with Step, Variant and Prospect Email', async () => {
      const contactId = await findContact(hubspotContacts, row);
      await expectOnRecord(hubspotContacts, contactId, ['Note created via Saleshandy', ...flow.noteContains(row, 1)], 'Note');
    });
  });

  test('Create a Note in HubSpot > 2: Paired with Update a Contact, contact in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Create a Note in HubSpot > 2');
    await test.step('Select Update a Contact (empty) and Create a Note', async () => {
      await usePaired(saleshandyIntegration, UPDATE_CONTACT, UPDATE_CONTACT_LABELS, CREATE_NOTE);
    });
    let contactId = '';
    await test.step('Create the contact in HubSpot', async () => {
      contactId = await hubspotContacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
    await test.step('Check HubSpot: note on the contact', async () => {
      await expectOnRecord(hubspotContacts, contactId, ['Note created via Saleshandy', ...flow.noteContains(row, 1)], 'Note');
    });
  });


  test('Create a Note in HubSpot > 3: Pairing from row 2, step 2 not sent yet', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Create a Note in HubSpot > 2');
    await test.step('Select Update a Contact (empty) and Create a Note again', async () => {
      await usePaired(saleshandyIntegration, UPDATE_CONTACT, UPDATE_CONTACT_LABELS, CREATE_NOTE);
    });
    const known = await flow.knownLogIds(saleshandyIntegration);
    test.setTimeout(20 * 60_000);
    await test.step('Move the prospect from step 1 to step 2 (Prospects tab > Add to Sequence)', async () => {
      await saleshandySequence.moveToStep(SEQUENCE_ID, row['Email'], 2);
    });
    await test.step('Send now on step 2 and open its email', async () => {
      await flow.fireEvent({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row, 2);
    });
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
    await test.step('Check HubSpot: a new note on the contact shows Step 2, Variant A', async () => {
      const contactId = await findContact(hubspotContacts, row);
      await expectOnRecord(hubspotContacts, contactId, flow.noteContains(row, 2), 'Step 2 note');
    });
  });

  test('Create a Note in HubSpot > 4: Create a Note selected alone', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Create a Note in HubSpot > 4');
    await test.step('Select only Create a Note (no Extra Configuration)', async () => {
      await flow.useOnly(saleshandyIntegration, CREATE_NOTE, {}, []);
    });
    await test.step('Reload: Create a Note is the only selected activity', async () => {
      await saleshandyIntegration.openTriggers();
      await expect.poll(() => saleshandyIntegration.selectedActivities(TRIGGER), 'selected activities').toEqual([CREATE_NOTE]);
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    // QA decision 2026-10-13 (lessons.md): a Logs entry is the custom workflow's
    // run, so with only Create a Note selected it is Success, and no note lands
    // on any contact, company or deal.
    await test.step('Wait until the new log entries have finished: Success, no Error', async () => {
      const statuses = await flow.newLogsFinished(saleshandyIntegration, known);
      test.info().annotations.push({ type: 'Log status', description: statuses.join(', ') });
      expect(statuses, 'log statuses').toContain('Success');
      expect(statuses, 'log statuses').not.toContain('Error');
    });
    await test.step('Check HubSpot: no contact and no note were created', async () => {
      expect(await hubspotContacts.contactExists(row['Email'], fullName(row)), `contact ${row['Email']} in HubSpot`).toBe(false);
    });
  });

  test('Record (log) an email activity in HubSpot > 1: Activity selected', async ({ saleshandyIntegration }) => {
    await test.step(`Select "${RECORD_EMAIL}"`, async () => {
      await flow.startClean(saleshandyIntegration);
      await saleshandyIntegration.selectActivity(TRIGGER, RECORD_EMAIL);
    });
    await test.step('Hover the info icon next to the activity', async () => {
      await saleshandyIntegration.hoverActivityInfo(TRIGGER, RECORD_EMAIL);
      // Product text, with "Email" capitalised (seen 2026-10-09).
      await expect(saleshandyIntegration.tooltip(), 'tooltip').toHaveText(
        'Logging an Email alone would result in failure. Please create/update contact or deal to associate an email.',
      );
    });
  });

  test('Record (log) an email activity in HubSpot > 2: Only this activity selected', async ({ saleshandyIntegration }) => {
    await test.step(`Select only "${RECORD_EMAIL}" and Save`, async () => {
      await flow.startClean(saleshandyIntegration);
      await saleshandyIntegration.selectActivity(TRIGGER, RECORD_EMAIL);
      await saleshandyIntegration.save();
      await expect(saleshandyIntegration.savedToast(), 'save confirmation').toBeVisible();
    });
    await test.step('Reload: the activity is still the only one selected', async () => {
      await saleshandyIntegration.openTriggers();
      expect(await saleshandyIntegration.isTriggerOn(TRIGGER), 'trigger on').toBe(true);
      await expect.poll(() => saleshandyIntegration.selectedActivities(TRIGGER), 'selected activities').toEqual([RECORD_EMAIL]);
    });
  });

  test('Record (log) an email activity in HubSpot > 3: Paired with Create a Contact, contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Record (log) an email activity in HubSpot > 3');
    await test.step('Select Create a Contact (empty) and Record (log) an Email Activity', async () => {
      await usePaired(saleshandyIntegration, CREATE_CONTACT, CREATE_CONTACT_LABELS, RECORD_EMAIL);
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
    await test.step('Check HubSpot: contact created, email logged on it', async () => {
      await expectOnRecord(hubspotContacts, await findContact(hubspotContacts, row), flow.loggedEmailContains(row, 1), 'Logged email');
    });
  });

  test('Record (log) an email activity in HubSpot > 4: Paired with Update a Contact, contact in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Record (log) an email activity in HubSpot > 4');
    await test.step('Select Update a Contact (empty) and Record (log) an Email Activity', async () => {
      await usePaired(saleshandyIntegration, UPDATE_CONTACT, UPDATE_CONTACT_LABELS, RECORD_EMAIL);
    });
    let contactId = '';
    await test.step('Create the contact in HubSpot', async () => {
      contactId = await hubspotContacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });
    });
    const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
    await test.step('Check HubSpot: email logged on the contact', async () => {
      await expectOnRecord(hubspotContacts, contactId, flow.loggedEmailContains(row, 1), 'Logged email');
    });
  });

  test('Record (log) an email activity in HubSpot > 5: Pairing from row 4, step 2 not sent yet', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Record (log) an email activity in HubSpot > 4');
    await test.step('Select Update a Contact (empty) and Record (log) an Email Activity again', async () => {
      await usePaired(saleshandyIntegration, UPDATE_CONTACT, UPDATE_CONTACT_LABELS, RECORD_EMAIL);
    });
    const known = await flow.knownLogIds(saleshandyIntegration);
    test.setTimeout(20 * 60_000);
    await test.step('Move the prospect from step 1 to step 2 (Prospects tab > Add to Sequence)', async () => {
      await saleshandySequence.moveToStep(SEQUENCE_ID, row['Email'], 2);
    });
    await test.step('Send now on step 2 and open its email', async () => {
      await flow.fireEvent({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row, 2);
    });
    await test.step('Check Logs: new entries are Success', async () => {
      await flow.expectNewLogsSuccess(saleshandyIntegration, known);
    });
    await test.step('Check HubSpot: the step 2 email is a separate activity (the subject shows twice)', async () => {
      const contactId = await findContact(hubspotContacts, row);
      const [subject] = flow.loggedEmailContains(row, 2);
      await untilPasses('Second logged email not found on the contact', async () => {
        const text = await hubspotContacts.activitiesText('0-1', contactId);
        expect(text.split(subject).length - 1, `logged emails with "${subject}"`).toBeGreaterThanOrEqual(2);
      });
    });
  });

});
