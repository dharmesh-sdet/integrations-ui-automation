# Reply is received in Saleshandy

Readiness for scenario generation: Partial. How to trigger a reply is not documented. Ask the user before generating anything.

Jira sub-task: AL-4011

Direction: Saleshandy to HubSpot (the trigger is a reply in Saleshandy; the actions are HubSpot actions).

Coverage: not yet explored activity by activity. Only Create a Contact in HubSpot has a recorded run.

## Tickets

This workflow has no tickets of its own.

## What it does

When a prospect's email is treated as replied in Saleshandy, the "Reply is received in Saleshandy" workflow runs the selected HubSpot actions. In the one recorded run, a contact got created in HubSpot with the Saleshandy company name associated with it.

## Activities

Order matches the product UI. The activities and their Extra Configuration are the same as Email Sent from Saleshandy (see email-sent.md). The remaining activities are stated to behave exactly as on Email Sent from Saleshandy.

| # | Activity | Extra Configuration options | Notes on how it behaves |
|---|---|---|---|
| 1 | Create a Contact in HubSpot | Lead Status, Lead Lifecycle. Can be skipped (Save without selecting). | Recorded run (no Extra Configuration options selected): contact created in HubSpot with the Saleshandy company name associated. |
| 2 | Update a Contact in HubSpot | Update Lead Status, Update Lead Lifecycle. Can be skipped. | Not explored individually; stated to match activity #2 in email-sent.md. |
| 3 | Create a deal in HubSpot | Select a Pipeline, Select Pipeline Stage, Deal Type, Deal Priority, Closing Date (while creating, in Days, default 0 Days). Can be skipped. | Not explored individually; stated to match activity #3 in email-sent.md. |
| 4 | Update a deal in HubSpot | Same fields as Create a deal (Pipeline, Pipeline Stage, Deal Type, Deal Priority, Closing Date while updating, in Days). Can be skipped. | Not explored individually; stated to match activity #4 in email-sent.md. |
| 5 | Create a company in HubSpot | None. | Not explored individually; stated to match activity #5 in email-sent.md. |
| 6 | Update a company in HubSpot | None. | Not explored individually; stated to match activity #6 in email-sent.md. |
| 7 | Create a Task in HubSpot | Task title, Task Type (Call, Email, Sales Navigator - Connection Request, Sales Navigator - InMail, To-do), Task Priority (None, Low, Medium, High), Due in (Days). | Not explored individually; stated to match activity #7 in email-sent.md. |
| 8 | Create a Note in HubSpot | None. Must be paired with Create/Update a Contact or Create/Update a Deal. | Not explored individually; stated to match activity #8 in email-sent.md. |
| 9 | Record (log) an email activity in HubSpot | None. Must be paired with Create/Update a Contact or Create/Update a Deal. | Not explored individually; stated to match activity #9 in email-sent.md. What gets logged for a reply is not documented (see Open questions). |

## Prerequisites and setup

- Environment: Staging (pyxis.lifeisgoodforlearner.com). Production is tested on a new user account on the production environment; no URL is documented.
- Field mapping between Saleshandy and HubSpot must be configured; without it data may not be created. Mapping used: Field mapping section in 00-overview.md.
- In the recorded run, prospects that can provide a response were imported into the sequence, and a new prospect was added to the sequence so an email was sent first.

## How to execute

1. Go to Settings > Integrations > HubSpot > Triggers & Activities, enable the "Reply is received in Saleshandy" trigger, and select the activity.
2. Fill the Extra Configuration if needed, click Save in the modal, then Save on the Triggers & Activities page.
3. Trigger a reply: Not documented yet. Unknown, ask the user.
4. Check the workflow in Settings > Integrations > HubSpot > Logs (Success, Error, or In progress/Running; click the log entry's status to open its details drawer). Wait time: Not documented.
5. Check the result in HubSpot.

History (the one recorded run): the email status was changed to Replied manually, because Saleshandy does not detect out-of-office replies as replies. Whether this is the method to use for testing is unknown; ask the user.

## Activity-specific execution notes

- Create a Note in HubSpot and Record (log) an email activity in HubSpot: pair with Create/Update a Contact or Create/Update a Deal, same as Email Sent from Saleshandy.
- Other activities: none recorded for this trigger.

## Where to verify

- Saleshandy: Settings > Integrations > HubSpot > Logs.
- HubSpot: the created contact and its associated company name.

## Open questions (unknown, ask the user before generating)

- How to trigger a reply (step 3 of How to execute) is not documented.
- What gets logged by Record (log) an email activity in HubSpot for a reply is not documented.
