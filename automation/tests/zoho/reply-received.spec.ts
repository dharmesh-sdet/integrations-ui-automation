// Scenarios: test-cases/zoho/reply-received.md (Regression, 34 rows, QA "looks good" 2026-10-29, no ticket per row).
// One test per row, named "<section>: <n>". Written so far: the rows whose prospect is not in Zoho first
// (no records made by hand). Rows that need a Zoho record first, second reply, empty mapping, trigger off
// and the real reply are still to write.
// Data: test-data/zoho/reply-received.csv, one prospect per row, found by the Scenario column.
// Sequence: "Zoho Reply Received QA" on notemailsentzoho, 2 steps, sender Rachel 10 (id 197387, ZOHO_REPLY_SEQUENCE_ID).
// Zoho CRM is read in a headed browser on the saved profile, so run it through xvfb-run (see package.json
// `test:zoho-reply-received`). Close any MCP Zoho window first, the profile cannot be open twice.
//
// How a row runs: set the trigger (only "Reply is Received in Saleshandy" on) and its actions, add the prospect,
// send step 1, Mark as Replied. Then look in Zoho 15 s later, every 10 s after that (QA). Logs are not used for
// Zoho (QA 2026-10-29). Rows do not delete what they create. Known issues are recorded, not filed (Z-1, Z-5).
import path from 'node:path';
import { expect, test as base } from '../../src/fixtures/index.ts';
import { ZOHO_FIELD_MAPPING } from '../../src/config/zoho-field-mapping.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { ZOHO_ACTION, configure, fullName, replyAgain, sendAndReply, type TaskConfig } from '../../src/flows/saleshandy-to-zoho.ts';
import { ZohoCrmPage, openZohoProfile } from '../../src/pages/zoho/zoho-crm.page.ts';

const CSV = 'zoho/reply-received.csv';
const TRIGGER = 'Reply is Received in Saleshandy';
const SEQUENCE_ID = process.env.ZOHO_REPLY_SEQUENCE_ID ?? '197387';
const PROFILE = path.resolve(import.meta.dirname, '../../auth/mcp-zoho-not-email-sent-profile');
const TASK_SUBJECT = 'Follow up after reply';
const GMAIL = process.env.ZOHO_REPLY_GMAIL;
const NOTE_TITLE = 'Saleshandy Reply Received On Sequence Email';

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
test.use({ account: 'notemailsentzoho' });

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

test.describe('Zoho Reply Received (staging)', () => {
  test.setTimeout(8 * 60_000);

  test('Contact: 1 Prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
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

  test('Contact: 5 Prospect has no last name', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 5', { 'Last Name': '' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    // Zoho needs a Last Name, so no contact appears (QA 2026-10-29).
    expect(await crm.waitForRecord('Contacts', row['Email'], 60_000)).toBeUndefined();
  });

  test('Lead: 1 Prospect not in Zoho, has a company', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Lead > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.lead }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Leads', row['Email']);
    expect(found, `No Zoho lead for ${row['Email']}`).toBeTruthy();
    const text = await crm.recordText('Leads', found!.id);
    expect(ZohoCrmPage.field(text, 'Company')).toBe(row['Company']);
    for (const value of [row['Job Title'], row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(ZohoCrmPage.noteCount(text)).toBe(1);
  });

  test('Lead: 4 Prospect has no company', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Lead > 4', { Company: '' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.lead }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Leads', row['Email']);
    expect(found, `No Zoho lead for ${row['Email']}`).toBeTruthy();
    const text = await crm.recordText('Leads', found!.id);
    expect(ZohoCrmPage.field(text, 'Company')).toBe('');
    expect(ZohoCrmPage.noteCount(text)).toBe(1);
  });

  test('Lead: 5 Company Size "11-50" mapped to No. of Employees (Z-1)', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Lead > 5');
    expect(row['Company Size']).toBe('11-50');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.lead }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    // Z-1: Zoho rejects the whole record. Recorded, not filed.
    expect(await crm.waitForRecord('Leads', row['Email'], 60_000)).toBeUndefined();
  });

  test('Account: 1 Prospect not in Zoho, no contact, has a company', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Account > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.account }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Accounts', row['Company']);
    expect(found, `No Zoho account named ${row['Company']}`).toBeTruthy();
    const text = await crm.recordText('Accounts', found!.id);
    expect(ZohoCrmPage.field(text, 'Account Name')).toBe(row['Company']);
    expect(ZohoCrmPage.noteCount(text)).toBe(1);
    expect((await crm.find('Accounts', row['Company'])).length).toBe(1);
  });

  const task = (over: Partial<TaskConfig> = {}): TaskConfig => ({ subject: TASK_SUBJECT, status: 'Not Started', priority: 'Normal', dueIn: '3', ...over });
  const split = (row: Row) => ({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });

  // ---- Trigger behavior ----

  test('Trigger behavior: 1 Trigger on', async ({ zohoIntegration, saleshandyPage }) => {
    // configure() waits for "Configuration Updated Successfully" after Save.
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
  });

  test('Trigger behavior: 2 Trigger off', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Trigger behavior > 2');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await zohoIntegration.disable(TRIGGER);
    await zohoIntegration.save();
    await zohoIntegration.savedToast().waitFor({ timeout: 20_000 });
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    expect(await crm.waitForRecord('Contacts', row['Email'], 60_000)).toBeUndefined();
  });

  // ---- Create/Update a Contact ----

  test('Contact: 2 Contact with the same email exists, different Title', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 2');
    const id = await crm.createContact({ ...split(row), title: 'Old Title' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const text = await crm.waitForNotes('Contacts', id, 1);
    expect(ZohoCrmPage.noteCount(text)).toBe(1);
    // Proposed, unconfirmed: the update replaces the Title with the prospect's value.
    expect(ZohoCrmPage.field(text, 'Title')).toBe(row['Job Title']);
    expect((await crm.find('Contacts', row['Email'])).length).toBe(1);
  });

  test('Contact: 3 Second reply from the same prospect', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 3');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Contacts', row['Email']);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    await replyAgain(saleshandySequence, SEQUENCE_ID, row);
    const text = await crm.waitForNotes('Contacts', found!.id, 2);
    expect(ZohoCrmPage.noteCount(text)).toBe(2);
    expect((await crm.find('Contacts', row['Email'])).length).toBe(1);
  });

  test('Contact: 4 Prospect has no phone, Zoho contact has one', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 4', { 'Phone Number': '' });
    const zohoPhone = '+1 555-0100-4444';
    const id = await crm.createContact({ ...split(row), phone: zohoPhone });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const text = await crm.waitForNotes('Contacts', id, 1);
    // Proposed, unconfirmed: an empty prospect phone does not clear the Zoho phone.
    expect(phoneDigits(text)).toContain(phoneDigits(zohoPhone));
  });

  test('Contact: 6 Zoho contact has the email in other letter case', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 6');
    const id = await crm.createContact({ ...split(row), email: row['Email'].toUpperCase() });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const text = await crm.waitForNotes('Contacts', id, 1);
    // Proposed, unconfirmed: the contact is updated, not duplicated.
    expect(ZohoCrmPage.noteCount(text)).toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length).toBe(1);
  });

  // ---- Create/Update a Lead ----

  test('Lead: 2 Lead with the same email exists', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Lead > 2');
    const id = await crm.createLead({ ...split(row), company: row['Company'] || 'Hand Made Co' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.lead }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const text = await crm.waitForNotes('Leads', id, 1);
    expect(ZohoCrmPage.noteCount(text)).toBe(1);
    expect((await crm.find('Leads', row['Email'])).length).toBe(1);
  });

  test('Lead: 3 Second reply from the same prospect', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Lead > 3');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.lead }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Leads', row['Email']);
    expect(found, `No Zoho lead for ${row['Email']}`).toBeTruthy();
    await replyAgain(saleshandySequence, SEQUENCE_ID, row);
    expect(ZohoCrmPage.noteCount(await crm.waitForNotes('Leads', found!.id, 2))).toBe(2);
    expect((await crm.find('Leads', row['Email'])).length).toBe(1);
  });

  // ---- Create/Update Account ----

  test('Account: 2 Contact has the account "Orion Freight", prospect company is "Orion Freight Ltd"', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const base = `Orion Freight ${stamp}`;
    const row = prospect('Account > 2', { Company: `${base} Ltd` });
    const accountId = await crm.createAccount(base);
    await crm.createContact({ ...split(row), account: base });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.account }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const text = await crm.waitForNotes('Accounts', accountId, 1);
    expect(ZohoCrmPage.field(text, 'Account Name')).toBe(base);
    expect(ZohoCrmPage.noteCount(text)).toBe(1);
    expect((await crm.find('Accounts', row['Company'])).length).toBe(0);
    expect((await crm.find('Accounts', base)).length).toBe(1);
  });

  test('Account: 3 Contact exists, no account', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Account > 3');
    const contactId = await crm.createContact(split(row));
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.account }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const account = await crm.waitForRecord('Accounts', row['Company']);
    expect(account, `No Zoho account named ${row['Company']}`).toBeTruthy();
    expect(ZohoCrmPage.field(await crm.recordText('Contacts', contactId), 'Account Name')).toBe(row['Company']);
  });

  test('Account: 4 Account with the same name exists, no contact', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Account > 4');
    const id = await crm.createAccount(row['Company']);
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.account }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    expect(ZohoCrmPage.noteCount(await crm.waitForNotes('Accounts', id, 1))).toBe(1);
    expect((await crm.find('Accounts', row['Company'])).length).toBe(1);
  });

  // ---- Create/Update a Deal ----
  // A deal has no email or name to search by, so the run's deal is the first one that was not in the list before.

  test('Deal: 1 Prospect not in Zoho, Closing date 7', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Deal > 1');
    const before = await crm.ids('Deals');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '7' }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const deal = await crm.waitForNewRecord('Deals', before);
    expect(deal, 'No new Zoho deal').toBeTruthy();
    const text = await crm.recordText('Deals', deal!.id);
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe('');
    expect(phoneDigits(ZohoCrmPage.field(text, 'Amount'))).toContain(phoneDigits(row['Deal Value']));
    expect(ZohoCrmPage.field(text, 'Closing Date')).toMatch(ZohoCrmPage.dateText(7));
  });

  test('Deal: 2 Contact exists, has no deal', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Deal > 2');
    await crm.createContact(split(row));
    const before = await crm.ids('Deals');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '7' }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const deal = await crm.waitForNewRecord('Deals', before);
    expect(deal, 'No new Zoho deal').toBeTruthy();
    expect(ZohoCrmPage.field(await crm.recordText('Deals', deal!.id), 'Contact Name')).toBe(fullName(row));
  });

  test('Deal: 3 Contact has 1 deal', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Deal > 3');
    const before = await crm.ids('Deals');
    // Reply 1 makes the contact and its linked deal. Reply 2 runs the Deal action alone.
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }, { action: ZOHO_ACTION.deal, closingDays: '3' }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const deal = await crm.waitForNewRecord('Deals', before);
    expect(deal, 'No Zoho deal after reply 1').toBeTruthy();
    const afterFirst = await crm.ids('Deals');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '9' }]);
    await replyAgain(saleshandySequence, SEQUENCE_ID, row);
    expect(await crm.waitForNewRecord('Deals', afterFirst, 60_000), 'A second deal was made').toBeUndefined();
    expect(ZohoCrmPage.field(await crm.recordText('Deals', deal!.id), 'Closing Date')).toMatch(ZohoCrmPage.dateText(9));
  });

  test('Deal: 4 Contact has 2 deals', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Deal > 4');
    const before = await crm.ids('Deals');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }, { action: ZOHO_ACTION.deal, closingDays: '3' }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const older = await crm.waitForNewRecord('Deals', before);
    expect(older, 'No Zoho deal after reply 1').toBeTruthy();
    const newerId = await crm.createDeal({ name: `Second deal ${stamp}`, closingDate: ZohoCrmPage.dateInput(30), contact: fullName(row) });
    const afterSecond = await crm.ids('Deals');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '9' }]);
    await replyAgain(saleshandySequence, SEQUENCE_ID, row);
    expect(await crm.waitForNewRecord('Deals', afterSecond, 60_000), 'A third deal was made').toBeUndefined();
    expect(ZohoCrmPage.field(await crm.recordText('Deals', newerId), 'Closing Date')).toMatch(ZohoCrmPage.dateText(9));
    expect(ZohoCrmPage.field(await crm.recordText('Deals', older!.id), 'Closing Date')).toMatch(ZohoCrmPage.dateText(3));
  });

  test('Deal: 5 Stage changed by hand to Negotiation/Review', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Deal > 5');
    const before = await crm.ids('Deals');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }, { action: ZOHO_ACTION.deal, closingDays: '3' }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const deal = await crm.waitForNewRecord('Deals', before);
    expect(deal, 'No Zoho deal after reply 1').toBeTruthy();
    await crm.setDealStage(deal!.id, 'Negotiation/Review');
    expect(ZohoCrmPage.field(await crm.recordText('Deals', deal!.id), 'Stage')).toBe('Negotiation/Review');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '9' }]);
    await replyAgain(saleshandySequence, SEQUENCE_ID, row);
    const text = await crm.waitForNotes('Deals', deal!.id, 2);
    expect(ZohoCrmPage.field(text, 'Stage')).toBe('Negotiation/Review');
  });

  test('Deal: 6 Closing date left empty', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Deal > 6');
    const before = await crm.ids('Deals');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '' }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const deal = await crm.waitForNewRecord('Deals', before);
    expect(deal, 'No new Zoho deal').toBeTruthy();
    expect(ZohoCrmPage.field(await crm.recordText('Deals', deal!.id), 'Closing Date')).toBe('');
  });

  // ---- Create a Task ----
  // A task has no email or name to search by either, so the run's task is the first one that was not in the list before.

  test('Task: 1 Prospect not in Zoho, due in 3 days', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Task > 1');
    const before = await crm.ids('Tasks');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.task, task: task() }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const contact = await crm.waitForRecord('Contacts', row['Email']);
    expect(contact, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    expect(ZohoCrmPage.noteCount(await crm.waitForNotes('Contacts', contact!.id, 1))).toBe(1);
    const found = await crm.waitForNewRecord('Tasks', before);
    expect(found, 'No new Zoho task').toBeTruthy();
    const text = await crm.recordText('Tasks', found!.id);
    expect(ZohoCrmPage.field(text, 'Subject')).toBe(TASK_SUBJECT);
    expect(ZohoCrmPage.field(text, 'Status')).toBe('Not Started');
    expect(ZohoCrmPage.field(text, 'Priority')).toBe('Normal');
    expect(ZohoCrmPage.field(text, 'Due Date')).toMatch(ZohoCrmPage.dateText(3));
    expect(text).toContain(fullName(row));
  });

  test('Task: 2 Contact exists', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Task > 2');
    const contactId = await crm.createContact(split(row));
    const before = await crm.ids('Tasks');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.task, task: task() }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForNewRecord('Tasks', before);
    expect(found, 'No new Zoho task').toBeTruthy();
    expect(await crm.recordText('Tasks', found!.id)).toContain(fullName(row));
    expect(ZohoCrmPage.noteCount(await crm.waitForNotes('Contacts', contactId, 1))).toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length).toBe(1);
  });

  test('Task: 3 Status Completed, Priority Highest', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Task > 3');
    const before = await crm.ids('Tasks');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.task, task: task({ status: 'Completed', priority: 'Highest' }) }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForNewRecord('Tasks', before);
    expect(found, 'No new Zoho task').toBeTruthy();
    const text = await crm.recordText('Tasks', found!.id);
    expect(ZohoCrmPage.field(text, 'Status')).toBe('Completed');
    expect(ZohoCrmPage.field(text, 'Priority')).toBe('Highest');
  });

  test('Task: 4 Subject empty', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Task > 4');
    const before = await crm.ids('Tasks');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.task, task: task({ subject: '' }) }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    // The run completes and the contact is still made, but there is no task and no task note.
    expect(await crm.waitForRecord('Contacts', row['Email']), `No Zoho contact for ${row['Email']}`).toBeTruthy();
    expect(await crm.waitForNewRecord('Tasks', before, 60_000), 'A task was made').toBeUndefined();
  });

  test('Task: 5 Due In empty', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Task > 5');
    const before = await crm.ids('Tasks');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.task, task: task({ dueIn: '' }) }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const contact = await crm.waitForRecord('Contacts', row['Email']);
    expect(contact, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    expect(ZohoCrmPage.noteCount(await crm.waitForNotes('Contacts', contact!.id, 1))).toBe(1);
    const found = await crm.waitForNewRecord('Tasks', before);
    expect(found, 'No new Zoho task').toBeTruthy();
    expect(ZohoCrmPage.field(await crm.recordText('Tasks', found!.id), 'Due Date')).toBe('');
  });

  // ---- Combined actions ----

  test('Combined: 1 Contact, Deal and Task, prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Combined > 1');
    const dealsBefore = await crm.ids('Deals');
    const tasksBefore = await crm.ids('Tasks');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }, { action: ZOHO_ACTION.deal, closingDays: '7' }, { action: ZOHO_ACTION.task, task: task() }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const contact = await crm.waitForRecord('Contacts', row['Email']);
    expect(contact, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    const deal = await crm.waitForNewRecord('Deals', dealsBefore);
    const taskRecord = await crm.waitForNewRecord('Tasks', tasksBefore);
    expect(deal, 'No new Zoho deal').toBeTruthy();
    expect(taskRecord, 'No new Zoho task').toBeTruthy();
    expect(ZohoCrmPage.noteCount(await crm.waitForNotes('Contacts', contact!.id, 1))).toBe(1);
    const dealText = await crm.recordText('Deals', deal!.id);
    expect(ZohoCrmPage.field(dealText, 'Contact Name')).toBe(fullName(row));
    expect(ZohoCrmPage.noteCount(dealText)).toBe(1);
    const taskText = await crm.recordText('Tasks', taskRecord!.id);
    expect(taskText).toContain(fullName(row));
    expect(ZohoCrmPage.noteCount(taskText)).toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length).toBe(1);
  });

  test('Combined: 2 Lead and Contact, prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Combined > 2');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.lead }, { action: ZOHO_ACTION.contact }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const lead = await crm.waitForRecord('Leads', row['Email']);
    const contact = await crm.waitForRecord('Contacts', row['Email']);
    expect(lead, `No Zoho lead for ${row['Email']}`).toBeTruthy();
    expect(contact, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    expect(ZohoCrmPage.noteCount(await crm.waitForNotes('Leads', lead!.id, 1))).toBe(1);
    expect(ZohoCrmPage.noteCount(await crm.waitForNotes('Contacts', contact!.id, 1))).toBe(1);
    expect((await crm.find('Leads', row['Email'])).length).toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length).toBe(1);
  });

  test('Combined: 3 Contact and Account, prospect has a company', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Combined > 3');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }, { action: ZOHO_ACTION.account }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const contact = await crm.waitForRecord('Contacts', row['Email']);
    const account = await crm.waitForRecord('Accounts', row['Company']);
    expect(contact, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    expect(account, `No Zoho account named ${row['Company']}`).toBeTruthy();
    expect(ZohoCrmPage.field(await crm.recordText('Contacts', contact!.id), 'Account Name')).toBe(row['Company']);
    expect((await crm.find('Accounts', row['Company'])).length).toBe(1);
  });

  test('Combined: 4 All 5 actions, contact, account and deal already exist', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Combined > 4');
    const accountId = await crm.createAccount(row['Company']);
    const contactId = await crm.createContact({ ...split(row), account: row['Company'] });
    const dealId = await crm.createDeal({ name: `Existing deal ${stamp}`, closingDate: ZohoCrmPage.dateInput(30), contact: fullName(row), account: row['Company'] });
    const dealsBefore = await crm.ids('Deals');
    const tasksBefore = await crm.ids('Tasks');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [
      { action: ZOHO_ACTION.contact }, { action: ZOHO_ACTION.lead }, { action: ZOHO_ACTION.account },
      { action: ZOHO_ACTION.deal, closingDays: '7' }, { action: ZOHO_ACTION.task, task: task() },
    ]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const lead = await crm.waitForRecord('Leads', row['Email']);
    expect(lead, `No Zoho lead for ${row['Email']}`).toBeTruthy();
    expect(await crm.waitForNewRecord('Tasks', tasksBefore), 'No new Zoho task').toBeTruthy();
    expect(ZohoCrmPage.noteCount(await crm.waitForNotes('Contacts', contactId, 1))).toBe(1);
    expect(ZohoCrmPage.noteCount(await crm.waitForNotes('Accounts', accountId, 1))).toBe(1);
    expect(ZohoCrmPage.noteCount(await crm.waitForNotes('Deals', dealId, 1))).toBe(1);
    expect(ZohoCrmPage.noteCount(await crm.waitForNotes('Leads', lead!.id, 1))).toBe(1);
    // No duplicates: one contact, one account, and no new deal.
    expect((await crm.find('Contacts', row['Email'])).length).toBe(1);
    expect((await crm.find('Accounts', row['Company'])).length).toBe(1);
    expect(await crm.waitForNewRecord('Deals', dealsBefore, 30_000), 'A new deal was made').toBeUndefined();
  });

  // ---- Real reply ----
  // Sends step 1 to QA's Gmail address, then waits up to 20 min for QA to reply from Gmail. Set ZOHO_REPLY_GMAIL.

  test('Real reply: 1 Contact action, prospect mailbox is the QA Gmail address', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    test.skip(!GMAIL, 'Set ZOHO_REPLY_GMAIL to the QA Gmail address to run this row');
    test.setTimeout(30 * 60_000);
    const row = prospect('Real reply > 1', { Email: GMAIL! });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await saleshandySequence.createAndAddProspect(SEQUENCE_ID, row);
    await saleshandySequence.sendNow(SEQUENCE_ID, fullName(row), 1, row['Email']);
    console.log(`REPLY NOW: reply from ${GMAIL} to the step 1 email of "Zoho Reply Received QA".`);
    await saleshandySequence.waitForReplied(SEQUENCE_ID, fullName(row), 1, row['Email'], 20 * 60_000);
    const found = await crm.waitForRecord('Contacts', row['Email']);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    const text = await crm.recordText('Contacts', found!.id);
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    expect(ZohoCrmPage.noteCount(text)).toBe(1);
  });

  // ---- Contact 7: runs last. It empties the Contact Fields mapping and puts it back in `finally`. ----

  test('Contact: 7 Contact Fields mapping is empty, prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 7');
    const pairs = Object.entries(ZOHO_FIELD_MAPPING['Contact Fields']);
    try {
      await zohoIntegration.openMappingCard('Contact Fields');
      for (const [field] of pairs) await zohoIntegration.unmapField(field);
      await zohoIntegration.save();
      await zohoIntegration.savedToast().waitFor({ timeout: 30_000 });
      await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
      await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
      // Proposed, unconfirmed: the run completes and a contact is made with no mapped fields. Zoho may reject it
      // because Last Name is empty (see Contact 5). If so, record the result and ask QA.
      expect(await crm.waitForRecord('Contacts', row['Email']), `No Zoho contact for ${row['Email']}`).toBeTruthy();
    } finally {
      await zohoIntegration.openMappingCard('Contact Fields');
      for (const [field, zohoField] of pairs) await zohoIntegration.mapField(field, zohoField);
      await zohoIntegration.save();
      await zohoIntegration.savedToast().waitFor({ timeout: 30_000 });
    }
  });
});
