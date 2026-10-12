// Shared activity tests for the Saleshandy-side HubSpot workflows (written
// once, QA 2026-10-09). A workflow spec calls activityTests(flow, '<describe
// title>') after createFlow(...); titles are "<Activity> > <#>: <Scenario>" as
// in the scenario files, rows come from the workflow's CSV (Scenario column).
// "Extra Configuration skipped" rows come first; they skip themselves on an
// account where the activity was already configured.
import { expect, test } from '../fixtures/index.ts';
import { untilPasses } from '../utils/wait.ts';
import { daysFromToday, dealConfig, dealUpdateConfig, expectContact, fullName, mapped, newDealsOf, type createFlow } from './saleshandy-to-hubspot.ts';

export const CREATE_CONTACT = 'Create a Contact in Hubspot';
export const UPDATE_CONTACT = 'Update a Contact in Hubspot';
export const CREATE_DEAL = 'Create a Deal in Hubspot';
export const UPDATE_DEAL = 'Update a Deal in Hubspot';
// Observed 2026-10-12: the Update a Deal log stays RUNNING for 7m 25s (other activities finish in under 30 s).
const UPDATE_DEAL_LOG_TIMEOUT_MS = 12 * 60_000;
export const CREATE_COMPANY = 'Create a Company in Hubspot';
export const CREATE_TASK = 'Create a Task in Hubspot';
export const RECORD_EMAIL = 'Record(log) an Email Activity in Hubspot';

type Flow = ReturnType<typeof createFlow>;

export function activityTests(flow: Flow, title: string): void {
  test.describe(title, () => {
  test.describe.configure({ mode: 'serial' });

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
        await flow.useOnly(saleshandyIntegration, CREATE_DEAL, {
          'Select Pipeline (when to create)': 'Sales Pipeline',
          'Select Pipeline Stage (when to create)': 'Initial Contact',
          'Deal Type (while creating)': 'New Business',
          'Deal Priority (while creating)': 'High',
        }, []);
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
      await test.step('Check Logs: new entries are Success', async () => {
        await flow.expectNewLogsSuccess(saleshandyIntegration, known);
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
