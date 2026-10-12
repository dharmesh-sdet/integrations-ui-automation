// Runs the exact input/query strings written into the workflow, templates filled with sample values.
const jsonata = require('jsonata'); const assert = require('assert');
const Q = require(process.argv[2]);
const fill = (s, vals) => s.replace(/\{\{([^}]*)\}\}/g, (_, k) => (k in vals ? vals[k] : 'X'));
(async () => {
  const deal = {
    'node.119.body': '__MAPPED__', 'node.99.body.results.0.id': '111', 'node.104.body.result.contactID': '222',
    'node.97.body.result.closing_date': '2026-10-02T12:00:00.000Z', 'event.body.prospect.firstName': 'John', 'event.body.prospect.lastName': 'Doe',
    'workflow.fields.Select Pipeline (when to create)': 'default', 'workflow.fields.Select Pipeline Stage (when to create)': 'appointmentscheduled',
    'workflow.fields.Deal Type (while creating)': '', 'workflow.fields.Deal Priority (while creating)': 'high' };
  for (const [id, cid] of [['147', '111'], ['148', '222']]) {
    const input = JSON.parse(fill(Q[id].input, deal));
    input.mapped = { amount: '500', hs_priority: 'low', blank: '' };        // platform resolves the quoted template to the object
    const r = await jsonata(Q[id].query).evaluate(input);
    assert.deepStrictEqual(r.properties, { amount: '500', hs_priority: 'high', closedate: '2026-10-02T12:00:00.000Z',
      dealname: 'JohnDoe', pipeline: 'default', dealstage: 'appointmentscheduled' });
    assert.deepStrictEqual(r.associations, [{ to: { id: cid }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }] }]);
    input.mapped = '';                                                      // mapping unresolved / empty
    assert.deepStrictEqual(Object.keys((await jsonata(Q[id].query).evaluate(input)).properties).sort(), ['closedate','dealname','dealstage','hs_priority','pipeline']);
  }
  const comp = { 'node.117.body': '__M__', 'node.130.body.results.0.id': '333', 'node.141.body.result.contactID': '444',
    'event.body.prospect.company': 'Acme', 'event.body.prospect.companyDomain': 'acme.com' };
  for (const [id, cid] of [['149', '333'], ['150', '444']]) {
    const input = JSON.parse(fill(Q[id].input, comp)); input.mapped = { industry: 'SaaS', name: 'ignored' };
    const r = await jsonata(Q[id].query).evaluate(input);
    assert.deepStrictEqual(r.properties, { industry: 'SaaS', name: 'Acme', domain: 'acme.com' });
    assert.strictEqual(r.associations[0].to.id, cid); assert.strictEqual(r.associations[0].types[0].associationTypeId, 280);
  }
  for (const id of ['97', '98', '93']) {
    const q = Q[id].query.replace(/\{\{[^}]*\}\}/g, '7');
    const v = Object.values(await jsonata(q).evaluate(JSON.parse(Q[id].input)))[0];
    assert.match(v, /^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/);
    for (const tz of ['America/Los_Angeles', 'America/New_York', 'Asia/Kolkata', 'Australia/Sydney'])
      assert.strictEqual(new Date(v).toLocaleDateString('en-CA', { timeZone: tz }), v.slice(0, 10));
    console.log(id, '->', v);
  }
  console.log('QUERY CHECKS PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
