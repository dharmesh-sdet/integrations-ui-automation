# Prospect Outcome is updated in Saleshandy (Pipedrive)

Jira: none given. Overview, action rules and known issues: `00-overview.md` (read first).
Direction: Saleshandy to Pipedrive. Activity subject in Pipedrive: `Prospect Outcome is updated in Saleshandy`. Version: v2.
Source: `[QA 2026-10-23]` (workflow JSON plus runs of 2026-10-12/13). Not yet seen in the UI.

## What it does

When a prospect's outcome changes in Saleshandy, the workflow runs the Pipedrive actions placed in the action slots, after a category gate.

## Rules specific to this workflow

Category gate, runs first:

- Configured category equals the new outcome: all actions run.
- Category empty: all actions run for EVERY outcome.
- Any other case: nothing runs. Expected.
- "Meeting Booked" never matches (known Z-7, webui key bug). Do not file it.

Select Saleshandy Conversation Category applies to Prospect Outcome only.

Slot 5 gap (found offline, not yet reported, unconfirmed): the Update a Deal rule checks Action slot 2 twice and never checks slot 5. Update a Deal in slot 5 does not run; in any other slot it runs. Same in v1. Not counted as a failure until QA says it is a bug; then file it once.

Lead title and deal title = prospect email. All other action rules are in `00-overview.md`.

## Set up before testing

Checks 1 to 5, 8 and 9 in `00-overview.md`.

## Unclear: expected functionality (proposed)

1. How the outcome is changed in the UI and how long until it registers: not documented. Proposed: change the outcome on the prospect in Saleshandy (same method as `test-cases/hubspot/prospect-outcome-updated.md`), wait 15 seconds after the event shows in Saleshandy (QA 2026-10-23).
2. The list of outcomes in Select Saleshandy Conversation Category on Pipedrive: not read. Proposed: the same list as the HubSpot and Salesforce Prospect Outcome workflows, to be read on staging.
3. Expected result for Update a Deal in slot 5: QA decided on 2026-10-23 to add one case that expects it to run, marked "(proposed, unconfirmed)". A failure is reported as an unconfirmed expectation, not a product bug, until QA confirms it is a bug; then it is filed once.
