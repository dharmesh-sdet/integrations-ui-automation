---
name: integration-enhance
description: Use when the user asks to proactively scan, audit, or "enhance" a Pyxis integration/automation workflow JSON (HubSpot, Saleshandy connector, DNC, prospect sync, etc.) against known recurring bug patterns — even with no reported error. Checks the workflow against a memorized catalog (references/common-bugs.md), classifies each finding as safe-to-propose vs needs-user-input, and produces a /lavish plan for approval before writing any fix. Never applies a fix without approval.
---

# Integration Enhance

Proactive pattern-based bug sweep for Pyxis workflow JSONs. This is the *catalog-driven*
sibling of `integration-debug` (which is *reactive* — triggered by a specific reported
error + logs). Use this skill when the user wants a workflow checked for known recurring
issues without necessarily having hit one yet — "enhance this workflow", "check this
workflow for common bugs", "audit this JSON before we promote it to production".

## Non-negotiables

- **"Verify" means offline only. Never run anything live without asking.** Verification is
  reading and diffing JSON, running code nodes locally on sample data, and checking the catalog.
  Never open Pyxis, HubSpot, run logs, or any browser tab, and never import, trigger, or test a
  workflow unless the user explicitly asks for that specific action first. Ask before every such action.
- **Never apply a fix without approval.** Every finding gets proposed in a `/lavish` plan
  first. Write nothing to `integration-jsons/` until the user explicitly approves.
- **Never guess.** Node IDs, field schemas, which CRM properties are actually read-only,
  which backend PRs are merged/deployed — if it's not confirmable from the JSON, the
  catalog, or something the user tells you, ask.
- **Never hardcode an API URL/host in a workflow — ever.** No `base_url`, no full URL, no
  gateway host (`pyxis-open-api-gateway...`, `lifeisgoodforlearner.com`, prod hosts) typed into
  any node. Saleshandy-side calls always go through an **existing Saleshandy connector action**
  (`type: "custom"` + `action` id), e.g. DNC/blacklist uses `Blacklist a Domain`
  (`Blacklist Domains (Bulk)`, `action_operation_id: blacklist_domains_bulk`, body `{ "items": "{{domains}}" }`, `domains` = array; the old `Blacklist a Domain` / `blacklist_a_domain` takes ONE string only — body `{ "items": ["{{domains}}"] }`, an array makes `[[...]]` → 400). If no existing action
  can do the job, **stop and tell the user to create a new connector action**, and hand them the
  full spec needed to create it (catalog #43). Never work around a missing action with a raw
  `httprequest`. Flag any hardcoded host you find as a blocker (catalog #43).
- **Zero unrelated changes.** Only touch fields the catalog identifies as a match. Don't
  reformat, reorder, rename, or "improve" anything else while in there.
- **Never overwrite the original file.** Output always goes to a new
  `integration-jsons/<name>-enhanced.json` — the existing file in that folder is the
  current known-good version and stays untouched.

## Process

### 1. Get the target workflow JSON
Accept either a pasted full JSON or a file path/filename — including files already in
`integration-jsons/`. If neither is given, ask. Never accept a snippet; a partial JSON
hides side effects a fix might cause elsewhere in the graph.
**What the user pasted is the baseline, not the copy in `integration-jsons/`.** Saved copies
go stale (catalog #41). Save the paste verbatim by extracting it from the session transcript
`.jsonl` (never retype it) as `integration-jsons/<name>-current.json`. Before patching, check
that it has `config_fields` and `export_id`.

### 2. Load the bug catalog
Read `references/common-bugs.md` in this skill. It documents each known pattern, how to
detect it in a workflow JSON, and its tier (`auto` / `flag` / `ask`) — grounded in real
fixed-vs-broken workflow diffs and Jira ticket AL-3982 / its linked Confluence release
notes, not guesswork. Entries 16–24 plus the "Reference structure" section come from the
Deal-Created v1→v14 fix chain (triggers, loop wiring, bulk-vs-per-contact split, join
before loop, bulk DNC, AND/OR on negated rules). Entries 25–33 plus the v17 reference
structure come from the v15→v17 field-mapping work: how the Contact/Deal Properties maps
resolve, the per-field lookup order, cross-object fields (a deal/company property mapped
to a Saleshandy prospect field), the four-branch layout, and the "mapped field not
populated" diagnosis checklist (#31). Entries 35–41 come from the Email-Sent
(Saleshandy → HubSpot activity) round: raw-HTTP create bodies, update lookups that search by the
value being changed, date-only HubSpot datetimes, sibling template typos, note associations,
the parallel contact-create race, and the verbatim-baseline + self-checking patch-script
process. That section also lists behaviours the user **accepted**; never re-flag those. If you learn about a *new* confirmed recurring pattern during this
session (the user tells you about a ticket, a real fix, a root cause), append it to that
file in the same format before finishing — that's how the catalog stays current.

### 3. Brainstorm-confirm scope (lightweight)
Per `superpowers:brainstorming`'s spirit — even a catalog sweep is a design decision
(which patterns actually apply, which are false-positive matches on this specific
workflow's structure). Before proposing fixes, state in one or two sentences which
catalog entries you found matches for and why, and get a quick go-ahead to proceed to
the full write-up. Don't skip this because the catalog makes matches look obvious —
a pattern matching syntactically doesn't always mean it's actually broken in context
(e.g. a duplicated ActionN slot might be intentional if that slot is genuinely unused
in this specific workflow's configured actions).

### 4. Scan systematically
Walk every node in the JSON against every catalog entry. For each match, record:
node id, node name, the exact field(s), which catalog entry, and its tier.

Then do a graph-level pass, since node-by-node matching misses these:
- Start `triggers` against the workflow name (#16).
- Every `group` node: input key, `entry_node`, children's `parentNode`/`extent`, item
  reference, single incoming node (#17, #18, #20).
- If the trigger object can map to multiple contacts: compare against the catalog's
  "Reference structure" (bulk outside the loop, per-prospect-ID actions inside) (#19, #21).
- Rules whose conditions are all `neq`: check the operator is `AND` (#22).
- Field mapping (#25–#29): every node that reads `{{application.fields.* Properties}}`
  parses it (#28). Fetch lists come from the mapping plus the identity baseline only (#27).
  The trigger object's own record is fetched (#26). The mapping node looks up each mapped
  property on the contact **and** the trigger object (#25), skipping empty values (#29).
- Compare the branch layout against the v17 reference structure (four branches).
- For Saleshandy→HubSpot activity workflows (Start → 7 parallel action rules): check raw
  `httprequest` create bodies for `additional_fields` (#35), update lookups (#36), date
  transforms (#37), template paths against their siblings (#38), and note associations (#39).
- Any `base_url` / absolute URL / gateway host in any node: blocker, replace with the
  existing connector action or ask the user to create one (#43).
- Orphan nodes (no incoming and no outgoing edges): report only.

### 5. Classify and handle by tier
- **auto**: still shown in the plan, but framed as "safe, additive/defensive, doesn't
  change behavior for anything currently working."
- **flag**: shown with an explicit "this changes behavior" callout — state what starts
  happening that didn't before, and why the fix is still correct.
- **ask**: do NOT propose a specific fix yet. Ask the user directly for whatever's
  missing (the real read-only property list, the correct API-expected type/casing,
  confirmation a backend PR is deployed, etc.) before including it in the plan at all.
  If the user doesn't have the answer, list it in the plan as an open item requiring
  external info — don't fabricate a fix to fill the gap.

### 6. Build the `/lavish` plan
One HTML plan (via the `lavish` skill) covering, per finding:
- Catalog entry name + tier
- Node id/name + exact field
- Before → after (real diff, use the `code`/`@pierre/diffs` playbook, not prose)
- One-line reason it's correct, and — for `flag` items — what behavior changes
- For `ask` items still unresolved: what's needed from the user, listed as open questions,
  no proposed diff yet
- A summary section: total findings by tier, and explicit confirmation of what did NOT
  change (blast radius)

Present this and stop. Wait for the user to approve, reject, or amend individual findings
— accept partial approval (apply only the findings the user confirms, skip the rest).

### 7. Write only after approval
For approved findings only, write the complete workflow JSON — every node/edge/field
included verbatim except the approved changes. Generate it with a patch script that checks
its own output (template: `references/email-sent-patches/apply_fix.py`, checks listed in
catalog #41), never by hand-editing. Write it to
`integration-jsons/<workflow-name-kebab-case>-enhanced.json`. Never touch the original
file in that folder.

### 8. Verify twice (same discipline as `integration-debug`)
1. **Structural**: `python3 -c "import json; json.load(open('integration-jsons/<file>.json'))"`,
   then confirm node/edge counts match the input and every field outside the approved
   changes is byte-identical.
2. **Semantic**: re-read each changed field against its catalog entry's stated fix one
   more time, independent of step 1, and confirm it actually resolves what the catalog
   entry describes.

Report both checks explicitly — show what was checked, not just "verified."

### 9. Report
List every applied change as a before → after pair with its catalog entry and reason.
State explicitly what was skipped (rejected findings, or `ask`-tier items still open)
and why. Be honest that structural/logical verification isn't the same as a live Pyxis
run — suggest concrete next steps (re-import the `-enhanced.json`, promote to test
environment, trigger the real event, check the run log).

## Relationship to sibling skills
- `integration-debug`: reactive, one specific reported error + logs → root cause → fix.
  Call it directly if the user already has a concrete failing run to diagnose instead of
  a general "check this workflow" ask.
- `integration-testing`: live API-driven pass/fail testing (no browser). Runs this skill's catalog
  sweep as its static audit before triggering anything, and hands off to
  `integration-debug` on a confirmed bug. If this skill's proposed fix needs live
  verification beyond structural/semantic checks, suggest `integration-testing` as the
  next step rather than attempting to simulate a live run.

## Non-goals
- Don't diagnose patterns explicitly marked out-of-scope in `references/common-bugs.md`
  (currently: sibling-branch node coupling, apart from the race described in #40, which is
  report-only). Closing-date off-by-one is now in scope (#37).
- Don't refactor, restructure the graph, or add nodes/error-handling beyond what a
  matched catalog entry calls for.
- Don't treat a syntactic pattern match as a confirmed bug without the tier-appropriate
  scrutiny in step 5 — false positives are possible, especially for `flag`-tier matches.
