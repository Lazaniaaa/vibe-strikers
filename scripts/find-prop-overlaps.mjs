// Map check (read-only): list prop instances whose boxes intersect wall boxes, for every map variant.
// Prefab instances are expanded with the same quarter-turn rule as src/maps (analysis only; the map is not changed).
// Usage: node scripts/find-prop-overlaps.mjs [minOverlapMetres]
import { createServer } from 'vite';

const minOverlap = Number(process.argv[2] ?? 0.05);
const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false } });
try {
  const M = await vite.ssrLoadModule('/src/maps/index.ts');
  const overlap = (a, b, axis, size) => Math.min(a[axis] + a[size] / 2, b[axis] + b[size] / 2) - Math.max(a[axis] - a[size] / 2, b[axis] - b[size] / 2);
  for (const id of M.mapIds) {
    const data = M.loadMapData(id);
    const walls = data.boxes.filter((b) => b.kind === 'wall' && b.collide);
    const found = [];
    for (const inst of data.instances) {
      const quarter = ((Math.round(inst.yaw / (Math.PI / 2)) % 4) + 4) % 4;
      for (const b of data.prefabs[inst.prefab]) {
        if (!b.collide) continue;
        let x = b.x, z = b.z;
        if (quarter === 1) { x = b.z; z = -b.x; } else if (quarter === 2) { x = -b.x; z = -b.z; } else if (quarter === 3) { x = -b.z; z = b.x; }
        const box = { x: x + inst.x, y: b.y + inst.y, z: z + inst.z, w: quarter % 2 ? b.d : b.w, h: b.h, d: quarter % 2 ? b.w : b.d };
        for (const w of walls) {
          const ox = overlap(box, w, 'x', 'w'), oy = overlap(box, w, 'y', 'h'), oz = overlap(box, w, 'z', 'd');
          if (ox > minOverlap && oy > minOverlap && oz > minOverlap) {
            found.push({ prefab: inst.prefab, at: [inst.x, inst.z], yaw: +(inst.yaw * 180 / Math.PI).toFixed(0),
              wall: [+w.x.toFixed(2), +w.z.toFixed(2)], overlap: [+ox.toFixed(2), +oy.toFixed(2), +oz.toFixed(2)] });
            break;
          }
        }
      }
    }
    // One line per instance (a prefab has several boxes).
    const seen = new Set();
    const list = found.filter((f) => { const k = `${f.prefab}@${f.at}`; if (seen.has(k)) return false; seen.add(k); return true; });
    console.log(`${id}: ${list.length} prop instance(s) intersect walls`);
    for (const f of list) console.log(`  ${f.prefab} at (${f.at[0]}, ${f.at[1]}) yaw ${f.yaw} deg -> wall at (${f.wall[0]}, ${f.wall[1]}), overlap x/y/z ${f.overlap.join(' / ')} m`);
  }
} finally { await vite.close(); }
