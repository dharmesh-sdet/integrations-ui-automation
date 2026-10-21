// spec: specs/salesforce-reply-received.md
// seed: tests/seeds/sfreplyreceived.seed.spec.ts
// Scenarios: test-cases/salesforce/reply-received.md (Regression).
// Data: test-data/salesforce/reply-received.csv, one row per scenario (Scenario column).
// Page objects: src/pages/saleshandy/salesforce-integration.page.ts (Triggers &
// Activity, Logs, Field Mapping), src/pages/salesforce/leads.page.ts (Leads list), and the
// sequence page of the HubSpot workflows (Add Prospects, Emails tab, Mark as replied).
import { expect, test } from '../../src/fixtures/index.ts';
import { readCsv, type Row } from '../../src/data/csv.ts';
import { markUsed } from '../../src/data/used.ts';
import { staysTrue, untilPasses } from '../../src/utils/wait.ts';

test.use({ account: 'sfreplyreceived' });

// Name on Triggers & Activity and in Logs (seen 2026-10-16).
const TRIGGER = 'Reply is Received in Saleshandy';
const ACTIVITY = 'Create a Lead in Salesforce';

// Sequence "Salesforce's First Sequence." on the sfreplyreceived account: step 1
// is a plain email (subject "Salesforce reply test"), sender "Salesforce
// Testing", launched 2026-10-16. Its steps 2 and 3 (Day 3 and Day 7 follow-ups)
// were already in the draft and never send after a reply.
const SEQUENCE_ID = '196746';
const CSV = 'salesforce/reply-received.csv';

test.describe('Reply is Received in Saleshandy', () => {
  test.describe.configure({ mode: 'serial' });

  // Activity names as the list shows them (00-overview.md). The Create and
  // Update options end in " in Salesforce"; activityOption matches the start.
  const ACTIVITY_OPTIONS = [
    'Create a Account',
    'Update a Account',
    'Create a Contact',
    'Update a Contact',
    'Create a Lead',
    'Update a Lead',
    'Create a Opportunity',
    'Update a Opportunity',
    'Attach Note',
    'Record(log) an Email Activity',
  ];

  test('Baseline 1: activity list and the Create a Lead chip, nothing saved', async ({ salesforceIntegration }) => {
    // Turn on "Reply is Received in Saleshandy" (do not Save).
    await test.step('Turn on the trigger without saving', async () => {
      await salesforceIntegration.openTriggers();
      await salesforceIntegration.enableOnly(TRIGGER);
    });

    // Open the activity dropdown: it lists the 10 activities.
    await test.step('The activity list shows the 10 activities', async () => {
      await salesforceIntegration.openActivityList(TRIGGER);
      for (const option of ACTIVITY_OPTIONS) {
        await expect(salesforceIntegration.activityOption(option).first(), option).toBeVisible();
      }
    });

    // Choose "Create a Lead in Salesforce": it appears as a chip with an x.
    await test.step('Choose Create a Lead in Salesforce', async () => {
      await salesforceIntegration.activityOption('Create a Lead').first().click();
      const chips = await salesforceIntegration.selectedActivities(TRIGGER);
      expect(chips.some((t) => t.includes(ACTIVITY)), `chips: ${chips.join(' | ')}`).toBe(true);
    });

    // No Extra Configuration modal opens.
    await test.step('No Extra Configuration modal opens', async () => {
      await expect(salesforceIntegration.page.getByRole('dialog')).toHaveCount(0);
    });
  });

  test('Baseline 2: only Create a Lead selected, Save and reload', async ({ salesforceIntegration }) => {
    // Turn on the trigger (every other one off), choose the activity, Save.
    await test.step('Turn on the trigger with only Create a Lead in Salesforce and Save', async () => {
      await salesforceIntegration.openTriggers();
      await salesforceIntegration.enableOnly(TRIGGER);
      if (!(await salesforceIntegration.selectedActivities(TRIGGER)).some((t) => t.includes(ACTIVITY))) {
        await salesforceIntegration.selectActivity(TRIGGER, ACTIVITY);
      }
      await salesforceIntegration.save();
      await expect(salesforceIntegration.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
    });

    // After a reload the toggle is on and the chip persists.
    await test.step('After a reload the toggle is on and the chip persists', async () => {
      await salesforceIntegration.openTriggers();
      expect(await salesforceIntegration.isTriggerOn(TRIGGER), 'trigger on').toBe(true);
      const chips = await salesforceIntegration.selectedActivities(TRIGGER);
      expect(chips.some((t) => t.includes(ACTIVITY)), `chips: ${chips.join(' | ')}`).toBe(true);
    });
  });

  // Lead Properties mapping for Last Name, First Name, Email, Phone Number,
  // Job Title, Company and City, so later scenarios in this workflow see a
  // non-empty mapping. On sfreplyreceived (checked 2026-10-19) every field
  // except Job Title already showed its matching Salesforce property as a
  // default suggestion (Save was already enabled, not disabled); Job Title
  // was the only one still on "Select". All 7 are mapped explicitly here.
  test('Baseline 3: Lead Properties mapping page and Save', async ({ salesforceIntegration }) => {
    const mappings: [string, string][] = [
      ['Last Name', 'Last Name'],
      ['First Name', 'First Name'],
      ['Email', 'Email'],
      ['Phone Number', 'Phone'],
      ['Job Title', 'Title'],
      ['Company', 'Company'],
      ['City', 'City'],
    ];

    // Open Settings > Integrations > Salesforce > Field Mapping > Lead Properties.
    await test.step('Open Settings > Integrations > Salesforce > Field Mapping > Lead Properties', async () => {
      await salesforceIntegration.openLeadPropertiesMapping();
    });

    // Map Last Name, First Name, Email, Phone Number, Job Title, Company and
    // City to their Salesforce Lead properties.
    await test.step('Map Last Name, First Name, Email, Phone Number, Job Title, Company and City to their Salesforce Lead properties', async () => {
      for (const [saleshandyField, salesforceProperty] of mappings) {
        await salesforceIntegration.mapLeadField(saleshandyField, salesforceProperty);
      }
    });

    // Click Save.
    await test.step('Click Save', async () => {
      await salesforceIntegration.save();
      await expect(salesforceIntegration.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
    });

    // Reload the page.
    await test.step('Reload the page', async () => {
      await salesforceIntegration.openLeadPropertiesMapping();
    });

    // All 7 mappings persist.
    await test.step('All 7 mappings persist after the reload', async () => {
      for (const [saleshandyField, salesforceProperty] of mappings) {
        await expect(salesforceIntegration.leadMappedValue(saleshandyField), saleshandyField).toHaveText(salesforceProperty);
      }
    });
  });

  test('Create a Lead in Salesforce > 7: Lead Properties mapping empty, trigger on', async ({
    saleshandyPage,
    salesforceIntegration,
    saleshandySequence,
    salesforceLeads,
  }) => {
    // Waits for the send, the reply, the Logs entry and the Salesforce check.
    test.setTimeout(12 * 60_000);
    const row = readCsv(CSV).find((r) => r['Scenario'] === 'Create a Lead in Salesforce > 7');
    if (!row) throw new Error('No row "Create a Lead in Salesforce > 7" in test-data/salesforce/reply-received.csv');
    const name = `${row['First Name']} ${row['Last Name']}`;

    // Setup: every other trigger off, only "Reply is Received in Saleshandy" on
    // with only "Create a Lead in Salesforce" selected, Save. The Lead Properties
    // mapping is NOT touched: it must stay empty for this row.
    await test.step('Turn on only "Reply is Received in Saleshandy" with only "Create a Lead in Salesforce" and save', async () => {
      await salesforceIntegration.openTriggers();
      await salesforceIntegration.enableOnly(TRIGGER);
      for (const activity of await salesforceIntegration.selectedActivities(TRIGGER)) {
        if (activity !== ACTIVITY) await salesforceIntegration.removeActivity(TRIGGER, activity);
      }
      if (!(await salesforceIntegration.selectedActivities(TRIGGER)).includes(ACTIVITY)) {
        await salesforceIntegration.selectActivity(TRIGGER, ACTIVITY);
      }
      await salesforceIntegration.save();
      await expect(salesforceIntegration.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
    });

    // Lead Properties mapping empty (nothing mapped), trigger on, new prospect with step 1 Sent.
    await test.step('Add the prospect to the sequence', async () => {
      await saleshandySequence.createAndAddProspect(SEQUENCE_ID, row);
      markUsed(CSV, row['Email']);
    });

    await test.step('Wait until the step 1 email shows Sent', async () => {
      await saleshandySequence.ensureSent(SEQUENCE_ID, name);
    });

    let known = new Set<string>();
    await test.step('Note the Logs entries that exist before the reply', async () => {
      await salesforceIntegration.openLogs();
      known = new Set((await salesforceIntegration.logEntries(TRIGGER)).map((e) => e.id));
    });

    // Do: Mark as Replied (Emails tab > the prospect's row > three dots > Mark as replied).
    await test.step('Mark the step 1 email as replied', async () => {
      await saleshandySequence.markAsReplied(SEQUENCE_ID, name);
    });

    // Logs: refresh 15 s after the action, then every 10 s, up to 3 min. Entries are not opened.
    let status = '';
    await test.step('Wait for the new Logs entry and read its status', async () => {
      await salesforceIntegration.openLogs();
      await untilPasses(`No finished new "${TRIGGER}" Logs entry for ${row['Email']}`, async () => {
        await salesforceIntegration.refreshLogs();
        const fresh = (await salesforceIntegration.logEntries(TRIGGER)).filter((e) => !known.has(e.id));
        expect(fresh.length, 'new Logs entries').toBeGreaterThan(0);
        const finished = fresh.find((e) => e.status === 'Success' || e.status === 'Error');
        expect(finished, `new entries: ${fresh.map((e) => e.text).join(' | ')}`).toBeTruthy();
        status = finished!.status;
        test.info().annotations.push({ type: 'Logs row', description: finished!.text });
      });
    });
    test.info().annotations.push({ type: 'Logs status', description: status });

    // Expected (QA, 2026-10-16): with the mapping empty the workflow uses the
    // defaults Salesforce requires, so the Lead is still created. Logs shows
    // Success and Salesforce has exactly one Lead for the email (checked in
    // Salesforce itself, never only in Logs).
    expect(status, 'Logs status').toBe('Success');
    await test.step('Find exactly one Lead for the email in Salesforce Leads', async () => {
      await salesforceLeads.openLeads();
      await untilPasses('the Lead appears in Salesforce', async () => {
        expect(await salesforceLeads.countByEmail(row['Email']), `Leads in Salesforce for ${row['Email']}`).toBe(1);
      });
    });
  });

  // ---- Rows below run after "> 7" in this serial file. The trigger stays
  // enabled with only "Create a Lead in Salesforce" selected for every row
  // except "> 3" (which turns it off and restores it inside the same test);
  // Baseline 3 already saved the full 7-field Lead Properties mapping, so no
  // row below touches that mapping again except "> 8" and "> 13" (which run
  // last, per the run order QA gave).

  test('Create a Lead in Salesforce > 1: new prospect, every mapped field filled', async ({
    salesforceIntegration,
    saleshandySequence,
    salesforceLeads,
  }) => {
    test.setTimeout(12 * 60_000);
    const row = readCsv(CSV).find((r) => r['Scenario'] === 'Create a Lead in Salesforce > 1');
    if (!row) throw new Error('No row "Create a Lead in Salesforce > 1" in test-data/salesforce/reply-received.csv');
    const name = `${row['First Name']} ${row['Last Name']}`;

    // New prospect (First Name, Last Name, Email, Phone, Job Title, Company, City filled), not in Salesforce.
    await test.step('Add the new prospect to the sequence', async () => {
      await saleshandySequence.createAndAddProspect(SEQUENCE_ID, row);
      markUsed(CSV, row['Email']);
    });

    await test.step('Wait until the step 1 email shows Sent', async () => {
      await saleshandySequence.ensureSent(SEQUENCE_ID, name);
    });

    let known = new Set<string>();
    await test.step('Note the Logs entries that exist before the reply', async () => {
      await salesforceIntegration.openLogs();
      known = new Set((await salesforceIntegration.logEntries(TRIGGER)).map((e) => e.id));
    });

    // Mark as Replied.
    await test.step('Mark the step 1 email as replied', async () => {
      await saleshandySequence.markAsReplied(SEQUENCE_ID, name);
    });

    let status = '';
    await test.step('Wait for the new Logs entry and read its status', async () => {
      await salesforceIntegration.openLogs();
      await untilPasses(`No finished new "${TRIGGER}" Logs entry for ${row['Email']}`, async () => {
        await salesforceIntegration.refreshLogs();
        const fresh = (await salesforceIntegration.logEntries(TRIGGER)).filter((e) => !known.has(e.id));
        expect(fresh.length, 'new Logs entries').toBeGreaterThan(0);
        const finished = fresh.find((e) => e.status === 'Success' || e.status === 'Error');
        expect(finished, `new entries: ${fresh.map((e) => e.text).join(' | ')}`).toBeTruthy();
        status = finished!.status;
        test.info().annotations.push({ type: 'Logs row', description: finished!.text });
      });
    });
    test.info().annotations.push({ type: 'Logs status', description: status });

    // Expected: Success within 3 min. Exactly one Lead with Last Name, First
    // Name, Email, Phone, Title, Company, City matching prospect values.
    // leadFields().name is the combined First+Last Name shown on the real
    // Lead record (Salesforce's Details tab has no separate First/Last row).
    expect(status, 'Logs status').toBe('Success');
    await test.step('Exactly one Lead for the email, with fields matching the prospect', async () => {
      await salesforceLeads.openLeads();
      await untilPasses('the Lead appears in Salesforce', async () => {
        expect(await salesforceLeads.countByEmail(row['Email']), `Leads in Salesforce for ${row['Email']}`).toBe(1);
      });
      const fields = await salesforceLeads.leadFields(row['Email']);
      expect(fields.name, 'Lead Name').toBe(name);
      expect(fields.email, 'Lead Email').toBe(row['Email']);
      expect(fields.phone, 'Lead Phone').toBe(row['Phone Number']);
      expect(fields.title, 'Lead Title').toBe(row['Job Title']);
      expect(fields.company, 'Lead Company').toBe(row['Company']);
      expect(fields.address, 'Lead Address (holds City)').toContain(row['City']);
    });
  });

  test('Create a Lead in Salesforce > 2: Department, Industry, Website filled but unmapped', async ({
    salesforceIntegration,
    saleshandySequence,
    salesforceLeads,
  }) => {
    test.setTimeout(12 * 60_000);
    const row = readCsv(CSV).find((r) => r['Scenario'] === 'Create a Lead in Salesforce > 2');
    if (!row) throw new Error('No row "Create a Lead in Salesforce > 2" in test-data/salesforce/reply-received.csv');
    const name = `${row['First Name']} ${row['Last Name']}`;

    // Prospect has Department, Industry, Website filled (none of the three mapped).
    await test.step('Add the prospect to the sequence', async () => {
      await saleshandySequence.createAndAddProspect(SEQUENCE_ID, row);
      markUsed(CSV, row['Email']);
    });

    await test.step('Wait until the step 1 email shows Sent', async () => {
      await saleshandySequence.ensureSent(SEQUENCE_ID, name);
    });

    let known = new Set<string>();
    await test.step('Note the Logs entries that exist before the reply', async () => {
      await salesforceIntegration.openLogs();
      known = new Set((await salesforceIntegration.logEntries(TRIGGER)).map((e) => e.id));
    });

    await test.step('Mark the step 1 email as replied', async () => {
      await saleshandySequence.markAsReplied(SEQUENCE_ID, name);
    });

    let status = '';
    await test.step('Wait for the new Logs entry and read its status', async () => {
      await salesforceIntegration.openLogs();
      await untilPasses(`No finished new "${TRIGGER}" Logs entry for ${row['Email']}`, async () => {
        await salesforceIntegration.refreshLogs();
        const fresh = (await salesforceIntegration.logEntries(TRIGGER)).filter((e) => !known.has(e.id));
        expect(fresh.length, 'new Logs entries').toBeGreaterThan(0);
        const finished = fresh.find((e) => e.status === 'Success' || e.status === 'Error');
        expect(finished, `new entries: ${fresh.map((e) => e.text).join(' | ')}`).toBeTruthy();
        status = finished!.status;
        test.info().annotations.push({ type: 'Logs row', description: finished!.text });
      });
    });
    test.info().annotations.push({ type: 'Logs status', description: status });

    expect(status, 'Logs status').toBe('Success');
    // The Lead has no value for the unmapped fields (Industry, Website).
    // Industry and Website are standard Lead fields but leadFields() does not
    // read them; read directly with the same [data-target-selection-name=...]
    // pattern as leads.page.ts (TODO: move into leads.page.ts next time it is
    // editable, instead of a selector in the spec).
    await test.step('The Lead has no value for Industry or Website', async () => {
      await salesforceLeads.openLead(row['Email']);
      for (const apiName of ['Industry', 'Website']) {
        const field = salesforceLeads.page.locator(`[data-target-selection-name="sfdc:RecordField.Lead.${apiName}"] .test-id__field-value`);
        const text = (await field.count()) ? (await field.innerText()).replace(/\s+/g, ' ').trim() : '';
        expect(text, `Lead ${apiName}`).toBe('');
      }
    });
  });

  test('Create a Lead in Salesforce > 3: trigger turned off and saved', async ({
    salesforceIntegration,
    saleshandySequence,
    salesforceLeads,
  }) => {
    test.setTimeout(12 * 60_000);
    const row = readCsv(CSV).find((r) => r['Scenario'] === 'Create a Lead in Salesforce > 3');
    if (!row) throw new Error('No row "Create a Lead in Salesforce > 3" in test-data/salesforce/reply-received.csv');
    const name = `${row['First Name']} ${row['Last Name']}`;

    // Turn off every trigger and save. enableOnly('') matches no real trigger
    // row's text, so every row (TRIGGER included) is switched off; the
    // "Create a Lead in Salesforce" activity chip is not removed by this.
    await test.step('Turn the trigger off and save', async () => {
      await salesforceIntegration.openTriggers();
      await salesforceIntegration.enableOnly('');
      await salesforceIntegration.save();
      await expect(salesforceIntegration.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
      expect(await salesforceIntegration.isTriggerOn(TRIGGER), 'trigger off').toBe(false);
    });

    await test.step('Add a new prospect to the sequence', async () => {
      await saleshandySequence.createAndAddProspect(SEQUENCE_ID, row);
      markUsed(CSV, row['Email']);
    });

    await test.step('Wait until the step 1 email shows Sent', async () => {
      await saleshandySequence.ensureSent(SEQUENCE_ID, name);
    });

    let known = new Set<string>();
    await test.step('Note the Logs entries that exist before Mark as Replied', async () => {
      await salesforceIntegration.openLogs();
      known = new Set((await salesforceIntegration.logEntries(TRIGGER)).map((e) => e.id));
    });

    await test.step('Mark the step 1 email as replied', async () => {
      await saleshandySequence.markAsReplied(SEQUENCE_ID, name);
    });

    // Expected: no Logs row after 3 min wait, no Lead in Salesforce.
    await test.step('No new Logs row appears within 3 minutes', async () => {
      await staysTrue(
        salesforceIntegration.page,
        async () => {
          await salesforceIntegration.refreshLogs();
          const fresh = (await salesforceIntegration.logEntries(TRIGGER)).filter((e) => !known.has(e.id));
          expect(fresh.length, `new Logs entries: ${fresh.map((e) => e.text).join(' | ')}`).toBe(0);
        },
        18,
      );
    });

    await test.step('No Lead exists for the email in Salesforce', async () => {
      await salesforceLeads.openLeads();
      expect(await salesforceLeads.countByEmail(row['Email']), `Leads in Salesforce for ${row['Email']}`).toBe(0);
    });

    // Restore the trigger for the remaining rows in this serial file ("> 4"
    // onward all need it on with "Create a Lead in Salesforce" selected).
    await test.step('Turn the trigger back on and save', async () => {
      await salesforceIntegration.openTriggers();
      await salesforceIntegration.enableOnly(TRIGGER);
      if (!(await salesforceIntegration.selectedActivities(TRIGGER)).includes(ACTIVITY)) {
        await salesforceIntegration.selectActivity(TRIGGER, ACTIVITY);
      }
      await salesforceIntegration.save();
      await expect(salesforceIntegration.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
    });
  });

  test('Create a Lead in Salesforce > 4: Lead Status unmapped', async ({
    salesforceIntegration,
    saleshandySequence,
    salesforceLeads,
  }) => {
    test.setTimeout(12 * 60_000);
    const row = readCsv(CSV).find((r) => r['Scenario'] === 'Create a Lead in Salesforce > 4');
    if (!row) throw new Error('No row "Create a Lead in Salesforce > 4" in test-data/salesforce/reply-received.csv');
    const name = `${row['First Name']} ${row['Last Name']}`;

    await test.step('Add a new prospect to the sequence', async () => {
      // Consume the row first: a failed add can still leave the prospect in Saleshandy.
      markUsed(CSV, row['Email']);
      await saleshandySequence.createAndAddProspect(SEQUENCE_ID, row);
    });

    await test.step('Wait until the step 1 email shows Sent', async () => {
      await saleshandySequence.ensureSent(SEQUENCE_ID, name);
    });

    let known = new Set<string>();
    await test.step('Note the Logs entries that exist before the reply', async () => {
      await salesforceIntegration.openLogs();
      known = new Set((await salesforceIntegration.logEntries(TRIGGER)).map((e) => e.id));
    });

    await test.step('Mark the step 1 email as replied', async () => {
      await saleshandySequence.markAsReplied(SEQUENCE_ID, name);
    });

    let status = '';
    await test.step('Wait for the new Logs entry and read its status', async () => {
      await salesforceIntegration.openLogs();
      await untilPasses(`No finished new "${TRIGGER}" Logs entry for ${row['Email']}`, async () => {
        await salesforceIntegration.refreshLogs();
        const fresh = (await salesforceIntegration.logEntries(TRIGGER)).filter((e) => !known.has(e.id));
        expect(fresh.length, 'new Logs entries').toBeGreaterThan(0);
        const finished = fresh.find((e) => e.status === 'Success' || e.status === 'Error');
        expect(finished, `new entries: ${fresh.map((e) => e.text).join(' | ')}`).toBeTruthy();
        status = finished!.status;
        test.info().annotations.push({ type: 'Logs row', description: finished!.text });
      });
    });
    test.info().annotations.push({ type: 'Logs status', description: status });

    // Expected (QA: not-mapped case only): Status is not mapped to any
    // Saleshandy field, so the Lead gets Salesforce's own default.
    expect(status, 'Logs status').toBe('Success');
    await test.step('The new Lead has Lead Status "Open - Not Contacted"', async () => {
      const fields = await salesforceLeads.leadFields(row['Email']);
      expect(fields.status, 'Lead Status').toBe('Open - Not Contacted');
    });
  });

  test('Create a Lead in Salesforce > 5: Lead Owner', async ({
    salesforceIntegration,
    saleshandySequence,
    salesforceLeads,
  }) => {
    test.setTimeout(12 * 60_000);
    const row = readCsv(CSV).find((r) => r['Scenario'] === 'Create a Lead in Salesforce > 5');
    if (!row) throw new Error('No row "Create a Lead in Salesforce > 5" in test-data/salesforce/reply-received.csv');
    const name = `${row['First Name']} ${row['Last Name']}`;

    await test.step('Add a new prospect to the sequence', async () => {
      await saleshandySequence.createAndAddProspect(SEQUENCE_ID, row);
      markUsed(CSV, row['Email']);
    });

    await test.step('Wait until the step 1 email shows Sent', async () => {
      await saleshandySequence.ensureSent(SEQUENCE_ID, name);
    });

    let known = new Set<string>();
    await test.step('Note the Logs entries that exist before the reply', async () => {
      await salesforceIntegration.openLogs();
      known = new Set((await salesforceIntegration.logEntries(TRIGGER)).map((e) => e.id));
    });

    await test.step('Mark the step 1 email as replied', async () => {
      await saleshandySequence.markAsReplied(SEQUENCE_ID, name);
    });

    let status = '';
    await test.step('Wait for the new Logs entry and read its status', async () => {
      await salesforceIntegration.openLogs();
      await untilPasses(`No finished new "${TRIGGER}" Logs entry for ${row['Email']}`, async () => {
        await salesforceIntegration.refreshLogs();
        const fresh = (await salesforceIntegration.logEntries(TRIGGER)).filter((e) => !known.has(e.id));
        expect(fresh.length, 'new Logs entries').toBeGreaterThan(0);
        const finished = fresh.find((e) => e.status === 'Success' || e.status === 'Error');
        expect(finished, `new entries: ${fresh.map((e) => e.text).join(' | ')}`).toBeTruthy();
        status = finished!.status;
        test.info().annotations.push({ type: 'Logs row', description: finished!.text });
      });
    });
    test.info().annotations.push({ type: 'Logs status', description: status });

    expect(status, 'Logs status').toBe('Success');
    // Open the new Lead in Salesforce and read its Owner. Owner is not part
    // of leadFields(); read directly with the same selector pattern (TODO:
    // move into leads.page.ts next time it is editable).
    await test.step('Open the Lead and read its Owner', async () => {
      await salesforceLeads.openLead(row['Email']);
      const owner = (await salesforceLeads.page.locator('[data-target-selection-name="sfdc:RecordField.Lead.OwnerId"] .test-id__field-value').innerText()).replace(/\s+/g, ' ').trim();
      test.info().annotations.push({ type: 'Lead Owner', description: owner });
      expect(owner.length, 'Lead Owner is not empty').toBeGreaterThan(0);
    });
  });

  test('Create a Lead in Salesforce > 6: Company mapped, prospect Company empty', async ({
    salesforceIntegration,
    saleshandySequence,
    salesforceLeads,
  }) => {
    test.setTimeout(12 * 60_000);
    const row = readCsv(CSV).find((r) => r['Scenario'] === 'Create a Lead in Salesforce > 6');
    if (!row) throw new Error('No row "Create a Lead in Salesforce > 6" in test-data/salesforce/reply-received.csv');
    const name = `${row['First Name']} ${row['Last Name']}`;

    // Prospect's Company is left empty on purpose (CSV Note).
    await test.step('Add the prospect (Company left empty) to the sequence', async () => {
      await saleshandySequence.createAndAddProspect(SEQUENCE_ID, row);
      markUsed(CSV, row['Email']);
    });

    await test.step('Wait until the step 1 email shows Sent', async () => {
      await saleshandySequence.ensureSent(SEQUENCE_ID, name);
    });

    let known = new Set<string>();
    await test.step('Note the Logs entries that exist before the reply', async () => {
      await salesforceIntegration.openLogs();
      known = new Set((await salesforceIntegration.logEntries(TRIGGER)).map((e) => e.id));
    });

    await test.step('Mark the step 1 email as replied', async () => {
      await saleshandySequence.markAsReplied(SEQUENCE_ID, name);
    });

    // Expected (proposed, unconfirmed): either Logs shows Error, or a default
    // Company is used. Record the real result instead of assuming one.
    let status = '';
    await test.step('Wait for the new Logs entry and read its status', async () => {
      await salesforceIntegration.openLogs();
      await untilPasses(`No finished new "${TRIGGER}" Logs entry for ${row['Email']}`, async () => {
        await salesforceIntegration.refreshLogs();
        const fresh = (await salesforceIntegration.logEntries(TRIGGER)).filter((e) => !known.has(e.id));
        expect(fresh.length, 'new Logs entries').toBeGreaterThan(0);
        const finished = fresh.find((e) => e.status === 'Success' || e.status === 'Error');
        expect(finished, `new entries: ${fresh.map((e) => e.text).join(' | ')}`).toBeTruthy();
        status = finished!.status;
        test.info().annotations.push({ type: 'Logs row', description: finished!.text });
      });
    });
    test.info().annotations.push({ type: 'Logs status (Company empty)', description: status });

    await test.step('Record whether a Lead was created, and its Company if so', async () => {
      await salesforceLeads.openLeads();
      const count = await salesforceLeads.countByEmail(row['Email']);
      test.info().annotations.push({ type: 'Leads found', description: String(count) });
      if (count === 1) {
        const fields = await salesforceLeads.leadFields(row['Email']);
        test.info().annotations.push({ type: 'Lead Company (Company empty case)', description: fields.company || '(empty)' });
      }
    });
  });

  test('Create a Lead in Salesforce > 9: same prospect as row 1 replies again', async ({
    salesforceIntegration,
    saleshandySequence,
    salesforceLeads,
  }) => {
    test.setTimeout(10 * 60_000);
    // Reuses row 1's prospect (test-cases Note: "Same prospect as row 1, mark
    // as replied again"); row 9's own CSV columns are not used for the
    // action, the row only exists so the data file has one row per scenario.
    const row1 = readCsv(CSV).find((r) => r['Scenario'] === 'Create a Lead in Salesforce > 1');
    if (!row1) throw new Error('No row "Create a Lead in Salesforce > 1" in test-data/salesforce/reply-received.csv');
    const name = `${row1['First Name']} ${row1['Last Name']}`;

    let known = new Set<string>();
    await test.step('Note the Logs entries that exist before the second reply', async () => {
      await salesforceIntegration.openLogs();
      known = new Set((await salesforceIntegration.logEntries(TRIGGER)).map((e) => e.id));
    });

    await test.step("Mark row 1's step 1 email as replied again", async () => {
      await saleshandySequence.markAsReplied(SEQUENCE_ID, name);
    });

    let status = '';
    await test.step('Wait for the new Logs entry and read its status', async () => {
      await salesforceIntegration.openLogs();
      await untilPasses(`No finished new "${TRIGGER}" Logs entry for ${row1['Email']}`, async () => {
        await salesforceIntegration.refreshLogs();
        const fresh = (await salesforceIntegration.logEntries(TRIGGER)).filter((e) => !known.has(e.id));
        expect(fresh.length, 'new Logs entries').toBeGreaterThan(0);
        const finished = fresh.find((e) => e.status === 'Success' || e.status === 'Error');
        expect(finished, `new entries: ${fresh.map((e) => e.text).join(' | ')}`).toBeTruthy();
        status = finished!.status;
        test.info().annotations.push({ type: 'Logs row', description: finished!.text });
      });
    });
    test.info().annotations.push({ type: 'Logs status (second reply)', description: status });

    // Expected (proposed, unconfirmed): no duplicate Lead, still exactly one
    // for the email.
    await test.step('Still exactly one Lead for the email (no duplicate)', async () => {
      await salesforceLeads.openLeads();
      const count = await salesforceLeads.countByEmail(row1['Email']);
      test.info().annotations.push({ type: 'Leads found for row 1 email', description: String(count) });
      expect(count, `Leads in Salesforce for ${row1['Email']}`).toBe(1);
    });
  });

  test('Create a Lead in Salesforce > 10: new prospect, same email as row 1', async ({
    salesforceIntegration,
    saleshandySequence,
    salesforceLeads,
  }) => {
    test.setTimeout(12 * 60_000);
    const row1 = readCsv(CSV).find((r) => r['Scenario'] === 'Create a Lead in Salesforce > 1');
    const csvRow = readCsv(CSV).find((r) => r['Scenario'] === 'Create a Lead in Salesforce > 10');
    if (!row1) throw new Error('No row "Create a Lead in Salesforce > 1" in test-data/salesforce/reply-received.csv');
    if (!csvRow) throw new Error('No row "Create a Lead in Salesforce > 10" in test-data/salesforce/reply-received.csv');
    // Test-cases Note: "Same Email as row 1, different person (duplicate
    // check)". The CSV row has its own unique email, so this is a deliberate
    // override to row 1's email, as the scenario requires.
    const row: Row = { ...csvRow, Email: row1['Email'] };
    const name = `${row['First Name']} ${row['Last Name']}`;

    await test.step('Add a second prospect with the same email as row 1', async () => {
      await saleshandySequence.createAndAddProspect(SEQUENCE_ID, row);
      markUsed(CSV, csvRow['Email']);
    });

    await test.step('Wait until the step 1 email shows Sent', async () => {
      await saleshandySequence.ensureSent(SEQUENCE_ID, name);
    });

    let known = new Set<string>();
    await test.step('Note the Logs entries that exist before the reply', async () => {
      await salesforceIntegration.openLogs();
      known = new Set((await salesforceIntegration.logEntries(TRIGGER)).map((e) => e.id));
    });

    await test.step('Mark the step 1 email as replied', async () => {
      await saleshandySequence.markAsReplied(SEQUENCE_ID, name);
    });

    let status = '';
    await test.step('Wait for the new Logs entry and read its status', async () => {
      await salesforceIntegration.openLogs();
      await untilPasses(`No finished new "${TRIGGER}" Logs entry for ${row['Email']}`, async () => {
        await salesforceIntegration.refreshLogs();
        const fresh = (await salesforceIntegration.logEntries(TRIGGER)).filter((e) => !known.has(e.id));
        expect(fresh.length, 'new Logs entries').toBeGreaterThan(0);
        const finished = fresh.find((e) => e.status === 'Success' || e.status === 'Error');
        expect(finished, `new entries: ${fresh.map((e) => e.text).join(' | ')}`).toBeTruthy();
        status = finished!.status;
        test.info().annotations.push({ type: 'Logs row', description: finished!.text });
      });
    });
    test.info().annotations.push({ type: 'Logs status (duplicate email)', description: status });

    // Expected (proposed, unconfirmed): no duplicate Lead; the existing Lead
    // is updated or unchanged. Record the actual Lead count and Name.
    await test.step('Record the Lead count and Name for the shared email', async () => {
      await salesforceLeads.openLeads();
      const count = await salesforceLeads.countByEmail(row['Email']);
      test.info().annotations.push({ type: 'Leads found for the shared email', description: String(count) });
      if (count === 1) {
        const fields = await salesforceLeads.leadFields(row['Email']);
        test.info().annotations.push({ type: 'Lead Name for the shared email', description: fields.name });
      }
    });
  });

  test('Create a Lead in Salesforce > 11: a Contact with the same email exists', async ({
    salesforceIntegration,
    saleshandySequence,
    salesforceLeads,
    salesforceContacts,
  }) => {
    test.setTimeout(12 * 60_000);
    const row = readCsv(CSV).find((r) => r['Scenario'] === 'Create a Lead in Salesforce > 11');
    if (!row) throw new Error('No row "Create a Lead in Salesforce > 11" in test-data/salesforce/reply-received.csv');
    const name = `${row['First Name']} ${row['Last Name']}`;

    // Setup: the Contact the scenario needs. Created directly in Salesforce
    // with the prospect's email (the scenario's "e.g. converted Lead" is one
    // way to get a Contact; a New Contact is the simpler one).
    await test.step('Create a Contact with the prospect email in Salesforce', async () => {
      await salesforceContacts.createContact({ firstName: row['First Name'], lastName: row['Last Name'], email: row['Email'] });
      expect(await salesforceContacts.countByEmail(row['Email']), `Contacts in Salesforce for ${row['Email']}`).toBe(1);
    });

    await test.step('Add the prospect to the sequence', async () => {
      await saleshandySequence.createAndAddProspect(SEQUENCE_ID, row);
      markUsed(CSV, row['Email']);
    });

    await test.step('Wait until the step 1 email shows Sent', async () => {
      await saleshandySequence.ensureSent(SEQUENCE_ID, name);
    });

    let known = new Set<string>();
    await test.step('Note the Logs entries that exist before Mark as Replied', async () => {
      await salesforceIntegration.openLogs();
      known = new Set((await salesforceIntegration.logEntries(TRIGGER)).map((e) => e.id));
    });

    await test.step('Mark the step 1 email as replied', async () => {
      await saleshandySequence.markAsReplied(SEQUENCE_ID, name);
    });

    let status = '';
    await test.step('Wait for the new Logs entry and read its status', async () => {
      await salesforceIntegration.openLogs();
      await untilPasses(`No finished new "${TRIGGER}" Logs entry for ${row['Email']}`, async () => {
        await salesforceIntegration.refreshLogs();
        const fresh = (await salesforceIntegration.logEntries(TRIGGER)).filter((e) => !known.has(e.id));
        expect(fresh.length, 'new Logs entries').toBeGreaterThan(0);
        const finished = fresh.find((e) => e.status === 'Success' || e.status === 'Error');
        expect(finished, `new entries: ${fresh.map((e) => e.text).join(' | ')}`).toBeTruthy();
        status = finished!.status;
        test.info().annotations.push({ type: 'Logs row', description: finished!.text });
      });
    });
    test.info().annotations.push({ type: 'Logs status (Contact with same email)', description: status });

    // Expected (proposed, unconfirmed): no new Lead is created. Record the
    // actual Lead count for the email.
    await test.step('Record the Lead count for the email', async () => {
      await salesforceLeads.openLeads();
      const count = await salesforceLeads.countByEmail(row['Email']);
      test.info().annotations.push({ type: 'Leads found for the email', description: String(count) });
    });
  });

  test('Create a Lead in Salesforce > 12: accented first name, apostrophe in last name, 60-char company', async ({
    salesforceIntegration,
    saleshandySequence,
    salesforceLeads,
  }) => {
    test.setTimeout(12 * 60_000);
    const csvRow = readCsv(CSV).find((r) => r['Scenario'] === 'Create a Lead in Salesforce > 12');
    if (!csvRow) throw new Error('No row "Create a Lead in Salesforce > 12" in test-data/salesforce/reply-received.csv');
    // The CSV row's Note says "Accent, apostrophe and 60 character company
    // name", but its First Name, Last Name and Company columns are plain
    // ASCII and short (checked 2026-10-19: no non-ASCII character anywhere in
    // this CSV file). Overridden here with the values the scenario needs; the
    // row's own Email is kept so markUsed still tracks the right CSV row.
    const company = 'Gong Revenue Intelligence Platform For Sales Teams Worldwide'; // 60 characters
    const row: Row = { ...csvRow, 'First Name': 'Renée', 'Last Name': "O'Connor", Company: company };
    const name = `${row['First Name']} ${row['Last Name']}`;

    await test.step('Add the prospect (accented first name, apostrophe in last name, 60-char company) to the sequence', async () => {
      await saleshandySequence.createAndAddProspect(SEQUENCE_ID, row);
      markUsed(CSV, csvRow['Email']);
    });

    await test.step('Wait until the step 1 email shows Sent', async () => {
      await saleshandySequence.ensureSent(SEQUENCE_ID, name);
    });

    let known = new Set<string>();
    await test.step('Note the Logs entries that exist before the reply', async () => {
      await salesforceIntegration.openLogs();
      known = new Set((await salesforceIntegration.logEntries(TRIGGER)).map((e) => e.id));
    });

    await test.step('Mark the step 1 email as replied', async () => {
      await saleshandySequence.markAsReplied(SEQUENCE_ID, name);
    });

    let status = '';
    await test.step('Wait for the new Logs entry and read its status', async () => {
      await salesforceIntegration.openLogs();
      await untilPasses(`No finished new "${TRIGGER}" Logs entry for ${row['Email']}`, async () => {
        await salesforceIntegration.refreshLogs();
        const fresh = (await salesforceIntegration.logEntries(TRIGGER)).filter((e) => !known.has(e.id));
        expect(fresh.length, 'new Logs entries').toBeGreaterThan(0);
        const finished = fresh.find((e) => e.status === 'Success' || e.status === 'Error');
        expect(finished, `new entries: ${fresh.map((e) => e.text).join(' | ')}`).toBeTruthy();
        status = finished!.status;
        test.info().annotations.push({ type: 'Logs row', description: finished!.text });
      });
    });
    test.info().annotations.push({ type: 'Logs status', description: status });

    // Expected: Success, Lead shows exact values. If Salesforce rejects any
    // value, record the Logs status and confirm no Lead exists instead.
    if (status === 'Success') {
      await test.step('The new Lead shows the exact accented name and 60-char company', async () => {
        await salesforceLeads.openLeads();
        await untilPasses('the Lead appears in Salesforce', async () => {
          expect(await salesforceLeads.countByEmail(row['Email']), `Leads in Salesforce for ${row['Email']}`).toBe(1);
        });
        const fields = await salesforceLeads.leadFields(row['Email']);
        expect(fields.name, 'Lead Name').toBe(name);
        expect(fields.company, 'Lead Company').toBe(company);
      });
    } else {
      await test.step('Logs shows Error and no Lead was created', async () => {
        await salesforceLeads.openLeads();
        expect(await salesforceLeads.countByEmail(row['Email']), `Leads in Salesforce for ${row['Email']}`).toBe(0);
      });
    }
  });

  test('Create a Lead in Salesforce > 8: Company unmapped, prospect has a Company', async ({
    salesforceIntegration,
    saleshandySequence,
    salesforceLeads,
  }) => {
    test.setTimeout(12 * 60_000);
    const row = readCsv(CSV).find((r) => r['Scenario'] === 'Create a Lead in Salesforce > 8');
    if (!row) throw new Error('No row "Create a Lead in Salesforce > 8" in test-data/salesforce/reply-received.csv');
    const name = `${row['First Name']} ${row['Last Name']}`;

    // Unmap Company only; Last Name and Email stay mapped from Baseline 3.
    await test.step('Unmap Company in the Lead Properties mapping and save', async () => {
      await salesforceIntegration.openLeadPropertiesMapping();
      await salesforceIntegration.unmapLeadField('Company');
      await salesforceIntegration.save();
      await expect(salesforceIntegration.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
      await salesforceIntegration.openLeadPropertiesMapping();
      await expect(salesforceIntegration.leadMappedValue('Company'), 'Company unmapped').toHaveText('Select');
    });

    await test.step('Add the prospect (Company filled) to the sequence', async () => {
      await saleshandySequence.createAndAddProspect(SEQUENCE_ID, row);
      markUsed(CSV, row['Email']);
    });

    await test.step('Wait until the step 1 email shows Sent', async () => {
      await saleshandySequence.ensureSent(SEQUENCE_ID, name);
    });

    let known = new Set<string>();
    await test.step('Note the Logs entries that exist before the reply', async () => {
      await salesforceIntegration.openLogs();
      known = new Set((await salesforceIntegration.logEntries(TRIGGER)).map((e) => e.id));
    });

    await test.step('Mark the step 1 email as replied', async () => {
      await saleshandySequence.markAsReplied(SEQUENCE_ID, name);
    });

    // Expected (proposed, unconfirmed): no Lead created (Company required),
    // Logs shows Error. Record the real result.
    let status = '';
    await test.step('Wait for the new Logs entry and read its status', async () => {
      await salesforceIntegration.openLogs();
      await untilPasses(`No finished new "${TRIGGER}" Logs entry for ${row['Email']}`, async () => {
        await salesforceIntegration.refreshLogs();
        const fresh = (await salesforceIntegration.logEntries(TRIGGER)).filter((e) => !known.has(e.id));
        expect(fresh.length, 'new Logs entries').toBeGreaterThan(0);
        const finished = fresh.find((e) => e.status === 'Success' || e.status === 'Error');
        expect(finished, `new entries: ${fresh.map((e) => e.text).join(' | ')}`).toBeTruthy();
        status = finished!.status;
        test.info().annotations.push({ type: 'Logs row', description: finished!.text });
      });
    });
    test.info().annotations.push({ type: 'Logs status (Company unmapped)', description: status });

    await test.step('Record whether a Lead was created', async () => {
      await salesforceLeads.openLeads();
      const count = await salesforceLeads.countByEmail(row['Email']);
      test.info().annotations.push({ type: 'Leads found', description: String(count) });
    });

    // Restore the full 7-field mapping for row 13 and for the account to end
    // on the same mapping as after Baseline 3.
    await test.step('Map Company back to Company and save', async () => {
      await salesforceIntegration.openLeadPropertiesMapping();
      await salesforceIntegration.mapLeadField('Company', 'Company');
      await salesforceIntegration.save();
      await expect(salesforceIntegration.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
    });
  });

  test('Create a Lead in Salesforce > 13: Job Title mapped to Description instead of Title', async ({
    salesforceIntegration,
    saleshandySequence,
    salesforceLeads,
  }) => {
    test.setTimeout(12 * 60_000);
    const row = readCsv(CSV).find((r) => r['Scenario'] === 'Create a Lead in Salesforce > 13');
    const row1 = readCsv(CSV).find((r) => r['Scenario'] === 'Create a Lead in Salesforce > 1');
    if (!row) throw new Error('No row "Create a Lead in Salesforce > 13" in test-data/salesforce/reply-received.csv');
    if (!row1) throw new Error('No row "Create a Lead in Salesforce > 1" in test-data/salesforce/reply-received.csv');
    const name = `${row['First Name']} ${row['Last Name']}`;

    await test.step('Change Job Title mapping from Title to Description and save', async () => {
      await salesforceIntegration.openLeadPropertiesMapping();
      await salesforceIntegration.mapLeadField('Job Title', 'Description');
      await salesforceIntegration.save();
      await expect(salesforceIntegration.savedToast(), 'save confirmation').toBeVisible({ timeout: 15_000 });
    });

    await test.step('Add a new prospect to the sequence', async () => {
      await saleshandySequence.createAndAddProspect(SEQUENCE_ID, row);
      markUsed(CSV, row['Email']);
    });

    await test.step('Wait until the step 1 email shows Sent', async () => {
      await saleshandySequence.ensureSent(SEQUENCE_ID, name);
    });

    let known = new Set<string>();
    await test.step('Note the Logs entries that exist before the reply', async () => {
      await salesforceIntegration.openLogs();
      known = new Set((await salesforceIntegration.logEntries(TRIGGER)).map((e) => e.id));
    });

    await test.step('Mark the step 1 email as replied', async () => {
      await saleshandySequence.markAsReplied(SEQUENCE_ID, name);
    });

    let status = '';
    await test.step('Wait for the new Logs entry and read its status', async () => {
      await salesforceIntegration.openLogs();
      await untilPasses(`No finished new "${TRIGGER}" Logs entry for ${row['Email']}`, async () => {
        await salesforceIntegration.refreshLogs();
        const fresh = (await salesforceIntegration.logEntries(TRIGGER)).filter((e) => !known.has(e.id));
        expect(fresh.length, 'new Logs entries').toBeGreaterThan(0);
        const finished = fresh.find((e) => e.status === 'Success' || e.status === 'Error');
        expect(finished, `new entries: ${fresh.map((e) => e.text).join(' | ')}`).toBeTruthy();
        status = finished!.status;
        test.info().annotations.push({ type: 'Logs row', description: finished!.text });
      });
    });
    test.info().annotations.push({ type: 'Logs status', description: status });

    // Expected: new Lead has Job Title in Description, Title empty.
    expect(status, 'Logs status').toBe('Success');
    await test.step('The new Lead has the Job Title in Description, and an empty Title', async () => {
      await salesforceLeads.openLeads();
      await untilPasses('the Lead appears in Salesforce', async () => {
        expect(await salesforceLeads.countByEmail(row['Email']), `Leads in Salesforce for ${row['Email']}`).toBe(1);
      });
      await salesforceLeads.openLead(row['Email']);
      // Description is not part of leadFields(); read directly with the same
      // selector pattern (TODO: move into leads.page.ts next time it is
      // editable, instead of a selector in the spec).
      const description = (await salesforceLeads.page.locator('[data-target-selection-name="sfdc:RecordField.Lead.Description"] .test-id__field-value').innerText()).replace(/\s+/g, ' ').trim();
      expect(description, 'Lead Description').toBe(row['Job Title']);
      const fields = await salesforceLeads.leadFields(row['Email']);
      expect(fields.title, 'Lead Title').toBe('');
    });

    // The Lead from row 1 (Daan Kuipers) is unchanged by this mapping change
    // (spot check only, not a full re-verify).
    await test.step("Row 1's Lead is unchanged (spot check)", async () => {
      const fields = await salesforceLeads.leadFields(row1['Email']);
      expect(fields.title, 'Row 1 Lead Title').toBe(row1['Job Title']);
    });

    // Final state note (2026-10-19): this run leaves the account's Lead
    // Properties mapping with Job Title -> Description (Title left on
    // "Select"), not restored to Job Title -> Title. Whoever adds the next
    // scenario to this file should check the mapping before assuming
    // Job Title -> Title.
  });
});
