// Elimination round state machine (GAME.md 2.1). Pure; the server will own it in M2.
import type { RoundPreset } from '../config/rounds.ts';

export type RoundPhase = 'freeze' | 'live' | 'roundEnd' | 'matchEnd';
export type TeamId = 'A' | 'B';
export type RoundWinner = TeamId | 'draw' | null;

export interface RoundState {
  phase: RoundPhase;
  /** Seconds left in the current phase. */
  timeLeft: number;
  /** 1-based round number. */
  round: number;
  scoreA: number;
  scoreB: number;
  lastWinner: RoundWinner;
  matchWinner: TeamId | null;
}

export interface TeamStatus { aliveA: number; aliveB: number; hpA: number; hpB: number }

export type RoundEvent = 'none' | 'roundStart' | 'live' | 'roundEnd' | 'matchEnd';

export function createRoundState(preset: RoundPreset): RoundState {
  return { phase: 'freeze', timeLeft: preset.freezeTime, round: 1, scoreA: 0, scoreB: 0, lastWinner: null, matchWinner: null };
}

function endRound(state: RoundState, preset: RoundPreset, winner: RoundWinner): RoundEvent {
  state.lastWinner = winner;
  if (winner === 'A') state.scoreA++;
  if (winner === 'B') state.scoreB++;
  if (state.scoreA >= preset.winsToMatch || state.scoreB >= preset.winsToMatch) {
    state.matchWinner = state.scoreA >= preset.winsToMatch ? 'A' : 'B';
    state.phase = 'matchEnd'; state.timeLeft = Infinity;
    return 'matchEnd';
  }
  state.phase = 'roundEnd'; state.timeLeft = preset.roundEndTime;
  return 'roundEnd';
}

/** Advance the round. The caller respawns everyone on 'roundStart'. */
export function tickRound(state: RoundState, preset: RoundPreset, dt: number, teams: TeamStatus): RoundEvent {
  if (state.phase === 'matchEnd') return 'none';
  state.timeLeft -= dt;
  if (state.phase === 'freeze') {
    if (state.timeLeft <= 0) { state.phase = 'live'; state.timeLeft = preset.roundTime; return 'live'; }
    return 'none';
  }
  if (state.phase === 'live') {
    if (teams.aliveA === 0 && teams.aliveB === 0) return endRound(state, preset, 'draw');
    if (teams.aliveB === 0) return endRound(state, preset, 'A');
    if (teams.aliveA === 0) return endRound(state, preset, 'B');
    if (state.timeLeft <= 0) {
      // Timeout: larger total HP of living players wins; tie = draw.
      const winner: RoundWinner = teams.hpA > teams.hpB ? 'A' : teams.hpB > teams.hpA ? 'B' : 'draw';
      return endRound(state, preset, winner);
    }
    return 'none';
  }
  // roundEnd
  if (state.timeLeft <= 0) {
    state.round++; state.phase = 'freeze'; state.timeLeft = preset.freezeTime;
    return 'roundStart';
  }
  return 'none';
}

export function restartMatch(state: RoundState, preset: RoundPreset): void {
  state.phase = 'freeze'; state.timeLeft = preset.freezeTime; state.round = 1;
  state.scoreA = 0; state.scoreB = 0; state.lastWinner = null; state.matchWinner = null;
}
