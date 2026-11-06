# Vibe Strikers — six new visual assets

Completed Pixel Beam, Bouncy Blaster, Slingshot, Rail Pixel, Splat Gun and Paint Bomb, with world pickups, all-character holds, first-person hands, ratio-driven details and a fixed-size world-effect pool. This package contains no mechanics, sound, gameplay numbers, primary/throwable inventory rules or screen effects.

## API

See [TOYS.md](TOYS.md) for the short creation/update example and every effect parameter. The key additions are createWeapon(id), the extended poseArmedCharacter adapter, heat/charge/paintLevel/throw visual inputs, and createWeaponEffects(scene,{surfaceBoxes}). Original createViewmodel/poseViewmodel work for all eleven IDs. New effects: beam/hideBeam, bouncer, rail, splat/paintSplash, grenadeArc, paintBurst, update/clear/dispose. Colours accept team hex values.

Paint Bomb has its own ID/kind. Only its main right grip is a contact target; its third-person off-hand remains ready/guarding. The safe approved rifle calibration is reused rather than introducing another frame-time hold search. First person has one visible hand before release. Slingshot charge moves only bands/pouch; it does not alter accuracy or jitter the aim.

## Acceptance results

| Asset | Hold cases | Max fist error, m | Min clearance, m | Meshes | Total triangles |
|---|---:|---:|---:|---:|---:|
| beam | 15,840 | 0.03130 | 0.001478 | 4 | 1080 |
| bouncer | 15,840 | 0.03130 | 0.001478 | 1 | 936 |
| slingshot | 15,840 | 0.03130 | 0.001478 | 4 | 936 |
| rail | 15,840 | 0.03130 | 0.001478 | 5 | 2880 |
| splat | 15,840 | 0.03130 | 0.001478 | 2 | 864 |
| paintGrenade | 15,840 | 0.01982 | 0.001478 | 1 | 576 |

95,040 combinations: 33 characters × 6 assets × idle/run/strafe/back/crouch/jump × aim -89/-45/0/+45/+89 × fire 0/1 × visual ratio 0/1 × four run phases. Clearance uses the exact existing vertex-vs-head/torso-box contract (nominal boxes shrunk by 0.01 m), including both arm meshes. No clearance/fist failures. Dead poses are separately finite-checked, as in the current kit.

4,752 viewmodel cases cover all characters/assets, both sides, fire 0/1, three visual/reload/cycle values, motion/strafe and airborne/crouch inputs. Centre rays stay free of opaque meshes; palms match their grip sockets. Additional checks cover explicit overheat flashing, band endpoints staying attached, 0.31 m pouch travel, throw release, finite/deterministic ratios, geometry sharing/disposal, and allocation syntax in the new hot paths.

The maximum new model uses five merged meshes (rail's four independently driven glow coils plus body); all meshes share the kit materials. The old five-weapon limits are unchanged. No new model has more than 2,880 triangles.

## CPU and pool

- New holds + weapon posing: 13,860 measured calls, worst **0.1168 ms**, first use **4.5237 ms**. Strict budgets remain 0.5 ms / 30 ms. Lengths are fixed; no frame-time fitting/search.
- The benchmark runs in a warmed isolated child process, outside the allocation-heavy geometric oracle. UI WebGL was paused for final timing.
- Effects: at most 3 instanced draws; 4 beams + 32 segments + 96 cubes + 128 decals. Maximum effect geometry submitted is 1,840 triangles. Fully inactive meshes are hidden.
- Saturation/eviction, finite instance matrices, persistent decals, clear and idempotent dispose pass. Browser grenade-arc test reached the floor, produced four persistent patches, and Clear removed them.
- Browser console errors: 0. No screenshots or textures are runtime dependencies. Every new file is below 2 MB.

## Existing kit remains approved

The full node src/weapons/verify.mjs run passed: 396 old poses; 33 default/66 long-arm geometry baselines; 31,680 original HIP phase cases; 826,980 fine-sweep cases; legacy weapon/viewmodel/scope/overlay/cache/dispose contracts; original hot budget 0.3114 ms max. All five legacy configuration/geometry hashes and 1,650 task-entry armed pose snapshots remain identical. The frozen task-entry signatures are toy-legacy-baseline.json. The final toy-only suite was also rerun after final metadata changes.

An earlier timing run was affected by active preview/compilation and failed the unchanged 0.5 ms bound; the final isolated run passed without weakening thresholds.

## Integration boundary

Independent TypeScript checking of the whole weapon preview/API passes. Global npm run typecheck intentionally cannot yet pass without mechanics integration: there are 3 diagnostics at 2 sites — the exhaustive src/config/weapons.ts table is missing the six new IDs, and client/game/visuals.ts still passes the widened WeaponId into the character module's old union. These forbidden files were left untouched. Claude must supply actual mechanics/throwable handling and route new character poses through poseArmedCharacter. No placeholder damage/ammo/rate values were invented. Raw diagnostics are in toy-review/typecheck.log.

## Actual WebGL screenshots

![All six, hand and ground](toy-review/overview.png)

- [Full hand / ground / first-person atlas](toy-review/toy-atlas.png).
- [Pixel Beam](toy-review/beam.png), [Bouncy Blaster](toy-review/bouncer.png), [Slingshot](toy-review/slingshot.png), [Rail Pixel](toy-review/rail.png), [Splat Gun](toy-review/splat.png), [Paint Bomb](toy-review/paintGrenade.png).
- [Heat / charge / paint / throw progress](toy-review/progress.png).

Preview: http://127.0.0.1:5174/?weapons=1. The selector contains all eleven assets, and all 33 NFT characters. Export and effect buttons are authoring-only. Slider input still only mutates scalar state and requests rendering; measurements remain deferred.

## Changed/new files

See [TOY_FILES.md](TOY_FILES.md) for the complete copy list, including optional proof artifacts. No commit was made.
