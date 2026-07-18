# Spellcaster Production Readiness

Audit date: **2026-07-16**. No application-code fixes were applied during this phase. Findings distinguish **confirmed** (code-traced) from **likely** (plausible race/UX/environment issues).

## 1. Tooling check results (exact)

Commands run from the repo on 2026-07-16:

| Check | Command | Result |
|-------|---------|--------|
| Client typecheck | `cd client && npx tsc --noEmit` | **PASS** (exit 0) |
| Server typecheck | `cd server && npx tsc --noEmit` | **PASS** (exit 0) |
| Client build | `cd client && npm run build` | **PASS** (exit 0); Vite built successfully. Warnings: outdated `baseline-browser-mapping` / `caniuse-lite` browserslist data |
| Server build | `cd server && npm run build` | **PASS** (exit 0) |
| Lint | — | **N/A** — no ESLint/Prettier config or npm lint scripts |
| Unit/integration/e2e tests | — | **N/A** — zero `*.test.*` / `*.spec.*` files; no test runner deps |
| Root install | — | **N/A** — no root `package.json` |

CI workflow (`.github/workflows/ci.yml`) mirrors client/server install+build only. Not re-run against GitHub Actions in this audit.

## 2. Confirmed bugs

| ID | Bug | Evidence |
|----|-----|----------|
| B1 | **Post-duel EntryPage flash** | `duel:completed` clears `duel` while lobby may still be `in-duel` until `lobby:state` reset arrives (`useLobby.ts` completed handler + `App.tsx` screen conditions). Users can briefly (or longer under lag) see EntryPage under the summary. |
| B2 | **Host create forces game screen before lobby exists** | `handleConfirmHostSettings` sets `currentScreen` to `'game'` immediately (`App.tsx`), so EntryPage shows until `lobby:state`. Join path correctly waits. |
| B3 | **No reconnect / seat reclaim** | Disconnect → `leaveCurrentLobby` (forfeit if in duel). New `socket.id` cannot reclaim player slot. Client clears `socketId` on disconnect → `localPlayer` null. |
| B4 | **Room code normalize inconsistency** | `lobby:join` / `duel:submitSpell` normalize codes; `lobby:setReady`, `lobby:updateSettings`, `lobby:startDuel` look up raw `roomCode`. Lowercase codes can fail those ops. |
| B5 | **Speed bonus ignores accuracy** | `computeRoundScore` always adds `computeSpeedBonus(durationMs)` (`scoring.ts`). Instant wrong/empty guess still earns up to +20. |
| B6 | **CSV upload errors always show “Not a .csv!”** | `GameSettingsControls` ignores actual `uploadError` string for display. |
| B7 | **Invalid Tailwind class `scale-85`** | `GamePage.tsx` — not in default Tailwind scale scale; keyboard scale has no effect. |
| B8 | **`showResultsPending` nearly dead** | Requires `!prompt`, but prompt remains while waiting for opponent; “Adjudicating…” rarely appears. |
| B9 | **Tie / non-winner always plays loss SFX + Defeat UI** | `winnerId !== localPlayer.id` → loss path; no Draw. Score ties still pick a winner via stable sort. |
| B10 | **Catalog `readingSpeed` unused for MP3 playback rate** | Only browser TTS applies rate (`useSpellAudio.ts`). Setting is misleading for easy/medium/hard. |

## 3. Likely bugs and edge cases

| ID | Issue | Why likely |
|----|-------|------------|
| L1 | Round timeout overwrite race | After auto-submissions, a late real submit can overwrite without re-triggering `lockRound` if all slots were already filled by autos (`duelManager.ts`). Window is short (~1s recap delay). |
| L2 | Abandoned 1-player lobbies accumulate | Empty lobbies delete; solo host who never leaves keeps a Map entry forever. Soft memory leak. |
| L3 | Beam early-win winner by score not beam sign | Normally aligned for 2 players; any future asymmetry would surprise. |
| L4 | Landing Host/Join not gated on `connected` | Emits while disconnected; user may see no immediate feedback. |
| L5 | StrictMode double audio start in dev | Effect cleanup exists; brief double-speak/play possible in React 18 StrictMode. |
| L6 | Beam visual clamp glitches at high offsets | Client multiplies server offset (`×3.0`); geometry clamps may snap endpoints. |
| L7 | Manifest miss under unusual `cwd` | `spellAudio.ts` `__dirname` fallbacks do not match `dist/server/src/game`; depends on `cwd` heuristics. |
| L8 | Malformed socket payloads can throw | No runtime schema; destructuring `undefined` crashes the handler for that event. |
| L9 | Nickname length mismatch (UI 12 vs server 24) | Confusing limits; not a crash. |
| L10 | Join code UI max 6 vs server 4 | Extra chars fail join with “could not find”. |

## 4. Security concerns

| Severity | Concern |
|----------|---------|
| High | No authentication — any client can create/join/spam rooms |
| High | No rate limiting on socket events — DoS / lobby spam |
| Medium | Custom prompts send plaintext answers (needed for TTS; cheat-friendly) |
| Medium | Public catalog MP3s can be scraped and mapped offline |
| Medium | Speed-bonus exploit (B5) affects competitive integrity |
| Medium | `wizardId` / some booleans unsanitized — reflected to peers |
| Low | CORS defaults to localhost; mis-set `CLIENT_ORIGIN` breaks or over-allows |
| Low | Verbose submission logging may leak guesses into server logs |
| Info | `ELEVENLABS_API_KEY` correctly gitignored via `server/.env`; ensure never committed |

## 5. Missing validation and error handling

- No shared runtime validators (zod/io-ts/etc.) for socket payloads
- `ready` not coerced to boolean
- No client retry/backoff messaging for connect failures beyond status string
- Host settings modal lacks error banner if create fails after screen switch
- No graceful “opponent disconnected” toast before summary (only forfeit summary)
- Health check only — no readiness that verifies manifest loaded

## 6. Performance and scalability risks

| Risk | Detail |
|------|--------|
| Single-process memory state | Cannot horizontally scale Socket.IO without sticky sessions + shared adapter + shared lobby store |
| Process restart kills all games | No persistence |
| Large wizard PNGs | Client build emits ~0.86–1.3 MB per wizard asset — heavy for mobile |
| Levenshtein per submission | Fine at 2 players; not a current hotspot |
| Lobby soft-leak (L2) | Long-lived servers grow Map slowly |
| No compression/CDN guidance | Audio pack is hundreds of MP3s; must ship with frontend |

## 7. Mobile and responsive design

| Observation | Impact |
|-------------|--------|
| Landing/settings use `sm`/`md` breakpoints | Generally usable |
| Game center fixed `h-[280px]` | Tight on short phones with beam + keyboard |
| On-screen keyboard non-interactive | Mobile must use OS keyboard |
| Hidden input + `autoCapitalize="characters"` | Helpful for mobile typing |
| Summary table scroll `max-h-72` | OK but dense on small screens |
| Touch targets on landing generally large | OK |

Not device-lab tested in this audit (**Uncertain** for iOS Safari audio autoplay policies — browsers often require a prior user gesture; host/join clicks may satisfy).

## 8. Accessibility concerns

- Decorative particles / heavy color contrast not audited with tooling
- Countdown and prompt changes may lack polite live-region announcements
- Modal focus trap not verified beyond Escape/backdrop close
- Victory/Defeat is color + text; icons alone not required
- On-screen keyboard is visual-only — confusing for AT users expecting buttons
- No reduced-motion preferences for beam/hop animations
- Font loading from Google Fonts CDN — privacy/reliability consideration

## 9. Deployment blockers

| Blocker | Detail |
|---------|--------|
| No deployment config | No Docker, compose, Procfile, or PaaS manifests |
| Env contract undocumented until this audit | Need `PORT`, `CLIENT_ORIGIN`, build-time `VITE_SERVER_URL` |
| `.gitignore` ignores `server/.env.example` | Prevents committing a safe example file without ignore change |
| Empty root `package-lock.json` + CI `cache: 'npm'` | Cache step may warn/fail or cache nothing useful |
| Multi-instance not supported | Load balancer without sticky + shared state breaks rooms |
| Audio must deploy with frontend | `client/public/audio/spells/**` required in static assets |
| Server start path quirks | `npm start` expects built nested dist layout + resolvable manifest |
| No HTTPS/WSS guidance | Production sockets typically need TLS termination |

## 10. Missing tests, monitoring, logging, analytics, ops

| Area | Status |
|------|--------|
| Unit tests (scoring, sanitize, queue) | Missing |
| Socket integration tests | Missing |
| E2E duel happy path | Missing |
| Load / soak tests | Missing |
| Structured logging | `console.log` / `console.error` only |
| Metrics / APM | Missing |
| Error tracking (Sentry etc.) | Missing |
| Analytics / funnels | Missing |
| Alerting on `/health` | Missing (endpoint exists) |
| Runbooks / on-call | Missing |
| Staging environment | Missing |

## 11. Incomplete product surfaces (release risk)

- Mid-lobby settings UI absent despite server support
- How to Play under-explains scoring, timeouts, forfeit
- Rematch UX depends on lobby reset race (B1)
- EntryPage legacy path still reachable
- Empty `easy 2` / `medium 2` audio directories clutter public assets

## 12. What looks healthy

- Client and server **typecheck and build succeed**
- Catalog / manifest / public MP3 counts match (246/246/246)
- Opaque audio anti-cheat migration documented and wired
- Server-authoritative duration and scoring for catalog rounds
- CI builds both packages on PR/push
- CORS + basic lobby sanitization present
