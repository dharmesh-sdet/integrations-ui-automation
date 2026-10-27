# Email is Opened in Saleshandy (Saleshandy → Zoho)

- v1 = `v1-original.json` (39 nodes, 38 edges, 276 config_fields), byte-identical to `zoho old workflows/64f423c52538e61278751c59.json`.
- Env folder: staging (to be confirmed).

## v1 → audit (offline, 2026-10-12)
Full write-up: `.lavish/zoho-workflows-v2-fixes.html`. Fix ids F1–F12 are defined in `../../patches-shared/v2_static_fixes.py`.

## v2 — `v2-static-fixes.json` (patch `../../patches-shared/v2_static_fixes.py`, change list `v2-changes.json`)
No node/edge added, removed or rewired.
- F2 node 4 "Contact - rule" `compare_value_of (values tested)`: ["create-contact"] → ["create- contact", "create-contact"]
- F1 node 5 "Lead - rule" `compare_value_of[1].data_slot_id`: "{{workflow.fields.Select Pipedrive Action1}}" → "{{workflow.fields.Select Pipedrive Action2}}"
- F6 node 10 "create/update contact" `Phone`: "{{event.body.prospect.phone}}" → ""
- F6 node 11 "create/update lead" `Phone`: "{{event.body.prospect.phone}}" → ""
- F7 node 11 "create/update lead" `Company`: "" → "{{event.body.prospect.company}}"
- F3 node 12 "create deal w/o layout" `Closing_Date`: "{{node.54.body.due_date}}" → "{{node.54.body.result.due_date}}"
- F8 node 12 "create deal w/o layout" `Stage`: "{{workflow.fields.Select Stages}}" → "Qualification"
- F3 node 14 "Create task for existing contact" `additional_fields`: "{\"Due_Date\": \"{{node.53.body.due_date}}\",\"Priority\": \"{{workflow.fields.Priority}}\",\"Who_Id\":{ \"id\": \"{{node.47.body.data.0.id → "{\"Due_Date\": \"{{node.53.body.result.due_date}}\",\"Priority\": \"{{workflow.fields.Priority}}\",\"Who_Id\":{ \"id\": \"{{node.47.body.da
- F10 node 15 "Zoho Notes" `Note_Content`: "Sequence Name: {{event.body.sequence.sequenceName}}Sequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/stepsStep: {{eve → "Sequence Name: {{event.body.sequence.sequenceName}}\nSequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/steps\nStep: {
- F3 node 17 "create deal w/o pipeline" `Closing_Date`: "{{node.54.body.due_date}}" → "{{node.54.body.result.due_date}}"
- F3 node 19 "zoho" `Closing_Date`: "{{node.54.body.due_date}}" → "{{node.54.body.result.due_date}}"
- F10 node 41 "Zoho Notes" `Note_Content`: "Sequence Name: {{event.body.sequence.sequenceName}}Sequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/stepsStep: {{eve → "Sequence Name: {{event.body.sequence.sequenceName}}\nSequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/steps\nStep: {
- F10 node 42 "Zoho Notes" `Note_Content`: "Sequence Name: {{event.body.sequence.sequenceName}}Sequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/stepsStep: {{eve → "Sequence Name: {{event.body.sequence.sequenceName}}\nSequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/steps\nStep: {
- F10 node 43 "Zoho Notes" `Note_Content`: "Sequence Name: {{event.body.sequence.sequenceName}}Sequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/stepsStep: {{eve → "Sequence Name: {{event.body.sequence.sequenceName}}\nSequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/steps\nStep: {
- F10 node 44 "Zoho Notes" `Note_Content`: "Sequence Name: {{event.body.sequence.sequenceName}}Sequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/stepsStep: {{eve → "Sequence Name: {{event.body.sequence.sequenceName}}\nSequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/steps\nStep: {
- F10 node 45 "Zoho Notes" `Note_Content`: "Sequence Name: {{event.body.sequence.sequenceName}}Sequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/stepsStep: {{eve → "Sequence Name: {{event.body.sequence.sequenceName}}\nSequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/steps\nStep: {
- F6 node 49 "Create/Update new contact" `Phone`: "{{event.body.prospect.phone}}" → ""
- F3 node 50 "Create task for new contact" `additional_fields`: "{\"Due_Date\": \"{{node.53.body.due_date}}\",\"Priority\": \"{{workflow.fields.Priority}}\",\"Who_Id\":{ \"id\": \"{{node.49.body.data.0.de → "{\"Due_Date\": \"{{node.53.body.result.due_date}}\",\"Priority\": \"{{workflow.fields.Priority}}\",\"Who_Id\":{ \"id\": \"{{node.49.body.da
- F10 node 51 " Zoho Notes" `Note_Content`: "Sequence Name: {{event.body.sequence.sequenceName}}Sequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/stepsStep: {{eve → "Sequence Name: {{event.body.sequence.sequenceName}}\nSequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/steps\nStep: {
- F10 node 52 "Zoho Notes" `Note_Content`: "Sequence Name: {{event.body.sequence.sequenceName}}Sequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/stepsStep: {{eve → "Sequence Name: {{event.body.sequence.sequenceName}}\nSequence: https://my.saleshandy.com/sequence/{{event.body.sequence.id}}/steps\nStep: {
- F4 node 54 "Copy - transform" `query`: "{\"due_date\": ($millis() + ({{workflow.fields.Due In}}* 24 * 60 * 60 * 1000) + (5.5 * 60 * 60 * 1000)) ~> $fromMillis('[Y0001]-[M01]-[D01] → "{\"due_date\": ($millis() + ({{workflow.fields.Deal Closing date}}* 24 * 60 * 60 * 1000) + (5.5 * 60 * 60 * 1000)) ~> $fromMillis('[Y0001]-
- F4 node 54 "Copy - transform" `query`: "{\"due_date\": ($millis() + ({{workflow.fields.Due In}}* 24 * 60 * 60 * 1000) + (5.5 * 60 * 60 * 1000)) ~> $fromMillis('[Y0001]-[M01]-[D01] → "{\"due_date\": ($millis() + ({{workflow.fields.Deal Closing date}}* 24 * 60 * 60 * 1000) + (5.5 * 60 * 60 * 1000)) ~> $fromMillis('[Y0001]-
- F4 node 54 "Copy - transform" `input`: "{\"due_in\":\" {{workflow.fields.Due In}} \"}" → "{\"due_in\":\"{{workflow.fields.Deal Closing date}}\"}"
- F4 node 54 "Copy - transform" `node_rule`: {"operator": "AND", "compare_value_of": [{"data_slot_id": "{{workflow.fields.Due In}}", "compare_value": "", "comparison_operator": "exist"} → {"operator": "AND", "compare_value_of": [{"data_slot_id": "{{workflow.fields.Deal Closing date}}", "compare_value": "", "comparison_operator
- F9 node 50 "Create task for new contact" `node_rule`: null → {"operator": "AND", "compare_value_of": [{"data_slot_id": "{{workflow.fields.Subject}}", "compare_value": "", "comparison_operator": "exist"

## Open (asked in chat, not in v2)
- Q1 deal not linked to contact (structural) · Q2 deal upsert resets Stage/Closing date each event · Q3 webui hides Select Layout for Deal → Pipeline/Stage never settable · Q4 webui `:Meeting Booked` key · Q5 env folder.

## Live checks still needed
- Deal `Account_Name` as plain string · Tag upsert keeps other tags · task with `Due_Date: ""` · email search with `+` · connector drops empty Phone · mapped field types (#46).
| O1 | Manual open of x2 (after enabling open tracking, sequence 196017 code 5): Contact 7636887000000772005 (insert) + note with Open Count 1; **Z-3 again**: search 47 ran in parallel with the contact insert → `[]` → rule 48 true → Task 765009 orphan (Who_Id null), Due 2026-10-14 (+2) OK. First attempt (x1) had open tracking OFF = setup gap. | exec `6accbdb966b31963c1499fac` |

## v3 — `v3-latest-deal.json` (patch `../../patches-shared/v3_latest_deal.py`, user decisions 2026-10-12)
Nodes 39→46, edges 38→45; config_fields/export_id/trigger byte-identical.
- **Z-2 (structural, approved):** deal mapping → 65 "Deal - Get contact by email" → 66 "Deal - Mapped fields + contact link" → 67 "Deal - Get contact's latest deal" → 68 "Deal - Latest associated deal exists?"; true → 69 update body → 70 PUT /crm/v2/Deals/{latest id} → 71 note; false → "Layout Exist?" create chain. The 3 upsert_deal nodes read the linked fields (Contact_Name when a contact exists). Update sends mapped fields + Closing_Date (Deal Closing date) + Pipeline + Stage (settings), empties dropped.
- **Z-3:** task "contact exists?" rule reads `data.0.id` (was `data`, true on `[]`).
- **Z-4:** every note has node_rule "Parent_Id exists".
- Not changed by user decision: Z-1 (customer-side mapping), Z-5 (deal auto-creates account), Z-6 (tag replaces tags), Z-7 webui, Z-8/Z-9 cosmetic.
- Offline verification: self-checks (counts, wiring, rule handles, refs, no host, reachability) + 12 JSONata cases PASS + Zoho `PUT {"data":[{}]}` → 200.

## v3 live pass
| # | Scenario | Result | Evidence |
|---|---|---|---|
| VO1 | manual open x4: contact + deal | PASS: contact 767012 insert + note; deal 778021 created (contact search ran before the parallel insert → unlinked, as D6a). | exec `6accd214cab06eccf0e8e1e0` |

## v4 — `v4-shared-contact.json` (patch `../../patches-shared/v4_shared_contact.py`, user decision 2026-10-12: one shared contact step, fixes Z-11)
Nodes 46→41, edges 45→41; config_fields/export_id/trigger byte-identical.
- New 72 "Contact or Task selected?" (OR, 33 clauses) → Get Prospect Fields → Contact mapping → node 10 upsert = the only contact create/update. Under 10: Contact rule → contact note; tag (Bounced/Unsub); Task rule → due date → task (Who_Id = node 10 id) → note; Join 73.
- Join 73 (no-op code node, incoming 10 + 72.false) → Deal rule → v3 deal branch; deal link uses the shared contact id first, else the email search.
- Removed ['47', '48', '49', '50', '52', '63', '64'] (Task branch's own search/exists-rule/fields/mapping/upsert/new-contact task/note); no readers left.
- Behaviour change: Task alone now also upserts the contact with the Contact Fields mapping.
- Offline: self-checks (one contact creator, join has 2 inputs, no reads of removed nodes, wiring, reachability, no host) + 5 JSONata cases PASS.

## v5 — `v5-account-link.json` (patch `../../patches-shared/v5_account_link.py`, user rule 2026-10-13: Account works like Deal; design confirmed by user)
Nodes 41→50, edges 41→50; config_fields/export_id/trigger byte-identical. New ['74', '75', '76', '77', '78', '79', '80', '81', '82'].
- Account branch moved behind the v4 Join. Contact id = shared contact step, else email search → GET contact?fields=Account_Name.
- Contact has an account → PUT /crm/v2/Accounts/{id} with mapped Account Fields (name not overwritten) → note on it.
- No account → existing upsert (mapped fields) → link: PUT /crm/v2/Contacts/{id} Account_Name = new account id. No contact → upsert only.
- Offline: self-checks + 7 JSONata cases PASS; live probes: GET contact?fields=Account_Name (null / {name,id}), PUT contact Account_Name link → SUCCESS.
