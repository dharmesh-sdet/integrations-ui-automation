// Scenarios: test-cases/salesforce/reply-received-all-activities.md (Regression).
// Data: test-data/salesforce/reply-received-all-activities.csv, one row per scenario
// that sends a reply (Scenario column = the id below).
// Hand-written like the other Salesforce specs (QA, 2026-10-19).
//
// How this file is built: every row that needs a reply is one entry in SCENARIOS (what
// to set up in Salesforce, which activities to turn on, what to check). The Saleshandy
// half (prospect, send, reply, Logs) and QA's check are in src/flows/reply-harness.ts,
// and the Salesforce half is behind src/pages/salesforce/salesforce.ts. A new row is a
// new entry here; a new Salesforce object is one new page object.
//
// "confirmed: false" rows are "(proposed, unconfirmed)" in the test cases: the result is
// recorded as an annotation, and a difference from the proposal is flagged "Needs QA"
// instead of failing the row.
import { expect, test } from '../../src/fixtures/index.ts';
import { newReplyState, ReplyHarness, type ReplyScenario, type World } from '../../src/flows/reply-harness.ts';
import { SaleshandySequencePage } from '../../src/pages/saleshandy/sequence.page.ts';
import { inDays } from '../../src/pages/salesforce/salesforce.ts';

// 30 s per action: an action that cannot work now fails at once, not after the test timeout.
test.use({ account: 'sfreplyreceived', actionTimeout: 30_000 });

const TRIGGER = 'Reply is Received in Saleshandy';
const SEQUENCE_ID = '196746';
const CSV = 'salesforce/reply-received-all-activities.csv';

const CL = 'Create a Lead in Salesforce';
const UL = 'Update a Lead in Salesforce';
const CC = 'Create a Contact in Salesforce';
const UC = 'Update a Contact in Salesforce';
const CA = 'Create a Account in Salesforce';
const UA = 'Update a Account in Salesforce';
const CO = 'Create a Opportunity in Salesforce';
const UO = 'Update a Opportunity in Salesforce';
const AN = 'Attach Note in Salesforce';
const RE = 'Record(log) an Email Activity in Salesforce';
const EMAIL_SUBJECT = 'Salesforce reply test';

// ---- small readers, so a scenario reads like the test-case row ----
type Look<T> = () => Promise<T | undefined>;
const whenFound = <T>(count: () => Promise<number>, read: () => Promise<T>): Look<T> => async () => ((await count()) > 0 ? read() : undefined);

const leadOf = (w: World) => whenFound(() => w.salesforce.leads.countByEmail(w.row['Email']), () => w.salesforce.leads.leadFields(w.row['Email']));
const contactOf = (w: World) => whenFound(() => w.salesforce.contacts.countByEmail(w.row['Email']), () => w.salesforce.contacts.contactFields(w.row['Email']));
const accountOf = (w: World) => whenFound(() => w.salesforce.accounts.countByName(w.row['Company']), () => w.salesforce.accounts.accountFields(w.row['Company']));
const opportunityOf = (w: World) => whenFound(() => w.salesforce.opportunities.countByName(w.fullName), () => w.salesforce.opportunities.opportunityFields(w.fullName));

const leadCount = (w: World) => () => w.salesforce.leads.countByEmail(w.row['Email']);
const contactCount = (w: World) => () => w.salesforce.contacts.countByEmail(w.row['Email']);
const accountCount = (w: World) => () => (w.row['Company'] ? w.salesforce.accounts.countByName(w.row['Company']) : Promise.resolve(0));
const opportunityCount = (w: World) => () => w.salesforce.opportunities.countByName(w.fullName);

// Account rows look the Account up by the prospect's Company, so that name must be new in
// Salesforce on every run and shared with no other row.
const RUN = Date.now().toString(36);
// Salesforce's duplicate rule matches similar names, so each row gets an unrelated
// company word, not the same name with a different tag.
const COMPANY_WORD: Record<string, string> = { CA1: 'Zephyr Robotics', CA2: 'Quartz Logistics', UA1: 'Marlowe Textiles', UA2: 'Sundial Analytics', CB2: 'Harbor Brewing' };
const ownCompany = (tag: string) => ({ Company: `${COMPANY_WORD[tag]} ${RUN}` });

const digits = (text: string) => text.replace(/\D/g, '');

// The Contact Note for a Contact (Related > Notes), read after the Logs status says Success.
async function noteRows(w: World): Promise<string> {
  return w.salesforce.contacts.noteBody(w.row['Email'], 'reply-received');
}

// Attach Note rows are checked from Logs first (QA, 2026-10-20); the Note is looked up
// on the Contact only when Logs says Success. Error is recorded for QA, not failed.
async function noteScenario(w: World, expectContact: boolean, outcome?: string): Promise<void> {
  const status = await w.logStatus();
  w.observe('Logs status', status);
  if (status !== 'Success') {
    test.info().annotations.push({ type: 'Needs QA', description: `Logs status is "${status || 'no entry'}". Report to QA with this scenario and its steps.` });
    return;
  }
  const contacts = await contactCount(w)();
  w.verdict('Contacts for the email', contacts, expectContact ? 1 : 0);
  if (!expectContact) return;
  const body = await noteRows(w);
  w.verdict('A Note "reply-received" is on the Contact', body !== '', true);
  w.verdict('Note Body names the prospect email', body.includes(w.row['Email']), true);
  if (outcome) w.verdict(`Note Body shows Latest Outcome ${outcome}`, body.includes(`Latest Outcome: ${outcome}`), true);
  else w.verdict('Note Body shows an empty Latest Outcome', /Latest Outcome:\s*(,|Prospect Email)/.test(body), true);
}

// Salesforce fills the fields it requires when nothing is mapped (QA, 2026-10-16).
const EMPTY_MAPPING: ReplyScenario = {
  id: `${CL} > 3`,
  title: 'Lead mapping empty, trigger on',
  activities: [CL],
  confirmed: true,
  check: async (w) => {
    const lead = await w.find(leadOf(w));
    expect(lead, 'Lead found within 3 min').toBeDefined();
    w.verdict('Leads for the email', await leadCount(w)(), 1);
    w.verdict('Lead Status', lead!.status, 'Open - Not Contacted');
    w.verdict('Company', lead!.company, 'HubSpot');
  },
};

const SCENARIOS: ReplyScenario[] = [
  EMPTY_MAPPING,
  // ---- Create a Lead ----
  {
    id: `${CL} > 1`,
    title: 'new prospect, every mapped field filled, accented first name and apostrophe in last name',
    activities: [CL],
    confirmed: true,
    override: { 'First Name': 'Zoë', 'Last Name': "O'Brien" },
    check: async (w) => {
      const lead = await w.find(leadOf(w));
      expect(lead, 'Lead found within 3 min').toBeDefined();
      w.verdict('Leads for the email', await leadCount(w)(), 1);
      w.verdict('Name', lead!.name.includes('Zoë') && lead!.name.includes("O'Brien"), true);
      w.verdict('Title', lead!.title, w.row['Job Title']);
      w.verdict('Company', lead!.company, w.row['Company']);
      w.verdict('Phone', digits(lead!.phone), digits(w.row['Phone Number']));
      w.verdict('Address has the City', lead!.address.includes(w.row['City']), true);
    },
  },
  {
    id: `${CL} > 2`,
    title: 'new prospect with no Company',
    activities: [CL],
    confirmed: false,
    override: { Company: '' },
    check: async (w) => {
      const lead = await w.find(leadOf(w));
      w.observe('Lead created', lead !== undefined);
      if (lead) w.observe('Company on the Lead', lead.company);
    },
  },
  {
    id: `${CL} > 4`,
    title: 'a Lead with the prospect email already exists',
    activities: [CL],
    confirmed: false,
    setup: { lead: {} },
    check: async (w) => {
      w.verdict('Leads for the email', await w.absent(leadCount(w)), 1);
      w.observe('Title after the reply', (await w.salesforce.leads.leadFields(w.row['Email'])).title);
    },
  },

  // ---- Update a Lead ----
  {
    id: `${UL} > 1`,
    title: 'Lead exists with a different Job Title, Phone and Company',
    activities: [UL],
    confirmed: true,
    setup: { lead: {} },
    check: async (w) => {
      const lead = await w.find(async () => {
        const fields = await w.salesforce.leads.leadFields(w.row['Email']);
        return fields.title === w.row['Job Title'] ? fields : undefined;
      });
      expect(lead, 'Lead updated with the prospect Title').toBeDefined();
      w.verdict('Leads for the email', await leadCount(w)(), 1);
      w.verdict('Phone', digits(lead!.phone), digits(w.row['Phone Number']));
      w.verdict('Company', lead!.company, w.row['Company']);
      w.verdict('Address has the City', lead!.address.includes(w.row['City']), true);
    },
  },
  {
    id: `${UL} > 2`,
    title: 'Lead Status "Working - Contacted", prospect has a new Job Title',
    activities: [UL],
    confirmed: false,
    setup: { lead: { status: 'Working - Contacted' } },
    check: async (w) => {
      const lead = await w.find(async () => {
        const fields = await w.salesforce.leads.leadFields(w.row['Email']);
        return fields.title === w.row['Job Title'] ? fields : undefined;
      });
      w.verdict('Title updated', lead?.title, w.row['Job Title']);
      w.verdict('Lead Status', lead?.status, 'Working - Contacted');
    },
  },
  {
    id: `${UL} > 3`,
    title: 'Lead has a Phone, prospect has no Phone',
    activities: [UL],
    confirmed: false,
    override: { 'Phone Number': '' },
    setup: { lead: {} },
    check: async (w) => {
      const lead = await w.find(async () => {
        const fields = await w.salesforce.leads.leadFields(w.row['Email']);
        return fields.title === w.row['Job Title'] ? fields : undefined;
      });
      w.verdict('Lead updated', lead !== undefined, true);
      w.observe('Phone after the reply (kept or cleared)', lead?.phone ?? 'Lead not updated');
    },
  },
  {
    id: `${UL} > 4`,
    title: 'no Lead or Contact with the prospect email',
    activities: [UL],
    confirmed: false,
    check: async (w) => {
      w.verdict('Leads for the email', await w.absent(leadCount(w)), 0);
    },
  },

  // ---- Create a Contact ----
  {
    id: `${CC} > 1`,
    title: 'new prospect, every Contact-mapped field filled, Job Title and Company filled but unmapped',
    activities: [CC],
    confirmed: true,
    check: async (w) => {
      const contact = await w.find(contactOf(w));
      expect(contact, 'Contact found within 3 min').toBeDefined();
      w.verdict('Contacts for the email', await contactCount(w)(), 1);
      w.verdict('Leads for the email', await leadCount(w)(), 0);
      w.verdict('Name', contact!.name.includes(w.row['First Name']) && contact!.name.includes(w.row['Last Name']), true);
      w.verdict('Business Phone', digits(contact!.phone), digits(w.row['Phone Number']));
      w.verdict('Department', contact!.department, w.row['Department']);
      w.verdict('Other Address has the City', contact!.otherAddress.includes(w.row['City']), true);
      w.verdict('Title (Job Title is not mapped for Contacts)', contact!.title, '');
    },
  },
  {
    id: `${CC} > 2`,
    title: 'a Contact with the prospect email already exists',
    activities: [CC],
    confirmed: false,
    setup: { contact: true },
    check: async (w) => {
      w.verdict('Contacts for the email', await w.absent(contactCount(w)), 1);
      const contact = await w.salesforce.contacts.contactFields(w.row['Email']);
      w.observe('Department after the reply (own value or the prospect one)', contact.department);
    },
  },
  {
    id: `${CC} > 3`,
    title: 'a Lead with the prospect email exists (made by hand), no Contact',
    activities: [CC],
    confirmed: false,
    setup: { lead: {} },
    check: async (w) => {
      const contact = await w.find(contactOf(w));
      w.verdict('Contacts for the email', contact !== undefined ? await contactCount(w)() : 0, 1);
      w.verdict('Leads for the email', await leadCount(w)(), 1);
      w.verdict('Lead Title unchanged', (await w.salesforce.leads.leadFields(w.row['Email'])).title, 'Legacy Title QA');
    },
  },

  // ---- Update a Contact ----
  {
    id: `${UC} > 1`,
    title: 'Contact exists with a different Phone and Department',
    activities: [UC],
    confirmed: false,
    setup: { contact: true },
    check: async (w) => {
      const contact = await w.find(async () => {
        const fields = await w.salesforce.contacts.contactFields(w.row['Email']);
        return fields.department === w.row['Department'] ? fields : undefined;
      });
      w.verdict('Contact updated', contact !== undefined, true);
      w.verdict('Contacts for the email', await contactCount(w)(), 1);
      w.verdict('Business Phone', digits(contact?.phone ?? ''), digits(w.row['Phone Number']));
    },
  },
  {
    id: `${UC} > 2`,
    title: 'no Contact with the prospect email',
    activities: [UC],
    confirmed: false,
    check: async (w) => {
      w.verdict('Contacts for the email', await w.absent(contactCount(w)), 0);
    },
  },
  {
    id: `${UC} > 3`,
    title: 'Contact has a Phone, prospect has no Phone',
    activities: [UC],
    confirmed: false,
    override: { 'Phone Number': '' },
    setup: { contact: true },
    check: async (w) => {
      const contact = await w.find(async () => {
        const fields = await w.salesforce.contacts.contactFields(w.row['Email']);
        return fields.department === w.row['Department'] ? fields : undefined;
      });
      w.verdict('Contact updated', contact !== undefined, true);
      w.observe('Business Phone after the reply (kept or cleared)', contact?.phone ?? 'Contact not updated');
    },
  },

  // ---- Create an Account (Account mapping not opened yet: the first run shows it) ----
  {
    id: `${CA} > 1`,
    title: 'new prospect with a Company, no such Account',
    activities: [CA],
    confirmed: false,
    override: ownCompany('CA1'),
    check: async (w) => {
      const account = await w.find(accountOf(w));
      w.verdict('Accounts named like the Company', account !== undefined ? await accountCount(w)() : 0, 1);
    },
  },
  {
    id: `${CA} > 2`,
    title: 'an Account named like the prospect Company already exists',
    activities: [CA],
    confirmed: false,
    override: ownCompany('CA2'),
    setup: { account: true },
    check: async (w) => {
      w.verdict('Accounts named like the Company', await w.absent(accountCount(w)), 1);
    },
  },
  {
    id: `${CA} > 3`,
    title: 'new prospect with no Company',
    activities: [CA],
    confirmed: false,
    override: { Company: '' },
    check: async (w) => {
      const status = await w.logStatus();
      w.observe('Logs status', status);
    },
  },

  // ---- Update an Account ----
  {
    id: `${UA} > 1`,
    title: 'Account named like the Company exists with a different City',
    activities: [UA],
    confirmed: false,
    override: ownCompany('UA1'),
    setup: { account: true },
    check: async (w) => {
      const account = await w.find(async () => {
        const fields = await w.salesforce.accounts.accountFields(w.row['Company']);
        return fields.billingAddress.includes(w.row['City']) ? fields : undefined;
      });
      w.verdict('Account updated with the prospect City', account !== undefined, true);
      w.verdict('Accounts named like the Company', await accountCount(w)(), 1);
    },
  },
  {
    id: `${UA} > 2`,
    title: 'no Account matches the prospect Company',
    activities: [UA],
    confirmed: false,
    override: ownCompany('UA2'),
    check: async (w) => {
      w.verdict('Accounts named like the Company', await w.absent(accountCount(w)), 0);
    },
  },
  {
    id: `${UA} > 3`,
    title: 'prospect has no Company',
    activities: [UA],
    confirmed: false,
    override: { Company: '' },
    check: async (w) => {
      w.observe('Logs status', await w.logStatus());
    },
  },

  // ---- Create an Opportunity (CO > 3 is a UI row near the end of the file) ----
  {
    id: `${CO} > 1`,
    title: 'Extra Configuration 7 days, stage Prospecting',
    activities: [{ activity: CO, extra: { closingDays: 7, stage: 'Prospecting' } }],
    confirmed: false,
    check: async (w) => {
      const opportunity = await w.find(opportunityOf(w));
      w.verdict('Opportunities for the prospect', opportunity !== undefined ? await opportunityCount(w)() : 0, 1);
      w.verdict('Stage', opportunity?.stage, 'Prospecting');
      w.verdict('Close Date', opportunity?.closeDate, inDays(7));
    },
  },
  {
    id: `${CO} > 2`,
    title: 'Extra Configuration 0 days, stage Closed Won',
    activities: [{ activity: CO, extra: { closingDays: 0, stage: 'Closed Won' } }],
    confirmed: false,
    check: async (w) => {
      const opportunity = await w.find(opportunityOf(w));
      w.verdict('Stage', opportunity?.stage, 'Closed Won');
      w.verdict('Close Date', opportunity?.closeDate, inDays(0));
    },
  },

  // ---- Update an Opportunity ----
  {
    id: `${UO} > 1`,
    title: 'Opportunity exists in Qualification; Extra Configuration 14 days, stage Negotiation/Review',
    activities: [{ activity: UO, extra: { closingDays: 14, stage: 'Negotiation/Review' } }],
    confirmed: false,
    setup: { opportunity: { stage: 'Qualification' } },
    check: async (w) => {
      const opportunity = await w.find(async () => {
        const fields = await w.salesforce.opportunities.opportunityFields(w.fullName);
        return fields.stage === 'Negotiation/Review' ? fields : undefined;
      });
      w.verdict('Opportunity updated to Negotiation/Review', opportunity !== undefined, true);
      w.verdict('Opportunities for the prospect', await opportunityCount(w)(), 1);
      w.verdict('Close Date', opportunity?.closeDate, inDays(14));
    },
  },
  {
    id: `${UO} > 2`,
    title: 'no Opportunity for the prospect',
    activities: [{ activity: UO, extra: { closingDays: 14, stage: 'Negotiation/Review' } }],
    confirmed: false,
    check: async (w) => {
      w.verdict('Opportunities for the prospect', await w.absent(opportunityCount(w)), 0);
    },
  },

  // ---- Attach Note (with Create a Contact), checked from Logs first ----
  {
    id: `${AN} > 1`,
    title: 'new prospect, outcome left as Add Outcome; Create a Contact and Attach Note',
    activities: [CC, AN],
    confirmed: true,
    check: (w) => noteScenario(w, true),
  },
  {
    id: `${AN} > 2`,
    title: 'a Contact with the prospect email already exists',
    activities: [CC, AN],
    confirmed: false,
    setup: { contact: true },
    check: (w) => noteScenario(w, true),
  },
  {
    id: `${AN} > 3`,
    title: 'Attach Note selected alone',
    activities: [AN],
    confirmed: false,
    check: (w) => noteScenario(w, false),
  },
  {
    id: `${AN} > 4`,
    title: 'prospect outcome set to Interested before the reply',
    activities: [CC, AN],
    confirmed: false,
    outcome: 'Interested',
    check: (w) => noteScenario(w, true, 'Interested'),
  },

  // ---- Record(log) an Email Activity: what is logged for a reply is not known yet ----
  {
    id: `${RE} > 1`,
    title: 'Select Object Contact; the Contact exists',
    activities: [{ activity: RE, extra: { object: 'Contact' } }],
    confirmed: false,
    setup: { contact: true },
    check: async (w) => {
      w.observe('Logs status', await w.logStatus());
      await w.salesforce.contacts.openRecord(w.row['Email']);
      const timeline = await w.salesforce.contacts.activityText();
      w.observe('Contact Activity timeline', timeline.slice(0, 400));
      w.verdict('The timeline shows the email subject', timeline.includes(EMAIL_SUBJECT), true);
    },
  },
  {
    id: `${RE} > 2`,
    title: 'Select Object Lead; the Lead exists',
    activities: [{ activity: RE, extra: { object: 'Lead' } }],
    confirmed: false,
    setup: { lead: {} },
    check: async (w) => {
      w.observe('Logs status', await w.logStatus());
      const timeline = await w.salesforce.leads.activityText(w.row['Email']);
      w.observe('Lead Activity timeline', timeline.slice(0, 400));
      w.verdict('The timeline shows the email subject', timeline.includes(EMAIL_SUBJECT), true);
    },
  },
  {
    id: `${RE} > 3`,
    title: 'Select Object Opportunity; the Opportunity exists',
    activities: [{ activity: RE, extra: { object: 'Opportunity' } }],
    confirmed: false,
    setup: { opportunity: { stage: 'Prospecting' } },
    check: async (w) => {
      w.observe('Logs status', await w.logStatus());
      await w.salesforce.opportunities.openRecord(w.fullName);
      const timeline = await w.salesforce.opportunities.activityText();
      w.observe('Opportunity Activity timeline', timeline.slice(0, 400));
      w.verdict('The timeline shows the email subject', timeline.includes(EMAIL_SUBJECT), true);
    },
  },
  {
    id: `${RE} > 4`,
    title: 'Select Object Contact; no Contact for the prospect',
    activities: [{ activity: RE, extra: { object: 'Contact' } }],
    confirmed: false,
    check: async (w) => {
      w.verdict('Contacts for the email', await w.absent(contactCount(w)), 0);
    },
  },

  // ---- Combined activities ----
  {
    id: 'Combined activities > 1',
    title: 'Create a Lead and Create a Contact both selected',
    activities: [CL, CC],
    confirmed: false,
    check: async (w) => {
      const lead = await w.find(leadOf(w));
      const contact = await w.find(contactOf(w));
      w.verdict('Leads for the email', lead !== undefined ? await leadCount(w)() : 0, 1);
      w.verdict('Contacts for the email', contact !== undefined ? await contactCount(w)() : 0, 1);
    },
  },
  {
    id: 'Combined activities > 2',
    title: 'Create an Account and Create a Contact both selected',
    activities: [CA, CC],
    confirmed: false,
    override: ownCompany('CB2'),
    check: async (w) => {
      const account = await w.find(accountOf(w));
      const contact = await w.find(contactOf(w));
      w.verdict('Accounts named like the Company', account !== undefined ? await accountCount(w)() : 0, 1);
      w.verdict('Contacts for the email', contact !== undefined ? await contactCount(w)() : 0, 1);
      if (contact) w.observe('Contact Account Name (linked to the Account?)', await w.salesforce.contacts.field('AccountId'));
    },
  },
  // ---- Trigger off: custom flow, see the test below ----
  {
    id: 'Trigger off > 1',
    title: 'trigger turned off and saved',
    activities: [CL],
    triggerOff: true,
    confirmed: true,
    check: async (w) => {
      const seen = await w.absent(async () => {
        const c = await w.salesforce.counts(w.row);
        return c.leads + c.contacts + c.accounts + c.opportunities;
      });
      w.verdict('Records in Salesforce for the prospect', seen, 0);
    },
  },
];

const IDS = SCENARIOS.map((s) => s.id);
const state = newReplyState();

test.describe('Reply is Received in Saleshandy: all Salesforce activities', () => {
  // Not serial: one failed test must not skip the rest (QA, 2026-10-21). Tests still run
  // in file order on one worker, and every row prepares itself if Setup did not run.

  // Page objects are rebuilt for every test; the harness is the same code each time.
  const harnessOf = (f: {
    saleshandySequence: SaleshandySequencePage;
    salesforceIntegration: ConstructorParameters<typeof ReplyHarness>[0]['sf'];
    salesforce: ConstructorParameters<typeof ReplyHarness>[0]['salesforce'];
  }) =>
    new ReplyHarness(
      { csv: CSV, sequenceId: SEQUENCE_ID, trigger: TRIGGER, seq: f.saleshandySequence, sf: f.salesforceIntegration, salesforce: f.salesforce, scenarios: SCENARIOS },
      state,
    );

  // ---- Trigger behavior (UI only, no reply) ----
  const ACTIVITY_OPTIONS = ['Create a Account', 'Update a Account', 'Create a Contact', 'Update a Contact', 'Create a Lead', 'Update a Lead', 'Create a Opportunity', 'Update a Opportunity', 'Attach Note', 'Record(log) an Email Activity'];

  test('Baseline 1: activity list and the Create a Lead chip, nothing saved', async ({ salesforceIntegration }) => {
    await test.step('Turn on the trigger without saving', async () => {
      await salesforceIntegration.openTriggers();
      await salesforceIntegration.enableOnly(TRIGGER);
    });
    await test.step('The activity list shows the 10 activities', async () => {
      await salesforceIntegration.openActivityList(TRIGGER);
      for (const option of ACTIVITY_OPTIONS) await expect(salesforceIntegration.activityOption(option).first(), option).toBeVisible();
    });
    await test.step('Choose Create a Lead in Salesforce: a chip shows, no Extra Configuration opens', async () => {
      await salesforceIntegration.activityOption('Create a Lead').first().click();
      const chips = await salesforceIntegration.selectedActivities(TRIGGER);
      expect(chips.some((t) => t.includes(CL)), `chips: ${chips.join(' | ')}`).toBe(true);
      await expect(salesforceIntegration.page.getByRole('dialog')).toHaveCount(0);
    });
  });

  test('Baseline 2: only Create a Lead selected, Save and reload', async ({ salesforceIntegration }) => {
    await test.step('Save with only Create a Lead in Salesforce', async () => {
      await salesforceIntegration.setActivities(TRIGGER, [CL]);
      await expect(salesforceIntegration.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
    });
    await test.step('After a reload the toggle is on and the chip persists', async () => {
      await salesforceIntegration.openTriggers();
      expect(await salesforceIntegration.isTriggerOn(TRIGGER), 'trigger on').toBe(true);
      const chips = await salesforceIntegration.selectedActivities(TRIGGER);
      expect(chips.some((t) => t.includes(CL)), `chips: ${chips.join(' | ')}`).toBe(true);
    });
  });

  // Lead Properties mapping used by every Lead row (and restored after Create a Lead > 3).
  const MAPPINGS: [string, string][] = [
    ['Last Name', 'Last Name'],
    ['First Name', 'First Name'],
    ['Email', 'Email'],
    ['Phone Number', 'Phone'],
    ['Job Title', 'Title'],
    ['Company', 'Company'],
    ['City', 'City'],
  ];

  test('Baseline 3: Lead Properties mapping page and Save', async ({ salesforceIntegration }) => {
    await test.step('Map the 7 fields and Save', async () => {
      await salesforceIntegration.openLeadPropertiesMapping();
      for (const [field, property] of MAPPINGS) await salesforceIntegration.mapLeadField(field, property);
      await salesforceIntegration.save();
      await expect(salesforceIntegration.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
    });
    await test.step('All 7 mappings persist after a reload', async () => {
      await salesforceIntegration.openLeadPropertiesMapping();
      for (const [field, property] of MAPPINGS) await expect(salesforceIntegration.leadMappedValue(field), field).toHaveText(property);
    });
  });

  // ---- Setup: the waiting, done once ----
  test(`Setup: Salesforce records, prospects and step 1 sends for all ${IDS.length} replies`, async ({
    saleshandyPage,
    saleshandySequence,
    salesforceIntegration,
    salesforce,
  }) => {
    // 35 prospects through the form and the sender's 40 to 50 s spacing between sends.
    test.setTimeout(75 * 60_000);
    const sender = new SaleshandySequencePage(await saleshandyPage.context().newPage());
    await harnessOf({ saleshandySequence, salesforceIntegration, salesforce }).setupAll(IDS, sender);
  });

  // ---- Every row of the table, in plan order ----
  for (const scenario of SCENARIOS.filter((s) => s !== EMPTY_MAPPING)) {
    test(`${scenario.id}: ${scenario.title}`, async ({ saleshandySequence, salesforceIntegration, salesforce }) => {
      test.setTimeout(12 * 60_000);
      const harness = harnessOf({ saleshandySequence, salesforceIntegration, salesforce });
      await harness.run(scenario.id);
    });
  }

  // ---- Create a Opportunity > 3: Extra Configuration saved without a stage ----
  test(`${CO} > 3: Extra Configuration saved with no stage`, async ({ salesforceIntegration }) => {
    await salesforceIntegration.openTriggers();
    await salesforceIntegration.enableOnly(TRIGGER);
    await salesforceIntegration.openActivityList(TRIGGER);
    await salesforceIntegration.page.getByRole('button', { name: CO, exact: true }).click();
    const dialog = salesforceIntegration.page.getByRole('dialog');
    await dialog.waitFor({ timeout: 15_000 });
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await salesforceIntegration.page.waitForTimeout(2_000);
    // (proposed, unconfirmed) Save is blocked or a message names the missing stage; record which.
    const stillOpen = (await dialog.count()) > 0;
    test.info().annotations.push({ type: 'Observed: dialog after Save with no stage', description: stillOpen ? `stays open: ${(await dialog.innerText()).replace(/\s+/g, ' ')}` : 'closed, saved without a stage' });
    if (stillOpen) await dialog.getByRole('button', { name: 'Cancel' }).click();
    test.info().annotations.push({ type: 'Needs QA', description: 'Create a Opportunity > 3 is exploration until QA confirms the expected result.' });
  });

  // ---- Create a Lead > 3: Lead Properties mapping empty. Runs last: it empties the
  // shared mapping and puts it back afterwards, so no other row sees a half-mapped state. ----
  test.describe('Create a Lead > 3 (mapping empty)', () => {
    const id = `${CL} > 3`;

    test(`${id}: Lead mapping empty, trigger on`, async ({ saleshandySequence, salesforceIntegration, salesforce }) => {
      test.setTimeout(15 * 60_000);
      const harness = harnessOf({ saleshandySequence, salesforceIntegration, salesforce });
      try {
        await test.step('Empty the Lead Properties mapping and Save', async () => {
          await salesforceIntegration.openLeadPropertiesMapping();
          for (const [field] of MAPPINGS) await salesforceIntegration.unmapLeadField(field);
          await salesforceIntegration.save();
          await expect(salesforceIntegration.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
        });
        await harness.useActivities([CL]);
        await harness.replyAndCheck(id);
      } finally {
        await test.step('Put the 7-field Lead Properties mapping back', async () => {
          await salesforceIntegration.openLeadPropertiesMapping();
          for (const [field, property] of MAPPINGS) await salesforceIntegration.mapLeadField(field, property);
          await salesforceIntegration.save();
          await expect(salesforceIntegration.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
        });
      }
    });
  });
});
