# PROGRESS.md — read this first

Date started: 2026-10-30. Credits expire 2026-11-05.

## State
- M0, M1 DONE (2026-10-30). M2a, M2b and M3 part 1 DONE 2026-10-31 (see "M3 part 1 result").
  STOPPED for the owner: next step is the rest of M3 (needs approval and a short plan).
- Asset folders `src/characters/`, `src/weapons/`, `src/maps/` + Voxel Lab root files (owned by Codex).
- Game: `client/index.html` (menu -> online game, or offline practice), `client/smoke.html` (M0),
  `client/game/*` (R3F apps, input, visuals, profiler), `src/gameplay/*` (shared pure code, also used by
  the server), `src/network/*` (SpacetimeDB client + generated bindings), `src/ui/*` (HUD, menu),
  `src/config/*`, `server/` (SpacetimeDB TypeScript module).
- Map in use: `toy-town-l1-r1` (`MAP_ID` in `src/config/game.ts`). Owner has not chosen a lane variant yet.

## Commands
- `npm run game:dev` — game dev server: http://127.0.0.1:5190/ (menu), `/?offline=1` (M1 offline),
  `/smoke.html` (M0). URL params: `?server=ws://host:3000`, `?lag=200` (artificial latency, round trip),
  `?debug=1` (exposes `window.__game` / `window.__online`), `?auto=quick|create|join&code=XXXXX&name=N`.
- `npm run game:build` then `npm run game:preview` — production build on http://127.0.0.1:5191/
- After a fresh `game:dev` start, open the page once (Vite optimizes deps; the first browser test can
  fail with "504 Outdated Optimize Dep" otherwise).
- Server: `spacetime start` (local, 127.0.0.1:3000), `npm run server:publish` (module "voxel-arena"),
  `npm run server:reset` (publish + delete data), `npm run server:bindings` (after schema changes),
  `spacetime logs --server local voxel-arena -f`. The spacetime CLI is in `~/.local/bin`.
- `npm run typecheck` — strict tsc on game code AND the server module.
- `npm run test:gameplay` — 13 unit checks (hitscan, hit boxes, weapons, rounds, nav, movement validation).
- `node scripts/test-server.mjs` — server integration test with Node clients (rooms by code, characters,
  own-room rows only, bots move and kill, refill, movement cheats snapped back, legal long walk, hits,
  fire-rate limit, ammo, reload, switch, kill -> round end -> respawn, ping).
- `NODE_PATH=$(npm root -g) node scripts/e2e-m2a.mjs [lagMs] [shotPrefix]` — two real browser tabs in one
  room (+1 Node client); `GAME_BASE=http://127.0.0.1:5191/` to test the production build.
- `NODE_PATH=$(npm root -g) node scripts/e2e-m2b.mjs [lagMs] [shot.jpg]` — lag compensation: a lagged tab
  shoots a strafing Node client (server reports rewind per shot and hits that needed it).
- `NODE_PATH=$(npm root -g) node scripts/e2e-m3a.mjs [shotPrefix]` — character select, chosen characters seen
  by others, kill feed, TAB scoreboard, own-room rows only.
- `NODE_PATH=$(npm root -g) node scripts/e2e-m1.cjs [shot.jpg]` — offline play test (M1).
- `node scripts/profile-bots.cjs [seconds]`, `node scripts/bench-sim.mjs [seconds] [hz]` — performance.
- Asset owner commands unchanged: `npm run dev`, `npm run build`, `npm run verify` (see the cloud-only
  timing note in "Changes made in asset folders").

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
- RESOLVED 2026-10-31 by the asset owner (cached holds). **Slow firearm hold for 2 characters (found 2026-10-30, M1 step 0).** `poseCharacter` with a firearm
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
- 2026-10-31 asset owner fixed the slow holds; bot character exclusion removed (`POSE.botCharacterExclude`
  empty), the 12 ms pose fallback stays as a silent safety net. Headless bot round with viber-142 as a
  bot: posing max 1.5 ms per frame for 7 bots, no rig fell back.
- 2026-10-31 M2a: server module in TypeScript imports shared code from `src/` directly (no generated JSON).
- 2026-10-31 M2a: one identity per browser tab (token in sessionStorage), so two tabs are two players.
- 2026-10-31 M2b: fire-rate check = cooldown slack 0.12 s (one extra shot of burst for network bunching).
- 2026-10-31 M2b: lag-comp view time = client's estimate of server time (max of row-time minus receive-time
  over the last 64 updates) at (now - interpolationDelayMs); caps unchanged (250 public / 300 private).
- 2026-10-31 M2b: online match restarts automatically 10 s after the match ends; joining mid-round spawns alive.
- 2026-10-31 M2b: private rooms have a "fill with bots" option (GAME.md room config `fillBots`).
- 2026-10-31 M3p1: character select = grid of colour swatches (body + glove colour) with the name of the
  selected one; remembered in the browser; the server clamps the index; bots get a random character.
- 2026-10-31 M3p1: ping = round trip of move acknowledgements (smoothed), reported to the server every 2 s
  (`report_ping`), shown on the TAB scoreboard; bots show "BOT".
- 2026-10-31 M3p1: client subscriptions: own player row first, then only its room's player / room /
  shot_event / kill_event rows (old room dropped after the new subscription is live).
- 2026-10-31 owner: maxRewindMs raised to 300 public / 350 private; interpolationDelayMs stays 100 (test 75
  later on a real network). After the change: 200 ms lag test 4/4 hits (rewind 304-350 ms).
- 2026-10-31 M3p2a: loadout = slot 1 primary, 2 pistol, 3 knife. Primary chosen with keys 7/8/9 (rifle /
  shotgun / sniper) at any time, saved in the browser and sent after joining; the server applies it at once
  during the freeze phase (alive players), otherwise at the next respawn (`nextPrimary` -> `primary`).
  Max 1 sniper per team (server rejects the choice; counts current and next choices of teammates).
- 2026-10-31 M3p2a: sniper accuracy: the `fire` message carries `scoped` (ADS >= 0.9); only used for spread
  (0 scoped / 8 unscoped, GAME.md 4), never broadcast. Sniper move speed x0.7 only while scoped (client).
- 2026-10-31 M3p2a: bots keep the rifle (no loadout AI); the offline practice uses rifle + pistol + knife.
- 2026-10-31 M3p2a: knife = hitscan with 1.6 m range, no tracer; bolt / pump animation (`cycle`) runs during
  the fire interval of sniper and shotgun.
- 2026-10-31 owner: ADS proposal approved (weapon switch, reload start and death cancel aiming).
- 2026-10-31 owner: ADS = right mouse TOGGLE by default, setting "ADS mode: toggle / hold" (GAME.md 5, 10; M3).

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

## M2a result (2026-10-31)
What works (evidence `docs/evidence/m2a-two-tabs.jpg`: two production-build tabs, 200 ms artificial
latency, each sees the other's character; 0 console errors):
- Feasibility (checked first): SpacetimeDB 2.14 TypeScript module imports `src/maps` (with three.js),
  `src/config` and `src/gameplay` directly; module-level caches survive between reducer calls (the nav
  grid is built once, ~0.8 s, when a room is created); a scheduled 30 Hz tick is steady (300 ticks:
  median 33.3 ms, max 36 ms); A* costs ~0.4 ms per search inside the module.
- Server `server/`: tables `room` (code, private flag), `player` (one row per human or bot), scheduled
  tick. Reducers `join_quick`, `create_private_room`, `join_by_code` (case-insensitive), `leave_room`,
  `move`; disconnect = leave. Teams are balanced by humans; humans replace bots; a leaving human is
  replaced by a bot; an empty room is deleted.
- Movement (owner decision): the client's Rapier KCC result is validated by `ClientValidatedMovement`
  (`src/gameplay/movementCheck.ts`, behind the `MovementAuthority` interface): teleport cap, horizontal
  speed with burst slack, one jump up / free fall down, capsule-vs-`mapColliders` boxes, map bounds. On a
  violation the server keeps the last valid position, bumps `correctionSeq` and counts the violation;
  the client snaps; moves sent before the client saw the correction (`ack`) are ignored.
- Server bots: same `botBrain` as offline, movement on the nav grid (`src/gameplay/navMotor.ts`), also
  checked by the same validation. They roam and turn to enemies; they do not shoot yet (M2b).
- Client: menu (nickname, Quick Play, Create private room, Join by code, Practice offline), local KCC
  movement sent at 30 Hz, remote players and bots as real characters interpolated 100 ms behind,
  ally markers, HUD with room code, player/bot count, lag, snap-back counter.
- Tests: typecheck (game + server), 13 unit checks, server integration test (all cheats snapped back:
  teleport, too fast, flying 3 m, walking into a wall; violations counted), two-tab e2e at 0 / 100 /
  200 ms lag (real walking + jumping gives 0 false snap-backs; the other tab sees the new position;
  closing a tab refills a bot), offline M1 e2e still passes.
- Budget with 8 players (headless): 53-59k triangles, 90-96 draw calls (under 200k / 120).
Known limits / notes for M2b:
- Clients subscribe to all `player` and `room` rows (fine for a few rooms; filter by room later).
- No shooting, HP, rounds or lag compensation yet (M2b). The HUD round line is a placeholder online.
- Server tick time inside the module cannot be measured directly (no clock in reducers); the tick
  interval stays steady, and the same code costs ~0.1 ms median per tick in Node.
- If the module restarts, the first tick rebuilds the nav grid (~0.8 s pause once).
- Both players currently use character 01 (character select is M3).

## Run M2a on your laptop
Needs Node.js 22+, git, and the SpacetimeDB CLI:
- macOS / Linux: `curl -sSf https://install.spacetimedb.com | sh`
- Windows (PowerShell): `iwr https://windows.spacetimedb.com -useb | iex`
Then, in the project folder (after `git pull` and `npm ci`):
1. Terminal 1: `spacetime start`
2. Terminal 2: `npm run server:publish` (if it asks about a server or login, use the local server:
   `spacetime server set-default local`), then `npm run game:build` and `npm run game:preview`
3. Open http://127.0.0.1:5191/ in two browser windows (or one normal + one private window). In the
   first: Create private room, read the code (top right). In the second: type the code, Join.
4. Walk around; the HUD shows `corrections 0` if the server accepted all movement. Add `?lag=200` to
   the URL to simulate a far server.
A friend on another computer needs a hosted server (M3).

## M2b result (2026-10-31)
What works (evidence `docs/evidence/m2b-lagcomp.jpg`: a 100 ms tab hitting a strafing player):
- Server-authoritative weapons with the shared `weaponLogic`: fire rate (a shot is accepted while the
  cooldown is <= `FIRE_CHECK.cooldownSlack` 0.12 s, so bunched packets pass but spamming does not:
  10 messages at once -> 2 shots), magazine, reserve, reload, weapon switch with draw time, spread from
  the server RNG (moving / airborne / bloom). Ammo and reload state mirrored in the player row.
- Lag compensation: every player has a pose history (`src/gameplay/rewind.ts`, 16 samples at 30 Hz,
  pushed on every accepted move and every tick). A `fire` carries `viewTimeMs` = server time of what the
  client was drawing (client estimates the server clock from row timestamps, minus its 100 ms
  interpolation delay). The server rewinds target hit boxes to that time, capped at 250 ms (public) /
  300 ms (private), and raycasts map boxes + rewound boxes. Each shot event also records whether the
  same ray would hit the CURRENT poses (`hitWithoutRewind`, test data).
- HP, headshot x2.5, death, kills / deaths, kill events, shot events (tracers, impacts, hit markers,
  damage flash, basic kill feed in the top right).
- Server bots shoot (same brain: reaction time, aim error, bursts, reload) and kill.
- Elimination rounds on the server with `round.ts` (test preset: freeze 5 s, round 45 s, round end 4 s,
  first to 3; timeout by team HP); everyone respawns on a new round (HP, weapons, ammo reset); after the
  match ends a new match starts in 10 s (`MATCH.matchRestartTime`). Joining mid-round spawns alive.
- Client: local prediction of fire / recoil / ammo / reload / switch with reconciliation from the
  server row; freeze phase blocks moving; death camera; round HUD (timer, score, alive counts, messages).
- Private rooms can be created without bots (menu checkbox, `&bots=0`): used for clean 1v1 tests.
Tests (all pass): typecheck (game + server), 14 unit checks, offline M1 e2e,
`scripts/test-server.mjs` (rooms, bots move AND kill, refill, movement cheats, a legal 60 m walk with
0 snap-backs, hit -> HP 73, fire-rate limit, ammo, kill -> round end -> reload -> pistol -> round 2 respawn),
`scripts/e2e-m2a.mjs` at 0 / 200 ms (two tabs), `scripts/e2e-m2b.mjs` (lag compensation):
| artificial round trip | needed rewind | server rewind | hit rate on 4.5 m/s strafe | hits that would land without rewind |
|---|---|---|---|---|
| 100 ms | ~205 ms | 202-206 ms | 67-80% (target killed) | 0 of 4 |
| 200 ms | ~305 ms | clamped at 300 ms (private cap) | 44-57% (target killed) | 0 of 4 |
| 200 ms, cap lifted to 600 (experiment, reverted) | ~305 ms | 304-352 ms | 67% | 1 of 4 |
Headless renders at 5-13 FPS, so hit rates on a real 60 FPS laptop should be higher.
DECIDED 2026-10-31 (owner): caps raised to 300 / 350 ms (see Decisions log). Was: at 200 ms ping the needed rewind (ping + 100 ms interpolation)
is just over the 300 / 250 ms caps, so 200 ms players hit moving targets less often. Options: keep the caps
(protects the victim, current), raise them (e.g. 350), or lower `interpolationDelayMs` (GAME.md 17).
Known limits: no spectate / killcam after death (M3); bots never use the pistol; the server trusts the
client's yaw/pitch for shots (normal for hitscan games; plausibility checks later).

## M3 part 1 result (2026-10-31)
What works (evidence `docs/evidence/m3a-menu-scoreboard.jpg`: menu with the character grid, TAB scoreboard):
- Character select on the menu: all 33 characters as colour swatches, the selected name is shown,
  remembered in the browser (`?character=N` for tests). Sent with join; other players see it (real
  character model + scoreboard). The offline practice also uses the chosen character. Bots get random characters.
- Online kill feed (top right, last 4 kills: killer [weapon, HS] victim) from server kill events.
- TAB scoreboard: two team tables with round score, name, character, kills, deaths, ping (bots: BOT),
  sorted by kills; your row highlighted; dead players dimmed.
- The client receives only its own room's rows and events (checked with two rooms at the same time).
Tests (all pass 2026-10-31): typecheck, 14 unit checks, `test-server.mjs`, `e2e-m3a.mjs`, plus the regression
runs `e2e-m1.cjs`, `e2e-m2a.mjs` (0 and 200 ms), `e2e-m2b.mjs` (100 ms), production build.
What does NOT work yet / known limits:
- No killcam / spectate after death, no sound, no settings screen, no ADS, only rifle + pistol (rest of M3).
- Ping on the scoreboard is inflated in the headless test browser (it handles updates once per slow frame);
  on a normal 60 FPS browser it is close to the real network round trip.
- 200 ms ping vs the 250/300 ms rewind caps: see the open decision in "M2b result".
- Playing with a friend on another computer still needs a hosted server (M3 item "hosting").

## Run M2b + M3 part 1 on your laptop
Needs Node.js 22+, git and the SpacetimeDB CLI (install commands in "Run M2a on your laptop").
In the project folder: `git pull`, then `npm ci`, then:
1. Terminal 1: `spacetime start`
2. Terminal 2: `npm run server:reset` (the database schema changed; this deletes old test data), then
   `npm run game:build` and `npm run game:preview`
3. Open http://127.0.0.1:5191/ in two windows (one normal + one private window). Pick a character and a
   nickname in each. Window 1: Create private room (bots on or off), read the code at the top right.
   Window 2: type the code, Join. Shoot each other; hold TAB for the scoreboard.
4. To feel latency: add `?lag=100` or `?lag=200` to the URL (round trip). Quick Play gives 4v4 with bots.

## Old M2 plan (kept for reference)
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
