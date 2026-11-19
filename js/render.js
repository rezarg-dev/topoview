// Draws a topology as SVG and keeps it in sync with node positions.

import { shortInterface } from './topology.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(name, attributes = {}, text) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (text !== undefined) element.textContent = text;
  return element;
}

const SHAPES = {
  router: () => svg('circle', { r: 30 }),
  switch: () => svg('rect', { x: -42, y: -22, width: 84, height: 44, rx: 8 }),
  cloud: () =>
    svg('path', {
      d: 'M-38 14a20 20 0 0 1 4-39a26 26 0 0 1 50-6a22 22 0 0 1 22 45z',
    }),
};

// A small glyph inside each shape, so the kind of a device does not depend
// on colour alone.
const GLYPHS = {
  router: 'M-14 0h28M8-6l6 6-6 6M-8-6l-6 6 6 6',
  switch: 'M-22-7h44M-22 7h44M16-12l6 5-6 5M-16 2l-6 5 6 5',
  cloud: '',
};

/**
 * Builds the SVG content for a topology. Returns the elements by node id
 * and link index, and a function that moves everything attached to a node.
 */
export function render(root, topology, positions) {
  root.replaceChildren();
  const linkLayer = svg('g', { class: 'links' });
  const nodeLayer = svg('g', { class: 'nodes' });
  root.append(linkLayer, nodeLayer);

  const links = topology.links.map((link) => {
    const group = svg('g', { class: `link link-${link.kind}` });
    const path = svg('path');
    const sourceLabel = svg('text', { class: 'port' }, shortInterface(link.source_interface));
    const targetLabel = svg('text', { class: 'port' }, shortInterface(link.target_interface));
    group.append(path, sourceLabel, targetLabel);
    if (link.network) group.append(svg('title', {}, `${link.kind} ${link.network}`));
    linkLayer.append(group);
    return { link, group, path, sourceLabel, targetLabel };
  });

  const nodes = new Map();
  for (const node of topology.nodes) {
    const group = svg('g', {
      class: `node node-${node.kind}`,
      tabindex: 0,
      role: 'button',
      'aria-label': `${node.kind} ${node.id}`,
      'data-id': node.id,
    });
    group.append(SHAPES[node.kind]());
    if (GLYPHS[node.kind]) group.append(svg('path', { class: 'glyph', d: GLYPHS[node.kind] }));
    // Router names go above the circle: the trunk leaves at the bottom and
    // its port label would otherwise sit behind the name.
    const labelY = { cloud: 4, router: -42, switch: 52 }[node.kind];
    group.append(svg('text', { class: 'label', y: labelY }, node.id));
    nodeLayer.append(group);
    nodes.set(node.id, group);
  }

  // Port labels sit a fixed distance along the line from their node, so
  // they stay readable whatever the angle of the link.
  const placeLink = ({ link, path, sourceLabel, targetLabel }) => {
    const a = positions.get(link.source);
    const b = positions.get(link.target);
    path.setAttribute('d', `M${a.x} ${a.y}L${b.x} ${b.y}`);

    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const offset = Math.min(62, length / 2 - 8);
    const ux = (b.x - a.x) / length;
    const uy = (b.y - a.y) / length;
    sourceLabel.setAttribute('x', a.x + ux * offset);
    sourceLabel.setAttribute('y', a.y + uy * offset - 6);
    targetLabel.setAttribute('x', b.x - ux * offset);
    targetLabel.setAttribute('y', b.y - uy * offset - 6);
  };

  const update = (id) => {
    if (id === undefined) {
      for (const [nodeId, group] of nodes) {
        const { x, y } = positions.get(nodeId);
        group.setAttribute('transform', `translate(${x} ${y})`);
      }
      links.forEach(placeLink);
      return;
    }
    const { x, y } = positions.get(id);
    nodes.get(id).setAttribute('transform', `translate(${x} ${y})`);
    links.filter(({ link }) => link.source === id || link.target === id).forEach(placeLink);
  };

  update();
  return { nodes, links, update };
}
