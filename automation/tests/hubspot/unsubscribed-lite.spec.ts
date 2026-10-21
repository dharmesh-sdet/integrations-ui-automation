// Prospect is Unsubscribed in Saleshandy (AL-4015), Lightweight Regression.
// Scenarios: test-cases/hubspot/unsubscribed-lite.md (27 running scenarios).
// Data: test-data/hubspot/unsubscribed-lite.csv (+ -deals, -companies), one
// row per scenario that needs a prospect, every row replaced by a new person
// before each run (src/data/global-setup.ts).
//
// Lighter than unsubscribed.spec.ts (63 rows) by cutting duplication, not
// coverage: Phase 1 (Extra Configuration skipped) is present as skipped
// tests only, and no activity is proven twice via both trigger methods
// (Unsubscribe UI vs the real link); the link is only proven once, in
// Baseline. Every running row still has its own prospect and its own
// preconditions, so no row depends on another passing first.
import type { Page } from '@playwright/test';
import type { Row } from '../../src/data/csv.ts';
import { expect, test } from '../../src/fixtures/index.ts';
import { CREATE_COMPANY, CREATE_CONTACT, CREATE_DEAL, CREATE_NOTE, CREATE_TASK, RECORD_EMAIL, UPDATE_COMPANY, UPDATE_CONTACT, UPDATE_DEAL } from '../../src/flows/activity-rows.ts';
import { createFlow, daysFromToday, dealConfig, dealUpdateConfig as sharedDealUpdateConfig, expectContact, fullName, mapped, newDealsOf } from '../../src/flows/saleshandy-to-hubspot.ts';
import type { MailinatorPage } from '../../src/pages/mailinator.page.ts';
import type { HubSpotCompaniesPage } from '../../src/pages/hubspot/companies.page.ts';
import type { HubSpotContactsPage } from '../../src/pages/hubspot/contacts.page.ts';
import type { HubSpotDealsPage } from '../../src/pages/hubspot/deals.page.ts';
import type { HubSpotIntegrationPage } from '../../src/pages/saleshandy/hubspot-integration.page.ts';
import type { SaleshandyCrmPage } from '../../src/pages/saleshandy/crm.page.ts';
import type { SaleshandySequencePage } from '../../src/pages/saleshandy/sequence.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';

test.use({ account: 'unsubscribed' });

const TRIGGER = 'Prospect is Unsubscribed in Saleshandy';
const SEQUENCE_ID = '196738';
const CSV = 'hubspot/unsubscribed-lite.csv';
const UNSUBSCRIBED_PAGE_TEXT = "You will no longer receive emails from us. We're sorry to see you go.";
const SUBSCRIBED_PAGE_TEXT = 'You have successfully subscribed and added to our list for future communication';
// Observed 2026-10-12: the Update a Deal log stays RUNNING for about 7.5 minutes.
const UPDATE_DEAL_LOG_TIMEOUT_MS = 12 * 60_000;

// The unsubscribe page a link row opened (used by the "Subscribe here" row).
const unsubscribePages = new Map<string, Page>();

const CREATE_CONTACT_VALUES = { 'Lead Status': 'Open', 'Lead Lifecycle': 'Marketing Qualified Lead' };
const UPDATE_CONTACT_VALUES = { 'Update Lead Status': 'Connected', 'Update Lead Lifecycle': 'Sales Qualified Lead' };
const TASK = { title: 'Follow up from the workflow', type: 'Call', priority: 'Medium', dueDays: 3 };
// Update a Deal with the stage two positions after Prospecting (a deal made
// through HubSpot's UI starts at Prospecting, seen 2026-10-13).
const dealUpdateConfig = (closingDays: string) => ({
  ...sharedDealUpdateConfig(closingDays),
  'Select Pipeline Stage (when to update)': 'Follow-Up',
});

const common = {
  trigger: TRIGGER,
  sequenceId: SEQUENCE_ID,
  csv: CSV,
  loggedEmailContains: (row: Row) => [row['First Name']],
};

const uiFlow = createFlow({
  ...common,
  fireEvent: async ({ sequence }, row) => {
    await test.step('Mark the prospect as unsubscribed (Prospects tab > Mark as Unsubscribe)', async () => {
      await sequence.markAsUnsubscribed(SEQUENCE_ID, row['Email']);
    });
  },
});

// Opening the link right after the email arrives can show the page without
// Saleshandy registering it yet (seen on the full spec); retried up to 3 times.
const LINK_ATTEMPTS = 3;
const STEP_1_SUBJECT = 'Save cost & achieve more!';

const linkFlow = createFlow({
  ...common,
  fireEvent: async ({ mailinator, sequence }, row) => {
    await test.step('Open the "Unsubscribe here" link of the delivered email (Mailinator) until the prospect is Unsubscribed', async () => {
      for (let attempt = 1; attempt <= LINK_ATTEMPTS; attempt++) {
        const page = await mailinator!.openUnsubscribeLink(row['Email'], STEP_1_SUBJECT);
        unsubscribePages.set(row['Email'], page);
        await expect(page.getByText(UNSUBSCRIBED_PAGE_TEXT), 'unsubscribe page').toBeVisible();
        const registered = await sequence.expectProspectStatus(SEQUENCE_ID, row['Email'], 'Unsubscribed', 60_000).then(() => true, () => false);
        test.info().annotations.push({ type: 'Unsubscribe link', description: `attempt ${attempt}: ${registered ? 'Unsubscribed' : 'not registered yet'}` });
        if (registered) return;
      }
      throw new Error(`${row['Email']} did not show Unsubscribed after the link was opened ${LINK_ATTEMPTS} times`);
    });
  },
});

type Flow = ReturnType<typeof createFlow>;

type F = {
  integration: HubSpotIntegrationPage;
  sequence: SaleshandySequencePage;
  crm: SaleshandyCrmPage;
  mailinator: MailinatorPage;
  contacts: HubSpotContactsPage;
  deals: HubSpotDealsPage;
  companies: HubSpotCompaniesPage;
  ctx: { sequence: SaleshandySequencePage; mailinator: MailinatorPage; crm: SaleshandyCrmPage; integration: HubSpotIntegrationPage };
};

function row(title: string, body: (f: F) => Promise<void>): void {
  test(title, async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals, hubspotCompanies }) => {
    await body({
      integration: saleshandyIntegration,
      sequence: saleshandySequence,
      crm: saleshandyCrm,
      mailinator,
      contacts: hubspotContacts,
      deals: hubspotDeals,
      companies: hubspotCompanies,
      ctx: { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration },
    });
  });
}

function uiRow(title: string, body: (integration: HubSpotIntegrationPage) => Promise<void>): void {
  test(title, async ({ saleshandyIntegration }) => {
    await body(saleshandyIntegration);
  });
}

// ---- Shared steps ----

const CREATE_CONTACT_LABELS = ['Lead Status', 'Lead Lifecycle'];
const UPDATE_CONTACT_LABELS = ['Update Lead Status', 'Update Lead Lifecycle'];
const CREATE_DEAL_LABELS = ['Select Pipeline (when to create)', 'Select Pipeline Stage (when to create)', 'Deal Type (while creating)', 'Deal Priority (while creating)'];
const UPDATE_DEAL_LABELS = ['Select Pipeline (when to update)', 'Select Pipeline Stage (when to update)', 'Deal Type (while updating)', 'Deal Priority (while updating)'];

async function skipped(flow: Flow, f: F, activity: string, labels: string[]): Promise<void> {
  await test.step(`Select only ${activity}, nothing chosen in Extra Configuration`, async () => {
    await flow.useOnly(f.integration, activity, {}, labels);
  });
}

async function withValues(flow: Flow, f: F, activity: string, values: Record<string, string>, what: string): Promise<void> {
  await test.step(`Select only ${activity}: ${what}`, async () => {
    await flow.useOnly(f.integration, activity, values, []);
  });
}

async function usePaired(flow: Flow, f: F, activity: string, values: Record<string, string>, labels: string[], companion: string): Promise<void> {
  await test.step(`Select ${activity} and ${companion}`, async () => {
    await flow.useOnly(f.integration, activity, values, labels);
    // The dialog's own save toast is still up for a moment; wait for it so the next one is the page Save's.
    await expect(f.integration.savedToast()).toBeHidden({ timeout: 15_000 });
    await f.integration.selectActivity(flow.trigger, companion);
    await f.integration.save();
    await expect(f.integration.savedToast(), 'save confirmation').toBeVisible({ timeout: 30_000 });
  });
}

async function useTask(flow: Flow, f: F): Promise<void> {
  await test.step(`Select only Create a Task: "${TASK.title}", ${TASK.type}, ${TASK.priority}, Due in ${TASK.dueDays}`, async () => {
    await flow.startClean(f.integration);
    await f.integration.selectActivity(flow.trigger, CREATE_TASK);
    await f.integration.configTextbox('Task Title').fill(TASK.title);
    await f.integration.chooseConfigOption('Task Type', TASK.type);
    await f.integration.chooseConfigOption('Task Priority', TASK.priority);
    await f.integration.dueIn().fill(String(TASK.dueDays));
    await f.integration.configSaveButton().click();
    await expect(f.integration.savedToast(), 'save confirmation').toBeVisible({ timeout: 30_000 });
  });
}

// Adds the prospect, waits for step 1, fires the unsubscribe, then checks the
// Prospects tab. Returns the log ids from before the unsubscribe.
async function fire(flow: Flow, f: F, r: Row, beforeSend?: () => Promise<void>): Promise<Set<string>> {
  const known = await flow.runTrigger(f.ctx, r, beforeSend);
  await test.step('The Prospects tab shows Unsubscribed', async () => {
    await f.sequence.expectProspectStatus(SEQUENCE_ID, r['Email'], 'Unsubscribed');
  });
  return known;
}

async function logsSuccess(flow: Flow, f: F, known: Set<string>, timeout?: number): Promise<void> {
  await test.step('Check Logs: new entries are Success', async () => {
    await flow.expectNewLogsSuccess(f.integration, known, timeout);
  });
}

async function logsFinished(flow: Flow, f: F, known: Set<string>, timeout?: number): Promise<void> {
  await test.step('Wait until the new log entries have finished', async () => {
    const statuses = await flow.newLogsFinished(f.integration, known, timeout);
    test.info().annotations.push({ type: 'Log status', description: statuses.join(', ') });
  });
}

const newContact = (contacts: HubSpotContactsPage, r: Row) =>
  contacts.createContact({ email: r['Email'], firstName: r['First Name'], lastName: r['Last Name'], jobTitle: r['Job Title'] });

async function findContact(contacts: HubSpotContactsPage, r: Row): Promise<string> {
  let id = '';
  await untilPasses(`Contact ${r['Email']} not found in HubSpot`, async () => {
    id = await contacts.findContactId(r['Email'], fullName(r));
  });
  return id;
}

async function changeProspect(crm: SaleshandyCrmPage, r: Row, values: Record<string, string>): Promise<void> {
  await crm.search(r['Email']);
  await crm.openProspect(fullName(r));
  for (const [label, value] of Object.entries(values)) await crm.editField(label, value);
}

async function expectOnRecord(contacts: HubSpotContactsPage, typeId: '0-1' | '0-3', id: string, texts: (string | RegExp)[], what: string): Promise<void> {
  await untilPasses(`${what} not found on the HubSpot record ${typeId}/${id}`, async () => {
    const text = await contacts.activitiesText(typeId, id);
    for (const t of texts) {
      if (typeof t === 'string') expect(text, `${what}: "${t}"`).toContain(t);
      else expect(text, `${what}: ${t}`).toMatch(t);
    }
  });
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

async function contactWithDeals(flow: Flow, r: Row, f: F): Promise<string[]> {
  const contactId = await newContact(f.contacts, r);
  const ids: string[] = [];
  for (const d of flow.deals.filter((x) => x['Contact Email'] === r['Email'])) {
    ids.push(await f.deals.createDealForContact(contactId, { name: d['Deal Name'], amount: d['Amount'] }));
  }
  return ids;
}

async function contactWithCompanies(flow: Flow, r: Row, f: F): Promise<string[]> {
  await newContact(f.contacts, r);
  const ids: string[] = [];
  for (const c of flow.companies.filter((x) => x['Contact Email'] === r['Email'])) {
    const id = await f.companies.createCompany({ domain: c['Company Domain'], name: c['Company Name'] });
    await f.companies.associateContacts(id, [{ email: r['Email'], firstName: r['First Name'], lastName: r['Last Name'] }]);
    ids.push(id);
  }
  return ids;
}

function dueDatePattern(days: number): RegExp {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return new RegExp(`${month}[a-z]*\\.?\\s+0?${d.getDate()}\\b`);
}

async function expectContactCreated(f: F, r: Row, extra: Record<string, string> = {}): Promise<void> {
  await test.step('Check the contact in HubSpot has the mapped fields', async () => {
    await expectContact(f.contacts, r, { ...mapped(r), ...extra });
  });
}

async function expectNoContact(f: F, r: Row): Promise<void> {
  await test.step('Check HubSpot: no contact was created', async () => {
    expect(await f.contacts.contactExists(r['Email'], fullName(r)), `contact ${r['Email']} in HubSpot`).toBe(false);
  });
}

const noteTexts = (flow: Flow, r: Row) => ['Note created via Saleshandy', ...flow.noteContains(r, 1)];

// ===========================================================================

test.describe('Prospect is Unsubscribed in Saleshandy (lite)', () => {
  // ---- Phase 1: Extra Configuration skipped (code present, skipped) ----
  // Flip test.skip to false to run these; unsubscribed.spec.ts has the full
  // Phase 1 coverage (both trigger methods, every activity).

  test.describe('Phase 1: Extra Configuration skipped', () => {
    test.beforeEach(() => {
      test.skip(true, 'Phase 1 skipped by design (see unsubscribed-lite.md); run unsubscribed.spec.ts for full Phase 1 coverage');
    });

    row('Create a Contact: Extra Config skipped, contact not in HubSpot', async (f) => {
      const r = uiFlow.rowFor('Create a Contact in HubSpot > 1');
      await skipped(uiFlow, f, CREATE_CONTACT, CREATE_CONTACT_LABELS);
      const known = await fire(uiFlow, f, r);
      await logsSuccess(uiFlow, f, known);
      await expectContactCreated(f, r, { 'Lifecycle stage': 'Lead' });
    });

    row('Update a Contact: Extra Config skipped, contact in HubSpot, details changed', async (f) => {
      const r = uiFlow.rowFor('Update a Contact in HubSpot > 1');
      await skipped(uiFlow, f, UPDATE_CONTACT, UPDATE_CONTACT_LABELS);
      await newContact(f.contacts, r);
      const known = await fire(uiFlow, f, r);
      await logsSuccess(uiFlow, f, known);
    });

    row('Create a deal: Extra Config skipped, contact in HubSpot, no deal', async (f) => {
      const r = uiFlow.rowFor('Create a deal in HubSpot > 1');
      await skipped(uiFlow, f, CREATE_DEAL, CREATE_DEAL_LABELS);
      const contactId = await newContact(f.contacts, r);
      const known = await fire(uiFlow, f, r);
      await logsSuccess(uiFlow, f, known);
      await newDealsOf(f.contacts, contactId, 1, []);
    });

    row('Update a deal: Extra Config skipped, contact has 1 deal', async (f) => {
      const r = uiFlow.rowFor('Update a deal in HubSpot > 1');
      await skipped(uiFlow, f, UPDATE_DEAL, UPDATE_DEAL_LABELS);
      await contactWithDeals(uiFlow, r, f);
      const known = await fire(uiFlow, f, r);
      test.setTimeout(25 * 60_000);
      await logsSuccess(uiFlow, f, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
    });

    row('Create a company: no Extra Configuration, contact in HubSpot', async (f) => {
      const r = uiFlow.rowFor('Create a company in HubSpot > 1');
      await skipped(uiFlow, f, CREATE_COMPANY, []);
      const contactId = await newContact(f.contacts, r);
      const known = await fire(uiFlow, f, r);
      await logsSuccess(uiFlow, f, known);
      await expectCompanies(f.contacts, contactId, 1);
    });

    row('Update a company: no Extra Configuration, contact has 1 associated company', async (f) => {
      const r = uiFlow.rowFor('Update a company in HubSpot > 1');
      await skipped(uiFlow, f, UPDATE_COMPANY, []);
      await contactWithCompanies(uiFlow, r, f);
      const known = await fire(uiFlow, f, r, async () => {
        await changeProspect(f.crm, r, { City: r['Updated City'], State: r['Updated State'] });
      });
      await logsSuccess(uiFlow, f, known);
    });

    uiRow('Create a Task: Task Title empty (UI only)', async (integration) => {
      await uiFlow.startClean(integration);
      await integration.selectActivity(TRIGGER, CREATE_TASK);
      await integration.chooseConfigOption('Task Type', 'Call');
      await integration.chooseConfigOption('Task Priority', 'Medium');
      await integration.dueIn().fill('3');
      await integration.configTextbox('Task Title').fill('');
      await expect(integration.configSaveButton(), 'Save with an empty title').toBeDisabled();
      await integration.cancelExtraConfiguration();
      await integration.removeActivity(TRIGGER, CREATE_TASK);
    });

    row('Create a Note: no Extra Configuration, paired with Create a Contact (skipped)', async (f) => {
      const r = uiFlow.rowFor('Create a Note in HubSpot > 1');
      await usePaired(uiFlow, f, CREATE_CONTACT, {}, CREATE_CONTACT_LABELS, CREATE_NOTE);
      const known = await fire(uiFlow, f, r);
      await logsSuccess(uiFlow, f, known);
    });

    row('Record (log) an email activity: no Extra Configuration, paired with Create a Contact (skipped)', async (f) => {
      const r = uiFlow.rowFor('Record (log) an email activity in HubSpot > 1');
      await usePaired(uiFlow, f, CREATE_CONTACT, {}, CREATE_CONTACT_LABELS, RECORD_EMAIL);
      const known = await fire(uiFlow, f, r);
      await logsSuccess(uiFlow, f, known);
    });
  });

  // ---- Phase 2: Extra Configuration values ----

  test.describe('Phase 2: Extra Configuration values', () => {
    // -- Trigger behavior (baseline) --

    row('Baseline 1: Unsubscribe (UI), Create a Contact (values), contact not in HubSpot', async (f) => {
      const r = uiFlow.rowFor('Trigger behavior (baseline) > 1');
      await withValues(uiFlow, f, CREATE_CONTACT, CREATE_CONTACT_VALUES, 'Lead Status Open, Lead Lifecycle Marketing Qualified Lead');
      const known = await fire(uiFlow, f, r);
      await logsSuccess(uiFlow, f, known);
      await expectContactCreated(f, r, { 'Lead status': 'Open', 'Lifecycle stage': 'Marketing Qualified Lead' });
    });

    row('Baseline 2: Unsubscribe (link), same activity and values, contact not in HubSpot', async (f) => {
      const r = linkFlow.rowFor('Trigger behavior (baseline) > 2');
      const known = await fire(linkFlow, f, r);
      await test.step('The unsubscribe page offers "Subscribe here" and "Report spam"', async () => {
        const page = unsubscribePages.get(r['Email'])!;
        await expect(page.getByRole('link', { name: 'Subscribe here' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Report spam' })).toBeVisible();
      });
      await logsSuccess(linkFlow, f, known);
      await expectContactCreated(f, r, { 'Lead status': 'Open', 'Lifecycle stage': 'Marketing Qualified Lead' });
    });

    row('Baseline 3: Prospect unsubscribed by the link, "Subscribe here" returns it to Completed', async (f) => {
      const r = linkFlow.rowFor('Trigger behavior (baseline) > 3');
      await fire(linkFlow, f, r);
      await test.step('Click "Subscribe here" on the unsubscribe page', async () => {
        const page = unsubscribePages.get(r['Email'])!;
        await page.getByRole('link', { name: 'Subscribe here' }).click();
        await expect(page.getByText(SUBSCRIBED_PAGE_TEXT)).toBeVisible();
      });
      await test.step('The prospect is back to Completed on the Prospects tab', async () => {
        await f.sequence.expectProspectStatus(SEQUENCE_ID, r['Email'], 'Completed');
      });
    });

    // -- Create a Contact in HubSpot --

    row('Create a Contact 1: Contact already at a later Lifecycle Stage (Customer, set by hand)', async (f) => {
      const r = uiFlow.rowFor('Create a Contact in HubSpot > 1');
      await withValues(uiFlow, f, CREATE_CONTACT, CREATE_CONTACT_VALUES, 'Lifecycle Marketing Qualified Lead');
      await test.step('Create the contact in HubSpot and set its Lifecycle stage to Customer', async () => {
        const contactId = await newContact(f.contacts, r);
        await f.contacts.setDropdownProperty(contactId, 'Lifecycle stage', 'Customer');
      });
      const known = await fire(uiFlow, f, r);
      await logsSuccess(uiFlow, f, known);
      await test.step('Check the contact in HubSpot stays at Customer (HubSpot blocks backward moves)', async () => {
        await expectContact(f.contacts, r, { 'Lifecycle stage': 'Customer' });
      });
    });

    row('Create a Contact 2: Contact already in HubSpot, prospect details changed in Saleshandy', async (f) => {
      const r = uiFlow.rowFor('Create a Contact in HubSpot > 2');
      await withValues(uiFlow, f, CREATE_CONTACT, CREATE_CONTACT_VALUES, 'Lead Status Open, Lead Lifecycle Marketing Qualified Lead');
      await test.step('Create the contact in HubSpot', async () => {
        await newContact(f.contacts, r);
      });
      const known = await fire(uiFlow, f, r, async () => {
        await test.step('Change Job Title and City in Saleshandy', async () => {
          await changeProspect(f.crm, r, { 'Job Title': r['Updated Job Title'], City: r['Updated City'] });
        });
      });
      await logsSuccess(uiFlow, f, known);
      await test.step('Check the contact in HubSpot shows the new values', async () => {
        await expectContact(f.contacts, r, { 'Job title': r['Updated Job Title'], City: r['Updated City'] });
      });
    });

    // -- Update a Contact in HubSpot --

    row('Update a Contact 1: Contact in HubSpot', async (f) => {
      const r = uiFlow.rowFor('Update a Contact in HubSpot > 1');
      await withValues(uiFlow, f, UPDATE_CONTACT, UPDATE_CONTACT_VALUES, 'Lead Status Connected, Lifecycle Sales Qualified Lead');
      await test.step('Create the contact in HubSpot', async () => {
        await newContact(f.contacts, r);
      });
      const known = await fire(uiFlow, f, r);
      await logsSuccess(uiFlow, f, known);
      await test.step('Check the contact in HubSpot: Lead status Connected, Lifecycle stage Sales Qualified Lead', async () => {
        await expectContact(f.contacts, r, { 'Lead status': 'Connected', 'Lifecycle stage': 'Sales Qualified Lead' });
      });
    });

    row('Update a Contact 2: Contact not in HubSpot', async (f) => {
      const r = uiFlow.rowFor('Update a Contact in HubSpot > 2');
      await withValues(uiFlow, f, UPDATE_CONTACT, UPDATE_CONTACT_VALUES, 'Lead Status Connected, Lifecycle Sales Qualified Lead');
      const known = await fire(uiFlow, f, r);
      await logsSuccess(uiFlow, f, known);
      await expectNoContact(f, r);
    });

    // -- Create a deal in HubSpot --

    row('Create a deal 1: Contact not in HubSpot, Closing Date 0 Days', async (f) => {
      const r = uiFlow.rowFor('Create a deal in HubSpot > 1');
      await withValues(uiFlow, f, CREATE_DEAL, dealConfig('0'), 'Sales Pipeline, Initial Contact, New Business, High, 0 Days');
      const known = await fire(uiFlow, f, r);
      await logsSuccess(uiFlow, f, known);
      await test.step('Check HubSpot: contact and deal created and associated with the configured values, no close date', async () => {
        const [deal] = await newDealsOf(f.contacts, await findContact(f.contacts, r), 1, []);
        expect(await f.deals.summary(deal.id), 'deal').toMatchObject({ pipeline: 'Sales Pipeline', stage: 'Initial Contact', dealType: 'New Business', priority: 'High', closeDate: '--' });
      });
    });

    row('Create a deal 2: Contact already has 1 deal', async (f) => {
      const r = uiFlow.rowFor('Create a deal in HubSpot > 2');
      const existing = uiFlow.deals.filter((d) => d['Contact Email'] === r['Email']);
      await withValues(uiFlow, f, CREATE_DEAL, dealConfig('0'), 'Sales Pipeline, Initial Contact, New Business, High, 0 Days');
      let contactId = '';
      await test.step(`Create the contact in HubSpot with ${existing.length} deal`, async () => {
        contactId = await newContact(f.contacts, r);
        for (const d of existing) await f.deals.createDealForContact(contactId, { name: d['Deal Name'], amount: d['Amount'] });
      });
      const known = await fire(uiFlow, f, r);
      await logsSuccess(uiFlow, f, known);
      await test.step('Check HubSpot: the contact now has one more deal', async () => {
        const fresh = await newDealsOf(f.contacts, contactId, existing.length + 1, existing.map((d) => d['Deal Name']));
        expect(fresh.length, 'new deals').toBe(1);
      });
    });

    row('Create a deal 3: Prospect has Deal Value, Closing Date 1 Day', async (f) => {
      const r = uiFlow.rowFor('Create a deal in HubSpot > 3');
      await withValues(uiFlow, f, CREATE_DEAL, dealConfig('1'), 'Sales Pipeline, Initial Contact, New Business, High, 1 Day');
      const known = await fire(uiFlow, f, r);
      await logsSuccess(uiFlow, f, known);
      await test.step(`Check HubSpot: Amount = Deal Value ${r['Deal Value']}, close date 1 day from today`, async () => {
        const [deal] = await newDealsOf(f.contacts, await findContact(f.contacts, r), 1, []);
        await expect(async () => {
          const summary = await f.deals.summary(deal.id);
          expect(summary.amount.replace(/[^0-9.]/g, ''), 'Amount').toMatch(new RegExp(`^${r['Deal Value']}(\\.0+)?$`));
          expect(summary.closeDate, 'Close Date').toBe(daysFromToday(1));
        }).toPass({ timeout: 60_000 });
      });
    });

    // -- Update a deal in HubSpot --

    row('Update a deal 1: Contact has 1 deal', async (f) => {
      const r = uiFlow.rowFor('Update a deal in HubSpot > 1');
      await withValues(uiFlow, f, UPDATE_DEAL, dealUpdateConfig('0'), 'Sales Pipeline, Follow-Up, New Business, High, 0 Days');
      const dealIds = await contactWithDeals(uiFlow, r, f);
      const known = await fire(uiFlow, f, r);
      test.setTimeout(25 * 60_000);
      await logsSuccess(uiFlow, f, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
      await test.step('Check HubSpot: the deal shows Sales Pipeline, Follow-Up, New Business, High', async () => {
        await expect(async () => {
          expect(await f.deals.summary(dealIds[0]), 'deal').toMatchObject({ pipeline: 'Sales Pipeline', stage: 'Follow-Up', dealType: 'New Business', priority: 'High' });
        }).toPass({ timeout: 60_000 });
      });
    });

    row('Update a deal 2: Contact has 3 deals (AL-4103)', async (f) => {
      const r = uiFlow.rowFor('Update a deal in HubSpot > 2');
      await withValues(uiFlow, f, UPDATE_DEAL, dealUpdateConfig('0'), 'Sales Pipeline, Follow-Up, New Business, High, 0 Days');
      let dealIds: string[] = [];
      const before: unknown[] = [];
      await test.step('Create the contact in HubSpot with 3 deals, one after the other', async () => {
        dealIds = await contactWithDeals(uiFlow, r, f);
        expect(dealIds.length, 'deals created').toBe(3);
        for (const id of dealIds.slice(0, 2)) before.push(await f.deals.summary(id));
      });
      const known = await fire(uiFlow, f, r);
      test.setTimeout(25 * 60_000);
      await logsSuccess(uiFlow, f, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
      await test.step('Check HubSpot: the latest created deal is updated (AL-4103)', async () => {
        await expect(async () => {
          expect(await f.deals.summary(dealIds[2]), 'latest created deal').toMatchObject({ pipeline: 'Sales Pipeline', stage: 'Follow-Up', dealType: 'New Business', priority: 'High' });
        }).toPass({ timeout: 60_000 });
      });
      await test.step('Check HubSpot: the 2 older deals are unchanged', async () => {
        for (const [i, id] of dealIds.slice(0, 2).entries()) {
          expect(await f.deals.summary(id), `deal ${i + 1}`).toEqual(before[i]);
        }
      });
    });

    row('Update a deal 3: Contact has 0 deals', async (f) => {
      const r = uiFlow.rowFor('Update a deal in HubSpot > 3');
      await withValues(uiFlow, f, UPDATE_DEAL, dealUpdateConfig('0'), 'Sales Pipeline, Follow-Up, New Business, High, 0 Days');
      let contactId = '';
      await test.step('Create the contact in HubSpot, no deal', async () => {
        contactId = await newContact(f.contacts, r);
      });
      const known = await fire(uiFlow, f, r);
      test.setTimeout(25 * 60_000);
      await logsFinished(uiFlow, f, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
      await test.step('Check HubSpot: the contact still has no deal', async () => {
        expect((await f.contacts.associations(contactId, 'deals')).count, 'deals on the contact').toBe(0);
      });
    });

    // -- Create a company in HubSpot --

    row('Create a company 1: Contact in HubSpot, prospect has company details', async (f) => {
      const r = uiFlow.rowFor('Create a company in HubSpot > 1');
      await skipped(uiFlow, f, CREATE_COMPANY, []);
      let contactId = '';
      await test.step('Create the contact in HubSpot', async () => {
        contactId = await newContact(f.contacts, r);
      });
      const known = await fire(uiFlow, f, r);
      await logsSuccess(uiFlow, f, known);
      await test.step('Check HubSpot: one company associated to the contact', async () => {
        await expectCompanies(f.contacts, contactId, 1);
      });
    });

    row('Create a company 2: A company with the same domain already exists', async (f) => {
      const r = uiFlow.rowFor('Create a company in HubSpot > 2');
      const existing = uiFlow.companies.find((c) => !c['Contact Email']);
      if (!existing) throw new Error('No company without a Contact Email in the -companies CSV (the "same domain" company)');
      await skipped(uiFlow, f, CREATE_COMPANY, []);
      let existingId = '';
      await test.step(`Create the company ${existing['Company Name']} (${existing['Company Domain']}) in HubSpot`, async () => {
        existingId = await f.companies.createCompany({ domain: existing['Company Domain'], name: existing['Company Name'] });
      });
      const known = await fire(uiFlow, f, r);
      await logsSuccess(uiFlow, f, known);
      await test.step('Check HubSpot: a new company is associated to the contact, not the existing one', async () => {
        const [company] = await expectCompanies(f.contacts, await findContact(f.contacts, r), 1);
        expect(company.id, 'associated company is a new one').not.toBe(existingId);
      });
    });

    row('Create a company 3: Contact not in HubSpot', async (f) => {
      const r = uiFlow.rowFor('Create a company in HubSpot > 3');
      await skipped(uiFlow, f, CREATE_COMPANY, []);
      const known = await fire(uiFlow, f, r);
      test.setTimeout(15 * 60_000);
      await logsSuccess(uiFlow, f, known, 10 * 60_000);
      await test.step('Check HubSpot: contact created with one associated company', async () => {
        await expectCompanies(f.contacts, await findContact(f.contacts, r), 1);
      });
    });

    // -- Update a company in HubSpot --

    row('Update a company 1: Contact has 1 associated company, company details changed in Saleshandy', async (f) => {
      const r = uiFlow.rowFor('Update a company in HubSpot > 1');
      await skipped(uiFlow, f, UPDATE_COMPANY, []);
      const companyIds = await contactWithCompanies(uiFlow, r, f);
      const known = await fire(uiFlow, f, r, async () => {
        await test.step('Change City and State in Saleshandy', async () => {
          await changeProspect(f.crm, r, { City: r['Updated City'], State: r['Updated State'] });
        });
      });
      await logsSuccess(uiFlow, f, known);
      await test.step('Check HubSpot: the company shows the new City and State', async () => {
        await expectCompanyValues(f.companies, companyIds[0], { City: r['Updated City'], 'State/Region': r['Updated State'] });
      });
    });

    row('Update a company 2: Contact not in HubSpot', async (f) => {
      const r = uiFlow.rowFor('Update a company in HubSpot > 2');
      await skipped(uiFlow, f, UPDATE_COMPANY, []);
      const known = await fire(uiFlow, f, r);
      await logsSuccess(uiFlow, f, known);
      await expectNoContact(f, r);
    });

    // -- Create a Task in HubSpot --

    row('Create a Task 1: Contact in HubSpot', async (f) => {
      const r = uiFlow.rowFor('Create a Task in HubSpot > 1');
      await useTask(uiFlow, f);
      let contactId = '';
      await test.step('Create the contact in HubSpot', async () => {
        contactId = await newContact(f.contacts, r);
      });
      const known = await fire(uiFlow, f, r);
      await logsSuccess(uiFlow, f, known);
      await test.step(`Check HubSpot: task "${TASK.title}" on the contact, due ${TASK.dueDays} days from today`, async () => {
        await expectOnRecord(f.contacts, '0-1', contactId, [TASK.title, dueDatePattern(TASK.dueDays)], 'Task');
      });
    });

    row('Create a Task 2: Contact not in HubSpot', async (f) => {
      const r = uiFlow.rowFor('Create a Task in HubSpot > 2');
      await useTask(uiFlow, f);
      const known = await fire(uiFlow, f, r);
      await logsSuccess(uiFlow, f, known);
      await test.step('Check HubSpot: contact created with the task on it', async () => {
        await expectOnRecord(f.contacts, '0-1', await findContact(f.contacts, r), [TASK.title, dueDatePattern(TASK.dueDays)], 'Task');
      });
    });

    uiRow('Create a Task 3: Due In 0 (UI only, validation)', async (integration) => {
      await uiFlow.startClean(integration);
      await integration.selectActivity(TRIGGER, CREATE_TASK);
      await integration.configTextbox('Task Title').fill(TASK.title);
      await integration.chooseConfigOption('Task Type', 'Call');
      await integration.chooseConfigOption('Task Priority', 'Medium');
      await integration.dueIn().fill('0');
      await expect(integration.configSaveButton(), 'Save with Due In 0').toBeDisabled();
      await integration.cancelExtraConfiguration();
      await integration.removeActivity(TRIGGER, CREATE_TASK);
    });

    // -- Create a Note in HubSpot --

    row('Create a Note 1: Paired with Create a Contact (values), contact not in HubSpot', async (f) => {
      const r = uiFlow.rowFor('Create a Note in HubSpot > 1');
      await usePaired(uiFlow, f, CREATE_CONTACT, CREATE_CONTACT_VALUES, [], CREATE_NOTE);
      const known = await fire(uiFlow, f, r);
      await logsSuccess(uiFlow, f, known);
      await test.step('Check HubSpot: contact created, note on it with Step, Variant and Prospect Email', async () => {
        await expectOnRecord(f.contacts, '0-1', await findContact(f.contacts, r), noteTexts(uiFlow, r), 'Note');
      });
    });

    row('Create a Note 2: Paired with Create a deal (values), contact not in HubSpot', async (f) => {
      const r = uiFlow.rowFor('Create a Note in HubSpot > 2');
      await usePaired(uiFlow, f, CREATE_DEAL, dealConfig('1'), [], CREATE_NOTE);
      const known = await fire(uiFlow, f, r);
      await logsSuccess(uiFlow, f, known);
      await test.step('Check HubSpot: note on both the contact and the deal', async () => {
        const contactId = await findContact(f.contacts, r);
        const [deal] = await newDealsOf(f.contacts, contactId, 1, []);
        await expectOnRecord(f.contacts, '0-1', contactId, noteTexts(uiFlow, r), 'Note on the contact');
        await expectOnRecord(f.contacts, '0-3', deal.id, noteTexts(uiFlow, r), 'Note on the deal');
      });
    });

    row('Create a Note 3: Paired with Update a deal (1 deal)', async (f) => {
      const r = uiFlow.rowFor('Create a Note in HubSpot > 3');
      await usePaired(uiFlow, f, UPDATE_DEAL, dealUpdateConfig('0'), [], CREATE_NOTE);
      const dealIds = await contactWithDeals(uiFlow, r, f);
      const known = await fire(uiFlow, f, r);
      test.setTimeout(25 * 60_000);
      await logsSuccess(uiFlow, f, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
      // QA, 2026-10-14: with Update a deal the contact and the deal both receive the note.
      await test.step('Check HubSpot: note on the deal and on the contact', async () => {
        await expectOnRecord(f.contacts, '0-3', dealIds[0], noteTexts(uiFlow, r), 'Note on the deal');
        await expectOnRecord(f.contacts, '0-1', await findContact(f.contacts, r), noteTexts(uiFlow, r), 'Note on the contact');
      });
    });

    // -- Record (log) an email activity in HubSpot --

    row('Record (log) an email activity 1: Paired with Create a Contact (values), contact not in HubSpot', async (f) => {
      const r = uiFlow.rowFor('Record (log) an email activity in HubSpot > 1');
      await usePaired(uiFlow, f, CREATE_CONTACT, CREATE_CONTACT_VALUES, [], RECORD_EMAIL);
      const known = await fire(uiFlow, f, r);
      await logsSuccess(uiFlow, f, known);
      await test.step('Check HubSpot: contact created, email logged on it', async () => {
        await expectOnRecord(f.contacts, '0-1', await findContact(f.contacts, r), uiFlow.loggedEmailContains(r, 1), 'Logged email');
      });
    });

    row('Record (log) an email activity 2: Paired with Create a deal (values), contact not in HubSpot', async (f) => {
      const r = uiFlow.rowFor('Record (log) an email activity in HubSpot > 2');
      await usePaired(uiFlow, f, CREATE_DEAL, dealConfig('1'), [], RECORD_EMAIL);
      const known = await fire(uiFlow, f, r);
      await logsSuccess(uiFlow, f, known);
      await test.step('Check HubSpot: email logged on both the deal and the contact', async () => {
        const contactId = await findContact(f.contacts, r);
        const [deal] = await newDealsOf(f.contacts, contactId, 1, []);
        await expectOnRecord(f.contacts, '0-1', contactId, uiFlow.loggedEmailContains(r, 1), 'Logged email on the contact');
        await expectOnRecord(f.contacts, '0-3', deal.id, uiFlow.loggedEmailContains(r, 1), 'Logged email on the deal');
      });
    });

    row('Record (log) an email activity 3: Paired with Update a deal, contact has 3 deals (AL-4103, AL-4123)', async (f) => {
      const r = uiFlow.rowFor('Record (log) an email activity in HubSpot > 3');
      await usePaired(uiFlow, f, UPDATE_DEAL, dealUpdateConfig('0'), [], RECORD_EMAIL);
      let dealIds: string[] = [];
      await test.step('Create the contact in HubSpot with 3 deals, one after the other', async () => {
        dealIds = await contactWithDeals(uiFlow, r, f);
        expect(dealIds.length, 'deals created').toBe(3);
      });
      const known = await fire(uiFlow, f, r);
      test.setTimeout(25 * 60_000);
      await logsSuccess(uiFlow, f, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
      await test.step('Check HubSpot: the latest created deal is updated (AL-4103)', async () => {
        await expect(async () => {
          expect(await f.deals.summary(dealIds[2]), 'latest created deal').toMatchObject({ pipeline: 'Sales Pipeline', stage: 'Follow-Up', dealType: 'New Business', priority: 'High' });
        }).toPass({ timeout: 60_000 });
      });
      // QA, 2026-10-15: Update a deal + Record email logs the email on the
      // latest deal and the contact, not on the two older deals. The card
      // must not say "Unknown Contact".
      await test.step('Check HubSpot: email logged on the latest deal and the contact, not "Unknown Contact"', async () => {
        const contactId = await findContact(f.contacts, r);
        await expectOnRecord(f.contacts, '0-3', dealIds[2], uiFlow.loggedEmailContains(r, 1), 'Logged email on the deal');
        expect(await f.contacts.activitiesText('0-3', dealIds[2]), 'deal Activities').not.toContain('Unknown Contact');
        for (const [i, id] of dealIds.slice(0, 2).entries()) {
          expect(await f.contacts.activitiesText('0-3', id), `older deal ${i + 1} Activities`).not.toContain(uiFlow.loggedEmailContains(r, 1)[0]);
        }
        await expectOnRecord(f.contacts, '0-1', contactId, uiFlow.loggedEmailContains(r, 1), 'Logged email on the contact');
      });
    });
  });
});
