# PROGRESS.md — read this first

Date started: 2026-10-30. Credits expire 2026-11-05.

## State
- M0 DONE, M1 DONE (2026-10-30). M1 long-frame fix ("Step 0") DONE 2026-10-30, see below.
- M2 plan written at the end of this file; WAITING for owner approval.
- Asset folders `src/characters/`, `src/weapons/`, `src/maps/` + Voxel Lab root files (owned by Codex).
- Game: `client/index.html` (game), `client/smoke.html` (M0 smoke page), `client/game/*` (R3F app,
  input, visuals, frame profiler), `src/gameplay/*` (pure simulation code), `src/ui/hud.ts`, `src/config/*`.
- Map in use: `toy-town-l1-r1` (`MAP_ID` in `src/config/game.ts`). Owner has not chosen a lane variant yet.

## Commands
- `npm run game:dev` — game dev server: http://127.0.0.1:5190/ (game), `/smoke.html` (M0 smoke page)
- `npm run game:build` then `npm run game:preview` — production build on http://127.0.0.1:5191/
- `npm run typecheck` — strict tsc on game code (`scripts/typecheck-game.mjs`)
- `npm run test:gameplay` — 12 unit checks (hitscan, headshot, rotated hit boxes, weapons, rounds, nav)
- `node scripts/e2e-m1.cjs [shot.jpg]` — headless play test (needs `game:dev` running and Playwright;
  in the cloud container: `NODE_PATH=$(npm root -g) node scripts/e2e-m1.cjs`). URL params:
  `?debug=1` exposes `window.__game` and hides the click overlay, `?freeze=1` shortens freeze time.
- `node scripts/profile-bots.cjs [seconds]` — headless CPU profile + per-section frame times of a bot round
  (same `NODE_PATH` note as e2e). `node scripts/bench-sim.mjs [seconds] [hz]` — simulation tick cost in
  Node without rendering (what the server will pay).
- HUD (top left): `FPS · tris · calls · worst <frame ms> (sim <ms>) / 5 s`.
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

Asset owner update (2026-10-31, imported by the owner's assistant, not by the game agent):
- Codex fixed the slow two-handed hold solver. Files replaced/added from the Codex project:
  `src/characters/{armVariants,poseCharacter,types}.ts`, `src/weapons/{supportPose,holdCache,holdSolve}.ts`,
  `src/weapons/holdProfiles.json` (required at runtime), `src/weapons/hold-pose-baselines.json.gz`,
  `src/weapons/{verify,verifyHolds,verifyHoldPerf,verifyHoldSweep}.mjs`, `src/weapons/round5-*.json`.
- The hold is solved once per character + weapon and cached; no search in the frame loop.
  Owner laptop (Ryzen 5 4600H): first call <= 3.4 ms, then <= 0.18 ms per call for all 33 characters.
- Armed HIP poses of most characters changed slightly (owner allowed smooth holds over the old exact
  checkpoint poses); bureau-8 arms fixed. Unarmed poses and all geometry hashes unchanged.
- The two strict-type casts in `armVariants.ts` (lines 23 and 27, see above) were re-applied on top of the
  Codex version. Strict `tsc`: 0 errors.
- Owner laptop test of the game build with viber-142 allowed as a bot: steady 60 fps, worst frame 17 ms
  over 15 s of combat (was 300-350 ms spikes).
- KNOWN CLOUD-ONLY FAILURE: `npm run verify` ends with `HOLD TIMING ACCEPTANCE FAILED` in the cloud
  container (hot call max 6-8 ms vs the 0.5 ms gate) because the shared CPU is noisy. All geometry,
  pose, clearance and hash checks PASS there (`failedRows 0`), and the timing gate passes on the owner's
  laptop. Treat that single timing failure as expected in the cloud; do not try to fix it, do not edit
  the asset folders for it. Any OTHER verify failure is real.
- `npm run verify` now writes reports into `outputs/` (gitignored).

## Requests to asset owner
- **Slow firearm hold for 2 characters (found 2026-10-30, M1 step 0).** `poseCharacter` with a firearm
  takes 100-1200 ms per call (others: under 10 ms, most under 2 ms) for
  `vibe-vibers-bureau-roll-40-10` (index 17) and `vibe-vibers-viber-142` (index 3), in every state,
  also `dead: true`. Profile: almost all time in `src/weapons/supportPose.ts` `bodyDistance` /
  `boxDistance` / `armClearance`: the clearance search never reaches 0.001 for these two, so all
  6 + 24 retries of `orientArm` run on every call. Please make the solver bounded (or cache the
  solution per character + weapon + pitch bucket) so every call is under ~1 ms. Until then the game
  never gives those two to bots, and any rig whose firearm pose is slower than 12 ms falls back to
  the no-weapon pose (`POSE` in `src/config/game.ts`). Benchmark: per-character table in this file
  (Step 0 section); a rerunnable script can be added on request.
- (done by the one-time exception) strict type errors in asset folders.
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
- 2026-10-30 owner: M2 movement = CLIENT movement (Rapier KCC) + SERVER validation; everything else
  server-authoritative; revisit after the cloud phase (CLAUDE.md rule 1, GAME.md 6.1 / 6.6).
- 2026-10-30 owner: bots run on the server with the same brain, moving along the nav grid without Rapier.

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

## M1 Step 0: long frames (2026-10-30) — what it was
Owner laptop: 2-3 frames per second at 300-350 ms during bot fights. Cause: NOT game logic.
- Headless CPU profile of a bot round (`scripts/profile-bots.cjs`): ~17 of 30 s CPU inside
  `src/weapons/supportPose.ts` (firearm hold solver called from `poseCharacter`). Per call timing:
  one bot (`vibe-vibers-viber-142`) took 250-490 ms on EVERY call, also when dead.
- Benchmark of all 33 characters with rifle/pistol (Node, worst / average ms per call):
  index 17 `bureau-roll-40-10` 501 / 123 (pistol 926 / 187), index 3 `viber-142` 370 / 109
  (pistol 1182 / 259); all others max 0.2-10 ms, average 0.2-3 ms. With weapon `null` or knife both
  are 0.05-0.12 ms. In M1 bots got characters 1-7, so `viber-142` was always on the field.
Fixes (game side only, asset folders untouched):
- Bots never use those two characters (`POSE.botCharacterExclude`); runtime guard: a rig whose firearm
  pose takes > 12 ms switches to the no-weapon pose (one console warning).
- Dead bodies are posed 2 frames, then not again.
- Bots: at most 2 A* searches per tick for all bots together (round start was 8 at once), vision
  checks spread over ticks. Shaders pre-compiled at load (first tracer / flash no longer compiles).
- HUD readout: worst frame of the last 5 s and worst sim time.
Results after the fix:
- Headless bot round, 40 s: posing max 8.8 ms per frame (was 490), sim max 8 ms, 0 frames with
  posing or sim > 20 ms. Render spikes left: 3 in 40 s in software rendering (2 at warm-up); check
  the HUD "worst" number on the laptop.
- Server-relevant cost (`scripts/bench-sim.mjs`, 8 bots, 60 Hz, 180 s sim, 3 runs): tick median
  0.08-0.13 ms, p99 1.2-1.5 ms, worst after warm-up 5-9 ms (cold first second 14-20 ms, JIT);
  A* average 0.35 ms, max 1.8 ms; Rapier step 0.13-0.16 ms; nav grid build 290-320 ms (once per map).
- Please re-test on the laptop with the same steps as before (`git pull`, `npm ci`, `npm run game:build`,
  `npm run game:preview`) and read `worst … ms` in the HUD.

## Next step: M2 plan (needs owner approval)
Goal (GAME.md 16, owner decisions 2026-10-30): authoritative multiplayer on SpacetimeDB, small scope:
rooms by code + quick play filled with bots, no lobby polish.

Server (`server/`, SpacetimeDB 2.14 TypeScript module):
1. Tables: `room` (code, isPrivate, phase, round state, maxRewindMs), `player` (identity or bot,
   room, team, name, character, position/velocity/yaw/pitch, hp, alive, weapon slots, last seq,
   violations), `hit_history` (ring of recent hit-box positions per player, ~400 ms), `shot_event` /
   `kill_event` (short-lived rows for tracers, hit markers, kill feed), `tick_schedule`.
2. Reducers: `join_quick{name, character}`, `create_room{private}`, `join_room{code}`, `leave`,
   `move{seq, x,y,z, vx,vy,vz, yaw, pitch, crouch, grounded, walk}`, `fire{seq, yaw, pitch, viewTime}`,
   `reload`, `switch_weapon{slot}`; scheduled `tick` at 30 Hz per active room.
3. Shared code imported directly from `src/`: `config/*`, `gameplay/hitscan`, `weaponLogic`, `round`,
   `botBrain`, `navGrid`, `src/maps` data. New `src/gameplay/movementCheck.ts` (pure): speed / vertical
   / capsule-in-box / teleport checks behind a `MovementAuthority` interface (GAME.md 6.6).
4. Hits: server spread RNG, fire rate and ammo from `weaponLogic`; rewind hit boxes to `viewTime`
   capped by maxRewindMs (250 public / 300 private, `config/net.ts`); ray vs rewound boxes + map boxes.
5. Bots on the server: same brain; movement = follow nav-grid waypoints at bot speed, y from the grid
   ground height, then the same movement checks. Quick play fills each team to 4 with bots; bots leave
   when humans join. Feasibility risks to check FIRST (1-2 hours): module-level cache of the nav grid
   between reducer calls (else precompute it into JSON at build time), 30 Hz scheduled reducer, tick
   cost with 8 players. If bots on the server are too slow, I will say so before going on.
Client:
6. `src/network/`: SpacetimeDB connection, subscription to my room, snapshot buffer with server time,
   send `move` at 30 Hz, `fire` per shot (local tracer at once, damage/hit marker from the server),
   correction = snap to the server position. `?lag=100` adds artificial latency to both directions.
7. Remote players: real characters (`poseCharacter`, HIP hold) interpolated at now - 100 ms.
8. Simple screen before playing: nickname, Quick Play, Create room (shows code), Join by code.
How I will test:
- Unit checks: movement validation (speed, jump, fall, inside-box, teleport), rewind buffer lookup.
- Node test against a local SpacetimeDB: 2 scripted clients + bots play a round; a cheating client
  (too fast / inside a wall / teleport) is snapped back; fire rate and ammo cannot be exceeded.
- Two real headless browser tabs in the same room by code: see each other move, shoot each other,
  hits and kills correct, at `?lag=0`, `?lag=100` and `?lag=200` (hit a strafing target with
  lag compensation). Screenshot of both tabs, 0 console errors; report draw calls / triangles with
  8 players (reduce only if over 120 calls / 200k triangles).
- Laptop instructions in this file (needs the spacetime CLI on the laptop, or a hosted server in M3).
Credit estimate: ~30-35% of the total budget (GAME.md said 30%). It is the biggest milestone, so I
propose two stops: M2a = server, rooms, movement validation, server bots, two tabs see each other
(~15%); M2b = server hits with lag compensation, rounds, latency tests (~15-20%). I stop and report
after M2a.
Out of M2: hosting (M3), lobby polish, character select, other weapons, sound.
