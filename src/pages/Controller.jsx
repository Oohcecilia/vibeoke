import React, { useMemo, useState } from 'react';
import { useKaraokeStore, usePlayerState, useQueue, useSongs } from '@/hooks/useKaraokeState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Disc3,
  GripVertical,
  Library,
  ListMusic,
  Mic2,
  Music,
  Pause,
  Play,
  Plus,
  Save,
  Search,
  SkipForward,
  Square,
  Trash2,
  Tv,
  Upload,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { buildKaraokeSearchQuery } from '@/lib/karaokeCore';
import { extractYouTubeVideoId, thumbnailForVideo } from '@/lib/youtubeSearch';

export default function Controller() {
  const [activeTab, setActiveTab] = useState('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [queueingSongId, setQueueingSongId] = useState('');
  const [libraryEditorOpen, setLibraryEditorOpen] = useState(false);
  const [songDraft, setSongDraft] = useState(createEmptySongDraft());
  const [bulkImport, setBulkImport] = useState('');
  const [isSavingSong, setIsSavingSong] = useState(false);

  const { connection } = useKaraokeStore();
  const { playerState, sendCommand, stopPlayback } = usePlayerState();
  const { queue, addToQueue, removeFromQueue, reorderQueue, playNext } = useQueue();
  const { songs, allSongs, isLoading, addSong } = useSongs(searchQuery, {});

  const isPlaying = playerState?.status === 'playing';
  const isPaused = playerState?.status === 'paused';
  const hasCurrentSong = !!playerState?.current_song_title;
  const isOnline = connection?.status === 'online';

  const queueCountLabel = useMemo(() => {
    if (queue.length === 0) return 'Queue';
    return `Queue (${queue.length})`;
  }, [queue.length]);

  const reserveSong = async (song) => {
    if (!song || queueingSongId) return;

    setQueueingSongId(song.id);
    try {
      await addToQueue({
        ...song,
        source_type: song.video_id ? 'youtube' : 'youtube_search',
        search_query: buildKaraokeSearchQuery(song.title, song.artist),
      }, song.artist, '');
      toast.success(`Reserved "${song.title}"`);
    } catch (error) {
      toast.error(error.message || 'Could not reserve this song.');
    } finally {
      setQueueingSongId('');
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const items = Array.from(queue);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    try {
      await reorderQueue(items);
    } catch (error) {
      toast.error(error.message || 'Could not reorder queue.');
    }
  };

  const handleNext = async () => {
    if (queue.length === 0) {
      await stopPlayback('idle');
      toast.message('No reserved song is waiting');
      return;
    }

    const started = await playNext();
    if (started) toast.success(`Playing "${started.song_title}"`);
  };

  const handlePlayQueueItem = async (item) => {
    const started = await playNext(item.id);
    if (started) toast.success(`Playing "${started.song_title}"`);
  };

  const handleStop = async () => {
    await stopPlayback('stopped');
    toast.success('Playback stopped');
  };

  const handleDraftChange = (field, value) => {
    setSongDraft((draft) => ({ ...draft, [field]: value }));
  };

  const handleSaveSong = async (event) => {
    event.preventDefault();
    const song = createSongFromDraft(songDraft);
    if (!song) {
      toast.error('Add both a song title and artist.');
      return;
    }

    setIsSavingSong(true);
    try {
      await addSong(song);
      setSongDraft(createEmptySongDraft());
      toast.success(`Added "${song.title}" to the library`);
    } catch (error) {
      toast.error(error.message || 'Could not add this song.');
    } finally {
      setIsSavingSong(false);
    }
  };

  const handleImportSongs = async () => {
    const songsToImport = parseImportedSongs(bulkImport);
    if (songsToImport.length === 0) {
      toast.error('Paste songs as "Title - Artist", one song per line.');
      return;
    }

    setIsSavingSong(true);
    try {
      for (const song of songsToImport) {
        await addSong(song);
      }
      setBulkImport('');
      toast.success(`Imported ${songsToImport.length} songs`);
    } catch (error) {
      toast.error(error.message || 'Could not import songs.');
    } finally {
      setIsSavingSong(false);
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
      <header className="shrink-0 bg-card/85 backdrop-blur border-b border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
            <Mic2 className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-orbitron font-bold text-sm tracking-widest text-primary truncate">VIBEOKE</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Controller</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`hidden sm:flex items-center gap-1.5 text-xs ${isOnline ? 'text-accent' : 'text-destructive'}`}>
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {isOnline ? 'Synced' : 'Offline'}
          </div>
          <Link to="/player">
            <Button size="sm" variant="outline" className="h-10 gap-2 border-primary/25 text-primary hover:bg-primary/10">
              <Tv className="w-4 h-4" />
              Player
            </Button>
          </Link>
        </div>
      </header>

      <section className="shrink-0 px-3 sm:px-4 pt-2 sm:pt-3">
        <div className="rounded-lg border border-border/50 bg-card/70 p-3">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: isPlaying ? 360 : 0 }}
              transition={{ duration: 4, repeat: isPlaying ? Infinity : 0, ease: 'linear' }}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0"
            >
              <Disc3 className="w-5 h-5 text-primary" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {isPlaying ? 'Now playing' : isPaused ? 'Paused' : playerState?.status === 'stopped' ? 'Stopped' : 'Ready'}
              </p>
              <p className="font-semibold text-sm truncate">{hasCurrentSong ? playerState.current_song_title : 'No song selected'}</p>
              <p className="text-xs text-muted-foreground truncate">
                {hasCurrentSong ? playerState.current_song_artist || 'Unknown artist' : isOnline ? 'Press Add Queue to reserve' : 'Waiting for realtime server'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <IconButton
                label={isPlaying ? 'Pause' : 'Resume'}
                onClick={() => sendCommand(isPlaying ? 'pause' : 'resume')}
                disabled={!hasCurrentSong || !isOnline}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </IconButton>
              <IconButton label="Next song" onClick={handleNext} disabled={!isOnline}>
                <SkipForward className="w-4 h-4" />
              </IconButton>
              <IconButton label="Stop" onClick={handleStop} disabled={!hasCurrentSong || !isOnline}>
                <Square className="w-4 h-4" />
              </IconButton>
            </div>
          </div>
        </div>
      </section>

      <nav className="shrink-0 px-3 sm:px-4 my-2 sm:my-3">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-secondary/40 p-1">
          {[
            { id: 'library', icon: Library, label: 'Library' },
            { id: 'queue', icon: ListMusic, label: queueCountLabel },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`h-10 rounded-md flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <AnimatePresence mode="wait">
        {activeTab === 'library' ? (
          <motion.main
            key="library"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex-1 min-h-0 overflow-hidden px-3 sm:px-4 pb-3"
          >
            <div className="h-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-3">
              <div className="min-h-0 flex flex-col">
                <div className="shrink-0 space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1 min-w-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search title or artist"
                        className="pl-9 pr-9 bg-secondary/50 border-border/50 focus:border-primary/50 h-11 rounded-lg"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          title="Clear search"
                          aria-label="Clear search"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant={libraryEditorOpen ? 'default' : 'outline'}
                      onClick={() => setLibraryEditorOpen((open) => !open)}
                      className="h-11 shrink-0 gap-2 px-3"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">Library</span>
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>{songs.length} shown</span>
                    <span>{allSongs.length} songs in library</span>
                  </div>
                </div>

                <ScrollArea className="flex-1 min-h-0 mt-3 overscroll-contain">
                  <div className="space-y-2 pb-4">
                    {libraryEditorOpen && (
                      <LibraryEditor
                        draft={songDraft}
                        bulkImport={bulkImport}
                        isSaving={isSavingSong}
                        onDraftChange={handleDraftChange}
                        onBulkChange={setBulkImport}
                        onSave={handleSaveSong}
                        onImport={handleImportSongs}
                      />
                    )}

                    {isLoading && <SearchSkeleton />}

                    {!isLoading && songs.length === 0 && (
                      <EmptySearch query={searchQuery} />
                    )}

                    {!isLoading && songs.map((song, index) => (
                      <SongResult
                        key={song.id}
                        song={song}
                        index={index}
                        thumbnail={song.thumbnail || thumbnailForVideo(song.video_id)}
                        isQueueing={queueingSongId === song.id}
                        disabled={!isOnline}
                        onReserve={() => reserveSong(song)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <aside className="hidden lg:flex min-h-0 rounded-lg border border-border/50 bg-card/65 overflow-hidden">
                <QueuePanel
                  queue={queue}
                  playerState={playerState}
                  onDragEnd={handleDragEnd}
                  onBrowse={() => setActiveTab('library')}
                  onRemove={removeFromQueue}
                  onPlayNow={handlePlayQueueItem}
                  onNext={handleNext}
                  compact
                />
              </aside>
            </div>
          </motion.main>
        ) : (
          <motion.main
            key="queue"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex-1 min-h-0 overflow-hidden px-3 sm:px-4 pb-3"
          >
            <QueuePanel
              queue={queue}
              playerState={playerState}
              onDragEnd={handleDragEnd}
              onBrowse={() => setActiveTab('library')}
              onRemove={removeFromQueue}
              onPlayNow={handlePlayQueueItem}
              onNext={handleNext}
            />
          </motion.main>
        )}
      </AnimatePresence>

      <MobileFooter
        activeTab={activeTab}
        queueLength={queue.length}
        isOnline={isOnline}
        onBrowse={() => setActiveTab('library')}
        onQueue={() => setActiveTab('queue')}
        onNext={handleNext}
      />
    </div>
  );
}

function IconButton({ children, label, onClick, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-secondary/70 border border-border/50 flex items-center justify-center text-foreground hover:border-primary/40 hover:bg-primary/10 disabled:opacity-40 disabled:pointer-events-none transition-colors"
    >
      {children}
    </button>
  );
}

function SongResult({ song, index, thumbnail, isQueueing, disabled, onReserve }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.012, 0.1) }}
      className="w-full text-left group flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-lg border transition-all bg-card/55 border-border/40 hover:border-primary/30 hover:bg-primary/8"
    >
      <div className="w-full min-w-0 flex items-center gap-2.5 sm:gap-3">
        <div className="w-12 h-11 sm:w-16 sm:h-12 rounded-md overflow-hidden bg-secondary/70 shrink-0 relative">
          {thumbnail ? (
            <img src={thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="w-5 h-5 text-muted-foreground/50" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{song.title}</p>
          <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
          <p className="text-[11px] text-muted-foreground/70 truncate mt-1">
            {formatTags(song)}
          </p>
          <p className="hidden sm:block text-[11px] leading-4 text-muted-foreground/70 line-clamp-2 mt-1">
            {song.lyrics_preview}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onReserve}
        disabled={disabled || isQueueing}
        className="h-10 w-full sm:w-auto sm:px-3 rounded-md bg-primary text-primary-foreground flex items-center justify-center gap-1.5 shrink-0 text-xs sm:text-sm font-semibold disabled:opacity-45 disabled:pointer-events-none active:scale-[0.98] transition-transform"
      >
        <Plus className="w-4 h-4" />
        {isQueueing ? 'Adding' : 'Add Queue'}
      </button>
    </motion.article>
  );
}

function LibraryEditor({ draft, bulkImport, isSaving, onDraftChange, onBulkChange, onSave, onImport }) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/6 p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Add songs to library</p>
          <p className="text-[11px] text-muted-foreground">Saved songs sync to all connected screens.</p>
        </div>
        <Upload className="w-4 h-4 text-primary shrink-0" />
      </div>

      <form onSubmit={onSave} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <Input
          value={draft.title}
          onChange={(event) => onDraftChange('title', event.target.value)}
          placeholder="Song title"
          className="h-10 bg-background/70 lg:col-span-2"
        />
        <Input
          value={draft.artist}
          onChange={(event) => onDraftChange('artist', event.target.value)}
          placeholder="Artist / singer"
          className="h-10 bg-background/70 lg:col-span-2"
        />
        <Input
          value={draft.genre}
          onChange={(event) => onDraftChange('genre', event.target.value)}
          placeholder="Genre"
          className="h-10 bg-background/70"
        />
        <Input
          value={draft.tags}
          onChange={(event) => onDraftChange('tags', event.target.value)}
          placeholder="Tags"
          className="h-10 bg-background/70 sm:col-span-2"
        />
        <Input
          value={draft.youtube}
          onChange={(event) => onDraftChange('youtube', event.target.value)}
          placeholder="Optional YouTube URL"
          className="h-10 bg-background/70 sm:col-span-2"
        />
        <Button type="submit" disabled={isSaving} className="h-10 gap-2">
          <Save className="w-4 h-4" />
          Save
        </Button>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Textarea
          value={bulkImport}
          onChange={(event) => onBulkChange(event.target.value)}
          placeholder={'Bulk import: one per line, like "My Way - Frank Sinatra"'}
          className="min-h-[76px] bg-background/70 resize-none"
        />
        <Button type="button" variant="outline" onClick={onImport} disabled={isSaving} className="h-11 sm:h-full gap-2">
          <Upload className="w-4 h-4" />
          Import
        </Button>
      </div>
    </div>
  );
}

function QueuePanel({ queue, playerState, onDragEnd, onBrowse, onRemove, onPlayNow, onNext, compact = false }) {
  const hasCurrentSong = !!playerState?.current_song_title;

  return (
    <div className="h-full w-full flex flex-col min-h-0 p-3">
      {hasCurrentSong && <NowPlayingQueueCard playerState={playerState} />}

      <div className="shrink-0 flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{queue.length} reserved next</p>
          {!compact && <p className="text-[11px] text-muted-foreground/70">Drag handles reorder the list.</p>}
        </div>
        <Button onClick={onNext} size="sm" className="gap-2">
          <SkipForward className="w-4 h-4" />
          Next
        </Button>
      </div>

      {queue.length === 0 ? (
        <EmptyQueue onBrowse={onBrowse} />
      ) : (
        <ScrollArea className="flex-1 min-h-0 overscroll-contain">
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId={compact ? 'queue-compact' : 'queue'}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2 pb-2">
                  <AnimatePresence>
                    {queue.map((item, index) => (
                      <Draggable key={item.id} draggableId={item.id} index={index}>
                        {(provided, snapshot) => (
                          <QueueItemCard
                            item={item}
                            index={index}
                            provided={provided}
                            snapshot={snapshot}
                            onPlayNow={onPlayNow}
                            onRemove={onRemove}
                          />
                        )}
                      </Draggable>
                    ))}
                  </AnimatePresence>
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </ScrollArea>
      )}
    </div>
  );
}

function NowPlayingQueueCard({ playerState }) {
  return (
    <div className="shrink-0 mb-3 rounded-lg border border-primary/45 bg-primary/12 p-3 shadow-lg shadow-primary/10">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
          <Disc3 className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Now Playing</span>
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          </div>
          <p className="font-semibold text-sm sm:text-base truncate">{playerState.current_song_title}</p>
          <p className="text-xs text-muted-foreground truncate">{playerState.current_song_artist || 'Unknown artist'}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyQueue({ onBrowse }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center text-muted-foreground p-6 rounded-lg border border-dashed border-border/60 bg-card/35">
      <ListMusic className="w-14 h-14 mb-4 opacity-20" />
      <p className="font-semibold text-base">Queue is empty</p>
      <p className="text-sm mt-1 opacity-70">Press Add Queue from the library.</p>
      <Button onClick={onBrowse} className="mt-6 gap-2">
        <Search className="w-4 h-4" />
        Browse Songs
      </Button>
    </div>
  );
}

function QueueItemCard({ item, index, provided, snapshot, onPlayNow, onRemove }) {
  return (
    <motion.div
      ref={provided.innerRef}
      {...provided.draggableProps}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 30 }}
      className={`rounded-lg border p-3 transition-all ${
        snapshot.isDragging
          ? 'bg-primary/10 border-primary/45 shadow-lg shadow-primary/10'
          : index === 0
            ? 'bg-accent/10 border-accent/30'
            : 'bg-card/60 border-border/40 hover:border-border/70'
      }`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <button
          {...provided.dragHandleProps}
          className="w-10 h-10 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary/60 hover:text-foreground touch-none shrink-0"
          title="Drag to reorder"
          aria-label={`Reorder ${item.song_title}`}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className={`w-11 h-10 rounded-lg flex flex-col items-center justify-center text-[10px] font-black shrink-0 ${
          index === 0 ? 'bg-accent/20 text-accent' : 'bg-secondary text-muted-foreground'
        }`}>
          <span className="leading-none">#{index + 1}</span>
          {index === 0 && <span className="text-[8px] leading-none mt-0.5">NEXT</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm sm:text-base font-semibold truncate">{item.song_title}</p>
          <p className="text-xs text-muted-foreground truncate">{item.song_artist || item.singer_name || 'Unknown artist'}</p>
          <p className="text-[10px] text-muted-foreground/70 truncate mt-1">
            Reserved {formatQueuedTime(item.queued_at)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <QueueActionButton label="Play now" onClick={() => onPlayNow(item)}>
          <Play className="w-4 h-4" />
          <span>Play</span>
        </QueueActionButton>
        <QueueActionButton label="Remove" onClick={() => onRemove(item.id)} danger>
          <Trash2 className="w-4 h-4" />
          <span>Remove</span>
        </QueueActionButton>
      </div>
    </motion.div>
  );
}

function QueueActionButton({ children, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`h-10 px-3 rounded-md border flex items-center justify-center gap-2 text-xs font-semibold transition-colors ${
        danger
          ? 'border-destructive/25 text-destructive hover:bg-destructive/10'
          : 'border-border/60 text-foreground hover:border-primary/35 hover:bg-primary/10'
      }`}
    >
      {children}
    </button>
  );
}

function MobileFooter({ activeTab, queueLength, isOnline, onBrowse, onQueue, onNext }) {
  return (
    <footer className="lg:hidden sticky bottom-0 z-30 shrink-0 border-t border-white/10 bg-card/95 backdrop-blur px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-xs uppercase tracking-wider ${isOnline ? 'text-accent' : 'text-destructive'}`}>
            {isOnline ? 'Synced' : 'Offline'}
          </p>
          <p className="text-sm font-semibold">{queueLength} reserved</p>
        </div>
        {activeTab === 'queue' ? (
          <Button variant="outline" onClick={onBrowse} className="h-11 gap-2">
            <Library className="w-4 h-4" />
            Library
          </Button>
        ) : (
          <Button variant="outline" onClick={onQueue} className="h-11 gap-2">
            <ListMusic className="w-4 h-4" />
            Queue
          </Button>
        )}
        <Button onClick={onNext} disabled={!isOnline || queueLength === 0} className="h-11 gap-2">
          <SkipForward className="w-4 h-4" />
          Next
        </Button>
      </div>
    </footer>
  );
}

function EmptySearch({ query }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
      <Music className="w-12 h-12 mb-3 opacity-25" />
      <p className="font-medium">No songs found</p>
      <p className="text-xs mt-1 opacity-70 max-w-xs">
        {query ? 'Try another title, artist, genre, or keyword.' : 'Start typing to filter the music library.'}
      </p>
    </div>
  );
}

function createEmptySongDraft() {
  return {
    title: '',
    artist: '',
    genre: 'karaoke',
    tags: '',
    youtube: '',
  };
}

function createSongFromDraft(draft) {
  const title = String(draft.title || '').trim();
  const artist = String(draft.artist || '').trim();
  if (!title || !artist) return null;

  const videoId = extractYouTubeVideoId(draft.youtube || '');
  return {
    title,
    artist,
    genre: String(draft.genre || 'karaoke').trim() || 'karaoke',
    language: 'unknown',
    tags: parseTags(draft.tags),
    source_type: videoId ? 'youtube' : 'youtube_search',
    video_id: videoId,
    search_query: buildKaraokeSearchQuery(title, artist),
    lyrics_preview: 'Lyrics preview unavailable. Karaoke lyrics may appear in the video.',
    provider: 'custom',
  };
}

function parseImportedSongs(value) {
  return String(value || '')
    .split('\n')
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.+?)\s+(?:-|–|—|\||,)\s+(.+)$/);
      if (!match) return null;
      const [, title, artist] = match;
      return createSongFromDraft({
        title,
        artist,
        genre: 'karaoke',
        tags: 'karaoke, imported',
        youtube: '',
      });
    })
    .filter(Boolean);
}

function parseTags(value) {
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formatQueuedTime(value) {
  const timestamp = Number(value);
  if (!timestamp) return 'just now';

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hr ago';
  return `${hours} hr ago`;
}

function SearchSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-[78px] rounded-lg bg-secondary/40 animate-pulse" />
      ))}
    </>
  );
}

function formatTags(song) {
  return [song.genre, ...(song.tags || song.aliases || [])].filter(Boolean).slice(0, 4).join(' / ');
}
