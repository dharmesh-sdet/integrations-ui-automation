# Email is Bounced in Saleshandy (Pipedrive): Smoke scenarios

Approved by QA 2026-10-28. Spec: tests/pipedrive/email-bounced-smoke.spec.ts, command: npm run smoke:pipedrive-email-bounced.

Environment: Production Saleshandy (my.saleshandy.com), account `emailopenedprod`. The Pipedrive company is saleshandy.pipedrive.com. The workflow ticket is AL-4183. No fixed bug needs a check, so this is a baseline of every activity. It comes from the staging regression (`test-cases/pipedrive/email-bounced.md`). It uses only rows that passed on staging (37 of 37, 2026-10-28). 11 checks, 1 send.

Not covered, still open: known issues B1 and B2. In those, Update a Person with no person, Update a Deal with no person and Delete Deal with no person end in Error. Also not covered: the `\"` in activity notes, Expected Close Date (not mapped), the Combined actions rows, the Trigger screen rows and the paused sequence row. If a row ends in Error in Logs, it goes to QA and is not marked as failed.

If a row fails on production, QA decides if it is a bug. The script writes no Jira draft on its own.

## Test data setup

- Sequence "Pipedrive Email Bounced Smoke <date>": one email step, Active, at least one production sender with room in its daily limit. A second run the same day reuses it.
- Each row uses its own new Mailinator prospect with a unique name and email. The script adds it to the sequence and marks the step 1 email as bounced: Emails tab > row > Actions > Mark as bounced. Send now is not needed. A prospect can be marked only once.
- Check 11 is the only send. It uses a real-bounce address (`name@<company>.mailinator.com`) and Send now on step 1. Saleshandy then sets Bounced on its own.
- Production timing: after the bounce, wait 15 s and look in Pipedrive first. If the record is missing, poll up to 3 min and hard refresh. Open Logs only after that. An Error in Logs goes to QA and is not marked as failed.
- Triggers: only "Email is Bounced in Saleshandy" on, only the activities of the row selected, then Save in the modal and on the page. Do not run at the same time as another smoke run on `emailopenedprod`.
- Create a Deal and Update a Deal use Pipeline "Pipeline". Prospects with a company that creates an organization use Industry "Retail".
- The script creates the records a row needs first (person, deals, organization). They carry the prospect's email or company name and an old value in one mapped field.
- Existing Pipedrive records are never edited. No cleanup in Pipedrive after a row (QA, 2026-10-26).

## Gate check (runs first, same command)

Same gate as `09-pipedrive-email-sent.md`. Open the saved session, go to API & Integrations > Integrations > Pipedrive. If the page shows Re-connect, stop, run no rows and notify QA. If connected, compare Contact Fields, Deal Fields and Organisation Fields, map every missing pair, Save, reopen and compare again. When all pairs match after the reload, the gate passes.

## Sequence setup (runs after the gate, same command)

Create "Pipedrive Email Bounced Smoke <date>" with one email step. Add the production email accounts and activate it.

## Email is Bounced in Saleshandy (Pipedrive)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Create a Lead, Create a Deal and Create a Person selected, prospect not in Pipedrive | Mark the step 1 email as bounced | Exactly 1 person with 1 lead titled with the prospect email, 1 deal titled with the prospect email and 1 activity | None |
| 2 | Create a Person selected, person exists with an old value in a mapped field | Mark the step 1 email as bounced | Person updated, still 1 person. A further activity is added | None |
| 3 | Update a Person selected, person exists with an old value in a mapped field | Mark the step 1 email as bounced | Mapped fields updated. 1 activity added | None |
| 4 | Update a Deal selected (Pipeline / Contact Made), person has 2 deals | Mark the step 1 email as bounced | Only the newest deal changes: title is the prospect email, Pipeline / Contact Made. The older deal is unchanged | None |
| 5 | Delete Deal selected, person has 2 deals | Mark the step 1 email as bounced | Only the newest deal is deleted. The older deal stays | None |
| 6 | Delete Person selected, person exists | Mark the step 1 email as bounced | Person is deleted | None |
| 7 | Create Organization selected, prospect has a company with no organization of that name | Mark the step 1 email as bounced | One organization named after the company, with the mapped Organisation Fields. Not linked to any person or deal | None |
| 8 | Update Organization selected, an organization with the exact company name exists with an old mapped value | Mark the step 1 email as bounced | Still one organization with that name. The mapped value is updated | None |
| 9 | Delete Organization selected, an organization with the exact company name exists | Mark the step 1 email as bounced | Organization is deleted | None |
| 10 | Only "Reply is Received in Saleshandy" enabled, prospect not in Pipedrive | Mark the step 1 email as bounced | No person created in Pipedrive. If a Logs row exists, it is recorded | None |
| 11 | Create a Person selected, real-bounce address, prospect not in Pipedrive | Send the step 1 email with Send now and wait for Saleshandy to set Bounced | Emails tab shows Bounced. 1 person and 1 activity: type email, done, subject "Email is bounced in Saleshandy" | None |
