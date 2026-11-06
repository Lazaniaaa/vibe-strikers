# Round 6 · лише sniper scope

Поточний sniper звіт — ROUND6.md. Відновлено габарит корпусу прицілу Stage A:
0.342 × 0.3575 × 0.7573 м з реальним контуром. Задній отвір 0.068 × 0.070 м;
передній розширений канал 0.308 × 0.270 м. Обидві lens-* і shared glass незмінні.
SNIPER_ADS_DISTANCE=.10 м експортується окремо; ADS_DISTANCE=.14 лишається
для решти зброї. Перевірений чистий кут sniper ADS1 — 20°.
При HIP проєкція scope 5.616% на 16:9 / 9.764% на 1:1, симетрично right/left.
У preview є sniper-only PNG-кнопка: TP HIP / FPS ADS0 / FPS ADS1.
Інші weapons, arm lengths, HIP hold і їхні правила Round 5 не змінені.

---

# NFT Arsenal · Round 5 Amendment

Поточний звіт: ROUND5.md, числові результати: round5-check-results.json.
Попередні ROUND2/3/4.md і JSON залишені як історія. Emotes / rocket boots не додані.

## Світовий персонаж / F5

poseCharacter не має ads або holdSide. Firearms завжди тримаються HIP справа:
R → mainGrip, L → supportGrip. attachWeapon(character, weapon) під’єднує до
weaponSocket правої руки один раз. Світовий лівий хват прибраний, оскільки він
потребував би іншої пари довжин. Порожній legacy weaponSocketL залишений для
сумісності структури; він не використовується для світової зброї.

```ts
const weapon = createWeapon('rifle');
attachWeapon(avatar, weapon);
poseCharacter(avatar, {
  weapon: 'rifle', speed: 0, moveDir: { x: 0, z: -1 }, aimPitch: 0,
  shooting: false, crouching: false, grounded: true, dead: false,
  fire: 0, reload: null, cycle: null,
}, dt);
poseWeapon(weapon, { fire: 0, reload: null, cycle: null, equip: 1 });
```

Одна фіксована пара L/R на NFT для всіх firearms/поз/aim. Погоджене скорочення:
повний верхній блок попереднього Round-4 right hold ×5/6, найближчий variant
із кроком extra .04 м; похибка округлення довжини <=.02 м. Кулак незмінний.
Константи в characters/armVariants.ts: ARM_SHORTEN_RATIO=5/6,
ARM_MIN_EXTRA=0, ARM_MAX_EXTRA=1.60, ARM_LENGTH_STEP=.04.
Усі 41 варіант побудовані при створенні, у кадрі лише вибираються кешовані
geometry. Static holdReach.ts містить 33 погоджені за формулою пари.
Звичайні arms, 1.8 м body, bodyExtents та 33 default SHA-256 не змінені.
Архівний +.40 варіант і 66 SHA Round 3 залишені окремо.

Плечі нерухомі, scale=(1,1,1), upper/glove з’єднані одним merged mesh.
З урахуванням нового ліміту .10 м solver шукає HIP-ціль у скінченному околі
точного перетину двох сфер. Цілі перевіряються від найближчої; accepted цілі
сканують усі cached weapon/arm vertices, небезпечні відкидаються одразу.
Обертання й осьовий twist рук підводять незмінні кулаки до grip. Довжина руки
не змінюється ні від зброї, ні від aim, ні від кадру. Вершини не переписуються,
scratch objects/arrays module-level, outer transform належить грі.

Голова .6×aimPitch, максимум ±35°, внутрішній aim clamp ±89°, sink <=.08 м.
Зброя помітно нахиляється з aim (.22×) і recoil; ADS світової пози немає.

## Лише локальна перша особа

```ts
const vm = createViewmodel('rifle', characterConfig, { holdSide: 'right' });
poseViewmodel(vm, {
  holdSide: 'left', ads: .5,
  fire: 0, reload: null, cycle: null, equip: 1,
  moveSpeed: 0, strafe: 0, grounded: true, crouching: false,
  aimPitch: 0, time: gameTime,
});
```

holdSide?: right|left, default right. ads?: number 0…1. Власна геометрія рук VM
незалежна від світового скорочення. ADS — чиста функція state: smoothstep,
lerp і quaternion slerp, без внутрішнього clock. При ADS1 sightAxis фактично
в (0,0,-ADS_DISTANCE), forward=-Z, для обох sides, fire/reload/cycle 0/1.
ADS_DISTANCE=.14 м; visual adsFovHint: sniper28, інші firearms55. FOV не змінюємо.
Knife ігнорує ADS, лишається одноручним.

Один shared lens MeshBasicMaterial (.35, transparent, depthWrite=false,
toneMapped=false); задні pane приховані лише у VM. World-лінзи видимі.
Meshes opaque+lens: knife2+0, pistol3+1, rifle3+1, sniper3+2, shotgun2+0.
VM додає два власні merged hand/forearm meshes. disposeWeaponResources звільняє
cache, hands, lenses і всі три materials; character disposer — увесь arm bank.

## Прев’ю й перевірки

Сторона HIP та ADS / «Поза viewmodel: від стегна / приціл» впливають лише на
першу особу. Третя особа чітко підписана «постійний HIP справа».
PNG HIP: Малиновий / bureau-25 капелюх / viber-32 антени для вибраної зброї.
PNG first person: усі чотири firearms, right/left, ads0/1, один атлас.

```sh
npm run dev -- --port 5174
npm run verify
# Ідентичні перевірки, чотири незалежні процеси:
npm run verify -- --parallel-holds
npm run build
```

TP: 33×4×6 poses×5 aim×2 shooting =7920 станів, чотири фази =31680 поз.
Строгі пороги: ОБИДВА кулаки <=.10 м; жодної вершини weapon/arm/glove у
oriented head/torso boxes зі shrink .01 м; стики <=.001 м; meshes<=8.
Тестують тільки HIP. Усі фази позуються, однаковість rig-local трансформів
доводить повторне використання vertex oracle під спільним жорстким rig.

VM: 33×4×2 sides×3 ads×8 progress =6336 станів; таблиця weapon×side×ads.
ADS1: axis error<=.01, centre opaque ray clear, повний sampled fan >=25°
(для sniper >=20°). HIP центр також перевіряється. ADS.5 — діагностика
перехідної пози, не вимога центрування прицілу чи ширини фінального отвору.
Fan: 36 азимутів, radial step .25°, near .05, FOV70; консервативний діаметр.
Кеш weapon fan дозволений лише з AABB-доказом, що руки поза конусом; інакше
перераховується повний VM fan. Під час переходу рамка sniper може перетнути
центр; це явно видно у діагностичній таблиці.

Збережені всі 33 default SHA / 396 старих поз без weapon / 66 legacy SHA /
весь frozen arm bank, 1088 head-extreme checks, finite/deterministic,
material/cache/dispose, weapon progress poses та source audit алокацій.
Це vertex-vs-box контракт, не SAT кожного трикутника; декоративні extras
не є body hitboxes. Повний звіт містить числові результати й найгірші випадки.
# New toy visual kit (Vibe Strikers)

Six new visual IDs, ratio-driven parts, the extended `poseArmedCharacter` adapter, pooled trails/paint/decals and the copy list are documented in [TOYS.md](./TOYS.md) and [TOY_REPORT.md](./TOY_REPORT.md). Gameplay integration remains the game's responsibility. The original five models and their approved poses are retained.

## NFT skins — Candy & Toys, generator v3

```ts
import {
  generateSkinTraits, createWeapon, createViewmodel, poseWeapon,
  renderSkinImage, skinMetadata, disposeWeaponResources,
} from './index';

const skin = generateSkinTraits({weapon: 'rifle', rarity: 'epic', seed: 1234});
const pickup = createWeapon('rifle', {skin}); // near: layered candy/toy parts
const remote = createWeapon('rifle', {skin, lod: 'far'}); // one rigid-skinned draw
const view = createViewmodel('rifle', characterConfig, {holdSide: 'right', skin});
poseWeapon(pickup, {fire: 0, reload: null, cycle: null, equip: 1, time: 1.2, heat: 0, charge: 0});
const metadata = skinMetadata(skin, '42'); // image deliberately omitted
const png = await renderSkinImage(skin, 512); // browser-only PNG data URL
```

All eleven `weaponIds` and six `SKIN_RARITIES` are supported. The pure generator
has no runtime Three/DOM dependency and only uses integer seeded randomness.
Import `skinTraits.ts` directly for server traits/metadata generation. JSON
round-trips are supported; hand-edited/unknown recipe versions are rejected.
Raw seeds are uint32; identical weapon/rarity/seed inputs produce identical JSON.
Palette/pattern/kit libraries are exported as `CANDY_PALETTES`, `CANDY_PATTERNS`
and `DETAIL_KITS`: eight candy colour sets, six box/face patterns and five named
modular kit presets for each weapon (55 presets, five shared part families).
Common already has layered parts; the number of parts rises with rarity.
Epic and above have emissive panels; Mythic gain responds deterministically to
existing `time`, `fire`, `heat` and `charge`, without vertex edits or pose-time
allocations. Other functional weapon animations, sockets and hands are retained.

The library is unchanged in size. `RARITY_STYLES` adds a fixed visual grammar:

| Tier | Silhouette | Exclusive colour sets / finish |
| --- | --- | --- |
| Common | Flush candy sleeve | Strawberry / Peach, flat candy |
| Uncommon | Small cream cap | Raspberry / Mint, cream trim |
| Rare | One T-shaped wafer fin | Lemon Sherbet, orange inlay |
| Epic | Twin glowing wings | Grape Soda, cyan light |
| Legendary | Three-prong crown | Cocoa, reserved gold foil with pale top faces |
| Mythic | Layered double halo | Bubblegum, ivory / purple / cyan prismatic trim |

Palette pools are disjoint across all six tiers. Low tiers cannot roll gold or
prismatic trim. Common/Uncommon have flat surfaces; the six procedural patterns
become more visible from Rare upward. Part families still vary within each tier,
but the tier silhouette never depends on the random kit. Both near and far retain
the tier ornament. Mythic glow pulses from 0.32 to 1 with the existing `time`
input in near, first person and far. Regenerate v2 recipes from weapon/rarity/seed
to get v3; older edited/serialized recipes are deliberately not silently upgraded.

Near world/lobby models add raised wafer ribs, gumball sockets, licorice harnesses,
toy studs or gift-ribbon panels to exposed sides and a raised top ornament. First-person uses the same
kit as fine recessed panels, inside the original paint plates, to retain the
original opaque silhouette. Original grips, muzzle and animation transforms
remain unchanged. No textures or downloaded assets are used.

`lod: 'far'` is an explicit creation-time choice, not an automatic distance test.
The game chooses near/far. Far removes buried colour-plate faces and spends some
of the saved triangles on the same tier silhouette. Per-face candy colours and
emission masks plus original moving groups drive a single rigid-skinned
mesh, with no weapon shadow pass or remote glass meshes. The base weapon's full
triangle ceiling includes dormant heat/charge parts; far stays at or below that
ceiling. Near adds at most one draw, including glow. Draw ceilings count all
animated parts even when currently dormant. Skins without the `skin` option do
not change, including the previous five weapons and the six toy weapons.

Equal appearances and LODs share geometry/materials. Reactive near/far glow uses
shared shaders; each draw uploads its own instance gain. Resources remain in the
existing weapon cache lifetime: call `disposeWeaponResources()` after removing
all live weapons/viewmodels, and `disposeSkinImageRenderer()` when thumbnail
rendering is finished. Creation, image export and authoring checks allocate;
pose updates do not. The image helper lazily creates one reusable renderer and
serializes concurrent exports. It accepts an optional third `{lod: 'far', time: 1}`
argument for review images; near is the default. `renderBaseWeaponImage` in the
image helper is for review baselines. All tiers and the base use a fixed camera
and scale derived from the base bounds. Importing the helper creates no WebGL.

This is a finite visual library, not a minting uniqueness registry. Use
`skinVisualKey(traits)` as a deterministic recipe key and apply collection-level
deduplication in the minting system; seed uniqueness alone is not a promise of
infinite visibly distinct NFTs. Common and Uncommon use ten simple layouts per
weapon (two palette sets × five kits), with 4,913 flat dye-batch tints per layout
(at most ±8 RGB steps per channel). This preserves each tier's hue and flat finish
without reducing its pool to ten identical NFTs. Inactive random pattern words
are excluded from the appearance key; actual dye colours are included. No contract,
minting or gameplay code is included.

Review / checks (run from the own-copy repository root):

```sh
node src/weapons/verifySkins.mjs
npx vite --config src/weapons/skinLab.vite.ts
# http://127.0.0.1:5175/skins.html
npx vite build --config src/weapons/skinLab.vite.ts
```

The lab has near/far grids with a base column, seeds, metadata, selected 512px PNG
export, a 112px contact sheet with an explicit base row and base + all six tiers
side by side, plus a 64px all-weapon strip and a Mythic pulse preview. Its GPU
check compares silhouettes at 64px in both LODs, compares opaque pixel masks
against the base viewmodel, alternates reactive instances to detect shared-state
leaks and reads real Three draw/triangle counters for eight Mythic far weapons
in Toy Town. Reports and copy instructions are in [SKIN_REPORT.md](./SKIN_REPORT.md).
