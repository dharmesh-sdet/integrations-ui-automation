# Zoho Email Opened: progress

Date: 2026-10-30. Mode: regression (staging). Platform rule: hand-written spec (QA 2026-10-29).

## QA answers (2026-10-30)

- Account: `notemailsentzoho` (all Zoho workflows except Email Sent). Zoho profile `auth/mcp-zoho-not-email-sent-profile`.
- Open method: Mailinator inbox, images loaded. Wait 10 s and refresh the Opened count, then 15 s, then look in Zoho. No Logs for Zoho.
- Scope: all 5 actions plus combined and trigger rows.
- Duplicate Task or Deal on a new contact: Expected says one record. A repeat shows Fail. No Jira draft until QA decides.

## State

- Stage 1 (context) done: `00-overview.md`, `email-opened.md`, `field-mapping.md`.
- Stage 2 (test cases) DONE 2026-10-30: 25 rows approved ("looks good") and saved to `test-cases/zoho/email-opened.md`.
- Stage 3 (spec): next. Not started. No page objects, flow, CSV or spec for Email Opened yet.

## Unconfirmed

- Trigger 4 and Combined 2 (second open, Open Count 2, deal link on the second event).
- Note title and note text for this trigger. The first run reads them from Zoho and updates the cases file.

## Next

1. Create sequence "Zoho Email Opened QA" on `notemailsentzoho`: 2 steps, one own mailbox, Track email opens on, Track link clicks off.
2. Check `src/pages/mailinator.page.ts` for an open helper. Another session changed that file and did not commit it. Read it before you add anything.
3. Hand-write `tests/zoho/email-opened.spec.ts`, `test-data/zoho/email-opened.csv`, data script and `npm run` scripts. Reuse `src/pages/zoho/zoho-crm.page.ts` and `src/flows/saleshandy-to-zoho.ts`. The Reply Received session owns those shared files. Send changes to it, do not edit them.
4. Run once to learn errors, then rerun only failed or unrun rows with `KEEP_TEST_DATA=1`. QA runs the full script.

## Findings (exploration 2026-10-31)

- The account `notemailsentzoho` had no custom tracking domain, so "Track email opens" showed "Custom Domain Required". QA allowed the setup. The domain `cd1.shengage02.com` is now saved as Default with all 11 email accounts. "Track email opens" turns ON after that.
- Real subject of the step 1 email is "Kartik 21". The script reads it from the Mailinator inbox, because the subject "Zoho Reply Received QA - Step 1" does not exist.
- Trigger and setup 4 (run E1, Henrik Solberg): first open gave Opened count 1 and one note "Open Count: 1". Second open gave Opened count 2 and a second note "Open Count: 2". One contact.
- Combined 2 (run E2, Marit Eikeland): first open created 1 contact and 1 deal (Rs. 5,500.00, Qualification), with the contact and company name shown. After the second open this prospect still had 1 deal. A deal of another prospect (Faisal Tarhuni) appeared at the same time from a parallel run.
- Check by name, not by deal count of the module. Prospect names must be new on the account, because the Emails tab lookup matches by name.

## Run status (2026-11-02)

- Sequence "Zoho Email Opened QA" id 197565 on `notemailsentzoho`: 2 steps (each with one link), Track email opens on, Track link clicks off, sender `dharmesh+replyreceived@saleshandy.com` (QA's own mailbox, no other sequence on it), active.
- Data `test-data/zoho/email-opened.csv` made (24 rows) after 19 countries were added to the name pool.
- Profile copy `auth/zoho-email-opened-profile` made from `auth/mcp-zoho-not-email-sent-profile`.
- First run started with `ZOHO_EO_SEQUENCE_ID=197565 npm run test:zoho-email-opened` (log in the session scratchpad). Trigger 5 skipped.

Run 1 (2026-11-02, 1.3 h): 11 pass, 13 fail, 1 skipped (Trigger 5 on purpose).
Script fix: Contact 2, Lead 3 and Deal 1 read the next label ("Mobile", "Lead Name", "Modified By") for an empty field. The spec now uses a local `emptyField` helper. `ZohoCrmPage.field` is unchanged (another session owns it).
Rerun (5 rows, fresh data via KEEP_TEST_DATA=1 REFRESH_OTHER_USED=1): Trigger and setup 1 and 3, Lead 3 and Deal 1 pass. Contact 2 fails with "No Zoho contact" (no record).
Now: 15 pass, 9 fail, 1 skipped.
Open, all "no Zoho record" or "record not updated", cause not found, failed on all 3 attempts: Contact 2, Contact 4 (contact not updated), Lead 1, Account 1, Deal 2 (amount stays Rs. 200.00, expected 5,500), Deal 3, Task 1, Combined 1, Combined 2 (no deal).
Passing rows are mostly the ones where the record already exists. Same symptom as Reply Received Contact 3, Deal 1, Lead 1.

Rerun (2026-11-02, after the Zoho page-load retry in the spec): the 9 open rows were rerun. 8 pass: Contact 2, Contact 4, Lead 1, Account 1, Deal 2, Deal 3, Task 1, Combined 2. Now: 23 pass, 1 fail, 1 skipped (Trigger 5, on purpose).
Cause of the Contact 2 fail: Zoho page load timed out (`net::ERR_TIMED_OUT`), not a missing record. The spec now retries a Zoho page load up to 4 times (local to `tests/zoho/email-opened.spec.ts`, `ZohoCrmPage.open` is shared and unchanged). The other 6 rows passed with no change; why they failed in run 1 is not known.
Open: Combined 1 (order Contact, Lead, Account, Deal, Task): the contact, lead and deal are made, no task. Same as Email Sent Combined 1 (2026-11-02 probe): the Task action does not save with five actions chosen. QA decides bug or known. No Jira draft yet.

2026-11-02: QA removed Trigger and setup 5 (Only Reply Received on). It tests the Reply Received trigger, not this workflow. Removed from `test-cases/zoho/email-opened.md`, `tests/zoho/email-opened.spec.ts`, `scripts/make-zoho-email-opened-data.ts` and the CSV. Now 24 rows: 23 pass, 1 fail (Combined 1). `ZOHO_EO_WITH_REPLY` is no longer used.

Combined 1 resolved (2026-11-02): not a product bug. The shared `configure` picks the next action before the "Configuration Updated" message ends, and the Task chip is lost (found by the Email Sent session, local-project-06). Combined 1 now uses `configureWaiting` from `src/flows/zoho-email-sent.ts` (uncommitted, owned by that session). Rerun: pass. Now 24 pass, 0 fail.
Open: the shared `configure` in `src/flows/saleshandy-to-zoho.ts` still has the race for any row that saves a Deal or Task dialog and then picks another action. Owner not known (notes say the Reply Received session). QA decides who edits it. Superseded: the earlier line "Combined 1 ... QA decides bug or known" is closed.

## Production smoke (2026-11-02)

QA "looks good": cases saved in `notes/production-testing/16-zoho-email-opened.md` (7 checks, 7 sends), README row 16 added. No fixed bug on AL-4193 in Jira, so it is a baseline. Account `emailopenedprod`, Zoho org crm.zoho.com, Zoho read on `auth/zoho-email-opened-smoke-profile` (the run script copies it from `auth/mcp-zoho-not-email-sent-profile`).
Written, typechecked, not run on production: `tests/zoho/email-opened-smoke.spec.ts`, `tests/setup/zoho-prod-gate.spec.ts`, `tests/setup/zoho-email-opened-smoke-sequence.spec.ts`, `scripts/make-zoho-email-opened-smoke-data.ts`, `scripts/run-zoho-email-opened-smoke.sh`, `npm run smoke:zoho-email-opened`.
QA to do: log in headed (`npm run login:saleshandy -- emailopenedprod`), confirm the Email Sent and Link Clicked triggers are off on the production Zoho integration, confirm the senders on the Email Accounts page (the setup spec uses the two read on 2026-10-22), then run the command. QA runs it, Claude does not.

## Production smoke run (2026-11-02, evening)

Result: 7 of 7 passed on production, over two runs. Account `emailopenedprod`, sequence 988717 "Zoho Email Sent Smoke 2026-11-02" (reused from the Email Sent smoke), sender `rudra+pipedrive@saleshandy.com`, tracking ticket AL-4193 (status To Do, no bugs on it).
- Started from the worktree `.claude/worktrees/zoho-email-sent-smoke` with `SMOKE_SEQUENCE_ID=988717 SMOKE_STEP1_SUBJECT='Quick question about your outreach' bash scripts/run-zoho-email-opened-smoke.sh`. The worktree `package.json` has no `smoke:zoho-email-opened` entry (it is on `rudra-saleshandy`), so the script is called directly.
- Run 1: checks 1 to 5 and 7 passed, check 6 (Deal) failed in the send step. Prospect Fadi Haddad: after Send now (clicked 19:32:09 IST) the Emails tab row still showed "Scheduled, Tomorrow, 09:04 AM" after 60 s, so the test stopped before the open. Cause not found. QA could see the email afterwards. QA also opened it by hand later, which with the Task trigger left on makes a task and a contact for Fadi in Zoho, not a deal. Not read in Zoho.
- Run 2: check 6 alone, new prospect Sandrine Ndayishimiye (new data written with `make-zoho-email-opened-smoke-data.ts --force`, which overwrote Fadi's row). Passed in 4.3 min. The delay did not repeat.
- Deviation from note 16: sequence 988717 has Track email opens ON and Track link clicks ON (QA turned both on by hand so this smoke could run on the Email Sent sequence). Note 16 says link clicks off. The checks passed anyway.
- The 5 prospects on 988717 from another Claude session were left as they are (QA).
- Needs the Zoho profile link in the worktree: `auth/mcp-zoho-not-email-sent-profile` is a symlink to the main checkout (added 2026-11-02, untracked).
- Jira: no Email Sent or Email Opened bug is needed for this run. Summary comment drafted for AL-4193 (`jira/drafts/al-4193-zoho-email-opened-production-smoke-summary.json`), QA sends.
- Not committed: this note. Sheet row for Zoho Email Opened not written.

## Wrap-up (2026-11-02, night)

- Production smokes done: Email Sent 8 of 8, Email Opened 7 of 7. Sheet "Integration wfs" rows 22 and 24 written (Released, 2 Nov 2026). Row 24 "Released" was written without QA confirming Email Opened is live; QA to confirm.
- Jira drafts written, QA sends with `npm run jira`: AL-4191, AL-4193, AL-4198, AL-4218. Nothing posted from chat.
- New rule (QA, 2 Nov): every next production smoke includes a check that updates the newest deal of a contact with 2 deals. Plan the row with QA first. Not added to the Zoho Email Sent or Email Opened smokes yet.
- Update coverage in the smokes: Contact only (Email Sent check 3, Email Opened checks 2 and 3). Lead, Account, Deal and Task updates are staging-only.
- Open: cause of Fadi Haddad "Scheduled" delay unknown. QA's manual open of his email was not read in Zoho. Sequence 988717 has 5 prospects that stay as they are.
- Uncommitted: this note, worktree changes (profile name in the Email Sent script, untracked Email Opened smoke files).
- Next: continue the other Zoho workflows (Reply Received, Link Clicked, Prospect Unsubscribed, Email Bounced). Read context/zoho/PROGRESS.md first.
