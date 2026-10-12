---
name: integration-testing
description: Use when the user asks to test, verify, or run a Pyxis/Refold integration workflow live (HubSpot, Salesforce, Zoho, field mapping, prospect sync, DNC, email-sent triggers, etc.) — audits the workflow JSON first (no hardcoded Saleshandy URLs, only validated connector actions, type-safe field mapping), triggers real events with direct API calls (no browser), reads execution logs from the log URL / Refold API, collects ALL bugs in one full pass, fixes them together in the next numbered version file, and root-causes non-JSON bugs in saleshandy-edge / saleshandy-webui code.
---

# Integration Testing

Live end-to-end testing of Pyxis/Refold automation workflows, **API-only** — no Playwright, no
browser. Every action the Saleshandy web app or the CRM UI would do is done with a direct HTTP
call (curl), using the endpoints in `references/saleshandy-web-apis.md` and the CRM's REST API.
This skill is the *testing loop*; it uses `integration-enhance` (catalog audit) before testing and
`integration-debug` (fix rules) after. Triggers on "test this workflow", "check if the
Salesforce/HubSpot/Zoho integration works", "test again", a pasted log URL, etc.

## Non-negotiables

- **Never guess** a URL, endpoint, payload, workflow name, workflow JSON, token or API schema.
  Saleshandy endpoints come only from `references/saleshandy-web-apis.md` (filled from the API doc
  the user gives). Missing endpoint → ask for it, then add it to that file.
- **No browser.** Don't use Playwright, jev-ultrafast or any UI driving. If something truly can't be
  done by API, say so and ask the user to do that one step by hand.
- **One workflow at a time, ALL bugs per workflow in one pass**: run every scenario first, log every
  bug, fix nothing mid-pass. Then fix all of them together in one new version, then full regression
  retest. Only exception: a blocker (trigger never fires, auth fails) → report immediately.
- **Never touch what's already working.** Fixes are scoped to the logged bugs only.
- **No open questions in a version file or its report.** Everything that needs the user's answer
  (structural changes, `ask`-tier catalog items, new connector actions) is asked in chat *before*
  writing `vN+1`. The written version and its `/lavish` report are complete and final.
- **Structural changes need an explicit yes.** Adding/removing/rewiring nodes or edges, new
  branches, deleting orphan nodes, changing what a branch creates, or changing which record a
  lookup matches = structural. Ask once per change with *why* and *what changes in behaviour*.
  Field-level fixes inside an existing node are not structural.
- **Never hardcode a Saleshandy API URL/host in a workflow** (catalog #43). Saleshandy calls go
  only through validated connector actions (see step 3).
- **Not every bug is a JSON bug.** Edge, webui, Refold platform, CRM config or test setup → say so
  with in-depth reasoning (step 8).
- **Secrets** (Saleshandy JWT/API key, Refold/Cobalt token, CRM tokens) are never written into any
  repo file, log, plan, run file or JSON. They live only in
  `~/.config/sh-integration-testing/<env>.env` (outside the repo, `chmod 600`). Ask the user to
  create/update it themselves with a `! ` command so the token never appears in chat. Every call
  loads it with `set -a; . ~/.config/sh-integration-testing/<env>.env; set +a`. Strip
  `Authorization`/`x-api-key` headers before saving any response.
- **Live call pace.** Before each scenario, show its call plan (method, path, body, expected result)
  and get one go-ahead for that scenario. Then run its calls, show results, and stop before the next
  scenario. Never run retry/poll loops unattended, except a bounded poll of the *read-only*
  execution-list endpoint (max 10 tries, 15 s apart) waiting for a run to appear.

## Workflow directions

Every workflow is one of two shapes. Identify it from the trigger before anything else.

| Direction | Trigger | Actions | Reference structure |
|---|---|---|---|
| **SH → CRM** | Saleshandy event (email sent / opened / link clicked / replied / prospect status, …) via the Saleshandy connector | Create/update CRM contact, company, deal, note, task, activity | HubSpot `integration-jsons/email-sent-from-saleshandy-latest-assoc-fixed.json` / `link-is-clicked-in-saleshandy-latest-assoc-fixed.json`: Start → parallel action rules, each "find → exists? → update : create". Catalog #35–#45 |
| **CRM → SH** | CRM record created / property changed (contact, company, deal, …) | Import/upsert prospect, add to sequence, DNC/blacklist, unsubscribe, tag, status | HubSpot Deal-Created v17 four-branch shape — catalog "Reference structure" + #16–#34 |

Salesforce/Zoho workflows mirror the HubSpot ones: compare node-by-node against the HubSpot
reference of the same direction and event. Differences that aren't explained by the CRM's API
are suspects.

## Folder structure (every workflow, every version)

```
<repo-root>/integration-tests/
  <crm>/<env>/<workflow-slug>/          # crm: hubspot|salesforce|zoho, env: staging|production
    v1-original.json                    # verbatim what the user sent (extract from session jsonl, never retype)
    v2-<short-fix-name>.json            # one full re-importable JSON per fix round, never overwrite
    v3-<short-fix-name>.json
    test-log.md                         # audit findings, scenario matrix, per-version pass/fail, bug list, changelog
    runs/<timestamp>-<scenario>-<what>.json   # raw API responses (trigger calls, execution logs, CRM reads)
```

`test-log.md` has one `## vN` section per version: what changed from `vN-1` (one line per field),
the pass/fail table for that version's full run, and the bugs found. That gives the full history
v1 → vN in one place. Ask for `<crm>`, `<env>` and the workflow name if not obvious.

## Process

### 1. Confirm scope
Ask only for what's missing: env (staging/production) + Saleshandy base URL, CRM + its API base,
workflow name/JSON, the Refold app slug + workflow id, and what "correct" looks like when not
obvious. Check `~/.config/sh-integration-testing/<env>.env` exists and has the keys this run
needs (print the key *names* only, never values).

### 2. Save v1 and read the workflow BEFORE triggering
- Save `v1-original.json` verbatim (memory: pasted JSON → extract from the session `.jsonl`).
- Direction (SH → CRM or CRM → SH), trigger = WHEN it fires, each action = WHAT happens and WHERE.
- Write the **scenario matrix** into `test-log.md`: every action × realistic variants (new vs
  existing record, with/without associated company/deal, empty vs filled optional fields, special
  chars, re-trigger/idempotency, update vs create path, every branch/rule in the graph). Every branch
  must be covered by at least one scenario.

### 3. Static audit (offline, before any live call)
Run the `integration-enhance` catalog sweep on v1 (its steps 2–5), plus these checks. Each finding
goes into `test-log.md` under `## v1 → audit`.

1. **No hardcoded Saleshandy URL** — any `base_url`, absolute `http(s)://`, or Saleshandy/gateway
   host in any node = blocker (#43).
2. **Only validated connector actions** — every Saleshandy call is a `custom` node with an `action`
   id + `action_operation_id` that appears in a known-good workflow of the same env
   (`integration-jsons*/`, earlier `integration-tests/` versions). Unknown action id, or a raw
   `httprequest` to Saleshandy → flag. If no existing action can do the job, write the full
   new-action spec from #43 (name, operation_id, method, relative path, inputs with types, body
   template, response shape, backing edge controller/DTO `file:line`, create in staging *and*
   production) and give it to the user.
3. **Field-mapping types** (#46) — for every mapped field and every templated value sent to an API,
   the source type must match the target type. Build a table: source path → source type → target
   field → target type (from the Saleshandy DTO in edge, `list_fields`/prospect fields, or the CRM
   field metadata API) → OK/MISMATCH. Number ↔ string, boolean ↔ `"true"`, array ↔ scalar,
   date-only ↔ datetime, enum value not in the picklist → MISMATCH. Every mismatch is a bug.
4. **Field mapping exists on the CRM side** — every mapped CRM property exists, is writable, and
   picklist values are valid. Get the real field list by API (HubSpot
   `GET /crm/v3/properties/<object>`, Salesforce `GET /services/data/vXX.X/sobjects/<Object>/describe`).

Audit bugs count as found bugs of this pass. Don't stop the pass for them unless one blocks the
trigger.

### 4. Trigger for real, by API
Perform the exact real-world event, via the same API the UI would call — not a proxy.

**SH → CRM (Saleshandy-side trigger):** use `references/saleshandy-web-apis.md`.
1. Create one test sequence with an email step (or reuse the scenario's sequence).
2. Add a prospect whose email = the sending account's email with a `+suffix` — default
   `<your-name>+<crm>-<scenario>@<your-domain>` (e.g. `<your-name>+sf-c1@<your-domain>`) unless the user names
   another. New suffix per scenario so records are distinguishable in the CRM.
3. Activate the sequence; if the email doesn't send on its own, call the send-now endpoint.
4. Opened/clicked/replied events: use the endpoint listed for it; if none exists, ask the user.
5. Re-run: remove the prospect from the sequence, add it again, repeat.

**CRM → SH (CRM-side trigger):** create/update the record through the CRM REST API with the exact
fields the scenario needs (HubSpot `POST/PATCH /crm/v3/objects/<object>`, Salesforce
`POST/PATCH /services/data/vXX.X/sobjects/<Object>/<id>`). Changing a property for a
"property changed" trigger = PATCH that property only.

Save every request (minus auth headers) + response to `runs/`.

### 5. Read the execution
- **User gives a log URL** → extract the execution id from it and fetch the detail right away (below).
  Don't ask for screenshots.
- **No URL** → find the run: list endpoint filtered by `workflow_id` + `start_date` = trigger time.
- Refold API (same calls edge makes, `src/refold-workflows/services/refold-http.client.ts`):
  - list: `GET {base}/api/v2/public/execution?slug=<app slug>&workflow_id=<id>&page=1&limit=20&sort=-createdAt` (optional `status`, `start_date`, `end_date`)
  - detail: `GET {base}/api/v2/public/execution/<executionId>` — node-by-node input/output
  - header `Authorization: Bearer $REFOLD_TOKEN`; `{base}` defaults to `https://api.gocobalt.io` (`COBALT_API_BASE_URL`).
- Save raw responses to `runs/`. Extract with `jq`: per node → id, name, status, resolved
  `input_data`, response `body`, error. Don't eyeball big JSON.
- Read-only GETs are fine. State-changing Refold calls (import, publish, trigger, update) → ask first.

### 6. Verify each run in three places
1. **Execution log** — every node that should run did, with the expected input/output; no node
   ran that shouldn't (wrong branch).
2. **Target system by API** — re-read the record: CRM (`GET /crm/v3/objects/<object>/<id>?properties=…`,
   Salesforce SOQL `GET /services/data/vXX.X/query?q=…`) for SH → CRM; Saleshandy prospect /
   sequence / DNC endpoints for CRM → SH. Right object, right fields, right values, right types.
3. **Diff script** — a small node/jq script in the scratchpad that asserts expected vs actual per
   field and prints PASS/FAIL. That output is the evidence.

Record per action: `PASS` / `FAIL` + evidence (execution id, node id, run file). Before calling
something a bug, rule out a setup gap (empty required field, missing prerequisite record,
permission, connector not authorised). Setup gaps get fixed and retriggered, not reported.

### 7. Repeat 4–6 for every scenario in the matrix
Only then move on. The pass is done when every row of the matrix has a result.

### 8. Classify every bug by where the fix belongs

| Tag | Meaning | What to do |
|---|---|---|
| `JSON` | Workflow node/template/mapping/type in the JSON | Goes into the next version (step 9) |
| `ACTION` | Needed Saleshandy connector action doesn't exist / is wrong | New-action spec (#43) for the user |
| `EDGE` | saleshandy-edge code (`src/refold-workflows/`, `src/settings/integration/`, Cobalt event emitters, webhook payloads, public API DTOs) | `file:line`, faulty logic, proposed change. Don't edit without approval |
| `WEBUI` | saleshandy-webui code (`<path-to>/saleshandy-webui`, integration/settings screens, field-mapping UI) | Same as EDGE |
| `PLATFORM` | Refold/Pyxis platform behaviour | Evidence + what to report to Refold |
| `CRM-CONFIG` | CRM app/permissions/scopes/field settings | Exact setting to change |

In-depth reasoning per bug: observed symptom → data path end to end (trigger API → edge →
Kafka/Cobalt event → Refold workflow node → target API) → the exact point where expected and
actual diverge → why that causes the exact error → fix location.

One line per bug in `test-log.md`:
> **[TAG] `<trigger>` → `<action>`** — Expected: `<what, where>`. Actual: `<what + exact error>`. Root cause: `<file:line or node id + field>`.

### 9. Consolidated fix → next version (after the FULL pass)
1. `superpowers:brainstorming` over the complete bug list — fixes must not conflict. Ask every
   open question now (structural changes, `ask`-tier items, new action ids) and wait for answers.
2. All `JSON` bugs → applied per `integration-debug` rules (root cause per field, zero side
   effects, full JSON) with a self-checking patch script (template:
   `integration-enhance/references/email-sent-patches/apply_fix.py`, never hand-edit), written as
   `v<N+1>-<short-fix-name>.json` next to the previous version.
3. Verify twice (`integration-debug` step 6): parses; node/edge counts and every field outside the
   fixes byte-identical to `vN`; re-run the step-3 audit on the new file (no hardcoded URL, only
   validated actions, no type mismatch); each fix re-read against its exact error.
4. Add the `## v<N+1>` changelog to `test-log.md`.
5. **Always** produce one `/lavish` report for the version, right after writing it: scenario matrix
   with pass/fail, every bug with tag + root cause, old flowchart vs new flowchart (changed nodes
   highlighted), before/after diff of every changed field (`@pierre/diffs`), field-type table,
   non-JSON fixes with code refs / new-action specs, blast radius (what is untouched), retest plan.
   No open questions in it.
6. New recurring pattern learned → append it to `integration-enhance/references/common-bugs.md`.

### 10. Full regression retest
When the user says the new version is imported: rerun the **entire** scenario matrix on it, not
just the failed ones. New bugs → next version, same loop.

## Common mistakes
- Fixing the first bug found instead of finishing the full pass.
- Testing before the static audit — a hardcoded URL or type mismatch found by reading is cheaper
  than one found by a failed run.
- Calling a non-JSON bug a JSON bug, or working around a missing connector action with a raw
  `httprequest`.
- Triggering the wrong real event (scheduled vs manual send, create vs update).
- Verifying the wrong system for an action's result.
- Reporting a setup gap as a bug.
- Overwriting an earlier version file, or writing a partial JSON.
- Leaving a question inside a version's `/lavish` report instead of asking first.
- Retesting only the failed scenarios after a fix.
