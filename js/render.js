// Draws a topology as SVG and keeps it in sync with node positions.

import { linkGeometry } from './geometry.js';
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

  const placeLink = ({ link, path, sourceLabel, targetLabel }) => {
    const others = [];
    for (const [id, position] of positions) {
      if (id !== link.source && id !== link.target) others.push(position);
    }
    const shape = linkGeometry(positions.get(link.source), positions.get(link.target), others);
    path.setAttribute('d', shape.d);
    sourceLabel.setAttribute('x', shape.source.x);
    sourceLabel.setAttribute('y', shape.source.y - 6);
    targetLabel.setAttribute('x', shape.target.x);
    targetLabel.setAttribute('y', shape.target.y - 6);
  };

  // Moving one node can put it in the way of a link between two others, or
  // take it out of the way again, so every link is placed anew.
  const update = (id) => {
    const moved = id === undefined ? [...nodes.keys()] : [id];
    for (const nodeId of moved) {
      const { x, y } = positions.get(nodeId);
      nodes.get(nodeId).setAttribute('transform', `translate(${x} ${y})`);
    }
    links.forEach(placeLink);
  };

  update();
  return { nodes, links, update };
}
