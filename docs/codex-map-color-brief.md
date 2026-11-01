# Brief for Codex: make the map colourful (2026-11-01)

Owner request: the map looks bad / washed out. Make Toy Town bright, readable and fun, in the same voxel
style as the characters. Owner of `src/maps/`: Codex. The game side (Claude) only reads the map through the
public API (`loadMapData`, `buildMap`, `mapColliders`, `mapShotBlockers`, `spawnPoints`).

## What is wrong now (seen in game, `docs/evidence/audit-near-after.jpg`)
- Palette is grey-beige and low saturation (`sand #C8BDA7`, `stone #B3BAB7`, `blue #8E9FA8`, sky `#DCE5E1`).
- Light is flat: `ambient` intensity 1.8 = `sun` intensity 1.8, so lit and shaded faces look almost the same.
  No depth, every wall is one flat colour.
- Sky and fog are the same pale grey-green; the horizon has no colour.
- Big empty wall and floor areas: no small details (signs, awnings, flower boxes, trims, lamps, trees).

## Goal
- Clear, saturated "toy town" look: warm sunny side, cool shadows, strong team-side identity
  (A warm: terracotta / mustard / coral, B cool: turquoise / sky blue / slate, as M2 already intends,
  but much stronger).
- Players must stay easy to see: keep floors and big walls mid-saturation; put strong colours on trims,
  roofs, doors, awnings and props. Check with the existing `contrast.ts` report (character colours vs zones).

## What to change (all inside `src/maps/`)
1. **Palette:** pick one fixed palette (see resources) and remap every palette key to it. More saturation,
   darker outlines for trims, distinct `*Top` colours.
2. **Light / sky / fog values in the map JSON:** sun clearly stronger than ambient (for example sun ~2.5–3,
   ambient ~0.6–0.9), warm sun colour, cool ambient colour, a bluer sky, fog colour matching the horizon.
   If a hemisphere light (sky colour + ground colour) is wanted, add an optional field
   `light.hemisphere: { sky, ground, intensity }` and write it in the README; the game will read it.
3. **Detail decor (no colliders, `decor`):** window frames, shutters, awnings over the market, flower
   boxes, roof edges, street signs, small trees / bushes, stripes on floors near each spawn.
   Use instancing (existing prefabs / `InstancedMesh`), never one mesh per box.
4. **Fix the open requests** in `docs/PROGRESS.md` → "Requests to asset owner": props inside walls
   (benches, lamps, crates, screens) and the blocked 3-step stairs at (±20.6, -29.3).

## Hard limits
- Collision boxes, spawns, zones and nav must not change (use `color-guard.mjs`; collider hash stays equal).
  The only allowed collider change is fixing the props-in-walls / blocked-stairs requests above.
- Public API and `MapData` shape stay compatible (new fields only optional).
- Performance: game budget 200k triangles and 120 draw calls for the whole frame (the game already shows
  ~95k tris / 144 calls in some views, so do not add draw calls; better reduce them). No textures over 2 MB,
  no per-frame work.
- Do not edit anything outside `src/maps/` (the game app, `src/config/`, `client/` belong to Claude).
- Apply to `toy-town` and all four `toy-town-l*-r*` variants (game uses `toy-town-l1-r1`).
- Proof: before / after screenshots of the same 4 views (spawn A, spawn B, fountain square, market) and
  `node src/maps/verify.mjs` passing.

## Resources (checked 2026-11-01)
Useful:
- **gamedev-skills/awesome-gamedev-agent-skills** (Apache-2.0, works in Codex): skills
  `disciplines/level-design`, `web-engines/threejs-materials-lighting`, `web-engines/threejs-scene-setup`.
  https://github.com/gamedev-skills/awesome-gamedev-agent-skills
- **Lospec palette list**: ready game palettes. Good fits: Endesga 32 (also used for voxel art),
  Jehkoba64 (vibrant). https://lospec.com/palette-list
- **Kenney City Kit (Suburban / Roads)** and **KayKit City Builder Bits**: CC0 low-poly towns. Use as a visual
  reference for colours, shapes and how much small detail a stylised street needs (not as imported meshes:
  the map stays boxes-as-data). https://kenney.nl/assets/city-kit-suburban ,
  https://kaylousberg.itch.io/city-builder-bits
- **img2threejs** (Apache-2.0): reference image → code-only Three.js model. Optional for 1–2 hero props
  (fountain, market stall) if boxes are not enough. https://github.com/img2threejs/img2threejs
- **The Level Design Book** (readability, landmarks, colour coding of routes): https://book.leveldesignbook.com

Not a fit for this map (do not use now): Hunyuan3D / TRELLIS / modly (heavy generated meshes),
Gaussian splats (spark / supersplat), Poly Haven HDRIs and textures (no textures in our style), Blender MCP.

## Game side (Claude, after the owner says yes; not part of this brief)
Tone mapping + colour space check, optional hemisphere light, soft ambient occlusion (N8AO, CC0,
https://github.com/N8python/n8ao), gradient sky. These live in `client/` and `src/config/`.
