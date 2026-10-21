// Production smoke test: Company Created/Properties Updated in HubSpot.
// Checklist: notes/production-testing/04-company-created.md (one test per check,
// same order, numbered 00 to 08). Data: test-data/hubspot/company-created-smoke.csv
// (contacts C1 to C4) and company-created-smoke-companies.csv (one company per
// check, contacts by label). Reuses the staging spec's steps and page objects
// (tests/hubspot/company-created.spec.ts).
//
// Differences from staging:
//  - account `emailopenedprod` points at production (src/config/environments.ts);
//  - no wait on the Logs entry (QA, 2026-10-15): each check reads the prospect
//    in Saleshandy directly, polled for up to 10 minutes;
//  - the sequence is "HubSpot Company Created Smoke", made by
//    tests/setup/company-created-smoke-sequence.spec.ts (SETUP_SMOKE_SEQUENCE=1);
//    SMOKE_SEQUENCE_NAME overrides the name;
//  - Blacklist a domain removes mailinator.com from the Global Do Not Contact
//    list at the end (the account is shared; QA, 2026-10-15).
//
// Needs, before a run (QA, once):
//   the production sequence above (setup spec), with "Stop sending follow-ups
//   when a reply is received" on (the account default is not confirmed)
//   npm run login:saleshandy -- emailopenedprod, and npm run login:hubspot
//   field mapping saved on the production account
// Never at the same time as another smoke run (same account).
// Run: TEST_DATA_ONLY=hubspot/company-created-smoke \
//        npx playwright test tests/hubspot/company-created-smoke.spec.ts --project=chromium --workers=1
// Rerun of failed checks only: KEEP_TEST_DATA=1 CREATED_LABELS=C1,C2 ... -g "<check>"
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import type { HubSpotIntegrationPage } from '../../src/pages/saleshandy/hubspot-integration.page.ts';
import type { SaleshandyCrmPage } from '../../src/pages/saleshandy/crm.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';

test.use({ account: 'emailopenedprod' });

const TRIGGER = 'Company Created/Properties Updated in Hubspot';
const SEQ_A = process.env.SMOKE_SEQUENCE_NAME ?? 'HubSpot Company Created Smoke';
const TAG = 'TagA'; // tags cannot have spaces
const PAUSE_DAYS = '1';
const LOG_TIMEOUT_MS = 10 * 60_000;
const TEST_TIMEOUT_MS = 25 * 60_000;

const activity = {
  add: 'Add Prospect in Saleshandy',
  move: 'Move Prospect to another Sequence in Saleshandy',
  tag: 'Assign a tag to Prospect in Saleshandy',
  paused: 'Mark Prospect as Paused in Saleshandy',
  resume: 'Mark Prospect as Resume(Un-pause) in Saleshandy',
  replied: 'Mark Prospect as Replied in Saleshandy',
  finished: 'Mark Prospect as Finished in Saleshandy',
  unsubscribed: 'Mark Prospect as Unsubscribed in Saleshandy',
  blacklist: 'Blacklist a Domain in Saleshandy',
};

const contactRows = readCsv('hubspot/company-created-smoke.csv');
const companyRows = readCsv('hubspot/company-created-smoke-companies.csv');
const contact = (label: string): Row => {
  const row = contactRows.find((r) => r['Scenario'] === label);
  if (!row) throw new Error(`No contact "${label}" in test-data/hubspot/company-created-smoke.csv`);
  return row;
};
const company = (scenario: string): Row & { labels: string[] } => {
  const row = companyRows.find((r) => r['Scenario'] === scenario);
  if (!row) throw new Error(`No company for "${scenario}" in test-data/hubspot/company-created-smoke-companies.csv`);
  return Object.assign(row, { labels: row['Contacts'].split(/\s+/).filter(Boolean) });
};
const fullName = (c: Row) => `${c['First Name']} ${c['Last Name']}`;

// A company with the exact same domain already in HubSpot disables the create
// form's Contact field (walked 2026-10-15), so the domain gets a per-run stamp.
const runStamp = Date.now().toString(36);
const runDomain = (domain: string): string => domain.replace(/^([^.]+)/, `$1-${runStamp}`);

// Contacts are created once, just before the first check that uses them. A
// failed test restarts the worker, so the list is kept in a file named after
// the runner's PID. CREATED_LABELS="C1,C2" marks contacts left by an earlier run.
const createdFile = path.join(os.tmpdir(), `company-created-smoke-created-${process.ppid}.txt`);
const created = {
  has: (label: string): boolean =>
    (process.env.CREATED_LABELS ?? '').split(',').includes(label) ||
    (fs.existsSync(createdFile) && fs.readFileSync(createdFile, 'utf8').split('\n').includes(label)),
  add: (label: string): void => fs.appendFileSync(createdFile, `${label}\n`),
};

type Config = (integration: HubSpotIntegrationPage) => Promise<void>;

// Trigger on, only `name` selected (activities add up, so others are removed),
// its Extra Configuration set, saved.
async function useActivity(integration: HubSpotIntegrationPage, name: string, config?: Config): Promise<void> {
  await integration.openTriggers();
  // Other workflows' triggers are left as they are (QA, 2026-10-15): the
  // account is shared with other smoke runs.
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
const tagConfig: Config = async (i) => i.createAndSelectTag(TAG);
const paused: Config = async (i) => {
  await i.chooseConfigOption('Sequence', SEQ_A);
  await i.dueIn().fill(PAUSE_DAYS);
};

type Check = {
  id: string; // 00 to 08, as in the checklist
  title: string;
  key: string; // scenario in company-created-smoke-companies.csv
  activity: string;
  config?: Config;
  expected: { status?: string; notStatus?: string; sequence?: string; tag?: string; exists?: boolean };
  removeFromDoNotContact?: string;
};

function smoke(c: Check): void {
  const row = company(`${c.key} > 1`);
  test(`${c.id}: ${c.title} (company created with ${row.labels.join(', ')})`, async ({
    hubspotContacts,
    hubspotCompanies,
    saleshandyIntegration,
    saleshandyCrm,
    saleshandyDnc,
  }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    const people = row.labels.map(contact);
    await test.step(`Turn on only the Company trigger with "${c.activity}"`, () =>
      useActivity(saleshandyIntegration, c.activity, c.config));
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
    await test.step(`Create the company in HubSpot with ${people.length} contact(s) selected in the form (${row['Company Name']})`, () =>
      hubspotCompanies.createCompany({
        domain: runDomain(row['Company Domain']),
        name: row['Company Name'],
        contacts: people.map((p) => ({ email: p['Email'], firstName: p['First Name'], lastName: p['Last Name'] })),
      }),
    );
    // No wait on the Logs entry (QA, 2026-10-15): the outcome is read straight
    // from the prospect in Saleshandy, polled for up to 10 minutes below.
    for (const person of people) {
      const email = person['Email'];
      const want = c.expected;
      await test.step(`Check ${fullName(person)} in Saleshandy`, () =>
        untilPasses(
          `Prospect ${email} did not reach the expected state`,
          async () => {
            const total = await saleshandyCrm.search(email);
            expect(total, `prospects with ${email}`).toBe(1);
            if (want.status) expect(await saleshandyCrm.latestStatus(email), `Latest Status of ${email}`).toBe(want.status);
            if (want.notStatus) expect(await saleshandyCrm.latestStatus(email), `Latest Status of ${email}`).not.toBe(want.notStatus);
            if (want.sequence) expect(await saleshandyCrm.sequenceAssociated(email), `Sequence of ${email}`).toBe(want.sequence);
            if (want.tag) expect(await saleshandyCrm.prospectTags(email), `Tags of ${email}`).toContain(want.tag);
          },
          LOG_TIMEOUT_MS,
        ),
      );
    }
    if (c.removeFromDoNotContact) {
      await test.step(`Remove ${c.removeFromDoNotContact} from the Do Not Contact list`, () =>
        saleshandyDnc.removeEntry(c.removeFromDoNotContact!));
    }
  });
}

test.describe('Production smoke: Company Created/Properties Updated in HubSpot', () => {
  // Not serial: a failure on one check must not hide the ones after it. Order
  // is the file order, one worker; later checks use the prospects of earlier ones.
  smoke({ id: '00', title: 'Add Prospect (baseline)', key: 'Add Prospect in Saleshandy', activity: activity.add, expected: {} });
  smoke({ id: '01', title: 'Move Prospect to another Sequence', key: 'Move Prospect to Another sequence in Saleshandy', activity: activity.move, config: sequence(SEQ_A, true), expected: { sequence: SEQ_A } });
  smoke({ id: '02', title: 'Assign a tag to Prospect', key: 'Assign a tag to Prospect in Saleshandy', activity: activity.tag, config: tagConfig, expected: { tag: TAG } });
  smoke({ id: '03', title: 'Mark Prospect as Paused', key: 'Mark Prospect as Paused in Saleshandy', activity: activity.paused, config: paused, expected: { status: 'Paused' } });
  smoke({ id: '04', title: 'Mark prospect as Resume (Un-pause)', key: 'Mark prospect as Resume (Un-pause) in Saleshandy', activity: activity.resume, config: sequence(SEQ_A), expected: { notStatus: 'Paused' } });
  // With "Stop sending follow-ups" on a reply, a Replied prospect ends Finished (QA, 2026-10-15).
  smoke({ id: '05', title: 'Mark prospect as Replied', key: 'Mark prospect as Replied in Saleshandy', activity: activity.replied, config: sequence(SEQ_A), expected: { status: 'Finished' } });
  smoke({ id: '06', title: 'Mark prospect as Finished', key: 'Mark prospect as Finished in Saleshandy', activity: activity.finished, config: sequence(SEQ_A), expected: { status: 'Finished' } });
  smoke({ id: '07', title: 'Mark Prospect as Unsubscribed', key: 'Mark Prospect as unsubscribed in Saleshandy', activity: activity.unsubscribed, expected: { status: 'Unsubscribed' } });
  smoke({ id: '08', title: 'Blacklist a domain', key: 'Blacklist a domain in Saleshandy', activity: activity.blacklist, expected: { status: 'Blacklisted' }, removeFromDoNotContact: 'mailinator.com' });
});
