# Email is Bounced in Saleshandy (Zoho): Regression scenarios

Environment: Staging, account `notemailsentzoho`, version v5-account-link. No Zoho Jira ticket exists, so every Ticket cell is None. Expected results come from three sources. The first is the developer logs of 12 and 13 October (runs B1 and B3). The second is the Zoho Email Sent and Email Opened cases. The third is the Pipedrive Email Bounced cases. No one has seen this trigger in the Saleshandy UI. Rows marked (proposed, unconfirmed) have an Expected result that no source documents. A different result there is not a failure by itself.

The note title is known from the log: "Saleshandy Email is Bounced". The tag from the log (Bounced-Saleshandy) is not tested. No one found it in the Zoho CRM (QA 2026-11-03).

Seen on 29 October for Email Sent: when the prospect was new in Zoho, one event made two Tasks, or two Deals with two accounts. The Expected cells say one record. If a run repeats it, the row shows Fail. QA has not decided whether it is a bug.

Not covered, still open: Z-1, Z-5, Z-6 and Q3. All are known and kept by decision. Z-1 is not tested, because it needs a change to the shared field mapping. Z-6 is not tested, because the tag is not found in Zoho. Rows that hit Z-5 or Q3 state the known result. Custom Workflow and Expected Close Date are out of scope.

## Test data setup

- Each row uses a new prospect with its own email, for example `yourname.zoho-b1@mailinator.com`. Add it to the active sequence "Zoho Email Bounced QA". The sequence has 2 steps and one mailbox that no other Zoho sequence uses.
- Bounce the email (manual): Emails tab > the prospect's row > Actions > Mark as bounced. A prospect can be marked only once. A plain mailinator address never bounces by itself.
- Real bounce: one row only. The prospect email is `name@<company>.mailinator.com`. The step 1 email must show Sent first.
- After the bounce, wait 15 s and look in Zoho. Do not open Logs for Zoho (QA rule).
- Only "Email is Bounced in Saleshandy" is on, with only the action named in the section heading. Email Sent and every other trigger are off.
- Make the records that a row needs first by hand in Zoho. These are the contact, lead, account and deals. Give each a unique name and an old value, so a change proves the update.
- Field mappings are saved on all four types. Deal Fields map Deal Value to Amount and Closing Date.
- Zoho can be read only in a headed browser with the saved profile.
- Lead rows: no source says whether a bounce with only the Lead action makes a contact. The first run reads this in Zoho and the result is added here.

## Trigger and setup

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger OFF, Contact action saved | Mark the step 1 email as bounced | Emails tab shows Bounced. Nothing created or changed in Zoho | None |
| 2 | Trigger ON, Contact action saved, page reloaded | Open Triggers & Activity | The selected action and its Extra Configuration values show as saved | None |
| 3 | Contact action on, prospect not in Zoho, sequence Active | Mark the step 1 email as bounced | Contact created. One note "Saleshandy Email is Bounced" (seen 2026-10-31) | None |
| 4 | Contact action on, real-bounce address, prospect not in Zoho | Send the step 1 email and wait for Saleshandy to set Bounced | Emails tab shows Bounced, 26 seconds after the send. Contact and note as in row 3 (seen 2026-10-31) | None |

## Create/Update a Contact in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Mark the email as bounced | One contact. One note. Seen 2026-10-31: name, email, phone, title, department, Twitter and mailing address. The other mapped fields were not confirmed | None |
| 2 | Contact exists with an old Title | Mark the email as bounced | Same contact updated with the prospect Title. Still 1 contact | None |
| 3 | Contact exists, its email typed in different letter case | Mark the email as bounced | Same contact updated. No second contact. One note | None |

## Create/Update a Lead in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Mark the email as bounced | One lead with the mapped Lead Fields and the prospect company. One note | None |
| 2 | Lead exists for the prospect email | Mark the email as bounced | Same lead updated. Still 1 lead | None |
| 3 | Prospect has no company | Mark the email as bounced | Lead created without Company, no error | None |

## Create/Update Account in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect has a company, no contact, no account | Mark the email as bounced | Account named after the company with the Account Fields values. Not linked to a contact. One note | None |
| 2 | Contact exists and is linked to an account | Mark the email as bounced | The linked account is updated with the mapped fields. Its name is kept | None |
| 3 | Contact exists with no account | Mark the email as bounced | Account upserted and linked to the contact | None |
| 4 | Prospect has no company | Mark the email as bounced | No account and no contact created | None |

## Create/Update a Deal in Zoho

Extra Configuration: Deal Closing date as listed per row. Pipelines and Stages are greyed out and empty (Q3).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho, has a company, Closing date 0 | Mark the email as bounced | One deal named after the prospect, not linked to a contact. No contact created. Amount is Deal Value. Closing Date empty. Stage Qualification. The deal also creates an account named after the company (Z-5, known). One note | None |
| 2 | Contact has 2 deals, Closing date 0 | Mark the email as bounced | Only the newest deal updated. The older deal unchanged | None |
| 3 | Prospect not in Zoho, Closing date 7 | Mark the email as bounced | Closing Date is today plus 7 days | None |
| 4 | Existing deal with Stage changed by hand | Mark the email as bounced | Deal updated. The Stage set by hand is kept | None |

## Create a Task in Zoho

Extra Configuration: Subject "Follow up after bounce", Status Not Started, Priority Normal, Due In 3, unless the row says otherwise.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Mark the email as bounced | Contact created, then one task linked to it with the 4 values. Due date is today plus 3 days | None |
| 2 | Contact exists | Mark the email as bounced | One task linked to the existing contact. Still 1 contact | None |
| 3 | Subject left empty (Contact action saved first) | Open the Task Extra Configuration, leave Subject empty, then mark the email as bounced | Save stays disabled, so the Task is never saved (AL-4198). The contact is created. No task and no task note | AL-4198 |

## Combined actions

Extra Configuration: Task and Deal values as in their sections.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact, Lead, Account, Deal and Task all selected, prospect not in Zoho | Mark the email as bounced | 1 contact with 3 notes: its own, its deal and its task (seen 2026-11-03). 1 lead, 1 deal and 1 task. 2 accounts named after the company, one with the Account mapping linked to the contact and one blank holding the deal (Z-5, developer rule). The lead company is plain text | None |