// What the side panel shows for a selected node. Pure data in, pure data
// out: the panel only has to turn this into elements.

import { linksOf, otherEnd, shortInterface } from './topology.js';

const KIND_LABELS = { router: 'Router', switch: 'Switch', cloud: 'Provider network' };

function connection(link, id) {
  const isSource = link.source === id;
  const local = isSource ? link.source_interface : link.target_interface;
  const remote = isSource ? link.target_interface : link.source_interface;
  const address = isSource ? link.source_address : link.target_address;

  const parts = [];
  if (local) parts.push(shortInterface(local));
  if (address) parts.push(address);
  if (link.network) parts.push(`(${link.network})`);
  if (link.kind === 'trunk' && link.vlans?.length) {
    parts.push(`trunk, VLANs ${link.vlans.join(', ')}`);
  }

  return {
    peer: otherEnd(link, id),
    peerInterface: remote ? shortInterface(remote) : '',
    kind: link.kind,
    text: parts.join(' '),
  };
}

export function describeNode(topology, id) {
  const node = topology.nodes.find((candidate) => candidate.id === id);
  if (!node) return null;

  const facts = [];
  if (node.site) facts.push(['Site', node.site]);
  if (node.router_id) facts.push(['Router ID', node.router_id]);
  if (node.summary) facts.push(['Summary route', node.summary]);
  if (node.management_address) facts.push(['Management', node.management_address]);

  return {
    id: node.id,
    kind: KIND_LABELS[node.kind] ?? node.kind,
    facts,
    vlans: node.vlans ?? [],
    connections: linksOf(topology, id).map((link) => connection(link, id)),
  };
}
