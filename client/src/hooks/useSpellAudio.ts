import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { GameSummary, Player, SpellPromptPayload } from '../../../shared/types/socket';
import {
  buildSpellAudioLookup,
  resolveSpellAudioUrl as resolveSpellAudioUrlFromManifest,
} from '../lib/spellAudio';

interface UseSpellAudioArgs {
  prompt: SpellPromptPayload | null;
  summary: GameSummary | null;
  localPlayer: Player | null;
  shouldUseBrowserTts: boolean;
}

interface UseSpellAudioResult {
  playSpellCastSfx: () => void;
  cleanupAudio: () => void;
  stopBrowserSpeech: () => void;
}

export function useSpellAudio({
  prompt,
  summary,
  localPlayer,
  shouldUseBrowserTts,
}: UseSpellAudioArgs): UseSpellAudioResult {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const victorySfxRef = useRef<HTMLAudioElement | null>(null);
  const lossSfxRef = useRef<HTMLAudioElement | null>(null);
  const browserSpeechRef = useRef<SpeechSynthesisUtterance | null>(null);

  const spellAudioLookup = useMemo(() => buildSpellAudioLookup(), []);

  const resolveSpellAudioUrl = useCallback(
    (spellText: string) => resolveSpellAudioUrlFromManifest(spellAudioLookup, spellText),
    [spellAudioLookup]
  );

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

  return { playSpellCastSfx, cleanupAudio, stopBrowserSpeech };
}
