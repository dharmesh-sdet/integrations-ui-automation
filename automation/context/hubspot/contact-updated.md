# Contact Updated in HubSpot

Jira sub-task: AL-4007

Direction: HubSpot to Saleshandy (a HubSpot contact update triggers a prospect upsert in Saleshandy).

Release scope note: None stated in sources.

## What it does

- When a contact is updated in HubSpot, the workflow upserts the prospect in Saleshandy with all mapped fields: the prospect is created if missing, and updated if it already exists.
- This is the behavior after the AL-3998 fix (Rudra's fix comment 78229). Before the fix the workflow failed with the "prospectList must be a valid prospect item" validation error.
- Updating an existing prospect does not create a duplicate prospect.
- This is a separate, independent trigger from Contact Created/Properties Updated in HubSpot (AL-4006). Each runs on its own when enabled.

## Activities

This trigger has no activities to select. There is no activity dropdown for this trigger on the Triggers & Activities page (the original AL-3998 complaint of an empty dropdown was left out of the verification because the dropdown was already absent; the fix was only to the workflow).

| # | Activity | Extra Configuration options | Notes on how it behaves |
|---|---|---|---|
| none | (trigger only) | None | Upserts the prospect with all mapped fields. |

## Prerequisites and setup

- Environment: Staging (pyxis.lifeisgoodforlearner.com). Production is tested on a new user account on the production environment; no URL is documented.
- Field mapping completed in Settings > Integrations > HubSpot, covering Contact and Company properties (mapping table: Field mapping section in 00-overview.md).
- Test data: one HubSpot contact whose email is not in Saleshandy yet (create path), and one HubSpot contact that already exists as a Saleshandy prospect (update path).

## How to execute

1. Complete field mapping in Settings > Integrations > HubSpot (Contact and Company properties).
2. Go to Settings > Integrations > HubSpot > Triggers & Activities, enable the trigger "Contact Updated in HubSpot", and click Save. Confirm the save completes without an error.
3. In HubSpot, update a contact (one not yet in Saleshandy for the create path, or one that already exists as a prospect for the update path; for the update path, change several mapped fields and save).
4. Go to Settings > Integrations > HubSpot > Logs and check the workflow status.
5. Open View Details on the latest log entry to inspect the Request JSON and Response.
6. Check the prospect in Saleshandy for the mapped field values.

## Activity-specific execution notes

- Repeat check: update a mapped field a second time on the same contact and check that the prospect reflects the latest value.
- Post-deploy: watch Settings > Integrations > HubSpot > Logs for a short window afterwards for new errors on this trigger.

## Where to verify

- Settings > Integrations > HubSpot > Logs: workflow status (Success or Error).
- Log View Details: the Request JSON carries the contact data (not an empty `fileds: []`), and the Response has no `CUSTOM_NODE_INTEGRATION_CALL_ERROR`.
- Saleshandy prospect: created with mapped fields (create path), or the existing prospect updated with the new values and no duplicate prospect (update path).

## Open questions (deferred to the test-case step)

None recorded.
