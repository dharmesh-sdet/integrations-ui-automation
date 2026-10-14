# Email is Bounced in Saleshandy: Regression scenarios

Environment: Staging (pyxis.lifeisgoodforlearner.com). The workflow ticket
is AL-4016. No sub-bugs are known, so every Ticket cell is "None". Expected
results follow Email Sent from Saleshandy for the same activity, plus what
QA confirmed for this trigger (see `context/hubspot/email-bounced.md`).

The scenarios run in two phases. Phase 1 has the rows where the Extra
Configuration is left empty, or the activity has none. Script, run and fix
these first, activity by activity. Phase 2 has the rows with Extra
Configuration values, added once Phase 1 is stable. Run Phase 1 before Phase
2: once values are saved in an Extra Configuration they cannot be emptied
again (`00-overview.md`).

Not covered, still open: none known.

## Test data setup

- Account: `emailbounced` (OTP off, common HubSpot portal connected, logins
  saved by QA).
- Sequence: a new sequence with 2 steps and no A/B variants, Active, so the
  prospect gets a row in the Emails tab.
- "Bounce the email" (manual): add the prospect with Add Prospects, one at a
  time. Emails tab > the prospect's row > Actions > Mark as bounced. Send now
  is not needed. For step 2, mark the prospect's step 2 row without sending
  it. A sequence that was Active and is now paused works the same way.
- Real bounce: add the prospect, send the email, wait for Saleshandy to set
  Bounced.
- Prospect emails: manual rows use `name@mailinator.com` (never bounces by
  itself). Real rows use `name@<company>.mailinator.com`. The CSV
  (`test-data/hubspot/email-bounced.csv`) has a "Bounce type" column (Manual
  or Real).
- Real-bounce cap: 3 in the whole plan (QA, 2026-10-14). Baseline 5 used 2
  (2026-10-12 and 2026-10-13 re-run); the third and last is Record (log) 6 in
  Phase 2. Every other row is manual, to protect the sender accounts. A
  prospect can be marked as bounced only once, so no row bounces the same
  prospect twice.
- One contact first: start with Create a Contact 1, then add the rest.
- No Closing Date on the prospect, ever (known date conversion bug). The CSV
  Closing Date column stays empty. Deal Value may be set from the CSV.
- HubSpot Setup is created by hand in the HubSpot UI before the bounce (the
  contact, deals from `email-bounced-deals.csv`, companies from
  `email-bounced-companies.csv`).
- Triggers: every other trigger off, only "Email is Bounced in Saleshandy"
  on.
- Save buttons: for an activity with an Extra Configuration modal, click the
  modal's Save (it saves the Extra Configuration and the whole workflow). For
  an activity with no modal, click the page's Save and wait for
  "Configuration Updated Successfully".
- Logs: not looked at (QA, 2026-10-14). Every row waits for the bounce to reach
  HubSpot (90 seconds; 8 minutes when Update a Deal is selected, its sync is
  slow), then checks the HubSpot record. A row passes when the HubSpot record
  matches the prospect's Saleshandy data and the configured values.
- Field mapping as in `00-overview.md`. HubSpot setting "Create and
  associate companies with contacts" stays off.

## Phase 1: Extra Configuration empty or none

### Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger off before the test | Enable "Email is Bounced in Saleshandy", select an activity, click Save | "Configuration Updated Successfully" | None |
| 2 | Prospect in the Emails tab, sequence Active | Mark as bounced | The contact is created in HubSpot with the prospect's data | None |
| 3 | Prospect in the Emails tab, sequence paused after being Active | Mark as bounced | Same as row 2 | None |
| 4 | Only another trigger (Email Sent) enabled | Mark as bounced | No contact is created in HubSpot | None |
| 5 | Create a Contact selected, Extra Configuration empty, real-bounce address, contact not in HubSpot | Send the email and wait for the real bounce | Email shows Bounced in Saleshandy. Contact created in HubSpot with the prospect's data (same as Create a Contact 1) | None |

### Create a Contact in HubSpot: Extra Configuration empty

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact not in HubSpot | Bounce the email | Contact created with the mapped fields, including company name, industry and country. Lifecycle Stage and Lead Status are set by HubSpot itself | None |
| 2 | Contact already in HubSpot, prospect details changed in Saleshandy | Bounce the email | Contact shows the new mapped values | None |

### Update a Contact in HubSpot: Extra Configuration empty

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot, prospect details changed | Bounce the email | Contact shows the new mapped values | None |
| 2 | Contact not in HubSpot | Bounce the email | No contact created | None |
| 3 | Contact in HubSpot, prospect details not changed | Bounce the email | Contact not updated | None |

### Create a deal in HubSpot: Extra Configuration empty

The prospect has no Deal Value and no Closing Date unless the row says so.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot, no deal | Bounce the email | Deal created and associated to the contact. Pipeline, Stage, Deal Type and Priority are filled in by HubSpot. Amount empty (--), close date empty (--) | None |
| 2 | Contact not in HubSpot | Bounce the email | Contact and deal created and associated, deal values as in row 1 | None |
| 3 | Contact already has 1 deal | Bounce the email | New deal created, the contact now has 2 deals | None |
| 4 | Prospect has a Deal Value | Bounce the email | Deal Amount = Deal Value, close date empty (--) | None |

### Update a deal in HubSpot: Extra Configuration empty

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact has 1 deal | Bounce the email | Open: run once, QA decides | None |
| 2 | Contact has 3 deals | Bounce the email | Open: run once, QA decides | None |
| 3 | Contact in HubSpot with 0 deals | Bounce the email | Nothing created or updated | None |
| 4 | Contact not in HubSpot | Bounce the email | Nothing created or updated | None |

### Create a company in HubSpot: no Extra Configuration

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot, prospect has company details | Bounce the email | One company created and associated | None |
| 2 | A company with the same domain already exists | Bounce the email | New company created anyway and associated | None |
| 3 | Contact not in HubSpot | Bounce the email | Contact and company created and associated | None |
| 4 | Prospect has empty company details, only a company domain | Bounce the email | Company created from the company domain | None |

### Update a company in HubSpot: no Extra Configuration

Company details are changed in Saleshandy before each row.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact has 1 associated company | Bounce the email | Company shows the new values (not the name) | None |
| 2 | Contact has 2 associated companies | Bounce the email | Latest associated company updated, the other unchanged | None |
| 3 | Contact in HubSpot, no associated company | Bounce the email | Nothing created or updated | None |
| 4 | Contact not in HubSpot | Bounce the email | Nothing created or updated | None |

### Create a Task in HubSpot: Extra Configuration empty (modal only)

Nothing is typed or selected in these rows, and no prospect is bounced.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Extra Configuration modal just opened | Look at the modal, touch nothing | No field is highlighted red. Save is disabled | None |
| 2 | Same modal, all fields empty | Click into each field (Task title, Task Type, Task Priority, Due in), type or select nothing, then leave it | Task Title and Due In are highlighted red. Save stays disabled. Task Type, Task Priority and Task Associated With do not turn red (QA, 2026-10-14) | None |

### Create a Note in HubSpot: paired with activities left empty

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Paired with Create a Contact, contact not in HubSpot | Bounce the email | Contact created, note shows Step 1, Variant A and the Prospect Outcome | None |
| 2 | Paired with Update a Contact, contact in HubSpot | Bounce the email | Note on the contact | None |
| 3 | Paired with Update a Contact, contact in HubSpot, prospect moved to step 2 before the bounce (a prospect already bounced on step 1 cannot be moved to step 2: expected behavior, QA 2026-10-13) | Move the prospect to step 2, then mark the step 2 row as bounced | New note shows Step 2, Variant A | None |
| 4 | Create a Note selected alone | Bounce the email | No contact and no note are created in HubSpot | None |

### Record (log) an email activity in HubSpot: paired with activities left empty

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Activity selected | Hover the activity | Tooltip: "Logging an email alone would result in failure. Please create/update contact or deal to associate an email." | None |
| 2 | Only this activity selected | Click the page's Save | Saved | None |
| 3 | Paired with Create a Contact, contact not in HubSpot | Bounce the email | Email logged on the contact with From, To, "logged email by", date and time, step body | None |
| 4 | Paired with Update a Contact | Bounce the email | Email logged on the contact | None |
| 5 | Paired with Update a Contact, contact in HubSpot, prospect moved to step 2 before the bounce (a prospect already bounced on step 1 cannot be moved to step 2: expected behavior, QA 2026-10-13) | Move the prospect to step 2, then mark the step 2 row as bounced | The step 2 email is logged on the contact | None |

## Phase 2: Extra Configuration filled

Values come from the real dropdowns (`context/hubspot/00-overview.md`). Two
steps ahead: a deal made in the HubSpot UI starts at Pipeline Stage
"Prospecting" (seen 2026-10-13), which becomes "Follow-Up";
contact Lifecycle Stage "Lead" becomes "Sales Qualified Lead". No Closing
Date on the prospect in any row. Run order matters (saved values cannot be
cleared): Create a Contact rows first. A prospect can be bounced only once, so
there are no "second bounce" rows (QA, 2026-10-14).

**Create a Contact in HubSpot: Lead Status Open, Lead Lifecycle Marketing Qualified Lead**

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact not in HubSpot | Bounce the email | Contact created: Lead Status Open, Lifecycle Stage Marketing Qualified Lead, mapped fields | None |
| 2 | Contact already at a later Lifecycle Stage (Customer, set by hand in HubSpot) | Bounce the email | Lifecycle Stage stays Customer | None |
| 3 | Values saved before | Reopen Extra Configuration, try to clear both | No empty option; picking the same value keeps it | None |

**Update a Contact in HubSpot: Update Lead Status Connected, Update Lead Lifecycle Sales Qualified Lead**

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot at Lifecycle Stage Lead | Bounce the email | Lead Status Connected, Lifecycle Stage Sales Qualified Lead (two ahead of Lead) | None |

**Create a deal in HubSpot: Sales Pipeline, Initial Contact, New Business, High**

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot, no deal, Closing Date 0 Days | Bounce the email | Deal created with the 4 values; close date empty (--) | None |
| 2 | Contact not in HubSpot | Bounce the email | Contact and deal created and associated | None |
| 3 | Contact already has 1 deal | Bounce the email | New deal created, contact has 2 deals | None |
| 4 | Prospect has Deal Value, Closing Date 1 Day | Bounce the email | Amount = Deal Value; close date = today + 1 | None |
| 5 | Closing Date 51 Days | Bounce the email | Close date = today + 51 | None |

**Update a deal in HubSpot: Sales Pipeline, Follow-Up, New Business, High**

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact has 1 deal at Prospecting | Bounce the email | Deal Stage Follow-Up (two ahead) | None |
| 2 | Contact has 3 deals | Bounce the email | Latest created deal updated, the others unchanged | None |
| 3 | Closing Date 51 Days | Bounce the email | Close date = today + 51 | None |

**Create a Task in HubSpot: title "Follow up from the workflow", Call, Medium, due in 3 days**

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot | Bounce the email | Task on the contact: title, type, priority, due today + 3 | None |
| 2 | Contact not in HubSpot | Bounce the email | Contact and task created | None |
| 3 | Due In set to 0 | Fill everything, leave Due In at 0 | Save cannot be clicked | None |
| 4 | Task title empty | Fill type, priority, Due In 3, empty title | Save cannot be clicked | None |

**Create a Note and Record (log) an email activity: paired with an activity that has values**

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| Note 1 | Create a Note + Create a deal | Bounce the email | Note on the contact and on the deal | None |
| Note 2 | Create a Note + Update a deal (1 deal) | Bounce the email | Note on the contact and on the deal | None |
| Note 3 | Create a Note + Create a Contact with values set | Bounce the email | Note on the contact; contact has Lead Status Open, Lifecycle Stage Marketing Qualified Lead | None |
| Record 4 | Record (log) + Create a deal | Bounce the email | Email logged on the contact and on the deal | None |
| Record 5 | Record (log) + Update a deal (3 deals) | Bounce the email | Email logged on the contact and on the latest deal | None |
| Record 6 | Record (log) + Create a Contact with values set | Real bounce (third and last, QA 2026-10-14) | Email logged on the contact; contact has the values | None |
