# Link is Clicked in Saleshandy (Pipedrive)

Jira: none given. Overview, action rules and known issues: `00-overview.md` (read first).
Direction: Saleshandy to Pipedrive. Activity subject in Pipedrive: `Link is clicked in Saleshandy`. Version: v2.
Source: `[QA 2026-10-23]` (workflow JSON plus runs of 2026-10-12/13). Not yet seen in the UI.

## What it does

When a prospect clicks a tracked link in a sequence email, the workflow runs the Pipedrive actions placed in the action slots.

## Rules specific to this workflow

- Link scanners and email previews can click links. One real click can give 2 or 3 runs and 2 or 3 activities. This is Saleshandy event behavior, not a workflow bug.
- Each extra run with Create a Lead, Create a Deal or Create Organization makes another record, because these actions always create.
- Lead title and deal title = prospect email.
- All other action rules are in `00-overview.md`.

## Set up before testing

Checks 1 to 5, 8, 9 and 10 in `00-overview.md`.

## Unclear: expected functionality (proposed)

1. How the click is produced and how long until it registers: not documented. Proposed: open the tracked link from the sent email once, wait 15 seconds after the event shows in Saleshandy (QA 2026-10-23), and count runs before asserting record counts.
2. Whether the activity note carries the clicked URL or `Click Count`: not documented for Pipedrive (Zoho notes have `Click Count`). Proposed: not asserted.
