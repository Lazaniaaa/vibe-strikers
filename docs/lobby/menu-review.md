# Voxel Arena — main menu review

Completed 2026-11-04. Six authorised runtime files changed, plus evidence under client/game/menu-review. No commits. The final game build is restored and served at http://127.0.0.1:5191/.

## Result

Toy Town and a turntable character occupy the left side. The right panel has Play, Play with friends and Practice; room options appear only inside Friends/Practice. Controls are English; asset proper names are retained. Settings uses the existing shared panel. Menu music and click sounds retain their existing wiring.

The scene uses createCharacter/poseCharacter and loadMapData/buildMap(data, {bakedAo:false}), the existing gradient sky, Neutral tone mapping and map JSON lighting. One renderer draws the world and hero passes. Static world shadows update once; the small hero shadow moves. There is no runtime or baked AO in the menu.

All 33 real portraits render once per page lifetime using the menu renderer and one reusable 128px render target. One portrait is processed per 32ms timer task outside the animation callback; pixel buffers and the conversion canvas are reused. Cached CPU images survive menu re-entry; GPU resources do not. Unlock is optional and all current characters are unlocked.

## Measurements

| Actual CSS viewport | Menu canvas pixels | FPS | Calls | Triangles | Portraits | Page scroll |
|---|---|---:|---:|---:|---:|---|
| 1366 × 768 | 943 × 480 | 60.16 | 21 | 52658 | 33/33 | None |
| 1920 × 1080 | 1410 × 740 | 60.16 | 21 | 52658 | 33/33 | None |

These are steady-state foreground readings from the menu's one-second renderer/FPS window after shader warm-up and portrait completion, on the local AMD Radeon integrated-GPU laptop. Pixel ratio was 1; the cap is min(MENU.maxPixelRatio=1.25, RENDER.maxPixelRatio). These readings do not guarantee the same performance on every laptop or character. Hat and glow characters were also selected successfully. Raw records: [measurements.json](measurements.json).

The browser zoom made viewport-control dimensions differ from CSS pixels. Actual innerWidth/innerHeight and document scroll sizes were checked. Captures were cropped only to those viewport bounds to remove the screenshot tool's black padding. Scene/UI content was not edited. Temporary viewport overrides were reset.

The DOM is created synchronously; scene/metadata import is deferred by MENU.lazyDelayMs. React game mounting is lazy too. A generation token cancels late imports when a match starts. WebGL creation failure leaves the menu DOM and choices usable with a preview-unavailable message. The existing Vite vendor-preload policy remains unchanged: scene construction and its module are deferred, not every vendor download.

## Behaviour proof

| Check | Observed result |
|---|---|
| Play | Entered real public rooms, including final SJ4K5. Menu canvas removed; one game canvas. |
| Create | NJ2RQ received Hard, Cornucopia FFA, Low gravity and bot fill. Final XN4Z4 received Elimination/Normal and zero bots. |
| Join by code | UI joined NJ2RQ with lowercase code; room showed two human players. |
| auto=join, name, character | Separate final tab joined XN4Z4 as JoinTester with character=18. No console errors. |
| Practice | Started offline Elimination with Normal bots. Menu canvas removed. |
| Leave | Online and offline Leave/Yes restored the animated menu, 33 cached portraits and one menu canvas. |
| Invalid code | XXXXX displayed “Could not join: no room with this code”; creating a room afterwards worked. |
| Character select | Portrait click, previous/next, keyboard arrows and Random updated hero/name. Choice restored after reload. Text-field arrows retained editing behaviour. |
| Saved options | Name, difficulty and mode restored on subsequent loads/tabs; teams/mutator/bot fill transmitted correctly. |
| Settings/music | Shared Settings opened/closed; existing menu-mood/click-sound wiring retained. |
| Test URLs | offline, auto=quick/create/join, name, character and debug parsing retained. debug and auto=join/name/character were exercised; remaining shortcut branches inspected for preservation. |

R3F has a separate reconciler: gameMount awaits its public unmount callback before returning to the menu. Menu teardown stops the animation loop, portrait timer and observer, then disposes its GPU resources before mounting a match. The two renderers do not draw concurrently on the same page.

A null sky uniform was found during initial transition testing. The new gameMount module temporarily installs Three's Scene before-render hook during mount, initialising only a missing sky projection inverse from the actual camera. It restores the hook on game onReady or teardown. Existing sky.ts/GameApp/OnlineApp are untouched; there is no steady-state interception. Final online/offline/create/join/leave run: **0 console errors**, recorded in [console-errors.json](console-errors.json). That file identifies the corrected run's start; initial development failures predate it. Existing Clock/Rapier deprecation warnings are separate from errors.

## Validation

- npm run typecheck: PASS.
- npm run test:gameplay: PASS, all 19 checks.
- npm run game:build: PASS.
- Existing game:preview server on port 5191 reused.
- Git scope: only authorised paths. Asset, gameplay, network, server and existing configuration numbers unchanged.

Logs: [typecheck](typecheck.log), [gameplay](gameplay.log), [build](build.log).

## Screenshots

![Before/after, Friends and character selection](overview.jpg)

| View | Before | After |
|---|---|---|
| 1366 × 768 | [JPEG](before-1366.jpg) | [JPEG](after-1366.jpg) |
| 1920 × 1080 | [JPEG](before-1920.jpg) | [JPEG](after-1920.jpg) |

Friends: [1366](friends-1366.jpg), [1920](friends-1920.jpg). Character select: [1366](character-select-1366.jpg), [1920](character-select-1920.jpg).

Before captures use Git HEAD's original four files. build-before.mjs restores all edited source bytes immediately after bundling the baseline. The normal game build was run again afterwards.

## Runtime transfer files

1. src/ui/menu.ts
2. client/game/main.tsx
3. client/game/hud.css — menu selectors only
4. src/config/game.ts — new MENU block only
5. client/game/menuScene.ts — new
6. client/game/gameMount.tsx — new

Every additional evidence/authoring file is listed in [FILES.md](FILES.md); none is required at runtime.

## References and choices

[Krunker's official guide](https://krunker.io/guides/) favours immediate entry and separate customisation. [Venge's official page](https://venge.io/) foregrounds hero selection/customisation. These support a clear Play action and a large hero showcase; this layout is original. Shell Shockers exposed little crawlable UI, so it was not used to substantiate layout decisions.

[Three render-target manual](https://threejs.org/manual/pages/rendertargets.html) and [renderer documentation](https://threejs.org/docs/pages/WebGLRenderer) support offscreen thumbnails using one renderer. [threejs-scene-setup skill](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/web-engines/threejs-scene-setup/SKILL.md) informed resize, loop and disposal handling. Separate live portrait renderers were rejected because they add contexts and repeated frame work; cached images meet this menu's needs.
