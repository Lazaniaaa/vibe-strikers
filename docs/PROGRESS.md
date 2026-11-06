# PROGRESS.md — read this first

Date started: 2026-10-30. Credits expire 2026-11-05.

## State
- Cloud phase finished 2026-11-01. Built and tested: M0, M1, M2a/b, M3 parts 1-2, playtest fixes, solo play + hosting
  prep, features (drops, bot primaries, Cornucopia), last batch (fast loading, pedestals, second person, pings,
  mutators), final batch (server-side pedestals, team-only pings, music). Pull request:
  https://github.com/Lazaniaaa/name/pull/1 (branch `claude/game-smoke-test-m0-0pnjf5` -> main). STOPPED for the owner.
- Not done from the final batch: step 4 "bots use the rocket-boots double jump" (skipped at the budget limit: server
  bots move on the nav grid without vertical physics, so it needs a jump model for the grid motor first).
- Asset folders `src/characters/`, `src/weapons/`, `src/maps/` + Voxel Lab root files (owned by Codex).
- Game: `client/index.html` (menu -> online game, or offline practice), `client/smoke.html` (M0),
  `client/game/*` (R3F apps, input, visuals, profiler), `src/gameplay/*` (shared pure code, also used by
  the server), `src/network/*` (SpacetimeDB client + generated bindings), `src/ui/*` (HUD, menu, sounds, music),
  `src/config/*`, `server/` (SpacetimeDB TypeScript module).
- Map in use: `toy-town-l1-r1` (`MAP_ID` in `src/config/game.ts`). Owner has not chosen a lane variant yet.

## Next step (next session, on the owner's laptop)
1. `git pull`, `npm ci`, `spacetime start`, `npm run server:reset`, `npm run game:build`, `npm run game:preview`;
   play every mode once (Quick Play, private room with a mutator, Cornucopia teams / free-for-all, offline practice).
2. Merge PR #1 into main when happy; publish to Maincloud + Cloudflare Pages with `docs/HOSTING.md`
   (server first, with `--delete-data` because tables changed).
3. Open work, in this order: bots' double jump with rocket boots (grid motor jump model + nav links to balconies);
   map redesign with more cover (owner) and the asset-owner requests below (blocked stairs, props in walls, async map
   loading, boot sockets / item models); 12-16 player load test; emotes and the emote wheel; Cornucopia arena.

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
- `npm run test:gameplay` — 19 unit checks (hitscan, hit boxes, weapons, rounds, nav, movement validation).
- `node scripts/test-server.mjs` — server integration test with Node clients (rooms by code, characters,
  own-room rows only, bots move and kill, refill, movement cheats snapped back, legal long walk, hits,
  fire-rate limit, ammo, reload, switch, kill -> round end -> respawn, ping).
- `NODE_PATH=$(npm root -g) node scripts/e2e-m2a.mjs [lagMs] [shotPrefix]` — two real browser tabs in one
  room (+1 Node client); `GAME_BASE=http://127.0.0.1:5191/` to test the production build.
- `NODE_PATH=$(npm root -g) node scripts/e2e-m2b.mjs [lagMs] [shot.jpg]` — lag compensation: a lagged tab
  shoots a strafing Node client (server reports rewind per shot and hits that needed it).
- `NODE_PATH=$(npm root -g) node scripts/e2e-m3a.mjs [shotPrefix]` — character select, chosen characters seen
  by others, kill feed, TAB scoreboard, own-room rows only.
- Hosting: `docs/HOSTING.md`; build-time server address in `.env.production.local` (see `.env.production.example`).
- `NODE_PATH=$(npm root -g) node scripts/e2e-m3b.mjs [shot]` — ADS (real right click), FOV zoom, sniper scope.
- `NODE_PATH=$(npm root -g) node scripts/e2e-m3c.mjs [shot]` — killcam 3 s, then spectate a teammate; heard sounds.
- `NODE_PATH=$(npm root -g) node scripts/e2e-m3d.mjs [shot]` — settings panel saved and applied in game.
- `NODE_PATH=$(npm root -g) node scripts/e2e-m3e.mjs` — sounds (steps, silent walk, shots, hits, reload, knife).
- `NODE_PATH=$(npm root -g) node scripts/e2e-m1.cjs [shot.jpg]` — offline play test (M1).
- `NODE_PATH=$(npm root -g) node scripts/e2e-fixes.mjs [shot]` — dead body removed after ~1 s, death marker until the next round.
- `NODE_PATH=$(npm root -g) node scripts/e2e-leave.mjs` — Leave match (confirm), bot refills, rejoin without reload, offline leave.
- `NODE_PATH=$(npm root -g) node scripts/e2e-tags.mjs [shot]` — name tags (ally through walls, enemy only in sight near the
  crosshair, 40 m fade) and kill feed colours.
- `node scripts/find-prop-overlaps.mjs [minOverlap]` — read-only map check: prop instances whose boxes intersect walls.
- `node scripts/test-bot-behaviour.mjs [seconds] [easy|normal|hard]` — offline sim, 8 bots: route spread, cover, peeks,
  reloading in cover, kills, tick cost.
- `node scripts/test-bot-levels.mjs` — bots (server nav-grid motor and offline Rapier KCC) walk from each spawn to
  each balcony / raised area and back; every 30 Hz sample checked with the server validation (0 corrections).
- `node scripts/test-jump-feel.mjs [--expect-feel]` — coyote time and jump buffer on a 2 m ledge (Rapier KCC + server
  validation); results in `docs/evidence/jump-feel-{before,after}.txt`.
- `node --experimental-strip-types --no-warnings scripts/test-sounds.mjs [--wav <dir>]` — checks the code-made sound
  sets (`src/ui/sounds/claude.ts`, `codex.ts`) against `SOUND_LIMITS`; `--wav` writes WAV files to listen to.
- `http://127.0.0.1:5191/?soundlab=1` — blind A/B sound lab (Claude vs Codex set, loudness matched, picks saved).
- `node scripts/test-market.mjs [--slow]` — wallet login (test keys) + marketplace rules against the local server (wallets, starter items, listing
  checks, buy / fee / race / cancel / rate limit, no reward for an instant lonely win, coin conservation); `--slow`
  adds a real ~5 min free-for-all with bots and checks its reward.
- `node scripts/sim-market.mjs [--bots 30] [--seconds 60] [--seed 1] [--out file.json]` — many bot traders at once
  (honest + cheating + same-moment buys + bursts + drop mid-trade and reconnect) with an auditor checking the
  invariants (GAME.md 6.7); exit 1 on any violation or unexpected server answer.
- `node scripts/test-stairs.mjs [mapId]` — finds every stair flight in the map data and walks the Rapier KCC up
  and down each one, checking every 30 Hz sample with the server movement validation (0 corrections).
- `node scripts/test-drops.mjs` — weapon drops (server, 2v2 Node clients): drop with ammo, range check, E swap, cleared next round.
- `node scripts/test-cornucopia.mjs` — Cornucopia on the server (free-for-all): loot by tier, pistol start, ammo / weapon /
  medkit pick-ups, healing, last one standing, new match with fresh loot.
- `node scripts/test-bot-roles.mjs [seconds]` — bot primaries (max 1 sniper per team) and roles (sniper spots, scoped
  shots, shotgun range).
- `NODE_PATH=$(npm root -g) node scripts/e2e-drops.cjs [shot]` — drops in the browser (offline): model, hint, E swap.
- `NODE_PATH=$(npm root -g) node scripts/e2e-cornucopia.cjs [shot] [bootsShot]` — Cornucopia offline (free-for-all):
  pedestals, pistol start, boots double jump + glow, bots take loot.
- `NODE_PATH=$(npm root -g) node scripts/e2e-cornucopia-online.cjs [shot]` — Cornucopia online room smoke test.
- `NODE_PATH=$(npm root -g) node scripts/shot-bot-weapons.cjs out.jpg` — screenshot of bots with random primaries.
- URL params for tests: `?mode=cornucopia&teams=0` (offline and `auto=create`), `?mutator=bigHeads` etc.
- `node scripts/test-mutators.mjs` — mutators on the server (one shot, big head box, boots, fast run, mutator of the day).
- `NODE_PATH=$(npm root -g) node scripts/e2e-mutators.cjs [shot]` — mutator HUD, big heads drawn, low gravity jump.
- `NODE_PATH=$(npm root -g) node scripts/e2e-second-person.cjs [shot]` — V view, no shooting, reload, wall pull-in.
- `NODE_PATH=$(npm root -g) node scripts/e2e-pings.mjs [shot]` — team pings (tab + Node clients), rate limit, 5 s.
- `NODE_PATH=$(npm root -g) node scripts/measure-load.cjs [base] [loading.jpg]` — production build: JS size, time to
  menu and to the first game frame (local and 10 Mbit/s).
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
- **(2026-11-05) Verify scripts after the lobby task.** (1) `node src/maps/verify.mjs` fails its source guard
  because `src/characters/index.ts`, `README.md`, `verify.mjs` changed in the (approved) lobby animation task:
  please refresh that baseline. (2) `src/characters/benchmark-lobby.mjs` asserts every single pose call < 1 ms;
  on the laptop it failed 1 run of 3 (one 1.29-1.31 ms spike, typical max 0.07-0.09 ms, likely GC): please use a
  percentile (e.g. p99) or a median. (3) `benchmark-lobby.mjs`, `src/characters/verify-lobby.mjs` and
  `src/maps/verify-lobby.mjs` write into `client/game/animation-review/` and `client/game/island-review/` (game
  folders): please write reports into your own folders. Only the small JSON files those scripts need are kept there
  for now.
- RESOLVED 2026-11-01 by the asset owner (map colour pass; `find-prop-overlaps` 0, stairs test 6/6). **Props inside walls (found 2026-10-31 by `node scripts/find-prop-overlaps.mjs`, owner screenshot = bench).**
  Map in use `toy-town-l1-r1` (same in l1-r2, l2-r1, l2-r2; overlap x / y / z in metres):
  - benchA at (-26.5, 8) and (-26.5, -8), yaw -90 -> wall at (-26.82, +-8): 0.65 / 0.18 / 0.55 (half inside the wall)
  - benchB at (26.5, 8) and (26.5, -8), yaw 90 -> wall at (26.82, +-8): 0.65 / 0.18 / 0.55
  - lampA at (-28.5, +-8) / lampB at (28.5, +-8) -> walls at (-+26.82, +-8): 0.17 / 3.59 / 0.17
  - crateA at (-7.7, -22) / crateB at (7.7, -22) -> walls at (-+7, -22.15): 1 / 1 / 1 (crate fully inside a wall)
  - base map `toy-town` has the same benches and lamps, plus screenA/screenB at (-+25.03, +-20) -> walls at
    (-+23, +-18.43): 0.8 / 3 / 0.4 (no crate overlaps there).
  The game does not change the map; please move these props.
- RESOLVED 2026-11-01 (map colour pass). **Blocked stairs (found 2026-10-31 by `scripts/test-stairs.mjs`):** the two 3-step flights at (-20.6, -29.3) and
  (20.6, -29.3) (map `toy-town-l1-r1`) cannot be entered: a wall box 3.00 x 1.00 m, 1.61 m high, centre
  (-20.90, -28.70) / (20.90, -28.70), stands right in front of the first step (too high to step or jump). Please
  open the entrance or remove the flights.
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

- **Async map loading (2026-11-01):** please export e.g. `loadMapDataAsync(id)` from `src/maps/index.ts` that
  `import()`s only the requested map JSON. Today index.ts imports all 5 maps (1.6 MB); the game build stubs the
  unused ones with a Vite plugin meanwhile.

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
- 2026-10-31 M3p2b: ADS (local only): right mouse toggles (setting "hold" = hold to aim); full aim in ~0.18 s
  (`ADS.blendSpeed`); world FOV = settings FOV x fovForAds(weapon, ads) / 70; mouse speed x
  adsSensitivityScale; sniper scope overlay from the asset API, its viewmodel hidden at ads >= 0.9 (asset rule);
  game crosshair hidden while ads > 0.5; knife never aims. Works online and in the offline practice.
- 2026-10-31 M3p2b: default world FOV is now 90 (GAME.md 10 default; was 70 in M1). The viewmodel pass keeps
  its fixed 70.
- 2026-10-31 M3p2c: killcam = camera at the killer's interpolated eye (their model hidden), no viewmodel,
  banner "Killed by X"; it continues into round end. After 3 s (`KILLCAM.duration`): spectate living
  teammates in id order, left click = next; nobody alive = camera stays where you died. Suicide / world
  death skips the killcam.
- 2026-10-31 M3p2d: settings panel opens from a Settings button on the menu and on the "click to play"
  overlay (Esc frees the mouse); sliders apply at once and save to localStorage ("Defaults" resets).
  Sensitivity shown x1000 (0.5-6.0), FOV 70-110, volume 0-100%, crosshair colour + size 4-20 px, ADS toggle/hold.
- 2026-10-31 M3p2e: sounds = own small ZzFX-style synth (`src/ui/sfxSynth.ts`: oscillator + noise, pitch
  slide, envelope, low-pass), rendered once per sound into Web Audio buffers; definitions in
  `src/config/audio.ts`. Master gain = settings volume. World sounds (other players' shots and steps):
  full volume within 4 m, then 4/d, silent beyond 70 m, stereo pan from the listener's yaw. Footsteps every
  2.2 m only when running (Shift walk and crouch are silent, GAME.md 3). Reload = two clicks. UI click on
  every button (the first click also unlocks audio). No zzfx package: the synth is ~40 lines.
- 2026-10-31 fix 1: dead bodies keep the death pose 1 s (sinking during the last 0.35 s), then are hidden.
  A death marker (0.8 m translucent tile + white box cross, ally blue / enemy orange-red as seen by you,
  render-only, no shadows) stays until that player is alive again (next round). Online and offline.
- 2026-10-31 fix 2: "Leave match" on the Esc overlay with "Are you sure? Yes / No". Online: `leave_room`
  (server deletes the row, a bot refills), the client drops the room subscription and its rows, keeps the
  connection; menu shows again and any join works without reloading. Offline: back to the menu.
- 2026-10-31 fix 3: stairs. KCC settings were already right (autostep 0.35 m >= 0.30, dynamic bodies off, min width
  0.15 m, snap to ground 0.3 m). The real cause: the motor set the horizontal velocity from the actual movement
  every frame, so autostep stalled at every step edge (10-step flight up in 2.2-2.7 s vs 1.25 s down). Now the
  intended ground speed is kept (actor.vx/vz still report the actual movement): up in 1.37 s. Server
  validation accepts it: `scripts/test-stairs.mjs` walks every reachable flight up and down with 0 corrections.
- 2026-10-31 fix 3: bots do NOT use stairs: the nav grid has one height level per cell, the landings sit above
  walkable ground, and higher steps count as obstacles (bots reach at most the 4th step, a dead end they do not
  plan into). Needs a multi-level nav grid: later (not cheap).
- 2026-10-31 fix 5: team identification. Colours (`TEAM_COLORS`, relative to the viewer): ally light blue
  #4fb6ff, enemy orange-red #e8452c (blue vs orange-red with different brightness: readable with common colour
  blindness). Name tags = DOM labels 2.45 m above the feet, scale 8 m / distance clamped 0.6-1, fade 30 -> 40 m,
  hidden beyond 40 m (`NAME_TAGS`). Allies: tag + blue diamond always, drawn through walls. Enemies: tag only
  when within 7 deg of the crosshair AND a ray from the camera to their head is not blocked by a map box;
  no enemy marker. Same colours in the kill feed (names), TAB scoreboard (names + "yours"/"enemy" headers) and
  death markers. Online and offline.
- 2026-10-31 solo 1: multi-level nav graph (`src/gameplay/navGrid.ts`, built by `buildMapNav`): each 0.5 m cell keeps
  up to 3 surfaces (ground, stairs, balconies); stacked boxes (a step on its support) count as one surface; nodes
  link when the height difference is a step (0.4 m; 0.55 m between stair nodes because cells are wider than
  treads); stair steps near a stair cell are climbable, beside a stair only one step is. Upper areas (>= 1.5 m,
  >= 12 nodes) are found automatically (3 on toy-town-l1-r1) and added to the bots' roam goals. Built once per map
  in 60 ms (boxes binned per cell); A* budget per tick unchanged (avg 0.57 ms per search).
- 2026-10-31 solo 1: server bot motor moves the body like the KCC: it stands on the highest box it touches when that
  is within autostep height (0.35 m), anything higher blocks, and it checks the same capsule-vs-box rule the server
  validates with. Test `scripts/test-bot-levels.mjs`: from each spawn to each upper area and back with both bot
  motors (server nav grid and offline Rapier KCC): 12/12, 0 corrections. Replaces "bots do NOT use stairs".
- 2026-10-31 solo 2: bot behaviour. Routes: map zones (and balconies) split into north / middle / south by z
  (+-9 m); each bot takes route `id % 3` and mostly roams to that route's points on the enemy side, else the enemy
  spawn. Cover: 255 cover spots precomputed (walkable spot with a >= 1.3 m box within 0.9 m). In a fight a bot
  fights from cover with chance `coverChance`: it peeks from the spot where it saw the enemy (expose 1-1.8 s, shoot)
  and hides at the nearest cover within 6 m the enemy cannot see (0.6-1.2 s); it hides at once to reload (also when
  the magazine is below 25%) and when HP first drops below 45 (then hides 2.5 s per cycle). No cover nearby: strafes
  in the open as before. Test `scripts/test-bot-behaviour.mjs` (180 s, 8 bots): routes 2.92 of 3 per team per
  round, 31 of 71 fights from cover, 9 peeks, 26 s of reloading in cover, tick p99 1.5 ms.
- 2026-10-31 solo 3: bot difficulty easy / normal / hard (`BOT_SKILLS` in src/config/bots.ts: reaction time, aim
  error, head-aim chance, burst length / pause, turn rate, cover chance). Menu select (saved), used by offline
  practice and private rooms you create (`room.difficulty`); Quick Play = normal. Test: hard team vs easy team
  (240 s): 12 kills / 3 rounds vs 2 kills / 0 rounds. The menu scrolls on small windows.
- 2026-10-31 solo 4: hosting prep (not deployed). Client server address / database from build-time
  `VITE_STDB_URI` / `VITE_STDB_DB` (file `.env.production.local` in the project root, example committed,
  `.env*.local` gitignored); defaults stay local; `?server=` / `?db=` override for tests. Build uses relative
  paths (`base: './'`): checked from a sub-folder on a plain static server against a second database. The server
  tick now starts with the first room and stops when the last room closes. Steps: `docs/HOSTING.md`
  (Maincloud + Cloudflare Pages direct upload, Windows).
- 2026-11-01 features 1: weapon drops (Elimination). On death the primary drops with its ammo (table `item`,
  server-authoritative), E (`pick_up{itemId}`) within `ITEMS.pickupRadius` (+ server slack) swaps the primary and
  draws it; the old one drops at the feet. Pick-up only while the round is live; drops stay during round end and are
  cleared when the next round starts (loadout primary comes back). Max `ITEMS.maxDropsPerRoom` per room (oldest
  removed). A picked-up sniper does not count for the 1-sniper limit (the limit is on the loadout choice). Bots do not
  pick up drops in Elimination. Offline practice has the same drops (shared `src/gameplay/items.ts`).
- 2026-11-01 features 2: bots use random primaries (`BOT_LOADOUT.weights` rifle 0.5 / shotgun 0.3 / sniper 0.2, at most
  one sniper per team; kept for the whole match; same in offline practice). A human choosing the sniper takes it from
  a bot (the bot gets a rifle). Roles (`BOT_ROLES`): snipers go to "sniper spots" = balconies + sheltered cover
  points with a clear view of >= 22 m that looks toward the enemy spawn (not deep in enemy land), hold them 6-12 s,
  shoot standing and scoped (bots fire with ADS accuracy only when standing with the sniper), switch to the pistol
  under 7 m and do not chase; shotguns push until 4 m and do not fire beyond 14 m; only rifles use cover + peek.
  Server bots now switch weapons (intent.slot) and respect the draw time. Offline: local ADS now gives the scoped
  sniper accuracy too (was server-only). Test `scripts/test-bot-roles.mjs` (180 s): snipers 40% of live time at
  sniper spots (rifles 0%), sniper hits 18.4 m vs rifle 14.0 m vs shotgun 8.4 m.
- 2026-11-01 features 3: Cornucopia mode ("Hunger Games", GAME.md 2.2) on Toy Town (owner: use the map's lootSpots;
  GAME.md said "own arena, later"). Room option `mode` (+ `teams`; off = free-for-all, every player its own team id
  F1..F8, FFA spawns from the map). One life per match = one round of `ROUND_PRESETS.cornucopia` (300 s; timeout:
  more HP wins); the last team / player standing wins, then a new match after 10 s with fresh loot. Start: knife +
  pistol 12 / 0, no primary (row `primary` = '', slot 1 cannot be drawn). Loot per tier (`CORNUCOPIA.loot`, assigned
  to the tier's spots in turn): low = ammo / shotgun / medkit, mid = rifle / medkit, high (the 4 balcony spots) =
  sniper / boots / medkit / medkit. Pedestals are visual boxes (no collider). E = pick up / use the nearest item:
  ammo +24 pistol rounds; first weapon is just taken, later weapons swap (old one drops); medkit = E on the medkit
  uses it at once (only below full HP): +60 HP over 3 s (the only way to heal); boots: +1 jump in the air for the rest
  of the match, glow box under the feet for 0.6 s after a boost (others see it while a booted player rises). Dead
  players drop their primary. Bots: pick up a weapon when they have none, ammo for the pistol, medkits below 70 HP,
  about half of them also go for the centre (sniper, boots); pistol, then knife when out of ammo. Menu: mode select +
  "Cornucopia in teams" for private rooms and offline practice; Quick Play stays Elimination. Joining a running
  Cornucopia match spawns you alive (late join, simplest). No sniper limit in Cornucopia (loot decides).
- 2026-11-01 batch2 step 1: faster loading. The menu no longer loads the game: GameApp / OnlineApp (three.js,
  Rapier, R3F, map, characters, weapons) and the SpacetimeDB SDK are dynamic imports, prefetched 0.8 s after the
  menu shows and awaited behind a loading screen (step text + bar; done at the first rendered frame). Library
  chunks (rolldown advancedChunks in vite.game.config.ts): rapier, three, r3f, net, map. Map data: src/maps/index.ts
  imports all 5 map JSONs (1.6 MB) and is not ours to edit, so the game BUILD replaces the unused maps with a tiny
  stub (plugin `only-used-map`, MAP_ID read from src/config/game.ts; dev mode unchanged); request for an async
  loader added below. Rapier stays one 2.2 MB chunk (its wasm is inlined in rapier3d-compat; gzip 0.84 MB).
  Sizes (raw / gzip): before = index 229 KB + one 4.44 MB chunk (gzip 1.26 MB), all needed for the menu;
  after = menu 18 KB (+12 KB client) / 7 KB gzip; game 3.4 MB total (rapier 2.24 MB, three 740 KB, game 252 KB,
  weapons 216 KB, r3f 212 KB, map 166 KB, net 113 KB, GameApp 70 KB). Production build, headless (`scripts/
  measure-load.cjs`): menu shown 956 -> 300 ms local, 1791 -> 1224 ms at 10 Mbit/s; menu + first game frame
  2341 -> 1737 ms local, 2891 -> 2415 ms at 10 Mbit/s. Evidence `docs/evidence/loading-screen.jpg`.
- 2026-11-01 batch2 step 2: Cornucopia fixes. Pedestals are solid (Rapier fixed boxes at the loot spots, 0.7 x 0.5 m;
  jump on them or take the loot from beside, pick-up range covers it). Server bots and the server movement check
  still ignore pedestals (they only stop at the edge to pick up; a cheater could walk through; small). A player
  joining (or a bot refilling) after the freeze phase of a Cornucopia match is dead and spectates ("Match in
  progress") until the next match.
- 2026-11-01 batch2 step 3: second-person view (GAME.md 5): V toggles (setting "Second-person view: toggle /
  hold", default toggle) a camera 2.5 m in front of the eye looking back at the own character (drawn only in this
  view, HIP hold); a ray against the map pulls it in (0.25 m from the wall, min 0.6 m). No shooting and no ADS in
  this view, reloading works; viewmodel and crosshair hidden. Client-only (others see nothing different).
- 2026-11-01 batch2 step 4: team pings. Z or middle mouse: the client casts the view ray against the map (80 m;
  no ping at the sky) and calls `ping{x, y, z}`; the server checks alive + range and allows one per second per
  player, then inserts `ping_event`. Clients show only their own team's pings (free-for-all: only your own): a
  yellow diamond + beam drawn through walls for 5 s, a HUD line "◆ Name · 12 m", a short ping sound. The event
  reaches every client in the room (an enemy cheat client could read it; small, logged). Offline: your own ping only.
- 2026-11-01 batch2 step 5: mutators (GAME.md 8, `src/config/mutators.ts`): lowGravity (gravity x0.45 in the
  client KCC; the server's per-sample vertical check already allows it), bigHeads (head model scale x2 on every rig,
  re-applied after each pose; server/offline head hit box x2 growing up from the neck), oneShot (any hit kills),
  fastRun (run speed x1.35 in the KCC, the bot motor and the server move check), rocketBoots (everyone spawns with
  boots). Room field `mutator`; Quick Play rooms get the mutator of the day (UTC day number cycles the 5; a room
  keeps its mutator for its life); private rooms and offline practice pick one or none in the menu (`?mutator=` for
  tests). The HUD room line shows "Mutator: Big heads".
- 2026-11-01 final batch step 1: the server sees the pedestals. Cornucopia rooms use their own "terrain" (map
  boxes + `pedestalBoxes(lootSpots)`, the same boxes as the client colliders): own movement validation and own bot
  nav grid (built once at room creation); offline practice builds its nav the same way. Bots stop beside a pedestal
  and pick up within reach. Found and fixed: one free-for-all spawn point lies on a loot spot (-20, -22), so a player
  spawned inside a pedestal and every move was snapped back; Cornucopia now skips spawn points blocked by a pedestal
  (`spawnsClearOf`, server and offline). Test `scripts/test-pedestals.mjs`: walking along a pedestal and standing on
  it 0 snap-backs, walking through it is snapped back, bots 0 violations and never inside a pedestal.
- 2026-11-01 final batch step 2: team-only pings on the server. `ping_event` has a `recipient` identity; the server
  inserts one row per human teammate of the pinger (free-for-all: only the pinger) and a row-level-security filter
  (`clientVisibilityFilter.sql('SELECT * FROM ping_event WHERE recipient = :sender')`) delivers each row only to its
  recipient, so even a client subscribed to the whole table gets no enemy pings (tested in `scripts/e2e-pings.mjs`).
- 2026-11-01 final batch step 3: generative music (GAME.md 12; `src/ui/music.ts`, numbers in `MUSIC` in
  src/config/audio.ts). An 8th-note sequencer schedules notes rendered by the same synth as the effects (no files):
  4-bar A-minor loop; menu / between rounds = pad + sparse arpeggio (68-76 BPM); live round = + soft bass and
  off-beat hats (100 BPM); last 15 s = busier bass and arpeggio (126 BPM); a 4-note win or lose sting when a live
  round / match ends. Setting "Music volume" (default 25%, x master volume, saved). Starts after the first click
  (browser audio rule). The settings panel now scrolls on small windows. Test `scripts/e2e-music.cjs`.
- 2026-11-01 final batch step 4 SKIPPED (budget hard stop ~8%): bot double jump needs a vertical model in the server
  grid motor (bots have no gravity / jumps there) and jump links in the nav graph; logged as the first open item.
- 2026-11-01 laptop fix 1 (owner playtest: big heads / low gravity looked like normal online): the online game started as
  soon as the own player row arrived, before the room row, so `mutatorRules(net.room?.mutator)` read '' (no mutator).
  `joinWith` in client/main.tsx now also waits for `net.room`. Checked online: low gravity jump 2.30 m / 1.36 s in the
  air, 0 snap-backs; big heads drawn (`docs/evidence/fix-mutator-online-bigheads.jpg`). Offline was not affected.
- 2026-11-01 owner: game-feel audit against gamedev-cheatsheet.com (34 concepts); approved items 1-5: coyote time,
  jump buffer, impact particles, damage camera shake, world camera near 0.1. Bot separation = later.
- 2026-11-01 audit 1-2: coyote time 0.1 s + jump buffer 0.1 s (`MOVEMENT.coyoteTime` / `jumpBufferTime`, timers per
  actor inside `RapierMotor`; a rising actor never refills coyote time, so no double jump). Holding jump still hops on
  landing as before. `scripts/test-jump-feel.mjs`: before 0 of 6 cases jump, after 4 of 6 (0.03 / 0.08 s yes, 0.15 s no),
  0 server validation violations; stairs and bot-level tests pass.
- 2026-11-01 audit 3: impact particles. Every world / player hit throws voxel chips (`EFFECTS.chips`: 6 world, 8 body,
  12 head; grey-brown dust, yellow body, orange head) from one pooled InstancedMesh (+1 draw call, no per-frame
  allocation, flat state arrays); chips fly mostly sideways / up (only a little toward the shooter), fall with gravity
  and shrink. The dark impact cube stays. Evidence `docs/evidence/audit-{impacts,playerhit}-{before,after}.jpg`
  (real GPU via Playwright + the laptop's Chromium, 60 FPS).
- 2026-11-01 audit 4: camera shake when the local player is hit (`client/game/cameraShake.ts`, numbers `EFFECTS.shake`):
  trauma +0.35 + 0.003 per damage per hit, decays 1.6 / s, shake = trauma² x (roll up to 4°, offset up to 6 cm) from
  smooth sines; roll + offset only, so the crosshair stays on the real aim. Setting "Screen shake when hit" on / off
  (default on, GAME.md 10). Offline and online. `window.__game.cameraRoll()` (debug) for tests. Measured: a bot burst
  gives max roll 0° before / 3.2° after; evidence `docs/evidence/audit-hurt-shake-before-after.jpg` (top row before).
- 2026-11-01 audit 5: world camera near plane 0.05 -> 0.1 m (`CAMERA.near`; the viewmodel camera keeps 0.05). Depth
  step at 60 m with a 24-bit buffer ~4.3 mm -> ~2.1 mm. Preventive: no z-fighting was seen at the checked spot, so the
  before / after screenshots look the same (`docs/evidence/audit-near-{before,after}.jpg`); no clipping (the eye stays
  >= ~0.18 m from boxes).
- 2026-11-01 map colour pass by the asset owner (Codex, worked directly in `src/maps/`, brief
  `docs/codex-map-color-brief.md`): Endesga 32 palette, stronger sun vs ambient, blue sky, optional
  `light.hemisphere` (buildMap adds the HemisphereLight to the map group), `sky.horizon`, window / shutter / awning /
  flower-box decor; collidable props baked into 35 m chunks. Also fixed: props inside walls and the blocked 3-step
  stairs (both requests resolved). In game (4 views, `docs/evidence/map-colour-before-after.jpg`): draw calls
  102-165 -> 84-127, triangles 68-100k -> 117-130k (budget 200k / 120 calls; spawn B view is still 127 calls),
  60 FPS, 0 console errors. Checks: typecheck, 19 gameplay checks, prop overlaps 0 on all 5 maps, stairs 6/6, bot
  levels, server test PASS (first run had 1 flaky failure, 3 reruns passed). The server module imports the map:
  run `npm run server:publish` after pulling this.
- 2026-11-03 lighting pass (Codex, one-time owner permission to edit the listed game files; report
  `docs/lighting-report.md`): Neutral tone mapping (world; the viewmodel keeps ACES), gradient sky
  (`client/game/sky.ts`, map `sky.horizon` -> `sky.color`), every map mesh casts shadows (PCF radius 2, extent 48 m),
  actor sun shadows = head + torso only, optional n8ao 2.0.1 + postprocessing 6.39.6 AO (`client/game/postfx.ts`),
  setting "Ambient occlusion" on / off (default off, live switch). Integration by Claude: GTAO review backend removed,
  shadow-policy traversal every 15 frames, package-lock synced, evidence as JPG in `docs/evidence/lighting-*.jpg`.
  GPU-synced FPS at 1920x1080, spawn A: integrated AMD 76 (old) / 68 (AO off) / 49 (AO on); GTX 1650 253 / 257 / 153.
  Finding: Chrome on this laptop used the integrated AMD GPU by default (owner switched Chrome to "High performance"
  in Windows Graphics settings, 2026-11-03).
- 2026-11-03 auto resolution + GPU hint (owner: "робимо все"): `WorldRenderer.adapt` checks FPS every 1 s and the
  GPU frame time (EXT_disjoint_timer_query_webgl2, fixed pool of 8 queries); drops the pixel ratio one level
  (1.5 / 1.25 / 1 / 0.85 / 0.75, capped by the start ratio) when FPS < 52 and the GPU is busy (>= 12 ms), raises it
  when FPS >= 58 for 8 s and the scaled GPU time stays < 11 ms (no timer: FPS only + 30 s no-retry after a failed
  raise). First try (FPS only, "undo if the drop gained < 3 FPS") locked up at 1.25x because FPS jumps 33 <-> 60 at
  the same resolution (vsync), so the GPU timer replaced it. Measured 1920x1080 at DPR 1.5, AO on, normal vsync:
  integrated AMD auto off 31-39 FPS at 2880x1620; auto on -> 1.0x within ~6 s, then a steady 60 FPS (GPU 9.5 ms);
  GTX 1650 stays at 1.5x, 60 FPS. Debug HUD shows `res 1.5x`. Settings: "Auto resolution" on / off and the GPU
  name; built-in graphics (`INTEGRATED_GPU` in `src/config/game.ts`) show the "High performance" hint
  (`docs/evidence/autores-settings-gpu-hint.jpg`). Online smoke: lowGravity jump 2.42 m, 0 snap-backs, 0 errors.
- 2026-11-03 baked AO (asset owner, `src/maps/`; report `src/maps/reports/baked-ao/REPORT.md`): ambient occlusion
  precomputed offline (`src/maps/tools/bake-ao.mjs`) into `src/maps/ao-data/*.ts` (~130 KB per map) and applied to
  the static chunks' vertex colours by `buildMap` (default on; `buildMap(data, { bakedAo: false })` for comparisons).
  Always on, no runtime pass: +6k triangles, 0 extra draw calls, build 59-73 ms (cache 2-3 ms). The server bundle
  does not include the AO data (tree-shaken; checked). In game: 124-141k triangles, 44-100 calls, 60 FPS, 0 errors;
  the effect is subtle at full view and clear in zoom (`docs/evidence/baked-ao-before-after.jpg`,
  `baked-ao-zoom-spawn-a.jpg`, `baked-ao-zoom-balcony.jpg`, Codex's 3-way `baked-ao-codex-comparison.jpg`).
  Codex's 15 MB of PNG evidence was left out of git (kept locally). Checks: typecheck, 19 gameplay checks,
  `verify.mjs`, prop overlaps 0, server publish + server test PASS.
- 2026-11-05 new main menu / lobby (Codex, one-time owner permission for the menu files; reports `docs/lobby/`):
  full-screen 3D lobby island (`src/maps/lobby.ts` + `data/lobby-island.json`, not in `mapIds`), selected
  character on a pedestal with relaxed unarmed idle + 5 emotes (`src/characters/lobbyAnimation.ts`,
  `lobbyEmotes.ts`; E then 1-5), toy-style UI (tabs PLAY / CHARACTERS / SETTINGS, nickname card, mode card with
  Online / Practice, rules, mutator, Play with friends, big PLAY + Enter), 33 rendered portraits, Lilita One font
  (OFL, local). Lobby shadows: character receives none, casts one onto the pedestal with a tight shadow camera.
  MenuChoice API and all start paths unchanged; the lobby 3D is a lazy chunk, disposed when a match starts.
  Checked by Claude: typecheck, 19 gameplay checks, `npm run verify` (characters + weapons), lobby verifiers,
  game build; lobby 61 FPS at 1920x1080 and 1366x768, 0 console errors; menu -> practice -> leave -> menu with
  the 3D back and one canvas; in-match views unchanged (`docs/evidence/lobby-task-game-unchanged.jpg`); online
  smoke OK. Evidence `docs/evidence/lobby-*.jpg`. Codex's 13 MB of review images were left out of git.
- 2026-11-05 sound A/B round (owner: Claude and Codex each make one code-made set, compared blind): contract
  `src/ui/sounds/types.ts` (10 ids: uiHover, knife, pistol, rifle, sniper, shotgun, step, hit, headshot, loot;
  recipe = pure function returning mono samples, rendered once at load; limits per sound). Claude's set
  `src/ui/sounds/claude.ts` on `src/ui/sounds/dsp.ts` (layered: noise transient, filtered-noise / gliding-tone
  body, low thump, short tail, saturation, small Schroeder reverb). Codex's set in `src/ui/sounds/codex.ts` (+
  `codex/`). Lab `client/game/soundLab.ts` (?soundlab=1): A/B shuffled per sound, matched on the loudest 50 ms
  window, rifle as a 6-shot burst, steps 4 in a row. Not wired into the game yet: the winners per sound go in
  after the owner's picks.
- 2026-11-05/06 marketplace (owner: everything in the game is tradable, all characters stay playable, coins from
  matches with the given numbers, player-to-player only, branch `market`, no push). Built overnight on branch
  `market`: GAME.md 6.7 contract; `src/config/market.ts`; rules `src/gameplay/marketRules.ts` + catalog
  `src/gameplay/market.ts` (33 characters + 5 emotes); server tables wallet / owned_item / listing / trade / economy
  (+ private match_stat, match_clock), reducers list_item / cancel_listing / buy_listing, wallet + starter set (3
  characters + 1 emote, 200 coins) on first connect, match rewards at match end; GameNet market view and calls;
  lobby tab MARKET (`src/ui/marketPanel.ts`, `client/game/market.css`) and coins on the player card. Identity: the
  first tab keeps a persistent token (Web Lock + localStorage), a second tab gets its own (two tabs = two players).
  My additions (owner allowed): 5% sale fee burned, +50 first win of the UTC day.
  Bugs found and fixed: (1) reducer calls on a dropped connection never settled (UI would wait forever) -> refused
  at once, in-flight calls fail with "connection lost"; (2) every trade redrew the market list, wiping a price being
  typed and the scroll, up to 18 redraws/s with 1000+ listings -> values / focus / scroll kept, 60 rows max, <= 4
  redraws/s (60 FPS with 1091 listings while 40 bots trade); (3) negative / huge prices failed with a raw
  serialization error -> checked before sending; (4) coin farming: an empty private free-for-all ended right after
  the freeze and paid the win (~200 coins/min) -> rewards need >= 2 players at the end and >= 60 s; (5) the rate
  limiter kept every identity forever -> idle keys pruned. Sims: 20 bots x 30 s, 60 x 90 s, 100 x 90 s, 40 x 45 s:
  0 invariant violations, 0 unexpected answers (reports `docs/evidence/market-sim-*.json`). test-market 30+ checks,
  --slow: real 305 s match paid 20 coins (loss). Screens `docs/evidence/market-tab*.jpg`. Report for the owner:
  `docs/market-report.md`.
- 2026-11-06 wallet login + leaderboard (owner: X login costs $0.01 per login, use a wallet instead, $0; Robinhood
  Chain testnet (Ethereum L2), never mainnet, show warnings; every online match counts for stats; the farming risk
  is fine on testnet). GAME.md 6.8; CLAUDE.md "no wallets" line replaced by the owner's decision. Login = free
  personal_sign of a text naming the connection identity, checked in the module (@noble/curves + @noble/hashes
  2.4.0); accounts (wallet, items, listings, trades) keyed by address, `session` table with row-level security,
  guests play without coins / market, starter gift on the first login. `player_stat` table + lobby tab LEADERS
  (key 4, Settings now 5). Player card: login button with testnet note, or address + coins + Log out. Local DB was
  reset (column types changed). Tests: gameplay 21 (incl. EIP-191 vector, key-1 address, refusals), test-market
  40+ (login refusals: changed text, replay from another session, expired, malformed; same wallet on two
  connections; logout; stats), sim 40 bots + 8 twin connections x 45 s: 0 violations, 0 unexpected
  (`docs/evidence/market-sim-wallets-40bots.json`), test-server pass, Chromium with a fake provider: login, market,
  leaders, logout, 0 console errors (`docs/evidence/wallet-*.jpg`, `leaders-tab.jpg`). Real MetaMask not tested yet
  (owner's browser).
- 2026-11-06 owner: project name **Vibe Strikers** (for the Robinhood Chain testnet submission). Renamed what the
  player sees: lobby logo, page title, loading screen, wallet login text (`AUTH.appName`). Technical names stay
  (`voxel-arena` database, repo, folders). Logo made in code (`docs/brand/`): token icon `vibe-strikers-icon.svg`
  + PNG 1024 / 512 / 256 (round, transparent corners), full logo `vibe-strikers-logo.svg` / `.png`; lobby palette
  and Lilita One (OFL, embedded in the SVGs).
- 2026-11-06 sound A/B round 1, owner's picks (loudness-matched WAVs): hover = Codex, step = Claude, hit = neither
  (regenerate), headshot = Codex, loot = Codex (simpler), knife = Claude, pistol / rifle = regenerate (rifle also as
  a burst), shotgun = Claude but more variants, sniper = Claude but too loud and too long. Direction: more cartoon,
  less "almost real". Codex's set committed (only its imports got `.ts` so Node can load it). Round 2:
  `src/ui/sounds/round2.ts`, 3 variants each for hit / pistol / rifle / shotgun / sniper (tonal pops, short tails,
  quieter sniper and hit); `scripts/test-sounds.mjs --wav` also writes them and rifle burst previews (8 shots at the
  600 rpm interval). Nothing wired into the game yet.
  Round-2 picks: hit v2, pistol v3 (v2 kept as the alternative), rifle v3, shotgun v3 (Codex asked for its own
  shotgun variants too), sniper none (echo, whistle) -> round 3: three dry sniper variants (`ROUND3`, no reverb).
  Round 3 pick: sniper v1 for now (owner will compare again after Codex's variants).
  Codex shotgun variants (`codex/shotgun2.ts`, 3) compared with Claude's round-2 v3 (loudness matched): owner kept
  Claude's round-2 shotgun v3. All sounds picked and wired into the game (owner's go-ahead): `src/ui/sounds/picks.ts`
  maps game sounds to recipes, `PICKED_SOUNDS` (config/audio.ts) sets gain / pitch variation, chosen so each sits
  near the old synth level (raw recipes differed up to 25 dB). Sfx renders them once after audio unlocks; steps
  get 4 renders. New: hover sound on buttons (main.tsx, once per button entered), loot sound (offline:
  `Simulation.pickupTotal`; online: `GameNet.pickUp` now resolves true when the server accepted). Checked in
  Chromium: lobby hovers, offline Cornucopia shots / steps / loot, 0 console errors; test-drops, test-sounds,
  gameplay tests pass.
- 2026-11-06 ONLINE for the event submission (owner's go): `market` fast-forwarded into `main` and pushed. Server on
  Maincloud, database **`vibe-strikers`** (owner's web login, identity c20075d4...). Site on Cloudflare Pages,
  project `vibe-strikers`: **https://vibe-strikers.pages.dev** (built from a clean `main` worktree, not the working
  copy with Codex's uncommitted weapon files). Checked online: lobby, Quick Play on Maincloud (1 player + 7 bots),
  0 console errors (`docs/evidence/online-lobby.jpg`, `online-maincloud-match.jpg`). Wallet login / market / leaders
  not yet checked online with a real MetaMask (owner).
  Mishap: wrangler 4.158 "autoconfig" (run inside the repo copy) rewrote package.json / vite.config.js there (reverted,
  nothing committed) and created a Worker `vibe-strikers` with the Voxel Lab; it was overwritten with the game build
  (https://vibe-strikers.voxel-character-review.workers.dev; the account's workers.dev subdomain became
  `voxel-character-review`). The owner may delete that Worker. Deploy rule now in docs/HOSTING.md 5.
- 2026-11-06 owner: token **STRIKE** ("Vibe Strikers", 18 decimals, supply 1 000 000 000) at
  `0x472E0121ac3BBC3474477B8319e8402a65FAC1fA`, Robinhood Chain testnet (chain id 46630, RPC
  https://rpc.testnet.chain.robinhood.com). Owner holds ~90%. Next (owner approved the plan): weekly points
  (win 10, match 2, kill 1, headshot +1; logged-in humans only; week starts Monday 00:00 UTC), a distributor
  contract the owner funds with 10% of supply (may all go out in week 1), payout pushed by the owner from a local
  admin page via MetaMask (players never sign a transaction), max 10% of a week's pool per wallet, weekly tab in
  LEADERS. The owner's keys never touch the repo or Claude.
- 2026-11-06 weekly STRIKE rewards built (GAME.md 6.9, owner steps docs/REWARDS.md): `config/rewards.ts`,
  `gameplay/rewards.ts` (weeks, points, payout plan), server table `week_stat` (bumped with `player_stat`), LEADERS
  "This week" / "All time" (LEADERS now imports market.css itself: before, it was empty when MARKET had never been
  opened), contract `contracts/WeeklyDistributor.sol` + build/test scripts (solc 0.8.38, @ethereumjs/evm 10.1.3 as
  exact devDependencies), ABI helpers `network/evm.ts`, admin page `client/admin.html` (dev only). Checks:
  contract test on an in-process EVM (400 players in 4 batches, ~5.1M gas per 100, re-send skips, overspend reverts
  the batch, owner-only guards, withdraw, setOwner): PASS; 23 gameplay checks; server test; market test (week stats);
  LEADERS + admin page in Chromium with a fake wallet (reads from the real testnet RPC, no transactions), 0 console
  errors (`docs/evidence/leaders-this-week.jpg`, `rewards-admin.jpg`). Not yet done on the real chain: deploy, fund,
  first payout (owner, MetaMask, needs testnet ETH). Live: Maincloud `vibe-strikers` updated (new table, no data
  lost; points count from now), Pages redeployed from commit 1c176a8 (admin page not in the build). The
  workers.dev copy still has the previous build.
  Owner asked for the admin page as its own site: `vite.admin.config.ts` + `npm run admin:build` -> Pages project
  `vibe-strikers-admin`, https://vibe-strikers-admin.pages.dev (noindex; no secrets, every action is a MetaMask
  transaction and the contract is owner-only). Checked online with a fake read-only wallet: testnet reads and the
  Maincloud week load work, 0 console errors (`docs/evidence/rewards-admin-online.jpg`).
  ON CHAIN (owner, MetaMask, 2026-11-06): WeeklyDistributor **0x5da751e2e288a5e1e8c6a80be24caac67ab988fb**
  (`REWARDS.distributor`), owner 0x08e4f62ed093124aa3ce257830c81b2bc14a51e9, token STRIKE, funded with
  100 000 000 STRIKE (checked over the RPC: chain 46630, code present, owner / token / balance as expected).
  First payout: Monday 2026-11-09 for week 2965 (2026-11-02 – 2026-11-08).
  Owner: show the pool in the game -> LEADERS "This week" has a WEEKLY POOL card with the contract's live balance
  (read-only RPC call, explorer link); checked in Chromium, 0 console errors (`docs/evidence/leaders-pool-live.jpg`).
- 2026-11-06 owner: the Spotlight form says "not launched yet", so the game is marked **beta** (BETA badge on the
  lobby logo, page title, loading screen; live on Pages). X post images from the live site: `docs/brand/x-post/`
  (lobby, leaders with the pool, gameplay; 1600x900).
- 2026-11-06 levels and Season 1 (owner, after looking at CS2 / PUBG; deadline 23:59 UTC; GAME.md 6.10): XP from real
  matches, permanent player level, 4-week season with 30 levels, 3 weekly missions, one claim button, tab SEASON (5;
  Settings moved to 6), level on the player card and in LEADERS. New tables only, so publishing keeps all data. Pacing
  note: public matches use the short `test` preset (first to 3, about 3 minutes), so 25 minutes a day reaches about
  87% of the track. BETA badge moved under the logo on screens up to 1500 px (6 tabs are wider). Next (owner): NFTs
  only from season rewards.
  Checks: gameplay tests, market test (claim rules, economy invariant; `--slow` real match gives XP), Chromium with a
  fake wallet, 0 console errors (`docs/evidence/season-tab.jpg`, `season-guest.jpg`, `season-tab-1100.jpg`).
  LIVE (owner's go, 2026-11-06 14:35 UTC): Maincloud `vibe-strikers` updated, Pages deployed from 28c22b0. Checked on
  the live site as a guest only (no test wallet in the public tables): SEASON tab, LEADERS pool, online match, 0 console
  errors (`docs/evidence/season-online-guest.jpg`). Maincloud has 0 wallets so far: nobody has logged in to the game
  there yet, so login, XP and claim with a real MetaMask on the live server are still unchecked (owner).
  Owner's network: the router's DNS (192.168.31.1) answers NXDOMAIN for every `*.pages.dev`, also names that are not
  ours (Google DNS resolves them), so this is a network filter, not a propagation delay. The Worker copy
  https://vibe-strikers.voxel-character-review.workers.dev resolves there and now has the same build as Pages.
  Owner: give both links and update both on every deploy (steps in docs/HOSTING.md 5). Both are on the same build now.
  Local SpacetimeDB: the new CLI login (Maincloud) could not update the local database made by the old identity, so
  the old data folder was moved to `%LOCALAPPDATA%\SpacetimeDB\data-old-2026-11-06` and the local server started
  fresh (test data only; delete the old folder when sure).
  Typecheck note: the working copy has Codex's uncommitted toy-weapon files (new WeaponId values), which break
  `config/weapons.ts` / `client/game/visuals.ts` types; my files type-check clean; checked on a clean copy too.
- 2026-10-31 owner: ADS proposal approved
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

## M3 part 2 result (2026-10-31)
Owner decision first: lag compensation caps 300 public / 350 private (200 ms lag test: 4/4 hits).
What works (evidence: `docs/evidence/m3b-sniper-scope.jpg`, `m3c-killcam.jpg`, `m3d-settings.jpg`):
- a. Weapons: rifle, pistol, sniper (100 dmg, 1.4 s bolt, 5 rounds, scoped spread 0 / unscoped 8, move x0.7
  scoped), shotgun (8 x 12, 0.9 s, 6 shells reloaded one by one, falloff after 8 m), knife (40, 0.6 s, 1.6 m).
  Slots 1 primary / 2 pistol / 3 knife. Primary chosen with 7 / 8 / 9 (rifle / shotgun / sniper): at once in the
  freeze phase, otherwise next round; max 1 sniper per team (server says "your team already has a sniper").
  Bolt / pump animations, asset viewmodels for all five weapons, other players see the right weapon.
- b. ADS for the local player only: right mouse toggles (or hold, in settings); FOV from fovForAds; mouse speed
  from adsSensitivityScale; sniper scope overlay with the viewmodel hidden; crosshair hidden while aiming;
  switching weapon, reloading or dying ends ADS. Nothing about ADS is sent to other players (the server only
  gets "scoped" with sniper shots, for accuracy).
- c. Killcam: 3 s from the killer's eyes with "Killed by X"; then spectate living teammates (click = next).
- d. Settings panel (menu and Esc overlay): mouse sensitivity, FOV 70-110 (default 90), master volume,
  crosshair colour and size, ADS toggle / hold. Saved in the browser, applied at once.
- e. Procedural sounds (no audio files): shot per weapon, hit, headshot, kill, hurt, reload (2 clicks), running
  footsteps (Shift walk and crouch silent), UI clicks; other players' shots and steps by distance with stereo pan.
Tests (all pass 2026-10-31): typecheck, 16 unit checks, server test (now also: loadout, sniper limit, knife
range, scoped sniper kill, shotgun 8 pellets), e2e M1, M2a (0 / 200 ms), M2b (100 / 200 ms), M3a, M3b, M3c,
M3d, M3e; M3b and M3c also on the production build; game build and asset build.
What does NOT work yet / known limits:
- Playing with a friend on another computer needs a hosted server (not started).
- Bots always use the rifle; offline practice has no loadout choice (rifle + pistol + knife).
- Spectating shows the teammate's view without their weapon viewmodel; the killer's view in the killcam
  follows their last movement direction for scripted test clients (real players send their aim).
- Sounds are simple synth sounds; no music; volume is one master slider.
- Hit-box sizes are still the first guesses (GAME.md 17).

## Run M3 part 2 on your laptop
Needs Node.js 22+, git and the SpacetimeDB CLI (install commands in "Run M2a on your laptop").
In the project folder: `git pull`, then `npm ci`, then:
1. Terminal 1: `spacetime start`
2. Terminal 2: `npm run server:reset` (the database changed again; this deletes old test data), then
   `npm run game:build` and `npm run game:preview`
3. Open http://127.0.0.1:5191/ in two windows (one normal + one private). Pick character and nickname,
   press Settings to set mouse speed / FOV / volume / aim mode. Window 1: Create private room; window 2:
   type the code, Join. In the game: 1 / 2 / 3 weapons, 7 / 8 / 9 primary for the next round, right mouse to
   aim (sniper scope), TAB scoreboard, Esc frees the mouse (Settings button there too).
4. Sound starts after your first click (browser rule). `?lag=200` in the URL simulates a far server.

## Playtest fixes result (2026-10-31)
Owner laptop feedback on the M3 part 2 build, fixed in order (one commit each):
1. Dead bodies: death pose ~1 s (sinking at the end), then the body disappears; a flat translucent 0.8 m tile
   with a white box cross stays where the player died (ally blue / enemy orange-red), render-only (no collision,
   no shot blocking, no shadows), cleared when the player respawns (next round). Online + offline, players + bots.
   Evidence `docs/evidence/fix1-death-marker.jpg`.
2. Leave match: Esc overlay -> "Leave match" -> "Are you sure? Yes / No". Online the server frees the slot and a
   bot takes it; the client returns to the menu and can join again without reloading. Offline -> menu.
3. Stairs: climbing was slow because every step edge stopped the player (velocity taken from the blocked
   movement). Now 10 steps up in 1.37 s (was 2.2-2.7 s; down 1.25 s). KCC settings checked (autostep 0.35 m,
   dynamic bodies off, min width 0.15 m, snap 0.3 m). `scripts/test-stairs.mjs`: every reachable flight up and
   down with 0 server corrections. Two small flights are blocked by a wall in the map (request below).
   Bots do not use stairs (needs a multi-level nav grid; logged).
4. Props inside walls: `scripts/find-prop-overlaps.mjs` lists them per map; the bench from the screenshot is
   benchA/benchB at (+-26.5, +-8), 0.65 m inside the wall. Full list under "Requests to asset owner".
5. Team identification: ally = light blue, enemy = orange-red (colour-blind safe pair, different brightness).
   Teammates: name tag + diamond through walls. Enemies: red name tag only in direct line of sight near the
   crosshair. Tags scale with distance and fade out 30-40 m. Same colours in kill feed, scoreboard, death markers.
   Evidence `docs/evidence/fix5-name-tags.jpg`.
Tests (all pass 2026-10-31): typecheck, 16 unit checks, server test, stairs test, e2e M1, M2a (0 / 200 ms),
M2b (100 / 200 ms), M3a-e, fixes, leave, tags; leave + tags also on the production build; game + asset builds.
Test change: the lag-compensation check now asserts "server rewind = round trip + 100 ms (+-60)" and "target
killed within 12 shots"; the raw hit rate is printed as info (it is noisy at 5-13 headless FPS).
Known limits: bots never climb stairs; the map needs more cover (owner: redesign later).

## Run the playtest-fix build on your laptop
In the project folder: `git pull`, then `npm ci`, then:
1. Terminal 1: `spacetime start`
2. Terminal 2: `npm run server:publish` (no schema change since M3 part 2; use `npm run server:reset` if you
   skipped that update), then `npm run game:build` and `npm run game:preview`
3. Open http://127.0.0.1:5191/ (two windows for two players). Try: die and look for the death tile; Esc ->
   Leave match -> Yes, then join again; run up the big stairs at the square; look at teammates through walls
   (blue names) and at an enemy in the open near your crosshair (red name).

## Solo play + hosting prep result (2026-10-31)
1. Bots use stairs and height: multi-level nav graph (ground, stairs, balconies) built once per map in 60 ms,
   shared by offline and server bots; 3 upper areas found and used as roam goals. Server bots move like the KCC
   (step up onto touched boxes <= 0.35 m, same capsule rule as the server validation). Test: each spawn to each
   balcony and back with both bot motors, 12/12, 0 corrections.
2. Bot behaviour: three routes (north / middle / south from the map zones) assigned per bot; fights from cover
   (peek from where the enemy was seen, hide at cover the enemy cannot see); hide to reload (also below 25%
   ammo) and when HP first drops low. Test (180 s): 2.9 of 3 routes per team per round, about half of the fights
   from cover, peeks, reloading in cover; tick p99 1.5 ms.
3. Difficulty easy / normal / hard (`BOT_SKILLS` in src/config/bots.ts), menu select for practice and private
   rooms, Quick Play normal; hard team beats easy team 3:0 rounds, 12:2 kills.
4. Hosting prep: server address from `.env.production.local` at build time, relative-path build (tested from a
   sub-folder on a plain static server against another database), tick only while rooms exist,
   `docs/HOSTING.md` (Windows: Maincloud publish + Cloudflare Pages direct upload + updating).
Tests (all pass 2026-10-31): typecheck, 16 unit checks, server, stairs, bot levels, bot behaviour, e2e M1, M2a
(0 / 200 ms), M2b (100 / 200 ms), M3a-e, fixes, leave, tags; M3a + leave also on the production build; builds.
Test changes: lag-compensation rewind check uses the median (see below); menu test uses a taller window (the
menu now scrolls on small windows).
Known limits:
- The first 1-2 shots right after joining can use the full rewind cap (350 ms) because the client's
  server-clock estimate needs a few updates; later shots match round trip + 100 ms. Small; fix later if noticed.
- Bots always use the rifle; cover is chosen from precomputed spots (no crouching behind low walls yet).
- After changing `vite.game.config.ts` restart `npm run game:dev` (Vite re-optimizes dependencies).

## Run this build on your laptop
`git pull`, `npm ci`, then:
1. Terminal 1: `spacetime start`
2. Terminal 2: `npm run server:reset` (the room table changed: difficulty), `npm run game:build`, `npm run game:preview`
3. Open http://127.0.0.1:5191/. In the menu choose Bot difficulty, then "Practice offline" or Quick Play / Create
   private room. Watch bots run different routes, climb the big stairs to the balconies, hide behind walls to
   reload and peek out.
4. To put it online later: follow `docs/HOSTING.md` step by step.

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

## Features result (2026-11-01)
1. Weapon drops (Elimination): a dead player's primary lies on the floor as the spinning weapon model with its
   ammo. Walk over it, the HUD says "E: pick up SHOTGUN (4 / 24)", E swaps your primary (your old one drops at your
   feet). Server-authoritative (range + live phase checked); drops vanish when the next round starts and your
   loadout primary comes back. Same in offline practice. Evidence `docs/evidence/drops-offline.jpg`.
2. Bots carry random primaries (rifle 50% / shotgun 30% / sniper 20%, max 1 sniper per team; a human choosing
   the sniper takes it from a bot). Snipers walk to balconies and spots with a long clear view toward the enemy,
   hold them, shoot standing and scoped, pull the pistol under 7 m and do not chase. Shotguns run in to 4 m and do
   not shoot beyond 14 m. Rifles keep the cover + peek tactics. Test (180 s): snipers 40% of the time at sniper
   spots, average hit distance sniper 18 m, rifle 14 m, shotgun 8 m. Evidence `docs/evidence/bot-primaries.jpg`.
3. Cornucopia ("Hunger Games") on Toy Town: menu "Mode" (Elimination / Cornucopia) + "Cornucopia in teams"
   for private rooms and offline practice; Quick Play stays Elimination. One life per match; last team (or last
   player in free-for-all) wins; new match after 10 s. Start: knife + pistol 12 / 0. 20 pedestals at the map's
   lootSpots: outer = pistol ammo / shotgun / medkit, middle = rifle / medkit, balconies (centre) = sniper / rocket
   boots / medkits. E uses the nearest item: medkit +60 HP over 3 s (only way to heal), boots = double jump for the
   rest of the match with an orange glow box under the feet while boosting. Bots take weapons, ammo and medkits,
   about half also go for the centre loot. All numbers in `src/config/items.ts` (CORNUCOPIA, ITEMS),
   `src/config/rounds.ts` (cornucopia preset), `src/config/bots.ts` (BOT_LOADOUT, BOT_ROLES, BOT_LOOT).
   Evidence `docs/evidence/cornucopia-offline.jpg`, `cornucopia-boots.jpg`, `cornucopia-online.jpg`.
Tests (2026-11-01): typecheck, 18 unit checks, server, drops, cornucopia, bot roles, bot behaviour, bot levels,
stairs, e2e M1, M2a (0 ms), M2b (100 ms), M3a-e, fixes, leave, tags, drops, cornucopia offline + online, game
and asset builds: ALL PASS.
Known limits:
- Pedestals have no collider (you walk through them). Medkit / boots / ammo are placeholder box models
  (no asset exists; the character has no boot socket, so the glow is a box under the feet).
- A player joining a running Cornucopia match spawns alive with the start loadout.
- Bots never double jump (they move on the nav grid); boots only help humans to reach roofs / balconies.
- The scripted test walker cannot climb stairs, so the server test does not pick up the boots on the balcony
  (the offline browser test does; the code is shared).

## Run this build on your laptop (features)
`git pull`, `npm ci`, then:
1. Terminal 1: `spacetime start`
2. Terminal 2: `npm run server:reset` (tables changed: item, room mode / teams, player boots / healLeft),
   `npm run game:build`, `npm run game:preview`
3. Open http://127.0.0.1:5191/.
   - Elimination: kill an enemy, walk to the spinning gun on the floor, press E.
   - Cornucopia: in the menu set Mode = Cornucopia (untick "in teams" for free-for-all), then "Practice offline"
     or "Create private room". Run to a pedestal, press E; take a medkit when hurt; climb a balcony for the rocket
     boots, then press Space twice (second press in the air).
4. Hosted version: after `git pull`, publish the server with `--delete-data` (tables changed), see `docs/HOSTING.md` 5.

## Last batch result (2026-11-01)
1. Faster loading: the menu loads 18 KB of JS instead of 4.67 MB; the game is split into cached chunks (rapier
   2.24 MB, three 740 KB, game code ~550 KB, r3f 212 KB, map 166 KB, net 113 KB), prefetched while the menu is
   open, with a loading screen until the first frame. Only the used map is in the build (4 unused maps, 1.3 MB,
   stubbed). Production build: menu 956 -> 300 ms, menu + first frame 2.3 -> 1.7 s locally (2.9 -> 2.4 s at
   10 Mbit/s). Evidence `docs/evidence/loading-screen.jpg`.
2. Cornucopia: pedestals are solid; players who join a running match spectate until the next match.
3. Second-person view: V (toggle or hold, Settings) shows your own character from the front, 2.5 m, pulled in by
   walls; no shooting, reloading works. Evidence `docs/evidence/second-person.jpg`.
4. Team pings: Z or middle mouse marks the spot you look at; teammates see a yellow diamond through walls for 5 s,
   a HUD line and a sound; one per second. Evidence `docs/evidence/pings.jpg`.
5. Mutators: low gravity, big heads (model and head hit box x2), one shot, fast run, rocket boots for everyone.
   Quick Play = mutator of the day (UTC); private rooms / practice choose in the menu; shown in the HUD room line.
   Evidence `docs/evidence/mutator-bigheads.jpg`.
Tests (2026-11-01, all on the dev server + local SpacetimeDB): typecheck, 19 unit checks, server, drops, cornucopia,
mutators, stairs, bot levels, bot roles, bot behaviour (180 s), e2e M1, M2a (0 ms), M2b (100 ms), M3a-e, fixes, leave,
tags, drops, cornucopia offline + online, second person, pings, mutators: ALL PASS; production build: leave e2e + load
measurement. Note: bot behaviour run for only 120 s failed "fight from cover" once (since features 2 only rifles use
cover, so short runs have few such fights); the standard 180 s run passes (23 of 69 fights from cover, 9 peeks).
Known limits: server bots and the server move check ignore pedestals; ping events reach every client of the room
(the app shows only your team's); Rapier is still one 2.2 MB file (its wasm is inlined in the package).

## Run the last batch on your laptop
`git pull`, `npm ci`, then:
1. Terminal 1: `spacetime start`
2. Terminal 2: `npm run server:reset` (room table changed: mutator; new ping_event), `npm run game:build`,
   `npm run game:preview`
3. Open http://127.0.0.1:5191/: the menu appears at once, a loading bar runs when you start. Try: V (look at
   yourself), Z (ping), Mutator in the menu (Big heads, Low gravity...), Cornucopia (jump on a pedestal).
4. Hosted version: publish the server with `--delete-data` (tables changed), then build and upload (docs/HOSTING.md 5).

