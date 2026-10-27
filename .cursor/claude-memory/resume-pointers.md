---
name: resume-pointers
description: "Where to look to rebuild project state when the user says \"resume\" (plan.md, project.md, scenario template)"
metadata:
  node_type: memory
  type: project
  originSessionId: 5997aea5-196d-4678-ad49-54544fb9606b
  modified: 2026-10-13T09:29:39.094Z
---

**Start here (saved 2026-10-13 afternoon): `automation/context/hubspot/RESUME.md`**, a table of the 4 workflows in progress (Email Opened AL-4013, Link Clicked AL-4014, Reply Received AL-4011, Email Bounced AL-4016) with state, open items and the progress file to read. QA asked for only these 4 entries. The paragraphs below are older and some are stale (RESUME.md wins). Pending QA decisions as of that save: Update a company 1 and 2 bug-or-not (seen in Email Bounced and Email Opened), Email Bounced baseline 5 duplicate Error log entry.

Project state lives in files, not memory: `plan.md` (phases in section 11, rules in section 0), `automation/context/project.md` (answers to unknowns), `automation/test-cases/_SCENARIO_TEMPLATE.md` (QA's scenario template, moved there 2026-10-08), skill at `.claude/skills/ui-test-from-workflow/SKILL.md`. Knowledge base (added 2026-10-08): `knowledge-base/README.md`, skills `saleshandy-knowledge`, `learn-from-mistake`, `kb-update`; user-perspective skill deferred by QA.

As of 2026-10-08: Contact Updated workflow (first one) is at stage 3 done: spec `automation/tests/hubspot/contact-updated.spec.ts` written, not yet run by QA. Walkthrough created Keanu Makoa in HubSpot/Saleshandy (so that CSV row is used up). Next: QA runs spec, then stage 4. After Contact Updated passes, QA wants to use `improvement-plan.md` (local project root; speed and process improvements, nothing built yet, each item needs QA's OK).

Link Clicked in Saleshandy (AL-4014, session 8157c650-9ee7-4c55-9220-34661fab8ee8), as of 2026-10-08: stages 1 and 2 done and approved. Context `automation/context/hubspot/link-clicked.md` (has a Mailinator click and 1 to 1.5 min click delay section), scenarios `automation/test-cases/hubspot/link-clicked.md` (Regression, mirrors Email Sent). 2026-10-09: resumed stage 3. Claude generated `link-clicked.csv` (+ -deals, -companies) from `test-data/_DATA_TEMPLATE.md` (QA: Claude always generates CSVs, never asks for them). Saleshandy linkclick login saved 2026-10-09; HubSpot uses the shared auth/hubspot-chromium.json (hubspot: shared). Generator: npm run data:generate. Progress and next steps: automation/context/hubspot/link-clicked-progress.md (spec has 10 tests, QA to run). Prospects go in with Add Prospects. In the walkthrough, create a new sequence "HubSpot Link Clicked QA" on the linkclick account (2 steps, 2 links each, Track Link Clicks on). Retro done: overview file names fixed, account added to the scenarios, KB Mailinator/click-delay bullet in how-to-test.md. The two skill lessons (trigger timing, drafting choices) in lessons.md are still Proposed because QA didn't approve them on 2026-10-09.

Reply is received in Saleshandy (AL-4011), as of 2026-10-12 evening: 28 of 45 scripted tests passed, 4 failed (Create a Contact 4, Update a Contact 4, Create a Task 1, 2), 13 not run, 2 not scripted. Read the "Session saved 2026-10-12 evening" section at the end of `automation/context/hubspot/reply-received-progress.md` first; it separates seen facts from unverified guesses. Screenshots: `automation/context/hubspot/evidence/reply-2026-10-12/`. AL-4118 and AL-4119 filed. Run rows one by one with REPORTS_DIR=reports/reply TEST_DATA_ONLY=hubspot/reply-received.

Prospect Outcome is updated in Saleshandy (AL-4012), as of 2026-10-09: stage 1 done (`automation/context/hubspot/prospect-outcome-updated.md`), stage 2 Regression question round answered and draft shown but NOT approved. Progress, QA answers and the full draft: `automation/context/hubspot/prospect-outcome-updated-progress.md`. Next: QA's "looks good" on the draft, then save to test-cases and start stage 3.

Update 2026-10-09 evening (session 9a5d1fd0, local-project-76): Link Clicked spec is 16 tests generated from the shared `automation/src/flows/activity-rows.ts` (14 pass, 2 skip by design); next rows start with Update a deal. Reply Received: QA answered the 5 questions (answers in reply-received-progress.md), bug AL-4118 filed. One-click Jira is built (`npm run jira`, drafts in `automation/jira/drafts/`, see [[jira-verify-then-draft]]). Run specs per session with REPORTS_DIR=reports/<slug> and TEST_DATA_ONLY=hubspot/<csv slug>. Read the "Session saved" section at the end of link-clicked-progress.md first.

Email is Bounced in Saleshandy (AL-4016), as of 2026-10-12: stage 1 done (`automation/context/hubspot/email-bounced.md`), stage 2 revised draft shown, NOT approved. Progress and QA answers: `automation/context/hubspot/email-bounced-progress.md`. QA works in phases: rows with Extra Configuration empty first (script, run, fix), then the rows with Extra Configuration.

Company Created/Properties Updated in HubSpot (AL-4009), as of 2026-10-15 evening: staging 19 of 19 passed; production smoke 9 of 9 passed (5 by script, 4 by QA by hand: Replied, Finished, Unsubscribed, Blacklist). Read `automation/context/hubspot/company-created-progress.md` (sections "2026-10-15 afternoon" and "evening") and `automation/notes/production-testing/04-company-created.md`. One command for the smoke: `npm run smoke:company-created` (SKIP_BLACKLIST=1 skips check 08). Draft comment waiting for QA to send: `automation/jira/drafts/al-4009-production-smoke-summary.json`. Open: QA to confirm row 9 cleanup wording and whether Replied ends Finished; speed-up proposal (poll 3 min, prerequisite check, no Logs wait) not applied; production script check 05 failed in the script, passed by hand. Properties Updated stays out of scope (AL-4059).

Multi-account setup (2026-10-08): see [[multi-account-plan]] for where it stopped. The contact-updated spec now needs the contactupdated logins before QA can run it.

**Why:** the user often opens a new session with just "resume" and memory was empty, forcing transcript digging.
**How to apply:** read those three files first; follow plan.md rule 3/4 (post plan, wait for OK at phase boundaries).
