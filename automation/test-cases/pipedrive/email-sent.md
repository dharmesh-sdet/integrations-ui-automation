# Email Sent from Saleshandy (Pipedrive): Regression scenarios

Environment: Staging. Version v2. No Jira ticket is given for this workflow, so every Ticket cell is None. Expected results come from the rules document of 2026-10-23 and are not yet confirmed in the UI. Rows marked **(proposed, unconfirmed)** have an Expected result that is neither documented nor seen. A different result there is not automatically a failure.

Not covered, still open: B1 (Update a Person with no person errors) and B2 (Update a Deal or Delete Deal with no person errors) are already reported. The rows that hit them expect Error. Do not file them again. The `\"` in activity notes is a known issue, kept by decision. Do not treat it as a failure. Expected Close Date is not mapped and not tested (QA 2026-10-23, date conversion issue seen on HubSpot).

## Test data setup

- Each row uses a new prospect with its own email, for example `yourname+pipedrive-e1@company.com`, added to an active sequence.
- Send the email from the Emails tab with Send now on the prospect's row (same method as Salesforce, proposed, unconfirmed).
- The run is complete when that row shows "Sent" in the Scheduled/Sent column. Then wait 15 s and look in Pipedrive. If the record is missing, wait 5 s, refresh and look again. Open Logs only after that. An Error in Logs is reported to QA, not failed.
- Records a row needs first (person, deals, organization) are created by hand in Pipedrive.
- Triggers: every other trigger off, only "Email Sent from Saleshandy" on. For each section, select only the actions named in its heading, then Save.
- Field mappings saved for Contact, Deal and Organisation fields. Deal Fields maps Value only, no Expected Close Date. Pipeline and Stage are read on staging before any row asserts them.

## Create a Lead

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Send the step 1 email | Person created, named First Last. One lead on it, titled with the prospect email. No activity | None |
| 2 | Prospect already a person in Pipedrive | Send the step 1 email | Person updated, still 1 person. New lead on it | None |
| 3 | Same prospect, lead already created by row 1 | Send the step 2 email | A second lead on the same person. Still 1 person | None |
| 4 | Prospect has no first or last name | Send the step 1 email | Person named (No Name). Lead created on it | None |
| 5 | Person exists with the email in different letter case | Send the step 1 email | Existing person updated. No second person | None |

## Create a Deal

Extra Configuration: Pipeline and Stage as read on staging.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Send the step 1 email | Person created. Deal on it titled with the prospect email, in the configured pipeline and stage. No activity. No organization link | None |
| 2 | Person has 1 deal | Send the step 1 email | New deal added. Existing deal unchanged | None |
| 3 | Person has 2 deals | Send the step 1 email | New deal added. Both existing deals unchanged | None |

## Create a Person

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Send the step 1 email | Person created. One activity: type email, done, subject "Email sent from Saleshandy". The note holds the full email body | None |
| 2 | Person exists | Send the step 1 email | Person updated, still 1 person. A second activity is added | None |
| 3 | Contact Fields mapped and the prospect has values | Send the step 1 email | Mapped values appear on the person | None |
| 4 | A mapped value has the wrong type for its Pipedrive field | Send the step 1 email | Pipedrive rejects the record. No person and no activity. Run status not documented, record it (proposed, unconfirmed) | None |

## Update a Deal

Extra Configuration: Pipeline and Stage as read on staging.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person has 2 deals | Send the step 1 email | Only the newest deal changes: title is the prospect email, configured pipeline and stage, mapped Value. The older deal is unchanged | None |
| 2 | Person has no deal | Send the step 1 email | Success, nothing created or changed | None |
| 3 | Prospect not in Pipedrive | Send the step 1 email | Run ends in Error (known B2). No person is created | None |

## Update a Person

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person exists | Send the step 1 email | Mapped fields updated. 1 activity added. The note does not hold the email body | None |
| 2 | Prospect not in Pipedrive | Send the step 1 email | Run ends in Error (known B1). No person is created | None |
| 3 | Create a Person in slot 1 and Update a Person in slot 2, person exists | Send the step 1 email | Person gets 2 activities for one event. Still 1 person | None |

## Delete Deal

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person has 2 deals | Send the step 1 email | Only the newest deal is deleted. The older deal stays | None |
| 2 | Person has no deal | Send the step 1 email | Nothing happens (proposed, unconfirmed) | None |
| 3 | Prospect not in Pipedrive | Send the step 1 email | Run ends in Error (known B2) | None |

## Delete Person

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person exists | Send the step 1 email | Person is deleted | None |
| 2 | Prospect not in Pipedrive | Send the step 1 email | Nothing happens | None |

## Create Organization

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect has a company, no organization with that name | Send the step 1 email | Organization named after the company, with the mapped Organisation Fields. Not linked to any person or deal | None |
| 2 | An organization with the same name exists | Send the step 1 email | A second organization with the same name is created | None |
| 3 | Organisation Fields mapped: Industry gets free text, but the Pipedrive field is a picklist | Send the step 1 email | Pipedrive rejects the record. No organization created. Run status not documented, record it (proposed, unconfirmed) | None |
| 4 | Organisation Fields mapped: Company Industry matches one of the Pipedrive Industry options (for example Retail) | Send the step 1 email | Organization created, named after the company, with Industry set to that option (proposed, unconfirmed) | None |

## Update Organization

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An organization with the exact company name exists | Send the step 1 email | First exact match updated with the name and mapped fields | None |
| 2 | Organization exists with the name in different letter case | Send the step 1 email | Nothing updated (the match is case-sensitive) | None |
| 3 | No organization with that name | Send the step 1 email | Nothing happens. No organization is created | None |

## Delete Organization

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An organization with the exact company name exists | Send the step 1 email | Organization is deleted. A Pipedrive deprecation warning is information only | None |
| 2 | No organization with that name | Send the step 1 email | Nothing happens (proposed, unconfirmed) | None |

## Combined actions

Extra Configuration: Pipeline and Stage as read on staging.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Create a Lead, Create a Deal and Create a Person selected, prospect not in Pipedrive | Send the step 1 email | Exactly 1 person with 1 lead, 1 deal and 1 activity | None |
| 2 | Create Organization and Create a Person selected, prospect not in Pipedrive | Send the step 1 email | 1 person with 1 activity. 1 new organization, not linked to the person | None |
