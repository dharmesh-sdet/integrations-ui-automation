# Production smoke tests

One short checklist per workflow, numbered. Scope and rules: see
"Scope and rules" below.

| # | File | Trigger | Tickets | Result |
|---|---|---|---|---|
| 01 | [01-email-opened.md](01-email-opened.md) | Sequence Email is Opened in Saleshandy | AL-4013, AL-4126, AL-4128 | Run 2026-10-14: 10 of 10 passed, 9 in run 2 and test 10 on its own re-run (script: tests/hubspot/email-opened-smoke.spec.ts). Jira comments drafted in jira/drafts, not sent |
| 02 | [02-link-clicked.md](02-link-clicked.md) | Link is Clicked in Saleshandy | AL-4014, AL-4103, AL-4120, AL-4121, AL-4122, AL-4123, AL-4127 | **Passed and production approved by QA, 2026-10-15.** Run 2026-10-15: 10 of 11 passed; test 10 failed only on the older-deal check, AL-4130 filed, developer says expected. Clicks wait 90 s first and 180 s second (developer). Sequence 974015. Jira drafts in jira/drafts, not sent |
| 03 | [03-email-bounced.md](03-email-bounced.md) | Email is Bounced in Saleshandy | AL-4016, AL-4125 | Run 2026-10-15: 10 of 10 passed, 8 in run 1 and tests 00 and 09 on their re-run after two script fixes (script: tests/hubspot/email-bounced-smoke.spec.ts, sequence 973942). Jira comment drafted in jira/drafts/al-4016-production-smoke-summary.json, not sent |
| 04 | [04-company-created.md](04-company-created.md) | Company Created/Properties Updated in HubSpot | AL-4009 (AL-4059 not covered) | Run 2026-10-15 (script, production): 00, 01, 02, 03, 04 passed; 05 Replied failed in the script (13.4 min, status not read) and QA validated it manually as passed; 06 Finished validated manually by QA as passed (2026-10-15); 07 Unsubscribed validated manually by QA as passed (2026-10-15); 08 Blacklist a domain validated manually by QA as passed (2026-10-15). Script: tests/hubspot/company-created-smoke.spec.ts, command: npm run smoke:company-created |
| 05 | [05-reply-received.md](05-reply-received.md) | Reply is Received in Saleshandy | AL-4011, AL-4129, AL-4119, AL-4118 | **Passed, all 9 activities Pass.** Run 2026-10-15 (script: tests/hubspot/reply-received-smoke.spec.ts, sequence 974166, account emailopenedprod): 7 of 11 passed; the 4 that failed in the script (02 Update a Contact, 08 Create a Note, 09 and 10 Record (log) an Email Activity) were checked manually by QA and confirmed Pass (QA, 2026-10-16). Summary comment sent to AL-4011, 2026-10-16 |
| 06 | [06-unsubscribed.md](06-unsubscribed.md) | Prospect is Unsubscribed in Saleshandy | AL-4015, AL-4162, AL-4163, AL-4164, AL-4165 | **Passed and production approved by QA, 2026-10-20.** All 9 activities Pass, tested with the real Unsubscribe link (script: tests/hubspot/unsubscribed-smoke.spec.ts). Jira drafts in jira/drafts, not sent |
| 07 | [07-salesforce-email-sent.md](07-salesforce-email-sent.md) | Email Sent from Saleshandy (Salesforce) | AL-4132, AL-4168 | **Approved by QA 2026-10-22, not run yet.** 10 checks, 8 sends; gate first (Salesforce connected, Field Mapping complete). Script: tests/salesforce/email-sent-smoke.spec.ts, command: npm run smoke:salesforce-email-sent |
| 08 | [08-salesforce-prospect-outcome-updated.md](08-salesforce-prospect-outcome-updated.md) | Prospect Outcome is updated in Saleshandy (Salesforce) | AL-4134 (no bug tickets) | **Approved by QA 2026-10-22, not run yet.** 11 checks (10 matching, 1 non-matching), 11 sends; gate first. Script: tests/salesforce/prospect-outcome-updated-smoke.spec.ts, command: npm run smoke:salesforce-outcome-updated |
| 09 | [09-pipedrive-email-sent.md](09-pipedrive-email-sent.md) | Email Sent from Saleshandy (Pipedrive) | None (baseline, no fixed bug) | **Passed, QA 2026-10-27.** Script run: 7 of 8 passed. Check 1 (Create a Lead + Create a Deal + Create a Person) failed in the script (no activity on the person; a later rerun with new data was still RUNNING after 3 min) and QA validated it manually as passed (person, lead, deal and one Email activity, Prachi Mahote). Sequence 983594. Script: tests/pipedrive/email-sent-smoke.spec.ts, command: npm run smoke:pipedrive-email-sent |
| 10 | [10-pipedrive-prospect-outcome-updated.md](10-pipedrive-prospect-outcome-updated.md) | Prospect Outcome is updated in Saleshandy (Pipedrive) | None (baseline, no fixed bug) | **Approved by QA 2026-10-27, not run yet.** 9 checks (8 matching, 1 non-matching), 9 sends. Create a Lead, Create a Deal and Create a Person are one row. Same gate as note 09. Pipedrive company saleshandy.pipedrive.com. Script: tests/pipedrive/prospect-outcome-updated-smoke.spec.ts, command: npm run smoke:pipedrive-outcome-updated |
| 11 | [11-pipedrive-link-clicked.md](11-pipedrive-link-clicked.md) | Link is Clicked in Saleshandy (Pipedrive) | None (baseline, AL-4175 is the workflow ticket) | **Approved by QA 2026-10-28, not run yet.** 11 checks, 10 sends. Same gate as note 09. Pipedrive company saleshandy.pipedrive.com. Script: tests/pipedrive/link-clicked-smoke.spec.ts, command: npm run smoke:pipedrive-link-clicked |

## Scope and rules

Sources: `test-cases/_SCENARIO_TEMPLATE.md` [project], the Email Opened and
Link Clicked production work [staging/production, 2026-10-14], QA answers
[QA, 2026-10-14].

- **Goal:** confirm the fixed tickets of a workflow hold on production after a
  deploy. Smoke is not regression (regression is staging, every variation).
- **Scope:**
  - 1 baseline check, then 1 to 3 checks per activity, in product UI order.
  - Built from fixed tickets only. Open or undeployed tickets go in a "Not
    covered, still open" paragraph and are never failures.
  - No post-deploy log monitoring: new error logs are not tracked after the
    smoke run (QA, 2026-10-14). Only the Logs entry of each check is read.
- **Files per workflow:**
  - Checklist `NN-<workflow>.md` (format of `01-email-opened.md`), QA approves
    it before any script.
  - Spec `tests/hubspot/<workflow>-smoke.spec.ts`, one test per check, same
    order, reusing the staging flow and page objects.
  - Data `test-data/hubspot/<workflow>-smoke*.csv` (gitignored, generated).
  - Result: one summary comment on the workflow's tracking ticket from
    `jira/templates/comments/04-production-smoke-summary.md`. QA sends it.
- **Production setup (seen 2026-10-14):**
  - URL my.saleshandy.com (`PROD_URL` overrides). Account `emailopenedprod`
    (`environment: 'production'` in `src/config/accounts.ts`), shared by the
    smoke specs, so one smoke run at a time and one trigger enabled at a time.
  - Senders (read on the Email Accounts page, 2026-10-22): Salesforce EmailSent
    SMTP Default (Rachelgreen47sh+3@gmail.com, 50 a day) and Rudra EmailSent
    SMTP (rudra+emailsentprod@saleshandy.com, 150 a day).
    dharmesh+prodint@saleshandy.com (15 a day, used for the HubSpot smoke runs
    until 2026-10-20) is no longer on the account. Read the page again before
    sizing sends. The Default Schedule can be closed in the evening (step 1
    stays "Scheduled"), so the specs use Send now for step 1.
  - Custom tracking domain link.saleshandy.com on the account; field mapping
    saved on the account. Extra Configuration cannot be cleared once saved.
  - Cloudflare blocks headless login: QA logs in headed
    (`npm run login:saleshandy -- emailopenedprod`, `npm run login:hubspot`).
  - Each workflow needs its own production sequence (settings differ, e.g.
    Track email opens or Track Link Clicks with 2 links); its id and step 1
    subject go in `SMOKE_SEQUENCE_ID` and `SMOKE_STEP1_SUBJECT`.
- **Production timing:** the first open counts 60 s after sending, a second
  open 120 s after the first; a first click counts only 90 s after sending and
  a second click 180 s (developer, 2026-10-15; a click made about 1 min after
  sending was never counted); the log shows 1 to 3 min after that (Update a
  Deal about 7.5 min on staging).
- **Not allowed:** exploring production through MCP, and any Jira write
  without QA's OK.
