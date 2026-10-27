# Salesforce — "Call Logged in Saleshandy" — test log

- CRM: Salesforce (Developer org) · Env: staging (Pyxis) · Refold workflow_id / export_id `6a8d4e13872e42e62fa36d81` (matches webui `saleshandySalesforceCallIds`, `triggers-and-activity/utils/helper.ts:36`)
- v1 = `v1-original.json` (109 nodes, 107 edges, 6 config_fields), extracted verbatim from the session transcript.
- Direction: SH → CRM. Trigger: Saleshandy event `call-logged` / Cobalt name "Call Logged in Saleshandy" (`src/common/enums/cobalt-event.ts:13,41`),
  fired by `CallLoggedQueueService.processCallLogged` (`src/dialer/services/call-logged-queue.service.ts`) 90 s after `POST /dialer/call-logged` (CronAccessTokenGuard).
- Payload (`integration.service.ts:254-380`, `call-payload.service.ts:173`): `prospect` (`{}` when the call has no linked prospect), `user`, `sequence` (`{}` for manual calls; `{id, sequenceName, stepId, stepNumber, importedAt, url}`), `callLoggedAt`, `call` {callId, callType `Inbound|Outbound`, result `answered|not_answered`, activityDate `YYYY-MM-DD` (caller tz), startedAt/endedAt (human, caller tz), fromNumber, toNumber, durationSeconds, ringTimeSeconds, outcome, note (S3, HTML stripped), callLogUrl, forwarding?}. Empty keys are deleted, never null.

## Lineage
Cloned from SF "Email Sent from Saleshandy". Node-by-node diff against the signed-off `email-sent-from-saleshandy/v5-opp-latest.json`:
- Same as v5 (fixes kept): `.body.result.` readers (#47), `prospect.phoneNumber` (#48), email-only lookups, "(while updating)" fields on 77/81, `record[0]` on 78, `ORDER BY CreatedDate DESC LIMIT 1` on 76.
- New on purpose: `Email != null AND` / `Name != null AND` in every lookup (an empty prospect email must not match null-email records); 12 "Build note body" code nodes 220–231 between each create/update and its Note; the email activity branch (99–104, 123) replaced by the call-activity branch 98 → 200 → loop 206 {201 SOQL email → 202 SOSL phone → 203 resolve id → 207 found? → 204 Task body → 208 Task lookup q → 209 SOQL → 210 create-or-update → 211 → 205 POST}; orphans 48–52/59–63/70–74/83–88/93/94 removed.
- Lost from v5 (regressions): v4 apostrophe fix on Account lookups (91/92 `soql_name`, 29/43 query it); node 81 `id` (and `Name`, harmless: not sent = unchanged). v5's empty `""` placeholders are simply absent (same request).

## Branch map (v1)
| Actions value | Path | Result in Salesforce |
|---|---|---|
| create-contact | 2→3→4→105/106→5 → 7 Update / 6 Create → 225/224 note body → 41/40 Note | Contact + Note |
| create-lead | 10→95→96→97 (no contact) →11→12→119/120→13 → 16 / 15 → 231/230 → 90/89 | Lead + Note |
| create-opportunity | 17→19→26→20→107/108→21 → 23→121→24→223→37 / 22→122→25→222→36 | Contact + Opp + Note |
| create-account | 28→91→29→30→109/110→31 → 32→220→34 / 33→221→35 | Account + Note |
| update-account | 42→92→43→44→45→115/116→46→226→47 | Account + Note |
| update-contact | 53→54→55→56→111/112→57→227→58 | Contact + Note |
| update-lead | 64→65→66→67→113/114→68→228→69 | Lead + Note |
| update-opportunity | 75→76→77→78→79→117/118→81→229→82 | Opp + Note |
| record-call-activity | 98→200→loop 206 (per Select Object (Call Activity) entry) | one Task (Call) per object, updated in place on re-delivery (CallObject = callId) |
| create-note | node_rule on every Note node | Note |

## v1 → static audit (2026-10-07, offline)
Code nodes 200/203/204/208/210/220 executed offline (`scratchpad/run_code.js`) on outbound+prospect, inbound unknown number, forwarded, apostrophe email, `object` as JSON string / empty, missing callType: no throw; outputs as designed.

| # | Node(s) | Finding | Catalog | Tier | Status |
|---|---|---|---|---|---|
| A1 | 98 + config `Actions` | Rule 98 tests `record-call-activity`; the Actions field offers `attach-activity` (no branch here) but not `record-call-activity`. webui sends `record-call-activity` for the call workflows (`helper.ts:331`). Branch unreachable from the workflow's own options. | #54 | auto | confirm live (saved config) |
| A2 | 29, 43, 91, 92 | v4 Account apostrophe fix lost: `Name='Sean O'Brien'` → MALFORMED_QUERY on create-/update-account. | #S8 / v4 | auto (approved earlier) | confirm live |
| A3 | 81 | update_opportunity has `Id` but no `id` and `Name: null` (v5: `id` = opp id, `Name` = prospect email). Unproven which key the connector uses for the URL; `Name: null` may blank a required field. | regression | flag | confirm live |
| A4 | 7, 23, 32, 46, 57, 81, notes | v5's `""` placeholders (Title, Email, Type, Description, IsPrivate, Amount…) are **absent** here, not null. Connector drops `""` anyway (#49) → same request. | #49 | — | REJECTED (false positive) |
| A5 | 2,10,17,28,42,53,64,75 | Calls with no linked prospect (inbound from unknown number, manual dial) send `prospect: {}` by design. Every CRM branch then runs with empty email/name → create paths fail REQUIRED_FIELD_MISSING (LastName/Company/Name). | new | ask | |
| A6 | 202 → 203 inside loop | Opportunity entries never carry `soslQuery` → 202 skipped on that iteration. If Refold keeps node 202's body from the previous iteration (e.g. the Contact one), 203 resolves a Contact id as the Opportunity WhatId (wrong record / `FIELD_INTEGRITY_EXCEPTION`). A node skipped by its node_rule does NOT stop its children (Lead-Created L1: 41 skipped, 70 ran). | platform | auto (defensive) | fixed v2 |
| A7 | 202 | SOSL via `httprequest` GET with an already `encodeURIComponent`-ed `q`; connector may re-encode (`%257B`). Phone match on last-10 digits vs stored formats unproven. | — | check live | |
| A8 | 205 | Update path `POST /sobjects/Task/<id>?_HttpMethod=PATCH` (documented Salesforce override) not proven through the connector. | — | check live | |
| A9 | 200 | `object` arriving as a JSON string (`'["Contact"]'`) → `[]`, no Task, no error. Email-Sent proved it arrives as an array. | #55 | report | |
| A10 | 3,11,19,54,65,76,95 | Email embedded raw in SOQL (an `'` in an email breaks it). Same as signed-off v5. | accepted | report | |
| A11 | 200 `Account` case | Kept for configs saved before Account left the selector; matches company name (create-account names the account after the person). Not selectable. | — | report | |
| A12 | 204 | `sequence.url` (edge builds it "for node 204") is not printed in the Task description. | — | report | |

Accepted (standing decisions, not re-flagged): parallel-branch race; new Opportunity per event; Account named after the person; missing LastName/Company fail (for prospects that exist); create-note alone does nothing.

## Scenario matrix
| ID | Actions | Select Object | Setup in SF | Event variant | Checks |
|---|---|---|---|---|---|
| K1 | record-call-activity | Contact | contact exists (email) | outbound, answered, sequence, note with `"` + newline | 1 Task on Contact: Subject/CallType/ActivityDate/Disposition/CallObject/Duration/Description (A1) |
| K2 | record-call-activity | Contact | same | same callId re-delivered | same Task updated, no 2nd Task (A8) |
| K3 | record-call-activity | Contact, Lead, Opportunity | contact + opp exist, lead not | outbound with phone | Task on Contact + Opp, none on Lead, Opp WhatId is the opp (A6) |
| K4 | record-call-activity | Contact, Lead | contact exists with phone only | inbound, prospect `{}`, not answered | "Missed call" Task matched by phone (A7) |
| K5 | record-call-activity | Lead | lead exists | inbound forwarded | "(forwarded)" subject + "Forwarded to" line |
| K6 | record-call-activity | (empty) | — | — | no Task, run COMPLETED |
| C1 | create-contact, create-note | — | none | outbound | Contact + call Note |
| C2 | create-contact, create-note | — | contact exists | — | Update + Note; Title/Email not blanked (A4) |
| L1 | create-lead, create-note | — | none | — | Lead + Note |
| O1 | create-opportunity, create-note | — | none | Closing date 7, stage | Contact + Opp + Note |
| UO1 | update-opportunity, create-note | — | opp exists | "while updating" | Opp updated, Name intact (A3, A4) |
| A1s | create-account / update-account | — | — | "Sean O'Brien" | no MALFORMED_QUERY (A2) |
| UC1 / UL1 / UA1 | update-contact / update-lead / update-account + note | — | record exists | — | updated + Note |
| E1 | all CRM actions | — | — | prospect `{}` | A5 behaviour |

## v2 — `v2-fix-all.json` (patch: `patches/v2_fix_all.py`) — user 2026-10-07: "update the JSON first, I'll import; no testing now"
No live call made. Fixes are from the static audit only.
- **A1 [JSON] config `Actions`** — `possible_options` += `record-call-activity` (rule 98's value; webui sends it). `attach-activity` option left as is (no branch reads it; harmless).
- **A2 [JSON] 91/92 → 29/43** — transforms return `soql_name` (`\` and `'` escaped); Account lookups query it. Create/update (32/33/46) and filters (30/44) keep the unescaped `name`. Same as Email-Sent v4 (proven live, V4-R4b/c).
- **A3 [JSON] 81** — `id` = `{{node.78.body.result.opportunity_id}}` added next to `Id` (as in v5 and every other update node here). `Name` left unsent.
- **A6 [JSON] 203** — new input `item` = `{{node.206.body.array_item}}`; the email result is used only when the item has `query`, the phone result only when it has `soslQuery`. Item unreadable (unresolved/undefined) → old behaviour. Offline: 8/8 cases pass (`scratchpad/t203.js`).
Verification: (1) structural — parses; 109 nodes / 107 edges / 6 config_fields, export_id and node order unchanged; only nodes 29, 43, 81, 91, 92, 203 and config_fields[0] differ (patch self-check). (2) semantic — catalog re-run on v2: no hardcoded host (#43), every rule value in its options (#54), no transform read without `.result` (#47), no `prospect.phone` (#48); all code nodes run offline on 6 payload variants with no throw.

Not changed (needs your answer / live evidence):
- **A5** calls with no linked prospect (`prospect: {}`) run every selected CRM action with empty fields → REQUIRED_FIELD_MISSING. Proposed: add `{{event.body.prospect.email}} exist` to rules 2,10,17,28,42,53,64,75. Waiting for a decision.
- **A7** SOSL encoding / phone-format match, **A8** `?_HttpMethod=PATCH` through the connector — first live run (K1/K2/K4) proves them.
- A9–A12 report only.

### Retest plan (when testing is wanted)
K1 Task on Contact · K2 same callId again → updated, not duplicated · K3 Contact+Lead+Opp with only contact+opp present (A6) · K4 inbound unknown number, phone match · K5 forwarded · K6 empty Select Object · C1/C2 · L1 · O1 · UO1 (A3) · A1s "Sean O'Brien" create/update-account (A2) · UC1/UL1/UA1 · E1 (A5).

## v3 — `v3-current.json` (live export pasted 2026-10-12)
Byte-identical to v2 except `config_fields[0]` (Actions): the `record-call-activity` option v2 added is gone again (11 → 10 options). Every other node/edge/config field equals v2. Node-by-node vs signed-off SF Email-Sent v5: only intended differences (null-email guards, note-body nodes 220–231, call branch, record-call-activity rule).

## v4 — `v4-fix-all.json` (patch: `patches/v4_fix_all.py`), also `integration-jsons-salesforce/call-logged-in-saleshandy-{current,fixed}.json`
- **A1 (again)** config `Actions` += `record-call-activity`. If the next export drops it again, the option is being reset on the Refold side (config saved from the UI / import not keeping config option edits). Check that before re-patching a third time.
- **A5 (applied, flag)** rules 2/10/17 += `{{event.body.prospect.email}} exist`; rule 28 += `{{event.body.prospect.firstName}} exist`. Calls with no linked prospect (`prospect: {}`, integration.service.ts:413) no longer try to create a Contact/Lead/Opp/Account with empty LastName/Name. Update branches and the call-activity branch are unchanged (update lookups already find nothing for an empty email; 98 matches by phone).
Verification: (1) structural — parses; 109/107/6; only nodes 2,10,17,28 (`input_data.compare_value_of` gained a 2nd clause, clause 0 untouched) + config_fields[0] differ; edges ↔ in/out lists consistent; every `{{node.X}}` exists; every Actions rule value offered; no host. (2) semantic — 200/203/204/210 run offline with `prospect: {}` → Contact/Lead SOSL items, "Missed call" Task by phone; with a prospect → 3 items incl. Opportunity.
Still open (live only): A7 SOSL encoding/phone match, A8 `?_HttpMethod=PATCH`. Report only: A9–A12, CloseDate/StageName empty when Opportunity "(while creating)" settings are blank (same as signed-off sibling), Task Description / Note Body not clamped to 32k.

## v5 — `v5-no-static-phone.json` (patch `../../patches-shared/phone_fix.py`, user rule 2026-10-12: nothing fixed except required/lookup fields, as HubSpot)
From `v4-fix-all.json`. Contact/Lead/Account create+update: `Phone` `{{event.body.prospect.phoneNumber}}` → `""` (not sent; Salesforce Phone untouched unless mapped, mapping still wins via additional_fields). Kept: LastName, Lead Company, Account Name, Opportunity Name/Stage/CloseDate, Email, FirstName.
Self-check: only `Phone` on those nodes changed; graph/config identical. Catalog re-scan: no new finding. Not live-tested.

## v6 — `v6-same-names.json` (patch `../../patches-shared/naming_fix.py`, user 2026-10-12: create and update use the same name)
From `v5-no-static-phone.json`. update_opportunity 81 + `Name` = prospect email; call Task lookup 200 finds an Account by the person name (first + last, as create-account names it) instead of company. Offline: O'Brien escaped, empty prospect → no lookup. Self-check: only these fields changed. Not live-tested.
