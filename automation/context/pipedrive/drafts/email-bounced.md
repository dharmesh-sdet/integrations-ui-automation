# Email is Bounced in Saleshandy (Pipedrive): Regression scenarios

Environment: Staging. Version v2. No Jira ticket is given for this workflow, so every Ticket cell is None. Expected results come from the rules document of 2026-10-23 and are not yet confirmed in the UI. Rows marked **(proposed, unconfirmed)** have an Expected result that is neither documented nor seen. A different result there is not automatically a failure.

Scope: the action rules are the same in all 7 Pipedrive workflows and were covered row by row in Email Sent (letter case, 1 or 2 deals, wrong mapped types). Here each action runs on its main path, plus what is specific to this trigger.

No bounce-specific rule is documented for Pipedrive: nothing is tagged or flagged on the person besides the activity.

Not covered, still open: B1 (Update a Person with no person errors) and B2 (Update a Deal or Delete Deal with no person errors) are already reported. The rows that hit them expect Error. Do not file them again. The `\"` in activity notes is a known issue, kept by decision. Expected Close Date is not mapped and not tested (QA 2026-10-23, date conversion issue seen on HubSpot).

## Test data setup

- Each row uses a new prospect with its own email, for example `yourname+pipedrive-b1@mailinator.com`, added to an active sequence with Add Prospects.
- "Mark the step 1 email as bounced" means Emails tab > the prospect's row > Actions > Mark as bounced. Send now is not needed (same method as HubSpot). A prospect can be marked as bounced only once.
- Real bounce: one row only, to protect the sender account (cap 1, proposed). The prospect email is `name@<company>.mailinator.com`.
- After the bounce: wait 15 s and look in Pipedrive. If the record is missing, wait 5 s, refresh and look again. Open Logs only after that. An Error in Logs is reported to QA, not failed.
- Triggers: every other trigger off, only "Email is Bounced in Saleshandy" on. For each section, select only the actions named in its heading, then Save.
- Records a row needs first (person, deals, organization) are created by hand in Pipedrive.
- Field mappings saved for Contact, Deal and Organisation fields. Deal Fields maps Value only, no Expected Close Date. Pipeline and Stage are read on staging before any row asserts them.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Real bounce: new prospect at a `<company>.mailinator.com` address, Create a Person selected | Send the step 1 email and wait for Saleshandy to set Bounced | Person created and one activity, same as a manual bounce (proposed, unconfirmed) | None |

## Create a Lead

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Mark the step 1 email as bounced | Person created, named First Last. One lead on it, titled with the prospect email. No activity | None |
| 2 | Prospect already a person in Pipedrive | Mark the step 1 email as bounced | Person updated, still 1 person. New lead on it | None |

## Create a Deal

Extra Configuration: Pipeline and Stage as read on staging.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Mark the step 1 email as bounced | Person created. Deal on it titled with the prospect email, in the configured pipeline and stage. No activity. No organization link | None |
| 2 | Person has 1 deal | Mark the step 1 email as bounced | New deal added. Existing deal unchanged | None |

## Create a Person

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Mark the step 1 email as bounced | Person created, 1 person only. Activity: type email, done, subject "Email is bounced in Saleshandy" | None |
| 2 | Person exists | Mark the step 1 email as bounced | Person updated, still 1 person. A further activity is added | None |

## Update a Deal

Extra Configuration: Pipeline and Stage as read on staging.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person has 2 deals | Mark the step 1 email as bounced | Only the newest deal changes: title is the prospect email, configured pipeline and stage, mapped Value. The older deal is unchanged | None |
| 2 | Prospect not in Pipedrive | Mark the step 1 email as bounced | Run ends in Error (known B2). No person is created | None |

## Update a Person

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person exists with an old value in a mapped field | Mark the step 1 email as bounced | Mapped fields updated. 1 activity added | None |
| 2 | Prospect not in Pipedrive | Mark the step 1 email as bounced | Run ends in Error (known B1). No person is created | None |

## Delete Deal

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person has 2 deals | Mark the step 1 email as bounced | Only the newest deal is deleted. The older deal stays | None |

## Delete Person

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person exists | Mark the step 1 email as bounced | Person is deleted | None |

## Create Organization

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect has a company, no organization with that name | Mark the step 1 email as bounced | Organization named after the company, with the mapped Organisation Fields. Not linked to any person or deal | None |

## Update Organization

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An organization with the exact company name exists with an old mapped value | Mark the step 1 email as bounced | First exact match updated with the name and mapped fields | None |

## Delete Organization

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An organization with the exact company name exists | Mark the step 1 email as bounced | Organization is deleted. A Pipedrive deprecation warning is information only | None |

## Combined actions

Extra Configuration: Pipeline and Stage as read on staging.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Create a Lead, Create a Deal and Create a Person selected, prospect not in Pipedrive | Mark the step 1 email as bounced | Exactly 1 person with 1 lead, 1 deal and 1 activity | None |
