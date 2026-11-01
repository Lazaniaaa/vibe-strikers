// HUD texts that depend on the game mode (Elimination / Cornucopia, teams / free-for-all). Shared by offline and online.
import { CORNUCOPIA } from '../config/items.ts';

export interface ModeHudInput {
  mode: string; ffa: boolean; phase: string; myTeam: string; lastWinner: string; matchWinner: string;
  /** Name of the player whose team id is given (free-for-all winner). */
  nameOfTeam: (team: string) => string;
  aliveA: number; aliveB: number; aliveAll: number; boots: boolean; healing: boolean;
}

/** Score line (top) for Cornucopia; '' = default team score line. */
export function cornucopiaScoreLine(m: ModeHudInput): string {
  if (m.mode !== 'cornucopia') return '';
  const alive = m.ffa ? `alive ${m.aliveAll}` : `alive ${m.aliveA} v ${m.aliveB}`;
  return `Cornucopia${m.ffa ? ' · free-for-all' : ' · teams'} · one life · ${alive}${m.boots ? ' · BOOTS' : ''}`;
}

/** Match / round end texts for Cornucopia (null = use the Elimination texts). */
export function cornucopiaEndText(m: ModeHudInput): { center: string; sub: string } | null {
  if (m.mode !== 'cornucopia' || (m.phase !== 'matchEnd' && m.phase !== 'roundEnd')) return null;
  const w = m.matchWinner || (m.lastWinner === 'draw' ? '' : m.lastWinner);
  if (!w) return { center: 'DRAW', sub: 'Nobody survived' };
  if (w === m.myTeam) return { center: 'VICTORY', sub: m.ffa ? 'Last one standing' : 'Last team standing' };
  return { center: 'DEFEAT', sub: m.ffa ? `${m.nameOfTeam(w)} survived` : 'The other team survived' };
}

export function healHint(healing: boolean): string { return healing ? `Healing… (medkit, ${CORNUCOPIA.medkitTime} s)` : ''; }
