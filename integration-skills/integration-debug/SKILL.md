---
name: integration-debug
description: Use when the user asks to debug, fix, or investigate a Pyxis integration/automation workflow (HubSpot, Saleshandy connector actions, DNC, prospect sync, etc.) — gathers workflow JSON + logs + API docs first, root-causes via brainstorming, writes the fixed full workflow JSON to integration-jsons/, double-verifies it, and reports the diff plus a /lavish plan.
---

# Integration Debug

Debugging workflow for Pyxis automation workflows (the visual node-graph workflows that call HubSpot, Saleshandy, and other connector actions). Triggers on requests like "debug this workflow", "why is this integration failing", "this workflow errored", or pasted Pyxis error logs/curl output.

## Non-negotiables (user rule)

- **"Verify" means offline only. Never run anything live without asking.** Verification is
  reading and diffing JSON, running code nodes locally on sample data, and checking the catalog.
  Never open Pyxis, HubSpot, run logs, or any browser tab, and never import, trigger, or test a
  workflow unless the user explicitly asks for that specific action first. Ask before every such action.

## Process

### 1. Always use `superpowers:brainstorming` first
Even though this is debugging, not greenfield design — invoke `superpowers:brainstorming` before proposing a fix. Root-causing a workflow bug is a design decision (which node, which field, which template expression is wrong) and deserves the same "understand before acting" discipline. Keep it short for a scoped bug: state the diagnosis as the "design", get a one-line confirmation, then proceed. Don't skip it just because the fix looks obvious.

### 2. Ask for details — do not guess
Never fabricate node IDs, trigger event slugs, action IDs, or API schemas. If the user hasn't already provided them in-message, explicitly ask for whichever of these are missing:

- **The full current workflow JSON** (not a snippet — the whole exported workflow). Partial JSON hides side effects a fix might cause elsewhere.
- **The exact error payload** from the Refold/Pyxis run log for the failing node: `node_id`, `input_data` (resolved request), `body` (the error response), and `parsed_request_curl` if available. The curl is gold — it shows exactly what was sent, post-template-resolution.
- **The target API's actual documented schema** for the endpoint being called (request body shape, required fields, response codes) — from Swagger/OpenAPI docs the user pastes, or a link/description of the expected shape. Never assume a schema from memory.
- Anything else needed to reproduce the failure (e.g. which trigger event slug is correct per the platform's trigger picker, whether a referenced node id exists elsewhere in the same JSON).

If Pyxis platform credentials or a live log URL get shared to unblock this, treat them as sensitive — use them only for the specific lookup requested, don't persist them anywhere in written files (workflow JSON, plans, or skill files), and don't take further actions with them beyond what's needed to diagnose.

### 3. Root-cause precisely
For the failing node, trace backward through every `{{node.X.body...}}` / `{{workflow.fields...}}` template reference feeding its `input_data` until you reach a concrete value. Compare:
- What the curl/log shows was actually sent, vs.
- What the target API's schema says it expects.

Common failure classes seen in this codebase's workflows so far:
- **Double-wrapping**: an upstream code-executor node already returns the full request body; a downstream node re-wraps it again, producing nested objects where the API expects arrays (or vice versa).
- **Missing trigger events**: a workflow named/expected to handle multiple event types (e.g. "created AND updated") only registers one trigger.
- **Template syntax mismatch**: this platform's array-index templating is `{{node.X.body.payload.0.id}}` (dot-numeric-index). Bracket-index forms like `{{(node.X.body.payload[0].id)}}` are inconsistent with every other working reference in these workflows and are a strong signal of an unresolved/broken template — check whether the field silently resolved to empty/default (e.g. an ID defaulting to `0`) instead of erroring loudly.
- **Wrong nested path**: reading `.result` when the upstream node already returns the value unwrapped, or vice versa (compare the actual `return` statement of the upstream `codeexecutornode`'s function body — don't assume the wrapper shape).

State the root cause in one or two sentences before touching any file, and confirm it explains the *exact* error observed (not just "looks wrong").

### 4. Fix with zero side effects
Change only the specific field(s) causing the reported error. Do not:
- Touch unrelated nodes, rules, or field mappings "while you're in there"
- Rename, reformat, or reorder anything else in the JSON
- Add speculative validation, retries, or defensive fallbacks not asked for

### 5. Write the full corrected JSON
Save the **entire** workflow JSON (every node, every edge, unchanged fields included verbatim) to `integration-jsons/<workflow-name-kebab-case>.json` in the repo root. Never write a partial JSON or a diff-only file there — the file must be directly re-importable into Pyxis as-is.

### 6. Verify twice
1. **Syntax + structural check**: parse the written file as JSON: `python3 -c "import json; json.load(open('integration-jsons/<file>.json'))"`. Then diff node/edge counts and confirm every field except the intended fix(es) is byte-identical to the input JSON (e.g. compare each node's `input_data`/`triggers` programmatically, not by eye).
2. **Semantic re-check against the error**: re-read the fixed field(s) against the API schema and the original error message one more time, independently of step 1, and confirm the new value would actually produce a request/response matching what the API expects. State explicitly which part of the original error this resolves.

Report both verification results to the user — don't just say "verified," show what was checked.

### 7. Report the changes
In chat, list every changed field as a before → after pair (node id, field name, old value, new value), plus a one-line reason for each. Be explicit that nothing else in the file changed. Be honest about confidence: structural/logical verification is not the same as a live run — say so, and suggest the concrete test steps (re-import, trigger the event, check the run log) that would give real confirmation.

### 8. Always produce a `/lavish` plan
After the fix is written and verified, build a Lavish HTML artifact (per the `lavish` skill) that shows:
- What was broken and why (root cause, in plain terms)
- Before/after diff of the exact fields changed (use the `code` playbook / `@pierre/diffs` for real diff rendering, not prose)
- Confirmation that no other node/field changed (blast radius)
- Verification steps to run against the live workflow

This applies every time this skill fixes something — not just on request.

## Non-goals
- Don't guess at Pyxis's internal schema, trigger catalog, or connector behavior. If something can't be confirmed from the pasted JSON/docs/error, ask.
- Don't "helpfully" refactor adjacent nodes, add error handling nodes, or restructure the graph — scope is the reported bug only, unless the user asks for more.
