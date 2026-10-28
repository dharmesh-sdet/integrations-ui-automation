# Email is Opened in Saleshandy (Pipedrive): Regression scenarios

Environment: Staging, account `gpipedrive`, workflow version v2. The workflow ticket is AL-4174. No row has its own ticket, so every Ticket cell is AL-4174. Structure mirrors `test-cases/pipedrive/link-clicked.md` and `test-cases/hubspot/email-opened.md`: same actions, only the trigger changes. Expected results come from the rules document of 2026-10-23 and the HubSpot cases, and are not yet seen in the UI. Rows marked **(proposed, unconfirmed)** have an Expected result that is not documented. A different result there is not a failure by itself.

The trigger has no Extra Configuration on Pipedrive except Pipeline and Stage on the deal actions, so there are no phases. No open-specific rule is documented: the activity carries no open count in the assertions.

Rows say "Open the email" for opening the delivered step 1 email in the prospect's Mailinator inbox with images loaded. This is the only way to fire the trigger.

Not covered, still open: B1 (Update a Person with no person) and B2 (Update a Deal or Delete Deal with no person) are already reported. Rows that hit them expect Error. Do not file them again. The `\"` in activity notes is a known issue, kept by decision. Expected Close Date is not mapped or tested. Company is not mapped to Organization (wrong organization id, bug-or-not undecided). Company Industry is not paired to Industry (Pipedrive's Industry is a picklist). Rows that say "exactly 1 person" can fail on the duplicate-person observation (one event making two persons, seen on Email Sent and Prospect Unsubscribed, bug-or-not undecided).

## Test data setup

- Each row has its own new prospect and email, for example `yourname+pipedrive-o1@mailinator.com`, added to one active sequence "Pipedrive Email Opened QA" on `gpipedrive` (2 steps, one Kartik mailbox that the other Pipedrive sequences do not use). Sequence Settings > Safety Settings > Track email opens is on, Track link clicks is off. Step 1 shows Sent in the Emails tab before the open.
- Open the email: mailinator.com, type the prospect's email, Go, open the sequence email.
- After the open, wait 10 s and refresh Sequences > Emails until the Opened count goes up. Then wait 15 s and look in Pipedrive. If the record is missing, wait 5 s, refresh and look again. Open Logs only after that. An Error in Logs is reported to QA, not failed.
- Triggers: every other trigger off (a link click also counts as an open, and Email Sent would create the person on the step 1 send). Only "Email is Opened in Saleshandy" is on. Each section selects only the actions in its heading, then Save and wait for "Configuration Updated Successfully".
- Records a row needs first (person, deals, organization) are created by hand in Pipedrive with an old value, so a change proves the update.
- Field mappings saved for Contact, Deal and Organisation fields. Deal Fields maps Value only. Pipeline and Stage: Pipeline, Qualified (Contact Made for Update a Deal).

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger off | Enable "Email is Opened in Saleshandy", select Create a Person, click Save | "Configuration Updated Successfully" | AL-4174 |
| 2 | Track email opens off in the sequence, Create a Person selected | Open the email | No Opened count, no run in Logs, no person and no activity | AL-4174 |
| 3 | Create a Person selected, prospect opened the email once and the first run is done | Open the same email a second time | Opened count reaches 2. A second run in Logs. Still 1 person, a second activity (proposed, unconfirmed) | AL-4174 |
| 4 | Only "Reply is Received in Saleshandy" on, with Create a Person | Open the email | Opened count goes up. No person, no activity, no run for the opened workflow | AL-4174 |

## Create a Person

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Open the email | 1 person, named First Last. Activity: email, done, subject "Email Open Recorded in Saleshandy" | AL-4174 |
| 2 | Person exists with an old value in a mapped field | Open the email | Person updated, still 1 person. A further activity is added | AL-4174 |

## Create a Lead

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Open the email | Person created. One lead on it, titled with the prospect email. No activity | AL-4174 |
| 2 | Person exists | Open the email | Person updated, still 1 person. New lead on it | AL-4174 |

## Create a Deal

Extra Configuration: Pipeline = Pipeline, Stage = Qualified.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Open the email | Person created. Deal on it titled with the prospect email, in Pipeline / Qualified, Value from the prospect. No activity, no organization link | AL-4174 |
| 2 | Person has 1 deal | Open the email | New deal added. The existing deal is unchanged | AL-4174 |
| 3 | Person exists, email already opened once | Open the same email a second time | A second deal on the person, one per event (by design) | AL-4174 |

## Update a Person

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person exists with an old value in a mapped field | Open the email | Mapped fields updated. 1 activity added | AL-4174 |
| 2 | Prospect not in Pipedrive | Open the email | Run ends in Error (known B1). No person is created | AL-4174 |

## Update a Deal

Extra Configuration: Pipeline = Pipeline, Stage = Contact Made.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person has 2 deals | Open the email | Only the newest deal changes: title is the prospect email, Pipeline / Contact Made, mapped Value. The older deal is unchanged | AL-4174 |
| 2 | Person exists with no deal | Open the email | Nothing is created or changed | AL-4174 |
| 3 | Prospect not in Pipedrive | Open the email | Run ends in Error (known B2). No person is created | AL-4174 |

## Delete Deal

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person has 2 deals | Open the email | Only the newest deal is deleted. The older deal stays | AL-4174 |
| 2 | Person exists with no deal | Open the email | Nothing is deleted | AL-4174 |

## Delete Person

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person exists | Open the email | Person is deleted | AL-4174 |
| 2 | Prospect not in Pipedrive | Open the email | Nothing happens | AL-4174 |

## Create Organization

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect has a company, no organization with that name | Open the email | Organization named after the company. Not linked to any person or deal | AL-4174 |
| 2 | An organization with that name already exists | Open the email | A second organization with the same name is created (by design) | AL-4174 |

## Update Organization

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An organization with the exact company name exists with an old mapped value | Open the email | First exact match updated with the name and mapped fields | AL-4174 |
| 2 | No organization with that exact name | Open the email | Nothing is created or updated | AL-4174 |

## Delete Organization

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An organization with the exact company name exists | Open the email | Organization is deleted. A Pipedrive deprecation warning is information only | AL-4174 |

## Combined actions

Extra Configuration: Pipeline = Pipeline, Stage = Qualified.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Create a Lead, Create a Deal and Create a Person selected, prospect not in Pipedrive | Open the email | Exactly 1 person with 1 lead, 1 deal and 1 activity | AL-4174 |
| 2 | Create a Person and Update a Person both selected, person exists | Open the email | Still 1 person, 2 activities for the one event | AL-4174 |
