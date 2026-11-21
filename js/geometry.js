// The shape of a link between two nodes. No DOM here.

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  // Position of the closest point on the segment, 0 at a and 1 at b.
  const t = Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/**
 * Path and port label positions for a link from `a` to `b`.
 *
 * The link is a straight line unless that line would run through one of the
 * `others`. In that case it bends around them, always towards the top of
 * the drawing so the result does not depend on the direction of the link.
 */
export function linkGeometry(a, b, others, { clearance = 36, bulge = 150, labelAt = 62 } = {}) {
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const blocked = others.some((point) => distanceToSegment(point, a, b) < clearance);

  if (!blocked) {
    const offset = Math.min(labelAt, length / 2 - 8);
    const ux = (b.x - a.x) / length;
    const uy = (b.y - a.y) / length;
    return {
      curved: false,
      d: `M${a.x} ${a.y}L${b.x} ${b.y}`,
      source: { x: a.x + ux * offset, y: a.y + uy * offset },
      target: { x: b.x - ux * offset, y: b.y - uy * offset },
    };
  }

  // Unit normal of the segment, flipped if necessary so it points up. A
  // vertical link bends to the right.
  let nx = -(b.y - a.y) / length;
  let ny = (b.x - a.x) / length;
  if (ny > 0 || (ny === 0 && nx < 0)) {
    nx = -nx;
    ny = -ny;
  }
  const control = { x: (a.x + b.x) / 2 + nx * bulge, y: (a.y + b.y) / 2 + ny * bulge };

  // Point on the quadratic curve at parameter t.
  const at = (t) => ({
    x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * control.x + t ** 2 * b.x,
    y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * control.y + t ** 2 * b.y,
  });
  const t = Math.min(0.4, (labelAt * 1.3) / length);
  return {
    curved: true,
    d: `M${a.x} ${a.y}Q${control.x} ${control.y} ${b.x} ${b.y}`,
    source: at(t),
    target: at(1 - t),
  };
}
