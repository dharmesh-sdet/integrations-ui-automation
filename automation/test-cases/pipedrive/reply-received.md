# Reply is Received in Saleshandy (Pipedrive): Regression scenarios

Environment: Staging. Version v2. Account `gpipedrive`. The workflow ticket is AL-4172. No row has its own ticket, so every Ticket cell is None. Expected results come from the rules document of 2026-10-23. Rows marked (proposed, unconfirmed) have an Expected result that is not documented. A different result there is not a failure by itself.

What differs from Email Sent: the lead and the deal are titled `First Name Last Name`, not the email. The activity type is `Email` (capital E). These are decisions (QA 2026-10-23), not defects.

Not covered, still open: B1 (Update a Person with no person) is already reported. B2 (Update a Deal or Delete Deal with no person) is also reported. Rows that hit them expect Error. The `\"` in activity notes is a known issue. Expected Close Date is not mapped. A real reply from a prospect mailbox is not covered, because every row uses Mark as Replied. Two persons from one event is a bug by the rules and was seen on this account in the Email Sent and Outcome Updated runs. If it happens again, rows that check "still 1 person" will show it. Record it and do not retry silently.

## Test data setup

- Sequence "Pipedrive Reply Received QA" on `gpipedrive`, two steps, sender Kartik 5. Each row uses a new prospect, for example `yourname+pipedrive-r1@company.com`. Wait until step 1 shows Sent in the Emails tab.
- Mark as Replied: Emails tab > the prospect's row > three dots > Mark as replied. Not yet seen on this account (proposed, unconfirmed).
- After Mark as Replied, make sure that the prospect shows as replied. Wait 15 s and look in Pipedrive. If the record is missing, wait 5 s, refresh and look again. Open Logs only after that. An Error in Logs goes to QA and is not marked failed.
- "Second reply" rows use Mark as Replied on the step 2 email. If the UI does not allow it, use a new prospect with the same record state and mark the row skipped with the reason.
- Persons, deals and organizations that a row needs first are created by hand in Pipedrive.
- Email Sent trigger off. Enable "Reply is Received in Saleshandy" with only the actions in the section heading, then Save. Field mappings are saved for Contact, Deal (Value only) and Organisation fields. Organization Industry uses a value from `organization-industry-list.md`.
- 32 sends against the shared cap of 40 a day. Run it in two halves over two days.

## Trigger behavior

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger off | Enable "Reply is Received in Saleshandy", select Create a Person, click Save | "Configuration Updated Successfully" | None |

## Create a Lead

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Mark as Replied | Person created, named First Last. One lead on it, titled First Last. No activity | None |
| 2 | Prospect already a person in Pipedrive | Mark as Replied | Person updated, still 1 person. New lead on it, titled First Last | None |
| 3 | Same prospect, lead already created by row 1 | Second reply: Mark as Replied on step 2 | A second lead on the same person. Still 1 person | None |
| 4 | Prospect has no first or last name | Mark as Replied | Person named (No Name). Lead created on it. The lead title is recorded, not asserted (proposed, unconfirmed) | None |

## Create a Deal

Extra Configuration: Pipeline and Stage as read on staging.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Mark as Replied | Person created. Deal on it titled First Last, in the configured pipeline and stage. No activity. No organization link | None |
| 2 | Person has 1 deal | Mark as Replied | New deal added. Existing deal unchanged | None |
| 3 | Person has 2 deals | Mark as Replied | New deal added. Both existing deals unchanged | None |

## Create a Person

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Pipedrive | Mark as Replied | Person created. One activity: type Email, done, subject "Reply is Received in Saleshandy". The note content is recorded, not asserted (proposed, unconfirmed) | None |
| 2 | Person exists | Mark as Replied | Person updated, still 1 person. A second activity is added | None |
| 3 | Contact Fields mapped and the prospect has values | Mark as Replied | Mapped values appear on the person | None |
| 4 | A mapped value has the wrong type for its Pipedrive field | Mark as Replied | Pipedrive rejects the record. No person and no activity. The run status is recorded (proposed, unconfirmed) | None |

## Update a Deal

Extra Configuration: Pipeline and Stage as read on staging.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person has 2 deals | Mark as Replied | Only the newest deal changes: title is the prospect email, configured pipeline and stage, mapped Value. The older deal is unchanged | None |
| 3 | Person has no deal | Mark as Replied | Success. Nothing created or changed | None |
| 4 | Prospect not in Pipedrive | Mark as Replied | Run ends in Error (known B2). No person is created | None |

## Update a Person

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person exists | Mark as Replied | Mapped fields updated. 1 activity added, type Email. The note content is recorded, not asserted (proposed, unconfirmed) | None |
| 2 | Prospect not in Pipedrive | Mark as Replied | Run ends in Error (known B1). No person is created | None |
| 3 | Create a Person in slot 1 and Update a Person in slot 2, person exists | Mark as Replied | Person gets 2 activities for one event. Still 1 person | None |

## Delete Deal

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person has 2 deals | Mark as Replied | Only the newest deal is deleted. The older deal stays | None |
| 2 | Prospect not in Pipedrive | Mark as Replied | Run ends in Error (known B2) | None |

## Delete Person

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Person exists | Mark as Replied | Person is deleted | None |
| 2 | Prospect not in Pipedrive | Mark as Replied | Nothing happens | None |

## Create Organization

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect has a company, no organization with that name | Mark as Replied | Organization named after the company, with the mapped Organisation Fields. Not linked to any person or deal | None |
| 2 | An organization with the same name exists | Mark as Replied | A second organization with the same name is created | None |
| 3 | Industry gets free text, but the Pipedrive field is a picklist | Mark as Replied | Pipedrive rejects the record. No organization created. The run status is recorded (proposed, unconfirmed) | None |
| 4 | Company Industry matches a Pipedrive Industry option (for example Retail) | Mark as Replied | Organization created, named after the company, with Industry set to that option (proposed, unconfirmed) | None |

## Update Organization

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An organization with the exact company name exists | Mark as Replied | First exact match updated with the name and mapped fields | None |
| 2 | Organization exists with the name in different letter case | Mark as Replied | Nothing updated (the match is case-sensitive) | None |
| 3 | No organization with that name | Mark as Replied | Nothing happens. No organization is created | None |

## Delete Organization

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | An organization with the exact company name exists | Mark as Replied | Organization is deleted. A Pipedrive deprecation warning is information only | None |

## Combined actions

Extra Configuration: Pipeline and Stage as read on staging.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Create a Lead, Create a Deal and Create a Person selected, prospect not in Pipedrive | Mark as Replied | Exactly 1 person with 1 lead, 1 deal and 1 activity. Lead and deal titled First Last | None |
| 2 | Create Organization and Create a Person selected, prospect not in Pipedrive | Mark as Replied | 1 person with 1 activity. 1 new organization, not linked to the person | None |
