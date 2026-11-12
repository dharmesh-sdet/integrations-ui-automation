# Account is created in Salesforce: Regression scenarios

Saved 2026-11-09 on QA approval, 29 rows. Base: saved Opportunity and Contact cases (same graph, node for node) and the Account dev log, v1 to v3.
Dev log = `integration-skills/test-logs/salesforce/account-created-in-salesforce.md`. "(proposed, unconfirmed)" = no Account evidence yet.

Environment: staging (pyxis), account `sfemailsent` (idle, released), Salesforce org `saleshandy-dev-ed`. Workflow ticket AL-4143.
Each row creates an Account and its Contacts in Salesforce (REST). Then the row runs the workflow with run-now, finds the run in Logs by its id and checks the prospect in Saleshandy.
The workflow imports the Contacts of an Account, not the Account itself, because an Account has no email. It has no list. Every run reads up to 200 Accounts created in the last 3 hours (Refold run, 2026-11-12: `FROM Account WHERE CreatedDate>={{timestamp}} LIMIT 200`, the timestamp is 3 hours before the run starts). It also acts on Accounts that earlier rows made in that window. Accounts older than 3 hours are never read. The dev log A4 (whole org) is contradicted. The effect stays inside the `sfemailsent` account. Nothing is written to Salesforce.
Size of the org (read-only SOQL, 2026-11-12): 47 Contacts with an email on an Account. 25 sit on Accounts older than 63 hours and are never read. 22 are test people made by earlier rows within the last hour, and a run reads those again. Before each Unsubscribed and Blacklist row, the spec checks the read set (Accounts of the last 4 hours). It stops only for a person that no test made.
Workflow version: the Saleshandy UI runs `681368981acc0cbcd16295c9`. The developer API tests ran a copy, `682d72d0bcc93496f8906354`. If a result differs from Expected, the cause can be a version difference. Say so in the bug report.

Not covered: the real 3-hour cron and "trigger off". Run-now ignores the toggle.
Also left out: rows that repeat Contact behavior already tested on the same graph. These are accented names, empty Company, Replied on a prospect already in Sequence A, and Unsubscribed on a prospect already in a sequence. Also left out: a Contact added to an Account after its run (Contact is created covers it).

## Test data setup

- One new Account per row with new Contact emails every run. Realistic names, companies and industries.
- Field Mapping on `sfemailsent`: Contact Properties (Phone Number, Department, Job Title) and Account Properties (Company, Website, Industry, Phone). Job Title is not mapped by default on Contact Properties. Map it and check after a reload.
- Triggers & Activity: only "Account is created in Salesforce" on. Lead, Contact and Opportunity created off.
- Sequence A (2 steps, stops follow-ups on a reply, id 197850) and Sequence B (4 steps, keeps sending after a reply, id 197851). Made by QA 2026-11-12, both active, switches checked.
- Job Title to Title on Contact Properties was set on `sfemailsent` 2026-11-12 (the first run failed Trigger behavior 1 because it was missing).
- Check only the row's own prospects (Saleshandy > Prospects, search by email).
- Run the Unsubscribed and Blacklist rows last. They also hit every prospect and domain imported earlier.
- Before the Tag and Move rows, add the org's own Contacts (on Accounts older than 4 hours) to the `sfemailsent` Do Not Contact list. A run never reads them, so this is a safety margin only. Do this on `sfemailsent` only.
- Before each Unsubscribed and Blacklist row, the spec reads the Contacts that the run will read: Contacts of Accounts created in the last 4 hours. Test people (an 8-character run stamp in the email) are known. A person that no test made stops the row.
- After the Blacklist rows, remove the added domains from the Do Not Contact list. In the last step, remove the org's own emails too and turn the trigger off.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | QA opens Field Mapping before the first run | Open `Settings > Integrations > Salesforce > Field Mapping` | Contact Properties and Account Properties pairs are present | None |
| 2 | QA turns the trigger on with Add Prospect | Save, reload the page | `Configuration Updated Successfully`. Toggle and activity still saved | None |
| 3 | QA checks the org size before the first run, because a run reads up to 200 Accounts | Count the Accounts in Salesforce | 200 or fewer (134 on 2026-11-09), so a new Account is inside the read. Only Accounts of the last 3 hours are read | None |

## Activities list and Extra Configuration

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | QA opens the activity list | Open Select | 9 activities in order: Add Prospect, Move Prospect to another Sequence, Mark Prospect as Unsubscribed, Finished, Replied, Paused, Resume(Un-pause), Assign a tag to Prospect, Blacklist a Domain. No "No Data" box | None |
| 2 | QA opens each activity to fill its fields | Open its Extra Configuration | Add Prospect, Unsubscribed, Blacklist: no dialog. Move: Sequence, Sequence Steps. Finished, Replied, Resume: Sequence. Paused: Sequence, Pause Delay In Days. Tag: tag box. No "Select a list" field | None |

## Add Prospect in Saleshandy

Extra Configuration: none.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A rep creates the Account "Northwind Foods" with one Contact, Priya Nair, Procurement Manager, with phone and department | Create the Account and the Contact, run now | Run COMPLETED, Logs Success. One prospect with First Name, Last Name, Email, Phone Number, Job Title, Department | None |
| 2 | The 3-hour run fires again with no new Account | Run now again | Still one prospect for Priya Nair (upsert) | None |
| 3 | The Account "Kestrel Logistics" has two Contacts, Rahul Mehta and Daniel Okafor | Create the Account and both Contacts, run now | One prospect per Contact, two in all (dev log I1) | None |
| 4 | An Account is created and no Contact is added yet | Create the Account only, run now | Run COMPLETED, no prospect, no error (dev log I2) | None |
| 5 | The Account has two Contacts and one has no Email | Create the Account and both Contacts, run now | Prospect for the Contact with Email only. The other is skipped and the run still completes (dev log I3) | None |
| 6 | The Account has Website, Phone and Industry. Its Contact has Department and Job Title | Create the Account with those fields and the Contact, run now | Prospect has Company Website, Company Phone and Company Industry from the Account, and Department and Job Title from the Contact (dev log M2). If Company is mapped, Company holds the Account Name (proposed, unconfirmed on this version) | None |
| 7 | The org already holds Accounts older than 3 hours with Contacts that have an email, created before this test | Run now | Those Contacts are not imported, because the run reads only Accounts of the last 3 hours (Refold run, 2026-11-12). The spec checks a sample of 5 | None |
| 8 | Priya is already a prospect as "Buyer". Salesforce now holds her as "Procurement Manager" | Create an Account and a Contact with her email and the new Title, run now | Same prospect, Job Title updated (proposed, unconfirmed) | None |

## Move Prospect to another Sequence in Saleshandy

`Extra Configuration`: Sequence A, Step 1.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A new Account contact must start Sequence A | Create the Account and the Contact, run now | Prospect imported and in Sequence A, Step 1 (proposed, unconfirmed) | None |

## Assign a tag to Prospect in Saleshandy

`Extra Configuration`: tag TagA.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A new Account contact must get the tag TagA | Create the Account and the Contact, run now | Prospect imported and tagged TagA (proposed, unconfirmed) | None |
| 2 | The team selects Add Prospect, Move and Tag together | Create the Account and the Contact, run now | Prospect in Sequence A and tagged TagA (proposed, unconfirmed) | None |

## Mark Prospect as Paused, Replied, Finished, Resume in Saleshandy

`Extra Configuration`: Sequence A, or Sequence B where the row says so. Paused also 1 day.
Sequence A stops follow-ups on a reply, so a Replied prospect ends Finished. Sequence B keeps sending, so a Replied prospect stays Replied.
Rows 2 to 4 pick Move together with the status, so the prospect is new in the sequence. Rows 5 to 8 pick only the status, so they act on a prospect already in the sequence. Row 1 is dropped (2026-11-12). When two activities run together, only the first applies. Paused needs a prospect already in the sequence, as in Lead Paused 1. Rows 5 and 8 cover Paused.
Rows 5 to 8 first make a new Account with a Contact of the same email, then run now again. Lead and Opportunity read only records created since the last run (staging, 2026-11-11), so a follow-up run needs a record created after the first run. Account is not checked, and the new Account works either way.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 2 | A new Account contact is finished right after joining Sequence A | Same, with Move and Finished | Latest Status Finished (proposed, unconfirmed) | None |
| 3 | A new Account contact is marked Replied after joining Sequence A | Same, with Move to Sequence A and Replied | Latest Status Finished, not Replied (proposed, unconfirmed) | None |
| 4 | A new Account contact is marked Replied after joining Sequence B | Same, with Move to Sequence B and Replied | Latest Status Replied (proposed, unconfirmed) | None |
| 5 | Priya is in Sequence A and the team pauses her | New Account with the same Contact, run now again (Paused) | Latest Status Paused. The Activities section says the prospect was paused for 1 days for the sequence (two spaces before the sequence name on the page) | None |
| 6 | Priya is in Sequence A and the team finishes her | New Account with the same Contact, run now again (Finished) | Latest Status Finished | None |
| 7 | Daniel Okafor is in Sequence B and the team marks him Replied | New Account with the same Contact, run now again (Sequence B, Replied) | Latest Status Replied | None |
| 8 | Priya is paused in Sequence A and the team resumes her | New Account with the same Contact before each run: pause run, then resume run | Prospect is not paused | None |

## Mark Prospect as Unsubscribed in Saleshandy

`Extra Configuration`: none. Run after the sections above.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A new Account contact, Rahul Mehta at Kestrel Logistics, is in Sequence B and then asks to stop emails | Create the Account and the Contact, run now (Move to Sequence B). Then make a new Account with the same Contact and run now again (Unsubscribed alone) | Latest Status Unsubscribed. Two steps, because Unsubscribed needs a prospect already in a sequence (Lead Unsubscribed 1 and 2, QA 2026-11-11) | None |

## Blacklist a Domain in Saleshandy

`Extra Configuration`: none. Run at the end, after every other section. Domain `kestrellogistics.example`.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A company asks never to be contacted. A new Account contact uses its domain | Create the Account and the Contact, run now (Blacklist) | Domain `kestrellogistics.example` on the Do Not Contact list. No prospect imported | None |
| 2 | A second Account contact uses a domain that is already listed | Make a new Account with a Contact on the same domain, run now again | Domain listed once, not twice. The second run can end ERRORED at "Blacklist Domains (Bulk)" (Lead did: 400 "Inserted email or domain already exist in this list", QA 2026-11-11). The spec records which of the two happened (proposed, unconfirmed) | None |
| 3 | The team selects Blacklist and Add Prospect together | Create the Account and the Contact, run now | Only the blacklist runs. No prospect imported and no other action runs | None |
| 4 | Two new Accounts, each with a Contact on its own company domain, `kestrellogistics.example` and `harborfreight.example` | Create both Accounts and Contacts, run now (Blacklist) | Both domains are on the Do Not Contact list, once each. Rewritten 2026-11-12: the first version expected every domain of older Accounts, but a run listed only the new Account's domain | None |

## Row count

Baseline 3, Activities list 2, Add Prospect 8 (7 asserts "not imported"), Move 1, Tag 2, Paused/Replied/Finished/Resume 7 (row 1 dropped), Unsubscribed 1, Blacklist 4. Total 28.
