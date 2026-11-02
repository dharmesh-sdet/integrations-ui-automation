# Sequence Email is Opened in Saleshandy (Zoho): Smoke scenarios

Approved by QA 2026-11-02. Spec: tests/zoho/email-opened-smoke.spec.ts, command: npm run smoke:zoho-email-opened.

Environment: Production Saleshandy (my.saleshandy.com), account `emailopenedprod`. Zoho CRM org crm.zoho.com, read on its own copy of the saved Zoho profile. The tracking ticket is AL-4193. Jira shows no fixed bug on AL-4193 (no children, no links, no comments), so this is a baseline of every action. It uses only rows that passed on staging (24 of 24, 2026-11-02, `test-cases/zoho/email-opened.md`). 7 checks, 7 sends (check 2 opens twice). The test bodies are the staging test bodies of the same action (`tests/zoho/email-opened.spec.ts`).

Not covered, still open: AL-4198, AL-4199 and AL-4218 (Email Sent bugs, status To Do). Z-5 (a deal creates its own account) and Q3 (Pipeline and Stage cannot be chosen) are known, so the Deal row states the known result. Also not covered: Track email opens off (needs a second production sequence), five actions saved together, Expected Close Date and Custom Workflow. If a row ends with two records for one prospect, report it to QA and do not file it again.

The script reads no Logs for Zoho (QA rule). If a row fails on production, QA decides if it is a bug. The script writes no Jira draft on its own.

## Test data setup

- Each row uses its own new Mailinator prospect with a unique name and email. The script adds it to the smoke sequence and sends step 1 with Emails tab > row > three dots > Send now. It waits until the row shows Sent. Then it opens the email in the prospect's Mailinator inbox with images loaded. SEND_CAP is 20 a day for this run.
- Production timing: the first open counts 60 s after the send. A second open counts 120 s after the first.
- After the open, wait 15 s and look in Zoho. If the record is missing, poll up to 3 min with a refresh. Do not open Logs for Zoho.
- The script creates the records a row needs first (contact) in Zoho. They carry the prospect's email and an old value in one mapped field. Existing Zoho records are never edited.
- Triggers: turn on "Sequence Email is Opened in Saleshandy" with only the action of the row. Save in the modal and on the page. Reload the page and read the saved action back before the open. Other triggers stay as found. QA makes sure that they are off, because a link click also counts as an open and Email Sent will create the contact first. Do not run at the same time as another smoke run on `emailopenedprod`.
- The sequence has Track email opens on and Track link clicks off. The production account has the custom tracking domain link.saleshandy.com.
- Zoho can be read only in a headed browser with the saved profile. The run script copies `auth/mcp-zoho-not-email-sent-profile` to `auth/zoho-email-opened-smoke-profile` the first time and runs the spec through `xvfb-run`. QA logs in only on Saleshandy (`npm run login:saleshandy -- emailopenedprod`).
- No cleanup in Zoho after a row.

## Gate check (runs first, same command)

Open the saved session, go to API & Integrations > Integrations > Zoho. If the page shows Re-connect, stop, run no rows and notify QA. If connected, compare Contact Fields, Lead Fields, Account Fields and Deal Fields, map every missing pair, Save, reopen and compare again. When all pairs match after the reload, the gate passes.

## Sequence setup (runs after the gate, same command)

Create "Zoho Email Opened Smoke <date>" with one email step. Turn Track email opens on and Track link clicks off. Add the production email accounts and activate it. A second run the same day reuses it.

## Create/Update a Contact in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Open the email | One contact with the 11 mapped Contact fields. One note with Open Count 1 | None |
| 2 | Contact exists, email opened a second time | Open the email, wait 120 s, open it again | Opened count reaches 2. Still 1 contact. A second note with Open Count 2 | None |
| 3 | Contact exists with an old Title | Open the email | Same contact updated with the prospect Title. Still 1 contact | None |

## Create/Update a Lead in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 4 | Prospect not in Zoho | Open the email | One lead with the mapped Lead Fields and the prospect company. One note | None |

## Create/Update Account in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 5 | Prospect has a company, no contact, no account | Open the email | Account named after the company with the Account Fields values. Not linked to a contact. One note | None |

## Create/Update a Deal in Zoho

Extra Configuration: Deal Closing date 0.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 6 | Prospect not in Zoho, has a company | Open the email | One deal named after the prospect, no contact created. Amount is Deal Value, Closing Date empty, Stage Qualification. The deal also creates an account named after the company (Z-5, known). One note | None |

## Create a Task in Zoho

Extra Configuration: Subject "Follow up after open", Status Not Started, Priority Normal, Due In 3.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 7 | Prospect not in Zoho | Open the email | Contact created, then one task linked to it with the 4 values. Due date is today plus 3 days | None |
