# AGENTS.md — Spellcaster

Guidance for coding agents and human contributors working in this repository.

## Project overview

Spellcaster is a real-time **1v1 spelling duel**: two players join a lobby over Socket.IO, hear spell names (catalog MP3 or custom TTS), type them under a short timer, and push a shared beam using accuracy + speed scores. The React client is presentation and input; the Node server owns lobbies, timers, prompts, scoring, and winners. There is no database — state is in-memory on a single server process.

Authoritative product/engineering docs live in `docs/`. Start with `docs/RELEASE_PLAN.md` before changing behavior.

## Architectural rules

1. **Server is authoritative** for scores, timers, beam offset, winners, and catalog spell answers. Do not move grading or duration trust to the client.
2. **Do not leak catalog answers** in `duel:prompt` for catalog rounds. Keep opaque audio filenames and the server-only manifest (`server/data/spellAudioManifest.json`). Never import that manifest into the client.
3. **Catalog audio is served by the frontend** (`client/public/audio/...`). Do not prefix catalog `audioUrl` with `VITE_SERVER_URL`.
4. **Shared Socket.IO contracts** belong in `shared/types/socket.ts`. Update both emitters and listeners when changing events/payloads.
5. **`spellCatalog.json` is append-only** per tier. Do not reorder or insert in the middle — audio IDs are index-stable. See `docs/AUDIO.md`.
6. **In-memory lobbies/duels** assume a single Node instance unless you intentionally add a shared store + Socket.IO adapter.
7. **Prefer existing patterns**: hooks for client socket/audio/input; `DuelManager` for duel lifecycle; sanitize helpers in `server/src/sockets/index.ts`.

## Commands

### Install

```bash
cd client && npm install
cd ../server && npm install
```

### Run (development)

```bash
cd server && npm run dev          # http://localhost:4000
cd client && npm run dev          # http://localhost:5173
```

### Typecheck

```bash
cd client && npx tsc --noEmit
cd server && npx tsc --noEmit
```

(`client` `npm run build` also runs `tsc`.)

### Build

```bash
cd client && npm run build
cd server && npm run build
```

### Start server (production build)

```bash
cd server && npm start            # node dist/server/src/index.js
```

Ensure `cwd` can resolve `server/data/spellAudioManifest.json` (typically run from `server/`).

### Lint / test

No lint or test scripts are configured yet. Do not claim lint/test passed unless you add and run them. Follow `docs/RELEASE_PLAN.md` tasks H3/H6 when adding them.

### Regenerate spell audio (manual, not CI)

Requires `ELEVENLABS_API_KEY` in `server/.env`. See `docs/AUDIO.md`.

## Do not modify carelessly

| Path | Why |
|------|-----|
| `server/src/game/spellCatalog.json` | Append-only; reorder breaks opaque audio IDs |
| `server/data/spellAudioManifest.json` | Generated mapping; edit via generation script |
| `client/public/audio/spells/**` | Generated assets; large binary surface |
| `shared/types/socket.ts` | Contract for both apps — coordinate all call sites |
| `server/.env` / secrets | Never commit API keys |
| `client/public/harry-p-font/**` | Licensed/vendor font assets — check `info.txt` before replacing |

Build outputs (`client/dist`, `server/dist`) and `node_modules` are generated — do not hand-edit.

## Process requirements for agents

1. **Consult `docs/RELEASE_PLAN.md` before making changes.** Prefer Critical → High → Medium → Optional. If work is outside the plan, note why and add/adjust a plan item.
2. **Update documentation when behavior changes** — at minimum the affected files among:
   - `README.md`
   - `docs/GAME_SPEC.md`
   - `docs/ARCHITECTURE.md`
   - `docs/PRODUCTION_READINESS.md`
   - `docs/RELEASE_PLAN.md` (task status + acceptance)
   - `docs/AUDIO.md` (audio pipeline changes)
   - this `AGENTS.md` (commands/rules changes)
3. **Do not deploy** or run destructive git/ops commands unless the user explicitly asks.
4. **Do not regenerate ElevenLabs audio in CI** or as a side effect of unrelated tasks.
5. Distinguish **confirmed** vs **inferred** vs **uncertain** when reporting bugs; prefer tracing flows across client + server + shared types.

## Key doc index

| Doc | Use when |
|-----|----------|
| `docs/RELEASE_PLAN.md` | Choosing what to build next |
| `docs/GAME_SPEC.md` | Player-facing / game-rule behavior |
| `docs/ARCHITECTURE.md` | Modules, sockets, data flow |
| `docs/PRODUCTION_READINESS.md` | Known bugs and check results |
| `docs/AUDIO.md` | Prompt audio / anti-cheat audio rules |
| `README.md` | Setup and env vars |
