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
| 10 | [10-pipedrive-prospect-outcome-updated.md](10-pipedrive-prospect-outcome-updated.md) | Prospect Outcome is updated in Saleshandy (Pipedrive) | None (baseline, no fixed bug) | **Released. Production smoke closed by QA 2026-10-30: 9 of 9 passed at least once.** Open doubt, not filed: the three-activity save (Create a Lead, Create a Deal and Create a Person) lost one activity in 2 runs. 9 checks (8 matching, 1 non-matching), 9 sends. Create a Lead, Create a Deal and Create a Person are one row. Same gate as note 09. Pipedrive company saleshandy.pipedrive.com. Script: tests/pipedrive/prospect-outcome-updated-smoke.spec.ts, command: npm run smoke:pipedrive-outcome-updated |
| 11 | [11-pipedrive-link-clicked.md](11-pipedrive-link-clicked.md) | Link is Clicked in Saleshandy (Pipedrive) | None (baseline, AL-4175 is the workflow ticket) | **Released. Script run 2026-10-29: 11 of 11 passed (script runs plus reruns, QA ran checks 3 and 4 by hand).** Short manual smoke by QA 2026-10-28: checks 1, 5 and 11 Pass, summary posted on AL-4175 (comment 79527). 11 checks, 10 sends. Same gate as note 09. Pipedrive company saleshandy.pipedrive.com. Script: tests/pipedrive/link-clicked-smoke.spec.ts, command: npm run smoke:pipedrive-link-clicked |
| 12 | [12-pipedrive-email-bounced.md](12-pipedrive-email-bounced.md) | Email is Bounced in Saleshandy (Pipedrive) | None (baseline, AL-4183 is the workflow ticket) | **Released. Script run 2026-10-29: 11 of 11 passed** (first run 9 of 11, checks 1 and 4 failed, both passed on rerun with new test data). Summary sent on AL-4183. Short manual smoke by QA 2026-10-28: checks 1, 6 and 11 Pass (comment 79528). 11 checks, 1 send (check 11, real bounce). Same gate as note 09. Pipedrive company saleshandy.pipedrive.com. Script: tests/pipedrive/email-bounced-smoke.spec.ts, command: npm run smoke:pipedrive-email-bounced |
| 13 | [13-pipedrive-email-opened.md](13-pipedrive-email-opened.md) | Email is Opened in Saleshandy (Pipedrive) | None (baseline, AL-4174 is the workflow ticket) | **Released. Script run 2026-10-30: 9 of 9 passed over two runs** (first run 8 of 9, check 7 Create Organization failed, passed on rerun with new data, cause not proven, not a product bug). Sequence 987038. Summary sent on AL-4174. 9 checks, 9 sends (check 2 opens twice). Create a Lead, Create a Deal and Create a Person are one row. Same gate as note 09. Pipedrive company saleshandy.pipedrive.com. Script: tests/pipedrive/email-opened-smoke.spec.ts, command: npm run smoke:pipedrive-email-opened |
| 14 | [14-pipedrive-unsubscribed.md](14-pipedrive-unsubscribed.md) | Prospect is Unsubscribed in Saleshandy (Pipedrive) | AL-4177, AL-4178, AL-4179, AL-4180, AL-4185 (AL-4176 is the workflow ticket) | **Released. Script run 2026-10-29: 10 of 10 passed (2 on rerun).** Six Jira drafts (AL-4176, 4177, 4178, 4179, 4180, 4185) written for QA to send. 10 checks, 10 sends. Create a Lead, Create a Deal and Create a Person are one row. Checks 1 and 2 use the real unsubscribe link, the rest Mark as Unsubscribe in the UI. QA saves "Unsubscribe as Link" on the new sequence by hand. Same gate as note 09. Pipedrive company saleshandy.pipedrive.com. Script: tests/pipedrive/unsubscribed-smoke.spec.ts, command: npm run smoke:pipedrive-unsubscribed |
| 16 | [16-zoho-email-opened.md](16-zoho-email-opened.md) | Sequence Email is Opened in Saleshandy (Zoho) | None (baseline, AL-4193 is the workflow ticket) | **Approved by QA 2026-11-02, not run yet.** 7 checks, 7 sends (check 2 opens twice). Gate first (Zoho connected, field mapping complete). Zoho CRM org crm.zoho.com. Script: tests/zoho/email-opened-smoke.spec.ts, command: npm run smoke:zoho-email-opened |
| 17 | [17-zoho-link-clicked.md](17-zoho-link-clicked.md) | Link is Clicked in Saleshandy (Zoho) | None (baseline, AL-4194 is the workflow ticket) | **Script run 2026-11-03: 8 of 8 passed (37.6 min, sequence 988717 on emailopenedprod).** Two earlier runs the same day did not reach a click: run 1 stopped at the gate-side trigger guard (Email is Opened was on), run 2 failed on a script row finder that did not match production tables (fixed). Summary for AL-4194 drafted, not sent. 8 checks, 8 sends (check 2 clicks twice). Gate first (Zoho connected, field mapping complete). AL-4198 not repeated (verified on production through Email Sent). Zoho CRM org crm.zoho.com. Script: tests/zoho/link-clicked-smoke.spec.ts, command: npm run smoke:zoho-link-clicked |
| 18 | [18-zoho-email-bounced.md](18-zoho-email-bounced.md) | Email is Bounced in Saleshandy (Zoho) | None (baseline, AL-4195 is the workflow ticket) | **Run 2026-11-03 on production: 8 of 8 passed in one run (18.6 min, sequence 989765, account emailopenedprod).** Two earlier attempts the same day did not count: the first used the Email Sent smoke sequence 988717 by mistake, the second stopped at setup because a listed sender was gone. 8 rows, 1 send (row 8, real bounce). Gate first (Zoho connected, field mapping complete). Zoho CRM org crm.zoho.com. Script: tests/zoho/email-bounced-smoke.spec.ts, command: npm run smoke:zoho-email-bounced |
| 19 | [19-zoho-reply-received.md](19-zoho-reply-received.md) | Reply is Received in Saleshandy (Zoho) | None (baseline, AL-4192 is the tracking ticket, AL-4219 is the fix to confirm) | **Approved by QA 2026-11-03, not run yet.** The AL-4219 fix is not deployed on production, so QA runs it after the deploy. Sequence 989765 (given by QA). 8 checks, 8 sends. Gate first (Zoho connected, field mapping complete). Zoho CRM org crm.zoho.com. Script: tests/zoho/reply-received-smoke.spec.ts, command: npm run smoke:zoho-reply-received |
| 20 | [20-zoho-conversation-category-updated.md](20-zoho-conversation-category-updated.md) | Conversation Category is Updated in Saleshandy (Zoho) | None (baseline, no workflow ticket known) | **Approved by QA 2026-11-04, not run yet.** The workflow is not deployed on production, so QA runs it after the deploy. 8 checks, 8 sends. Gate first (Zoho connected, field mapping complete), then the setup spec makes the day's sequence. Zoho CRM org crm.zoho.com. Script: tests/zoho/conversation-category-updated-smoke.spec.ts, command: npm run smoke:zoho-conversation-category-updated |
| 15 | [15-pipedrive-reply-received.md](15-pipedrive-reply-received.md) | Reply is Received in Saleshandy (Pipedrive) | AL-4184, AL-4186, AL-4187, AL-4188 (AL-4172 is the workflow ticket) | **Released. Script run 2026-10-30: 9 of 9 passed** (sequence 987027, 14.3 min). QA sent the comments on AL-4172, AL-4184, AL-4186, AL-4187 and AL-4188. 9 checks, 9 sends. Same gate as note 09. Pipedrive company saleshandy.pipedrive.com. Script: tests/pipedrive/reply-received-smoke.spec.ts, command: npm run smoke:pipedrive-reply-received |

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
