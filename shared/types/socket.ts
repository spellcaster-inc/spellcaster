export type LobbyPhase = 'lobby' | 'in-duel';

export type SpellDifficulty = 'easy' | 'medium' | 'hard' | 'custom';
export type ReadingSpeed = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;

export interface GameSettings {
  difficulty: SpellDifficulty;
  rounds: 5 | 10 | 15;
  readingSpeed: ReadingSpeed;
  customWords?: string[];
  customWordSourceName?: string;
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  ready: boolean;
  wizardId?: string;
}

export interface LobbyState {
  roomCode: string;
  phase: LobbyPhase;
  players: Player[];
  settings: GameSettings;
}

export interface DuelState {
  roomCode: string;
  round: number;
  totalRounds: number;
  startedAt: string;
  players: Player[];
  settings: GameSettings;
  beamOffset: number;
}

export interface CountdownPayload {
  roundNumber: number;
  totalRounds: number;
  seconds: number;
  readingSpeed: ReadingSpeed;
}

export interface CatalogSpellPromptPayload {
  mode: 'catalog';
  roundNumber: number;
  totalRounds: number;
  promptId: string;
  audioUrl: string;
  readingSpeed: ReadingSpeed;
  startedAt: string;
}

export interface CustomSpellPromptPayload {
  mode: 'custom';
  roundNumber: number;
  totalRounds: number;
  promptId: string;
  spellText: string;
  readingSpeed: ReadingSpeed;
  startedAt: string;
}

export type SpellPromptPayload = CatalogSpellPromptPayload | CustomSpellPromptPayload;

export interface PlayerRoundResult {
  playerId: string;
  playerName: string;
  guess: string;
  accuracy: number;
  baseScore: number;
  bonusScore: number;
  totalScore: number;
  durationMs: number;
  cumulativeScore: number;
}

export interface RoundRecapPayload {
  roomCode: string;
  roundNumber: number;
  totalRounds: number;
  spell: string;
  playerResults: PlayerRoundResult[];
  winningPlayerId: string | null;
  beamOffset: number;
}

export interface PlayerSummary {
  playerId: string;
  playerName: string;
  averageAccuracy: number;
  averageDurationMs: number;
  totalScore: number;
}

export interface GameSummary {
  roomCode: string;
  winnerId: string | null;
  winnerName: string | null;
  reason: 'beam' | 'rounds' | 'forfeit';
  rounds: RoundRecapPayload[];
  players: PlayerSummary[];
}

export interface PlayerSubmissionPayload {
  roomCode: string;
  roundNumber: number;
  playerId: string;
}

export interface ServerErrorPayload {
  message: string;
}

// types that describe the events client can send to server
export interface ClientToServerEvents {
  // simple ping event for testing round-trip
  ping: () => void;
  'lobby:create': (payload: { playerName: string; settings?: Partial<GameSettings>; wizardId?: string }) => void;
  'lobby:join': (payload: { roomCode: string; playerName: string; wizardId?: string }) => void;
  'lobby:leave': () => void;
  'lobby:setReady': (payload: { roomCode: string; ready: boolean }) => void;
  'lobby:updateSettings': (payload: { roomCode: string; settings: Partial<GameSettings> }) => void;
  'lobby:startDuel': (payload: { roomCode: string }) => void;
  'duel:submitSpell': (payload: {
    roomCode: string;
    promptId: string;
    guess: string;
    durationMs: number;
  }) => void;
}

// types that describe the events server can send to client
export interface ServerToClientEvents {
  // server replies to ping with a pong and some metadata
  pong: (data: { timestamp: string }) => void;
  'lobby:state': (state: LobbyState) => void;
  'duel:started': (state: DuelState) => void;
  'duel:countdown': (payload: CountdownPayload) => void;
  'duel:prompt': (payload: SpellPromptPayload) => void;
  'duel:roundRecap': (payload: RoundRecapPayload) => void;
  'duel:playerSubmitted': (payload: PlayerSubmissionPayload) => void;
  'duel:completed': (payload: GameSummary) => void;
  error: (payload: ServerErrorPayload) => void;
}

// currently empty, but we might use this later
export interface InterServerEvents {
  // placeholder for inter-server events
}

// placeholder for per-socket data we might use later
export interface SocketData {
  roomCode?: string;
  playerName?: string;
}

