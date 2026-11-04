# Reply is Received in Saleshandy (Zoho): Regression scenarios

Environment: Staging. Version v5-account-link. Account `notemailsentzoho`, Zoho org 941113438, sequence "Zoho Reply Received QA" (id 197387, 2 steps). Tracking sub-task AL-4192. No row has its own ticket. Known bug AL-4219: the workflow does not start for a reply, whether the prospect is marked as replied or replies from Gmail. The Expected results below describe the fixed behavior. Expected results come from the developer rules in `context/zoho/00-overview.md`. A row marked (proposed, unconfirmed) has an Expected that no source documents. A different result there is not a failure by itself.

## Test data setup

- Turn on only "Reply is Received in Saleshandy" with the actions in the section heading, then Save. Leave the other triggers as they are, because other Zoho runs share this account (`KEEP_OTHER_TRIGGERS=1`).
- Use a new prospect for each row. After step 1 shows Sent, mark the prospect as replied (sequence > Prospects > select the prospect > Mark as replied). Wait 15 s and look in Zoho first.
- Records that a row needs first (contacts, leads, accounts, deals) are made by hand in Zoho with names that are unique to the run. Two deals for one contact are made a few minutes apart. The later one is the newest.
- The note title is "Saleshandy Reply Received On Sequence Email" (seen 2026-10-29).
- About 24 sends against the shared cap of 40 a day.

Not covered: Pipeline and Stage (Q3, hidden in the UI), Conversation Category, Zoho duplicate rules. Z-1 and Z-5 are decided issues, so they are recorded and not filed. Z-1: one wrong-type value makes Zoho reject the record. Z-5: a deal creates a blank account.

## Trigger behavior

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger on with the Contact action | Enable the trigger, select Create/Update a Contact in Zoho, click Save | "Configuration Updated Successfully" | None |
| 2 | Trigger off | Turn the toggle OFF, click Save, then mark the prospect as replied | No contact in Zoho | None |

## Create/Update a Contact in Zoho

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Mark the prospect as replied | Contact created with the mapped fields. One note | None |
| 2 | Contact with the same email exists, different Title | Mark the prospect as replied | Still 1 contact. Title holds the prospect's value (proposed, unconfirmed) | None |
| 3 | Same prospect, contact made by row 1 | Second reply: mark the prospect as replied on step 2 | Still 1 contact. A second note | None |
| 4 | Prospect has no phone, Zoho contact has one | Mark the prospect as replied | Zoho phone unchanged | None |
| 5 | Prospect has no last name | Mark the prospect as replied | No contact created (QA 2026-10-29) | None |
| 6 | Zoho contact has the email in different letter case | Mark the prospect as replied | Still 1 contact, no duplicate (proposed, unconfirmed) | None |

## Create/Update a Lead in Zoho

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho, has a company | Mark the prospect as replied | Lead created with the mapped fields, Company from the prospect. One note | None |
| 2 | Lead with the same email exists | Mark the prospect as replied | Lead updated, no duplicate | None |
| 3 | Prospect has no company | Mark the prospect as replied | Lead created with Company left out, not blank. One note (proposed, unconfirmed) | None |

## Create/Update Account in Zoho

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho, no contact, has a company | Mark the prospect as replied | Account created, named after the company, with the mapped fields. One note | None |
| 2 | Contact has the account "Orion Freight", prospect company is "Orion Freight Ltd" | Mark the prospect as replied | "Orion Freight" is updated and keeps its name. No new account | None |
| 3 | Contact exists, has no account | Mark the prospect as replied | Account created and linked to the contact | None |

## Create/Update a Deal in Zoho

Extra Configuration: Deal Closing date in days. Pipeline and Stage are not set (Q3).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho, Closing date 7 | Mark the prospect as replied | Deal created, not linked to a contact. Closing Date is today plus 7 days. A blank account also appears (Z-5, recorded) | None |
| 2 | Contact has 2 deals, the second made a few minutes after the first | Mark the prospect as replied | Only the newest deal is updated by id. The older deal is unchanged. No new deal | None |
| 3 | Stage of the deal changed by hand to Negotiation/Review | Mark the prospect as replied | Stage stays Negotiation/Review | None |
| 4 | Contact exists, has no deal, Closing date left empty | Mark the prospect as replied | Deal created and linked to the contact, with no Closing Date. The run completes | None |

## Create a Task in Zoho

Extra Configuration: Subject, Status, Priority, Due In (days).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho. Subject "Follow up after reply", Not Started, Normal, Due In 3 | Mark the prospect as replied | Contact created. Task linked to it, due in 3 days | None |
| 2 | Contact exists. Status Completed, Priority Highest | Mark the prospect as replied | A new task linked to the contact, showing Completed and Highest | None |
| 3 | Subject empty | Mark the prospect as replied | No task and no task note. The run completes. The contact is still created | None |

## Combined actions

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact, Deal and Task selected, prospect not in Zoho | Mark the prospect as replied | 1 contact, 1 linked deal, 1 linked task. A note on each | None |
| 2 | All 5 actions selected, contact, account and deal already exist | Mark the prospect as replied | No duplicates. Contact, account and deal updated. One new lead and one new task | None |

## Real reply

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact action, prospect mailbox is a Gmail address | Reply to the step 1 email from Gmail | Reply detected. Contact created as in Contact row 1 | None |
