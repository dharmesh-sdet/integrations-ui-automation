# Zoho Email Sent: exploration progress (2026-10-29)

Account gzoho, staging, sequence 197383 (3 steps). Throwaway spec: `tests/setup/zoho-explore.spec.ts` (needs `ZOHO_EXPLORE=1` and `KEEP_TEST_DATA=1`). Zoho is read with a headed browser on a virtual display, so no window shows: `xvfb-run -a node <script>` with the persistent profile `auth/mcp-zoho-profile` (headless fails on "Verify your identity", a visible MCP window steals focus).

## Results

| Row | Run | Result |
|---|---|---|
| Account, prospect has no company (E1) | Account action only, `priya.nair.zx1@mailinator.com`, no company | No account and no contact created. Accounts total stayed 136 and the newest account was older, read 70 s after the send. Later, the Contacts list had no Priya Nair. [Zoho] |
| Contact, email in different case (E3) | Zoho contact `Elena.Rossi.ZC@Mailinator.com` made by hand, then the lowercase prospect, Contact action | Same contact updated (Modified 12:47 PM after Created 12:44 PM). Still 1 contact. 1 note, Step 1. Zoho shows the email in lowercase. [Zoho] |
| Deal, Closing date 7 (E4) | Deal action, `tomas.berg.zd1@mailinator.com`, company Northwind Traders, Deal Value 12000 | No contact created. Deal "Tomas Berg": Amount 12,000, Stage Qualification, Closing Date 05/11/2026 (today plus 7), Account Northwind Traders. **Two deals and two Northwind Traders accounts from one event**, each deal with its own note, both created 12:56 PM. [Zoho] |
| Task, step 1 (E2) | Task action, Subject "Follow up after step 1", Not Started, Normal, Due In 3, `marcus.webb.zt1@mailinator.com`, company Brightline Logistics | One contact Marcus Webb. **Two tasks** from one event, both Step 1, both Due 01/11/2026, each with its own note, 12:51 PM. [Zoho] |
| Task, event on an existing contact (E2D) | Task action, Marcus Webb moved to step 3, Subject "Follow up after step 3" | One new task only (3 tasks in total for Marcus: 2 from step 1, 1 from step 3). Still 1 contact. So the duplicates came on the first event, when the contact was new. [Zoho, 2026-10-29] |
| Task, second event (E2B, E2C) | Step 2 ran while the Deal action was on (my mistake, E4 ran first), so it made a Deal note on Marcus Webb. Step 3 with the Task action never sent: the Add To Sequence dialog hung twice in `moveToStep` | Not answered. |

## Open

- When the prospect is new in Zoho, one event makes duplicate Task and Deal records. If the contact already exists, one event makes one task (E2D). Deals on an existing contact were not run. This is not in the known issues (Z-5 names two accounts only for Account plus Deal together). Needs QA: bug or known?
- Task second event: answered by E2D, one task per event on an existing contact.
- Duplicate rules in Zoho Setup not found.

## Side effects

- If a spec name matches no CSV, the global setup refreshes every CSV. My first run did this to the CSVs in `test-data/` (gitignored) of other workflows.
- Trigger on gzoho set back to Email Sent ON with Create/Update a Contact only.
- Zoho records left behind: Elena Rossi, Marcus Webb (contact, 2 tasks, a deal note), Tomas Berg (2 deals, 2 accounts). No cleanup (QA rule).

## Resume (saved 2026-10-29, end of session)

State: test cases approved and saved, 24 rows, `test-cases/zoho/email-sent.md`. No Zoho page objects, flow or spec yet. Next, in this order (QA's plan): (1) Zoho code: `src/pages/zoho/` (contacts, accounts, deals, tasks, leads: list, find by name or email, count, read a record, note text), flow `src/flows/saleshandy-to-zoho.ts`; (2) join it with the Saleshandy steps from `src/flows/saleshandy-to-pipedrive.ts` and `SaleshandySequencePage`; (3) hand-write `tests/zoho/email-sent.spec.ts` and `test-data/zoho/email-sent.csv`; (4) add `npm run` scripts. Hand-written, no planner, generator or healer (QA 2026-10-29).

Open for QA: (a) are duplicate Tasks and Deals (and two accounts) from one event with a new contact a bug or known? (b) ANSWERED 2026-10-29, QA: the spec reads Zoho with the saved profile, headed on xvfb (no window). Not yet tested across days.

Facts to reuse:
- Sequence "Zoho's First Sequence", id 197383, 3 steps, active, sender Ritaellis1988+1@gmail.com, Saleshandy user `dharmesh+zohointegration@saleshandy.com` (the Zoho note shows this user, the account file says `dharmesh+gzoho@saleshandy.com`; not reconciled).
- Zoho read method: `scripts/zoho-read/README.md`.
- Extra Configuration dialogs: Task = Due In (days), Subject (text), Status, Priority. Deal = Deal Closing date (days, default 0), Select Pipelines and Select Stages (greyed, empty). Details in `staging-walkthrough.md`.
- Note text on every record: "Saleshandy Email Sent from Sequence", Sequence Name, Sequence, Step, Sender Email, Prospect Email, Prospect Name, User. Notes carry a title "Contact - <name>", "Deal - <name>" or "Task - <subject>".
- Zoho shows a contact email in lowercase.
- A deal made with no contact is unlinked, and creates no contact. Its account is named after the company.
- `moveToStep` in `SaleshandySequencePage` hung twice at the "Add To Sequence" dialog (the sequence list did not open). A wait of 2 s before opening the list, 1.5 s before picking "(Current Sequence)" and 2.5 s before the step list worked in `tests/setup/zoho-explore.spec.ts` (test E2D). Move that fix into the page object before the spec uses it.
- The global setup (`src/data/global-setup.ts`) refreshes EVERY CSV when the spec name matches no CSV slug. Run with `KEEP_TEST_DATA=1`, or name the spec after its CSV.
- `tests/setup/zoho-explore.spec.ts` is throwaway (skipped without `ZOHO_EXPLORE=1`). Delete it once the real spec exists.
- gzoho trigger state at the end: Email Sent ON with Create/Update a Contact only (QA's original).
- Records left in Zoho (no cleanup, QA rule): Elena Rossi (contact), Marcus Webb (contact, 3 tasks), Tomas Berg (2 deals, 2 Northwind Traders accounts). Prospects used: priya.nair.zx1, marcus.webb.zt1, elena.rossi.zc, tomas.berg.zd1 at mailinator.com. Do not reuse these emails.

Candidate lessons (propose to QA, apply only after OK): (1) before a run, check that the spec name matches a CSV or set KEEP_TEST_DATA=1; (2) never open a visible browser window while QA works, use the virtual-display method; (3) when two exploration runs share one trigger, set the trigger again before each send.

## Rerun and coordination (2026-10-29, afternoon)

- Rerun with new prospects: Task (Hannah Brooks, 2:17 PM) gave 2 tasks and 2 notes again, so 2 of 2 runs duplicate. Deal (Oliver Grant) gave 1 deal and 1 account, so the Deal duplicate happened 1 of 2 runs. QA will repeat the Task steps by hand, then says if it is a bug. No Jira draft until then.
- QA decided: the spec reads Zoho with the saved profile, headed on xvfb.
- Another session (local-project-45, Zoho Reply Received, account notemailsentzoho) owns `src/pages/zoho/zoho-crm.page.ts`, `src/flows/saleshandy-to-zoho.ts`, `tests/zoho/reply-received.spec.ts` and `test-data/zoho/reply-received.csv`. Email Sent reuses those files and sends changes to that session instead of editing them. My files: `tests/zoho/email-sent.spec.ts`, `test-data/zoho/email-sent.csv`. Its Zoho profile is `auth/mcp-zoho-not-email-sent-profile`, mine is `auth/mcp-zoho-profile`. Both sessions share Zoho org 941113438.
- More prospects used: hannah.brooks.zt2 and oliver.grant.zd2 at mailinator.com.

## Code written (2026-10-29, 16:15)

Done: `scripts/make-zoho-email-sent-data.ts` (`npm run data:zoho-email-sent`, 23 prospects, one per sending row), `src/flows/zoho-email-sent.ts` (TRIGGER, `sendStep`, `inDays`, `noteTitles`), `tests/zoho/email-sent.spec.ts` (15 rows: Lead 1 and 3, Contact 1, 2 and 5, Account 1 and 4, Deal 1 and 4, Task 1 and 3, Combined 1 and 2, Trigger and setup 1 and 2), `npm run test:zoho-email-sent`. Typecheck passes for these files. QA OK 2026-10-29: `moveToStep` in `sequence.page.ts` now waits 2 s, 1.5 s and 2.5 s before its three clicks. Shared Zoho files are not edited (owner: the Reply Received session).

Not written yet: Lead 2, Contact 3 and 4, Account 2 and 3, Deal 2, 3 and 5, Task 2 (each needs a record made by hand in Zoho first), and the Extra Configuration read-back of Trigger and setup 2.

First run, `Lead: 1`: Saleshandy side passed (Sepideh Jafari, step 1 Sent 04:06 PM, lead in the Zoho list). The row then hung 8 min in `ZohoCrmPage.sortNewestFirst`. Cause: Zoho keeps the list sort per user and view, so a fresh load already shows Created Time and Descending and has no "None" option. Fix sent to local-project-44 and local-project-af (owner not known), not applied. Rerun `-g "Lead: 1"` once it is saved. No other row has run.

Zoho findings to reuse:
- The saved profile `auth/mcp-zoho-profile` showed "Verify your identity" (relogin page) on a fresh open and on record pages. Typing ZOHO_PASSWORD from `.env` clears it. The shared `ZohoCrmPage.open` now does this on every load.
- Labels on a record page (`ZohoCrmPage.field`): Deal: Deal Name, Account Name, Contact Name, Amount ("Rs. 12,000.00"), Closing Date, Stage. Task: Subject, Due Date, Contact Name, Status, Priority. Dates are dd/mm/yyyy. A task page has no Notes count, so notes are counted by the note title.
- Node cannot import `zoho-crm.page.ts` directly (parameter property): use `node --experimental-transform-types`.

## Run status (2026-10-29, 16:50)

`Lead: 1` passes (2.1 min) after local-project-af saved the `sortNewestFirst` fix. Rerunning with `KEEP_TEST_DATA=1` reuses the prospect already in the sequence, so the add dialog stays open: rerun a row without it (`TEST_DATA_ONLY` limits the refresh to `email-sent.csv`).
The run of the other 14 rows was stopped by Claude Code for low system memory (15.6 GB total, 11.7 GB used, many idle MCP servers) before any row finished. About 4 emails went out (sends log 30 to 34). No result for those rows. Not restarted: wait for QA. Rows to run: Lead 3, Contact 1, 2 and 5, Account 1 and 4, Deal 1 and 4, Task 1 and 3, Combined 1 and 2, Trigger and setup 1 and 2. The CSV refreshes on each run, so the prospects of the stopped run are not reused.

## Full spec written (2026-10-29, evening)

All 24 rows are now in `tests/zoho/email-sent.spec.ts` (24 listed with `--list`, typecheck clean for my files). New: `src/pages/zoho/zoho-forms.page.ts` (`ZohoForms`: `createContact`, `createLead`, `createDeal`, ids from the create forms read on 2026-10-29) and 9 rows that need a record made by hand: Lead 2, Contact 3 and 4, Account 2 and 3, Deal 2, 3 and 5, Task 2. Trigger and setup 2 now reads back the saved Task values.
Not confirmed (marked `TODO(needs-input)`): the lookup picker (Account Name, Contact Name) and the Stage list in `ZohoForms`, the Company box of the Lead form, and the chip icon that reopens an Extra Configuration. The first run of those rows confirms or fixes them. None of these rows has run; only Lead 1 has.

## Run status (2026-10-31)

22 of 24 rows pass. Full run: 17 passed, 7 failed, 51.3 min. Five of the seven were script failures, fixed and rerun: Lead 2, Account 2, Deal 2, 3 and 5 all pass now.

Script fixes (not committed):
- `src/flows/zoho-email-sent.ts`: `isBlankField`. Zoho draws an empty field as a dash with CSS, so the page text has no line for it and `ZohoCrmPage.field` returns the next label. Used by Lead 3, Contact 2 and Deal 1.
- `tests/zoho/email-sent.spec.ts`: Combined 1 waits for the lead, deal and task before it counts them.
- `src/pages/zoho/zoho-forms.page.ts`: lookup options are `lyte-drop-item[role="option"]` (type the name, then click); the Lead Company box is `input#inputId`; the Stage list opens from the "Qualification" text and uses the same option type; Account Name is required on the Deal form, so `createDeal` makes an account first (`Deal Account <time>`). Confirmed on the real forms on 2026-10-31; no record saved by the probe.

Open (failed in 3 of 3 runs, cause not known):
- Task 3, Subject left empty: a task is created with the subject "Follow up after step 1" (the previous subject). The overview says an empty Subject skips the task. Either the script leaves the old subject in the dialog (`fill('')` in `saleshandy-to-zoho.ts` line 37, shared file) or the product ignores an empty subject. Next: read the saved Task dialog back after configure. No Jira draft before that.
- Combined 1, all five actions: the contact, lead and deal exist, the task never appears (waited up to 5 min). Looks like a product issue. Not yet asked to QA.

Note: Account 1 failed once (no billing city, state or country on the new account) and passed in the full run. Intermittent, not filed.

Do not run `npm run test:zoho-email-sent` while another run uses `test-results-zoho-email-sent`: a new run deletes the old traces.

## Resume here (2026-11-02, end of session)

State: committed as aa3562f on rudra-saleshandy (my 4 files and 3 Jira drafts). Staging result: 22 of 24 rows pass (2026-10-31), then on 2026-11-02:
- Task 3: product keeps the previous saved Subject when it is empty, so the task is made with the old Subject. Filed by QA as AL-4198 (also Due In 0 and empty). Row stays a Fail until the product blocks an empty Subject.
- Combined 1: the lost Task chip was a script race (no wait after the Deal and Task dialog Save), fixed by `configureWaiting`. Passed in 1 of 2 real runs (Ingvild Haugen). The other (Ragnhild Eide) failed on 2 tasks: Logs showed 2 executions for one email. Not filed (QA: file only if it repeats).
- Filed by QA: AL-4199 (Deal Pipelines and Stages not selectable, Q3) and AL-4218 (Account and Deal make two accounts; execution ids 6ae8593f00b3b94795f3c87a and 6ae859413e9e05c58a9deeaf). QA: AL-4218 stays, the developer handles it.
- Logs exception: QA asked for execution ids, so Logs were read for those runs only. See memory zoho-no-logs.

Next:
1. QA verifies the empty Extra Configuration of the Task by hand on gzoho. Do not run anything on gzoho until QA says. gzoho trigger now: Email Sent with Create a Task only (left by Trigger and setup 2), Subject "Follow up after step 1", Due In 3.
2. After QA's OK, plan the production run. Needed from QA: production account and Zoho connection, production sequence and sender, which rows (smoke: fixed tickets only), daily send cap.
3. Open: the double execution (one email, 2 executions, double task or deal). The shared `configure` in `src/flows/saleshandy-to-zoho.ts` has the same race as before. QA decides who edits it.

Other notes:
- Name pool: 20 countries added to `src/data/countries.ts` (uncommitted, shared with another session's 19). About 2,900 unused name pairs left, about 15 full refreshes. To get more, give each country more first and last names.
- `tests/setup/zoho-task3-probe.spec.ts` is a throwaway probe, not committed.
- Peer session local-project-cb (Email Opened) calls `configureWaiting`: keep it exported from `src/flows/zoho-email-sent.ts`, tell it before any rename.

How to run: `npm run test:zoho-email-sent -- -g "<row>|<row>"` in the background, then read the log. The run refreshes the CSV, so each run uses new prospects. A new run deletes the old `test-results-zoho-email-sent` folder. Probe the real Zoho form with a throwaway script and `xvfb-run -a node --experimental-transform-types` on `auth/mcp-zoho-profile` before you change a locator.

## Exploration of Task 3 and Combined 1 (2026-11-02)

Probe: `tests/setup/zoho-task3-probe.spec.ts` (throwaway, not committed, `ZOHO_EXPLORE=1`). No email sent. gzoho is back on Email Sent with Create/Update a Contact only.

- Task 3, cause found: the product keeps the previous saved Subject when the Subject is empty. The script clears the box (screenshot before Save). Save "Probe A", then empty: reload shows "Probe A". Save "Probe B" with Due In 5, then empty with Due In 3: reload shows Subject "Probe B" and Due In 3. No required-field error, the dialog closes. So the task is created with the old Subject. The overview says an empty Subject creates no task. Open for QA: bug or known?
- Combined 1, CORRECTED 2026-11-02 (the first reading was wrong): the five chips were lost because the script did not wait for the "Configuration Updated" message after the Deal and Task dialog Save (about 4 s each). With the wait, all 5 chips persist after a reload (probe P10). This is a script problem, not a product bug. QA's manual test made 1 lead, 1 deal, 1 contact, 2 accounts (one linked to the contact, one to the deal, Z-5) and 1 task. Fix: `configureWaiting` in `src/flows/zoho-email-sent.ts`, used by Combined 1. The shared `configure` in `saleshandy-to-zoho.ts` (another session owns it) has the same race for any row that saves a Deal or Task dialog and then picks another action.
- Combined 1 real run after the fix (prospect Ragnhild Eide): contact 1, lead 1, deal 1 pass. Fails on the last count: 2 tasks (03:04 PM and 03:05 PM, same Subject, Due 05/11/2026, same contact). This is the duplicate Task seen on 2026-10-29 for a new prospect. Open for QA: bug or known? Also seen: two deals from one event in 2 of 3 probe runs on 2026-11-02.
- Blocker: `npm run test:zoho-email-sent` stops in global setup with "Could not find a fresh name after 600 tries; add names to NATIONALITIES in src/data/generate.ts". Shared file, not edited.
- Combined 1 rerun (2026-11-02, prospect Ingvild Haugen, `configureWaiting`): PASSED in 4.0 min. Zoho read again minutes later: 1 contact, 1 lead, 1 deal, 1 task, no late second task. So the duplicate task is intermittent: 2 tasks in the Ragnhild Eide run (03:04 and 03:05 PM), 1 task in the Ingvild Haugen run. QA's rule (2026-11-02): file it only if it repeats. No Jira draft written. QA counted 1 task by hand and 2 accounts (Z-5).
- Jira 2026-11-02 (all sent by QA): AL-4198 (Task Subject and Due In allow empty and 0), AL-4199 (Deal Pipelines and Stages not selectable, Q3), AL-4218 (Account and Deal create two accounts, with execution ids 6ae8593f00b3b94795f3c87a and 6ae859413e9e05c58a9deeaf). QA on AL-4218: it stays as filed, the developer will handle it, otherwise QA does it manually later. No change to AL-4218 and no comment from Claude. A peer session reported a developer note that this account behavior is known (Z-5); QA did not change the ticket because of it.
- Still open: one email can start two executions (Logs: 2 executions for Ragnhild Eide at 3:04 PM, 1 for Ingvild Haugen), which fits the double Task and double Deal. Not filed (QA: file only if it repeats). Combined 1 passes with `configureWaiting` in 1 of 2 real runs (the other failed on 2 tasks).
