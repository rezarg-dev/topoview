import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { layout } from '../js/layout.js';
import { parseTopology } from '../js/topology.js';

const DIR = new URL('../data/', import.meta.url);

for (const file of readdirSync(DIR).filter((name) => name.endsWith('.json'))) {
  test(`data/${file} is a valid topology that can be laid out`, () => {
    const topology = parseTopology(JSON.parse(readFileSync(new URL(file, DIR), 'utf8')));
    const { positions } = layout(topology);
    assert.equal(positions.size, topology.nodes.length);
  });
}

test('the example selector in index.html offers exactly the files in data/', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const offered = [...html.matchAll(/<option value="([^"]+)"/g)].map((match) => match[1]);
  const present = readdirSync(DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/, ''));
  assert.deepEqual(offered.sort(), present.sort());
});
