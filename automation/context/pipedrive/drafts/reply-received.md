# Reply is Received in Saleshandy (Pipedrive): Regression scenarios

Environment: Staging. Version v2. No Jira ticket is given for this workflow, so every Ticket cell is None. Expected results come from the rules document of 2026-10-23 and are not yet confirmed in the UI. Rows marked **(proposed, unconfirmed)** have an Expected result that is neither documented nor seen. A different result there is not automatically a failure.

Scope: the action rules are the same in all 7 Pipedrive workflows and were covered row by row in Email Sent (letter case, 1 or 2 deals, wrong mapped types). Here each action runs on its main path, plus what is specific to this trigger.

Lead and deal titles are the prospect's First Last name here. The other workflows use the email. Update a Deal sets the title to the email, so it renames a deal made with the name (decided).

Not covered, still open: B1 (Update a Person with no person errors) and B2 (Update a Deal or Delete Deal with no person errors) are already reported. The rows that hit them expect Error. Do not file them again. The `\"` in activity notes is a known issue, kept by decision. Expected Close Date is not mapped and not tested (QA 2026-10-23, date conversion issue seen on HubSpot).

## Test data setup

- Each row uses a new prospect with its own email, for example `yourname+pipedrive-r1@company.com`, added to an active sequence. Step 1 shows Sent before the reply.
- "Mark the prospect as replied" means Emails tab > the prospect's row > Actions > Mark as Replied (same method as HubSpot and Salesforce).
- After the reply: the Prospects tab shows Replied. Wait 15 s and look in Pipedrive. If the record is missing, wait 5 s, refresh and look again. Open Logs only after that. An Error in Logs is reported to QA, not failed.
- If Saleshandy does not set the prospect to Replied, no event goes to Pipedrive. That is not a workflow failure.
- Triggers: every other trigger off, only "Reply is Received in Saleshandy" on. For each section, select only the actions named in its heading, then Save.
- Records a row needs first (person, deals, organization) are created by hand in Pipedrive.
- Field mappings saved for Contact, Deal and Organisation fields. Deal Fields maps Value only, no Expected Close Date. Pipeline and Stage are read on staging before any row asserts them.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Reply trigger off, every other trigger off, Create a Person selected | Mark the prospect as replied | Prospects tab shows Replied. No person and no activity from this trigger. No new Logs entry for the prospect | None |

## Create a Lead

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Mark the prospect as replied | Person created, named First Last. One lead on it, titled First Last. No activity | None |
| 2 | Prospect already a person in Pipedrive | Mark the prospect as replied | Person updated, still 1 person. New lead on it | None |
| 3 | Prospect has no first or last name | Mark the prospect as replied | Person named (No Name). Lead created on it. Lead title not documented, record it (proposed, unconfirmed) | None |

## Create a Deal

Extra Configuration: Pipeline and Stage as read on staging.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Mark the prospect as replied | Person created. Deal on it titled First Last, in the configured pipeline and stage. No activity. No organization link | None |
| 2 | Person has 1 deal | Mark the prospect as replied | New deal added. Existing deal unchanged | None |

## Create a Person

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Mark the prospect as replied | Person created, 1 person only. Activity: type Email, done, subject "Reply is Received in Saleshandy" | None |
| 2 | Person exists | Mark the prospect as replied | Person updated, still 1 person. A further activity is added | None |

## Update a Deal

Extra Configuration: Pipeline and Stage as read on staging.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person has 2 deals | Mark the prospect as replied | Only the newest deal changes: title is the prospect email, configured pipeline and stage, mapped Value. The older deal is unchanged | None |
| 2 | Person has 1 deal titled with the person's name | Mark the prospect as replied | Deal title changes to the prospect email. Configured pipeline and stage applied. Still 1 deal | None |
| 3 | Prospect not in Pipedrive | Mark the prospect as replied | Run ends in Error (known B2). No person is created | None |

## Update a Person

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person exists with an old value in a mapped field | Mark the prospect as replied | Mapped fields updated. 1 activity added | None |
| 2 | Prospect not in Pipedrive | Mark the prospect as replied | Run ends in Error (known B1). No person is created | None |

## Delete Deal

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person has 2 deals | Mark the prospect as replied | Only the newest deal is deleted. The older deal stays | None |

## Delete Person

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person exists | Mark the prospect as replied | Person is deleted | None |

## Create Organization

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect has a company, no organization with that name | Mark the prospect as replied | Organization named after the company, with the mapped Organisation Fields. Not linked to any person or deal | None |

## Update Organization

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An organization with the exact company name exists with an old mapped value | Mark the prospect as replied | First exact match updated with the name and mapped fields | None |

## Delete Organization

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An organization with the exact company name exists | Mark the prospect as replied | Organization is deleted. A Pipedrive deprecation warning is information only | None |

## Combined actions

Extra Configuration: Pipeline and Stage as read on staging.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Create a Lead, Create a Deal and Create a Person selected, prospect not in Pipedrive | Mark the prospect as replied | Exactly 1 person with 1 lead, 1 deal and 1 activity | None |
