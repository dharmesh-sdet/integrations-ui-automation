# Prospect is Unsubscribed in Saleshandy

**Passed, QA approved, 2026-10-20.** Run on production with the real
"Unsubscribe here" link, all 9 activities Pass (QA tested them by hand). Fixed
tickets verified: AL-4162 (Create a Note), AL-4163 (Update a Company),
AL-4164 (Create a Task, contact not in HubSpot), AL-4165 (Update a Deal).
Learning: a prospect not in a sequence that is unsubscribed manually does not
trigger the workflow; this is valid behavior. Jira comments for AL-4015,
AL-4162, AL-4163, AL-4164 and AL-4165 are drafted in `jira/drafts`, not sent.

The text below is the original pre-run draft.

Built from the staging regression (`test-cases/hubspot/unsubscribed.md`, 63
rows, and the lighter `unsubscribed-lite.md`, 27 rows), in the style of 01 to
05. Since the staging regression itself is not fully run or QA-confirmed yet
(every expected result there is still "proposed, unconfirmed"), this smoke
checklist confirms baseline functional behavior per activity, not a specific
AL fix ticket per row. Re-scope rows to specific tickets once staging surfaces
and fixes any bugs.

Not covered, still open: whether an unsubscribe-specific HubSpot property is
written (not documented), whether the UI action (Mark as Unsubscribe) fires
the trigger identically to the real unsubscribe link (not confirmed on
staging either). The cross-workflow fixes AL-4103 (Update a Deal updates the
latest created deal) and AL-4123 (the logged email's header names the
prospect, not "Unknown Contact") are not re-confirmed here, same as 05; the
matching checks below read the same way as in 02 and 05.

This checklist uses the **real unsubscribe link only** (QA, 2026-10-19: Mark
as Unsubscribe in the UI does not work on production, the link does). The
sequence has "Unsubscribe as Link" saved (set by QA). Per row: add the
prospect to the active sequence, send step 1 (Send now if the schedule has not
sent it), open the delivered email in Mailinator, wait 93 seconds, click
"Unsubscribe here", go back to the sequence's Prospects tab and reload it: the
prospect must show Unsubscribed. Whether the UI action and the link fire the
trigger identically stays an open point.

## Test data setup

- Account `emailopenedprod` (production, "rehan integration"), shared with
  the Email Opened, Link Clicked, Email Bounced and Reply Received smoke
  runs: never run at the same time, and the sender limit of 15 a day is
  shared.
- Sequence "HubSpot Prospect Unsubscribed Smoke", one step, created by
  `tests/setup/unsubscribed-smoke-sequence.spec.ts` (not yet run; no
  `SMOKE_SEQUENCE_ID` assigned). Step 1 subject: `Save cost & achieve more!`
  (the "Quick email" library template). Use a prospect with a Mailinator
  address.
- Trigger: step 1 needs to be "Sent" before the link is used. The Default
  Schedule can be closed in the evening (step 1 stays "Scheduled"), so the
  spec uses Send now on the Emails tab (already the default behavior of
  `ensureSent`, no special flag needed).
- Unsubscribe: Mailinator inbox of the prospect > latest email > wait 93 s >
  "Unsubscribe here" link.
- Field mapping saved on the production account. Settings > Integrations >
  HubSpot > Triggers & Activity > turn every other trigger off, enable
  "Prospect is Unsubscribed in Saleshandy" (name as staging shows it, not yet
  seen on production), select one activity (or the pairing), Save in the
  modal, then Save on the page.
- For Update a Deal: a contact with 3 deals. For Update a Company: a contact
  with 2 associated companies, with the company details (including City)
  changed in Saleshandy first.

## Baseline

- Select only Update a Contact, add the prospect, wait for step 1 "Sent",
  use the unsubscribe link.
- Confirm the Prospects tab shows the prospect as Unsubscribed and Logs shows
  one new entry "Prospect is Unsubscribed in Saleshandy" with Success.

## Create a Contact in HubSpot

- Select this activity (Lead Status Open, Lead Lifecycle Marketing Qualified
  Lead), use the unsubscribe link for a contact not in HubSpot.
- Confirm Success and the contact is created with the mapped fields, Lead
  Status Open, Lifecycle Stage Marketing Qualified Lead.

## Update a Contact in HubSpot

- Select this activity (Update Lead Status Connected, Update Lead Lifecycle
  Sales Qualified Lead), change the prospect details, use the unsubscribe link for
  a contact already in HubSpot.
- Confirm Success and the contact shows the new mapped values, Lead Status
  Connected, Lifecycle Stage Sales Qualified Lead.

## Create a Deal in HubSpot

- Select this activity (Sales Pipeline, Initial Contact, New Business, High,
  Closing Date 0 Days), use the unsubscribe link for a contact with no deal.
- Confirm Success and the deal is created and associated to the contact with
  the configured values, no close date.

## Update a Deal in HubSpot

- Select this activity with Extra Configuration filled (Sales Pipeline,
  Follow-Up, New Business, High), use the unsubscribe link for the contact with 3
  deals.
- Confirm the latest created deal gets the configured values and the other
  deals are unchanged (AL-4103, not re-confirmed here, see above).

## Create a Company in HubSpot

- Select this activity, use the unsubscribe link for a contact in HubSpot.
- Confirm Success and one company is created and associated.

## Update a Company in HubSpot

- Select this activity, change the company details (including City) in
  Saleshandy, use the unsubscribe link for the contact with 2 companies.
- Confirm Success, the latest associated company shows the new values
  including City, and the other company is unchanged.

## Create a Task in HubSpot

- Select this activity, fill Task Title, Task Type, Task Priority and Due In
  (Days), use the unsubscribe link for a contact in HubSpot.
- Confirm Success and the task is created with the configured values.

## Create a Note in HubSpot

- Select this activity paired with Create a Deal, use the unsubscribe link for a
  contact not in HubSpot.
- Confirm Success and a note is on both the contact and the deal.

## Record (log) an Email Activity in HubSpot

- Select this activity paired with Create a Deal, use the unsubscribe link for a
  contact not in HubSpot.
- Confirm Success and the email is logged on both the deal and the contact.
- Select this activity paired with Update a Deal, use the unsubscribe link for the
  contact with 3 deals.
- Confirm the email is logged on the latest created deal and on the contact,
  and its header names the prospect, not "Unknown Contact" (AL-4123, not
  re-confirmed here, see above).

## Code to reuse (for the script, after QA's OK to actually run it)

- Model: `tests/hubspot/link-clicked-smoke.spec.ts` and
  `tests/hubspot/reply-received-smoke.spec.ts` (same `createFlow`,
  `activity-rows.ts` rows and page objects; account `emailopenedprod`).
- Only the trigger changes: `fireEvent` = `mailinator.openUnsubscribeLink(
  email, STEP_1_SUBJECT, 93_000)`, then `saleshandySequence.expectProspectStatusAfterRefresh(
  SEQUENCE_ID, email, 'Unsubscribed')` (Prospects tab, one hard refresh,
  search the prospect, up to 30 s for the row). Trigger text "Prospect is Unsubscribed in Saleshandy",
  `loggedEmailContains: (row) => [row['First Name']]` (the trigger's own header
  text on the logged email is not seen yet).
- Spec file: `tests/hubspot/unsubscribed-smoke.spec.ts` (written 2026-10-17,
  not run), env `SMOKE_SEQUENCE_ID` (not yet assigned, set once the setup
  spec runs), `SMOKE_STEP1_SUBJECT="Save cost & achieve more!"`, data
  `test-data/hubspot/unsubscribed-smoke*.csv` (generate from the staging
  Unsubscribed rows once ready to run). No shared file in `src/flows/` is
  edited.
- Needs before a run: `SETUP_SMOKE_SEQUENCE=1` run of
  `tests/setup/unsubscribed-smoke-sequence.spec.ts` once, then
  `npm run login:saleshandy -- emailopenedprod` and `npm run login:hubspot`
  (QA, headed), then QA's go-ahead once AL-4015 is confirmed deployed.
