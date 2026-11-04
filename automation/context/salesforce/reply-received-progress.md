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

## Restart 2026-11-04 (nothing run, nothing scripted)
- QA: Email Sent and Prospect Outcome Updated are QA-passed and live on production. Reply Received (AL-4133, parent AL-4131) is the Salesforce workflow to continue. Last run was 2026-10-21: 13 passed, 27 failed (script/setup failures, 17 not run because of the send cap). No QA sign-off.
- Decision: restart through the `workflow-testing` skill (Salesforce, regression, hand-written spec), starting with the test cases. Old files `test-cases/salesforce/reply-received-all-activities.md` (39 rows) and `tests/salesforce/reply-received-all-activities.spec.ts` (40 tests) are the reference, not the base: the skill rebuilds cases from scratch.
- Developer work to use from the start: `knowledge-base/product/workflow-behaviour-dev-kit.md`, `integration-skills/test-logs/salesforce/reply-received-in-saleshandy.md` (Refold v3, 12 of 12 API tests), run-now API (`src/flows/refold-run-now.ts`, `scripts/run-now.ts`), automatic reconnect (`src/flows/salesforce-connection.ts`), no-SMS login (`src/utils/salesforce-login.ts`, commit f82f22f).
- Skill edited 2026-11-04 (QA OK): `.claude/skills/workflow-testing/SKILL.md` step 0 now reads the dev kit and the developer test log. Step 1 takes Expected results and known tickets from them and keeps uncovered rows "(proposed, unconfirmed)". No script changed.
- Known script failures from 2026-10-21 still to fix: Create a Lead 1, 3 (Done button not found), Create a Lead 4, Update a Lead 1, 2 ("Similar Records Exist"), Record(log) an Email Activity 1 to 4 (Save click blocked by transfer-overlay). Unclear: Create a Opportunity 2 (Save disabled), Update a Opportunity 1 (no "was created" toast).
- Next: read dev kit and test log, one round of open questions with defaults, draft new cases, QA "looks good", then script. Rerun only failed or unrun rows with KEEP_TEST_DATA=1.
- Sheet "Integration wfs": Salesforce Reply Received row is still "In QA", date 5 Nov 2026, last note 21 Oct blocker. Sheet update belongs to another session, not this one.

## 2026-11-04 later: cases draft (not saved, waiting for QA "looks good")
- Read dev kit, developer log (`integration-skills/test-logs/salesforce/reply-received-in-saleshandy.md`, v3 sign-off, v4 to v6 not live-tested), old cases. No other session owns this workflow (ListAgents).
- QA skipped the question round. Defaults used: 38 rows, dev kit match rules (Account by full name, Opportunity by email as Name, newest), accepted cases as rows with dev kit Expected, staging looked at read-only.
- Seen on staging (sfreplyreceived, Connected): Account mapping saved: Website, City, State, Country, Company to Account Name, Company Website, Industry, Size, Revenue, Founded Year, Company Phone, HQ Location. Opportunity mapping saved: Prospect Overview to Description, Deal Value to Amount, Closing Date to Close Date.
- Open for QA: Closing Date is mapped to Close Date on Opportunity. Dev kit says Closing Date mapping gives a format error. Draft unmaps it for the Opportunity rows.
- Live Refold version on staging not known. Rows that depend on v5/v6 (unmapped field untouched) are marked.

## 2026-11-04 later: cases approved and saved (QA "looks good")
- Saved `test-cases/salesforce/reply-received.md`: 37 rows (4 baseline, 32 activity, 1 combined). Combined 1 (Create a Lead and Create a Contact together) dropped, QA took the recommendation. Realistic names added to every row.
- QA: Mark as replied works on the Emails tab and the Prospects tab on staging (AL-4217 fixed). Use the Emails tab way. A second reply is "Mark as replied" again on the same step 1 email (no step 2 row after a reply).
- Parallel: possible with `npm run parallel`, own account `sfreplyreceived`. Raise SEND_CAP to about 80 (37 sends). No other Salesforce regression is ready as a partner.
- Next: write the new spec from the SCENARIOS table in `tests/salesforce/reply-received-all-activities.spec.ts` (harness `src/flows/reply-harness.ts`). Old lookups use Company for Account and full name for Opportunity. The dev kit says Account by full name and Opportunity by email. Fix in the new spec.

## 2026-11-04: spec plan (not written yet)
- Build: new `tests/salesforce/reply-received.spec.ts` (replaces the old Create-a-Lead spec, git keeps it) with the SCENARIOS pattern of `reply-received-all-activities.spec.ts` and `src/flows/reply-harness.ts`. Ids = the 37 rows of `test-cases/salesforce/reply-received.md`.
- Data: new `test-data/salesforce/reply-received.csv` with the named prospects of the cases, a small generator script, unique mailinator emails. Needs a Scenario column = row id.
- Seed values: `LEGACY` in `src/pages/salesforce/salesforce.ts` has "Pilot Legacy Co" and "Legacy Title QA" (QA 2026-10-28: no "Legacy" names). Add realistic prior values through `Setup` and keep `LEGACY` for other specs.
- Match rules per dev kit: Account seeded and looked up by the prospect's full name (Update a Account 1, Create a Account 2 uses Company), Opportunity named with the prospect's email, two Opportunities for Update a Opportunity 1 and Record(log) 3 (stale first, newest second). Needs a helper to read stage per Opportunity in `opportunities.page.ts`.
- Record(log) 1: Mark as replied has no reply text, so the case text "Description holds the reply text" cannot be asserted. Assert the Task shows (subject on the timeline) and record the Description. Tell QA.
- Create a Opportunity 2: second "Mark as replied" on the same step 1 email, needs a `replyAgain` path in the harness (markAsReplied is a no-op if the cell shows Replied; HubSpot clicked the menu again).
- Run: SEND_CAP about 80, KEEP_TEST_DATA=1, once to learn errors, then failed rows only. Unmap Closing Date on the Opportunity mapping before the Opportunity rows, restore after.
- Data strategy (advisor): the org is never cleaned, so names the product matches on (Account by full name or Company) must differ per run and stay realistic (pool of names, not a RUN tag on a company). Emails unique per run. Saleshandy rejects an email seen before (code 1001), so a failed-row rerun needs a fresh row. Copy the Zoho pattern (`scripts/make-zoho-reply-received-data.ts --force`), check `TEST_DATA_ONLY` and how global setup treats `salesforce/reply-received.csv`.
- Record(log) 1: show QA the one-line Expected change (no reply text with Mark as replied) and get the OK before editing the approved cases file.
- Second reply (Create a Opportunity 2): `markAsReplied` returns early when the Replied cell is set. Add a forced variant that clicks the menu again and proves success with a new Logs entry after the click time.
- Before the first run: read the 2026-10-21 failure causes (Done button not found, Similar Records Exist, transfer-overlay on Record(log) Save). Grep every user of `LEGACY`. Run ListAgents again: another session works on Salesforce Email Opened (untracked `email-opened-progress.md`), shares the org, the reconnect limit and the send-cap log.
- Context reached the 120K rule 2026-11-04: QA asked to switch model and /compact before the spec is written.

## 2026-11-04: spec written, not run yet
- QA OK: Record(log) 1 Expected changed (Description can be empty). Cases file updated.
- Written: `tests/salesforce/reply-received.spec.ts` (40 tests: 37 rows, Setup, unmap and restore of Closing Date). Typechecks, `--list` shows all 40. Not run.
- Data: `scripts/make-salesforce-reply-received-data.ts` builds `test-data/salesforce/reply-received.csv` (32 named prospects, new email each run). Rerun of failed rows: `node scripts/make-salesforce-reply-received-data.ts --rows "<id>,<id>"` (new email; Account-by-name rows also get an alternate name). `npm run data:sf-reply-received`.
- Run: `npm run test:sf-reply-received` (sets KEEP_TEST_DATA=1, TEST_DATA_ONLY, SEND_CAP default 80). For one row add `-- -g "<id>"`. In `npm run parallel` set KEEP_TEST_DATA=1 yourself (the arg `reply-received` also matches the hubspot, zoho and pipedrive CSVs, which a refresh would replace).
- Code changes: `Setup` in `salesforce.ts` (prior values, `opportunities` list named with the email, `account.name`), `inDaysOrg` and `dayIs` (org shows DD/MM/YYYY), `ContactInput.title`, `SalesforceOpportunitiesPage.all()`, harness fields `reuses`, `again`, `before`, `World.lastLog`, `markAsRepliedAgain` in `sequence.page.ts`.
- Mailbox: shared with the Email Opened session (`local-project-ec`, 31 rows). Sender dharmesh+replyreceived@saleshandy.com, limit 150 a day. Start only after their full run ends and 40 or more sends are left.
- Before the first run: unknown whether Update a Opportunity finds the Opportunity by the Name or by the Contact Role; Company-to-Account-Name mapping on sfreplyreceived is mapped (progress line 85), so Create a Account 1 records which name is used.

## 2026-11-04 18:25: first runs done, 36 of 37 passed at least once
- Spec `tests/salesforce/reply-received.spec.ts` (40 tests: 37 rows, Setup, Closing Date unmap and restore). No single full run: parallel run with Email Opened (16:18), then reruns of failed or unrun rows only (`npm run test:sf-reply-received -- -g "<ids>"`). QA runs the full script.
- Passed at least once: 36 of 37. Product failure candidate: 1 (Create a Lead 3).
- Create a Lead 3 (confirmed row, QA 2026-10-16): with the Lead Properties mapping empty (the test now reads "Select" on all 7 fields after a reload, before the reply), the Lead gets Company "Northgate Freight" (the prospect's Company), not "HubSpot". Seen twice (the second time with the empty mapping proven). No Jira item drafted yet, QA decides.
- Update a Account 1: the Account seeded with the prospect's full name is found; the test accepts the full name or the Company as the name after the update, because Company is mapped to Account Name on this account (QA 2026-10-22). The run records which name it found (`Account name after the reply`).
- Create a Contact 3: Logs Error, errorCode DUPLICATES_DETECTED, no Contact, Lead unchanged (as expected). Read from the Logs entry detail (`SalesforceIntegrationPage.errorDetail`), the list row shows only the status.
- Create a Opportunity 2 (second Mark as replied on the same email): a second Opportunity appeared (2 in total), as the cases expect.
- Salesforce "Re-connect" drop seen once during Create a Lead 1 on the Logs tab (Saleshandy sent the page to the integrations list). It recovered by itself. Not a row failure.
- Script fixes made this session: `markAsReplied` and `markAsRepliedAgain` search the Emails tab when the row is off page 1; harness state saved in `test-data/salesforce/reply-received.state.json` (a worker restart loses memory); `fillExtraConfiguration` closes the Select Object overlay before Save; Create a Opportunity 3 starts from Create a Lead only; new data per rerun with `node scripts/make-salesforce-reply-received-data.ts --rows "<id>,<id>"` (also gives rows that seed a Lead or Account by name an alternate name, because Salesforce says "Similar Records Exist" for the same name).
- Incident: a Link Clicked setup spec run without KEEP_TEST_DATA=1 refreshed every CSV at 17:38. Data was rebuilt with `--force`. Always run with KEEP_TEST_DATA=1.
- State left on the account: Lead mapping (7 fields) and Opportunity mapping (Closing Date to Close Date) restored and read back at 18:23. Trigger holds the last row's activities.
- Not done: the first-run send count (about 45 sends today), a full single run, Jira drafts, sheet note.

## 2026-11-04 18:50: correction, Create a Lead 3 is not a product failure
- QA: with an empty Lead mapping the Lead gets the prospect's own Company (Northgate Freight). The "HubSpot" in the old Expected came from the 2026-10-16 observation (Catalina Fuentes), most likely that prospect's own Company (HubSpot is in the data generator's company pool). It was wrongly written as a Salesforce default. Cases row and spec now expect the prospect's Company. The "possible product failure" lines above are withdrawn; Reply Received has no product failure open. Rerun of the row started 18:50 (new email).

## 2026-11-04 18:55: STAGING APPROVED (QA)
- QA approved Salesforce Reply Received (AL-4133) on staging, together with Email Opened (AL-4135). All 37 rows passed at least once over several partial runs, no product failure open. QA runs the full script for the final proof.
- Resume: smoke on production is not started. Next workflow is QA's pick. Run command: `npm run test:sf-reply-received` (KEEP_TEST_DATA=1 already set). Data for a rerun: `node scripts/make-salesforce-reply-received-data.ts --rows "<id>,<id>"`. Parallel with Email Opened: `KEEP_TEST_DATA=1 SEND_CAP=80 npm run parallel -- salesforce/reply-received salesforce/email-opened --yes`.
- Account `sfreplyreceived` (dharmesh+salesforce+1@saleshandy.com), sequence 196746, sender dharmesh+salesforce@saleshandy.com. Salesforce login: API login works from the trusted IP 110.226.126.183 (office exit node); saved sessions refresh by themselves.
- Not committed. Commit only when QA asks, no Co-Authored-By line.

## 2026-11-04: production smoke built (workflow-testing, smoke mode)
- QA approved the 10 cases (`notes/production-testing/22-salesforce-reply-received.md`, README row 22). Baseline, no fixed bug ticket. QA: the workflow is not published on production yet, so QA runs the script after the publish. AL-4217 (Jira, 2026-11-04) is a staging-only bug, production already shows the Actions menu, so it is not in the smoke.
- Written, not run: `tests/salesforce/reply-received-smoke.spec.ts` (Prepare data + 10 checks + unmap/remap of Closing Date around the Opportunity checks), `tests/setup/salesforce-reply-received-smoke-sequence.spec.ts`, `scripts/run-salesforce-reply-received-smoke.sh`, `scripts/make-salesforce-reply-received-smoke-data.ts` (3 people per row, rotated per run). Command: `npm run smoke:salesforce-reply-received`. Gate is the shared `salesforce-email-sent-prod-gate.spec.ts`.
- Typecheck clean outside `jira/web` (old errors there). `--list` shows 14 tests per browser project.
- Open: Record(log) check looks for the step 1 subject on the Contact timeline (`SMOKE_STEP1_SUBJECT`, default "Salesforce Reply Received Smoke"). Not verified on production. Not committed.
- QA 2026-11-04: production smoke runs in parallel with the other smokes on `emailopenedprod`. The runner sets `KEEP_OTHER_TRIGGERS=1`. Run each smoke runner in its own terminal. Another run's trigger that is on also fires on these sends.

## Resume here (2026-11-04, production smoke saved)
- State: smoke cases approved (`notes/production-testing/22-salesforce-reply-received.md`, README row 22). Spec, setup spec, runner, data builder written and listed, not run, not committed. Command: `npm run smoke:salesforce-reply-received`.
- Blocker: the workflow is not published on production yet (QA). QA runs the script after the publish. I do not run it on production unless QA asks.
- Pairing (QA 2026-11-04): this smoke runs in parallel with the Salesforce Sequence Email is Opened smoke on `emailopenedprod`. Both runners set `KEEP_OTHER_TRIGGERS=1`. Shared mailbox: default `SEND_CAP` 40 each, listed senders, read the Email Accounts page before sizing.
- Next step: QA says "pair this with Email Opened". Then draft the Email Opened production smoke cases (`notes/production-testing/23-salesforce-email-opened.md`, 10 checks, from `test-cases/salesforce/email-opened.md`, 31 staging rows approved 2026-11-04), wait for "looks good", then spec and runner like Reply Received. Production open timing: first open 60 s after the send, second open 120 s after the first. Check `ListAgents` first: another session worked on Email Opened (`email-opened-progress.md`).
- Open doubt: the Record(log) check reads the step 1 subject from the Contact timeline (`SMOKE_STEP1_SUBJECT`), not seen on production.
