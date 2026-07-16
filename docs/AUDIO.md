# Audio Architecture

This document explains how audio works in Spellcaster after the opaque-audio migration.

## Overview

There are two audio categories:

- Prompt audio: what players hear to know what to spell.
- SFX: cast, victory, and loss sounds.

Scoring is server-authoritative and does not depend on frontend audio logic.

## Asset Locations

- Prompt MP3s (catalog rounds): `client/public/audio/spells/{easy|medium|hard}/`
  - Stable opaque filenames: `easy/e001.mp3`, `medium/m001.mp3`, `hard/h001.mp3`.
- SFX: `client/public/audio/spell1.wav`, `client/public/audio/spell2.mp3`, `client/public/audio/victory.wav`, `client/public/audio/loss.mp3`.
- Server-only manifest: `server/data/spellAudioManifest.json`.
- Source spell list: `server/src/game/spellCatalog.json`.

## Prompt Flow

### Catalog rounds (`easy`, `medium`, `hard`)

1. Server picks a spell internally.
2. Server emits `duel:prompt` with `mode: "catalog"` and `audioUrl`.
3. Client plays `audioUrl` directly with `new Audio(audioUrl)`.
4. Server grades using internal spell text.
5. Server reveals the answer in `duel:roundRecap` via `spell`.

Catalog prompt payloads do not include `spellText`.

### Custom rounds

1. Server emits `duel:prompt` with `mode: "custom"` and `spellText`.
2. Client uses browser TTS (`speechSynthesis`) to speak the custom word.
3. Server still grades server-side and reveals answer in recap.

## Key Code Paths

- Generation script: `server/scripts/generateSpellAudio.mjs`
- Manifest loader: `server/src/game/spellAudio.ts`
- Spell queue + audio attachment: `server/src/game/spells.ts`
- Prompt emission: `server/src/game/duelManager.ts`
- Prompt playback: `client/src/hooks/useSpellAudio.ts`
- Submit SFX trigger: `client/src/hooks/useSpellInput.ts`
- Shared prompt types: `shared/types/socket.ts`

## Client Rules

- Do not import spell-to-audio manifest JSON on the client.
- Do not prefix catalog `audioUrl` with `VITE_SERVER_URL`.
- Do not expect `spellText` in catalog prompt payloads.

## Regenerating Prompt Audio

Prerequisite: set `ELEVENLABS_API_KEY` in `server/.env`.

Run:

```bash
cd server
TTS_OUTPUT_DIR=../client/public/audio/spells \
PUBLIC_AUDIO_BASE_PATH=/audio/spells \
node scripts/generateSpellAudio.mjs
```

The script:

- Writes/updates MP3 files in `client/public/audio/spells`.
- Writes/updates `server/data/spellAudioManifest.json`.
- Skips files that already exist.

Do not run this script in CI/deploy; use it when the spell catalog changes.

## Important Catalog Rule (Append Only)

`spellCatalog.json` uses index-stable IDs for audio filenames. Do not insert or reorder existing spells.

- Allowed: append new spells to the end of each tier.
- Not allowed: insert at the start/middle or reorder existing entries.

Reordering shifts IDs and breaks spell-to-audio mapping.

## Deployment Notes

- Frontend build must include `client/public/audio/spells/**`.
- Backend reads `server/data/spellAudioManifest.json` at runtime via filesystem.
- No external `AUDIO_LIBRARY_PATH` directory is required.

## Anti-Cheat Model

This setup prevents easy answer leaks from:

- `spellText` in catalog prompt payloads
- obvious filenames like `lumos.mp3`
- client-side spell manifest imports

Limitation: prompt MP3s are public static files and can still be scraped over time by determined users.

