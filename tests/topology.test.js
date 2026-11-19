import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  allVlans,
  linksOf,
  otherEnd,
  parseTopology,
  shortInterface,
  TopologyError,
  vlanFootprint,
} from '../js/topology.js';

const small = () => ({
  name: 'lab',
  nodes: [
    { id: 'R1', kind: 'router' },
    { id: 'R2', kind: 'router' },
    { id: 'SW1', kind: 'switch', vlans: [{ id: 10, name: 'users' }, { id: 99, name: 'mgmt' }] },
    { id: 'SW2', kind: 'switch', vlans: [{ id: 10, name: 'staff' }, { id: 20, name: 'guests' }] },
  ],
  links: [
    { source: 'R1', target: 'SW1', kind: 'trunk', vlans: [10, 99] },
    { source: 'R2', target: 'SW2', kind: 'trunk', vlans: [10, 20] },
    { source: 'R1', target: 'R2', kind: 'wan' },
  ],
});

function problemsOf(data) {
  try {
    parseTopology(data);
  } catch (error) {
    assert.ok(error instanceof TopologyError);
    return error.problems;
  }
  return assert.fail('expected parseTopology to throw');
}

test('a valid topology is returned as it is', () => {
  const topology = parseTopology(small());
  assert.equal(topology.name, 'lab');
  assert.equal(topology.nodes.length, 4);
  assert.equal(topology.links.length, 3);
});

test('a missing name gets a default', () => {
  const data = small();
  delete data.name;
  assert.equal(parseTopology(data).name, 'network');
});

test('things that are not a topology at all', () => {
  assert.deepEqual(problemsOf(null), ['the file must contain a JSON object']);
  assert.deepEqual(problemsOf([1, 2]), ['the file must contain a JSON object']);
  assert.deepEqual(problemsOf({}), [
    '"nodes" must be a list with at least one entry',
    '"links" must be a list',
  ]);
  assert.deepEqual(problemsOf({ nodes: [], links: [] }), [
    '"nodes" must be a list with at least one entry',
  ]);
});

test('every problem with nodes and links is reported', () => {
  const data = small();
  data.nodes[1].id = 'R1';
  data.nodes[2].kind = 'firewall';
  data.nodes.push({ kind: 'router' });
  data.links[0].target = 'SW9';
  data.links[2].kind = 'vpn';
  data.links.push(null);

  assert.deepEqual(problemsOf(data), [
    'nodes[1]: id "R1" is used twice',
    'nodes[2]: "kind" must be one of router, switch, cloud',
    'nodes[4]: "id" must be a non-empty string',
    'links[0]: target "SW9" is not a node',
    'links[1]: source "R2" is not a node',
    'links[2]: target "R2" is not a node',
    'links[2]: "kind" must be one of trunk, wan, uplink',
    'links[3]: source "undefined" is not a node',
    'links[3]: target "undefined" is not a node',
    'links[3]: "kind" must be one of trunk, wan, uplink',
  ]);
});

test('linksOf and otherEnd', () => {
  const topology = parseTopology(small());
  const links = linksOf(topology, 'R1');
  assert.deepEqual(links.map((link) => otherEnd(link, 'R1')), ['SW1', 'R2']);
  assert.deepEqual(linksOf(topology, 'nobody'), []);
});

test('allVlans merges VLANs by id and keeps different names', () => {
  assert.deepEqual(allVlans(parseTopology(small())), [
    { id: 10, name: 'users / staff' },
    { id: 20, name: 'guests' },
    { id: 99, name: 'mgmt' },
  ]);
});

test('allVlans is empty for a network without switches', () => {
  assert.deepEqual(allVlans(parseTopology({ nodes: [{ id: 'R1', kind: 'router' }], links: [] })), []);
});

test('vlanFootprint finds switches, trunks and their routers', () => {
  const topology = parseTopology(small());

  const everywhere = vlanFootprint(topology, 10);
  assert.deepEqual([...everywhere.nodes].sort(), ['R1', 'R2', 'SW1', 'SW2']);
  assert.deepEqual([...everywhere.links], [0, 1]);

  const oneSite = vlanFootprint(topology, 20);
  assert.deepEqual([...oneSite.nodes].sort(), ['R2', 'SW2']);
  assert.deepEqual([...oneSite.links], [1]);

  const nowhere = vlanFootprint(topology, 300);
  assert.equal(nowhere.nodes.size, 0);
  assert.equal(nowhere.links.size, 0);
});

test('shortInterface', () => {
  assert.equal(shortInterface('GigabitEthernet0/1'), 'Gi0/1');
  assert.equal(shortInterface('FastEthernet0/24'), 'Fa0/24');
  assert.equal(shortInterface('Serial0/0/0'), 'Se0/0/0');
  assert.equal(shortInterface('Vlan99'), 'Vlan99');
  assert.equal(shortInterface(undefined), '');
});
