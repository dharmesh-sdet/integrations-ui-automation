# Link is Clicked in Saleshandy (Pipedrive): Regression scenarios

Environment: Staging. Version v2. No Jira ticket is given for this workflow, so every Ticket cell is None. Expected results come from the rules document of 2026-10-23 and are not yet confirmed in the UI. Rows marked **(proposed, unconfirmed)** have an Expected result that is neither documented nor seen. A different result there is not automatically a failure.

Scope: the action rules are the same in all 7 Pipedrive workflows and were covered row by row in Email Sent (letter case, 1 or 2 deals, wrong mapped types). Here each action runs on its main path, plus what is specific to this trigger.

Not covered, still open: B1 (Update a Person with no person errors) and B2 (Update a Deal or Delete Deal with no person errors) are already reported. The rows that hit them expect Error. Do not file them again. The `\"` in activity notes is a known issue, kept by decision. Expected Close Date is not mapped and not tested (QA 2026-10-23, date conversion issue seen on HubSpot).

## Test data setup

- Each row uses a new prospect with its own email, for example `yourname+pipedrive-c1@company.com`, added to an active sequence. Sequence Settings > Safety Settings > Track Link Clicks on. Each email body has 2 links.
- "Click the first link" means: step 1 shows Sent in the Emails tab, open the prospect's inbox on mailinator.com, open the sequence email and click its first link right away (same method as HubSpot).
- After the click: it takes up to 1.5 minutes to register. Refresh Sequences > Emails until the clicked count goes up, then wait 15 s and look in Pipedrive. If the record is missing, wait 5 s, refresh and look again. Open Logs only after that. An Error in Logs is reported to QA, not failed.
- One real click can give 2 or 3 runs (link scanners and previews click too). That is Saleshandy event behavior, not a workflow bug. Count the runs in Logs first. Creating actions then make one record per run.
- Triggers: every other trigger off, only "Link is Clicked in Saleshandy" on. For each section, select only the actions named in its heading, then Save.
- Records a row needs first (person, deals, organization) are created by hand in Pipedrive.
- Field mappings saved for Contact, Deal and Organisation fields. Deal Fields maps Value only, no Expected Close Date. Pipeline and Stage are read on staging before any row asserts them.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Track Link Clicks off in the sequence, Create a Person selected | Click the first link in the step 1 email | No clicked count, no run in Logs, no person and no activity | None |
| 2 | Create a Person selected, prospect already clicked the first link | Click the second link in the same email | A further run in Logs and one more activity on the same person. Still 1 person (proposed, unconfirmed) | None |

## Create a Lead

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Click the first link in the step 1 email | Person created, named First Last. One lead on it per run in Logs, titled with the prospect email. No activity | None |
| 2 | Prospect already a person in Pipedrive | Click the first link in the step 1 email | Person updated, still 1 person. New lead on it | None |

## Create a Deal

Extra Configuration: Pipeline and Stage as read on staging.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Click the first link in the step 1 email | Person created. Deal on it titled with the prospect email, in the configured pipeline and stage. No activity. No organization link | None |
| 2 | Person has 1 deal | Click the first link in the step 1 email | New deal added. Existing deal unchanged | None |

## Create a Person

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Click the first link in the step 1 email | Person created, 1 person only even if the action gives several runs. Activity per run: type email, done, subject "Link is clicked in Saleshandy" | None |
| 2 | Person exists | Click the first link in the step 1 email | Person updated, still 1 person. A further activity is added | None |

## Update a Deal

Extra Configuration: Pipeline and Stage as read on staging.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person has 2 deals | Click the first link in the step 1 email | Only the newest deal changes: title is the prospect email, configured pipeline and stage, mapped Value. The older deal is unchanged | None |
| 2 | Prospect not in Pipedrive | Click the first link in the step 1 email | Run ends in Error (known B2). No person is created | None |

## Update a Person

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person exists with an old value in a mapped field | Click the first link in the step 1 email | Mapped fields updated. 1 activity added | None |
| 2 | Prospect not in Pipedrive | Click the first link in the step 1 email | Run ends in Error (known B1). No person is created | None |

## Delete Deal

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person has 2 deals | Click the first link in the step 1 email | Only the newest deal is deleted. The older deal stays | None |

## Delete Person

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person exists | Click the first link in the step 1 email | Person is deleted | None |

## Create Organization

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect has a company, no organization with that name | Click the first link in the step 1 email | Organization named after the company, with the mapped Organisation Fields. Not linked to any person or deal | None |

## Update Organization

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An organization with the exact company name exists with an old mapped value | Click the first link in the step 1 email | First exact match updated with the name and mapped fields | None |

## Delete Organization

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An organization with the exact company name exists | Click the first link in the step 1 email | Organization is deleted. A Pipedrive deprecation warning is information only | None |

## Combined actions

Extra Configuration: Pipeline and Stage as read on staging.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Create a Lead, Create a Deal and Create a Person selected, prospect not in Pipedrive | Click the first link in the step 1 email | Exactly 1 person. 1 lead, 1 deal and 1 activity for each run in Logs | None |
