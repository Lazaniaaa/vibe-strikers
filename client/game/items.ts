// Items on the ground (weapon drops): world weapon models from createWeapon, slowly spinning.
// Models are pooled per weapon id; nothing is allocated per frame.
import { Group, type Object3D } from 'three';
import { createWeapon, type WeaponId } from '../../src/weapons';
import { ITEMS } from '../../src/config/items';

export interface ItemLike { id: number | bigint; x: number; y: number; z: number; kind: string; weapon: string }

interface View { model: Object3D; key: string; seen: number; phase: number }

export class ItemViews {
  readonly group = new Group();
  private views = new Map<unknown, View>();
  private pool = new Map<string, Object3D[]>();
  private stamp = 0;

  private take(key: string): Object3D {
    const free = this.pool.get(key);
    const m = free && free.length ? free.pop()! : createWeapon(key as WeaponId);
    m.scale.setScalar(ITEMS.weaponScale);
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
    const key = it.weapon;
    let v = this.views.get(it.id);
    if (v && v.key !== key) { this.release(it.id, v); v = undefined; }
    if (!v) {
      v = { model: this.take(key), key, seen: 0, phase: (Number(it.id) * 1.7) % (Math.PI * 2) };
      this.views.set(it.id, v);
    }
    v.seen = this.stamp;
    const m = v.model, t = this.time;
    m.position.set(it.x, it.y + ITEMS.modelHeight + Math.sin(t * ITEMS.bobSpeed + v.phase) * ITEMS.bobHeight, it.z);
    m.rotation.set(0, t * ITEMS.spinSpeed + v.phase, 0);
  };

  get count(): number { return this.views.size; }

  private release(id: unknown, v: View): void {
    this.group.remove(v.model);
    let free = this.pool.get(v.key);
    if (!free) { free = []; this.pool.set(v.key, free); }
    free.push(v.model);
    this.views.delete(id);
  }
}
