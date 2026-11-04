# Prospect is Unsubscribed in Saleshandy (Zoho): Regression scenarios

Environment: Staging, account `notemailsentzoho`, version v5-account-link. No Zoho Jira ticket exists, so every Ticket cell is None. Expected results come from the developer logs of 12 and 13 October (runs U1, U2, U3 and VU1) and from the Zoho Email Sent cases. The Pipedrive Unsubscribed cases give the way to unsubscribe. No one has seen this trigger in the Saleshandy UI. Rows marked (proposed, unconfirmed) have an Expected result that no source documents. A different result there is not a failure by itself.

The note title and note text for this trigger are not recorded. The first run reads them from Zoho and the file is updated.

Seen on 29 October for Email Sent: when the prospect was new in Zoho, one event made two Tasks, or two Deals with two accounts. The Expected cells say one record. If a run repeats it, the row shows Fail. QA has not decided whether it is a bug.

Not covered, still open: Z-1, Z-5 and Q3. All three are known and kept by decision. Z-1 is not tested, because it needs a change to the shared field mapping. Rows that hit Z-5 or Q3 state the known result. Z-6 has its own row with the known result. Custom Workflow and Expected Close Date are out of scope. Field-level cases such as an empty Phone Number are covered by the Email Sent cases, because all seven workflows share the Contact step.

## Test data setup

- Account `notemailsentzoho` is shared with the other Zoho workflows except Email Sent (QA, 2026-10-30). Workflows run in parallel. Each has its own sequence, mailbox and prospects.
- Each row uses a new prospect with a Mailinator address, for example `yourname.zoho-u1@mailinator.com`. Add it to the active sequence "Zoho Prospect Unsubscribed QA". The sequence has 2 steps (a one-step sequence turns a prospect Completed after step 1, and the unsubscribe link does not register on it, QA 2026-11-04), no A/B variants, and one mailbox that no other Zoho sequence uses. Sequence Settings > Unsubscribe > "Unsubscribe as Link" is saved for the link rows.
- Step 1 must show Sent in the Emails tab before the unsubscribe.
- "Unsubscribe (UI)" means: Prospects tab, tick the prospect, click the Mark as Unsubscribe icon in the toolbar. "Unsubscribe (link)" means: open mailinator.com, type the prospect email, click Go, open the sequence email, and click the unsubscribe link. Link rows are limited to 3 to save sends. All other rows use the UI.
- Every row also shows "Unsubscribed" on the Prospects tab.
- After the unsubscribe, wait 15 s and look in Zoho. Do not open Logs for Zoho (QA rule).
- Only "Prospect is Unsubscribed in Saleshandy" is on for these rows, with only the action named in the section heading. Other workflows keep their own triggers. They must not use this sequence or these prospects.
- If an Unsubscribed prospect gets a record from a sibling trigger, the run notes it and does not fail the row.
- Make the records that a row needs first by hand in Zoho. These are the contact, lead, account and deals. Give each a unique name and an old value, so a change proves the update.
- Field mappings are saved on all four types. Deal Fields map Deal Value to Amount and Closing Date.
- Zoho can be read only in a headed browser with the saved profile.
- Do not unsubscribe prospects of other testers.

## Trigger and setup

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger OFF, Contact action saved | Unsubscribe (UI) | Prospects tab shows Unsubscribed. Nothing created or changed in Zoho | None |
| 2 | Trigger ON, Contact action saved, page reloaded | Open Triggers & Activity | The selected action and its Extra Configuration values show as saved | None |
| 3 | Contact action on, prospect not in Zoho, step 1 sent | Unsubscribe (UI) | 1 contact. Tag Unsubscribed-Saleshandy on it. One note | None |
| 4 | Same setup as row 3, new prospect | Unsubscribe (link) | Page says "You will no longer receive emails from us". Prospects tab shows Unsubscribed, but only when the email stays open about 20 seconds before the link is used. Without that pause the row stayed Active for 120 seconds (seen 2026-10-31). 1 contact and one note (seen 2026-10-31). The tag was not seen in the record text (unconfirmed) | None |
| 5 | Row 4 done, same prospect | Open the same unsubscribe link a second time | Still 1 contact. A second note is added, 2 notes in total (seen 2026-10-31). The tag was not seen in the record text (unconfirmed) | None |
| 6 | Row 4 done, same prospect | Click "Subscribe here" on the unsubscribe page | Page says "You have successfully subscribed and added to our list for future communication". Prospects tab shows Active, the previous status (seen 2026-10-31). No new note, still 2 notes (seen 2026-10-31). The tag was not seen in the record text (unconfirmed) | None |

## Create/Update a Contact in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Unsubscribe (UI) | One contact with the 11 mapped Contact fields and the real phone. Tag Unsubscribed-Saleshandy. One note, as in run U1 | None |
| 2 | Contact exists with an old Title and the phone filled in | Unsubscribe (UI) | Same contact updated with the prospect Title and the prospect Phone (the prospect has a Phone Number, so it replaces the old one). Still 1 contact. Tag added | None |

## Create/Update a Lead in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Unsubscribe (UI) | One lead with the mapped Lead Fields (City, Designation, Phone) and the prospect company. One note. No contact is created: 1 lead and 0 contacts with the email (seen 2026-10-31) | None |
| 2 | Lead exists for the prospect email | Unsubscribe (UI) | Same lead updated. Still 1 lead | None |
| 3 | Prospect has no company | Unsubscribe (UI) | Lead created without Company, no error | None |

## Create/Update Account in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect has a company, no contact, no account | Unsubscribe (UI) | Account named after the company with the Account Fields values. Not linked to a contact. One note | None |
| 2 | Contact exists and is linked to an account | Unsubscribe (UI) | The linked account is updated with the mapped fields. Its name becomes the prospect company, because Account Name is mapped to Company. Contact gets the tag | None |

## Create/Update a Deal in Zoho

Extra Configuration: Deal Closing date 0 unless the row says otherwise. Pipelines and Stages are greyed out and empty (Q3).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho, has a company | Unsubscribe (UI) | One deal named after the prospect, not linked to a contact. Amount is Deal Value. Closing Date empty. Stage Qualification. The deal also creates an account named after the company (Z-5, known). One note | None |
| 2 | Contact has 2 deals | Unsubscribe (UI) | Only the newest deal updated. The older deal unchanged | None |
| 3 | Contact has a linked deal in Stage Needs Analysis | Unsubscribe (UI) | Contact and tag updated. Deal updated by id and the Stage Needs Analysis kept, as in run VU1 | None |

## Create a Task in Zoho

Extra Configuration: Subject "Follow up after unsubscribe", Status Not Started, Priority Normal, Due In 3, unless the row says otherwise.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Unsubscribe (UI) | Contact created, then one task linked to it with the 4 values. Due date is today plus 3 days | None |
| 2 | Subject left empty (Contact action saved first) | Open the Task Extra Configuration, leave Subject empty, then unsubscribe (UI) | Save stays disabled, so the Task is never saved (AL-4198). The contact is created. No task and no task note | AL-4198 |

## Combined actions

Extra Configuration: Task and Deal values as in their sections.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact, Lead, Account, Deal and Task all selected, prospect not in Zoho | Unsubscribe (UI) | 1 contact with the tag. The lead, deal and task exist for it from the first event. Accounts as Z-5 allows, as in run U3 | None |
