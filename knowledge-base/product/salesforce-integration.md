# Salesforce integration: how it works and how a user runs it

Context for writing Salesforce test cases. Built from online documentation
only, collected 2026-10-15. Nothing here has been checked on staging yet, so
treat every fact as unconfirmed until a test or walkthrough confirms it.

Source tags (see [../README.md](../README.md)):
`[public docs]` = docs.saleshandy.com or the Saleshandy blog.
`[Salesforce docs]` = help.salesforce.com, developer.salesforce.com or
Trailhead. HubSpot comparisons come from
[hubspot-integration.md](hubspot-integration.md) and
`../../automation/context/hubspot/00-overview.md`.

## 1. The two products in one picture

- Saleshandy runs email sequences (and Dialer calls) against prospects.
- Salesforce is the CRM that holds the sales records.
- The integration is bidirectional [public docs]:
  - Saleshandy to Salesforce: what a prospect does in a sequence (sent,
    replied, opened, clicked, bounced, unsubscribed, outcome set, called)
    creates or updates Salesforce records.
  - Salesforce to Saleshandy: a record created in Salesforce adds the person
    to Saleshandy or changes their sequence status.
- The user picks the pairs: one trigger switched on, one activity chosen,
  extra settings filled, Save. Nothing syncs until a pair is saved.

## 2. How Salesforce works (what a tester must know)

All of this is [Salesforce docs] unless said otherwise.

### Records the integration touches

| Object | What it is | Required to save |
|---|---|---|
| Lead | An unqualified person. Standard field Company is required because it becomes the Account name on conversion. Last Name is also required (inferred, check in org). | Company (not required if Person Accounts are on) |
| Contact | A person tied to an Account | Last Name (standard); Account link depends on org |
| Account | A company | Account Name |
| Opportunity | A deal, belongs to an Account | Name, Stage, Close Date (Account Name is also listed as required) |
| Task (Subtype Call) | A completed activity shown on the record's Activity timeline | Created by the integration for Dialer calls |
| Note | Notes related list on a record. Newer notes are ContentNote linked by ContentDocumentLink; legacy Notes & Attachments is a separate list | Needs a parent record |

- Lead Status is a picklist an admin defines (examples: Open, Contacted,
  Qualified). Stage on an Opportunity is also an admin-defined picklist.
  Test values must exist in the org, so read the picklists before choosing.
- Opportunity Probability follows the Stage automatically. A user can
  override it. Stage to probability mapping is set by the admin and differs
  per org (examples: Closed Won 100, Closed Lost 0).
- Close Date cannot be left blank. A future date is accepted and edited
  later.
- Field-level required settings apply to API and integration saves.
  Page-layout requirements apply only to that page. A custom required field
  in the org can therefore break an integration save that the UI would also
  block.

### Lead conversion (changes what the integration can find)

- Converting a Lead creates or links an Account, a Contact and optionally an
  Opportunity. A converted Lead cannot be edited as a Lead again.
- Salesforce never overwrites existing Account or Contact values with Lead
  data. Only empty target fields are filled.
- Standard Lead fields map to Account, Contact and Opportunity fields
  automatically. Custom fields need an admin mapping.
- A unique field mapped to a value that already exists on the target raises
  "Duplicate value found".
- Test effect: after a conversion the person exists as a Contact, so a
  Saleshandy trigger set to Create or Update a Lead may create a new Lead
  for someone who is already a Contact. What the integration does here is not
  documented. Ask QA before a scenario depends on it.

### Duplicate handling (decides "create" versus "update")

- Standard Lead and Contact duplicate rules default to Allow with an alert.
  An admin can change them to Block.
- In orgs created Summer '17 or later the Lead rule also matches Contacts
  that duplicate Leads.
- Standard matching rules are fixed. Custom rules are possible.
- Salesforce's alert only shows in the UI. Records added through imports or
  the API bypass the alert. A Block rule can still reject an API create.
- Use clearly different names per test prospect so fuzzy name matching does
  not link the wrong record [dev kit: how-to-test.md].

### Activity timeline and calls

- Log a Call creates a completed Task. Task Subtype is Call and read-only.
- The record's Activity timeline shows tasks, calls and logged emails.
- The Salesforce user behind the connection needs permission to create and
  edit Tasks, or call logging fails.

### Test environments

- A free Developer Edition org works for integration testing. A Developer
  Edition org cannot create sandboxes and cannot be refreshed.
- Paid editions offer sandboxes. Partial Copy is the one Salesforce
  recommends for integration testing.
- Test org: `https://saleshandy-dev-ed.develop.my.salesforce.com/` [QA,
  2026-10-15]. Opens in Lightning at
  `https://saleshandy-dev-ed.develop.lightning.force.com/`.
- Seen on the org, read-only walkthrough [staging, 2026-10-15]:
  - Edition badge "Developer Edition", release Winter '27, Lightning
    Experience, app "Marketing CRM Cl..." with tabs Home, Chatter,
    Campaigns, Leads, Contacts, Opportunities, Reports, Dashboards. No
    Accounts tab in this app.
  - Login is username first, then password, then an SMS verification code
    to the user's phone. The saved session or a browser already logged in
    is needed; a script cannot get past the code. User shown:
    `malav@saleshandy.sandbox` (env keys `SALESFORCE_SANDBOX_USERNAME` and
    `SALESFORCE_SANDBOX_PASSWORD` in `automation/.env`).
  - The org is shared. It already holds many records from earlier
    integration runs: 28 Leads (all "Open - Not Contacted", owner
    ChintanS), 50+ Contacts and 50+ Opportunities. Names such as
    `rudra+sf-*@saleshandy.com` and `rudra+zoho-*` are other people's test
    data. Use a unique prefix per run and never edit existing records.
  - Opportunities are named with the prospect's email (e.g.
    `rudra+sf-k6@saleshandy.com`), Account Name is empty, Stage values seen:
    Prospecting, Qualification, Needs Analysis; Close Date is in the list.
  - New Lead form: required fields are Last Name, Company and Lead Status
    (default "Open - Not Contacted"). Email, Phone and Title are optional.
  - New Contact form: only Last Name is required. Account Name and Email
    are optional.
  - New Opportunity form: required fields are Opportunity Name, Close Date
    and Stage. Account Name is NOT required in this org (the public docs
    list it as required).
  - Not read yet: Lead Status and Stage picklist values (only the default
    and three seen Stages), duplicate rule actions, Person Accounts, the
    Setup pages (they failed to render through the browser tool).

## 3. How the user sets up the integration [public docs]

1. In Saleshandy open Settings > Integrations > Connect now.
   (The HubSpot page on staging also exists at API & Integrations >
   Integrations. Check which path Salesforce uses on staging.)
2. Under native integrations pick Salesforce Integration (bidirectional) >
   Continue.
3. Salesforce login page opens. Log in and authorize. An existing
   Salesforce account is required.
4. Saleshandy shows "Connected".
5. Top-right menu > Configure: map Saleshandy fields to Salesforce fields,
   per object (Lead, Contact, Opportunity, Account properties), then Save.
   Saleshandy default fields cannot be changed. Custom fields can be added.
6. Settings > Integrations > Salesforce > Triggers & Activity: switch a
   trigger on, choose an activity, fill the extra settings, Save.
7. Logs tab (Settings > Integrations > Logs): check each run.

## 4. What a user can switch on

### Saleshandy to Salesforce [public docs]

Triggers: Email Sent, Reply Received, Prospect Outcome Updated, Sequence
Email Opened, Link Clicked, Prospect Unsubscribed, Email Bounced, Call
Logged, Call Outcome Updated.

Activities: Create or Update Account, Contact, Lead or Opportunity; Attach
Note; Record Email Activity; Record Call Activity.

| User wants | Trigger and activity | Extra settings |
|---|---|---|
| Every prospect that replies becomes a Lead | Reply Received > Create a Lead | Mapping for Lead properties |
| An interested prospect becomes a deal | Prospect Outcome Updated > Create an Opportunity (or Lead) | Outcome to match; Opportunity closing date and stage |
| A link click opens a deal | Link Clicked > Create an Opportunity | Closing date and stage |
| Engagement is visible on the record | Email Sent / Opened / Clicked > Record Email Activity | Multi-select: Lead, Opportunity, Contact. Standalone, not paired [staging, 2026-10-17] |
| Reply text kept on the record | Reply Received > Attach Note | Must pair with Create/Update Contact (no Deal in SF). Confirmed working [staging, 2026-10-17] |
| Calls on the timeline | Call Logged > Record a Call Activity | Choose Contact, Lead or Opportunity |
| Call outcome kept in sync | Call Outcome Updated > Update a Contact | Both the trigger and Update a Contact must be on |

Outcomes offered for the outcome setting: Interested, Not Interested,
Meeting Booked, Out of Office, Closed, Not Now, Do Not Contact,
Uncategorized, plus custom outcomes.

### Salesforce to Saleshandy [public docs]

Triggers: Contact, Opportunity, Account or Lead Created. Direct import
trigger: Import Prospects from Salesforce.

Activities: Add Prospect, Move Prospect to another Sequence, Mark as
Unsubscribed, Finished, Replied, Paused or Resumed, Assign a Tag, Blacklist a
Domain.

| User wants | Trigger and activity | Extra settings |
|---|---|---|
| New Salesforce lead goes into outreach | Lead Created > Add Prospect | None documented |
| Move a person already in Saleshandy | Contact Created > Move Prospect to another Sequence | Target sequence and steps |
| Pause on a Salesforce event | any Created trigger > Mark as Paused | Sequence and number of days |
| Tag, unsubscribe, blacklist | any Created trigger > Assign a Tag / Mark as Unsubscribed / Blacklist a Domain | Tag (can be created in the pop-up) |
| Pull a Salesforce list | Import Prospects from Salesforce > Add Prospect or Move to Sequence | Salesforce contact list; for Move also sequence and steps |

How the user imports: after mapping and triggers, go to prospect import,
choose the CRM list, optionally choose the target sequence [public docs,
blog].

### Dialer call logging [public docs]

- Needs: Salesforce connected, a Saleshandy Dialer plan with at least one
  number, a Salesforce user who can create and edit Tasks.
- Setup: Triggers & Activity > Call Logged in Saleshandy > Record a Call
  Activity in Salesforce; Call Outcome Updated in Saleshandy > Update a
  Contact; Save.
- Sent 90 seconds after the call ends, answered or missed. Outcome at that
  moment is what is sent. A later outcome change updates the same activity
  (no duplicate) only if both settings above are on.
- Result: a completed Task, Subtype Call, on the matched record. Sequence
  calls add sequence name and step number. Forwarded inbound calls add a
  "Forwarded to" line. Recordings and transcripts are not written. The call
  log link opens the detail page in Saleshandy.
- Matching: prospect email first, then phone against Contact phone fields.
  Several Contacts with the same number: the one whose number was added
  earliest. No match: the call is skipped and the reason is in Logs. Calls
  never create records.

## 5. End-to-end user journeys (seed for test cases)

Each journey is something a user can do and check. Verify result in
Salesforce itself, because a step can show Success while the record was not
created [dev kit: common-bugs #49].

| # | User action | Where | What to check |
|---|---|---|---|
| J1 | Connect Salesforce with valid login | Saleshandy Integrations | "Connected" shown; Triggers & Activity and Logs tabs available |
| J2 | Cancel or deny on the Salesforce login screen | Salesforce authorize page | Saleshandy stays not connected, no partial state (behavior not documented) |
| J3 | Map Lead fields and Save, then trigger a Create Lead | Configure, then a sequence | Lead has the mapped values; unmapped fields stay empty |
| J4 | Turn on Email Sent > Record Email Activity, send one sequence email | Sequence, then Salesforce record | Email activity on the right record's timeline |
| J5 | Reply Received > Create a Lead, reply to the sequence email | Sequence, then Salesforce Leads | One Lead; Company value is present (required by Salesforce) |
| J6 | Same reply again or second prospect with the same email | Salesforce | Update versus duplicate Lead; depends on duplicate rule |
| J7 | Prospect Outcome Updated > Create an Opportunity with outcome Interested; set outcome Interested, then Not Interested | Saleshandy CRM, then Salesforce | Opportunity created only for the matched outcome; closing date and stage as saved |
| J8 | Link Clicked > Create an Opportunity, click tracked link | Email, then Salesforce | Opportunity with Stage and Close Date from settings |
| J9 | Attach Note with and without Create or Update Contact first | Salesforce | Note fails without the prior activity, works with it |
| J10 | Save a pair with required settings blank (Opportunity without stage, outcome pair without outcome) | Triggers & Activity | Save blocked |
| J11 | Create a Lead or Contact in Salesforce with Lead Created > Add Prospect | Salesforce, then CRM > All Prospects | Prospect appears with mapped fields in the chosen sequence |
| J12 | Update an existing Salesforce Contact | Salesforce | No trigger fires (only Created exists) |
| J13 | Move to Sequence, Mark as Paused with days, Assign a Tag, Blacklist a Domain | Salesforce create, then Saleshandy | Each action applied; paused for the chosen days |
| J14 | Import Prospects from Salesforce with a list and a sequence | Prospect import | Prospects added; counts match the list |
| J15 | Place a Dialer call to a matched prospect, wait 90 s | Dialer, then Salesforce timeline | Completed Call Task with sequence and step; later outcome updates the same task |
| J16 | Place a call to a number with no Salesforce match | Logs tab | Call skipped, reason in Logs, no new record |
| J17 | Salesforce user without Task create permission | Dialer | Call logging fails (behavior not documented) |
| J18 | Bounce and Unsubscribe triggers | Sequence, then Salesforce | Record updated or activity recorded as configured |
| J19 | Open Logs after any run | Logs tab | Row with name, id, time, status; node detail with request and response |

## 6. How Salesforce is useful for the Saleshandy workflows

- It is the system of record. Every Saleshandy to Salesforce test ends with
  a check in Salesforce (record, fields, timeline), not only a Success row.
- Required fields and picklists in the org decide what can be created.
  Setting up Company, Stage values and Close Date is part of test data prep.
- Duplicate rules decide create versus update versus reject. Changing a rule
  between Allow and Block is a ready-made scenario.
- Lead conversion and Account links decide whether a person is found as a
  Lead or a Contact. Use pre-built records: one Lead, one Contact with
  Account, one converted Lead.
- The Activity timeline is where Email, Call and Note results become
  visible to a sales user.
- Salesforce-side triggers need a record created in the Salesforce UI.
  A Developer Edition org is enough.

## 7. Differences from HubSpot that change test design

- Salesforce triggers are Created only. HubSpot has Created and Properties
  Updated [public docs].
- Salesforce has Lead as a separate object from Contact, with conversion.
  HubSpot does not.
- Salesforce adds Call Logged and Call Outcome Updated with a 90 s delay.
- Salesforce adds Import Prospects from Salesforce as a trigger.
- Salesforce has Record Email Activity and Record Call Activity as
  activities.

## 8. Not documented yet (ask QA or check on staging)

- Which Saleshandy field maps to which Salesforce property (Opportunity page
  lists 44 Salesforce fields without the Saleshandy side; Lead, Contact and
  Account pages were not found).
- Sync frequency, rate limits, disconnect behavior, conflict handling.
- Update versus create rule when the prospect already exists as Lead or
  Contact; how conversion affects matching.
- Behavior on denied OAuth, expired token, missing Task permission.
- Exact screen labels and URLs on staging (the HubSpot page uses "Hubspot").
- Whether Created triggers fire for records created by import or API.
- Duplicate rule actions, Person Accounts, full Lead Status and Stage
  picklists, Lead conversion settings of the test org.
- A way to log in without the SMS code (saved session, or a project login
  script like HubSpot's).

## Sources

- https://docs.saleshandy.com/en/articles/9148639-salesforce-integration
- https://docs.saleshandy.com/en/articles/9202976-how-to-set-up-salesforce-integration
- https://docs.saleshandy.com/en/articles/9203067-salesforce-configuration-mapping-fields
- https://docs.saleshandy.com/en/articles/9204109-salesforce-triggers-activities
- https://docs.saleshandy.com/en/articles/9154576-opportunities-properties
- https://www.saleshandy.com/blog/introducing-salesforce-integration/
- Salesforce Help: convert leads, standard duplicate rules, Opportunity
  fields, Task fields, Log a Call, Notes and Files, sandbox types
