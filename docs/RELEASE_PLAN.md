# Spellcaster Release Plan

Prioritized work to take Spellcaster from “playable prototype” to a shippable production release. Agents and contributors **must consult this plan before making changes** and update task status + docs when behavior changes.

Detailed approved implementation blueprint for scoring and duel-flow UX: [SCORING_DUEL_UX_IMPLEMENTATION_PLAN.md](SCORING_DUEL_UX_IMPLEMENTATION_PLAN.md).

Status values: `Not Started` | `In Progress` | `Blocked` | `Complete`

---

## Critical

### C1 — Fix host-create screen transition (remove EntryPage)


| Field              | Value                                                                                                                                                                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**         | Complete                                                                                                                                                                                                                                                          |
| **Why**            | Host create left Landing before lobby existed and could hit legacy EntryPage; spare create/join UI confused the product path.                                                                                                                                     |
| **Affected files** | `client/src/App.tsx`, `client/src/components/HostSettingsModal.tsx`; deleted `EntryPage.tsx`, `EntryForm.tsx`, `ServerErrorBanner.tsx`                                                                                                                            |
| **Acceptance**     | Host create stays on Landing with settings modal and **Creating…** until `lobby:state`; no EntryPage in the app. Fallback if routing is confused: Lobby if `lobby` exists, else Landing. Post-duel Lobby-under-summary unchanged (not a confirmed EntryPage bug). |




### C2 — Normalize room codes on every lobby handler


| Field              | Value                                                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**         | Not Started                                                                                                                                                                                |
| **Why**            | Ready/start/settings can fail if clients send non-normalized codes; join works, later ops do not.                                                                                          |
| **Affected files** | `server/src/sockets/index.ts`                                                                                                                                                              |
| **Acceptance**     | `setReady`, `updateSettings`, `startDuel`, and any new lobby ops use the same `normalizeRoomCode` path as join/submit; tests or manual checklist cover lowercase join codes through start. |




### C3 — Documented, deployable production env + start path


| Field              | Value                                                                                                                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**         | Not Started                                                                                                                                                                                                                                                    |
| **Why**            | No deployment config; wrong `cwd`/env breaks CORS, sockets, or manifest loading.                                                                                                                                                                               |
| **Affected files** | `README.md`, new `server/.env.example` + `client/.env.example` (requires `.gitignore` fix), optional `Dockerfile` / compose, `server/src/game/spellAudio.ts`, CI                                                                                               |
| **Acceptance**     | Checked-in env examples; one documented deploy path (e.g. Docker or PaaS) that serves client static+audio and one server instance with `CLIENT_ORIGIN` + `VITE_SERVER_URL`; `/health` returns ok; two browsers can complete a duel against the deployed stack. |




### C4 — Graceful disconnect UX (minimum viable)


| Field              | Value                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**         | Not Started                                                                                                                                                                                                                                                                                                                                       |
| **Why**            | Disconnect silently forfeits and breaks `localPlayer`; players experience unexplained Defeat / dead Ready buttons.                                                                                                                                                                                                                                |
| **Affected files** | `server/src/sockets/index.ts`, `server/src/game/duelManager.ts`, `client/src/hooks/useLobby.ts`, `client/src/App.tsx`, UI banners                                                                                                                                                                                                                 |
| **Acceptance**     | At minimum: clear “Opponent left — you win by forfeit” / “You disconnected” messaging; lobby reconnect policy documented (either short grace reconnect **or** explicit “session ended, return to landing”). No silent `localPlayer === null` mid-lobby without recovery CTA. Full seamless mid-duel resume may be High (H1), not required for C4. |




### C5 — Fix competitive scoring exploit (speed bonus)


| Field              | Value                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**         | Complete                                                                                                                                                            |
| **Why**            | Fast nonsense guesses still earn speed points; undermines fairness.                                                                                                 |
| **Affected files** | `server/src/game/scoring.ts`, docs (`GAME_SPEC.md`), any client score copy                                                                                          |
| **Acceptance**     | Existing speed curve remains unchanged for answers with **at least 30% accuracy**; answers below 30% receive zero speed bonus. Exactly 30% qualifies. Keep the **Typing speed** label. Unit tests cover the boundary, perfect/fast, wrong/fast, empty/timeout cases, and beam regression; spec updated. |


### C6 — Make beam position match cumulative score


| Field              | Value                                                                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**         | Complete                                                                                                                                                                                              |
| **Why**            | Raw per-round movement and amplified client geometry could push the collision beyond a wizard, while the visual did not clearly represent the cumulative-score lead.                                |
| **Affected files** | `server/src/game/duelManager.ts`, `client/src/components/WizardBeam.tsx`, shared socket types, beam tests and documentation                                                                           |
| **Acceptance**     | Beam position is derived from the cumulative-score difference; a 280-point lead reaches ±100; both clients render one shared collision point that remains between the wand tips; glow filters render without rectangular top/bottom clipping; PR CI tests the math and SVG bounds. |


---



## High



### H1 — Reconnect / resume design for lobby (and optional duel grace)


| Field              | Value                                                                                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**         | Not Started                                                                                                                                                                                              |
| **Why**            | Mobile networks drop often; current identity = `socket.id` makes drops punishing.                                                                                                                        |
| **Affected files** | `shared/types/socket.ts`, server sockets + duelManager, client socket/lobby hooks                                                                                                                        |
| **Acceptance**     | Written design + implementation for at least lobby rejoin with stable player token; duel either has a short reconnect grace or explicit forfeit after N seconds. Documented in ARCHITECTURE + GAME_SPEC. |




### H2 — Runtime validation for socket payloads


| Field              | Value                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**         | Not Started                                                                                                                            |
| **Why**            | Malformed events can throw and disrupt handlers; types are compile-time only.                                                          |
| **Affected files** | `server/src/sockets/index.ts`, possibly shared validators module                                                                       |
| **Acceptance**     | All Client→Server handlers validate/coerce payloads; invalid input yields `error` message, never an uncaught exception in the handler. |




### H3 — Basic automated tests for core game logic


| Field              | Value                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **Status**         | In Progress                                                                                                                       |
| **Why**            | Scoring and duel-flow tests are now present; sanitize, queue, and room-code coverage are still incomplete.                        |
| **Affected files** | new test setup under `server/` (and optionally client), `scoring.ts`, sanitize helpers, `spells.ts`                               |
| **Acceptance**     | CI runs tests; coverage includes Levenshtein/scoring, custom-word sanitize, spell queue length, and room-code normalize behavior. |




### H4 — Wire or remove mid-lobby settings


| Field              | Value                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **Status**         | Not Started                                                                                                                   |
| **Why**            | Server supports `lobby:updateSettings`; UI only sets settings at create — inconsistent product.                               |
| **Affected files** | `client/src/pages/LobbyPage.tsx`, settings components, `useLobby.ts`                                                          |
| **Acceptance**     | Host can change settings in lobby (resetting ready), **or** feature explicitly removed from server/types/docs as unsupported. |




### H5 — Apply reading speed to catalog audio (or clarify UI)


| Field              | Value                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **Status**         | Not Started                                                                                                                   |
| **Why**            | Setting claims to control reading speed but only affects custom TTS.                                                          |
| **Affected files** | `client/src/hooks/useSpellAudio.ts`, settings copy, HowToPlay                                                                 |
| **Acceptance**     | Catalog playback uses `HTMLAudioElement.playbackRate` (clamped) **or** UI copy states “custom words only”; GAME_SPEC matches. |




### H6 — CI hygiene (lockfiles, cache, lint job)


| Field              | Value                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Status**         | Not Started                                                                                                 |
| **Why**            | Empty root lockfile + `cache: 'npm'` is brittle; no lint gate.                                              |
| **Affected files** | `.github/workflows/ci.yml`, root package files, eslint configs                                              |
| **Acceptance**     | CI cache works for client/server (or cache disabled intentionally); optional lint job; builds remain green. |


### H7 — Tighten round pacing and preserve full result detail


| Field              | Value                                                                                                                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**         | Complete                                                                                                                                                                                                                      |
| **Why**            | The answer window lacks a visible timer, live recaps are dense, and the fixed eight-second recap slows repeat play.                                                                                                           |
| **Affected files** | shared socket types, `duelManager.ts`, socket handlers, `useLobby.ts`, `GamePage.tsx`, recap/summary components, timer and score components                                                                                  |
| **Acceptance**     | Small ten-second answer ring; lightweight cumulative scores float above their matching wizard sprites without an opaque HUD container while player names remain below the sprites; the live answer field rejects clipboard paste while other inputs retain normal paste behavior; content-driven casting/recap stage contains every control; compact five-second recap retains both submitted guesses; both players can skip together with a plain inline readiness count; three-second countdown unchanged; full per-round details remain accessible in end-summary disclosure. |


### H8 — Show the game-ending cast before summary


| Field              | Value                                                                                                                                                                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**         | Complete                                                                                                                                                                                                                                             |
| **Why**            | Terminal recap and completion are emitted back-to-back, so clients clear the duel before the final cast and beam result can land visually.                                                                                                           |
| **Affected files** | shared socket types, `duelManager.ts`, `useLobby.ts`, `GamePage.tsx`, `WizardBeam.tsx`, terminal-flow tests                                                                                                                                        |
| **Acceptance**     | Server delays summary through a bounded finalization phase; real score-derived beam state renders first; a presentation-only winning sweep reaches the loser on non-tied rounds-complete wins; normal beam math/appearance/animation remain unchanged. |


---



## Medium



### M1 — Interactive on-screen keyboard (or hide on desktop-only)


| Field              | Value                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**         | Not Started                                                                                                                                  |
| **Why**            | Visual keyboard suggests tap-to-type but is `pointer-events-none`.                                                                           |
| **Affected files** | `client/src/components/OnScreenKeyboard.tsx`, `GamePage.tsx`, `useSpellInput.ts`                                                             |
| **Acceptance**     | Keys append/backspace/submit guess on touch devices, **or** keyboard is clearly decorative / removed on mobile in favor of OS keyboard copy. |




### M2 — Expand How to Play + in-game feedback


| Field              | Value                                                                            |
| ------------------ | -------------------------------------------------------------------------------- |
| **Status**         | Complete                                                                         |
| **Why**            | Players lack scoring, timeout, beam, and forfeit rules.                          |
| **Affected files** | `HowToPlayModal.tsx`, possibly Lobby/Game copy                                   |
| **Acceptance**     | Modal explains listen→type→score→beam win / rounds / forfeit, including the inclusive 30% speed-bonus qualification rule; matches GAME_SPEC. |




### M3 — Deduplicate wizard catalog


| Field              | Value                                                                   |
| ------------------ | ----------------------------------------------------------------------- |
| **Status**         | Not Started                                                             |
| **Why**            | Triple-defined `WIZARDS` will drift.                                    |
| **Affected files** | `LandingPage.tsx`, `LobbyPage.tsx`, `WizardBeam.tsx`, new shared module |
| **Acceptance**     | Single exported wizard list/types; all consumers import it.             |




### M4 — Fix CSV error display + join code UX consistency


| Field              | Value                                                                           |
| ------------------ | ------------------------------------------------------------------------------- |
| **Status**         | Not Started                                                                     |
| **Why**            | Misleading errors and 4 vs 6 character confusion.                               |
| **Affected files** | `GameSettingsControls.tsx`, `LandingPage.tsx`                                   |
| **Acceptance**     | Upload errors show real message; join code UI enforces 4 chars to match server. |




### M5 — Optimize wizard image delivery


| Field              | Value                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Status**         | Not Started                                                                                                            |
| **Why**            | ~1MB PNGs hurt mobile load.                                                                                            |
| **Affected files** | `client/src/assets/spellcaster-wizards/`*, build pipeline                                                              |
| **Acceptance**     | Compressed/responsive assets; Lighthouse or manual check shows meaningful size reduction without obvious quality loss. |




### M6 — Lobby TTL cleanup for abandoned rooms


| Field              | Value                                                                   |
| ------------------ | ----------------------------------------------------------------------- |
| **Status**         | Not Started                                                             |
| **Why**            | Solo abandoned lobbies never expire.                                    |
| **Affected files** | `server/src/sockets/index.ts`                                           |
| **Acceptance**     | Inactive lobbies expire after a documented TTL; metrics/log on cleanup. |




### M7 — Remove or quarantine dead UI paths


| Field              | Value                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------- |
| **Status**         | In Progress                                                                               |
| **Why**            | Dead UI and leftover asset dirs add confusion.                                            |
| **Affected files** | `App.tsx` (EntryPage removed); remaining: `client/public/audio/spells/easy 2`, `medium 2` |
| **Acceptance**     | EntryPage/EntryForm gone (**done** via C1); empty audio dirs deleted.                     |




### M8 — Draw / tie UX


| Field              | Value                                                                               |
| ------------------ | ----------------------------------------------------------------------------------- |
| **Status**         | Not Started                                                                         |
| **Why**            | Score ties currently crown one player; UI has no Draw.                              |
| **Affected files** | `duelManager.ts`, `GameSummaryCard.tsx`, `useSpellAudio.ts`, shared types           |
| **Acceptance**     | Product decision implemented: true draws **or** documented tie-break; SFX/UI match. |


---



## Optional



### O1 — Rate limiting and basic abuse controls


| Field              | Value                                                                      |
| ------------------ | -------------------------------------------------------------------------- |
| **Status**         | Not Started                                                                |
| **Why**            | Public socket server can be spammed.                                       |
| **Affected files** | server socket layer, possibly middleware                                   |
| **Acceptance**     | Per-IP/socket limits on create/join/submit; excess yields friendly errors. |




### O2 — Structured logging + error tracking


| Field              | Value                                                                        |
| ------------------ | ---------------------------------------------------------------------------- |
| **Status**         | Not Started                                                                  |
| **Why**            | Production debugging needs more than `console.log`.                          |
| **Affected files** | server bootstrap, client error boundary                                      |
| **Acceptance**     | Request/socket correlation ids; optional Sentry (or similar) hooked in prod. |




### O3 — Analytics funnel


| Field              | Value                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------- |
| **Status**         | Not Started                                                                               |
| **Why**            | Need visibility into create→join→finish rates.                                            |
| **Affected files** | client App/hooks, privacy note in README                                                  |
| **Acceptance**     | Privacy-safe events for lobby created, duel started, duel completed, forfeit; documented. |




### O4 — Multi-instance Socket.IO readiness


| Field              | Value                                                                             |
| ------------------ | --------------------------------------------------------------------------------- |
| **Status**         | Not Started                                                                       |
| **Why**            | Required only if scaling beyond one Node process.                                 |
| **Affected files** | server adapter, external store for lobbies/duels                                  |
| **Acceptance**     | Two server processes share rooms via Redis (or equivalent); ARCHITECTURE updated. |




### O5 — Accessibility pass


| Field              | Value                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------- |
| **Status**         | Not Started                                                                                   |
| **Why**            | Live game UI needs keyboard/AT basics for a public launch.                                    |
| **Affected files** | modals, game prompt regions, motion CSS                                                       |
| **Acceptance**     | Focus management on modals; aria-live for countdown/prompt; prefers-reduced-motion respected. |




### O6 — E2E duel smoke test


| Field              | Value                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------ |
| **Status**         | Not Started                                                                                |
| **Why**            | Catches socket+UI regressions CI builds miss.                                              |
| **Affected files** | new Playwright/Cypress project, CI                                                         |
| **Acceptance**     | Automated two-client (or mocked dual socket) flow: create→join→ready→start→submit→summary. |


---



## Suggested implementation order

1. **C1** screen transitions
2. **C2** room-code normalize
3. **C5** scoring fairness
4. **C4** disconnect messaging
5. **C3** deploy path + env examples
6. **H3** tests (lock scoring/sanitize)
7. **H7** timer / score indicator / recap pacing and end-result disclosure
8. **H8** terminal cast presentation
9. **H2** payload validation
10. **H5** / **H4** settings honesty
11. **H1** reconnect design
12. Medium polish (**M1–M8**), then Optional as capacity allows



## Tracking notes

- When starting a task, set status to `In Progress` and link the PR/branch.
- When done, set `Complete` and update `GAME_SPEC.md` / `ARCHITECTURE.md` / `PRODUCTION_READINESS.md` as needed.
- Do not mark Complete without meeting the acceptance criterion.
