import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useKaraokeStore, usePlayerState, useQueue } from '@/hooks/useKaraokeState';
import LyricsDisplay from '@/components/karaoke/LyricsDisplay';
import NeonText from '@/components/karaoke/NeonText';
import { motion } from 'framer-motion';
import { Maximize2, Mic2, Minimize2, SkipForward, WifiOff } from 'lucide-react';
import { loadYouTubeIframeApi } from '@/lib/youtubeIframe';
import { resolveYouTubeSong } from '@/lib/youtubeSearch';
import { buildKaraokeSearchQuery } from '@/lib/karaokeCore';

export default function PlayerScreen() {
  const { connection } = useKaraokeStore();
  const { playerState, updatePlayerState, clearCommand, stopPlayback } = usePlayerState();
  const { queue, playNext } = useQueue();

  const [currentLyricTime, setCurrentLyricTime] = useState(0);
  const [mediaError, setMediaError] = useState('');
  const [isResolvingVideo, setIsResolvingVideo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const playerRef = useRef(null);
  const screenRef = useRef(null);
  const ytHostRef = useRef(null);
  const videoRef = useRef(null);
  const lyricTimerRef = useRef(null);
  const lastCommandRef = useRef('');
  const advanceRef = useRef(null);
  const statusRef = useRef(playerState?.status || 'idle');

  const hasCurrentSong = !!playerState?.current_queue_item_id;
  const isLocal = playerState?.current_source_type === 'local';
  const isYouTube = hasCurrentSong && !isLocal;
  const isOnline = connection?.status === 'online';
  const sourceKey = useMemo(() => {
    return [
      playerState?.current_source_type,
      playerState?.current_video_id,
      playerState?.current_file_path,
      playerState?.current_search_query,
      playerState?.current_queue_item_id,
    ].join('|');
  }, [
    playerState?.current_source_type,
    playerState?.current_video_id,
    playerState?.current_file_path,
    playerState?.current_search_query,
    playerState?.current_queue_item_id,
  ]);

  const stopLyricTimer = useCallback(() => {
    if (lyricTimerRef.current) {
      window.clearInterval(lyricTimerRef.current);
      lyricTimerRef.current = null;
    }
  }, []);

  const startLyricTimer = useCallback(() => {
    stopLyricTimer();
    lyricTimerRef.current = window.setInterval(() => {
      const time = playerRef.current?.getCurrentTime?.() || videoRef.current?.currentTime || 0;
      setCurrentLyricTime(time);
    }, 180);
  }, [stopLyricTimer]);

  const advanceToNext = useCallback(async () => {
    stopLyricTimer();
    setCurrentLyricTime(0);
    setMediaError('');

    if (queue.length > 0) {
      await playNext();
    } else {
      await stopPlayback('idle');
    }
  }, [playNext, queue.length, stopLyricTimer, stopPlayback]);

  const toggleFullscreen = useCallback(async () => {
    const target = screenRef.current || document.documentElement;
    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;

    if (fullscreenElement) {
      await (document.exitFullscreen?.() || document.webkitExitFullscreen?.());
      return;
    }

    await (target.requestFullscreen?.() || target.webkitRequestFullscreen?.());
  }, []);

  useEffect(() => {
    advanceRef.current = advanceToNext;
  }, [advanceToNext]);

  useEffect(() => {
    statusRef.current = playerState?.status || 'idle';
  }, [playerState?.status]);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement));
    };

    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('webkitfullscreenchange', syncFullscreenState);
    syncFullscreenState();

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState);
    };
  }, []);

  useEffect(() => {
    if (playerState?.status === 'idle' && !hasCurrentSong && queue.length > 0) {
      playNext().catch((error) => setMediaError(error.message || 'Could not start the next song.'));
    }
  }, [hasCurrentSong, playNext, playerState?.status, queue.length]);

  useEffect(() => {
    setCurrentLyricTime(0);
    setMediaError('');
  }, [playerState?.current_queue_item_id]);

  useEffect(() => {
    if (!isYouTube || playerState?.current_video_id || !playerState?.current_search_query) return undefined;

    const controller = new AbortController();
    setIsResolvingVideo(true);
    setMediaError('');

    resolveYouTubeSong(
      {
        id: playerState.current_song_id,
        title: playerState.current_song_title,
        artist: playerState.current_song_artist,
        source_type: playerState.current_source_type,
        search_query: buildKaraokeSearchQuery(playerState.current_song_title, playerState.current_song_artist),
        lyrics_preview: playerState.current_lyrics_preview,
      },
      { signal: controller.signal },
    )
      .then((resolved) => {
        if (!controller.signal.aborted) {
          updatePlayerState({
            current_video_id: resolved.video_id,
            current_thumbnail: resolved.thumbnail || playerState.current_thumbnail,
            current_source_type: 'youtube',
            current_search_query: buildKaraokeSearchQuery(playerState.current_song_title, playerState.current_song_artist),
          }).catch((error) => setMediaError(error.message || 'Could not sync resolved video.'));
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setMediaError(error.message || 'Could not find a playable karaoke video for this song.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsResolvingVideo(false);
      });

    return () => controller.abort();
  }, [
    isYouTube,
    playerState?.current_search_query,
    playerState?.current_song_artist,
    playerState?.current_song_id,
    playerState?.current_song_title,
    playerState?.current_source_type,
    playerState?.current_thumbnail,
    playerState?.current_video_id,
    playerState?.current_lyrics_preview,
    updatePlayerState,
  ]);

  useEffect(() => {
    if (!isYouTube || !ytHostRef.current) return undefined;
    if (!playerState.current_video_id) return undefined;

    let disposed = false;

    loadYouTubeIframeApi().then((YT) => {
      if (disposed || !ytHostRef.current) return;
      destroyYouTubePlayer(playerRef);

      const mount = document.createElement('div');
      mount.id = `yt-player-${Date.now()}`;
      ytHostRef.current.innerHTML = '';
      ytHostRef.current.appendChild(mount);

      playerRef.current = new YT.Player(mount.id, {
        width: '100%',
        height: '100%',
        videoId: playerState.current_video_id,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 1,
          iv_load_policy: 3,
          modestbranding: 1,
          origin: window.location.origin,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(playerState.volume || 80);

            if (playerState.status === 'paused') {
              event.target.pauseVideo();
            } else {
              event.target.playVideo();
            }

            startLyricTimer();
          },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.ENDED) {
              advanceRef.current?.();
            }
            if (event.data === YT.PlayerState.PLAYING && statusRef.current !== 'playing') {
              updatePlayerState({ status: 'playing' }).catch(() => {});
              startLyricTimer();
            }
            if (event.data === YT.PlayerState.PAUSED && statusRef.current === 'playing') {
              updatePlayerState({ status: 'paused' }).catch(() => {});
              stopLyricTimer();
            }
          },
          onError: () => {
            setMediaError('This YouTube video cannot be embedded. Use Next or choose another song.');
          },
        },
      });
    });

    return () => {
      disposed = true;
      stopLyricTimer();
      destroyYouTubePlayer(playerRef);
      if (ytHostRef.current) ytHostRef.current.innerHTML = '';
    };
  }, [
    isYouTube,
    playerState?.current_video_id,
    sourceKey,
    startLyricTimer,
    stopLyricTimer,
    updatePlayerState,
  ]);

  useEffect(() => {
    if (playerRef.current?.setVolume) playerRef.current.setVolume(playerState?.volume || 80);
    if (videoRef.current) videoRef.current.volume = (playerState?.volume || 80) / 100;
  }, [playerState?.volume]);

  useEffect(() => {
    if (!hasCurrentSong) return;

    if (playerState?.status === 'playing') {
      playerRef.current?.playVideo?.();
      videoRef.current?.play?.().catch(() => {});
      startLyricTimer();
    }

    if (playerState?.status === 'paused') {
      playerRef.current?.pauseVideo?.();
      videoRef.current?.pause?.();
      stopLyricTimer();
    }
  }, [hasCurrentSong, playerState?.status, startLyricTimer, stopLyricTimer]);

  useEffect(() => {
    const commandKey = playerState?.command_id || `${playerState?.command}-${playerState?.command_timestamp}`;
    if (!playerState?.command || playerState.command === 'none') return;
    if (commandKey === lastCommandRef.current) return;
    lastCommandRef.current = commandKey;

    if (playerState.command === 'pause') {
      playerRef.current?.pauseVideo?.();
      videoRef.current?.pause?.();
      updatePlayerState({ status: 'paused' }).catch(() => {});
      clearCommand().catch(() => {});
      return;
    }

    if (playerState.command === 'resume' || playerState.command === 'play') {
      playerRef.current?.playVideo?.();
      videoRef.current?.play?.().catch(() => {});
      updatePlayerState({ status: 'playing' }).catch(() => {});
      clearCommand().catch(() => {});
      return;
    }

    if (playerState.command === 'stop') {
      playerRef.current?.stopVideo?.();
      videoRef.current?.pause?.();
      stopPlayback('stopped').catch(() => {});
      return;
    }

    if (playerState.command === 'next') {
      advanceRef.current?.();
    }
  }, [advanceToNext, clearCommand, playerState, stopPlayback, updatePlayerState]);

  useEffect(() => {
    return () => stopLyricTimer();
  }, [stopLyricTimer]);

  return (
    <div ref={screenRef} className="h-screen w-screen bg-black overflow-hidden relative text-white">
      <div className="absolute inset-0 z-0 bg-black">
        {hasCurrentSong ? (
          <>
            {isLocal ? (
              <video
                ref={videoRef}
                key={sourceKey}
                src={playerState.current_file_path}
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-contain bg-black"
                onEnded={() => advanceRef.current?.()}
                onTimeUpdate={(event) => setCurrentLyricTime(event.currentTarget.currentTime)}
                onError={() => setMediaError('The local video file could not be played.')}
              />
            ) : (
              <div ref={ytHostRef} className="absolute inset-0 bg-black [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full" />
            )}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/45 via-transparent to-black/30" />
          </>
        ) : (
          <IdleBackground />
        )}
      </div>

      <PlayerTopBar queue={queue} />

      {!isOnline && (
        <div className="absolute z-30 top-5 right-5 rounded-lg border border-red-400/30 bg-black/60 px-3 py-2 text-red-100 flex items-center gap-2 text-sm backdrop-blur-md">
          <WifiOff className="w-4 h-4" />
          Realtime offline
        </div>
      )}

      {(isResolvingVideo || mediaError) && (
        <div className="absolute z-30 top-20 left-1/2 -translate-x-1/2 max-w-[min(90vw,720px)] rounded-lg border border-white/15 bg-black/65 px-4 py-2 text-center text-sm text-white/80 backdrop-blur-md">
          {isResolvingVideo ? 'Finding karaoke video...' : mediaError}
        </div>
      )}

      <main className="relative z-10 h-full w-full flex items-center justify-center pointer-events-none">
        {!hasCurrentSong ? (
          <IdleMessage queueLength={queue.length} stopped={playerState?.status === 'stopped'} />
        ) : playerState?.current_lyrics ? (
          <LyricsDisplay
            lyrics={playerState.current_lyrics}
            currentTime={currentLyricTime}
            songTitle={playerState.current_song_title}
            artist={playerState.current_song_artist}
          />
        ) : null}
      </main>

      <PlayerControls
        canAdvance={queue.length > 0 || hasCurrentSong}
        isFullscreen={isFullscreen}
        onNext={advanceToNext}
        onFullscreen={toggleFullscreen}
      />
    </div>
  );
}

function PlayerTopBar({ queue }) {
  return (
    <div className="absolute z-30 top-0 left-0 right-0 pointer-events-none bg-gradient-to-b from-black/82 via-black/38 to-transparent px-3 sm:px-5 py-2.5 sm:py-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="shrink-0 h-10 rounded-lg border border-primary/30 bg-black/45 px-3 flex items-center gap-2 backdrop-blur-md">
          <Mic2 className="w-4 h-4 text-primary" />
          <span className="font-orbitron text-xs sm:text-sm font-black tracking-[0.22em] text-primary">VIBEOKE</span>
        </div>
        <QueueRibbon queue={queue} />
      </div>
    </div>
  );
}

function QueueRibbon({ queue }) {
  if (!queue.length) {
    return (
      <div className="min-w-0 flex-1 h-10 rounded-lg border border-white/10 bg-black/25 px-3 flex items-center text-[11px] uppercase tracking-[0.18em] text-white/45 backdrop-blur-md">
        Queue ready
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1 flex items-center gap-2 overflow-hidden">
      {queue.slice(0, 8).map((item, index) => (
        <div
          key={item.id}
          className={`min-w-0 shrink-0 rounded-md border px-2.5 py-1.5 backdrop-blur-md ${
            index === 0
              ? 'max-w-[28vw] border-accent/40 bg-accent/15'
              : 'max-w-[18vw] border-white/10 bg-black/35'
          }`}
        >
          {index === 0 && (
            <p className="text-[8px] sm:text-[9px] font-black tracking-[0.24em] text-accent leading-none mb-1">
              NEXT
            </p>
          )}
          <p className={`truncate font-black uppercase tracking-wide leading-tight ${index === 0 ? 'text-[11px] sm:text-sm' : 'text-[10px] sm:text-xs text-white/75'}`}>
            {item.song_title}
          </p>
        </div>
      ))}
    </div>
  );
}

function PlayerControls({ canAdvance, isFullscreen, onNext, onFullscreen }) {
  return (
    <div className="absolute z-40 right-3 top-3 sm:right-5 sm:top-5 flex items-center gap-2 pointer-events-auto">
      <PlayerControlButton label="Next" onClick={onNext} disabled={!canAdvance}>
        <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
      </PlayerControlButton>
      <PlayerControlButton label={isFullscreen ? 'Exit full screen' : 'Full screen'} onClick={onFullscreen}>
        {isFullscreen ? <Minimize2 className="w-3 h-3 sm:w-5 sm:h-4" /> : <Maximize2 className="w-3 h-3 sm:w-4 sm:h-5" />}
      </PlayerControlButton>
    </div>
  );
}

function PlayerControlButton({ children, label, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="h-11 sm:h-12 px-3 sm:px-4 rounded-lg border border-white/15 bg-black/52 text-white flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-wide backdrop-blur-md shadow-xl shadow-black/35 hover:border-primary/50 hover:bg-primary/18 disabled:opacity-40 disabled:pointer-events-none transition-colors"
    >
      {children}
    </button>
  );
}

function destroyYouTubePlayer(playerRef) {
  if (playerRef.current?.destroy) {
    playerRef.current.destroy();
  }
  playerRef.current = null;
}

function IdleBackground() {
  return (
    <div className="absolute inset-0 bg-[linear-gradient(135deg,#07080d_0%,#101119_50%,#030407_100%)]">
      <div className="absolute inset-0 opacity-[0.14] bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:72px_72px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.78)_72%)]" />
    </div>
  );
}

function IdleMessage({ queueLength, stopped }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-8">
      <motion.div
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        className="mb-8"
      >
        <div className="w-28 h-28 md:w-36 md:h-36 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center mx-auto">
          <Mic2 className="w-14 h-14 md:w-16 md:h-16 text-primary/70" />
        </div>
      </motion.div>

      <NeonText color="purple" as="h1" className="text-5xl md:text-7xl lg:text-8xl font-orbitron font-black tracking-widest block mb-4">
        VIBEOKE
      </NeonText>
      <p className="text-white/55 text-lg md:text-xl max-w-xl">
        {queueLength > 0 && !stopped ? 'Loading the next reserved song...' : stopped ? 'Playback is stopped.' : 'Waiting for reserved songs.'}
      </p>
    </div>
  );
}
