import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server as SocketIOServer, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../../shared/types/socket';
import { registerSocketHandlers } from '../src/sockets';

type TestIo = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
type TestSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

interface RecordedEvent {
  event: keyof ServerToClientEvents;
  payload: unknown;
}

function createSocketHarness() {
  let connectionHandler: ((socket: TestSocket) => void) | null = null;
  const sockets: FakeSocket[] = [];

  class FakeSocket {
    readonly data: SocketData = {};
    readonly events: RecordedEvent[] = [];
    readonly rooms = new Set<string>();
    private readonly handlers = new Map<string, (payload?: unknown) => void>();

    constructor(readonly id: string) {}

    on(event: string, handler: (payload?: unknown) => void) {
      this.handlers.set(event, handler);
      return this;
    }

    emit(event: keyof ServerToClientEvents, payload: unknown) {
      this.events.push({ event, payload });
      return true;
    }

    join(roomCode: string) {
      this.rooms.add(roomCode);
      return Promise.resolve();
    }

    leave(roomCode: string) {
      this.rooms.delete(roomCode);
      return Promise.resolve();
    }

    clientEmit(event: keyof ClientToServerEvents, payload?: unknown) {
      const handler = this.handlers.get(event);
      if (!handler) {
        throw new Error(`No server handler registered for ${event}`);
      }
      handler(payload);
    }

    payloads<T>(event: keyof ServerToClientEvents) {
      return this.events.filter((entry) => entry.event === event).map((entry) => entry.payload as T);
    }
  }

  const io = {
    on: vi.fn((event: string, handler: (socket: TestSocket) => void) => {
      if (event === 'connection') {
        connectionHandler = handler;
      }
    }),
    to: vi.fn((roomCode: string) => ({
      emit: (event: keyof ServerToClientEvents, payload: unknown) => {
        sockets
          .filter((socket) => socket.rooms.has(roomCode))
          .forEach((socket) => socket.emit(event, payload));
      },
    })),
  } as unknown as TestIo;

  registerSocketHandlers(io);

  const connect = (id: string) => {
    const socket = new FakeSocket(id);
    sockets.push(socket);
    if (!connectionHandler) {
      throw new Error('Socket.IO connection handler was not registered');
    }
    connectionHandler(socket as unknown as TestSocket);
    return socket;
  };

  return { connect };
}

describe('lobby room-code normalization', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('normalizes codes for settings, ready, and starting a duel', () => {
    const { connect } = createSocketHarness();
    const host = connect('host');
    const guest = connect('guest');

    host.clientEmit('lobby:create', {
      playerName: 'Merlin',
      requestId: 'create-1',
    });
    const createdLobby = host.payloads<{ roomCode: string }>('lobby:state').at(-1)!;
    const variantCode = `  ${createdLobby.roomCode.toLowerCase()}  `;

    guest.clientEmit('lobby:join', {
      roomCode: variantCode,
      playerName: 'Morgana',
    });
    host.clientEmit('lobby:updateSettings', {
      roomCode: variantCode,
      settings: { rounds: 10 },
    });
    host.clientEmit('lobby:setReady', { roomCode: variantCode, ready: true });
    guest.clientEmit('lobby:setReady', { roomCode: variantCode, ready: true });
    host.clientEmit('lobby:startDuel', { roomCode: variantCode });

    expect(host.payloads('error')).toHaveLength(0);
    expect(guest.payloads('error')).toHaveLength(0);
    expect(host.payloads<{ settings: { rounds: number } }>('lobby:state').at(-2)?.settings.rounds).toBe(10);
    expect(host.payloads<{ phase: string }>('lobby:state').at(-1)?.phase).toBe('in-duel');
    expect(host.payloads('duel:started')).toHaveLength(1);
    expect(guest.payloads('duel:started')).toHaveLength(1);
  });
});
