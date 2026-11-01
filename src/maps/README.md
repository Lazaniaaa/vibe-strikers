# Toy Town · M2 / M3

Поточні альтернативи M3, запуск і застереження: [M3.md](M3.md). Нижче збережено документацію схваленого M2.

Самостійний модуль статичної карти. Один метр = одна одиниця; Y угору; початок координат у центрі площі. Карта дзеркальна відносно X=0. Північ на плані — +Z.

## Запуск

```sh
npm run dev -- --port 5174
# http://127.0.0.1:5174/?map=1
node src/maps/verify.mjs
npm run build
# work/dist/index.html — попередня лабораторія
# work/dist/map.html — карта
```

`vite preview` також відкриває карту за `?map=1`. Пакети й package.json залишено без змін. Кореневий vite.config.js лише підключає плагін із цього каталогу.

## Публічний контракт

```ts
import {
  mapIds, loadMapData, buildMap, mapColliders,
  mapShotBlockers, spawnPoints, disposeMapResources,
} from './src/maps';

const data = loadMapData('toy-town');
const model = buildMap(data);
scene.add(model);

const solidBoxes = mapColliders(data).boxes;
const raycastBoxes = mapShotBlockers(data).boxes;
const teamA = spawnPoints(data, 'A');
// game owns Rapier bodies, controller, camera, spawn choice and loot logic
// ... after removing every map model from every scene:
disposeMapResources();
```

- `mapIds` і JSON із `loadMapData` заморожені. Невідомий id дає помилку. Для редагування карти використовуйте власну копію даних.
- `buildMap` повертає нову Group; група, як і дані, має нульову трансформацію. Геометрія й один Lambert-матеріал спільні між побудовами однакових даних. Кешується повна серіалізація MapData.
- Статика об’єднана у чотири квадранти 35 × 35 м. Віконні збірки — два InstancedMesh; дрібні статичні префаби включені у квадранти. Немає текстур, нестандартних шейдерів чи оновлення геометрії у кадрі. `group.userData.stats` містить лічильники.
- `boxes` у статистиці — розгорнуті логічні блоки; `renderBoxes` враховує всі пластини обведення, інстанси та розрізання чанків. `triangles` і `drawCalls` — верхня межа для всієї видимої карти, без персонажа-еталона та додаткового проходу тіней. Шість великих чанків відкидають тінь.
- Колайдери — **світові** AABB `{x,y,z,w,h,d}`, без урахування подальшої трансформації Group. Геометрію карти й колайдери слід переміщувати узгоджено. Половини розмірів для Rapier: `[w/2,h/2,d/2]`; x/y/z — центр. Межі колізій відповідають логічним блокам, обведення виступає приблизно на 3 мм.
- Видаються нові масиви колайдерів та спавнів. Суміжні колайдери з однаковим перерізом і прапорцем blocksShots об’єднуються без заповнення проміжків. Скло блокує рух і постріли; decor не блокує обох. У цій карті кожен колайдер також блокує постріли.
- `disposeMapResources` звільняє кеші геометрії, матеріал, одиничний BoxGeometry та буфери всіх створених InstancedMesh. Повторний виклик безпечний. Після нього попередні групи не слід рендерити; наступний buildMap створює нові ресурси.
- Карта не імпортує персонажів чи зброю. Лише прев’ю читає публічний API персонажів для одного Малинового.

## Дані та планування

`data/toy-town.json` — єдине джерело геометрії, палітри, спавнів, зон і лут-точок. `tools/generate.py` / `tools/logic_m2.py` — необов’язковий редакторський генератор поточного M2 із замороженого M1 у `baselines/m1-data.json`; під час гри він не потрібен. Кути yaw — радіани, кратні π/2.

MID перетинає площу з фонтаном; LEFT проходить через будинок; RIGHT — через ринковий двір. Парні зовнішні балкони та ринкова галерея мають рівень +2,5 м. Під галереєю — зовнішній прохід заввишки 1,302 м. Парні захисні стіни дають кожному спавну північний і південний вихід. Додаткові поперечні двері не дають зворотним вулицям перетворитися на довгі глухі кишені.

Низький борт фонтана — 1,0 м; центральний фонтан із накривкою — 1,4 м. Звичайна скриня — 1,002 м, парні стоси — 2,006 м. Периметр — 6,5 м. Фонові фасади стоять за ним, у смузі до межі ±35 м.

## Перевірки й межі моделі

`verify.mjs` завершується з ненульовим кодом за помилки та записує `reports/toy-town.json`. Початковий SHA-256 збережений у `baselines/toy-town.sha256.json`; `--write-baseline` навмисно переписує його після схваленої зміни геометрії.

- Сітка навігації 0,25 м, капсула radius=0,5 м, зріст 1,8/1,2 м, крок 0,30 м, підйом стрибком до 1,2 м. Перевіряється капсула вздовж ребер та дискретна траєкторія стрибка. Це перевірка планування, а не реалізація контролера чи сертифікація поведінки Rapier.
- Поверхні для навігації: floor, stair і prop. Дахи/верхи стін, позначені wall, не є запланованою ігровою площею. До загального знаменника входить також підлога в недоступній зовнішній смузі за стіною та верхи деяких високих декорацій; усі спавни, зони й лут перевіряються окремо.
- Зв’язність усіх стартів доводиться досяжністю з першого спавну та зворотними шляхами до нього. Довжини — горизонтальна довжина шляху, час — довжина / 4,8 м/с. Найдовший шлях визначено як максимум найкоротших шляхів для 36 пар A→B та окремо найдовший із трьох маршрутів через задані зони. Довільний маршрут із повторними петлями не має скінченної верхньої довжини.
- Чотири основні петлі рахуються у перевіреному макрографі: по дві гілки навколо кожного захисного екрана й три гілки між центральними вузлами; E−V+1=4. Це кількість тактичних гілок, а не число всіх можливих мікромаршрутів між реквізитом.
- Лінії видимості: точні перетини променів з AABB через статичну ієрархію; джерела через 0,5 м, кути через 1°, на висоті очей кожного доступного рівня. Результат — максимум **серед перевірених променів**; неперервні довільні кути не доведені аналітично. Окремо перевіряються всі 36 пар командних спавнів.
- Перевірка копланарності враховує кожну пару логічних колайдерів та площу перекриття їхніх граней. Обведення має окремі 2-мм зсуви. Внутрішні грані, створені розрізанням одного суцільного блока між чанками, приховані всередині суцільного об’єму.

Прев’ю статичне: жоден input не запускає навігацію, простріли чи побудову карти. Повторний кадр запитується через один requestAnimationFrame. Клік розміщення еталона робить один raycast; PNG створюються лише кнопками експорту. Вільна камера рухається без фізики та може проходити крізь стіни.


## M2: кольори й аудит

- Нові ключі палітри `legend:<zone>`, `zone:<zone>:<role>`, `floor:<zone>:±1` задають ідентичність зон без розширення формату MapData. A — теракота/гірчиця/корал; B — бірюза/блакить/сланцевий синій. Центральні орієнтири: червоний дах, синій ринок і жовті годинники.
- Декоративні підлогові клітини 4м мають ±4% lightness; крайні смуги — 3м. Усі декоративні доповнення не змінюють колізій. Поточний `color-guard.mjs` порівнює точні колайдери й навігаційні вузли всіх п’яти карт із замороженим станом перед новим кольоровим етапом та явним переліком дозволених виправлень.
- `palettes/legacy.json` зберігає старі кольори. Прев’ю заздалегідь будує дві групи з однаковими позиціями/нормалями/індексами/матрицями; перемикач «Палітра» лише міняє їхню видимість. Порівнюється палітра M1 на поточній геометрії M2.
- Окремі B-зміни: чотири двері у спавнових екранах; перенесення чотирьох зовнішніх екранів; закриття чотирьох внутрішніх прорізів для захисту; низький фонтан; дві пари зсунутого реквізиту; напрямки спавнів; перенесення восьми FFA-точок у захищені місця; чотири скрині на кінцях вулиць замінені поперечними екранами, що прибирають ранні кути з довгих ліній власної половини.
- M2 замінює колишню ціль 25–35с на явні довжини: MID80–95м, LEFT/RIGHT110–140м. Швидкість лишається 4,8м/с. MID — фактичний найкоротший маршрут через площу для контрольних стартів. Старі 144м включали три додаткові контрольні точки; це пояснено у звіті.
- `audit.mjs before|after` створює незалежний аудит. `verify.mjs` запускає його заново й перевіряє захист усіх 28 спавнів на всіх вузлах у межах 14,4м геодезичної відстані. Балкони семплюються через 1м, довгі лінії — через 2м. Найдовші лінії зі спавнів до доступних точок ворожої половини перевіряються на сітці 0,25м.
- `reports/m2/contrast.json` містить 990 CIE76-порівнянь: 33 body-кольори ×10зон ×3 найпоширеніші кольори. Значення <15 — попередження low contrast, а не причина змінювати персонажів. Поширеність оцінена площею верхніх і бічних граней блоків, обрізаною зонами; приховану базову підлогу виключено.
- Теплокарта — 756 напрямлених пар усіх 28 спавнів, один найкоротший шлях на пару, логарифмічна колірна шкала. Це геометрична евристика зі сталим розв’язанням рівних довжин; тактичні рішення гравців і стрілянина до неї не входять.
- Рейтинг кемпінгу: power = eye→eye; exposure = enemy eye→torso. Обидві метрики наведені як частка цільових точок, бо eye→eye видимість сама по собі взаємна. Балкони — навмисні сильні точки. Crouch-прохід перевірено окремо.

```sh
node src/maps/color-guard.mjs
node src/maps/audit.mjs before
node src/maps/verify.mjs
python src/maps/tools/report_m2.py
```

Машинні звіти: `reports/m2/`; огляд для власника, повні таблиці CIE76, PNG і CSV: `outputs/toy-town-m2/`. Вихідні M1-дані та хеш не перезаписуються. Історичний публічний API збережений; поточні зміни рендерера й необов’язкові поля описані нижче.

## Colour pass — Endesga 32 (2026-11-01)

All five Toy Town JSON files use the single fixed [Endesga 32 palette](https://lospec.com/palette-list/endesga-32), included in `palettes/endesga32.json`. Team A has terracotta, orange and mustard accents; B has cyan, turquoise and slate. Cream/white and blue-white floor tiles stay lighter than cover. Roofs, shutters, doorway trims and signs carry the strongest colours. All original palette keys are retained and remapped; additional keys use the same palette. The legacy comparison remains available in the existing preview.

Lighting is data driven: warm sun `#EAD4AA`, intensity **2.8**; cool ambient `#C0CBDC`, intensity **0.9**. Blue sky is `#0099DB`; fog is the horizon colour `#8B9BB4`, near **45m**, far **120m**. `sky.horizon?: string` is optional metadata. New optional `light.hemisphere?: { sky: string; ground: string; intensity: number }` supplies soft sky/ground fill: `#C0CBDC` / `#EAD4AA`, intensity **0.85**. **buildMap creates this HemisphereLight inside the returned Group** so existing game consumers receive the fill without client edits. Consumers should continue creating the sun/ambient from JSON, and must not create a second hemisphere for the same map. There is no animation or per-frame map work.

The renderer now batches static boxes and small prefab assemblies into **four 35m quadrants**. Repeated window/shutter/awning assemblies retain two real InstancedMesh families, one per team. One shared vertex-colour Lambert material is retained; no texture, shader or material is added. This trades fine culling for fewer submissions: **6 map draws** versus 42 on the four lane variants / 52 on base Toy Town. Four static shadow casters add at most four shadow draws. `renderBoxes` counts outline plates and chunk splits, rather than logical boxes; its verification ceiling follows the existing triangle ceiling (12 triangles per rendered box). Logical box, triangle, shadow and draw-call checks remain active; the new colour gate additionally requires <=6 map draws and <60k direct map triangles.

New decor is noncolliding and does not block shots: window frames, glass-colour panels, shutters/slats, striped hoods, flower boxes, small pixel signs, door frames, roof edges, potted topiary and spawn floor stripes. Geometry is generated once and shared through the full-data cache. Box geometry, dark outline plates and distinct top colours are retained.

The only physical changes are the explicitly requested bug fixes. Named benches/lamps/crates move clear of walls, symmetrically. On base Toy Town, the long screen prefabs are split at their existing house-wall junction and trimmed with a 4mm gap; their cover line remains in place. R1's two stair-front counters are removed; the four adjacent posts move out 0.05m to give a 2.62m clear entrance. All three steps remain. `color-guard.mjs` compares exact expanded colliders and navigation nodes against the immutable pre-colour snapshot plus these named fixes; spawns, zones, bounds and loot are unchanged.

Run `node src/maps/verify.mjs` from the repository root. It now includes `verify-colour.mjs`, all five colour guards, shared-resource/disposal checks, palette membership, fixed lighting, decor flags, named prop/wall penetration, R1 stair entry, budget and 33-character CIE76 reports, followed by all existing navigation/tactical audits. Historical M1/M2 snapshots remain unchanged; current render SHA-256 baselines include the approved colours/detail/batching changes. Low-contrast pairs (<15) are reported explicitly, without changing characters. This colour-only metric uses unlit data, not rendered shadows or silhouette recognition.

A separate four-view review is available with `node src/maps/tools/colour-preview-server.mjs`, then `http://127.0.0.1:5176/src/maps/preview/colour.html`. It uses the game's ACES/sRGB output and matched sun/shadow settings. Original before images are immutable captures; the current page exports the after views. Camera positions, FOV, sizes and actual frame counts (including shadow submissions) are recorded in `reports/colour/before-views.json` and `after-views.json`. `reports/colour/REPORT.md` and `FILES.md` contain results and the exact transfer list. Runtime integration needs only **buildMap.ts, types.ts and the five map JSON files**; all other files are preview, verification or evidence.
