// Initial positions for the nodes.
//
// Networks from subnetplan have a fixed shape: one optional cloud, a router
// per site and a switch behind each router. A layered layout shows that
// shape directly and always gives the same picture for the same file, which
// a force simulation would not.

export const SPACING_X = 230;
export const TIER_Y = { cloud: 90, router: 270, switch: 450 };
const MARGIN_X = 130;
const HEIGHT = 540;

export function layout(topology) {
  const routers = topology.nodes.filter((node) => node.kind === 'router');
  const switches = topology.nodes.filter((node) => node.kind === 'switch');
  const clouds = topology.nodes.filter((node) => node.kind === 'cloud');

  const columns = Math.max(routers.length, switches.length, clouds.length, 1);
  const width = MARGIN_X * 2 + (columns - 1) * SPACING_X;
  const positions = new Map();

  // Spread a row of nodes evenly around the centre of the canvas.
  const placeRow = (nodes, y) => {
    const start = width / 2 - ((nodes.length - 1) * SPACING_X) / 2;
    nodes.forEach((node, index) => positions.set(node.id, { x: start + index * SPACING_X, y }));
  };
  placeRow(routers, TIER_Y.router);

  // A switch goes straight below the router it is trunked to. Switches
  // without a router, and several switches on one router, are spread out.
  const below = new Map();
  const loose = [];
  for (const node of switches) {
    const trunk = topology.links.find(
      (link) =>
        link.kind === 'trunk' &&
        (link.source === node.id || link.target === node.id) &&
        positions.has(link.source === node.id ? link.target : link.source),
    );
    if (!trunk) {
      loose.push(node);
      continue;
    }
    const router = trunk.source === node.id ? trunk.target : trunk.source;
    if (!below.has(router)) below.set(router, []);
    below.get(router).push(node);
  }
  for (const [router, group] of below) {
    const centre = positions.get(router).x;
    const step = SPACING_X / (group.length + 1);
    group.forEach((node, index) => {
      const offset = (index - (group.length - 1) / 2) * step;
      positions.set(node.id, { x: centre + offset, y: TIER_Y.switch });
    });
  }
  if (loose.length > 0) placeRow(loose, TIER_Y.switch + 70);

  // The cloud sits above the router it is connected to.
  for (const node of clouds) {
    const uplink = topology.links.find(
      (link) => link.source === node.id || link.target === node.id,
    );
    const neighbour = uplink && (uplink.source === node.id ? uplink.target : uplink.source);
    const x = positions.get(neighbour)?.x ?? width / 2;
    positions.set(node.id, { x, y: TIER_Y.cloud });
  }

  return { positions, width, height: HEIGHT + (loose.length > 0 ? 70 : 0) };
}

/** Keeps a point inside the canvas, `margin` away from the edges. */
export function clamp(point, size, margin = 40) {
  return {
    x: Math.min(Math.max(point.x, margin), size.width - margin),
    y: Math.min(Math.max(point.y, margin), size.height - margin),
  };
}
