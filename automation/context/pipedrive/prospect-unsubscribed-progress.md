# Pipedrive Prospect Unsubscribed: progress (2026-10-26)

Spec `tests/pipedrive/prospect-unsubscribed.spec.ts` (29 rows, hand-written, QA's choice), data `test-data/pipedrive/prospect-unsubscribed.csv`, account `gpipedrive`. Run logs in `evidence/`. Rerun single rows with `-g "<section> <n>:"` and `REFRESH_USED_ONLY=1 TEST_DATA_ONLY=pipedrive/prospect-unsubscribed`, never the whole file again (QA).

## Setup done

- Sequence "Pipedrive Unsubscribed QA", id 197339, active, one step ("Save cost & achieve more!"), sender Kartik 60 (`1kartiktest+10@gmail.com`). Kartik 5 was greyed out with a red dot in the Add dialog (disconnected), so it could not be picked. "Unsubscribe as Link" saved by hand.
- Setup spec `tests/setup/pipedrive-unsubscribed-sequence.spec.ts`. `addEmailAccounts` now searches for the account in the dialog (the list only shows the first accounts until scrolled).
- Run with `KEEP_OTHER_TRIGGERS=1` (the spec sets it): the Email Sent session keeps its trigger on in the same account. A run without `KEEP_TEST_DATA=1` or `TEST_DATA_ONLY` fails in global setup (`Could not find a fresh name`).
- Use `--output=<private dir>`: two sessions sharing `reports/test-results` deleted each other's traces (ENOENT).

## Seen by hand 2026-10-26

- Mark as Unsubscribe (UI) fires "Prospect is Unsubscribed in Saleshandy" on staging even for a prospect that was never sent anything. UI rows therefore send no email.
- One UI unsubscribe with Create a Person made TWO persons (ids 41, 42) and TWO Logs entries (12:19 PM, 5.2 s and 5.3 s, both Success). Same duplicate the Email Sent session saw (persons 36 to 39). Bug-or-not: QA. Rows that expect "1 person" will fail on it.
- Link rows send step 1 first, and the Email Sent trigger of the other session is on, so the row waits 60 s and removes what Email Sent made before it opens the link.

## Script fixes 2026-10-26 (fork, after run 1)

Run 1 ended 15 passed, 14 failed of 29. QA then said: fix scripts, no more reruns (QA runs the script). Before that message, Create a Deal 1 and Delete Deal 1 had each been rerun once, Create a Deal 2 and Create a Lead 2 once, and Combined actions 2 once.

| Row | Cause | Fix made | Result |
|---|---|---|---|
| Trigger behavior 4 | Script. `openHeaderMenu` read `count()` of the person page's "..." menu before the page had loaded, took the deal branch and waited for a "Lost" button that a person page does not have. The 12 min limit ran out in the clean-up. | `pipedrive.page.ts`: wait for either the menu or "Lost" (30 s) before choosing | Not rerun (link row, send cap at 41 of 40) |
| Create a Deal 1 | Script. The stage list opened empty right after the pipeline pick, so "Qualified" never showed. | `pipedrive-integration.page.ts` `fillExtraConfiguration`: open the list again (up to 4 times, Escape between) until the option shows | Rerun once: passed |
| Delete Deal 1 | Script, then setup gap. (1) Add deal dialog: Pipedrive puts the person's name into Title after the fill, so deal 2 was saved as "Legacy Person" and the tile "Legacy deal 2" never showed (reproduced 3 of 4 times with a throwaway). Fixed in `deals.page.ts`: retype the title until it still stands 1.5 s later; also reload once if the tile is late. (2) With that fixed the row reached the unsubscribe and failed on the workflow: both Logs entries (2:27 PM, Success) show the v1 nodes "Deal exist? > Custom Code > Find a deal > Get base url", and "Find a deal" searched `/v1/deals/search` with exact title = the prospect's email and returned no items. The legacy deals are titled "Legacy deal 1/2", so v1 finds nothing and deletes nothing. | See left | Rerun: setup now passes, row fails on the workflow (v1). Not a script cause. Test data not bent (titling the legacy deals with the email would fit v1 only) |
| Update a Deal 1 | Same "Find a deal" lookup, not read in Logs (inferred: the deal stayed "Legacy deal 2", unchanged) | The title fix above | Setup gap (v1) unless QA says otherwise |
| Create a Lead 2 | Not classified. Rerun: no lead after 90 s. Two Error entries at 2:40 PM in Logs, detail not read. | None | Open |
| Create a Deal 2, Create a Deal 3 | Not classified. Logs entries not read. Deal 2 rerun: no new deal after 90 s. | None | Open |
| Combined actions 2 | Not classified. Setup found 2 persons right after creating one. A leftover person from an earlier row is possible, not checked. | None | Open |

Also seen in Logs: every unsubscribe fires two runs in the same minute (2:10, 2:27, 1:31 to 1:35 PM), the duplicate-fire finding. The Create a Deal run at 2:10 PM shows "Create Deal > Copy - Create a person", so some runs are on the v1 definition too: confirm per run, since the case file calls a v1 result a setup gap, not a v2 bug. This also touches the 6 duplicate rows (not read per row).

Evidence logs: `evidence/2026-10-26-unsub-fix-*.log`. Throwaway specs deleted. Typecheck passes.

## Duplicate runs seen 2026-10-26 (bug-or-not: QA; no bug filed)

- By hand, 12:19 PM: one Mark as Unsubscribe (UI) with Create a Person gave persons 41 and 42 and two Logs entries (5.2 s and 5.3 s, both Success).
- Logs first page at about 2:00 PM, pairs in the same minute for "Prospect is Unsubscribed in Saleshandy" (not matched to rows): 1:31 PM `6adf08dcaf32a467981526ad` (7.6 s) and `6adf08db1b36e7e6b5e04d3f` (5.9 s), both Success; 1:32 PM `6adf0933a5c6b2da66e7dc06` (1.9 s) and `6adf093384fba224c21ebaba` (2.3 s), both Success; 1:34 PM `6adf0991757bd52d6582cfa6` (2.4 s, Success) and `6adf0991b40fe7dbefe2904c` (Error).
- Rows that saw it in Pipedrive (run1): Create a Person 2 and Update a Person 1 (2 activities, expected 1), Create a Lead 1 (persons 57, 58), Create Organization 1 (2 organizations, expected 1) and 2 (3, expected 2), Combined actions 1 (persons 81 to 86).
- UI unsubscribes send no email, so a Send-now race does not apply to these rows.
- The Delete Deal 1 Logs show the workflow ran as v1 nodes ("Find a deal", "Get base url"); not checked whether the duplicate rows ran v1.

## Create a Deal 2 and 3 are product, not script (read-only check 2026-10-26, about 6 PM)

- Create a Deal 2 run (prospect dulce.alvarado, 2:36 PM, executions `6adf1824e8899427f2533551` and `6adf1824af32a467981cc66d`, both Success): the "Create Deal" node sent only pipeline_id 1, stage_id 1 and the title (the email). It had no person_id, although the person (id 115) existed. Pipedrive Deals list: two deals titled with that email, Contact person empty. The person's page shows only "Legacy deal 1".
- Create a Deal 3 prospect (shanelle.ramnarine): one deal titled with the email, Contact person empty. The person existed.
- Deals made for prospects that were not in Pipedrive (Create a Deal 1 style) carry the contact person (thabo.segokgo, ilsy.banegas).
- Case file expects the deal on the existing person (rows 2 and 3 of Create a Deal). The script reads the person's deals, which is what the case file asks for. No script change.
- Create a Lead 2: both 2:40 PM entries are Error (`6adf190d757bd52d658ad3d7`, `6adf190d1b36e7e6b5e8519c`), AL-4178.

## Session saved 2026-10-26 evening (session 0f30065e-b4be-4da1-ade2-da84cc86946b, local-project-e4)

State: 29 rows, 16 passed, 13 failed (15 from run1, plus Create a Deal 1 on a rerun after its fix). No run since. QA runs the script; Claude fixes code and reads Logs, no reruns.

Jira (AL-4170 Pipedrive parent, AL-4176 Unsubscribed sub-task, epic AL-3982):
- AL-4177 duplicate runs (Create a Person, comment 79470 holds the other rows). Rows: Create a Person 2, Update a Person 1, Create a Lead 1, Create Organization 1 and 2, Combined actions 1.
- AL-4178 Create a Lead fails 400 "lead_fields is not allowed", lead not created. Row: Create a Lead 2 (Create a Lead 1 and Combined actions 1 probably next).
- Not filed yet: Create a Deal 2 and 3 (deal created but without the existing person, see the section above). Needs a draft in `jira/drafts/`.

Rows still open (script side):
- Trigger behavior 4: fixed in code, QA to rerun (link row, sends email, send count 41 of 40).
- Delete Deal 1: setup fixed; workflow runs as v1 ("Find a deal" by exact title). Ask why gpipedrive runs v1; case file calls v1 a setup gap.
- Update a Deal 1: probably the same v1 lookup; its Logs entry not read.
- Combined actions 2: setup found 2 persons right after creating one (ratu.bainimarama); cause not known; its Logs not read.

Decisions: no Pipedrive clean-up after rows (afterEach removed from this spec; QA 2026-10-26). `wipe()` stays only in `sendAndClear` (link rows); QA has not answered whether that may stay. People and organization list reads use the first page only.

Hand-test data (unused rows in `test-data/pipedrive/prospect-unsubscribed.csv`): Create a Lead 1 Xiomara Funes (xiomara.funes@mailinator.com, dbt Labs); Combined actions 1 Thabo Segokgo (thabo.segokgo@mailinator.com, Contentful); Combined actions 2 Khin Myint (khin.myint@mailinator.com, Asana). Create a Lead 2 row (Thabo Kgosi) is used.

Jira kit: Pipedrive tracking section added to `jira/docs/jira-reference.md`. Logs page shows 25 entries per page (pager `&page=N`), sub-task AL-4170 children AL-4171 to AL-4176 (no Email is Bounced).

## Rerun of the 13 failed rows 2026-10-27 (QA asked for it; log `evidence/2026-10-27-failed-rerun.log`)

Result: 1 passed, 12 failed. The `prospect()` fix (row marked used when the test takes it) is in place.

- Pass: Trigger behavior 4.
- Product: Create a Person 2 (2 activities, expected 1) and Create a Lead 1 (3 persons with the same email, ids 155 to 157) are the duplicate runs of AL-4177. Create a Lead 2 (no lead on the person) is AL-4178 (Logs not reopened this run).
- Script, People list guard: Create a Deal 2, Create a Deal 3, Update a Person 1, Update a Deal 1, Delete Deal 1, Combined actions 2 stopped in setup. `people.page.ts:33` throws because the list shows 49 to 56 people but only 48 load. The workflow never ran for these rows. Fix needed: load the whole list (scroll the grid) before reading it.
- Script, test data: Create Organization 1 ("Outreach") and 2 ("HubSpot"). Logs entry 6ae02feea5c6b2da66ac099b (Create Organization 1): the Pipedrive step got 400 ERR_SCHEMA_VALIDATION_FAILED, "Invalid input: industry with provided value does not exist." The CSV Company Industry values ("Sales Engagement", "CRM Software") are not in Pipedrive's Industry picklist (`organization-industry-list.md`). Same data cause as in the Outcome Updated and Email Sent specs. Create Organization 2's entry was not opened.
- Script, add prospect: Combined actions 1 stopped at "Add Thabo Segokgo to the sequence" (`sequence.page.ts:86`, "Done" button not visible after 30 s). Cause not looked at. The workflow never ran.
- Create a Deal 2 and 3 product finding (deal without the existing person) is from the read-only check on 2026-10-26, not from this run. No Jira draft yet (QA stopped the draft).

## Script fixes after the 2026-10-27 rerun (not rerun yet)

- People list reader: already fixed at 11:04 by another session (`people.page.ts` scrolls the virtual list and merges rows by id). Not touched here. `organizations.page.ts` still has the old "total > loaded" guard; it will throw the same way once the Organizations list passes about 48 rows.
- Industry: `prospect()` in the spec now maps Company Industry to Pipedrive's picklist (Ecommerce to Retail, any other value to "Technology, information and media", QA's mapping from the Outcome Updated spec). Covers Create Organization 1 and 2 and any row a refresh brings in.
- Combined actions 1: the trace shows `POST /api/edge/contacts/` answered 400, so Saleshandy refused to create the prospect (no Done dialog). The response body is not in the trace, cause not proven. Likely cause: thabo.segokgo@mailinator.com was already a prospect from the hand test of 2026-10-26. `prospect()` now marks the row used, so the next `REFRESH_USED_ONLY` run replaces it with a new person.
- Typecheck passes.

## Rerun 2 of the 12 failed rows, new data, 2026-10-27 (log `evidence/2026-10-27-failed-rerun2.log`)

Result: 0 passed, 12 failed. Every row got past its setup (the People list reader, the industry list and the used-row fixes worked). Industry: Create Organization 1 and 2 now create organizations (3 "Grafana", 3 "Cohere"), so the 400 is gone. Combined actions 1 now adds its prospect. No row failed for a script reason.

Product, duplicate runs (AL-4177): Create a Person 2 (2 activities, expected 1), Create a Lead 1 (persons 171 and 172), Update a Person 1 (3 activities, expected 1), Create Organization 1 (3 organizations, expected 1), Create Organization 2 (3, expected 2), Combined actions 1 (6 persons, ids 182 to 187), Combined actions 2 (5 activities, expected 2).
Product, AL-4178: Create a Lead 2 (no lead on the person). Logs not reopened in this run.
Product, not filed: Create a Deal 2 (person keeps only "Legacy deal 1") and Create a Deal 3 (person has no deal). Same symptom as the 2026-10-26 check (deal made without the existing person). Deals list not rechecked in this run.
Product or setup gap (v1): Update a Deal 1 (Logs 6ae03ed57309264ea27db633, 11:34 AM) and Delete Deal 1 (6ae03f727309264ea27dc248, 11:36 AM). Both ran "Deal exist? > Custom Code > Find a deal > Get base url" and no update or delete step. The case file calls a v1 result a setup gap, not a v2 bug. Not a script cause. Open question for QA: why gpipedrive runs v1.

## Rerun 3, new data, 2026-10-27 (log `evidence/2026-10-27-rerun3.log`)

Create a Deal 2 (tau.wari), Create a Deal 3 (tamanda.nyirenda), Update a Deal 1 and Delete Deal 1: 4 failed, same result as rerun 2 with all-new people. Create a Deal 2: person keeps only "Legacy deal 1". Create a Deal 3: person has no deal. Update a Deal 1: newest deal not updated. Delete Deal 1: newest deal not deleted. No script cause.

## State on 2026-10-28 (reruns, fixes, tickets)

Overall: 29 rows, 22 pass, 7 fail. All 7 failures are product problems. No product fix is confirmed. 16 passes date from 2026-10-26 and were not rerun. Trigger behavior 4 passed 2026-10-27. Create a Person 2, Update a Person 1, Create Organization 1 and 2, and Combined actions 2 passed on 2026-10-28.

Failing rows and tickets:
- Create a Lead 1, Create a Lead 2, Combined actions 1: AL-4178. The "Create a lead" step gets 400 `"lead_fields" is not allowed`. Combined actions 1 also makes 3 persons from one execution (ids 263 to 265 and 281 to 283). The 3 persons have no ticket.
- Create a Deal 2: AL-4180. Create a Deal 3: AL-4179. The Create Deal step sends only pipeline_id, stage_id and title (the email), with no person.
- Update a Deal 1 and Delete Deal 1: AL-4185, created 2026-10-28 from `jira/drafts/unsubscribed-pipedrive-update-delete-deal-two-deals.json`. Related: AL-4184 (same symptom on Reply is Received). Logs show "Deal exist? > Custom Code > Find a deal > Get base url" and no update or delete step. "Find a deal" searches `title = <prospect email>`. Open point: those runs used the old "Legacy" deal titles, not realistic ones.
- AL-4177 (double run): not seen in the runs from 10:25 AM on 2026-10-28. Intermittent, not closed. Comment 79516 was posted on it by mistake (QA wanted a draft only). The MCP cannot delete comments; QA deletes it by hand.

Latest ticket comments (read 2026-10-28): AL-4178, AL-4179 and AL-4180 each have one comment from Rudra Chauhan at 11:00 AM: "there is an error while uploading the json on the pipedrive. blocked by third party." (mentions QA). AL-4177 has three comments, all from QA (79470, 79472, 79516). AL-4184 and AL-4185 have none.

Script changes today (not committed): `organizations.page.ts` reader scrolls and merges by id; `generate.ts` exports `companyNames` and `companyFields`; `countries.ts` adds 12 countries (name pool was down to 64 free combinations); the spec has `useFreeCompany` for Create Organization 1.

Decisions: names. QA 2026-10-28: stop using "Legacy Person" and "Legacy deal N". The spec still creates them (`personFirst`, `legacyDeals`). QA has not answered whether to change the spec. Proposed default: change only the Update a Deal 1 and Delete Deal 1 rows, because Create a Person 2 and Update a Person 1 use the old name as the old value.
Manual data for Update a Deal 1 (Soa Rakotomalala, Outreach) and Delete Deal 1 (Kossi Ayivi, Asana) was given in chat, with no CSV. Both emails are in `test-data/_generated-emails.txt`.
Process: logs of runs go to the scratchpad, not to an `evidence/` folder. Check for a live run before starting one (`pgrep -af "playwright test tests/pipedrive/prospect-unsubscribed" | grep -v pgrep`).

## Bug retest 2026-10-29 (AL-4177, AL-4178, AL-4179, AL-4180, AL-4185)

Pipedrive reconnected by QA first (gpipedrive showed "Re-connect"; the 10 rows of the first attempt stopped in setup). All 12 matched rows then passed at least once on Staging: Create a Person 2, Create a Lead 1 and 2, Create a Deal 2 and 3, Update a Person 1, Update a Deal 1, Delete Deal 1, Create Organization 1 and 2, Combined actions 1 and 2. Create a Deal 2 failed once (test read an empty deal list; Logs entry 6ae31deb5dfd414633a90964 and person 542 showed the deal on the person) and passed on a rerun. That empty read is not explained.

Script fixes: 16 countries added to `countries.ts` (name pool ran out at 12394 ledger emails); People and Organizations readers retry an incomplete read 3 more times and scroll 600 px; `create()` on Organizations waits up to 30 s for the new row; Create Organization 2 counts before the event and expects one more (8 "Shopify" organizations from earlier runs).

Jira: five Verification comments (AL-4177, 4178, 4179, 4180, 4185) written to `jira/drafts/` and sent by QA 2026-10-29. No status change.

Open: QA has not decided whether the spec stops using "Legacy Person" and "Legacy deal N". The Pipedrive page class reuses the Salesforce check, so a dropped Pipedrive connection reads "Saleshandy lost its Salesforce connection".

## Production smoke, 2026-10-29

QA approved `notes/production-testing/14-pipedrive-unsubscribed.md` (10 checks, 10 sends; Create a Lead, Create a Deal and Create a Person are one row; checks 1 and 2 use the real unsubscribe link, the rest Mark as Unsubscribe in the UI; realistic names, no "Legacy"). Tickets covered: AL-4177, AL-4178, AL-4179, AL-4180, AL-4185.
Written, typecheck clean, NOT run: `tests/pipedrive/unsubscribed-smoke.spec.ts`, `tests/setup/pipedrive-unsubscribed-smoke-sequence.spec.ts`, `scripts/make-pipedrive-unsubscribed-smoke-data.ts`, `scripts/run-pipedrive-unsubscribed-smoke.sh`, `npm run smoke:pipedrive-unsubscribed`, README row 14.
Run order for QA: `SMOKE_SEQUENCE_ID=new npm run smoke:pipedrive-unsubscribed` (gate, creates the sequence, stops with exit 5); save Sequence Settings > Unsubscribe > "Unsubscribe as Link" on it by hand; then `SMOKE_SEQUENCE_ID=<id> npm run smoke:pipedrive-unsubscribed`. Email Sent and Email Opened must be off on emailopenedprod.
Open: the UI rows may not fire on production (HubSpot smoke, 2026-10-19). Update a Deal and Delete Deal record the Logs row, they do not assert the node name "Find person's latest deal" because the Logs list shows only the row text.
