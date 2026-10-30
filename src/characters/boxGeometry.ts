import { BoxGeometry, Color, Float32BufferAttribute } from 'three';
import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { HexColor, Vec3 } from './types';

const unitBox = new BoxGeometry(1, 1, 1);
/** BoxGeometry only; exact original 01 order, assembled outside the frame loop. */
export class Boxes {
  private boxes: BufferGeometry[] = [];
  constructor(private unitScale = 1) {}
  add(size: Vec3, at: Vec3, color: HexColor, top = color): void {
    const g = unitBox.clone();
    g.scale(size[0], size[1], size[2]);
    g.translate(at[0], at[1], at[2]);
    const normals = g.getAttribute('normal');
    const rgb = new Float32Array(normals.count * 3);
    const baseColor = new Color(color);
    const topColor = new Color(top);
    for (let i = 0; i < normals.count; i++) {
      const c = normals.getY(i) > 0.5 ? topColor : baseColor;
      rgb[i * 3] = c.r; rgb[i * 3 + 1] = c.g; rgb[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new Float32BufferAttribute(rgb, 3));
    this.boxes.push(g);
  }
  outlined(size: Vec3, at: Vec3, color: HexColor, edge: HexColor, top = color,
    border = 0.012, side = color): void {
    const [w, h, d] = size;
    const [x, y, z] = at;
    const e = 0.001 * this.unitScale;
    this.add([w, h - e * 2, d], [x, y - e, z], edge);
    this.add([w - 2 * border, h - 2 * border, e], [x, y, z - d / 2 - e / 2], color);
    this.add([w - 2 * border, h - 2 * border, e], [x, y, z + d / 2 + e / 2], color);
    this.add([e, h - 2 * border, d - 2 * border], [x - w / 2 - e / 2, y, z], side);
    this.add([e, h - 2 * border, d - 2 * border], [x + w / 2 + e / 2, y, z], side);
    this.add([w - 2 * border, e, d - 2 * border], [x, y + h / 2 - e / 2, z], top);
  }
  finish(name: string): BufferGeometry {
    const g = mergeGeometries(this.boxes, false);
    if (!g) throw new Error(`Cannot merge character part: ${name}`);
    for (const box of this.boxes) box.dispose();
    this.boxes.length = 0;
    g.name = name;
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}
