# Stage A, round 2 — дворучні хвати та лінзи

Всі чотири firearms тримаються двома кистями; knife — однією. Додано скло
до sniper, rifle і нового малого dot sight pistol. **Emotes та rocket boots
не розпочинались.** Після цього звіту — зупинка для погодження.

Власник обрав мінімально зміщувати плечовий pivot зі збереженням геометрії
та кількості meshes. Цей компроміс реалізований, без окремого нового кулака.

[Прев’ю](http://127.0.0.1:5174/?weapons=1). Кнопка «Хвати ±89°» експортує
15 ракурсів вибраного NFT. «Вмістити» підбирає камеру під великі голови й убори.

## Перевірки

**PASS:** `npm run verify` і `npm run build`.

- 33 × 5 × 6 poses × 5 aim × shooting on/off = 9900 комбінацій.
- Чотири фази руху кожної: **39600 випадків**, **0 невдалих**.
- Для 4 firearms: **31680** перевірок фактичного центру лівого кулака
  проти world-позиції реального supportGrip. Максимум **1,36 × 10⁻¹⁵ м**,
  дозволено ≤0,05 м. У viewmodel центри також перевірені на контакт.
- Всі vertices всіх weapon meshes, включно з лінзами, переведені в world space
  і перевірені проти повернутих реальних head/torso boxes, зменшених на 0,01 м.
  Додаткові розділювальні площини доводять відсутність проникнення цілих
  трикутників зброї та повних ОБОХ box кулаків у не зменшені body boxes.
- Head rule у всіх випадках: 0,6× aimPitch, ±35°, sink ≤0,08 м.
  Outer transform не змінюється. Finite/детермінізм перевірені, включно
  з NaN/Infinity, fire/reload/cycle і попередніми позами.
- **1320** променів через центр FPS: **0 непрозорих влучань**.
  Перевірені всі 8 поєднань fire/reload/cycle = 0/1 для 33 × 5, FOV 70°.
  Виключаються тільки перевірені прозорі `lens-*`, а не руки чи glow.
- 162 scope-промені без непрозорих перешкод; окремий raycast знаходить
  ОБИДВІ світові лінзи на оптичній осі.
- **33/33 SHA-256 геометрій**, включно з усіма part/glow meshes, незмінні.
  **396/396** старих поз незмінні; також перевірені null weapon і нові action
  fields без weapon. `character-baselines.json` не переписувався.

### Результати й кількість meshes

Відстань — мінімум vertex → зменшений body box у метрах. Зазор кулаків —
гарантована розділювальна відстань до повного body box. Counts світової моделі;
непрозорі включають glow. У sniper FPS задня лінза прихована, тому видима одна.

| Weapon | Max left error, м | Min weapon clearance, м | Min обох кулаків, м | Непрозорі + лінзи |
|---|---:|---:|---:|---:|
| knife | — одноручний | 0,094879 | 0,026000 | 2 + 0 |
| pistol | <0,000001 | 0,134253 | 0,031154 | 3 + 1 |
| rifle | <0,000001 | 0,103323 | 0,031071 | 3 + 1 |
| sniper | <0,000001 | 0,088387 | 0,031071 | 3 + 2 |
| shotgun | <0,000001 | 0,102247 | 0,031071 | 2 + 0 |

Правий центр основного хвату: 0 м у спокої, до **0,045 м** при повній віддачі.
Повний перелік невдалих комбінацій: **`[]`**. Дані й worst case для кожного
виду: [hold-check-results.json](C:/Users/User/Documents/Codex/2026-10-26/build-the-voxel-style-characters-for/outputs/weapons-stage-a-round2/hold-check-results.json).
[Журнал verify](C:/Users/User/Documents/Codex/2026-10-26/build-the-voxel-style-characters-for/outputs/weapons-stage-a-round2/VERIFY.txt).

## Що змінилося в хватах

- Доданий Object3D `supportGrip` і відповідний userData reference кожній firearm.
  Для rifle/sniper/shotgun це дочірня точка в нулі існуючого foregrip, тобто
  та сама world-позиція. Для pistol — front-left руків’я: (−0,11; −0,06; −0,19).
- `attachWeapon` одноразово центрує firearm на фактичному правому кулаку NFT,
  враховуючи його розмір і socket. Для knife попередній основний хват збережений.
- Firearms: рука 47° у спокої, 25…82° з aimPitch. Без fire muzzle повертається
  від −22° до +35°; повна віддача додає 5,73°. Це видимий поворот самої зброї.
- `supportPose.ts`: quaternion аналітично спрямовує armL до supportGrip.
  Найменший необхідний зсув плечового pivot-а утримує фактичний центр
  існуючого жорсткого кулака в точці. Не додаються bones, elbow, meshes або
  деформація/переписування vertices; масштаб кисті залишається 1.
- Правий arm/pivot мінімально відводиться для безпечного об’єму обох кистей
  та зброї. Ліва вільна кисть knife також перевірена й за потреби відведена назовні.
- `fire?`, `reload?`, `cycle?` finite-guarded. Fire узгоджує руки з фактичним
  recoil зброї; reload/cycle дають невеликий regrip навколо центра кисті.
  Кисть залишається на supportGrip; повний перенос на магазин/затвор відкладений.
- Без weapon (або з null) всі нові fields ігноруються. Старий API поводиться
  побітово як до weapons. Єдиний часовий стан персонажа — стара публічна phase.

## Скло

Один додатковий спільний MeshBasicMaterial для ВСІХ лінз: vertexColors,
transparent=true, opacity=0.35, depthWrite=false, toneMapped=false.
Лінзи — тонкі box panes + світла верхня кромка та кутовий відблиск, merged
по одному mesh на лінзу, `lens-*`. Тонка кромка допомагає читати скло збоку.

- Sniper: `lens-objective` та `lens-eyepiece` у відкритих кільцях.
- Rifle: `lens-sight`, малий рамковий optic.
- Pistol: `lens-dot` на рухомому slide, рухається разом із ним.
- Shotgun і knife не мають оптики, тому лінз немає.
- У viewmodel eyepiece sniper повністю hidden. Матеріал світу не змінюється.
- Cache, shared material та dispose/recreate лінз перевіряються автоматично.

![Світові лінзи sniper](C:/Users/User/Documents/Codex/2026-10-26/build-the-voxel-style-characters-for/outputs/weapons-stage-a-round2/scope-lenses.png)

## Що виглядає найгірше, попри PASS

| NFT / weapon | Художній компроміс |
|---|---|
| `vibe-vibers-viber-extra-9` / sniper, aim −45° | Максимальний зсув armL pivot **1,768 м** від вихідного лівого плеча. Через широку голову та короткий жорсткий сегмент рука відчутно перенесена вперед/праворуч. Це точний контакт кисті, але не анатомічне плече. |
| `vibe-vibers-viber-141` / sniper, aim −89° | Idle-аудит: зсув **1,758 м**; широкий шолом і висока вузька кисть (H≈0,516 м) посилюють громіздкість. |
| `vibe-vibers-viber-63`, `viber-84`, `viber-extra-11` / sniper | Наступні найбільші idle-зсуви: приблизно 1,615 / 1,597 / 1,520 м. Короткий рукав більше схожий на окремий підтримувальний блок. |
| `reference-01` (Малиновий) / pistol | Кулаки 0,44 × 0,40 × 0,42 м великі для малого руків’я: підтримувальна кисть частково перекриває основну, форму grip видно гірше. Fist-to-fist overlap не заборонений acceptance-контрактом. |
| `bureau-roll-40-10`, `bureau-roll-22-12`, `viber-6` / довгі firearms | Найменші кисті; у першого близько 0,126 × 0,084 × 0,200 м. На великих foregrip видно мало світлого кулака. |
| `bureau-25` з капелюхом / sniper +89° | У ракурсі 3/4 ствол і scope перекривають частину обличчя/убору на зображенні. Head/torso не перетинаються в об’ємі; cap/glasses extras не є collider цього тесту. |
| `viber-32` з антенами / rifle та sniper +89° | Піднятий ствол конкурує із силуетом антен. Їх не пересували заради хвату; дивіться ракурси нижче. |

Префікс `vibe-vibers-` у скорочених назвах рядків збережений у configs.
[Idle-аудит усіх 33 NFT: розміри кистей, зсуви й weapon](C:/Users/User/Documents/Codex/2026-10-26/build-the-voxel-style-characters-for/outputs/weapons-stage-a-round2/appearance-audit.json).
Мінімальний зсув pivot-а обраний власником; **його величина не прихована за
чисельним PASS**. Для анатомічного плеча потрібна окрема артикуляція, що тут не додавалась.

![Найбільший зсув, extra-9 / sniper −45°](C:/Users/User/Documents/Codex/2026-10-26/build-the-voxel-style-characters-for/outputs/weapons-stage-a-round2/worst-extra9-sniper-minus45.png)

## 45 ракурсів: по 5 weapons × 3 aim для трьох NFT

У кожній сітці: рядки knife/pistol/rifle/sniper/shotgun, стовпці −89°, 0°, +89°.
Окремі PNG кожної комбінації також збережені поруч зі звітом.

![Малиновий — 15 ракурсів](C:/Users/User/Documents/Codex/2026-10-26/build-the-voxel-style-characters-for/outputs/weapons-stage-a-round2/malynovyi-grid.png)

![Bureau-25 із капелюхом — 15 ракурсів](C:/Users/User/Documents/Codex/2026-10-26/build-the-voxel-style-characters-for/outputs/weapons-stage-a-round2/hat-bureau-25-grid.png)

![Viber-32 з антенами — 15 ракурсів](C:/Users/User/Documents/Codex/2026-10-26/build-the-voxel-style-characters-for/outputs/weapons-stage-a-round2/antennas-viber-32-grid.png)

## Змінені файли й запуск

```text
src/characters/types.ts            optional fire/reload/cycle, handL bounds type
src/characters/createCharacter.ts  support bounds існуючого лівого кулака
src/characters/poseCharacter.ts    виклик дворукого solver, вільна кисть knife
src/weapons/supportPose.ts         НОВИЙ: аналітичний solver без алокацій у кадрі
src/weapons/hold.ts                cached quaternion, NFT-specific main grip
src/weapons/types.ts               supportGrip, LensSpec, glass palette, VM palms
src/weapons/weapons.ts             support points, dot/optic frames, lens box lists
src/weapons/resources.ts           єдиний lens material, pane cache/dispose
src/weapons/createWeapon.ts        Object3D supportGrip, named lens meshes
src/weapons/viewmodel.ts           дві кисті також для pistol, hidden rear lens
src/weapons/preview.ts             нові тексти, лінзи/mesh counts, 45 ракурсів, fit
src/weapons/preview.css            перенесення кнопок на вузькому екрані
src/weapons/verify.mjs              нові матеріали/лінзи, VM contact, legacy fields
src/weapons/verifyHolds.mjs         обидва кулаки, left error, worst-case дані
src/weapons/README.md              оновлена інтеграція
src/weapons/REVIEW.md              позначений історичним
src/weapons/ROUND2.md              цей звіт
src/weapons/hold-check-results.json результати acceptance
src/weapons/measurements.json       opaque + lens counts, нові optic bounds
```

```sh
npm run dev
# ?weapons=1
npm run verify
node src/weapons/verify.mjs --report
npm run build
```

Package.json та Vite config не змінювались. Інші частини Stage B не починались.
