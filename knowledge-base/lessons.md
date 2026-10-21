# Lessons

Mistakes Claude made in this project and the change that prevents a repeat.
Newest first. Managed by the `learn-from-mistake` skill: an entry is
**Proposed** until QA approves the change, then **Applied** with where the
change now lives.

Entry shape:

```
## YYYY-MM-DD: <short title>
- What went wrong:
- Why:
- Change: <file and the rule or text added>
- Status: Proposed | Applied | Rejected
```

## 2026-10-20: Replied without reading the no-ai-slop skill (Salesforce status replies)
- What went wrong: replies in the session used bold labels, a numbered list for three items and "I'd" hedges. The rule (CLAUDE.md "Replies" bullet, memory note, both hooks) was in place; I followed only the one-line hook summary and never opened `.claude/skills/no-ai-slop/SKILL.md` until QA asked.
- Why: the hooks carry a summary, not the rules, and the first fix I proposed (invoke the skill through the Skill tool) does not work: `.claude/settings.local.json` has `"no-ai-slop": "off"`, so the Skill tool refuses it.
- Change: `CLAUDE.md` "Replies" bullet: before the first reply of a session, Read `.claude/skills/no-ai-slop/SKILL.md` (the Skill tool is off for it), then follow General Response Mode. Existing rule failed, so this changes how it is written, not a second copy.
- Status: Applied (QA OK 2026-10-20), now in `CLAUDE.md` "Replies" bullet

## 2026-10-20: Timeout fix undone by another setTimeout (Unsubscribed smoke 04, 06)
- What went wrong: after the 5 minute failures I set a 20 minute timeout in `beforeEach`; the next run still died at exactly 10.0 min. `runTrigger` in the shared flow called `test.setTimeout(10 * 60_000)` and replaced it.
- Why: I did not search for other `setTimeout` calls, and did not check in a trace that the new limit applied.
- Change: `runTrigger` now keeps the longer value (`Math.max(test.info().timeout, 10 * 60_000)`). Rule in `knowledge-base/testing/how-to-test.md` ("Waiting and verifying"): after changing a timeout, grep `setTimeout` in the spec and `src/flows/`, and confirm the failure time moved.
- Status: Applied (QA OK 2026-10-20)

## 2026-10-20: Copied a stale assertion from a sibling workflow (Unsubscribed smoke 10)
- What went wrong: check 10 expected older deals to have no logged email. AL-4130 (developer, 2026-10-15) made "email on every deal" expected behavior; `link-clicked-progress.md` said "proposed, not applied", and the spec was copied from Link Clicked without reading it.
- Why: the source workflow's open decisions were not checked before copying.
- Change: `.claude/skills/ui-test-from-workflow/SKILL.md`, new step 3-copy: search the source `*-progress.md` for "proposed, not applied" and open QA decisions before copying a spec, assertion or data rows.
- Status: Applied (QA OK 2026-10-20)

## 2026-10-20: Test timeout raised too late (Unsubscribed smoke 04, 06)
- What went wrong: both tests hit the 5 minute default during HubSpot set-up (contact plus 3 deals or 2 companies); the 20 minute timeout was set later, inside `fireEvent`.
- Why: set-up time on the new portal (about 40 s per page) was never measured.
- Change: `knowledge-base/testing/how-to-test.md`, "Waiting and verifying": set the timeout in `test.beforeEach`. Done in `unsubscribed-smoke.spec.ts`.
- Status: Applied (QA OK 2026-10-20)

## 2026-10-20: Row left unused after a failed run (Unsubscribed smoke 02)
- What went wrong: the first 02 run created the HubSpot contact, then failed in Saleshandy before the row was marked used. The next run stopped with "HubSpot already has a contact".
- Why: `markUsed` ran only after the prospect was added.
- Change: `flow.markUsed(row)` called inside `newContact` right after the contact is created; `markUsed` skips duplicates; gotcha in `knowledge-base/testing/ui-gotchas.md`.
- Status: Applied (QA OK 2026-10-20)

## 2026-10-20: Data rows did not match the test titles (Unsubscribed smoke 04, 06)
- What went wrong: the spec read the "> 1" rows (1 deal, 1 company) for tests that need 3 deals and 2 companies.
- Why: no check of row counts against the titles before handing the spec over.
- Change: `npm run data:check -- <slug>` (`scripts/check-data.ts`) prints deals and companies per row and warns on repeated countries, titles and companies; required by the data step in `SKILL.md`.
- Status: Applied (QA OK 2026-10-20)

## 2026-10-19: Named a cause from a guess, not from the trace (Unsubscribed smoke)
- What went wrong: first run failed with the row still "Scheduled"; I said the sender might have hit its daily limit. The trace showed `POST /emails/send` returned 201 and the toast showed. The real cause was the Emails list not refreshing, found by QA's question.
- Why: I read the screenshot and error line, not the trace, before naming a cause. The 2026-10-14 lesson only covered Field Mapping.
- Change: `.claude/skills/ui-test-from-workflow/SKILL.md`, "first run is a learning run" step: read the failing test's trace before naming a cause; otherwise write "cause not proven".
- Status: Applied (QA OK 2026-10-19: `.claude/skills/ui-test-from-workflow/SKILL.md`)

## 2026-10-19: Test filter matched nothing and a run was wasted
- What went wrong: launched checks 00 and 01 with a `-g` pattern containing "›"; Playwright matches `-g` against the title without it, so "No tests found" came back after the launch.
- Why: the filter was not checked before launching.
- Change: same step in `SKILL.md`: run the same command with `--list` first and confirm it lists the intended tests.
- Status: Applied (QA OK 2026-10-19: `.claude/skills/ui-test-from-workflow/SKILL.md`)

## 2026-10-19: Fixed waits set without evidence (Unsubscribed smoke)
- What went wrong: the final Prospects check was set to 15s, reload once, with no evidence of how long the status takes. It failed twice, costing runs of about 8 and 14 minutes.
- Why: a short window was picked to follow "no unnecessary waits" and treated as the whole requirement.
- Change: `knowledge-base/testing/how-to-test.md` "Waiting and verifying": a wait or timeout for a product event comes from a measured time or QA's manual steps, not a guess.
- Status: Applied (QA OK 2026-10-19: `testing/how-to-test.md`)

## 2026-10-18: 63-row full spec built without checking feasibility first (Unsubscribed, AL-4015)
- What went wrong: stage 3 generated and started running a 63-row spec (every activity duplicated for a "real link" trigger, plus chained prospects) before checking whether it could realistically be run end to end. Rows 16-63 were never completed; QA later dropped the whole spec and a 27-row lite spec had to be built from scratch to replace it as the regression suite.
- Why: `ui-test-from-workflow` stage 3 generates straight from the planner's scenario count with no step that checks total scenario count against realistic run time, or flags duplicate "real link" variants, before QA is asked to sign off on scope.
- Change: `.claude/skills/ui-test-from-workflow/SKILL.md`, new stage "3-pre. Scope check": multiply the approved scenario count by 6 minutes (measured average row runtime, Unsubscribed lite: 144 min / 27 rows); if the estimate exceeds 3 hours (roughly 30 scenarios), or the list has a variant that only re-proves a trigger already proven once at baseline, stop and show QA the count, estimate and the rows to cut before generating.
- Status: Applied (QA OK 2026-10-18: `.claude/skills/ui-test-from-workflow/SKILL.md` stage 3-pre)

## 2026-10-18: New account's sequence schedule blocked rows outside business hours (Unsubscribed, AL-4015)
- What went wrong: the test sequence's Default Schedule (Mon-Fri 09:00-18:00 Asia/Kolkata) meant step 1 emails queued as "Scheduled Tomorrow" instead of sending, failing Create a Deal rows 1 and 2 and stalling the rest of the run after 18:00 IST.
- Why: account setup (stage 1 / `account-setup.ts`) creates the sequence with HubSpot's default sending schedule and does not set an always-on schedule, so any run outside the window fails on timing, not product behavior.
- Change: `knowledge-base/testing/how-to-test.md` "Before a workflow test" item 7, and a comment on `account-setup.ts`'s `sequences` map: a new account's test sequence must have an always-on sending schedule before any timed run; the HubSpot default window (Mon-Fri 09:00-18:00) fails rows that run outside it.
- Status: Applied (QA OK 2026-10-18: `testing/how-to-test.md` item 7, `src/config/account-setup.ts` comment)

## 2026-10-17: Unbounded networkidle wait looked like a browser crash (shared `wait.ts`, found via Unsubscribed lite)
- What went wrong: `waitForPageLoad` called `page.waitForLoadState('networkidle')` with no timeout of its own. On a page that never goes fully idle (HubSpot Integration page), it hung until the whole test's timeout fired, Playwright force-closed the browser, and the pending call surfaced as "Target page, context or browser has been closed" - read as a crash, not a hang. Affects every workflow spec that calls this helper, not just Unsubscribed.
- Why: the helper had no bound of its own, so a page-specific idle problem could fail silently as a generic-looking crash with no useful error.
- Change: code fix already in `automation/src/utils/wait.ts` (networkidle now bounded to 30 s, falls through to the existing `pageLoadProblem` check). Symptom documented in `knowledge-base/testing/ui-gotchas.md`, new "Shared waits" table: check for a hung unbounded `networkidle` wait before assuming infra flakiness on a "Target page, context or browser has been closed" error.
- Status: Applied (QA OK 2026-10-18: `testing/ui-gotchas.md` Shared waits; code fix already live since 2026-10-17)

## 2026-10-15: Whole-chain reruns and a shaky first script (Company Created, full run)
- What went wrong: I started the 20-test chain five times (about 45 minutes each, three of them stopped after 2 failures) and a partial rerun that would have failed for lack of earlier rows' state. QA stopped it ("Do not start over"). The script itself had four avoidable faults: company domain reused every run (HubSpot then disables the Contact field), the contact dropdown left open over Create, a lost click while the form re-renders, and a module-level "created" Set wiped by every worker restart. I also said "17 tests" when there were 19 cases plus Setup.
- Why: I treated each run as a full verification instead of a learning run, did not use `KEEP_TEST_DATA=1` with `-g` for the failed rows, and wrote the form steps without checking the duplicate-domain state or the restart behavior. The count came from memory, not from the spec.
- Change: (1) `.claude/skills/ui-test-from-workflow/SKILL.md` stage 3c, run step: "The first run is a learning run: read every failure, fix it, then rerun only the failed and not-yet-run rows with `KEEP_TEST_DATA=1` and `-g` (add `CREATED_LABELS` when contacts already exist). Do not restart the whole chain; the full run is QA's, after the fixes." (2) `knowledge-base/testing/ui-gotchas.md` HubSpot Create Company: duplicate exact domain disables the Contact field (stamp the domain per run), dropdown stays open, click lost during re-render, keep the "created" list in a file. (3) `knowledge-base/testing/how-to-test.md`: count tests with `npx playwright test --list`, not from memory. (4) `knowledge-base/testing/ui-gotchas.md` MCP: `npm run mcp:open` does not help `--isolated` MCP servers; merge cookies into the server's `--storage-state` file instead.
- Status: Applied 1 to 4 (QA OK 2026-10-15: `ui-test-from-workflow/SKILL.md` stage 3c, `testing/ui-gotchas.md` HubSpot table and Playwright MCP servers, `testing/how-to-test.md` After a run; memory `run-failed-rows-not-whole-suite`)

## 2026-10-14: A QA decision was fixed in one spec, not where the expectation lives (Email Opened production smoke, Record 10)
- What went wrong: QA decided at 17:05 that the logged-email card reads "Logged email by <name> via Saleshandy", not "Logged email with <prospect>". I changed it only in the hard-coded strings of `email-opened-phase2.spec.ts`. The production smoke spec, written later by copying staging rows, carried the old `loggedEmailContains` line, so test 10 failed after 180 s on a card that was correct (9 of 10 passed, 45 min lost).
- Why: the expectation lives in a shared flow config line, which I did not change, and I did not search the repo for other copies of the old text. When I copied rows into a new spec I did not check them against the QA decisions in the progress file. Also, the "<name>" is the account's integration name ("rehan integration" on production), not the trigger, so even the staging text would not match production.
- Change: (1) `knowledge-base/testing/how-to-test.md` "Waiting and verifying": "When QA changes an expected result, grep the whole automation project for the old text and fix the config line it comes from, not only the spec in front of you. A new spec made by copying rows re-reads every QA decision in the progress file first." (2) `automation/context/hubspot/00-overview.md` Intended behavior (the Record paired with Update a deal line): the card header is "Logged email by <integration name> via Saleshandy", where the name is the account's integration (staging: Email Opened, Link Clicked; production smoke: rehan integration); match with a pattern. (3) `.claude/skills/ui-test-from-workflow/SKILL.md`, the step that writes a spec: add "Before copying rows from another spec, list the QA decisions in that workflow's progress file that change those rows."
- Status: Applied 1 and 2 (QA OK 2026-10-14: `testing/how-to-test.md` Waiting and verifying, `context/hubspot/00-overview.md` Intended behavior). Change 3 and a proposed 4 (`automation/jira/CLAUDE.md` rule 12: a ticket key or caveat must belong to the workflow before it goes in a draft; AL-4123 and AL-4113 were copied from a checklist into the AL-4013 smoke draft, they are Link Clicked and Prospect Outcome bugs) are NOT applied: the permission classifier blocked edits to instruction files, waiting for QA.

## 2026-10-14: A seed check reset every workflow's test data (Unsubscribed agents setup)
- What went wrong: to prove the new `tests/seed.spec.ts` logs in, I ran `npx playwright test tests/seed.spec.ts` with no `TEST_DATA_ONLY` or `KEEP_TEST_DATA` while four workflows were running. `global-setup.ts` found no CSV named for that spec, fell back to "every workflow", and replaced all rows (and emptied `*.used.txt`) of 7 CSVs at 16:44:37. Runs of email-opened-phase2, link-clicked, reply-received and email-bounced-phase2 read changed people mid-run, so their later failures can be false.
- Why: I did not read `testing/how-to-test.md` "Test data" before running anything. It already says `KEEP_TEST_DATA=1` and `TEST_DATA_ONLY` exist, and I had flagged the same risk in my own plan, then ran the command anyway. The 2026-10-13 lesson above this one is still only Proposed (a doc line), and `global-setup.ts` still treats a spec with no CSV as "run all". The test agents would hit the same fallback on every `planner_setup_page`.
- Change: (1) `.mcp.json`, `playwright-test` entry: add `"env": {"KEEP_TEST_DATA": "1"}`. (2) `knowledge-base/testing/how-to-test.md` "Test data": add "Any `playwright test` run (seed, spec, agent) with no CSV of its own, or while other workflows are live, needs `KEEP_TEST_DATA=1` or `TEST_DATA_ONLY=<own slug>`; without it a run with no matching CSV refreshes every workflow." (3) `plan.md` section 0 rule: same sentence, as a Claude working rule. (4) Optional, QA decides: `src/data/global-setup.ts` fallback, a named spec with no CSV refreshes nothing (shared file, every workflow uses it).
- Status: Applied 1 to 3 (QA OK 2026-10-14: `automation/.mcp.json` `playwright-test` env, `testing/how-to-test.md` Test data, `plan.md` section 0 rule 11). Change 4 (`global-setup.ts` fallback) Proposed, waits until the live runs end and QA's OK.

## 2026-10-14: Posted Jira comments from the terminal instead of drafting (Link Clicked, AL-4122 and AL-4123)
- What went wrong: after QA said "looks good" on the wording of two Verification comments, I called `addOrEditJiraIssueComment` and posted them (comments 78816 and 78817). QA's workflow is: Claude writes a draft file in `automation/jira/drafts/`, QA sends it from `npm run jira`. The comments cannot be deleted through the MCP, so QA has to remove them by hand if they want them re-sent.
- Why: the rule already existed in Claude memory (`jira-verify-then-draft`) but not where I work from. The kit's own text says the opposite: `automation/jira/CLAUDE.md` rule 5 and `docs/comments.md` section intro tell Claude to post with `addOrEditJiraIssueComment` after "looks good". I followed the kit in front of me and read QA's "looks good" as approval to write, when it was approval of the text.
- Change: (1) `automation/jira/CLAUDE.md` rule 5: replace the tool list and "get an explicit looks good before calling any write" with: "Claude never calls a Jira write tool (`createJiraIssue`, `addOrEditJiraIssueComment`, `editJiraIssue`, `createJiraIssueLink`, `transitionJiraIssue`, attachments). After QA's 'looks good' on the text, write the draft to `jira/drafts/<slug>.json` (`type: bug` or `type: comment` with `ticket` and `body`, like `al-4119-retest-comment.json`) and tell QA to send it from `npm run jira`. 'Looks good' approves the wording, not a write." (2) `automation/jira/docs/comments.md` intro: replace "then post it with `addOrEditJiraIssueComment`" with "then write it to `jira/drafts/` as a `comment` draft; QA sends it from `npm run jira`." (3) Memory `jira-verify-then-draft`: add "Applies to comments and transitions too; 'looks good' is not permission to call a Jira write tool."
- Status: Proposed (waiting for QA's OK on the three edits above)

## 2026-10-13: Bug prerequisites named the wrong activity (Link Clicked, AL-4120 Click Count)
- What went wrong: the AL-4120 description said the trigger had "Create a Task in HubSpot only", but the bug is in the note written by Create a Note (empty "Click Count:" in the `email-link-clicked` note). Asked which scenario failed, I then repeated that draft and guessed a Note row instead of saying the scenario was not known.
- Why: the Prerequisites were taken from the run in which the empty count was first noticed (the Create a Task rows), not from the activity that owns the failing behavior; QA was not asked to confirm them. Exact original cause beyond that is not visible in the session.
- Change: rule 11 in `automation/jira/CLAUDE.md` Core rules: "Prerequisites name the activity that produces the failing record or field, not the activity selected in the run where it was first seen. Put the Prerequisites in the question round and get QA's yes. If the symptom can show up in several workflows or rows, say so in Note instead of picking one. When asked which scenario failed, answer from the run evidence (report or trace), not from the draft, and say 'not known' if neither shows it."
- Status: Applied (QA OK 2026-10-13: `automation/jira/CLAUDE.md` Core rules, rule 11)

## 2026-10-13: Expected results taken from our own scenario file or a mixed QA answer (Link Clicked, Note 4 and Record 6)
- What went wrong: (1) called "note only on the deal" a product issue because the scenario file said "note on both the contact and the deal"; QA: that is the intended behavior. (2) QA listed three things for Update a deal + Record email ("deal only, no contact" and "unknown contact on the latest deal"); I read all three as expected and scripted "Unknown Contact" as the expected header. QA: Unknown Contact is a bug.
- Why: the scenario line was never confirmed by QA or seen on staging (copied from the Email Sent description of a different pairing), and I did not split a multi-part answer into expected and bug before writing it into a test.
- Change: proposed bullet in `testing/how-to-test.md` (Verification): "An Expected Result that no QA answer or staging run has confirmed is not a verdict: report what happened and ask QA. When QA answers with several behaviors in one message, list each as expected or bug and get a yes before writing any of them into a scenario or test."
- Status: Applied (QA OK 2026-10-13: `testing/how-to-test.md` Waiting and verifying)

## 2026-10-13: Test-data refresh touched another workflow's CSVs (Reply Received full run)
- What went wrong: a full Reply Received run replaced used rows in `email-opened.csv` and `email-bounced.csv` while the Email Opened session was running its spec, risking its in-flight people.
- Why: `src/data/global-setup.ts` step 2 replaced used rows of every other CSV, assuming one run at a time; I did not scope the run with `TEST_DATA_ONLY` although other sessions run in parallel.
- Change: `global-setup.ts` now refreshes only the CSVs of the specs being run; `REFRESH_OTHER_USED=1` restores the old behavior. Line added to `testing/how-to-test.md` (test data): "A run changes only its own workflow's CSV; other workflows' used rows are replaced by their own next run."
- Status: Applied (QA OK 2026-10-15: code change and the `testing/how-to-test.md` Test data line)

## 2026-10-13: A check that could only pass (Email Opened data check)
- What went wrong: wrote a spec that looks each CSV email up in HubSpot and reported it passed after 10 minutes. It had looked for the email as a link, HubSpot shows a truncated email, so it could never find anything; the "pass" meant nothing.
- Why: no case proved the check could see a record that exists. Caught only because a known existing contact (serena.caruso@mailinator.com) was run through it and failed.
- Change: `tests/hubspot/email-opened-data-check.spec.ts` has a sanity test (a known existing contact must be found, a made-up address must give 0) and reads the list footer count. Rule: a "nothing exists" check gets a sanity case that must find a known record before its result is trusted. Recorded in `testing/how-to-test.md` and `testing/ui-gotchas.md`.
- Status: Applied (QA OK 2026-10-13)

## 2026-10-13: Read the Logs tab as a per-activity result (Reply Received, Create a Note 6)
- What went wrong: treated "Create a Note selected alone" as expected to fail in Logs, scripted `not Success`, then asked QA whether a Success log was a bug. QA: the Logs are for the custom workflow; with only Create a Note selected the workflow succeeds and no note lands on any contact, company or deal.
- Why: the scenario text ("Fails, no note created (as the tooltip says)") was copied into five workflow files and taken literally; nothing in the KB says what a Logs entry represents.
- Change: `automation/context/hubspot/00-overview.md` Intended behavior: "A Logs entry is the custom workflow's run, not one activity's result. Success means the workflow ran; it does not prove a record was written. Whether a note, task, contact or deal exists is checked in HubSpot." Plus a bullet in `knowledge-base/testing/how-to-test.md` (Verification). Rows "Create a Note selected alone" in email-opened.md, email-bounced.md, link-clicked.md, email-sent.md change to "Success in Logs; no note on any contact, company or deal" (reply-received.md and the shared test already changed).
- Status: Applied (QA OK 2026-10-13: `00-overview.md` Intended behavior, `testing/how-to-test.md` Waiting and verifying, the four scenario rows)

## 2026-10-12: Public docs not read when no workflow context (Email Opened)
- What went wrong: with no pasted context, asked QA for the workflow description instead of reading docs.saleshandy.com first; QA had said before to use it.
- Why: the rule exists only in `kb-update` step 4 and QA's earlier chat; `ui-test-from-workflow` stage 2 does not say to read the docs when there is no context.
- Change: `ui-test-from-workflow` stage 2: "No context pasted: read docs.saleshandy.com (HubSpot Integration, Sequence Settings, the trigger's help page) first, then ask only what the docs leave open." Also a feedback memory.
- Status: Proposed

## 2026-10-09: Saved Extra Configuration before the skipped row
- What went wrong: walked Create a Contact 5 (saves Lead Status and Lifecycle) before row 1 (skipped) on the new linkclick account, so row 1 can no longer run there; then called the kept values a possible bug.
- Why: did not know saved Extra Configuration can never be cleared (expected behavior) and walked rows in an order that saved values first.
- Change: `ui-test-from-workflow` stage 3b and `testing/how-to-test.md`: on a new account, walk "skipped" rows first; behavior recorded in `00-overview.md` Intended behavior.
- Status: Applied (QA instruction, 2026-10-09)

## 2026-10-09: Asked QA for a CSV Claude should generate
- What went wrong: asked QA for `link-clicked.csv`; QA had already said Claude creates the test data, and a data template exists.
- Why: `ui-test-from-workflow` stage 3a says "ask QA for the CSV", and QA's instruction from the Email Sent session was only in that transcript.
- Change: stage 3a: "Generate the CSV with `npm run data:generate -- <slug> --from <sibling workflow>` (template `test-data/_DATA_TEMPLATE.md`); never ask QA for it." Recorded in `context/project.md`; skill text still to approve.
- Status: Applied (`ui-test-from-workflow` stage 3a, `context/project.md`)

## 2026-10-08: Drafting choices made without asking (Link Clicked)
- What went wrong: while drafting the Link Clicked scenarios, choices such as values and setup details were made in the draft rather than asked in the question round.
- Why: stage 2 step 3 asks about gaps in the context, but not about choices Claude makes while writing the draft.
- Change: `ui-test-from-workflow` stage 2 step 3: any choice made while drafting goes into the same question round, with the default.
- Status: Applied (`ui-test-from-workflow` stage 2 step 3)

## 2026-10-08: Trigger timing not asked in stage 2 (Link Clicked)
- What went wrong: how the link is clicked (Mailinator) and how long a click takes to register (1 to 1.5 min) came up only after the scenarios were drafted.
- Why: the stage 2 checklist has no item for how the trigger event is done in the UI and how long it takes to show.
- Change: `ui-test-from-workflow` stage 2 step 3: add the checklist item "how is the trigger event done in the UI, and how long until it registers".
- Status: Applied (`ui-test-from-workflow` stage 2 step 3)

## 2026-10-08: Called a correct path broken
- What went wrong: reported `../integration-skills/` in `00-overview.md` as a wrong path; it was correct.
- Why: tested it from `local project/`, but in `automation/` files "project root" means `automation/`.
- Change: `kb-update` step 1: check a path from the folder the file means (in `automation/` files, project root is `automation/`) before calling it broken.
- Status: Rejected (QA, 2026-10-08: not needed)

## 2026-10-08: Assumed instead of asking
- What went wrong: started designing the knowledge base layout and scope without asking.
- Why: treated design choices as defaults rather than open points.
- Change: memory `ask-before-assuming`: ask every open point (scope, layout, meaning) in one round before building.
- Status: Applied

## 2026-10-08: Ambiguous HubSpot locator (City)
- What went wrong: test row 2 failed; "City" matched both the Key information card and the All properties panel.
- Why: the walkthrough edited City from the card, so the spec's panel path was never seen with both visible.
- Change: `automation/src/pages/hubspot/contacts.page.ts` scopes edits to the panel; gotcha added to `testing/ui-gotchas.md`.
- Status: Applied

## 2026-10-08: Saleshandy sidebar covered the trigger toggles
- What went wrong: toggle click timed out.
- Why: the expanded left menu sat over the page.
- Change: `SaleshandyPage.closeSidebar()`, called before toggling; gotcha recorded.
- Status: Applied

## 2026-10-08: Asked for OK on every step during the walkthrough
- What went wrong: QA was slowed down by per-step confirmations.
- Why: rule 7 was read as "ask before every write".
- Change: standing staging approval in `plan.md` rule 7 and memory `no-unnecessary-stops`.
- Status: Applied

## 2026-10-08: Logs checked without a known cadence
- What went wrong: QA had to set the Logs rule during the first walkthrough (do not open entries; refresh 15 s after the action, then every 10 s).
- Why: it was not known up front that Refold delivers the data late.
- Change: Logs cadence (15 s, then 10 s; do not open entries) in `automation/src/utils/wait.ts`, the workflow skill and `testing/how-to-test.md`.
- Status: Applied

## 2026-10-08: Name prefix on test data
- What went wrong: planned a `qa-auto-<timestamp>` prefix; QA wanted CSV values as they are.
- Why: the plan proposed a prefix and it was used as the default without asking.
- Change: `automation/context/project.md` (no prefix); used-rows tracking in `automation/src/data/used.ts`.
- Status: Applied

## 2026-10-08: Project state only in the transcript
- What went wrong: "resume" in a new session meant digging through old transcripts.
- Why: state was not written to files.
- Change: memory `resume-pointers`.
- Status: Applied

## 2026-10-14: Fix retest failed three times, cause was the account Field Mapping
- What went wrong: AL-4127 (Update a company) was re-run three times after the deploy with the same result and the guess was "fix not live"; QA then found the Field Mapping on the linkclick account was not updated.
- Why: the account's Field Mapping was not checked before calling the failure a product result.
- Change: before calling an activity failure after a fix, check the account's Field Mapping (Settings > Integrations > HubSpot) against the fields the activity writes [QA, 2026-10-14].
- Status: Applied
