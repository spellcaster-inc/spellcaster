export type SpellAudioTier = 'easy' | 'medium' | 'hard';
export type SpellAudioManifest = Record<SpellAudioTier, Array<{ spell: string; file: string }>>;
