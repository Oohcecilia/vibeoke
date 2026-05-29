import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Parse basic LRC format: [mm:ss.xx] lyric line
function parseLRC(lrc) {
  if (!lrc) return [];
  const lines = lrc.split('\n');
  const parsed = [];
  for (const line of lines) {
    const match = line.match(/\[(\d{2}):(\d{2})(?:\.(\d+))?\](.*)/);
    if (match) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      const ms = parseInt(match[3] || '0') * (match[3]?.length === 2 ? 10 : 1);
      const time = min * 60 + sec + ms / 1000;
      const text = match[4].trim();
      if (text) parsed.push({ time, text });
    }
  }
  if (parsed.length > 0) return parsed.sort((a, b) => a.time - b.time);

  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text, index) => ({ time: index * 4, text }));
}

// Fallback demo lyrics for when none are set
const DEMO_LYRICS = [
  { time: 0,  text: '♪ Music is playing...' },
  { time: 5,  text: 'Sing along!' },
  { time: 10, text: '♪ ♪ ♪' },
];

export default function LyricsDisplay({ lyrics, currentTime = 0, songTitle, artist }) {
  const parsed = lyrics ? parseLRC(lyrics) : DEMO_LYRICS;
  const hasSyncedLyrics = parsed.length > 0;

  // Find current line index
  const currentIndex = (() => {
    let idx = -1;
    for (let i = 0; i < parsed.length; i++) {
      if (parsed[i].time <= currentTime) idx = i;
      else break;
    }
    return idx;
  })();

  const prevLine = currentIndex > 0 ? parsed[currentIndex - 1]?.text : '';
  const currentLine = currentIndex >= 0 ? parsed[currentIndex]?.text : '';
  const nextLine = parsed[currentIndex + 1]?.text || '';
  const nextNextLine = parsed[currentIndex + 2]?.text || '';

  // If no LRC lyrics, show plain text lines
  if (!lyrics || !hasSyncedLyrics) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center select-none">
        <motion.p
          key="nolyrics"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-white/30 text-2xl font-light italic"
        >
          Playing {songTitle}
        </motion.p>
        <p className="text-white/20 text-lg mt-3">{artist}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 md:px-16 text-center select-none gap-6">
      {/* Previous line */}
      <motion.p
        key={`prev-${prevLine}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-white/25 text-xl md:text-2xl lg:text-3xl font-medium transition-all duration-500 min-h-[2em]"
      >
        {prevLine}
      </motion.p>

      {/* Current / active line */}
      <AnimatePresence mode="wait">
        <motion.p
          key={`curr-${currentLine}-${currentIndex}`}
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 1.05, opacity: 0, y: -20 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="text-3xl md:text-5xl lg:text-6xl xl:text-7xl font-black leading-tight"
          style={{
            background: 'linear-gradient(135deg, #e879f9 0%, #818cf8 40%, #38bdf8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: 'none',
            filter: 'drop-shadow(0 0 20px rgba(168,85,247,0.5))',
          }}
        >
          {currentLine || '♪'}
        </motion.p>
      </AnimatePresence>

      {/* Next line */}
      <motion.p
        key={`next-${nextLine}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-white/40 text-xl md:text-2xl lg:text-3xl font-medium transition-all duration-500 min-h-[2em]"
      >
        {nextLine}
      </motion.p>

      {/* Next next line */}
      <motion.p
        key={`nextnext-${nextNextLine}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-white/15 text-base md:text-xl lg:text-2xl font-medium min-h-[1.5em]"
      >
        {nextNextLine}
      </motion.p>
    </div>
  );
}
