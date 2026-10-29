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
