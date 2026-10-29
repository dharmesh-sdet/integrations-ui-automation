# Prospect is Unsubscribed in Saleshandy (Pipedrive): Smoke scenarios

Approved by QA 2026-10-29. Spec: tests/pipedrive/unsubscribed-smoke.spec.ts, command: npm run smoke:pipedrive-unsubscribed.

Environment: Production Saleshandy (my.saleshandy.com), account `emailopenedprod`. The Pipedrive company is saleshandy.pipedrive.com. The workflow ticket is AL-4176. Fixed tickets: AL-4177, AL-4178, AL-4179, AL-4180, AL-4185. It uses only rows that passed on staging (the 12 bug-retest rows passed on 2026-10-29). 10 checks, 10 sends.

Not covered, still open: the cases where Update a Person, Update a Deal or Delete Deal find no person (known B1 and B2, they end in Error). Also not covered: the `\"` in activity notes, Expected Close Date (not mapped), the second open of the unsubscribe link, and Subscribe here. If a row ends with two records, report it to QA. AL-4177 was intermittent on staging, so one clean run does not close it.

If a row fails on production, QA decides if it is a bug. The script writes no Jira draft on its own.

## Test data setup

- Sequence "Pipedrive Prospect Unsubscribed Smoke <date>": one email step, Sequence Settings > Unsubscribe > "Unsubscribe as Link" saved. A second run the same day reuses it.
- Each row has its own new Mailinator prospect with a unique name and email. The script adds it to the sequence and sends step 1 with Emails tab > row > three dots > Send now. SEND_CAP is 20 a day. Read the sender limits on the Email Accounts page before the run.
- Unsubscribe (link): open the step 1 email in Mailinator, wait 93 s after the send, click "Unsubscribe here". Unsubscribe (UI): Prospects tab, tick the prospect, Mark as Unsubscribe. Checks 1 and 2 use the link. The others use the UI. The HubSpot smoke found that the UI action did not work on production. If it does not fire here, the UI checks stop and QA decides.
- After the unsubscribe, the Prospects tab shows Unsubscribed. Wait 15 s and look in Pipedrive first. If the record is missing, poll up to 3 min and hard refresh. Open Logs only after that. An Error in Logs goes to QA and is not marked as failed.
- Triggers: only "Prospect is Unsubscribed in Saleshandy" on, only the activities of the row selected, then Save in the modal and on the page. Make sure "Email Sent from Saleshandy" and "Email is Opened in Saleshandy" are off. A row stops before its send when it finds one of them on. Do not run at the same time as another smoke run on `emailopenedprod`.
- Create a Deal and Update a Deal use Pipeline "Pipeline". Prospects with a company that creates an organization use Industry "Retail".
- The script creates the records a row needs first (person, deals, organization). They use realistic values, for example deal titles "Annual renewal" and "Onboarding package", and an old value in one mapped field. No "Legacy" names.
- Existing Pipedrive records are never edited. No cleanup in Pipedrive after a row (QA, 2026-10-26).

## Gate check (runs first, same command)

Same gate as `09-pipedrive-email-sent.md`. Open the saved session, go to API & Integrations > Integrations > Pipedrive. If the page shows Re-connect, stop, run no rows and notify QA. If connected, compare Contact Fields, Deal Fields and Organisation Fields, map every missing pair, Save, reopen and compare again. When all pairs match after the reload, the gate passes.

## Sequence setup (runs after the gate, same command)

Create "Pipedrive Prospect Unsubscribed Smoke <date>" with one email step. Turn on Unsubscribe as Link. Add the production email accounts and activate it. The setup spec `tests/setup/pipedrive-unsubscribed-smoke-sequence.spec.ts` runs only with `SETUP_SMOKE_SEQUENCE=1`. It cannot save "Unsubscribe as Link" (no code for it). `SMOKE_SEQUENCE_ID=new npm run smoke:pipedrive-unsubscribed` creates the sequence and stops. QA saves that setting by hand, then runs `SMOKE_SEQUENCE_ID=<id> npm run smoke:pipedrive-unsubscribed`.

## Prospect is Unsubscribed in Saleshandy (Pipedrive)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Create a Lead, Create a Deal and Create a Person selected, prospect not in Pipedrive | Unsubscribe (link) | Prospects tab shows Unsubscribed. Exactly 1 person with 1 lead titled with the prospect email, 1 deal titled with the prospect email and 1 activity | AL-4177, AL-4178 |
| 2 | Create a Lead, Create a Deal and Create a Person selected, person exists with no deal | Unsubscribe (link) | Still 1 person, updated. A new lead and a new deal titled with the prospect email are on the existing person. The run does not end in Error | AL-4178, AL-4179 |
| 3 | Create a Lead, Create a Deal and Create a Person selected, person has 1 deal (Pipeline / Qualified) | Unsubscribe (UI) | Still 1 person. A new deal and a new lead are on the person. The existing deal is unchanged | AL-4180 |
| 4 | Update a Person selected, person exists with an old value in a mapped field | Unsubscribe (UI) | Mapped fields updated. Exactly 1 activity added | AL-4177 |
| 5 | Update a Deal selected (Pipeline / Contact Made), person has 2 deals | Unsubscribe (UI) | Only the newest deal changes: title is the prospect email, Pipeline / Contact Made. The older deal is unchanged. Logs show "Find person's latest deal" | AL-4185 |
| 6 | Delete Deal selected, person has 2 deals | Unsubscribe (UI) | Only the newest deal is deleted. The older deal stays. Logs show "Find person's latest deal" | AL-4185 |
| 7 | Delete Person selected, person exists | Unsubscribe (UI) | Person is deleted | None |
| 8 | Create Organization selected, prospect has a company with no organization of that name | Unsubscribe (UI) | Exactly 1 organization named after the company, with the mapped Organisation Fields. Not linked to any person or deal | None |
| 9 | Update Organization selected, an organization with the exact company name exists with an old mapped value | Unsubscribe (UI) | Still one organization with that name. The mapped value is updated | None |
| 10 | Delete Organization selected, an organization with the exact company name exists | Unsubscribe (UI) | Organization is deleted | None |
