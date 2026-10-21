# Salesforce: Reply is received in Saleshandy > Create a Lead (Regression)

## Application Overview

Environment: Saleshandy staging (https://pyxis.lifeisgoodforlearner.com), account sfreplyreceived (dharmesh+salesforce+1@saleshandy.com), Salesforce already connected to the shared dev org saleshandy-dev-ed. Mode: Regression. Scope: trigger "Reply is Received in Saleshandy" (exact label on the page) with the single activity "Create a Lead in Salesforce" (exact label). QA decisions 2026-10-16: reply is triggered by marking the email as Replied; wait uses the Logs cadence (refresh 15 s after the action, then every 10 s, max 3 min); the Lead is verified in Salesforce itself, not only in Logs. Data rule: KEEP_TEST_DATA=1 (created data stays), unique values per run, never edit existing records. Written in the _SCENARIO_TEMPLATE.md style (Scenario / Do / Expected / Ticket); no Jira tickets are known for this workflow, so Ticket is None for every case.

WHAT WAS SEEN (read-only, staging, 2026-10-16; nothing saved, nothing created):
- Path: Settings > Integrations (URL /api-and-integrations/integrations) > Salesforce card shows "Connected" > page /api-and-integrations/integrations/salesforce. Top-right button: Disconnect. Tabs: Field Mapping, Triggers & Activity (?tab=triggers-activity), Prospects Import, Custom Workflow, Logs (?tab=logs). There is no separate "Configure" menu; field mapping is the first tab.
- Field Mapping tab: 5 cards, each "Prospects in Saleshandy <-> X": Lead Properties, Contact Properties, Opportunity Properties, Account Properties, salesforce_api_version.
- Lead Properties mapping page ("Please map the fields between Saleshandy & Salesforce so data gets synchronized between both apps accordingly."): 44 rows, Saleshandy side is a fixed greyed label, Salesforce side is a dropdown. On this account ALL 44 dropdowns show the placeholder "Select" (nothing mapped) and Save is disabled. So no Saleshandy field -> Lead property mapping exists on this account right now.
  Saleshandy fields in page order: Prospect Overview, First Name, Last Name, Email, Phone Number, Job Title, Department, Industry, Experience, LinkedIn, Twitter, Facebook, Website, City, State, Country, Company, Company Domain, Company Website, Company Industry, Company Size, Company Revenue, Company Founded Year, Company LinkedIn, Company Phone, Person's Seniority Level, Decision Role, Current Company Experience (In Months), Tenure In Current Role (In Months), Projected Salary, LinkedIn Followers, Is B2B, Company HQ Location, Company's Latest Funding Amount, Company's Latest Funding Date, Profile Headline, LinkedIn Profile Summary, Past Companies, Educational Qualification, Key Skills, Job Changed Before (In Months), Profile Picture, Deal Value, Closing Date.
  Salesforce Lead properties offered in the dropdown (opened on First Name, closed without saving): Lead ID, Deleted, Master Record ID, Last Name, First Name, Salutation, Full Name, Title, Company, Street, City, State/Province, Zip/Postal Code, Country, Latitude, Longitude, Geocode Accuracy, Address, Phone, Mobile Phone, Fax, Email, Website, Photo URL, Description, Lead Source, Status, Industry, Rating, Annual Revenue, Employees, Owner ID, Converted, Converted Date, Converted Account ID, Converted Contact ID, Converted Opportunity ID, Unread By Owner, Created Date, Created By ID, Last Modified Date, Last Modified By ID, System Modstamp, Last Activity, Last Viewed Date, Last Referenced Date, Data.com Key, Jigsaw Contact ID, Clean Status, Company D-U-N-S Number, D&B Company ID, Email Bounced Reason, Email Bounced Date, Individual ID, SIC Code, Product Interest, Primary, Current Generator(s), Number of Locations (list may continue past what was read).
- Triggers & Activity tab: "Enable the triggers & activities you want to automate between Saleshandy & Salesforce." 12 rows, each a toggle (all off now) plus an activity dropdown: Email Sent from Saleshandy; Reply is Received in Saleshandy; Prospect Outcome is updated in Saleshandy; Sequence Email is Opened in Saleshandy; Link is Clicked in Saleshandy; Prospect is Unsubscribed in Saleshandy; Email is Bounced in Saleshandy; Lead is created in Salesforce (V1); Contact is created in Salesforce; Opportunity is created in Salesforce; Account is created in Salesforce; Call Logged in Saleshandy; Call Outcome Updated in Saleshandy. (That is 13 rows.) Save button bottom right.
- Activities offered under Reply is Received in Saleshandy (dropdown, multi-select, chosen item shows as a chip with an x): Create a Account in Salesforce, Update a Account in Salesforce, Create a Contact in Salesforce, Update a Contact in Salesforce, Create a Lead in Salesforce, Update a Lead in Salesforce, Create a Opportunity in Salesforce, Update a Opportunity in Salesforce, Attach Note in Salesforce, Record(log) an Email Activity in Salesforce.
- Create a Lead in Salesforce: after choosing it (not saved) it appears as a chip; clicking the chip opened NO Extra Configuration modal. No extra options were seen for this activity.
- Logs tab: filters "Status (All)" and "Last 30 Days", a Refresh button. Account has no logs: empty state "No logs yet - Logs will appear here once your workflows and trigger rules start running." The column layout of a log row was NOT seen.
- Sender email account: Email Accounts has one account, "Salesforce Testing" (dharmesh+salesforce@saleshandy.com, SMTP, Connected). Sending Settings: Total number of emails per day = 150; inbox placement test emails per day = 70; Time interval between two emails = 40 to 50 seconds. Not in the 300 to 1200 s range, so no flag. (Page shows a warning about exceeding 30 per day, and "Total daily sending limit: 220 emails".)
- Sequences: one sequence "Salesforce's First Sequence." (Draft, 0 prospects, 3 steps, id 196746; tabs Steps, Prospects, Settings, Subsequence; no Emails tab seen while Draft). CRM > All Prospects is empty on this account ("Prospects are empty").

TEST DATA SETUP
- Before every case: Triggers & Activity > turn every other trigger off, switch on only "Reply is Received in Saleshandy", choose only "Create a Lead in Salesforce", Save. The success message text for Salesforce is not seen; HubSpot shows "Configuration Updated Successfully" (expect the same, unconfirmed).
- Lead Properties mapping (Field Mapping > Lead Properties) must be saved first because it is empty now. Proposed minimal mapping for the main cases: Last Name -> Last Name, First Name -> First Name, Email -> Email, Phone Number -> Phone, Job Title -> Title, Company -> Company, City -> City. This is a proposal; QA confirms which fields to map.
- Each case uses its own brand-new prospect (unique name and email, unique prefix per run, never an existing Salesforce record), added to a launched sequence with Add Prospects one at a time; wait until step 1 shows Sent. Prospect CSV is not created yet (needs QA).
- "Mark as Replied": Sequence > Emails tab > the prospect's row > three dots (HubSpot flow, seen 2026-10-09 in the page object comment) > Mark as replied. Not seen on this account (sequence is Draft with no prospects).
- Logs: Settings > Integrations > Salesforce > Logs tab. Refresh 15 s after Mark as Replied, then every 10 s, up to 3 min. Do not open log entries.
- Verify in Salesforce: Leads tab, find the Lead by the unique email or last name; check Last Name, Company, Email, Status, owner. A Success row does not prove the Lead exists.
- Sender interval is 40 to 50 s, so no sender fix is needed.

NOT SEEN / NEEDS QA
1. Salesforce side: the MCP browser could not load the saved session (the session file cannot be read from the MCP script sandbox) and opening the Leads list redirected to the Salesforce Login page, so I stopped as instructed. Not seen: Lead list columns, Lead Status picklist values (only the default "Open - Not Contacted" from the 2026-10-15 KB walkthrough), Lead owner display, duplicate rules.
2. Which Saleshandy fields QA wants mapped to which Lead properties (nothing is mapped now); and which Salesforce Lead properties are required by the org beyond Last Name, Company, Lead Status (KB walkthrough).
3. Logs row layout (columns, workflow name for this trigger) because the Logs tab is empty.
4. How Mark as Replied looks on this account (no launched sequence or prospects), and its exact label.
5. Save success message for Triggers & Activity on Salesforce.
6. Whether any validation blocks saving Create a Lead without a Company or Last Name mapping (not tried, to avoid saving).
7. Prospects Import and Custom Workflow tabs were not explored (out of scope).
8. Prospect test data CSV for this workflow does not exist yet.
9. Jira ticket for this workflow is not known.

## Test Scenarios

### 1. Trigger and activity setup (baseline)

**Seed:** `tests/seeds/sfreplyreceived.seed.spec.ts`

#### 1.1. Baseline 1: Reply is Received offers Create a Lead in Salesforce

**File:** `tests/salesforce/reply-received/baseline-activity-list.spec.ts`

**Steps:**
  1. Open Settings > Integrations > Salesforce > Triggers & Activity. Turn on the toggle of "Reply is Received in Saleshandy" and open its activity dropdown (do not Save).
    - expect: Dropdown lists 10 activities: Create/Update a Account, Contact, Lead, Opportunity, Attach Note in Salesforce, Record(log) an Email Activity in Salesforce. Seen 2026-10-16.
    - expect: "Create a Lead in Salesforce" is present.
  2. Choose "Create a Lead in Salesforce", then click the chip.
    - expect: The activity shows as a chip with an x.
    - expect: No Extra Configuration modal opens (seen 2026-10-16). Ticket: None

#### 1.2. Baseline 2: Save the trigger with Create a Lead only

**File:** `tests/salesforce/reply-received/baseline-save.spec.ts`

**Steps:**
  1. All other triggers off. Turn on "Reply is Received in Saleshandy", choose only "Create a Lead in Salesforce", click Save.
    - expect: Saved with a success message (text for Salesforce not seen; HubSpot says "Configuration Updated Successfully").
    - expect: After reloading the page the toggle is on and the chip "Create a Lead in Salesforce" is still there. Ticket: None

#### 1.3. Baseline 3: Lead Properties mapping page and Save

**File:** `tests/salesforce/reply-received/baseline-mapping.spec.ts`

**Steps:**
  1. Open Field Mapping > Lead Properties.
    - expect: 44 Saleshandy fields listed on the left (greyed, fixed), a dropdown with the Salesforce Lead properties on the right; Save is disabled until a mapping is chosen (seen, nothing mapped on this account).
  2. Map Last Name, First Name, Email, Phone Number, Job Title, Company, City to Last Name, First Name, Email, Phone, Title, Company, City and click Save. Reload the page.
    - expect: Mapping saved and still shown after reload (proposed mapping, QA confirms the field list). Ticket: None

### 2. Create a Lead in Salesforce

**Seed:** `tests/seeds/sfreplyreceived.seed.spec.ts`

#### 2.1. Create a Lead 1: New prospect replies, Lead created with mapped values

**File:** `tests/salesforce/reply-received/create-lead-new-prospect.spec.ts`

**Steps:**
  1. Mapping saved (Baseline 3), trigger saved (Baseline 2). New prospect with First Name, Last Name, unique Email, Phone, Job Title, Company, City, not in Salesforce, step 1 Sent. Mark as Replied.
    - expect: Logs shows a Success row within 3 min (refresh 15 s, then every 10 s).
    - expect: In Salesforce Leads there is exactly one Lead found by the unique email, with Last Name, First Name, Email, Phone, Title, Company, City equal to the prospect values. Ticket: None

#### 2.2. Create a Lead 2: Fields that are not mapped stay empty

**File:** `tests/salesforce/reply-received/create-lead-unmapped-empty.spec.ts`

**Steps:**
  1. Prospect has Department, Industry, Website filled; they are not mapped to any Lead property. Mark as Replied.
    - expect: Success. The Lead has no value copied from the unmapped fields (Industry, Website empty on the Lead). Ticket: None

#### 2.3. Create a Lead 3: Trigger off creates no Lead

**File:** `tests/salesforce/reply-received/create-lead-trigger-off.spec.ts`

**Steps:**
  1. Turn "Reply is Received in Saleshandy" off and Save. New prospect, Mark as Replied.
    - expect: No new Logs row for this prospect after 3 min.
    - expect: No Lead found in Salesforce by the unique email. Ticket: None

#### 2.4. Create a Lead 4: Lead Status of the created Lead (proposed, unconfirmed)

**File:** `tests/salesforce/reply-received/create-lead-status.spec.ts`

**Steps:**
  1. Status not mapped. New prospect, Mark as Replied.
    - expect: (proposed, unconfirmed) Lead Status = "Open - Not Contacted" (the Salesforce default) unless the mapping sets it. Not documented. Unclear item: Lead Status on the created Lead. Ticket: None
  2. Map a Saleshandy field to Status only if QA confirms a value that exists in the org picklist (picklist not seen). Mark as Replied.
    - expect: (proposed, unconfirmed) Lead Status = the mapped value. Needs the picklist values from QA.

#### 2.5. Create a Lead 5: Lead owner of the created Lead (proposed, unconfirmed)

**File:** `tests/salesforce/reply-received/create-lead-owner.spec.ts`

**Steps:**
  1. New prospect, Mark as Replied. Open the Lead in Salesforce and read Lead Owner.
    - expect: (proposed, unconfirmed) Lead Owner = the connected user (malav@saleshandy.sandbox). Not documented. Unclear item: Lead owner. Ticket: None

#### 2.6. Create a Lead 6: Prospect has no company (proposed, unconfirmed)

**File:** `tests/salesforce/reply-received/create-lead-no-company.spec.ts`

**Steps:**
  1. Company mapped to Company. New prospect with an empty Company. Mark as Replied.
    - expect: (proposed, unconfirmed) The save fails (Logs shows Error) or a default Company is used. Not documented; the Salesforce Lead form requires Company. Unclear item: Company value when the prospect has no company. Record what really happens; do not guess. Ticket: None

#### 2.7. Create a Lead 7: Empty mapping (proposed, unconfirmed)

**File:** `tests/salesforce/reply-received/create-lead-empty-mapping.spec.ts`

**Steps:**
  1. Lead Properties mapping empty (as it is now on this account, before Baseline 3). Trigger on with Create a Lead. New prospect, Mark as Replied.
    - expect: (proposed, unconfirmed) No Lead is created (Salesforce needs Last Name and Company) and Logs shows Error or Success with no record; to be recorded. Unclear item: Lead created when the trigger is on but the mapping is empty. Ticket: None

#### 2.8. Create a Lead 8: Only some required fields mapped (proposed, unconfirmed)

**File:** `tests/salesforce/reply-received/create-lead-partial-mapping.spec.ts`

**Steps:**
  1. Map only Last Name and Email (Company not mapped). New prospect with a Company value. Mark as Replied.
    - expect: (proposed, unconfirmed) No Lead (Company is required in Salesforce) and Logs shows Error. Not documented. Ticket: None

#### 2.9. Create a Lead 9: Same prospect replies twice (proposed, unconfirmed)

**File:** `tests/salesforce/reply-received/create-lead-second-reply.spec.ts`

**Steps:**
  1. After Create a Lead 1 passed, Mark as replied again on the step 2 email of the same prospect (or the same email again if the UI allows it).
    - expect: (proposed, unconfirmed) No duplicate Lead: Salesforce still has exactly one Lead for that email. Depends on the org duplicate rule, which was not read. Unclear item: same prospect replies twice. Record the real result. Ticket: None

#### 2.10. Create a Lead 10: Prospect already exists as a Lead (proposed, unconfirmed)

**File:** `tests/salesforce/reply-received/create-lead-existing-lead.spec.ts`

**Steps:**
  1. First create a Lead with a unique email by running Create a Lead 1 (data created by the test, not an existing record). Then add a second Saleshandy prospect with the same email and Mark as Replied.
    - expect: (proposed, unconfirmed) No duplicate Lead; the existing Lead is updated or left as is. Unclear item: prospect exists already as a Lead. Never edit other people's Leads. Ticket: None

#### 2.11. Create a Lead 11: Prospect already exists as a Contact (proposed, unconfirmed)

**File:** `tests/salesforce/reply-received/create-lead-existing-contact.spec.ts`

**Steps:**
  1. Needs a Contact that the test created (for example a converted Lead; QA decides how to prepare it, no existing record is edited). Prospect with the same email, Mark as Replied.
    - expect: (proposed, unconfirmed) No new Lead is created. Not documented. Unclear item: prospect already exists as a Contact (for example a converted Lead). Ticket: None

#### 2.12. Create a Lead 12: Special characters and long values

**File:** `tests/salesforce/reply-received/create-lead-special-chars.spec.ts`

**Steps:**
  1. Prospect with an accent in the first name, an apostrophe in the last name and a 60 character company name. Mark as Replied.
    - expect: Success and the Lead shows the values exactly (not seen before; if Salesforce rejects a value, record the Logs status and the Lead absence). Ticket: None

#### 2.13. Create a Lead 13: Lead Properties mapping persists and only changes apply to new runs

**File:** `tests/salesforce/reply-received/create-lead-mapping-change.spec.ts`

**Steps:**
  1. After Create a Lead 1, change Job Title mapping from Title to Description and Save. New prospect, Mark as Replied.
    - expect: The new Lead has Job Title in Description and Title empty; the Lead from Create a Lead 1 is unchanged. Ticket: None
