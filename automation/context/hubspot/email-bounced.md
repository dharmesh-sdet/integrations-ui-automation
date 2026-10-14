# Email is Bounced in Saleshandy

Readiness for scenario generation: Not ready. QA had no workflow context to
paste (2026-10-12), so this file holds only what was confirmed from staging,
public docs and the project. Gaps are listed at the end; they are asked in
stage 2.

Jira sub-task: AL-4016 (under AL-3984)

Naming: the trigger is "Email is Bounced in Saleshandy" on the Triggers &
Activity tab [staging, 2026-10-12]. The Jira title is "Email is bounced in
Saleshandy".

Direction: Saleshandy to HubSpot (same shape as Email Sent from Saleshandy:
the trigger is a Saleshandy event, the activities act on HubSpot records).

## What it does

When an email sent by a Saleshandy sequence bounces for a prospect, the
workflow runs and performs the selected HubSpot activities.
Not documented yet: what is passed to HubSpot for a bounce, and whether
any bounce-specific field or property is updated.

## Activities

Dropdown on the trigger row, in product UI order [staging, 2026-10-12]. The
trigger toggle must be on before the dropdown opens.

| # | Activity |
|---|---|
| 1 | Create a Contact in Hubspot |
| 2 | Update a Contact in Hubspot |
| 3 | Create a Deal in Hubspot |
| 4 | Update a Deal in Hubspot |
| 5 | Create a Company in Hubspot |
| 6 | Update a Company in Hubspot |
| 7 | Create a Task in Hubspot |
| 8 | Create a Note in Hubspot |
| 9 | Record(log) an Email Activity in Hubspot |

Create a Task, Extra Configuration left empty [QA, 2026-10-12]: the modal
cannot be saved empty. When the modal opens, no field is highlighted and
Save is disabled. After the user clicks into a field (focus, nothing typed
or selected) and leaves it empty, that field is highlighted red and Save
stays disabled. Fields: Task title, Task Type, Task Priority, Due in
(Days) [project: email-sent.md]. Not yet seen on this trigger's modal.

This is the same list as Email Sent from Saleshandy (`email-sent.md`).
Extra Configuration per activity for this trigger: not looked at yet; the
Email Sent file has it for the same activity names.

## Behavior with Extra Configuration empty [QA, 2026-10-12]

- Create a Contact: the contact is created with the mapped fields. Lifecycle
  Stage and Lead Status are set by HubSpot itself, not by the workflow.
- Create a deal: the deal is created. The other values (Pipeline, Stage, Deal
  Type, Priority) are filled in by HubSpot.
- Amount: if the prospect's Deal Value is empty, the deal Amount stays empty
  (shown as "--").
- Closing Date 0 Days in the Extra Configuration: the deal's close date stays
  empty (shown as "--").
- Update a deal with Extra Configuration empty: not stated yet.

## Test data rule: no Closing Date on the prospect [QA, 2026-10-12]

- QA never sets the Closing Date (or other deal fields) on the prospect
  details page. A bug is already filed: the date conversion from Saleshandy
  to HubSpot is invalid (found through other tickets; ticket key not given).
- From HubSpot to Saleshandy the date arrives as the same date in a
  different format.
- So the CSV Closing Date column stays empty, and Closing Date rows use the
  Extra Configuration's Days only.

## Save buttons

Two Save buttons [QA, 2026-10-12]: the Extra Configuration modal's Save
saves the Extra Configuration and the entire workflow; the page's Save
(Triggers & Activity) saves the entire workflow and works best for activities
with no Extra Configuration modal. In scenarios, "Save" in a modal row means
the modal's Save; for Create/Update a company, Note and Record (log) an
email activity, use the page's Save.

## How to trigger a bounce

- Manual: the sequence Email tab row has a "Mark as bounced" action
  [project: reply-received-progress.md]. QA verified it fires the trigger
  [QA, 2026-10-12]. It works from an Active sequence, and from a non-Active
  one that was Active before and was then paused, with emails delivered or
  scheduled: those prospects can be marked from the sequence's Emails tab.
  The prospect needs a row in the Emails tab [QA, 2026-10-12]. The webhook
  payload has an `isManuallyBounced` field [public docs, article 9183990].
- Real: the email goes to an address that bounces and Saleshandy sets the
  email status to Bounced [public docs, article 6969644]. Plain
  `name@mailinator.com` does NOT bounce [QA, 2026-10-12]. An address on a
  company subdomain, `name@<company>.mailinator.com`, is the one QA proposed
  for a real bounce; not yet seen on staging.
- Real bounces count against the real sender email accounts, so the plan
  limits them to a few rows (QA, 2026-10-12). Everything else uses the
  manual route.
- Step 2: a prospect that is in step 2 can be marked as bounced without
  sending the step 2 email [QA, 2026-10-12].

## Known product rules that touch this workflow

- Bounced prospects cannot be paused; adding a bounced prospect to another
  sequence fails [public docs, `product/saleshandy.md`].
- Test data: a new HubSpot contact from the CSV, synced to Saleshandy, then
  bounced (QA, 2026-10-12).

## Gaps (to ask in stage 2)

- Intended result per activity for a bounce (Create/Update Contact, Deal,
  Company, Task, Note, Record Email Activity). Nothing documented.
- Does a bounce update any HubSpot property (for example email status)?
- Does "Mark as bounced" fire the trigger, and should it be a scenario?
- How long until the bounce is registered and the log shows Success.
- Which address to use as the invalid recipient on staging, and whether the
  sending account can deliver to it at all.
- Open Jira tickets for this trigger: none known (QA, 2026-10-12: no
  sub-bugs).

Answered 2026-10-12: expected results mirror Email Sent for the same
activity; Mark as bounced fires the trigger; account `emailbounced`; test
data starts with one contact.
