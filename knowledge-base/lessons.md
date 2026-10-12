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
