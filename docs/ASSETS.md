# ASSETS.md — what exists in src/characters, src/weapons, src/maps

Finished by another agent (Codex), approved by the owner. DO NOT EDIT those folders.
This file is a short summary. If it disagrees with a folder README or the code,
the README / code wins: fix this file and tell the owner. Facts here come from the
approval sessions, not from reading the code, so verify before relying on exact names.

## Preview pages (Voxel Lab, run with Vite from `tools/`)
`?grid=1` characters, `?weapons=1` weapons + first-person viewmodel, `?map=1` map.
Use them to see assets in isolation. They are not part of the game build.

## Characters (`src/characters/`)
- 33 characters: 01 "Malynovyi" + 32 `vibe-vibers-*`. List: `characters`.
- `createCharacter(config): Group` outer group (game owns position/yaw/scale),
  child `rig` owned by `poseCharacter`. Parts: head, torso, armL, armR, legL, legR,
  `weaponSocket` on armR. `userData` holds the part pivots and `phase`.
- `poseCharacter(group, state, dt)` state (all optional fields must be finite):
  `{speed, moveDir:{x,z}, aimPitch, shooting, crouching, grounded, dead, weapon?, fire?, reload?, cycle?, holdSide?}`.
  Pure function of state + `group.userData.phase` (the game advances phase).
  Never moves the outer transform. Head follows 0.6 x aimPitch, max 35 deg.
- `weapon` (`'knife'|'pistol'|'rifle'|'sniper'|'shotgun'|null`): firearms get two-handed
  HIP hold with a long-arm geometry variant (swapped inside, no allocation).
  Do not pass any `ads` here.
- Body 1.80 m tall (head box top to feet), at most 8 meshes, one shared Lambert
  material, geometry cache. Call `disposeCharacterResources()` only when no
  character remains.
- Not built: emotes, rocket-boot flame sockets.

## Weapons (`src/weapons/`) — visuals only
- Ids: knife, pistol, rifle, sniper, shotgun. `weaponIds`, `weapons` (display data),
  `createWeapon(id, {palette?})`: origin = main grip centre, barrel along -Z, named
  children `muzzle`, `foregrip`/`supportGrip`, `ejectPort`, `sightAxis`, animated
  parts `mag`, `slide`, `bolt`, `pump` where they exist.
- `poseWeapon(weapon, {fire, reload, cycle, equip})` pure, progress values 0..1 from
  the game.
- First person: `createViewmodel(weaponId, characterConfig)` and
  `poseViewmodel(viewmodel, {moveSpeed, strafe, grounded, crouching, fire, reload,
  cycle, equip, aimPitch, time, ads, holdSide})`. HIP side 'right' or 'left',
  `ads` 0..1 blends to the centred sight. Render the viewmodel as a separate pass /
  layer (see the weapons README for react-three-fiber), near plane 0.05.
- ADS data: `fovForAds(weaponId, ads)` (hip FOV 70 in the preview; game FOV setting is
  separate, scale from it), `adsSensitivityScale`, `ADS_DISTANCE`, `adsFov`
  (sniper 28, rifle 55, shotgun 62, pistol 60; knife none).
- Sniper scope: 2D overlay `createScopeOverlay` / `scopeOverlaySvg` /
  `scopeOverlayOpacity(ads)`; viewmodel hidden at ads >= 0.9.
- Glass lenses use one extra shared transparent material.

## Map (`src/maps/`)
- "Toy Town": `mapIds`, `loadMapData(id)`, `buildMap(data)` (render group, merged
  chunks), `mapColliders(data)` (boxes for Rapier AND server), `mapShotBlockers(data)`,
  `spawnPoints(data, team)`, `disposeMapResources()`. Data: `src/maps/data/*.json`
  (boxes, prefab instances, spawns A/B/ffa, lootSpots, zones, bounds, killY, light).
- About 70 x 70 m, mirror-symmetric, spawns ~57 m apart; routes MID ~80-95 m, side
  lanes 110-140 m. Walk speed 4.8 m/s is assumed by the route numbers.
- Budget at approval: < 60 draw calls, < 140k triangles. No gameplay numbers inside.
- Palette: warm = team A half, cool = team B half. A one-tone palette also exists.
