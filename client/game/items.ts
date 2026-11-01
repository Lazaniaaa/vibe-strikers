// Items on the ground (weapon drops, Cornucopia loot): world weapon models from createWeapon, small box models for
// medkit / boots / ammo, a box pedestal under loot; all slowly spinning. Pooled per model; nothing allocated per frame.
import { BoxGeometry, Group, Mesh, MeshLambertMaterial, MeshBasicMaterial, type Object3D } from 'three';
import { createWeapon, type WeaponId } from '../../src/weapons';
import { CORNUCOPIA, ITEMS } from '../../src/config/items';

export interface ItemLike { id: number | bigint; x: number; y: number; z: number; kind: string; weapon: string; pedestal?: boolean }

const box = new BoxGeometry(1, 1, 1);
const mats = {
  medkit: new MeshLambertMaterial({ color: '#f4f4f4' }), cross: new MeshLambertMaterial({ color: '#d8262c' }),
  boots: new MeshLambertMaterial({ color: '#3d4a5c' }), flame: new MeshLambertMaterial({ color: CORNUCOPIA.glowColor, emissive: CORNUCOPIA.glowColor }),
  ammo: new MeshLambertMaterial({ color: '#6b7a3a' }), brass: new MeshLambertMaterial({ color: '#d9b440' }),
  pedestal: new MeshLambertMaterial({ color: ITEMS.pedestalColor }),
  glow: new MeshBasicMaterial({ color: CORNUCOPIA.glowColor, transparent: true, opacity: 0.85, depthWrite: false }),
};

function part(mat: MeshLambertMaterial, w: number, h: number, d: number, x = 0, y = 0, z = 0): Mesh {
  const m = new Mesh(box, mat); m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true; return m;
}

/** Placeholder box models (no asset exists for them): medkit, rocket boots, pistol ammo. */
function boxModel(kind: string): Object3D {
  const g = new Group();
  if (kind === 'medkit') {
    g.add(part(mats.medkit, 0.42, 0.26, 0.3));
    g.add(part(mats.cross, 0.26, 0.27, 0.07), part(mats.cross, 0.07, 0.27, 0.2));
  } else if (kind === 'boots') {
    for (const sx of [-0.1, 0.1]) {
      g.add(part(mats.boots, 0.14, 0.24, 0.16, sx, 0, 0), part(mats.boots, 0.14, 0.08, 0.3, sx, -0.08, -0.07));
      g.add(part(mats.flame, 0.1, 0.06, 0.1, sx, -0.15, 0.02));
    }
  } else {
    g.add(part(mats.ammo, 0.3, 0.18, 0.2));
    for (let i = 0; i < 3; i++) g.add(part(mats.brass, 0.05, 0.08, 0.05, -0.08 + i * 0.08, 0.12, 0));
  }
  return g;
}

interface View { model: Object3D; key: string; seen: number; phase: number; pedestal: Object3D | null }

export class ItemViews {
  readonly group = new Group();
  private views = new Map<unknown, View>();
  private pool = new Map<string, Object3D[]>();
  private stamp = 0;

  private take(key: string): Object3D {
    const free = this.pool.get(key);
    const m = free && free.length ? free.pop()!
      : key === 'pedestal' ? part(mats.pedestal, ITEMS.pedestalSize, ITEMS.pedestalHeight, ITEMS.pedestalSize)
      : key.startsWith('box:') ? boxModel(key.slice(4)) : createWeapon(key as WeaponId);
    if (key !== 'pedestal') m.scale.setScalar(ITEMS.weaponScale);
    this.group.add(m);
    return m;
  }

  /** Call every frame with all items (a Map or an array; works with forEach, no allocation). */
  sync(items: { forEach(cb: (it: ItemLike) => void): void }, time: number): void {
    this.stamp++;
    this.time = time;
    items.forEach(this.visit);
    this.views.forEach(this.sweep);
  }

  private readonly sweep = (v: View, id: unknown): void => { if (v.seen !== this.stamp) this.release(id, v); };

  private time = 0;
  private readonly visit = (it: ItemLike): void => {
    const key = it.kind === 'weapon' ? it.weapon : `box:${it.kind}`;
    let v = this.views.get(it.id);
    if (v && v.key !== key) { this.release(it.id, v); v = undefined; }
    if (!v) {
      v = { model: this.take(key), key, seen: 0, phase: (Number(it.id) * 1.7) % (Math.PI * 2), pedestal: it.pedestal ? this.take('pedestal') : null };
      if (v.pedestal) v.pedestal.position.set(it.x, it.y + ITEMS.pedestalHeight / 2, it.z);
      this.views.set(it.id, v);
    }
    v.seen = this.stamp;
    const m = v.model, t = this.time, base = it.y + (v.pedestal ? ITEMS.pedestalHeight : 0);
    m.position.set(it.x, base + ITEMS.modelHeight + Math.sin(t * ITEMS.bobSpeed + v.phase) * ITEMS.bobHeight, it.z);
    m.rotation.set(0, t * ITEMS.spinSpeed + v.phase, 0);
  };

  get count(): number { return this.views.size; }

  private release(id: unknown, v: View): void {
    if (v.pedestal) { this.group.remove(v.pedestal); this.free('pedestal', v.pedestal); }
    this.group.remove(v.model);
    let free = this.pool.get(v.key);
    if (!free) { free = []; this.pool.set(v.key, free); }
    free.push(v.model);
    this.views.delete(id);
  }

  private free(key: string, m: Object3D): void {
    let list = this.pool.get(key);
    if (!list) { list = []; this.pool.set(key, list); }
    list.push(m);
  }
}

/** Rocket-boots glow: a small glowing box under the feet while boosting (placeholder: no boot sockets yet). */
export class BootGlows {
  readonly group = new Group();
  private meshes = new Map<unknown, Mesh>();
  private stamp = 0;
  private seen = new Map<unknown, number>();
  private readonly geo = new BoxGeometry(CORNUCOPIA.glowSize, CORNUCOPIA.glowHeight, CORNUCOPIA.glowSize);

  begin(): void { this.stamp++; }

  /** Show the glow for `id` at the feet (call between begin and end for every boosting player). */
  show(id: unknown, x: number, y: number, z: number): void {
    let m = this.meshes.get(id);
    if (!m) { m = new Mesh(this.geo, mats.glow); this.meshes.set(id, m); this.group.add(m); }
    m.visible = true;
    m.position.set(x, y + CORNUCOPIA.glowHeight / 2, z);
    this.seen.set(id, this.stamp);
  }

  end(): void { this.meshes.forEach(this.hideOld); }
  private readonly hideOld = (m: Mesh, id: unknown): void => { if (this.seen.get(id) !== this.stamp) m.visible = false; };

  get visibleCount(): number { let n = 0; this.meshes.forEach((m) => { if (m.visible) n++; }); return n; }
}
