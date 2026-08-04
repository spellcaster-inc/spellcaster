import { describe, expect, it, vi } from 'vitest';
import { blockSpellInputPaste, SPELL_PASTE_BLOCKED_MESSAGE } from '../src/lib/spellInputPaste';

describe('spell input paste handling', () => {
  it('prevents clipboard insertion into the live spell input', () => {
    const preventDefault = vi.fn();

    blockSpellInputPaste({ preventDefault });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(SPELL_PASTE_BLOCKED_MESSAGE).toBe('Paste is disabled—type the spell yourself.');
  });
});
