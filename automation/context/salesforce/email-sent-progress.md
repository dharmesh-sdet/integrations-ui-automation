# Salesforce > Email Sent from Saleshandy: progress

Account `sfemailsent` (not set up yet). Staging only. Updated 2026-10-16.

## Done
- Context: `context/salesforce/email-sent.md`.
- Salesforce org explored: Lead Status, Opportunity Stage, required fields confirmed.
- Triggers & Activity page explored (sfreplyreceived account): 10 separate activities confirmed, separate Create and Update (not combined as docs say).
- Overview updated: `context/salesforce/00-overview.md` with trigger list and activity pattern.
- Plan: `specs/salesforce-email-sent.md` (written for 28 rows; the test-case file has 25, see below).
- Test cases: `test-cases/salesforce/email-sent.md` (Phase 1 + Phase 2, all proposed/unconfirmed).

## Seen on staging
- Activities for Saleshandy-side triggers: Create a Account, Update a Account, Create a Contact, Update a Contact, Create a Lead, Update a Lead, Create a Opportunity, Update a Opportunity, Attach Note, Record(log) an Email Activity.
- Lead Status: --None--, Open - Not Contacted (default), Working - Contacted, Closed - Converted, Closed - Not Converted.
- Opportunity Stage: --None--, Prospecting, Qualification, Needs Analysis, Value Proposition, Id. Decision Makers, Perception Analysis, Proposal/Price Quote, Negotiation/Review, Closed Won, Closed Lost.
- Opportunity form: Name, Close Date, Stage required. Account Name NOT required.
- Tabs: Field Mapping, Triggers & Activity, Prospects Import, Custom Workflow, Logs.
- Field Mapping has: Lead Properties, Contact Properties, Opportunity Properties, Account Properties.

## QA decisions 2026-10-16
- Mode: Regression.
- Scope: all 10 activities.
- Extra config: assume HubSpot pattern, mark as (proposed, unconfirmed).
- Trigger: same as HubSpot (add prospect to active sequence, ~1 min).
- Activities are separate Create and Update (QA initially said combined but staging shows separate).

## Done (2026-10-19)
- Account `sfemailsent` created by QA, Salesforce connected, OTP off, both
  sessions saved (`auth/saleshandy-sfemailsent-chromium.json`,
  `auth/salesforce-sfemailsent-chromium.json`).
- Separate MCP sessions set up per workflow, both sides (not shared like
  HubSpot's portal): `playwright-sfemailsent` (Saleshandy side),
  `playwright-salesforce-emailsent` (Salesforce-org side). sfreplyreceived
  keeps its own: `playwright-sfreplyreceived`, `playwright-salesforce`.
  `isSharedPlatform()` in `src/config/environments.ts` now only treats
  `hubspot` as shared; Salesforce sessions are per-account like Saleshandy.
- Field Mapping (Lead, Contact, Opportunity, Account Properties) mirrored
  from sfreplyreceived and saved on sfemailsent. Values in
  `00-overview.md`.

## Done (2026-10-19, continued): Extra Configuration exploration
Walked the Triggers & Activity page on `sfemailsent` for every activity under
"Email Sent from Saleshandy". Confirmed:
- Create/Update Contact, Create/Update Lead, Attach Note: no Extra
  Configuration modal.
- Create/Update Opportunity: modal has Closing date (Days spinner, default
  0) and Opportunity Stage (Select) — matches the docs/proposed values.
- Record(log) an Email Activity: modal has a multi-select "Select Object"
  with checkboxes Lead / Contact / Opportunity — matches existing
  documentation.
- This overturns the HubSpot-based assumption that Create/Update Contact has
  Lead Status/Lifecycle Extra Configuration fields — it has none. The Phase 2
  "Create a Contact in Salesforce: Extra Configuration values" section in
  `test-cases/salesforce/email-sent.md` is now flagged as not applicable;
  QA to decide whether to drop it.

## Done (2026-10-19, continued): Save-validation reconfirmed after reconnect
QA reconnected Salesforce for `sfemailsent`. Reconfirmed on staging:
- Create a Lead alone (trigger toggle + Save): succeeds cleanly, 200 on the
  workflow PATCH and on the field-sync call that 500'd before the
  reconnect (`field/65f27ebc912f0b34b92dee29`). Confirms the earlier 500s
  were the dropped connection, not a product bug.
- Create a Opportunity with Stage left empty: Save succeeds, no error.
- Attach Note selected alone (no pairing): Save succeeds, no error.
- Record(log) an Email Activity with no object selected: Save succeeds,
  explicit "Configuration Updated Successfully" toast.
None of these are rejected at Save time. What happens when the email is
actually sent with these configurations (Logs status, Salesforce record
state) is a separate, still-open question — this only resolves the
Settings-page validation behavior, not runtime behavior.

## Done (2026-10-19, continued): spec written (first draft, not run yet)
Hand-written, following the Reply Received Salesforce spec (QA decided not to
use the planner/generator/healer agents here). Typecheck passes; Playwright
lists 25 tests (23 run, 2 skipped). The test-case file has **25** rows (earlier
notes said 28; that was a miscount).
- `tests/salesforce/email-sent.spec.ts`: one test per row, account `sfemailsent`,
  sequence 196794.
- `test-data/salesforce/email-sent.csv`: 36 prospects. "seed" rows create the
  Lead/Contact/Opportunity a scenario needs first, by sending through the
  product. Rows whose note says "Email is overridden" reuse the seed's email.
- `src/pages/saleshandy/salesforce-email-sent.page.ts`: Triggers & Activity
  incl. the Opportunity and Record(log) Extra Configuration dialogs.
- `src/pages/salesforce/{object,contacts,opportunities}.page.ts`: Contact and
  Opportunity record pages on the Lightning conventions proven for Lead.
- `src/flows/saleshandy-to-salesforce.ts`: send, then read the new Logs entry.
- `src/fixtures/index.ts`: three new fixtures (additive).
Pass/fail: only core behavior is asserted (Logs Success, plain Create fields).
Every "(proposed, unconfirmed)" result is recorded as a report annotation, per
the test-case file's own rule, to be confirmed by QA and then asserted.

Not verified yet (expect the first run to need fixes):
- Contact and Opportunity record locators (same Lightning convention as Lead,
  not yet opened on this org); how the Opportunity is named and tied to the
  Contact; where Attach Note and Record(log) show on the record.
- The Opportunity Stage options in the dialog are assumed to be buttons.
- Whether Saleshandy accepts a second prospect with an email already in the
  sequence (the "Email is overridden" rows).

## Sequence (2026-10-19)
QA: leave onboarding sequence 196794 as it is (Draft, 3 sample prospects:
starting it would email colleagues). A new sequence was created for the tests by
`tests/setup/email-sent-salesforce-sequence.spec.ts`: "Salesforce Email Sent
Regression", id **196882**, 2 steps, active, sender `rudra@saleshandy.com`
(interval 40 to 50 s, limit 150/day), sending schedule "Default Schedule". The
spec uses 196882. If emails queue as "Scheduled Tomorrow" outside the default
window, Send now still sends them; if not, give the sequence an always-on
schedule (see account-setup.ts note).

## Blocked on
- **QA review of the "(proposed, unconfirmed)" results**: they stay as
  annotations until QA confirms them.
- **Create a Contact "Extra Configuration values" (2 rows)** are skipped:
  that activity has no dialog. QA to decide whether to drop the rows.

## Next
1. Run: `npx playwright test --project=chromium tests/salesforce/email-sent.spec.ts`
   (about 37 sends, expect 1.5 to 2.5 hours). Claude fixes script failures.
2. QA reviews the report annotations and confirms the proposed results.

## 2026-10-20 session: findings and state

Suite state
- Spec has 25 tests; test-cases/salesforce/email-sent.md has 34 rows (9 new: Create/Update Account 1-3, Update a Lead 1-3, not scripted yet; Account page objects not written).
- Seed email reuse caused the "Done" failures (Saleshandy accepts an email once per account, 400 code 1001). Spec now creates the old Lead/Contact in the Salesforce UI with the prospect's own email (`leadInSalesforce`, `contactInSalesforce`). Update Opportunity 2 (3 Opportunities) is test.skip, needs QA input.
- Fixed: `savedToast()` strict mode (2 toasts), `Leads.countByEmail` now reloads the list per look, `sendNow` waits for the Emails row with reloads (new prospect row appears late), `sendNow` waits for POST .../emails/send before reloading (a reload aborted the request and the email stayed Scheduled).
- Send cap: `src/data/send-cap.ts`, default 40/day (mailbox allows 150), `SEND_CAP=<n>` overrides, count in test-data/send-count.json. 16 used on 2026-10-20 (all wasted except tests that passed).

Environment problems found (QA fixed each)
- Sender mailbox dharmesh+salesforce@saleshandy.com failed Gmail login (EAUTH 535) at 02:52 PM and the sequence turned off. QA reconnected it.
- Salesforce integration on sfemailsent showed Re-connect (Triggers page redirected to the Integrations list). QA reconnected it. Reconnecting invalidated the saved Salesforce test session; QA re-saved it (verified loading).
- Sequence 196882 toggle is on again.

Open
- Trigger behavior > 2 fails twice: Send now was aborted by a reload (fixed above) and the last run (reports/email-sent-sf7) timed out at 7.0m with "locator.count: Target page closed" in the no-Lead check (countByEmail loop). Cause not found yet; read the sf7 trace first.
- Run lesson: `kill` on the npm/sh pids leaves the node playwright process and its workers alive, they keep sending and respawn workers. Kill the `bin/playwright test` node pid itself, then check `ps` for workerProcessEntry. Two overlapping runs on 2026-10-20 (sf4, sf5) polluted results.
- Test 1 (Trigger behavior > 1) passes. Tests 3 to 25 have never passed yet.
- Reply Received row 4 and Prospect Outcome Updated still pending.

## 2026-10-21 session
- Trigger behavior > 1, > 2 and Create a Lead > 1 pass (sf9, sf10). The sf7 failure was the test budget, not a locator: 7 `networkidle` waits of 30 s each.
- `src/utils/wait.ts`: `NETWORK_IDLE_TIMEOUT_MS` 30 s to 3 s (pages never go idle; the blank/error page check stays). `sendAndExpectNoLog` looks 6 to 3 times (checks at 15, 25, 35 s). One send test: 7.1 min to 2.3 min.
- `REFRESH_USED_ONLY=1` (global-setup): replace only used rows. Full refresh burned 36 names per run; the name pool had about 1,170 combinations left (7,228 of 8,400 emails in `test-data/_generated-emails.txt`). Salesforce-side seeds now `markUsed` the row. Run: `REFRESH_USED_ONLY=1 REPORTS_DIR=reports/email-sent-sfN TEST_DATA_ONLY=salesforce/email-sent npx playwright test ... --grep "<test>"`.
- Trigger behavior > 2 budget raised to 2 sends (no longer needed after the wait fix; can go back to 1).
- Draft plan `test-cases/salesforce/email-sent-all-activities.md` (35 rows, all 10 activities), waiting for QA's "looks good". Replaces `email-sent.md` once approved.
- `send-count.json` read 3 after 2 sends today; the counter may count attempts. Not checked.

## 2026-10-21 session, later
- Plan now 40 rows (`test-cases/salesforce/email-sent.md`): Attach Note 4 to 6 (Lead, Account, Opportunity), Create a Opportunity 6 and Update a Opportunity 4 (Closing date 0 Days), default Closing date 1 Day. 39 of 40 scripted tests pass, each in its own run; Create a Opportunity 6 fails on purpose until AL-4168 is fixed (QA verified the fix on Staging, comment 79318).
- AL-4168 filed from `jira/drafts/email-sent-opportunity-closing-date-zero-days.json`; Update a Opportunity observation posted as comment 79315.
- List pages use the "All" views (AllContacts, AllOpenLeads, AllAccounts, AllOpportunities): "Recently Viewed" showed "0 items" for records the integration created.
- An Opportunity is tied to a Contact by a primary Contact Role. Creating it from the Contact's Opportunities list sets the role (`contacts.page.ts` `newOpportunity`). Opportunity name = prospect email.
- Update a Opportunity 2 (Contact has 3 Opportunities, 3 made by hand): Logs Success, only the last-created Opportunity changed (Stage Qualification, Close Date today + 2), the other two unchanged, still 3 Opportunities (sf20).
- Update a Opportunity 1 (Opportunity made by the product): after the update there are 2 Opportunities (original unchanged, a new Qualification one). Differs from the 3-by-hand case; cause not known. QA decides if it is a bug.
