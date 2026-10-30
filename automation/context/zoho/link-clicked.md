# Link is Clicked in Saleshandy (Zoho)

Jira: none yet. Overview, action rules and known issues: `00-overview.md` (read first).
Direction: Saleshandy to Zoho. Version: v5-account-link.
Source: `[dev kit]` (`integration-skills/test-logs/zoho/link-is-clicked-in-saleshandy.md`, runs of 2026-10-12 and 2026-10-13, Zoho org 941113438). No one saw this in the Saleshandy UI.

## What it does

When a prospect clicks a tracked link, the workflow runs the Zoho actions in the action slots.

## Rules and observed behavior

- L1: one real click made a lead (City, Designation, Phone mapped) and a deal (Closing Date today plus 6, Amount, Stage Qualification). The note shows Click Count 1, one label per line.
- L2: a link scanner fired 3 click events in 15 seconds. That gave 3 runs and 3 notes on the lead and on the deal. The lead and deal were not duplicated.
- VL1: after an open and a click, the click run found the contact, found no linked deal, and set Contact_Name on the existing deal. It made one contact.

## Set up before testing

Checks 1 to 7 in `00-overview.md`. Save the Zoho mappings first. Use a new prospect email for each scenario.

## Notes for test cases

- Z-10: scanner clicks give extra runs and notes. This is Saleshandy event behavior, not a workflow bug.
- A click also counts as an open. With Email Opened on, one click also runs Opened.

## Unclear (ask QA or look on staging)

1. The note title and exact note text in the Zoho UI.
2. How long the record takes to appear in Zoho. Proposed: wait 15 seconds after the Emails tab shows Sent, then look in Zoho first.
