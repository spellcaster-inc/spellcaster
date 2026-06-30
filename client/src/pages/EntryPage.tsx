import { EntryForm } from '../components/EntryForm';
import { ServerErrorBanner } from '../components/ServerErrorBanner';

interface EntryPageProps {
  error: string | null;
  onClearError: () => void;
  showEntryForm: boolean;
  playerName: string;
  onPlayerNameChange: (value: string) => void;
  roomCodeInput: string;
  onRoomCodeChange: (value: string) => void;
  onOpenHostSettings: () => void;
  onJoin: () => void;
  entryDisabled: boolean;
}

const EntryPage: React.FC<EntryPageProps> = ({
  error,
  onClearError,
  showEntryForm,
  playerName,
  onPlayerNameChange,
  roomCodeInput,
  onRoomCodeChange,
  onOpenHostSettings,
  onJoin,
  entryDisabled,
}) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-4xl bg-slate-800/70 border border-slate-700 rounded-3xl shadow-xl p-6 space-y-6 relative">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">spellcaster</h1>
          <p className="text-sm text-slate-300">
            dual-purpose spelling duels with real-time scoring, tts incantations, and wizard beams.
          </p>
        </div>

        {error && <ServerErrorBanner message={error} onDismiss={onClearError} />}

        {showEntryForm && (
          <EntryForm
            playerName={playerName}
            onPlayerNameChange={onPlayerNameChange}
            roomCodeInput={roomCodeInput}
            onRoomCodeChange={onRoomCodeChange}
            onOpenHostSettings={onOpenHostSettings}
            onJoin={onJoin}
            disabled={entryDisabled}
          />
        )}

      </div>
    </div>
  );
};

export default EntryPage;
