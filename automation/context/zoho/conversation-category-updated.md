# Conversation Category (Prospect Outcome) is updated in Saleshandy (Zoho)

Jira: none yet. Overview, action rules and known issues: `00-overview.md` (read first).
Direction: Saleshandy to Zoho. Version: v5-account-link.
Source: `[dev kit]` (`integration-skills/test-logs/zoho/conversation-category-updated-in-saleshandy.md`, runs of 2026-10-12 and 2026-10-13, Zoho org 941113438). No one saw this in the Saleshandy UI.

## What it does

When a prospect outcome changes, a category gate decides whether the Zoho actions in the action slots run.

## Rules and observed behavior

- The gate compares the category you set in the workflow popup with the outcome of the event.
- C1: category Interested and outcome Interested. The gate is true, so a contact and a note were created.
- C2: category Interested and outcome Not Interested. The gate is false. Nothing ran and no Zoho contact was made.
- C3: no category set. The gate passes for any outcome, so a contact and a note were created for outcome Not Now.
- C4: category Meeting Booked never matches (Z-7). The webui saves the key with a colon. Nothing runs.
- C5: all five actions with gate Interested. All records and notes were created.
- VC1: gate Interested with an existing contact. The contact and the newest linked deal were updated.

## Set up before testing

Checks 1 to 7 in `00-overview.md`. Save the Zoho mappings first. Use a new prospect email for each scenario.

## Notes for test cases

- Z-7, Z-8 and Z-9 apply. Z-7 is reported. Z-8 and Z-9 are low.
- A reply also fires this workflow. With a different category, it ran nothing.

## Unclear (ask QA or look on staging)

1. The note title and exact note text in the Zoho UI.
2. How long the record takes to appear in Zoho. Proposed: wait 15 seconds after the Emails tab shows Sent, then look in Zoho first.
