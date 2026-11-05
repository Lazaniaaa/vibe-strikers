# Lobby animation review

Implemented relaxed unarmed lobby idle and five short clips: Wave, Cheer, Dance, Shrug and Joy hop. Idle breathes over 4.2 seconds, with small arm sway, intermittent head glances, planted feet and a gentle upper-body weight shift. A deterministic id seed offsets each character's phase. A 0.2-second envelope/crossfade returns to idle and supports interruptions.

Buttons are below Change character. Keyboard: E, then 1–5; ordinary 1/2/3 still selects the existing tabs. Initial and committed selections request a random intro clip. Hover previews and portrait renders use idle. All 33 portraits decode and contain rendered content.

## Public API and isolation

prepareLobbyAnimation(group) allocates the per-instance scratch state once. playEmote(group,id) requests a clip. updateAnimation(group,dt) updates only existing part transforms; it never invokes the firearm solver. All animation tuning is in LOBBY_ANIMATION, clip durations in LOBBY_EMOTES. No match intent or network integration was added. Full usage is in src/characters/README.md.

The old createCharacter, poseCharacter, arm variants, configs, weapons and all game match code are byte-identical to the task-entry versions. Geometry SHA-256 values match all 33 archived models. All 825 archived match-transform cases match exactly both before and after exercising the lobby API on the same instances. The outer transform is unchanged. No geometry/material/mesh was added to a character.

## Checks

| Check | Result |
|---|---|
| npm run verify | PASS, including existing character/weapon contracts and new lobby checks |
| npm run typecheck | PASS |
| npm run test:gameplay | PASS, 19 checks |
| npm run game:build | PASS; existing bundle-size advisory remains |
| Sampled idle/emote updates | 32,472 across all 33 |
| Arm/fist to head/torso | Independent OBB test passes; minimum sampled corner clearance 0.006000 m |
| Fused upper-arm/hand joint gap | 0 m |
| Largest shoulder movement in a sampled 60 Hz frame | 0.045718 m |
| Timed updates | 47,124 |
| Worst update | 0.1781 ms, vibe-vibers-viber-142 (strict < 1 ms check) |
| Allocation audit | No allocating syntax in update/hot helpers; cached scalar scratch and existing transforms |
| Console errors in browser tests | 0 |

Timing runs in a warmed, isolated child process so the allocation-heavy independent geometric verifier cannot charge its GC to the measured animation. GC is invoked before each clip, outside timed calls. The strict threshold remains 1 ms. This is a local CPU measurement, not a guarantee against OS scheduling stalls.

## Menu rendering

| View | FPS | Draw calls | Triangles |
|---|---:|---:|---:|
| 1366×768 idle | 60.16 | 19 | 12,762 |
| 1920×1080 idle | 60.16–60.17 | 19 | 12,762 |
| 1366×768 dance, observed | 60.17 | 19 | 12,762 |

No page scroll at either requested size. The selected hero occupies approximately 40% of the viewport height. The emote bar fits below its name/selector.

## Shape handling

Most relaxed arms open about 3.4 degrees from vertical. bureau-8, viber-141 and viber-6 use wider openings because their original fused hands would otherwise reach below the feet. Rotated head/torso clearance uses 15 fixed separating axes, not an iterative orientation search. Lobby-only shoulder translations separate the existing boxes; hand geometry remains fused to the upper block. These offsets are measured across idle and all clips, not solely at rest.

| Character | Relaxed opening, deg | Max outward shoulder correction, m | Max update, ms |
|---|---:|---:|---:|
| reference-01 | 3.4 | 0.0859 | 0.0433 |
| bureau-8 | 44.7 | 0.0788 | 0.0439 |
| viber-extra-12 | 3.4 | 0.1534 | 0.0717 |
| viber-142 | 3.4 | 0.1590 | 0.1781 |
| viber-extra-11 | 3.4 | 0.0219 | 0.0282 |
| bureau-25 | 3.4 | 0.0577 | 0.0806 |
| bureau-roll-22-11 | 3.4 | 0.0530 | 0.0399 |
| bureau-roll-48-7 | 3.4 | 0.0766 | 0.0346 |
| bureau-roll-7-11 | 3.4 | 0.0623 | 0.0803 |
| viber-32 | 3.4 | 0.0532 | 0.0467 |
| viber-10 | 3.4 | 0.0826 | 0.0626 |
| viber-103 | 3.4 | 0.0237 | 0.0434 |
| viber-31 | 3.4 | 0.0534 | 0.0300 |
| viber-42 | 3.4 | 0.0538 | 0.0944 |
| viber-71 | 3.4 | 0.1733 | 0.0603 |
| bureau-23 | 3.4 | 0.1776 | 0.0889 |
| bureau-4 | 3.4 | 0.0689 | 0.0363 |
| bureau-roll-40-10 | 3.4 | 0.1306 | 0.0716 |
| viber-141 | 39.0 | 0.0907 | 0.0460 |
| viber-48 | 3.4 | 0.1305 | 0.0810 |
| bureau-24 | 3.4 | 0.0773 | 0.0794 |
| bureau-roll-22-12 | 3.4 | 0.1728 | 0.0381 |
| viber-6 | 23.5 | 0.1668 | 0.0747 |
| viber-63 | 3.4 | 0.1191 | 0.0356 |
| viber-84 | 3.4 | 0.1424 | 0.1148 |
| viber-extra-20 | 3.4 | 0.0816 | 0.0570 |
| bureau-31 | 3.4 | 0.0547 | 0.1106 |
| bureau-roll-9-5 | 3.4 | 0.0675 | 0.0275 |
| viber-123 | 3.4 | 0.0840 | 0.0671 |
| viber-extra-19 | 3.4 | 0.0654 | 0.0526 |
| viber-extra-15 | 3.4 | 0.0698 | 0.0895 |
| viber-extra-24 | 3.4 | 0.0803 | 0.0390 |
| viber-extra-9 | 3.4 | 0.0724 | 0.1126 |

## Visual proof

- [Lobby, 1366×768](lobby-idle-1366.jpg); [1920×1080](lobby-idle-1920.jpg); [Wave](lobby-wave-1366.jpg); [Dance](lobby-dance-1366.jpg).
- [All 33 idle strips](idle-atlas-all-33.png): three frames per character at 0 / 1.4 / 2.8 seconds; individual idle-*.png files are included.
- [All five emotes on three proportions](emote-atlas-three-proportions.png): viber-142 (small arms), Malynovyi (normal), viber-141 (large head); each has three clip frames at 20 / 50 / 80%. Individual strips are included.
- [Match before/after](match-before-after.png), same fountain review view at 1366×768. The screenshots contain the normal existing rifle hold. Independent exact transform/geometry checks establish unchanged match behavior; live match counters vary slightly with the running scene.
- [Controls](controls.json), [FPS](measurements.json), [CPU](performance.json), [contracts](contracts.json), [scope guard](scope-guard.json), [console](console-errors.json).

## Files

See [FILES.md](FILES.md) for all 13 runtime/support files. No commit was made. The original verifier regenerates three weapon JSON reports; their exact task-entry bytes were restored after verification. Existing edits from prior menu/island tasks were preserved.
