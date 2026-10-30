// M0 smoke test: map + one character holding the rifle + first-person viewmodel + Rapier.
// Uses only the public APIs of src/maps, src/characters and src/weapons (see docs/ASSETS.md).
import { StrictMode, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics, RigidBody, CuboidCollider, CapsuleCollider, type RapierRigidBody } from '@react-three/rapier';
import { AmbientLight, Color, DirectionalLight, Fog, PerspectiveCamera, Scene } from 'three';
import { loadMapData, buildMap, mapColliders, spawnPoints } from '../../src/maps';
import { characters, createCharacter, poseCharacter, type PoseState } from '../../src/characters';
import { attachWeapon, createViewmodel, createWeapon, poseViewmodel, poseWeapon, type ViewmodelState } from '../../src/weapons';
import { CAMERA, MAP_ID, VIEWMODEL_CAMERA } from '../../src/config/game';

interface SmokeStats { frames: number; worldTriangles: number; worldCalls: number; vmTriangles: number; vmCalls: number; capsuleY: number; mapId: string }
declare global { interface Window { __smoke: SmokeStats } }
const stats: SmokeStats = { frames: 0, worldTriangles: 0, worldCalls: 0, vmTriangles: 0, vmCalls: 0, capsuleY: Number.NaN, mapId: MAP_ID };
window.__smoke = stats;

const map = loadMapData(MAP_ID);
const spawn = spawnPoints(map, 'A')[0];
const forwardX = -Math.sin(spawn.yaw), forwardZ = -Math.cos(spawn.yaw);
// Smoke-test only: show the character 4 m in front of the spawn camera.
const SHOWCASE_DISTANCE = 4;
const CAPSULE_SIDE_OFFSET = 1.6;
const CAPSULE_DROP_HEIGHT = 3;
const CAPSULE_HALF_HEIGHT = 0.45, CAPSULE_RADIUS = 0.45;

function MapView() {
  const group = useMemo(() => buildMap(map), []);
  const colliders = useMemo(() => mapColliders(map).boxes, []);
  const sun = map.light.sun.direction;
  return (
    <>
      <primitive object={group} />
      <ambientLight color={map.light.ambient.color} intensity={map.light.ambient.intensity} />
      <directionalLight color={map.light.sun.color} intensity={map.light.sun.intensity} position={[sun[0] * 50, sun[1] * 50, sun[2] * 50]} />
      <RigidBody type="fixed" colliders={false}>
        {colliders.map((b, i) => <CuboidCollider key={i} position={[b.x, b.y, b.z]} args={[b.w / 2, b.h / 2, b.d / 2]} />)}
      </RigidBody>
    </>
  );
}

function ShowcaseCharacter() {
  const avatar = useMemo(() => {
    const group = createCharacter(characters[0]);
    const rifle = createWeapon('rifle');
    attachWeapon(group, rifle);
    group.position.set(spawn.x + forwardX * SHOWCASE_DISTANCE, spawn.y, spawn.z + forwardZ * SHOWCASE_DISTANCE);
    group.rotation.y = spawn.yaw + Math.PI; // face the camera
    poseWeapon(rifle, { fire: 0, reload: null, cycle: null, equip: 1 });
    return group;
  }, []);
  const pose = useRef<PoseState>({ weapon: 'rifle', fire: 0, reload: null, cycle: null, speed: 0, moveDir: { x: 0, z: -1 },
    aimPitch: 0, shooting: false, crouching: false, grounded: true, dead: false });
  useFrame((_, dt) => poseCharacter(avatar, pose.current, dt));
  return <primitive object={avatar} />;
}

function FallingCapsule() {
  const body = useRef<RapierRigidBody>(null);
  useFrame(() => { if (body.current) stats.capsuleY = body.current.translation().y; });
  const x = spawn.x + forwardX * SHOWCASE_DISTANCE + forwardZ * CAPSULE_SIDE_OFFSET;
  const z = spawn.z + forwardZ * SHOWCASE_DISTANCE - forwardX * CAPSULE_SIDE_OFFSET;
  return (
    <RigidBody ref={body} colliders={false} position={[x, spawn.y + CAPSULE_DROP_HEIGHT, z]} enabledRotations={[false, false, false]}>
      <CapsuleCollider args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]} />
      <mesh><capsuleGeometry args={[CAPSULE_RADIUS, CAPSULE_HALF_HEIGHT * 2, 4, 12]} /><meshLambertMaterial color="#ff6a3d" /></mesh>
    </RigidBody>
  );
}

/** Renders the world, then the viewmodel scene on top after clearing depth (same as the weapons preview). */
function FirstPersonRenderer() {
  const { gl, scene, camera } = useThree();
  const vm = useMemo(() => {
    const vmScene = new Scene();
    vmScene.add(new AmbientLight(0xffffff, 1.6));
    const key = new DirectionalLight(0xffffff, 1.4); key.position.set(0.5, 1, 0.8); vmScene.add(key);
    const model = createViewmodel('rifle', characters[0], { holdSide: 'right' });
    vmScene.add(model);
    const vmCamera = new PerspectiveCamera(VIEWMODEL_CAMERA.fov, 1, VIEWMODEL_CAMERA.near, VIEWMODEL_CAMERA.far);
    return { vmScene, vmCamera, model };
  }, []);
  const vmState = useRef<ViewmodelState>({ holdSide: 'right', ads: 0, fire: 0, reload: null, cycle: null, equip: 1,
    moveSpeed: 0, strafe: 0, grounded: true, crouching: false, aimPitch: 0, time: 0 });
  const statsEl = useRef(document.getElementById('stats'));
  const nextStatsAt = useRef(0);
  useFrame((state) => {
    vmState.current.time = state.clock.elapsedTime;
    poseViewmodel(vm.model, vmState.current);
    const cam = camera as PerspectiveCamera;
    if (vm.vmCamera.aspect !== cam.aspect) { vm.vmCamera.aspect = cam.aspect; vm.vmCamera.updateProjectionMatrix(); }
    gl.autoClear = true;
    gl.render(scene, camera);
    stats.worldTriangles = gl.info.render.triangles; stats.worldCalls = gl.info.render.calls;
    gl.autoClear = false;
    gl.clearDepth();
    gl.render(vm.vmScene, vm.vmCamera);
    stats.vmTriangles = gl.info.render.triangles; stats.vmCalls = gl.info.render.calls;
    stats.frames++;
    if (state.clock.elapsedTime >= nextStatsAt.current && statsEl.current) {
      nextStatsAt.current = state.clock.elapsedTime + 0.5;
      statsEl.current.textContent = `map ${MAP_ID}\nworld ${stats.worldTriangles} tris / ${stats.worldCalls} calls\n` +
        `viewmodel ${stats.vmTriangles} tris / ${stats.vmCalls} calls\ncapsule y ${stats.capsuleY.toFixed(2)}`;
    }
  }, 1);
  return null;
}

function SmokeApp() {
  const sceneSetup = useMemo(() => ({ background: new Color(map.sky.color), fog: new Fog(map.fog.color, map.fog.near, map.fog.far) }), []);
  return (
    <Canvas
      camera={{ fov: CAMERA.fov, near: CAMERA.near, far: CAMERA.far, position: [spawn.x, spawn.y + CAMERA.eyeHeight, spawn.z], rotation: [0, spawn.yaw, 0] }}
      onCreated={({ scene }) => { scene.background = sceneSetup.background; scene.fog = sceneSetup.fog; }}
    >
      <Physics>
        <MapView />
        <FallingCapsule />
      </Physics>
      <ShowcaseCharacter />
      <FirstPersonRenderer />
    </Canvas>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><SmokeApp /></StrictMode>);
