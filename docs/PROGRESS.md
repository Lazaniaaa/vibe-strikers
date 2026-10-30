# PROGRESS.md — read this first

Date started: 2026-10-30. Credits expire 2026-11-05.

## State
- M0 DONE 2026-10-30. M1 (playable single player vs bots) DONE 2026-10-30. Waiting for owner:
  FPS on the laptop (see "Run M1 on your laptop") and approval before M2.
- Asset folders `src/characters/`, `src/weapons/`, `src/maps/` + Voxel Lab root files (owned by Codex).
- Game: `client/index.html` (game), `client/smoke.html` (M0 smoke page), `client/game/*` (R3F app,
  input, visuals), `src/gameplay/*` (pure simulation code), `src/ui/hud.ts`, `src/config/*`.
- Map in use: `toy-town-l1-r1` (`MAP_ID` in `src/config/game.ts`). Owner has not chosen a lane variant yet.

## Commands
- `npm run game:dev` — game dev server: http://127.0.0.1:5190/ (game), `/smoke.html` (M0 smoke page)
- `npm run game:build` then `npm run game:preview` — production build on http://127.0.0.1:5191/
- `npm run typecheck` — strict tsc on game code (`scripts/typecheck-game.mjs`)
- `npm run test:gameplay` — 12 unit checks (hitscan, headshot, rotated hit boxes, weapons, rounds, nav)
- `node scripts/e2e-m1.cjs [shot.jpg]` — headless play test (needs `game:dev` running and Playwright;
  in the cloud container: `NODE_PATH=$(npm root -g) node scripts/e2e-m1.cjs`). URL params:
  `?debug=1` exposes `window.__game` and hides the click overlay, `?freeze=1` shortens freeze time.
- Asset owner commands unchanged: `npm run dev`, `npm run build`, `npm run verify`.

## Environment (M0 results, 2026-10-30)
- node v22.22.0 / npm 10.9.4. `npm install` works (npm registry reachable).
- Rust: cargo/rustc 1.97.0 preinstalled; `wasm32-unknown-unknown` target added without problems.
- SpacetimeDB CLI: official installer worked on the FIRST attempt -> `spacetime` 2.14.0 in
  `~/.local/bin` (add `export PATH=$HOME/.local/bin:$PATH`). `spacetime start` runs a local server
  on 127.0.0.1:3000. No `wasm-opt` (only a warning; modules run unoptimised, fine for dev).
  The container is temporary: the CLI must be reinstalled in every new session (~10 s).
- Headless Chromium + WebGL2: works via Playwright, launch args
  `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.
  Renderer: ANGLE / SwiftShader (software). Good for screenshots and logic, NOT for fps numbers.
- Asset checks after adding the game dependencies: `npm install`, `npm run build`, `npm run verify` pass.
- Starter template `majidmanzarpour/vibe-coding-starter-pack-3d-multiplayer`: exists (commit
  6c39ca2, 2026-02-24). Contains: Rust SpacetimeDB module (spacetimedb crate 2.0.1; player table,
  register/input reducers, scheduled game tick, own movement math), React 19 + R3F 9 + drei client,
  FBX wizard/paladin models (16 MB), bot load-test script. All versions use `^`.
  Result: server module builds (`spacetime build`, 22 s) and publishes to the local server; client
  runs; two headless tabs both register and each tab renders the other player (verified).
  The client logs its own console errors (FBX light-removal code). We do NOT copy it into the repo:
  it is Rust, uses FBX assets and its own movement math. Used only as a reference for connection,
  generated bindings and the scheduled tick.
- M0 smoke page (`client/smoke.html`): map `toy-town-l1-r1` from `buildMap`, character 01 holding
  the rifle (`createCharacter` + `createWeapon` + `attachWeapon` + `poseCharacter`), first-person
  rifle viewmodel (`createViewmodel` + `poseViewmodel`, separate scene/camera, depth cleared,
  near 0.05) and Rapier: 401 fixed cuboid colliders from `mapColliders` + a dynamic capsule that
  lands at y 0.90 (correct for half-height 0.45 + radius 0.45 on y 0).
  Console: 0 errors, 2 library warnings (`THREE.Clock` deprecated — from R3F 9.8 with three 0.186;
  rapier-compat "deprecated parameters for the initialization function"). Both harmless.
  Evidence: `docs/evidence/m0-smoke.jpg`. Typecheck and game build pass.
  Game bundle is 4.3 MB (Rapier WASM inlined + all 5 map JSONs) — optimise later, not now.

## Server decision: SpacetimeDB (TypeScript module), no Colyseus
- The fallback rule did not trigger: the CLI installed and the starter module built on the first try.
- Server module language: **TypeScript** (SpacetimeDB 2.x supports it), not Rust like the starter.
  Reason: TypeScript everywhere, and the server can import `src/config/*.ts` directly (one source
  of gameplay numbers). Verified with a probe module: built, published, reducer read `MAP_ID`
  from `src/config/game.ts` and 401 shot-blocker boxes.
- Asset type errors are fixed (see "Changes made in asset folders"), so the server can import
  `src/maps` and `src/gameplay` directly; the planned generated-JSON workaround is not needed.
- M2 RISK (found at the end of M1): `@dimforge/rapier3d-compat` does not load inside the SpacetimeDB
  TypeScript runtime (`TextDecoder` option `ignoreBOM` not supported, at import time). It may work
  with a small shim; WebAssembly support there is not checked yet. If Rapier cannot run on the server,
  server-side movement needs an owner decision (see M2 plan).
- SpacetimeDB versions: CLI 2.14.0, npm `spacetimedb` 2.14.0 (client SDK + `spacetimedb/server`).

## Pinned versions (root package.json, exact)
- Existing (asset owner): three 0.186.1, vite 8.3.5.
- Added: react 19.3.1, react-dom 19.3.1, @react-three/fiber 9.8.2, @react-three/drei 10.7.9,
  @react-three/rapier 2.2.0 (brings @dimforge/rapier3d-compat 0.19.2), spacetimedb 2.14.0;
  dev: typescript 6.0.3, @types/three 0.186.0, @types/react 19.3.0, @types/react-dom 19.3.0,
  @vitejs/plugin-react 6.1.2, @types/node 22.20.5 (added in M1).
- Not chosen on purpose: three 0.187 (assets are pinned to 0.186.1), TypeScript 7.0 (new native
  compiler, too fresh). Note: drei's `stats-gl` pulls its own three 0.170 — do not use drei `StatsGl`;
  `resolve.dedupe` keeps one three in the game build.

## Triangle / draw-call budget (per frame, visible)
- Total: <= 200k triangles, <= 120 draw calls (`RENDER_BUDGET` in `src/config/game.ts`).
- Map: < 140k triangles, < 60 draw calls (asset owner's approval numbers, whole map).
- Players: 8 x character + weapon <= 4k triangles and <= 10 calls each (check in M2).
- Viewmodel: measured 1,872 triangles / 5 calls (rifle).
- Effects + HUD + rest: <= 20k triangles.
- Measured at spawn A in the smoke page: world 10,080 triangles / 19 calls.
- Real fps must be measured on the owner's laptop (headless is software rendering).

## Changes made in asset folders
One-time owner exception (2026-10-30, start of M1): type-only fixes for strict `tsc`. No runtime change.
- `src/characters/armVariants.ts` line 23: `d.dimensions['hand'+side]` -> `d.dimensions[('hand'+side) as 'handL'|'handR']`
  and `d.restPose['arm'+side]` -> `d.restPose[('arm'+side) as 'armL'|'armR']`.
- `src/characters/armVariants.ts` line 27: `d.dimensions.components['arm'+side]` ->
  `d.dimensions.components[('arm'+side) as 'armL'|'armR']`.
- `src/characters/createCharacter.ts` line 171: `as Record<PartName, BoxSpec[]>` -> `as unknown as Record<PartName, BoxSpec[]>`.
- `src/maps/index.ts` line 11: `d as MapData` -> `d as unknown as MapData`.
- After the change: strict `tsc` 0 errors (also inside asset folders); `npm run verify` passes
  (33 default geometry baselines, 66 long-arm hashes, 396 approved old poses unchanged); `npm run build` passes.
- Note: `node src/maps/verify.mjs` (not part of `npm run verify`) fails before AND after this change
  because `src/maps/reports/m2/color-geometry-guard.json` was left out of the repo on purpose.

## Requests to asset owner
- (done by the one-time exception above) strict type errors in asset folders.
- `docs/ASSETS.md` said the weapons README explains react-three-fiber viewmodel rendering; it does
  not. The game uses the preview's method (second scene + camera, `clearDepth`). Fixed in ASSETS.md.
- Known gaps (not needed yet): emotes, rocket-boot flames, ice-surface field.

## Decisions log
- Aiming is visible only to the local player (first person); others see HIP hold.
- Hit volumes identical for every character.
- Public rooms maxRewindMs 250, private 300; interpolationDelayMs starts at 100.
- 2026-10-30 M0: SpacetimeDB with a TypeScript server module (see above).
- 2026-10-30 M0: viewmodel = second render pass (own scene + camera, fixed FOV 70, depth cleared).
- 2026-10-30 M1: bots are real characters (rifle, HIP hold, `poseCharacter`); took < 30 min.
- 2026-10-30 M1: default match 4v4 (you + 3 ally bots vs 4 bots), preset `test` (first to 3, 45 s).
- 2026-10-30 M1: recoil moves the real aim (CS style); spread from base + bloom + movement + air.
- 2026-10-30 M1: bots walk the lowest level only (nav grid from `mapColliders`), no balconies yet.
- 2026-10-30 M1: shadows = PCF (three 0.186 removed PCFSoft); StrictMode off on the game page.

## M1 result (2026-10-30)
What works (seen in headless Chromium, `docs/evidence/m1-play.jpg`, 0 console errors in dev and
production builds):
- Toy Town from `buildMap`, 401 Rapier colliders from `mapColliders`, sun shadow + fog from map data.
- Player: Rapier KinematicCharacterController (run 5.5, walk Shift 2.6, crouch C/Ctrl 2.2, jump,
  gravity 22, air control 30%, autostep, snap to ground), first-person camera + viewmodel.
- Rifle (auto, 600 rpm, 30/90) and pistol (semi, 12/36): hitscan vs `mapShotBlockers` boxes and the
  identical head/body hit boxes (rotate with yaw, crouch scales, headshot x2.5), spread + bloom,
  recoil pattern, reload, weapon switch 1/2, tracers, impacts, muzzle flash, hit marker, damage flash.
- Bots: 7 real characters (3 allies with a blue marker, 4 enemies), nav grid + A*, line-of-sight
  vision with FOV, reaction delay, aim error, bursts, strafing, reload, stuck recovery.
- Round: freeze 5 s, 45 s round, elimination or timeout by team HP, round end 4 s, first to 3,
  VICTORY/DEFEAT, Enter/click to restart. HUD: HP, ammo, weapon, timer, score, alive count, kill
  feed, crosshair that opens with spread, FPS + triangles + draw calls.
- Checks: typecheck OK, 12 unit checks OK, e2e: move, jump, land, rifle hits kill a bot, magazine,
  reload, switch, bots finish a round (kills happen), no console errors.
- Budget (headless, 8 players, shadows on): about 52-64k triangles and 98-114 draw calls per frame
  (the shadow pass counts too). Triangles are far below the 200k budget; draw calls are close to the
  120 budget. If FPS is low on the laptop, the first fix is `RENDER.shadows = false` in `src/config/game.ts`.
- Headless FPS is 4-7 (software rendering): it says nothing about real FPS.

Known limits (fine for M1, not bugs to fix now):
- Players and bots pass through each other (no actor-vs-actor collision yet).
- Bots never use stairs/balconies; they can be slow to find enemies, so some rounds end by timeout.
- No sound, no ADS, no knife/sniper/shotgun in the loadout (M3). The local player is always character 01.
- Ctrl as crouch can trigger browser shortcuts (Ctrl+W closes the tab!): use C.
- Game bundle ~4.3 MB (Rapier WASM inlined + 5 map JSONs).

## Run M1 on your laptop (measure FPS)
Needs Node.js 22 or newer and git. In a terminal:
1. `git clone https://github.com/Lazaniaaa/name.git voxel-arena`
2. `cd voxel-arena`
3. `git checkout claude/game-smoke-test-m0-0pnjf5`
4. `npm ci`
5. `npm run game:build`
6. `npm run game:preview`
7. Open http://127.0.0.1:5191/ in Chrome, click, play. FPS is in the top-left corner
   (`FPS · k tris · calls`). Please write down: FPS at spawn, FPS in the middle square during a fight,
   and the laptop model / browser. Also try `npm run game:dev` (http://127.0.0.1:5190/) if you
   want to change numbers in `src/config/` and see them live.
8. Tell me which lane map feels best later (change `MAP_ID` in `src/config/game.ts`:
   `toy-town-l1-r1`, `toy-town-l1-r2`, `toy-town-l2-r1`, `toy-town-l2-r2`).

## Next step
M2 (authoritative multiplayer). Plan will be written after the owner's FPS report and approval.
Main open question for M2: where server-side movement runs if Rapier does not load in SpacetimeDB
(options: shim Rapier in the module; or server validates client-predicted movement with speed /
collision plausibility checks while it still owns hits, HP, ammo and rounds).
