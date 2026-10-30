# PROGRESS.md — read this first

Date started: 2026-10-30. Credits expire 2026-11-05.

## State
- Repo has: CLAUDE.md, docs/GAME.md, docs/ASSETS.md, this file.
- Asset folders `src/characters/`, `src/weapons/`, `src/maps/`, `tools/` are uploaded by
  the owner (check they exist before M0 ends; if missing, tell the owner).
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
