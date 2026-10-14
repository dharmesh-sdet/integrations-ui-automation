// Shared activity tests for the Saleshandy-side HubSpot workflows (written
// once, QA 2026-10-09). A workflow spec calls activityTests(flow, '<describe
// title>') after createFlow(...); titles are "<Activity> > <#>: <Scenario>" as
// in the scenario files, rows come from the workflow's CSV (Scenario column).
// "Extra Configuration skipped" rows come first; they skip themselves on an
// account where the activity was already configured.
import type { Row } from '../data/csv.ts';
import { expect, test } from '../fixtures/index.ts';
import type { HubSpotCompaniesPage } from '../pages/hubspot/companies.page.ts';
import type { HubSpotContactsPage } from '../pages/hubspot/contacts.page.ts';
import type { HubSpotIntegrationPage } from '../pages/saleshandy/hubspot-integration.page.ts';
import type { SaleshandyCrmPage } from '../pages/saleshandy/crm.page.ts';
import { untilPasses } from '../utils/wait.ts';
import { daysFromToday, dealConfig, dealUpdateConfig, expectContact, fullName, mapped, newDealsOf, type createFlow } from './saleshandy-to-hubspot.ts';

export const CREATE_CONTACT = 'Create a Contact in Hubspot';
export const UPDATE_CONTACT = 'Update a Contact in Hubspot';
export const CREATE_DEAL = 'Create a Deal in Hubspot';
export const UPDATE_DEAL = 'Update a Deal in Hubspot';
// Observed 2026-10-12: the Update a Deal log stays RUNNING for 7m 25s (other activities finish in under 30 s).
const UPDATE_DEAL_LOG_TIMEOUT_MS = 12 * 60_000;
export const CREATE_COMPANY = 'Create a Company in Hubspot';
export const UPDATE_COMPANY = 'Update a Company in Hubspot';
export const CREATE_NOTE = 'Create a Note in Hubspot';
export const CREATE_TASK = 'Create a Task in Hubspot';
export const RECORD_EMAIL = 'Record(log) an Email Activity in Hubspot';

type Flow = ReturnType<typeof createFlow>;

// `skip`: scenario ids a workflow does not have (QA, 2026-10-13: "Create a
// Contact in HubSpot > 6" is a Link Clicked row only: a reply has no second link).
export function activityTests(flow: Flow, title: string, options: { skip?: string[] } = {}): void {
  const skip = new Set(options.skip ?? []);
  test.describe(title, () => {
    // Not serial (QA, 2026-10-13): rows run in file order on one worker, and a
    // failed row does not turn the rest into "did not run".

    test('Trigger behavior (baseline) > 1: Trigger off before the test', async ({ saleshandyIntegration }) => {
      await test.step(`Turn other triggers off and turn on "${flow.trigger}"`, async () => {
        await flow.startClean(saleshandyIntegration);
      });
      await test.step(`Select "${RECORD_EMAIL}" and Save`, async () => {
        await saleshandyIntegration.selectActivity(flow.trigger, RECORD_EMAIL);
        await saleshandyIntegration.save();
        await expect(saleshandyIntegration.savedToast(), 'save confirmation').toBeVisible();
      });
    });

    test('Create a Contact in HubSpot > 1: Contact not in HubSpot, Extra Configuration skipped', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Create a Contact in HubSpot > 1');
      await test.step('Select only Create a Contact, nothing chosen in Extra Configuration', async () => {
        await flow.useOnly(saleshandyIntegration, CREATE_CONTACT, {}, ['Lead Status', 'Lead Lifecycle']);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known);
      });
      await test.step('Check the contact in HubSpot has the mapped fields', async () => {
        await expectContact(hubspotContacts, row, mapped(row));
      });
    });

    test('Update a Contact in HubSpot > 1: Contact in HubSpot, details changed, Extra Configuration skipped', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
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
        await expectContact(hubspotContacts, row, { 'Job title': row['Updated Job Title'], City: row['Updated City'], 'Lead status': '--' });
      });
    });

    test('Create a Contact in HubSpot > 5: Lead Status and Lead Lifecycle saved before', async ({ saleshandyIntegration }) => {
      await test.step('Select Create a Contact with Lead Status Open and Lead Lifecycle Marketing Qualified Lead', async () => {
        await flow.startClean(saleshandyIntegration);
        await saleshandyIntegration.selectActivity(flow.trigger, CREATE_CONTACT);
        await saleshandyIntegration.chooseConfigOption('Lead Status', 'Open');
        await saleshandyIntegration.chooseConfigOption('Lead Lifecycle', 'Marketing Qualified Lead');
        await saleshandyIntegration.configSaveButton().click();
        await expect(saleshandyIntegration.savedToast(), 'save confirmation').toBeVisible();
      });
      await test.step('Reopen Extra Configuration', async () => {
        await saleshandyIntegration.reopenExtraConfiguration(flow.trigger, CREATE_CONTACT);
        await expect(saleshandyIntegration.configDropdown('Lead Status'), 'saved Lead Status').toHaveText('Open');
        await expect(saleshandyIntegration.configDropdown('Lead Lifecycle'), 'saved Lead Lifecycle').toHaveText('Marketing Qualified Lead');
      });
      for (const [label, value] of [['Lead Status', 'Open'], ['Lead Lifecycle', 'Marketing Qualified Lead']]) {
        await test.step(`Try to clear ${label}: no empty option, picking the same value keeps it`, async () => {
          const options = await saleshandyIntegration.openConfigDropdown(label);
          expect(options, `${label} options`).not.toContain('');
          expect(options, `${label} options`).not.toContain('Select');
          await saleshandyIntegration.page.getByRole('button', { name: value, exact: true }).click();
          await expect(saleshandyIntegration.configDropdown(label), label).toHaveText(value);
        });
      }
      await test.step('Close Extra Configuration without saving', async () => {
        await saleshandyIntegration.cancelExtraConfiguration();
      });
    });

    test('Create a Task in HubSpot > 3: Due in set to 0', async ({ saleshandyIntegration }) => {
      await test.step('Select Create a Task', async () => {
        await flow.startClean(saleshandyIntegration);
        await saleshandyIntegration.selectActivity(flow.trigger, CREATE_TASK);
      });
      await test.step('Fill title, type and priority, leave Due In at 0', async () => {
        await saleshandyIntegration.configTextbox('Task Title').fill('Follow up from the workflow');
        await saleshandyIntegration.chooseConfigOption('Task Type', 'Call');
        await saleshandyIntegration.chooseConfigOption('Task Priority', 'Medium');
        await saleshandyIntegration.dueIn().fill('0');
      });
      await test.step('Save cannot be clicked', async () => {
        await expect(saleshandyIntegration.configSaveButton(), 'Save with Due In 0').toBeDisabled();
      });
      await test.step('Close the dialog and remove Create a Task', async () => {
        await saleshandyIntegration.cancelExtraConfiguration();
        await saleshandyIntegration.removeActivity(flow.trigger, CREATE_TASK);
      });
    });

    test('Create a Task in HubSpot > 4: Task title empty', async ({ saleshandyIntegration }) => {
      await test.step('Select Create a Task', async () => {
        await flow.startClean(saleshandyIntegration);
        await saleshandyIntegration.selectActivity(flow.trigger, CREATE_TASK);
      });
      await test.step('Fill type, priority and Due In 3, leave the title empty', async () => {
        await saleshandyIntegration.chooseConfigOption('Task Type', 'Call');
        await saleshandyIntegration.chooseConfigOption('Task Priority', 'Medium');
        await saleshandyIntegration.dueIn().fill('3');
        await saleshandyIntegration.configTextbox('Task Title').fill('');
      });
      await test.step('Save cannot be clicked', async () => {
        await expect(saleshandyIntegration.configSaveButton(), 'Save with an empty title').toBeDisabled();
      });
      await test.step('Close the dialog and remove Create a Task', async () => {
        await saleshandyIntegration.cancelExtraConfiguration();
        await saleshandyIntegration.removeActivity(flow.trigger, CREATE_TASK);
      });
    });

    test('Record (log) an email activity in HubSpot > 1: Activity selected', async ({ saleshandyIntegration }) => {
      await test.step(`Select "${RECORD_EMAIL}"`, async () => {
        await flow.startClean(saleshandyIntegration);
        await saleshandyIntegration.selectActivity(flow.trigger, RECORD_EMAIL);
      });
      await test.step('Hover the info icon next to the activity', async () => {
        await saleshandyIntegration.hoverActivityInfo(flow.trigger, RECORD_EMAIL);
        // Product text, with "Email" capitalised (seen 2026-10-09).
        await expect(saleshandyIntegration.tooltip(), 'tooltip').toHaveText(
          'Logging an Email alone would result in failure. Please create/update contact or deal to associate an email.',
        );
      });
    });

    test('Record (log) an email activity in HubSpot > 2: Only this activity selected', async ({ saleshandyIntegration }) => {
      await test.step(`Select only "${RECORD_EMAIL}" and Save`, async () => {
        await flow.startClean(saleshandyIntegration);
        await saleshandyIntegration.selectActivity(flow.trigger, RECORD_EMAIL);
        await saleshandyIntegration.save();
        await expect(saleshandyIntegration.savedToast(), 'save confirmation').toBeVisible();
      });
      await test.step('Reload: the activity is still the only one selected', async () => {
        await saleshandyIntegration.openTriggers();
        expect(await saleshandyIntegration.isTriggerOn(flow.trigger), 'trigger on').toBe(true);
        await expect.poll(() => saleshandyIntegration.selectedActivities(flow.trigger), 'selected activities').toEqual([RECORD_EMAIL]);
      });
    });

    test('Create a Contact in HubSpot > 2: Contact not in HubSpot, Lead Status and Lead Lifecycle set', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Create a Contact in HubSpot > 2');
      await test.step('Select only Create a Contact: Lead Status Open, Lead Lifecycle Marketing Qualified Lead', async () => {
        await flow.useOnly(saleshandyIntegration, CREATE_CONTACT, { 'Lead Status': 'Open', 'Lead Lifecycle': 'Marketing Qualified Lead' }, []);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known);
      });
      await test.step('Check the contact in HubSpot: Lead status, Lifecycle stage and mapped fields', async () => {
        await expectContact(hubspotContacts, row, { ...mapped(row), 'Lead status': 'Open', 'Lifecycle stage': 'Marketing Qualified Lead' });
      });
    });

    test('Update a Contact in HubSpot > 2: Contact in HubSpot, Update Lead Status and Update Lead Lifecycle set', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Update a Contact in HubSpot > 2');
      await test.step('Select only Update a Contact: Lead Status Connected, Lifecycle Sales Qualified Lead', async () => {
        await flow.useOnly(saleshandyIntegration, UPDATE_CONTACT, { 'Update Lead Status': 'Connected', 'Update Lead Lifecycle': 'Sales Qualified Lead' }, []);
      });
      await test.step('Create the contact in HubSpot', async () => {
        await hubspotContacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known);
      });
      await test.step('Check the contact in HubSpot: Lead status Connected, Lifecycle stage Sales Qualified Lead', async () => {
        await expectContact(hubspotContacts, row, { 'Lead status': 'Connected', 'Lifecycle stage': 'Sales Qualified Lead' });
      });
    });

    test('Create a deal in HubSpot > 3: Contact already has 1 deal', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
      const row = flow.rowFor('Create a deal in HubSpot > 3');
      const existing = flow.deals.filter((d) => d['Contact Email'] === row['Email']);
      await test.step('Select only Create a Deal: Sales Pipeline, Initial Contact, New Business, High, Closing Date 0 Days', async () => {
        await flow.useOnly(saleshandyIntegration, CREATE_DEAL, dealConfig('0'), []);
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
      await test.step('Check HubSpot: one new deal on the contact with the configured values and no close date', async () => {
        let newDeals: { id: string; name: string }[] = [];
        await untilPasses('New deal not on the contact in HubSpot', async () => {
          const deals = await hubspotContacts.associations(contactId, 'deals');
          expect(deals.count, 'deals on the contact').toBe(existing.length + 1);
          newDeals = deals.records.filter((r) => !existing.some((d) => d['Deal Name'] === r.name));
          expect(newDeals.length, 'new deals').toBe(1);
        });
        // Deal name is not checked: it is first + last name for now (AL-4104).
        const deal = await hubspotDeals.summary(newDeals[0].id);
        expect(deal, 'new deal').toMatchObject({ pipeline: 'Sales Pipeline', stage: 'Initial Contact', dealType: 'New Business', priority: 'High', closeDate: '--' });
      });
    });

    test('Create a company in HubSpot > 3: Contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Create a company in HubSpot > 3');
      await test.step('Select only Create a Company (no Extra Configuration)', async () => {
        await flow.useOnly(saleshandyIntegration, CREATE_COMPANY, {}, []);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      test.setTimeout(15 * 60_000); // a log can sit on RUNNING for minutes (Reply run 2026-10-12, 11:11 entry)
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known, 10 * 60_000);
      });
      await test.step('Check HubSpot: contact created with one associated company', async () => {
        let contactId = '';
        await untilPasses(`Contact ${row['Email']} not found in HubSpot`, async () => {
          contactId = await hubspotContacts.findContactId(row['Email'], fullName(row));
        });
        // Company name is not checked (AL-4104); the company domain comes from the email.
        const companies = await hubspotContacts.associations(contactId, 'companies');
        expect(companies.count, 'companies on the contact').toBe(1);
      });
    });

    test('Create a deal in HubSpot > 1: Contact in HubSpot, no deal, Closing Date 0 Days', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
      const row = flow.rowFor('Create a deal in HubSpot > 1');
      await test.step('Select only Create a Deal: Sales Pipeline, Initial Contact, New Business, High, 0 Days', async () => {
        await flow.useOnly(saleshandyIntegration, CREATE_DEAL, dealConfig('0'), []);
      });
      let contactId = '';
      await test.step('Create the contact in HubSpot', async () => {
        contactId = await hubspotContacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known);
      });
      await test.step('Check HubSpot: one deal on the contact with the configured values and no close date', async () => {
        const [deal] = await newDealsOf(hubspotContacts, contactId, 1, []);
        expect(await hubspotDeals.summary(deal.id), 'deal').toMatchObject({ pipeline: 'Sales Pipeline', stage: 'Initial Contact', dealType: 'New Business', priority: 'High', closeDate: '--' });
      });
    });

    test('Create a deal in HubSpot > 2: Contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Create a deal in HubSpot > 2');
      await test.step('Select only Create a Deal (0 Days)', async () => {
        await flow.useOnly(saleshandyIntegration, CREATE_DEAL, dealConfig('0'), []);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known);
      });
      await test.step('Check HubSpot: contact created with one associated deal', async () => {
        let contactId = '';
        await untilPasses(`Contact ${row['Email']} not found in HubSpot`, async () => {
          contactId = await hubspotContacts.findContactId(row['Email'], fullName(row));
        });
        await newDealsOf(hubspotContacts, contactId, 1, []);
      });
    });

    test('Create a deal in HubSpot > 4: Prospect has Deal Value, Extra Configuration Closing Date 1 Day', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
      const row = flow.rowFor('Create a deal in HubSpot > 4');
      await test.step('Select only Create a Deal (1 Day)', async () => {
        await flow.useOnly(saleshandyIntegration, CREATE_DEAL, dealConfig('1'), []);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known);
      });
      await test.step(`Check HubSpot: Amount = Deal Value ${row['Deal Value']}, close date 1 day from today`, async () => {
        let contactId = '';
        await untilPasses(`Contact ${row['Email']} not found in HubSpot`, async () => {
          contactId = await hubspotContacts.findContactId(row['Email'], fullName(row));
        });
        const [deal] = await newDealsOf(hubspotContacts, contactId, 1, []);
        // The close date shows in the header after the other values, so re-read until it is there.
        await expect(async () => {
          const summary = await hubspotDeals.summary(deal.id);
          expect(summary.amount.replace(/[^0-9.]/g, ''), 'Amount').toMatch(new RegExp(`^${row['Deal Value']}(\\.0+)?$`));
          expect(summary.closeDate, 'Close Date').toBe(daysFromToday(1));
        }).toPass({ timeout: 60_000 });
      });
    });

    test('Create a deal in HubSpot > 5: Closing Date 51 Days', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
      const row = flow.rowFor('Create a deal in HubSpot > 5');
      await test.step('Select only Create a Deal (51 Days)', async () => {
        await flow.useOnly(saleshandyIntegration, CREATE_DEAL, dealConfig('51'), []);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known);
      });
      await test.step('Check HubSpot: close date 51 days from today (not 50, AL-4051)', async () => {
        let contactId = '';
        await untilPasses(`Contact ${row['Email']} not found in HubSpot`, async () => {
          contactId = await hubspotContacts.findContactId(row['Email'], fullName(row));
        });
        const [deal] = await newDealsOf(hubspotContacts, contactId, 1, []);
        await expect(async () => {
          expect((await hubspotDeals.summary(deal.id)).closeDate, 'Close Date').toBe(daysFromToday(51));
        }).toPass({ timeout: 60_000 });
      });
    });

    test('Update a deal in HubSpot > 1: Contact has 1 deal', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
      const row = flow.rowFor('Update a deal in HubSpot > 1');
      await test.step('Select only Update a Deal: Sales Pipeline, Initial Contact, New Business, High, 0 Days', async () => {
        await flow.useOnly(saleshandyIntegration, UPDATE_DEAL, dealUpdateConfig('0'), []);
      });
      let dealIds: string[] = [];
      await test.step('Create the contact in HubSpot with 1 deal', async () => {
        dealIds = await contactWithDeals(flow, row, hubspotContacts, hubspotDeals);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      test.setTimeout(25 * 60_000); // the Update a Deal log alone can take about 7.5 minutes
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
      });
      await test.step('Check HubSpot: the deal shows the configured Pipeline, Stage, Type and Priority', async () => {
        await expect(async () => {
          expect(await hubspotDeals.summary(dealIds[0]), 'deal').toMatchObject({ pipeline: 'Sales Pipeline', stage: 'Initial Contact', dealType: 'New Business', priority: 'High' });
        }).toPass({ timeout: 60_000 });
      });
    });

    test('Update a deal in HubSpot > 2: Contact has 3 deals', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
      const row = flow.rowFor('Update a deal in HubSpot > 2');
      await test.step('Select only Update a Deal: Sales Pipeline, Initial Contact, New Business, High, 0 Days', async () => {
        await flow.useOnly(saleshandyIntegration, UPDATE_DEAL, dealUpdateConfig('0'), []);
      });
      let dealIds: string[] = [];
      const before: unknown[] = [];
      await test.step('Create the contact in HubSpot with 3 deals, one after the other', async () => {
        dealIds = await contactWithDeals(flow, row, hubspotContacts, hubspotDeals);
        expect(dealIds.length, 'deals created').toBe(3);
        for (const id of dealIds.slice(0, 2)) before.push(await hubspotDeals.summary(id));
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      test.setTimeout(25 * 60_000); // the Update a Deal log alone can take about 7.5 minutes
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
      });
      await test.step('Check HubSpot: the latest created deal is updated (AL-4103)', async () => {
        await expect(async () => {
          expect(await hubspotDeals.summary(dealIds[2]), 'latest created deal').toMatchObject({ pipeline: 'Sales Pipeline', stage: 'Initial Contact', dealType: 'New Business', priority: 'High' });
        }).toPass({ timeout: 60_000 });
      });
      await test.step('Check HubSpot: the 2 older deals are unchanged', async () => {
        for (const [i, id] of dealIds.slice(0, 2).entries()) {
          expect(await hubspotDeals.summary(id), `deal ${i + 1}`).toEqual(before[i]);
        }
      });
    });

    test('Update a deal in HubSpot > 4: Contact has 1 deal, Closing Date 51 Days', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
      const row = flow.rowFor('Update a deal in HubSpot > 4');
      await test.step('Select only Update a Deal (51 Days)', async () => {
        await flow.useOnly(saleshandyIntegration, UPDATE_DEAL, dealUpdateConfig('51'), []);
      });
      let dealIds: string[] = [];
      await test.step('Create the contact in HubSpot with 1 deal', async () => {
        dealIds = await contactWithDeals(flow, row, hubspotContacts, hubspotDeals);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      test.setTimeout(25 * 60_000); // the Update a Deal log alone can take about 7.5 minutes
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
      });
      await test.step('Check HubSpot: close date 51 days from today', async () => {
        await expect(async () => {
          expect((await hubspotDeals.summary(dealIds[0])).closeDate, 'Close Date').toBe(daysFromToday(51));
        }).toPass({ timeout: 60_000 });
      });
    });

    test('Update a deal in HubSpot > 5: Contact in HubSpot with 0 deals', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Update a deal in HubSpot > 5');
      await test.step('Select only Update a Deal (0 Days)', async () => {
        await flow.useOnly(saleshandyIntegration, UPDATE_DEAL, dealUpdateConfig('0'), []);
      });
      let contactId = '';
      await test.step('Create the contact in HubSpot, no deal', async () => {
        contactId = await hubspotContacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      test.setTimeout(25 * 60_000); // the Update a Deal log alone can take about 7.5 minutes
      await test.step('Wait until the new log entries have finished', async () => {
        const statuses = await flow.newLogsFinished(saleshandyIntegration, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
        test.info().annotations.push({ type: 'Log status', description: statuses.join(', ') });
      });
      await test.step('Check HubSpot: the contact still has no deal', async () => {
        expect((await hubspotContacts.associations(contactId, 'deals')).count, 'deals on the contact').toBe(0);
      });
    });

    test('Update a deal in HubSpot > 6: Contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Update a deal in HubSpot > 6');
      await test.step('Select only Update a Deal (0 Days)', async () => {
        await flow.useOnly(saleshandyIntegration, UPDATE_DEAL, dealUpdateConfig('0'), []);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      test.setTimeout(25 * 60_000); // the Update a Deal log alone can take about 7.5 minutes
      await test.step('Wait until the new log entries have finished', async () => {
        const statuses = await flow.newLogsFinished(saleshandyIntegration, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
        test.info().annotations.push({ type: 'Log status', description: statuses.join(', ') });
      });
      await test.step('Check HubSpot: no contact was created', async () => {
        expect(await hubspotContacts.contactExists(row['Email'], fullName(row)), `contact ${row['Email']} in HubSpot`).toBe(false);
      });
    });

    // ---- Rows added 2026-10-12 by a background fork: written and typechecked,
    // NOT run. Rows that need a HubSpot or Mailinator screen nobody has walked
    // are listed in context/hubspot/link-clicked-progress.md ("Rows written
    // 2026-10-12"). "From row N" rows reuse the prospect of row N through
    // `carried`, so they only work after that row ran in the same run.
    const carried = new Map<string, Row>();
    const fromRow = (key: string): Row => {
      const row = carried.get(key);
      if (!row) throw new Error(`"${key}" has to pass first in this run: this row continues with its prospect`);
      return row;
    };

    test('Create a Contact in HubSpot > 3: Contact already in HubSpot, prospect details changed', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Create a Contact in HubSpot > 3');
      await test.step('Select only Create a Contact: Lead Status Open, Lead Lifecycle Marketing Qualified Lead', async () => {
        await flow.useOnly(saleshandyIntegration, CREATE_CONTACT, CREATE_CONTACT_VALUES, []);
      });
      await test.step('Create the contact in HubSpot', async () => {
        await newContact(hubspotContacts, row);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row, async () => {
        await test.step('Change Job Title and City in Saleshandy', async () => {
          await changeProspect(saleshandyCrm, row, { 'Job Title': row['Updated Job Title'], City: row['Updated City'] });
        });
      });
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known);
      });
      await test.step('Check the contact in HubSpot shows the new values', async () => {
        await expectContact(hubspotContacts, row, { 'Job title': row['Updated Job Title'], City: row['Updated City'] });
      });
      carried.set('Create a Contact in HubSpot > 3', row);
    });

    test('Create a Contact in HubSpot > 4: Contact already at a later Lifecycle Stage than the configured one', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Create a Contact in HubSpot > 4');
      await test.step('Select only Create a Contact: Lifecycle Marketing Qualified Lead', async () => {
        await flow.useOnly(saleshandyIntegration, CREATE_CONTACT, CREATE_CONTACT_VALUES, []);
      });
      await test.step('Create the contact in HubSpot and set its Lifecycle stage to Sales Qualified Lead', async () => {
        const contactId = await newContact(hubspotContacts, row);
        await hubspotContacts.setDropdownProperty(contactId, 'Lifecycle stage', 'Sales Qualified Lead');
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known);
      });
      await test.step('Check the contact in HubSpot stays at Sales Qualified Lead (HubSpot blocks backward moves)', async () => {
        await expectContact(hubspotContacts, row, { 'Lifecycle stage': 'Sales Qualified Lead' });
      });
    });

    if (!skip.has('Create a Contact in HubSpot > 6')) {
      test('Create a Contact in HubSpot > 6: Second link clicked after row 3', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
        const row = fromRow('Create a Contact in HubSpot > 3');
        await test.step('Select only Create a Contact again', async () => {
          await flow.useOnly(saleshandyIntegration, CREATE_CONTACT, CREATE_CONTACT_VALUES, []);
        });
        const known = await flow.knownLogIds(saleshandyIntegration);
        await test.step('Change Job Title again in Saleshandy', async () => {
          await changeProspect(saleshandyCrm, row, { 'Job Title': row['Second Updated Job Title'] });
        });
        test.setTimeout(15 * 60_000);
        await test.step('Click the second link in the step 1 email (Clicked goes from 1 to 2)', async () => {
          await flow.fireEvent({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row, 1, 1);
        });
        await test.step('Check Logs: new entries are Success', async () => {
          await flow.expectNewLogsSuccess(saleshandyIntegration, known);
        });
        await test.step('Check the contact in HubSpot shows the second Job Title', async () => {
          await expectContact(hubspotContacts, row, { 'Job title': row['Second Updated Job Title'] });
        });
      });
    }

    test('Update a Contact in HubSpot > 3: Contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Update a Contact in HubSpot > 3');
      await test.step('Select only Update a Contact: Connected, Sales Qualified Lead', async () => {
        await flow.useOnly(saleshandyIntegration, UPDATE_CONTACT, UPDATE_CONTACT_VALUES, []);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known);
      });
      await test.step('Check HubSpot: no contact was created', async () => {
        expect(await hubspotContacts.contactExists(row['Email'], fullName(row)), `contact ${row['Email']} in HubSpot`).toBe(false);
      });
    });

    test('Update a Contact in HubSpot > 4: Contact in HubSpot, prospect details not changed', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Update a Contact in HubSpot > 4');
      await test.step('Select only Update a Contact: Connected, Sales Qualified Lead', async () => {
        await flow.useOnly(saleshandyIntegration, UPDATE_CONTACT, UPDATE_CONTACT_VALUES, []);
      });
      // QA, 2026-10-13: "details not changed" = the HubSpot contact already has
      // the values the prospect has (and the configured Lead Status and
      // Lifecycle Stage), so the run changes nothing. Saved Extra
      // Configuration values cannot be cleared on an account, so the contact
      // gets those two values too.
      await test.step('Create the contact in HubSpot with the prospect\'s values (Job title, City, Lead status, Lifecycle stage)', async () => {
        const contactId = await newContact(hubspotContacts, row);
        await hubspotContacts.updateProperties(contactId, { City: row['City'] });
        await hubspotContacts.setDropdownProperty(contactId, 'Lead status', UPDATE_CONTACT_VALUES['Update Lead Status']);
        await hubspotContacts.setDropdownProperty(contactId, 'Lifecycle stage', UPDATE_CONTACT_VALUES['Update Lead Lifecycle']);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known);
      });
      await test.step('Check the contact in HubSpot is unchanged', async () => {
        await expectContact(hubspotContacts, row, {
          'Job title': row['Job Title'],
          City: row['City'],
          'Lead status': UPDATE_CONTACT_VALUES['Update Lead Status'],
          'Lifecycle stage': UPDATE_CONTACT_VALUES['Update Lead Lifecycle'],
        });
      });
    });

    test('Create a company in HubSpot > 1: Contact in HubSpot, prospect has company details', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Create a company in HubSpot > 1');
      await test.step('Select only Create a Company (no Extra Configuration)', async () => {
        await flow.useOnly(saleshandyIntegration, CREATE_COMPANY, {}, []);
      });
      let contactId = '';
      await test.step('Create the contact in HubSpot', async () => {
        contactId = await newContact(hubspotContacts, row);
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
        const contactId = await findContact(hubspotContacts, row);
        const [company] = await expectCompanies(hubspotContacts, contactId, 1);
        expect(company.id, 'associated company is a new one').not.toBe(existingId);
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
        companyIds = await contactWithCompanies(flow, row, hubspotContacts, hubspotCompanies);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row, async () => {
        await test.step('Change City and State in Saleshandy', async () => {
          await changeProspect(saleshandyCrm, row, { City: row['Updated City'], State: row['Updated State'] });
        });
      });
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known);
      });
      await test.step('Check HubSpot: the company shows the new City and State (name is not checked, AL-4104)', async () => {
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
        companyIds = await contactWithCompanies(flow, row, hubspotContacts, hubspotCompanies);
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
        contactId = await newContact(hubspotContacts, row);
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

    test('Create a Task in HubSpot > 1: Contact in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Create a Task in HubSpot > 1');
      await test.step(`Select only Create a Task: "${TASK.title}", ${TASK.type}, ${TASK.priority}, Due in ${TASK.dueDays}`, async () => {
        await useTask(flow, saleshandyIntegration);
      });
      let contactId = '';
      await test.step('Create the contact in HubSpot', async () => {
        contactId = await newContact(hubspotContacts, row);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known);
      });
      await test.step(`Check HubSpot: task "${TASK.title}" on the contact, due ${TASK.dueDays} days from today`, async () => {
        await expectOnRecord(hubspotContacts, '0-1', contactId, [TASK.title, dueDatePattern(TASK.dueDays)], 'Task');
      });
    });

    test('Create a Task in HubSpot > 2: Contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Create a Task in HubSpot > 2');
      await test.step(`Select only Create a Task: "${TASK.title}", ${TASK.type}, ${TASK.priority}, Due in ${TASK.dueDays}`, async () => {
        await useTask(flow, saleshandyIntegration);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known);
      });
      await test.step('Check HubSpot: contact created with the task on it', async () => {
        const contactId = await findContact(hubspotContacts, row);
        await expectOnRecord(hubspotContacts, '0-1', contactId, [TASK.title, dueDatePattern(TASK.dueDays)], 'Task');
      });
    });

    test('Create a Note in HubSpot > 1: Paired with Create a Contact, contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Create a Note in HubSpot > 1');
      await test.step('Select Create a Contact (Open, Marketing Qualified Lead) and Create a Note', async () => {
        await usePaired(flow, saleshandyIntegration, CREATE_CONTACT, CREATE_CONTACT_VALUES, CREATE_NOTE);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known);
      });
      await test.step('Check HubSpot: contact created, note on it with Step, Variant and Prospect Email', async () => {
        const contactId = await findContact(hubspotContacts, row);
        await expectOnRecord(hubspotContacts, '0-1', contactId, ['Note created via Saleshandy', ...flow.noteContains(row, 1)], 'Note');
      });
    });

    test('Create a Note in HubSpot > 2: Paired with Update a Contact, contact in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Create a Note in HubSpot > 2');
      await test.step('Select Update a Contact (Connected, Sales Qualified Lead) and Create a Note', async () => {
        await usePaired(flow, saleshandyIntegration, UPDATE_CONTACT, UPDATE_CONTACT_VALUES, CREATE_NOTE);
      });
      let contactId = '';
      await test.step('Create the contact in HubSpot', async () => {
        contactId = await newContact(hubspotContacts, row);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known);
      });
      await test.step('Check HubSpot: note on the contact', async () => {
        await expectOnRecord(hubspotContacts, '0-1', contactId, ['Note created via Saleshandy', ...flow.noteContains(row, 1)], 'Note');
      });
      carried.set('Create a Note in HubSpot > 2', row);
    });

    test('Create a Note in HubSpot > 3: Paired with Create a deal, prospect has Deal Value', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Create a Note in HubSpot > 3');
      await test.step('Select Create a Deal (Closing Date 1 Day) and Create a Note', async () => {
        await usePaired(flow, saleshandyIntegration, CREATE_DEAL, dealConfig('1'), CREATE_NOTE);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known);
      });
      await test.step('Check HubSpot: note on both the contact and the deal', async () => {
        const contactId = await findContact(hubspotContacts, row);
        const [deal] = await newDealsOf(hubspotContacts, contactId, 1, []);
        const texts = ['Note created via Saleshandy', ...flow.noteContains(row, 1)];
        await expectOnRecord(hubspotContacts, '0-1', contactId, texts, 'Note on the contact');
        await expectOnRecord(hubspotContacts, '0-3', deal.id, texts, 'Note on the deal');
      });
    });

    test('Create a Note in HubSpot > 4: Paired with Update a deal, contact has 1 deal', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
      const row = flow.rowFor('Create a Note in HubSpot > 4');
      await test.step('Select Update a Deal (0 Days) and Create a Note', async () => {
        await usePaired(flow, saleshandyIntegration, UPDATE_DEAL, dealUpdateConfig('0'), CREATE_NOTE);
      });
      let dealIds: string[] = [];
      await test.step('Create the contact in HubSpot with 1 deal', async () => {
        dealIds = await contactWithDeals(flow, row, hubspotContacts, hubspotDeals);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      test.setTimeout(25 * 60_000); // the Update a Deal log alone can take about 7.5 minutes
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
      });
      // QA, 2026-10-14 (confirmed with the developer): with Update a deal the
      // contact and the deal both receive the note (it was deal only on 2026-10-13).
      await test.step('Check HubSpot: note on the deal and on the contact', async () => {
        const contactId = await findContact(hubspotContacts, row);
        const texts = ['Note created via Saleshandy', ...flow.noteContains(row, 1)];
        await expectOnRecord(hubspotContacts, '0-3', dealIds[0], texts, 'Note on the deal');
        await expectOnRecord(hubspotContacts, '0-1', contactId, texts, 'Note on the contact');
      });
    });

    // Step 2 rows need a workflow whose event can be fired on the step 2 email (Link Clicked: yes; Reply Received: no, its mark-as-replied has no step 2 row).
    if (flow.step2Events) {
      test('Create a Note in HubSpot > 5: Pairing from row 2, step 2 sent', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
        const row = fromRow('Create a Note in HubSpot > 2');
        await test.step('Select Update a Contact (Connected, Sales Qualified Lead) and Create a Note again', async () => {
          await usePaired(flow, saleshandyIntegration, UPDATE_CONTACT, UPDATE_CONTACT_VALUES, CREATE_NOTE);
        });
        const known = await flow.knownLogIds(saleshandyIntegration);
        test.setTimeout(20 * 60_000);
        await test.step('Send now on step 2 and click its first link', async () => {
          await flow.fireEvent({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row, 2);
        });
        await test.step('Check Logs: new entries are Success', async () => {
          await flow.expectNewLogsSuccess(saleshandyIntegration, known);
        });
        await test.step('Check HubSpot: a new note on the contact shows Step 2, Variant A', async () => {
          const contactId = await findContact(hubspotContacts, row);
          await expectOnRecord(hubspotContacts, '0-1', contactId, flow.noteContains(row, 2), 'Step 2 note');
        });
      });
    }

    test('Create a Note in HubSpot > 6: Create a Note selected alone', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Create a Note in HubSpot > 6');
      await test.step('Select only Create a Note (no Extra Configuration)', async () => {
        await flow.useOnly(saleshandyIntegration, CREATE_NOTE, {}, []);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      // QA, 2026-10-13: the log is for the custom workflow, which runs fine
      // with only Create a Note selected, so it is Success; the note itself
      // lands on no contact, company or deal.
      await test.step('Wait until the new log entries have finished: all are Success', async () => {
        const statuses = await flow.newLogsFinished(saleshandyIntegration, known);
        test.info().annotations.push({ type: 'Log status', description: statuses.join(', ') });
        expect(statuses, 'log statuses (the workflow itself succeeds)').not.toContain('Error');
        expect(statuses, 'log statuses').toContain('Success');
      });
      await test.step('Check HubSpot: no contact was created, so no note exists on any record', async () => {
        expect(await hubspotContacts.contactExists(row['Email'], fullName(row)), `contact ${row['Email']} in HubSpot`).toBe(false);
      });
    });

    test('Record (log) an email activity in HubSpot > 3: Paired with Create a Contact, contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Record (log) an email activity in HubSpot > 3');
      await test.step('Select Create a Contact (Open, Marketing Qualified Lead) and Record (log) an Email Activity', async () => {
        await usePaired(flow, saleshandyIntegration, CREATE_CONTACT, CREATE_CONTACT_VALUES, RECORD_EMAIL);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known);
      });
      await test.step('Check HubSpot: contact created, email logged on it', async () => {
        const contactId = await findContact(hubspotContacts, row);
        await expectOnRecord(hubspotContacts, '0-1', contactId, flow.loggedEmailContains(row, 1), 'Logged email');
      });
    });

    test('Record (log) an email activity in HubSpot > 4: Paired with Update a Contact, contact in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Record (log) an email activity in HubSpot > 4');
      await test.step('Select Update a Contact (Connected, Sales Qualified Lead) and Record (log) an Email Activity', async () => {
        await usePaired(flow, saleshandyIntegration, UPDATE_CONTACT, UPDATE_CONTACT_VALUES, RECORD_EMAIL);
      });
      let contactId = '';
      await test.step('Create the contact in HubSpot', async () => {
        contactId = await newContact(hubspotContacts, row);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known);
      });
      await test.step('Check HubSpot: email logged on the contact', async () => {
        await expectOnRecord(hubspotContacts, '0-1', contactId, flow.loggedEmailContains(row, 1), 'Logged email');
      });
      carried.set('Record (log) an email activity in HubSpot > 4', row);
    });

    test('Record (log) an email activity in HubSpot > 5: Paired with Create a deal', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Record (log) an email activity in HubSpot > 5');
      await test.step('Select Create a Deal (Closing Date 1 Day) and Record (log) an Email Activity', async () => {
        await usePaired(flow, saleshandyIntegration, CREATE_DEAL, dealConfig('1'), RECORD_EMAIL);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known);
      });
      await test.step('Check HubSpot: email logged on both the deal and the contact', async () => {
        const contactId = await findContact(hubspotContacts, row);
        const [deal] = await newDealsOf(hubspotContacts, contactId, 1, []);
        await expectOnRecord(hubspotContacts, '0-1', contactId, flow.loggedEmailContains(row, 1), 'Logged email on the contact');
        await expectOnRecord(hubspotContacts, '0-3', deal.id, flow.loggedEmailContains(row, 1), 'Logged email on the deal');
      });
    });

    test('Record (log) an email activity in HubSpot > 6: Paired with Update a deal, contact has 3 deals', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
      const row = flow.rowFor('Record (log) an email activity in HubSpot > 6');
      await test.step('Select Update a Deal (0 Days) and Record (log) an Email Activity', async () => {
        await usePaired(flow, saleshandyIntegration, UPDATE_DEAL, dealUpdateConfig('0'), RECORD_EMAIL);
      });
      let dealIds: string[] = [];
      await test.step('Create the contact in HubSpot with 3 deals, one after the other', async () => {
        dealIds = await contactWithDeals(flow, row, hubspotContacts, hubspotDeals);
        expect(dealIds.length, 'deals created').toBe(3);
      });
      const known = await flow.runTrigger({ sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      test.setTimeout(25 * 60_000); // the Update a Deal log alone can take about 7.5 minutes
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known, UPDATE_DEAL_LOG_TIMEOUT_MS);
      });
      await test.step('Check HubSpot: the latest created deal is updated (AL-4103)', async () => {
        await expect(async () => {
          expect(await hubspotDeals.summary(dealIds[2]), 'latest created deal').toMatchObject({ pipeline: 'Sales Pipeline', stage: 'Initial Contact', dealType: 'New Business', priority: 'High' });
        }).toPass({ timeout: 60_000 });
      });
      // QA, 2026-10-13: Update a deal + Record email logs the email on the
      // latest deal only; the contact gets nothing (expected). The card on the
      // deal must name the prospect; it shows "Unknown Contact" (bug, draft in
      // jira/drafts/link-clicked-update-deal-record-email-unknown-contact.json).
      await test.step('Check HubSpot: email logged on the latest deal naming the prospect, not on the contact', async () => {
        const contactId = await findContact(hubspotContacts, row);
        await expectOnRecord(hubspotContacts, '0-3', dealIds[2], flow.loggedEmailContains(row, 1), 'Logged email on the deal');
        // The header no longer names the prospect, so the bug (AL-4123) is
        // checked on its own text.
        expect(await hubspotContacts.activitiesText('0-3', dealIds[2]), 'deal Activities').not.toContain('Unknown Contact');
        expect(await hubspotContacts.activitiesText('0-1', contactId), 'contact Activities').not.toContain(flow.loggedEmailContains(row, 1)[0]);
      });
    });

    // Same as Create a Note > 5.
    if (flow.step2Events) {
      test('Record (log) an email activity in HubSpot > 7: Pairing from row 4, step 2 sent', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
        const row = fromRow('Record (log) an email activity in HubSpot > 4');
        await test.step('Select Update a Contact (Connected, Sales Qualified Lead) and Record (log) an Email Activity again', async () => {
          await usePaired(flow, saleshandyIntegration, UPDATE_CONTACT, UPDATE_CONTACT_VALUES, RECORD_EMAIL);
        });
        const known = await flow.knownLogIds(saleshandyIntegration);
        test.setTimeout(20 * 60_000);
        await test.step('Send now on step 2 and click its first link', async () => {
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
    }

    // Only where the workflow does not write its own version (Reply Received has a "second reply" one in its spec).
    if (flow.secondEventRows) {
      test('Update a deal in HubSpot > 3: Deal updated in row 1, Extra Configuration values changed', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
        const row = flow.rowFor('Update a deal in HubSpot > 3');
        const ctx = { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration };
        // Same change as Update a deal 4 and the Reply Received version: Closing Date 0 Days, then 51 Days.
        await test.step('Select only Update a Deal: Sales Pipeline, Initial Contact, New Business, High, 0 Days', async () => {
          await flow.useOnly(saleshandyIntegration, UPDATE_DEAL, dealUpdateConfig('0'), []);
        });
        let dealIds: string[] = [];
        await test.step('Create the contact in HubSpot with 1 deal', async () => {
          dealIds = await contactWithDeals(flow, row, hubspotContacts, hubspotDeals);
        });
        const first = await flow.runTrigger(ctx, row);
        test.setTimeout(50 * 60_000); // two Update a Deal logs, about 7.5 minutes each
        await test.step('First click: Logs Success and the deal shows the configured values', async () => {
          await flow.expectNewLogsSuccess(saleshandyIntegration, first, UPDATE_DEAL_LOG_TIMEOUT_MS);
          await expect(async () => {
            expect(await hubspotDeals.summary(dealIds[0]), 'deal after the first click').toMatchObject({ pipeline: 'Sales Pipeline', stage: 'Initial Contact', dealType: 'New Business', priority: 'High' });
          }).toPass({ timeout: 60_000 });
        });
        await test.step('Change Extra Configuration: Closing Date 51 Days', async () => {
          await flow.useOnly(saleshandyIntegration, UPDATE_DEAL, dealUpdateConfig('51'), []);
        });
        const second = await flow.knownLogIds(saleshandyIntegration);
        await test.step('Click the second link in the step 1 email (Clicked goes from 1 to 2)', async () => {
          await flow.fireEvent(ctx, row, 1, 1);
        });
        await test.step('Check Logs: new entries are Success', async () => {
          await flow.expectNewLogsSuccess(saleshandyIntegration, second, UPDATE_DEAL_LOG_TIMEOUT_MS);
        });
        await test.step('Check HubSpot: close date is 51 days from today', async () => {
          await expect(async () => {
            expect((await hubspotDeals.summary(dealIds[0])).closeDate, 'Close Date').toBe(daysFromToday(51));
          }).toPass({ timeout: 60_000 });
        });
      });
    }

  });
}

// Creates the row's contact in HubSpot with its deals from the -deals CSV, in
// file order (so the last one is the latest created). Returns the deal ids.
async function contactWithDeals(
  flow: Flow,
  row: Record<string, string>,
  hubspotContacts: { createContact(c: { email: string; firstName: string; lastName: string; jobTitle: string }): Promise<string> },
  hubspotDeals: { createDealForContact(contactId: string, deal: { name: string; amount?: string }): Promise<string> },
): Promise<string[]> {
  const contactId = await hubspotContacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });
  const ids: string[] = [];
  for (const d of flow.deals.filter((x) => x['Contact Email'] === row['Email'])) {
    ids.push(await hubspotDeals.createDealForContact(contactId, { name: d['Deal Name'], amount: d['Amount'] }));
  }
  return ids;
}

// ---- Helpers for the rows added 2026-10-12 ----

// Extra Configuration values the rows use (same as Create a Contact 2 / Update a Contact 2).
const CREATE_CONTACT_VALUES = { 'Lead Status': 'Open', 'Lead Lifecycle': 'Marketing Qualified Lead' };
const UPDATE_CONTACT_VALUES = { 'Update Lead Status': 'Connected', 'Update Lead Lifecycle': 'Sales Qualified Lead' };
const TASK = { title: 'Follow up from the workflow', type: 'Call', priority: 'Medium', dueDays: 3 };

const newContact = (contacts: HubSpotContactsPage, row: Row) =>
  contacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });

// Finds the contact HubSpot got from the workflow (waits until it exists).
async function findContact(contacts: HubSpotContactsPage, row: Row): Promise<string> {
  let id = '';
  await untilPasses(`Contact ${row['Email']} not found in HubSpot`, async () => {
    id = await contacts.findContactId(row['Email'], fullName(row));
  });
  return id;
}

// Edits prospect fields in the Saleshandy CRM (label to new value).
async function changeProspect(crm: SaleshandyCrmPage, row: Row, values: Record<string, string>): Promise<void> {
  await crm.search(row['Email']);
  await crm.openProspect(fullName(row));
  for (const [label, value] of Object.entries(values)) await crm.editField(label, value);
}

// Selects `activity` (with its Extra Configuration `values`) and a companion
// without Extra Configuration (Create a Note, Record (log)), then the page Save.
async function usePaired(flow: Flow, integration: HubSpotIntegrationPage, activity: string, values: Record<string, string>, companion: string): Promise<void> {
  await flow.useOnly(integration, activity, values, []);
  // The dialog's own save toast is still up for a moment; wait for it so the next one is the page Save's.
  await expect(integration.savedToast()).toBeHidden({ timeout: 15_000 });
  await integration.selectActivity(flow.trigger, companion);
  await integration.save();
  await expect(integration.savedToast(), 'save confirmation').toBeVisible();
}

// Only Create a Task selected and saved with the TASK values.
async function useTask(flow: Flow, integration: HubSpotIntegrationPage): Promise<void> {
  await flow.startClean(integration);
  await integration.selectActivity(flow.trigger, CREATE_TASK);
  await integration.configTextbox('Task Title').fill(TASK.title);
  await integration.chooseConfigOption('Task Type', TASK.type);
  await integration.chooseConfigOption('Task Priority', TASK.priority);
  await integration.dueIn().fill(String(TASK.dueDays));
  await integration.configSaveButton().click();
  // The save can show "Loading..." for more than 5 s (seen 2026-10-12).
  await expect(integration.savedToast(), 'save confirmation').toBeVisible({ timeout: 30_000 });
}

// "Oct 15" or "October 15, 2026": the due date N days from today, month name
// and day only (the Activities tab's date format is not walked yet).
function dueDatePattern(days: number): RegExp {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return new RegExp(`${month}[a-z]*\\.?\\s+0?${d.getDate()}\\b`);
}

// Waits until the record's Activities tab shows all texts (reloaded on each try).
async function expectOnRecord(
  hubspot: { activitiesText(typeId: '0-1' | '0-2' | '0-3', id: string): Promise<string> },
  typeId: '0-1' | '0-3',
  id: string,
  texts: (string | RegExp)[],
  what: string,
): Promise<void> {
  await untilPasses(`${what} not found on the HubSpot record ${typeId}/${id}`, async () => {
    const text = await hubspot.activitiesText(typeId, id);
    for (const t of texts) {
      if (typeof t === 'string') expect(text, `${what}: "${t}"`).toContain(t);
      else expect(text, `${what}: ${t}`).toMatch(t);
    }
  });
}

// Waits until the contact has `count` associated companies; returns them.
async function expectCompanies(contacts: HubSpotContactsPage, contactId: string, count: number) {
  let records: { id: string; name: string }[] = [];
  await untilPasses('Company not on the contact in HubSpot', async () => {
    const list = await contacts.associations(contactId, 'companies');
    expect(list.count, 'companies on the contact').toBe(count);
    records = list.records;
  });
  return records;
}

// Waits until the company shows all property values (label to value).
async function expectCompanyValues(companies: HubSpotCompaniesPage, companyId: string, values: Record<string, string>): Promise<void> {
  await untilPasses(`Company ${companyId} does not show the new values`, async () => {
    for (const [label, value] of Object.entries(values)) {
      expect(await companies.property(companyId, label), `Company ${label}`).toBe(value);
    }
  });
}

// Creates the row's contact in HubSpot, then its companies from the
// -companies CSV in file order and associates each to the contact (the last
// one is the latest associated). Returns the company ids.
async function contactWithCompanies(flow: Flow, row: Row, contacts: HubSpotContactsPage, companies: HubSpotCompaniesPage): Promise<string[]> {
  const contactId = await newContact(contacts, row);
  const ids: string[] = [];
  for (const c of flow.companies.filter((x) => x['Contact Email'] === row['Email'])) {
    const id = await companies.createCompany({ domain: c['Company Domain'], name: c['Company Name'] });
    await companies.associateContacts(id, [{ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'] }]);
    ids.push(id);
  }
  expect(contactId, 'contact id').not.toBe('');
  return ids;
}
