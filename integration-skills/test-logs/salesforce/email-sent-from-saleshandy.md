# Salesforce — "Email Sent from Saleshandy" — test log

- CRM: Salesforce (Developer org) · Env: staging (Pyxis `pyxis.lifeisgoodforlearner.com`) · Refold workflow_id `65eed4b26b6b77ca8afb243b`
- Sender: `rudra@saleshandy.com` · Prospects: `rudra+sf-<scenario>@saleshandy.com`
- v1 = `v1-original.json` (115 nodes, 108 edges, 54 config_fields). Identical to `integration-jsons-salesforce/email-sent-from-saleshandy-current.json`; the earlier node-123 fix in `...-fixed.json` (`response:` → `body.` templates) was **never applied**.

## Trigger
Saleshandy "Email Sent" event (custom app trigger `64634e0ac7f3ab6e2bf52fdf`) — fires when a sequence email step is actually sent to a prospect. Branches selected by config field `Actions` (multi-select).

## Branch map (v1)
| Actions value | Path | Result in Salesforce |
|---|---|---|
| create-contact | 2→3 SOQL Contact→4→105/106 mapping→5 exists? → 7 Update / 6 Create → 41/40 Note | Contact + Note |
| create-lead | 10→95 SOQL Contact→96→97 (only if **no** contact) →11 SOQL Lead→12→119/120→13 → 16 Update / 15 Create → 90/89 Note | Lead + Note |
| create-opportunity | 17→19 SOQL Contact→26 due date→20→107/108→21 → 23 Update contact→121→24 Create Opp→37 Note / 22 Create contact→122→25 Create Opp→36 Note | Contact + Opportunity + Note |
| create-account | 28→91 name=first+last→29 SOQL Account→30→109/110→31 → 32 Update→34 Note / 33 Create→35 Note | Account + Note |
| update-account | 42→92→43→44→45 exists? →115/116→46 Update→47 Note | Account updated + Note |
| update-contact | 53→54→55→56 exists? →111/112→57 Update→58 Note | Contact updated + Note |
| update-lead | 64→65→66→67 exists? →113/114→68 Update→69 Note | Lead updated + Note |
| update-opportunity | 75→76 SOQL Opp→77 due date→78 opp id→79 exists? →117/118→81 Update→82 Note | Opportunity updated + Note |
| attach-activity | 98→99 code (per `Select Object`)→103 loop{100 SOQL→101 found?→104 HTML→text→123 Task body→102 composite POST Task} | Task (Email, Completed) on each object |
| create-note | not a branch; node_rule on every Note node | Note |
| (orphans) | 48 Delete Account, 59 Delete Contact, 70 Delete Lead, 83 Delete Opp (no incoming edge), 94 hardcoded GET | never run |

## Static suspects (to CONFIRM or REJECT live — not bugs until proven)
| # | Node | Suspect | Expected live symptom |
|---|---|---|---|
| S1 | 123 | `{{node.103.response:array_item.idType}}` / `{{node.100.response:records.0.Id}}` — non-standard template syntax (earlier fix never applied) | Task created without WhoId/WhatId, or composite error |
| S2 | 123 | `ActivityDate: emailSentAt` — Date field fed a datetime string | composite sub-request 400 "Cannot deserialize … date" |
| S3 | 23 | Update Contact (opportunity branch) sends `Email: ""` | existing contact's Email blanked |
| S4 | 41 | Note node_rule `eq` against multi-select `Actions` (all others use `contains`) | no Note on create-contact → existing-contact path when >1 action selected |
| S5 | 78 | `record[{Email:…}].Id` on Opportunity (no Email field) | opportunity_id empty → update-opportunity never updates |
| S6 | 77 / 81 | update-opportunity uses "(while creating)" stage/date fields, not "(while updating)" | wrong stage/close date on update |
| S7 | 81 | `"id": {{node.78.body.contact_id}}` (doesn't exist) alongside `Id` | possibly harmless; check request |
| S8 | 3,19,54,95,11,60,65,71,76,84,99 | SOQL built by string interpolation — apostrophe in name/email (O'Brien) breaks query | MALFORMED_QUERY |
| S9 | 3/19/54/95 + transform `record[0]` | contact match `Email OR (FirstName AND LastName)` takes first record | may update the wrong contact with same name |
| S10 | 21→22/23→24/25 | create-opportunity creates a **new** Opportunity on every email sent (no opp lookup) | duplicate opportunities per step — STRUCTURAL, needs your decision |
| S11 | 91/92 | Account Name = prospect first+last name, not company | account named after the person — STRUCTURAL/semantic, needs your decision |
| S12 | 26/24/25 | CloseDate only computed if "Closing date (while creating)" set; CloseDate is required on Opportunity | create opp fails if closing date empty |
| S13 | 99 | `Select Object` empty with attach-activity → `object.forEach` of undefined | code node crash |
| S14 | 15 | Lead `Company` required in SF; prospect without company | create lead fails |
| S15 | 6/22 | Contact `LastName` required; prospect without last name | create contact fails |
| S16 | 48/59/70/83/94 | orphan delete branches + hardcoded GET node | dead nodes — STRUCTURAL cleanup, needs your decision |
| S17 | 12/61/66/72 | JSONata `record[{Email:"x"}]` — object predicate, not `record[Email="x"]` | may return all records' Ids (array) when >1 record |

## Scenario matrix
| ID | Actions selected | Setup in Salesforce | Prospect variant | Checks |
|---|---|---|---|---|
| C1 | create-contact, create-note | none | full fields | Contact created w/ mapped fields + Note |
| C2 | create-contact, create-note | contact exists (same email) | changed phone | Contact updated (not duplicated) + Note (S4) |
| C3 | create-contact | none | no last name | S15 |
| C4 | create-contact | none | last name `O'Brien` | S8 |
| L1 | create-lead, create-note | none | with company | Lead created + Note |
| L2 | create-lead | lead exists | — | Lead updated |
| L3 | create-lead | contact exists | — | lead skipped (by design) |
| L4 | create-lead | none | no company | S14 |
| O1 | create-opportunity, create-note + closing date + stage | none | — | Contact + Opp (CloseDate, Stage, ContactId) + Note |
| O2 | same | contact exists | — | contact not blanked (S3), Opp linked |
| O3 | same, 2nd email step | — | — | duplicate opp? (S10) |
| O4 | create-opportunity, no closing date | none | — | S12 |
| A1 | create-account, create-note | none | — | Account created + Note (S11) |
| A2 | create-account | account exists | — | Account updated |
| UA1 | update-account | account exists / not | — | updated / no-op |
| UC1 | update-contact, create-note | contact exists / not | — | updated + Note / no-op |
| UL1 | update-lead, create-note | lead exists / not | — | updated + Note / no-op |
| UO1 | update-opportunity, create-note + "while updating" fields | opp exists | — | S5, S6, S7 |
| T1 | attach-activity, Select Object=Contact | contact exists | — | Task on Contact, Subject/Description/ActivityDate (S1, S2) |
| T2 | attach-activity, Lead+Contact+Opportunity | all exist | — | one Task per object |
| T3 | attach-activity, object not in SF | none | — | no Task, no error |
| T4 | attach-activity, Select Object empty | — | — | S13 |
| F1 | field mapping screen | — | — | Contact/Lead/Account/Opportunity Properties map to real SF fields |

## v1 → live pass (2026-10-06, API-only)
Sequence `195938` (hash `Y7PWV0WJwo`), step `463276` (`LZwl3RKMzl`), sender `rudra@saleshandy.com` (emailAccountId 369550).
Mapping set by user: Contact {firstName,lastName,email,phoneNumber→MobilePhone,jobTitle→Title,department}; Lead {jobTitle,city,state,country,phoneNumber→Phone,email,firstName,lastName}; Account {companyWebsite→Website, companyPhone→Phone}; Opportunity {dealValue→Amount, closingDate→CloseDate}.

| Run | Execution | Actions | Prospect | Result |
|---|---|---|---|---|
| C1 | 6ac46b8449c1bb5b18477f30 | create-contact, create-note | rudra+sf-c1 (new) | PASS Contact 003dL00002dMWEfQAO + Note; mapping OK; **Phone null (B1)** |
| R2 | 6ac46ca5a2ad7db18e2c4b5b | all 10 + Select Object all | rudra+sf-r2 (new) | Contact+Note OK; Lead DUPLICATES_DETECTED (race); Opp-branch contact DUPLICATES_DETECTED (race); Account REQUIRED_FIELD_MISSING Name (**B3**); no Task (**S1**) |
| R3 | 6ac46d0a0ae49e484b2d6702 | all 10 | rudra+sf-r2 (existing) | node 4 = `{"result":{"contact_id":"003…"}}` but rule 5 false → Create Contact DUPLICATES_DETECTED (**B3**); all update-* branches dead (**B3**) |
| R4 | 6ac46e1b9d9d99cfad34eeb5 | all 10 | Sean O'Brien, no company | MALFORMED_QUERY on 3/19/54/95 (**S8**); account create empty body (B3) |
| probe | direct SF composite | — | — | datetime in Task.ActivityDate accepted (**S2 rejected**); unknown key → INVALID_FIELD inside HTTP 200 (explains S1 silent failure); probe Task deleted |

Static suspects resolved: S1 CONFIRMED, S2 REJECTED, S3 REJECTED (connector drops empty values), S4 fixed by reasoning (eq vs multi-select), S5/S17 not observed (report only), S6/S7 CONFIRMED by reading (update branch was dead via B3), S8 CONFIRMED, S9 fixed with S8, S10 KEEP (user), S11 KEEP (#45 precedent), S12 report (Closing date config required for create-opportunity), S13 fixed, S14/S15 report, S16 orphans report.

## Bugs (v1)
- **[JSON] B3 all branches → every transform reader** — Expected: exists-rules see the found id. Actual: transform output is `{"result":{…}}`, readers use `node.X.body.contact_id` → empty → always create (DUPLICATES_DETECTED), update-* never run, Account Name '' (REQUIRED_FIELD_MISSING), CloseDate empty. Root cause: 41 nodes, `.body.` → `.body.result.`.
- **[JSON] B1 Phone** — Expected: Phone = prospect phone. Actual: null. Root cause: template `prospect.phone`; payload key is `phoneNumber` (edge `src/settings/integration/integration.service.ts:425` camelCases the label "Phone Number"). 11 nodes.
- **[JSON] S1 attach-activity Task** — Expected: Task on Contact/Lead/Opp. Actual: none, run shows success. Root cause: node 123 `{{node.103.response:array_item.idType}}` / `{{node.100.response:records.0.Id}}`; composite (allOrNone=false) hides the 400.
- **[JSON] S8 apostrophe** — MALFORMED_QUERY on `LastName='O'Brien'`. Fix (approved): email-only Contact lookup in 3/19/54/95; node 99 escapes `'`.
- **[JSON] S4** node 41 note rule `eq` → `contains`. **[JSON] S6/S7** node 77/81 use "(while updating)" fields, node 81 `id` → opportunity_id. **[JSON] S13** node 99 `(object || []).forEach`.
- **[CRM-CONFIG / user decision] B2 race** — create-contact + create-opportunity/create-lead together race on contact create; Salesforce Standard duplicate rules block the 2nd insert. User: not a bug, customers must not combine them. Not changed.

## v1 → isolated pass, one action per run (2026-10-06)
Each run selects exactly one action (+ create-note where the branch has a Note). Script: `.claude/skills/integration-testing/scripts/sh-email-sent-run.sh`. Results re-read from Salesforce after the runs.

| # | Action(s) | Setup | Execution | Result | Salesforce after |
|---|---|---|---|---|---|
| C1 | create-contact + note | new person | 6ac46b8449c1bb5b18477f30 | PASS (Phone missing, B1) | Contact + Note |
| S1 | create-contact + note | contact exists | 6ac471a472aaa8e91d101df2 | FAIL B3: found, rule false, Create → DUPLICATES_DETECTED | unchanged |
| S2 | update-contact + note | contact exists | 6ac471d39d9d99cfad35dad5 | FAIL silent B3: COMPLETED, nothing updated | Title still "QA Lead" (sent "QA Lead III") |
| S3 | create-lead + note | new person, company | 6ac471fea2ad7db18e2e0e9e | PASS: Lead 00QdL00000iUEatUAG + Note; mapping City/State/Country/Title/Phone OK | Lead + Note |
| S4 | update-lead + note | lead exists | 6ac473d649c1bb5b184a0d0e | FAIL silent B3 | Title still "Head of Ops" (sent "VP Ops") |
| S5 | create-opportunity + note | new person | 6ac473fd9d9d99cfad3699c3 | FAIL **B5 (new)**: contact created, Opportunity `JSON_PARSER_ERROR` on mapped CloseDate "2026-12-31 00:00:00" | Contact only |
| S6 | update-opportunity + note | opp created via API | 6ac474479d9d99cfad36a844 | FAIL silent: node 78 `record[{Email:…}]` → {} (**S5 confirmed**, Opportunity has no Email) + B3; used "while creating" 7 days (**S6 confirmed**) | unchanged (Amount 5000, sent 6500) |
| S7 | create-account + note | new person | 6ac47473a2ad7db18e2ef5d3 | FAIL B3: Name '' → REQUIRED_FIELD_MISSING | none |
| S8 | update-account + note | account "Asha SFAcctA1" via API | 6ac474a772aaa8e91d114328 | FAIL silent B3: lookup by Name='' | Website/Phone still null |
| S9 | attach-activity (Contact, Lead, Opportunity) | all three exist | 6ac474e272aaa8e91d11556b | FAIL **S1 refined**: 3 Tasks created but WhoId/WhatId null (orphans, not on any record). 29 such orphan Tasks already in the org from past runs | 3 orphan Tasks |
| S10 | create-note only | — | 6ac47524a2ad7db18e2f4f28 | as designed: no branch runs (create-note only modifies other actions) | none |
| S11 | create-contact + note | no last name | 6ac4754472aaa8e91d117cd6 | FAIL **B7**: REQUIRED_FIELD_MISSING LastName | none |
| S12 | create-lead + note | no company | 6ac47561a2ad7db18e2f55a1 | FAIL **B8**: REQUIRED_FIELD_MISSING Company | none |

Probes: Amount "5000" as text accepted; CloseDate ISO `2026-12-31T00:00:00.000Z` accepted, `2026-12-31 00:00:00` rejected (probe opp deleted).
Noise: workflows "Test" and "Call Activity POC - Email Sent from Saleshandy" on the same account also fire on every email and create "Call - Interested" Tasks; not this workflow.

## v2 — `v2-fix-all.json` (patch: `patches/v2_fix_all.py`, change list: `patches/v2-changes.json`)
68 field changes in nodes 3,5,6,7,13,15,16,19,21,22,23,24,25,29,30,31,32,33,34,41,43,44,45,46,47,54,56,57,58,67,68,69,77,79,81,82,90,95,97,99,123. Nodes/edges/config_fields/export_id/trigger byte-identical; orphans untouched.
Verification: JSON parses; self-check script passes; node 99 + 123 code executed offline on the R4 prospect; escaped SOQL accepted by Salesforce.
### Retest plan (after import): rerun C1, R2 (new prospect), R3 (same prospect, update paths), R4 (O'Brien) + T1 (attach-activity only) + O1 (create-opportunity only).

## v3 — `v3-opp-lookup.json` (patch: `patches/v3_opp_lookup.py`) — import this one, skip v2
v3 = v2 + one fix found in the isolated pass:
- **[JSON] node 78** update-opportunity lookup `record[{Email:"…"}].Id` → `record[0].Id`. Opportunity has no Email field, so the found record was dropped (S6 run: node 76 found the opp, node 78 returned `{}`). Node 76 already filters `Name = prospect email`. Same expression as nodes 4/20/55/96, which returned correct ids live.
Self-check: only node 78 `input_data.query` + `query` differ from v2; everything else byte-identical.

Decisions (2026-10-06, user):
- **B5 Closing Date mapping** — document only. Do not map Saleshandy "Closing Date" → Salesforce CloseDate: the event sends `YYYY-MM-DD HH:mm:ss` (edge `src/settings/integration/integration.service.ts:425` passes the raw attribute value) and CloseDate rejects it (`JSON_PARSER_ERROR`). Use the "Closing date (while creating/updating)" settings instead. ISO `YYYY-MM-DDTHH:mm:ss.sssZ` would be accepted.
- **B7/B8 required fields** — leave as is: prospects without last name (Contact) / company (Lead) fail with REQUIRED_FIELD_MISSING.
- **Orphan Tasks** — keep the 29 existing unlinked Tasks in the dev org.
- create-note alone does nothing by design (it only adds Notes inside other actions).

### Retest plan for v3 (one action per run, same script)
S1 create-contact existing → Update + Note 41 · S2 update-contact · S3 create-lead · S4 update-lead · S5 create-opportunity (Closing Date mapping removed) · S6 update-opportunity (stage/date "while updating") · S7 create-account · S8 update-account · S9 attach-activity → 3 linked Tasks · S11/S12 expect REQUIRED_FIELD_MISSING (accepted) · R4 O'Brien → no MALFORMED_QUERY · C1 new contact → Phone filled.

## v3 live retest — BLOCKED (2026-10-06 05:45 UTC)
- V3-C1 execution `6ac48b150ae49e484b37f882`: v3 is live (node 3 now `WHERE Email='…'` only), but every Salesforce node fails with
  `invalid_grant: expired access/refresh token`. The Pyxis/Refold Salesforce connection for linked account 80121 lost its OAuth grant
  (setup gap, tag CRM-CONFIG, not a workflow bug). Direct REST with our own SF_TOKEN still works (HTTP 200).
- Pass stopped after the first run. Action: user reconnects Salesforce in Pyxis → Settings → Integrations → Salesforce, then the full v3 pass reruns
  (script: `retest-v3.sh` in this folder, same 13 runs as the retest plan above).

## v3 live retest — after Salesforce reconnect (2026-10-06 05:53–06:02 UTC), one action per run
| # | Action | Execution | Result | Salesforce after |
|---|---|---|---|---|
| V3-C1 | create-contact, new | 6ac48d0c9d9d99cfad419964 | PASS (B1 fixed) | Contact 003dL00002dNabBQAS Phone+MobilePhone 9999930001, Title, Department; Note |
| V3-S1 | create-contact, existing | 6ac48d3d9d9d99cfad41d6ba | PASS (B3 fixed): exists=true → Update Contact → Note 41 (S4 fixed) | c1 updated, Note 002dL00000rq0a5QAA |
| V3-S2 | update-contact | 6ac48d6972aaa8e91d1c14d8 | PASS | Title "QA Lead V3b", Phone 9999930012, Note |
| V3-S3 | create-lead, new | 6ac48d899d9d99cfad420d49 | PASS | Lead 00QdL00000iUdqzUAC with Phone/Title/City/State/Country/Company; Note |
| V3-S4 | update-lead | 6ac48db29d9d99cfad420f8c | PASS | Title "VP Ops V3", Phone 9999930032; Note |
| V3-S3b | create-lead, contact exists | 6ac48de072aaa8e91d1c3554 | PASS (by design): contact found → lead skipped | no Lead |
| V3-S5 | create-opportunity, new | 6ac48df972aaa8e91d1c3c83 | PASS | Contact + Opp 006dL00000T74qzQAB: Stage Prospecting, CloseDate 2026-10-13 (+7), Amount 5000, ContactId; Note |
| V3-S6 | update-opportunity | 6ac48e2597137ce0f6c9bb8f | FAIL — **CONFIG**: id (v3 fix), Stage Qualification, CloseDate +14 all correct, but the Opportunity mapping still has Closing Date → CloseDate; mapped value `2027-01-15 00:00:00` overrides the top-level CloseDate (additional_fields wins) → JSON_PARSER_ERROR | unchanged |
| V3-S7 | create-account, new | 6ac48e4572aaa8e91d1c77f2 | PASS (B3 fixed) | Account "Vee SFv3A1", Website, Phone = mapped company phone (mapping overrides prospect phone); Note |
| V3-S8 | update-account | 6ac48e7b97137ce0f6ca1ae2 | PASS | Website acctco-v3, Phone 07940030072; Note |
| V3-S9 | attach-activity (Contact, Lead, Opportunity) | 6ac48ec10ae49e484b39839b | PASS (S1 fixed) | 3 Tasks linked: WhoId contact, WhoId lead, WhatId opportunity |
| V3-S13 | attach-activity, Select Object empty | 6ac48ef80ae49e484b39ba4b | PASS (S13 fixed): no crash, no Task | — |
| V3-R4 | O'Brien (create-contact + attach-activity) | — | NOT RUN: sender rudra@saleshandy.com hit the daily sending limit (code 1001); task 98647331 scheduled 2026-10-07 03:30 UTC | — |
Learned: a mapped field in `additional_fields` overrides the same field set directly in the node (S6 CloseDate, S7 Phone).

## v4 — `v4-account-quote.json` (patch: `patches/v4_account_quote.py`)
Found while preparing R4: the Account lookups (nodes 29, 43) still put the raw name in SOQL (`Name='Sean O'Brien'`) → MALFORMED_QUERY for
create-account / update-account (same mechanism as the confirmed Contact S8 bug; under the approved "escape quotes" fix).
Fix: transforms 91/92 return `soql_name` (backslash + apostrophe escaped) next to `name`; 29/43 query with `soql_name`; Account create/update
(32/33/46) and the record filter (30/44) keep the unescaped `name`. Only nodes 29, 43, 91, 92 differ from v3.
Not yet run live (no JSONata runtime offline; npm registry unreachable) — covered by R4 + S7/S8 regression.

### Remaining before sign-off
1. ~~Remove Closing Date mapping~~ — user: keep as is, accepted behaviour.
2. Import v4, then (after the sender quota resets) run R4 O'Brien with create-account + update-account + create-contact + attach-activity, and regression S7, S8.
- **User decision (2026-10-06):** the Closing Date mapping / date-format behaviour is NOT a bug; keep the mapping as it is. V3-S6
  (update-opportunity failing with JSON_PARSER_ERROR while Closing Date → CloseDate is mapped) is accepted behaviour, not a defect. No change in any version.

## v4 live retest (2026-10-06 06:21–06:30 UTC) — user removed Closing Date → CloseDate from the Opportunity mapping
| # | Action | Execution | Result | Salesforce after |
|---|---|---|---|---|
| V4-R4a | create-contact + note + attach-activity, "Sean O'Brien" | 6ac49387a2ad7db18e3a5089 | PASS: email-only query, no MALFORMED_QUERY; Contact 003dL00002dNgYYQA0 LastName O'Brien + Note. No Task: activity lookup ran in parallel before the new contact existed (accepted parallel-branch behaviour) | Contact + Note |
| V4-R4b | create-account "Sean O'Brien" | 6ac494d397137ce0f6cbf34e | PASS (v4 fix): query `Name='Sean O\'Brien'`, Account 001dL00002ZBhhGQAT named "Sean O'Brien" (unescaped) | Account + Note |
| V4-R4c | update-account "Sean O'Brien" | 6ac494ff97137ce0f6cbf646 | PASS: found, Website/Phone updated | obrien2 / 07940040002 + Note |
| V4-S7 | create-account (regression) | 6ac495200ae49e484b3b25ca | PASS | Account "Vee SFv4A1" + Note |
| V4-S8 | update-account (regression) | 6ac4954cce1b140a159b9fdc | PASS | acctco-v4 / 07940040072 + Note |
| V4-S6 | update-opportunity | 6ac4957a72aaa8e91d1eb031 | PASS: Stage Qualification, CloseDate 2026-10-20 (+14 "while updating"), Amount 6500 | updated + Note |

## SIGN-OFF — v4 (`v4-account-quote.json`) is the final version
All actions pass one-by-one on v3/v4: create/update contact, create/update lead (+ lead skipped when contact exists), create/update opportunity,
create/update account, create-note, attach-activity (Contact/Lead/Opportunity linked Tasks), empty Select Object, apostrophe names.
Accepted / by design (user decisions): parallel-branch race; new Opportunity per email; Account named after the person; date-format of mapped
Closing Date (keep unmapped, the "Closing date" settings set CloseDate); missing LastName/Company fail; create-note alone does nothing; 29 old orphan Tasks kept.

## v5 — `v5-opp-latest.json` (user request 2026-10-07: update-opportunity must update the LATEST same-named Opportunity)
Patch: `../../patches-shared/opp_latest.py` (self-checking, shared by all 5 SH→SF workflows). From `v4-account-quote.json`; 2 field changes, nothing else changed (nodes/edges/config identical).
- node 76 `q` + ` ORDER BY CreatedDate DESC LIMIT 1` → node 78 `record[0]` is now the newest Opportunity (update-opportunity + its Note).
- node 99 attach-activity Opportunity query + same suffix → Task WhatId goes on the newest Opportunity.
Proof (read-only SOQL, 2026-10-07): Name='rudra+sf-k6@…' without ORDER BY returned the older 006dL00000T9pNZQAZ first; with it, the newer 006dL00000T9pQnQAJ. Catalog audit unchanged; code node run offline (escaping intact). Not live-retested (same query proven by the read-only SOQL).

## v6 — `v6-no-static-phone.json` (patch `../../patches-shared/phone_fix.py`, user rule 2026-10-12: nothing fixed except required/lookup fields, as HubSpot)
From `v5-opp-latest.json`. Contact/Lead/Account create+update: `Phone` `{{event.body.prospect.phoneNumber}}` → `""` (not sent; Salesforce Phone untouched unless mapped, mapping still wins via additional_fields). Kept: LastName, Lead Company, Account Name, Opportunity Name/Stage/CloseDate, Email, FirstName.
Self-check: only `Phone` on those nodes changed; graph/config identical. Catalog re-scan: no new finding. Not live-tested.

### v6 live (2026-10-12)
| # | Execution | Result |
|---|---|---|
| E6A create-contact + create-account + note, new | 6acc9e4566b31963c13890a5 | **PASS**: 6 Create Contact without top-level Phone/Title (MobilePhone/Title from mapping); 33 Account Name = person, Phone/Website from Account Properties (no person phone); Notes 40 (Contact), 35 (Account) |

## v6 live — phone comes only from the field mapping (2026-10-14 08:26–08:31 UTC)
v6 confirmed live: node 6/15/57 resolved input `Phone: null` (v5 would show the number). Contact mapping changed per run via
`PUT /config/field/65deed90eafd626bace9b8dc`, then restored; Actions restored to `[]`. Re-read config after: all 4 mappings identical to before.

| # | Contact/Lead mapping for `phoneNumber` | Action | Execution | Salesforce after | Result |
|---|---|---|---|---|---|
| P1 | Contact → `Phone` | create-contact (new ph1, 9999950001) | 6acf3cbe4881b208b891d423 | Phone 9999950001, MobilePhone null | PASS |
| P2 | Contact → `MobilePhone` (org default) | create-contact (new ph2, 9999950002) | 6acf3d048f104bfc48f8518c | Phone null, MobilePhone 9999950002 | PASS |
| P3 | Contact → `Languages__c` (custom text) | create-contact (new ph3, 9999950003) | 6acf3d486e7ef68d281af02e | Languages__c 9999950003, Phone/MobilePhone null | PASS |
| P4 | Contact: not mapped | update-contact ph1, SH phone 9999950099 | 6acf3d9a13ed1b251a1f5950 | Phone still 9999950001; Title updated "QA P4" | PASS |
| P5 | Lead → `Phone` | create-lead (new ph5, 9999950005) | 6acf3ded7f8e9c58d5e11dad | Lead Phone 9999950005 | PASS |

No custom phone-TYPE field exists in this org (Contact/Lead/Account describe); P3 used the custom text field `Languages__c`.
Test records left in Salesforce: Contacts 003dL00002eV20fQAC, 003dL00002eV2S5QAK, 003dL00002eV2iDQAS; Lead 00QdL00000isIhlUAE.
