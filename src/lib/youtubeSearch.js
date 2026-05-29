import { buildKaraokeSearchQuery } from '@/lib/karaokeCore';

const KARAOKE_TERMS = ['karaoke', 'videoke', 'instrumental', 'lyrics', 'no vocals', 'sing along', 'minus one', 'backing track'];
const NEGATIVE_TERMS = ['reaction', 'review', 'tutorial', 'lesson', 'cover by', 'vocal coach', 'official music video', 'live performance'];
const PIPED_SEARCH_ENDPOINTS = [
  'https://piped.video/api/search',
  'https://pipedapi.kavin.rocks/search',
  'https://pipedapi.adminforge.de/search',
];

export function extractYouTubeVideoId(value = '') {
  const input = value.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

  try {
    const url = new URL(input);
    if (url.hostname.includes('youtu.be')) {
      return url.pathname.split('/').filter(Boolean)[0] || '';
    }
    if (url.hostname.includes('youtube.com')) {
      const fromQuery = url.searchParams.get('v');
      if (fromQuery) return fromQuery;
      const parts = url.pathname.split('/').filter(Boolean);
      const embedIndex = parts.findIndex((part) => ['embed', 'shorts', 'live'].includes(part));
      if (embedIndex >= 0 && parts[embedIndex + 1]) return parts[embedIndex + 1];
    }
  } catch (_error) {
    return '';
  }

  return '';
}

export function thumbnailForVideo(videoId, quality = 'mqdefault') {
  return videoId ? `https://img.youtube.com/vi/${videoId}/${quality}.jpg` : '';
}

export function buildKaraokeQuery(query = '') {
  return buildKaraokeSearchQuery(query);
}

export function buildYouTubeSearchUrl(query = '') {
  const search = buildKaraokeQuery(query);
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(search)}`;
}

export function getPlayableLabel(song) {
  if (song?.video_id) return 'YouTube video';
  if (song?.source_type === 'local') return 'Local file';
  return 'YouTube search';
}

export function buildEmbedUrl(song, autoplay = false) {
  if (!song) return '';
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    controls: '1',
    modestbranding: '1',
    rel: '0',
    playsinline: '1',
  });

  if (song.video_id) {
    return `https://www.youtube.com/embed/${song.video_id}?${params.toString()}`;
  }

  const query = song.search_query || buildKaraokeQuery(`${song.title || ''} ${song.artist || ''}`);
  params.set('listType', 'search');
  params.set('list', query);
  return `https://www.youtube.com/embed?${params.toString()}`;
}

function scoreKaraokeResult(result) {
  const title = `${result.title || ''} ${result.description || ''}`.toLowerCase();
  let score = 0;

  for (const term of KARAOKE_TERMS) {
    if (title.includes(term)) {
      if (term === 'karaoke' || term === 'videoke') score += 12;
      else if (term === 'instrumental' || term === 'no vocals' || term === 'minus one') score += 8;
      else if (term === 'lyrics') score += 6;
      else score += 4;
    }
  }
  for (const term of NEGATIVE_TERMS) {
    if (title.includes(term)) score -= 6;
  }
  if (/karaoke\s*(version|track)|instrumental\s*(version|track)|no\s+vocal/i.test(title)) score += 6;
  if (/hd|hq/i.test(title)) score += 1;
  return score;
}

function normalizeOfficialItem(item) {
  const videoId = item?.id?.videoId;
  if (!videoId) return null;
  const snippet = item.snippet || {};
  const title = decodeHtml(snippet.title || 'YouTube karaoke result');
  const artist = decodeHtml(snippet.channelTitle || 'YouTube');

  return {
    id: `youtube-${videoId}`,
    title,
    artist,
    genre: 'karaoke',
    language: 'unknown',
    source_type: 'youtube',
    video_id: videoId,
    thumbnail: snippet.thumbnails?.medium?.url || thumbnailForVideo(videoId),
    search_query: buildKaraokeQuery(title),
    lyrics_preview: 'YouTube karaoke result. On-screen lyrics or captions may be available in the video.',
    provider: 'youtube',
    external_url: `https://www.youtube.com/watch?v=${videoId}`,
    score: scoreKaraokeResult({ title, description: snippet.description }),
  };
}

function normalizePipedItem(item) {
  const url = item?.url || item?.urlSlug || '';
  const videoId = extractYouTubeVideoId(url) || extractYouTubeVideoId(item?.id || '');
  if (!videoId || item?.type === 'channel') return null;

  const title = decodeHtml(item.title || 'YouTube karaoke result');
  const artist = decodeHtml(item.uploaderName || item.uploader || 'YouTube');
  const thumbnail = Array.isArray(item.thumbnails)
    ? item.thumbnails[0]?.url
    : item.thumbnail || thumbnailForVideo(videoId);

  return {
    id: `youtube-${videoId}`,
    title,
    artist,
    genre: 'karaoke',
    language: 'unknown',
    source_type: 'youtube',
    video_id: videoId,
    thumbnail,
    duration: item.duration,
    search_query: buildKaraokeQuery(title),
    lyrics_preview: 'YouTube karaoke result. On-screen lyrics or captions may be available in the video.',
    provider: 'youtube',
    external_url: `https://www.youtube.com/watch?v=${videoId}`,
    score: scoreKaraokeResult({ title, description: item.shortDescription }),
  };
}

function directVideoResult(input) {
  const videoId = extractYouTubeVideoId(input);
  if (!videoId) return null;

  return {
    id: `youtube-${videoId}`,
    title: 'YouTube karaoke video',
    artist: 'Direct YouTube link',
    genre: 'karaoke',
    language: 'unknown',
    source_type: 'youtube',
    video_id: videoId,
    thumbnail: thumbnailForVideo(videoId),
    search_query: 'YouTube karaoke',
    lyrics_preview: 'Direct YouTube video. Lyrics appear if the video includes them.',
    provider: 'youtube',
    external_url: `https://www.youtube.com/watch?v=${videoId}`,
    score: 20,
  };
}

export async function searchYouTubeKaraoke(query, { signal } = {}) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const direct = directVideoResult(trimmed);
  if (direct) return [direct];

  const apiKey = getYouTubeApiKey();
  const searchQuery = buildKaraokeQuery(trimmed);
  let officialSearchError;

  if (apiKey) {
    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/search');
      url.searchParams.set('part', 'snippet');
      url.searchParams.set('type', 'video');
      url.searchParams.set('videoEmbeddable', 'true');
      url.searchParams.set('safeSearch', 'none');
      url.searchParams.set('maxResults', '16');
      url.searchParams.set('q', searchQuery);
      url.searchParams.set('key', apiKey);

      const response = await fetch(url, { signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(getYouTubeApiErrorMessage(data, response.status));
      }

      const results = sortAndDedupe((data.items || []).map(normalizeOfficialItem).filter(Boolean));
      if (results.length > 0) return results;
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      officialSearchError = error;
    }
  }

  const errors = [];
  for (const endpoint of PIPED_SEARCH_ENDPOINTS) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set('q', searchQuery);
      url.searchParams.set('filter', 'videos');
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`Search failed at ${endpoint}`);
      const data = await response.json();
      const items = Array.isArray(data) ? data : data.items || [];
      const results = sortAndDedupe(items.map(normalizePipedItem).filter(Boolean));
      if (results.length > 0) return results.slice(0, 12);
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      errors.push(error);
    }
  }

  if (officialSearchError) throw officialSearchError;
  if (errors.length) throw errors[0];
  return [];
}

export async function resolveYouTubeSong(song, { signal } = {}) {
  if (!song) throw new Error('Choose a song first.');
  if (song.source_type === 'local' || song.video_id) return song;

  const query = song.search_query || buildKaraokeSearchQuery(song.title, song.artist);
  const results = await searchYouTubeKaraoke(query, { signal });
  const best = results[0];

  if (!best?.video_id) {
    throw new Error('No playable karaoke video was found for this song.');
  }

  return {
    ...song,
    source_type: 'youtube',
    video_id: best.video_id,
    thumbnail: song.thumbnail || best.thumbnail || thumbnailForVideo(best.video_id),
    search_query: query,
    provider: 'youtube',
    external_url: best.external_url,
    lyrics_preview: song.lyrics_preview || best.lyrics_preview,
  };
}

function sortAndDedupe(results) {
  const seen = new Set();
  return results
    .filter((result) => {
      if (!result.video_id || seen.has(result.video_id)) return false;
      seen.add(result.video_id);
      return true;
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0));
}

function decodeHtml(value) {
  if (typeof document === 'undefined') return value;
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

function getYouTubeApiKey() {
  return String(import.meta.env.VITE_YOUTUBE_API_KEY || '').trim();
}

function getYouTubeApiErrorMessage(data, status) {
  const reason = data?.error?.errors?.[0]?.reason;
  const message = data?.error?.message;

  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
    return 'YouTube API quota is exhausted for this key.';
  }
  if (reason === 'accessNotConfigured') {
    return 'YouTube Data API v3 is not enabled for this key.';
  }
  if (reason === 'keyInvalid' || reason === 'badRequest') {
    return 'The YouTube API key is invalid or restricted incorrectly.';
  }

  return message || `YouTube search failed with status ${status}.`;
}
