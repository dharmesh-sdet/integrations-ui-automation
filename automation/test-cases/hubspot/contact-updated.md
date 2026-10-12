# Contact Updated in HubSpot: Regression scenarios

Environment: Staging (pyxis.lifeisgoodforlearner.com). The workflow ticket
is AL-4007. These scenarios confirm the AL-3998 fix: the workflow no longer
fails with "prospectList must be a valid prospect item", and it upserts the
prospect with all mapped fields. It creates the prospect if it is missing
and updates it if it exists, without making a duplicate.

This trigger has no activities and no Extra Configuration, so all rows test
the trigger itself.

Not covered, still open: none stated in the context.

## Test data setup

- 2 to 3 contacts from the QA CSV, none of them in Saleshandy yet. Each is
  created one at a time through the HubSpot create contact form, with 3 to 4
  form fields filled. CSV values are used as they are (no prefix).
- Field mapping configured in Settings > Integrations > HubSpot (Contact
  properties as in the overview).
- In Settings > Integrations > HubSpot > Triggers & Activities, enable only
  "Contact Updated in HubSpot". Contact Created/Properties Updated in HubSpot
  (AL-4006) is disabled.
- Logs are checked in Settings > Integrations > HubSpot > Logs: refresh until
  an entry with today's date and time appears.
- Row 4 runs last and leaves the trigger disabled.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger off before the test | Enable "Contact Updated in HubSpot", click Save | Saved without an error | None |

## Trigger only (no activities)

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact not in Saleshandy | Create the contact in HubSpot with 3 to 4 fields | Success in Logs. Prospect created with the mapped fields | AL-3998 |
| 2 | Contact already a prospect (from row 1) | Update several mapped fields in HubSpot and save | Success in Logs (one or more entries). Prospect shows the new values, no duplicate prospect | AL-3998 |
| 3 | Same contact, updated again | Update one mapped field again | Success in Logs. Prospect shows the latest value | None |
| 4 | Trigger disabled | Disable the trigger, then update a mapped field on the contact | No new log entry, prospect unchanged | None |
