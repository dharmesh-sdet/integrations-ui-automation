# Link is Clicked in Saleshandy (Zoho): Regression scenarios

Environment: Staging, account `notemailsentzoho`, version v5-account-link. No Zoho Jira ticket exists, so every Ticket cell is None. Expected results come from three sources. The first is the developer logs of 12 and 13 October (runs L1, L2 and VL1). The second is the Zoho Email Sent and Email Opened cases. The third is the Pipedrive Link Clicked cases. No one has seen this trigger in the Saleshandy UI. Rows marked (proposed, unconfirmed) have an Expected result that no source documents. A different result there is not a failure by itself.

The note title and exact note text for this trigger are not recorded. Run L1 shows "Click Count 1" in the note. The first run reads the rest from Zoho and the file is updated.

A link scanner can turn one real click into 2 or 3 runs (Z-10). This is Saleshandy event behavior. The check waits, counts the runs, and judges the first record. Extra runs are noted, not failed. No row asserts an exact note count after a click.

Seen on 29 October for Email Sent: when the prospect was new in Zoho, one event made two Tasks, or two Deals with two accounts. The Expected cells say one record. If a run repeats it, the row shows Fail. QA has not decided whether it is a bug.

Not covered, still open: Z-1, Z-5 and Q3. All three are known and kept by decision. Z-1 is not tested, because it needs a change to the shared field mapping. Rows that hit Z-5 or Q3 state the known result. Custom Workflow and Expected Close Date are out of scope.

Cut on 2026-10-30 (QA OK): 6 rows that repeat other rows were removed. Field-level cases such as an empty Phone Number are covered by the Email Sent cases, because all seven workflows share the Contact step.

## Test data setup

- Account `notemailsentzoho` is shared with the other Zoho workflows except Email Sent (QA, 2026-10-30). Workflows run in parallel. Each has its own sequence, mailbox and prospects.
- Each row uses a new prospect with a Mailinator address, for example `yourname.zoho-l1@mailinator.com`. Add it to the active sequence "Zoho Link Clicked QA". The sequence has 2 steps, no A/B variants, and one mailbox that no other Zoho sequence uses. Each email body has 2 links.
- Sequence Settings > Safety Settings: Track link clicks is on. Track email opens is off, so that a click does not also fire Email Opened. The first run checks whether this holds.
- Step 1 must show Sent in the Emails tab before the click.
- "Click the link" means: open mailinator.com, type the prospect email, click Go, open the sequence email, and click the first link.
- After the click, wait 10 s and refresh Sequences > Emails until the Clicked count goes up. Then wait 15 s and look in Zoho. Do not open Logs for Zoho (QA rule).
- Only "Link is Clicked in Saleshandy" is on for these rows, with only the action named in the section heading. Other workflows keep their own triggers. They must not use this sequence or these prospects.
- If a Link Clicked prospect gets a record from a sibling trigger, the run notes it and does not fail the row.
- Make the records that a row needs first by hand in Zoho. These are the contact, lead, account and deals. Give each a unique name and an old value, so a change proves the update.
- Field mappings are saved on all four types. Deal Fields map Deal Value to Amount and Closing Date.
- Zoho can be read only in a headed browser with the saved profile.

## Trigger and setup

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger OFF, Contact action saved | Click the first link | Clicked count goes up. Nothing created or changed in Zoho | None |
| 2 | Trigger ON, Contact action saved, page reloaded | Open Triggers & Activity | The selected action and its Extra Configuration values show as saved | None |
| 3 | Contact action on, prospect not in Zoho, step 1 sent | Click the first link | Clicked count is 1. One contact. One note with Click Count 1 | None |
| 4 | Row 3 done, same prospect | Click the second link in the same email | Clicked count is 2. Still 1 contact. A second note with Click Count 2 (proposed, unconfirmed) | None |

## Create/Update a Contact in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Click the first link | One contact with the 11 mapped Contact fields. One note with Click Count 1 | None |
| 2 | Contact exists with an old Title | Click the first link | Same contact updated with the prospect Title. Still 1 contact | None |
| 3 | Contact exists, its email typed in different letter case | Click the first link | Same contact updated. No second contact. One note | None |

## Create/Update a Lead in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Click the first link | One lead with the mapped Lead Fields (City, Designation, Phone) and the prospect company. One note with Click Count 1, as in run L1 | None |
| 2 | Lead exists for the prospect email | Click the first link | Same lead updated. Still 1 lead | None |
| 3 | Prospect has no company | Click the first link | Lead created without Company, no error | None |

## Create/Update Account in Zoho

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect has a company, no contact, no account | Click the first link | Account named after the company with the Account Fields values. Not linked to a contact. One note | None |
| 2 | Contact exists and is linked to an account | Click the first link | The linked account is updated with the mapped fields. Its name is kept | None |
| 3 | Contact exists with no account | Click the first link | Account upserted and linked to the contact | None |
| 4 | Prospect has no company | Click the first link | No account and no contact created | None |

## Create/Update a Deal in Zoho

Extra Configuration: Deal Closing date as listed per row. Pipelines and Stages are greyed out and empty (Q3).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho, has a company, Closing date 0 | Click the first link | One deal named after the prospect, not linked to a contact. No contact created. Amount is Deal Value. Closing Date empty. Stage Qualification. The deal also creates an account named after the company (Z-5, known). One note | None |
| 2 | Contact has 2 deals, Closing date 0 | Click the first link | Only the newest deal updated. The older deal unchanged | None |
| 3 | Prospect not in Zoho, Closing date 6 | Click the first link | Closing Date is today plus 6 days, as in run L1 | None |
| 4 | Existing deal with Stage changed by hand | Click the first link | Deal updated. The Stage set by hand is kept | None |

## Create a Task in Zoho

Extra Configuration: Subject "Follow up after click", Status Not Started, Priority Normal, Due In 3, unless the row says otherwise.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect not in Zoho | Click the first link | Contact created, then one task linked to it with the 4 values. Due date is today plus 3 days | None |
| 2 | Contact exists | Click the first link | One task linked to the existing contact. Still 1 contact | None |
| 3 | Subject left empty | Click the first link | No task and no task note. The run still completes | None |

## Combined actions

Extra Configuration: Task and Deal values as in their sections.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact, Lead, Account, Deal and Task all selected, prospect not in Zoho | Click the first link | 1 contact. The lead, deal and task exist for it from the first event. Accounts as Z-5 allows | None |
| 2 | Contact and Deal selected, "Sequence Email is Opened" also on with Track email opens on, prospect not in Zoho. Run this row while no other session runs Email Opened rows | Open the email, then click the first link | Still 1 contact. The deal from the open run is now linked to the contact, as in run VL1 | None |
