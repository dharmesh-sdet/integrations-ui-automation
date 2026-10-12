# Prospect Outcome is updated in Saleshandy

Readiness for scenario generation: Ready (include the Open questions below in the one-round question batch).

Jira sub-task: AL-4012

Direction: Saleshandy to HubSpot (the trigger is a prospect outcome change in a Saleshandy sequence; every activity acts on HubSpot records).

Release scope note: The production smoke test excludes the tickets that are still open. See Tickets below for which ones.

Menu labels such as Sequence/Sequences should be confirmed in the live UI (for example with the Playwright MCP server).

## Tickets

| Ticket | Summary (short) | Status (as of 2026-10-08) |
|---|---|---|
| AL-4025 | Fails when creating a contact in HubSpot | Done |
| AL-4060 | Update a Contact shows Success but does not update | Done |
| AL-4061 | Create a Deal shows Success but deal not created | Done |
| AL-4062 | Update a Deal does not trigger, no log | Done |
| AL-4063 | Create a Company does not trigger, no log | Done |
| AL-4064 | Update a Company does not trigger, no log | Done |
| AL-4065 | Create a Task does not trigger, no log | Done |
| AL-4105 | Create a Contact triggers when the new outcome is not selected | Done |
| AL-4106 | Create a Contact errors with Hiring Date Picker mapped | To Do. Open, exclude from smoke |
| AL-4107 | Create a Deal creates the contact without mapped properties | Done |
| AL-4108 | Update a Deal updates the first deal instead of the latest | Done |
| AL-4109 | Update a Company shows Success but does not update | Done |
| AL-4110 | Update a Company does not update the latest associated company (two companies) | Done |
| AL-4111 | Create a Task Extra Configuration fields appear red on modal reopen | Done |
| AL-4112 | Create a Task also adds a note to the contact | Done |
| AL-4113 | Record Email Activity has empty description and Unknown Contact | Done (expected behavior, no email is sent) |

## What it does

When the outcome of a prospect in a Saleshandy sequence is changed, the workflow runs the selected HubSpot activity, but only if the new outcome matches the outcome selected in Extra Configuration (Select Outcome). Select Outcome is a single value (one outcome only). If the new outcome is not the selected one, the sync is blocked and nothing should be created or updated (fixed under AL-4105).

Available prospect outcomes (dropdown): Uncategorized, Interested, Not Interested, Meeting Booked, Out of office, Closed, Not Now, Do not Contact. A prospect with no outcome yet shows "Add Outcome". The outcome can also change based on the prospect's email reply; whether that change fires this workflow is unknown.

## Activities

Order matches the product UI.

| # | Activity | Extra Configuration options | Notes on how it behaves |
|---|---|---|---|
| 1 | Create a Contact in HubSpot | Lead Status, Lead Lifecycle, Select Outcome (while creating contact). | Creates the contact with the mapped properties and configured values when the outcome matches. If the contact already exists in HubSpot, its properties are updated if anything changed (no duplicate). Same prospect in a second sequence: no second contact. A recorded case with Extra Configuration "left as is" is unclear (see Open questions). |
| 2 | Update a Contact in HubSpot | Update Lead Status, Update Lead Lifecycle, Select Outcome (the update runs only if the prospect outcome is this one). | Updates an existing contact with the changed prospect details and configured Lead Status and Lead Lifecycle. Contact not in HubSpot: workflow Success, no contact created. Outcome changed but no prospect details changed in Saleshandy: workflow Success, contact not updated. Moving backward, Lead Status changes but Lead Lifecycle stays the same. |
| 3 | Create a deal in HubSpot | Pipeline, Pipeline Stage, Deal Type, Deal Priority, Closing Date (Days), Select Outcome. The modal can be saved with empty fields (then nothing happens even though the workflow is Success). | Creates a deal and associates it to the contact. Contact not in HubSpot: contact and deal are created and associated, contact with mapped properties (AL-4107 fix). Contact already has deals: a new deal is created, existing deals unchanged. Deal Value goes to Amount; Closing Date 0 Days gives an empty close date, 1 Day gives the next day. |
| 4 | Update a deal in HubSpot | Pipeline, Pipeline Stage, Deal Type, Deal Priority, Closing Date (Days), Select Outcome. Can be saved empty (then nothing happens on the HubSpot side). | Updates the latest created deal when the contact has multiple deals (AL-4108 fix). Contact in HubSpot with no deal: contact updated, no deal created. Contact not in HubSpot: no contact, no deal. |
| 5 | Create a company in HubSpot | Only one field: Select Outcome (while creating company). | Creates the company and associates the contact. Contact not in HubSpot: contact and company created and associated. Contact already has a company, or a company with the same domain exists: a second company is created (HubSpot allows duplicate domains). Empty company name and website: the company is created from the company domain (same as Email Sent). |
| 6 | Update a company in HubSpot | Select Outcome only. | Updates the company associated to the contact (AL-4109 fix); with two companies, the latest associated company is updated (AL-4110 fix). Contact with no associated company: workflow Success, no company created. Contact and company both not in HubSpot: nothing created. Contact not in HubSpot but company in HubSpot: no contact created, no association. |
| 7 | Create a Task in HubSpot | Task title, Task Type (Call, Email, Sales Navigator - Connection Request, Sales Navigator - InMail, To-do), Task Priority (None, Low, Medium, High), Due in (Days), Select Outcome. Cannot be saved empty; Due in 0 and an empty title are blocked (AL-4101). | Creates the task with the configured values and associates it to the contact. Contact not in HubSpot: contact created and task assigned to it. No extra note should be added to the contact (AL-4112). Reopening the modal should not show the fields in red (AL-4111, from the ticket summary). |
| 8 | Create a Note in HubSpot | None. Must be paired with Create/Update a Contact or Create/Update a Deal. | Same as Email Sent (activity #8 in 06-email-sent.md): the note records the sequence Step, Variant and the Prospect Outcome value, and appears on both the contact and the deal. Must be used in pairs. |
| 9 | Record (log) an email activity in HubSpot | None. Must be paired with Create/Update a Contact or Create/Update a Deal. | When only the outcome changes no email is sent, so the logged email activity has an empty description and From shows Unknown Contact. Expected behavior (AL-4113). |

## Prerequisites and setup

- Environment: Staging (pyxis.lifeisgoodforlearner.com). Production is tested on a new user account on the production environment; no URL is documented.
- Field mapping between Saleshandy and HubSpot must be configured (see the Field mapping section in 00-overview.md). Without it data may not be created.
- An active sequence with test prospects enrolled (the sequence has already run), so the outcome can be changed from the sequence's Prospects tab.
- Extra Configuration Select Outcome set to the one outcome you will change to (smoke testing used Meeting Booked).
- Test data to prepare (production): a contact in HubSpot with no deal, a contact with 3 or more deals, a contact with 1 company, a contact with 2 companies, and a brand-new prospect with an email not in HubSpot.
- For Update a Contact: the contact must already exist in HubSpot for the prospect.
- For Update a company: the company must be associated to the contact; update the company details in Saleshandy first.

## How to execute

1. Go to Settings > Integrations > HubSpot > Triggers & Activities, enable the "Prospect Outcome is updated in Saleshandy" trigger, and select the activity.
2. Open Extra Configuration (for activities that have it), fill the options, including Select Outcome, and click Save in the modal.
3. Click Save on the Triggers & Activities page.
4. In Saleshandy, update the prospect details first if the mapped fields need to be verified.
5. Go to Sequence > the active sequence > Prospects, and change the prospect's outcome (to the outcome selected in Extra Configuration for the sync to run, or to another one to check that nothing happens).
6. Open Settings > Integrations > HubSpot > Logs and check the latest log for this workflow (Success, Error, or In progress/Running). Wait time: Not documented. On Error, click the log entry's status to open its details drawer.
7. Check the result in HubSpot.

## Activity-specific execution notes

- Create a Note in HubSpot: no Extra Configuration. Pair it with Create a Contact, Update a Contact, Create a deal or Update a deal (smoke testing on production used Create a Contact, then Create a deal).
- Record (log) an email activity in HubSpot: no Extra Configuration. Pair it with Update a Contact or Update a deal (smoke testing on production), or with Create a Contact or Create a deal (staging testing).
- Update a Contact / Update a company: change the prospect (or company) details in Saleshandy before changing the outcome. Update a company's Extra Configuration is Select Outcome only.
- Create a Task: the Extra Configuration (Task title, Task Type, Task Priority, Due in (Days), Select Outcome) must be filled; the modal cannot be saved empty.

## Where to verify

- Saleshandy: Settings > Integrations > HubSpot > Logs, latest log for the Prospect Outcome workflow.
- HubSpot contact: mapped properties, Lead Status, Lifecycle Stage, associated deals and companies, tasks, notes, logged email activity (From, description).
- HubSpot deal: Amount, Close Date, Pipeline, Deal Stage, Deal Type, Priority; which deal was updated when there are several.
- HubSpot company: properties and contact association.

## Open questions (unknown, ask the user before generating)

- Create a Contact in HubSpot: testing recorded "Extra Configuration left as is: workflow Success, nothing happens in HubSpot". What "left as is" means (saved with empty fields, or unchanged from a previous save) is unclear, so the expected result for that case is unknown.
- Whether an outcome change caused by the prospect's email reply (not a manual change) fires this workflow is unknown.
