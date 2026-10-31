import { characters } from '../../src/characters';

/** Short display name for a character ("vibe-vibers-bureau-8" -> "bureau-8"). */
export function characterLabel(index: number): string {
  return characters[index % characters.length].name.replace(/^vibe-vibers-/, '');
}
