import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAYER_CUSTOMIZATION,
  loadPlayerCustomization,
  normalizePlayerCustomization,
  PLAYER_CUSTOMIZATION_STORAGE_KEY,
  savePlayerCustomization,
} from '../src/lib/playerCustomization';

const createStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
    key: (index) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
  };
};

describe('player customization persistence', () => {
  it('normalizes saved names and falls back for invalid values', () => {
    expect(normalizePlayerCustomization({ nickname: 'merlin the great', wizardId: 'azure-sage' })).toEqual({
      nickname: 'MERLIN THE G',
      wizardId: 'azure-sage',
    });
    expect(normalizePlayerCustomization({ nickname: '', wizardId: '' })).toEqual(DEFAULT_PLAYER_CUSTOMIZATION);
    expect(normalizePlayerCustomization(null)).toEqual(DEFAULT_PLAYER_CUSTOMIZATION);
  });

  it('preserves nickname and wizard when Landing remounts', () => {
    const storage = createStorage();

    savePlayerCustomization({ nickname: 'WIZARD', wizardId: 'crimson-aegis' }, storage);

    expect(loadPlayerCustomization(storage)).toEqual({
      nickname: 'WIZARD',
      wizardId: 'crimson-aegis',
    });
    expect(storage.getItem(PLAYER_CUSTOMIZATION_STORAGE_KEY)).not.toContain('joinCode');
  });

  it('falls back when stored JSON is malformed', () => {
    const storage = createStorage();
    storage.setItem(PLAYER_CUSTOMIZATION_STORAGE_KEY, '{not-json');

    expect(loadPlayerCustomization(storage)).toEqual(DEFAULT_PLAYER_CUSTOMIZATION);
  });
});
