import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import {
  DEFAULT_STATE,
  createQueueItem,
  emptyPlayerCurrent,
  normalizePlayerState,
  normalizeQueue,
  normalizeSong,
  normalizeState,
  playerStateFromQueueItem,
  createId,
} from '../src/lib/karaokeCore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(__dirname, 'data');
const statePath = path.join(dataDir, 'vibeoke-state.json');
const port = Number(process.env.PORT || 3001);
const isProduction = process.env.NODE_ENV === 'production';

let state = await loadState();
let vite;

const server = http.createServer(async (req, res) => {
  if (!isProduction && vite) {
    vite.middlewares(req, res, () => {
      sendNotFound(res);
    });
    return;
  }

  await serveStatic(req, res);
});

if (!isProduction) {
  const { createServer: createViteServer } = await import('vite');
  vite = await createViteServer({
    root: rootDir,
    appType: 'spa',
    server: {
      middlewareMode: true,
      hmr: {
        server,
      },
    },
  });
}

const io = new Server(server, {
  cors: {
    origin: true,
  },
});

io.on('connection', (socket) => {
  socket.emit('state:snapshot', state);

  socket.on('state:request', (_payload, callback = () => {}) => {
    socket.emit('state:snapshot', state);
    callback({ ok: true, data: state });
  });

  socket.on('state:reset', ack(socket, () => {
    mutate(() => normalizeState(DEFAULT_STATE));
    return state;
  }));

  socket.on('queue:add', ack(socket, ({ song, singerName = '', dedication = '' } = {}) => {
    const item = createQueueItem(song, singerName, dedication, state.queue.length + 1);
    mutate((draft) => ({
      ...draft,
      queue: normalizeQueue([...draft.queue, item]),
    }));
    return item;
  }));

  socket.on('queue:remove', ack(socket, ({ id } = {}) => {
    mutate((draft) => ({
      ...draft,
      queue: normalizeQueue(draft.queue.filter((item) => item.id !== id)),
    }));
    return { id };
  }));

  socket.on('queue:reorder', ack(socket, ({ ids = [] } = {}) => {
    const byId = new Map(state.queue.map((item) => [item.id, item]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
    const orderedIds = new Set(ordered.map((item) => item.id));
    const missing = state.queue.filter((item) => !orderedIds.has(item.id));

    mutate((draft) => ({
      ...draft,
      queue: normalizeQueue([...ordered, ...missing]),
    }));
    return state.queue;
  }));

  socket.on('queue:play-next', ack(socket, ({ id } = {}) => {
    const queue = normalizeQueue(state.queue);
    const index = id ? queue.findIndex((item) => item.id === id) : 0;
    if (index < 0) return null;

    const [item] = queue.splice(index, 1);
    mutate((draft) => ({
      ...draft,
      queue: normalizeQueue(queue),
      player: playerStateFromQueueItem(item, draft.player.volume),
    }));
    return item;
  }));

  socket.on('player:play-now', ack(socket, ({ song, singerName = '', dedication = '' } = {}) => {
    const item = createQueueItem(song, singerName, dedication, 1);
    mutate((draft) => ({
      ...draft,
      player: playerStateFromQueueItem(item, draft.player.volume),
    }));
    return item;
  }));

  socket.on('player:update', ack(socket, ({ data = {} } = {}) => {
    mutate((draft) => ({
      ...draft,
      player: normalizePlayerState({ ...draft.player, ...data }),
    }));
    return state.player;
  }));

  socket.on('player:command', ack(socket, ({ command = 'none', payload = {} } = {}) => {
    const optimistic = {};
    if (command === 'pause') optimistic.status = 'paused';
    if (command === 'resume' || command === 'play') optimistic.status = 'playing';

    mutate((draft) => ({
      ...draft,
      player: normalizePlayerState({
        ...draft.player,
        ...optimistic,
        command,
        command_payload: payload,
        command_timestamp: Date.now(),
        command_id: createId('cmd'),
      }),
    }));
    return state.player;
  }));

  socket.on('player:clear-command', ack(socket, () => {
    mutate((draft) => ({
      ...draft,
      player: normalizePlayerState({
        ...draft.player,
        command: 'none',
        command_payload: {},
      }),
    }));
    return state.player;
  }));

  socket.on('player:stop', ack(socket, ({ status = 'stopped' } = {}) => {
    mutate((draft) => ({
      ...draft,
      player: normalizePlayerState({
        ...emptyPlayerCurrent(draft.player),
        status,
        command: 'none',
        command_payload: {},
        command_timestamp: Date.now(),
        command_id: createId('cmd'),
      }),
    }));
    return state.player;
  }));

  socket.on('song:add-custom', ack(socket, ({ song } = {}) => {
    const saved = normalizeSong({
      ...song,
      id: song?.id || createId('song'),
      is_custom: true,
      created_at: song?.created_at || Date.now(),
    });
    let stored = saved;

    mutate((draft) => {
      const normalizedTitle = normalizeComparable(saved.title);
      const normalizedArtist = normalizeComparable(saved.artist);
      const index = draft.customSongs.findIndex((item) => (
        item.id === saved.id
        || (normalizeComparable(item.title) === normalizedTitle && normalizeComparable(item.artist) === normalizedArtist)
      ));
      const customSongs = [...draft.customSongs];
      if (index >= 0) {
        stored = {
          ...saved,
          id: customSongs[index].id,
          created_at: customSongs[index].created_at || saved.created_at,
        };
        customSongs[index] = stored;
      } else {
        customSongs.unshift(saved);
      }
      return { ...draft, customSongs };
    });
    return stored;
  }));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Vibeoke realtime server running at http://localhost:${port}`);
});

function ack(socket, handler) {
  return async (payload, callback = () => {}) => {
    try {
      const data = await handler(payload || {});
      callback({ ok: true, data });
    } catch (error) {
      callback({ ok: false, error: error.message || 'Server action failed.' });
      socket.emit('server:error', { message: error.message || 'Server action failed.' });
    }
  };
}

function mutate(updater) {
  state = normalizeState(updater(structuredClone(state)) || state);
  state.updated_at = Date.now();
  io.emit('state:snapshot', state);
  queuePersist();
}

function normalizeComparable(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

let persistTimer;
function queuePersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistState().catch((error) => {
      console.error('Could not persist Vibeoke state:', error);
    });
  }, 80);
}

async function loadState() {
  try {
    const raw = await fs.readFile(statePath, 'utf8');
    return normalizeState(JSON.parse(raw));
  } catch (_error) {
    return normalizeState(DEFAULT_STATE);
  }
}

async function persistState() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));
}

async function serveStatic(req, res) {
  const distDir = path.join(rootDir, 'dist');
  const requestUrl = new URL(req.url || '/', 'http://localhost');
  const pathname = decodeURIComponent(requestUrl.pathname);
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(distDir, requestedPath));

  if (!filePath.startsWith(distDir)) {
    sendNotFound(res);
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
    res.end(file);
  } catch (_error) {
    const indexPath = path.join(distDir, 'index.html');
    try {
      const indexFile = await fs.readFile(indexPath);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(indexFile);
    } catch {
      sendNotFound(res);
    }
  }
}

function sendNotFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

function getMimeType(filePath) {
  const ext = path.extname(filePath);
  const types = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
  };
  return types[ext] || 'application/octet-stream';
}
