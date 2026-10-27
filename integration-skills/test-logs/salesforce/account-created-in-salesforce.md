# Salesforce — "Account is created in Salesforce" — test log

- CRM: Salesforce (Developer org) · Env: staging · Refold workflow (user copy / export_id) `682d72d0bcc93496f8906354`, template `661d2b2f8c9a18bbd551e80f`
- Direction: **CRM → SH**. Trigger: Cobalt **Schedule**, cron `0 */3 * * *` (every 3 h). Not a webhook.
- v1 = `v1-original.json` (35 nodes, 33 edges, 9 config_fields), extracted verbatim from the session transcript.
- Sibling: `../opportunity-created-in-salesforce/` — **same graph, same node ids** (3–38, 35 loop). Only differences in v1:
  ts node is 42 (Opp 43), SOQL node is 43 (Opp 45), SOQL object `Account`, map field `Account Properties`,
  **node 37 code is empty** (Opp had code), rules 19–22 ordered differently (each still wired to its matching status node),
  **both** resume nodes 27 and 31 send `status: "resumed"` (Opp: 30 `resumed`, 31 `active`).
  Contact-Created v1 / Opportunity v1 findings apply.

## Flow (v1)
```
Start (cron 3h) → 42 code: ts = instance_created_time − 3h
 → 43 salesforce incremental_sync  SOQL: SELECT FIELDS(ALL) FROM Account WHERE CreatedDate>={{timestamp}} LIMIT 200
 → 35 loop over Account records (entry 3)
     3 rule actions contains blacklist-domain
       ├ true  → 36 transform {domain: substringAfter(contact.Email,"@")} → 6 Blacklist a Domain
       └ false → 5 Get Prospect Fields → 37 code (EMPTY) → 9 Add Prospect → 38 Encode email → 11 Get Prospect Id → 12 exists?
                   ├ 14 unsubscribed? → 16 change_prospect_status (no status, no sequence)
                   ├ 15 assign-tag?   → 17 Assign a Tag
                   └ 13 add-prospect-in-sequence-step?
                        ├ true  → 18 Add to Sequence (step-id only, NO prospects) → 22 resumed? 27 · 19 paused? 28 · 20 finished? 29 · 21 replied? 30
                        └ false → 26 resumed? 31 · 25 paused? 32 · 24 finished? 33 · 23 replied? 34
```

## v1 → audit (static, before any live call)
| # | Node | Finding | Catalog | Tier | Expected live symptom |
|---|---|---|---|---|---|
| A1 | 36, 37, 38 | A Salesforce **Account has no Email / FirstName / LastName**. People of an Account = its `Contacts` child relationship (HubSpot Company reference: associated contacts → prospects, contact email domains → blacklist). Nothing reads them. | #25/#26, ref HubSpot company-created | **ask (structural)** | blacklist domain = undefined; nothing to import |
| A2 | 37 | **`code_string` is empty** — the field-mapping / import-body builder does not exist | — | blocker | 37 no output → 9 `fileds` undefined → import 400 → rest of the branch dead |
| A3 | 3 + 11 action rules | `contains` on `{{workflow.fields.Saleshandy actions}}`; unset → `QUERY_EVALUATION_ERROR: cannot call includes on undefined` (live-confirmed on Contact-Created run I1) | B2 of contact-created | auto | every iteration fails at rule 3 when no action is selected |
| A4 | 43 | `CreatedDate>={{timestamp}}` placeholder not applied → whole Account table (≤200) fetched (live-confirmed Contact-Created B1) | — | ask (kept as is on Contact/Opp) | first run processes every Account in the org |
| A5 | 18 | Add to Sequence has **no `prospects` input** (fingerprint `prospects|step-id`) | #46 | auto | add-to-sequence 400 |
| A6 | 38 | email from `{{node.9.body.payload.0.email}}` (import response), no guard on empty → blank Get Prospect Id search | — | auto | wrong/empty lookup |
| A7 | 6 | `{{node.36.body.domain}}` without `.result` | #47 | auto | blacklist with empty domain |
| A8 | 22, 26 | compare `mark-as-resumed`; option value is `mark-as-resume` | #51 | auto | resume branch never fires |
| A9 | 27, 31 | `status: "resumed"`; Open API `ProspectsUpdateStatusDto` accepts finished/paused/replied/unsubscribed/**active** (HubSpot company node 16 uses `active`) | #38 | auto | status API 400 on every resume |
| A10 | 16 | "Mark as unsubscribed" = `change_prospect_status` with no status / sequence | #23 | auto (pattern approved on Contact/Opp → `unsubscribe_prospects_upd`) | status API 400 |
| A11 | 3/36/6 | per-record blacklist inside the loop; blacklist selected → import + every other action skipped | #21, ref v17 | flag (structural — bulk pattern approved on Contact v5 / Opp v2) | |
| A12 | 43 | Contacts are usually added to an Account **after** it is created. Contacts added after the run that saw the Account are never processed here (Contact-Created workflow covers them) | — | report (design) | |
| A13 | 18 → 19–22 | statuses on the add-to-sequence path only run if 18 succeeds | #24 | report | |
| A14 | 43 | `LIMIT 200`, no pagination; 3 h window overlap at boundary | — | report | |
| A15 | — | option `add-prospect-in-account` has no rule; import always runs unless blacklist | — | report | |
| A16 | 17/28/32 | tags / pause days / sequence-id types from text config | #46 | check live (same as HubSpot, no evidence of error) | |

Checks passed: no hardcoded URL / x-api-key (#43); every `custom` node uses a validated action id (`saleshandy-web-apis.md`); loop keys (`fanout_array`, `array_item`, `parentNode`/`extent`, `entry_node`) OK; no `JSON.parse`; no bracket templates; every rule 19–26 wired to the status node matching its compare value.

## Cross-workflow risk (test setup)
The workflow processes **every** Account in its window (with A4: the whole table, ≤200). Parallel terminals create `rudra+sf-*` contacts on accounts all the time, so:
- **blacklist-domain is gated** (would blacklist saleshandy.com / gmail.com / qamail.dev …) — explicit yes per run.
- Any tag/status selected applies to their prospects too (status only inside our own test sequence).

## Scenario matrix
Each run = one execution over all Accounts in the window. Actions set via config PUT before each run.
Test records: SF Account `SF-AC <scenario>` + Contacts `rudra+sf-ac-<scenario>[-n]@saleshandy.com` (AccountId).

| ID | Actions | SF records | Checks |
|---|---|---|---|
| I0 | (none) | Account with 1 contact | A3 crash gone, A4 window, nothing imported (no action selected? import always runs → A15) |
| I1 | add-prospect-in-account | Account (Industry, Phone, Website) + 2 contacts | A1/A2: both contacts imported, identity + Account Properties fields, types |
| I2 | add-prospect-in-account | Account with **no** contacts | skipped cleanly, no error |
| I3 | add-prospect-in-account | contact with no Email | skipped, others still imported |
| S1 | add-prospect-in-sequence-step (+own seq/step) | Account + `rudra+sf-ac-s1` | A5 |
| T1 | assign-tag (Tags `sf-ac-test`) | `rudra+sf-ac-t1` | A16 |
| U1 | mark-as-unsubscribed | `rudra+sf-ac-u1` (in seq) | A10 |
| P1 | add-prospect-in-sequence-step + mark-as-paused (+days 2) | `rudra+sf-ac-p1` | 18→19→28 |
| P2 | mark-as-paused only | reuse p1 | 25→32 |
| F1 | mark-as-finished | `rudra+sf-ac-f1` (in seq) | 24→33 / 20→29 |
| R1 | mark-as-replied | `rudra+sf-ac-r1` (in seq) | 23→34 / 21→30 |
| RS1 | mark-as-resume | reuse p1 (paused) | A8, A9 |
| B1 | blacklist-domain | **gated** — Account + contact on a throwaway test domain only | A7, A11 |
| X1 | re-run, no new Account | — | idempotency (upsert) |

## v1 → live pass
Skipped (user, 2026-10-06): v1 fails on known blockers (A2 empty node 37, A3 actions crash live-confirmed on Contact-Created). Full live matrix runs on v2.

## v2 — `v2-contacts-bulk-blacklist.json` (offline; user decisions 2026-10-06)
Decisions: Opportunity v2 / Contact v5 pattern **yes** · prospects = the Account's **Contacts** · blacklist domains = contact email domains (as the other Salesforce workflows) · time window `{{timestamp}}` **kept as is**.
Patch: `patches/v2_contacts_bulk_blacklist.py` (self-checking). 35 → 38 nodes, 33 → 35 edges. No node removed.
- **Structural (approved):** + 96 `Prepare - Actions, Contacts & Domains` (43 → 96 → loop 35): `actions` list (never undefined), `rows` = one per Account contact (Account fields + contact Email/FirstName/LastName, deduped by email, contacts without a valid email skipped), `domains` = unique lowercase domains of those emails. + 97 rule (blacklist-domain AND domains.0 exists) → + 98 `Blacklist Domains (Bulk)` (`6abcfffa5f7bd2f2319f4038`). Loop 35 `fanout_array` → `{{node.96.body.result.rows}}`. Rule 3 yes-edge to 36 removed; 36/6 kept as orphans.
- A1 · 43 query: + `(SELECT Email, FirstName, LastName FROM Contacts)`; WHERE/LIMIT untouched.
- A3 · 12 action rules → `{{node.96.body.result.actions}}`.
- A2 · 37 (was empty): identity from the row; other fields from `Account Properties` (`mappingDefaultField || toMappingKey(label)`, map parsed if string, dotted paths); **Company falls back to Account Name** when unmapped; strings only; returns `{prospectList:[{fields}], conflictAction:"upsert", verifyProspects:false}`.
- A5 · 18: + `prospects = {{node.37.body.result.prospectList}}`.
- A6 · 38: email from `{{node.35.body.array_item.Email}}`; throws on empty.
- A8 · 22, 26: `mark-as-resumed` → `mark-as-resume`. A9 · 27, 31: `resumed` → `active`.
- A10 · 16: → `unsubscribe_prospects_upd` (`6aa3a571686cab0157a32ce0`), input `prospect-id` only.
- A7/A11 resolved by 98 (bulk, outside the loop).

Offline verification (`patches/offline_v2_check.js`, synthetic Account records): 20/20 pass — actions undefined/null/""/"null"/[]/JSON-string/plain string normalised; 3 accounts (2 contacts + 1 no-email, 0 contacts, duplicate + malformed email) → 2 rows, domains [saleshandy.com, acme.io]; records as string == array; mapping incl. number → "50", object skipped, Company → Account Name; map as string == object, missing/broken map still sends identity + company; encode `+`/`@`, throws on empty.
Graph walk, 13 action sets: each runs exactly its own action node(s); blacklist runs only 98 (once per run).
**Not yet verified live:** the Contacts subquery with `FIELDS(ALL)` (OpportunityContactRoles equivalent was probe-confirmed) — first read-only SOQL probe of the live pass.

Still open (reported, not changed — user decisions / design): A4 window not applied (≤200 Accounts every run); blacklist selected → import + other actions skipped; Accounts without contacts skipped; A12 contacts added after the Account's run are not processed here; A13–A16 unchanged.

## v3 — `v3-mapping-only.json` (patch `../../patches-shared/mapping_fix.py`, user rule 2026-10-12: every field from the mapping, as HubSpot v17)
From `v2-contacts-bulk-blacklist.json`. 43 contacts subquery → `(SELECT FIELDS(ALL) FROM Contacts LIMIT 200)` (read-only probe: valid, 62 contact fields); 96 rows carry `__contact`; 37 = shared code, Contact Properties first (contact, then same field on the Account), then Account Properties; +param `contact_map_fields`. Company fallback (= Account Name) removed. Offline on 22 real rows: +Job Title 19, +Phone 18, +Department 18, −Company 22 (map Company in Account Properties to keep it).
Mapping keys: tries mappingDefaultField, edge label key (default fields), lodash camelCase (custom fields), old toMappingKey — matched the webui key for all 252 non-identity real Saleshandy field labels. Map as JSON string = object; missing/broken map → Email/First/Last only.
Self-check: only the listed nodes' input_data changed; graph/config identical. Catalog re-scan: no new finding. Not live-tested.

### v3 live (2026-10-12)
| M2 | 6acc9a2506dc0b16264b1c85 | **PASS**: prospect rudra+sf-m-acc got Phone/Job Title/Department (contact, Contact Properties) + Company Website/Company Phone (Account Properties) |
