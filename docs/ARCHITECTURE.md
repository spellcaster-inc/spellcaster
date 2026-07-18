# Spellcaster Architecture

## 1. Repository structure

```
spellcaster/
├── client/                 # React + Vite frontend
│   ├── public/             # Static assets (audio, fonts)
│   │   └── audio/
│   │       ├── spells/{easy,medium,hard}/*.mp3
│   │       ├── spell1.wav, spell2.mp3, victory.wav, loss.mp3
│   └── src/
│       ├── App.tsx         # Screen state machine (no router)
│       ├── pages/          # Landing, Lobby, Game, Entry
│       ├── components/     # UI pieces
│       ├── hooks/          # Socket, lobby, audio, input, countdown
│       ├── lib/            # config, socket singleton, constants
│       ├── assets/         # Wizard PNGs
│       └── types/          # Client-only Wizard type
├── server/
│   ├── src/
│   │   ├── index.ts        # Express + Socket.IO bootstrap
│   │   ├── sockets/        # Lobby handlers + wiring
│   │   └── game/           # Duel, scoring, spells, audio loader
│   ├── data/
│   │   └── spellAudioManifest.json   # Server-only spell→URL map
│   └── scripts/
│       └── generateSpellAudio.mjs    # Offline ElevenLabs TTS
├── shared/types/
│   └── socket.ts           # Shared event + payload types
├── docs/                   # Product/engineering docs
└── .github/workflows/ci.yml
```

No root `package.json`. Client and server are independent npm packages that both import `shared/types`.

## 2. Responsibilities

### Frontend (`client`)

- Render landing / lobby / duel UI
- Collect nickname, wizard, join code, host settings
- Maintain socket connection and local game UI state
- Play prompt audio / TTS and SFX
- Capture typing and emit submissions
- Show errors, recaps, and end-of-game summary

**Does not** own scoring, round timers, spell answers (catalog), or authoritative beam math.

### Backend (`server`)

- HTTP health check
- Socket.IO lobby lifecycle
- Duel state machine (timers, prompts, submissions, recap, completion)
- Spell queue construction and audio URL attachment
- Scoring and beam updates
- Forfeit / cleanup

**Does not** serve the Vite app or catalog MP3s in production (MP3s are frontend static files). Manifest is read from disk at process start (module load of `spells.ts` → `loadSpellAudioLookup()`).

### Shared

Compile-time TypeScript contracts for Socket.IO events and payloads. Runtime JS under `shared/types/socket.js` is an empty stub; the server build emits a compiled copy into `server/dist/shared/`.

## 3. Important modules

### Client pages

| File | Role |
|------|------|
| `LandingPage.tsx` | Primary entry: host/join, wizard, how-to-play |
| `LobbyPage.tsx` | Room code, players, ready/start |
| `GamePage.tsx` | Countdown, casting UI, recap, beam |
| `EntryPage.tsx` | Legacy fallback when `currentScreen==='game'` but lobby/duel UI does not apply |

### Client hooks

| Hook | Role |
|------|------|
| `useSocketConnection` | Connection status + unused ping helper |
| `useLobby` | All lobby/duel socket listeners and emitters |
| `useCountdownTimer` | Local tick from server countdown payload |
| `useSpellAudio` | Prompt playback + cast/victory/loss SFX |
| `useSpellInput` | Guess state, keyboard handlers, submit |

### Client libs

| File | Role |
|------|------|
| `lib/config.ts` | `VITE_SERVER_URL` → `SERVER_URL` |
| `lib/socket.ts` | Singleton `io(SERVER_URL, { withCredentials: true })` |
| `lib/constants.ts` | Default game settings |

### Server modules

| File | Role |
|------|------|
| `src/index.ts` | Express, CORS, `/health`, Socket.IO server |
| `src/sockets/index.ts` | Lobby Map, create/join/ready/settings/start/submit/leave |
| `src/game/duelManager.ts` | Active duels, timers, prompts, completion |
| `src/game/spells.ts` | Catalog load, queue shuffle, audio URLs |
| `src/game/spellAudio.ts` | Manifest path resolution + lookup Map |
| `src/game/scoring.ts` | Levenshtein, accuracy, speed bonus |
| `src/game/spellCatalog.json` | Spell word lists by difficulty |

## 4. Screen / route model

There is **no React Router**. `App.tsx` chooses UI from:

```
currentScreen === 'landing'     → LandingPage
else lobby.phase === 'lobby'    → LobbyPage
else lobby.phase === 'in-duel'
     && duel                    → GamePage
else                            → EntryPage (fallback)
```

Overlays: `HostSettingsModal`, `GameSummaryCard`.

## 5. Socket.IO events and payloads

Types: `shared/types/socket.ts`.

### Client → server

| Event | Payload | Server behavior |
|-------|---------|-----------------|
| `ping` | none | Emit `pong` with ISO timestamp |
| `lobby:create` | `{ playerName, settings?, wizardId? }` | Create room, host joins, broadcast `lobby:state` |
| `lobby:join` | `{ roomCode, playerName, wizardId? }` | Validate + add player |
| `lobby:leave` | none | Remove from lobby / forfeit if in duel |
| `lobby:setReady` | `{ roomCode, ready }` | Toggle ready (lobby phase) |
| `lobby:updateSettings` | `{ roomCode, settings }` | Host-only; resets ready flags |
| `lobby:startDuel` | `{ roomCode }` | Host-only; both ready → start DuelManager |
| `duel:submitSpell` | `{ roomCode, promptId, guess, durationMs }` | Grade path; client duration ignored |

### Server → client

| Event | Payload | Meaning |
|-------|---------|---------|
| `pong` | `{ timestamp }` | Ping reply |
| `lobby:state` | `LobbyState` | Full lobby snapshot |
| `duel:started` | `DuelState` | Duel begins |
| `duel:countdown` | `{ roundNumber, totalRounds, seconds, readingSpeed }` | Pre-prompt countdown |
| `duel:prompt` | `CatalogSpellPromptPayload \| CustomSpellPromptPayload` | Spell to answer |
| `duel:playerSubmitted` | `{ roomCode, roundNumber, playerId }` | Opponent/self submitted |
| `duel:roundRecap` | `RoundRecapPayload` | Answers + scores + beam |
| `duel:completed` | `GameSummary` | Final results |
| `error` | `{ message }` | Action rejected |

### Key payload shapes

```ts
// Catalog prompt — no spell text
{ mode: 'catalog', roundNumber, totalRounds, promptId, audioUrl, readingSpeed, startedAt }

// Custom prompt — plaintext for TTS
{ mode: 'custom', roundNumber, totalRounds, promptId, spellText, readingSpeed, startedAt }

LobbyState { roomCode, phase: 'lobby'|'in-duel', players[], settings }
GameSettings { difficulty, rounds, readingSpeed, customWords?, customWordSourceName? }
```

Player identity is **`socket.id`**. `SocketData` may store `roomCode` / `playerName` on the socket.

## 6. State and data flow

```
┌────────────┐  lobby:* / duel:submitSpell   ┌──────────────────┐
│   Client   │ ────────────────────────────► │ Socket handlers  │
│  useLobby  │ ◄──────────────────────────── │ lobbies: Map     │
└────────────┘  lobby:state / duel:* / error └────────┬─────────┘
                                                      │ startDuel /
                                                      │ handleSubmission /
                                                      │ handlePlayerLeft
                                                      ▼
                                             ┌──────────────────┐
                                             │   DuelManager    │
                                             │   duels: Map     │
                                             │   timers         │
                                             └────────┬─────────┘
                                                      │ buildSpellQueue /
                                                      │ computeRoundScore
                                                      ▼
                                             spells.ts + scoring.ts
                                             spellAudioManifest.json
```

### Lobby Map

- Key: room code
- Value: `LobbyState`
- Deleted when empty
- Soft-leaks single-player abandoned lobbies until process restart

### Duel Map

- Key: room code
- Value: `ActiveDuel` (queue, scores, beam, in-flight round, timer handles)
- Deleted on `completeDuel`

### Client state ownership

| State | Source of truth |
|-------|-----------------|
| Lobby membership / settings / phase | Server via `lobby:state` |
| Round timing | Server timers; client mirrors countdown |
| Prompt content | Server `duel:prompt` |
| Guess text | Client local until submit |
| Scores / beam | Server; client updates from recap |
| `localPlayer` | Client: `lobby.players.find(id === socket.id)` |

## 7. Audio architecture

See also [AUDIO.md](AUDIO.md).

### Catalog path

1. Offline script generates opaque MP3s + `server/data/spellAudioManifest.json`.
2. At server runtime, `loadSpellAudioLookup()` builds `Map<SPELL, audioUrl>`.
3. Queue entries get `audioUrl` (manifest or deterministic fallback).
4. Prompt emits relative URL like `/audio/spells/easy/e001.mp3`.
5. Client plays against the **frontend origin** (Vite/`public`), not `VITE_SERVER_URL`.

### Custom path

Server sends `spellText`; client uses Web Speech API.

### Generation (offline only)

```bash
cd server
TTS_OUTPUT_DIR=../client/public/audio/spells \
PUBLIC_AUDIO_BASE_PATH=/audio/spells \
node scripts/generateSpellAudio.mjs
```

Requires `ELEVENLABS_API_KEY`. Skips existing files. **Append-only** catalog rule preserves index→filename mapping.

## 8. Security and anti-cheat

### Present

| Control | Detail |
|---------|--------|
| CORS allowlist | `CLIENT_ORIGIN` for HTTP + Socket.IO |
| Name/settings sanitization | Length limits, enum allowlists, custom-word caps |
| Guess length cap | 64 chars, uppercased |
| Catalog answer concealment | No `spellText` in catalog prompts |
| Opaque audio filenames | `e001.mp3` style, not spell-named |
| Server-only manifest | Client must not import mapping JSON |
| Server-authoritative duration | Client `durationMs` logged, not used |
| Server-authoritative scoring | Client cannot set scores/beam |

### Absent / weak

| Gap | Detail |
|-----|--------|
| Authentication | None |
| Rate limiting | None |
| Payload schema validation | TS types only; runtime destructuring can throw |
| `wizardId` validation | Pass-through string |
| Room-code normalize consistency | Some handlers use raw `roomCode` |
| Speed bonus without accuracy | Fast garbage still scores bonus |
| Public MP3 scraping | Determined users can map audio over time |
| Custom mode leak | `spellText` intentionally sent for TTS |
| Multi-instance safety | In-memory state only |

## 9. Development and production infrastructure

### Local

| Process | Command | Default URL |
|---------|---------|-------------|
| Client Vite | `cd client && npm run dev` | `http://localhost:5173` |
| Server | `cd server && npm run dev` | `http://localhost:4000` |

Vite allows importing `../shared` via `server.fs.allow`.

### Build outputs

| Package | Output | Start |
|---------|--------|-------|
| Client | `client/dist/` (+ copied `public/`) | Static host / `npm run preview` |
| Server | `server/dist/server/src/...` and `server/dist/shared/...` | `npm start` → `node dist/server/src/index.js` |

Server `tsconfig` sets `rootDir` to the repo parent of `server/`, producing the nested `dist/server/src` layout.

Manifest resolution tries several paths relative to `cwd` and `__dirname`. Reliable when `cwd` is `server/` or repo root; `__dirname` fallbacks under compiled `dist` are fragile.

### CI

`.github/workflows/ci.yml`:

1. Node 20
2. `client`: `npm ci` + `npm run build`
3. `server`: `npm ci` + `npm run build`

No test, lint, or type-check-only job beyond what `build` embeds (`client` build runs `tsc`). Root `cache: 'npm'` points at an empty root lockfile — caching is ineffective / brittle.

### Not present

- Dockerfile / compose
- Terraform / PaaS configs
- CDN / reverse-proxy samples
- Logging/metrics/APM
- Staging environment definitions
- Database / Redis / pub-sub for multi-instance Socket.IO
