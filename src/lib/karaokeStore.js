import { io } from 'socket.io-client';
import {
  DEFAULT_STATE,
  getLyricsPreview,
  normalizeSong,
  normalizeState,
} from '@/lib/karaokeCore';

let snapshot = normalizeState(DEFAULT_STATE);
let connectionStatus = 'offline';
let socket;
let publishedSnapshot = withConnection(snapshot);
let connectStarted = false;
const listeners = new Set();

export { getLyricsPreview, normalizeSong };

export function getKaraokeSnapshot() {
  ensureSocket();
  return publishedSnapshot;
}

export function subscribeKaraokeStore(listener) {
  listeners.add(listener);
  ensureSocket();
  return () => listeners.delete(listener);
}

export function addQueueItem(song, singerName = '', dedication = '') {
  return emitAction('queue:add', { song, singerName, dedication });
}

export function removeQueueItem(id) {
  return emitAction('queue:remove', { id });
}

export function reorderQueueItems(items) {
  return emitAction('queue:reorder', { ids: items.map((item) => item.id) });
}

export function addCustomSong(song) {
  return emitAction('song:add-custom', { song });
}

export function updatePlayerState(data) {
  return emitAction('player:update', { data });
}

export function sendPlayerCommand(command, payload = {}) {
  return emitAction('player:command', { command, payload });
}

export function clearPlayerCommand() {
  return emitAction('player:clear-command');
}

export function stopPlayback(status = 'stopped') {
  return emitAction('player:stop', { status });
}

export function startQueueItem(id) {
  return emitAction('queue:play-next', { id });
}

export function playSongNow(song, singerName = '', dedication = '') {
  return emitAction('player:play-now', { song, singerName, dedication });
}

export function resetKaraokeState() {
  return emitAction('state:reset');
}

function ensureSocket() {
  if (typeof window === 'undefined' || connectStarted) return socket;
  connectStarted = true;

  socket = io(getSocketUrl(), {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 400,
    reconnectionDelayMax: 2500,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    setConnectionStatus('online');
    socket.emit('state:request');
  });

  socket.on('disconnect', () => {
    setConnectionStatus('offline');
  });

  socket.on('connect_error', () => {
    setConnectionStatus('offline');
  });

  socket.on('state:snapshot', (state) => {
    snapshot = normalizeState(state);
    connectionStatus = socket.connected ? 'online' : connectionStatus;
    publishSnapshot();
  });

  return socket;
}

function emitAction(event, payload = {}) {
  const activeSocket = ensureSocket();

  if (!activeSocket) {
    return Promise.reject(new Error('Realtime queue is only available in the browser.'));
  }

  return new Promise((resolve, reject) => {
    activeSocket.timeout(9000).emit(event, payload, (error, response = {}) => {
      if (error) {
        reject(new Error('Realtime server did not respond. Check that the Vibeoke server is running.'));
        return;
      }
      if (!response.ok) {
        reject(new Error(response.error || 'Realtime queue action failed.'));
        return;
      }
      resolve(response.data);
    });
  });
}

function notifyListeners() {
  for (const listener of listeners) listener();
}

function setConnectionStatus(status) {
  if (connectionStatus === status) return;
  connectionStatus = status;
  publishSnapshot();
}

function publishSnapshot() {
  publishedSnapshot = withConnection(snapshot);
  notifyListeners();
}

function withConnection(state) {
  return {
    ...state,
    connection: {
      status: connectionStatus,
      socket_id: socket?.id || '',
    },
  };
}

function getSocketUrl() {
  const configured = String(import.meta.env.VITE_SYNC_SERVER_URL || '').trim();
  if (configured) return configured;

  const { protocol, hostname, port, origin } = window.location;
  const vitePorts = new Set(['5173', '5174', '4300']);
  if (vitePorts.has(port) && import.meta.env.DEV) {
    return `${protocol}//${hostname}:3001`;
  }

  return origin;
}
