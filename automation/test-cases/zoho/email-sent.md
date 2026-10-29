# Email Sent from Saleshandy (Zoho): Regression scenarios

Environment: Staging, account gzoho, version v5-account-link. No Zoho Jira ticket exists, so every Ticket cell is None. Expected results come from three sources. The first is the developer logs of 12 and 13 October. The second is QA's run of 29 October. The third is the exploration runs of 29 October (`context/zoho/email-sent-progress.md`).

Seen on 29 October: when the prospect was new in Zoho, one event made two Tasks, or two Deals with two accounts. The Expected cells say one record. If a run repeats it, the row shows Fail. QA has not yet decided whether it is a bug.

Not covered, still open: Z-1, Z-5 and Q3. All three are known and kept by decision. Z-1 means a mistyped mapped value makes Zoho reject the record. Z-5 means a deal creates its own account. Q3 means Pipeline and Stage cannot be chosen. Z-1 is not tested, because it needs a change to the shared field mapping. Rows that hit Z-5 or Q3 state the known result. Do not file them again. Custom Workflow and Expected Close Date are out of scope.

## Test data setup

- Each row uses a new prospect with its own email, for example `dharmesh+zoho-e1@saleshandy.com`, added to "Zoho's First Sequence" (3 steps).
- Send with Send now on the prospect's Emails tab row. When the row shows Sent, wait 15 s and look in Zoho. Do not open Logs for Zoho (QA rule).
- Records a row needs first (contact, lead, account, deals) are made by hand in Zoho with unique names.
- Only "Email Sent from Saleshandy" is on, with only the action named in the section heading.
- Field mappings are saved on all four types. Deal Fields map Deal Value to Amount and Closing Date.
- Each record the run creates or updates gets a note: "Saleshandy Email Sent from Sequence", then Sequence Name, Sequence, Step, Sender Email, Prospect Email, Prospect Name and User.
- Zoho can be read only in a headed browser with the saved profile. A headless run ends on "Verify your identity".

## Create/Update a Lead in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Send the step 1 email | One lead with the mapped Lead Fields and the prospect company. One note | None |
| 2 | Lead exists for the prospect email | Send the step 1 email | Same lead updated. Still 1 lead | None |
| 3 | Prospect has no company | Send the step 1 email | Lead created without Company, no error | None |

## Create/Update a Contact in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Send the step 1 email | One contact with the 11 mapped Contact fields. One note | None |
| 2 | Prospect has no Phone Number | Send the step 1 email | Contact created, Phone empty. Other mapped fields set | None |
| 3 | Contact exists with a Phone and Title | Send the step 1 email | Same contact updated. Still 1 contact. If the prospect has no Phone or Title, the Zoho values are kept | None |
| 4 | Contact exists, its email typed in different letter case | Send the step 1 email | Same contact updated. No second contact. One note | None |
| 5 | Same prospect, contact made by row 1 | Send the step 2 email | Same contact. A second note | None |

## Create/Update Account in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect has a company, no contact, no account | Send the step 1 email | Account named after the company with the Account Fields values. Not linked to a contact. One note | None |
| 2 | Contact exists and is linked to an account | Send the step 1 email | The linked account is updated with the mapped fields. Its name is kept | None |
| 3 | Contact exists with no account | Send the step 1 email | Account upserted and linked to the contact | None |
| 4 | Prospect has no company | Send the step 1 email | No account and no contact created | None |

## Create/Update a Deal in Zoho

Extra Configuration: Deal Closing date as listed per row. Pipelines and Stages are greyed out and empty (Q3).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho, has a company, Closing date 0 | Send the step 1 email | One deal named after the prospect, not linked to a contact. No contact created. Amount is Deal Value. Closing Date empty. Stage Qualification. The deal also creates an account named after the company (Z-5, known). One note | None |
| 2 | Contact has 1 deal, Closing date 0 | Send the step 1 email | That deal updated. Still 1 deal | None |
| 3 | Contact has 2 deals | Send the step 1 email | Only the newest deal updated. The older deal unchanged | None |
| 4 | Prospect not in Zoho, Closing date 7 | Send the step 1 email | Closing Date is today plus 7 days | None |
| 5 | Existing deal with Stage changed by hand | Send the step 1 email | Deal updated. The Stage set by hand is kept | None |

## Create a Task in Zoho

Extra Configuration: Subject, Status, Priority and Due In as listed per row.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho. Subject "Follow up after step 1", Status Not Started, Priority Normal, Due In 3 | Send the step 1 email | Contact created, then one task linked to it with the 4 values. Due date is today plus 3 days | None |
| 2 | Contact exists | Send the step 1 email | One task linked to the existing contact. Still 1 contact | None |
| 3 | Subject left empty | Send the step 1 email | No task and no task note. The run still completes | None |

## Combined actions

Extra Configuration: Task and Deal values as in their sections.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact, Lead, Account, Deal and Task all selected, prospect not in Zoho | Send the step 1 email | 1 contact. The lead, deal and task exist for it from the first event. Accounts as Z-5 allows | None |
| 2 | Contact and Lead selected, prospect not in Zoho | Send the step 1 email | 1 contact and 1 lead. No duplicate contact | None |

## Trigger and setup

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Email Sent trigger OFF | Send the step 1 email | Nothing created or changed in Zoho | None |
| 2 | Trigger ON, action saved, page reloaded | Open Triggers & Activity | The selected action and its Extra Configuration values show as saved | None |
