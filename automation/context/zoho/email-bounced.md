# Email is Bounced in Saleshandy (Zoho)

Jira: none yet. Overview, action rules and known issues: `00-overview.md` (read first).
Direction: Saleshandy to Zoho. Version: v5-account-link.
Source: `[dev kit]` (`integration-skills/test-logs/zoho/email-is-bounced-in-saleshandy.md`, runs of 2026-10-12 and 2026-10-13, Zoho org 941113438). No one saw this in the Saleshandy UI.

## What it does

When a sequence email bounces, the workflow runs the Zoho actions in the action slots, then adds a tag to the contact.

## Rules and observed behavior

- B1: a new contact gets the real phone, the note "Saleshandy Email is Bounced" and the tag Bounced-Saleshandy.
- B3: all five actions together created every record, 5 notes and the tag. The run completed.
- VB1: the contact already existed and had linked deals. The contact and tag were updated. A task was added. The newest linked deal was updated by id.

## Set up before testing

Checks 1 to 7 in `00-overview.md`. Save the Zoho mappings first. Use a new prospect email for each scenario.

## Notes for test cases

- Z-6: the tag replaces the contact's other tags, for example VIP. This is data loss, kept by decision.
- `[public docs]` names the tag "Unsubscribed-Saleshandy" for bounce too. The dev log shows Bounced-Saleshandy. Make sure which one is right on staging.

## Unclear (ask QA or look on staging)

1. The note title and exact note text in the Zoho UI.
2. How long the record takes to appear in Zoho. Proposed: wait 15 seconds after the Emails tab shows Sent, then look in Zoho first.
3. Seen 2026-10-31: the note title is "Saleshandy Email is Bounced". It holds Sequence Name, Sequence (link), Step and Sender Email. The tag Bounced-Saleshandy did not show in the record text, so ask QA where it shows.

## Combined 1 (all five actions)

The row stays as it is (QA, 2026-11-03). What to expect and what not to expect is in `00-overview.md`, section "Combined 1: all five actions on one trigger". The Bounced tag (and Z-6, tag replacement) is not tested: QA did not find a tag in the Zoho CRM (2026-11-03). The Combined 1 test expects 2 notes on the contact (its own and its deal), 1 lead, 1 deal, 1 task and 2 accounts.
