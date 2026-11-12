# Zoho: resume

Updated: 2026-11-12. All 7 Zoho workflows passed their production smoke and QA approved them (QA, 2026-11-04). Nothing is left to run. The status table is in `PROGRESS.md`. Per-workflow detail is in `<workflow>-progress.md`. History before 2026-11-12 stays in git.

## How we test Zoho

- Specs are hand-written (QA, 2026-10-29), in `tests/zoho/`, with flows in `src/flows/zoho-*.ts` and page objects in `src/pages/zoho/`.
- Email Sent runs on the Saleshandy account `gzoho`. The other six workflows run on `notemailsentzoho`, each with its own sequence, mailbox and prospects, in parallel (QA, 2026-10-30).
- Zoho CRM org is 941113438 (US data center, `crm.zoho.com`). The modules are Leads, Contacts, Accounts, Deals (shown as Potentials), Tasks and Notes.
- Zoho CRM cannot be read headless. It ends on "Verify your identity" at `accounts.zoho.com/account/v1/relogin`. A saved cookie file does not help. A saved browser profile does, in a headed browser on a virtual display (`xvfb-run`). See `scripts/zoho-read/README.md`.
- QA 2026-10-29: never read the Logs tab for Zoho. Look at the Zoho record only.

## Logins (deleted on 2026-11-12, log in again before the next Zoho run)

The disk cleanup of 2026-11-12 deleted every saved Zoho browser profile, because all of them had expired. Progress files and production notes still name them, as history.

- Production smokes: run `npm run mcp:open -- mcp-zoho-not-email-sent-profile https://crm.zoho.com` and log in. Each `run-zoho-*-smoke.sh` script copies this profile into its own `auth/zoho-<workflow>-smoke-profile` on the first run. Without it the script stops with "Missing".
- Zoho reads and the Email Sent staging run: run `npm run mcp:open -- mcp-zoho-profile https://crm.zoho.com` and log in.
- Saleshandy sessions: `npm run login:saleshandy -- <account>`. Zoho session file: `npm run login:zoho -- <account>`.
- A script that finds an expired Zoho profile now deletes it and stops with "Login expired" (exit code 3). `npm run profiles:prune` lists expired profiles.

## Open items

- `OPENED_TRIGGER` in `src/flows/zoho-link-clicked.ts` says "Sequence Email is Opened in Saleshandy". The screen says "Email is Opened in Saleshandy". Link Clicked Combined 2 depends on it.
- Bugs QA filed: AL-4198 (empty Task Subject keeps the old Subject), AL-4199 (Deal Pipelines and Stages not selectable), AL-4218 (Account and Deal make two accounts), AL-4219 (Reply Received). Check Jira for their current state.
- Email Sent Combined 1 failed in 1 of 2 runs with a double execution (one email, 2 executions). If it repeats, QA files it.
- Not set up on purpose: Conversation Category gate 5 needs a real reply in Unified Inbox (QA, 2026-10-31).
- Jira comment drafts for the smokes are in `jira/drafts/`. QA sends them with `npm run jira`.

## Files

- `00-overview.md`: how the integration works and the seven workflows.
- `field-mapping.md` and `staging-walkthrough.md`: field mapping, trigger state, deal stages, Task fields.
- `research.md`: 26 manual test ideas.
- `EXPLORATION-RESUME.md`: the exploration of 16 unconfirmed rows (done, kept for reference).
- Test cases: `test-cases/zoho/<workflow>.md`. Production notes: `notes/production-testing/16` to `21`.
