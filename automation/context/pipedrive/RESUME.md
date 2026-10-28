# Pipedrive: resume (saved 2026-10-23, State section updated 2026-10-28)

Staging, workflow version v2. Rules and behaviour: `00-overview.md` and one file per workflow in this folder.

## State (QA, 2026-10-28)

Status as QA gave it, except the Link Clicked row, which holds Claude's 2026-10-28 run results and QA's go-ahead for production. The per-workflow progress files and the dated sections below hold older run numbers. If they differ, this table wins.

| Workflow | Test cases | State |
|---|---|---|
| Email Sent | `../../test-cases/pipedrive/email-sent.md` (33 rows) | All 33 rows passed, 1 skipped. The only skip in the spec is Create a Person 4, where a mapped value has the wrong type. It needs a wrong-type Contact Fields mapping on the Configure screen. QA is not sure about this skip. Production smoke (note 09) passed, QA 2026-10-27: 7 of 8 checks passed in the script, and QA ran check 1 by hand and it passed. The workflow is live in production. The slow and doubled runs on automated sends stay open under AL-4177. |
| Prospect Unsubscribed | `../../test-cases/pipedrive/prospect-unsubscribed.md` (29 rows) | Its tickets are fixed. |
| Prospect Outcome Updated | `../../test-cases/pipedrive/prospect-outcome-updated.md` | Done on staging. Production smoke is written, not run, blocked by the Refold deploy issue. |
| Link Clicked (AL-4175) | `../../test-cases/pipedrive/link-clicked.md` (32 rows) | Done on staging, 2026-10-28. All 32 rows passed: 28 in the full run (48.5 min), 4 on reruns after script fixes. The 4 were script failures: 3 from the People reader skipping rows, 1 because the company already had organizations (Delete Organization 2). Not run as one suite after the fixes. Sequence 197376, `PD_LINK_SEQUENCE_ID=197376`. Known product issues are recorded, not filed (B1, B2, AL-4177). QA, 2026-10-28: ready for production. Production smoke: cases approved by QA 2026-10-28 (`../../notes/production-testing/11-pipedrive-link-clicked.md`, 11 checks, 10 sends), spec, setup spec, data script and run script written, typecheck clean, NOT run. QA runs it: `npm run smoke:pipedrive-link-clicked`. Update 2026-10-28 evening: released to production, QA ran a short manual smoke, checks 1, 5, 11 Pass, summary posted on AL-4175 (comment 79527). Details: `link-clicked-progress.md`. |
| Reply Received (AL-4172), Email Opened (AL-4174), Email Bounced (AL-4183) | `../../test-cases/pipedrive/<workflow>.md` (33, 27 and 37 rows) | As QA gave it on 2026-10-28: cases approved and scripts generated, not run, sequences not created (Email Bounced has an empty draft). Other sessions have worked on these since. Read their progress files for the current state. |

`drafts/gen.py` built the first six drafts. They are history now. The approved cases are in `test-cases/pipedrive/`.

## Decisions (QA, 2026-10-23)

- No "Run is completed" in the UI. A run is done when the prospect's row in the Emails tab, Scheduled/Sent column, shows "Sent". Then wait 15 s, look in Pipedrive first, Logs only if the record is missing.
- Expected Close Date is not mapped or tested (date conversion issue seen on HubSpot). No Create a Deal row for Deal Fields beyond Value.
- Test cases must be realistic, no matrix-style filler.
- Saleshandy to Pipedrive field pairings: the public article (docs.saleshandy.com/en/articles/8026998) came back with its table flattened, so it gives no usable pairings. The Staging Configure screen is the authority.

## Finding (QA, 2026-10-23, Create a Deal)

Mapping Organization to Saleshandy Company makes the workflow fail with a wrong organization id. Pipedrive's Organization field needs an organization ID chosen from the dropdown, not free text. Bug or not: not decided. Planned rows (not added, QA has not agreed): Create a Deal and Create a Person, "Organization mapped to Company", expected Error, nothing created (proposed, unconfirmed). Do not map Organization to Company in other rows.

## Wiring (done 2026-10-23, typecheck passes, no login tested)

- Platform `pipedrive` in `src/config/environments.ts` (`https://app.pipedrive.com`, `/auth/login`). Script `npm run login:pipedrive -- <account>`.
- Accounts in `src/config/accounts.ts`: pdemailsent, pdreplyreceived, pdlinkclicked, pdemailopened, pdemailbounced, pdunsubscribed, pdoutcomeupdated. Address `dharmesh+<account>@saleshandy.com`, marked TODO(needs-input) until QA confirms. One Pipedrive company per workflow is the default, QA has not answered.
- `.mcp.json` (not tracked by git): `playwright-pd<workflow>` (Saleshandy side) and `playwright-pipedrive-<workflow>` (Pipedrive side) per workflow. Needs a Claude Code restart.
- Sessions: `auth/saleshandy-<account>-chromium.json`, `auth/pipedrive-<account>-chromium.json`. None saved yet.

## Update 2026-10-24 (QA)

- One account for now: `gpipedrive` (`dharmesh+gpipedrive@saleshandy.com`). Both sessions saved 2026-10-24 (`auth/saleshandy-gpipedrive-chromium.json`, `auth/pipedrive-gpipedrive-chromium.json`). Pipedrive company: `saleshandy.pipedrive.com`. Pipedrive is connected in Saleshandy, sender mailbox connected, OTP off. The `pd<workflow>` accounts stay unused.
- `.mcp.json`: `playwright-pdemailsent` and `playwright-pipedrive-emailsent` now point at the gpipedrive sessions. Needs a Claude Code restart.
- Specs are hand-written like HubSpot/Salesforce, not built with the Playwright agents (QA's answer; overrides rule 12 for Pipedrive).
- Built 2026-10-24 (typecheck passes): `src/pages/pipedrive/{pipedrive,people,deals,organizations}.page.ts` (create, read, delete of persons, deals, organizations; checked live with the throwaway spec `tests/setup/pipedrive-pages-check.spec.ts`, which passed and cleaned up after itself), `src/pages/saleshandy/pipedrive-integration.page.ts` (extends the Salesforce integration page: same triggers, activities and Logs; Extra Configuration is Pipeline then Stage), fixtures `pipedrive*`, shared flow `src/flows/saleshandy-to-pipedrive.ts`, CSV `test-data/pipedrive/email-sent.csv` (33 rows named like the test cases), `tests/setup/pipedrive-sequence.spec.ts`.
- Email Sent spec built and run once 2026-10-24: `tests/pipedrive/email-sent.spec.ts`, 18 of 33 rows passed, 6 failed, 3 skipped by design, 6 not finished. Read `email-sent-progress.md` first (row table, causes, next steps). QA, 2026-10-24: do NOT run the whole script again; run single failed or unrun rows only (`-g "<describe> <n>:"` with `REFRESH_USED_ONLY=1 TEST_DATA_ONLY=pipedrive/email-sent`), after the cause is understood.
- Seen by hand in Pipedrive 2026-10-24 (screenshots in `evidence/`), and the page objects now read it: a person page lists leads under History > Leads ("Lead created: <title>", the title links to `/leads/inbox/<id>`); a done activity is under History > Activities (`Activities (n)`), a not-done one stays under Focus and is not counted; the type (`data-cy-active="true"` on `activity-type-button-<Type>`) and the note (`activity-note`) show only in the Edit activity dialog that opens on a click on the title. A lead cannot be saved without a person or organization. Marking an activity done opens a "Schedule your next activity" prompt (Cancel). Deleting a person keeps its deals, leads and activities, and a deleted person's page still opens with a DELETED banner. `Create a Person` row: the activity type must be read as `Email` and the note as the email body.
- Page objects added: `leads.page.ts` (Leads Inbox: titles, countByTitle, deleteByTitle). `people.page.ts`: `leadTitles()`, `activities()` (subject, type, done, note), `activityCount()`. Checked: `tests/setup/pipedrive-pages-check.spec.ts` (person, deal, organization, passes); leads and activities checked against records made by hand, then cleaned up.
- Leftover from the by-hand checks: two done activities ("Email sent from Saleshandy") remain in Activities after their person was deleted; delete them in Pipedrive > Activities if QA wants a clean account.
- Pipedrive facts seen: pipeline "Pipeline" with stages Qualified, Contact Made, Demo Scheduled, Proposal Made, Negotiations Started; the 10 activity names end with " in Pipedrive"; people list rows are read by `data-test` cells (`person.name`, `person.email`); deleting a person leaves its deals.
- BLOCKED: sequence "Pipedrive Regression" (id 197336) has both steps but stays a Draft: activating it fails with "Attached email account is disconnected" on gpipedrive. QA must connect or reconnect the sender at /email-accounts, then rerun `SETUP_SEQUENCE=1 npx playwright test tests/setup/pipedrive-sequence.spec.ts --project=chromium` (it now activates an existing draft).
- Next: stage 1 walkthrough of Email Sent on the Configure screen (field pairings, one test send), confirm the "(proposed, unconfirmed)" rows, then write the spec.

## Open points

- QA: confirm account addresses and one Pipedrive company per workflow.
- QA: bug-or-not on the Organization finding, then whether to add its rows.
- Siblings: real-bounce cap of 1, outcome list on Pipedrive (Interested / Not Interested / Closed assumed), trigger methods copied from HubSpot/Salesforce.
- Workflow approach: CLAUDE.md rule 12 says Playwright agents. Zoho workflows come later.
- QA manual per account: create Saleshandy account, OTP off in Settings, connect Pipedrive, then `npm run login:saleshandy -- <account>` and `npm run login:pipedrive -- <account>`.

## Seen on staging 2026-10-24 (read-only walkthrough, Triggers & Activity, nothing saved)

- Each action added under "Prospect Outcome is updated in Saleshandy" opens its own Extra Configuration with "Select Saleshandy Conversation Category". The category is per action, as in Salesforce (the overview's single-gate wording is wrong for the UI).
- Category list: Interested, Not Interested, Closed, Meeting Booked, Do Not Contact, Out of Office, Not Now. No Uncategorized, no empty option in the list.
- Create a Deal modal: Pipeline (one: "Pipeline"), Stage (Qualified, Contact Made, Demo Scheduled, Proposal Made, Negotiations Started), Category.
- Action list in every slot: Create a Lead, Create a Deal, Create a Person, Update a Deal, Update a Person, Delete Deal, Delete Person, Create Organization, Update Organization, Delete Organization.
- Triggers on the screen: Email Sent, Reply is Received, Link is Clicked, Prospect is Unsubscribed, Email is Bounced, Email is Opened, Prospect Outcome is updated.

## Saved 2026-10-24 (QA "looks good")

- `test-cases/pipedrive/prospect-outcome-updated.md` (33 rows) and `test-cases/pipedrive/prospect-unsubscribed.md` (29 rows) saved after the no-ai-slop pass. Drafts: `drafts/revised/`. The other four sibling drafts in `drafts/` are still unapproved and are the older generic version.
- Next: stage 3 walkthrough on `gpipedrive`, then hand-written specs. The Email Sent session owns the shared Pipedrive page objects and the account's trigger settings; saving a trigger config on the same account changes what that session sees.

## Outcome Updated walkthrough, started 2026-10-24 (gpipedrive, staging)

- Created sequence "Pipedrive Outcome Updated QA" (id 197337): one email step (subject "Pipedrive outcome QA"), sender Kartik 5 (2kartiktest+5@gmail.com), prospect Tomas Brandl (tomas.brandl.pdo1@mailinator.com, Brandl Logistics, Hamburg). NOT started, nothing sent, no trigger config saved. The Email Sent session's sequence is "Pipedrive Regression" (197336, senders Kartik 2, 3, 4); untouched.
- Prospect Outcome dropdown on the Prospects tab (checked by search, 2026-10-24): Uncategorized, Interested, Not Interested, Meeting Booked, Out of Office, Closed, Not Now, Do Not Contact. Do Not Contact sits below Not Now and needs a scroll or a search. An earlier note here said it was missing; that was wrong. Pipedrive's category list has Do Not Contact but not Uncategorized, so Uncategorized is testable only through a skipped category.
- Blocker for rows that say "prospect not in Pipedrive": Email Sent is saved ON with Create a Person on this account, so a step 1 send creates the person first. Needs Email Sent off while the Outcome rows run, or a separate account.
- Default Sending Schedule skips Saturday (new step shows "Sending as a new email on Mon 26th Oct"). Use Send now on the Emails tab.

## Pending as of 2026-10-24 (end of day, QA runs scripts on Monday 2026-10-26)

Pipedrive (account gpipedrive, hand-written specs, sessions saved 2026-10-24)
1. Email Sent: other session. Walkthrough, page objects, spec. Owns `playwright-pdemailsent` / `playwright-pipedrive-emailsent`, sequence 197336 "Pipedrive Regression" (Kartik 2, 3, 4).
2. Prospect Outcome Updated: cases saved (33 rows, `test-cases/pipedrive/prospect-outcome-updated.md`). To do: finish walkthrough (sequence 197337, sender Kartik 5, prospect Tomas Brandl already made), Pipedrive page objects, CSV, spec. Blocker: Email Sent is saved ON with Create a Person, so "prospect not in Pipedrive" rows need it OFF, or a second account. QA decision pending.
3. Prospect Unsubscribed: cases saved (29 rows). Same to-do list and same blocker. Uses Mailinator for the 5 link rows.
4. Reply Received, Link Clicked, Email Opened, Email Bounced: only the older generic drafts in `drafts/`. Rebuild like the two above (per-action rows from the HubSpot file of the same trigger), QA "looks good", no-ai-slop pass, save, then spec.
5. Shared: Pipedrive page objects (people, deals, organizations, leads, activities) are being written by the Email Sent session; reuse them, do not duplicate.

Salesforce (from HANDOFF.md, 2026-10-23)
- Reply Received: 40-test spec, 13 pass, 27 fail (17 not run, send cap). 9 script failures to fix.
- Prospect Outcome Updated: production smoke stopped in setup (step 1 showed "Scheduled, Tomorrow"). Check sender limit and hours, rerun.
- Email Opened, Email Bounced, Link Clicked, Unsubscribed: not started.
- Waiting on QA: Update a Account bug-or-not, AL-4169 status.

HubSpot: released to production (QA, 2026-10-24). Out of scope, do not revisit.

Priority (QA, 2026-10-24): Pipedrive first. Salesforce after.

## Update 2026-10-27 (QA): Prospect Outcome Updated is complete, deploy blocked

Test cases and scripts are done for staging (30 rows) and production smoke (9 checks, `notes/production-testing/10-pipedrive-prospect-outcome-updated.md`, `tests/pipedrive/prospect-outcome-updated-smoke.spec.ts`, `npm run smoke:pipedrive-outcome-updated`). The smoke is not run: an issue on the Refold side blocks the workflow deploy to production. Details and the steps for after the deploy: `prospect-outcome-updated-progress.md`, section "STATUS". Email Sent smoke (note 09) is in the same state.

## Update 2026-10-27 (Reply Received regression)

Run 2026-10-28 on staging: 21 passed, 10 failed, 2 skipped of 33. The 10 failures are five reproducible product issues, waiting on QA bug-or-not (`reply-received-product-issues.md`). State and next steps: STATUS section of `reply-received-progress.md`.

## Update 2026-10-27 (Link Clicked)

Cases saved (`test-cases/pipedrive/link-clicked.md`, 32 rows, ticket AL-4175, QA approved). The spec is written and the typecheck is clean. It has not run. Open points and next steps: `link-clicked-progress.md`. QA said not to run the script.

## Update 2026-10-28 (Link Clicked, staging done)

QA allowed the run. Sequence 197376 was finished by the setup spec (steps 1 and 2, link tracking, activation). It needed the custom tracking domain `cd1.shengage02.com` on gpipedrive, which the Email Opened session set. The sender is whatever QA connected to the sequence; the setup spec no longer adds one. `sequence-builder.page.ts` now retypes the step subject and unticks "same thread" on step 2. All 32 rows pass (see the State table). Next: QA decides the production smoke, written in smoke mode from the fixed tickets only. Nothing is run on production.

## Update 2026-10-27 (session local-project-1b): Email Bounced, saved mid-way

Cases saved and approved (37 rows, `test-cases/pipedrive/email-bounced.md`, AL-4183). Spec `tests/pipedrive/email-bounced.spec.ts` written (37 tests), never run. The sequence setup failed three times; the sequence "Pipedrive Email Bounced QA" is an empty draft and `SEQUENCE_ID` is a placeholder. QA told Claude not to run anything until further notice. Everything else, including a data-replacement mistake from two setup runs without `KEEP_TEST_DATA`, is in `email-bounced-progress.md`. Link Clicked is owned by session local-project-f9; message it before and after any run.

## Update 2026-10-28 (Email Bounced production smoke)

Script ready, not run. Cases: `../../notes/production-testing/12-pipedrive-email-bounced.md` (11 checks, 1 send, QA approved). Spec, setup spec, data script and run script are written and typecheck clean. QA cannot publish the workflow to production because of the Refold deploy issue, the same block as Email Sent and Outcome Updated. QA runs `npm run smoke:pipedrive-email-bounced` after the deploy. Details: `email-bounced-progress.md`.

## Update 2026-10-27 (Email Opened regression, AL-4174)

Cases saved and approved by QA (`test-cases/pipedrive/email-opened.md`, 27 rows). Spec, sequence setup spec and data script are written, NOT run, nothing set up (QA: do not run yet). Open points, files and next steps: `email-opened-progress.md`.

## Update 2026-10-28 (Email Opened production smoke)

Note `notes/production-testing/13-pipedrive-email-opened.md` approved by QA (9 checks). Spec, setup spec, data script, run script and `npm run smoke:pipedrive-email-opened` are written and typecheck clean. Not run: the Refold deploy issue blocks production. Details: `email-opened-progress.md`, last section.

## Update 2026-10-28 (evening): production released and manually smoked
Link Clicked (AL-4175) and Email Bounced (AL-4183) were released to production. QA ran a short manual smoke on emailopenedprod: Link Clicked checks 1, 5, 11 Pass, Email Bounced checks 1, 6, 11 Pass. Summaries posted as Jira comments 79527 (AL-4175) and 79528 (AL-4183). Scripts for both are ready, not run, optional. The Refold block is gone for Email Bounced. Next day: pick the next workflow (Email Opened smoke is ready and was not run; Reply Received and Unsubscribed: see their progress files).
