import React, { useEffect, useMemo, useState } from 'react';
import LandingPage from './pages/LandingPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import { useSocketConnection } from './hooks/useSocketConnection';
import { useLobby } from './hooks/useLobby';
import { useCountdownTimer } from './hooks/useCountdownTimer';
import { useSpellAudio } from './hooks/useSpellAudio';
import { useSpellInput } from './hooks/useSpellInput';
import { GameSummaryCard } from './components/GameSummaryCard';
import { HostSettingsModal } from './components/HostSettingsModal';
import type { GameSettings } from '../../shared/types/socket';
import { DEFAULT_SETTINGS } from './lib/constants';

const CREATE_LOBBY_TIMEOUT_MS = 10_000;

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
    isCreatePending,
    createLobby,
    cancelPendingCreate,
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
  const [currentScreen, setCurrentScreen] = useState<'landing' | 'game'>('landing');
  const countdownValue = useCountdownTimer(countdown);
  const [hostSettingsModalOpen, setHostSettingsModalOpen] = useState(false);
  const [hostSettings, setHostSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const inLobby = Boolean(lobby && lobby.phase === 'lobby');
  const inDuel = Boolean(lobby && lobby.phase === 'in-duel');
  const { playSpellCastSfx, cleanupAudio, stopBrowserSpeech } = useSpellAudio({
    prompt,
    summary,
    localPlayer,
  });
  const {
    currentGuess,
    hasSubmitted,
    inputRef,
    handleGuessChange,
    handleSubmitSpell,
    showResultsPending,
  } = useSpellInput({
    prompt,
    inDuel,
    roundRecap,
    countdown,
    submitSpell,
    playSpellCastSfx,
    cleanupAudio,
    stopBrowserSpeech,
  });

  const handleLandingHostGame = (nickname: string, wizardId: string) => {
    const safeName = nickname.trim() || 'WIZARD';
    setPlayerName(safeName);
    setPlayerWizardId(wizardId);
    handleOpenHostSettings();
  };

  const handleLandingJoinGame = (nickname: string, joinCode: string, wizardId: string) => {
    const safeName = nickname.trim() || 'WIZARD';
    const code = joinCode.trim().toUpperCase();

    setPlayerName(safeName);
    setPlayerWizardId(wizardId);
    joinLobby(code, safeName, wizardId);
  };

  useEffect(() => {
    if (hostSettingsModalOpen && lobby) {
      setHostSettingsModalOpen(false);
    }
  }, [hostSettingsModalOpen, lobby]);

  useEffect(() => {
    if (lobby && currentScreen === 'landing') {
      setCurrentScreen('game');
      clearError();
    }
    if (!lobby && currentScreen === 'game') {
      setCurrentScreen('landing');
    }
  }, [lobby, currentScreen, clearError]);

  useEffect(() => {
    if (!isCreatePending) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      cancelPendingCreate("Couldn't create lobby. Check your connection and try again.");
    }, CREATE_LOBBY_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [isCreatePending, cancelPendingCreate]);

  const activePlayers = useMemo(() => duel?.players ?? lobby?.players ?? [], [duel, lobby]);
  const hostSettingsReadyForConfirm =
    status === 'connected' &&
    !isCreatePending &&
    (hostSettings.difficulty !== 'custom' || (hostSettings.customWords?.length ?? 0) > 0);

  const currentRoundNumber =
    countdown?.roundNumber ?? prompt?.roundNumber ?? roundRecap?.roundNumber ?? duel?.round ?? 1;

  const handleReadyToggle = () => setReady(!localPlayer?.ready);
  const handleOpenHostSettings = () => {
    clearError();
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
    clearError();
    createLobby(playerName, hostSettings, playerWizardId);
  };
  const handleCancelHostSettings = () => {
    if (isCreatePending) {
      return;
    }
    setHostSettingsModalOpen(false);
    clearError();
  };

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

  const leaveToLanding = () => {
    leaveLobby();
    setCurrentScreen('landing');
  };

  const renderMainScreen = () => {
    if (currentScreen === 'landing') {
      return (
        <LandingPage
          onHostGame={handleLandingHostGame}
          onJoinGame={handleLandingJoinGame}
          serverError={hostSettingsModalOpen ? null : error}
          onClearError={clearError}
        />
      );
    }

    if (inLobby && lobby) {
      return (
        <LobbyPage
          lobby={lobby}
          localPlayer={localPlayer}
          onReadyToggle={handleReadyToggle}
          onStartDuel={startDuel}
          onLeaveLobby={leaveToLanding}
        />
      );
    }

    if (inDuel && duel) {
      return (
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
            if (inputRef.current && document.activeElement !== inputRef.current) {
              inputRef.current.focus();
            }
            if (event.key === 'Enter') {
              if (event.nativeEvent.isComposing) return;
              event.preventDefault();
              event.stopPropagation();
              handleSubmitSpell();
            }
          }}
          inputRef={inputRef}
          onLeaveDuel={leaveToLanding}
        />
      );
    }

    if (lobby) {
      return (
        <LobbyPage
          lobby={lobby}
          localPlayer={localPlayer}
          onReadyToggle={handleReadyToggle}
          onStartDuel={startDuel}
          onLeaveLobby={leaveToLanding}
        />
      );
    }

    return (
      <LandingPage
        onHostGame={handleLandingHostGame}
        onJoinGame={handleLandingJoinGame}
        serverError={error}
        onClearError={clearError}
      />
    );
  };

  return (
    <>
      {renderMainScreen()}

      <HostSettingsModal
        open={hostSettingsModalOpen && !lobby}
        settings={hostSettings}
        onChange={handleHostSettingsChange}
        onCancel={handleCancelHostSettings}
        onConfirm={handleConfirmHostSettings}
        confirmDisabled={!hostSettingsReadyForConfirm}
        isCreating={isCreatePending}
        error={hostSettingsModalOpen ? error : null}
        onClearError={clearError}
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
