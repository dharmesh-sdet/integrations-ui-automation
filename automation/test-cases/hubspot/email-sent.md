# Email Sent from Saleshandy: Regression scenarios

Environment: Staging (pyxis.lifeisgoodforlearner.com). The workflow ticket
is AL-4010. These scenarios confirm the fixes AL-4026 to AL-4035, AL-4037,
AL-4038, AL-4051, AL-4097 and AL-4100 to AL-4103. They cover all 9
activities in product UI order. Create a Note and Record (log) an email
activity are each tested in their four pairings.

Not covered, still open: AL-4036 (HubSpot contact not created on email
sent), AL-4093 (Hiring Date Picker custom field error), AL-4096 (Update a
Deal + Create a Note errors when the prospect has a Closing Date), AL-4104
(mapped Deal Name and Company Name ignored, so deal and company names are
not checked). Do not treat these as failures.

## Test data setup

- Sequence: a new sequence with 2 steps and no A/B variants, created on
  staging during the walkthrough.
- "Send the email" means: in the sequence, add the prospect from the CSV
  with Add Prospects (one at a time), then Emails tab > the prospect's row >
  three dots > Send now. For step 2, Send now on that prospect's step 2
  email.
- Each row uses its own prospect from `test-data/hubspot/email-sent.csv`
  (Scenario column). Its HubSpot Setup is created by hand in the HubSpot UI
  before the email is sent: the contact with Email, First Name, Last Name;
  deals from `email-sent-deals.csv`; companies from
  `email-sent-companies.csv`. "Prospect details changed" edits use the
  Updated columns (Prospects tab > prospect > edit > Save, then Emails tab >
  Send now).
- Update a deal 3, Create a Note 5 and Record (log) an email activity 7
  reuse the prospect of their earlier row (step 2). If that row failed, they
  are skipped with the reason, not failed.
- "Contact not in HubSpot" means a brand-new CSV row whose email is not in
  HubSpot.
- Update a Contact: if the prospect was added before the contact existed in
  HubSpot, send the email again once the contact exists.
- In Settings > Integrations > HubSpot > Triggers & Activities, turn every
  other trigger off and enable only "Email Sent from Saleshandy". Each row
  selects only the activity (or pairing) under test, then Save, and waits
  for "Configuration Updated Successfully".
- Extra Configuration values come from the real dropdowns during the
  walkthrough and are written here before the spec is coded. Closing Date
  rows use 0, 1 and 51 Days; Task rows use Due in 3.
- Field mapping configured as in 00-overview.md. HubSpot setting "Create and
  associate companies with contacts" off (checked, not changed, before the
  company rows).
- Logs: Settings > Integrations > HubSpot > Logs, workflow "Email sent from
  Saleshandy". Refresh 15 s after Send now, then every 10 s until the new
  entries show a status. Entries are not opened.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger off before the test | Enable "Email Sent from Saleshandy", select an activity, click Save | "Configuration Updated Successfully" | None |

## Create a Contact in HubSpot

Extra Configuration: Lead Status, Lead Lifecycle (values from the UI), or
skipped.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact not in HubSpot, Extra Configuration skipped | Send the email | Success. Contact created with the mapped fields, including company name, industry and country | AL-4026 |
| 2 | Contact not in HubSpot, Lead Status and Lead Lifecycle set | Send the email | Success. Contact created with the configured Lead Status and Lifecycle Stage | AL-4027 |
| 3 | Contact already in HubSpot, prospect details changed in Saleshandy | Send the email | Success. Contact shows the new mapped values | None |
| 4 | Contact already at a later Lifecycle Stage than the configured one | Send the email | Lifecycle Stage stays at the later stage (HubSpot blocks backward moves, not a defect) | None |
| 5 | Lead Status and Lead Lifecycle saved before | Reopen Extra Configuration and try to clear both | Fields cannot be made empty again (expected) | None |

## Update a Contact in HubSpot

Extra Configuration: Update Lead Status, Update Lead Lifecycle (values from
the UI), or skipped.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot, prospect details changed in Saleshandy, Extra Configuration skipped | Send the email | Success. Contact shows the new mapped values | None |
| 2 | Contact in HubSpot, Update Lead Status and Update Lead Lifecycle set | Send the email | Success. Contact shows the configured Lead Status and Lifecycle Stage | None |
| 3 | Contact not in HubSpot | Send the email | Success, no contact created | None |
| 4 | Contact in HubSpot, prospect details not changed in Saleshandy | Send the email | Contact not updated (properties unchanged) | None |

## Create a deal in HubSpot

Extra Configuration: Pipeline, Pipeline Stage, Deal Type, Deal Priority
(values from the UI), Closing Date as given in each row.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot, no deal, Closing Date 0 Days | Send the email | Success. Deal created and associated to the contact with the configured Pipeline, Stage, Type and Priority, no close date | None |
| 2 | Contact not in HubSpot | Send the email | Contact and deal created and associated | None |
| 3 | Contact already has 1 deal | Send the email | New deal created, contact now has 2 deals | None |
| 4 | Prospect has Deal Value and Closing Date, Extra Configuration Closing Date 1 Day | Send the email | Deal Amount = Deal Value, close date = today + 1 (Extra Configuration wins over the prospect's date) | AL-4051 |
| 5 | Closing Date 51 Days | Send the email | Close date = today + 51, not 50 | AL-4051 |

## Update a deal in HubSpot

Extra Configuration: same fields as Create a deal (values from the UI),
Closing Date as given in each row.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact has 1 deal | Send the email | Success. Deal shows the configured Pipeline, Stage, Type and Priority | AL-4028 |
| 2 | Contact has 3 deals | Send the email | The latest created deal is updated, the 2 older ones are unchanged | AL-4103 |
| 3 | Deal updated in row 1, Extra Configuration values changed | Send the email again | Deal shows the new values | None |
| 4 | Contact has 1 deal, Closing Date 51 Days | Send the email | Close date = today + 51 | AL-4051 |
| 5 | Contact in HubSpot with 0 deals | Send the email | Nothing created or updated | None |
| 6 | Contact not in HubSpot | Send the email | Nothing created or updated | None |

## Create a company in HubSpot

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot, prospect has company details | Send the email | Success. One company created and associated to the contact | AL-4029 |
| 2 | A company with the same domain already exists | Send the email | New company created anyway and associated | None |
| 3 | Contact not in HubSpot | Send the email | Contact and company created and associated | None |
| 4 | Prospect has empty company details, only a company domain | Send the email | Company created from the company domain | None |

## Update a company in HubSpot

Extra Configuration: None. Before each row, the prospect's company details
are changed in Saleshandy.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact has 1 associated company | Send the email | Success. Company shows the new values (not the name, AL-4104) | AL-4030 |
| 2 | Contact has 2 associated companies | Send the email | The latest associated company is updated, the other is unchanged | AL-4100 |
| 3 | Contact in HubSpot, no associated company | Send the email | Success, nothing created or updated | None |
| 4 | Contact not in HubSpot | Send the email | Success, nothing created or updated | None |

## Create a Task in HubSpot

Extra Configuration: Task title, Task Type, Task Priority (values from the
UI), Due in 3 Days.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact in HubSpot | Send the email | Success. Task on the contact with the configured title, type and priority, due date = today + 3 | AL-4031 |
| 2 | Contact not in HubSpot | Send the email | Contact created, task created on it | None |
| 3 | Due in set to 0 | Try to Save the modal | Cannot be saved | AL-4101 |
| 4 | Task title empty | Try to Save the modal | Cannot be saved | AL-4101 |

## Create a Note in HubSpot

Extra Configuration: None. The paired activity uses its own values from
above.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Paired with Create a Contact (Lead Status and Lifecycle set), contact not in HubSpot | Send the email | Success. Contact created, note on it shows Step 1, Variant A and the Prospect Outcome | AL-4032, AL-4097 |
| 2 | Paired with Update a Contact, contact in HubSpot | Send the email | Success. Note on the contact | None |
| 3 | Paired with Create a deal, prospect has Deal Value and Closing Date | Send the email | Success. Note on both the contact and the deal | AL-4033 |
| 4 | Paired with Update a deal, contact has 1 deal, prospect has no Closing Date (AL-4096) | Send the email | Success. Note on both the contact and the deal | None |
| 5 | Pairing from row 2, step 2 sent | Send now on step 2 | New note shows Step 2, Variant A | AL-4097 |
| 6 | Create a Note selected alone | Send the email | Fails, no note created (as the activity's tooltip says) | None |

## Record (log) an email activity in HubSpot

Extra Configuration: None. The paired activity uses its own values from
above.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Activity selected | Hover the activity | Tooltip: "Logging an email alone would result in failure. Please create/update contact or deal to associate an email." | None |
| 2 | Only this activity selected | Click Save | Saved | None |
| 3 | Paired with Create a Contact (Lead Status and Lifecycle set), contact not in HubSpot | Send the email | Success. Email logged on the contact with From, To, "logged email by", date and time, and the step body | AL-4034 |
| 4 | Paired with Update a Contact, prospect has Deal Value and Closing Date | Send the email | Success. Email logged on the contact | AL-4035 |
| 5 | Paired with Create a deal, prospect has Deal Value and Closing Date | Send the email | Success. Email logged on both the deal and the contact | AL-4037, AL-4102 |
| 6 | Paired with Update a deal, contact has 3 deals | Send the email | Success. Latest created deal updated, email logged | AL-4038, AL-4103 |
| 7 | Pairing from row 4, step 2 sent | Send now on step 2 | Step 2 email appears as a separate activity | None |
