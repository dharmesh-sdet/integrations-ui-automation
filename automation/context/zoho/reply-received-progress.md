# Zoho Reply Received: progress

Date: 2026-10-29. Account `notemailsentzoho` (staging). Platform rule: hand-written spec (QA 2026-10-29).

## QA answers (2026-10-29)

- Reply method: Mark as Replied for all rows. One real reply from QA's Gmail is the last row.
- Scope: all 5 actions plus combined rows (34 rows).
- Separate Saleshandy accounts for Email Sent and the other Zoho workflows, so no clash. Own files for this workflow.

## State

- Stage 1 (context) done: `reply-received.md`, `00-overview.md`, `field-mapping.md`.
- Stage 2 (test cases) DONE 2026-10-29: 34 rows approved ("looks good") and saved to `test-cases/zoho/reply-received.md`. Still unconfirmed rows: Contact 2, 4, 6, 7. The Gmail address for the Real reply row is not given yet.
- Stage 3 (spec): next. Hand-written, `tests/zoho/reply-received.spec.ts`.

## Rows QA verifies by hand (results go here)

| Item | What to record | Result |
|---|---|---|
| Mark as replied exists on this account | Present or not, exact wording | |
| Trigger 1 | Exact save message | |
| Contact 5 (no last name) | Contact created or rejected, and the Last Name value | |
| Lead 4 (no company) | Lead created or rejected, and the Company value | |
| Account 1 (company, no contact) | Account name equals the company | |
| Account 4 (same-name account exists) | Updated or second account | |
| Task 5 (Due In empty) | Task created or run fails, and the Due Date value | |
| Note title in Zoho | Exact title and lines | |
| Gmail address for the real reply row | Address | |

## Next

QA reports the results. Claude updates the draft, shows it, waits for "looks good", saves, then writes the spec.

## Manual verification results (2026-10-29, Claude, headless, no window)

Method: throwaway spec `tests/setup/zoho-reply-explore.spec.ts` (account `notemailsentzoho`, sequence "Zoho Reply Received QA" id 197387, sender Rachel 10, Reply trigger set per check). Zoho read on a virtual display with the profile `auth/mcp-zoho-not-email-sent-profile`. Logs were not read. Run with `KEEP_TEST_DATA=1`, otherwise global setup refreshes the CSVs of workflows that nobody runs.

| Item | Result |
|---|---|
| Mark as replied exists | Yes. The Emails tab three-dot menu has it and it worked on this account |
| Trigger 1 save message | "Configuration Updated Successfully" |
| Contact 5 (no last name), 08:39 UTC | No contact for `dharmesh+zoho-v1@saleshandy.com` in all Zoho contacts after 15 minutes. Cause not read (Logs not used) |
| Lead 4 (no company), 08:41 UTC | Lead "Devan Anand" created, Company empty, 1 note |
| Account 1 (company, no contact), 08:41 UTC | Account "Tanaka Robotics Works" created, named after the company, 1 note. Industry, Employees, Phone empty because the prospect has none |
| Account 4 (same-name account), 08:52 UTC | Still 1 account "Vega Marine Works" (created by hand first). It was updated and got 1 note. No duplicate |
| Task 5 (Due In empty), 08:42 UTC | Task "Follow up after reply" created, Not Started, Normal, linked to contact Liam Ortega, Due Date empty. Contact created with 1 note |
| Note title | "Saleshandy Reply Received On Sequence Email". Lines: Sequence Name, Sequence (link), Step, Sender Email, Prospect Email, Prospect Name, User |
| Gmail address | Not asked yet |

Test data left behind: Zoho lead Devan Anand, account Tanaka Robotics Works, account Vega Marine Works, contact Liam Ortega with its task. Saleshandy prospects `dharmesh+zoho-v1` to `-v5`. The Reply trigger on `notemailsentzoho` is still ON with the Task action.

## Stage 3: spec (2026-10-29)

Files, all new: `tests/zoho/reply-received.spec.ts`, `src/flows/saleshandy-to-zoho.ts`, `src/pages/zoho/zoho-crm.page.ts`, `test-data/zoho/reply-received.csv` (33 prospects, new names, the name pool was enough). The Email Sent session reuses the page object and flow and sends changes instead of editing them.
Written: Contact 1 and 5, Lead 1, 4 and 5, Account 1. Not written yet: rows that need a Zoho record first (Contact 2, 3, 4, 6, Lead 2, 3, Account 2, 3, 4, Deal 2 to 5, Task 2, Combined 4), Contact 7 (clears a mapping, restore it in a finally), Trigger 2, Deal 1 and 6 (deal name not seen), Task 1, 3, 4, 5, Combined 1 to 3, Real reply (needs `ZOHO_REPLY_GMAIL`).
Run: `npm run test:zoho-reply-received -- -g "Lead: 1"`. Zoho is read in a headed browser on a virtual display (`xvfb-run`) with the profile `auth/mcp-zoho-not-email-sent-profile`. Close any MCP Zoho window first. Use `KEEP_TEST_DATA=1` to rerun single rows without replacing their prospects.
Every run must set `TEST_DATA_ONLY=zoho/reply-received`, because the spec name matches the `reply-received` CSVs of HubSpot, Pipedrive and Salesforce.

First spec run (Lead 1, 2026-10-29 ~15:40): the Saleshandy steps passed (trigger, prospect, Send now, Mark as replied). The Zoho read failed because the profile `auth/mcp-zoho-not-email-sent-profile` showed "Verify your identity" (password or OTP). The same profile read Zoho fine about 1 hour earlier. QA must sign in once in that profile (open it through the `playwright-zoho-not-email-sent` MCP window). Not known yet how long a Zoho login lasts.

## Zoho login fix (2026-10-29, Claude)

Cause: Zoho shows "Verify your identity" (password, not OTP) on the saved profile, at the start and later in a run. The Zoho test script does not load `.env`, so `ZOHO_PASSWORD` was empty. Fix: `ZohoCrmPage.open()` in `src/pages/zoho/zoho-crm.page.ts`. Every Zoho page load goes through it. It loads `.env`, types the password and reloads the page, or stops with a clear message. QA does not need to sign in.

Rerun gotcha: a row creates its prospect in Saleshandy. A rerun with `KEEP_TEST_DATA=1` reuses the same row and Saleshandy answers 400 "Prospect with this email already exists in your Saleshandy account". Rerun without `KEEP_TEST_DATA` (the run is limited to this CSV by `TEST_DATA_ONLY`) so the row gets a new prospect.

Checked: `Lead: 1` passes end to end (1.9 min). The two `tsc` errors (page object line 32, spec line 48) are older and still open.

## Stage 3 spec complete, not run (2026-10-29, Claude)

`tests/zoho/reply-received.spec.ts` now has all 34 rows (one test per row, every CSV scenario used once). Nothing in this batch was run: a seven-row run was stopped by the low-memory guard (Trigger 2 and Task 1 hit the 8 min sort hang that the sort fix in `zoho-crm.page.ts` now covers; Task 3, 4, 5 found no contact in 90 s, cause not found).

Changes: Deal and Task rows find the run's record as the first new id (`crm.ids` before, `crm.waitForNewRecord` after), because a deal or task has no email to search. `crm.waitForNotes` waits for the note count. Hand-made records: `createContact`, `createLead`, `createDeal`, `setDealStage` (new, forms never seen, expect to heal). Second reply: `replyAgain` in `src/flows/saleshandy-to-zoho.ts`. Real reply: `waitForReplied` added to `sequence.page.ts`; the row skips unless `ZOHO_REPLY_GMAIL` is set, then waits up to 20 min for QA to reply from Gmail. Contact 7 is last and restores the Contact Fields mapping in `finally`.

Next: run a few rows at a time when memory is free (`npm run test:zoho-reply-received -- -g "<row>"`, no `KEEP_TEST_DATA`), starting with Contact 3 and Deal 1, and heal what fails. Open: why Task 3, 4, 5 found no contact.

## Resume here (saved 2026-10-29 evening)

Committed as `28e87bb` on `rudra-saleshandy` (not pushed). Spec has all 34 rows, only Lead 1 has passed. Plan for 2026-10-30: run a few rows at a time (memory was low, another session's Pipedrive run was also open), no `KEEP_TEST_DATA`, then heal.

1. `npm run test:zoho-reply-received -- -g "Contact: 3"` and `-g "Deal: 1"` first. They check second reply and the new-id method.
2. Rows with hand-made records (Contact 2, 4, 6, Lead 2, Account 2 to 4, Deal 2 to 5, Task 2, Combined 4) use `createContact`, `createLead`, `createDeal`, `setDealStage`. The forms were never seen, so expect selector fixes.
3. Open: why Task 3, 4, 5 found no contact in 90 s (the stopped run). Check one row with a trace.
4. Needs QA: `ZOHO_REPLY_GMAIL` for the Real reply row, and answers for Contact 2, 4, 6, 7 (still unconfirmed).
5. Contact 7 empties the Contact Fields mapping. It restores it in `finally`. If a run dies, run `npm run not-emailsent-zoho`.

Not mine, still uncommitted: Email Sent session files (`email-sent.spec.ts`, `zoho-forms.page.ts`, `zoho-email-sent.ts`) and its edits in `sequence.page.ts` and `package.json`. The Email Sent session knows about the sort fix and the login prompt fix in `zoho-crm.page.ts`.

## Run status (2026-10-31): Zoho gets no record, cause not found

Runs on 2026-10-31, `notemailsentzoho`, sequence 197387, Zoho Contacts and Leads read with the saved profile:

- Contact 3 failed 4 times (3 of them with no other Zoho run on this account), Deal 1 failed once, Lead 1 failed twice. Every failure is "No Zoho contact/lead/deal for <email>" after the 105 s wait. Lead 1 passed on 2026-10-29.
- Saleshandy side was fine each time: setup saved ("Configuration Updated Successfully"), email sent, reply shown as marked.
- Checked after the failures: on the spec's account Reply Received is ON with "Create/Update a Contact in Zoho", the other six triggers are OFF, "Zoho is connected" passes, `npm run not-emailsent-zoho` restored the four field mappings (5 passed), and the Zoho list is sorted newest first. QA found no records for Aline and Scarleth in Zoho.
- Ruled out: lost setup, sort or search fault in the script, parallel Zoho runs, expired Saleshandy login, empty field mapping.
- Open, possible product issue (QA decides if it is a bug, no Jira draft written): the reply is marked, the trigger is on, and Zoho gets no record. Zoho Logs are not used (QA 2026-10-29), so the workflow result is not seen.
- One run attempt failed at launch ("Opening in existing browser session") because the MCP browser `playwright-zoho-not-email-sent` held `auth/mcp-zoho-not-email-sent-profile`. Closed it. Do not open that MCP browser while a Reply Received run is active.
- Not run: the other 30 rows. Nothing else changed in the spec.

## Full run 2026-11-02 (Claude): 7 passed, 26 failed, 1 skipped (1.9 h)

Root cause of the first 12 failures (script, fixed): staging drew the Saleshandy Emails table as plain divs (`tanstack-table--tr/--th/--td`) with no row, columnheader or cell roles. `emailRow`, `openEmails` and `cell` in `src/pages/saleshandy/sequence.page.ts` now accept both markups. Not yet applied to the Prospects tab (lines 279, 317, 328). The same break hits every workflow that uses this page object. Mistake: a probe without `KEEP_TEST_DATA=1` replaced the people in many CSVs (ledger 13,782 to 14,752 of about 15,100 combinations). Use `REFRESH_USED_ONLY=1`, the pool is almost empty.

Passed: Contact 1, 4, 5, Lead 1, Account 1, Trigger behavior 1, 2. Skipped: Real reply (no `ZOHO_REPLY_GMAIL`). Contact 7 ran last, mapping restored (5 checks pass).

Failures by error, not yet fixed:
- Note count 0 where 1 expected, existing record updated: Contact 2, 6, Lead 2, Account 2, 4 (timing in the script, or no note on update: not known).
- No Zoho record after the reply: Contact 3, Lead 3, Task 1, 4, 5, Combined 1, 2, 3, Contact 7, Account 3 (account missing).
- No new deal or task: Deal 1, 2, 6, Task 2, 3. No deal after reply 1: Deal 3, 4, 5. Hand-made deal and task forms were never seen.
- Lead 4: script field reader returns "Lead Name" for an empty Company (script bug).
- Lead 5: a lead was created, the case expects none (product behavior changed or case outdated, QA decides).
- Combined 4: test timeout 8 min.

## Debug 2026-11-02 (evening, Claude): the missing Zoho record is not a script wait problem

- Contact 1 rerun (prospect Dwight Cato, sender Kartik 21): setup saved, email sent, reply marked in Saleshandy. Zoho had no contact after the 90 s wait and still none after a further 8 min poll. So the record is not late. It is not created.
- Trigger state read right after: Reply is Received ON, the other six OFF. Nobody else was running tests. So a trigger overwrite by a parallel Zoho spec (`enableOnly` turns the others off) does not explain this run.
- Sender is not the pattern: Kartik 21, Kartik 38 and Rachel 10 each have prospects with and without a Zoho record.
- Saleshandy page 1 of the Emails tab (2026-11-02 17:50): of about 17 replied prospects from today, only Marie-Claire Kasongo, Xavier Cairat and Jermaine Moxey are in the newest 30 Zoho contacts. Some of those may be hand-made by rows (Contact 2, 6).
- Not tried: the Zoho Logs tab (QA rule, no Logs for Zoho). Without it the workflow result is not visible. The cause is not proven. It may be a product issue (QA decides bug or not, no Jira draft written).
- Script fixes still open and independent of this: Prospects tab locators in `sequence.page.ts` (lines 283, 321, 332), Lead 4 field reader, Combined 4 timeout, hand-made deal and task forms.
- QA 2026-11-02: skip the Real reply row (no Gmail address). It skips itself while `ZOHO_REPLY_GMAIL` is unset. So "Mark as replied" against a real reply stays untested, and the cause of the missing Zoho records stays open.

## Rerun 2026-11-02 (night, Claude): Contact 2 and 3 fail again, same causes

Two earlier attempts failed at the Zoho page load (browser closed, then ERR_TIMED_OUT). They were network noise. The third attempt ran clean (3.0 and 2.9 min): Contact 2 expects 1 note and gets 0 (existing contact, no note added). Contact 3 finds no Zoho contact for manasseh.wale@mailinator.com after the reply. Both match the earlier failures, so they are not timing noise. Lead 5 (lead created, case expects none) is logged as a possible product change, QA decides. No Zoho Logs read (QA rule). Waiting on QA: read Logs once for one failing row, yes or no.

## Resume here (saved 2026-11-02 night)

Status: 34 cases, spec complete. Last full run: 7 passed, 26 failed, 1 skipped (Real reply, no `ZOHO_REPLY_GMAIL`). Contact 2 and 3 rerun tonight, still failing. Nothing running. No code changed this session. Not committed.

QA decision waiting: may Claude read the Zoho Logs once, for Contact 3 only, to see why Zoho gets no record? Default if no answer: keep Logs off.

Plan for tomorrow, in this order:
1. Apply QA's answer on Logs. If yes, run `-g "Contact: 3 "` and read the Logs entry for that prospect.
2. Script fixes: Combined 4 timeout (8 min), hand-made Deal and Task forms (open the Zoho create forms once in the `playwright-zoho-not-email-sent` MCP, fix `createDeal`, `createTask`, `setDealStage` in `zoho-crm.page.ts`). Rows: Deal 1 to 6, Task 2, 3.
3. Contact 2, 6, Lead 2, Account 2, 4: note count 0 on an existing record. Find out whether the product adds no note on update.
4. Lead 5: a lead is created, the case expects none (Z-1 changed?). QA decides bug or new expected result. Logged, not filed.
5. Rerun only failed rows, with `REFRESH_USED_ONLY=1`, never the whole suite. Command: `REFRESH_USED_ONLY=1 npm run test:zoho-reply-received -- -g "<row> "`. Close the MCP Zoho window first.

## Logs read, once (2026-11-03, QA OK)

Read page 1 of Saleshandy Settings > Zoho > Logs on `notemailsentzoho` (25 newest runs, Nov 2 2:21 PM to 8:11 PM). All 25 are "Email is Bounced" (16, 7:23 PM to 8:11 PM) or "Email is Opened" (9, 2:21 PM to 3:29 PM). No "Reply is Received" run appears in that window, so the 5:50 PM Contact 1 debug and the 9:02 PM Contact 3 rerun started no workflow run. For these two runs, Zoho and the script wait are ruled out: Saleshandy did not start the workflow. Not known yet: whether the trigger was ON at that moment, or whether Mark as Replied sends the event in every case. Older pages were not read. Script: `read-zoho-logs.cjs` in the session scratchpad, read only.

## Fresh check, Contact 1 (2026-11-03 09:00 to 09:03, Claude)

Run 1 failed at launch with `net::ERR_TIMED_OUT` on crm.zoho.com (temporary; curl to Zoho and Saleshandy staging answered afterwards). Run 2: prospect hassan.kossi@mailinator.com, sequence 197387. The flow waited for "Configuration Updated Successfully" (it throws without it), so the trigger was saved ON with the Contact action. Step 1 sent. Mark as Replied: `PATCH /api/edge/sequences/197387/emails/status` body `{"sequenceProspectTaskIds":[98901557],"status":"replied"}`, answer 200 "Email has been marked as replied". Zoho had no contact after the wait. Logs page 1 read about 2.5 minutes later: newest entry still Nov 2, 8:11 PM (Email is Bounced), so no Reply Received run was created. Result: reproducible, Saleshandy marks the reply but starts no workflow run. Not known: when Reply Received runs last appeared in Logs (older pages not read), and why Contact 1 passed earlier on 2026-11-02. QA decides bug or not. No Jira draft written.

## Fresh exploration (2026-11-03 09:22 to 09:30, Claude)

Throwaway spec `tests/setup/zoho-reply-fresh-explore.spec.ts` (not committed), run with `KEEP_OTHER_TRIGGERS=1` while Email Bounced and Link Clicked ran on the same account. E1: Reply is Received ON with "Create/Update a Contact in Zoho" before the save, after the save and after a reload; Link Clicked and Email Bounced ON, the other three OFF. E2: prospect rowan.whitfield.mw05jps9@mailinator.com on sequence 197387, Send now at 09:23:10 (UTC 03:53:10), Mark as replied 10 s later, then 10 Logs polls of 30 s each. Result: 0 Reply Received entries. Logs page 1 read at 09:29 holds 25 entries from 09:04 to 09:28 (Link Clicked and Bounced only), so the entry was not pushed off the page. With the 09:01 Contact 1 run (hassan.kossi@mailinator.com) this is 2 of 2 failures today: trigger saved ON, Mark as replied answered 200, no Reply Received run. Cause not known. Not tried: waiting minutes between Send and Mark as replied (`ZOHO_REPLY_DELAY_S`), a real reply from a mailbox, older Logs pages. QA decides bug or not.

## Bug draft (2026-11-03)

QA: bug confirmed. QA tried Mark as replied from sequence > Prospects, a real Gmail reply, and the trigger off and on: none starts the workflow. Draft written: `jira/drafts/reply-received-zoho-workflow-not-triggered.json` (Medium, Epic AL-3982, Relates AL-4192). QA sends it with `npm run jira`. Not sent yet. Note: the Emails tab three-dot menu shows no Mark as replied for QA (open bug AL-4217), but the script found it and the request worked.

## Rebuild 2026-11-03 (Resume here)

QA asked to start from scratch. Done today:
- Old cases, spec and CSV deleted (still in git, commit 28e87bb). The shared flow `src/flows/saleshandy-to-zoho.ts` stays (16 files import it).
- New cases: `test-cases/zoho/reply-received.md`, 24 rows, QA "looks good" 2026-11-03. Sections: Trigger behavior 2, Contact 6, Lead 3, Account 3, Deal 4 (Deal 2 is the multiple-deals case: newest updated, older unchanged), Task 3, Combined 2, Real reply 1.
- New spec: `tests/zoho/reply-received.spec.ts` (24 tests, typechecks, `--list` only, not run, not committed). Data: `npm run data:zoho-reply-received` (23 rows from the Email Opened CSV; made 2026-11-03). That CSV is also the column source for other Zoho data scripts, so keep it. Profile copy: `auth/zoho-reply-received-profile`. Run: `KEEP_TEST_DATA=1 npm run test:zoho-reply-received -- -g "<row>"`.
- Bug AL-4219 sent by QA: the Reply Received workflow does not start (Mark as replied from sequence > Prospects, a real Gmail reply, trigger off and on). No row that expects a Zoho record can pass until it is fixed. Our script marks the reply from the Emails tab three-dot menu (it worked in the script; QA sees no such button, open bug AL-4217).
- Real reply row: needs `ZOHO_REPLY_GMAIL` (QA creates a Gmail address). Not set.
- `tests/setup/zoho-reply-fresh-explore.spec.ts` is a throwaway probe (not committed).

Next: when AL-4219 is fixed, run Trigger behavior 1 and Contact 1 first (`KEEP_TEST_DATA=1`), then the failed rows only. Sends: about 24 of the shared cap of 40 a day.

## Change 2026-11-03 (Claude): Mark as Replied from the Prospects tab
QA: the workflow now starts from sequence > Prospects > select the prospect > toolbar icon "Mark as Replied". The Emails tab three-dot menu stays in the code for the other platforms (open bug AL-4217: QA does not see that button).
- New: `markAsRepliedFromProspects` in `src/pages/saleshandy/sequence.page.ts`. It ticks the row and clicks `button[icon="round-corner-arrow-back"]` (tooltip "Mark as Replied", read with a headless probe on `notemailsentzoho`, sequence 197387, nothing clicked). It then waits for the Replied cell on the Emails tab.
- New: `sendAndReplyFromProspects` and `replyAgainFromProspects` in `src/flows/saleshandy-to-zoho.ts`. `tests/zoho/reply-received.spec.ts` imports them under the old names. `sendAndReply` and `replyAgain` are unchanged (Conversation Category Updated still uses them).
- Checked: typecheck clean for `src` and `tests`; `--list` shows 24 tests. Not run. Not committed. Open: whether a confirm dialog shows after the click (not seen, nothing clicked).
- Next: when QA says go (and AL-4219 is fixed), run Trigger behavior 1 and Contact 1 with `KEEP_TEST_DATA=1`.

## First full run 2026-11-03 14:00 to 14:35 (Claude): stopped, data made again
Stopped after 12 of 24: 1 passed (Trigger behavior 1), 11 failed. Contact 1 trace: `POST /api/edge/contacts/` 400 "Prospect with this email already exists in your Saleshandy account" (code 1001). Cause: `test-data/zoho/reply-received.used.txt` (22 emails, 12:05 today) showed those people were already created by an earlier run; `KEEP_TEST_DATA=1` does not swap used rows. My first guess (same people as Email Opened) was wrong. No email was sent by the failed rows. The Prospects page click was not reached.
Fix, QA OK: deleted the used list, ran `npm run data:zoho-reply-received -- --force`: 23 new rows, none equal to the old CSV, all unique. Ledger `_generated-emails.txt` untouched.
Rule: a row that was used once cannot run again with `KEEP_TEST_DATA=1`. For a rerun of a used row, make the data again first.

## Run 2026-11-03 15:00 to 16:05 (Claude): 16 of 24 passed with the Prospects page click
New data (23 rows), Mark as Replied from sequence > Prospects. Contact 1 alone: pass. Then 22 rows: 15 passed, 6 failed, 1 skipped (Real reply, no `ZOHO_REPLY_GMAIL`), 1.1 h. With Trigger behavior 1 (passed in the first run): 16 passed, 6 failed, 1 skipped, 1 not run again. Mark as Replied from the Prospects tab started the workflow; every Deal, Account and Task 1/2 row with a Zoho record passed, so AL-4219 looks fixed on staging.
Failed rows and what the evidence shows (causes not proven unless said):
- Contact 3 (second reply): Step 2 row not on the Emails tab after 120 s. No failed API call in the trace. Cause not known.
- Contact 6 (email in other letter case): create form stayed open, no "Done". No failed API call in the trace. Cause not known (not the 400 "already exists" of the first run).
- Lead 3 (no company): Replied cell stayed "-" for 60 s after the Prospects tab click. Trace shows `POST .../emails/send` 400 "Email has already been sent". Not known whether the click failed or the list was stale.
- Task 3 (Subject empty): dialog Save button disabled, test waited the full 15 min. Same case as AL-4198 (empty Task configuration); needs QA's hand check, not a script rerun.
- Combined 1: `GET /api/edge/sequences/197387/emails` answered 504 (gateway timeout) on staging. Looks like a staging fault.
- Combined 2: `page.goto` to Zoho Contacts `net::ERR_TIMED_OUT` after 201 ms, right after the 15 min Task 3 hang. Looks like a network fault.
Next: make the data again, rerun only these rows with `KEEP_TEST_DATA=1`, Task 3 excluded until QA decides.

## Task 3 = AL-4198 (QA 2026-11-03)
QA: Task 3 (Subject left empty) is the known bug AL-4198. Its failure is expected and counts as a known bug, not a new failure. Count at 16:30: 18 of 24 passed at least once, 5 failed (Contact 3, Lead 3, Task 3 = AL-4198, Combined 1, Combined 2), 1 skipped (Real reply). Rerun of Lead 3, Combined 1, Combined 2 and Task 3 started 16:30 (log `zoho-reply-rerun-c.log` in the session scratchpad). Contact 3 waits for QA: how a second reply is made by hand.

## Fresh-data rerun 2026-11-03 17:00 to 17:40 (Claude)
Fresh data (used list deleted, `npm run data:zoho-reply-received -- --force`, 23 new rows). Rerun of the failed rows with `KEEP_TEST_DATA=1`:
- Lead 3 (no company): passed.
- Combined 1 (Contact, Deal, Task, prospect not in Zoho): passed.
- Task 3 (Subject empty, AL-4198): rewritten as a UI check only (QA): Task dialog, Subject empty, Save must be disabled. No email sent. Passed in 14 s.
- Combined 2 (all 5 actions): skipped with `test.skip` in the spec (QA: unrealistic setup). Row still in `test-cases/zoho/reply-received.md`.
- Contact 3 (second reply): script failed again (no step 2 row on the Emails tab). QA checked by hand on selin.sahin@mailinator.com: still 1 contact in Zoho, a second note. QA marked it PASS (manual).
- Cause of the script failure (QA): after a prospect is marked as replied, it cannot move to step 2, so the step 2 row never exists. This is product behavior, not a bug.
Result (QA: Task 3 is a real case and it passes): 22 of 24 pass (Contact 3 by hand, Task 3 as UI check), 2 skipped (Combined 2, Real reply: no `ZOHO_REPLY_GMAIL`). Spec edits are not committed.
Open: Contact 3 case and script still describe "mark as replied on step 2". Change proposed, waiting for QA's OK (see reply).

## Staging approved 2026-11-03 (QA)
QA: Zoho Reply Received is staging approved at 22 of 24. Production smoke not started.

## Production smoke prepared 2026-11-03 (Claude)
QA "looks good" on 8 checks (Contact 1, 2, Lead 1, Account 1, Deal 1, 2, Task 1, Combined 1). QA: AL-4219 fix is not deployed on production yet, so no run now. QA gave sequence 989765 (the Email Bounced smoke sequence, one step); the run script uses it by default, no setup spec. Reply method: Emails tab three-dot menu (QA prefers it).
Files: `notes/production-testing/19-zoho-reply-received.md` (+ README row), `tests/zoho/reply-received-smoke.spec.ts` (8 tests, typechecks, `--list` only, not run), `scripts/run-zoho-reply-received-smoke.sh`, `scripts/make-zoho-reply-received-smoke-data.ts`, data `test-data/zoho/reply-received-smoke.csv` (8 rows, made). Command: `npm run smoke:zoho-reply-received`. Not committed.
Next: after the deploy, QA runs the command (login first: `npm run login:saleshandy -- emailopenedprod`; Email Sent and Email Opened triggers OFF). Then draft the AL-4192 summary from `jira/templates/comments/04-production-smoke-summary.md`.

## Production walk-through, headless, read-only (2026-11-03, QA OK)
Probe: `tests/setup/zoho-reply-smoke-walkthrough.spec.ts` (`WALKTHROUGH=1`, account `emailopenedprod`, saved session of 2026-11-02 18:39 still valid). Nothing sent, saved or clicked except tabs and one three-dot menu.
- Emails tab of sequence 989765: headers Prospect, Step, Scheduled/Sent, Opened, Clicked, Replied, Sender Email, Actions. Production draws real `role="row"` rows (staging draws divs); `emailRow`, `openEmails` and `cell` accept both, so no change. `#dropdown-basic` is in every row. The row menu has a "Mark as replied" button (AL-4217 does not show on this account). "Send now" not seen because all 8 rows are old bounced emails; the same `sendNow` ran on production in the Link Clicked and Email Bounced smokes today.
- Prospects tab toolbar icons: send, close, round-corner-arrow-back (Mark as Replied), unavailable, flag, pause-circle, right-arrow.
- Zoho page: Disconnect button shown (connected). 7 triggers listed, "Reply is Received in Saleshandy" has its Select button. Reply, Email Sent and Email Opened are all OFF now, so the sibling guard passes.
- Sequence 989765 senders: Pipedrive Production SMTP (rudra+pipedrive@saleshandy.com, 143/150 used today) and RI Round TwoProd SMTP (dharmesh+prospectoutcome@saleshandy.com, 124/150 used today). About 33 sends left today, the limits reset tomorrow. README sender list is out of date.
- Not checked read-only: Send now on a scheduled row, saving a trigger, the Zoho CRM side (same code and profile as the Bounced and Link Clicked smokes that passed today).
- Script changes needed: none.
