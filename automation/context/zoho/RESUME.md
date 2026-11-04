# Zoho: resume

Date: 2026-10-29. QA answers (2026-10-29): hand-written specs; Email Sent first; logins run and `dharmesh+gzoho@saleshandy.com` exists; modules Leads, Contacts, Accounts, Deals in org 941113438 (to confirm in Zoho CRM). Fixed 2026-10-29: MCP server `playwright-zoho` (`.mcp.json`, visible window, profile `auth/mcp-zoho-profile`) keeps the Zoho login. Zoho CRM org 941113438 opens without the relogin page. Modules seen in the top menu: Leads, Contacts, Accounts, Potentials (Deals), Tasks, Events, Calls, Campaigns, Documents, Visits, Projects. Old blocker (cookie file only): a headless run with the session saved 08:46 still ends on `accounts.zoho.com/account/v1/relogin` ("Verify your identity"), so Zoho CRM is not reachable by script. Phase: Saleshandy side of the staging walkthrough done (`staging-walkthrough.md`, trigger dropdowns added 2026-10-29). Zoho CRM side not reached. No test cases, no specs yet.

## Done

- Second Zoho login (2026-10-29): `auth/mcp-zoho-not-email-sent-profile` is a copy of `auth/mcp-zoho-profile`, made while the first was open (lock files and caches left out). MCP server `playwright-zoho-not-email-sent` in `.mcp.json` uses it, for account `notemailsentzoho` (all workflows except Email Sent). A headed run on the copy opened `crm.zoho.com/crm/org941113438/tab/Contacts` with no relogin page. The session needs a restart to load the new MCP server.

- Login setup. Platform `zoho` in `src/config/environments.ts` (login URL from QA, US data center). Account `gzoho` in `src/config/accounts.ts`. Script `npm run login:zoho -- gzoho`. QA has not run the logins yet.
- Public research: `research.md` (26 manual test ideas).
- Context from developer logs: `00-overview.md` and seven workflow files. Source is `integration-skills/test-logs/zoho/`.

- Field mapping, trigger state and the first Email Sent run (QA, 2026-10-29): `field-mapping.md`. Deal stages, Task fields and modules: `staging-walkthrough.md`.

## Not done

- QA runs `npm run login:saleshandy -- gzoho` and `npm run login:zoho -- gzoho`.
- QA confirms that `dharmesh+gzoho@saleshandy.com` exists on staging.
- QA chooses the Zoho field mapping for the tests.
- Staging walkthrough of the Zoho screens in Saleshandy (connect, Field Mapping, Triggers & Activity, Logs).
- Page objects in `src/pages/zoho/` and a flow `src/flows/saleshandy-to-zoho.ts`.
- Test cases (`/workflow-testing <workflow>, Zoho, regression`). The skill first asks whether you want a hand-written spec or the Playwright agents.

## Open questions for QA

1. Hand-written specs (as for Pipedrive and Salesforce) or the Playwright agents?
2. Which workflow first? Suggested: Email Sent, because it has the most developer evidence.
3. Does the Zoho test org have Leads, Contacts, Accounts and Deals enabled? Which org?
4. Are the bugs Z-1 to Z-6 still the same on current staging?
5. Jira: no Zoho workflow tickets exist. Which epic holds the new ones (AL-3982?)
6. Answered 2026-10-29: QA pasted the Triggers & Activity list. Seven workflows (Email Sent, Reply Received, Link Clicked, Email Opened, Conversation Category Updated, Email Bounced, Prospect Unsubscribed). No "Prospect is Finished" workflow, so none is needed.

- 2026-10-29, QA: no bug from the first Email Sent run. Ten of 11 mapped Contact fields synced. Phone Number was empty on the prospect. The company fields are a mapping gap on the Contact type. Next: duplicate rules, then Email Sent test cases.

- 2026-10-29: Email Sent exploration, see `email-sent-progress.md`. Open: duplicate Task and Deal records per event (QA decision), Task second event, test cases not yet saved.

- 2026-10-29, QA OK: Email Sent test cases saved in `test-cases/zoho/email-sent.md` (24 rows). Next: page objects in `src/pages/zoho/`, flow `src/flows/saleshandy-to-zoho.ts`, spec `tests/zoho/email-sent.spec.ts` (hand-written). Zoho reads need a headed browser (xvfb) with `auth/mcp-zoho-profile`. QA decision pending: duplicate Task and Deal records when the contact is new.

- 2026-10-29, end of day, Email Sent: spec `tests/zoho/email-sent.spec.ts` (15 rows), flow `src/flows/zoho-email-sent.ts`, data script `scripts/make-zoho-email-sent-data.ts` written. `Lead: 1` passes. The other 14 rows have not run (stopped for low memory, about 4 emails sent). Next: free memory, run the rows in small groups, then write the rows that need a hand-made Zoho record. Details: `email-sent-progress.md`, sections "Code written" and "Run status". QA decision pending: duplicate Task and Deal records when the contact is new.

- 2026-10-30, QA OK: Email Opened test cases saved in `test-cases/zoho/email-opened.md` (25 rows, account `notemailsentzoho`, Mailinator open). Progress and next steps: `email-opened-progress.md`. Next: sequence "Zoho Email Opened QA", then the hand-written spec `tests/zoho/email-opened.spec.ts`. No page objects, flow, data or spec yet.

- 2026-10-30, QA OK: Email Bounced test cases saved in `test-cases/zoho/email-bounced.md` (23 rows after the cuts, account `notemailsentzoho`, Mark as bounced plus 1 real bounce). Progress and next steps: `email-bounced-progress.md`. Next: sequence "Zoho Email Bounced QA", then the hand-written spec `tests/zoho/email-bounced.spec.ts`. No sequence, data or spec yet.

- 2026-10-30: QA wants one account and parallel workflows (`notemailsentzoho`, own sequence and prospects each). Link Clicked test cases saved in `test-cases/zoho/link-clicked.md` (23 rows after cuts), QA "looks good" received. Progress: `link-clicked-progress.md`. Track email opens is OFF in the Link Clicked sequence so a click does not fire Email Opened; the first run checks it.

- Progress table: `PROGRESS.md` in this folder (QA format, 2026-10-30). Show it when QA asks for progress.
- 2026-10-30: Link Clicked spec written (23 tests, typechecks), sequence waits for a sender mailbox. See `link-clicked-progress.md` "Parallel-run notes".

- 2026-10-30, QA OK ("looks great"): Prospect Unsubscribed test cases saved in `test-cases/zoho/prospect-unsubscribed.md` (20 rows, account `notemailsentzoho`, UI unsubscribe plus 3 link rows). QA asked for cases only, no script yet. Progress: `prospect-unsubscribed-progress.md`.

- 2026-10-30, QA OK: Conversation Category Updated test cases saved in `test-cases/zoho/conversation-category-updated.md` (20 rows, account `notemailsentzoho`). QA wants test cases only, no script yet. Progress: `conversation-category-updated-progress.md`.
- 2026-11-02 night, Reply Received: 7 passed, 26 failed, 1 skipped. Blocked on QA OK to read Zoho Logs once. Resume section: `reply-received-progress.md` "Resume here (saved 2026-11-02 night)".
- 2026-11-03, QA: Link Clicked is LIVE on production. Production smoke 8 of 8 passed (note `notes/production-testing/17-zoho-link-clicked.md`, sequence 988717), AL-4194 comment sent, sheet row 25 written. Nothing left to run. See `link-clicked-progress.md` "LIVE on production".
- 2026-11-03: Reply Received production smoke written (note 19, spec, run script, data), sequence 989765, headless read-only walk-through done (no script change), not run: waits for the AL-4219 deploy, QA runs `npm run smoke:zoho-reply-received` (login first). Read reply-received-progress.md "Production walk-through".
- 2026-11-04: Conversation Category production smoke written (note 20, spec, setup, data, run script), typechecked, not run: the workflow is not deployed on production. QA runs `npm run smoke:zoho-conversation-category-updated` after the deploy (login first). Read conversation-category-updated-progress.md "Production smoke".
- 2026-11-04: Prospect Unsubscribed production smoke written (note 21, spec, setup, data, run script), typechecked, not run. Sequence 990987 now has step 2 and Unsubscribe as Link. QA runs `npm run smoke:zoho-prospect-unsubscribed` (login first). Read prospect-unsubscribed-progress.md "Production smoke".
