// Scenarios: test-cases/hubspot/company-created.md (Regression, Created path only).
// Data: test-data/hubspot/company-created.csv (contacts C1 to C6, used rows are
// replaced before every run by src/data/global-setup.ts) and
// company-created-companies.csv (one company per scenario, contacts by label).
// Slice 1 (2026-10-14): trigger setup and Add Prospect. The other
// activities are added one at a time after a run shows how the trigger behaves.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import type { HubSpotIntegrationPage } from '../../src/pages/saleshandy/hubspot-integration.page.ts';
import type { SaleshandyCrmPage } from '../../src/pages/saleshandy/crm.page.ts';
import { staysTrue, stopOnErrorLogs, untilPasses } from '../../src/utils/wait.ts';

test.use({ account: 'companycreated' });

// Name on Triggers & Activity and in Logs (walked 2026-10-09).
const TRIGGER = 'Company Created/Properties Updated in Hubspot';
const ADD_PROSPECT = 'Add Prospect in Saleshandy';
// UI label (Triggers & Activity) and the scenarios file's name for the same
// activity differ in letter case (walked 2026-10-15).
const MOVE_PROSPECT = 'Move Prospect to another Sequence in Saleshandy';
const MOVE_ROW = 'Move Prospect to Another sequence in Saleshandy';

const contactRows = readCsv('hubspot/company-created.csv');
const companyRows = readCsv('hubspot/company-created-companies.csv');
const contact = (label: string): Row => {
  const row = contactRows.find((r) => r['Scenario'] === label);
  if (!row) throw new Error(`No contact "${label}" in test-data/hubspot/company-created.csv`);
  return row;
};
const company = (scenario: string): Row & { labels: string[] } => {
  const row = companyRows.find((r) => r['Scenario'] === scenario);
  if (!row) throw new Error(`No company for "${scenario}" in test-data/hubspot/company-created-companies.csv`);
  return Object.assign(row, { labels: row['Contacts'].split(/\s+/).filter(Boolean) });
};
// A company with the exact same domain already in HubSpot (every earlier run
// created one from the same CSV row, and a refresh can draw the same
// employer again) turns the create form into "Create a new company" and
// disables its Contact field (walked 2026-10-15). So the first label of the
// domain gets a per-run stamp; the domain is not asserted anywhere.
const runStamp = Date.now().toString(36);
const runDomain = (domain: string): string => domain.replace(/^([^.]+)/, `$1-${runStamp}`);
const fullName = (c: Row) => `${c['First Name']} ${c['Last Name']}`;

// Contacts are created in HubSpot once, just before the first row that uses
// them, and reused by later rows (chain, test-cases file).
// A failed test restarts the worker and wipes module state, so the list is
// kept in a file named after the runner's PID (the worker's parent): rows
// after a failure must not create the same contact again (Create is disabled
// for an existing email; seen 2026-10-15, Replied 2 after Replied 1 failed).
const createdFile = path.join(os.tmpdir(), `company-created-created-${process.ppid}.txt`);
const created = {
  // CREATED_LABELS="C1,C2" marks contacts left in HubSpot by an earlier run, so a
  // rerun of later rows (KEEP_TEST_DATA=1) does not create them again.
  has: (label: string): boolean =>
    (process.env.CREATED_LABELS ?? '').split(',').includes(label) ||
    (fs.existsSync(createdFile) && fs.readFileSync(createdFile, 'utf8').split('\n').includes(label)),
  add: (label: string): void => fs.appendFileSync(createdFile, `${label}\n`),
};

async function knownLogIds(integration: HubSpotIntegrationPage): Promise<Set<string>> {
  await integration.openLogs();
  return new Set((await integration.logEntries(TRIGGER)).map((e) => e.id));
}

async function expectNewLogSuccess(integration: HubSpotIntegrationPage, known: Set<string>): Promise<void> {
  await untilPasses(`New "${TRIGGER}" log entry did not reach Success`, async () => {
    await integration.refreshLogs();
    const fresh = (await integration.logEntries(TRIGGER)).filter((e) => !known.has(e.id));
    expect(fresh.length, 'new log entries for this trigger').toBeGreaterThanOrEqual(1);
    stopOnErrorLogs(TRIGGER, fresh);
    expect(fresh.map((e) => e.status), 'status of each new log entry').toEqual(fresh.map(() => 'Success'));
  });
}

async function expectProspectCount(crm: SaleshandyCrmPage, c: Row, count: number): Promise<void> {
  await untilPasses(`Prospect ${c['Email']} did not show ${count} match(es) in Prospects`, async () => {
    expect(await crm.search(c['Email']), `prospects with ${c['Email']}`).toBe(count);
  });
}

test.describe('Company Created/Properties Updated in HubSpot', () => {
  // Not serial: a product Error on one row must not hide the rows behind it.
  // Order is the file order, one worker. A company with no contact is not a
  // valid scenario (QA, 2026-10-15), so there is no baseline row.

  test('Setup: only the Company Created trigger is on, activity Add Prospect', async ({ saleshandyIntegration }) => {
    await test.step('Turn the other triggers off and turn on the Company trigger', async () => {
      await saleshandyIntegration.openTriggers();
      await saleshandyIntegration.enable(TRIGGER);
    });
    await test.step(`Select "${ADD_PROSPECT}" only and save`, async () => {
      // Activities add up: one left from an earlier row (e.g. Move) would run too.
      for (const chip of await saleshandyIntegration.selectedActivities(TRIGGER)) {
        if (!chip.includes(ADD_PROSPECT)) await saleshandyIntegration.removeActivity(TRIGGER, chip);
      }
      if (!(await saleshandyIntegration.selectedActivities(TRIGGER)).some((a) => a.includes(ADD_PROSPECT))) {
        await saleshandyIntegration.selectActivity(TRIGGER, ADD_PROSPECT);
      }
      await saleshandyIntegration.save();
      await expect(saleshandyIntegration.savedToast(), 'save confirmation').toBeVisible();
    });
  });

  for (const n of [1, 2, 3]) {
    const scenario = `${ADD_PROSPECT} > ${n}`;
    test(`${scenario}: company created with ${company(scenario).labels.join(', ')}`, async ({
      hubspotContacts,
      hubspotCompanies,
      saleshandyIntegration,
      saleshandyCrm,
    }) => {
      const row = company(scenario);
      const people = row.labels.map(contact);
      for (const person of people) {
        if (created.has(person['Scenario'])) continue;
        await test.step(`Create the contact in HubSpot (${person['Scenario']}, ${fullName(person)})`, async () => {
          await hubspotContacts.createContact({
            email: person['Email'],
            firstName: person['First Name'],
            lastName: person['Last Name'],
            jobTitle: person['Job Title'],
          });
          created.add(person['Scenario']);
        });
      }
      const known = await test.step('Note the existing log entries', () => knownLogIds(saleshandyIntegration));
      await test.step(`Create the company in HubSpot with ${people.length} contact(s) selected in the form (${row['Company Name']})`, () =>
        hubspotCompanies.createCompany({
          domain: runDomain(row['Company Domain']),
          name: row['Company Name'],
          contacts: people.map((p) => ({ email: p['Email'], firstName: p['First Name'], lastName: p['Last Name'] })),
        }),
      );
      await test.step('Wait for Success in Saleshandy Logs', () => expectNewLogSuccess(saleshandyIntegration, known));
      for (const person of people) {
        await test.step(`Check ${fullName(person)} is one prospect in Saleshandy`, () =>
          expectProspectCount(saleshandyCrm, person, 1),
        );
      }
    });
  }
  // Needs C1 to be a prospect in no sequence, which the "Add Prospect > 1" row
  // before it makes: run both rows together, in file order.
  test(`${MOVE_ROW} > 1: company created with ${company(`${MOVE_ROW} > 1`).labels.join(', ')}`, async ({
    hubspotContacts,
    hubspotCompanies,
    saleshandyIntegration,
    saleshandyCrm,
  }) => {
    const row = company(`${MOVE_ROW} > 1`);
    const people = row.labels.map(contact);
    await test.step('Turn on only the Company trigger with the Move activity (Sequence A, Step 1)', async () => {
      await saleshandyIntegration.openTriggers();
      await saleshandyIntegration.enable(TRIGGER);
      // Selecting a second activity adds it next to the first one, so Add
      // Prospect is removed to keep this row to the Move activity alone.
      if ((await saleshandyIntegration.selectedActivities(TRIGGER)).some((a) => a.includes(ADD_PROSPECT))) {
        await saleshandyIntegration.removeActivity(TRIGGER, ADD_PROSPECT);
      }
      // Picking an activity that is already selected opens no dialog (seen
      // 2026-10-15), so its Extra Configuration is reopened with the edit icon.
      if ((await saleshandyIntegration.selectedActivities(TRIGGER)).some((a) => a.includes(MOVE_PROSPECT))) {
        await saleshandyIntegration.reopenExtraConfiguration(TRIGGER, MOVE_PROSPECT);
      } else {
        await saleshandyIntegration.selectActivity(TRIGGER, MOVE_PROSPECT);
      }
      await saleshandyIntegration.chooseConfigOption('Sequence', 'Sequence A');
      await saleshandyIntegration.chooseConfigOption('Sequence Steps', 'Step 1 - Day 1');
      await saleshandyIntegration.configSaveButton().click();
      await saleshandyIntegration.save();
      // Two toasts show: one for the Extra Configuration Save (which already
      // stores the activity) and one for the page Save (seen 2026-10-15).
      await expect(saleshandyIntegration.savedToast().first(), 'save confirmation').toBeVisible();
    });
    for (const person of people) {
      if (created.has(person['Scenario'])) continue;
      await test.step(`Create the contact in HubSpot (${person['Scenario']}, ${fullName(person)})`, async () => {
        await hubspotContacts.createContact({
          email: person['Email'],
          firstName: person['First Name'],
          lastName: person['Last Name'],
          jobTitle: person['Job Title'],
        });
        created.add(person['Scenario']);
      });
    }
    const known = await test.step('Note the existing log entries', () => knownLogIds(saleshandyIntegration));
    await test.step(`Create the company in HubSpot with ${people.length} contact(s) selected in the form (${row['Company Name']})`, () =>
      hubspotCompanies.createCompany({
        domain: runDomain(row['Company Domain']),
        name: row['Company Name'],
        contacts: people.map((p) => ({ email: p['Email'], firstName: p['First Name'], lastName: p['Last Name'] })),
      }),
    );
    await test.step('Wait for Success in Saleshandy Logs', () => expectNewLogSuccess(saleshandyIntegration, known));
    for (const person of people) {
      await test.step(`Check ${fullName(person)} is in Sequence A in Saleshandy`, () =>
        untilPasses(`Prospect ${person['Email']} is not in Sequence A`, async () => {
          await saleshandyCrm.search(person['Email']);
          expect(await saleshandyCrm.sequenceAssociated(person['Email']), `sequence of ${person['Email']}`).toBe('Sequence A');
        }),
      );
    }
  });
// ---- Rows after Move 1: one helper builds each row (chain order of the scenarios file) ----

type Config = (integration: HubSpotIntegrationPage) => Promise<void>;
const SEQ_A = 'Sequence A';
const SEQ_B = 'Sequence B';
const TAG = 'TagA'; // tags cannot have spaces; created in the first Assign a tag row
// Pause Delay in Days is not given by QA; 1 is used and recorded (2026-10-15).
const PAUSE_DAYS = '1';
const activity = {
  tag: 'Assign a tag to Prospect in Saleshandy',
  paused: 'Mark Prospect as Paused in Saleshandy',
  resume: 'Mark Prospect as Resume(Un-pause) in Saleshandy',
  replied: 'Mark Prospect as Replied in Saleshandy',
  finished: 'Mark Prospect as Finished in Saleshandy',
  unsubscribed: 'Mark Prospect as Unsubscribed in Saleshandy',
  blacklist: 'Blacklist a Domain in Saleshandy',
};

// Trigger on, only `name` selected (activities add up, so others are removed),
// its Extra Configuration set, saved.
async function useActivity(integration: HubSpotIntegrationPage, name: string, config?: Config): Promise<void> {
  await integration.openTriggers();
  await integration.enable(TRIGGER);
  for (const chip of await integration.selectedActivities(TRIGGER)) {
    if (!chip.includes(name)) await integration.removeActivity(TRIGGER, chip);
  }
  const selected = (await integration.selectedActivities(TRIGGER)).some((a) => a.includes(name));
  if (!selected) await integration.selectActivity(TRIGGER, name);
  else if (config) await integration.reopenExtraConfiguration(TRIGGER, name);
  if (config) {
    await config(integration);
    await integration.configSaveButton().click();
  }
  await integration.save();
  await expect(integration.savedToast().first(), 'save confirmation').toBeVisible();
}

const sequence = (name: string, step = false): Config => async (i) => {
  await i.chooseConfigOption('Sequence', name);
  if (step) await i.chooseConfigOption('Sequence Steps', 'Step 1 - Day 1');
};

type RowOptions = {
  key: string;
  activity: string;
  config?: Config;
  // The state each prospect must be in after Success. "unchanged" rows compare
  // against the Latest Status and Sequence read before the company is created.
  expected: 'unchanged' | { status?: string; notStatus?: string; sequence?: string; tag?: string };
  // An entry the activity leaves on the Do Not Contact list; removed at the end.
  removeFromDoNotContact?: string;
};

function activityRow(o: RowOptions): void {
  const labels = company(o.key).labels;
  test(`${o.key}: company created with ${labels.join(', ')}`, async ({
    hubspotContacts,
    hubspotCompanies,
    saleshandyIntegration,
    saleshandyCrm,
    saleshandyDnc,
  }) => {
    const row = company(o.key);
    const people = row.labels.map(contact);
    await test.step(`Turn on only the Company trigger with "${o.activity}"`, () => useActivity(saleshandyIntegration, o.activity, o.config));
    for (const person of people) {
      if (created.has(person['Scenario'])) continue;
      await test.step(`Create the contact in HubSpot (${person['Scenario']}, ${fullName(person)})`, async () => {
        await hubspotContacts.createContact({
          email: person['Email'],
          firstName: person['First Name'],
          lastName: person['Last Name'],
          jobTitle: person['Job Title'],
        });
        created.add(person['Scenario']);
      });
    }
    const snapshot = async (person: Row) => {
      await saleshandyCrm.search(person['Email']);
      return `${await saleshandyCrm.latestStatus(person['Email'])} / ${await saleshandyCrm.sequenceAssociated(person['Email'])}`;
    };
    const before = new Map<string, string>();
    if (o.expected === 'unchanged') {
      for (const person of people) {
        await test.step(`Note ${fullName(person)}'s status and sequence`, async () => {
          before.set(person['Email'], await snapshot(person));
        });
      }
    }
    const known = await test.step('Note the existing log entries', () => knownLogIds(saleshandyIntegration));
    await test.step(`Create the company in HubSpot with ${people.length} contact(s) selected in the form (${row['Company Name']})`, () =>
      hubspotCompanies.createCompany({
        domain: runDomain(row['Company Domain']),
        name: row['Company Name'],
        contacts: people.map((p) => ({ email: p['Email'], firstName: p['First Name'], lastName: p['Last Name'] })),
      }),
    );
    await test.step('Wait for Success in Saleshandy Logs', () => expectNewLogSuccess(saleshandyIntegration, known));
    for (const person of people) {
      const email = person['Email'];
      if (o.expected === 'unchanged') {
        await test.step(`Check ${fullName(person)} did not change in Saleshandy`, () =>
          staysTrue(saleshandyCrm.page, async () => {
            expect(await snapshot(person), `status / sequence of ${email}`).toBe(before.get(email));
          }),
        );
        continue;
      }
      const want = o.expected;
      await test.step(`Check ${fullName(person)} in Saleshandy`, () =>
        untilPasses(`Prospect ${email} did not reach the expected state`, async () => {
          await saleshandyCrm.search(email);
          if (want.status) expect(await saleshandyCrm.latestStatus(email), `Latest Status of ${email}`).toBe(want.status);
          if (want.notStatus) expect(await saleshandyCrm.latestStatus(email), `Latest Status of ${email}`).not.toBe(want.notStatus);
          if (want.sequence) expect(await saleshandyCrm.sequenceAssociated(email), `Sequence of ${email}`).toBe(want.sequence);
          if (want.tag) expect(await saleshandyCrm.prospectTags(email), `Tags of ${email}`).toContain(want.tag);
        }),
      );
    }
    if (o.removeFromDoNotContact) {
      await test.step(`Remove ${o.removeFromDoNotContact} from the Do Not Contact list`, () =>
        saleshandyDnc.removeEntry(o.removeFromDoNotContact!));
    }
  });
}

activityRow({ key: `${MOVE_ROW} > 2`, activity: MOVE_PROSPECT, config: sequence(SEQ_A, true), expected: { sequence: SEQ_A } });
activityRow({ key: `${MOVE_ROW} > 3`, activity: MOVE_PROSPECT, config: sequence(SEQ_A, true), expected: { sequence: SEQ_A } });

const tagConfig: Config = async (i) => i.createAndSelectTag(TAG);
activityRow({ key: 'Assign a tag to Prospect in Saleshandy > 1', activity: activity.tag, config: tagConfig, expected: { tag: TAG } });
activityRow({ key: 'Assign a tag to Prospect in Saleshandy > 2', activity: activity.tag, config: tagConfig, expected: { tag: TAG } });

const paused = (seq: string): Config => async (i) => {
  await i.chooseConfigOption('Sequence', seq);
  await i.dueIn().fill(PAUSE_DAYS);
};
activityRow({ key: 'Mark Prospect as Paused in Saleshandy > 1', activity: activity.paused, config: paused(SEQ_A), expected: { status: 'Paused' } });
activityRow({ key: 'Mark Prospect as Paused in Saleshandy > 2', activity: activity.paused, config: paused(SEQ_A), expected: { status: 'Paused' } });
activityRow({ key: 'Mark Prospect as Paused in Saleshandy > 3', activity: activity.paused, config: paused(SEQ_B), expected: 'unchanged' });

activityRow({ key: 'Mark prospect as Resume (Un-pause) in Saleshandy > 1', activity: activity.resume, config: sequence(SEQ_A), expected: { notStatus: 'Paused' } });
activityRow({ key: 'Mark prospect as Resume (Un-pause) in Saleshandy > 2', activity: activity.resume, config: sequence(SEQ_A), expected: { notStatus: 'Paused' } });

// QA, 2026-10-15: with "Stop sending follow-ups" on a reply, a Replied prospect
// ends as Finished.
activityRow({ key: 'Mark prospect as Replied in Saleshandy > 1', activity: activity.replied, config: sequence(SEQ_A), expected: { status: 'Finished' } });
activityRow({ key: 'Mark prospect as Replied in Saleshandy > 2', activity: activity.replied, config: sequence(SEQ_B), expected: 'unchanged' });

activityRow({ key: 'Mark prospect as Finished in Saleshandy > 1', activity: activity.finished, config: sequence(SEQ_A), expected: { status: 'Finished' } });
activityRow({ key: 'Mark prospect as Finished in Saleshandy > 2', activity: activity.finished, config: sequence(SEQ_B), expected: 'unchanged' });

activityRow({ key: 'Mark Prospect as unsubscribed in Saleshandy > 1', activity: activity.unsubscribed, expected: { status: 'Unsubscribed' } });

// Blacklist a domain: C4's domain (mailinator.com) goes on the Do Not Contact
// list (Settings > Do Not Contact List, /settings/dnc-list, "Global Do Not
// Contact List"). The prospect's Latest Status must become Blacklisted.
// The row removes mailinator.com from the list at the end (QA, 2026-10-09), so
// later runs can add prospects on that domain again.
activityRow({ key: 'Blacklist a domain in Saleshandy > 1', activity: activity.blacklist, expected: { status: 'Blacklisted' }, removeFromDoNotContact: 'mailinator.com' });
});
