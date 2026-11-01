// Frame timing: worst frame in the last 5 s, and a log of long frames with a per-section breakdown.

export interface SectionTimes { sim: number; bots: number; motor: number; weapons: number; render: number; pose: number; poseMaxCall: number }

export interface LongFrame extends SectionTimes { at: number; frameMs: number }

const WINDOW_MS = 5000;
const LONG_FRAME_MS = 50;
const LOG_SIZE = 32;

export class FramePerf {
  /** Sections of the current frame, filled while it runs. */
  readonly now: SectionTimes = { sim: 0, bots: 0, motor: 0, weapons: 0, render: 0, pose: 0, poseMaxCall: 0 };
  /** Worst frame interval (ms) over the last 5 s. */
  worstMs = 0;
  /** Worst simulation time (ms) over the last 5 s. */
  worstSimMs = 0;
  readonly longFrames: LongFrame[] = [];
  private lastFrameAt = -1;
  private windowStart = 0;
  private windowWorst = 0;
  private windowWorstSim = 0;
  private prev: SectionTimes = { sim: 0, bots: 0, motor: 0, weapons: 0, render: 0, pose: 0, poseMaxCall: 0 };

  /** Call at the start of each frame (before the simulation). */
  beginFrame(t: number): void {
    if (this.lastFrameAt >= 0) {
      const frameMs = t - this.lastFrameAt;
      // The previous frame's sections explain a long interval ending now.
      if (frameMs > LONG_FRAME_MS) {
        const entry: LongFrame = { at: Math.round(t), frameMs: Math.round(frameMs), ...this.prev };
        if (this.longFrames.length >= LOG_SIZE) this.longFrames.shift();
        this.longFrames.push(entry);
      }
      if (frameMs > this.windowWorst) this.windowWorst = frameMs;
    }
    this.lastFrameAt = t;
    if (t - this.windowStart >= WINDOW_MS) {
      this.worstMs = this.windowWorst; this.worstSimMs = this.windowWorstSim;
      this.windowWorst = 0; this.windowWorstSim = 0; this.windowStart = t;
    }
    const n = this.now, p = this.prev;
    p.sim = n.sim; p.bots = n.bots; p.motor = n.motor; p.weapons = n.weapons; p.render = n.render; p.pose = n.pose; p.poseMaxCall = n.poseMaxCall;
    n.sim = 0; n.bots = 0; n.motor = 0; n.weapons = 0; n.render = 0; n.pose = 0; n.poseMaxCall = 0;
  }

  endSim(): void {
    if (this.now.sim > this.windowWorstSim) this.windowWorstSim = this.now.sim;
  }

  /** Worst values seen so far in the current window, shown until the window closes. */
  get displayWorstMs(): number { return Math.max(this.worstMs, this.windowWorst); }
  get displayWorstSimMs(): number { return Math.max(this.worstSimMs, this.windowWorstSim); }
}
