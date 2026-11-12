# Lead is created in Salesforce: Smoke scenarios

Approved by QA 2026-11-12. Script written, not run.

Environment: production (my.saleshandy.com), account `emailopenedprod`, Salesforce dev org `saleshandy-dev-ed`. Workflow ticket AL-4144 (parent AL-4131). Fixed ticket: AL-4224. This is a baseline of every activity plus the AL-4224 check, built from the 32 staging rows (`test-cases/salesforce/lead-created.md`, QA approved 2026-11-11). It has 11 checks and a gate. The workflow is not published on production yet, so QA runs it after the publish.

Not covered, still open: the first-run window (run-now cannot reset the cursor) and the real 3-hour cron. Also open: trigger off, a list that excludes a fresh Lead, a Lead with no Email and an existing prospect with another Job Title. Paused or Finished together with Move in one run is open too (two activities in one run do not both apply, QA 2026-11-11). Known and accepted: a second Lead on a listed domain makes "Blacklist Domains (Bulk)" error.

## Test data setup

- Each check has its own new Lead with a unique name and email `firstname.lastname.<tag>@mailinator.com`. Salesforce rejects look-alike Leads (DUPLICATES_DETECTED).
- The run uses run-now (`npm run sf:run-now`) on the production account. The run status comes from the run-now output. The Logs tab is not opened unless the prospect is missing after 3 minutes. QA then decides if it is a bug.
- Only "Lead is created in Salesforce" is on, with only the activities named in the check. Save in the modal and on the page. Read the saved activities back after a reload. If another trigger is on, the check stops before the run and nothing is sent.
- The gate runs first: Salesforce is connected and Field Mapping holds Company, Job Title and Phone Number for Lead.
- A setup spec makes the sequence "Salesforce Lead Created Smoke <date>". It has 4 steps and "Stop sending follow-ups if reply is received" off. The spec adds a listed sender with room in the daily limit and activates the sequence. It runs only with `SETUP_SMOKE_SEQUENCE=1`.
- The Salesforce org is shared with staging. A run reads every Lead in its window, not only yours. Before the Unsubscribed and Blacklist checks, the script counts the Leads created since the last run. If its own Lead is the only one, the check runs. If not, the check is skipped, not failed.
- Checks 6 to 10 need the prospect in the sequence first. A Move run puts it there (one send, step 1). The Move checks also run only when their own Lead is the only one in the window. Then the check runs alone with a second Lead that has the same email.
- Unsubscribed and Blacklist run last. Blacklist uses the domain `<run>.example.com` and removes it from the Do Not Contact list after.
- The last test turns "Lead is created in Salesforce" off, so the 3-hour cron does not import the org's Leads into the production account.

| # | Activity | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|---|
| 1 | Add Prospect, list dropdown (no run) | Trigger on, Add Prospect picked | Open Extra Configuration, open Select a list | The box opens and lists six views: All Open Leads, My Unread Leads, Today's Leads, View - Custom 2, View - Custom 1, Recently Viewed Leads | AL-4224 |
| 2 | Add Prospect (baseline) | New Lead "Siobhán O'Brien" with Company, Job Title, Phone. Select a list empty | Create the Lead, run now | Run COMPLETED. One prospect with First Name, Last Name, Company, Job Title, Phone Number, status Inactive | AL-4144 |
| 3 | Add Prospect with a list | New Lead created today. List = Today's Leads | Create the Lead, run now | Run COMPLETED. The step "Get Leads if List not provided" shows Skipped. Prospect has Company, Job Title, Phone Number | None |
| 4 | Move Prospect to another Sequence | New Lead. Only Move selected, smoke sequence, Step 1 | Create the Lead, run now | Prospect imported and in the smoke sequence, Step 1 | None |
| 5 | Assign a tag to Prospect | New Lead. Only Tag selected, tag TagA | Create the Lead, run now | Prospect imported and tagged TagA | None |
| 6 | Mark Prospect as Paused | Prospect already in the smoke sequence. Only Paused selected, 1 day | Create a Lead with that email, run now. Open the prospect, Activities section | Latest Status Paused. Activities reads "<name> has been paused for 1 days for sequence <sequence name>". A missing number of days is a bug | None |
| 7 | Mark Prospect as Resume(Un-pause) | Prospect paused in the smoke sequence. Only Resume selected | Create a Lead with that email, run now | Latest Status back to Active, not Paused | None |
| 8 | Mark Prospect as Replied | Prospect already in the smoke sequence. Only Replied selected | Create a Lead with that email, run now | Latest Status Replied (follow-ups are not stopped, so not Finished) | None |
| 9 | Mark Prospect as Finished | Prospect already in the smoke sequence. Only Finished selected | Create a Lead with that email, run now | Latest Status Finished | None |
| 10 | Mark Prospect as Unsubscribed | Prospect already in the smoke sequence. Only Unsubscribed selected. Window holds only this Lead | Create a Lead with that email, run now | Latest Status Unsubscribed | None |
| 11 | Blacklist a Domain | New Lead on `<run>.example.com`. Only Blacklist selected. Window holds only this Lead | Create the Lead, run now | Domain on the Do Not Contact list, no prospect imported. The run removes the domain after | None |

Sends: up to 6, one per Move run (check 4, and one each in checks 6 to 10). Each Move run adds a prospect to the active smoke sequence, and step 1 goes out under the sender limit. The script checks `SEND_CAP` before each Move run and does not change production settings.

Defaults taken without asking: the run status comes from the run-now output, not the Logs tab. Each of checks 6 to 10 uses a new prospect. If the account has no tag TagA, the modal creates it.

Script: tests/salesforce/lead-created-smoke.spec.ts, command: npm run smoke:salesforce-lead-created
