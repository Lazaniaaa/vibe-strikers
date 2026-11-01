// M1 offline game: Toy Town, Rapier KCC movement, pistol + rifle hitscan, bots, HUD.
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { CuboidCollider, Physics, RigidBody, useRapier } from '@react-three/rapier';
import { BoxGeometry, Color, Fog, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3, type DirectionalLight } from 'three';
import { buildMap, loadMapData, mapColliders, mapShotBlockers, spawnPoints } from '../../src/maps';
import { characters } from '../../src/characters';
import { CAMERA, EFFECTS, LOCAL_PLAYER, MAP_ID, POSE, RENDER, TEAM_COLORS } from '../../src/config/game';
import { BOT_NAMES, BOT_SKILLS, DEFAULT_DIFFICULTY, type BotDifficulty } from '../../src/config/bots';
import { MAX_FRAME_DT } from '../../src/config/movement';
import { DEG } from '../../src/gameplay/math';
import { lineOfSight } from '../../src/gameplay/hitscan';
import { buildMapNav } from '../../src/gameplay/mapNav';
import { RapierMotor } from '../../src/gameplay/rapierMotor';
import { LOCAL_ID, Simulation } from '../../src/gameplay/simulation';
import { spreadDeg } from '../../src/gameplay/weaponLogic';
import { Hud, type HudView } from '../../src/ui/hud';
import { Input } from './input';
import { AvatarRig, DeathMarkers, ShotEffects, ViewmodelRig } from './visuals';
import { FramePerf } from './perf';
import { AdsController } from './ads';
import { BootGlows, ItemViews } from './items';
import { SecondPersonView } from './secondPerson';
import { getMusic, MusicDirector } from '../../src/ui/music';
import { mutatorLabel, mutatorRules } from '../../src/config/mutators';
import { PingMarkers } from './pings';
import { pingPoint } from './pingRay';
import type { GameMode } from '../../src/gameplay/mode';
import { CORNUCOPIA, ITEMS } from '../../src/config/items';
import { cornucopiaEndText, cornucopiaScoreLine, healHint } from '../../src/ui/modeText';
import { itemHint, pedestalBoxes, spawnsClearOf } from '../../src/gameplay/items';
import { TagProjector } from './nameTagProjector';
import { NameTags } from '../../src/ui/nameTags';
import { getSfx } from '../../src/ui/sfx';
import { AUDIO, type SoundName } from '../../src/config/audio';
import { onSettingsChange, settings } from '../../src/ui/settings';
import { getSettingsPanel, settingsButton } from '../../src/ui/settingsPanel';

export interface GameOptions { debug: boolean; freezeTime?: number; /** Local player's character (menu). */ character?: number;
  /** Back to the menu (Esc overlay "Leave match"). */ onLeave?: () => void;
  /** Bot difficulty (menu). */ difficulty?: BotDifficulty;
  /** Game mode and Cornucopia teams / free-for-all (menu). */ mode?: GameMode; teams?: boolean;
  /** Mutator id (menu) or '' = none. */ mutator?: string;
  /** Called once when the first frame is rendered (hides the loading screen). */ onReady?: () => void }

const map = loadMapData(MAP_ID);
const blockersForDebug = mapShotBlockers(map).boxes;
const spawnsA = spawnPoints(map, 'A'), spawnsB = spawnPoints(map, 'B');

/** Shared debug/test surface (only exposed with ?debug=1). */
export interface GameDebug {
  sim: Simulation;
  input: Input;
  stats: { frames: number; localShots: number; localHits: number; localDamage: number; triangles: number; calls: number; fps: number; localSteps: number };
  perf: FramePerf;
  sounds: Record<string, number>;
  /** Visible death markers / dead bodies still shown (tests). */
  markers(): number;
  bodies(): number;
  tags(): { id: number; name: string; ally: boolean; opacity: number }[];
  /** Line of sight between two points against the map's shot blockers (tests). */
  los(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean;
  /** Ids of bots whose firearm pose was too slow and now use the no-weapon pose. */
  degradedRigs(): number[];
  snapshot(): unknown;
  aimAt(actorId: number, head?: boolean): void;
  teleport(actorId: number, x: number, y: number, z: number, yaw: number): void;
}
declare global { interface Window { __game?: GameDebug } }

/** Local player's character first, then bot characters (skipping ones that are too slow to pose). */
function pickCharacters(local: number): number[] {
  const list: number[] = [local];
  for (let i = 0; i < characters.length; i++) {
    if (i !== local && !POSE.botCharacterExclude.includes(characters[i].id)) list.push(i);
  }
  return list;
}

/** Cornucopia pedestals: solid boxes at the map's loot spots (jump on them or take the loot from beside). */
export function PedestalColliders() {
  const boxes = useMemo(() => pedestalBoxes(map.lootSpots), []);
  return (
    <RigidBody type="fixed" colliders={false}>
      {boxes.map((b, i) => <CuboidCollider key={i} position={[b.x, b.y, b.z]} args={[b.w / 2, b.h / 2, b.d / 2]} />)}
    </RigidBody>
  );
}

export function MapView() {
  const group = useMemo(() => buildMap(map), []);
  const colliders = useMemo(() => mapColliders(map).boxes, []);
  const sunRef = useRef<DirectionalLight>(null);
  const sun = map.light.sun.direction;
  const len = Math.hypot(sun[0], sun[1], sun[2]);
  useEffect(() => {
    const s = sunRef.current;
    if (!s) return;
    const cam = s.shadow.camera, e = RENDER.shadowExtent;
    cam.left = -e; cam.right = e; cam.top = e; cam.bottom = -e; cam.near = 1; cam.far = RENDER.sunDistance * 2;
    cam.updateProjectionMatrix();
  }, []);
  return (
    <>
      <primitive object={group} />
      <ambientLight color={map.light.ambient.color} intensity={map.light.ambient.intensity} />
      <directionalLight ref={sunRef} color={map.light.sun.color} intensity={map.light.sun.intensity}
        position={[sun[0] / len * RENDER.sunDistance, sun[1] / len * RENDER.sunDistance, sun[2] / len * RENDER.sunDistance]}
        castShadow={RENDER.shadows} shadow-mapSize={[RENDER.shadowMapSize, RENDER.shadowMapSize]} shadow-bias={-0.0005} shadow-normalBias={0.03} />
      <RigidBody type="fixed" colliders={false}>
        {colliders.map((b, i) => <CuboidCollider key={i} position={[b.x, b.y, b.z]} args={[b.w / 2, b.h / 2, b.d / 2]} />)}
      </RigidBody>
    </>
  );
}

function GameDriver({ options }: { options: GameOptions }) {
  const { world, rapier } = useRapier();
  const { gl, scene, camera, size } = useThree();

  const game = useMemo(() => {
    const blockers = mapShotBlockers(map).boxes;
    // Cornucopia: pedestals are solid for the bots too (same boxes as the colliders and the server).
    const navBoxes = options.mode === 'cornucopia' ? [...mapColliders(map).boxes, ...pedestalBoxes(map.lootSpots)] : mapColliders(map).boxes;
    const { nav, upper, cover, routes, perches } = buildMapNav(navBoxes, map.bounds, map.boxes.filter((b) => b.kind === 'stair'), spawnsA[0], map.zones);
    const goals = [...map.zones.map((z) => ({ x: z.x, y: 0, z: z.z })), ...spawnsA, ...spawnsB, ...upper];
    const motor = new RapierMotor(rapier, world);
    const perf = new FramePerf();
    // Cornucopia: skip spawn points that sit on a pedestal (same rule as the server).
    const corn = options.mode === 'cornucopia', peds = pedestalBoxes(map.lootSpots);
    const sim = new Simulation({ profile: perf.now, clock: () => performance.now(), blockers, goals,
      spawnsA: corn ? spawnsClearOf(spawnsA, peds) : spawnsA, spawnsB: corn ? spawnsClearOf(spawnsB, peds) : spawnsB, cover, routes, perches, nav, motor, killY: map.killY,
      localName: LOCAL_PLAYER.name, botNames: BOT_NAMES, botSkill: BOT_SKILLS[options.difficulty ?? DEFAULT_DIFFICULTY], characterIndices: pickCharacters(options.character ?? LOCAL_PLAYER.characterIndex), freezeTime: options.freezeTime,
      mode: options.mode, teams: options.teams, mutator: options.mutator, spawnsFfa: corn ? spawnsClearOf(spawnPoints(map, 'ffa'), peds) : spawnPoints(map, 'ffa'), lootSpots: map.lootSpots });
    const input = new Input(gl.domElement);
    const hudRoot = document.getElementById('hud')!;
    const hud = new Hud(hudRoot);
    const unitBox = new BoxGeometry(1, 1, 1);
    const tracerMat = new MeshBasicMaterial({ color: '#fff1a8', transparent: true, opacity: 0.85, depthWrite: false });
    const impactMat = new MeshBasicMaterial({ color: '#3a3a3a' });
    const flashMat = new MeshBasicMaterial({ color: '#ffd36b', transparent: true, opacity: 0.9, depthWrite: false });
    const flashGeo = new BoxGeometry(0.09, 0.09, 0.02);
    // Ally marker is drawn through walls (always know where your team is).
    const allyMat = new MeshBasicMaterial({ color: TEAM_COLORS.ally, depthTest: false, depthWrite: false, transparent: true });
    const allyGeo = new BoxGeometry(0.16, 0.16, 0.16);
    const chipMat = new MeshBasicMaterial({ color: '#ffffff' });
    const effects = new ShotEffects(tracerMat, impactMat, unitBox, chipMat);
    const markers = new DeathMarkers();
    const nameTags = new NameTags(hudRoot);
    const tagger = new TagProjector(nameTags, blockers);
    const rigs = new Map<number, AvatarRig>();
    for (const a of sim.actors) {
      if (a.id === LOCAL_ID) continue;
      const marker = a.team === sim.local.team ? new Mesh(allyGeo, allyMat) : null;
      if (marker) { marker.rotation.set(Math.PI / 4, 0, Math.PI / 4); marker.renderOrder = 10; }
      rigs.set(a.id, new AvatarRig(a, marker));
    }
    const viewmodel = new ViewmodelRig(sim.local, flashMat, flashGeo);
    const ads = new AdsController(hudRoot);
    settingsButton(hud.overlay, getSettingsPanel(), 'hud-settings-btn');
    if (options.onLeave) hud.addLeaveButton(options.onLeave);
    const applyStyle = () => hud.setCrosshairStyle(settings.crosshairColor, settings.crosshairSize);
    applyStyle();
    onSettingsChange(applyStyle);
    const stats = { frames: 0, localShots: 0, localHits: 0, localDamage: 0, triangles: 0, calls: 0, fps: 0, localSteps: 0 };
    input.onConfirm = () => { if (sim.round.phase === 'matchEnd') sim.restart(); };
    const items = new ItemViews();
    const glows = new BootGlows();
    const second = new SecondPersonView(sim.local);
    const headScale = mutatorRules(options.mutator ?? '').headScale;
    for (const r of rigs.values()) r.setHeadScale(headScale);
    second.rig.setHeadScale(headScale);
    const pings = new PingMarkers();
    const music = new MusicDirector();
    return { sim, input, hud, effects, rigs, viewmodel, ads, markers, items, glows, second, pings, music, nameTags, tagger, stats, perf, disposables: [unitBox, tracerMat, impactMat, chipMat, flashMat, flashGeo, allyMat, allyGeo] };
  }, [world, rapier, gl, options.freezeTime, options.mode, options.teams, options.mutator]);

  useEffect(() => {
    for (const rig of game.rigs.values()) scene.add(rig.root);
    scene.add(game.effects.group);
    scene.add(game.markers.group);
    scene.add(game.items.group);
    scene.add(game.glows.group);
    scene.add(game.second.rig.root);
    scene.add(game.pings.group);
    const cam = camera as PerspectiveCamera;
    cam.rotation.order = 'YXZ';
    // Compile every material now so the first shot / tracer / flash does not stall a frame.
    game.effects.setAllVisible(true); game.viewmodel.setAllVisible(true);
    gl.compile(scene, cam); gl.compile(game.viewmodel.scene, game.viewmodel.camera);
    game.effects.setAllVisible(false); game.viewmodel.setAllVisible(false);
    if (options.debug) {
      const g = game;
      window.__game = {
        sim: g.sim, input: g.input, stats: g.stats, perf: g.perf, sounds: getSfx().played,
        markers: () => g.markers.count,
        tags: () => g.nameTags.visible(),
        los: (ax: number, ay: number, az: number, bx: number, by: number, bz: number) =>
          lineOfSight({ x: ax, y: ay, z: az }, { x: bx, y: by, z: bz }, blockersForDebug, { x: 0, y: 0, z: 0 }),
        bodies: () => [...g.rigs.values()].filter((r) => !g.sim.actors[r.actorId].alive && r.root.visible).length,
        degradedRigs: () => [...g.rigs.values()].filter((r) => r.degraded).map((r) => r.actorId),
        snapshot: () => ({
          phase: g.sim.round.phase, timeLeft: g.sim.round.timeLeft, round: g.sim.round.round,
          scoreA: g.sim.round.scoreA, scoreB: g.sim.round.scoreB, matchWinner: g.sim.round.matchWinner,
          stats: { ...g.stats },
          items: g.sim.items.map((i) => ({ ...i })), itemViews: g.items.count, hint: view.hint ?? '', glows: g.glows.visibleCount,
          music: { mood: getMusic().mood, notes: { ...getMusic().notes }, stings: { ...getMusic().stings } },
          mode: g.sim.mode, ffa: g.sim.ffa, mutator: g.sim.mutator, roomInfo: view.roomInfo, secondPerson: g.second.active, secondDistance: g.second.distance, center: view.center, scoreLine: view.scoreLine ?? '',
          local: { hasPrimary: g.sim.local.hasPrimary, boots: g.sim.local.boots, healLeft: g.sim.local.healLeft, active: g.sim.local.active },
          actors: g.sim.actors.map((a) => ({ id: a.id, team: a.team, name: a.name, hp: a.hp, alive: a.alive,
            x: +a.x.toFixed(2), y: +a.y.toFixed(2), z: +a.z.toFixed(2), grounded: a.grounded,
            weapon: a.slots[a.active].stats.id, mag: a.slots[a.active].mag, reserve: a.slots[a.active].reserve, kills: a.kills })),
        }),
        teleport: (id, x, y, z, yaw) => g.sim.teleport(id, x, y, z, yaw),
        aimAt: (actorId: number, head = false) => {
          const me = g.sim.local, t = g.sim.actors[actorId];
          const ty = t.y + (head ? 1.35 : 0.6), ey = me.y + me.eyeHeight;
          const dx = t.x - me.x, dz = t.z - me.z;
          g.input.debugLook = { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(ty - ey, Math.hypot(dx, dz)) };
        },
      };
    }
    return () => {
      for (const rig of game.rigs.values()) scene.remove(rig.root);
      scene.remove(game.effects.group);
      scene.remove(game.markers.group);
      scene.remove(game.items.group);
      scene.remove(game.glows.group);
      scene.remove(game.second.rig.root);
      scene.remove(game.pings.group);
      game.pings.dispose();
      game.markers.dispose();
      game.input.dispose();
      game.ads.dispose();
      game.hud.dispose();
      game.nameTags.dispose();
      for (const d of game.disposables) d.dispose();
      if (window.__game?.sim === game.sim) delete window.__game;
    };
  }, [game, scene, camera, gl, options.debug]);

  const scratch = useMemo(() => ({ from: new Vector3(), fwd: new Vector3(), right: new Vector3(), hudTimer: 0, fpsFrames: 0, fpsTimer: 0, punch: 0,
    audio: { prevReload: 0, steps: new Map<number, number>() } }), []);
  const view = useMemo<HudView>(() => ({ hp: 100, alive: true, weapon: '', mag: 0, reserve: 0, reloading: false, phase: 'freeze',
    timeLeft: 0, round: 1, scoreA: 0, scoreB: 0, aliveA: 0, aliveB: 0, center: '', sub: '', feed: [], roomInfo: `Offline practice · ${options.mode === 'cornucopia' ? `Cornucopia${options.teams === false ? ' (free-for-all)' : ''}` : 'Elimination'}${options.mutator ? ` · Mutator: ${mutatorLabel(options.mutator)}` : ''} · bots ${options.difficulty ?? DEFAULT_DIFFICULTY}`, fps: 0, perf: '', locked: false }), []);

  useFrame((state, delta) => {
    const { sim, input, hud, effects, rigs, viewmodel, stats, perf } = game;
    const cam = camera as PerspectiveCamera;
    const dt = Math.min(delta, MAX_FRAME_DT);
    const frameStart = performance.now();
    perf.beginFrame(frameStart);
    stats.frames++;
    const local = sim.local;
    // Let Rapier step once so the static map is in the query structures before anyone moves.
    if (stats.frames > 2) {
      const wid = local.slots[local.active].stats.id;
      const intent = input.sample(local.yaw, local.pitch, game.ads.sensitivity(wid));
      if (intent.slot >= 0 || intent.reload || !local.alive) input.cancelAds();
      // Second-person view (V): no shooting, no aiming; reloading still works.
      const secondWanted = input.wantSecondPerson(settings.secondPersonMode) && local.alive;
      if (secondWanted) { intent.fire = false; input.cancelAds(); }
      game.ads.update(dt, input.wantAds(settings.adsMode) && !secondWanted && local.alive && local.slots[local.active].reloadLeft <= 0, wid);
      if (options.debug) input.debugLook = null;
      intent.aim = game.ads.scoped(wid);
      // Z / middle mouse: ping (offline the teammates are bots, so only you see it).
      if (input.takePing() && local.alive) { const p = pingPoint(local, blockersForDebug); if (p) { game.pings.add(p.x, p.y, p.z, 'You'); getSfx().play('ping'); } }
      sim.update(dt, intent);
    }
    perf.now.sim = performance.now() - frameStart;
    perf.endSim();

    // Shot events -> tracers, hit markers, damage flash.
    let localFired = false;
    const sfx = getSfx();
    for (let i = 0; i < sim.shotCount; i++) {
      const shot = sim.shots[i];
      const from = scratch.from;
      const shooter = sim.actors[shot.shooterId], weaponId = shooter.slots[shooter.active].stats.id;
      if (shot.shooterId === LOCAL_ID) sfx.play(`shot_${weaponId}` as SoundName);
      else sfx.playAt(`shot_${weaponId}` as SoundName, shot.ox, shot.oz, local.x, local.z, local.yaw);
      if (shot.shooterId === LOCAL_ID) {
        localFired = true; stats.localShots++;
        scratch.fwd.set(-Math.sin(local.yaw) * Math.cos(local.pitch), Math.sin(local.pitch), -Math.cos(local.yaw) * Math.cos(local.pitch));
        scratch.right.set(Math.cos(local.yaw), 0, -Math.sin(local.yaw));
        from.set(shot.ox, shot.oy - 0.14, shot.oz).addScaledVector(scratch.fwd, 0.55).addScaledVector(scratch.right, 0.17);
        if (shot.hitKind === 'player') {
          stats.localHits++; stats.localDamage += shot.damage;
          hud.hitMarker(shot.part === 'head', shot.killed, EFFECTS.hitMarkerTime);
          sfx.play(shot.killed ? 'kill' : shot.part === 'head' ? 'headshot' : 'hit');
        }
      } else {
        const rig = rigs.get(shot.shooterId);
        if (!rig || !rig.muzzleWorld(from)) from.set(shot.ox, shot.oy, shot.oz);
      }
      if (shot.victimId === LOCAL_ID) { hud.damageFlash(EFFECTS.damageFlashTime); sfx.play('hurt'); }
      if (weaponId !== 'knife') effects.addShot(shot, from);
    }

    // Reload clicks and footsteps (running only; Shift walk and crouch are silent).
    {
      const slot = local.slots[local.active], au = scratch.audio;
      if (slot.reloadLeft > 0 && au.prevReload <= 0) sfx.play('reload');
      if (au.prevReload > AUDIO.reloadSecondClick && slot.reloadLeft > 0 && slot.reloadLeft <= AUDIO.reloadSecondClick) sfx.play('reload');
      au.prevReload = slot.reloadLeft;
      for (const a of sim.actors) {
        if (!a.alive || !a.grounded || a.crouching || a.intent.walk || a.moveFraction < AUDIO.stepMinMoveFraction) continue;
        const d = (au.steps.get(a.id) ?? 0) + Math.hypot(a.vx, a.vz) * dt;
        if (d < AUDIO.stride) { au.steps.set(a.id, d); continue; }
        au.steps.set(a.id, 0);
        if (a.id === LOCAL_ID) { sfx.play('step'); stats.localSteps++; } else sfx.playAt('step', a.x, a.z, local.x, local.z, local.yaw);
      }
    }

    for (const a of sim.actors) {
      game.markers.update(a.id, a.alive, a.x, a.y, a.z, a.team === local.team);
      const rig = rigs.get(a.id);
      if (!rig) continue;
      const t = performance.now();
      rig.sync(a, dt);
      const ms = performance.now() - t;
      perf.now.pose += ms; if (ms > perf.now.poseMaxCall) perf.now.poseMaxCall = ms;
      if (options.debug && ms > 30) {
        const w = window as unknown as { __slowPoses?: unknown[] };
        (w.__slowPoses ??= []).push({ ms: Math.round(ms), id: a.id, char: a.characterIndex, ...rig.pose, moveDir: { ...rig.pose.moveDir } });
      }
    }

    // Camera: eye of the local player; after death it stays where the player fell.
    const slot = local.slots[local.active];
    if (localFired) scratch.punch += slot.stats.viewPunchDeg * DEG;
    scratch.punch *= Math.exp(-EFFECTS.viewPunchRecover * dt);
    const secondView = game.second.update(input.wantSecondPerson(settings.secondPersonMode), local, dt);
    if (secondView) game.second.place(cam, local, blockersForDebug);
    else if (local.alive) {
      cam.position.set(local.x, local.y + local.eyeHeight, local.z);
      cam.rotation.set(local.pitch + scratch.punch, local.yaw, 0);
    } else {
      cam.position.y = Math.max(local.y + 0.6, cam.position.y - dt * 1.5);
    }
    viewmodel.sync(local, state.clock.elapsedTime, size.width / Math.max(1, size.height), game.ads.value);
    game.ads.apply(cam, local.slots[local.active].stats.id);
    game.tagger.begin(cam);
    for (const a of sim.actors) {
      if (a.id === LOCAL_ID) continue;
      game.tagger.place(cam, size.width, size.height, a.id, a.name, a.team === local.team, a.x, a.y, a.z, !a.alive);
    }
    hud.setCrosshairHidden(game.ads.hideCrosshair || !local.alive || secondView);
    effects.update(dt);
    game.items.sync(sim.items, state.clock.elapsedTime);
    game.pings.update(dt);
    game.glows.begin();
    for (const a of sim.actors) if (a.alive && a.boots && a.sinceBoost < CORNUCOPIA.glowTime) game.glows.show(a.id, a.x, a.y, a.z);
    game.glows.end();

    const renderStart = performance.now();
    gl.autoClear = true;
    gl.render(scene, cam);
    stats.triangles = gl.info.render.triangles; stats.calls = gl.info.render.calls;
    gl.autoClear = false;
    gl.clearDepth();
    if (!secondView) gl.render(viewmodel.scene, viewmodel.camera);
    stats.triangles += gl.info.render.triangles; stats.calls += gl.info.render.calls;
    perf.now.render = performance.now() - renderStart;
    if (stats.frames === 1) options.onReady?.();

    // HUD.
    const spread = spreadDeg(slot, local.moveFraction, !local.grounded) * DEG;
    hud.frame(dt, 3 + Math.tan(spread) / Math.tan((cam.fov * DEG) / 2) * (size.height / 2));
    scratch.fpsFrames++; scratch.fpsTimer += delta;
    if (scratch.fpsTimer >= 0.5) { stats.fps = Math.round(scratch.fpsFrames / scratch.fpsTimer); scratch.fpsFrames = 0; scratch.fpsTimer = 0; }
    scratch.hudTimer -= delta;
    if (scratch.hudTimer <= 0) {
      scratch.hudTimer = 0.1;
      fillHudView(view, sim, input.locked || options.debug, stats);
      const near = sim.local.alive && sim.round.phase === 'live' ? sim.itemNear(sim.local) : null;
      view.hint = near ? itemHint(near) : healHint(sim.local.healLeft > 0);
      view.pings = game.pings.text(sim.local.x, sim.local.z);
      const r = sim.round;
      game.music.update(r.phase, r.timeLeft, (r.phase === 'matchEnd' ? r.matchWinner : r.lastWinner) ?? '', sim.local.team);
      view.perf += ` \u00b7 worst ${Math.round(perf.displayWorstMs)} ms (sim ${perf.displayWorstSimMs.toFixed(1)}) / 5 s`;
      hud.update(view);
    }
  }, 1);

  return null;
}

function fillHudView(v: HudView, sim: Simulation, locked: boolean, stats: GameDebug['stats']): void {
  const local = sim.local, slot = local.slots[local.active], r = sim.round;
  v.hp = local.hp; v.alive = local.alive; v.weapon = slot.stats.id.toUpperCase(); v.mag = slot.mag; v.reserve = slot.reserve;
  v.reloading = slot.reloadLeft > 0; v.phase = r.phase; v.timeLeft = r.timeLeft; v.round = r.round;
  v.scoreA = r.scoreA; v.scoreB = r.scoreB;
  let aliveA = 0, aliveB = 0;
  for (const a of sim.actors) if (a.alive) { if (a.team === 'A') aliveA++; else aliveB++; }
  v.aliveA = aliveA; v.aliveB = aliveB;
  const mine = local.team;
  const teamText = (w: string | null) => (w === 'draw' ? 'Draw' : w === mine ? 'Your team wins the round' : 'Enemy team wins the round');
  if (r.phase === 'freeze') { v.center = `Round ${r.round}`; v.sub = `starts in ${Math.ceil(r.timeLeft)}`; }
  else if (r.phase === 'roundEnd') { v.center = teamText(r.lastWinner); v.sub = `${r.scoreA} : ${r.scoreB}`; }
  else if (r.phase === 'matchEnd') { v.center = r.matchWinner === mine ? 'VICTORY' : 'DEFEAT'; v.sub = 'Press Enter or click to play again'; }
  else if (!local.alive) { v.center = 'You died'; v.sub = 'Wait for the round to end'; }
  else { v.center = ''; v.sub = ''; }
  const m = { mode: sim.mode, ffa: sim.ffa, phase: r.phase, myTeam: mine, lastWinner: r.lastWinner ?? '', matchWinner: r.matchWinner ?? '',
    nameOfTeam: (t: string) => sim.actors.find((a) => a.team === t)?.name ?? t, aliveA, aliveB,
    aliveAll: sim.actors.filter((a) => a.alive).length, boots: local.boots, healing: local.healLeft > 0 };
  v.scoreLine = cornucopiaScoreLine(m);
  const end = cornucopiaEndText(m);
  if (end) { v.center = end.center; v.sub = r.phase === 'matchEnd' ? `${end.sub}\nPress Enter or click to play again` : end.sub; }
  else if (sim.mode === 'cornucopia' && r.phase === 'freeze') { v.center = 'Cornucopia'; v.sub = `starts in ${Math.ceil(r.timeLeft)} · loot on the pedestals, E to take`; }
  const names = (id: number) => (id < 0 ? 'world' : sim.actors[id].name);
  const ally = (id: number) => id >= 0 && sim.actors[id].team === local.team;
  v.feed = sim.kills.slice(-4).map((k) => ({ killer: names(k.killerId), killerAlly: ally(k.killerId), victim: names(k.victimId),
    victimAlly: ally(k.victimId), weapon: k.weapon, headshot: k.headshot }));
  v.fps = stats.fps;
  v.perf = `${Math.round(stats.triangles / 1000)}k tris · ${stats.calls} calls`;
  v.locked = locked;
}

export function GameApp({ options }: { options: GameOptions }) {
  const sceneSetup = useMemo(() => ({ background: new Color(map.sky.color), fog: new Fog(map.fog.color, map.fog.near, map.fog.far) }), []);
  const spawn = spawnsA[0];
  return (
    <Canvas
      shadows={RENDER.shadows ? 'percentage' : false}
      dpr={[1, RENDER.maxPixelRatio]}
      camera={{ fov: CAMERA.fov, near: CAMERA.near, far: CAMERA.far, position: [spawn.x, spawn.y + CAMERA.eyeHeight, spawn.z] }}
      onCreated={({ scene }) => { scene.background = sceneSetup.background; scene.fog = sceneSetup.fog; }}
    >
      <Physics gravity={[0, 0, 0]}>
        <MapView />
        {options.mode === 'cornucopia' && <PedestalColliders />}
        <GameDriver options={options} />
      </Physics>
    </Canvas>
  );
}

