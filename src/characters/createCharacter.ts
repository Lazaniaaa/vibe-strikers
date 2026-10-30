import { Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, Object3D } from 'three';
import type { BufferGeometry } from 'three';
import { Boxes } from './boxGeometry';
import { ARM_LONG_EXTRA, ARM_MIN_EXTRA, ARM_MAX_EXTRA, ARM_LENGTH_STEP, ARM_SHOULDER_ZONE, chooseHoldLengths } from './armVariants';
import type { BodyExtents, BoxSpec, CharacterConfig, CharacterRuntime, ComponentName,
  Extent, PartName, PhysicalComponent, Surface, Vec3 } from './types';

export const BODY_HEIGHT = 1.8;
export const PART_NAMES: readonly PartName[] = ['head', 'torso', 'armL', 'armR', 'legL', 'legR'];
const COMPONENTS: readonly PhysicalComponent[] = ['head', 'torso', 'armL', 'handL',
  'armR', 'handR', 'legL', 'footL', 'legR', 'footR'];
const COMPONENT_PART: Record<PhysicalComponent, PartName> = {
  head: 'head', torso: 'torso', armL: 'armL', handL: 'armL', armR: 'armR', handR: 'armR',
  legL: 'legL', footL: 'legL', legR: 'legR', footR: 'legR',
};
export const DEFAULT_PROPORTIONS: Readonly<Record<ComponentName, Vec3>> = Object.freeze({
  head: [1.08, 0.91, 0.80], torso: [0.69, 0.48, 0.44],
  arm: [0.23, 0.245, 0.28], hand: [0.44, 0.40, 0.42],
  leg: [0.22, 0.31, 0.25], foot: [0.235, 0.12, 0.34],
} as const);
const DEFAULT_PIVOTS: Readonly<Record<PartName, Vec3>> = {
  head: [0, 0.89, 0], torso: [0, 0.89, 0], armL: [-0.58, 0.84, 0],
  armR: [0.58, 0.84, 0], legL: [-0.195, 0.41, 0], legR: [0.195, 0.41, 0],
};
const DEFAULT_CENTERS: Readonly<Record<PhysicalComponent, Vec3>> = {
  head: [0, 0.455, 0], torso: [0, -0.24, 0],
  armL: [0, -0.105, 0], armR: [0, -0.105, 0],
  handL: [0, -0.40, -0.025], handR: [0, -0.40, -0.025],
  legL: [0, -0.155, 0], legR: [0, -0.155, 0],
  footL: [0, -0.35, -0.035], footR: [0, -0.35, -0.035],
};
const material = new MeshLambertMaterial({ vertexColors: true });
material.name = 'voxel-shared-lambert';
const glowMaterial = new MeshBasicMaterial({ vertexColors: true });
glowMaterial.name = 'voxel-shared-glow';
interface ModelData {
  longArms: Pick<CharacterRuntime['armVariants'], 'longL' | 'longR' | 'handL' | 'handR' | 'upperL' | 'upperR' | 'jointGapL' | 'jointGapR' | 'variantsL' | 'variantsR'>;
  geometry: Record<PartName, BufferGeometry>;
  glow: Partial<Record<PartName, BufferGeometry>>;
  restPose: Record<PartName, Vec3>;
  dimensions: CharacterRuntime['dimensions'];
  bodyExtents: BodyExtents;
  socket: Vec3;
}
const modelCache = new Map<string, ModelData>();
const geometryPool = new Map<string, BufferGeometry>();

/** Stable serialization of the WHOLE config, excluding ONLY id/name. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).filter((k) => record[k] !== undefined).sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(record[k])}`).join(',')}}`;
}
export function characterCacheKey(config: CharacterConfig): string {
  const { id: _id, name: _name, ...appearance } = config;
  return canonical(appearance);
}
function validate(config: CharacterConfig): void {
  const visit = (value: unknown, path: string): void => {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`Non-finite ${path}`);
    if (typeof value === 'string' && (value.startsWith('#') || /color$/i.test(path)) && !/^#[0-9a-f]{6}$/i.test(value)) {
      throw new Error(`Invalid hex ${path}: ${value}`);
    }
    if (Array.isArray(value)) value.forEach((v, i) => visit(v, `${path}.${i}`));
    else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) visit(v, `${path}.${k}`);
    }
  };
  visit(config, config.id);
  for (const color of Object.values(config.colors)) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error(`Invalid hex ${config.id}: ${color}`);
  }
  if (!config.id || !config.name) throw new Error('Character needs id and name');
  if (!config.colors.body || !config.colors.outline) throw new Error(`${config.id}: body/outline required`);
  for (const extra of config.extras) {
    if (!PART_NAMES.includes(extra.part)) throw new Error(`${config.id}: invalid extra part`);
    if (extra.size.some((n) => n <= 0)) throw new Error(`${config.id}: non-positive extra size`);
    const border = extra.border ?? 0.012;
    if (border < 0 || extra.size[0] <= border * 2 || extra.size[1] <= border * 2 || extra.size[2] <= 0.002) {
      throw new Error(`${config.id}: extra is too small for its outline`);
    }
  }
}
const family = (name: PhysicalComponent): ComponentName => name.replace(/[LR]$/, '') as ComponentName;
const scaleVec = (v: Vec3, s: number): Vec3 => s === 1 ? v : [v[0] * s, v[1] * s, v[2] * s];
function extent(min: Vec3, max: Vec3): Extent {
  return { min, max, width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2] };
}
function bounds(geometry: BufferGeometry, pivot: Vec3 = [0, 0, 0]): Extent {
  const b = geometry.boundingBox!;
  return extent([b.min.x + pivot[0], b.min.y + pivot[1], b.min.z + pivot[2]],
    [b.max.x + pivot[0], b.max.y + pivot[1], b.max.z + pivot[2]]);
}
function union(list: readonly Extent[]): Extent {
  return extent([Math.min(...list.map((b) => b.min[0])), Math.min(...list.map((b) => b.min[1])),
    Math.min(...list.map((b) => b.min[2]))],
  [Math.max(...list.map((b) => b.max[0])), Math.max(...list.map((b) => b.max[1])),
    Math.max(...list.map((b) => b.max[2]))]);
}
function geometryFor(boxes: readonly BoxSpec[], s: number, outline: CharacterConfig['colors']['outline'], sharedArms = false): BufferGeometry {
  const key = canonical([s, outline, sharedArms ? boxes.map(({part: _part, ...surface}) => surface) : boxes]);
  const existing = geometryPool.get(key);
  if (existing) return existing;
  const builder = new Boxes(s);
  for (const box of boxes) {
    builder.outlined(scaleVec(box.size, s), scaleVec(box.position, s), box.color,
      box.outlineColor ?? outline, box.topColor ?? box.color, (box.border ?? 0.012) * s,
      box.sideColor ?? box.color);
  }
  const geometry = builder.finish('merged-boxes');
  geometryPool.set(key, geometry);
  return geometry;
}
function build(config: CharacterConfig): ModelData {
  validate(config);
  const sizes = {} as Record<PhysicalComponent, Vec3>;
  const centers = {} as Record<PhysicalComponent, Vec3>;
  const pivots = {} as Record<PartName, Vec3>;
  for (const component of COMPONENTS) {
    const f = family(component);
    sizes[component] = (component !== 'head' && component !== 'torso'
      ? config.proportions?.sides?.[component] : undefined) ?? config.proportions?.[f] ?? DEFAULT_PROPORTIONS[f];
    if (sizes[component].some((n) => !Number.isFinite(n) || n <= 0.025)) {
      throw new Error(`${config.id}: invalid ${component} proportions`);
    }
  }
  const hip = sizes.legL[1] + sizes.footL[1] - 0.02;
  const neck = hip + sizes.torso[1];
  const shoulderY = neck - 0.05 * sizes.torso[1] / 0.48;
  const shoulderX = sizes.torso[0] / 2 + sizes.armL[0] / 2 + 0.12;
  const hipX = sizes.torso[0] * (0.195 / 0.69);
  const automatic: Readonly<Record<PartName, Vec3>> = config.proportions ? {
    head: [0, neck, 0], torso: [0, neck, 0], armL: [-shoulderX, shoulderY, 0],
    armR: [shoulderX, shoulderY, 0], legL: [-hipX, hip, 0], legR: [hipX, hip, 0],
  } : DEFAULT_PIVOTS;
  for (const name of PART_NAMES) pivots[name] = config.layout?.pivots?.[name] ?? automatic[name];
  for (const component of COMPONENTS) {
    const size = sizes[component];
    const f = family(component);
    let center = DEFAULT_CENTERS[component];
    if (config.proportions) {
      if (f === 'head') center = [0, size[1] / 2, 0];
      if (f === 'torso') center = [0, -size[1] / 2, 0];
      if (f === 'arm') center = [0, -size[1] / 2 + 0.0175 * size[1] / 0.245, 0];
      if (f === 'hand') {
        const arm = component === 'handL' ? sizes.armL : sizes.armR;
        center = [0, -arm[1] + 0.045 - size[1] / 2, -0.025];
      }
      if (f === 'leg') center = [0, -size[1] / 2, 0];
      if (f === 'foot') {
        const leg = component === 'footL' ? sizes.legL : sizes.legR;
        center = [0, -(leg[1] + size[1] / 2 - 0.02), -0.035];
      }
    }
    centers[component] = config.layout?.centers?.[component] ?? center;
  }
  const headTop = pivots.head[1] + centers.head[1] + sizes.head[1] / 2;
  let feetBottom = Math.min(pivots.legL[1] + centers.footL[1] - sizes.footL[1] / 2,
    pivots.legR[1] + centers.footR[1] - sizes.footR[1] / 2);
  if (Math.abs(feetBottom) < 1e-12) feetBottom = 0;
  const rawHeight = headTop - feetBottom;
  if (rawHeight <= 0) throw new Error(`${config.id}: invalid feet-to-head height`);
  const s = Math.abs(rawHeight - BODY_HEIGHT) < 1e-12 ? 1 : BODY_HEIGHT / rawHeight;
  const restPose = {} as Record<PartName, Vec3>;
  for (const name of PART_NAMES) {
    const p = pivots[name];
    restPose[name] = s === 1 && feetBottom === 0 ? p : [p[0] * s, (p[1] - feetBottom) * s, p[2] * s];
  }
  const base = Object.fromEntries(PART_NAMES.map((name) => [name, []])) as Record<PartName, BoxSpec[]>;
  for (const component of COMPONENTS) {
    const f = family(component);
    const style: Surface = config.surfaces?.[component] ?? config.surfaces?.[f] ?? {
      color: f === 'hand' || f === 'foot' ? config.colors.glove ?? config.colors.body : config.colors.body,
      topColor: f === 'hand' || f === 'foot' ? config.colors.gloveTop ?? config.colors.top : config.colors.top,
    };
    base[COMPONENT_PART[component]].push({ part: COMPONENT_PART[component], size: sizes[component],
      position: centers[component], ...style, border: f === 'leg' || f === 'foot' ? 0.009 : 0.012 });
  }
  const geometry = {} as Record<PartName, BufferGeometry>;
  const glow: Partial<Record<PartName, BufferGeometry>> = {};
  const bodyParts = {} as Record<PartName, Extent>;
  const rendered: Extent[] = [];
  for (const name of PART_NAMES) {
    const bodyGeometry = geometryFor(base[name], s, config.colors.outline);
    bodyParts[name] = bounds(bodyGeometry, restPose[name]);
    const extras = config.extras.filter((box) => box.part === name && !box.glow);
    const lights = config.extras.filter((box) => box.part === name && box.glow);
    geometry[name] = extras.length ? geometryFor([...base[name], ...extras], s, config.colors.outline) : bodyGeometry;
    rendered.push(bounds(geometry[name], restPose[name]));
    if (lights.length) {
      glow[name] = geometryFor(lights, s, config.colors.outline);
      rendered.push(bounds(glow[name]!, restPose[name]));
    }
  }
  const longArms = {} as ModelData['longArms'];
  for (const side of ['L', 'R'] as const) {
    const variants=[];
    for(let step=0;step<=Math.round((ARM_MAX_EXTRA-ARM_MIN_EXTRA)/ARM_LENGTH_STEP);step++){
    const name = `arm${side}` as 'armL' | 'armR';
    const upper = base[name][0], hand = base[name][1], metricExtra=ARM_MIN_EXTRA+step*ARM_LENGTH_STEP, extra = metricExtra / s;
    const upperBottom = upper.position[1] - upper.size[1] / 2 - extra;
    // Preserve an existing overlap. Close any pre-existing outline-sized gap only in this variant.
    const handY = Math.max(hand.position[1] - extra, upperBottom - hand.size[1] / 2 + .0005 / s);
    const longUpper: BoxSpec = { ...upper, size: [upper.size[0], upper.size[1] + extra, upper.size[2]],
      position: [upper.position[0], upper.position[1] - extra / 2, upper.position[2]] };
    const longHand: BoxSpec = { ...hand, position: [hand.position[0], handY, hand.position[2]] };
    const extras = config.extras.filter(b => b.part === name && !b.glow).map(b => {
      // Accessories attached to the fist follow it; shoulder accessories stay at the shoulder.
      const handAttached = Math.abs(b.position[1] - hand.position[1]) < Math.abs(b.position[1] - upper.position[1]);
      const upperTop=upper.position[1]+upper.size[1]/2;
      const relative=(upperTop-b.position[1])/upper.size[1];
      const fraction=relative<ARM_SHOULDER_ZONE?0:Math.max(0,Math.min(1,relative));
      const shift=handAttached?handY-hand.position[1]:-extra*fraction;
      return { ...b, position: [b.position[0],b.position[1]+shift,b.position[2]] as Vec3 };
    });
    const armGeometry=geometryFor([longUpper, longHand, ...extras], s, config.colors.outline, true);
    armGeometry.name='armLong';
    if(!armGeometry.userData.collisionPoints){
      const points:number[]=[],seen=new Set<string>(),array=armGeometry.attributes.position.array;
      for(let i=0;i<array.length;i+=3){const key=[array[i],array[i+1],array[i+2]].join(',');if(!seen.has(key)){seen.add(key);points.push(array[i],array[i+1],array[i+2]);}}
      armGeometry.userData.collisionPoints=new Float32Array(points);
    }
    const variant={extra:metricExtra,geometry:armGeometry,collisionPoints:armGeometry.userData.collisionPoints as Float32Array,hand:bounds(geometryFor([longHand],s,config.colors.outline)),
      upper:bounds(geometryFor([longUpper],s,config.colors.outline)),gap:Math.max(0,(upperBottom-(handY+hand.size[1]/2))*s)};
    variants.push(variant);
    if(Math.abs(metricExtra-ARM_LONG_EXTRA)<1e-8){
      // Preserve the archived Round-3 .40m hashes; the approved length bank is checked separately.
      const legacyExtras=config.extras.filter(b=>b.part===name&&!b.glow).map(b=>{
        const attached=Math.abs(b.position[1]-hand.position[1])<Math.abs(b.position[1]-upper.position[1]);
        return attached?{...b,position:[b.position[0],b.position[1]+handY-hand.position[1],b.position[2]] as Vec3}:b;
      });
      longArms[`long${side}`]=geometryFor([longUpper,longHand,...legacyExtras],s,config.colors.outline,true);
      longArms[`long${side}`].name='armLong';longArms[`hand${side}`]=variant.hand;
      longArms[`upper${side}`]=variant.upper;longArms[`jointGap${side}`]=variant.gap;
    }
    }
    longArms[`variants${side}`]=variants;
  }
  const footL = bounds(geometryFor([base.legL[1]], s, config.colors.outline));
  const footR = bounds(geometryFor([base.legR[1]], s, config.colors.outline));
  const handR = bounds(geometryFor([base.armR[1]], s, config.colors.outline));
  const handL = bounds(geometryFor([base.armL[1]], s, config.colors.outline));
  const normalizedSizes = Object.fromEntries(COMPONENTS.map((name) => [name, scaleVec(sizes[name], s)])) as Record<PhysicalComponent, Vec3>;
  const head = normalizedSizes.head;
  const eyeColors=Object.entries(config.colors).filter(([key])=>/eye|pupil/i.test(key)).map(([,value])=>value);
  const lensColors=Object.entries(config.colors).filter(([key])=>/lens/i.test(key)).map(([,value])=>value);
  let eyeBoxes=config.extras.filter(b=>b.part==='head'&&b.position[2]<-sizes.head[2]/3&&eyeColors.includes(b.color));
  if(!eyeBoxes.length)eyeBoxes=config.extras.filter(b=>b.part==='head'&&b.position[2]<-sizes.head[2]/3&&lensColors.includes(b.color));
  const eyeWeight=eyeBoxes.reduce((sum,b)=>sum+b.size[0]*b.size[1],0);
  const eyeY=eyeWeight?eyeBoxes.reduce((sum,b)=>sum+b.position[1]*b.size[0]*b.size[1],0)/eyeWeight*s:head[1]*.35;
  const rightHand = centers.handR;
  const socket = config.layout?.weaponSocket ?? (config.proportions
    ? [rightHand[0], rightHand[1] - sizes.handR[1] * 0.125, rightHand[2] - sizes.handR[2] * (0.135 / 0.42)] as Vec3
    : [0, -0.45, -0.16] as Vec3);
  return {
    geometry, glow, restPose, longArms, socket: scaleVec(socket, s),
    dimensions: { normalization: s, components: normalizedSizes, eyeY, deathSupport: union(rendered).max[0], footL, footR, handR, handL },
    bodyExtents: { total: union(Object.values(bodyParts)), parts: bodyParts,
      headBox: { width: head[0], height: head[1], depth: head[2] } },
  };
}
export function createCharacter(config: CharacterConfig): Group {
  const key = characterCacheKey(config);
  const modelKey = canonical([key, ARM_LONG_EXTRA, ARM_MIN_EXTRA, ARM_MAX_EXTRA, ARM_LENGTH_STEP, ARM_SHOULDER_ZONE]);
  let model = modelCache.get(modelKey);
  if (!model) { model = build(config); modelCache.set(modelKey, model); }
  const outer = new Group();
  outer.name = config.id;
  const rig = new Group();
  rig.name = 'rig';
  outer.add(rig);
  const parts = {} as Record<PartName, Group>;
  for (const name of PART_NAMES) {
    const pivot = new Group();
    pivot.name = name;
    const p = model.restPose[name];
    pivot.position.set(p[0], p[1], p[2]);
    const mesh = new Mesh(model.geometry[name], material);
    mesh.name = `${name}-boxes`;
    mesh.castShadow = true;
    pivot.add(mesh);
    if (model.glow[name]) {
      const light = new Mesh(model.glow[name], glowMaterial);
      light.name = `${name}-glow`;
      pivot.add(light);
    }
    rig.add(pivot);
    parts[name] = pivot;
  }
  const weaponSocket = new Object3D();
  weaponSocket.name = 'weaponSocket';
  weaponSocket.position.set(model.socket[0], model.socket[1], model.socket[2]);
  weaponSocket.rotation.x = -Math.PI / 2;
  parts.armR.add(weaponSocket);
  const weaponSocketL = new Object3D();
  weaponSocketL.name = 'weaponSocketL';
  weaponSocketL.position.set(-model.socket[0], model.socket[1], model.socket[2]);
  weaponSocketL.rotation.x = weaponSocket.rotation.x;
  parts.armL.add(weaponSocketL);
  outer.userData = {
    characterId: config.id, configKey: key, phase: 0, rig, ...parts, weaponSocket, weaponSocketL,
    weaponSocketRest:{R:model.socket,L:[-model.socket[0],model.socket[1],model.socket[2]]},
    restPose: model.restPose, dimensions: model.dimensions, bodyExtents: model.bodyExtents,
    flags: config.flags ?? [],
    armVariants: { active: false, meshL: parts.armL.children[0] as Mesh, meshR: parts.armR.children[0] as Mesh,
      normalL: model.geometry.armL, normalR: model.geometry.armR, ...model.longArms,
      selectedL:model.longArms.variantsL[0],selectedR:model.longArms.variantsR[0],
      holdLengths:chooseHoldLengths(model,config.holdReach) },
  } satisfies CharacterRuntime;
  return outer;
}
/** Shared resources: call once after removing all character instances. */
export function disposeCharacterResources(): void {
  for (const g of geometryPool.values()) g.dispose();
  geometryPool.clear(); modelCache.clear();
  material.dispose(); glowMaterial.dispose();
}
