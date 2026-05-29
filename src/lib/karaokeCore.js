const emptyCurrent = {
  current_queue_item_id: '',
  current_song_id: '',
  current_song_title: '',
  current_song_artist: '',
  current_singer: '',
  current_video_id: '',
  current_file_path: '',
  current_source_type: 'youtube_search',
  current_search_query: '',
  current_thumbnail: '',
  current_lyrics: '',
  current_lyrics_preview: '',
  current_dedication: '',
};

const KARAOKE_SEARCH_KEYWORDS = ['karaoke', 'instrumental', 'lyrics', 'no vocals'];

export const DEFAULT_PLAYER_STATE = {
  room_id: 'main',
  status: 'idle',
  volume: 80,
  command: 'none',
  command_timestamp: 0,
  command_id: '',
  started_at: 0,
  ...emptyCurrent,
};

export const DEFAULT_STATE = {
  version: 2,
  updated_at: 0,
  queue: [],
  customSongs: [],
  player: DEFAULT_PLAYER_STATE,
};

export function createQueueItem(song, singerName = '', dedication = '', position = 1) {
  const normalized = normalizeSong(song);
  return {
    id: createId('queue'),
    song_id: normalized.id,
    song_title: normalized.title,
    song_artist: normalized.artist,
    singer_name: String(singerName || '').trim() || normalized.artist || 'Unknown artist',
    dedication: String(dedication || '').trim(),
    status: 'waiting',
    position,
    source_type: normalized.source_type,
    video_id: normalized.video_id || '',
    file_path: normalized.file_path || '',
    search_query: normalized.search_query || '',
    thumbnail: normalized.thumbnail || '',
    lyrics: normalized.lyrics || '',
    lyrics_preview: getLyricsPreview(normalized),
    queued_at: Date.now(),
  };
}

export function playerStateFromQueueItem(item, volume = 80) {
  return normalizePlayerState({
    ...DEFAULT_PLAYER_STATE,
    status: 'playing',
    volume,
    current_queue_item_id: item.id,
    current_song_id: item.song_id,
    current_song_title: item.song_title,
    current_song_artist: item.song_artist || '',
    current_singer: item.singer_name,
    current_video_id: item.video_id || '',
    current_file_path: item.file_path || '',
    current_source_type: item.source_type || 'youtube_search',
    current_search_query: item.search_query || '',
    current_thumbnail: item.thumbnail || '',
    current_lyrics: item.lyrics || '',
    current_lyrics_preview: item.lyrics_preview || '',
    current_dedication: item.dedication || '',
    command: 'none',
    command_payload: {},
    command_timestamp: Date.now(),
    command_id: createId('cmd'),
    started_at: Date.now(),
  });
}

export function emptyPlayerCurrent(player = {}) {
  return normalizePlayerState({
    ...player,
    ...emptyCurrent,
    started_at: 0,
  });
}

export function normalizeSong(song = {}) {
  const title = String(song.title || 'Untitled song').trim();
  const artist = String(song.artist || song.singer || 'Unknown artist').trim();
  const sourceType = song.source_type || (song.video_id ? 'youtube' : song.file_path ? 'local' : 'youtube_search');
  const searchQuery = song.search_query ? buildKaraokeSearchQuery(song.search_query) : buildKaraokeSearchQuery(title, artist);

  return {
    id: song.id || createId('song'),
    title,
    artist,
    genre: song.genre || 'karaoke',
    language: song.language || 'unknown',
    source_type: sourceType,
    video_id: song.video_id || '',
    file_path: song.file_path || '',
    search_query: searchQuery,
    thumbnail: song.thumbnail || '',
    lyrics: song.lyrics || '',
    lyrics_preview: song.lyrics_preview || getLyricsPreview(song),
    tags: song.tags || song.aliases || [],
    aliases: song.aliases || song.tags || [],
    provider: song.provider || (sourceType === 'local' ? 'local' : 'library'),
    external_url: song.external_url || '',
    is_custom: !!song.is_custom,
    created_at: Number(song.created_at) || 0,
  };
}

export function normalizeState(state = DEFAULT_STATE) {
  return {
    version: 2,
    updated_at: Number(state.updated_at) || 0,
    queue: normalizeQueue(state.queue || []),
    customSongs: (state.customSongs || []).map(normalizeSong),
    player: normalizePlayerState(state.player || DEFAULT_PLAYER_STATE),
  };
}

export function normalizePlayerState(player = {}) {
  return {
    ...DEFAULT_PLAYER_STATE,
    ...player,
    volume: clamp(Number(player.volume ?? DEFAULT_PLAYER_STATE.volume), 0, 100),
    status: player.status || 'idle',
    command: player.command || 'none',
    command_payload: player.command_payload || {},
    command_timestamp: Number(player.command_timestamp) || 0,
    started_at: Number(player.started_at) || 0,
  };
}

export function normalizeQueue(queue = []) {
  return [...queue]
    .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
    .map((item, index) => ({
      ...item,
      id: item.id || createId('queue'),
      position: index + 1,
      status: item.status || 'waiting',
      singer_name: item.singer_name || item.song_artist || item.artist || 'Unknown artist',
      song_title: item.song_title || item.title || 'Untitled song',
      song_artist: item.song_artist || item.artist || '',
      source_type: item.source_type || (item.video_id ? 'youtube' : item.file_path ? 'local' : 'youtube_search'),
      video_id: item.video_id || '',
      file_path: item.file_path || '',
      search_query: item.search_query
        ? buildKaraokeSearchQuery(item.search_query)
        : buildKaraokeSearchQuery(item.song_title || item.title || '', item.song_artist || item.artist || ''),
      lyrics: item.lyrics || '',
      lyrics_preview: item.lyrics_preview || getLyricsPreview(item),
      thumbnail: item.thumbnail || '',
      queued_at: Number(item.queued_at) || Date.now(),
    }));
}

export function getLyricsPreview(song = {}) {
  if (song.lyrics_preview) return song.lyrics_preview;
  if (song.lyrics) {
    const text = song.lyrics
      .split('\n')
      .map((line) => line.replace(/\[[^\]]+\]/g, '').trim())
      .filter(Boolean)
      .slice(0, 4)
      .join(' / ');
    if (text) return text;
  }
  return 'Lyrics preview unavailable. Karaoke lyrics may appear in the video.';
}

export function buildKaraokeSearchQuery(title = '', artist = '', extra = '') {
  const base = [title, artist, extra]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!base) return '';

  const lower = base.toLowerCase();
  const keywords = KARAOKE_SEARCH_KEYWORDS.filter((keyword) => !lower.includes(keyword));
  return [base, ...keywords].join(' ');
}

export function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}
