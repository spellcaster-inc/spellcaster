# Scoring and Duel UX Implementation Plan

Status: **Implemented and verified; latest duel-layout refinement verified on 2026-08-01**  
Baseline: `game/score-improvements` synchronized with `main` at `ed6dd59` on 2026-07-31  
Related release work: C5, H3, H7, H8, M2, M8 in `docs/RELEASE_PLAN.md`

This document is a handoff plan for implementing the approved scoring, recap, timer, score-display, and end-of-duel presentation changes. It is intentionally explicit about server authority and the recently fixed beam contract.

## 1. Product decisions

The implementation must follow these decisions:

1. Keep the existing accuracy formula, base-score formula, speed curve, maximum round score, and the label **Typing speed**.
2. Do **not** multiply the speed bonus by accuracy.
3. A player qualifies for the existing speed bonus only when `accuracy >= 0.30`. Below 30% accuracy, `bonusScore` is exactly `0` regardless of submission speed. Exactly 30% qualifies.
4. Do not change the normal beam appearance, geometry, score-to-offset formula, signed player ordering, clamp, or 450 ms movement animation.
5. Keep the pre-round countdown at three seconds.
6. Reduce the normal between-round recap window from eight seconds to five seconds.
7. During a non-terminal recap, both players may select **Skip to next spell**. The server advances early only after both current duel participants have selected it.
8. Replace the dense in-round recap with a compact result. Preserve the complete per-round breakdown in the end summary behind an accessible expandable control.
9. Add a small persistent score indicator during the duel.
10. Add a small ten-second magical timer ring while a player is answering. It is display-only; the server remains authoritative for timeout and duration.
11. Before showing the game summary, keep the duel screen mounted long enough to show the game-ending cast. On a non-tied rounds-complete victory, add a terminal cosmetic beam sweep to the losing wizard even when the real cumulative lead is below 280.
12. The terminal sweep must not overwrite the real score, real `beamOffset`, or normal beam rules. It is a finishing presentation state, not a scoring event.

## 2. Existing contracts that must remain true

### Scoring

- Accuracy is case-insensitive normalized Levenshtein accuracy.
- `baseScore = round(accuracy * 120)`.
- The raw speed bonus remains 20 at or below 3 seconds, 0 at or above 7 seconds, and linear between those points.
- Maximum round score remains 140.
- Submission duration remains server-calculated from prompt start and clamped to the ten-second answer window. Client duration is never trusted.
- Round score remains `baseScore + bonusScore`; cumulative score remains the sum of round scores.

### Beam

- `players[0]` is the left wizard and `players[1]` is the right wizard.
- `scoreLead = player0 cumulative score - player1 cumulative score`.
- `beamOffset = clamp((scoreLead / 280) * 100, -100, 100)`.
- Positive offset favors player 0 and moves the collision toward the right wizard; negative offset favors player 1 and moves it toward the left wizard.
- A real 280-point cumulative lead still ends the duel through beam overwhelm.
- `server/src/game/beam.ts` and `client/src/lib/beamGeometry.ts` remain the sources of truth. Do not duplicate or reinterpret their math in a component.

The scoring threshold will change some cumulative score differences by removing speed points from sub-30% answers. That is intended. It must move the beam only through the existing `calculateBeamOffset` function.

## 3. Recommended implementation order

Implement and verify each stage before starting the next. Avoid combining all behavior into one large change.

### Stage 1 — Add the 30% speed-bonus qualification rule

Files:

- `server/src/game/scoring.ts`
- new `server/test/scoring.test.ts`
- optional new `server/test/scoringBeamIntegration.test.ts`

Implementation:

1. Add a named constant such as `MIN_SPEED_BONUS_ACCURACY = 0.30` beside the other scoring constants.
2. Keep `computeSpeedBonus(durationMs)` unchanged so it continues to represent the raw time-based curve.
3. In `computeRoundScore`, calculate accuracy and base score first.
4. Set `bonusScore` to the raw speed bonus when `accuracy >= MIN_SPEED_BONUS_ACCURACY`; otherwise set it to `0`.
5. Keep the returned shape and all shared payload fields unchanged.
6. Do not change the UI label **Typing speed**.

Required tests:

- Perfect answer at or below 3 seconds: base 120, bonus 20, total 140.
- Exactly 30% accuracy at or below 3 seconds: speed bonus 20. One deterministic fixture is spell `ABCDEFGHIJ` and guess `ABCXXXXXXX` (three matching positions, seven substitutions).
- A representative answer below the threshold: speed bonus 0. One deterministic fixture is `ABCDEFGHIJ` versus `ABXXXXXXXX` (20% accuracy).
- Zero-accuracy fast answer: speed bonus 0.
- Empty fast answer sent by a raw socket client: speed bonus 0.
- Qualifying answer at 4, 5, 6, and 7 seconds preserves the existing 15/10/5/0 curve.
- Timeout preserves accuracy points, if any, but gives no speed bonus.
- Case insensitivity and existing Levenshtein behavior remain unchanged.

Beam regression check:

- Compose two scored results, add them to cumulative totals, and pass those totals to `calculateBeamOffset`.
- Assert the expected positive and negative offsets when player order is reversed.
- Assert that the scoring test never mutates or bypasses beam math.
- Run the existing server and client beam suites unchanged.

### Stage 2 — Add shared duel timing and recap-skip contracts

Files:

- `shared/types/socket.ts`
- `server/src/game/duelManager.ts`
- `server/src/sockets/index.ts`
- `client/src/hooks/useLobby.ts`

Recommended shared contracts:

```ts
interface RecapSkipPayload {
  roomCode: string;
  roundNumber: number;
}

interface RecapSkipStatePayload {
  roomCode: string;
  roundNumber: number;
  playerIds: string[];
}

interface DuelFinisherPayload {
  roomCode: string;
  roundNumber: number;
  winnerId: string;
  targetBeamOffset: -100 | 100;
  startsInMs: number;
  durationMs: number;
}
```

Contract changes:

- Add `answerWindowMs` to both prompt payload modes. Emit `10_000` from the server rather than duplicating a magic number in the client.
- Add Client→Server `duel:skipRecap`.
- Add Server→Client `duel:recapSkipState`.
- Add Server→Client `duel:finisher` for terminal presentation only.
- Update both event interfaces and every listener/emitter in the same change.

Socket handler requirements:

- Normalize the room code before lookup, following the existing submit path and release-plan item C2.
- Confirm that the socket belongs to the duel.
- Confirm that the requested round is the active recap round.
- Treat duplicate votes as idempotent.
- Reject or harmlessly ignore stale, future, terminal, and post-duel skip requests.
- Never accept a client-provided winner, beam target, timer duration, or score.

### Stage 3 — Implement five-second recap orchestration and mutual skip

Files:

- `server/src/game/duelManager.ts`
- `server/src/sockets/index.ts`
- server tests using Vitest fake timers

Server state:

- Replace the implicit eight-second waiting period with an explicit recap state containing the round number and a `Set` of player skip votes.
- Rename `BETWEEN_ROUND_DELAY_MS` to a clearer recap constant and set it to `5_000`.
- Keep `COUNTDOWN_MS = 3_000`, `ROUND_TIMEOUT_MS = 10_000`, and `RECAP_DELAY_MS = 1_000` unchanged.

Normal recap flow:

1. Complete and score the round.
2. Emit `duel:roundRecap`.
3. Create recap state and schedule the next three-second countdown for five seconds later.
4. On each valid skip request, record the player ID and broadcast `duel:recapSkipState`.
5. When both current participants have voted, clear the five-second timer exactly once and queue the normal three-second countdown immediately.
6. Clear recap state when the countdown starts, the duel completes, or a player leaves.

Race conditions to cover:

- A second vote arriving at the same time as the five-second timer must not queue two countdowns.
- Duplicate votes must not increase the count.
- A delayed vote from the prior round must not skip the current recap.
- A disconnect continues to use existing forfeit behavior unless the duel is already in terminal finalization.
- No skip button or skip state is created for a game-ending recap.

### Stage 4 — Add the timer ring, compact scores, and compact in-round recap

Files:

- `client/src/App.tsx`
- `client/src/pages/GamePage.tsx`
- `client/src/hooks/useLobby.ts`
- new `client/src/hooks/usePromptTimer.ts`
- new `client/src/components/SpellTimerRing.tsx`
- new `client/src/components/DuelScoreIndicator.tsx`
- revise or replace `client/src/components/RoundRecapCard.tsx`
- client unit tests for pure timer/formatting helpers

#### Small timer ring

- Render a compact SVG ring, approximately 44–52 px, in the casting panel header.
- Show whole seconds in the center and an accessible label such as “8 seconds remaining.”
- Derive remaining time from server `startedAt` plus `answerWindowMs`; clamp from 0 to 10 seconds.
- Reset on every new `promptId` and stop when the prompt clears.
- Use a calm state above three seconds and a visually urgent state for the final three seconds.
- Respect `prefers-reduced-motion`; urgency must not depend only on animation or color.
- Do not auto-submit, calculate score, or extend the server deadline when the ring reaches zero.
- Hide or replace the ring with a submitted indicator after the local player casts.

#### Persistent score indicator

- `useLobby` already maintains `scores`; destructure it in `App` and pass it to `GamePage`.
- Show both player names and cumulative totals in a small, stable scoreboard in the unused upper portion of the wizard/beam arena, with each name/score pair centered in its equal-width player half.
- Keep lobby/server player order so left/right score placement matches the wizards and signed beam offset.
- Update only from server events. Never optimistically change a score on submission.
- Position the indicator independently from the wizard/beam geometry so it does not move wand tips, overlap the beam, or materially change the beam layout.

#### Compact in-round recap

- Show the revealed spell, both submitted guesses, both round scores, and a clear round winner/tie state.
- Optionally show one concise local metric such as accuracy, but remove the six-field grid from the live round flow.
- Add “Full breakdown available after the duel” as low-emphasis helper copy.
- Let the active casting/recap stage grow with its content instead of forcing it into a fixed-height box; no heading, keyboard, timer, score card, or action may escape the containing panel.
- Show **Skip to next spell** only for non-terminal recaps.
- Keep an inline readiness counter next to the button: `0/2`, `1/2`, then `2/2` as server-confirmed votes arrive. Optimistically include the local vote while its acknowledgement is pending.
- After the local vote, disable the button without replacing its label or adding a separate opponent-ready message.
- Let the server countdown event, not a local timer, dismiss the recap.

### Stage 5 — Move complete round detail into accessible end-summary disclosure

Files:

- `client/src/components/GameSummaryCard.tsx`
- optional extracted `client/src/components/RoundHistoryDisclosure.tsx`

The current `GameSummary.rounds` payload already contains all needed data; no new score payload should be necessary.

Design:

- Replace the always-expanded Battle Scroll table with one collapsed row/card per round.
- Each collapsed summary shows: round number, spell, both round totals, and the round winner/tie.
- Use an accessible click/keyboard disclosure (`<details>/<summary>` or a button with `aria-expanded`) for the full breakdown.
- Do not make hover the only way to access content; hover is unavailable on touch devices and inaccessible to keyboard users.
- Expanded content shows both players’ guess, correct spelling, accuracy, **Typing speed**, base score, speed bonus, round total, and cumulative total.
- Preserve a restrained hover/focus treatment for discoverability without opening content unexpectedly.
- Keep the overall result, average accuracy, average speed, total score, and return-to-lobby action visually dominant.
- Verify long words, empty guesses, 15-round matches, small screens, keyboard operation, and screen-reader labels.

### Stage 6 — Add the game-ending cast and terminal beam overwhelm

Files:

- `shared/types/socket.ts`
- `server/src/game/duelManager.ts`
- `client/src/hooks/useLobby.ts`
- `client/src/pages/GamePage.tsx`
- `client/src/components/WizardBeam.tsx`
- focused server and client tests

#### Server-owned finalization sequence

The current server emits `duel:roundRecap` and `duel:completed` back-to-back on a terminal round. The client then clears `duel` and `roundRecap`, so the last beam movement is not visible.

Change the terminal sequence to:

1. Score the final cast normally and compute the real cumulative `beamOffset`.
2. Emit the final `duel:roundRecap` so the existing 450 ms score-derived movement can settle.
3. Lock the outcome and mark the duel as finalizing. Once finalizing, a disconnect must not replace the earned result with a forfeit result.
4. For a non-tied `reason: 'rounds'` outcome whose real offset has not already reached ±100, emit `duel:finisher` with a server-derived target:
   - player 0 winner → `targetBeamOffset: 100`
   - player 1 winner → `targetBeamOffset: -100`
5. Give the normal movement roughly 500 ms to settle, then animate the terminal sweep over roughly 1,200–1,500 ms.
6. Emit `duel:completed` and reset the lobby only after the declared presentation duration plus a small buffer.
7. Use a server timer, not a client acknowledgement, so backgrounded or disconnected clients cannot stall the duel indefinitely.

Special cases:

- Real beam victory: the real offset is already ±100. Preserve the existing geometry; only hold the game screen long enough for the takedown to be visible.
- Forfeit: no final cast exists, so skip the finishing sweep and retain the existing immediate forfeit summary unless a separate disconnect UX project changes it.
- Exact cumulative tie: do not invent a visual score lead. This feature should not add a finishing sweep until M8 defines a real draw or tie-break policy.
- Duplicate completion paths: store and clear a finalization timer so summary/reset can occur only once.

#### Client presentation isolation

- Store `finisher` separately from the authoritative `duel.beamOffset`.
- First render the real recap offset exactly as today.
- After `startsInMs`, animate a presentation-only target inside `WizardBeam`.
- Do not write the target into `scores`, `RoundRecapPayload.beamOffset`, `DuelState.beamOffset`, or the game summary.
- Do not alter `calculateBeamCollisionPoint` or its signed convention.
- Reuse the current beam rendering. The normal appearance and normal 450 ms animation must remain unchanged outside terminal finalization.
- Clear scheduled animation frames/timeouts on unmount and respect reduced-motion preferences by snapping the cosmetic sweep after the truthful score state has been shown.
- Keep the summary hidden until `duel:completed` arrives.

Required terminal-flow tests:

- Final recap is emitted before finisher and completion.
- Completion is delayed until the presentation window ends.
- Player 0 produces target `100`; player 1 produces target `-100`.
- Real score-derived offset is preserved in the recap and summary data.
- A real beam victory does not reverse or overshoot the collision point.
- A disconnect during finalization does not replace the locked winner.
- A forfeit does not wait for a nonexistent final cast.
- Completion and lobby reset happen exactly once.
- Both existing beam regression suites still pass without weakened assertions.

## 4. Documentation updates required in the implementation PR

Update documentation in the same PR as behavior. Do not describe planned behavior as current behavior before the code lands.

- `docs/GAME_SPEC.md`
  - State that 30% accuracy is inclusive and required to receive any speed bonus.
  - Keep the term **Typing speed** in player-facing descriptions.
  - Document the ten-second timer display, five-second recap, mutual skip rule, score indicator, and terminal finishing presentation.
  - Clarify that the terminal sweep is cosmetic and final totals remain authoritative.
- `docs/ARCHITECTURE.md`
  - Add the new prompt field and socket events.
  - Document recap vote state, finalizing state, and server timer ownership.
- `docs/PRODUCTION_READINESS.md`
  - Mark B5 fixed only after threshold tests pass.
  - Record the new timer/recap/finalization checks and any remaining tie limitation.
- `docs/RELEASE_PLAN.md`
  - Mark C5 and the applicable UX task statuses accurately only after acceptance is met.
- `client/src/components/HowToPlayModal.tsx`
  - Explain that accuracy earns up to 120, qualifying answers at 30% or above can earn up to 20 speed points, and scores push the beam.

## 5. Verification checklist

Automated:

```bash
cd server && npm test
cd server && npx tsc --noEmit
cd server && npm run build
cd client && npm test
cd client && npx tsc --noEmit
cd client && npm run build
```

Manual two-client duel:

1. Confirm a sub-30% fast answer receives zero speed bonus.
2. Confirm an exactly-30% fast answer receives the normal speed bonus.
3. Confirm a qualifying answer still uses the old 20/15/10/5/0 time curve.
4. Confirm cumulative score changes drive the normal beam in the correct direction for both player orders.
5. Confirm the small score indicator matches recap cumulative totals.
6. Confirm the answer ring starts near ten, warns at three, and disappears on recap/submit.
7. Confirm recap lasts five seconds without votes.
8. Confirm one skip vote waits and two votes start the unchanged three-second countdown.
9. Confirm stale and duplicate skip actions do not advance twice.
10. Confirm the end summary exposes every round and both players’ complete breakdown by keyboard, pointer, and touch.
11. Confirm the final real beam movement is visible before any cosmetic sweep.
12. Confirm the finishing sweep reaches the losing wizard from either side and the summary appears afterward.
13. Confirm an early real beam victory and a forfeit still finish correctly.
14. Confirm 5-, 10-, and 15-round games do not overflow the summary on mobile widths.

## 6. Acceptance criteria

The work is complete when:

- The 30% qualification rule is inclusive, server-authoritative, tested at its boundary, and documented.
- No qualifying player loses any existing raw speed bonus because of the new rule.
- Normal beam math, geometry, direction, clamp, and animation remain unchanged and all beam regression tests pass.
- Players see a small server-aligned ten-second ring and a small cumulative scoreboard inside the wizard arena during play.
- Non-terminal recaps last five seconds and require both players to skip early.
- Live recaps are compact, while end results retain a complete accessible breakdown for every round and both players.
- The three-second countdown remains unchanged.
- The final cast remains visible and the summary waits until the terminal presentation completes.
- The terminal sweep is clearly isolated from authoritative score and beam state.
- Documentation and How to Play match shipped behavior.

## 7. Product risk to resolve separately

M8 remains important: exact cumulative ties currently crown the first player in stable player order. A finishing sweep would make that arbitrary outcome more visible, so this plan intentionally suppresses the cosmetic sweep for a zero score difference. Recommended follow-up: implement sudden death or a true draw before presenting tied outcomes as an overwhelm victory.
