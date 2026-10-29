# Pipedrive: Reply Received, progress (2026-10-27)

Regression, staging, account gpipedrive. Workflow ticket AL-4172 (To Do, sub-task "Reply is Received in Saleshandy"). Row Ticket cells are None.

## FINAL (2026-10-29): read this first
Bugs AL-4184, AL-4186, AL-4187, AL-4188 are READY FOR QA and the retest passed: 30 of 32 rows pass, 0 fail, 2 skip (Create a Person 4 by design, Create a Lead 3 second reply not possible in the UI). Retest runs: rerun6 (8 of 10 passed), rerun7 (Delete Deal 1 passed). Script fix: `legacyDeals` waits for the legacy deals before the row reads their ids (setup failure in Delete Deal 1).
QA removed Update a Deal 2 (Create a Deal and Update a Deal together) on 2026-10-29: both activities run at the same time, so the pair is not a feasible case. Manual test: Create a Deal made the deal "First Last", the amount stayed, and Update a Deal set the stage from slot 2. Row numbers were not changed, so Update a Deal now has rows 1, 3 and 4. Case file 32 rows. Not committed. Jira not written.

## STATUS (saved 2026-10-28 afternoon): read this first
Run on staging, gpipedrive, sequence 197377 "Pipedrive Reply Received QA" (id goes in `PD_REPLY_SEQUENCE_ID`). Senders: Kartik 54, Rachel 10 (both used up at 50/50 on 2026-10-28) and Pipedrive Rudra (rudra+pipedrive@saleshandy.com, limit 150). Email Sent OFF, Unsubscribed ON (other session).
Result: 21 passed, 10 failed, 2 skipped (Create a Person 4 by design, Create a Lead 3 second reply not possible in the UI). The 10 failures are reproducible on three runs with fresh data = product behavior, five issues, all in `reply-received-product-issues.md` (scenarios, steps, expected, actual, evidence).
QA ruled 2026-10-28: all five are bugs and four tickets are filed (see "Bugs filed, 2026-10-28" at the end). Pending rows: 12 of 33 (10 failed because of the bugs, 2 skipped). Rerun 4 (10 failed rows, fresh data): all 10 failed again.
Next if QA says go: (1) Create a Lead 3 needs a way to send a second reply (row skips now); (2) a developer reads the "Log Activity" step input and output in the Logs run detail (View Details did not open in text); (3) if QA rules a case wrong, fix the case file and the spec, not the data.
Script fixes done today: `organizations.page.ts` scroll and merge (a sibling session wrote it), `people.page.ts` `dealTitles` filter `\p{Sc}`, setup spec senders. Not committed.
Rerun one row: `REFRESH_USED_ONLY=1 KEEP_OTHER_TRIGGERS=1 TEST_DATA_ONLY=pipedrive/reply-received PD_REPLY_SEQUENCE_ID=197377 npx playwright test tests/pipedrive/reply-received.spec.ts --project=chromium --workers=1 -g "Create a Person [12]:"` (ONE space in the pattern). Do not use KEEP_TEST_DATA=1 on a used row.
The sections below are in time order. The "Open / to do" list under "Done" is the 2026-10-27 plan and is out of date.

## Done
- Cases: `test-cases/pipedrive/reply-received.md` (33 rows, QA "looks good" 2026-10-27). Built from `drafts/revised/reply-received.md`; QA chose "trim the revised draft" and "drop rows with no assertion": removed Delete Deal 2 (person has no deal) and Delete Organization 2 (no organization with that name). No row-count match with other workflows needed (QA).
- Spec (hand-written, typecheck clean, 33 tests listed, NOT run): `tests/pipedrive/reply-received.spec.ts`. Reuses `src/flows/saleshandy-to-pipedrive.ts`, the Pipedrive page objects and `sequence.page.ts` `markAsReplied`. Needs `PD_REPLY_SEQUENCE_ID`.
- Sequence setup spec (NOT run): `tests/setup/pipedrive-reply-received-sequence.spec.ts` ("Pipedrive Reply Received QA", 2 steps, sender Kartik 5 = 2kartiktest+5@gmail.com). Run: `SETUP_SEQUENCE=1 REPORT_OPEN=never npx playwright test tests/setup/pipedrive-reply-received-sequence.spec.ts --project=chromium --workers=1`.
- Data (gitignored): `test-data/pipedrive/reply-received.csv`, made with `generateFrom` from the Email Sent CSV, scenario names fixed to the new file (Create a Lead > 5 renamed Update a Deal > 4). Unused spares: Delete Deal > 3, Delete Organization > 2, Delete Person extra none.

## Open / to do
1. Create the sequence (setup spec above), put its id in `PD_REPLY_SEQUENCE_ID`. Kartik 5 showed "disconnected" in the add dialog on 2026-10-26 (Unsubscribed notes); if it still does, ask QA to reconnect it.
2. Make sure Email Sent is OFF on gpipedrive before the run (other session left it ON).
3. Trigger name `Reply is Received in Saleshandy` is from the context file, not yet seen in the UI. Check on the first run. Mark as replied path is from the Salesforce/HubSpot runs.
4. Create a Person 4 (wrong type) is skipped by design, needs a wrong-type Contact Fields mapping (same as Email Sent).
5. Create Organization 4 and Update Organization 1 do not read the Industry / mapped value (no reader in `organizations.page.ts`).
6. Run once to learn script errors, then rerun only failed rows: `KEEP_TEST_DATA=1 KEEP_OTHER_TRIGGERS=1 TEST_DATA_ONLY=pipedrive/reply-received PD_REPLY_SEQUENCE_ID=<id> npx playwright test tests/pipedrive/reply-received.spec.ts --project=chromium --workers=1 -g "<Section> .* <n>:"`. 32 sends, cap 40 a day shared: two halves.

## Run 2026-10-28 (staging, gpipedrive, sequence 197377 "Pipedrive Reply Received QA", senders Kartik 54 and Rachel 10)
Kartik 5 was disconnected, QA added Kartik 54 and Rachel 10; setup spec now uses them. Email Sent was OFF. Full run: 13 passed, 19 failed, 1 skipped (Create a Person 4, by design).
- Organizations (9 rows): script. The list reader stopped at 48 rows. Fixed in `organizations.page.ts` (scroll and merge). Rerun: Create Organization 2 and 4, Update Organization 1 to 3, Delete Organization 1 pass. Create Organization 1 and 3 and Combined actions 2 still fail, cause not read yet.
- Create a Person 1 and 2: NOT a script problem. Reran with fresh data (REFRESH_USED_ONLY=1). Logs: "Reply is Received in Saleshandy" Success (11:30, 11:34). Pipedrive: person created, 0 activities on it minutes later (jamal.alleyne 307, hanna.karpovich 308). The case expects one Email activity (proposed, unconfirmed, taken from Email Sent). Create a Lead rows also show no activity. Product behavior or wrong case: QA to decide, no Jira yet.
- Create a Person 2 (hanna.karpovich): person 308 made first by the row, the event added a second person 310. The row expects "still one person". Seen in Pipedrive, not yet asserted by the row. May be AL-4177.
- Combined actions 1: three persons for one prospect (AL-4177).
- Cause not read yet: Update a Person 1 and 3, Update a Deal 1 and 2, Delete Deal 1, Create a Lead 3 (timeout moving to step 2), Create a Deal 1 (timeout saving the selection). Update a Person 1: takondwa.phiri not in Pipedrive.
- Rerun a row: `REFRESH_USED_ONLY=1 KEEP_OTHER_TRIGGERS=1 TEST_DATA_ONLY=pipedrive/reply-received PD_REPLY_SEQUENCE_ID=197377 npx playwright test tests/pipedrive/reply-received.spec.ts --project=chromium --workers=1 -g "Create a Person [12]:"`. The pattern is `<Section> <n>:` with ONE space (the title has no ` › `). KEEP_TEST_DATA=1 skips the data refresh, so a used row fails on the second run.
- `reports/results.json` is shared and was overwritten by the Unsubscribed run at 11:02.

## Rerun of the 13 failed rows, 2026-10-28 (fresh data, 28 min): 1 passed, 11 failed, 1 skipped
- Passed: Create Organization 1. Skipped: Create a Lead 3 (second reply not possible in the UI, row skips by design of the spec).
- Create a Deal 1: SCRIPT. Pipedrive has the one correct deal (Mphatso Mwale, Pipeline, Qualified). `dealTitles` counted the value "₨ 0" as a title; filter was `[₹$€£]`, now `\p{Sc}` (people.page.ts). Not rerun yet (needs a send).
- Update a Deal 1 and Delete Deal 1: product evidence. Person has two legacy deals; after the reply NEITHER deal changed (Update: 156, 157 still "Legacy deal 1/2", Qualified; Delete: 169, 170 both still there). Logs shows Success. Update a Deal 3 and 4 and Delete Deal 2 pass only because they expect no change or Error. Cause not proven (log node details did not open).
- Create a Person 1/2, Update a Person 1/3, Update a Deal 2, Combined actions 1/2: expected activity (or rename) not seen. Logs Success, "Log Activity" node Success, person page shows Focus empty and Activities (0). Update a Deal 2 renamed nothing.
- Create Organization 3: org WAS created with a free-text Industry (count 3 to 4); the case expects none. Case or product, QA to decide.
- Combined actions 1 and 2: script/environment. Email stayed "Scheduled Tomorrow, 09:00 AM": Kartik 54 and Rachel 10 both at 50/50 daily limit (each also in 3 active sequences). No more sends today with them. Needs QA: raise the limit, add a sender, or wait for the reset.

## Rerun 3 with the third sender (Pipedrive Rudra, rudra+pipedrive@saleshandy.com), 2026-10-28: 2 passed, 10 failed, 1 skipped (28.6 min)
- Passed: Create a Deal 1 (script fix of `dealTitles` confirmed), Create Organization 1. Skipped: Create a Lead 3 (second reply not possible in the UI).
- Combined actions 1 and 2 now ran (the limit problem is gone). Combined 1: three persons again (383, 384, 385). Combined 2: no activity.
- The 10 failures are the same as the two earlier runs: Create a Person 1 and 2, Update a Person 1 and 3, Update a Deal 1 and 2, Delete Deal 1, Create Organization 3 (organization created, 2 to 3), Combined 1 and 2. Same result on three runs with fresh data, so they are reproducible product behavior, not data or script.
- Totals for the workflow: 21 passed, 10 failed, 2 skipped (Create a Person 4 by design, Create a Lead 3). Product evidence: `reply-received-product-issues.md`.

## Rerun 4 and Jira, 2026-10-28 (afternoon)
- Rerun 4 ran the 10 failed rows with fresh data. It took 28 minutes and all 10 failed, the same as runs 1 to 3. Traces are in `test-results-replyreceived-rerun4`. Combined actions 1 showed three persons (398, 399, 400, volha.shauchenka). Create Organization 3 expected 0 organizations and received 1.
- Create Organization 3 test data: row "Create Organization > 3" (Kouadio Tape, PagerDuty). The spec overrides Industry and Company Industry with "Cloud Computing" (not on `organization-industry-list.md`). `createAndAddProspect` fills the form from the overridden row, not from the CSV on disk ("Technology, information and media"). Not checked in the Saleshandy UI.
- Only Email Sent Create Organization 3 has the same scenario. It failed at 13:21 on 2026-10-26 because the request had no `industry` key (the Company Industry pairing was empty). It passed on the 16:00 rerun with no organization created, but the Logs request was not recorded. Pipedrive answered 400 `ERR_SCHEMA_VALIDATION_FAILED` for "Work Management" on Email Sent Combined actions 2 and on Outcome Updated Create Organization 1.
- Not known: the Create organization request of Reply Received Create Organization 3 (QA gave execution `6ae1c7e84173827c1d9a1577`, not opened by me).

## Bugs filed, 2026-10-28 (QA sent from the review page; links AL-4170 and AL-4172, Epic AL-3982)
- AL-4184: Update a Deal and Delete Deal do nothing when the person has two deals. Rows: Update a Deal 1, Delete Deal 1. Update a Deal 2 (new deal not renamed) is not in the ticket text.
- AL-4186: Create a Person and Update a Person show Success but add no activity (QA added the Unsubscribed example). Rows: Create a Person 1 and 2, Update a Person 1 and 3, Combined actions 2. Expected is "an activity is added", Email type not confirmed.
- AL-4187: Create a Lead, Create a Deal and Create a Person make three persons. Row: Combined actions 1.
- AL-4188: Create Organization creates the organization when the Industry is not on the list. Row: Create Organization 3. Evidence is the execution id above.
- Not filed: a second person when the person already exists (Create a Person 2, persons 308 and 310, seen 2026-10-28). That row now fails earlier on the missing activity, so it is covered by AL-4186 for now.

## Jira check of AL-4172, 2026-10-28 (read-only)
- AL-4172 (Sub-task of AL-4170 "[Pipedrive] Triggers and Activities", status To Do, assignee Dharmesh Patel, "Test cases Status" Todo) relates to AL-4184, AL-4186, AL-4187 and AL-4188. All four are Bugs in To Do, and the summaries match the drafts.
- Row coverage: 9 of the 10 failed rows are in a ticket text. Update a Deal 2 is not. The cause can be the same as AL-4184, but that is not proven.
- Strength of evidence: AL-4184 and AL-4187 are strong (the same activities pass on Email Sent for AL-4184). AL-4186 depends on an unconfirmed expected result. AL-4188 is not proven until the Create organization request is read (execution `6ae1c7e84173827c1d9a1577`).
- Nothing was written to Jira in this check. The "Test cases Status" field on AL-4172 is unchanged.

## Pending rows (12 of 33), 2026-10-28
- Failed, waiting on the bug fixes: Create a Person 1 and 2, Update a Person 1 and 3, Update a Deal 1 and 2, Delete Deal 1, Create Organization 3, Combined actions 1 and 2.
- Skipped: Create a Person 4 (by design, needs a wrong-type Contact Fields mapping), Create a Lead 3 (a second reply is not possible in the UI).
- After the fixes, rerun with `REFRESH_USED_ONLY=1 KEEP_OTHER_TRIGGERS=1 TEST_DATA_ONLY=pipedrive/reply-received PD_REPLY_SEQUENCE_ID=197377` and the row pattern. Sender Pipedrive Rudra allows 150 a day.

## Production smoke (2026-10-29)
QA approved note `notes/production-testing/15-pipedrive-reply-received.md` (9 checks, 9 sends) on 2026-10-29. Spec `tests/pipedrive/reply-received-smoke.spec.ts`, setup spec `tests/setup/pipedrive-reply-received-smoke-sequence.spec.ts`, data script `scripts/make-pipedrive-reply-received-smoke-data.ts`, run script `scripts/run-pipedrive-reply-received-smoke.sh`, command `npm run smoke:pipedrive-reply-received`. Typechecked, not run. The workflow is not on production yet (QA): QA runs it after the deploy with `SMOKE_SEQUENCE_ID=new` (creates the sequence and goes on to the checks). Jira summary draft not written yet.
