# HubSpot integration: screens and names

What the screens look like and what things are called, as seen on staging.
Workflows, activities, intended behavior and field mapping are in
[00-overview.md](../../automation/context/hubspot/00-overview.md); this page
does not repeat them.

## Saleshandy side

Staging: `https://pyxis.lifeisgoodforlearner.com` [project]

| Screen | How to reach it | Notes |
|---|---|---|
| HubSpot integration | API & Integrations > Integrations > Hubspot, URL `/api-and-integrations/integrations/hubspot` | The older path Settings > Integrations > HubSpot also exists; QA said either is fine [QA, 2026-10-08] |
| Triggers & Activity tab | `?tab=triggers-activity` | One row per trigger with an on/off toggle. Two Save buttons [QA, 2026-10-12]: the modal's Save (Extra Configuration) saves the Extra Configuration and the entire workflow; the page's Save (bottom of the tab) saves the entire workflow and works best for activities with no Extra Configuration modal. Success shows the alert "Configuration Updated Successfully" [staging, 2026-10-08]. Create a Task: with empty fields the modal's Save is disabled, and a field clicked into and left empty turns red [QA, 2026-10-12] |
| Logs tab | `?tab=logs` | Refresh button at the top. One row per workflow run, newest first, e.g. `Contact Updated in Hubspot 6ac7397229a2f6774c8a9f0c Oct 8, 2026, 12:04 PM 16.6s Success` (name, execution id, date and time, duration, status) [staging, 2026-10-08]. Clicking an entry opens "Execution detail": one card per step (name, type such as rule or hubspot, status); View Details shows that step's Request and Response JSON [staging, 2026-10-14] |
| CRM, All Prospects | URL `/crm/list` | Search box "Search Name or Email" (Enter to search). Total reads "Showing N out of M". Clicking a prospect's name opens a details dialog with labelled fields (City, Job Title, ...) [staging, 2026-10-08] |

- Trigger names in the product say **Hubspot** (lower-case s), e.g. "Contact
  Updated in Hubspot", while docs and Jira say HubSpot. Match the product
  text exactly in tests [staging, 2026-10-08].
- Logs reach Success about 1 to 1.5 minutes after the HubSpot action, because
  a third party (Refold) delivers the data late [staging, 2026-10-08].
- Contact Updated in HubSpot has no activity dropdown at all (trigger only)
  [project: context/hubspot/contact-updated.md].
- The Logs tab of a Saleshandy account that has never run a workflow shows
  "No logs yet" and no rows [staging, 2026-10-13].
- Create a Task, Extra Configuration: Save is disabled from the start. After
  the fields are touched and left empty only Task Title and Due In turn red;
  Task Type, Task Priority and Task Associated With do not. Not a bug
  [staging, 2026-10-13; QA, 2026-10-13].

## HubSpot side (test portal)

Base URL `https://app-na2.hubspot.com`, portal id `247419080`. The account in
`automation/auth/hubspot-chromium.json` is safe to create data in [project].

| Screen | How to reach it | Notes |
|---|---|---|
| Contacts list | `/contacts/247419080/objects/0-1/views/all/list` | [staging, 2026-10-08] |
| Create contact | Contacts list > Add contacts > Create new (menu item) | Opens a side panel in an iframe. Job title stays disabled until Email is filled. Create opens the new record [staging, 2026-10-08] |
| Contact record | `/contacts/247419080/record/0-1/<record id>` | The record id is in the URL after Create [staging, 2026-10-08] |
| All properties | Record > About card > Actions > View all properties | "Search property" box. Each property saves on Enter, so HubSpot sends one update event per property, which can mean several log entries in Saleshandy [staging, 2026-10-08; AL-4039] |

HubSpot portal settings that change results are in 00-overview.md
(lifecycle stages only move forward; "Create and associate companies with
contacts" must stay off, AL-4029).

## Scenario meanings and accepted behavior (Reply Received)

- Update a Contact 4, "details not changed": the contact keeps the prospect's
  values plus the saved Lead Status and Lifecycle Stage values. After the
  trigger the log is Success and nothing on the contact changes [QA,
  2026-10-13].
- A Log entry in RUNNING for 3 to 7.5 minutes (Create a company 3, Update a
  deal rows) is a performance note, not a bug. Nothing is filed [QA,
  2026-10-13].

## Not documented yet

- Field mapping screen layout (only the mapping pairs are known).
- Extra Configuration modal on the Triggers & Activity tab (no walkthrough yet).
- Log entry details view (QA rule: do not open entries during tests).
- How each platform's login page is recognised (open `TODO(needs-input)` in
  `automation/src/pages/base.page.ts`).
