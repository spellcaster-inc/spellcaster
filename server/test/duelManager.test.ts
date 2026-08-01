import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Server as SocketIOServer } from 'socket.io';
import {
  ClientToServerEvents,
  GameSettings,
  InterServerEvents,
  LobbyState,
  ServerToClientEvents,
  SocketData,
  SpellPromptPayload,
} from '../../shared/types/socket';
import { DuelManager } from '../src/game/duelManager';

type TestIo = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

interface EmittedEvent {
  event: keyof ServerToClientEvents;
  payload: unknown;
}

const ROOM_CODE = 'ABCD';
const PLAYERS = [
  { id: 'player-0', name: 'Merlin', isHost: true, ready: false },
  { id: 'player-1', name: 'Morgana', isHost: false, ready: false },
];
const SETTINGS: GameSettings = {
  difficulty: 'custom',
  rounds: 5,
  readingSpeed: 1,
  customWords: ['ABCDEFGHIJ'],
};

function createHarness() {
  const events: EmittedEvent[] = [];
  const roomEmitter = {
    emit: vi.fn((event: keyof ServerToClientEvents, payload: unknown) => {
      events.push({ event, payload });
    }),
  };
  const io = {
    to: vi.fn(() => roomEmitter),
  } as unknown as TestIo;
  const lobby: LobbyState = {
    roomCode: ROOM_CODE,
    phase: 'in-duel',
    players: PLAYERS.map((player) => ({ ...player })),
    settings: SETTINGS,
  };
  const lobbies = new Map([[ROOM_CODE, lobby]]);
  const onLobbyStateChange = vi.fn();
  const manager = new DuelManager({ io, lobbies, onLobbyStateChange });

  const payloads = <T>(event: keyof ServerToClientEvents) =>
    events.filter((entry) => entry.event === event).map((entry) => entry.payload as T);
  const latestPrompt = () => payloads<SpellPromptPayload>('duel:prompt').at(-1)!;

  const start = () => {
    manager.startDuel(lobby);
    vi.advanceTimersByTime(3000);
  };

  const scoreCurrentRound = (winnerIndex: 0 | 1 | null = null) => {
    const prompt = latestPrompt();
    if (prompt.mode !== 'custom') {
      throw new Error('test duel unexpectedly emitted a catalog prompt');
    }
    const closeGuess = prompt.spellText.slice(0, -1);
    const guesses =
      winnerIndex === null
        ? [prompt.spellText, prompt.spellText]
        : winnerIndex === 0
          ? [prompt.spellText, closeGuess]
          : [closeGuess, prompt.spellText];

    expect(
      manager.handleSubmission(ROOM_CODE, PLAYERS[0].id, {
        promptId: prompt.promptId,
        guess: guesses[0],
        durationMs: 0,
      })
    ).toBeNull();
    expect(
      manager.handleSubmission(ROOM_CODE, PLAYERS[1].id, {
        promptId: prompt.promptId,
        guess: guesses[1],
        durationMs: 0,
      })
    ).toBeNull();
    vi.advanceTimersByTime(1000);
  };

  const advanceToNextRound = () => {
    vi.advanceTimersByTime(5000);
    vi.advanceTimersByTime(3000);
  };

  const reachRoundsFinalization = (winnerIndex: 0 | 1 | null) => {
    start();
    for (let round = 1; round <= SETTINGS.rounds; round += 1) {
      scoreCurrentRound(winnerIndex);
      if (round < SETTINGS.rounds) {
        advanceToNextRound();
      }
    }
  };

  return {
    events,
    latestPrompt,
    lobbies,
    lobby,
    manager,
    onLobbyStateChange,
    payloads,
    reachRoundsFinalization,
    scoreCurrentRound,
    start,
    advanceToNextRound,
  };
}

describe('DuelManager duel flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T12:00:00.000Z'));
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('publishes the server-owned ten-second answer window', () => {
    const harness = createHarness();
    harness.start();

    expect(harness.latestPrompt().answerWindowMs).toBe(10_000);
  });

  it('holds a non-terminal recap for five seconds before the unchanged countdown', () => {
    const harness = createHarness();
    harness.start();
    harness.scoreCurrentRound(0);
    const countdownCount = harness.payloads('duel:countdown').length;

    vi.advanceTimersByTime(4999);
    expect(harness.payloads('duel:countdown')).toHaveLength(countdownCount);
    vi.advanceTimersByTime(1);
    expect(harness.payloads('duel:countdown')).toHaveLength(countdownCount + 1);

    vi.advanceTimersByTime(2999);
    expect(harness.payloads('duel:prompt')).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(harness.payloads('duel:prompt')).toHaveLength(2);
  });

  it('records idempotent recap votes and advances exactly once when both players skip', () => {
    const harness = createHarness();
    harness.start();
    harness.scoreCurrentRound(0);
    const countdownCount = harness.payloads('duel:countdown').length;

    expect(harness.manager.handleRecapSkip(ROOM_CODE, PLAYERS[0].id, 1)).toBeNull();
    expect(harness.payloads<{ playerIds: string[] }>('duel:recapSkipState').at(-1)?.playerIds).toEqual([
      PLAYERS[0].id,
    ]);

    harness.manager.handleRecapSkip(ROOM_CODE, PLAYERS[0].id, 1);
    expect(harness.payloads('duel:recapSkipState')).toHaveLength(1);

    harness.manager.handleRecapSkip(ROOM_CODE, PLAYERS[1].id, 1);
    expect(harness.payloads<{ playerIds: string[] }>('duel:recapSkipState').at(-1)?.playerIds).toEqual([
      PLAYERS[0].id,
      PLAYERS[1].id,
    ]);
    expect(harness.payloads('duel:countdown')).toHaveLength(countdownCount + 1);

    vi.advanceTimersByTime(5000);
    expect(harness.payloads('duel:countdown')).toHaveLength(countdownCount + 1);
  });

  it('ignores stale, future, post-recap, and non-participant skip requests safely', () => {
    const harness = createHarness();
    harness.start();
    harness.scoreCurrentRound(0);

    expect(harness.manager.handleRecapSkip(ROOM_CODE, PLAYERS[0].id, 0)).toBeNull();
    expect(harness.manager.handleRecapSkip(ROOM_CODE, PLAYERS[0].id, 2)).toBeNull();
    expect(harness.manager.handleRecapSkip(ROOM_CODE, 'intruder', 1)).toBe(
      'you are not part of this duel'
    );
    expect(harness.payloads('duel:recapSkipState')).toHaveLength(0);

    harness.advanceToNextRound();
    expect(harness.manager.handleRecapSkip(ROOM_CODE, PLAYERS[0].id, 1)).toBeNull();
    expect(harness.payloads('duel:recapSkipState')).toHaveLength(0);
  });

  it.each([
    [0, 100],
    [1, -100],
  ] as const)('locks a rounds winner and emits the player %i finisher target', (winnerIndex, target) => {
    const harness = createHarness();
    harness.reachRoundsFinalization(winnerIndex);

    const eventNames = harness.events.map((entry) => entry.event);
    const finalRecapIndex = eventNames.lastIndexOf('duel:roundRecap');
    const finisherIndex = eventNames.lastIndexOf('duel:finisher');
    expect(finalRecapIndex).toBeGreaterThanOrEqual(0);
    expect(finisherIndex).toBeGreaterThan(finalRecapIndex);
    expect(eventNames.lastIndexOf('duel:completed')).toBe(-1);

    const finalRecap = harness.payloads<{ beamOffset: number }>('duel:roundRecap').at(-1)!;
    const finisher = harness.payloads<{
      winnerId: string;
      targetBeamOffset: number;
      startsInMs: number;
      durationMs: number;
    }>('duel:finisher').at(-1)!;
    expect(Math.abs(finalRecap.beamOffset)).toBeLessThan(100);
    expect(finisher).toMatchObject({
      winnerId: PLAYERS[winnerIndex].id,
      targetBeamOffset: target,
      startsInMs: 500,
      durationMs: 1400,
    });

    vi.advanceTimersByTime(2099);
    expect(harness.payloads('duel:completed')).toHaveLength(0);
    vi.advanceTimersByTime(1);
    const summary = harness.payloads<{ winnerId: string; rounds: Array<{ beamOffset: number }> }>(
      'duel:completed'
    )[0];
    expect(summary.winnerId).toBe(PLAYERS[winnerIndex].id);
    expect(summary.rounds.at(-1)?.beamOffset).toBe(finalRecap.beamOffset);
  });

  it('does not allow a disconnect during finalization to replace the locked result', () => {
    const harness = createHarness();
    harness.reachRoundsFinalization(0);

    harness.lobby.players = [PLAYERS[1]];
    harness.manager.handlePlayerLeft(ROOM_CODE);
    vi.advanceTimersByTime(2100);

    const summaries = harness.payloads<{ winnerId: string; reason: string }>('duel:completed');
    expect(summaries).toEqual([
      expect.objectContaining({ winnerId: PLAYERS[0].id, reason: 'rounds' }),
    ]);
    expect(harness.onLobbyStateChange).toHaveBeenCalledTimes(1);

    harness.manager.handlePlayerLeft(ROOM_CODE);
    vi.runOnlyPendingTimers();
    expect(harness.payloads('duel:completed')).toHaveLength(1);
  });

  it('holds a real beam victory without emitting a cosmetic finisher', () => {
    const harness = createHarness();
    harness.start();

    for (let round = 1; round <= 2; round += 1) {
      const prompt = harness.latestPrompt();
      if (prompt.mode !== 'custom') {
        throw new Error('test duel unexpectedly emitted a catalog prompt');
      }
      harness.manager.handleSubmission(ROOM_CODE, PLAYERS[0].id, {
        promptId: prompt.promptId,
        guess: prompt.spellText,
        durationMs: 0,
      });
      harness.manager.handleSubmission(ROOM_CODE, PLAYERS[1].id, {
        promptId: prompt.promptId,
        guess: '',
        durationMs: 0,
      });
      vi.advanceTimersByTime(1000);
      if (round === 1) {
        harness.advanceToNextRound();
      }
    }

    expect(harness.payloads<{ beamOffset: number }>('duel:roundRecap').at(-1)?.beamOffset).toBe(100);
    expect(harness.payloads('duel:finisher')).toHaveLength(0);
    expect(harness.payloads('duel:completed')).toHaveLength(0);
    vi.advanceTimersByTime(999);
    expect(harness.payloads('duel:completed')).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(harness.payloads<{ reason: string }>('duel:completed')[0].reason).toBe('beam');
  });

  it('suppresses a finisher for an exact score tie and terminal recap votes', () => {
    const harness = createHarness();
    harness.reachRoundsFinalization(null);

    harness.manager.handleRecapSkip(ROOM_CODE, PLAYERS[0].id, SETTINGS.rounds);
    harness.manager.handleRecapSkip(ROOM_CODE, PLAYERS[1].id, SETTINGS.rounds);
    expect(harness.payloads('duel:recapSkipState')).toHaveLength(0);
    expect(harness.payloads('duel:finisher')).toHaveLength(0);
    expect(harness.payloads('duel:countdown')).toHaveLength(SETTINGS.rounds);

    vi.advanceTimersByTime(1000);
    expect(harness.payloads('duel:completed')).toHaveLength(1);
  });

  it('completes a forfeit immediately because no final cast exists', () => {
    const harness = createHarness();
    harness.start();
    harness.lobby.players = [PLAYERS[0]];

    harness.manager.handlePlayerLeft(ROOM_CODE);

    expect(harness.payloads('duel:finisher')).toHaveLength(0);
    expect(harness.payloads<{ winnerId: string; reason: string }>('duel:completed')).toEqual([
      expect.objectContaining({ winnerId: PLAYERS[0].id, reason: 'forfeit' }),
    ]);
    expect(harness.onLobbyStateChange).toHaveBeenCalledTimes(1);
  });
});
