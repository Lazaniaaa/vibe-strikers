// Offline bot AI: roam the nav grid, spot enemies with line-of-sight rays, turn, and shoot in bursts.
// It only writes a PlayerIntent, exactly like a human client (server authority stays the same).
import { BOTS } from '../config/bots.ts';
import { HITBOXES } from '../config/hitboxes.ts';
import type { Actor } from './actor.ts';
import { lineOfSight, type AabbBox } from './hitscan.ts';
import { angleDelta, DEG, pitchTo, vec3, yawTo, type Vec3 } from './math.ts';
import { findPath, groundAt, nearestWalkable, nodeX, nodeZ, type NavGrid } from './navGrid.ts';

export interface BotWorld {
  actors: readonly Actor[];
  blockers: readonly AabbBox[];
  nav: NavGrid;
  /** Roam goals (zone centres, enemy spawns). */
  goals: readonly Vec3[];
  random: () => number;
  /** A* searches still allowed this tick (the simulation resets it every tick). */
  pathBudget: number;
}

export interface BotBrain {
  thinkLeft: number;
  targetId: number;
  targetVisible: boolean;
  lastSeen: Vec3;
  memoryLeft: number;
  reactionLeft: number;
  aimHead: boolean;
  aimErrYaw: number;
  aimErrPitch: number;
  burstLeft: number;
  pauseLeft: number;
  strafeSign: number;
  strafeLeft: number;
  path: number[];
  pathIndex: number;
  goalCell: number;
  repathLeft: number;
  stuckLeft: number;
  stuckX: number;
  stuckZ: number;
  jumpLeft: number;
}

export function createBrain(): BotBrain {
  return { thinkLeft: 0, targetId: -1, targetVisible: false, lastSeen: vec3(), memoryLeft: 0, reactionLeft: 0,
    aimHead: false, aimErrYaw: 0, aimErrPitch: 0, burstLeft: 0, pauseLeft: 0, strafeSign: 1, strafeLeft: 0,
    path: [], pathIndex: 0, goalCell: -1, repathLeft: 0, stuckLeft: BOTS.stuckTime, stuckX: 0, stuckZ: 0, jumpLeft: 0 };
}

/** Forget everything (new round). */
export function resetBrain(b: BotBrain): void {
  b.thinkLeft = 0; b.targetId = -1; b.targetVisible = false; b.memoryLeft = 0; b.burstLeft = 0; b.pauseLeft = 0;
  b.path.length = 0; b.pathIndex = 0; b.goalCell = -1; b.repathLeft = 0; b.stuckLeft = BOTS.stuckTime; b.jumpLeft = 0;
}

const eye = vec3(), aimPoint = vec3(), dirScratch = vec3();

function eyeOf(a: Actor, out: Vec3): Vec3 { out.x = a.x; out.y = a.y + a.eyeHeight; out.z = a.z; return out; }

function aimPointOf(a: Actor, head: boolean, out: Vec3): Vec3 {
  const k = a.crouching ? HITBOXES.crouchScale : 1;
  out.x = a.x; out.z = a.z;
  out.y = a.y + (head ? HITBOXES.head.cy : HITBOXES.body.cy + HITBOXES.body.h * 0.25) * k;
  return out;
}

function rand(w: BotWorld, min: number, max: number): number { return min + (max - min) * w.random(); }

function canSee(self: Actor, other: Actor, w: BotWorld, requireFov: boolean): boolean {
  const dx = other.x - self.x, dz = other.z - self.z;
  const dist = Math.hypot(dx, dz);
  if (dist > BOTS.visionRange) return false;
  if (requireFov && dist > 2) {
    const off = Math.abs(angleDelta(self.yaw, yawTo(dx, dz)));
    if (off > (BOTS.visionFovDeg / 2) * DEG) return false;
  }
  eyeOf(self, eye);
  // Visible if the head or the chest can be seen.
  return lineOfSight(eye, aimPointOf(other, true, aimPoint), w.blockers, dirScratch)
    || lineOfSight(eye, aimPointOf(other, false, aimPoint), w.blockers, dirScratch);
}

function think(self: Actor, b: BotBrain, w: BotWorld): void {
  let best: Actor | null = null, bestDist = Infinity;
  for (const other of w.actors) {
    if (!other.alive || other.team === self.team) continue;
    // Keep tracking the current target or whoever just shot us even outside the FOV.
    const tracked = other.id === b.targetId || (other.id === self.lastAttacker && self.sinceDamage < 1);
    if (!canSee(self, other, w, !tracked)) continue;
    const d = Math.hypot(other.x - self.x, other.z - self.z);
    if (d < bestDist) { bestDist = d; best = other; }
  }
  if (best) {
    if (best.id !== b.targetId || !b.targetVisible) {
      b.reactionLeft = rand(w, BOTS.reactionTimeMin, BOTS.reactionTimeMax);
      b.aimHead = w.random() < BOTS.headAimChance;
      b.aimErrYaw = rand(w, -1, 1) * BOTS.aimErrorDeg * DEG;
      b.aimErrPitch = rand(w, -1, 1) * BOTS.aimErrorDeg * DEG * 0.5;
    }
    b.targetId = best.id; b.targetVisible = true;
    b.lastSeen.x = best.x; b.lastSeen.y = best.y; b.lastSeen.z = best.z;
    b.memoryLeft = BOTS.memoryTime;
  } else {
    b.targetVisible = false;
  }
}

function turnToward(current: number, target: number, maxStep: number): number {
  const d = angleDelta(current, target);
  return current + Math.max(-maxStep, Math.min(maxStep, d));
}

function setGoal(b: BotBrain, w: BotWorld, x: number, y: number, z: number): void {
  const cell = nearestWalkable(w.nav, x, y, z);
  if (cell !== b.goalCell) { b.goalCell = cell; b.repathLeft = 0; }
}

function pickRoamGoal(self: Actor, b: BotBrain, w: BotWorld): void {
  const g = w.goals[Math.floor(w.random() * w.goals.length) % w.goals.length];
  setGoal(b, w, g.x, g.y, g.z);
  void self;
}

/** Writes the bot's intent for this step. */
export function updateBot(self: Actor, b: BotBrain, w: BotWorld, dt: number): void {
  const intent = self.intent;
  intent.fire = false; intent.reload = false; intent.jump = false; intent.crouch = false; intent.walk = false; intent.slot = -1;
  intent.forward = 0; intent.right = 0;
  if (!self.alive) return;

  b.thinkLeft -= dt;
  if (b.thinkLeft <= 0) { b.thinkLeft = BOTS.thinkInterval; think(self, b, w); }
  b.memoryLeft -= dt;

  const slot = self.slots[self.active];
  const turn = BOTS.turnRateDeg * DEG * dt;
  let target: Actor | null = null;
  if (b.targetVisible) for (const a of w.actors) if (a.id === b.targetId) { target = a.alive ? a : null; break; }
  if (!target) b.targetVisible = false;

  // Movement direction in world space (0 = stand).
  let moveX = 0, moveZ = 0;

  if (target) {
    eyeOf(self, eye); aimPointOf(target, b.aimHead, aimPoint);
    const dx = aimPoint.x - eye.x, dy = aimPoint.y - eye.y, dz = aimPoint.z - eye.z;
    const wantYaw = yawTo(dx, dz) + b.aimErrYaw, wantPitch = pitchTo(dx, dy, dz) + b.aimErrPitch;
    intent.yaw = turnToward(self.yaw, wantYaw, turn);
    intent.pitch = self.pitch + Math.max(-turn, Math.min(turn, wantPitch - self.pitch));
    const err = Math.hypot(angleDelta(intent.yaw, wantYaw), intent.pitch - wantPitch);
    b.reactionLeft -= dt;
    if (b.pauseLeft > 0) b.pauseLeft -= dt;
    if (b.reactionLeft <= 0 && b.pauseLeft <= 0 && err < BOTS.fireConeDeg * DEG && slot.mag > 0) {
      if (b.burstLeft <= 0) b.burstLeft = Math.round(rand(w, BOTS.burstMin, BOTS.burstMax)) * slot.stats.fireInterval;
      intent.fire = slot.stats.automatic ? true : !self.fireLatch;
      b.burstLeft -= dt;
      if (b.burstLeft <= 0) b.pauseLeft = BOTS.burstPause;
    }
    if (slot.mag === 0) intent.reload = true;
    // Strafe while shooting.
    b.strafeLeft -= dt;
    if (b.strafeLeft <= 0) { b.strafeLeft = rand(w, 0.5, 1.3); b.strafeSign = w.random() < 0.5 ? -1 : 1; }
    intent.right = b.strafeSign; intent.walk = true;
    b.stuckLeft = BOTS.stuckTime; b.stuckX = self.x; b.stuckZ = self.z;
    return;
  }

  // No visible target: reload if low, then move to the last known position or a roam goal.
  if (slot.stats.magSize > 0 && slot.mag < slot.stats.magSize * 0.5) intent.reload = true;
  if (b.memoryLeft > 0) setGoal(b, w, b.lastSeen.x, b.lastSeen.y, b.lastSeen.z);
  else if (b.goalCell < 0 || (b.path.length > 0 && b.pathIndex >= b.path.length)) pickRoamGoal(self, b, w);

  b.repathLeft -= dt;
  if (b.repathLeft <= 0 && w.pathBudget > 0) {
    w.pathBudget--;
    b.repathLeft = BOTS.repathInterval;
    const start = nearestWalkable(w.nav, self.x, self.y, self.z);
    findPath(w.nav, start, b.goalCell, b.path);
    b.pathIndex = 0;
    if (b.path.length === 0 && b.memoryLeft <= 0) pickRoamGoal(self, b, w);
  }
  while (b.pathIndex < b.path.length) {
    const c = b.path[b.pathIndex];
    const wx = nodeX(w.nav, c), wz = nodeZ(w.nav, c);
    const d = Math.hypot(wx - self.x, wz - self.z);
    if (d < BOTS.waypointReach) { b.pathIndex++; continue; }
    moveX = (wx - self.x) / d; moveZ = (wz - self.z) / d;
    break;
  }
  if (b.pathIndex >= b.path.length && b.memoryLeft > 0) b.memoryLeft = 0; // reached last seen spot

  if (moveX !== 0 || moveZ !== 0) {
    intent.yaw = turnToward(self.yaw, yawTo(moveX, moveZ), turn);
    intent.pitch = self.pitch * 0.9;
    // Convert world direction to forward/right relative to the new yaw.
    const fx = -Math.sin(intent.yaw), fz = -Math.cos(intent.yaw);
    intent.forward = moveX * fx + moveZ * fz;
    intent.right = moveX * -fz + moveZ * fx;
    // Stuck detection.
    b.stuckLeft -= dt;
    if (b.stuckLeft <= 0) {
      const moved = Math.hypot(self.x - b.stuckX, self.z - b.stuckZ);
      if (moved < BOTS.stuckDistance) { intent.jump = true; pickRoamGoal(self, b, w); }
      b.stuckLeft = BOTS.stuckTime; b.stuckX = self.x; b.stuckZ = self.z;
    }
  } else {
    intent.yaw = self.yaw; intent.pitch = self.pitch;
  }
  if (Number.isNaN(groundAt(w.nav, self.x, self.y, self.z)) && b.path.length === 0) intent.forward = 1;
}
