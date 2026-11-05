# Voxel Arena lobby follow-up

Full-screen Toy Town replaces the framed landing-page layout. A central, independently lit character sits above a thin cyan ring and a flat contact shadow. Cream cards, dark outlines, hard shadows, an original voxel-block logo, local Lilita One font and orange PLAY action make the interface read as a game lobby.

## Measurements

Foreground steady-state measurements in the visible in-app browser on this machine, after all portraits completed. These are one-second animation-frame windows, not a cross-device benchmark. Pixel ratio was 1 during these measurements; production caps it at the smaller of MENU.maxPixelRatio (1.25) and RENDER.maxPixelRatio.

| CSS viewport / canvas | FPS | Draw calls | Triangles | Bare character screen height | Portraits |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1366 × 768 | 60.16 | 15 | 50,978 | 42.7% | 33/33 |
| 1920 × 1080 | 60.16 | 15 | 50,978 | 42.7% | 33/33 |

No page scrolling at either requested size. All 33 tiles fit at 1366 × 768, including tiles 23–33. Every 128 × 128 portrait decoded and contained character pixels: minimum 3,571 non-background pixels. Portraits render two at a time after a paint, using one reusable render target, pixel buffer and image canvas. CPU PNG cache survives re-entry; GPU resources do not.

The world uses Neutral tone mapping and the existing gradient sky / map lighting. Front key and cool rim lights keep the character readable. World shadows render once; the hero has no animated shadow-map pass. No AO runs in the menu. Frame callback creates no objects, geometries, materials or portrait images.

## Behaviour checks

| Path | Actual observed result |
| --- | --- |
| Online PLAY / Enter | Public room P6T3V; 1 player + 7 normal bots; daily Big heads mutator |
| Practice | Offline Cornucopia free-for-all; hard bots; Low gravity |
| Create room | Private room DH3D2; Easy; Elimination; Fast run; bot fill disabled, 0 bots |
| Join by code | Second browser tab joined DH3D2 with lowercase code; 2 human players, 0 bots |
| Leave match | Menu returned and resumed rendering; no menu canvas remained during the match |
| Renderer lifetime | One canvas in each tested match; menu scene disposed before game renderer starts |
| Bad room code | XXXXX produced “Could not join: no room with this code”; controls remain usable |
| Characters | Click, Random, left/right keys; hover previews hero while preserving committed selection |
| Saved choice | Reload retained nickname and selected character |
| Settings / tabs | Shared Settings panel opens with 3; PLAY and CHARACTERS keyboard shortcuts work |

MenuChoice is unchanged. Existing URL shortcut branches, menu music, saved difficulty/mode/name/character and network calls are retained. The return-to-menu teardown helper from the previous pass (`gameMount.tsx`) is byte-identical to the task-entry version.

## Checks

- `npm run typecheck`: PASS.
- `npm run test:gameplay`: PASS, 19 checks.
- `npm run game:build`: PASS; existing large-chunk advisory remains.
- Browser console errors: 0 across tested start paths and final menu.
- Scope guards: only MENU changed in game.ts; HUD CSS outside the menu block unchanged; MenuChoice unchanged; no `new` in the animation callback.
- No commits.

## Visual proof

Before captures are the landing-page version present at task entry, not the older column menu in Git HEAD. That version had an inline roster, so its “characters” capture shows the roster in use. Each native screenshot is cropped only to remove black browser-capture padding beyond the actual CSS viewport. Gentle idle motion means yaw differs between captures.

### 1366 × 768 — before left, after right

![PLAY, CHARACTERS, Practice, error](comparison-1366.jpg)

### 1920 × 1080 — before left, after right

![PLAY, CHARACTERS, Practice, error](comparison-1920.jpg)

| State | Before 1366 | After 1366 | Before 1920 | After 1920 |
| --- | --- | --- | --- | --- |
| PLAY | [Image](before-play-1366.jpg) | [Image](after-play-1366.jpg) | [Image](before-play-1920.jpg) | [Image](after-play-1920.jpg) |
| CHARACTERS | [Image](before-characters-1366.jpg) | [Image](after-characters-1366.jpg) | [Image](before-characters-1920.jpg) | [Image](after-characters-1920.jpg) |
| Practice | [Image](before-practice-1366.jpg) | [Image](after-practice-1366.jpg) | [Image](before-practice-1920.jpg) | [Image](after-practice-1920.jpg) |
| Error / friends expanded | [Image](before-error-1366.jpg) | [Image](after-error-1366.jpg) | [Image](before-error-1920.jpg) | [Image](after-error-1920.jpg) |

Raw evidence: measurements.json, portraits.json, layout.json, behaviour.json, console-errors.json and check logs in this directory. Task-entry source snapshots use `.before.txt` so TypeScript never compiles backup modules.

## Design references and choices

The design uses familiar shooter lobby hierarchy (scene, character, action card), with its own cream / orange / cyan palette and SVG block logo. No borrowed game art or fake progression features. Portraits use the existing public character API and a reusable Three.js render target rather than screenshots from external assets.

[Lilita One](https://fonts.google.com/specimen/Lilita+One) supplies the rounded display face. It is self-hosted, so lobby rendering needs no font-service request; its [SIL Open Font License](https://github.com/google/fonts/blob/main/ofl/lilitaone/OFL.txt) is included alongside the font.

## Copy list

See FILES.md for every modified/new file from this follow-up. Runtime requires seven changed/new files. Existing gameMount.tsx remains a dependency from the preceding menu pass and was not changed here. No character, weapon, map, gameplay, network, server, build-config or package file was edited.
