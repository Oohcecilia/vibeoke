import { buildKaraokeSearchQuery } from '@/lib/karaokeCore';

export const YOUTUBE_CLASSIFICATIONS = {
  KARAOKE_NO_VOCALS: 'Karaoke (No Vocals)',
  KARAOKE_GUIDE_VOCALS: 'Karaoke (Guide Vocals)',
  ORIGINAL_SONG: 'Original Song',
  INSTRUMENTAL: 'Instrumental',
  LYRIC_VIDEO: 'Lyric Video',
};

const PREFERRED_PHRASES = [
  ['official karaoke', 42],
  ['karaoke version', 38],
  ['karaoke track', 34],
  ['minus one with guide', 32],
  ['minus one', 30],
  ['sing along', 28],
  ['videoke', 26],
  ['karaoke', 24],
  ['no vocals', 24],
  ['no vocal', 24],
  ['without vocals', 22],
  ['with lyrics', 18],
  ['on screen lyrics', 18],
  ['on-screen lyrics', 18],
  ['color coded', 14],
  ['original key', 10],
  ['hq', 6],
  ['hd', 6],
  ['1080p', 6],
  ['720p', 4],
];
const KARAOKE_PATTERNS = [
  /\bofficial karaoke\b/i,
  /\bkaraoke( version| track)?\b/i,
  /\bvideoke\b/i,
  /\bsing[-\s]?along\b/i,
  /\bminus one\b/i,
];
const GUIDE_PATTERNS = [
  /\bwith guide\b/i,
  /\bguide vocal/i,
  /\bguide melody\b/i,
  /\bmelody guide\b/i,
  /\bminus one with guide\b/i,
];
const NO_VOCAL_PATTERNS = [
  /\bno vocals?\b/i,
  /\bwithout vocals?\b/i,
  /\bno lead vocals?\b/i,
  /\bvocal removed\b/i,
  /\bminus one\b/i,
];
const LYRIC_VIDEO_PATTERNS = [
  /\blyric video\b/i,
  /\blyrics video\b/i,
  /\bofficial lyric\b/i,
  /\bmusic[-\s]?free lyrics\b/i,
  /\blyrics only\b/i,
];
const ORIGINAL_PATTERNS = [
  /\bofficial music video\b/i,
  /\boriginal song\b/i,
  /\boriginal audio\b/i,
  /\bofficial audio\b/i,
];
const INSTRUMENTAL_ONLY_PATTERNS = [
  /\binstrumental only\b/i,
  /\bpiano instrumental\b/i,
  /\bguitar instrumental\b/i,
  /\borchestra instrumental\b/i,
  /\bbacking track\b/i,
  /\binstrumental\b/i,
];
const NEGATIVE_PATTERNS = [
  /\breaction\b/i,
  /\breview\b/i,
  /\btutorial\b/i,
  /\blesson\b/i,
  /\bcover by\b/i,
  /\bvocal coach\b/i,
  /\blive performance\b/i,
  /\bconcert\b/i,
  /\bacoustic cover\b/i,
  /\bremix\b/i,
  /\bno music\b/i,
  /\bacapella\b/i,
  /\ba cappella\b/i,
  /\bshorts?\b/i,
];
const SEARCH_MODIFIER_PATTERN = /\b(official karaoke|karaoke version|karaoke track|karaoke|videoke|instrumental|lyrics?|lyric video|no vocals?|without vocals?|minus one(?: with guide)?|sing[-\s]?along|backing track|hd|hq|1080p|720p)\b/gi;
const PIPED_SEARCH_ENDPOINTS = [
  'https://piped.video/api/search',
  'https://pipedapi.kavin.rocks/search',
  'https://pipedapi.adminforge.de/search',
];
const YOUTUBE_API_KEY_PATTERN = /^VITE_YOUTUBE_API_KEY(?:_(\d+))?$/;
const MIN_ACCEPTABLE_SCORE = 36;
const exhaustedYouTubeApiKeys = new Set();
let cachedYouTubeApiKeys = null;

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

export function buildYouTubeSearchQueries(query = '') {
  const subject = stripSearchModifiers(query) || String(query || '').trim();
  const cleanSubject = subject.replace(/\s+/g, ' ').trim();
  if (!cleanSubject) return [];

  return uniqueStrings([
    `${cleanSubject} official karaoke lyrics`,
    `${cleanSubject} karaoke version sing along`,
    `${cleanSubject} minus one with guide`,
    `${cleanSubject} karaoke no vocals`,
    buildKaraokeQuery(cleanSubject),
  ]);
}

export function buildYouTubeSearchUrl(query = '') {
  const search = buildYouTubeSearchQueries(query)[0] || buildKaraokeQuery(query);
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

export function classifyYouTubeResult(result = {}) {
  const text = resultText(result);
  const hasKaraoke = matchesAny(text, KARAOKE_PATTERNS);
  const hasGuide = matchesAny(text, GUIDE_PATTERNS);
  const hasNoVocals = matchesAny(text, NO_VOCAL_PATTERNS);
  const isLyricVideo = matchesAny(text, LYRIC_VIDEO_PATTERNS);
  const isOriginal = matchesAny(text, ORIGINAL_PATTERNS);
  const isInstrumental = matchesAny(text, INSTRUMENTAL_ONLY_PATTERNS);

  if (hasKaraoke && hasGuide) return YOUTUBE_CLASSIFICATIONS.KARAOKE_GUIDE_VOCALS;
  if (hasKaraoke || hasNoVocals) return YOUTUBE_CLASSIFICATIONS.KARAOKE_NO_VOCALS;
  if (isLyricVideo) return YOUTUBE_CLASSIFICATIONS.LYRIC_VIDEO;
  if (isOriginal) return YOUTUBE_CLASSIFICATIONS.ORIGINAL_SONG;
  if (isInstrumental) return YOUTUBE_CLASSIFICATIONS.INSTRUMENTAL;
  return YOUTUBE_CLASSIFICATIONS.ORIGINAL_SONG;
}

function analyzeYouTubeResult(result, sourceQuery = '') {
  const text = resultText(result);
  const classification = classifyYouTubeResult(result);
  let score = classificationScore(classification);

  for (const [phrase, value] of PREFERRED_PHRASES) {
    if (text.includes(phrase)) score += value;
  }

  if (matchesAny(text, NEGATIVE_PATTERNS)) score -= 42;
  if (matchesAny(text, ORIGINAL_PATTERNS) && !matchesAny(text, KARAOKE_PATTERNS)) score -= 52;
  if (matchesAny(text, LYRIC_VIDEO_PATTERNS) && !matchesAny(text, KARAOKE_PATTERNS)) score -= 58;
  if (matchesAny(text, INSTRUMENTAL_ONLY_PATTERNS) && !matchesAny(text, KARAOKE_PATTERNS) && !matchesAny(text, GUIDE_PATTERNS)) score -= 30;
  if (/\b(low quality|bad audio|distorted|chipmunk|pitched|demo)\b/i.test(text)) score -= 24;

  score += relevanceScore(text, sourceQuery);

  return {
    classification,
    score,
    classification_reason: getClassificationReason(classification),
  };
}

function normalizeOfficialItem(item, sourceQuery = '') {
  const videoId = item?.id?.videoId;
  if (!videoId) return null;
  const snippet = item.snippet || {};
  const title = decodeHtml(snippet.title || 'YouTube karaoke result');
  const artist = decodeHtml(snippet.channelTitle || 'YouTube');
  const description = decodeHtml(snippet.description || '');
  const analysis = analyzeYouTubeResult({ title, description, channel: artist }, sourceQuery);

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
    lyrics_preview: getResultPreview(analysis.classification),
    classification: analysis.classification,
    classification_reason: analysis.classification_reason,
    provider: 'youtube',
    external_url: `https://www.youtube.com/watch?v=${videoId}`,
    score: analysis.score,
  };
}

function normalizePipedItem(item, sourceQuery = '') {
  const url = item?.url || item?.urlSlug || '';
  const videoId = extractYouTubeVideoId(url) || extractYouTubeVideoId(item?.id || '');
  if (!videoId || item?.type === 'channel') return null;

  const title = decodeHtml(item.title || 'YouTube karaoke result');
  const artist = decodeHtml(item.uploaderName || item.uploader || 'YouTube');
  const description = decodeHtml(item.shortDescription || item.description || '');
  const analysis = analyzeYouTubeResult({ title, description, channel: artist }, sourceQuery);
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
    lyrics_preview: getResultPreview(analysis.classification),
    classification: analysis.classification,
    classification_reason: analysis.classification_reason,
    provider: 'youtube',
    external_url: `https://www.youtube.com/watch?v=${videoId}`,
    score: analysis.score,
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
    classification: YOUTUBE_CLASSIFICATIONS.KARAOKE_NO_VOCALS,
    classification_reason: 'Direct YouTube links are trusted as user-selected karaoke sources.',
    provider: 'youtube',
    external_url: `https://www.youtube.com/watch?v=${videoId}`,
    score: 120,
  };
}

export async function searchYouTubeKaraoke(query, { signal } = {}) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const direct = directVideoResult(trimmed);
  if (direct) return [direct];

  const apiKeys = getYouTubeApiKeys();
  const searchQueries = buildYouTubeSearchQueries(trimmed);
  let officialSearchError;
  let officialSearchErrorReason = '';

  if (apiKeys.length) {
    for (const apiKey of apiKeys) {
      if (exhaustedYouTubeApiKeys.has(apiKey)) continue;

      try {
        const officialItems = [];

        for (const searchQuery of searchQueries.slice(0, 4)) {
          const url = new URL('https://www.googleapis.com/youtube/v3/search');
          url.searchParams.set('part', 'snippet');
          url.searchParams.set('type', 'video');
          url.searchParams.set('videoEmbeddable', 'true');
          url.searchParams.set('safeSearch', 'none');
          url.searchParams.set('order', 'relevance');
          url.searchParams.set('maxResults', '10');
          url.searchParams.set('q', searchQuery);
          url.searchParams.set('key', apiKey);

          const response = await fetch(url, { signal });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            const apiError = parseYouTubeApiError(data, response.status);
            if (isYouTubeQuotaError(apiError.reason)) {
              exhaustedYouTubeApiKeys.add(apiKey);
              officialSearchError = officialSearchError || new Error(apiError.message);
              officialSearchErrorReason = officialSearchErrorReason || apiError.reason;
              break;
            }

            officialSearchError = new Error(apiError.message);
            officialSearchErrorReason = apiError.reason || officialSearchErrorReason;
            break;
          }

          officialItems.push(...(data.items || []).map((item) => normalizeOfficialItem(item, trimmed)).filter(Boolean));
        }

        const results = sortAndDedupe(officialItems);
        if (results.length > 0) return results;
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        officialSearchError = error;
      }
    }
  }

  const errors = [];
  for (const endpoint of PIPED_SEARCH_ENDPOINTS) {
    try {
      const items = [];
      for (const searchQuery of searchQueries.slice(0, 3)) {
        const url = new URL(endpoint);
        url.searchParams.set('q', searchQuery);
        url.searchParams.set('filter', 'videos');
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error(`Search failed at ${endpoint}`);
        const data = await response.json();
        const endpointItems = Array.isArray(data) ? data : data.items || [];
        items.push(...endpointItems.map((item) => normalizePipedItem(item, trimmed)).filter(Boolean));
      }
      const results = sortAndDedupe(items);
      if (results.length > 0) return results.slice(0, 12);
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      errors.push(error);
    }
  }

  if (errors.length) throw errors[0];
  if (officialSearchError && !isYouTubeQuotaError(officialSearchErrorReason)) throw officialSearchError;
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
    classification: best.classification,
    classification_reason: best.classification_reason,
    lyrics_preview: song.lyrics_preview || best.lyrics_preview,
  };
}

function sortAndDedupe(results) {
  const seen = new Set();
  const seenTitles = new Set();
  return results
    .filter((result) => {
      if (!result.video_id || seen.has(result.video_id)) return false;
      seen.add(result.video_id);
      if (!isAcceptableKaraokeResult(result)) return false;
      const titleKey = normalizeComparable(`${result.title} ${result.artist}`);
      if (titleKey && seenTitles.has(titleKey)) return false;
      seenTitles.add(titleKey);
      return true;
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0));
}

function isAcceptableKaraokeResult(result) {
  if (!result) return false;
  if (result.score >= MIN_ACCEPTABLE_SCORE && result.classification?.startsWith('Karaoke')) return true;
  if (result.score >= 72 && result.classification === YOUTUBE_CLASSIFICATIONS.INSTRUMENTAL) return true;
  return false;
}

function classificationScore(classification) {
  if (classification === YOUTUBE_CLASSIFICATIONS.KARAOKE_NO_VOCALS) return 80;
  if (classification === YOUTUBE_CLASSIFICATIONS.KARAOKE_GUIDE_VOCALS) return 68;
  if (classification === YOUTUBE_CLASSIFICATIONS.INSTRUMENTAL) return 8;
  if (classification === YOUTUBE_CLASSIFICATIONS.LYRIC_VIDEO) return -38;
  return -28;
}

function relevanceScore(text, sourceQuery) {
  const subject = stripSearchModifiers(sourceQuery);
  const tokens = normalizeComparable(subject)
    .split(' ')
    .filter((token) => token.length > 2)
    .slice(0, 8);

  if (!tokens.length) return 0;

  const hits = tokens.filter((token) => text.includes(token)).length;
  const misses = tokens.length - hits;
  return hits * 8 - misses * 4;
}

function resultText(result = {}) {
  return normalizeComparable([
    result.title,
    result.description,
    result.channel,
    result.artist,
  ].filter(Boolean).join(' '));
}

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function stripSearchModifiers(query = '') {
  return String(query || '')
    .replace(SEARCH_MODIFIER_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeComparable(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&amp;/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function uniqueStrings(values) {
  const seen = new Set();
  return values
    .map((value) => String(value || '').replace(/\s+/g, ' ').trim())
    .filter((value) => {
      const key = value.toLowerCase();
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getResultPreview(classification) {
  if (classification === YOUTUBE_CLASSIFICATIONS.KARAOKE_GUIDE_VOCALS) {
    return 'Karaoke result with guide vocals or guide melody. On-screen lyrics may be available in the video.';
  }
  if (classification === YOUTUBE_CLASSIFICATIONS.KARAOKE_NO_VOCALS) {
    return 'Karaoke result prioritized for no lead vocals, backing music, and on-screen lyrics.';
  }
  if (classification === YOUTUBE_CLASSIFICATIONS.INSTRUMENTAL) {
    return 'Instrumental result. It may not include synchronized lyrics or guide melody.';
  }
  if (classification === YOUTUBE_CLASSIFICATIONS.LYRIC_VIDEO) {
    return 'Lyric video result. It may include original vocals instead of karaoke audio.';
  }
  return 'YouTube result. Karaoke quality depends on the selected video.';
}

function getClassificationReason(classification) {
  if (classification === YOUTUBE_CLASSIFICATIONS.KARAOKE_GUIDE_VOCALS) return 'Karaoke metadata includes guide-vocal or guide-melody wording.';
  if (classification === YOUTUBE_CLASSIFICATIONS.KARAOKE_NO_VOCALS) return 'Karaoke metadata indicates a sing-along, minus-one, videoke, or no-vocal version.';
  if (classification === YOUTUBE_CLASSIFICATIONS.INSTRUMENTAL) return 'Metadata appears instrumental without strong karaoke lyric signals.';
  if (classification === YOUTUBE_CLASSIFICATIONS.LYRIC_VIDEO) return 'Metadata appears to be a lyric video rather than karaoke playback.';
  return 'Metadata appears closer to an original song than a karaoke version.';
}

function decodeHtml(value) {
  if (typeof document === 'undefined') return value;
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

function getYouTubeApiKeys() {
  if (cachedYouTubeApiKeys) return cachedYouTubeApiKeys;

  const keys = Object.entries(import.meta.env)
    .filter(([name, value]) => YOUTUBE_API_KEY_PATTERN.test(name) && String(value || '').trim())
    .map(([name, value]) => {
      const match = name.match(YOUTUBE_API_KEY_PATTERN);
      const suffix = match?.[1] ? Number(match[1]) : 0;
      return { suffix, value: String(value).trim() };
    })
    .sort((a, b) => a.suffix - b.suffix || a.value.localeCompare(b.value))
    .map(({ value }) => value);

  cachedYouTubeApiKeys = keys;
  return keys;
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

function parseYouTubeApiError(data, status) {
  const reason = data?.error?.errors?.[0]?.reason;
  return {
    reason,
    message: getYouTubeApiErrorMessage(data, status),
  };
}

function isYouTubeQuotaError(reason) {
  return reason === 'quotaExceeded' || reason === 'dailyLimitExceeded';
}
