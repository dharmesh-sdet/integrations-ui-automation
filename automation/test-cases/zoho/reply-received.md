# Reply is Received in Saleshandy (Zoho): Regression scenarios

Environment: Staging. Version v5-account-link. Account `notemailsentzoho`, Zoho org 941113438. No workflow ticket exists, so every Ticket cell is None. Expected results come from the developer logs, except the rows that QA and Claude checked by hand on 2026-10-29. Rows marked (proposed, unconfirmed) are not documented or not seen yet. A different result there is not a failure by itself.

## Test data setup

- Sequence "Zoho Reply Received QA" with 2 steps (id 197387, sender Rachel 10). Each row uses a new prospect, for example `dharmesh+zoho-r1@saleshandy.com`.
- Email Sent trigger off. Enable "Reply is Received in Saleshandy" with only the actions in the section heading, then Save. Use the saved mapping from `context/zoho/field-mapping.md`.
- After step 1 shows Sent in the Emails tab, use Mark as replied (Emails tab > the prospect's row > three dots). Then wait 15 s and check the Zoho record only. Logs are not used for Zoho.
- Records that a row needs first (contacts, leads, accounts, deals) are created by hand in Zoho with names that are unique to the run.
- Each note is titled "Saleshandy Reply Received On Sequence Email". Its lines are Sequence Name, Sequence (link), Step, Sender Email, Prospect Email, Prospect Name and User.
- Contact row 7 empties a mapping, so it runs last. Save the mapping again afterwards with `npm run not-emailsent-zoho`.
- About 36 sends against the shared cap of 40 a day.

Not covered: Pipeline and Stage cannot be set from the UI (Q3). Conversation Category, Custom Workflow and Zoho duplicate rules are out of scope. Z-1 (one wrong-type value makes Zoho reject the whole record) and Z-5 (a deal creates a blank account) are decided, so they are recorded and not filed again.

## Trigger behavior

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger on | Enable "Reply is Received in Saleshandy", select Create/Update a Contact in Zoho, click Save | "Configuration Updated Successfully" | None |
| 2 | Trigger off | Turn the toggle OFF, click Save, then Mark as Replied | No contact in Zoho | None |

## Create/Update a Contact in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Mark as Replied | Contact created with the mapped fields. One note | None |
| 2 | Contact with the same email exists, with a different Title than the prospect | Mark as Replied | Contact updated, still 1 contact. Title now holds the prospect's value (proposed, unconfirmed). One new note | None |
| 3 | Same prospect, contact created by row 1 | Second reply: Mark as Replied on step 2 | Still 1 contact. A second note | None |
| 4 | Prospect has no phone, Zoho contact has one | Mark as Replied | Zoho phone unchanged (proposed, unconfirmed) | None |
| 5 | Prospect has no last name | Mark as Replied | No contact is created in Zoho (expected, QA 2026-10-29) | None |
| 6 | Zoho contact has the email in different letter case than the prospect | Mark as Replied | Contact updated, still 1 contact, no duplicate (proposed, unconfirmed) | None |
| 7 | Contact Fields mapping is empty, prospect not in Zoho | Mark as Replied | Run completes. Contact created with no mapped fields (proposed, unconfirmed) | None |

## Create/Update a Lead in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho, has a company | Mark as Replied | Lead created with the mapped fields, Company from the prospect. One note | None |
| 2 | Lead with the same email exists | Mark as Replied | Lead updated, no duplicate | None |
| 3 | Same prospect, lead created by row 1 | Second reply: Mark as Replied on step 2 | Still 1 lead. A second note | None |
| 4 | Prospect has no company | Mark as Replied | Lead created with Company empty. One note | None |
| 5 | Company Size "11-50" mapped to No. of Employees (Z-1) | Mark as Replied | Zoho rejects the record. No lead. Result recorded, not filed | None |

## Create/Update Account in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho, no contact, has a company | Mark as Replied | Account created with the mapped fields, named after the company. One note | None |
| 2 | Contact has the account "Orion Freight", prospect company is "Orion Freight Ltd" | Mark as Replied | "Orion Freight" is updated and keeps its name. No new account. Note on it | None |
| 3 | Contact exists, no account | Mark as Replied | Account created and linked to the contact | None |
| 4 | Account with the same name exists, no contact | Mark as Replied | That account is updated, still 1 account. One note | None |

## Create/Update a Deal in Zoho

Extra Configuration: Deal Closing date in days. Pipeline and Stage are not set (Q3).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho, Closing date 7 | Mark as Replied | Deal created, not linked to a contact. Mapped fields set. Closing Date is today plus 7 days | None |
| 2 | Contact exists, has no deal | Mark as Replied | Deal created and linked to the contact | None |
| 3 | Contact has 1 deal | Mark as Replied | That deal is updated by id. No new deal | None |
| 4 | Contact has 2 deals | Mark as Replied | Only the newest deal is updated | None |
| 5 | Stage of the deal changed by hand to Negotiation/Review | Mark as Replied | Stage stays Negotiation/Review | None |
| 6 | Closing date left empty | Mark as Replied | Deal has no Closing Date. Run completes | None |

## Create a Task in Zoho

Extra Configuration: Subject, Status, Priority, Due In (days).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho. Subject "Follow up after reply", Not Started, Normal, Due In 3 | Mark as Replied | Contact created. Task linked to it, due in 3 days. One note | None |
| 2 | Contact exists | Mark as Replied | Contact updated. A new task linked to it | None |
| 3 | Status Completed, Priority Highest | Mark as Replied | Task shows Completed and Highest | None |
| 4 | Subject empty | Mark as Replied | No task and no task note. Run completes. Contact still created or updated | None |
| 5 | Due In empty | Mark as Replied | Task created with no Due Date, linked to the new contact. One note | None |

## Combined actions

Extra Configuration: as in the sections above.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact, Deal and Task selected, prospect not in Zoho | Mark as Replied | 1 contact, 1 linked deal, 1 linked task. A note on each | None |
| 2 | Lead and Contact selected, prospect not in Zoho | Mark as Replied | 1 lead and 1 contact, separate records. A note on each | None |
| 3 | Contact and Account selected, prospect has a company | Mark as Replied | Both created. The account is linked to the contact | None |
| 4 | All 5 actions selected, contact, account and deal already exist | Mark as Replied | No duplicates. Contact, account and deal updated. One new lead and one new task | None |

## Real reply

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact action, prospect mailbox is the QA Gmail address | Reply to the step 1 email from Gmail | Reply detected. Contact created as in Contact row 1 | None |
