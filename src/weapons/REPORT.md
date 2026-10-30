# Історичний звіт первинного Stage A

Після цього звіту виконано правки хватів і прицілу. Актуальний звіт — `REVIEW.md`.

Створені knife, pistol, rifle, sniper, shotgun у стилі затверджених NFT:
BoxGeometry, той самий `Boxes.outlined`, vertex colors, світлі верхні грані,
по одному акценту. Є прогресові анімації та first-person руки для всіх 33 NFT.
**Зупинка на Stage A. Stage B не розпочато.**

Прев’ю поточного сеансу: [студія зброї](http://127.0.0.1:5174/?weapons=1).
Після нового запуску використовуйте адресу, яку виведе Vite, з `?weapons=1`.

## Що перевірено

- `npm run verify`: PASS. Включає попередні 3264 комбінації поз персонажів
  та 1088 перевірок head/torso на крайніх кутах; максимум 0,080000 м.
- Зброя: **1575** поз; viewmodel: **11385** поз для **33 NFT × 5 weapons**.
  Finite, детермінізм, NaN/Infinity, механізми, кеші, materials, disposal,
  near plane, незмінність shared buffers.
- Найближча перевірена точка viewmodel: **Z=−0,2723 м**, перед near=0,05 м
  з запасом понад 0,22 м. Це геометрична перевірка, незалежна від viewport.
- SHA-256 усіх merged meshes **усіх 33 персонажів** збігаються з baseline,
  включно з glow. **396 старих поз** і SHA-256 `poseCharacter.ts` збігаються.
  Стара форма PoseState, ієрархія й наявні userData не змінені.
- `npm run build`: PASS. Залежності та package.json не змінювались.
- Браузер: селектори 5 weapons / 33 NFT, прогрес 0,5 для reload/cycle,
  максимальна віддача, приціл +89°, присід, інший NFT зі своїми teal-руками;
  WebGL-знімки збережені. Нових console errors немає.

Повний журнал — [VERIFY.txt](C:/Users/User/Documents/Codex/2026-10-26/build-the-voxel-style-characters-for/outputs/weapons-stage-a/VERIFY.txt).

## Виміри

Довжина — від центру основного хвату до muzzle/tip. Габарити — Ш × В × Г
rest-моделі з усіма частинами, у метрах; не включають first-person руки.
Позитивна Z-частина приклада/руків’я пояснює різницю між довжиною й глибиною.

| Зброя | Мешів | До кінчика | Габарити Ш × В × Г |
|---|---:|---:|---|
| knife | 2 | 0,550 | 0,322 × 0,170 × 0,662 |
| pistol | 3 | 0,450 | 0,254 × 0,648 × 0,558 |
| rifle | 3 | 1,100 | 0,320 × 0,738 × 1,342 |
| sniper | 3 | 1,400 | 0,487 × 0,918 × 1,682 |
| shotgun | 2 | 1,000 | 0,337 × 0,522 × 1,222 |

Цільові відстані взято без зміни. Повна глибина кожної також у межах ±25%.
Muzzle від кінцевої геометричної грані відрізняється менше ніж на 0,02 м.

## Файли та запуск

API: `src/weapons/index.ts`. Нові файли:

```text
src/weapons/
  types.ts
  weapons.ts
  resources.ts
  createWeapon.ts
  poseWeapon.ts
  viewmodel.ts
  index.ts
  preview.ts
  preview.css
  verify.mjs
  character-baselines.json
  measurements.json
  README.md
  REPORT.md
```

Дві точки підключення у `src/characters/`: `index.html` (query-маршрут
студії) та `verify.mjs` (додавання verify зброї). Інших змін персонажів немає.

```sh
npm run dev
# ?weapons=1
npm run verify
node src/weapons/verify.mjs --report
npm run build
```

API, палітри, sockets, attach, життєвий цикл ресурсів і приклад другого
проходу в R3F — [README](C:/Users/User/Documents/Codex/2026-10-26/build-the-voxel-style-characters-for/outputs/weapons-stage-a/README.md).
У візуальних конфигах немає ігрових характеристик; усі progress/time передає гра.
`dt` не накопичується; weapon/viewmodel пози не мають внутрішнього годинника.

## Що потребує вашого художнього погодження

1. Toy-масштаб, ступінчасте лезо й великий приціл. Один акцент на вид,
   glow тільки на ножі й автоматі, без bloom.
2. Великі кисті 01 помітно масивніші за кисті частини нових NFT. Viewmodel
   зберігає їхні розміри, кольори й товщину; передпліччя показане коротким
   сегментом до 0,28 м. Через це читабельність зброї відрізняється між NFT.
3. Світовий хват тимчасовий, правою рукою. На крайніх кутах старі пози можуть
   проводити зброю через голову/тулуб. Це видима межа Stage A; пози персонажів
   не змінювались, IK/нові holds та таблиця grip offsets залишені на Stage B.
4. Reload/cycle — прості рухи магазинів, затвора/ручки й помпи. Немає ADS,
   оптики, flash/гільз, ефектів влучання чи анімаційних тривалостей.

## Знімки п’яти моделей

Це фактичні WebGL-рендери, без домальовування.

![Ніж](C:/Users/User/Documents/Codex/2026-10-26/build-the-voxel-style-characters-for/outputs/weapons-stage-a/voxel-knife.png)

![Пістолет](C:/Users/User/Documents/Codex/2026-10-26/build-the-voxel-style-characters-for/outputs/weapons-stage-a/voxel-pistol.png)

![Автомат](C:/Users/User/Documents/Codex/2026-10-26/build-the-voxel-style-characters-for/outputs/weapons-stage-a/voxel-rifle.png)

![Снайперська](C:/Users/User/Documents/Codex/2026-10-26/build-the-voxel-style-characters-for/outputs/weapons-stage-a/voxel-sniper.png)

![Помпова](C:/Users/User/Documents/Codex/2026-10-26/build-the-voxel-style-characters-for/outputs/weapons-stage-a/voxel-shotgun.png)

![Персонаж 01 та viewmodel автомата](C:/Users/User/Documents/Codex/2026-10-26/build-the-voxel-style-characters-for/outputs/weapons-stage-a/studio-rifle.png)

![Інший NFT: власні teal-руки, reload/cycle 0,5](C:/Users/User/Documents/Codex/2026-10-26/build-the-voxel-style-characters-for/outputs/weapons-stage-a/studio-teal-reload.png)
