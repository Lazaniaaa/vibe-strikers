// Game modes (GAME.md 2): Elimination (rounds, teams) and Cornucopia (one life per match, loot on pedestals,
// teams or free-for-all). Pure; shared by the server and the offline simulation.
import { CORNUCOPIA } from '../config/items.ts';
import { MATCH, ROUND_PRESETS, type RoundPreset } from '../config/rounds.ts';
import type { LootKind } from '../config/items.ts';
import type { WeaponId } from '../weapons/types.ts';
import { tickRound, type RoundEvent, type RoundState, type TeamId } from './round.ts';

export type GameMode = 'elimination' | 'cornucopia';
export const GAME_MODES: readonly GameMode[] = ['elimination', 'cornucopia'];

export function presetFor(mode: GameMode): RoundPreset {
  return mode === 'cornucopia' ? ROUND_PRESETS.cornucopia : ROUND_PRESETS[MATCH.preset];
}

/** Free-for-all: every player is its own "team" ('F1', 'F2', ...); team modes use 'A' / 'B'. */
export function ffaTeam(index: number): TeamId { return `F${index}` as TeamId; }
export function isFfaTeam(team: string): boolean { return team.startsWith('F'); }

export interface ModePlayer { team: string; alive: boolean; hp: number }

/**
 * Advance the round for any mode. Team modes use the Elimination state machine (Cornucopia = one round per match).
 * Free-for-all: the last player alive wins the match (timeout: most HP; tie = draw). lastWinner / matchWinner then
 * hold the winner's team id ('F3'), matchWinner null = draw.
 */
export function tickModeRound(state: RoundState, preset: RoundPreset, dt: number, players: Iterable<ModePlayer>, ffa: boolean): RoundEvent {
  if (!ffa) {
    let aliveA = 0, aliveB = 0, hpA = 0, hpB = 0;
    for (const p of players) if (p.alive) { if (p.team === 'A') { aliveA++; hpA += p.hp; } else { aliveB++; hpB += p.hp; } }
    return tickRound(state, preset, dt, { aliveA, aliveB, hpA, hpB });
  }
  if (state.phase !== 'live') return tickRound(state, preset, dt, { aliveA: 1, aliveB: 1, hpA: 0, hpB: 0 });
  state.timeLeft -= dt;
  let alive = 0, last = '', best = '', bestHp = -1, tie = false;
  for (const p of players) {
    if (!p.alive) continue;
    alive++; last = p.team;
    if (p.hp > bestHp) { bestHp = p.hp; best = p.team; tie = false; } else if (p.hp === bestHp) tie = true;
  }
  if (alive > 1 && state.timeLeft > 0) return 'none';
  const winner = alive === 1 ? last : alive === 0 || tie ? '' : best;
  state.lastWinner = (winner || 'draw') as TeamId | 'draw';
  state.matchWinner = (winner || null) as TeamId | null;
  state.phase = 'matchEnd'; state.timeLeft = Infinity;
  return 'matchEnd';
}

/** One loot item: kind + weapon (for 'weapon'), on a lootSpot. */
export interface LootItem { kind: LootKind; weapon: WeaponId | ''; x: number; y: number; z: number }

/** Loot for a new Cornucopia match: each tier's spots get the tier's items in turn (CORNUCOPIA.loot). */
export function lootPlan(spots: readonly { x: number; y: number; z: number; tier: 'low' | 'mid' | 'high' }[]): LootItem[] {
  const next = { low: 0, mid: 0, high: 0 };
  return spots.map((s) => {
    const list = CORNUCOPIA.loot[s.tier];
    const what = list[next[s.tier]++ % list.length];
    const kind: LootKind = what === 'ammo' || what === 'medkit' || what === 'boots' ? what : 'weapon';
    return { kind, weapon: kind === 'weapon' ? (what as WeaponId) : '', x: s.x, y: s.y, z: s.z };
  });
}
