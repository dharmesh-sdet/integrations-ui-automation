// Email is Bounced in Saleshandy, Phase 2: Extra Configuration filled.
// Scenarios: test-cases/hubspot/email-bounced.md ("Phase 2", approved by QA
// 2026-10-14). Data: test-data/hubspot/email-bounced-phase2.csv (replaced with
// new people before every run, src/data/global-setup.ts).
//
// Derived on 2026-10-14 from tests/hubspot/email-opened-phase2.spec.ts (same
// shared flow helpers), keeping only the rows of the Email Bounced Phase 2
// tables, numbered as in that file. Differences:
//  - the event is "Mark as bounced" on the step 1 email (a real bounce only in
//    Record (log) an email activity > 6, the third and last real bounce, QA
//    2026-10-14);
//  - no "second event" rows: a prospect can be marked as bounced only once
//    (QA, 2026-10-14);
//  - Update a deal rows set the Pipeline Stage two positions after the stage a
//    deal made through HubSpot's UI starts at: Prospecting (seen 2026-10-13)
//    to Follow-Up (the scenario file says so too).
// Saved Extra Configuration cannot be cleared again: run Phase 1
// (email-bounced.spec.ts) first.
import type { Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { expect, test } from '../../src/fixtures/index.ts';
import type { HubSpotCompaniesPage } from '../../src/pages/hubspot/companies.page.ts';
import type { HubSpotContactsPage } from '../../src/pages/hubspot/contacts.page.ts';
import type { HubSpotIntegrationPage } from '../../src/pages/saleshandy/hubspot-integration.page.ts';
import type { SaleshandyCrmPage } from '../../src/pages/saleshandy/crm.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';
import { daysFromToday, dealConfig, dealUpdateConfig as sharedDealUpdateConfig, expectContact, fullName, mapped, newDealsOf, createFlow } from '../../src/flows/saleshandy-to-hubspot.ts';

const CREATE_CONTACT = 'Create a Contact in Hubspot';
const UPDATE_CONTACT = 'Update a Contact in Hubspot';
const CREATE_DEAL = 'Create a Deal in Hubspot';
const UPDATE_DEAL = 'Update a Deal in Hubspot';
// Observed 2026-10-12: the Update a Deal log stays RUNNING for 7m 25s (other activities finish in under 30 s).
const UPDATE_DEAL_LOG_TIMEOUT_MS = 12 * 60_000;
const CREATE_COMPANY = 'Create a Company in Hubspot';
const UPDATE_COMPANY = 'Update a Company in Hubspot';
const CREATE_NOTE = 'Create a Note in Hubspot';
const CREATE_TASK = 'Create a Task in Hubspot';
const RECORD_EMAIL = 'Record(log) an Email Activity in Hubspot';

type Flow = ReturnType<typeof createFlow>;

// `skip`: scenario ids a workflow does not have (QA, 2026-10-13: "Create a
// Contact in HubSpot > 6" is a Link Clicked row only: a reply has no second link).
function activityTests(flow: Flow, title: string, options: { skip?: string[] } = {}): void {
  const skip = new Set(options.skip ?? []);
  test.describe(title, () => {
    // Not serial (QA, 2026-10-13): rows run in file order on one worker, and a
    // failed row does not turn the rest into "did not run".




    test('Create a Contact in HubSpot > 3: Lead Status and Lead Lifecycle saved before', async ({ saleshandyIntegration }) => {
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



    test('Create a Contact in HubSpot > 1: Contact not in HubSpot, Lead Status and Lead Lifecycle set', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Create a Contact in HubSpot > 1');
      await test.step('Select only Create a Contact: Lead Status Open, Lead Lifecycle Marketing Qualified Lead', async () => {
        await flow.useOnly(saleshandyIntegration, CREATE_CONTACT, { 'Lead Status': 'Open', 'Lead Lifecycle': 'Marketing Qualified Lead' }, []);
      });
      await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
      await test.step('Check the contact in HubSpot: Lead status, Lifecycle stage and mapped fields', async () => {
        await expectContact(hubspotContacts, row, { ...mapped(row), 'Lead status': 'Open', 'Lifecycle stage': 'Marketing Qualified Lead' });
      });
    });

    test('Update a Contact in HubSpot > 1: Contact in HubSpot, Update Lead Status and Update Lead Lifecycle set', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Update a Contact in HubSpot > 1');
      await test.step('Select only Update a Contact: Lead Status Connected, Lifecycle Sales Qualified Lead', async () => {
        await flow.useOnly(saleshandyIntegration, UPDATE_CONTACT, { 'Update Lead Status': 'Connected', 'Update Lead Lifecycle': 'Sales Qualified Lead' }, []);
      });
      await test.step('Create the contact in HubSpot', async () => {
        await hubspotContacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });
      });
      await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
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
      await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
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


    test('Create a deal in HubSpot > 1: Contact in HubSpot, no deal, Closing Date 0 Days', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
      const row = flow.rowFor('Create a deal in HubSpot > 1');
      await test.step('Select only Create a Deal: Sales Pipeline, Initial Contact, New Business, High, 0 Days', async () => {
        await flow.useOnly(saleshandyIntegration, CREATE_DEAL, dealConfig('0'), []);
      });
      let contactId = '';
      await test.step('Create the contact in HubSpot', async () => {
        contactId = await hubspotContacts.createContact({ email: row['Email'], firstName: row['First Name'], lastName: row['Last Name'], jobTitle: row['Job Title'] });
      });
      await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
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
      await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
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
      await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
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
        }).toPass({ timeout: 3 * 60_000 });
      });
    });

    test('Create a deal in HubSpot > 5: Closing Date 51 Days', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
      const row = flow.rowFor('Create a deal in HubSpot > 5');
      await test.step('Select only Create a Deal (51 Days)', async () => {
        await flow.useOnly(saleshandyIntegration, CREATE_DEAL, dealConfig('51'), []);
      });
      await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
      await test.step('Check HubSpot: close date 51 days from today (not 50, AL-4051)', async () => {
        let contactId = '';
        await untilPasses(`Contact ${row['Email']} not found in HubSpot`, async () => {
          contactId = await hubspotContacts.findContactId(row['Email'], fullName(row));
        });
        const [deal] = await newDealsOf(hubspotContacts, contactId, 1, []);
        await expect(async () => {
          expect((await hubspotDeals.summary(deal.id)).closeDate, 'Close Date').toBe(daysFromToday(51));
        }).toPass({ timeout: 3 * 60_000 });
      });
    });

    test('Update a deal in HubSpot > 1: Contact has 1 deal', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
      const row = flow.rowFor('Update a deal in HubSpot > 1');
      await test.step('Select only Update a Deal: Sales Pipeline, Follow-Up, New Business, High, 0 Days', async () => {
        await flow.useOnly(saleshandyIntegration, UPDATE_DEAL, dealUpdateConfig('0'), []);
      });
      let dealIds: string[] = [];
      await test.step('Create the contact in HubSpot with 1 deal', async () => {
        dealIds = await contactWithDeals(flow, row, hubspotContacts, hubspotDeals);
      });
      await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      test.setTimeout(25 * 60_000); // the Update a Deal log alone can take about 7.5 minutes
      await waitForSync(saleshandyIntegration, SLOW_SYNC_WAIT_MS);
      await test.step('Check HubSpot: the deal shows the configured Pipeline, Stage, Type and Priority', async () => {
        await expect(async () => {
          expect(await hubspotDeals.summary(dealIds[0]), 'deal').toMatchObject({ pipeline: 'Sales Pipeline', stage: 'Follow-Up', dealType: 'New Business', priority: 'High' });
        }).toPass({ timeout: 3 * 60_000 });
      });
    });

    test('Update a deal in HubSpot > 2: Contact has 3 deals', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
      const row = flow.rowFor('Update a deal in HubSpot > 2');
      await test.step('Select only Update a Deal: Sales Pipeline, Follow-Up, New Business, High, 0 Days', async () => {
        await flow.useOnly(saleshandyIntegration, UPDATE_DEAL, dealUpdateConfig('0'), []);
      });
      let dealIds: string[] = [];
      const before: unknown[] = [];
      await test.step('Create the contact in HubSpot with 3 deals, one after the other', async () => {
        dealIds = await contactWithDeals(flow, row, hubspotContacts, hubspotDeals);
        expect(dealIds.length, 'deals created').toBe(3);
        for (const id of dealIds.slice(0, 2)) before.push(await hubspotDeals.summary(id));
      });
      await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      test.setTimeout(25 * 60_000); // the Update a Deal log alone can take about 7.5 minutes
      await waitForSync(saleshandyIntegration, SLOW_SYNC_WAIT_MS);
      await test.step('Check HubSpot: the latest created deal is updated (AL-4103)', async () => {
        await expect(async () => {
          expect(await hubspotDeals.summary(dealIds[2]), 'latest created deal').toMatchObject({ pipeline: 'Sales Pipeline', stage: 'Follow-Up', dealType: 'New Business', priority: 'High' });
        }).toPass({ timeout: 3 * 60_000 });
      });
      await test.step('Check HubSpot: the 2 older deals are unchanged', async () => {
        for (const [i, id] of dealIds.slice(0, 2).entries()) {
          expect(await hubspotDeals.summary(id), `deal ${i + 1}`).toEqual(before[i]);
        }
      });
    });

    test('Update a deal in HubSpot > 3: Contact has 1 deal, Closing Date 51 Days', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
      const row = flow.rowFor('Update a deal in HubSpot > 3');
      await test.step('Select only Update a Deal (51 Days)', async () => {
        await flow.useOnly(saleshandyIntegration, UPDATE_DEAL, dealUpdateConfig('51'), []);
      });
      let dealIds: string[] = [];
      await test.step('Create the contact in HubSpot with 1 deal', async () => {
        dealIds = await contactWithDeals(flow, row, hubspotContacts, hubspotDeals);
      });
      await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      test.setTimeout(25 * 60_000); // the Update a Deal log alone can take about 7.5 minutes
      await waitForSync(saleshandyIntegration, SLOW_SYNC_WAIT_MS);
      await test.step('Check HubSpot: close date 51 days from today', async () => {
        await expect(async () => {
          expect((await hubspotDeals.summary(dealIds[0])).closeDate, 'Close Date').toBe(daysFromToday(51));
        }).toPass({ timeout: 3 * 60_000 });
      });
    });





    test('Create a Contact in HubSpot > 2: Contact already at a later Lifecycle Stage than the configured one', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Create a Contact in HubSpot > 2');
      await test.step('Select only Create a Contact: Lifecycle Marketing Qualified Lead', async () => {
        await flow.useOnly(saleshandyIntegration, CREATE_CONTACT, CREATE_CONTACT_VALUES, []);
      });
      await test.step('Create the contact in HubSpot and set its Lifecycle stage to Customer', async () => {
        const contactId = await newContact(hubspotContacts, row);
        await hubspotContacts.setDropdownProperty(contactId, 'Lifecycle stage', 'Customer');
      });
      await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
      await test.step('Check the contact in HubSpot stays at Customer (HubSpot blocks backward moves)', async () => {
        await expectContact(hubspotContacts, row, { 'Lifecycle stage': 'Customer' });
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
      await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
      await test.step(`Check HubSpot: task "${TASK.title}" on the contact, due ${TASK.dueDays} days from today`, async () => {
        await expectOnRecord(hubspotContacts, '0-1', contactId, [TASK.title, dueDatePattern(TASK.dueDays)], 'Task');
      });
    });

    test('Create a Task in HubSpot > 2: Contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Create a Task in HubSpot > 2');
      await test.step(`Select only Create a Task: "${TASK.title}", ${TASK.type}, ${TASK.priority}, Due in ${TASK.dueDays}`, async () => {
        await useTask(flow, saleshandyIntegration);
      });
      await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
      await test.step('Check HubSpot: contact created with the task on it', async () => {
        const contactId = await findContact(hubspotContacts, row);
        await expectOnRecord(hubspotContacts, '0-1', contactId, [TASK.title, dueDatePattern(TASK.dueDays)], 'Task');
      });
    });

    test('Create a Note in HubSpot > 3: Paired with Create a Contact, contact not in HubSpot', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Create a Note in HubSpot > 3');
      await test.step('Select Create a Contact (Open, Marketing Qualified Lead) and Create a Note', async () => {
        await usePaired(flow, saleshandyIntegration, CREATE_CONTACT, CREATE_CONTACT_VALUES, CREATE_NOTE);
      });
      await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
      await test.step('Check HubSpot: contact created, note on it with Step, Variant and Prospect Email', async () => {
        const contactId = await findContact(hubspotContacts, row);
        await expectOnRecord(hubspotContacts, '0-1', contactId, ['Note created via Saleshandy', ...flow.noteContains(row, 1)], 'Note');
      });
    });


    test('Create a Note in HubSpot > 1: Paired with Create a deal, prospect has Deal Value', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Create a Note in HubSpot > 1');
      await test.step('Select Create a Deal (Closing Date 1 Day) and Create a Note', async () => {
        await usePaired(flow, saleshandyIntegration, CREATE_DEAL, dealConfig('1'), CREATE_NOTE);
      });
      await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
      await test.step('Check HubSpot: note on both the contact and the deal', async () => {
        const contactId = await findContact(hubspotContacts, row);
        const [deal] = await newDealsOf(hubspotContacts, contactId, 1, []);
        const texts = ['Note created via Saleshandy', ...flow.noteContains(row, 1)];
        await expectOnRecord(hubspotContacts, '0-1', contactId, texts, 'Note on the contact');
        await expectOnRecord(hubspotContacts, '0-3', deal.id, texts, 'Note on the deal');
      });
    });

    test('Create a Note in HubSpot > 2: Paired with Update a deal, contact has 1 deal', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
      const row = flow.rowFor('Create a Note in HubSpot > 2');
      await test.step('Select Update a Deal (0 Days) and Create a Note', async () => {
        await usePaired(flow, saleshandyIntegration, UPDATE_DEAL, dealUpdateConfig('0'), CREATE_NOTE);
      });
      let dealIds: string[] = [];
      await test.step('Create the contact in HubSpot with 1 deal', async () => {
        dealIds = await contactWithDeals(flow, row, hubspotContacts, hubspotDeals);
      });
      await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      test.setTimeout(25 * 60_000); // the Update a Deal log alone can take about 7.5 minutes
      await waitForSync(saleshandyIntegration, SLOW_SYNC_WAIT_MS);
      // QA, 2026-10-14 (confirmed with the developer): Create a Note + Update a
      // deal puts the note on BOTH the contact and the deal.
      await test.step('Check HubSpot: note on the deal and on the contact', async () => {
        const contactId = await findContact(hubspotContacts, row);
        const texts = ['Note created via Saleshandy', ...flow.noteContains(row, 1)];
        await expectOnRecord(hubspotContacts, '0-3', dealIds[0], texts, 'Note on the deal');
        await expectOnRecord(hubspotContacts, '0-1', contactId, texts, 'Note on the contact');
      });
    });

    test('Record (log) an email activity in HubSpot > 6: Paired with Create a Contact with values set, real bounce', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      test.skip(process.env.ALLOW_REAL_BOUNCE !== '1', 'Real bounce: the plan cap of 3 is used (QA, 2026-10-14). Set ALLOW_REAL_BOUNCE=1 to send one.');
      const row = realBounceRow('Record (log) an email activity in HubSpot > 6');
      await test.step('Select Create a Contact (Open, Marketing Qualified Lead) and Record (log) an Email Activity', async () => {
        await usePaired(realFlow, saleshandyIntegration, CREATE_CONTACT, CREATE_CONTACT_VALUES, RECORD_EMAIL);
      });
      await runTrigger(realFlow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      // The CSV row is replaced by a new person before the next run.
      markUsed(CSV, flow.rowFor('Record (log) an email activity in HubSpot > 6')['Email']);
      await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
      await test.step('Check HubSpot: contact created with the values, email logged on it', async () => {
        await expectContact(hubspotContacts, row, { 'Lead status': 'Open', 'Lifecycle stage': 'Marketing Qualified Lead' });
        const contactId = await findContact(hubspotContacts, row);
        await expectOnRecord(hubspotContacts, '0-1', contactId, realFlow.loggedEmailContains(row, 1), 'Logged email');
      });
    });


    test('Record (log) an email activity in HubSpot > 4: Paired with Create a deal', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts }) => {
      const row = flow.rowFor('Record (log) an email activity in HubSpot > 4');
      await test.step('Select Create a Deal (Closing Date 1 Day) and Record (log) an Email Activity', async () => {
        await usePaired(flow, saleshandyIntegration, CREATE_DEAL, dealConfig('1'), RECORD_EMAIL);
      });
      await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      await waitForSync(saleshandyIntegration, SYNC_WAIT_MS);
      await test.step('Check HubSpot: email logged on both the deal and the contact', async () => {
        const contactId = await findContact(hubspotContacts, row);
        const [deal] = await newDealsOf(hubspotContacts, contactId, 1, []);
        await expectOnRecord(hubspotContacts, '0-1', contactId, flow.loggedEmailContains(row, 1), 'Logged email on the contact');
        await expectOnRecord(hubspotContacts, '0-3', deal.id, flow.loggedEmailContains(row, 1), 'Logged email on the deal');
      });
    });

    test('Record (log) an email activity in HubSpot > 5: Paired with Update a deal, contact has 3 deals', async ({ saleshandyIntegration, saleshandySequence, saleshandyCrm, mailinator, hubspotContacts, hubspotDeals }) => {
      const row = flow.rowFor('Record (log) an email activity in HubSpot > 5');
      await test.step('Select Update a Deal (0 Days) and Record (log) an Email Activity', async () => {
        await usePaired(flow, saleshandyIntegration, UPDATE_DEAL, dealUpdateConfig('0'), RECORD_EMAIL);
      });
      let dealIds: string[] = [];
      await test.step('Create the contact in HubSpot with 3 deals, one after the other', async () => {
        dealIds = await contactWithDeals(flow, row, hubspotContacts, hubspotDeals);
        expect(dealIds.length, 'deals created').toBe(3);
      });
      await runTrigger(flow, { sequence: saleshandySequence, mailinator, crm: saleshandyCrm, integration: saleshandyIntegration }, row);
      test.setTimeout(25 * 60_000); // the Update a Deal log alone can take about 7.5 minutes
      await waitForSync(saleshandyIntegration, SLOW_SYNC_WAIT_MS);
      await test.step('Check HubSpot: the latest created deal is updated (AL-4103)', async () => {
        await expect(async () => {
          expect(await hubspotDeals.summary(dealIds[2]), 'latest created deal').toMatchObject({ pipeline: 'Sales Pipeline', stage: 'Follow-Up', dealType: 'New Business', priority: 'High' });
        }).toPass({ timeout: 3 * 60_000 });
      });
      // QA, 2026-10-15: Update a deal + Record email logs the email on both the
      // latest deal and the contact (was "deal only" on 2026-10-13), in every
      // workflow. The card on the deal must name the prospect, not "Unknown
      // Contact" (AL-4123, AL-4129).
      await test.step('Check HubSpot: email logged on the latest deal naming the prospect, and on the contact', async () => {
        const contactId = await findContact(hubspotContacts, row);
        await expectOnRecord(hubspotContacts, '0-3', dealIds[2], flow.loggedEmailContains(row, 1), 'Logged email on the deal');
        await expectOnRecord(hubspotContacts, '0-1', contactId, flow.loggedEmailContains(row, 1), 'Logged email on the contact');
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


// ---- Email Bounced wiring ----

test.use({ account: 'emailbounced' });

// Update a Deal with the Stage two positions after Prospecting.
const dealUpdateConfig = (closingDays: string) => ({
  ...sharedDealUpdateConfig(closingDays),
  'Select Pipeline Stage (when to update)': 'Follow-Up',
});

// Name on Triggers & Activity and in Logs (seen 2026-10-12).
const TRIGGER = 'Email is Bounced in Saleshandy';
// Sequence "HubSpot Email Bounced QA" on the emailbounced account.
const SEQUENCE_ID = '196432';
const CSV = 'hubspot/email-bounced-phase2.csv';

// Manual bounce on the step 1 email. The sequence is Active, so Saleshandy has
// sent it by itself (no Send now); a step 2 row can be marked without sending.
const flow = createFlow({
  trigger: TRIGGER,
  sequenceId: SEQUENCE_ID,
  csv: CSV,
  fireEvent: async ({ sequence }, row, step) => {
    await test.step(`Mark the step ${step} email as bounced`, async () => {
      await sequence.markAsBounced(SEQUENCE_ID, fullName(row), step);
    });
  },
});

// Record (log) 6: the bounce comes from the real send. Plain @mailinator.com
// never bounces, @<company>.mailinator.com does, so the address is built here
// (the CSV keeps the plain one).
const realBounceRow = (scenario: string): Row => {
  const row = flow.rowFor(scenario);
  const company = row['Company'].normalize('NFKD').replace(/[^A-Za-z]/g, '').toLowerCase();
  return { ...row, Email: row['Email'].replace(/@mailinator\.com$/i, `@${company}.mailinator.com`) };
};
const realFlow = createFlow({
  trigger: TRIGGER,
  sequenceId: SEQUENCE_ID,
  csv: CSV,
  fireEvent: async ({ sequence }, row) => {
    await test.step('Wait for Saleshandy to show the email as Bounced (real bounce, no Mark as bounced)', async () => {
      await sequence.waitUntilBounced(SEQUENCE_ID, fullName(row));
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
    markUsed(CSV, row['Email']);
  });
  if (beforeSend) await beforeSend();
  // QA 2026-10-14: use Send now, so a step 1 left "Scheduled, Tomorrow" (sender
  // at its daily cap or outside the schedule) does not stop the run. Send now
  // does nothing when the row already says "Sent". The row can take a moment to
  // show after the prospect is added, so it is retried.
  await test.step('Send step 1 with Send now (skipped if already Sent)', async () => {
    await expect(async () => {
      await ctx.sequence.sendNow(SEQUENCE_ID, fullName(row), 1);
    }, `Step 1 email to ${fullName(row)} could not be sent with Send now within 3 minutes`).toPass({ timeout: 3 * 60_000, intervals: [10_000] });
  });
  await f.fireEvent(ctx, row, 1);
}

activityTests(flow, 'Email is Bounced in Saleshandy, Phase 2');
