# Salesforce — "Contact is created in Salesforce" — test log

- CRM: Salesforce (Developer org) · Env: staging · Refold workflow (user copy / export_id) `682c2c26bcc93496f883fea0`, template `65f8235ad37a877b8adbcfae`
- Direction: **CRM → SH**. Trigger: Cobalt **Schedule**, cron `0 */3 * * *` (every 3 h). Not a webhook.
- v1 = `v1-original.json` (35 nodes, 33 edges, 9 config_fields), extracted verbatim from the session transcript.
- State at start (2026-10-06 06:00 UTC): workflow **disabled** for linked account 80121, no past runs.
- Test sequence `195939` (hash `VMw56AolPb`), email step `mlP0jL8YzX`, **not activated** (nothing gets sent).
- Prospects / SF contacts: `rudra+sf-cc-<scenario>@saleshandy.com`.
- Contact Properties mapping (app level, user 80121): firstName→FirstName, lastName→LastName, email→Email, phoneNumber→MobilePhone, jobTitle→Title, department→Department.

## Flow (v1)
```
Start (cron 3h) → 95 code: ts = instance_created_time − 3h
 → 94 salesforce incremental_sync  SOQL: SELECT FIELDS(ALL) FROM CONTACT WHERE CreatedDate>={{timestamp}} LIMIT 200
 → 53 loop over records (entry 54)
     54 rule actions contains blacklist-domain
       ├ true  → 67 transform {domain} → 56 Blacklist a Domain (domains={{node.67.body.domain}})
       └ false → 55 Get Prospect Fields → 86 code (fields) → 58 Add Prospect → 87 Encode email → 60 Get Prospect Id → 61 exists?
                   ├ 63 unsubscribed? → 65 change_prospect_status (no status, no sequence)
                   ├ 64 assign-tag?   → 66 Assign a Tag
                   └ 62 add-prospect-in-sequence-step?
                        ├ true  → 69 Add to Sequence → 78 resumed? 82 · 79 paused? 83 · 80 finished? 85 · 81 replied? 84
                        └ false → 70 resumed? 71 · 72 paused? 75 · 73 finished? 76 · 74 replied? 77
```

## Cross-workflow risk (test setup)
The workflow processes **every** Contact created in the last 3 h, not just ours. The parallel "Email Sent" test
terminal creates `rudra+sf-*@saleshandy.com` contacts all the time. So:
- **blacklist-domain would blacklist `saleshandy.com`** → gated, needs the user's decision before any run with it.
- Their contacts also get imported into Saleshandy (upsert) and get any tag/status we select (status only within our sequence 195939).

## v1 → audit (static, before any live call)
| # | Node | Finding | Catalog | Tier | Expected live symptom |
|---|---|---|---|---|---|
| A1 | 87 | "Encode email" `code_string` is **empty** | — | blocker | node 87 fails / no output → 60 gets no email → 61 false → no tag/status/sequence ever runs |
| A2 | 56 | `{{node.67.body.domain}}` reads a transform without `.result` | #47 | auto | blacklist called with empty domain (error or no-op) |
| A3 | 70, 78 | rule compares `mark-as-resumed`; the option value is `mark-as-resume` | #38-like typo | auto | resume branch never fires |
| A4 | 65 | "Mark as unsubscribed" = `change_prospect_status` with **no `status`** and no `sequence-id` (plus a pause-delay) | #23 | ask | status API 400 (`status` required) |
| A5 | 86 | mapping ignores `Contact Properties` (code commented out); only Email/First/Last/Company | #6/#27/#28 | flag | MobilePhone/Title/Department never reach Saleshandy |
| A6 | 86 | First/Last name from `Name.split(" ")[0/1]` instead of `FirstName`/`LastName` | #46 | auto | "Van Dyke" → last name "Van"; LastName-only contact → first name = last name |
| A7 | 86 | Company from `Account.Name`; `FIELDS(ALL)` returns only `AccountId` | #25 | flag | Company always empty |
| A8 | 86 → 58 | output is a flat `[{id,value}]`; `/v1/prospects/import` needs `{prospectList:[{fields}], conflictAction}` (HubSpot ref node 40 sends that) | #46 | auto | Add Prospect 400 / nothing imported |
| A9 | 86 → 69 | sequence `prospects` gets the same flat array; HubSpot ref sends `prospectList` | #46 | auto | add-to-sequence 400 |
| A10 | 87 | reads `{{node.58.body.payload.0.email}}`; import API is async (returns requestId), probably no email in payload | — | check live | encode gets undefined |
| A11 | 54 | blacklist-domain makes the flow skip import **and** every other action for that run | ref v17 | report | sequence/tag/status not done when blacklist also selected |
| A12 | 69 → 78–81 | statuses on the add-to-sequence path only run if node 69 succeeds | #24 | report | |
| A13 | 54/67 | contact without Email → `$substringAfter(undefined)`; import row without email | #4/#30 | flag | blacklist with "" / import error |
| A14 | 94 | `LIMIT 200`, no pagination; window `>= now−3h` with a 3 h cron overlaps on the boundary | — | report | >200 contacts in 3 h are lost; boundary contact processed twice |
| A15 | — | option `add-prospect-in-account` has no rule; import always runs unless blacklist | — | report | |
| A16 | 66 | `tags` = config value (UI saves an array of names); API wants `string[]` | #46 | check live | |
| A17 | 65/75/83 | `pause-delay-in-days` text config; API `pauseDelayInDays: number` | #46 | check live | |
| A18 | 75/76/77/71/82–85 | `sequence-id` = numeric id saved by the UI (`sequences/list` → `id`); Open API example is a hash | #46 | check live | |
Checks passed: no hardcoded URL (#43); every `custom` node uses a validated action id; loop keys (`fanout_array`, `array_item`, `parentNode`/`extent`) OK; no `JSON.parse`; no bracket templates.

## Scenario matrix
Each run = one execution over all contacts created in the last 3 h. Actions set via config PUT before each run.

| ID | Actions | SF contact (created by REST) | Checks |
|---|---|---|---|
| I1 | (none) | rudra+sf-cc-i1, First/Last, MobilePhone, Title, Department, Account | prospect created; first/last/email; phone/title/dept (A5); company (A7); A8, A10 |
| I2 | (none) | rudra+sf-cc-i2, LastName only `Solo` | A6 |
| I3 | (none) | rudra+sf-cc-i3, `Anna` / `Van Dyke` | A6 |
| I4 | (none) | no Email, LastName `NoEmail` | A13 |
| S1 | add-prospect-in-sequence-step (+seq 195939, step mlP0jL8YzX) | rudra+sf-cc-s1 | prospect in step; A1, A9 |
| T1 | assign-tag (Tags `sf-cc-test`) | rudra+sf-cc-t1 | tag on prospect; A16 |
| U1 | mark-as-unsubscribed | rudra+sf-cc-u1 (in seq from S1-style add) | A4 |
| P1 | add-prospect-in-sequence-step + mark-as-paused (+days 2) | rudra+sf-cc-p1 | 69→79→83; A17, A18 |
| P2 | mark-as-paused only (prospect already in seq) | reuse p1 | 72→75 |
| F1 | mark-as-finished | rudra+sf-cc-f1 (in seq) | 73→76 / 80→85 |
| R1 | mark-as-replied | rudra+sf-cc-r1 (in seq) | 74→77 / 81→84 |
| RS1 | mark-as-resume (paused prospect) | reuse p1 | A3 |
| B1 | blacklist-domain | contact on a non-saleshandy test domain | **gated** (see risk); A2 |
| X1 | re-run with no new contact | — | idempotency: same contacts re-processed (A14) |

## v1 → live pass (2026-10-06, API-only)
Workflow enabled by the user in the UI at ~06:08 UTC (confirmed by config GET: `enabled: true`, all fields `null`).
Manual run: `POST https://app.refold.ai/api/v2/public/workflow/682c2c26bcc93496f883fea0/execute` (linked-account token, `slug: salesforce`) → 200 `{execution_id}`. Works for this cron workflow.

| Run | Execution | Actions | SF records | Result |
|---|---|---|---|---|
| I1 | 6ac490b2c5f737ddd92bb82c | none | Account 001dL00002ZC7tNQAT, Contact 003dL00002dNgYXQA0 `rudra+sf-cc-i1` | **FAIL**. 94 returned **all 55 org contacts** (CreatedDate 2026-07-28 → now), not the 3 h window. Loop 53: `group node failed: 55 batch(es) errored`. Prospect `rudra+sf-cc-i1` not in Saleshandy. Loop children are not in the node log. |

### Bugs found so far
- **B1 [PLATFORM?/JSON] Start → 94 incremental_sync** — Expected: only contacts with `CreatedDate >= 03:09:54Z` (input `initial_timestamp`). Actual: 55 records back to 2026-07-28. The `{{timestamp}}` placeholder was not applied as the window. Root cause: TBD (first-run behaviour of `incremental_sync` vs. placeholder). Impact: first run after enabling processes the whole Contact table (capped at 200), so blacklist-domain would blacklist every domain in the org (gmail.com, saleshandy.com).
- **B2 [JSON] loop 53 → every iteration errors** — Expected: prospect imported. Actual: 55/55 batches errored, nothing imported. Suspects from audit: A8 (flat fields array instead of `{prospectList, conflictAction}`), then A1 (empty code in node 87). Exact failing child node not visible in the log.

## v2 — `v2-import-format-encode-email.json` (user asked for fixes 3 + 4 only; everything else unchanged)
Patch: `patches/v2_import_format_encode_email.py` (self-checking: only these 3 fields differ from v1; nodes, edges, config_fields, trigger byte-identical).
- node 86 `code_string`: only the `return` changed → `{result: {prospectList:[{fields: output}], conflictAction:"upsert", verifyProspects:false}}` (ProspectImportDto; same body as HubSpot Contact-Created node 40 / Deal v17 node 39). Field-building logic untouched.
- node 69 `prospects`: `{{node.86.body.result}}` → `{{node.86.body.result.prospectList}}` (as HubSpot node 6).
- node 87 `code_string`: was empty → `encodeURIComponent(params.email)`; throws when email is empty so Get Prospect Id never searches with a blank value. Input `{{node.58.body.payload.0.email}}` kept (import API 201 returns `payload:[{email,status}]`).
- node 58 unchanged (`fileds: {{node.86.body.result}}` now carries the full body).
Offline check (node, real data from I1 run): 86 output matches ProspectImportDto for the I1 contact; v2 fields == v1 fields for all 55 real contacts; 87 encodes `+`/`@`, throws on undefined/null/"".
Not fixed (left as is on request): B1, A2–A7, A11–A18.

## v3 — `v3-payload-fixes.json` (field-level payload fixes on top of v2; no node/edge added, removed or rewired; not live-tested yet, per user)
Patch: `patches/v3_payload_fixes.py` (self-checking: only the fields below differ from v2; edges, config_fields, trigger identical; no dangling refs; no hardcoded URL).
- B1 · node 94 `query_string`: `CreatedDate>={{timestamp}}` → `CreatedDate>={{node.95.body}}` (the run start − 3 h that node 95 already computes); adds `Account.Name`. Evidence: same query with the literal value returns 7 contacts (correct window) vs 55 in run I1. Read-only SOQL probe confirmed `FIELDS(ALL), Account.Name` is valid.
- A5/A6/A7 · node 86 `code_string`: Email/First/Last from `Email`/`FirstName`/`LastName` (no `Name` split); every other Saleshandy field from the Contact Properties mapping (`mappingDefaultField || toMappingKey(label)`, map parsed if it arrives as a JSON string); Company falls back to `Account.Name`; empty values skipped, values sent as strings, compound objects skipped. Output body unchanged from v2.
- A2 · node 56 `domains`: `{{node.67.body.domain}}` → `{{node.67.body.result.domain}}` (#47).
- A3 · rules 70, 78 `compare_value`: `mark-as-resumed` → `mark-as-resume` (the option value).
- A4 · node 65: `change_prospect_status` (no status) → dedicated `unsubscribe_prospects_upd` (`6aa3a571686cab0157a32ce0`, same app id, same as HubSpot Contact node 43 / Deal v18 node 8), input `prospect-id` only. Same node id and wiring.
Offline check on 56 real Salesforce contacts with the real Contact Properties map: I1 contact → First "Rudra", Last "CcTest I1", Email, Phone "+919876500001", Job Title "QA Lead", Department "Testing", Company "CcTest Co I1"; map as object = as JSON string; missing/malformed map still sends identity + company; no crash, all values non-empty strings.
Left as is (design / no evidence of payload error): A11 blacklist skips other actions, A13 contacts without email (iteration errors at import), A14 200 cap, A15 add-prospect-in-account has no rule, A16–A18 tags / pause days / sequence id types (same as working HubSpot workflows).
Known trade-off of the B1 fix: the window is "run time − 3 h", not a stored cursor, so a cron run that never happens is not caught up later, and a manual run re-processes the last 3 h (upsert, so idempotent).

## v4 — `v4-sh-actions-only.json` (user: keep the Salesforce fetch/scan exactly as is; only fix Saleshandy-side action bodies; no structural change)
Patch: `patches/v4_sh_actions_only.py` = v3 with node 94 reverted byte-for-byte to v1. Self-check vs v1: only nodes 56, 65, 69, 70, 78, 86, 87 differ, only in action/input fields; incoming/outgoing nodes, edges, config_fields, trigger identical.
- B1 (all contacts fetched) intentionally NOT fixed. Company stays empty (Account.Name not in the original query), as in v1.
- Node 86 checked on the 55 records the original query returned in run I1: I1 contact → First "Rudra", Last "CcTest I1", Email, Phone, Job Title, Department; all values non-empty strings; body `{prospectList, conflictAction:"upsert", verifyProspects:false}`.

### B2 root cause (from the user's node log of run I1, node 54)
`QUERY_EVALUATION_ERROR: cannot call includes on undefined`. Rule 54 (and every action rule) does `contains` on `{{workflow.fields.Saleshandy actions}}`; with no action selected the field is undefined, so every iteration crashed at 54 before the import. Tag: JSON. Reproduced offline on v1.

## v5 — `v5-bulk-blacklist.json` (STRUCTURAL, approved by user: HubSpot-style bulk blacklist, no node removed — orphan instead)
Patch: `patches/v5_bulk_blacklist_actions_guard.py` (self-checking). 35 → 38 nodes, 33 → 35 edges.
- + node 96 `Prepare - Actions & Domains` (code, between 94 and loop 53; edge 94→53 retargeted to 94→96, + 96→53): returns `{actions: list (never undefined), domains: unique lowercase email domains of all fetched contacts}`.
- + rule 97 (outside loop): actions contains `blacklist-domain` AND `domains.0` exists → + node 98 `Blacklist Domains (Bulk)` (`blacklist_domains_bulk`, `6abcfffa5f7bd2f2319f4038`, same app id, as HubSpot Deal/Company bulk files), `domains = {{node.96.body.result.domains}}`.
- 12 action rules (54, 62, 63, 64, 70, 72–74, 78–81): `data_slot_id` → `{{node.96.body.result.actions}}` (fixes B2 crash).
- rule 54: behaviour kept (blacklist selected → no import, as HubSpot rule 29 and v1); its yes-edge to 67 removed; 67 and 56 kept as top-level orphans (renamed "… (orphan - replaced by 98)"), never run.
- Untouched: node 94 input (Salesforce query), 95, loop, 55/86/58/87/60/61, every tag/sequence/status/unsubscribe node, config_fields, trigger.
Offline: Prepare code on the 55 real records → domains [saleshandy.com, gmail.com, qamail.dev, outlook.com]; actions undefined/null/""/[] → []. Graph walk for 13 action sets: each runs exactly its own action node(s); blacklist runs only 98 (once per run, not per contact); orphan 56 never reached. Catalog sweep: clean.
Note: with the unchanged query, blacklist-domain on this org would blacklist all four domains above (incl. saleshandy.com, gmail.com) — do not select it in staging tests.

## v6 — `v6-mapping-only.json` (patch `../../patches-shared/mapping_fix.py`, user rule 2026-10-12: every field from the mapping, as HubSpot v17)
From `v5-bulk-blacklist.json`. node 86 = shared mapping code (`patches-shared/mapping_code.js`); "Company = Account.Name" fallback removed (HubSpot has none; it never fired: Account.Name is not in the query). Offline on 79 real contacts: output identical to v5.
Mapping keys: tries mappingDefaultField, edge label key (default fields), lodash camelCase (custom fields), old toMappingKey — matched the webui key for all 252 non-identity real Saleshandy field labels. Map as JSON string = object; missing/broken map → Email/First/Last only.
Self-check: only the listed nodes' input_data changed; graph/config identical. Catalog re-scan: no new finding. Not live-tested.

### v6 live (2026-10-12)
| M3 / M3b | 6acc9a38db22d4964abc8811, 6acc9b39db22d4964abd89ce | COMPLETED (all nodes Success). Field-level check of a contact-only record pending: own SF token expired before the test contact could be created |
