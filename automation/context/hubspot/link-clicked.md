# Link Clicked in Saleshandy

Readiness for scenario generation: Ready.

Jira sub-task: AL-4014

Naming: "Link Clicked in Saleshandy" is the name used in testing and in Logs; "Link is Clicked in Saleshandy" is the name in Jira.

Direction: Saleshandy to HubSpot (trigger: a prospect clicks a tracked link in a sequence email; action: the selected HubSpot activity, for example Create a Contact in HubSpot).

Release scope note: None.

Menu labels such as Sequence/Sequences should be confirmed in the live UI (for example with the Playwright MCP server).

## Tickets

This workflow has no tickets of its own. The AL-4103 fix (Update a deal updates the latest created deal; status Done as of 2026-10-08) was also applied to this workflow.

## What it does

- When a prospect in an active Saleshandy sequence clicks a tracked link in a sequence email, the workflow "Link Clicked in Saleshandy" fires and runs the selected HubSpot activity.
- All 9 activities have the same Extra Configuration and the same behavior as on Email Sent from Saleshandy (email-sent.md); only the trigger event differs (confirmed intended behavior).
- With Create a Contact in HubSpot: if the contact is not in HubSpot, it is created; if it is already in HubSpot, its contact details are updated.
- When the email has multiple links, clicking a second link triggers the workflow again (a new log entry), and the clicked count in Sequences > Emails increases (1 to 2).
- The AL-4103 fix (when the contact has multiple deals, the latest created deal is the one updated) was also applied to this workflow.

## Activities

Order matches the product UI. The activities are the same 9 as Email Sent from Saleshandy, in the same order, with the same Extra Configuration and the same behavior. Only Create a Contact in HubSpot was tested on this trigger; the behavior of the others is copied from email-sent.md (same activity number). Ticket references for those behaviors belong to Email Sent; on this trigger use "None" in the Ticket column, except AL-4103 for Update a deal.

| # | Activity | Extra Configuration options | Notes on how it behaves |
|---|---|---|---|
| 1 | Create a Contact in HubSpot | Lead Status, Lead Lifecycle. Can be skipped (Save without selecting). | Tested on this trigger: creates the contact in HubSpot if not present; updates the contact details if already present. Fires again on a click of another link in the same email. Otherwise same as Email Sent: created with the mapped fields and the configured Lead Status and Lead Lifecycle; lifecycle stages only move forward (HubSpot behavior). |
| 2 | Update a Contact in HubSpot | Update Lead Status, Update Lead Lifecycle. Can be skipped. | Same as Email Sent: updates an existing HubSpot contact with the mapped fields. If the contact is not in HubSpot, the workflow shows Success and no contact is created. Forward-only lifecycle rule. If the prospect's details in Saleshandy were not changed, the HubSpot contact is not updated. |
| 3 | Create a deal in HubSpot | Select a Pipeline, Select Pipeline Stage, Deal Type, Deal Priority, Closing Date (while creating, in Days, default 0 Days). Can be skipped. | Same as Email Sent: creates a new deal and associates it to the contact; the deal name is currently set to the prospect's first name plus last name (AL-4104, open: a mapped Deal Name is ignored, so do not assert the deal name in scenarios). A new deal is created even if the contact already has deals. If the contact is not in HubSpot, the contact is also created. The prospect's Deal Value goes to the deal Amount; the Extra Configuration Closing Date overrides the prospect's Closing Date. 0 Days gives no close date; N Days gives a close date N days ahead, matching the configured value exactly (for example 51 Days gives 51 days, not 50, AL-4051). |
| 4 | Update a deal in HubSpot | Same fields as Create a deal (Pipeline, Pipeline Stage, Deal Type, Deal Priority, Closing Date while updating, in Days). Can be skipped. | Same as Email Sent: requires a deal that already exists for the contact. When the contact has multiple deals, the latest created deal is the one updated (AL-4103 fix, also applied here). If the contact is not in HubSpot, or has zero deals, nothing is created or updated. A deal already updated is updated again only if the Extra Configuration values change. |
| 5 | Create a company in HubSpot | None. | Same as Email Sent: creates a new company every time, even if a company with the same domain exists, and associates it to the contact. If the contact is not in HubSpot, the contact is also created. With empty company details, the company is created from the company domain. With the HubSpot portal setting "Create and associate companies with contacts" on, two companies are created (see 00-overview.md). |
| 6 | Update a company in HubSpot | None. | Same as Email Sent: requires the company to be present in HubSpot and associated to the contact. When the contact has multiple companies, the latest associated company is the one updated. With no associated company, or a contact not in HubSpot, the workflow shows Success and nothing is created or updated. |
| 7 | Create a Task in HubSpot | Task title, Task Type (Call, Email, Sales Navigator - Connection Request, Sales Navigator - InMail, To-do), Task Priority (None, Low, Medium, High), Due in (Days). Due in 0 and an empty Task title cannot be saved. | Same as Email Sent: creates a task associated to the contact. If the contact is not in HubSpot, the contact is created and the task is created too. The log action label for an existing contact is "Create task for existing contact". |
| 8 | Create a Note in HubSpot | None. Must be paired with Create/Update a Contact or Create/Update a Deal. | Same as Email Sent: creating a note alone fails. The note records the sequence Step and Variant and the Prospect Outcome value, and appears on both contact and deal. On a sequence with no A/B variants the Variant stays A. |
| 9 | Record (log) an email activity in HubSpot | None. Must be paired with Create/Update a Contact or Create/Update a Deal. | Same as Email Sent: logging an email alone fails. The logged email shows From, To, "logged email by", creation date and time, and the body of the sequence step. When paired with Create a deal, the activity appears on both the deal and the contact. |

## Prerequisites and setup

- Environment: Staging (pyxis.lifeisgoodforlearner.com). Production is tested on a new user account on the production environment; no URL is documented.
- HubSpot integration connected and Field Mapping configured. Field mapping is required: if mapping is not configured while a trigger/activity is enabled, data may not be created in either Saleshandy or HubSpot.
- A custom tracking domain set up.
- An active sequence (create and enable one, or select an existing active sequence).
- In the sequence: Sequence Settings > Safety Settings > enable Track Link Clicks.
- The sequence step email has a link in the body (add or update the step's email). Testing covered a step with a single link and a step with multiple links.
- Test data: a prospect whose contact already exists in HubSpot, and a prospect whose contact does not. For activities 2 to 9, the same record setup as the matching activity in email-sent.md (for example a contact with multiple deals for Update a deal).

## How to execute

1. Go to Settings > Integrations > HubSpot > Triggers & Activities, enable the "Link Clicked in Saleshandy" trigger, select the activity (for example "Create a Contact in HubSpot"), complete the Extra Configuration (Lead Status, Lead Lifecycle for Create a Contact), click Save in the modal, then Save on the Triggers & Activities page.
2. For the contact-already-in-HubSpot case, first update the prospect's details in Saleshandy.
3. Add a single prospect to the active sequence.
4. Wait for the prospect to receive the sequence email containing the link.
5. Wait 1 to 2 minutes (the tester's practice), then click the link (or one of the links).
6. Go to the sequence > Prospects and refresh; in the current step stats column, the link clicked icon is highlighted purple when the link was clicked.
7. Go to Settings > Integrations > HubSpot > Logs and check that a log was created for the workflow Link Clicked in Saleshandy (Success, Error, or In progress/Running; click the log entry's status to open its details drawer).
8. Check the result in HubSpot (for Create a Contact: HubSpot > Contacts, contact created or its details updated).

## Clicking the link and the click delay (QA, 2026-10-08)

- Mailbox: prospect emails are Mailinator addresses. Go to mailinator.com, type the prospect's email in the input field, click Go, open the sequence email in the inbox, and click the link in it.
- Click right away once the email is open; no wait before the click.
- The click takes time to show in Saleshandy (drop-back time). Maximum 1 to 1.5 minutes (confirmed by the developer). If the clicked count has not increased yet, keep waiting.
- The Logs entry for Link Clicked in Saleshandy is checked only after the click shows in Saleshandy.
- To send the email quickly in tests: Emails tab > the prospect's row > three dots > Send now (same as Email Sent).

## Activity-specific execution notes

- Create a Contact in HubSpot, multiple links: after the first click is checked, update the prospect details again, wait about 3 minutes (the tester's practice), then click the second link; check for a new log entry, the clicked count in Sequences > Emails going from 1 to 2, and the contact details updated in HubSpot.
- Activities 2 to 9: follow the matching activity-specific notes in email-sent.md (pairing for Create a Note and Record (log) an email activity, required records), with the link click as the trigger event instead of the email being sent.

## Where to verify

- Click registered: sequence > Prospects (refresh), current step stats column, purple link clicked icon. Click count: Sequences > Emails, clicked number.
- Workflow execution: Settings > Integrations > HubSpot > Logs, log for the workflow Link Clicked in Saleshandy.
- HubSpot result: HubSpot > Contacts, contact created or details updated; for other activities, the same HubSpot records as in email-sent.md (deal, company, task, note, email activity).

## Open questions (unknown, ask the user before generating)

None recorded.
