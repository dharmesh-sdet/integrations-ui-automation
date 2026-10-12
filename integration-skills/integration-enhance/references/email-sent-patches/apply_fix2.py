"""Round 2: update-company finds the company via the contact's associated companies (first one),
instead of searching companies by the (possibly new) name. Usage: apply_fix2.py <in.json> <out.json>"""
import copy, json, re, sys

src, dst = sys.argv[1], sys.argv[2]
orig = json.load(open(src))
wf = copy.deepcopy(orig)
N = {n['id']: n for n in wf['nodes']}
for i in ('9', '95', '15', '12', '10', '110', '111', '112', '113'): assert i in N, i
# nothing but 12 and 10 may read nodes 9/95, otherwise removing them would break something
readers = {n['id'] for n in wf['nodes'] if re.search(r'node\.(9|95)\.', json.dumps(n.get('input_data', {})))}
assert readers - {'95'} == {'12', '10'}, readers  # 95 reads 9, both removed

def clone(base, nid, name, pos, inc, out):
    n = copy.deepcopy(N[base]); n.update(id=nid, name=name, position=pos, incoming_nodes=inc, outgoing_nodes=out)
    return n
p9, p95 = N['9']['position'], N['95']['position']

s = clone('110', '153', 'Search Contact by Email (update company)', dict(p9), ['15'], ['154'])          # search_contacts
r = clone('111', '154', 'Contact Exists? (update company)', {'x': p9['x'], 'y': p9['y'] + 80}, ['153'], ['155'])
r['input_data']['compare_value_of'][0]['data_slot_id'] = '{{node.153.body.results.0.id}}'
r['input_data']['compare_value_of'][1]['data_slot_id'] = '{{node.153.body.results.0.properties.email}}'
r['rule_satisfied_nodes'], r['rule_failed_nodes'] = ['155'], []
g = clone('112', '155', 'Get Companies Associated with Contact', {'x': p95['x'], 'y': p95['y'] - 40}, ['154'], ['156'])
g['input_data']['url_path'] = '/crm/v4/objects/contacts/{{node.153.body.results.0.id}}/associations/companies'
t = clone('113', '156', 'Get Company ID', {'x': p95['x'], 'y': p95['y'] + 90}, ['155'], ['12'])
t['input_data'] = {'input': '{"allCompanies": "{{node.155.body}}"}',
                   'query': '{"companyID": allCompanies.results[0].toObjectId}'}

# rewire: 15 -> 153 -> 154 -(true)-> 155 -> 156 -> 12 ; drop 9 and 95
swap = lambda l, a, b: l.__setitem__(l.index(a), b)
swap(N['15']['outgoing_nodes'], '9', '153'); swap(N['15']['rule_satisfied_nodes'], '9', '153')
swap(N['12']['incoming_nodes'], '95', '156')
N['12']['input_data']['compare_value_of'][0]['data_slot_id'] = '{{node.156.body.result.companyID}}'
N['10']['input_data']['companyId'] = '{{node.156.body.result.companyID}}'
E = wf['edges']
e15 = [e for e in E if e['source'] == '15' and e['target'] == '9']; assert len(e15) == 1; e15[0]['target'] = '153'
e12 = [e for e in E if e['source'] == '95' and e['target'] == '12']; assert len(e12) == 1; e12[0]['source'] = '156'
wf['edges'] = [e for e in E if not (e['source'] == '9' and e['target'] == '95')]
wf['edges'] += [
    {'source': '153', 'target': '154', 'sourceHandle': None, 'targetHandle': None, 'type': 'smoothstep', 'id': 'n153-n154-edge'},
    {'source': '154', 'target': '155', 'sourceHandle': 'true', 'targetHandle': None, 'type': 'smoothstep', 'data': {'label': 'is true'}, 'id': 'n154-n155-edge'},
    {'source': '155', 'target': '156', 'sourceHandle': None, 'targetHandle': None, 'type': 'smoothstep', 'id': 'n155-n156-edge'},
]
wf['nodes'] = [n for n in wf['nodes'] if n['id'] not in ('9', '95')] + [s, r, g, t]
N = {n['id']: n for n in wf['nodes']}

# ================= verification =================
O = {n['id']: n for n in orig['nodes']}
assert len(wf['nodes']) == len(orig['nodes']) + 2 and len(wf['edges']) == len(orig['edges']) + 2
assert {k: v for k, v in wf.items() if k not in ('nodes', 'edges')} == {k: v for k, v in orig.items() if k not in ('nodes', 'edges')}
changed = {i for i in O if i in N and O[i] != N[i]}
assert changed == {'15', '12', '10'}, changed
dk = lambda a, b: {k for k in set(a) | set(b) if a.get(k) != b.get(k)}
assert dk(O['15'], N['15']) == {'outgoing_nodes', 'rule_satisfied_nodes'}
assert dk(O['12'], N['12']) == {'incoming_nodes', 'input_data'}
assert dk(O['10'], N['10']) == {'input_data'} and dk(O['10']['input_data'], N['10']['input_data']) == {'companyId'}
pairs = {(e['source'], e['target']) for e in wf['edges']}
assert len(pairs) == len(wf['edges']) and len({e['id'] for e in wf['edges']}) == len(wf['edges'])
for n in wf['nodes']:
    for o in n['outgoing_nodes']: assert (n['id'], o) in pairs, (n['id'], o)
    for i in n['incoming_nodes']: assert (i, n['id']) in pairs, (i, n['id'])
    for k in ('rule_satisfied_nodes', 'rule_failed_nodes'):
        for o in n.get(k, []): assert o in n['outgoing_nodes'], (n['id'], k, o)
for a, b in pairs: assert a in N and b in N and b in N[a]['outgoing_nodes'] and a in N[b]['incoming_nodes'], (a, b)
def anc(i, seen=None):
    seen = set() if seen is None else seen
    for p in N[i]['incoming_nodes']:
        if p not in seen: seen.add(p); anc(p, seen)
    return seen
for n in wf['nodes']:  # whole graph: every node reference must point to an upstream node that exists
    for ref in set(re.findall(r'node\.(\d+)\.', json.dumps(n.get('input_data', {})))):
        assert ref in anc(n['id']), (n['id'], ref)
json.dump(wf, open(dst, 'w'), indent=2, ensure_ascii=False)
print('OK', src, '->', dst, '| nodes', len(orig['nodes']), '->', len(wf['nodes']), '| edges', len(orig['edges']), '->', len(wf['edges']))
