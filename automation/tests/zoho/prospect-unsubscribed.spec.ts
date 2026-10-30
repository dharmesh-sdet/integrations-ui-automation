// Scenarios: test-cases/zoho/prospect-unsubscribed.md (Regression, 20 rows, QA "looks great" 2026-10-30, no ticket per row).
// One test per row, named "<section>: <n> <short scenario>". No one has seen this trigger in the Saleshandy UI, so rows
// marked "(proposed, unconfirmed)" in the cases file record what they see and do not assert it (the real-link rows'
// notes and tag, the Lead-only extras). The note title and text are not recorded: the first run writes the lines it
// sees as test annotations ("note lines"), for the cases file.
// Data: test-data/zoho/prospect-unsubscribed.csv (npm run data:zoho-prospect-unsubscribed), one prospect per row, found by the Scenario column.
// Sequence: "Zoho Prospect Unsubscribed QA" on notemailsentzoho, 1 step, no A/B variants, one mailbox no other Zoho
//   sequence uses, Active, Sequence Settings > Unsubscribe > "Unsubscribe as Link" saved. Put its id in ZOHO_PU_SEQUENCE_ID.
// Zoho CRM is read in a headed browser on its own copy of the saved profile, so run it through xvfb-run (see
// package.json `test:zoho-prospect-unsubscribed`). Other Zoho workflows run at the same time on this account, each with
// its own sequence and prospects, so only the Prospect Unsubscribed trigger is touched (KEEP_OTHER_TRIGGERS).
//
// How a row runs: set the trigger and its actions, make the Zoho records the row needs, add the prospect, send step 1
// (ZOHO_PU_SKIP_SEND=1 skips it) and unsubscribe. Unsubscribe (UI) is Mark as Unsubscribe on the Prospects tab. Unsubscribe
// (link) is the "Unsubscribe here" link of the delivered email in Mailinator, used only by Trigger and setup 4 to 6 (3 sends).
// Then look in Zoho 15 s later, every 10 s after that (QA). Logs are not used for Zoho (QA 2026-10-29). Rows do not delete
// what they create. Known issues are recorded, not filed (Z-1, Z-5, Z-6, Q3). On 2026-10-29 a new contact made two Tasks in
// 2 of 2 runs and two Deals in 1 of 2 (Email Sent). The rows expect one record, so a repeat shows Fail until QA decides if it is a bug.
import path from 'node:path';
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { ZOHO_ACTION, configure, fullName } from '../../src/flows/saleshandy-to-zoho.ts';
import { inDays } from '../../src/flows/zoho-email-sent.ts';
import { addTag } from '../../src/flows/zoho-email-bounced.ts';
import { SUBSCRIBED_TEXT, TAG, TRIGGER, hasTag, noteLines, openLink, unsubscribeByLink, unsubscribeUi } from '../../src/flows/zoho-prospect-unsubscribed.ts';
import { ZohoCrmPage, openZohoProfile } from '../../src/pages/zoho/zoho-crm.page.ts';
import { ZohoForms } from '../../src/pages/zoho/zoho-forms.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';

process.env.KEEP_OTHER_TRIGGERS ??= '1';

const CSV = 'zoho/prospect-unsubscribed.csv';
// TODO(needs-input): id of "Zoho Prospect Unsubscribed QA" (QA makes the sequence and connects its own mailbox).
const SEQUENCE_ID = process.env.ZOHO_PU_SEQUENCE_ID ?? '';
// TODO(needs-input): QA or Claude makes this copy of the saved Zoho profile before the first run.
const PROFILE = path.resolve(import.meta.dirname, '../../auth/zoho-prospect-unsubscribed-profile');

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
  if (!SEQUENCE_ID) throw new Error('Set ZOHO_PU_SEQUENCE_ID to the id of "Zoho Prospect Unsubscribed QA"');
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
const TASK = { subject: 'Follow up after unsubscribe', status: 'Not Started', priority: 'Normal', dueIn: '3' };
// The phone of a contact made by hand. TODO(needs-input): run U2 does not say whether the prospect had a phone too.
const OLD_PHONE = '+1 555-0100-0002';

type Fx = Parameters<Parameters<typeof test>[2]>[0];
type Env = Pick<Fx, 'zohoIntegration' | 'saleshandyPage' | 'saleshandySequence' | 'mailinator' | 'crm'>;

// "Unsubscribe (UI)": the end of every row except Trigger and setup 4 to 6.
const unsubscribe = (fx: Env, row: Row): Promise<void> => unsubscribeUi(fx.saleshandySequence, SEQUENCE_ID, row);

// Records what a record page shows for the first-run cases file: the tag and the unsubscribe note lines.
function record(module: string, text: string): void {
  test.info().annotations.push({ type: `note lines on ${module}`, description: noteLines(text) });
}

test.describe('Zoho Prospect Unsubscribed (staging)', () => {
  test.setTimeout(8 * 60_000);

  // ---- Trigger and setup ----

  test('Trigger and setup: 1 Trigger OFF, Contact action saved', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Trigger and setup > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    // Only this trigger goes off. The action stays saved on it.
    await zohoIntegration.openTriggers();
    await zohoIntegration.turnOff(TRIGGER);
    await zohoIntegration.save();
    await zohoIntegration.savedToast().waitFor({ timeout: 20_000 });
    // The Prospects tab shows Unsubscribed (unsubscribeUi waits for it).
    await unsubscribe({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
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

  test('Trigger and setup: 3 Contact action on, prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Trigger and setup > 3');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await unsubscribe({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    const found = await crm.waitForRecord('Contacts', row['Email']);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    const text = await crm.waitForNotes('Contacts', found!.id, 1);
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
    expect(text, `The tag ${TAG}`).toContain(TAG);
    record('Contacts', text);
    expect((await crm.find('Contacts', row['Email'])).length).toBe(1);
  });

  test('Trigger and setup: 4 Unsubscribe by the link', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    // Real send and a Mailinator wait (link rows are capped at 5 sends a run: rows 4, 5 and 6 use 3).
    test.setTimeout(12 * 60_000);
    const row = prospect('Trigger and setup > 4');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await unsubscribeByLink(saleshandySequence, mailinator, SEQUENCE_ID, row);
    await saleshandySequence.expectProspectStatusAfterRefresh(SEQUENCE_ID, row['Email'], 'Unsubscribed');
    // Proposed, unconfirmed: contact, tag and note as in row 3. The contact is checked, the tag and the note are recorded.
    const found = await crm.waitForRecord('Contacts', row['Email']);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    const text = await crm.waitForNotes('Contacts', found!.id, 1);
    test.info().annotations.push({ type: 'tag and notes on the contact (proposed, unconfirmed)', description: `tag ${TAG}: ${hasTag(text)}; notes: ${ZohoCrmPage.noteCount(text)}` });
    record('Contacts', text);
    expect((await crm.find('Contacts', row['Email'])).length, 'One contact').toBe(1);
  });

  test('Trigger and setup: 5 The same unsubscribe link opened a second time', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    test.setTimeout(12 * 60_000);
    const row = prospect('Trigger and setup > 5');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    const { subject } = await unsubscribeByLink(saleshandySequence, mailinator, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Contacts', row['Email']);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    const before = await crm.waitForNotes('Contacts', found!.id, 1);
    await openLink(mailinator, row, subject);
    // The second open has no event to wait for, so Zoho is looked at 30 s later.
    await crm.page.waitForTimeout(30_000);
    const after = await crm.recordText('Contacts', found!.id);
    // Proposed, unconfirmed: a second note can be added. The notes are recorded, not asserted.
    test.info().annotations.push({ type: 'notes before / after the second open (proposed, unconfirmed)', description: `${ZohoCrmPage.noteCount(before)} / ${ZohoCrmPage.noteCount(after)}` });
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'Still 1 contact').toEqual([found!.id]);
    expect(hasTag(after), `The tag ${TAG} is still on the contact`).toBe(true);
  });

  test('Trigger and setup: 6 Subscribe here after an unsubscribe by link', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    test.setTimeout(12 * 60_000);
    const row = prospect('Trigger and setup > 6');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    const { page } = await unsubscribeByLink(saleshandySequence, mailinator, SEQUENCE_ID, row);
    const found = await crm.waitForRecord('Contacts', row['Email']);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    const before = await crm.waitForNotes('Contacts', found!.id, 1);
    await page.getByRole('link', { name: 'Subscribe here' }).click();
    await expect(page.getByText(SUBSCRIBED_TEXT)).toBeVisible({ timeout: 30_000 });
    expect(await saleshandySequence.prospectRowText(SEQUENCE_ID, row['Email']), 'The Prospects tab no longer says Unsubscribed').not.toContain('Unsubscribed');
    await crm.page.waitForTimeout(30_000);
    const after = await crm.recordText('Contacts', found!.id);
    // Proposed, unconfirmed: the tag stays and no new note. Recorded, not asserted.
    test.info().annotations.push({
      type: 'after Subscribe here (proposed, unconfirmed)',
      description: `tag ${TAG} still on the contact: ${hasTag(after)}; notes before / after: ${ZohoCrmPage.noteCount(before)} / ${ZohoCrmPage.noteCount(after)}`,
    });
  });

  // ---- Create/Update a Contact ----

  test('Contact: 1 Prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Contact > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await unsubscribe({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    const found = await crm.waitForRecord('Contacts', row['Email']);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    const text = await crm.waitForNotes('Contacts', found!.id, 1);
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    for (const value of [row['Job Title'], row['Department'], row['Twitter'], row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(phoneDigits(text), 'The real phone').toContain(phoneDigits(row['Phone Number']));
    expect(text, `The tag ${TAG}`).toContain(TAG);
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
    record('Contacts', text);
    expect((await crm.find('Contacts', row['Email'])).length).toBe(1);
  });

  test('Contact: 2 Contact exists with an old Title and a phone', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Contact > 2');
    const id = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'], phone: OLD_PHONE, title: 'Old Title' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await unsubscribe({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    let seen = '';
    await untilPasses('the contact is updated', async () => {
      seen = await crm.recordText('Contacts', id);
      expect(seen).toContain(row['Job Title']);
      expect(seen).not.toContain('Old Title');
      expect(seen, `The tag ${TAG}`).toContain(TAG);
    }, 120_000);
    expect(phoneDigits(seen), 'The phone is kept').toContain(phoneDigits(OLD_PHONE));
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'Still 1 contact').toEqual([id]);
  });

  test('Contact: 3 Contact exists with the tag VIP', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Contact > 3');
    const id = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'], phone: OLD_PHONE });
    await addTag(crm, 'Contacts', id, 'VIP');
    expect(await crm.recordText('Contacts', id), 'The VIP tag is on the contact before the unsubscribe').toContain('VIP');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }]);
    await unsubscribe({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    // Z-6 (known, kept by decision): the tag replaces the other tags, so VIP is gone. Not filed.
    let seen = '';
    await untilPasses('the contact has the tag and VIP is gone', async () => {
      seen = await crm.recordText('Contacts', id);
      expect(seen, `The tag ${TAG}`).toContain(TAG);
      expect(seen, 'VIP replaced (Z-6)').not.toContain('VIP');
    }, 120_000);
    expect(phoneDigits(seen), 'The phone is kept').toContain(phoneDigits(OLD_PHONE));
  });

  // ---- Create/Update a Lead ----

  test('Lead: 1 Prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Lead > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.lead }]);
    await unsubscribe({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    const found = await crm.waitForRecord('Leads', row['Email']);
    expect(found, `No Zoho lead for ${row['Email']}`).toBeTruthy();
    const text = await crm.waitForNotes('Leads', found!.id, 1);
    expect(ZohoCrmPage.field(text, 'Company')).toBe(row['Company']);
    for (const value of [row['Job Title'], row['City']]) expect(text).toContain(value);
    expect(phoneDigits(text), 'The lead phone').toContain(phoneDigits(row['Phone Number']));
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
    // Unconfirmed: whether a Lead-only unsubscribe also makes a contact with the tag. Recorded for the cases file.
    const contacts = await crm.find('Contacts', row['Email']);
    test.info().annotations.push({ type: 'contacts made by a Lead-only unsubscribe (unconfirmed)', description: String(contacts.length) });
    if (contacts[0]) test.info().annotations.push({ type: `tag ${TAG} on that contact (unconfirmed)`, description: String(hasTag(await crm.recordText('Contacts', contacts[0].id))) });
    record('Leads', text);
    expect((await crm.find('Leads', row['Email'])).length, 'One unsubscribe must make one lead').toBe(1);
  });

  test('Lead: 2 Lead exists for the prospect email', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Lead > 2');
    const id = await new ZohoForms(crm).createLead({ first: row['First Name'], last: row['Last Name'], email: row['Email'], company: `Old Company ${stamp}` });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.lead }]);
    await unsubscribe({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    await untilPasses('the lead is updated', async () => {
      const text = await crm.recordText('Leads', id);
      expect(ZohoCrmPage.field(text, 'Company')).toBe(row['Company']);
    }, 120_000);
    expect((await crm.find('Leads', row['Email'])).map((r) => r.id), 'Still 1 lead').toEqual([id]);
  });

  test('Lead: 3 Prospect has no company', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Lead > 3', { Company: '' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.lead }]);
    await unsubscribe({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    const found = await crm.waitForRecord('Leads', row['Email']);
    expect(found, `No Zoho lead for ${row['Email']}`).toBeTruthy();
    const text = await crm.recordText('Leads', found!.id);
    expect(ZohoCrmPage.field(text, 'Company')).toBe('');
  });

  // ---- Create/Update Account ----

  test('Account: 1 Prospect has a company, no contact, no account', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Account > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.account }]);
    await unsubscribe({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    const found = await crm.waitForRecord('Accounts', row['Company']);
    expect(found, `No Zoho account named ${row['Company']}`).toBeTruthy();
    const text = await crm.waitForNotes('Accounts', found!.id, 1);
    expect(ZohoCrmPage.field(text, 'Account Name')).toBe(row['Company']);
    for (const value of [row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
    expect((await crm.find('Accounts', row['Company'])).length).toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The Account action must not link a contact').toBe(0);
  });

  test('Account: 2 Contact exists and is linked to an account', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Account > 2');
    const accountName = `Linked Account ${stamp}`;
    const accountId = await crm.createAccount(accountName);
    const contactId = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'], account: accountName });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.account }]);
    await unsubscribe({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    await untilPasses('the linked account is updated', async () => {
      const text = await crm.recordText('Accounts', accountId);
      for (const value of [row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    }, 120_000);
    expect(ZohoCrmPage.field(await crm.recordText('Accounts', accountId), 'Account Name'), 'The account name is kept').toBe(accountName);
    // The cases file: the contact gets the tag. It may come a little after the account, so it is waited for.
    await untilPasses('the contact has the tag', async () => {
      expect(await crm.recordText('Contacts', contactId), `The tag ${TAG}`).toContain(TAG);
    }, 120_000);
  });

  // ---- Create/Update a Deal ----

  test('Deal: 1 Prospect not in Zoho, has a company, Closing date 0', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Deal > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.deal, closingDays: '0' }]);
    await unsubscribe({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    const found = await crm.waitForRecord('Deals', fullName(row));
    expect(found, `No Zoho deal named ${fullName(row)}`).toBeTruthy();
    const text = await crm.waitForNotes('Deals', found!.id, 1);
    expect(ZohoCrmPage.field(text, 'Deal Name')).toBe(fullName(row));
    expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
    expect(ZohoCrmPage.field(text, 'Stage')).toBe('Qualification');
    expect(ZohoCrmPage.field(text, 'Closing Date')).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe('');
    expect(ZohoCrmPage.noteCount(text), 'One note').toBe(1);
    expect((await crm.find('Deals', fullName(row))).length, 'One unsubscribe must make one deal').toBe(1);
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
    await unsubscribe({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    await untilPasses('the newest deal is updated', async () => {
      const text = await crm.recordText('Deals', newerId);
      expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
      expect(ZohoCrmPage.noteCount(text)).toBeGreaterThanOrEqual(1);
    }, 120_000);
    const older = await crm.recordText('Deals', olderId);
    expect(ZohoCrmPage.field(older, 'Amount'), 'The older deal is unchanged').toContain('100.00');
    expect(ZohoCrmPage.noteCount(older)).toBe(0);
  });

  test('Deal: 3 Contact has a linked deal in Stage Needs Analysis', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Deal > 3');
    const forms = new ZohoForms(crm);
    const contactId = await forms.createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    const dealId = await forms.createDeal({ name: `Staged Deal ${stamp} ${row['Last Name']}`, closing: inDays(30), contact: fullName(row), amount: '100', stage: 'Needs Analysis' });
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.contact }, { action: ZOHO_ACTION.deal, closingDays: '0' }]);
    await unsubscribe({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    // Run VU1: the contact and the tag are updated, the deal is updated by its id and its Stage is kept.
    await untilPasses('the contact has the tag and the deal is updated', async () => {
      expect(await crm.recordText('Contacts', contactId), `The tag ${TAG}`).toContain(TAG);
      const text = await crm.recordText('Deals', dealId);
      expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
    }, 120_000);
    expect(ZohoCrmPage.field(await crm.recordText('Deals', dealId), 'Stage'), 'The Stage set by hand is kept').toBe('Needs Analysis');
    expect((await crm.find('Deals', fullName(row))).length, 'No second deal is made').toBe(0);
  });

  // ---- Create a Task ----

  test('Task: 1 Prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Task > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.task, task: TASK }]);
    await unsubscribe({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    const found = await crm.waitForRecord('Tasks', fullName(row));
    expect(found, `No Zoho task for ${fullName(row)}`).toBeTruthy();
    const text = await crm.recordText('Tasks', found!.id);
    expect(ZohoCrmPage.field(text, 'Subject')).toBe(TASK.subject);
    expect(ZohoCrmPage.field(text, 'Status')).toBe(TASK.status);
    expect(ZohoCrmPage.field(text, 'Priority')).toBe(TASK.priority);
    expect(ZohoCrmPage.field(text, 'Due Date')).toBe(inDays(3));
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    expect((await crm.find('Tasks', fullName(row))).length, 'One unsubscribe must make one task').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The contact is created first').toBe(1);
  });

  test('Task: 2 Subject left empty', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Task > 2');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [{ action: ZOHO_ACTION.task, task: { ...TASK, subject: '' } }]);
    await unsubscribe({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    // "The run still completes" is in Logs, which Zoho rows do not read (QA 2026-10-29). With no task there is no task note
    // to read, so only the missing task is checked.
    expect(await crm.waitForRecord('Tasks', fullName(row), 60_000), 'No task may be created').toBeUndefined();
  });

  // ---- Combined actions ----

  test('Combined: 1 Contact, Lead, Account, Deal and Task all selected, prospect not in Zoho', async ({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }) => {
    const row = prospect('Combined > 1');
    await configure(zohoIntegration, saleshandyPage, TRIGGER, [
      { action: ZOHO_ACTION.contact },
      { action: ZOHO_ACTION.lead },
      { action: ZOHO_ACTION.account },
      { action: ZOHO_ACTION.deal, closingDays: '0' },
      { action: ZOHO_ACTION.task, task: TASK },
    ]);
    await unsubscribe({ zohoIntegration, saleshandyPage, saleshandySequence, mailinator, crm }, row);
    const contact = await crm.waitForRecord('Contacts', row['Email']);
    expect(contact, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    // Run U3: all five actions worked. The note count of that run is not recorded, so it is recorded here, not asserted.
    const text = await crm.waitForNotes('Contacts', contact!.id, 1);
    test.info().annotations.push({ type: 'notes on the contact (run U3 count not recorded)', description: String(ZohoCrmPage.noteCount(text)) });
    expect(text, `The tag ${TAG}`).toContain(TAG);
    record('Contacts', text);
    expect((await crm.find('Contacts', row['Email'])).length, 'One unsubscribe must make one contact').toBe(1);
    expect((await crm.find('Leads', row['Email'])).length, 'The lead').toBe(1);
    expect((await crm.find('Deals', fullName(row))).length, 'The deal').toBe(1);
    expect((await crm.find('Tasks', fullName(row))).length, 'The task').toBe(1);
    // Accounts: Z-5 (known) allows more than one, so they are not counted.
  });
});
