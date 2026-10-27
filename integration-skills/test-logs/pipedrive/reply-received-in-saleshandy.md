# Reply is Received in Saleshandy (Saleshandy → Pipedrive)

- v1 = `v1-original.json` (91 nodes, 84 edges, 69 config_fields), byte-identical to `pipedrive old workflows/681368981acc0cbcd16295a0.json`.
- Env folder: staging (to be confirmed).

## v1 → audit (offline, 2026-10-13)
Full write-up: `.lavish/pipedrive-workflows-v2-plan.html`. Fix ids F1–F12 are defined there and in `../../patches-shared/v2_fixes.py`.

## v2 — `v2-fixes.json` (patch `../../patches-shared/v2_fixes.py`, change list `v2-changes.json`) — approved 2026-10-13
91 → 80 nodes, 84 → 73 edges; config_fields unchanged.
User decisions: shared person step; update/delete-deal = person's latest deal (create-deal/create-lead still create every time); missing Deal/Org mappings added; Email Sent data_mapper → Mapping Function; hosts kept; no new links/activities.

- F12 node 412e6f59-2564-49a9-8535-b7f6e048c848 "Start" `outgoing_nodes`: ["3", "8", "60", "61", "63", "64", "65", "62", "66", "67", "68"] → ["8", "63", "64", "65", "62", "66", "67", "68", "122"]
- F12 node 3 "rule" `incoming_nodes`: ["412e6f59-2564-49a9-8535-b7f6e048c848"] → ["131"]
- F12 node 3 "rule" `outgoing_nodes`: ["116"] → ["31"]
- F12 node 3 "rule" `rule_satisfied_nodes`: ["116"] → ["31"]
- F12 node 17 "Create Deal" `additional_node_properties.node_rule`: {"operator": "AND", "compare_value_of": []} → {"operator": "AND", "compare_value_of": [{"data_slot_id": "{{node.131.body.person_id}}", "compare_value": "", "comparison_operator": "exist"
- F12 node 17 "Create Deal" `incoming_nodes`: ["69"] → ["132"]
- F6-F9 node 17 "Create Deal" `input_data.custom_fields`: "" → "{{node.132.body}}"
- F4 node 17 "Create Deal" `input_data.person_id`: "{{node.69.body.data.id}}" → "{{node.131.body.person_id}}"
- F12 node 17 "Create Deal" `input_data.title`: "{{node.117.body.contact_name}}" → "{{node.128.body.contact_name}}"
- F10 node 21 "Update Person" `input_data.email`: "[{\"value\": \" {{event.body.prospect.email}} \", \"primary\": \"true\", \"label\": \"main\"}]" → "[{\"value\": \"{{event.body.prospect.email}}\", \"primary\": \"true\", \"label\": \"main\"}]"
- F1 node 21 "Update Person" `input_data.id`: "{{node.89.body.person_id}}" → "{{node.89.body.result.person_id}}"
- F12 node 25 "pipedrive" `incoming_nodes`: ["67"] → ["138"]
- F6-F9 node 25 "pipedrive" `input_data.custom_fields`: "" → "{{node.138.body}}"
- F4 node 30 "Create a person" `(removed node)`: "create_contact" → null
- F12 node 31 "Create a lead" `additional_node_properties.node_rule`: {"operator": "AND", "compare_value_of": []} → {"operator": "AND", "compare_value_of": [{"data_slot_id": "{{node.131.body.person_id}}", "compare_value": "", "comparison_operator": "exist"
- F12 node 31 "Create a lead" `incoming_nodes`: ["30"] → ["3"]
- F4 node 31 "Create a lead" `input_data.person_id`: "{{node.30.body.data.id}}" → "{{node.131.body.person_id}}"
- F12 node 31 "Create a lead" `input_data.title`: "{{node.116.body.contact_name}}" → "{{node.128.body.contact_name}}"
- F4 node 33 "Create a person" `(removed node)`: "create_contact" → null
- F5 node 37 "Find person's latest deal" `additional_node_properties.node_rule`: {"operator": "AND", "compare_value_of": []} → {"operator": "AND", "compare_value_of": [{"data_slot_id": "{{node.136.body.person_id}}", "compare_value": "", "comparison_operator": "exist"
- F5 node 37 "Find person's latest deal" `incoming_nodes`: ["121"] → ["136"]
- F5 node 37 "Find person's latest deal" `input_data.query_params`: {"term": "{{node.121.body.contact_name}}", "fields": "title", "exact_match": "true"} → {"sort": "add_time DESC", "limit": "1"}
- F5 node 37 "Find person's latest deal" `input_data.query_string`: "{\"term\": \"{{event.body.payload.prospect.email}}\",\"fields\":[\"title\"],\"exact_match\": true}" → null
- F5 node 37 "Find person's latest deal" `input_data.url_path`: "/v1/deals/search" → "/v1/persons/{{node.136.body.person_id}}/deals"
- F5 node 37 "Find person's latest deal" `name`: "Find a deal" → "Find person's latest deal"
- F1 node 59 "Person exist?" `input_data.compare_value_of`: [{"data_slot_id": "{{node.89.body.person_id}}", "compare_value": "", "comparison_operator": "exist"}] → [{"data_slot_id": "{{node.89.body.result.person_id}}", "compare_value": "", "comparison_operator": "exist"}]
- F12 node 60 "Copy - rule" `incoming_nodes`: ["412e6f59-2564-49a9-8535-b7f6e048c848"] → ["131"]
- F12 node 60 "Copy - rule" `outgoing_nodes`: ["117"] → ["132"]
- F12 node 60 "Copy - rule" `rule_satisfied_nodes`: ["117"] → ["132"]
- F12 node 61 "Rule" `incoming_nodes`: ["412e6f59-2564-49a9-8535-b7f6e048c848"] → ["131"]
- F12 node 61 "Rule" `outgoing_nodes`: ["118"] → ["88"]
- F12 node 61 "Rule" `rule_satisfied_nodes`: ["118"] → ["88"]
- F12 node 67 "Copy - Copy - Rule" `outgoing_nodes`: ["25"] → ["137"]
- F12 node 67 "Copy - Copy - Rule" `rule_satisfied_nodes`: ["25"] → ["137"]
- F4 node 69 "Copy - Create a person" `(removed node)`: "create_contact" → null
- F4 node 71 "Copy - Copy - Get base url" `(removed node)`: "httprequest" → null
- F4 node 72 "Copy - Copy - Find a person" `(removed node)`: "httprequest" → null
- F4 node 73 "Copy - Person exist?" `(removed node)`: "rule" → null
- F4 node 74 "Copy - Update Person" `(removed node)`: "update_contact" → null
- F4 node 75 "Copy - Copy - Copy - Get base url" `(removed node)`: "httprequest" → null
- F4 node 77 "Copy - Copy - Person exist?" `(removed node)`: "rule" → null
- F4 node 78 "Copy - Copy - Update Person" `(removed node)`: "update_contact" → null
- F4 node 79 "Copy - Create Deal" `(removed node)`: "create_deal" → null
- F4 node 80 "Copy - Copy - Copy - Copy - Get base url" `(removed node)`: "httprequest" → null
- F4 node 82 "Copy - Copy - Copy - Person exist?" `(removed node)`: "rule" → null
- F4 node 83 "Update Person" `(removed node)`: "update_contact" → null
- F1+F11 node 85 "pipedrive" `input_data.body`: "{  \"person_id\": \"{{node.89.body.person_id}}\",\"type\":\"Email\",\"subject\": \"Reply is Received in Saleshandy\",\"note\":\"<p><b>Seque → "{  \"person_id\": \"{{node.89.body.result.person_id}}\",\"type\":\"Email\",\"subject\": \"Reply is Received in Saleshandy\",\"note\":\"<p><
- F4 node 87 "Log Activity" `(removed node)`: "httprequest" → null
- F12 node 88 "Copy - Log Activity" `additional_node_properties.node_rule`: {"operator": "AND", "compare_value_of": []} → {"operator": "AND", "compare_value_of": [{"data_slot_id": "{{node.131.body.person_id}}", "compare_value": "", "comparison_operator": "exist"
- F12 node 88 "Copy - Log Activity" `incoming_nodes`: ["74"] → ["61"]
- F11 node 88 "Copy - Log Activity" `input_data.body`: "{  \"person_id\": \"{{node.90.body.person_id}}\",\"type\":\"Email\",\"subject\": \"Reply is Received in Saleshandy\",\"note\":\"<p><b>Seque → "{  \"person_id\": \"{{node.131.body.person_id}}\",\"type\":\"Email\",\"subject\": \"Reply is Received in Saleshandy\",\"note\":\"<p><b>Sequ
- F12 node 89 "transform" `input_data.query`: "{\"person_id\" : array.item[emails[$contains(\"{{event.body.prospect.email}}\")]].id}" → "{\"person_id\" : (array.item[emails[$contains(\"{{event.body.prospect.email}}\")]].id)[0]}"
- F12 node 89 "transform" `query`: "{\"person_id\" : array.item[emails[$contains(\"{{event.body.payload.prospect.email}}\")]].id}" → "{\"person_id\" : (array.item[emails[$contains(\"{{event.body.prospect.email}}\")]].id)[0]}"
- F4 node 90 "Copy - transform" `(removed node)`: "transform" → null
- F5 node 92 "Custom Code" `input_data.code_string`: "/**\n* JS/Javascript\n* Write your Javascript code inside this function and return \n* an object which will be the response of this node. \ → "function yourFunction(params) {\n  // GET /v1/persons/{id}/deals?sort=add_time DESC&limit=1 -> data is [latestDeal] or null.\n  var deals =
- F5 node 92 "Custom Code" `input_data.input_parameters`: [{"#id": 0.648908400503571, "key": "allDeals", "value": "{{node.103.body.data.items}}"}, {"#id": 0.11509210094293398, "key": "requiredDeal", → [{"key": "allDeals", "value": "{{node.103.body.data}}"}, {"key": "personId", "value": "{{node.134.body.person_id}}"}]
- F5 node 93 "Custom Code" `input_data.code_string`: "/**\n* JS/Javascript\n* Write your Javascript code inside this function and return \n* an object which will be the response of this node. \ → "function yourFunction(params) {\n  // GET /v1/persons/{id}/deals?sort=add_time DESC&limit=1 -> data is [latestDeal] or null.\n  var deals =
- F5 node 93 "Custom Code" `input_data.input_parameters`: [{"#id": 0.3900853077144788, "key": "allDeals", "value": "{{node.37.body.data.items}}"}, {"#id": 0.17921285430559575, "key": "requiredDeal", → [{"key": "allDeals", "value": "{{node.37.body.data}}"}, {"key": "personId", "value": "{{node.136.body.person_id}}"}]
- F4 node 98 "Find a person" `(removed node)`: "httprequest" → null
- F4 node 99 "Copy - Find a person" `(removed node)`: "httprequest" → null
- F4 node 101 "Pipedrive" `(removed node)`: "create_lead" → null
- F5 node 103 "Find person's latest deal" `additional_node_properties.node_rule`: {"operator": "AND", "compare_value_of": []} → {"operator": "AND", "compare_value_of": [{"data_slot_id": "{{node.134.body.person_id}}", "compare_value": "", "comparison_operator": "exist"
- F5 node 103 "Find person's latest deal" `incoming_nodes`: ["120"] → ["134"]
- F5 node 103 "Find person's latest deal" `input_data.query_params`: {"term": "{{node.120.body.contact_name}}", "fields": "title", "exact_match": "true"} → {"sort": "add_time DESC", "limit": "1"}
- F5 node 103 "Find person's latest deal" `input_data.url_path`: "/v1/deals/search" → "/v1/persons/{{node.134.body.person_id}}/deals"
- F5 node 103 "Find person's latest deal" `name`: "Find a Deal" → "Find person's latest deal"
- F4 node 108 "Saleshandy" `(removed node)`: "6578300bc002b2b9b4f15c37" → null
- F4 node 109 "Functions" `(removed node)`: "internal_functions" → null
- F4 node 110 "Saleshandy" `(removed node)`: "6578300bc002b2b9b4f15c37" → null
- F4 node 111 "Functions" `(removed node)`: "internal_functions" → null
- F4 node 112 "Saleshandy" `(removed node)`: "6578300bc002b2b9b4f15c37" → null
- F4 node 113 "Functions" `(removed node)`: "internal_functions" → null
- F4 node 116 "Custom Code" `(removed node)`: "codeexecutornode" → null
- F4 node 117 "Copy - Custom Code" `(removed node)`: "codeexecutornode" → null
- F4 node 118 "Copy - Copy - Custom Code" `(removed node)`: "codeexecutornode" → null
- F11 node 119 "Copy - Copy - Copy - Custom Code" `input_data.code_string`: "function yourFunction(params){\n  function clean(v){\n    if (v === null || v === undefined) return \"\";\n    v = String(v).trim();\n    i → "function yourFunction(params){\n  function clean(v){\n    if (v === null || v === undefined) return \"\";\n    v = String(v).trim();\n    i
- F12 node 119 "Copy - Copy - Copy - Custom Code" `input_data.input_parameters`: [{"key": "firstname", "value": "{{event.body.prospect.firstName}}"}, {"key": "lastname", "value": "{{event.body.prospect.lastName}}"}] → [{"key": "firstname", "value": "{{event.body.prospect.firstName}}"}, {"key": "lastname", "value": "{{event.body.prospect.lastName}}"}, {"key
- F12 node 120 "Custom Code" `outgoing_nodes`: ["103"] → ["133"]
- F12 node 121 "Custom Code" `outgoing_nodes`: ["37"] → ["135"]
- F12 node 122 "Person needed?" `(new node)`: null → "rule"
- F4 node 123 "Person - Get base url" `(new node)`: null → "httprequest"
- F4 node 124 "Person - Find a person" `(new node)`: null → "httprequest"
- F4 node 125 "Person - Exact email match" `(new node)`: null → "no_action"
- F4 node 126 "Person - Saleshandy fields" `(new node)`: null → "Get Prospect Fields"
- F4 node 127 "Person - Mapping (Contact Fields)" `(new node)`: null → "internal_functions"
- F4 node 128 "Person - Name" `(new node)`: null → "codeexecutornode"
- F4 node 129 "Person - Update person" `(new node)`: null → "update_contact"
- F4 node 130 "Person - Create person" `(new node)`: null → "create_contact"
- F4 node 131 "Person - Resolved id" `(new node)`: null → "no_action"
- F6-F9 node 132 "Deal - Mapping (Deal Fields)" `(new node)`: null → "internal_functions"
- F12 node 133 "Update deal - Find person" `(new node)`: null → "httprequest"
- F12 node 134 "Update deal - Exact email match" `(new node)`: null → "no_action"
- F12 node 135 "Delete deal - Find person" `(new node)`: null → "httprequest"
- F12 node 136 "Delete deal - Exact email match" `(new node)`: null → "no_action"
- F6-F9 node 137 "Create org - Saleshandy fields" `(new node)`: null → "Get Prospect Fields"
- F6-F9 node 138 "Create org - Mapping (Organisation Fields)" `(new node)`: null → "internal_functions"

## To confirm on the first live run
1. `persons/{id}/deals` sort: 2 deals on one person → the newer one is updated/deleted.
2. update_contact returns `body.data.id` (fallback = search id).
3. New prospect with create-lead + create-deal + create-person → exactly 1 person; lead, deal and activity on it.
4. Activity text with quotes / HTML (Email Sent email body) is created.

## Live runs
(none yet)
