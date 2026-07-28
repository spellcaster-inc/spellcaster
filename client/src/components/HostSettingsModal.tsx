import type { GameSettings } from '../../../shared/types/socket';
import { GameSettingsControls } from './GameSettingsControls';

interface HostSettingsModalProps {
  open: boolean;
  settings: GameSettings;
  onChange: (settings: Partial<GameSettings>) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  isCreating?: boolean;
  error?: string | null;
  onClearError?: () => void;
}

export function HostSettingsModal({
  open,
  settings,
  onChange,
  onCancel,
  onConfirm,
  confirmDisabled,
  isCreating = false,
  error,
  onClearError,
}: HostSettingsModalProps) {
  if (!open) {
    return null;
  }

  const actionsDisabled = Boolean(confirmDisabled || isCreating);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70 backdrop-blur px-4">
      <div className="w-full max-w-2xl rounded-[24px] border border-slate-800 bg-slate-900/75 p-6 sm:p-8 space-y-6 shadow-[0_18px_36px_rgba(0,0,0,0.35)]">
        <div className="space-y-3 text-center">
          <p className="text-4xl sm:text-5xl font-spellcaster tracking-[0.2em] text-emerald-100 drop-shadow-[0_0_12px_rgba(16,185,129,0.35)]">
            Configure Duel Settings
          </p>
          <p className="text-sm text-slate-300 max-w-xl mx-auto">
            Choose your incantation difficulty, number of rounds, and reading speed before summoning the lobby.
          </p>
        </div>

        <div
          className={`rounded-[20px] border border-slate-800 bg-slate-900/65 p-5 shadow-inner shadow-black/30 ${
            isCreating ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          <GameSettingsControls settings={settings} onChange={onChange} />
        </div>

        {error && (
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-rose-400/40 bg-rose-950/50 px-4 py-3 text-sm text-rose-100">
            <p>{error}</p>
            {onClearError && (
              <button
                type="button"
                onClick={onClearError}
                className="shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-rose-200/80 hover:text-rose-50"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isCreating}
            className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-slate-200 transition hover:-translate-y-0.5 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={actionsDisabled}
            className="w-full rounded-2xl border border-sky-200/50 bg-gradient-to-r from-sky-500/25 via-blue-500/25 to-indigo-500/25 px-4 py-3 text-sm font-spellcaster uppercase tracking-[0.35em] text-slate-50 shadow-[0_8px_18px_rgba(59,130,246,0.3)] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isCreating ? 'Creating…' : 'Create Lobby'}
          </button>
        </div>
      </div>
    </div>
  );
}
