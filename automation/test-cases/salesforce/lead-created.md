# Lead is created in Salesforce: Regression scenarios (QA looks good, 2026-11-09)

Approved by QA 2026-11-09. Add Prospect row 7 and the Restore section are not part of the cases.
Dev log = `integration-skills/test-logs/salesforce/lead-created-in-salesforce.md` (line numbers). "(proposed, unconfirmed)" = no dev evidence yet, being probed live.

Environment: staging (pyxis), account `sfreplyreceived`, Salesforce org `saleshandy-dev-ed`. Workflow ticket AL-4144.
Each row makes a Lead in Salesforce. Then it runs the workflow with run-now (`npm run sf:run-now`). Last, it finds the run in Logs by its id and checks the prospect in Saleshandy.

Not covered: first-run window (run-now cannot reset the cursor), the real 3-hour cron, trigger off (run-now ignores the off state), a list that excludes a fresh Lead (none found).
Paused rows 1 and 2 (new Lead, same run) are open: the observed result differs from the dev log, QA to say bug or not.

## Test data setup

- One new person per row, new email every run (Salesforce rejects look-alike Leads, DUPLICATES_DETECTED, dev log:159).
- Field Mapping on `sfreplyreceived`: Company, Job Title, Phone Number mapped for Lead.
- Triggers & Activity: only "Lead is created in Salesforce" on. Reply Received (Create a Lead), Contact, Opportunity and Account created off.
- Sequence A (1 step) and Sequence B (4 steps) exist and are active. Sequence B holds the Paused, Replied, Finished and Resume rows.
- Check only the row's own prospect (Saleshandy > Prospects, search by email).
- Before an Unsubscribe or Blacklist row, count the Leads created since the last run. The row runs only if its own Lead is the only one.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Field Mapping for Lead | Open Settings > Integrations > Salesforce > Field Mapping | Company, Job Title and Phone Number pairs are present | None |
| 3 | Trigger on, Add Prospect, Save | Reload the page | "Configuration Updated Successfully", toggle and activity still saved | None |

## Activities list and Extra Configuration

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger on | Open Select | 9 activities, in order: Add Prospect, Move Prospect to another Sequence, Mark Prospect as Unsubscribed, Finished, Replied, Paused, Resume(Un-pause), Assign a tag to Prospect, Blacklist a Domain | None |
| 2 | Each activity | Open its Extra Configuration | Add Prospect, Unsubscribed, Blacklist: Select a list. Move: Sequence, Sequence Steps, Select a list. Finished, Replied, Resume: Sequence, Select a list. Paused: also Pause Delay In Days. Tag: tag box, Select a list | None |
| 3 | Select a list open | Open the list | Six views: All Open Leads, My Unread Leads, Today's Leads, View - Custom 2, View - Custom 1, Recently Viewed Leads. Multi-select | None |
| 4 | Dialog saved with a pick | Save the dialog, Save the page, reopen the dialog | Saved list and values show | None |

## Add Prospect in Saleshandy

Extra Configuration: Select a list empty.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New Lead, person not in Saleshandy | Create the Lead, run now | Run COMPLETED, Logs Success, one prospect with First Name, Last Name, Company, Job Title, Phone Number, status Inactive (live 2026-11-09, dev log:160) | None |
| 2 | Same Lead, nothing new | Run now again | Still one prospect with that email (upsert, dev log:110) | None |
| 3 | Person already a prospect with another Job Title | Create the Lead, run now | Same prospect updated, Job Title from the Lead (live 2026-11-09, Job Title changed to the new value) | None |
| 4 | Lead with no Email | Create the Lead, run now | Run COMPLETED, no prospect for the Lead (dev log:136, :108) | None |
| 5 | Name with apostrophe and accent, "+" in the email | Create the Lead, run now | Prospect keeps name and email unchanged (dev log:136) | None |
| 6 | Lead Status Closed - Not Converted | Create the Lead, run now | Prospect created (live 2026-11-09) | None |

## Add Prospect with a list

Extra Configuration: Select a list = Today's Leads, unless the row says another.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Lead created today | Create the Lead, run now | Run COMPLETED. "Get Leads if List not provided" is Skipped. Prospect has Company, Job Title, Phone Number (live 2026-11-09) | None |
| 2 | Only View - Custom 1 picked | Create the Lead, run now | Prospect created (live 2026-11-09) | None |
| 4 | Two lists (All Open Leads, Today's Leads), Lead in both | Create the Lead, run now | One prospect, not two (live 2026-11-09) | None |
| 5 | Lead in the list, no Email | Create the Lead, run now | Run COMPLETED, no prospect for the Lead (dev log:136) | None |

## Move Prospect to another Sequence in Saleshandy

Extra Configuration: Sequence A, Step 1.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New Lead, only Move selected | Create the Lead, run now | Prospect imported and in Sequence A, Step 1 (dev log:138) | None |
| 2 | Move with list Today's Leads | Create the Lead, run now | Prospect in Sequence A (live 2026-11-09) | None |

## Assign a tag to Prospect in Saleshandy

Extra Configuration: tag TagA.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New Lead, only Tag selected | Create the Lead, run now | Prospect imported and tagged TagA (dev log:137) | None |
| 2 | Tag with list Today's Leads | Create the Lead, run now | Prospect tagged TagA (live 2026-11-09) | None |
| 3 | Add Prospect, Move and Tag together | Create the Lead, run now | Prospect in Sequence A and tagged TagA (live 2026-11-09) | None |

## Mark Prospect as Paused, Replied, Finished, Resume in Saleshandy

Extra Configuration: Sequence B (4 steps, active). Paused also 1 day. "Stop sending follow-ups if reply received" is off on the account.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | (Dropped, QA 2026-11-11) Paused, with Move selected, new Lead | - | Paused only works on a prospect already in the sequence; two activities in one run do not both apply. Row 4 covers Paused | None |
| 2 | Finished, with Move selected, new Lead | Create the Lead, run now | Latest Status Finished (dev log:144). Observed 2026-11-09: stays Active. Open, needs QA (bug or not) | None |
| 3 | Replied, with Move selected, new Lead | Create the Lead, run now | Latest Status Replied (observed 2026-11-09; the account does not stop follow-ups on a reply, so not Finished) | None |
| 4 | Prospect already in Sequence B, Paused selected | Create a Lead with that email, run now. Open the prospect, Activities section | Latest Status Paused. Activities reads "<name> has been paused for 1 days for sequence Sequence B". A missing number of days is a bug (confirmed 2026-11-09) | None |
| 5 | Prospect already in Sequence B, Finished selected | Create a Lead with that email, run now | Latest Status Finished (confirmed 2026-11-09, dev log:140) | None |
| 6 | Prospect already in Sequence B, Replied selected | Create a Lead with that email, run now | Latest Status Replied (confirmed 2026-11-09, dev log:141) | None |
| 7 | Prospect paused in Sequence B, Resume selected | Create a Lead with that email, run now | Latest Status back to Active, not Paused (confirmed 2026-11-09, dev log:139) | None |
| 8 | Prospect already in Sequence B, Paused with list Today's Leads | Create a Lead with that email, run now | Latest Status Paused (confirmed 2026-11-09) | None |

## Mark Prospect as Unsubscribed in Saleshandy

Extra Configuration: Select a list empty. Window check first.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Prospect already in Sequence B, Unsubscribed selected, window holds only this Lead | Move a Lead into Sequence B first. Then select only Unsubscribed, create a second Lead with the same email, run now | Latest Status Unsubscribed (two steps, QA 2026-11-11). With Move and Unsubscribed in one run the prospect ended Completed in Sequence A (2026-11-11) | None |
| 2 | Prospect already in Sequence B, Unsubscribed with list Today's Leads, window holds only this Lead | Move a Lead into Sequence B first. Then select only Unsubscribed with the list, create a second Lead with the same email, run now | Latest Status Unsubscribed (two steps, QA 2026-11-11) | None |

## Blacklist a Domain in Saleshandy

Extra Configuration: Select a list empty. Window check first. Domain `<run>.example.com`.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New Lead on a reserved test domain | Create the Lead, run now | Domain on the Do Not Contact list, no prospect imported. The row removes the domain after (dev log:163) | None |
| 2 | Second Lead on the same domain, run again | Create the Lead, run now | The run ends in error at "Blacklist Domains (Bulk)": the domain is already on the Do Not Contact list (400 "Inserted email or domain already exist in this list"). The domain stays listed once (QA, 2026-11-11) | None |
