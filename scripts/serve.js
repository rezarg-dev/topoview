#!/usr/bin/env node
// Minimal static file server for local development.
//
//   node scripts/serve.js [port]
//
// The page loads its scripts as ES modules, and browsers refuse to do that
// from file:// URLs, so opening index.html directly does not work.

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PORT = Number(process.argv[2] ?? 8000);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  let path;
  try {
    path = normalize(join(ROOT, decodeURIComponent(pathname)));
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }
  // Never serve anything outside the project directory.
  if (path !== ROOT.replace(/[\\/]$/, '') && !path.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    await stat(path);
  } catch {
    response.writeHead(404).end('Not found');
    return;
  }

  response.writeHead(200, {
    'content-type': TYPES[extname(path)] ?? 'application/octet-stream',
    // Always fetch fresh files while developing.
    'cache-control': 'no-store',
  });
  createReadStream(path).pipe(response);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`topoview is running at http://localhost:${PORT}`);
});
