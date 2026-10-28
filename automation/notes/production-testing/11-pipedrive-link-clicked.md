# Link is Clicked in Saleshandy (Pipedrive): Smoke scenarios

Approved by QA 2026-10-28. Spec: tests/pipedrive/link-clicked-smoke.spec.ts, command: npm run smoke:pipedrive-link-clicked.

Environment: Production Saleshandy (my.saleshandy.com), account `emailopenedprod`. The Pipedrive company is saleshandy.pipedrive.com. The workflow ticket is AL-4175. No fixed bug needs a check, so this is a baseline of every activity. It comes from the staging regression (`test-cases/pipedrive/link-clicked.md`). It uses only rows that passed on staging (32 of 32, 2026-10-28). 11 checks, 10 sends.

Not covered, still open: the duplicate trigger run that sometimes happens on automated clicks (evidence on AL-4177). If a row ends with two records, report it to QA and do not file it again. Also not covered: known issues B1 and B2. In those, Update a Person, Update a Deal and Delete Deal with no person end in Error. Three more items are not covered. They are the `\"` in activity notes, Expected Close Date (not mapped) and the step 2 link click. The clicked URL in the activity note is not covered either.

If a row fails on production, QA decides if it is a bug. The script writes no Jira draft on its own.

## Test data setup

- Sequence "Pipedrive Link Clicked Smoke <date>": one email step with 2 links, Track link clicks on, custom tracking domain link.saleshandy.com. A second run the same day reuses it.
- Each row uses its own new Mailinator prospect with a unique name and email. The script adds it to the sequence and sends step 1 with Emails tab > row > three dots > Send now. SEND_CAP is 20 a day for this run.
- Production timing: the first click counts 90 s after the send. The second click counts 180 s after the send. Then wait 15 s and look in Pipedrive first. If the record is missing, poll up to 3 min and hard refresh. Open Logs only after that. An Error in Logs goes to QA and is not marked as failed.
- Triggers: only "Link is Clicked in Saleshandy" on, only the activities of the row selected, then Save in the modal and on the page. A link click also counts as an open, so QA makes sure that "Email Opened" and "Email Sent from Saleshandy" are off. Do not run at the same time as another smoke run on `emailopenedprod`.
- Create a Deal and Update a Deal use Pipeline "Pipeline". Prospects with a company that creates an organization use Industry "Retail".
- The script creates the records a row needs first (person, deals, organization). They carry the prospect's email or company name and an old value in one mapped field.
- Existing Pipedrive records are never edited. No cleanup in Pipedrive after a row (QA, 2026-10-26).

## Gate check (runs first, same command)

Same gate as `09-pipedrive-email-sent.md`. Open the saved session, go to API & Integrations > Integrations > Pipedrive. If the page shows Re-connect, stop, run no rows and notify QA. If connected, compare Contact Fields, Deal Fields and Organisation Fields, map every missing pair, Save, reopen and compare again. When all pairs match after the reload, the gate passes.

## Sequence setup (runs after the gate, same command)

Create "Pipedrive Link Clicked Smoke <date>" with one email step that has 2 links. Turn on Track link clicks. Add the production email accounts and activate it.

## Link is Clicked in Saleshandy (Pipedrive)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Create a Lead, Create a Deal and Create a Person selected, prospect not in Pipedrive | Click the first link | Exactly 1 person with 1 lead titled with the prospect email, 1 deal titled with the prospect email and 1 activity | None |
| 2 | Create a Person selected, person exists with an old value in a mapped field | Click the first link | Person updated, still 1 person. A further activity is added | None |
| 3 | Create a Person selected, prospect already clicked the first link | Click the second link, 180 s after the send | A further activity on the same person. Still 1 person | None |
| 4 | Update a Deal selected (Pipeline / Contact Made), person has 2 deals | Click the first link | Only the newest deal changes: title is the prospect email, Pipeline / Contact Made. The older deal is unchanged | None |
| 5 | Update a Person selected, person exists with an old value in a mapped field | Click the first link | Mapped fields updated. 1 activity added | None |
| 6 | Delete Deal selected, person has 2 deals | Click the first link | Only the newest deal is deleted. The older deal stays | None |
| 7 | Delete Person selected, person exists | Click the first link | Person is deleted | None |
| 8 | Create Organization selected, prospect has a company with no organization of that name | Click the first link | One organization named after the company, with the mapped Organisation Fields. Not linked to any person or deal | None |
| 9 | Update Organization selected, an organization with the exact company name exists with an old mapped value | Click the first link | Still one organization with that name. The mapped value is updated | None |
| 10 | Delete Organization selected, an organization with the exact company name exists | Click the first link | Organization is deleted | None |
| 11 | Create a Person selected, prospect not in Pipedrive | Open the step 1 email in Mailinator and do not click | No person and no activity in Pipedrive. If a Logs row exists, it is recorded | None |
