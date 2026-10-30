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
