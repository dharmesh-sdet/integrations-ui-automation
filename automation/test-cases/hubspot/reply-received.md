# Reply is received in Saleshandy: Regression scenarios

Environment: Staging (pyxis.lifeisgoodforlearner.com). The workflow ticket
is AL-4011. Account: `replyreceived`. This workflow has no tickets of its own.
These scenarios mirror the Email Sent rows and cover all 9 activities in
product UI order. Create a Note and Record (log) an email activity are each
tested in their four pairings. Note and logged email contents are not
documented, so only their presence is checked; contents are recorded in the
walkthrough and confirmed with QA before being asserted.

Not covered, still open (Email Sent family): AL-4036, AL-4093, AL-4096,
AL-4104. Do not treat these as failures.
Behavior the developer kit lists as accepted for the Email
Sent family is not a failure here either.

## Test data setup

- Sequence: a new sequence with 2 steps and no A/B variants, created on
  staging during the walkthrough.
- "Mark as Replied" means: add the prospect from the CSV with Add Prospects
  (one at a time), wait for step 1 to show "Sent", then Emails tab > the
  prospect's row > Actions > Mark as Replied.
- Second-reply rows (Update a deal 3, Create a Note 5, Record (log) 7) use
  Mark as Replied on step 2 if the UI allows it, otherwise a new prospect.
  If their earlier row failed, they are skipped with the reason, not failed.
- Each row uses its own prospect from `test-data/hubspot/reply-received.csv`
  (Scenario column). Its HubSpot Setup (contact, deals, companies) is created
  by hand in the HubSpot UI before Mark as Replied. "Prospect details
  changed" edits use the Updated columns.
- "Contact not in HubSpot" means a brand-new CSV row whose email is not in
  HubSpot.
- In Settings > Integrations > HubSpot > Triggers & Activities, turn every
  other trigger off (including Email Sent) and enable only "Reply is received
  in Saleshandy". Each row selects only the activity (or pairing) under test,
  Save, wait for "Configuration Updated Successfully".
- Rows that skip Extra Configuration run first.
- Extra Configuration values come from the real dropdowns during the
  walkthrough. Closing Date rows use 0, 1 and 51 Days; Task rows use Due in 3.
- Field mapping as in 00-overview.md. HubSpot setting "Create and associate
  companies with contacts" off (checked, not changed).
- Logs: Settings > Integrations > HubSpot > Logs, workflow name confirmed in
  the walkthrough. Refresh 15 s after Mark as Replied, then every 10 s, up to
  3 min. Entries are not opened.
- Stop on reply is on by default, so a reply finishes the prospect.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger off | Enable "Reply is received in Saleshandy", select an activity, Save | "Configuration Updated Successfully" | None |

## Create a Contact in HubSpot

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact not in HubSpot, Extra Configuration skipped | Mark as Replied | Success. Contact created with mapped fields, company name associated | None |
| 2 | Contact not in HubSpot, Lead Status and Lifecycle set | Mark as Replied | Success. Contact created with configured Lead Status and Lifecycle Stage | None |
| 3 | Contact in HubSpot, prospect details changed | Mark as Replied | Success. Contact shows new mapped values | None |
| 4 | Contact at a later Lifecycle Stage than configured | Mark as Replied | Lifecycle Stage stays at the later stage (not a defect) | None |
| 5 | Lead Status and Lifecycle saved before | Reopen Extra Configuration, try to clear both | Fields cannot be cleared (expected) | None |

## Update a Contact in HubSpot

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot, details changed, Extra Configuration skipped | Mark as Replied | Success. Contact shows new mapped values | None |
| 2 | Contact in HubSpot, Lead Status and Lifecycle set | Mark as Replied | Success. Contact shows configured Lead Status and Lifecycle Stage | None |
| 3 | Contact not in HubSpot | Mark as Replied | Success, no contact created | None |
| 4 | Contact in HubSpot, same values as prospect (Job title, City, Lead Status, Lifecycle Stage), details unchanged | Mark as Replied | Success. Contact not updated: every value stays as-is | None |

## Create a deal in HubSpot

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot, no deal, Closing Date 0 Days | Mark as Replied | Success. Deal created and associated with configured Pipeline, Stage, Type, Priority. No close date (0 Days = not set) | None |
| 2 | Contact not in HubSpot | Mark as Replied | Contact and deal created and associated | None |
| 3 | Contact has 1 deal | Mark as Replied | New deal created, contact now has 2 deals | None |
| 4 | Prospect has Deal Value and Closing Date, Closing Date 1 Day | Mark as Replied | Deal Amount = Deal Value, close date = today + 1 | None |
| 5 | Closing Date 51 Days | Mark as Replied | Close date = today + 51, not 50 | None |

## Update a deal in HubSpot

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact has 1 deal | Mark as Replied | Success. Deal shows configured Pipeline, Stage, Type, Priority | None |
| 2 | Contact has 3 deals | Wait after creating deals (HubSpot search delay), Mark as Replied | Latest deal updated, 2 older ones unchanged | None |
| 3 | Deal updated in row 1, Extra Configuration changed | Mark as Replied on step 2 (or new prospect with 1 deal) | Deal shows new values | AL-4119 |
| 4 | Contact has 1 deal, Closing Date 51 Days | Mark as Replied | Close date = today + 51 | None |
| 5 | Contact in HubSpot, 0 deals | Mark as Replied | Nothing created or updated | None |
| 6 | Contact not in HubSpot | Mark as Replied | Nothing created or updated | None |

## Create a company in HubSpot

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot, prospect has company details | Mark as Replied | Success. Company created and associated | None |
| 2 | Company with same domain exists | Mark as Replied | New company created and associated (no dedup) | None |
| 3 | Contact not in HubSpot | Mark as Replied | Contact and company created and associated | None |
| 4 | Only company domain filled | Mark as Replied | Company created from the domain | None |

## Update a company in HubSpot

Before each row, the prospect's company details are changed in Saleshandy.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact has 1 associated company | Mark as Replied | Success. Company shows new values (not name, AL-4104) | None |
| 2 | Contact has 2 associated companies | Wait after creating companies (HubSpot search delay), Mark as Replied | Latest associated company updated, other unchanged | None |
| 3 | Contact in HubSpot, no associated company | Mark as Replied | Nothing created or updated | None |
| 4 | Contact not in HubSpot | Mark as Replied | Nothing created or updated | None |

## Create a Task in HubSpot

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot | Mark as Replied | Success. Task with configured title, type, priority, due = today + 3 | None |
| 2 | Contact not in HubSpot | Mark as Replied | Contact created, task created on it | None |
| 3 | Due in = 0 | Try to Save the modal | Cannot be saved | None |
| 4 | Task title empty | Try to Save the modal | Cannot be saved | None |

## Create a Note in HubSpot

An empty reply body in the note is not a failure (Mark as
Replied has no reply text).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Paired with Create a Contact (Lead Status and Lifecycle set), contact not in HubSpot | Mark as Replied | Success. Contact created, note on it | AL-4118 |
| 2 | Paired with Update a Contact, contact in HubSpot | Mark as Replied | Success. Note on the contact | AL-4118 |
| 3 | Paired with Create a deal, prospect has Deal Value and Closing Date | Mark as Replied | Success. Note on both contact and deal | AL-4118 |
| 4 | Paired with Update a deal, contact has 1 deal, no Closing Date | Mark as Replied | Success. Note on both contact and deal | AL-4118 |
| 5 | Pairing from row 2, second reply | Mark as Replied on step 2 (or new prospect) | New, separate note on the contact | AL-4118 |
| 6 | Create a Note selected alone | Mark as Replied | Success in Logs; no note on any contact, company, or deal | None |

## Record (log) an email activity in HubSpot

Empty reply content in the logged email is not a failure.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Activity selected | Hover the activity | Tooltip: "Logging an email alone would result in failure. Please create/update contact or deal to associate an email." | None |
| 2 | Only this activity selected | Click Save | Saved | None |
| 3 | Paired with Create a Contact (Lead Status and Lifecycle set), contact not in HubSpot | Mark as Replied | Success. Email activity logged on the contact | None |
| 4 | Paired with Update a Contact, prospect has Deal Value and Closing Date | Mark as Replied | Success. Email activity logged on the contact | None |
| 5 | Paired with Create a deal, prospect has Deal Value and Closing Date | Mark as Replied | Success. Email activity logged on both deal and contact | None |
| 6 | Paired with Update a deal, contact has 3 deals | Mark as Replied | Success. Latest deal updated, email activity logged on that deal and contact (QA, 2026-10-15), naming the prospect (not "Unknown Contact"). AL-4129 fixed (QA, 2026-10-15): "Unknown Contact" gone on 2026-10-15 retest - Pass (2026-10-15, 3.0 min, email on deal and contact) | AL-4129 |
| 7 | Pairing from row 4, second reply | Mark as Replied on step 2 (or new prospect) | Separate email activity on the contact | None |
