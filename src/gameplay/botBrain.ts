// Bot AI (offline and server): roam the multi-level nav graph along one of three routes, spot enemies with
// line-of-sight rays, turn and shoot in bursts; fight from cover (peek out, shoot, hide; hide to reload or when
// low on HP). It only writes a PlayerIntent, exactly like a human client (server authority stays the same).
import { BOT_LOADOUT, BOT_LOOT, BOT_ROLES, BOT_SKILLS, BOT_TACTICS, BOTS, DEFAULT_DIFFICULTY, type BotSkill } from '../config/bots.ts';
import type { WeaponId } from '../weapons/types.ts';
import { HITBOXES } from '../config/hitboxes.ts';
import type { Actor } from './actor.ts';
import { lineOfSight, type AabbBox } from './hitscan.ts';
import { angleDelta, DEG, pitchTo, vec3, yawTo, type Vec3 } from './math.ts';
import { findPath, groundAt, nearestWalkable, nodeX, nodeZ, type NavGrid } from './navGrid.ts';

export interface BotWorld {
  actors: readonly Actor[];
  blockers: readonly AabbBox[];
  nav: NavGrid;
  /** Roam goals (zone centres, enemy spawns, balconies). */
  goals: readonly Vec3[];
  /** Cover spots (see mapNav) and the three route goal lists; optional (empty = old roaming). */
  cover?: readonly Vec3[];
  routes?: readonly (readonly Vec3[])[];
  /** Sniper perches: balconies and long sight lines (see mapNav; yaw NaN = face the enemy spawn). */
  perches?: readonly (Vec3 & { yaw: number })[];
  /** Cornucopia: items on the ground (bots pick up loot, heal); undefined in Elimination. */
  items?: readonly { x: number; y: number; z: number; kind: string; weapon: string; pedestal?: boolean }[];
  /** Team spawn centres (bots aim for the enemy side). */
  spawns?: { A: Vec3; B: Vec3 };
  random: () => number;
  /** A* searches still allowed this tick (the simulation resets it every tick). */
  pathBudget: number;
}

type Phase = 'none' | 'expose' | 'hide';

export interface BotBrain {
  skill: BotSkill;
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
  /** Fight state: engaged since first sighting; cover + peek spot; expose / hide phase. */
  engaged: boolean;
  useCover: boolean;
  hasCover: boolean;
  cover: Vec3;
  peekSpot: Vec3;
  phase: Phase;
  phaseLeft: number;
  coverCheckLeft: number;
  /** HP was low at the last step (first time low -> hide at once). */
  wasLow: boolean;
  /** Sniper: the roam goal is a perch; seconds left to hold it after arriving. */
  atPerch: boolean;
  holdLeft: number;
  /** Direction to watch from the perch (NaN = toward the enemy spawn). */
  holdYaw: number;
}

/** Random bot primary (BOT_LOADOUT weights); no sniper when the team already has one. */
export function pickBotPrimary(random: () => number, sniperTaken: boolean): WeaponId {
  const w = BOT_LOADOUT.weights;
  let r = random() * (w.rifle + w.shotgun + (sniperTaken ? 0 : w.sniper));
  if ((r -= w.rifle) < 0) return 'rifle';
  if ((r -= w.shotgun) < 0 || sniperTaken) return 'shotgun';
  return 'sniper';
}

export function createBrain(skill: BotSkill = BOT_SKILLS[DEFAULT_DIFFICULTY]): BotBrain {
  return { skill, thinkLeft: 0, targetId: -1, targetVisible: false, lastSeen: vec3(), memoryLeft: 0, reactionLeft: 0,
    aimHead: false, aimErrYaw: 0, aimErrPitch: 0, burstLeft: 0, pauseLeft: 0, strafeSign: 1, strafeLeft: 0,
    path: [], pathIndex: 0, goalCell: -1, repathLeft: 0, stuckLeft: BOTS.stuckTime, stuckX: 0, stuckZ: 0, jumpLeft: 0,
    engaged: false, useCover: false, hasCover: false, cover: vec3(), peekSpot: vec3(), phase: 'none', phaseLeft: 0, coverCheckLeft: 0, wasLow: false,
    atPerch: false, holdLeft: 0, holdYaw: NaN };
}

/** Forget everything (new round). */
export function resetBrain(b: BotBrain): void {
  b.thinkLeft = 0; b.targetId = -1; b.targetVisible = false; b.memoryLeft = 0; b.burstLeft = 0; b.pauseLeft = 0;
  b.path.length = 0; b.pathIndex = 0; b.goalCell = -1; b.repathLeft = 0; b.stuckLeft = BOTS.stuckTime; b.jumpLeft = 0;
  b.engaged = false; b.hasCover = false; b.phase = 'none'; b.phaseLeft = 0; b.coverCheckLeft = 0; b.wasLow = false;
  b.atPerch = false; b.holdLeft = 0;
}

const eye = vec3(), aimPoint = vec3(), dirScratch = vec3(), threatEye = vec3(), probe = vec3();
const candD: number[] = [], candI: number[] = [];
const move = { x: 0, z: 0 };

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
      const s = b.skill;
      b.reactionLeft = rand(w, s.reactionTimeMin, s.reactionTimeMax);
      b.aimHead = w.random() < s.headAimChance;
      b.aimErrYaw = rand(w, -1, 1) * s.aimErrorDeg * DEG;
      b.aimErrPitch = rand(w, -1, 1) * s.aimErrorDeg * DEG * 0.5;
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

/** Roam: a point of this bot's route on the enemy side (bots spread over the three routes), else the enemy spawn. */
function pickRoamGoal(self: Actor, b: BotBrain, w: BotWorld): void {
  b.atPerch = false;
  // Snipers hold balconies and long sight lines that look toward the enemy side, not deep in enemy land.
  const perches = w.perches, sp = w.spawns;
  if (self.slots[0].stats.id === 'sniper' && perches && perches.length && sp && w.random() < BOT_ROLES.sniperPerchChance) {
    const enemy = self.team === 'A' ? sp.B : sp.A, home = self.team === 'A' ? sp.A : sp.B;
    let count = 0;
    for (let pass = 0; pass < 2; pass++) {
      let pick = Math.floor(w.random() * count);
      for (const p of perches) {
        if (Math.hypot(p.x - home.x, p.z - home.z) > Math.hypot(p.x - enemy.x, p.z - enemy.z) + 4) continue;
        if (!Number.isNaN(p.yaw)) {
          const ex = enemy.x - p.x, ez = enemy.z - p.z, len = Math.hypot(ex, ez) || 1;
          if ((-Math.sin(p.yaw) * ex - Math.cos(p.yaw) * ez) / len < BOT_ROLES.sniperFacingCos) continue;
        }
        if (pass === 0) { count++; continue; }
        if (pick-- > 0) continue;
        setGoal(b, w, p.x, p.y, p.z);
        b.atPerch = true; b.holdYaw = p.yaw; b.holdLeft = rand(w, BOT_ROLES.sniperHoldMin, BOT_ROLES.sniperHoldMax);
        return;
      }
      if (count === 0) break;
    }
  }
  const routes = w.routes, spawns = w.spawns;
  if (routes && routes.length && spawns) {
    const enemy = self.team === 'A' ? spawns.B : spawns.A, home = self.team === 'A' ? spawns.A : spawns.B;
    if (w.random() < BOT_TACTICS.routeGoalChance) {
      const list = routes[self.id % routes.length];
      // Prefer points closer to the enemy spawn than to ours.
      let pick = list[Math.floor(w.random() * list.length) % list.length];
      for (let tries = 0; tries < 4; tries++) {
        const p = list[Math.floor(w.random() * list.length) % list.length];
        if (Math.hypot(p.x - enemy.x, p.z - enemy.z) < Math.hypot(p.x - home.x, p.z - home.z)) { pick = p; break; }
      }
      setGoal(b, w, pick.x, pick.y, pick.z);
    } else setGoal(b, w, enemy.x, enemy.y, enemy.z);
    return;
  }
  const g = w.goals[Math.floor(w.random() * w.goals.length) % w.goals.length];
  setGoal(b, w, g.x, g.y, g.z);
}

/**
 * Nearest cover spot within `radius` that the threat (eye at `threatEye`) cannot see: at most coverCandidates
 * nearest spots get a line-of-sight check. Writes it into b.cover.
 */
function findCover(self: Actor, b: BotBrain, w: BotWorld, radius: number): boolean {
  const cover = w.cover;
  if (!cover || cover.length === 0) return false;
  const max = BOT_TACTICS.coverCandidates;
  candD.length = 0; candI.length = 0;
  for (let i = 0; i < cover.length; i++) {
    const c = cover[i], d = Math.hypot(c.x - self.x, c.z - self.z) + Math.abs(c.y - self.y) * 2;
    if (d > radius) continue;
    // Keep the `max` nearest, sorted (insertion into a tiny array).
    let k = candD.length;
    if (k >= max && d >= candD[k - 1]) continue;
    if (k >= max) { candD.pop(); candI.pop(); k--; }
    while (k > 0 && candD[k - 1] > d) k--;
    candD.splice(k, 0, d); candI.splice(k, 0, i);
  }
  for (const i of candI) {
    const c = cover[i];
    probe.x = c.x; probe.y = c.y + 1.0; probe.z = c.z;
    if (!lineOfSight(threatEye, probe, w.blockers, dirScratch)) {
      b.cover.x = c.x; b.cover.y = c.y; b.cover.z = c.z;
      return true;
    }
  }
  return false;
}

/** Follow the current path toward b.goalCell; writes the world move direction into `move` (0 = arrived). */
function followPath(self: Actor, b: BotBrain, w: BotWorld, dt: number): void {
  move.x = 0; move.z = 0;
  b.repathLeft -= dt;
  if (b.repathLeft <= 0 && w.pathBudget > 0) {
    w.pathBudget--;
    b.repathLeft = BOTS.repathInterval;
    const start = nearestWalkable(w.nav, self.x, self.y, self.z);
    findPath(w.nav, start, b.goalCell, b.path);
    b.pathIndex = 0;
  }
  while (b.pathIndex < b.path.length) {
    const c = b.path[b.pathIndex];
    const wx = nodeX(w.nav, c), wz = nodeZ(w.nav, c);
    const d = Math.hypot(wx - self.x, wz - self.z);
    if (d < BOTS.waypointReach) { b.pathIndex++; continue; }
    move.x = (wx - self.x) / d; move.z = (wz - self.z) / d;
    break;
  }
}

/** Turn the world move direction into forward/right relative to `yaw`. */
function steer(self: Actor, yaw: number): void {
  const intent = self.intent, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  intent.forward = move.x * fx + move.z * fz;
  intent.right = move.x * -fz + move.z * fx;
}

/** Cornucopia: the item this bot wants now (medkit when hurt, a weapon when it has none, ammo, sometimes the centre). */
function wantedItem(self: Actor, w: BotWorld): number {
  const items = w.items;
  if (!items || items.length === 0) return -1;
  const hurt = self.hp < BOT_LOOT.healBelow && self.healLeft <= 0;
  const needAmmo = !self.hasPrimary && self.slots[1].reserve < BOT_LOOT.ammoBelow;
  // About BOT_LOOT.centreChance of the bots (by id, deterministic) also go for the centre loot (sniper, boots).
  const greedy = ((self.id * 37) % 100) / 100 < BOT_LOOT.centreChance;
  let best = -1, bestD: number = BOT_LOOT.searchRadius;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const useful = it.kind === 'medkit' ? hurt
      : it.kind === 'weapon' ? !self.hasPrimary || (greedy && self.slots[0].stats.id !== 'sniper' && it.weapon === 'sniper')
      : it.kind === 'boots' ? !self.boots && (greedy || !self.hasPrimary)
      : it.kind === 'ammo' ? needAmmo : false;
    if (!useful) continue;
    const d = Math.hypot(it.x - self.x, it.z - self.z) + Math.abs(it.y - self.y) * 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** Writes the bot's intent for this step. */
export function updateBot(self: Actor, b: BotBrain, w: BotWorld, dt: number): void {
  const intent = self.intent, skill = b.skill;
  intent.fire = false; intent.reload = false; intent.aim = false; intent.use = false; intent.jump = false; intent.crouch = false; intent.walk = false; intent.slot = -1;
  intent.forward = 0; intent.right = 0;
  if (!self.alive) { b.engaged = false; return; }

  b.thinkLeft -= dt;
  if (b.thinkLeft <= 0) { b.thinkLeft = BOTS.thinkInterval; think(self, b, w); }
  b.memoryLeft -= dt;
  b.phaseLeft -= dt;

  const slot = self.slots[self.active];
  const turn = skill.turnRateDeg * DEG * dt;
  let target: Actor | null = null;
  if (b.targetVisible) for (const a of w.actors) if (a.id === b.targetId) { target = a.alive ? a : null; break; }
  if (!target) b.targetVisible = false;
  // Weapon: snipers draw the pistol up close; an empty primary -> pistol; otherwise the primary.
  const role = self.slots[0].stats.id, primary = self.slots[0];
  const dist = target ? Math.hypot(target.x - self.x, target.z - self.z) : Infinity;
  const primaryEmpty = !self.hasPrimary || (primary.stats.magSize > 0 && primary.mag + primary.reserve === 0);
  const pistol = self.slots[1], pistolEmpty = pistol.mag + pistol.reserve === 0;
  const wantSlot = primaryEmpty || (role === 'sniper' && dist < BOT_ROLES.sniperPistolRange) ? (primaryEmpty && pistolEmpty ? 2 : 1) : 0;
  if (self.active !== wantSlot) intent.slot = wantSlot;
  const sniping = self.active === 0 && role === 'sniper';
  intent.aim = sniping;
  // In a fight, a nearly empty magazine is reloaded in cover too.
  const needReload = slot.stats.magSize > 0 && (slot.mag === 0 || slot.reloadLeft > 0 ||
    (b.engaged && slot.mag < slot.stats.magSize * BOT_TACTICS.reloadInCoverBelow && slot.reserve > 0));
  const lowHp = self.hp <= BOT_TACTICS.lowHp;

  // Fight state: start an engagement at the first sighting (that spot is where the bot peeks from).
  if (target && !b.engaged) {
    // Cover + peek is for rifles; snipers stand and shoot scoped, shotguns push.
    b.engaged = true; b.useCover = role === 'rifle' && w.random() < skill.coverChance; b.hasCover = false; b.coverCheckLeft = 0;
    b.peekSpot.x = self.x; b.peekSpot.y = self.y; b.peekSpot.z = self.z;
    b.phase = 'expose'; b.phaseLeft = rand(w, BOT_TACTICS.exposeTimeMin, BOT_TACTICS.exposeTimeMax);
  }
  if (b.engaged && b.memoryLeft <= 0 && !target) { b.engaged = false; b.phase = 'none'; }
  if (b.engaged && b.useCover) {
    b.coverCheckLeft -= dt;
    if (b.coverCheckLeft <= 0) {
      b.coverCheckLeft = BOT_TACTICS.coverCheckInterval;
      // The threat: the target's eye now, or where it was last seen.
      if (target) eyeOf(target, threatEye);
      else { threatEye.x = b.lastSeen.x; threatEye.y = b.lastSeen.y + 1.6; threatEye.z = b.lastSeen.z; }
      b.hasCover = findCover(self, b, w, lowHp ? BOT_TACTICS.coverSearchRadius : BOT_TACTICS.peekCoverRadius);
    }
  }
  const fightingFromCover = b.engaged && b.useCover && b.hasCover;
  if (fightingFromCover) {
    // Hide to reload, and at once when HP first gets low; otherwise alternate: expose (shoot from the peek spot)
    // and hide. Low HP only makes the hiding longer (HP never comes back, so it must not hide forever).
    const hideTime = () => (lowHp ? BOT_TACTICS.lowHpHideTime : rand(w, BOT_TACTICS.hideTimeMin, BOT_TACTICS.hideTimeMax));
    if (needReload || (lowHp && !b.wasLow)) {
      if (b.phase !== 'hide') { b.phase = 'hide'; b.phaseLeft = hideTime(); }
    } else if (b.phaseLeft <= 0) {
      if (b.phase === 'expose') { b.phase = 'hide'; b.phaseLeft = hideTime(); }
      else { b.phase = 'expose'; b.phaseLeft = rand(w, BOT_TACTICS.exposeTimeMin, BOT_TACTICS.exposeTimeMax); }
    }
    if (b.phase === 'hide' && slot.stats.magSize > 0 && slot.mag < slot.stats.magSize) intent.reload = true;
  }
  b.wasLow = lowHp;

  if (target) {
    eyeOf(self, eye); aimPointOf(target, b.aimHead, aimPoint);
    const dx = aimPoint.x - eye.x, dy = aimPoint.y - eye.y, dz = aimPoint.z - eye.z;
    const wantYaw = yawTo(dx, dz) + b.aimErrYaw, wantPitch = pitchTo(dx, dy, dz) + b.aimErrPitch;
    intent.yaw = turnToward(self.yaw, wantYaw, turn);
    intent.pitch = self.pitch + Math.max(-turn, Math.min(turn, wantPitch - self.pitch));
    const err = Math.hypot(angleDelta(intent.yaw, wantYaw), intent.pitch - wantPitch);
    b.reactionLeft -= dt;
    if (b.pauseLeft > 0) b.pauseLeft -= dt;
    const inRange = !(self.active === 0 && role === 'shotgun' && dist > BOT_ROLES.shotgunFireRange);
    if (b.reactionLeft <= 0 && b.pauseLeft <= 0 && err < BOTS.fireConeDeg * DEG && slot.mag > 0 && inRange && self.equipLeft <= 0) {
      if (b.burstLeft <= 0) b.burstLeft = Math.round(rand(w, skill.burstMin, skill.burstMax)) * slot.stats.fireInterval;
      intent.fire = slot.stats.automatic ? true : !self.fireLatch;
      b.burstLeft -= dt;
      if (b.burstLeft <= 0) b.pauseLeft = skill.burstPause;
    }
    if (slot.mag === 0) intent.reload = true;
    b.stuckLeft = BOTS.stuckTime; b.stuckX = self.x; b.stuckZ = self.z;
    if (fightingFromCover) {
      // Move between the cover spot and the peek spot while aiming at the target.
      const spot = b.phase === 'hide' ? b.cover : b.peekSpot;
      setGoal(b, w, spot.x, spot.y, spot.z);
      followPath(self, b, w, dt);
      steer(self, intent.yaw);
      intent.walk = b.phase === 'expose';
      return;
    }
    // Sniper: stand still (scoped accuracy). Shotgun: push until close.
    if (sniping) return;
    const pushTo = self.active === 0 && role === 'shotgun' ? BOT_ROLES.shotgunPushRange : self.active === 2 ? BOT_ROLES.knifePushRange : Infinity;
    if (dist > pushTo) {
      setGoal(b, w, target.x, target.y, target.z);
      followPath(self, b, w, dt);
      steer(self, intent.yaw);
      return;
    }
    // No cover nearby: strafe in the open while shooting.
    b.strafeLeft -= dt;
    if (b.strafeLeft <= 0) { b.strafeLeft = rand(w, 0.5, 1.3); b.strafeSign = w.random() < 0.5 ? -1 : 1; }
    intent.right = b.strafeSign; intent.walk = true;
    return;
  }

  // No visible target.
  if (slot.stats.magSize > 0 && slot.mag < slot.stats.magSize * 0.5) intent.reload = true;
  const want = !fightingFromCover && b.memoryLeft <= 0 ? wantedItem(self, w) : -1;
  if (want >= 0) {
    const it = w.items![want];
    if (Math.hypot(it.x - self.x, it.z - self.z) < BOTS.waypointReach * 2 && Math.abs(it.y - self.y) < 1.2) {
      intent.use = true; // E: pick up / use (the simulation checks the range)
      intent.yaw = self.yaw; intent.pitch = self.pitch;
      return;
    }
    b.atPerch = false;
    setGoal(b, w, it.x, it.y, it.z);
  } else if (fightingFromCover) {
    // Wait in cover (reload / hurt), then peek again from the peek spot.
    const spot = b.phase === 'hide' ? b.cover : b.peekSpot;
    setGoal(b, w, spot.x, spot.y, spot.z);
    if (b.phase === 'expose' && Math.hypot(self.x - b.peekSpot.x, self.z - b.peekSpot.z) < BOTS.waypointReach) {
      // Peeked and the enemy is gone: chase the last seen position instead.
      b.engaged = false; b.phase = 'none';
    }
  } else if (b.memoryLeft > 0 && !b.atPerch) setGoal(b, w, b.lastSeen.x, b.lastSeen.y, b.lastSeen.z); // snipers keep their perch
  else if (b.goalCell < 0 || (b.path.length > 0 && b.pathIndex >= b.path.length)) {
    // A sniper on its perch holds it for a while, looking toward the enemy side.
    if (b.atPerch && b.holdLeft > 0) {
      b.holdLeft -= dt;
      const enemy = w.spawns ? (self.team === 'A' ? w.spawns.B : w.spawns.A) : null;
      const look = !Number.isNaN(b.holdYaw) ? b.holdYaw : enemy ? yawTo(enemy.x - self.x, enemy.z - self.z) : self.yaw;
      intent.yaw = turnToward(self.yaw, look, turn);
      intent.pitch = self.pitch * 0.9;
      b.stuckLeft = BOTS.stuckTime; b.stuckX = self.x; b.stuckZ = self.z;
      return;
    }
    pickRoamGoal(self, b, w);
  }

  const repathing = b.repathLeft - dt <= 0 && w.pathBudget > 0;
  followPath(self, b, w, dt);
  if (repathing && b.path.length === 0 && b.memoryLeft <= 0 && !fightingFromCover) pickRoamGoal(self, b, w);
  if (b.pathIndex >= b.path.length && b.memoryLeft > 0 && !fightingFromCover) b.memoryLeft = 0; // reached last seen spot

  if (move.x !== 0 || move.z !== 0) {
    // Face where we go, or toward the threat while moving between cover and peek spot.
    const faceYaw = fightingFromCover ? yawTo(b.lastSeen.x - self.x, b.lastSeen.z - self.z) : yawTo(move.x, move.z);
    intent.yaw = turnToward(self.yaw, faceYaw, turn);
    intent.pitch = self.pitch * 0.9;
    steer(self, intent.yaw);
    // Stuck detection.
    b.stuckLeft -= dt;
    if (b.stuckLeft <= 0) {
      const moved = Math.hypot(self.x - b.stuckX, self.z - b.stuckZ);
      if (moved < BOTS.stuckDistance) { intent.jump = true; b.engaged = false; pickRoamGoal(self, b, w); }
      b.stuckLeft = BOTS.stuckTime; b.stuckX = self.x; b.stuckZ = self.z;
    }
  } else {
    intent.yaw = self.yaw; intent.pitch = self.pitch;
  }
  if (Number.isNaN(groundAt(w.nav, self.x, self.y, self.z)) && b.path.length === 0) intent.forward = 1;
}

/** Introspection for tests: the bot's fight state. */
export function brainState(b: BotBrain): { engaged: boolean; useCover: boolean; hasCover: boolean; phase: Phase } {
  return { engaged: b.engaged, useCover: b.useCover, hasCover: b.hasCover, phase: b.phase };
}
