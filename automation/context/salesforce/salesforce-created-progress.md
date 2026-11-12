# Salesforce to Saleshandy ("... is created in Salesforce"): progress

## QA guidance 2026-11-09 (after the active-sequence probes), next steps

- "Stop sending follow-ups if a reply is received" is OFF. So a prospect marked Replied ends Finished. Expected for Move+Replied: Latest Status Finished (not Replied). Row 3 of the status group changes to that.
- A one-step live sequence moves a new prospect from Active to Completed. So Sequence B (or A) needs 3 to 4 steps (long waits between them) to see Replied, Paused and Active.
- Paused: the prospect must be in the sequence named in the Paused Extra Configuration. Check it in the prospect details > Activities section: it must say the prospect was marked paused for X days. X missing = bug. (HubSpot rows for reference: `tests/hubspot/company-created.spec.ts:345-350`, Paused in Sequence A = Paused, Paused naming Sequence B (prospect not in B) = unchanged, Resume = not Paused; smoke `company-created-smoke.spec.ts:195-196`.)
- To do: add 3 to 4 steps to Sequence B (QA: add them there), re-probe Replied, Paused (read the Activities section), Resume, Finished; then existing-prospect rows, Paused/Unsubscribed with a list, Blacklist second Lead; update the draft; show it to QA for "looks good".
- Context was past the 120K mark at this point: QA asked to switch model and /compact (see reply).

## Status probes with Sequence A and B ACTIVE (2026-11-09 07:28 to 07:35 UTC, QA activated them)

- Move+Finished (new Lead): Latest Status Finished, in Sequence A. Confirmed.
- Move+Unsubscribed (new Lead): Latest Status Unsubscribed, in Sequence A. Confirmed. (Earlier "Inactive" came from the Draft sequences.)
- Move+Replied (new Lead): in Sequence A, status read Active at 07:28, "Completed" later. Replied was not seen. Open.
- Move+Paused 1 day (new Lead): in Sequence A, status "Completed" at 07:32, not Paused. Open. Sequence A has one step and an active sender, so the prospect can complete the sequence before the status is read. Not known whether Paused was applied and then overridden.
- Page object fix: Pause Delay In Days is a text input (`input.bs-input`), not a spinbutton (`salesforce-integration.page.ts` `pauseDays`). Cause of the earlier "locator.fill timeout".
- Not probed: existing-prospect status rows (Paused, Finished, Replied, Resume, Unsubscribed on a prospect already in Sequence A), Paused/Unsubscribed with a list, second Blacklist Lead, My Unread and Recently Viewed single-list reads.

## Lead proposed-row probes (2026-11-09 06:30 to 07:00 UTC, sfreplyreceived)

Method: Lead created by REST (`src/utils/salesforce-api.ts`, SOAP login session, header `Sforce-Duplicate-Rule-Header: allowSave=true`), activities set through the UI, run-now (`scripts/probe-lead-rows.ts`, untracked throwaway). Run-now API was already in the repo (`src/flows/refold-run-now.ts`, commit 5e56e70). Fix made: `waitForEnd` also waits while the run is QUEUED (it returned on QUEUED before).

- Found: "Select a list" is ONE field for the whole Lead trigger. Its picks are shared by all activities and stay after an activity is removed and re-added. Earlier list probes in this session ran with several lists on, so they are discarded. `setLists` in the probe script now sets the exact lists.
- Add row 3 (existing prospect): second Lead with the same email and Job Title "Head of Procurement" updated the prospect (upsert). Confirmed.
- Add row 6 (Closed - Not Converted): prospect created. Confirmed.
- List, exactly one list: View - Custom 1 made a prospect. Two lists (All Open Leads and Today's Leads) made one prospect. No list: run skips only "Tables by Cobalt" (list run also skips "Get Leads if List not provided"). My Unread Leads and Recently Viewed Leads: run COMPLETED, prospect read failed (page blank), recheck needed.
- No list that excludes a fresh REST Lead has been found yet. "Lead not in the list" row is open.
- Tag with list: prospect tagged TagA (list picks were not exact, rerun not needed for the tag).
- Trigger off: run-now still ran the workflow (prospect Nils Berg got TagA from the saved config). Run-now does not test "off". Row 2 cannot be tested with run-now.
- Unsubscribe, with and without list: run COMPLETED, prospect created, Latest Status stays "Inactive" in the list and in the prospect dialog. The old spec expects "Unsubscribed". Not known whether Saleshandy shows an unsubscribed prospect differently. Run node list hides the nodes after the list step, so the run cannot show it. Open, QA asked.
- Sequence A and B do not exist on `sfreplyreceived` (only "Salesforce's First Sequence."). QA 2026-11-09: I create them. Entry added in `src/config/account-setup.ts` (`sfreplyreceived`), run with `SETUP_ACCOUNT=sfreplyreceived KEEP_TEST_DATA=1 ... account-setup.spec.ts -g "Sequence >"`.
- Later probes (07:17 UTC, Sequence A and B created as Drafts with one step each, plus a stray draft "New Sequence - Mon 9th Nov" from a failed attempt, left for QA): Move with Today's Leads put the prospect in Sequence A. Add+Move+Tag together: Sequence A and TagA. Move+Replied (new Lead): in Sequence A, Latest Status Inactive. Move+Unsubscribed: not in Sequence A, Latest Status Inactive. Repo says an unsubscribed prospect shows Unsubscribed in the Prospects list (how-to-test.md:127-139), so the status display is open. "Salesforce's First Sequence." is ACTIVE with 136 prospects: never use it for Move.
- Not probed yet: Paused with list (script failed on pauseDays fill), existing-prospect status rows (Paused, Finished, Replied, Resume, Unsubscribed on a prospect already in Sequence A), Blacklist second Lead, My Unread and Recently Viewed single-list reads.
- Shared page object fixes made: `sequence-builder.page.ts` (list wait, `exists`, font size button optional), `refold-run-now.ts` (QUEUED). Throwaway scripts (untracked, delete before commit): probe-lead-rows, probe-read, probe-run, probe-lists, probe-sequences, probe-seqrows, probe-rest-lead, `.env`-free.

## Resume here (2026-11-09, Lead cases)

- QA 2026-11-09 answers: Reply Received (Create a Lead) off during Lead runs; core list rows; Blacklist and Unsubscribe with a window check first; run-now only, no cron rows; row "two Leads before one run" removed; no Restore section; Resume is part of the workflow (rows added, dev log:139).
- Draft cases (not saved to `test-cases`, waits for "looks good"): `lead-created-cases-draft.md` in this folder.
- Run-now API: already in the repo (`src/flows/refold-run-now.ts`, commit 5e56e70). A record-creation API is not in the repo. The login in `src/utils/salesforce-login.ts` is a SOAP login that returns a session id and server URL, so a REST create (`/services/data/v62.0/sobjects/Lead`) is tried next.
- Earlier state of Reply Received (Create a Lead) on `sfreplyreceived`: ON (saved before). Record when turned off, restore only if QA asks.
- Next: probe the "(proposed, unconfirmed)" rows live, update the draft after each.

## Resume here (2026-11-09)

- Lead V1 exploration is COMPLETE on pyxis (`sfreplyreceived`). Contact, Opportunity and Account were rechecked read-only. Details: sections "Lead V1 after QA's reconnect", "Contact, Opportunity, Account read-only recheck" and "Lead V1 gaps closed" below.
- Next step: draft the test cases for the four workflows (Lead first), through `workflow-testing`, regression, and stop for QA's "looks good". Contact, Opportunity and Account still need QA's choice on a live probe (they read up to 200 org records on every run).
- Saved state on the account: Lead V1 on, Add Prospect, list "Today's Leads". Reply Received with Create a Lead in Salesforce on (older). Contact, Opportunity, Account, Blacklist: nothing saved.
- Run-now name on this account: `Lead is created in Salesforce` (no "(V1)"). Command: `node --env-file-if-exists=.env scripts/run-now.ts sfreplyreceived "Lead is created in Salesforce"`.
- Throwaway: `scripts/probe-lead-created.ts` (creates one Lead through the Lightning form, then run-now). Untracked. Delete before any commit. Screenshots in the project root (`lead-*.png`, `contact-created-select-2026-11-09.png`, `elena-prospect-2026-11-09.png`) are untracked too.

## Resume here (2026-11-05, older)

- Scope: Contact, Opportunity, Account and Lead (V1) created in Salesforce. Contact was QA's first pick, Lead V1 is the one that can be walked now.
- Account (QA 2026-11-05): `sfreplyreceived`, staging. The old specs use `sfcreated`, a placeholder in `src/config/accounts.ts:54` (no login, no `auth/` sessions). When a spec is written, switch `test.use({ account })` in the four `*-created.spec.ts` files.
- QA 2026-11-05: do not draft cases yet. Walked the Triggers & Activity screen only, read-only. Nothing was saved. Every toggle was left unsaved and the page reloaded.
- Old material from the API round (not reviewed against the screen): `test-cases/salesforce/{contact,opportunity,account,lead}-created.md`, `tests/salesforce/*-created.spec.ts`, rows in `src/flows/salesforce-to-saleshandy.ts`. `test-data/salesforce/*-created.csv` does not exist (`node scripts/make-salesforce-side-data.ts`).
- Contact, Opportunity and Account read up to 200 records of the whole org on every run and act on other tests' people. Lead keeps a cursor and reads only its own new Leads (dev kit). So Lead V1 is the safe one to start.

## Paused (QA 2026-11-05)

- QA paused this work to run the Salesforce production smoke scripts. QA runs them. Commands: `npm run smoke:salesforce-pair` (Reply Received and Email Opened), then `npm run smoke:salesforce-link-clicked`.
- State left: `sfreplyreceived` unchanged. Nothing was saved, every toggle was dropped by a reload. The card reads "Connected". No cases drafted, no Jira drafted, nothing committed.
- Still open: Contact and Opportunity created show "No Data" in the Select box (P1). Choices were a save check on Contact, a Jira bug draft, or treating it as expected. Account created not opened. Then walk the other 8 Lead V1 activities.
- Account choice still stands: `sfreplyreceived` (QA 2026-11-05), not `sfcreated`.
- Throwaway scripts (scratchpad, not in the repo): `sf-login-check.ts` and `sf-reconnect.ts`. They print no secrets.

## Seen on staging 2026-11-05 (sfreplyreceived, read-only)

- Triggers & Activity lists 14 rows. Saved state at the start: only "Reply is Received in Saleshandy" on, with "Create a Lead in Salesforce". "Create a Lead in Salesforce" is an activity of Reply Received, not a trigger.
- Lead is created in Salesforce (V1): toggle on in the page gives 9 activities, all ending "in Saleshandy". They are Add Prospect and Move Prospect to another Sequence. Next are Mark Prospect as Unsubscribed, Finished, Replied, Paused and Resume(Un-pause). The last two are Assign a tag to Prospect and Blacklist a Domain.
- Lead V1 > Add Prospect: Extra Configuration dialog with one field, "Select a list". The box stays grey and does not open. The page logged two `500` responses from `https://app.refold.ai/api/v2/public/config/field/6801fab2e121369350b66a37?workflow_id=681368981acc0cbcd16295c7` (the Lead V1 export id). The old cases say "Select a list left empty". Not yet asked whether this is expected.
- Contact is created in Salesforce and Opportunity is created in Salesforce: toggle on in the page, Select box shows "No Data" (Contact waited 4 s). The Contact and Opportunity activities are therefore unconfirmed. Account created not opened.
- Not seen: Extra Configuration for the other 8 Lead V1 activities, Account created's Select box.

## Product issues (QA reviews later, not Jira yet)

- P1: Contact and Opportunity created Select box shows "No Data" on `sfreplyreceived`. Lead V1 on the same account lists activities. Seen twice (the second time with the card on "Connected", 2026-11-05 05:00 UTC). Not known: whether the list loads only after Save, or whether it is a staging problem. Account created not opened.
- P2 (withdrawn): Lead V1 > Add Prospect > "Select a list" gave two 500s from Refold and a grey box. About 10 minutes later the card read "Re-connect" for a short time. After that, with the card on "Connected", the box opened and listed six views: All Open Leads, My Unread Leads, Today's Leads, `View - Custom 2`, `View - Custom 1`, Recently Viewed Leads. No 500. The first failure was most likely a passing token state, not a product bug. Cause not proven.
- Salesforce API login check from 110.226.126.183 (office exit node): passed 2026-11-05. A scripted re-connect found the card on "Connected", so nothing was clicked.

## Next

- QA decides: bug or not for P1 and P2, then which workflow after Lead V1.
- Screenshots: `.playwright-mcp/contact-created-select.png`, `lead-v1-select.png`, `opportunity-select.png`, `lead-add-prospect-dialog.png`.
- Nothing committed.

## Walked 2026-11-05 afternoon (sfreplyreceived, staging, nothing saved)

QA 2026-11-05: the developer fixed the Salesforce to Saleshandy workflow. Contact, Opportunity, Account and Lead V1 "created" now behave like HubSpot's created triggers. Toggle on in the page (unsaved), open Select, pick each activity, read the Extra Configuration dialog, Cancel. A reload dropped every toggle. Nothing was saved.

- P1 recheck: Contact, Opportunity and Account created now list the same 9 activities as Lead V1. The "No Data" box is gone. P1 looks fixed (seen once, not repeated).
- The 9 activities, in list order: Add Prospect, Move Prospect to another Sequence, Mark Prospect as Unsubscribed, Finished, Replied, Paused, Resume(Un-pause), Assign a tag to Prospect, Blacklist a Domain. All end "in Saleshandy".
- Extra Configuration, Contact, Opportunity and Account created (same on all three):
  - Add Prospect: no dialog.
  - Move Prospect: Sequence and Sequence Steps.
  - Unsubscribed: no dialog.
  - Finished, Replied and Resume: Sequence.
  - Paused: Sequence and Pause Delay In Days.
  - Assign a tag: a tag box ("Avoid using tags that have spaces in them", "No tags defined yet").
  - Blacklist a Domain: no dialog.
- Lead V1 created: the same fields plus "Select a list" on every activity, including Add Prospect, Unsubscribed and Blacklist (the box is "Loading..." for a few seconds, then "Select"). A scripted first pass with 1.5 s waits gave wrong results because the dialog opens late. Wait 4 s before reading.
- Sequence list shows one sequence: "Salesforce's First Sequence.🚀".
- Cancel in the dialog does not remove the picked activity pill. The activity stays selected with an edit icon.
- Staging served 404 for its own JavaScript files for about 1 minute at 10:23 UTC ("Oops! It seems something broke down at our end"). It came back after a reload. Most likely a deploy.

## Live probe attempt, Lead V1 (2026-11-05 10:28 UTC, sfreplyreceived)

- Created-record forms are written to `created-records.md` (required fields, other fields, picklists). Read headless through the API login, nothing created. The saved Salesforce session of the `playwright-salesforce` MCP had expired (login page), so the script used `salesforceFrontdoorUrl`.
- P3: Lead V1 > Add Prospect > "Select a list" stayed grey (class `bs-select-box-disabled`) and listed nothing, with the card on "Connected". The Refold call `POST /api/v2/public/config/field/6801fab2e121369350b66a37?workflow_id=682c02f4bcc93496f87feef6` returned 200 with `"options":[]`, `help_text` `select_lead_list_salesforce`, `multiple: true`. The `workflow_id` differs from the one seen earlier (`681368981acc0cbcd16295c7`). Earlier the same box listed six views (P2). So the list is empty or filled depending on state. Cause not proven.
- Nothing was saved. The page was reloaded, so the Lead V1 toggle is off. No record was created in Salesforce.
- Not done: save a trigger, create a record, read Logs. Contact, Opportunity and Account need no list, but they read up to 200 org records on every run (see "Resume here"), so a live probe would import other tests' people into the sfreplyreceived Saleshandy account. QA decides.

## Poll result, Lead V1 "Select a list" (2026-11-05 10:49 to 11:37 UTC, sfreplyreceived)

- 15 checks, 3 minutes apart, headless with the saved Saleshandy session, nothing saved. The box stayed disabled on 13 checks. Two checks failed to load the page (click timeout, page did not render in 40 s). The list never loaded, so the Lead V1 live probe did not start.
- The earlier list of six views (P2, about 05:00 UTC) did not come back. The empty answer comes from Refold (200 with `"options":[]`, data source `68249b6f8c30aa122ba08092`), not from a Salesforce error. Why Refold has no values is not proven.
- Next: QA decides bug or not for P3, and whether to probe with Contact (no list needed, reads up to 200 org records) or draft cases only.

## Walk 2026-11-09 morning (sfreplyreceived, pyxis staging)

- QA said the empty "Select a list" is fixed on pyxis. Plan agreed with QA: Lead gets walk, save and live probe. Contact, Opportunity and Account get a read-only walk. Account stays `sfreplyreceived`.
- The saved Saleshandy session had expired. QA logged in again headed.
- Lead V1 toggle on, Select list shows the same 9 activities as 2026-11-05.
- P3 NOT fixed at 04:55 UTC: Lead V1 > Add Prospect > "Select a list" stayed grey (`bs-select-box-disabled`). Refold `POST /api/v2/public/config/field/6801fab2e121369350b66a37?workflow_id=682c02f4bcc93496f87feef6` returned 500 twice, body `{"message":"Server Error of Unhandled Type"}` (x-trace-id `ee25592810137b406117d1a695abebc9`). On the trigger page the card button was "Disconnect".
- I picked Add Prospect with the list empty and clicked Save. No toast was seen. A reload (04:56 UTC) redirected to the Integrations list and the Salesforce card read "Re-connect". So the save is unverified.
- Not done: the other 8 Lead V1 activities (scripted clicks did not open the menu), the live probe, Contact, Opportunity, Account.
- Screenshots in the project root: `lead-created-state-2026-11-09.png`, `lead-created-after-save-2026-11-09.png`, `lead-created-reload-2026-11-09.png`.

## Lead V1 after QA's reconnect (2026-11-09 05:24 to 05:28 UTC, sfreplyreceived, pyxis staging)

- QA re-connected Salesforce on the account. After a fresh load the card shows "Disconnect". P3 is FIXED: Lead V1 > Add Prospect > "Select a list" calls Refold `POST .../config/field/6801fab2e121369350b66a37?workflow_id=682c02f4bcc93496f87feef6` and gets 200. The box opens and lists six views: All Open Leads, My Unread Leads, Today's Leads, `View - Custom 2`, `View - Custom 1`, Recently Viewed Leads. The 500s of 04:55 UTC came while the connection was dropped (card "Re-connect"). Reconnect, not a code change, cleared it.
- The trigger save of 04:56 UTC persisted: Lead V1 on, Add Prospect, list empty. It was saved with the list empty. A Lead trigger with no list is accepted.
- Workflow name on this account is "Lead is created in Salesforce" (no "(V1)"). The run-now name `Lead is created in Salesforce (V1)` is not found. Use the name without "(V1)" in `npm run sf:run-now`.
- Live probe, list empty, Add Prospect: Lead `marcus.hallstrom.052517@mailinator.com` (Marcus Hallstrom, Hallstrom Logistics, Logistics Director) created in `saleshandy-dev-ed` by the Lightning form at ~05:25 UTC. Run `6af1598ad48f0071c232914c` COMPLETED. Nodes: Start, Tables by Cobalt x2, Custom Code, Get List new Leads, Generate query to fetch filtered leads, Get Leads if List not provided, Get Leads records array, Rule - Blacklist Domain (Bulk), group (all Success). Custom Code and "update ts if exists" were Skipped. Logs tab: row "Lead is created in Salesforce", Nov 9 2026 10:56 AM, 4.2s, Success.
- Prospect check: Saleshandy Prospects list shows Marcus Hallstrom, `marcus.hallstrom.052517@mailinator.com`, Logistics Director, Company Hallstrom Logistics, status Inactive, Unverified. So Add Prospect imports the Lead.
- Not done for Lead: the other 8 activities with a list picked, a list-based run (list picked, "Today's Leads"), field values on the prospect (only Title and Company read from the list view), Salesforce first-run window.
- Throwaway script left (untracked): `scripts/probe-lead-created.ts`. It creates one Lead through the Lightning form and runs run-now. The run-now call in it uses the "(V1)" name, so it fails after the Lead is created. Delete it before any commit.

## Contact, Opportunity, Account read-only recheck (2026-11-09 05:27 to 05:29 UTC, sfreplyreceived)

- Toggle on in the page (unsaved), open Select, read the list, reload. Nothing saved for these three.
- Contact, Opportunity and Account created each list the 9 activities (Add Prospect, Move Prospect to another Sequence, Mark Prospect as Unsubscribed, Finished, Replied, Paused, Resume(Un-pause), Assign a tag to Prospect, Blacklist a Domain, all "in Saleshandy"). No "No Data" box. P1 stays fixed (second time seen).
- Extra Configuration fields for the three were read on 2026-11-05 and not read again today.
- Contact, Opportunity and Account still read up to 200 org records on every run. No live probe was done for them (QA 2026-11-09 answer: read-only).
- State left: Lead V1 saved (on, Add Prospect, list empty). Reply Received with Create a Lead in Salesforce was already saved before. Contact, Opportunity and Account are off.

## Lead V1 gaps closed (2026-11-09 05:40 to 05:59 UTC, sfreplyreceived)

- Extra Configuration of all 9 Lead V1 activities, read after the reconnect (wait 5 s, the "Select a list" box is enabled and loads):
  - Add Prospect: Select a list.
  - Move Prospect to another Sequence: Sequence, Sequence Steps, Select a list.
  - Mark Prospect as Unsubscribed: Select a list.
  - Finished, Replied, Resume(Un-pause): Sequence, Select a list.
  - Paused: Sequence, Pause Delay In Days, Select a list.
  - Assign a tag to Prospect: tag box ("Avoid using tags that have spaces in them", "No tags defined yet"), Select a list.
  - Blacklist a Domain: Select a list.
- "Select a list" is multi-select (checkboxes) with six views. Clicking outside the list closes it, the dialog Save keeps the pick, the page Save stores it.
- Not saved on purpose: Blacklist a Domain (it would blacklist other tests' domains).
- List run: Add Prospect with "Today's Leads" saved. Lead `elena.marchetti.055839@mailinator.com` (Elena Marchetti, Marchetti Events, Event Coordinator, +1 212 555 0187) created in the org. Run `6af161218e5dd8e8127b31d8` COMPLETED. "Get Leads if List not provided" Skipped, "update ts if exists" and the second Custom Code ran. This matches the dev kit (list path replaces the all-leads query, the cursor is written on the list path).
- Prospect check: Saleshandy shows Elena Marchetti with Job Title Event Coordinator, Company Marchetti Events, Phone Number +1 212 555 0187, status Inactive, Unverified. The two probe Leads carried only name, company, email, title and phone, so City, State, Country, Website, Industry and similar mapped fields were not read.
- Not covered: Move, tag, status and unsubscribe actions on a created Lead (each needs a saved activity and a run), the first-run window, errors for a Lead without an email. Cases for these come with the case draft.

## Lead probes on Sequence B, 4 steps (2026-11-09, after QA guidance)
- Sequence B (id 197819) has 4 steps now, Sequence A one step. Both active.
- Move + Replied, new Lead, same run: status Replied (stop-on-reply is off, so not Finished).
- Move + Paused, new Lead, same run: stays Active, no "paused" entry in Activities. Move + Finished, new Lead, same run: stays Active. Open: ask QA if this is a bug (dev log S2/S3 pass with add-in-step).
- Paused on a Lead already in Sequence B (second Lead, same email): status Paused, Activities reads "<name> has been paused for 1 days for sequence Sequence B". X is present.
- Finished on a Lead already in Sequence B: status Finished.
- Probe script: scripts/probe-lead-rows.ts (SEQ, ACTIVITY env; scenarios existing-paused, existing-finished, existing-replied, existing-resume). Throwaway, delete before commit. scripts/probe-addsteps.ts and probe-reread.ts too.

## Contact created cases saved (2026-11-09)

- QA saved 31 regression cases to `test-cases/salesforce/contact-created.md` (replaces the old 2026-10-27 file). Draft copy: `contact-created-cases-draft.md`.
- QA rules: realistic scenarios only; Unsubscribed (3 rows) and Blacklist (4 rows) have run rows, run last; Sequence A has "Stop sending follow-ups if a reply is received" ON (Replied ends Finished), Sequence B OFF (Replied stays Replied).
- Next: spec not started. Cases only until the Lead work on `sfreplyreceived` is done (other session local-project-3f). The old `tests/salesforce/contact-created.spec.ts` still uses `sfcreated` and the old rows.

- Probe round 2026-11-09 done: Resume, Replied, Paused with list confirmed; Unsubscribed with a list and the second Blacklist Lead not re-probed. Draft waits for QA looks good.

## Contact created spec written (2026-11-09), not run

- `tests/salesforce/contact-created.spec.ts`: 31 rows plus Restore, account `sfemailopened` (QA 2026-11-09, parallel with Lead), typechecked, listed with `--list`, never run. Rows run as one chain (order differs from the case file, see the spec header).
- New code: `SalesforceApi.createContact` and `createAccount` (REST, duplicates allowed), `DoNotContactPage.entries()` (first cell of each row, not walked on staging), `ACTIVITY.resume`, `SEQ_B`, and the flow helpers `useActivities`, `runNow`, `expectLogSuccess`, `expectProspect`, `expectState`, `check`, `sequence(step, name)`, `pausedIn(name)`, `tagged` now exported from `src/flows/salesforce-to-saleshandy.ts`. `pausedIn` is now a function (`pausedIn()`).
- Contact Phone Number maps to "Business Phone" on this account (API field Phone), so Contacts are created with Phone, not MobilePhone.
- Unverified locators: DNC `entries()`, the Cancel button of the Extra Configuration dialog, the prospect button name when First Name is empty (Add Prospect 5), Company text when empty (Add Prospect 8).
- Run command: `KEEP_TEST_DATA=1 SEQUENCES_PAUSED=1 npx playwright test tests/salesforce/contact-created.spec.ts`. Needs QA's OK first: Unsubscribed and Blacklist rows hit every prospect and domain of the account. Cleanup runs after each of those rows and in Restore.
- Not committed. `tests/salesforce/lead-created.spec.ts`, `scripts/probe-options.ts` (private `activitySelect` typecheck error) and the `jira/web` typecheck errors come from other work, not this spec.

## Spec written (2026-11-09)
- Cases saved to test-cases/salesforce/lead-created.md (QA looks good). Spec tests/salesforce/lead-created.spec.ts + src/flows/salesforce-lead-created.ts (33 tests, replaces the old generic spec). No CSV (people made on the fly). Always KEEP_TEST_DATA=1.
- First full run started, output /tmp/claude-1002/lead-run1.out. Then rerun only failed rows.
- QA 2026-11-09: run stopped at test 10 of 33 (QA runs it in parallel with Contact Created). Do not run the Lead spec; QA runs it. Trigger state left on the last row activities.

## Contact Setup row run (2026-11-09, sfemailopened, chromium)

- `Trigger behavior 1` PASSED in 28 s: Contact Properties Phone Number and Department match `EXPECTED_MAPPING`, trigger on with Add Prospect, "Configuration Updated Successfully". No reconnect was needed.
- State left on `sfemailopened`: "Contact is created in Salesforce" ON with Add Prospect, saved. Other triggers off. Sequence A and B not created yet, toggles not set.
- Not run: every other row.

## sfemailopened sequences (2026-11-09, set by QA by hand)

- Sequence A = 197821, Sequence B = 197822 (both on `sfemailopened`, pyxis). QA added 3 steps to each. Sequence B has "Stop sending follow-ups, if the reply is received" OFF. Sequence A taken as ON (default), not read back.
- Not known: sender added, schedule, active or draft state. Steps wait times not read.
- My earlier `account-setup` run made both sequences empty. The setup spec `tests/setup/salesforce-contact-created-sequences.spec.ts` (4 steps, switch) was stopped by QA before it passed and is not needed now. The stuck "Email Templates" dialog fix in `sequence-builder.page.ts` (close button, then remove the dialog) is untested.
- Left saved on the account: "Contact is created in Salesforce" ON with Add Prospect (from the Setup row). Restore turns it off.
- Throwaway scripts to delete before a commit: `scripts/probe-sfeo-seq.ts`, `scripts/probe-sfeo-settings.ts`.

## Resume here (2026-11-09, Lead spec ready, waiting for Contact Created)
- State: Lead cases approved by QA and saved (test-cases/salesforce/lead-created.md). Spec tests/salesforce/lead-created.spec.ts (33 tests) + src/flows/salesforce-lead-created.ts written and typechecked. No CSV (people made on the fly). Not committed.
- Run: QA runs it in parallel with Contact Created. Claude does not run it. Always KEEP_TEST_DATA=1. My one run stopped at test 10; only failure was Add Prospect 2 (script: sidebar blocked the name click), fixed (closeSidebar after search; Add 2 checks count and status only). Tests 10 to 33 never ran, so more script fixes may come from QA's output.
- Account sfreplyreceived: Sequence A (1 step) and Sequence B (4 steps, id 197819) active. Stop-on-reply is off. Reply Received (Create a Lead) is OFF (was ON before; enableOnly turned it off). Triggers are left on the last row's activities.
- Open for QA: (1) Paused rows 1 and 2 (new Lead, Move + Paused/Finished in the same run stays Active, dev log says Paused/Finished): bug or not, Claude suggests bug; no Jira draft yet. (2) Delete the stray draft sequence "New Sequence - Mon 9th Nov". 
- Key facts: Resume activity name is "Mark Prospect as Resume(Un-pause) in Saleshandy". Paused works on a prospect already in the sequence; Activities reads "<name> has been paused for 1 days for sequence Sequence B". Not tested: trigger off, list that excludes a fresh Lead; Unsubscribed with a list and second Blacklist Lead are "proposed" rows.
- Before any commit: delete untracked scripts/probe-*.ts (probe-lead-rows, probe-read, probe-run, probe-lists, probe-sequences, probe-seqrows, probe-paused-dialog, probe-rest-lead, probe-created-lead, probe-addsteps, probe-reread, probe-options) and the screenshots in the project root. No Co-Authored-By line.

## Resume here (Contact created, 2026-11-09 evening)

State: cases SAVED (31 rows, `test-cases/salesforce/contact-created.md`), spec WRITTEN and typechecked, only the Setup row has run (passed, 28 s). Nothing committed. Session local-project-4a. Lead session is local-project-3f (Lead draft and spec on `sfreplyreceived`, QA runs Lead and Contact).

- Account for Contact: `sfemailopened` (QA 2026-11-09, so it runs in parallel with Lead on `sfreplyreceived`). Login `dharmesh+noemailsent@saleshandy.com`. Own page config, sequences, Do Not Contact list, prospects. Shares only the Salesforce org and the Salesforce user (a reconnect there can drop another account's connection).
- Spec: `tests/salesforce/contact-created.spec.ts`, 32 tests. Contacts made by REST (`SalesforceApi.createContact`, `createAccount`), people in code, rows run as one chain (order differs from the case file, see the spec header). Run: `KEEP_TEST_DATA=1 SEQUENCES_PAUSED=1 npx playwright test tests/salesforce/contact-created.spec.ts`. `SEQUENCES_PAUSED=1` now only means "I accept the sends" (sequences are Active). Rename it if the sequence rows are run.
- Unverified locators: Do Not Contact `entries()`, Cancel button of the Extra Configuration dialog, prospect button name with empty First Name (Add Prospect 5), Company text when empty (Add Prospect 8). Expect small fixes on the first run.
- Ready to run, no sequence needed (about 14 tests): Add Prospect 1 to 8, Tag 1, Activities list 1 and 2, Trigger behavior 2, Unsubscribed 1 and 3. Run them first, rerun only failed rows with KEEP_TEST_DATA=1.
- BLOCKED on QA: Move 1, Tag 2, Status 1 to 9, Unsubscribed 2, Blacklist 1 to 4 (Blacklist needs no sequence, but it lists every org domain). Reason: Sequence A (197821) and B (197822) are ACTIVE (QA screenshot 2026-11-09; my earlier "Draft" reading from "if activated today" was wrong). Step 1 is Day 1 with "No wait". A Move run enrolls the first 200 org Contacts with an email: saleshandy.com 90, mailinator.com 50, gmail.com 33, about 27 on real company domains (uog.com, grandhotels.com, burlington.com, ...). Senders: A = `dharmesh+replyreceived@saleshandy.com` (150/day); B = that one plus `Rachelgreen47sh+10@gmail.com` and `5kartiktest+1@gmail.com` (250/day in all). Sending Schedule = Default Schedule. Track opens and clicks OFF. Toggles: A "Stop sending follow-ups" ON (read), B OFF (read).
- QA decision pending (three options offered): (1) block the sends first with a closed-window Sending Schedule, then run the Move row once and read the statuses (my default); (2) accept the sends and respect the daily caps; (3) skip the sequence rows for now.
- State left on `sfemailopened`: trigger "Contact is created in Salesforce" ON with Add Prospect, saved. The 3-hour cron imports the org's Contacts into this account until Restore (the last spec row) turns it off.
- Code changed and not committed: `src/utils/salesforce-api.ts`, `src/pages/saleshandy/do-not-contact.page.ts`, `src/flows/salesforce-to-saleshandy.ts` (exports, `pausedIn()` now a function, `SEQ_B`, `ACTIVITY.resume`), `src/config/account-setup.ts` (`sfemailopened` sequences entry, not needed now), `src/pages/saleshandy/sequence-builder.page.ts` (stuck "Email Templates" dialog fallback, untested, also holds the Lead session's edits), `tests/salesforce/contact-created.spec.ts`, `tests/setup/salesforce-contact-created-sequences.spec.ts` (stopped, not needed now, delete).
- Throwaway to delete before a commit: `scripts/probe-sfeo-seq.ts`, `scripts/probe-sfeo-settings.ts`, `scripts/probe-sf-contacts.ts`.
- Case file note: scenarios say "Mobile Phone", but this account maps Phone Number to Business Phone (API field Phone). Spec uses Phone.
- Peer note 2026-11-09 (session local-project-4a, Contact): Contact runs on account sfemailopened (own triggers, sequences, Do Not Contact list), so Lead on sfreplyreceived is independent and can run in parallel. Their uncommitted edits to shared files (salesforce-to-saleshandy.ts, salesforce-api.ts createContact/createAccount, do-not-contact.page.ts entries(), sequence-builder.page.ts, account-setup.ts) must not be reverted. A Re-connect on sfemailopened can drop the shared Salesforce connection, including this account: if the card shows Re-connect, that may be why. My spec does not import salesforce-to-saleshandy.ts.

## Opportunity created restart (2026-11-09 evening, session local-project-92)

- QA answers: account = an idle one (I picked `sflinkclicked`: connected, all four created triggers off, read 2026-11-09). Expected from Contact cases, unconfirmed rows marked. Add four Opportunity-only rows. Blacklist rows included, run at the end. QA asked whether the four-workflow exploration was done: yes, read-only (see "Contact, Opportunity, Account read-only recheck"). Live probes still open.
- Draft (not saved to `test-cases`, waits for "looks good"): `opportunity-created-cases-draft.md` in this folder. 28 rows (earlier "36" was a miscount of 33, then trimmed).
- Code added: `SalesforceApi.createOpportunity` (contact roles, first primary) in `src/utils/salesforce-api.ts`. Not compiled or run. Old spec `tests/salesforce/opportunity-created.spec.ts` still on account `sfcreated` (TODO login), to be rewritten after "looks good".
- Throwaway to delete before a commit: `scripts/probe-opp-state.ts`.
- Not checked on `sflinkclicked`: Sequence A and B, Field Mapping for Contact and Opportunity, Do Not Contact list.
- QA "looks good" 2026-11-09: 28 cases SAVED to `test-cases/salesforce/opportunity-created.md` (draft file removed). Account `sflinkclicked` confirmed by QA. Next: check Sequence A and B and Field Mapping on `sflinkclicked`, rewrite `tests/salesforce/opportunity-created.spec.ts` (old one targets `sfcreated`), run once, rerun failed rows with KEEP_TEST_DATA=1.
- Sequences for Opportunity on `sflinkclicked` (QA 2026-11-09, reuse, change settings as needed). Both ACTIVE, 2 steps (Day 1 no wait, Day 3), senders `dharmesh+zohointegration@saleshandy.com` (0/150), `Ritaellis1988+2@gmail.com` (18/50), `7kartiktest+2@gmail.com` (0/50). Sequence A = 197704 "Salesforce Link Clicked Regression" (62 prospects, stop-on-reply ON). Sequence B = 197611 "Conversation Category is Updated in S..." (31 prospects). I turned stop-on-reply OFF on 197611 (dialog "Disable Anyway"), verified OFF after reload on the screenshot. The sequence names are not "Sequence A/B": the spec picks them by these names (check the full name of 197611 on the dropdown).
- Risk: both are active with real senders. A Move run enrolls every org Opportunity contact it reads and step 1 sends at once (daily caps 150/50/50). Both sequences hold old prospects from other tests. Revert 197611 stop-on-reply to ON at the end if QA wants.
- Throwaway to delete before a commit: `scripts/probe-opp-state.ts`, `scripts/probe-opp-seq.ts`.
- Opportunity spec written 2026-11-09 (`tests/salesforce/opportunity-created.spec.ts`, 29 tests = 28 cases + Restore), typechecked. Run 1 (baseline, Activities list, Add Prospect): Trigger behavior 1 and 2, Activities list 1 and 2 PASSED. Add Prospect 1, 3 to 7 and Blacklist 3 failed on the date format (`inDays` gives 12/9/2026, REST needs 2026-12-09), fixed. Add Prospect 8 failed after 10 min, cause open.
- Account setup fix: Contact Properties "Job Title" was unmapped ("Select") on `sflinkclicked`. I mapped it to Title and verified after reload (the cases and dev log expect Job Title filled). Baseline row 1 now checks it. Opportunity Properties: Deal Value = Amount (fine).
- Throwaway to delete before a commit: `scripts/probe-opp-state.ts`, `probe-opp-seq.ts`, `probe-opp-rest.ts`, `probe-opp-mapping.ts`. The REST probe left one test Contact and one Opportunity ("Probe Opportunity") in the org.
- Opportunity run results 2026-11-09 (account `sflinkclicked`): Trigger behavior 1, 2, Activities list 1, 2, Add Prospect 1 to 7 PASSED (11 of 28). Script fixes: REST date must be ISO (not `inDays`), `crm.search` waited for a counter that is absent on "No results found" (shared `crm.page.ts` fixed, returns 0), Contact Job Title mapped to Title on the account.
- PRODUCT FINDING, open, QA to review (Add Prospect 8, also the premise of Unsubscribed and Blacklist 4): an older Opportunity's contact is NOT imported by run-now. Tried twice: `mads.kristensen.o12cm@mailinator.com` (3 Opportunities of 2026-11-05, all outside the first 200 of the org's 226) and `malav123456@saleshandy.com` (inside the first 200 by default order). Both stayed 0 prospects 3 min after a COMPLETED run, while an Opportunity created seconds before the run is imported every time. The dev log says every run reads up to 200 Opportunities, window not applied (A3). Seen here: only recent Opportunities are read, or the 200 are taken in a different order. Not known which. Could be the workflow version (UI `681368981acc0cbcd16295c8` vs dev copy `682d6bf5bcc93496f88fdb28`). Row 8 stays failing, not bent to pass. The case wording "the run reads the whole org" needs QA's decision.
- Not run yet: Tag 1, Move 1, Tag 2, the eight status rows, Unsubscribed 1, Blacklist 1 to 4. Move, Tag 2 and status rows send real emails (ACCEPT_SENDS=1, waits for QA). Run with `--project=chromium` (edge project fails in 3 ms, no session).

## Account created (2026-11-09 evening, session local-project-03)

STATUS: test cases written (29 rows, saved), spec generated, NOT run on staging.

- QA answers: rebuild from scratch, account `sfemailsent` (idle, Email Sent released), Account-only rows (0 and 2 Contacts, Contact without email, Account Properties fields), Blacklist rows last with cleanup. QA: no Refold workflow change and no cursor request to the developer. Whole-org read is contained instead: 134 Accounts, 17 with Contacts, 24 Contacts with an email on an Account (3 at saleshandy.com), read-only SOQL 2026-11-09.
- QA "looks good": 29 cases SAVED to `test-cases/salesforce/account-created.md` (draft file removed). Added Baseline 3 (Account count at most 200).
- Spec written and typechecked: `tests/salesforce/account-created.spec.ts` (29 tests plus Setup and Restore), account `sfemailsent`, not run. Setup adds the 24 existing Contacts to this account's Do Not Contact list (after the Add Prospect rows), Restore removes them. Read-set check (`readSetIsKnown`) skips Unsubscribed and Blacklist rows if an unknown Contact sits on an Account.
- Code: `SalesforceApi.createAccount(name, extra)` takes website, phone, industry. NOT YET: `DoNotContactPage.addEntries(emails)` (typecheck error until written, needs the Add dialog walked on staging).
- BLOCKED: `sfemailsent` Saleshandy session expired (auth file dated 2026-10-20). QA runs headed `npm run login:saleshandy -- sfemailsent`. Then: walk Do Not Contact Add dialog, read the two sequences on `sfemailsent` (set `SEQ_A`, `SEQ_B` in the spec, now `TODO(needs-input)`), check Field Mapping (Job Title to Title on Contact, Account Properties pairs), Salesforce connected.
- Run: `KEEP_TEST_DATA=1 ACCEPT_SENDS=1 npx playwright test tests/salesforce/account-created.spec.ts`. Rerun only failed rows.
- Throwaway in scratchpad only (count-accounts.ts, check-session.mjs). Nothing committed.
- Rest-of-run started 13:22 UTC on QA's go-ahead (no waiting, fix the script at the end): Move 1, Tag 2, Status 1 to 8, Unsubscribed 1, Blacklist 1 to 4, Restore, with ACCEPT_SENDS=1. Log /tmp/claude-1002/opp-run6.log.

## Contact created full run (2026-11-10), resume 2026-11-11

Run: `REPORTS_DIR=reports/contact-final KEEP_TEST_DATA=1 SEQUENCES_PAUSED=1 CI= npx playwright test tests/salesforce/contact-created.spec.ts --project=chromium --workers=1 --retries=0`. Log: `reports/contact-final/run.log`. Result: 14 passed, 16 failed, 2 skipped, of 32.

- Passed: Trigger behavior 1 and 2, Activities list 1 and 2, Add Prospect 4, 5, 6, 8, Tag 1, Move 1, Tag 2, Status 1, 2, 3.
- Skipped: Add Prospect 2 and 3 (they depend on Add Prospect 1).
- Real failure, Refold run ERRORED at step "Loop on Contacts": Add Prospect 1 (run 6af1c9a12352a4010f39f663) and Add Prospect 7 (run 6af1cac0d48f0071c2437fa6). Probable product issue. Not yet looked at in Refold or Logs.
- Failure with no proven cause: Status 5 stayed "Inactive" instead of "Paused" after 180 s. Status 9 never found run 6af1cf36aadae841739fcc0d as Success in Logs. Both ran when the network may already have been failing. Rerun before judging.
- Network loss (DNS), not product: Status 4, 6, 7, 8, Unsubscribed 1 to 3, Blacklist 1 to 4, Restore. Errors: `ERR_NAME_NOT_RESOLVED` for pyxis.lifeisgoodforlearner.com and `getaddrinfo EAI_AGAIN login.salesforce.com`.
- STATE LEFT ON `sfemailopened`: Restore did not run, so trigger "Contact is created in Salesforce" is still ON (3-hour cron imports Contacts). Turn it off first on 2026-11-11.
- Next steps: (1) fix the network, (2) run Restore or turn the trigger off by hand, (3) read the Refold run of Add Prospect 1 and 7 to find why "Loop on Contacts" errors, (4) rerun only failed and skipped rows with KEEP_TEST_DATA=1, (5) then the production smoke. Nothing committed.

## Lead created first full run (2026-11-10), resume here
- Workflow: Lead is created in Salesforce (AL-4144), account sfreplyreceived, staging, tests/salesforce/lead-created.spec.ts (33 tests).
- Run 1 (full, KEEP_TEST_DATA=1, 44.1 min): 20 passed, 13 failed. Rerun of the 13 failed rows only (26.6 min): 2 passed, 11 failed. Total 22 passed, 11 failed of 33.
- Fixed and proven: Add Prospect 4 and Add Prospect with a list 5 (no Email). Cause was the spec: the prospect search used the last name and matched prospects from earlier runs. Each no-email Lead now gets a unique last name (`noEmailLead` in the spec). Not committed.
- Still failing, same in both runs: Paused/Replied/Finished/Resume 1 to 8 and Unsubscribed 1 end with status "Blacklisted" instead of the expected status. The prospects are new, so no parallel session causes it. Earlier prospects from rows that passed (Move, Tag) also show Blacklisted later, because those rows check sequence and tag, not status.
- Blacklist 1: the domain never shows on the Do Not Contact list (180 s). Blacklist 2 (proposed): Refold run steps not completed, "Blacklist Domains (Bulk)" Errored.
- The Do Not Contact list was empty when read (2026-11-09 evening).
- Guess, not proven: a `mailinator.com` prospect becomes Blacklisted when a sequence activity touches it. Not tested.
- Next step: open one blacklisted prospect in Saleshandy and read the blacklist reason. Change no spec before the cause is known. Then rerun only the failed rows with KEEP_TEST_DATA=1.
- Open for QA: Paused rows 1 and 2 (bug or not), stray draft sequence to delete.

## Lead created root cause and rerun 2 (2026-11-11)
- Root cause of the 9 status rows: `mailinator.com` sat on the account's Global Do Not Contact list (added 2026-11-09 16:42 by a Blacklist run that blacklisted every Lead in the window). A prospect on a listed domain that is in a sequence shows Blacklisted (QA rule, same as hubspot 00-overview.md:197-199; a prospect can still be added to an active sequence).
- Script fault found: `do-not-contact.page.ts` used `getByRole('row')`, but the list rows are `div.tanstack-table--tr` with no role. hasEntry was always false, so Blacklist 1 missed its domain and cleanups never ran. Fixed (`entryRows()`). Spec: `clearDnc` helper, Blacklist rows remove their domain and mailinator.com, new first test "Setup: mailinator.com is not on the Do Not Contact list". Not committed.
- `mailinator.com` deleted from the list by hand 2026-11-11. Five `leadmw*.example.com` entries still listed (harmless).
- Rerun 2 (reports/lead-created-rerun2, 12 tests): Setup pass, Finished 2 pass, 9 fail, Blacklist 2 skipped. New cause: Sequence A and Sequence B are both Paused on sfreplyreceived (Sequence list, 2026-11-11), so prospects show Inactive. Blacklist 1 died with `TypeError: fetch failed` (network, not product).
- Next: QA decides whether to activate Sequence A and B, then rerun the 11 rows.
- 2026-11-11 (later): QA OK'd activating Sequence A (197817) and B (197819). Activate fails on B: POST /api/edge/sequences/197819/pause-resume gives 400, code 2001, "Email accounts in this sequence are either paused or disconnected, Activate them to resume the sequence." Toast: "Attached email account is disconnected." Both sequences stay Paused. Needs QA to reconnect the sender on sfreplyreceived (an OAuth login), then activate A and B, then rerun the 11 rows.
- 2026-11-11, rerun 3 (reports/lead-created-rerun3): Sequence A and B were active again after QA reconnected the sender. Nothing ran: `SalesforceApi.login()` in beforeAll failed with LOGIN_MUST_USE_SECURITY_TOKEN. This machine exits from 43.242.123.66 (not 110.226.126.183 and not the trusted 44.229.234.59); `tailscale status --json` shows ExitNodeStatus None although prefs hold ExitNodeID 322. Blocked on QA: turn on the Tailscale exit node, or add 43.242.123.66 to Salesforce Setup > Network Access. Then run the same command (setup test plus 10 rows, KEEP_TEST_DATA=1, REPORTS_DIR=reports/lead-created-rerun3).
- 2026-11-11 rerun 4 (reports/lead-created-rerun4, KEEP_TEST_DATA=1, 19.8 min, login fixed by QA adding 43.242.123.66 to Salesforce Network Access): 7 passed (Setup, Replied 3, Finished 5, Replied 6, Resume 7, Paused 8 with list Today's Leads, Blacklist 1), 4 failed. With rerun 2 (Finished 2 passed), 8 of the 11 original failures now pass.
- Still failing: Paused 1 (new Lead, Move + Paused, Latest Status Active, run 6af412052352a4010f8efa87 COMPLETED), Paused 4 (prospect in Sequence B, no "has been paused for N days" in Activities, runs COMPLETED), Unsubscribed 1 (Latest Status Completed instead of Unsubscribed, run 6af4152a2352a4010f8fb29f COMPLETED), Blacklist 2 (Refold run 6af41642aadae84173f2bc9a, step "Blacklist Domains (Bulk)" Errored; Blacklist 1 passes with the same step). Refold run COMPLETED with the action not applied: likely product, QA to decide bug or not. Not read yet: skipped steps of those runs.
- 2026-11-11 QA evidence: Paused 4 passes the pause itself (Hannah Weiss: Latest Status Paused, Activities "has been paused for 1 days for sequence  Sequence B", two spaces before the link). My regex had one space: script fault, fixed (`sequence\s+Sequence B`). Paused 1 (mateo.rivas.mwbrn7p41): Active, no pause entry, email sent; QA rule: two activities cannot run together, the first runs and the second is ignored, so Paused needs the prospect already in the sequence. But Move + Replied (row 3) and Move + Finished (row 2) passed. Waiting for QA: Paused 1 drop/keep, Unsubscribed 1 (Completed in Sequence A) two-step flow.
- Blacklist 2: Refold node 98 "Blacklist Domains (Bulk)" body `{"items":["<domain>"]}` returns 400 "Inserted email or domain already exist in this list" on the second Lead. Domain is listed once (screenshot 2026-11-11 12:54). Reproduced in rerun 4 and rerun 5 (runs 6af41642aadae84173f2bc9a, 6af41a628e5dd8e812e2a8d9). QA decides: bug (workflow should skip a listed domain) or expected. Blacklist 2 now removes its domain in a finally block (verified rerun 5).
- Rerun 5 (reports/lead-created-rerun5): Paused 4 failed at its first step: the first Lead ended in Sequence A, Completed (diego.fuentes.mwbsuyi91@mailinator.com), not Sequence B Active. Cause not found. Leftover DNC entries: leadmwbsbjggb.example.com plus five older example.com domains.
- 2026-11-11 rerun 6 (reports/lead-created-rerun6): Paused 4 PASSED (regex fix; the Sequence A result of rerun 5 did not repeat), Blacklist 2 PASSED with the new expectation (second run ERRORED only at "Blacklist Domains (Bulk)", domain leadmwbtc3hbb.example.com listed once, QA 2026-11-11: duplicate domain makes the step error). Spec: `runNowExpectingError` in salesforce-lead-created.ts. Test case Blacklist 2 row updated. QA emptied the Do Not Contact list. Open: Paused 1 and Unsubscribed 1 (drop, keep as stays Active, or two-step flow). Not committed.
- 2026-11-11 rerun 7 (reports/lead-created-rerun7): Unsubscribed 1 PASSED in the two-step flow (prospect in Sequence B, then Unsubscribed alone, runs 6af41dc6d48f0071c29a3086 and 6af41df1d48f0071c29a3e3f). Paused 1 dropped (QA). Lead is created now: all 11 original failures resolved or closed (Paused 1 dropped, 10 pass at least once). Unsubscribed 2 still Move + Unsubscribed in one run (proposed, asked QA). Not committed.
- 2026-11-11 rerun 8 (reports/lead-created-rerun8): Unsubscribed 2 PASSED in the two-step flow with list Today's Leads (runs 6af41ec0aadae84173f3cb27, 6af41ee8d48f0071c29a6bd7). Lead is created: 32 cases + Setup test, every case has passed at least once, none fails. Not run as one full file yet, not committed. QA runs the full file: `KEEP_TEST_DATA=1 npx playwright test --project=chromium tests/salesforce/lead-created.spec.ts` (needs trusted IP, sender connected, Sequence A and B active).

## Lead created STAGING APPROVED (QA, 2026-11-11)
- QA: all test cases passed, good for staging. Workflow: Lead is created in Salesforce (AL-4144), account `sfreplyreceived`, spec `tests/salesforce/lead-created.spec.ts` (33 tests = 32 cases + Setup), cases `test-cases/salesforce/lead-created.md`, flow `src/flows/salesforce-lead-created.ts`. Every case passed at least once in separate runs (no single full run). Not committed. Production smoke not started.
- Root causes found 2026-11-11: (1) `mailinator.com` on the Global Do Not Contact list (a Blacklist run adds the domain of every Lead in the window) made every prospect in a sequence show Blacklisted. (2) `do-not-contact.page.ts` used `getByRole('row')` but the list rows are `div.tanstack-table--tr`, so hasEntry was always false and cleanups never ran (fixed: `entryRows()`). (3) Sequences A and B were Paused because the sender was disconnected (HTTP 400 code 2001 on activate); QA reconnected it. (4) Salesforce API login needs a trusted IP (QA added 43.242.123.66 to Network Access). (5) Paused regex had one space but the page renders two (`sequence\s+Sequence B`).
- QA rules: a blacklisted domain still lets the prospect join an active sequence, and the prospect then shows Blacklisted; a domain not in a sequence shows no status. Two activities in one run do not both apply: Paused and Unsubscribed need the prospect already in the sequence (two steps). Paused 1 dropped. Unsubscribed 1 and 2 use the two-step flow. A second Lead on an already listed domain makes "Blacklist Domains (Bulk)" error (400 "Inserted email or domain already exist in this list"): expected, Blacklist 2 asserts it.
- Spec additions: `clearDnc`, Setup test, `runNowExpectingError`, `windowCheck` on `existingRow` steps. Runs: reports/lead-created-rerun2 to rerun8.
- Next: QA runs the full file once if wanted (`KEEP_TEST_DATA=1 npx playwright test --project=chromium tests/salesforce/lead-created.spec.ts`), then commit, then production smoke cases.

## Opportunity created STAGING DONE (2026-11-11), commit 992e7a1

- 27 cases, each passed at least once over several runs (no single full run). Add Prospect 8 removed by QA (a deal created days ago is not a "created" event for a real user). Restore passed, trigger on `sflinkclicked` is off. Spec has 28 tests (27 cases + Restore).
- Proven in Logs: a run reads `FROM Opportunity WHERE CreatedDate>={{timestamp}} LIMIT 200`. Run 1 read the new deal (1 record), run 2 30 seconds later returned 0 records for the same deal. Whether it is a cursor or a dedupe is not known. The dev log says every run reads up to 200 Opportunities: contradicted. QA decides if it is a bug.
- Script fixes: Status 5, 6, 7, 8 create a second deal for the same contact before each follow-up run. Blacklist 4 rewritten (two new deals, two domains). `DoNotContactPage.entries()` read nothing (rows have no td), so cleanup never removed domains and later Blacklist rows hit "Inserted email or domain already exist in this list".
- Env lessons: the laptop sleeping froze a run (use `systemd-inhibit --what=sleep:idle`). A changed public IP made the Salesforce API login fail (LOGIN_MUST_USE_SECURITY_TOKEN), fixed by QA adding the IP in Salesforce Network Access. Always KEEP_TEST_DATA=1.
- Open: the 3-hourly cron runs on `sflinkclicked` ended ERRORED at 18:00, 21:00, 00:00, 03:00 UTC (not looked into). Throwaway `scripts/probe-opp-*.ts` still to delete. No production smoke yet.

## Lead created production smoke (2026-11-12), script written, not run

- QA approved 11 checks 2026-11-12 (`notes/production-testing/27-salesforce-lead-created.md`, README row 27). Workflow is not published on production yet (QA), so QA runs it after the publish. Fixed ticket: AL-4224 (Select a list did not open); AL-4144 has no other linked bug.
- Files: `tests/salesforce/lead-created-smoke.spec.ts` (11 checks + Restore), `tests/setup/salesforce-lead-created-smoke-sequence.spec.ts` (4 steps, Stop sending follow-ups OFF, sender, activate), `scripts/run-salesforce-lead-created-smoke.sh`, npm `smoke:salesforce-lead-created`. Shared edits: `salesforce-lead-created.ts` (`LEAD_LAST_RUN_FILE`, `LEAD_TRIGGER_NAME`, `expectProspect` timeout), `salesforce-integration.page.ts` (`onTriggers()`). Typechecked and listed (12 tests), never run.
- Rules in the script: account `emailopenedprod`, run-now, any other trigger on stops the check before saving, Move/Unsubscribed/Blacklist skip when the window holds another Lead, up to 6 sends counted against SEND_CAP, no Logs (3 min wait for the prospect), last test turns the Lead trigger off.
- Needs QA: `npm run login:saleshandy -- emailopenedprod`, Salesforce Network Access for this machine's IP, Lead workflow published on production. If the trigger name differs on production, set `LEAD_TRIGGER_NAME`.
- Not verified: the Sequence Associated cell shows the full sequence name (exact match, name is 40 characters), TagA on production, run-now on the production Refold account.
- Not committed. No Jira draft yet (comes after the run, from `04-production-smoke-summary.md`).

## Contact created rerun 2 (2026-11-12), reports/contact-rerun2
- Rerun of the 16 failed rows plus Setup, KEEP_TEST_DATA=1, SEQUENCES_PAUSED=1, 45.6 min after QA renewed the Saleshandy session of `sfemailopened`: 9 passed, 9 failed, 1 skipped (Add Prospect 3 needs OLD_CONTACT=1). Restore passed, trigger "Contact is created in Salesforce" is OFF again.
- Passed: Setup (new row, removes mailinator.com from the Do Not Contact list), Add Prospect 1 and 2, Unsubscribed 1, Blacklist 1 to 4, Restore. Blacklist rows pass now: the shared `entries()` fix makes the cleanup work.
- Failed, Refold "Loop on Contacts" ERRORED: Add Prospect 7 (run 6af53980a40f5842895d6a8a), Status 4 (6af53e558ec2873004500072), Unsubscribed 2 (6af53feca40f5842896242f1). Intermittent: the same step passed in Add Prospect 1 and Unsubscribed 1. Not read in Refold yet.
- Failed, prospect Inactive (180 s): Status 5, 6, 7, 9 and Unsubscribed 3. Every one needs a second run to act on a Contact that an earlier run imported. Unsubscribed 3 had a new Contact in run 2 and the earlier prospect still stayed Inactive. Probable cause (not proven): a run acts only on Contacts not read before, like Opportunity (commit 992e7a1: run 2 read 0 records for a deal read 30 s earlier). The Opportunity follow-up-deal fix does not carry over, a new Contact does not carry the old one. Not checked: Sequence A paused state.
- Status 8: Refold GET /execution/6af53eb0a40f584289611b39 answered 503 (service error).
- Spec change: added the Setup row. Nothing committed. Next: read the Refold records of Status 5 run 2, then ask QA how the second-run rows should work.
- PROVED 2026-11-12 (Refold, Status 5 runs 6af539a3a40f5842895d70fb and 6af539d2659820d6a7d7e682): the Contact query is `SELECT FIELDS(ALL) FROM CONTACT WHERE CreatedDate>={{timestamp}} LIMIT 200`. Run 1 read the new Contact (1 record). Run 2, 47 s later, with a window start (01:00:18Z) before the Contact's CreatedDate (03:59:11Z), returned 0 records. Same as Opportunity. So a second run never acts on a Contact an earlier run read: Status 5, 6, 7, 9 and Unsubscribed 3 cannot pass as written. The dev log claim "every run reads up to 200 Contacts" is contradicted. Proposed fix: a follow-up Contact with the same email before each follow-up run (like Opportunity). Waiting for QA.
- 2026-11-12 Refold records of all 23 runs in contact-rerun2 (probe script, deleted): every run read only Contacts created since the previous run (first run 20, repeat runs 0). All 3 "Loop on Contacts" ERRORED runs (Add Prospect 7 6af53980a40f5842895d6a8a, Status 4 6af53e558ec2873004500072, Unsubscribed 2 6af53feca40f5842896242f1) read a Contact with NO Email ("Iyer"); none of the 20 other runs did. Add Prospect 7 read its own Karan Iyer (no Email), so the Contact workflow ERRORS on a no-Email Contact (Lead Add Prospect 4 and Opportunity Add Prospect 6 complete with no-Email records). QA decides bug or expected.
- Status 4 and Unsubscribed 2 read Meera Iyer and a no-Email Iyer created by `account-created.spec.ts` (line 299), which ran in parallel on the same Salesforce org. The Contact trigger reads every Contact of the org, so a parallel Account run breaks Contact runs. Run Account and Contact created one after the other, or never let Account create a no-Email Contact while Contact runs.
- Add Prospect 3 (older Contact never imported) cannot work: a run reads only new Contacts. Proposed: drop it, like Opportunity Add Prospect 8. Unsubscribed 3 (earlier prospects unsubscribed too) is contradicted the same way. Both wait for QA.
- Status 5 passed with the follow-up Contact (reports/contact-status5). Follow-up Contact added to Status 6, 7, 8, 9, rerun in reports/contact-status-rerun.

## Opportunity created production smoke (2026-11-12), script written, not run

- QA approved 12 checks 2026-11-12 (`notes/production-testing/28-salesforce-opportunity-created.md`, README row 28). QA says the workflow is published on production. No fixed bug ticket (AL-4142 has no links).
- Files: `tests/salesforce/opportunity-created-smoke.spec.ts` (12 checks + Restore), `src/flows/salesforce-opportunity-created.ts` (own last-run file, run-now, window count), `tests/setup/salesforce-opportunity-created-smoke-sequence.spec.ts`, `scripts/run-salesforce-opportunity-created-smoke.sh`, npm `smoke:salesforce-opportunity-created`. Listed (13 tests), no type errors in these files, never run.
- Rules: account `emailopenedprod`, run-now, other trigger on stops the check, Move/Unsubscribed/Blacklist skip when the window holds another Opportunity, up to 6 sends counted against SEND_CAP, no Logs (3 min wait), last test turns the trigger off. Status checks use a second deal for the same Contact.
- Needs QA: `npm run login:saleshandy -- emailopenedprod`, Salesforce Network Access for this machine's IP. If the trigger name differs on production, set `OPPORTUNITY_TRIGGER_NAME`. Run: `npm run smoke:salesforce-opportunity-created`.
- Not verified: first-run window on production, the Sequence Associated cell shows the full sequence name, TagA on production, Contact Job Title and Department mapped on production (read by the script, not asserted if unmapped).
- Not committed. No Jira draft yet (after the run, from `04-production-smoke-summary.md`).

## Account created run 2 (2026-11-12), sfemailsent
- Setup done 2026-11-12: Sequence A (197850, 2 steps, stop-on-reply ON) and B (197851, 4 steps, OFF) made by QA, active; Job Title to Title on Contact set by `tests/setup/salesforce-account-created-mapping.spec.ts` (run 1 failed Trigger behavior 1 without it); `DoNotContactPage.addEntries` written (walked on staging, not yet run by a row).
- Spec/cases changed from the Lead and Opportunity lessons: Status 1 dropped (Move + Paused in one run), `againOn` makes a new Account with the same Contact email before each follow-up run (Status 5 to 8, Unsubscribed 1), Unsubscribed 1 is two-step (join Sequence B, then Unsubscribed alone), Blacklist 2 adds a second record on the listed domain and records the outcome. Cases now 28. Not committed.
- Run 2 (reports/account-created-run2, KEEP_TEST_DATA=1 ACCEPT_SENDS=1, 42.1 min): 17 passed, 2 failed, 6 skipped. Run 1 passed Trigger behavior 3, Activities list 1 and 2, Add Prospect 3 and 4.
- Failed: Add Prospect 7 (27 of 28 existing org Contacts not imported, so the run does not read the whole org: dev log A4 contradicted, same as Opportunity; Refold query not read yet); Status 5 (Refold run-now answered 503, workflow 682d72d0bcc93496f8906354, not a product result).
- Skipped: Setup (needs Add Prospect 7), Unsubscribed 1, Blacklist 1 to 4 (read-set check, because `existing` stayed empty).
- Restore passed: trigger off.
- Next: read the Account run query in Refold, QA decides Add Prospect 7 and Blacklist 4 and the "reads up to 200 Accounts" lines; then rerun Status 5, Unsubscribed 1, Blacklist 1 to 4.
- 2026-11-12, QA: keep-awake and parallel run. The repo had no keep-awake script for Lead (only a lesson about a manual `systemd-inhibit`). Both runners now restart themselves under `systemd-inhibit --what=sleep:idle` once (SMOKE_AWAKE). New pair runner `scripts/run-salesforce-lead-opportunity-pair-smoke.sh` (`npm run smoke:salesforce-lead-opportunity-pair`): Lead first, Opportunity after the gate plus a 90 s stagger, logs in `reports/salesforce-pair-<time>-*.log`. Both specs read `SIBLING_TRIGGERS` so the other trigger being on does not stop a check. Syntax checked, specs list (50 tests), never run.

## Contact created STAGING rows all pass (2026-11-12)
- 30 rows (Add Prospect 3 removed by QA, a run reads only Contacts created since the previous run). Every row has passed at least once. Not committed.
- Fixes this session: Setup row (mailinator.com off the Do Not Contact list); follow-up Contact with the same email for Status 5, 6, 7, 8, 9 and Unsubscribed 2 (run 2 reads 0 records for a Contact run 1 read); Status 5 and 9 also check Activities "has been paused for N days for sequence  Sequence A"; Unsubscribed 3 rewritten (import, delete the Contact in Salesforce, select Unsubscribed, create the same Contact again, check Activities "Marked as unsubscribed by", Latest Status stays Inactive for a prospect in no sequence); Add Prospect 7 expects the run ERRORED at "Loop on Contacts" (QA: not a bug, Email is mandatory) and Logs status Error; `deleteContact` in `salesforce-api.ts`; `runNowExpectingError` in `salesforce-to-saleshandy.ts`.
- Cause of the "Loop on Contacts" errors in Status 4 and Unsubscribed 2: no-Email Contacts created by `account-created.spec.ts` on the same Salesforce org, read by the Contact run. Run Account and Contact one after the other.
- Lesson applied: when QA names other workflows to reuse, compare how they check every expected result (lessons.md 2026-11-12).
- Trigger "Contact is created in Salesforce" on `sfemailopened`: state not checked after the last Restore row. Production smoke not started.
