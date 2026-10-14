# Link Clicked in Saleshandy: Regression scenarios

Environment: Staging (pyxis.lifeisgoodforlearner.com). The workflow ticket
is AL-4014 (Jira name "Link is Clicked in Saleshandy"). This workflow has no
fixes of its own. These scenarios check that all 9 activities behave the
same as on Email Sent from Saleshandy, and they confirm the AL-4103 fix
(Update a deal updates the latest created deal) on this trigger. Only Create
a Contact was tested on this trigger before; the rows for activities 2 to 9
follow Email Sent. Create a Note and Record (log) an email activity are each
tested in their four pairings.

Not covered, still open: AL-4036 (HubSpot contact not created on email
sent), AL-4093 (Hiring Date Picker custom field error), AL-4096 (Update a
Deal + Create a Note errors when the prospect has a Closing Date), AL-4104
(mapped Deal Name and Company Name ignored, so deal and company names are
not checked). Do not treat these as failures.

## Test data setup

- Account: Saleshandy `dharmesh+linkclick@saleshandy.com` with its own
  connected HubSpot portal; the spec uses `test.use({ account: 'linkclick' })`
  (`src/config/accounts.ts`).
- Sequence: one active sequence on staging with 2 or more active steps and
  no A/B variants. Sequence Settings > Safety Settings > Track Link Clicks
  on. Each step's email body has 2 links. A custom tracking domain is set
  up. The sequence is "HubSpot Link Clicked QA", created on the linkclick
  account during the walkthrough (QA, 2026-10-09).
- "Click the link" means: in the sequence, add the prospect from the CSV
  with Add Prospects (one at a time). Step 1 is sent by Saleshandy on its own
  (wait for "Sent" in the Emails tab, no Send now); Send now only for
  bulk-added prospects and for step 2 (QA, 2026-10-09). Then go to mailinator.com, type the prospect's
  email in the input field and click Go. In the inbox, open the sequence
  email and click its first link right away (no wait before the click). For
  step 2: Send now on that prospect's step 2 email, then open it in
  Mailinator and click its first link.
- After the click: the click takes up to 1 to 1.5 minutes to register in
  Saleshandy (developer's maximum). Refresh until the clicked count
  increases in Sequences > Emails (and the link clicked icon turns purple in
  Sequence > Prospects). If it has not increased yet, keep waiting.
- HubSpot preconditions are created by the test one at a time in the
  HubSpot UI from the CSV: an existing contact, a contact with 1 deal, a
  contact with 3 deals, a contact with 1 associated company, a contact with
  2 associated companies, and a company with the same domain as the
  prospect.
- "Contact not in HubSpot" means a brand-new CSV row whose email is not in
  HubSpot.
- For "contact already in HubSpot" rows, the prospect's details are changed
  in Saleshandy before the click.
- In Settings > Integrations > HubSpot > Triggers & Activities, turn every
  other trigger off (a link click also counts as an open) and enable only
  "Link Clicked in Saleshandy". Each row selects only the activity (or
  pairing) under test, then Save, and waits for "Configuration Updated
  Successfully".
- Extra Configuration values come from the real dropdowns during the
  walkthrough and are written here before the spec is coded. Closing Date
  rows use 0, 1 and 51 Days; Task rows use Due in 3.
- Field mapping configured as in 00-overview.md. HubSpot setting "Create and
  associate companies with contacts" off (checked, not changed, before the
  company rows).
- Logs: Settings > Integrations > HubSpot > Logs, workflow "Link Clicked in
  Saleshandy". The check starts only once the click shows in Saleshandy:
  refresh after 15 s, then every 10 s until the new entries show a status.
  Entries are not opened.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger off before the test | Enable "Link Clicked in Saleshandy", select an activity, click Save | "Configuration Updated Successfully" | None |
| 2 | Prospect received the step 1 email | Click the link | Within about 1.5 min: Sequences > Emails clicked count is 1 and Sequence > Prospects shows the link clicked icon in purple. Then a new log entry for Link Clicked in Saleshandy | None |

## Create a Contact in HubSpot

Extra Configuration: Lead Status, Lead Lifecycle (values from the UI), or
skipped.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact not in HubSpot, Extra Configuration skipped | Click the link | Success. Contact created with the mapped fields. Only on an account where Create a Contact was never configured; not run on linkclick (values saved by row 5 first, 2026-10-09) | None |
| 2 | Contact not in HubSpot, Lead Status and Lead Lifecycle set | Click the link | Success. Contact created with the configured Lead Status and Lifecycle Stage | None |
| 3 | Contact already in HubSpot, prospect details changed in Saleshandy | Click the link | Success. Contact shows the new mapped values | None |
| 4 | Contact already at a later Lifecycle Stage than the configured one | Click the link | Lifecycle Stage stays at the later stage (HubSpot blocks backward moves, not a defect) | None |
| 5 | Lead Status and Lead Lifecycle saved before | Reopen Extra Configuration and try to clear both | Fields cannot be made empty again (expected) | None |
| 6 | Row 3 done (first link clicked), prospect details changed again | Click the second link | Clicked count goes from 1 to 2, then a new log entry with Success. Contact shows the new values | None |

## Update a Contact in HubSpot

Extra Configuration: Update Lead Status, Update Lead Lifecycle (values from
the UI), or skipped.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot, prospect details changed in Saleshandy, Extra Configuration skipped | Click the link | Success. Contact shows the new mapped values | None |
| 2 | Contact in HubSpot, Update Lead Status and Update Lead Lifecycle set | Click the link | Success. Contact shows the configured Lead Status and Lifecycle Stage | None |
| 3 | Contact not in HubSpot | Click the link | Success, no contact created | None |
| 4 | Contact in HubSpot, prospect details not changed in Saleshandy | Click the link | Contact not updated (properties unchanged) | None |

## Create a deal in HubSpot

Extra Configuration: Pipeline, Pipeline Stage, Deal Type, Deal Priority
(values from the UI), Closing Date as given in each row.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot, no deal, Closing Date 0 Days | Click the link | Success. Deal created and associated to the contact with the configured Pipeline, Stage, Type and Priority, no close date | None |
| 2 | Contact not in HubSpot | Click the link | Contact and deal created and associated | None |
| 3 | Contact already has 1 deal | Click the link | New deal created, contact now has 2 deals | None |
| 4 | Prospect has Deal Value, Extra Configuration Closing Date 1 Day | Click the link | Deal Amount = Deal Value, close date 1 day from today | None |
| 5 | Closing Date 51 Days | Click the link | Close date 51 days from today, not 50 | None |

## Update a deal in HubSpot

Extra Configuration: same fields as Create a deal (values from the UI),
Closing Date as given in each row.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact has 1 deal | Click the link | Success. Deal shows the configured Pipeline, Stage, Type and Priority | None |
| 2 | Contact has 3 deals | Click the link | The latest created deal is updated, the 2 older ones are unchanged | AL-4103 |
| 3 | Deal updated in row 1, Extra Configuration values changed | Click the second link | Deal shows the new values | None |
| 4 | Contact has 1 deal, Closing Date 51 Days | Click the link | Close date 51 days from today | None |
| 5 | Contact in HubSpot with 0 deals | Click the link | Nothing created or updated | None |
| 6 | Contact not in HubSpot | Click the link | Nothing created or updated | None |

## Create a company in HubSpot

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot, prospect has company details | Click the link | Success. One company created and associated to the contact | None |
| 2 | A company with the same domain already exists | Click the link | New company created anyway and associated | None |
| 3 | Contact not in HubSpot | Click the link | Contact and company created and associated | None |
| 4 | Prospect has empty company details, only a company domain | Click the link | Company created from the company domain | None |

## Update a company in HubSpot

Extra Configuration: None. Before each row, the prospect's company details
are changed in Saleshandy.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact has 1 associated company | Click the link | Success. Company shows the new values (not the name, AL-4104) - Pass after Field Mapping fix, AL-4127 | AL-4127 |
| 2 | Contact has 2 associated companies | Click the link | The latest associated company is updated, the other is unchanged - Pass after Field Mapping fix, AL-4127 | AL-4127 |
| 3 | Contact in HubSpot, no associated company | Click the link | Success, nothing created or updated | None |
| 4 | Contact not in HubSpot | Click the link | Success, nothing created or updated | None |

## Create a Task in HubSpot

Extra Configuration: Task title, Task Type, Task Priority (values from the
UI), Due in 3 Days.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot | Click the link | Success. Task on the contact with the configured title, type and priority, due date 3 days from today. Log action label "Create task for existing contact" | None |
| 2 | Contact not in HubSpot | Click the link | Contact created, task created on it | None |
| 3 | Due in set to 0 | Try to Save the modal | Cannot be saved | None |
| 4 | Task title empty | Try to Save the modal | Cannot be saved | None |

## Create a Note in HubSpot

Extra Configuration: None. The paired activity uses its own values from
above.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Paired with Create a Contact (Lead Status and Lifecycle set), contact not in HubSpot | Click the link | Success. Contact created, note on it shows Step 1, Variant A and the Prospect Outcome | None |
| 2 | Paired with Update a Contact, contact in HubSpot | Click the link | Success. Note on the contact | None |
| 3 | Paired with Create a deal, prospect has Deal Value and Closing Date | Click the link | Success. Note on both the contact and the deal - Pass after fix, AL-4121 | None |
| 4 | Paired with Update a deal, contact has 1 deal, prospect has no Closing Date (AL-4096) | Click the link | Success. The deal is updated and the note is on both the contact and the deal (QA, 2026-10-14, confirmed with the developer; it was deal only on 2026-10-13) | None |
| 5 | Pairing from row 2, step 2 sent | Send now on step 2, click its link | New note shows Step 2, Variant A | None |
| 6 | Create a Note selected alone | Click the link | Success in Logs (the custom workflow runs); no note on any contact, company or deal | None |

## Record (log) an email activity in HubSpot

Extra Configuration: None. The paired activity uses its own values from
above.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Activity selected | Hover the activity | Tooltip: "Logging an email alone would result in failure. Please create/update contact or deal to associate an email." | None |
| 2 | Only this activity selected | Click Save | Saved | None |
| 3 | Paired with Create a Contact (Lead Status and Lifecycle set), contact not in HubSpot | Click the link | Success. Email logged on the contact with From, To, "logged email by", date and time, and the step body | None |
| 4 | Paired with Update a Contact, prospect has Deal Value and Closing Date | Click the link | Success. Email logged on the contact | None |
| 5 | Paired with Create a deal, prospect has Deal Value and Closing Date | Click the link | Success. Email logged on both the deal and the contact - Pass after fix, AL-4122 | None |
| 6 | Paired with Update a deal, contact has 3 deals | Click the link | Success. Latest created deal updated; the email is logged on that deal only (the contact gets no logged email, QA 2026-10-13), and its header names the prospect, not "Unknown Contact" - Pass after fix, AL-4123 | AL-4103 |
| 7 | Pairing from row 4, step 2 sent | Send now on step 2, click its link | Step 2 email appears as a separate activity | None |
