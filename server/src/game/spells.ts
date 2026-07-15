import { SpellDifficulty } from '../../../shared/types/socket';
import spellCatalog from './spellCatalog.json';
import { loadSpellAudioLookup } from './spellAudio';

export interface SpellDefinition {
  id: string;
  text: string;
  difficulty: SpellDifficulty;
  audioUrl?: string;
}

type CatalogDifficulty = Exclude<SpellDifficulty, 'custom'>;
type SpellDictionary = Record<CatalogDifficulty, SpellDefinition[]>;
type SpellCatalog = Record<CatalogDifficulty, string[]> & { _comment?: string };

const audioLookup = loadSpellAudioLookup();

const DIFFICULTY_PREFIX: Record<CatalogDifficulty, string> = {
  easy: 'e',
  medium: 'm',
  hard: 'h',
};

function normalizeSpell(text: string) {
  return text.trim().toUpperCase();
}

function getFallbackAudioUrl(difficulty: CatalogDifficulty, index: number) {
  const id = String(index + 1).padStart(3, '0');
  return `/audio/spells/${difficulty}/${DIFFICULTY_PREFIX[difficulty]}${id}.mp3`;
}

const createSpellList = (difficulty: SpellDifficulty, incantations: string[]): SpellDefinition[] =>
  incantations.map((text, index) => {
    if (difficulty === 'custom') {
      return {
        id: `${difficulty}-${index}`,
        text,
        difficulty,
      };
    }

    const catalogDifficulty = difficulty as CatalogDifficulty;
    const audioUrl = audioLookup.get(normalizeSpell(text)) ?? getFallbackAudioUrl(catalogDifficulty, index);
    return {
      id: `${difficulty}-${index}`,
      text,
      difficulty,
      audioUrl,
    };
  });

const spellWords = spellCatalog as SpellCatalog;

const spellData: SpellDictionary = {
  easy: createSpellList('easy', spellWords.easy),
  medium: createSpellList('medium', spellWords.medium),
  hard: createSpellList('hard', spellWords.hard),
};

export function getSpellPool(difficulty: SpellDifficulty, customWords?: string[]): SpellDefinition[] {
  if (difficulty === 'custom') {
    return createSpellList('custom', customWords ?? []);
  }
  return spellData[difficulty];
}

export function buildSpellQueue(
  rounds: number,
  difficulty: SpellDifficulty,
  customWords?: string[]
): SpellDefinition[] {
  const sourcePool = getSpellPool(difficulty, customWords);
  const pool = sourcePool.length > 0 ? [...sourcePool] : [...getSpellPool('medium')];
  const queue: SpellDefinition[] = [];

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  while (queue.length < rounds) {
    const next = pool[queue.length % pool.length];
    queue.push({
      ...next,
      id: `${next.id}-${queue.length}`,
    });
  }

  return queue.slice(0, rounds);
}

