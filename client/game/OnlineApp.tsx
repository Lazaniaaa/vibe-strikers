// M2a online view: the local player moves with the Rapier KCC and sends its state; the server
// validates it (snap-back on violation). Remote players and server bots are interpolated real characters.
// Shooting, hits and rounds come in M2b.
import { useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics, useRapier } from '@react-three/rapier';
import { BoxGeometry, Color, Fog, Mesh, MeshBasicMaterial, PerspectiveCamera } from 'three';
import { loadMapData } from '../../src/maps';
import { CAMERA, MAP_ID, RENDER } from '../../src/config/game';
import { MAX_FRAME_DT, MOVEMENT } from '../../src/config/movement';
import { NET } from '../../src/config/net';
import { createActor, setMotionFromVelocity, type Actor } from '../../src/gameplay/actor';
import { clamp, DEG } from '../../src/gameplay/math';
import { RapierMotor } from '../../src/gameplay/rapierMotor';
import type { TeamId } from '../../src/gameplay/round';
import type { GameNet, Snapshot } from '../../src/network/client';
import { Hud, type HudView } from '../../src/ui/hud';
import { MapView } from './GameApp';
import { Input } from './input';
import { FramePerf } from './perf';
import { AvatarRig, ViewmodelRig } from './visuals';

const map = loadMapData(MAP_ID);

export interface OnlineDebug {
  net: GameNet;
  local: Actor;
  stats: { frames: number; fps: number; triangles: number; calls: number; remotes: number };
  snapshot(): unknown;
}
declare global { interface Window { __online?: OnlineDebug } }

interface Remote { actor: Actor; rig: AvatarRig }

function OnlineDriver({ net, debug }: { net: GameNet; debug: boolean }) {
  const { world, rapier } = useRapier();
  const { gl, scene, camera, size } = useThree();

  const game = useMemo(() => {
    const me = net.me!;
    const local = createActor(0, me.team as TeamId, me.name, false, me.character);
    const motor = new RapierMotor(rapier, world);
    motor.add(local);
    const input = new Input(gl.domElement);
    const hud = new Hud(document.getElementById('hud')!);
    const flashMat = new MeshBasicMaterial({ color: '#ffd36b' });
    const flashGeo = new BoxGeometry(0.09, 0.09, 0.02);
    const allyMat = new MeshBasicMaterial({ color: '#46b4ff' });
    const allyGeo = new BoxGeometry(0.16, 0.16, 0.16);
    const viewmodel = new ViewmodelRig(local, flashMat, flashGeo);
    const remotes = new Map<bigint, Remote>();
    const perf = new FramePerf();
    const stats = { frames: 0, fps: 0, triangles: 0, calls: 0, remotes: 0 };
    const sample: Snapshot = { t: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, crouch: false, grounded: true, alive: true };
    const teleportTo = (x: number, y: number, z: number, yaw: number | null) => {
      motor.teleport(local, x, y, z);
      if (yaw !== null) { local.yaw = yaw; local.intent.yaw = yaw; local.pitch = 0; }
    };
    // Spawn (first correction) sets the view too; a snap-back keeps where the player is looking.
    net.onCorrection = (row) => teleportTo(row.x, row.y, row.z, net.corrections === 1 ? row.yaw : null);
    teleportTo(me.x, me.y, me.z, me.yaw);
    net.onPlayerRemoved = (id) => {
      const r = remotes.get(id);
      if (r) { scene.remove(r.rig.root); remotes.delete(id); }
    };
    return { local, motor, input, hud, viewmodel, remotes, perf, stats, sample, allyMat, allyGeo,
      disposables: [flashMat, flashGeo, allyMat, allyGeo] };
  }, [net, world, rapier, gl, scene]);

  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    cam.rotation.order = 'YXZ';
    if (debug) {
      window.__online = {
        net, local: game.local, stats: game.stats,
        snapshot: () => ({
          room: net.room?.code, me: net.me && { id: String(net.me.id), team: net.me.team, x: net.me.x, z: net.me.z, violations: net.me.violations },
          local: { x: game.local.x, y: game.local.y, z: game.local.z, grounded: game.local.grounded },
          snapBacks: Math.max(0, net.corrections - 1), players: net.players.size, remotes: game.remotes.size, stats: { ...game.stats },
        }),
      };
    }
    return () => {
      for (const r of game.remotes.values()) scene.remove(r.rig.root);
      game.input.dispose();
      for (const d of game.disposables) d.dispose();
      if (window.__online?.net === net) delete window.__online;
    };
  }, [game, net, scene, camera, debug]);

  const view = useMemo<HudView>(() => ({ hp: 100, alive: true, weapon: '', mag: 0, reserve: 0, reloading: false, phase: 'live',
    timeLeft: 0, round: 1, scoreA: 0, scoreB: 0, aliveA: 0, aliveB: 0, center: '', sub: '', killFeed: '', fps: 0, perf: '', locked: false }), []);
  const timers = useMemo(() => ({ hud: 0, fpsFrames: 0, fpsTime: 0 }), []);

  useFrame((state, delta) => {
    const { local, motor, input, hud, viewmodel, remotes, perf, stats, sample } = game;
    const cam = camera as PerspectiveCamera;
    const dt = Math.min(delta, MAX_FRAME_DT);
    const frameStart = performance.now();
    perf.beginFrame(frameStart);
    stats.frames++;
    net.update();

    // Local movement (client authority, server validation).
    if (stats.frames > 2 && net.me) {
      const intent = input.sample(local.yaw, local.pitch);
      local.yaw = intent.yaw;
      local.pitch = clamp(intent.pitch, -89 * DEG, 89 * DEG);
      motor.step(local, intent, dt, false, 1);
      net.tickSend(delta, { x: local.x, y: local.y, z: local.z, vx: local.vx, vy: local.vy, vz: local.vz, yaw: local.yaw,
        pitch: local.pitch, crouch: local.crouching, grounded: local.grounded, walk: intent.walk });
    }
    perf.now.sim = performance.now() - frameStart;
    perf.endSim();

    // Remote players at (now - interpolation delay).
    const renderTime = performance.now() - NET.interpolationDelayMs;
    const myTeam = net.me?.team;
    const poseStart = performance.now();
    for (const [id, row] of net.players) {
      if (net.me && id === net.me.id) continue;
      let r = remotes.get(id);
      if (!r) {
        const actor = createActor(Number(id), row.team as TeamId, row.name, row.isBot, row.character);
        const marker = row.team === myTeam ? new Mesh(game.allyGeo, game.allyMat) : null;
        if (marker) marker.rotation.set(Math.PI / 4, 0, Math.PI / 4);
        r = { actor, rig: new AvatarRig(actor, marker) };
        remotes.set(id, r);
        scene.add(r.rig.root);
      }
      const buf = net.buffers.get(id);
      if (!buf || !buf.sample(renderTime, sample)) continue;
      const a = r.actor;
      a.x = sample.x; a.y = sample.y; a.z = sample.z; a.yaw = sample.yaw; a.pitch = sample.pitch;
      a.crouching = sample.crouch; a.grounded = sample.grounded; a.alive = sample.alive;
      setMotionFromVelocity(a, sample.vx, sample.vz, MOVEMENT.runSpeed);
      r.rig.sync(a, dt);
    }
    stats.remotes = remotes.size;
    perf.now.pose = performance.now() - poseStart;

    cam.position.set(local.x, local.y + local.eyeHeight, local.z);
    cam.rotation.set(local.pitch, local.yaw, 0);
    viewmodel.sync(local, state.clock.elapsedTime, size.width / Math.max(1, size.height));

    const renderStart = performance.now();
    gl.autoClear = true;
    gl.render(scene, cam);
    stats.triangles = gl.info.render.triangles; stats.calls = gl.info.render.calls;
    gl.autoClear = false;
    gl.clearDepth();
    gl.render(viewmodel.scene, viewmodel.camera);
    stats.triangles += gl.info.render.triangles; stats.calls += gl.info.render.calls;
    perf.now.render = performance.now() - renderStart;

    hud.frame(dt, 4);
    timers.fpsFrames++; timers.fpsTime += delta;
    if (timers.fpsTime >= 0.5) { stats.fps = Math.round(timers.fpsFrames / timers.fpsTime); timers.fpsFrames = 0; timers.fpsTime = 0; }
    timers.hud -= delta;
    if (timers.hud <= 0) {
      timers.hud = 0.1;
      let humans = 0, bots = 0, aliveA = 0, aliveB = 0;
      for (const row of net.players.values()) {
        if (row.isBot) bots++; else humans++;
        if (row.alive) { if (row.team === 'A') aliveA++; else aliveB++; }
      }
      view.aliveA = aliveA; view.aliveB = aliveB; view.phase = 'matchEnd'; // no rounds before M2b: hide the timer
      view.hp = net.me?.hp ?? 0; view.alive = net.me?.alive ?? false;
      view.weapon = 'RIFLE'; view.mag = local.slots[0].mag; view.reserve = local.slots[0].reserve;
      view.center = ''; view.sub = '';
      view.killFeed = `Room ${net.room?.code ?? '-----'}${net.room?.isPrivate ? ' (private)' : ''}\n${humans} players + ${bots} bots\n` +
        `team ${myTeam ?? '-'}${net.lagMs ? ` · lag ${net.lagMs} ms` : ''}${net.lastError ? `\n${net.lastError}` : ''}`;
      view.fps = stats.fps;
      view.perf = `${Math.round(stats.triangles / 1000)}k tris · ${stats.calls} calls · worst ${Math.round(perf.displayWorstMs)} ms / 5 s · corrections ${net.corrections - 1}`;
      view.locked = input.locked || debug;
      hud.update(view);
    }
  }, 1);

  return null;
}

export function OnlineApp({ net, debug }: { net: GameNet; debug: boolean }) {
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
        <OnlineDriver net={net} debug={debug} />
      </Physics>
    </Canvas>
  );
}
