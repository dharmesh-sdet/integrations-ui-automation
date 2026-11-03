# Link is Clicked in Saleshandy (Zoho): Smoke scenarios

Approved by QA 2026-11-03. Spec: tests/zoho/link-clicked-smoke.spec.ts, command: npm run smoke:zoho-link-clicked.

Environment: Production Saleshandy (my.saleshandy.com), account `emailopenedprod`. Zoho CRM org crm.zoho.com, read on its own copy of the saved Zoho profile. The tracking ticket is AL-4194. Jira shows no fixed bug on AL-4194, so this is a baseline of every action. It uses only rows that passed on staging (23 of 23, 2026-11-03, `test-cases/zoho/link-clicked.md`). 8 checks, 8 sends (check 2 clicks twice). The test bodies are the staging test bodies of the same action (`tests/zoho/link-clicked.spec.ts`). The workflow is deployed on production. Result of the run on 2026-11-03: 8 of 8 passed (37.6 min, sequence 988717).

Not covered, still open: AL-4198 (Task with an empty Subject or Due In 0) is Done and verified on production through Email Sent (QA comment, 2026-11-02). The Task modal is shared by all Zoho workflows, so it is not repeated here. AL-4199 and AL-4218 (Email Sent bugs) stay open until their status changes. Z-5 (a deal creates its own account) and Q3 (Pipeline and Stage cannot be chosen) are known, so the Deal row states the known result. Also not covered: Track link clicks off, five actions saved together, Expected Close Date, Custom Workflow and link scanner extra runs (Z-10, noted, not failed). If a row ends with two records for one prospect, report it to QA and do not file it again.

The script reads no Logs for Zoho (QA rule). If a row fails on production, QA decides if it is a bug. The script writes no Jira draft on its own.

## Test data setup

- Each row uses its own new Mailinator prospect with a unique name and email. The script adds it to the smoke sequence and sends step 1 with Emails tab > row > three dots > Send now. It waits until the row shows Sent. Then it opens the email in the prospect's Mailinator inbox and clicks the first link. SEND_CAP is 20 a day for this run.
- Production timing: the first click counts 90 s after the send. A second click counts 180 s after the first.
- After the click, wait 15 s and look in Zoho. If the record is missing, poll up to 3 min with a refresh. Do not open Logs for Zoho.
- The script creates the records a row needs first (contact, deals) in Zoho. They carry the prospect's email and an old value in one mapped field. Existing Zoho records are never edited.
- Triggers: turn on "Link is Clicked in Saleshandy" with only the action of the row. Save in the modal and on the page. Reload the page and read the saved action back before the click. Other triggers stay as found. If "Email Sent from Saleshandy" or "Email is Opened in Saleshandy" is on, the script stops before the send. QA turns them off. Do not run at the same time as another smoke run on `emailopenedprod`.
- The sequence has 2 links in the email, Track link clicks on and Track email opens off. The production account has the custom tracking domain link.saleshandy.com.
- Zoho can be read only in a headed browser with the saved profile. The run script copies `auth/mcp-zoho-not-email-sent-profile` to `auth/zoho-link-clicked-smoke-profile` the first time and runs the spec through `xvfb-run`. QA logs in only on Saleshandy (`npm run login:saleshandy -- emailopenedprod`).
- No cleanup in Zoho after a row.

## Gate check (runs first, same command)

Open the saved session, go to API & Integrations > Integrations > Zoho. If the page shows Re-connect, stop, run no rows and notify QA. If connected, compare Contact Fields, Lead Fields, Account Fields and Deal Fields, map every missing pair, Save, reopen and compare again. When all pairs match after the reload, the gate passes.

## Sequence setup (runs after the gate, same command)

Create "Zoho Link Clicked Smoke <date>" with one email step that has 2 links. Turn Track link clicks on and Track email opens off. Add the production email accounts and activate it. A second run the same day reuses it.

## Create/Update a Contact in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Click the first link | One contact with the 11 mapped Contact fields. One note with Click Count 1 | None |
| 2 | Contact exists, link clicked a second time | Click the first link, wait 180 s, click the second link | Clicked count reaches 2. Still 1 contact. A second note with Click Count 2 | None |
| 3 | Contact exists with an old Title | Click the first link | Same contact updated with the prospect Title. Still 1 contact | None |

## Create/Update a Lead in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 4 | Prospect not in Zoho | Click the first link | One lead with the mapped Lead Fields and the prospect company. One note | None |

## Create/Update Account in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 5 | Prospect has a company, no contact, no account | Click the first link | Account named after the company with the Account Fields values. Not linked to a contact. One note | None |

## Create/Update a Deal in Zoho

Extra Configuration: Deal Closing date 0.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 6 | Prospect not in Zoho, has a company | Click the first link | One deal named after the prospect, no contact created. Amount is Deal Value, Closing Date empty, Stage Qualification. The deal also creates an account named after the company (Z-5, known). One note | None |
| 7 | Contact exists and has 2 deals | Click the first link | Only the newest deal is updated with the mapped fields and gets a note. The older deal is unchanged. Still 1 contact | None |

## Create a Task in Zoho

Extra Configuration: Subject "Follow up after click", Status Not Started, Priority Normal, Due In 3.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 8 | Prospect not in Zoho | Click the first link | Contact created, then one task linked to it with the 4 values. Due date is today plus 3 days | None |
