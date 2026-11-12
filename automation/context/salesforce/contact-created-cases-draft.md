# Contact is created in Salesforce: Regression scenarios (DRAFT v2, not saved to test-cases, waits for QA's "looks good")

Draft 2026-11-09, v2. QA 2026-11-09: realistic scenarios only, and Unsubscribed and Blacklist get run rows.
Dev log = `integration-skills/test-logs/salesforce/contact-created-in-salesforce.md` (line numbers). "(proposed, unconfirmed)" = no Contact evidence yet.

Environment: staging (pyxis), account `sfreplyreceived`, Salesforce org `saleshandy-dev-ed`. Workflow ticket AL-4141.
Each row creates a Contact in Salesforce and runs the workflow with run-now (`npm run sf:run-now`). Then it finds the run in Logs by its id and checks the prospect in Saleshandy.
Contact has no cursor and no list. Every run reads up to 200 Contacts of the org (dev log:81, :84). So every run also acts on the other Contacts already in the org. The effect stays inside the `sfreplyreceived` Saleshandy account. Nothing is written to Salesforce.

Not covered: the real 3-hour cron, "trigger off" (run-now ignores the toggle, seen on Lead).

## Test data setup

- One new person per row, new email every run. Realistic names and companies.
- Field Mapping on `sfreplyreceived`: Job Title, Phone Number, Department mapped for Contact.
- Triggers & Activity: only "Contact is created in Salesforce" on. Lead, Opportunity, Account created and Reply Received (Create a Lead) off.
- Sequence rows: Sequence A (3 to 4 steps) and Sequence B exist and are paused before the run.
- Check only the row's own prospect (Saleshandy > Prospects, search by email).
- After the Blacklist rows, remove the added domains from the Do Not Contact list.
- Run the Unsubscribed and Blacklist rows last. They also hit every earlier imported prospect and domain of the account.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | QA opens Field Mapping before the first run | Open Settings > Integrations > Salesforce > Field Mapping | Job Title, Phone Number and Department pairs are present (dev log:9) | None |
| 2 | QA turns the trigger on with Add Prospect | Save, reload the page | "Configuration Updated Successfully". Toggle and activity still saved | None |

## Activities list and Extra Configuration

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | QA opens the activity list | Open Select | 9 activities in order: Add Prospect, Move Prospect to another Sequence, Mark Prospect as Unsubscribed, Finished, Replied, Paused, Resume(Un-pause), Assign a tag to Prospect, Blacklist a Domain. No "No Data" box | None |
| 2 | QA opens each activity to fill its settings | Open its Extra Configuration | Add Prospect, Unsubscribed, Blacklist: no dialog. Move: Sequence, Sequence Steps. Finished, Replied, Resume: Sequence. Paused: Sequence, Pause Delay In Days. Tag: tag box. No "Select a list" field | None |

## Add Prospect in Saleshandy

Extra Configuration: none.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A rep adds Priya Nair, Procurement Manager at Northwind Foods, with phone and department | Create the Contact, run now | Run COMPLETED, Logs Success, one prospect with First Name, Last Name, Email, Phone Number, Job Title, Department (field check pending in the dev log) | None |
| 2 | The 3-hour run fires again with no new Contact | Run now again | Still one prospect for Priya Nair (upsert, dev log:93) | None |
| 3 | A Contact was created in Salesforce days ago and was never imported | Run now | That Contact is imported too, because the run reads the whole org (dev log:84, :109) | None |
| 4 | Priya is already a prospect as "Buyer". Salesforce now holds her as "Procurement Manager" | Create a Contact with her email and the new Title, run now | Same prospect, Job Title updated (proposed, unconfirmed, Lead behaved so) | None |
| 5 | A rep saves a Contact with Last Name only (Solanki, no first name) | Create the Contact, run now | Prospect created with Last Name Solanki, First Name empty (dev log:61, :99) | None |
| 6 | Contacts named Anna Van Dyke and Sean O'Connor-Müller | Create both, run now | Names kept in full: Last Name "Van Dyke" and "O'Connor-Müller" (dev log:62, :99) | None |
| 7 | A rep saves a phone-only Contact with no Email | Create the Contact, run now | Run COMPLETED, no prospect for it (dev kit: no email, skipped) | None |
| 8 | Contact linked to the Account "Northwind Foods" | Create the Contact, run now | (proposed, unconfirmed) Company stays empty, because the query has no Account.Name (dev log:109) | None |

## Move Prospect to another Sequence in Saleshandy

Extra Configuration: Sequence A, Step 1. Sequences paused.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A new Contact must start Sequence A | Create the Contact, run now | (proposed, unconfirmed) Prospect imported and in Sequence A, Step 1 | None |

## Assign a tag to Prospect in Saleshandy

Extra Configuration: tag TagA.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A new Contact must get the tag TagA | Create the Contact, run now | (proposed, unconfirmed) Prospect imported and tagged TagA | None |
| 2 | Team selects Add Prospect, Move and Tag together | Create the Contact, run now | (proposed, unconfirmed) Prospect in Sequence A and tagged TagA | None |

## Mark Prospect as Paused, Replied, Finished, Resume in Saleshandy

Extra Configuration: Sequence A (or Sequence B where the row says so). Paused also 1 day.
Sequence A has "Stop sending follow-ups if a reply is received" ON, so a Replied prospect ends Finished (QA 2026-11-09).
Sequence B has it OFF, so a Replied prospect keeps the status Replied (QA 2026-11-09).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A new Contact is paused for 1 day after joining Sequence A | Create the Contact, run now (Move and Paused selected) | (proposed, unconfirmed) Prospect in Sequence A. Activities section says it was marked paused for 1 day | None |
| 2 | A new Contact is finished right after joining Sequence A | Create the Contact, run now (Move and Finished selected) | (proposed, unconfirmed) Latest Status Finished | None |
| 3 | A new Contact is marked Replied after joining Sequence A | Create the Contact, run now (Move to Sequence A and Replied selected) | (proposed, unconfirmed) Latest Status Finished, not Replied, because Sequence A stops follow-ups on a reply | None |
| 4 | A new Contact is marked Replied after joining Sequence B | Create the Contact, run now (Move to Sequence B and Replied selected) | (proposed, unconfirmed) Latest Status Replied, because Sequence B keeps sending after a reply | None |
| 5 | Priya is in Sequence A and the team pauses her | Run now again with her Contact (Paused selected) | Latest Status Paused (dev log:68) | None |
| 6 | Priya is in Sequence A and the team finishes her | Run now again with her Contact (Finished selected) | Latest Status Finished (dev log:69) | None |
| 7 | Priya is in Sequence A and the team marks her Replied | Run now again with her Contact (Replied selected) | Latest Status Finished, because Sequence A stops follow-ups on a reply | None |
| 8 | Daniel Okafor is in Sequence B and the team marks him Replied | Run now again with his Contact (Sequence B, Replied selected) | Latest Status Replied | None |
| 9 | Priya is paused in Sequence A and the team resumes her | Run now again with her Contact (Resume selected) | Prospect is not paused (dev log:71, :101) | None |

## Mark Prospect as Unsubscribed in Saleshandy

Extra Configuration: none. Run last.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A new Contact, Rahul Mehta at Kestrel Logistics, asked to stop emails | Create the Contact, run now (Unsubscribed selected) | Prospect imported and marked unsubscribed, Latest Status Unsubscribed (dev log:102). The status text is proposed, unconfirmed, because Lead alone read Inactive | None |
| 2 | Priya is in Sequence A and asks to be removed | Run now again with her Contact (Unsubscribed selected) | Latest Status Unsubscribed (Lead live 2026-11-09, proposed, unconfirmed on Contact) | None |
| 3 | Run reads the whole org | Check the other prospects imported earlier | They are marked unsubscribed too, because the run applies the action to every Contact it reads (dev kit) | None |

## Blacklist a Domain in Saleshandy

Extra Configuration: none. Run last. Domain `kestrellogistics.example`.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | A company asks never to be contacted. A new Contact uses its domain | Create the Contact, run now (Blacklist selected) | Domain `kestrellogistics.example` on the Do Not Contact list. No prospect imported for the Contact (dev log:72, :117-120) | None |
| 2 | The same run fires again | Run now again | Domain listed once, not twice (proposed, unconfirmed) | None |
| 3 | Team selects Blacklist and Add Prospect together | Create the Contact, run now | Only the blacklist runs. No prospect is imported and no other action runs (dev log:45, :120) | None |
| 4 | Org already holds Contacts at gmail.com and saleshandy.com | Check the Do Not Contact list after the run | Every domain of the Contacts read is listed once, not only the new one (dev log:29, :122) | None |
