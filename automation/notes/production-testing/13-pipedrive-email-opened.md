# Email is Opened in Saleshandy (Pipedrive): Smoke scenarios

Approved by QA 2026-10-28. Spec: tests/pipedrive/email-opened-smoke.spec.ts, command: npm run smoke:pipedrive-email-opened.

Environment: Production Saleshandy (my.saleshandy.com), account `emailopenedprod`. The Pipedrive company is saleshandy.pipedrive.com. The tracking ticket is AL-4174. No fixed bug needs a check, so this is a baseline of every activity. It uses only rows that passed on staging (26 of 26, 2026-10-28, `test-cases/pipedrive/email-opened.md`). Create a Lead, Create a Deal and Create a Person are one row, as in notes 09 and 10. 9 checks, 9 sends. The test bodies are the staging test bodies of the same activity (`tests/pipedrive/email-opened.spec.ts`), so a row passes or fails on the same assertions.

Not covered, still open: the duplicate trigger run that sometimes happens on automated runs (two persons for one email, evidence on AL-4177). If a row ends with two records, report it to QA and do not file it again. Also not covered: known issues B1 and B2. With no person, Update a Person, Update a Deal and Delete Deal end in Error. Also not covered: the `\"` in activity notes, Expected Close Date (not mapped) and Company to Organization (undecided). The Track email opens off case is not covered, because it needs a second production sequence.

If a row fails on production, QA decides if it is a bug. The script writes no Jira draft on its own.

## Test data setup

- Each row uses its own new Mailinator prospect with a unique name and email. The script adds it to the smoke sequence and sends step 1 with Emails tab > row > three dots > Send now. It waits until the row shows Sent. Then it opens the email in the prospect's Mailinator inbox with images loaded. SEND_CAP is 20 a day for this run.
- Production timing: the first open counts 60 s after the send. A second open counts 120 s after the first. The log shows 1 to 3 minutes after that.
- After the open, wait 15 s and look in Pipedrive. If the record is missing, poll up to 3 min and hard refresh. Open Logs only after that. An Error in Logs goes to QA and is not marked as failed.
- The script creates the records a row needs first (person, deals, organization) in Pipedrive. They carry the prospect's email or company name and an old value in one mapped field. Existing Pipedrive records are never edited.
- Triggers: turn on "Email is Opened in Saleshandy" with only the activities of the row. Save in the modal and on the page. Reload the page and read the saved activities back before the open. Other triggers stay as found. QA makes sure that they are off, because a link click also counts as an open and Email Sent will create the person first. Do not run at the same time as another smoke run on `emailopenedprod`.
- The sequence has Track email opens on and Track link clicks off. The production account has the custom tracking domain link.saleshandy.com.
- Create a Deal and Update a Deal use Pipeline "Pipeline". Prospects with a company that creates an organization use Industry "Retail".
- No cleanup in Pipedrive after a row (QA, 2026-10-26).

## Gate check (runs first, same command)

Same gate as `09-pipedrive-email-sent.md`. Open the saved session, go to API & Integrations > Integrations > Pipedrive. If the page shows Re-connect, stop, run no rows and notify QA. If connected, compare Contact Fields, Deal Fields and Organisation Fields, map every missing pair, Save, reopen and compare again. When all pairs match after the reload, the gate passes.

## Sequence setup (runs after the gate, same command)

Create "Pipedrive Email Opened Smoke <date>" with one email step. Turn Track email opens on and Track link clicks off. Add the production email accounts and activate it. A second run the same day reuses it.

## Create a Lead, Create a Deal and Create a Person in Pipedrive

Extra Configuration: Pipeline = Pipeline, Stage = Qualified (Create a Deal).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | All three selected, prospect not in Pipedrive | Open the email | Exactly 1 person with 1 lead titled with the prospect email, 1 deal titled with the prospect email and 1 done activity | None |

## Create a Person in Pipedrive

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 2 | Person exists, email opened a second time | Open the email, wait 120 s, open it again | Still 1 person. Two done activities of type Email, subject "Email Open Recorded in Saleshandy" | None |

## Update a Person in Pipedrive

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 3 | Person exists with an old value in a mapped field | Open the email | The mapped field shows the prospect's value. One done activity is added | None |

## Update a Deal in Pipedrive

Extra Configuration: Pipeline = Pipeline, Stage = Contact Made.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 4 | Person has 2 deals | Open the email | Only the newest deal changes: title is the prospect email, Pipeline and Stage Contact Made. The older deal is unchanged | None |

## Delete Deal in Pipedrive

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 5 | Person has 2 deals | Open the email | Only the newest deal is deleted. The older deal stays | None |

## Delete Person in Pipedrive

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 6 | Person exists | Open the email | Person is deleted | None |

## Create Organization in Pipedrive

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 7 | Prospect has a company with Industry "Retail", no organization with that name | Open the email | One organization named after the company, with the mapped Organisation Fields. Not linked to any person or deal | None |

## Update Organization in Pipedrive

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 8 | An organization with the exact company name exists with an old mapped value | Open the email | Still one organization with that name. The mapped value is updated | None |

## Delete Organization in Pipedrive

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 9 | An organization with the exact company name exists | Open the email | Organization is deleted | None |
