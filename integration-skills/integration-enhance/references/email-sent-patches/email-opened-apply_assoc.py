"""Email Opened: link created deal/company to the contact (catalog #35) + contact on their notes/logs (#39).
Usage: python3 apply_assoc.py <in.json> <out.json>"""
import copy, json, re, sys

src, dst = sys.argv[1], sys.argv[2]
orig = json.load(open(src))
wf = copy.deepcopy(orig)
N = {n['id']: n for n in wf['nodes']}
O = {n['id']: n for n in orig['nodes']}
E = wf['edges']
EMAIL = '{{event.body.prospect.email}}'

def clone(base, nid, name, pos):
    n = copy.deepcopy(O[base]); n.update(id=nid, name=name, position=pos, incoming_nodes=[], outgoing_nodes=[])
    for k in ('rule_satisfied_nodes', 'rule_failed_nodes'):
        if k in n: n[k] = []
    wf['nodes'].append(n); N[nid] = n; return n

def link(a, b, handle=None):
    N[a]['outgoing_nodes'].append(b); N[b]['incoming_nodes'].append(a)
    if handle == 'true': N[a]['rule_satisfied_nodes'].append(b)
    if handle == 'false': N[a]['rule_failed_nodes'].append(b)
    E.append({'source': a, 'target': b, 'sourceHandle': handle, 'targetHandle': None, 'type': 'smoothstep', 'id': 'n%s-n%s-edge' % (a, b)})

def retarget(a, b, new):
    """keep the existing a->b edge (id, handle) but point it at `new`"""
    es = [e for e in E if e['source'] == a and e['target'] == b]; assert len(es) == 1, (a, b)
    es[0]['target'] = new
    for k in ('outgoing_nodes', 'rule_satisfied_nodes', 'rule_failed_nodes'):
        if b in N[a].get(k, []): N[a][k][N[a][k].index(b)] = new
    N[b]['incoming_nodes'].remove(a); N[new]['incoming_nodes'].append(a)

KEEP = '$keep := function($o){ $type($o) = "object" ? $sift($o, function($v){ $v != null and $v != "" }) : {} };'
def body_query(keys, assoc):
    fixed = ', '.join('"%s": %s' % (k, k) for k in keys)
    return ('(\n  ' + KEEP + '\n  $fixed := $keep({' + fixed + '});\n  {\n'
            '    "properties": $merge([$keep(mapped), $fixed]),\n'
            '    "associations": [{"to": {"id": $string(contactId)}, "types": [{"associationCategory": "HUBSPOT_DEFINED", "associationTypeId": '
            + str(assoc) + '}]}]\n  }\n)')
DEAL_KEYS = ['closedate', 'dealname', 'pipeline', 'dealstage', 'dealtype', 'hs_priority']
def deal_body(nid, name, pos, contact_tpl):
    t = clone('55', nid, name, pos); t['additional_node_properties']['node_rule']['compare_value_of'] = []
    t['input_data'] = {'input': json.dumps({
        'mapped': '{{node.93.body}}', 'contactId': contact_tpl,
        'closedate': '{{node.55.body.result.due_date}}',
        'dealname': EMAIL,  # kept: update-deal (node 22) finds deals by dealname == email
        'pipeline': '{{workflow.fields.Select Pipeline (when to create)}}',
        'dealstage': '{{workflow.fields.Select Pipeline Stage (when to create)}}',
        'dealtype': '{{workflow.fields.Deal Type (while creating)}}',
        'hs_priority': '{{workflow.fields.Deal Priority (while creating)}}'}, ensure_ascii=False),
        'query': body_query(DEAL_KEYS, 3)}
    return t
def company_body(nid, name, pos, contact_tpl):
    t = clone('55', nid, name, pos); t['additional_node_properties']['node_rule']['compare_value_of'] = []
    t['input_data'] = {'input': json.dumps({
        'mapped': '{{node.119.body}}', 'contactId': contact_tpl,
        'name': '{{event.body.prospect.company}}', 'domain': '{{event.body.prospect.companyDomain}}'}, ensure_ascii=False),
        'query': body_query(['name', 'domain'], 280)}
    return t
def raw_create(n, path, body_node):
    n['action'] = 'httprequest'; n['optional_fields'] = []
    n['input_data'] = {'method': 'POST', 'url_path': path, 'body': '{{node.%s.body.result}}' % body_node}
def search(nid, pos):
    s = clone('81', nid, 'Search Contact by Email', pos); s['input_data']['value'] = EMAIL; return s
def exists_rule(nid, pos, search_id):
    r = clone('83', nid, 'Contact Exists?', pos)
    r['input_data'] = {'operator': 'AND', 'compare_value_of': [
        {'data_slot_id': '{{node.%s.body.results.0.id}}' % search_id, 'compare_value': '', 'comparison_operator': 'exist'},
        {'data_slot_id': '{{node.%s.body.results.0.properties.email}}' % search_id, 'compare_value': EMAIL, 'comparison_operator': 'eq'}]}
    return r
def contact_chain(ids, x, y0, sh_node):
    m, s, c = ids
    mm = clone('101', m, 'Functions', {'x': x, 'y': y0}); mm['input_data']['shFields'] = '{{node.%s.body.payload}}' % sh_node
    ss = clone('105', s, 'Strip read-only hs_email_domain', {'x': x, 'y': y0 + 110}); ss['input_data']['input'] = '{"additionalFields": "{{node.%s.body}}"}' % m
    cc = clone('85', c, 'Create Contact', {'x': x, 'y': y0 + 220}); cc['input_data']['additional_fields'] = '{{node.%s.body.result}}' % s
    link(m, s); link(s, c)
def set_contact(nid, tpl):
    assert N[nid]['input_data'].get('contact_id') == '', nid
    N[nid]['input_data']['contact_id'] = tpl; N[nid]['optional_fields'] = ['contact_id']

# ================= create-deal branch =================
# 2 -> 55 -> 92 -> 93 -> [106 search -> 107 exists?] -T-> 108 body -> 3 (raw POST)          -> 51/52 -> 53/54
#                                                   -F-> 109 map -> 110 strip -> 111 contact -> 112 body -> 113 POST -> 114/115 -> 116/117
p3 = O['3']['position']
search('106', {'x': p3['x'] - 160, 'y': p3['y'] - 60}); exists_rule('107', {'x': p3['x'] - 160, 'y': p3['y'] + 20}, '106')
retarget('93', '3', '106'); link('106', '107')
deal_body('108', 'Build deal body (existing contact)', {'x': p3['x'], 'y': p3['y'] + 90}, '{{node.106.body.results.0.id}}')
link('107', '108', 'true')
N['3']['incoming_nodes'] = []; link('108', '3')
raw_create(N['3'], '/crm/v3/objects/deals', '108')
contact_chain(('109', '110', '111'), -1000, 900, '92'); link('107', '109', 'false')
deal_body('112', 'Build deal body (new contact)', {'x': -1000, 'y': 1230}, '{{node.111.body.id}}'); link('111', '112')
d2 = clone('3', '113', 'Create Deal (new contact)', {'x': -1000, 'y': 1340});
link('112', '113')
raw_create(N['113'], '/crm/v3/objects/deals', '112')
clone('51', '114', 'Create Note', {'x': -1150, 'y': 1460}); clone('52', '115', 'Log email', {'x': -880, 'y': 1460})
link('113', '114'); link('113', '115')
n116 = clone('53', '116', 'Create Note', {'x': -1150, 'y': 1570}); n117 = clone('54', '117', 'Log email', {'x': -880, 'y': 1570})
link('114', '116', 'true'); link('115', '117', 'true')
for n in (n116, n117): n['input_data']['deal_id'] = '{{node.113.body.id}}'
set_contact('116', '{{node.111.body.id}}'); set_contact('117', '{{node.111.body.id}}')
set_contact('53', '{{node.106.body.results.0.id}}'); set_contact('54', '{{node.106.body.results.0.id}}')

# ================= create-company branch =================
# 14 -> 118 fields -> 119 map company -> 120 search -> 121 exists? -T-> 122 body -> 7 (raw POST)          -> 56/57 -> 58/59
#                                                                -F-> 123 map -> 124 strip -> 125 contact -> 126 body -> 127 POST -> 128/129 -> 130/131
p7 = O['7']['position']
f = clone('92', '118', 'Saleshandy', {'x': p7['x'] - 180, 'y': p7['y'] - 200})
m = clone('93', '119', 'Functions', {'x': p7['x'] - 180, 'y': p7['y'] - 120})
m['input_data']['shFields'] = '{{node.118.body.payload}}'; m['input_data']['fieldMapping'] = '{{application.fields.Company Properties}}'
search('120', {'x': p7['x'] - 180, 'y': p7['y'] - 40}); exists_rule('121', {'x': p7['x'] - 180, 'y': p7['y'] + 40}, '120')
retarget('14', '7', '118'); link('118', '119'); link('119', '120'); link('120', '121')
company_body('122', 'Build company body (existing contact)', {'x': p7['x'], 'y': p7['y'] + 110}, '{{node.120.body.results.0.id}}')
link('121', '122', 'true'); N['7']['incoming_nodes'] = []; link('122', '7')
raw_create(N['7'], '/crm/v3/objects/companies', '122')
contact_chain(('123', '124', '125'), 150, 2300, '118'); link('121', '123', 'false')
company_body('126', 'Build company body (new contact)', {'x': 150, 'y': 2630}, '{{node.125.body.id}}'); link('125', '126')
c2 = clone('7', '127', 'Create Company (new contact)', {'x': 150, 'y': 2740}); raw_create(c2, '/crm/v3/objects/companies', '126'); link('126', '127')
clone('56', '128', 'Create Note', {'x': 0, 'y': 2860}); clone('57', '129', 'Log email', {'x': 300, 'y': 2860})
link('127', '128'); link('127', '129')
n130 = clone('58', '130', 'Create Note', {'x': 0, 'y': 2970}); n131 = clone('59', '131', 'Log email', {'x': 300, 'y': 2970})
link('128', '130', 'true'); link('129', '131', 'true')
for n in (n130, n131): n['input_data']['company_id'] = '{{node.127.body.id}}'
set_contact('130', '{{node.125.body.id}}'); set_contact('131', '{{node.125.body.id}}')
set_contact('58', '{{node.120.body.results.0.id}}'); set_contact('59', '{{node.120.body.results.0.id}}')

# ================= verification =================
NEW = {str(i) for i in range(106, 132)}
assert set(N) - set(O) == NEW, sorted(set(N) - set(O))
assert len(wf['nodes']) == len(orig['nodes']) + 26
assert {k: v for k, v in wf.items() if k not in ('nodes', 'edges')} == {k: v for k, v in orig.items() if k not in ('nodes', 'edges')}
assert [n['id'] for n in wf['nodes'][:len(orig['nodes'])]] == [n['id'] for n in orig['nodes']]
dk = lambda a, b: {k for k in set(a) | set(b) if a.get(k) != b.get(k)}
changed = {i: dk(O[i], N[i]) for i in O if O[i] != N[i]}
expect = {'93': {'outgoing_nodes'}, '14': {'outgoing_nodes', 'rule_satisfied_nodes'},
          '3': {'incoming_nodes', 'input_data', 'action', 'optional_fields'},
          '7': {'incoming_nodes', 'input_data', 'action'},
          '53': {'input_data', 'optional_fields'}, '54': {'input_data', 'optional_fields'},
          '58': {'input_data', 'optional_fields'}, '59': {'input_data', 'optional_fields'}}
assert changed == expect, {i: (changed.get(i), expect.get(i)) for i in set(changed) | set(expect) if changed.get(i) != expect.get(i)}
for i in ('53', '54', '58', '59'): assert dk(O[i]['input_data'], N[i]['input_data']) == {'contact_id'}
pairs = {(e['source'], e['target']) for e in E}
assert len(pairs) == len(E) and len({e['id'] for e in E}) == len(E)
for n in wf['nodes']:
    for o in n['outgoing_nodes']: assert (n['id'], o) in pairs, (n['id'], o)
    for p in n['incoming_nodes']: assert (p, n['id']) in pairs, (p, n['id'])
    for k in ('rule_satisfied_nodes', 'rule_failed_nodes'):
        for o in n.get(k, []): assert o in n['outgoing_nodes'], (n['id'], k, o)
    if n['type'] == 'rule':
        assert set(n.get('rule_satisfied_nodes', [])) | set(n.get('rule_failed_nodes', [])) == set(n['outgoing_nodes']), n['id']
    assert len(n['incoming_nodes']) <= 1, (n['id'], n['incoming_nodes'])
for e in E:
    s = N[e['source']]
    if s['type'] == 'rule':
        assert (e['sourceHandle'] == 'true') == (e['target'] in s['rule_satisfied_nodes']), e
        assert (e['sourceHandle'] == 'false') == (e['target'] in s['rule_failed_nodes']), e
    else: assert e['sourceHandle'] is None, e
def anc(i):
    seen, q = set(), list(N[i]['incoming_nodes'])
    while q:
        p = q.pop()
        if p not in seen: seen.add(p); q += N[p]['incoming_nodes']
    return seen
cf = {c['name'] for c in wf['config_fields']}
for n in wf['nodes']:
    s = json.dumps({k: n.get(k) for k in ('input_data', 'additional_node_properties')})
    for r, path in re.findall(r'\{\{node\.(\d+)\.body\.?([^}]*)\}\}', s):
        assert r in anc(n['id']), (n['id'], r)
        t = N[r]
        ok = {'transform': path.startswith('result'), 'custom': path == 'payload', 'internal_functions': path == ''}.get(t['type'])
        if t['type'] == 'hubspot': ok = path.startswith('results') if t['action'] in ('search_contacts',) or (t['action'] == 'httprequest' and 'search' in t['input_data'].get('url_path', '')) else path == 'id'
        if t['type'] == 'codeexecutornode': ok = path.startswith('result')
        assert ok, (n['id'], r, path)
    for fld in re.findall(r'workflow\.fields\.([^}]+)\}\}', s): assert fld in cf, (n['id'], fld)
# every create_deal/create_company is gone (they cannot associate)
assert not [n['id'] for n in wf['nodes'] if n.get('action') in ('create_deal', 'create_company')]
seen, st = set(), ['ee33b6fe-e74e-44ef-8518-9ed93b6122ec']
while st:
    x = st.pop()
    if x not in seen: seen.add(x); st += N[x]['outgoing_nodes']
assert seen == set(N), set(N) - seen

json.dump(wf, open(dst, 'w'), indent=2, ensure_ascii=False)
json.dump({i: N[i]['input_data'] for i in ('108', '112', '122', '126', '110', '124')}, open(dst + '.queries.json', 'w'), indent=1, ensure_ascii=False)
print('OK nodes', len(orig['nodes']), '->', len(wf['nodes']), '| edges', len(orig['edges']), '->', len(E), '| changed', sorted(changed, key=int))
