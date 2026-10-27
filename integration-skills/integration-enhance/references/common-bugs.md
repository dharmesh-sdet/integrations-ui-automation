# Common Bug Catalog — Pyxis Workflow JSONs

Grounded in: diffing `hubspot-contact-created-properties-updated.json` (old) against
`contact-created-properties-updated-in-hubspot.json` (fixed) and
`email-sent-from-saleshandy.json`, plus Jira epic AL-3982 and the Confluence release notes
for saleshandy-edge#11232 / saleshandy-open-api-gateway#471.

Each entry: **pattern**, **how to detect it in a workflow JSON**, **tier**.

- **auto** — mechanical, additive/defensive only, cannot change what the workflow already
  does for any input that currently works. Propose directly in the `/lavish` plan.
- **flag** — the fix is obvious but changes behavior (a previously-dead branch starts
  firing, a previously-silent drop starts happening). Must be called out explicitly and
  confirmed, even though the "correct" fix is unambiguous.
- **ask** — cannot be resolved from the JSON alone; needs external info (API schema,
  which properties are actually read-only for this object type, backend PR status,
  target Pyxis environment's connector `application_id`). Ask before proposing anything.

## 1. Unguarded JSON.parse on a templated field — **auto**
A `codeexecutornode` receives a `{{application.fields.X}}` / `{{workflow.fields.X}}`
value as a string and calls `JSON.parse` on it directly. Template resolution can yield
`""`, `"undefined"`, or malformed JSON when the field isn't configured. Detect: `JSON.parse(` in `code_string` with no enclosing `try`/`catch`. Fix: wrap in try/catch,
fall back to `{}` (mirrors the `parseMaybeJson` helper already in node 42 of the fixed
Contact-Created workflow).

## 2. Dynamic property list drops baseline fields — **auto**
A code node builds a property list to fetch/send from the user's field mapping config
only, with no hardcoded floor. If the mapping is empty or the webhook's changed-properties
payload is empty (common on `contact.creation`, which may fire before any property is
set), the downstream GET/CREATE call requests nothing useful. Detect: a `codeexecutornode`
building a properties array purely from a `map_fields`/mapping object, no `defaults`/const
array unioned in. Fix: union with the known baseline (`email`, `firstname`, `lastname`,
`phone` for contacts) via `Set` dedupe — the exact pattern in node 42.

## 3. Unencoded value in a URL query/path — **auto**
A value that can contain `+`, `@`, or spaces (most often an email) is interpolated
directly into a `url_path` or query string instead of `encodeURIComponent`-wrapped.
Detect: `{{node.X.body...email}}` or `{{event.body.prospect.email}}` appearing inside
`url_path`/`base_url` without an intervening code node that encodes it first. Fix: add
(or point to) a small code node doing `encodeURIComponent(params.email)` before use —
the pattern in node 39.

## 4. Missing existence guard before nested property read — **auto**
A `codeexecutornode` reads `params.x.properties.y` (or similar) and uses it unconditionally
— e.g. splitting `email` on `@` to get a domain — with no check that `y` exists. A contact
without that property throws at runtime instead of returning a safe empty value. Detect:
property access chains inside code nodes with no `if (params.x.properties.y)` guard.
Fix: add the guard, matching the shape of node 38 (`if(params.contacts.properties.email){...}`).

## 5. Broken template array-index syntax — **auto**
This platform's array-index templating is `{{node.X.body.payload.0.id}}` (dot-numeric-index).
Bracket-index forms like `{{(node.X.body.payload[0].id)}}` are foreign to every other
working reference in these workflows and are a confirmed real bug — the Contact-Created
release notes (AL-3982) explicitly list fixing the `dnc-list` reference from bracket-index
to dot-index as one of the shipped changes. Detect: any `[` immediately after a numeric
context inside a `{{...}}` template. Fix: convert to dot-index form.

## 6. Field-mapping silently drops fields with no explicit `mappingDefaultField` — **auto**
Root cause of AL-4018 ("most mapped fields do not sync to the prospect"). A mapping code
node (like node 40) only forwards a Saleshandy field when
`property.mappingDefaultField` is explicitly set in config; if it's absent, the field is
silently dropped instead of falling back to a derived key. Detect: a mapping/transform
node indexing into `params.map_fields[mappingDefaultField]` with no fallback branch when
`mappingDefaultField` is falsy. Fix: derive a camelCase key from `property.label` as a
fallback (strip apostrophes, split on whitespace, camelCase-join) — the `toMappingKey`
helper already present in the fixed node 40 is the reference implementation; reuse it
verbatim rather than inventing a new one.

## 7. Duplicate ActionN slot in an OR-rule (copy-paste) — **flag**
A "Select Saleshandy/Hubspot Action" rule node's `compare_value_of` array is supposed to
have exactly one entry per configured action slot (Action1..ActionN). Cloning a rule node
and forgetting to update one entry leaves a slot duplicated (e.g. `Action1` appears twice)
and another slot (e.g. `Action3`) never checked — that action can never trigger this rule's
branch even if the user selects it in the UI. Detect: within one rule node's
`compare_value_of`, the same `data_slot_id` template string appears more than once. Fix:
correct the duplicate to reference the missing ActionN slot, matching the full slot range
used by sibling rule nodes in the same workflow. **This changes behavior** — a branch that
never fired before now can — so it must be flagged and confirmed, not silently applied,
even though the mechanical fix is obvious. (Seen recurring in both example workflows —
e.g. nodes "Rule - Mark As Finished" and "Rule - Mark As Resume" in the Deal-Created
workflow, still present even in the otherwise-fixed workflow. Resolved in
`deal-created-properties-updated-in-hubspot-fixed-v14.json` — no rule there has a
duplicated slot any more; still worth surfacing on every other workflow scan.)

## 8. Read-only/computed CRM properties sent in create/update payload — **ask**
HubSpot rejects writes to computed properties. AL-4046 names `hs_email_domain` as one
instance: *"the hubspot expects some of the fields should not arrive in the payload."*
Detect: an `additional_fields` payload built from a raw property-fetch response with no
strip step before a `create_contact`/`update_contact`/`create_deal`/`update_deal`/
`httprequest` create node — including inconsistent cases where some sibling paths in the
same workflow already strip a field (e.g. via `$sift(fields, function($v,$k){$k != "hs_email_domain"})`,
the pattern in nodes 126/129/134 of the Email-Sent workflow) and others don't.
- **Do not auto-apply or silently propose the strip, even for `hs_email_domain`.**
  HubSpot's read-only/computed property list is bigger than one field and can change
  per portal/property-schema — `hs_email_domain` is only the one ticket-confirmed so far.
  Copying the existing sibling pattern to a newly-found gap is still a guess about
  *this* object's current read-only set unless confirmed.
- Always surface the finding (including exactly which fields these paths would currently
  try to write) and ask the user to confirm, against HubSpot's live property schema for
  the object type in question, which of those fields are actually read-only before
  proposing any strip. Flag explicitly that the true read-only list may include more
  properties than the ones already excluded elsewhere in the workflow — don't imply the
  existing strip list is complete.
- **User rule (2026-09-25): HubSpot "property is read-only" errors are not our bug.** The
  customer chose that property in their mapping, so it is their responsibility. Don't list them
  as issues or propose strips for them in an audit. At most, mention them once in a
  "deliberately ignored" section. The ask-first rule above applies only if the user
  explicitly asks to deal with read-only properties.

## 9. "Does X exist?" rule checks only ID existence, not identity match — **ask**
A rule like "If Contact/Company/Deal exist?" checks `{{node.X.body.result.xID}} exist`
only, without also confirming the matched record's identifying field (email/name) equals
the value actually searched for. HubSpot search endpoints can rank a near-match first.
Detect: an "exist" rule with a single `exist`-operator condition, immediately downstream
of a `search` action, with no paired `eq` condition on the identifying field. Fix: add
`AND` condition checking `results.0.properties.email == {{event.body.prospect.email}}` —
the pattern in nodes 100/111/131 of the Email-Sent workflow. **Ask first**: turning a
false-positive "exists" into a correct "doesn't exist" changes create-vs-update behavior
for any prospect currently (incorrectly) matching — confirm this is desired before applying.

## 10. Blind trust of `results.0.id` instead of exact-match filter — **ask**
Same root cause as #9, different node shape: a `transform` node takes a search response
and grabs `.0.id`/`.0.companyID` unconditionally instead of filtering for the exact match
via a JSONata predicate. Detect: `transform` node `query` doing `allX.results[0]...` or
similar without a `[properties.y="..."]` filter predicate. Fix: use the filter-predicate
form — `allContact[properties.email="{{event.body.prospect.email}}"].id` — matching nodes
56/57/92/95 of the example workflows. **Ask first**, same reasoning as #9.

## 11. String-typed boolean flags — **ask**
Some Saleshandy connector fields expect the literal string `"true"`/`"false"` rather than
a JSON boolean (e.g. `"verifycontacts": "false"` in node 6). Detect: a boolean-looking
field currently sent as `true`/`false` (unquoted) where sibling/working nodes in the same
workflow send the equivalent field as a quoted string. Can't confirm the correct type from
JSON alone — **ask**, don't silently convert either direction.
**Live-confirmed 2026-10-07 (SF Lead Created v2, runs I1/L1):** in a Refold `node_rule`/rule, a compare value of
`"true"`/`"false"` is turned into a boolean and compared **strictly** (log: `{"data_slot_id":"false","compare_value":false}` →
Skipped). So a code node feeding such a rule must return real booleans; returning the strings `"true"`/`"false"` makes
the rule never match. Don't "harden" boolean flags into strings.

## 12. Duplicate key sent under two casings/hyphenations defensively — **flag only, never auto-resolve**
E.g. `"conflict-action"` and `"conflictaction"` both present in the same `input_data`
(node 3). This usually means a prior author wasn't sure which casing the API actually
accepts and defensively sent both. Detect: two keys in the same `input_data` that
normalize to the same string once hyphens/case are stripped. **Never silently drop
either one** — flag it in the report and ask which key is authoritative (check the
target action's real schema) before touching it.

## 13. Open-API gateway routing without the guarded pattern — **ask**
A workflow's `custom`/`httprequest` node hits `pyxis-open-api-gateway...` directly. Per
the recent codebase fix `7af3840d52 "fix: added gaurd for open api"` and the AL-3982
release notes' merge-order requirement (edge PR #11232 must merge before gateway PR #471,
because the gateway action needs an API-key permission grant from edge first), any
workflow referencing a new/changed open-API action must have its `application_id` pointed
at the connector version registered by the *matching* gateway PR, and the corresponding
edge-side permission must already be live. Detect: `httprequest`/`custom` nodes with
`base_url` containing `open-api-gateway` or an `application_id` that doesn't match other
Saleshandy nodes in the same workflow. **Ask** — this needs live confirmation of which
backend PRs are actually merged/deployed in the target environment; never assume. A `base_url` with a gateway host is itself forbidden — see #43.

## 14. Duplicate trigger registration → duplicate workflow executions — **auto** (detection), **flag** (fix)
AL-4039 ("single contact creation triggers 8 duplicate workflow log entries") and AL-4050
("Blacklist a domain creates duplicate entries... due to duplicate workflow executions")
both describe the same underlying class: the Start node's `triggers` array. Detect:
two entries in `triggers` with the identical `application`+`event` pair (true duplicate,
not `contact.creation` + `contact.propertyChange`, which are legitimately different events).
A true duplicate is **auto**-detectable and safe to dedupe (removing an exact-duplicate
trigger entry cannot change any behavior other than firing count). If the duplication looks
intentional/near-duplicate but not byte-identical, **flag** instead of auto-fixing.

## 15. Update path missing the full field-mapping payload its sibling create path has — **flag**
Every create/update call for an asset — on either side of the integration, HubSpot or
Saleshandy — should populate *all* of that asset's user-configured mapped properties, not
a fixed hardcoded subset. Detect: for a given asset type (Contact/Company/Deal on the
HubSpot side, or Prospect/whatever asset on the Saleshandy side) within one workflow,
compare the CREATE node's `input_data`/body against the sibling UPDATE node's. If create
fetches the mapping via a `custom` (`get_prospect_fields`) → `internal_functions`
(Mapping Function) chain and forwards the result as `additional_fields` (or equivalent),
but the update path has no such chain feeding it and only ever sends a few hardcoded
properties (or vice versa — update is wired but create isn't) — that side never syncs any
mapped property outside the hardcoded few. Fix: wire the same
get_prospect_fields → Mapping Function (→ read-only strip per #8, **ask** first per that
entry) chain into whichever path is missing it, mirroring the sibling call's
`additional_fields` shape exactly. **Flag, don't silently apply** — this changes behavior:
properties the user mapped but that aren't among the hardcoded fields start actually
syncing on the previously-incomplete path, where they silently never did before.

Concrete live instance found on scan of `email-sent-from-saleshandy.json`: node **10**
("Update Company") sends only `companyId`/`name`/`domain`, no `additional_fields` —
while sibling nodes **136**/**142** ("Create Company") carry the full mapped
`additional_fields` from the "Company Properties" chain (node 117). Contact and Deal in
the same workflow don't have this gap — both their create and update paths already carry
`additional_fields`. Treat any asset type where create/update aren't symmetric this way as
a match, on either the HubSpot or Saleshandy side.
**Resolved 2026-09-25** in `email-sent-from-saleshandy-enhanced.json`: nodes 151 (copy of 116,
get_prospect_fields) and 152 (copy of 117, Mapping Function with Company Properties) are inserted
before node 10. Node 10 gets `additional_fields: "{{node.152.body}}"` and
`optional_fields: ["additional_fields"]`. `update_company` accepts `additional_fields`: the
Link-Clicked workflow's node 10 has that input, and a live run returned HTTP 200.

---

# Deal-Created workflow lessons (v1 → v14, 2026-09-22..24)

Grounded in the diff chain `deal-created-properties-updated-in-hubspot.json` (original) →
`-with-loop` → `-bulk-fix` → `-enhanced` → `-fixed` → `-fixed-v2` … `-fixed-v14.json`
(v14 is the final, confirmed-working version the user signed off on). Entries 16–24 are
patterns; the "Reference structure" section after them is the working shape to compare
any multi-contact workflow against.

## 16. Trigger fires on create only, not on property change — **flag**
A "X Created/Properties Updated" workflow whose Start node `triggers` array has only
`<object>.creation`. The name promises updates too, but nothing fires on edits. Detect:
the workflow name (or `config_fields` auto-created for the event) mentions
"Updated"/"Property", and `triggers` has no `<object>.propertyChange` entry for the same
`application`. Fix: add a second trigger entry beside the creation one, same shape:
```json
{ "application": "hubspot", "event": "deal.propertyChange",
  "trigger_rule": { "operator": "OR", "compare_value_of": [] } }
```
Leave out `_id` (Pyxis assigns one on import, e.g. `6ab503113e4e8946ed601c97`). Both
events carry `event.body.objectId`, so every downstream `{{event.body.objectId}}`
reference works unchanged. **This changes behavior**: every property edit now re-runs
the whole flow, so downstream Saleshandy writes must be idempotent (bulk add uses
`conflictAction: "upsert"`, status/tag actions are safe to repeat). Don't confuse this
with #14: `creation` + `propertyChange` is two different events, not a duplicate.

## 17. Loop (`group` / `iterating_array`) wired with the wrong keys — **auto** (mechanical)
This took five iterations to find (v2–v7). The only shape that iterates correctly:
- Group node: `"type": "group"`, `"action": "iterating_array"`,
  `input_data: { "fanout_array": "{{node.<N>.body.result}}" }`. **Not** `array_item`:
  v3 tried `array_item` as the input key and it broke, v4 reverted to `fanout_array`.
- `"entry_node": "<first child id>"`, and the group's `outgoing_nodes` is `[entry_node]`,
  with an edge `group → entry` (`sourceHandle: null`).
- Every node inside the loop has `"parentNode": "<group id>"` and `"extent": "parent"`.
  That includes rules and their actions, not just the entry node. A node missing
  `parentNode` runs once, outside the loop, and reads a stale/undefined item.
- The current item is referenced as `{{node.<group id>.body.array_item}}`. **Not**
  `{{item}}` (v3, didn't resolve) and **not** `{{node.<group id>.body.result}}` (v2).
Detect: a `group` node with `array_item` in `input_data`, or children using `{{item}}` /
`{{node.<group>.body.result}}`, or children missing `parentNode`/`extent`, or
`entry_node` not matching the group's single outgoing node. Fix: conform to the shape
above. Nothing that currently works changes, because a mis-wired loop never ran correctly.

## 18. Loop fed a raw API array instead of a flat primitive array — **auto**
The first loop version passed `{{node.41.body.results}}` (HubSpot association objects,
`{toObjectId, associationTypes}`) straight into the loop, then chained a per-contact GET
and an encode node inside it. Fix used in v2+: build the exact per-iteration value
**before** the loop in a `codeexecutornode` that returns a flat array of primitives, e.g.
node 50:
```js
const emails = contacts.filter(c => c.properties && c.properties.email)
                       .map(c => encodeURIComponent(c.properties.email));
return { result: emails };
```
Then `fanout_array: {{node.50.body.result}}`, and the entry node uses
`{{node.43.body.array_item}}` directly as the (already-encoded, per #3) email.
Detect: `fanout_array` pointing at a raw connector response (`.body.results`,
`.body.payload`), or loop children that immediately re-fetch/re-encode the item.

**Disproven hypothesis, don't reintroduce it:** v8 added "duplicate the item when the
array has exactly 1 element" (`if (arr.length === 1) arr = arr.concat(arr)`), on the
theory that the loop drops single-element arrays. That wasn't the cause (the loop
keys in #17 were). v13 removed it. If you see that hack, flag it for removal.

## 19. Per-contact work done in a loop that should be one bulk call — **flag**
A deal (or company) can have N associated contacts. The original flow only ever
processed `results.0` (the first contact, silently ignoring the rest). The first loop
fix then put *everything* inside the loop, which meant N× GET-contact, N× add-prospect,
N× add-to-sequence, and N× blacklist calls. The working split in v14:

| Step | Where | How |
|---|---|---|
| Get associated contact IDs | outside loop | `GET /crm/v4/objects/deals/{{event.body.objectId}}/associations/contacts` (node 41) |
| Build batch-read body | outside loop | code node 44 → `{ inputs: [{id: String(r.toObjectId)}], properties: [...] }` |
| Read all contacts | outside loop, 1 call | `POST /crm/v3/objects/contacts/batch/read`, `body: {{node.44.body.result}}` (node 45) |
| Map all contacts → SH prospect fields | outside loop | code node 39 maps `contacts.results[]` → `prospectList: [{fields:[{id,value}]}]` (reuses `toMappingKey` from #6) |
| Add prospects to Saleshandy | outside loop, 1 call | node 3 `"fileds": "{{node.39.body.result}}"` (body is `{prospectList, conflictAction:"upsert", verifyProspects:false}`) |
| Add prospects to sequence | outside loop, 1 call | node 6 `"prospects": "{{node.39.body.result.prospectList}}"` |
| Blacklist domains | outside loop, 1 call | #21 |
| Get SH prospect ID + status/tag/unsubscribe | **inside** loop | these endpoints take one `prospect-id`, so they're the only per-contact work |

Detect: a `group` whose children include a create/add/bulk-capable action (add prospect,
add to sequence, DNC), or a flow that reads `results.0` / `.0.toObjectId` from an
association/list response with no loop or batch at all (silently handles 1 of N).
**Flag**: switching from "first contact only" to "all contacts" changes behavior.

## 20. Get-ID-then-act ordering: prospects must exist in SH before the loop — **flag**
Status/tag/unsubscribe actions need a Saleshandy prospect ID, fetched by email
(`get_prospect_id`, node 4 → `{{node.4.body.payload.0.id}}`, guarded by the
"Does Prospect Exist?" rule 26: `{{node.4.body.payload.0}}` `exist` `createdAt`). For
that lookup to find newly created prospects, the loop must start **after** the bulk
add (node 3) finishes. But node 3 is skipped when "blacklist-domain" is selected
(rule 29 false branch), so the loop needs to be reachable from both paths.
- Wiring both `29.false → 43` and `3 → 43` directly into the group node didn't work (v2).
- Fix (v3+): a no-op **join** `codeexecutornode` (node 51, `return { result: true }`)
  with `incoming_nodes: ["3","29"]`, edges `3 → 51` and `29 → 51` (`sourceHandle:
  "false"`), and `51 → 43`. The group then has exactly one incoming node.
Detect: a `group` node with more than one `incoming_nodes`, or a loop that reads an SH
prospect ID for contacts the same run creates, with no path forcing the create first.

## 21. DNC/blacklist done per-domain instead of one bulk call — **flag**
Original: per-contact domain extraction → connector action `65770ac8c002b2b9b4592f26`
(`Blacklist a Domain`) with a single `domains` string. An intermediate version looped over
unique domains (group 49), which created duplicate DNC entries and N calls.
**Correct shape (superseded v9–v18, 2026-09-29):** the existing `Blacklist a Domain` action
already accepts an **array** in `domains`, so no raw HTTP call is needed:
1. Code node 46: collect `email.split('@')[1]` into a `Set` (dedupe), return the array.
2. Rule 47 (OR, `eq "blacklist-domain"` across Action1..9) → `true` → node 20 directly.
3. Node 20: `type: "custom"`, `action: "65770ac8c002b2b9b4592f26"`,
   `action_operation_id: "blacklist_a_domain"`, `action_fields_fingerprint: "dnc-list|domains"`,
   `input_data: { domains: "{{node.46.body.result}}", dnc-list: "{{workflow.fields.DNC List}}", x-api-key }`.
v9–v18 used a code node 52 (`{items, dncListId}`) + a raw `httprequest` to
`https://pyxis-open-api-gateway.<env-host>/v1/dnc`. **That was wrong** — it hardcoded the
staging host into the workflow (#43). Detect: any node posting to `/v1/dnc` or building an
`{items, dncListId}` body. Fix: remove the body-builder node, point the rule at the action.

**Correction (2026-09-30):** the old `Blacklist a Domain` action (`blacklist_a_domain`) does NOT
accept an array. Its body is `{ "items": ["{{domains}}"] }`; Pyxis substitutes the whole quoted
placeholder with the raw value, so an array becomes `{"items":[["a.com","b.com"]]}` → 400
`each item should be a string` (seen in prod). The user created a new action for bulk:
**`Blacklist Domains (Bulk)`**, `action_operation_id: "blacklist_domains_bulk"`, POST `/v1/dnc`,
body `{ "items": "{{domains}}" }`, fields `domains` (array) + `x-api-key`. Node 20 = that action,
`domains: "{{node.46.body.result}}"`, rule 47 true → 20, no node 52, no `dnc-list` (API `dncListId`
is optional; empty value → default list). Action `action` ObjectIds are per-environment and
resolved on import from `application_slug` + `action_operation_id` — the user never types them.
Patch script: `integration-jsons/scripts/apply_dnc_bulk_action.py`. Live staging (pre-fix) had
node 20 as raw `httprequest` + node 52 — that is `...-staging-current.json`, not `-staging-fixed.json`.

## 22. Negated multi-slot rule uses OR instead of AND — **auto** (clearly a bug)
"Rule - If Not Blacklist Domain" (node 29) checks every `Select Saleshandy ActionN`
with `comparison_operator: "neq"` and `"operator": "OR"`. With OR, the rule is true
whenever *any* slot isn't "blacklist-domain", which is effectively always true, so
prospects got added even when the user picked blacklist-domain. Fix (v12): `"operator":
"AND"`, meaning none of the slots is blacklist-domain. Detect: any rule whose
`compare_value_of` entries are **all** `neq` (or `not_exist`) against the same
`compare_value` while `operator` is `OR`. The positive siblings (`eq` + OR, e.g. rules
5/7/9/11/13/15/17/47) are correct as they are. By De Morgan, the negated form must use AND.

## 23. Unsubscribe via generic status action instead of the dedicated one — **ask**
"Action - Mark As Unsubscribed" used `change_prospect_status`
(`65770a9bc002b2b9b4592f16`) with `status: "unsubscribed"` + a
`Sequence Name (Mark Prospect as Unsubscribed)` field. v6 replaced it with the dedicated
action `6aa3a571686cab0157a32ce0` (`action_operation_id: "unsubscribe_prospects_upd"`),
whose only input is `prospect-id` (plus `x-api-key`), and `action_fields_fingerprint:
"prospect-id"`. Detect: a `change_prospect_status` node with `status: "unsubscribed"`.
**Ask** before swapping: the action ID is per-Pyxis-environment. Confirm the dedicated
action exists in the target environment's Saleshandy connector.

## 24. Status actions chained off the wrong parent / duplicated branch — **flag**
Original graph: Finished/Replied/Paused/Resume rules (9/11/13/15) hung off
"Add Prospect to Sequence" (node 6), and a second copy of all four (30–37) hung off
rule 5's *failed* branch. So status changes only ran if add-to-sequence also ran,
and in some configs they ran twice. Fix: remove the 30–37 duplicates, make 9/11/13/15
direct `true` children of "Does Prospect Exist?" (26), in parallel with 7 (unsubscribe)
and 17 (tag), all inside the loop. Node 6 now has `outgoing_nodes: []`. Detect: the
same action name + same `status` value appearing on 2+ nodes, or a per-prospect action
whose only path to the Start node runs through an unrelated action node.

## Housekeeping (report only, never auto-remove)
v14 still carries orphan nodes with no edges: 27 "Get Domain From Email", 28
"Parse Prospect Email" (old `executecodenode`s referencing the deleted node 24), 42
`list_deals` (deleted in v15, with the user's approval), and 48 "Normalize Associated
Contact IDs" (`outgoing_nodes: []`). Dead
nodes referencing deleted node IDs (`{{node.24...}}`) are harmless but confusing. List
them in the report as "orphans, safe to delete if you want". Don't delete them unasked.

---

# Field-mapping lessons (Deal-Created v15 → v17, 2026-09-25)

Grounded in `-fixed-v15.json` → `-fixed-v16.json` → `-fixed-v17.json` and two live
run logs from HubSpot portal 247320744 (deal `350501287644`). The goal the user set:
**every field mapped in settings must land on the Saleshandy prospect, on create *and* on
update, including fields that live on a different HubSpot object than the contact**
(e.g. a deal's `amount` or a company's property mapped to a Saleshandy prospect field).
Entries 25–33 are patterns; "Reference structure (v17)" below is the target shape.

### How the mapping works (read this before touching any mapping node)
- The two user-configured maps come from the application, not the workflow:
  `{{application.fields.Contact Properties}}` and `{{application.fields.Deal Properties}}`
  (also `Company Properties`). Shape: `{ "<saleshandyKey>": "<hubspot_property_name>" }`,
  e.g. `{ "jobTitle": "jobtitle", "company": "company", "dealValue": "amount" }`.
  They may arrive as an object **or as a JSON string**, so always parse (#28).
- `<saleshandyKey>` for each Saleshandy field comes from `get_prospect_fields` (node 25,
  `GET /v1/fields?systemFields=true`): `property.mappingDefaultField || toMappingKey(property.label)`.
  System fields have `mappingDefaultField` (`dealValue`, `closingDate`, `jobTitle`…).
  Custom fields have it empty/absent, so the label is camelCased (#6).
- Output to Saleshandy is always `{ id: <field.id from node 25>, value }`. Never send
  the HubSpot name or the mapping key as the field id.
- The same mapping panel is also used in the **other direction** by the Saleshandy→HubSpot
  workflows (Email Sent, Link Clicked read `Deal Properties` via the internal "Mapping
  Function"). Reading it in reverse here makes each mapped pair sync both ways. Say so
  whenever you wire a map into a new direction.

### The per-field lookup order (v17, node 39) — reuse verbatim
For each Saleshandy field from node 25, with `key = mappingDefaultField || toMappingKey(label)`:
1. Email / First Name / Last Name → the contact's `email` / `firstname` / `lastname`
   (identity baseline, same as the Contact workflow's node 40).
2. `contactMap[key]` set **and the contact has a non-empty value** → contact value.
3. `contactMap[key]` set but the contact lacks it → **the trigger object's value for the
   same HubSpot property name** (cross-object, #25).
4. `dealMap[key]` set and the deal has a non-empty value → deal value.
5. Otherwise **omit the field**. `upsert` keeps the existing Saleshandy value, so a
   missing/empty HubSpot value never wipes data (#29).
```js
if (hubspotKey && hasValue(ele.properties[hubspotKey])) {
    output.push({ "id": property.id, "value": ele.properties[hubspotKey] });
} else if (hubspotKey && hasValue(dealProps[hubspotKey])) {
    output.push({ "id": property.id, "value": dealProps[hubspotKey] });
} else if (dealKey && hasValue(dealProps[dealKey])) {
    output.push({ "id": property.id, "value": dealProps[dealKey] });
}
```

## 25. Cross-object mapped field silently empty — **flag**
The confirmed root cause of "I mapped Deal Value to amount and it's not populated". The
user mapped **Deal Value → `amount`** in the **Contact Properties** panel. The mapping node
looked it up only on the contact (`contact.properties.amount`), and contacts have no
`amount`, so the field was skipped with no error. The deal (node 53) had
`amount: "10045"` the whole time. The same class applies to any HubSpot object's
property (deal, company) mapped in a panel whose workflow only reads a different object.
Detect: a mapping code node that reads values from exactly one object's `properties`
while the workflow's trigger/associated object is a different type, and the fetch of
that other object (if any) requests a fixed list instead of the mapping's values.
Fix (v17):
- Fetch the trigger object with **every HubSpot property named in either map**:
  node 54 → `Object.values(dealMap).concat(Object.values(contactMap))`, and add the
  `map_fields` input to it.
- In the mapping node, fall back from the contact to the trigger object for the **same
  property name** (lookup step 3 above).
**Flag**: fields that silently stayed empty start filling, and a contact property that's
empty on the contact but exists on the deal with the same name (e.g. `hubspot_owner_id`)
now takes the deal's value. Assumed, not live-verified: HubSpot's `batch/read` ignores
property names that don't exist on that object (contact-only names sent to deals).

## 26. Trigger object's own properties never read — **flag**
The Deal workflow read the deal only for its **associations**
(`GET /crm/v4/objects/deals/{id}/associations/contacts`, node 41). The deal record
itself was never fetched, so no deal field could ever sync. A disconnected `list_deals`
node (42) sat unused. Detect: the trigger object ID (`{{event.body.objectId}}`) is only
used in an associations URL, and no node fetches that object's properties. Fix (v15),
mirroring the contacts batch read (44 → 45):
- node 54 (code): `return { result: { inputs: [{ id: String(params.objectId) }], properties } }`
  with inputs `objectId = {{event.body.objectId}}`, `deal_map_fields`, `map_fields`.
- node 53 (hubspot `httprequest`): `POST /crm/v3/objects/deals/batch/read`,
  `body: {{node.54.body.result}}`. The mapping node reads `{{node.53.body.results.0}}`.
- Wire it linearly **before** the mapping node: `45 → 54 → 53 → 25 → 39`, so node 39
  never runs before the deal read finishes. Use a JSON-body batch read rather than
  `?properties=` in a URL, to avoid URL-encoding a list.

## 27. Hard-coded fetch list instead of the mapping — **flag**
Node 44 fetched a fixed list of 19 HubSpot contact properties. Any mapped property
outside it was never fetched, so it silently never synced. Correct pattern = the
Contact workflow's node 42:
```js
const mapFields = asMap(params.map_fields);
const defaults = ["email", "firstname", "lastname", "phone"];
const mapped = Object.values(mapFields).filter((v) => typeof v === "string" && v.trim() !== "");
properties: Array.from(new Set([...defaults, ...mapped]))
```
**User rule (2026-09-25):** no hard-coded field lists or default mappings. Everything
comes from the saved mappings, **except the identity baseline**
(`email, firstname, lastname, phone`). Keep that baseline because without it an empty or
unresolved mapping imports nothing and the per-contact loop/blacklist (which key on email)
stop. The deal fetch has no baseline: it's purely `Object.values(dealMap ∪ contactMap)`.
Rejected, don't propose again: a hard-coded fallback map like
`{dealValue: "amount", closingDate: "closedate"}`.

## 28. Mapping param used without parsing — **auto**
The inverse of #1. The code node does `params.map_fields || {}` and indexes it directly.
If Pyxis delivers the application field as a JSON string, `map[key]` is `undefined` and
every mapped field is dropped silently (and `Object.values(string)` yields single
characters). The Contact workflow's node 42 has the fix. Its node **40 still lacks it**.
Use this helper in every node that reads a map:
```js
const parseMaybeJson = (v) => {
    if (typeof v !== "string") return v;
    try { return JSON.parse(v); } catch (err) { return undefined; }
};
const asMap = (v) => {
    const parsed = parseMaybeJson(v);
    return (parsed && typeof parsed === "object" && !Array.isArray(parsed)) ? parsed : {};
};
```

## 29. Empty-value handling in a multi-source lookup — **auto**
HubSpot returns `null` for unset properties. A truthiness check or `Object.assign`-style
merge either lets a `null` contact value hide a real deal value, or sends empty values
that overwrite Saleshandy data on `upsert`. Use
`const hasValue = (v) => v !== null && v !== undefined && v !== "";` and only push a
field when `hasValue` is true.

## 30. Contacts without email sent in a bulk import — **flag**
The bulk `prospectList` included contacts with no email, which Saleshandy can't create.
One bad row risks the whole import. Fix: filter before mapping
`.filter(c => c.properties && c.properties.email)`. Node 50 (loop input) already did this,
so the loop is unaffected. **Flag**: those contacts stop being sent at all.

## 31. Diagnosing "mapped field not populated" — checklist (process, not a bug)
Ask for these run-log entries, in this order:
1. **Mapping node (39) input.** If `map_fields` / `deal_map_fields` are **absent** from
   `input_parameters`, the `{{application.fields.X}}` template didn't resolve (mapping
   not saved for this account/portal/environment, or saved elsewhere). That's a settings
   issue: v15's first run showed this, then a later run resolved and Job Title/Company filled.
2. **Node 25 output**, just the target field: its `id`, `label`, `mappingDefaultField`.
   Compute the key it will be looked up under.
3. **Trigger-object fetch (53) output**: does the value exist on the record at all?
4. **Mapping node output**: is `{id: <field id>}` present per contact?
5. **Which panel the user mapped it in** (Contact vs Deal Properties). A deal/company
   property in the Contact panel is #25.
Tell-tales for **which version actually ran**: v16+ outputs a `debug` key next to
`result` (both maps as received); v15's node 53 requests exactly `dealname, amount`.
Also: `deal.propertyChange` fires **per subscribed property** in the HubSpot app. A
mapped deal property with no subscription never re-triggers the workflow.

## 32. Mapping changes must not touch anything else — **process rule**
Every v15→v17 change touched only `code_string` / `input_parameters` of the mapping and
fetch nodes (39, 44, 54). Verify with a programmatic diff (node count, `edges ==`,
top-level keys, per-node `input_data` keys), and run the changed functions on sample data
with `new Function(code + 'return yourFunction;')()`. Cover: maps missing, maps as
objects, maps as JSON strings, a malformed string, contact-wins precedence, and the cross-
object case. "Maps missing" must still import email/first/last (the user asked twice:
"this won't break anything, right?").

## 33. Contact-workflow instances found on scan (2026-09-25, report only until approved)
`contact-created-properties-updated-in-hubspot.json` (37 nodes, `__v` 11):
- Node 29 "If Not Blacklist Domain": all `neq` with `"operator": "OR"` → #22 (blacklisted contacts still imported).
- Duplicate slots → #7: rules 9 & 34 (Finished) check Action1 twice and never Action3.
  Rules 15 & 30 (Resume) check Action2 three times and never Action3/4. Rule 19 (Blacklist)
  never checks Action3.
- Node 40 uses `map_fields` without parsing → #28.
- Node 6 reads `{{node.22.body.function_return_value.result}}`, but node 22 doesn't exist.
  Node 8 is an orphan. Node 38's input is double-quoted: `"\"{{node.24.body}}\""`.

## 34. Company-workflow instance + non-templated slot id (2026-09-25, applied)
`Company Created/Properties Updated in Hubspot` (workflow `659417a8e15237c317f4b036`) had the
same single-contact shape as the original Deal workflow (node 24 reads `results.0`). The fix was
built from Deal v17 → `integration-jsons/company-created-properties-updated-in-hubspot-enhanced.json`:
the associations URL became `companies/...`, node 54/53 read `/crm/v3/objects/companies/batch/read`, and node 39
takes `company` + `company_map_fields` (`{{application.fields.Company Properties}}`) with contact-wins
precedence. The user's decisions: no chunking/pagination for >100 contacts, dedicated unsubscribe action,
bulk DNC exactly like Deal, open `company.propertyChange` trigger.
New detection variant of #7: a `data_slot_id` written as plain text (`"Select Saleshandy Action1"`,
no `{{workflow.fields.…}}`) never matches, so that slot is dead. Seen in the Company rules 17 and 32.
Also seen: a mapping node that treats `map_fields` as `{fieldId: value}` overrides, pushing
`{id: "<mappingKey>", value: "<hubspot_property_name>"}`. Replace it with the v17 lookup, not a patch.

# Email-Sent workflow lessons (Saleshandy → HubSpot, 2026-09-25)

Grounded in `email-sent-from-saleshandy-current.json` (the user's live export, 106 nodes) →
`email-sent-from-saleshandy-enhanced.json` (114 nodes), plus a live run log for update-company
(portal 247320744, company 344796374737, HTTP 200, name updated). This is the shape of every
Saleshandy→HubSpot activity workflow (Email Sent, Link Clicked, Replied, …). The Start node fans
out to 7 parallel OR-rules over `Hubspot Action1..11`: create-deal, create-contact,
create-company, update-company, update-contact, update-deal and create-task. `create-note` and
`record-email-activity` have no branch of their own; they are rule pairs copied at the end of
every branch. Patch scripts that worked are in `references/email-sent-patches/`.

### Behaviour the user accepted (2026-09-25). Don't re-flag these on this family of workflows
- Create-deal / create-company never check for an existing record. Selecting the action means
  "create a new one every time".
- Create-deal / create-company may create the contact when it is missing.
- Exact-match email comparisons (`properties.email = prospect.email`) are fine: emails are
  always lower case.
- ~~Update-deal and update-company use the **first** associated record (`results[0]`).~~ **Superseded
  2026-10-02:** the user rule is now "always update the latest". See #44.
- One note and one email log per branch that ran (duplicates across branches) is fine.
- A HubSpot "lifecycle stage can't move backwards" error is fine.
- Read-only property errors: see #8 user rule.
- Email Opened / Link Clicked update-deal finds deals by `dealname == prospect email` and updates the **index-0**
  result (search sorted by `createdate`, so the oldest deal). The user confirmed this is intended (2026-09-28).
  **Re-check (2026-10-02):** the user's later rule is "in all such cases update the latest, not the oldest" (#44).
  Flag it and ask before flipping the sort to `DESCENDING`; don't silently keep it.
  With several same-named deals, "my deal didn't update" usually means they are looking at a newer one.
- "Closing date not updating" checklist: node 89 query must show the days (`(10* 24 …`). If it shows `( * 24`,
  the config value is empty for that workflow. `days_to_close` is computed by HubSpot from `closedate`.
  Known webui bug (not fixed): `extra-config-modal/fields/number-field.tsx` never saves `0`
  (`if (number && view.id)`), and the input is capped at 200 days.

## 35. Raw HTTP create puts mapped fields in a top-level `additional_fields` — **flag**
Nodes 102/105 (deals) and 136/142 (companies) are `httprequest` POSTs to `/crm/v3/objects/*`
whose templated body is `{"properties":{…}, "additional_fields":{{node.119.body}}, "associations":[…]}`.
`additional_fields` is a **connector-action** convention (`create_contact`, `update_deal`,
`update_company` merge it into properties). The raw HubSpot API ignores or rejects it, so every
mapped Deal/Company property is silently lost. The unquoted `{{…}}` also makes the body
invalid JSON when the mapping is empty.
Detect: `httprequest` with a `body` string containing `"additional_fields"`.
Don't switch to connector `create_deal`/`create_company`: they have **no associations input**
(see Link-Clicked nodes 3/7), and the raw call exists to link the new record to the contact.
Fix: insert a `transform` right before the create call (deep-copy an existing transform so it
gets the same defaults) and set the create node's body to `"{{node.<T>.body.result}}"`.
Object bodies from a transform already work in Deal/Company-Created nodes 45/53.
```
input: {"mapped": "{{node.119.body}}", "contactId": "{{node.99.body.results.0.id}}",
        "closedate": "…", "dealname": "…", "pipeline": "…", "dealstage": "…", "dealtype": "…", "hs_priority": "…"}
query:
(
  $keep := function($o){ $type($o) = "object" ? $sift($o, function($v){ $v != null and $v != "" }) : {} };
  $fixed := $keep({"closedate": closedate, "dealname": dealname, "pipeline": pipeline,
                   "dealstage": dealstage, "dealtype": dealtype, "hs_priority": hs_priority});
  { "properties": $merge([$keep(mapped), $fixed]),
    "associations": [{"to": {"id": $string(contactId)},
                      "types": [{"associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 3}]}] }
)
```
Association type ids: deal→contact **3**, company→contact **280**. Email engagement →
contact 198, company 186, deal 210. The workflow setting wins over the mapping on a clash
(the default the user accepted). Empty values are dropped, and a missing/`""`/`{}` mapping
still gives a valid body. Only the create node's `body` and `incoming_nodes` change, and its
`body.id` output is unchanged, so downstream notes and email logs keep working.

## 36. Update path finds the record by the value it is about to change — **flag**
Update-company searched `companies/search` with `name EQ {{event.body.prospect.company}}` (node
9 → transform 95 → rule 12). Renaming the company in Saleshandy means searching HubSpot for the
**new** name, which finds `total: 0`, so rule 12 fails and nothing happens (confirmed in the
run log). The same trap applies to any update that looks the target up by a property the update
changes.
Detect: an update branch whose lookup filter uses a value that the same branch then writes
(`name` searched by `prospect.company` and then written from `prospect.company`).
Fix (applied and **live-verified**): look the record up through the contact, the same way
update-deal (110→111→112→113) already does:
`search_contacts` by email (copy of 110) → rule "id exists AND email eq" (copy of 111) →
**sorted company search** (see #44: `POST /crm/v3/objects/companies/search`, `associations.contact EQ
{{node.<search>.body.results.0.id}}`, `createdate DESCENDING`, `limit 1`) → transform
`{"companyID": allCompanies.results[0].id}` →
the existing "exists?" rule. Point both the rule's `data_slot_id` and the update's `companyId` at
the new transform, and delete the old search and transform nodes, but only after checking that
nothing else reads them.
(The originally verified fix used `GET /crm/v4/.../associations/companies` + `results[0].toObjectId`.
That picks an arbitrary company, because v4 association order isn't guaranteed. It is superseded by #44.)

## 37. Date-only string sent to a HubSpot datetime property — **auto**
Transforms 97/98/93 (and Link-Clicked 52/77/80) compute
`($millis() + N days + 5.5h) ~> $fromMillis('[Y0001]-[M01]-[D01]')` and feed `closedate` or the
task `hs_timestamp`. HubSpot reads a bare `YYYY-MM-DD` as **midnight UTC**, so every portal west
of UTC shows the previous day (this is AL-4051). The +5.5 h only picks the day for India.
Fix: keep the day calculation exactly as it is and append `& "T12:00:00.000Z"`. The day chosen
is unchanged, and noon UTC shows the same calendar day from UTC−11 to UTC+11 (checked offline
for Los Angeles, New York, London, India and Sydney). Output keys are unchanged, so consumers
need no edits. Detect: `$fromMillis('[Y0001]-[M01]-[D01]')` with no time part, feeding
`closedate`/`hs_timestamp`/any `*date*` property of a HubSpot datetime type. A task's due time
moves from 00:00 UTC to 12:00 UTC; mention that.

## 38. Copy-paste template typos between sibling paths — **auto**
Found in the new-contact copy of create-deal (105) and in create-task (89):
- `{{node.97.body.resultclosing_date}}`: missing `.` (sibling 102 has `result.closing_date`).
- `Deal Priority (while updating)` in a *create* path (sibling 102 uses `(while creating)`).
- `{{node.92.body.contactID}}`: missing `.result` (sibling 45 uses `node.92.body.result.contactID`).
Detect: for each template, compare the path against every other reference to the same node in
the workflow. A reference that matches no sibling (`body.result[a-z]`, missing `result`, or a
`(while updating)` field inside a create branch) is the typo. Fix by copying the sibling's
exact path.

## 39. Notes on deal paths not linked to the contact — **flag**
User rule: a note goes on the deal when a deal is created or updated, on the contact when a
contact is created or updated, and on both when both exist. Deal branches always know the contact
(they search for it or create it first). Fix: add `contact_id` (existing contact:
`{{node.<search>.body.results.0.id}}`; new contact: `{{node.<getId>.body.result.contactID}}`) and
`optional_fields: ["contact_id"]`, the same shape as the already-correct node 107. The user did
not ask to change company notes or email logs, so leave those unless asked.

## 40. Parallel branches race to create the same contact — **report only (accepted)**
Up to 4 branches (create-contact 5, create-deal 101, create-company 135, create-task 52) each do
"search → create if missing" at the same moment. For a brand-new prospect, all but one get
HubSpot 409 Conflict and that branch stops, so its deal/company/task is lost. HubSpot's search
index lag makes it worse. This is the likely mechanism behind the AL-40xx "X fails when Y is also
enabled" tickets. Real fix: one shared "resolve contact" stage before the fan-out. The user
accepted the current behaviour on 2026-09-25, so report it and don't change it.

## 41. Process lessons from this round — **process rule**
- **The baseline is what the user pasted, not the saved file.** The saved
  `integration-jsons/email-sent-from-saleshandy.json` was stale: it had no `config_fields`
  and no `export_id`, and nodes 9/95/120/146 were in different positions. Importing a workflow
  built from it could wipe the user's action slots and settings. Before patching, compare the
  node count, a few positions, and whether `config_fields`/`export_id` are present against what
  the user pasted.
- **Never retype a pasted workflow.** Extract it verbatim from the session transcript
  `~/.claude/projects/<project>/<session-id>.jsonl` (user message text,
  `json.JSONDecoder().raw_decode` from `{\n  "name": "…"`), save it as
  `integration-jsons/<name>-current.json`, then patch into `<name>-enhanced.json`.
- **Patch with a script that checks itself** (see `references/email-sent-patches/apply_fix.py`),
  never by hand-editing JSON. It asserts that:
  - node/edge counts changed by exactly the expected amount;
  - top-level keys (including `config_fields`) are byte-identical;
  - the set of changed nodes is exactly the intended set, and each changed node differs only in
    the intended keys (for example only `input_data.body` plus `incoming_nodes`);
  - every edge matches its nodes' `outgoing_nodes`/`incoming_nodes` (and rule
    `rule_satisfied_nodes`/`rule_failed_nodes` are within `outgoing_nodes`);
  - every `{{node.X}}` in the whole graph points to an upstream node that exists;
  - a removed node has no remaining readers.
  Insert a node between A and B by retargeting the existing A→B edge (keeping its id,
  `sourceHandle` and `data.label`) and adding new→B.
- **Test the exact JSONata strings written into the file** with the Node `jsonata` package.
  Substitute sample values for the `{{…}}` templates first, and simulate the platform turning a
  quoted `"{{node.X.body}}"` into an object. `npm install` hangs in this sandbox; fetch
  `https://cdn.jsdelivr.net/npm/jsonata@2.0.6/jsonata.js` into a scratch `node_modules/jsonata/`
  instead.
- **Debugging "it didn't update":** ask for the input **and** output of every node on the
  branch, in order (rule → search → transform → rule → mapping → action), from one run after
  publishing. First check that the new node ids appear in the log (which version actually ran),
  then find the first node whose output is empty or false.

## 42. Built-in `create_deal` / `create_company` leaves the record unlinked — **flag**
Confirmed 2026-09-28 on "Sequence Email is Opened in Saleshandy" (run log: note 53 sent with only
`deal_id: 350840051435`; the deal showed Contacts (0) in HubSpot). This is the #35 family seen from
the other side: Email Opened and Link Clicked use the connector's `create_deal` (node 3) and
`create_company` (node 7). Those actions have no associations input, and the branches never look the
contact up, so the new deal or company is never linked to the prospect's contact. The notes and email
logs after them carry only `deal_id`/`company_id`.
Detect: any `create_deal`/`create_company` action, or a create branch with no contact search upstream,
or `create_note`/`log_email` on a deal/company path with `contact_id: ""`.
Fix (proposed, same as Email Sent 99/100/147/102 and 130/131/149/136):
- Search the contact by email, then check "id exists AND email eq".
- Yes: a transform builds `{properties, associations:[{to:{id}, types:[{HUBSPOT_DEFINED, 3 | 280}]}]}`,
  and the existing create node is turned into a raw `POST /crm/v3/objects/deals|companies`, keeping
  its node id so `{{node.3.body.id}}` readers keep working.
- No: map the contact, strip `hs_email_domain`, `create_contact`, build the body with `{{node.<create>.body.id}}`,
  then a second raw create with its own note and log rules.
- Add `contact_id` to the notes and logs.
Keep `dealname` as it is when update-deal finds deals by `dealname == email`.
Company create also picks up the Company Properties mapping (#15).
Patch script: `references/email-sent-patches/email-opened-apply_assoc.py`: 8 edited nodes and 26 new ones.
Open item: whether the built-in `log_email` attaches to two objects at once is not yet seen live.

## Reference structure — multi-record trigger → Saleshandy (v17, supersedes v14)
One shared fetch stage, then **four independent branches**:
```
Start (deal.creation + deal.propertyChange)
 └ 41 GET deal→contacts associations
    └ 44 code: contact batch-read body (baseline + Contact Properties values, #27)
       └ 45 POST contacts/batch/read
          ├ 54 code: deal batch-read body (Deal + Contact Properties values, #25/#26)
          │  └ 53 POST deals/batch/read
          │     └ 25 get_prospect_fields
          │        └ 39 code: prospectList (lookup order above; contacts ▸ deal)
          │           ├ BRANCH 1 · IMPORT:   29 rule AND neq blacklist ─true→ 3 bulk upsert ─┐
          │           │                                              └false──────────────────┤
          │           │                                                                    51 join ─→ (branch 4 loop)
          │           └ BRANCH 2 · SEQUENCE: 5 rule add-to-seq ─true→ 6 add prospectList to sequence
          ├ BRANCH 3 · BLACKLIST: 46 dedupe domains ─ 47 rule ─true→ 20 Blacklist a Domain action (domains = array, #21/#43)
          └ 50 encoded emails ─→ BRANCH 4 · PER-CONTACT LOOP: 43 group(fanout_array={{node.50.body.result}})
                                   └ 4 get_prospect_id ─ 26 exists? ─true→ 7→8 unsub · 17→18 tag · 9/11/13/15 → status
```
| Branch | Runs when | Calls | Depends on |
|---|---|---|---|
| 1 Import | unless blacklist-domain selected | 1 bulk `upsert` of every contact with all mapped contact + deal fields | 39 |
| 2 Sequence | add-prospect-in-sequence-step selected | 1 bulk add of the same `prospectList` | 39 (bypasses 29, so it imports even when blacklist is selected) |
| 3 Blacklist | blacklist-domain selected | 1 bulk DNC POST | 45 only |
| 4 Per-contact loop | always (after join 51) | per contact: get ID, then unsub / tag / status | 51 (so branch 1 finished) + 50 |

Why this shape: bulk-capable work (import, sequence, DNC) is one call each, outside the
loop (#19). Only prospect-ID actions loop. The loop waits on the import via join 51
(#20). Mapping is centralized in one node (39) so both import and sequence get the same
fields. When scanning any workflow whose trigger object can map to **multiple**
contacts, compare against this shape. When its mapping looks at only one object, check #25–#28.

## Explicitly out of scope for this catalog (per repo owner decision, 2026-09-21)
- Sibling-branch node coupling across paired "Email Sent from Saleshandy" activities
  (the ~9 AL-40xx "activity X errors when activity Y also enabled" tickets). Root
  mechanism not yet confirmed from ticket titles alone — do not attempt to auto-detect
  or auto-diagnose this pattern until it's explicitly re-scoped in.
- ~~Closing Date off-by-one (AL-4051)~~: **re-scoped in on 2026-09-25**, see #37.
- Sibling-branch coupling: the audit found one concrete mechanism (#40, the race to create the
  same contact). The user accepted the current behaviour for now, so report it but don't fix it.

## 43. Hardcoded API URL / host in a workflow node — **blocker, never allowed**
User rule (2026-09-29): **never hardcode any API URL in a workflow, ever.** Found in the Deal
workflow (node 20 → `https://pyxis-open-api-gateway.lifeisgoodforlearner.com/v1/dnc`) and also
in `company-created-...-enhanced(-v2).json` and `contact-created-properties-updated-in-hubspot.json`.
A hardcoded host is environment-specific: copying staging to production silently sends
production data to staging (or the reverse).
Detect: any node `input_data` with `base_url`, an absolute `http(s)://` URL, or a known host
(`pyxis-open-api-gateway`, `lifeisgoodforlearner.com`, `saleshandy.com`).
Fix, in order:
1. Use the **existing connector action** that already does the job (search the other workflows
   in `integration-jsons/` for a `custom` node with a matching `action_name` /
   `action_operation_id`; the action id is the same across environments).
2. If no action exists, **do not write the node**. Tell the user to create a new action in the
   Saleshandy connector (Pyxis) and give them everything needed to create it:
   - Action name and `operation_id` (snake_case)
   - HTTP method and the **relative** endpoint path (the connector supplies the host per environment)
   - Auth: the connector's `x-api-key` auth, not a key typed into the action
   - Every input field: key, label, type (string/number/array/object), required/optional, help text
   - Request body template (JSON) showing where each input goes, and query/path params
   - Expected success response shape (what downstream nodes will read, e.g. `body.payload`)
   - The edge controller/DTO that backs it (file:line), so the shape is grounded in code
   - A note that it must be created in **both** staging and production connectors
   Then wire the workflow to it only after the user gives back the new action id.
Relative `url_path` on the HubSpot connector's own `httprequest` node (no `base_url`) uses the
connector's host + auth and is not this bug.

## 44. Update path picks an arbitrary associated record instead of the latest — **flag**
User rule (2026-10-02): **whenever an update acts on a record associated with the contact (deal,
company, or anything else), update the latest one (newest `createdate`), never index 0 of an
unsorted list.** Found in Email Sent from Saleshandy: update-deal 112→113 and update-company
155→156 used `GET /crm/v4/objects/contacts/{id}/associations/{deals|companies}` +
`results[0].toObjectId`.
Why `[0]` (or `[-1]`) is wrong there:
- The v4 associations GET accepts only `after` and `limit` (default 500). It has **no sort
  parameter**, and each result is only `{toObjectId, associationTypes}`, **no `createdate`**
  (confirmed from a real node-112 log, 2026-10-02). The v4 batch read is the same. The order is
  not guaranteed, so neither `[0]` nor `[-1]` means "latest".
- `toObjectId` is the associated record's own ID (`hs_object_id`). Sorting by it (`$max(...)`) only
  approximates creation order: IDs aren't documented as monotonic, and merges and imports with a
  back-dated `createdate` break it. Don't use it as "latest".
Detect: a transform reading `results[0].toObjectId` (or `[-1]`, `$max(toObjectId)`) from a v4
`/associations/` GET, feeding an update node's record id.
Fix (applied in `integration-jsons/email-sent-from-saleshandy-latest-assoc-fixed.json`): replace
the GET with the HubSpot connector `httprequest` node calling the v3 search, so HubSpot sorts it:
```
POST /crm/v3/objects/{deals|companies}/search
{"filterGroups":[{"filters":[{"propertyName":"associations.contact","operator":"EQ",
  "value":"{{node.<contactSearch>.body.results.0.id}}"}]}],
 "sorts":[{"propertyName":"createdate","direction":"DESCENDING"}],
 "properties":["createdate"],"limit":1}
```
and change the transform to `{"dealID": allDeals.results[0].id}` (search returns `id`, not
`toObjectId`). Keep the output key (`dealID` / `companyID`) so the "exists?" rule and the update
node need no edits. With no association the result is empty and the existing rule stops the branch,
as before. Keep `limit: 1`: the user wants only the one record fetched.
Tell the user: (a) search has a short indexing delay, so a record created seconds earlier may not
be found yet and the previous newest is updated instead; (b) the search API's rate limit (~5 req/s
per account) is stricter than the normal API's; (c) `associations.{type}` search doesn't work for
custom objects.
Verify offline before handing over: deep-diff vs the original shows only the lookup + transform
nodes changed; edges/config identical; the search body is valid JSON after `{{…}}` substitution;
every consumer of the transform's output still reads the same key.

## 45. Deal / company name on create/update — **report only, user decision: keep as is**
User decision (2026-10-02, final): **keep the deal and company naming exactly as the workflow already has it.
Don't propose mapping-first naming, write-back of the current name, or dropping the hardcoded name.**
For Email Sent and Link Clicked that means:
- Update Deal sets `dealname` = first + last name (Email Sent `{{first}}{{last}}` with no space,
  Link Clicked `{{first}} {{last}}` with a space, each matching its own create path). Update Company sets
  `name` = `prospect.company` and `domain` = `prospect.companyDomain`. Combined with #44, the contact's
  newest deal/company gets renamed this way; the user accepts that.
- Create paths are untouched (Email Sent's hardcoded name overrides a mapped one; Link Clicked's mapping wins).
History: a mapping-first version (pick-name code node: mapping → current name → fallback) was built and then
rejected and deleted. Don't rebuild it unless the user asks again.

## 46. Field-mapping / payload type mismatch — **auto** when the target type is confirmed, else **ask**
User rule (2026-10-06): one side int, other side string always ends in an error, so every mapped
field is type-checked before testing.
Detect: for each templated value sent to an API (mapping node output, `custom` action body, CRM
create/update body), compare the source type (trigger payload / upstream node output) with the
target type (Saleshandy DTO in edge, prospect-field type, CRM property metadata). Mismatches:
number ↔ string, boolean ↔ `"true"`/`"false"` (see #11), array ↔ scalar (see #21), date-only ↔
datetime (see #37), value not in the target picklist/enum, object where a JSON string is expected
(see #28).
Fix: convert at the one place the value is built (the mapping/code node), not in every consumer:
`Number(x)` / `String(x)`, ISO datetime, picklist lookup. Empty source stays empty (no `0`, no
`"null"`). Target type not confirmable from code or API metadata → **ask**.

## 47. Transform output read without `.result` — **auto**
Found live 2026-10-06 (Salesforce Email Sent, 41 nodes). A `transform` node (JSONata) returns
`{"result": {...}}`, so readers must use `{{node.<T>.body.result.<key>}}`. `{{node.<T>.body.<key>}}`
resolves to empty silently: every "exists?" rule is false (always create → duplicate errors, update
branches never run), lookups by name use `''`. Code nodes (`codeexecutornode`) and internal
`Mapping Function` return their value unwrapped (`node.X.body.<key>` is right for those).
Detect: any `node.<id>.body.<x>` where `<id>` is a `transform` node and `<x>` != `result` — check
`input_data`, the top-level `query` copy, and `node_rule` slots. Prove with one run log: the
transform OUT shows `result`, the rule IN shows the slot missing.

## 48. Prospect phone template uses `prospect.phone` — **auto**
The Saleshandy event payload builds prospect keys by camelCasing the field label
(`src/settings/integration/integration.service.ts:425`), so "Phone Number" → `phoneNumber`.
`{{event.body.prospect.phone}}` is always empty. Also present in the HubSpot Email Sent / Link
Clicked workflows (report there before changing). Fix: `{{event.body.prospect.phoneNumber}}`.

## 49. Salesforce composite request hides sub-request failures — **flag**
`/services/data/vXX/composite` with `allOrNone: false` returns HTTP 200 even when the sub-request
is 400, so the node shows Success and nothing is created. Any unresolved template that becomes a
key (`task[undefined]`) gives `INVALID_FIELD` there. When a composite node "succeeds" but the
record is missing, read `compositeResponse[].httpStatusCode` in the log, or reproduce the body
directly. Connector built-in create/update actions drop empty-string fields, so `"Title": ""` does
not blank a value (not a bug).

## 50. Free text pasted raw into a JSON request body — **auto**
An `httprequest` node whose `body` is JSON built by string templating (e.g. Salesforce composite Task
`"Description": "... {{event.body.receivedReplyMessage}} ..."`) breaks as soon as the value contains
`"`, a line break or `\` — real reply HTML, email text and sequence names always do. Result: no record,
run still COMPLETED (often hidden further by #49). Seen: SF Reply Received node 107 (0 Tasks for every
real reply). Fix without new nodes: have an existing code node return `JSON.stringify(v).slice(1, -1)`
copies (`text_json`, `reply_json`, …) and use those in the body. Check every templated free-text value
inside any JSON `body` string.

## 51. Rule compare value does not match the option value exactly — **auto**
`contains` against the multi-select Actions list is an exact element match, so a typo in
`compare_value` (`"update -opportunity"` with a stray space) makes the branch dead with no error.
Diff every rule's `compare_value` against the `possible_options[].value` of the field it reads.
Seen: SF Reply Received node 75.

## 52. "Empty gate = run always" rule never true (`is_null` on an unset config field) — **auto**
Outcome gates like `Select Outcome (while …)` are written as `OR [{field} eq newOutcome, {field} is_null]`.
When the field is not configured, the whole-string template resolves to undefined and Refold **drops**
`data_slot_id` from the clause, so both clauses evaluate false and no action runs unless every gate is set
(live: SF Prospect Outcome P1, all 9 gates `rule_result:false`). Same pattern exists in the HubSpot Prospect
Outcome workflow (`compare_value: null`) — report there. Fix without new nodes: keep both original clauses
and ADD `"#{{workflow.fields.X}}#"` eq `"##"` OR eq `"#null#"` (an embedded empty template renders as '' in
node fields; not yet proven inside a rule — additive, so worst case = old behaviour). Verify with an
empty-gate retest. CONFIRMED live 2026-10-06 (SF Prospect Outcome V2-P1): renders `##`, gate passes.

## 53. JSONata `record[{Field:"…"}]` is not a filter — **info**
An object literal inside `[...]` is always truthy, so `record[{Email:"x"}].Id` returns every record's Id
(first one when there is one). It is harmless when the SOQL already filters (most SF transforms), so a wrong
value inside it (`Email: firstName`, SF Prospect Outcome node 66) is **not** a bug — don't "fix" it. A real
filter is `record[Email = "x"]`; only matters if the query can return several records.

## 54. Rule reads an option the config field does not offer — **auto**
Found 2026-10-06 (SF "Sequence Email is Opened", v1): rule 75 checks `Actions contains "update-opportunity"`, but the
`Actions` config field's `possible_options` had no `update-opportunity` (siblings Email Sent / Reply Received have it; webui
`triggers-and-activity/utils/helper.ts:314` offers it). Branch unreachable from the workflow's own options.
Detect: every `compare_value` a rule tests against a multi-select config field must be in that field's `possible_options`
(the #51 check run in the other direction). Fix: add the option to `config_fields[].possible_options` only; don't touch the
saved value or any other config field. Proven live: V7 rule 75 true after the fix.
Recurrence (2026-10-12, SF Call Logged): an option added in v2 was **gone again** in the next live export (every node
identical to v2, only `config_fields[0]` lost `record-call-activity`). So re-check #54 on every new export, even of a
workflow already fixed. If it disappears a third time, the reset is on the Refold side, not in the JSON.

## 55. Loop `fanout_array` fed straight from an optional multi-select config field — **auto**
Found live 2026-10-07 (SF "Lead is created (V1)", run I1): group 68 `fanout_array = {{<Select a list>}}`; nothing selected →
`Field with label Fanout Array is required, currently set to undefined` → whole run ERRORED before any record was read.
An **empty array** is fine (live: SF Email-Sent S13 `fanout_array: []` → group Success, run COMPLETED).
Fix without new nodes: an upstream code node returns the field normalised to an array (`toList`: array / JSON string /
comma string / empty → `[]`) and the group reads that. Detect: any `fanout_array` whose template is a config-field slot.

## 56. Stored cursor written back with the value read at run start — **auto**
Found 2026-10-07 (SF Lead Created v1): code node returns `ts` = stored timestamp (or now−6 min), and the "add/update
timestamp record" nodes after the loop store that same `ts` → cursor never advances, every run re-processes everything since
the first run (re-applies tags/status/unsubscribe; >LIMIT rows lost). Fix: the same code node also returns `next_ts =
new Date().toISOString()` (run start) and the table nodes store `next_ts`. Detect: table add/update node whose value is the
same template the query reads as its lower bound.

## 57. Loop child reads a node its own iteration skipped — **auto** (defensive)
Found 2026-10-07 (SF "Call Logged in Saleshandy" v1, static). Inside a `group` loop, node 202 (SOSL by phone) has a
node_rule `array_item.soslQuery exist`; Opportunity items never have one, so 202 is skipped on that iteration, and 203
still runs (a rule-skipped node does not stop its children, proven on SF Lead-Created L1). If `{{node.202.body}}` still
holds the previous iteration's body, the Contact matched by phone becomes the Opportunity's WhatId. Fix without new
nodes: pass `{{node.<group>.body.array_item}}` into the consumer and read each lookup result only when the item asked
for it (fall back to old behaviour when the item is unreadable). Not yet proven live either way.
Also from this round: a workflow **cloned** from a fixed one can silently lose later fixes (here Email-Sent v4's
Account `soql_name`). Always diff a clone node-by-node against the latest signed-off sibling.

## 58. Create branches run on an event with no prospect — **flag**
Call events (`call-logged`, `call-outcome-updated`) can have no linked prospect: `prepareProspectPayloadForEvent` returns
`{}` (`integration.service.ts:413`). Every ticked create branch then tries to create a Contact/Lead/Opp/Account with an
empty LastName/Name, so you get REQUIRED_FIELD_MISSING on every such call. Update branches are safe (an email lookup with
`Email != null AND Email=''` finds nothing). Fix without new nodes: add a second AND clause to each create rule, on the field
that branch is keyed on: `{{event.body.prospect.email}} exist` (contact/lead/opportunity), `prospect.firstName exist` (account,
named after the person). An unresolved slot makes `exist` false, the same thing the "X exists?" rules rely on. Leave the
call-activity branch alone: it matches by phone. Applied in SF Call Logged v4 (not yet live-proven). Check Call Outcome Updated too.

# Zoho (Saleshandy → Zoho) lessons (2026-10-12, 7 old workflows → `integration-tests/zoho/staging/*/v2-static-fixes.json`)
Shape: Start → (category gate) → 5 OR-rules over `Select Pipedrive Action1..11` (names copied from Pipedrive; never rename,
saved configs use them) → Account/Contact/Lead/Deal = get_prospect_fields → Mapping Function → `upsert_*` → `create_note`;
Task = Contacts search → exists? → task / (upsert contact → task). Upsert already is find+update/create: don't rebuild it as
search+rule+create. Bulk (#19/#21) does not apply (one prospect per event). Zoho date fields take plain `YYYY-MM-DD` (#37 n/a).

## 59. Rule value must match what the webui SAVES, not what looks correct — **flag**
#51 in reverse: webui `triggers-and-activity/utils/helper.ts` `zohoTriggersOptions` saves `create- contact` (with a space).
Workflows comparing `create-contact` have a dead Contact branch. Always read the CRM's option list in that file before "fixing"
a compare value. Fix used: accept both spellings (11 + 11 OR clauses) so a later webui fix doesn't break it again.

## 60. Setting read by the wrong action — **flag**
Zoho deal closing date was computed from `Due In` (Task setting). Which settings an action shows comes from webui
`get-data-slots-has-configuration-setting.ts` (Zoho: Task hides /Layout|Stages|Pipeline|Closing/, Deal hides
/Layout|Subject|Module|Status|Priority|Due/). Check every `{{workflow.fields.X}}` a branch reads is shown for that branch.
Same file hides `Select Layout` for Deal, and Pipelines/Stages are its children → the layout/pipeline deal variants are
unreachable from the UI (webui bug, reported, not changed).

## 61. Webui option key typo `:Meeting Booked` — **ask** (webui, all CRMs)
`saleshandy-webui/src/components/settings/components/integrations/utils/helper.ts:48` `staticOptionsForCategory` key
`:Meeting Booked`; the event sends `Meeting Booked` → category gate never matches Meeting Booked. Report on every
outcome/category workflow until the webui key (and saved values) are fixed.

## 62. Zoho search "no match" passes an `exist` rule — **auto**
Zoho `GET /crm/v2/<Module>/search` answers 204 No Content when nothing matches; the Zoho connector returns
`{"data":[],"type":"Buffer"}`. A rule `{{node.X.body.data}} exist` is **true on `[]`**, so the "not found" branch never runs
(live: orphan Task with `Who_Id: {}`, no contact created). Always test `{{node.X.body.data.0.id}}`. Same for related lists
(`/Contacts/{id}/Deals` with no deals → empty body).

## 63. Child of a skipped/failed record still runs → run ERRORED — **auto**
A node_rule skip (or a failed upsert) does not stop its children (#57). A `create_note` under it runs with an empty
`Parent_Id` → 400 MANDATORY_NOT_FOUND → whole run ERRORED. Give every note node_rule "<Parent_Id template> exist".

## 64. Zoho deal upsert matches by Deal_Name — **flag/structural** (user rule = #44)
`upsert_deal` dedupes on Deal_Name: re-events reset Stage/Closing_Date, with same-named deals the **oldest** is updated,
and deals are never linked to the contact. User rule: link deals to the contact (`Contact_Name: {"id"}`) and update the
contact's latest deal: `GET /crm/v2/Contacts/{id}/Deals?sort_by=Created_Time&sort_order=desc&per_page=1` (sort proven both
ways) → `PUT /crm/v2/Deals/{id}` with mapped fields + Closing/Pipeline/Stage from settings (empties dropped; `{"data":[{}]}` → 200).
No contact / no linked deal → keep the upsert. Implemented in `integration-tests/zoho/patches-shared/v3_latest_deal.py`.

## 65. Zoho rejects the whole record for one mistyped mapped value — **report (user: customer-side)**
`additional_fields` value Zoho can't coerce → 400 INVALID_DATA, no record: text "11-50" → integer, URL → Twitter handle,
SH date `YYYY-MM-DD HH:mm:ss` → date. Numeric strings ("25") are coerced fine, unknown picklist values are accepted.
User decision 2026-10-12 (as SF B5): customer's mapping choice, document only.

## 66. Live-test harness notes (Refold) — **process**
- Refold app config: `GET $REFOLD_PUBLIC_BASE/slug/<crm>/config/<config_id>` with org `x-api-key` + `linked_account_id`.
  Field mappings are saved with `PUT config/field/<appFieldId>` (no workflow_id); null mapping = setup gap, not a bug.
- The linked-account session token expires: renew via edge `GET /integration/session-token` (SH JWT).
- An execution can be COMPLETED before its last nodes are logged: wait ~20 s before fetching node detail.
- Saleshandy sequence settings via Open API accept numeric codes only (`{"code":5,"value":"1"}` = track opens).

## 67. Two parallel branches create the same CRM record — **structural** (Zoho v3 → v4, user chose "shared step")
Zoho upsert is not atomic across simultaneous calls: Contact branch + Task branch's "create contact if missing" for a
brand-new prospect → 2 contacts with the same email (v3 A1). Fixing an orphan (#62) can expose this. Fix used: one shared
"Contact or Task selected?" → fields → mapping → upsert step before the fan-out; Task (Who_Id) and Deal (Contact_Name)
read its id; a no-op join (catalog #20 pattern: incoming = upsert + rule.false) holds the Deal branch until it finished.
Patch: `integration-tests/zoho/patches-shared/v4_shared_contact.py`.
