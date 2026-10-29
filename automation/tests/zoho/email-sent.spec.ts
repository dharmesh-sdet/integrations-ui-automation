// Scenarios: test-cases/zoho/email-sent.md (Regression, 24 rows, QA "looks good" 2026-10-29, no ticket per row).
// One test per row, named "<section>: <n>". All 24 rows are written. Run so far: Lead 1 (passes). The rows that
// need a record made by hand first (Lead 2, Contact 3 and 4, Account 2 and 3, Deal 2, 3 and 5, Task 2) make it
// in Zoho with `ZohoForms`, whose lookup and stage locators are not confirmed yet (see zoho-forms.page.ts), and
// Trigger and setup 2 reopens a saved chip with an icon that is not confirmed either.
// Data: test-data/zoho/email-sent.csv (npm run data:zoho-email-sent), one prospect per row, found by the Scenario column.
// Sequence: "Zoho's First Sequence" on gzoho, 3 steps, sender Ritaellis1988+1@gmail.com (id 197383, ZOHO_EMAIL_SENT_SEQUENCE_ID).
// Zoho CRM is read in a headed browser on the saved profile, so run it through xvfb-run (see package.json
// `test:zoho-email-sent`). Close any MCP Zoho window first, the profile cannot be open twice.
//
// How a row runs: set the trigger (only "Email Sent from Saleshandy" on) and its actions, add the prospect,
// send step 1 with Send now. Then look in Zoho 15 s later, every 10 s after that (QA). Logs are not used for
// Zoho (QA 2026-10-29). Rows do not delete what they create. Known issues are recorded, not filed (Z-1, Z-5, Q3).
// On 2026-10-29 a new contact made two Tasks in 2 of 2 runs and two Deals in 1 of 2. The rows expect one
// record, so a repeat shows Fail until QA decides if it is a bug.
import path from 'node:path';
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { ZOHO_ACTION, configure, fullName } from '../../src/flows/saleshandy-to-zoho.ts';
import { NOTE_TITLE, TRIGGER, inDays, noteTitles, sendStep } from '../../src/flows/zoho-email-sent.ts';
import { ZohoCrmPage, openZohoProfile } from '../../src/pages/zoho/zoho-crm.page.ts';
import { ZohoForms } from '../../src/pages/zoho/zoho-forms.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';

const CSV = 'zoho/email-sent.csv';
const SEQUENCE_ID = process.env.ZOHO_EMAIL_SENT_SEQUENCE_ID ?? '197383';
const PROFILE = path.resolve(import.meta.dirname, '../../auth/mcp-zoho-profile');

const test = base.extend<object, { crm: ZohoCrmPage }>({
  crm: [
    async ({}, use) => {
      const { context, crm } = await openZohoProfile(PROFILE);
      await use(crm);
      await context.close();
    },
    { scope: 'worker' },
  ],
});
test.use({ account: 'gzoho' });

// A fresh company name, so a record made by an earlier run never matches.
const stamp = String(Date.now()).slice(-6);

function prospect(scenario: string, override: Record<string, string> = {}): Row {
  const found = readCsv(CSV).find((r) => r['Scenario'] === scenario);
  if (!found) throw new Error(`No row "${scenario}" in test-data/${CSV}`);
  // Twitter in Zoho is a handle, not a URL (Z-1: a wrong-type value makes Zoho reject the whole record).
  const handle = found['Twitter'].split('/').filter(Boolean).pop() ?? '';
  const company = found['Company'] ? `${found['Company']} ${stamp}` : '';
  const row: Row = { ...found, Twitter: handle, Company: company, ...override };
  markUsed(CSV, row['Email']);
  return row;
}

const phoneDigits = (s: string): string => s.replace(/\D/g, '');
const TASK = { subject: 'Follow up after step 1', status: 'Not Started', priority: 'Normal', dueIn: '3' };

test.describe('Zoho Email Sent (staging)', () => {
  test.setTimeout(8 * 60_000);

  test('Lead: 1 Prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Lead > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.lead }]);
    await sendStep(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Leads', row['Email']);
    expect(found, `No Zoho lead for ${row['Email']}`).toBeTruthy();
    const text = await crm.recordText('Leads', found!.id);
    expect(ZohoCrmPage.field(text, 'Company')).toBe(row['Company']);
    for (const value of [row['Job Title'], row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(ZohoCrmPage.noteCount(text)).toBe(1);
    expect(text).toContain(NOTE_TITLE);
    expect((await crm.find('Leads', row['Email'])).length).toBe(1);
  });

  test('Lead: 3 Prospect has no company', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Lead > 3', { Company: '' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.lead }]);
    await sendStep(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Leads', row['Email']);
    expect(found, `No Zoho lead for ${row['Email']}`).toBeTruthy();
    const text = await crm.recordText('Leads', found!.id);
    expect(ZohoCrmPage.field(text, 'Company')).toBe('');
    expect(ZohoCrmPage.noteCount(text)).toBe(1);
  });

  test('Contact: 1 Prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await sendStep(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Contacts', row['Email']);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    const text = await crm.recordText('Contacts', found!.id);
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    for (const value of [row['Job Title'], row['Department'], row['Twitter'], row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(phoneDigits(text)).toContain(phoneDigits(row['Phone Number']));
    expect(ZohoCrmPage.noteCount(text)).toBe(1);
    expect(text).toContain(NOTE_TITLE);
    expect((await crm.find('Contacts', row['Email'])).length).toBe(1);
  });

  test('Contact: 2 Prospect has no Phone Number', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 2', { 'Phone Number': '' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await sendStep(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Contacts', row['Email']);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    const text = await crm.recordText('Contacts', found!.id);
    expect(ZohoCrmPage.field(text, 'Phone')).toBe('');
    for (const value of [row['Job Title'], row['Department'], row['Twitter'], row['City'], row['State'], row['Country']]) expect(text).toContain(value);
  });

  test('Contact: 5 Same prospect, step 2 email', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 5');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await sendStep(saleshandySequence, SEQUENCE_ID, row, 1);
    const first = await crm.waitForRecord('Contacts', row['Email']);
    expect(first, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    expect(ZohoCrmPage.noteCount(await crm.recordText('Contacts', first!.id))).toBe(1);
    await sendStep(saleshandySequence, SEQUENCE_ID, row, 2);
    await untilPasses('the second note on the contact', async () => {
      expect(ZohoCrmPage.noteCount(await crm.recordText('Contacts', first!.id))).toBe(2);
    }, 120_000);
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id)).toEqual([first!.id]);
  });

  test('Account: 1 Prospect has a company, no contact, no account', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Account > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.account }]);
    await sendStep(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Accounts', row['Company']);
    expect(found, `No Zoho account named ${row['Company']}`).toBeTruthy();
    const text = await crm.recordText('Accounts', found!.id);
    expect(ZohoCrmPage.field(text, 'Account Name')).toBe(row['Company']);
    for (const value of [row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(ZohoCrmPage.noteCount(text)).toBe(1);
    expect((await crm.find('Accounts', row['Company'])).length).toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The Account action must not create a contact').toBe(0);
  });

  test('Account: 4 Prospect has no company', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Account > 4', { Company: '' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.account }]);
    await sendStep(saleshandySequence, SEQUENCE_ID, row);
    // Zoho needs an Account Name, so nothing is made. Only the contact side is checked here: an account
    // made from no company has no name to search for, and other sessions add accounts in this org at the same time.
    expect(await crm.waitForRecord('Contacts', row['Email'], 60_000), 'No contact may be created').toBeUndefined();
  });

  test('Deal: 1 Prospect not in Zoho, has a company, Closing date 0', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Deal > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '0' }]);
    await sendStep(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Deals', fullName(row));
    expect(found, `No Zoho deal named ${fullName(row)}`).toBeTruthy();
    const text = await crm.recordText('Deals', found!.id);
    expect(ZohoCrmPage.field(text, 'Deal Name')).toBe(fullName(row));
    expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
    expect(ZohoCrmPage.field(text, 'Stage')).toBe('Qualification');
    expect(ZohoCrmPage.field(text, 'Closing Date')).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe('');
    expect(ZohoCrmPage.noteCount(text)).toBe(1);
    expect((await crm.find('Deals', fullName(row))).length, 'One event must make one deal').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The Deal action must not create a contact').toBe(0);
    // Z-5 (known): the deal also makes an account named after the company.
    expect(await crm.waitForRecord('Accounts', row['Company'], 30_000)).toBeTruthy();
  });

  test('Deal: 4 Prospect not in Zoho, Closing date 7', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Deal > 4');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '7' }]);
    await sendStep(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Deals', fullName(row));
    expect(found, `No Zoho deal named ${fullName(row)}`).toBeTruthy();
    const text = await crm.recordText('Deals', found!.id);
    expect(ZohoCrmPage.field(text, 'Closing Date')).toBe(inDays(7));
    expect((await crm.find('Deals', fullName(row))).length, 'One event must make one deal').toBe(1);
  });

  test('Task: 1 Prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Task > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.task, task: TASK }]);
    await sendStep(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Tasks', fullName(row));
    expect(found, `No Zoho task for ${fullName(row)}`).toBeTruthy();
    const text = await crm.recordText('Tasks', found!.id);
    expect(ZohoCrmPage.field(text, 'Subject')).toBe(TASK.subject);
    expect(ZohoCrmPage.field(text, 'Status')).toBe(TASK.status);
    expect(ZohoCrmPage.field(text, 'Priority')).toBe(TASK.priority);
    expect(ZohoCrmPage.field(text, 'Due Date')).toBe(inDays(3));
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    expect(noteTitles(text)).toBe(1);
    expect((await crm.find('Tasks', fullName(row))).length, 'One event must make one task').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length).toBe(1);
  });

  test('Task: 3 Subject left empty', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Task > 3');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.task, task: { ...TASK, subject: '' } }]);
    await sendStep(saleshandySequence, SEQUENCE_ID, row);
    // The run's own end state (Success or Error) is in Logs, which Zoho rows do not read (QA 2026-10-29).
    expect(await crm.waitForRecord('Tasks', fullName(row), 60_000), 'No task may be created').toBeUndefined();
  });

  test('Combined: 1 Contact, Lead, Account, Deal and Task, prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Combined > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [
      { action: ZOHO_ACTION.contact },
      { action: ZOHO_ACTION.lead },
      { action: ZOHO_ACTION.account },
      { action: ZOHO_ACTION.deal, closingDays: '0' },
      { action: ZOHO_ACTION.task, task: TASK },
    ]);
    await sendStep(saleshandySequence, SEQUENCE_ID, row);
    expect(await crm.waitForRecord('Contacts', row['Email']), `No Zoho contact for ${row['Email']}`).toBeTruthy();
    expect((await crm.find('Contacts', row['Email'])).length, 'One event must make one contact').toBe(1);
    expect((await crm.find('Leads', row['Email'])).length, 'The lead').toBe(1);
    expect((await crm.find('Deals', fullName(row))).length, 'The deal').toBe(1);
    expect((await crm.find('Tasks', fullName(row))).length, 'The task').toBe(1);
    // Accounts: Z-5 (known) allows more than one, so they are not counted.
  });

  test('Combined: 2 Contact and Lead, prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Combined > 2');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }, { action: ZOHO_ACTION.lead }]);
    await sendStep(saleshandySequence, SEQUENCE_ID, row);
    expect(await crm.waitForRecord('Contacts', row['Email']), `No Zoho contact for ${row['Email']}`).toBeTruthy();
    expect((await crm.find('Contacts', row['Email'])).length, 'No duplicate contact').toBe(1);
    expect((await crm.find('Leads', row['Email'])).length, 'The lead').toBe(1);
  });

  test('Trigger and setup: 1 Email Sent trigger OFF', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Trigger and setup > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    // Turning another trigger on turns Email Sent off. The action stays saved on Email Sent.
    await zohoIntegration.openTriggers();
    await zohoIntegration.enableOnly('Reply is Received in Saleshandy');
    await zohoIntegration.save();
    await zohoIntegration.savedToast().waitFor({ timeout: 20_000 });
    await sendStep(saleshandySequence, SEQUENCE_ID, row);
    expect(await crm.waitForRecord('Contacts', row['Email'], 60_000), 'Nothing may be created with the trigger off').toBeUndefined();
    expect((await crm.find('Leads', row['Email'])).length).toBe(0);
    // Leave gzoho the way the other rows expect it.
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

  // ---- Rows that need a record made by hand in Zoho first. The record carries the prospect's own name and email. ----

  test('Lead: 2 Lead exists for the prospect email', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Lead > 2');
    const id = await new ZohoForms(crm).createLead({ first: row['First Name'], last: row['Last Name'], email: row['Email'], company: `Old Company ${stamp}` });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.lead }]);
    await sendStep(saleshandySequence, SEQUENCE_ID, row);
    await untilPasses('the lead is updated', async () => {
      const text = await crm.recordText('Leads', id);
      expect(ZohoCrmPage.field(text, 'Company')).toBe(row['Company']);
      expect(ZohoCrmPage.noteCount(text)).toBe(1);
    }, 120_000);
    expect((await crm.find('Leads', row['Email'])).map((r) => r.id), 'Still one lead').toEqual([id]);
  });

  test('Contact: 3 Contact exists with a Phone and Title', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const phone = '+1 555-0100-0003';
    const row = prospect('Contact > 3', { 'Phone Number': '', 'Job Title': '' });
    const id = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'], phone, title: 'Existing Title' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await sendStep(saleshandySequence, SEQUENCE_ID, row);
    await untilPasses('the contact is updated', async () => {
      const text = await crm.recordText('Contacts', id);
      expect(ZohoCrmPage.noteCount(text)).toBe(1);
      expect(text).toContain(row['Department']);
      // The prospect has no Phone or Title, so the Zoho values stay.
      expect(text).toContain('Existing Title');
      expect(phoneDigits(text)).toContain(phoneDigits(phone));
    }, 120_000);
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'Still one contact').toEqual([id]);
  });

  test('Contact: 4 Contact exists, its email in different letter case', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 4');
    const typed = `${row['Email'].split('@')[0].toUpperCase()}@Mailinator.com`;
    const id = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: typed });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await sendStep(saleshandySequence, SEQUENCE_ID, row);
    await untilPasses('the contact is updated', async () => {
      const text = await crm.recordText('Contacts', id);
      expect(ZohoCrmPage.noteCount(text)).toBe(1);
      expect(text).toContain(row['Department']);
    }, 120_000);
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'No second contact').toEqual([id]);
  });

  test('Account: 2 Contact exists and is linked to an account', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Account > 2');
    const accountName = `Linked Account ${stamp}`;
    const accountId = await crm.createAccount(accountName);
    await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'], account: accountName });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.account }]);
    await sendStep(saleshandySequence, SEQUENCE_ID, row);
    await untilPasses('the linked account is updated', async () => {
      const text = await crm.recordText('Accounts', accountId);
      for (const value of [row['City'], row['State'], row['Country']]) expect(text).toContain(value);
      expect(ZohoCrmPage.noteCount(text)).toBe(1);
    }, 120_000);
    expect(ZohoCrmPage.field(await crm.recordText('Accounts', accountId), 'Account Name'), 'The account name is kept').toBe(accountName);
    expect((await crm.find('Accounts', row['Company'])).length, 'No account is made from the prospect company').toBe(0);
  });

  test('Account: 3 Contact exists with no account', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Account > 3');
    const contactId = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.account }]);
    await sendStep(saleshandySequence, SEQUENCE_ID, row);
    expect(await crm.waitForRecord('Accounts', row['Company']), `No Zoho account named ${row['Company']}`).toBeTruthy();
    await untilPasses('the contact is linked to the account', async () => {
      expect(ZohoCrmPage.field(await crm.recordText('Contacts', contactId), 'Account Name')).toBe(row['Company']);
    }, 120_000);
  });

  test('Deal: 2 Contact has 1 deal, Closing date 0', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Deal > 2');
    const forms = new ZohoForms(crm);
    await forms.createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    const dealName = `Old Deal ${stamp} ${row['Last Name']}`;
    const dealId = await forms.createDeal({ name: dealName, closing: inDays(30), contact: fullName(row), amount: '100' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '0' }]);
    await sendStep(saleshandySequence, SEQUENCE_ID, row);
    await untilPasses('the deal is updated', async () => {
      const text = await crm.recordText('Deals', dealId);
      expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
      expect(ZohoCrmPage.noteCount(text)).toBe(1);
    }, 120_000);
    expect((await crm.find('Deals', dealName)).length, 'Still one deal').toBe(1);
  });

  test('Deal: 3 Contact has 2 deals', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Deal > 3');
    const forms = new ZohoForms(crm);
    await forms.createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    const olderId = await forms.createDeal({ name: `Older Deal ${stamp} ${row['Last Name']}`, closing: inDays(30), contact: fullName(row), amount: '100' });
    const newerId = await forms.createDeal({ name: `Newer Deal ${stamp} ${row['Last Name']}`, closing: inDays(30), contact: fullName(row), amount: '200' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '0' }]);
    await sendStep(saleshandySequence, SEQUENCE_ID, row);
    await untilPasses('the newest deal is updated', async () => {
      const text = await crm.recordText('Deals', newerId);
      expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
      expect(ZohoCrmPage.noteCount(text)).toBe(1);
    }, 120_000);
    const older = await crm.recordText('Deals', olderId);
    expect(ZohoCrmPage.field(older, 'Amount'), 'The older deal is unchanged').toContain('100.00');
    expect(ZohoCrmPage.noteCount(older)).toBe(0);
  });

  test('Deal: 5 Existing deal with Stage changed by hand', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Deal > 5');
    const forms = new ZohoForms(crm);
    await forms.createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    const dealId = await forms.createDeal({ name: `Staged Deal ${stamp} ${row['Last Name']}`, closing: inDays(30), contact: fullName(row), amount: '100', stage: 'Needs Analysis' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '0' }]);
    await sendStep(saleshandySequence, SEQUENCE_ID, row);
    await untilPasses('the deal is updated', async () => {
      const text = await crm.recordText('Deals', dealId);
      expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
      expect(ZohoCrmPage.noteCount(text)).toBe(1);
    }, 120_000);
    expect(ZohoCrmPage.field(await crm.recordText('Deals', dealId), 'Stage'), 'The Stage set by hand is kept').toBe('Needs Analysis');
  });

  test('Task: 2 Contact exists', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Task > 2');
    const contactId = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.task, task: TASK }]);
    await sendStep(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Tasks', fullName(row));
    expect(found, `No Zoho task for ${fullName(row)}`).toBeTruthy();
    expect(ZohoCrmPage.field(await crm.recordText('Tasks', found!.id), 'Contact Name')).toBe(fullName(row));
    expect((await crm.find('Tasks', fullName(row))).length, 'One event must make one task').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'Still one contact').toEqual([contactId]);
  });
});
