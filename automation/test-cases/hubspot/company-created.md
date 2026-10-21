# Company Created/Properties Updated in HubSpot: Regression scenarios

Environment: Staging (pyxis.lifeisgoodforlearner.com), account
dharmesh+companycreated. The workflow ticket is AL-4009. Only the Company
Created path is covered: contacts are associated while the company is
created. Every activity acts on all contacts associated with the company.

All 9 activities are covered with minimal data: 6 contacts reused across
runs, a new company for each row. Rows run in file order, because later
activities use the prospects created by earlier ones.

Not covered, still open: AL-4059 (updating company properties does not
trigger the workflow). The Properties Updated path is left out. Do not
treat these as failures.

## Test data setup

- 6 contacts from `test-data/hubspot/company-created.csv` (C1 to C6, all
  `@mailinator.com` as the data template requires), created one at a time
  through the HubSpot create contact form just before the row that first
  uses them. Companies per row are in `company-created-companies.csv`. CSV
  values are used as they are (no prefix).
- Each row creates a new company from the CSV and associates the listed
  contacts while creating it.
- Field mapping configured in Settings > Integrations > HubSpot (Company
  properties as in the workflow context).
- In Settings > Integrations > HubSpot > Triggers & Activities, enable only
  "Company Created/Properties Updated in HubSpot", select the row's
  activity, fill its Extra Configuration, then Save. Other triggers are left
  as they are (QA, 2026-10-15).
- Two Saleshandy sequences: Sequence A (where prospects are moved) and
  Sequence B (used only to check that a status is not applied).
- Logs: Settings > Integrations > HubSpot > Logs. Refresh 15 seconds after
  creating the company, then every 10 seconds until the new entry is Success.
- Prospect check: search each contact in the Saleshandy Prospects list.
- Run order (chain): Add Prospect > Move Prospect to Another
  sequence > Assign a tag > Paused > Resume > Replied > Finished >
  Unsubscribed > Blacklist a domain. Sections below follow the product UI
  order.

Not a valid scenario (QA, 2026-10-15): a company created with no associated
contact. The workflow fails for it, and adding a contact to the company later
does not trigger the workflow (that is a company property update, AL-4059).
The earlier "Trigger behavior (baseline)" row was removed.

## Add Prospect in Saleshandy

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | C1 not in Saleshandy | Create company with C1 | Success. C1 added as prospect | None |
| 2 | C2, C3, C4 not in Saleshandy | Create company with C2, C3, C4 | Success. All 3 added as prospects | None |
| 3 | C4 already a prospect, C5 and C6 not in Saleshandy | Create company with C4, C5, C6 | Success. C5 and C6 added, C4 not duplicated | None |

## Move Prospect to Another sequence in Saleshandy

Extra Configuration: Sequence = Sequence A, Sequence Steps = Step 1.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | C1 in no sequence | Create company with C1 | Success. C1 in Sequence A | None |
| 2 | C2, C3, C4 in no sequence | Create company with C2, C3, C4 | Success. All 3 in Sequence A | None |
| 3 | C5, C6 in no sequence | Create company with C5, C6 | Success. Both in Sequence A | None |

## Mark Prospect as unsubscribed in Saleshandy

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | C5, C6 in Sequence A | Create company with C5, C6 | Success. Both marked Unsubscribed | None |

## Mark prospect as Finished in Saleshandy

Extra Configuration: Sequence = Sequence A (row 2: Sequence B).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | C1 in Sequence A | Create company with C1 | Success. C1 marked Finished | None |
| 2 | Extra Configuration Sequence B, C4 in Sequence A only | Create company with C4 | Success. C4 status unchanged | None |

## Mark prospect as Replied in Saleshandy

Extra Configuration: Sequence = Sequence A (row 2: Sequence B).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | C2, C3 in Sequence A | Create company with C2, C3 | Success. Both Latest Status Finished (sequence stops follow-ups on reply; QA, 2026-10-15) | None |
| 2 | Extra Configuration Sequence B, C4 in Sequence A only | Create company with C4 | Success. C4 status unchanged | None |

## Mark Prospect as Paused in Saleshandy

Extra Configuration: Sequence = Sequence A (row 3: Sequence B), Pause Delay
in Days = value recorded in the walkthrough.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | C1 in Sequence A | Create company with C1 | Success. C1 marked Paused | None |
| 2 | C2, C3, C4 in Sequence A | Create company with C2, C3, C4 | Success. All 3 marked Paused | None |
| 3 | Extra Configuration Sequence B, C5 and C6 in Sequence A only | Create company with C5, C6 | Success. Both status unchanged | None |

## Mark prospect as Resume (Un-pause) in Saleshandy

Extra Configuration: Sequence = Sequence A.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | C1 Paused in Sequence A | Create company with C1 | Success. C1 resumed | None |
| 2 | C2, C3, C4 Paused in Sequence A | Create company with C2, C3, C4 | Success. All 3 resumed | None |

## Assign a tag to Prospect in Saleshandy

Extra Configuration: Tag = one tag, recorded in the walkthrough.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | C1 prospect in Saleshandy | Create company with C1 | Success. C1 has the tag | None |
| 2 | C2, C3, C4 prospects in Saleshandy | Create company with C2, C3, C4 | Success. All 3 have the tag | None |

## Blacklist a domain in Saleshandy

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | C4 in Sequence A | Create company with C4 | Success. mailinator.com on Do Not Contact list, C4 Latest Status Blacklisted. Spec removes mailinator.com from the list afterwards | None |

## Open questions

- How a HubSpot company maps to a Saleshandy prospect beyond contact
  association.
- Why the Company mapping screen shows contact fields (First name, Last
  name, Is B2B, and so on), and whether they can be removed.
