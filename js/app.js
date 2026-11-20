import { describeNode } from './details.js';
import { layout } from './layout.js';
import { render } from './render.js';
import { parseTopology } from './topology.js';

const canvas = document.querySelector('#canvas');
const state = {
  topology: null,
  positions: null,
  size: null,
  view: null,
  selected: null,
};

function element(name, properties = {}, children = []) {
  const node = Object.assign(document.createElement(name), properties);
  node.append(...children);
  return node;
}

// --- details panel -----------------------------------------------------------

// Everything from the file is inserted as text, never as HTML, so a crafted
// topology file cannot inject markup.
function showDetails(id) {
  const panel = document.querySelector('#details');
  const info = id === null ? null : describeNode(state.topology, id);
  if (!info) {
    panel.replaceChildren(
      element('p', { className: 'hint', textContent: 'Select a device to see its details.' }),
    );
    return;
  }

  const children = [
    element('h2', { textContent: info.id }),
    element('p', { className: 'kind', textContent: info.kind }),
  ];

  if (info.facts.length > 0) {
    const list = element('dl');
    for (const [label, value] of info.facts) {
      list.append(element('dt', { textContent: label }), element('dd', { textContent: value }));
    }
    children.push(list);
  }

  if (info.vlans.length > 0) {
    children.push(element('h3', { textContent: 'VLANs' }));
    children.push(
      element(
        'ul',
        {},
        info.vlans.map((vlan) =>
          element('li', {}, [
            `${vlan.id} ${vlan.name}`,
            element('span', { className: 'sub', textContent: vlan.network }),
          ]),
        ),
      ),
    );
  }

  if (info.connections.length > 0) {
    children.push(element('h3', { textContent: 'Connections' }));
    children.push(
      element(
        'ul',
        {},
        info.connections.map((connection) => {
          const peer = element('button', {
            className: 'peer',
            type: 'button',
            textContent: connection.peer,
          });
          peer.addEventListener('click', () => select(connection.peer));
          const remote = connection.peerInterface ? ` ${connection.peerInterface}` : '';
          return element('li', {}, [
            peer,
            remote,
            element('span', { className: 'sub', textContent: connection.text }),
          ]);
        }),
      ),
    );
  }
  panel.replaceChildren(...children);
}

function select(id) {
  state.selected = id;
  for (const [nodeId, group] of state.view.nodes) {
    group.classList.toggle('selected', nodeId === id);
    group.setAttribute('aria-pressed', String(nodeId === id));
  }
  showDetails(id);
}

// --- selecting ---------------------------------------------------------------

canvas.addEventListener('click', (event) => {
  const group = event.target.closest('.node');
  // A click on the empty canvas clears the selection.
  select(group ? group.dataset.id : null);
});

// --- showing a topology ------------------------------------------------------

function show(topology) {
  const { positions, width, height } = layout(topology);
  Object.assign(state, { topology, positions, size: { width, height } });
  canvas.setAttribute('viewBox', `0 0 ${width} ${height}`);
  state.view = render(canvas, topology, positions);

  document.querySelector('#network-name').textContent = topology.name;
  document.title = `${topology.name} - topoview`;
  select(null);
}

async function loadUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`could not load ${url} (HTTP ${response.status})`);
  show(parseTopology(await response.json()));
}

loadUrl('data/acme.json');
