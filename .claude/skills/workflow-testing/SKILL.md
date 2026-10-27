---
name: workflow-testing
description: Build test cases and the Playwright spec for one Saleshandy integration workflow on one platform, in regression mode (staging, every variation) or smoke mode (production, fixed tickets only). Input is the workflow name, the platform and the mode (e.g. "Link Clicked, Pipedrive, smoke"). Use when QA names a workflow and a platform and wants cases, a script, or both.
---

# Workflow testing (regression and smoke)

Input: workflow name, platform and mode. Mode is `regression` (staging) or
`smoke` (production). If QA gives no mode, ask once. Default is `regression`.
Everything else is read from the project, not asked.

Set `<platform>` to the lowercase platform name (`pipedrive`, `salesforce`,
...) and `<workflow>` to the kebab-case workflow name (`link-clicked`).

## Modes

| | regression | smoke |
|---|---|---|
| Environment | staging | production (`environment: 'production'` account, `emailopenedprod`) |
| Goal | every variation of the trigger and its actions | confirm the fixed tickets of the workflow hold after a deploy |
| Size | 30 to 40 rows (Link Clicked: 2 to 5 trigger cases plus UI rows) | 1 baseline, then 1 to 3 checks per activity, in product UI order |
| Cases file | `automation/test-cases/<platform>/<workflow>.md` | `automation/notes/production-testing/NN-<workflow>.md`, format of `01-email-opened.md` |
| Spec | `automation/tests/<platform>/<workflow>.spec.ts` | `automation/tests/<platform>/<workflow>-smoke.spec.ts`, one test per check, same order |
| Data | `automation/test-data/<platform>/` | `automation/test-data/<platform>/<workflow>-smoke*.csv` (gitignored) |
| Failures | product failures go in the progress file, keep running | same, and the result goes in the README table of `notes/production-testing/` |

Rules that apply only to smoke:

- Read `automation/notes/production-testing/README.md` first. It holds the
  scope, the production setup, the senders and the timing.
- Build the checks from fixed tickets only. Put open or undeployed tickets in
  a "Not covered, still open" paragraph. They are never failures.
- Do not explore production with MCP. Learn the screens on staging.
- The spec creates no records that need cleanup and respects the sender limit
  read on the Email Accounts page. Use Send now for step 1.
- Each workflow has its own production sequence. A setup spec in
  `tests/setup/<workflow>-smoke-sequence.spec.ts` creates it. It runs only
  with `SETUP_SMOKE_SEQUENCE=1` and never retries. Its id and step 1 subject
  go in `SMOKE_SEQUENCE_ID` and `SMOKE_STEP1_SUBJECT`.
- Run one smoke at a time, with one trigger enabled. Turn the sibling
  triggers off.
- A gate test runs first: the platform is connected and the field mapping is
  complete.
- Cloudflare blocks headless login. QA logs in headed
  (`npm run login:saleshandy -- emailopenedprod`).
- Add a `smoke:<workflow>` script to `automation/package.json`.
- Production timing: first open 60 s after the send, second open 120 s after
  the first. First click 90 s after the send, second click 180 s. The log
  shows 1 to 3 minutes after that.
- No Jira write without QA's OK. Draft the summary from
  `jira/templates/comments/04-production-smoke-summary.md` into
  `jira/drafts`. QA sends it.
- If the platform has no production account or org in
  `src/config/accounts.ts` and `src/config/environments.ts`, stop and ask QA
  for it. Do not guess one.

## 0. Before anything

1. Read `automation/context/<platform>/RESUME.md` (or the newest progress
   file if there is no RESUME.md), `00-overview.md`, `<workflow>.md`, the
   saved cases for the mode and the existing specs in
   `automation/tests/<platform>/`. Use the `saleshandy-knowledge` skill.
2. Run `ListAgents`. If another session owns this workflow, say so and stop.
3. Platform rules:
   - **Pipedrive, Salesforce:** hand-write the spec. Do not use the Playwright
     planner, generator or healer (QA 2026-10-19, 2026-10-24).
   - **HubSpot:** regression is released and out of scope. Smoke on HubSpot
     already exists for the workflows in `notes/production-testing/`. Confirm
     with QA before touching either.
   - **Any other platform:** ask QA once. Default is `ui-test-from-workflow`
     (`plan.md` section 0 rule 12).
4. Regression, Pipedrive: account is `gpipedrive`, all workflows in parallel
   with their own data. Email Sent must be OFF for the sibling workflows.
   Regression, Salesforce: use the account listed in `src/config/accounts.ts`
   for the workflow. Smoke: use the production account (see Modes).
5. Ask every open point in one round, each with a suggested default. Then
   work. Do not ask what exploring the product can answer.

## 1. Test cases

- Regression: rebuild from scratch. Old generic drafts in `drafts/` are not
  reused. Smoke: start from the fixed tickets in Jira and the existing
  regression file of the same workflow, and keep only what a fix needs.
- Write as a QA with 15+ years of experience: realistic scenarios a tester
  would actually run. No AI-jargon scenarios, no padding.
- Regression: one section per action available for the trigger, plus the real
  UI rows.
- For behaviour not known on this platform, take the rows from the HubSpot
  and Salesforce files with the same trigger, then explore the platform on
  staging in the browser like a real person. Use the project Playwright MCP
  for the workflow, with narrow reads.
- Standing rules: no Create a Deal row that maps Expected Close Date. A run
  is complete when the Emails tab shows Sent, then wait 15 s, check the CRM
  first and open Logs only if the record is missing. Error is asked about,
  not assumed a failure. Known issues are not re-filed. Test data is
  realistic and never renamed to make the product pass.
- Regression: use `automation/test-cases/_SCENARIO_TEMPLATE.md` for the
  format. Smoke: use the format of `notes/production-testing/01-email-opened.md`.
- Run no-ai-slop QA Test Case Mode on the file.
- Show it as rendered text, not a code block. **Stop and wait for QA's
  "looks good".** Then save it to the path for the mode. In smoke mode, add
  the row to the README table of `notes/production-testing/`.

## 2. Script (only after "looks good")

- Hand-write the spec at the path for the mode, in the style of the existing
  specs on that platform. Reuse the Saleshandy steps, the page objects in
  `src/pages/<platform>/` and the flow in `src/flows/saleshandy-to-<platform>.ts`.
  Explore the platform only for what is missing, and add it to the shared
  page objects. Do not duplicate.
- Create the CSV under `automation/test-data/<platform>/`.
- Keep specs short. Respect `SEND_CAP`. Regression: fix wrong sender interval
  and limits on staging yourself, then verify after reload. Smoke: do not
  change production settings. Ask QA.
- Run once to learn the errors. Fix script failures. Rerun only failed or
  unrun rows with `KEEP_TEST_DATA`. Never rerun the whole suite. QA runs the
  full script. Smoke: QA runs it on production, and you do not run it there
  yourself unless QA asks.
- Product failures: note them in `automation/context/<platform>/<workflow>-progress.md`,
  keep running, QA reviews later. Do not open `report.html`.

## 3. Throughout

- No unnecessary stops once data is given.
- Short, factual status. No recaps.
- Keep the progress file and RESUME.md current so another session can resume.
- Notify QA (`PushNotification` and `notify-send`) only when blocked or when
  a run QA waits on ends.
- At 120K tokens: stop subagents, ask QA to switch model and `/compact`.
- Mistakes QA corrects: use `learn-from-mistake`, propose the change, apply
  only after QA's OK.
