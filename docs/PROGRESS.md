# PROGRESS.md — read this first

Date started: 2026-10-30. Credits expire 2026-11-05.

## State
- Repo has: CLAUDE.md, docs/GAME.md, docs/ASSETS.md, this file, the asset folders
  `src/characters/`, `src/weapons/`, `src/maps/` and the Voxel Lab root files
  (`package.json`: three 0.186.1, vite 8.3.5; `vite.config.js`).
- `npm install`, `npm run build` and `npm run verify` pass on the assets (checked 2026-10-30).
- Large generated reports and images from the asset phase were left out on purpose.
- Map files: `src/maps/data/toy-town.json` plus four lane options
  (`toy-town-l1-r1`, `l1-r2`, `l2-r1`, `l2-r2`); the owner has not chosen yet (start with `toy-town-l1-r1`).
- No game code yet.

## Next step
Milestone 0 (environment smoke test) from CLAUDE.md, then M1 from docs/GAME.md.

## Environment (fill in at M0)
- node/npm:
- Rust / spacetime CLI:
- Headless Chromium WebGL:
- Starter template result:
- Server decision (SpacetimeDB or Colyseus) and why:
- Pinned versions:
- Triangle budget:

## Requests to asset owner
(none yet; emotes, rocket-boot flames, ice-surface field are known gaps)

## Decisions log
- Aiming is visible only to the local player (first person); others see HIP hold.
- Hit volumes identical for every character.
- Public rooms maxRewindMs 250, private 300; interpolationDelayMs starts at 100.
