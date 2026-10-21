# Reply is Received in Saleshandy

**Passed, all 9 activities Pass (QA, 2026-10-16).** Run 2026-10-15: 7 of 11
script tests passed; the 4 that failed in the script (02 Update a Contact, 08
Create a Note, 09 and 10 Record (log) an Email Activity) were checked by hand
by QA and confirmed Pass. Summary comment sent to AL-4011, 2026-10-16.

Approved by QA 2026-10-15. Smoke test checklist, confirms production behavior
for the fixed tickets AL-4129, AL-4119 and AL-4118 under the tracking ticket
AL-4011. Covers all 9 activities under this trigger. Built from the staging
regression (`test-cases/hubspot/reply-received.md`, 44 passed, 2 skipped by
design on 2026-10-15) in the style of 01 to 03. Script:
`tests/hubspot/reply-received-smoke.spec.ts` (tests 00 to 10, same order).

Not covered, still open: Email Sent family tickets AL-4036, AL-4093, AL-4096,
AL-4104. Do not treat these as smoke test failures. The Link Clicked fixes
AL-4103, AL-4120 to AL-4123, AL-4127 are not re-confirmed here (not asked
for); the matching checks below read the same way as in 02.

AL-4118 is the production issue (QA, 2026-10-15): the note's Sequence link must
use the production host my.saleshandy.com. If the note shows the staging host,
the Create a Note check fails and QA reopens AL-4118 (draft only, no Jira
write from the script).

## Test data setup

- Account `emailopenedprod` (production, "rehan integration"), shared with the
  Email Opened, Link Clicked and Email Bounced smoke runs: never run them at the
  same time, and the sender limit of 15 a day is shared (the checklist needs
  about 11 emails, so run it on a day the other smoke runs have not used up).
- Sequence "HubSpot Reply Received Smoke", id **974166**, created on production
  2026-10-15 by `tests/setup/reply-received-smoke-sequence.spec.ts` (Step 1
  "Save cost & achieve more!" Quick email, Step 2 Upselling, Active, sender and
  schedule left as the account defaults). Step 1 subject for the spec:
  `Save cost & achieve more!`. Use a prospect with a Mailinator address.
- Trigger: step 1 needs to be "Sent" before Mark as replied. The Default
  Schedule can be closed in the evening (step 1 stays "Scheduled"), so use Send
  now on the Emails tab.
- Mark as replied: Sequence > Emails tab > the prospect's Step 1 row > Actions
  (three dots) > "Mark as replied". Toast "Email has been marked as replied". The
  second reply for a deal or contact is "Mark as replied" again on the same
  step 1 email (QA, 2026-10-09).
- Production timing: the log shows up and finishes within minutes (staging: 20
  to 35 s to appear). Staging Update a Deal logs stayed RUNNING for about 7.5
  minutes, so wait up to 10 minutes before judging a check.
- Field mapping saved on the production account. Settings > Integrations >
  HubSpot > Triggers & Activity > turn every other trigger off, enable
  "Reply is Received in Saleshandy" (name as staging shows it, not yet seen on
  production), select one activity (or the pairing), Save in the modal, then
  Save on the page.
- For Update a Deal: a contact with 3 deals. For Update a Company: a contact
  with 2 associated companies, with the company details (including City)
  changed in Saleshandy first.

## Baseline

- Select only Create a Contact, add the prospect, wait for step 1 "Sent", mark
  it as replied.
- Confirm the Emails tab counter reads "1(100.00%) Replied", the Prospects tab
  shows the Replied badge and Logs shows one new entry "Reply is Received in
  Saleshandy" with Success.

## Create a Contact in HubSpot

- Select this activity, mark as replied for a contact not in HubSpot.
- Confirm Success and the contact is created with the mapped fields.

## Update a Contact in HubSpot

- Select this activity, change the prospect details, mark as replied for a
  contact already in HubSpot.
- Confirm Success and the contact shows the new mapped values.

## Create a Deal in HubSpot

- Select this activity, mark as replied for a contact with no deal.
- Confirm Success and the deal is created and associated to the contact.

## Update a Deal in HubSpot

- Select this activity with Extra Configuration filled (pipeline, stage), mark
  as replied for the contact with 3 deals.
- Confirm the latest created deal gets the configured values and the other
  deals are unchanged.
- Change the Extra Configuration values (for example Closing Date to 51 days),
  mark the same step 1 email as replied again.
- Confirm the latest deal shows the new values (AL-4119).

## Create a Company in HubSpot

- Select this activity, mark as replied.
- Confirm Success and one company is created and associated.

## Update a Company in HubSpot

- Select this activity, change the company details (including City) in
  Saleshandy, mark as replied for the contact with 2 companies.
- Confirm Success, the latest associated company shows the new values
  including City, and the other company is unchanged.

## Create a Task in HubSpot

- Select this activity, fill Task Title, Task Type, Task Priority and Due In
  (Days), mark as replied.
- Confirm Success and the task is created with the configured values.

## Create a Note in HubSpot

- Select this activity paired with Create a Deal, mark as replied.
- Confirm Success and a note is on both the contact and the deal. Presence only
  (a reply has no reply text, so the note has no reply content).
- Confirm the note's Sequence link starts with https://my.saleshandy.com (the
  production host). A staging host fails the check and reopens AL-4118.

## Record (log) an Email Activity in HubSpot

- Select this activity paired with Create a Deal, mark as replied.
- Confirm Success and the email is logged on the contact and the deal.
- Select this activity paired with Update a Deal, mark as replied for the
  contact with 3 deals.
- Confirm the email is logged on the latest created deal and on the contact
  (QA, 2026-10-15) and its header names the prospect, not "Unknown Contact"
  (AL-4129).

## Code to reuse (for the script, after QA's OK)

- Model: `tests/hubspot/link-clicked-smoke.spec.ts` (same `createFlow`,
  `activity-rows.ts` rows and page objects; account `emailopenedprod`).
- Only the trigger changes: `fireEvent` = `saleshandySequence.markAsReplied(
  SEQUENCE_ID, fullName(row))` (as `tests/hubspot/reply-received.spec.ts` does),
  trigger text "Reply is Received in Saleshandy", `sendStep1Now: true`,
  `loggedEmailContains: () => ['Logged email by']`.
- Second reply (Update a Deal, AL-4119): the shape of the staging
  "Update a deal in HubSpot > 3" test in `reply-received.spec.ts`.
- Spec file `tests/hubspot/reply-received-smoke.spec.ts` (written 2026-10-15, not run), env
  `SMOKE_SEQUENCE_ID=974166`, `SMOKE_STEP1_SUBJECT="Save cost & achieve more!"`,
  data `test-data/hubspot/reply-received-smoke*.csv` generated from the staging
  Reply rows. No shared file in `src/flows/` is edited.
- Needs before a run: `npm run login:saleshandy -- emailopenedprod` and
  `npm run login:hubspot` (QA, headed).
