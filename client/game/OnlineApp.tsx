// Online view. The local player moves with the Rapier KCC and sends its state; the server validates it
// (snap-back on violation). Shots are predicted locally (animation, recoil, ammo) and decided by the
// server (hits with lag compensation, HP, kills, rounds). Remote players and bots are interpolated.
import { useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics, useRapier } from '@react-three/rapier';
import { BoxGeometry, Color, Fog, Mesh, MeshBasicMaterial, PerspectiveCamera } from 'three';
import { loadMapData, mapShotBlockers } from '../../src/maps';
import { CAMERA, EFFECTS, KILLCAM, MAP_ID, RENDER, TEAM_COLORS } from '../../src/config/game';
import { CAPSULE } from '../../src/config/movement';
import { MAX_FRAME_DT, MOVEMENT } from '../../src/config/movement';
import { NET } from '../../src/config/net';
import { createActor, setMotionFromVelocity, setPrimary, type Actor } from '../../src/gameplay/actor';
import { rayBlockers } from '../../src/gameplay/hitscan';
import { clamp, DEG, directionFromAngles, vec3 } from '../../src/gameplay/math';
import { RapierMotor } from '../../src/gameplay/rapierMotor';
import type { TeamId } from '../../src/gameplay/round';
import { canFire, cancelReload, consumeShot, resetSlot, spreadDeg, startReload, tickSlot } from '../../src/gameplay/weaponLogic';
import type { GameNet, KillEvent, ShotEvent, Snapshot } from '../../src/network/client';
import { KEYS } from '../../src/config/input';
import { LOADOUT, loadoutFor } from '../../src/config/weapons';
import type { WeaponId } from '../../src/weapons';
import { Hud, type HudView, type KillFeedEntry } from '../../src/ui/hud';
import { Scoreboard, type ScoreRow } from '../../src/ui/scoreboard';
import { characterLabel } from './characterLabel';
import { MapView } from './GameApp';
import { Input } from './input';
import { FramePerf } from './perf';
import { AvatarRig, DeathMarkers, ShotEffects, ViewmodelRig } from './visuals';
import { AdsController } from './ads';
import { ItemViews } from './items';
import { itemHint, nearestOf } from '../../src/gameplay/items';
import { TagProjector } from './nameTagProjector';
import { NameTags } from '../../src/ui/nameTags';
import { getSfx } from '../../src/ui/sfx';
import { AUDIO, type SoundName } from '../../src/config/audio';
import { onSettingsChange, settings } from '../../src/ui/settings';
import { getSettingsPanel, settingsButton } from '../../src/ui/settingsPanel';

const map = loadMapData(MAP_ID);
const blockers = mapShotBlockers(map).boxes;

export interface OnlineDebug {
  net: GameNet;
  local: Actor;
  stats: { frames: number; fps: number; triangles: number; calls: number; remotes: number;
    shots: number; hits: number; hitsWithoutRewind: number; kills: number; deaths: number; serverShots: number };
  snapshot(): unknown;
  /** Aim at the interpolated (rendered) position of a remote player: what a perfect human would aim at. */
  aimAtRemote(id: string, head?: boolean): boolean;
  /** Same, but every frame right before the weapon fires (tests at low frame rates). null = off. */
  setAutoAim(id: string | null): void;
  /** Server rewind (ms) of my recent shots. */
  rewinds: number[];
  /** Sounds played so far, by name. */
  sounds: Record<string, number>;
  /** What the TAB scoreboard shows. */
  scoreRows(): ScoreRow[];
  /** Kill feed lines. */
  feed: string[];
  setFire(on: boolean): void;
  setAds(on: boolean | null): void;
  view(): { ads: number; fov: number; weapon: string; viewmodelVisible: boolean; scope: string; crosshairHidden: boolean;
    camMode: string; camTarget: string | null; markers: number; bodies: number;
    tags: { id: number; name: string; ally: boolean; opacity: number }[] };
}
declare global { interface Window { __online?: OnlineDebug } }

interface Remote { actor: Actor; rig: AvatarRig; stepDist: number }

/** After death: 'killcam' follows the killer for KILLCAM.duration, then 'spectate' follows living teammates. */
interface ViewState { mode: 'self' | 'killcam' | 'spectate'; target: bigint | null; until: number; killer: string; weapon: string; fireWas: boolean }

function OnlineDriver({ net, debug, onLeave }: { net: GameNet; debug: boolean; onLeave: () => void }) {
  const { world, rapier } = useRapier();
  const { gl, scene, camera, size } = useThree();

  const game = useMemo(() => {
    const me = net.me!;
    const local = createActor(0, me.team as TeamId, me.name, false, me.character, me.primary as WeaponId);
    const motor = new RapierMotor(rapier, world);
    motor.add(local);
    const input = new Input(gl.domElement);
    input.debugUnlocked = debug;
    const hudRoot = document.getElementById('hud')!;
    const hud = new Hud(hudRoot);
    const scoreboard = new Scoreboard(hudRoot);
    hud.addLeaveButton(onLeave);
    settingsButton(hud.overlay, getSettingsPanel(), 'hud-settings-btn');
    const unitBox = new BoxGeometry(1, 1, 1);
    const tracerMat = new MeshBasicMaterial({ color: '#fff1a8', transparent: true, opacity: 0.85, depthWrite: false });
    const impactMat = new MeshBasicMaterial({ color: '#3a3a3a' });
    const flashMat = new MeshBasicMaterial({ color: '#ffd36b', transparent: true, opacity: 0.9, depthWrite: false });
    const flashGeo = new BoxGeometry(0.09, 0.09, 0.02);
    // Ally marker is drawn through walls (always know where your team is).
    const allyMat = new MeshBasicMaterial({ color: TEAM_COLORS.ally, depthTest: false, depthWrite: false, transparent: true });
    const allyGeo = new BoxGeometry(0.16, 0.16, 0.16);
    const viewmodel = new ViewmodelRig(local, flashMat, flashGeo);
    const ads = new AdsController(hudRoot);
    const applyStyle = () => hud.setCrosshairStyle(settings.crosshairColor, settings.crosshairSize);
    applyStyle();
    onSettingsChange(applyStyle);
    const effects = new ShotEffects(tracerMat, impactMat, unitBox);
    const markers = new DeathMarkers();
    const items = new ItemViews();
    const nameTags = new NameTags(hudRoot);
    const tagger = new TagProjector(nameTags, blockers);
    const remotes = new Map<bigint, Remote>();
    const perf = new FramePerf();
    const stats = { frames: 0, fps: 0, triangles: 0, calls: 0, remotes: 0, shots: 0, hits: 0, hitsWithoutRewind: 0, kills: 0, deaths: 0, serverShots: 0 };
    const sample: Snapshot = { t: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, crouch: false, grounded: true, alive: true };
    const feed: string[] = [];
    const feedEntries: KillFeedEntry[] = [];
    const scratch = { from: vec3(), dir: vec3(), punch: 0, autoAim: null as bigint | null };
    const rewinds: number[] = [];
    const sfx = getSfx();
    const audio = { stepDist: 0, prevReload: 0 };
    const view: ViewState = { mode: 'self', target: null, until: 0, killer: '', weapon: '', fireWas: false };
    const spawn = (row: { x: number; y: number; z: number; yaw: number; primary: string }) => {
      setPrimary(local, row.primary as WeaponId);
      motor.teleport(local, row.x, row.y, row.z);
      local.yaw = row.yaw; local.intent.yaw = row.yaw; local.pitch = 0;
      for (const s of local.slots) resetSlot(s);
      local.active = 0; local.equipLeft = 0; local.fireAnimLeft = 0; local.alive = true;
      view.mode = 'self'; view.target = null;
    };
    net.onSpawn = spawn;
    // A snap-back keeps where the player is looking.
    net.onCorrection = (row) => motor.teleport(local, row.x, row.y, row.z);
    spawn(me);
    net.onPlayerRemoved = (id) => {
      const r = remotes.get(id);
      if (r) { scene.remove(r.rig.root); remotes.delete(id); }
      markers.remove(Number(id));
      nameTags.remove(Number(id));
    };
    const name = (id: bigint) => net.players.get(id)?.name ?? '?';
    net.onShot = (e: ShotEvent) => {
      stats.serverShots++;
      const mine = net.me && e.shooterId === net.me.id;
      if (mine) {
        if (e.hitKind === 'player') {
          stats.hits++; if (e.hitWithoutRewind) stats.hitsWithoutRewind++;
        }
        if (debug) { rewinds.push(Math.round(e.rewindMs)); if (rewinds.length > 50) rewinds.shift(); }
        if (e.hitKind === 'player') {
          hud.hitMarker(e.part === 'head', e.killed, EFFECTS.hitMarkerTime);
          sfx.play(e.killed ? 'kill' : e.part === 'head' ? 'headshot' : 'hit');
        }
      } else {
        const r = remotes.get(e.shooterId);
        if (r) r.actor.fireAnimLeft = r.actor.slots[r.actor.active].stats.fireAnimTime;
        const from = effects.scratchStart;
        if (!r || !r.rig.muzzleWorld(from)) from.set(e.ox, e.oy, e.oz);
        sfx.playAt(`shot_${e.weapon}` as SoundName, e.ox, e.oz, local.x, local.z, local.yaw);
        if (e.weapon !== 'knife') effects.addShot({ shooterId: Number(e.shooterId), ox: e.ox, oy: e.oy, oz: e.oz, ex: e.ex, ey: e.ey, ez: e.ez,
          hitKind: e.hitKind as 'none' | 'world' | 'player', victimId: Number(e.victimId), part: e.part as 'head' | 'body',
          damage: e.damage, killed: e.killed }, from);
      }
      if (net.me && e.victimId === net.me.id && e.hitKind === 'player') { hud.damageFlash(EFFECTS.damageFlashTime); sfx.play('hurt'); }
    };
    net.onKill = (k: KillEvent) => {
      if (net.me && k.killerId === net.me.id) stats.kills++;
      if (net.me && k.victimId === net.me.id) stats.deaths++;
      feed.push(`${name(k.killerId)} [${k.weapon}${k.headshot ? ' HS' : ''}] ${name(k.victimId)}`);
      if (net.me && k.victimId === net.me.id) {
        const byOther = k.killerId !== net.me.id && net.players.has(k.killerId);
        view.mode = byOther ? 'killcam' : 'spectate'; view.target = byOther ? k.killerId : null;
        view.until = performance.now() + KILLCAM.duration * 1000; view.killer = name(k.killerId); view.weapon = k.weapon;
      }
      if (feed.length > 4) feed.shift();
      const myTeam = net.me?.team, ally = (id: bigint) => net.players.get(id)?.team === myTeam;
      feedEntries.push({ killer: name(k.killerId), killerAlly: ally(k.killerId), victim: name(k.victimId), victimAlly: ally(k.victimId),
        weapon: k.weapon, headshot: k.headshot });
      if (feedEntries.length > 4) feedEntries.shift();
    };
    return { local, motor, input, hud, scoreboard, viewmodel, ads, view, sfx, audio, markers, items, feedEntries, nameTags, tagger, effects, remotes, perf, stats, sample, feed, scratch, rewinds, allyMat, allyGeo,
      disposables: [unitBox, tracerMat, impactMat, flashMat, flashGeo, allyMat, allyGeo] };
  }, [net, world, rapier, gl, scene, debug, onLeave]);

  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    cam.rotation.order = 'YXZ';
    scene.add(game.effects.group);
    scene.add(game.markers.group);
    scene.add(game.items.group);
    if (debug) {
      window.__online = {
        net, local: game.local, stats: game.stats,
        snapshot: () => ({
          room: net.room?.code, phase: net.room?.phase, round: net.room?.round, scoreA: net.room?.scoreA, scoreB: net.room?.scoreB,
          me: net.me && { id: String(net.me.id), team: net.me.team, x: net.me.x, z: net.me.z, hp: net.me.hp, alive: net.me.alive,
            mag: net.me.mag, reserve: net.me.reserve, violations: net.me.violations, kills: net.me.kills, deaths: net.me.deaths },
          local: { x: game.local.x, y: game.local.y, z: game.local.z, grounded: game.local.grounded, mag: game.local.slots[game.local.active].mag },
          items: [...net.items.values()].map((i) => ({ id: String(i.id), kind: i.kind, weapon: i.weapon, mag: i.mag, reserve: i.reserve, x: i.x, y: i.y, z: i.z })),
          itemViews: game.items.count, hint: view.hint ?? '', primary: game.local.slots[0].stats.id,
          snapBacks: net.corrections, players: net.players.size, remotes: game.remotes.size, stats: { ...game.stats },
        }),
        aimAtRemote: (id: string, head = false) => {
          const r = game.remotes.get(BigInt(id));
          if (!r) return false;
          const l = game.local, a = r.actor;
          const dx = a.x - l.x, dz = a.z - l.z, dy = a.y + (head ? 1.35 : 0.6) - (l.y + l.eyeHeight);
          l.yaw = Math.atan2(-dx, -dz); l.pitch = Math.atan2(dy, Math.hypot(dx, dz));
          return true;
        },
        setFire: (on: boolean) => { game.input.debugFire = on; },
        setAds: (on: boolean | null) => { game.input.debugAds = on; },
        view: () => ({ ads: game.ads.value, fov: (camera as PerspectiveCamera).fov, weapon: game.local.slots[game.local.active].stats.id,
          viewmodelVisible: game.viewmodel.activeVisible(), scope: getComputedStyle(document.querySelector('.hud-scope')!).opacity,
          crosshairHidden: document.getElementById('hud')!.classList.contains('hud-no-crosshair'),
          camMode: game.view.mode, camTarget: game.view.target === null ? null : String(game.view.target),
          markers: game.markers.count,
          tags: game.nameTags.visible(),
          bodies: [...game.remotes.values()].filter((r) => !r.actor.alive && r.rig.root.visible).length }),
        setAutoAim: (id: string | null) => { game.scratch.autoAim = id === null ? null : BigInt(id); },
        rewinds: game.rewinds,
        sounds: game.sfx.played,
        scoreRows: () => scoreRows(net),
        feed: game.feed,
      };
    }
    return () => {
      for (const r of game.remotes.values()) scene.remove(r.rig.root);
      scene.remove(game.effects.group);
      scene.remove(game.markers.group);
      scene.remove(game.items.group);
      game.markers.dispose();
      game.input.dispose();
      game.ads.dispose();
      game.scoreboard.dispose();
      game.nameTags.dispose();
      game.hud.dispose();
      for (const d of game.disposables) d.dispose();
      if (window.__online?.net === net) delete window.__online;
    };
  }, [game, net, scene, camera, debug]);

  const view = useMemo<HudView>(() => ({ hp: 100, alive: true, weapon: '', mag: 0, reserve: 0, reloading: false, phase: 'live',
    timeLeft: 0, round: 1, scoreA: 0, scoreB: 0, aliveA: 0, aliveB: 0, center: '', sub: '', feed: [], roomInfo: '', fps: 0, perf: '', locked: false }), []);
  const timers = useMemo(() => ({ hud: 0, fpsFrames: 0, fpsTime: 0 }), []);

  useFrame((state, delta) => {
    const { local, motor, input, hud, viewmodel, effects, remotes, perf, stats, sample, scratch } = game;
    const cam = camera as PerspectiveCamera;
    const dt = Math.min(delta, MAX_FRAME_DT);
    const frameStart = performance.now();
    perf.beginFrame(frameStart);
    stats.frames++;
    net.update();
    const room = net.room, me = net.me;
    const phase = room?.phase ?? 'freeze';
    const live = phase === 'live';
    local.alive = me?.alive ?? false;
    // The server applied a new primary during the freeze phase.
    // (A pick-up also swaps the primary and draws it: take its ammo from the row.)
    if (me && setPrimary(local, me.primary as WeaponId)) {
      if (me.weapon === 0) { cancelReload(local.slots[local.active]); local.active = 0; local.slots[0].mag = me.mag; local.slots[0].reserve = me.reserve; }
      if (local.active === 0) local.equipLeft = local.slots[0].stats.equipTime;
    }
    const primaryChoice = input.takePrimaryRequest();
    if (primaryChoice >= 0 && me) {
      const want = LOADOUT.primaries[primaryChoice];
      try { localStorage.setItem('voxel-primary', want); } catch { /* storage blocked */ }
      net.setPrimary(want).then(() => { net.lastError = ''; }, () => undefined);
    }

    // Local movement (client authority, server validation) and predicted weapon.
    let localFired = false;
    if (stats.frames > 2 && me) {
      if (scratch.autoAim !== null) {
        const buf = net.buffers.get(scratch.autoAim);
        if (buf && buf.sample(performance.now() - NET.interpolationDelayMs, sample)) {
          const dx = sample.x - local.x, dz = sample.z - local.z, dy = sample.y + 0.6 - (local.y + local.eyeHeight);
          local.yaw = Math.atan2(-dx, -dz); local.pitch = Math.atan2(dy, Math.hypot(dx, dz));
        }
      }
      const weaponNow = local.slots[local.active].stats;
      const intent = input.sample(local.yaw, local.pitch, game.ads.sensitivity(weaponNow.id));
      if (!local.alive) { input.cancelAds(); game.ads.reset(); }
      game.ads.update(dt, input.wantAds(settings.adsMode) && local.alive && local.slots[local.active].reloadLeft <= 0, weaponNow.id);
      local.yaw = intent.yaw;
      local.pitch = clamp(intent.pitch, -89 * DEG, 89 * DEG);
      if (local.alive) {
        motor.step(local, intent, dt, phase === 'freeze' || phase === 'matchEnd',
          weaponNow.moveSpeedScale * (game.ads.scoped(weaponNow.id) ? weaponNow.adsSpeedScale : 1));
        net.tickSend(delta, { x: local.x, y: local.y, z: local.z, vx: local.vx, vy: local.vy, vz: local.vz, yaw: local.yaw,
          pitch: local.pitch, crouch: local.crouching, grounded: local.grounded, walk: intent.walk });
        // E: pick up the nearest item (the server checks range and swaps the primary).
        if (intent.use && live) { const it = nearestOf(net.items.values(), local.x, local.y, local.z); if (it) net.pickUp(it.id); }
        // Weapon switch / reload / fire (the server repeats every check).
        if (intent.slot >= 0 && intent.slot < local.slots.length && intent.slot !== local.active) {
          input.cancelAds();
          cancelReload(local.slots[local.active]);
          local.active = intent.slot; local.equipLeft = local.slots[intent.slot].stats.equipTime; local.fireLatch = false;
          net.switchWeapon(intent.slot);
        }
        const s = local.slots[local.active];
        tickSlot(s, dt);
        if (local.equipLeft > 0) local.equipLeft = Math.max(0, local.equipLeft - dt);
        if (intent.reload && startReload(s)) { net.reload(); input.cancelAds(); game.sfx.play('reload'); }
        if (!intent.fire) local.fireLatch = false;
        if (live && intent.fire && local.equipLeft <= 0) {
          if (s.stats.magSize > 0 && s.mag === 0) { if (startReload(s)) { net.reload(); input.cancelAds(); game.sfx.play('reload'); } }
          while (canFire(s) && (s.stats.automatic || !local.fireLatch)) {
            // Server time of the remote poses on screen right now (they are drawn interpolationDelayMs behind).
            net.fire(local.yaw, local.pitch, net.serverTimeAt(performance.now() - NET.interpolationDelayMs), game.ads.scoped(s.stats.id));
            const kick = consumeShot(s);
            stats.shots++; localFired = true;
            game.sfx.play(`shot_${s.stats.id}` as SoundName);
            local.fireAnimLeft = s.stats.fireAnimTime; local.fireLatch = true;
            // Predicted tracer along the aim, to the first map box.
            directionFromAngles(local.yaw, local.pitch, scratch.dir);
            scratch.from.x = local.x; scratch.from.y = local.y + local.eyeHeight; scratch.from.z = local.z;
            const dist = Math.min(s.stats.range, rayBlockers(scratch.from, scratch.dir, s.stats.range, blockers));
            const from = effects.scratchStart;
            if (s.stats.id === 'knife') continue;
            from.set(local.x - Math.sin(local.yaw) * 0.55 + Math.cos(local.yaw) * 0.17, local.y + local.eyeHeight - 0.14,
              local.z - Math.cos(local.yaw) * 0.55 - Math.sin(local.yaw) * 0.17);
            effects.addShot({ shooterId: 0, ox: 0, oy: 0, oz: 0, ex: scratch.from.x + scratch.dir.x * dist, ey: scratch.from.y + scratch.dir.y * dist,
              ez: scratch.from.z + scratch.dir.z * dist, hitKind: dist < s.stats.range ? 'world' : 'none', victimId: -1, part: 'body',
              damage: 0, killed: false }, from);
            local.pitch = clamp(local.pitch + kick.pitchDeg * DEG, -89 * DEG, 89 * DEG);
            local.yaw += (kick.yawDeg + (Math.random() * 2 - 1) * s.stats.recoilYawJitterDeg) * DEG;
          }
        }
        // Reconcile ammo with the server when both sides are idle.
        if (me.weapon === local.active && !me.reloading && s.reloadLeft <= 0 && Math.abs(me.mag - s.mag) > 1) { s.mag = me.mag; s.reserve = me.reserve; }
      }
      if (local.fireAnimLeft > 0) local.fireAnimLeft = Math.max(0, local.fireAnimLeft - dt);
    }
    // Second reload click near the end; footsteps while running (Shift walk and crouch are silent).
    {
      const s = local.slots[local.active], a = game.audio;
      if (a.prevReload > AUDIO.reloadSecondClick && s.reloadLeft > 0 && s.reloadLeft <= AUDIO.reloadSecondClick) game.sfx.play('reload');
      a.prevReload = s.reloadLeft;
      if (local.alive && local.grounded && !local.crouching && !input.intent.walk && local.moveFraction >= AUDIO.stepMinMoveFraction) {
        a.stepDist += Math.hypot(local.vx, local.vz) * dt;
        if (a.stepDist >= AUDIO.stride) { a.stepDist = 0; game.sfx.play('step'); }
      }
    }
    perf.now.sim = performance.now() - frameStart;
    perf.endSim();

    // Remote players at (now - interpolation delay).
    const renderTime = performance.now() - NET.interpolationDelayMs;
    const myTeam = me?.team;
    const poseStart = performance.now();
    for (const [id, row] of net.players) {
      if (me && id === me.id) continue;
      let r = remotes.get(id);
      if (!r) {
        const actor = createActor(Number(id), row.team as TeamId, row.name, row.isBot, row.character);
        const marker = row.team === myTeam ? new Mesh(game.allyGeo, game.allyMat) : null;
        if (marker) { marker.rotation.set(Math.PI / 4, 0, Math.PI / 4); marker.renderOrder = 10; }
        r = { actor, rig: new AvatarRig(actor, marker), stepDist: 0 };
        remotes.set(id, r);
        scene.add(r.rig.root);
      }
      const buf = net.buffers.get(id);
      if (!buf || !buf.sample(renderTime, sample)) continue;
      const a = r.actor;
      a.x = sample.x; a.y = sample.y; a.z = sample.z; a.yaw = sample.yaw; a.pitch = sample.pitch;
      a.crouching = sample.crouch; a.grounded = sample.grounded; a.alive = sample.alive;
      setPrimary(a, row.primary as WeaponId);
      if (row.weapon < a.slots.length) a.active = row.weapon;
      if (a.fireAnimLeft > 0) a.fireAnimLeft = Math.max(0, a.fireAnimLeft - dt);
      setMotionFromVelocity(a, sample.vx, sample.vz, MOVEMENT.runSpeed);
      r.rig.sync(a, dt);
      game.markers.update(Number(id), a.alive, a.x, a.y, a.z, row.team === myTeam);
      if (a.alive && a.grounded && !row.walk && !a.crouching && a.moveFraction >= AUDIO.stepMinMoveFraction) {
        r.stepDist += Math.hypot(a.vx, a.vz) * dt;
        if (r.stepDist >= AUDIO.stride) { r.stepDist = 0; game.sfx.playAt('step', a.x, a.z, local.x, local.z, local.yaw); }
      }
    }
    stats.remotes = remotes.size;
    perf.now.pose = performance.now() - poseStart;

    // Camera: eye of the local player; after death it stays where the player fell.
    if (localFired) scratch.punch += local.slots[local.active].stats.viewPunchDeg * DEG;
    scratch.punch *= Math.exp(-EFFECTS.viewPunchRecover * dt);
    const vs = game.view;
    if (local.alive) vs.mode = 'self';
    else {
      // Killcam ends after its time or when the killer is gone; then spectate a living teammate (click = next).
      const fire = input.intent.fire, click = fire && !vs.fireWas;
      vs.fireWas = fire;
      if (vs.mode === 'killcam' && (performance.now() >= vs.until || !remotes.has(vs.target!))) { vs.mode = 'spectate'; vs.target = null; }
      if (vs.mode === 'spectate') {
        const mates = [...net.players.values()].filter((p) => p.team === myTeam && p.alive && p.id !== me?.id).map((p) => p.id)
          .sort((a, b) => (a < b ? -1 : 1));
        const at = vs.target === null ? -1 : mates.indexOf(vs.target);
        if (at < 0 || click) vs.target = mates.length ? mates[(at + 1) % mates.length] : null;
      }
    }
    const followed = vs.mode !== 'self' && vs.target !== null ? remotes.get(vs.target) : undefined;
    for (const [id, r] of remotes) {
      r.rig.hiddenByCamera = !!followed && id === vs.target;
      if (r.rig.hiddenByCamera) r.rig.root.visible = false;
    }
    if (me) game.markers.update(Number(me.id), me.alive, local.x, local.y, local.z, true);
    if (local.alive) {
      cam.position.set(local.x, local.y + local.eyeHeight, local.z);
      cam.rotation.set(local.pitch + scratch.punch, local.yaw, 0);
    } else if (followed) {
      const a = followed.actor;
      cam.position.set(a.x, a.y + (a.crouching ? CAPSULE.crouchEyeHeight : CAPSULE.eyeHeight), a.z);
      cam.rotation.set(a.pitch, a.yaw, 0);
    } else {
      cam.position.y = Math.max(local.y + 0.6, cam.position.y - dt * 1.5);
    }
    viewmodel.sync(local, state.clock.elapsedTime, size.width / Math.max(1, size.height), game.ads.value);
    game.ads.apply(cam, local.slots[local.active].stats.id);
    // Name tags (after the camera is placed).
    game.tagger.begin(cam);
    for (const [id, r] of remotes) {
      const row = net.players.get(id);
      if (!row) continue;
      const a = r.actor;
      game.tagger.place(cam, size.width, size.height, Number(id), row.name, row.team === myTeam, a.x, a.y, a.z, !a.alive || r.rig.hiddenByCamera);
    }
    effects.update(dt);
    game.items.sync(net.items, state.clock.elapsedTime);

    const renderStart = performance.now();
    gl.autoClear = true;
    gl.render(scene, cam);
    stats.triangles = gl.info.render.triangles; stats.calls = gl.info.render.calls;
    gl.autoClear = false;
    gl.clearDepth();
    gl.render(viewmodel.scene, viewmodel.camera);
    stats.triangles += gl.info.render.triangles; stats.calls += gl.info.render.calls;
    perf.now.render = performance.now() - renderStart;

    const s = local.slots[local.active];
    const spread = spreadDeg(s, local.moveFraction, !local.grounded, game.ads.scoped(s.stats.id)) * DEG;
    hud.setCrosshairHidden(game.ads.hideCrosshair || !local.alive);
    hud.frame(dt, 3 + Math.tan(spread) / Math.tan((cam.fov * DEG) / 2) * (size.height / 2));
    timers.fpsFrames++; timers.fpsTime += delta;
    if (timers.fpsTime >= 0.5) { stats.fps = Math.round(timers.fpsFrames / timers.fpsTime); timers.fpsFrames = 0; timers.fpsTime = 0; }
    timers.hud -= delta;
    if (timers.hud <= 0) {
      timers.hud = 0.1;
      fillOnlineHud(view, net, local, game.feedEntries);
      // Killcam banner even if the round just ended; spectate hint only while the round is live.
      if (me && !me.alive && (game.view.mode === 'killcam' || room?.phase === 'live')) {
        const target = game.view.target !== null ? net.players.get(game.view.target)?.name : undefined;
        if (game.view.mode === 'killcam') { view.center = `Killed by ${game.view.killer}`; view.sub = `${game.view.weapon} · killcam`; }
        else { view.center = 'You died'; view.sub = target ? `Spectating ${target} · click: next teammate` : 'No teammates alive'; }
      }
      const near = local.alive && room?.phase === 'live' ? nearestOf(net.items.values(), local.x, local.y, local.z) : null;
      view.hint = near ? itemHint(near) : '';
      view.fps = stats.fps;
      view.perf = `${Math.round(stats.triangles / 1000)}k tris · ${stats.calls} calls · worst ${Math.round(perf.displayWorstMs)} ms / 5 s · ping ${Math.round(net.pingMs)} · snap-backs ${net.corrections}`;
      game.scoreboard.setVisible(input.isDown(KEYS.scoreboard));
      if (game.scoreboard.isVisible) game.scoreboard.update(scoreRows(net), String(net.me?.id ?? ''), net.room?.scoreA ?? 0, net.room?.scoreB ?? 0);
      view.locked = input.locked || debug;
      hud.update(view);
    }
  }, 1);

  return null;
}

function scoreRows(net: GameNet): ScoreRow[] {
  const mine = net.me?.team;
  return [...net.players.values()].map((r) => ({ id: String(r.id), name: r.name, character: characterLabel(r.character), kills: r.kills,
    deaths: r.deaths, ping: r.ping, isBot: r.isBot, alive: r.alive, team: r.team, ally: r.team === mine }));
}

function fillOnlineHud(v: HudView, net: GameNet, local: Actor, feed: readonly KillFeedEntry[]): void {
  const me = net.me, r = net.room, s = local.slots[local.active];
  v.hp = me?.hp ?? 0; v.alive = me?.alive ?? false;
  v.weapon = s.stats.id.toUpperCase(); v.mag = s.mag; v.reserve = s.reserve; v.reloading = s.reloadLeft > 0;
  v.melee = s.stats.magSize === 0;
  let humans = 0, bots = 0, aliveA = 0, aliveB = 0;
  for (const row of net.players.values()) {
    if (row.isBot) bots++; else humans++;
    if (row.alive) { if (row.team === 'A') aliveA++; else aliveB++; }
  }
  v.aliveA = aliveA; v.aliveB = aliveB;
  v.phase = (r?.phase ?? 'freeze') as HudView['phase']; v.timeLeft = r?.timeLeft ?? 0; v.round = r?.round ?? 1;
  v.scoreA = r?.scoreA ?? 0; v.scoreB = r?.scoreB ?? 0;
  const mine = me?.team;
  const winText = (w: string) => (w === 'draw' ? 'Draw' : w === mine ? 'Your team wins the round' : 'Enemy team wins the round');
  if (!r) { v.center = 'Connecting...'; v.sub = ''; }
  else if (r.phase === 'freeze') { v.center = `Round ${r.round}`; v.sub = `starts in ${Math.ceil(r.timeLeft)}`; }
  else if (r.phase === 'roundEnd') { v.center = winText(r.lastWinner); v.sub = `${r.scoreA} : ${r.scoreB}`; }
  else if (r.phase === 'matchEnd') { v.center = r.matchWinner === mine ? 'VICTORY' : 'DEFEAT'; v.sub = `new match in ${Math.ceil(r.timeLeft)}`; }
  else if (me && !me.alive) { v.center = 'You died'; v.sub = 'Wait for the next round'; }
  else { v.center = ''; v.sub = ''; }
  if (me && r && (r.phase === 'freeze' || r.phase === 'roundEnd' || !me.alive)) {
    const next = loadoutFor(me.nextPrimary as WeaponId)[0];
    v.sub += `${v.sub ? '\n' : ''}Primary: ${LOADOUT.primaries.map((w, i) => `${7 + i} ${w}${w === next ? ' ✓' : ''}`).join(' · ')}`;
  }
  v.roomInfo = `Room ${r?.code ?? '-----'}${r?.isPrivate ? ' (private)' : ''} · ${humans} players + ${bots} bots (${r?.difficulty ?? 'normal'}) · team ${mine ?? '-'}` +
    `${net.lagMs ? ` · lag ${net.lagMs} ms` : ''}${net.lastError ? `\n${net.lastError}` : ''}`;
  v.feed = feed;
}

export function OnlineApp({ net, debug, onLeave }: { net: GameNet; debug: boolean; onLeave: () => void }) {
  const sceneSetup = useMemo(() => ({ background: new Color(map.sky.color), fog: new Fog(map.fog.color, map.fog.near, map.fog.far) }), []);
  return (
    <Canvas
      shadows={RENDER.shadows ? 'percentage' : false}
      dpr={[1, RENDER.maxPixelRatio]}
      camera={{ fov: CAMERA.fov, near: CAMERA.near, far: CAMERA.far }}
      onCreated={({ scene }) => { scene.background = sceneSetup.background; scene.fog = sceneSetup.fog; }}
    >
      <Physics gravity={[0, 0, 0]}>
        <MapView />
        <OnlineDriver net={net} debug={debug} onLeave={onLeave} />
      </Physics>
    </Canvas>
  );
}
