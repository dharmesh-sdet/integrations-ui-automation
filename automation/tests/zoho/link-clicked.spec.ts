// Scenarios: test-cases/zoho/link-clicked.md (Regression, 23 rows, QA "looks good" 2026-10-30, no ticket per row).
// One test per row, named "<section>: <n>". Combined 2 turns on a second trigger, so it only runs with
// ZOHO_LC_WITH_OPENED=1 and no Email Opened session running (it overwrites the actions saved on that trigger).
// Data: test-data/zoho/link-clicked.csv (npm run data:zoho-link-clicked), one prospect per row, found by the Scenario column.
// Sequence: "Zoho Link Clicked QA" on notemailsentzoho, 2 steps with 2 links each, Track link clicks on, Track email
//   opens off (tests/setup/zoho-link-clicked-sequence.spec.ts). Put its id in ZOHO_LC_SEQUENCE_ID.
// Zoho CRM is read in a headed browser on its own copy of the saved profile, so run it through xvfb-run (see
// package.json `test:zoho-link-clicked`). Other Zoho workflows run at the same time on this account, each with its own
// sequence and prospects, so only the Link Clicked trigger is touched (KEEP_OTHER_TRIGGERS).
//
// How a row runs: set the trigger and its actions, make the Zoho records the row needs, add the prospect, send step 1
// with Send now, click the link in the Mailinator inbox and wait until the Clicked count rises. Then look in Zoho 15 s
// later, every 10 s after that (QA). Logs are not used for Zoho (QA 2026-10-29). Rows do not delete what they create.
// A link scanner can turn one click into 2 or 3 runs (Z-10), so note counts are "at least"; record counts stay strict.
// Known issues are recorded, not filed (Z-1, Z-5, Q3). On 2026-10-29 a new contact made two Tasks in 2 of 2 runs and two
// Deals in 1 of 2 (Email Sent). The rows expect one record, so a repeat shows Fail until QA decides if it is a bug.
import path from 'node:path';
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { ZOHO_ACTION, configure, fullName } from '../../src/flows/saleshandy-to-zoho.ts';
import { configureWaiting, inDays, sendStep } from '../../src/flows/zoho-email-sent.ts';
import { OPENED_TRIGGER, STEP_1_SUBJECT, TRIGGER, clickLink, clickNotes } from '../../src/flows/zoho-link-clicked.ts';
import { ZohoCrmPage, openZohoProfile } from '../../src/pages/zoho/zoho-crm.page.ts';
import { ZohoForms } from '../../src/pages/zoho/zoho-forms.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';

process.env.KEEP_OTHER_TRIGGERS ??= '1';

const CSV = 'zoho/link-clicked.csv';
// TODO(needs-input): id of "Zoho Link Clicked QA", printed by the setup spec.
const SEQUENCE_ID = process.env.ZOHO_LC_SEQUENCE_ID ?? '';
const PROFILE = path.resolve(import.meta.dirname, '../../auth/zoho-link-clicked-profile');

const test = base.extend<object, { crm: ZohoCrmPage }>({
  crm: [
    async ({}, use) => {
      const { context, crm } = await openZohoProfile(PROFILE);
      // Zoho page loads time out now and then (net::ERR_TIMED_OUT, seen 2026-11-03). Retry a load up to 4 times.
      // Local to this spec: ZohoCrmPage.open is shared and owned by another session.
      const openOnce = crm.open.bind(crm);
      crm.open = async (url: string) => {
        for (let attempt = 1; ; attempt++) {
          try {
            return await openOnce(url);
          } catch (e) {
            if (attempt >= 4 || !/ERR_TIMED_OUT|ERR_CONNECTION|ERR_NETWORK|ERR_NAME|Timeout/.test(String(e))) throw e;
            await crm.page.waitForTimeout(3_000);
          }
        }
      };
      await use(crm);
      await context.close();
    },
    { scope: 'worker' },
  ],
});
test.use({ account: 'notemailsentzoho' });

// A fresh company name, so a record made by an earlier run never matches.
const stamp = String(Date.now()).slice(-6);

function prospect(scenario: string, override: Record<string, string> = {}): Row {
  if (!SEQUENCE_ID) throw new Error('Set ZOHO_LC_SEQUENCE_ID to the id printed by the setup spec');
  const found = readCsv(CSV).find((r) => r['Scenario'] === scenario);
  if (!found) throw new Error(`No row "${scenario}" in test-data/${CSV}`);
  // Twitter in Zoho is a handle, not a URL (Z-1: a wrong-type value makes Zoho reject the whole record).
  const handle = found['Twitter'].split('/').filter(Boolean).pop() ?? '';
  const company = found['Company'] ? `${found['Company']} ${stamp}` : '';
  const row: Row = { ...found, Twitter: handle, Company: company, ...override };
  markUsed(CSV, row['Email']);
  return row;
}

// ZohoCrmPage.field returns the next label when a field is empty, so an empty field is '' or that label.
const emptyField = (text: string, label: string, nextLabel: string): boolean => {
  const value = ZohoCrmPage.field(text, label);
  return value === '' || value === nextLabel;
};

const phoneDigits = (s: string): string => s.replace(/\D/g, '');
const TASK = { subject: 'Follow up after click', status: 'Not Started', priority: 'Normal', dueIn: '3' };

type Fx = Parameters<Parameters<typeof test>[2]>[0];
type Env = Pick<Fx, 'zohoIntegration' | 'saleshandyPage' | 'saleshandySequence' | 'mailinator' | 'crm'>;

// Sends step 1 and makes the first click (the start of every row that clicks).
async function sendAndClick(fx: Env, row: Row, link = 0): Promise<number> {
  await sendStep(fx.saleshandySequence, SEQUENCE_ID, row);
  return clickLink(fx.saleshandySequence, fx.mailinator, SEQUENCE_ID, row, link);
}

// Waits until the record's page shows at least `atLeast` "Click Count" notes; returns the count seen.
async function clickNotesAtLeast(crm: ZohoCrmPage, module: 'Contacts' | 'Leads' | 'Accounts' | 'Deals' | 'Tasks', id: string, atLeast: number): Promise<number> {
  let seen = 0;
  await untilPasses(`${module} ${id} shows ${atLeast} Click Count note(s)`, async () => {
    seen = clickNotes(await crm.recordText(module, id));
    expect(seen).toBeGreaterThanOrEqual(atLeast);
  }, 120_000);
  test.info().annotations.push({ type: `Click Count notes on ${module}`, description: String(seen) });
  return seen;
}

test.describe('Zoho Link Clicked (staging)', () => {
  test.setTimeout(10 * 60_000);

  // ---- Trigger and setup ----

  test('Trigger and setup: 1 Link Clicked trigger OFF', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Trigger and setup > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    // Only this trigger goes off. The action stays saved on it.
    await zohoIntegration.openTriggers();
    await zohoIntegration.turnOff(TRIGGER);
    await zohoIntegration.save();
    await zohoIntegration.savedToast().waitFor({ timeout: 20_000 });
    await sendAndClick({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    expect(await crm.waitForRecord('Contacts', row['Email'], 60_000), 'Nothing may be created with the trigger off').toBeUndefined();
    // Leave the trigger on, the way the other rows expect it.
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
  });

  test('Trigger and setup: 2 Trigger ON, action saved, page reloaded', async ({ zohoIntegration, saleshandyPage }) => {
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.task, task: TASK }]);
    await saleshandyPage.reload();
    await zohoIntegration.openTriggers();
    expect(await zohoIntegration.isTriggerOn(TRIGGER)).toBe(true);
    expect(await zohoIntegration.selectedActivities(TRIGGER)).toEqual([ZOHO_ACTION.task]);
    // TODO(needs-input): the first icon of the chip opening its Extra Configuration is a guess (the last one removes it).
    const chip = saleshandyPage.locator('div:has(> .action-container)').filter({ hasText: ZOHO_ACTION.task }).first();
    await chip.locator('.action-container > svg').first().click();
    const dialog = saleshandyPage.getByRole('dialog');
    await dialog.waitFor({ timeout: 15_000 });
    expect(await dialog.getByRole('spinbutton').inputValue()).toBe(TASK.dueIn);
    expect(await dialog.getByRole('textbox').first().inputValue()).toBe(TASK.subject);
    const shown = await dialog.innerText();
    expect(shown).toContain(TASK.status);
    expect(shown).toContain(TASK.priority);
  });

  test('Trigger and setup: 3 Contact action on, prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Trigger and setup > 3');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    expect(await sendAndClick({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row)).toBeGreaterThanOrEqual(1);
    const found = await crm.waitForRecord('Contacts', row['Email']);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    expect((await crm.find('Contacts', row['Email'])).length, 'One click must make one contact').toBe(1);
    expect(await clickNotesAtLeast(crm, 'Contacts', found!.id, 1)).toBeGreaterThanOrEqual(1);
  });

  test('Trigger and setup: 4 Second link of the same email', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Trigger and setup > 4');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await sendAndClick({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    const first = await crm.waitForRecord('Contacts', row['Email']);
    expect(first, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    const before = await clickNotesAtLeast(crm, 'Contacts', first!.id, 1);
    const count = await clickLink(saleshandySequence, mailinator, SEQUENCE_ID, row, 1);
    expect(count, 'Clicked count after the second link').toBeGreaterThanOrEqual(2);
    // Unconfirmed: a second note with Click Count 2. A scanner can add more, so "at least one more".
    await clickNotesAtLeast(crm, 'Contacts', first!.id, before + 1);
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'Still one contact').toEqual([first!.id]);
  });

  // ---- Create/Update a Contact ----

  test('Contact: 1 Prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Contact > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await sendAndClick({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    const found = await crm.waitForRecord('Contacts', row['Email']);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    const text = await crm.recordText('Contacts', found!.id);
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    for (const value of [row['Job Title'], row['Department'], row['Twitter'], row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(phoneDigits(text)).toContain(phoneDigits(row['Phone Number']));
    expect(ZohoCrmPage.noteCount(text)).toBeGreaterThanOrEqual(1);
    expect(clickNotes(text)).toBeGreaterThanOrEqual(1);
    expect((await crm.find('Contacts', row['Email'])).length).toBe(1);
  });

  test('Contact: 2 Contact exists with an old Title', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Contact > 2');
    const id = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'], title: 'Old Title' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await sendAndClick({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    await untilPasses('the contact is updated', async () => {
      const text = await crm.recordText('Contacts', id);
      expect(text).toContain(row['Job Title']);
      expect(text).not.toContain('Old Title');
    }, 120_000);
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'Still one contact').toEqual([id]);
  });

  test('Contact: 3 Contact exists, its email in different letter case', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Contact > 3');
    const typed = `${row['Email'].split('@')[0].toUpperCase()}@Mailinator.com`;
    const id = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: typed });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await sendAndClick({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    await untilPasses('the contact is updated', async () => {
      const text = await crm.recordText('Contacts', id);
      expect(ZohoCrmPage.noteCount(text)).toBeGreaterThanOrEqual(1);
      expect(text).toContain(row['Department']);
    }, 120_000);
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'No second contact').toEqual([id]);
  });

  // ---- Create/Update a Lead ----

  test('Lead: 1 Prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Lead > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.lead }]);
    await sendAndClick({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    const found = await crm.waitForRecord('Leads', row['Email']);
    expect(found, `No Zoho lead for ${row['Email']}`).toBeTruthy();
    const text = await crm.recordText('Leads', found!.id);
    expect(ZohoCrmPage.field(text, 'Company')).toBe(row['Company']);
    for (const value of [row['Job Title'], row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(ZohoCrmPage.noteCount(text)).toBeGreaterThanOrEqual(1);
    expect(clickNotes(text)).toBeGreaterThanOrEqual(1);
    expect((await crm.find('Leads', row['Email'])).length, 'One click must make one lead').toBe(1);
  });

  test('Lead: 2 Lead exists for the prospect email', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Lead > 2');
    const id = await new ZohoForms(crm).createLead({ first: row['First Name'], last: row['Last Name'], email: row['Email'], company: `Old Company ${stamp}` });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.lead }]);
    await sendAndClick({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    await untilPasses('the lead is updated', async () => {
      const text = await crm.recordText('Leads', id);
      expect(ZohoCrmPage.field(text, 'Company')).toBe(row['Company']);
      expect(ZohoCrmPage.noteCount(text)).toBeGreaterThanOrEqual(1);
    }, 120_000);
    expect((await crm.find('Leads', row['Email'])).map((r) => r.id), 'Still one lead').toEqual([id]);
  });

  test('Lead: 3 Prospect has no company', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Lead > 3', { Company: '' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.lead }]);
    await sendAndClick({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    const found = await crm.waitForRecord('Leads', row['Email']);
    expect(found, `No Zoho lead for ${row['Email']}`).toBeTruthy();
    const text = await crm.recordText('Leads', found!.id);
    expect(emptyField(text, 'Company', 'Lead Name'), 'Company is empty').toBe(true);
    expect(ZohoCrmPage.noteCount(text)).toBeGreaterThanOrEqual(1);
  });

  // ---- Create/Update Account ----

  test('Account: 1 Prospect has a company, no contact, no account', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Account > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.account }]);
    await sendAndClick({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    const found = await crm.waitForRecord('Accounts', row['Company']);
    expect(found, `No Zoho account named ${row['Company']}`).toBeTruthy();
    const text = await crm.recordText('Accounts', found!.id);
    expect(ZohoCrmPage.field(text, 'Account Name')).toBe(row['Company']);
    for (const value of [row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(ZohoCrmPage.noteCount(text)).toBeGreaterThanOrEqual(1);
    expect((await crm.find('Accounts', row['Company'])).length).toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The Account action must not create a contact').toBe(0);
  });

  test('Account: 2 Contact exists and is linked to an account', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Account > 2');
    const accountName = `Linked Account ${stamp}`;
    const accountId = await crm.createAccount(accountName);
    await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'], account: accountName });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.account }]);
    await sendAndClick({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    await untilPasses('the linked account is updated', async () => {
      const text = await crm.recordText('Accounts', accountId);
      for (const value of [row['City'], row['State'], row['Country']]) expect(text).toContain(value);
      expect(ZohoCrmPage.noteCount(text)).toBeGreaterThanOrEqual(1);
    }, 120_000);
    expect(ZohoCrmPage.field(await crm.recordText('Accounts', accountId), 'Account Name'), 'The account name is kept').toBe(accountName);
    expect((await crm.find('Accounts', row['Company'])).length, 'No account is made from the prospect company').toBe(0);
  });

  test('Account: 3 Contact exists with no account', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Account > 3');
    const contactId = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.account }]);
    await sendAndClick({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    expect(await crm.waitForRecord('Accounts', row['Company']), `No Zoho account named ${row['Company']}`).toBeTruthy();
    await untilPasses('the contact is linked to the account', async () => {
      expect(ZohoCrmPage.field(await crm.recordText('Contacts', contactId), 'Account Name')).toBe(row['Company']);
    }, 120_000);
  });

  test('Account: 4 Prospect has no company', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Account > 4', { Company: '' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.account }]);
    await sendAndClick({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    // Zoho needs an Account Name, so nothing is made. Only the contact side is checked here: an account
    // made from no company has no name to search for, and other sessions add accounts in this org at the same time.
    expect(await crm.waitForRecord('Contacts', row['Email'], 60_000), 'No contact may be created').toBeUndefined();
  });

  // ---- Create/Update a Deal ----

  test('Deal: 1 Prospect not in Zoho, has a company, Closing date 0', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Deal > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '0' }]);
    await sendAndClick({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    const found = await crm.waitForRecord('Deals', fullName(row));
    expect(found, `No Zoho deal named ${fullName(row)}`).toBeTruthy();
    const text = await crm.recordText('Deals', found!.id);
    expect(ZohoCrmPage.field(text, 'Deal Name')).toBe(fullName(row));
    expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
    expect(ZohoCrmPage.field(text, 'Stage')).toBe('Qualification');
    expect(ZohoCrmPage.field(text, 'Closing Date')).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(emptyField(text, 'Contact Name', 'Modified By'), 'Contact Name is empty').toBe(true);
    expect(ZohoCrmPage.noteCount(text)).toBeGreaterThanOrEqual(1);
    expect((await crm.find('Deals', fullName(row))).length, 'One click must make one deal').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The Deal action must not create a contact').toBe(0);
    // Z-5 (known): the deal also makes an account named after the company.
    expect(await crm.waitForRecord('Accounts', row['Company'], 30_000)).toBeTruthy();
  });

  test('Deal: 2 Contact has 2 deals, Closing date 0', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Deal > 2');
    const forms = new ZohoForms(crm);
    await forms.createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    const olderId = await forms.createDeal({ name: `Older Deal ${stamp} ${row['Last Name']}`, closing: inDays(30), contact: fullName(row), amount: '100' });
    const newerId = await forms.createDeal({ name: `Newer Deal ${stamp} ${row['Last Name']}`, closing: inDays(30), contact: fullName(row), amount: '200' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '0' }]);
    await sendAndClick({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    await untilPasses('the newest deal is updated', async () => {
      const text = await crm.recordText('Deals', newerId);
      expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
      expect(ZohoCrmPage.noteCount(text)).toBeGreaterThanOrEqual(1);
    }, 120_000);
    const older = await crm.recordText('Deals', olderId);
    expect(ZohoCrmPage.field(older, 'Amount'), 'The older deal is unchanged').toContain('100.00');
    expect(ZohoCrmPage.noteCount(older)).toBe(0);
  });

  test('Deal: 3 Prospect not in Zoho, Closing date 6', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Deal > 3');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '6' }]);
    await sendAndClick({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    const found = await crm.waitForRecord('Deals', fullName(row));
    expect(found, `No Zoho deal named ${fullName(row)}`).toBeTruthy();
    expect(ZohoCrmPage.field(await crm.recordText('Deals', found!.id), 'Closing Date')).toBe(inDays(6));
    expect((await crm.find('Deals', fullName(row))).length, 'One click must make one deal').toBe(1);
  });

  test('Deal: 4 Existing deal with Stage changed by hand', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Deal > 4');
    const forms = new ZohoForms(crm);
    await forms.createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    const dealId = await forms.createDeal({ name: `Staged Deal ${stamp} ${row['Last Name']}`, closing: inDays(30), contact: fullName(row), amount: '100', stage: 'Needs Analysis' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '0' }]);
    await sendAndClick({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    await untilPasses('the deal is updated', async () => {
      const text = await crm.recordText('Deals', dealId);
      expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
      expect(ZohoCrmPage.noteCount(text)).toBeGreaterThanOrEqual(1);
    }, 120_000);
    expect(ZohoCrmPage.field(await crm.recordText('Deals', dealId), 'Stage'), 'The Stage set by hand is kept').toBe('Needs Analysis');
  });

  // ---- Create a Task ----

  test('Task: 1 Prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Task > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.task, task: TASK }]);
    await sendAndClick({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    const found = await crm.waitForRecord('Tasks', fullName(row));
    expect(found, `No Zoho task for ${fullName(row)}`).toBeTruthy();
    const text = await crm.recordText('Tasks', found!.id);
    expect(ZohoCrmPage.field(text, 'Subject')).toBe(TASK.subject);
    expect(ZohoCrmPage.field(text, 'Status')).toBe(TASK.status);
    expect(ZohoCrmPage.field(text, 'Priority')).toBe(TASK.priority);
    expect(ZohoCrmPage.field(text, 'Due Date')).toBe(inDays(3));
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    expect(clickNotes(text)).toBeGreaterThanOrEqual(1);
    expect((await crm.find('Tasks', fullName(row))).length, 'One click must make one task').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length).toBe(1);
  });

  test('Task: 2 Contact exists', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Task > 2');
    const contactId = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.task, task: TASK }]);
    await sendAndClick({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    const found = await crm.waitForRecord('Tasks', fullName(row));
    expect(found, `No Zoho task for ${fullName(row)}`).toBeTruthy();
    expect(ZohoCrmPage.field(await crm.recordText('Tasks', found!.id), 'Contact Name')).toBe(fullName(row));
    expect((await crm.find('Tasks', fullName(row))).length, 'One click must make one task').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'Still one contact').toEqual([contactId]);
  });

  // AL-4198 (fixed): Extra Configuration no longer saves an empty Subject, so Save stays disabled. The Contact action
  // is saved first, so the run still has something to do. The Task is never saved.
  test('Task: 3 Subject left empty', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Task > 3');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await zohoIntegration.selectActivity(TRIGGER, ZOHO_ACTION.task);
    const dialog = saleshandyPage.getByRole('dialog');
    await dialog.waitFor();
    await dialog.getByRole('textbox').first().fill('');
    await expect(dialog.getByRole('button', { name: 'Save', exact: true }), 'Save stays disabled for an empty Subject').toBeDisabled();
    await saleshandyPage.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    await sendAndClick({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    expect(await crm.waitForRecord('Contacts', row['Email']), `No Zoho contact for ${row['Email']}`).toBeTruthy();
    expect(await crm.waitForRecord('Tasks', fullName(row), 30_000), 'No task may be created').toBeUndefined();
  });

  // ---- Combined actions ----

  test('Combined: 1 Contact, Lead, Account, Deal and Task, prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Combined > 1');
    await configureWaiting(zohoIntegration, saleshandyPage, TRIGGER, [
      { action: ZOHO_ACTION.contact },
      { action: ZOHO_ACTION.lead },
      { action: ZOHO_ACTION.account },
      { action: ZOHO_ACTION.deal, closingDays: '0' },
      { action: ZOHO_ACTION.task, task: TASK },
    ]);
    await sendAndClick({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    expect(await crm.waitForRecord('Contacts', row['Email']), `No Zoho contact for ${row['Email']}`).toBeTruthy();
    expect((await crm.find('Contacts', row['Email'])).length, 'One click must make one contact').toBe(1);
    expect((await crm.find('Leads', row['Email'])).length, 'The lead').toBe(1);
    expect((await crm.find('Deals', fullName(row))).length, 'The deal').toBe(1);
    expect((await crm.find('Tasks', fullName(row))).length, 'The task').toBe(1);
    // Accounts: Z-5 (known) allows more than one, so they are not counted.
  });

  test('Combined: 2 Contact and Deal, "Sequence Email is Opened" also on, prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, saleshandySequenceBuilder, mailinator, crm }) => {
    test.skip(process.env.ZOHO_LC_WITH_OPENED !== '1', 'Set ZOHO_LC_WITH_OPENED=1 when no Email Opened session runs: this row overwrites the actions saved on that trigger');
    const row = prospect('Combined > 2');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }, { action: ZOHO_ACTION.deal, closingDays: '0' }]);
    await configure(zohoIntegration, saleshandyPage, OPENED_TRIGGER, [{ action: ZOHO_ACTION.contact }, { action: ZOHO_ACTION.deal, closingDays: '0' }]);
    await saleshandySequenceBuilder.goto(`/sequence/${SEQUENCE_ID}/steps`);
    await saleshandySequenceBuilder.setSafetySetting('Track email opens', true);
    try {
      await sendStep(saleshandySequence, SEQUENCE_ID, row);
      await mailinator.openEmail(row['Email'], STEP_1_SUBJECT);
      const deal = await crm.waitForRecord('Deals', fullName(row));
      expect(deal, `No Zoho deal for ${fullName(row)}`).toBeTruthy();
      await clickLink(saleshandySequence, mailinator, SEQUENCE_ID, row);
      await untilPasses('the deal is linked to the contact', async () => {
        expect(ZohoCrmPage.field(await crm.recordText('Deals', deal!.id), 'Contact Name')).toBe(fullName(row));
      }, 180_000);
      expect((await crm.find('Contacts', row['Email'])).length, 'Still one contact').toBe(1);
    } finally {
      // The saved actions on the Opened trigger cannot be restored (Extra Configuration is not read back).
      await saleshandySequenceBuilder.goto(`/sequence/${SEQUENCE_ID}/steps`);
      await saleshandySequenceBuilder.setSafetySetting('Track email opens', false);
      await zohoIntegration.openTriggers();
      await zohoIntegration.turnOff(OPENED_TRIGGER);
      await zohoIntegration.save();
      await zohoIntegration.savedToast().waitFor({ timeout: 20_000 });
    }
  });
});
