# Prospect Outcome is updated in Saleshandy (Salesforce)

Readiness for scenario generation: Not ready. Built from the public docs (read 2026-10-19), the HubSpot version
(`context/hubspot/prospect-outcome-updated.md`), the Salesforce KB page and
`00-overview.md`. Nothing here has been checked on Saleshandy staging for this
trigger yet. Tags: `[HubSpot]` carried over from the HubSpot workflow, not yet
confirmed for Salesforce; `[KB]` Salesforce KB page; `[staging]` seen on
staging; `[QA]` QA decision.

Jira sub-task: AL-4134 (parent AL-4131), see `00-overview.md`.

Direction: Saleshandy to Salesforce (a prospect outcome change in a Saleshandy
sequence; the activities create or update Salesforce records).

## What it does

When a prospect's outcome changes in a sequence, the selected Salesforce
activity runs only if the new outcome equals the one chosen in Extra
Configuration (Select Outcome, one value) [HubSpot]. A non-matching outcome
must not trigger the workflow. If it triggers, that is a bug [QA, 2026-10-20].
What the test checks on a non-matching row (QA, 2026-10-20): nothing created or
changed in Salesforce. A Logs row is allowed and is not a failure on its own;
the Logs result is recorded. HubSpot's equivalent fix is AL-4105 (HubSpot
context: "blocked, nothing created or updated"; whether a Logs row exists on a
block is not stated there). Outcomes offered:
Interested, Not Interested, Meeting Booked, Out of office, Closed, Not Now,
Do not Contact, Uncategorized, plus custom outcomes [HubSpot, KB]. A prospect
with no outcome shows "Add Outcome".

## Activities (QA list, 2026-10-19)

| # | Activity | Extra Configuration | Notes |
|---|---|---|---|
| 1 | Create a Account in Salesforce | Select Outcome (while creating account), one field; values Uncategorized, Interested, Not Interested, Meeting Booked, Out of Office, Closed, more below the fold [staging, 2026-10-19] | Opened unsaved on sfemailsent, nothing saved. Same modal pattern for 1 to 6; Update modals have no Lead Status or other fields. |
| 2 | Update a Account in Salesforce | Select Outcome (while updating account), one field [staging, 2026-10-19] | |
| 3 | Create a Contact in Salesforce | Select Outcome (while creating contact), one field [staging, 2026-10-19] | |
| 4 | Update a Contact in Salesforce | Select Outcome (while updating contact), one field [staging, 2026-10-19] | |
| 5 | Create a Lead in Salesforce | Select Outcome (while creating lead), one field [staging, 2026-10-19]; matches docs | The Reply Received trigger has no modal; this trigger should. |
| 6 | Update a Lead in Salesforce | Select Outcome (while updating lead), one field [staging, 2026-10-19] | |
| 7 | Create a Opportunity in Salesforce | Closing date (while creating) in Days, default 0; Opportunity Stage (While creating): Prospecting, Qualification, Needs Analysis, Value Proposition, Id. Decision Makers, Perception Analysis, more below the fold; Select Outcome (While creating opportunity): Uncategorized, Interested, Not Interested, Meeting Booked, Out of Office, Closed, more below [staging, 2026-10-20, sfoutcomeupdated] | Opened unsaved. Stage and Outcome are searchable lists. |
| 8 | Update a Opportunity in Salesforce | Closing date (while updating) in Days, default 0; Opportunity Stage (While updating); Select Outcome (while updating opportunity) [staging, 2026-10-20] | Opened unsaved. Unlike the other Update activities, this one has Stage and Closing date. |
| 9 | Attach Note in Salesforce | None. Pairs with Create/Update Contact only [staging, 2026-10-17] | |
| 10 | Record(log) an Email Activity in Salesforce | Lead / Opportunity / Contact checkboxes, standalone [staging, 2026-10-17] | No email is sent on an outcome change; HubSpot's log had an empty description (AL-4113). |

## Public docs read 2026-10-19 [docs]

Sources: docs.saleshandy.com articles 9204109 (Salesforce: Triggers & Activities)
and 9148639 (Salesforce Integration). Real-user posts (Reddit, G2, YouTube):
searched, none found.
- Outcomes: Interested, Not Interested, Meeting Booked, Out of Office, Closed,
  Not Now, Do Not Contact, Uncategorized, plus custom outcomes.
- Extra Configuration is documented only for Create a Lead (Select Outcome)
  and Create an Opportunity (Closing Date, Stage, Select Outcome). Nothing
  for Update activities, Account, Contact, Record Email Activity.
- Attach Note: needs a Contact (docs say "Contact or Deal") created or updated first, else it fails.
- Docs do not say how a prospect is matched to an existing Salesforce record
  for this trigger, how duplicates are handled, or which required Salesforce
  fields apply. Matching by email is stated only for call logging.
- The docs are inconsistent in places (Deal vs Opportunity; two activity
  lists). Staging wins where they differ.

## Scope [QA, 2026-10-19]

All 10 activities, each with a matching and a non-matching outcome. Salesforce
Extra Configuration is unknown, so the scenario list is sized only after the
staging exploration.

## Open

- Does an outcome set by an email reply fire the trigger? Left out of scope, as in HubSpot.
- Extra Configuration of each activity; Select Outcome present on all?
- Does a Salesforce-side bug history exist (HubSpot's AL-4105 to AL-4113 may not apply)?
- Trigger path: Sequence > the sequence > Prospects, outcome dropdown [HubSpot].

## Setup

- Account `sfoutcomeupdated` (dharmesh+salesforce+prospectoutcome@saleshandy.com), created by QA 2026-10-20 ahead of the original plan, so the staging exploration could run on it. In `accounts.ts`; own Saleshandy and Salesforce sessions saved 2026-10-20; MCP entries `playwright-sfoutcomeupdated` and `playwright-salesforce-outcomeupdated` in `.mcp.json` (load after a restart).
- Seen 2026-10-20 [staging]: Salesforce connected (Disconnect shown), all 11 triggers off with no activity, 1 email account "Salesforce ProspectOutcome" (SMTP, Connected, rudra+salesforce+prospectoutcome@saleshandy.com sender address; Sending Settings number fields read 150, 70, 40, 55, not matched to their labels; the time interval between emails showed "-" in the page text, so interval is not confirmed). Activity list under Prospect Outcome has all 10 activities. The Select box stays disabled until the trigger toggle is on.
- Not checked yet: whether Field Mapping on this account is set. Copy from `00-overview.md` ("Field mapping values") if empty. No sequence, no prospects.
