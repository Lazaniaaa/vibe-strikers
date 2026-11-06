// Which banner a kill earns (GAME.md 6.10). Pure, no allocation: called from kill events, online and offline.
import { KILL_STREAK } from '../config/feedback.ts';

export class KillStreak {
  private round = -1;
  private roundKills = 0;
  private chain = 0;
  private lastMs = -Infinity;

  /** Count one kill by the local player; returns the banner text, or '' for none. */
  kill(nowMs: number, round: number, enemies: number): string {
    if (round !== this.round) { this.round = round; this.roundKills = 0; this.chain = 0; }
    this.chain = nowMs - this.lastMs <= KILL_STREAK.windowMs ? this.chain + 1 : 1;
    this.lastMs = nowMs;
    this.roundKills++;
    if (enemies >= KILL_STREAK.aceMinEnemies && this.roundKills >= enemies) return KILL_STREAK.aceLabel;
    const labels = KILL_STREAK.labels;
    return labels[Math.min(this.chain, labels.length - 1)];
  }
}
