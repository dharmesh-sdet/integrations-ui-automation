# Handoff to Cursor (written 2026-10-23, refreshed 12:50 IST, Claude weekly usage nearly spent)

No test run was active at 12:50: no `bin/playwright test` or worker process, so nothing is sending mail.

Built from the progress files, not from a live session. Where a file did not say, this says "not recorded". Re-read the progress file named per workflow before acting; it is newer than this note if it was touched after 2026-10-23. Setup: read `AGENTS.md` first. All commands run from `automation/`.

## Salesforce (current focus)

| Workflow | State | Progress file |
|---|---|---|
| Email Sent | Done. QA signed off 2026-10-22, all cases passed by hand. Production smoke ran 2026-10-22 (sequence 979437, account `emailopenedprod`): 8 of 10 in the script, Create a Opportunity row passed on rerun, Update a Account open (below). | `context/salesforce/email-sent-progress.md`, `notes/production-testing/07-salesforce-email-sent.md` |
| Prospect Outcome Updated | Staging done. QA signed off 2026-10-22 (27 tests, latest of each passed). Production smoke: checklist `test-cases/salesforce/prospect-outcome-updated-smoke.md`, spec `tests/salesforce/prospect-outcome-updated-smoke.spec.ts`. Ran once on 2026-10-22 about 20:58 (`reports/salesforce-outcome-updated-smoke/`): the "Setup: Salesforce records, prospects and step 1 sends for all 11 rows" step failed because a step 1 send showed "Scheduled, Tomorrow, 09:04 AM" instead of "Sent" (expected `/^Sent/`). By design the run stops there. The 10 checks never ran. Cause not proven (mailbox daily limit or sending hours, as the 08 note guessed). Not recorded whether it was rerun after that. | `context/salesforce/prospect-outcome-updated-progress.md`, `notes/production-testing/08-salesforce-prospect-outcome-updated.md` |
| Reply Received | Unfinished. Spec `tests/salesforce/reply-received-all-activities.spec.ts` (40 tests). Last run `reports/reply-all/20261021-165721`: 13 passed, 27 failed, 17 of those did not run (send cap, "93 of 80"). Script/setup failures: Create a Lead 1 and 3 (Done button not found), Create a Lead 4 and Update a Lead 1 and 2 ("Similar Records Exist"), Record(log) an Email Activity 1 to 4 (Save click blocked by the transfer overlay), Create a Opportunity 2 (Save disabled), Update a Opportunity 1 (no "was created" toast). | `context/salesforce/reply-received-progress.md`, plan `test-cases/salesforce/reply-received-all-activities.md` |
| Email Opened, Email Bounced, Link Clicked, Prospect Unsubscribed | Not started as far as files show. Only a context file each in `context/salesforce/`. | none yet |

Next for Reply Received: wait for the send cap to reset, fix the script failures above one row at a time (read each row's trace in `reports/test-results/` first), rerun only failed rows with `TEST_DATA_ONLY=salesforce/reply-received-all-activities REPORTS_DIR=reports/reply-all`. QA runs the full script at the end. Use `REFRESH_USED_ONLY=1` to replace only used data rows.

Next for Outcome Updated production smoke: check the sender's daily limit and sending hours on the `emailopenedprod` account by eye (the send counter file `test-data/send-count.json` read 39 on 2026-10-22, cap 40), then `npm run smoke:salesforce-prospect-outcome-updated`. Needs fresh logins first if older than a week: `npm run login:saleshandy -- emailopenedprod`, `npm run login:salesforce -- emailopenedprod`. Keep a Salesforce tab open for the whole run (memory `salesforce-tab-must-stay-open.md`).

## Pipedrive (new, 2026-10-23)

Context only, no scenarios, no scripts. Another Claude session (`pipedrive-zoho-crm-context`) was still writing these files at 12:47 on 2026-10-23: `automation/context/pipedrive/00-overview.md` plus one file per workflow (7: Email Sent, Reply Received, Link Clicked, Email Opened, Email Bounced, Prospect Unsubscribed, Prospect Outcome Updated). Facts come from QA's pasted tester rules document, tagged `[QA 2026-10-23]`; nothing is confirmed in the Saleshandy UI yet. Zoho CRM context was the other half of that session's job; check `automation/context/` for a `zoho` folder before assuming it exists. Next step per the project rules: stage 1 walkthrough, then scenarios for QA review (ask first, see `AGENTS.md`).

## Other Claude sessions open at 12:47 on 2026-10-23

`local-project-0e` (waiting, started about 1h earlier) and `pipedrive-zoho-crm-context` (busy). Their work is not in this note beyond the Pipedrive files. If Claude is back, ask them or read the newest-modified progress files with `ls -lt automation/context/*/*progress*.md`.

## Waiting on QA (do not decide these)

- Update a Account: the workflow looks the Account up by the prospect's full name (`WHERE Name='<full name>'`), not the Company, so an Account named like the Company is never updated. Create a Account does the same lookup then creates one named after the Company. Bug or intended? Not filed. Test data was not changed.
- AL-4169 (Update a Opportunity made a second Opportunity in the script, QA could not reproduce by hand): status is QA's call; script to be fixed when the same row is built for another workflow.
- Prospect Outcome Updated open points on the draft were closed by QA's sign-off.

## Environment facts that cost time before

- Salesforce connection on Saleshandy drops to "Re-connect" (staging `sfemailsent`, `sfreplyreceived`; cause unknown). Reconnect needs QA's SMS code and invalidates the saved Salesforce session; QA re-saves it. Stop and notify QA, do not retry.
- Sender mailbox can fail Gmail login (EAUTH 535) and switch the sequence off. QA reconnects it.
- Real sends are capped per day (`SEND_CAP`, default 40 of 150). The counter may count attempts.
- Saved logins are per account. Production smokes need `npm run login:saleshandy -- emailopenedprod` and `npm run login:salesforce -- emailopenedprod` if the sessions are older than a week.
- List pages use the "All" views (AllContacts, AllOpenLeads, AllAccounts, AllOpportunities); "Recently Viewed" misses records the integration created.
- Mistakes already made are in `knowledge-base/lessons.md`. Read it.

## HubSpot

Older, separate from Salesforce. `automation/context/hubspot/RESUME.md` lists the workflows and their state (it may be stale; check each `*-progress.md`). Company Created is done on staging and production smoke (9 of 9).

## Jira

`npm run jira` starts the one-click sender. Drafts are in `automation/jira/drafts/`. Rules: `automation/jira/CLAUDE.md`. Bugs only after QA says bug-or-not; comments go through chat confirm, not draft files.

## What Cursor lacks

No Claude skills tool, no `playwright-test-*` subagents, no PushNotification. Skills are read as files (see `AGENTS.md`). To reach QA when blocked, run `notify-send "<message>"` and say so in the reply.
