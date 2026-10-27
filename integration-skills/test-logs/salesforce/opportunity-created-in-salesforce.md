# Salesforce — "Opportunity is created in Salesforce" — test log

- CRM: Salesforce (Developer org) · Env: staging · Refold workflow (user copy / export_id) `682d6bf5bcc93496f88fdb28`, template `661d2ac08c9a18bbd551e1ca`
- Direction: **CRM → SH**. Trigger: Cobalt **Schedule**, cron `0 */3 * * *` (every 3 h). Not a webhook.
- v1 = `v1-original.json` (35 nodes, 33 edges, 9 config_fields), extracted verbatim from the session transcript.
- Sibling: `../contact-created-in-salesforce/` — **same graph node-for-node** (only ids and the SOQL object differ). Its v1→v5 findings apply here; ids map 3↔54, 36↔67, 6↔56, 5↔55, 37↔86, 9↔58, 38↔87, 11↔60, 12↔61, 13↔62, 14↔63, 15↔64, 16↔65, 17↔66, 18↔69, 19–22↔78–81, 23–26↔70–74, 43↔95, 45↔94, 35↔53.
- State at start (2026-10-06 ~09:50 UTC): **no runs** for this workflow (execution list empty). 88 Opportunities in the org; 6 created in the last 2 days, all by the parallel test terminals.
- Per-workflow env: `~/.config/sh-integration-testing/wf-salesforce-opportunity-created.env` (WF_EXPORT_ID, SLUG, 9 CFG_* ids).

## Flow (v1)
```
Start (cron 3h) → 43 code: ts = instance_created_time − 3h
 → 45 salesforce incremental_sync  SOQL: SELECT FIELDS(ALL) FROM Opportunity WHERE CreatedDate>={{timestamp}} LIMIT 200
 → 35 loop over records (entry 3)
     3 rule actions contains blacklist-domain
       ├ true  → 36 transform {domain: substringAfter(contact.Email,"@")} → 6 Blacklist a Domain
       └ false → 5 Get Prospect Fields → 37 code (fields) → 9 Add Prospect → 38 Encode email → 11 Get Prospect Id → 12 exists?
                   ├ 14 unsubscribed? → 16 change_prospect_status (no status, no sequence)
                   ├ 15 assign-tag?   → 17 Assign a Tag
                   └ 13 add-prospect-in-sequence-step?
                        ├ true  → 18 Add to Sequence (step-id only) → 22 replied? 27 · 19 finished? 28 · 20 paused? 29 · 21 resumed? 30
                        └ false → 23 replied? 34 · 24 finished? 33 · 25 paused? 32 · 26 resumed? 31
```

## Salesforce facts (read-only, `runs/*-setup-sf-*`)
- `Opportunity` describe: **no Email, FirstName, LastName fields**. Person link = `ContactId` (lookup, mostly null) and the `OpportunityContactRoles` child relationship. Required on create: Name, StageName, CloseDate.
- `SELECT FIELDS(ALL), (SELECT Contact.Email, Contact.FirstName, Contact.LastName, IsPrimary FROM OpportunityContactRoles) FROM Opportunity` is **valid SOQL** (probe 200).

## v1 → audit (static, before any live call)
| # | Node | Finding | Catalog | Tier | Expected live symptom |
|---|---|---|---|---|---|
| A1 | 37, 36 | Reads `Email` / `FirstName` / `LastName` from the **Opportunity** record — those fields don't exist on Opportunity. Only `Opportunity Properties` map values can fill fields; nothing reads the related Contact (OpportunityContactRoles / ContactId) | #25/#26 (SF analogue of HubSpot Deal → contacts), ref v17 | **ask (structural)** | import row without email → import error / nothing imported; Get Prospect Id empty; tag/status/sequence never run; blacklist domain = undefined |
| A2 | 3 (+ every action rule) | `contains` on `{{workflow.fields.Saleshandy actions}}`; unset field → `QUERY_EVALUATION_ERROR: cannot call includes on undefined` | B2 of contact-created | auto | every iteration fails at 3 when no action selected |
| A3 | 45 | `CreatedDate>={{timestamp}}` placeholder not applied → whole table fetched (contact-created B1, live-confirmed there) | — | ask (user kept query as-is on contact-created) | first run processes all 88 Opportunities |
| A4 | 37 → 9 | output is a flat `[{id,value}]`; `/v1/prospects/import` needs `{prospectList:[{fields}], conflictAction}` | #46 | auto | Add Prospect 400 |
| A5 | 18 | Add to Sequence has **no `prospects` input** at all (fingerprint `prospects|step-id`; contact-created node 69 had it) | #46 | auto | add-to-sequence 400 / nothing added |
| A6 | 37 | map loop pushes `id: <mapping key>` (e.g. `email`) not the Saleshandy field id; `map_fields` used without parsing (string → `Object.keys` of chars) | #6/#28 | auto | mapped fields dropped or rejected |
| A7 | 6 | `{{node.36.body.domain}}` without `.result` | #47 | auto | blacklist with empty domain |
| A8 | 21, 26 | compare `mark-as-resumed`; option value is `mark-as-resume` | #51 | auto | resume branch never fires |
| A9 | 16 | "Mark as unsubscribed" = `change_prospect_status` with **no status / sequence** | #23 | ask (approved on contact-created → `unsubscribe_prospects_upd`) | status API 400 |
| A10 | 30 vs 31 | resume status `resumed` on node 30, `active` on node 31 — two different values for the same action | #38 | check live | one of the two 400s |
| A11 | 3/36/6 | per-record blacklist inside the loop instead of one bulk call; blacklist selected → import + every other action skipped | #21, ref v17 | flag (structural — contact-created v5 bulk pattern approved) | |
| A12 | 18 → 19–22 | statuses on the add-to-sequence path only run if 18 succeeds | #24 | report | |
| A13 | 45 | `LIMIT 200`, no pagination; 3 h window overlap on boundary | — | report | |
| A14 | — | option `add-prospect-in-account` has no rule; import always runs unless blacklist | — | report | |
| A15 | 17/29/32/27… | tags / pause days / sequence-id types from text config | #46 | check live (same as contact-created, no evidence of error) | |
| A16 | 36 | transform input wraps the record in a JSON string `"{{…array_item}}"` | — | check live | |

Checks passed: no hardcoded URL (#43); every `custom` node uses a validated action id (`saleshandy-web-apis.md`); loop keys (`fanout_array`, `array_item`, `parentNode`/`extent`) OK; no `JSON.parse`; no bracket templates.

## Cross-workflow risk (test setup)
The workflow processes **every** Opportunity in its window (with A3: the whole table). The parallel terminals (email-sent, prospect-outcome) create `rudra+sf-*` Opportunities all the time. So:
- **blacklist-domain is gated** (would blacklist saleshandy.com / gmail.com) — needs the user's explicit yes per run.
- Any tag/status selected applies to their prospects too (status only inside our own test sequence).

## Scenario matrix
Each run = one execution over all Opportunities in the window. Actions set via config PUT before each run. Test records: SF Contact `rudra+sf-oc-<scenario>@saleshandy.com` + an Opportunity linked to it (ContactId + OpportunityContactRole).

| ID | Actions | SF records (created by REST) | Checks |
|---|---|---|---|
| I1 | (none) | Opp `SF-OC I1` + contact `rudra+sf-oc-i1` (role, primary) | A2 crash, A3 window, A1 (no email), mapping value from node input |
| I2 | add-prospect-in-account | same as I1 | A1, A4, A6 (prospect created? which fields) |
| I3 | add-prospect-in-account | Opp with no contact | no-email handling |
| S1 | add-prospect-in-sequence-step (+own seq/step) | `rudra+sf-oc-s1` | A5 |
| T1 | assign-tag (Tags `sf-oc-test`) | `rudra+sf-oc-t1` | A15 |
| U1 | mark-as-unsubscribed | `rudra+sf-oc-u1` | A9 |
| P1 | add-prospect-in-sequence-step + mark-as-paused (+days 2) | `rudra+sf-oc-p1` | 18→20→29 |
| P2 | mark-as-paused only | reuse p1 | 25→32 |
| F1 | mark-as-finished | `rudra+sf-oc-f1` (in seq) | 24→33 / 19→28 |
| R1 | mark-as-replied | `rudra+sf-oc-r1` (in seq) | 23→34 / 22→27 |
| RS1 | mark-as-resume | reuse p1 | A8, A10 |
| B1 | blacklist-domain | **gated** | A7, A11 |
| X1 | re-run, no new Opp | — | idempotency |

## v1 → live pass
Not run. User (2026-10-06): workflow enabled but no options in the UI yet — fix offline first, keep the current structure, ask before any structural change.

## v2 — `v2-contact-roles-bulk-blacklist.json` (offline; user decisions 2026-10-06)
Decisions: Contact-Created v5 bulk-blacklist pattern **yes** · contact source = **all contact roles** · time window `{{timestamp}}` **kept as is**.
Patch: `patches/v2_contact_roles_bulk_blacklist.py` (self-checking). 35 → 38 nodes, 33 → 35 edges. No node removed.
- **Structural (approved):** + 96 `Prepare - Actions, Contacts & Domains` (45 → 96 → loop 35): `actions` list (never undefined), `rows` = one per Opportunity contact role (Opportunity fields + contact Email/FirstName/LastName, primary first, deduped by email, roles without email skipped), `domains` = unique lowercase domains of those emails. + 97 rule (blacklist-domain AND domains.0 exists) → + 98 `Blacklist Domains Bulk` (`6abcfffa5f7bd2f2319f4038`). Loop 35 `fanout_array` → `{{node.96.body.result.rows}}` (one iteration per contact; loop children unchanged). Rule 3 yes-edge to 36 removed; 36/6 kept as orphans.
- A1 · 45 query: + `(SELECT IsPrimary, Contact.Email, Contact.FirstName, Contact.LastName FROM OpportunityContactRoles)`; WHERE/LIMIT untouched. (`Opportunity.ContactId` has no traversable relationship — probe INVALID_FIELD; every Opportunity with a ContactId has a primary role.)
- A2 · 12 action rules → `{{node.96.body.result.actions}}`.
- A4/A6 · 37: identity from the row; other fields from `Opportunity Properties` (`mappingDefaultField || toMappingKey(label)`, map parsed if string, dotted paths); strings only; returns `{prospectList:[{fields}], conflictAction:"upsert", verifyProspects:false}`.
- A5 · 18: + `prospects = {{node.37.body.result.prospectList}}`.
- 38: email from `{{node.35.body.array_item.Email}}` (was the async import response); throws on empty (no blank Get Prospect Id search).
- A8 · 21, 26: `mark-as-resumed` → `mark-as-resume`. A10 · 30: `resumed` → `active` (Open API `ProspectsUpdateStatusDto`: finished|paused|replied|unsubscribed|active).
- A9 · 16: → `unsubscribe_prospects_upd` (`6aa3a571686cab0157a32ce0`), input `prospect-id` only.
- A7/A11 resolved by 98 (bulk, outside the loop); orphan 6 input left untouched (never runs).

Offline verification (real data, `runs/*-offline-sf-all-opps-v2-query.json`, real `/v1/fields` list): 49/49 checks pass — 88 Opportunities → 40 with roles → 15 unique contact rows; domains [saleshandy.com, gmail.com, qamail.dev]; actions undefined/null/""/"null"/[]/string/JSON-string all normalised; records as array == as JSON string; mapping object == JSON string, missing/broken map still sends identity; all values non-empty strings; encode `+`/`@`, throws on empty.
Graph walk: each of 13 action sets runs exactly its own action node(s); blacklist runs only 98 (once per run). Catalog sweep on live nodes: no #43 URL, no raw actions slot, no #47, no #51 mismatch, no #23, no unguarded JSON.parse.

Still open (reported, not changed — user decisions / design):
- A3 window not applied: every run fetches up to 200 Opportunities (today all 88). With blacklist-domain selected that blacklists saleshandy.com, gmail.com, qamail.dev. Upsert/tag/status are idempotent.
- Blacklist selected → import and every other action skipped (as v1, HubSpot rule 29, Contact-Created v5).
- Opportunities with no contact role are skipped (nothing to import).
- A12–A15 unchanged (statuses after add-to-sequence depend on 18; 200 cap; no rule for add-prospect-in-account; tags/pause-days types as in HubSpot).
- Company is not filled by default (Account.Name not queried); map it in Opportunity Properties if needed.

## v3 — `v3-mapping-only.json` (patch `../../patches-shared/mapping_fix.py`, user rule 2026-10-12: every field from the mapping, as HubSpot v17)
From `v2-contact-roles-bulk-blacklist.json`. 43 returns `{ts, contact_fields}` (identity + valid field names from Contact Properties); 45 `initial_timestamp` → `{{node.43.body.ts}}`, roles subquery selects `{{node.43.body.contact_fields}}` (read-only probe of the built query: valid); 96 rows carry `__contact`; 37 as Account. Offline on 19 real rows: +Job Title 11, +Phone 11, +Department 4, nothing removed. **Needs one live run**: node reference inside the incremental_sync `query_string` not yet proven on Refold.
Mapping keys: tries mappingDefaultField, edge label key (default fields), lodash camelCase (custom fields), old toMappingKey — matched the webui key for all 252 non-identity real Saleshandy field labels. Map as JSON string = object; missing/broken map → Email/First/Last only.
Self-check: only the listed nodes' input_data changed; graph/config identical. Catalog re-scan: no new finding. Not live-tested.

### v3 live (2026-10-12)
| # | Execution | Result |
|---|---|---|
| M1 | 6acc995b06dc0b16264a352f | 43 → `contact_fields` from Contact Properties; 45 query resolved `{{node.43.body.contact_fields}}` correctly (**templating proven**); errored `invalid_grant` = Refold SF connection expired (setup) |
| M1b | 6acc99ea06dc0b16264a804f | **PASS** after reconnect: prospect rudra+sf-m-opp got Phone/Job Title/Department (Contact Properties) + Deal Value 4321 (Opportunity Properties) |
