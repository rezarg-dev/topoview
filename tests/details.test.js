import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { describeNode } from '../js/details.js';
import { parseTopology } from '../js/topology.js';

const acme = parseTopology(
  JSON.parse(readFileSync(new URL('../data/acme.json', import.meta.url), 'utf8')),
);

test('router details', () => {
  const info = describeNode(acme, 'HQ-R1');
  assert.equal(info.kind, 'Router');
  assert.deepEqual(info.facts, [
    ['Site', 'hq'],
    ['Router ID', '1.1.1.1'],
    ['Summary route', '10.20.0.0/23'],
  ]);
  assert.deepEqual(info.vlans, []);
  assert.deepEqual(info.connections, [
    {
      peer: 'HQ-SW1',
      peerInterface: 'Gi0/1',
      kind: 'trunk',
      text: 'Gi0/0 trunk, VLANs 10, 20, 30, 99',
    },
    {
      peer: 'NORTH-R1',
      peerInterface: 'Gi0/1',
      kind: 'wan',
      text: 'Gi0/1 10.20.2.193 (10.20.2.192/30)',
    },
    {
      peer: 'SOUTH-R1',
      peerInterface: 'Se0/0/0',
      kind: 'wan',
      text: 'Se0/0/0 10.20.2.197 (10.20.2.196/30)',
    },
    {
      peer: 'internet',
      peerInterface: '',
      kind: 'uplink',
      text: 'Gi0/2 203.0.113.2 (203.0.113.0/30)',
    },
  ]);
});

test('a link is described from the side of the selected node', () => {
  const [, toHq] = describeNode(acme, 'SOUTH-R1').connections;
  assert.equal(toHq.peer, 'HQ-R1');
  assert.equal(toHq.text, 'Se0/0/0 10.20.2.198 (10.20.2.196/30)');
});

test('switch details list the VLANs', () => {
  const info = describeNode(acme, 'NORTH-SW1');
  assert.equal(info.kind, 'Switch');
  assert.deepEqual(info.facts, [
    ['Site', 'north'],
    ['Management', '10.20.2.98'],
  ]);
  assert.deepEqual(
    info.vlans.map((vlan) => vlan.id),
    [10, 40, 99],
  );
  assert.equal(info.connections[0].peer, 'NORTH-R1');
});

test('the cloud has no facts, only its connection', () => {
  const info = describeNode(acme, 'internet');
  assert.equal(info.kind, 'Provider network');
  assert.deepEqual(info.facts, []);
  assert.deepEqual(info.connections, [
    { peer: 'HQ-R1', peerInterface: 'Gi0/2', kind: 'uplink', text: '203.0.113.1 (203.0.113.0/30)' },
  ]);
});

test('unknown ids give null', () => {
  assert.equal(describeNode(acme, 'nope'), null);
});
