# Stage A · Round 3 · НЕ ПРОЙДЕНО

Кешований armLong із +0,40 м реалізовано, плечі нерухомі. Приймання хвату НЕ пройдене. npm run verify: код 1; npm run build: код 0. Emotes і rocket boots не розпочато.

## Результат матриці

33×4 firearms×6 poses×5 aim×shooting on/off = 7920 комбінацій, кожна у чотирьох фазах: 31680 випадків. Невдалих: **31680**. Поріг ОБОХ кулаків — 0,03 м; його не послаблено. 16764 випадків мають проникнення вершини у head/torso; 14916 — лише похибку хвату.

| Зброя | max R, м | max L, м | min signed clearance, м | FAIL / cases |
|---|---:|---:|---:|---:|
| pistol | 0.2467 | 0.3580 | -0.1827 | 7920 / 7920 |
| rifle | 0.2520 | 0.5454 | -0.1827 | 7920 / 7920 |
| sniper | 0.2520 | 0.5454 | -0.1827 | 7920 / 7920 |
| shotgun | 0.2520 | 0.5454 | -0.1827 | 7920 / 7920 |

Від’ємний signed clearance означає входження вершини за поверхню зменшеного бокса. Найгірше: viber-84 / crouch / aim −45° / shooting off / phase 0, armR-boxes vertex 145 у head, −0,1827 м. Усі фактичні вершини weapon + arm/glove meshes переводяться у world, далі в inverse-повернуті head/torso boxes зі shrink 0,01 м. Це vertex test, не SAT усіх трикутників.

[Усі невдалі випадки JSON](../../outputs/weapons-stage-a-round3/long-arm-check-results.json) · [CSV](../../outputs/weapons-stage-a-round3/failures.csv) · [Повний verify](../../outputs/weapons-stage-a-round3/VERIFY.txt) · [Build](../../outputs/weapons-stage-a-round3/BUILD.txt)

## П’ять найгірших персонажів

Сортування за найбільшою похибкою кисті серед усіх weapons/poses/angles/phases. Кожен має 960 невдалих випадків.

| id | max R, м | max L, м | min clearance, м |
|---|---:|---:|---:|
| viber-extra-11 | 0.2520 | 0.5454 | -0.0744 |
| viber-extra-9 | 0.2315 | 0.5188 | -0.0994 |
| viber-84 | 0.2156 | 0.5018 | -0.1827 |
| viber-63 | 0.2102 | 0.4951 | -0.1637 |
| viber-103 | 0.1648 | 0.4599 | -0.0546 |

Найбільший R: extra-11 / rifle, sniper або shotgun / idle / +89° / shooting on / phase 0 — 0,2520 м. Найбільший L: extra-11 / ті самі firearms / idle / 0° / shooting off / phase 0 — 0,5454 м. Великий scope має додаткові проникнення у голову. Великий кулак Малинового може візуально маскувати промах центра.

## Доведена несумісність обмежень

Жорстка рука обертанням дістає до сфери фіксованого радіуса. Радіус виміряно від плечового pivot-а до центра справжнього outlined кулака. Найближча точка зони хвату обчислена для x=0,05…0,12; y=0,50…0,65; z=torsoFront−(0,35…0,45).

У **23 із 33** уже ПРАВА рука з +0,40 м коротша за найближчу точку зони більш ніж на 0,03 м. Ця нижня межа не залежить від IK, foregrip, yaw чи лівої руки. Для решти 10 цей простий доказ не встановлює можливість повного хвату; поточні пози теж не проходять. Не стверджуємо, що кожен знайдений перетин математично неминучий.

| id | радіус R з armLong | найближчий grip | мінімально неминучий промах R |
|---|---:|---:|---:|
| viber-extra-11 | 0.6894 | 0.8881 | 0.1987 |
| viber-extra-9 | 0.8793 | 1.0600 | 0.1807 |
| viber-84 | 0.7458 | 0.9041 | 0.1582 |
| viber-63 | 0.7783 | 0.9326 | 0.1543 |
| viber-103 | 0.7307 | 0.8438 | 0.1132 |

Extra-11: 0,6894 м проти 0,8881 м, залишок не менше 0,1987 м. Кути чи перенесення foregrip не усунуть цей правий дефіцит. Для наступного виправлення потрібно погодити зміну довжини рук за пропорціями/стороною або зони розміщення зброї. Самовільно ці правила не змінені.

[Нижні межі для всіх 33](../../outputs/weapons-stage-a-round3/reach-bounds.json)

## Що проходить

| Перевірка | Результат |
|---|---|
| 33 default geometry SHA, включно з glow | PASS, baseline не переписано |
| 396 checksum старих поз; optional fields без weapon | PASS, byte-identical |
| 66 нових armLong SHA | PASS, окремий frozen baseline |
| Верхній блок +0,40 м після normalization; glove size незмінний | PASS |
| Фактичні upper/glove bounds, стики | PASS, зазор <=0,001 м |
| Firearm плечі / arm scales | PASS: зсув 0, scale (1,1,1) |
| Character meshes під час swap | PASS: 6…8, без нових meshes |
| 1,80 м, bodyExtents, head 0,6× max35°, sink <=0,08 м | PASS, початковий контракт |
| Детермінізм, finite progress/death/NaN/Infinity, outer transform | PASS |
| Кеші / bounds / shadow / незмінні buffers після поз | PASS |
| Pose/hold allocation source audit | PASS, scratch objects на рівні модуля |
| Weapon poses / viewmodel poses | PASS: 1575 / 11385 |
| FOV70 screen-centre opaque raycasts | PASS: 0 / 1320 влучань |
| Scope: отвір 0,12×0,12 з обох кінців | PASS: 0 / 162 влучань |
| Лінзи / матеріали / dispose / повторне створення | PASS |
| Контакт R і L <=0,03 м та clearance | **FAIL, повний перелік збережено** |
| 0,01 м для всіх пар coplanar fist/weapon faces | Не сертифіковано; загальний хват не готовий |

Allocation audit перевіряє джерела pose-функцій на new/clone/map/filter/toArray та незмінність buffers. Це не окремий heap-profiler benchmark.

## Геометрія, пози та preview

Єдина константа: src/characters/armVariants.ts::ARM_LONG_EXTRA = 0.40. Верхній блок подовжено вниз, той самий колір, outline і top plate; glove не масштабовано. Малі вихідні зазори стику закрито лише в long variant. Fist extras їдуть до нового кінця, shoulder extras лишаються. Одна merged geometry на руку, ідентичні L/R поділяють її; bounds/sphere кешовані, castShadow=true. Нормалізація і bodyExtents без варіанта незмінні. Кеш appearance охоплює весь config крім id/name та значення константи.

Авто вмикає armLong лише для firearms; knife/null повертають normal geometry. Плечі зафіксовано, yaw ±30° всередину. Аналітичне обертання спрямовує жорсткі руки до справжніх цілей без приховування нев’язки. Двосферний розв’язувач з фіксованими 32 кроками обирає компромісну точку у заданій зоні. WeaponHold лишається під weaponSocket, pose-owned локальна матриця компенсує socket і root recoil. У death mainGrip потрапляє точно до фактичного правого кулака.

Зброя: 0,40×aimPitch до ±35,6° плюс recoil; head: незмінні 0,60× до ±35°. Knife використовує попередню одноручну гілку. Додано mainGrip Object3D у нулі weapon root. Foregrip наближено до (−0,055,−0,025,−0,35); rifle/sniper grip-блок перенесено відповідно. Ствол/приклад не вкорочено. Pistol supportGrip=(−0,105,−0,035,−0,15), нижче й на 0,15 м вперед.

Preview: «Довгі руки: авто / вимк / завжди», «Показати цілі» з реальних mainGrip/supportGrip, «Хвати ±89°» з повною таблицею FAIL і WebGL-кадрами. Жодного тексту про відкладений дворучний хват. Нові матеріали для маркерів не створюються.

## Mesh counts

| weapon | opaque | lens |
|---|---:|---:|
| knife | 2 | 0 |
| pistol | 3 | 1 |
| rifle | 3 | 1 |
| sniper | 3 | 2 |
| shotgun | 2 | 0 |

Character: 6 base + максимум head/torso glow = 6…8. Лінзи попереднього round збережено: один shared Basic transparent 0,35 / depthWrite=false / toneMapped=false; eyepiece sniper приховано тільки у viewmodel. Інших нових матеріалів немає.

## 36 реальних WebGL-кадрів

Auto, idle, phase 0, shooting off. Стовпці −89°, 0°, +89°; рядки pistol/rifle/sniper/shotgun. Фотографії показують поточний НЕВДАЛИЙ хват. Підписані справжні R/L помилки.

### Малиновий

![Малиновий: 12 хватів](../../outputs/weapons-stage-a-round3/reference-01-grid.png)

| weapon | −89°: R / L / clearance, м | 0°: R / L / clearance, м | +89°: R / L / clearance, м |
|---|---|---|---|
| pistol | [0.0008 / 0.1052 / 0.0475](../../outputs/weapons-stage-a-round3/reference-01-pistol--89.png) | [0.0008 / 0.1187 / -0.0198](../../outputs/weapons-stage-a-round3/reference-01-pistol-0.png) | [0.0008 / 0.0942 / 0.0249](../../outputs/weapons-stage-a-round3/reference-01-pistol-89.png) |
| rifle | [0.0008 / 0.2986 / 0.0475](../../outputs/weapons-stage-a-round3/reference-01-rifle--89.png) | [0.0008 / 0.3056 / -0.0161](../../outputs/weapons-stage-a-round3/reference-01-rifle-0.png) | [0.0141 / 0.2433 / 0.0030](../../outputs/weapons-stage-a-round3/reference-01-rifle-89.png) |
| sniper | [0.0008 / 0.2986 / 0.0475](../../outputs/weapons-stage-a-round3/reference-01-sniper--89.png) | [0.0008 / 0.3056 / -0.0161](../../outputs/weapons-stage-a-round3/reference-01-sniper-0.png) | [0.0141 / 0.2433 / -0.0271](../../outputs/weapons-stage-a-round3/reference-01-sniper-89.png) |
| shotgun | [0.0008 / 0.2986 / 0.0475](../../outputs/weapons-stage-a-round3/reference-01-shotgun--89.png) | [0.0008 / 0.3056 / -0.0161](../../outputs/weapons-stage-a-round3/reference-01-shotgun-0.png) | [0.0141 / 0.2433 / 0.0229](../../outputs/weapons-stage-a-round3/reference-01-shotgun-89.png) |

Великий кулак частково маскує промах supportGrip. У 0° є проникнення; sniper також провалює +89°. Антени не є collision box.

### bureau-25 · капелюх

![bureau-25 · капелюх: 12 хватів](../../outputs/weapons-stage-a-round3/bureau-25-grid.png)

| weapon | −89°: R / L / clearance, м | 0°: R / L / clearance, м | +89°: R / L / clearance, м |
|---|---|---|---|
| pistol | [0.1317 / 0.2268 / 0.0491](../../outputs/weapons-stage-a-round3/bureau-25-pistol--89.png) | [0.1317 / 0.2468 / -0.0090](../../outputs/weapons-stage-a-round3/bureau-25-pistol-0.png) | [0.1317 / 0.2294 / 0.0588](../../outputs/weapons-stage-a-round3/bureau-25-pistol-89.png) |
| rifle | [0.1317 / 0.4151 / 0.0491](../../outputs/weapons-stage-a-round3/bureau-25-rifle--89.png) | [0.1317 / 0.4354 / -0.0392](../../outputs/weapons-stage-a-round3/bureau-25-rifle-0.png) | [0.1350 / 0.3834 / 0.0127](../../outputs/weapons-stage-a-round3/bureau-25-rifle-89.png) |
| sniper | [0.1317 / 0.4151 / 0.0290](../../outputs/weapons-stage-a-round3/bureau-25-sniper--89.png) | [0.1317 / 0.4354 / -0.0342](../../outputs/weapons-stage-a-round3/bureau-25-sniper-0.png) | [0.1350 / 0.3834 / -0.0174](../../outputs/weapons-stage-a-round3/bureau-25-sniper-89.png) |
| shotgun | [0.1317 / 0.4151 / 0.0491](../../outputs/weapons-stage-a-round3/bureau-25-shotgun--89.png) | [0.1317 / 0.4354 / -0.0304](../../outputs/weapons-stage-a-round3/bureau-25-shotgun-0.png) | [0.1350 / 0.3834 / 0.0326](../../outputs/weapons-stage-a-round3/bureau-25-shotgun-89.png) |

Капелюх читається при крайніх нахилах. Обидві короткі руки не доходять; у 0° є від’ємний clearance. Sniper також провалює +89°.

### viber-32 · антени

![viber-32 · антени: 12 хватів](../../outputs/weapons-stage-a-round3/viber-32-grid.png)

| weapon | −89°: R / L / clearance, м | 0°: R / L / clearance, м | +89°: R / L / clearance, м |
|---|---|---|---|
| pistol | [0.1317 / 0.2268 / 0.0491](../../outputs/weapons-stage-a-round3/viber-32-pistol--89.png) | [0.1317 / 0.2468 / -0.0090](../../outputs/weapons-stage-a-round3/viber-32-pistol-0.png) | [0.1317 / 0.2294 / 0.0588](../../outputs/weapons-stage-a-round3/viber-32-pistol-89.png) |
| rifle | [0.1317 / 0.4151 / 0.0491](../../outputs/weapons-stage-a-round3/viber-32-rifle--89.png) | [0.1317 / 0.4354 / -0.0392](../../outputs/weapons-stage-a-round3/viber-32-rifle-0.png) | [0.1350 / 0.3834 / 0.0127](../../outputs/weapons-stage-a-round3/viber-32-rifle-89.png) |
| sniper | [0.1317 / 0.4151 / 0.0290](../../outputs/weapons-stage-a-round3/viber-32-sniper--89.png) | [0.1317 / 0.4354 / -0.0342](../../outputs/weapons-stage-a-round3/viber-32-sniper-0.png) | [0.1350 / 0.3834 / -0.0174](../../outputs/weapons-stage-a-round3/viber-32-sniper-89.png) |
| shotgun | [0.1317 / 0.4151 / 0.0491](../../outputs/weapons-stage-a-round3/viber-32-shotgun--89.png) | [0.1317 / 0.4354 / -0.0304](../../outputs/weapons-stage-a-round3/viber-32-shotgun-0.png) | [0.1350 / 0.3834 / 0.0326](../../outputs/weapons-stage-a-round3/viber-32-shotgun-89.png) |

Антени слідують head box. Пропорції рук збігаються з bureau-25, виміри ті самі, зовнішність інша. Помилки не приховані за аксесуарами.

## Змінені файли

Код змінено тільки у src/characters/ та src/weapons/. Package, lockfile і Vite config не змінені. Work/outputs — допоміжні файли та deliverables.

- src/characters/armVariants.ts
- src/characters/createCharacter.ts
- src/characters/poseCharacter.ts
- src/characters/types.ts
- src/weapons/README.md
- src/weapons/ROUND3.md
- src/weapons/arm-long-baselines.json
- src/weapons/createWeapon.ts
- src/weapons/hold.ts
- src/weapons/long-arm-check-results.json
- src/weapons/long-arm-summary.json
- src/weapons/preview.css
- src/weapons/preview.ts
- src/weapons/supportPose.ts
- src/weapons/verify.mjs
- src/weapons/verifyHolds.mjs
- src/weapons/weapons.ts

Незмінний SHA самого character-baselines.json: 314325e95217473de8f75551b6ad7d4123c949b3bd7c32679d2ec1a387a811e0.

[Джерела поточної версії](../../outputs/weapons-stage-a-round3/../weapons-stage-a-round3-source.zip). Arm-long-baselines.json не перегенеровується verify. Зміна константи потребуватиме нового baseline.

Зупинка на цьому перегляді. Для повного виправлення треба погодити зміну несумісних обмежень. Поточне приймання не оголошене успішним.
