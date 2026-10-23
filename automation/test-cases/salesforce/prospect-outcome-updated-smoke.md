# Prospect Outcome is updated in Saleshandy: Smoke scenarios

Environment: Production, tested by hand. The workflow ticket is AL-4134 (parent AL-4131). No bug tickets are known for this trigger, so Ticket is None on every row.

Scope is the trigger "Prospect Outcome is updated in Saleshandy" with all 10 activities, one row each. Rows marked "(proposed, unconfirmed)" have an Expected that is not documented. A different result is reported as unconfirmed, not as a bug, until QA confirms it. Records are verified in Salesforce itself.

## Test data setup

- Field Mapping is saved on all four tabs before any row.
- Triggers & Activity: every other trigger is off. Only "Prospect Outcome is updated in Saleshandy" is on, with the activity of the row. Extra Configuration is filled as written under each activity, then Save.
- Each row has its own new prospect, added to one launched sequence. Step 1 shows Sent before the outcome changes.
- Update rows: the Salesforce record is made by hand first with stale values, so a change on the record proves the update.
- The outcome is changed in Sequence > the sequence > Prospects, with the outcome dropdown.

## Create a Account in Salesforce

Extra Configuration: Select Outcome = Uncategorized.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with a Company, no Account for it | Change outcome to Uncategorized | One more Account with Account Name = the prospect's First Name + Last Name. (proposed, unconfirmed) Billing City = the prospect's City - Pass | None |

## Update a Account in Salesforce

Extra Configuration: Select Outcome = Interested.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 2 | Account named after the prospect's First Name + Last Name exists with an old Billing City | Change outcome to Interested | (proposed, unconfirmed) The Account shows the prospect's City as Billing City, no new Account - Pass | None |

## Create a Contact in Salesforce

Extra Configuration: Select Outcome = Not Interested. Attach Note is saved with it.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 3 | New prospect with all mapped fields, no Contact | Change outcome to Not Interested | Exactly one Contact with Name, Email, Business Phone, Department and Other City matching the prospect, no Lead created, and one Note on the Contact - Pass | None |
| 4 | Same setup, outcome not matching | Change outcome to Meeting Booked | No Contact and no Lead in Salesforce. Logs row, if any, is recorded - Pass | None |

## Update a Contact in Salesforce

Extra Configuration: Select Outcome = Meeting Booked.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 5 | Contact with the prospect's email exists with no Department and no Business Phone | Change outcome to Meeting Booked | (proposed, unconfirmed) The same Contact shows the prospect's Department, Business Phone and Other City, still one Contact - Pass | None |

## Create a Lead in Salesforce

Extra Configuration: Select Outcome = Out of Office.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 6 | New prospect with all mapped fields, no Lead | Change outcome to Out of Office | Exactly one Lead with the prospect's Name, Email, Company, Title, Phone and City - Pass | None |

## Update a Lead in Salesforce

Extra Configuration: Select Outcome = Closed.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 7 | Lead with the prospect's email exists with an old Title, Phone and Company | Change outcome to Closed | The same Lead shows the prospect's Title and Phone, still one Lead - Pass | None |

## Create a Opportunity in Salesforce

Extra Configuration: Closing date = 1 Day, Opportunity Stage = Prospecting, Select Outcome = Not Now.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 8 | New prospect with a Deal Value, no Opportunity | Change outcome to Not Now | (proposed, unconfirmed) One Opportunity named with the prospect's email, Stage Prospecting, Close Date the next day, Amount = Deal Value - Pass | None |

## Update a Opportunity in Salesforce

Extra Configuration: Closing date = 1 Day, Opportunity Stage = Qualification, Select Outcome = Do Not Contact.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 9 | Opportunity named with the prospect's email exists at Prospecting with an old Amount | Change outcome to Do Not Contact | (proposed, unconfirmed) The same Opportunity shows Stage Qualification, Amount = Deal Value and Close Date the next day, still one Opportunity - Pass | None |

## Record(log) an Email Activity in Salesforce

Extra Configuration: Contact checked (Lead and Opportunity unchecked). It has no Select Outcome.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 10 | Contact with the prospect's email exists | Change outcome to Interested | (proposed, unconfirmed) One email activity on the Contact, description recorded - Pass | None |
