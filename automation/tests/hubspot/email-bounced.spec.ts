// Scenarios: test-cases/hubspot/email-bounced.md (Regression, Phase 1: Extra
// Configuration empty). Data: test-data/hubspot/email-bounced.csv, one row per
// scenario (Scenario column). Used rows are replaced by new people before
// every run (src/data/global-setup.ts).
// Shared steps live in src/flows/saleshandy-to-hubspot.ts; this file adds only
// the trigger event (Mark as bounced) and the rows written so far. QA
// (2026-10-12): start with one contact, add rows once it works.
import { markUsed } from '../../src/data/used.ts';
import type { Row } from '../../src/data/csv.ts';
import type { HubSpotCompaniesPage } from '../../src/pages/hubspot/companies.page.ts';
import type { HubSpotContactsPage } from '../../src/pages/hubspot/contacts.page.ts';
import type { HubSpotIntegrationPage } from '../../src/pages/saleshandy/hubspot-integration.page.ts';
import type { SaleshandyCrmPage } from '../../src/pages/saleshandy/crm.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';
import { expect, test } from '../../src/fixtures/index.ts';
import { CREATE_COMPANY, CREATE_CONTACT, CREATE_DEAL, CREATE_NOTE, CREATE_TASK, RECORD_EMAIL, UPDATE_COMPANY, UPDATE_CONTACT, UPDATE_DEAL } from '../../src/flows/activity-rows.ts';
import { createFlow, expectContact, fullName, mapped, newDealsOf } from '../../src/flows/saleshandy-to-hubspot.ts';

test.use({ account: 'emailbounced' });

// Name on Triggers & Activity and in Logs (seen 2026-10-12).
const TRIGGER = 'Email is Bounced in Saleshandy';

// Sequence "HubSpot Email Bounced QA" on the emailbounced account (2 steps,
// Variant A only), set up and activated 2026-10-12.
const SEQUENCE_ID = '196432';

const flow = createFlow({
  trigger: TRIGGER,
  sequenceId: SEQUENCE_ID,
  csv: 'hubspot/email-bounced.csv',
  // Manual bounce on the step 1 email. The sequence is Active, so Saleshandy
  // has sent it by itself by now (no Send now); the action works on the sent row.
  // Step 2 rows (Create a Note 3): QA 2026-10-12, a prospect in step 2 can be
  // marked as bounced without sending step 2, so there is no Send now.
  fireEvent: async ({ sequence }, row, step) => {
    await test.step(`Mark the step ${step} email as bounced`, async () => {
      await sequence.markAsBounced(SEQUENCE_ID, fullName(row), step);
    });
  },
});

// ---- No Logs (QA, 2026-10-14: "do not look at the logs") ----
// The Logs tab is never opened. Each row waits for the bounce to reach HubSpot,
// then checks the HubSpot record. Typical sync: about 1 to 1.5 minutes; an
// Update a Deal run stays about 7.5 minutes (seen 2026-10-12).
const SYNC_WAIT_MS = 90_000;
const SLOW_SYNC_WAIT_MS = 8 * 60_000;

async function waitForSync(integration: HubSpotIntegrationPage, ms: number): Promise<void> {
  await test.step(`Wait ${ms / 1000} seconds for the bounce to reach HubSpot (Logs are not looked at)`, async () => {
    await integration.page.waitForTimeout(ms);
  });
}

type TriggerContext = Parameters<typeof flow.runTrigger>[0];

// Same steps as flow.runTrigger, without reading the Logs list first.
async function runTrigger(f: { fireEvent: typeof flow.fireEvent }, ctx: TriggerContext, row: Row, beforeSend?: () => Promise<void>): Promise<void> {
  // Waits for the send, the event and the sync.
  test.setTimeout(10 * 60_000);
  await test.step('Add the prospect to the sequence', async () => {
    await ctx.sequence.createAndAddProspect(SEQUENCE_ID, row);
    markUsed('hubspot/email-bounced.csv', row['Email']);
  });
  if (beforeSend) await beforeSend();
  await test.step('Wait until Saleshandy sends step 1', async () => {
    await ctx.sequence.ensureSent(SEQUENCE_ID, fullName(row), 1);
  });
  await f.fireEvent(ctx, row, 1);
}

// Another trigger's name on Triggers & Activity (seen 2026-10-12).
const OTHER_TRIGGER = 'Email Sent from Saleshandy';

// Baseline 3: the sequence goes from Active to paused after the email is sent,
// then the email is marked as bounced (QA 2026-10-12: it works the same).
const pausedFlow = createFlow({
  trigger: TRIGGER,
  sequenceId: SEQUENCE_ID,
  csv: 'hubspot/email-bounced.csv',
  fireEvent: async ({ sequence }, row) => {
    await test.step('Pause the sequence', async () => {
      await sequence.pauseSequence(SEQUENCE_ID);
    });
    await test.step('Mark the step 1 email as bounced while the sequence is paused', async () => {
      await sequence.markAsBounced(SEQUENCE_ID, fullName(row));
    });
  },
});

// Baseline 5: the bounce comes from the real send. QA 2026-10-12: plain
// @mailinator.com never bounces, @<company>.mailinator.com does. The CSV keeps
// the plain address (rows are regenerated that way), so it is built here.
const realBounceRow = (scenario: string) => {
  const row = flow.rowFor(scenario);
  const company = row['Company'].normalize('NFKD').replace(/[^A-Za-z]/g, '').toLowerCase();
  return { ...row, Email: row['Email'].replace(/@mailinator\.com$/i, `@${company}.mailinator.com`) };
};
const realFlow = createFlow({
  trigger: TRIGGER,
  sequenceId: SEQUENCE_ID,
  csv: 'hubspot/email-bounced.csv',
  fireEvent: async ({ sequence }, row) => {
    await test.step('Wait for Saleshandy to show the email as Bounced (real bounce, no Mark as bounced)', async () => {
      await sequence.waitUntilBounced(SEQUENCE_ID, fullName(row));
    });
  },
});

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

const CREATE_CONTACT_LABELS = ['Lead Status', 'Lead Lifecycle'];
const UPDATE_CONTACT_LABELS = ['Update Lead Status', 'Update Lead Lifecycle'];

test.describe('Email is Bounced in Saleshandy', () => {

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

  test('Trigger behavior (baseline) > 2: Prospect in the Emails tab, sequence Active', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Trigger behavior (baseline) > 2');
    await test.step('Select only Create a Contact, nothing chosen in Extra Configuration', async () => {
      await flow.useOnly(saleshandyIntegration, CREATE_CONTACT, {}, ['Lead Status', 'Lead Lifecycle']);
    });
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
    await test.step('Check the contact in HubSpot has the mapped fields', async () => {
      await expectContact(hubspotContacts, row, mapped(row));
    });
  });

  test('Trigger behavior (baseline) > 3: Sequence paused after being Active', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = pausedFlow.rowFor('Trigger behavior (baseline) > 3');
    await test.step('Select only Create a Contact, nothing chosen in Extra Configuration', async () => {
      await pausedFlow.useOnly(saleshandyIntegration, CREATE_CONTACT, {}, ['Lead Status', 'Lead Lifecycle']);
    });
    try {
      await runTrigger(pausedFlow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
      await test.step('Check the contact in HubSpot has the mapped fields', async () => {
        await expectContact(hubspotContacts, row, mapped(row));
      });
    } finally {
      // The sequence is shared by every row, so it goes back to Active.
      await test.step('Activate the sequence again', async () => {
        await saleshandySequence.resumeSequence(SEQUENCE_ID);
      });
    }
  });

  test('Trigger behavior (baseline) > 4: Only another trigger enabled', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Trigger behavior (baseline) > 4');
    await test.step(`Turn "${TRIGGER}" off, turn "${OTHER_TRIGGER}" on with ${RECORD_EMAIL} and Save`, async () => {
      await saleshandyIntegration.openTriggers();
      await saleshandyIntegration.enableOnly(OTHER_TRIGGER);
      await saleshandyIntegration.selectActivity(OTHER_TRIGGER, RECORD_EMAIL);
      await saleshandyIntegration.save();
      await expect(saleshandyIntegration.savedToast(), 'save confirmation').toBeVisible();
    });
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    // A bounced workflow normally reaches HubSpot within about 45 seconds (seen 2026-10-12).
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
    await test.step('Check HubSpot: no contact was created (only another trigger is on)', async () => {
      expect(await hubspotContacts.contactExists(row['Email'], fullName(row)), `contact ${row['Email']} in HubSpot`).toBe(false);
    });
  });

  test('Trigger behavior (baseline) > 5: Real bounce, contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    test.skip(process.env.ALLOW_REAL_BOUNCE !== '1', 'Real bounce: the plan cap of 3 is used (QA, 2026-10-14). Set ALLOW_REAL_BOUNCE=1 to send one.');
    const row = realBounceRow('Trigger behavior (baseline) > 5');
    await test.step('Select only Create a Contact, nothing chosen in Extra Configuration', async () => {
      await realFlow.useOnly(saleshandyIntegration, CREATE_CONTACT, {}, ['Lead Status', 'Lead Lifecycle']);
    });
    await runTrigger(realFlow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    // The CSV row is replaced by a new person before the next run.
    markUsed('hubspot/email-bounced.csv', flow.rowFor('Trigger behavior (baseline) > 5')['Email']);
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
    await test.step('Check the contact in HubSpot has the mapped fields', async () => {
      await expectContact(hubspotContacts, row, { ...mapped(row), 'Lifecycle stage': 'Lead' });
    });
  });

  test('Create a Contact in HubSpot > 1: Contact not in HubSpot, Extra Configuration empty', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Create a Contact in HubSpot > 1');
    await test.step('Select only Create a Contact, nothing chosen in Extra Configuration', async () => {
      await flow.useOnly(saleshandyIntegration, CREATE_CONTACT, {}, ['Lead Status', 'Lead Lifecycle']);
    });
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
    await test.step('Check the contact in HubSpot has the mapped fields', async () => {
      // QA (2026-10-12, "your suggestion"): Lifecycle Stage is Lead; Lead
      // Status is left to HubSpot and not asserted (it stayed empty on staging).
      await expectContact(hubspotContacts, row, { ...mapped(row), 'Lifecycle stage': 'Lead' });
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
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row, async () => {
      await test.step('Change Job Title and City in Saleshandy', async () => {
        await saleshandyCrm.search(row['Email']);
        await saleshandyCrm.openProspect(fullName(row));
        await saleshandyCrm.editField('Job Title', row['Updated Job Title']);
        await saleshandyCrm.editField('City', row['Updated City']);
      });
    });
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
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
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row, async () => {
      await test.step('Change Job Title and City in Saleshandy', async () => {
        await saleshandyCrm.search(row['Email']);
        await saleshandyCrm.openProspect(fullName(row));
        await saleshandyCrm.editField('Job Title', row['Updated Job Title']);
        await saleshandyCrm.editField('City', row['Updated City']);
      });
    });
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
    await test.step('Check the contact in HubSpot shows the new values', async () => {
      await expectContact(hubspotContacts, row, { 'Job title': row['Updated Job Title'], City: row['Updated City'] });
    });
  });

  test('Update a Contact in HubSpot > 2: Contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Update a Contact in HubSpot > 2');
    await test.step('Select only Update a Contact, nothing chosen in Extra Configuration', async () => {
      await flow.useOnly(saleshandyIntegration, UPDATE_CONTACT, {}, ['Update Lead Status', 'Update Lead Lifecycle']);
    });
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
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
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await waitForSync(saleshandyIntegration, SLOW_SYNC_WAIT_MS);
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
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
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
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
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
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
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
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
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
      await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      test.setTimeout(25 * 60_000); // the Update a Deal log alone can take about 7.5 minutes
      await waitForSync(saleshandyIntegration, SLOW_SYNC_WAIT_MS);
      await test.step('Record the deals after the bounce (not asserted, QA decides)', async () => {
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
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    test.setTimeout(25 * 60_000);
    await waitForSync(saleshandyIntegration, SLOW_SYNC_WAIT_MS);
    await test.step('Check HubSpot: the contact still has no deal', async () => {
      expect((await hubspotContacts.associations(contactId, 'deals')).count, 'deals on the contact').toBe(0);
    });
  });

  test('Update a deal in HubSpot > 4: Contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Update a deal in HubSpot > 4');
    await test.step('Select only Update a Deal, nothing chosen in Extra Configuration', async () => {
      await flow.useOnly(saleshandyIntegration, UPDATE_DEAL, {}, UPDATE_DEAL_LABELS);
    });
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    test.setTimeout(25 * 60_000);
    await waitForSync(saleshandyIntegration, SLOW_SYNC_WAIT_MS);
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
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
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
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
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
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    test.setTimeout(15 * 60_000); // a log can sit on RUNNING for minutes
    await waitForSync(saleshandyIntegration, SLOW_SYNC_WAIT_MS);
    await test.step('Check HubSpot: contact created with one associated company', async () => {
      await expectCompanies(hubspotContacts, await findContact(hubspotContacts, row), 1);
    });
  });

  test('Create a company in HubSpot > 4: Prospect has empty company details, only a company domain', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Create a company in HubSpot > 4');
    await test.step('Select only Create a Company (no Extra Configuration)', async () => {
      await flow.useOnly(saleshandyIntegration, CREATE_COMPANY, {}, []);
    });
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
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
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row, async () => {
      await test.step('Change City and State in Saleshandy', async () => {
        await changeProspect(saleshandyCrm, row, { City: row['Updated City'], State: row['Updated State'] });
      });
    });
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
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
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row, async () => {
      await test.step('Change City and State in Saleshandy', async () => {
        await changeProspect(saleshandyCrm, row, { City: row['Updated City'], State: row['Updated State'] });
      });
    });
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
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
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
    await test.step('Check HubSpot: the contact still has no company', async () => {
      expect((await hubspotContacts.associations(contactId, 'companies')).count, 'companies on the contact').toBe(0);
    });
  });

  test('Update a company in HubSpot > 4: Contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Update a company in HubSpot > 4');
    await test.step('Select only Update a Company (no Extra Configuration)', async () => {
      await flow.useOnly(saleshandyIntegration, UPDATE_COMPANY, {}, []);
    });
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
    await test.step('Check HubSpot: no contact was created', async () => {
      expect(await hubspotContacts.contactExists(row['Email'], fullName(row)), `contact ${row['Email']} in HubSpot`).toBe(false);
    });
  });
  // Create a Task, Phase 1: the modal only, nothing is typed or selected and no
  // prospect is bounced (scenario file, QA 2026-10-12). Same modal and
  // assertions as Email Opened, seen on staging 2026-10-13: Save is disabled
  // from the start; after touching the fields only Task Title (input-error)
  // and Due In (bs-input-number-error) turn red.
  test('Create a Task in HubSpot > 1: Extra Configuration modal just opened', async ({ saleshandyIntegration }) => {
    await test.step('Select Create a Task, touch nothing', async () => {
      await flow.startClean(saleshandyIntegration);
      await saleshandyIntegration.selectActivity(TRIGGER, CREATE_TASK);
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
    // Scenario: "each empty field is highlighted red". Task Type, Task Priority
    // and Task Associated With did not turn red when touched on staging
    // (Email Opened, 2026-10-13); recorded for QA, not asserted.
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

  // Create a Note and Record (log) an email activity are paired with a contact
  // activity left empty (Phase 1). Note 3 and Record 5 (prospect in step 2) are
  // not written: a bounced prospect may have no step 2 row, to be walked first.
  test('Create a Note in HubSpot > 1: Paired with Create a Contact, contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Create a Note in HubSpot > 1');
    await test.step('Select Create a Contact (empty) and Create a Note', async () => {
      await usePaired(saleshandyIntegration, CREATE_CONTACT, CREATE_CONTACT_LABELS, CREATE_NOTE);
    });
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
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
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
    await test.step('Check HubSpot: note on the contact', async () => {
      await expectOnRecord(hubspotContacts, contactId, ['Note created via Saleshandy', ...flow.noteContains(row, 1)], 'Note');
    });
  });

  // Note 3 has its own prospect: step 1 sent, moved to step 2, then the step 2
  // row is marked as bounced (QA 2026-10-12: no Send now needed). It cannot reuse
  // Note 2's prospect: that one is already bounced on step 1 and Add to Sequence
  // reports "Successfully Moved 0, Failed to move 1" (seen 2026-10-13).
  test('Create a Note in HubSpot > 3: Paired with Update a Contact, prospect in step 2', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Create a Note in HubSpot > 3');
    test.setTimeout(20 * 60_000);
    await test.step('Select Update a Contact (empty) and Create a Note', async () => {
      await usePaired(saleshandyIntegration, UPDATE_CONTACT, UPDATE_CONTACT_LABELS, CREATE_NOTE);
    });
    let contactId = '';
    await test.step('Create the contact in HubSpot', async () => {
      contactId = await hubspotContacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });
    });
    await test.step('Add the prospect and wait until step 1 is sent', async () => {
      await saleshandySequence.createAndAddProspect(SEQUENCE_ID, row);
      markUsed('hubspot/email-bounced.csv', row['Email']);
      await saleshandySequence.ensureSent(SEQUENCE_ID, fullName(row), 1);
    });
    await test.step('Move the prospect to step 2 (Prospects tab > Add to Sequence)', async () => {
      await saleshandySequence.moveToStep(SEQUENCE_ID, row['Email'], 2);
    });
    await test.step('Mark the step 2 email as bounced', async () => {
      await flow.fireEvent({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row, 2);
    });
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
    await test.step('Check HubSpot: a note on the contact shows Step 2, Variant A', async () => {
      await expectOnRecord(hubspotContacts, contactId, flow.noteContains(row, 2), 'Step 2 note');
    });
  });

  test('Create a Note in HubSpot > 4: Create a Note selected alone', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Create a Note in HubSpot > 4');
    await test.step('Select only Create a Note (no Extra Configuration)', async () => {
      await flow.useOnly(saleshandyIntegration, CREATE_NOTE, {}, []);
    });
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
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
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
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
    await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
    await test.step('Check HubSpot: email logged on the contact', async () => {
      await expectOnRecord(hubspotContacts, contactId, flow.loggedEmailContains(row, 1), 'Logged email');
    });
  });

  // Record 5 has its own prospect for the same reason as Note 3: the prospect of
  // Record 4 is already bounced on step 1 and cannot be moved to step 2 (expected
  // behavior, QA 2026-10-13). Step 1 is not bounced here, so the contact shows
  // only the step 2 email.
  test('Record (log) an email activity in HubSpot > 5: Paired with Update a Contact, prospect in step 2', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
    const row = flow.rowFor('Record (log) an email activity in HubSpot > 5');
    test.setTimeout(20 * 60_000);
    await test.step('Select Update a Contact (empty) and Record (log) an Email Activity', async () => {
      await usePaired(saleshandyIntegration, UPDATE_CONTACT, UPDATE_CONTACT_LABELS, RECORD_EMAIL);
    });
    let contactId = '';
    await test.step('Create the contact in HubSpot', async () => {
      contactId = await hubspotContacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });
    });
    await test.step('Add the prospect and wait until step 1 is sent', async () => {
      await saleshandySequence.createAndAddProspect(SEQUENCE_ID, row);
      markUsed('hubspot/email-bounced.csv', row['Email']);
      await saleshandySequence.ensureSent(SEQUENCE_ID, fullName(row), 1);
    });
    await test.step('Move the prospect to step 2 (Prospects tab > Add to Sequence)', async () => {
      await saleshandySequence.moveToStep(SEQUENCE_ID, row['Email'], 2);
    });
    await test.step('Mark the step 2 email as bounced', async () => {
      await flow.fireEvent({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row, 2);
    });
    await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
    await test.step('Check HubSpot: the step 2 email is logged on the contact', async () => {
      await expectOnRecord(hubspotContacts, contactId, flow.loggedEmailContains(row, 2), 'Logged email');
    });
  });
});
