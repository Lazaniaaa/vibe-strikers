// M1 offline game: Toy Town, Rapier KCC movement, pistol + rifle hitscan, bots, HUD.
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { CuboidCollider, Physics, RigidBody, useRapier } from '@react-three/rapier';
import { BoxGeometry, Color, Fog, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3, type DirectionalLight } from 'three';
import { buildMap, loadMapData, mapColliders, mapShotBlockers, spawnPoints } from '../../src/maps';
import { characters } from '../../src/characters';
import { CAMERA, EFFECTS, LOCAL_PLAYER, MAP_ID, POSE, RENDER } from '../../src/config/game';
import { BOT_NAMES } from '../../src/config/bots';
import { MAX_FRAME_DT } from '../../src/config/movement';
import { DEG } from '../../src/gameplay/math';
import { buildNavGrid, pruneUnreachable } from '../../src/gameplay/navGrid';
import { RapierMotor } from '../../src/gameplay/rapierMotor';
import { LOCAL_ID, Simulation } from '../../src/gameplay/simulation';
import { spreadDeg } from '../../src/gameplay/weaponLogic';
import { Hud, type HudView } from '../../src/ui/hud';
import { Input } from './input';
import { AvatarRig, ShotEffects, ViewmodelRig } from './visuals';
import { FramePerf } from './perf';

export interface GameOptions { debug: boolean; freezeTime?: number }

const map = loadMapData(MAP_ID);
const spawnsA = spawnPoints(map, 'A'), spawnsB = spawnPoints(map, 'B');

/** Shared debug/test surface (only exposed with ?debug=1). */
export interface GameDebug {
  sim: Simulation;
  input: Input;
  stats: { frames: number; localShots: number; localHits: number; localDamage: number; triangles: number; calls: number; fps: number };
  perf: FramePerf;
  snapshot(): unknown;
  aimAt(actorId: number, head?: boolean): void;
  teleport(actorId: number, x: number, y: number, z: number, yaw: number): void;
}
declare global { interface Window { __game?: GameDebug } }

/** Local player's character first, then bot characters (skipping ones that are too slow to pose). */
function pickCharacters(): number[] {
  const list: number[] = [LOCAL_PLAYER.characterIndex];
  for (let i = 1; i < characters.length; i++) {
    if (i !== LOCAL_PLAYER.characterIndex && !POSE.botCharacterExclude.includes(characters[i].id)) list.push(i);
  }
  return list;
}

function MapView() {
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
    const nav = buildNavGrid(mapColliders(map).boxes, map.bounds);
    pruneUnreachable(nav, spawnsA[0].x, spawnsA[0].z);
    const goals = [...map.zones.map((z) => ({ x: z.x, y: 0, z: z.z })), ...spawnsA, ...spawnsB];
    const motor = new RapierMotor(rapier, world);
    const perf = new FramePerf();
    const sim = new Simulation({ profile: perf.now, clock: () => performance.now(), blockers, spawnsA, spawnsB, goals, nav, motor, killY: map.killY,
      localName: LOCAL_PLAYER.name, botNames: BOT_NAMES, characterIndices: pickCharacters(), freezeTime: options.freezeTime });
    const input = new Input(gl.domElement);
    const hudRoot = document.getElementById('hud')!;
    const hud = new Hud(hudRoot);
    const unitBox = new BoxGeometry(1, 1, 1);
    const tracerMat = new MeshBasicMaterial({ color: '#fff1a8', transparent: true, opacity: 0.85, depthWrite: false });
    const impactMat = new MeshBasicMaterial({ color: '#3a3a3a' });
    const flashMat = new MeshBasicMaterial({ color: '#ffd36b', transparent: true, opacity: 0.9, depthWrite: false });
    const flashGeo = new BoxGeometry(0.09, 0.09, 0.02);
    const allyMat = new MeshBasicMaterial({ color: '#46b4ff' });
    const allyGeo = new BoxGeometry(0.16, 0.16, 0.16);
    const effects = new ShotEffects(tracerMat, impactMat, unitBox);
    const rigs = new Map<number, AvatarRig>();
    for (const a of sim.actors) {
      if (a.id === LOCAL_ID) continue;
      const marker = a.team === sim.local.team ? new Mesh(allyGeo, allyMat) : null;
      if (marker) marker.rotation.set(Math.PI / 4, 0, Math.PI / 4);
      rigs.set(a.id, new AvatarRig(a, marker));
    }
    const viewmodel = new ViewmodelRig(sim.local, flashMat, flashGeo);
    const stats = { frames: 0, localShots: 0, localHits: 0, localDamage: 0, triangles: 0, calls: 0, fps: 0 };
    input.onConfirm = () => { if (sim.round.phase === 'matchEnd') sim.restart(); };
    return { sim, input, hud, effects, rigs, viewmodel, stats, perf, disposables: [unitBox, tracerMat, impactMat, flashMat, flashGeo, allyMat, allyGeo] };
  }, [world, rapier, gl, options.freezeTime]);

  useEffect(() => {
    for (const rig of game.rigs.values()) scene.add(rig.root);
    scene.add(game.effects.group);
    const cam = camera as PerspectiveCamera;
    cam.rotation.order = 'YXZ';
    // Compile every material now so the first shot / tracer / flash does not stall a frame.
    game.effects.setAllVisible(true); game.viewmodel.setAllVisible(true);
    gl.compile(scene, cam); gl.compile(game.viewmodel.scene, game.viewmodel.camera);
    game.effects.setAllVisible(false); game.viewmodel.setAllVisible(false);
    if (options.debug) {
      const g = game;
      window.__game = {
        sim: g.sim, input: g.input, stats: g.stats, perf: g.perf,
        snapshot: () => ({
          phase: g.sim.round.phase, timeLeft: g.sim.round.timeLeft, round: g.sim.round.round,
          scoreA: g.sim.round.scoreA, scoreB: g.sim.round.scoreB, matchWinner: g.sim.round.matchWinner,
          stats: { ...g.stats },
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
      game.input.dispose();
      for (const d of game.disposables) d.dispose();
      if (window.__game?.sim === game.sim) delete window.__game;
    };
  }, [game, scene, camera, gl, options.debug]);

  const scratch = useMemo(() => ({ from: new Vector3(), fwd: new Vector3(), right: new Vector3(), hudTimer: 0, fpsFrames: 0, fpsTimer: 0, punch: 0 }), []);
  const view = useMemo<HudView>(() => ({ hp: 100, alive: true, weapon: '', mag: 0, reserve: 0, reloading: false, phase: 'freeze',
    timeLeft: 0, round: 1, scoreA: 0, scoreB: 0, aliveA: 0, aliveB: 0, center: '', sub: '', killFeed: '', fps: 0, perf: '', locked: false }), []);

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
      const intent = input.sample(local.yaw, local.pitch);
      if (options.debug) input.debugLook = null;
      sim.update(dt, intent);
    }
    perf.now.sim = performance.now() - frameStart;
    perf.endSim();

    // Shot events -> tracers, hit markers, damage flash.
    let localFired = false;
    for (let i = 0; i < sim.shotCount; i++) {
      const shot = sim.shots[i];
      const from = scratch.from;
      if (shot.shooterId === LOCAL_ID) {
        localFired = true; stats.localShots++;
        scratch.fwd.set(-Math.sin(local.yaw) * Math.cos(local.pitch), Math.sin(local.pitch), -Math.cos(local.yaw) * Math.cos(local.pitch));
        scratch.right.set(Math.cos(local.yaw), 0, -Math.sin(local.yaw));
        from.set(shot.ox, shot.oy - 0.14, shot.oz).addScaledVector(scratch.fwd, 0.55).addScaledVector(scratch.right, 0.17);
        if (shot.hitKind === 'player') {
          stats.localHits++; stats.localDamage += shot.damage;
          hud.hitMarker(shot.part === 'head', shot.killed, EFFECTS.hitMarkerTime);
        }
      } else {
        const rig = rigs.get(shot.shooterId);
        if (!rig || !rig.muzzleWorld(from)) from.set(shot.ox, shot.oy, shot.oz);
      }
      if (shot.victimId === LOCAL_ID) hud.damageFlash(EFFECTS.damageFlashTime);
      effects.addShot(shot, from);
    }

    for (const a of sim.actors) {
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
    if (local.alive) {
      cam.position.set(local.x, local.y + local.eyeHeight, local.z);
      cam.rotation.set(local.pitch + scratch.punch, local.yaw, 0);
    } else {
      cam.position.y = Math.max(local.y + 0.6, cam.position.y - dt * 1.5);
    }
    viewmodel.sync(local, state.clock.elapsedTime, size.width / Math.max(1, size.height));
    effects.update(dt);

    const renderStart = performance.now();
    gl.autoClear = true;
    gl.render(scene, cam);
    stats.triangles = gl.info.render.triangles; stats.calls = gl.info.render.calls;
    gl.autoClear = false;
    gl.clearDepth();
    gl.render(viewmodel.scene, viewmodel.camera);
    stats.triangles += gl.info.render.triangles; stats.calls += gl.info.render.calls;
    perf.now.render = performance.now() - renderStart;

    // HUD.
    const spread = spreadDeg(slot, local.moveFraction, !local.grounded) * DEG;
    hud.frame(dt, 3 + Math.tan(spread) / Math.tan((cam.fov * DEG) / 2) * (size.height / 2));
    scratch.fpsFrames++; scratch.fpsTimer += delta;
    if (scratch.fpsTimer >= 0.5) { stats.fps = Math.round(scratch.fpsFrames / scratch.fpsTimer); scratch.fpsFrames = 0; scratch.fpsTimer = 0; }
    scratch.hudTimer -= delta;
    if (scratch.hudTimer <= 0) {
      scratch.hudTimer = 0.1;
      fillHudView(view, sim, input.locked || options.debug, stats);
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
  const names = (id: number) => (id < 0 ? 'world' : sim.actors[id].name);
  v.killFeed = sim.kills.slice(-4).map((k) => `${names(k.killerId)} [${k.weapon}${k.headshot ? ' HS' : ''}] ${names(k.victimId)}`).join('\n');
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
        <GameDriver options={options} />
      </Physics>
    </Canvas>
  );
}

