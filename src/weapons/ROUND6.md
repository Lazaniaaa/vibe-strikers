# Round 6 · Sniper scope · ПРОЙДЕНО

Зміни лише sniper scope та його eye relief/діагностика. Інші weapons, source
персонажів/рук, hold.ts, supportPose.ts, poseWeapon.ts, матеріали та старі
пороги перевірок не змінені. Round-5 результати збережені без перезапису.

## Результат

| Параметр | Фактичне значення |
|---|---|
| Корпус прицілу, Ш×В×Д, з outline | 0.3420 × 0.3575 × 0.7573 м |
| Початковий Stage-A корпус, з outline | 0.3420 × 0.3575 × 0.7570 м |
| Уся збірка з монтажними ніжками | 0.3420 × 0.5325 × 0.7573 м |
| Задній чистий отвір, реальні rays | 0.0680 × 0.0700 м |
| Передній чистий отвір, реальні rays | 0.3080 × 0.2700 м |
| SNIPER_ADS_DISTANCE | 0.10 м |
| Чистий кут ADS1, мінімум обох sides / progress | 20.0° |
| Centre opaque hits, ADS1 | 0 / 16 |
| Max sightAxis error | 2.258e-16 м |
| Mesh count | 3 opaque + 2 lens |
| Ствол уздовж −Z від grip | 1.40 м |
| Відстань grip→muzzle у 3D | 1.412834 м, у межах 1.40±25% |

Stage-A числа взяті з outputs/weapons-stage-a-source.zip, не з приблизної
оцінки. Номінальні boxes давали .34×.3575×.755 м. Для порівняння вище обидві
версії виміряні тим самим реальним outlined BoxGeometry treatment. Різниця
глибини близько0.27 мм походить від нахилених стінок розширеного каналу.
Габарит корпуса відповідає оригіналу; ширина .342 м значно нижча за ліміт1.08 м.

Монтаж прицілу має вісь y=.57 м (оригінальна вісь була .465; великий Round4/5
мав .65). Підняті монтажні ніжки збережені так, щоб дульний блок не перекривав
20° конус. Тому корпус повернувся до Stage A, а повна висота з кріпленнями
окремо наведена як .5325 м. Позиція основного хвату/foregrip і алгоритм рук не редагувалися.

Задній отвір малий. Канал розширюється до передньої лінзи; передній горизонтальний
ободок заглиблений у короткий бічний hood. Однаково вузький отвір .07 м по всій
довжині не забезпечив би потрібний кут: обмежують також переднє кільце, стінки
та ствол. Наведені20° отримані raycast усієї реальної зброї й кистей, не формулою.

Обидві лінзи лишилися `lens-objective` / `lens-eyepiece`, один той самий shared
MeshBasicMaterial: opacity .35, transparent=true, depthWrite=false, toneMapped=false.
Rear lens прихована у viewmodel, видима у світі. Матеріалів/meshes не додано.
Нові scope boxes об’єднані в існуючий body mesh; конфігурація й cache sharing збережені.

## HIP coverage · FOV70, at rest, ADS0

| Viewport | Right | Left | Поріг |
|---|---:|---:|---:|
| 1280×720, 16:9 | 5.616% | 5.616% | <=12% |
| 720×720, 1:1, додаткова перевірка | 9.764% | 9.764% | <=12% |

Метод: союз проєкцій ВСІХ фактичних індексованих трикутників прицілу, mounts
та видимих лінз, raster по центрах пікселів. Pixel mask обрізаний viewport.
Перекриття іншими частинами rifle/руками не віднімається; скло теж рахується
як зайнята площа. Отже це консервативна верхня оцінка видимого scope coverage.
Для16:9 навіть повний bounding rectangle займає лише 8.518%.
У PNG використано окремі панелі700×620: там фактичний aspect інший, відсоток
вказаний під панеллю ADS0. Позування нерухоме: fire/reload/cycle0, equip1, aim0,time0.

## Перевірки

`npm run verify -- --hold-weapon=sniper`: **PASS, exit0**.
`npm run build`: **PASS, exit0**.
33 default SHA / старі approved unarmed poses / довжини рук та bank hashes
пройдені старими перевірками. Sniper HIP: 7920 поз усіх33 NFT,
0 невдалих. Max R/L:
0.088270 / 0.084784 м,
min clearance 0.001002 м. Пороги Round5 не послаблені.
Sniper VM: 1584 станів усіх33 NFT, обидва sides, ADS0/.5/1,
fire/reload/cycle0/1; кінцевий ADS/центр перевірені існуючим oracle.

Нові sniper-only перевірки: оригінальні outer dimensions; отвори за реальними
паралельними rays; coverage; 20° fan FOV70/near.05; centre ray; .10 eye relief;
<=3 opaque/<=2 lens; 1.40±25%; lens names; shared geometry; body/objective/eyepiece
dispose exactly once і нові geometry після dispose. Усі пройдені.
Fan: 36 азимутів, radial step .25°; повернений консервативний діаметр до першого opaque hit.

Для інших4 weapons конфіги тотожні Round5; 72
контрольних viewmodel станів (обидва sides, ADS0/.5/1, progress0/.5/1) з усіма
geometry SHA і transform snapshots збіглися точно. У poseViewmodel є лише
sniper-умова вибору eye relief; для інших ADS_DISTANCE лишився .14.
У verifyHolds змінений тільки sniper expected eye relief, решта тексту oracle
порівняна з Round5. Усі src/characters та файли hold/arms побайтово незмінні.

## PNG і файли

`sniper-scope-strip.png`: Малиновий, TP HIP справа / FPS ADS0 / FPS ADS1.
Це фактичний WebGL export нового sniper-only button прев’ю. Картка/габарити
sniper і HIP coverage label оновлені. Інших preview controls/holds не міняли.

`sniper-results.json`, `sniper-contract.json`, `regression.json`, VERIFY.txt,
BUILD.txt — числа й логи поруч. README / ROUND5 та старі reports збережені
як контекст; поточний sniper результат — цей ROUND6.md.

Змінені файли від source ZIP Round5:

- src/weapons/README.md
- src/weapons/ROUND6.md
- src/weapons/ads.ts
- src/weapons/index.ts
- src/weapons/measurements.json
- src/weapons/preview.ts
- src/weapons/round6-sniper-results.json
- src/weapons/sniperScope.ts
- src/weapons/sniperScopeMetrics.ts
- src/weapons/verify.mjs
- src/weapons/verifyHolds.mjs
- src/weapons/verifySniper.mjs
- src/weapons/viewmodel.ts
- src/weapons/weapons.ts

Після цього STOP, очікування погодження.
