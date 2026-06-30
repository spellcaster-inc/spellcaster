import spellAudioManifest from '../../../shared/spellAudioManifest.json';
import { SERVER_URL } from './config';
import type { SpellAudioManifest, SpellAudioTier } from '../types/audio';

const SPELL_AUDIO_MANIFEST = spellAudioManifest as SpellAudioManifest;
const SPELL_AUDIO_TIERS: SpellAudioTier[] = ['easy', 'medium', 'hard'];

export function buildSpellAudioLookup(): Map<string, string> {
  const lookup = new Map<string, string>();
  SPELL_AUDIO_TIERS.forEach((tier) => {
    SPELL_AUDIO_MANIFEST[tier].forEach(({ spell, file }) => {
      lookup.set(spell.trim().toUpperCase(), file);
    });
  });
  return lookup;
}

export function resolveSpellAudioUrl(lookup: Map<string, string>, spellText: string): string | null {
  if (!spellText) {
    return null;
  }
  const raw = lookup.get(spellText.trim().toUpperCase());
  if (!raw) {
    return null;
  }
  // If the URL is relative (starts with /audio/...), prefix with the server origin
  if (raw.startsWith('/')) {
    return `${SERVER_URL}${raw}`;
  }
  return raw;
}
