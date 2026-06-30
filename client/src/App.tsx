import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LandingPage from './pages/LandingPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import EntryPage from './pages/EntryPage';
import { useSocketConnection } from './hooks/useSocketConnection';
import { useLobby } from './hooks/useLobby';
import { GameSummaryCard } from './components/GameSummaryCard';
import { HostSettingsModal } from './components/HostSettingsModal';
import type { GameSettings } from '../../shared/types/socket';
import { SERVER_URL } from './lib/config';
import { DEFAULT_SETTINGS } from './lib/constants';
import type { SpellAudioTier, SpellAudioManifest } from './types/audio';
import spellAudioManifest from '../../shared/spellAudioManifest.json';

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
  const currentGuessRef = useRef('');
  const [typingStartedAt, setTypingStartedAt] = useState<number | null>(null);

  // Sync setter that updates both ref (synchronous) and state (async)
  const setGuess = useCallback((next: string) => {
    currentGuessRef.current = next;
    setCurrentGuess(next);
  }, []);
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

  // Track which game summary we've played sounds for to avoid repeats
  const playedSummaryRef = useRef<string | null>(null);

  useEffect(() => {
    if (!summary || !localPlayer) {
      return;
    }
    // Only play once per unique game (identified by roomCode + round count)
    const summaryKey = `${summary.roomCode}-${summary.rounds.length}`;
    if (playedSummaryRef.current === summaryKey) {
      return; // Already played for this game
    }
    playedSummaryRef.current = summaryKey;

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
      setGuess('');
      setTypingStartedAt(null);
      setHasSubmitted(false);
      promptReadyRef.current = false;
      cleanupAudio();
      stopBrowserSpeech();
      return;
    }

    const isNewPrompt = promptIdRef.current !== prompt.promptId;

    if (isNewPrompt) {
      setGuess('');
      setHasSubmitted(false);
      setTypingStartedAt(performance.now());
      promptIdRef.current = prompt.promptId;
    }

    // Focus the input and immediately mark as ready (no waiting loops).
    if (inputRef.current) {
      inputRef.current.focus();
    }
    promptReadyRef.current = true;

    // If the player tabs away and comes back, resync from DOM and force focus.
    const handleWindowFocus = () => {
      const el = inputRef.current;
      if (!el) return;

      // If DOM has text but ref is empty or different, resync.
      const dom = (el.value ?? '').toUpperCase();
      if (dom && dom !== currentGuessRef.current) {
        setGuess(dom);
      }

      el.focus();
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [prompt, cleanupAudio, stopBrowserSpeech, setGuess]);

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
    setGuess(event.target.value.toUpperCase());
  };

  const handleSubmitSpell = useCallback(() => {
    if (!prompt || hasSubmitted || !prompt.promptId) {
      return;
    }

    // Read from both DOM and ref to handle race conditions after tab-in
    const domValue = inputRef.current?.value ?? '';
    const refValue = currentGuessRef.current ?? '';
    const guessToSubmit = (domValue.trim() ? domValue : refValue).trim().toUpperCase();

    if (!guessToSubmit) {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
      return;
    }

    const duration = typingStartedAt ? Math.max(0, performance.now() - typingStartedAt) : 0;
    submitSpell(guessToSubmit, duration, prompt.promptId);
    setHasSubmitted(true);
    playSpellCastSfx();
  }, [prompt, hasSubmitted, typingStartedAt, submitSpell, playSpellCastSfx]);

  const showResultsPending = hasSubmitted && !roundRecap && !prompt && !countdown;

  // Global keystroke handler - captures ALL keys when prompt is active
  // This ensures typing works even if the hidden input loses focus
  useEffect(() => {
    if (!inDuel || !prompt || hasSubmitted) {
      return;
    }

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      // If already typing in the spell input, let it handle normally
      if (isInInput && target === inputRef.current) {
        return;
      }

      // If typing in some other input (like a modal), ignore
      if (isInInput) {
        return;
      }

      // Handle Enter - submit
      if (event.key === 'Enter') {
        event.preventDefault();
        handleSubmitSpell();
        return;
      }

      // Handle Backspace - remove last character
      if (event.key === 'Backspace') {
        event.preventDefault();
        setGuess(currentGuessRef.current.slice(0, -1));
        return;
      }

      // Handle character keys - add to guess
      // key.length === 1 means it's a printable character (letter, number, space, etc.)
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setGuess(currentGuessRef.current + event.key.toUpperCase());
        // Also focus the input for future keystrokes
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [inDuel, prompt, hasSubmitted, handleSubmitSpell, setGuess]);

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
            if (!prompt) {
              return;
            }
            // Ensure input is focused
            if (inputRef.current && document.activeElement !== inputRef.current) {
              inputRef.current.focus();
            }
            // Handle Enter: submit if not mid-composition
            if (event.key === 'Enter') {
              // Skip if in IME composition mode
              if (event.nativeEvent.isComposing) return;
              event.preventDefault();
              event.stopPropagation();
              handleSubmitSpell();
            }
          }}
          inputRef={inputRef}
          onLeaveDuel={() => {
            leaveLobby();
            setCurrentScreen('landing');
          }}
        />
      ) : (
        <EntryPage
          error={error}
          onClearError={clearError}
          showEntryForm={!lobby}
          playerName={playerName}
          onPlayerNameChange={setPlayerName}
          roomCodeInput={roomCodeInput}
          onRoomCodeChange={setRoomCodeInput}
          onOpenHostSettings={handleOpenHostSettings}
          onJoin={handleJoin}
          entryDisabled={status !== 'connected'}
        />
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

