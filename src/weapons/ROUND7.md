# Round 7 · Sniper scope · ПРОЙДЕНО

Зміни тільки у sniper viewmodel та його діагностиці/PNG. Світові моделі всіх
п'яти видів зброї, конфіги, персонажі, хват, armVariants і poseWeapon збережені.
Stage B не розпочато. Очікується підтвердження власника.

## Виміряні результати

FOV 70°, viewport 1280×720, 16:9, на місці. Обидві сторони дають однаковий результат.

| Параметр | Фактичне значення | Умова |
|---|---:|---:|
| Чистий задній отвір VM, Ш×В | 0.2300 × 0.2120 м | великий отвір |
| Повна задня грань корпусу VM, з outline | 0.3220 × 0.2900 м | корпус HIP |
| Отвір / повна задня грань, Ш / В | 71.43% / 73.10% | 70–75% |
| Темна внутрішня рамка, зовнішні Ш×В | 0.2700 × 0.2480 м | з outline |
| Товщина темної рамки, X / Y | 0.0200 / 0.0180 м | 0.012–0.020 м |
| Номінальна товщина box рамки | 0.018 м | outline додає 0.002 м по X |
| SNIPER_ADS_DISTANCE | 0.10 м | без змін від Round 6 |
| ADS1: чиста ширина / висота | 85.4688% / 100.00% | кожна ≥60% |
| ADS1: непрозоре покриття кадру | 14.5313% | лише рамка по краях |
| ADS1: opaque pixels усередині чистого прямокутника | 0 | 0 |
| ADS1: opaque centre ray hits | 0 / 16 | 0 |
| ADS1: sampled clear angle | 70.0° | ≥20° |
| Max sightAxis error | 2.258e-16 м | ≤0.01 м |
| HIP: scope coverage, справа | 5.6366% | ≤12% |
| HIP: scope coverage, зліва | 5.6366% | ≤12% |
| HIP: bounding rectangle, обидві сторони | 8.5178% | додаткова консервативна оцінка |
| Світова зброя: opaque + lenses | 3 + 2 | ≤3 + ≤2 |
| VM зброя: opaque + lenses у кеші | 2 + 2 | ≤3 + ≤2 |
| VM зброя: видимі opaque + lenses при ADS ≥0.5 | 1 + 0 | тільки scopeRear |
| Grip→muzzle, фактична відстань | 1.412834 м | 1.40 м ±25% |

Задній carrier/bezel з кольором корпуса лишається за тонкою темною рамкою в HIP.
Carrier входить до scopeBody і ховається в ADS разом із трубою та переднім кільцем.
Тому 70–75% рахуються від ПОВНОЇ задньої грані HIP, а товщина 0.018–0.020 м —
від окремої темної рамки, яку видно в ADS. Це різні деталі, їхні розміри наведені окремо.
Верх і низ темної рамки у 16:9 лежать за краями кадру; видно дві тонкі бічні смуги.

## Поведінка й ресурси

- createWeapon('sniper') створює незмінну світову модель Round 6. Її rear opening
  лишається 0.068 × 0.070 м, корпус
  0.342 × 0.3575 × 0.7573 м.
- createViewmodel('sniper', ...) вибирає окрему кешовану збірку. Її scopeBody —
  один merged SkinnedMesh для непрозорої зброї, труби й переднього кільця.
  scopeRear — другий mesh з чотирьох boxes. Ліміт не піднято.
- Три rigid bones зберігають нерухомий корпус і оригінальний рух mag/bolt.
  Їхні Group pivots, poseWeapon і траєкторії не змінені. Перевіряються реальні
  skinned vertex positions проти старих окремих mag/bolt meshes на п'яти progress.
  Жодного переписування position/skinWeight buffers у кадрі немає.
- При ads <0.5 scopeBody видимий, objective lens має той самий shared glass
  opacity .35. Rear eyepiece, як у Round 6, прихований лише в першій особі.
- При ads ≥0.5 scopeBody.visible=false, обидві lens-* приховані.
  Власні руки VM теж приховані, щоб залишалася тільки рамка.
  Геометрія та розрахунок поз рук не змінені. Світові руки завжди лишаються видимими.
- poseViewmodel змінює лише існуючі transforms/visible. Без нових об'єктів,
  геометрії або матеріалів у кадрі. Bone texture створюється при побудові;
  це службовий GPU skinning buffer, без файлів текстур/зображень.
- Матеріали зброї ті самі: shared Lambert / glow / glass. Обидві lens-* геометрії
  й матеріал спільні зі світовою зброєю. Всі VM geometry кешовані між копіями.
- disposeWeaponResources звільняє scopeBody, scopeRear, обидві лінзи,
  shared матеріали та skeleton bone textures. Перевірено dispose exactly once
  і нову геометрію після повторного створення.

## Метод вимірювання

Отвори виміряні raycast фактичних outlined boxes, зовнішні габарити — їхні AABB.
Clear fraction і opaque coverage — маска проєкцій реальних видимих непрозорих
трикутників на 1280×720 (FOV70), а не формула opening/distance. Окремо знайдено
найближчі межі по центру та перевірено ВЕСЬ внутрішній прямокутник: 0 blocked pixels.
Центр перевіряється незалежним raycast. Скло й приховані об'єкти не включені.

HIP coverage — союз проєкцій усіх деталей прицілу, mounts і видимого скла.
Перекриття іншими деталями зброї/рук не віднімається: оцінка консервативна.
Для 1:1 додатково отримано 9.7988% (також ≤12%).

## Перевірки

`npm run verify -- --hold-weapon=sniper` — PASS, exit 0.
`node work/round7-final-scope.mjs` — PASS реальних габаритів задньої грані та dispose.
`npm run build` — PASS, exit 0.

- 33 geometry SHA-256 baselines, 66 legacy arm hashes і весь frozen arm bank незмінні.
- 3264 character poses, 1088 extreme head checks, 396 старих поз без weapon.
- 1575 weapon progress poses і 11385 viewmodel poses всіх 5 weapons/33 NFT:
  finite, deterministic, unchanged geometry buffers, cache, material і near-plane checks.
- Sniper HIP: 33 персонажі ×6 poses ×5 aim ×2 shooting ×4 phases =7920;
  0 провалів. Max R fist 0.088270 м,
  max L fist 0.084784 м, min clearance 0.001002 м.
  Пороги не змінено: кулаки ≤.10 м, жодної вершини всередині shrink .01 head/torso.
- ADS1: обидві сторони × fire/reload/cycle 0/1 =16 вимірів 1280×720.
- Видимість threshold .499/.5/.75/1 і повернення до HIP перевірені в обидва боки;
  додатковий ADS raster для всіх 33 NFT і обох sides. 76 перевірок видимості.
- Регресія Round 6: 72 станів решти чотирьох VM
  з ідентичними transforms/visibility/geometry hashes; 25 світових weapon states
  і всі 5 config об'єктів ідентичні. Весь src/characters побайтово незмінний.
- Один службовий verifier раніше тимчасово робив hands.visible=true після fan-тесту.
  Тепер він повертає попередній visible; для іншої зброї результат незмінний.

## PNG

[Sniper: третя особа / HIP / ADS](sniper-scope-strip.png)

[Кнопка «↓ PNG · перша особа HIP / ADS»: актуальний експорт](first-person-hip-ads.png)

Обидва PNG отримані штатними кнопками WebGL-прев'ю. Sniper panels — FOV70,16:9;
фонова сітка лише в sniper PNG показує, що центр відкритий. Сітка не є частиною
зброї й не включена в weapon coverage. Рядки решти зброї не змінені.
У браузері немає console errors. Сервер лишається на http://127.0.0.1:5174/?weapons=1.

## Змінені файли

- `src/weapons/ROUND7.md`
- `src/weapons/createWeapon.ts`
- `src/weapons/index.ts`
- `src/weapons/preview.ts`
- `src/weapons/resources.ts`
- `src/weapons/round7-sniper-results.json`
- `src/weapons/sniperScopeMetrics.ts`
- `src/weapons/sniperViewScope.ts`
- `src/weapons/sniperViewmodel.ts`
- `src/weapons/types.ts`
- `src/weapons/verify.mjs`
- `src/weapons/verifyHolds.mjs`
- `src/weapons/verifySniper.mjs`
- `src/weapons/viewmodel.ts`
