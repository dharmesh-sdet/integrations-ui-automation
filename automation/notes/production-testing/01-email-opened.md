# Sequence Email is Opened in Saleshandy

Smoke test checklist, confirms production behavior for AL-4013 and its
linked fixes (AL-4126, AL-4128). Covers all 9 activities under this trigger.

Not covered, still open: none known for this trigger.

## Test data setup

- Use a sequence with Track email opens on and a custom tracking domain set
  up. Use a prospect with a mailbox you can open.
- Production timing: the first open counts 60 s after sending, a second open
  120 s after the first, and registering takes 1 to 3 minutes. Wait before
  judging a check.
- Field mapping configured. Settings > Integrations > HubSpot > Triggers &
  Activity > enable "Sequence Email is Opened in Saleshandy", select one
  activity, Save in the modal, then Save on the page.
- For Update a Deal: a contact with 3 deals. For Update a Company: a contact
  with 2 associated companies, with the company details changed in
  Saleshandy first.

## Baseline

- Open the step 1 email once, with only Create a Contact selected.
- Confirm the Opened count goes to 1 and Logs shows one entry with Success
  (AL-4013).

## Create a Contact in HubSpot

- Select this activity, open the email for a contact not in HubSpot.
- Confirm Success and the contact is created with the mapped fields.

## Update a Contact in HubSpot

- Select this activity, change the prospect details, open the email.
- Confirm Success and the contact shows the new mapped values.

## Create a Deal in HubSpot

- Select this activity, open the email for a contact with no deal.
- Confirm Success and the deal is created and associated to the contact.

## Update a Deal in HubSpot

- Select this activity with Extra Configuration filled (pipeline, stage),
  open the email for the contact with 3 deals.
- Confirm the latest created deal gets the configured values and the other
  deals are unchanged, not Success with nothing updated (AL-4128).

## Create a Company in HubSpot

- Select this activity, open the email.
- Confirm Success and one company is created and associated.

## Update a Company in HubSpot

- Select this activity, change the company details (including City) in
  Saleshandy, open the email for the contact with 2 companies.
- Confirm Success, the latest associated company shows the new values
  including City, and the other company is unchanged (AL-4126).

## Create a Task in HubSpot

- Select this activity, fill Task Title, Task Type, Task Priority and Due In
  (Days), open the email.
- Confirm Success and the task is created with the configured values.

## Create a Note in HubSpot

- Select this activity paired with Create a Contact, open the email.
- Confirm Success and the note is on the contact with Step 1 and Variant A.

## Record (log) an Email Activity in HubSpot

- Select this activity paired with Update a Contact, open the email.
- Confirm Success and the email is logged on the contact.
