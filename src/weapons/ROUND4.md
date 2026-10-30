# Stage A · Round 4 · ПРОЙДЕНО

Додані три сторони хвату й простий ADS. Center спочатку виправлено з незавершеного
Round 3 за прямою вказівкою власника; вимоги .03 м / .01 м shrink не послаблено.
Фіксовані довжини рук з кроком .04 м застосовані за останнім погодженням.
Emotes і rocket boots не розпочато. Після цього звіту робота зупинена для review.

## Результати

npm run build: PASS. npm run verify -- --parallel-holds: PASS (exit 0).
Це та сама повна матриця: 12 рядків weapon×side виконані шістьма незалежними
процесами й зведені з перевіркою загальної кількості. Звичайний npm run verify
виконує їх послідовно з тими самими oracle й порогами.
Матриця: 33 NFT × 4 firearms × 3 sides × 6 poses × 5 aim × 2 shooting × 3 ADS
= 71,280 станів, чотири фази = **285,120 поз**.
Позами є idle/run/strafe/back/crouch/jump; aim −89/−45/0/+45/+89°;
ADS 0/.5/1; shooting on/off. Невдалих записів: **0**.

Загальний max fist error **0.028991088 м**, min signed clearance
**0.001095857 м**. Max sightAxis error від (0,0,−.14): **1.440e-16 м**.
6,336 centre rays: **0 opaque hits**.

| Зброя | Сторона | max R, м | max L, м | min clearance, м | ADS кут | FAIL |
|---|---|---:|---:|---:|---:|---:|
| pistol | По центру | <0.000001 | <0.000001 | 0.002742 | 31.0° | 0 |
| rifle | По центру | <0.000001 | <0.000001 | 0.003028 | 28.0° | 0 |
| sniper | По центру | <0.000001 | <0.000001 | 0.003061 | 25.5° | 0 |
| shotgun | По центру | <0.000001 | <0.000001 | 0.003061 | 26.5° | 0 |
| pistol | Справа | <0.000001 | <0.000001 | 0.001649 | 31.0° | 0 |
| rifle | Справа | <0.000001 | <0.000001 | 0.001111 | 28.0° | 0 |
| sniper | Справа | <0.000001 | <0.000001 | 0.001275 | 25.5° | 0 |
| shotgun | Справа | <0.000001 | <0.000001 | 0.001274 | 26.5° | 0 |
| pistol | Зліва | <0.000001 | 0.028991 | 0.001096 | 31.0° | 0 |
| rifle | Зліва | <0.000001 | <0.000001 | 0.001902 | 28.0° | 0 |
| sniper | Зліва | <0.000001 | <0.000001 | 0.001902 | 25.5° | 0 |
| shotgun | Зліва | <0.000001 | <0.000001 | 0.001902 | 26.5° | 0 |

Clearance виміряний від УСІХ реальних merged vertices зброї та ОБОХ arm/glove meshes
до posed oriented head/torso boxes зі shrink .01 м. Від’ємне число — intrusion.
Це vertex contract, не SAT усіх граней і не перевірка капелюхів/антен.
Усі чотири фази позуються: тотожні rig-local трансформи підтверджують
еквівалентність clearance/grip під спільним жорстким rig, тому world-vertex
результат phase0 повторно використовується тільки після цієї перевірки.

ADS fan: FOV70, near .05, 36 азимутів через 10°, радіальний крок .25°;
наведений діаметр на .5° нижчий від першого sampled hit. Для всіх NFT/сторін
перевірені кулаки: camera-space AABB доводить відсутність кистей у конусі,
інакше повторюється повний fan. Лінзи не є opaque. Це дискретний raycast fan.
Для всіх fire/reload/cycle 0/1 перевіряються центр, фактичний sightAxis і fan.
Поріг 25° стосується ADS1.

Успішні незалежні перевірки: 33 default SHA-256; 396 погоджених поз без weapon;
66 архівних +.40 SHA; весь новий банк 41 довжин L/R; gloves не масштабовані;
нерухомі плечі, scale=(1,1,1), стики <=.001 м, <=8 meshes персонажа;
1 575 weapon і 11 385 viewmodel progress-поз; material/cache/dispose;
NaN/determinism; зовнішня група незмінна; 1 088 extreme-head checks,
голова .6×aim, максимум 35°, sink <=.08 м. Source audit pose на алокації
пройдено; frame-time/heap profile окремо не вимірювалися.

SHA файлу незмінних default baselines: `314325e95217473de8f75551b6ad7d4123c949b3bd7c32679d2ec1a387a811e0`.

## Константи, довжини, зміни поз

ARM_MIN_EXTRA=0.00, ARM_MAX_EXTRA=1.60, ARM_LENGTH_STEP=0.04 м — одне місце
characters/armVariants.ts. ARM_LENGTH_RESERVE=.08 м використовується лише при
construction-time виборі, до quantize. Фіксовані override-пари — holdReach.ts.
Одна пара L/R вибирається на NFT/side для ВСІХ firearms, ADS і aim.
Під час повного проходу додатково відкалібровані bureau-roll-40-10/right
(L+.76/R+.36) і viber-142/left (L+.72/R+1.16), щоб прибрати манжети з body boxes.
Збільшений тільки суцільний верхній блок; кулак незмінний; meshes не додані.
Усі 41 варіант створені наперед і кешуються; під час pose лише обирається
наявна geometry. Default arm не змінено. Legacy +.40 збережений для старих SHA.

Фактично вибрані extra: min 0.32,
max 1.36 м. Extra — додаток
до нормалізованого верхнього блока, а не повна довжина руки.

| Персонаж | Center L/R extra, м | Right L/R extra, м | Left L/R extra, м |
|---|---:|---:|---:|
| reference-01 | 0.80 / 0.64 | 0.96 / 0.52 | 0.52 / 1.08 |
| vibe-vibers-bureau-8 | 0.80 / 0.60 | 0.92 / 0.52 | 0.56 / 1.08 |
| vibe-vibers-viber-extra-12 | 0.64 / 0.44 | 0.76 / 0.32 | 0.32 / 0.92 |
| vibe-vibers-viber-142 | 0.92 / 0.76 | 1.08 / 0.68 | 0.72 / 1.16 |
| vibe-vibers-viber-extra-11 | 1.04 / 0.84 | 1.20 / 0.72 | 0.72 / 1.32 |
| vibe-vibers-bureau-25 | 0.92 / 0.76 | 1.08 / 0.64 | 0.64 / 1.20 |
| vibe-vibers-bureau-roll-22-11 | 0.92 / 0.76 | 1.08 / 0.64 | 0.64 / 1.20 |
| vibe-vibers-bureau-roll-48-7 | 0.92 / 0.76 | 1.08 / 0.64 | 0.64 / 1.20 |
| vibe-vibers-bureau-roll-7-11 | 0.92 / 0.76 | 1.08 / 0.64 | 0.64 / 1.20 |
| vibe-vibers-viber-32 | 0.92 / 0.76 | 1.08 / 0.64 | 0.64 / 1.20 |
| vibe-vibers-viber-10 | 0.92 / 0.72 | 1.08 / 0.64 | 0.64 / 1.20 |
| vibe-vibers-viber-103 | 0.96 / 0.76 | 1.12 / 0.64 | 0.64 / 1.24 |
| vibe-vibers-viber-31 | 0.96 / 0.76 | 1.08 / 0.64 | 0.64 / 1.24 |
| vibe-vibers-viber-42 | 0.92 / 0.76 | 1.08 / 0.64 | 0.64 / 1.24 |
| vibe-vibers-viber-71 | 0.80 / 0.64 | 0.92 / 0.52 | 0.52 / 1.08 |
| vibe-vibers-bureau-23 | 0.60 / 0.44 | 0.72 / 0.32 | 0.32 / 0.88 |
| vibe-vibers-bureau-4 | 0.88 / 0.72 | 1.04 / 0.60 | 0.60 / 1.20 |
| vibe-vibers-bureau-roll-40-10 | 0.60 / 0.44 | 0.76 / 0.36 | 0.40 / 0.88 |
| vibe-vibers-viber-141 | 0.92 / 0.76 | 1.08 / 0.60 | 0.60 / 1.24 |
| vibe-vibers-viber-48 | 0.76 / 0.60 | 0.92 / 0.48 | 0.48 / 1.04 |
| vibe-vibers-bureau-24 | 0.92 / 0.72 | 1.04 / 0.60 | 0.60 / 1.20 |
| vibe-vibers-bureau-roll-22-12 | 0.72 / 0.52 | 0.84 / 0.44 | 0.44 / 1.00 |
| vibe-vibers-viber-6 | 0.76 / 0.56 | 0.88 / 0.44 | 0.44 / 1.04 |
| vibe-vibers-viber-63 | 1.00 / 0.84 | 1.16 / 0.68 | 0.68 / 1.32 |
| vibe-vibers-viber-84 | 1.04 / 0.88 | 1.20 / 0.76 | 0.76 / 1.32 |
| vibe-vibers-viber-extra-20 | 0.96 / 0.76 | 1.12 / 0.64 | 0.64 / 1.24 |
| vibe-vibers-bureau-31 | 0.88 / 0.68 | 1.00 / 0.52 | 0.56 / 1.16 |
| vibe-vibers-bureau-roll-9-5 | 0.88 / 0.72 | 1.04 / 0.60 | 0.60 / 1.20 |
| vibe-vibers-viber-123 | 0.88 / 0.72 | 1.04 / 0.60 | 0.60 / 1.20 |
| vibe-vibers-viber-extra-19 | 0.92 / 0.76 | 1.08 / 0.64 | 0.64 / 1.20 |
| vibe-vibers-viber-extra-15 | 0.92 / 0.76 | 1.08 / 0.64 | 0.64 / 1.24 |
| vibe-vibers-viber-extra-24 | 0.92 / 0.76 | 1.08 / 0.64 | 0.64 / 1.24 |
| vibe-vibers-viber-extra-9 | 1.08 / 0.88 | 1.24 / 0.76 | 0.76 / 1.36 |

Повні upper length / shoulder-to-fist reach кожної руки — arm-lengths.json та
arm-lengths.csv поряд із цим звітом. Довжина не змінюється при ADS чи aim,
не інтерполюється й не обирається за weapon. Плечові накладки верхніх 15%
лишаються біля плеча, cuffs слідують своїй ділянці подовженого блока.

Дві сфери фіксованих радіусів задають досяжну пару grip targets; обертання
рук і осьовий twist забезпечують clearance. У складних cuffs використано
до .029 м rotation-only endpoint adjustment всередині незмінного .03 порогу.
Немає перенесення плеча, масштабування, нових meshes чи переписування vertices.
Немає прихованого clock: лише state і public run phase.

Weapon pitch=.22×aimPitch (±19.58° при ±89°) плюс recoil. Head правило лишилося.
TP ADS піднімає rear sight до очей, враховуючи posed голову. Приціли підняті
над корпусами для відкритого 25° конуса; sniper front hole .40×.40 м, rear
приблизно .18×.18 м. Це найпомітніша зміна toy-силуету: sniper optic став вищим
і розширеним спереду. Стволи та приклади не вкорочені.

ADS_DISTANCE=.14 м; adsFovHint sniper=28, інші firearms=55. FOV камери не змінюється.
VM ADS використовує smoothstep/lerp/slerp; at1 actual sightAxis=(0,0,−.14),
forward=−Z для всіх sides і progress. Hip VM: centre знизу по центру,
right/left знизу ±.60 м, yaw ±.34 rad. Knife ігнорує ADS.

Діапазони фактичного main-grip X у rig-local (головний socket weapon axis):

| Зброя / сторона | min X | max X |
|---|---:|---:|
| pistol / center | 0.076922 | 0.138754 |
| rifle / center | 0.056689 | 0.120000 |
| sniper / center | 0.056891 | 0.120000 |
| shotgun / center | 0.056880 | 0.120000 |
| pistol / right | 0.306738 | 0.409142 |
| rifle / right | 0.290518 | 0.380000 |
| sniper / right | 0.290518 | 0.380000 |
| shotgun / right | 0.290518 | 0.380000 |
| pistol / left | -0.420050 | -0.280000 |
| rifle / left | -0.407148 | -0.280000 |
| sniper / left | -0.407148 | -0.280000 |
| shotgun / left | -0.407148 | -0.280000 |

Це приблизні зони з brief: у пістолета є вихід до x=.1388/.4091/−.4200,
у решти ліворуч до −.4071 м. Числа наведені явно; геометрію не обрізали
заради X. Строгі пороги grip/clearance/ADS залишилися незмінними й пройдені.

## Дзеркалення й сокети

Усі weapon models лишені **без scale.x=−1** (mirrorSafe=false): однобічні
eject/mechanism/декоративні деталі збережені. Лівий хват міняє ролі рук:
L-main/R-support; центр і правий — R-main/L-support. weaponSocketL дзеркалить
початковий socket. attachWeapon перепід’єднує mount один раз на attach/зміну
сторони; жодного reparent у pose. Сокети слідують реальному подовженому кулаку.
Для ножа збережена стара одноручна гілка; left переносить її на лівий бік.

## Меші та лінзи

| Зброя | Opaque | Lens |
|---|---:|---:|
| knife | 2 | 0 |
| pistol | 3 | 1 |
| rifle | 3 | 1 |
| sniper | 3 | 2 |
| shotgun | 2 | 0 |

Лінзи: один shared MeshBasicMaterial, transparent .35, depthWrite=false,
toneMapped=false. Rear panes приховані у VM, світові панелі видимі.
Lens meshes у geometry cache/disposer; opaque fan виключає lens-*.

## П’ять найтісніших персонажів

Впорядковано за найменшим signed clearance, не за розміром голови:

| Персонаж | min clearance, м | max fist error, м | FAIL |
|---|---:|---:|---:|
| vibe-vibers-viber-142 | 0.001096 | 0.028991 | 0 |
| vibe-vibers-bureau-roll-40-10 | 0.002024 | <0.000001 | 0 |
| vibe-vibers-viber-extra-9 | 0.003058 | <0.000001 | 0 |
| reference-01 | 0.003122 | <0.000001 | 0 |
| vibe-vibers-bureau-23 | 0.003128 | <0.000001 | 0 |

Візуально найвимогливіші: bureau-8 (дуже короткий body й великі кулаки),
bureau-31 (широкі плечові/cuff деталі), bureau-roll-40-10 (вузький torso),
viber-71 (короткі руки й велика голова), viber-141 (великий капелюх і glow).
Широкі fists упритул до зброї можуть виглядати масивно попри прохід контракту.
Капелюхи й антени у head-box clearance не включені: навмисного декоративного
collision avoidance немає. Знімки дозволяють оцінити зовнішній вигляд.

## Зображення

24 PNG-смужки: Малиновий / bureau-25 (капелюх) / viber-32 (антени),
кожна firearm, ADS0 й ADS1. Кожна смужка містить center/right/left,
TP зверху й FOV70 FPS знизу. Зняті через WebGL export прев’ю, aim=0,
idle, progress0/equip1, auto arm mode. Усі крайні aim перевірені чисельно.
Для зручного перегляду відкрийте REVIEW.html поруч.
Додатково aim-checks/ містить три атласи всіх firearms на −89/0/+89°
для тих самих NFT (center, ADS0), і окремий кадр sniper-glass.png.

## Змінені файли від source ZIP Round 3

- src/characters/armVariants.ts
- src/characters/characters.ts
- src/characters/createCharacter.ts
- src/characters/holdReach.ts
- src/characters/index.ts
- src/characters/poseCharacter.ts
- src/characters/types.ts
- src/characters/verify.mjs
- src/weapons/README.md
- src/weapons/ROUND4.md
- src/weapons/ads.ts
- src/weapons/arm-length-baselines.json
- src/weapons/createWeapon.ts
- src/weapons/hold.ts
- src/weapons/index.ts
- src/weapons/measureView.ts
- src/weapons/measurements.json
- src/weapons/poseWeapon.ts
- src/weapons/preview.ts
- src/weapons/round4-arm-lengths.json
- src/weapons/round4-check-results.json
- src/weapons/round4-summary.json
- src/weapons/supportPose.ts
- src/weapons/types.ts
- src/weapons/verify.mjs
- src/weapons/verifyHolds.mjs
- src/weapons/verifyParallel.mjs
- src/weapons/viewmodel.ts
- src/weapons/weapons.ts

Кореневі package.json/vite.config.js порівняні побайтово з Round 3 — незмінні.
Оригінальний default baseline також порівняний побайтово. Зміни реалізації
обмежені src/characters та src/weapons; work — scratch, outputs — результати.
VERIFY.txt, BUILD.txt, check-results.json, arm-lengths.json/csv і failures.json
поряд із цим звітом. Порожній failures.json означає нуль невдалих записів.
