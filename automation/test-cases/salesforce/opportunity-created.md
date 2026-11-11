# Opportunity is created in Salesforce: Regression scenarios

Saved 2026-11-09 on QA's approval, 28 rows. QA 2026-11-11: Add Prospect 8 removed (a deal created days ago is not a "created" event for a real user), 27 rows. Base: saved Contact cases (same graph node for node) and the Opportunity dev log, v1 to v3.
Dev log = `integration-skills/test-logs/salesforce/opportunity-created-in-salesforce.md`. "(proposed, unconfirmed)" = no Opportunity evidence yet.

Environment: staging (pyxis), account `sflinkclicked` (idle, released), Salesforce org `saleshandy-dev-ed`. Workflow ticket AL-4142.
Each row creates a Contact and an Opportunity in Salesforce (REST). The Contact becomes the contact role. Then the row runs the workflow with run-now, finds the run in Logs by its id and checks the prospect in Saleshandy.
The workflow imports the contact roles of an Opportunity, not the Opportunity itself. It has no list. A run reads `FROM Opportunity WHERE CreatedDate>={{timestamp}} LIMIT 200` (seen in Logs on 2026-11-11). A run imports a deal when it first sees it. A second run 30 seconds later returned 0 records for the same deal, and an older deal is not imported. So a follow-up run only has something to act on when a new deal exists. The effect stays inside the `sflinkclicked` account. Nothing is written to Salesforce.

Not covered: the real 3-hour cron and "trigger off". Run-now ignores the toggle.
Also left out: rows that repeat Contact behavior already tested on the same graph. These are accented names, empty Company, Replied on a prospect already in Sequence A, and Unsubscribed on a prospect already in a sequence.

## Test data setup

- One new Contact and Opportunity per row, new email every run. Realistic names, companies and deal names.
- Field Mapping on `sflinkclicked`: Job Title, Phone Number, Department for Contact. Deal Value for Opportunity.
- Triggers & Activity: only "Opportunity is created in Salesforce" on. Lead, Contact and Account created off.
- Sequence A (3 to 4 steps, stops follow-ups on a reply) and Sequence B (keeps sending after a reply). Not checked yet on this account.
- Check only the row's own prospect (Saleshandy > Prospects, search by email).
- Run the Unsubscribed and Blacklist rows last. They also hit every prospect and domain imported earlier.
- After the Blacklist rows, remove the added domains from the Do Not Contact list.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | QA opens Field Mapping before the first run | Open `Settings > Integrations > Salesforce > Field Mapping` | Contact Properties and Opportunity Properties pairs are present | None |
| 2 | QA turns the trigger on with Add Prospect | Save, reload the page | `Configuration Updated Successfully`. Toggle and activity still saved | None |

## Activities list and Extra Configuration

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | QA opens the activity list | Open Select | 9 activities in order: Add Prospect, Move Prospect to another Sequence, Mark Prospect as Unsubscribed, Finished, Replied, Paused, Resume(Un-pause), Assign a tag to Prospect, Blacklist a Domain. No "No Data" box | None |
| 2 | QA opens each activity to fill its fields | Open its Extra Configuration | Add Prospect, Unsubscribed, Blacklist: no dialog. Move: Sequence, Sequence Steps. Finished, Replied, Resume: Sequence. Paused: Sequence, Pause Delay In Days. Tag: tag box. No "Select a list" field | None |

## Add Prospect in Saleshandy

Extra Configuration: none.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A rep logs the deal "Northwind Foods, 500 seats" for Priya Nair, Procurement Manager, with phone and department | Create the Contact and the Opportunity, run now | Run COMPLETED, Logs Success. One prospect with First Name, Last Name, Email, Phone Number, Job Title, Department | None |
| 2 | The 3-hour run fires again with no new Opportunity | Run now again | Still one prospect for Priya Nair | None |
| 3 | The deal has a Deal Value of 4321 | Create the Opportunity, run now | Prospect has Deal Value 4321 | None |
| 4 | The deal has two contact roles, Priya (primary) and Daniel Okafor | Create both Contacts and the Opportunity, run now | One prospect per Contact, two in all | None |
| 5 | A deal has no contact role | Create the Opportunity only, run now | Run COMPLETED, no prospect | None |
| 6 | The deal contact has no Email | Create the Contact and the Opportunity, run now | Run COMPLETED, no prospect for that Contact | None |
| 7 | Priya is already a prospect as "Buyer". Salesforce now holds her as "Procurement Manager" | Create a Contact with her email and the new Title, then an Opportunity, run now | Same prospect, Job Title updated (proposed, unconfirmed) | None |

## Move Prospect to another Sequence in Saleshandy

`Extra Configuration`: Sequence A, Step 1.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A new deal contact must start Sequence A | Create the Contact and the Opportunity, run now | Prospect imported and in Sequence A, Step 1 (proposed, unconfirmed) | None |

## Assign a tag to Prospect in Saleshandy

`Extra Configuration`: tag TagA.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A new deal contact must get the tag TagA | Create the Contact and the Opportunity, run now | Prospect imported and tagged TagA (proposed, unconfirmed) | None |
| 2 | The team selects Add Prospect, Move and Tag together | Create the Contact and the Opportunity, run now | Prospect in Sequence A and tagged TagA (proposed, unconfirmed) | None |

## Mark Prospect as Paused, Replied, Finished, Resume in Saleshandy

`Extra Configuration`: Sequence A, or Sequence B where the row says so. Paused also 1 day.
Sequence A stops follow-ups on a reply, so a Replied prospect ends Finished. Sequence B keeps sending, so a Replied prospect stays Replied.
Rows 1 to 4 pick Move together with the status, so the prospect is new in the sequence. Rows 5 to 8 pick only the status, so they act on a prospect already in the sequence.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A new deal contact is paused for 1 day after joining Sequence A | Create the Contact and the Opportunity, run now (Move and Paused) | Prospect in Sequence A. The Activities section says it was marked paused for 1 day (proposed, unconfirmed) | None |
| 2 | A new deal contact is finished right after joining Sequence A | Same, with Move and Finished | Latest Status Finished (proposed, unconfirmed) | None |
| 3 | A new deal contact is marked Replied after joining Sequence A | Same, with Move to Sequence A and Replied | Latest Status Finished, not Replied (proposed, unconfirmed) | None |
| 4 | A new deal contact is marked Replied after joining Sequence B | Same, with Move to Sequence B and Replied | Latest Status Replied (proposed, unconfirmed) | None |
| 5 | Priya is in Sequence A and the team pauses her | Create a second deal for Priya, run now (Paused) | Latest Status Paused | None |
| 6 | Priya is in Sequence A and the team finishes her | Create a second deal for Priya, run now (Finished) | Latest Status Finished | None |
| 7 | Daniel Okafor is in Sequence B and the team marks him Replied | Create a second deal for Daniel, run now (Sequence B, Replied) | Latest Status Replied | None |
| 8 | Priya is paused in Sequence A and the team resumes her | Create a second deal for Priya, run now (Paused). Create a third deal for her, run now (Resume) | Prospect is not paused | None |

## Mark Prospect as Unsubscribed in Saleshandy

`Extra Configuration`: none. Run after the sections above.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A new deal contact, Rahul Mehta at Kestrel Logistics, asked to stop emails | Create the Contact and the Opportunity, run now (Unsubscribed) | Prospect imported and marked unsubscribed, Latest Status Unsubscribed. The status text is proposed, unconfirmed, because Lead alone read Inactive | None |

## Blacklist a Domain in Saleshandy

`Extra Configuration`: none. Run at the end, after every other section. Domain `kestrellogistics.example`.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A company asks never to be contacted. A new deal contact uses its domain | Create the Contact and the Opportunity, run now (Blacklist) | Domain `kestrellogistics.example` on the Do Not Contact list. No prospect imported | None |
| 2 | The same run fires again | Run now again | Domain listed once, not twice (proposed, unconfirmed) | None |
| 3 | The team selects Blacklist and Add Prospect together | Create the Contact and the Opportunity, run now | Only the blacklist runs. No prospect imported and no other action runs | None |
| 4 | Two new deals have contacts on two different company domains | Create two Contacts and two Opportunities, run now (Blacklist) | Both domains are on the Do Not Contact list, once each | None |

## Row count

Baseline 2, Activities list 2, Add Prospect 7, Move 1, Tag 2, Paused/Replied/Finished/Resume 8, Unsubscribed 1, Blacklist 4. Total 27.
