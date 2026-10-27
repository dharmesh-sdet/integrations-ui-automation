# Account is created in Salesforce: Regression scenarios

Environment: Staging (pyxis.lifeisgoodforlearner.com), account `sfcreated`, shared
Salesforce org `saleshandy-dev-ed`. The workflow ticket is AL-4143. Script:
`tests/salesforce/account-created.spec.ts` (rows in `src/flows/salesforce-to-saleshandy.ts`).

This workflow is not a webhook: Refold runs it on a cron every 3 hours. Each row makes
an Account (name: Company plus a run stamp), then a Contact from the Account's Contacts list in Salesforce, then runs the workflow at once through Refold's run-now call
(no 3-hour wait), finds that run in Logs by its id, and checks the prospect in Saleshandy.
Workflow version: the Saleshandy UI runs workflow `681368981acc0cbcd16295c9` (saleshandy-webui helper.ts,
staging), but the developer API tests ran a separate copy, `682d72d0bcc93496f8906354`
(knowledge-base/product/workflow-behaviour-dev-kit.md section 6). If a result differs from
the Expected below, it may be a version difference: say so in the bug report.

Expected results come from the developer API runs on staging
(`../../../integration-skills/test-logs/salesforce/account-created-in-salesforce.md`).

Every run reads all records of this object in the shared org (up to 200; the 3-hour window is not applied, kept by the developer, account-created test log). A row's actions therefore also reach other tests' people imported into this account. Sequence rows run only with SEQUENCES_PAUSED=1, after Sequence A and Sequence B are paused, so nobody is emailed. No Blacklist row: it would block every domain in the org.

## Test data setup

- People from `test-data/salesforce/account-created.csv`, one per row (`node scripts/make-salesforce-side-data.ts`
  once; new people before every run). Record names that repeat get a run stamp.
- Field Mapping on `sfcreated` as in `src/config/salesforce-field-mapping.ts`; the Setup row
  checks the fields this workflow fills (Department (from the Contact)).
- Settings > Integrations > Salesforce > Triggers & Activity: only "Account is created in Salesforce" on, the
  row's activities selected, Extra Configuration filled, Save.
- Sequence A (with Step 1) and Sequence B exist on `sfcreated`, both paused.
- Logs: the run is found by the execution id run-now returns, not by "newest row".
- Prospect check: search the person's email in the Saleshandy Prospects list.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Setup | Check Field Mapping, turn on only this trigger with Add Prospect, Save | Mapping matches; "Configuration Updated Successfully" | None |

## Add Prospect in Saleshandy

Extra Configuration: None ("Select a list" left empty on the Lead trigger).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New record, person not in Saleshandy | Create the record, run now | Run COMPLETED, Logs Success, one prospect with Department (from the Contact) from the record (account-created:103) | None |
| 2 | Same record, nothing new | Run now again | Still one prospect with that email (upsert) | None |

## Move Prospect to another Sequence in Saleshandy

Extra Configuration: Sequence A, Step 1 - Day 1.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New record | Create the record, run now | Prospect in Sequence A (proposed, unconfirmed; run live on the Lead workflow only) | None |

## Assign a tag to Prospect in Saleshandy

Extra Configuration: tag TagA (created in the dialog if missing).

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New record | Create the record, run now | Prospect has tag TagA (lead-created:137) (proposed, unconfirmed; run live on the Lead workflow only) | None |

## Mark Prospect as Paused / Replied / Finished in Saleshandy

A new prospect is in no sequence, so each row also selects Move Prospect (Sequence A,
Step 1): the workflow adds the prospect to the step, then applies the status in the same
run (lead-created:144). Status Extra Configuration: Sequence A; Paused also 1 day.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Paused: new record | Create the record, run now | Latest Status Paused (lead-created:142) (proposed, unconfirmed; run live on the Lead workflow only) | None |
| 1 | Replied: new record | Create the record, run now | Latest Status Replied (lead-created:141) (proposed, unconfirmed: with "stop sending follow-ups on a reply" it can end Finished) | None |
| 1 | Finished: new record | Create the record, run now | Latest Status Finished (lead-created:140, :144) (proposed, unconfirmed; run live on the Lead workflow only) | None |

## Mark Prospect as Unsubscribed in Saleshandy

Extra Configuration: None.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New record | Create the record, run now | Latest Status Unsubscribed (lead-created:143) (proposed, unconfirmed; run live on the Lead workflow only) | None |

## Restore

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | After the rows | Turn the trigger off, Save | Saved; the 3-hourly cron stops importing the org's records into the account | None |

Not scripted: Mark Prospect as Resume (needs a paused prospect and a second run; the Lead
cursor reads no record twice).
