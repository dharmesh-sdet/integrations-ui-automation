# Prospect Outcome is updated in Saleshandy (Salesforce): Smoke scenarios

Approved by QA 2026-10-22. Script written, not run yet.

Environment: Production (my.saleshandy.com), account `emailopenedprod`, Salesforce dev org
`saleshandy-dev-ed`. Workflow ticket AL-4134 (parent AL-4131). No bug ticket exists for this
trigger, so this is a baseline check of every activity on Production, not a fix confirmation.
Built from the Prospect Outcome Updated staging regression
(`test-cases/salesforce/prospect-outcome-updated.md`), which QA signed off as passed on
2026-10-22. 10 checks: one matching-outcome row per activity (Attach Note rides on Create a Contact row 1, 9 rows)
and one non-matching row on Create a Contact. 10 sends, one per prospect.

Not covered, still open: an outcome set by an email reply, custom outcomes, a second sequence,
Closing date other than 1 Day, special characters.

If a row fails on Production, QA decides if it is a bug. Draft only, no Jira write from the script.

## Test data setup

- Own brand-new Mailinator prospect per row (unique name and email), added to the smoke
  sequence, step 1 sent with Emails tab > row > three dots > Send now, and shown as Sent before the
  outcome changes. The prospect starts at "Add Outcome". 10 sends in all, under the daily cap
  (SEND_CAP default 40). Read the Email Accounts page before sizing sends.
- Records a row needs first (Account, Contact, Lead, Opportunity) are created by hand in
  Salesforce with the prospect's email (Company name for Account), with at least one value that
  differs from the prospect's. Existing Salesforce records are never edited.
- The outcome is changed in Sequence > the sequence > Prospects, with the outcome dropdown.
- Matching rows: wait 15 s, look in Salesforce, then poll up to 3 min. If missing, hard refresh and
  look again. Only then open Logs. Error in Logs is reported to QA, not failed.
- Non-matching row: wait 3 min, Logs refreshed 15 s after the change and then every 10 s. A Logs
  row is allowed and its status is recorded; the check is that nothing was created in Salesforce.
- Triggers: "Prospect Outcome is updated in Saleshandy" on, with only the row's activities, then
  Save in the modal and on the page. Other triggers are left as found (QA, 2026-10-22). Risk: one
  that is on can fire on the same prospect; the script reads and reports the trigger states first.
  Do not run at the same time as another smoke run on `emailopenedprod`.
- Field mapping: checked and fixed by the same gate as note 07 (Lead, Contact, Account,
  Opportunity lists in `07-salesforce-email-sent.md`).

## Gate check (runs first, in the same command)

Same gate as `07-salesforce-email-sent.md`: open the saved session, go to API & Integrations >
Integrations > Salesforce. If the tab shows Re-connect: stop, no rows run, QA is notified. If
connected: compare Field Mapping for the four objects, add every missing mapping, Save, reload,
compare again. The gate passes only when all four objects match after the reload.

## Sequence setup (runs after the gate, same command)

- Create a new sequence "Salesforce Prospect Outcome Smoke <date>" with one email step.
- Settings > Email Account > add the production email accounts, then activate the sequence.
- Run again the same day, the same sequence is reused.

## Create a Account in Salesforce

Extra Configuration: Select Outcome = Uncategorized.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with a Company, no Account for it | Change outcome to Uncategorized | One more Account with Account Name = the prospect's Company, Billing City = the prospect's City | None |

## Update a Account in Salesforce

Extra Configuration: Select Outcome = Interested.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Account named after the prospect's Company exists with an old Billing City | Change outcome to Interested | The Account shows the prospect's City as Billing City, no new Account | None |

## Create a Contact in Salesforce

Extra Configuration: Select Outcome = Not Interested.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with all mapped fields, no Contact in Salesforce | Change outcome to Not Interested | Exactly one Contact with Name, Email, Business Phone, Department and Other City matching the prospect, and no Lead created | None |
| 2 | Same setup, outcome not matching | Change outcome to Meeting Booked | No Contact and no Lead in Salesforce. Logs row, if any, is recorded | None |

## Update a Contact in Salesforce

Extra Configuration: Select Outcome = Meeting Booked.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact with the prospect's email exists with no Department and no Business Phone | Change outcome to Meeting Booked | The same Contact shows the prospect's Department, Business Phone and Other City, still one Contact | None |

## Create a Lead in Salesforce

Extra Configuration: Select Outcome = Out of Office.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with all mapped fields, no Lead in Salesforce | Change outcome to Out of Office | Exactly one Lead with the prospect's Name, Email, Company, Title, Phone and City | None |

## Update a Lead in Salesforce

Extra Configuration: Select Outcome = Closed.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Lead with the prospect's email exists with an old Title, Phone and Company | Change outcome to Closed | The same Lead shows the prospect's Title and Phone, still one Lead | None |

## Create a Opportunity in Salesforce

Extra Configuration: Closing date = 1 Day, Opportunity Stage = Prospecting, Select Outcome = Not Now.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with a Deal Value, no Opportunity | Change outcome to Not Now | One Opportunity named with the prospect's email, Stage Prospecting, Close Date the next day, Amount = Deal Value | None |

## Update a Opportunity in Salesforce

Extra Configuration: Closing date = 1 Day, Opportunity Stage = Qualification, Select Outcome = Do Not Contact.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Opportunity named with the prospect's email exists at Stage Prospecting with an old Amount | Change outcome to Do Not Contact | The same Opportunity shows Stage Qualification, Amount = Deal Value and Close Date the next day, still one Opportunity | None |

## Attach Note in Salesforce

Merged into Create a Contact row 1 (QA, 2026-10-22): that row's trigger has Create a Contact and Attach Note saved together, and the same send also checks one Note on the Contact. No separate row.

## Record(log) an Email Activity in Salesforce

Extra Configuration: Contact checked (Lead and Opportunity unchecked). It has no Select Outcome.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact with the prospect's email exists | Change outcome to Interested | One email activity on the Contact, description recorded | None |

## Next

1. QA: "looks good" or changes, and the open point below.
2. Claude: hand-written spec `tests/salesforce/prospect-outcome-updated-smoke.spec.ts` (Salesforce
   specs are hand-written), reusing the gate and sequence setup of note 07, runner
   `scripts/run-salesforce-prospect-outcome-updated-smoke.sh`, command
   `npm run smoke:salesforce-prospect-outcome-updated`.
3. Needs before the first run: `npm run login:saleshandy -- emailopenedprod` and
   `npm run login:salesforce -- emailopenedprod`, if the sessions are older than a week.

## Run order (QA, 2026-10-22)

Gate, sequence, then "Prepare data" (records, prospects, step 1 sends for all rows, its own step in the
runner), then the 10 checks. If a send shows Scheduled for a later day instead of Sent (mailbox daily
limit or sending hours, probably), the run stops with exit code 5 and a notification saying so.
