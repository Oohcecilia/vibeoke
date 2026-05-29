# Vibeoke

A realtime videoke app with a TV player screen, fast controller reservations, a structured song library, and YouTube karaoke playback.

## Run Locally

```bash
npm install
npm run dev
```

Open:

- `http://localhost:3001/player` for the TV/player screen
- `http://localhost:3001/controller` for the controller

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

Search indexes song title, artist, genre, language, and tags. Custom songs added from the controller are stored by the realtime server and become searchable for every connected device. YouTube playback searches with:

```text
{song title} {artist} karaoke instrumental lyrics no vocals
```

## YouTube Search

Set the official YouTube Data API key in `.env`:

```bash
VITE_YOUTUBE_API_KEY=your_key
```

Restart `npm run dev` after changing `.env`.
