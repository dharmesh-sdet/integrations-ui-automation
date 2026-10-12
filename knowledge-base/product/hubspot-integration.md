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
| Triggers & Activity tab | `?tab=triggers-activity` | One row per trigger with an on/off toggle. Changes apply only after the page's Save button; success shows the alert "Configuration Updated Successfully" [staging, 2026-10-08] |
| Logs tab | `?tab=logs` | Refresh button at the top. One row per workflow run, newest first, e.g. `Contact Updated in Hubspot 6ac7397229a2f6774c8a9f0c Oct 8, 2026, 12:04 PM 16.6s Success` (name, execution id, date and time, duration, status) [staging, 2026-10-08] |
| CRM, All Prospects | URL `/crm/list` | Search box "Search Name or Email" (Enter to search). Total reads "Showing N out of M". Clicking a prospect's name opens a details dialog with labelled fields (City, Job Title, ...) [staging, 2026-10-08] |

- Trigger names in the product say **Hubspot** (lower-case s), e.g. "Contact
  Updated in Hubspot", while docs and Jira say HubSpot. Match the product
  text exactly in tests [staging, 2026-10-08].
- Logs reach Success about 1 to 1.5 minutes after the HubSpot action, because
  a third party (Refold) delivers the data late [staging, 2026-10-08].
- Contact Updated in HubSpot has no activity dropdown at all (trigger only)
  [project: context/hubspot/contact-updated.md].

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

## Not documented yet

- Field mapping screen layout (only the mapping pairs are known).
- Extra Configuration modal on the Triggers & Activity tab (no walkthrough yet).
- Log entry details view (QA rule: do not open entries during tests).
- How each platform's login page is recognised (open `TODO(needs-input)` in
  `automation/src/pages/base.page.ts`).
