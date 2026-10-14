# Resume: the 4 HubSpot workflows in progress (saved 2026-10-13, afternoon)

**Before picking a workflow: check what is live.** This file goes stale. Run
`ListAgents`, then `ps -eo pid,etime,args | grep "playwright test"`, and look
at the mtime of each `*-progress.md` and `reports/*/results.json`. Pick one
nobody owns; if another "resume" session may pick the same one, message it
first. Do this before asking QA anything.

Index only. Each workflow's own `*-progress.md` is the source; read its last
section first. Staging only. Everything is uncommitted (nothing committed since
03923bb). One Saleshandy account per workflow, so the four can run in parallel;
the HubSpot portal (247419080) is shared. Gmail senders stop at 50 a day.

Verification: the Email Bounced row was checked by the Email Bounced session on
2026-10-13. The other three were copied from their progress files (Email Opened
14:50, Link Clicked, Reply Received) and not re-run here. Each of the three saved a
final status section at about 15:00 IST on 2026-10-13; read it first.

| Workflow | Jira | Account | Spec | State | Open items | Read |
|---|---|---|---|---|---|---|
| Sequence Email is Opened | AL-4013 | `emailopened` | `email-opened.spec.ts` | 2026-10-14: all 64 in-scope scenarios pass (Phase 1 37, Phase 2 27), 18 skipped by design; see "Final status 2026-10-14" | Update a company 1 and 2: AL-4126, QA says fixed 2026-10-14, retest skipped for now (scripts kept, not run). Update a Deal failures (6 scenarios): cause found 2026-10-14 (Search deal looks for a deal named like the prospect email, finds 0, log still Success); QA says bug, filed as AL-4128 (2026-10-14, links AL-4013 and AL-3984), "Fail, AL-4128" marked in test-cases. Open: Update a deal with Extra Configuration empty (2 scenarios, no values recorded, QA decides; no probe, QA 2026-10-14: keep realistic deal names); KB proposal waiting for QA's OK; address TODO in accounts.ts | email-opened-progress.md "Session 2026-10-14" and "Log comparison" |
| Link Clicked (session stopped 16:00 IST, account free) | AL-4014 | `linkclick` (sequence 196221) | `link-clicked.spec.ts` | All rows run 2026-10-13. Passed: Task 1, 2; Note 1, 2, 4, 5, 6; Record 3, 4; Create a Contact 3, 4, 6; Update a Contact 3, 4; Update a deal 1 to 6; Create a company 1, 2, 4; Update a company 3, 4 | Bugs filed: AL-4120 (Click Count), AL-4121 (Note 3), AL-4122 (Record 5), AL-4123 (Record 6). Record 7: "Link is Clicked" log `6acdf7a2c9a5007e3fecb3be` is Error (HubSpot 400 on the log email node), QA bug-or-not pending. Update a company 1 and 2: City stays "--" (QA bug-or-not, same finding as other workflows) | link-clicked-progress.md "Final status, session stopped 2026-10-13 about 16:00 IST" |
| Reply Received | AL-4011 | `replyreceived` | `reply-received.spec.ts` | 46 scenario rows, 46 scripted tests, every row has passed on staging (2026-10-12 and 2026-10-13) | Full 46-test run in one go not done; `kb-update` and "Fail, AL-xxxx" marks in test-cases; Update a Contact 4 reading to confirm with QA. Log RUNNING 3 to 7.5 min is a performance note (QA), no action | reply-received-progress.md "Session status 2026-10-13" |
| Email is Bounced | AL-4016 | `emailbounced` (sequence 196432) | `email-bounced.spec.ts` | Phase 1 complete; Phase 2 run 2026-10-14: all rows pass; Record 6 is product-verified, not re-run (real bounces 3 of 3). Earlier: baseline 1 to 4, Create/Update a Contact, deals, companies 1 to 4, Update a company 3, 4, Notes 1, 2, 4, Record 1 to 4 pass | Update a company 1 and 2 fail (QA bug-or-not); Baseline 5 duplicate Success + Error log entries (ids in progress file) QA call; Create a Note 3, Create a Task modal rows, Phase 2 not scripted. Sender settings on this account are read only | email-bounced-progress.md "Saved 2026-10-13 (final status)" |

## Shared files (tell the owner before editing)

- `src/flows/saleshandy-to-hubspot.ts`, `src/flows/activity-rows.ts`,
  `src/pages/hubspot/companies.page.ts` (createCompany retry, `property()`),
  `src/data/global-setup.ts` (replaces every CSV row of the workflow being run),
  `tests/hubspot/link-clicked.spec.ts` (owned by Link Clicked).
- Changed 2026-10-13 by the Reply Received session: `activity-rows.ts` (serial
  mode removed, so a failed row no longer cancels the rest) and `global-setup.ts`
  (refreshes only the CSVs of the specs being run). Check both before relying on
  the "serial group, run with `-g`" habit.
- Run with the workflow's own `REPORTS_DIR`, `TEST_DATA_ONLY` and `--output`
  so another session's run does not wipe `reports/test-results`.

## Same finding in three workflows (for QA)

Update a company 1 and 2 on a trigger other than Reply Received: Logs show
Success (Email Opened: Error on row 1) but the company City and State stay
"--". Email Bounced and Email Opened both saw it. Related bugs: AL-4030,
AL-4109, AL-4110. One bug draft can cover all, after QA says bug.

## Not part of this resume

Prospect Outcome (AL-4012), Email Sent (AL-4010), Contact Updated (AL-4007),
Company Created (AL-4009, parked) and Unsubscribed (AL-4015) are not in
progress. Their state is in `00-overview.md` and their own files.
