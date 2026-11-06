import type { BufferGeometry, Group, Mesh, Object3D, SkinnedMesh } from 'three';
import type { HexColor, Vec3, HoldSide, PoseState } from '../characters/types';
import type { SkinTraits } from './skinTraits';
export type { HoldSide } from '../characters/types';

export type WeaponId = 'knife' | 'pistol' | 'rifle' | 'sniper' | 'shotgun' | 'beam' | 'bouncer' | 'slingshot' | 'rail' | 'splat' | 'paintGrenade';
export type WeaponKind = WeaponId;
export type AnimatedPart = 'mag' | 'slide' | 'bolt' | 'pump' | 'heat' | 'alarm' | 'bandL' | 'bandR' | 'pouch' | 'coil0' | 'coil1' | 'coil2' | 'coil3' | 'paint';
export interface WeaponPalette {
  steel: HexColor;
  top: HexColor;
  shadow: HexColor;
  grip: HexColor;
  outline: HexColor;
  accent: HexColor;
  accentTop: HexColor;
  glass: HexColor;
  glassTop: HexColor;
}
export interface WeaponBox {
  size: Vec3;
  position: Vec3;
  color: keyof WeaponPalette;
  top?: keyof WeaponPalette;
  side?: keyof WeaponPalette;
  /** At most ONE local axis; applied before translation. */
  rotate?: readonly ['x' | 'y' | 'z', number];
  glow?: boolean;
}
export interface PartSpec { position: Vec3; boxes: readonly WeaponBox[] }
export interface LensSpec { id:string; boxes:readonly WeaponBox[]; part?:AnimatedPart; viewmodelHidden?:boolean }
export interface WeaponConfig {
  /** Visual optic data only. No gameplay/zoom logic. */
  sight?: { position: Vec3; part?: AnimatedPart };
  adsFovHint?: number;
  /** Visual world-camera FOV at full ADS, in degrees. Absent for the knife. */
  adsFov?: number;
  /** False when a one-sided mechanism/detail must retain its handedness. */
  mirrorSafe: boolean;
  id: WeaponId;
  kind: WeaponKind;
  displayName: string;
  palette: Readonly<WeaponPalette>;
  /** Visual reference distance, NOT a gameplay range. */
  tipDistance: number;
  hold: { position: Vec3; rotation: Vec3 };
  /** Positive local Z behind the main grip, including the outline. */
  stockBack: number;
  muzzle: Vec3;
  foregrip?: Vec3;
  /** Rifle/sniper/shotgun alias the foregrip; pistol has its own support point. */
  supportGrip?: Vec3;
  lenses?:readonly LensSpec[];
  ejectPort?: Vec3;
  body: readonly WeaponBox[];
  parts: Partial<Record<AnimatedPart, PartSpec>>;
}
export interface WeaponOptions { skin?:SkinTraits; lod?:'near'|'far'; palette?: Partial<WeaponPalette>; /** Internal sniper rendering variant; defaults to the world model. */ viewmodel?: boolean }
export interface ViewmodelOptions { holdSide?: HoldSide; skin?:SkinTraits }
export interface WeaponState {
  /** Visual inputs only; caller owns heat, cooldown, ammunition and throw logic. */
  heat?: number;
  charge?: number;
  paintLevel?: number;
  throw?: number;
  /** Explicit visual clock for overheat flashing; seconds. */
  time?: number;
  fire: number;
  reload: number | null;
  cycle: number | null;
  equip: number;
}
export interface ViewmodelState extends WeaponState {
  holdSide?: HoldSide;
  ads?: number;
  moveSpeed: number;
  strafe: number;
  grounded: boolean;
  crouching: boolean;
  aimPitch: number;
  time: number;
}
export interface WeaponRuntime {
  skinGain?:number;
  skinRig?:{bones:readonly import('three').Bone[];sources:readonly Object3D[]};
  farRig?:{bones:readonly import('three').Bone[];sources:readonly Object3D[]};
  skin?:SkinTraits;
  skinLights?:readonly Mesh[];
  characterPose?: PoseState;
  visualParts?: Partial<Record<AnimatedPart, Group>>;
  isSniperViewmodel?: true;
  scopeBody?: SkinnedMesh;
  scopeRear?: Mesh;
  scopeLensFront?: Mesh;
  scopeLensRear?: Mesh;
  holdMirror?: boolean;
  sightAxis: Object3D | null;
  adsFovHint: number | null;
  weaponId: WeaponId;
  kind: WeaponKind;
  muzzle: Object3D;
  foregrip: Object3D | null;
  supportGrip: Object3D | null;
  ejectPort: Object3D | null;
  mag: Group | null;
  slide: Group | null;
  bolt: Group | null;
  pump: Group | null;
  rest: Partial<Record<AnimatedPart, Vec3>>;
  palette: Readonly<WeaponPalette>;
}
export interface ViewmodelRuntime {
  holdSide: HoldSide;
  weapon: Group;
  hands: Group;
  rightHand: Group;
  leftHand: Group;
  characterId: string;
  handGeometry: readonly BufferGeometry[];
  palmL:Vec3;
  palmR:Vec3;
}
