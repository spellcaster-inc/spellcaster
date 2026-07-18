# Spellcaster

Spellcaster is a real-time 1v1 wizard spelling duel. Two players join a lobby, hear spell names, type them as quickly and accurately as possible, and push a magical beam toward their opponent until someone wins.

## Core gameplay

1. Host creates a room (or a guest joins with a 4-character code) and picks a wizard avatar.
2. Both players ready up; the host starts the duel.
3. Each round: 3-second countdown → spell prompt audio → up to 10 seconds to type and cast.
4. Scores combine spelling accuracy (Levenshtein) and speed bonus.
5. Round score differences move a shared beam. Reach the beam threshold early, or lead after all rounds, to win. Disconnect mid-duel forfeits.

## Technology stack

| Layer | Stack |
|-------|--------|
| Client | React 18, TypeScript, Vite 7, Tailwind CSS 3, Socket.IO client |
| Server | Node.js, Express 5, TypeScript, Socket.IO 4 |
| Shared | TypeScript event/payload types in `shared/types` |
| Audio | Pre-generated ElevenLabs MP3s for catalog spells; browser TTS for custom words |
| CI | GitHub Actions (client + server `npm ci` / `npm run build`) |

There is no database. Lobby and duel state live in server memory.

## Local setup

### Prerequisites

- Node.js 20+ (matches CI)
- npm

### Install

```bash
cd client && npm install
cd ../server && npm install
```

### Environment variables

**Server** (`server/.env`):

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `PORT` | No | `4000` | HTTP / Socket.IO listen port |
| `CLIENT_ORIGIN` | No | `http://localhost:5173` | Comma-separated CORS allowlist |
| `ELEVENLABS_API_KEY` | Only for audio regen | — | TTS generation script |
| `ELEVENLABS_VOICE_ID` | Only for audio regen | `zNsotODqUhvbJ5wMG7Ei` | ElevenLabs voice |
| `TTS_OUTPUT_DIR` | Only for audio regen | `../client/public/audio/spells` | Where MP3s are written |
| `PUBLIC_AUDIO_BASE_PATH` | Only for audio regen | `/audio/spells` | Public URL prefix in manifest |

For normal local play, `PORT` and `CLIENT_ORIGIN` are enough (defaults work for Vite on `:5173`).

**Client** (`client/.env`):

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `VITE_SERVER_URL` | No | `http://localhost:4000` | Socket.IO server URL |

### Run locally

Terminal 1 — server:

```bash
cd server
npm run dev
```

Terminal 2 — client:

```bash
cd client
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`). Use two browser profiles/windows to host and join.

### Production-style commands

```bash
# Client
cd client
npm run build      # tsc + vite build → client/dist
npm run preview    # preview production build

# Server
cd server
npm run build      # tsc → server/dist
npm start          # node dist/server/src/index.js
```

Run `npm start` with working directory `server/` (or ensure `server/data/spellAudioManifest.json` is resolvable from `cwd`). See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Deployment overview

No Docker, PaaS config, or infra-as-code ships in this repo yet.

Typical production shape:

1. Build and host the Vite static app (`client/dist`), including `client/public/audio/**`.
2. Run the Node server (`npm run build && npm start` in `server/`) with `PORT` and `CLIENT_ORIGIN` set to the real frontend origin(s).
3. Point the client at the server via `VITE_SERVER_URL` **at build time**.
4. Keep a single server instance (or add shared state later): lobbies/duels are in-memory Maps and do not survive restarts or multi-instance load balancing.

Audio regeneration is offline/manual — do not run ElevenLabs generation in CI/deploy. Details: [docs/AUDIO.md](docs/AUDIO.md).

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/GAME_SPEC.md](docs/GAME_SPEC.md) | Features, player journey, incomplete items |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Structure, sockets, data flow, audio, security |
| [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md) | Bugs, risks, check results |
| [docs/RELEASE_PLAN.md](docs/RELEASE_PLAN.md) | Prioritized release tasks |
| [docs/AUDIO.md](docs/AUDIO.md) | Opaque prompt-audio architecture |
| [AGENTS.md](AGENTS.md) | Agent/contributor operating rules |

## License

See [LICENSE](LICENSE).
