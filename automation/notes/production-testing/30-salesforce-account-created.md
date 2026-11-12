# Account is created in Salesforce: Smoke scenarios

Approved by QA 2026-11-12. Run on production 2026-11-12: 13 of 13 tests passed over two runs, 6 sends, trigger off.

Environment: production (my.saleshandy.com), account `emailopenedprod`, Salesforce dev org `saleshandy-dev-ed`. Workflow ticket AL-4143 (parent AL-4131). No fixed bug ticket known (the Jira links of AL-4143 did not load on 2026-11-12), so this is a baseline of every activity, built from the 28 staging rows (`test-cases/salesforce/account-created.md`). It has 12 checks and a gate. The workflow is not published on production yet, so QA runs it after the publish.

Not covered, still open: the real 3-hour cron, trigger off (run-now ignores the toggle) and the first-run window. Left out because Contact and Opportunity already cover them: accented names, empty Company, a Contact with no Email on an Account that has another Contact. Known and accepted: a second record on a listed domain makes "Blacklist Domains (Bulk)" error.

## Test data setup

- Each check has its own new Account and Contact. Emails are `firstname.lastname.<run stamp>@mailinator.com`. The workflow imports the Contacts of an Account, not the Account itself.
- The run uses run-now. The run status comes from the run-now output. The Logs tab is not opened. A prospect still missing after 3 minutes fails the check, and QA decides if it is a bug.
- Only "Account is created in Salesforce" is on, with only the activities named in the check. If another trigger is on, the check stops before it saves or runs, and nothing is sent.
- On production a run reads the Accounts created since its last run (proven 2026-11-12: the first run read 38 Accounts, the next run read only the 1 new Account). The staging version reads 3 hours. A status check acts on a prospect already in the sequence, so it creates a second Account with a Contact of the same email.
- The gate runs first: Salesforce is connected and Field Mapping holds the Contact pairs and the Account pairs. Fields that are not mapped are not asserted and are noted.
- A setup spec makes the sequence "Salesforce Account Created Smoke <date>". It has 4 steps and "Stop sending follow-ups if reply is received" off. It adds a listed sender and activates the sequence. It runs only with `SETUP_SMOKE_SEQUENCE=1`.
- Before a Move, Unsubscribed or Blacklist check, the script counts the Accounts created since the last run that the smoke did not create (no run stamp in the name). If there are none, the check runs. If there are some, the check is skipped, not failed, before anything is created or run. The start of the last run is kept in `test-data/salesforce/account-created-smoke-lastrun.txt`. (Changed twice on 2026-11-12: the approved wording skipped every check after the first, and the 3-hour version skipped 6 checks in the first run for Accounts that the run did not read.)
- Unsubscribed and Blacklist run last. Blacklist uses the domain `acc<run>.example.com`. After the check, every Do Not Contact entry that the run added is removed.
- The last test turns the Account trigger off, so the 3-hour cron does not import the org's Accounts into the production account.

| # | Activity | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|---|
| 1 | Activities list (no run) | Trigger on | Open Select | 9 activities in order: Add Prospect, Move, Unsubscribed, Finished, Replied, Paused, Resume, Tag, Blacklist. No "No Data" box, no "Select a list" field | None |
| 2 | Add Prospect (baseline) | A rep creates "Northwind Foods" with one Contact, Priya Nair, Procurement Manager, with phone and department | Create the Account and the Contact, run now | Run COMPLETED. One prospect with First Name, Last Name, Email, Phone Number, Job Title, Department, status Inactive | AL-4143 |
| 3 | Add Prospect | The Account has Website, Phone and Industry | Create the Account with those fields and its Contact, run now | Prospect has Company Website, Company Phone and Company Industry from the Account. A field that is not mapped is noted, not failed | None |
| 4 | Add Prospect | "Kestrel Logistics" has two Contacts, Rahul Mehta and Daniel Okafor | Create the Account and both Contacts, run now | One prospect per Contact, two in all | None |
| 5 | Add Prospect | An Account is created and no Contact is added yet | Create the Account only, run now | Run COMPLETED, no prospect, no error | None |
| 6 | Move Prospect to another Sequence | A new Account contact must start the smoke sequence | Create the Account and the Contact, run now | Prospect in the smoke sequence, Step 1 | None |
| 7 | Assign a tag to Prospect | New Account contact, tag TagA | Same | Prospect imported and tagged TagA | None |
| 8 | Mark Prospect as Paused | Contact already in the smoke sequence. Only Paused selected, 1 day | Create a second Account with a Contact of the same email, run now. Open the prospect, Activities section | Latest Status Paused. Activities reads "<name> has been paused for 1 days for sequence <sequence name>". A missing number of days is a bug | None |
| 9 | Mark Prospect as Resume(Un-pause) | Contact paused in the smoke sequence. Only Resume selected | Create a third Account with the same Contact email, run now | Latest Status Active, not Paused | None |
| 10 | Mark Prospect as Replied | Contact already in the smoke sequence. Only Replied selected | Create a second Account with the same Contact email, run now | Latest Status Replied (follow-ups are not stopped, so not Finished) | None |
| 11 | Mark Prospect as Finished | Contact already in the smoke sequence. Only Finished selected | Create a second Account with the same Contact email, run now | Latest Status Finished | None |
| 12 | Mark Prospect as Unsubscribed, then Blacklist a Domain | Contact already in the smoke sequence, only Unsubscribed selected. No other people's Accounts in the window. Then a new Account on `acc<run>.example.com`, only Blacklist selected | Create a second Account with the same Contact email, run now. Then create the new Account and Contact, run now | Latest Status Unsubscribed. Then the domain is on the Do Not Contact list and no prospect is imported. The run removes the domain after | None |

Sends: a Move run moves every Contact created since the last run, so the script counts one send for every such Contact not yet in the sequence (about 12 in all, not 6). The sequence is the one the Opportunity smoke made the same day (state file, 997965 on 2026-11-12, 3 of 4 steps, "Stop sending follow-ups" off, a sender, active), so no sequence is created. The Lead one has only 2 steps. The script checks `SEND_CAP` before each Move run and does not change production settings.

Defaults taken: run status from run-now, each status check uses a new prospect, the modal creates TagA if the account has none. Check 12 stays one row.

Script: tests/salesforce/account-created-smoke.spec.ts, command: npm run smoke:salesforce-account-created
