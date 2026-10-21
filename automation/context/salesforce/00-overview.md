# Saleshandy and Salesforce integration: overview

Tracking tickets and plan for the Salesforce Triggers and Activities work.
Workflow context files sit next to this one (`reply-received.md` so far).
Product knowledge: `knowledge-base/product/salesforce-integration.md`.
Created 2026-10-16.

## Jira

- Parent: **AL-4131** "[SalesForce] Triggers and Activities" (Task, Epic AL-3982
  "Integrations Module Onboarding and Testing", Environment Production).
  HubSpot's parent is AL-3984.
- Sub-tasks created 2026-10-16 by QA's request. Title is the workflow name from
  the sheet, as is. Only Title, QA and Assignee are set (both Dharmesh Patel,
  `712020:c7dedb58-9cb3-4450-a98f-5b5b56f6556b`). No Priority, no Test cases
  Status. Environment is not offered on the Sub-task create screen
  (createJiraIssue rejected it), so it is empty.
- "Import Prospects from Salesforce" (sheet row 14) has no sub-task: QA said not
  to create it.

| Sub-task | Workflow (trigger) | Planned Prod release (sheet) |
|---|---|---|
| AL-4132 | Email Sent from Saleshandy | 16 Oct 2026 |
| AL-4133 | Reply is Received in Saleshandy | 16 Oct 2026 |
| AL-4134 | Prospect Outcome is Updated in Saleshandy | 16 Oct 2026 |
| AL-4135 | Sequence Email is Opened in Saleshandy | 16 Oct 2026 |
| AL-4136 | Link is Clicked in Saleshandy | 19 Oct 2026 |
| AL-4137 | Prospect is Unsubscribed in Saleshandy | 19 Oct 2026 |
| AL-4138 | Email is Bounced in Saleshandy | 19 Oct 2026 |
| AL-4139 | Call Logged in Saleshandy | 19 Oct 2026 |
| AL-4140 | Call Outcome Updated in Saleshandy | 20 Oct 2026 |
| AL-4141 | Contact is Created in Salesforce | 20 Oct 2026 |
| AL-4142 | Opportunity is Created in Salesforce | 20 Oct 2026 |
| AL-4143 | Account is Created in Salesforce | 20 Oct 2026 |
| AL-4144 | Lead is Created in Salesforce | 21 Oct 2026 |
| none | Import Prospects from Salesforce | 21 Oct 2026 |

Buffer day Thu 22 Oct 2026 for fixes and re-tests; a slip goes in the sheet's
"Updated Prod Release date".

## Source sheet

Google Sheet "Integration wfs"
(`1Sa69d5YgGpIbXFc4T8Uf2aN255f92yJ2T05STJRiq7E`, Sheet1). Columns: CRM Name, WF
Name, Prod Release date, Updated Prod Release date, Current status, Notes.
Read 2026-10-16. It also lists the later CRMs; no Jira tickets exist for them
yet (QA asked for Salesforce only):
- HubSpot: 6 rows. Opened 14 Oct, Bounced, Link Clicked, Reply Received and
  Company Created 15 Oct (all Released); Prospect is Unsubscribed 16 Oct (Todo).
- Zoho: 8 rows, 23 to 26 Oct (buffer 27 Oct).
- Pipedrive: 8 rows, 28 to 29 Oct (buffer 30 Oct).
Re-read the sheet for current dates and status; this table can go stale.

## Triggers & Activity page (staging, 2026-10-16)

Observed on the sfreplyreceived account. Tabs: Field Mapping, Triggers &
Activity, Prospects Import, Custom Workflow, Logs.

Saleshandy-side triggers: Email Sent from Saleshandy, Reply is Received in
Saleshandy, Prospect Outcome is updated in Saleshandy, Sequence Email is
Opened in Saleshandy, Link is Clicked in Saleshandy, Prospect is
Unsubscribed in Saleshandy, Email is Bounced in Saleshandy, Call Logged in
Saleshandy, Call Outcome Updated in Saleshandy.

Salesforce-side triggers: Lead is created in Salesforce (V1), Contact is
created in Salesforce, Opportunity is created in Salesforce, Account is
created in Salesforce.

Activities (for Saleshandy-side triggers): Create a Account, Update a
Account, Create a Contact, Update a Contact, Create a Lead, Update a Lead,
Create a Opportunity, Update a Opportunity, Attach Note, Record(log) an
Email Activity. **Activities are separate Create and Update**, not combined
"Create or update" as the public docs say.

Field Mapping tabs: Lead Properties, Contact Properties, Opportunity
Properties, Account Properties.

## Exploration findings (QA, 2026-10-17)

### Attach Note
- Tooltip says it must pair with Create/Update Contact or Deal.
- Salesforce has no Deal object, so only Contact works (pair with Create a
  Contact or Update a Contact).
- Tested: Contact was created and Note was attached. Confirmed working.

### Record Email Activity
- Standalone activity, NOT paired with another activity (unlike HubSpot's
  "Log an Activity" which is paired with Create a Contact).
- Has multi-select checkboxes: Lead, Opportunity, Contact. User picks which
  object(s) the email activity is logged against.
- Tested with Reply Received > Create a Contact + Record Email Activity
  (Contact checkbox selected): Contact was created. An email log appeared on
  the Contact in Salesforce, but it is **unconfirmed** whether that log came
  from Record Email Activity or from something else (Salesforce's own email
  capture, a Task from contact creation, etc.). QA will verify with the
  developer on Monday 2026-10-19.

### Account Properties field mapping
- Account Properties tab maps Company fields from Saleshandy prospect to
  Salesforce Account fields (Company → Account Name, Company Industry →
  Industry, etc.).
- All 4 field mapping tabs (Lead, Contact, Opportunity, Account) configured
  on the sfreplyreceived account.

### Field mapping values (read from sfreplyreceived, applied to sfemailsent, 2026-10-19)

Everything else on each tab is left as "Select" (unmapped). 44 fields per
tab; only the pairs below are set.

**Lead Properties:** First Name, Last Name, Email, Company → same name.
Phone Number → Phone. Job Title → Title. Industry → Industry. Website →
Website. City → City. State → State/Province. Country → Country. Company
Revenue → Annual Revenue. Company HQ Location → Zip/Postal Code.

**Contact Properties:** First Name, Last Name, Email → same name. Phone
Number → Business Phone. Department → Department. City → Other City. State
→ Other State/Province. Country → Other Country. Company HQ Location →
Other Zip/Postal Code. Profile Picture → Photo URL. (Job Title, Industry,
Website, Company not mapped here, unlike Lead Properties.)

**Opportunity Properties:** Prospect Overview → Description. Deal Value →
Amount. Closing Date → Close Date. (Same two pairs as HubSpot's Deal
Properties, plus Description.)

**Account Properties:** Website → Website. City → Billing City. State →
Billing State/Province. Country → Billing Country. Company → Account Name.
Company Website → Website. Company Industry → Industry. Company Size →
Employees. Company Revenue → Annual Revenue. Company Founded Year → Year
Started. Company Phone → Account Phone. Company HQ Location → Billing
Zip/Postal Code.

## Where things stand

- Reply is Received > Create a Lead (AL-4133): in progress on staging, see
  `reply-received-progress.md`.
- Email Sent (AL-4132): context file written, staging exploration done,
  scenarios in progress. See `email-sent.md`.
- Prospect Outcome Updated (AL-4134): context file `prospect-outcome-updated.md` drafted from HubSpot + KB, QA created account `sfoutcomeupdated` 2026-10-20; read-only staging exploration of the Opportunity modals done there; Field Mapping, Account/Contact/Lead modals re-check and scenarios still to do.
- All other Salesforce workflows: not started.
