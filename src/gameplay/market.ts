// Marketplace catalog (GAME.md 6.7): every tradable item in the game. Rules without the catalog: marketRules.ts.
import { characters } from '../characters/characters.ts';
import { LOBBY_EMOTES } from '../characters/lobbyEmotes.ts';
import { characterDisplayName } from '../config/characterNames.ts';
import type { CatalogItem } from './marketRules.ts';
export * from './marketRules.ts';

export const CATALOG: readonly CatalogItem[] = [
  ...characters.map((c, index) => ({ ref: `character:${c.id}`, kind: 'character' as const, index, name: characterDisplayName(c) })),
  ...LOBBY_EMOTES.map((e, index) => ({ ref: `emote:${e.id}`, kind: 'emote' as const, index, name: e.name })),
];

const byRef = new Map(CATALOG.map((c) => [c.ref, c]));
export function catalogItem(ref: string): CatalogItem | undefined { return byRef.get(ref); }

