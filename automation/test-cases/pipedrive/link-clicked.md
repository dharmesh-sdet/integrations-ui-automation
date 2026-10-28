# Link is Clicked in Saleshandy (Pipedrive): Regression scenarios

Environment: Staging, account `gpipedrive`, workflow version v2. The workflow ticket is AL-4175 (sub-task of AL-4170). Expected results come from the rules document of 2026-10-23 and are not yet seen in the UI. Rows marked **(proposed, unconfirmed)** have an Expected result that is not documented. A different result there is not a failure by itself.

Link Clicked has no category gate. Only Create a Deal and Update a Deal have Extra Configuration (Pipeline = Pipeline, Stage as in each section). Each action runs on every click. A link scanner can turn one real click into 2 or 3 runs. This is Saleshandy event behavior, so the check waits, counts the runs, and judges the first record. Extra runs are noted, not failed.

Not covered, still open: B1 (Update a Person with no person) and B2 (Update a Deal or Delete Deal with no person) are already reported. The rows that hit them expect Error. Do not file them again. The `\"` in activity notes is kept by decision. Expected Close Date is not mapped or tested. The clicked URL or `Click Count` in the activity note is not documented for Pipedrive, so it is not asserted.

## Test data setup

- Sequence "Pipedrive Link Clicked QA" on `gpipedrive`: 2 active steps, no A/B variants, Track Link Clicks on. Each email body has 2 links. The sender is one Kartik mailbox that sequences 197336 and 197337 do not use.
- Each row has its own new prospect with a Mailinator address, for example `tomas.brandl.pdl1@mailinator.com`. Add the prospect, wait until step 1 shows Sent in the Emails tab, then use Send now only where the row says so.
- "Click the link" means: open the prospect's inbox on mailinator.com, open the sequence email, click the first link. Wait until the clicked count rises in Sequence > Emails, then wait 15 s and look in Pipedrive first. If the record is missing, wait 5 s, refresh and look again. Open Logs only after that. An Error in Logs is reported to QA, not failed.
- Triggers: every other trigger off, especially Email Sent (it creates the person first). Only "Link is Clicked in Saleshandy" on. Each section selects only the actions in its heading, then Save. Run the rows that skip Extra Configuration first, because a saved configuration cannot be cleared.
- Records a row needs first (person, deals, organization, lead) are created by hand in Pipedrive with an old value, so a change proves the update.
- Field mappings saved for Contact, Deal and Organisation fields. Deal Fields maps Value only.
- 32 rows give about 34 sends, which is under the cap of 40 a day.

## Trigger behavior

Create a Person is the probe action.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger off | Enable "Link is Clicked in Saleshandy", select Create a Person, click Save | "Configuration Updated Successfully" | AL-4175 |
| 2 | Step 1 sent, prospect not in Pipedrive | Click the first link | Clicked count is 1. One person named First Last. One activity: email, done, subject "Link is clicked in Saleshandy" | AL-4175 |
| 3 | Row 2 done, same prospect | Click the second link | Clicked count is 2. A further activity on the same person. Still 1 person | AL-4175 |
| 4 | Row 2 done, step 2 sent with Send now | Click the link in the step 2 email | A new run. A further activity on the same person. Still 1 person | AL-4175 |
| 5 | Create a Lead, Create a Deal and Create a Person selected, prospect not in Pipedrive | Click the first link | Exactly 1 person with 1 lead, 1 deal and 1 activity | AL-4175 |
| 6 | Prospect opens the step 1 email and does not click (proposed, unconfirmed) | Open the email in Mailinator | No run and no record in Pipedrive | AL-4175 |

## Create a Person

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person exists with an old value in a mapped field | Click the first link | Person updated, still 1 person. A further activity is added | AL-4175 |
| 2 | Create a Person and Update a Person both selected, person exists | Click the first link | Still 1 person. The person gets 2 activities for one click | AL-4175 |
| 3 | Prospect has no first and last name | Click the first link | Person named "(No Name)" with the prospect email | AL-4175 |

## Create a Lead

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Click the first link | Person created. One lead on it, titled with the prospect email. No activity | AL-4175 |
| 2 | Person exists | Click the first link | Person updated, still 1 person. New lead on it | AL-4175 |
| 3 | Row 1 done | Click the second link | A second lead with the same title on the same person. Still 1 person | AL-4175 |

## Create a Deal

Extra Configuration: Pipeline = Pipeline, Stage = Qualified.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Click the first link | Person created. Deal on it titled with the prospect email, in Pipeline / Qualified, Value from the prospect. No activity, no organization link | AL-4175 |
| 2 | Person has 1 deal | Click the first link | New deal added. The existing deal is unchanged | AL-4175 |
| 3 | Row 1 done | Click the second link | A second deal on the same person. Still 1 person | AL-4175 |

## Update a Person

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person exists with an old value in a mapped field | Click the first link | Mapped fields updated. 1 activity added | AL-4175 |
| 2 | Prospect not in Pipedrive | Click the first link | Run ends in Error (known B1). No person is created | AL-4175 |

## Update a Deal

Extra Configuration: Pipeline = Pipeline, Stage = Contact Made.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person has 2 deals | Click the first link | Only the newest deal changes: title is the prospect email, Pipeline / Contact Made, mapped Value. The older deal is unchanged | AL-4175 |
| 2 | Person exists with no deal | Click the first link | Nothing is created or changed | AL-4175 |
| 3 | Prospect not in Pipedrive | Click the first link | Run ends in Error (known B2). No person is created | AL-4175 |

## Delete Deal

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person has 2 deals | Click the first link | Only the newest deal is deleted. The older deal stays | AL-4175 |
| 2 | Person exists with no deal | Click the first link | Nothing is deleted | AL-4175 |
| 3 | Prospect not in Pipedrive | Click the first link | Run ends in Error (known B2) | AL-4175 |

## Delete Person

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person exists | Click the first link | Person is deleted | AL-4175 |
| 2 | Prospect not in Pipedrive | Click the first link | Nothing happens | AL-4175 |

## Create Organization

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect has a company, no organization with that name | Click the first link | Organization named after the company, with the mapped Organisation Fields. Not linked to any person or deal | AL-4175 |
| 2 | Row 1 done | Click the second link | A second organization with the same name. Neither is linked | AL-4175 |

## Update Organization

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An organization with the exact company name exists with an old mapped value | Click the first link | First exact match updated with the name and mapped fields | AL-4175 |
| 2 | Organization name differs in case from the company | Click the first link | Nothing is updated (the match is case-sensitive) | AL-4175 |
| 3 | No organization with the company name | Click the first link | Nothing is created or updated | AL-4175 |

## Delete Organization

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An organization with the exact company name exists | Click the first link | Organization is deleted. A Pipedrive deprecation warning is information only | AL-4175 |
| 2 | No organization with the company name | Click the first link | Nothing happens | AL-4175 |
