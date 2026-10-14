# Production smoke tests

One short checklist per workflow, numbered. Scope and rules: see
"Scope and rules" below.

| # | File | Trigger | Tickets | Result |
|---|---|---|---|---|
| 01 | [01-email-opened.md](01-email-opened.md) | Sequence Email is Opened in Saleshandy | AL-4013, AL-4126, AL-4128 | Not run (script: tests/hubspot/email-opened-smoke.spec.ts) |
| 02 | [02-link-clicked.md](02-link-clicked.md) | Link is Clicked in Saleshandy | AL-4014, AL-4103, AL-4120, AL-4121, AL-4122, AL-4123, AL-4127 | Not run (script: tests/hubspot/link-clicked-smoke.spec.ts, 11 tests) |

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
  - Sender dharmesh+prodint@saleshandy.com: 15 emails per day in total, and the
    Default Schedule can be closed in the evening (step 1 stays "Scheduled"),
    so the specs use Send now for step 1.
  - Custom tracking domain link.saleshandy.com on the account; field mapping
    saved on the account. Extra Configuration cannot be cleared once saved.
  - Cloudflare blocks headless login: QA logs in headed
    (`npm run login:saleshandy -- emailopenedprod`, `npm run login:hubspot`).
  - Each workflow needs its own production sequence (settings differ, e.g.
    Track email opens or Track Link Clicks with 2 links); its id and step 1
    subject go in `SMOKE_SEQUENCE_ID` and `SMOKE_STEP1_SUBJECT`.
- **Production timing:** the first open counts 60 s after sending, a second
  open 120 s after the first; a click registers within 1 to 1.5 min; the log
  shows 1 to 3 min after that (Update a Deal about 7.5 min on staging).
- **Not allowed:** exploring production through MCP, and any Jira write
  without QA's OK.
