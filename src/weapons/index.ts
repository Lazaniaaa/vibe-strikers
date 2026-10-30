export { weaponIds, weapons } from './weapons';
export { createWeapon, disposeWeaponResources } from './createWeapon';
export { poseWeapon } from './poseWeapon';
export { attachWeapon } from './hold';
export { createViewmodel, poseViewmodel } from './viewmodel';
export { ADS_DISTANCE, SNIPER_ADS_DISTANCE, HIP_FOV, fovForAds, adsSensitivityScale } from './ads';
export { createScopeOverlay, scopeOverlaySvg, scopeOverlayOpacity } from './scopeOverlay';
export type { ScopeOverlayOptions } from './scopeOverlay';
export { measureViewmodelClearAngle } from './measureView';
export { measureSniperScopeCoverage, measureSniperAdsView, sniperScopeSize } from './sniperScopeMetrics';
export type { WeaponId, WeaponKind, WeaponConfig, WeaponPalette, WeaponOptions,
  WeaponState, WeaponRuntime, ViewmodelState, ViewmodelRuntime, ViewmodelOptions, HoldSide } from './types';
