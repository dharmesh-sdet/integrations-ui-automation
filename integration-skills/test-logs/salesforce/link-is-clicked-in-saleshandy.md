# Salesforce: "Link is Clicked in Saleshandy" test log

- CRM: Salesforce (Developer org) · Env: staging · Refold export_id `681368981acc0cbcd16295bf` (workflow_id `65f3eefedc17494c670fa3a4`), slug `salesforce`.
- v1 = `v1-original.json` (91 nodes, 89 edges), extracted verbatim from the session transcript.
- Trigger: Saleshandy "Email Link Clicked" event (custom trigger `646473d5c7f3ab6e2bf5b10f`). Payload: edge `src/settings/integration/integration.service.ts:291` → `linkClickedAt = actionTime`, `clickCount = actionCount`, `link`, + `prospect`, `user`, `sequence`.
- Same family as SF Opened v2 / Reply v3 / Email Sent v4 (all signed off). Node ids match Opened up to 106; attach-activity loop differs: code 108 → group 112 (entry 109 SOQL → 110 rule → 113 code → 111 composite).
- Test setup: click tracking via Open API `PATCH /v1/sequences/{hash}/settings {"settings":[{"code":"track-link-clicks","value":"1"}]}`; step body must contain a link. Click = `click-email.py <alias>` (IMAP, GET the tracked `<a href>`).
- Config field ids: Actions `65eee7666b6b77ca8a186199`, Select Object `67f4c1ef4db5f4f5861540ea`, Closing date (while creating) `65eeffa6ac42f28c5e52a1df`, Opp Stage (While creating) `65f27ebc912f0b34b92dee29`, Closing date (while updating) `66056efa3fc2e06a668f3dff`, Opp Stage (While updating) `66056f0d3fc2e06a668f3f31`.

## v1 → audit (static; mechanical part by `../reply-received-in-saleshandy/patches/audit_v3.py`: 67 findings)
| # | Nodes | Finding | Sibling (confirmed live) |
|---|---|---|---|
| A1 | readers of transforms 4,12,20,26,30,44,55,66,77,78,91,92,105 | `node.X.body.<key>`; transform output is `{"result":{…}}` → exists-rules always false (duplicates, silent no-op updates, lead path despite contact), Account Name '', CloseDate empty | Opened A1 |
| A2 | 6,7,15,16,22,23,32,33,46,57,68 | `prospect.phone`; payload key is `phoneNumber` → Phone never written | Opened A2 |
| A3 | 3,19,54,104 (Contact), 29,43 (Account), code 108 | SOQL from raw values → apostrophe = MALFORMED_QUERY; contact matched also by First+Last name | Opened A3 |
| A5 | 78 | `record[{Email:…}]` on Opportunity (no Email field); key named `contact_id` | Opened A5 |
| A6 | 77, 81 | update-opportunity uses "(while creating)" stage/date; "(while updating)" fields exist | Opened A6 |
| A7 | 108 | `object.forEach` unguarded → crash when Select Object empty | Opened A7 |
| A12 | 111 (+113) | Task composite JSON built by string templating; email body text, sequence name, link pasted raw → invalid JSON → no Task (#50) | Opened A12 |

Not applicable here: Opened A13 (`update-opportunity` option is already present). No orphan nodes, no hardcoded Saleshandy URL, only connector action = `get_prospect_fields` (validated).
Report only: create-opportunity creates a new Opp per click; Account named after the person; ActivityDate = datetime (accepted by SF); `Select Object` offers no `Account` option although code 108 supports it (unchanged).

## Live v1 pass — skipped
Every finding is the identical code already proven live in Opened v1 → v2 (same node ids/templates). Per the Opened decision ("known family, write the new version") v1 is not re-run; the full matrix runs on v2.

## v2 — `v2-fix-all.json` (patch: `patches/v2_fix_all.py`, ported from Opened v2; change list: `patches/v2-changes.json`)
75 field changes in 45 nodes. Nodes (91) / edges (89) / config_fields / export_id / trigger byte-identical.
- A1: every reader of transforms → `.body.result.<key>`.
- A2: `prospect.phone` → `prospect.phoneNumber`.
- A3: contact lookups 3,19,54,104 email-only; 91/92 return `soql_name` (escaped) used by 29/43; code 108 escapes `'`/`\`.
- A5: 78 → `{"opportunity_id": record[0].Id}`; 79/81(`id`,`Id`)/103 read it.
- A6: 77 "Closing date (while updating)", 81 StageName "(While updating)".
- A7: 108 `(object || []).forEach`.
- A12: 113 builds the Task object (Subject/Status/TaskSubtype/ActivityDate/Description as v1 incl. Click Count + Link Clicked, email body HTML → text, WhoId/WhatId set in JS); 111 body = `"{{node.113.body}}"`.
Verification: patch self-checks pass; catalog audit v1 67 → v2 **0**; nodes 108 and 113 executed offline (node + cheerio): O'Brien → `Name='Sean O\'Brien'`, null object → `[]`, Task with quotes/newlines in body/link/sequence name → valid composite JSON, WhatId set.

### v2 test matrix (after import; one click = one run)
| # | Actions | SF setup | Prospect | Expected |
|---|---|---|---|---|
| K1 | create-contact, create-note | none | new `rudra+sf-click1` | 5 false → 6 Create (Phone) → 93 Note |
| K2 | create-contact, create-note | contact exists | same, click again | 5 true → 7 Update → 41 Note, no duplicate |
| K3 | update-contact + create-lead, create-note | contact exists | same | 57 Update → 101 Note; 106 true → lead branch stops |
| K4 | create-lead, create-note | none | new `rudra+sf-click2` | 15 Create Lead (Phone, Company) → 95 Note |
| K5 | create-lead (lead exists), update-lead | lead exists | same | 16 Update Lead → 94 Note; 68 Update → 102 Note |
| K6 | create-opportunity + create-account (Closing 7, Prospecting) | none | new `rudra+sf-click3` | 22 Contact → 25 Opp (+7d, ContactId) → 97 Note; 33 Account + 99 Note |
| K7 | update-opportunity + update-account + attach-activity [Contact, Opportunity] (Closing upd 14, Qualification) | K6 records | same | 81 Opp updated (+14, Qualification) → 103; 46 Account → 100; 2 Tasks (WhoId/WhatId) with Link Clicked |
| K8 | create-contact + create-account + attach-activity, Select Object `[]`, "Sean O'Brien" | none | new `rudra+sf-click4` | no MALFORMED_QUERY, no crash, 0 errored nodes |

## v2 live test (2026-10-07, after user import; all other SF workflows disabled by the user)
Sequence `196017` (hash `7pzVN19mzb`), step `9bzZ1pK2aM` with a link to saleshandy.com/pricing, click tracking on (code 4 = 1), open tracking off (code 5 = 0). Env `~/.config/sh-integration-testing/wf-salesforce-link-clicked.env`. User clicks the link by hand (IMAP creds for `click-email.py` are empty).
Setup noise (not bugs): first two K1 attempts (`click1`, `click1b`) failed DUPLICATES_DETECTED because the enabled "Email Opened" workflow (Actions still create-lead) fired on the same click and created Lead 00QdL00000iYLK2UAO; the second matched it fuzzily (95%). Fixed by disabling other workflows + distinct names.

| # | Actions | Execution | Result | Salesforce |
|---|---|---|---|---|
| K1 | create-contact, create-note, new `rudra+sf-k1` | 6ac5d0e9395e2d1fbece09e8 | PASS: 3 email-only, 5 false → 6 Create → 93 Note | Contact 003dL00002dW8e5QAC: FirstName/LastName/Email/Phone/MobilePhone/Title/Department all PASS; Note Click Count 1 |
| K2 | same, 2nd click | 6ac5d0f7395e2d1fbece0b0b | PASS (A1): 4 `result.contact_id`, 5 true → 7 Update → 41 Note | no duplicate; Note Click Count 2 |
| K3 | update-contact + create-lead + create-note (contact exists) | 6ac5d3cc6cadcd097bd02f99 | PASS: 56 true → 121 mapping → 57 Update → 101 Note; 106 true → lead branch stops | Title "QA Lead K3", Phone/MobilePhone 9999971003; no Lead |
| K4 | create-lead + create-note, new `rudra+sf-k4` | 6ac5d5116cadcd097bd09500 | PASS: 106 false → 13 false → 15 Create → 95 Note | Lead 00QdL00000iYQBdUAO: FirstName/LastName/Email/Company/Phone/Title/City/State/Country all PASS (Lead mapping) |
| K5 | create-lead + update-lead + create-note (lead exists) | 6ac5d57fc3cdec259304a44a | PASS (A1): 13 true → 16 Update → 94 Note; 67 true → 68 Update → 102 Note | Title "Ops Director K5", City Surat, Phone 9999974005; no duplicate |
| K6 | create-opportunity + create-account + create-note (Closing 7, Prospecting), new `rudra+sf-k6` | 6ac5d6fb27142f792c436032 | PASS (A1): 26 due_date 2026-10-14 → 21 false → 22 Contact → 131 mapping → 25 Opp → 97 Note; 91 name → 29 → 31 false → 119 mapping → 33 Account → 99 Note | Contact 003dL00002dWCucQAG (Phone/Mobile/Title); Opp 006dL00000T9pNZQAZ Prospecting, CloseDate 2026-10-14, Amount 2500 (Opp mapping), ContactId; Account 001dL00002ZKN9qQAH "Divya Oppsingh" Phone/Website (Account mapping). 2nd click → 2nd Opp (accepted: new opp per click) |
| K7 | update-opportunity + update-account + attach-activity [Contact, Opportunity] + create-note (Closing upd 14, Qualification) | 6ac5d78e395e2d1fbed2adc5 | PASS: 77 due 2026-10-21 (A6) → 78 `opportunity_id` (A5) → 79 true → 127 mapping → 81 Update → 103 Note; 45 true → 125 → 46 Update Account → 100 Note; 108 2 queries → loop 112 | Opp 006dL00000T9pNZQAZ Qualification, 2026-10-21, Amount 3700; Account Phone/Website updated; **Tasks (A12)** 00TdL00000FaNblUAF WhoId contact + 00TdL00000FaNdNUAV WhatId opp, Subtype Email, Description incl. Click Count + Link Clicked + body text with apostrophe |
| K8 | create-contact + create-account + attach-activity + create-note, Select Object `[]`, "Liam O'Connor" `rudra+sf-k8` | 6ac5d80127142f792c43c11f | PASS: 91 `soql_name` → 29 `Name='Liam O\'Connor'` no MALFORMED_QUERY (A3); 108 `[]` → loop 0 iterations, no crash (A7); 0 errored nodes | Contact 003dL00002dVPWHQA4 "Liam O'Connor"; Account 001dL00002ZLATpQAP Phone/Website (mapping); no Task |

Observations (not bugs, same as signed-off siblings): create-opportunity makes a new Opp per click; update-opportunity updates SOQL `record[0]` when several Opps share the name; Notes are one run-on line; Contact↔Lead duplicate rules ("Allow" + "Alert", `allowSave:true`) block API saves across objects — CRM-CONFIG (untick Alert) or connector header `Sforce-Duplicate-Rule-Header: allowSave=true` (PLATFORM).
Mapped fields verified in Salesforce: Contact {FirstName, LastName, Email, MobilePhone, Title, Department} + top-level Phone; Lead {FirstName, LastName, Email, Phone, Title, City, State, Country} + Company; Account {Phone, Website}; Opportunity {Amount}.

## SIGN-OFF — v2 (`v2-fix-all.json`) is the final version (2026-10-07)
All branches pass live on v2 (K1–K8): create/update contact, create/update lead (+ lead skipped when contact exists), create/update opportunity ("while creating"/"while updating"), create/update account (incl. apostrophe), create-note, attach-activity (Contact + Opportunity Tasks with Link Clicked), empty Select Object.
Test-state left for the user to restore: other Salesforce workflows disabled by the user; my test sequence 196017 open tracking off; this workflow's Actions/Select Object/closing/stage config set to test values.

## v3 — `v3-opp-latest.json` (user request 2026-10-07: update-opportunity must update the LATEST same-named Opportunity)
Patch: `../../patches-shared/opp_latest.py` (self-checking, shared by all 5 SH→SF workflows). From `v2-fix-all.json`; 2 field changes, nothing else changed (nodes/edges/config identical).
- node 76 `q` + ` ORDER BY CreatedDate DESC LIMIT 1` → node 78 `record[0]` is now the newest Opportunity (update-opportunity + its Note).
- node 108 attach-activity Opportunity query + same suffix → Task WhatId goes on the newest Opportunity.
Proof (read-only SOQL, 2026-10-07): Name='rudra+sf-k6@…' without ORDER BY returned the older 006dL00000T9pNZQAZ first; with it, the newer 006dL00000T9pQnQAJ. Catalog audit unchanged; code node run offline (escaping intact). Not live-retested (same query proven by the read-only SOQL).

## v4 — `v4-no-static-phone.json` (patch `../../patches-shared/phone_fix.py`, user rule 2026-10-12: nothing fixed except required/lookup fields, as HubSpot)
From `v3-opp-latest.json`. Contact/Lead/Account create+update: `Phone` `{{event.body.prospect.phoneNumber}}` → `""` (not sent; Salesforce Phone untouched unless mapped, mapping still wins via additional_fields). Kept: LastName, Lead Company, Account Name, Opportunity Name/Stage/CloseDate, Email, FirstName.
Self-check: only `Phone` on those nodes changed; graph/config identical. Catalog re-scan: no new finding. Not live-tested.

### v4 live (2026-10-12)
| K6a create-lead + note (1st click) | 6acc9f29059402d7f6b187e8 | **PASS**: 15 Create Lead: Company (required) + Phone/Title from Lead Properties, no fixed Phone; Note 95 on the Lead |
| K6b same (2nd click) | 6acc9f35f65ff4bccd00bd7e | **PASS**: 13 found the same Lead → 16 Update (no duplicate), mapping fields; Note 94 |
