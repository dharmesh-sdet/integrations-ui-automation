# Email Sent from Saleshandy (Saleshandy → Pipedrive)

- v1 = `v1-original.json` (88 nodes, 80 edges, 61 config_fields), byte-identical to `pipedrive old workflows/681368981acc0cbcd162959d.json`.
- Env folder: staging (to be confirmed).

## v1 → audit (offline, 2026-10-13)
Full write-up: `.lavish/pipedrive-workflows-v2-plan.html`. Fix ids F1–F12 are defined there and in `../../patches-shared/v2_fixes.py`.

## v2 — `v2-fixes.json` (patch `../../patches-shared/v2_fixes.py`, change list `v2-changes.json`) — approved 2026-10-13
88 → 79 nodes, 80 → 71 edges; config_fields unchanged.
User decisions: shared person step; update/delete-deal = person's latest deal (create-deal/create-lead still create every time); missing Deal/Org mappings added; Email Sent data_mapper → Mapping Function; hosts kept; no new links/activities.

- F12 node 412e6f59-2564-49a9-8535-b7f6e048c848 "Start" `outgoing_nodes`: ["3", "8", "60", "61", "66", "67", "68", "65", "62", "63", "64"] → ["8", "66", "67", "68", "65", "62", "63", "64", "113"]
- F12 node 3 "rule" `incoming_nodes`: ["412e6f59-2564-49a9-8535-b7f6e048c848"] → ["122"]
- F12 node 3 "rule" `outgoing_nodes`: ["80"] → ["31"]
- F12 node 3 "rule" `rule_satisfied_nodes`: ["80"] → ["31"]
- F12 node 17 "Create Deal" `additional_node_properties.node_rule`: {"operator": "AND", "compare_value_of": []} → {"operator": "AND", "compare_value_of": [{"data_slot_id": "{{node.122.body.person_id}}", "compare_value": "", "comparison_operator": "exist"
- F12 node 17 "Create Deal" `incoming_nodes`: ["69"] → ["123"]
- F6-F9 node 17 "Create Deal" `input_data.custom_fields`: null → "{{node.123.body}}"
- F4 node 17 "Create Deal" `input_data.person_id`: "{{node.69.body.data.id}}" → "{{node.122.body.person_id}}"
- F3 node 21 "Update Person" `input_data.email`: null → "[{\"value\": \"{{event.body.prospect.email}}\", \"primary\": \"true\", \"label\": \"main\"}]"
- F12 node 25 "pipedrive" `incoming_nodes`: ["67"] → ["129"]
- F6-F9 node 25 "pipedrive" `input_data.custom_fields`: null → "{{node.129.body}}"
- F12 node 26 "pipedrive" `incoming_nodes`: ["51"] → ["133"]
- F6-F9 node 26 "pipedrive" `input_data.custom_fields`: "{{application.fields.Organisation Fields}}" → "{{node.133.body}}"
- F4 node 30 "Create a person" `(removed node)`: "create_contact" → null
- F12 node 31 "Create a lead" `additional_node_properties.node_rule`: {"operator": "AND", "compare_value_of": []} → {"operator": "AND", "compare_value_of": [{"data_slot_id": "{{node.122.body.person_id}}", "compare_value": "", "comparison_operator": "exist"
- F12 node 31 "Create a lead" `incoming_nodes`: ["30"] → ["3"]
- F4 node 31 "Create a lead" `input_data.person_id`: "{{node.30.body.data.id}}" → "{{node.122.body.person_id}}"
- F4 node 33 "Create a person" `(removed node)`: "create_contact" → null
- F12 node 36 "Get base url" `outgoing_nodes`: ["37"] → ["126"]
- F5 node 37 "Find person's latest deal" `additional_node_properties.node_rule`: {"operator": "AND", "compare_value_of": []} → {"operator": "AND", "compare_value_of": [{"data_slot_id": "{{node.127.body.person_id}}", "compare_value": "", "comparison_operator": "exist"
- F5 node 37 "Find person's latest deal" `incoming_nodes`: ["36"] → ["127"]
- F5 node 37 "Find person's latest deal" `input_data.query_params`: {"term": "{{event.body.prospect.email}}", "fields": "title", "exact_match": "true"} → {"sort": "add_time DESC", "limit": "1"}
- F5 node 37 "Find person's latest deal" `input_data.url_path`: "/v1/deals/search" → "/v1/persons/{{node.127.body.person_id}}/deals"
- F5 node 37 "Find person's latest deal" `name`: "Find a deal" → "Find person's latest deal"
- F12 node 44 "Get base url" `outgoing_nodes`: ["45"] → ["124"]
- F5 node 45 "Find person's latest deal" `additional_node_properties.node_rule`: {"operator": "AND", "compare_value_of": []} → {"operator": "AND", "compare_value_of": [{"data_slot_id": "{{node.125.body.person_id}}", "compare_value": "", "comparison_operator": "exist"
- F5 node 45 "Find person's latest deal" `incoming_nodes`: ["44"] → ["125"]
- F5 node 45 "Find person's latest deal" `input_data.query_params`: {"term": "{{event.body.prospect.email}}", "fields": "title", "exact_match": "true"} → {"sort": "add_time DESC", "limit": "1"}
- F5 node 45 "Find person's latest deal" `input_data.url_path`: "/v1/deals/search" → "/v1/persons/{{node.125.body.person_id}}/deals"
- F5 node 45 "Find person's latest deal" `name`: "Find a deal" → "Find person's latest deal"
- F12 node 47 "Copy - Deal exist?" `outgoing_nodes`: ["70"] → ["130"]
- F12 node 47 "Copy - Deal exist?" `rule_satisfied_nodes`: ["70"] → ["130"]
- F12 node 51 "Org exist?" `outgoing_nodes`: ["26"] → ["132"]
- F12 node 51 "Org exist?" `rule_satisfied_nodes`: ["26"] → ["132"]
- F12 node 59 "Person exist?" `outgoing_nodes`: ["104"] → ["134"]
- F12 node 59 "Person exist?" `rule_satisfied_nodes`: ["104"] → ["134"]
- F12 node 60 "Copy - rule" `incoming_nodes`: ["412e6f59-2564-49a9-8535-b7f6e048c848"] → ["122"]
- F12 node 60 "Copy - rule" `outgoing_nodes`: ["75"] → ["123"]
- F12 node 60 "Copy - rule" `rule_satisfied_nodes`: ["75"] → ["123"]
- F12 node 61 "Rule" `incoming_nodes`: ["412e6f59-2564-49a9-8535-b7f6e048c848"] → ["122"]
- F12 node 61 "Rule" `outgoing_nodes`: ["74"] → ["89"]
- F12 node 61 "Rule" `rule_satisfied_nodes`: ["74"] → ["89"]
- F12 node 67 "Copy - Copy - Rule" `outgoing_nodes`: ["25"] → ["128"]
- F12 node 67 "Copy - Copy - Rule" `rule_satisfied_nodes`: ["25"] → ["128"]
- F4 node 69 "Copy - Create a person" `(removed node)`: "create_contact" → null
- F12 node 70 "pipedrive" `incoming_nodes`: ["47"] → ["131"]
- F6-F9 node 70 "pipedrive" `input_data.custom_fields`: "{{application.fields.Deal Fields}}" → "{{node.131.body}}"
- F4 node 71 "Copy - Copy - Find a person" `(removed node)`: "httprequest" → null
- F4 node 72 "rule" `(removed node)`: "rule" → null
- F4 node 73 "Copy - Update Person" `(removed node)`: "update_contact" → null
- F4 node 74 "Copy - Get base url" `(removed node)`: "httprequest" → null
- F4 node 75 "Copy - Copy - Get base url" `(removed node)`: "httprequest" → null
- F4 node 76 "Copy - Copy - Copy - Find a person" `(removed node)`: "httprequest" → null
- F4 node 77 "Copy - rule" `(removed node)`: "rule" → null
- F4 node 78 "Copy - Copy - Update Person" `(removed node)`: "update_contact" → null
- F4 node 79 "Copy - Create Deal" `(removed node)`: "create_deal" → null
- F4 node 80 "Copy - Copy - Copy - Get base url" `(removed node)`: "httprequest" → null
- F4 node 81 "Copy - Copy - Copy - Copy - Find a person" `(removed node)`: "httprequest" → null
- F4 node 82 "Copy - Copy - rule" `(removed node)`: "rule" → null
- F4 node 83 "Update Person" `(removed node)`: "update_contact" → null
- F4 node 84 "Copy - Create a lead" `(removed node)`: "create_lead" → null
- F11 node 85 "Associate Email Activity with person" `input_data.body`: "{\n  \"person_id\": \"{{node.105.body.person_id}}\",\n  \"type\": \"email\",\n  \"subject\": \"Email sent from Saleshandy\",\n  \"note\": \ → "{\n  \"person_id\": \"{{node.105.body.person_id}}\",\n  \"type\": \"email\",\n  \"subject\": \"Email sent from Saleshandy\",\n  \"note\": \
- F4 node 87 "Associate Email Activity with person" `(removed node)`: "httprequest" → null
- F12 node 89 "Copy - Associate Email Activity with person" `additional_node_properties.node_rule`: {"operator": "AND", "compare_value_of": []} → {"operator": "AND", "compare_value_of": [{"data_slot_id": "{{node.122.body.person_id}}", "compare_value": "", "comparison_operator": "exist"
- F12 node 89 "Copy - Associate Email Activity with person" `incoming_nodes`: ["73"] → ["61"]
- F11 node 89 "Copy - Associate Email Activity with person" `input_data.body`: "{\n  \"person_id\": \"{{node.91.body.result.person_id}}\",\n  \"type\": \"email\",\n  \"subject\": \"Email sent from Saleshandy\",\n  \"not → "{\n  \"person_id\": \"{{node.122.body.person_id}}\",\n  \"type\": \"email\",\n  \"subject\": \"Email sent from Saleshandy\",\n  \"note\": \
- F4 node 91 "Copy - transform" `(removed node)`: "transform" → null
- F5 node 93 "Execute javascript  code" `input_data.code_string`: "/**\n* JS/Javascript\n* Write your Javascript code inside this function and return \n* an object which will be the response of this node. \ → "function yourFunction(params) {\n  // GET /v1/persons/{id}/deals?sort=add_time DESC&limit=1 -> data is [latestDeal] or null.\n  var deals =
- F5 node 93 "Execute javascript  code" `input_data.input_parameters`: [{"key": "allDeals", "value": "{{node.45.body.data.items}}"}, {"key": "requiredDeal", "value": "{{event.body.prospect.email}}"}] → [{"key": "allDeals", "value": "{{node.45.body.data}}"}, {"key": "personId", "value": "{{node.125.body.person_id}}"}]
- F5 node 94 "Execute javascript  code" `input_data.code_string`: "/**\n* JS/Javascript\n* Write your Javascript code inside this function and return \n* an object which will be the response of this node. \ → "function yourFunction(params) {\n  // GET /v1/persons/{id}/deals?sort=add_time DESC&limit=1 -> data is [latestDeal] or null.\n  var deals =
- F5 node 94 "Execute javascript  code" `input_data.input_parameters`: [{"key": "allDeals", "value": "{{node.37.body.data.items}}"}, {"key": "requiredDeal", "value": "{{event.body.prospect.email}}"}] → [{"key": "allDeals", "value": "{{node.37.body.data}}"}, {"key": "personId", "value": "{{node.127.body.person_id}}"}]
- F12 node 95 "Execute javascript  code" `incoming_nodes`: [] → ["53"]
- F4 node 98 "Data Mapper" `(removed node)`: "data_mapper" → null
- F4 node 99 "Copy - Data Mapper" `(removed node)`: "data_mapper" → null
- F4 node 100 "Data Mapper" `(removed node)`: "data_mapper" → null
- F4 node 101 "Copy - Data Mapper" `(removed node)`: "data_mapper" → null
- F4 node 102 "Data Mapper" `(removed node)`: "data_mapper" → null
- F4 node 103 "Copy - Data Mapper" `(removed node)`: "data_mapper" → null
- F6-F9 node 104 "Update person - Mapping (Contact Fields)" `additional_node_properties.node_settings`: {"skip_on_error": false, "hide_node_request": false, "output_fields": [], "encrypted_output_fields": [], "enable_schema_validation": false} → {"skip_on_error": false, "hide_node_request": false, "output_fields": [], "encrypted_output_fields": [], "allow_partial_success": false, "en
- F6-F9 node 104 "Update person - Mapping (Contact Fields)" `data`: {} → null
- F6-F9 node 104 "Update person - Mapping (Contact Fields)" `incoming_nodes`: ["59"] → ["134"]
- F6-F9 node 104 "Update person - Mapping (Contact Fields)" `input_data.direction`: "right" → null
- F6-F9 node 104 "Update person - Mapping (Contact Fields)" `input_data.fieldMapping`: null → "{{application.fields.Contact Fields}}"
- F6-F9 node 104 "Update person - Mapping (Contact Fields)" `input_data.input`: "{{event.body.prospect}}" → null
- F6-F9 node 104 "Update person - Mapping (Contact Fields)" `input_data.internal_function_name`: null → "Mapping Function"
- F6-F9 node 104 "Update person - Mapping (Contact Fields)" `input_data.mapping`: "{{application.fields.Contact Fields}}" → null
- F6-F9 node 104 "Update person - Mapping (Contact Fields)" `input_data.prospect`: null → "{{event.body.prospect}}"
- F6-F9 node 104 "Update person - Mapping (Contact Fields)" `input_data.shFields`: null → "{{node.134.body.payload}}"
- F6-F9 node 104 "Update person - Mapping (Contact Fields)" `name`: "Data Mapper" → "Update person - Mapping (Contact Fields)"
- F6-F9 node 104 "Update person - Mapping (Contact Fields)" `type`: "data_mapper" → "internal_functions"
- F11 node 106 "Custom Code" `input_data.code_string`: "function yourFunction(params){\n  function clean(v){\n    if (v === null || v === undefined) return \"\";\n    v = String(v).trim();\n    i → "function yourFunction(params){\n  function clean(v){\n    if (v === null || v === undefined) return \"\";\n    v = String(v).trim();\n    i
- F12 node 106 "Custom Code" `input_data.input_parameters`: [{"key": "firstname", "value": "{{event.body.prospect.firstName}}"}, {"key": "lastname", "value": "{{event.body.prospect.lastName}}"}] → [{"key": "firstname", "value": "{{event.body.prospect.firstName}}"}, {"key": "lastname", "value": "{{event.body.prospect.lastName}}"}, {"key
- F4 node 107 "Custom Code" `(removed node)`: "no_action" → null
- F4 node 108 "Custom Code" `(removed node)`: "no_action" → null
- F4 node 109 "Custom Code" `(removed node)`: "no_action" → null
- F4 node 110 "Custom Code" `(removed node)`: "no_action" → null
- F4 node 111 "Custom Code" `(removed node)`: "no_action" → null
- F4 node 112 "Custom Code" `(removed node)`: "no_action" → null
- F12 node 113 "Person needed?" `(new node)`: null → "rule"
- F4 node 114 "Person - Get base url" `(new node)`: null → "httprequest"
- F4 node 115 "Person - Find a person" `(new node)`: null → "httprequest"
- F4 node 116 "Person - Exact email match" `(new node)`: null → "no_action"
- F4 node 117 "Person - Saleshandy fields" `(new node)`: null → "Get Prospect Fields"
- F4 node 118 "Person - Mapping (Contact Fields)" `(new node)`: null → "internal_functions"
- F4 node 119 "Person - Name" `(new node)`: null → "no_action"
- F4 node 120 "Person - Update person" `(new node)`: null → "update_contact"
- F4 node 121 "Person - Create person" `(new node)`: null → "create_contact"
- F4 node 122 "Person - Resolved id" `(new node)`: null → "no_action"
- F6-F9 node 123 "Deal - Mapping (Deal Fields)" `(new node)`: null → "internal_functions"
- F12 node 124 "Update deal - Find person" `(new node)`: null → "httprequest"
- F12 node 125 "Update deal - Exact email match" `(new node)`: null → "no_action"
- F12 node 126 "Delete deal - Find person" `(new node)`: null → "httprequest"
- F12 node 127 "Delete deal - Exact email match" `(new node)`: null → "no_action"
- F6-F9 node 128 "Create org - Saleshandy fields" `(new node)`: null → "Get Prospect Fields"
- F6-F9 node 129 "Create org - Mapping (Organisation Fields)" `(new node)`: null → "internal_functions"
- F6-F9 node 130 "update-deal - Saleshandy fields" `(new node)`: null → "Get Prospect Fields"
- F6-F9 node 131 "update-deal - Mapping (Deal Fields)" `(new node)`: null → "internal_functions"
- F6-F9 node 132 "update-org - Saleshandy fields" `(new node)`: null → "Get Prospect Fields"
- F6-F9 node 133 "update-org - Mapping (Organisation Fields)" `(new node)`: null → "internal_functions"
- F6-F9 node 134 "Update person - Saleshandy fields" `(new node)`: null → "Get Prospect Fields"

## To confirm on the first live run
1. `persons/{id}/deals` sort: 2 deals on one person → the newer one is updated/deleted.
2. update_contact returns `body.data.id` (fallback = search id).
3. New prospect with create-lead + create-deal + create-person → exactly 1 person; lead, deal and activity on it.
4. Activity text with quotes / HTML (Email Sent email body) is created.

## Live runs (v2, staging, Pipedrive rudrascompany, linked account 80121)
Setup 2026-10-13: field mappings saved — Contact {firstName→first_name, lastName→last_name, phoneNumber→phone}; Deal {dealValue→value, closingDate→expected_close_date}; Organisation {website→website, linkedIn→linkedin, city→address}. Org `industry` left unmapped: Pipedrive field is an enum (picklist), SH value is free text (#46).

| Scenario | Actions | Prospect | Execution | Result |
|---|---|---|---|---|
| E1 | create-person | new `rudra+pd-e1@saleshandy.com` | 6acdec6cc9a5007e3fe48938 | **PASS** — 1 person (id 1), first/last/phone mapped, email exact, update node skipped (mode=create), activity 1 on person 1 with full note incl. HTML email body |
| E2 | create-person | same as E1 (exists) | 6acded4ff56875032922b1b3 | **PASS** — mode=update, 120 ran / 121 skipped, still 1 person, phone updated to …002, 2nd activity on person 1 |
| E3 | create-lead | E1 (exists) | 6acdee3c4792db99bb594d39 | **PASS** — lead on person 1, no new person (first attempt picked another tester's run: runner now matches by email/company) |
| E4 | create-deal (pipeline 1, stage 2) | E1 | 6acdeecbf6d843d7c443911e | **PASS** — deal 1 on person 1, pipeline 1 / stage 2, value 1500 (string → monetary OK), expected_close_date 2026-11-30 (SH `2026-11-30 00:00:00` → date OK) |
| E5 | create-lead + create-deal + create-person | new `rudra+pd-e5@` | 6acdef65b2262a17f6ee8f17 | **PASS** — exactly 1 person (8); deal 3, lead, activity all on person 8 |
| E6 | update-person | E1 | 6acdefe3f6d843d7c4441843 | **PASS** — person 1 renamed "Pd Esent Updated", phone …006 (Mapping Function, F9), activity added |
| E6b | update-person | new, no person | (ERRORED run, see runs/) | **FAIL B1** — node 105 returns `{person_id:null}`; Refold `exist` is TRUE for null → node 21 update_contact id=null → 500 "Missing required url param: id", run ERRORED. Pre-existing (v1 code) |
| E4b | create-deal (stage 1) | E1 | — | setup: 2nd, newer deal 6 on person 1 |
| E7 | update-deal (stage 4) | E1 (deals 1 + 6) | — | **PASS** — only newest deal 6 → stage 4, value 9999; deal 1 untouched |
| E7b | update-deal | new, no person | 6acdf2fe4792db99bb5b7df5 | **FAIL B2** — v2 "Exact email match" returns `person_id:null`, node_rule `exist` passes → GET /v1/persons/null/deals → 403, run ERRORED (same code in delete-deal + shared step) |
| E8 | delete-deal | E1 | — | **PASS** — only newest deal 6 deleted, deal 1 kept |
| E9 | create-org | company "PD Test Co E1" | 6acdf417f6d843d7c446dc89 | **PASS** — org 1 with website, linkedin, address=city mapped. Not linked to person (by decision) |
| E10 | update-org | same company | — | **PASS** — org 1 website/linkedin/address updated |
| E11 | delete-org | same company | — | **PASS** — org 1 deleted (Pipedrive returns a deprecation warning for the connector's delete-org endpoint, info only) |
| E12 | delete-person | E5 | — | **PASS** — person 8 deleted |
