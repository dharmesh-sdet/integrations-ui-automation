# Reply is Received in Saleshandy (Zoho): Smoke scenarios

Approved by QA 2026-11-03 ("looks good"). Spec: tests/zoho/reply-received-smoke.spec.ts, command: npm run smoke:zoho-reply-received.

Environment: Production Saleshandy (my.saleshandy.com), account `emailopenedprod`, sequence 989765 (given by QA, one email step). Zoho CRM org crm.zoho.com, read on its own copy of the saved Zoho profile. The tracking ticket is AL-4192. The workflow ticket for the fix is AL-4219 (the workflow did not start for a reply). The checks use only rows that passed on staging (22 of 24, 2026-11-03, `test-cases/zoho/reply-received.md`). There are 8 checks and 8 sends. The fix is not deployed on production yet, so QA runs the script after the deploy. The test bodies are the staging test bodies of the same action (`tests/zoho/reply-received.spec.ts`).

Not covered, still open: AL-4217 (Mark as replied button missing on the Emails tab for some users) stays open until its status changes. AL-4198 (Task with an empty Subject) is Done and verified on production through Email Sent, so it is not repeated. AL-4199 and AL-4218 (Email Sent bugs) stay open. Z-5 (a deal creates its own account) and Q3 (Pipeline and Stage cannot be chosen) are known, so the Deal rows state the known result. Also not covered: second reply (the product cannot reply twice), Real reply (no Gmail address), Task with an empty Subject, all 5 actions together, Expected Close Date. If a row ends with two records for one prospect, report it to QA and do not file it again.

The script reads no Logs for Zoho (QA rule). If a row fails on production, QA decides if it is a bug. The script writes no Jira draft on its own.

## Test data setup

- Each row uses its own new Mailinator prospect with a unique name and email. The script adds it to the smoke sequence and sends step 1 with Emails tab > row > three dots > Send now. It waits until the row shows Sent. Then it marks the prospect as replied: Emails tab > row > three dots > Mark as replied. SEND_CAP is 20 a day for this run.
- After the reply, wait 15 s and look in Zoho. If the record is missing, poll up to 3 min with a refresh. Do not open Logs for Zoho.
- The script creates the records a row needs first (contact, deals) in Zoho. They carry the prospect's email and an old value in one mapped field. Existing Zoho records are never edited.
- Triggers: turn on "Reply is Received in Saleshandy" with only the actions of the row. Save in the modal and on the page. Reload the page and read the saved actions back before the reply. Other triggers stay as found. If "Email Sent from Saleshandy" or "Email is Opened in Saleshandy" is on, the script stops before the send. QA turns them off. Do not run at the same time as another smoke run on `emailopenedprod`.
- The sequence has one email step and is active on the production senders. The run script does not create it. If the sequence has no working sender, the send fails and QA fixes the sender.
- Zoho can be read only in a headed browser with the saved profile. The run script copies `auth/mcp-zoho-not-email-sent-profile` to `auth/zoho-reply-received-smoke-profile` the first time and runs the spec through `xvfb-run`. QA logs in only on Saleshandy (`npm run login:saleshandy -- emailopenedprod`).
- No cleanup in Zoho after a row.

## Gate (runs first, same command)

Open the saved session, go to API & Integrations > Integrations > Zoho. If the page shows Re-connect, stop, run no rows and notify QA. If connected, compare Contact Fields, Lead Fields, Account Fields and Deal Fields, map every missing pair, Save, reopen and compare again. When all pairs match after the reload, the gate passes.

## Create/Update a Contact in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Mark the prospect as replied | One contact with the 11 mapped Contact fields. One note | None |
| 2 | Contact with the same email exists, different Title | Mark the prospect as replied | Still 1 contact. Title holds the prospect's value (proposed, unconfirmed) | None |

## Create/Update a Lead in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 3 | Prospect not in Zoho, has a company | Mark the prospect as replied | One lead with the mapped Lead Fields and the prospect company. One note | None |

## Create/Update Account in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 4 | Prospect has a company, no contact, no account | Mark the prospect as replied | Account named after the company with the Account Fields values. Not linked to a contact. One note | None |

## Create/Update a Deal in Zoho

Extra Configuration: Deal Closing date 7.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 5 | Prospect not in Zoho | Mark the prospect as replied | One deal, not linked to a contact. Closing Date is today plus 7 days. A blank account also appears (Z-5, known) | None |
| 6 | Contact has 2 deals, the second made a few minutes after the first | Mark the prospect as replied | Only the newest deal is updated. The older deal is unchanged. No new deal | None |

## Create a Task in Zoho

Extra Configuration: Subject "Follow up after reply", Status Not Started, Priority Normal, Due In 3.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 7 | Prospect not in Zoho | Mark the prospect as replied | Contact created, then one task linked to it with the 4 values. Due date is today plus 3 days | None |

## Combined actions

Extra Configuration: Contact, Deal and Task selected, Deal Closing date 7, Task as in row 7.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 8 | Prospect not in Zoho | Mark the prospect as replied | 1 contact, 1 linked deal, 1 linked task. A note on each | None |
