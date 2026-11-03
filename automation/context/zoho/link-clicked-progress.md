# Zoho Link Clicked: progress

Date: 2026-10-30. Mode: regression (staging). Platform rule: hand-written spec (QA 2026-10-29).

## QA answers (2026-10-30)

- Account: `notemailsentzoho`, shared with the other Zoho workflows except Email Sent. Workflows run in parallel, each with its own sequence, mailbox and prospects. Zoho profile `auth/mcp-zoho-not-email-sent-profile`.
- Click method: Mailinator inbox, click the first link. Wait 10 s and refresh the Clicked count, then 15 s, then look in Zoho. No Logs for Zoho.
- Scope: all 5 actions plus combined and trigger rows.
- Cuts (QA OK): 29 rows became 23. Removed: Reply-only trigger row, step 2 click row, Track link clicks off row, open-without-click row, Contact no-Phone row, Combined 2.
- Scanner clicks (Z-10): extra runs are noted, not failed.
- Z-6 does not apply (Link Clicked adds no tag). Duplicate Task or Deal on a new contact: Expected says one record, a repeat shows Fail, no Jira draft until QA decides.

## State

- Stage 1 (context) done: `00-overview.md`, `link-clicked.md`, `field-mapping.md`.
- Stage 2 (test cases): 23 rows written to `test-cases/zoho/link-clicked.md`. QA "looks good" received 2026-10-30.
- Stage 3 (spec) written 2026-10-30, not run, not committed: `tests/zoho/link-clicked.spec.ts` (23 tests), `src/flows/zoho-link-clicked.ts`, `scripts/make-zoho-link-clicked-data.ts`, `test-data/zoho/link-clicked.csv` (22 rows), `tests/setup/zoho-link-clicked-sequence.spec.ts`. npm: `data:zoho-link-clicked`, `setup:zoho-link-clicked-sequence`, `test:zoho-link-clicked`.
- Shared files changed (3 `private` to `protected` in `salesforce-integration.page.ts`, `turnOff` in `zoho-integration.page.ts`, `setSafetySetting` in `sequence-builder.page.ts`). The Reply Received session owns `saleshandy-to-zoho.ts` and `zoho-crm.page.ts`: not touched.
- Sequence "Zoho Link Clicked QA" not created: waiting for a sender mailbox.

## Unconfirmed

- Note title and text for this trigger (first run reads Zoho).
- Whether Track email opens OFF stops a click from firing Email Opened.
- Trigger 4 (second link, Click Count 2).

## Parallel-run notes

- Own Zoho profile copy `auth/zoho-link-clicked-profile` (a profile cannot be open twice). Checked 2026-10-30: it opens `crm.zoho.com/crm/org941113438` with no relogin page. Email Opened and Email Bounced need their own copies, made the same way (leave out `Singleton*` and caches).
- The spec sets `KEEP_OTHER_TRIGGERS=1`, so `enableOnly` leaves the sibling triggers alone. Trigger OFF uses `turnOff`.
- Risk, not fixed: Save on Triggers & Activity may write the state of every trigger. Two sessions saving at the same moment could overwrite each other. If a sibling's trigger changes by itself, rerun that row.
- Combined 2 runs only with `ZOHO_LC_WITH_OPENED=1`, because it saves actions on "Sequence Email is Opened". Run it when no Email Opened session is active.
- Sends: about 22 for the full run. Today's log had 2 of 80 on 2026-10-30.

## Next

1. Done: QA "looks good" 2026-10-30.
2. (QA picks the mailbox first.) Create sequence "Zoho Link Clicked QA" on `notemailsentzoho`: 2 steps, 2 links per email, own mailbox, Track link clicks on, Track email opens off.
3. Check `src/pages/mailinator.page.ts` for a click helper (another session changed it, uncommitted). Read it before adding anything.
4. Hand-write `tests/zoho/link-clicked.spec.ts`, `test-data/zoho/link-clicked.csv`, data script and `npm run` scripts. Reuse `src/pages/zoho/zoho-crm.page.ts` and `src/flows/saleshandy-to-zoho.ts`. The Reply Received session owns those shared files. Send changes to it.
5. Run once to learn errors, then rerun only failed or unrun rows with `KEEP_TEST_DATA=1`. QA runs the full script.

## Run 2026-11-03 (staging, sequence 197479, account notemailsentzoho)

- Result: 23 of 23 passed over 5 runs. Run 1: 15 pass, 7 fail, 1 skip. Reruns with a new prospect each: Lead 3, Account 3, Account 4, Deal 1, Deal 3, Combined 1 passed; Task 3 passed after the AL-4198 rework; Combined 2 passed with `ZOHO_LC_WITH_OPENED=1` (3.5 min).
- Causes found and fixed in `tests/zoho/link-clicked.spec.ts`: Zoho page-load timeout (retry of 4 loads, local to the spec); an empty Zoho field read as the next label (Lead 3 Company, Deal 1 Contact Name, `emptyField`); Combined 1 lost the Task chip (now `configureWaiting`); Task 3 waited 10 min on a disabled Save (now checks Save is disabled, AL-4198 fixed). `OPENED_TRIGGER` text is now "Email is Opened in Saleshandy". The Combined 2 cleanup now waits for the save toast.
- A rerun of a row needs a new prospect: the same prospect fails in "Create & Add Prospect" (the Done button never shows). Make new data with `ZOHO_LC_SOURCE=zoho/email-sent.csv node scripts/make-zoho-link-clicked-data.ts --force` (the Reply Received CSV was missing for a while on 2026-11-03 and exists again, so the default source works; the script only copies column templates from the source).
- Not explained: the Clicked count did not rise within 90 s once on Deal 3 and once on Task 3 (both passed on a new prospect).
- Staging page loads timed out several times on 2026-11-03 (curl to pyxis timed out for a few minutes). Combined 2 run 1 hit the 10 min limit and left the Email Opened trigger and Track email opens on. Both were turned off by hand and checked.
- Developer note (Email Bounced session, 2026-11-03): with Create Account and Create Deal and no Account Name mapped, staging gives 2 accounts named after the company (Z-5), the deal sits on the blank one, the contact links to the mapped one. Combined 1 Expected ("Accounts as Z-5 allows") still holds. QA: all 5 actions is not realistic. QA decision 2026-11-03: Combined 1 stays as it is (all 5 actions). What to expect and not expect is in `00-overview.md`, section "Combined 1: all five actions on one trigger".
- Sequence state now: Track email opens off, Track link clicks on, Email Opened trigger off. Not committed: spec, flow, data script, case file.

## Staging approved (QA, 2026-11-03)

QA approved Link Clicked on staging. Result 23 of 23 rows. Combined 1 stays as it is. Other live sessions were told by message on 2026-11-03. Next: commit the fixes. Production smoke starts only when QA asks.
