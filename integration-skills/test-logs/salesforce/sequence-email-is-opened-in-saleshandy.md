# Salesforce: "Sequence Email is Opened in Saleshandy" test log

- CRM: Salesforce (Developer org) · Env: staging · Refold export_id `681368981acc0cbcd16295be` (workflow_id `65f3eed7dc17494c670f968a`), slug `salesforce`.
- v1 = `v1-original.json` (94 nodes, 89 edges), extracted verbatim from the session transcript (a HubSpot Opened JSON was pasted first by mistake; ignored).
- Trigger: Saleshandy "Email Opened" event (custom trigger `64647480c7f3ab6e2bf5b11f`). Payload: edge `src/settings/integration/integration.service.ts:298` → `emailOpenedAt = actionTime`, `openCount = actionCount`, + `prospect`, `user`, `sequence`.
- Same family and same bugs as SF Reply Received v1 / Email Sent v1 (both signed off). Node ids match up to ~106, differ above.
- Test setup: open tracking on via Open API `PATCH /v1/sequences/{hash}/settings {"settings":[{"code":"track-email-opens","value":"1"}]}` (`text-only-email=2` forces it off: `src/sequence/services/sequence-setting.service.ts:317`). User opens each sent email by hand.
- Config field ids: Actions `65eee7666b6b77ca8a186199`, Select Object `67ee26494db5f4f586f7505c`, Closing date (while creating) `65eeffa6ac42f28c5e52a1df`, Opp Stage (While creating) `65f27ebc912f0b34b92dee29`, Closing date (while updating) `66056e5b3fc2e06a668f38f7`, Opp Stage (While updating) `66056e733fc2e06a668f3a22`.

## v1 → audit (static; mechanical part by `../reply-received-in-saleshandy/patches/audit_v3.py`: 67 findings)
| # | Nodes | Finding | Sibling (confirmed live) |
|---|---|---|---|
| A1 | readers of transforms 4,12,20,26,30,44,55,66,77,78,91,92,105: 5,7,13,16,21,23,24,25,29–33,41,43–46,56,57,67,68,79,81,94,98,100–103,106 | `node.X.body.<key>`; transform output is `{"result":{…}}` → exists-rules always false (duplicates, silent no-op updates, lead path despite contact), Account Name '', CloseDate empty | Reply A1 / Email Sent B3 |
| A2 | 6,7,15,16,22,23,32,33,46,57,68 | `prospect.phone`; payload key is `phoneNumber` → Phone never written | Reply A2 / Email Sent B1 |
| A3 | 3,19,54,104 (Contact), 29,43 (Account), code 109 | SOQL built from raw values → apostrophe (O'Brien) = MALFORMED_QUERY; contact match also by First+Last name | Reply A3 / Email Sent S8 |
| A5 | 78 | `record[{Email:…}]` on Opportunity (no Email field); output key named `contact_id` | Reply A5 / Email Sent S5 |
| A6 | 77, 81 | update-opportunity uses "(while creating)" stage/date; config has "(while updating)" fields | Reply A6 / Email Sent S6/S7 |
| A7 | 109 | `object.forEach` with no guard → crash when Select Object empty | Reply A7 / Email Sent S13 |
| A12 | 112 (+116) | attach-activity composite JSON built by string templating; email body text from 116 (newlines, quotes) and sequence name pasted raw → invalid JSON → no Task (`#50`) | Reply A12 (fixed in Reply v3 with Task-object pattern) |
| A13 | config_fields `Actions` | `update-opportunity` is not in `possible_options` (rule 75 reads it; Email Sent / Reply have it; webui `helper.ts:314` offers it for this workflow). Branch may be unreachable | NEW — verify live |

Report only (not changed unless asked): orphan nodes 107 (hardcoded WhoId composite), 114 (hardcoded `shoaib+test@` SOQL), 115 (`SELECT … FROM CONTACT`) — unreachable; #53 `record[{Email:…}]` in 12/66 harmless (SOQL already filters); create-opportunity creates a new Opp per open; Account named after the person; ActivityDate = datetime (accepted by SF, Email Sent S2).

## Scenario matrix (one open = one run; non-conflicting actions combined, creates never combined — parallel create race)
| Run | Actions | SF setup | Prospect | Expected v1 |
|---|---|---|---|---|
| O1 | create-contact, create-note | none | new `rudra+sf-open1` | 6 Create + 93 Note; Phone empty (A2) |
| O2 | create-contact, create-note | contact exists (O1) | same (re-open) | A1 → 6 Create → DUPLICATES_DETECTED |
| O3 | update-contact, create-lead, create-note | contact exists | same | A1: update silent no-op; lead path runs → duplicate |
| O4 | create-lead, create-note | none | new `rudra+sf-open2` | 15 Create Lead + 95 Note; Phone empty |
| O5 | update-lead, create-note | lead exists (O4) | same | A1 silent no-op |
| O6 | create-opportunity, create-account, create-note (Closing 7, Prospecting) | none | new `rudra+sf-open3` | A1: Opp REQUIRED_FIELD_MISSING CloseDate; Account empty body |
| O7 | update-opportunity, update-account, attach-activity [Contact, Opportunity], create-note | opp + account exist (API) | same | A13/A5/A6; A1 account no-op; A12 no Task |
| O8 | attach-activity, Select Object empty | — | any | A7 crash |
| O9 | create-contact, create-note | none | new "Sean O'Brien" `rudra+sf-open4` | A3 MALFORMED_QUERY |

## v1 → live pass (2026-10-06 16:34–16:39 UTC, stopped early by user: "bugs are the known family, write the new version")
Sequence `196005` (hash `glwG5nOYa6`), step `9KwOAr94a6`, open tracking on (code 5 = 1), sender rudra@ (369550). Env: `~/.config/sh-integration-testing/wf-salesforce-email-opened.env`. Every open (also re-opens) fires one run ~10–40 s later.

| # | Actions | Execution | Result |
|---|---|---|---|
| O1 | create-contact, create-note (new) | 6ac523379affb660a865c7b3 | PASS: 5 false → 6 Contact 003dL00002dScajQAC → 93 Note 002dL00000rr3XWQAY. **A2 confirmed**: top-level Phone absent (SF Phone null; MobilePhone from mapping) |
| O2 | same (contact exists, re-open) | 6ac52351395e2d1fbe5d79ec | FAIL **A1**: 4 `{"result":{"contact_id":…}}`, 5 false → 6 Create → DUPLICATES_DETECTED |
| O3 | update-contact, create-lead, create-note (contact exists) | 6ac52395567663e6c8115c34 | FAIL **A1**: 56 false → update silently skipped; 106 false → lead path runs despite contact → 15 DUPLICATES_DETECTED (Lead rule matched the Contact) |
| O4 | create-lead, create-note (new `open2`) | 6ac523d4395e2d1fbe5e582a | PASS: Lead 00QdL00000iXCU5UAO (Company, Phone/Title via mapping) + Note 002dL00000rr5xVQAQ |
| O4b | same, lead exists (re-opens) | 6ac523e0a4dfaf80c5c74ba1, 6ac523ee9affb660a86789b3 | FAIL **A1**: 13 false → Create Lead → DUPLICATES_DETECTED instead of Update Lead |
Not run on v1 (same code confirmed live in Reply Received v1 / Email Sent v1): A3 apostrophe, A5/A6 update-opportunity, A7 empty Select Object, A12 Task JSON, A13 option, plus create-opportunity/account and update-lead/account (all A1).

## v2 — `v2-fix-all.json` (patch: `patches/v2_fix_all.py`, change list: `patches/v2-changes.json`)
75 field changes in 45 nodes + 1 config option. Nodes (94) / edges (89) / other config_fields / export_id / trigger byte-identical; orphans 107/114/115 untouched.
- A1: every reader of transforms 4,12,20,26,30,44,55,66,77,78,91,92,105 → `.body.result.<key>`.
- A2: `prospect.phone` → `prospect.phoneNumber` (6,7,15,16,22,23,32,33,46,57,68).
- A3: contact lookups 3,19,54,104 email-only; 91/92 return `soql_name` (escaped) used by 29/43; node 109 escapes `'`/`\`.
- A5: 78 → `{"opportunity_id": record[0].Id}`; 79/81(`id`,`Id`)/103 read it.
- A6: 77 "Closing date (while updating)" (query + node_rule), 81 StageName "(While updating)".
- A7: 109 `(object || []).forEach`.
- A12: 116 builds the Task object (Subject/Status/ActivityDate/Description as v1, email body HTML → text, WhoId/WhatId set in JS); 112 body = `"{{node.116.body}}"` (Email Sent 123/102, Reply v3 113/107 pattern).
- A13: `Actions.possible_options` + `update-opportunity` (after update-account).
Verification: patch self-checks pass; catalog audit v1 67 → v2 **0**; nodes 109 and 116 executed offline (node + cheerio): O'Brien → `Name='Sean O\'Brien'`, empty object → `[]`, Task with quotes/newlines → valid JSON, WhoId set.

### v2 retest plan (after import, one open per run)
V1 create-contact new · V2 create-contact existing → Update + Note · V3 update-contact + create-lead (contact exists → update, lead skipped) · V4 create-lead new · V5 create-lead existing → Update Lead · V6 update-lead · V7 create-opportunity (Closing 7, Prospecting) · V8 create-account · V9 update-opportunity + update-account + attach-activity [Contact, Opportunity] · V10 attach-activity empty Select Object · V11 O'Brien create-contact + create-account.

## v2 live retest (2026-10-06 16:49–17:05 UTC, after user import) — every path PASS
Fresh email per scenario via send-now (`send-for-open.sh` now removes + re-adds a prospect already in the sequence); watcher `ONLY_EMAIL=… check-run.sh` ignores stray opens of other emails.

| # | Actions | Execution | Result | Salesforce after |
|---|---|---|---|---|
| V1 | create-contact, new (`open3`) | 6ac526edc3cdec25939abad2 | PASS: node 3 email-only (v2 live), 5 false → 6 Create with **Phone** (A2) → 93 Note | Contact 003dL00002dSd1VQAS + Note |
| V2 | create-contact, existing | 6ac52709c3cdec25939b6f2c | PASS (A1): 5 **true** → 7 Update (id) → 41 Note, no duplicate | — |
| V3 | update-contact + create-lead, contact exists | 6ac527eafa6cccda5c425f3f | PASS: 56 true → 57 Update (Title QA V2b, Phone 9999960033) → 101 Note; 106 **true** → lead branch stops | — |
| V4 | create-lead, lead exists (`open2`) | 6ac52835567663e6c815c63d | PASS (A1): 13 true → 16 Update Lead → 94 Note, no duplicate | Lead 00QdL00000iXCU5UAO |
| V5 | update-lead | 6ac5287c27142f792cd96031 | PASS: 67 true → 68 Update (Title Head Ops V3) → 102 Note | — |
| V6a | create-opportunity + create-account, contact exists (`open1`) | 6ac52897a4dfaf80c5cbcd78 | PASS: 21 true → 23 Update → 24 Opp 006dL00000T8snJQAR CloseDate 2026-10-13 (+7), Prospecting, ContactId → 96 Note; 33 Account "Asha OpenOne" + 99 Note | — |
| V6 | create-opportunity + create-account, new (`open4`) | 6ac528aefbe606a80f55b5d6 | PASS: 22 Contact 003dL00002dSt0TQAS (Phone) → 25 Opp 006dL00000T8ss9QAB (+7, Prospecting, ContactId) → 97 Note; 33 Account "Dev OpenFour" 001dL00002ZHMbdQAH + 99 Note | — |
| V6b | create-account, account exists (`open1` re-open) | 6ac528a19affb660a86bb600 | PASS: 31 true → 32 Update Account → 98 Note | — |
| V7 | update-opportunity + update-account + attach-activity [Contact, Opportunity] | 6ac52936a4dfaf80c5cc2af4 | PASS: **75 true (A13)** → 78 `opportunity_id` (A5) → 81 Qualification, CloseDate 2026-10-20 (+14 "while updating", A6) → 103 Note; 45 true → 46 Update Account Phone 9999960044 → 100 Note; loop 113 Success | **Tasks (A12)** 00TdL00000FZb7JUAT WhoId contact, 00TdL00000FZb8vUAD WhatId opp (+ second pair from a 2nd open) |
| V8+V9 | create-contact + create-account + attach-activity, Select Object `[]`, "Sean O'Brien" | 6ac529c627142f792cda37ee | PASS: 109 `[]`, loop fanout `[]`, no crash (A7); 29 `Name='Sean O\'Brien'` no MALFORMED_QUERY (A3) → 31 true → 32 Update Account → 98 Note; 6 Contact O'Brien 003dL00002dSwftQAC → 93 Note; 0 errored nodes | — |
| V10 | create-lead, new (`open6`) | 6ac52a1aa4dfaf80c5ccd6f6 | PASS: 106 false → 13 false → 15 Lead 00QdL00000iXFjhUAG with Phone → 95 Note | — |

Observations (not bugs / accepted earlier):
- `open2` (Lead only) + create-contact → DUPLICATES_DETECTED: Salesforce Standard_Contact_Duplicate_Rule matches the Lead with the same email (CRM-CONFIG, same as Reply R7a).
- create-opportunity creates a new Opportunity per open (accepted). With several same-named opps, update-opportunity takes SOQL `record[0]` (no ORDER BY) — V7 updated the 2nd of 3, not the newest. Same as signed-off Email Sent / Reply. Change to `ORDER BY CreatedDate DESC LIMIT 1` on node 76 only if the user wants "latest".
- Notes are one run-on line (no line breaks), unchanged from v1.

## SIGN-OFF — v2 (`v2-fix-all.json`) is the final version (2026-10-06)
All branches pass live on v2: create/update contact, create/update lead (+ lead skipped when contact exists), create/update opportunity ("while creating"/"while updating" settings), create/update account (incl. apostrophe), create-note, attach-activity (Contact + Opportunity linked Tasks), empty Select Object.

## v3 — `v3-opp-latest.json` (user request 2026-10-07: update-opportunity must update the LATEST same-named Opportunity)
Patch: `../../patches-shared/opp_latest.py` (self-checking, shared by all 5 SH→SF workflows). From `v2-fix-all.json`; 2 field changes, nothing else changed (nodes/edges/config identical).
- node 76 `q` + ` ORDER BY CreatedDate DESC LIMIT 1` → node 78 `record[0]` is now the newest Opportunity (update-opportunity + its Note).
- node 109 attach-activity Opportunity query + same suffix → Task WhatId goes on the newest Opportunity.
Proof (read-only SOQL, 2026-10-07): Name='rudra+sf-k6@…' without ORDER BY returned the older 006dL00000T9pNZQAZ first; with it, the newer 006dL00000T9pQnQAJ. Catalog audit unchanged; code node run offline (escaping intact). Not live-retested (same query proven by the read-only SOQL).

## v4 — `v4-no-static-phone.json` (patch `../../patches-shared/phone_fix.py`, user rule 2026-10-12: nothing fixed except required/lookup fields, as HubSpot)
From `v3-opp-latest.json`. Contact/Lead/Account create+update: `Phone` `{{event.body.prospect.phoneNumber}}` → `""` (not sent; Salesforce Phone untouched unless mapped, mapping still wins via additional_fields). Kept: LastName, Lead Company, Account Name, Opportunity Name/Stage/CloseDate, Email, FirstName.
Self-check: only `Phone` on those nodes changed; graph/config identical. Catalog re-scan: no new finding. Not live-tested.

### v4 live (2026-10-12)
| O6 create-account + note (open by user) | 6acc9f3a23caf681f29486ab | **PASS**: 33 Account Name = "Otto OpenSixTest" (person), no fixed Phone (Account Properties fields empty for this prospect); Note 99 on the Account |
