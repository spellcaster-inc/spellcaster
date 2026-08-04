export const SPELL_PASTE_BLOCKED_MESSAGE = 'Paste is disabled—type the spell yourself.';

export function blockSpellInputPaste(event: Pick<ClipboardEvent, 'preventDefault'>): void {
  event.preventDefault();
}
