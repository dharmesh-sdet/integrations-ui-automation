# Prospect is Unsubscribed in Saleshandy: Lightweight Regression scenarios

Environment: Staging (pyxis.lifeisgoodforlearner.com), account `unsubscribed`,
HubSpot shared portal. Workflow ticket AL-4015 (under AL-3984). No sub-bugs
known, so every Ticket cell is "None" unless noted.

Lightweight version of `unsubscribed.md` (63 rows). This cut removes
duplication, not scenarios:

- **Phase 1 (Extra Configuration skipped) stays in the spec as code, just not
  in the run.** It is a skipped test per activity, so flipping one line turns
  it back on. Real users configure their activities, so Phase 2 (values
  filled) is where the coverage lives.
- **The "real link" duplicate of every activity is dropped.** The full spec
  proves each of the 9 activities twice: once fired by Unsubscribe (UI), once
  by Unsubscribe (link). That doubling only proves the two trigger methods
  are equivalent, which the Baseline section already does once. Every row
  below uses Unsubscribe (UI) except the two Baseline rows that test the
  link itself.
- **No chained prospects.** Every row gets its own prospect and its own
  preconditions (a fresh contact, a fresh deal, etc.), so one failing row
  never blocks another. This costs a little setup per row but keeps rows
  independent, unlike "first unsubscribe creates, second updates" chains.

27 running scenarios, one real variation per row: not in HubSpot, already in
HubSpot, 0/1/3 existing deals or companies, a Deal Value, a later Lifecycle
Stage HubSpot won't move backward, a same-domain company, and the Note/Record
pairings. Every HubSpot result below mirrors the same activity on Email Sent
from Saleshandy and is **(proposed, unconfirmed)**: QA has not confirmed it
for this trigger.

## Test data setup

- Account: `unsubscribed` (same as the full spec), sequence "HubSpot Prospect
  Unsubscribed QA" (id 196738): one step, Active, sender
  `dharmesh+unodost@saleshandy.com`, Unsubscribe as Link saved.
- CSV: `test-data/hubspot/unsubscribed-lite.csv` (26 rows, one per running
  scenario that needs a prospect). Deals: `unsubscribed-lite-deals.csv`.
  Companies: `unsubscribed-lite-companies.csv`.
- Unsubscribe (UI): Prospects tab > tick the prospect > toolbar icon "Mark as
  Unsubscribe" (no confirm dialog).
- Unsubscribe (link): open the prospect's public Mailinator inbox, LINKS tab,
  open the `unsub.shengage02.com/c/...` link.
- Triggers: only "Prospect is Unsubscribed in Saleshandy" on.
- Field mapping as in `00-overview.md`. HubSpot setting "Create and associate
  companies with contacts" off.
- Create a Contact Extra Configuration (Lead Status = Open, Lead Lifecycle =
  Marketing Qualified Lead) is saved once, by Baseline row 1, and reused by
  every later Create a Contact row (cannot be cleared once saved).

## Phase 1: Extra Configuration skipped (code present, skipped)

One stub per activity (Create/Update Contact, Create/Update Deal, Create/
Update Company, Create Task, Create Note, Record Email), each selecting the
activity with nothing chosen in Extra Configuration and firing Unsubscribe
(UI). Skipped by default; flip the `test.skip` to run them.

## Phase 2: Extra Configuration values

### Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Unsubscribe (UI), Create a Contact (Lead Status Open, Lifecycle MQL), contact not in HubSpot | Save values, add prospect, Unsubscribe (UI) | Prospects tab shows Unsubscribed. Logs: one Success row. Contact created with mapped fields, Lead Status Open, Lifecycle Stage Marketing Qualified Lead (proposed, unconfirmed) | None |
| 2 | Unsubscribe (link), same activity and values, contact not in HubSpot | Add prospect, open unsubscribe link | Page says "You will no longer receive emails from us" with "Subscribe here" and "Report spam". Prospects tab Unsubscribed, Logs Success, contact created (proposed, unconfirmed) | None |
| 3 | Prospect unsubscribed by link | On the unsubscribe page, click "Subscribe here" | Page says "You have successfully subscribed...". Prospects tab shows previous status (Completed) | None |

### Create a Contact in HubSpot

Extra Configuration: Lead Status = Open, Lead Lifecycle = Marketing Qualified
Lead (saved by Baseline row 1).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact at later Lifecycle Stage (Customer, set by hand) | Add prospect, Unsubscribe (UI) | Check Logs Success. Lifecycle Stage stays Customer (HubSpot blocks backward moves, not a defect) (proposed, unconfirmed) | None |
| 2 | Contact in HubSpot, prospect details changed | Create contact in HubSpot, change Job Title and City on the prospect, Unsubscribe (UI) | Check Logs Success. Contact shows new mapped values (proposed, unconfirmed) | None |

### Update a Contact in HubSpot

Extra Configuration: Update Lead Status = Connected, Update Lead Lifecycle =
Sales Qualified Lead.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot | Save values, create contact in HubSpot, Unsubscribe (UI) | Check Logs Success. Lead Status Connected, Lifecycle Stage Sales Qualified Lead (proposed, unconfirmed) | None |
| 2 | Contact not in HubSpot | Unsubscribe (UI) | Check Logs Success. No contact created (proposed, unconfirmed) | None |

### Create a Deal in HubSpot

Extra Configuration: Pipeline = Sales Pipeline, Pipeline Stage = Initial
Contact, Deal Type = New Business, Deal Priority = High, Closing Date = 0
Days (row 3 uses 1 Day).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact not in HubSpot | Save values, Unsubscribe (UI) | Check Logs Success. Contact and deal created and associated with configured values, close date empty (proposed, unconfirmed) | None |
| 2 | Contact has 1 deal | Unsubscribe (UI) | Check Logs Success. New deal created, contact now has 2 deals (proposed, unconfirmed) | None |
| 3 | Prospect has Deal Value, Closing Date 1 Day | Set Closing Date 1 Day, Unsubscribe (UI) | Check Logs Success. Amount = Deal Value, close date = today + 1 (proposed, unconfirmed) | None |

### Update a Deal in HubSpot

Extra Configuration: Pipeline = Sales Pipeline, Pipeline Stage = Follow-Up,
Deal Type = New Business, Deal Priority = High.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact has 1 deal | Save values, Unsubscribe (UI) | Check Logs Success. Deal shows configured Pipeline, Stage, Type, Priority (proposed, unconfirmed) | None |
| 2 | Contact has 3 deals | Unsubscribe (UI) | Check Logs Success. Latest created deal updated, 2 older ones unchanged | AL-4103 |
| 3 | Contact has 0 deals | Unsubscribe (UI) | Check Logs Success. Nothing created or updated (proposed, unconfirmed) | None |

### Create a Company in HubSpot

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot, prospect has company details | Unsubscribe (UI) | Check Logs Success. Company created and associated (proposed, unconfirmed) | None |
| 2 | Company with same domain exists | Unsubscribe (UI) | Check Logs Success. New company created and associated (not the existing one) (proposed, unconfirmed) | None |
| 3 | Contact not in HubSpot | Unsubscribe (UI) | Check Logs Success. Contact and company created and associated (proposed, unconfirmed) | None |

### Update a Company in HubSpot

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact has 1 associated company, details changed | Change City and State on the prospect, Unsubscribe (UI) | Check Logs Success. Company shows new values (proposed, unconfirmed) | None |
| 2 | Contact not in HubSpot | Unsubscribe (UI) | Check Logs Success. Nothing created or updated (proposed, unconfirmed) | None |

### Create a Task in HubSpot

Extra Configuration: Task Title = "Follow up from the workflow", Task Type =
Call, Task Priority = Medium, Due In = 3 days.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot | Save values, Unsubscribe (UI) | Check Logs Success. Task on the contact: title, type, priority, due today + 3 (proposed, unconfirmed) | None |
| 2 | Contact not in HubSpot | Unsubscribe (UI) | Check Logs Success. Contact and task created (proposed, unconfirmed) | None |
| 3 | Due In 0 (UI only, validation) | Fill title, type, priority, leave Due In at 0 | Save cannot be clicked (proposed, unconfirmed) | None |

### Create a Note in HubSpot

Extra Configuration: None (paired with the activity named in each row, with
its Extra Configuration values).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Paired with Create a Contact (values), contact not in HubSpot | Unsubscribe (UI) | Check Logs Success. Contact created, note on it (proposed, unconfirmed) | None |
| 2 | Paired with Create a Deal (values), contact not in HubSpot | Unsubscribe (UI) | Check Logs Success. Contact and deal created, note on both (proposed, unconfirmed) | None |
| 3 | Paired with Update a Deal (1 deal) | Unsubscribe (UI) | Check Logs Success. Note on the contact and on the deal (proposed, unconfirmed) | None |

### Record (log) an Email Activity in HubSpot

Extra Configuration: None (paired with the activity named in each row, with
its Extra Configuration values).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Paired with Create a Contact (values), contact not in HubSpot | Unsubscribe (UI) | Check Logs Success. Contact created, email logged on it (proposed, unconfirmed) | None |
| 2 | Paired with Create a Deal (values), contact not in HubSpot | Unsubscribe (UI) | Check Logs Success. Contact and deal created, email logged on both (proposed, unconfirmed) | None |
| 3 | Paired with Update a Deal, contact has 3 deals | Unsubscribe (UI) | Check Logs Success. Email logged on latest created deal (naming the prospect, not "Unknown Contact") and on the contact | AL-4103, AL-4123 |

## Open questions

Same as `unsubscribed.md`: expected HubSpot result per activity (proposed:
mirrors Email Sent), whether the UI action fires identically to the real
link, whether an unsubscribe-specific HubSpot property is written. Not
covered here: Create a Task title-empty validation, Closing Date 51 days,
"Mark as Resume" on an unsubscribed prospect (see the full spec for these).
