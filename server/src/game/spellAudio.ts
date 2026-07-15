import fs from 'fs';
import path from 'path';

type SpellAudioEntry = {
  spell: string;
  audioUrl: string;
};

type SpellAudioManifest = Record<'easy' | 'medium' | 'hard', SpellAudioEntry[]>;

const EMPTY_MANIFEST: SpellAudioManifest = {
  easy: [],
  medium: [],
  hard: [],
};

function getManifestPath() {
  const candidatePaths = [
    path.resolve(process.cwd(), 'server', 'data', 'spellAudioManifest.json'),
    path.resolve(process.cwd(), 'data', 'spellAudioManifest.json'),
    path.resolve(__dirname, '../../../../server/data/spellAudioManifest.json'),
    path.resolve(__dirname, '../../../data/spellAudioManifest.json'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidatePaths[0];
}

function normalizeSpell(spell: string) {
  return spell.trim().toUpperCase();
}

export function loadSpellAudioLookup(): Map<string, string> {
  const manifestPath = getManifestPath();
  if (!fs.existsSync(manifestPath)) {
    console.warn(`[audio] manifest not found at ${manifestPath}; using deterministic fallback URLs.`);
    return new Map();
  }

  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = (JSON.parse(raw) as SpellAudioManifest) ?? EMPTY_MANIFEST;
  const lookup = new Map<string, string>();

  (['easy', 'medium', 'hard'] as const).forEach((tier) => {
    manifest[tier]?.forEach((entry) => {
      if (!entry?.spell || !entry?.audioUrl) {
        return;
      }
      lookup.set(normalizeSpell(entry.spell), entry.audioUrl);
    });
  });

  return lookup;
}

