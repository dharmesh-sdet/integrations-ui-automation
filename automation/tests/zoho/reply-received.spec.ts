// Scenarios: test-cases/zoho/reply-received.md (Regression, 24 rows, QA "looks good" 2026-11-03, no ticket per row).
// One test per row, named "<section>: <n>". Rewritten from scratch on 2026-11-03.
// Known bug AL-4219: the workflow does not start for a reply (Mark as replied or a real Gmail reply). Until it is
// fixed, rows that expect a Zoho record fail on the first check. That is the product result, not a script fault.
// Data: test-data/zoho/reply-received.csv (npm run data:zoho-reply-received), one prospect per row, found by the
// Scenario column. "Trigger behavior > 1" sends nothing. "Real reply > 1" uses ZOHO_REPLY_GMAIL.
// Sequence: "Zoho Reply Received QA" on notemailsentzoho, 2 steps (id 197387, ZOHO_REPLY_SEQUENCE_ID).
// Zoho CRM is read in a headed browser on its own copy of the saved profile (auth/zoho-reply-received-profile), so run
// it through xvfb-run (see package.json `test:zoho-reply-received`). Other Zoho workflows run at the same time on this
// account, each with its own sequence and prospects, so only the Reply trigger is touched (KEEP_OTHER_TRIGGERS).
//
// How a row runs: set the trigger and its actions, make the Zoho records the row needs, add the prospect, send step 1
// with Send now, mark it as replied. Then look in Zoho 15 s later, every 10 s after that (QA). Logs are not used for
// Zoho rows (QA 2026-10-29). Rows do not delete what they create. Known issues are recorded, not filed (Z-1, Z-5, Q3).
// Real reply: set ZOHO_REPLY_GMAIL to a Gmail address. The test sends step 1 to it, then waits up to 20 minutes for
// QA to reply from that inbox. Use the address once per sequence, a prospect cannot be added twice.
import path from 'node:path';
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { ZOHO_ACTION, configure, fullName, replyAgainFromProspects as replyAgain, sendAndReplyFromProspects as sendAndReply } from '../../src/flows/saleshandy-to-zoho.ts';
import { configureWaiting, inDays, sendStep } from '../../src/flows/zoho-email-sent.ts';
import { ZohoCrmPage, openZohoProfile } from '../../src/pages/zoho/zoho-crm.page.ts';
import { ZohoForms } from '../../src/pages/zoho/zoho-forms.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';

process.env.KEEP_OTHER_TRIGGERS ??= '1';

const CSV = 'zoho/reply-received.csv';
const TRIGGER = 'Reply is Received in Saleshandy';
const SEQUENCE_ID = process.env.ZOHO_REPLY_SEQUENCE_ID ?? '197387';
const PROFILE = path.resolve(import.meta.dirname, '../../auth/zoho-reply-received-profile');
const GMAIL = process.env.ZOHO_REPLY_GMAIL;
const NOTE_TITLE = 'Saleshandy Reply Received On Sequence Email';
const TASK = { subject: 'Follow up after reply', status: 'Not Started', priority: 'Normal', dueIn: '3' };

const test = base.extend<object, { crm: ZohoCrmPage }>({
  crm: [
    async ({}, use) => {
      const { context, crm } = await openZohoProfile(PROFILE);
      // Zoho page loads time out now and then (net::ERR_TIMED_OUT, seen 2026-11-02 and 2026-11-03). Retry a load up
      // to 4 times. Local to this spec: ZohoCrmPage.open is shared.
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
// An empty field shows no value in the record text, so ZohoCrmPage.field returns the label on the next line
// (seen 2026-11-02). A field is empty when it reads '' or that next label.
const emptyField = (text: string, label: string, nextLabel: string): boolean => {
  const value = ZohoCrmPage.field(text, label);
  return value === '' || value === nextLabel;
};
const contactOnly = [{ action: ZOHO_ACTION.contact }];

test.describe('Zoho Reply Received (staging)', () => {
  test.setTimeout(15 * 60_000);

  // ---- Trigger behavior ----

  test('Trigger behavior: 1 Trigger on with the Contact action', async ({ zohoIntegration, saleshandyPage }) => {
    // configure() waits for "Configuration Updated Successfully" and throws without it.
    await configure(zohoIntegration, saleshandyPage, TRIGGER, contactOnly);
    await saleshandyPage.reload();
    await zohoIntegration.openTriggers();
    expect(await zohoIntegration.isTriggerOn(TRIGGER)).toBe(true);
    expect(await zohoIntegration.selectedActivities(TRIGGER)).toEqual([ZOHO_ACTION.contact]);
  });

  test('Trigger behavior: 2 Trigger off', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Trigger behavior > 2');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, contactOnly);
    // Only this trigger goes off. The action stays saved on it.
    await zohoIntegration.openTriggers();
    await zohoIntegration.turnOff(TRIGGER);
    await zohoIntegration.save();
    await zohoIntegration.savedToast().waitFor({ timeout: 20_000 });
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    expect(await crm.waitForRecord('Contacts', row['Email'], 60_000), 'Nothing may be created with the trigger off').toBeUndefined();
    // Leave the trigger on, the way the other rows expect it.
    await configure(zohoIntegration, saleshandyPage, TRIGGER, contactOnly);
  });

  // ---- Create/Update a Contact in Zoho ----

  test('Contact: 1 Prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, contactOnly);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Contacts', row['Email']);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    const text = await crm.recordText('Contacts', found!.id);
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    for (const value of [row['Job Title'], row['Department'], row['Twitter'], row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(phoneDigits(text)).toContain(phoneDigits(row['Phone Number']));
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
    expect(text).toContain(NOTE_TITLE);
    expect((await crm.find('Contacts', row['Email'])).length).toBe(1);
  });

  test('Contact: 2 Contact with the same email exists, different Title', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 2');
    const id = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'], title: 'Old Title' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, contactOnly);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    await untilPasses('the contact is updated', async () => {
      const text = await crm.recordText('Contacts', id);
      expect(text).toContain(row['Job Title']);
      expect(text).not.toContain('Old Title');
    }, 120_000);
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'Still one contact').toEqual([id]);
    // Unconfirmed: whether an update adds a note. Recorded, not asserted.
    test.info().annotations.push({ type: 'Notes on the updated contact', description: String(ZohoCrmPage.noteCount(await crm.recordText('Contacts', id))) });
  });

  test('Contact: 3 Second reply from the same prospect', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 3');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, contactOnly);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const first = await crm.waitForRecord('Contacts', row['Email']);
    expect(first, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    await untilPasses('the first note', async () => {
      expect(ZohoCrmPage.noteCount(await crm.recordText('Contacts', first!.id))).toBe(1);
    }, 120_000);
    await replyAgain(saleshandySequence, SEQUENCE_ID, row);
    await untilPasses('the second note', async () => {
      expect(ZohoCrmPage.noteCount(await crm.recordText('Contacts', first!.id))).toBe(2);
    }, 180_000);
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'Still one contact').toEqual([first!.id]);
  });

  test('Contact: 4 Prospect has no phone, Zoho contact has one', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 4', { 'Phone Number': '' });
    const id = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'], phone: '5550142' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, contactOnly);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    await untilPasses('the contact is updated', async () => {
      expect(await crm.recordText('Contacts', id)).toContain(row['Department']);
    }, 120_000);
    expect(phoneDigits(await crm.recordText('Contacts', id)), 'The Zoho phone is kept').toContain('5550142');
  });

  test('Contact: 5 Prospect has no last name', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 5', { 'Last Name': '' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, contactOnly);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    // Zoho needs a Last Name, so no contact appears (QA 2026-10-29).
    expect(await crm.waitForRecord('Contacts', row['Email'], 60_000), 'No contact may be created').toBeUndefined();
  });

  test('Contact: 6 Zoho contact has the email in different letter case', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 6');
    const typed = `${row['Email'].split('@')[0].toUpperCase()}@Mailinator.com`;
    const id = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: typed });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, contactOnly);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    await untilPasses('the contact is updated', async () => {
      expect(await crm.recordText('Contacts', id)).toContain(row['Department']);
    }, 120_000);
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'No second contact').toEqual([id]);
  });

  // ---- Create/Update a Lead in Zoho ----

  test('Lead: 1 Prospect not in Zoho, has a company', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Lead > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.lead }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Leads', row['Email']);
    expect(found, `No Zoho lead for ${row['Email']}`).toBeTruthy();
    const text = await crm.recordText('Leads', found!.id);
    expect(ZohoCrmPage.field(text, 'Company')).toBe(row['Company']);
    for (const value of [row['Job Title'], row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
    expect((await crm.find('Leads', row['Email'])).length).toBe(1);
  });

  test('Lead: 2 Lead with the same email exists', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Lead > 2');
    const id = await new ZohoForms(crm).createLead({ first: row['First Name'], last: row['Last Name'], email: row['Email'], company: `Old Company ${stamp}` });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.lead }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    await untilPasses('the lead is updated', async () => {
      expect(ZohoCrmPage.field(await crm.recordText('Leads', id), 'Company')).toBe(row['Company']);
    }, 120_000);
    expect((await crm.find('Leads', row['Email'])).map((r) => r.id), 'Still one lead').toEqual([id]);
    // Unconfirmed: whether an update adds a note. Recorded, not asserted.
    test.info().annotations.push({ type: 'Notes on the updated lead', description: String(ZohoCrmPage.noteCount(await crm.recordText('Leads', id))) });
  });

  test('Lead: 3 Prospect has no company', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Lead > 3', { Company: '' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.lead }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Leads', row['Email']);
    expect(found, `No Zoho lead for ${row['Email']}`).toBeTruthy();
    const text = await crm.recordText('Leads', found!.id);
    expect(emptyField(text, 'Company', 'Lead Name'), 'Company is left out').toBe(true);
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
  });

  // ---- Create/Update Account in Zoho ----

  test('Account: 1 Prospect not in Zoho, no contact, has a company', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Account > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.account }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Accounts', row['Company']);
    expect(found, `No Zoho account named ${row['Company']}`).toBeTruthy();
    const text = await crm.recordText('Accounts', found!.id);
    expect(ZohoCrmPage.field(text, 'Account Name')).toBe(row['Company']);
    for (const value of [row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
    expect((await crm.find('Accounts', row['Company'])).length).toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The Account action must not create a contact').toBe(0);
  });

  test('Account: 2 Contact has the account "Orion Freight", prospect company is "Orion Freight Ltd"', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const accountName = `Orion Freight ${stamp}`;
    const row = prospect('Account > 2', { Company: `${accountName} Ltd` });
    const accountId = await crm.createAccount(accountName);
    await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'], account: accountName });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.account }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    await untilPasses('the linked account is updated', async () => {
      const text = await crm.recordText('Accounts', accountId);
      for (const value of [row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    }, 120_000);
    expect(ZohoCrmPage.field(await crm.recordText('Accounts', accountId), 'Account Name'), 'The account name is kept').toBe(accountName);
    expect((await crm.find('Accounts', row['Company'])).length, 'No new account from the prospect company').toBe(0);
  });

  test('Account: 3 Contact exists, has no account', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Account > 3');
    const contactId = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.account }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    expect(await crm.waitForRecord('Accounts', row['Company']), `No Zoho account named ${row['Company']}`).toBeTruthy();
    await untilPasses('the contact is linked to the account', async () => {
      expect(ZohoCrmPage.field(await crm.recordText('Contacts', contactId), 'Account Name')).toBe(row['Company']);
    }, 120_000);
  });

  // ---- Create/Update a Deal in Zoho ----

  test('Deal: 1 Prospect not in Zoho, Closing date 7', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Deal > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '7' }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Deals', fullName(row));
    expect(found, `No Zoho deal named ${fullName(row)}`).toBeTruthy();
    const text = await crm.recordText('Deals', found!.id);
    expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
    expect(ZohoCrmPage.field(text, 'Closing Date')).toBe(inDays(7));
    expect(emptyField(text, 'Contact Name', 'Modified By'), 'The deal is not linked to a contact').toBe(true);
    expect((await crm.find('Deals', fullName(row))).length).toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The Deal action must not create a contact').toBe(0);
    // Z-5 (known): the deal also makes an account named after the company. Recorded.
    expect(await crm.waitForRecord('Accounts', row['Company'], 30_000)).toBeTruthy();
  });

  test('Deal: 2 Contact has 2 deals, the second made a few minutes after the first', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Deal > 2');
    const forms = new ZohoForms(crm);
    await forms.createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    const olderName = `Older Deal ${stamp} ${row['Last Name']}`;
    const newerName = `Newer Deal ${stamp} ${row['Last Name']}`;
    const olderId = await forms.createDeal({ name: olderName, closing: inDays(30), contact: fullName(row), amount: '100' });
    // The newest deal is the one made last. A pause makes the order clear in Zoho.
    await crm.page.waitForTimeout(60_000);
    const newerId = await forms.createDeal({ name: newerName, closing: inDays(30), contact: fullName(row), amount: '200' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '0' }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    await untilPasses('the newest deal is updated', async () => {
      expect(ZohoCrmPage.field(await crm.recordText('Deals', newerId), 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
    }, 120_000);
    const older = await crm.recordText('Deals', olderId);
    expect(ZohoCrmPage.field(older, 'Amount'), 'The older deal is unchanged').toContain('100.00');
    expect(ZohoCrmPage.noteCount(older), 'No note on the older deal').toBe(0);
    expect((await crm.find('Deals', olderName)).length + (await crm.find('Deals', newerName)).length, 'No new deal').toBe(2);
  });

  test('Deal: 3 Deal with Stage changed by hand to Negotiation/Review', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Deal > 3');
    const forms = new ZohoForms(crm);
    await forms.createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    const dealId = await forms.createDeal({ name: `Staged Deal ${stamp} ${row['Last Name']}`, closing: inDays(30), contact: fullName(row), amount: '100', stage: 'Negotiation/Review' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '0' }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    await untilPasses('the deal is updated', async () => {
      expect(ZohoCrmPage.field(await crm.recordText('Deals', dealId), 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
    }, 120_000);
    expect(ZohoCrmPage.field(await crm.recordText('Deals', dealId), 'Stage'), 'The Stage set by hand is kept').toBe('Negotiation/Review');
  });

  test('Deal: 4 Contact exists, no deal, Closing date left empty', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Deal > 4');
    await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '' }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Deals', fullName(row));
    expect(found, `No Zoho deal named ${fullName(row)}`).toBeTruthy();
    const text = await crm.recordText('Deals', found!.id);
    expect(ZohoCrmPage.field(text, 'Contact Name'), 'The deal is linked to the contact').toBe(fullName(row));
    expect(ZohoCrmPage.field(text, 'Closing Date'), 'No Closing Date').not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect((await crm.find('Deals', fullName(row))).length).toBe(1);
  });

  // ---- Create a Task in Zoho ----

  test('Task: 1 Prospect not in Zoho, Due In 3', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Task > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.task, task: TASK }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Tasks', fullName(row));
    expect(found, `No Zoho task for ${fullName(row)}`).toBeTruthy();
    const text = await crm.recordText('Tasks', found!.id);
    expect(ZohoCrmPage.field(text, 'Subject')).toBe(TASK.subject);
    expect(ZohoCrmPage.field(text, 'Status')).toBe(TASK.status);
    expect(ZohoCrmPage.field(text, 'Priority')).toBe(TASK.priority);
    expect(ZohoCrmPage.field(text, 'Due Date')).toBe(inDays(3));
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    expect((await crm.find('Tasks', fullName(row))).length).toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The contact is created').toBe(1);
  });

  test('Task: 2 Contact exists, Status Completed, Priority Highest', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Task > 2');
    const contactId = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.task, task: { ...TASK, status: 'Completed', priority: 'Highest' } }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Tasks', fullName(row));
    expect(found, `No Zoho task for ${fullName(row)}`).toBeTruthy();
    const text = await crm.recordText('Tasks', found!.id);
    expect(ZohoCrmPage.field(text, 'Status')).toBe('Completed');
    expect(ZohoCrmPage.field(text, 'Priority')).toBe('Highest');
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    expect((await crm.find('Tasks', fullName(row))).length).toBe(1);
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'Still one contact').toEqual([contactId]);
  });

  // UI check only (QA 2026-11-03, AL-4198): no email is sent. The Task dialog with an empty Subject must not save.
  test('Task: 3 Subject left empty', async ({ zohoIntegration, saleshandyPage }) => {
    await zohoIntegration.openTriggers();
    await zohoIntegration.enableOnly(TRIGGER);
    for (const chip of await zohoIntegration.selectedActivities(TRIGGER)) await zohoIntegration.removeActivity(TRIGGER, chip);
    await zohoIntegration.selectActivity(TRIGGER, ZOHO_ACTION.task);
    const dialog = saleshandyPage.getByRole('dialog');
    await dialog.waitFor();
    await dialog.getByRole('textbox').first().fill('');
    await expect(dialog.getByRole('button', { name: 'Save', exact: true }), 'Save must be disabled with an empty Subject').toBeDisabled({ timeout: 10_000 });
  });

  // ---- Combined actions ----

  test('Combined: 1 Contact, Deal and Task selected, prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Combined > 1');
    // configureWaiting waits for the saved message after each Deal and Task dialog. Plain configure picks the next
    // action too early and the last chip is lost (script race, found by the Email Sent session 2026-11-02).
    await configureWaiting(zohoIntegration, saleshandyPage, TRIGGER, [
      { action: ZOHO_ACTION.contact },
      { action: ZOHO_ACTION.deal, closingDays: '0' },
      { action: ZOHO_ACTION.task, task: TASK },
    ]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    const contact = await crm.waitForRecord('Contacts', row['Email']);
    expect(contact, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    const deal = await crm.waitForRecord('Deals', fullName(row));
    expect(deal, `No Zoho deal for ${fullName(row)}`).toBeTruthy();
    const task = await crm.waitForRecord('Tasks', fullName(row));
    expect(task, `No Zoho task for ${fullName(row)}`).toBeTruthy();
    expect((await crm.find('Contacts', row['Email'])).length, 'One contact').toBe(1);
    expect((await crm.find('Deals', fullName(row))).length, 'One deal').toBe(1);
    expect((await crm.find('Tasks', fullName(row))).length, 'One task').toBe(1);
    await untilPasses('the deal and the task are linked to the contact', async () => {
      expect(ZohoCrmPage.field(await crm.recordText('Deals', deal!.id), 'Contact Name')).toBe(fullName(row));
      expect(ZohoCrmPage.field(await crm.recordText('Tasks', task!.id), 'Contact Name')).toBe(fullName(row));
    }, 120_000);
    expect(ZohoCrmPage.noteCount(await crm.recordText('Contacts', contact!.id)), 'A note on the contact').toBeGreaterThanOrEqual(1);
    expect(ZohoCrmPage.noteCount(await crm.recordText('Deals', deal!.id)), 'A note on the deal').toBeGreaterThanOrEqual(1);
  });

  // Skipped (QA 2026-11-03): selecting all 5 actions is not a realistic setup.
  test.skip('Combined: 2 All 5 actions selected, contact, account and deal already exist', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Combined > 2');
    const forms = new ZohoForms(crm);
    const accountName = `Combined Account ${stamp}`;
    const dealName = `Combined Deal ${stamp} ${row['Last Name']}`;
    const accountId = await crm.createAccount(accountName);
    const contactId = await forms.createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'], account: accountName });
    const dealId = await forms.createDeal({ name: dealName, closing: inDays(30), contact: fullName(row), amount: '100', account: accountName });
    await configureWaiting(zohoIntegration, saleshandyPage, TRIGGER, [
      { action: ZOHO_ACTION.contact },
      { action: ZOHO_ACTION.lead },
      { action: ZOHO_ACTION.account },
      { action: ZOHO_ACTION.deal, closingDays: '0' },
      { action: ZOHO_ACTION.task, task: TASK },
    ]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    await untilPasses('the contact, account and deal are updated', async () => {
      expect(await crm.recordText('Contacts', contactId)).toContain(row['Department']);
      expect(ZohoCrmPage.field(await crm.recordText('Deals', dealId), 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
    }, 180_000);
    expect(await crm.waitForRecord('Leads', row['Email']), 'One new lead').toBeTruthy();
    expect(await crm.waitForRecord('Tasks', fullName(row)), 'One new task').toBeTruthy();
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'No second contact').toEqual([contactId]);
    expect((await crm.find('Accounts', accountName)).map((r) => r.id), 'No second account').toEqual([accountId]);
    expect((await crm.find('Deals', dealName)).map((r) => r.id), 'No second deal').toEqual([dealId]);
    expect((await crm.find('Leads', row['Email'])).length, 'One lead').toBe(1);
    expect((await crm.find('Tasks', fullName(row))).length, 'One task').toBe(1);
  });

  // ---- Real reply ----

  test('Real reply: 1 Contact action, prospect mailbox is a Gmail address', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    test.skip(!GMAIL, 'Set ZOHO_REPLY_GMAIL to a Gmail address that QA can reply from');
    test.setTimeout(35 * 60_000);
    const row = prospect('Real reply > 1', { Email: GMAIL! });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, contactOnly);
    await sendStep(saleshandySequence, SEQUENCE_ID, row);
    console.log(`REAL REPLY: open the email in ${GMAIL} and reply to it now. The test waits up to 20 minutes.`);
    await saleshandySequence.waitForReplied(SEQUENCE_ID, fullName(row), 1, row['Email'], 20 * 60_000);
    const found = await crm.waitForRecord('Contacts', row['Email']);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    const text = await crm.recordText('Contacts', found!.id);
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length).toBe(1);
  });
});
