import type { Player } from '../../../shared/types/socket';

interface DuelScoreIndicatorProps {
  players: Player[];
  scores: Record<string, number>;
  localPlayerId: string | null;
}

export function DuelScoreIndicator({ players, scores, localPlayerId }: DuelScoreIndicatorProps) {
  const [leftPlayer, rightPlayer] = players;
  const renderPlayer = (player: Player | undefined) => player ? (
    <div className="flex min-w-0 flex-col items-center justify-center px-2 text-center">
      <span className="block truncate text-[10px] uppercase tracking-wider text-slate-400">
        {player.name}{player.id === localPlayerId ? ' (you)' : ''}
      </span>
      <span className="font-incantation text-lg text-amber-100">{scores[player.id] ?? 0}</span>
    </div>
  ) : <div />;

  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center rounded-full border border-white/10 bg-slate-950/55 px-2 py-1.5 shadow-inner" aria-label="Current duel scores">
      {renderPlayer(leftPlayer)}
      <span className="flex h-8 items-center border-x border-white/10 px-3 text-[10px] uppercase tracking-widest text-slate-500">vs</span>
      {renderPlayer(rightPlayer)}
    </div>
  );
}
