# Sequence Email is Opened in Saleshandy (Zoho): Regression scenarios

Environment: Staging, account `notemailsentzoho`, version v5-account-link. No Zoho Jira ticket exists, so every Ticket cell is None. Expected results come from three sources. The first is the developer logs of 12 and 13 October (runs O1 and VO1). The second is the Zoho Email Sent cases. The third is the Pipedrive Email Opened cases. No one has seen this trigger in the Saleshandy UI. Rows marked (proposed, unconfirmed) have an Expected result that no source documents. A different result there is not a failure by itself.

The note title and exact note text for this trigger are not recorded. The first run will read them from Zoho and the file will be updated.

Seen on 29 October for Email Sent: when the prospect was new in Zoho, one event made two Tasks, or two Deals with two accounts. The Expected cells say one record. If a run repeats it, the row shows Fail. QA has not decided whether it is a bug.

Not covered, still open: Z-1, Z-5 and Q3. All three are known and kept by decision. Z-1 means a mistyped mapped value makes Zoho reject the record. Z-5 means a deal creates its own account. Q3 means Pipeline and Stage cannot be chosen. Z-1 is not tested, because it needs a change to the shared field mapping. Rows that hit Z-5 or Q3 state the known result. Custom Workflow and Expected Close Date are out of scope.

## Test data setup

- Each row uses a new prospect with its own email, for example `yourname.zoho-o1@mailinator.com`. The prospect is added to the active sequence "Zoho Email Opened QA" (2 steps, one mailbox that no other Zoho sequence uses).
- Sequence Settings > Safety Settings: Track email opens is on, Track link clicks is off.
- Step 1 must show Sent in the Emails tab before the open.
- Open the email: mailinator.com, type the prospect email, Go, open the sequence email with images loaded.
- After the open, wait 10 s and refresh Sequences > Emails until the Opened count goes up. Then wait 15 s and look in Zoho. Do not open Logs for Zoho (QA rule).
- Only "Sequence Email is Opened in Saleshandy" is on, with only the action named in the section heading. Email Sent and every other trigger are off. A click also counts as an open. Email Sent will create the contact on the send.
- You make the records that a row needs first by hand in Zoho. These are the contact, lead, account and deals. Give each a unique name and an old value, so a change proves the update.
- Field mappings are saved on all four types. Deal Fields map Deal Value to Amount and Closing Date.
- Zoho can be read only in a headed browser with the saved profile. A headless run ends on "Verify your identity".

## Trigger and setup

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Open trigger OFF, Contact action saved | Open the email | Opened count goes up. Nothing created or changed in Zoho | None |
| 2 | Trigger ON, Contact action saved, page reloaded | Open Triggers & Activity | The selected action and its Extra Configuration values show as saved | None |
| 3 | Track email opens is off in the sequence, Contact action on | Open the email | No Opened count. No contact and no note in Zoho | None |
| 4 | Contact action on, prospect opened once and the first run is done | Open the same email a second time | Opened count reaches 2. Still 1 contact. A second note with Open Count 2 (proposed, unconfirmed) | None |
| 5 | Only "Reply is Received in Saleshandy" on, with the Contact action | Open the email | Opened count goes up. No contact and no note in Zoho | None |

## Create/Update a Contact in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Open the email | One contact with the 11 mapped Contact fields. One note with Open Count 1 | None |
| 2 | Prospect has no Phone Number | Open the email | Contact created, Phone empty. Other mapped fields set | None |
| 3 | Contact exists with an old Title | Open the email | Same contact updated with the prospect Title. Still 1 contact | None |
| 4 | Contact exists, its email typed in different letter case | Open the email | Same contact updated. No second contact. One note | None |

## Create/Update a Lead in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Open the email | One lead with the mapped Lead Fields and the prospect company. One note | None |
| 2 | Lead exists for the prospect email | Open the email | Same lead updated. Still 1 lead | None |
| 3 | Prospect has no company | Open the email | Lead created without Company, no error | None |

## Create/Update Account in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect has a company, no contact, no account | Open the email | Account named after the company with the Account Fields values. Not linked to a contact. One note | None |
| 2 | Contact exists and is linked to an account | Open the email | The linked account is updated with the mapped fields. Its name is kept | None |
| 3 | Contact exists with no account | Open the email | Account upserted and linked to the contact | None |
| 4 | Prospect has no company | Open the email | No account and no contact created | None |

## Create/Update a Deal in Zoho

Extra Configuration: Deal Closing date as listed per row. Pipelines and Stages are greyed out and empty (Q3).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho, has a company, Closing date 0 | Open the email | One deal named after the prospect, not linked to a contact. No contact created. Amount is Deal Value. Closing Date empty. Stage Qualification. The deal also creates an account named after the company (Z-5, known). One note | None |
| 2 | Contact has 2 deals, Closing date 0 | Open the email | Only the newest deal updated. The older deal unchanged | None |
| 3 | Prospect not in Zoho, Closing date 7 | Open the email | Closing Date is today plus 7 days | None |
| 4 | Existing deal with Stage changed by hand | Open the email | Deal updated. The Stage set by hand is kept | None |

## Create a Task in Zoho

Extra Configuration: Subject "Follow up after open", Status Not Started, Priority Normal, Due In 3, unless the row says otherwise.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Open the email | Contact created, then one task linked to it with the 4 values. Due date is today plus 3 days | None |
| 2 | Contact exists | Open the email | One task linked to the existing contact. Still 1 contact | None |
| 3 | Subject left empty | Open the email | No task and no task note. The run still completes | None |

## Combined actions

Extra Configuration: Task and Deal values as in their sections.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact, Lead, Account, Deal and Task all selected, prospect not in Zoho | Open the email | 1 contact. The lead, deal and task exist for it from the first event. Accounts as Z-5 allows | None |
| 2 | Contact and Deal selected, prospect not in Zoho, then a second open | Open the email, then open it again | After the first open: 1 contact and 1 deal (the deal can be unlinked, as in developer run VO1). After the second open: still 1 contact and 1 deal, now linked to the contact (proposed, unconfirmed) | None |
