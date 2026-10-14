// Scenarios: test-cases/hubspot/contact-updated.md (Regression).
// Data: test-data/hubspot/saleshandy-3-random-contacts.csv, values used as they are.
// Each run takes the next 2 unused contacts (test-data/hubspot/*.used.txt lists
// the ones already created). Both go through rows 1 and 2; rows 3 and 4 use the first.
// Rows 1 and 2 act on every contact first, then wait for Logs once (the Refold
// delay is paid once, not once per contact).
import { expect, test } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed, unusedRows } from '../../src/data/used.ts';
import type { HubSpotIntegrationPage } from '../../src/pages/saleshandy/hubspot-integration.page.ts';
import type { SaleshandyCrmPage } from '../../src/pages/saleshandy/crm.page.ts';
import { staysTrue, stopOnErrorLogs, untilPasses } from '../../src/utils/wait.ts';

test.use({ account: 'contactupdated' });

const TRIGGER = 'Contact Updated in Hubspot'; // name on Triggers & Activity and in Logs
const CSV = 'hubspot/saleshandy-3-random-contacts.csv';
const contacts = unusedRows(CSV, readCsv(CSV), 2);
const first = contacts[0];
const fullName = (c: Row) => `${c['First Name']} ${c['Last Name']}`;

// HubSpot record id per email, filled by row 1 and used by later rows.
const contactIds = new Map<string, string>();

async function knownLogIds(integration: HubSpotIntegrationPage): Promise<Set<string>> {
  await integration.openLogs();
  return new Set((await integration.logEntries(TRIGGER)).map((e) => e.id));
}

// `count`: how many new entries to wait for (one per contact acted on).
async function expectNewLogsSuccess(integration: HubSpotIntegrationPage, known: Set<string>, count = 1): Promise<void> {
  await untilPasses(`New "${TRIGGER}" log entries did not all reach Success`, async () => {
    await integration.refreshLogs();
    const fresh = (await integration.logEntries(TRIGGER)).filter((e) => !known.has(e.id));
    expect(fresh.length, `new log entries for this trigger (at least ${count})`).toBeGreaterThanOrEqual(count);
    stopOnErrorLogs(TRIGGER, fresh);
    expect(fresh.map((e) => e.status), 'status of each new log entry').toEqual(fresh.map(() => 'Success'));
  });
}

async function expectProspect(crm: SaleshandyCrmPage, contact: Row, fields: Record<string, string>): Promise<void> {
  await untilPasses(`Prospect ${contact.Email} did not show the expected values`, async () => {
    expect(await crm.search(contact.Email), 'prospects with this email').toBe(1);
    await crm.openProspect(fullName(contact));
    for (const [label, value] of Object.entries(fields)) {
      await expect(crm.field(label), label).toHaveText(value);
    }
  });
}

test.describe('Contact Updated in HubSpot', () => {
  test.describe.configure({ mode: 'serial' });

  test('Trigger behavior (baseline) > 1: Trigger off before the test', async ({ saleshandyIntegration }) => {
    await test.step(`Turn other triggers off and turn on "${TRIGGER}"`, async () => {
      await saleshandyIntegration.openTriggers();
      await saleshandyIntegration.enableOnly(TRIGGER);
    });
    await test.step('Save the Triggers & Activity page', async () => {
      await saleshandyIntegration.save();
      await expect(saleshandyIntegration.savedToast(), 'save confirmation').toBeVisible();
    });
  });

  test(`Trigger only (no activities) > 1: Contact not in Saleshandy (${contacts.map(fullName).join(', ')})`, async ({
    hubspotContacts,
    saleshandyIntegration,
    saleshandyCrm,
  }) => {
    const known = await test.step('Note the existing log entries', () => knownLogIds(saleshandyIntegration));
    for (const contact of contacts) {
      await test.step(`Create the contact in HubSpot (${fullName(contact)})`, async () => {
        const id = await hubspotContacts.createContact({
          email: contact.Email,
          firstName: contact['First Name'],
          lastName: contact['Last Name'],
          jobTitle: contact['Job Title'],
        });
        contactIds.set(contact.Email, id);
        markUsed(CSV, contact.Email);
      });
    }
    await test.step('Wait for Success in Saleshandy Logs for every contact', () =>
      expectNewLogsSuccess(saleshandyIntegration, known, contacts.length),
    );
    for (const contact of contacts) {
      await test.step(`Find the new prospect in Saleshandy with the mapped fields (${fullName(contact)})`, () =>
        expectProspect(saleshandyCrm, contact, { 'Job Title': contact['Job Title'] }),
      );
    }
  });

  test(`Trigger only (no activities) > 2: Contact already a prospect (${contacts.map(fullName).join(', ')})`, async ({
    hubspotContacts,
    saleshandyIntegration,
    saleshandyCrm,
  }) => {
    const updatedFor = (contact: Row) => ({
      City: contact.City,
      Company: contact.Company,
      'Job Title': `${contact['Job Title']} (updated)`,
    });
    const known = await test.step('Note the existing log entries', () => knownLogIds(saleshandyIntegration));
    for (const contact of contacts) {
      const updated = updatedFor(contact);
      await test.step(`Update City, Company name and Job title in HubSpot (${fullName(contact)})`, () =>
        hubspotContacts.updateProperties(contactIds.get(contact.Email)!, {
          City: updated.City,
          'Company name': updated.Company,
          'Job title': updated['Job Title'],
        }),
      );
    }
    await test.step('Wait for Success in Saleshandy Logs for every contact', () =>
      expectNewLogsSuccess(saleshandyIntegration, known, contacts.length),
    );
    for (const contact of contacts) {
      await test.step(`Check the prospect shows the new values and is not duplicated (${fullName(contact)})`, () =>
        expectProspect(saleshandyCrm, contact, updatedFor(contact)),
      );
    }
  });

  test(`Trigger only (no activities) > 3: Same contact, updated again (${fullName(first)})`, async ({
    hubspotContacts,
    saleshandyIntegration,
    saleshandyCrm,
  }) => {
    const known = await test.step('Note the existing log entries', () => knownLogIds(saleshandyIntegration));
    await test.step('Update City again in HubSpot', () =>
      hubspotContacts.updateProperties(contactIds.get(first.Email)!, { City: `${first.City} 2` }),
    );
    await test.step('Wait for Success in Saleshandy Logs', () => expectNewLogsSuccess(saleshandyIntegration, known));
    await test.step('Check the prospect shows the latest City', () =>
      expectProspect(saleshandyCrm, first, { City: `${first.City} 2` }),
    );
  });

  // Runs last and leaves the trigger disabled (QA decision).
  test(`Trigger only (no activities) > 4: Trigger disabled (${fullName(first)})`, async ({
    hubspotContacts,
    saleshandyIntegration,
    saleshandyCrm,
  }) => {
    await test.step(`Turn off "${TRIGGER}" and save`, async () => {
      await saleshandyIntegration.openTriggers();
      await saleshandyIntegration.disable(TRIGGER);
      await saleshandyIntegration.save();
      await expect(saleshandyIntegration.savedToast(), 'save confirmation').toBeVisible();
    });
    const known = await test.step('Note the existing log entries', () => knownLogIds(saleshandyIntegration));
    await test.step('Update City in HubSpot', () =>
      hubspotContacts.updateProperties(contactIds.get(first.Email)!, { City: `${first.City} 3` }),
    );
    await test.step('Check no new log entry appears', () =>
      staysTrue(saleshandyIntegration.page, async () => {
        await saleshandyIntegration.refreshLogs();
        const fresh = (await saleshandyIntegration.logEntries(TRIGGER)).filter((e) => !known.has(e.id));
        expect(fresh, 'new log entries while the trigger is off').toEqual([]);
      }),
    );
    await test.step('Check the prospect is unchanged', () =>
      expectProspect(saleshandyCrm, first, { City: `${first.City} 2` }),
    );
  });
});
