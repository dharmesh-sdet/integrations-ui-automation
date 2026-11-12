# Contact is created in Salesforce: Smoke scenarios

Approved by QA 2026-11-12. Released and production approved by QA 2026-11-12, live. Run 2026-11-12 on production: 11 of 11 checks passed at least once (Smoke 2 and 3 on a rerun).

Environment: production (my.saleshandy.com), account `emailopenedprod`, Salesforce dev org `saleshandy-dev-ed`. Workflow ticket AL-4141 (parent AL-4131). AL-4141 has no linked bug, so this is a baseline built from the 30 staging rows (`test-cases/salesforce/contact-created.md`, commit 66dc4fe). It has 11 checks, a gate and a last test that turns the trigger off. QA says the workflow is published on production.

Not covered, still open: the first-run window (run-now cannot reset the cursor), the real 3-hour cron, a Contact with no Email (the run ERRORS at "Loop on Contacts", QA: expected), accented names and the Company row (Company is not mapped).

## Test data setup

- Each check has its own new Contact with email `firstname.lastname.<run stamp>@mailinator.com`. Phone goes in the Salesforce Phone field (Business Phone).
- The run uses run-now (`npm run sf:run-now` flow) on the production account. The run status comes from run-now. The Logs tab is not opened. If a prospect is still missing after 3 minutes, the check fails and QA decides if it is a bug.
- Only "Contact is created in Salesforce" is on, with only the activities named in the check. If another trigger is on, the check stops before it saves or runs and nothing is sent.
- A run reads only Contacts created since its last run. A status check acts on a prospect already in the sequence, so it creates a second Contact with the same email.
- The gate runs first: Salesforce is connected and Field Mapping holds Phone Number and Department for Contact. The script reads Job Title on the page. If Job Title is unmapped, the script does not assert it.
- A setup spec makes the sequence "Salesforce Contact Created Smoke <date>". The sequence has 4 steps, and the setting "Stop sending follow-ups if reply is received" is off. The spec adds a listed sender and activates the sequence. It runs only with `SETUP_SMOKE_SEQUENCE=1`. If the Lead, Opportunity or Account smoke already made today's sequence, the runner uses that one and skips the setup spec (peer request 2026-11-12). Each smoke uses its own Contacts, but all share the daily `SEND_CAP` and the sender limit.
- The Contact smoke runs alone, one smoke at a time (QA 2026-11-12). Before Move, Unsubscribed and Blacklist, the script counts the Contacts created since the last run. If its own Contact is the only one, the check runs. If not, the check is skipped, not failed. A no-Email Contact in the window makes the run ERROR, so that also skips the check.
- Unsubscribed and Blacklist run last. Blacklist uses the domain `contact<run>.example.com` and removes it from the Do Not Contact list after.
- The last test turns the Contact trigger off, so the 3-hour cron does not import the org's Contacts into the production account.

| # | Activity | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|---|
| 1 | Activities list (no run) | Trigger on | Open Select | 9 activities in order: Add Prospect, Move, Unsubscribed, Finished, Replied, Paused, Resume, Tag, Blacklist. No "No Data" box, no "Select a list" field | None |
| 2 | Add Prospect (baseline) | A rep adds Priya Nair, Procurement Manager at Northwind Foods, with phone and department | Create the Contact, run now | Run COMPLETED. One prospect with First Name, Last Name, Email, Phone Number, Department, status Inactive | AL-4141 |
| 3 | Add Prospect | A rep saves a Contact with Last Name only (Solanki) | Create the Contact, run now | Prospect created with Last Name Solanki, First Name empty | None |
| 4 | Move Prospect to another Sequence | A new Contact must start the smoke sequence | Create the Contact, run now | Prospect in the smoke sequence | None |
| 5 | Assign a tag to Prospect | New Contact, tag TagA | Create the Contact, run now | Prospect imported and tagged TagA | None |
| 6 | Mark Prospect as Paused | Contact already in the smoke sequence. Only Paused selected, 1 day | Create a second Contact with the same email, run now | Latest Status Paused. Activities reads `<name> has been paused for 1 days for sequence <sequence name>` | None |
| 7 | Mark Prospect as Resume(Un-pause) | Contact paused in the smoke sequence. Only Resume selected | Create a third Contact with the same email, run now | Latest Status Active, not Paused | None |
| 8 | Mark Prospect as Replied | Contact already in the smoke sequence. Only Replied selected | Create a second Contact with the same email, run now | Latest Status Replied (follow-ups are not stopped, so not Finished) | None |
| 9 | Mark Prospect as Finished | Contact already in the smoke sequence. Only Finished selected | Create a second Contact with the same email, run now | Latest Status Finished | None |
| 10 | Mark Prospect as Unsubscribed | Contact already in the smoke sequence. Only Unsubscribed selected. Window holds only this Contact | Create a second Contact with the same email, run now | Latest Status Unsubscribed | None |
| 11 | Blacklist a Domain | New Contact on `contact<run>.example.com`. Only Blacklist selected. Window holds only this Contact | Create the Contact, run now | Domain on the Do Not Contact list, no prospect imported. The script removes the domain after | None |

Sends: up to 6, one per Move run (checks 4, 6, 7, 8, 9, 10). Each Move run adds a prospect to the active smoke sequence, and step 1 goes out under the sender limit. The script checks `SEND_CAP` before each Move run and does not change production settings.

Script: tests/salesforce/contact-created-smoke.spec.ts, command: npm run smoke:salesforce-contact-created
