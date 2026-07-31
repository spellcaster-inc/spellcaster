import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSocket } from '../lib/socket';
import type {
  CountdownPayload,
  DuelState,
  GameSettings,
  GameSummary,
  LobbyCreateResultPayload,
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
  isCreatePending: boolean;
  createLobby: (playerName: string, settings?: GameSettings, wizardId?: string) => void;
  cancelPendingCreate: (message?: string) => void;
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
  const [isCreatePending, setIsCreatePending] = useState(false);

  const pendingCreateRequestIdRef = useRef<string | null>(null);
  const lastCreateRequestIdRef = useRef<string | null>(null);
  const cancelledCreateRequestIdRef = useRef<string | null>(null);
  const ignoreLobbyStateRef = useRef(false);

  useEffect(() => {
    const socket = getSocket();

    const handleLobbyState = (state: LobbyState) => {
      if (ignoreLobbyStateRef.current) {
        return;
      }
      setLobby(state);
      if (state.phase !== 'in-duel') {
        setDuel(null);
      }
      // In-flight create already synced via lobby:state — clear pending so a later timeout won't leave.
      if (pendingCreateRequestIdRef.current) {
        pendingCreateRequestIdRef.current = null;
        setIsCreatePending(false);
      }
    };

    const handleCreateResult = (payload: LobbyCreateResultPayload) => {
      if (payload.requestId !== lastCreateRequestIdRef.current) {
        return;
      }
      if (payload.requestId === cancelledCreateRequestIdRef.current) {
        return;
      }

      pendingCreateRequestIdRef.current = null;
      setIsCreatePending(false);
      ignoreLobbyStateRef.current = false;

      if (!payload.ok) {
        setError(payload.message);
        return;
      }

      setLobby(payload.lobby);
      if (payload.lobby.phase !== 'in-duel') {
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
      setDuel((prev) =>
        prev
          ? {
              ...prev,
              beamOffset: payload.beamOffset,
              round: payload.roundNumber,
            }
          : prev
      );
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
      if (pendingCreateRequestIdRef.current) {
        pendingCreateRequestIdRef.current = null;
        setIsCreatePending(false);
      }
    };

    const handleConnect = () => {
      setSocketId(socket.id ?? null);
    };

    const handleDisconnect = () => {
      setSocketId(null);
    };

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

    socket.on('lobby:state', handleLobbyState);
    socket.on('lobby:createResult', handleCreateResult);
    socket.on('duel:started', handleDuelStarted);
    socket.on('duel:countdown', handleCountdown);
    socket.on('duel:prompt', handlePrompt);
    socket.on('duel:roundRecap', handleRoundRecap);
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
      socket.off('lobby:createResult', handleCreateResult);
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

  const clearLocalLobbyState = useCallback(() => {
    setLobby(null);
    setDuel(null);
    setCountdown(null);
    setPrompt(null);
    setRoundRecap(null);
    setSummary(null);
    setScores({});
    setRoundSubmissions(null);
  }, []);

  const createLobby = useCallback((playerName: string, settings?: GameSettings, wizardId?: string) => {
    const name = playerName.trim();
    if (!name) {
      setError('please enter your name first');
      return;
    }
    const requestId = crypto.randomUUID();
    pendingCreateRequestIdRef.current = requestId;
    lastCreateRequestIdRef.current = requestId;
    cancelledCreateRequestIdRef.current = null;
    ignoreLobbyStateRef.current = false;
    setIsCreatePending(true);
    setError(null);
    getSocket().emit('lobby:create', { playerName: name, settings, wizardId, requestId });
  }, []);

  const cancelPendingCreate = useCallback((message?: string) => {
    const pendingId = pendingCreateRequestIdRef.current;
    if (!pendingId) {
      return;
    }
    cancelledCreateRequestIdRef.current = pendingId;
    pendingCreateRequestIdRef.current = null;
    setIsCreatePending(false);
    ignoreLobbyStateRef.current = true;
    getSocket().emit('lobby:leave');
    clearLocalLobbyState();
    if (message) {
      setError(message);
    }
  }, [clearLocalLobbyState]);

  const joinLobby = useCallback((roomCode: string, playerName: string, wizardId?: string) => {
    const name = playerName.trim();
    const code = roomCode.trim().toUpperCase();
    if (!name || !code) {
      setError('enter both your name and a room code');
      return;
    }
    ignoreLobbyStateRef.current = false;
    pendingCreateRequestIdRef.current = null;
    setIsCreatePending(false);
    setError(null);
    getSocket().emit('lobby:join', { roomCode: code, playerName: name, wizardId });
  }, []);

  const leaveLobby = useCallback(() => {
    pendingCreateRequestIdRef.current = null;
    setIsCreatePending(false);
    getSocket().emit('lobby:leave');
    clearLocalLobbyState();
  }, [clearLocalLobbyState]);

  const setReady = useCallback(
    (ready: boolean) => {
      if (!lobby) {
        return;
      }
      getSocket().emit('lobby:setReady', { roomCode: lobby.roomCode, ready });
    },
    [lobby]
  );

  const startDuel = useCallback(() => {
    if (!lobby) {
      return;
    }
    getSocket().emit('lobby:startDuel', { roomCode: lobby.roomCode });
  }, [lobby]);

  const submitSpell = useCallback(
    (guess: string, durationMs: number, promptId: string) => {
      if (!lobby || !promptId) {
        return;
      }
      const guessToSubmit = guess.trim().toUpperCase();
      getSocket().emit('duel:submitSpell', {
        roomCode: lobby.roomCode,
        promptId,
        guess: guessToSubmit,
        durationMs,
      });
    },
    [lobby]
  );

  const clearError = useCallback(() => setError(null), []);
  const resetSummary = useCallback(() => setSummary(null), []);

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
    isCreatePending,
    createLobby,
    cancelPendingCreate,
    joinLobby,
    leaveLobby,
    setReady,
    startDuel,
    submitSpell,
    clearError,
    resetSummary,
  };
}
