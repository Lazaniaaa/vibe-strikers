# GAME.md — design, numbers, contracts, milestones

All numbers below are STARTING VALUES. They go into `src/config/*.ts` and are tuned
by feel and by tests. Units: meters, seconds, degrees. Status tags:
**DECIDED** = owner decided. **DEFAULT** = proposed default, owner may change.
**LATER** = do not build now.

## 1. Pillars
1. Instant play in a browser tab (link, nickname, play).
2. Good feel: hit feedback, recoil, movement, sound. Feel beats feature count.
3. Identity: ~33 collectible voxel NFT characters (more later), same look in the
   world, lobby, kill feed, killcam.
4. Fair: server authority, identical hit volumes for every character.

## 2. Modes (v1)
### 2.1 Elimination (main) — DECIDED
- Teams (default 4v4), no respawn inside a round. Rounds, first to N wins.
- Presets (`config/rounds.ts`): `test` = first to 3, round 45 s;
  `live` = first to 7, round 105 s (owner wants 90-120 s). Freeze/loadout phase 5 s,
  round end 4 s.
- Round timeout: team with larger total HP of living players wins; tie = draw.
- Loadout: chosen between rounds. Primary (rifle / shotgun / sniper) + pistol + knife
  always. No economy. DEFAULT: max 1 sniper per team.
- Dead player's weapon drops on the ground; walking over + `E` picks it up (swaps
  the slot).
- After death: killcam 3 s (view from the killer), then spectate living teammates.

### 2.2 Cornucopia (Hunger Games) — DECIDED, but LATER (not in the first week; needs its own arena)
- Own arena layout (to be made by the asset owner). One life. Last player/team standing wins. Teams optional (`teams=0` =
  free-for-all).
- Everyone starts with knife + pistol with one magazine.
- Weapons and items lie on pedestals placed by the arena data (`pedestals`, `lootSpots`): outer ring =
  pistol ammo, shotgun, medkit; middle ring = rifle, medkit; center of the atrium =
  sniper, rocket boots, medkits. The center is the most contested.
- No shrinking zone in v1.

### 2.3 LATER
Gun Game, Team Deathmatch, Free-for-all with respawn, bomb mode. Keep the mode
interface open (`GameMode` with `onRoundStart/onKill/onTick/isOver`).

## 3. Player and movement — DECIDED/DEFAULT
- HP 100. No passive regeneration. No armor (armor LATER).
- Heal item (medkit): use time 2.5 s, +40 HP up to 100, interrupted by damage or
  weapon switch. Medkits exist only in Cornucopia by default (config flag per mode).
- Run 5.5 m/s. Silent walk (`Shift`) 2.6 m/s, no footstep sound. Crouch 2.2 m/s.
- Gravity 22 m/s², jump velocity 7.0 (about 1.1 m). Air control 30%.
- Rocket boots (double jump): one extra jump in the air, velocity 6.0, short flame
  effect from the feet. Available as a pickup in Cornucopia and as a mutator.
- Movement capsule: radius 0.45, height 1.8 (crouch 1.3). Moving uses Rapier KCC.
- **Hit volumes are separate from the movement capsule and IDENTICAL for every
  character**: head box (0.9 w, 0.9 h, 0.8 d, center y 1.35) and body box
  (0.9 w, 0.89 h, 0.6 d, center y 0.445: torso, arms and legs together). These
  are first guesses from character 01 (neck at y 0.89, total height 1.8); final
  sizes are tuned after the character extents table exists (section 14). Crouch
  scales both boxes. Boxes rotate with player yaw. Headshot = ray hits the head box
  first: damage x2.5.
- Nickname 3-16 chars with a word filter. Anonymous account from the server identity.

## 4. Weapons — DEFAULT, one file `config/weapons.ts`
Hitscan, server checks every shot. Damage falls off slightly with distance only for
the shotgun.

| Weapon | Dmg | Rate | Mag | Reload | Spread (deg) | Notes |
|---|---|---|---|---|---|---|
| Knife | 40 | 0.6 s | - | - | - | range 1.6 m, always available |
| Pistol | 30 | semi, 400 rpm | 12 | 1.6 s | 0.4 | 4 body hits, 2 head hits |
| Rifle | 27 | auto, 600 rpm | 30 | 2.2 s | 0.5 + bloom | ~4 body hits; recoil pattern + random |
| Sniper | 100 | 1.4 s bolt | 5 | 3.0 s | 0.0 scoped, 8 unscoped | scope zoom x3, move speed x0.7 while scoped |
| Shotgun | 8 pellets x 12 | 0.9 s | 6 | 0.5 s per shell | 6 | falloff beyond 8 m |

Spread grows with movement and sustained fire; resets over 0.3 s. Fire sound,
muzzle flash, tracer, hit marker, damage numbers (toggle) are part of the feel.

## 5. Camera and views — DECIDED
- First person is the main view. Viewmodel = weapon + the character's gloves/hands
  (`createViewmodel`). Own head/torso are not rendered in first person.
- **Aiming (ADS, right mouse button) is visible ONLY to the local player**, like in
  Counter-Strike. Other players and the front/second-person camera always see the
  firearm in the same HIP hold (weapon on the right side). Do NOT sync an "aiming"
  flag for visuals and do NOT pass `ads` to `poseCharacter`. (The server may still
  need it later for spread; not now.)
- ADS in first person: viewmodel blends to the centred sight (`ads` 0..1), FOV zooms
  with `fovForAds(weaponId, ads)`, mouse sensitivity scales with
  `adsSensitivityScale(weaponId, ads)`. Sniper uses the 2D scope overlay
  (`scopeOverlay`) and hides the viewmodel when scoped. Shooting without ADS is
  always allowed; the crosshair is drawn by the game.
- ADS input — DECIDED (owner 2026-10-31, build in M3): right mouse button is a TOGGLE
  by default (click once to aim, click again to stop). Setting "ADS mode: toggle / hold"
  switches to hold-to-aim. DEFAULT (proposed, owner may change): weapon switch, reload
  start and death leave ADS.
- "Second person" (`V`): camera in front of the player looking back at the character
  (like Minecraft F5 front view). Own character is rendered in the HIP hold. Distance
  2.5 m, shortened by a ray against walls. **Shooting disabled, reloading allowed.**
  Setting: toggle (default) or hold.
- No behind-the-back third person for now (LATER).
- The character is also shown in lobby (turntable), killcam, spectate, win screen
  (team lined up).

## 6. Networking
### 6.1 Rules
Clients send intents; server owns state. Exception (owner decision 2026-10-30,
revisit after the cloud phase): the client runs its own movement (Rapier KCC) and
sends the result; the server validates it (6.6) and snaps back on violation.
Interpolation for remote players; the local player is corrected only on a snap-back
(by input sequence number). Keep the real values in `config/net.ts`.

### 6.2 Intents (client -> server), initial contract
`move{seq, ack, x, y, z, vx, vy, vz, yaw, pitch, crouch, grounded, walk}` (client KCC result,
sent at the net send rate; `ack` = last server correction the client has applied, older moves are
ignored), room reducers `join_quick{name, character}`, `create_private_room{name, character}`,
`join_by_code{code, name, character}`, `leave_room` (M2a), `fire{seq, yaw, pitch, viewTime}` (viewTime = server time of
the world the client was showing, used for the rewind), `reload`, `switchWeapon{slot}`,
`pickup{itemId}`, `useHeal`, `emote{id}`, `ping{x,y,z,kind}`,
`chat{text}` (private rooms only), `joinRoom{code|quick, nickname, characterId}`,
`loadout{primary}`, `pingMeasure` (RTT every 1 s).

### 6.3 State (server -> clients)
Snapshots of players (position, yaw, pitch, hp, weapon, pose flags: speed,
moveDir, shooting, crouching, grounded, dead, emote, reloading), items on the
ground, round state, scores. Events: `hit`, `kill{killer, victim, weapon, head}`,
`roundStart/End`, `matchEnd`, `emote`, `ping`.
Document the final field list in `docs/CONTRACTS.md` and generate client bindings
before UI work (schema first, rendering after).

### 6.4 Lag compensation (hit validation) — DECIDED
- Server keeps a ring buffer of recent hit-volume positions per player.
- On `fire`, rewind to (shooter's latency + interpolation delay), capped by
  `maxRewindMs`: **250 public rooms, 300 private rooms** (config).
- `interpolationDelayMs` is a separate config value (start 100, test lower).
- Raycast against rewound head/body boxes and the map boxes; apply damage now.
- Show ping (RTT) and FPS in the HUD (setting, default on).
- Test with artificial latency 100 and 200 ms (a tester far from the server had
  170-220 ms to Singapore).

### 6.5 Rooms and matchmaking — DECIDED
Room config: `{mode, teamSize, maxPlayers, fillBots, mutator, isPrivate, region,
code, preset}`. Default 4v4, up to 16 after a load test (`100-bot` script).
Entry: Quick Play (nearest region, bots fill), private room by code or link,
bots-only room (practice). Region is part of the room code. One region at first;
rooms are independent so more regions can be added later.

### 6.6 Movement validation — DECIDED (owner 2026-10-30, phase 1)
- Server accepts a `move` only if: seq is newer; horizontal distance since the last
  accepted position <= (max speed for the state + tolerance) x elapsed time; vertical
  change fits jump velocity / gravity / max fall speed (+ tolerance); the capsule does not
  overlap any `mapColliders` box (small epsilon); no single step longer than the teleport
  cap. Values in `config/net.ts`.
- On violation: keep the last valid position and send a correction; the client snaps to
  it and continues from there. Count violations per player (logged, kick threshold later).
- Server bots move along the nav grid and pass the same checks.
- One `MovementAuthority` interface on the server: `ClientValidated` now, a fully
  server-simulated version can replace it later without changing the contract for hits.

## 7. Bots — DECIDED
Server-side fake players using the same intent path. Waypoint graph generated from
`mapData`. Simple behavior: walk between waypoints, turn to visible enemies, shoot
with aim error and 300-500 ms reaction. Difficulty fields exist now
(`accuracy, reaction, aggression`) but only `normal` is implemented. Bots also run in
the load test (100 bots).

## 8. Mutators — DECIDED (LATER, after M3)
`lowGravity` (gravity x0.4), `bigHeads` (head model AND head hit box x2, server
applies it), `oneShot` (any hit kills), `fastRun` (speed x1.5), `rocketBoots`
(everyone has the double jump). Rotation: mutator of the day is chosen by the
server from the UTC date (`index = hash(date) % list`), with an option to force one
in private rooms. A normal round has no mutator.

## 9. Social
Emote wheel (hold `G`, 6 emotes, procedural pose on the character), team pings
(marker for 5 s, rate-limited), text chat in PRIVATE rooms only (rate limit +
word filter). Voice chat LATER.

## 10. HUD and settings
HUD: crosshair, HP, ammo/weapon, round timer and score, kill feed, hit marker,
damage direction, TAB scoreboard, killcam banner, spectate overlay, ping + FPS.
Settings: mouse sensitivity, FOV (default 90, 70-110), volume (master/sfx/music),
crosshair (color, size, style), second-view mode (toggle/hold), ADS mode (toggle
default / hold, owner 2026-10-31, M3), ping+FPS on/off.
Key rebinding LATER.

## 11. Visual style — DECIDED
Flat colors with thick black outlines, like the NFT renders, plus soft shadows and
cheap improvements that make it look better (one directional light with soft
shadow map, hemisphere light, simple fog, color grading allowed). Outlines by
inverted hull on boxes or a cheap post-process edge pass: pick the cheaper one after
a profile. Characters come from `src/characters/` already outlined; do not add a
second outline to them.

## 12. Audio
SFX are procedural (ZzFX style), no files: shots per weapon, hit, headshot,
reload, footsteps (positional, silent while sneaking), UI. Music is generative and
subtle, layered by situation: lobby (calm), round (rhythm), last 15 s (tension), win
sting. Code-generated, no music files.

## 13. Map: "Toy Town" — DECIDED (built and approved by the asset owner)
- Map 1 is `src/maps/data/*.json`, loaded with `loadMapData`. Pastel voxel town,
  about 70 x 70 m (bounds about 35 m half-size), mirror-symmetric team halves, spawns
  about 57 m apart, 6+6 team spawns, 16 FFA spawns, 20 loot spots, zones with names for
  callouts and pings. Three routes: MID (central square with fountain, stairs, big
  striped building), LEFT and RIGHT lanes (see the map README for the chosen option).
  Warm colours = team A half, cool colours = team B half.
- Rendering `buildMap`, physics `mapColliders`, server hit tests `mapShotBlockers`,
  bots derive their waypoint graph from the same data. The map files are NOT edited
  by the game agent.
- Characters are bright (pink, lilac, lime, black); the map is calm on purpose.
- Game needs from the map data: use `spawns`, `lootSpots` (Cornucopia later),
  `zones`, `killY`, light/fog settings. Reserve `surface?: 'normal' | 'ice'` for a
  later ice map (not in the data yet: ask the asset owner via PROGRESS.md).
- Cornucopia (Hunger Games) needs its own arena layout: LATER, not in the first week.

## 14. Characters and weapons (assets, finished)
- Public APIs and measured facts are in `docs/ASSETS.md`; the READMEs in
  `src/characters/`, `src/weapons/`, `src/maps/` are the source of truth if they differ.
- Characters: 33 NFT characters (`characters` list), `createCharacter(config)`,
  `poseCharacter(group, state, dt)`, all 1.80 m tall (body), at most 8 meshes. Game owns
  position/yaw of the outer group; the character code owns the `rig`.
- Weapons (visual only): knife, pistol, rifle, sniper, shotgun. Firearms are two-handed
  in third person (long-arm variant, handled inside `poseCharacter` via the optional
  `weapon` state field); knife is one-handed. First person uses `createViewmodel` /
  `poseViewmodel` with the character's own glove colours.
- NOT BUILT (use placeholders, request later in PROGRESS.md): emotes, rocket-boot
  flames, reload/fire arm animation beyond what the weapon API gives.
- Hit volumes are IDENTICAL for every character (fairness): head box 0.9 x 0.9 x 0.8
  (centre y 1.35), body box 0.9 x 0.89 x 0.6 (centre y 0.445), separate from the
  movement capsule. Head/body extents of the 33 characters were not all measured; if a
  character looks much wider than its hit box, log it in PROGRESS.md, do not change boxes.
- Until characters are integrated, every player is a capsule.
- Lobby shows a turntable of the selected character. Character list has `unlock`
  reserved; everything unlocked now.

## 15. Anti-cheat and safety (basic)
Server authority, input rate limits, plausibility checks on movement speed and fire
rate, chat/nickname filter and rate limit.

## 16. Milestones (stop and report after each)
Time box: the cloud credits expire 2026-11-05 and the work starts 2026-10-30, so the
plan below fits about 6 days. Credit guide, ESTIMATE only (owner checks the real
meter): M0 ~8%, M1 ~25%, M2 ~30%, M3 ~25%, rest ~12%. If credits run low, stop at the
end of the current milestone and write the state in PROGRESS.md. Order of priority:
a working fair multiplayer shooter > nice features.

**M0 Environment + starter.** Section "Milestone 0" in CLAUDE.md. Done when: the
starter or the fallback runs, two browser tabs see each other, SpacetimeDB vs Colyseus
decision is recorded, `PROGRESS.md` is updated, the asset folders load (characters,
weapons, map render in a test page).

**M1 Playable single player on Toy Town.** Map from `buildMap`, Rapier KCC movement
on `mapColliders`, first-person camera with viewmodel, pistol + rifle hitscan from
`config/weapons.ts`, capsule or character bots, basic HUD, 60 fps. Done when: you can
play a round vs bots, screenshot saved, no console errors.

**M2 Authoritative multiplayer.** Intents, snapshots, prediction, interpolation, lag
compensation with `maxRewindMs`, rooms by code, bots-only room, artificial latency
test. Real characters (HIP hold, `poseCharacter`) for remote players. Done when: two
real tabs fight fairly at 100 and 200 ms simulated latency.

**M3 Elimination mode.** Round state machine, scoreboard, kill feed, hit markers,
killcam + spectate, ping/FPS HUD, settings (sensitivity, FOV, volume, crosshair),
procedural SFX, character select + nickname, all five weapons (sniper with scope
overlay and ADS zoom), ADS for local player. Done when: a full match works with bots
and a human; owner can open a link and play with a friend by code.

**Later (only if credits remain; otherwise leave for the laptop phase):** drops and
pickup, mutators, second-person view, emote wheel and pings, Cornucopia mode and arena,
generative music, ice map, 12-16 player load test, hosting and regions.

## 17. Open decisions (do not decide silently)
- Hosting provider and region(s) after the cloud phase.
- Final hit-volume sizes (extents of all 33 characters were not fully measured).
- Whether `interpolationDelayMs` can drop below 100 without visible jitter.
- Max room size above 8 (needs the load test).
- Whether sniper limit and medkit-in-Elimination stay as defaults.
