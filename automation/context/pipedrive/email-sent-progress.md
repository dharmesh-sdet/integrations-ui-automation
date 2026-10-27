# Pipedrive Email Sent: progress (saved 2026-10-24, afternoon)

Spec `automation/tests/pipedrive/email-sent.spec.ts` (33 rows, hand-written, QA's choice). Account `gpipedrive` (dharmesh+gpipedrive@saleshandy.com), sequence "Pipedrive Regression" id 197336 (active, 2 steps). Run logs: `evidence/2026-10-24-email-sent-run.log`. Emails sent today: 26 of the 40 cap (`test-data/send-count.json`).

## Result of the first full run (49 min, stopped by me with an interrupt)

16 passed (this run) plus Create a Person 1 and Create a Lead 2 from earlier runs = 18 rows passed. 6 failed, 1 interrupted, 3 skipped by design, 5 did not run.

| Row | Result | Cause (seen in the log) |
|---|---|---|
| Create a Lead 1, 2, 4, 5 | passed | |
| Create a Lead 3 (step 2 send) | FAILED, script | `moveToStep` step 2: "(Current Sequence)" not found in the Add To Sequence dialog, 8 min timeout |
| Create a Deal 1, 2, 3 | passed | |
| Create a Person 1 | passed | one done Email activity, body in the note |
| Create a Person 2 (step 2 send) | FAILED, script | `moveToStep` step 2: option "Step 2 - Day" never showed in the step list (30 s) |
| Create a Person 3, 4 | skipped | need Contact Fields mapping pairs not set (see below) |
| Update a Deal 1 | FAILED, timing | 4 min test timeout while loading the Saleshandy Triggers & Activity page |
| Update a Deal 2, 3 | passed | |
| Update a Person 1, 2, 3 | passed | |
| Delete Deal 1 | FAILED, script | second legacy deal's tile not found within 15 s after saving (person page not refreshed) |
| Delete Deal 2, 3 | passed | |
| Delete Person 1, 2 | passed | |
| Create Organization 1 | FAILED, not understood | org "Amplitude" not seen in Pipedrive after 90 s; Logs entry not read yet. Could be a product problem or my `idsByName` reader (first page of the Organizations list) |
| Create Organization 2 | FAILED, timing | Emails tab never showed "Sent" within 60 s (4 min test timeout) |
| Create Organization 3 | skipped | needs an Organisation Fields mapping of Industry |
| Update Organization 1 | passed | asserts only that no second org appears (mapped fields not read) |
| Update Organization 2 | interrupted | by my stop |
| Update Organization 3, Delete Organization 1, 2, Combined actions 1, 2 | did not run | |

## Open points and next steps

1. Step-2 rows (Create a Lead 3, Create a Person 2): open the sequence's "Add To Sequence" dialog by hand on gpipedrive, see whether step 2 is offered. The setup spec first failed at step 2 (template dialog), so step 2 may be incomplete. Fix the sequence or `moveToStep` first.
2. Create Organization 1: read the Saleshandy Logs entry for that send (Logs tab) and check the Organizations list by hand. Then decide: reader bug or product bug (ask QA, do not file).
3. Rerun only the failed and unrun rows (`--grep` per row, `REFRESH_USED_ONLY=1 TEST_DATA_ONLY=pipedrive/email-sent`), never the whole file again until the failures are understood. Rows that ended in a timeout are likely flakes: one rerun each.
4. Delete Deal 1: after saving a deal, reload the person page before reading the tile (script fix in `deals.page.ts` `createOnPerson`).
5. Contact Fields mapping on gpipedrive now: First Name, Last Name, Email, Phone Number only. Company to Organization was CLEARED on 2026-10-24 because it made Create person fail with status 400 (`org_id: "<company text>"`). QA still has to say bug or not. Rows 3 and 4 of Create a Person and row 3 of Create Organization need mapping pairs QA picks (Job Title and similar) and the Deal Fields / Organisation Fields cards, which were not opened.
6. Not read yet: Deal Fields and Organisation Fields mapping cards on gpipedrive.
7. Rows with "(proposed, unconfirmed)" expectations record the Logs entry as an annotation; the report.html of the run has them. QA reviews it after the task (do not open it mid-task).

## Things learned about the product and the screens (also in RESUME.md)

- Known B1 and B2 rows (Update a Person / Update a Deal / Delete Deal with no person) ended with no person created; their Logs status was recorded, not asserted.
- Each real row takes 1.5 to 4 minutes (sequence gap, Send now, 15 s wait, UI cleanup). The full file is about 50 minutes.
- Cleanup after a row (afterEach) needs its own time: the hook counts against the test limit.

## State of the Pipedrive account at save time (2026-10-24, about 14:20)

- People: only the 4 baseline persons (1 to 4). Organizations: the 2 baseline ones plus a leftover `BREX` (id 10, from the stopped row Update Organization 2, which creates the upper-case name). Delete it by hand or let the next row's cleanup remove it. The Leads Inbox and the Deals list were not re-checked after the last cleanup was cut short ("Terminated").
- Saleshandy: sequence 197336 active; Email Sent trigger on gpipedrive saved last with the activities of the stopped row (Update Organization); the Contact Fields mapping has no Company to Organization pairing.
- Another session (local-project-87, idle) owns Prospect Outcome Updated and Prospect Unsubscribed on the same account; see RESUME.md "Pending as of 2026-10-24". Check ListAgents before saving trigger config.

## Run of the six unfinished rows, 2026-10-26 (log: `evidence/2026-10-26-email-sent-rest.log`)

4 passed, 2 failed (26.9 min). Update Organization 2, 3 and Delete Organization 1, 2 passed.

- Combined actions 1: FAILED, script/timing. Only error is the 480 s test timeout inside the `afterEach` cleanup; the checks in the body raised no error. Not a product finding.
- Combined actions 2: FAILED. `expectOnePerson` saw two persons (ids 36 and 37) for karina.arce@mailinator.com after 90 s. Not yet known whether the product made two persons (Create Organization + Create a Person in one trigger) or a leftover. Logs entry not read. Bug-or-not: ask QA, do not file.
- Pipedrive may hold leftovers from the two cut-short cleanups (persons 36 and 37, org, lead, deal). Not checked.

## Findings 2026-10-26 (Logs and Configure screen, read-only except the Job Title pairing)

- Organisation Fields on gpipedrive already map Industry and Company Industry to Pipedrive "Industry", plus Company to Name, Website, City, State, Country, LinkedIn and Founded Year (to `add_time`, request showed `"add_time": "2008"`).
- Logs, Oct 26 10:17 (two entries, Combined actions 2): Create organization request `{"name":"Asana","custom_fields":{..."industry":"Work Management"...}}` got status 400, `ERR_SCHEMA_VALIDATION_FAILED`, "Invalid input: industry with provided value does not exist." Pipedrive's Industry on organizations is a picklist; Saleshandy sends the free text. This is the very case Create Organization 3 describes, so it happens on every Create Organization send. Likely cause of Create Organization 1 too (org never appeared), not yet read in its own Logs entry (Oct 24). Bug-or-not: QA to decide.
- Both 10:17 entries show Create person Success then the org call Errored. Two entries for one send, each made a person (ids 36 and 37). Why two runs is not known.
- Contact Fields: Job Title now paired with the custom "Job Title" field and saved (verified after reload). The Pipedrive field list has 27 person fields, no types shown, including read-only/numeric ones (Person created, Open deals, Won deals, Total activities), so a wrong-type pairing for Create a Person 4 can be set by hand; Pipedrive's reaction is unconfirmed.
- Create a Person 3 now written (`Job Title`, First name, Last name compared with the prospect). Run log: `evidence/2026-10-26-create-person-3.log`.

## Create a Person 3 run, 2026-10-26 (log: `evidence/2026-10-26-create-person-3.log`)

FAILED before the Job Title check. `expectOnePerson` saw two persons (38, 39) for awa.diop@mailinator.com after 90 s. Logs show two "Email Sent from Saleshandy" entries for the one send (11:12 and 11:13 AM), both Success, about 40 s each (earlier runs took 2 to 6 s). Same duplicate as Combined actions 2 (persons 36, 37), but with Create a Person only, so it is not tied to the organization step. Create a Person 1 passed on Oct 24 with one person. Not known why the trigger runs twice per send, or whether two concurrent runs both miss "Find a person" and both create. Bug-or-not: QA. The afterEach cleanup timed out again; persons 36 to 39 are probably still in Pipedrive.

## Create a Person 3 rerun, 2026-10-26 11:54 (log: `evidence/2026-10-26-create-person-3-rerun.log`)

PASSED (2.1 min), new prospect liz.ortiz@mailinator.com. Verified in Logs: one execution `6adef219e8899427f23864bc` (3.6 s, Success). Find a person returned no items, Create person sent first_name Liz, last_name Ortiz, phone, email and the custom Job Title field `467cb971bea23c449da5079d25595b1dfad4c647` = "Solutions Architect"; Pipedrive answered success. The duplicate did not repeat.

Earlier duplicate for awa.diop (persons 38, 39): executions `6adee86284fba224c205fdcc` (11:12) and `6adee8641b36e7e6b5c965c7` (11:13). Both ran about 40 s with identical input, both Find a person returned no items, both Create person succeeded, so two runs overlapped and each created one. Combined actions 2 (persons 36, 37): `6adedb4a1b36e7e6b5c22f92` and `6adedb4a5c82ec8cc5b405b6` (10:17, both Error at the Industry step after Create person succeeded). Why two runs start for one send is not known. Happened twice of four sends today, not on the rerun.

## Create Organization 3 and 4 run, 2026-10-26 13:21 (log: `evidence/2026-10-26-create-org-3-4.log`)

Org 3 written (was skipped), Org 4 added (Company Industry "Retail", Lightspeed, elin.sjoberg@mailinator.com; 34 rows now). Org 3 FAILED, Org 4 passed (1.4 min each).

- Org 3: an organization "AWS" existed after the send (expected none). Logs execution `6adf068ba5c6b2da66e70483` (13:21, 2.8 s, Success): Create organization request has no `industry` key (custom_fields: add_time 2006, address fields, linkedin, name, website), response `industry: null`. The same for Org 4 (`6adf06da84fba224c21e2a6d`, Lightspeed). So Industry was not sent at all, and the Industry rejection could not be tested.
- Cause seen on the Field Mapping > Organisation Fields card at 13:4x: Company Industry shows "Select" (no pairing). This morning (10:17) the request carried `"industry":"Work Management"`. Who cleared it is not known (not this session).
- Org 4 "passed" only on "organization exists"; Industry is null, so it did not verify Industry. The Industry read is still a TODO(needs-input).
- Not a product finding yet: Org 3 and 4 need the Company Industry to Industry pairing back, then a rerun.
- Side effect: Email Sent (Create Organization) was ON during other sessions' sends, so Logs show Create org for Klaviyo (6adf0684...), Shopify (6adf06f4...), Intercom (6adf0724...). Those organizations may be strays in Pipedrive; not checked.
- I ran WITHOUT `KEEP_OTHER_TRIGGERS=1`, so `setActivities` turned the other triggers off (Prospect Unsubscribed was ON before). State at 13:4x: only Prospect Outcome Updated ON; Email Sent and Unsubscribed OFF.

## Triage and fixes, 2026-10-26 afternoon (nothing rerun: sends 39 of 40)

- Create Organization 4 rerun (`evidence/2026-10-26-create-org-4-rerun2.log`) FAILED: `REFRESH_USED_ONLY` swapped in a Shopify row with Company Industry "Ecommerce"; Logs request had `"industry":"Ecommerce"`, Pipedrive answered 400 `ERR_SCHEMA_VALIDATION_FAILED` "industry with provided value does not exist". Data cause, not the Organizations reader (the list has 2 rows). Two Email Sent entries (13:53) both Errored, so the duplicate trigger run showed again.
- Sequence 197336 had only Step 1 (Steps tab). That is why Create a Lead 3 and Create a Person 2 failed. Setup spec now adds Step 2 to an existing sequence; run done (`evidence/2026-10-26-add-step-2.log`), Steps tab shows Step 2, Day 3. `addEmailStep` presses Escape when the Email Templates modal stays open (it did on Step 2).
- Create Organization 1, 2, 4 now pass Company Industry "Retail"; row 3 sets "Cloud Computing". The afterEach cleanup gets 8 min extra (was 4). `createOnPerson` already reloads once (another session, same day).
- Side effect: a setup run without KEEP_TEST_DATA regenerated test-data/hubspot/company-created*.csv at 14:10 (gitignored, generated data).
- To rerun, one row each: Create a Lead 3, Create a Person 2, Update a Deal 1, Delete Deal 1, Create Organization 1, 2, 3, 4, Combined actions 1. Combined actions 2 waits for QA (duplicate trigger run).

## QA hand runs, 2026-10-26 afternoon (QA's report and screenshots)

- Create a Person only: one send, one person. No duplicate. Create Organization + Create a Person (Tshering Zangmo, Company Clari): one person, one organization "Clari" (created 2:52 PM by the API user, not linked to any person or deal). No duplicate. The duplicate trigger run seen in the automated sends (persons 36 to 39) did NOT reproduce by hand, so it is not a confirmed product bug; cause unknown.
- Organization "Clari": Industry "Retail" saved. This closes the Industry read of Create Organization 4 (a valid picklist value is saved). Website, LinkedIn, address and other fields are empty because the prospect's company fields were empty (QA), so no mismatch.

## QA decisions and changes, 2026-10-26 evening

- QA: no data cleanup in Pipedrive specs. `afterEach` removed from `email-sent.spec.ts`; Outcome Updated (d1) and Unsubscribed (e4) removed theirs. e4 kept `wipe()` in `sendAndClear` and asked QA whether it stays (open).
- Create/Update/Delete Organization rows and Combined actions 2 count organizations relative to what existed before the row (no "company name is free" precondition).
- People and Organizations readers fail with an explicit error when the list total is higher than the rows loaded, instead of missing a record. The People list has no search of its own (only global search, which can lag, and a Filter); not built on unverified controls. Not run, tsc clean.
- People list at 14:3x (read-only, "11 people"): 2 samples, Dharmesh, Dharmesh Patel, Karina Arce x2 (persons 36, 37), Awa Diop, Tomas Brandl, Hassan Latheef, Carine Essomba, Tshering Zangmo. Deals seen by d1: 7 (2 samples, "Saleshandy", "dharmesh@saleshandy.com", shanelle.ramnarine, dulce.alvarado x2).
- Global setup wiped every test-data CSV and `.used.txt` twice today (d1 at 14:06, me at 14:10). Run with TEST_DATA_ONLY or KEEP_TEST_DATA=1.

## Reruns, 2026-10-26 16:00 to 16:30 (logs: evidence/2026-10-26-rerun*, summaries rerun-failed, rerun2, rerun3)

- Passed on rerun: Create a Person 2, Update a Deal 1, Create Organization 3 (rerun 1); Create a Lead 3, Delete Deal 1, Combined actions 1 (rerun 2); Create Organization 2 (rerun 3). Now 30 passed, 3 failed (Create Organization 1, 4, Combined actions 2), 1 skipped (Create a Person 4).
- Create Organization 1 and 4 failed (rerun 2) because the request carried the person's Industry ("Design Software", "Data Software"); Industry and Company Industry both map to Pipedrive Industry and the person's value won. The spec now overrides both columns. Create Organization 2 had no prospect: the name pool was used up (10,233 of about 11,400). Ten countries added to `src/data/countries.ts` (12,400 combinations).
- Rerun 3, Create Organization 1 (Shopify, 4:23 PM) and 4 (Shopify, 4:26 PM): each failed with TWO organizations after one send. Logs show two "Email Sent from Saleshandy" executions 1 s apart, both Success, both Create org name "Shopify": 6adf313aaf32a4679829a239 + 6adf3139bf42aa52fa34d277 (4:23) and 6adf31f9757bd52d6596c9ca + 6adf31f8b40fe7dbeff6a61e (4:26). Create Organization 2 (Productboard, 4:26) ran once. This is the duplicate trigger run again (QA hand runs showed none; Prospect Unsubscribed session saw it too). No cleanup and no other session sent for these two, as far as seen. Bug-or-not: QA.
- Sends today: 57.

## Session saved 2026-10-26 18:15 (Claude session f65d3290-1ee8-47c1-b746-62b5b8fede39, resume with `claude --resume f65d3290-1ee8-47c1-b746-62b5b8fede39`)

State of the 34 rows (latest result each): 30 passed, 3 failed (Create Organization 1, 4, Combined actions 2), 1 skipped (Create a Person 4: needs a wrong-type Contact Fields pairing, row not written). No whole-file run since the fixes. Nothing is running. Sends today: 61 (default cap 80 in `src/data/send-cap.ts`).

Open:
1. Create Organization 1 and 4 failed on the duplicate trigger run (two "Shopify" organizations per send). Waiting on QA's bug-or-not for the Email Sent side. Evidence is on AL-4177 (comment 79472, Rudra tagged by QA's ask). Combined actions 2: one rerun worth trying; QA hand run passed.
2. Create a Person 4: set the wrong-type pairing on gpipedrive Configure (QA picks the field), write the row.
3. Create Organization 4 still asserts only "organization exists"; Industry "Retail" was seen saved on QA's hand run (Clari). Add a reader if QA wants it asserted.
4. Peers: Prospect Unsubscribed (e4) asked QA whether `wipe()` in `sendAndClear` stays; unanswered. All five sessions told: no cleanup, run with TEST_DATA_ONLY or KEEP_TEST_DATA=1 (not yet told about the data wipes, QA to say).
5. Not checked: Email Sent trigger state on gpipedrive (other sessions' runs may have turned it off), Pipedrive leftovers (People shows 11, Deals 7). QA: do not clean up, do not check deals.
6. Next-run command per row: `SEND_CAP=100 KEEP_OTHER_TRIGGERS=1 REFRESH_USED_ONLY=1 TEST_DATA_ONLY=pipedrive/email-sent npx playwright test tests/pipedrive/email-sent.spec.ts --project=chromium --workers=1 --grep "<Row title N:>"`, in the background, one row at a time.

Changes this session: removed the afterEach cleanup; relative organization counts; People and Organizations list-length guards (untested); `PICKLIST_INDUSTRY` sets Industry and Company Industry; Step 2 added to sequence 197336 and `addEmailStep` Escape fallback; 10 countries in `src/data/countries.ts`; Rudra Chauhan row in `jira/docs/jira-reference.md` (tag only when QA says).

## Resume 2026-10-27 (Combined actions 2 reruns)

Combined actions 2 failed 4 times, no email sent (send count still 61, file date 2026-10-26).
- Runs 1 and 2: Saleshandy 400 on create, "Prospect with this email already exists in your Saleshandy account" (tshering.zangmo@mailinator.com, in the ledger, not in email-sent.used.txt, so the refresh kept it). Added it to `test-data/pipedrive/email-sent.used.txt`; later runs got fresh rows.
- Runs 3 and 4: prospect created, then the sequence page stayed on its loading skeleton for the whole 120 s `sendNow` wait ("Page load problem (the page is blank); reload 1 of 3"). Emails tab row never appeared. Looks like staging slowness, not the spec. Not retried further; QA to say when to try again.
- Open points 1, 2, 4 from the 2026-10-26 18:15 section still wait on QA.

Update 2026-10-27 10:05, Combined actions 2 (runs 5 to 7):
- Run 5 and 6 failed on the Emails tab: the list loads 25 rows a page (87 rows now), so the new Step 1 row was not on page 1. Added `searchIfOffFirstPage` in `src/pages/saleshandy/sequence.page.ts` (search the email, press Enter); used before Send now and in the Sent check. Not yet proven on a row that needs it.
- Run 7 got past the send step. The trace has no `emails/send` POST and the send count file did not change, so the row was most likely already Sent by the sequence schedule. Pipedrive person 151 was created, but after 90 s there was no activity (expected 1, received 0) and the organization list stayed at 15. Same result as the 2026-10-26 failure. Cause not confirmed: product bug or slow trigger. QA hand run passed earlier.

Update 2026-10-27, Combined actions 2 PASSED (run 10, 54 s). The earlier failures were script and data, not the product:
- Row Industry was "Project Management Software", not on QA's list (`organization-industry-list.md`); the row now uses `PICKLIST_INDUSTRY` (Retail).
- The People reader stopped at 49 of 58 because the list is virtual; `rows()` in `src/pages/pipedrive/people.page.ts` now scrolls and merges by person id.
- `sendNow` and the Sent check search the Emails tab by email when the row is off page 1 (`searchIfOffFirstPage`, `sequence.page.ts`).
- Create Organization 1 and 4 not rerun yet. The two-Shopify duplicate is unexplained; QA's hand runs made one Clari and one Asana. The People reader change may also have caused earlier "not found" failures on those rows.

Update 2026-10-27: Create Organization 1 (47 s) and Create Organization 4 (1.1 m) PASSED with Industry "Retail" from `organization-industry-list.md`, a fresh row each, and the new People reader. The earlier failures were the People reader and test data, so the two-Shopify duplicate did not repeat. Email Sent status: 33 passed, 1 skipped (Create a Person 4). No whole-file run yet.

## Production smoke, written 2026-10-27 (QA OK on the cases, not run)

Checklist `notes/production-testing/09-pipedrive-email-sent.md` (8 rows; QA merged Create a Lead, Create a Deal and Create a Person into one row). README row 09 added. Same Pipedrive company as staging, account `emailopenedprod`, SEND_CAP default 20 (QA).
Files: `tests/pipedrive/email-sent-smoke.spec.ts`, gate `tests/setup/pipedrive-email-sent-prod-gate.spec.ts` (read-only, pairs in `src/config/pipedrive-field-mapping.ts`, read on staging 2026-10-27; run on staging with `GATE_ACCOUNT=gpipedrive`, 5 of 5 passed), sequence setup `tests/setup/pipedrive-email-sent-smoke-sequence.spec.ts`, data `scripts/make-pipedrive-email-sent-smoke-data.ts`, runner `scripts/run-pipedrive-email-sent-smoke.sh`, `npm run smoke:pipedrive-email-sent`. Typecheck clean. The smoke spec has not run.
Before QA runs it: `npm run login:saleshandy -- emailopenedprod` (headed) and `npm run login:pipedrive -- emailopenedprod` (no Pipedrive session exists for this account yet). Sender accounts in the setup spec are the two read on 2026-10-22, not read again.

## Production smoke, run 1, 2026-10-27 (log: `evidence/2026-10-27-prod-smoke-run1.log`)

Stopped at the gate, no row ran, no email sent (send count stays 5). Pipedrive is connected. Contact Fields on the production account is not mapped: First Name, Last Name, Email, Phone Number and Job Title all show "Select" (screenshot in `test-results-pipedrive-email-sent-smoke-gate/`). Deal Fields and Organisation Fields were not read (the gate stops at the first failed card). The gate only reads, so it changed nothing. Waiting on QA: map the pairs by hand (`src/config/pipedrive-field-mapping.ts`), or say that I map them.

## Production smoke, runs 2 and 3, 2026-10-27 (logs: `evidence/2026-10-27-prod-smoke-run2.log`, `evidence/2026-10-27-prod-smoke-row1-rerun.log`)

The gate now maps missing pairs (it only read in run 1, my mistake). Gate passed, sequence 983594 created. Checks 2 to 8 passed. Check 1 (Create a Lead, Create a Deal and Create a Person together) failed twice with a new prospect each time (Albano Baptista, then Limbani Gondwe): person, lead and deal exist, `activityCount` is 0 after 90 s and still 0 minutes later (read again by a throwaway spec). Logs entry of the rerun: 6ae06833afea6d3cf46d94c4, 2:30 PM, 1m 21s, Success. The same row passed on staging (Combined actions 1, 2026-10-26). Rerun prospect Limbani Gondwe has two persons (ids 206, 207), the duplicate trigger run seen before (AL-4177). Bug-or-not: QA. Not filed, nothing sent to Jira.
