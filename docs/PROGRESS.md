# PROGRESS.md — read this first

Date started: 2026-10-30. Credits expire 2026-11-05.

## State
- M0 (environment smoke test) DONE 2026-10-30. Waiting for owner approval of the M1 plan below.
- Asset folders `src/characters/`, `src/weapons/`, `src/maps/` + Voxel Lab root files (owned by Codex).
- Game app skeleton: `vite.game.config.ts` (root `client/`, port 5190), `tsconfig.game.json`,
  `src/config/game.ts` (map id, camera, render budget), M0 smoke page `client/smoke.html`.
- Map in use: `toy-town-l1-r1` (`MAP_ID` in `src/config/game.ts`). Owner has not chosen a lane variant yet.

## Commands
- `npm run game:dev` — game dev server, http://127.0.0.1:5190/smoke.html (M0 smoke page)
- `npm run game:build` — game build to `work/game-dist/`
- `npm run typecheck` — strict tsc on game code (`scripts/typecheck-game.mjs`; errors inside the
  asset folders are reported as a note, not a failure, see requests below)
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
- Catch: `spacetime build` type-checks everything it imports, and the asset folders currently have
  5 strict-mode type errors, so the server cannot import `src/maps` directly yet. Plan: a small
  generator script (Vite SSR) calls `loadMapData` + `mapShotBlockers` + `spawnPoints` and writes
  `server/generated/<mapId>.json`; the server imports that JSON. This is generated, not hand-copied
  (rule 5). If the asset owner fixes the type errors, import directly instead.
- SpacetimeDB versions: CLI 2.14.0, npm `spacetimedb` 2.14.0 (client SDK + `spacetimedb/server`).

## Pinned versions (root package.json, exact)
- Existing (asset owner): three 0.186.1, vite 8.3.5.
- Added: react 19.3.1, react-dom 19.3.1, @react-three/fiber 9.8.2, @react-three/drei 10.7.9,
  @react-three/rapier 2.2.0 (brings @dimforge/rapier3d-compat 0.19.2), spacetimedb 2.14.0;
  dev: typescript 6.0.3, @types/three 0.186.0, @types/react 19.3.0, @types/react-dom 19.3.0,
  @vitejs/plugin-react 6.1.2.
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

## Requests to asset owner
- Type errors under strict `tsc` (blocks importing `src/maps` into the SpacetimeDB server module):
  `src/characters/armVariants.ts` lines 23 and 27 (TS7053 string index),
  `src/characters/createCharacter.ts` line 171 (TS2352 cast), `src/maps/index.ts` line 11 (TS2352:
  JSON `light.sun.direction` is `number[]`, type wants a tuple; cast through `unknown`).
- `docs/ASSETS.md` said the weapons README explains react-three-fiber viewmodel rendering; it does
  not. The game uses the preview's method (second scene + camera, `clearDepth`). Fixed in ASSETS.md.
- Known gaps (not needed yet): emotes, rocket-boot flames, ice-surface field.

## Decisions log
- Aiming is visible only to the local player (first person); others see HIP hold.
- Hit volumes identical for every character.
- Public rooms maxRewindMs 250, private 300; interpolationDelayMs starts at 100.
- 2026-10-30 M0: SpacetimeDB with a TypeScript server module (see above).
- 2026-10-30 M0: viewmodel = second render pass (own scene + camera, fixed FOV 70, depth cleared).

## Next step: M1 plan (needs owner approval)
Goal (GAME.md 16): playable single player on Toy Town vs bots, local only (no server yet).
What I will build:
1. `src/config/`: `movement.ts` (run 5.5, walk 2.6, crouch 2.2, gravity 22, jump 7, air 30%,
   capsule), `weapons.ts` (pistol + rifle rows from GAME.md 4, knife row kept for later),
   `rounds.ts` (`test` preset), `bots.ts`.
2. `client/index.html` + game entry: R3F canvas, map + Rapier fixed colliders, pointer lock,
   WASD/Space/Shift/Ctrl, Rapier KinematicCharacterController for the player, first-person camera.
3. Weapons: pistol + rifle (keys 1/2), hitscan ray vs map shot blockers + bot hit boxes (head/body
   boxes from GAME.md 3, x2.5 headshot), fire rate, mag/reload, spread + bloom, simple recoil,
   viewmodel fire/reload animation, tracer + hit marker. Shared pure hit-test code in
   `src/gameplay/` so the M2 server reuses it.
4. Bots: capsules (or real characters if cheap) that walk spawn-to-spawn on simple waypoints from
   map data, see the player with a line-of-sight ray and shoot with a reaction delay and spread.
5. HUD: HP, ammo, crosshair, round timer, kills; simple round: player vs bots, round ends when one
   side is dead or time runs out, restart.
How I will test: `npm run typecheck`, `npm run game:build`, small unit checks for the hit-test code
(ray vs box, headshot), a Playwright script that plays a scripted round headless (move, shoot a
bot, check HP/ammo in a debug object), 1-2 small screenshots in `docs/evidence/`, 0 console errors.
Credit estimate: ~25% of the total budget (GAME.md guide). If it grows, I stop after step 3 and
report.
Open question for the owner after M1 playtest: which lane variant feels best (l1-r1 / l1-r2 /
l2-r1 / l2-r2).
