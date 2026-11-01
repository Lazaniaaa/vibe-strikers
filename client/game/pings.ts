// Team ping markers: a yellow diamond + beam drawn through walls for PINGS.duration seconds (pooled meshes).
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { PINGS } from '../../src/config/pings';

interface Marker { group: Group; left: number; label: string; x: number; z: number }

export class PingMarkers {
  readonly group = new Group();
  private markers: Marker[] = [];
  private readonly mat = new MeshBasicMaterial({ color: PINGS.color, depthTest: false, depthWrite: false, transparent: true });
  private readonly diamond = new BoxGeometry(PINGS.size, PINGS.size, PINGS.size);
  private readonly beam = new BoxGeometry(0.05, PINGS.beamHeight, 0.05);

  constructor() {
    for (let i = 0; i < PINGS.maxMarkers; i++) {
      const g = new Group();
      const d = new Mesh(this.diamond, this.mat); d.rotation.set(Math.PI / 4, 0, Math.PI / 4); d.position.y = PINGS.beamHeight; d.renderOrder = 11;
      const b = new Mesh(this.beam, this.mat); b.position.y = PINGS.beamHeight / 2; b.renderOrder = 11;
      g.add(d, b); g.visible = false;
      this.group.add(g);
      this.markers.push({ group: g, left: 0, label: '', x: 0, z: 0 });
    }
  }

  /** Show a ping at (x, y, z); reuses the oldest marker. */
  add(x: number, y: number, z: number, label: string): void {
    let m = this.markers[0];
    for (const k of this.markers) if (k.left < m.left) m = k;
    m.left = PINGS.duration; m.label = label; m.x = x; m.z = z;
    m.group.position.set(x, y, z); m.group.visible = true;
  }

  update(dt: number): void {
    for (const m of this.markers) {
      if (m.left <= 0) continue;
      m.left -= dt;
      if (m.left <= 0) m.group.visible = false;
      else m.group.children[0].rotation.y += dt * 2;
    }
  }

  get count(): number { return this.markers.filter((m) => m.left > 0).length; }

  /** HUD lines for the live pings, with the distance from (x, z). */
  text(x: number, z: number): string {
    return this.markers.filter((m) => m.left > 0).sort((a, b) => b.left - a.left)
      .map((m) => `◆ ${m.label} · ${Math.round(Math.hypot(m.x - x, m.z - z))} m`).join('\n');
  }

  dispose(): void { this.mat.dispose(); this.diamond.dispose(); this.beam.dispose(); }
}
