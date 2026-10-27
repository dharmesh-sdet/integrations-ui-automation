# Prospect is Unsubscribed in Saleshandy (Pipedrive): Regression scenarios

Environment: Staging. Version v2. No Jira ticket is given, so every Ticket cell is None. Structure mirrors `test-cases/hubspot/unsubscribed.md`: same trigger, same two ways to unsubscribe, only the platform and its actions change. Expected results come from the rules document of 2026-10-23 and the HubSpot cases, and are not yet confirmed in the UI. Rows marked **(proposed, unconfirmed)** have an Expected result that is neither documented nor seen. A different result there is not automatically a failure.

The trigger has no Extra Configuration on Pipedrive except Pipeline and Stage on the deal actions, so there are no phases. No unsubscribe-specific rule is documented: nothing is tagged on the person besides the activity.

Rows say "Unsubscribe (UI)" for the Mark as Unsubscribe action on the Prospects tab, and "Unsubscribe (link)" for the real link in the delivered email. Link rows are limited to 5, to save sends and Mailinator time. All other rows use the UI.

Not covered, still open: B1 (Update a Person with no person) and B2 (Update a Deal or Delete Deal with no person) are already reported. Rows that hit them expect Error. Do not file them again. The `\"` in activity notes is a known issue, kept by decision. Expected Close Date is not mapped or tested.

## Test data setup

- Each row has its own new prospect and email, for example `yourname+pipedrive-u1@mailinator.com`, added to one active sequence. Step 1 shows Sent before the unsubscribe. Sequence Settings > Unsubscribe > "Unsubscribe as Link" is saved for the link rows.
- Before the first row, read the node names in one run log. v2 shows "Find person's latest deal" and "Person - Find a person". v1 shows "Find a deal" and "Create a person". A v1 result is a setup gap, not a v2 bug.
- Unsubscribe (UI): Prospects tab, tick the prospect, toolbar icon Mark as Unsubscribe (no confirm dialog). Unsubscribe (link): open the unsubscribe link in the prospect's Mailinator inbox, LINKS tab. The page says "You will no longer receive emails from us".
- Every row also shows "Unsubscribed" on the Prospects tab.
- After the unsubscribe, wait 15 s and look in Pipedrive. If the record is missing, wait 5 s, refresh and look again. Open Logs only after that. An Error in Logs is reported to QA, not failed.
- Triggers: every other trigger off, only "Prospect is Unsubscribed in Saleshandy" on. Each section selects only the actions in its heading, then Save and wait for "Configuration Updated Successfully".
- Records a row needs first (person, deals, organization) are created by hand in Pipedrive with an old value, so a change proves the update.
- Field mappings saved for Contact, Deal and Organisation fields. Deal Fields maps Value only. Pipeline and Stage: Pipeline, Qualified (Contact Made for Update a Deal).

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger off | Enable "Prospect is Unsubscribed in Saleshandy", select Create a Person, click Save | "Configuration Updated Successfully" | None |
| 2 | Unsubscribe (link), Create a Person, prospect not in Pipedrive | Add prospect, open the unsubscribe link from Mailinator | Page says "You will no longer receive emails from us" with "Subscribe here". Prospects tab Unsubscribed. Person created and one activity (proposed, unconfirmed) | None |
| 3 | Same link opened a second time | Open the same link again | No second person. A second activity may be added (proposed, unconfirmed) | None |
| 4 | Prospect unsubscribed by link | Click "Subscribe here" | Page says "You have successfully subscribed and added to our list for future communication". Prospects tab shows the previous status. No new activity (proposed, unconfirmed) | None |
| 5 | Prospect unsubscribed by Unsubscribe (UI) | Tick the prospect, Mark as Resume, Apply changes | Prospect stays Unsubscribed. Toast "Prospect(s) status updated successfully" | None |

## Create a Person

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Unsubscribe (UI) | 1 person, named First Last. Activity: email, done, subject "Prospect is Unsubscribed in Saleshandy" | None |
| 2 | Person exists with an old value in a mapped field | Unsubscribe (UI) | Person updated, still 1 person. A further activity is added | None |

## Create a Lead

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Unsubscribe (UI) | Person created. One lead on it, titled with the prospect email. No activity | None |
| 2 | Person exists | Unsubscribe (UI) | Person updated, still 1 person. New lead on it | None |

## Create a Deal

Extra Configuration: Pipeline = Pipeline, Stage = Qualified.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Unsubscribe (UI) | Person created. Deal on it titled with the prospect email, in Pipeline / Qualified, Value from the prospect. No activity, no organization link | None |
| 2 | Person has 1 deal | Unsubscribe (UI) | New deal added. The existing deal is unchanged | None |
| 3 | Person exists, no deal, real link | Unsubscribe (link) | Deal created on the person, same as row 1 | None |

## Update a Person

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person exists with an old value in a mapped field | Unsubscribe (UI) | Mapped fields updated. 1 activity added | None |
| 2 | Prospect not in Pipedrive | Unsubscribe (UI) | Run ends in Error (known B1). No person is created | None |
| 3 | Person exists with an old value, real link | Unsubscribe (link) | Mapped fields updated, same as row 1 | None |

## Update a Deal

Extra Configuration: Pipeline = Pipeline, Stage = Contact Made.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person has 2 deals | Unsubscribe (UI) | Only the newest deal changes: title is the prospect email, Pipeline / Contact Made, mapped Value. The older deal is unchanged | None |
| 2 | Person exists with no deal | Unsubscribe (UI) | Nothing is created or changed | None |
| 3 | Prospect not in Pipedrive | Unsubscribe (UI) | Run ends in Error (known B2). No person is created | None |

## Delete Deal

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person has 2 deals | Unsubscribe (UI) | Only the newest deal is deleted. The older deal stays | None |
| 2 | Person exists with no deal | Unsubscribe (UI) | Nothing is deleted | None |

## Delete Person

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person exists | Unsubscribe (UI) | Person is deleted | None |
| 2 | Prospect not in Pipedrive | Unsubscribe (UI) | Nothing happens | None |

## Create Organization

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect has a company, no organization with that name | Unsubscribe (UI) | Organization named after the company, with the mapped Organisation Fields. Not linked to any person or deal | None |
| 2 | An organization with that name already exists | Unsubscribe (UI) | A second organization with the same name is created (by design) | None |

## Update Organization

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An organization with the exact company name exists with an old mapped value | Unsubscribe (UI) | First exact match updated with the name and mapped fields | None |
| 2 | No organization with that exact name | Unsubscribe (UI) | Nothing is created or updated | None |

## Delete Organization

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An organization with the exact company name exists | Unsubscribe (UI) | Organization is deleted. A Pipedrive deprecation warning is information only | None |

## Combined actions

Extra Configuration: Pipeline = Pipeline, Stage = Qualified.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Create a Lead, Create a Deal and Create a Person selected, prospect not in Pipedrive | Unsubscribe (UI) | Exactly 1 person with 1 lead, 1 deal and 1 activity | None |
| 2 | Create a Person and Update a Person both selected, person exists | Unsubscribe (UI) | Still 1 person, 2 activities for the one event | None |
