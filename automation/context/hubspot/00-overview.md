# Saleshandy and HubSpot integration: overview

General context for the Saleshandy and HubSpot integration (HubSpot
Triggers and Activities). Read this first, then the workflow file for the
workflow being worked on. Each workflow file covers what it does, its
activities and Extra Configuration, setup, how to execute it, and where to
verify the result.

## How the integration works

- The integration is a set of workflows. Each workflow is a **trigger**
  (an event) plus one or more **activities** (what runs when the event
  happens).
- **HubSpot-side triggers:** an event in HubSpot (contact, deal, or company
  created or updated) runs activities on Saleshandy prospects.
- **Saleshandy-side triggers:** an event in Saleshandy (email sent, reply
  received, prospect outcome changed, link clicked) runs activities on
  HubSpot records.
- Many activities have an **Extra Configuration** modal that opens when the
  activity is selected (for example a sequence, a tag, Lead Status, a deal
  pipeline). It can be reopened later with the pointer icon next to the
  activity name.

## Where things are

- Triggers & Activities: Settings > Integrations > HubSpot > Triggers & Activities.
  Enable a trigger, select an activity, fill the Extra Configuration, click
  Save in the modal, then Save on the page.
- Logs: Settings > Integrations > HubSpot > Logs. Every workflow run creates
  a log entry with a Success or Error status; open an entry for details.
- Field mapping: Settings > Integrations > HubSpot.
- Environments: Staging is pyxis.lifeisgoodforlearner.com. Production is
  tested on a new user account on the production environment (no URL
  documented).

## Workflows

| # | Workflow (trigger) | Jira sub-task | Direction | File |
|---|---|---|---|---|
| 1 | Import Prospect when contact is created on HubSpot (deprecated) | AL-4017 | HubSpot to Saleshandy | Not written yet |
| 2 | Contact Updated in HubSpot | AL-4007 | HubSpot to Saleshandy | contact-updated.md |
| 3 | Contact Created/Properties Updated in HubSpot | AL-4006 | HubSpot to Saleshandy | Not written yet |
| 4 | Deal Created/Properties Updated in HubSpot | AL-4008 | HubSpot to Saleshandy | Not written yet |
| 5 | Company Created/Properties Updated in HubSpot | AL-4009 | HubSpot to Saleshandy | company-created.md (PARKED 2026-10-09, workflow does not trigger; resume from company-created-progress.md) |
| 6 | Email Sent from Saleshandy | AL-4010 | Saleshandy to HubSpot | email-sent.md |
| 7 | Reply is received in Saleshandy | AL-4011 | Saleshandy to HubSpot | reply-received.md |
| 8 | Prospect Outcome is updated in Saleshandy | AL-4012 | Saleshandy to HubSpot | prospect-outcome-updated.md |
| 9 | Link Clicked in Saleshandy (Jira: Link is Clicked in Saleshandy) | AL-4014 | Saleshandy to HubSpot | link-clicked.md |
| 10 | Email is Bounced in Saleshandy (Jira: Email is bounced in Saleshandy) | AL-4016 | Saleshandy to HubSpot | email-bounced.md |
| 11 | Sequence Email is Opened in Saleshandy | AL-4013 | Saleshandy to HubSpot | email-opened.md |

All sub-tasks belong to AL-3984 ("[HubSpot] Triggers and Activities,
Exploration and Test Cases"). Bugs are filed under Epic AL-3982.

Not covered yet (no testing notes): Prospect is Unsubscribed in Saleshandy
(AL-4015). Sequence Email is Opened in Saleshandy (AL-4013) has a context
file and scenarios (2026-10-12). Email is
bounced in Saleshandy (AL-4016) has a context file and scenarios (2026-10-12).

Partially documented: Company Created/Properties Updated (parked 2026-10-09:
no log appears when a company is created, see company-created-progress.md;
only the Company Created part is in release scope),
Reply is received (how to trigger a reply is not documented yet), Link
Clicked (only Create a contact in HubSpot is documented in detail).

## Activities

Order matches the product UI.

**HubSpot-side triggers** (Contact Created/Properties Updated, Deal
Created/Properties Updated, Company Created/Properties Updated):

| Activity | Extra Configuration |
|---|---|
| Add Prospect in Saleshandy | None |
| Move Prospect to Another sequence in Saleshandy | Sequence, Sequence Steps (dropdowns) |
| Mark Prospect as unsubscribed in Saleshandy | None |
| Mark prospect as Finished in Saleshandy | Sequence |
| Mark prospect as Replied in Saleshandy | Sequence |
| Mark Prospect as Paused in Saleshandy | Sequence, Pause Delay in Days |
| Mark prospect as Resume (Un-pause) in Saleshandy | Sequence |
| Assign a tag to Prospect in Saleshandy | Tag (create or select one or more) |
| Blacklist a domain in Saleshandy | None |

Extra Configuration for the Company trigger's activities is not documented
yet.

**Saleshandy-side triggers** (Email Sent, Reply is received, Prospect
Outcome is updated, Link Clicked):

| Activity | Extra Configuration (Email Sent and Reply is received) | Extra Configuration (Prospect Outcome is updated) |
|---|---|---|
| Create a Contact in HubSpot | Lead Status, Lead Lifecycle (can be skipped) | Lead Status, Lead Lifecycle, Select Outcome |
| Update a Contact in HubSpot | Update Lead Status, Update Lead Lifecycle (can be skipped) | Update Lead Status, Update Lead Lifecycle, Select Outcome |
| Create a deal in HubSpot | Pipeline, Pipeline Stage, Deal Type, Deal Priority, Closing Date (Days) | Same, plus Select Outcome |
| Update a deal in HubSpot | Same as Create a deal | Same, plus Select Outcome |
| Create a company in HubSpot | None | Select Outcome |
| Update a company in HubSpot | None | Select Outcome |
| Create a Task in HubSpot | Task title, Task Type, Task Priority, Due in (Days) | Same, plus Select Outcome |
| Create a Note in HubSpot | None, must be paired | None, must be paired |
| Record (log) an email activity in HubSpot | None, must be paired | None, must be paired |

For Link Clicked, only Create a Contact in HubSpot is documented (Lead
Status, Lead Lifecycle); the other activities are the same list, with
Extra Configuration not documented yet. The exact field list per trigger is
in each workflow file.

**Extra Configuration dropdown values** [staging, 2026-10-13, account
emailopened]:

| Field | Options, in the order the list shows |
|---|---|
| Lead Status (Create a Contact) | New, Open, In Progress, Open Deal, Unqualified, Attempted to Contact, Connected, Bad Timing |
| Lead Lifecycle (Create a Contact) | Subscriber, Lead, Marketing Qualified Lead, Sales Qualified Lead, Opportunity, Customer, Evangelist, Other |
| Pipeline (Create a Deal) | Sales Pipeline (the only one) |
| Pipeline Stage (Create a Deal, Sales Pipeline) | Prospecting, Initial Contact, Follow-Up, Proposal Sent, Negotiation, Closed Won, Closed Lost |
| Deal Type | New Business, Existing Business |
| Deal Priority | Low, Medium, High |

Update a Contact has the same Lead Status and Lead Lifecycle lists (labels
"Update Lead Status", "Update Lead Lifecycle"); Update a Deal has the same
Pipeline, Stage, Deal Type and Priority lists (labels "when to update" and
"while updating") [staging, 2026-10-13]. Create a Task: Task Type = Call,
Email, Sales Navigator - Connection Request, Sales Navigator - InMail, To Do;
Task Priority = None, Low, Medium, High [staging, 2026-10-13]. The
searchable lists open with a Search box. "Two steps ahead" for an Update a Deal means Pipeline Stage: two
positions further down the list than the deal's current stage [QA,
2026-10-13].

## Intended behavior (confirmed)

- **Extra Configuration once saved (QA, 2026-10-09):** on a new Saleshandy
  account every Extra Configuration is empty. After values are saved, the
  fields cannot be emptied again, and removing the activity and selecting it
  again brings the saved values back. Expected, not a bug. So "Extra
  Configuration skipped" rows can only run on an account where that
  activity's configuration was never saved.
- **Extra Configuration empty, Create a Contact / Create a deal (QA,
  2026-10-12):** the contact or deal is still created. HubSpot sets the
  contact's Lifecycle Stage and Lead Status, and fills the deal's Pipeline,
  Stage, Deal Type and Priority. The deal Amount stays empty (--) when the
  prospect has no Deal Value. Closing Date 0 Days leaves the close date
  empty (--). Update a deal with Extra Configuration empty: not stated yet.
- **Mark Prospect as Finished / Replied / Paused:** the sequence in Extra
  Configuration is only used to check whether the prospect is already in
  that sequence. If it is, the status is applied. If the prospect is not in
  the sequence, or does not exist in Saleshandy yet, the activity does
  nothing further (the prospect may still be created). It never adds the
  prospect to the sequence.
- **Deal Created/Properties Updated:** activities act on all contacts
  associated with the deal, not just the first. Both deal creation and deal
  property updates fire the workflow. Adding a contact association alone
  does not fire it.
- **Multiple log entries:** HubSpot fires one event per changed property, so
  one change in HubSpot can produce several workflow runs (AL-4039, not a
  bug).
- **Update a deal:** when the contact has multiple deals, the latest created
  deal is updated, not the oldest or first created.
- **Update a company:** when the contact has multiple companies, the latest
  associated company is updated.
- **Email Sent, Create a deal / Create a company:** if the contact does not
  exist in HubSpot yet, it is created too.
- **Create a Note and Record (log) an email activity:** have no Extra
  Configuration and must be paired with Create/Update a Contact or
  Create/Update a Deal, so the note or email has a record to attach to.
  Selected alone, the workflow still runs and its log is Success, but the
  note or email lands on no contact, company or deal (QA, 2026-10-13).
- **Create a Note paired with Create a deal or Update a deal:** with Create a
  deal and the contact not in HubSpot, the contact and the deal are created and
  the note goes on both. With Update a deal the contact and the deal both
  receive the note (QA, 2026-10-14, confirmed with the developer; it was
  recorded as "deal only" on 2026-10-13 and the product showed both).
- **Record (log) an email activity paired with Update a deal (3 deals):** the
  email is logged on the latest created deal and on the contact, in every
  workflow (QA, 2026-10-15; it was "deal only" on 2026-10-13 and 2026-10-14,
  and staging showed both on 2026-10-15 in Reply Received). The card header reads "Logged
  email by <integration name> via Saleshandy" (QA, 2026-10-14). The name is the
  account's integration, not the trigger or the prospect: "Email Opened" and
  "Link Clicked" on the staging accounts, "rehan integration" on production
  [production smoke, 2026-10-14]. Match it by pattern, not by name. On Link
  Clicked the header must name the prospect (AL-4123).
- **Seen on staging, Sequence Email is Opened > Update a deal:** on 2026-10-13
  the Search deal step filtered `dealname = <prospect email>`, found 0 deals
  and the log still said Success, so the deal was not updated (AL-4128). On
  2026-10-14 (from about 10:56) it filters by the associated contact, finds
  the deal and updates it; 4 of 4 Update a deal scenarios passed twice. Who
  changed it is not known.
- **A Logs entry is the custom workflow's run, not one activity's result.**
  Success means the workflow ran; it does not prove a record was written.
  Whether a note, task, contact or deal exists is checked in HubSpot (QA,
  2026-10-13).
- **Prospect Outcome is updated:** Select Outcome is a single value. The
  workflow acts only when the new outcome matches it; any other outcome is
  blocked and nothing is created or updated. On this trigger, a logged
  email activity has an empty description and "Unknown Contact" as From,
  because no email is sent (AL-4113, expected).
- **Blacklist a domain:** the domain is added to the Do Not Contact list
  regardless of sequence membership. The prospect's Latest Status becomes
  Blacklisted only when the prospect is already in a sequence.
- **HubSpot lifecycle stages** only move forward; HubSpot blocks backward
  moves (HubSpot behavior, not a Saleshandy defect).
- **HubSpot portal setting "Create and associate companies with contacts"**
  (HubSpot Settings > Data Management > Objects > Companies > Setup, or
  Settings > Objects > Companies on newer portals): when on, HubSpot
  auto-creates a company from the contact's email domain, so Create a
  Company produces two companies. Keep it off for testing (AL-4029).

## Accepted by developer and product (integration-skills, not yet seen on staging)

Source: the developer's kit in `../integration-skills/` (path from the
project root), mainly `integration-enhance/references/common-bugs.md`.

- Email Sent family: Create a deal / Create a company never check for an
  existing record; every run creates a new one [dev kit:
  common-bugs, accepted 2026-09-25].
- One note and one email log per activity that ran; duplicates across
  activities are expected [dev kit: common-bugs, accepted
  2026-09-25].
- Deal and company names stay as the workflow sets them. Email Sent names the
  deal `FirstLast` (no space), Link Clicked `First Last` (with a space).
  Update a company sets name = prospect Company and domain = Company Domain.
  Combined with "update the latest", the contact's newest deal or company is
  renamed this way, and that is accepted [dev kit:
  common-bugs #45, 2026-10-02].
- Several Saleshandy-side activities enabled together for a brand-new
  prospect race to create the same HubSpot contact. All but one get HubSpot
  409 Conflict and that activity's deal, company or task is lost. Accepted for
  now, not fixed. Likely cause of the AL-40xx "X fails when Y is also
  enabled" tickets [dev kit: common-bugs #40, 2026-09-25].

## Known general findings

- Some runs show an Error status in Logs but still partially succeed (for
  example, the prospect is still created in Saleshandy).
- Field mapping is required. If it is not configured while a trigger is
  enabled, data may not be created in either Saleshandy or HubSpot.

## Risk areas to cover in scenarios (from integration-skills)

Whether each fix is deployed on staging is not documented yet; ask the
developer before calling a result in these areas a new bug.

- Several activities enabled together with a new prospect (the race above)
  [dev kit: common-bugs #40].
- Closing Date / Due in (Days): portals west of UTC showed the previous day
  (AL-4051). The Extra Configuration number field never saves `0` and is
  capped at 200 days (known web UI bug, not fixed) [dev kit:
  common-bugs #37 and accepted list].
- Update a deal / company right after a new deal or company was created:
  HubSpot search has a short indexing delay, so the previous newest record may
  be updated instead [dev kit: common-bugs #44].
- Deal Created/Properties Updated: a deal property change fires only for
  properties the HubSpot app subscribes to. A mapped deal property with no
  subscription never re-triggers the workflow [dev kit:
  common-bugs #31].
- Deal Created with Blacklist a domain selected: the bulk import is skipped,
  but Add Prospect to sequence still imports the prospects [dev kit:
  common-bugs, Reference structure, branch 2].
- Deal associated with a contact that has no email: that contact is not sent
  to Saleshandy (if the #30 fix is live) [dev kit:
  common-bugs #30].
- A deal or company property mapped in the Contact properties panel (e.g.
  Deal Value to Amount) stayed silently empty before the v17 fix [dev kit:
  common-bugs #25].

## Field mapping

Mapped pairs only (Saleshandy field to HubSpot property). All other
Saleshandy fields are skipped on that object.

**Contact properties**

| Saleshandy | HubSpot (Contact) |
|---|---|
| Birthday | Date of birth |
| First Name | First Name |
| Last Name | Last Name |
| Email | Email |
| Phone Number | Phone Number |
| Job Title | Job Title |
| Industry | Industry |
| LinkedIn | LinkedIn URL |
| Twitter | Twitter Username |
| Facebook | Facebook ID |
| Website | Website URL |
| City | City |
| State | State/Region |
| Country | Country/Region |
| Company | Company Name |
| Company Website | Website URL |
| Company Industry | Industry |
| Company Size | Company size |
| Company Revenue | Annual Revenue |
| Company Phone | Mobile Phone Number |
| Person's Seniority Level | Employment Seniority |
| Company HQ Location | Country/Region Code |
| Closing Date | Close Date |

**Deal properties**

| Saleshandy | HubSpot (Deal) |
|---|---|
| Deal Value | Amount |
| Closing Date | Close Date |

(An earlier note said Deal Value was not mapping to Amount; a later retest,
AL-4053, confirmed all configured mappings sync correctly.)

**Company properties**

| Saleshandy | HubSpot (Company) |
|---|---|
| Email | HubSpot Owner Email |
| Industry | Industry group |
| LinkedIn | Linkedin handle |
| Website | Website URL |
| City | City |
| State | State/Region |
| Country | Country/Region |
| Company | Company name |
| Company Domain | Company Domain Name |
| Company Website | Website URL |
| Company Industry | Industry group |
| Company Size | Company size segment |
| Company Founded Year | Year Founded |
| Company HQ Location | Country/Region Code |
| Closing Date | Close Date |

## Glossary

- **Prospect:** a person in Saleshandy (the HubSpot equivalent is a contact).
- **Sequence:** a Saleshandy email sequence with steps; prospects are added
  to it and receive the step emails.
- **Latest Status:** the prospect's status in a sequence (Active, Paused,
  Replied, Finished, Unsubscribed, Blacklisted, and so on).
- **Prospect Outcome:** a label on a prospect in a sequence (Uncategorized,
  Interested, Not Interested, Meeting Booked, Out of office, Closed, Not
  Now, Do not Contact).
- **Extra Configuration:** the per-activity settings modal on the Triggers &
  Activities page.
