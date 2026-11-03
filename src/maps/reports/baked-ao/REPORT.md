# Baked AO — completed implementation and game review

Only src/maps is changed. Default: ON. Use buildMap(data, { bakedAo: false }) for an exact unbaked comparison. No commit was created.

## Available proof

- node src/maps/verify.mjs: PASS, all five maps and existing collider/navigation/tactical contracts.
- npm run typecheck: PASS (game and server).
- npm run game:build: PASS.
- All five map JSON file hashes are unchanged. AO-off full render SHA-256 values match the original approved geometry and colours.
- No AO fields/rays are constructed by server-only imports or metadata/collision/spawn APIs.
- Warm cache shares geometries; AO-on/off have separate geometry cache entries and the same material. No per-frame AO function, pass, texture or extra draw call.

## Geometry and build measurements

| Map | Triangles off | Triangles on | Added | Draws off/on | Cold cache build ms | Warm cache ms |
|---|---:|---:|---:|---:|---:|---:|
| toy-town | 36480 | 42480 | 6000 | 6/6 | 64.0 | 2.8 |
| toy-town-l1-r1 | 49032 | 55032 | 6000 | 6/6 | 72.7 | 2.4 |
| toy-town-l1-r2 | 49656 | 55656 | 6000 | 6/6 | 73.2 | 2.3 |
| toy-town-l2-r1 | 48240 | 54240 | 6000 | 6/6 | 58.5 | 2.3 |
| toy-town-l2-r2 | 49392 | 55392 | 6000 | 6/6 | 65.4 | 2.0 |

A separate process measured 58–83ms AO-on construction (standalone-build.log). The 6,000 added direct triangles imply at most 12,000 extra submissions in the current world + one sun-shadow pipeline, within the requested +15k target. The actual game measurements and matched camera captures are recorded below.

## Approach comparison

| Approach | Appearance / limitations | Added triangles | Measured offline authoring time |
|---|---|---:|---|
| Three occupancy probes (side1/side2/corner adaptation) | Discrete corner levels; fast on regular voxels, but fractional thin boxes require a chosen sampling scale and side convention. Harder transitions / weaker coverage beneath irregular awnings. | Same adaptive mesh cap, +6k | ~140–240ms/map |
| Eight AABB hemisphere rays (selected) | Smooth local distance falloff; handles thin fractional walls, steps, frames and awning joints without voxelisation. | Same adaptive mesh cap, +6k | ~330–370ms/map |

The faster approach was benchmarked using --compare-voxel without overwriting the selected bank. The voxel alternative was compared by sampling behaviour and offline cost, not a rendered A/B. The selected hemisphere bake was reviewed in-game against unbaked rendering and runtime n8ao. See bake-voxel.log and bake-rays.log.

Selected AO is precomputed offline because sampling exceeded the ~300ms runtime target. Sparse face patches are packed into five deferred loader modules, 104–134KB each (below2MB), with delta indices, float32 cut coordinates and 8-bit coefficients. Only large faces near projected contacts get extra vertices; four per-chunk triangle caps prevent global tessellation. True instanced prefabs get shared local self-AO only. Coefficients never go below .64 linear light (.76 on upward surfaces), preserving readable floors. Existing outline colours stay unchanged. Baked colours also affect direct sunlight: this is a stylised multiplication, not a physically separated irradiance solution.

The builder validates geometry/instances and named AO constants before using a bank. Palette-only changes reuse topology. A custom/stale layout falls back to construction-time sampling; regenerate data with node src/maps/tools/bake-ao.mjs before shipping (verify rejects a stale bank for the five shipped maps). No data is decoded at server import.

## Completed game review

Game preview: http://127.0.0.1:5191/?offline=1&debug=1&view=fountain&ao=off. The final source and game build both default to baked AO ON; runtime n8ao is OFF in this URL. Console errors: 0 across the reviewed modes.

| View | Baked off: FPS / calls / triangles | Baked on: FPS / calls / triangles | Runtime n8ao only: FPS / calls / triangles |
|---|---:|---:|---:|
| spawn-a | 60.3 / 63 / 118142 | 60.0 / 64 / 129782 | 58.7 / 68 / 118041 |
| fountain | 60.2 / 74 / 122138 | 60.2 / 76 / 134246 | 60.0 / 80 / 121605 |
| balcony | 60.2 / 71 / 121490 | 60.2 / 69 / 133382 | 57.7 / 80 / 121605 |
| spawn-b | 60.2 / 60 / 119114 | 60.1 / 60 / 131042 | 60.4 / 66 / 118509 |

Measurements: 30 warm-up frames, then 90 sampled frames per capture; eight actors remain in the frozen review scene. All views use the same CSS canvas 1325 × 1192, GPU drawing buffer 1324 × 1192, DPR 1 and unchanged game cameras/FOV. Raw records: [game-measurements.json](game-measurements.json). At the approximately 60Hz cap there was no measurable FPS reduction from baked AO. This does not establish zero GPU cost: the added vertices still need rasterisation, while AO calculations and AO render passes cost zero per frame.

Bot weapon loadouts are randomised on page reload. Full-frame counts consequently vary by several calls/triangles independently of map AO. The paired geometry contracts isolate the map itself: exactly +6000 direct triangles and zero additional draws for every map. Baked-on game frames peaked at 134246 triangles / 76 calls, below 200k / 120.

The third column is **runtime n8ao only, with baked AO OFF**, not both effects stacked. The comparison build tool temporarily changes the builder default during bundling, then restores the source in a finally block. After captures, npm run game:build restored the normal baked-ON distribution. No game source was edited.

Visual review: the bake softly darkens wall-floor and stair contacts without screen-space noise; floor tops remain light. Runtime n8ao additionally shades moving actors and view-dependent contacts, which the static bake intentionally cannot do.

![Four views: unbaked / baked / runtime n8ao only](comparison.png)

| View | No AO | Baked AO | Runtime n8ao only |
|---|---|---|---|
| spawn-a | [PNG](baked-off-spawn-a.png) | [PNG](baked-on-spawn-a.png) | [PNG](runtime-n8ao-spawn-a.png) |
| fountain | [PNG](baked-off-fountain.png) | [PNG](baked-on-fountain.png) | [PNG](runtime-n8ao-fountain.png) |
| balcony | [PNG](baked-off-balcony.png) | [PNG](baked-on-balcony.png) | [PNG](runtime-n8ao-balcony.png) |
| spawn-b | [PNG](baked-off-spawn-b.png) | [PNG](baked-on-spawn-b.png) | [PNG](runtime-n8ao-spawn-b.png) |

Reproduce the unbaked and n8ao-only captures with node src/maps/tools/build-ao-review.mjs off, then the same view URLs with ao=off or ao=on. Restore the final build with node src/maps/tools/build-ao-review.mjs on (or npm run game:build). Public callers can instead compare buildMap(data, { bakedAo: false }) directly.

## Runtime transfer files (9)

- [src/maps/buildMap.ts](D:/voxel-arena/src/maps/buildMap.ts)
- [src/maps/index.ts](D:/voxel-arena/src/maps/index.ts)
- [src/maps/bakedAo.ts](D:/voxel-arena/src/maps/bakedAo.ts)
- [src/maps/aoCache.ts](D:/voxel-arena/src/maps/aoCache.ts)
- [src/maps/ao-data/toy-town.ts](D:/voxel-arena/src/maps/ao-data/toy-town.ts)
- [src/maps/ao-data/toy-town-l1-r1.ts](D:/voxel-arena/src/maps/ao-data/toy-town-l1-r1.ts)
- [src/maps/ao-data/toy-town-l1-r2.ts](D:/voxel-arena/src/maps/ao-data/toy-town-l1-r2.ts)
- [src/maps/ao-data/toy-town-l2-r1.ts](D:/voxel-arena/src/maps/ao-data/toy-town-l2-r1.ts)
- [src/maps/ao-data/toy-town-l2-r2.ts](D:/voxel-arena/src/maps/ao-data/toy-town-l2-r2.ts)

Full changed/new file list: FILES.md. README documents the public option, data regeneration, server safety and limitations.

Sources: [0fps voxel AO](https://0fps.net/2013/07/03/ambient-occlusion-for-minecraft-like-worlds/), [Three BufferGeometry](https://threejs.org/docs/pages/BufferGeometry.html), [threejs-materials-lighting skill](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/tree/main/skills/web-engines/threejs-materials-lighting).
