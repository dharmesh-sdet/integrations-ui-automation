# Salesforce: "Prospect Outcome is updated in Saleshandy" test log

- CRM: Salesforce (Developer org) · Env: staging · Refold export_id `681368981acc0cbcd16295bd` (workflow_id `65f3ee98dc17494c670f8dae`)
- v1 = `v1-original.json` (99 nodes, 97 edges, 65 config_fields), extracted verbatim from the session transcript; node-for-node identical to the live Refold definition (`GET /api/v2/public/workflow/<id>`).
- Direction **SH → CRM**. Trigger: Saleshandy custom trigger `6464782cc7f3ab6e2bf5b1b2` (Prospect Outcome Updated).
- State at start (2026-10-06): workflow **disabled** for linked account 80121, all config fields `null`.
- App-level mappings (user 80121): Contact firstName/lastName/email/phoneNumber→MobilePhone/jobTitle→Title/department; Lead jobTitle/city/state/country/phoneNumber→Phone/email/first/last; Opportunity dealValue→Amount; Account companyWebsite→Website, companyPhone→Phone.

## Event payload (edge)
- Emitted by `src/sequence/services/sequence.service.ts:5929` (`updateProspectOutcome`, route `PATCH /sequences/:sequenceId/outcome {prospectId,outcomeId}`, `sequence.controller.ts:2628`) and `:5702` (Open API path), unibox `unibox.service.ts:2508`, `unibox-bulk-action.service.ts:322`.
- `:5929` returns early when the prospect has no sequence task → the email must be sent before the outcome change.
- Payload built in `src/settings/integration/integration.service.ts:309-318`: `event`, `prospect` (default fields camel-cased: `phoneNumber`, not `phone`), `user`, `sequence`, `conversationId`, `newOutcome`, `oldOutcome` (only when set).
- Open API `PATCH /v1/sequences/update-prospect-outcome` never reaches Refold (refold-qa-automation finding, SH-20244), so the edge route is the trigger.
- Outcome ids: Uncategorized 1, Interested 2, Not Interested 3, Meeting Booked 4, Out of Office 5, Closed 6, Not Now 7, Do Not Contact 8.

## Flow (v1)
Start → 9 parallel branches. Every create/update branch first passes an outcome gate (`Select Outcome (while …)` eq `newOutcome`, or the gate is empty):
| Action | Gate → rule | Path |
|---|---|---|
| create-contact | 104 → 2 | 3 contact SOQL → 4 → 133/134 mapping → 5 exists? → 7 update → 41 Note / 6 create → 112 Note |
| create-lead | 105 → 10 | 123 contact SOQL → 124 → 125 (contact exists → stop) → 11 lead SOQL → 12 → 147/148 → 13 → 16 update → 113 / 15 create → 114 |
| create-opportunity | 106 → 17 | 19 contact SOQL → 26 due date → 20 → 135/136 → 21 → 23 update contact → 149 → 24 opp → 115 / 22 create contact → 150 → 25 opp → 116 |
| create-account | 107 → 28 | 91 name → 29 SOQL → 30 → 137/138 → 31 → 32 update → 117 / 33 create → 118 |
| update-account | 108 → 42 | 92 → 43 → 44 → 45 → 143/144 → 46 → 119 |
| update-contact | 109 → 53 | 54 → 55 → 56 → 139/140 → 57 → 120 |
| update-lead | 110 → 64 | 65 → 66 → 67 → 141/142 → 68 → 121 |
| update-opportunity | 111 → 75 | 76 (Opportunity Name = email) → 77 due date → 78 → 79 → 145/146 → 81 → 122 |
| attach-activity | 126 (no outcome gate) | 127 code → loop 131 { 128 SOQL → 129 found? → 132 html→text → 130 composite Task } |

## v1 → audit (static, before any live call)
Same template as Email Sent / Reply Received (already fixed and proven live there); node ids differ.
| # | Nodes | Finding | Sibling bug | Tier |
|---|---|---|---|---|
| O1 | readers of transforms 4,12,20,26,30,44,55,66,77,78,91,92,124: 5,7,13,16,21,23,24,29,30,31,32,43,44,45,46,56,57,67,68,79,81,113,119,120,121,122,125 | `node.X.body.<key>`; transform output is `{"result":{…}}` → every exists-rule false (duplicates / silent no-op updates), Account Name '', CloseDate empty | B3 / A1 | auto |
| O2 | 6,7,15,16,22,23,32,33,46,57,68 | `prospect.phone`; payload key is `phoneNumber` | B1 / A2 | auto |
| O3 | 3,19,54,123 + 29,43 + code 127 | SOQL from raw values (apostrophe → MALFORMED_QUERY); contact match also by First+Last name | S8 / A3 | auto (approved: email-only, escape `'`) |
| O4 | 41, 117 | Note `ParentId` = `node.4.body.id` / `node.30.body.id` (key does not exist even after O1) → Note on existing contact/account fails | S4 family | auto |
| O5 | 66 | update-lead transform `record[{Email: "{{prospect.firstName}}"}]` — **rejected live (P5)**: an object predicate is always truthy (catalog #53), SOQL 65 already filters by email; not changed | — | none |
| O6 | 77, 81 | update-opportunity uses "(while creating)" closing date + stage; 81 `id` = `node.78.body.contact_id` | S6/S7 / A6 | auto |
| O7 | 78 | `input_data.query` = `record[0].Id` but top-level `query` mirror still `record[{Email:…}]` (Opportunity has no Email) | S5 / A5 | auto |
| O8 | 81 | update-opportunity sets `Name` = "First Last"; create (24/25) and lookup (76) use Name = email → after one update the opp is renamed and never found again | NEW (siblings use email) | **ask** |
| O9 | 127 | `object.forEach` without guard → crash when Select Object empty | S13 / A7 | auto |
| O10 | 130 (+132) | Task composite body built by string templating with raw email text / sequence name → invalid JSON on quotes/newlines → no Task | A12 | auto |
| O11 | — (edge) | `isManuallyChanged` never set on the payload (`integration.service.ts:313` writes `event.isManuallyMarked` instead of `eventToCobalt.isManuallyChanged`) → Note line "Manually changed:" always empty | NEW | EDGE (report) |
| O12 | 126 | attach-activity has no outcome gate (no config field for it) → Task on every outcome change | — | report only |

Kept as is (standing decisions): Title = full name on create-contact (A10), Note body text, parallel create races, CloseDate mapping notes.
Hardcoded URL check: only display text `https://my.saleshandy.com/sequence/…` in Note bodies (not an API call). Connector actions: only `get_prospect_fields` `6578300bc002b2b9b4f15c37` (validated). Field types: all mapped SH fields are text → SF text/phone; dealValue (text) → Amount (currency) to verify live.

## Scenario matrix (one outcome change = one run; Actions + gates set before each)
| ID | Actions | Gate config | SF setup | Expected |
|---|---|---|---|---|
| P1 | create-contact, create-note | all gates empty | none | Contact (Phone/MobilePhone) + Note |
| P2 | create-contact, create-note | empty | contact exists | Update + Note on it (O1, O4) |
| P3 | update-contact, create-note | empty | contact exists | Updated + Note |
| P4 | create-lead, create-note | empty | none (new email) | Lead + Note |
| P5 | update-lead, create-note | empty | lead exists | Updated + Note (O5) |
| P6 | create-opportunity, create-note | empty, Closing 7, Stage Prospecting | new email | Contact + Opp (CloseDate +7) + Note |
| P7 | update-opportunity, create-note | empty, Closing (upd) 14, Stage (upd) Qualification | opp exists | Opp updated, still found next time (O6–O8) |
| P8 | create-account, create-note | empty | none, name with `'` | Account + Note (O3) |
| P9 | update-account, create-note | empty | account exists | Updated + Note on it (O4) |
| P10 | attach-activity, Select Object [Contact, Lead, Opportunity] | — | all exist | 3 linked Tasks (O10) |
| P11 | attach-activity, Select Object empty | — | — | no crash (O9) |
| G1 | create-contact | gate = Interested, outcome → Meeting Booked | none | branch does **not** run |
| G2 | create-contact | gate = Interested, outcome → Interested | none | branch runs |

## v1 → live pass (2026-10-06 09:06–09:19 UTC, API-only, one run at a time)
Trigger: `sh-outcome-run.sh` (send email via send-now, then edge `PATCH /sequences/195948/outcome`). Every run below is filtered to WF `681368981acc0cbcd16295bd`.
| # | Actions / config | Execution | Result | Salesforce after |
|---|---|---|---|---|
| P1 | create-contact, create-note; **gates empty**; → Interested | 6ac4ba40696251a234c5ca20 | **FAIL O13 (new)**: all 9 gate rules `rule_result:false` (data_slot_id dropped for the unset field) → nothing ran | none |
| P1b | same, all gates = Meeting Booked; → Meeting Booked | 6ac4ba9e72aaa8e91d393758 | PASS (with O2/O11): 3 none → 6 Create Contact 003dL00002dODfmQAG → 112 Note. Top-level `Phone` missing (**O2**), MobilePhone from mapping. Note "Manually changed:" empty (**O11**) | Contact + Note 002dL00000rqRC5QAM |
| P2 | create-contact (contact exists) | 6ac4bad649c1bb5b18708872 | FAIL **O1**: 4 `{"result":{"contact_id":…}}`, 5 false → 6 Create → `DUPLICATES_DETECTED` | unchanged (Title "QA Outcome") |
| P3 | update-contact | 6ac4bb01ce1b140a15b3fbbd | FAIL silent **O1**: 55 found, 56 false, COMPLETED | unchanged |
| P4 | create-lead (new) | 6ac4bb45ce1b140a15b404ff | PASS: 125 false → 11/12 none → 15 Create Lead 00QdL00000iVpMfUAK (Phone/City/State/Country/Title via mapping) → 114 Note | Lead + Note |
| P5 | update-lead | 6ac4bb7cce1b140a15b40bae | FAIL silent **O1**: 66 → `result.lead_id` found (O5 rejected), 67 false | unchanged (Title "Head Ops") |
| P6 | create-opportunity (Closing 7, Prospecting) | 6ac4bbc70ae49e484b545005 | FAIL **O1**: 22 Contact 003dL00002dPYgYQAW created, 25 CloseDate missing (`node.26.body.due_date`; value under result = 2026-10-13) → `REQUIRED_FIELD_MISSING [CloseDate]` | Contact only |
| P7 | update-opportunity (upd: 14, Qualification); probe opp 006dL00000T814fQAB | 6ac4bc1097137ce0f6e72905 | FAIL silent **O1** (79 false); 77 computed +7 from "(while creating)" (**O6**); 78 runtime query already `record[0].Id` (O7 = stale mirror only) | opp changed to Qualification / 2026-10-20 by **another** subscribed workflow (Email Sent, other terminal) fired by the same send — not this run |
| P8 | create-account "Sean O'Pia" | 6ac4bc489d9d99cfad5e0be7 | FAIL **O1**: 29 `Name=''`, 33 Name missing → `REQUIRED_FIELD_MISSING [Name]` (O3 apostrophe not reachable in v1) | none |
| P9 | update-account; probe account 001dL00002ZCjnQQAT "Ann OutcomeP9" | 6ac4bc8ace1b140a15b46455 | FAIL silent **O1**: 43 `Name=''` → none | unchanged |
| P10 | attach-activity [Contact, Lead, Opportunity]; probe opp 006dL00000T89YTQAZ | 6ac4bcc197137ce0f6e751ec | FAIL **O10**: loop 131 `2 batch(es) errored` (Contact, Opp found; Lead none); 0 Tasks. Offline: real email body (`"quoted"`) → invalid JSON | 0 Tasks |
| P11 | attach-activity, Select Object empty | 6ac4bcf9ce1b140a15b4a4a5 | FAIL **O9**: 127 `Cannot read properties of undefined (reading 'forEach')` | — |
| G1 | create-contact, gates = Interested; → Meeting Booked | 6ac4bd2f696251a234c6cbab | PASS: every gate false, nothing ran | none |
| G2 | = P1b (gate matches outcome → runs) | 6ac4ba9e72aaa8e91d393758 | PASS | — |
SF state after the pass: `runs/v1-sf-state-after-pass.json`.

### Bugs (v1, full pass)
- **[JSON] O13 `Start` → every action** — Expected: empty "Select Outcome" = action runs for any outcome. Actual: all gates false, nothing runs (P1). Root cause: rules 104–111 `is_null` on `{{workflow.fields.Select Outcome …}}`; unset field → data_slot_id dropped.
- **[JSON] O1 every reader of transforms** (P2, P3, P5–P9) — `.body.<key>` vs `{"result":{…}}` → duplicates, silent no-op updates, empty Account Name, missing CloseDate.
- **[JSON] O2 Phone** (P1b) — `prospect.phone`; payload key is `phoneNumber` (`integration.service.ts:420-430`).
- **[JSON] O4 Note ParentId** 41, 117 — `node.4.body.id` / `node.30.body.id` don't exist (by reading; path dead in v1 behind O1).
- **[JSON] O6** update-opportunity "(while creating)" date/stage + 81 id (P7). **O7** 78 mirror (cosmetic).
- **[JSON] O3** apostrophes in SOQL (by sibling evidence; v1 path dead). **O9** (P11). **O10** (P10).
- **[EDGE] O11** `isManuallyChanged` never sent: `src/settings/integration/integration.service.ts:313` sets `event.isManuallyMarked = Boolean(event.isManuallyMarked)` (a no-op on the input) instead of `eventToCobalt.isManuallyChanged = Boolean(event.isManuallyMarked)`. Note line "Manually changed:" always blank. Not changed (needs approval).
- Kept / report only: **O8** node 81 renames the opp to "First Last" (user: keep), **O12** attach-activity has no outcome gate, A10 Title = full name, Open API outcome route doesn't reach Refold (SH-20244, known), CRM duplicate rules.

## v2 — `v2-fix-all.json` (patch: `patches/v2_fix_all.py`, change list: `patches/v2-changes.json`)
84 field changes in 53 nodes; nodes (99) / edges (97) / config_fields / export_id / trigger byte-identical; no structural change.
- O1: all readers of transforms 4,12,20,26,30,44,55,66,77,78,91,92,124 → `.body.result.<key>` (5,7,13,16,21,23,24,25,29–33,43–46,56,57,67,68,79,81,113,119–122,125).
- O2: `prospect.phone` → `prospect.phoneNumber` (6,7,15,16,22,23,32,33,46,57,68).
- O3: contact lookups 3,19,54,123 email-only; 91/92 return `soql_name` (escaped) used by 29/43; code 127 escapes `'` and `\`.
- O4: 41 ParentId → `node.4.body.result.contact_id`; 117 → `node.30.body.result.account_id`.
- O6: 77 "Closing date (while updating)"; 81 StageName "(While updating)", id → `node.78.body.result.opportunity_id`. O7: 78 top-level query mirror = `record[0].Id`.
- O9: 127 `(object || []).forEach`.
- O10: pattern proven live (Email Sent 123/102, Reply v3 113/107; the escaped-string approach failed live in Reply V2-R11): 132 builds the whole Task object `{Subject, Status, TaskSubtype, Description, WhoId|WhatId}` (same fields/text as v1; new inputs idType, objectId, sequence, event); 130 body = `"body": "{{node.132.body}}"`.
- O13: gates 104–111 keep both v1 clauses (proven when a gate is set) and ADD `#{{gate}}#` eq `##` OR eq `#null#`. No embedded template in a rule is proven yet → worst case an empty gate behaves exactly like v1 (no regression); P1 retest proves it.
- Untouched: node 81 Name (O8), Title on 6/7 (A10), Note bodies, orphan-free graph, every Salesforce create/update action, mapping functions, config_fields.
Verification: patch self-checks pass; code 127/132 executed offline (node 20 + cheerio) with apostrophes, backslashes, quotes, newlines → Task object correct, 130 body parses, empty Select Object → `[]`; the same Task object POSTed to SF composite on contact 003dL00002dODfmQAG → 201 (probe Task 00TdL00000FX3jKUAT deleted, 204); gate truth table (empty/match/mismatch/null) correct for all 8 gates; 91/92/29/43 identical to Reply v2 (proven live).

### Retest plan (after import, full matrix)
P1 (gates empty → must now run) · P2 existing contact → Update + Note on it · P3 · P4 · P5 · P6 (CloseDate +7) · P7 (stage/date "while updating", +14) · P8 "Sean O'Pia" (no MALFORMED_QUERY) · P9 (+ Note on account) · P10 (Tasks linked, quotes in body) · P11 (no crash) · G1 (gate mismatch → silent).

## v2 live retest (2026-10-06 09:38–09:46 UTC, after user import; live definition == v2) — all gates EMPTY unless noted
First attempt 6ac4c1a397137ce0f6e96a86: gates passed (O13 fixed), then SF `INVALID_TOKEN` (connection expired, setup) → user reconnected.
| # | Bug(s) | Execution | Result | Salesforce |
|---|---|---|---|---|
| V2-P1 | O13, O2 | 6ac4c2139d9d99cfad61e9a7 | PASS: all 8 gates true with empty config (`#…#`=`##`), Create Contact with Phone | Contact 003dL00002dOJirQAG Phone+MobilePhone, Note |
| V2-P2 | O1, O4 (41) | 6ac4c22f49c1bb5b1874b694 | PASS: 5 true → 7 Update → Note 41 on the contact | no duplicate, Note 002dL00000rqUptQAE |
| V2-P3 | O1 | 6ac4c24a9d9d99cfad61fb69 | PASS: 56 true → 57 Update → 120 Note | Title "QA V2 c", Phone 9999961003 |
| V2-P5 | O1 | 6ac4c264a2ad7db18e59af3c | PASS: 67 true → 68 Update Lead → 121 Note | Lead Title "VP Ops V2", Phone 9999961005 |
| V2-P6 | O1 | 6ac4c29372aaa8e91d3e453e | PASS: Contact + Opp 006dL00000T8JO9QAN CloseDate 2026-10-13 (+7), ContactId, Note | — |
| V2-P7 | O1, O6 | 6ac4c2c497137ce0f6e9e32a | PASS: 77 +14 (while updating), 79 true → 81 Update → Note | Stage Qualification, CloseDate 2026-10-20; Name → "Opal OutcomeV2" (O8, kept by user) |
| V2-P8 | O1, O3 | 6ac4c2e972aaa8e91d3e4ebb | PASS: soql_name escaped, no MALFORMED_QUERY, Create Account "Sean O'Pia" + Note | 001dL00002ZDo8KQAT |
| V2-P9 | O1, O4 (119) | 6ac4c30572aaa8e91d3e6a50 | PASS: 45 true → 46 Update → Note on account | Website poacct9-v2, Phone 07940061009 |
| V2-P10 | O10 | 6ac4c32fce1b140a15b7c683 | PASS: loop Success | Task 00TdL00000FXA1aUAH (WhoId contact) + 00TdL00000FX34wUAD (WhatId opp), Description with `"quoted"` text; Lead none → skipped |
| V2-P11 | O9 | 6ac4c34a72aaa8e91d3eac0f | PASS: 127 `[]`, no crash | — |
| V2-G1 | O13 regression | 6ac4c37672aaa8e91d3eb9f9 | PASS: gates = Interested, outcome Meeting Booked → nothing ran | — |
SF state: `runs/v2-sf-state-after-retest.json`. O11 EDGE `isManuallyChanged`: user 2026-10-06 — not an issue, closed (no change). Catalog #52 confirmed live: embedded `#{{field}}#` in a rule renders `##` when the field is empty.

## SIGN-OFF — v2 (`v2-fix-all.json`) is the final version

## v3 — `v3-opp-latest.json` (user request 2026-10-07: update-opportunity must update the LATEST same-named Opportunity)
Patch: `../../patches-shared/opp_latest.py` (self-checking, shared by all 5 SH→SF workflows). From `v2-fix-all.json`; 2 field changes, nothing else changed (nodes/edges/config identical).
- node 76 `q` + ` ORDER BY CreatedDate DESC LIMIT 1` → node 78 `record[0]` is now the newest Opportunity (update-opportunity + its Note).
- node 127 attach-activity Opportunity query + same suffix → Task WhatId goes on the newest Opportunity.
Proof (read-only SOQL, 2026-10-07): Name='rudra+sf-k6@…' without ORDER BY returned the older 006dL00000T9pNZQAZ first; with it, the newer 006dL00000T9pQnQAJ. Catalog audit unchanged; code node run offline (escaping intact). Not live-retested (same query proven by the read-only SOQL).

## v4 — `v4-no-static-title-name.json` (patch: `../../patches-shared/static_values.py`, user decision 2026-10-12)
From `v3-opp-latest.json`. User rule: as few fixed values as possible — an unmapped field stays untouched, a mapped field comes from the mapping everywhere; Notes only when "Create Note" is selected, on the record the branch created/updated.
- Changed: nodes 6, 7 → Title "" (was "First Last"); 81 update_opportunity → Name "" (was "First Last").
- Why `""` is safe: the connector does not send empty strings (Email Sent S3), so Title / Opportunity Name stay as they are in Salesforce unless mapped; a mapping still wins through `additional_fields` (Email Sent V3-S6/S7).
- Self-check: only these fields changed; nodes/edges/other config identical. Catalog re-scan: no new findings.
- Not live-tested yet.

### v4 live test plan (2026-10-12, user go-ahead)
Live definition == v4 nodes. Live Actions options still lack `update-opportunity` (A2, not part of v4; import keeps the old option list anyway). Tests set Actions via the config API.
| # | Mapping | Actions / gates | Setup | Expected |
|---|---|---|---|---|
| O1 | mapped | create-contact, create-note; gate Interested | Contact exists, Title "Old O1"; Job Title "Mapped O1"; → Interested | Title = "Mapped O1", Note |
| O2 | mapped | update-opportunity, create-note; update-opp gate empty | Opp Name = prospect email (API); → Interested | Stage Qualification, CloseDate +14, **Name still the email** |
| O3 | mapped | same | same prospect → Meeting Booked | **same Opp found again** and updated |
| O4 | **unmapped** | create-contact | Contact exists, Title "Keep O4" | **Title stays "Keep O4"** |

### v4 live results (2026-10-12)
| # | Execution | Result | Salesforce |
|---|---|---|---|
| O1 | 6acc811b142e9cb860f0e89d | **PASS**: 5 true → 7 Update Contact; node 7 input has no top-level `Title` (v4 `""` not sent); `additional_fields.Title` = "Mapped O1" → 41 Note | Contact 003dL00002eDi4nQAC Title "Old O1" → **"Mapped O1"**, Note |
| O2 | 6acc8167059402d7f6a12c14 | **PASS**: gate 111 empty → true (#52), 76 newest opp, 81 input has **no `Name`**, StageName Qualification, CloseDate +14, Amount 2200 (mapping) → 122 Note on the Opp | Opp 006dL00000TJcs5QAD **Name still `rudra+sf-o4t2@saleshandy.com`**, Qualification, 2026-10-26 |
| O3 | 6acc81959d4785a06456014c | **PASS**: second outcome change (→ Meeting Booked) — 79 found the **same** opp, 81 Needs Analysis, +21, Amount 3300 → Note | same Opp updated again, name unchanged, 2 Notes |

## v5 — `v5-no-static-phone.json` (patch `../../patches-shared/phone_fix.py`, user rule 2026-10-12: nothing fixed except required/lookup fields, as HubSpot)
From `v4-no-static-title-name.json`. Contact/Lead/Account create+update: `Phone` `{{event.body.prospect.phoneNumber}}` → `""` (not sent; Salesforce Phone untouched unless mapped, mapping still wins via additional_fields). Kept: LastName, Lead Company, Account Name, Opportunity Name/Stage/CloseDate, Email, FirstName.
Self-check: only `Phone` on those nodes changed; graph/config identical. Catalog re-scan: no new finding. Not live-tested.

## v6 — `v6-same-names.json` (patch `../../patches-shared/naming_fix.py`, user 2026-10-12: create and update use the same name)
From `v5-no-static-phone.json`. update_opportunity 81 `Name` `""` → `{{event.body.prospect.email}}` (same as create 24/25 and the 6 email siblings). Self-check: only these fields changed. Not live-tested.

### v6 live (2026-10-12, after user import + Salesforce reconnect; SF state read from node outputs — own SF token expired)
| # | Execution | Result |
|---|---|---|
| P6A create-opportunity + note, new | 6acc9bcff65ff4bccdffcffd | **PASS**: 22 Create Contact without top-level Phone/Title (mapping MobilePhone/Title); 25 Opp Name = email, CloseDate +7, ContactId; Note 116 on the Opp |
| P6B update-opportunity + note | 6acc9bfe9d4785a064620e9c | **PASS**: 76 finds the same Opp by email (newest); 81 Name = email (= create), Qualification, +14, Amount 5150 (mapping); Note 122 on the Opp |
| P6C create-account + create-lead + note | 6acc9c2fd5af7efd0836ecfd | **PASS**: 33 Account Name = "Quin OutcomeSixC", no person Phone, Phone/Website from Account Properties; 15 Lead Company (required) + Phone/Title/City from Lead Properties; Notes 118 (Account), 114 (Lead) |
| P6D update-account + update-lead | 6acc9c5a9d4785a06462329d | **PASS**: 43 finds Account by person name → 46 Name same as create, mapping fields; 68 Lead mapping fields; Notes 119/121 |
| P6E update-contact | 6acc9c76142e9cb860fe07eb | **PASS**: 57 no Phone/Title top-level, MobilePhone/Title/Department from mapping; Note 120 |
