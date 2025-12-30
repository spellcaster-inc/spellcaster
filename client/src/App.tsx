import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LandingPage from './pages/LandingPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import { useSocketConnection } from './hooks/useSocketConnection';
import { useLobby } from './hooks/useLobby';
import { GameSummaryCard } from './components/GameSummaryCard';
import { HostSettingsModal } from './components/HostSettingsModal';
import type { GameSettings } from '../../shared/types/socket';
import { SERVER_URL } from './lib/config';
import spellAudioManifest from '../../shared/spellAudioManifest.json';

const DEFAULT_SETTINGS: GameSettings = {
  difficulty: 'medium',
  rounds: 5,
  readingSpeed: 1,
};

type SpellAudioTier = 'easy' | 'medium' | 'hard';
type SpellAudioManifest = Record<SpellAudioTier, Array<{ spell: string; file: string }>>;
const SPELL_AUDIO_MANIFEST = spellAudioManifest as SpellAudioManifest;
const SPELL_AUDIO_TIERS: SpellAudioTier[] = ['easy', 'medium', 'hard'];

const App: React.FC = () => {
  const { status } = useSocketConnection();
  const {
    lobby,
    duel,
    countdown,
    prompt,
    roundRecap,
    summary,
    roundSubmissions,
    error,
    localPlayer,
    createLobby,
    joinLobby,
    leaveLobby,
    setReady,
    startDuel,
    submitSpell,
    clearError,
    resetSummary,
  } = useLobby();

  const [playerName, setPlayerName] = useState('');
  const [playerWizardId, setPlayerWizardId] = useState<string>('violet-warden');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [currentScreen, setCurrentScreen] = useState<'landing' | 'game'>('landing');
  const [currentGuess, setCurrentGuess] = useState('');
  const [typingStartedAt, setTypingStartedAt] = useState<number | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const promptIdRef = useRef<string | null>(null);
  const promptReadyRef = useRef<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const victorySfxRef = useRef<HTMLAudioElement | null>(null);
  const lossSfxRef = useRef<HTMLAudioElement | null>(null);
  const browserSpeechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [hostSettingsModalOpen, setHostSettingsModalOpen] = useState(false);
  const [hostSettings, setHostSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const shouldUseBrowserTts = useMemo(() => {
    if (duel?.settings.difficulty === 'custom') {
      return true;
    }
    if (!duel && lobby?.settings.difficulty === 'custom') {
      return true;
    }
    return false;
  }, [duel, lobby]);
  const spellAudioLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    SPELL_AUDIO_TIERS.forEach((tier) => {
      SPELL_AUDIO_MANIFEST[tier].forEach(({ spell, file }) => {
        lookup.set(spell.trim().toUpperCase(), file);
      });
    });
    return lookup;
  }, []);

  const resolveSpellAudioUrl = useCallback(
    (spellText: string) => {
      if (!spellText) {
        return null;
      }
      const raw = spellAudioLookup.get(spellText.trim().toUpperCase());
      if (!raw) {
        return null;
      }
      // If the URL is relative (starts with /audio/...), prefix with the server origin
      if (raw.startsWith('/')) {
        return `${SERVER_URL}${raw}`;
      }
      return raw;
    },
    [spellAudioLookup]
  );

  const handleLandingHostGame = (nickname: string, wizardId: string) => {
    const safeName =  nickname.trim() || 'WIZARD';
    setPlayerName(safeName);
    setPlayerWizardId(wizardId);
  
    // open the existing host settings modal – same wiring as before
    handleOpenHostSettings();
  };
  
  const handleLandingJoinGame = (nickname: string, joinCode: string, wizardId: string) => {
    const safeName = nickname.trim() || 'WIZARD';
    const code = joinCode.trim().toUpperCase();

    setPlayerName(safeName);
    setPlayerWizardId(wizardId);
    setRoomCodeInput(code);

    // use the existing joinLobby logic
    joinLobby(code, safeName, wizardId);

    // Don't switch screens immediately - wait for lobby state or error
    // The useEffect below will handle switching to 'game' when lobby is received
  };

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
  }, []);
  const stopBrowserSpeech = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      browserSpeechRef.current = null;
      return;
    }
    window.speechSynthesis.cancel();
    browserSpeechRef.current = null;
  }, []);
  const playSpellCastSfx = useCallback(() => {
    const randomTrack = Math.random() < 0.5 ? '/audio/spell1.wav' : '/audio/spell2.mp3';
    const audio = new Audio(randomTrack);
    audio.play().catch((error) => console.error('spell sfx failed', error));
  }, []);

  const playVictorySfx = useCallback(() => {
    try {
      if (!victorySfxRef.current) {
        victorySfxRef.current = new Audio('/audio/victory.wav');
      }
      victorySfxRef.current.currentTime = 0;
      void victorySfxRef.current.play();
    } catch (error) {
      console.error('victory sfx failed', error);
    }
  }, []);

  const playLossSfx = useCallback(() => {
    try {
      if (!lossSfxRef.current) {
        lossSfxRef.current = new Audio('/audio/loss.mp3');
      }
      lossSfxRef.current.currentTime = 0;
      void lossSfxRef.current.play();
    } catch (error) {
      console.error('loss sfx failed', error);
    }
  }, []);

  useEffect(() => {
    if (!countdown) {
      setCountdownValue(null);
      return;
    }
    setCountdownValue(countdown.seconds);
    const interval = setInterval(() => {
      setCountdownValue((prev) => {
        if (!prev || prev <= 1) {
          clearInterval(interval);
          return 1;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  useEffect(() => {
    if (!summary || !localPlayer) {
      return;
    }
    if (summary.winnerId === localPlayer.id) {
      playVictorySfx();
    } else {
      playLossSfx();
    }
  }, [summary, localPlayer, playVictorySfx, playLossSfx]);

  const speakWithBrowserTts = useCallback(
    (text: string, readingSpeed: number) => {
      if (!text) {
        return;
      }
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        console.warn('browser tts is not available in this environment');
        return;
      }
      stopBrowserSpeech();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = Math.min(2, Math.max(0.5, readingSpeed));
      utterance.pitch = 1;
      utterance.onend = () => {
        if (browserSpeechRef.current === utterance) {
          browserSpeechRef.current = null;
        }
      };
      browserSpeechRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [stopBrowserSpeech]
  );

  const playAudioFromUrl = useCallback(
    async (url: string) => {
      cleanupAudio();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
      };
      try {
        await audio.play();
      } catch (error) {
        console.error('spell audio playback failed', error);
      }
    },
    [cleanupAudio]
  );

  useEffect(() => {
    if (!prompt) {
      setCurrentGuess('');
      setTypingStartedAt(null);
      setHasSubmitted(false);
      promptReadyRef.current = false;
      cleanupAudio();
      stopBrowserSpeech();
      return;
    }
    
    // Only reset guess if it's a new prompt (different promptId)
    // This prevents resetting the guess if the prompt object is recreated but is the same prompt
    const isNewPrompt = promptIdRef.current !== prompt.promptId;
    
    if (isNewPrompt) {
      setCurrentGuess('');
      setHasSubmitted(false);
      promptReadyRef.current = false; // Mark as not ready until initialization is complete
      setTypingStartedAt(performance.now());
      promptIdRef.current = prompt.promptId;
    }
    
    // More robust focus mechanism with multiple attempts
    const focusInput = () => {
      if (inputRef.current) {
        inputRef.current.focus();
        // Try again after a short delay to ensure focus
        setTimeout(() => {
          if (inputRef.current && document.activeElement !== inputRef.current) {
            inputRef.current.focus();
          }
        }, 100);
      }
    };
    
    // Use requestAnimationFrame for initial focus, then setTimeout as backup
    requestAnimationFrame(() => {
      focusInput();
      
      // Mark prompt as ready after a small delay to ensure everything is initialized
      // This prevents race conditions where Enter is pressed before the prompt is fully ready
      setTimeout(() => {
        if (promptIdRef.current === prompt.promptId && inputRef.current) {
          promptReadyRef.current = true;
        }
      }, 200);
    });
  }, [prompt, cleanupAudio, stopBrowserSpeech]);

  useEffect(() => {
    if (!prompt) {
      cleanupAudio();
      stopBrowserSpeech();
      return;
    }

    if (shouldUseBrowserTts) {
      speakWithBrowserTts(prompt.spellText, prompt.readingSpeed);
      return () => {
        stopBrowserSpeech();
      };
    }

    const audioUrl = resolveSpellAudioUrl(prompt.spellText);

    if (!audioUrl) {
      console.warn('No saved audio for spell, using browser voice instead.');
      speakWithBrowserTts(prompt.spellText, prompt.readingSpeed);
      return () => {
        stopBrowserSpeech();
      };
    }

    let cancelled = false;

    const play = async () => {
      if (cancelled) {
        return;
      }
      await playAudioFromUrl(audioUrl);
    };

    play();

    return () => {
      cancelled = true;
      cleanupAudio();
    };
  }, [
    prompt,
    resolveSpellAudioUrl,
    playAudioFromUrl,
    cleanupAudio,
    shouldUseBrowserTts,
    speakWithBrowserTts,
    stopBrowserSpeech,
  ]);

  useEffect(
    () => () => {
      cleanupAudio();
      stopBrowserSpeech();
    },
    [cleanupAudio, stopBrowserSpeech]
  );

  useEffect(() => {
    if (hostSettingsModalOpen && lobby) {
      setHostSettingsModalOpen(false);
    }
  }, [hostSettingsModalOpen, lobby]);

  // Handle screen transitions based on lobby state
  useEffect(() => {
    // If we have a lobby, switch to game screen and clear any errors
    if (lobby && currentScreen === 'landing') {
      setCurrentScreen('game');
      clearError();
    }
    // If we lose the lobby and we're on game screen, go back to landing
    if (!lobby && currentScreen === 'game') {
      setCurrentScreen('landing');
    }
  }, [lobby, currentScreen, clearError]);

  const inLobby = Boolean(lobby && lobby.phase === 'lobby');
  const inDuel = Boolean(lobby && lobby.phase === 'in-duel');
  const activePlayers = useMemo(() => duel?.players ?? lobby?.players ?? [], [duel, lobby]);
  const hostSettingsReadyForConfirm =
    status === 'connected' &&
    (hostSettings.difficulty !== 'custom' || (hostSettings.customWords?.length ?? 0) > 0);

  const currentRoundNumber =
    countdown?.roundNumber ?? prompt?.roundNumber ?? roundRecap?.roundNumber ?? duel?.round ?? 1;

  const handleCreate = () => createLobby(playerName, hostSettings, playerWizardId);
  const handleJoin = () => joinLobby(roomCodeInput, playerName, playerWizardId);
  const handleReadyToggle = () => setReady(!localPlayer?.ready);
  const handleOpenHostSettings = () => {
    setHostSettings({ ...DEFAULT_SETTINGS });
    setHostSettingsModalOpen(true);
  };
  const handleHostSettingsChange = (partial: Partial<GameSettings>) => {
    setHostSettings((prev) => ({
      ...prev,
      ...partial,
    }));
  };
  const handleConfirmHostSettings = () => {
    handleCreate();
    setCurrentScreen('game');
  };

  const handleGuessChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentGuess(event.target.value.toUpperCase());
  };

  const handleSubmitSpell = useCallback(() => {
    if (!prompt || hasSubmitted) {
      return;
    }
    if (!prompt.promptId) {
      return;
    }
    
    // Ensure prompt is ready before allowing submission
    // This prevents race conditions where Enter is pressed before the prompt is fully initialized
    if (!promptReadyRef.current) {
      // If prompt isn't ready yet, wait a bit and check again
      // This handles the case where Enter is pressed immediately after prompt appears
      const checkReady = () => {
        // Check current state using refs to avoid closure issues
        if (promptReadyRef.current && promptIdRef.current === prompt.promptId && !hasSubmitted && prompt) {
          // Retry submission now that prompt is ready
          const inputValue = inputRef.current?.value || currentGuess;
          const guessToSubmit = inputValue.trim().toUpperCase();
          if (guessToSubmit) {
            const duration = typingStartedAt ? Math.max(0, performance.now() - typingStartedAt) : 0;
            submitSpell(guessToSubmit, duration, prompt.promptId);
            setHasSubmitted(true);
            playSpellCastSfx();
          }
        } else if (!promptReadyRef.current && promptIdRef.current === prompt.promptId && prompt) {
          // Still not ready, check again in a bit (max 10 attempts = 500ms)
          const attempts = (checkReady as any).attempts || 0;
          if (attempts < 10) {
            (checkReady as any).attempts = attempts + 1;
            setTimeout(checkReady, 50);
          }
        }
      };
      (checkReady as any).attempts = 0;
      setTimeout(checkReady, 50);
      return;
    }
    
    // Read the guess directly from the input element to avoid state sync issues
    const inputValue = inputRef.current?.value || currentGuess;
    const guessToSubmit = inputValue.trim().toUpperCase();
    
    // Don't submit if guess is empty (unless it's intentional)
    if (!guessToSubmit) {
      return;
    }
    
    const duration = typingStartedAt ? Math.max(0, performance.now() - typingStartedAt) : 0;
    submitSpell(guessToSubmit, duration, prompt.promptId);
    setHasSubmitted(true);
    playSpellCastSfx();
  }, [prompt, hasSubmitted, currentGuess, typingStartedAt, submitSpell, playSpellCastSfx]);

  const showResultsPending = hasSubmitted && !roundRecap && !prompt && !countdown;

  // Global Enter key handler as fallback when input might not be focused
  useEffect(() => {
    if (!inDuel || !prompt || hasSubmitted) {
      return;
    }

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // Only handle Enter key
      if (event.key !== 'Enter') {
        return;
      }

      // Don't interfere if user is typing in an input/textarea
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Focus the input, wait for it to be ready, then submit
      if (inputRef.current) {
        inputRef.current.focus();
        // Give time for focus and any pending state updates
        requestAnimationFrame(() => {
          setTimeout(() => {
            handleSubmitSpell();
          }, 100);
        });
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [inDuel, prompt, hasSubmitted, handleSubmitSpell]);

  const opponent = useMemo(() => {
    if (!duel || !localPlayer) {
      return null;
    }
    return duel.players.find((player) => player.id !== localPlayer.id) ?? null;
  }, [duel, localPlayer]);

  const opponentSubmitted =
    opponent &&
    roundSubmissions &&
    roundSubmissions.roundNumber === currentRoundNumber &&
    Boolean(roundSubmissions.playerIds[opponent.id]);


  const renderEntry = () => (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="player-name" className="text-sm text-slate-300">
          your wizard name
        </label>
        <input
          id="player-name"
          value={playerName}
          onChange={(event) => setPlayerName(event.target.value)}
          className="w-full rounded-lg border border-slate-600 bg-slate-900/70 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="ezra the typo slayer"
        />
      </div>

      <div className="flex gap-3 flex-col sm:flex-row">
        <button
          className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleOpenHostSettings}
          disabled={status !== 'connected'}
        >
          create duel
        </button>

        <div className="flex-1 space-y-2">
          <input
            value={roomCodeInput}
            onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
            className="w-full rounded-lg border border-slate-600 bg-slate-900/70 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="room code"
            maxLength={8}
          />
          <button
            className="w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleJoin}
            disabled={status !== 'connected'}
          >
            join duel
          </button>
        </div>
      </div>
    </div>
  );


  
  return (
    <>
      {currentScreen === 'landing' ? (
        <LandingPage
          onHostGame={handleLandingHostGame}
          onJoinGame={handleLandingJoinGame}
          serverError={error}
          onClearError={clearError}
        />
      ) : inLobby && lobby ? (
        <LobbyPage
          lobby={lobby}
          localPlayer={localPlayer}
          onReadyToggle={handleReadyToggle}
          onStartDuel={startDuel}
          onLeaveLobby={() => {
            leaveLobby();
            setCurrentScreen('landing');
          }}
        />
      ) : inDuel && duel ? (
        <GamePage
          duel={duel}
          localPlayer={localPlayer}
          countdown={countdown}
          countdownValue={countdownValue}
          prompt={prompt}
          roundRecap={roundRecap}
          currentGuess={currentGuess}
          hasSubmitted={hasSubmitted}
          opponentSubmitted={opponentSubmitted ?? false}
          opponent={opponent}
          showResultsPending={showResultsPending}
          onGuessChange={handleGuessChange}
          onSubmitSpell={handleSubmitSpell}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.stopPropagation();
              handleSubmitSpell();
            }
            if (event.key === 'Backspace' || event.key === 'Delete') {
              event.preventDefault();
            }
          }}
          inputRef={inputRef}
          onLeaveDuel={() => {
            leaveLobby();
            setCurrentScreen('landing');
          }}
        />
      ) : (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
          <div className="w-full max-w-4xl bg-slate-800/70 border border-slate-700 rounded-3xl shadow-xl p-6 space-y-6 relative">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold">spellcaster</h1>
              <p className="text-sm text-slate-300">
                dual-purpose spelling duels with real-time scoring, tts incantations, and wizard beams.
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-rose-600 bg-rose-900/30 px-3 py-2 text-sm text-rose-200 flex items-center justify-between gap-3">
                <span>{error}</span>
                <button
                  onClick={clearError}
                  className="text-xs uppercase tracking-wide underline underline-offset-2"
                >
                  dismiss
                </button>
              </div>
            )}

            {!lobby && renderEntry()}

          </div>
        </div>
      )}

      {/* shared host settings modal, works on landing + game */}
      <HostSettingsModal
        open={hostSettingsModalOpen && !lobby}
        settings={hostSettings}
        onChange={handleHostSettingsChange}
        onCancel={() => setHostSettingsModalOpen(false)}
        onConfirm={handleConfirmHostSettings}
        confirmDisabled={!hostSettingsReadyForConfirm}
      />

      {summary && (
        <GameSummaryCard
          summary={summary}
          players={activePlayers}
          localPlayerId={localPlayer?.id ?? null}
          onClose={resetSummary}
        />
      )}
    </>
  );

};

export default App;

