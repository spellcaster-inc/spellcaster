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

Set `ELEVENLABS_API_KEY` in `server/.env`. To generate new clips, install Python 3
and FFmpeg and make sure `python3` and `ffmpeg` are on your PATH. The generator
checks these tools before requesting its first new clip from ElevenLabs.

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
- Runs the same decode and silence checks as the catalog audit on each new MP3.
  If a clip needs review, the output shows the spell name, filename, and what
  triggered the warning. The flagged file stays on disk and generation continues.
  Listen to flagged clips before committing. Trim the silence or remove the MP3
  and rerun the generator to replace it.

Do not run this script in CI/deploy; use it when the spell catalog changes.

## Checking Existing Clips

Run this read-only audit from the repository root with Python 3 and FFmpeg installed:

```bash
python3 server/scripts/auditSpellAudio.py
```

To recheck a single clip after editing it, pass `--clip` and the file path:

```bash
python3 server/scripts/auditSpellAudio.py --clip client/public/audio/spells/medium/m040.mp3
```

It checks catalog/manifest order, missing or unmapped MP3s, full-file decoding,
leading silence over 0.5 seconds, and internal/trailing silence over 0.75 seconds.
Silence detection uses -55 dB with an 80 ms minimum interval. Short natural pauses
are allowed. This is a signal/file check; it does not verify pronunciation or
browser/network playback timing. It never calls ElevenLabs or edits assets.

The catalog silence repair covers seven clips:

| Clip | Spell | Repair |
|------|-------|--------|
| `medium/m040.mp3` | Mystara Radius | Remove 2.63 s of leading silence |
| `medium/m041.mp3` | Arcadius Tempest | Remove 2.70 s of leading silence |
| `hard/h073.mp3` | Sabriae Tyrannus | Remove 2.61 s of leading silence |
| `medium/m010.mp3` | Raptorialis Ignis | Shorten a 0.88 s internal silence to 0.20 s |
| `medium/m043.mp3` | Gladius Frigus | Shorten a 1.82 s internal silence to 0.20 s |
| `hard/h036.mp3` | Sanguis Aeterlash | Shorten a 2.63 s silence after initial sound to 0.20 s |
| `hard/h040.mp3` | Furiosa Malleus | Shorten a 2.70 s silence after initial sound to 0.20 s |

The three leading repairs retain about 0.11 s before speech. Internal repairs
retain 0.10 s of silence on each side of the cut and all surrounding audio.
The seven repaired MP3s were compared against the retained original samples;
correlation exceeded 0.9997 after MP3 encoding. All 246 catalog clips passed the
audit after repair. The four SFX files also decoded successfully and were unchanged.

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

