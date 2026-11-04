# Salesforce Sequence Email is Opened: progress

## Resume here (2026-11-04)

- Mode: regression, staging. Ticket AL-4135 (parent AL-4131).
- Cases: 31 rows, approved by QA 2026-11-04, saved in `test-cases/salesforce/email-opened.md`. The no-slop pass on the file is not done yet.
- Account (2026-11-04): `sfemailopened` wired in `src/config/accounts.ts`. It is the former Zoho account (dharmesh+noemailsent@saleshandy.com), Salesforce connected by QA. Sessions copied from notemailsentzoho and sfreplyreceived. Field mapping set and read back after reload: Lead, Contact, Opportunity, Account (5 of 5 passed, `tests/setup/salesforce-field-mapping.spec.ts`). Old blocker text follows, no longer true: account `sfemailopened` does not exist. Not in `src/config/accounts.ts`, `.mcp.json` or `auth/`. QA creates the Saleshandy account (Salesforce connected, OTP off, both sessions saved) and gives the login email.
- Settings QA chose: tracking domain `cd1.shengage02.com`, Track email opens on, Track link clicks off.
- Sequence (2026-11-04): "Salesforce Email Opened Regression", id 197671, 2 steps (subjects in `src/flows/salesforce-email-opened.ts`), Track email opens on, Track link clicks off, sender dharmesh+replyreceived@saleshandy.com (the only mailbox the Add dialog listed, 76 of 150 sent that day, shared with Zoho Reply Received), activated. Built by `tests/setup/salesforce-email-opened-sequence.spec.ts`. Sender interval and limits not checked yet.
- Script fix (2026-11-04): staging runs TinyMCE 6.8.6, which has no `tinymce.editors`. `sequence-builder.page.ts` now falls back to `tinymce.get()`. Any spec that builds steps was affected, not only this one.
- Peer (Reply Received session): runs beside this one with `npm run parallel -- salesforce/reply-received salesforce/email-opened`. Shared org and send cap. Keep prospect names and emails different, SEND_CAP about 80, tell that session before a run.
- Next (updated 2026-11-04): spec and CSV are written. The Reply Received session runs the parallel run. See "Handoff 2026-11-04" at the end of this file.
- Product failures found: none yet.

## Spec written, first run (2026-11-04)

- Written and typechecked: `tests/salesforce/email-opened.spec.ts` (31 tests), `test-data/salesforce/email-opened.csv` (28 prospects), `src/flows/salesforce-email-opened.ts`, `zeroClosingDateState` in `salesforce-email-sent.page.ts`. Baseline row 5 in the cases file now says "with Update a Lead selected" (Email Sent with Create a Lead makes a Lead on the send).
- Run 1 (Trigger behavior 1 and 2): row 1 passed. Row 2: the open worked (Opened count rose, Logs "Sequence Email is Opened in Saleshandy" Success, 3.8 s), then the Salesforce check failed because the copied Salesforce session expired and the API login failed: LOGIN_MUST_USE_SECURITY_TOKEN. The login needs the Tailscale exit node (trusted IP 44.229.234.59, see `src/utils/salesforce-login.ts`). This machine showed IP 110.226.126.183. Not a product failure.
- Blocked on QA: turn on the Tailscale exit node. Then rerun only row 2, then the rest with `SEND_CAP=80 KEEP_TEST_DATA=1`.
- Mailbox budget: The mailbox allows 150 a day. When checked, 76 were sent. The Reply Received session waits for this full run, then needs 40 or more sends left. When the full run ends, message it with the sent count.

## Run plan (QA 2026-11-04, agreed with the Reply Received session)

- QA wants both specs run in parallel, not one after the other. Command: `KEEP_TEST_DATA=1 npm run parallel -- salesforce/reply-received salesforce/email-opened` (KEEP_TEST_DATA=1 because "reply-received" also matches the HubSpot, Zoho and Pipedrive CSVs).
- Start nothing until QA says go. The Reply Received spec (40 tests, about 32 sends) is written and typechecked.
- Before the run: QA turns on the Tailscale exit node (trusted IP 44.229.234.59). Both sessions showed 110.226.126.183. The `sfemailopened` Salesforce session is a copy of `sfreplyreceived` and expired. One fresh Salesforce login can invalidate both.
- Mailbox: When checked, 76 of 150 were sent. Add about 31 and about 32, and the total is about 139. It fits once, not with reruns. Read the sent count again at the start and tell QA.
- Update 15:53: the IP blocker is gone. QA added 110.226.126.183 as a trusted IP in Salesforce Setup > Network Access. The Reply Received session saved a fresh Salesforce session to `auth/salesforce-sfreplyreceived-chromium.json` and a copy to `auth/salesforce-sfemailopened-chromium.json`. Still open: the mailbox decision and QA's go. Row 2 of Trigger behavior still needs a rerun inside the parallel run.

## Handoff 2026-11-04 (this session closed, Reply Received session owns the run)

- QA said go. The Reply Received session started: `KEEP_TEST_DATA=1 SEND_CAP=80 npm run parallel -- salesforce/reply-received salesforce/email-opened --yes`. Logs: `reports/<time>-sfreplyreceived.log` and `reports/<time>-sfemailopened.log`.
- Do not change `tests/salesforce/email-opened.spec.ts` or `test-data/salesforce/email-opened.csv` while it runs.
- Rules from QA: hand-written spec only (no planner, generator or healer). QA never wants a run started unasked. Runs happen only in parallel with Reply Received, after QA says go. Do not open report.html. Product failures go in this file, then draft Jira items into `jira/drafts` (QA sends).
- Sequence 197671, sender `dharmesh+replyreceived@saleshandy.com` only. Its interval and limits were never checked. QA added 3 to 4 mailboxes on `sfemailopened` (limits 150, 70, 43 to 54 s). They are not attached to the sequence. To attach: `SF_EO_SENDER=<address> SETUP_SEQUENCE=1 KEEP_TEST_DATA=1 REPORT_OPEN=never npx playwright test tests/setup/salesforce-email-opened-sequence.spec.ts --project=chromium --workers=1` (sends no email; `SF_EO_LIST_FILTER` lists mailboxes).
- Mailbox math: 76 of 150 sent earlier, my spec needs about 31, so about 107. A rerun of failed rows fits.
- Row "Trigger behavior > 2" failed earlier only because the Salesforce session expired (LOGIN_MUST_USE_SECURITY_TOKEN). The IP is now trusted, so it must pass inside the run.
- After the run, for script failures: fix, then rerun only failed or unrun rows with `KEEP_TEST_DATA=1`. Rows marked proposed in the cases file are recorded as annotations, not failures.
- Still to do: no-ai-slop QA Test Case Mode pass on `test-cases/salesforce/email-opened.md`; check custom tracking domain `cd1.shengage02.com` on `sfemailopened` (read only); optional `playwright-sfemailopened` entry in `.mcp.json`.
- Shared edits made this session: `sequence-builder.page.ts` (TinyMCE `tinymce.get()` fallback), `salesforce-email-sent.page.ts` (`zeroClosingDateState`), `accounts.ts` (`sfemailopened`).

## 2026-11-04 17:05: the Reply Received session took over this lane
- Run `20261104104843` (parallel). At 16:59: 19 of 31 done, 17 passed, 2 failed: Trigger behavior 2 and Create a Account 3. Trigger behavior 2 failed again after the IP was trusted (it ran at 16:20 with a fresh Salesforce session), so the expired-session cause from the handoff is not confirmed. Read its error after the run.
- Next: read both failures, fix script failures, rerun only failed or unrun rows with `KEEP_TEST_DATA=1`, record product failures here.
