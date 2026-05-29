import library from './songs.library.json';
import { buildKaraokeSearchQuery } from '@/lib/karaokeCore';

const defaultPreview =
  'Lyrics preview unavailable. Karaoke lyrics may appear in the video.';

export const SONG_LIBRARY = library;

export const SONG_CATALOG = library.songs.map((song) => {
  const artist = Array.isArray(song.artist) ? song.artist.join(' & ') : song.artist;
  const title = song.title;

  return {
    id: song.id,
    title,
    artist,
    genre: song.genre || 'karaoke',
    language: song.language || 'unknown',
    tags: song.tags || [],
    aliases: song.tags || [],
    source_type: song.source?.type || 'youtube_search',
    search_query: buildKaraokeSearchQuery(title, artist),
    lyrics: song.lyrics || '',
    lyrics_preview: song.lyrics_preview || defaultPreview,
    provider: 'library',
  };
});
