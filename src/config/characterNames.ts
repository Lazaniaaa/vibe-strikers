// English display names of the characters (owner 2026-11-06). The asset folder keeps its own ids and names; the ids here
// are the stable keys. A character that is not listed shows its asset name without the collection prefix.
export const CHARACTER_NAMES: Readonly<Record<string, string>> = {
  'reference-01': 'Razzle',
  'vibe-vibers-bureau-8': 'Inkmitt',
  'vibe-vibers-viber-extra-12': 'Sandbones',
  'vibe-vibers-viber-142': 'Sunburn',
  'vibe-vibers-viber-extra-11': 'Gobbles',
  'vibe-vibers-bureau-25': 'Panama',
  'vibe-vibers-bureau-roll-22-11': 'Keytop',
  'vibe-vibers-bureau-roll-48-7': 'Mocha',
  'vibe-vibers-bureau-roll-7-11': 'Porkchop',
  'vibe-vibers-viber-32': 'Moth',
  'vibe-vibers-viber-10': 'Swampy',
  'vibe-vibers-viber-103': 'Biscuit',
  'vibe-vibers-viber-31': 'Hotrod',
  'vibe-vibers-viber-42': 'Tangerine',
  'vibe-vibers-viber-71': 'Cubby',
  'vibe-vibers-bureau-23': 'Goldie',
  'vibe-vibers-bureau-4': 'Vanilla',
  'vibe-vibers-bureau-roll-40-10': 'Denim',
  'vibe-vibers-viber-141': 'Foreman',
  'vibe-vibers-viber-48': 'Whirly',
  'vibe-vibers-bureau-24': 'Bandit',
  'vibe-vibers-bureau-roll-22-12': 'Parson',
  'vibe-vibers-viber-6': 'Antlers',
  'vibe-vibers-viber-63': 'Plum Punk',
  'vibe-vibers-viber-84': 'Skipper',
  'vibe-vibers-viber-extra-20': 'Flamecrest',
  'vibe-vibers-bureau-31': 'Glitch',
  'vibe-vibers-bureau-roll-9-5': 'Telly',
  'vibe-vibers-viber-123': 'Lilac',
  'vibe-vibers-viber-extra-19': 'Midnight',
  'vibe-vibers-viber-extra-15': 'Minty',
  'vibe-vibers-viber-extra-24': 'Cocoa',
  'vibe-vibers-viber-extra-9': 'Ranger',
};

/** Name shown to players. */
export function characterDisplayName(character: { id: string; name: string }): string {
  return CHARACTER_NAMES[character.id] ?? character.name.replace(/^vibe-vibers-/, '');
}
