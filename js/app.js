import { layout } from './layout.js';
import { render } from './render.js';
import { parseTopology } from './topology.js';

const canvas = document.querySelector('#canvas');
const state = {
  topology: null,
  positions: null,
  size: null,
  view: null,
};

// --- showing a topology ------------------------------------------------------

function show(topology) {
  const { positions, width, height } = layout(topology);
  Object.assign(state, { topology, positions, size: { width, height } });
  canvas.setAttribute('viewBox', `0 0 ${width} ${height}`);
  state.view = render(canvas, topology, positions);

  document.querySelector('#network-name').textContent = topology.name;
  document.title = `${topology.name} - topoview`;
}

async function loadUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`could not load ${url} (HTTP ${response.status})`);
  show(parseTopology(await response.json()));
}

loadUrl('data/acme.json');
