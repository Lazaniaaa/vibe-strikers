import type { BufferGeometry, Group, Mesh, Object3D } from 'three';

export type HexColor = `#${string}`;
export type Vec3 = readonly [number, number, number];
export type HoldSide = 'right' | 'left';
export type PartName = 'head' | 'torso' | 'armL' | 'armR' | 'legL' | 'legR';
export type ComponentName = 'head' | 'torso' | 'arm' | 'hand' | 'leg' | 'foot';
export type PhysicalComponent = 'head' | 'torso' | 'armL' | 'handL' | 'armR' | 'handR' | 'legL' | 'footL' | 'legR' | 'footR';
export type CharacterColors = Readonly<Record<string, HexColor>>;

export interface Surface {
  color: HexColor;
  topColor?: HexColor;
  /** Sampled shading on symmetric side faces, never a texture. */
  sideColor?: HexColor;
}
export interface BoxSpec extends Surface {
  part: PartName;
  size: Vec3;
  /** Local to the named pivot, in pre-normalization template units. */
  position: Vec3;
  glow?: boolean;
  outlineColor?: HexColor;
  border?: number;
}
export interface CharacterConfig {
  holdReach?: {leftExtra:number;rightExtra:number};
  id: string;
  name: string;
  colors: CharacterColors;
  proportions?: Partial<Record<ComponentName, Vec3>> & {
    sides?: Partial<Record<Exclude<PhysicalComponent, 'head' | 'torso'>, Vec3>>;
  };
  surfaces?: Partial<Record<ComponentName | PhysicalComponent, Surface>>;
  layout?: {
    pivots?: Partial<Record<PartName, Vec3>>;
    centers?: Partial<Record<PhysicalComponent, Vec3>>;
    weaponSocket?: Vec3;
  };
  extras: readonly BoxSpec[];
  flags?: readonly string[];
}
export interface PoseState {
  /** Stage A temporary ready hold; absent/null preserves every approved old pose. */
  weapon?: 'knife' | 'pistol' | 'rifle' | 'sniper' | 'shotgun' | null;
  fire?: number;
  reload?: number | null;
  cycle?: number | null;
  speed: number;
  /** Relative to facing -Z: +X = right, +Z = backward. */
  moveDir: { x: number; z: number };
  /** Radians, positive = up. Input clamps to +/-89deg; visible head = 0.6x, max +/-35deg. */
  aimPitch: number;
  shooting: boolean;
  crouching: boolean;
  grounded: boolean;
  dead: boolean;
}
export interface Extent {
  /** Rest rig-space for bodyExtents; joint-local for foot support bounds. */
  min: Vec3;
  max: Vec3;
  width: number;
  height: number;
  depth: number;
}
export interface BodyExtents {
  /** Base head, torso, limbs, hands, feet only. NO extras/glow. */
  total: Extent;
  parts: Readonly<Record<PartName, Extent>>;
  headBox: { width: number; height: number; depth: number };
}
export interface CharacterParts {
  rig: Group;
  head: Group;
  torso: Group;
  armL: Group;
  armR: Group;
  legL: Group;
  legR: Group;
  weaponSocket: Object3D;
  weaponSocketL: Object3D;
}
export interface CharacterRuntime extends CharacterParts {
  weaponSocketRest: {R:Vec3;L:Vec3};
  weaponBinding?: { mount: Group; weapon: Group; id: string; side: 'right'; mirrored: false };
  armVariants: {
    variantsL: readonly ArmLengthVariant[]; variantsR: readonly ArmLengthVariant[];
    holdLengths: {L:number;R:number};
    selectedL: ArmLengthVariant; selectedR: ArmLengthVariant;
    active: boolean;
    meshL: Mesh; meshR: Mesh;
    normalL: BufferGeometry; normalR: BufferGeometry;
    longL: BufferGeometry; longR: BufferGeometry;
    handL: Extent; handR: Extent;
    upperL: Extent; upperR: Extent;
    jointGapL: number; jointGapR: number;
  };
  characterId: string;
  configKey: string;
  /** Sole public animation clock, in radians. */
  phase: number;
  restPose: Readonly<Record<PartName, Vec3>>;
  dimensions: {
    /** Head-local visual eye height, inferred once from configured eye/lens boxes. */
    eyeY: number;
    normalization: number;
    components: Readonly<Record<PhysicalComponent, Vec3>>;
    /** Rendered side support includes extras; bodyExtents below excludes them. */
    deathSupport: number;
    footL: Extent;
    footR: Extent;
    /** Actual outlined right fist, joint-local; construction-time support data. */
    handR: Extent;
    handL: Extent;
  };
  bodyExtents: BodyExtents;
  flags: readonly string[];
}
export interface ArmLengthVariant {
  collisionPoints: Float32Array;
  extra: number;
  geometry: BufferGeometry;
  hand: Extent;
  upper: Extent;
  gap: number;
}
