import type { Player } from '../../../shared/types/socket';

interface DuelScoreIndicatorProps {
  players: Player[];
  scores: Record<string, number>;
  localPlayerId: string | null;
  playerColors: Record<string, string>;
}

export function DuelScoreIndicator({ players, scores, localPlayerId, playerColors }: DuelScoreIndicatorProps) {
  const [leftPlayer, rightPlayer] = players;
  const renderPlayer = (player: Player | undefined) => {
    if (!player) return <div className="w-24 shrink-0 sm:w-28" />;

    const score = scores[player.id] ?? 0;
    const playerLabel = `${player.name}${player.id === localPlayerId ? ' (you)' : ''}`;

    return (
      <div
        className="flex w-24 shrink-0 flex-col items-center justify-center text-center sm:w-28"
        aria-label={`${playerLabel} score: ${score}`}
      >
        <span className="text-[8px] uppercase tracking-[0.22em] text-white/35 sm:text-[9px]">score</span>
        <span className="mt-0.5 font-incantation text-xl leading-none text-amber-100 sm:text-2xl">{score}</span>
        <span
          className="mt-1 h-px w-10 max-w-full rounded-full opacity-75"
          style={{
            backgroundColor: playerColors[player.id] ?? '#a78bfa',
            boxShadow: `0 0 10px ${playerColors[player.id] ?? '#a78bfa'}`,
          }}
          aria-hidden="true"
        />
      </div>
    );
  };

  return (
    <div className="relative flex w-full items-center justify-between" aria-label="Current duel scores">
      {renderPlayer(leftPlayer)}
      <span className="absolute left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-[0.2em] text-white/25 sm:text-[10px]">vs</span>
      {renderPlayer(rightPlayer)}
    </div>
  );
}
