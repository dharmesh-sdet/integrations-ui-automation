# Zoho Email Bounced: progress

Date: 2026-10-30. Mode: regression (staging). Platform rule: hand-written spec (QA 2026-10-29).

## QA answers (2026-10-30)

- Account: `notemailsentzoho` (all Zoho workflows except Email Sent), run in parallel with the other workflows, each with its own sequence and prospects (QA 2026-10-30). Zoho profile `auth/mcp-zoho-not-email-sent-profile`.
- Bounce method: Emails tab > Actions > Mark as bounced for every row, plus one real-bounce row (`name@<company>.mailinator.com`).
- Scope: all 5 actions plus combined and trigger rows.
- Tag: Expected says Bounced-Saleshandy, marked (proposed, unconfirmed). The first run reads the real tag in Zoho and updates the cases file.
- Z-6: one row states the known result (VIP tag replaced). Duplicate Task or Deal on a new contact: Expected says one record. A repeat shows Fail. No Jira draft until QA decides.
- Defaults accepted: Lead-only rows say nothing about the tag until the first run reads it. Cuts applied 2026-10-30 (QA OK): removed paused-sequence and Reply-only trigger rows, Contact no-Phone and Combined 2.
- Zoho: no Logs tab, check the Zoho record only. Wait 15 s after the bounce.

## State

- Stage 1 (context) done: `00-overview.md`, `email-bounced.md`, `field-mapping.md`.
- Stage 2 (test cases) DONE 2026-10-30: 23 rows approved and saved (27 before the cuts of 2026-10-30) to `test-cases/zoho/email-bounced.md`.
- Stage 3 (spec): next. Not started. No sequence, CSV, data script or spec for Email Bounced yet.

## Unconfirmed

- Tag name (Bounced-Saleshandy or Unsubscribed-Saleshandy).
- Whether a Lead-only bounce adds a tag or creates a contact.
- Trigger 4 (real bounce).

## Next

1. Create sequence "Zoho Email Bounced QA" on `notemailsentzoho`: 2 steps, one own mailbox no other Zoho sequence uses.
2. Look for a "Mark as bounced" helper in `src/pages/saleshandy/` and the Pipedrive Email Bounced spec. Reuse them.
3. Hand-write `tests/zoho/email-bounced.spec.ts`, `test-data/zoho/email-bounced.csv`, data script and `npm run` scripts. Reuse `src/pages/zoho/zoho-crm.page.ts` and `src/flows/saleshandy-to-zoho.ts`. The Reply Received session owns those shared files. Send changes to it, do not edit them.
4. Run once to learn errors, then rerun only failed or unrun rows with `KEEP_TEST_DATA=1`. QA runs the full script.

## Findings (exploration 2026-10-31)

- Trigger and setup 3 and Contact 1 (runs B1 and B2, fresh prospects): marking the step 1 email as bounced created one Zoho contact each, with one note.
- Trigger and setup 4 (real bounce, Ingrid Haugland): the Emails tab showed Bounced 26 seconds after the send. Zoho got one contact (name, email, phone, title Procurement Lead, department Operations, Twitter, mailing address Rotterdam Netherlands) and one note "Saleshandy Email is Bounced" with Sequence Name, Sequence link, Step 1 and the sender.
- The tag Bounced-Saleshandy did not show in the record text of any of the three contacts. This is open for QA.
- A prospect with the same name as an earlier one makes the Emails tab lookup match two rows (strict mode). Use a new name for each run.

## Update 2026-11-02

- The spec, flow and data script already exist (committed ac16c24). The Stage 3 line above is old.
- Sequence "Zoho Email Bounced QA" is id 197567 on `notemailsentzoho`: 2 steps, no sender, not active. Made by `tests/setup/zoho-email-bounced-sequence.spec.ts` (not committed).
- Open: QA picks the sender mailbox (the only `dharmesh` mailbox listed, dharmesh+replyreceived@saleshandy.com, already has 2 active sequences). Then: `ZOHO_EB_SENDER=<mailbox>` setup run, copy the Zoho profile to `auth/zoho-email-bounced-profile`, `npm run data:zoho-email-bounced`, first run with `ZOHO_EB_SEQUENCE_ID=197567`.

## First run 2026-11-02 (13 pass, 10 fail, 56 min, sequence 197567, sender 6kartiktest+10@gmail.com)

Failed rows and the error text only. Causes are not proven; none is rerun yet.
- Trigger and setup 1: the Emails tab did not show Bounced within 60 s.
- Trigger and setup 2: Task Subject read "Follow up after open", expected "Follow up after bounce".
- Trigger and setup 3 and 4: `page.goto` to Zoho Contacts, net::ERR_TIMED_OUT (failed in 160 ms).
- Lead 2: Company read "Old Company 980173", expected "Outreach 980173".
- Lead 3: Company read "Lead Name", expected empty.
- Deal 1: a field read "Modified By", expected empty.
- Task 3: browser closed during a click (8 min).
- Combined 1: Notes on the contact 2, expected 5.
- Contact 4: error text not read yet.
Passed: Contact 1, 2, 3, Lead 1, Account 1 to 4, Deal 2, 3, 4, Task 1, 2.

## Resume here (2026-11-03)

State: 23 tests written and committed (ac16c24). Sequence "Zoho Email Bounced QA" id 197567, sender 6kartiktest+10@gmail.com, active. Profile copy `auth/zoho-email-bounced-profile` made. Data file `test-data/zoho/email-bounced.csv` made (22 rows). First run done: 13 pass, 10 fail (list above). Not committed: `tests/setup/zoho-email-bounced-sequence.spec.ts`, the 24 new countries in `src/data/countries.ts`.

Next:
1. Rerun Trigger and setup 3 and 4 first (Zoho `ERR_TIMED_OUT`, 4 is the one real bounce): `ZOHO_EB_SEQUENCE_ID=197567 KEEP_TEST_DATA=1 npm run test:zoho-email-bounced -- -g "Trigger and setup: (3|4)"`.
2. Read the trace of each other failed row before any change. Lead 3 and Deal 1 read a wrong word from the page, so check `ZohoCrmPage.field` first. Trigger and setup 2 may be the Email Opened session changing the Task Subject on the shared account.
3. Then rerun only the failed rows. QA runs the full script.

Rules for tomorrow: every `playwright test` run needs `KEEP_TEST_DATA=1` (setup specs too). Setup specs cannot use the shared `addEmailStepWithLinks` (`window.tinymce.editors` is undefined on staging), so they use the local `addStep` helper.

## Update 2026-11-03 (QA decisions and reruns)

- QA 2026-11-03: Contact 4 (tag VIP) removed with every tag line. The tag comes only from developer logs and public docs. QA could not find it in the Zoho CRM. Cases now 22 rows. Z-6 is not tested.
- QA 2026-11-03: Task 3 follows AL-4198 (Save disabled for an empty Subject). Case row and test changed. Same pattern as the Link Clicked spec.
- Trigger and setup 2 fix: the chip lookup is scoped to the Email is Bounced trigger. Before, it took the first Task chip on the page ("Follow up after open").
- Cause of the "Done" button not found (Lead 2, 3, Deal 1, Trigger and setup 1, Combined 1): the prospect already existed (create returned 400 "Prospect with this email already exists in your Saleshandy account"). A rerun with `KEEP_TEST_DATA=1` keeps the CSV, so it reuses the same emails. Make a new CSV before a rerun.
- `test-data/zoho/reply-received.csv` was missing (source of every Zoho data script, cause not found). The CSV was rebuilt with `make-zoho-email-bounced-data.ts` run on a temporary copy that reads `email-opened.csv`. The temporary copy is deleted.
- Rerun results: pass Lead 2, 3, Deal 1, Trigger and setup 1, 2, 3, 4, Task 3. Open: Combined 1.
- Combined 1 expected result (QA, developer note 2026-11-03): 1 contact, 1 lead, 1 deal, 1 task and 2 accounts (Account Name not mapped, prospect has a company). The note count is under review (the product gave 2). The test saves the contact's Notes section in the report. The note was sent to the LinkClicked session.

## Update 2026-11-03 (Combined 1 rerun)

- Made a new CSV (`node scripts/make-zoho-email-bounced-data.ts --force`, 21 rows) and ran `ZOHO_EB_SEQUENCE_ID=197567 KEEP_TEST_DATA=1 npm run test:zoho-email-bounced -- -g "Combined: 1"`. Combined 1 passed (2.8m). The contact Notes count stays in the report for QA to review.

## STAGING APPROVED (QA 2026-11-03)

QA approved staging for Zoho Email Bounced. 22 rows, each passed at least once (13 in the first run, 9 on reruns after fixes, Combined 1 last). No single full run with all 22 passing together. Fixes in the spec and test cases are not committed. Production smoke not started.

## Production smoke (QA 2026-11-03)

QA: Email Bounced is deployed on production, workflow ticket AL-4195, defaults accepted. Note `notes/production-testing/18-zoho-email-bounced.md` (8 rows, 1 send) saved and added to the README table. Written, typechecked, not run: `tests/zoho/email-bounced-smoke.spec.ts`, `tests/setup/zoho-email-bounced-smoke-sequence.spec.ts`, `scripts/make-zoho-email-bounced-smoke-data.ts`, `scripts/run-zoho-email-bounced-smoke.sh`, `npm run smoke:zoho-email-bounced`. Data `test-data/zoho/email-bounced-smoke.csv` made (8 rows). QA runs the smoke (login first: `npm run login:saleshandy -- emailopenedprod`). Not committed. Do not run it at the same time as another smoke run on `emailopenedprod`.

## Production smoke result (2026-11-03)

8 of 8 passed in one run (18.6 min) on sequence 989765 "Zoho Email Bounced Smoke 2026-11-03", account `emailopenedprod`. Log: scratchpad `zoho-email-bounced-smoke-3.log`. Earlier attempts: sequence 988717 was the Email Sent smoke sequence (4 test prospects were added to it by mistake); a setup run failed because `rudra+emailsentprod@saleshandy.com` was no longer listed. Fixes: first-load retry of the Zoho profile in the spec; the setup spec now takes a sender from the accounts the Add dialog lists. Not committed. AL-4195 summary comment sent (2026-11-03). Sheet row 27 written: Released, 3 Nov 2026.
