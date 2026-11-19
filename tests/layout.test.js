import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { clamp, layout, SPACING_X, TIER_Y } from '../js/layout.js';
import { parseTopology } from '../js/topology.js';

const acme = parseTopology(
  JSON.parse(readFileSync(new URL('../data/acme.json', import.meta.url), 'utf8')),
);

test('devices are placed in tiers', () => {
  const { positions } = layout(acme);
  for (const node of acme.nodes) {
    assert.equal(positions.get(node.id).y, TIER_Y[node.kind], node.id);
  }
});

test('routers are evenly spaced in file order', () => {
  const { positions } = layout(acme);
  const xs = ['HQ-R1', 'NORTH-R1', 'SOUTH-R1'].map((id) => positions.get(id).x);
  assert.equal(xs[1] - xs[0], SPACING_X);
  assert.equal(xs[2] - xs[1], SPACING_X);
});

test('each switch sits below its router, the cloud above the edge router', () => {
  const { positions } = layout(acme);
  for (const site of ['HQ', 'NORTH', 'SOUTH']) {
    assert.equal(positions.get(`${site}-SW1`).x, positions.get(`${site}-R1`).x);
  }
  assert.equal(positions.get('internet').x, positions.get('HQ-R1').x);
});

test('everything is inside the canvas and no two nodes share a position', () => {
  const { positions, width, height } = layout(acme);
  const seen = new Set();
  for (const { x, y } of positions.values()) {
    assert.ok(x > 0 && x < width && y > 0 && y < height);
    seen.add(`${x},${y}`);
  }
  assert.equal(seen.size, positions.size);
});

test('the same file always gives the same picture', () => {
  assert.deepEqual([...layout(acme).positions], [...layout(acme).positions]);
});

test('several switches on one router are spread out below it', () => {
  const topology = parseTopology({
    nodes: [
      { id: 'R1', kind: 'router' },
      { id: 'A', kind: 'switch' },
      { id: 'B', kind: 'switch' },
      { id: 'C', kind: 'switch' },
    ],
    links: ['A', 'B', 'C'].map((id) => ({ source: 'R1', target: id, kind: 'trunk' })),
  });
  const { positions } = layout(topology);
  const [a, b, c] = ['A', 'B', 'C'].map((id) => positions.get(id).x);
  assert.ok(a < b && b < c);
  assert.equal(b, positions.get('R1').x);
});

test('a switch without a router still gets a place of its own', () => {
  const topology = parseTopology({
    nodes: [
      { id: 'R1', kind: 'router' },
      { id: 'SW1', kind: 'switch' },
      { id: 'LONELY', kind: 'switch' },
    ],
    links: [{ source: 'R1', target: 'SW1', kind: 'trunk' }],
  });
  const { positions, height } = layout(topology);
  const lonely = positions.get('LONELY');
  assert.ok(lonely.y > positions.get('SW1').y);
  assert.ok(lonely.y < height);
});

test('clamp keeps a point inside the canvas', () => {
  const size = { width: 500, height: 300 };
  assert.deepEqual(clamp({ x: 250, y: 150 }, size), { x: 250, y: 150 });
  assert.deepEqual(clamp({ x: -80, y: 900 }, size), { x: 40, y: 260 });
  assert.deepEqual(clamp({ x: 999, y: -5 }, size, 10), { x: 490, y: 10 });
});
