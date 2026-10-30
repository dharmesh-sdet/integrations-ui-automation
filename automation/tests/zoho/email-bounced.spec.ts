// Scenarios: test-cases/zoho/email-bounced.md (Regression, 23 rows, QA OK 2026-10-30, no ticket per row).
// One test per row, named "<section>: <n>". No one has seen this trigger in the Saleshandy UI, so rows marked
// "(proposed, unconfirmed)" in the cases file record what they see and do not assert it (the tag name, Lead-only
// extras, the real bounce).
// Data: test-data/zoho/email-bounced.csv (npm run data:zoho-email-bounced), one prospect per row, found by the Scenario column.
// Sequence: "Zoho Email Bounced QA" on notemailsentzoho, 2 steps, one mailbox no other Zoho sequence uses, Active.
//   Put its id in ZOHO_EB_SEQUENCE_ID.
// Zoho CRM is read in a headed browser on its own copy of the saved profile, so run it through xvfb-run (see
// package.json `test:zoho-email-bounced`). Other Zoho workflows run at the same time on this account, each with its own
// sequence and prospects, so only the Email Bounced trigger is touched (KEEP_OTHER_TRIGGERS).
//
// How a row runs: set the trigger and its actions, make the Zoho records the row needs, add the prospect and mark the
// step 1 email as bounced (Emails tab > Actions > Mark as bounced, no send). Only Trigger and setup 4 is a real bounce
// (cap 1): it sends step 1 and waits for Saleshandy to set Bounced. Then look in Zoho 15 s later, every 10 s after
// that (QA). Logs are not used for Zoho (QA 2026-10-29). Rows do not delete what they create.
// Known issues are recorded, not filed (Z-1, Z-5, Z-6, Q3). On 2026-10-29 a new contact made two Tasks in 2 of 2 runs and
// two Deals in 1 of 2 (Email Sent). The rows expect one record, so a repeat shows Fail until QA decides if it is a bug.
import path from 'node:path';
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { ZOHO_ACTION, configure, fullName } from '../../src/flows/saleshandy-to-zoho.ts';
import { inDays } from '../../src/flows/zoho-email-sent.ts';
import { NOTE_TITLE, TRIGGER, addTag, bounce, bounceNotes, realBounceEmail, tagsSeen } from '../../src/flows/zoho-email-bounced.ts';
import { ZohoCrmPage, openZohoProfile } from '../../src/pages/zoho/zoho-crm.page.ts';
import { ZohoForms } from '../../src/pages/zoho/zoho-forms.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';

process.env.KEEP_OTHER_TRIGGERS ??= '1';

const CSV = 'zoho/email-bounced.csv';
// TODO(needs-input): id of "Zoho Email Bounced QA" (QA makes the sequence and connects its own mailbox).
const SEQUENCE_ID = process.env.ZOHO_EB_SEQUENCE_ID ?? '';
// TODO(needs-input): QA or Claude makes this copy of the saved Zoho profile before the first run.
const PROFILE = path.resolve(import.meta.dirname, '../../auth/zoho-email-bounced-profile');

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
  if (!SEQUENCE_ID) throw new Error('Set ZOHO_EB_SEQUENCE_ID to the id of "Zoho Email Bounced QA"');
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
const TASK = { subject: 'Follow up after bounce', status: 'Not Started', priority: 'Normal', dueIn: '3' };

type Fx = Parameters<Parameters<typeof test>[2]>[0];
type Env = Pick<Fx, 'zohoIntegration' | 'saleshandyPage' | 'saleshandySequence' | 'crm'>;

// "Mark the step 1 email as bounced": the start of every row except the real bounce.
const markBounced = (fx: Env, row: Row): Promise<void> => bounce(fx.saleshandySequence, SEQUENCE_ID, row);

// Records which candidate tag a page shows. The tag name is unconfirmed, so it is recorded, not asserted.
function recordTag(module: string, text: string): void {
  test.info().annotations.push({ type: `tag on ${module} (proposed Bounced-Saleshandy, unconfirmed)`, description: tagsSeen(text) });
}

test.describe('Zoho Email Bounced (staging)', () => {
  test.setTimeout(8 * 60_000);

  // ---- Trigger and setup ----

  test('Trigger and setup: 1 Trigger OFF, Contact action saved', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Trigger and setup > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    // Only this trigger goes off. The action stays saved on it.
    await zohoIntegration.openTriggers();
    await zohoIntegration.turnOff(TRIGGER);
    await zohoIntegration.save();
    await zohoIntegration.savedToast().waitFor({ timeout: 20_000 });
    await markBounced({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row);
    await saleshandySequence.waitUntilBounced(SEQUENCE_ID, fullName(row), 1, 60_000);
    expect(await crm.waitForRecord('Contacts', row['Email'], 60_000), 'Nothing may be created with the trigger off').toBeUndefined();
    // Leave the trigger on, the way the other rows expect it.
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
  });

  test('Trigger and setup: 2 Trigger ON, Contact action saved, page reloaded', async ({ zohoIntegration, saleshandyPage }) => {
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.task, task: TASK }]);
    await saleshandyPage.reload();
    await zohoIntegration.openTriggers();
    expect(await zohoIntegration.isTriggerOn(TRIGGER)).toBe(true);
    expect(await zohoIntegration.selectedActivities(TRIGGER)).toEqual([ZOHO_ACTION.task]);
    // TODO(needs-input): the first icon of the chip opening its Extra Configuration is a guess (the last one removes it).
    // The cases file says "Contact action saved"; the Task action is used here because only it has Extra Configuration values to read back.
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

  test('Trigger and setup: 3 Contact action on, prospect not in Zoho, sequence Active', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Trigger and setup > 3');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await markBounced({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row);
    const found = await crm.waitForRecord('Contacts', row['Email']);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    const text = await crm.waitForNotes('Contacts', found!.id, 1);
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
    expect(text).toContain(NOTE_TITLE);
    recordTag('Contacts', text);
    expect((await crm.find('Contacts', row['Email'])).length).toBe(1);
  });

  test('Trigger and setup: 4 Real bounce, Contact action on, prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    // One real bounce only (cap 1): it goes through the real sender, then Saleshandy sets Bounced by itself (up to 5 minutes).
    test.setTimeout(12 * 60_000);
    const found = prospect('Trigger and setup > 4');
    const email = realBounceEmail(found);
    const row: Row = { ...found, Email: email };
    markUsed(CSV, email);
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await saleshandySequence.createAndAddProspect(SEQUENCE_ID, row);
    await saleshandySequence.sendNow(SEQUENCE_ID, fullName(row), 1, email);
    await saleshandySequence.waitUntilBounced(SEQUENCE_ID, fullName(row));
    // Proposed, unconfirmed: contact, note and tag as in row 3. The contact and the note are checked, the tag is recorded.
    const contact = await crm.waitForRecord('Contacts', email);
    expect(contact, `No Zoho contact for ${email}`).toBeTruthy();
    const text = await crm.waitForNotes('Contacts', contact!.id, 1);
    expect(ZohoCrmPage.noteCount(text)).toBeGreaterThanOrEqual(1);
    recordTag('Contacts', text);
  });

  // ---- Create/Update a Contact ----

  test('Contact: 1 Prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await markBounced({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row);
    const found = await crm.waitForRecord('Contacts', row['Email']);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    const text = await crm.waitForNotes('Contacts', found!.id, 1);
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    for (const value of [row['Job Title'], row['Department'], row['Twitter'], row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(phoneDigits(text)).toContain(phoneDigits(row['Phone Number']));
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
    expect(text).toContain(NOTE_TITLE);
    recordTag('Contacts', text);
    expect((await crm.find('Contacts', row['Email'])).length).toBe(1);
  });

  test('Contact: 2 Contact exists with an old Title', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 2');
    const id = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'], title: 'Old Title' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await markBounced({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row);
    let seen = '';
    await untilPasses('the contact is updated', async () => {
      seen = await crm.recordText('Contacts', id);
      expect(seen).toContain(row['Job Title']);
      expect(seen).not.toContain('Old Title');
    }, 120_000);
    recordTag('Contacts', seen);
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'Still one contact').toEqual([id]);
  });

  test('Contact: 3 Contact exists, its email in different letter case', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 3');
    const typed = `${row['Email'].split('@')[0].toUpperCase()}@Mailinator.com`;
    const id = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: typed });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await markBounced({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row);
    await untilPasses('the contact is updated', async () => {
      const text = await crm.recordText('Contacts', id);
      expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
      expect(text).toContain(row['Department']);
    }, 120_000);
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'No second contact').toEqual([id]);
  });

  test('Contact: 4 Contact exists with the tag VIP', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 4');
    const id = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    await addTag(crm, 'Contacts', id, 'VIP');
    expect(await crm.recordText('Contacts', id), 'The VIP tag is on the contact before the bounce').toContain('VIP');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await markBounced({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row);
    // Z-6 (known): the bounce tag replaces the other tags, so VIP is gone. The tag name itself is unconfirmed.
    let seen = '';
    await untilPasses('the contact is updated and VIP is gone', async () => {
      seen = await crm.recordText('Contacts', id);
      expect(ZohoCrmPage.noteCount(seen)).toBeGreaterThanOrEqual(1);
      expect(seen).not.toContain('VIP');
    }, 120_000);
    recordTag('Contacts', seen);
  });

  // ---- Create/Update a Lead ----

  test('Lead: 1 Prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Lead > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.lead }]);
    await markBounced({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row);
    const found = await crm.waitForRecord('Leads', row['Email']);
    expect(found, `No Zoho lead for ${row['Email']}`).toBeTruthy();
    const text = await crm.waitForNotes('Leads', found!.id, 1);
    expect(ZohoCrmPage.field(text, 'Company')).toBe(row['Company']);
    for (const value of [row['Job Title'], row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
    // Unconfirmed: whether a Lead-only bounce adds a tag or makes a contact. Recorded for the cases file.
    recordTag('Leads', text);
    test.info().annotations.push({ type: 'contacts made by a Lead-only bounce (unconfirmed)', description: String((await crm.find('Contacts', row['Email'])).length) });
    expect((await crm.find('Leads', row['Email'])).length, 'One bounce must make one lead').toBe(1);
  });

  test('Lead: 2 Lead exists for the prospect email', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Lead > 2');
    const id = await new ZohoForms(crm).createLead({ first: row['First Name'], last: row['Last Name'], email: row['Email'], company: `Old Company ${stamp}` });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.lead }]);
    await markBounced({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row);
    await untilPasses('the lead is updated', async () => {
      const text = await crm.recordText('Leads', id);
      expect(ZohoCrmPage.field(text, 'Company')).toBe(row['Company']);
      expect(ZohoCrmPage.noteCount(text)).toBeGreaterThanOrEqual(1);
    }, 120_000);
    expect((await crm.find('Leads', row['Email'])).map((r) => r.id), 'Still one lead').toEqual([id]);
  });

  test('Lead: 3 Prospect has no company', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Lead > 3', { Company: '' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.lead }]);
    await markBounced({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row);
    const found = await crm.waitForRecord('Leads', row['Email']);
    expect(found, `No Zoho lead for ${row['Email']}`).toBeTruthy();
    const text = await crm.waitForNotes('Leads', found!.id, 1);
    expect(ZohoCrmPage.field(text, 'Company')).toBe('');
  });

  // ---- Create/Update Account ----

  test('Account: 1 Prospect has a company, no contact, no account', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Account > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.account }]);
    await markBounced({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row);
    const found = await crm.waitForRecord('Accounts', row['Company']);
    expect(found, `No Zoho account named ${row['Company']}`).toBeTruthy();
    const text = await crm.waitForNotes('Accounts', found!.id, 1);
    expect(ZohoCrmPage.field(text, 'Account Name')).toBe(row['Company']);
    for (const value of [row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
    expect((await crm.find('Accounts', row['Company'])).length).toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The Account action must not link a contact').toBe(0);
  });

  test('Account: 2 Contact exists and is linked to an account', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Account > 2');
    const accountName = `Linked Account ${stamp}`;
    const accountId = await crm.createAccount(accountName);
    await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'], account: accountName });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.account }]);
    await markBounced({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row);
    await untilPasses('the linked account is updated', async () => {
      const text = await crm.recordText('Accounts', accountId);
      for (const value of [row['City'], row['State'], row['Country']]) expect(text).toContain(value);
      expect(ZohoCrmPage.noteCount(text)).toBeGreaterThanOrEqual(1);
    }, 120_000);
    expect(ZohoCrmPage.field(await crm.recordText('Accounts', accountId), 'Account Name'), 'The account name is kept').toBe(accountName);
    expect((await crm.find('Accounts', row['Company'])).length, 'No account is made from the prospect company').toBe(0);
  });

  test('Account: 3 Contact exists with no account', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Account > 3');
    const contactId = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.account }]);
    await markBounced({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row);
    expect(await crm.waitForRecord('Accounts', row['Company']), `No Zoho account named ${row['Company']}`).toBeTruthy();
    await untilPasses('the contact is linked to the account', async () => {
      expect(ZohoCrmPage.field(await crm.recordText('Contacts', contactId), 'Account Name')).toBe(row['Company']);
    }, 120_000);
  });

  test('Account: 4 Prospect has no company', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Account > 4', { Company: '' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.account }]);
    await markBounced({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row);
    // Zoho needs an Account Name, so nothing is made. Only the contact side is checked here: an account
    // made from no company has no name to search for, and other sessions add accounts in this org at the same time.
    expect(await crm.waitForRecord('Contacts', row['Email'], 60_000), 'No contact may be created').toBeUndefined();
  });

  // ---- Create/Update a Deal ----

  test('Deal: 1 Prospect not in Zoho, has a company, Closing date 0', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Deal > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '0' }]);
    await markBounced({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row);
    const found = await crm.waitForRecord('Deals', fullName(row));
    expect(found, `No Zoho deal named ${fullName(row)}`).toBeTruthy();
    const text = await crm.waitForNotes('Deals', found!.id, 1);
    expect(ZohoCrmPage.field(text, 'Deal Name')).toBe(fullName(row));
    expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
    expect(ZohoCrmPage.field(text, 'Stage')).toBe('Qualification');
    expect(ZohoCrmPage.field(text, 'Closing Date')).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe('');
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
    expect((await crm.find('Deals', fullName(row))).length, 'One bounce must make one deal').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The Deal action must not create a contact').toBe(0);
    // Z-5 (known): the deal also makes an account named after the company.
    expect(await crm.waitForRecord('Accounts', row['Company'], 30_000)).toBeTruthy();
  });

  test('Deal: 2 Contact has 2 deals, Closing date 0', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Deal > 2');
    const forms = new ZohoForms(crm);
    await forms.createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    const olderId = await forms.createDeal({ name: `Older Deal ${stamp} ${row['Last Name']}`, closing: inDays(30), contact: fullName(row), amount: '100' });
    const newerId = await forms.createDeal({ name: `Newer Deal ${stamp} ${row['Last Name']}`, closing: inDays(30), contact: fullName(row), amount: '200' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '0' }]);
    await markBounced({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row);
    await untilPasses('the newest deal is updated', async () => {
      const text = await crm.recordText('Deals', newerId);
      expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
      expect(ZohoCrmPage.noteCount(text)).toBeGreaterThanOrEqual(1);
    }, 120_000);
    const older = await crm.recordText('Deals', olderId);
    expect(ZohoCrmPage.field(older, 'Amount'), 'The older deal is unchanged').toContain('100.00');
    expect(ZohoCrmPage.noteCount(older)).toBe(0);
  });

  test('Deal: 3 Prospect not in Zoho, Closing date 7', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Deal > 3');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '7' }]);
    await markBounced({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row);
    const found = await crm.waitForRecord('Deals', fullName(row));
    expect(found, `No Zoho deal named ${fullName(row)}`).toBeTruthy();
    expect(ZohoCrmPage.field(await crm.recordText('Deals', found!.id), 'Closing Date')).toBe(inDays(7));
    expect((await crm.find('Deals', fullName(row))).length, 'One bounce must make one deal').toBe(1);
  });

  test('Deal: 4 Existing deal with Stage changed by hand', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Deal > 4');
    const forms = new ZohoForms(crm);
    await forms.createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    const dealId = await forms.createDeal({ name: `Staged Deal ${stamp} ${row['Last Name']}`, closing: inDays(30), contact: fullName(row), amount: '100', stage: 'Needs Analysis' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '0' }]);
    await markBounced({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row);
    await untilPasses('the deal is updated', async () => {
      const text = await crm.recordText('Deals', dealId);
      expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
      expect(ZohoCrmPage.noteCount(text)).toBeGreaterThanOrEqual(1);
    }, 120_000);
    expect(ZohoCrmPage.field(await crm.recordText('Deals', dealId), 'Stage'), 'The Stage set by hand is kept').toBe('Needs Analysis');
  });

  // ---- Create a Task ----

  test('Task: 1 Prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Task > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.task, task: TASK }]);
    await markBounced({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row);
    const found = await crm.waitForRecord('Tasks', fullName(row));
    expect(found, `No Zoho task for ${fullName(row)}`).toBeTruthy();
    const text = await crm.recordText('Tasks', found!.id);
    expect(ZohoCrmPage.field(text, 'Subject')).toBe(TASK.subject);
    expect(ZohoCrmPage.field(text, 'Status')).toBe(TASK.status);
    expect(ZohoCrmPage.field(text, 'Priority')).toBe(TASK.priority);
    expect(ZohoCrmPage.field(text, 'Due Date')).toBe(inDays(3));
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    expect((await crm.find('Tasks', fullName(row))).length, 'One bounce must make one task').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The contact is created first').toBe(1);
  });

  test('Task: 2 Contact exists', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Task > 2');
    const contactId = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.task, task: TASK }]);
    await markBounced({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row);
    const found = await crm.waitForRecord('Tasks', fullName(row));
    expect(found, `No Zoho task for ${fullName(row)}`).toBeTruthy();
    expect(ZohoCrmPage.field(await crm.recordText('Tasks', found!.id), 'Contact Name')).toBe(fullName(row));
    expect((await crm.find('Tasks', fullName(row))).length, 'One bounce must make one task').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'Still one contact').toEqual([contactId]);
  });

  test('Task: 3 Subject left empty', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Task > 3');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.task, task: { ...TASK, subject: '' } }]);
    await markBounced({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row);
    // "The run still completes" is in Logs, which Zoho rows do not read (QA 2026-10-29). Only the missing task is checked.
    expect(await crm.waitForRecord('Tasks', fullName(row), 60_000), 'No task may be created').toBeUndefined();
  });

  // ---- Combined actions ----

  test('Combined: 1 Contact, Lead, Account, Deal and Task all selected, prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Combined > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [
      { action: ZOHO_ACTION.contact },
      { action: ZOHO_ACTION.lead },
      { action: ZOHO_ACTION.account },
      { action: ZOHO_ACTION.deal, closingDays: '0' },
      { action: ZOHO_ACTION.task, task: TASK },
    ]);
    await markBounced({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row);
    const contact = await crm.waitForRecord('Contacts', row['Email']);
    expect(contact, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    // Run B3: 5 notes on the contact and the bounce tag.
    const text = await crm.waitForNotes('Contacts', contact!.id, 5);
    expect(ZohoCrmPage.noteCount(text), 'Notes on the contact (run B3: 5)').toBe(5);
    expect(bounceNotes(text), 'Notes with the bounce title').toBeGreaterThanOrEqual(1);
    recordTag('Contacts', text);
    expect((await crm.find('Contacts', row['Email'])).length, 'One bounce must make one contact').toBe(1);
    expect((await crm.find('Leads', row['Email'])).length, 'The lead').toBe(1);
    expect((await crm.find('Deals', fullName(row))).length, 'The deal').toBe(1);
    expect((await crm.find('Tasks', fullName(row))).length, 'The task').toBe(1);
    // Accounts: Z-5 (known) allows more than one, so they are not counted.
  });
});
