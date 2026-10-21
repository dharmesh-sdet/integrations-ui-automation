// Prospect is Unsubscribed in Saleshandy (AL-4015), Regression.
// Scenarios: test-cases/hubspot/unsubscribed.md (Phase 1: Extra Configuration
// skipped or none; Phase 2: values). Data: test-data/hubspot/unsubscribed.csv
// (+ -deals, -companies), one row per scenario (Scenario column); every row is
// replaced by a new person before each run (src/data/global-setup.ts).
//
// The event is an unsubscribe, done two ways (QA, 2026-10-14):
//  - "Unsubscribe (UI)": Prospects tab > tick the prospect > Mark as Unsubscribe;
//  - "Unsubscribe (link)": the "Unsubscribe here" link of the delivered email,
//    read from the prospect's public Mailinator inbox.
// Baseline rows 2 to 6 were walked by the playwright-test-generator agent on
// 2026-10-15 (tests/hubspot/unsubscribed-generated/); their steps are folded
// into the page objects (SaleshandySequencePage.markAsUnsubscribed,
// markAsResumed, MailinatorPage.openUnsubscribeLink). The activity rows reuse
// the checks of src/flows/activity-rows.ts and tests/hubspot/email-bounced*.spec.ts,
// which other workflows already verified, because the generator agent cannot
// run one agent per row for 60 rows.
//
// Phase 1 comes first: saved Extra Configuration values can never be cleared
// again, so rows that need "skipped" skip themselves once values are saved.
import type { Page } from '@playwright/test';
import type { Row } from '../../src/data/csv.ts';
import { expect, test } from '../../src/fixtures/index.ts';
import { CREATE_COMPANY, CREATE_CONTACT, CREATE_DEAL, CREATE_NOTE, CREATE_TASK, RECORD_EMAIL, UPDATE_COMPANY, UPDATE_CONTACT, UPDATE_DEAL } from '../../src/flows/activity-rows.ts';
import { createFlow, daysFromToday, dealConfig, dealUpdateConfig as sharedDealUpdateConfig, expectContact, fullName, mapped, newDealsOf } from '../../src/flows/saleshandy-to-hubspot.ts';
import type { MailinatorPage } from '../../src/pages/mailinator.page.ts';
import type { HubSpotCompaniesPage } from '../../src/pages/hubspot/companies.page.ts';
import type { HubSpotContactsPage } from '../../src/pages/hubspot/contacts.page.ts';
import type { HubSpotDealsPage } from '../../src/pages/hubspot/deals.page.ts';
import type { SaleshandyCrmPage } from '../../src/pages/saleshandy/crm.page.ts';
import type { HubSpotIntegrationPage } from '../../src/pages/saleshandy/hubspot-integration.page.ts';
import type { SaleshandySequencePage } from '../../src/pages/saleshandy/sequence.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';

test.use({ account: 'unsubscribed' });

// Name on Triggers & Activity and in Logs (seen 2026-10-15).
const TRIGGER = 'Prospect is Unsubscribed in Saleshandy';
// Sequence "HubSpot Prospect Unsubscribed QA" on the unsubscribed account (one
// step, Active, sender attached, Unsubscribe as Link saved), 2026-10-15.
const SEQUENCE_ID = '196738';
const CSV = 'hubspot/unsubscribed.csv';
// Subject of the step 1 email (template 1, seen 2026-10-15).
const STEP_1_SUBJECT = 'Save cost & achieve more!';
const UNSUBSCRIBED_PAGE_TEXT = "You will no longer receive emails from us. We're sorry to see you go.";
const SUBSCRIBED_PAGE_TEXT = 'You have successfully subscribed and added to our list for future communication';
// Observed 2026-10-12: the Update a Deal log stays RUNNING for about 7.5 minutes.
const UPDATE_DEAL_LOG_TIMEOUT_MS = 12 * 60_000;

// The unsubscribe page each link row opened, by prospect email (used by the
// "Subscribe here" row).
const unsubscribePages = new Map<string, Page>();

const common = {
  trigger: TRIGGER,
  sequenceId: SEQUENCE_ID,
  csv: CSV,
  // The header text of the logged email for this trigger is not seen yet
  // (Link Clicked shows "Logged email by Link Clicked via Saleshandy"), so
  // only the prospect's first name, which the step body starts with, is checked.
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

// Opening the link right after the email arrives showed the "unsubscribed" page
// but Saleshandy kept the prospect Completed (first run, 2026-10-15); the same
// link opened minutes later unsubscribed it at once. So the link is opened
// again, up to 3 times, until the Prospects tab shows Unsubscribed.
const LINK_ATTEMPTS = 3;

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

// One scenario row with every page the unsubscribe rows need.
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

// A row that only touches Triggers & Activity.
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
const CREATE_CONTACT_VALUES = { 'Lead Status': 'Open', 'Lead Lifecycle': 'Marketing Qualified Lead' };
const UPDATE_CONTACT_VALUES = { 'Update Lead Status': 'Connected', 'Update Lead Lifecycle': 'Sales Qualified Lead' };
const TASK = { title: 'Follow up from the workflow', type: 'Call', priority: 'Medium', dueDays: 3 };
// Update a Deal with the Stage two positions after Prospecting (a deal made
// through HubSpot's UI starts at Prospecting, seen 2026-10-13).
const dealUpdateConfig = (closingDays: string) => ({
  ...sharedDealUpdateConfig(closingDays),
  'Select Pipeline Stage (when to update)': 'Follow-Up',
});

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

// Selects `activity` and a companion without Extra Configuration (Create a
// Note, Record (log)), then the page Save.
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

// Adds the prospect, waits for step 1 to be sent, fires the unsubscribe, then
// checks the Prospects tab. Returns the log ids from before the unsubscribe.
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

// The contact with its deals from the -deals CSV, in file order (the last one
// is the latest created). Returns the deal ids.
async function contactWithDeals(flow: Flow, r: Row, f: F): Promise<string[]> {
  const contactId = await newContact(f.contacts, r);
  const ids: string[] = [];
  for (const d of flow.deals.filter((x) => x['Contact Email'] === r['Email'])) {
    ids.push(await f.deals.createDealForContact(contactId, { name: d['Deal Name'], amount: d['Amount'] }));
  }
  return ids;
}

// The contact with its companies from the -companies CSV, each associated to
// it (the last one is the latest associated). Returns the company ids.
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

// The prospect's own contact and its mapped fields in HubSpot.
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

// ===========================================================================

test.describe('Prospect is Unsubscribed in Saleshandy', () => {
  // ---- Phase 1: Extra Configuration skipped or none ----

  // -- Trigger behavior (baseline) --

  uiRow('Trigger behavior (baseline) > 1: Trigger off, enable and save', async (integration) => {
    await test.step(`Open Triggers & Activity and turn "${TRIGGER}" off`, async () => {
      await integration.openTriggers();
      await integration.disable(TRIGGER);
      expect(await integration.isTriggerOn(TRIGGER), 'trigger is off').toBe(false);
    });
    await test.step(`Turn "${TRIGGER}" on, every other trigger off`, async () => {
      await integration.enableOnly(TRIGGER);
      expect(await integration.isTriggerOn(TRIGGER), 'trigger is on').toBe(true);
    });
    await test.step(`Select "${CREATE_CONTACT}" only`, async () => {
      for (const activity of await integration.selectedActivities(TRIGGER)) await integration.removeActivity(TRIGGER, activity);
      await expect.poll(() => integration.selectedActivities(TRIGGER), 'activities left selected').toEqual([]);
      await integration.selectActivity(TRIGGER, CREATE_CONTACT);
    });
    await test.step('Skip Extra Configuration: Cancel the dialog', async () => {
      await expect(integration.extraConfiguration()).toBeVisible();
      await integration.cancelExtraConfiguration();
      await expect(integration.extraConfiguration()).toBeHidden();
    });
    await test.step('Click Save: "Configuration Updated Successfully" shows', async () => {
      await integration.save();
      await expect(integration.savedToast(), 'save confirmation').toBeVisible({ timeout: 30_000 });
    });
  });

  row('Trigger behavior (baseline) > 2: Unsubscribe (UI), Create a Contact, contact not in HubSpot', async (f) => {
    const r = uiFlow.rowFor('Trigger behavior (baseline) > 2');
    await skipped(uiFlow, f, CREATE_CONTACT, CREATE_CONTACT_LABELS);
    const known = await fire(uiFlow, f, r);
    await logsSuccess(uiFlow, f, known);
    await expectContactCreated(f, r);
  });

  row('Trigger behavior (baseline) > 3: Unsubscribe (link), Create a Contact, contact not in HubSpot', async (f) => {
    const r = linkFlow.rowFor('Trigger behavior (baseline) > 3');
    await skipped(linkFlow, f, CREATE_CONTACT, CREATE_CONTACT_LABELS);
    const known = await fire(linkFlow, f, r);
    await test.step('The unsubscribe page offers "Subscribe here" and "Report spam"', async () => {
      const page = unsubscribePages.get(r['Email'])!;
      await expect(page.getByRole('link', { name: 'Subscribe here' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Report spam' })).toBeVisible();
    });
    await logsSuccess(linkFlow, f, known);
    await expectContactCreated(f, r);
  });

  row('Trigger behavior (baseline) > 4: Unsubscribe link opened a second time', async (f) => {
    const r = linkFlow.rowFor('Trigger behavior (baseline) > 4');
    await skipped(linkFlow, f, CREATE_CONTACT, CREATE_CONTACT_LABELS);
    const first = await fire(linkFlow, f, r);
    await logsSuccess(linkFlow, f, first);
    const second = await linkFlow.knownLogIds(f.integration);
    await test.step('Open the same unsubscribe link a second time', async () => {
      await linkFlow.fireEvent(f.ctx, r, 1);
    });
    await logsSuccess(linkFlow, f, second);
    // "No second contact in HubSpot" is proposed and not asserted yet: the
    // contacts list search shows one row per email, so a duplicate is not told apart here.
  });

  row('Trigger behavior (baseline) > 5: Subscribe here', async (f) => {
    const r = linkFlow.rowFor('Trigger behavior (baseline) > 5');
    await skipped(linkFlow, f, CREATE_CONTACT, CREATE_CONTACT_LABELS);
    const known = await fire(linkFlow, f, r);
    await logsSuccess(linkFlow, f, known);
    await test.step('Click "Subscribe here" on the unsubscribe page', async () => {
      const page = unsubscribePages.get(r['Email'])!;
      await page.getByRole('link', { name: 'Subscribe here' }).click();
      await expect(page.getByText(SUBSCRIBED_PAGE_TEXT)).toBeVisible();
    });
    await test.step('The prospect is back to Completed on the Prospects tab', async () => {
      await f.sequence.expectProspectStatus(SEQUENCE_ID, r['Email'], 'Completed');
    });
  });

  row('Trigger behavior (baseline) > 6: Mark as Resume on an unsubscribed prospect', async (f) => {
    const r = uiFlow.rowFor('Trigger behavior (baseline) > 6');
    await skipped(uiFlow, f, CREATE_CONTACT, CREATE_CONTACT_LABELS);
    const known = await fire(uiFlow, f, r);
    await logsSuccess(uiFlow, f, known);
    await test.step('Mark the unsubscribed prospect as Resume (Apply changes)', async () => {
      await f.sequence.markAsResumed(SEQUENCE_ID, r['Email']);
    });
    await test.step('The prospect stays Unsubscribed (QA, 2026-10-15: expected)', async () => {
      await f.sequence.expectProspectStatus(SEQUENCE_ID, r['Email'], 'Unsubscribed');
    });
  });

  // -- Create a Contact in HubSpot --

  row('Create a Contact in HubSpot > 1: Extra Configuration skipped, contact not in HubSpot', async (f) => {
    const r = uiFlow.rowFor('Create a Contact in HubSpot > 1');
    await skipped(uiFlow, f, CREATE_CONTACT, CREATE_CONTACT_LABELS);
    const known = await fire(uiFlow, f, r);
    await logsSuccess(uiFlow, f, known);
    // QA (2026-10-12): Lifecycle Stage is Lead; Lead Status is left to HubSpot and not asserted.
    await expectContactCreated(f, r, { 'Lifecycle stage': 'Lead' });
  });

  row('Create a Contact in HubSpot > 3: Contact already in HubSpot, prospect details changed in Saleshandy', async (f) => {
    const r = uiFlow.rowFor('Create a Contact in HubSpot > 3');
    await skipped(uiFlow, f, CREATE_CONTACT, CREATE_CONTACT_LABELS);
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

  row('Create a Contact in HubSpot > 5: Extra Configuration skipped, contact not in HubSpot, real link', async (f) => {
    const r = linkFlow.rowFor('Create a Contact in HubSpot > 5');
    await skipped(linkFlow, f, CREATE_CONTACT, CREATE_CONTACT_LABELS);
    const known = await fire(linkFlow, f, r);
    await logsSuccess(linkFlow, f, known);
    await expectContactCreated(f, r, { 'Lifecycle stage': 'Lead' });
  });

  // -- Update a Contact in HubSpot --

  row('Update a Contact in HubSpot > 1: Extra Configuration skipped, contact in HubSpot, details changed', async (f) => {
    const r = uiFlow.rowFor('Update a Contact in HubSpot > 1');
    await skipped(uiFlow, f, UPDATE_CONTACT, UPDATE_CONTACT_LABELS);
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

  row('Update a Contact in HubSpot > 2: Contact in HubSpot, details not changed', async (f) => {
    const r = uiFlow.rowFor('Update a Contact in HubSpot > 2');
    await skipped(uiFlow, f, UPDATE_CONTACT, UPDATE_CONTACT_LABELS);
    // QA (2026-10-12): "not changed" means HubSpot already holds the prospect's
    // values, so the contact gets the prospect's Job title and City first.
    await test.step("Create the contact in HubSpot with the prospect's Job title and City", async () => {
      const contactId = await newContact(f.contacts, r);
      await f.contacts.updateProperties(contactId, { City: r['City'] });
    });
    const known = await fire(uiFlow, f, r);
    await logsSuccess(uiFlow, f, known);
    await test.step('Check the contact in HubSpot keeps the same Job title and City', async () => {
      await expectContact(f.contacts, r, { 'Job title': r['Job Title'], City: r['City'] });
    });
  });

  row('Update a Contact in HubSpot > 3: Contact not in HubSpot', async (f) => {
    const r = uiFlow.rowFor('Update a Contact in HubSpot > 3');
    await skipped(uiFlow, f, UPDATE_CONTACT, UPDATE_CONTACT_LABELS);
    const known = await fire(uiFlow, f, r);
    await logsSuccess(uiFlow, f, known);
    await expectNoContact(f, r);
  });

  row('Update a Contact in HubSpot > 5: Contact in HubSpot, details changed, real link', async (f) => {
    const r = linkFlow.rowFor('Update a Contact in HubSpot > 5');
    await skipped(linkFlow, f, UPDATE_CONTACT, UPDATE_CONTACT_LABELS);
    await test.step('Create the contact in HubSpot', async () => {
      await newContact(f.contacts, r);
    });
    const known = await fire(linkFlow, f, r, async () => {
      await test.step('Change Job Title and City in Saleshandy', async () => {
        await changeProspect(f.crm, r, { 'Job Title': r['Updated Job Title'], City: r['Updated City'] });
      });
    });
    await logsSuccess(linkFlow, f, known);
    await test.step('Check the contact in HubSpot shows the new values', async () => {
      await expectContact(f.contacts, r, { 'Job title': r['Updated Job Title'], City: r['Updated City'] });
    });
  });

  // -- Create a deal in HubSpot --
  // Extra Configuration empty: HubSpot fills Pipeline, Stage, Deal Type and
  // Priority itself (recorded, not asserted); Amount is empty unless the
  // prospect has a Deal Value; no close date (QA, 2026-10-12).

  row('Create a deal in HubSpot > 1: Extra Configuration skipped, contact in HubSpot, no deal', async (f) => {
    const r = uiFlow.rowFor('Create a deal in HubSpot > 1');
    await skipped(uiFlow, f, CREATE_DEAL, CREATE_DEAL_LABELS);
    let contactId = '';
    await test.step('Create the contact in HubSpot', async () => {
      contactId = await newContact(f.contacts, r);
    });
    const known = await fire(uiFlow, f, r);
    await logsSuccess(uiFlow, f, known);
    await test.step('Check HubSpot: one deal on the contact, Amount and close date empty', async () => {
      const [deal] = await newDealsOf(f.contacts, contactId, 1, []);
      const summary = await f.deals.summary(deal.id);
      test.info().annotations.push({ type: 'Deal filled by HubSpot', description: JSON.stringify(summary) });
      expect(summary, 'deal').toMatchObject({ amount: '--', closeDate: '--' });
    });
  });

  row('Create a deal in HubSpot > 2: Contact not in HubSpot', async (f) => {
    const r = uiFlow.rowFor('Create a deal in HubSpot > 2');
    await skipped(uiFlow, f, CREATE_DEAL, CREATE_DEAL_LABELS);
    const known = await fire(uiFlow, f, r);
    await logsSuccess(uiFlow, f, known);
    await test.step('Check HubSpot: contact created with one associated deal, Amount and close date empty', async () => {
      const [deal] = await newDealsOf(f.contacts, await findContact(f.contacts, r), 1, []);
      expect(await f.deals.summary(deal.id), 'deal').toMatchObject({ amount: '--', closeDate: '--' });
    });
  });

  row('Create a deal in HubSpot > 3: Contact already has 1 deal', async (f) => {
    const r = uiFlow.rowFor('Create a deal in HubSpot > 3');
    const existing = uiFlow.deals.filter((d) => d['Contact Email'] === r['Email']);
    await skipped(uiFlow, f, CREATE_DEAL, CREATE_DEAL_LABELS);
    let contactId = '';
    await test.step(`Create the contact in HubSpot with ${existing.length} deal`, async () => {
      contactId = await newContact(f.contacts, r);
      for (const d of existing) await f.deals.createDealForContact(contactId, { name: d['Deal Name'], amount: d['Amount'] });
    });
    const known = await fire(uiFlow, f, r);
    await logsSuccess(uiFlow, f, known);
    await test.step('Check HubSpot: the contact now has one more deal, Amount and close date empty on it', async () => {
      const fresh = await newDealsOf(f.contacts, contactId, existing.length + 1, existing.map((d) => d['Deal Name']));
      expect(fresh.length, 'new deals').toBe(1);
      expect(await f.deals.summary(fresh[0].id), 'new deal').toMatchObject({ amount: '--', closeDate: '--' });
    });
  });

  row('Create a deal in HubSpot > 4: Prospect has Deal Value', async (f) => {
    const r = uiFlow.rowFor('Create a deal in HubSpot > 4');
    await skipped(uiFlow, f, CREATE_DEAL, CREATE_DEAL_LABELS);
    const known = await fire(uiFlow, f, r);
    await logsSuccess(uiFlow, f, known);
    await test.step(`Check HubSpot: Amount = Deal Value ${r['Deal Value']}, close date empty`, async () => {
      const [deal] = await newDealsOf(f.contacts, await findContact(f.contacts, r), 1, []);
      await expect(async () => {
        const summary = await f.deals.summary(deal.id);
        expect(summary.amount.replace(/[^0-9.]/g, ''), 'Amount').toMatch(new RegExp(`^${r['Deal Value']}(\\.0+)?$`));
        expect(summary.closeDate, 'Close Date').toBe('--');
      }).toPass({ timeout: 60_000 });
    });
  });

  row('Create a deal in HubSpot > 6: Extra Configuration skipped, contact in HubSpot, no deal, real link', async (f) => {
    const r = linkFlow.rowFor('Create a deal in HubSpot > 6');
    await skipped(linkFlow, f, CREATE_DEAL, CREATE_DEAL_LABELS);
    let contactId = '';
    await test.step('Create the contact in HubSpot', async () => {
      contactId = await newContact(f.contacts, r);
    });
    const known = await fire(linkFlow, f, r);
    await logsSuccess(linkFlow, f, known);
    await test.step('Check HubSpot: one deal on the contact, Amount and close date empty', async () => {
      const [deal] = await newDealsOf(f.contacts, contactId, 1, []);
      expect(await f.deals.summary(deal.id), 'deal').toMatchObject({ amount: '--', closeDate: '--' });
    });
  });

  // -- Update a deal in HubSpot --
  // QA (2026-10-15): with one deal it is updated whether Extra Configuration is
  // empty or not; with 3 deals the latest created deal is updated. What changes
  // on a deal with nothing configured is not defined, so the deals before and
  // after are recorded as annotations and only the older deals are asserted.

  async function updateDealSkipped(flow: Flow, f: F, r: Row, count: number): Promise<void> {
    await skipped(flow, f, UPDATE_DEAL, UPDATE_DEAL_LABELS);
    let dealIds: string[] = [];
    await test.step(`Create the contact in HubSpot with ${count} deal${count > 1 ? 's' : ''}`, async () => {
      dealIds = await contactWithDeals(flow, r, f);
      expect(dealIds.length, 'deals created').toBe(count);
    });
    const before: unknown[] = [];
    for (const id of dealIds) before.push(await f.deals.summary(id));
    const known = await fire(flow, f, r);
    test.setTimeout(25 * 60_000); // the Update a Deal log alone can take about 7.5 minutes
    await logsSuccess(flow, f, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
    await test.step('Record the deals after the unsubscribe; the older deals are unchanged', async () => {
      const after: unknown[] = [];
      for (const id of dealIds) after.push(await f.deals.summary(id));
      test.info().annotations.push({ type: 'Deals before', description: JSON.stringify(before) });
      test.info().annotations.push({ type: 'Deals after', description: JSON.stringify(after) });
      for (let i = 0; i < dealIds.length - 1; i++) expect(after[i], `older deal ${i + 1}`).toEqual(before[i]);
    });
  }

  row('Update a deal in HubSpot > 1: Extra Configuration skipped, contact has 1 deal', async (f) => {
    await updateDealSkipped(uiFlow, f, uiFlow.rowFor('Update a deal in HubSpot > 1'), 1);
  });

  row('Update a deal in HubSpot > 2: Contact has 3 deals', async (f) => {
    await updateDealSkipped(uiFlow, f, uiFlow.rowFor('Update a deal in HubSpot > 2'), 3);
  });

  row('Update a deal in HubSpot > 5: Contact in HubSpot with 0 deals', async (f) => {
    const r = uiFlow.rowFor('Update a deal in HubSpot > 5');
    await skipped(uiFlow, f, UPDATE_DEAL, UPDATE_DEAL_LABELS);
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

  row('Update a deal in HubSpot > 6: Contact not in HubSpot', async (f) => {
    const r = uiFlow.rowFor('Update a deal in HubSpot > 6');
    await skipped(uiFlow, f, UPDATE_DEAL, UPDATE_DEAL_LABELS);
    const known = await fire(uiFlow, f, r);
    test.setTimeout(25 * 60_000);
    await logsFinished(uiFlow, f, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
    await expectNoContact(f, r);
  });

  row('Update a deal in HubSpot > 7: Contact has 1 deal, real link', async (f) => {
    await updateDealSkipped(linkFlow, f, linkFlow.rowFor('Update a deal in HubSpot > 7'), 1);
  });

  // -- Create a company in HubSpot (no Extra Configuration; name not checked, AL-4104) --

  row('Create a company in HubSpot > 1: Contact in HubSpot, prospect has company details', async (f) => {
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

  row('Create a company in HubSpot > 2: A company with the same domain already exists', async (f) => {
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

  row('Create a company in HubSpot > 3: Contact not in HubSpot', async (f) => {
    const r = uiFlow.rowFor('Create a company in HubSpot > 3');
    await skipped(uiFlow, f, CREATE_COMPANY, []);
    const known = await fire(uiFlow, f, r);
    test.setTimeout(15 * 60_000); // a log can sit on RUNNING for minutes
    await logsSuccess(uiFlow, f, known, 10 * 60_000);
    await test.step('Check HubSpot: contact created with one associated company', async () => {
      await expectCompanies(f.contacts, await findContact(f.contacts, r), 1);
    });
  });

  row('Create a company in HubSpot > 4: Prospect has empty company details, only a company domain', async (f) => {
    const r = uiFlow.rowFor('Create a company in HubSpot > 4');
    await skipped(uiFlow, f, CREATE_COMPANY, []);
    const known = await fire(uiFlow, f, r);
    await logsSuccess(uiFlow, f, known);
    await test.step('Check HubSpot: contact created with one associated company (made from the domain)', async () => {
      await expectCompanies(f.contacts, await findContact(f.contacts, r), 1);
    });
  });

  row('Create a company in HubSpot > 5: Contact in HubSpot, real link', async (f) => {
    const r = linkFlow.rowFor('Create a company in HubSpot > 5');
    await skipped(linkFlow, f, CREATE_COMPANY, []);
    let contactId = '';
    await test.step('Create the contact in HubSpot', async () => {
      contactId = await newContact(f.contacts, r);
    });
    const known = await fire(linkFlow, f, r);
    await logsSuccess(linkFlow, f, known);
    await test.step('Check HubSpot: one company associated to the contact', async () => {
      await expectCompanies(f.contacts, contactId, 1);
    });
  });

  // -- Update a company in HubSpot --

  async function updateCompany(flow: Flow, f: F, r: Row, count: number): Promise<void> {
    await skipped(flow, f, UPDATE_COMPANY, []);
    let companyIds: string[] = [];
    let olderBefore = '';
    await test.step(`Create the contact in HubSpot with ${count} associated compan${count > 1 ? 'ies' : 'y'}`, async () => {
      companyIds = await contactWithCompanies(flow, r, f);
      expect(companyIds.length, 'companies created').toBe(count);
      if (count > 1) olderBefore = await f.companies.property(companyIds[0], 'City');
    });
    const known = await fire(flow, f, r, async () => {
      await test.step('Change City and State in Saleshandy', async () => {
        await changeProspect(f.crm, r, { City: r['Updated City'], State: r['Updated State'] });
      });
    });
    await logsSuccess(flow, f, known);
    await test.step('Check HubSpot: the latest associated company shows the new City and State', async () => {
      await expectCompanyValues(f.companies, companyIds[companyIds.length - 1], { City: r['Updated City'], 'State/Region': r['Updated State'] });
    });
    if (count > 1) {
      await test.step('Check HubSpot: the other company is unchanged', async () => {
        expect(await f.companies.property(companyIds[0], 'City'), 'older company City').toBe(olderBefore);
      });
    }
  }

  row('Update a company in HubSpot > 1: Contact has 1 associated company, company details changed in Saleshandy', async (f) => {
    await updateCompany(uiFlow, f, uiFlow.rowFor('Update a company in HubSpot > 1'), 1);
  });

  row('Update a company in HubSpot > 2: Contact has 2 associated companies', async (f) => {
    await updateCompany(uiFlow, f, uiFlow.rowFor('Update a company in HubSpot > 2'), 2);
  });

  row('Update a company in HubSpot > 3: Contact in HubSpot, no associated company', async (f) => {
    const r = uiFlow.rowFor('Update a company in HubSpot > 3');
    await skipped(uiFlow, f, UPDATE_COMPANY, []);
    let contactId = '';
    await test.step('Create the contact in HubSpot, no company', async () => {
      contactId = await newContact(f.contacts, r);
    });
    const known = await fire(uiFlow, f, r);
    await logsSuccess(uiFlow, f, known);
    await test.step('Check HubSpot: the contact still has no company', async () => {
      expect((await f.contacts.associations(contactId, 'companies')).count, 'companies on the contact').toBe(0);
    });
  });

  row('Update a company in HubSpot > 4: Contact not in HubSpot', async (f) => {
    const r = uiFlow.rowFor('Update a company in HubSpot > 4');
    await skipped(uiFlow, f, UPDATE_COMPANY, []);
    const known = await fire(uiFlow, f, r);
    await logsSuccess(uiFlow, f, known);
    await expectNoContact(f, r);
  });

  row('Update a company in HubSpot > 5: Contact has 1 associated company, details changed, real link', async (f) => {
    await updateCompany(linkFlow, f, linkFlow.rowFor('Update a company in HubSpot > 5'), 1);
  });

  // -- Create a Task in HubSpot: the modal only (nothing is saved) --

  uiRow('Create a Task in HubSpot > 3: Modal never saved, Task Title empty (UI only)', async (integration) => {
    await test.step('Select Create a Task', async () => {
      await uiFlow.startClean(integration);
      await integration.selectActivity(TRIGGER, CREATE_TASK);
    });
    await test.step('Fill type, priority and Due In 3, leave the title empty', async () => {
      await integration.chooseConfigOption('Task Type', 'Call');
      await integration.chooseConfigOption('Task Priority', 'Medium');
      await integration.dueIn().fill('3');
      await integration.configTextbox('Task Title').fill('');
    });
    await test.step('Save cannot be clicked', async () => {
      await expect(integration.configSaveButton(), 'Save with an empty title').toBeDisabled();
    });
    await test.step('Close the dialog and remove Create a Task', async () => {
      await integration.cancelExtraConfiguration();
      await integration.removeActivity(TRIGGER, CREATE_TASK);
    });
  });

  uiRow('Create a Task in HubSpot > 4: Due In 0 (UI only)', async (integration) => {
    await test.step('Select Create a Task', async () => {
      await uiFlow.startClean(integration);
      await integration.selectActivity(TRIGGER, CREATE_TASK);
    });
    await test.step('Fill title, type and priority, leave Due In at 0', async () => {
      await integration.configTextbox('Task Title').fill(TASK.title);
      await integration.chooseConfigOption('Task Type', 'Call');
      await integration.chooseConfigOption('Task Priority', 'Medium');
      await integration.dueIn().fill('0');
    });
    await test.step('Save cannot be clicked', async () => {
      await expect(integration.configSaveButton(), 'Save with Due In 0').toBeDisabled();
    });
    await test.step('Close the dialog and remove Create a Task', async () => {
      await integration.cancelExtraConfiguration();
      await integration.removeActivity(TRIGGER, CREATE_TASK);
    });
  });

  // -- Create a Note in HubSpot (paired with a contact activity left skipped) --

  const noteTexts = (flow: Flow, r: Row) => ['Note created via Saleshandy', ...flow.noteContains(r, 1)];

  row('Create a Note in HubSpot > 1: Paired with Create a Contact (skipped), contact not in HubSpot', async (f) => {
    const r = uiFlow.rowFor('Create a Note in HubSpot > 1');
    await usePaired(uiFlow, f, CREATE_CONTACT, {}, CREATE_CONTACT_LABELS, CREATE_NOTE);
    const known = await fire(uiFlow, f, r);
    await logsSuccess(uiFlow, f, known);
    await test.step('Check HubSpot: contact created, note on it with Step, Variant and Prospect Email', async () => {
      await expectOnRecord(f.contacts, '0-1', await findContact(f.contacts, r), noteTexts(uiFlow, r), 'Note');
    });
  });

  row('Create a Note in HubSpot > 2: Paired with Update a Contact (skipped), contact in HubSpot', async (f) => {
    const r = uiFlow.rowFor('Create a Note in HubSpot > 2');
    await usePaired(uiFlow, f, UPDATE_CONTACT, {}, UPDATE_CONTACT_LABELS, CREATE_NOTE);
    let contactId = '';
    await test.step('Create the contact in HubSpot', async () => {
      contactId = await newContact(f.contacts, r);
    });
    const known = await fire(uiFlow, f, r);
    await logsSuccess(uiFlow, f, known);
    await test.step('Check HubSpot: note on the contact', async () => {
      await expectOnRecord(f.contacts, '0-1', contactId, noteTexts(uiFlow, r), 'Note');
    });
  });

  row('Create a Note in HubSpot > 6: Create a Note selected alone', async (f) => {
    const r = uiFlow.rowFor('Create a Note in HubSpot > 6');
    await skipped(uiFlow, f, CREATE_NOTE, []);
    const known = await fire(uiFlow, f, r);
    // QA, 2026-10-13: the workflow itself succeeds; the note lands on no record.
    await test.step('Wait until the new log entries have finished: none is an Error', async () => {
      const statuses = await uiFlow.newLogsFinished(f.integration, known);
      test.info().annotations.push({ type: 'Log status', description: statuses.join(', ') });
      expect(statuses, 'log statuses (the workflow itself succeeds)').not.toContain('Error');
      expect(statuses, 'log statuses').toContain('Success');
    });
    await expectNoContact(f, r);
  });

  row('Create a Note in HubSpot > 7: Paired with Create a Contact (skipped), real link', async (f) => {
    const r = linkFlow.rowFor('Create a Note in HubSpot > 7');
    await usePaired(linkFlow, f, CREATE_CONTACT, {}, CREATE_CONTACT_LABELS, CREATE_NOTE);
    const known = await fire(linkFlow, f, r);
    await logsSuccess(linkFlow, f, known);
    await test.step('Check HubSpot: contact created, note on it', async () => {
      await expectOnRecord(f.contacts, '0-1', await findContact(f.contacts, r), noteTexts(linkFlow, r), 'Note');
    });
  });

  // -- Record (log) an email activity in HubSpot --

  uiRow('Record (log) an email activity in HubSpot > 1: Tooltip (UI only)', async (integration) => {
    await test.step(`Select "${RECORD_EMAIL}"`, async () => {
      await uiFlow.startClean(integration);
      await integration.selectActivity(TRIGGER, RECORD_EMAIL);
    });
    await test.step('Hover the info icon next to the activity', async () => {
      await integration.hoverActivityInfo(TRIGGER, RECORD_EMAIL);
      // Product text, with "Email" capitalised (seen 2026-10-09).
      await expect(integration.tooltip(), 'tooltip').toHaveText(
        'Logging an Email alone would result in failure. Please create/update contact or deal to associate an email.',
      );
    });
  });

  uiRow('Record (log) an email activity in HubSpot > 2: Only this activity selected, Save (UI only)', async (integration) => {
    await test.step(`Select only "${RECORD_EMAIL}" and Save`, async () => {
      await uiFlow.startClean(integration);
      await integration.selectActivity(TRIGGER, RECORD_EMAIL);
      await integration.save();
      await expect(integration.savedToast(), 'save confirmation').toBeVisible({ timeout: 30_000 });
    });
    await test.step('Reload: the activity is still the only one selected', async () => {
      await integration.openTriggers();
      expect(await integration.isTriggerOn(TRIGGER), 'trigger on').toBe(true);
      await expect.poll(() => integration.selectedActivities(TRIGGER), 'selected activities').toEqual([RECORD_EMAIL]);
    });
  });

  row('Record (log) an email activity in HubSpot > 3: Paired with Create a Contact (skipped), contact not in HubSpot', async (f) => {
    const r = uiFlow.rowFor('Record (log) an email activity in HubSpot > 3');
    await usePaired(uiFlow, f, CREATE_CONTACT, {}, CREATE_CONTACT_LABELS, RECORD_EMAIL);
    const known = await fire(uiFlow, f, r);
    await logsSuccess(uiFlow, f, known);
    await test.step('Check HubSpot: contact created, email logged on it', async () => {
      await expectOnRecord(f.contacts, '0-1', await findContact(f.contacts, r), uiFlow.loggedEmailContains(r, 1), 'Logged email');
    });
  });

  row('Record (log) an email activity in HubSpot > 4: Paired with Update a Contact (skipped), contact in HubSpot', async (f) => {
    const r = uiFlow.rowFor('Record (log) an email activity in HubSpot > 4');
    await usePaired(uiFlow, f, UPDATE_CONTACT, {}, UPDATE_CONTACT_LABELS, RECORD_EMAIL);
    let contactId = '';
    await test.step('Create the contact in HubSpot', async () => {
      contactId = await newContact(f.contacts, r);
    });
    const known = await fire(uiFlow, f, r);
    await logsSuccess(uiFlow, f, known);
    await test.step('Check HubSpot: email logged on the contact', async () => {
      await expectOnRecord(f.contacts, '0-1', contactId, uiFlow.loggedEmailContains(r, 1), 'Logged email');
    });
  });

  row('Record (log) an email activity in HubSpot > 8: Paired with Create a Contact (skipped), real link', async (f) => {
    const r = linkFlow.rowFor('Record (log) an email activity in HubSpot > 8');
    await usePaired(linkFlow, f, CREATE_CONTACT, {}, CREATE_CONTACT_LABELS, RECORD_EMAIL);
    const known = await fire(linkFlow, f, r);
    await logsSuccess(linkFlow, f, known);
    await test.step('Check HubSpot: contact created, email logged on it', async () => {
      await expectOnRecord(f.contacts, '0-1', await findContact(f.contacts, r), linkFlow.loggedEmailContains(r, 1), 'Logged email');
    });
  });

  // ---- Phase 2: Extra Configuration values ----

  // -- Create a Contact in HubSpot --

  row('Create a Contact in HubSpot > 2: Lead Status Open, Lead Lifecycle Marketing Qualified Lead, contact not in HubSpot', async (f) => {
    const r = uiFlow.rowFor('Create a Contact in HubSpot > 2');
    await withValues(uiFlow, f, CREATE_CONTACT, CREATE_CONTACT_VALUES, 'Lead Status Open, Lead Lifecycle Marketing Qualified Lead');
    const known = await fire(uiFlow, f, r);
    await logsSuccess(uiFlow, f, known);
    await expectContactCreated(f, r, { 'Lead status': 'Open', 'Lifecycle stage': 'Marketing Qualified Lead' });
  });

  row('Create a Contact in HubSpot > 4: Contact already at a later Lifecycle Stage (Customer, set by hand)', async (f) => {
    const r = uiFlow.rowFor('Create a Contact in HubSpot > 4');
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

  row('Create a Contact in HubSpot > 6: Values saved, contact in HubSpot, details changed', async (f) => {
    const r = uiFlow.rowFor('Create a Contact in HubSpot > 6');
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
    await test.step('Check the contact in HubSpot shows the new values, Lead Status Open, Lifecycle Stage Marketing Qualified Lead', async () => {
      await expectContact(f.contacts, r, { 'Job title': r['Updated Job Title'], City: r['Updated City'], 'Lead status': 'Open', 'Lifecycle stage': 'Marketing Qualified Lead' });
    });
  });

  uiRow('Create a Contact in HubSpot > 7: Values saved before, reopen Extra Configuration (UI only)', async (integration) => {
    await test.step('Select Create a Contact with Lead Status Open and Lead Lifecycle Marketing Qualified Lead', async () => {
      await uiFlow.startClean(integration);
      await integration.selectActivity(TRIGGER, CREATE_CONTACT);
      await integration.chooseConfigOption('Lead Status', 'Open');
      await integration.chooseConfigOption('Lead Lifecycle', 'Marketing Qualified Lead');
      await integration.configSaveButton().click();
      await expect(integration.savedToast(), 'save confirmation').toBeVisible({ timeout: 30_000 });
    });
    await test.step('Reopen Extra Configuration: the saved values show', async () => {
      await integration.reopenExtraConfiguration(TRIGGER, CREATE_CONTACT);
      await expect(integration.configDropdown('Lead Status'), 'saved Lead Status').toHaveText('Open');
      await expect(integration.configDropdown('Lead Lifecycle'), 'saved Lead Lifecycle').toHaveText('Marketing Qualified Lead');
    });
    for (const [label, value] of [['Lead Status', 'Open'], ['Lead Lifecycle', 'Marketing Qualified Lead']]) {
      await test.step(`Try to clear ${label}: no empty option, picking the same value keeps it`, async () => {
        const options = await integration.openConfigDropdown(label);
        expect(options, `${label} options`).not.toContain('');
        expect(options, `${label} options`).not.toContain('Select');
        await integration.page.getByRole('button', { name: value, exact: true }).click();
        await expect(integration.configDropdown(label), label).toHaveText(value);
      });
    }
    await test.step('Close Extra Configuration without saving', async () => {
      await integration.cancelExtraConfiguration();
    });
  });

  // -- Update a Contact in HubSpot --

  row('Update a Contact in HubSpot > 4: Update Lead Status Connected, Update Lead Lifecycle Sales Qualified Lead, contact at Lifecycle Stage Lead', async (f) => {
    const r = uiFlow.rowFor('Update a Contact in HubSpot > 4');
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

  // -- Create a deal in HubSpot --

  row('Create a deal in HubSpot > 5: Sales Pipeline, Initial Contact, New Business, High, Closing Date 0 Days, contact not in HubSpot', async (f) => {
    const r = uiFlow.rowFor('Create a deal in HubSpot > 5');
    await withValues(uiFlow, f, CREATE_DEAL, dealConfig('0'), 'Sales Pipeline, Initial Contact, New Business, High, 0 Days');
    const known = await fire(uiFlow, f, r);
    await logsSuccess(uiFlow, f, known);
    await test.step('Check HubSpot: contact and deal created and associated with the configured values, no close date', async () => {
      const [deal] = await newDealsOf(f.contacts, await findContact(f.contacts, r), 1, []);
      expect(await f.deals.summary(deal.id), 'deal').toMatchObject({ pipeline: 'Sales Pipeline', stage: 'Initial Contact', dealType: 'New Business', priority: 'High', closeDate: '--' });
    });
  });

  row('Create a deal in HubSpot > 7: Prospect has Deal Value, Closing Date 1 Day', async (f) => {
    const r = uiFlow.rowFor('Create a deal in HubSpot > 7');
    await withValues(uiFlow, f, CREATE_DEAL, dealConfig('1'), 'Sales Pipeline, Initial Contact, New Business, High, 1 Day');
    const known = await fire(uiFlow, f, r);
    await logsSuccess(uiFlow, f, known);
    await test.step(`Check HubSpot: Amount = Deal Value ${r['Deal Value']}, close date 1 day from today`, async () => {
      const [deal] = await newDealsOf(f.contacts, await findContact(f.contacts, r), 1, []);
      // The close date shows in the header after the other values, so re-read until it is there.
      await expect(async () => {
        const summary = await f.deals.summary(deal.id);
        expect(summary.amount.replace(/[^0-9.]/g, ''), 'Amount').toMatch(new RegExp(`^${r['Deal Value']}(\\.0+)?$`));
        expect(summary.closeDate, 'Close Date').toBe(daysFromToday(1));
      }).toPass({ timeout: 60_000 });
    });
  });

  row('Create a deal in HubSpot > 8: Closing Date 51 Days', async (f) => {
    const r = uiFlow.rowFor('Create a deal in HubSpot > 8');
    await withValues(uiFlow, f, CREATE_DEAL, dealConfig('51'), 'Sales Pipeline, Initial Contact, New Business, High, 51 Days');
    const known = await fire(uiFlow, f, r);
    await logsSuccess(uiFlow, f, known);
    await test.step('Check HubSpot: close date 51 days from today (not 50, AL-4051)', async () => {
      const [deal] = await newDealsOf(f.contacts, await findContact(f.contacts, r), 1, []);
      await expect(async () => {
        expect((await f.deals.summary(deal.id)).closeDate, 'Close Date').toBe(daysFromToday(51));
      }).toPass({ timeout: 60_000 });
    });
  });

  // -- Update a deal in HubSpot --

  row('Update a deal in HubSpot > 3: Sales Pipeline, Follow-Up, New Business, High, contact has 1 deal at Prospecting', async (f) => {
    const r = uiFlow.rowFor('Update a deal in HubSpot > 3');
    await withValues(uiFlow, f, UPDATE_DEAL, dealUpdateConfig('0'), 'Sales Pipeline, Follow-Up, New Business, High, 0 Days');
    let dealIds: string[] = [];
    await test.step('Create the contact in HubSpot with 1 deal', async () => {
      dealIds = await contactWithDeals(uiFlow, r, f);
    });
    const known = await fire(uiFlow, f, r);
    test.setTimeout(25 * 60_000);
    await logsSuccess(uiFlow, f, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
    await test.step('Check HubSpot: the deal shows Sales Pipeline, Follow-Up, New Business, High', async () => {
      await expect(async () => {
        expect(await f.deals.summary(dealIds[0]), 'deal').toMatchObject({ pipeline: 'Sales Pipeline', stage: 'Follow-Up', dealType: 'New Business', priority: 'High' });
      }).toPass({ timeout: 60_000 });
    });
  });

  row('Update a deal in HubSpot > 4: Closing Date 51 Days, contact has 1 deal', async (f) => {
    const r = uiFlow.rowFor('Update a deal in HubSpot > 4');
    await withValues(uiFlow, f, UPDATE_DEAL, dealUpdateConfig('51'), 'Closing Date 51 Days');
    let dealIds: string[] = [];
    await test.step('Create the contact in HubSpot with 1 deal', async () => {
      dealIds = await contactWithDeals(uiFlow, r, f);
    });
    const known = await fire(uiFlow, f, r);
    test.setTimeout(25 * 60_000);
    await logsSuccess(uiFlow, f, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
    await test.step('Check HubSpot: close date 51 days from today', async () => {
      await expect(async () => {
        expect((await f.deals.summary(dealIds[0])).closeDate, 'Close Date').toBe(daysFromToday(51));
      }).toPass({ timeout: 60_000 });
    });
  });

  // -- Create a Task in HubSpot --

  row('Create a Task in HubSpot > 1: Title "Follow up from the workflow", Call, Medium, due in 3 days, contact in HubSpot', async (f) => {
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

  row('Create a Task in HubSpot > 2: Contact not in HubSpot', async (f) => {
    const r = uiFlow.rowFor('Create a Task in HubSpot > 2');
    await useTask(uiFlow, f);
    const known = await fire(uiFlow, f, r);
    await logsSuccess(uiFlow, f, known);
    await test.step('Check HubSpot: contact created with the task on it', async () => {
      await expectOnRecord(f.contacts, '0-1', await findContact(f.contacts, r), [TASK.title, dueDatePattern(TASK.dueDays)], 'Task');
    });
  });

  row('Create a Task in HubSpot > 5: Contact in HubSpot, real link', async (f) => {
    const r = linkFlow.rowFor('Create a Task in HubSpot > 5');
    await useTask(linkFlow, f);
    let contactId = '';
    await test.step('Create the contact in HubSpot', async () => {
      contactId = await newContact(f.contacts, r);
    });
    const known = await fire(linkFlow, f, r);
    await logsSuccess(linkFlow, f, known);
    await test.step('Check HubSpot: the task on the contact', async () => {
      await expectOnRecord(f.contacts, '0-1', contactId, [TASK.title, dueDatePattern(TASK.dueDays)], 'Task');
    });
  });

  // -- Create a Note in HubSpot --

  row('Create a Note in HubSpot > 3: Paired with Create a deal (values), contact not in HubSpot, Deal Value 25500', async (f) => {
    const r = uiFlow.rowFor('Create a Note in HubSpot > 3');
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

  row('Create a Note in HubSpot > 4: Paired with Update a deal (1 deal)', async (f) => {
    const r = uiFlow.rowFor('Create a Note in HubSpot > 4');
    await usePaired(uiFlow, f, UPDATE_DEAL, dealUpdateConfig('0'), [], CREATE_NOTE);
    let dealIds: string[] = [];
    await test.step('Create the contact in HubSpot with 1 deal', async () => {
      dealIds = await contactWithDeals(uiFlow, r, f);
    });
    const known = await fire(uiFlow, f, r);
    test.setTimeout(25 * 60_000);
    await logsSuccess(uiFlow, f, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
    // QA, 2026-10-14: with Update a deal the contact and the deal both receive the note.
    await test.step('Check HubSpot: note on the deal and on the contact', async () => {
      await expectOnRecord(f.contacts, '0-3', dealIds[0], noteTexts(uiFlow, r), 'Note on the deal');
      await expectOnRecord(f.contacts, '0-1', await findContact(f.contacts, r), noteTexts(uiFlow, r), 'Note on the contact');
    });
  });

  row('Create a Note in HubSpot > 5: Paired with Update a Contact (values saved), contact in HubSpot', async (f) => {
    const r = uiFlow.rowFor('Create a Note in HubSpot > 5');
    await usePaired(uiFlow, f, UPDATE_CONTACT, UPDATE_CONTACT_VALUES, [], CREATE_NOTE);
    let contactId = '';
    await test.step('Create the contact in HubSpot', async () => {
      contactId = await newContact(f.contacts, r);
    });
    const known = await fire(uiFlow, f, r);
    await logsSuccess(uiFlow, f, known);
    await test.step('Check HubSpot: note on the contact; Lead status Connected, Lifecycle stage Sales Qualified Lead', async () => {
      await expectOnRecord(f.contacts, '0-1', contactId, noteTexts(uiFlow, r), 'Note');
      await expectContact(f.contacts, r, { 'Lead status': 'Connected', 'Lifecycle stage': 'Sales Qualified Lead' });
    });
  });

  // -- Record (log) an email activity in HubSpot --

  row('Record (log) an email activity in HubSpot > 5: Paired with Create a deal, contact not in HubSpot, Deal Value 28200', async (f) => {
    const r = uiFlow.rowFor('Record (log) an email activity in HubSpot > 5');
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

  row('Record (log) an email activity in HubSpot > 6: Paired with Update a deal, contact has 3 deals', async (f) => {
    const r = uiFlow.rowFor('Record (log) an email activity in HubSpot > 6');
    await usePaired(uiFlow, f, UPDATE_DEAL, dealUpdateConfig('0'), [], RECORD_EMAIL);
    let dealIds: string[] = [];
    await test.step('Create the contact in HubSpot with 3 deals, one after the other', async () => {
      dealIds = await contactWithDeals(uiFlow, r, f);
      expect(dealIds.length, 'deals created').toBe(3);
    });
    const known = await fire(uiFlow, f, r);
    test.setTimeout(25 * 60_000);
    await logsSuccess(uiFlow, f, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
    // QA, 2026-10-15: with Update a deal the email is logged on the latest deal
    // (naming the prospect, AL-4123) and on the contact.
    await test.step('Check HubSpot: email logged on the latest deal naming the prospect, and on the contact', async () => {
      const contactId = await findContact(f.contacts, r);
      await expectOnRecord(f.contacts, '0-3', dealIds[2], uiFlow.loggedEmailContains(r, 1), 'Logged email on the deal');
      expect(await f.contacts.activitiesText('0-3', dealIds[2]), 'deal Activities').not.toContain('Unknown Contact');
      await expectOnRecord(f.contacts, '0-1', contactId, uiFlow.loggedEmailContains(r, 1), 'Logged email on the contact');
    });
  });

  row('Record (log) an email activity in HubSpot > 7: Paired with Update a Contact (values saved), contact in HubSpot, Deal Value 27800', async (f) => {
    const r = uiFlow.rowFor('Record (log) an email activity in HubSpot > 7');
    await usePaired(uiFlow, f, UPDATE_CONTACT, UPDATE_CONTACT_VALUES, [], RECORD_EMAIL);
    let contactId = '';
    await test.step('Create the contact in HubSpot', async () => {
      contactId = await newContact(f.contacts, r);
    });
    const known = await fire(uiFlow, f, r);
    await logsSuccess(uiFlow, f, known);
    await test.step('Check HubSpot: email logged on the contact; the contact has the saved values', async () => {
      await expectOnRecord(f.contacts, '0-1', contactId, uiFlow.loggedEmailContains(r, 1), 'Logged email');
      await expectContact(f.contacts, r, { 'Lead status': 'Connected', 'Lifecycle stage': 'Sales Qualified Lead' });
    });
  });
});
