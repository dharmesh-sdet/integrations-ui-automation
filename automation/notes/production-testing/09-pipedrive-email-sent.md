# Email Sent from Saleshandy (Pipedrive): Smoke scenarios

Approved by QA 2026-10-27 (rows 1 to 3 of the first draft merged into one row, rows renumbered). Spec: tests/pipedrive/email-sent-smoke.spec.ts, command: npm run smoke:pipedrive-email-sent.

Environment: Production Saleshandy (my.saleshandy.com), account `emailopenedprod`. The Pipedrive company is saleshandy.pipedrive.com, the same one the staging account uses (QA, 2026-10-27). No Jira ticket is given and no fixed bug needs a check. The file is a baseline of every activity. It comes from the Email Sent staging regression (`test-cases/pipedrive/email-sent.md`), and only from rows that passed on staging (33 passed, 2026-10-27). Create a Lead, Create a Deal and Create a Person are one row, because staging covered them one by one and together (QA, 2026-10-27).

Not covered, still open: the duplicate trigger run that sometimes happens on automated sends (two executions for one send, then two persons or two organizations). QA's hand runs do not repeat it, so it is not a confirmed bug. The evidence is on AL-4177. If a row ends with two records, report it to QA and do not file it again. Also not covered: known issues B1 and B2 (Update a Person, Update a Deal and Delete Deal with no person end in Error), the `\"` in activity notes, Expected Close Date (not mapped) and the wrong-type case of Contact Fields (skipped on staging).

## Test data setup

- Each row uses its own new Mailinator prospect with a unique name and email. The script adds it to the smoke sequence. Then it uses Emails tab > row > three dots > Send now on step 1. The run sends 8 emails. The sequence has one email step. SEND_CAP is 20 a day for this run (QA, 2026-10-27).
- Records a row needs first (deals, person, organization) are created by hand in Pipedrive with the prospect's email or company name.
- Look in Pipedrive: after the Emails tab row shows Sent, wait 15 s, then look in Pipedrive. If the record is missing, open Logs. An Error in Logs goes to QA and is not marked as failed.
- Triggers: only "Email Sent from Saleshandy" on, only the activities of the row selected, then Save in the modal and on the page. Other triggers on this account stay as they are (KEEP_OTHER_TRIGGERS=1), so QA confirms they are off.
- Create a Deal and Update a Deal use Pipeline "Pipeline" and Stage "Qualified" or "Contact Made" (the company has one pipeline). Prospects with a company that creates an organization use Industry "Retail", one of the 20 Industry options of the picklist (`context/pipedrive/organization-industry-list.md`).
- No cleanup in Pipedrive after a row (QA, 2026-10-26). The script creates nothing that needs cleanup on the production side.

## Gate check (runs first, same command)

- Open the saved Saleshandy session, go to API & Integrations > Integrations > Pipedrive.
- If the page shows no Disconnect button (the list shows Re-connect): stop, no rows run, QA is notified to reconnect.
- If connected: open Contact Fields, Deal Fields and Organisation Fields. Map every pair listed in the spec that is missing or different, Save, reopen the card and read the pairs again. The gate passes only when all pairs match after the reload. Any leftover difference stops the run and is listed in the report.

## Sequence setup (runs after the gate, same command)

- Create a new sequence "Pipedrive Email Sent Smoke <date>" with one email step.
- Settings > Email Account > add the production email accounts, then activate the sequence.
- Run again the same day: the same sequence is reused.

## Create a Lead, Create a Deal and Create a Person in Pipedrive

Extra Configuration: Pipeline and Stage = Qualified (Create a Deal).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Create a Lead, Create a Deal and Create a Person selected, prospect not in Pipedrive | Send now on step 1 | Exactly 1 person with 1 lead titled with the prospect email, 1 deal titled with the prospect email and 1 done activity | None |

## Update a Deal in Pipedrive

Extra Configuration: Pipeline and Stage = Contact Made.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 2 | Person has 2 deals | Send now on step 1 | Only the newest deal changes: title is the prospect email, Pipeline and Stage Contact Made. The older deal is unchanged | None |

## Update a Person in Pipedrive

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 3 | Person exists | Send now on step 1 | One done activity "Email sent from Saleshandy" is added. The note is recorded (it must not hold the email body). The person details are recorded | None |

## Delete Deal in Pipedrive

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 4 | Person has 2 deals | Send now on step 1 | Only the newest deal is deleted. The older deal stays | None |

## Delete Person in Pipedrive

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 5 | Person exists | Send now on step 1 | Person is deleted | None |

## Create Organization in Pipedrive

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 6 | Prospect has a company with Industry "Retail", no organization with that name | Send now on step 1 | One more organization named after the company. Not linked to any person | None |

## Update Organization in Pipedrive

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 7 | An organization with the exact company name exists | Send now on step 1 | Still one organization with that name, none added. The Logs entry is recorded | None |

## Delete Organization in Pipedrive

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 8 | An organization with the exact company name exists | Send now on step 1 | Organization is deleted | None |
