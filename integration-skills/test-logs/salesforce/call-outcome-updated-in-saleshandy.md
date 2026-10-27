# Salesforce — "Call Outcome Updated in Saleshandy" — test log

- CRM: Salesforce · Env: staging (Pyxis) · workflow_id / export_id `6a8d4f4c1279721fc19d86f3` (webui `saleshandySalesforceCallIds`, `triggers-and-activity/utils/helper.ts:37`)
- v1 = `v1-original.json` (109 nodes, 107 edges, 6 config_fields), extracted verbatim from the session transcript (2026-10-12).
- Trigger: Saleshandy event `call-outcome-updated` / "Call Outcome Updated in Saleshandy" (`src/common/enums/cobalt-event.ts:14,42`).
  Emitted by `DialerCallOutcomeService.emitCallOutcomeUpdated` (`src/dialer/services/dialer-call-outcome.service.ts:191`) only when the new outcome differs from the old one.
  Payload = the Call Logged payload (`call-payload.service.ts`) plus `callOutcomeUpdatedAt`, with `call.outcome` = the new outcome and `call.previousOutcome` = the old one (absent on the first outcome) (`integration.service.ts:367-394`; `newCategory/previousCategory` → `newOutcome/oldOutcome` in `integration-event-sending.service.ts:67,69`).

## Lineage
v1 is **Call Logged v1** (`../call-logged-in-saleshandy/v1-original.json`), node for node. The only differences are the trigger, the name/ids, and node 204, which prints `Outcome: <old> → <new>`.
So none of the Call Logged v2 fixes (A1, A2, A3, A6) are in it. Call Logged `v3-current.json` (the user's export after importing v2) contains A2/A3/A6 but **not** the A1 option. Either import dropped it or someone removed it. Check it after import.

## v1 → v2 (`v2-fix-all.json`, patch `patches/v2_fix_all.py` = Call Logged's script, docstring only changed)
| # | Node(s) | Fix | Catalog |
|---|---|---|---|
| A1 | config `Actions` | add option `record-call-activity` (rule 98's value; webui sends it for this workflow id) | #54 |
| A2 | 91/92 → 29/43 | Account lookups query an escaped `soql_name` (`O'Brien` no longer breaks SOQL) | Email-Sent v4 |
| A3 | 81 | `id` restored next to `Id` on update_opportunity | Email-Sent v5 |
| A6 | 203 | read the email/phone result only when the loop item asked for it (no stale SOSL body → wrong WhatId) | #57 |

Verification (offline): patch self-check OK (only nodes 29/43/81/91/92/203 + config_fields[0] changed, 109/107/6, order and top-level keys identical).
The catalog scan of v2 finds nothing. v2 vs Call Logged v3-current differs only in triggers, the node 204 outcome line, the name/export/config ids and the A1 option.
Code nodes 200/203/204/210 were run on an outcome-updated payload: 9/9 checks pass, including `Callback Later → Interested`, the stale-SOSL guard, the PATCH vs create path, and apostrophe email/name. JSONata 91 was checked with jsonata 2.0.6 (`O'Brien` → `O\'Brien`).

## Open (not changed)
- **A5** prospect `{}` (call with no linked prospect) → every CRM create branch fails REQUIRED_FIELD_MISSING. Same open decision as Call Logged.
- A7 SOSL encoding / phone match, A8 `?_HttpMethod=PATCH` via connector: unproven live (same as Call Logged).
- Race: Call Logged (90 s delay) and Outcome Updated for the same call at the same moment → both may create a Task (lookup by CallObject runs before either write). Report only.
- Note bodies (220–231) show only `Call Outcome: <new>`, not the transition. Only the Task description shows it.

## Retest plan
K1 outcome set first time on a logged call → existing Call Logged Task is PATCHed (Disposition/Description updated, no 2nd Task) · K2 change outcome again → `old → new` in Description · K3 Contact+Lead+Opp objects (A6) · K4 outcome on a call with no Call Logged Task yet → Task created · C1/UC1/UL1/UO1 (A3)/A1s "Sean O'Brien" (A2) + create-note · E1 prospect `{}` (A5).

## Cross-check vs all SH→SF siblings (2026-10-12, offline)
Siblings: Email Sent v5, Link Clicked v3, Reply Received v4, Opened v3, Prospect Outcome v3, Bounced v2, Unsubscribed v2, Call Logged v3.
- No node type or connector action in v2 that the email-family siblings lack. No hardcoded host.
- Call Logged v3: 0 shared-node differences, apart from 204, the trigger and the ids.
- `soql_name` is in all 8 siblings. `id`+`Id` on update_opportunity is in 7 of 8 (Unsub v2 has `Id` only).
- Intentional, inherited from Call Logged: `!= null AND` in lookups, note-body code nodes, no Name/Email on 81/23 (siblings send `""` or the lookup value).
- Side notes in other workflows (not touched): S1 Unsub v2 node 81 has no `id`. S2 Prospect Outcome v3 rule 75 `update-opportunity` is not in its options. S3 Bounced v2 `create-note` is not in its options.

## v3 — `v3-no-static-phone.json` (patch `../../patches-shared/phone_fix.py`, user rule 2026-10-12: nothing fixed except required/lookup fields, as HubSpot)
From `v2-fix-all.json`. Contact/Lead/Account create+update: `Phone` `{{event.body.prospect.phoneNumber}}` → `""` (not sent; Salesforce Phone untouched unless mapped, mapping still wins via additional_fields). Kept: LastName, Lead Company, Account Name, Opportunity Name/Stage/CloseDate, Email, FirstName.
Self-check: only `Phone` on those nodes changed; graph/config identical. Catalog re-scan: no new finding. Not live-tested.

## v4 — `v4-same-names.json` (patch `../../patches-shared/naming_fix.py`, user 2026-10-12: create and update use the same name)
From `v3-no-static-phone.json`. same as Call Logged v6. Self-check: only these fields changed. Not live-tested.

## Live — account harsh+dialer (user 81360, linked account 81360), 2026-10-14
Setup: Call Outcome Updated config Actions `["update-account"]` → `["record-call-activity"]`, Select Object `["Contact","Lead","Opportunity"]` → `["Contact"]` (originals to restore).
All 25 call logs of the account have no linked prospect → payload `prospect: {"tag":[]}` → phone-only path.
Salesforce: Contact "Hari Hari" 003dL00002X2QdVQAV Phone `+919173488443` (existing Call Logged Task 00TdL00000EoTefUAF, CallObject 32564);
created Contact 003dL00002eUSGsQAO Phone `+91 98100 12345` for call 32563.

| # | Call / outcome | Execution | Node 200 | Loop 206 | Salesforce after | Result |
|---|---|---|---|---|---|---|
| T1 | 32564 → Interested (update path, Task exists) | 6acf40da8f104bfc48faa87e | OK: SOSL `9173488443`, no email query | ERRORED `1 batch(es) errored` | Task unchanged, no new Task | FAIL |
| T2 | 32563 → Interested (create path, formatted phone) | 6acf415713ed1b251a21801f | OK: SOSL `9810012345` | ERRORED `1 batch(es) errored` | no new Task | FAIL |

Direct REST reproduction (own token): SOSL as sent by 200 finds Hari (OK); the same query re-encoded → MALFORMED_SEARCH.
`POST /sobjects/Task/<id>?_HttpMethod=PATCH` on a probe Task → 204, applied (probe deleted).
Loop children are not in the node log — failing child not yet identified.
Suspect: 202 (and 205) put the query string inside `url_path`; every httprequest proven live elsewhere passes params via `query_string`.
Side finding: Call Logged's earlier Task for call 32563 (00TdL00000EoS13UAF) has WhoId null.

### Rerun after user reconnected Salesforce in Pyxis (T1/T2 failures above = broken connection, not the url_path suspicion)
| # | Call / outcome | Execution | Salesforce after | Result |
|---|---|---|---|---|
| T1 | 32564 Interested → Callback Later, Select [Contact] | 6acf41fe87fbd81641d11366 | existing Task 00TdL00000EoTefUAF PATCHed (Disposition, "Outcome: Interested → Callback Later"), still 1 Task on Hari; phone-only match | PASS |
| T2 | 32563 → Callback Later, formatted `+91 98100 12345` | 6acf422594af3d98b894613b | new Task 00TdL00000FnpFFUAZ on 003dL00002eUSGsQAO | PASS |
| T3 | 32563 Callback Later → Not Interested | 6acf424d7f8e9c58d5e48f32 | same Task updated, still 1 | PASS |
| T4 | 32563 same outcome again | none (edge skips) | no change | PASS |
| T5 | 33415 missed, `+15874786766` (no SF record) | 6acf43915f6567d77c681c0c | orphan Task 00TdL00000Ez8mzUAB (WhoId/WhatId null, created 2026-09-23 by Call Logged) UPDATED to Interested | **FAIL B1** |
| T6 | 32564 → Not Interested, Select [Contact, Lead, Opportunity] | 6acf43cc13ed1b251a2291f7 | Contact Task updated (OK); Lead round (no Lead) CREATED orphan Task 00TdL00000FnhcgUAB (WhoId null) | **FAIL B1** |

- **[JSON] B1 `call-outcome-updated` / `call-logged` → record-call-activity** — Expected: no record found → no Task. Actual: rule 207
  `{{node.203.body.recordId}} exist` passes when recordId is `null`; 208 then queries `WhoId = ''` (= Tasks with no owner), 210 PATCHes an
  orphan with the same CallObject or creates a new Task with no WhoId/WhatId. Same nodes in Call Logged → explains the existing orphans
  (32563 00TdL00000EoS13UAF, 33415 00TdL00000Ez8mzUAB). Not testable here: email path (no call in this account has a linked prospect).
Config restored: Actions `["update-account"]`, Select Object `["Contact","Lead","Opportunity"]`.
