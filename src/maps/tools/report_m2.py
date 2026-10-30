"""Review tables and CSVs for M2, generated from the actual offline audit outputs."""
from pathlib import Path
import json,csv,math,colorsys,zipfile
ROOT=Path(__file__).resolve().parents[1];PROJECT=ROOT.parents[1];OUT=PROJECT/'outputs/toy-town-m2';OUT.mkdir(exist_ok=True)
def read(p):return json.loads((ROOT/p).read_text(encoding='utf-8'))
b=read('reports/m2/before.json');a=read('reports/m2/after.json');v=read('reports/toy-town.json');c=read('reports/m2/contrast.json');guard=read('reports/m2/color-geometry-guard.json');data=read('data/toy-town.json');old=read('baselines/m1-data.json');legacy=read('reports/m2/before-original-route-definition.json')
assert v['pass'] and not a['earlySafety']['failures'] and not a['chokes']['violations']
def coord(p):return '—' if p is None else '('+', '.join(f'{p[k]:.2f}' for k in ['x','y','z'] if k in p)+')'
def label(i):return 'A'+str(i+1) if i<6 else 'B'+str(i-5) if i<12 else 'FFA'+str(i-11)
def sid(s):return s.removeprefix('vibe-vibers-')
def table(headers,rows):return '| '+' | '.join(headers)+' |\n|'+ '|'.join('---' for _ in headers)+'|\n'+'\n'.join('| '+' | '.join(str(x) for x in row)+' |' for row in rows)+'\n'

# Protected sources remain byte-identical; public API/data-format files are also checked against M1.
z=zipfile.ZipFile(PROJECT/'outputs/weapons-stage-a-round9-source.zip');protected=[n for n in z.namelist() if (n.startswith('src/characters/') or n.startswith('src/weapons/') or n=='package.json') and not n.endswith('/')]
changed=[n for n in protected if (PROJECT/n).read_bytes()!=z.read(n)];assert not changed,changed
m1zip=zipfile.ZipFile(PROJECT/'outputs/toy-town-source.zip');api=['src/maps/index.ts','src/maps/types.ts','src/maps/buildMap.ts','src/maps/boxes.ts','vite.config.js']
api_changes=[n for n in api if (PROJECT/n).read_bytes()!=m1zip.read(n)];assert not api_changes,api_changes
scope={'protectedFiles':len(protected),'changed':changed,'publicApiFiles':api,'apiChanged':api_changes,'mapFieldsUnchanged':set(data)==set(old)}
(ROOT/'reports/m2/source-guard.json').write_text(json.dumps(scope,indent=2)+'\n',encoding='utf-8')

with (OUT/'contrast-990.csv').open('w',newline='',encoding='utf-8-sig') as f:
 w=csv.writer(f);w.writerow(['id','name','body_hex','zone','map_hex','CIE76_deltaE','flag'])
 for r in c['rows']:
  for p in r['pairs']:w.writerow([r['id'],r['name'],r['body'],r['zone'],p['hex'],f"{p['deltaE']:.6f}",'low contrast' if p['lowContrast'] else ''])
with (OUT/'spawn-sight.csv').open('w',newline='',encoding='utf-8-sig') as f:
 w=csv.writer(f);w.writerow(['spawn','old_origin','old_max_LOS_m','old_enemy_target','new_origin','new_max_LOS_m','new_enemy_target'])
 for i,(x,y) in enumerate(zip(b['spawnSight'],a['spawnSight'])):w.writerow([label(i),coord(x['from']),x['longest'],coord(x['to']),coord(y['from']),y['longest'],coord(y['to'])])
palette=[]
for name in [z['name'] for z in data['zones']]:
 hx=data['palette']['legend:'+name];rgb=[int(hx[k:k+2],16)/255 for k in [1,3,5]];h,l,s=colorsys.rgb_to_hls(*rgb);palette.append([name,hx,f'{h*360:.0f}° / {s*100:.0f}% / {l*100:.0f}%',data['palette']['floor:'+name+':-1']+' / '+data['palette']['floor:'+name+':1']])
routeRows=[]
for before,after in zip(b['routes'],a['routes']):routeRows.append([after['id'],f"{before['length']:.2f}",f"{after['length']:.2f}",f"{after['ratio']:.2f}",f"{after['seconds']:.2f}"])
spawnRows=[]
for i,(x,y) in enumerate(zip(b['spawnSight'],a['spawnSight'])):spawnRows.append([label(i),coord(x['from']),f"{x['longest']:.2f}",coord(y['from']),f"{y['longest']:.2f}",coord(y['to'])])
earlyRows=[]
beforeSafety={p['spawn']:p for p in b['earlySafety']['bySpawn']}
for p in a['earlySafety']['bySpawn']:
 oldSafety=beforeSafety[p['spawn']];first=oldSafety['first'];earlyRows.append([label(p['spawn']),oldSafety['failures'],'—' if not first else f"{first['time']:.3f}с",p['regionCells'],p['failures']])
campRows=[]
for i,p in enumerate(a['camping']):campRows.append([i+1,coord(p['position']),f"{p['powerPercent']:.2f}% ({p['power']})",f"{p['exposurePercent']:.2f}% ({p['exposure']})",f"{p['score']:.2f}",'так / балкон' if p['intended'] else 'ПРАПОРЕЦЬ'])
chokeRows=[]
for p in a['chokes']['passages']:chokeRows.append([coord(p['position']),f"{p['width']:.3f}",'відкрите небо' if p['height'] is None else f"{p['height']:.3f}",p['kindA']+' / '+p['kindB'],'навмисний crouch' if p['intentionalCrouch'] else 'PASS' if not p['violation'] else 'FAIL'])
flags=table(['Персонаж','Зона','Body','Колір карти','ΔE'],[[sid(p['id']),p['zone'],p['body'],p['mapColor'],f"{p['deltaE']:.2f}"] for p in c['flags']])
contrastTables=[]
for zone in c['zones']:
 rows=[r for r in c['rows'] if r['zone']==zone['name']];headers=['Персонаж / body']+[p['hex'] for p in zone['colors']];lines=[]
 for r in rows:lines.append([sid(r['id'])+' / '+r['body']]+[f"{p['deltaE']:.2f}"+(' ⚑' if p['lowContrast'] else '') for p in r['pairs']])
 contrastTables.append('### '+zone['name']+'\n\n'+table(headers,lines))
moves=[]
for i,(x,y) in enumerate(zip(old['spawns'],data['spawns'])):
 if any(x[k]!=y[k] for k in ['x','y','z']):moves.append([label(i),coord(x),coord(y),'захист перших 3с'])
heat=a['heatmap'];hot=[]
for cell in sorted(heat['cells'],key=lambda p:-p['count']):
 x=-35+(cell['ix']+.5)*.25;z=-35+(cell['iz']+.5)*.25
 if all(math.hypot(x-q[0],z-q[1])>=4 for q in hot):hot.append((x,z,cell['count']))
 if len(hot)==8:break
heatRows=[[f'({x:.2f}, {z:.2f})',count,f'{count/heat["pairCount"]*100:.1f}%'] for x,z,count in hot]
sourceFiles='\n'.join('- `'+p.relative_to(PROJECT).as_posix()+'`' for p in sorted(ROOT.rglob('*')) if p.is_file() and '__pycache__' not in p.parts)
warnings=len(c['flags']);warningCharacters=len({p['id'] for p in c['flags']});s=v['stats']
earlyBad=sum(p['failures']>0 for p in b['earlySafety']['bySpawn']);crouch=a['crouchCamping']
summary=table(['Перевірка','M1 / до','M2 / після'],[
 ['Мінімум усіх 36 пар A→B',f"{b['shortest']['length']:.2f}м / ratio{b['shortest']['ratio']:.2f}",f"{a['shortest']['length']:.2f}м / ratio{a['shortest']['ratio']:.2f}"],
 ['Максимум найкоротших A→B',f"{b['longestShortest']['length']:.2f}м",f"{a['longestShortest']['length']:.2f}м / ratio{a['longestShortest']['ratio']:.2f}"],
 ['Площа MID, видима з обох входів',f"{b['centre']['current']['bothPercent']:.2f}%",f"{a['centre']['current']['bothPercent']:.2f}%"],
 ['Небезпечні спавни у перших 3с',f'{earlyBad}/28','0/28'],
 ['Порушення ширини проходів',len(b['chokes']['violations']),len(a['chokes']['violations'])],
 ['Лут у колізіях / поза walkable',sum(p['violation'] for p in b['loot']),sum(p['violation'] for p in a['loot'])],
 ['Спавни, що не дивляться на вихід',sum(p['violation'] for p in b['spawnFacing']),sum(p['violation'] for p in a['spawnFacing'])],
 ['LEFT / RIGHT у найкоротших шляхах',str(b['heatmap']['laneUse']['LEFT'])+' / '+str(b['heatmap']['laneUse']['RIGHT']),str(heat['laneUse']['LEFT'])+' / '+str(heat['laneUse']['RIGHT'])+' (ПРАПОРЕЦЬ)'],
 ['Трикутники / основні draw calls','17 088 / 43',f"{s['triangles']:,} / {s['drawCalls']}"],
])
text=f'''# Toy Town M2 — кольори та логічний аудит

**Завершено.** Публічний API, формат MapData, index.ts/types.ts/buildMap.ts/boxes.ts, персонажі, зброя й package.json збережені. Усі {len(v['checks'])} перевірок — PASS. Водночас є **{warnings} low-contrast пар** для {warningCharacters} персонажів і **нульове використання LEFT/RIGHT геометричними найкоротшими шляхами**. Ці зауваження наведено нижче, без приховування.

[Прев’ю](http://127.0.0.1:5174/?map=1). Перемикач «Палітра» порівнює старі та нові кольори на однаковій геометрії M2; «Теплокарта» показує готові офлайн дані.

## Аудит до змін і підсумок

{summary}

Перший коментар із нульовими ранніми прострілами стосувався 12 командних спавнів і джерел у ворожій половині. Остаточна таблиця охоплює всі28спавнів та джерела обох половин.

Початковий аудит зафіксовано **до змін** у `reports/m2/before-original-route-definition.json`, а потім повторено для єдиних правил семплювання у `before.json`. Старий MID **{legacy['routes'][0]['length']:.2f}м** містив три додаткові проміжні точки. Природний MID між тими самими контрольними стартами був **{b['routes'][0]['length']:.2f}м**. Справжній мінімум усіх 36 пар був **{b['shortest']['length']:.2f}м**. M2 рахує MID як найкоротший шлях через площу, без зайвих петель контрольних точок.

## A. Палітри й деталі

{table(['Зона','Основний HEX','H / S / L','Підлога −4% / +4%'],palette)}

Великі поверхні тримаються приблизно у 25–45% HSL saturation, будинок і дахи — 40–60%, акценти — до 68%. Підлоги світліші за основні стіни й укриття. Дві півкулі читаються як тепла A та холодна B. Центральні орієнтири спільні: червона смугаста покрівля будинку, сині навіси ринку, жовті годинники над наявними кіосками.

Додано: двотонові клітини підлоги 4×4м (крайні — 3м), смуги в центрах вулиць, смугасті дахи/навіси, кольорові таблички/прапорці, дві зелені крони й живоплоти, чотири спокійні відтінки фону. Великі торцеві стіни мають тонкі декоративні кольорові панелі для розділення A/B. Усі нові декоративні блоки collide=false, blocksShots=false; великі годинники розміщені над уже суцільними неігровими дахами.

**A не змінив жодного колайдера чи walkable-комірки.** Точні хеші до/після:

```text
colliders {guard['colliderHashBefore']}
walkable  {guard['walkableHashBefore']}
```

Спавни й лут на етапі A також побайтово однакові. Окремий заморожений `m2-colors-only.json` дає змогу повторити цю перевірку.

## B. Запропоновані та застосовані невеликі виправлення

1. У двох довгих спавнових екранах зроблено **чотири двері**: X=±23, Z=±10,5; ширина 3,20м, висота 3,308м. Збережено також довгі обходи кінців стін.
2. Чотири зовнішні поперечні екрани зсунуті із Z=±13 до ±8. Чотири малі прорізи внутрішніх екранів при X=±16, Z=±4 закриті, щоб двері не відкривали ранні простріли. Разом це коротший шлях із прикритим першим поворотом. Фасадні накладки підлаштовані до дверей. Додаткова перевірка загроз із власної половини виявила ранні кути: чотири скрині при X=±18,Z=±20 замінені поперечними екранами завдовжки 16,452м і заввишки3м на кінцях вулиць. Їхні торці лишають прохід4,4м; основні маршрути не подовжились.
3. Висота фонтана разом із накривкою зменшена з 2,808 до **1,400м**; борт лишається 1м. Центральна колона більше не перекриває очі на 1,6м.
4. Дві лавки ринку: Z −29→−30,3; дві бочки позаду будинку: Z 26→26,7. Проходи 1,82м і 2,37м стали відповідно приблизно 3,12м і 3,07м. Інші знайдені вузькі проходи проходять межу ≥2,6м.
5. Усі спавни повернено вздовж першої вільної ділянки виходу. Окреме розширення перевірки на FFA виявило 8 небезпечних точок. Їх перенесено в наявні захищені місця, без нової геометрії:

{table(['Точка','Було (X,Y,Z)','Стало (X,Y,Z)','Причина'],moves)}

**Наслідок для FFA:** центральні FFA-точки прибрані; розподіл більше зосереджений у зовнішніх вулицях. Чотири FFA-точки збігаються за координатами з командними, бо ці режими використовуються окремо. Усередині набору FFA всі 16 позицій різні. Це компроміс заради вимоги захисту перших 3с, який власник може переглянути при налаштуванні режиму.

## Маршрути

{table(['Лінія','M1, м','M2, м','M2 ratio /57','M2 при 4,8м/с'],routeRows)}

Мінімум A→B — **{a['shortest']['length']:.2f}м / {a['shortest']['seconds']:.2f}с**; найдовший мінімум із 36 пар — **{a['longestShortest']['length']:.2f}м / {a['longestShortest']['seconds']:.2f}с**. Для всіх 36 пар ratio≤1,7. MID проходить через площу; LEFT — будинок; RIGHT — ринок/прохід під галереєю. Цілі M2 MID80–95м і фланги110–140м виконані.

Колишній тест часу 25–35с замінений саме на ці нові вимоги M2; швидкість 4,8м/с не змінювалась. Інші старі перевірки збережені. Дзеркальність тепер порівнює геометрію й прапорці, а кольори навмисно різні.

## Центр і видимість

Фіксована вибірка — {b['centre']['current']['samples']} точок walkable-підлоги MID через 1м, око/ціль 1,6м, входи (−10,5;0) та (+10,5;0). Лівий вхід: {b['centre']['current']['leftPercent']:.2f}%→{a['centre']['current']['leftPercent']:.2f}%; правий: {b['centre']['current']['rightPercent']:.2f}%→{a['centre']['current']['rightPercent']:.2f}%. Спільно видима площа: **{b['centre']['current']['bothPercent']:.2f}%→{a['centre']['current']['bothPercent']:.2f}%**, +{a['centre']['current']['bothPercent']-b['centre']['current']['bothPercent']:.2f} відсоткового пункту. Це виміряний внесок високого стовпа; решту перекривають інші укриття.

Глобальний скан лишився строгим: **{v['navigation']['visibility']['longest']:.2f}м ≤45м**, {v['navigation']['visibility']['rays']:,} променів через 0,5м / 1°. Ліміт не піднімався.

## Простріли кожного спавну

Перевірено всі доступні eye-точки в іншій половині на навігаційній сітці **0,25м** (висота стоячи/присівши та рівні платформ). Лінія eye→eye взаємна. «—» означає, що жодної перевіреної ворожої цілі не видно; це не пропущене значення. Повні XYZ старих і нових кінців — у [spawn-sight.csv](spawn-sight.csv).

{table(['Спавн','Старе око XYZ','M1 max, м','Нове око XYZ','M2 max, м','M2 кінцева ціль XYZ'],spawnRows)}

### Перші три секунди

Усі **28** точок перевірені на **всіх {sum(p['regionCells'] for p in a['earlySafety']['bySpawn']):,} досяжних вузлах** у межах 14,4м ходьби. Джерела загроз: {a['earlySafety']['balconySources']} точок балконів (крок1м) та {a['earlySafety']['longLaneSources']} джерел ліній ≥40м (крок2м, віяло5°), з обох сторін карти. Перевіряється голова на 1,6м. Це сильніше, ніж перевіряти лише один вибраний вихідний шлях. Після виправлень небезпечних вузлів **0**.

{table(['Точка','M1 небезпечні вузли','M1 перша видимість','M2 перевірені вузли','M2 небезпечні'],earlyRows)}

## Кемпінг: 10 найсильніших комірок

Power — eye→eye, exposure — enemy eye→torso (1м; у присіданні 0,75м), цілі через 2м, кандидати через3м і через1м на платформах. Відсотки — частка цільових точок; близьке коло <3м виключене з підрахунку. Eye→eye саме по собі взаємне, тому для практичної оцінки укриття exposure вимірює нижчу ціль. Відкинуто кандидати з power<12, щоб сліпі кути не отримували великий ratio через ділення на нуль.

{table(['#','Ноги XYZ','Power','Exposure','P/E','Навмисна точка'],campRows)}

Всі top10 — навмисні балкони; їхні розміри й огорожі збережено. Crouch-прохід перевірений окремо: power {min(p['powerPercent'] for p in crouch):.2f}–{max(p['powerPercent'] for p in crouch):.2f}%, exposure {min(p['exposurePercent'] for p in crouch):.2f}–{max(p['exposurePercent'] for p in crouch):.2f}%, P/E {min(p['score'] for p in crouch):.2f}–{max(p['score'] for p in crouch):.2f}. Ознаки надмірної сили в ньому не знайдено.

## Вузькі місця

Пошук паралельних граней з протяжністю ≥0,8м, перевіркою доступності капсули, плюс окреме вимірювання дверних рам. Непрохідні щілини між блоками не рахуються як проходи. У таблиці всі знайдені проходи <3м та навмисний crouch.

{table(['Центр X,Z','Ширина, м','Висота, м','Обмеження','Статус'],chokeRows)}

Порушень **0**. Двері мінімум 2,702×3,308м; єдиний навмисний низький прохід — 3×1,302м.

## Лут і напрямки спавнів

Лут: **20/20** точок поза стінами та сходами, на доступній поверхні (зсув над поверхнею ≤0,12м). Спавни: **28/28** мають вільний циліндр radius1,2м × height2м; найменший реальний радіус — {v['spawnClearance']['minimumFreeRadius']:.3f}м. Усі дивляться в напрямку перших 4м вихідного шляху, відхилення ≤45° й пряма перешкода далі3м. Після повороту порушень **0**.

## Теплокарта та ймовірні бої

Рівно **{heat['pairCount']}** напрямлених пар усіх 28 спавнів, один горизонтально найкоротший шлях на пару. Для {heat['crossHalfPairs']} міжполовинних пар MID використано {heat['crossHalfUse']['MID']} разів. LEFT / RIGHT — **{heat['laneUse']['LEFT']} / {heat['laneUse']['RIGHT']}**. Це **прапорець невикористаних геометричних флангів**, а не прихований PASS балансування. Зміна їхньої привабливості потребує окремого ігрового рішення; в цьому раунді виконані лише запитані короткі структурні виправлення.

Найгарячіші вузли після розділення кластерів на ≥4м:

{table(['Координати X,Z','Шляхи через комірку','Частка756пар'],heatRows)}

Очікувані точки зіткнень — входи на MID, вихідні повороти й обхід фонтана. Теплокарта — геометрична евристика; вона не враховує ризик, супротивника, дим, бажання фланкувати чи альтернативні шляхи однакової довжини.

![Теплокарта](toy-town-heatmap.png)

## Контраст персонажів

**990** CIE76-порівнянь: 33 main body ×10зон ×3 найпоширеніші унікальні кольори. D65/sRGB, без освітлення рендера. Частота кольорів оцінена площею верхніх і бічних граней, обрізаною межами зони; прихована базова підлога виключена. Main body взято з незміненого `config.colors.body`. Темні контури, окуляри й аксесуари в цю просту метрику не входять.

Поріг **ΔE<15**. Знайдено **{warnings} пар для {warningCharacters} персонажів**. Усі перелічені нижче. Це попередження; персонажі не перефарбовувались. Найбільша проблема лишається у світлих NFT на світлій підлозі. [Повна CSV-таблиця](contrast-990.csv).

{flags}

{'\n'.join(contrastTables)}

## Бюджет і перевірки

{table(['Ресурс','Реальна верхня межа'],[['Логічні блоки / з обведенням і чанками',f"{s['boxes']} / {s['renderBoxes']}"],['Трикутники всієї карти',f"{s['triangles']:,} / 120000"],['Основні draw calls',f"{s['drawCalls']} / 60"],['Чанки / групи інстансів / інстанси',f"{s['chunks']} / {s['instancedPrefabs']} / {s['instances']}"],['Один прохід тіней карти',f"до +{s['shadowChunks']} викликів"],['Матеріали карти','1 спільний Lambert vertex-colour'],['Колайдери / shot blockers',f"{s['colliders']} / {s['shotBlockers']}"],['Зв’язна площа',f"{v['navigation']['ratio']*100:.3f}%"],['Недоступні спавни / лут / зони','0 / 0 / 0']])}

Ці лічильники стосуються карти; еталонний персонаж має власні схвалені меші. Палітри попередньо кешуються, у кадрі показана одна група. Перемикання не перебудовує геометрію чи матеріали. Навігація, Lab і простріли виконуються офлайн, input повзунка лише оновлює висоту та запитує кадр.

{table(['Перевірка','Результат'],[[p['name'],'PASS' if p['pass'] else 'FAIL'] for p in v['checks']])}

```text
M2 geometry SHA-256 {v['sha256']}
```

M1-хеш збережено окремо. Збирання двічі, спільна геометрія, старі/нові палітри з однаковою формою, dispose і повторна побудова перевірені. `{len(protected)}` затверджених файлів персонажів/зброї/package.json побайтово незмінні; п’ять API/інфраструктурних файлів збігаються з M1.

## PNG

![M2 огляд](toy-town-overview.png)
![План](toy-town-plan.png)
![Чотири точки](toy-town-four-views.png)

[Спавн A](toy-town-spawn-a.png) · [Спавн B](toy-town-spawn-b.png) · [MID](toy-town-mid.png) · [Балкон](toy-town-balcony.png) · [Стара палітра на геометрії M2](toy-town-overview-legacy.png)

## Запуск і файли

```sh
npm run dev -- --port 5174
node src/maps/color-guard.mjs
node src/maps/verify.mjs
npm run build
python src/maps/tools/report_m2.py
```

Архів: `outputs/toy-town-m2-source.zip`. Незмінний публічний API — `src/maps/index.ts`. Файли M2 й заморожені докази:

{sourceFiles}

Невизначеність: дискретні промені/капсула й горизонтальна вартість шляху не замінюють перевірку Rapier та ігровий тест; camp і heat — описані евристики. Для власника лишаються три явні питання балансу: low-contrast NFT, майже виключний трафік MID та перенесені FFA-точки. Роботу зупинено до схвалення.
'''
(OUT/'REPORT.md').write_text(text,encoding='utf-8')
print('M2 report:',OUT/'REPORT.md',';',warnings,'contrast flags')
