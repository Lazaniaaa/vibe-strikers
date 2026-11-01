// Mutators (GAME.md 8): one optional rule change per room. Quick Play uses the mutator of the day (UTC date);
// private rooms and offline practice pick one or none in the menu.
export const MUTATOR_IDS = ['lowGravity', 'bigHeads', 'oneShot', 'fastRun', 'rocketBoots'] as const;
export type MutatorId = (typeof MUTATOR_IDS)[number];

export const MUTATORS = {
  lowGravity: { label: 'Low gravity', gravityScale: 0.45 },
  /** Head model AND head hit box x2 (the box grows upward from the neck). */
  bigHeads: { label: 'Big heads', headScale: 2 },
  /** Every hit kills. */
  oneShot: { label: 'One shot', damage: 1000 },
  fastRun: { label: 'Fast run', speedScale: 1.35 },
  /** Everyone has rocket boots (double jump) from the start. */
  rocketBoots: { label: 'Rocket boots' },
} as const;

export function isMutator(id: string): id is MutatorId { return (MUTATOR_IDS as readonly string[]).includes(id); }

/** Mutator of the day for Quick Play: cycles through the list by UTC day number. */
export function mutatorOfDay(utcMs: number): MutatorId {
  return MUTATOR_IDS[Math.floor(utcMs / 86_400_000) % MUTATOR_IDS.length];
}

export function mutatorLabel(id: string): string { return isMutator(id) ? MUTATORS[id].label : ''; }

/** Values used by gameplay code ('' = no mutator). */
export function mutatorRules(id: string): { gravityScale: number; headScale: number; oneShot: boolean; speedScale: number; boots: boolean } {
  return {
    gravityScale: id === 'lowGravity' ? MUTATORS.lowGravity.gravityScale : 1,
    headScale: id === 'bigHeads' ? MUTATORS.bigHeads.headScale : 1,
    oneShot: id === 'oneShot',
    speedScale: id === 'fastRun' ? MUTATORS.fastRun.speedScale : 1,
    boots: id === 'rocketBoots',
  };
}
