# Salesforce > Prospect Outcome is updated in Saleshandy: progress

Account `sfoutcomeupdated` (dharmesh+salesforce+prospectoutcome@saleshandy.com). Staging only. Jira AL-4134 (parent AL-4131). Saved 2026-10-20 afternoon.

## Update 2026-10-21 (stage 3 written, not run)

QA said: cover all activities, realistic cases only, write the whole script, QA runs it, Claude fixes script failures and separates product issues (scenario, steps, expected, actual). Open points 1 to 3 carried with Claude's defaults as "(proposed, unconfirmed)". Cases saved: `test-cases/salesforce/prospect-outcome-updated.md` (25 rows; Record Email Activity cut to 1 row, Update rows start from a stale Salesforce record). Written, nothing run: `tests/salesforce/prospect-outcome-updated.spec.ts`, `tests/setup/prospect-outcome-updated-sequence.spec.ts`, `src/pages/saleshandy/salesforce-outcome.page.ts`, `src/pages/salesforce/accounts.page.ts`, `src/flows/salesforce-outcome.ts`, `test-data/salesforce/prospect-outcome-updated.csv` (22 seed rows, people replaced at run start), `scripts/run-prospect-outcome-updated.sh` (`npm run test:outcome-updated`, one report folder per run under `reports/prospect-outcome-updated/<time>/`), `scripts/outcome-failures.ts` (`npm run outcome-updated:failures`, splits PRODUCT: failures from script ones). Unverified locators (TODO needs-input): Extra Configuration Select Outcome box, New Account and New Opportunity forms, sequence id from the list row. Field Mapping on this account is still unchecked.

## Where it stopped (before 2026-10-21)

Stage 2 (scenarios). The draft below is **not approved and not saved** to `test-cases/salesforce/prospect-outcome-updated.md`. Waiting on QA's "looks good" and answers to the 3 open points. No spec, no CSV, no seed. Nothing was run except read-only staging looks.

## Done

- Context: `context/salesforce/prospect-outcome-updated.md` (activities table, Opportunity modals seen on staging 2026-10-20, setup notes, QA decision on non-matching rows).
- Account added to `src/config/accounts.ts`; MCP entries `playwright-sfoutcomeupdated` and `playwright-salesforce-outcomeupdated` added to `automation/.mcp.json` (the root `.mcp.json` is a symlink). They load only after Claude Code restarts. Sessions saved 2026-10-20: `auth/saleshandy-sfoutcomeupdated-chromium.json`, `auth/salesforce-sfoutcomeupdated-chromium.json` (valid about 7 days).
- Seen on staging, read-only, 2026-10-20: Salesforce connected, all 11 triggers off, 1 email account "Salesforce ProspectOutcome" (SMTP, Connected). Sending Settings number fields read 150, 70, 40, 55, not matched to labels; interval not confirmed. Select box is disabled until the trigger toggle is on. Create and Update a Opportunity modals: Closing date in Days (0), Opportunity Stage, Select Outcome. Stage list starts Prospecting, Qualification, Needs Analysis, Value Proposition, Id. Decision Makers, Perception Analysis. Outcome list starts Uncategorized, Interested, Not Interested, Meeting Booked, Out of Office, Closed.
- Not checked: Field Mapping state on this account (copy from `00-overview.md` "Field mapping values" if empty); sender interval; Account, Contact, Lead, Attach Note, Record Email Activity modals on this account (QA OK 2026-10-20: use the sfemailsent findings).

## QA decisions 2026-10-20

- Rule 12 for Salesforce: hand-written specs (memory), so no planner or generator for the spec.
- Trigger: Sequence > the sequence > Prospects, outcome dropdown. Matching rows: poll Salesforce for up to 3 min for the record (not Logs first). Non-matching rows: wait the full 3 min, Logs refresh 15 s then every 10 s, entries not opened.
- Scope: lean, 26 rows (3 baseline, 10 activities with a matching and a non-matching row, 3 extras).
- Select Outcome split: one matching outcome per activity (table in the draft). Attach Note rides on Create a Contact's outcome. Record Email Activity has no Select Outcome.
- Undocumented behaviour is carried as "(proposed, unconfirmed)".
- A non-matching outcome must not trigger the workflow; if it triggers, that is a bug. What the test checks on a non-matching row: nothing created or changed in Salesforce. A Logs row is allowed and its result is recorded (QA picked this after Claude wrongly assumed "Logs row = failure"; Claude must not restate it as "no Logs row").
- No running anything unless it is the script that will be run (QA, 2026-10-20).

## Open for QA before the draft is saved

1. How does an Update find its Salesforce record? Lead and Contact: by email (seen for Update a Lead in the Reply Received pilot). Account and Opportunity unknown. How is the record created first: Salesforce UI with the prospect's email, or the matching Create row run first? Claude's default: by email, record made in the Salesforce UI.
2. Do Uncategorized and Do Not Contact reach this trigger like the other outcomes? Do Not Contact may also stop the prospect in the sequence.
3. Does Record Email Activity log on every outcome change (no Select Outcome)? Claude's proposal: yes.

## Draft scenarios (not approved)

# Prospect Outcome is updated in Saleshandy: Regression scenarios

Environment: Staging (pyxis.lifeisgoodforlearner.com). Account: `sfoutcomeupdated`, Salesforce connected to the shared dev org (saleshandy-dev-ed). The workflow ticket is AL-4134 (parent AL-4131). No bug tickets are known for this trigger, so Ticket is None on every row. Scope is the trigger "Prospect Outcome is updated in Saleshandy" with all 10 activities: a matching and a non-matching outcome for each, plus a few extras.

Rows marked "(proposed, unconfirmed)" have an Expected that is not documented. Run them and record what happens. A different result is reported as unconfirmed, not as a bug, until QA confirms it. Records are always verified in Salesforce itself, because a Success row in Logs does not prove the record exists.

Not covered, still open: an outcome set by an email reply, custom outcomes, a second sequence, mapped versus unmapped field variations, Closing date other than 1 Day, special characters. Do not treat these as failures.

## Test data setup

- Field mapping (Settings > Integrations > Salesforce > Field Mapping) is saved on all four tabs before any row, copied from `context/salesforce/00-overview.md`.
- Triggers & Activity: turn every other trigger off. Enable only "Prospect Outcome is updated in Saleshandy", with one activity per row (Attach Note is saved together with Create a Contact). Fill Extra Configuration as given under each activity, then Save.
- Each row uses its own brand-new prospect, with a unique name and email, added to a launched sequence one at a time. Wait until step 1 shows Sent. The prospect starts at "Add Outcome".
- Update rows need the Salesforce record to exist first (open point 1).
- Change the outcome in Sequence > the sequence > Prospects, using the outcome dropdown.
- Matching rows: poll Salesforce for up to 3 minutes for the record. Non-matching rows: wait 3 minutes (or until a Logs row appears), refreshing Settings > Integrations > Salesforce > Logs 15 s after the change, then every 10 s. Log entries are not opened.
- Created data stays on the org (KEEP_TEST_DATA=1). Existing Salesforce records are never edited. 26 rows means 26 sends, inside the 40 a day send cap.

## Trigger behavior (baseline)

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Trigger off, no activity chosen | Turn on "Prospect Outcome is updated in Saleshandy", open the activity list | The list shows 10 activities: Create/Update Account, Contact, Lead, Opportunity, Attach Note, Record(log) an Email Activity. The Select box was disabled before the trigger was on | None |
| 2 | Trigger on | Choose "Create a Opportunity in Salesforce" | Extra Configuration opens with Closing date (while creating) in Days (0), Opportunity Stage (While creating) and Select Outcome (While creating opportunity) | None |
| 3 | Trigger on | Choose "Update a Opportunity in Salesforce" | Extra Configuration opens with Closing date (while updating) in Days (0), Opportunity Stage (While updating) and Select Outcome (while updating opportunity) | None |

## Create a Account in Salesforce

Extra Configuration: Select Outcome = Uncategorized.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with Company, no Account in Salesforce | Change outcome to Uncategorized | (proposed, unconfirmed) Exactly one Account with Account Name = Company and the mapped Account fields | None |
| 2 | Same setup, outcome not matching | Change outcome to Interested | Nothing created in Salesforce. Logs row, if any, is recorded | None |

## Update a Account in Salesforce

Extra Configuration: Select Outcome = Interested.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Account exists, prospect Company City changed in Saleshandy first | Change outcome to Interested | (proposed, unconfirmed) The same Account shows the new City, still one Account | None |
| 2 | Same setup, outcome not matching | Change outcome to Not Interested | Account unchanged. Logs row, if any, is recorded | None |

## Create a Contact in Salesforce

Extra Configuration: Select Outcome = Not Interested.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with all mapped fields, no Contact in Salesforce | Change outcome to Not Interested | Exactly one Contact with First Name, Last Name, Email, Business Phone, Department and Other City matching the prospect, and no Lead created | None |
| 2 | Same setup, outcome not matching | Change outcome to Meeting Booked | Nothing created in Salesforce. Logs row, if any, is recorded | None |

## Update a Contact in Salesforce

Extra Configuration: Select Outcome = Meeting Booked.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact exists, prospect Department and City changed in Saleshandy first | Change outcome to Meeting Booked | (proposed, unconfirmed) The same Contact shows the new Department and Other City, still one Contact | None |
| 2 | Same setup, outcome not matching | Change outcome to Out of Office | Contact unchanged. Logs row, if any, is recorded | None |
| 3 | No Contact for the prospect in Salesforce | Change outcome to Meeting Booked | (proposed, unconfirmed) Logs shows Success, no Contact created | None |

## Create a Lead in Salesforce

Extra Configuration: Select Outcome = Out of Office.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with all mapped fields, no Lead in Salesforce | Change outcome to Out of Office | Exactly one Lead with the mapped values (name, Email, Company, Title, Phone, City) | None |
| 2 | Same setup, outcome not matching | Change outcome to Closed | Nothing created in Salesforce. Logs row, if any, is recorded | None |
| 3 | A Lead with the prospect's email already exists | Change outcome to Out of Office | (proposed, unconfirmed) Still exactly one Lead for that email. The org duplicate rule is unread | None |

## Update a Lead in Salesforce

Extra Configuration: Select Outcome = Closed.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Lead exists, prospect Job Title and Phone changed in Saleshandy first | Change outcome to Closed | The same Lead shows the new Title and Phone, still one Lead | None |
| 2 | Same setup, outcome not matching | Change outcome to Not Now | Lead unchanged. Logs row, if any, is recorded | None |

## Create a Opportunity in Salesforce

Extra Configuration: Closing date = 1 Day, Opportunity Stage = Prospecting, Select Outcome = Not Now.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect with Deal Value, no Opportunity | Change outcome to Not Now | (proposed, unconfirmed) One Opportunity named with the prospect's email, Stage Prospecting, Close Date the next day, Amount = Deal Value | None |
| 2 | Same setup, outcome not matching | Change outcome to Do Not Contact | Nothing created in Salesforce. Logs row, if any, is recorded | None |

## Update a Opportunity in Salesforce

Extra Configuration: Closing date = 1 Day, Opportunity Stage = Qualification, Select Outcome = Do Not Contact.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Opportunity exists, prospect Deal Value changed in Saleshandy first | Change outcome to Do Not Contact | (proposed, unconfirmed) The same Opportunity shows Stage Qualification, the new Amount and Close Date the next day, still one Opportunity | None |
| 2 | Same setup, outcome not matching | Change outcome to Uncategorized | Opportunity unchanged. Logs row, if any, is recorded | None |

## Attach Note in Salesforce

Extra Configuration: None. Rows 1 and 2 use Create a Contact (Select Outcome = Not Interested) saved with it.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | New prospect, no Contact, Create a Contact and Attach Note saved | Change outcome to Not Interested | One Contact and one Note on it. (proposed, unconfirmed) Note content for an outcome change is not documented | None |
| 2 | Same pair, outcome not matching | Change outcome to Meeting Booked | No Contact and no Note in Salesforce. Logs row, if any, is recorded | None |
| 3 | Attach Note saved alone, no Contact activity | Change outcome to Interested | (proposed, unconfirmed) No Note created. Record the Logs status | None |

## Record(log) an Email Activity in Salesforce

Extra Configuration: Contact checked (Lead and Opportunity unchecked). It has no Select Outcome.

| # | Scenario | Do | Expected | Ticket |
|---|---|---|---|---|
| 1 | Contact exists for the prospect | Change outcome to Interested | (proposed, unconfirmed) One email activity on the Contact, with an empty description because no email is sent | None |
| 2 | Contact exists for a second new prospect | Change outcome to Closed | (proposed, unconfirmed) Also logged, since there is no Select Outcome to block it | None |

## Next

1. QA: "looks good" or changes on the draft, and answers to the 3 open points.
2. Claude: save to `test-cases/salesforce/prospect-outcome-updated.md` (run no-ai-slop QA Test Case Mode before QA's review), then the scope check (26 rows x 6 min about 2.6 h, under the 3 h cap).
3. Then stage 3, hand-written like HubSpot (memory: Salesforce hand-written specs): seed for `sfoutcomeupdated`, CSV via `npm run data:generate -- <slug>`, spec `tests/salesforce/prospect-outcome-updated.spec.ts`, page objects reusing `src/pages/saleshandy/salesforce-integration.page.ts`. Before any `playwright test`, read `knowledge-base/testing/how-to-test.md` "Test data" (KEEP_TEST_DATA=1 or TEST_DATA_ONLY=<slug>).
4. Check the sender interval on the Sending Settings page by eye before the first send.
