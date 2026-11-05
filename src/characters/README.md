# Voxel characters — повна колекція

Готові 33 моделі: незмінна геометрія `reference-01` + усі 32 оригінали
(нові id/name містять повний префікс `vibe-vibers-`). Усі шість партій
пройшли verify; їхні окремі таблиці габаритів додано в огляд.
Огляд, палітри, припущення й таблиці габаритів — у `SURVEY.md`.

## Запуск

Node.js 22.12+ / 24+; єдині залежності проєкту — Three.js і Vite.

```sh
npm install
npm run dev
# http://127.0.0.1:5173/?grid=1
npm run verify
npm run build
```

Селектор використовує `characters.length`. Сітка показує всіх готових;
натисніть картку для OrbitControls і окремих ракурсів. Пози застосовуються до
всіх моделей у сітці. Кнопка PNG готує посилання на експорт 3D-рендерів.
Висота показана від стоп до head-box; капелюхи й антени можуть бути вищими.

## Ігрове API

```ts
import { characters, createCharacter, poseCharacter } from './characters';
import type { PoseState, CharacterRuntime } from './characters';

const avatar = createCharacter(characters[0]);
scene.add(avatar);
const state: PoseState = {
  speed: 0, moveDir: { x: 0, z: -1 }, aimPitch: 0,
  shooting: false, crouching: false, grounded: true, dead: false,
};
// Кожен кадр: гра володіє позицією та yaw зовнішньої групи.
avatar.position.copy(playerPosition);
avatar.rotation.y = playerYaw;
poseCharacter(avatar, state, dt);

avatar.getObjectByName('weaponSocket')!.add(weapon); // ствол зброї дивиться в -Z
const runtime = avatar.userData as CharacterRuntime;
console.log(runtime.bodyExtents.total.width, runtime.bodyExtents.total.depth);
console.log(runtime.bodyExtents.parts.head, runtime.bodyExtents.headBox);
```

`dt` у секундах; +X — право персонажа, +Z — назад; aimPitch > 0 — погляд угору.
Вхідний aimPitch обмежується ±89°. Голова: `clamp(0.6 * aimPitch, ±35°)`;
решту руху передають руки й невеликий нахил тулуба (до 6,48°).
Аналітична корекція висоти шийного pivot-а обмежує вертикальне перекриття
базових head/torso AABB до 0,08 м; невеликий зсув назад супроводжує нахил.
Це не колізія extras і не ігровий hitbox. Розрахунок без алокацій.
Початок координат між стопами на підлозі. Шість частин безпосередньо під rig:
`head`, `torso`, `armL`, `armR`, `legL`, `legR`; порожній socket під armR.
`poseCharacter` не змінює outer position/rotation/scale. `restPose`, socket,
нормалізовані `dimensions` і незмінні `bodyExtents` обчислюються один раз.
Функція поз не читає глобальних розмірів шаблону.

Єдиний часовий стан — `userData.phase`. Однакові state + phase + dt дають
однакову позу. Віддача — короткі автоматичні імпульси з тієї самої фази.
Загибель — миттєва стабільна лежача поза; траєкторія стрибка належить грі.
Усі повороти/зсуви/масштаби частин скидаються до даних персонажа кожного кадру.
Геометрія, кольори, матеріали та буфери glow у позах не переписуються.

## Конфігурація й нормалізація

- `proportions`: W/H/D голови, тулуба, руки, кисті, ноги й стопи. Defaults точно
  відповідають 01; `sides` дає рідкісні L/R-перевизначення без bodyVariant.
- `layout.pivots`, `layout.centers`, `layout.weaponSocket`: числові локальні
  перевизначення. Якщо відсутні, розкладка обчислюється з розмірів.
- `surfaces`: колір, необов’язковий topColor і sampled sideColor основних
  частин; невидима спина без нових декоративних деталей.
- `extras`: коробки `{part,size,position,color,topColor?,sideColor?,glow?}`.
  Це всі очі, накладки, вуха, головні убори й аксесуари. Вони приєднані до
  частини, чий рух успадковують. Позиції задані від pivot-а, до нормалізації.
- `colors`: виміряна палітра для перегляду; `flags` — явні здогадки з SURVEY.

Множник = 1,8 / (верх основного head-box − низ стоп). Він застосовується до
всіх розмірів, pivot-ів, centers, extras та socket. Нижня точка стоп зсувається
в Y=0; зовнішня група не масштабується. Для 01 множник рівно 1: його 2 см
перекриття leg/foot, порядок коробок, buffers та всі шість SHA-256 збережені.

`bodyExtents` — rest-pose rig-space AABB **без усіх extras/glow**. Total і
кожна з шести частин мають min/max та width/height/depth у метрах. Тонкі
пластинки обводки базових коробок враховані. `headBox` — номінальні W/H/D
головного куба. Ці дані не змінюють форму й не створюють ігровий hitbox.
У bureau-8 кисті нижче стоп, тому total body height трохи більше 1,8 м;
норматив feet-to-head збережений. Це явно позначено в огляді.

## Рендер і спільні ресурси

Усі форми — BoxGeometry, один merged mesh на рухому частину. Один спільний
MeshLambertMaterial із vertex colors. Glow: максимум один додатковий merged
mesh на частину, що має glow, під її власним pivot-ом; спільний для всіх
MeshBasicMaterial. Для цього набору світяться лише head/torso, максимум 8
мешів на модель. Без текстур, прозорих матеріалів чи зовнішніх assets.

Рівне світло «Колір» відтворює зняті sRGB-значення. Side/top colors походять
із вже освітлених PNG; у грі результат залежить від світла й tone mapping.
Basic-очі яскраві, але ореолу/bloom немає. `extra-15` побудований
solid teal за погодженим правилом, з прапорцем щодо прозорості.

Ключ кешу моделі — стабільна серіалізація **всього config без id/name**.
Ідентичні локальні геометрії також повторно використовуються. При вилученні
одного гравця просто приберіть його групу; не dispose спільних geometry/material.
`disposeCharacterResources()` викликається один раз після вилучення всіх.

## Lobby idle and emotes (separate opt-in API)

```ts
import { createCharacter, prepareLobbyAnimation, playEmote, updateAnimation } from './src/characters';
const player = createCharacter(config);
prepareLobbyAnimation(player); // once, before the frame loop
playEmote(player, 'wave');     // optional; wave | cheer | dance | shrug | hop
// Your existing renderer loop:
updateAnimation(player, dt);   // idle resumes automatically after the clip
```

This API is **unarmed and opt-in**. The game still calls `poseCharacter` exactly as before. No match pose, firearm hold, movement state, geometry, material or character config was changed. Stop calling `updateAnimation` before handing an instance back to `poseCharacter`; its ordinary reset restores the match pose without reading any lobby state. Emotes are not connected to client intents, networking or gameplay yet.

`LOBBY_EMOTES` / `LobbyEmoteId` are also exported from the dependency-free `lobbyEmotes.ts` entry, so a menu can build buttons without eagerly loading Three.js. `LOBBY_ANIMATION` contains all animation times, angles and distances. Idle has a 4.2 s breathing cycle, gentle arm sway, planted feet with an upper-body weight shift and intermittent head glances. The phase is seeded deterministically from the character id. Each instance owns its clock, clip state, transition snapshot and scratch bounds in `userData.lobbyAnimation`; there are no hidden timers or shared mutable animation clocks.

The five clips last 1.4–3.2 s. A 0.2 s smooth envelope returns to the continuing idle. Starting another clip captures the current transforms into a preallocated numeric buffer and crossfades without a reset snap. The outer group's position/yaw/scale are never touched. Setup allocates once; `updateAnimation` uses scalar math and existing transforms/buffers only. It never calls the firearm solver or edits vertices.

All ordinary arms remain close to vertical. bureau-8, viber-141 and viber-6 need wider relaxed openings (about 45°, 39° and 24°) because their original fused hands otherwise reach below the feet. Their geometry is unchanged. A fixed 15-axis OBB/AABB separation calculation keeps the rotated upper-arm and fist boxes outside conservative head/torso bounds, with a 6 mm safety margin and no orientation search. Small shoulder translations and neck lift are lobby pose adjustments only. Hands remain joined to the same upper-arm mesh; there is no new hand mesh or stretched fist.

The lobby UI uses **E, then 1–5**, keeping the existing unmodified 1/2/3 tab shortcuts when E is not armed. Buttons work without keyboard shortcuts. Changing characters plays a random introductory clip; portraits use relaxed idle instead of the match's unarmed ready pose.

`node src/characters/verify-lobby.mjs` checks all 33 characters through idle and every clip, arm/body separation, feet, interruption/determinism, timing below 1 ms, unchanged geometry and the archived match transforms before and after using the lobby API. `npm run verify` runs it after the existing character/weapon contracts. The immutable fixture is `baselines/lobby-match-poses.json`; do not regenerate it to accept a pose change. In the lobby's `?debug=1` view, “Capture animation sheets” exports actual WebGL proof for all 33 idle poses and the five clips on three proportions, outside the animation loop.

## Existing character and weapon contracts

`verify.mjs` перевіряє кожен готовий конфіг, усі контракти API й окремий probe
з нестандартними proportions/pivots: нормалізацію, extents без extras,
≤8 мешів, glow-parenting і спільні матеріали, незмінність buffers у позах,
фази/детермінізм, напрямки, присід, смерть, socket та outer ownership.
Окремо перевіряються точні SHA-256 шести merged-геометрій 01.
Фінальний результат: 3264 комбінації поз та 1088 незалежних перевірок
head/torso при ±89° для всіх моделей і proportion probe; максимум 0,080000 м.
Перевірки також покривають точний множник 0,6 та внутрішнє обмеження вхідного кута.
