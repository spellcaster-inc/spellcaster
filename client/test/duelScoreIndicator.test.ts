import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Player } from '../../shared/types/socket';
import { DuelScoreIndicator } from '../src/components/DuelScoreIndicator';

const players: Player[] = [
  { id: 'left-player', name: 'WIZARD', isHost: true, ready: true },
  { id: 'right-player', name: 'WIZARD2', isHost: false, ready: true },
];

describe('DuelScoreIndicator', () => {
  it('renders player-anchored scores in arena order without the old dark container', () => {
    const markup = renderToStaticMarkup(createElement(DuelScoreIndicator, {
      players,
      scores: { 'left-player': 110, 'right-player': 27 },
      localPlayerId: 'left-player',
      playerColors: { 'left-player': '#a78bfa', 'right-player': '#38bdf8' },
    }));

    expect(markup).toContain('aria-label="WIZARD (you) score: 110"');
    expect(markup).toContain('aria-label="WIZARD2 score: 27"');
    expect(markup).toContain('>score<');
    expect(markup).toContain('110');
    expect(markup).toContain('27');
    expect(markup).toContain('>vs<');
    expect(markup).not.toContain('bg-slate-950/55');
    expect(markup).not.toContain('shadow-inner');
    expect(markup).not.toContain('border-x');
  });

  it('keeps long player identities accessible and renders each wizard color as an accent', () => {
    const longNamePlayers = players.map((player, index) => ({
      ...player,
      name: index === 0 ? 'EXTRAORDINARILYLONGWIZARD' : 'RIVAL',
    }));
    const markup = renderToStaticMarkup(createElement(DuelScoreIndicator, {
      players: longNamePlayers,
      scores: { 'left-player': 999, 'right-player': 4 },
      localPlayerId: 'left-player',
      playerColors: { 'left-player': '#f87171', 'right-player': '#38bdf8' },
    }));

    expect(markup).toContain('aria-label="EXTRAORDINARILYLONGWIZARD (you) score: 999"');
    expect(markup).toContain('w-24 shrink-0');
    expect(markup).toContain('background-color:#f87171');
    expect(markup).toContain('background-color:#38bdf8');
  });
});
