import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  LobbyState,
  GameSettings,
  SpellDifficulty,
  ReadingSpeed,
} from '../../../shared/types/socket';
import { DuelManager } from '../game/duelManager';

const MAX_PLAYERS = 2;
const ROOM_CODE_LENGTH = 4;
const DEFAULT_SETTINGS: GameSettings = {
  difficulty: 'medium',
  rounds: 5,
  readingSpeed: 1,
};
const VALID_ROUNDS: GameSettings['rounds'][] = [5, 10, 15];
const VALID_DIFFICULTIES: SpellDifficulty[] = ['easy', 'medium', 'hard', 'custom'];
const VALID_SPEEDS: ReadingSpeed[] = [0.5, 0.75, 1, 1.25, 1.5, 2];
const MAX_CUSTOM_WORDS = 400;
const MAX_CUSTOM_WORD_LENGTH = 64;
const MAX_CREATE_REQUEST_ID_LENGTH = 64;

const lobbies = new Map<string, LobbyState>();

export function registerSocketHandlers(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
) {
  const duelManager = new DuelManager({
    io,
    lobbies,
    onLobbyStateChange: (lobby) => broadcastLobbyState(io, lobby),
  });
  // this gets called from index.ts whenever a socket connects
  io.on(
    'connection',
    (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) => {
      console.log(`client connected: ${socket.id}`);

      socket.on('ping', () => {
        console.log(`received ping from ${socket.id}`);
        socket.emit('pong', {
          timestamp: new Date().toISOString(),
        });
      });

      socket.on('lobby:create', ({ playerName, settings, wizardId, requestId }) => {
        const id = sanitizeRequestId(requestId);
        if (!id) {
          return sendError(socket, 'invalid create request');
        }

        const cleanName = sanitizeName(playerName);
        if (!cleanName) {
          return socket.emit('lobby:createResult', {
            requestId: id,
            ok: false,
            message: 'please enter a name before creating a duel',
          });
        }

        leaveCurrentLobby(socket, io, duelManager);

        const roomCode = generateRoomCode();
        const lobbySettings = sanitizeSettings(settings ?? {}, DEFAULT_SETTINGS);

        const lobby: LobbyState = {
          roomCode,
          phase: 'lobby',
          settings: lobbySettings,
          players: [
            {
              id: socket.id,
              name: cleanName,
              isHost: true,
              ready: false,
              wizardId,
            },
          ],
        };

        lobbies.set(roomCode, lobby);
        socket.join(roomCode);
        socket.data.roomCode = roomCode;
        socket.data.playerName = cleanName;

        console.log(`created lobby ${roomCode} for host ${cleanName}`);
        broadcastLobbyState(io, lobby);
        socket.emit('lobby:createResult', { requestId: id, ok: true, lobby });
      });

      socket.on('lobby:join', ({ roomCode, playerName, wizardId }) => {
        const code = normalizeRoomCode(roomCode);
        const cleanName = sanitizeName(playerName);

        if (!cleanName) {
          return sendError(socket, 'please enter a name before joining');
        }

        const lobby = lobbies.get(code);
        if (!lobby) {
          return sendError(socket, 'could not find that lobby code');
        }
        if (lobby.players.length >= MAX_PLAYERS) {
          return sendError(socket, 'this lobby is already full');
        }
        if (lobby.phase !== 'lobby') {
          return sendError(socket, 'this duel already started');
        }

        leaveCurrentLobby(socket, io, duelManager);

        lobby.players.push({
          id: socket.id,
          name: cleanName,
          isHost: false,
          ready: false,
          wizardId,
        });

        socket.join(code);
        socket.data.roomCode = code;
        socket.data.playerName = cleanName;

        console.log(`player ${cleanName} joined lobby ${code}`);
        broadcastLobbyState(io, lobby);
      });

      socket.on('lobby:leave', () => {
        const previousRoom = socket.data.roomCode;
        leaveCurrentLobby(socket, io, duelManager);
        if (previousRoom) {
          console.log(`player ${socket.id} left lobby ${previousRoom}`);
        }
      });

      socket.on('lobby:setReady', ({ roomCode, ready }) => {
        const lobby = lobbies.get(roomCode);
        if (!lobby) {
          return sendError(socket, 'lobby no longer exists');
        }
        if (lobby.phase !== 'lobby') {
          return sendError(socket, 'duel already started');
        }

        const player = lobby.players.find((p) => p.id === socket.id);
        if (!player) {
          return sendError(socket, 'you are not part of this lobby');
        }

        player.ready = ready;
        broadcastLobbyState(io, lobby);
      });

      socket.on('lobby:updateSettings', ({ roomCode, settings }) => {
        const lobby = lobbies.get(roomCode);
        if (!lobby) {
          return sendError(socket, 'lobby no longer exists');
        }
        if (lobby.phase !== 'lobby') {
          return sendError(socket, 'cannot update settings during a duel');
        }

        const player = lobby.players.find((p) => p.id === socket.id);
        if (!player || !player.isHost) {
          return sendError(socket, 'only the host can update settings');
        }

        lobby.settings = sanitizeSettings(settings, lobby.settings);
        lobby.players = lobby.players.map((p) => ({ ...p, ready: false }));

        broadcastLobbyState(io, lobby);
      });

      socket.on('lobby:startDuel', ({ roomCode }) => {
        const lobby = lobbies.get(roomCode);
        if (!lobby) {
          return sendError(socket, 'lobby no longer exists');
        }
        if (lobby.phase !== 'lobby') {
          return sendError(socket, 'duel already in progress');
        }

        const player = lobby.players.find((p) => p.id === socket.id);
        if (!player || !player.isHost) {
          return sendError(socket, 'only the host can start the duel');
        }

        const everyoneReady = lobby.players.every((p) => p.ready);
        if (!everyoneReady || lobby.players.length < 2) {
          return sendError(socket, 'both players must be ready before starting');
        }

        lobby.phase = 'in-duel';
        lobby.players = lobby.players.map((p) => ({
          ...p,
          ready: false,
        }));

        console.log(`lobby ${roomCode} started a duel`);
        broadcastLobbyState(io, lobby);
        duelManager.startDuel(lobby);
      });

      socket.on('duel:submitSpell', ({ roomCode, promptId, guess, durationMs }) => {
        const code = normalizeRoomCode(roomCode || socket.data.roomCode || '');
        if (!code) {
          return sendError(socket, 'you are not in a duel');
        }

        const lobby = lobbies.get(code);
        if (!lobby) {
          return sendError(socket, 'lobby no longer exists');
        }
        if (lobby.phase !== 'in-duel') {
          return sendError(socket, 'no duel in progress');
        }

        const participant = lobby.players.find((player) => player.id === socket.id);
        if (!participant) {
          return sendError(socket, 'you are not part of this duel');
        }

        // Log received submission for debugging
        console.log(`[SOCKET] Received submission from ${socket.id} (${participant.name}):`, {
          roomCode: code,
          promptId,
          guess: guess?.substring(0, 20) + (guess?.length > 20 ? '...' : ''),
          guessLength: guess?.length ?? 0,
          durationMs,
        });

        const result = duelManager.handleSubmission(code, socket.id, {
          promptId,
          guess: guess || '',
          durationMs,
        });

        if (result) {
          console.log(`[SOCKET] Submission rejected for ${socket.id}:`, result);
          return sendError(socket, result);
        }
      });

      socket.on('disconnect', (reason) => {
        leaveCurrentLobby(socket, io, duelManager);
        console.log(`client disconnected: ${socket.id} (${reason})`);
      });
    }
  );
}

function broadcastLobbyState(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  lobby: LobbyState
) {
  io.to(lobby.roomCode).emit('lobby:state', lobby);
}

function sendError(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  message: string
) {
  socket.emit('error', { message });
}

function leaveCurrentLobby(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  duelManager: DuelManager
) {
  const roomCode = socket.data.roomCode;
  if (!roomCode) {
    return;
  }

  const lobby = lobbies.get(roomCode);
  socket.leave(roomCode);
  socket.data.roomCode = undefined;
  socket.data.playerName = undefined;

  if (!lobby) {
    return;
  }

  const wasInDuel = lobby.phase === 'in-duel';

  lobby.players = lobby.players.filter((p) => p.id !== socket.id);

  if (wasInDuel) {
    duelManager.handlePlayerLeft(roomCode);
  }

  if (lobby.players.length === 0) {
    lobbies.delete(roomCode);
    console.log(`closed lobby ${roomCode} because it became empty`);
    return;
  }

  if (!lobby.players.some((p) => p.isHost)) {
    lobby.players[0].isHost = true;
    console.log(`reassigned host of ${roomCode} to ${lobby.players[0].name}`);
  }

  if (lobby.phase === 'lobby' && lobby.players.some((p) => p.ready)) {
    lobby.players = lobby.players.map((p) => ({ ...p, ready: false }));
  }

  broadcastLobbyState(io, lobby);
}

function sanitizeName(name: string): string {
  return name?.trim().slice(0, 24);
}

function sanitizeRequestId(requestId: unknown): string | null {
  if (typeof requestId !== 'string') {
    return null;
  }
  const trimmed = requestId.trim();
  if (!trimmed || trimmed.length > MAX_CREATE_REQUEST_ID_LENGTH) {
    return null;
  }
  return trimmed;
}

function sanitizeSettings(partial: Partial<GameSettings>, current: GameSettings): GameSettings {
  const requestedDifficulty = partial?.difficulty as SpellDifficulty | undefined;
  const rounds: GameSettings['rounds'] = VALID_ROUNDS.includes(partial?.rounds as GameSettings['rounds'])
    ? (partial?.rounds as GameSettings['rounds'])
    : current.rounds;

  const readingSpeed: ReadingSpeed = VALID_SPEEDS.includes(partial?.readingSpeed as ReadingSpeed)
    ? (partial?.readingSpeed as ReadingSpeed)
    : current.readingSpeed;

  const providedWords =
    Array.isArray(partial?.customWords) && partial.customWords.length > 0
      ? sanitizeCustomWords(partial.customWords)
      : current.customWords;

  const providedSourceName =
    typeof partial?.customWordSourceName === 'string'
      ? partial.customWordSourceName.slice(0, 64)
      : current.customWordSourceName;

  const wantsCustom = requestedDifficulty === 'custom' || (!requestedDifficulty && current.difficulty === 'custom');
  const hasValidCustomWords = Boolean(providedWords && providedWords.length > 0);

  let difficulty: SpellDifficulty = current.difficulty;
  if (wantsCustom && hasValidCustomWords) {
    difficulty = 'custom';
  } else if (requestedDifficulty && requestedDifficulty !== 'custom' && VALID_DIFFICULTIES.includes(requestedDifficulty)) {
    difficulty = requestedDifficulty;
  } else if (difficulty === 'custom' && !hasValidCustomWords) {
    difficulty = DEFAULT_SETTINGS.difficulty;
  }

  return {
    difficulty,
    rounds,
    readingSpeed,
    customWords: difficulty === 'custom' ? providedWords : undefined,
    customWordSourceName: difficulty === 'custom' ? providedSourceName : undefined,
  };
}

function sanitizeCustomWords(words: string[]): string[] {
  const unique = new Set<string>();
  const cleaned: string[] = [];

  for (const raw of words) {
    if (typeof raw !== 'string') {
      continue;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }
    const normalized = trimmed.slice(0, MAX_CUSTOM_WORD_LENGTH).toUpperCase();
    if (unique.has(normalized)) {
      continue;
    }
    unique.add(normalized);
    cleaned.push(normalized);
    if (cleaned.length >= MAX_CUSTOM_WORDS) {
      break;
    }
  }

  return cleaned;
}

function normalizeRoomCode(roomCode: string): string {
  return roomCode?.trim().toUpperCase();
}

function generateRoomCode(): string {
  let code = '';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  do {
    code = Array.from({ length: ROOM_CODE_LENGTH }, () => {
      const idx = Math.floor(Math.random() * chars.length);
      return chars[idx];
    }).join('');
  } while (lobbies.has(code));
  return code;
}
