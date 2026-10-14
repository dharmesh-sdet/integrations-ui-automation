# Link Clicked in Saleshandy

Smoke test checklist (approved by QA 2026-10-14), confirms production
behavior for AL-4014 and its linked fixes (AL-4103, AL-4120, AL-4121,
AL-4122, AL-4123, AL-4127). Covers all 9 activities under this trigger.

Not covered, still open: AL-4036 (HubSpot contact not created on email sent),
AL-4093 (Hiring Date Picker custom field error), AL-4096 (Update a Deal +
Create a Note errors when the prospect has a Closing Date), AL-4104 (mapped
Deal Name and Company Name ignored). Do not treat these as smoke test
failures.

## Test data setup

- Account `emailopenedprod` (production, "rehan integration"). Needs a
  sequence with Track Link Clicks on, 2 links in the step 1 body, a custom
  tracking domain and one sender. Use a prospect with a Mailinator address.
- Production timing: the click takes up to 1 to 1.5 minutes to register in
  Saleshandy and the log shows 1 to 3 minutes after that. Wait before judging
  a check.
- Turn every other trigger off (a link click also counts as an open). Settings
  > Integrations > HubSpot > Triggers & Activity > enable "Link Clicked in
  Saleshandy", select one activity (or the pairing), Save in the modal, then
  Save on the page.
- Field mapping configured. For Update a Deal: a contact with 3 deals. For
  Update a Company: a contact with 2 associated companies, with the company
  details changed in Saleshandy first.

## Baseline

- Select only Update a Contact, add the prospect, click link 1 in the step 1
  email.
- Confirm the Clicked count goes to 1, the link clicked icon is purple on the
  Prospects tab and Logs shows one new entry with Success.

## Create a Contact in HubSpot

- Select this activity, click the link for a contact not in HubSpot.
- Confirm Success and the contact is created with the mapped fields.

## Update a Contact in HubSpot

- Select this activity, change the prospect details, click the link.
- Confirm Success and the contact shows the new mapped values.

## Create a Deal in HubSpot

- Select this activity, click the link for a contact with no deal.
- Confirm Success and the deal is created and associated to the contact.

## Update a Deal in HubSpot

- Select this activity with Extra Configuration filled (pipeline, stage),
  click the link for the contact with 3 deals.
- Confirm the latest created deal gets the configured values and the other
  deals are unchanged (AL-4103).

## Create a Company in HubSpot

- Select this activity, click the link.
- Confirm Success and one company is created and associated.

## Update a Company in HubSpot

- Select this activity, change the company details (including City) in
  Saleshandy, click the link for the contact with 2 companies.
- Confirm Success, the latest associated company shows the new values
  including City, and the other company is unchanged (AL-4127).

## Create a Task in HubSpot

- Select this activity, fill Task Title, Task Type, Task Priority and Due In
  (Days), click the link.
- Confirm Success and the task is created with the configured values.

## Create a Note in HubSpot

- Select this activity paired with Create a Deal, click the link.
- Confirm Success, the note is on both the contact and the deal (AL-4121),
  and it shows Click Count: 1 (AL-4120).

## Record (log) an Email Activity in HubSpot

- Select this activity paired with Create a Deal, click the link.
- Confirm Success and the email is logged on both the deal and the contact
  (AL-4122).
- Select this activity paired with Update a Deal, click the link for the
  contact with 3 deals.
- Confirm the email is logged on the latest created deal only and its header
  names the prospect, not "Unknown Contact" (AL-4123).
