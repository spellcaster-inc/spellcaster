import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CountdownPayload,
  RoundRecapPayload,
  SpellPromptPayload,
} from '../../../shared/types/socket';

interface UseSpellInputArgs {
  prompt: SpellPromptPayload | null;
  inDuel: boolean;
  roundRecap: RoundRecapPayload | null;
  countdown: CountdownPayload | null;
  submitSpell: (guess: string, durationMs: number, promptId: string) => void;
  playSpellCastSfx: () => void;
  cleanupAudio: () => void;
  stopBrowserSpeech: () => void;
}

interface UseSpellInputResult {
  currentGuess: string;
  hasSubmitted: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  handleGuessChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmitSpell: () => void;
  showResultsPending: boolean;
}

export function useSpellInput({
  prompt,
  inDuel,
  roundRecap,
  countdown,
  submitSpell,
  playSpellCastSfx,
  cleanupAudio,
  stopBrowserSpeech,
}: UseSpellInputArgs): UseSpellInputResult {
  const [currentGuess, setCurrentGuess] = useState('');
  const currentGuessRef = useRef('');
  const [typingStartedAt, setTypingStartedAt] = useState<number | null>(null);

  // Sync setter that updates both ref (synchronous) and state (async)
  const setGuess = useCallback((next: string) => {
    currentGuessRef.current = next;
    setCurrentGuess(next);
  }, []);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const promptIdRef = useRef<string | null>(null);
  const promptReadyRef = useRef<boolean>(false);

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

  return {
    currentGuess,
    hasSubmitted,
    inputRef,
    handleGuessChange,
    handleSubmitSpell,
    showResultsPending,
  };
}
