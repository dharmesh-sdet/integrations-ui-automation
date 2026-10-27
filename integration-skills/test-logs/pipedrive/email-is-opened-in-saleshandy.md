# Email is Opened in Saleshandy (Saleshandy → Pipedrive)

- v1 = `v1-original.json` (95 nodes, 89 edges, 67 config_fields), byte-identical to `pipedrive old workflows/681368981acc0cbcd16295a6.json`.
- Env folder: staging (to be confirmed).

## v1 → audit (offline, 2026-10-13)
Full write-up: `.lavish/pipedrive-workflows-v2-plan.html`. Fix ids F1–F12 are defined there and in `../../patches-shared/v2_fixes.py`.

## v2 — `v2-fixes.json` (patch `../../patches-shared/v2_fixes.py`, change list `v2-changes.json`) — approved 2026-10-13
95 → 77 nodes, 89 → 71 edges; config_fields unchanged.
Also (2026-10-13): F13 empty category gate runs for every outcome (#52); F14 extract code read another branch's search; F15 update-deal title company → email. User decisions: shared person step; update/delete-deal = person's latest deal (create-deal/create-lead still create every time); missing Deal/Org mappings added; Email Sent data_mapper → Mapping Function; hosts kept; no new links/activities.

- F12 node 412e6f59-2564-49a9-8535-b7f6e048c848 "Start" `outgoing_nodes`: ["3", "8", "60", "61", "63", "64", "65", "62", "66", "67", "68"] → ["8", "63", "64", "65", "62", "66", "67", "68", "119"]
- F12 node 3 "rule" `incoming_nodes`: ["412e6f59-2564-49a9-8535-b7f6e048c848"] → ["128"]
- F12 node 3 "rule" `outgoing_nodes`: ["80"] → ["31"]
- F12 node 3 "rule" `rule_satisfied_nodes`: ["80"] → ["31"]
- F12 node 17 "Create Deal" `additional_node_properties.node_rule`: null → {"operator": "AND", "compare_value_of": [{"data_slot_id": "{{node.128.body.person_id}}", "compare_value": "", "comparison_operator": "exist"
- F12 node 17 "Create Deal" `incoming_nodes`: ["104"] → ["129"]
- F6-F9 node 17 "Create Deal" `input_data.custom_fields`: "{{node.104.body}}" → "{{node.129.body}}"
- F4 node 17 "Create Deal" `input_data.person_id`: "{{node.69.body.data.id}}" → "{{node.128.body.person_id}}"
- F10 node 21 "Update Person" `input_data.email`: "[{\"value\": \" {{event.body.prospect.email}} \", \"primary\": \"true\", \"label\": \"main\"}]" → "[{\"value\": \"{{event.body.prospect.email}}\", \"primary\": \"true\", \"label\": \"main\"}]"
- F4 node 30 "Create a person" `(removed node)`: "create_contact" → null
- F12 node 31 "Create a lead" `additional_node_properties.node_rule`: {"operator": "AND", "compare_value_of": []} → {"operator": "AND", "compare_value_of": [{"data_slot_id": "{{node.128.body.person_id}}", "compare_value": "", "comparison_operator": "exist"
- F12 node 31 "Create a lead" `incoming_nodes`: ["30"] → ["3"]
- F4 node 31 "Create a lead" `input_data.person_id`: "{{node.30.body.data.id}}" → "{{node.128.body.person_id}}"
- F4 node 33 "Create a person" `(removed node)`: "create_contact" → null
- F12 node 36 "Get base url" `outgoing_nodes`: ["37"] → ["132"]
- F5 node 37 "Find person's latest deal" `additional_node_properties.node_rule`: null → {"operator": "AND", "compare_value_of": [{"data_slot_id": "{{node.133.body.person_id}}", "compare_value": "", "comparison_operator": "exist"
- F5 node 37 "Find person's latest deal" `incoming_nodes`: ["36"] → ["133"]
- F5 node 37 "Find person's latest deal" `input_data.query_params`: {"term": "{{event.body.prospect.email}}", "fields": "title", "exact_match": "true"} → {"sort": "add_time DESC", "limit": "1"}
- F5 node 37 "Find person's latest deal" `input_data.query_string`: "{\"term\": \"{{event.body.prospect.email}}\",\"fields\":[\"title\"],\"exact_match\": true}" → null
- F5 node 37 "Find person's latest deal" `input_data.url_path`: "/v1/deals/search" → "/v1/persons/{{node.133.body.person_id}}/deals"
- F5 node 37 "Find person's latest deal" `name`: "Find a deal" → "Find person's latest deal"
- F12 node 44 "Get base url" `outgoing_nodes`: ["45"] → ["130"]
- F5 node 45 "Find person's latest deal" `additional_node_properties.node_rule`: null → {"operator": "AND", "compare_value_of": [{"data_slot_id": "{{node.131.body.person_id}}", "compare_value": "", "comparison_operator": "exist"
- F5 node 45 "Find person's latest deal" `incoming_nodes`: ["44"] → ["131"]
- F5 node 45 "Find person's latest deal" `input_data.query_params`: {"term": "{{event.body.prospect.email}}", "fields": "title", "exact_match": "true"} → {"sort": "add_time DESC", "limit": "1"}
- F5 node 45 "Find person's latest deal" `input_data.query_string`: "{\"term\": \"{{event.body.prospect.email}}\",\"fields\":[\"title\"],\"exact_match\": true}" → null
- F5 node 45 "Find person's latest deal" `input_data.url_path`: "/v1/deals/search" → "/v1/persons/{{node.131.body.person_id}}/deals"
- F5 node 45 "Find person's latest deal" `name`: "Find a deal" → "Find person's latest deal"
- F12 node 60 "Copy - rule" `incoming_nodes`: ["412e6f59-2564-49a9-8535-b7f6e048c848"] → ["128"]
- F12 node 60 "Copy - rule" `outgoing_nodes`: ["75"] → ["129"]
- F12 node 60 "Copy - rule" `rule_satisfied_nodes`: ["75"] → ["129"]
- F12 node 61 "Rule" `incoming_nodes`: ["412e6f59-2564-49a9-8535-b7f6e048c848"] → ["128"]
- F12 node 61 "Rule" `outgoing_nodes`: ["71"] → ["88"]
- F12 node 61 "Rule" `rule_satisfied_nodes`: ["71"] → ["88"]
- F4 node 69 "Copy - Create a person" `(removed node)`: "create_contact" → null
- F4 node 71 "Copy - Copy - Get base url" `(removed node)`: "httprequest" → null
- F4 node 72 "Copy - Copy - Find a person" `(removed node)`: "httprequest" → null
- F4 node 73 "Copy - Person exist?" `(removed node)`: "rule" → null
- F4 node 74 "Copy - Update Person" `(removed node)`: "update_contact" → null
- F4 node 75 "Copy - Copy - Copy - Get base url" `(removed node)`: "httprequest" → null
- F4 node 76 "Copy - Copy - Copy - Find a person" `(removed node)`: "httprequest" → null
- F4 node 77 "Copy - Copy - Person exist?" `(removed node)`: "rule" → null
- F4 node 78 "Copy - Copy - Update Person" `(removed node)`: "update_contact" → null
- F4 node 79 "Copy - Create Deal" `(removed node)`: "create_deal" → null
- F4 node 80 "Copy - Copy - Copy - Copy - Get base url" `(removed node)`: "httprequest" → null
- F4 node 81 "Copy - Copy - Copy - Copy - Find a person" `(removed node)`: "httprequest" → null
- F4 node 82 "Copy - Copy - Copy - Person exist?" `(removed node)`: "rule" → null
- F4 node 83 "Copy - Copy - Copy - Update Person" `(removed node)`: "update_contact" → null
- F4 node 84 "Copy - Create a lead" `(removed node)`: "create_lead" → null
- F11 node 85 "pipedrive" `input_data.body`: "{  \"person_id\": \"{{node.89.body.result.person_id}}\",\"type\":\"email\",\"subject\":\"Email Open Recorded in Saleshandy\",\"note\":\"<p> → "{  \"person_id\": \"{{node.89.body.result.person_id}}\",\"type\":\"email\",\"subject\":\"Email Open Recorded in Saleshandy\",\"note\":\"<p>
- F4 node 87 "Copy - pipedrive" `(removed node)`: "httprequest" → null
- F12 node 88 "Copy - Copy - pipedrive" `additional_node_properties.node_rule`: null → {"operator": "AND", "compare_value_of": [{"data_slot_id": "{{node.128.body.person_id}}", "compare_value": "", "comparison_operator": "exist"
- F12 node 88 "Copy - Copy - pipedrive" `incoming_nodes`: ["74"] → ["61"]
- F11 node 88 "Copy - Copy - pipedrive" `input_data.body`: "{  \"person_id\": \"{{node.90.body.result.person_id}}\",\"type\":\"email\",\"subject\":\"Email Open Recorded in Saleshandy\",\"note\":\"<p> → "{  \"person_id\": \"{{node.128.body.person_id}}\",\"type\":\"email\",\"subject\":\"Email Open Recorded in Saleshandy\",\"note\":\"<p><b>Seq
- F12 node 89 "transform" `query`: "{\"person_id\" : array.item[emails[$contains(\"{{event.body.prospect.email}}\")]].id}" → "{\"person_id\" : (array.item[emails[$contains(\"{{event.body.prospect.email}}\")]].id)[0]}"
- F4 node 90 "Copy - transform" `(removed node)`: "transform" → null
- F5 node 91 "Custom Code" `input_data.code_string`: "/**\n* JS/Javascript\n* Write your Javascript code inside this function and return \n* an object which will be the response of this node. \ → "function yourFunction(params) {\n  // GET /v1/persons/{id}/deals?sort=add_time DESC&limit=1 -> data is [latestDeal] or null.\n  var deals =
- F5 node 91 "Custom Code" `input_data.input_parameters`: [{"#id": 0.4752199048671639, "key": "allDeals", "value": "{{node.45.body.data.items}}"}, {"#id": 0.764766338221617, "key": "requiredDeal", " → [{"key": "allDeals", "value": "{{node.45.body.data}}"}, {"key": "personId", "value": "{{node.131.body.person_id}}"}]
- F5 node 92 "Copy - Custom Code" `input_data.code_string`: "/**\n* JS/Javascript\n* Write your Javascript code inside this function and return \n* an object which will be the response of this node. \ → "function yourFunction(params) {\n  // GET /v1/persons/{id}/deals?sort=add_time DESC&limit=1 -> data is [latestDeal] or null.\n  var deals =
- F5 node 92 "Copy - Custom Code" `input_data.input_parameters`: [{"#id": 0.4752199048671639, "key": "allDeals", "value": "{{node.37.body.data.items}}"}, {"#id": 0.764766338221617, "key": "requiredDeal", " → [{"key": "allDeals", "value": "{{node.37.body.data}}"}, {"key": "personId", "value": "{{node.133.body.person_id}}"}]
- F14 node 95 "Copy - Custom Code" `input_data.input_parameters`: [{"#id": 0.5496100789702163, "key": "allOrganisation", "value": "{{node.41.body.data.items}}"}, {"#id": 0.5416301912154322, "key": "required → [{"#id": 0.5496100789702163, "key": "allOrganisation", "value": "{{node.49.body.data.items}}"}, {"#id": 0.5416301912154322, "key": "required
- F4 node 98 "Saleshandy" `(removed node)`: "6578300bc002b2b9b4f15c37" → null
- F4 node 99 "Functions" `(removed node)`: "internal_functions" → null
- F4 node 100 "Saleshandy" `(removed node)`: "6578300bc002b2b9b4f15c37" → null
- F4 node 101 "Functions" `(removed node)`: "internal_functions" → null
- F4 node 102 "Saleshandy" `(removed node)`: "6578300bc002b2b9b4f15c37" → null
- F4 node 103 "Functions" `(removed node)`: "internal_functions" → null
- F4 node 104 "Functions" `(removed node)`: "internal_functions" → null
- F4 node 105 "Functions" `(removed node)`: "internal_functions" → null
- F11 node 112 "Custom Code" `input_data.code_string`: "function yourFunction(params){\n  function clean(v){\n    if (v === null || v === undefined) return \"\";\n    v = String(v).trim();\n    i → "function yourFunction(params){\n  function clean(v){\n    if (v === null || v === undefined) return \"\";\n    v = String(v).trim();\n    i
- F12 node 112 "Custom Code" `input_data.input_parameters`: [{"key": "firstname", "value": "{{event.body.prospect.firstName}}"}, {"key": "lastname", "value": "{{event.body.prospect.lastName}}"}] → [{"key": "firstname", "value": "{{event.body.prospect.firstName}}"}, {"key": "lastname", "value": "{{event.body.prospect.lastName}}"}, {"key
- F4 node 113 "Custom Code" `(removed node)`: "no_action" → null
- F4 node 114 "Custom Code" `(removed node)`: "no_action" → null
- F4 node 115 "Custom Code" `(removed node)`: "no_action" → null
- F4 node 116 "Custom Code" `(removed node)`: "no_action" → null
- F4 node 117 "Custom Code" `(removed node)`: "no_action" → null
- F4 node 118 "Custom Code" `(removed node)`: "no_action" → null
- F12 node 119 "Person needed?" `(new node)`: null → "rule"
- F4 node 120 "Person - Get base url" `(new node)`: null → "httprequest"
- F4 node 121 "Person - Find a person" `(new node)`: null → "httprequest"
- F4 node 122 "Person - Exact email match" `(new node)`: null → "no_action"
- F4 node 123 "Person - Saleshandy fields" `(new node)`: null → "Get Prospect Fields"
- F4 node 124 "Person - Mapping (Contact Fields)" `(new node)`: null → "internal_functions"
- F4 node 125 "Person - Name" `(new node)`: null → "no_action"
- F4 node 126 "Person - Update person" `(new node)`: null → "update_contact"
- F4 node 127 "Person - Create person" `(new node)`: null → "create_contact"
- F4 node 128 "Person - Resolved id" `(new node)`: null → "no_action"
- F6-F9 node 129 "Deal - Mapping (Deal Fields)" `(new node)`: null → "internal_functions"
- F12 node 130 "Update deal - Find person" `(new node)`: null → "httprequest"
- F12 node 131 "Update deal - Exact email match" `(new node)`: null → "no_action"
- F12 node 132 "Delete deal - Find person" `(new node)`: null → "httprequest"
- F12 node 133 "Delete deal - Exact email match" `(new node)`: null → "no_action"

## To confirm on the first live run
1. `persons/{id}/deals` sort: 2 deals on one person → the newer one is updated/deleted.
2. update_contact returns `body.data.id` (fallback = search id).
3. New prospect with create-lead + create-deal + create-person → exactly 1 person; lead, deal and activity on it.
4. Activity text with quotes / HTML (Email Sent email body) is created.

## Live runs
(none yet)
