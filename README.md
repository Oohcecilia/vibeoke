# Vibeoke

A realtime videoke app with a TV player screen, fast controller reservations, a structured song library, and YouTube karaoke playback.

## Run Locally

```bash
npm install
npm run dev
```

Open:

- `http://localhost:3333/player` for the TV/player screen
- `http://localhost:3333/controller` for the controller

The `dev` script starts one Node/Vite server with Socket.IO. Use the machine's LAN IP instead of `localhost` when opening the controller from another phone or tablet.

## Realtime Queue

Queue and player state are owned by the Socket.IO server, not browser Local Storage. Connected controller/player devices receive instant `state:snapshot` updates from the shared server.

The server persists queue state to:

```text
server/data/vibeoke-state.json
```

## Song Library

The searchable library lives in:

```text
src/data/songs.library.json
```

Search indexes song title, artist, genre, language, and tags. Custom songs added from the controller are stored by the realtime server and become searchable for every connected device. YouTube playback searches and ranks several karaoke-focused variants such as:

```text
{song title} {artist} official karaoke lyrics
{song title} {artist} karaoke version sing along
{song title} {artist} minus one with guide
```

Results are classified as `Karaoke (No Vocals)`, `Karaoke (Guide Vocals)`, `Original Song`, `Instrumental`, or `Lyric Video`; playback accepts karaoke-classified results first and avoids original songs, lyric-only videos, and weak instrumental matches.

## YouTube Search

Set the official YouTube Data API key in `.env`:

```bash
VITE_YOUTUBE_API_KEY=your_key
VITE_YOUTUBE_API_KEY_1=backup_key
VITE_YOUTUBE_API_KEY_2=another_backup_key
```

Restart `npm run dev` after changing `.env`.

## Production On Pi

If you're deploying to a Raspberry Pi host like `aura`, see:

- [Pi deployment guide](./deploy/pi/README.md)
