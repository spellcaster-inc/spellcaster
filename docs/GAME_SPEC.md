# Spellcaster Game Specification

Evidence levels used below:

- **Confirmed** — traced in code and consistent across client/server
- **Inferred** — strong implication from code paths, not end-to-end exercised in this audit
- **Uncertain** — behavior depends on runtime/environment or race timing

## 1. Product summary

Spellcaster (UI branding also uses “Wizarding Bee”) is a **2-player real-time spelling duel**. Players hear a spell name, type it, earn accuracy + speed points, and push a shared beam toward the opponent.

There is no account system, persistence, matchmaking queue, or spectator mode.

## 2. Features currently implemented

### Lobby / session

| Feature | Status | Notes |
|---------|--------|-------|
| Host create lobby | Confirmed | Emits `lobby:create` with name, settings, wizard |
| Join by room code | Confirmed | 4-char codes; client UI allows up to 6 chars |
| Leave lobby | Confirmed | `lobby:leave` + disconnect both call leave logic |
| Ready toggle | Confirmed | Both must be ready to start |
| Host-only start duel | Confirmed | Requires ≥2 players, all ready |
| Host settings at create | Confirmed | Difficulty, rounds, reading speed, custom CSV |
| Host settings mid-lobby | Partial | Server supports `lobby:updateSettings`; **client never emits it** |
| Host transfer on leave | Confirmed | Remaining player becomes host |
| Wizard avatar selection | Confirmed | 6 avatars; id stored on player |
| How to Play modal | Confirmed | Minimal copy only |
| Connection status | Partial | Used to disable some buttons; no global reconnect UX |

### Duel

| Feature | Status | Notes |
|---------|--------|-------|
| Countdown (3s) | Confirmed | Server timer + client display |
| Spell prompt | Confirmed | Catalog MP3 or custom TTS |
| Typing + Cast Spell | Confirmed | Hidden input + visual keyboard highlight |
| On-screen keyboard input | Incomplete | Visual only (`pointer-events-none`) |
| 10s round timeout | Confirmed | Empty auto-submission |
| Opponent submitted indicator | Confirmed | Via `duel:playerSubmitted` |
| Round recap | Confirmed | Shows spell answer, guesses, scores |
| Beam visualization | Confirmed | Driven by server `beamOffset` |
| Early beam win | Confirmed | `\|beamOffset\| >= 100` |
| End after N rounds | Confirmed | 5 / 10 / 15 |
| Game summary overlay | Confirmed | Victory/Defeat + stats table |
| Forfeit on disconnect/leave | Confirmed | Remaining player wins |
| Rematch in same lobby | Inferred | Server resets lobby to `phase: 'lobby'`; both must ready again |
| Ping / pong | Confirmed | Debug events; client exposes unused `sendPing` |

### Settings

| Setting | Values | Notes |
|---------|--------|-------|
| Difficulty | `easy` / `medium` / `hard` / `custom` | Catalog pools from `spellCatalog.json` |
| Rounds | 5 / 10 / 15 | |
| Reading speed | 0.5–2 | Applied to **browser TTS only**; catalog MP3 playback rate ignore it (**Confirmed**) |
| Custom words | CSV upload, max 400 unique, 64 chars, 150KB file | Uppercased; required for custom difficulty |

### Audio / SFX

| Asset | When | Notes |
|-------|------|-------|
| Catalog MP3 | Prompt `mode: 'catalog'` | Opaque filenames under `/audio/spells/{tier}/` |
| Browser TTS | Prompt `mode: 'custom'` | Speaks `spellText` |
| Cast SFX | On submit | Random `spell1.wav` / `spell2.mp3` |
| Victory / loss SFX | On summary | Tie / non-winner plays loss |

### Anti-cheat (partial)

- Catalog prompts omit `spellText` (**Confirmed**)
- Server grades against internal spell text (**Confirmed**)
- Server ignores client `durationMs` and computes its own (**Confirmed**)
- Prompt MP3s remain public static files (**Confirmed limitation**)

## 3. Complete player journey

```
Landing
  ├─ Host → Host Settings modal → lobby:create → Lobby
  └─ Join (code) → lobby:join → Lobby
Lobby
  ├─ Ready toggle (both)
  ├─ Host starts duel
  └─ Leave → Landing
Duel (per round)
  Countdown 3s → Prompt audio → Type/Cast (≤10s) → Recap (~1s lock + 8s between) → next or end
End
  duel:completed + lobby reset to phase lobby → Summary overlay → Return to Lobby → ready again
```

### Host path (Confirmed)

1. Landing: nickname (max 12, uppercased), wizard, **Host Game**.
2. Host Settings modal: difficulty / rounds / speed / optional CSV.
3. Confirm → `lobby:create` and client forces `currentScreen = 'game'`.
4. Until `lobby:state` arrives, App may render **EntryPage fallback** (race).
5. Lobby shows room code, players, settings summary, ready/start.
6. After both ready, host starts → `duel:started` → Game page.

### Join path (Confirmed)

1. Landing: nickname, 4+ character code, wizard, **Join Game**.
2. Screen stays on landing until `lobby:state` or error.
3. Same lobby/duel flow as host (cannot start; cannot change settings via UI).

### Post-game (Confirmed with race)

1. Server emits `duel:completed`, then resets lobby to `phase: 'lobby'` and broadcasts `lobby:state`.
2. Between those client handler updates, App can briefly show EntryPage (`phase === 'in-duel'` but `duel === null`).
3. After both events: Lobby + summary overlay. “Return to Lobby” clears the overlay only.

## 4. Game creation and joining

### Room codes (Confirmed)

- Length 4
- Alphabet: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no I/O/0/1)
- Generated until unique in in-memory `lobbies` Map
- Join normalizes to uppercase; some lobby ops do **not** re-normalize incoming codes (see PRODUCTION_READINESS)

### Capacity (Confirmed)

- Max 2 players
- Cannot join once `phase === 'in-duel'`
- No mid-game spectate or rejoin seat

### Name rules

| Layer | Max length |
|-------|------------|
| Landing UI | 12 |
| Server sanitize | 24 |

Empty client names become `"WIZARD"` on landing handlers; server rejects empty after trim.

## 5. Spell generation and assignment

### Catalog difficulties (Confirmed)

Source: `server/src/game/spellCatalog.json`

| Tier | Count (audit) |
|------|----------------|
| easy | 82 |
| medium | 84 |
| hard | 80 |
| **total** | **246** |

`buildSpellQueue`:

1. Load pool for difficulty (or custom words).
2. If pool empty → fall back to medium catalog.
3. Fisher–Yates shuffle.
4. Cycle through pool until `rounds` spells filled.
5. Attach `audioUrl` from `spellAudioManifest.json`, else deterministic fallback path.

### Custom difficulty (Confirmed)

- Host uploads CSV of words.
- Server sanitizes: trim, uppercase, unique, max 400 × 64 chars.
- Prompts use `mode: 'custom'` with plaintext `spellText` for client TTS.

### Prompt modes (Confirmed)

| Mode | Payload includes | Client playback |
|------|------------------|-----------------|
| `catalog` | `audioUrl`, **no** `spellText` | `new Audio(audioUrl)` |
| `custom` | `spellText` | `speechSynthesis` |

If catalog spell lacks `audioUrl`, server also falls back to custom-shaped payload with `spellText` (**Confirmed defensive path**).

## 6. Playback

Timers (server-authoritative):

| Phase | Duration |
|-------|----------|
| Countdown | 3000 ms |
| Answer window | 10000 ms |
| Recap delay after lock | 1000 ms |
| Between rounds | 8000 ms |

Client countdown display stops at **1**, never shows 0 (**Confirmed**).

## 7. Scoring

From `server/src/game/scoring.ts` (**Confirmed**):

1. Uppercase Levenshtein distance between spell and guess.
2. `accuracy = max(0, 1 - distance / maxLen)`.
3. `baseScore = round(accuracy * 120)` (max 120).
4. Speed bonus (max 20): full if ≤3000 ms, zero if ≥7000 ms, linear between.
5. `totalScore = baseScore + bonusScore`.

**Important:** speed bonus does **not** require accuracy — a fast wrong/empty guess still earns bonus (**Confirmed**). Server duration is `now - prompt start`, clamped to the 10s window; client duration is ignored.

Round winner: highest round `totalScore`, or `null` on tie.

## 8. Beam and winners

Beam update (2 players only) (**Confirmed**):

```
beamOffset += (player0.totalScore - player1.totalScore) * 0.5
beamOffset clamped to [-100, 100]
```

Player order is lobby join order (host typically index 0). Client multiplies offset for visuals.

### End reasons (`GameSummary.reason`)

| Reason | When | Winner selection |
|--------|------|------------------|
| `beam` | `\|beamOffset\| >= 100` | Highest cumulative score |
| `rounds` | Final round finished without beam win | Highest cumulative score |
| `forfeit` | Opponent left/disconnected mid-duel | Remaining player |

Ties on score: sort is stable; first of equal totals wins — **no draw state** (**Confirmed**). Summary UI shows Defeat whenever `winnerId !== localPlayer.id`, including null winner edge cases.

## 9. Errors

Server emits Socket.IO `error` with `{ message }` for validation failures (bad name, missing lobby, full lobby, duel already started, not host, not ready, bad prompt, duplicate submit, etc.).

Client surfaces:

- Landing join: inline error
- EntryPage: dismissible banner
- Host settings: confirm disabled when disconnected / invalid custom set
- Landing Host/Join: **not** disabled when disconnected (**Confirmed gap**)

## 10. Disconnections and reconnections

| Situation | Behavior | Level |
|-----------|----------|-------|
| Disconnect in lobby | Removed from lobby; host reassigned if needed; ready flags cleared | Confirmed |
| Last player leaves lobby | Lobby deleted | Confirmed |
| Disconnect / leave in duel | Forfeit; remaining player wins; lobby reset to lobby phase | Confirmed |
| Socket auto-reconnect | Socket.IO client may reconnect with **new** `socket.id` | Confirmed |
| Reclaim seat / resume duel | **Not implemented** | Confirmed |
| Client `localPlayer` after reconnect | Cleared on disconnect; no rebind → Ready/You labels break | Confirmed |

## 11. Incomplete, unused, or inconsistent features

| Item | Evidence |
|------|----------|
| `lobby:updateSettings` unused by client | Typed + server-handled; never emitted from UI |
| EntryPage / EntryForm | Legacy fallback; primary UX is Landing |
| On-screen keyboard non-interactive | Highlight only |
| `scores` / `sendPing` / `lastPong` unused in App | Hook/API residue |
| `readingSpeed` ignored for catalog MP3 rate | Only TTS uses it |
| How to Play omits scoring/timeouts/forfeit | Minimal modal |
| Duplicate `WIZARDS` arrays ×3 | Landing, Lobby, WizardBeam |
| Join code copy “4-letter” vs `maxLength={6}` | Landing UI inconsistency |
| Nickname UI 12 vs server 24 | Inconsistency |
| Empty dirs `easy 2` / `medium 2` under audio | Unused leftovers |
| GameSummary tie UX | Always Victory or Defeat, no Draw |
| `showResultsPending` “Adjudicating…” | Rarely reachable while waiting (prompt still set) |
| Root `package-lock.json` empty / no root `package.json` | Monorepo glue incomplete |
| No tests | Zero `*.test.*` / `*.spec.*` files |

## 12. Catalog / audio consistency (audit snapshot)

| Source | easy | medium | hard |
|--------|------|--------|------|
| `spellCatalog.json` | 82 | 84 | 80 |
| `spellAudioManifest.json` | 82 | 84 | 80 |
| `client/public/audio/spells` | 82 | 84 | 80 |

No missing manifest↔file mismatches found in this audit. Catalog is append-only for stable opaque IDs (see AUDIO.md).
