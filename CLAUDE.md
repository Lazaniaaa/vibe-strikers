# CLAUDE.md — Voxel Arena FPS (working title)

Browser 3D multiplayer FPS, Counter-Strike-style, with voxel NFT characters
(vibe/vibe collection). Desktop only (keyboard + mouse). No wallets, no crypto in
this phase.

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
1. **Server authority.** Clients send intents only (move, aim, jump, fire, reload,
   switch, use, emote, ping). The server owns positions, cooldowns, ammo, health,
   scores, round state and hit detection.
2. **No React state in the frame loop.** No `setState` and no `new Vector3()` /
   `new Object3D()` inside `useFrame` or `requestAnimationFrame`. Mutate refs, reuse
   scratch objects.
3. **No custom physics math.** Use Rapier's KinematicCharacterController for player
   movement. Hit detection on the server is a ray against map boxes and per-player
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

## Credits and workflow
- The owner has a limited credit budget that expires 2026-11-05 (the project started 2026-10-30, so the whole cloud phase is about 6 days: keep milestones small). Work in milestones
  (GAME.md). At the end of each milestone: run checks, commit, push, update
  `docs/PROGRESS.md`, then STOP and tell the owner to check the credit meter before
  you continue.
- For any task bigger than ~1 hour of work: write a short plan first and wait for
  approval.
- One agent at a time unless the owner asks for parallel agents. Parallel agents only
  inside separate folders.
- Screenshots are expensive. Take them at gates, not after every edit. Use small
  ones when possible.
- Commit and push after every milestone and every risky change. The cloud container
  is temporary: unpushed work can be lost.
- Do not refactor for taste. Do not add features that are not in the current
  milestone.

## Out of scope now (do not build; do not block)
Levels/XP unlocks (keep an `unlock` field), wallet login, bomb mode, ice map and
slide, seasonal characters, more weapons/skins, voice chat, mobile, regions beyond
one. Leave clean extension points only.

## Performance
Target 60 fps on an average laptop. Merge static geometry, reuse materials, no
per-frame allocations, budget for the visible triangle count is written in
`docs/PROGRESS.md` after Milestone 0.
