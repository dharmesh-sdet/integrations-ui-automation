# Email is Bounced in Saleshandy

DRAFT for QA review (2026-10-14, open points answered by QA the same day). Smoke test checklist, confirms production
behavior for AL-4016 and its fixed bug AL-4125. Covers all 9 activities under
this trigger. Built from the staging regression (`test-cases/hubspot/email-bounced.md`,
Phase 1 and Phase 2 all passing) in the style of 01 and 02.

Not covered, still open: none known. Do not treat the duplicate "Error" Logs
entry that two real bounces showed on staging (2026-10-12, 2026-10-14) as a
smoke test failure; it was never confirmed as a bug.

## Test data setup

- Account `emailopenedprod` (production, QA 2026-10-14), shared with the Email
  Opened and Link Clicked smoke runs: never run them at the same time, and the
  sender limit of 15 a day is shared. Use a NEW sequence with 2 steps, Active,
  one sender with room in its daily limit, and a prospect with a Mailinator
  address.
- Bounce the email by hand: Sequence > Emails tab > the prospect's row > three
  dots > Mark as bounced (toast "Email has been marked as bounced", the row
  reads "Hard Bounced"). Send now is not needed. No real bounce is needed for
  smoke, so the real sender is not used for bounces.
- Production timing: the bounce takes about 1 to 1.5 minutes to reach HubSpot
  and the log shows about 1 to 3 minutes after the click. Wait before judging
  a check.
- Field mapping configured. Settings > Integrations > HubSpot > Triggers &
  Activity > turn every other trigger off, enable "Email is Bounced in
  Saleshandy", select one activity (or the pairing), Save in the modal, then
  Save on the page.
- For Update a Deal: a contact with 3 deals. For Update a Company: a contact
  with 2 associated companies, with the company details (including City)
  changed in Saleshandy first.

## Baseline

- Select only Create a Contact, add the prospect, mark the step 1 email as
  bounced.
- Confirm the row shows Hard Bounced and Logs shows one new entry with
  Success (AL-4016). The "Latest Status is Bounced" check was dropped (QA,
  2026-10-14).

## Create a Contact in HubSpot

- Select this activity, bounce the email for a contact not in HubSpot.
- Confirm Success and the contact is created with the mapped fields.

## Update a Contact in HubSpot

- Select this activity, change the prospect details, bounce the email for a
  contact already in HubSpot.
- Confirm Success and the contact shows the new mapped values.

## Create a Deal in HubSpot

- Select this activity, bounce the email for a contact with no deal.
- Confirm Success and the deal is created and associated to the contact.

## Update a Deal in HubSpot

- Select this activity with Extra Configuration filled (pipeline, stage),
  bounce the email for the contact with 3 deals.
- Confirm the latest created deal gets the configured values and the other
  deals are unchanged.

## Create a Company in HubSpot

- Select this activity, bounce the email.
- Confirm Success and one company is created and associated.

## Update a Company in HubSpot

- Select this activity, change the company details (including City) in
  Saleshandy, bounce the email for the contact with 2 companies.
- Confirm Success, the latest associated company shows the new values
  including City, and the other company is unchanged (AL-4125).

## Create a Task in HubSpot

- Select this activity, fill Task Title, Task Type, Task Priority and Due In
  (Days), bounce the email.
- Confirm Success and the task is created with the configured values.

## Create a Note in HubSpot

- Select this activity paired with Create a Deal, bounce the email.
- Confirm Success and the note is on both the contact and the deal.

## Record (log) an Email Activity in HubSpot

- Select this activity paired with Create a Deal, bounce the email.
- Confirm Success and the email is logged on the contact and the deal, and its
  header names the prospect, not "Unknown Contact".

## Decisions (QA, 2026-10-14)

- Account: `emailopenedprod`, new sequence.
- Create a Note and Record (log) stay paired with Create a Deal, as in 01 and
  02.
- Logs are checked for Success in the smoke run (the staging "no Logs" rule is
  for staging only).
