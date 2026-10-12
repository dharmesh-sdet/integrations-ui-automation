# Prospect Outcome is updated in Saleshandy: progress (resume here)

Last session: 2026-10-09. Skill: `ui-test-from-workflow`, stage 2 (Regression).

## Done

- Stage 1: context saved to `context/hubspot/prospect-outcome-updated.md`
  (Tickets moved to the top, text unchanged). Note: activity #8 refers to
  `06-email-sent.md`; the real file is `email-sent.md` (left as QA wrote it).
- Stage 2: question round answered (2026-10-09), full draft shown in chat
  (copied below). **Not approved yet.** Not saved to
  `test-cases/hubspot/prospect-outcome-updated.md`.

## QA answers (2026-10-09)

- Mode: Regression.
- Create a Contact "left as is" = Extra Configuration skipped (never saved, no
  Select Outcome). Change outcome to Meeting Booked: Success, nothing created.
  Run first on the new account.
- Outcome changed by an email reply: left out, listed under Open questions.
- Trigger: Sequence > the sequence > Prospects, the prospect's outcome
  dropdown. Logs: refresh after 15 s, then every 10 s, max 3 min.
- Defaults accepted:
  1. Account `outcomeupdated` (`dharmesh+outcomeupdated@saleshandy.com`) on the
     shared HubSpot portal; add `hubspot: 'shared'` in `src/config/accounts.ts`
     (not done yet).
  2. Sequence "HubSpot Prospect Outcome QA", one step, no A/B. Prospects added
     one at a time with Add Prospects; step 1 sent by Saleshandy on its own,
     wait for "Sent" (event fires only with a sent email, dev kit).
  3. Second sequence "HubSpot Prospect Outcome QA B" for the same-prospect row:
     no second contact.
  4. Select Outcome = Meeting Booked; non-matching rows use Interested. Fresh
     prospect per row, starting at "Add Outcome".
  5. Extra Configuration values from the real dropdowns; Closing Date 0 and 1
     Days; Task Due in 3.
  6. Skipped and saved-empty rows run first on the new account.
  7. Note and Record email: four pairings each plus a "selected alone" row.
  8. Not checked: AL-4106 (open) and deal/company names (AL-4104 assumed to
     apply here too).
  9. Extra rows: Update a Contact backward move; Update a company with contact
     not in HubSpot but company in HubSpot; Create a Task modal reopen
     (AL-4111), no extra note (AL-4112), Due in 0 / empty title blocked
     (AL-4101); trigger baseline non-matching outcome (AL-4105).

## Waiting on QA

- "looks good" (or changes) on the draft below, then save it to
  `test-cases/hubspot/prospect-outcome-updated.md`.
- Two Expected results Claude wrote that the context does not state:
  - Note row 5 and Record email row 5 ("selected alone"): "nothing created /
    no email logged" (or should it be an Error log?).
  - Non-matching outcome rows (Trigger 2, Create a Contact 3, Update a Contact
    5, Create a deal 6): "nothing created"; log entry presence not stated.

## Next

- Stage 3: check the outcomeupdated logins exist, add `hubspot: 'shared'`,
  generate the CSV (`npm run data:generate -- prospect-outcome-updated --from
  link-clicked`), check the sender's time between emails, create the two
  sequences, walk skipped/empty rows first.

---

# Draft (not approved)

# Prospect Outcome is updated in Saleshandy: Regression scenarios

Environment: Staging (pyxis.lifeisgoodforlearner.com). The workflow ticket
is AL-4012. These scenarios confirm the fixes AL-4025, AL-4060 to AL-4065,
AL-4101, AL-4105, AL-4107 to AL-4113, across all 9 activities. Create a Note
and Record (log) an email activity are each tested in their four pairings.

Not covered, still open: AL-4106 (Create a Contact errors with Hiring Date
Picker mapped), AL-4104 (mapped Deal Name and Company Name ignored, so deal
and company names are not checked). Do not treat these as failures.

## Test data setup

- Account: Saleshandy `dharmesh+outcomeupdated@saleshandy.com`, connected to
  the shared HubSpot portal; the spec uses
  `test.use({ account: 'outcomeupdated' })`.
- Sequences: "HubSpot Prospect Outcome QA" (one step, no A/B variants) and
  "HubSpot Prospect Outcome QA B" (one step, for the second-sequence row).
- Each row uses a fresh CSV prospect, added one at a time with Add Prospects.
  Step 1 is sent by Saleshandy on its own; wait for "Sent" (the outcome event
  fires only when the prospect has a sent email). The prospect starts at
  "Add Outcome".
- "Change outcome" means: Sequence > the sequence > Prospects, the prospect's
  outcome dropdown, pick the outcome.
- Select Outcome = Meeting Booked in every Extra Configuration. "Does not
  match" rows change the outcome to Interested.
- HubSpot preconditions are created by the test one at a time in the HubSpot
  UI from the CSV: an existing contact, a contact with 1 deal, a contact with
  3 deals, a contact with 1 associated company, a contact with 2 associated
  companies, a company with no contact.
- "Contact not in HubSpot" means a brand-new CSV row whose email is not in
  HubSpot.
- For "contact already in HubSpot" rows, the prospect's details (or company
  details) are changed in Saleshandy before the outcome change.
- Settings > Integrations > HubSpot > Triggers & Activities: turn every other
  trigger off, enable only "Prospect Outcome is updated in Saleshandy". Each
  row selects only the activity (or pairing) under test, then Save, and waits
  for "Configuration Updated Successfully".
- Extra Configuration values come from the real dropdowns during the
  walkthrough and are written here before the spec is coded. Closing Date
  rows use 0 and 1 Days; Task rows use Due in 3.
- New account order: the "skipped" and "saved empty" rows run first (saved
  Extra Configuration cannot be cleared).
- Field mapping configured as in 00-overview.md. HubSpot setting "Create and
  associate companies with contacts" off (checked, not changed).
- Logs: Settings > Integrations > HubSpot > Logs, workflow "Prospect Outcome
  is updated in Saleshandy". Refresh after 15 s, then every 10 s until the
  new entries show a status (max 3 min). Entries are not opened.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger off before the test | Enable "Prospect Outcome is updated in Saleshandy", select an activity, click Save | "Configuration Updated Successfully" | None |
| 2 | Select Outcome = Meeting Booked, prospect has a sent email | Change outcome to Interested | Nothing created or updated in HubSpot | AL-4105 |

## Create a Contact in HubSpot

Extra Configuration: Lead Status, Lead Lifecycle (values from the UI),
Select Outcome = Meeting Booked, or skipped.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact not in HubSpot, Extra Configuration skipped (never saved, no Select Outcome) | Change outcome to Meeting Booked | Success, nothing created in HubSpot | None |
| 2 | Contact not in HubSpot, Lead Status and Lead Lifecycle set | Change outcome to Meeting Booked | Success. Contact created with the mapped fields and the configured Lead Status and Lifecycle Stage | AL-4025 |
| 3 | Contact not in HubSpot | Change outcome to Interested | Nothing created | AL-4105 |
| 4 | Contact already in HubSpot, prospect details changed in Saleshandy | Change outcome to Meeting Booked | Success. Contact shows the new mapped values, no duplicate | None |
| 5 | Prospect from row 2 added to the second sequence, its email sent | Change outcome to Meeting Booked in the second sequence | No second contact created | None |

## Update a Contact in HubSpot

Extra Configuration: Update Lead Status, Update Lead Lifecycle (values from
the UI), Select Outcome = Meeting Booked.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot, prospect details changed in Saleshandy | Change outcome to Meeting Booked | Success. Contact shows the new mapped values and the configured Lead Status and Lifecycle Stage | AL-4060 |
| 2 | Contact not in HubSpot | Change outcome to Meeting Booked | Success, no contact created | None |
| 3 | Contact in HubSpot, prospect details not changed in Saleshandy | Change outcome to Meeting Booked | Success, contact not updated | None |
| 4 | Contact already at a later Lifecycle Stage than the configured one | Change outcome to Meeting Booked | Lead Status changes, Lifecycle Stage stays the same | None |
| 5 | Contact in HubSpot, prospect details changed | Change outcome to Interested | Contact not updated | AL-4105 |

## Create a deal in HubSpot

Extra Configuration: Pipeline, Pipeline Stage, Deal Type, Deal Priority
(values from the UI), Closing Date as given in each row, Select Outcome =
Meeting Booked.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Extra Configuration saved with empty fields | Change outcome to Meeting Booked | Success, nothing created in HubSpot | None |
| 2 | Contact in HubSpot, no deal, Closing Date 0 Days | Change outcome to Meeting Booked | Success. Deal created and associated to the contact with the configured Pipeline, Stage, Type and Priority, close date empty | AL-4061 |
| 3 | Contact not in HubSpot | Change outcome to Meeting Booked | Contact (with mapped properties) and deal created and associated | AL-4107 |
| 4 | Contact already has 1 deal | Change outcome to Meeting Booked | New deal created, existing deal unchanged | None |
| 5 | Prospect has Deal Value, Closing Date 1 Day | Change outcome to Meeting Booked | Deal Amount = Deal Value, close date = the next day | None |
| 6 | Contact in HubSpot, no deal | Change outcome to Interested | No deal created | AL-4105 |

## Update a deal in HubSpot

Extra Configuration: same fields as Create a deal (values from the UI),
Select Outcome = Meeting Booked.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Extra Configuration saved with empty fields, contact has 1 deal | Change outcome to Meeting Booked | Success, nothing changed in HubSpot | None |
| 2 | Contact has 1 deal | Change outcome to Meeting Booked | Success. Deal shows the configured Pipeline, Stage, Type and Priority | AL-4062 |
| 3 | Contact has 3 deals | Change outcome to Meeting Booked | The latest created deal is updated, the 2 older ones are unchanged | AL-4108 |
| 4 | Contact in HubSpot with 0 deals, prospect details changed | Change outcome to Meeting Booked | Contact updated, no deal created | None |
| 5 | Contact not in HubSpot | Change outcome to Meeting Booked | No contact, no deal created | None |

## Create a company in HubSpot

Extra Configuration: Select Outcome = Meeting Booked.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot, prospect has company details | Change outcome to Meeting Booked | Success. Company created and associated to the contact | AL-4063 |
| 2 | Contact not in HubSpot | Change outcome to Meeting Booked | Contact and company created and associated | None |
| 3 | Contact already has 1 company with the same domain | Change outcome to Meeting Booked | A second company is created and associated | None |
| 4 | Prospect has empty company name and website, only a company domain | Change outcome to Meeting Booked | Company created from the company domain | None |

## Update a company in HubSpot

Extra Configuration: Select Outcome = Meeting Booked. Before each row, the
prospect's company details are changed in Saleshandy.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact has 1 associated company | Change outcome to Meeting Booked | Success. Company shows the new values (not the name, AL-4104) | AL-4064, AL-4109 |
| 2 | Contact has 2 associated companies | Change outcome to Meeting Booked | The latest associated company is updated, the other is unchanged | AL-4110 |
| 3 | Contact in HubSpot, no associated company | Change outcome to Meeting Booked | Success, no company created | None |
| 4 | Contact and company both not in HubSpot | Change outcome to Meeting Booked | Nothing created | None |
| 5 | Contact not in HubSpot, company in HubSpot | Change outcome to Meeting Booked | No contact created, no association | None |

## Create a Task in HubSpot

Extra Configuration: Task title, Task Type, Task Priority (values from the
UI), Due in 3 Days, Select Outcome = Meeting Booked.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | All fields empty | Try to Save the modal | Cannot be saved | None |
| 2 | Due in set to 0 | Try to Save the modal | Cannot be saved | AL-4101 |
| 3 | Task title empty | Try to Save the modal | Cannot be saved | AL-4101 |
| 4 | Values saved | Reopen Extra Configuration | Saved values shown, no field in red | AL-4111 (from summary) |
| 5 | Contact in HubSpot | Change outcome to Meeting Booked | Success. Task on the contact with the configured title, type and priority, due date = today + 3. No extra note on the contact | AL-4065, AL-4112 |
| 6 | Contact not in HubSpot | Change outcome to Meeting Booked | Contact created, task created on it | None |

## Create a Note in HubSpot

Extra Configuration: None. The paired activity uses its own values from
above.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Paired with Create a Contact, contact not in HubSpot | Change outcome to Meeting Booked | Success. Contact created, note on it shows the Step, Variant and Prospect Outcome Meeting Booked | None |
| 2 | Paired with Update a Contact, contact in HubSpot | Change outcome to Meeting Booked | Success. Note on the contact | None |
| 3 | Paired with Create a deal, contact in HubSpot | Change outcome to Meeting Booked | Success. Note on both the contact and the deal | None |
| 4 | Paired with Update a deal, contact has 1 deal | Change outcome to Meeting Booked | Success. Note on both the contact and the deal | None |
| 5 | Create a Note selected alone | Change outcome to Meeting Booked | No note created | None |

## Record (log) an email activity in HubSpot

Extra Configuration: None. The paired activity uses its own values from
above.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Paired with Create a Contact, contact not in HubSpot | Change outcome to Meeting Booked | Success. Email logged on the contact, empty description, From shows Unknown Contact (expected, no email is sent) | AL-4113 |
| 2 | Paired with Update a Contact, contact in HubSpot | Change outcome to Meeting Booked | Success. Email logged on the contact (empty description, Unknown Contact expected) | AL-4113 |
| 3 | Paired with Create a deal, contact in HubSpot | Change outcome to Meeting Booked | Success. Email logged on both the deal and the contact | AL-4113 |
| 4 | Paired with Update a deal, contact has 1 deal | Change outcome to Meeting Booked | Success. Email logged on both the deal and the contact | AL-4113 |
| 5 | Only this activity selected | Change outcome to Meeting Booked | No email logged | None |

## Open questions

- Outcome change caused by the prospect's email reply (not a manual change):
  whether it fires this workflow is unknown. Not covered.
