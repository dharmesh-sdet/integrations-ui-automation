// Scenarios: test-cases/zoho/conversation-category-updated.md (Regression, 20 rows, QA "looks good" 2026-10-30, no ticket per row).
// One test per row, named "<section>: <n> <scenario>". Rows marked "(proposed, unconfirmed)" in the cases keep an
// Expected that no source documents (Trigger and category gate 3 and 5); a different result there is not a failure by itself.
// Data: test-data/zoho/conversation-category-updated.csv (npm run data:zoho-conversation-category-updated), one prospect
// per row (19; "Trigger and category gate > 2" has none), found by the Scenario column.
// Sequence: id 197611 on gzoho (dharmesh+zohointegration@saleshandy.com), made by QA 2026-11-03 with many sender
//   mailboxes. ZOHO_CC_SEQUENCE_ID overrides the id.
// Zoho CRM is read in a headed browser on its own copy of the saved profile, so run it through xvfb-run (see
// package.json `test:zoho-conversation-category-updated`). QA 2026-11-03: Email Sent testing on gzoho is done and no
// other workflow uses gzoho, so the spec turns every other trigger off (KEEP_OTHER_TRIGGERS=0). Email Sent must be OFF,
// or every step 1 send would create a contact first.
//
// How a row runs: set the trigger, its action and its category, make the Zoho records the row needs, add the prospect,
// send step 1 with Send now (the prospect starts at "Add Outcome"), change the outcome on Sequence > Prospects. Then look
// in Zoho 15 s later, every 10 s after that (QA). Logs are not used for Zoho (QA 2026-10-29). Rows do not delete what
// they create. A saved category may not be clearable (Pipedrive finding, unconfirmed here), so the empty-category row
// runs first.
// Known issues are recorded, not filed: Z-1, Z-5, Q3, Z-7 (Meeting Booked never matches), Z-8, Z-9. On 2026-10-29 a new
// contact made two Tasks in 2 of 2 runs and two Deals in 1 of 2 (Email Sent). The rows expect one record, so a
// repeat shows Fail until QA decides if it is a bug.
import path from 'node:path';
import { expect, test as base } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { ZOHO_ACTION, fullName, sendAndReply } from '../../src/flows/saleshandy-to-zoho.ts';
import { inDays, sendStep } from '../../src/flows/zoho-email-sent.ts';
import {
  NOTE_PREFIX,
  OUTCOME,
  SEQUENCE_NAME,
  TRIGGER,
  configureCategory,
  expectSavedCategory,
  outcomeNotes,
  setInboxCategory,
  type CategoryAction,
} from '../../src/flows/zoho-conversation-category-updated.ts';
import { ZohoCrmPage, openZohoProfile } from '../../src/pages/zoho/zoho-crm.page.ts';
import { ZohoForms } from '../../src/pages/zoho/zoho-forms.page.ts';
import { untilPasses } from '../../src/utils/wait.ts';

process.env.KEEP_OTHER_TRIGGERS ??= '0';

const CSV = 'zoho/conversation-category-updated.csv';
const SEQUENCE_ID = process.env.ZOHO_CC_SEQUENCE_ID ?? '197611';
// Own copy of auth/mcp-zoho-profile (the gzoho Zoho org), made 2026-11-03.
const PROFILE = path.resolve(import.meta.dirname, '../../auth/zoho-cc-gzoho-profile');

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
  if (!SEQUENCE_ID) throw new Error('Set ZOHO_CC_SEQUENCE_ID to the id of "Zoho Conversation Category QA"');
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
const TASK = { subject: 'Follow up after outcome change', status: 'Not Started', priority: 'Normal', dueIn: '3' };

type Fx = Parameters<Parameters<typeof test>[2]>[0];
type Env = Pick<Fx, 'zohoIntegration' | 'saleshandyPage' | 'saleshandySequence' | 'crm'>;

// The last configuration saved, so consecutive rows with the same action and category do not save it again.
let configured = '';
async function useTrigger(fx: Env, actions: CategoryAction[], readBack = false): Promise<void> {
  const key = JSON.stringify(actions);
  if (configured !== key || readBack) {
    await configureCategory(fx.zohoIntegration, fx.saleshandyPage, actions);
    configured = key;
  }
  // Reload and read the saved category back before the outcome changes (test-case setup).
  if (readBack) for (const a of actions) if (a.category !== undefined) await expectSavedCategory(fx.zohoIntegration, fx.saleshandyPage, a.action, a.category);
}

// Adds the prospect to the sequence, sends step 1 (the Emails tab shows Sent), then changes the outcome.
async function sendAndChange(fx: Env, row: Row, outcome: string): Promise<void> {
  await sendStep(fx.saleshandySequence, SEQUENCE_ID, row);
  await fx.saleshandySequence.setProspectOutcome(SEQUENCE_ID, row['Email'], outcome);
}

// Waits until a record's page shows the note of the outcome event; returns the page text.
async function noteText(crm: ZohoCrmPage, module: 'Contacts' | 'Leads' | 'Accounts' | 'Deals' | 'Tasks', id: string, outcome: string, atLeast = 1): Promise<string> {
  let text = '';
  await untilPasses(`${module} ${id} shows ${atLeast} "${NOTE_PREFIX} ${outcome}" note(s)`, async () => {
    text = await crm.recordText(module, id);
    expect(outcomeNotes(text)).toBeGreaterThanOrEqual(atLeast);
    expect(text).toContain(`${NOTE_PREFIX} ${outcome}`);
  }, 120_000);
  return text;
}

test.describe('Zoho Conversation Category is Updated (staging)', () => {
  test.setTimeout(10 * 60_000);

  // ---- Trigger and category gate ----

  // Runs first: the empty category needs a trigger that never saved one (see the header).
  test('Trigger and category gate: 3 Category left empty, outcome Not Now', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    // QA 2026-11-03: skipped. A category saved by an earlier row stays saved, which is expected. The empty-category
    // check was done before the full script (2026-10-31: the empty box saves, 1 contact, 1 note).
    test.skip(true, 'Empty category checked before the full script (QA 2026-11-03)');
    const row = prospect('Trigger and category gate > 3');
    await useTrigger({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, [{ action: ZOHO_ACTION.contact }]);
    // The box must be empty after a reload. A category saved by an earlier row would make this a different row.
    await expectSavedCategory(zohoIntegration, saleshandyPage, ZOHO_ACTION.contact, '');
    await sendAndChange({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row, OUTCOME.notNow);
    // Proposed, unconfirmed for an empty box in the UI (run C3 made a contact and a note).
    const found = await crm.waitForRecord('Contacts', row['Email']);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    await noteText(crm, 'Contacts', found!.id, OUTCOME.notNow);
    expect((await crm.find('Contacts', row['Email'])).length, 'One contact').toBe(1);
  });

  test('Trigger and category gate: 1 Trigger OFF, action and category saved earlier', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Trigger and category gate > 1');
    await useTrigger({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, [{ action: ZOHO_ACTION.contact, category: OUTCOME.interested }]);
    // Only this trigger goes off. The action and the category stay saved on it.
    await zohoIntegration.openTriggers();
    await zohoIntegration.turnOff(TRIGGER);
    await zohoIntegration.save();
    await zohoIntegration.savedToast().waitFor({ timeout: 20_000 });
    configured = '';
    await sendAndChange({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row, OUTCOME.interested);
    expect(await crm.waitForRecord('Contacts', row['Email'], 60_000), 'Nothing may be created with the trigger off').toBeUndefined();
  });

  test('Trigger and category gate: 2 Trigger ON, category saved, page reloaded', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    await useTrigger({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, [{ action: ZOHO_ACTION.contact, category: OUTCOME.interested }], true);
    await saleshandyPage.reload();
    await zohoIntegration.openTriggers();
    expect(await zohoIntegration.isTriggerOn(TRIGGER)).toBe(true);
    expect(await zohoIntegration.selectedActivities(TRIGGER)).toEqual([ZOHO_ACTION.contact]);
    await expectSavedCategory(zohoIntegration, saleshandyPage, ZOHO_ACTION.contact, OUTCOME.interested);
  });

  test('Trigger and category gate: 4 Category Meeting Booked, outcome Meeting Booked', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Trigger and category gate > 4');
    await useTrigger({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, [{ action: ZOHO_ACTION.contact, category: OUTCOME.meetingBooked }]);
    await sendAndChange({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row, OUTCOME.meetingBooked);
    // QA 2026-11-03: Meeting Booked now matches the saved category (runs 2026-11-03 made the contact).
    const found = await crm.waitForRecord('Contacts', row['Email']);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    await noteText(crm, 'Contacts', found!.id, OUTCOME.meetingBooked);
    expect((await crm.find('Contacts', row['Email'])).length, 'One contact').toBe(1);
  });

  test('Trigger and category gate: 5 Prospect replied, category set to Interested in Unified Inbox', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    // QA 2026-11-03: skipped. The row needs a real reply in Unified Inbox from a mailbox QA controls.
    test.skip(true, 'Needs a real reply in Unified Inbox (QA 2026-11-03)');
    const row = prospect('Trigger and category gate > 5');
    await useTrigger({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, [{ action: ZOHO_ACTION.contact, category: OUTCOME.interested }]);
    await sendAndReply(saleshandySequence, SEQUENCE_ID, row);
    await setInboxCategory(saleshandyPage, row, OUTCOME.interested);
    // Proposed, unconfirmed: one contact and one note. A reply also fires this workflow (the gate decides).
    const found = await crm.waitForRecord('Contacts', row['Email']);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    await noteText(crm, 'Contacts', found!.id, OUTCOME.interested);
    expect((await crm.find('Contacts', row['Email'])).length, 'One contact').toBe(1);
  });

  // ---- Create/Update a Contact ----

  const contactPick: CategoryAction[] = [{ action: ZOHO_ACTION.contact, category: OUTCOME.interested }];

  test('Contact: 1 Prospect not in Zoho, outcome Interested', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 1');
    await useTrigger({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, contactPick, true);
    await sendAndChange({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row, OUTCOME.interested);
    const found = await crm.waitForRecord('Contacts', row['Email']);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    const text = await noteText(crm, 'Contacts', found!.id, OUTCOME.interested);
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    for (const value of [row['Job Title'], row['Department'], row['Twitter'], row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect(phoneDigits(text)).toContain(phoneDigits(row['Phone Number']));
    expect(text, 'Note carries the sequence name').toContain(SEQUENCE_NAME);
    // TODO(needs-input): how the sequence link shows in the note text is not recorded; the id is the guess.
    expect.soft(text, 'Note carries the sequence link').toContain(SEQUENCE_ID);
    expect(outcomeNotes(text), 'One note').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length).toBe(1);
  });

  test('Contact: 2 Contact exists with an old Title', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 2');
    const id = await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'], title: 'Old Title' });
    await useTrigger({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, contactPick);
    await sendAndChange({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row, OUTCOME.interested);
    await untilPasses('the contact is updated', async () => {
      const text = await crm.recordText('Contacts', id);
      expect(text).toContain(row['Job Title']);
      expect(text).not.toContain('Old Title');
    }, 120_000);
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'Still one contact').toEqual([id]);
  });

  test('Contact: 3 Prospect not in Zoho, outcome Not Interested', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 3');
    await useTrigger({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, contactPick);
    await sendAndChange({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row, OUTCOME.notInterested);
    // Run C2: the category is Interested and the outcome is not, so the gate is false.
    expect(await crm.waitForRecord('Contacts', row['Email'], 60_000), 'No contact and no note').toBeUndefined();
  });

  test('Contact: 4 Outcome Interested, then Not Interested', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Contact > 4');
    await useTrigger({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, contactPick);
    await sendAndChange({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row, OUTCOME.interested);
    const found = await crm.waitForRecord('Contacts', row['Email']);
    expect(found, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    await noteText(crm, 'Contacts', found!.id, OUTCOME.interested);
    expect((await crm.find('Contacts', row['Email'])).length, 'One contact after the first change').toBe(1);
    await saleshandySequence.setProspectOutcome(SEQUENCE_ID, row['Email'], OUTCOME.notInterested);
    // Nothing runs for the second change, so wait the same time and check that nothing was added.
    await crm.page.waitForTimeout(30_000);
    expect((await crm.find('Contacts', row['Email'])).map((r) => r.id), 'Still one contact').toEqual([found!.id]);
    const text = await crm.recordText('Contacts', found!.id);
    expect(outcomeNotes(text), 'Still one note').toBe(1);
    expect(text).not.toContain(`${NOTE_PREFIX} ${OUTCOME.notInterested}`);
  });

  // ---- Create/Update a Lead ----

  const leadPick: CategoryAction[] = [{ action: ZOHO_ACTION.lead, category: OUTCOME.notInterested }];

  test('Lead: 1 Prospect not in Zoho, has a company, outcome Not Interested', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Lead > 1');
    await useTrigger({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, leadPick);
    await sendAndChange({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row, OUTCOME.notInterested);
    const found = await crm.waitForRecord('Leads', row['Email']);
    expect(found, `No Zoho lead for ${row['Email']}`).toBeTruthy();
    const text = await noteText(crm, 'Leads', found!.id, OUTCOME.notInterested);
    expect(ZohoCrmPage.field(text, 'Company')).toBe(row['Company']);
    for (const value of [row['Job Title'], row['City']]) expect(text).toContain(value);
    expect(phoneDigits(text)).toContain(phoneDigits(row['Phone Number']));
    expect((await crm.find('Leads', row['Email'])).length, 'One lead').toBe(1);
  });

  test('Lead: 2 Lead exists for the prospect email, old Company', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Lead > 2');
    // The cases say old City; ZohoForms.createLead sets no City, so the old value is the Company (as Link Clicked).
    const id = await new ZohoForms(crm).createLead({ first: row['First Name'], last: row['Last Name'], email: row['Email'], company: `Old Company ${stamp}` });
    await useTrigger({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, leadPick);
    await sendAndChange({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row, OUTCOME.notInterested);
    await untilPasses('the lead is updated', async () => {
      const text = await crm.recordText('Leads', id);
      expect(ZohoCrmPage.field(text, 'Company')).toBe(row['Company']);
      expect(text).toContain(row['City']);
    }, 120_000);
    expect((await crm.find('Leads', row['Email'])).map((r) => r.id), 'Still one lead').toEqual([id]);
  });

  test('Lead: 3 Prospect not in Zoho, outcome Interested', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Lead > 3');
    await useTrigger({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, leadPick);
    await sendAndChange({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row, OUTCOME.interested);
    expect(await crm.waitForRecord('Leads', row['Email'], 60_000), 'No lead and no note').toBeUndefined();
  });

  // ---- Create/Update Account ----

  const accountPick: CategoryAction[] = [{ action: ZOHO_ACTION.account, category: OUTCOME.outOfOffice }];

  test('Account: 1 Prospect has a company, no contact, no account, outcome Out of Office', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Account > 1');
    await useTrigger({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, accountPick);
    await sendAndChange({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row, OUTCOME.outOfOffice);
    const found = await crm.waitForRecord('Accounts', row['Company']);
    expect(found, `No Zoho account named ${row['Company']}`).toBeTruthy();
    const text = await noteText(crm, 'Accounts', found!.id, OUTCOME.outOfOffice);
    expect(ZohoCrmPage.field(text, 'Account Name')).toBe(row['Company']);
    for (const value of [row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    expect((await crm.find('Accounts', row['Company'])).length).toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The Account action must not link or create a contact').toBe(0);
  });

  test('Account: 2 Contact exists and is linked to an account', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Account > 2');
    const accountName = `Linked Account ${stamp}`;
    // The cases say old Website; ZohoCrmPage.createAccount sets only the name, so the update shows as the
    // mapped City, State and Country appearing on the account.
    const accountId = await crm.createAccount(accountName);
    await new ZohoForms(crm).createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'], account: accountName });
    await useTrigger({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, accountPick);
    await sendAndChange({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row, OUTCOME.outOfOffice);
    await untilPasses('the linked account is updated', async () => {
      const text = await crm.recordText('Accounts', accountId);
      for (const value of [row['City'], row['State'], row['Country']]) expect(text).toContain(value);
    }, 120_000);
    // QA 2026-11-03: Company is mapped to Account Name, so the linked account takes the prospect's company name.
    expect(ZohoCrmPage.field(await crm.recordText('Accounts', accountId), 'Account Name'), 'The linked account takes the company name').toBe(row['Company']);
    // The renamed linked account is the only account with that name, so no second account is made.
    expect((await crm.find('Accounts', row['Company'])).length, 'Only the linked account has the company name').toBe(1);
  });

  test('Account: 3 Prospect has no company, outcome Out of Office', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Account > 3', { Company: '' });
    await useTrigger({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, accountPick);
    await sendAndChange({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row, OUTCOME.outOfOffice);
    // Zoho needs an Account Name, so nothing is made. An account made from no company has no name to search for
    // (other sessions add accounts in this org at the same time), so only the contact side is checked.
    expect(await crm.waitForRecord('Contacts', row['Email'], 60_000), 'No account and no contact may be created').toBeUndefined();
  });

  // ---- Create/Update a Deal ----

  const dealPick: CategoryAction[] = [{ action: ZOHO_ACTION.deal, closingDays: '0', category: OUTCOME.closed }];

  test('Deal: 1 Prospect not in Zoho, has a company, outcome Closed', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Deal > 1');
    await useTrigger({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, dealPick);
    await sendAndChange({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row, OUTCOME.closed);
    const found = await crm.waitForRecord('Deals', fullName(row));
    expect(found, `No Zoho deal named ${fullName(row)}`).toBeTruthy();
    const text = await noteText(crm, 'Deals', found!.id, OUTCOME.closed);
    expect(ZohoCrmPage.field(text, 'Deal Name')).toBe(fullName(row));
    expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
    expect(ZohoCrmPage.field(text, 'Stage')).toBe('Qualification');
    expect(ZohoCrmPage.field(text, 'Closing Date')).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    // An empty Contact Name is followed directly by the next label (run 2026-11-03: "Modified By").
    expect(ZohoCrmPage.field(text, 'Contact Name', 'Modified By')).toBe('');
    expect((await crm.find('Deals', fullName(row))).length, 'One deal').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The Deal action must not create a contact').toBe(0);
    // Z-5 (known): the deal also makes an account named after the company.
    expect(await crm.waitForRecord('Accounts', row['Company'], 30_000)).toBeTruthy();
  });

  test('Deal: 2 Contact has 2 deals, outcome Closed', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Deal > 2');
    const forms = new ZohoForms(crm);
    await forms.createContact({ first: row['First Name'], last: row['Last Name'], email: row['Email'] });
    const olderId = await forms.createDeal({ name: `Older Deal ${stamp} ${row['Last Name']}`, closing: inDays(30), contact: fullName(row), amount: '100' });
    const newerId = await forms.createDeal({ name: `Newer Deal ${stamp} ${row['Last Name']}`, closing: inDays(30), contact: fullName(row), amount: '200' });
    await useTrigger({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, dealPick);
    await sendAndChange({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row, OUTCOME.closed);
    await untilPasses('the newest deal is updated', async () => {
      const text = await crm.recordText('Deals', newerId);
      expect(ZohoCrmPage.field(text, 'Amount')).toContain(Number(row['Deal Value']).toLocaleString('en-US'));
      expect(outcomeNotes(text)).toBeGreaterThanOrEqual(1);
    }, 120_000);
    const older = await crm.recordText('Deals', olderId);
    expect(ZohoCrmPage.field(older, 'Amount'), 'The older deal is unchanged').toContain('100.00');
    expect(ZohoCrmPage.noteCount(older)).toBe(0);
  });

  // ---- Create a Task ----

  const taskPick = (task = TASK): CategoryAction[] => [{ action: ZOHO_ACTION.task, task, category: OUTCOME.doNotContact }];

  test('Task: 1 Prospect not in Zoho, outcome Do Not Contact', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Task > 1');
    await useTrigger({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, taskPick());
    await sendAndChange({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row, OUTCOME.doNotContact);
    const found = await crm.waitForRecord('Tasks', fullName(row));
    expect(found, `No Zoho task for ${fullName(row)}`).toBeTruthy();
    const text = await crm.recordText('Tasks', found!.id);
    expect(ZohoCrmPage.field(text, 'Subject')).toBe(TASK.subject);
    expect(ZohoCrmPage.field(text, 'Status')).toBe(TASK.status);
    expect(ZohoCrmPage.field(text, 'Priority')).toBe(TASK.priority);
    expect(ZohoCrmPage.field(text, 'Due Date')).toBe(inDays(3));
    expect(ZohoCrmPage.field(text, 'Contact Name')).toBe(fullName(row));
    expect((await crm.find('Tasks', fullName(row))).length, 'One task').toBe(1);
    expect((await crm.find('Contacts', row['Email'])).length, 'The contact is created first').toBe(1);
  });

  test('Task: 2 Subject left empty, Save stays disabled', async ({ zohoIntegration, saleshandyPage }) => {
    // QA 2026-11-03: Save in the Task Extra Configuration is disabled while Subject is empty (seen in run
    // 2026-11-03), so no email is sent and no prospect is used. Due In and the category are filled, Subject only is empty.
    await zohoIntegration.openTriggers();
    await zohoIntegration.enableOnly(TRIGGER);
    for (const chip of await zohoIntegration.selectedActivities(TRIGGER)) await zohoIntegration.removeActivity(TRIGGER, chip);
    configured = '';
    await zohoIntegration.selectActivity(TRIGGER, ZOHO_ACTION.task);
    const dialog = saleshandyPage.getByRole('dialog');
    await dialog.waitFor({ timeout: 15_000 });
    await dialog.getByRole('spinbutton').fill(TASK.dueIn);
    await dialog.getByRole('textbox').first().fill('');
    await dialog.getByRole('textbox').last().fill(OUTCOME.doNotContact);
    await expect(dialog.getByRole('button', { name: 'Save', exact: true }), 'Save is disabled while Subject is empty').toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  });

  // ---- Combined actions ----

  test('Combined: 1 Contact, Lead, Account, Deal and Task, prospect not in Zoho, outcome Interested', async ({ zohoIntegration, saleshandyPage, saleshandySequence, crm }) => {
    const row = prospect('Combined > 1');
    await useTrigger({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, [
      { action: ZOHO_ACTION.contact, category: OUTCOME.interested },
      { action: ZOHO_ACTION.lead, category: OUTCOME.interested },
      { action: ZOHO_ACTION.account, category: OUTCOME.interested },
      { action: ZOHO_ACTION.deal, closingDays: '0', category: OUTCOME.interested },
      { action: ZOHO_ACTION.task, task: TASK, category: OUTCOME.interested },
    ]);
    await sendAndChange({ zohoIntegration, saleshandyPage, saleshandySequence, crm }, row, OUTCOME.interested);
    const contact = await crm.waitForRecord('Contacts', row['Email']);
    expect(contact, `No Zoho contact for ${row['Email']}`).toBeTruthy();
    expect((await crm.find('Contacts', row['Email'])).length, 'One contact').toBe(1);
    const lead = (await crm.find('Leads', row['Email']))[0];
    const deal = (await crm.find('Deals', fullName(row)))[0];
    const task = (await crm.find('Tasks', fullName(row)))[0];
    expect((await crm.find('Leads', row['Email'])).length, 'The lead').toBe(1);
    expect((await crm.find('Deals', fullName(row))).length, 'The deal').toBe(1);
    expect((await crm.find('Tasks', fullName(row))).length, 'The task').toBe(1);
    // All records get a note (run C5). Accounts: Z-5 (known) allows more than one, so they are not counted.
    await noteText(crm, 'Contacts', contact!.id, OUTCOME.interested);
    await noteText(crm, 'Leads', lead.id, OUTCOME.interested);
    await noteText(crm, 'Deals', deal.id, OUTCOME.interested);
    await noteText(crm, 'Tasks', task.id, OUTCOME.interested);
  });
});
