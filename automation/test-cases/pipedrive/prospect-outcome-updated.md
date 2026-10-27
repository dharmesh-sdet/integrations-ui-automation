# Prospect Outcome is updated in Saleshandy (Pipedrive): Regression scenarios

Environment: Staging. Version v2. No Jira ticket is given, so every Ticket cell is None. Expected results come from the rules document of 2026-10-23 and are not yet confirmed in the UI. Rows marked **(proposed, unconfirmed)** have an Expected result that is neither documented nor seen. A different result there is not a failure by itself.

Seen on staging (2026-10-24, read-only): every action added under this trigger opens its own Extra Configuration with "Select Saleshandy Conversation Category", like Select Outcome in Salesforce. Category equal to the new outcome: that action runs. Extra Configuration skipped (modal closed, never saved): the action runs for every outcome (from the rules document, not seen). Any other case: nothing runs, which is expected. A run that does nothing may still leave a Logs row. That is recorded, not failed.

Outcomes in the Pipedrive dropdown (seen on staging): Interested, Not Interested, Closed, Meeting Booked, Do Not Contact, Out of Office, Not Now. Uncategorized is not offered, so it is not tested as a category. Each outcome except Meeting Booked is the matching category in at least one section. Every outcome is a non-matching outcome in at least one section. Pipeline: "Pipeline". Stages: Qualified, Contact Made, Demo Scheduled, Proposal Made, Negotiations Started.

"Meeting Booked" saved as the category never matches (known Z-7, webui bug). Do not file it. Update a Deal in slot 5 does not run today (found offline, unconfirmed). One row expects it to run and is reported as an unconfirmed expectation, not a bug, until QA confirms it.

Not covered, still open: B1 (Update a Person with no person) and B2 (Update a Deal or Delete Deal with no person) are already reported. Rows that hit them expect Error. Do not file them again. The `\"` in activity notes is a known issue, kept by decision. Expected Close Date is not mapped or tested. An outcome set by an email reply, custom outcomes, a second sequence and special characters are not covered.

## Test data setup

- Each row has its own new prospect and email, for example `yourname+pipedrive-o1@company.com`, added to one active sequence. Wait until step 1 shows Sent. The prospect starts at "Add Outcome".
- Change the outcome in Sequence > the sequence > Prospects, with the outcome dropdown on the prospect's row.
- After the change, wait 15 s and look in Pipedrive. If the record is missing, wait 5 s, refresh and look again. Open Logs only after that. An Error in Logs is reported to QA, not failed.
- Non-matching rows: wait the same time, then check that nothing was created, changed or deleted in Pipedrive.
- Triggers: every other trigger off, only "Prospect Outcome is updated in Saleshandy" on. Each section selects only the actions in its heading and sets the category in that action's Extra Configuration, then Save.
- Records a row needs first (person, deals, organization) are created by hand in Pipedrive with an old value, so a change proves the update.
- Field mappings saved for Contact, Deal and Organisation fields. Deal Fields maps Value only. Pipeline and Stage are as listed above.
- 30 rows, so about 30 sends. The send cap is 40 a day, so run it over two days or in two halves.

## Trigger behavior and category gate

Create a Person is the probe action in row 3. Category as written in each row. Run the skipped-configuration row first: a saved category cannot be cleared.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger off | Enable "Prospect Outcome is updated in Saleshandy", select Create a Person, set a category, click Save | "Configuration Updated Successfully" | None |
| 3 | Extra Configuration skipped for Create a Person, new prospect | Change the outcome to Not Now | Person created and one activity | None |
| 6 | Create a Lead, Create a Deal and Create a Person selected, category = Interested, prospect not in Pipedrive | Change the outcome to Interested | Exactly 1 person with 1 lead, 1 deal and 1 activity | None |

## Create a Person

Extra Configuration: category = Interested.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Change the outcome to Interested | 1 person, named First Last. Activity: email, done, subject "Prospect Outcome is updated in Saleshandy" | None |
| 2 | Person exists with an old value in a mapped field | Change the outcome to Interested | Person updated, still 1 person. A further activity is added | None |
| 3 | Prospect not in Pipedrive | Change the outcome to Not Interested | No person and no activity | None |

## Create a Lead

Extra Configuration: category = Not Interested.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Change the outcome to Not Interested | Person created. One lead on it, titled with the prospect email. No activity | None |
| 2 | Person exists | Change the outcome to Not Interested | Person updated, still 1 person. New lead on it | None |
| 3 | Prospect not in Pipedrive | Change the outcome to Out of Office | No person and no lead | None |

## Create a Deal

Extra Configuration: category = Closed, Pipeline = Pipeline, Stage = Qualified.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Change the outcome to Closed | Person created. Deal on it titled with the prospect email, in Pipeline / Qualified, Value from the prospect. No activity, no organization link | None |
| 2 | Person has 1 deal | Change the outcome to Closed | New deal added. The existing deal is unchanged | None |
| 3 | Prospect not in Pipedrive | Change the outcome to Do Not Contact | No person and no deal | None |

## Update a Person

Extra Configuration: category = Out of Office.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person exists with an old value in a mapped field | Change the outcome to Out of Office | Mapped fields updated. 1 activity added | None |
| 2 | Prospect not in Pipedrive | Change the outcome to Out of Office | Run ends in Error (known B1). No person is created | None |
| 3 | Person exists with an old value | Change the outcome to Closed | Person keeps the old value. No activity | None |

## Update a Deal

Extra Configuration: category = Not Now, Pipeline = Pipeline, Stage = Contact Made.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person has 2 deals | Change the outcome to Not Now | Only the newest deal changes: title is the prospect email, Pipeline / Contact Made, mapped Value. The older deal is unchanged | None |
| 2 | Person exists with no deal | Change the outcome to Not Now | Nothing is created or changed | None |
| 3 | Prospect not in Pipedrive | Change the outcome to Not Now | Run ends in Error (known B2). No person is created | None |
| 4 | Person has 1 deal | Change the outcome to Interested | The deal is unchanged | None |

## Delete Deal

Extra Configuration: category = Do Not Contact.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person has 2 deals | Change the outcome to Do Not Contact | Only the newest deal is deleted. The older deal stays | None |
| 2 | Person has 2 deals | Change the outcome to Not Now | Both deals stay | None |

## Delete Person

Extra Configuration: category = Not Interested.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person exists | Change the outcome to Not Interested | Person is deleted | None |
| 2 | Person exists | Change the outcome to Do Not Contact | Person stays | None |

## Create Organization

Extra Configuration: category = Interested.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect has a company, no organization with that name | Change the outcome to Interested | Organization named after the company, with the mapped Organisation Fields. Not linked to any person or deal | None |
| 2 | Same setup | Change the outcome to Meeting Booked | No organization created | None |

## Update Organization

Extra Configuration: category = Not Interested.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An organization with the exact company name exists with an old mapped value | Change the outcome to Not Interested | First exact match updated with the name and mapped fields | None |
| 2 | Organization name differs in case from the company | Change the outcome to Not Interested | Nothing is updated (the match is case-sensitive) | None |
| 3 | Same setup as row 1 | Change the outcome to Not Now | Organization keeps its old value | None |

## Delete Organization

Extra Configuration: category = Closed.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An organization with the exact company name exists | Change the outcome to Closed | Organization is deleted. A Pipedrive deprecation warning is information only | None |
| 2 | Same setup | Change the outcome to Out of Office | Organization stays | None |
