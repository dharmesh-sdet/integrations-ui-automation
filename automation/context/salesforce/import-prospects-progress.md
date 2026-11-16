# Import Prospects from Salesforce: exploration progress

Started 2026-11-12. Staging `https://pyxis.lifeisgoodforlearner.com`.

Account (QA 2026-11-12): `sfemailopened`, login dharmesh+noemailsent@saleshandy.com, session
`auth/saleshandy-sfemailopened-chromium.json`. It has no MCP browser server in `.mcp.json`. Use a
Playwright script with that storage state. Checked 2026-11-12: Salesforce connected, Prospects Import
tab in default state. The first walkthrough ran on `sfemailsent`; that account still has the toggle on
and both activities saved with empty configuration (nothing else changed). The `sfemailopened` account
is also used by Salesforce Email Opened.
Path: `/api-and-integrations/integrations/salesforce?tab=prospects-import`.
No Jira sub-task (QA said not to create one). Sheet row 14. Status table row 9.

## Observed on staging [staging]

- Tab "Prospects Import" has one row with the toggle "Import Prospects from Salesforce". The toggle
  is off by default.
- The row also has an activity select. It is disabled while the toggle is off.
- A button "Import Prospects" sits at the bottom right. It is disabled until a saved activity
  exists after a reload.
- The select offers two activities: "Add Prospect in Saleshandy" and
  "Move Prospect to another Sequence in Saleshandy". Both can be chosen at the same time (two chips,
  each with an edit icon and a remove icon).
- Add Prospect dialog "Extra Configuration": one field, "List View(while adding)".
- Move dialog "Extra Configuration": "List View(while adding to Seq)", "Sequence", "Sequence Steps".
  Sequence Steps stays disabled until a sequence is picked.
- List View options (searchable, Salesforce Contact views only, no Lead views): All Contacts,
  Bulk SMS Contacts, New Last Week, New This Week, Birthdays This Month, Recently Viewed Contacts,
  My Contacts.
- Sequence options on this account: Sequence B, Sequence A, Salesforce Email Sent Regression,
  Salesforce's First Sequence. Steps for Sequence A: "Step 1 - Day 1", "Step 2 - Day 3".
- Field Mapping tab lists Lead, Contact, Opportunity and Account properties.

## Possible product issues (QA to confirm, not yet reported)

1. Save with every field empty closes the dialog with no validation message, and the chip stays.
2. After a reload, "Import Prospects" is enabled while both activities hold an empty configuration
   (checked by reopening the Add Prospect dialog: List View empty).
3. Pressing Escape on the dialog leaves the activity chip selected with no List View.

## Not yet done

- No import was run. Open: size of each List View in Salesforce, what "Import Prospects" does with
  an empty configuration, result in Saleshandy (CRM / Prospects, sequence, Logs tab), duplicate
  and active-in-another-sequence behavior, Logs tab rows.
- Changes made on the account: toggle turned on, both activities added with empty configuration.
  Nothing else changed.

## Public research, 2026-11-12 [public docs]

- Help center pages: Salesforce Integration (9148639) and Salesforce triggers and activities
  (9204109). They list the trigger "Import Prospects from Salesforce" under "Salesforce to
  Saleshandy Direct Prospects Import" with the two activities above. They do not cover run timing,
  one-time or continuous import, limits, duplicates or plan requirements. They send readers to
  support chat.
- Launch blog (introducing-salesforce-integration): after mapping and triggers, go to prospect
  import, choose the CRM list, optionally choose the sequence.
- Duplicate rules from the general import pages (not Salesforce specific): match by email; an
  existing prospect is skipped and listed in the skipped prospect report; admin setting "Allow
  adding duplicate prospects in multiple sequences" (Settings > Admin settings), off blocks any
  prospect already in another sequence, on has two rules (only when no longer active, or any
  status). CSV import: 100k prospects per file, 120 columns. These may not apply to this import.
- Mailshake (other product, comparison only): Contacts and Leads are a one-time import, Campaigns
  can run in the background, filters by owner and by how far back.
- Public pages hold no user stories for this feature.

## Staging exploration 2026-11-12 on sfemailopened (QA said start, no developer answer yet)

Done by script with the saved session. Scripts are in the session scratchpad only, not in the repo.

How the import works (read from network and Logs):
- Save writes the workflow `6953cb2678b14b0a0a13256e` fields by PUT: Actions (`add-prospect-in-account`,
  `add-prospect-in-sequence-step`), List View for Add, List View for Move, Sequence Name (sequence id),
  Sequence Step (step id).
- Button "Import Prospects" sends `POST /api/edge/integration/import-prospect` with `{"stepId":"...","appId":3}`.
  It sends no List View. The server reads that from the saved configuration. Answer: "Prospect import started successfully".
- Logs tab then shows one row "Import Prospects from Salesforce" with the nodes Start, Prepare - Actions,
  Rule - Move to Sequence, Get Query, Build query - mapped fields, Saleshandy, salesforce.
- Get Query reads the List View definition (`GET /services/data/v58.0/sobjects/Contact/listviews/<id>/describe`).
  The flow rebuilds a SOQL from it and runs it with `paginated_response: true`.

Results:
1. Button with an empty configuration (Add Prospect only): toast "Please select a Sequence Step before importing prospects."
   The toast also shows when only Add Prospect holds a List View. Add Prospect has no step field.
2. Button with Add Prospect and a List View saved, no Move: same toast.
3. Move saved with List View, Sequence and Step chosen in one dialog session: the step was NOT saved (no PUT for the
   Sequence Step field), and the toast said the same. After reopening the dialog and choosing Step 1 again, Save sent
   the step and the import started. Script-driven, repeat by hand before reporting.
4. Removing the Add Prospect chip sends no request. After a reload the chip is back and Actions still holds both values.
5. The button stays enabled with no chip at all (toggle on).
6. Import with List View "Birthdays This Month" (Salesforce shows 1 contact, Babara Levy, email `b.levy@expressl&t.net`),
   Move to "Salesforce Email Bounced Regression" (paused), Step 1: Logs row Success, 10.4 s. The rebuilt SOQL ends
   with `WHERE Birthdate = THIS_MONTH`, and the `salesforce` node returned an empty list. Nothing was imported.
   The sequence stayed at 38 of 38. Possible cause: the rebuilt SOQL does not match the Salesforce view for date filters.
   Not confirmed.

Salesforce List View sizes (API, 2026-11-12, org has 590 Contacts, 573 with Email): Birthdays This Month 1,
New This Week 25 (made by tests), the other views show 25 as a first page count. Do not use All Contacts.

Sequences on this account: Sequence B and Sequence A are Active (an import there can send mail).
Salesforce Email Bounced Regression, Salesforce Email Opened Regression, Zoho Prospect Unsubscribed QA and
Zoho Conversation Category QA are Paused.

UI note: on this account the expanded sidebar covers the toggle at 1440 px width. Click it in the page, or collapse the sidebar.

Account state left on sfemailopened: toggle on, both activities saved, List View Birthdays This Month for both,
Sequence "Salesforce Email Bounced Regression", Step 1. One import ran, zero prospects added.

## Real import 2026-11-12 (sfemailopened)

- New draft sequence "Salesforce Import Prospects QA", id 197853, two steps, no sender, never activated, so it sends nothing.
  Made by `tests/setup/salesforce-import-prospects-sequence.spec.ts` (new, run with `SETUP_SEQUENCE=1 KEEP_TEST_DATA=1`).
- A draft sequence is listed in the Move dialog's Sequence dropdown.
- Configuration: List View "New This Week" for both activities, sequence 197853, Step 1. The step saved only on a second
  pass (reopen the dialog, choose the step, Save), same as before.
- Result: Logs row Success, 21.3 s. The sequence went to 171 prospects (Draft, 0 contacted). CRM All Prospects went from 598 to 645.
- Salesforce side the same day: 228 Contacts created this week, 217 with an email, 178 unique emails. Saleshandy took 171.
  The 7 missing unique emails are not explained. Possible causes: contacts created after the run (other tests run in
  parallel on the org), or prospects already in an active sequence. Not checked.
- Correction: my first size check of the "New This Week" view said 25. The API call capped the page at 25. The real size is 228.
  The Birthdays This Month size of 1 was read the same way, so it may also be wrong.
- Duplicate emails in Salesforce (217 rows, 178 unique) did not create duplicate prospects as far as the totals show. Not
  checked prospect by prospect.
- Account state: toggle on, both activities saved, List View New This Week for both, sequence 197853, Step 1.

Next, if QA wants more: run the import a second time to see repeat behavior (same view, same sequence), check the
skipped report, import into an Active sequence with the duplicate setting on and off, and check field values of an
imported prospect against Field Mapping.

## Status 2026-11-12 (earlier): WAITING for developer

QA 2026-11-12: wait for the developer to explain how the import works before more testing.
Do not run an import, write cases or report the three possible issues until then. Background
exploration is allowed if it changes no data.

Questions for the developer: one-time or scheduled run, List View scope (Contacts only?), what
"Import Prospects" does with an empty configuration, duplicate and active-in-another-sequence
handling, limits, where results show (Prospects, sequence, Logs), what happens when both
activities are saved.

## Developer guide received 2026-11-12 (saved, work paused until 2026-11-13)

QA 2026-11-12: save the context, come back tomorrow. Nothing run, no cases written, no files
besides this note and the guide. Full guide: `import-prospects-developer-guide.md` (workflow v4,
node map, config field ids, API calls, 15 developer cases TC1 to TC15, limits, release checklist).

How the guide answers the earlier questions [developer]:
- One-time run per click. No schedule, no trigger on Contact creation.
- Contacts only. One List View per action. Both actions run in the same run.
- Empty configuration: node 28 drops the action, nothing imported, no error. Sequence action also needs a Step.
- Duplicates: upsert by email, no duplicate prospects. Contacts without a valid email are skipped.
- Limit 2000 Contacts per List View per run.
- Results: Logs tab and Refold show only Success. Rejections show only in the edge log (Grafana) or on the Prospects page.

How the guide explains what we saw:
- Birthdays This Month empty list (our result 6): a v3 bug, fixed in v4 (pagination removed). Retest on the current staging version.
- Toast "Please select a Sequence Step..." for Add Prospect only (our results 1 and 2): known webui bug, fix planned. Not ours to report as new.
- Birthdays This Month holds 1 Contact with the invalid email `b.levy@expressl&t.net`. Saleshandy rejects it ("Invalid Email"). Data issue, not a workflow bug.
- 171 imported against 178 unique emails (217 with email) for New This Week: still unexplained. The guide has no cause. Check the edge log for rejected rows.
- Step not saved in one dialog session, empty-configuration button enabled, Escape leaves a chip, chip returns after reload: the guide does not mention them. Still possible product issues, unreported.

Do not forget (guide rules): staging only; no tokens in the repo; save and restore the workflow
configuration around any change; small List Views only; Draft sequence only; no Salesforce record
changes without QA's OK; COMPLETED is not a pass; check the `myNameProperty → AccountId` mapping on our
account (currency vs text, can reject prospects).

Open for tomorrow (QA to decide): evidence by UI only or also Refold API (needs a Refold key); which
List Views are allowed (guide: small ones; New This Week 228 only on request); whether new Salesforce
Contacts may be created for no-email, last-name-only and comma cases; then draft cases (regression, staging)
from TC1 to TC15 for QA review, no script before "looks good".

## Cases drafted 2026-11-13

Draft cases in `import-prospects-cases-draft.md` (34 rows, from guide TC1 to TC15 and our staging results). Not saved to test-cases, no script. Waits for QA "looks good" and answers to the four open points (UI-only evidence, allowed List Views, new Contacts, the "last thing" QA meant).

## Fresh account ready 2026-11-13

Account `importprospects` (dharmesh+importprospects@saleshandy.com), session `auth/saleshandy-importprospects-chromium.json`, added to `src/config/accounts.ts`. QA removed OTP, connected Salesforce, bought the subscription. No email accounts connected (not needed, the sequence is a Draft).
- Start state seen: Salesforce connected, Contact mapping empty, Prospects Import tab default (toggle off, no activity, 0 prospects not counted yet).
- Field mapping set with `tests/setup/salesforce-field-mapping.spec.ts` (standard pairs: Phone Number to Business Phone, Department to Department, First Name, Last Name, Email) plus `tests/setup/salesforce-import-prospects-mapping.spec.ts` (Job Title to Title). Company not mapped.
- Draft sequence "Salesforce Import Prospects QA", id 197856, 2 steps, progress 3 (Draft). Made with `SETUP_SEQUENCE=1 SETUP_ACCOUNT=importprospects KEEP_TEST_DATA=1`.
- Note: sfemailopened maps Phone Number to Mobile Phone. importprospects uses Business Phone (project standard).
- Cases draft: `import-prospects-cases-draft.md` (now with a data check section and rows 13 to 17 for existing prospects). Still waiting for QA "looks good", and for the answers on small views and new Contacts.

## Cases approved, data made 2026-11-13

QA 2026-11-13: cases look good, saved to `test-cases/salesforce/import-prospects.md` (34 rows). No email accounts needed. QA said create 6 realistic Contacts.
- Salesforce Contacts made by `scripts/make-salesforce-import-prospects-contacts.ts` (Mailing City Rotterdam, one Account "Noordzee Shipping Supplies"). Ids in `test-data/salesforce/import-prospects-contacts.txt`. Contacts made in the shared org are not deleted.
- Custom List View "Import Prospects QA" (Contact, API name Import_Prospects_QA, All contacts, all users, filter Mailing City equals Rotterdam). Checked: 6 items.
- Salesforce session for the account: `auth/salesforce-importprospects-chromium.json` (made with `npm run login:salesforce:auto -- importprospects`).
- Next: write the spec (hand-written, UI only). Not started.

## Spec run result 2026-11-13

Spec `tests/salesforce/import-prospects.spec.ts` (21 tests, 34 case rows). Run in 9 passes on `importprospects`, failed or unrun tests rerun with `--grep`. Final state: 18 tests passed, 3 skipped on purpose (Add 12, Move 3, Move 5), 0 failed. 28 of 34 rows passed, Move 2 and Both 4 also passed, so 30 rows; Add 16 is not in the spec; 3 rows skipped.
Script gaps fixed along the way (none was a product bug): the Prospects Import tab has no page Save (the dialog Save stores everything), the CRM search needs a prospect to exist, the sidebar covers names (closeSidebar in openProspect), state shared between tests, Phone Number has no edit pencil, "Industry" is "Company Industry" in the prospect dialog, update checks need 90 s.
Product findings for QA (not reported, QA decides bug or not):
1. The tab stores the toggle and the chips only when a dialog is saved. A toggle alone is lost on reload.
2. A chip left by Escape shows as selected, but saving its dialog did not keep the activity. Picking it fresh and saving keeps it.
3. A removed chip comes back after a reload (Both 4, same as 2026-11-12).
4. Phone Number: a changed Salesforce number is added, the old one is kept ("+31 10 555 0199, +1 more"). The row expected a replace (proposed, unconfirmed).
5. Updated fields (Job Title, Department) show the new value about a minute after the Logs row is Success.
Notes from the first runs (Both 3, Both 5, Baseline 6, Add 8) were overwritten, because results.json holds only the last run. Rerun with a fresh account to record them again.
Account state: toggle on, Add Prospect and Move saved with List View "Import Prospects QA", Draft sequence 197856. 6 prospects, all in the Draft sequence.
Open for QA: apply the 15 row reduction, drop Add 16, a setup step that makes the suite repeatable.

## Jira 2026-11-13

- AL-4227 "Import Prospects from Salesforce": the tracking Sub-task, parent AL-4131, made by QA 2026-11-13, status In QA, assignee Dharmesh Patel. (Earlier note said no sub-task: now there is one.)
- AL-4228 (Bug, sent by QA): removed activity chip comes back after reloading the Prospects Import tab. Linked to AL-4131 only.
- Draft waiting, not sent: `jira/drafts/import-prospects-activities-not-logged.json` (import update adds no "Profile field updated" entry to Activities, seen on Anna Van Dyke and Tomas Berg). Links AL-4131; AL-4227 to be added once QA agrees.
- AL-4226 (Task, Rudra, In Progress): "fixing the webui and json for the salesforce workflow import prospects from salesforce". Related to AL-4228. A search for Import Prospects bugs found no duplicate of either bug.
- QA verdicts 2026-11-13: dialog Save stores everything (expected), Escape chip not reproducible, chip returns = bug (AL-4228), Job Title empty not reproduced, import update not in Activities = bug (draft). Phone Number added not replaced: open.

## Cases cut to 21 rows 2026-11-13

QA 2026-11-13: `test-cases/salesforce/import-prospects.md` now has 21 rows, one row for each test of the spec (rows that share one click merged, Add 16 dropped). Test titles are "Row N". Row 21 names AL-4228. The 34-row version is gone from the file (it is in git history only if committed: it was not).
Result of the last passes by row: rows 1 to 14, 16 to 18 passed. Rows 15, 19, 20 skipped on purpose. Row 21 shows the chip comes back (bug AL-4228, recorded as a note). Numbers by test: 18 passed, 3 skipped, 0 failed.

QA 2026-11-13: AL-4228 (chip comes back) is a post release bug. Jira Summary needs the prefix [PostRelease], QA changes it by hand. The activities-not-logged draft: ask QA if it is post release too before sending.

AL-4228 renamed by QA to start with [Post Release]. Developer (Rudra) comment 2026-11-13: same behavior on HubSpot, not a blocking issue because the workflow runs only when Import Prospects is clicked, planned after the release of the Salesforce Import Prospects workflow. Linked to AL-4131 only (add AL-4227, AL-4226 by hand).

## Row 15 My Contacts 2026-11-13 (stopped by hand, not a product bug)

Account importprospects had 8 prospects. Import with List View "My Contacts" added 18 and stopped at 26 (27 readings over 5 minutes, no change). Cause found: "My Contacts" is the view of the Salesforce user that Saleshandy is connected as. Salesforce owners: Chintan Sapovadiya owns 580 Contacts (the API login and QA's own view: 572 plus 8 made today), Rudra Chauhan owns 18. The 18 new prospects match Rudra's 18 Contacts, so the connected user of importprospects is most likely Rudra Chauhan (not checked on the Salesforce side). My expected number (517) came from the API user's view, so the test would have failed wrongly. The test was stopped before its 15 minute limit.
Open for QA: for a true bulk import use "All Contacts" (598 Contacts, the same for every user), or connect Salesforce as the user that owns the 580. Spec Row 15 still expects 517 and fails until this is chosen.
Billing page of importprospects: Active Prospects 0 of 400000, so no prospect limit stopped the import.

QA 2026-11-13: Row 15 verified by hand (Add Prospect with "My Contacts", all prospects deleted first): works. Recorded as Pass in the cases file, spec test is skipped with the reason. Helpers only Row 15 used were removed.

## STAGING APPROVED 2026-11-13 (QA)

21 rows: 18 passed (row 15 verified by hand by QA), row 21 shows the product bug AL-4228, rows 19 and 20 skipped on purpose. Post release bugs: AL-4228 (removed chip comes back) and AL-4229 (import update adds no Profile field updated entry to Activities, priority Low). Tracking ticket AL-4227. Not committed. No production smoke yet. Sheet row 14 note not written.

Committed 2026-11-13: 123f891 on branch rudra-saleshandy (not pushed). The old 34 row draft `import-prospects-cases-draft.md` is left untracked, it is replaced by the 21 row cases file.

## Production smoke 2026-11-13 (QA): RELEASED and LIVE

Manual verification completed by QA. Production approved and live. Google Sheet updated. Verification comment posted on the ticket. No smoke cases file, spec or script is needed.
