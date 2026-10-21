# Prospect is Unsubscribed in Saleshandy: Regression scenarios

## Application Overview

Environment: Staging (pyxis.lifeisgoodforlearner.com), account `unsubscribed`. Workflow ticket AL-4015 (under AL-3984). No sub-bugs known, every Ticket is None. Direction: Saleshandy to HubSpot. Exploration status: the trigger row was seen on Settings > Integrations > HubSpot > Triggers & Activity (9th row, between "Link is Clicked in Saleshandy" and "Email is Bounced in Saleshandy"), but the activity dropdown could NOT be opened: the trigger is off and enabling it was blocked by the permission classifier in this read-only run. The activity list below is therefore from the docs (context/hubspot/prospect-unsubscribed.md), not seen on staging. Every expected result is (proposed, unconfirmed) unless stated. Proposals carried: (a) each activity mirrors the same activity on Email Sent from Saleshandy; (b) unsubscribe status may reach HubSpot as a property (unknown); (c) UI "Mark as Unsubscribed" fires the trigger like the real link. Data rule: KEEP_TEST_DATA=1. Not covered, still open: none known. Do not treat open items as failures.

Test data setup:
- Account `unsubscribed` (HubSpot portal connected, logged in). Field mapping as in context/hubspot/00-overview.md. HubSpot setting "Create and associate companies with contacts" off.
- Sequence: new, Active, 2 steps, no A/B variants, so the prospect has a row in the Emails tab.
- Prospect: add one at a time with Add Prospects, one prospect per row (a prospect can be unsubscribed once). Address name@mailinator.com. No Closing Date on the prospect (known date conversion bug); Deal Value allowed.
- Trigger: every other trigger off, only "Prospect is Unsubscribed in Saleshandy" on. Click the modal Save when an Extra Configuration modal exists, else the page Save and wait for "Configuration Updated Successfully".
- Phase order: Extra Configuration empty rows first, then filled rows (saved values cannot be emptied again).
- Unsubscribe methods: (L) real unsubscribe link in a sent email, (U) prospect > "Mark as Unsubscribed" in the Saleshandy UI. Real link use is capped; default to (U) for most rows and use (L) in baseline and a few activity rows (cap to be confirmed by QA).
- Verify: HubSpot record. Logs wait time not known (open question). Logs are not the primary check (QA 2026-10-14 for Email Bounced; to confirm here).

## Test Scenarios

### 1. Trigger behavior (baseline)

**Seed:** `tests/seeds/unsubscribed.seed.spec.ts`

#### 1.1. Enable trigger and select an activity, then Save

**File:** `tests/hubspot/prospect-unsubscribed/baseline-save.spec.ts`

**Steps:**
  1. Enable 'Prospect is Unsubscribed in Saleshandy', open the activity dropdown, select an activity, click Save
    - expect: 'Configuration Updated Successfully' (proposed, unconfirmed)

#### 1.2. Unsubscribe via UI Mark as Unsubscribed fires the trigger

**File:** `tests/hubspot/prospect-unsubscribed/baseline-ui.spec.ts`

**Steps:**
  1. Prospect in Emails tab, sequence Active: prospect > Mark as Unsubscribed
    - expect: Prospect shows Unsubscribed in Saleshandy; contact created/updated in HubSpot per selected activity (proposed, unconfirmed)

#### 1.3. Unsubscribe via real unsubscribe link fires the trigger

**File:** `tests/hubspot/prospect-unsubscribed/baseline-link.spec.ts`

**Steps:**
  1. Send the email, open it, click the unsubscribe link and confirm
    - expect: Prospect Unsubscribed in Saleshandy; same HubSpot result as the UI method (proposed, unconfirmed)

#### 1.4. Only another trigger enabled

**File:** `tests/hubspot/prospect-unsubscribed/baseline-other-trigger.spec.ts`

**Steps:**
  1. Enable only 'Email Sent from Saleshandy', then Mark as Unsubscribed
    - expect: No contact created in HubSpot (proposed, unconfirmed)

#### 1.5. Sequence paused after being Active

**File:** `tests/hubspot/prospect-unsubscribed/baseline-paused.spec.ts`

**Steps:**
  1. Pause the sequence, then Mark as Unsubscribed
    - expect: Same as the Active case (proposed, unconfirmed)

#### 1.6. Unsubscribed status reaches HubSpot as a property

**File:** `tests/hubspot/prospect-unsubscribed/baseline-property.spec.ts`

**Steps:**
  1. After unsubscribe with Create/Update a Contact, open the HubSpot contact > All properties
    - expect: Unknown whether any unsubscribe property is set. Record what is seen; do not assert (unconfirmed)

### 2. Create a Contact in HubSpot (Extra Configuration: Lead Status, Lead Lifecycle; empty first)

**Seed:** `tests/seeds/unsubscribed.seed.spec.ts`

#### 2.1. Create a Contact 1: contact not in HubSpot, empty config

**File:** `tests/hubspot/prospect-unsubscribed/create-contact-1.spec.ts`

**Steps:**
  1. Unsubscribe the prospect (U)
    - expect: Contact created with mapped fields incl. company name, industry, country; Lifecycle/Lead Status set by HubSpot (proposed, unconfirmed)

#### 2.2. Create a Contact 2: contact exists, prospect details changed

**File:** `tests/hubspot/prospect-unsubscribed/create-contact-2.spec.ts`

**Steps:**
  1. Change details in Saleshandy, unsubscribe (U)
    - expect: Contact shows new mapped values (proposed, unconfirmed)

#### 2.3. Create a Contact 3: Lead Status Open, Lifecycle Marketing Qualified Lead

**File:** `tests/hubspot/prospect-unsubscribed/create-contact-3.spec.ts`

**Steps:**
  1. Fill both fields, save, unsubscribe a new prospect (L)
    - expect: Contact created with Lead Status Open and Lifecycle Marketing Qualified Lead (proposed, unconfirmed)

#### 2.4. Create a Contact 4: contact at later Lifecycle Stage

**File:** `tests/hubspot/prospect-unsubscribed/create-contact-4.spec.ts`

**Steps:**
  1. Set Customer by hand in HubSpot, unsubscribe (U)
    - expect: Lifecycle stays Customer (HubSpot forward-only; proposed, unconfirmed)

#### 2.5. Create a Contact 5: values cannot be cleared after save

**File:** `tests/hubspot/prospect-unsubscribed/create-contact-5.spec.ts`

**Steps:**
  1. Reopen Extra Configuration, try to clear both
    - expect: No empty option (proposed, mirrors Email Sent)

### 3. Update a Contact in HubSpot (Update Lead Status, Update Lead Lifecycle)

**Seed:** `tests/seeds/unsubscribed.seed.spec.ts`

#### 3.1. Update a Contact 1: contact exists, details changed

**File:** `tests/hubspot/prospect-unsubscribed/update-contact-1.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: Contact shows new mapped values (proposed, unconfirmed)

#### 3.2. Update a Contact 2: contact not in HubSpot

**File:** `tests/hubspot/prospect-unsubscribed/update-contact-2.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: No contact created (proposed, unconfirmed)

#### 3.3. Update a Contact 3: details not changed

**File:** `tests/hubspot/prospect-unsubscribed/update-contact-3.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: Contact not updated (proposed, unconfirmed)

#### 3.4. Update a Contact 4: Lead Status Connected, Lifecycle Sales Qualified Lead

**File:** `tests/hubspot/prospect-unsubscribed/update-contact-4.spec.ts`

**Steps:**
  1. Contact at Lifecycle Lead, fill values, unsubscribe (U)
    - expect: Lead Status Connected, Lifecycle Sales Qualified Lead (proposed, unconfirmed)

### 4. Create a deal in HubSpot (Pipeline, Pipeline Stage, Deal Type, Deal Priority, Closing Date)

**Seed:** `tests/seeds/unsubscribed.seed.spec.ts`

#### 4.1. Create a deal 1: contact in HubSpot, no deal, empty config

**File:** `tests/hubspot/prospect-unsubscribed/create-deal-1.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: Deal created and associated; Amount and close date empty (proposed, unconfirmed)

#### 4.2. Create a deal 2: contact not in HubSpot

**File:** `tests/hubspot/prospect-unsubscribed/create-deal-2.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: Contact and deal created and associated (proposed, unconfirmed)

#### 4.3. Create a deal 3: contact already has 1 deal

**File:** `tests/hubspot/prospect-unsubscribed/create-deal-3.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: New deal created, contact has 2 deals (proposed, unconfirmed)

#### 4.4. Create a deal 4: prospect has Deal Value

**File:** `tests/hubspot/prospect-unsubscribed/create-deal-4.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: Amount = Deal Value, close date empty (proposed, unconfirmed)

#### 4.5. Create a deal 5: values Sales Pipeline, Initial Contact, New Business, High, 0 Days

**File:** `tests/hubspot/prospect-unsubscribed/create-deal-5.spec.ts`

**Steps:**
  1. Fill values, unsubscribe (L)
    - expect: Deal has the 4 values, close date empty (proposed, unconfirmed)

#### 4.6. Create a deal 6: Closing Date 1 Day and 51 Days

**File:** `tests/hubspot/prospect-unsubscribed/create-deal-6.spec.ts`

**Steps:**
  1. Set 1 Day then 51 Days (separate prospects), unsubscribe (U)
    - expect: Close date = today + 1 / today + 51 (proposed, unconfirmed)

### 5. Update a deal in HubSpot

**Seed:** `tests/seeds/unsubscribed.seed.spec.ts`

#### 5.1. Update a deal 1: contact has 1 deal, empty config

**File:** `tests/hubspot/prospect-unsubscribed/update-deal-1.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: Open: run once, QA decides (mirrors Email Bounced)

#### 5.2. Update a deal 2: contact has 3 deals

**File:** `tests/hubspot/prospect-unsubscribed/update-deal-2.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: Latest created deal updated, others unchanged (proposed, unconfirmed)

#### 5.3. Update a deal 3: contact has 0 deals

**File:** `tests/hubspot/prospect-unsubscribed/update-deal-3.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: Nothing created or updated (proposed, unconfirmed)

#### 5.4. Update a deal 4: contact not in HubSpot

**File:** `tests/hubspot/prospect-unsubscribed/update-deal-4.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: Nothing created or updated (proposed, unconfirmed)

#### 5.5. Update a deal 5: values Sales Pipeline, Follow-Up, New Business, High

**File:** `tests/hubspot/prospect-unsubscribed/update-deal-5.spec.ts`

**Steps:**
  1. Contact has a deal at Prospecting, fill values, unsubscribe (U)
    - expect: Deal Stage Follow-Up (proposed, unconfirmed)

### 6. Create a company in HubSpot (no Extra Configuration)

**Seed:** `tests/seeds/unsubscribed.seed.spec.ts`

#### 6.1. Create a company 1: contact in HubSpot, prospect has company details

**File:** `tests/hubspot/prospect-unsubscribed/create-company-1.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: One company created and associated (proposed, unconfirmed)

#### 6.2. Create a company 2: company with same domain exists

**File:** `tests/hubspot/prospect-unsubscribed/create-company-2.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: New company created anyway and associated (proposed, unconfirmed)

#### 6.3. Create a company 3: contact not in HubSpot

**File:** `tests/hubspot/prospect-unsubscribed/create-company-3.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: Contact and company created and associated (proposed, unconfirmed)

#### 6.4. Create a company 4: only a company domain

**File:** `tests/hubspot/prospect-unsubscribed/create-company-4.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: Company created from the domain (proposed, unconfirmed)

### 7. Update a company in HubSpot (no Extra Configuration)

**Seed:** `tests/seeds/unsubscribed.seed.spec.ts`

#### 7.1. Update a company 1: contact has 1 associated company

**File:** `tests/hubspot/prospect-unsubscribed/update-company-1.spec.ts`

**Steps:**
  1. Change company details in Saleshandy, unsubscribe (U)
    - expect: Company shows new values (proposed, unconfirmed)

#### 7.2. Update a company 2: contact has 2 associated companies

**File:** `tests/hubspot/prospect-unsubscribed/update-company-2.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: Latest associated company updated, other unchanged (proposed, unconfirmed)

#### 7.3. Update a company 3: no associated company

**File:** `tests/hubspot/prospect-unsubscribed/update-company-3.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: Nothing created or updated (proposed, unconfirmed)

#### 7.4. Update a company 4: contact not in HubSpot

**File:** `tests/hubspot/prospect-unsubscribed/update-company-4.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: Nothing created or updated (proposed, unconfirmed)

### 8. Create a Task in HubSpot (Task title, Task Type, Task Priority, Due in)

**Seed:** `tests/seeds/unsubscribed.seed.spec.ts`

#### 8.1. Create a Task 1: contact in HubSpot, title 'Follow up from the workflow', Call, Medium, 3 days

**File:** `tests/hubspot/prospect-unsubscribed/create-task-1.spec.ts`

**Steps:**
  1. Fill modal, Save, unsubscribe (U)
    - expect: Task on the contact with title, type, priority, due today + 3 (proposed, unconfirmed)

#### 8.2. Create a Task 2: contact not in HubSpot

**File:** `tests/hubspot/prospect-unsubscribed/create-task-2.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: Contact and task created (proposed, unconfirmed)

#### 8.3. Create a Task 3: Due in 0

**File:** `tests/hubspot/prospect-unsubscribed/create-task-3.spec.ts`

**Steps:**
  1. Fill everything, leave Due in at 0
    - expect: Save cannot be clicked (proposed, unconfirmed)

#### 8.4. Create a Task 4: empty Task title

**File:** `tests/hubspot/prospect-unsubscribed/create-task-4.spec.ts`

**Steps:**
  1. Fill type, priority, Due in 3, empty title
    - expect: Save cannot be clicked (proposed, unconfirmed)

### 9. Create a Note in HubSpot (paired)

**Seed:** `tests/seeds/unsubscribed.seed.spec.ts`

#### 9.1. Note 1: paired with Create a Contact, contact not in HubSpot

**File:** `tests/hubspot/prospect-unsubscribed/note-1.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: Contact created; note shows Step, Variant A and Prospect Outcome (proposed, unconfirmed)

#### 9.2. Note 2: paired with Update a Contact

**File:** `tests/hubspot/prospect-unsubscribed/note-2.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: Note on the contact (proposed, unconfirmed)

#### 9.3. Note 3: paired with Create a deal / Update a deal

**File:** `tests/hubspot/prospect-unsubscribed/note-3.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: Note on the contact and on the deal (proposed, unconfirmed)

#### 9.4. Note 4: Create a Note alone

**File:** `tests/hubspot/prospect-unsubscribed/note-4.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: No contact and no note created (proposed, unconfirmed)

### 10. Record (log) an email activity in HubSpot (paired)

**Seed:** `tests/seeds/unsubscribed.seed.spec.ts`

#### 10.1. Record 1: tooltip on hover

**File:** `tests/hubspot/prospect-unsubscribed/record-1.spec.ts`

**Steps:**
  1. Hover the activity
    - expect: Tooltip: 'Logging an email alone would result in failure. Please create/update contact or deal to associate an email.' (proposed, seen on Email Sent)

#### 10.2. Record 2: only this activity, page Save

**File:** `tests/hubspot/prospect-unsubscribed/record-2.spec.ts`

**Steps:**
  1. Click page Save
    - expect: Saved (proposed, unconfirmed)

#### 10.3. Record 3: paired with Create a Contact, contact not in HubSpot

**File:** `tests/hubspot/prospect-unsubscribed/record-3.spec.ts`

**Steps:**
  1. Unsubscribe (U)
    - expect: Email logged on the contact with From, To, 'logged email by', date/time, step body (proposed, unconfirmed)

#### 10.4. Record 4: paired with Create a deal / Update a deal (3 deals)

**File:** `tests/hubspot/prospect-unsubscribed/record-4.spec.ts`

**Steps:**
  1. Unsubscribe (L, real link)
    - expect: Email logged on the contact and on the (latest) deal (proposed, unconfirmed)
