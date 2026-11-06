# CLAUDE.md — Vibe Strikers (was "Voxel Arena"; technical names such as the `voxel-arena` database stay)

Browser 3D multiplayer FPS, Counter-Strike-style, with voxel NFT characters
(vibe/vibe collection). Desktop only (keyboard + mouse). Wallet login only (owner
2026-11-05): sign a text message, Robinhood Chain testnet, never mainnet, no transactions,
no real money (GAME.md 6.8).

The owner speaks Ukrainian (English ~B1). Talk to the owner in Ukrainian, short and
simple. Code, comments, commit messages and docs are in English.

## Read order (do not read everything every session)
1. `docs/PROGRESS.md` — current state and the next step. Always first.
2. This file.
3. `docs/GAME.md` — only the sections for the current milestone.
4. `docs/ASSETS.md` — only when integrating characters, weapons or the map.
5. The README of the asset folder you touch (`src/characters/`, `src/weapons/`, `src/maps/`).
Do not open images or binary files unless the task needs them.

## Milestone 0 first: environment smoke test
Before any feature work, check and write the result into `docs/PROGRESS.md`:
- node / npm versions, can packages install?
- Rust toolchain (`cargo`) and the SpacetimeDB CLI (`spacetime`): can they install?
- Is a headless Chromium with WebGL available for screenshots?
- Starter template: clone and run
  `majidmanzarpour/vibe-coding-starter-pack-3d-multiplayer` (check that it exists and
  what it contains before relying on anything in this file about it).

**Fallback rule:** if the SpacetimeDB toolchain cannot be installed or the server
module cannot be built after two honest attempts, STOP trying. Switch the server
to Colyseus (100% TypeScript, installs through npm), write the decision and the
reason in `docs/PROGRESS.md`, and tell the owner in one message. Do not spend
credits fighting the toolchain.

## Stack and versions
- Three.js + React Three Fiber + drei, Rapier (`@react-three/rapier`),
  SpacetimeDB (or Colyseus, see fallback). TypeScript everywhere.
- Pin EXACT versions in `package.json` (no `^`, no `latest`). Look them up with
  `npm view <pkg> version` at the start and record them in `docs/PROGRESS.md`.
  Never mix API styles from different versions.

## Hard rules
1. **Server authority** (owner decision 2026-10-30, revisit after the cloud phase).
   Clients send intents (aim, fire, reload, switch, use, emote, ping). Movement is the
   one exception: Rapier cannot run inside the SpacetimeDB module, so the client runs
   the Rapier KCC and sends its position, velocity and input seq; the server VALIDATES
   it (max speed with jump/fall tolerance, capsule not inside map boxes, no teleports)
   and snaps the player back to the last valid position on a violation. The server owns
   everything else: HP, ammo, cooldowns, fire rate, hits (lag compensated), rounds,
   scores and bots. Keep validation behind one interface so fully server-side movement
   can replace it later (GAME.md 6.6).
2. **No React state in the frame loop.** No `setState` and no `new Vector3()` /
   `new Object3D()` inside `useFrame` or `requestAnimationFrame`. Mutate refs, reuse
   scratch objects.
3. **No custom physics math.** Use Rapier's KinematicCharacterController for player
   movement (client). Server bots move along the nav grid without Rapier and pass the
   same movement validation. Hit detection on the server is a ray against map boxes and per-player
   hit volumes (see GAME.md), not Rapier.
4. **All gameplay numbers live in `src/config/`.** No magic numbers elsewhere.
5. **Map is data.** The map is JSON (`src/maps/data/*.json`, loaded by `loadMapData`)
   shared by rendering (`buildMap`), Rapier colliders (`mapColliders`), bot navigation
   and server raycasts (`mapShotBlockers`). Do not hand-copy map geometry anywhere.
6. **Greybox first.** Every mechanic must be playable with capsules and boxes before
   real art is plugged in. No asset over 2 MB.
7. **Visual proof gate.** A task is done only when: type-check passes, the feature
   was seen running (screenshot saved to `docs/evidence/`), and the browser console
   has no errors.

## Folder ownership
- `src/characters/`, `src/weapons/`, `src/maps/`, the root `vite.config.js` and the
  `dev` / `build` / `verify` scripts in the root `package.json` (the "Voxel Lab"
  preview and the asset verify scripts) are owned by another agent (Codex). NEVER edit them. Use them only through
  their public API (see `docs/ASSETS.md` and each folder's README). If the API is not
  enough, write the request in `docs/PROGRESS.md` under "Requests to asset owner" and
  use a capsule / box / placeholder meanwhile.
- The root `vite.config.js` must stay as it is (its root is `src/characters`; the asset
  verify scripts depend on it). The game app needs its OWN config, for example
  `vite.game.config.ts` with root `client/` or similar. You may ADD dependencies and
  scripts to the root `package.json` (exact versions), but do not change the existing
  ones.
- You own: `src/network/`, `src/gameplay/`, `src/ui/`, `src/config/`, `server/`,
  `docs/` (except ASSETS.md facts about the asset folders).
- Gameplay numbers (damage, fire rate, ammo, reload time) live only in `src/config/`;
  the asset folders contain visuals only.
- Change a shared type only after updating `docs/GAME.md` (network contract).
- Codex works in its own copy (`C:\Users\User\Documents\Codex\2026-10-26\build-the-voxel-style-characters-for`)
  that does NOT have the type-only casts listed in `docs/PROGRESS.md` ("Changes made in asset
  folders"). When Codex delivers files, copy only those files into the repo and re-apply the
  casts. Never overwrite the repo with Codex's whole folder.

## Workflow (laptop phase, since 2026-11-01)
- The cloud phase is over. Work runs locally on the owner's Windows laptop (PowerShell)
  under the owner's Claude subscription limits. There is no credit deadline, but usage is
  limited: keep messages short, read only what the task needs, avoid long test runs that
  are not needed.
- Before any task bigger than a small fix: write a short plan (what, why, which files)
  and wait for the owner's yes. Do not start new features until the owner says what is next.
- Work in small steps. After each finished step: run the checks (`npm run typecheck`,
  `npm run test:gameplay`, and `node scripts/test-server.mjs` when `server/` changed),
  update `docs/PROGRESS.md`, commit with a clear message, then tell the owner in
  Ukrainian what changed and what is next.
- Push to `main` only when the owner agrees; otherwise work on a branch and open a PR.
- When the owner must run something, explain the command in plain words first, one step
  at a time.
- The browser tests (`scripts/e2e-*`) were written for the Linux cloud container; on
  Windows they may need `npx playwright install chromium` and path changes. Do not spend
  effort on them unless the owner asks.
- Keep line endings as they are in each file (some files are CRLF).
- One agent at a time unless the owner asks for parallel agents. Parallel agents only
  inside separate folders.
- Screenshots are expensive. Take them at gates, not after every edit. Use small
  ones when possible.
- Do not refactor for taste. Do not add features the owner did not ask for.

## Out of scope now (do not build; do not block)
Character unlocks by level (keep the `unlock` field; levels and seasons exist, GAME.md 6.10), on-chain anything beyond the weekly STRIKE payout
(GAME.md 6.9: owner-signed testnet transfers only; no NFT ownership checks, no player transactions,
no mainnet), bomb mode, ice map and
slide, seasonal characters, more weapons/skins, voice chat, mobile, regions beyond
one. Leave clean extension points only.

## Performance
Target 60 fps on an average laptop. Merge static geometry, reuse materials, no
per-frame allocations, budget for the visible triangle count is written in
`docs/PROGRESS.md` after Milestone 0.
