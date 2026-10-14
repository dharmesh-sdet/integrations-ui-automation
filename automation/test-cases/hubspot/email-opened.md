# Sequence Email is Opened in Saleshandy: Regression scenarios

Environment: Staging (pyxis.lifeisgoodforlearner.com). The workflow ticket
is AL-4013. No sub-bugs are known, so every Ticket cell is "None". Expected
results follow Link Clicked and Email Bounced for the same activity
(inherited, not yet seen on this trigger), plus what QA confirmed for Opened
(see `context/hubspot/email-opened.md`).

Timing: on staging an open registers about 10 s after it is made, for the
first and the second open. On production the first open counts after 60 s
from sending, a second open 120 s after the first, and registering takes 1 to
3 minutes (developer note via QA, 2026-10-12). Production values are for the
smoke run, not these scenarios.

Two phases, as in Email Bounced: Phase 1 has Extra Configuration empty or
none; Phase 2 has values filled, added after Phase 1 is stable. Run Phase 1
first, because saved values cannot be emptied again (`00-overview.md`).

Not covered, still open: none known.

## Test data setup

- Account: `emailopened` (Saleshandy `dharmesh+emailopened@saleshandy.com`,
  common HubSpot portal connected). Sender: the Dharmesh Patel mailbox (QA,
  2026-10-12), 50 per day, interval 45 to 55 s.
- Sequence: "HubSpot Email Opened QA" (id 196462), Active, 2 steps, no A/B
  variants. Sequence Settings > Safety Settings > Track email opens on
  (Enable Anyway), Track link clicks off. Custom tracking domain
  `cd1.shengage02.com` set up.
- "Open the email": add the prospect from the CSV with Add Prospects, one at
  a time. Step 1 is sent by Saleshandy on its own (wait for "Sent" in the
  Emails tab). Go to mailinator.com, type the prospect's email, click Go,
  open the sequence email. For step 2 (or a later step that would send days
  later): the Emails tab has no step 2 row until the prospect is moved, so
  first move it: Prospects tab > tick the prospect > "Add to Sequence" icon >
  Sequence: the current one > Sequence Steps: "Step 2 - Day 3" > Add (report
  "Successfully Moved 1"). Then Send now on that prospect's step 2 row, then
  open it in Mailinator (QA, 2026-10-12 and 2026-10-13).
- After the open: wait 10 s, then refresh until the Opened count goes up in
  Sequences > Emails. Only then check Logs.
- Prospect emails are `name@mailinator.com`. One contact first: start with
  Create a Contact 1, then the rest.
- HubSpot preconditions are created by the test one at a time in the HubSpot
  UI from the CSV (existing contact; contact with 1 deal, with 3 deals; with
  1 and 2 associated companies; a company with the prospect's domain).
- No Closing Date on the prospect, ever (known date conversion bug). Deal
  Value may be set.
- Update values are two steps ahead (QA, 2026-10-12): in every Update
  activity with Extra Configuration values, the value is set two options
  ahead of what the record has. Example: the deal was created at "Prospecting",
  the update sets "Proposal sent" (two stages on). The same for the contact's
  Lifecycle Stage and Lead Status. Update a company has no Extra
  Configuration, so nothing applies there. The option order is read from the
  real dropdowns in the walkthrough and written in Phase 2 before the spec is
  coded.
- Triggers: every other trigger off (a link click also counts as an open),
  only "Sequence Email is Opened in Saleshandy" on. For an activity with an
  Extra Configuration modal, click the modal's Save; for an activity without
  one, click the page's Save and wait for "Configuration Updated
  Successfully".
- Logs: Settings > Integrations > HubSpot > Logs, workflow "Sequence Email is
  Opened in Saleshandy". Refresh 15 s after the open is counted, then every
  10 s until a status shows. Entries are not opened.
- Field mapping as in `00-overview.md`. HubSpot setting "Create and
  associate companies with contacts" stays off.

## Phase 1: Extra Configuration empty or none

### Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger off before the test | Enable "Sequence Email is Opened in Saleshandy", select an activity, click Save | "Configuration Updated Successfully" | None |
| 2 | Prospect received the step 1 email | Open the email in Mailinator | Within about 10 s the Opened count in Sequences > Emails is 1. Then a new Logs entry for the opened workflow shows Success | None |
| 3 | Prospect's own first open done (own prospect, not row 2's), then 10 s pass | Open the same email again | Opened count goes from 1 to 2, then a new Logs entry shows Success | None |
| 4 | Own prospect, first open done, then moved to step 2 and sent with Send now | Open the step 2 email | New Logs entry shows Success (the note or logged email shows Step 2, see the Create a Note rows) | None |
| 5 | Only another trigger (Email Sent) enabled | Open the email | Opened count goes up, no Logs entry for the opened workflow | None |

### Create a Contact in HubSpot: Extra Configuration empty

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact not in HubSpot | Open the email | Success. Contact created with the mapped fields. Lifecycle Stage and Lead Status are set by HubSpot itself | None |
| 2 | Contact already in HubSpot, prospect details changed in Saleshandy | Open the email | Success. Contact shows the new mapped values | None |

### Update a Contact in HubSpot: Extra Configuration empty

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot, prospect details changed | Open the email | Success. Contact shows the new mapped values | None |
| 2 | Contact not in HubSpot | Open the email | Success, no contact created | None |
| 3 | Contact in HubSpot, prospect details not changed | Open the email | Contact not updated | None |

### Create a deal in HubSpot: Extra Configuration empty

The prospect has no Deal Value and no Closing Date unless the row says so.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot, no deal | Open the email | Success. Deal created and associated. Pipeline, Stage, Deal Type and Priority filled in by HubSpot. Amount and close date empty (--) | None |
| 2 | Contact not in HubSpot | Open the email | Success. Contact and deal created and associated | None |
| 3 | Contact already has 1 deal | Open the email | New deal created, the contact now has 2 deals | None |
| 4 | Prospect has a Deal Value | Open the email | Deal Amount = Deal Value, close date empty (--) | None |

### Update a deal in HubSpot: Extra Configuration empty

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact has 1 deal | Open the email | Open: run once, QA decides | None |
| 2 | Contact has 3 deals | Open the email | Open: run once, QA decides | None |
| 3 | Contact in HubSpot with 0 deals | Open the email | Nothing created or updated | None |
| 4 | Contact not in HubSpot | Open the email | Nothing created or updated | None |

### Create a company in HubSpot: no Extra Configuration

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot, prospect has company details | Open the email | Success. One company created and associated | None |
| 2 | A company with the same domain already exists | Open the email | New company created anyway and associated | None |
| 3 | Contact not in HubSpot | Open the email | Contact and company created and associated | None |
| 4 | Prospect has empty company details, only a company domain | Open the email | Company created from the company domain | None |

### Update a company in HubSpot: no Extra Configuration

Company details are changed in Saleshandy before each row.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact has 1 associated company | Open the email | Success. Company shows the new values (not the name) | None |
| 2 | Contact has 2 associated companies | Open the email | Latest associated company updated, the other unchanged | None |
| 3 | Contact in HubSpot, no associated company | Open the email | Success, nothing created or updated | None |
| 4 | Contact not in HubSpot | Open the email | Success, nothing created or updated | None |

### Create a Task in HubSpot: Extra Configuration empty (modal only)

Nothing is typed or selected and no email is opened.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Extra Configuration modal just opened | Look at the modal, touch nothing | No field is highlighted red. Save is disabled | None |
| 2 | Same modal, all fields empty | Click into each field (Task title, Task Type, Task Priority, Due in, Task Associated With), type or select nothing, then leave it | Task title and Due in are highlighted red. Save stays disabled. Task Type, Task Priority and Task Associated With are not highlighted (seen on staging 2026-10-13; QA: not a bug) | None |

### Create a Note in HubSpot: paired with activities left empty

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Paired with Create a Contact, contact not in HubSpot | Open the email | Success. Contact created, note shows Step 1, Variant A and the Prospect Outcome | None |
| 2 | Paired with Update a Contact, contact in HubSpot | Open the email | Success. Note on the contact | None |
| 3 | Pairing from row 2, step 2 not sent yet | Send now on the step 2 row, open the step 2 email | New note shows Step 2, Variant A | None |
| 4 | Create a Note selected alone | Open the email | Success in Logs (the custom workflow runs); no note on any contact, company or deal | None |

### Record (log) an email activity in HubSpot: paired with activities left empty

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Activity selected | Hover the activity | Tooltip: "Logging an email alone would result in failure. Please create/update contact or deal to associate an email." | None |
| 2 | Only this activity selected | Click the page's Save | Saved | None |
| 3 | Paired with Create a Contact, contact not in HubSpot | Open the email | Success. Email logged on the contact with From, To, "logged email by", date and time, step body | None |
| 4 | Paired with Update a Contact | Open the email | Success. Email logged on the contact | None |
| 5 | Pairing from row 4, step 2 not sent yet | Send now on the step 2 row, open the step 2 email | Step 2 email appears as a separate activity | None |

## Phase 2: Extra Configuration filled

Expanded into full tables when Phase 1 is stable, with values from the real
dropdowns. No Closing Date on the prospect in any row. Update values are two
options ahead of what the record has (see Test data setup).

| Activity | Rows |
|---|---|
| Create a Contact | Lead Status and Lead Lifecycle set, contact not in HubSpot. Contact already at a later Lifecycle Stage (stage stays). Saved values cannot be cleared again. Second open, details changed again (new log entry, contact shows new values) |
| Update a Contact | Update Lead Status and Update Lead Lifecycle set two options ahead of the contact's current values, contact in HubSpot |
| Create a deal | No deal, Closing Date 0 Days (close date empty). Contact not in HubSpot. Contact has 1 deal. Deal Value set, Closing Date 1 Day (close date = today + 1). Closing Date 51 Days (today + 51) |
| Update a deal | 1 deal, values two options ahead of the deal's current Stage. 3 deals (latest updated). Values changed, second open. Closing Date 51 Days |
| Create a Task | Contact in HubSpot (title, type, priority, due today + 3). Contact not in HubSpot (contact and task). Due in 0 cannot be saved. Task title empty cannot be saved |
| Create a Note | Pairings with Create a deal and Update a deal (note on contact and deal). Pairing with Create a Contact with Lead Status and Lifecycle set |
| Record (log) an email activity | Pairings with Create a deal and Update a deal (3 deals). Pairing with Create a Contact with values set |

### Phase 2 tables (draft, 2026-10-13, for QA review; not scripted yet)

Values come from the real dropdowns (`context/hubspot/email-opened.md`).
Two steps ahead: deal Pipeline Stage "Prospecting" (the start stage of a deal
made in the HubSpot UI) becomes "Follow-Up" (QA, 2026-10-14); contact
Lifecycle Stage "Lead" becomes "Sales Qualified Lead". No Closing
Date on the prospect in any row. Run order matters (saved values cannot be
cleared): Create a Contact rows first.

**Create a Contact in HubSpot: Lead Status Open, Lead Lifecycle Marketing Qualified Lead**

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact not in HubSpot | Open the email | Success. Contact created: Lead Status Open, Lifecycle Stage Marketing Qualified Lead, mapped fields | None |
| 2 | Contact already at a later Lifecycle Stage (Customer) | Open the email | Success. Lifecycle Stage stays Customer | None |
| 3 | Values saved before | Reopen Extra Configuration, try to clear both | No empty option; picking the same value keeps it | None |
| 4 | Contact exists, details changed again, second open | Open the same email again | New log entry Success; contact shows the new values | None |

**Update a Contact in HubSpot: Update Lead Status Connected, Update Lead Lifecycle Sales Qualified Lead**

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot at Lifecycle Stage Lead | Open the email | Success. Lead Status Connected, Lifecycle Stage Sales Qualified Lead (two ahead of Lead) | None |

**Create a deal in HubSpot: Sales Pipeline, Initial Contact, New Business, High**

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot, no deal, Closing Date 0 Days | Open the email | Deal created with the 4 values; close date empty (--) | None |
| 2 | Contact not in HubSpot | Open the email | Contact and deal created and associated | None |
| 3 | Contact already has 1 deal | Open the email | New deal created, contact has 2 deals | None |
| 4 | Prospect has Deal Value, Closing Date 1 Day | Open the email | Amount = Deal Value; close date = today + 1 | None |
| 5 | Closing Date 51 Days | Open the email | Close date = today + 51 | None |

**Update a deal in HubSpot: Sales Pipeline, Follow-Up, New Business, High**

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact has 1 deal at Prospecting | Open the email | Deal Stage Follow-Up (two ahead) - Pass (2026-10-14, AL-4128 not reproducible) | AL-4128 |
| 2 | Contact has 3 deals | Open the email | Latest created deal updated, the others unchanged - Pass (2026-10-14, AL-4128 not reproducible) | AL-4128 |
| 3 | Values changed after row 1, second open | Change the saved values, open the same email again | New log entry Success; deal shows the new values - Pass (2026-10-14, AL-4128 not reproducible) | AL-4128 |
| 4 | Closing Date 51 Days | Open the email | Close date = today + 51 - Pass (2026-10-14, AL-4128 not reproducible) | AL-4128 |

**Create a Task in HubSpot: title "Follow up from the workflow", Call, Medium, due in 3 days**

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot | Open the email | Task on the contact: title, type, priority, due today + 3 | None |
| 2 | Contact not in HubSpot | Open the email | Contact and task created | None |
| 3 | Due in set to 0 | Fill everything, leave Due In at 0 | Save cannot be clicked | None |
| 4 | Task title empty | Fill type, priority, Due In 3, empty title | Save cannot be clicked | None |

**Create a Note and Record (log) an email activity: paired with an activity that has values**

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Create a Note + Create a deal | Open the email | Note on the contact and on the deal | None |
| 2 | Create a Note + Update a deal (1 deal) | Open the email | Note on the contact and on the deal (QA, 2026-10-14, confirmed with the developer; was deal only on 2026-10-13) | None |
| 3 | Record (log) + Create a deal | Open the email | Email logged on the contact and on the deal | None |
| 4 | Record (log) + Update a deal (3 deals) | Open the email | Email logged on the latest deal only; the card reads "Logged email by Email Opened via Saleshandy" (QA, 2026-10-14) - Pass (2026-10-14) | None |
