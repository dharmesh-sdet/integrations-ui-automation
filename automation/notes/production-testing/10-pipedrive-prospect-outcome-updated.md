# Prospect Outcome is updated in Saleshandy (Pipedrive): Smoke scenarios

Approved by QA 2026-10-27. Spec: tests/pipedrive/prospect-outcome-updated-smoke.spec.ts, command: npm run smoke:pipedrive-outcome-updated.

Environment: Production Saleshandy (my.saleshandy.com), account `emailopenedprod`. The Pipedrive company is saleshandy.pipedrive.com. No Jira ticket is given and no fixed bug needs a check, so this is a baseline of every activity. It comes from the staging regression (`test-cases/pipedrive/prospect-outcome-updated.md`). It uses only rows that passed on staging, by the script or by QA's hand test (30 of 30, 2026-10-27). 9 checks, 9 sends. The test bodies are the staging test bodies of the same activity (`tests/pipedrive/prospect-outcome-updated.spec.ts`), so a row passes or fails on the same assertions.

Not covered, still open: the duplicate trigger run that sometimes happens on automated runs (two persons for one email, evidence on AL-4177). If a row ends with two records, report it to QA and do not file it again. Also not covered: known issues B1 and B2 (Update a Person, Update a Deal and Delete Deal with no person end in Error). Also not covered: the Update a Deal slot 5 gap (unconfirmed), the category "Meeting Booked" (known Z-7), the `\"` in activity notes and Expected Close Date (not mapped). An outcome set by an email reply, custom outcomes and special characters are not covered either.

If a row fails on production, QA decides if it is a bug. The script writes no Jira draft on its own.

## Test data setup

- Each row uses its own new Mailinator prospect with a unique name and email. The script adds it to the smoke sequence and sends step 1 with Emails tab > row > three dots > Send now. It waits until the row shows Sent. Then it changes the outcome. The prospect starts at "Add Outcome". SEND_CAP is 20 a day for this run.
- The outcome changes in Sequence > the sequence > Prospects, with the outcome dropdown on the prospect's row.
- The script creates the records a row needs first (person, deals, organization) in Pipedrive. They carry the prospect's email or company name and an old value in one mapped field. Existing Pipedrive records are never edited.
- After the change, wait 15 s and look in Pipedrive. If the record is missing, poll up to 3 min and hard refresh. Open Logs only after that. An Error in Logs goes to QA and is not marked as failed.
- Non-matching row: wait 3 min. Check that nothing was created in Pipedrive. A Logs row is allowed and its status is recorded.
- Triggers: turn on "Prospect Outcome is updated in Saleshandy" with only the activities of the row. Set the category in each activity's Extra Configuration, then Save in the modal and on the page. Reload the page and read the saved activities back before the outcome changes. Other triggers stay as found. QA makes sure that "Email Sent from Saleshandy" is off. If it is on, a send creates the person first, so the script stops the row before any send. Do not run at the same time as another smoke run on `emailopenedprod`.
- Create a Deal and Update a Deal use Pipeline "Pipeline". Prospects with a company that creates an organization use Industry "Retail".
- No cleanup in Pipedrive after a row (QA, 2026-10-26).

## Gate check (runs first, same command)

Same gate as `09-pipedrive-email-sent.md`. Open the saved session, go to API & Integrations > Integrations > Pipedrive. If the page shows Re-connect, stop, run no rows and notify QA. If connected, compare Contact Fields, Deal Fields and Organisation Fields, map every missing pair, Save, reopen and compare again. When all pairs match after the reload, the gate passes.

## Sequence setup (runs after the gate, same command)

Create "Pipedrive Outcome Smoke <date>" with one email step. Add the production email accounts and activate it. A second run the same day reuses it.

## Create a Lead, Create a Deal and Create a Person in Pipedrive

Extra Configuration: category = Interested on all three, Pipeline and Stage = Qualified (Create a Deal).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | All three selected, prospect not in Pipedrive | Change the outcome to Interested | Exactly 1 person with 1 lead titled with the prospect email, 1 deal titled with the prospect email and 1 done activity | None |

## Update a Deal in Pipedrive

Extra Configuration: category = Not Now, Pipeline and Stage = Contact Made.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 2 | Person has 2 deals | Change the outcome to Not Now | Only the newest deal changes: title is the prospect email, Pipeline and Stage Contact Made. The older deal is unchanged | None |

## Update a Person in Pipedrive

Extra Configuration: category = Out of Office.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 3 | Person exists with an old value in a mapped field | Change the outcome to Out of Office | The mapped field shows the prospect's value. One done activity is added | None |

## Delete Deal in Pipedrive

Extra Configuration: category = Do Not Contact.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 4 | Person has 2 deals | Change the outcome to Do Not Contact | Only the newest deal is deleted. The older deal stays | None |

## Delete Person in Pipedrive

Extra Configuration: category = Not Interested.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 5 | Person exists | Change the outcome to Not Interested | Person is deleted | None |

## Create Organization in Pipedrive

Extra Configuration: category = Interested.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 6 | Prospect has a company with Industry "Retail", no organization with that name | Change the outcome to Interested | One more organization named after the company, with the mapped Organisation Fields. Not linked to any person or deal | None |

## Update Organization in Pipedrive

Extra Configuration: category = Not Interested.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 7 | An organization with the exact company name exists with an old mapped value | Change the outcome to Not Interested | Still one organization with that name. The mapped value is updated | None |

## Delete Organization in Pipedrive

Extra Configuration: category = Closed.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 8 | An organization with the exact company name exists | Change the outcome to Closed | Organization is deleted | None |

## Create a Person in Pipedrive (outcome not matching)

Extra Configuration: category = Interested.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 9 | Prospect not in Pipedrive | Change the outcome to Not Interested | No person and no activity in Pipedrive. If a Logs row exists, it is recorded | None |
