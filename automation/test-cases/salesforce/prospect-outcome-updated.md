# Prospect Outcome is updated in Saleshandy: Regression scenarios

Environment: Staging (pyxis.lifeisgoodforlearner.com). Account: `sfoutcomeupdated`, Salesforce connected to the shared dev org (saleshandy-dev-ed). The workflow ticket is AL-4134 (parent AL-4131). No bug tickets are known for this trigger, so Ticket is None on every row.

Scope is the trigger "Prospect Outcome is updated in Saleshandy" with all 10 activities. Each activity that has a Select Outcome gets one row where the outcome matches and one where it does not. Attach Note and Record(log) an Email Activity get their own rows. 25 rows in total.

Rows marked "(proposed, unconfirmed)" have an Expected that is not documented. Run them and record what happens. A different result is reported as unconfirmed, not as a bug, until QA confirms it. A non-matching outcome must not trigger the workflow; if it does, that is a bug. On a non-matching row the test checks that nothing was created or changed in Salesforce. A Logs row is allowed and its status is recorded. Records are always verified in Salesforce itself, because a Success row in Logs does not prove the record exists.

Open points carried with the defaults below until QA answers (2026-10-21): an Update finds its record by email for Lead and Contact (seen for Update a Lead in Reply Received), by Account Name for Account, and by a name containing the prospect's email for Opportunity. Those last two are guesses. Uncategorized and Do Not Contact are assumed to fire like the other outcomes. Record Email Activity is assumed to log on an outcome change.

Not covered, still open: an outcome set by an email reply, custom outcomes, a second sequence, mapped versus unmapped field variations, Closing date other than 1 Day, special characters.

## Test data setup

- Field Mapping (Settings > Integrations > Salesforce > Field Mapping) is saved on all four tabs before any row, copied from `context/salesforce/00-overview.md`.
- Triggers & Activity: every other trigger is off. Only "Prospect Outcome is updated in Saleshandy" is on, with the activities of the row's group. Extra Configuration is filled as written under each activity, then Save.
- Each row has its own new prospect with a unique name and email, added to one launched sequence, one at a time. Step 1 shows Sent before the outcome changes. The prospect starts at "Add Outcome".
- Update rows: the Salesforce record is made by hand first with stale values (the prospect keeps its own values), so a change on the record proves the update.
- The outcome is changed in Sequence > the sequence > Prospects, with the outcome dropdown.
- Matching rows: poll Salesforce for up to 3 minutes. Non-matching rows: wait 3 minutes, refreshing Logs 15 s after the change and then every 10 s. Log entries are not opened.
- Created data stays on the org. Existing Salesforce records are never edited. 22 prospects means 22 sends.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger off, no activity chosen | Turn on "Prospect Outcome is updated in Saleshandy" and open the activity list | The list shows Create a Account, Update a Account, Create a Contact, Update a Contact, Create a Lead, Update a Lead, Create a Opportunity, Update a Opportunity, Attach Note and Record(log) an Email Activity | None |
| 2 | Trigger on | Choose "Create a Opportunity in Salesforce" | Extra Configuration opens with Closing date (while creating) in Days, Opportunity Stage and Select Outcome | None |
| 3 | Trigger on | Choose "Update a Opportunity in Salesforce" | Extra Configuration opens with Closing date (while updating) in Days, Opportunity Stage and Select Outcome | None |

## Create a Account in Salesforce

Extra Configuration: Select Outcome = Uncategorized.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with a Company, no Account for it created by this prospect | Change outcome to Uncategorized | One more Account with Account Name = the prospect's Company. (proposed, unconfirmed) Billing City = the prospect's City | None |
| 2 | Same setup, outcome not matching | Change outcome to Interested | No new Account in Salesforce. Logs row, if any, is recorded | None |

## Update a Account in Salesforce

Extra Configuration: Select Outcome = Interested.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Account named after the prospect's Company exists with an old Billing City | Change outcome to Interested | (proposed, unconfirmed) The Account shows the prospect's City as Billing City, no new Account | None |
| 2 | Same setup, outcome not matching | Change outcome to Not Interested | Account keeps its old Billing City. Logs row, if any, is recorded | None |

## Create a Contact in Salesforce

Extra Configuration: Select Outcome = Not Interested.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with all mapped fields, no Contact in Salesforce | Change outcome to Not Interested | Exactly one Contact with Name, Email, Business Phone, Department and Other City matching the prospect, and no Lead created | None |
| 2 | Same setup, outcome not matching | Change outcome to Meeting Booked | No Contact and no Lead in Salesforce. Logs row, if any, is recorded | None |

## Update a Contact in Salesforce

Extra Configuration: Select Outcome = Meeting Booked.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact with the prospect's email exists with no Department and no Business Phone | Change outcome to Meeting Booked | (proposed, unconfirmed) The same Contact shows the prospect's Department, Business Phone and Other City, still one Contact | None |
| 2 | Same setup, outcome not matching | Change outcome to Out of Office | Contact still has no Department and no Business Phone. Logs row, if any, is recorded | None |
| 3 | No Contact for the prospect in Salesforce | Change outcome to Meeting Booked | (proposed, unconfirmed) No Contact is created. Record the Logs status | None |

## Create a Lead in Salesforce

Extra Configuration: Select Outcome = Out of Office.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with all mapped fields, no Lead in Salesforce | Change outcome to Out of Office | Exactly one Lead with the prospect's Name, Email, Company, Title, Phone and City | None |
| 2 | Same setup, outcome not matching | Change outcome to Closed | No Lead in Salesforce. Logs row, if any, is recorded | None |
| 3 | A Lead with the prospect's email already exists | Change outcome to Out of Office | (proposed, unconfirmed) Still exactly one Lead for that email. The org duplicate rule is unread | None |

## Update a Lead in Salesforce

Extra Configuration: Select Outcome = Closed.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Lead with the prospect's email exists with an old Title, Phone and Company | Change outcome to Closed | The same Lead shows the prospect's Title and Phone, still one Lead | None |
| 2 | Same setup, outcome not matching | Change outcome to Not Now | Lead keeps its old Title and Phone. Logs row, if any, is recorded | None |

## Create a Opportunity in Salesforce

Extra Configuration: Closing date = 1 Day, Opportunity Stage = Prospecting, Select Outcome = Not Now.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with a Deal Value, no Opportunity | Change outcome to Not Now | (proposed, unconfirmed) One Opportunity named with the prospect's email, Stage Prospecting, Close Date the next day, Amount = Deal Value | None |
| 2 | Same setup, outcome not matching | Change outcome to Do Not Contact | No Opportunity for the prospect in Salesforce. Logs row, if any, is recorded | None |

## Update a Opportunity in Salesforce

Extra Configuration: Closing date = 1 Day, Opportunity Stage = Qualification, Select Outcome = Do Not Contact.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Opportunity named with the prospect's email exists at Stage Prospecting with an old Amount | Change outcome to Do Not Contact | (proposed, unconfirmed) The same Opportunity shows Stage Qualification, Amount = Deal Value and Close Date the next day, still one Opportunity | None |
| 2 | Same setup, outcome not matching | Change outcome to Uncategorized | Opportunity stays at Prospecting with its old Amount. Logs row, if any, is recorded | None |

## Attach Note in Salesforce

Extra Configuration: none. Rows 1 and 2 use Create a Contact (Select Outcome = Not Interested) saved with it.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect, no Contact, Create a Contact and Attach Note saved | Change outcome to Not Interested | One Contact with one Note on it. (proposed, unconfirmed) Note content for an outcome change is not documented, record it | None |
| 2 | Same pair, outcome not matching | Change outcome to Meeting Booked | No Contact and no Note in Salesforce. Logs row, if any, is recorded | None |
| 3 | Attach Note saved alone, no Contact activity | Change outcome to Interested | (proposed, unconfirmed) No Note is created. Record the Logs status | None |

## Record(log) an Email Activity in Salesforce

Extra Configuration: Contact checked (Lead and Opportunity unchecked). It has no Select Outcome.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact with the prospect's email exists | Change outcome to Interested | (proposed, unconfirmed) One email activity on the Contact. Record its description | None |
