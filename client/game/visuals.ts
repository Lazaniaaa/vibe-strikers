// three.js side of the game: bot avatars, local viewmodels, tracers, impacts. No per-frame allocation.
import {
  AmbientLight, BoxGeometry, DirectionalLight, Group, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera, Scene, Vector3,
} from 'three';
import { characters, createCharacter, poseCharacter, type PoseState } from '../../src/characters';
import { attachWeapon, createViewmodel, createWeapon, poseViewmodel, poseWeapon, weaponIds, type ViewmodelState, type WeaponId, type WeaponState } from '../../src/weapons';
import { DEATH, EFFECTS, POSE, TEAM_COLORS, VIEWMODEL_CAMERA } from '../../src/config/game';
import type { Actor } from '../../src/gameplay/actor';
import { cycleProgress, reloadProgress } from '../../src/gameplay/weaponLogic';
import type { ShotEvent } from '../../src/gameplay/simulation';

/** Ally marker above a teammate's head (enemies get none). */
const ALLY_MARKER_Y = 2.15;

export class AvatarRig {
  readonly root: Group;
  readonly actorId: number;
  private weapons = new Map<WeaponId, Group>();
  private currentWeapon: WeaponId | null = null;
  private marker: Mesh | null;
  /** True after a slow firearm pose: the rig uses the cheap no-weapon pose from then on. */
  degraded = false;
  private deadFrames = 0;
  /** Seconds since death (0 while alive). */
  private deadTime = 0;
  /** Set by the driver while the camera is inside this player (killcam / spectate). */
  hiddenByCamera = false;
  readonly pose: PoseState = { weapon: 'rifle', fire: 0, reload: null, cycle: null, speed: 0, moveDir: { x: 0, z: -1 },
    aimPitch: 0, shooting: false, crouching: false, grounded: true, dead: false };
  private readonly weaponPose: WeaponState = { fire: 0, reload: null, cycle: null, equip: 1 };

  constructor(actor: Actor, allyMarker: Mesh | null) {
    this.actorId = actor.id;
    this.root = createCharacter(characters[actor.characterIndex % characters.length]);
    this.marker = allyMarker;
    if (allyMarker) { allyMarker.position.set(0, ALLY_MARKER_Y, 0); this.root.add(allyMarker); }
    // Every weapon once (the primary can change between rounds); only the held one is attached.
    for (const id of weaponIds) this.weapons.set(id, createWeapon(id));
  }

  /** Muzzle of the held weapon (for tracer start points). */
  muzzleWorld(out: Vector3): boolean {
    const w = this.currentWeapon ? this.weapons.get(this.currentWeapon) : undefined;
    const m = w?.getObjectByName('muzzle');
    if (!m) return false;
    m.getWorldPosition(out);
    return true;
  }

  /** Big heads mutator: head part scale, re-applied after every pose (poseCharacter resets joints to scale 1). */
  private headScale = 1;
  setHeadScale(s: number): void { this.headScale = s; this.applyHeadScale(); }
  private applyHeadScale(): void {
    if (this.headScale === 1) return;
    (this.root.userData.head as { scale: { setScalar(v: number): void } } | undefined)?.scale.setScalar(this.headScale);
  }

  sync(actor: Actor, dt: number): void {
    const slot = actor.slots[actor.active], id = slot.stats.id;
    if (id !== this.currentWeapon) {
      const w = this.weapons.get(id)!;
      attachWeapon(this.root, w);
      this.currentWeapon = id;
    }
    // Death: pose for DEATH.bodyTime, sink during the last part, then hide the body (a marker stays).
    this.deadTime = actor.alive ? 0 : this.deadTime + dt;
    const sinkStart = DEATH.bodyTime - DEATH.sinkTime;
    const sink = this.deadTime > sinkStart ? Math.min(1, (this.deadTime - sinkStart) / DEATH.sinkTime) * DEATH.sinkDepth : 0;
    this.root.visible = !this.hiddenByCamera && (actor.alive || this.deadTime < DEATH.bodyTime);
    this.root.position.set(actor.x, actor.y - sink, actor.z);
    this.root.rotation.y = actor.yaw;
    const p = this.pose;
    p.weapon = id; p.speed = actor.alive ? actor.moveFraction : 0;
    p.moveDir.x = actor.moveLocalX; p.moveDir.z = actor.moveLocalZ;
    p.aimPitch = actor.pitch; p.shooting = actor.fireAnimLeft > 0; p.crouching = actor.crouching;
    p.grounded = actor.grounded || !actor.alive; p.dead = !actor.alive;
    p.fire = actor.fireAnimLeft / slot.stats.fireAnimTime; p.reload = reloadProgress(slot);
    if (this.degraded) p.weapon = null;
    // A dead body does not move: pose it a couple of times, then stop.
    this.deadFrames = actor.alive ? 0 : this.deadFrames + 1;
    if (this.deadFrames <= POSE.deadPoseFrames) {
      const t = performance.now();
      poseCharacter(this.root, p, dt);
      this.applyHeadScale();
      if (!this.degraded && p.weapon && performance.now() - t > POSE.slowCallMs) this.degraded = true;
    }
    p.cycle = cycleProgress(slot);
    const wp = this.weaponPose;
    wp.fire = p.fire; wp.reload = p.reload; wp.cycle = p.cycle;
    poseWeapon(this.weapons.get(id)!, wp);
    if (this.marker) this.marker.visible = actor.alive;
  }
}

/** First-person weapons in their own scene and camera (rendered after the world with depth cleared). */
export class ViewmodelRig {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(VIEWMODEL_CAMERA.fov, 1, VIEWMODEL_CAMERA.near, VIEWMODEL_CAMERA.far);
  private models = new Map<WeaponId, Group>();
  private flashes = new Map<WeaponId, Mesh>();
  private active: WeaponId | null = null;
  private readonly state: ViewmodelState = { holdSide: 'right', ads: 0, fire: 0, reload: null, cycle: null, equip: 1,
    moveSpeed: 0, strafe: 0, grounded: true, crouching: false, aimPitch: 0, time: 0 };

  constructor(actor: Actor, flashMaterial: MeshBasicMaterial, flashGeometry: BoxGeometry) {
    this.scene.add(new AmbientLight(0xffffff, 1.6));
    const key = new DirectionalLight(0xffffff, 1.4); key.position.set(0.5, 1, 0.8); this.scene.add(key);
    const config = characters[actor.characterIndex % characters.length];
    for (const id of weaponIds) {
      const vm = createViewmodel(id, config, { holdSide: 'right' });
      vm.visible = false;
      this.scene.add(vm);
      this.models.set(id, vm);
      const muzzle = vm.getObjectByName('muzzle');
      if (muzzle) {
        const flash = new Mesh(flashGeometry, flashMaterial);
        flash.visible = false;
        muzzle.add(flash);
        this.flashes.set(id, flash);
      }
    }
  }

  /** Is the held weapon's viewmodel drawn (false when dead or scoped with the sniper)? */
  activeVisible(): boolean { return this.active ? this.models.get(this.active)!.visible : false; }

  /** Show every model and flash (used once to pre-compile shaders), or hide them again. */
  setAllVisible(visible: boolean): void {
    for (const m of this.models.values()) m.visible = visible;
    for (const f of this.flashes.values()) f.visible = visible;
    if (!visible) this.active = null;
  }

  sync(actor: Actor, time: number, aspect: number, ads = 0): void {
    if (this.camera.aspect !== aspect) { this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); }
    const slot = actor.slots[actor.active], id = slot.stats.id;
    if (id !== this.active) {
      if (this.active) this.models.get(this.active)!.visible = false;
      this.active = id;
    }
    const vm = this.models.get(id)!;
    const s = this.state, fireT = actor.fireAnimLeft / slot.stats.fireAnimTime;
    s.fire = fireT; s.reload = reloadProgress(slot); s.cycle = cycleProgress(slot);
    s.equip = slot.stats.equipTime > 0 ? 1 - actor.equipLeft / slot.stats.equipTime : 1;
    s.ads = ads;
    s.moveSpeed = actor.moveFraction; s.strafe = actor.moveLocalX * actor.moveFraction;
    s.grounded = actor.grounded; s.crouching = actor.crouching; s.aimPitch = actor.pitch; s.time = time;
    poseViewmodel(vm, s); // also hides the sniper viewmodel when scoped
    if (!actor.alive) vm.visible = false;
    const flash = this.flashes.get(id);
    if (flash) {
      flash.visible = actor.alive && fireT > 1 - EFFECTS.muzzleFlashFraction;
      flash.rotation.z = time * 37; // cheap variation
    }
  }
}

interface Timed { obj: Object3D; life: number }

/** Bullet tracers and impact puffs from pooled meshes. */
export class ShotEffects {
  readonly group = new Group();
  private tracers: Timed[] = [];
  private impacts: Timed[] = [];
  private nextTracer = 0;
  private nextImpact = 0;
  private readonly start = new Vector3();
  private readonly end = new Vector3();

  constructor(tracerMaterial: MeshBasicMaterial, impactMaterial: MeshBasicMaterial, unitBox: BoxGeometry) {
    for (let i = 0; i < EFFECTS.tracerPool; i++) {
      const m = new Mesh(unitBox, tracerMaterial); m.visible = false; m.frustumCulled = false;
      this.group.add(m); this.tracers.push({ obj: m, life: 0 });
    }
    for (let i = 0; i < EFFECTS.impactPool; i++) {
      const m = new Mesh(unitBox, impactMaterial); m.visible = false; m.scale.setScalar(EFFECTS.impactSize);
      this.group.add(m); this.impacts.push({ obj: m, life: 0 });
    }
  }

  /** `from` = visual muzzle position. */
  addShot(shot: ShotEvent, from: Vector3): void {
    this.end.set(shot.ex, shot.ey, shot.ez);
    const len = from.distanceTo(this.end);
    if (len > 0.3) {
      const t = this.tracers[this.nextTracer]; this.nextTracer = (this.nextTracer + 1) % this.tracers.length;
      const o = t.obj;
      o.position.copy(from).add(this.end).multiplyScalar(0.5);
      o.lookAt(this.end);
      o.scale.set(EFFECTS.tracerWidth, EFFECTS.tracerWidth, len);
      o.visible = true; t.life = EFFECTS.tracerLife;
    }
    if (shot.hitKind === 'world') {
      const p = this.impacts[this.nextImpact]; this.nextImpact = (this.nextImpact + 1) % this.impacts.length;
      p.obj.position.copy(this.end); p.obj.visible = true; p.life = EFFECTS.impactLife;
    }
  }

  update(dt: number): void {
    for (const t of this.tracers) if (t.life > 0) { t.life -= dt; if (t.life <= 0) t.obj.visible = false; }
    for (const p of this.impacts) if (p.life > 0) { p.life -= dt; if (p.life <= 0) p.obj.visible = false; }
  }

  /** Show or hide every pooled mesh (used once to pre-compile shaders). */
  setAllVisible(visible: boolean): void {
    for (const t of this.tracers) t.obj.visible = visible;
    for (const p of this.impacts) p.obj.visible = visible;
  }

  /** Scratch start vector for callers. */
  get scratchStart(): Vector3 { return this.start; }
}

interface Marker { group: Group; tile: Mesh }

/**
 * Death markers: a flat translucent tile with a box cross where a player died, until they respawn.
 * Render-only (not in physics or hit tests), no shadows. Colour = ally / enemy as seen by the local player.
 */
export class DeathMarkers {
  readonly group = new Group();
  private markers = new Map<number, Marker>();
  private readonly tileGeo: BoxGeometry;
  private readonly barGeo: BoxGeometry;
  private readonly allyMat: MeshBasicMaterial;
  private readonly enemyMat: MeshBasicMaterial;
  private readonly crossMat: MeshBasicMaterial;

  constructor() {
    const m = DEATH.marker;
    this.tileGeo = new BoxGeometry(m.size, m.height, m.size);
    this.barGeo = new BoxGeometry(m.crossLength, m.height * 2, m.crossWidth);
    const mat = (color: string, opacity: number) => new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    this.allyMat = mat(TEAM_COLORS.ally, m.opacity);
    this.enemyMat = mat(TEAM_COLORS.enemy, m.opacity);
    this.crossMat = mat('#ffffff', m.crossOpacity);
  }

  private create(): Marker {
    const group = new Group(), tile = new Mesh(this.tileGeo, this.allyMat);
    group.add(tile);
    for (const angle of [Math.PI / 4, -Math.PI / 4]) {
      const bar = new Mesh(this.barGeo, this.crossMat);
      bar.rotation.y = angle; bar.position.y = DEATH.marker.height;
      group.add(bar);
    }
    group.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
    this.group.add(group);
    return { group, tile };
  }

  /** Call every frame for every player. Places the marker once at death, removes it when alive again. */
  update(id: number, alive: boolean, x: number, y: number, z: number, ally: boolean): void {
    let m = this.markers.get(id);
    if (alive) { if (m) m.group.visible = false; return; }
    if (!m) { m = this.create(); this.markers.set(id, m); m.group.visible = false; }
    if (!m.group.visible) {
      m.group.position.set(x, y + DEATH.marker.lift, z);
      m.tile.material = ally ? this.allyMat : this.enemyMat;
      m.group.visible = true;
    }
  }

  /** Remove the marker of a player who left. */
  remove(id: number): void {
    const m = this.markers.get(id);
    if (m) { this.group.remove(m.group); this.markers.delete(id); }
  }

  /** Visible markers (tests). */
  get count(): number { let n = 0; for (const m of this.markers.values()) if (m.group.visible) n++; return n; }

  dispose(): void {
    this.tileGeo.dispose(); this.barGeo.dispose(); this.allyMat.dispose(); this.enemyMat.dispose(); this.crossMat.dispose();
  }
}
