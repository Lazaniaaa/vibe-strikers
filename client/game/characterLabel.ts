// Plain data module (no three.js) so the menu stays small.
import { characters } from '../../src/characters/characters';
import { characterDisplayName } from '../../src/config/characterNames';

/** Display name for a character. */
export function characterLabel(index: number): string {
  return characterDisplayName(characters[index % characters.length]);
}
