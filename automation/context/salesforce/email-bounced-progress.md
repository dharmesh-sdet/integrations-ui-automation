# Salesforce Email is Bounced in Saleshandy: progress

## Resume here (2026-11-05, session closed by QA)

- Production smoke: script ready, 9 checks approved (note 25). `local-project-16` started the pair run with sequences 992146 (Email Bounced) and 992152 (Unsubscribed). The result was not known at close.
- Next: read `reports/salesforce-pair-<time>-*.log` and the Email Bounced report. Fix script failures only. Product failures go in this file and QA reviews them. A trigger missing after a reload is a clash with the other run, not a product bug.
- Then draft the AL-4138 summary from `jira/templates/comments/04-production-smoke-summary.md` into `jira/drafts`. QA sends it. Update README row 25, `00-overview.md` row 7 and the memory file `salesforce-email-bounced-smoke-ready.md`.
- Nothing from this trigger is committed (notes 25, spec, setup spec, data script, runner, package.json).

## Production smoke (2026-11-05)

- QA approved the 9 checks ("looks good"): `notes/production-testing/25-salesforce-email-bounced.md`, README row 25.
- QA answers: the real-bounce address is `name@<company>.mailinator.com`. Check 1 is the only send. The other checks use Mark as bounced. The run is alone on `emailopenedprod` with other triggers off.
- QA merged Create a Contact and Attach Note into check 3. QA merged Update a Lead and Record(log) with Lead ticked into check 2. Record(log) has no Account checkbox.
- Written and typechecked, NOT run: `tests/salesforce/email-bounced-smoke.spec.ts`, `tests/setup/salesforce-email-bounced-smoke-sequence.spec.ts`, `scripts/make-salesforce-email-bounced-smoke-data.ts`, `scripts/run-salesforce-email-bounced-smoke.sh`, npm script `smoke:salesforce-email-bounced`. Data `test-data/salesforce/email-bounced-smoke.csv` (gitignored, 8 rows, built once).
- Peer `local-project-16` (2026-11-05, relayed from QA): no new sequence. QA gives one existing sequence URL for Email is Bounced. Run with `SMOKE_SEQUENCE_ID=<id from the URL>`. The pair script `smoke:salesforce-bounced-unsubscribed-pair` (owned by local-project-16) runs this smoke and Unsubscribed in parallel with `KEEP_OTHER_TRIGGERS=1`. Do not start before QA gives the URL.
- The pair script waits 90 s (STAGGER_SECONDS) after the gate before it starts Unsubscribed. It needs BOUNCED_SEQUENCE_ID and UNSUB_SEQUENCE_ID. A stagger does not remove the overwrite risk. If a trigger is missing after a reload in a check, treat it as a clash with the other run, not a product bug.
- QA gave the sequences (via local-project-16, 2026-11-05): Email is Bounced 992146, Prospect is Unsubscribed 992152. The pair script `smoke:salesforce-bounced-unsubscribed-pair` was started by local-project-16 with BOUNCED_SEQUENCE_ID=992146 UNSUB_SEQUENCE_ID=992152. Logs: `reports/salesforce-pair-<time>-*.log`. This session starts no run and changes no trigger on `emailopenedprod` while it runs. Memory notes say 992146 was the Reply Received smoke sequence and 992152 the Link Clicked one, so older prospects are on them.
- QA runs `npm run smoke:salesforce-email-bounced` (gate, day's sequence, 9 checks). Needs both login sessions for `emailopenedprod` (`npm run login:saleshandy -- emailopenedprod`, `npm run login:salesforce -- emailopenedprod`).
- Jira draft (`jira/templates/comments/04-production-smoke-summary.md` to `jira/drafts`) only after the run. Not committed.

## Resume here (2026-11-05)

- STAGING TESTING COMPLETE (QA 2026-11-05): 34 of 34 passed at least once over run 1 and four reruns. Not production approved: no production smoke exists yet. Not committed. Next: production smoke cases (fixed tickets only), QA "looks good", then the smoke script.

- Mode: regression, staging. Ticket AL-4138 (parent AL-4131). Session `local-project-e2`.
- Account: `sfemailopened` (dharmesh+noemailsent). QA 2026-11-05: reuse it. Salesforce connected, sessions saved. Other triggers are turned off by the spec itself.
- Cases: 34 rows, approved by QA 2026-11-05 ("looks good"), saved in `test-cases/salesforce/email-bounced.md`. Modeled on Link Clicked and Email Opened. One simple-english lint hit stays in the cases file: the quoted Salesforce Lead Status text, kept verbatim.
- Written and typechecked: `src/flows/salesforce-email-bounced.ts`, `tests/salesforce/email-bounced.spec.ts` (34 tests), `tests/setup/salesforce-email-bounced-sequence.spec.ts`, `scripts/make-salesforce-email-bounced-data.ts`, `test-data/salesforce/email-bounced.csv` (31 prospects, gitignored), npm scripts `data:`, `setup:` and `test:salesforce-email-bounced`. Small type change in `src/flows/salesforce-link-clicked.ts` (`LogPages`) so the Logs helpers are reused.
- Sequence "Salesforce Email Bounced Regression" = id 197776 on sfemailopened. Two steps, sender `6kartiktest+10@gmail.com` (listed in the Add dialog, 43/50), ACTIVE.
- Real bounce rows: Trigger behavior 6 and Combined 1. Address pattern `name@<company>.mailinator.com`, the one that bounced on HubSpot, Zoho and Pipedrive. QA picked "own address" on 2026-11-05 but gave no address, so the pattern is used. QA to confirm or give an address.
- Peer: `local-project-f3` works on Salesforce Prospect is Unsubscribed (own account `sfunsubscribed`, not created yet).
- Command (from automation/): `SF_EB_SEQUENCE_ID=197776 KEEP_TEST_DATA=1 REPORT_OPEN=never npx playwright test tests/salesforce/email-bounced.spec.ts --project=chromium --workers=1 --reporter=list`. ALWAYS KEEP_TEST_DATA=1.

## Run 1 (2026-11-05, full run, 1.0 h)

- Result: 28 passed, 6 failed. Failed: Trigger behavior 2 and 6, Create a Account 1 and 3, Create a Opportunity 3, Update a Opportunity 2.
- Trigger behavior 2: Logs entry of 2:35 PM was Error, `invalid_grant` "expired access/refresh token" on the Contact lookup (Salesforce token drop, environment). The script then failed on the Logs Refresh button. Passed on rerun.
- Create a Opportunity 3 and Update a Opportunity 2 (0 Days modal): Extra Configuration dialog did not open in 20 s. Same flake as Link Clicked run 1. Passed on rerun.
- Create a Account 1 and 3: after minus before was 0. "Priya Nair" and "Sean O'Brien" already had Accounts from Link Clicked, and Create a Account finds an Account by full name and creates nothing (same as Create a Account 2). Script data cause. The two prospects now have names no earlier run used (Rukmini Varadarajan, Grainne O'Dwyer). The cases file keeps the two example names, QA to know.
- Trigger behavior 6 (real bounce): Logs showed two Bounced entries for the one real bounce, one Success and one Error (`DUPLICATES_DETECTED` on Create a Lead, rule `Standard_Lead_Duplicate_Rule`). Seen in run 1 (2:43 PM) and again in rerun 1 (4:12 PM and 4:14 PM). Matches HubSpot (open question 11). QA default applied: the spec records every new entry and passes when one is Success. Rerun 3 with a new person passed.

## Reruns

- Rerun 1 (6 rows): Trigger behavior 2, Create a Account 1, both 0 Days rows passed. Trigger behavior 6 failed again (see above). Create a Account 3 failed: its Logs entry stayed RUNNING for more than 3 minutes after the Get account step (query ok, 0 records); the Account "Fionnuala O'Gorman" appeared later, so run 3 of the row found it and created nothing.
- Rerun 3 (2 rows): Trigger behavior 6 passed. Create a Account 3 failed for that reason.
- Rerun 4: Create a Account 3 with a new name passed (2.4 min).
- Result over all runs: 34 of 34 passed at least once, no single full run. No script failure is open.

## Product observations for QA

1. One real bounce can create two Bounced Logs entries, one of them Error with DUPLICATES_DETECTED on Create a Lead. Seen on 2 of 3 attempts of Trigger behavior 6. Not seen on Combined activities 1 (Create a Contact). QA decides bug or not (same as HubSpot).
2. A Create a Account run stayed RUNNING for more than 3 minutes once (Create a Account 3, first attempt) and created the Account late. Not repeated on the next attempt.
3. Salesforce token drop (`invalid_grant`) hit Trigger behavior 2 once. Environment, known.
- Not committed.

## Production smoke 2026-11-05 (pair run with Prospect is Unsubscribed, emailopenedprod, sequence 992146)
- Pair run 17:21: 10 passed, 1 failed (19.7 min). Failed: Check 9 (0 Days modals, AL-4168). Rerun alone failed the same way, then passed after a script fix. Result: 9 of 9 checks passed at least once, no single full run.
- Cause of Check 9: script. Check 8 leaves Update a Opportunity saved on the trigger, and picking an already selected activity opens no dialog. Fix: reset the trigger to Create a Lead first (same line the Prospect is Unsubscribed spec had). File `tests/salesforce/email-bounced-smoke.spec.ts`. I first called it a product issue, that was wrong.
- AL-4168 result: Update a Opportunity dialog with Closing date 0 Days shows a red field and Save disabled (QA screenshot 2026-11-05). Create dialog checked by the script, same.
- Run with KEEP_OTHER_TRIGGERS=1 beside the other run: no clash seen on Bounced checks 1 to 8.
- Not committed. Jira comment and sheet row not written (QA approval pending).
