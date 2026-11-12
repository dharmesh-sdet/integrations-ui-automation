// Scenarios: test-cases/salesforce/lead-created.md (Regression; AL-4144; QA looks good 2026-11-09).
// Each row makes a Lead through the Salesforce REST API, starts the workflow at once through
// Refold run-now (no 3-hour cron wait) and checks the prospect in Saleshandy.
// Account sfreplyreceived: Sequence A (1 step) and Sequence B (4 steps) must be active.
// "Stop sending follow-ups if reply received" is off there, so Replied stays Replied.
// Run with KEEP_TEST_DATA=1. The people are made on the fly, so there is no CSV.
// Not covered (QA): trigger off, a list that excludes a fresh Lead, first-run window, cron.
import { expect, test } from '../../src/fixtures/index.ts';
import { EXPECTED_MAPPING } from '../../src/config/salesforce-field-mapping.ts';
import {
  ACT, SEQ_A, SEQ_B, TAG, TRIGGER, VIEWS, expectProspect, newLead, runNow, runNowExpectingError, useActivities, windowCount,
  type Pick, type Want,
} from '../../src/flows/salesforce-lead-created.ts';
import { SalesforceApi, type LeadInput } from '../../src/utils/salesforce-api.ts';
import { untilPasses } from '../../src/utils/wait.ts';

test.use({ account: 'sfreplyreceived' });
test.setTimeout(20 * 60_000);

let sf: SalesforceApi;
test.beforeAll(async () => {
  sf = await SalesforceApi.login();
});

const TODAY = ["Today's Leads"];
const move = (seq = SEQ_A): Pick => ({ activity: ACT.move, seq, step: true });
const mapped = { Company: '', 'Job Title': '', 'Phone Number': '' };
const fieldsOf = (l: LeadInput) => ({ ...mapped, Company: l.company, 'Job Title': l.title ?? '', 'Phone Number': l.phone ?? '' });

// A Lead with no Email. The prospect search uses the last name, so it is unique per call;
// a plain name matched prospects from earlier runs (seen 2026-11-09).
const noEmailLead = () => {
  const l = newLead();
  const lastName = `${l.lastName}${Date.now().toString(36)}`;
  return { ...l, lastName, fullName: `${l.firstName} ${lastName}`, email: undefined } as never;
};

// Removes the given domains from this account's Global Do Not Contact list. The Blacklist
// action adds the domain of EVERY Lead in the window, so a run with older @mailinator.com
// Leads leaves mailinator.com listed, and every later prospect on it shows Blacklisted
// (seen 2026-11-09 to 2026-11-11).
async function clearDnc(dnc: { openGlobalList(): Promise<void>; hasEntry(e: string): Promise<boolean>; removeEntry(e: string): Promise<void> }, domains: string[]): Promise<void> {
  for (const d of domains) {
    await dnc.openGlobalList();
    if (await dnc.hasEntry(d)) await dnc.removeEntry(d);
  }
}

type Row = {
  name: string;
  picks: Pick[];
  lists?: string[];
  lead?: () => LeadInput & { email: string; fullName: string };
  want: (l: LeadInput & { email: string; fullName: string }) => Want;
  // The window must hold only this row's Lead (Unsubscribe and Blacklist rows).
  windowCheck?: boolean;
  // Result not confirmed by the developer: recorded for QA, not asserted.
  proposed?: boolean;
  // Skipped nodes the run must show.
  skipped?: string;
};

// One row on a new Lead: activities set, Lead made, run now, prospect checked.
function newLeadRow(r: Row): void {
  test(r.name, async ({ salesforceIntegration, saleshandyCrm }) => {
    const lead = (r.lead ?? newLead)();
    await test.step(`Select ${r.picks.map((p) => `"${p.activity}"`).join(' + ')}${r.lists?.length ? ` with list ${r.lists.join(', ')}` : ''} and Save`, () =>
      useActivities(salesforceIntegration, r.picks, r.lists),
    );
    await test.step(`Create the Lead ${lead.fullName} in Salesforce`, async () => {
      if (r.windowCheck) {
        await sf.createLead(lead, true);
        const n = await windowCount(sf);
        test.skip(n > 1, `${n} Leads are in the window since the last run; this action would reach them too`);
      } else await sf.createLead(lead, true);
    });
    const run = await test.step('Run the workflow now and wait for COMPLETED', () => runNow(salesforceIntegration.page));
    if (r.skipped) expect(run.skipped.join(' | '), 'skipped steps').toContain(r.skipped);
    await test.step(`Check ${lead.fullName} in Saleshandy`, async () => {
      try {
        await expectProspect(saleshandyCrm, lead.email, lead.fullName, r.want(lead));
        if (r.proposed) test.info().annotations.push({ type: 'Needs QA', description: `${r.name}: proposed result seen` });
      } catch (e) {
        if (!r.proposed) throw e;
        test.info().annotations.push({ type: 'Needs QA', description: `${r.name}: proposed result NOT seen. ${(e as Error).message.split('\n')[0]}` });
      }
    });
  });
}

// One row on a prospect already in a sequence: a first Lead is moved in, then a second Lead with
// the same email runs `picks`.
function existingRow(name: string, steps: { picks: Pick[]; lists?: string[]; title: string; windowCheck?: boolean }[], want: (l: { fullName: string }) => Want): void {
  test(name, async ({ salesforceIntegration, saleshandyCrm }) => {
    const lead = newLead();
    await test.step(`Move ${lead.fullName} into ${SEQ_B}`, async () => {
      await useActivities(salesforceIntegration, [move(SEQ_B)]);
      await sf.createLead(lead, true);
      await runNow(salesforceIntegration.page);
      await expectProspect(saleshandyCrm, lead.email, lead.fullName, { sequence: SEQ_B, status: 'Active' });
    });
    for (const s of steps) {
      await test.step(`Select ${s.picks.map((p) => `"${p.activity}"`).join(' + ')}, second Lead with the same email, run now`, async () => {
        await useActivities(salesforceIntegration, s.picks, s.lists);
        await sf.createLead({ ...lead, title: s.title }, true);
        // Unsubscribe reaches every Lead in the window, so the second Lead must be the only one.
        if (s.windowCheck) {
          const n = await windowCount(sf);
          test.skip(n > 1, `${n} Leads are in the window since the last run; this action would reach them too`);
        }
        await runNow(salesforceIntegration.page);
      });
    }
    await test.step(`Check ${lead.fullName} in Saleshandy`, () => expectProspect(saleshandyCrm, lead.email, lead.fullName, want(lead)));
  });
}

test.describe(TRIGGER, () => {
  // Status rows need a Do Not Contact list without mailinator.com. Rows run alone with -g
  // skip this test, so clear the entry by hand first.
  test('Setup: mailinator.com is not on the Do Not Contact list', async ({ saleshandyDnc }) => {
    await clearDnc(saleshandyDnc, ['mailinator.com']);
    await saleshandyDnc.openGlobalList();
    expect(await saleshandyDnc.hasEntry('mailinator.com'), 'mailinator.com on the list').toBe(false);
  });

  // ---- Trigger behavior (baseline) ----
  test('Trigger behavior > 1: Field Mapping for Lead', async ({ salesforceIntegration }) => {
    await salesforceIntegration.openMapping('Lead');
    for (const field of ['Company', 'Job Title', 'Phone Number']) {
      expect(await salesforceIntegration.mappedValue(field), `${field} on Lead Properties`).toBe(EXPECTED_MAPPING.Lead[field]);
    }
  });

  test('Trigger behavior > 3: trigger on, Add Prospect, Save, reload: still saved', async ({ salesforceIntegration }) => {
    await useActivities(salesforceIntegration, [{ activity: ACT.add }]);
    await salesforceIntegration.page.reload();
    await salesforceIntegration.openTriggers();
    expect(await salesforceIntegration.isTriggerOn(TRIGGER), 'trigger on after reload').toBe(true);
    expect((await salesforceIntegration.selectedActivities(TRIGGER)).some((a) => a.includes(ACT.add)), 'Add Prospect chip').toBe(true);
  });

  // ---- Activities list and Extra Configuration ----
  test('Activities list > 1: nine activities in order', async ({ salesforceIntegration }) => {
    await salesforceIntegration.openTriggers();
    await salesforceIntegration.enableOnly(TRIGGER);
    for (const chip of await salesforceIntegration.selectedActivities(TRIGGER)) await salesforceIntegration.removeActivity(TRIGGER, chip);
    await salesforceIntegration.openActivityList(TRIGGER);
    await salesforceIntegration.page.waitForTimeout(1500);
    const options = (await salesforceIntegration.page.getByRole('button').allInnerTexts()).map((t) => t.trim()).filter((t) => /in Saleshandy$/.test(t));
    expect(options).toEqual([ACT.add, ACT.move, ACT.unsubscribed, ACT.finished, ACT.replied, ACT.paused, ACT.resume, ACT.tag, ACT.blacklist]);
  });

  test('Activities list > 2: Extra Configuration of each activity', async ({ salesforceIntegration }) => {
    const fields: [string, string[]][] = [
      [ACT.add, ['Select a list']],
      [ACT.unsubscribed, ['Select a list']],
      [ACT.blacklist, ['Select a list']],
      [ACT.move, ['Sequence', 'Sequence Steps', 'Select a list']],
      [ACT.finished, ['Sequence', 'Select a list']],
      [ACT.replied, ['Sequence', 'Select a list']],
      [ACT.resume, ['Sequence', 'Select a list']],
      [ACT.paused, ['Sequence', 'Pause Delay In Days', 'Select a list']],
      [ACT.tag, ['Select a list']],
    ];
    await salesforceIntegration.openTriggers();
    await salesforceIntegration.enableOnly(TRIGGER);
    for (const chip of await salesforceIntegration.selectedActivities(TRIGGER)) await salesforceIntegration.removeActivity(TRIGGER, chip);
    for (const [activity, labels] of fields) {
      await salesforceIntegration.selectActivity(TRIGGER, activity);
      const dialog = salesforceIntegration.extraConfiguration();
      await dialog.waitFor({ timeout: 10_000 });
      for (const label of labels) await expect(dialog.getByText(label, { exact: true }).first(), `${activity}: ${label}`).toBeVisible();
      await salesforceIntegration.page.keyboard.press('Escape');
      for (const chip of await salesforceIntegration.selectedActivities(TRIGGER)) await salesforceIntegration.removeActivity(TRIGGER, chip);
    }
  });

  test('Activities list > 3: Select a list offers six views, multi-select', async ({ salesforceIntegration }) => {
    await useActivities(salesforceIntegration, [{ activity: ACT.add }], []);
    await salesforceIntegration.reopenExtraConfiguration(TRIGGER, ACT.add);
    const dialog = salesforceIntegration.extraConfiguration();
    await dialog.waitFor();
    await expect(dialog.locator('.bs-select-box').last()).not.toHaveText('Loading...', { timeout: 30_000 });
    await dialog.locator('.bs-select-box').last().click();
    const items = salesforceIntegration.page.locator('.transfer-list li');
    await items.first().waitFor();
    expect((await items.allInnerTexts()).map((t) => t.trim()).sort()).toEqual([...VIEWS].sort());
    await items.nth(0).click();
    await items.nth(1).click();
    await expect(items.nth(0).locator('input[type=checkbox]')).toBeChecked();
    await expect(items.nth(1).locator('input[type=checkbox]')).toBeChecked();
    await salesforceIntegration.page.keyboard.press('Escape');
  });

  test('Activities list > 4: a saved list pick shows after reopening', async ({ salesforceIntegration }) => {
    await useActivities(salesforceIntegration, [{ activity: ACT.add }], TODAY);
    await salesforceIntegration.page.reload();
    await salesforceIntegration.openTriggers();
    await salesforceIntegration.reopenExtraConfiguration(TRIGGER, ACT.add);
    const dialog = salesforceIntegration.extraConfiguration();
    await dialog.waitFor();
    await expect(dialog.getByText("Today's Leads").first()).toBeVisible();
    await salesforceIntegration.page.keyboard.press('Escape');
  });

  // ---- Add Prospect in Saleshandy ----
  const add: Pick[] = [{ activity: ACT.add }];
  let firstLead: (LeadInput & { email: string; fullName: string }) | undefined;
  test('Add Prospect > 1: new Lead, prospect made with the mapped fields', async ({ salesforceIntegration, saleshandyCrm }) => {
    const lead = newLead();
    firstLead = lead;
    await useActivities(salesforceIntegration, add, []);
    await sf.createLead(lead, true);
    const run = await runNow(salesforceIntegration.page);
    await salesforceIntegration.openLogs();
    await untilPasses(`Logs did not show run ${run.id} as Success`, async () => {
      await salesforceIntegration.refreshLogs();
      expect((await salesforceIntegration.logEntries(TRIGGER)).find((e) => e.id === run.id)?.status).toBe('Success');
    });
    await expectProspect(saleshandyCrm, lead.email, lead.fullName, { status: 'Inactive', fields: fieldsOf(lead) });
  });

  test('Add Prospect > 2: same Lead, run again: still one prospect', async ({ salesforceIntegration, saleshandyCrm }) => {
    test.skip(!firstLead, 'Add Prospect > 1 did not run');
    await runNow(salesforceIntegration.page);
    await expectProspect(saleshandyCrm, firstLead!.email, firstLead!.fullName, { status: 'Inactive' });
  });

  test('Add Prospect > 3: person already a prospect with another Job Title', async ({ salesforceIntegration, saleshandyCrm }) => {
    const lead = newLead();
    await useActivities(salesforceIntegration, add, []);
    await sf.createLead(lead, true);
    await runNow(salesforceIntegration.page);
    await expectProspect(saleshandyCrm, lead.email, lead.fullName, { fields: { 'Job Title': lead.title! } });
    await sf.createLead({ ...lead, title: 'Head of Procurement' }, true);
    await runNow(salesforceIntegration.page);
    await expectProspect(saleshandyCrm, lead.email, lead.fullName, { fields: { 'Job Title': 'Head of Procurement' } });
  });

  newLeadRow({
    name: 'Add Prospect > 4: Lead with no Email, no prospect',
    picks: add,
    lead: noEmailLead,
    want: () => ({ none: true }),
  });
  // The no-email Lead has no address, so the prospect search uses its last name.

  newLeadRow({
    name: 'Add Prospect > 5: name with apostrophe and accent, plus sign in the email',
    picks: add,
    lead: () => {
      const l = newLead();
      return { ...l, firstName: 'Seán', lastName: "O'Brien", fullName: "Seán O'Brien", email: l.email.replace('@', '+qa@') };
    },
    want: (l) => ({ fields: { Company: l.company } }),
  });
  newLeadRow({
    name: 'Add Prospect > 6: Lead Status Closed - Not Converted',
    picks: add,
    lead: () => newLead({ status: 'Closed - Not Converted' }) as never,
    want: () => ({ status: 'Inactive' }),
  });

  // ---- Add Prospect with a list ----
  newLeadRow({
    name: "Add Prospect with a list > 1: Today's Leads, Lead created today",
    picks: add, lists: TODAY, skipped: 'Get Leads if List not provided',
    want: (l) => ({ fields: fieldsOf(l) }),
  });
  newLeadRow({ name: 'Add Prospect with a list > 2: only View - Custom 1', picks: add, lists: ['View - Custom 1'], want: () => ({ status: 'Inactive' }) });
  newLeadRow({ name: "Add Prospect with a list > 4: two lists, Lead in both: one prospect", picks: add, lists: ['All Open Leads', ...TODAY], want: () => ({ status: 'Inactive' }) });
  newLeadRow({
    name: 'Add Prospect with a list > 5: Lead in the list, no Email: no prospect',
    picks: add, lists: TODAY,
    lead: noEmailLead,
    want: () => ({ none: true }),
  });

  // ---- Move Prospect to another Sequence ----
  newLeadRow({ name: 'Move > 1: new Lead, only Move selected', picks: [move()], want: () => ({ sequence: SEQ_A }) });
  newLeadRow({ name: "Move > 2: Move with list Today's Leads", picks: [move()], lists: TODAY, want: () => ({ sequence: SEQ_A }) });

  // ---- Assign a tag ----
  const tag: Pick = { activity: ACT.tag, tag: true };
  newLeadRow({ name: 'Tag > 1: new Lead, only Tag selected', picks: [tag], want: () => ({ tag: TAG }) });
  newLeadRow({ name: "Tag > 2: Tag with list Today's Leads", picks: [tag], lists: TODAY, want: () => ({ tag: TAG }) });
  newLeadRow({ name: 'Tag > 3: Add Prospect, Move and Tag together', picks: [{ activity: ACT.add }, move(), tag], want: () => ({ sequence: SEQ_A, tag: TAG }) });

  // ---- Paused, Replied, Finished, Resume (Sequence B) ----
  const pausedB: Pick = { activity: ACT.paused, seq: SEQ_B, days: true };
  // The page renders the sequence name as a link, so the text has two spaces before it.
  const pausedText = /has been paused for \d+ days for sequence\s+Sequence B/;
  // Rows 1 and 2 differ from the developer log (QA to say bug or not): asserted as the log says.
  // Paused > 1 (Move and Paused in one run) is dropped: Paused only works on a prospect already in the sequence (QA 2026-11-11). Row 4 covers it.
  newLeadRow({ name: 'Paused, Replied, Finished, Resume > 2: Finished with Move selected, new Lead', picks: [move(SEQ_B), { activity: ACT.finished, seq: SEQ_B }], want: () => ({ status: 'Finished' }) });
  newLeadRow({ name: 'Paused, Replied, Finished, Resume > 3: Replied with Move selected, new Lead', picks: [move(SEQ_B), { activity: ACT.replied, seq: SEQ_B }], want: () => ({ status: 'Replied' }) });
  existingRow('Paused, Replied, Finished, Resume > 4: prospect in Sequence B, Paused selected', [{ picks: [pausedB], title: 'Dock Manager II' }], () => ({ status: 'Paused', activity: pausedText }));
  existingRow('Paused, Replied, Finished, Resume > 5: prospect in Sequence B, Finished selected', [{ picks: [{ activity: ACT.finished, seq: SEQ_B }], title: 'Plant Owner II' }], () => ({ status: 'Finished' }));
  existingRow('Paused, Replied, Finished, Resume > 6: prospect in Sequence B, Replied selected', [{ picks: [{ activity: ACT.replied, seq: SEQ_B }], title: 'Founder II' }], () => ({ status: 'Replied' }));
  existingRow(
    'Paused, Replied, Finished, Resume > 7: paused prospect, Resume selected',
    [{ picks: [pausedB], title: 'Studio Owner II' }, { picks: [{ activity: ACT.resume, seq: SEQ_B }], title: 'Studio Owner III' }],
    () => ({ status: 'Active' }),
  );
  existingRow("Paused, Replied, Finished, Resume > 8: prospect in Sequence B, Paused with list Today's Leads", [{ picks: [pausedB], lists: TODAY, title: 'Buyer II' }], () => ({ status: 'Paused' }));

  // ---- Unsubscribed ----
  const unsub: Pick = { activity: ACT.unsubscribed };
  // Two steps (QA 2026-11-11): the prospect is moved into Sequence B first, then a second Lead with the same email runs Unsubscribed alone.
  existingRow('Unsubscribed > 1: prospect in Sequence B, Unsubscribed selected, window holds only this Lead', [{ picks: [unsub], title: 'Fleet Manager II', windowCheck: true }], () => ({ status: 'Unsubscribed' }));
  existingRow("Unsubscribed > 2: prospect in Sequence B, Unsubscribed with list Today's Leads, window holds only this Lead", [{ picks: [unsub], lists: TODAY, title: 'Fleet Manager III', windowCheck: true }], () => ({ status: 'Unsubscribed' }));

  // ---- Blacklist a Domain ----
  test('Blacklist > 1: new Lead on a reserved test domain', async ({ salesforceIntegration, saleshandyCrm, saleshandyDnc }) => {
    const domain = `lead${Date.now().toString(36)}.example.com`;
    const lead = newLead();
    lead.email = `${lead.firstName}.${lead.lastName}@${domain}`.toLowerCase();
    await useActivities(salesforceIntegration, [{ activity: ACT.blacklist }], []);
    await sf.createLead(lead, true);
    const n = await windowCount(sf);
    test.skip(n > 1, `${n} Leads are in the window since the last run; their domains would be listed too`);
    await runNow(salesforceIntegration.page);
    try {
      await untilPasses(`${domain} not on the Do Not Contact list`, async () => {
        await saleshandyDnc.openGlobalList();
        expect(await saleshandyDnc.hasEntry(domain), `${domain} on the list`).toBe(true);
      });
      expect(await saleshandyCrm.search(lead.email), 'prospects with the blacklisted domain').toBe(0);
    } finally {
      await clearDnc(saleshandyDnc, [domain, 'mailinator.com']);
    }
  });

  test('Blacklist > 2: second Lead on the same domain: run errors at Blacklist Domains (Bulk), domain listed once', async ({ salesforceIntegration, saleshandyDnc }) => {
    const domain = `lead${Date.now().toString(36)}b.example.com`;
    await useActivities(salesforceIntegration, [{ activity: ACT.blacklist }], []);
    const a = newLead();
    a.email = `${a.firstName}.${a.lastName}@${domain}`.toLowerCase();
    await sf.createLead(a, true);
    test.skip((await windowCount(sf)) > 1, 'More than one Lead in the window');
    const b = newLead();
    b.email = `${b.firstName}.${b.lastName}@${domain}`.toLowerCase();
    try {
      await runNow(salesforceIntegration.page);
      await sf.createLead(b, true);
      // The domain is already on the list, so the Do Not Contact API answers 400 "Inserted email
      // or domain already exist in this list" and the step errors (QA 2026-11-11).
      await runNowExpectingError(salesforceIntegration.page, 'Blacklist Domains (Bulk)');
      await saleshandyDnc.openGlobalList();
      const listed = (await saleshandyDnc.entries()).filter((e) => e.includes(domain)).length;
      test.info().annotations.push({ type: 'Needs QA', description: `Blacklist > 2: ${domain} listed ${listed} time(s); expected result is once` });
      expect(listed).toBe(1);
    } finally {
      await clearDnc(saleshandyDnc, [domain, 'mailinator.com']);
    }
  });
});
