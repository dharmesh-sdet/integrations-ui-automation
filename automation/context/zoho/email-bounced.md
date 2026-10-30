# Email is Bounced in Saleshandy (Zoho)

Jira: none yet. Overview, action rules and known issues: `00-overview.md` (read first).
Direction: Saleshandy to Zoho. Version: v5-account-link.
Source: `[dev kit]` (`integration-skills/test-logs/zoho/email-is-bounced-in-saleshandy.md`, runs of 2026-10-12 and 2026-10-13, Zoho org 941113438). No one saw this in the Saleshandy UI.

## What it does

When a sequence email bounces, the workflow runs the Zoho actions in the action slots, then adds a tag to the contact.

## Rules and observed behavior

- B1: a new contact gets the real phone, the note "Saleshandy Email is Bounced" and the tag Bounced-Saleshandy.
- B3: all five actions together created every record, 5 notes and the tag. The run completed.
- VB1: for an existing contact with linked deals, the contact and tag were updated, a task was added, and the newest linked deal was updated by id.

## Set up before testing

Checks 1 to 7 in `00-overview.md`. Save the Zoho mappings first. Use a new prospect email for each scenario.

## Notes for test cases

- Z-6: the tag replaces the contact's other tags, for example VIP. This is data loss, kept by decision.
- `[public docs]` names the tag "Unsubscribed-Saleshandy" for bounce too. The dev log shows Bounced-Saleshandy. Make sure which one is right on staging.

## Unclear (ask QA or look on staging)

1. The note title and exact note text in the Zoho UI.
2. How long the record takes to appear in Zoho. Proposed: wait 15 seconds after the Emails tab shows Sent, then look in Zoho first.
