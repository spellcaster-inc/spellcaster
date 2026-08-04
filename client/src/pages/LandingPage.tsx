import { useEffect, useMemo, useState } from 'react';
import Logo from '../components/Logo';
import WizardAvatarSelectorModal from '../components/WizardAvatarSelectorModal';
import HowToPlayModal from '../components/HowToPlayModal';
import {
  DEFAULT_PLAYER_CUSTOMIZATION,
  loadPlayerCustomization,
  savePlayerCustomization,
} from '../lib/playerCustomization';
import type { Wizard } from '../types/wizard';
import wizardPurple from '../assets/spellcaster-wizards/wizard-purple.png';
import wizardRed from '../assets/spellcaster-wizards/wizard-red.png';
import wizardBlue from '../assets/spellcaster-wizards/wizard-blue.png';
import wizardGreen from '../assets/spellcaster-wizards/wizard-green.png';
import wizardOrange from '../assets/spellcaster-wizards/wizard-orange.png';
import wizardGrey from '../assets/spellcaster-wizards/wizard-grey.png';

const WIZARDS: Wizard[] = [
  {
    id: 'violet-warden',
    name: 'Violet Vowel',
    color: '#a78bfa',
    description: 'Calm focus. Loves perfect cadence.',
    imageUrl: wizardPurple,
  },
  {
    id: 'crimson-aegis',
    name: 'Red Rhyme',
    color: '#f87171',
    description: 'Aggressive caster with fiery streaks.',
    imageUrl: wizardRed,
  },
  {
    id: 'azure-sage',
    name: 'Blue Backspace',
    color: '#38bdf8',
    description: 'Quick thinker, thrives on momentum.',
    imageUrl: wizardBlue,
  },
  {
    id: 'emerald-scribe',
    name: 'Green Grammar',
    color: '#34d399',
    description: 'Lore keeper of the dueling halls.',
    imageUrl: wizardGreen,
  },
  {
    id: 'golden-starling',
    name: 'Orange Oops',
    color: '#fcd34d',
    description: 'Flashy tactician — accuracy under pressure.',
    imageUrl: wizardOrange,
  },
  {
    id: 'obsidian-mage',
    name: 'Grey Ghostwriter',
    color: '#94a3b8',
    description: 'Steady and unshakable aura.',
    imageUrl: wizardGrey,
  },
];

type LandingPageProps = {
  onHostGame: (nickname: string, wizardId: string) => void;
  onJoinGame: (nickname: string, joinCode: string, wizardId: string) => void;
  serverError?: string | null;
  onClearError?: () => void;
};

const LandingPage: React.FC<LandingPageProps> = ({ onHostGame, onJoinGame, serverError, onClearError }) => {
  const [nickname, setNickname] = useState(() => loadPlayerCustomization().nickname);
  const [selectedWizardId, setSelectedWizardId] = useState(() => {
    const savedWizardId = loadPlayerCustomization().wizardId;
    return WIZARDS.some((wizard) => wizard.id === savedWizardId)
      ? savedWizardId
      : DEFAULT_PLAYER_CUSTOMIZATION.wizardId;
  });
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isWizardModalOpen, setIsWizardModalOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);

  useEffect(() => {
    savePlayerCustomization({ nickname, wizardId: selectedWizardId });
  }, [nickname, selectedWizardId]);

  const selectedWizard = useMemo(
    () => WIZARDS.find((wizard) => wizard.id === selectedWizardId) ?? WIZARDS[0],
    [selectedWizardId]
  );

  const handleNicknameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const sanitizedValue = event.target.value.toUpperCase().slice(0, 12);
    setNickname(sanitizedValue);
  };

  const handleJoinCodeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6);
    setJoinCode(value);
    if (joinError) {
      setJoinError('');
    }
    if (serverError && onClearError) {
      onClearError();
    }
  };

  const handleHostGame = () => {
    onHostGame(nickname, selectedWizardId);
  };

  const handleJoinGame = () => {
    if (joinCode.length < 4) {
      setJoinError('Please enter a valid code.');
      return;
    }

    setJoinError('');
    onJoinGame(nickname, joinCode, selectedWizardId);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-magic text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <span className="magic-star" style={{ top: '14%', left: '45%', animationDelay: '0s' }} />
        <span className="magic-star" style={{ top: '60%', left: '75%', animationDelay: '2s' }} />
        <span className="magic-star" style={{ top: '35%', left: '20%', animationDelay: '4s' }} />
        <span className="shooting-star" style={{ top: '5%', right: '10%', animationDelay: '1s' }} />
        <span className="shooting-star" style={{ top: '30%', left: '5%', animationDelay: '6s' }} />
        <span className="floating-spark" style={{ top: '20%', left: '15%', animationDelay: '0s' }} />
        <span className="floating-spark" style={{ top: '35%', left: '70%', animationDelay: '2s' }} />
        <span className="floating-spark" style={{ top: '65%', left: '25%', animationDelay: '4s' }} />
        <span className="floating-spark" style={{ top: '50%', left: '85%', animationDelay: '6s' }} />
        <span className="floating-spark" style={{ top: '15%', left: '80%', animationDelay: '8s' }} />
        <span className="wand-ember" style={{ top: '18%', right: '18%', animationDelay: '1s' }} />
        <span className="wand-ember" style={{ bottom: '14%', left: '12%', animationDelay: '3s' }} />
        <span className="wand-ember" style={{ bottom: '20%', right: '30%', animationDelay: '5s' }} />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-4">
        <div className="w-full max-w-3xl space-y-6">
          <header className="text-center space-y-4">
            <Logo />
            <p className="font-spellcaster text-emerald-200 drop-shadow-[0_0_20px_rgba(16,185,129,0.4)] md:text-xl">
              Outspell your rival in a wizard duel.
            </p>
          </header>

          <section className="card-glow rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_30px_50px_rgba(4,0,23,0.7)] backdrop-blur-2xl sm:p-6">
            <div className="space-y-5">
              <div className="space-y-3">
                <label htmlFor="wizard-name" className="text-sm text-slate-300 uppercase tracking-wide">
                  Wizard Name
                </label>
                <input
                  id="wizard-name"
                  value={nickname}
                  onChange={handleNicknameChange}
                  maxLength={12}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-base font-semibold tracking-[0.3em] text-white placeholder:text-slate-500 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                  placeholder="WIZARD"
                />
                <p className="text-xs text-slate-400">Max 12 characters.</p>
              </div>

              <div className="rounded-[26px] border border-white/10 bg-slate-950/40 p-5 shadow-inner">
                <div className="grid gap-5 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:items-center">
                  <div className="relative mx-auto flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-br from-indigo-900/70 to-slate-900 shadow-[0_0_45px_rgba(59,7,100,0.8)]">
                    <span
                      className="relative h-28 w-28 overflow-hidden rounded-full border border-white/20 shadow-[0_0_25px_rgba(255,255,255,0.25)]"
                      style={{ background: selectedWizard.color }}
                    >
                      {selectedWizard.imageUrl && (
                        <img
                          src={selectedWizard.imageUrl}
                          alt={selectedWizard.name}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </span>
                  </div>
                  <div className="space-y-3 text-center md:text-left">
                    <div>
                      <p className="font-incantation text-2xl text-white">{selectedWizard.name}</p>
                    </div>
                    <div className="flex flex-col gap-3 sm:items-start">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-300">
                        <span>Beam Color</span>
                        <span
                          className="inline-flex h-3 w-16 rounded-full border border-white/10"
                          style={{ background: selectedWizard.color }}
                          aria-hidden="true"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsWizardModalOpen(true)}
                        className="inline-flex items-center justify-center self-start rounded-full border border-emerald-300/50 bg-emerald-400/10 px-5 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:-translate-y-0.5 hover:bg-emerald-400/20"
                      >
                        Change Wizard
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col gap-2 lg:flex-row">
                  <button
                    type="button"
                    onClick={handleHostGame}
                    className="group relative flex-1 overflow-hidden rounded-2xl border border-emerald-200/40 bg-gradient-to-r from-emerald-500/30 via-indigo-600/30 to-cyan-500/30 px-4 py-2 text-sm font-spellcaster text-emerald-50 shadow-[0_12px_28px_rgba(6,95,70,0.45)] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/70"
                  >
                    <span className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
                      <span className="absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-emerald-300/30 to-transparent blur-xl" />
                      <span className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-cyan-300/30 to-transparent blur-xl" />
                    </span>
                    <span className="relative text-3xl tracking-[0.1em]">
                      Host Game
                    </span>
                  </button>

                  <div className="flex-1 space-y-2 rounded-2xl border border-white/10 bg-slate-900/60 p-3">
                    <label htmlFor="join-code" className="text-xs uppercase tracking-[0.4em] text-slate-400">
                      Join Code
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        id="join-code"
                        value={joinCode}
                        onChange={handleJoinCodeChange}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            handleJoinGame();
                          }
                        }}
                        maxLength={6}
                        placeholder="ABCD"
                        className="flex-1 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-center text-sm font-semibold tracking-[0.45em] text-white placeholder:text-slate-600 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                      />
                      <button
                        type="button"
                        onClick={handleJoinGame}
                        className="rounded-2xl border border-cyan-300/60 bg-cyan-400/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-100 transition hover:bg-cyan-400/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                      >
                        Join Game
                      </button>
                    </div>
                    {joinError ? (
                      <p className="text-sm text-rose-300">{joinError}</p>
                    ) : serverError ? (
                      <p className="text-sm text-rose-300">{serverError}</p>
                    ) : (
                      <p className="text-xs text-slate-400">
                        Enter the 4-letter code your friend shares with you.
                      </p>
                    )}
                  </div>
                </div>

              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setIsHowToPlayOpen(true)}
                  className="text-sm font-semibold text-slate-200 underline decoration-dashed underline-offset-4 hover:text-white"
                >
                  How to Play
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {isWizardModalOpen && (
        <WizardAvatarSelectorModal
          wizards={WIZARDS}
          selectedWizardId={selectedWizardId}
          onSelect={(wizardId) => setSelectedWizardId(wizardId)}
          onClose={() => setIsWizardModalOpen(false)}
        />
      )}

      <HowToPlayModal isOpen={isHowToPlayOpen} onClose={() => setIsHowToPlayOpen(false)} />
    </main>
  );
};

export default LandingPage;
