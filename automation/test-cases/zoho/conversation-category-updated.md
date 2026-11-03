# Conversation Category is Updated in Saleshandy (Zoho): Regression scenarios

Environment: Staging, account `notemailsentzoho`, version v5-account-link. No Zoho Jira ticket exists, so every Ticket cell is None. Expected results come from three sources. The first is the developer runs of 12 and 13 October (C1 to C5, VC1). The second is the Zoho Email Sent and Link Clicked cases. The third is the Pipedrive Prospect Outcome cases. Rows marked (proposed, unconfirmed) have an Expected result that no source documents. A different result there is not a failure by itself.

Seen on staging on 30 October, read only: each action under this trigger opens an Extra Configuration with "Select Saleshandy Conversation Category". When clicked, the box was empty and showed no value list. Whether it takes free text is not tested. Nothing was saved. The workflow compares the saved category with the new outcome. A match runs the action. No match runs nothing. An empty category runs the action for every outcome (run C3).

Outcomes: Interested, Not Interested, Closed, Meeting Booked, Do Not Contact, Out of Office, Not Now. Each outcome except Meeting Booked is a matching category in at least one section. Meeting Booked never matches (Z-7, reported).

Not covered, still open: Z-1, Z-5 and Q3 are known and kept by decision. Rows that hit Z-5 or Q3 state the known result. Z-8 (Conversation link has no id) and Z-9 (raw HTML in the note) are low and known. Expected Close Date is not mapped or tested. Field cases such as an empty Phone Number are covered by Email Sent. Custom Workflow is out of scope.

Seen on 29 October for Email Sent: for a prospect new in Zoho, one event made two Tasks, or two Deals with two accounts. The Expected cells say one record. A repeat shows Fail. QA has not decided whether it is a bug.

## Test data setup

- Each row uses a new prospect with a Mailinator address, for example `yourname.zoho-c1@mailinator.com`. Add it to the active sequence "Zoho Conversation Category QA". It has 1 step, one mailbox that no other Zoho sequence uses, and the Emails tab must show Sent before the outcome changes. The prospect starts at "Add Outcome".
- Email Sent and every other Zoho trigger must be OFF. Email Sent was seen ON with Create/Update a Contact in the browser profile used on 30 October. If that is `notemailsentzoho`, turn it off first, or "prospect not in Zoho" rows start with a contact.
- "Change the outcome" means: open Sequences > the sequence > Prospects, and use the outcome dropdown on the prospect row.
- After the change, wait 15 s and look in Zoho. Do not open Logs for Zoho (QA rule). For rows that expect nothing, wait the same time and check that nothing was created or changed.
- Only "Conversation Category is Updated in Saleshandy" is on, with only the action named in the section heading. Save the category in that action's Extra Configuration. Reload and check the saved category before the outcome changes.
- Make the records that a row needs first by hand in Zoho. Give each a unique name and an old value, so a change proves the update.
- Field mappings are saved on all four types. Deal Fields map Deal Value to Amount and Closing Date.
- Zoho can be read only in a headed browser with the saved profile.

## Trigger and category gate

Probe action: Create/Update a Contact in Zoho, category Interested, unless the row says otherwise.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger OFF, Contact action and category saved earlier | Change the outcome to Interested | Nothing created or changed in Zoho | None |
| 2 | Trigger ON, Contact action, category Interested, saved, page reloaded | Open Triggers & Activity | The action and the category Interested show as saved | None |
| 3 | Category left empty, prospect not in Zoho | Change the outcome to Not Now | One contact and one note with "New Outcome Updated: Not Now", as in run C3 (seen 2026-10-31: the empty category box saves, 1 contact, 0 leads, 1 note) | None |
| 4 | Category Meeting Booked, prospect not in Zoho | Change the outcome to Meeting Booked | One contact and one note with "New Outcome Updated: Meeting Booked" (QA 2026-11-03) | None |
| 5 | Prospect replied, category Interested, prospect not in Zoho | In Unified Inbox, set the conversation category to Interested | One contact and one note with "New Outcome Updated: Interested" (proposed, unconfirmed). Needs a real reply in Unified Inbox: a prospect marked as replied by hand creates no inbox thread (seen 2026-10-31, Unified Inbox showed 0 threads) | None |

## Create/Update a Contact in Zoho

Extra Configuration: category Interested.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Change the outcome to Interested | One contact with the 11 mapped Contact fields. One note with "New Outcome Updated: Interested", the sequence name and the sequence link, as in run C1 | None |
| 2 | Contact exists with an old Title | Change the outcome to Interested | Same contact updated with the prospect Title. Still 1 contact | None |
| 3 | Prospect not in Zoho | Change the outcome to Not Interested | No contact and no note, as in run C2 | None |
| 4 | Prospect not in Zoho | Change the outcome to Interested, then to Not Interested | After the first change, one contact and one note. After the second change, still 1 contact and 1 note | None |

## Create/Update a Lead in Zoho

Extra Configuration: category Not Interested.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho, has a company | Change the outcome to Not Interested | One lead with the mapped Lead Fields (City, Designation, Phone) and the prospect company. One note with "New Outcome Updated: Not Interested" | None |
| 2 | Lead exists for the prospect email, old City | Change the outcome to Not Interested | Same lead updated. Still 1 lead | None |
| 3 | Prospect not in Zoho | Change the outcome to Interested | No lead and no note | None |

## Create/Update Account in Zoho

Extra Configuration: category Out of Office.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect has a company, no contact, no account | Change the outcome to Out of Office | Account named after the company, with the Account Fields values. Not linked to a contact. One note | None |
| 2 | Contact exists and is linked to an account with an old Website | Change the outcome to Out of Office | The linked account is updated with the mapped fields, and its name changes to the prospect's company (Company is mapped to Account Name, QA 2026-11-03). No second account | None |
| 3 | Prospect has no company | Change the outcome to Out of Office | No account and no contact created | None |

## Create/Update a Deal in Zoho

Extra Configuration: category Closed, Deal Closing date 0. Pipelines and Stages are greyed out and empty (Q3).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho, has a company | Change the outcome to Closed | One deal named after the prospect, not linked to a contact. No contact created. Amount is Deal Value. Closing Date empty. Stage Qualification. The deal also creates an account named after the company (Z-5, known). One note | None |
| 2 | Contact has 2 deals | Change the outcome to Closed | Only the newest deal is updated, as in run VC1. The older deal is unchanged | None |

## Create a Task in Zoho

Extra Configuration: category Do Not Contact. Subject "Follow up after outcome change", Status Not Started, Priority Normal, Due In 3, unless the row says otherwise.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Change the outcome to Do Not Contact | Contact created, then one task linked to it with the 4 values. Due date is today plus 3 days | None |
| 2 | Subject left empty | Fill Due In and the category, leave Subject empty | Save in Extra Configuration is disabled (QA 2026-11-03) | None |

## Combined actions

Extra Configuration: category Interested. Task and Deal values as in their sections.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact, Lead, Account, Deal and Task all selected, prospect not in Zoho | Change the outcome to Interested | 1 contact. The lead, deal and task exist for it from the first event. Accounts as Z-5 allows. All records get a note, as in run C5 | None |
