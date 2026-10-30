# Round 5 Amendment · ПРОЙДЕНО

Інші гравці та F5 бачать лише HIP справа. ADS видимий тільки локальному
гравцю у viewmodel. Поля ads / holdSide видалені з PoseState персонажа;
світовий solver їх не читає, preview не передає їх у poseCharacter.
Світовий лівий хват прибраний: він потребував би іншого калібрування при
одній парі довжин. Порожній legacy socketL залишений у структурі без meshes.
Viewmodel right/left збережені; default right. Emotes/rocket boots не додані.

## Приймання

`npm run verify -- --parallel-holds`: **PASS, exit 0**. Це повна матриця
чотирма незалежними процесами з тим самим oracle, що у послідовному
`npm run verify`. `npm run build`: **PASS, exit 0**.

Третя особа: 33×4×6 poses×5 aim×2 shooting=7920 станів, чотири фази:
**31680 поз**. Тільки HIP, без ADS станів/перевірок персонажа.
Максимальна похибка кисті **0.088964681 м** при ліміті .10 м.
Мінімальний signed clearance **0.001001715 м**. Невдалих записів: **0**.

Перша особа: **6336 станів** (33×4×2 sides×3 ads×8 progress).
У HIP / фінальному ADS центр вільний: **0 opaque hits / 4224 rays**.
ADS1 max sightAxis error **1.440e-16 м** до точки (0,0,−.14).
Чисті кути ADS1 для ОБОХ sides: pistol31°, rifle28°, sniper25.5°, shotgun26.5°.
Пороги 25° / sniper20° пройдені. Задні лінзи приховані у VM, решта прозорі.

Додатково пройдені: finite/deterministic, outer transform незмінний, плечі
нерухомі, scales=(1,1,1), стики arm/glove <=.001 м, <=8 meshes персонажа,
нормалізовані extents/1.8 м, head .6×aim з max35° та sink<=.08 м;
33 default SHA, 396 старих поз без weapon, 66 legacy SHA, весь frozen банк
41 довжин L/R; 1575 weapon та 11385 VM progress-поз; матеріали/cache/dispose.
Source audit frame allocation пройдено: module scratch, без new/clone/масивів
у pose, без переписування vertices. Heap/mobile GPU окремо не профілювалися.

Незмінний файл default baselines SHA-256: `314325e95217473de8f75551b6ad7d4123c949b3bd7c32679d2ec1a387a811e0`.
Конфіги геометрії зброї, package.json та vite.config.js побайтово тотожні Round 4.

## Таблиця 1 · третя особа HIP · персонаж × зброя

Кожен рядок агрегує 240 поз: idle/run/strafe/back/crouch/jump,
aim −89/−45/0/+45/+89°, shooting on/off, чотири фази.
Усі реальні weapon/arm/glove vertices вимірюються у world та переводяться
у posed oriented head/torso boxes зі shrink .01 м. Від’ємне число означало б
intrusion. Це vertex contract, не SAT усіх трикутників і не collision декоративних extras.
Для фаз перевірена рівність rig-local трансформів перед повторним використанням
oracle під спільним жорстким rig. Поріг кистей саме .10 м за Amendment.

| Персонаж | Зброя | max R, м | max L, м | min clearance, м | FAIL |
|---|---|---:|---:|---:|---:|
| reference-01 | pistol | 0.034003 | 0.083211 | 0.020557 | 0 |
| reference-01 | rifle | 0.032759 | 0.083249 | 0.018805 | 0 |
| reference-01 | sniper | 0.032759 | 0.083249 | 0.018805 | 0 |
| reference-01 | shotgun | 0.032759 | 0.083249 | 0.018805 | 0 |
| vibe-vibers-bureau-23 | pistol | 0.031124 | 0.083490 | 0.017728 | 0 |
| vibe-vibers-bureau-23 | rifle | 0.038112 | 0.083477 | 0.017452 | 0 |
| vibe-vibers-bureau-23 | sniper | 0.038112 | 0.083477 | 0.004620 | 0 |
| vibe-vibers-bureau-23 | shotgun | 0.038112 | 0.083477 | 0.017452 | 0 |
| vibe-vibers-bureau-24 | pistol | 0.021564 | 0.084489 | 0.021064 | 0 |
| vibe-vibers-bureau-24 | rifle | 0.020378 | 0.084531 | 0.013484 | 0 |
| vibe-vibers-bureau-24 | sniper | 0.020378 | 0.084531 | 0.002999 | 0 |
| vibe-vibers-bureau-24 | shotgun | 0.020378 | 0.084531 | 0.023656 | 0 |
| vibe-vibers-bureau-25 | pistol | 0.026678 | 0.083550 | 0.002254 | 0 |
| vibe-vibers-bureau-25 | rifle | 0.025496 | 0.083626 | 0.004510 | 0 |
| vibe-vibers-bureau-25 | sniper | 0.025496 | 0.083626 | 0.004510 | 0 |
| vibe-vibers-bureau-25 | shotgun | 0.025496 | 0.083626 | 0.004510 | 0 |
| vibe-vibers-bureau-31 | pistol | 0.088965 | 0.069501 | 0.001439 | 0 |
| vibe-vibers-bureau-31 | rifle | 0.088270 | 0.070261 | 0.004037 | 0 |
| vibe-vibers-bureau-31 | sniper | 0.088270 | 0.070261 | 0.004037 | 0 |
| vibe-vibers-bureau-31 | shotgun | 0.088270 | 0.070261 | 0.004037 | 0 |
| vibe-vibers-bureau-4 | pistol | 0.025027 | 0.083914 | 0.007613 | 0 |
| vibe-vibers-bureau-4 | rifle | 0.023838 | 0.083979 | 0.009980 | 0 |
| vibe-vibers-bureau-4 | sniper | 0.023838 | 0.083979 | 0.009980 | 0 |
| vibe-vibers-bureau-4 | shotgun | 0.023838 | 0.083979 | 0.009980 | 0 |
| vibe-vibers-bureau-8 | pistol | 0.048831 | 0.066173 | 0.002882 | 0 |
| vibe-vibers-bureau-8 | rifle | 0.050150 | 0.084007 | 0.001071 | 0 |
| vibe-vibers-bureau-8 | sniper | 0.050110 | 0.083853 | 0.001071 | 0 |
| vibe-vibers-bureau-8 | shotgun | 0.050263 | 0.084007 | 0.003223 | 0 |
| vibe-vibers-bureau-roll-22-11 | pistol | 0.026678 | 0.083550 | 0.002254 | 0 |
| vibe-vibers-bureau-roll-22-11 | rifle | 0.025496 | 0.083626 | 0.004510 | 0 |
| vibe-vibers-bureau-roll-22-11 | sniper | 0.025496 | 0.083626 | 0.004510 | 0 |
| vibe-vibers-bureau-roll-22-11 | shotgun | 0.025496 | 0.083626 | 0.004510 | 0 |
| vibe-vibers-bureau-roll-22-12 | pistol | 0.026372 | 0.084161 | 0.024807 | 0 |
| vibe-vibers-bureau-roll-22-12 | rifle | 0.044079 | 0.084133 | 0.001595 | 0 |
| vibe-vibers-bureau-roll-22-12 | sniper | 0.043915 | 0.084133 | 0.006195 | 0 |
| vibe-vibers-bureau-roll-22-12 | shotgun | 0.044079 | 0.084133 | 0.018850 | 0 |
| vibe-vibers-bureau-roll-40-10 | pistol | 0.037817 | 0.083901 | 0.001006 | 0 |
| vibe-vibers-bureau-roll-40-10 | rifle | 0.039897 | 0.083868 | 0.001073 | 0 |
| vibe-vibers-bureau-roll-40-10 | sniper | 0.039897 | 0.083868 | 0.001073 | 0 |
| vibe-vibers-bureau-roll-40-10 | shotgun | 0.039897 | 0.083868 | 0.001073 | 0 |
| vibe-vibers-bureau-roll-48-7 | pistol | 0.026678 | 0.083550 | 0.002254 | 0 |
| vibe-vibers-bureau-roll-48-7 | rifle | 0.025496 | 0.083626 | 0.004510 | 0 |
| vibe-vibers-bureau-roll-48-7 | sniper | 0.025496 | 0.083626 | 0.004510 | 0 |
| vibe-vibers-bureau-roll-48-7 | shotgun | 0.025496 | 0.083626 | 0.004510 | 0 |
| vibe-vibers-bureau-roll-7-11 | pistol | 0.026678 | 0.083550 | 0.002254 | 0 |
| vibe-vibers-bureau-roll-7-11 | rifle | 0.025496 | 0.083626 | 0.004510 | 0 |
| vibe-vibers-bureau-roll-7-11 | sniper | 0.025496 | 0.083626 | 0.004510 | 0 |
| vibe-vibers-bureau-roll-7-11 | shotgun | 0.025496 | 0.083626 | 0.004510 | 0 |
| vibe-vibers-bureau-roll-9-5 | pistol | 0.030793 | 0.083604 | 0.023436 | 0 |
| vibe-vibers-bureau-roll-9-5 | rifle | 0.029585 | 0.083635 | 0.022030 | 0 |
| vibe-vibers-bureau-roll-9-5 | sniper | 0.029585 | 0.083635 | 0.022030 | 0 |
| vibe-vibers-bureau-roll-9-5 | shotgun | 0.029585 | 0.083635 | 0.022030 | 0 |
| vibe-vibers-viber-10 | pistol | 0.028197 | 0.083488 | 0.009623 | 0 |
| vibe-vibers-viber-10 | rifle | 0.026996 | 0.083558 | 0.001967 | 0 |
| vibe-vibers-viber-10 | sniper | 0.026996 | 0.083558 | 0.001967 | 0 |
| vibe-vibers-viber-10 | shotgun | 0.026996 | 0.083558 | 0.001967 | 0 |
| vibe-vibers-viber-103 | pistol | 0.079995 | 0.070392 | 0.049732 | 0 |
| vibe-vibers-viber-103 | rifle | 0.076812 | 0.071248 | 0.051168 | 0 |
| vibe-vibers-viber-103 | sniper | 0.076812 | 0.071248 | 0.051168 | 0 |
| vibe-vibers-viber-103 | shotgun | 0.076812 | 0.071248 | 0.051168 | 0 |
| vibe-vibers-viber-123 | pistol | 0.026151 | 0.084215 | 0.005405 | 0 |
| vibe-vibers-viber-123 | rifle | 0.024936 | 0.084247 | 0.007752 | 0 |
| vibe-vibers-viber-123 | sniper | 0.024936 | 0.084247 | 0.007752 | 0 |
| vibe-vibers-viber-123 | shotgun | 0.024936 | 0.084247 | 0.007752 | 0 |
| vibe-vibers-viber-141 | pistol | 0.076103 | 0.069085 | 0.018775 | 0 |
| vibe-vibers-viber-141 | rifle | 0.046216 | 0.083947 | 0.020974 | 0 |
| vibe-vibers-viber-141 | sniper | 0.046216 | 0.083947 | 0.020974 | 0 |
| vibe-vibers-viber-141 | shotgun | 0.046216 | 0.083947 | 0.020974 | 0 |
| vibe-vibers-viber-142 | pistol | 0.035848 | 0.082992 | 0.001181 | 0 |
| vibe-vibers-viber-142 | rifle | 0.034491 | 0.082938 | 0.001002 | 0 |
| vibe-vibers-viber-142 | sniper | 0.034491 | 0.082938 | 0.001002 | 0 |
| vibe-vibers-viber-142 | shotgun | 0.034491 | 0.082938 | 0.001002 | 0 |
| vibe-vibers-viber-31 | pistol | 0.022279 | 0.084352 | 0.017195 | 0 |
| vibe-vibers-viber-31 | rifle | 0.021092 | 0.084402 | 0.019716 | 0 |
| vibe-vibers-viber-31 | sniper | 0.021092 | 0.084402 | 0.007264 | 0 |
| vibe-vibers-viber-31 | shotgun | 0.021092 | 0.084402 | 0.019716 | 0 |
| vibe-vibers-viber-32 | pistol | 0.026678 | 0.083550 | 0.002254 | 0 |
| vibe-vibers-viber-32 | rifle | 0.025496 | 0.083626 | 0.004510 | 0 |
| vibe-vibers-viber-32 | sniper | 0.025496 | 0.083626 | 0.004510 | 0 |
| vibe-vibers-viber-32 | shotgun | 0.025496 | 0.083626 | 0.004510 | 0 |
| vibe-vibers-viber-42 | pistol | 0.026678 | 0.083550 | 0.002254 | 0 |
| vibe-vibers-viber-42 | rifle | 0.025496 | 0.083626 | 0.004510 | 0 |
| vibe-vibers-viber-42 | sniper | 0.025496 | 0.083626 | 0.004510 | 0 |
| vibe-vibers-viber-42 | shotgun | 0.025496 | 0.083626 | 0.004510 | 0 |
| vibe-vibers-viber-48 | pistol | 0.031675 | 0.084275 | 0.021057 | 0 |
| vibe-vibers-viber-48 | rifle | 0.030360 | 0.084259 | 0.022874 | 0 |
| vibe-vibers-viber-48 | sniper | 0.030360 | 0.084259 | 0.022874 | 0 |
| vibe-vibers-viber-48 | shotgun | 0.030360 | 0.084259 | 0.022874 | 0 |
| vibe-vibers-viber-6 | pistol | 0.083526 | 0.084542 | 0.003652 | 0 |
| vibe-vibers-viber-6 | rifle | 0.082245 | 0.084754 | 0.003817 | 0 |
| vibe-vibers-viber-6 | sniper | 0.082345 | 0.084754 | 0.001343 | 0 |
| vibe-vibers-viber-6 | shotgun | 0.047080 | 0.084754 | 0.005515 | 0 |
| vibe-vibers-viber-63 | pistol | 0.020241 | 0.084743 | 0.016773 | 0 |
| vibe-vibers-viber-63 | rifle | 0.019002 | 0.084784 | 0.009634 | 0 |
| vibe-vibers-viber-63 | sniper | 0.078813 | 0.084784 | 0.003129 | 0 |
| vibe-vibers-viber-63 | shotgun | 0.019002 | 0.084784 | 0.019812 | 0 |
| vibe-vibers-viber-71 | pistol | 0.029176 | 0.083355 | 0.004373 | 0 |
| vibe-vibers-viber-71 | rifle | 0.039995 | 0.083363 | 0.005989 | 0 |
| vibe-vibers-viber-71 | sniper | 0.039995 | 0.083363 | 0.005295 | 0 |
| vibe-vibers-viber-71 | shotgun | 0.039995 | 0.083363 | 0.005989 | 0 |
| vibe-vibers-viber-84 | pistol | 0.021458 | 0.084714 | 0.020530 | 0 |
| vibe-vibers-viber-84 | rifle | 0.020168 | 0.084725 | 0.016541 | 0 |
| vibe-vibers-viber-84 | sniper | 0.079429 | 0.084725 | 0.001881 | 0 |
| vibe-vibers-viber-84 | shotgun | 0.020168 | 0.084725 | 0.016578 | 0 |
| vibe-vibers-viber-extra-11 | pistol | 0.080407 | 0.069615 | 0.049525 | 0 |
| vibe-vibers-viber-extra-11 | rifle | 0.079062 | 0.070339 | 0.051245 | 0 |
| vibe-vibers-viber-extra-11 | sniper | 0.079062 | 0.070339 | 0.051245 | 0 |
| vibe-vibers-viber-extra-11 | shotgun | 0.079062 | 0.070339 | 0.051245 | 0 |
| vibe-vibers-viber-extra-12 | pistol | 0.082099 | 0.083578 | 0.012777 | 0 |
| vibe-vibers-viber-extra-12 | rifle | 0.030700 | 0.083803 | 0.014509 | 0 |
| vibe-vibers-viber-extra-12 | sniper | 0.030700 | 0.083803 | 0.014509 | 0 |
| vibe-vibers-viber-extra-12 | shotgun | 0.030700 | 0.083803 | 0.014509 | 0 |
| vibe-vibers-viber-extra-15 | pistol | 0.024165 | 0.084211 | 0.018567 | 0 |
| vibe-vibers-viber-extra-15 | rifle | 0.023001 | 0.084252 | 0.021045 | 0 |
| vibe-vibers-viber-extra-15 | sniper | 0.023001 | 0.084252 | 0.021045 | 0 |
| vibe-vibers-viber-extra-15 | shotgun | 0.023001 | 0.084252 | 0.021045 | 0 |
| vibe-vibers-viber-extra-19 | pistol | 0.026678 | 0.083550 | 0.002254 | 0 |
| vibe-vibers-viber-extra-19 | rifle | 0.025496 | 0.083626 | 0.004510 | 0 |
| vibe-vibers-viber-extra-19 | sniper | 0.025496 | 0.083626 | 0.004510 | 0 |
| vibe-vibers-viber-extra-19 | shotgun | 0.025496 | 0.083626 | 0.004510 | 0 |
| vibe-vibers-viber-extra-20 | pistol | 0.081996 | 0.084207 | 0.013777 | 0 |
| vibe-vibers-viber-extra-20 | rifle | 0.023831 | 0.084542 | 0.016379 | 0 |
| vibe-vibers-viber-extra-20 | sniper | 0.023831 | 0.084542 | 0.012802 | 0 |
| vibe-vibers-viber-extra-20 | shotgun | 0.023831 | 0.084542 | 0.016379 | 0 |
| vibe-vibers-viber-extra-24 | pistol | 0.025104 | 0.083891 | 0.007327 | 0 |
| vibe-vibers-viber-extra-24 | rifle | 0.023918 | 0.083957 | 0.009687 | 0 |
| vibe-vibers-viber-extra-24 | sniper | 0.023918 | 0.083957 | 0.009687 | 0 |
| vibe-vibers-viber-extra-24 | shotgun | 0.023918 | 0.083957 | 0.009687 | 0 |
| vibe-vibers-viber-extra-9 | pistol | 0.075760 | 0.068929 | 0.001153 | 0 |
| vibe-vibers-viber-extra-9 | rifle | 0.046046 | 0.069313 | 0.002897 | 0 |
| vibe-vibers-viber-extra-9 | sniper | 0.046046 | 0.069313 | 0.002897 | 0 |
| vibe-vibers-viber-extra-9 | shotgun | 0.046046 | 0.069313 | 0.002897 | 0 |

## Таблиця 2 · перша особа · зброя × HIP side × ads

Кожен рядок: усі 33 NFT × fire/reload/cycle 0/1 (264 стани).
Фінальне ADS1 має axis error<=.01 м, центр без opaque mesh і кут>=25°
(sniper>=20°). HIP центр також вільний. ADS.5 — діагностика переходу;
приціл ще не мусить бути на осі чи мати кут фінального ADS.
Рамка sniper під час переходу ADS.5 перетинає центр; це явно показано нижче,
а в HIP/ADS1 центр вільний. Це обмеження перехідної анімації.

Ray fan: near .05, FOV70, 36 азимутів через10°, radial step .25°;
консервативний діаметр на .5° нижче першого sampled opaque hit.
Кеш weapon fan використано лише з camera-space AABB-доказом, що кисті поза
конусом; інакше raycast повного viewmodel. Transparent lens-* виключені.

| Зброя | HIP side VM | ADS | min clear angle | max sightAxis error, м | centre hits / 264 | FAIL |
|---|---|---:|---:|---:|---:|---:|
| pistol | right | 0 | 32.5° | 1.029677 | 0 | 0 |
| pistol | right | 0.5 | 28.0° | 0.513020 | 0 | 0 |
| pistol | right | 1 | 31.0° | <0.000001 | 0 | 0 |
| pistol | left | 0 | 32.5° | 1.029677 | 0 | 0 |
| pistol | left | 0.5 | 28.0° | 0.513020 | 0 | 0 |
| pistol | left | 1 | 31.0° | <0.000001 | 0 | 0 |
| rifle | right | 0 | 12.0° | 1.131501 | 0 | 0 |
| rifle | right | 0.5 | 13.0° | 0.566329 | 0 | 0 |
| rifle | right | 1 | 28.0° | <0.000001 | 0 | 0 |
| rifle | left | 0 | 12.0° | 1.131501 | 0 | 0 |
| rifle | left | 0.5 | 13.0° | 0.566329 | 0 | 0 |
| rifle | left | 1 | 28.0° | <0.000001 | 0 | 0 |
| sniper | right | 0 | 6.0° | 1.032151 | 0 | 0 |
| sniper | right | 0.5 | 0.0° | 0.514183 | 264 | 0 |
| sniper | right | 1 | 25.5° | <0.000001 | 0 | 0 |
| sniper | left | 0 | 6.0° | 1.032151 | 0 | 0 |
| sniper | left | 0.5 | 0.0° | 0.514183 | 264 | 0 |
| sniper | left | 1 | 25.5° | <0.000001 | 0 | 0 |
| shotgun | right | 0 | 12.0° | 1.055458 | 0 | 0 |
| shotgun | right | 0.5 | 14.0° | 0.526487 | 0 | 0 |
| shotgun | right | 1 | 26.5° | <0.000001 | 0 | 0 |
| shotgun | left | 0 | 12.0° | 1.055458 | 0 | 0 |
| shotgun | left | 0.5 | 14.0° | 0.526487 | 0 | 0 |
| shotgun | left | 1 | 26.5° | <0.000001 | 0 | 0 |

## Довжини й pose API

Погоджена формула: повна довжина верхнього блока Round-4 HIP/right ×5/6,
потім найближчий extra з кроком .04 м; кулак не змінюється.
Фактична похибка округлення кожної руки <=.02 м. Одна пара L/R на NFT,
жодного вибору за side/weapon/aim/ADS або mode blend. Банк створений заздалегідь.
Повні 33 пари, попередня/цільова/фактична upper length і rounding error —
`arm-lengths.csv` та `arm-lengths.json` поруч із цим звітом.

Єдине місце констант — characters/armVariants.ts:
ARM_SHORTEN_RATIO=5/6, ARM_MIN_EXTRA=0, ARM_MAX_EXTRA=1.60,
ARM_LENGTH_STEP=.04. Legacy ARM_LONG_EXTRA=.40 лише для архівних hash.
Geometry/glove size/mesh count у кадрі не змінюються; лише готова geometry
обирається при наявності firearm. Normal arms автоматично повертаються без
зброї або з ножем; старі unarmed snapshots збережені.

`attachWeapon(avatar,weapon)` — HIP right socket, один attach. Новий
`poseCharacter` приймає weapon/fire/reload/cycle + звичайний стан руху/aim,
без ads/holdSide. `createViewmodel(id,config,{holdSide:'right'})` і
`poseViewmodel` мають right/left та ads0…1. Ніж ADS ігнорує.

HIP solver допускає скінченний окол точних сфер до .095 м, перевіряючи реальну
похибку кулаків <=.10 м. Довжини та плечі не пересуваються задля досяжності.
Кандидати сортуються за близькістю; невдалі швидко відкидаються, кожен прийнятий
проходить повний vertex scan. Пошук закінчується при першій безпечній позі.
Стан детермінований, прихованого clock/cache поз немає.

Локальні контрольні заміри Node (не мобільний benchmark): Малиновий/rifle idle
близько .34 мс/pose; viber-6/sniper crouch aim−45° близько1.70 мс/pose.
До оптимізації той самий пошук коштував близько18/24 мс відповідно.

ADS_DISTANCE=.14 м, adsFovHint sniper28 / інші55 — візуальні дані.
FOV камери гра змінює самостійно. VM має власні arms, скорочення світу на них
не поширюється. Pure smoothstep/lerp/slerp; реальний sightAxis компенсує recoil
та рух slide і при ADS1 є на осі для обох sides.

Mesh counts opaque+lens: knife2+0, pistol3+1, rifle3+1, sniper3+2, shotgun2+0.
VM додатково має два merged hand/forearm meshes. Shared lens material .35,
transparent, depthWrite=false, toneMapped=false; rear panes приховані лише VM.

## Найтісніші п’ять

- vibe-vibers-viber-142: min clearance 0.001002 м, max fist 0.082992 м, FAIL 0.
- vibe-vibers-bureau-roll-40-10: min clearance 0.001006 м, max fist 0.083901 м, FAIL 0.
- vibe-vibers-bureau-8: min clearance 0.001071 м, max fist 0.084007 м, FAIL 0.
- vibe-vibers-viber-extra-9: min clearance 0.001153 м, max fist 0.075760 м, FAIL 0.
- vibe-vibers-viber-6: min clearance 0.001343 м, max fist 0.084754 м, FAIL 0.

Великі fists bureau-8 й деталі viber-6 потребують більших дозволених зсувів
від центрів grip; масивний scope лишився toy-форми Round 4. Капелюхи/антени не
є head hitbox. Найменші зазори близькі до1 мм, але всі контрактні вершини зовні.

## PNG і прев’ю

Чотири `hip-*.png`: Малиновий / bureau-25 з капелюхом / viber-32 з антенами,
кожна firearm, idle aim0. `first-person-hip-ads.png`: усі чотири firearms,
чотири колонки right HIP / right ADS / left HIP / left ADS, Малиновий.
Це справжні WebGL-експорти кнопок прев’ю. `REVIEW.html` — галерея та обидві таблиці.
У прев’ю ADS slider і «Поза viewmodel» керують тільки FPS; HIP side selector
також тільки FPS. Третя особа завжди підписана HIP справа й не піднімає зброю
через локальне прицілювання. Head/aimPitch і firing залишаються світовою анімацією.

## Змінені файли від source ZIP Round 4

- src/characters/armVariants.ts
- src/characters/createCharacter.ts
- src/characters/holdReach.ts
- src/characters/poseCharacter.ts
- src/characters/types.ts
- src/weapons/README.md
- src/weapons/ROUND5.md
- src/weapons/hold.ts
- src/weapons/preview.ts
- src/weapons/round5-arm-lengths.json
- src/weapons/round5-check-results.json
- src/weapons/round5-summary.json
- src/weapons/supportPose.ts
- src/weapons/verify.mjs
- src/weapons/verifyHolds.mjs
- src/weapons/verifyParallel.mjs
- src/weapons/viewmodel.ts

Зміни реалізації тільки src/characters та src/weapons. work — scratch,
outputs — результати. Після звіту STOP для погодження.
