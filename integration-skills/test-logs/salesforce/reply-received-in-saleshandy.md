# Salesforce: "Reply is Received in Saleshandy" test log

- CRM: Salesforce (Developer org) · Env: staging · Refold export_id `681368981acc0cbcd16295bc` (workflow_id `65f3ee56dc17494c670f7f60`)
- v1 = `v1-original.json` (91 nodes, 89 edges, 58 config_fields), extracted verbatim from the session transcript.
- Trigger: Saleshandy "Reply Received" event (custom trigger `6464679ac7f3ab6e2bf5a62c`). Fires when a prospect replies (the user replies by hand).
- Test sequence `195940` (hash `bZwpb2KBaQ`), step `AYzMoqmvPk`, sender `rudra@saleshandy.com` (369550). Per-workflow env: `~/.config/sh-integration-testing/wf-salesforce-reply-received.env`.
- Prospect for reply #1: `rudra+hjkmnbg@saleshandy.com` (Rudra ReplyTest, phone 9999950001, company ReplyCo, title QA Reply), contact 66487960, email sent 2026-10-06 06:39:25 UTC (task 98647338).

## v1 → audit (static, same shape as Email Sent v1; ids differ)
| # | Nodes | Finding | Sibling bug |
|---|---|---|---|
| A1 | readers of transforms 4,12,20,26,30,44,55,66,77,78,91,92,105: 5,7,13,16,21,23,24,25,29,30,31,32,33,41,43,44,45,46,56,57,67,68,79,81,94,98,100–103,106 | `node.X.body.<key>`; transform output is `{"result":{…}}` → exists rules always false, update-* dead, Account Name '' | B3 |
| A2 | 6,7,15,16,22,23,32,33,46,57,68 | `prospect.phone`; payload key is `phoneNumber` | B1 |
| A3 | 3,19,54,104,29,43,76, code 109 | SOQL built from raw values (apostrophe → MALFORMED_QUERY); contact match also by First+Last name | S8 |
| A4 | 75 | rule compares `"update -opportunity"` (space) → update-opportunity branch never runs | NEW |
| A5 | 78 | `record[{Email:…}]` on Opportunity (no Email field) | S5 (v3) |
| A6 | 77, 81 | update-opportunity uses "(while creating)" stage/date; node 81 `id` = `node.78.body.contact_id` | S6/S7 |
| A7 | 109 | `object.forEach` with no guard → crash when Select Object empty | S13 |
| A8 | 107 | Task body uses `{{node.112.body.array_item.idType}}` / `{{node.110.body.records.0.Id}}` (not the broken `response:` syntax of Email Sent); composite allOrNone=false hides sub-request errors | S1: verify live |
| A12 | 107 (+113) | Task composite body built by string templating: reply HTML / email text / sequence name are not JSON-escaped → invalid JSON → no Task | NEW (confirmed R11) |
| A9 | 130, 131 | Opportunity mapping functions read `node.116.body.payload` (on path, OK) | none |

- **A10** nodes 6,7,22,23,57: `Title` = `{{firstName}} {{lastName}}` → contact job title set to the person's name when Title is not mapped.
- **A11** Note nodes 41,93–103: body copied from Email Sent; no `receivedReplyMessage` / `replyReceiveAt`, so the Note does not say what the prospect replied.

Notes bodies contain a display link `https://my.saleshandy.com/sequence/...`, which is text and not an API call (same as Email Sent, accepted).

## Scenario matrix (one reply = one run; Actions set before each reply)
| ID | Actions | SF setup | Expected |
|---|---|---|---|
| R1 | create-contact, create-note | none | Contact + Note |
| R2 | create-contact, create-note | contact exists | Update + Note (A1) |
| R3 | update-contact / create-lead / update-lead / create-account / update-account | per branch | A1 |
| R4 | create-opportunity / update-opportunity | per branch | A4, A5, A6 |
| R5 | attach-activity (Contact, Lead, Opportunity) | records exist | 3 linked Tasks with reply message (A8) |
| R6 | attach-activity, Select Object empty | none | A7 |

## v1 → live pass
| # | Actions | Reply time | Execution | Result |
|---|---|---|---|---|
| R1 | create-contact, create-note | 06:57:11 + 06:57:18 ("hey", from alias) | none | BLOCKED: no Refold run (see below) |
| R1 | create-contact, create-note | 07:32:24 | 6ac4a40e97137ce0f6dcde6d | PASS: 3 found nothing → 5 false → 6 Create Contact 003dL00002dOGTzQAO (FirstName/LastName/Email, MobilePhone 9999950001 + Title "QA Reply" from mapping) → 93 Note 002dL00000rqCZdQAM. **Phone null (A2 confirmed)**. Note body has no reply text / reply time (**A11**). Node 6 top-level `Title` = "Rudra ReplyTest" (full name), hidden only because the mapping overrides it (**A10**). |
| R2 | create-contact, create-note | 07:34:31 | 6ac4a48b49c1bb5b18683d3c | FAIL **A1/B3 confirmed**: 3 found 003dL00002dOGTzQAO, 4 → `{"result":{"contact_id":"003dL00002dOGTzQAO"}}`, 5 reads `node.4.body.contact_id` → false → 6 Create Contact → `DUPLICATES_DETECTED` (Standard_Contact_Duplicate_Rule). No update, no Note; contact unchanged (LastModified 07:32:33). |
| R3 | update-contact, create-note | 07:36:06 | 6ac4a4ecce1b140a15ac23c0 | FAIL silent **A1/B3**: 54 found contact, 55 → `{"result":{"contact_id":…}}`, 56 false → branch ends, run COMPLETED. Contact not updated (LastModified still 07:32:33), no Note. |
| R4 | create-lead, create-note | 07:37:38 | 6ac4a5479d9d99cfad54ef03 | FAIL **A1/B3**: 104 found contact, 105 `{"result":{"contact_id":…}}`, 106 false → lead path ran although a contact exists (by design it must stop) → 11 no lead → 13 false → 15 Create Lead → `DUPLICATES_DETECTED` (Standard_Lead_Duplicate_Rule matched the Contact). No Lead. |
| R5 | create-lead, create-note (test contact deleted first) | 07:39:33 | 6ac4a5bb9d9d99cfad54f73d | PASS: 106 false → 11 none → 13 false → 15 Create Lead 00QdL00000iUz9ZUAS (Company ReplyCo, Phone 9999950001 + Title QA Reply via mapping) → 95 Note 002dL00000rqDHBQA2. Top-level Phone again empty (A2), mapping filled it. |
| R6 | update-lead, create-note | 07:59:00 | 6ac4aa4772aaa8e91d313196 | FAIL silent **A1/B3**: 65 found lead, 66 `{"result":{"lead_id":"00QdL00000iUz9ZUAS"}}`, 67 false → branch ends, COMPLETED. Lead not updated (LastModified 07:39:42), no Note. |
| R7a | create-opportunity, create-note (Closing 7, Stage Prospecting) | 08:07:20 | 6ac4ac3c9d9d99cfad573f3f | SETUP GAP (not a bug): 26 due_date 2026-10-13 OK (note `{"result":…}` again), 22 Create Contact → DUPLICATES_DETECTED: Standard_Contact_Duplicate_Rule matched the R5 test Lead (same email). Lead deleted, rerun as R7. |
| R7 | create-opportunity, create-note (Closing 7, Stage Prospecting) | 08:09:55 | 6ac4acd672aaa8e91d324a90 | FAIL **A1/B3**: 21 false → 22 Create Contact 003dL00002dPK5hQAG OK → 25 Create Opportunity CloseDate missing (reads `node.26.body.due_date`, value is under `result`) → `REQUIRED_FIELD_MISSING [CloseDate]`. No Opportunity, no Note. |
| R8 | update-opportunity (+R10, R11 same reply) | 08:14:00 | 6ac4adcc72aaa8e91d32b1eb | FAIL **A4 confirmed**: rule 75 compares `"update -opportunity"` → false although Actions contains `update-opportunity`; branch never runs (opp 006dL00000T7oAfQAJ created by API, untouched). A5/A6 unobservable live (branch dead); fixed per Email Sent v3 evidence. |
| R10 | update-account (account "Rudra ReplyTest" 001dL00002ZDPjNQAX created by API) | 08:14:00 | 6ac4adcc72aaa8e91d32b1eb | FAIL silent **A1/B3**: 92 `{"result":{"name":"Rudra ReplyTest"}}`, 43 `Name=''` → none → 45 false. Account untouched (LastModified 08:11:15). |
| R11 | attach-activity, Select Object [Contact, Opportunity] (both exist) | 08:14:00 | 6ac4adcc72aaa8e91d32b1eb | FAIL silent **A12 (new)**: 109 built both queries, loop 112 ran, run COMPLETED, but **0 Tasks** created after 08:13 (not even unlinked). Node 107 inserts `{{event.body.receivedReplyMessage}}` (reply HTML with `"`) and `{{node.113.body.text}}` (newlines) raw into the composite JSON → invalid JSON. Offline reproduction: real values → `Invalid control character`; same body with plain "hey" → valid. |
| R12 | attach-activity, Select Object empty | — | not run | Node 109 code identical to Email Sent node 99 (S13 crash confirmed live there): `object.forEach` on undefined. Fixed in v2, verified in v2 retest. |
| R9 | create-account (UI save at 07:26 overwrote Actions to `["create-account"]`) | 07:29:31 | 6ac4a3600ae49e484b4a6e80 | FAIL **A1/B3**: 91 → `{"result":{"name":"Rudra ReplyTest"}}`, 29 queried `Name=''` (reads `node.91.body.name`), 30 `{}`, 31 false → 33 Create Account with empty body → `JSON_PARSER_ERROR: The HTTP entity body is required` (Name '' and Phone '' dropped). No Account created. |

### R1 blocker: Reply Received event never reaches Refold (2026-10-06, Loki pyxis)
- email-reply-tracker detected both replies (task 98647339, `currentStepRepliedAt` 06:57:18) and logged `sendIntegrationEvent event.reply-received userId80121 shAccountId.52649 sequenceProspectTaskId.98647339 clientUserId.null`.
- Webhook path OK: edge consumed `pyxis-webhook-events` `{"event":"reply-received","prospectId":66487960,"sequenceProspectTaskId":98647339,"userId":80121,"actionTime":"2026-10-06T06:57:11.000Z","emailId":55224882,"note":"<reply html>"}` (+ 06:57:18 / emailId 55224883) and delivered it to the account's webhooks.
- Integration path missing: no `native-integration` Kafka message, no `DIAG-AL4012 processEvent` / `sendEventToCobalt` for 80121 after 06:56. Control: the 06:54 send produced `native-integration sequence-email-sent` → processEvent → sendEventToCobalt "Webhook Fired Success".
- Gate: `src/common/services/cobalt/integration-event-sending.service.ts:96-136` (same logic in reply tracker) publishes only if `user_event_subscription` has (userId 80121 or an ALL_USERS admin, eventId 3 = ReplyReceived). Row is written by `POST /integration/event-subscribe` (`integration.service.ts:77`), which webui sends when the workflow toggle is switched on (`triggers-and-activity.tsx:281`).
- Classification: setup gap (workflow not enabled / not subscribed for 80121), not a workflow JSON bug, unless the toggle is already on.

- **Root cause confirmed (code + logs):** reply tracker (`saleshandy-email-reply-tracker@staging 3f07fee0`, `src/reply-tracking/integration-event-sending.service.ts:94-136`) publishes to `native-integration` only when `user_event_subscription(userId 80121 | ALL_USERS admin | client, eventId 3)` exists. Last 24 h: 3 `sendIntegrationEvent event.reply-received` checks, 0 `integrationEventSent`. Edge subscription log for 80121: 2026-10-05 09:52:01 every event (incl. `reply-received`) → false (all toggles off / disconnect); 2026-10-06 03:21:29 only `sequence-email-sent` → true; 06:08:50 `undefined` → true. Reply Received was never switched back on. Webui maps the name correctly (`helper.ts:18`). Tag: setup gap, no code bug. Fix: switch on "Reply is Received in Saleshandy" in Settings → Integrations → Salesforce and save.
- **Refold vs Saleshandy mismatch (user check 07:20):** Refold config `GET .../config` shows "Reply is Received in Saleshandy" `enabled: true` (user PATCHed `{"enabled":true}`), but edge got no `event-subscribe` call after 07:00 → `user_event_subscription` still missing. Two independent switches: Refold `enabled` (does the workflow run when an event arrives) vs Saleshandy `user_event_subscription` (does Saleshandy send the event at all).
- **[WEBUI] candidate bug B0 — subscriptions lost after Salesforce disconnect/reconnect:** 2026-10-05 09:52:01 all events → false came from the disconnect handler (`saleshandy-webui` `integrations.tsx:340-362` `handleDisconnect`, also `configuration-content.tsx:466-486` `onDisconnect`), which unsubscribes every CobaltEvent. On reconnect nothing re-subscribes; Refold keeps `enabled: true`, so the UI shows the workflow ON while Saleshandy silently drops its events. The subscribe call is only sent from the extra-config modal submit (`trigger-option.tsx:236-238`) with events whose switch changed in that session (`triggers-and-activity.tsx:281-305`), so an already-ON toggle never re-subscribes. Expected: reconnect (or loading the config screen) re-subscribes every workflow that is `enabled` in Refold. Report only, no code change without approval.
- **Unblocked 07:26:58:** user re-saved the workflow in the UI → edge `updateCobaltSubscription.reply-received.to.true`. First Reply Received run 07:29:36. Note: saving the config popup also rewrites `Actions`; re-set by API before every reply.

## Bugs (v1, full pass)
- **[JSON] A1/B3 every transform reader** (R2, R3, R4, R6, R7, R9, R10): transform output is `{"result":{…}}`, readers use `node.X.body.<key>` → exists-rules always false (duplicates / silent no-ops / lead path despite contact), Account Name '' (empty create body), CloseDate empty.
- **[JSON] A2 Phone** (R1, R5): `prospect.phone` → empty; payload key is `phoneNumber`.
- **[JSON] A4 update-opportunity never runs** (R8): rule 75 `"update -opportunity"`.
- **[JSON] A12 attach-activity creates no Task** (R11): node 107 composite JSON built from raw reply HTML / email text.
- **[JSON] A3, A5, A6, A7** fixed by the Email Sent evidence (same code, confirmed live there): apostrophes in SOQL, opportunity lookup by Email, "(while updating)" fields + node 81 id, empty Select Object crash.
- **[SETUP] R1 blocker**: `user_event_subscription` for reply-received missing after the 2026-10-05 disconnect; fixed by the user re-saving the toggle 07:26:58.
- **[WEBUI] B0** subscriptions not restored after disconnect/reconnect while Refold still shows workflows enabled (report only).
- **[CRM-CONFIG] R7a**: Standard Contact/Lead duplicate rules match across Contact↔Lead with the same email (setup gap, not changed).
- Kept as is (user 2026-10-06): A10 Title = full name, A11 Note without reply text.

## v2 — `v2-fix-all.json` (patch: `patches/v2_fix_all.py`, change list: `patches/v2-changes.json`)
77 field changes in 46 nodes; nodes (91) / edges (89) / config_fields / export_id / trigger byte-identical; no structural change.
- A1: all readers of transforms 4,12,20,26,30,44,55,66,77,78,91,92,105 → `.body.result.<key>` (5,7,13,16,21,23,24,25,29–33,41,43–46,56,57,67,68,79,81,94,98,100–103,106).
- A2: `prospect.phone` → `prospect.phoneNumber` (6,7,15,16,22,23,32,33,46,57,68).
- A3: contact lookups 3,19,54,104 email-only; 91/92 return `soql_name` (escaped) used by 29/43; node 109 escapes `'` and `\`.
- A4: node 75 compare_value → `update-opportunity`.
- A5: node 78 → `record[0].Id`. A6: node 77 "Closing date (while updating)" (query + node_rule), node 81 StageName "(While updating)", id → `node.78.body.result.opportunity_id`.
- A7: node 109 `(object || []).forEach`.
- A12: node 113 gets inputs `reply` + `sequenceName`, returns JSON-escaped `text_json`, `reply_json` (reply HTML → plain text), `sequence_name_json`; node 107 uses them instead of raw values.
Verification: patch self-checks pass; nodes 109/113 code executed offline (node 20 + cheerio) with quotes/newlines/backslashes/apostrophes → 107 body parses, empty Select Object → `[]`.
### Retest plan (after import, one reply each)
R1 create-contact (new) · R2 create-contact (existing → update + Note) · R3 update-contact · R4 create-lead with contact (skipped) · R5 create-lead (new) · R6 update-lead · R7 create-opportunity (CloseDate +7) · R8 update-opportunity (stage/date "while updating") · R9 create-account · R10 update-account · R11 attach-activity Contact+Opportunity (2 linked Tasks with reply text) · R12 attach-activity empty Select Object.

## v2 live retest (2026-10-06, after user import)
| # | Actions | Execution | Result | Salesforce after |
|---|---|---|---|---|
| V2-R1 | create-contact, create-note (nothing in SF) | 6ac4b21449c1bb5b186d1693 | PASS: node 3 email-only (v2 live), 5 false → 6 Create with **Phone 9999950001 (A2 fixed)** → 93 Note | Contact 003dL00002dOjhiQAC Phone+MobilePhone, Title QA Reply; Note 002dL00000rqJrGQAU |
| V2-R2 | create-contact, create-note (contact exists) | 6ac4b31f0ae49e484b50511e | PASS (A1 fixed): 4 `result.contact_id` → 5 **true** → 7 Update Contact (id 003dL00002dOjhiQAC) → 41 Note | Contact LastModified 08:36:49, 2nd Note 002dL00000rqHhiQAE; no duplicate |
| V2-R3+R4 | update-contact, create-lead, create-note (contact exists) | 6ac4b361ce1b140a15b15804 | PASS: 56 true → 57 Update → 101 Note; 106 **true** → lead branch stops (by design, A1 fixed) | Contact LastModified 08:37:56, 3rd Note; no Lead |
| V2-R5 | create-lead, create-note (no contact) | 6ac4b3a2696251a234c2705e | PASS: 106 false → 13 false → 15 Create Lead with Phone (A2) → 95 Note | Lead 00QdL00000iVjvZUAS ReplyCo, Phone 9999950001, Title QA Reply; Note 002dL00000rqP8fQAE |
| V2-R6 | update-lead, create-note | 6ac4b88a97137ce0f6e53ce1 | PASS (A1 fixed): 66 `result.lead_id` → 67 **true** → 68 Update Lead → 102 Note. (2:09 PM email replies were sent From rudra@ → ignored by SH; resent 08:57:52) | Lead LastModified 08:59:56, 2nd Note 002dL00000rqQSvQAM |
| V2-R7 | create-opportunity, create-note (Closing 7, Prospecting) | 6ac4b9630ae49e484b5354d5 | PASS (A1 fixed): 26 due 2026-10-13 → 21 false → 22 Create Contact (Phone) → 25 Create Opp **CloseDate 2026-10-13**, ContactId → 97 Note | Contact 003dL00002dPXMHQA4, Opp 006dL00000T7sz3QAB Prospecting/2026-10-13 + Note |
| V2-R8+R9 | update-opportunity, create-account, create-note | 6ac4ba3997137ce0f6e6ab96 | PASS: **75 true (A4 fixed)** → 78 `result.opportunity_id` 006dL00000T7sz3QAB (A5) → 79 true → 81 Update id ok, **StageName Qualification, CloseDate 2026-10-20 = +14 "while updating" (A6)** → 103 Note. 91 name+soql_name → 29 `Name='Rudra ReplyTest'` → 31 false → 33 Create Account (Name, Phone) → 99 Note | Opp Qualification/2026-10-20; Account 001dL00002ZDi9KQAT Phone 9999950001 + Note. Noise: Email Sent workflow (sibling, other terminal config) also fired on the 09:04:44 send and added a "sequence-email-sent" Note to the opp; it does not affect this result (node 81 input proves the values sent). |
| V2-R10 | update-account (+R11 same reply) | 6ac4bac3696251a234c5f229 | PASS (A1/A3): 43 `Name='Rudra ReplyTest'` → 44 `result.account_id` → 45 true → 46 Update Account → 100 Note | Account LastModified 09:09:25, 2nd Note |
| V2-R11 | attach-activity, Select Object [Contact, Opportunity] | 6ac4bac3696251a234c5f229 | **FAIL (v2 fix for A12 did not work)**: 109 email-only queries OK, loop 112 `group node failed: 2 batch(es) errored`, 0 Tasks. Loop children are not in the node log; v2 pasted JSON-escaped strings into the template body, which the platform rejects for both batches. | no Task |

## v3 — `v3-task-object.json` (patch: `patches/v3_task_object.py`) — import this, skip v2
Only nodes 113 and 107 differ from v2 (input_data only). Copies the pattern proven live in Email Sent (node 123 builds the Task object, node 102 sends `"body": "{{node.123.body}}"`):
- 113: inputs data, reply, idType, objectId, replyReceiveAt, sequence, prospectEmail, userEmail; builds `{Subject, ActivityDate, Status, TaskSubtype, Description, [WhoId|WhatId]}` (email body + reply converted HTML → text; Description text and order same as v1).
- 107: body = `{"allOrNone": false, "compositeRequest": [{"method": "POST", "url": "/services/data/v37.0/sobjects/Task", "referenceId": "task1", "body": "{{node.113.body}}"}]}` (identical to Email Sent node 102).
Verification: self-check (only 107/113 input_data changed); node 113 executed offline with quotes/newlines; same Task object POSTed to SF composite → 201 (probe Task 00TdL00000FXFJ0UAP deleted).
Retest after import: R11 (attach-activity Contact+Opportunity → 2 linked Tasks) and R12 (empty Select Object). All other scenarios already PASS on v2 and their nodes are unchanged in v3.

## v3 live retest (only the failed scenarios)
| # | Actions | Execution | Result | Salesforce after |
|---|---|---|---|---|
| V3-R11 | attach-activity, Select Object [Contact, Opportunity] | 6ac4bd7472aaa8e91d3aaf58 | **PASS (A12 fixed)**: 109 email-only queries, loop 112 Success | 2 Tasks: 00TdL00000FX8mDUAT WhoId contact 003dL00002dPXMHQA4, 00TdL00000FYm4nUAD WhatId opp 006dL00000T7sz3QAB; ActivityDate 2026-10-06; Description has reply text as plain text. Observation: "Email body:" empty (`event.body.sequence.emailBody` not in the reply event; same template as v1, not a regression). |
| V3-R12 | attach-activity, Select Object `[]` | 6ac4bdc30ae49e484b55f337 | PASS (A7 fixed): 109 `[]`, loop 112 fanout `[]`, run COMPLETED, no crash | no Task |

## SIGN-OFF — v3 (`v3-task-object.json`) is the final version (2026-10-06)
All 12 scenarios pass live: R1–R10 on v2 (nodes unchanged in v3), R11–R12 on v3.
create/update contact, create/update lead (+ lead skipped when contact exists), create/update opportunity ("while creating"/"while updating" settings), create/update account, create-note, attach-activity (Contact + Opportunity linked Tasks with reply text), empty Select Object.
Accepted / by design (user decisions): Title = full name unless mapped (A10); Notes without reply text (A11); new opportunity per reply; account named after the person; missing LastName/Company fail; parallel create race; Salesforce duplicate rules match Contact↔Lead with the same email (CRM-CONFIG).
Open outside this JSON: [WEBUI] B0 subscriptions not restored after Salesforce disconnect/reconnect. Observation: Task "Email body:" empty because the reply event has no `sequence.emailBody`.

## v3 catalog sweep (2026-10-06, `patches/audit_v3.py`, read-only)
Mechanical checks (#1, #7, #17, #22/#52, #38 refs/keys/config/create-vs-update fields, #43, #47, #48, #50, #51, rule wiring, duplicates, unreachable nodes, connector actions): **v3 0 findings**; same script on v1 → 67 findings (45× #47, 11× #48, 10× #50, 1× #51), so the checks are live.
Manual items: #9/#10 contact match by email only (approved); #15 every update node carries the mapping (`additional_fields`); #40 parallel create race and #45 naming accepted; #42 opportunity not linked to an Account (AccountId "") = original design, unchanged; #53 `record[{Email:…}]` harmless (SOQL already filters).

## v4 — `v4-opp-latest.json` (user request 2026-10-07: update-opportunity must update the LATEST same-named Opportunity)
Patch: `../../patches-shared/opp_latest.py` (self-checking, shared by all 5 SH→SF workflows). From `v3-task-object.json`; 2 field changes, nothing else changed (nodes/edges/config identical).
- node 76 `q` + ` ORDER BY CreatedDate DESC LIMIT 1` → node 78 `record[0]` is now the newest Opportunity (update-opportunity + its Note).
- node 109 attach-activity Opportunity query + same suffix → Task WhatId goes on the newest Opportunity.
Proof (read-only SOQL, 2026-10-07): Name='rudra+sf-k6@…' without ORDER BY returned the older 006dL00000T9pNZQAZ first; with it, the newer 006dL00000T9pQnQAJ. Catalog audit unchanged; code node run offline (escaping intact). Not live-retested (same query proven by the read-only SOQL).

## v5 — `v5-no-static-title.json` (patch: `../../patches-shared/static_values.py`, user decision 2026-10-12)
From `v4-opp-latest.json`. User rule: as few fixed values as possible — an unmapped field stays untouched, a mapped field comes from the mapping everywhere; Notes only when "Create Note" is selected, on the record the branch created/updated.
- Changed: nodes 6, 7, 22, 23, 57 → Title "" (was "First Last").
- Why `""` is safe: the connector does not send empty strings (Email Sent S3), so Title / Opportunity Name stay as they are in Salesforce unless mapped; a mapping still wins through `additional_fields` (Email Sent V3-S6/S7).
- Self-check: only these fields changed; nodes/edges/other config identical. Catalog re-scan: no new findings.
- Not live-tested yet.

### v5 live test plan (2026-10-12, user go-ahead; replies sent by hand by the user)
Live definition == v5 nodes.
| # | Mapping | Actions | Setup | Expected |
|---|---|---|---|---|
| R1 | mapped | create-contact, create-note | Contact exists, Title "Old R1"; Job Title "Mapped R1" | Title = "Mapped R1", Note |
| R2 | **unmapped** | create-contact, create-note | Contact exists, Title "Keep R2" | **Title stays "Keep R2"** |

## v6 — `v6-no-static-phone.json` (patch `../../patches-shared/phone_fix.py`, user rule 2026-10-12: nothing fixed except required/lookup fields, as HubSpot)
From `v5-no-static-title.json`. Contact/Lead/Account create+update: `Phone` `{{event.body.prospect.phoneNumber}}` → `""` (not sent; Salesforce Phone untouched unless mapped, mapping still wins via additional_fields). Kept: LastName, Lead Company, Account Name, Opportunity Name/Stage/CloseDate, Email, FirstName.
Self-check: only `Phone` on those nodes changed; graph/config identical. Catalog re-scan: no new finding. Not live-tested.

### v6 live (2026-10-12)
R6 (rudra+sf-r6x, email sent 08:47 UTC, user replied): **no run** — Saleshandy shows `currentStepRepliedAt: null` for r6x and for r5t1 (earlier reply) → the reply was not detected by Saleshandy (reply tracker / sender address), not a workflow issue. Pending.
