# Salesforce — "Lead is created in Salesforce (V1)" — test log

- CRM: Salesforce (Developer org) · Env: staging · Refold export_id `681368981acc0cbcd16295c7`, template workflow_id `661cb9c48c9a18bbd54fdd87`, app `681368981acc0cbcd16294b5`
- Direction: **CRM → SH**. Trigger: Cobalt **Schedule**, cron `0 */3 * * *`. Cursor kept in Cobalt table `persistent:Created_time_new`.
- v1 = `v1-original.json` (49 nodes, 43 edges, 10 config_fields), extracted verbatim from the session transcript.
- State at start (2026-10-06 07:30 UTC): workflow **disabled** for linked account 80121, all config fields `null`, no runs for 80121.
  (Another linked account `Cb-test_2` runs this workflow every 3 h and every run is ERRORED — logs not readable with our token.)
- App-level `Lead Properties` mapping (user 80121): jobTitle→Title, city→City, state→State, country→Country, phoneNumber→Phone, email→Email, firstName→FirstName, lastName→LastName.
- Per-workflow env: `~/.config/sh-integration-testing/wf-salesforce-lead-created.env`. Prospects / SF leads: `rudra+sf-lead-<scenario>@saleshandy.com`.

## Flow (v1)
```
Start (cron 3h) → 56 create table Created_time_new → 57 get records
 → 53 code: ts = stored timestamp, else now−6min; exists; lists_exists
 → 68 loop over "Select a list" (entry 66): 66 GET listviews/<id>/describe → 65 rewrite query (+CreatedDate,Email, ORDER BY, LIMIT 200)
                                             → 67 SOQL → 69 filter CreatedDate > ts      (output: 69.records)
 → 39 code: SELECT FIELDS(ALL) FROM LEAD WHERE CreatedDate>=ts LIMIT 200
 → 41 SOQL paginated   [node_rule: 53.lists_exists eq "false"]
 → 70 code: merge 68 output + 41.records, dedupe by Id (returns a bare array)
 → 35 loop over 70 (entry 3)
     3 rule actions contains blacklist-domain
       ├ true  → 36 transform {domain} → 6 Blacklist a Domain (domains={{node.36.response:domain}})
       └ false → 5 Get Prospect Fields → 49 code (fields) → 9 Add Prospect → 50 Encode Email → 11 Get Prospect Id → 12 exists?
                   ├ 14 unsubscribed? → 16 change_prospect_status (no status, no sequence)
                   ├ 15 assign-tag?   → 17 Assign a Tag
                   └ 13 add-prospect-in-sequence-step?
                        ├ true  → 18 Add to Sequence → 22 replied? 27 · 19 finished? 28 · 20 paused? 29 · 21 resumed? 30
                        └ false → 23 replied? 34 · 24 finished? 33 · 25 paused? 32 · 26 resumed? 31
 → after loop: 60 add ts record [exists=false] · 61 update ts record [exists=true]   (both write {{node.53.response:ts}})
Orphans (no incoming edge): 52 SF http query (hardcoded date), 62 SOQL, 63 GET list-records (hardcoded list id)
```

## v1 → audit (static + read-only probes, before any live run)
Read-only probes: SF Lead describe, 4 real list-view `describe` queries run through node 65's code and executed as SOQL, SOQL with a `…000Z` datetime literal (valid), Saleshandy `/v1/fields?systemFields=true`.

| # | Node | Finding | Catalog | Tier | Expected live symptom |
|---|---|---|---|---|---|
| A1 | 3,13,14,15,19–26 | every action rule does `contains` on `{{65f826f5…}}`; nothing selected → undefined → `cannot call includes on undefined` (proven live in Contact-Created B2) | #4 | auto | with no action selected every lead errors at rule 3, nothing imported |
| A2 | 49 → 9 | 49 returns a flat `[{id,value}]`; `/v1/prospects/import` needs `{prospectList:[{fields}], conflictAction}` (ProspectImportDto, HubSpot node 40) | #46 | auto | Add Prospect 400 |
| A3 | 18 | Add-to-sequence input key is `fields` (action fingerprint `prospects|step-id`) and value `{{node.8.response:function_return_value.result}}` — **node 8 does not exist** | #38 | auto | sequence add gets no prospects (400 / nothing added) |
| A4 | 21, 26 | compare `mark-as-resumed`; option value is `mark-as-resume` | #38 | auto | resume never runs |
| A5 | 16 | "unsubscribe" = `change_prospect_status` with no status / sequence | #23 | ask (approved in Contact v3) | 400, prospect not unsubscribed |
| A6 | 36 → 6 | transform input `{"lead":"{{array_item}}"}` (object inside quotes); 6 reads `{{node.36.response:domain}}` without `.result` | #47 | auto | blacklist with empty domain |
| A7 | 60, 61 | cursor written back = `{{node.53.response:ts}}` = the value **read** at run start → cursor never moves after the first run | — | auto | every run re-fetches every lead since the first run and re-applies tag/status/unsubscribe to all of them; >200 → pages |
| A8 | 53 | first-run window is now−6 min with a 3 h cron | — | report | leads created between enabling and the first tick (older than 6 min) are skipped once |
| A9 | 65 | list-view queries select only the view's columns (`Name, Company, State, Email, Status…`) → FirstName, LastName, Phone, Title, City, Country, Website, Industry… missing | #25/#26 | auto | list-path prospects imported without first/last name, phone, title |
| A10 | 41 | node_rule `lists_exists` (boolean) `eq "false"` (string) | #11 | check live | 41 may be skipped even with no list → nothing fetched |
| A11 | 49 | `MobilePhone` → "Company Phone"; app `Lead Properties` mapping ignored on purpose (commented out); `LinkedIn_Profile__c` not in this org (harmless) | #27 | ask | |
| A12 | 50 | encode reads `{{node.9.response:payload.0.email}}` (import 201 returns `payload:[{email,status}]` per Contact v2) | — | check live | |
| A13 | 3/9 | lead without Email → import row without email | #30 | report | that iteration errors |
| A14 | 35 → 60/61 | if any iteration errors, group fails — do 60/61 still run? | — | check live | cursor never stored |
| A15 | 6 | blacklist per lead instead of one bulk call (Contact v5 moved to `blacklist_domains_bulk`, structural) | #21 | ask | |
| A16 | 3 | blacklist selected → no import and no other action (same as HubSpot ref rule 29 / Contact) | ref v17 | report | |
| A17 | — | option `add-prospect-in-account` has no rule (import always runs unless blacklist) | — | report | |
| A18 | 17/29/32/27–34 | tags text, pause-days text→number, sequence-id text (Contact A16–A18) | #46 | check live | |
| A19 | 52, 62, 63 | orphan debug nodes (63 hardcodes list `00BQy00000HVWrcMAH`) | housekeeping | report | |
Checks passed: no hardcoded Saleshandy URL (#43); every `custom` node uses a validated action id; loop keys (`fanout_array`, `array_item`, `parentNode`/`extent`, `entry_node`) present; SOQL in 39 valid (`…000Z` literal accepted); node 65 output valid SOQL on all 4 real list views; all SH labels used in 49 exist (`/v1/fields`); Lead fields used in 49 exist except `LinkedIn_Profile__c`.

### Field-type table (49 → Saleshandy, all SH fields are `text`)
| SF Lead field | SF type | SH field | Sent as | OK |
|---|---|---|---|---|
| Email / FirstName / LastName / Title / City / State / Country / Company | string/email | Email / First Name / Last Name / Job Title / City / State / Country / Company | string | OK |
| Phone | phone | Phone Number | string | OK |
| Website | url | Website | string | OK |
| Industry | picklist | Company Industry | string | OK |
| NumberOfEmployees | int | Company Size | `toString()` | OK |
| AnnualRevenue | currency | Company Revenue | `toString()` | OK |
| MobilePhone | phone | Company Phone | string | type OK, meaning wrong (A11) |

## Test risk
Each run processes **every** lead created since the cursor, not just ours. The parallel Email-Sent terminal creates `rudra+sf-*` leads.
- blacklist-domain would blacklist `saleshandy.com` → gated, needs your decision.
- mark-as-unsubscribed would globally unsubscribe the other terminal's prospects → run only when the window holds only our leads.
- Status actions only touch our own sequence → safe.

## Scenario matrix
| ID | Actions / config | SF lead (created by REST) | Covers |
|---|---|---|---|
| I1 | none | full lead (First/Last/Phone/Title/City/State/Country/Company/Website/Industry/Size/Revenue) | A1, A10, 68 with no list, 70, 60/61 |
| I2 | add-prospect-in-account | full lead | A2, A12, 49 field values |
| C1 | add-prospect-in-account, no new lead | — | A7 cursor (should fetch 0) , A14 |
| L1 | add-prospect-in-account + list "Today's Leads" | lead in list | 68/66/65/67/69 path, A9, 41 skipped |
| T1 | assign-tag (Tags) | new lead | 15→17, A18 |
| S1 | add-prospect-in-sequence-step (+step) | new lead | 13→18, A3 |
| S2 | add-in-step + mark-as-paused (+seq, days) | new lead | 18→20→29 |
| P1/F1/R1/RS1 | mark-as-paused / finished / replied / resume (no add-in-step) | lead already in seq | 25→32, 24→33, 23→34, 26→31 (A4) |
| U1 | mark-as-unsubscribed | new lead | 14→16, A5 (risk above) |
| E1 | add-prospect-in-account | lead without Email | A13, A14 |
| X1 | add-prospect-in-account | `O'Brien`, `+` in email, unicode | encoding |
| B1 | blacklist-domain | lead on a test domain | **gated**; A6 |

## v1 → live pass (2026-10-06, API-only)
Workflow enabled by the user in the UI (~07:38 UTC; config GET `enabled: true`, all fields `null`). Test sequence `1qPBA7klwD`, step `9KwOArxxa6` (not activated).
Manual run: `POST https://app.refold.ai/api/v2/public/workflow/681368981acc0cbcd16295c7/execute` (linked-account token).

| Run | Execution | Config | SF records | Result |
|---|---|---|---|---|
| I1 | 6ac4a60b5f7bd2f23123a8cb | all null | Lead 00QdL00000iUzJFUA0 `rudra+sf-lead-i1` (all fields) | **FAIL (blocker)**. 1, 56, 57 (records `[]`), 53 (`ts 07:35:00.776Z, exists false, lists_exists false`) OK → **68 Errored: `Field with label Fanout Array is required, currently set to undefined`** → run ERRORED; 39/41/70/35/60/61 never ran. No prospect in SH. Cursor not stored. |

### Bugs
- **B1 [JSON] Start → 68 "Get List new Leads"** — Expected: no list selected → 68 skipped, 39/41 fetch leads by CreatedDate. Actual: group 68 errors `Fanout Array is required, currently set to undefined` and the whole run stops. Root cause: node 68 `fanout_array` = `{{6801fab2…}}` (Select a list) with no guard; the default config (no list) can never fetch a lead. Very likely why every `Cb-test_2` scheduled run is ERRORED.

## v2 — `v2-common-fixes.json` (2026-10-07, offline; CRM → SH common fixes, same patterns as Contact v5 / Account v2 / Opportunity v2)
Patch: `patches/v2_common_fixes.py` (self-checking). 49 → 51 nodes, 43 → 44 edges. No node removed. Template syntax kept as this export's `{{node.X.response:…}}` + Slate inputs.
- **B1** · 53 returns `lists` (always an array) · 68 `fanout_array` → `{{node.53.response:lists}}`. Empty fanout = group Success (live: Email-Sent S13 `fanout_array: []` → COMPLETED).
- **A7** · 53 returns `next_ts` (run start) · 60/61 store `{{node.53.response:next_ts}}` instead of the value read at start.
- **A10** · 53 returns `exists` / `lists_exists` as `"true"`/`"false"` (the 41/60/61 node_rules compare strings).
- **A1/A13** · 70 returns `{result:{rows, actions, domains, skipped_without_email}}`: same Id dedupe, inputs tolerant of JSON strings/empty, leads without a valid Email dropped, `actions` normalised (never undefined) · new input `actions` = Saleshandy actions · loop 35 → `{{node.70.response:result.rows}}` · 12 action rules (3, 13–15, 19–26) → `{{node.70.response:result.actions}}`.
- **A6/A15 (structural, sibling pattern)** · + rule 97 (blacklist-domain AND domains.0 exists) → + 98 `Blacklist Domains (Bulk)` (`blacklist_domains_bulk`, `6abcfffa5f7bd2f2319f4038`), edge 70→97. Rule 3 keeps "blacklist selected → no import"; its yes-edge 3→36 removed; 36/6 kept as top-level orphans.
- **A2** · 49: only the `return` changed → `{prospectList:[{fields}], conflictAction:"upsert", verifyProspects:false}`.
- **A3** · 18: input `fields = {{node.8…}}` (node 8 doesn't exist) → `prospects = {{node.49.response:result.prospectList}}`.
- **A4** · rules 21, 26: `mark-as-resumed` → `mark-as-resume`.
- **A5** · 16: `change_prospect_status` → `unsubscribe_prospects_upd` (`6aa3a571686cab0157a32ce0`), input `prospect-id` only.
- **A9** · 65: list-view SELECT also gets FirstName, LastName, Phone, MobilePhone, Title, City, State, Country, Company, Website, Industry, NumberOfEmployees, AnnualRevenue (no duplicates).
- **A12** · 50: email from `{{node.35.response:array_item.Email}}`, trimmed, throws on empty.
Untouched: trigger, 56/57, 39/41 (Lead SOQL), 66/67/69, 9/11/12/17, every status node 27–34, config_fields, orphans 52/62/63.
Offline: `patches/offline_v2_check.js` 14/14 PASS (53 list/cursor normalisation, 70 merge/dedupe/no-email/JSON-string inputs, 49 body + string types, 50 encode/throw, 65 query on a real view shape). Graph walk, 13 action sets: each runs only its own action node(s); blacklist → only 98.
Left as is (report): A8 first-run window now−6 min · A11 49 hardcoded field map (matches this org's Lead Properties; MobilePhone→Company Phone) · A14 any errored iteration fails group 35 → 60/61 skipped, cursor not advanced (next run retries, upsert = idempotent) · A16 blacklist skips import + other actions · A17 `add-prospect-in-account` has no rule · A18 tag/pause-days/sequence-id types (check live) · A19 orphans 52/62/63.
Check first in the live pass: A10 rule compare on 41/60/61; 41 paginated output still `records`; rule `contains` on a node-output array (as Contact v5).

## v2 → static sweep (integration-enhance, 2026-10-07)
Live definition (`GET /api/v2/public/workflow/<id>`, org key + linked_account_id) == `v2-common-fixes.json` node-for-node (51/44).
Catalog #1–#56 sweep on v2: clean except known/accepted — #47 node 6 (orphan, never runs) · #19 5/9/18 per lead inside the loop (same as Contact/Account/Opp). Check live: async import vs 11 lookup right after 9.

## v2 → live pass (2026-10-07, API-only)
| Run | Execution | Config | SF records | Result |
|---|---|---|---|---|
| I1 | 6ac6200fda0eca32505ad4fc | actions/lists unset (70 IN has no `actions`; 53 `lists: []`) | Lead 00QdL00000iZMSXUA4 `rudra+sf-lead-v2-i1` (10:33:50) | **FAIL (blocker)**. Run COMPLETED. B1 fixed: 68 `fanout_array: []` → Success; 70 `actions: []` (A1 fixed, no crash); 97 false. But **41, 60 Skipped** → no lead fetched, prospect not created, cursor not stored. |

### Bugs
- **B2 [JSON] 53 → node_rules 41 / 60 / 61** — Expected: `lists_exists` = no list → 41 runs; `exists` false → 60 stores cursor. Actual: node_rule IN `{"data_slot_id":"false","compare_value":false}` → "Skipped as filter conditions are not met". Refold turns the compare value `"false"`/`"true"` into a **boolean** and compares strictly, so v2's string flags (A10 change) never match. Root cause: v2 node 53 `code_string` (`exists`/`lists_exists` returned as strings). Fix: return booleans again (v1 types). v1 types would have matched (boolean false eq false).
Rest of the v2 pass ran through the **list path** ("Select a list" = Today's Leads `00B5h00000eNPH0EAO`; 41 is skipped there anyway, so B2 doesn't block it). Test sequence "SF Lead Created test" (numeric `195947` = what the UI saves, hash `1qPBA7klwD`), step `9KwOArxxa6`, not activated. Runner `lead-run.sh` (config PUT → SF lead(s) → execute), readers `lead-check.sh`, `seq-status.sh`.

| Run | Execution | Config | Result |
|---|---|---|---|
| L1+E1+X1 | 6ac62234da0eca32505b8481 | list, no action | **PASS**. 68 → 66/65/67/69 OK, 41 skipped; 70 rows 2, `skipped_without_email: 1`. Both prospects imported with all 13 mapped fields (A2, A9); `Seán O'Brien-Müller`, `Café & Co "X1"` intact. 60/61 skipped (B2). |
| T1 | 6ac622869d5c4ea74dd9a839 | assign-tag, Tags `["sf-lead-v2-t1"]` (UI saves an array) | **PASS**. New prospect tagged → lookup right after import works (no async gap). Existing L1/X1 prospects in the window tagged too. |
| S1+S2 | 6ac622c89d5c4ea74dd9e727 | add-in-step (seq 195947, step 9KwOArxxa6) + paused (195947, 2 days) | **PASS**. In step 9KwOArxxa6, `Paused` (A3). Numeric sequence id accepted (A18 cleared). |
| RS1 | 6ac622eada0eca32505bcc9f | mark-as-resume (195947) | **PASS**. `isPaused: false` (A4). |
| F1 | 6ac62308da0eca32505bda82 | mark-as-finished | **PASS**. `Finished`. |
| R1 | 6ac623259d5c4ea74dda2688 | mark-as-replied | **PASS**. `Replied`. |
| P1 | 6ac62341da0eca32505c04e3 | mark-as-paused, 2 days (node 32 path) | **PASS**. `Paused`. |
| U1 | 6ac6235e9d5c4ea74dda54e0 | mark-as-unsubscribed (window = only our leads, SOQL-checked) | **PASS**. S1/T1 `isUnsubscribed: true` (A5, dedicated action). |
| S3 | 6ac6238cda0eca32505c242a | add-in-step + finished (node 28 path) | **PASS**. New prospect added + `Finished`. Unsubscribed U1 prospect correctly not added. |
| C1, I1 (no list) | — | — | **Blocked by B2** (41/60 never run). |
| B1 | — | blacklist-domain | **Not run — gated** (needs explicit yes; window must hold only a throwaway-domain lead). |
Bugs in this pass: **B2 only**. Still unverified live (needs B2 fixed): node 41 paginated output shape read by 70 as `records`; cursor store/update (60/61) and C1.

## v3 — `v3-boolean-flags.json` (B2 only)
Patch: `patches/v3_boolean_flags.py` (self-checking: only node 53 `code_string` differs from v2; edges/config/trigger identical).
- **B2** · 53 returns `exists: Boolean(existing_timestamp)`, `lists_exists: lists.length > 0` (booleans, as v1). Everything else in 53 (lists, next_ts, ts) unchanged.
Offline: `patches/offline_v3_check.js` 14/14 PASS (53 now asserts booleans).
Retest on v3: I1 (no list → 41 runs, paginated `records` read by 70, 60 stores cursor), C1 (61 updates cursor, only newer leads), then a short regression of L1/T1/S1/U1. B1 only with explicit yes.

## v3 → B2 retest (2026-10-07, user asked for the failed case only)
Live definition == `v3-boolean-flags.json` (51/44, no input_data diff, 53 returns booleans). List + actions cleared.
| Run | Execution | Result |
|---|---|---|
| I1 | 6ac6251f9d5c4ea74ddb8e86 | SF duplicate rule rejected the lead (98% match to v2 I1, `DUPLICATES_DETECTED`) — setup gap, not a bug. Run: 53 booleans `exists:false, lists_exists:false` → **41 Success** (no rows in window). 60 stored cursor `10:55:28.224Z` (seen by next run's 57). |
| I1b | 6ac625409d5c4ea74ddba271 | **PASS**. 53 `exists:true`, ts = stored cursor; 41 fetched the new lead; prospect `rudra+sf-lead-v3-b2` imported with all mapped fields. |
| C1 | 6ac6255fda0eca32505d34a4 | **PASS**. 57 reads the same record updated to `10:56:02.453Z` (= I1b `next_ts`) → 61 updated it; 39 query starts there. |
**B2 fixed.** Observation (platform, not a bug): with `paginated_response: true`, nodes after 41 (70, loop, 97, 60/61) don't appear in the execution's node list; their effects (import, cursor) are verified in Saleshandy and the cursor table instead.
| B1 | 6ac62668da0eca32505d7f4f | **PASS**. Window checked first (0 leads since cursor). Lead `qa.b1@sflead-b1.example.com` (reserved test domain). DNC search: `sflead-b1.example.com` added once, type `domain`, "global dnc list", 11:00:59 (before: 0 items). No prospect imported (rule 3 → no import, as designed). After the run "Saleshandy actions" reset to null so the 3-hourly cron can't blacklist other leads' domains. Test domain left in the DNC list (reserved `.example.com`, harmless). |

## v4 — `v4-mapping-only.json` (patch `../../patches-shared/mapping_fix.py`, user rule 2026-10-12: every field from the mapping, as HubSpot v17)
From `v3-boolean-flags.json`. 49 = shared mapping code with Lead Properties (hardcoded 14-field list removed; it existed because the original mapping loop sent the mapping key as field id); 65 list-view query → `SELECT FIELDS(ALL)`, LIMIT capped at 200 (all 6 real list views: valid, same records, 61 fields instead of 24). Offline on 20 real leads: −Company 20, −Website/Industry/Size/Revenue 4, −Company Phone 3 — not in Lead Properties; add them there to keep them.
Mapping keys: tries mappingDefaultField, edge label key (default fields), lodash camelCase (custom fields), old toMappingKey — matched the webui key for all 252 non-identity real Saleshandy field labels. Map as JSON string = object; missing/broken map → Email/First/Last only.
Self-check: only the listed nodes' input_data changed; graph/config identical. Catalog re-scan: no new finding. Not live-tested.

### v4 live (2026-10-12)
| # | Execution | Result |
|---|---|---|
| M4 / M4b | 6acc9a4b06dc0b16264b393d, 6acc9a9edb22d4964abd2865 | **PLATFORM**: node 41 (unchanged since v2) `14 UNAVAILABLE: No connection established … ECONNREFUSED 127.0.0.1:50056` twice — Refold internal service; window path not testable now |
| M4c | 6acc9ade06dc0b16264c321d (list "Today's Leads") | COMPLETED; new 65 FIELDS(ALL) query fetched the lead with Title/City/Country/Phone/Company (70 output). **FAIL [JSON]**: prospect got only Email/First/Last — node 49 `map_fields` dataslot `{{655ef156…}}` (application field) does not resolve to the mapping |

## v5 — `v5-lead-map-ref.json` (patch `../../patches-shared/lead_map_ref.py`)
Node 49 `map_fields` → `{{application.fields.Lead Properties}}` (form proven live in Contact/Account/Opportunity today). Only that parameter changed.
