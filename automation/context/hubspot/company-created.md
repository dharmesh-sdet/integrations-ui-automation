# Company Created/Properties Updated in HubSpot

Readiness for scenario generation: Ready for the Company Created path (QA answers, 2026-10-09).

Status: PARKED (2026-10-09). The workflow does not trigger on this account. Where we stopped and the next steps: `company-created-progress.md`.

Jira sub-task: AL-4009

Direction: HubSpot to Saleshandy (trigger: a company is created or its properties are updated in HubSpot; action: the selected activity runs on prospects in Saleshandy).

Release scope note: Only the Company Created part is in release scope. The Company Properties Updated part is not, because the workflow is not triggered on company property updates (a third-party workflow service used by the integration does not fire it) and the fix will take time. See AL-4059 in Tickets below; it is not counted as a bug to retest.

## Tickets

| Ticket | Summary (short) | Status (as of 2026-10-08) |
|---|---|---|
| AL-4059 | Updating company properties does not trigger the Company workflow | In Progress. Open, exclude from smoke |

## What it does

- The trigger fires on a HubSpot company being created or its properties being updated, and runs the selected Saleshandy activity (for example Add Prospect in Saleshandy).
- Contacts can be associated to the company while creating it (existing HubSpot contacts, or contacts created just before the company). A company can have several contacts; keep 2 to 4 per company so the data stays traceable (QA, 2026-10-09). This replaces the earlier note that the creation form has no contact field.
- Every activity acts on all contacts associated with the company. For example, Add Prospect adds every associated contact as a prospect, and Move Prospect to Another sequence moves all of them (QA, 2026-10-09).
- Mixed contacts: associated contacts not in Saleshandy yet are created as prospects, existing prospects are not duplicated, and the activity applies to every contact that qualifies (QA, 2026-10-09).
- Company created with no associated contact: Success in Logs, nothing changes in Saleshandy, for all 9 activities (QA, 2026-10-09).
- The Properties Updated path stays out of scope (AL-4059).

## Activities

Order matches the product UI. The activities are the same 9 as the Contact and Deal triggers, in the same order.

UI labels (walked 2026-10-09, trigger "Company Created/Properties Updated in Hubspot"); the scenarios file keeps the names above.

| # | Activity (UI label) | Extra Configuration (seen 2026-10-09) |
|---|---|---|
| 1 | Add Prospect in Saleshandy | None (no dialog) |
| 2 | Move Prospect to another Sequence in Saleshandy | Sequence, Sequence Steps |
| 3 | Mark Prospect as Unsubscribed in Saleshandy | None (no dialog) |
| 4 | Mark Prospect as Finished in Saleshandy | Sequence |
| 5 | Mark Prospect as Replied in Saleshandy | Sequence |
| 6 | Mark Prospect as Paused in Saleshandy | Sequence, Pause Delay In Days |
| 7 | Mark Prospect as Resume(Un-pause) in Saleshandy | Sequence |
| 8 | Assign a tag to Prospect in Saleshandy | Tags (create or select; "Avoid using tags that have spaces in them") |
| 9 | Blacklist a Domain in Saleshandy | None (no dialog) |

The Select box is disabled until the trigger is on. Cancelling an Extra Configuration dialog still leaves the activity selected on the page (unsaved until Save).

## Prerequisites and setup

- Environment: Staging (pyxis.lifeisgoodforlearner.com). Production is tested on a new user account on the production environment; no URL is documented.
- HubSpot integration connected and Field Mapping configured. Field mapping is required: if mapping is not configured while a trigger/activity is enabled, data may not be created in either Saleshandy or HubSpot.
- Company Properties mapping (saved mapping):
  - Email to HubSpot Owner Email
  - Industry to Industry group
  - LinkedIn to Linkedin handle
  - Website to Website URL
  - City to City
  - State to State/Region
  - Country to Country/Region
  - Company to Company name
  - Company Domain to Company Domain Name
  - Company Website to Website URL
  - Company Industry to Industry group
  - Company Size to Company size segment
  - Company Founded Year to Year Founded
  - Company HQ Location to Country/Region Code
  - Closing Date to Close Date
  - All other Saleshandy fields are skipped.
- Test data: a HubSpot company to create; for the update path (out of release scope), contacts to associate to the company afterward.

## How to execute

QA, 2026-10-09:

1. Create 2 to 4 contacts from the CSV in HubSpot, one at a time (tests associate only contacts they created).
2. Create the company: Companies > Add companies > Create new, Company domain name and Company name, Create (ignore the "Gosh ..." list of similar companies). The form has no contact field.
3. On the new company's record: Contacts card > Add > Add existing, search each contact, tick it, Save.
4. Check Logs, then the prospects in Saleshandy.

Each run creates a new company. Prospects for the later activities come from chaining earlier runs (Add Prospect, then Move Prospect to Another sequence, and so on) with the same contacts.

## Activity-specific execution notes

- Tag A is created inside the "Assign a tag" Extra Configuration during that activity's first scenario, not in account setup (QA, 2026-10-09).
- Account setup (`SETUP_ACCOUNT=companycreated npm test -- tests/setup/account-setup.spec.ts`): field mapping, Sequence A (id 196223) and Sequence B (id 196253), Draft, one Email step from Template 1 each.
- Blacklist a domain blacklists the contact's email domain (QA, 2026-10-09). Test contacts are all @mailinator.com, so the Blacklist row runs last and the spec removes mailinator.com from the Do Not Contact list after checking it.
- Chain order (QA, 2026-10-09): Add > Move (to a sequence) > Assign a tag > Paused > Resume. Replied, Finished, Unsubscribed and Blacklist a domain each use different contacts, so no prospect gets two final statuses.

## Where to verify

- Workflow execution: Settings > Integrations > HubSpot > Logs (status Success, Error, or In progress/Running; click the log entry's status to open its details drawer).
- Prospect result: search the prospect in the Saleshandy Prospects list (QA, 2026-10-09).
- Wait: refresh Logs 15 seconds after the action, then every 10 seconds until Success (about 1 minute sync).

## Open questions

- How a HubSpot company maps to a Saleshandy prospect beyond contact association.
- Why the Company mapping screen shows contact fields (First name, Last name, Is B2B, and so on), and whether they can be removed.
- Extra Configuration fields for this trigger's activities (recorded in the walkthrough).
