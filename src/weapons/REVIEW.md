# Історія Stage A review 1 — хвати й відкритий приціл

Актуальний стан дворучних хватів і лінз описаний у `ROUND2.md`.

Виправлено три зауваження. **Stage B не розпочато; очікується ваше погодження.**

Прев’ю: [студія зброї](http://127.0.0.1:5174/?weapons=1).
«Хвати ±89°» готує 15 знімків Малинового та окремий погляд крізь приціл.

## Результати acceptance-перевірки

Запитана матриця: 33 персонажі × 5 weapons × 6 poses (idle/run/strafe/back/
crouch/jump) × aim {−89, −45, 0, +45, +89} × shooting on/off = **9900**.
Кожна комбінація перевірена на фазах 0, π/2, π, 3π/2: **39600 випадків**.

| Weapon | Випадків | Мін. вершина → box, м | Мін. розділювальний зазор, м | Влучань у центр FPS / перевірок |
|---|---:|---:|---:|---:|
| knife | 7920 | 0,094879 | 0,056821 | 0 / 264 |
| pistol | 7920 | 0,089738 | 0,079738 | 0 / 264 |
| rifle | 7920 | 0,095195 | 0,066195 | 0 / 264 |
| sniper | 7920 | 0,083418 | 0,073418 | 0 / 264 |
| shotgun | 7920 | 0,097278 | 0,063363 | 0 / 264 |

**Помилкових комбінацій: 0. Повний список failures: `[]`.**

`npm run verify` — PASS; `npm run build` — PASS. [Повні числа та failures](C:/Users/User/Documents/Codex/2026-10-26/build-the-voxel-style-characters-for/outputs/weapons-stage-a-review/hold-check-results.json),
[журнал перевірок](C:/Users/User/Documents/Codex/2026-10-26/build-the-voxel-style-characters-for/outputs/weapons-stage-a-review/VERIFY.txt).

Перший зазор — найменша евклідова відстань серед **усіх вершин усіх meshes
зброї**, перетворених у world space, до реальних повернутих head/torso boxes
з відступом 0,01 м усередину кожної грані. Це саме запитаний vertex test,
без підміни боксів загальною світовою AABB. Перевірка працює і з не-нульовою
позицією/yaw зовнішньої групи.

Другий зазор — додаткова розділювальна площина праворуч від повних,
**не зменшених** body boxes. Вона доводить, що крізь тіло не проходять і
грані/ребра між вершинами. Найменший такий зазор **0,056821 м**.
Для повного box правого кулака цей запас не менший за **0,026000 м**.

Head rule також перевірений у всіх нових випадках: 0,6× aimPitch, максимум
±35°, перекриття з torso ≤0,08 м. Outer transform не змінюється; нові пози
детерміновані, finite при NaN/Infinity, без алокацій чи переписування вершин у кадрі.

Центр FPS: **1320** raycast-перевірок для всіх 33 × 5 із FOV 70°, equip=1,
усіма вісьмома комбінаціями fire/reload/cycle на 0/1, включно з усіма трьома
на 1 одночасно. Промінь від камери через NDC (0,0) не перетинає жоден видимий
mesh viewmodel. Near-plane перевірки попереднього Stage A також проходять.

Приціл sniper: **162** промені з обох кінців через квадрат **0,12 × 0,12 м**,
без перетинів. Реальний мінімальний отвір приблизно **0,183 × 0,178 м** з
урахуванням контурних пластинок. Обидва кільця — по 4 коробки, між ними
дах і бокові стінки. Суцільні центральні блоки та передню пластину вилучено.

## Зміни поз та API

- У `weapons.ts`: кожному виду додані `hold: {position,rotation}` та
  `stockBack`. Задні частини не вкорочувались: вони проходять праворуч від тіла.
- `attachWeapon(avatar, weapon)` створює `weaponHold` під старим weaponSocket;
  це placement Group, яку не скидає poseWeapon.
- Єдине нове поле PoseState: необов’язкове `weapon`. Воно вмикає Stage A ready:
  47° вперед у спокої, межі 40…55° при прицілюванні, слабкий рух від бігу.
  Права рука відхилена назовні; X її pivot-а мінімально коригується за
  фактичними габаритами голови/тулуба, кулака та зброї. Кулак, socket і зброя
  залишаються зв’язаними. Для широких голів відведення більше.
- Ліва рука опущена у вільну позу. Дворучний IK, weapon-specific reload
  персонажа, emotes і boots не реалізовувались.
- Viewmodel зміщений нижче/правіше: (0,60; −0,43; −1,05) у rest-позі.
- Новий `dimensions.handR` містить support bounds існуючого кулака; його
  геометрія, старі pivots, socket та старі імена userData не змінені.

Без `weapon`, або з null, старі виклики зберігають результат: **396/396**
старих pose-checksum збігаються; SHA-256 кожного merged mesh усіх **33/33**
персонажів незмінний. Сам `character-baselines.json` побайтово збігається
з архівом первинного Stage A (SHA-256
`314325E95217473DE8F75551B6AD7D4123C949B3BD7C32679D2EC1A387A811E0`).
Архівний hash вихідного коду поз збережений як provenance; нова дозволена
гілка змінює source, тому незмінність поведінки доводять старі pose-checksum.

## Перевірки та файли

```sh
npm run verify
node src/weapons/verify.mjs --report
npm run build
```

Усі перевірки входять до `npm run verify`; будь-яка невдала комбінація дає
nonzero exit і повний перелік у `src/weapons/hold-check-results.json`.
Цей файл пишеться до assertion, тож помилки не губляться при падінні тесту.

Змінені: `src/characters/types.ts`, `createCharacter.ts`, `poseCharacter.ts`;
`src/weapons/types.ts`, `weapons.ts`, `index.ts`, `viewmodel.ts`, `preview.ts`,
`verify.mjs`, `README.md`. Додані `hold.ts`, `verifyHolds.mjs`,
`hold-check-results.json`, `REVIEW.md`. Package/Vite config не змінювались.

## Малиновий: −89°, 0°, +89°

Нижче 15 фактичних WebGL-рендерів. На всіх п’яти видах рука відповідно
40°, 47°, 55°; голова −35°, 0°, +35°. Ніж і пістолет перед правою кистю;
довгі види — праворуч від грудей, приклад збоку. Положення прицілу sniper
вище receiver, але збоку голови, з наскрізним отвором.

![Усі 15 хватів](C:/Users/User/Documents/Codex/2026-10-26/build-the-voxel-style-characters-for/outputs/weapons-stage-a-review/hold-review-grid.png)

![Відкритий приціл](C:/Users/User/Documents/Codex/2026-10-26/build-the-voxel-style-characters-for/outputs/weapons-stage-a-review/sniper-scope-open.png)

FPS та світовий хват: [rest](C:/Users/User/Documents/Codex/2026-10-26/build-the-voxel-style-characters-for/outputs/weapons-stage-a-review/sniper-fps-rest.png),
[fire/reload/cycle = 1](C:/Users/User/Documents/Codex/2026-10-26/build-the-voxel-style-characters-for/outputs/weapons-stage-a-review/sniper-fps-all1.png).

Окремі PNG кожного виду й кута збережені поруч зі звітом, імена:
`{knife,pistol,rifle,sniper,shotgun}-{minus89,zero,plus89}.png`.

## Межі цього виправлення

Тимчасовий ready навмисно обмежує поворот руки і ствола при крайніх кутах
прицілювання: це усуває проникнення; точний прицільний дворучний хват — Stage B.
Acceptance стосується head/torso box, а не капелюхів, очей-накладок, антен,
світу чи інших гравців. Не заявляється перевірка нерозглянутих reload/equip
траєкторій світового хвату. Готовий до наступного художнього погодження.
