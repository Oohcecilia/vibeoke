import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { SONG_CATALOG } from '@/data/songCatalog';
import {
  addCustomSong,
  addQueueItem,
  clearPlayerCommand,
  getKaraokeSnapshot,
  getLyricsPreview,
  playSongNow,
  removeQueueItem,
  reorderQueueItems,
  sendPlayerCommand,
  startQueueItem,
  stopPlayback,
  subscribeKaraokeStore,
  updatePlayerState as updateStoredPlayerState,
} from '@/lib/karaokeStore';

export function useKaraokeStore() {
  return useSyncExternalStore(subscribeKaraokeStore, getKaraokeSnapshot, getKaraokeSnapshot);
}

export function usePlayerState() {
  const { player } = useKaraokeStore();

  const initPlayerState = useCallback(() => player, [player]);
  const updatePlayerState = useCallback((data) => updateStoredPlayerState(data), []);
  const sendCommand = useCallback((command, payload) => sendPlayerCommand(command, payload), []);
  const clearCommand = useCallback(() => clearPlayerCommand(), []);
  const stop = useCallback((status) => stopPlayback(status), []);
  const playNow = useCallback((song, singerName, dedication) => playSongNow(song, singerName, dedication), []);

  return {
    playerState: player,
    isLoading: false,
    initPlayerState,
    updatePlayerState,
    sendCommand,
    clearCommand,
    stopPlayback: stop,
    playNow,
  };
}

export function useQueue() {
  const { queue } = useKaraokeStore();

  const addToQueue = useCallback((song, singerName, dedication = '') => {
    return addQueueItem(song, singerName, dedication);
  }, []);

  const removeFromQueue = useCallback((id) => removeQueueItem(id), []);
  const reorderQueue = useCallback((items) => reorderQueueItems(items), []);
  const playNext = useCallback((id) => startQueueItem(id), []);
  const markPlaying = useCallback((id) => startQueueItem(id), []);
  const markCompleted = useCallback(() => {}, []);

  return {
    queue,
    isLoading: false,
    addToQueue,
    removeFromQueue,
    reorderQueue,
    playNext,
    markPlaying,
    markCompleted,
  };
}

export function useSongs(searchQuery = '', filters = {}) {
  const { customSongs } = useKaraokeStore();

  const allSongs = useMemo(() => {
    const custom = customSongs.map((song) => ({ ...song, lyrics_preview: getLyricsPreview(song) }));
    return [...custom, ...SONG_CATALOG.map((song) => ({ ...song, lyrics_preview: getLyricsPreview(song) }))];
  }, [customSongs]);

  const songs = useMemo(() => {
    return searchSongs(allSongs, searchQuery, filters);
  }, [allSongs, searchQuery, filters]);

  const addSong = useCallback((song) => addCustomSong(song), []);

  return { songs, allSongs, isLoading: false, addSong };
}

function searchSongs(songs, searchQuery, filters) {
  const query = normalizeText(searchQuery);
  const tokens = query.split(' ').filter(Boolean);

  return songs
    .map((song) => ({ song, score: scoreSong(song, query, tokens) }))
    .filter(({ song, score }) => {
      const matchesSearch = !query || score > 0;
      const matchesGenre = !filters.genre || song.genre === filters.genre;
      const matchesLanguage = !filters.language || song.language === filters.language;
      return matchesSearch && matchesGenre && matchesLanguage;
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.song.title.localeCompare(b.song.title);
    })
    .map(({ song }) => song)
    .slice(0, query ? 140 : 100);
}

function scoreSong(song, query, tokens) {
  if (!query) {
    return (song.is_custom ? 6 : 0) + (song.genre === 'opm' ? 2 : 1);
  }

  const title = normalizeText(song.title);
  const artist = normalizeText(song.artist);
  const genre = normalizeText(song.genre);
  const language = normalizeText(song.language);
  const aliases = normalizeText([...(song.aliases || []), ...(song.tags || [])].join(' '));
  const searchQuery = normalizeText(song.search_query);
  const titleArtist = `${title} ${artist}`.trim();
  const artistTitle = `${artist} ${title}`.trim();
  const haystack = `${titleArtist} ${artistTitle} ${genre} ${language} ${aliases} ${searchQuery} karaoke lyrics instrumental`;
  const compactQuery = query.replace(/\s+/g, '');
  const compactTitleArtist = titleArtist.replace(/\s+/g, '');
  const compactArtistTitle = artistTitle.replace(/\s+/g, '');
  const initials = getInitials(titleArtist);
  let score = 0;

  if (title === query) score += 100;
  if (artist === query) score += 70;
  if (titleArtist === query || artistTitle === query) score += 90;
  if (title.startsWith(query)) score += 50;
  if (artist.startsWith(query)) score += 35;
  if (titleArtist.startsWith(query) || artistTitle.startsWith(query)) score += 34;
  if (title.includes(query)) score += 30;
  if (artist.includes(query)) score += 22;
  if (titleArtist.includes(query) || artistTitle.includes(query)) score += 24;
  if (compactQuery.length > 2 && (compactTitleArtist.includes(compactQuery) || compactArtistTitle.includes(compactQuery))) score += 18;
  if (compactQuery.length > 1 && initials.startsWith(compactQuery)) score += 14;
  if (aliases.includes(query)) score += 16;

  for (const token of tokens) {
    if (title.includes(token)) score += 12;
    if (artist.includes(token)) score += 9;
    if (searchQuery.includes(token)) score += 6;
    if (genre.includes(token) || language.includes(token) || aliases.includes(token)) score += 5;
    if (token.length > 2 && hasCloseTokenMatch(token, title)) score += 5;
    if (token.length > 2 && hasCloseTokenMatch(token, artist)) score += 4;
    if (!haystack.includes(token)) score -= 4;
  }

  if (song.source_type?.startsWith('youtube')) score += 4;
  if (song.lyrics) score += 3;
  return score;
}

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getInitials(value) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('');
}

function hasCloseTokenMatch(token, value) {
  return value
    .split(' ')
    .filter((word) => word.length > 2)
    .some((word) => word.startsWith(token) || token.startsWith(word) || editDistanceWithinOne(token, word));
}

function editDistanceWithinOne(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a === b) return true;

  let edits = 0;
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }

    edits += 1;
    if (edits > 1) return false;

    if (a.length > b.length) {
      i += 1;
    } else if (b.length > a.length) {
      j += 1;
    } else {
      i += 1;
      j += 1;
    }
  }

  if (i < a.length || j < b.length) edits += 1;
  return edits <= 1;
}
