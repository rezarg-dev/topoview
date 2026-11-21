import assert from 'node:assert/strict';
import { test } from 'node:test';

import { linkGeometry } from '../js/geometry.js';

const a = { x: 100, y: 300 };
const b = { x: 500, y: 300 };

test('a link with nothing in its way is a straight line', () => {
  const shape = linkGeometry(a, b, [{ x: 300, y: 100 }]);
  assert.equal(shape.curved, false);
  assert.equal(shape.d, 'M100 300L500 300');
  assert.deepEqual(shape.source, { x: 162, y: 300 });
  assert.deepEqual(shape.target, { x: 438, y: 300 });
});

test('labels of a short link stay on their own half', () => {
  const shape = linkGeometry({ x: 0, y: 0 }, { x: 60, y: 0 }, []);
  assert.ok(shape.source.x < 30);
  assert.ok(shape.target.x > 30);
});

test('a link bends around a node that sits on it', () => {
  const shape = linkGeometry(a, b, [{ x: 300, y: 300 }]);
  assert.equal(shape.curved, true);
  assert.equal(shape.d, 'M100 300Q300 150 500 300');
});

test('the bend goes up whichever way the link is drawn', () => {
  const forward = linkGeometry(a, b, [{ x: 300, y: 300 }]);
  const backward = linkGeometry(b, a, [{ x: 300, y: 300 }]);
  assert.equal(backward.d, 'M500 300Q300 150 100 300');
  // Labels mirror each other too, up to floating point rounding.
  assert.ok(Math.abs(forward.source.x - backward.target.x) < 1e-9);
  assert.ok(Math.abs(forward.source.y - backward.target.y) < 1e-9);
});

test('the curve clears the node it avoids', () => {
  const shape = linkGeometry(a, b, [{ x: 300, y: 300 }]);
  // The highest point of a quadratic curve is halfway to its control point.
  const peak = 300 - 150 / 2;
  assert.ok(300 - peak > 60);
  assert.ok(shape.source.y < 300 && shape.target.y < 300);
});

test('a node next to the link, but not on it, does not bend it', () => {
  assert.equal(linkGeometry(a, b, [{ x: 300, y: 340 }]).curved, false);
  assert.equal(linkGeometry(a, b, [{ x: 300, y: 330 }]).curved, true);
  // Beyond the end of the segment.
  assert.equal(linkGeometry(a, b, [{ x: 560, y: 300 }]).curved, false);
});

test('a vertical link bends to the right', () => {
  const shape = linkGeometry({ x: 100, y: 100 }, { x: 100, y: 500 }, [{ x: 100, y: 300 }]);
  assert.equal(shape.d, 'M100 100Q250 300 100 500');
});

test('two nodes in the same place do not break anything', () => {
  const shape = linkGeometry(a, a, []);
  assert.equal(shape.d, 'M100 300L100 300');
  assert.ok(Number.isFinite(shape.source.x));
});
