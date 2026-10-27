# Email Sent from Saleshandy (Saleshandy → Zoho)

- v1 = `v1-original.json` (39 nodes, 38 edges, 106 config_fields), byte-identical to `zoho old workflows/64a66eb3dab129c8f122fab1.json`.
- Env folder: staging (to be confirmed).

## v1 → audit (offline, 2026-10-12)
Full write-up: `.lavish/zoho-workflows-v2-fixes.html`. Fix ids F1–F12 are defined in `../../patches-shared/v2_static_fixes.py`.

## v2 — `v2-static-fixes.json` (patch `../../patches-shared/v2_static_fixes.py`, change list `v2-changes.json`)
No node/edge added, removed or rewired.
- F2 node 4 "Contact - rule" `compare_value_of (values tested)`: ["create- contact"] → ["create- contact", "create-contact"]
- F1 node 5 "Lead - rule" `compare_value_of[1].data_slot_id`: "{{workflow.fields.Select Pipedrive Action1}}" → "{{workflow.fields.Select Pipedrive Action2}}"
- F6 node 10 "create/update contact" `Phone`: "{{event.body.prospect.phone}}" → ""
- F6 node 11 "create/update lead" `Phone`: "{{event.body.prospect.phone}}" → ""
- F3 node 12 "create deal w/o layout" `Closing_Date`: "{{node.39.body.due_date}}" → "{{node.39.body.result.due_date}}"
- F3 node 14 "Create task for existing contact" `additional_fields`: "{\"Due_Date\": \"{{node.38.body.due_date}}\",\"Priority\": \"{{workflow.fields.Priority}}\",\"Who_Id\":{ \"id\": \" {{node.32.body.data.0.i → "{\"Due_Date\": \"{{node.38.body.result.due_date}}\",\"Priority\": \"{{workflow.fields.Priority}}\",\"Who_Id\":{ \"id\": \" {{node.32.body.d
- F5 node 14 "Create task for existing contact" `additional_fields`: "{\"Due_Date\": \"{{node.38.body.result.due_date}}\",\"Priority\": \"{{workflow.fields.Priority}}\",\"Who_Id\":{ \"id\": \" {{node.32.body.d → "{\"Due_Date\": \"{{node.38.body.result.due_date}}\",\"Priority\": \"{{workflow.fields.Priority}}\",\"Who_Id\":{ \"id\": \"{{node.32.body.da
- F10 node 15 "Zoho Notes" `Note_Content`: "Email Sent on {{event.body.emailSentAt}}Sequence Name: {{event.body.sequence.sequenceName}}Sequence: https://my.saleshandy.com/sequence/{{e → "Email Sent on {{event.body.emailSentAt}}\nSequence Name: {{event.body.sequence.sequenceName}}\nSequence: https://my.saleshandy.com/sequence
- F3 node 17 "create deal w/o pipeline" `Closing_Date`: "{{node.39.body.due_date}}" → "{{node.39.body.result.due_date}}"
- F3 node 19 "zoho" `Closing_Date`: "{{node.39.body.due_date}}" → "{{node.39.body.result.due_date}}"
- F10 node 26 "Zoho Notes" `Note_Content`: "Sequence Name: {{event.body.sequence.sequenceName}}Sequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/stepsStep: {{eve → "Sequence Name: {{event.body.sequence.sequenceName}}\nSequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/steps\nStep: {
- F10 node 27 "Zoho Notes" `Note_Content`: "Sequence Name: {{event.body.sequence.sequenceName}}Sequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/stepsStep: {{eve → "Sequence Name: {{event.body.sequence.sequenceName}}\nSequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/steps\nStep: {
- F10 node 28 "Zoho Notes" `Note_Content`: "Sequence Name: {{event.body.sequence.sequenceName}}Sequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/stepsStep: {{eve → "Sequence Name: {{event.body.sequence.sequenceName}}\nSequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/steps\nStep: {
- F10 node 29 "Zoho Notes" `Note_Content`: "Sequence Name: {{event.body.sequence.sequenceName}}Sequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/stepsStep: {{eve → "Sequence Name: {{event.body.sequence.sequenceName}}\nSequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/steps\nStep: {
- F10 node 30 "Zoho Notes" `Note_Content`: "Sequence Name: {{event.body.sequence.sequenceName}}Sequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/stepsStep: {{eve → "Sequence Name: {{event.body.sequence.sequenceName}}\nSequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/steps\nStep: {
- F6 node 34 "create/update contact" `Phone`: "{{event.body.prospect.phone}}" → ""
- F3 node 35 "Create task for new contact" `additional_fields`: "{\"Due_Date\": \"{{node.38.body.due_date}}\",\"Priority\": \"{{workflow.fields.Priority}}\",\"Who_Id\":{ \"id\": \" {{node.34.body.data.0.d → "{\"Due_Date\": \"{{node.38.body.result.due_date}}\",\"Priority\": \"{{workflow.fields.Priority}}\",\"Who_Id\":{ \"id\": \" {{node.34.body.d
- F5 node 35 "Create task for new contact" `additional_fields`: "{\"Due_Date\": \"{{node.38.body.result.due_date}}\",\"Priority\": \"{{workflow.fields.Priority}}\",\"Who_Id\":{ \"id\": \" {{node.34.body.d → "{\"Due_Date\": \"{{node.38.body.result.due_date}}\",\"Priority\": \"{{workflow.fields.Priority}}\",\"Who_Id\":{ \"id\": \"{{node.34.body.da
- F10 node 36 "Zoho Notes" `Note_Content`: "Sequence Name: {{event.body.sequence.sequenceName}}Sequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/stepsStep: {{eve → "Sequence Name: {{event.body.sequence.sequenceName}}\nSequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/steps\nStep: {
- F10 node 37 "Zoho Notes" `Note_Content`: "Sequence Name: {{event.body.sequence.sequenceName}}Sequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/stepsStep: {{eve → "Sequence Name: {{event.body.sequence.sequenceName}}\nSequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/steps\nStep: {
- F4 node 39 "Copy - transform" `query`: "{\"due_date\": ($millis() + ({{workflow.fields.Due In}}* 24 * 60 * 60 * 1000) + (5.5 * 60 * 60 * 1000)) ~> $fromMillis('[Y0001]-[M01]-[D01] → "{\"due_date\": ($millis() + ({{workflow.fields.Deal Closing date}}* 24 * 60 * 60 * 1000) + (5.5 * 60 * 60 * 1000)) ~> $fromMillis('[Y0001]-
- F4 node 39 "Copy - transform" `query`: "{\"due_date\": ($millis() + ({{workflow.fields.Due In}}* 24 * 60 * 60 * 1000) + (5.5 * 60 * 60 * 1000)) ~> $fromMillis('[Y0001]-[M01]-[D01] → "{\"due_date\": ($millis() + ({{workflow.fields.Deal Closing date}}* 24 * 60 * 60 * 1000) + (5.5 * 60 * 60 * 1000)) ~> $fromMillis('[Y0001]-
- F4 node 39 "Copy - transform" `input`: "{\"due_in\":\"{{workflow.fields.Due In}}\"}" → "{\"due_in\":\"{{workflow.fields.Deal Closing date}}\"}"
- F4 node 39 "Copy - transform" `node_rule`: {"operator": "AND", "compare_value_of": [{"data_slot_id": "{{workflow.fields.Due In}}", "compare_value": "", "comparison_operator": "exist"} → {"operator": "AND", "compare_value_of": [{"data_slot_id": "{{workflow.fields.Deal Closing date}}", "compare_value": "", "comparison_operator
- F9 node 35 "Create task for new contact" `node_rule`: null → {"operator": "AND", "compare_value_of": [{"data_slot_id": "{{workflow.fields.Subject}}", "compare_value": "", "comparison_operator": "exist"

## Open (asked in chat, not in v2)
- Q1 deal not linked to contact (structural) · Q2 deal upsert resets Stage/Closing date each event · Q3 webui hides Select Layout for Deal → Pipeline/Stage never settable · Q4 webui `:Meeting Booked` key · Q5 env folder.

## Live checks still needed
- Deal `Account_Name` as plain string · Tag upsert keeps other tags · task with `Due_Date: ""` · email search with `+` · connector drops empty Phone · mapped field types (#46).
## Scenario matrix (v2 live pass, staging, Zoho org 941113438)
Trigger: send-now of the shared test step (`zoho-sent-run.sh`). Prospects `rudra+zoho-<sc>@saleshandy.com`, distinct names per row.
Verify: Refold node log + Zoho record read back by API + PASS/FAIL per field.

| # | Settings | Prospect / setup | Expected |
|---|---|---|---|
| E1 | Action1 `create-account` | new, Company "Zoho E1 Co" | Account upserted (name = company) + Note on Account, one label per line; the run log shows the 4 field mappings |
| E2 | Action1 `create- contact` | new, first/last/email/phone/job title | Contact created; mapped fields present; Phone from mapping only; Note on Contact |
| E3 | same as E2 | E2's contact after setting Phone in Zoho to a different number; re-send | upsert updates, no duplicate; **Zoho Phone not cleared** by `Phone: ""` |
| E4 | Action2 `create-lead` (slot 2, F1) | new, Company "Zoho E4 Co" | Lead created with Company (F7) + Note on Lead |
| E5 | Action1 `create-lead` | new, no company | Lead result recorded (Company dropped, not blank) |
| E6 | Action1 `create-deal`, Deal Closing date 10 | new, Company "Zoho E6 Co" | Deal created, Closing_Date = today+10 (F3/F4), Stage Qualification, Account_Name accepted; Note on Deal |
| E7 | same as E6 | E6 deal moved to another stage in Zoho; re-send | record what upsert does to Stage/Closing_Date (decision Q2) |
| E8 | Action1 `create-deal`, Deal Closing date "" | new | Deal created without closing date, no error |
| E9 | Action1 `create-task`, Subject, Status, Priority, Due In 3 | E2's existing contact | Task on that contact (Who_Id), Due_Date today+3, Note on Task |
| E10 | same as E9 | new prospect (no Zoho contact) | contact upserted, then task on it with due date |
| E11 | Action1 `create-task`, Subject "" | new | both task nodes skipped by node rule; no error |
| E12 | all 5 actions in slots 1-5 | new | every branch runs; record any race between contact upsert paths |

## v2 live pass
| # | Result | Evidence |
|---|---|---|
| E1 | PASS: Account "Zoho E1 Co" (7636887000000750001) inserted, 1 note, title right, 8 lines (F10 verified live). Other 4 rules false. | exec `6accabd4f65ff4bccd07949a`, runs/20261012T094333-E1-* |
| E1 | **OPEN, likely setup:** Mapping Function node 41 input has **no `fieldMapping`** (`{{application.fields.Account Fields}}` unresolved) → `additional_fields: {}`. Catalog #31 step 1: mapping not saved, or the app field has another name. Needs the Refold app config to tell. | same |
| setup | E1's empty mapping = **setup gap, not a bug**: all 4 Zoho mappings were `null` (config 80121). Mappings saved by API 2026-10-12 (`_shared/runs/*R3*`, read back `*R4*`): Contact {phoneNumber→Phone, jobTitle→Title, department→Department, city→Mailing_City, country→Mailing_Country (picklist), twitter→Twitter}; Lead {phoneNumber→Phone, jobTitle→Designation, industry→Industry (picklist), website→Website, city→City, companySize→No_of_Employees (integer probe), companyRevenue→Annual_Revenue (currency probe)}; Account {companyPhone→Phone, companyWebsite→Website, companyIndustry→Industry (picklist), companySize→Employees (integer probe), city→Billing_City}; Deal {dealValue→Amount (currency)}. | |
| E1b | **FAIL — BUG Z-1:** Account not created. Node 3 upsert_account 400 `INVALID_DATA` `Employees` expected integer; Mapping Function passed SH "Company Size" text `"11-50"`. One mistyped mapped value kills the whole record (no account, no note). Mapping itself resolved correctly (Billing_City/Industry/Phone/Website/Employees). | exec `6accad9cf65ff4bccd08a826`, runs/20261012T095124-E1b-* |
| E1c | PASS: Account 7636887000000751001 with Phone/Website/Industry("Software", picklist accepted)/Billing_City from mapping; note OK. | exec `6accaf3266b31963c1417599` |
| E1d | PASS: re-trigger → upsert `update` of the same Account 7636887000000751001 (Phone/City updated), 1 account only, 2nd note added. | exec `6accaf87f65ff4bccd092d07` |
| E2 | **FAIL — BUG Z-1 (2nd instance):** Contact not created. Node 10 upsert_contact 400 `INVALID_DATA` `Twitter` (Zoho Twitter = handle; SH Twitter holds a URL). F2 verified (Contact rule fired on webui value `create- contact`). Fixed `Phone: ""` is **dropped** by the Zoho connector (not in node 10 input) → cannot clear an existing phone. | exec `6accafd466b31963c141a259` |
| E2b | PASS: Contact 7636887000000757001 inserted with Phone/Title/Department/Mailing_City/Mailing_Country from mapping; note on contact. | exec `6accb02bf65ff4bccd0960d3` |
| E3 | PASS: pre-existing Zoho contact 7636887000000758001 (Phone +1 999 555 0003, Title) → upsert `update`; Phone and Title kept, Department set from mapping; 1 contact. Confirms the v2 Phone change cannot blank a phone. | exec `6accb07b059402d7f6b9979d` |
| E4 | PASS: Lead in **slot 2** ran (F1), Company "Zoho E4 Co" (F7), all 7 mapped fields stored; Zoho coerces numeric strings ("25"→25, "1000000"→1000000). Note on Lead OK. | exec `6accb0c64355a2070a47871e` |
| E5 | PASS: no company → `Company` omitted (template unresolved → dropped, not blank), Lead 7636887000000752003 created + note. | exec `6accb11b9d4785a0646e2951` |
| E6 | PASS: Deal 7636887000000761005 "ZohoE6 Deal", Stage Qualification, **Closing_Date 2026-10-22 = today+10 from "Deal Closing date"** (F3+F4 live), Amount 5000 (mapping). `Account_Name` plain string accepted → linked to Account "Zoho E6 Co" 7636887000000761003 (auto-created). **Contact_Name empty** (Q1 confirmed). Layout Exist? false → w/o-layout path. | exec `6accb16b059402d7f6b9e92c` |
| E7 | **BUG Z-2 (confirmed Q2):** Zoho stage set by hand to "Needs Analysis" + Closing 2026-12-31 → re-send → upsert matched by Deal_Name and **reset Stage to Qualification and Closing_Date to 2026-10-22**; Amount 7000 updated; still 1 deal. Every new event undoes CRM edits. | exec `6accb1d3d5af7efd0840f39f` |
| E8 | PASS: Deal Closing date empty → node 39 Skipped (node_rule), deal 7636887000000764005 created without Closing_Date, no error; note OK. | exec `6accb217142e9cb86007cbb6` |
| E9 | PASS: existing contact found (32→33 true) → Task 7636887000000754003 on contact 7636887000000757001 (Who_Id clean, F5), Due_Date 2026-10-15 = today+3 (F3), Subject/Status/Priority right; note on task. | exec `6accb26cd5af7efd08410df9` |
| E10 | **FAIL — BUG Z-3:** no Zoho contact → node 32 search returns `{"data":[],"type":"Buffer"}` (Zoho 204 wrapped as Buffer); rule 33 `{{node.32.body.data}} exist` is **true on []** → new-contact path (48→49→34→35) never runs; **orphan Task 7636887000000750007 with `Who_Id: {}`**, no contact created. Same rule in all 7 workflows. Fix: rule on `{{node.32.body.data.0.id}}`. | exec `6accb2bb142e9cb86007ead3` |
| E11 | Subject "" → node 14 Skipped (guard OK) but child **note 36 still runs → 400 MANDATORY_NOT_FOUND Parent_Id → run ERRORED. BUG Z-4** (catalog #57: a skipped node does not stop children). Same for 37 under 35, and every note under a skipped/failed create. Fix: node_rule on each note = its Parent_Id template exists. | exec `6accb31d23caf681f29ef0df` |
| E12 | All 5 at once: Contact/Lead/Account/Deal/Task + 5 notes created, run COMPLETED. **BUG Z-5:** 2 Accounts "Zoho E12 Co" (771001 from create-account, 769003 auto-created by Zoho from the deal's plain-string `Account_Name`, in parallel) → duplicate account; also in E6 a deal silently created an Account without create-account. Z-3 again: task 768001 orphan (search ran before contact existed, `[]` passed the rule). Deal Closing 2026-10-19 = +7 OK, Amount 1200 OK, Contact_Name empty (Q1). | exec `6accb373142e9cb860086957` |

### Email Sent pass summary (v2)
PASS: E1, E1c, E1d, E2b, E3, E4, E5, E6, E8, E9. FAIL/BUG: Z-1 (E1b, E2: mistyped mapped value kills record), Z-2 (E7: deal upsert resets Stage/Closing), Z-3 (E10/E12: contact-exists rule true on `[]` → orphan task, no contact), Z-4 (E11: note under skipped node errors run), Z-5 (E12/E6: deal Account_Name string auto-creates/duplicates Account). Confirmed live: F1, F2, F3, F4, F5, F7, F9, F10, Phone "" dropped (no blanking), Account_Name string accepted.
| M1 | PASS: custom SH field "LinkedIn Profile URL" (payload key = numeric id 2041900, mapping key = camelCase label `linkedInProfileUrl`) → Mapping Function translates via shFields → Zoho Contact Description set. | exec `6accbf5166b31963c14a81af` |
| M2 | **FAIL — Z-1 (date variant):** Deal mapping closingDate→Closing_Date: SH sends `"2026-11-30 00:00:00"`, Zoho date wants `YYYY-MM-DD` → 400 INVALID_DATA → no deal. Also shows precedence: mapped value (additional_fields) collides with the fixed Closing_Date from the setting. Same as SF B5. Mapping removed again after the test. | exec `6accbfb5d5af7efd084747e2` |
| D1 | **FAIL — BUG Z-2b (violates "update latest"):** two deals named "ZohoE6 Deal" (761005 created 15:37, 778009 created 16:39) → upsert `duplicate_field: Deal_Name` updated the **oldest** (761005: Stage→Qualification, Amount 9999); the newest untouched. | exec `6accc03ff65ff4bccd126713` |
| LU1 | PASS: existing Lead 761001 → upsert `update`, Designation CEO + City Houston from mapping, other mapped fields kept, still 1 lead. | exec `6accc11823caf681f2a5d48c` |

## v3 — `v3-latest-deal.json` (patch `../../patches-shared/v3_latest_deal.py`, user decisions 2026-10-12)
Nodes 39→46, edges 38→45; config_fields/export_id/trigger byte-identical.
- **Z-2 (structural, approved):** deal mapping → 50 "Deal - Get contact by email" → 51 "Deal - Mapped fields + contact link" → 52 "Deal - Get contact's latest deal" → 53 "Deal - Latest associated deal exists?"; true → 54 update body → 55 PUT /crm/v2/Deals/{latest id} → 56 note; false → "Layout Exist?" create chain. The 3 upsert_deal nodes read the linked fields (Contact_Name when a contact exists). Update sends mapped fields + Closing_Date (Deal Closing date) + Pipeline + Stage (settings), empties dropped.
- **Z-3:** task "contact exists?" rule reads `data.0.id` (was `data`, true on `[]`).
- **Z-4:** every note has node_rule "Parent_Id exists".
- Not changed by user decision: Z-1 (customer-side mapping), Z-5 (deal auto-creates account), Z-6 (tag replaces tags), Z-7 webui, Z-8/Z-9 cosmetic.
- Offline verification: self-checks (counts, wiring, rule handles, refs, no host, reachability) + 12 JSONata cases PASS + Zoho `PUT {"data":[{}]}` → 200.

## v3 live pass (staging, live definition == v3 for all 7, mappings + enabled kept)
| # | Scenario | Result | Evidence |
|---|---|---|---|
| D2 | contact with 2 linked deals → newest updated | PASS: 50 found contact 757001 → 52 newest = 765013 "ZohoAssoc New" → 53 true → 55 PUT via connector OK (Amount 4321, Closing 2026-10-22, Stage kept) → note 56; "ZohoAssoc Old" untouched; no new deal; create chain not run. | exec `6acccb6ddaa51456f1e81bb9` |
| D3 | contact with no deals → create linked | PASS: 52 → `{"data":[],"type":"Buffer"}` → 53 false (data.0.id) → create chain 16→12 insert with `Contact_Name` in additional_fields → deal 776009 linked to contact 758001, Amount 300, Closing 2026-10-17 (+5), Account Zoho D3 Co; note OK. | exec `6acccbeaea6c24d3dd0b93f4` |
| D4 | re-trigger linked deal (Stage set by hand to Needs Analysis) | PASS — **Z-2 fixed live:** 52 found 776009 → PUT updated Amount 350 + Closing 2026-10-20 (+8); **Stage kept Needs Analysis**; still 1 deal on the contact; no upsert-by-name. | exec `6acccc7835eec7d32c6a4276` |
| D5 | no Zoho contact → old behaviour | PASS: 50 `[]` → 51 no link → 52 **Skipped** (node_rule) → 53 false → 12 insert unlinked (`additional_fields` = mapping only); note OK; no error. | exec `6acccce4cab06eccf0e07e77` |
| D6a | Contact + Deal together, brand-new prospect (1st event) | as designed: deal search ran before the parallel contact insert → `[]` → deal 765020 created **unlinked**; contact created. | exec `6acccd4394af3d98b8be7072` |
| D6b | same, 2nd event | PASS — self-links: contact found, no linked deal → upsert matched 765020 by name and **set Contact_Name** (ZohoD6 Parallel), Amount 650; still 1 deal. Later events take the D4 path. | exec `6acccdadea6c24d3dd0eeb54` |
| T1 | Task, brand-new prospect | PASS — **Z-3 fixed live:** 33 false on `[]` → 48→49→34 contact insert 757009 → 35 task 752009 **Who_Id = ZohoT1 NewTask**, Due 2026-10-14 (+2) → note 37. | exec `6accce21ea6c24d3dd0f3e99` |
| T2 | Task, existing contact | PASS: 33 true → task 764015 on contact 757009; new-contact path not run. | exec `6accce98ea6c24d3dd0f9bc3` |
| N1 | Task with Subject "" | PASS — **Z-4 fixed live:** 14 Skipped, note 36 Skipped (Parent_Id guard), run **COMPLETED** (v2: ERRORED). | exec `6acccf0035eec7d32c6db4e0` |
| A1 | all 5 actions, brand-new prospect | Run COMPLETED, every create + note OK, deal created (no contact yet → 52 Skipped, unlinked, self-links next event per D6b). **NEW BUG Z-11:** Contact branch (10) and Task new-contact path (34) both inserted at the same instant → **2 contacts with the same email** (781007, 771014); task on 771014. Exposed by the Z-3 fix (v2 task path never created contacts). Needs a structural decision. | exec `6acccf5bea6c24d3dd10177c` |

## v4 — `v4-shared-contact.json` (patch `../../patches-shared/v4_shared_contact.py`, user decision 2026-10-12: one shared contact step, fixes Z-11)
Nodes 46→41, edges 45→41; config_fields/export_id/trigger byte-identical.
- New 57 "Contact or Task selected?" (OR, 33 clauses) → Get Prospect Fields → Contact mapping → node 10 upsert = the only contact create/update. Under 10: Contact rule → contact note; tag (Bounced/Unsub); Task rule → due date → task (Who_Id = node 10 id) → note; Join 58.
- Join 58 (no-op code node, incoming 10 + 57.false) → Deal rule → v3 deal branch; deal link uses the shared contact id first, else the email search.
- Removed ['32', '33', '34', '35', '37', '48', '49'] (Task branch's own search/exists-rule/fields/mapping/upsert/new-contact task/note); no readers left.
- Behaviour change: Task alone now also upserts the contact with the Contact Fields mapping.
- Offline: self-checks (one contact creator, join has 2 inputs, no reads of removed nodes, wiring, reachability, no host) + 5 JSONata cases PASS.

## v4 live pass (live == v4 for all 7, imported 2026-10-13 06:07–06:12 UTC)
| # | Scenario | Result | Evidence |
|---|---|---|---|
| F1 | Contact + Task, brand-new prospect | PASS — **Z-11 fixed live:** 57 true → 10 insert (only contact create) → contact note + task 758018 Who_Id = 765026 (Due +2) → notes; **1 contact**; join 58 ran after 10. | exec `6acdcc344792db99bb49f7c0` |
| F2 | Contact + Deal, brand-new prospect | PASS — **deal linked on the 1st event:** deal 783005 Contact_Name = ZohoF2 FirstLink, Closing +6, Amount 2600 (v3 linked only on the 2nd event). | exec `6acdcca26e7ef68d281ffba1` |
| F3, F4 | newest-of-two / Stage kept (existing prospects e2b, e3) | SETUP GAP: email never sent — prospect removed from the shared step and the re-import was silently dropped (no task in the sequence). Re-run with fresh prospects + linked deals created in Zoho. | — |
| F5 | Deal only, no Zoho contact | PASS: 57 false → **join 58 released on the rule-false path** → deal 767016 created unlinked (Closing +2), 52 Skipped, note OK. | exec `6acdd131f56875032912ff87` |

## v5 — `v5-account-link.json` (patch `../../patches-shared/v5_account_link.py`, user rule 2026-10-13: Account works like Deal; design confirmed by user)
Nodes 41→50, edges 41→50; config_fields/export_id/trigger byte-identical. New ['59', '60', '61', '62', '63', '64', '65', '66', '67'].
- Account branch moved behind the v4 Join. Contact id = shared contact step, else email search → GET contact?fields=Account_Name.
- Contact has an account → PUT /crm/v2/Accounts/{id} with mapped Account Fields (name not overwritten) → note on it.
- No account → existing upsert (mapped fields) → link: PUT /crm/v2/Contacts/{id} Account_Name = new account id. No contact → upsert only.
- Offline: self-checks + 7 JSONata cases PASS; live probes: GET contact?fields=Account_Name (null / {name,id}), PUT contact Account_Name link → SUCCESS.
| F6 | Task only, existing contact (e3) | SETUP GAP: same dropped re-import as F3/F4; re-run on v5 with a fresh prospect. | — |
| F7 | Contact only, new prospect | PASS: 1 contact, note. | exec `6acdd39eb2262a17f6e00e29` |
| F8 | all 5 actions, brand-new prospect | PASS — **1 contact, task Who_Id = it, deal Contact_Name = it on the 1st event**, account/lead/notes OK, COMPLETED (v3 A1: 2 contacts + unlinked deal). | see runs/*F8* |
| G1–G7 | v5 Account/Deal/Task/all-5 with per-property checks | 46/49 PASS (runs/v5-checks.txt). G7 FAIL = Z-5: deal's Account_Name text auto-created blank account 780029 and the deal links to it; the Account branch's account 780027 has all mapped fields and the contact is linked to it. | runs/*G[1-7]* |
