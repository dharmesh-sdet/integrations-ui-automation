# Conversation Category is Updated in Saleshandy (Zoho): Smoke scenarios

Approved by QA 2026-11-04 ("looks good"). Spec: tests/zoho/conversation-category-updated-smoke.spec.ts, command: npm run smoke:zoho-conversation-category-updated.

Environment: Production Saleshandy (my.saleshandy.com), account `emailopenedprod`. Zoho CRM org crm.zoho.com, read on its own copy of the saved Zoho profile. No workflow ticket is known, so every Ticket cell is None. This is a baseline of every action. It uses only rows that passed on staging (18 of 20, 2026-11-03, `test-cases/zoho/conversation-category-updated.md`). 8 checks, 8 sends. The workflow is not deployed on production yet (QA, 2026-11-04), so QA runs the script after the deploy. The test bodies are the staging test bodies of the same action (`tests/zoho/conversation-category-updated.spec.ts`).

Not covered, still open: the Unified Inbox category row (needs a real reply), the empty-category row, the Trigger OFF row, the Combined five-action row, the Task with an empty Subject row, and the other staging rows that repeat an action. Z-1, Z-5 and Q3 are known, so the Deal rows state the known result. Z-8 and Z-9 are low and known. If a row ends with two records for one prospect, report it to QA and do not file it again.

The script reads no Logs for Zoho (QA rule). If a row fails on production, QA decides if it is a bug. The script writes no Jira draft on its own.

## Test data setup

- Each row uses its own new Mailinator prospect with a unique name and email. The script adds it to the smoke sequence and sends step 1 with Emails tab > row > three dots > Send now. It waits until the row shows Sent. Then it changes the outcome in Sequences > the sequence > Prospects. SEND_CAP is 20 a day for this run.
- After the outcome change, wait 15 s and look in Zoho. If the record is missing, poll up to 3 min with a refresh. Do not open Logs for Zoho. For the row that expects nothing, wait the same 3 min and check that nothing was created.
- The script creates the records a row needs first (contact, deals) in Zoho. They carry the prospect's email and an old value in one mapped field. Existing Zoho records are never edited.
- Triggers: turn on "Conversation Category is Updated in Saleshandy" with only the action of the row and its category. Save in the modal and on the page. Reload the page and read the saved action and category back before the send. Other triggers stay as found. If "Email Sent from Saleshandy" or "Email is Opened in Saleshandy" is on, the script stops before the send. QA turns them off. Do not run at the same time as another smoke run on `emailopenedprod`.
- The sequence has one email step. Zoho can be read only in a headed browser with the saved profile. The run script copies `auth/mcp-zoho-not-email-sent-profile` to `auth/zoho-conversation-category-updated-smoke-profile` the first time and runs the spec through `xvfb-run`. QA logs in only on Saleshandy (`npm run login:saleshandy -- emailopenedprod`).
- No cleanup in Zoho after a row.

## Gate check (runs first, same command)

Open the saved session, go to API & Integrations > Integrations > Zoho. If the page shows Re-connect, stop, run no rows and notify QA. If connected, compare Contact Fields, Lead Fields, Account Fields and Deal Fields, map every missing pair, Save, reopen and compare again. When all pairs match after the reload, the gate passes.

## Sequence setup (runs after the gate, same command)

Create "Zoho Conversation Category Smoke <date>" with one email step. Add a production email account that the Add dialog lists and activate it. A second run the same day reuses it.

## Create/Update a Contact in Zoho

Extra Configuration: category Interested.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Change the outcome to Interested | One contact with the 11 mapped Contact fields. One note "New Outcome Updated: Interested" with the sequence name | None |
| 2 | Prospect not in Zoho | Change the outcome to Not Interested | No contact and no note | None |
| 3 | Contact exists with an old Title | Change the outcome to Interested | Same contact updated with the prospect Title. Still 1 contact | None |

## Create/Update a Lead in Zoho

Extra Configuration: category Not Interested.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 4 | Prospect not in Zoho, has a company | Change the outcome to Not Interested | One lead with the mapped Lead Fields and the prospect company. One note "New Outcome Updated: Not Interested" | None |

## Create/Update Account in Zoho

Extra Configuration: category Out of Office.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 5 | Prospect has a company, no contact, no account | Change the outcome to Out of Office | Account named after the company with the Account Fields values. Not linked to a contact. One note | None |

## Create/Update a Deal in Zoho

Extra Configuration: category Closed, Deal Closing date 0.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 6 | Prospect not in Zoho, has a company | Change the outcome to Closed | One deal named after the prospect, no contact created. Amount is Deal Value, Closing Date empty, Stage Qualification. The deal also creates an account named after the company (Z-5, known). One note | None |
| 7 | Contact exists and has 2 deals | Change the outcome to Closed | Only the newest deal is updated with the mapped fields and gets a note. The older deal is unchanged | None |

## Create a Task in Zoho

Extra Configuration: category Do Not Contact. Subject "Follow up after outcome change", Status Not Started, Priority Normal, Due In 3.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 8 | Prospect not in Zoho | Change the outcome to Do Not Contact | Contact created, then one task linked to it with the 4 values. Due date is today plus 3 days | None |
