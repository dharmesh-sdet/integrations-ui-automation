# Project restructure design (integration QA automation)

**Date:** 2026-10-24  
**Owner:** Dharmesh (QA)  
**Status:** draft — awaiting QA approval before any code move  
**Runtime:** Claude Code (Cursor is handoff only)

## Intent

Cut the cost of adding a new CRM (Pipedrive, Zoho, next) so Salesforce-level pain does not repeat: CRM page objects rebuilt from scratch, Saleshandy setup re-explained every time, and a long heal loop after the first script.

Success looks like: agent explores the live product, writes a “how it works” context, QA reviews regression cases, then scripts are generated, run, and healed — while reusing Saleshandy code and keeping Claude Code token use low.

## Goals (from QA)

1. **Agent explores.** For a new CRM, the agent walks staging (Saleshandy integration + CRM), then reports findings as “this is how the product works.” QA corrects that report; it becomes approved context.
2. **Two hard gates only.** (A) context approved. (B) regression test cases approved. After (B), agent generates scripts, runs them, and heals script failures without waiting per step.
3. **Reuse Saleshandy.** Sequences, prospects, Send now, Triggers & Activity, Logs, field mapping, DNC — shared across HubSpot / Salesforce / Pipedrive. New work is mostly the CRM side + thin CRM-specific glue.
4. **Token-cheap Claude Code.** Progress files, pointer docs, cheap subagents (sonnet planner/generator/healer, haiku for lookups), compact at ~120K, never re-paste Saleshandy product knowledge that already lives in `knowledge-base/` and `src/pages/saleshandy/`.
5. **Ask only when context is missing.** One batched question round with defaults; then work.

## Non-goals

- Big-bang rewrite of HubSpot or Salesforce specs that already pass.
- New frameworks, test runners, or abstractions beyond what this design names.
- Agents inventing expected product behaviour without a staging walkthrough or QA confirm.
- API-level verification (project stays UI-only).
- Cursor replacing Claude Code as the primary authoring runtime.

## Anti-goals (failure even if tests eventually pass)

- Re-explaining Saleshandy on every new CRM.
- Copy-paste of `hubspot-integration.page.ts` / `salesforce-integration.page.ts` into a third near-duplicate for Pipedrive.
- 60+ row specs generated before a scope check (lesson: Unsubscribed AL-4015).
- Heal loop that bends expected results or renames test data to make the product “pass.”

## Constraints (existing rules still win)

- `plan.md` section 0.
- Selectors only from a real page (Playwright MCP / project browser).
- Staging standing approvals as today; production and Jira still need QA.
- `SEND_CAP`, `KEEP_TEST_DATA` / `TEST_DATA_ONLY`, progress files current.
- Salesforce exception: hand-written specs (memory) until QA lifts it; new CRMs follow planner/generator/healer via `ui-test-from-workflow`.

## Current pain (evidence in repo)

| Area | What exists | What hurts |
|---|---|---|
| Saleshandy pages | `sequence`, `crm`, `field-mapping`, plus **per-CRM** integration pages (HubSpot 229 lines, Salesforce 328, Pipedrive stub 51) | Triggers/Logs/Extra Config patterns duplicated per CRM |
| Flows | `saleshandy-to-hubspot.ts` (rich shared flow), thin `saleshandy-to-salesforce.ts`, stub `saleshandy-to-pipedrive.ts` | HubSpot learned the reuse pattern; Salesforce mostly did not share it |
| Context / KB | Per-integration context + `knowledge-base/testing/reusable-building-blocks.md` | Checklist exists but agents still re-discover Saleshandy |
| Pipeline | `ui-test-from-workflow` stages 1–4 | Stage 1 often skips a crisp “product findings” gate; tokens burn re-reading large specs |

## Target shape

### A. Code: split “Saleshandy core” vs “CRM adapter”

```
automation/src/
  pages/
    saleshandy/
      core/                    # shared: sequence, crm, field-mapping, dnc, saleshandy shell
      integrations/
        triggers-activity.page.ts   # generic Triggers & Activity + Logs (integration name/url param)
        hubspot.ts / salesforce.ts / pipedrive.ts   # only CRM-specific deltas
    hubspot/ | salesforce/ | pipedrive/   # CRM app pages only
  flows/
    saleshandy/
      send-and-logs.ts         # add prospect, Send now, wait Logs Success (CRM-agnostic)
      trigger-isolation.ts     # enableOnly / save / toast
      activity-rows.ts         # keep; CRM-agnostic row helpers where possible
    <crm>/
      expect-record.ts         # CRM-specific asserts (contact/deal/person/…)
      fire-event.ts            # open/click/bounce/reply helpers for that CRM’s workflows
```

Rule: a new CRM may add `pages/<crm>/` + thin `pages/saleshandy/integrations/<crm>.ts` + `flows/<crm>/`. It must not fork sequence/send/logs.

Migration: extract generics **behind** existing HubSpot/Salesforce imports (re-export wrappers) so passing specs keep working; delete duplicates only after a green smoke on one HubSpot + one Salesforce workflow.

### B. Context: fixed “product findings” artifact

Per new CRM (and per workflow when behaviour differs):

1. Agent explores staging (read-only except standing staging approvals).
2. Writes `context/<crm>/FINDINGS.md` (and workflow files) in a fixed template:
   - Screens and URLs seen
   - Trigger list and activity list in UI order
   - How each trigger event is fired
   - Sync wait (Logs cadence)
   - Field mapping notes
   - Unclear items marked **proposed, unconfirmed**
   - Evidence: screenshot paths under `context/<crm>/evidence/`
3. **Gate A:** QA signs off FINDINGS (and overview). No scenarios until then.

Saleshandy product facts stay in `knowledge-base/product/saleshandy.md` and page objects — agents **link**, do not re-narrate.

### C. Process: tighten `ui-test-from-workflow` for Claude Code

| Stage | Deliverable | Stop? | Token rule |
|---|---|---|---|
| 0 Bootstrap | Account, login, env entry, empty `pages/<crm>/`, pointer file `context/<crm>/RESUME.md` | Only if login/account missing | Haiku/read-only for lookups |
| 1 Explore | `FINDINGS.md` + evidence | **Always — Gate A** | Main model explores; write file; compact after |
| 2 Scenarios | `test-cases/<crm>/<slug>.md` via planner + template check | **Always — Gate B** (regression review) | Planner = sonnet; pass paths not file dumps |
| 3 Script | Generator → POM + spec reusing Saleshandy core + CRM adapter | No (unless scope > ~30 rows / 3h) | One row at a time; reuse flows |
| 4 Run + heal | Healer on script failures; product failures logged | End of run: one batched product question | Healer = sonnet; 2 attempts; never bend expect |

Change vs today: Gate A is mandatory; Gate B is mandatory for regression (QA asked). Do not auto-continue past scenarios when “check passed.”

### D. Token optimization (Claude Code)

1. **Pointer files, not chat memory.** `HANDOFF.md`, `context/<crm>/RESUME.md`, `*-progress.md` — next session reads files, not prior transcript.
2. **Read budgets.** Agent reads: FINDINGS + this workflow context + one approved sibling case + `reusable-building-blocks.md` + the Saleshandy core API surface (short). Not entire HubSpot/Salesforce specs.
3. **Subagent models.** Planner/generator/healer = sonnet; file lookups = haiku. At ~120K: notify, stop subagents, ask `/model` + `/compact` (existing memory).
4. **Shared Saleshandy kit doc.** One short `knowledge-base/testing/saleshandy-core-api.md` listing exported flow functions and page methods agents must call — so they do not open 300-line page objects “to discover.”
5. **No whole-repo in one session.** Phases below; each phase ends with files updated and a one-line resume.

### E. Dry run of expected functionality

That is Stage 1 (Explore → FINDINGS). It is not a separate product. QA’s review of FINDINGS **is** the dry-run sign-off of expected behaviour before cases exist.

## Phased delivery (no big bang)

### Phase 0 — Inventory and contracts (docs only, 1 session)

- List Saleshandy methods HubSpot specs actually call vs Salesforce.
- Draft `saleshandy-core-api.md` (contract).
- Update `reusable-building-blocks.md` checklist for “new CRM = adapter only.”
- Update `ui-test-from-workflow` skill text for Gate A / Gate B and token rules.
- **Prove:** QA reads contract; no code moved yet.

### Phase 1 — Extract Saleshandy core behind wrappers

- Generic Triggers & Activity + Logs page (parameterised by integration).
- `flows/saleshandy/send-and-logs.ts` from the better of HubSpot/Salesforce helpers.
- HubSpot + Salesforce keep working via thin re-exports.
- **Prove:** rerun one HubSpot staging workflow subset + Salesforce Email Sent smoke path (or smallest green suite QA names). Do not touch Pipedrive specs yet.

### Phase 2 — Pipedrive as the reference new CRM

- Stage 0–1 on Pipedrive Email Sent (agent explore → FINDINGS → Gate A).
- Gate B regression cases.
- Scripts using core + `pages/pipedrive/` + thin pipedrive integration adapter.
- Run + heal.
- **Prove:** Pipedrive Email Sent green on staging without re-teaching Saleshandy in chat.

### Phase 3 — Roll forward

- Same pipeline for remaining Pipedrive workflows, then Zoho.
- Optionally migrate Salesforce specs onto shared core when touching them (not a mandatory rewrite).

## What builders may decide without asking

- Exact file names under `pages/saleshandy/core/` and `integrations/`.
- Whether generic Triggers page is one class with `integration: 'hubspot' | …` or a small base + subclasses.
- Order of extracting methods (Logs first vs Extra Config first).

## What still needs QA (only if it changes the build)

Already decided by this design unless QA overrides:

- Gate A and Gate B always on.
- Agent explores; QA does not drive discovery.
- No whole-repo rewrite in one go.
- Claude Code is the authoring runtime; token rules above.

## Approval

Reply **approve** (or list edits). Implementation starts at Phase 0 only after that — not a whole-repo fix in one shot.
