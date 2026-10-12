"""Round-1 fixes for "Email Sent from Saleshandy". Usage: python3 apply_fix.py <in.json> <out.json>"""
import copy, json, re, sys

src, dst = sys.argv[1], sys.argv[2]
orig = json.load(open(src))
wf = copy.deepcopy(orig)
N = {n['id']: n for n in wf['nodes']}

def swap(lst, old, new):
    assert old in lst, (old, lst)
    lst[lst.index(old)] = new

def near(nid, dx, dy):
    p = N[nid]['position']
    return {'x': p['x'] + dx, 'y': p['y'] + dy}

def new_transform(nid, name, pos, input_obj_str, query):
    n = copy.deepcopy(N['126'])  # existing transform, same shape/defaults
    n.update(id=nid, name=name, position=pos, incoming_nodes=[], outgoing_nodes=[])
    n['input_data'] = {'input': input_obj_str, 'query': query}
    return n

def insert_between(a, b, new, edge_id):
    """a -> b  becomes  a -> new -> b. Keeps the a->x edge (id, handle, label), retargets it."""
    A, B = N[a], N[b]
    swap(A['outgoing_nodes'], b, new['id'])
    if b in A.get('rule_satisfied_nodes', []): swap(A['rule_satisfied_nodes'], b, new['id'])
    if b in A.get('rule_failed_nodes', []): swap(A['rule_failed_nodes'], b, new['id'])
    swap(B['incoming_nodes'], a, new['id'])
    new['incoming_nodes'], new['outgoing_nodes'] = [a], [b]
    edges = [e for e in wf['edges'] if e['source'] == a and e['target'] == b]
    assert len(edges) == 1, (a, b, edges)
    edges[0]['target'] = new['id']
    wf['edges'].append({'source': new['id'], 'target': b, 'sourceHandle': None, 'targetHandle': None,
                        'type': 'smoothstep', 'id': edge_id})
    wf['nodes'].append(new)
    N[new['id']] = new

KEEP = '$keep := function($o){ $type($o) = "object" ? $sift($o, function($v){ $v != null and $v != "" }) : {} };'
def body_query(fixed_keys, assoc_type):
    fixed = ', '.join(f'"{k}": {k}' for k in fixed_keys)
    return ('(\n  ' + KEEP + '\n  $fixed := $keep({' + fixed + '});\n  {\n'
            '    "properties": $merge([$keep(mapped), $fixed]),\n'
            '    "associations": [{"to": {"id": $string(contactId)}, "types": [{"associationCategory": "HUBSPOT_DEFINED", "associationTypeId": '
            + str(assoc_type) + '}]}]\n  }\n)')

DEAL_KEYS = ['closedate', 'dealname', 'pipeline', 'dealstage', 'dealtype', 'hs_priority']
def deal_input(contact_tpl):
    return json.dumps({
        'mapped': '{{node.119.body}}',
        'contactId': contact_tpl,
        'closedate': '{{node.97.body.result.closing_date}}',
        'dealname': '{{event.body.prospect.firstName}}{{event.body.prospect.lastName}}',
        'pipeline': '{{workflow.fields.Select Pipeline (when to create)}}',
        'dealstage': '{{workflow.fields.Select Pipeline Stage (when to create)}}',
        'dealtype': '{{workflow.fields.Deal Type (while creating)}}',
        'hs_priority': '{{workflow.fields.Deal Priority (while creating)}}',
    }, ensure_ascii=False)
def company_input(contact_tpl):
    return json.dumps({
        'mapped': '{{node.117.body}}',
        'contactId': contact_tpl,
        'name': '{{event.body.prospect.company}}',
        'domain': '{{event.body.prospect.companyDomain}}',
    }, ensure_ascii=False)

# ---- Fix 1 + 3: build create bodies (mapped props inside properties, association kept) ----
insert_between('100', '102', new_transform('147', 'Build deal body (existing contact)', near('102', 0, -110),
               deal_input('{{node.99.body.results.0.id}}'), body_query(DEAL_KEYS, 3)), 'n147-n102-edge')
insert_between('104', '105', new_transform('148', 'Build deal body (new contact)', near('105', 0, -96),
               deal_input('{{node.104.body.result.contactID}}'), body_query(DEAL_KEYS, 3)), 'n148-n105-edge')
insert_between('131', '136', new_transform('149', 'Build company body (existing contact)', near('136', 250, -50),
               company_input('{{node.130.body.results.0.id}}'), body_query(['name', 'domain'], 280)), 'n149-n136-edge')
insert_between('141', '142', new_transform('150', 'Build company body (new contact)', near('142', 0, -55),
               company_input('{{node.141.body.result.contactID}}'), body_query(['name', 'domain'], 280)), 'n150-n142-edge')
for create, t in [('102', '147'), ('105', '148'), ('136', '149'), ('142', '150')]:
    N[create]['input_data']['body'] = '{{node.%s.body.result}}' % t

# ---- Fix 2: update-company gets the Company Properties mapping ----
n151 = copy.deepcopy(N['116']); n151.update(id='151', name='Saleshandy', position=near('10', 250, -160))
n152 = copy.deepcopy(N['117']); n152.update(id='152', name='Functions', position=near('10', 250, -80))
n152['input_data']['shFields'] = '{{node.151.body.payload}}'
insert_between('12', '10', n151, 'n151-n10-edge-tmp')
insert_between('151', '10', n152, 'n152-n10-edge')
# first insert created 151->10 with a temp id, which the second insert retargeted to 151->152
[e for e in wf['edges'] if e['id'] == 'n151-n10-edge-tmp'][0]['id'] = 'n151-n152-edge'
N['10']['input_data']['additional_fields'] = '{{node.152.body}}'
N['10']['optional_fields'] = ['additional_fields']

# ---- Fix 4: dates keep the same day, pinned to 12:00 UTC ----
for nid, key in [('97', 'closing_date'), ('98', 'closing_date'), ('93', 'due_date')]:
    q = N[nid]['input_data']['query'].strip()
    prefix = '{"%s": ' % key
    assert q.startswith(prefix) and q.endswith('}') and 'T12:00' not in q, (nid, q)
    N[nid]['input_data']['query'] = prefix + '(' + q[len(prefix):-1] + ') & "T12:00:00.000Z"}'

# ---- Fix 5: notes on deal paths also link to the contact ----
for nid, tpl in [('61', '{{node.104.body.result.contactID}}'), ('87', '{{node.110.body.results.0.id}}')]:
    assert 'contact_id' not in N[nid]['input_data']
    N[nid]['input_data']['contact_id'] = tpl
    N[nid]['optional_fields'] = ['contact_id']

# ================= verification =================
O = {n['id']: n for n in orig['nodes']}
NEW = {'147', '148', '149', '150', '151', '152'}
EDITED = {'102', '105', '136', '142', '100', '104', '131', '141', '12', '10', '97', '98', '93', '61', '87'}
assert len(wf['nodes']) == len(orig['nodes']) + 6
assert len(wf['edges']) == len(orig['edges']) + 6
assert {k: v for k, v in wf.items() if k not in ('nodes', 'edges')} == {k: v for k, v in orig.items() if k not in ('nodes', 'edges')}
changed = {i for i in O if O[i] != N[i]}
assert changed == EDITED, changed ^ EDITED
# node order of existing nodes preserved; new ones appended
assert [n['id'] for n in wf['nodes'][:len(orig['nodes'])]] == [n['id'] for n in orig['nodes']]
# edges <-> incoming/outgoing consistency for the whole graph
pairs = {(e['source'], e['target']) for e in wf['edges']}
assert len(pairs) == len(wf['edges'])
for n in wf['nodes']:
    for o in n['outgoing_nodes']: assert (n['id'], o) in pairs, (n['id'], o)
    for i in n['incoming_nodes']: assert (i, n['id']) in pairs, (i, n['id'])
for s, t in pairs: assert t in N[s]['outgoing_nodes'] and s in N[t]['incoming_nodes'], (s, t)
assert len({e['id'] for e in wf['edges']}) == len(wf['edges'])
# every {{node.X}} referenced by a new/edited node must run before it
def anc(i, seen=None):
    seen = set() if seen is None else seen
    for p in N[i]['incoming_nodes']:
        if p not in seen: seen.add(p); anc(p, seen)
    return seen
for i in NEW | EDITED:
    for r in set(re.findall(r'node\.(\d+)\.', json.dumps(N[i]['input_data']))):
        assert r in anc(i), (i, r)
# edited nodes: only the intended keys differ
def diffkeys(a, b): return {k for k in set(a) | set(b) if a.get(k) != b.get(k)}
expect = {'102': {'input_data', 'incoming_nodes'}, '105': {'input_data', 'incoming_nodes'},
          '136': {'input_data', 'incoming_nodes'}, '142': {'input_data', 'incoming_nodes'},
          '100': {'outgoing_nodes', 'rule_satisfied_nodes'}, '131': {'outgoing_nodes', 'rule_satisfied_nodes'},
          '12': {'outgoing_nodes', 'rule_satisfied_nodes'}, '104': {'outgoing_nodes'}, '141': {'outgoing_nodes'},
          '10': {'input_data', 'incoming_nodes', 'optional_fields'}, '97': {'input_data'}, '98': {'input_data'},
          '93': {'input_data'}, '61': {'input_data', 'optional_fields'}, '87': {'input_data', 'optional_fields'}}
for i, ks in expect.items(): assert diffkeys(O[i], N[i]) == ks, (i, diffkeys(O[i], N[i]))
for i in ('102', '105', '136', '142'): assert diffkeys(O[i]['input_data'], N[i]['input_data']) == {'body'}
assert diffkeys(O['10']['input_data'], N['10']['input_data']) == {'additional_fields'}
for i in ('61', '87'): assert diffkeys(O[i]['input_data'], N[i]['input_data']) == {'contact_id'}
# new transform inputs are valid JSON once templates are filled
for i in ('147', '148', '149', '150'):
    json.loads(re.sub(r'\{\{[^}]*\}\}', 'x', N[i]['input_data']['input']))

json.dump(wf, open(dst, 'w'), indent=2, ensure_ascii=False)
json.dump({i: N[i]['input_data'] for i in ['147', '148', '149', '150', '97', '98', '93']}, open(dst + '.queries.json', 'w'), indent=1)
print('OK', src, '->', dst, '| nodes', len(orig['nodes']), '->', len(wf['nodes']), '| edges', len(orig['edges']), '->', len(wf['edges']),
      '| config_fields' , 'present' if 'config_fields' in wf else 'ABSENT')
