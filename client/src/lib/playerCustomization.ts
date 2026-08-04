export const PLAYER_CUSTOMIZATION_STORAGE_KEY = 'spellcaster.playerCustomization';

export type PlayerCustomization = {
  nickname: string;
  wizardId: string;
};

export const DEFAULT_PLAYER_CUSTOMIZATION: PlayerCustomization = {
  nickname: 'WIZARD',
  wizardId: 'violet-warden',
};

const MAX_NICKNAME_LENGTH = 12;

const getBrowserStorage = (): Storage | undefined => {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

export const normalizePlayerCustomization = (value: unknown): PlayerCustomization => {
  if (!value || typeof value !== 'object') {
    return DEFAULT_PLAYER_CUSTOMIZATION;
  }

  const candidate = value as Partial<PlayerCustomization>;
  const nickname = typeof candidate.nickname === 'string'
    ? candidate.nickname.toUpperCase().slice(0, MAX_NICKNAME_LENGTH)
    : DEFAULT_PLAYER_CUSTOMIZATION.nickname;
  const wizardId = typeof candidate.wizardId === 'string' && candidate.wizardId
    ? candidate.wizardId
    : DEFAULT_PLAYER_CUSTOMIZATION.wizardId;

  return {
    nickname: nickname || DEFAULT_PLAYER_CUSTOMIZATION.nickname,
    wizardId,
  };
};

export const loadPlayerCustomization = (storage: Storage | undefined = getBrowserStorage()): PlayerCustomization => {
  if (!storage) {
    return DEFAULT_PLAYER_CUSTOMIZATION;
  }

  try {
    const rawValue = storage.getItem(PLAYER_CUSTOMIZATION_STORAGE_KEY);
    return rawValue ? normalizePlayerCustomization(JSON.parse(rawValue)) : DEFAULT_PLAYER_CUSTOMIZATION;
  } catch {
    return DEFAULT_PLAYER_CUSTOMIZATION;
  }
};

export const savePlayerCustomization = (
  customization: PlayerCustomization,
  storage: Storage | undefined = getBrowserStorage()
): void => {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      PLAYER_CUSTOMIZATION_STORAGE_KEY,
      JSON.stringify(normalizePlayerCustomization(customization))
    );
  } catch {
    // Storage may be unavailable in private browsing or restricted environments.
  }
};
