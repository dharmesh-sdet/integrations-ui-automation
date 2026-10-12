# Company Created/Properties Updated in HubSpot: progress (resume here)

Status: **PARKED** (QA, 2026-10-09). The workflow does not trigger: creating
a company in HubSpot produces no log on the Saleshandy account. Resume only
after the cause below is found.

Last session: 2026-10-09 (saved at QA's request). Skill: `ui-test-from-workflow`. Stage 3 (script),
step 3b (MCP walkthrough) stopped at the first end-to-end check. Spec
(`tests/hubspot/company-created.spec.ts`) not written yet.

Read first: `context/hubspot/company-created.md` (context, UI labels, Extra
Configuration, how to execute), `test-cases/hubspot/company-created.md`
(approved scenarios, chain order).

## Blocker: the workflow does not run

- Saleshandy account `dharmesh+companycreated@saleshandy.com`: trigger
  "Company Created/Properties Updated in Hubspot" ON, activity "Add Prospect
  in Saleshandy" only, saved (checked after reload). All other triggers off.
- HubSpot shared portal 247419080: company "Notion No Contact"
  (no-contact-1.notion.com, record 350868702944) created 2026-10-09 13:55 IST.
- Settings > Integrations > HubSpot > Logs still said "No logs yet" at
  14:13 IST (18 min later). The account has never had a log entry. QA also
  created a company "workflow trigger" (record 351264611046) around then;
  no log either.
- Likely causes, to check in this order:
  1. The account may be connected to a different HubSpot portal than
     247419080 (check the Integration tab / HubSpot Connected apps).
  2. One HubSpot portal is connected to several Saleshandy accounts
     (linkclick, companycreated, ...); HubSpot may deliver events to only one
     of them.
  3. Refold (third-party workflow service) not firing for a new connection.
     Related: AL-4059 (company property updates do not trigger; In Progress).
- Timing risk for later: the Company Created event fires when the company is
  saved, and contacts are associated after that (the create form has no
  contact field). Rows with contacts work only if the workflow reads the
  company's contacts when it runs, not when the company is saved. The first
  working run will show which.

## Next steps when resuming

0. Logins: the shared HubSpot test login (`auth/hubspot-chromium.json`)
   expired on 2026-10-09 ("authentication has expired due to inactivity");
   QA refreshed it at 14:43 the same day. If specs stop at once with "hubspot login expired", QA runs
   `npm run login:hubspot -- companycreated`. The MCP browsers are headless
   now: if one shows a login page, use `npm run mcp:open` (see
   `context/project.md`).
1. Find the cause above with QA (or a dev); get a Company Created log to
   appear for a new company on this account.
2. Repeat the two first rows by hand in the MCP browser:
   baseline ("Notion No Contact": expect Success, nothing changes) and
   Add Prospect 1 (company + C1 associated right away: expect C1 added as a
   prospect). This answers the timing risk.
3. Delete the walkthrough records listed below (HubSpot record > Actions >
   Delete > Restorable). Their CSV rows are already refreshed; nothing else
   to do for the data.
4. Walk the remaining activities (Move, Tag A created in the Assign a tag
   modal, Paused, Resume, Replied, Finished, Unsubscribed, Blacklist) one at
   a time, in the chain order of the scenarios file.
5. Write `tests/hubspot/company-created.spec.ts` (stage 3c). Reusable from
   the Link Clicked session (added 2026-10-09): `contacts.page.ts`
   `associations(contactId, 'companies')` to confirm a contact's companies,
   and `deals.page.ts` (fixture `hubspotDeals`). HubSpot record pages need a
   window at least 1280 px wide, or the right sidebar is hidden. Run it on
   staging and fix script errors until stable (tell the other sessions
   before each run; runs take turns), then QA runs it.

## Open items from the last session (2026-10-09, end of day)

- Logs not checked since 14:13 IST: a late Company Created entry may have
  arrived. Check Logs first when resuming.
- `npm run mcp:open` (visible window for a stuck headless MCP browser,
  `scripts/open-mcp-browser.ts`) is written and typechecks but has never
  been run. If it fails the first time, stop and report the exact error.
- After a Claude restart, approve the `playwright-companycreated` MCP server
  (`/mcp`) before the walkthrough; it is headless now.
- Deal Properties mapping (Deal Value > Amount, Closing Date > Close Date) is
  in `src/config/account-setup.ts` but the setup spec has not been run since.
  Run it on companycreated before the next walkthrough.

## Done

- Stage 1 and 2: context and scenarios saved and approved (Regression,
  Created path only, 6 contacts C1 to C6 reused in a chain, one new company
  per row, minimal data).
- Account setup automated and stable: `tests/setup/account-setup.spec.ts`
  (`SETUP_ACCOUNT=companycreated REPORT_OPEN=never npm test -- tests/setup/account-setup.spec.ts --workers=1`).
  Field mapping Contact 22 pairs (Birthday skipped), Company 15 pairs, Deal
  2 pairs (added to the config 2026-10-09, not yet run on companycreated);
  Sequence A (id 196223) and Sequence B (id 196253), Draft, one Email step
  from Template 1 with heading "<Sequence> - Step 1 A".
- Test data generated: `test-data/hubspot/company-created.csv` (C1 to C6,
  @mailinator.com) and `company-created-companies.csv` (20 rows: scenario,
  contact labels, company name, domain).
- HubSpot page object `src/pages/hubspot/companies.page.ts` (fixture
  `hubspotCompanies`): createCompany, associateContacts. Walked and working.
  Shared with the Link Clicked session.
- All 9 activities' UI labels and Extra Configuration fields recorded in the
  context file. The Select box is disabled until the trigger is on;
  cancelling an Extra Configuration dialog leaves the activity selected
  (unsaved).
- Blacklist a domain uses the contact's email domain (mailinator.com): the
  spec must remove it from the Do Not Contact list after the check (QA).

## Records left on staging (walkthrough, to delete when resuming)

- HubSpot contact C1 Caio Carvalhaes, caio.carvalhaes@mailinator.com, record
  564546424562 (job title typed by mistake as "Partnerships Manager"; CSV says
  "Account Executive"). Its CSV row was already refreshed by a later test
  run's global setup: C1 is now Baptiste Rousseau, and C1's companies were
  renamed (e.g. "Substack No Contact"). Caio exists only in HubSpot now.
- HubSpot company "Notion Add Prospect 1" (add-prospect-1.notion.com),
  record 350868702935, C1 associated. Created while the trigger was off.
- HubSpot company "Notion No Contact" (no-contact-1.notion.com), record
  350868702944.
- Not ours, leave them: QA's "test company" (mailinator.com, 350727473879,
  Leonardo Figueiredo associated) and "workflow trigger" (351264611046).
- Saleshandy: trigger "Company Created/Properties Updated in Hubspot" left ON
  with Add Prospect so a late event still shows. Turn it off if it gets in
  the way.

## Working agreements (still apply)

- Other Claude sessions (Link Clicked) share `reports/`, `src/fixtures`,
  `src/pages`: message them before a test run and when changing a shared file.
- MCP browser for this workflow: server `playwright-companycreated`, profile
  `auth/mcp-companycreated-profile` (logins kept), headless with a 1440x900
  window. If it gets stuck on a login: `browser_close`, notify QA,
  `npm run mcp:open -- mcp-companycreated-profile <url>`.
- When blocked on QA (login, permission, decision): one desktop notification,
  then ask in chat.
- Report: one page `reports/report.html` (Integration > Workflow >
  Activity); failure reasons in `reports/failure-notes.json`, then
  `npm run report`.
