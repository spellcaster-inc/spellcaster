// @vitest-environment jsdom

import { EventEmitter } from 'node:events';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { DEFAULT_SETTINGS } from '../src/lib/constants';
import type { DuelState, GameSummary, LobbyState } from '../../shared/types/socket';

const { getSocket } = vi.hoisted(() => ({ getSocket: vi.fn() }));
vi.mock('../src/lib/socket', () => ({ getSocket }));

const players = [
  { id: 'local', name: 'MERLIN', isHost: true, ready: true },
  { id: 'guest', name: 'MORGANA', isHost: false, ready: true },
];
const lobby: LobbyState = {
  roomCode: 'ABCD',
  phase: 'lobby',
  players,
  settings: DEFAULT_SETTINGS,
};
const duel: DuelState = {
  ...lobby,
  round: 1,
  totalRounds: 5,
  startedAt: '2026-01-01T00:00:00.000Z',
  beamOffset: 0,
};

describe('disconnect feedback', () => {
  let events: EventEmitter;
  let socket: { connected: boolean; id: string };
  let send: ReturnType<typeof vi.fn>;

  function enterDuel() {
    act(() => {
      events.emit('lobby:state', { ...lobby, phase: 'in-duel' });
      events.emit('duel:started', duel);
    });
  }

  function disconnect() {
    act(() => {
      socket.connected = false;
      events.emit('disconnect');
    });
  }

  beforeEach(() => {
    events = new EventEmitter();
    send = vi.fn();
    socket = { connected: true, id: 'local' };
    getSocket.mockReturnValue(Object.assign(socket, {
      on: events.on.bind(events),
      off: events.off.bind(events),
      emit: send,
    }));
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    localStorage.clear();
    render(<App />);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('leaves the stale lobby and can join again after reconnecting', () => {
    act(() => events.emit('lobby:state', lobby));
    expect(screen.getByRole('button', { name: 'Leave Lobby' })).toBeTruthy();

    disconnect();
    expect(screen.queryByRole('button', { name: 'Leave Lobby' })).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('You left the lobby.');
    expect(screen.getByRole('button', { name: 'Host Game' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Join Code'), { target: { value: 'ABCD' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join Game' }));
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByText('Wait for your connection before joining.')).toBeTruthy();

    act(() => {
      socket.id = 'reconnected';
      socket.connected = true;
      events.emit('connect');
    });
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Host Game' }));
    expect(screen.getByRole('button', { name: 'Create Lobby' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: 'Join Game' }));
    expect(send).toHaveBeenCalledWith('lobby:join', expect.objectContaining({ roomCode: 'ABCD' }));
    act(() => events.emit('lobby:state', {
      ...lobby,
      players: [{ ...players[0], id: socket.id }, players[1]],
    }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Leave Lobby' })).toBeTruthy();
  });

  it('shows a dismissible notice when the local player loses the duel connection', () => {
    enterDuel();
    expect(screen.getByRole('button', { name: 'Leave Duel' })).toBeTruthy();

    disconnect();
    expect(screen.getByRole('alert').textContent).toContain('The duel ended.');
    expect(screen.queryByRole('button', { name: 'Leave Duel' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss connection notice' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Host Game' })).toBeTruthy();
  });

  it('keeps lobby departures quiet and explains a forfeit in the results', () => {
    const soloLobby = { ...lobby, players: [players[0]] };
    act(() => {
      events.emit('lobby:state', lobby);
      events.emit('lobby:state', soloLobby);
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Waiting for opponent...')).toBeTruthy();

    enterDuel();
    const summary: GameSummary = {
      roomCode: lobby.roomCode,
      reason: 'forfeit',
      winnerId: 'local',
      winnerName: 'MERLIN',
      rounds: [],
      players: [],
    };
    act(() => {
      events.emit('duel:completed', summary);
      events.emit('lobby:state', soloLobby);
    });
    const result = within(screen.getByRole('dialog', { name: 'Victory' }));
    expect(result.getByText('Your opponent left. You win by forfeit.')).toBeTruthy();
    fireEvent.click(result.getByRole('button', { name: 'Return to Lobby' }));
    expect(screen.getByRole('button', { name: 'Leave Lobby' })).toBeTruthy();

    enterDuel();
    act(() => {
      events.emit('duel:completed', { ...summary, reason: 'rounds' });
      events.emit('lobby:state', lobby);
    });
    expect(screen.getByText('You outspelled the challenging wizard.')).toBeTruthy();
    expect(screen.queryByText('Your opponent left. You win by forfeit.')).toBeNull();
  });
});
