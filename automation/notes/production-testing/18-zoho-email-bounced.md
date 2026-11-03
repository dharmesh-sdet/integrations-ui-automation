# Email is Bounced in Saleshandy (Zoho): Smoke scenarios

Approved by QA 2026-11-03 ("go with defaults"). Spec: tests/zoho/email-bounced-smoke.spec.ts, command: npm run smoke:zoho-email-bounced.

Environment: Production Saleshandy (my.saleshandy.com), account `emailopenedprod`. Zoho CRM org crm.zoho.com, read on its own copy of the saved Zoho profile. The tracking ticket is AL-4195. Jira shows no fixed bug on AL-4195 (Jira was unreachable on 2026-11-03, QA confirmed the ticket key), so this is a baseline of every action. It uses only rows that passed on staging (22 of 22, 2026-11-03, `test-cases/zoho/email-bounced.md`). 8 rows, 1 send (row 8). The workflow is deployed on production (QA, 2026-11-03).

Not covered, still open: AL-4198 (Task with an empty Subject) is Done and confirmed on production through Email Sent (QA comment, 2026-11-02). The Task modal is shared by all Zoho workflows, so it is not repeated here. AL-4199 and AL-4218 (Email Sent bugs) stay open until their status changes. Z-5 (a deal creates its own account) and Q3 (Pipeline and Stage cannot be chosen) are known, so the Deal row states the known result. Z-1 and Z-6 are not tested, and the Bounced tag is not tested because QA did not find it in Zoho CRM. Also not covered: Trigger OFF, five actions saved together (Combined 1), Expected Close Date, Custom Workflow. If a row ends with two records for one prospect, report it to QA and do not file it again.

The script reads no Logs for Zoho (QA rule). If a row fails on production, QA decides if it is a bug. The script writes no Jira draft on its own.

## Test data setup

- Each row uses its own new Mailinator prospect with a unique name and email. Rows 1 to 7 add the prospect to the smoke sequence and mark the step 1 email as bounced: Emails tab > row > Actions > Mark as bounced. They send no email. A prospect can be marked only once.
- Row 8 is the only send. It uses a real-bounce address (`name@<company>.mailinator.com`) and Send now on step 1. Saleshandy then sets Bounced on its own, up to 5 minutes after the send. SEND_CAP is 20 a day for this run.
- After the bounce, wait 15 s and look in Zoho. If the record is missing, poll up to 3 min with a refresh (production shows the result 1 to 3 minutes after the bounce). Do not open Logs for Zoho.
- The script creates the records a row needs first (contact, deals) in Zoho. They carry the prospect's email and an old value in one mapped field. Existing Zoho records are never edited.
- Triggers: turn on "Email is Bounced in Saleshandy" with only the action of the row. Save in the modal and on the page. Reload the page and read the saved action back before the bounce. Other triggers stay as found. If "Email Sent from Saleshandy" is on, the script stops before the bounce. QA turns it off. Do not run at the same time as another smoke run on `emailopenedprod`.
- The sequence has one email step and is active on the production senders.
- Zoho can be read only in a headed browser with the saved profile. The run script copies `auth/mcp-zoho-not-email-sent-profile` to `auth/zoho-email-bounced-smoke-profile` the first time and runs the spec through `xvfb-run`. QA logs in only on Saleshandy (`npm run login:saleshandy -- emailopenedprod`).
- No cleanup in Zoho after a row.

## Gate (runs first, same command)

Open the saved session, go to API & Integrations > Integrations > Zoho. If the page shows Re-connect, stop, run no rows and notify QA. If connected, compare Contact Fields, Lead Fields, Account Fields and Deal Fields, map every missing pair, Save, reopen and compare again. When all pairs match after the reload, the gate passes.

## Sequence setup (runs after the gate, same command)

Create "Zoho Email Bounced Smoke <date>" with one email step. Add the production email accounts and activate it. A second run the same day reuses it.

## Create/Update a Contact in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Mark the step 1 email as bounced | One contact with the 11 mapped Contact fields. One note "Saleshandy Email is Bounced" | None |
| 2 | Contact exists with an old Title | Mark the step 1 email as bounced | Same contact updated with the prospect Title. Still 1 contact | None |

## Create/Update a Lead in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 3 | Prospect not in Zoho | Mark the step 1 email as bounced | One lead with the mapped Lead Fields and the prospect company. One note | None |

## Create/Update Account in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 4 | Prospect has a company, no contact, no account | Mark the step 1 email as bounced | Account named after the company with the Account Fields values. Not linked to a contact. One note | None |

## Create/Update a Deal in Zoho

Extra Configuration: Deal Closing date 0.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 5 | Contact exists and has 2 deals | Mark the step 1 email as bounced | Only the newest deal is updated with the mapped fields and gets a note. The older deal is unchanged | None |
| 6 | Prospect not in Zoho, has a company | Mark the step 1 email as bounced | One deal named after the prospect, no contact created. Amount is Deal Value, Closing Date empty, Stage Qualification. The deal also creates an account named after the company (Z-5, known). One note | None |

## Create a Task in Zoho

Extra Configuration: Subject "Follow up after bounce", Status Not Started, Priority Normal, Due In 3.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 7 | Prospect not in Zoho | Mark the step 1 email as bounced | Contact created, then one task linked to it with the 4 values. Due date is today plus 3 days | None |

## Real bounce

Extra Configuration: None. Create/Update a Contact selected.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 8 | Real-bounce address, prospect not in Zoho | Send the step 1 email with Send now and wait for Saleshandy to set Bounced | Emails tab shows Bounced. One contact and one note "Saleshandy Email is Bounced" | None |
