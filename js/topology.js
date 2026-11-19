// Reading and querying topology data. No DOM in this file, so all of it
// runs under node:test.

export class TopologyError extends Error {
  constructor(problems) {
    super(problems.join('\n'));
    this.name = 'TopologyError';
    this.problems = problems;
  }
}

export const NODE_KINDS = ['router', 'switch', 'cloud'];
export const LINK_KINDS = ['trunk', 'wan', 'uplink'];

/**
 * Checks the shape of a topology and returns it. Throws a TopologyError
 * that lists every problem, not only the first.
 */
export function parseTopology(data) {
  const problems = [];
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new TopologyError(['the file must contain a JSON object']);
  }
  if (!Array.isArray(data.nodes) || data.nodes.length === 0) {
    problems.push('"nodes" must be a list with at least one entry');
  }
  if (!Array.isArray(data.links)) problems.push('"links" must be a list');
  if (problems.length > 0) throw new TopologyError(problems);

  const ids = new Set();
  data.nodes.forEach((node, index) => {
    const where = `nodes[${index}]`;
    if (typeof node?.id !== 'string' || node.id === '') {
      problems.push(`${where}: "id" must be a non-empty string`);
      return;
    }
    if (ids.has(node.id)) problems.push(`${where}: id "${node.id}" is used twice`);
    ids.add(node.id);
    if (!NODE_KINDS.includes(node.kind)) {
      problems.push(`${where}: "kind" must be one of ${NODE_KINDS.join(', ')}`);
    }
  });

  data.links.forEach((link, index) => {
    const where = `links[${index}]`;
    for (const end of ['source', 'target']) {
      if (!ids.has(link?.[end])) {
        problems.push(`${where}: ${end} "${link?.[end]}" is not a node`);
      }
    }
    if (!LINK_KINDS.includes(link?.kind)) {
      problems.push(`${where}: "kind" must be one of ${LINK_KINDS.join(', ')}`);
    }
  });

  if (problems.length > 0) throw new TopologyError(problems);
  return {
    name: typeof data.name === 'string' ? data.name : 'network',
    nodes: data.nodes,
    links: data.links,
  };
}

export function linksOf(topology, id) {
  return topology.links.filter((link) => link.source === id || link.target === id);
}

/** The node at the other end of a link. */
export function otherEnd(link, id) {
  return link.source === id ? link.target : link.source;
}

/** Every VLAN that exists anywhere in the network, without duplicates. */
export function allVlans(topology) {
  const names = new Map();
  for (const node of topology.nodes) {
    for (const vlan of node.vlans ?? []) {
      if (!names.has(vlan.id)) names.set(vlan.id, new Set());
      names.get(vlan.id).add(vlan.name);
    }
  }
  return [...names.entries()]
    .sort(([a], [b]) => a - b)
    .map(([id, set]) => ({ id, name: [...set].join(' / ') }));
}

/**
 * Where a VLAN lives: the switches that have it, the trunks that carry it,
 * and the routers at the other end of those trunks.
 */
export function vlanFootprint(topology, vlanId) {
  const nodes = new Set();
  const links = new Set();
  topology.links.forEach((link, index) => {
    if (link.kind === 'trunk' && (link.vlans ?? []).includes(vlanId)) {
      links.add(index);
      nodes.add(link.source);
      nodes.add(link.target);
    }
  });
  for (const node of topology.nodes) {
    if ((node.vlans ?? []).some((vlan) => vlan.id === vlanId)) nodes.add(node.id);
  }
  return { nodes, links };
}

/** GigabitEthernet0/1 -> Gi0/1, the way IOS abbreviates interface names. */
export function shortInterface(name) {
  if (typeof name !== 'string') return '';
  for (const [long, short] of [
    ['GigabitEthernet', 'Gi'],
    ['FastEthernet', 'Fa'],
    ['Serial', 'Se'],
  ]) {
    if (name.startsWith(long)) return short + name.slice(long.length);
  }
  return name;
}
