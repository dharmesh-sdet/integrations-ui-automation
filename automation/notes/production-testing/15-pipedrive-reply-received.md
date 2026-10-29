# Reply is Received in Saleshandy (Pipedrive): Smoke scenarios

Approved by QA 2026-10-29. Spec: tests/pipedrive/reply-received-smoke.spec.ts, command: npm run smoke:pipedrive-reply-received.

Environment: Production Saleshandy (my.saleshandy.com), account `emailopenedprod`. The Pipedrive company is saleshandy.pipedrive.com. The workflow ticket is AL-4172. Fixed tickets: AL-4184, AL-4186, AL-4187, AL-4188. It uses only rows that passed on staging (30 of 32 passed on 2026-10-29). 9 checks, 9 sends. The workflow is not on production yet, so QA runs the script after the deploy.

Not covered, still open: the cases where Update a Person, Update a Deal or Delete Deal find no person (known B1 and B2, they end in Error). Also not covered: the `\"` in activity notes, Expected Close Date (not mapped), a real reply from a prospect mailbox (every check uses Mark as replied), and Create a Deal with Update a Deal together (removed by QA, 2026-10-29). If a check ends with two persons, report it to QA. AL-4177 was intermittent on staging, so one clean run does not close it.

If a check fails on production, QA decides if it is a bug. The script writes no Jira draft on its own.

## Test data setup

- Sequence "Pipedrive Reply Received Smoke <date>": one email step, production email accounts, active. A second run the same day reuses it.
- Each check has its own new Mailinator prospect with a unique name and email. The script adds it to the sequence and sends step 1 with Emails tab > row > three dots > Send now. SEND_CAP is 20 a day. Read the sender limits on the Email Accounts page before the run.
- Reply: after step 1 shows Sent, use Emails tab > row > three dots > Mark as replied. Toast "Email has been marked as replied".
- After Mark as replied, wait 15 s and look in Pipedrive first. If the record is missing, poll up to 3 min and hard refresh. Open Logs only after that. An Error in Logs goes to QA and is not marked failed.
- Triggers: only "Reply is Received in Saleshandy" on, only the activities of the check selected, then Save in the modal and on the page. "Email Sent from Saleshandy" and the other triggers must be off. A check stops before its send when it finds one on. Do not run at the same time as another smoke run on `emailopenedprod`.
- Create a Deal and Update a Deal use Pipeline "Pipeline". Prospects with a company use Industry "Retail" unless the check says otherwise.
- The script creates the records a check needs first (person, deals, organization) with realistic values, for example deal titles "Annual renewal" and "Onboarding package". No "Legacy" names.
- Existing Pipedrive records are never edited. No cleanup in Pipedrive after a check (QA, 2026-10-26).

## Gate check (runs first, same command)

Same gate as `09-pipedrive-email-sent.md`. Open the saved session, go to API & Integrations > Integrations > Pipedrive. If the page shows Re-connect, stop, run no checks and notify QA. If connected, compare Contact Fields, Deal Fields and Organisation Fields, map every missing pair, Save, reopen and compare again. When all pairs match after the reload, the gate passes.

## Sequence setup (runs after the gate, same command)

`SMOKE_SEQUENCE_ID=new npm run smoke:pipedrive-reply-received` creates "Pipedrive Reply Received Smoke <date>" with one email step, adds the production email accounts, activates it, prints its id and goes on to the checks. Later runs the same day use `SMOKE_SEQUENCE_ID=<id> npm run smoke:pipedrive-reply-received`. The setup spec `tests/setup/pipedrive-reply-received-smoke-sequence.spec.ts` runs only with `SETUP_SMOKE_SEQUENCE=1`.

## Reply is Received in Saleshandy (Pipedrive)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Create a Lead, Create a Deal and Create a Person selected, prospect not in Pipedrive | Mark as replied | Exactly 1 person named First Last. 1 lead and 1 deal titled First Last, 1 activity | AL-4187 |
| 2 | Create a Person selected, person exists | Mark as replied | Still 1 person, updated. 1 activity of type Email is on the person | AL-4186 |
| 3 | Update a Person selected, person exists | Mark as replied | 1 activity of type Email, done, subject "Reply is Received in Saleshandy". Still 1 person | AL-4186 |
| 4 | Update a Deal selected (Pipeline / Contact Made), person has 2 deals | Mark as replied | Only the newest deal changes: Pipeline / Contact Made. The older deal is unchanged. The new title is recorded, not asserted | AL-4184 |
| 5 | Delete Deal selected, person has 2 deals | Mark as replied | Only the newest deal is deleted. The older deal stays | AL-4184 |
| 6 | Delete Person selected, person exists | Mark as replied | Person is deleted | None |
| 7 | Create Organization selected, prospect has a company and an Industry that is not in the Pipedrive list | Mark as replied | No organization is created. The Logs status is recorded | AL-4188 |
| 8 | Update Organization selected, an organization with the exact company name exists | Mark as replied | Still one organization with that name. The Logs entry is recorded | None |
| 9 | Delete Organization selected, an organization with the exact company name exists | Mark as replied | Organization is deleted | None |
