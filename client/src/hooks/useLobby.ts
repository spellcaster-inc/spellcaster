import { useEffect, useMemo, useState } from 'react';
import { getSocket } from '../lib/socket';
import type {
  CountdownPayload,
  DuelState,
  GameSettings,
  GameSummary,
  LobbyState,
  Player,
  PlayerSubmissionPayload,
  RoundRecapPayload,
  ServerErrorPayload,
  SpellPromptPayload,
} from '../../../shared/types/socket';

interface UseLobbyResult {
  lobby: LobbyState | null;
  duel: DuelState | null;
  countdown: CountdownPayload | null;
  prompt: SpellPromptPayload | null;
  roundRecap: RoundRecapPayload | null;
  summary: GameSummary | null;
  scores: Record<string, number>;
  roundSubmissions: { roundNumber: number; playerIds: Record<string, boolean> } | null;
  error: string | null;
  localPlayer: Player | null;
  createLobby: (playerName: string, settings?: GameSettings, wizardId?: string) => void;
  joinLobby: (roomCode: string, playerName: string, wizardId?: string) => void;
  leaveLobby: () => void;
  setReady: (ready: boolean) => void;
  startDuel: () => void;
  submitSpell: (guess: string, durationMs: number, promptId: string) => void;
  clearError: () => void;
  resetSummary: () => void;
}

export function useLobby(): UseLobbyResult {
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [duel, setDuel] = useState<DuelState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<CountdownPayload | null>(null);
  const [prompt, setPrompt] = useState<SpellPromptPayload | null>(null);
  const [roundRecap, setRoundRecap] = useState<RoundRecapPayload | null>(null);
  const [summary, setSummary] = useState<GameSummary | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [roundSubmissions, setRoundSubmissions] = useState<{
    roundNumber: number;
    playerIds: Record<string, boolean>;
  } | null>(null);

  useEffect(() => {
    const socket = getSocket();

    const handleLobbyState = (state: LobbyState) => {
      setLobby(state);
      if (state.phase !== 'in-duel') {
        setDuel(null);
      }
    };

    const handleDuelStarted = (state: DuelState) => {
      setDuel(state);
      setScores(
        state.players.reduce<Record<string, number>>((acc, player) => {
          acc[player.id] = 0;
          return acc;
        }, {})
      );
      setCountdown(null);
      setPrompt(null);
      setRoundRecap(null);
      setSummary(null);
    };

    const handleCountdown = (payload: CountdownPayload) => {
      setCountdown(payload);
      setPrompt(null);
      setRoundRecap(null);
      setRoundSubmissions({
        roundNumber: payload.roundNumber,
        playerIds: {},
      });
      setDuel((prev) =>
        prev
          ? {
            ...prev,
            round: payload.roundNumber,
          }
          : prev
      );
    };

    const handlePrompt = (payload: SpellPromptPayload) => {
      setPrompt(payload);
      setCountdown(null);
      setRoundRecap(null);
      setRoundSubmissions((prev) =>
        prev && prev.roundNumber === payload.roundNumber
          ? prev
          : {
            roundNumber: payload.roundNumber,
            playerIds: {},
          }
      );
      setDuel((prev) =>
        prev
          ? {
            ...prev,
            round: payload.roundNumber,
          }
          : prev
      );
    };

    const handleRoundRecap = (payload: RoundRecapPayload) => {
      setRoundRecap(payload);
      setPrompt(null);
      setCountdown(null);
      setScores((prev) => {
        const next = { ...prev };
        payload.playerResults.forEach((result) => {
          next[result.playerId] = result.cumulativeScore;
        });
        return next;
      });
      setRoundSubmissions({
        roundNumber: payload.roundNumber,
        playerIds: payload.playerResults.reduce<Record<string, boolean>>((acc, result) => {
          acc[result.playerId] = true;
          return acc;
        }, {}),
      });
      setDuel((prev) => {
        const updated = prev
          ? {
            ...prev,
            beamOffset: payload.beamOffset,
            round: payload.roundNumber,
          }
          : prev;
        console.log('📊 beamOffset from server:', payload.beamOffset, 'scores:', payload.playerResults.map(p => p.totalScore));
        console.log('🎯 duel.beamOffset after update:', updated?.beamOffset);
        return updated;
      });
    };

    const handleCompleted = (payload: GameSummary) => {
      setSummary(payload);
      setCountdown(null);
      setPrompt(null);
      setRoundRecap(null);
      setDuel(null);
      setScores(
        payload.players.reduce<Record<string, number>>((acc, player) => {
          acc[player.playerId] = player.totalScore;
          return acc;
        }, {})
      );
      setRoundSubmissions(null);
    };

    const handleError = (payload: ServerErrorPayload) => {
      console.error('[socket error]', payload.message);
      setError(payload.message);
    };

    const handleConnect = () => {
      setSocketId(socket.id ?? null);
    };

    const handleDisconnect = () => {
      setSocketId(null);
    };

    socket.on('lobby:state', handleLobbyState);
    socket.on('duel:started', handleDuelStarted);
    socket.on('duel:countdown', handleCountdown);
    socket.on('duel:prompt', handlePrompt);
    socket.on('duel:roundRecap', handleRoundRecap);
    const handlePlayerSubmitted = (payload: PlayerSubmissionPayload) => {
      setRoundSubmissions((prev) => {
        if (!prev || prev.roundNumber !== payload.roundNumber) {
          return {
            roundNumber: payload.roundNumber,
            playerIds: { [payload.playerId]: true },
          };
        }
        if (prev.playerIds[payload.playerId]) {
          return prev;
        }
        return {
          roundNumber: prev.roundNumber,
          playerIds: {
            ...prev.playerIds,
            [payload.playerId]: true,
          },
        };
      });
    };
    socket.on('duel:playerSubmitted', handlePlayerSubmitted);
    socket.on('duel:completed', handleCompleted);
    socket.on('error', handleError);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('lobby:state', handleLobbyState);
      socket.off('duel:started', handleDuelStarted);
      socket.off('duel:countdown', handleCountdown);
      socket.off('duel:prompt', handlePrompt);
      socket.off('duel:roundRecap', handleRoundRecap);
      socket.off('duel:playerSubmitted', handlePlayerSubmitted);
      socket.off('duel:completed', handleCompleted);
      socket.off('error', handleError);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);

  const localPlayer = useMemo(() => {
    if (!socketId || !lobby) {
      return null;
    }

    return lobby.players.find((player) => player.id === socketId) ?? null;
  }, [socketId, lobby]);

  const socketRef = () => getSocket();

  const createLobby = (playerName: string, settings?: GameSettings, wizardId?: string) => {
    const name = playerName.trim();
    if (!name) {
      setError('please enter your name first');
      return;
    }
    setError(null);
    socketRef().emit('lobby:create', { playerName: name, settings, wizardId });
  };

  const joinLobby = (roomCode: string, playerName: string, wizardId?: string) => {
    const name = playerName.trim();
    const code = roomCode.trim().toUpperCase();
    if (!name || !code) {
      setError('enter both your name and a room code');
      return;
    }
    setError(null);
    socketRef().emit('lobby:join', { roomCode: code, playerName: name, wizardId });
  };

  const leaveLobby = () => {
    socketRef().emit('lobby:leave');
    setLobby(null);
    setDuel(null);
    setCountdown(null);
    setPrompt(null);
    setRoundRecap(null);
    setSummary(null);
    setScores({});
    setRoundSubmissions(null);
  };

  const setReady = (ready: boolean) => {
    if (!lobby) {
      return;
    }
    socketRef().emit('lobby:setReady', { roomCode: lobby.roomCode, ready });
  };

  const startDuel = () => {
    if (!lobby) {
      return;
    }
    socketRef().emit('lobby:startDuel', { roomCode: lobby.roomCode });
  };

  const submitSpell = (guess: string, durationMs: number, promptId: string) => {
    if (!lobby || !promptId) {
      return;
    }
    const guessToSubmit = guess.trim().toUpperCase();
    socketRef().emit('duel:submitSpell', {
      roomCode: lobby.roomCode,
      promptId,
      guess: guessToSubmit,
      durationMs,
    });
  };

  const clearError = () => setError(null);
  const resetSummary = () => setSummary(null);

  return {
    lobby,
    duel,
    countdown,
    prompt,
    roundRecap,
    summary,
    scores,
    roundSubmissions,
    error,
    localPlayer,
    createLobby,
    joinLobby,
    leaveLobby,
    setReady,
    startDuel,
    submitSpell,
    clearError,
    resetSummary,
  };
}

