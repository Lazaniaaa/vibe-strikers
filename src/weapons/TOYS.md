# Vibe Strikers: visual toy kit

The six new IDs are `beam`, `bouncer`, `slingshot`, `rail`, `splat`, `paintGrenade`. All are box data with the existing outline/vertex-colour treatment. No textures, gameplay constants, inventory rules, damage, ammo, fire rate or accuracy logic are included. `tipDistance` is a visual asset measurement only.

## Models and poses

Use the existing public entry `src/weapons/index.ts`:

```ts
import {
  createWeapon, attachWeapon, poseArmedCharacter, poseWeapon,
  createViewmodel, poseViewmodel, createWeaponEffects,
  type WeaponCharacterState, type ViewmodelState,
} from './src/weapons';

const gun = createWeapon('beam'); // accepts any of the eleven IDs
attachWeapon(player, gun);
const view = createViewmodel('beam', characterConfig, { holdSide: 'right' });
// The game owns the two scenes/cameras; view is camera-local.

// Allocate input objects once, then mutate their fields in the game's existing loop.
const characterState: WeaponCharacterState = {
  weapon: 'beam', speed: 0, moveDir: { x: 0, z: -1 }, aimPitch: 0,
  shooting: false, crouching: false, grounded: true, dead: false,
};
const visual: ViewmodelState = {
  fire: 0, reload: null, cycle: null, equip: 1,
  heat: 0, charge: 0, paintLevel: 1, throw: 0,
  moveSpeed: 0, strafe: 0, grounded: true, crouching: false,
  aimPitch: 0, time: 0, ads: 0,
};
// In the loop, supply the real game inputs and elapsed visual time:
poseArmedCharacter(player, characterState, dt);
poseWeapon(gun, visual);
poseViewmodel(view, visual);
```

`poseArmedCharacter` is the **extended kit adapter**; use it for new IDs. The character module's old `PoseState` union remains unchanged by this task. Existing calls to `poseCharacter` for the original five weapons continue working exactly as before. The adapter accepts the same movement/aim/death fields, owns no outer transform and starts no animation loop.

The five blasters share the approved rifle grip coordinates/calibration and the immutable per-character arm bank. They add no arm search. Paint Bomb has a distinct `kind: 'paintGrenade'`, one main-grip contact and no support socket. In third person its right hand uses the existing safe low-ready calibration, with the off-hand in a guard position. First person shows only the holding hand. This is presentation only; the game must bind the throwable to its own action/slot.

| Model | Visual input | Presentation |
|---|---|---|
| Pixel Beam | `heat`, `time` | Cool cyan casing, bilateral warm fill bar; red alarm flashes above 0.95 heat using the explicit clock. |
| Bouncy Blaster | existing `fire` | Rubber collar stack, bright cube-ball hopper, short chunky silhouette. |
| Slingshot | `charge` | Two attached elastic bars and a pouch pull back 0.31 m. No aim jitter or accuracy change. |
| Rail Pixel | `charge` | Four squared charging coils fill in order. The game decides whether charge represents cooldown or a trigger hold. |
| Splat Gun | `paintLevel` | Exposed tank indicator grows upward from its bottom; default is full. |
| Paint Bomb | `throw` in viewmodel | Wind-up, forward follow-through, model release at 0.72 progress. Reset to 0 for ready. |

Ratios clamp to 0–1; non-finite values use safe defaults. `heat` and `charge` are optional additions to `WeaponState`; `paintLevel`, `throw` and the optional seconds clock `time` are visual inputs too. Call order does not accumulate pose transforms. Glow uses the shared Basic material; no per-instance material or vertex edits are made. New pivot names are exported through `AnimatedPart`; ordinary consumers can use `getObjectByName` for authoring, not frame-loop searches.

## Pooled world effects

Create one pool per world/scene, not per shot:

```ts
const effects = createWeaponEffects(worldScene, {
  surfaceBoxes: staticWorldBoxes, // readonly { min: {x,y,z}, max: {x,y,z} }[]
});
```

Coordinates are world-space in a scene-root pool. Pass existing vectors/point objects; methods copy scalar coordinates immediately. `surfaceBoxes` is retained read-only, so supply stable axis-aligned map surface bounds once. No map/physics/gameplay module is imported or modified. Tilted/curved surfaces are not projected by this box-only visual backend.

| Method | Parameters / behaviour |
|---|---|
| `beam(start, end, color?, width?, slot?)` | Show **or move** persistent beam slot 0–3; defaults cyan and 0.025 m visual width. Call while firing, using the muzzle's world position. |
| `hideBeam(slot?)` | Hide that continuous beam when firing stops. |
| `bouncer(points, color?)` | 3–4 points give 2–3 segments; at most four points are read. Four sparks per internal bounce. |
| `rail(start, end, color?)` | Thick straight additive trail, fades over 0.5 s. |
| `splat(start, hit, color, duration?)` | Moving paint cube and an automatic small hit splash; default visual flight 0.16 s. |
| `paintSplash(point, color)` | Eight short paint cubes; no gameplay effect. |
| `grenadeArc(hand, landing, duration, color, arcHeight?, paintRadius?)` | Visual parabola, landing burst and surface patches. Defaults: 1.5 m arc lift, 1.4 m paint radius. Caller owns landing prediction and actual detonation. |
| `paintBurst(point, radius, color)` | Immediate burst plus patches on nearby supplied box faces. Use separately for server-confirmed explosions. Do not also let a duplicate preview arc burst at that location. |
| `update(dt)` | Advance the pool from the existing render loop; no allocations, no raycasting, no gameplay physics. |
| `clear()` | New-round reset: hide beams/trails/particles and remove every persistent decal. |
| `dispose()` | Remove pool and dispose its own instance buffers, geometries and materials; idempotent. |

Colours accept a hex string or numeric RGB (e.g. the game's team colours). Caps: **4 persistent beams, 32 transient trail segments, 96 cubes, 128 instanced quad decals**. Spawning at capacity replaces oldest ring slots. A burst emits at most 24 patches and scans at most 4096 static boxes. Patches stay until `clear`, subject to the fixed oldest-slot replacement cap. Slight slot-dependent surface offsets prevent coplanar paint fighting.

The pool uses at most **three instanced draw calls**, zero while completely inactive. It owns independent effect materials and must be disposed separately from the shared weapon cache. Remove all weapon/viewmodel instances before calling the existing `disposeWeaponResources()` once.

## Preview and verification

Run the existing preview at `http://127.0.0.1:5174/?weapons=1`. The selector/grid use all eleven configs. Heat, charge, paint and throw sliders drive both appropriate views. The effect button tests the selected effect; Clear removes paint. Explicit export buttons produce the six hand/ground/FPS strips and visual-progress sheet. No measurement work was moved into slider input handlers.

```sh
node src/weapons/verify.mjs
node src/weapons/verifyToyWeapons.mjs
node --expose-gc src/weapons/verifyToyPerf.mjs
```

The full verifier retains the original five-weapon contracts and adds the new matrix. See `TOY_REPORT.md`, `toy-results.json`, `toy-performance.json` and `toy-review/` for measured results and actual WebGL captures. The immutable pre-task legacy config/geometry/pose signatures are `toy-legacy-baseline.json`.

## Mechanics integration handoff

Extending `WeaponId` correctly makes the current game's exhaustive `src/config/weapons.ts` table incomplete (six entries), and its existing client pose call still uses the old closed character union. Those are **not changed here**: Claude must define mechanics and switch/route new visual IDs through `poseArmedCharacter`. Until then global `npm run typecheck` reports these three integration diagnostics. The weapon kit/preview typecheck passes independently. Do not suppress these errors by adding invented stats or weakening the ID union.
