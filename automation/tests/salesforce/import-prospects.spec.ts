// Scenarios: test-cases/salesforce/import-prospects.md (Regression, QA looks good 2026-11-13), 21 rows, one test per row
// ("Row N" in the test title). Rows that need the same click were merged into one row on 2026-11-13 (QA).
// Account: importprospects (fresh, QA 2026-11-13): Salesforce connected, Field Mapping set by
// tests/setup/salesforce-field-mapping.spec.ts and salesforce-import-prospects-mapping.spec.ts, Draft sequence made by
// tests/setup/salesforce-import-prospects-sequence.spec.ts (SETUP_ACCOUNT=importprospects).
// Data: the 6 Contacts of scripts/make-salesforce-import-prospects-contacts.ts, all in the Salesforce List View
// "Import Prospects QA" (Mailing City Rotterdam). Expected values are read from Salesforce, not typed here.
//
// The rows run as ONE chain, in file order, on the fresh account, once:
//  - Saved Extra Configuration cannot be cleared again, so the empty-field rows (5, 6) run first.
//  - Add Prospect stays saved once set, so rows 17 and 18 run with Add Prospect also saved.
//  - Skipped, with the reason in the test: row 19 (needs a second fresh account, the Step cannot be cleared), row 20
//    (needs an Active sequence that sends mail), and row 15 (verified by hand by QA on "My Contacts", 2026-11-13).
// A second run needs new Contacts (run scripts/make-salesforce-import-prospects-contacts.ts after removing the
// Rotterdam Contacts) and a new fresh account. To rerun failed rows only, use -g "Row N" with KEEP_TEST_DATA=1. Row 16
// makes a new Contact: use VERIFY_ONLY=1 to check its result again without a second click.
// "(proposed, unconfirmed)" rows are recorded as "Needs QA" annotations, the others are asserted. Row 21 records the
// result (chip comes back, bug AL-4228) as a note: it does not fail the run.
//
// Run: KEEP_TEST_DATA=1 REPORT_OPEN=never npx playwright test --project=chromium tests/salesforce/import-prospects.spec.ts --workers=1
import { expect, test } from '../../src/fixtures/index.ts';
import { check, expectProspect, fullName } from '../../src/flows/salesforce-to-saleshandy.ts';
import type { Row } from '../../src/data/csv.ts';
import type { SaleshandyCrmPage } from '../../src/pages/saleshandy/crm.page.ts';
import {
  ADD_ACTIVITY,
  ADD_LIST,
  IMPORT_TRIGGER,
  MOVE_ACTIVITY,
  MOVE_LIST,
  type SalesforceProspectsImportPage,
} from '../../src/pages/saleshandy/salesforce-prospects-import.page.ts';
import { SalesforceApi } from '../../src/utils/salesforce-api.ts';
import { untilPasses } from '../../src/utils/wait.ts';

test.use({ account: 'importprospects' });
test.describe.configure({ mode: 'serial', retries: 0 });

const VIEW = 'Import Prospects QA';
const BIRTHDAYS = 'Birthdays This Month';
const SEQUENCE = 'Salesforce Import Prospects QA';
const STEP_1 = 'Step 1 - Day 1';
const ROW_TIMEOUT_MS = 10 * 60_000;
const CONTACT_VIEWS = ['All Contacts', 'Bulk SMS Contacts', 'New Last Week', 'New This Week', BIRTHDAYS, 'Recently Viewed Contacts', 'My Contacts'];
const LEAD_VIEWS = ['All Open Leads', 'My Unread Leads', "Today's Leads"];

// ---- Salesforce side: what the import must produce ----

let session: SalesforceApi | undefined;
async function sf(): Promise<SalesforceApi> {
  return (session ??= await SalesforceApi.login());
}

type Contact = { id: string; first: string; last: string; email: string; title: string; phone: string; department: string; account: string };

async function contacts(): Promise<Contact[]> {
  const rows = await (await sf()).query(
    "SELECT Id, FirstName, LastName, Email, Title, Phone, Department, Account.Name FROM Contact WHERE MailingCity = 'Rotterdam' ORDER BY LastName",
  );
  return rows.map((r) => ({
    id: r.Id,
    first: r.FirstName ?? '',
    last: r.LastName,
    email: r.Email ?? '',
    title: r.Title ?? '',
    phone: r.Phone ?? '',
    department: r.Department ?? '',
    account: r.Account?.Name ?? '',
  }));
}

const by = (list: Contact[], last: string): Contact => {
  const c = list.find((x) => x.last === last);
  if (!c) throw new Error(`Contact ${last} is not in the List View. Run scripts/make-salesforce-import-prospects-contacts.ts.`);
  return c;
};

// Saleshandy field label to value, for the fields Field Mapping fills. Company has no mapping: it is the Account name.
const fieldsOf = (c: Contact): Record<string, string> => ({
  ...(c.first ? { 'First Name': c.first } : {}),
  'Last Name': c.last,
  ...(c.title ? { 'Job Title': c.title } : {}),
  ...(c.phone ? { 'Phone Number': c.phone } : {}),
  ...(c.department ? { Department: c.department } : {}),
  ...(c.account ? { Company: c.account } : {}),
});
const rowOf = (c: Contact): Row => ({ 'First Name': c.first, 'Last Name': c.last, Email: c.email }) as Row;
const withEmail = (list: Contact[]) => list.filter((c) => c.email);

// ---- Saleshandy side ----

// Clicks "Import Prospects". Returns the outcome and, when the event was sent, waits for a NEW Logs row to show
// Success (rows are told apart by execution id, not time). The Logs row says Success also when a prospect was rejected.
async function importOnce(i: SalesforceProspectsImportPage): Promise<'started' | string> {
  await i.openLogs();
  const before = new Set((await i.logEntries(IMPORT_TRIGGER)).map((e) => e.id));
  await i.open();
  const outcome = await i.clickImport();
  if (outcome !== 'started') return outcome;
  await i.openLogs();
  await untilPasses('Logs did not show a new Import Prospects from Salesforce row as Success', async () => {
    await i.refreshLogs();
    const entry = (await i.logEntries(IMPORT_TRIGGER)).find((e) => !before.has(e.id));
    expect(entry?.status, 'status of the new Logs row').toBe('Success');
  });
  return outcome;
}

// A click that must import nothing: the page refuses it, or the run ends Success, and the prospect total stays.
async function expectNothingImported(i: SalesforceProspectsImportPage, crm: SaleshandyCrmPage, what: string): Promise<void> {
  const before = await crm.total();
  const outcome = await importOnce(i);
  test.info().annotations.push({ type: what, description: outcome === 'started' ? 'event sent, run Success' : `page refused: ${outcome}` });
  expect(await crm.total(), `prospects after ${what}`).toBe(before);
}

async function expectSequence(crm: SaleshandyCrmPage, email: string, want: string): Promise<void> {
  await untilPasses(`Sequence of ${email} is not ${want}`, async () => {
    await crm.search(email);
    expect(await crm.sequenceAssociated(email), `Sequence Associated of ${email}`).toBe(want);
  }, 90_000);
}

// What the shared clicks left behind.
const state = { totalBeforeFirst: 0, firstContacts: [] as Contact[], secondContacts: [] as Contact[], totalBeforeSecond: 0 };

// A filtered rerun skips the test that fills the state, so the later tests read the Contacts from Salesforce.
async function firstList(): Promise<Contact[]> {
  if (state.firstContacts.length === 0) state.firstContacts = (await contacts()).filter((c) => c.last !== 'Petersen');
  return state.firstContacts;
}
async function secondList(): Promise<Contact[]> {
  if (state.secondContacts.length === 0) state.secondContacts = await contacts();
  return state.secondContacts;
}

test.describe('Import Prospects from Salesforce (importprospects)', () => {
  test.beforeEach(() => {
    test.setTimeout(ROW_TIMEOUT_MS);
  });

  // ---- Prospects Import tab (baseline) ----

  test('Row 1: tab starts clean, toggle off, no activity, button disabled', async ({ salesforceProspectsImport: i }) => {
    await i.open();
    expect(await i.isOn(), 'toggle').toBe(false);
    expect(await i.chips(), 'selected activities').toEqual([]);
    await expect(i.importButton()).toBeDisabled();
  });

  test('Row 2: toggle on offers the two activities', async ({ salesforceProspectsImport: i }) => {
    await i.open();
    await i.turnOn();
    const offered = await i.openActivityListAndRead();
    expect(offered).toEqual(expect.arrayContaining([ADD_ACTIVITY, MOVE_ACTIVITY]));
  });

  // The tab has no Save button: a toggle with no saved activity is not stored (seen 2026-11-13). The activity Add
  // Prospect was saved empty by a first look at the dialog on this account, so Both 3 runs with that saved.
  test('Row 3: no activity chip on the page, click Import Prospects', async ({ salesforceProspectsImport: i, saleshandyCrm: crm }) => {
    await i.open();
    if ((await i.chips()).includes(ADD_ACTIVITY)) await i.removeActivity(IMPORT_TRIGGER, ADD_ACTIVITY);
    await check(true, 'Both 3: button state with no chip', async () => expect(i.importButton()).toBeEnabled({ timeout: 5_000 }));
    if (await i.importButton().isEnabled()) await expectNothingImported(i, crm, 'Both 3');
  });

  test('Row 4: dialogs, List View names, Escape', async ({ salesforceProspectsImport: i }) => {
    await i.open();
    await i.openDialog(ADD_ACTIVITY);
    const addText = await i.dialogText();
    expect(addText, 'Add Prospect dialog').toContain(ADD_LIST);
    expect(addText, 'Add Prospect dialog has no Sequence field').not.toContain('Sequence Steps');
    // Baseline 4: Contact views only, Lead views absent.
    const views = await i.listViewOptions(ADD_LIST);
    expect(views, 'List View options').toEqual(expect.arrayContaining(CONTACT_VIEWS));
    expect(views.filter((v) => LEAD_VIEWS.includes(v)), 'Lead views in the list').toEqual([]);
    await i.saveDialog();
    // Move dialog fields. Both 5: Escape must not leave the activity selected without a List View. The Move
    // chip is still new here, so it shows what Escape does to a chip that was never saved.
    await i.pick(MOVE_ACTIVITY);
    const moveText = await i.dialogText();
    for (const label of [MOVE_LIST, 'Sequence', 'Sequence Steps']) expect(moveText, 'Move dialog').toContain(label);
    await i.page.keyboard.press('Escape');
    await check(true, 'Both 5: Escape on the Move dialog', async () => expect(await i.chips()).not.toContain(MOVE_ACTIVITY));
    // A chip left by Escape is not stored: saving its dialog did not keep the activity (seen 2026-11-13, needs QA).
    // So remove it and pick it again, which is how the activity gets saved.
    if ((await i.chips()).includes(MOVE_ACTIVITY)) await i.removeActivity(IMPORT_TRIGGER, MOVE_ACTIVITY);
    await i.pick(MOVE_ACTIVITY);
    await i.saveDialog();
  });

  // ---- Empty configuration (saved empty above) ----

  test('Row 5: Add Prospect List View empty, click Import Prospects', async ({ salesforceProspectsImport: i, saleshandyCrm: crm }) => {
    await i.open();
    expect(await i.chips(), 'chips after reload').toEqual(expect.arrayContaining([ADD_ACTIVITY, MOVE_ACTIVITY]));
    await expect(i.importButton()).toBeEnabled();
    await expectNothingImported(i, crm, 'Add Prospect 11');
  });

  test('Row 6: Move with Sequence and Step set, List View empty', async ({ salesforceProspectsImport: i, saleshandyCrm: crm }) => {
    await i.open();
    await i.openDialog(MOVE_ACTIVITY);
    await i.fill({ sequence: SEQUENCE, step: STEP_1 });
    await i.saveDialog();
    // Baseline 6: the Step must be saved after one dialog session. Seen 2026-11-12 by script: it was not.
    await i.open();
    await i.editChip(MOVE_ACTIVITY);
    const saved = (await i.dialogText()).includes(STEP_1);
    await check(true, 'Baseline 6: Step saved after one dialog session', async () => expect(saved).toBe(true));
    if (!saved) await i.fill({ step: STEP_1 });
    await i.saveDialog();
    await expectNothingImported(i, crm, 'Move 4');
  });

  test.skip('Row 19: Sequence picked, Step empty (needs a second fresh account, a saved Step cannot be cleared)', async () => {});

  // ---- First import: Add Prospect, Move has no List View (Both 2) ----

  test('Row 7: view with the invalid email b.levy@expressl&t.net', async ({ salesforceProspectsImport: i, saleshandyCrm: crm }) => {
    await i.open();
    await i.openDialog(ADD_ACTIVITY);
    await i.fill({ listView: BIRTHDAYS });
    await i.saveDialog();
    const before = await crm.total();
    expect(await importOnce(i), 'message after the click').toBe('started');
    // The account has no prospects yet, so the CRM list has no search box or counter: the total is the check.
    expect(await crm.total(), 'prospects after the import').toBe(before);
  });

  test('Row 8: first import of the 6 Contacts', async ({ salesforceProspectsImport: i, saleshandyCrm: crm }) => {
    state.firstContacts = await contacts();
    expect(state.firstContacts.length, 'Contacts in the List View').toBe(6);
    await i.open();
    await i.openDialog(ADD_ACTIVITY);
    await i.fill({ listView: VIEW });
    await i.saveDialog();
    // Baseline 5: the saved List View shows after a reload.
    await i.open();
    await i.editChip(ADD_ACTIVITY);
    expect(await i.dialogText(), 'saved List View').toContain(VIEW);
    await i.page.keyboard.press('Escape');
    state.totalBeforeFirst = await crm.total();
    expect(await importOnce(i), 'Baseline 7: message after the click').toBe('started');
    // Add 1: one prospect per Contact with an email, in no sequence (Both 2: Move has no List View, so only Add runs).
    const valid = withEmail(state.firstContacts);
    for (const c of valid) {
      await expectProspect(crm, rowOf(c), {});
      await expectSequence(crm, c.email, '-');
    }
    expect(await crm.total(), 'prospects after the first import').toBe(state.totalBeforeFirst + valid.length);
  });

  test('Row 9: Anna Van Dyke keeps first and last name', async ({ saleshandyCrm: crm }) => {
    const c = by(await firstList(), 'Van Dyke');
    await expectProspect(crm, rowOf(c), { 'First Name': c.first, 'Last Name': c.last });
  });

  test('Row 10: Contact with only a last name', async ({ saleshandyCrm: crm }) => {
    const c = by(await firstList(), 'Solo');
    await expectProspect(crm, rowOf(c), { 'Last Name': c.last });
  });

  test('Row 11: Contact without an email', async ({ saleshandyCrm: crm }) => {
    const c = by(await firstList(), 'Lindqvist');
    expect(await crm.search('Lindqvist'), 'prospects named Lindqvist').toBe(0);
    expect(c.email, 'Contact email').toBe('');
  });

  test('Row 12: Company is the Account name', async ({ saleshandyCrm: crm }) => {
    const c = by(await firstList(), 'Van Dyke');
    expect(c.account, 'Account of the Contact').not.toBe('');
    await expectProspect(crm, rowOf(c), { Company: c.account });
  });

  test('Row 13: Phone Number, Job Title, Department equal the Salesforce values', async ({ saleshandyCrm: crm }) => {
    const c = by(await firstList(), 'Van Dyke');
    await expectProspect(crm, rowOf(c), { 'Phone Number': c.phone, 'Job Title': c.title, Department: c.department });
  });

  test('Row 14: Job Title with a comma', async ({ saleshandyCrm: crm }) => {
    const c = by(await firstList(), 'Raman');
    await check(true, 'Add Prospect 8: comma in Job Title', async () => expectProspect(crm, rowOf(c), { 'Job Title': c.title }));
  });

  // Row 15: verified by hand by QA on 2026-11-13 (Add Prospect with the view "My Contacts", all prospects deleted first,
  // the total matched). Not scripted: "My Contacts" is the view of the Salesforce user Saleshandy is connected as
  // (Rudra Chauhan owns 18 Contacts, Chintan Sapovadiya owns 580), so the expected total depends on that user.
  test.skip('Row 15: My Contacts view (verified by hand by QA 2026-11-13)', async () => {});

  // ---- Second import: prospects that already exist ----

  test('Row 16: second import with existing prospects', async ({ salesforceProspectsImport: i, saleshandyCrm: crm }) => {
    const first = await firstList();
    const anna = by(first, 'Van Dyke');
    const elise = by(first, 'Dubois');
    const marek = by(first, 'Novak');
    // VERIFY_ONLY=1 skips the setup and the click and only checks the result. Use it after a run where the click
    // was made but a check was too early: a plain rerun would make a second "Hana Petersen" in Salesforce.
    if (process.env.VERIFY_ONLY !== '1') {
      // Existing prospects edited by hand in Saleshandy (UI): Elise gets other values, Marek gets a Department.
      await crm.search(elise.email);
      await crm.openProspect(fullName(rowOf(elise)));
      await crm.editField('Job Title', 'Regional Sales Lead');
      await crm.editField('Company Industry', 'Retail');
      await crm.search(marek.email);
      await crm.openProspect(fullName(rowOf(marek)));
      await crm.editField('Department', 'Sales');
      // Salesforce: Anna's Title changes (row 10) and one new Contact joins the view (row 17).
      const api = await sf();
      await api.updateContact(anna.id, { Title: 'Director of Finance Operations' });
      // Phone Number is a multi-value field with no edit pencil, so the number is changed in Salesforce (row 13).
      await api.updateContact(elise.id, { Phone: '+31 10 555 0199' });
      const tag = Date.now().toString(36);
      await api.createContact({ firstName: 'Hana', lastName: 'Petersen', email: `hana.petersen.${tag}@mailinator.com`, title: 'Procurement Lead', phone: '+31 10 555 0147', department: 'Procurement', mailingCity: 'Rotterdam' });
      expect(await importOnce(i), 'message after the click').toBe('started');
    }
    state.secondContacts = await contacts();
    const valid = withEmail(state.secondContacts);
    const hana = by(state.secondContacts, 'Petersen');
    // Row 17 and 9: the new Contact arrives, the total goes up by one, no email has two prospects.
    await expectProspect(crm, rowOf(hana), fieldsOf(hana));
    // 5 prospects from the first import plus Hana: one prospect per Contact with an email.
    expect(await crm.total(), 'prospects after the second import').toBe(valid.length);
    for (const c of valid) expect(await crm.search(c.email), `prospects with ${c.email}`).toBe(1);
    // Row 10, 13: mapped fields take the Salesforce values again.
    await expectProspect(crm, rowOf(anna), { 'Job Title': 'Director of Finance Operations' }, { fieldsMs: 90_000 });
    const eliseNow = by(state.secondContacts, 'Dubois');
    await expectProspect(crm, rowOf(eliseNow), { 'Job Title': eliseNow.title }, { fieldsMs: 90_000 });
    await check(true, 'Add Prospect 13: Phone Number changed in Salesforce shows in Saleshandy', async () =>
      expectProspect(crm, rowOf(eliseNow), { 'Phone Number': eliseNow.phone }, { fieldsMs: 30_000 }));
    // Row 14: an empty Salesforce Department does not clear the prospect's. Row 15: an unmapped field is kept.
    await expectProspect(crm, rowOf(marek), { Department: 'Sales' }, { fieldsMs: 90_000 });
    await check(true, 'Add Prospect 15: unmapped Company Industry kept', async () => expectProspect(crm, rowOf(elise), { 'Company Industry': 'Retail' }));
  });

  // ---- Move to Sequence (Add Prospect is also saved) ----

  test('Row 17: Move List View set, Step 1 of the Draft sequence', async ({ salesforceProspectsImport: i, saleshandyCrm: crm }) => {
    await i.open();
    await i.openDialog(MOVE_ACTIVITY);
    await i.fill({ listLabel: MOVE_LIST, listView: VIEW });
    await i.saveDialog();
    expect(await importOnce(i), 'message after the click').toBe('started');
    for (const c of withEmail(await secondList())) await expectSequence(crm, c.email, SEQUENCE);
  });

  test('Row 18: same view imported again', async ({ salesforceProspectsImport: i, saleshandyCrm: crm }) => {
    const before = await crm.total();
    expect(await importOnce(i), 'message after the click').toBe('started');
    expect(await crm.total(), 'prospects after the repeat').toBe(before);
    for (const c of withEmail(await secondList())) expect(await crm.search(c.email), `prospects with ${c.email}`).toBe(1);
  });

  test.skip('Row 20: prospect in another Active sequence (needs an Active sequence that sends mail, QA decides)', async () => {});

  // ---- Last: the chip that comes back ----

  test('Row 21: remove the Add Prospect chip, reload', async ({ salesforceProspectsImport: i }) => {
    await i.open();
    await i.removeActivity(IMPORT_TRIGGER, ADD_ACTIVITY);
    await i.open();
    await check(true, 'Both 4: removed chip stays removed after a reload', async () => expect(await i.chips()).not.toContain(ADD_ACTIVITY));
  });
});
