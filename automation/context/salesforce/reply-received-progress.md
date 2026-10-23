# Salesforce > Reply is Received in Saleshandy > Create a Lead: progress

Account `sfreplyreceived` (dharmesh+salesforce+1@saleshandy.com). Staging only. Updated 2026-10-16.

## Done
- Context: `context/salesforce/reply-received.md`.
- Account, seed (`tests/seeds/sfreplyreceived.seed.spec.ts`), sessions saved (Saleshandy `sfreplyreceived`, Salesforce).
- Plan: `specs/salesforce-reply-received.md` (planner, 3 baseline + 13 Create a Lead).
- Scenarios: `test-cases/salesforce/reply-received.md` (16 rows; Create a Lead 4 to 11 are proposed, unconfirmed).
- Data: `test-data/salesforce/reply-received.csv` (12 rows by scenario, row 9 reuses row 1, 8 spares; Create a Lead 10 shares row 1's email on purpose).

## Seen on the org / staging
- Lead Status values: --None--, Open - Not Contacted, Working - Contacted, Closed - Converted, Closed - Not Converted.
- Lead list columns: Name, Title, Company, Phone, Mobile, Email, Lead Status, Owner Alias.
- Saleshandy Salesforce page tabs: Field Mapping, Triggers & Activity, Prospects Import, Custom Workflow, Logs. Lead mapping starts empty (44 fields, Save disabled). Create a Lead has no extra configuration modal.
- Sender "Salesforce Testing": 40 to 50 s between emails, 150 a day.
- The MCP browser cannot load `auth/salesforce-chromium.json`; plain Playwright with that storage state works.

## QA decisions 2026-10-16
7 core fields mapping; row 7 first (empty mapping), rows 8 and 13 last; row 4 unmapped case only; rows 9, 10 run and record; no Jira key; mark as Replied to trigger; notify with both PushNotification and notify-send; at about 120K tokens notify, stop subagents, ask QA to switch model and /compact.

## Next
Launched sequence for the account (draft with 0 prospects today), then generator per row (sonnet), Create a Lead 7 first.

## Session 2026-10-16 (later): Create a Lead 7 walked, spec written
- Generator (sonnet) set up staging: sequence 196746 ("Salesforce's First Sequence."), step 1 edited (subject "Salesforce reply test"), sender Salesforce Testing, activated; Reply Received > Create a Lead saved ("Configuration Updated Successfully"). Prospect catalina.fuentes@mailinator.com (CSV row Create a Lead 7) added, email Sent 11:02, marked as replied 11:03 (Emails tab > row three dots > "Mark as replied", no confirm dialog).
- Logs (Workflow / Rule | Date | Duration | Status): "Reply is Received in Saleshandy", id 6ad1b712f981b2ee4b7e83c9, 6.1 s, Success.
- **QA answered 2026-10-16: not a bug. With the mapping empty the workflow uses the defaults Salesforce requires, so the Lead is created.** Spec and row 7 updated to expect Success and exactly one Lead. Observation (checked in Salesforce itself), checked in Salesforce itself:** with the Lead mapping EMPTY, a Lead WAS created for catalina.fuentes@mailinator.com: Lead Status "Open - Not Contacted", Owner Alias ChintanS (not the connected user malav@saleshandy.sandbox), Company shown as "HubSpot", Title empty. Proposed result for row 7 was "no Lead". Spec still asserts 0 Leads, so it will fail on that step until QA decides. Not run again (would add another Lead).
- Files: `tests/salesforce/reply-received.spec.ts` (row 7 only), `src/pages/saleshandy/salesforce-integration.page.ts`, `src/pages/salesforce/leads.page.ts` (new), `src/fixtures/index.ts` (shared: salesforcePage, salesforceIntegration, salesforceLeads added). `tsc` clean. Row 7's CSV row is in `test-data/salesforce/reply-received.used.txt`.
- Leads list search works with the placeholder "Search this list..." on the Recently Viewed list (checked with plain Playwright).
- Open: Lead mapping still empty; next rows need the 7 fields saved first (baseline 3).

## State check 2026-10-19 evening (from files, not from the session that ran it)
Seen:
- Spec `tests/salesforce/reply-received.spec.ts` has 13 tests (serial): Baseline 3, Create a Lead 7, 1, 2, 3, 4, 5, 6, 9, 10, 12, 8, 13. Not scripted: Baseline 1 and 2, Create a Lead 11.
- CSV `test-data/salesforce/reply-received.csv` has 13 scenario rows plus 6 spares. `reply-received.used.txt` holds one email, siranush.petrosyan@mailinator.com (row 3's prospect).
- Last run (`reports/results.json`, 2026-10-19 17:22): row 3 passed, row 4 failed, rows 5, 6, 9, 10, 12, 8, 13 skipped (serial after the failure). Baseline 3 and rows 7, 1, 2 are not in that run.
- Row 4 failure: `getByText('Successfully Moved')` not found within 30 s while adding prospect dritan.dervishi@mailinator.com (Create & Add Prospect dialog was open). Evidence: `reports/test-results/salesforce-reply-received--f72cb-orce-4-Lead-Status-unmapped-chromium/` (error-context.md, trace.zip).
- Nothing in this file recorded the spec growing from row 7 only to 13 tests or the 17:22 run.
Not known: whether rows 7, 1, 2 and Baseline 3 passed in an earlier run (no report for them found); whether the row 4 failure is the script or the product.
Next: look at the row 4 trace, fix if script, then run only rows 4 onward with KEEP_TEST_DATA=1.

## 2026-10-20 evening: Create a Lead 4 rerun and the 12 new rows scripted (fork)
- Create a Lead 4 passed on rerun (4.9 min, Luka Kapanadze). The old failure (dritan, "Successfully Moved") could not be read: its trace is gone and the CSV has since been regenerated. Cause not proven. Likely candidates, both fixed since: the blank "Import into" step, and a prospect left in Saleshandy by a failed add. The row now marks the prospect used before adding.
- New spec `tests/salesforce/reply-received-other-activities.spec.ts` (Update a Lead 1 to 4, Create a Contact 1 to 4, Create a Contact + Attach Note 1 to 4, plus Setup and Restore). CSV `test-data/salesforce/reply-received-other-activities.csv`. Run it with TEST_DATA_ONLY=salesforce/reply-received-other-activities (not KEEP_TEST_DATA=1: that mode does not replace used rows, so a rerun reuses people who already have Leads).
- Setup test (all 12 prospects, records and sends in parallel) passed in 9.7 min. The 12 rows were stopped by QA after Update a Lead 1 started (the run was taking too long), so none of the rows has a result yet. The trigger on sfreplyreceived was left on "Update a Lead in Salesforce" only; run the Restore test or set it back to "Create a Lead in Salesforce" only.

## 2026-10-21 morning: all-activities exploration (read-only, nothing saved)
- QA answers: cover all 10 activities; 3 to 4 regression rows per activity, trim the existing 28 rows; time one row before planning speed.
- Trigger on sfreplyreceived already reads "Create a Lead in Salesforce" only (no restore needed).
- Create a Account and Create a Opportunity select: Create a Account has no Extra Configuration. Create a Opportunity opens Extra Configuration: "Closing date (while creating)" in Days (default 0) and "Opportunity Stage (While creating)". The Stage dropdown did not open or list options on two tries. Console showed a 500 from app.refold.ai/api/v2/public/config/field/... (possible cause, unproven). Product issue to review with QA.
- Not yet explored: Update a Account, Update a Contact, Update a Opportunity, Record(log) an Email Activity.
- BLOCKER: after the Opportunity dialog, the Salesforce card on Settings > Integrations changed from "Connected" to "Re-connect". The Salesforce login needs QA's SMS code. Cause unknown.
- 2026-10-21 later: QA reconnected Salesforce (the Saleshandy card had dropped to "Re-connect", cause unknown). After reconnecting, the Opportunity Stage list loads: Prospecting, Qualification, Needs Analysis, Value Proposition, Id. Decision Makers, Perception Analysis, Proposal/Price Quote, Negotiation/Review, Closed Won, Closed Lost. The empty list seen earlier was the dropped connection, not a product bug (the refold.ai 500 was not the cause). Remove it from the issues list.
- Extra Configuration seen: Update a Opportunity has the same two fields as Create ("while updating"). Record(log) an Email Activity has "Select Object": Lead, Opportunity, Contact. Update a Account and Update a Contact have none.
- Plan drafted for QA review: `test-cases/salesforce/reply-received-all-activities.md` (39 rows: 4 baseline, 33 across 10 activities, 2 combined). Account and Opportunity field mapping still not opened. Not scripted. Timing of one row still to do.

## 2026-10-21: all-activities script written (hand-written, QA OK)
- Spec `tests/salesforce/reply-received-all-activities.spec.ts`: 40 tests (Baseline 1 to 3, Setup, 34 scenario rows from the SCENARIOS table, Create a Opportunity 3 as a UI row, Create a Lead 3 last with the Lead mapping emptied and restored). Data `test-data/salesforce/reply-received-all-activities.csv` (35 rows).
- Reuse layers: `src/flows/reply-harness.ts` (Saleshandy half: prospect, send, reply, trigger config, QA's 15 s check, Logs; activity-agnostic), `src/pages/salesforce/salesforce.ts` (one facade over Lead, Contact, Account, Opportunity pages: seed, counts), `ExtraConfig` and `ActivityPick` in `salesforce-integration.page.ts` (Opportunity closing days and stage, Record Email Activity object), fixture `salesforce`. A new row is one SCENARIOS entry; a new object is one page object.
- Proposed rows (confirmed: false) record the result as annotations and flag "Needs QA" instead of failing.
- Pilot run of Update a Lead 1: passed, 5.5 min. Steps: set trigger 56 s, prepare (records, add prospect, Send now) 126 s, wait Sent 32 s, Mark as replied 83 s, 15 s look in Salesforce 27 s.
- Not asserted (no reader on the page yet): Lead Owner Alias (Create a Lead 3), Contact Account Name (Create a Contact 1).
- New page-object code not yet run on the org: Contact form Phone and Department fields, Opportunity and Account setup forms, Lead and Opportunity Activity tabs, Extra Configuration dialog fill.

## 2026-10-22: status check
- Latest run of reply-received-all-activities.spec.ts: reports/reply-all/20261021-165721 (2026-10-21 16:57 to 17:43): 13 passed, 27 failed.
- 17 did not run: "Send cap reached: 93 of 80 emails sent today". Rerun after the cap resets.
- Script/setup: Create a Lead 1 and 3 (Done button not found), Create a Lead 4 and Update a Lead 1 and 2 ("Similar Records Exist").
- Probably script: Record(log) an Email Activity 1 to 4 (Save click blocked by transfer-overlay).
- Unclear: Create a Opportunity 2 (Save disabled), Update a Opportunity 1 (no "was created" toast).
