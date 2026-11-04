# Prospect is Unsubscribed in Saleshandy (Zoho): Smoke scenarios

Approved by QA 2026-11-04 ("go with the defaults"). Spec: tests/zoho/prospect-unsubscribed-smoke.spec.ts, command: npm run smoke:zoho-prospect-unsubscribed.

Environment: Production Saleshandy (my.saleshandy.com), account `emailopenedprod`, sequence 990987 (given by QA 2026-11-04, step 2 added by the setup spec). Zoho CRM org crm.zoho.com, read on its own copy of the saved Zoho profile. The workflow is deployed on production (QA, 2026-11-04). No workflow ticket is known, so every Ticket cell is None. This is a baseline of every action. It uses only rows that passed on staging (19 of 19 at least once, 2026-11-04, `test-cases/zoho/prospect-unsubscribed.md`). 8 checks, 8 sends. The test bodies are the staging test bodies of the same action (`tests/zoho/prospect-unsubscribed.spec.ts`).

Not covered, still open: the second open of the unsubscribe link, Subscribe here, the Trigger OFF row, the page-reload row, the Lead rows for an existing lead and for no company, the Task with an empty Subject (AL-4198, Done and verified on production through Email Sent), the Combined row beyond the five actions, and the tag (it was never seen in a record text on staging, so no check asserts it). Z-1, Z-5, Z-6 and Q3 are known, so the Deal rows state the known result. If a row ends with two records for one prospect, report it to QA and do not file it again.

The script reads no Logs for Zoho (QA rule). If a row fails on production, QA decides if it is a bug. The script writes no Jira draft on its own.

## Test data setup

- Each row uses its own new Mailinator prospect with a unique name and email. The script adds it to the sequence and sends step 1 with Emails tab > row > three dots > Send now. It waits until the row shows Sent. SEND_CAP is 20 a day for this run.
- Unsubscribe (link), check 1 only: open the step 1 email in Mailinator, wait 93 s after the send, click "Unsubscribe here". A click sooner after the send was not counted on staging (2026-11-04). The Prospects tab then shows Unsubscribed, polled every 10 s for up to 3 min.
- Unsubscribe (UI), checks 2 to 8: Prospects tab, tick the prospect, Mark as Unsubscribe.
- After the unsubscribe, wait 15 s and look in Zoho. If the record is missing, poll up to 3 min with a refresh. Do not open Logs for Zoho.
- The script creates the records a row needs first (contact, deals) in Zoho. They carry the prospect's email and an old value in one mapped field. Existing Zoho records are never edited.
- Triggers: turn on "Prospect is Unsubscribed in Saleshandy" with only the actions of the row. Save in the modal and on the page. Reload the page and read the saved actions back before the unsubscribe. Other triggers stay as found. If "Email Sent from Saleshandy" or "Email is Opened in Saleshandy" is on, the script stops before the send. QA turns them off. Do not run at the same time as another smoke run on `emailopenedprod`.
- The sequence has 2 steps (a one-step sequence turns a prospect Completed and the link does not register) and "Unsubscribe as Link" saved. The setup spec `tests/setup/zoho-prospect-unsubscribed-smoke-sequence.spec.ts` adds step 2 and saves that setting. It runs only with `SETUP_SMOKE_SEQUENCE=1`. The run script does not create the sequence. If the sequence has no working sender, the send fails and QA fixes the sender.
- Zoho can be read only in a headed browser with the saved profile. The run script copies `auth/mcp-zoho-not-email-sent-profile` to `auth/zoho-prospect-unsubscribed-smoke-profile` the first time and runs the spec through `xvfb-run`. QA logs in only on Saleshandy (`npm run login:saleshandy -- emailopenedprod`).
- No cleanup in Zoho after a row.

## Gate (runs first, same command)

Open the saved session, go to API & Integrations > Integrations > Zoho. If the page shows Re-connect, stop, run no rows and notify QA. If connected, compare Contact Fields, Lead Fields, Account Fields and Deal Fields, map every missing pair, Save, reopen and compare again. When all pairs match after the reload, the gate passes.

## Create/Update a Contact in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Unsubscribe (link) | Page says "You will no longer receive emails from us". Prospects tab shows Unsubscribed. 1 contact with the 11 mapped Contact fields. One note | None |
| 2 | Contact exists with an old Title | Unsubscribe (UI) | Same contact updated with the prospect Title. Still 1 contact | None |

## Create/Update a Lead in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 3 | Prospect not in Zoho | Unsubscribe (UI) | 1 lead with the mapped Lead Fields and the company. One note. 0 contacts with the email | None |

## Create/Update Account in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 4 | Prospect has a company, no contact, no account | Unsubscribe (UI) | Account named after the company with the Account Fields values. Not linked to a contact. One note | None |

## Create/Update a Deal in Zoho

Extra Configuration: Deal Closing date 0.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 5 | Prospect not in Zoho | Unsubscribe (UI) | One deal named after the prospect, not linked to a contact. An account named after the company also appears (Z-5, known) | None |
| 6 | Contact has 2 deals, the second made a minute after the first | Unsubscribe (UI) | Only the newest deal is updated. The older deal is unchanged. No new deal | None |

## Create a Task in Zoho

Extra Configuration: Subject "Follow up after unsubscribe", Status Not Started, Priority Normal, Due In 3.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 7 | Prospect not in Zoho | Unsubscribe (UI) | Contact created, then one task linked to it with the 4 values. Due date is today plus 3 days | None |

## Combined actions

Extra Configuration: Task as in row 7, Deal Closing date 0.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 8 | Contact, Lead, Account, Deal and Task selected, prospect not in Zoho | Unsubscribe (UI) | 1 contact, with 1 lead, 1 deal and 1 task for it. A note on the contact. Accounts as Z-5 allows | None |
