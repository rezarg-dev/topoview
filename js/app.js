import { describeNode } from './details.js';
import { clamp, layout } from './layout.js';
import { render } from './render.js';
import { allVlans, parseTopology, TopologyError, vlanFootprint } from './topology.js';

const canvas = document.querySelector('#canvas');
const state = {
  topology: null,
  positions: null,
  size: null,
  view: null,
  selected: null,
  vlan: null,
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

// --- VLAN highlighting -------------------------------------------------------

function highlightVlan(vlanId) {
  state.vlan = vlanId;
  const footprint = vlanId === null ? null : vlanFootprint(state.topology, vlanId);

  canvas.classList.toggle('filtered', footprint !== null);
  for (const [id, group] of state.view.nodes) {
    group.classList.toggle('in-vlan', footprint?.nodes.has(id) ?? false);
  }
  state.view.links.forEach(({ group }, index) => {
    group.classList.toggle('in-vlan', footprint?.links.has(index) ?? false);
  });
  for (const button of document.querySelectorAll('#vlans button')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.vlan) === vlanId));
  }
}

function showVlans() {
  const bar = document.querySelector('#vlans');
  const vlans = allVlans(state.topology);
  if (vlans.length === 0) {
    bar.replaceChildren();
    return;
  }
  const buttons = vlans.map((vlan) => {
    const button = element('button', {
      type: 'button',
      textContent: `${vlan.id} ${vlan.name}`,
    });
    button.dataset.vlan = vlan.id;
    button.setAttribute('aria-pressed', 'false');
    // Clicking the active VLAN again switches the highlight off.
    button.addEventListener('click', () =>
      highlightVlan(state.vlan === vlan.id ? null : vlan.id),
    );
    return button;
  });
  bar.replaceChildren(element('span', { textContent: 'Highlight VLAN' }), ...buttons);
}

// --- moving nodes ------------------------------------------------------------

function moveNode(id, point) {
  state.positions.set(id, clamp(point, state.size));
  state.view.update(id);
}

// Pointer coordinates are in screen pixels. The SVG is scaled to fit its
// box, so they have to be converted into the coordinate system of the drawing.
function toCanvas(event) {
  const point = new DOMPoint(event.clientX, event.clientY);
  return point.matrixTransform(canvas.getScreenCTM().inverse());
}

let drag = null;

canvas.addEventListener('pointerdown', (event) => {
  const group = event.target.closest('.node');
  if (!group || event.button !== 0) return;
  const id = group.dataset.id;
  const start = toCanvas(event);
  const origin = state.positions.get(id);
  drag = { id, group, moved: false, dx: origin.x - start.x, dy: origin.y - start.y };
  group.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const point = toCanvas(event);
  const target = { x: point.x + drag.dx, y: point.y + drag.dy };
  const current = state.positions.get(drag.id);
  // A click always moves the pointer a little. Only treat it as a drag
  // once it has travelled a few pixels.
  if (!drag.moved && Math.hypot(target.x - current.x, target.y - current.y) < 4) return;
  drag.moved = true;
  drag.group.classList.add('dragging');
  moveNode(drag.id, target);
});

// Set when a drag ends, so the click that follows it does not select.
let suppressClick = false;

function endDrag() {
  if (!drag) return;
  drag.group.classList.remove('dragging');
  suppressClick = drag.moved;
  drag = null;
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// --- selecting ---------------------------------------------------------------

canvas.addEventListener('click', (event) => {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  const group = event.target.closest('.node');
  // A click on the empty canvas clears the selection.
  select(group ? group.dataset.id : null);
});

// --- keyboard ----------------------------------------------------------------

const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

canvas.addEventListener('keydown', (event) => {
  const group = event.target.closest('.node');
  if (!group) return;
  const id = group.dataset.id;

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    select(state.selected === id ? null : id);
  } else if (event.key === 'Escape') {
    select(null);
  } else if (event.key in ARROWS) {
    event.preventDefault();
    const [dx, dy] = ARROWS[event.key];
    const step = event.shiftKey ? 40 : 10;
    const { x, y } = state.positions.get(id);
    moveNode(id, { x: x + dx * step, y: y + dy * step });
  }
});

// --- theme -------------------------------------------------------------------

const themeButton = document.querySelector('#theme');

function storedTheme() {
  // Storage can be unavailable (private mode, blocked cookies). The theme
  // then simply is not remembered.
  try {
    return localStorage.getItem('topoview-theme');
  } catch {
    return null;
  }
}

function applyTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  const dark =
    theme === 'dark' || (!theme && matchMedia('(prefers-color-scheme: dark)').matches);
  themeButton.setAttribute('aria-pressed', String(dark));
}

themeButton.addEventListener('click', () => {
  const next = themeButton.getAttribute('aria-pressed') === 'true' ? 'light' : 'dark';
  applyTheme(next);
  try {
    localStorage.setItem('topoview-theme', next);
  } catch {
    // See storedTheme().
  }
});

applyTheme(storedTheme());

// --- showing a topology ------------------------------------------------------

function show(topology) {
  const { positions, width, height } = layout(topology);
  Object.assign(state, { topology, positions, size: { width, height } });
  canvas.setAttribute('viewBox', `0 0 ${width} ${height}`);
  state.view = render(canvas, topology, positions);

  document.querySelector('#network-name').textContent = topology.name;
  document.title = `${topology.name} - topoview`;
  select(null);
  showVlans();
  highlightVlan(null);
}

// --- loading -----------------------------------------------------------------

const errorBox = document.querySelector('#error');

function showError(error) {
  if (!error) {
    errorBox.hidden = true;
    return;
  }
  const lines = error instanceof TopologyError ? error.problems : [error.message];
  errorBox.textContent = ['This file cannot be shown:', ...lines.slice(0, 8)].join('\n');
  errorBox.hidden = false;
}

async function loadUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`could not load ${url} (HTTP ${response.status})`);
  show(parseTopology(await response.json()));
}

// The diagram on screen is only replaced once the new file has been read
// and checked completely.
async function open(read) {
  try {
    await read();
    showError(null);
  } catch (error) {
    showError(error);
  }
}

async function loadFile(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error(`${file.name} is not valid JSON`);
  }
  show(parseTopology(data));
}

const dataset = document.querySelector('#dataset');
dataset.addEventListener('change', () => open(() => loadUrl(`data/${dataset.value}.json`)));

const fileInput = document.querySelector('#file');
fileInput.addEventListener('change', () => {
  const [file] = fileInput.files;
  if (file) open(() => loadFile(file));
  // Lets the same file be chosen again after it was fixed.
  fileInput.value = '';
});

window.addEventListener('dragover', (event) => {
  event.preventDefault();
  document.body.classList.add('dropping');
});
window.addEventListener('dragleave', () => document.body.classList.remove('dropping'));
window.addEventListener('drop', (event) => {
  event.preventDefault();
  document.body.classList.remove('dropping');
  const [file] = event.dataTransfer.files;
  if (file) open(() => loadFile(file));
});

open(() => loadUrl(`data/${dataset.value}.json`));
