# Improvement plan: faster test runs and a faster workflow process

Written 2026-10-08, after the first workflow (Contact Updated in HubSpot).
Use it once Contact Updated passes a full run. Nothing here is built yet;
each item needs QA's go-ahead before it is done.

## 1. Where we are

Time spent so far (from session timestamps, QA review time included):

| Phase | When | About |
|---|---|---|
| Base structure (folders, config, logins, MCP) | Wed 7 Oct, 17:34 to 18:23 | 50 min |
| Planning, QA answers, plan updates | Thu 8 Oct, 09:24 to 10:37 | 1 h 15 min |
| `ui-test-from-workflow` skill and layout | Thu 8 Oct, 10:55 to 11:10 | 15 min |
| Contact Updated workflow (context, scenarios, walkthrough, spec, first run, fix) | Thu 8 Oct, 11:10 to 12:50 | 1 h 40 min |

About 4 hours to the first workflow. Much of the 1 h 40 min was one-time
work: learning the HubSpot create form, Triggers & Activity, Logs and CRM,
and settling rules (no name prefix, no unnecessary stops, Logs timing).

Estimates for the next workflows with the current process:

| Workflow type | Estimate | Why |
|---|---|---|
| HubSpot-side trigger using only screens we already have | 30 to 45 min | Scenarios plus a short walkthrough |
| First Deal or Company Created (first one with activities) | 1 to 1.5 h | New: HubSpot deal or company form, activity selection and its Extra Configuration modal, sequences or Latest Status in Saleshandy |
| Later ones of the same type | 30 to 45 min each | Reuse those page objects |
| First Saleshandy-side trigger (Email Sent, Reply, Outcome) | 1.5 to 2 h | New: making the event happen in Saleshandy, and checking HubSpot contacts, deals, notes and tasks |
| Later ones of the same type | 45 min to 1 h each | |

Each workflow also needs one or two run-and-fix rounds of about 10 to 15
minutes of run time.

## 2. Why the test runs are slow

Timings from the first run of Contact Updated:

| Test | Time | Where the time goes |
|---|---|---|
| Baseline (turn trigger on, Save) | 26 s | Page loads |
| Row 1, per contact | about 90 s | About 60 to 75 s waiting for Refold to bring Logs to Success |
| Row 2, per contact | about 90 s | Same Refold wait |
| Row 3 | about 90 s | Same Refold wait |
| Row 4 | about 75 s | 45 s deliberate wait to prove "no new log entry", plus the CRM check |

A run is about 10 to 12 minutes, and about 70% of it is waiting on Refold.
The wait is paid once per action, one after another, because:

1. Tests in a workflow run in order (QA rule), so each contact's wait adds up.
2. Every test opens new browser sessions and loads HubSpot and Saleshandy
   from scratch (about 5 to 10 s per test).
3. A full CRM search runs after every action.

Faster polling of Logs does not help: Refold sets the pace, not the refresh
rate. The current cadence (15 s, then every 10 s) stays.

## 3. Faster test runs

Biggest gain first.

| # | Change | Saves | Trade-off |
|---|---|---|---|
| R1 | Do all actions for a row first (e.g. create both contacts), then wait for Logs once | About 1.5 min per extra contact per row; a 2-contact run goes from about 11 to about 7 min | None, same checks |
| R2 | One logged-in browser session per workflow file, not per test | About 1 min per run | None |
| R3 | Row 4 "nothing happens" window from 45 s to 30 s | 15 s | Entries always appeared within about 15 s, so still safe |
| R4 | 1 contact per run for routine regression, 2 for a fuller run | About 3 min | Less "works for more than one contact" coverage on routine runs |
| R5 | Run workflows in parallel | Total time of all workflows becomes the time of the slowest one | Clashes with "turn other triggers off first": workflow A would turn off workflow B's trigger mid-run. Needs separate Saleshandy test accounts per workflow (cleanest), or each workflow touching only its own trigger |

Suggested: R1, R2 and R3 now; R4 as a run option; R5 once QA decides how to
keep triggers separate.

## 4. Faster workflow process

### 4.1 Fewer round trips (biggest saving)

| # | Change | Removes | Saves per workflow |
|---|---|---|---|
| P1 | Claude runs the spec itself on staging, fixes, reruns (still stops after 2 failures of the same thing, plan rule 9). QA reviews the final result. Needs a one-line change to plan rule 7 | The "QA runs, pastes back, Claude fixes, QA reruns" loop | 20 to 40 min of waiting |
| P2 | A "Test data and defaults" section in each workflow context: contacts per run, fields to update, expected log name, triggers to turn off | Most questions before scenarios and the walkthrough | 10 to 15 min |
| P3 | Standing defaults in `automation/context/project.md`: 1 contact per run, update City, Company name and Job title, log names as shown on the page | The same questions every workflow | 5 min |
| P4 | QA sends 2 or 3 workflow contexts at once; one question round and one scenario review for all | A question round and a review round per workflow | 10 to 20 min |

### 4.2 Explore each screen once

| # | Change | Effect |
|---|---|---|
| P5 | One walkthrough of all 9 HubSpot-side activities and the Extra Configuration modal (on a scratch trigger, turned off again afterwards), built into one page object | Deal, Company and Contact Created become mostly spec writing |
| P6 | Screen catalogue `automation/context/hubspot/screens.md`: screen, page object, methods | New workflows start from it; the browser is only opened for screens not in it |
| P7 | Shared steps in `automation/src/flows/`: enable a trigger, wait for new logs to reach Success, check a prospect | A new spec is 40 to 60 lines that read like the scenario table |

Together P5 to P7 take the first HubSpot-side workflow with activities from
about 1 to 1.5 h to about 45 min, and later ones to about 20 to 30 min.

### 4.3 Faster feedback while building

| # | Change | Effect |
|---|---|---|
| P8 | Quick 1-contact check first (about 3 min) to prove locators, then the full run | Locator failures show up in 3 min instead of 12 |
| P9 | Fail at once when a new log entry shows Error, instead of waiting out the 3-minute limit | Saves up to 3 min per failed check |
| P10 | Recognise each platform's login page (open TODO in `automation/src/pages/base.page.ts`) | An expired session fails at once with "run npm run login:<platform>" instead of looking like a broken test |

### 4.4 Later

| # | Change | Effect |
|---|---|---|
| P11 | Nightly scheduled run (already in `plan.md` for weeks 2 to 4) | Nobody waits on regression in the daytime; QA reviews the morning report |

## 5. Expected result

| | Now | With 4.1 and 4.2 | With everything |
|---|---|---|---|
| New workflow, screens already mapped | 30 to 45 min | 20 to 30 min | 15 to 20 min |
| New workflow, new screens | 1 to 2 h | 45 min to 1 h | 30 to 45 min |
| QA hands-on time per workflow | About 45 min | About 15 min (review scenarios, review result) | About 10 min |
| One regression run | About 11 min | About 11 min | About 6 min, workflows in parallel |

## 6. Order to do it in

1. Now, cheap and big effect: P1 (with the plan rule 7 change), P3, P2.
2. Before the next workflow: P5, then P6 and P7.
3. When convenient: R1, R2, R3, P8, P9, P10.
4. Later: R5 (separate Saleshandy accounts), P11.

## 7. Before starting

- Contact Updated in HubSpot passes a full run (Ingrid Valtonen and Mateo
  Quiroga are the next CSV contacts).
- QA picks which items to do. Any item that changes a rule (P1 changes plan
  rule 7; R5 changes the "turn other triggers off first" rule) needs QA's
  explicit OK.
