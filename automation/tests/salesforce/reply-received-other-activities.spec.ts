// Scenarios: test-cases/salesforce/reply-received-other-activities-proposal.md (Regression).
// Data: test-data/salesforce/reply-received-other-activities.csv, one row per scenario.
// Hand-written like the other Salesforce specs (QA, 2026-10-19).
//
// Run time is kept down by doing the waiting once, up front (QA, 2026-10-20): the
// "Setup" test creates the Salesforce records, the prospects and the step 1 sends
// for all 12 rows side by side (two Saleshandy tabs and the Salesforce tab), so the
// sender's 40 to 50 s spacing runs while rows are being checked. Each row then only
// marks the reply, waits 15 s and looks in Salesforce. Rows that run on their own
// (-g) prepare themselves, so a rerun of one row needs no Setup.
import { expect, test } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { TRIGGER, lookAfterReply, newLogEntry } from '../../src/flows/salesforce-reply.ts';
import { SaleshandySequencePage } from '../../src/pages/saleshandy/sequence.page.ts';
import type { SalesforceIntegrationPage } from '../../src/pages/saleshandy/salesforce-integration.page.ts';
import type { SalesforceContactsPage } from '../../src/pages/salesforce/contacts.page.ts';
import type { SalesforceLeadsPage } from '../../src/pages/salesforce/leads.page.ts';

// 30 s per action: an action that cannot work now fails at once, not after the test timeout
// (a stuck picklist once held the Setup test for 29 minutes).
test.use({ account: 'sfreplyreceived', actionTimeout: 30_000 });

const SEQUENCE_ID = '196746';
const CSV = 'salesforce/reply-received-other-activities.csv';
const UL = 'Update a Lead in Salesforce';
const CC = 'Create a Contact in Salesforce';
const AN = `${CC} + Attach Note in Salesforce`;
const ATTACH_NOTE = 'Attach Note in Salesforce';
const CREATE_LEAD = 'Create a Lead in Salesforce';
// Values of the Lead the integration is expected to update (they differ from the prospect's).
const LEGACY = { company: 'Pilot Legacy Co', title: 'Legacy Title QA', phone: '+1 555-0100-0000' };

type Ctx = {
  seq: SaleshandySequencePage;
  leads: SalesforceLeadsPage;
  contacts: SalesforceContactsPage;
  sf: SalesforceIntegrationPage;
};

// What each row needs in Salesforce before the reply.
const NEEDS: Record<string, { lead?: { status?: string }; contact?: boolean }> = {
  [`${UL} > 1`]: { lead: {} },
  [`${UL} > 2`]: { lead: { status: 'Working - Contacted' } },
  [`${UL} > 3`]: { lead: {} },
  [`${CC} > 3`]: { contact: true },
  [`${CC} > 4`]: { lead: {} },
  [`${AN} > 2`]: { contact: true },
};
const IDS = [1, 2, 3, 4].map((n) => `${UL} > ${n}`).concat([1, 2, 3, 4].map((n) => `${CC} > ${n}`), [1, 2, 3, 4].map((n) => `${AN} > ${n}`));

const done = { record: new Set<string>(), added: new Set<string>(), sent: new Set<string>() };
let configured = '';

const rowOf = (id: string): Row => {
  const row = readCsv(CSV).find((r) => r['Scenario'] === id);
  if (!row) throw new Error(`No row "${id}" in test-data/${CSV}`);
  return row;
};
const fullName = (row: Row) => `${row['First Name']} ${row['Last Name']}`;
const note = (type: string, description: string) => test.info().annotations.push({ type, description });

async function addRecords(ctx: Ctx, id: string, row: Row): Promise<void> {
  const needs = NEEDS[id];
  if (!needs || done.record.has(id)) return;
  if (needs.lead) {
    await ctx.leads.createLead({ firstName: row['First Name'], lastName: row['Last Name'], email: row['Email'], ...LEGACY, status: needs.lead.status });
  }
  if (needs.contact) {
    await ctx.contacts.createContact({ firstName: row['First Name'], lastName: row['Last Name'], email: row['Email'] });
  }
  done.record.add(id);
}

// The row is marked used first: a failed add can still leave the prospect in Saleshandy.
async function addProspect(seq: SaleshandySequencePage, id: string, row: Row): Promise<void> {
  if (done.added.has(id)) return;
  markUsed(CSV, row['Email']);
  await seq.createAndAddProspect(SEQUENCE_ID, row);
  done.added.add(id);
}

async function sendOut(seq: SaleshandySequencePage, id: string, row: Row): Promise<void> {
  if (done.sent.has(id)) return;
  await seq.sendNow(SEQUENCE_ID, fullName(row));
  done.sent.add(id);
}

// For a row run on its own: do whatever of the three steps Setup has not done.
async function prepare(ctx: Ctx, id: string, row: Row): Promise<void> {
  await addRecords(ctx, id, row);
  await addProspect(ctx.seq, id, row);
  await sendOut(ctx.seq, id, row);
}

async function useActivities(ctx: Ctx, activities: string[]): Promise<void> {
  const key = activities.join(' + ');
  if (configured === key) return;
  await test.step(`Set the trigger "${TRIGGER}" to: ${key}`, async () => {
    await ctx.sf.setActivities(TRIGGER, activities);
    await expect(ctx.sf.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
    configured = key;
  });
}

// Prepare, make sure step 1 is Sent, mark the reply; returns the time of the reply.
async function reply(ctx: Ctx, id: string, row: Row): Promise<number> {
  await test.step('Make sure the Salesforce records, the prospect and the step 1 send are ready', () => prepare(ctx, id, row));
  await test.step('Wait until the step 1 email shows Sent', () => ctx.seq.ensureSent(SEQUENCE_ID, fullName(row)));
  const at = Date.now();
  await test.step('Mark the step 1 email as replied', () => ctx.seq.markAsReplied(SEQUENCE_ID, fullName(row)));
  return at;
}

// QA's check: 15 s, look in Salesforce; 5 s and a reload, look again; only then Logs.
// Logs Error is not a failure: it is recorded for QA with the scenario and steps.
async function findAfterReply<T>(ctx: Ctx, sinceMs: number, look: () => Promise<T | undefined>): Promise<T | undefined> {
  const found = await test.step('Wait 15 s, then look in Salesforce (5 s and a reload if it is not there)', () =>
    lookAfterReply(ctx.leads.page, look),
  );
  if (found !== undefined) return found;
  const entry = await test.step('Not in Salesforce: open Logs for the status', () => newLogEntry(ctx.sf, sinceMs));
  note('Logs row', entry.text);
  if (entry.status === 'Error') {
    note('Needs QA', 'Logs shows Error and the record is not in Salesforce. Ask QA with this scenario and its steps.');
    return undefined;
  }
  return test.step('Logs shows Success: look in Salesforce again', () => look());
}

test.describe('Reply is Received in Saleshandy: other Salesforce activities', () => {
  test.describe.configure({ mode: 'serial' });

  test('Setup: Salesforce records, prospects and step 1 sends for all 12 rows', async ({
    saleshandyPage,
    saleshandySequence,
    salesforceLeads,
    salesforceContacts,
    salesforceIntegration,
  }) => {
    test.setTimeout(30 * 60_000);
    const ctx: Ctx = { seq: saleshandySequence, leads: salesforceLeads, contacts: salesforceContacts, sf: salesforceIntegration };
    const sender = new SaleshandySequencePage(await saleshandyPage.context().newPage());
    const added = IDS.map(() => {
      let resolve!: () => void;
      const promise = new Promise<void>((r) => (resolve = r));
      return { promise, resolve };
    });
    await test.step('Create records, add prospects and send step 1, side by side', async () => {
      const records = async () => {
        for (const id of IDS) await addRecords(ctx, id, rowOf(id));
      };
      const prospects = async () => {
        for (const [i, id] of IDS.entries()) {
          await addProspect(saleshandySequence, id, rowOf(id));
          added[i].resolve();
        }
      };
      const sends = async () => {
        for (const [i, id] of IDS.entries()) {
          await added[i].promise;
          await sendOut(sender, id, rowOf(id));
        }
      };
      await Promise.all([records(), prospects(), sends()]);
    });
  });

  test.describe(UL, () => {
    // The Lead was created beforehand with LEGACY values; "updated" = Title is the prospect's.
    const updatedLead = (ctx: Ctx, row: Row, sinceMs: number) =>
      findAfterReply(ctx, sinceMs, async () => {
        const fields = await ctx.leads.leadFields(row['Email']);
        return fields.title === row['Job Title'] ? fields : undefined;
      });

    test(`${UL} > 1: Lead with the same email, different Job Title, Phone and Company`, async ({ saleshandySequence, salesforceIntegration, salesforceLeads, salesforceContacts }) => {
      test.setTimeout(10 * 60_000);
      const ctx: Ctx = { seq: saleshandySequence, leads: salesforceLeads, contacts: salesforceContacts, sf: salesforceIntegration };
      const id = `${UL} > 1`;
      const row = rowOf(id);
      await useActivities(ctx, [UL]);
      const at = await reply(ctx, id, row);
      const fields = await updatedLead(ctx, row, at);
      // Observed 2026-10-20 (awaiting QA confirmation): the mapped values replace the Lead's.
      await test.step('The Lead shows the prospect\'s Title, Phone, Company and City, and there is still one Lead', async () => {
        expect(fields, 'Lead found with the prospect\'s Title').toBeDefined();
        expect(fields!.phone, 'Phone').toBe(row['Phone Number']);
        expect(fields!.company, 'Company').toBe(row['Company']);
        expect(fields!.address, 'Address').toContain(row['City']);
        expect(await salesforceLeads.countByEmail(row['Email']), 'Leads for the email').toBe(1);
      });
    });

    test(`${UL} > 2: Lead Status "Working - Contacted", prospect has a new Job Title`, async ({ saleshandySequence, salesforceIntegration, salesforceLeads, salesforceContacts }) => {
      test.setTimeout(10 * 60_000);
      const ctx: Ctx = { seq: saleshandySequence, leads: salesforceLeads, contacts: salesforceContacts, sf: salesforceIntegration };
      const id = `${UL} > 2`;
      const row = rowOf(id);
      await useActivities(ctx, [UL]);
      const at = await reply(ctx, id, row);
      const fields = await updatedLead(ctx, row, at);
      // (proposed, unconfirmed): record, do not assert.
      note('Lead after the reply', JSON.stringify(fields ?? 'not updated'));
      note('Lead Status after the reply (was "Working - Contacted")', fields?.status ?? 'not read');
    });

    test(`${UL} > 3: Lead has a Phone, prospect has none`, async ({ saleshandySequence, salesforceIntegration, salesforceLeads, salesforceContacts }) => {
      test.setTimeout(10 * 60_000);
      const ctx: Ctx = { seq: saleshandySequence, leads: salesforceLeads, contacts: salesforceContacts, sf: salesforceIntegration };
      const id = `${UL} > 3`;
      const row = rowOf(id);
      await useActivities(ctx, [UL]);
      const at = await reply(ctx, id, row);
      const fields = await updatedLead(ctx, row, at);
      // (proposed, unconfirmed): Phone is unchanged or cleared. Record which.
      note(`Lead Phone after the reply (was "${LEGACY.phone}")`, fields ? `"${fields.phone}"` : 'Lead not updated');
    });

    test(`${UL} > 4: no Lead or Contact with the prospect's email`, async ({ saleshandySequence, salesforceIntegration, salesforceLeads, salesforceContacts }) => {
      test.setTimeout(10 * 60_000);
      const ctx: Ctx = { seq: saleshandySequence, leads: salesforceLeads, contacts: salesforceContacts, sf: salesforceIntegration };
      const id = `${UL} > 4`;
      const row = rowOf(id);
      await useActivities(ctx, [UL]);
      const at = await reply(ctx, id, row);
      // (proposed, unconfirmed): no Lead is created. The row asks for the Logs status.
      await test.step('Wait 15 s, then look for a Lead in Salesforce', async () => {
        const count = await lookAfterReply(salesforceLeads.page, async () => ((await salesforceLeads.countByEmail(row['Email'])) > 0 ? 1 : undefined));
        note('Lead created', count ? 'yes' : 'no');
      });
      const entry = await test.step('Read the Logs status', () => newLogEntry(salesforceIntegration, at));
      note('Logs status', entry.status);
      note('Logs row', entry.text);
    });
  });

  test.describe(CC, () => {
    test(`${CC} > 1: new prospect with name, email, phone, department and city`, async ({ saleshandySequence, salesforceIntegration, salesforceLeads, salesforceContacts }) => {
      test.setTimeout(10 * 60_000);
      const ctx: Ctx = { seq: saleshandySequence, leads: salesforceLeads, contacts: salesforceContacts, sf: salesforceIntegration };
      const id = `${CC} > 1`;
      const row = rowOf(id);
      await useActivities(ctx, [CC]);
      const at = await reply(ctx, id, row);
      const count = await findAfterReply(ctx, at, async () => {
        const n = await salesforceContacts.countByEmail(row['Email']);
        return n > 0 ? n : undefined;
      });
      // Observed 2026-10-20 (awaiting QA confirmation).
      await test.step('One Contact with the prospect\'s Name, Business Phone, Department and Other Address, and no Lead', async () => {
        expect(count, 'Contacts for the email').toBe(1);
        const fields = await salesforceContacts.contactFields(row['Email']);
        expect(fields.name, 'Name').toBe(fullName(row));
        expect(fields.phone, 'Business Phone').toBe(row['Phone Number']);
        expect(fields.department, 'Department').toBe(row['Department']);
        expect(fields.otherAddress, 'Other Address').toContain(row['City']);
        expect(await salesforceLeads.countByEmail(row['Email']), 'Leads for the email').toBe(0);
      });
    });

    test(`${CC} > 2: prospect has Job Title and Company, not mapped for Contacts`, async ({ saleshandySequence, salesforceIntegration, salesforceLeads, salesforceContacts }) => {
      test.setTimeout(10 * 60_000);
      const ctx: Ctx = { seq: saleshandySequence, leads: salesforceLeads, contacts: salesforceContacts, sf: salesforceIntegration };
      const id = `${CC} > 2`;
      const row = rowOf(id);
      await useActivities(ctx, [CC]);
      const at = await reply(ctx, id, row);
      const count = await findAfterReply(ctx, at, async () => {
        const n = await salesforceContacts.countByEmail(row['Email']);
        return n > 0 ? n : undefined;
      });
      // Observed 2026-10-20 (awaiting QA confirmation): Title and Account Name are empty.
      await test.step('The Contact has no Title', async () => {
        expect(count, 'Contacts for the email').toBe(1);
        const fields = await salesforceContacts.contactFields(row['Email']);
        expect(fields.title, 'Title').toBe('');
        note('Prospect Job Title and Company (not on the Contact)', `${row['Job Title']} / ${row['Company']}`);
      });
    });

    test(`${CC} > 3: a Contact with the prospect's email already exists`, async ({ saleshandySequence, salesforceIntegration, salesforceLeads, salesforceContacts }) => {
      test.setTimeout(10 * 60_000);
      const ctx: Ctx = { seq: saleshandySequence, leads: salesforceLeads, contacts: salesforceContacts, sf: salesforceIntegration };
      const id = `${CC} > 3`;
      const row = rowOf(id);
      await useActivities(ctx, [CC]);
      const at = await reply(ctx, id, row);
      // (proposed, unconfirmed): still one Contact; record whether its values changed.
      // The Contact was created with a name and email only, so a Business Phone means it changed.
      const changed = await findAfterReply(ctx, at, async () => {
        const fields = await salesforceContacts.contactFields(row['Email']);
        return fields.phone !== '' ? fields : undefined;
      });
      note('Contact values after the reply', JSON.stringify(changed ?? 'unchanged'));
      note('Contacts for the email', String(await salesforceContacts.countByEmail(row['Email'])));
    });

    test(`${CC} > 4: a Lead with the prospect's email was created by hand, no Contact`, async ({ saleshandySequence, salesforceIntegration, salesforceLeads, salesforceContacts }) => {
      test.setTimeout(10 * 60_000);
      const ctx: Ctx = { seq: saleshandySequence, leads: salesforceLeads, contacts: salesforceContacts, sf: salesforceIntegration };
      const id = `${CC} > 4`;
      const row = rowOf(id);
      await useActivities(ctx, [CC]);
      const at = await reply(ctx, id, row);
      // (proposed, unconfirmed): one Contact is created, the Lead is unchanged.
      const count = await findAfterReply(ctx, at, async () => {
        const n = await salesforceContacts.countByEmail(row['Email']);
        return n > 0 ? n : undefined;
      });
      note('Contacts for the email', String(count ?? 0));
      const lead = await salesforceLeads.leadFields(row['Email']);
      note(`Lead after the reply (created with Title "${LEGACY.title}", Phone "${LEGACY.phone}")`, JSON.stringify(lead));
    });
  });

  test.describe(AN, () => {
    // Checked from Logs only (QA, 2026-10-20): Success and Error are both recorded and neither is a bug.
    const logStatus = async (ctx: Ctx, at: number) => {
      const entry = await test.step('Read the Logs status of the new entry', () => newLogEntry(ctx.sf, at));
      note('Logs status', entry.status);
      note('Logs row', entry.text);
      return entry;
    };

    test(`${AN} > 1: new prospect, outcome left as "Add Outcome"`, async ({ saleshandySequence, salesforceIntegration, salesforceLeads, salesforceContacts }) => {
      test.setTimeout(10 * 60_000);
      const ctx: Ctx = { seq: saleshandySequence, leads: salesforceLeads, contacts: salesforceContacts, sf: salesforceIntegration };
      const id = `${AN} > 1`;
      const row = rowOf(id);
      await useActivities(ctx, [CC, ATTACH_NOTE]);
      const at = await reply(ctx, id, row);
      const entry = await logStatus(ctx, at);
      if (entry.status !== 'Success') return;
      // Observed 2026-10-20 (awaiting QA confirmation): one Contact, one Note on it.
      await test.step('The Contact has the Note "reply-received" with the prospect\'s email in its Body', async () => {
        expect(await salesforceContacts.countByEmail(row['Email']), 'Contacts for the email').toBe(1);
        const body = await salesforceContacts.noteBody(row['Email'], 'reply-received');
        note('Note Body', body);
        expect(body, 'Note Body').toContain(`Prospect Email: ${row['Email']}`);
      });
    });

    test(`${AN} > 2: a Contact with the prospect's email already exists`, async ({ saleshandySequence, salesforceIntegration, salesforceLeads, salesforceContacts }) => {
      test.setTimeout(10 * 60_000);
      const ctx: Ctx = { seq: saleshandySequence, leads: salesforceLeads, contacts: salesforceContacts, sf: salesforceIntegration };
      const id = `${AN} > 2`;
      const row = rowOf(id);
      await useActivities(ctx, [CC, ATTACH_NOTE]);
      const at = await reply(ctx, id, row);
      const entry = await logStatus(ctx, at);
      if (entry.status !== 'Success') return;
      // (proposed, unconfirmed): still one Contact, one Note on it. Recorded, not asserted.
      note('Contacts for the email', String(await salesforceContacts.countByEmail(row['Email'])));
      note('Note Body', (await salesforceContacts.noteBody(row['Email'], 'reply-received')) || 'no Note found');
    });

    test(`${AN} > 4: prospect outcome set to Interested before the reply`, async ({ saleshandySequence, salesforceIntegration, salesforceLeads, salesforceContacts }) => {
      test.setTimeout(10 * 60_000);
      const ctx: Ctx = { seq: saleshandySequence, leads: salesforceLeads, contacts: salesforceContacts, sf: salesforceIntegration };
      const id = `${AN} > 4`;
      const row = rowOf(id);
      await useActivities(ctx, [CC, ATTACH_NOTE]);
      await test.step('Make sure the prospect is ready before the outcome is set', () => prepare(ctx, id, row));
      await test.step('Set the prospect outcome to Interested', () => saleshandySequence.setProspectOutcome(SEQUENCE_ID, row['Email'], 'Interested'));
      const at = await reply(ctx, id, row);
      const entry = await logStatus(ctx, at);
      if (entry.status !== 'Success') return;
      // (proposed, unconfirmed): the Note's Body shows Latest Outcome: Interested. Recorded, not asserted.
      const body = await salesforceContacts.noteBody(row['Email'], 'reply-received');
      note('Note Body', body || 'no Note found');
      note('Latest Outcome in the Note', body.match(/Latest Outcome:? (.*?) Prospect Email/)?.[1] ?? 'not found');
    });

    // The last row of this group: its activities differ from the three above.
    test(`${AN} > 3: Attach Note selected alone`, async ({ saleshandySequence, salesforceIntegration, salesforceLeads, salesforceContacts }) => {
      test.setTimeout(10 * 60_000);
      const ctx: Ctx = { seq: saleshandySequence, leads: salesforceLeads, contacts: salesforceContacts, sf: salesforceIntegration };
      const id = `${AN} > 3`;
      const row = rowOf(id);
      await useActivities(ctx, [ATTACH_NOTE]);
      const at = await reply(ctx, id, row);
      const entry = await logStatus(ctx, at);
      if (entry.status !== 'Success') return;
      // (proposed, unconfirmed): no Note on any record. Recorded, not asserted.
      note('Contacts for the email', String(await salesforceContacts.countByEmail(row['Email'])));
    });
  });

  test('Restore: Create a Lead only', async ({ salesforceIntegration }) => {
    await salesforceIntegration.setActivities(TRIGGER, [CREATE_LEAD]);
    await expect(salesforceIntegration.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
  });
});
