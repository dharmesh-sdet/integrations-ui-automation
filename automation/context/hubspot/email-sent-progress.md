# Email Sent from Saleshandy: progress (resume here)

Last session: 2026-10-09 (QA answers saved below; walkthrough work last done
2026-10-08). Skill: `ui-test-from-workflow`. Stage 3 (script), step 3b (MCP
walkthrough) in progress. Spec not written yet.

## Done

- Stage 1: context saved, `context/hubspot/email-sent.md`.
- Stage 2: scenarios approved and saved, `test-cases/hubspot/email-sent.md`
  (Regression, approach A: one prospect per sending row; Update a deal 3,
  Create a Note 5, Record 7 reuse the earlier row's prospect on step 2).
- Test data: `test-data/hubspot/email-sent.csv` (37 prospects, Scenario and
  HubSpot Setup columns, Updated columns for edits; Icebreaker and Company
  Domain dropped), `email-sent-deals.csv` (10), `email-sent-companies.csv` (4).
  Emails stay @mailinator.com; company domain comes from the email domain
  (QA). Closing Date skipped for now (QA), cells empty.
- Account: Saleshandy `dharmesh+emailsent@saleshandy.com`; spec uses
  `test.use({ account: 'emailsent' })` (`src/config/accounts.ts`).
- MCP: `.mcp.json` uses a saved profile (`auth/mcp-chromium-profile`), so
  logins persist. Not yet recorded in `context/project.md` (that edit was
  blocked; QA to decide).
- Staging setup done in the walkthrough:
  - Sequence "HubSpot Email Sent QA", id 196186, 2 email steps, Variant A only,
    step 2 same-thread follow-up on Day 3. Active. Email accounts attached:
    Ritaellis1988+2@gmail.com (50/day), Ritaellis1988+1@gmail.com (15/day).
  - Deleted QA-requested CRM prospects Anil Salvi, Piyush Patel, Malav Joshi.
  - Triggers: only "Email Sent from Saleshandy" on, activity Create a Contact
    in Hubspot, Extra Configuration empty.
- Create a Contact 1 walked end to end: Pass (Rohan Mehtani,
  rohan.mehtani@mailinator.com, used; log 6ac78eb8221be342885022c6 Success;
  HubSpot contact 566272806598 has Company name, Industry, Country/Region).
  Not yet added to `email-sent.used.txt`.

## Seen on staging (for the spec)

- Activity names: Create a Contact / Update a Contact / Create a Deal /
  Update a Deal / Create a Company / Update a Company / Create a Task /
  Create a Note in Hubspot, Record(log) an Email Activity in Hubspot.
  Options: `getByRole('button', { name })` after opening the row's "Select".
- Extra Configuration options: Lead Status (New, Open, In Progress, Open Deal,
  Unqualified, Attempted to Contact, Connected, Bad Timing); Lifecycle
  (Subscriber, Lead, Marketing Qualified Lead, Sales Qualified Lead,
  Opportunity, Customer, Evangelist, Other); Pipeline (Sales Pipeline);
  Stage (Prospecting, Initial Contact, Follow-Up, Proposal Sent, Negotiation,
  Closed Won, Closed Lost); Deal Type (New Business, Existing Business);
  Deal Priority (Low, Medium, High); Task Type (Call, Email, Sales Navigator -
  Connection Request, Sales Navigator - InMail, To Do); Task Priority (None,
  Low, Medium, High). Task Save disabled with empty title and Due In 0.
  Labels: "Select Pipeline (when to create|update)", "Deal Type (while
  creating|updating)", "Closing Date (while creating|updating)", "Update Lead
  Status", "Update Lead Lifecycle". Dropdowns: `.bs-select-box` after the label.
- Triggers page: changes save without the page Save; Extra Configuration
  Cancel keeps the selection (possible bug, not filed). Escape closes the modal.
- Prospect in: sequence > Prospects > "Import via CSV" > "Choose a file"
  (`#p-t__choose-file`) > Next (Map Fields auto-maps by name) > Next > Import.
  Review step has "Start Email verification after Import" (on by default).
  MCP uploads only from inside `automation/` (used `.playwright-mcp/imports/`).
- Activate sequence: `main .switchToggle label` > "Yes". Emails tab appears
  only when active. Send now: Emails tab > row `#dropdown-basic` (⋮) >
  "Send now" > "Yes" > toast "Email sent successfully." Default schedule put
  the email at "Tomorrow, 09:00 AM" before Send now.
- Logs: name "Email Sent from Saleshandy" (capital S); row accessible name
  "Open execution detail for Email Sent from Saleshandy"; existing
  `logEntries()` works. Success about 20 s after Send now.
- HubSpot: portal 247419080 (same as the old accounts). Search box
  `[data-test-id="compact-toolbar-search-input"]` ("Search ( / )"). All
  properties: properties card Actions > "View all properties" > searchbox
  "Search property"; rows are buttons "<Label> View property history ...
  <value>". Contact label is "Company name". New contact Lifecycle Stage
  defaulted to "Lead".
- Sequence step editor: subject `.editor-editable-content.single-line-content`,
  body `.editor-editable-content:not(.single-line-content)`; typing
  character by character drops letters, use fill.

## QA answers (2026-10-09)

1. HubSpot portal: shared portal 247419080 (`hubspot: 'shared'`), per
   `context/project.md`.
2. Import: turn "Start Email verification after Import" off.
3. Jira bug for "Extra Configuration Cancel keeps the selection": deferred,
   no Jira work in this session.
4. Keep the current scenario headings and CSV Scenario names (stable IDs);
   locators use the product spelling.
5. Closing Date: 0 Days, same as Link Clicked (expect no close date on the deal).
6. Isolation (QA): work runs in a background agent. Edit only Email Sent files;
   in shared page objects / fixtures only add new methods, never change
   existing ones; run the spec only when no other Playwright run is going;
   `npx tsc --noEmit` before and after.

## Background agent stopped (2026-10-09)

The "Email Sent automation agent 1" started at 15:01 IST to do the Next steps
below was stopped by QA at about 15:03. It only read the project files and
made one MCP browser call: no walkthrough, no records created on staging, no
files or code changed. Nothing to undo. The Next steps below are still all
to do (the QA answers above are already in, so step 1's "Get answers above"
is done; marking Rohan used and recording row 1 Pass are not).

## Next

1. Get answers above. Mark Rohan used; record row 1 Pass in the scenarios.
2. Walk only the new screens: HubSpot create contact / deal / company and
   associations, CRM prospect edit, deal / company / task / note / logged
   email views, Send now on step 2, Record activity hover tooltip.
3. Pick the Extra Configuration values and write them into the scenarios.
4. Page objects, fixtures, spec `tests/hubspot/email-sent.spec.ts`, `npx tsc
   --noEmit`. Offer `kb-update` for the facts above.
