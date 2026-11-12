# Opportunity is created in Salesforce: Smoke scenarios

Approved by QA 2026-11-12. Production smoke run 2026-11-12: 13 of 13 passed, PRODUCTION APPROVED by QA.

Environment: production (my.saleshandy.com), account `emailopenedprod`, Salesforce dev org `saleshandy-dev-ed`. Workflow ticket AL-4142 (parent AL-4131). No fixed bug ticket: AL-4142 has no links, and AL-4168 and AL-4169 belong to Email Sent. This is a baseline of every activity, built from the 27 staging rows (`test-cases/salesforce/opportunity-created.md`, commit 992e7a1). It has 12 checks and a gate. QA says the workflow is published on production.

Not covered, still open: the first-run window (run-now cannot reset the cursor), the real 3-hour cron, trigger off, and the staging question why a second run 30 s later reads 0 records for a deal the first run read. Rows that repeat Contact behavior already tested on the same graph are left out (accented names, empty Company, a deal with no contact role or no Email).

## Test data setup

- Each check has its own new Contact and Opportunity. The Contact becomes the contact role. Emails are `firstname.lastname.<run stamp>@mailinator.com`. The workflow imports the contact roles of an Opportunity, not the Opportunity itself.
- The run uses run-now (`npm run sf:run-now` flow) on the production account. The run status comes from run-now. The Logs tab is not opened. A prospect still missing after 3 minutes fails the check and QA decides if it is a bug.
- Only "Opportunity is created in Salesforce" is on, with only the activities named in the check. If another trigger is on, the check stops before it saves or runs and nothing is sent.
- A run reads only deals created since its last run. A status check acts on a prospect already in the sequence, so it creates a second deal for the same Contact.
- The gate runs first: Salesforce is connected and Field Mapping holds the Contact and Opportunity pairs. Job Title, Phone Number and Department (Contact) and Deal Value (Opportunity) are read on the page. A field that is not mapped is not asserted and is noted. Check 3 is skipped when Deal Value is not mapped.
- A setup spec makes the sequence "Salesforce Opportunity Created Smoke <date>". It has 4 steps and "Stop sending follow-ups if reply is received" off. The spec adds a listed sender and activates the sequence. It runs only with `SETUP_SMOKE_SEQUENCE=1`.
- The Salesforce org is shared with staging. Before a Move, Unsubscribed or Blacklist check, the script counts the Opportunities created since the last run. If its own deal is the only one, the check runs. If not, the check is skipped, not failed.
- Unsubscribed and Blacklist run last. Blacklist uses the domain `opp<run>.example.com` and removes it from the Do Not Contact list after.
- The last test turns the Opportunity trigger off, so the 3-hour cron does not import the org's deals into the production account.

| # | Activity | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|---|
| 1 | Activities list (no run) | Trigger on | Open Select | 9 activities in order: Add Prospect, Move, Unsubscribed, Finished, Replied, Paused, Resume, Tag, Blacklist. No "No Data" box | None |
| 2 | Add Prospect (baseline) | A rep logs "Northwind Foods, 500 seats" for Priya Nair, Procurement Manager, with phone and department | Create the Contact and the Opportunity, run now | Run COMPLETED. One prospect with First Name, Last Name, Email, Phone Number, Job Title, Department, status Inactive | AL-4142 |
| 3 | Add Prospect | The deal has a Deal Value of 4321 | Same, new deal | Prospect has Deal Value 4321 | None |
| 4 | Add Prospect | The deal has two contact roles, Priya (primary) and Daniel Okafor | Create both Contacts and one Opportunity, run now | One prospect per Contact, two in all | None |
| 5 | Move Prospect to another Sequence | A new deal contact must start the smoke sequence | Create the Contact and the Opportunity, run now | Prospect in the smoke sequence | None |
| 6 | Assign a tag to Prospect | New deal contact, tag TagA | Same | Prospect imported and tagged TagA | None |
| 7 | Mark Prospect as Paused | Contact already in the smoke sequence. Only Paused selected, 1 day | Create a second deal for the Contact, run now. Open the prospect, Activities section | Latest Status Paused. Activities reads "<name> has been paused for 1 days for sequence <sequence name>". A missing number of days is a bug | None |
| 8 | Mark Prospect as Resume(Un-pause) | Contact paused in the smoke sequence. Only Resume selected | Create a third deal for the Contact, run now | Latest Status Active, not Paused | None |
| 9 | Mark Prospect as Replied | Contact already in the smoke sequence. Only Replied selected | Create a second deal, run now | Latest Status Replied (follow-ups are not stopped, so not Finished) | None |
| 10 | Mark Prospect as Finished | Contact already in the smoke sequence. Only Finished selected | Create a second deal, run now | Latest Status Finished | None |
| 11 | Mark Prospect as Unsubscribed | Contact already in the smoke sequence. Only Unsubscribed selected. Window holds only this deal | Create a second deal, run now | Latest Status Unsubscribed | None |
| 12 | Blacklist a Domain | New deal contact on `opp<run>.example.com`. Only Blacklist selected. Window holds only this deal | Create the Contact and the Opportunity, run now | Domain on the Do Not Contact list, no prospect imported. The run removes the domain after | None |

Sends: up to 6, one per Move run (checks 5, 7, 8, 9, 10, 11). Each Move run adds a prospect to the active smoke sequence, and step 1 goes out under the sender limit. The script checks `SEND_CAP` before each Move run and does not change production settings.

Defaults taken: the run status comes from run-now, not the Logs tab. Each status check uses a new prospect. If the account has no tag TagA, the modal creates it.

Script: tests/salesforce/opportunity-created-smoke.spec.ts, command: npm run smoke:salesforce-opportunity-created
