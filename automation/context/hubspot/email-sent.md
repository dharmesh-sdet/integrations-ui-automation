# Email Sent from Saleshandy

Readiness for scenario generation: Ready.

Jira sub-task: AL-4010

Naming: the trigger is "Email Sent from Saleshandy"; Logs show the workflow as "Email sent from Saleshandy". Both refer to the same workflow.

Direction: Saleshandy to HubSpot (the trigger is an email sent by a Saleshandy sequence; every activity acts on HubSpot records).

Release scope note: The production smoke test excludes the tickets that are still open. See Tickets below for which ones.

Menu labels such as Sequence/Sequences should be confirmed in the live UI (for example with the Playwright MCP server).

## Tickets

| Ticket | Summary (short) | Status (as of 2026-10-08) |
|---|---|---|
| AL-4026 | Create a Contact does not map company name, industry, country when Extra Configuration skipped | Done |
| AL-4027 | Create a Contact errors when Lead Status and Lead Lifecycle selected | Done |
| AL-4028 | Fails when updating a deal | Done |
| AL-4029 | Create a Company errors, company not created | Done |
| AL-4030 | Update a Company does not update the company | Done |
| AL-4031 | Create a Task errors for an existing contact; label "Exixting" | Done |
| AL-4032 | Create a Contact + Create a Note errors with Lead Status/Lifecycle set | Done |
| AL-4033 | Create a Deal + Create a Note errors with Deal Value/Closing Date populated | Done |
| AL-4034 | Create a Contact + Record Email Activity errors with Lead Status/Lifecycle set | Done |
| AL-4035 | Update a Contact + Record Email Activity errors with Deal Value/Closing Date | Done |
| AL-4036 | HubSpot contact not created on email sent (no description in Jira; its scenario is not documented, ask the user) | READY FOR QA. Open, exclude from smoke |
| AL-4037 | Create a Deal + Record Email Activity errors with Deal Value/Closing Date | Done |
| AL-4038 | Update a Deal + Record Email Activity shows Success but deal not updated | Done |
| AL-4051 | Create/Update Deal Closing Date one day short | Done |
| AL-4093 | Create a Contact invalid data type error for the Hiring Date Picker custom field | To Do. Open, exclude from smoke |
| AL-4096 | Update a Deal + Create a Note errors when the prospect has an existing Closing Date | To Do. Open, exclude from smoke |
| AL-4097 | Create a Note Variant letter increments wrongly with no A/B variants | Done |
| AL-4100 | Update a Company updates the first associated company instead of the latest | Done |
| AL-4101 | Create a Task allows Due in 0 and an empty Task title | Done |
| AL-4102 | Create a Deal + Record Email Activity logs on the deal but not the contact | Done |
| AL-4103 | Update a Deal updates an older deal instead of the latest (paired with Record Email Activity) | Done |
| AL-4104 | Create/Update Deal and Company ignore mapped Deal Name and Company Name | To Do. Open, exclude from smoke |

## What it does

When a Saleshandy sequence sends an email to a prospect, the "Email sent from Saleshandy" workflow runs and performs the selected HubSpot activities (create or update a contact, deal or company, create a task, create a note, or record the email activity). The prospect has to be added to an active sequence; once the email is sent, the other activities run.

Create a deal and Create a company also create the HubSpot contact when it does not exist yet (confirmed intended behavior).

## Activities

Order matches the product UI.

| # | Activity | Extra Configuration options | Notes on how it behaves |
|---|---|---|---|
| 1 | Create a Contact in HubSpot | Lead Status, Lead Lifecycle. Can be skipped (Save without selecting). | Creates the contact with the mapped fields and the configured Lead Status and Lead Lifecycle. HubSpot lifecycle stages only move forward and block backward moves (HubSpot behavior, not a Saleshandy defect). Once the Extra Configuration fields are filled they cannot be made empty again (noted as expected). If the contact already exists in HubSpot, the contact details get updated. On production, company association does not happen when the contact is created, because the HubSpot portal setting "Create and associate companies with contacts" is turned off there (see Prerequisites and setup). |
| 2 | Update a Contact in HubSpot | Update Lead Status, Update Lead Lifecycle. Can be skipped. | Updates an existing HubSpot contact with the mapped fields. If the contact is not in HubSpot, the workflow shows Success and no contact is created. Same forward-only lifecycle rule as Create. If the prospect's details in Saleshandy were not changed, the HubSpot contact is not updated. |
| 3 | Create a deal in HubSpot | Select a Pipeline, Select Pipeline Stage, Deal Type, Deal Priority, Closing Date (while creating, in Days, default 0 Days). Can be skipped. | Creates a new deal and associates it to the contact; the deal name is currently set to the prospect's first name plus last name (AL-4104, open: a mapped Deal Name is ignored, so do not assert the deal name in scenarios). A new deal is created even if the contact already has deals. If the contact is not in HubSpot, the contact is also created. The prospect's Deal Value goes to the deal Amount; the Extra Configuration Closing Date overrides the prospect's Closing Date. 0 Days gives no close date; N Days gives a close date N days ahead, matching the configured value exactly (for example 51 Days gives 51 days, not 50, AL-4051). |
| 4 | Update a deal in HubSpot | Same fields as Create a deal (Pipeline, Pipeline Stage, Deal Type, Deal Priority, Closing Date while updating, in Days). Can be skipped. | Requires a deal that already exists for the contact. When the contact has multiple deals, the latest created deal is the one updated, not the oldest or first created (confirmed intended behavior; fixed under AL-4103). If the contact is not in HubSpot, or has zero deals, nothing is created or updated. A deal already updated is updated again only if the Extra Configuration values change. |
| 5 | Create a company in HubSpot | None. | Creates a new company every time, even if a company with the same domain exists (HubSpot allows duplicate domains), and associates it to the contact. If the contact is not in HubSpot, the contact is also created. With empty company details, the company is created from the company domain. With the HubSpot portal setting "Create and associate companies with contacts" on, two companies are created (see Prerequisites and setup). |
| 6 | Update a company in HubSpot | None on this trigger. | Requires the company to be present in HubSpot and associated to the contact. When the contact has multiple companies, the latest associated company is the one updated (expected behavior, AL-4100). With no associated company, or a contact not in HubSpot, the workflow shows Success and nothing is created or updated. |
| 7 | Create a Task in HubSpot | Task title, Task Type (Call, Email, Sales Navigator - Connection Request, Sales Navigator - InMail, To-do), Task Priority (None, Low, Medium, High), Due in (Days). Due in 0 and an empty Task title cannot be saved (AL-4101). | Creates a task associated to the contact. If the contact is not in HubSpot, the contact is created and the task is created too. The log action label for an existing contact is "Create task for existing contact" (was misspelled "Exixting", AL-4031). |
| 8 | Create a Note in HubSpot | None. Must be paired with Create/Update a Contact or Create/Update a Deal. | Hover note (tooltip on the activity): creating a note alone fails, a contact or deal must be created or updated to associate the note. The note records the sequence Step and Variant and the Prospect Outcome value, and appears on both contact and deal. On a sequence with no A/B variants the Variant should stay A (AL-4097). |
| 9 | Record (log) an email activity in HubSpot | None. Must be paired with Create/Update a Contact or Create/Update a Deal. | Hover note (tooltip on the activity): "Logging an email alone would result in failure. Please create/update contact or deal to associate an email." The workflow can still be saved with only this activity. The logged email shows From, To, "logged email by", creation date and time, and the body of the sequence step. A follow-up step appears as a separate activity. When paired with Create a deal, the activity should appear on both the deal and the contact (AL-4102). |

## Prerequisites and setup

- Environment: Staging (pyxis.lifeisgoodforlearner.com). Production is tested on a new user account on the production environment; no URL is documented.
- Field mapping between Saleshandy and HubSpot must be configured (Contact, Deal and Company properties). If mapping is not configured while the trigger is enabled, data may not be created. Mapping used: see the Field mapping section in 00-overview.md (for example Company HQ Location maps to Country/Region Code, Deal Value to Amount, Closing Date to Close Date).
- HubSpot portal setting "Create and associate companies with contacts", at HubSpot Settings > Data Management > Objects > Companies > Setup (newer portals: Settings > Objects > Companies). When it is on, HubSpot auto-creates a company from the contact's email domain when the workflow creates the contact, so Create a Company produces two companies ("created from CRM Setting" and "created from Saleshandy"). Fix: turn it off and save; then only the Saleshandy company is created.
- A sequence that is started (active), so that adding a prospect sends the email. For Note Step/Variant checks, a sequence with 2 or more active steps.
- For Create a Contact (and Create a Contact pairings): the prospect must not exist as a contact in HubSpot. Use a brand-new prospect with an email not in HubSpot.
- For Update a Contact, Create a deal on an existing contact, Create a Task and Update pairings: the contact must already exist in HubSpot and the same prospect must exist in Saleshandy.
- For Update a deal: the contact must already have a deal.
- For Update a company: the company must be present in HubSpot and associated to the contact.
- Test data to prepare (production): a contact with 3 deals, a contact with 2 associated companies, and a contact whose prospect has Deal Value and Closing Date populated in the Deals section of the prospect's profile.

## How to execute

1. Go to Settings > Integrations > HubSpot > Triggers & Activities and enable the "Email Sent from Saleshandy" trigger.
2. Select the activity (or activities, for pairings).
3. Open Extra Configuration for the activity, select the options (or leave them empty where allowed) and click Save in the modal.
4. Click Save on the Triggers & Activities page.
5. In Saleshandy, update the prospect details if the mapped fields need to be verified.
6. Go to Sequence, open the active sequence, and add the prospect, so the email is sent.
7. Wait for the email to be sent, then open Settings > Integrations > HubSpot > Logs and check the "Email sent from Saleshandy" workflow status (Success, Error, or In progress/Running). Wait time: Not documented. On Error, click the log entry's status to open its details drawer and see which action has the Errored label.
8. Check the result in HubSpot (contact, deal, company, task, note, or email activity).

Tip, re-triggering an email to a prospect (force send): go to the active sequence and add the prospect by clicking Add Prospects. Once the prospect is added, go to the Emails tab of the same sequence, find the row of the recently imported prospect, open the three vertical dots menu on that row, and choose Send now.

## Activity-specific execution notes

- Create a Note in HubSpot: always pair it with Create a Contact, Update a Contact, Create a deal or Update a deal (tested in those four pairings).
- Record (log) an email activity in HubSpot: pair it with one of four options, Create a Contact (prospect must not be in HubSpot), Update a Contact, Create a deal, or Update a deal.
- Update a Contact: if the prospect was added while it was not a HubSpot contact, the email has to be sent again once the contact exists. To re-trigger, use the force send tip above.
- Create a Task: fill Task title, Type, Priority and Due in; the modal cannot be saved with an empty title or Due in 0.
- Create a company: no Extra Configuration step; trigger by sending the email to a prospect with company details. Check the HubSpot portal setting "Create and associate companies with contacts" first (see Prerequisites and setup).
- Update a company: no Extra Configuration on this trigger. Update the prospect's company details in Saleshandy first, then add the prospect to the active sequence.

## Where to verify

- Saleshandy: Settings > Integrations > HubSpot > Logs. Workflow status (Success, Error, or In progress/Running) and the details drawer per action (click the log entry's status); the execution response can include the note URL.
- HubSpot > Contacts: contact properties (All properties), Lead Status, Lifecycle Stage, and associated company.
- HubSpot contact > Activities > Notes, for notes. Email activity appears in the activity section of the HubSpot contact and the HubSpot deal.
- HubSpot deal: Amount, Close Date, Days to Close, Deal Stage, Pipeline, Priority, Deal Type, deal name.
- HubSpot company: company properties (Company name, domain, industry, Country/Region).
- HubSpot task on the contact: title, type, priority, due date.

## Open questions (unknown, ask the user before generating)

None recorded.
