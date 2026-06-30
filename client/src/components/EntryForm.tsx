interface EntryFormProps {
  playerName: string;
  onPlayerNameChange: (value: string) => void;
  roomCodeInput: string;
  onRoomCodeChange: (value: string) => void;
  onOpenHostSettings: () => void;
  onJoin: () => void;
  disabled: boolean;
}

export function EntryForm({
  playerName,
  onPlayerNameChange,
  roomCodeInput,
  onRoomCodeChange,
  onOpenHostSettings,
  onJoin,
  disabled,
}: EntryFormProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="player-name" className="text-sm text-slate-300">
          your wizard name
        </label>
        <input
          id="player-name"
          value={playerName}
          onChange={(event) => onPlayerNameChange(event.target.value)}
          className="w-full rounded-lg border border-slate-600 bg-slate-900/70 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="ezra the typo slayer"
        />
      </div>

      <div className="flex gap-3 flex-col sm:flex-row">
        <button
          className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onOpenHostSettings}
          disabled={disabled}
        >
          create duel
        </button>

        <div className="flex-1 space-y-2">
          <input
            value={roomCodeInput}
            onChange={(event) => onRoomCodeChange(event.target.value.toUpperCase())}
            className="w-full rounded-lg border border-slate-600 bg-slate-900/70 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="room code"
            maxLength={8}
          />
          <button
            className="w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onJoin}
            disabled={disabled}
          >
            join duel
          </button>
        </div>
      </div>
    </div>
  );
}
