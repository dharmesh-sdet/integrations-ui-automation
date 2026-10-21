# Prospect is Unsubscribed in Saleshandy: Regression scenarios

## Application Overview

Environment: Staging (pyxis.lifeisgoodforlearner.com), account `unsubscribed`, HubSpot shared portal 247419080. Workflow ticket AL-4015 (under AL-3984). Regression mode, all 9 activities in product UI order (QA, 2026-10-15). No sub-bugs known, every Ticket is None.

Trigger: an unsubscribe in Saleshandy, done two ways, each with its own scenarios (QA, 2026-10-15): (link) the real "Unsubscribe here" link in the delivered email, read from the prospect's Mailinator inbox (https://www.mailinator.com/v4/public/inboxes.jsp?to=<local part>) LINKS tab, link unsub.shengage02.com/c/...; (UI) Sequence > Prospects tab > tick the prospect > toolbar icon "Mark as Unsubscribe" (no confirm dialog, toast "Prospect(s) status updated successfully"). Rows say "Unsubscribe (link)" or "Unsubscribe (UI)".

Expected results: seen on staging 2026-10-15 (Create a Contact only): Prospects tab shows "Unsubscribed" and Logs show one "Prospect is Unsubscribed in Saleshandy" row Success at the first 15 s refresh, for both ways. Every HubSpot result below mirrors the same activity on Email Sent from Saleshandy (email-sent.md) and is marked "(proposed, unconfirmed)": QA has not confirmed it for this trigger. Do not drop or guess it.

Common definitions used in the rows:
- Add prospect: Sequence "HubSpot Prospect Unsubscribed QA" (id 196738, one step, active, sender dharmesh+unodost@saleshandy.com) > Prospects > Search & Add > Create New Prospect with the CSV row values (test-data/hubspot/unsubscribed.csv). Step 1 shows Sent within about 6 s. Unsubscribe only after Sent.
- Check Logs: Settings > Integrations > HubSpot > Logs. Refresh 15 s after the action, then every 10 s until the row "Prospect is Unsubscribed in Saleshandy" is Success (max 3 min). Do not open log entries. Then check the HubSpot record.
- Prospect Latest Status: Prospects tab shows "Unsubscribed" for every row. The Emails tab row stays "Sent".

Run order (saved Extra Configuration values can never be cleared): Phase 1 rows (Extra Configuration skipped or none) before Phase 2 rows (values), activity by activity. Walk Create a Contact "Extra Configuration skipped" (modal Cancel, then Save) first on this account. Rows tagged P1 or P2.

Test data setup:
- One trigger ON only: "Prospect is Unsubscribed in Saleshandy". Every other trigger off first (the toggle row has no accessible name; locate it by the row text). Email Sent must stay off, otherwise it also creates records at step 1.
- Sequence Settings > Unsubscribe > "Unsubscribe as Link" saved once (needed for the link rows; the UI rows work the same with it).
- Save buttons: modal Save for activities with Extra Configuration (saves the whole workflow); page Save plus "Configuration Updated Successfully" for activities without a modal.
- HubSpot Setup (contact, deals from unsubscribed-deals.csv, companies from unsubscribed-companies.csv) is created by hand in HubSpot before the unsubscribe. HubSpot setting "Create and associate companies with contacts" stays off.
- No Closing Date on the prospect, ever (known date bug). Deal Value may be set from the CSV.
- A prospect can be unsubscribed once: no row unsubscribes the same prospect twice.
- Field mapping as in 00-overview.md.
- beatriz.valente@mailinator.com (CSV Trigger behavior (baseline) > 2) and balazs.farkas@mailinator.com (CSV Create a Contact > 1) were used by hand on 2026-10-15: replace both CSV rows with new prospects before running.
- New CSV rows needed (not in unsubscribed.csv): Create a Contact > 5 and 7 (7 needs none), Update a Contact > 5, Create a deal > 6, 7, 8, Update a deal > 7, Create a company > 5, Update a company > 5, Create a Task > 5, Create a Note > 7, Record (log) an email activity > 8.

Open questions (nothing invented, listed for QA):
1. Expected HubSpot result of each activity for an unsubscribe (proposed: same as Email Sent).
2. Does the UI action fire the trigger exactly like the real link? Same Success log seen; HubSpot result of the UI action not yet checked.
3. Same prospect unsubscribed again, or resubscribed via "Subscribe here": not seen, no rows.
4. Is any unsubscribe-specific HubSpot property written (not documented): not checked, no rows.
5. Prospect unsubscribed before any email is sent: not seen, no rows.
6. Update a deal with Extra Configuration empty: not stated even for Email Sent (rows Update a deal 1, 2 are "run once, QA decides").
7. Not covered: Unsubscribe as Text ('Stop' reply), "Include Unsubscribe in Email Header", multi-step sequences (the sequence has one step, so no Step 2 note or email rows).
8. Wait for Update a deal sync in HubSpot (8 minutes on Email is Bounced): not known for this trigger, check HubSpot up to 10 min.

Not covered, still open: none known tickets.

## Test Scenarios

### 1. Trigger behavior (baseline)

**Seed:** `tests/seeds/unsubscribed.seed.spec.ts`

#### 1.1. Trigger behavior (baseline) > 1: trigger off, enable and save

**File:** `tests/hubspot/unsubscribed/baseline.spec.ts`

**Steps:**
  1. With the trigger off, enable "Prospect is Unsubscribed in Saleshandy", select Create a Contact (Extra Configuration skipped), click Save
    - expect: "Configuration Updated Successfully"

#### 1.2. Trigger behavior (baseline) > 2: P1 Unsubscribe (UI), Create a Contact, contact not in HubSpot

**File:** `tests/hubspot/unsubscribed/baseline.spec.ts`

**Steps:**
  1. Add prospect (new CSV row, not beatriz), then Unsubscribe (UI)
    - expect: Prospects tab shows Unsubscribed
    - expect: Logs: one "Prospect is Unsubscribed in Saleshandy" row Success at the first refresh
    - expect: Contact created in HubSpot with the prospect's data (proposed, unconfirmed)

#### 1.3. Trigger behavior (baseline) > 3: P1 Unsubscribe (link), Create a Contact, contact not in HubSpot

**File:** `tests/hubspot/unsubscribed/baseline.spec.ts`

**Steps:**
  1. Add prospect (new CSV row), open Mailinator inbox > LINKS tab, open the unsub.shengage02.com/c/ link
    - expect: Page says "You will no longer receive emails from us" with "Subscribe here" and "Report spam"
    - expect: Prospects tab shows Unsubscribed, Logs one Success row
    - expect: Contact created in HubSpot with the prospect's data, same as row 2 (proposed, unconfirmed)

### 2. Create a Contact in HubSpot

**Seed:** `tests/seeds/unsubscribed.seed.spec.ts`

#### 2.1. Create a Contact in HubSpot > 1: P1 Extra Configuration skipped, contact not in HubSpot

**File:** `tests/hubspot/unsubscribed/create-contact.spec.ts`

**Steps:**
  1. Add prospect (new row, not balazs), Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Contact created with mapped fields incl. company name, industry, country; Lifecycle Stage and Lead Status set by HubSpot (proposed, unconfirmed)

#### 2.2. Create a Contact in HubSpot > 2: P2 Lead Status Open, Lead Lifecycle Marketing Qualified Lead, contact not in HubSpot

**File:** `tests/hubspot/unsubscribed/create-contact.spec.ts`

**Steps:**
  1. Save the values, Add prospect, Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Contact created: Lead Status Open, Lifecycle Stage Marketing Qualified Lead, mapped fields (proposed, unconfirmed)

#### 2.3. Create a Contact in HubSpot > 3: P1 contact already in HubSpot, prospect details changed in Saleshandy

**File:** `tests/hubspot/unsubscribed/create-contact.spec.ts`

**Steps:**
  1. Change Job Title, City, State on the prospect (Updated columns), Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Contact shows the new mapped values (proposed, unconfirmed)

#### 2.4. Create a Contact in HubSpot > 4: P2 contact already at a later Lifecycle Stage (Customer, set by hand)

**File:** `tests/hubspot/unsubscribed/create-contact.spec.ts`

**Steps:**
  1. Add prospect, Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Lifecycle Stage stays Customer (proposed, unconfirmed)

#### 2.5. Create a Contact in HubSpot > 5: P1 Extra Configuration skipped, contact not in HubSpot, real link

**File:** `tests/hubspot/unsubscribed/create-contact.spec.ts`

**Steps:**
  1. Add prospect (new CSV row), Unsubscribe (link)
    - expect: Prospects tab shows Unsubscribed, Check Logs Success
    - expect: Contact created with mapped data, same as row 1 (proposed, unconfirmed)

#### 2.6. Create a Contact in HubSpot > 6: P2 values saved, contact in HubSpot, details changed

**File:** `tests/hubspot/unsubscribed/create-contact.spec.ts`

**Steps:**
  1. Change Job Title, City, State on the prospect, Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Contact shows the new mapped values, Lead Status Open, Lifecycle Stage Marketing Qualified Lead (proposed, unconfirmed)

#### 2.7. Create a Contact in HubSpot > 7: P2 values saved before, reopen Extra Configuration (UI only)

**File:** `tests/hubspot/unsubscribed/create-contact.spec.ts`

**Steps:**
  1. Reopen Extra Configuration with the pointer icon, try to clear both values
    - expect: No empty option; picking the same value keeps it (proposed, unconfirmed)

### 3. Update a Contact in HubSpot

**Seed:** `tests/seeds/unsubscribed.seed.spec.ts`

#### 3.1. Update a Contact in HubSpot > 1: P1 Extra Configuration skipped, contact in HubSpot, details changed

**File:** `tests/hubspot/unsubscribed/update-contact.spec.ts`

**Steps:**
  1. Change Job Title, City on the prospect, Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Contact shows the new mapped values (proposed, unconfirmed)

#### 3.2. Update a Contact in HubSpot > 2: P1 contact in HubSpot, details not changed

**File:** `tests/hubspot/unsubscribed/update-contact.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Contact not updated (proposed, unconfirmed)

#### 3.3. Update a Contact in HubSpot > 3: P1 contact not in HubSpot

**File:** `tests/hubspot/unsubscribed/update-contact.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: No contact created (proposed, unconfirmed)

#### 3.4. Update a Contact in HubSpot > 4: P2 Update Lead Status Connected, Update Lead Lifecycle Sales Qualified Lead, contact at Lifecycle Stage Lead

**File:** `tests/hubspot/unsubscribed/update-contact.spec.ts`

**Steps:**
  1. Save the values, Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Lead Status Connected, Lifecycle Stage Sales Qualified Lead (proposed, unconfirmed)

#### 3.5. Update a Contact in HubSpot > 5: P1 contact in HubSpot, details changed, real link

**File:** `tests/hubspot/unsubscribed/update-contact.spec.ts`

**Steps:**
  1. Change Job Title, City on the prospect (new CSV row), Unsubscribe (link)
    - expect: Check Logs Success
    - expect: Contact shows the new mapped values, same as row 1 (proposed, unconfirmed)

### 4. Create a deal in HubSpot

**Seed:** `tests/seeds/unsubscribed.seed.spec.ts`

#### 4.1. Create a deal in HubSpot > 1: P1 Extra Configuration skipped, contact in HubSpot, no deal

**File:** `tests/hubspot/unsubscribed/create-deal.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Deal created and associated to the contact; Pipeline, Stage, Type, Priority filled by HubSpot; Amount and close date empty (proposed, unconfirmed)

#### 4.2. Create a deal in HubSpot > 2: P1 contact not in HubSpot

**File:** `tests/hubspot/unsubscribed/create-deal.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Contact and deal created and associated, values as row 1 (proposed, unconfirmed)

#### 4.3. Create a deal in HubSpot > 3: P1 contact already has 1 deal

**File:** `tests/hubspot/unsubscribed/create-deal.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: New deal created, the contact now has 2 deals (proposed, unconfirmed)

#### 4.4. Create a deal in HubSpot > 4: P1 prospect has Deal Value 15800

**File:** `tests/hubspot/unsubscribed/create-deal.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Deal Amount = Deal Value, close date empty (proposed, unconfirmed)

#### 4.5. Create a deal in HubSpot > 5: P2 Sales Pipeline, Initial Contact, New Business, High, Closing Date 0 Days, contact not in HubSpot

**File:** `tests/hubspot/unsubscribed/create-deal.spec.ts`

**Steps:**
  1. Save the values, Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Contact and deal created and associated with the 4 values; close date empty (proposed, unconfirmed)

#### 4.6. Create a deal in HubSpot > 6: P1 Extra Configuration skipped, contact in HubSpot, no deal, real link

**File:** `tests/hubspot/unsubscribed/create-deal.spec.ts`

**Steps:**
  1. Unsubscribe (link), new CSV row
    - expect: Check Logs Success
    - expect: Deal created and associated, same as row 1 (proposed, unconfirmed)

#### 4.7. Create a deal in HubSpot > 7: P2 prospect has Deal Value, Closing Date 1 Day

**File:** `tests/hubspot/unsubscribed/create-deal.spec.ts`

**Steps:**
  1. Set Closing Date 1 Day in the modal, Unsubscribe (UI), new CSV row with Deal Value
    - expect: Check Logs Success
    - expect: Amount = Deal Value, close date = today + 1 (proposed, unconfirmed)

#### 4.8. Create a deal in HubSpot > 8: P2 Closing Date 51 Days

**File:** `tests/hubspot/unsubscribed/create-deal.spec.ts`

**Steps:**
  1. Set Closing Date 51 Days, Unsubscribe (UI), new CSV row
    - expect: Check Logs Success
    - expect: Close date = today + 51 (proposed, unconfirmed)

### 5. Update a deal in HubSpot

**Seed:** `tests/seeds/unsubscribed.seed.spec.ts`

#### 5.1. Update a deal in HubSpot > 1: P1 Extra Configuration skipped, contact has 1 deal

**File:** `tests/hubspot/unsubscribed/update-deal.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Open: run once, QA decides (proposed, unconfirmed)

#### 5.2. Update a deal in HubSpot > 2: P1 contact has 3 deals

**File:** `tests/hubspot/unsubscribed/update-deal.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Open: run once, QA decides (proposed, unconfirmed)

#### 5.3. Update a deal in HubSpot > 3: P2 Sales Pipeline, Follow-Up, New Business, High, contact has 1 deal at Prospecting

**File:** `tests/hubspot/unsubscribed/update-deal.spec.ts`

**Steps:**
  1. Save the values, Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Deal Stage Follow-Up, other values set (proposed, unconfirmed)

#### 5.4. Update a deal in HubSpot > 4: P2 Closing Date 51 Days, contact has 1 deal

**File:** `tests/hubspot/unsubscribed/update-deal.spec.ts`

**Steps:**
  1. Set Closing Date 51 Days, Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Close date = today + 51 (proposed, unconfirmed)

#### 5.5. Update a deal in HubSpot > 5: P1 contact in HubSpot with 0 deals

**File:** `tests/hubspot/unsubscribed/update-deal.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Nothing created or updated (proposed, unconfirmed)

#### 5.6. Update a deal in HubSpot > 6: P1 contact not in HubSpot

**File:** `tests/hubspot/unsubscribed/update-deal.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Nothing created or updated (proposed, unconfirmed)

#### 5.7. Update a deal in HubSpot > 7: P1 contact has 1 deal, real link

**File:** `tests/hubspot/unsubscribed/update-deal.spec.ts`

**Steps:**
  1. Unsubscribe (link), new CSV row
    - expect: Check Logs Success
    - expect: Same as row 1, open: run once, QA decides (proposed, unconfirmed)

### 6. Create a company in HubSpot

**Seed:** `tests/seeds/unsubscribed.seed.spec.ts`

#### 6.1. Create a company in HubSpot > 1: contact in HubSpot, prospect has company details

**File:** `tests/hubspot/unsubscribed/create-company.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: One company created and associated (proposed, unconfirmed)

#### 6.2. Create a company in HubSpot > 2: a company with the same domain already exists

**File:** `tests/hubspot/unsubscribed/create-company.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: New company created anyway and associated (proposed, unconfirmed)

#### 6.3. Create a company in HubSpot > 3: contact not in HubSpot

**File:** `tests/hubspot/unsubscribed/create-company.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Contact and company created and associated (proposed, unconfirmed)

#### 6.4. Create a company in HubSpot > 4: prospect has empty company details, only a company domain

**File:** `tests/hubspot/unsubscribed/create-company.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Company created from the company domain (proposed, unconfirmed)

#### 6.5. Create a company in HubSpot > 5: contact in HubSpot, real link

**File:** `tests/hubspot/unsubscribed/create-company.spec.ts`

**Steps:**
  1. Unsubscribe (link), new CSV row
    - expect: Check Logs Success
    - expect: One company created and associated, same as row 1 (proposed, unconfirmed)

### 7. Update a company in HubSpot

**Seed:** `tests/seeds/unsubscribed.seed.spec.ts`

#### 7.1. Update a company in HubSpot > 1: contact has 1 associated company, company details changed in Saleshandy

**File:** `tests/hubspot/unsubscribed/update-company.spec.ts`

**Steps:**
  1. Change City and State on the prospect, Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Company shows the new values (proposed, unconfirmed)

#### 7.2. Update a company in HubSpot > 2: contact has 2 associated companies

**File:** `tests/hubspot/unsubscribed/update-company.spec.ts`

**Steps:**
  1. Change City and State on the prospect, Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Latest associated company updated, the other unchanged (proposed, unconfirmed)

#### 7.3. Update a company in HubSpot > 3: contact in HubSpot, no associated company

**File:** `tests/hubspot/unsubscribed/update-company.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Nothing created or updated (proposed, unconfirmed)

#### 7.4. Update a company in HubSpot > 4: contact not in HubSpot

**File:** `tests/hubspot/unsubscribed/update-company.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Nothing created or updated (proposed, unconfirmed)

#### 7.5. Update a company in HubSpot > 5: contact has 1 associated company, details changed, real link

**File:** `tests/hubspot/unsubscribed/update-company.spec.ts`

**Steps:**
  1. Change City and State on the prospect, Unsubscribe (link), new CSV row
    - expect: Check Logs Success
    - expect: Company shows the new values, same as row 1 (proposed, unconfirmed)

### 8. Create a Task in HubSpot

**Seed:** `tests/seeds/unsubscribed.seed.spec.ts`

#### 8.1. Create a Task in HubSpot > 3: P1 modal never saved, Task Title empty (UI only)

**File:** `tests/hubspot/unsubscribed/create-task.spec.ts`

**Steps:**
  1. Open Extra Configuration, fill Type Call, Priority Medium, Due In 3, leave Task Title empty
    - expect: Save cannot be clicked (proposed, unconfirmed)

#### 8.2. Create a Task in HubSpot > 4: P1 Due In 0 (UI only)

**File:** `tests/hubspot/unsubscribed/create-task.spec.ts`

**Steps:**
  1. Fill Task Title, Type, Priority, leave Due In at 0
    - expect: Save cannot be clicked (proposed, unconfirmed)

#### 8.3. Create a Task in HubSpot > 1: P2 title "Follow up from the workflow", Call, Medium, due in 3 days, contact in HubSpot

**File:** `tests/hubspot/unsubscribed/create-task.spec.ts`

**Steps:**
  1. Save the values, Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Task on the contact: title, type, priority, due today + 3 (proposed, unconfirmed)

#### 8.4. Create a Task in HubSpot > 2: P2 contact not in HubSpot

**File:** `tests/hubspot/unsubscribed/create-task.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Contact and task created (proposed, unconfirmed)

#### 8.5. Create a Task in HubSpot > 5: P2 contact in HubSpot, real link

**File:** `tests/hubspot/unsubscribed/create-task.spec.ts`

**Steps:**
  1. Unsubscribe (link), new CSV row
    - expect: Check Logs Success
    - expect: Task on the contact, same as row 1 (proposed, unconfirmed)

### 9. Create a Note in HubSpot

**Seed:** `tests/seeds/unsubscribed.seed.spec.ts`

#### 9.1. Create a Note in HubSpot > 1: P1 paired with Create a Contact (skipped), contact not in HubSpot

**File:** `tests/hubspot/unsubscribed/create-note.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Contact created, note shows Step 1, Variant A and the Prospect Outcome (proposed, unconfirmed)

#### 9.2. Create a Note in HubSpot > 2: P1 paired with Update a Contact (skipped), contact in HubSpot

**File:** `tests/hubspot/unsubscribed/create-note.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Note on the contact (proposed, unconfirmed)

#### 9.3. Create a Note in HubSpot > 6: P1 Create a Note selected alone

**File:** `tests/hubspot/unsubscribed/create-note.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success (workflow still runs)
    - expect: No contact and no note created in HubSpot (proposed, unconfirmed)

#### 9.4. Create a Note in HubSpot > 3: P2 paired with Create a deal (values), contact not in HubSpot, Deal Value 25500

**File:** `tests/hubspot/unsubscribed/create-note.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Contact and deal created, note on the contact and on the deal (proposed, unconfirmed)

#### 9.5. Create a Note in HubSpot > 4: P2 paired with Update a deal (1 deal)

**File:** `tests/hubspot/unsubscribed/create-note.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Note on the contact and on the deal (proposed, unconfirmed)

#### 9.6. Create a Note in HubSpot > 5: P2 paired with Update a Contact (values saved), contact in HubSpot

**File:** `tests/hubspot/unsubscribed/create-note.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Note on the contact; contact has Lead Status Connected, Lifecycle Stage Sales Qualified Lead (proposed, unconfirmed)

#### 9.7. Create a Note in HubSpot > 7: P1 paired with Create a Contact (skipped), real link

**File:** `tests/hubspot/unsubscribed/create-note.spec.ts`

**Steps:**
  1. Unsubscribe (link), new CSV row
    - expect: Check Logs Success
    - expect: Contact created, note same as row 1 (proposed, unconfirmed)

### 10. Record (log) an Email Activity in HubSpot

**Seed:** `tests/seeds/unsubscribed.seed.spec.ts`

#### 10.1. Record (log) an email activity in HubSpot > 1: tooltip (UI only)

**File:** `tests/hubspot/unsubscribed/record-email.spec.ts`

**Steps:**
  1. Hover the activity
    - expect: Tooltip: "Logging an email alone would result in failure. Please create/update contact or deal to associate an email." (proposed, unconfirmed)

#### 10.2. Record (log) an email activity in HubSpot > 2: only this activity selected, Save (UI only)

**File:** `tests/hubspot/unsubscribed/record-email.spec.ts`

**Steps:**
  1. Click the page's Save
    - expect: Saved, "Configuration Updated Successfully" (proposed, unconfirmed)

#### 10.3. Record (log) an email activity in HubSpot > 3: P1 paired with Create a Contact, contact not in HubSpot

**File:** `tests/hubspot/unsubscribed/record-email.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Email logged on the contact with From, To, "logged email by", date and time, step body (proposed, unconfirmed)

#### 10.4. Record (log) an email activity in HubSpot > 4: P1 paired with Update a Contact, contact in HubSpot, prospect has Deal Value 27800

**File:** `tests/hubspot/unsubscribed/record-email.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Email logged on the contact (proposed, unconfirmed)

#### 10.5. Record (log) an email activity in HubSpot > 5: P2 paired with Create a deal, contact not in HubSpot, Deal Value 28200

**File:** `tests/hubspot/unsubscribed/record-email.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Email logged on the contact and on the deal (proposed, unconfirmed)

#### 10.6. Record (log) an email activity in HubSpot > 6: P2 paired with Update a deal, contact has 3 deals

**File:** `tests/hubspot/unsubscribed/record-email.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Email logged on the contact and on the latest created deal (proposed, unconfirmed)

#### 10.7. Record (log) an email activity in HubSpot > 7: P2 paired with Update a Contact (values saved), contact in HubSpot, Deal Value 27800

**File:** `tests/hubspot/unsubscribed/record-email.spec.ts`

**Steps:**
  1. Unsubscribe (UI)
    - expect: Check Logs Success
    - expect: Email logged on the contact; contact has the saved values (proposed, unconfirmed)

#### 10.8. Record (log) an email activity in HubSpot > 8: P1 paired with Create a Contact, real link

**File:** `tests/hubspot/unsubscribed/record-email.spec.ts`

**Steps:**
  1. Unsubscribe (link), new CSV row
    - expect: Check Logs Success
    - expect: Contact created, email logged on it, same as row 3 (proposed, unconfirmed)
