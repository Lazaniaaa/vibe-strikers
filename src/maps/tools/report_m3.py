"""Publish the measured M3 review pack. Never changes geometry or baselines."""
from pathlib import Path
import json,csv,hashlib
ROOT=Path(__file__).resolve().parents[3];MAP=ROOT/'src/maps';OUT=ROOT/'outputs/toy-town-m3';OUT.mkdir(parents=True,exist_ok=True)
def read(p):return json.loads(p.read_text(encoding='utf-8'))
options=read(MAP/'data/m3-options.json');reports=[read(MAP/f"reports/m3/{v['id']}.json")for v in options['variants']]
old=read(MAP/'baselines/m2-report.json');old_a=read(MAP/'reports/m2/after.json')
before=read(MAP/'reports/m3/before.json') if (MAP/'reports/m3/before.json').exists() else None
def cover_count(id,lane):
 d=read(MAP/f'data/{id}.json');boxes=list(d['boxes'])
 for ins in d['instances']:
  quarter=round(ins['yaw']/(3.141592653589793/2))%4
  for b in d['prefabs'][ins['prefab']]:
   x,z=[(b['x'],b['z']),(b['z'],-b['x']),(-b['x'],-b['z']),(-b['z'],b['x'])][quarter]
   boxes.append(dict(b,x=x+ins['x'],y=b['y']+ins['y'],z=z+ins['z']))
 def inside(b):
  x=abs(b['x']);z=b['z']*(1 if lane=='LEFT' else -1)
  return 11.6<=x<=23.3 and 0<=z<=33.25 or 23.3<=x<=33.25 and 9.1<=z<=33.25 or x<=11.6 and (23.5 if lane=='LEFT' else 18.2)<=z<=33.25
 return sum(b['collide'] and b['kind'] not in ['floor','stair'] and b['y']-b['h']/2<.1 and .9<=b['y']+b['h']/2<=2.5 and inside(b) for b in boxes)
lines=[]
def add(s=''):lines.append(s)
def table(headers,rows):
 add('| '+' | '.join(headers)+' |');add('| '+' | '.join(['---']*len(headers))+' |')
 for row in rows:add('| '+' | '.join(str(x).replace('|','/')for x in row)+' |')
 add()
def f(n):return f'{n:.2f}'
def point(p):return f"({p['x']:.2f}; {p.get('y',0):.2f}; {p['z']:.2f})"
add('# Toy Town · M3 — чотири комбінації для вибору')
add('Новий творчий M3 замінює попереднє детальне завдання. LEFT — північний маршрут M2 (+Z), RIGHT — південний (−Z). Команди стоять при X=±28,5; геометрія дзеркальна за X. Чотири JSON містять повні незалежні MapData з тим самим форматом. M2 збережено окремо як `toy-town`.')
add()
add('## Варіанти — по три рядки')
for id,o in options['designs'].items():
 add(f"### {id} · {o['name']}")
 for line in o['lines']:add(line+'  ')
 add()
add('L1 має послідовні кімнати та зміщені двері. L2 має відкритішу сортувальну залу й окрему експедицію. R1 лишає площу під тентами відкритою; R2 вводить критий павільйон. У кожного варіанта є двір, основне місце бою, задня площадка та внутрішній/зовнішній обхід. Тераси RIGHT піднято на 0,6 м, три сходинки по 0,2 м. Схвалені балкони та галерея +2,5 м збережені.')
add()
table(['Комбінація','Прев’ю','Дані'],[[r['left']+' / '+r['right'],f"[відкрити](http://127.0.0.1:5174/?map=1&left={r['left']}&right={r['right']})",f"[MapData](../../src/maps/data/{r['id']}.json)"]for r in reports])
add('У прев’ю є два незалежні селектори, порівняння з M2, обидві палітри, шість нових камер на рівні очей та експорт PNG. План M3 показує кімнати без дахів; тривимірна карта має всі дахи. Позначки L·1/2/3 та R·1/2/3 відповідають місцям у селекторі камер.')
add()
add('## До / після — фактичні числа')
cols=['M2']+[r['left']+'/'+r['right']for r in reports]
rows=[]
rows.append(['Зв’язність усіх nav-вузлів, %',f(old['navigation']['ratio']*100)]+[f(r['navigation']['ratio']*100)for r in reports])
for i,id in enumerate(['MID','LEFT','RIGHT']):rows.append([id+' маршрут, м',f(old['navigation']['plannedRoutes'][i]['length'])]+[f(r['navigation']['plannedRoutes'][i]['length'])for r in reports])
for i,id in enumerate(['LEFT','RIGHT']):rows.append([id+' найбільший простріл, м',f(before['lanes'][i]['longest']) if before else 'див. M2']+[f(r['lanes'][i]['longest'])for r in reports])
rows += [
 ['Блоків MapData',old['stats']['boxes']]+[r['stats']['boxes']for r in reports],
 ['Блоків з контурами / розбиттям на чанки',old['stats']['renderBoxes']]+[r['stats']['renderBoxes']for r in reports],
 ['Трикутників',old['stats']['triangles']]+[r['stats']['triangles']for r in reports],
 ['Draw calls карти',old['stats']['drawCalls']]+[r['stats']['drawCalls']for r in reports],
 ['Чанків / shadow-чанків','36 / 6']+[f"{r['stats']['chunks']} / {r['stats']['shadowChunks']}"for r in reports],
 ['Найдовший огляд спавну з ворожої половини, м',f(max(s['longest']for s in old_a['spawnSight']))]+[f(max(s['longest']for s in r['audit']['spawnSight']))for r in reports],
]
for lane in ['LEFT','RIGHT']:
 old_count=before['coverCounts'][lane] if before else '—'
 rows.append([lane+' низьких укриттів (блоків)',old_count]+[cover_count(r['id'],lane)for r in reports])
 rows.append([lane+' максимальний інтервал укриття/кутка, м','—']+[f(next(c['conservativeSpacing']for c in r['cadence']if c['id']==lane))for r in reports])
table(['Показник']+cols,rows)
add('Бюджет перевіряє і логічні блоки, і блоки після побудови контурів: обидва значення ≤3500. Трикутники підраховано з індексів реальних BufferGeometry з урахуванням кількості інстансів. Draw calls — усі меші карти, включно з інстансами; максимум шість чанків додатково малюються в shadow pass. Персонаж масштабу в бюджет карти не входить.')
add()
add('## Що збережено')
c=next(c for c in reports[0]['checks']if c['name'].startswith('MID, big house'))['value']
add(f"У кожному варіанті перевірено точне збереження {c['boxes']} вихідних блоків і {c['instances']} інстансів: MID, фонтан, великий смугастий будинок, обидві початкові системи сходів, спавн-кімнати, їхні двері, межі та покриття підлоги. SHA-256 канонічних захищених блоків: `{c['sha256']}`.")
add('Усі 28 спавнів (координати, висота та yaw), 20 лут-точок, bounds, killY, небо, туман, світло, palette та zones збігаються з M2. Вихідні блоки ринкової галереї не редагувалися; нові комори примикають до її заднього краю. Центральні задні вулиці отримали об’ємні комори й арки, які закривають поперечні простріли. Немає нових матеріалів або форм: той самий спільний Lambert з vertex colors, тільки бокси.')
guard=read(MAP/'reports/m3/source-guard.json')
add(f"Захист джерел: {guard['protectedFiles']} файлів персонажів/зброї/package не змінено. `types.ts`, `boxes.ts`, `buildMap.ts` та Vite config байтово тотожні M2. У `index.ts` лише реєстр отримав чотири id; сигнатури API й формат MapData збережено. `toy-town.json` M2 байтово тотожний `baselines/m2-data.json`.")
add()
add('## Результати verify')
table(['Перевірка']+cols[1:],[[c['name']]+['PASS'if next(x for x in r['checks']if x['name']==c['name'])['pass']else'FAIL'for r in reports]for c in reports[0]['checks']])
table(['Комбінація','SHA-256 геометрії'],[[r['left']+'/'+r['right'],f"`{r['sha256']}`"]for r in reports])
add('Базові SHA-256 записуються лише коли ВСІ чотири комбінації проходять усі перевірки. Повторна побудова ділить геометрії; перевірено обидві палітри, dispose та створення свіжих ресурсів. Спільна карта M2 проходить попередні 31 перевірку окремо.')
add()
add('## Як вимірювали')
add('Навігація: сітка 0,25 м, радіус капсули 0,5 м, висота 1,8 м / присідання 1,2 м. Реальні сходинки — початкові 0,25 м та нові 0,2 м; горизонтальна глибина нових 0,448 м. Аналіз допускає стрибок 1,2 м та крок контролера 0,30 м, як у M2. Висота нових кімнат щонайменше 4,525 м. Непрохідні комори позначені стінами; їхні дахи не видаються за walkable-платформи.')
add('MID — найкоротший шлях між (-28,5; −1) і (28,5; −1). Флангові довжини — найкоротші відрізки через справжні walkable-точки (±20; ±25), з переходом через будинок при Z=14,25 або ринковий прохід при Z=−18,5. Жодна точка маршруту не підмінюється пошуком на кілька метрів: допуск nearest — 0,3 м. Час — горизонтальна довжина / 4,8 м/с, без розгону й часу стрибка.')
add('Простріл SIDE: усі досяжні висоти, джерела через 0,5 м, 360 напрямків через 1°. Промінь тестує точні AABB; він закінчується на вході в схвалений центр або спавн-кімнату. Прямокутники вимірювання збережено в JSON. Повний простріл всієї карти теж наведено нижче — він може проходити через схвалений MID. Це дискретна перевірка, а не аналітичний доказ для кожного можливого кута.')
add('Інтервал укриття: на перевірених маршрутах знаходиться найдовша ділянка без низького укриття або кута будівлі в радіусі 1,5 м; додаються обидві зони підходу (3 м). Така консервативна відстань ≤8 м. Список низьких укриттів — наземні блоки висот 1,0/1,6/2,4 м; архітектурні кути враховуються окремо.')
add()
add('## Проходи, петлі та тупики')
for r in reports:
 add('### '+r['left']+'/'+r['right'])
 table(['Маршрут','Половина','Внутрішня/зовнішня гілка','Довжина, м'],[[p['lane'],p['half'],p['branch'],f(p['length'])]for p in r['loops']])
 add('Поперечні зв’язки LEFT↔RIGHT поза MID: '+', '.join(f"X={p['x']}, {p['width']:.1f} м завширшки, шлях {p['length']:.2f} м"for p in r['crossLane'])+'.')
 table(['Прохід <3 м','Вісь','Ширина, м','Висота, м','Тип'],[[point(p['position']),p['axis'],f(p['width']),f(p['height'])if p['height']is not None else'відкритий','присідання'if p['intentionalCrouch']else'звичайний']for p in r['audit']['chokes']['passages']])
 table(['Службовий закуток','Ширина','Глибина','Відкриті сторони','Спавнів видно'],[[point(p),f(p['width']),f(p['depth']),', '.join(p['openSides']),p['visibleSpawns']]for p in r['nooks']])
 add('По одному малому закутку на командну половину, обидва на LEFT; основні три місця кожного флангу мають внутрішню та зовнішню гілки. Закутки не дивляться на спавни. Єдиний низький наскрізний прохід — збережений 1,302 м під галереєю. Кімнати мають ≥4 м висоти, інші проходи ≥3 м.')
 add()
add('## Повторний аудит M2 — включно з поганими числами')
table(['Комбінація','Найкоротша / найдовша A→B, м','Повний LOS, м','Ранні незахищені клітини (усі 28)','Гравців зі знахідками','З них командних спавнів'],[[r['left']+'/'+r['right'],f(r['audit']['shortest']['length'])+' / '+f(r['audit']['longestShortest']['length']),f(r['navigation']['visibility']['longest']),r['audit']['earlySafety']['failures'],sum(p['failures']>0 for p in r['audit']['earlySafety']['bySpawn']),sum(p['failures']>0 and p['spawn']<12 for p in r['audit']['earlySafety']['bySpawn'])]for r in reports])
add('Увага: M3 виконує правило «жодного спавну не видно з >40 м», але НЕ зберігає сильнішу гарантію M2 про будь-які перші 3 секунди ходьби. Вище наведено всі виявлені клітини в радіусі Дейкстри 14,4 м, які прострілюються з балкона або з джерела довгого прострілу. Це позначено як ризик для вибору варіанта, а не приховано. Сітки джерел 1/2 м мають фіксовану фазу й не дають дзеркально однакових лічильників; симетрія самої геометрії перевіряється точно.')
add('Yaw спавнів залишено схваленим. Основна перевірка шукає прохідний 4-метровий вихід у конусі ±40°; не вимагає дивитися саме на новий єдиний найкоротший маршрут. Старі відхилення від найкоротшого маршруту та forwardWallDistance збережено в audit.spawnFacing і CSV.')
for r in reports:
 a=r['audit'];add('### '+r['left']+'/'+r['right']+' — огляд спавнів і camping top 10')
 worst=max(a['spawnSight'],key=lambda p:p['longest']);add(f"Найгірший спавн #{worst['index']} ({worst['team']}), {point(worst['from'])}: {worst['longest']:.2f} м до {point(worst['to']) if worst['to']else'—'}. Всі 28 джерел дивляться на кожну досяжну клітину ворожої половини через 0,25 м. Лут-порушень: {sum(p['violation']for p in a['loot'])}.")
 early=a['earlySafety']['worst']
 if early:add(f"Найраніший виявлений простріл: спавн #{early['spawn']} ({early['team']}), {early['time']:.3f} с / {early['pathDistance']:.3f} м ходьби; гравець {point(early['player'])}, джерело {point(early['from'])} ({early['from']['type']}).")
 table(['Спавн із ранніми прострілами','Клітин','Перший час, с'],[[p['spawn'],p['failures'],f(p['first']['time'])]for p in a['earlySafety']['bySpawn']if p['failures']])
 table(['Позиція','Power','Exposure','Power/Exposure','Намір'],[[point(c['position']),c['power'],c['exposure'],f(c['score']),c['reason']]for c in a['camping']])
 with (OUT/(r['id']+'-spawn-sight.csv')).open('w',encoding='utf-8-sig',newline='')as file:
  w=csv.writer(file);w.writerow(['index','team','fromX','fromY','fromZ','longest','targetX','targetY','targetZ','visibleEnemyCells'])
  for p in a['spawnSight']:w.writerow([p['index'],p['team'],p['from']['x'],p['from']['y'],p['from']['z'],p['longest'],*(p['to'][k]if p['to']else''for k in ['x','y','z']),p['visibleEnemyCells']])
 add()
add('## Теплокарти — де будуть сутички')
table(['Комбінація','MID/LEFT/RIGHT: перетин центральної гілки','MID/LEFT/RIGHT: торкнулися бічної зони','Пар усі / між половинами'],[[r['left']+'/'+r['right'],' / '.join(str(r['audit']['heatmap']['crossHalfUse'][k])for k in ['MID','LEFT','RIGHT']),' / '.join(str(r['audit']['heatmap']['crossHalfSideAreaUse'][k])for k in ['MID','LEFT','RIGHT']),'756 / 392']for r in reports])
add('Для чесного порівняння перетини центральних гілок рахуються в тих самих ділянках, що й у M2. Окремо наведено дотик до широкої бічної зони: він сам по собі не означає повний обхід флангом. Один шлях може торкатися кількох зон. У M2 усі 392 міжполовинні шляхи торкались MID, LEFT/RIGHT — 0. Колір PNG — частота проходу клітини найкоротшими шляхами всіх 28 спавнів, шкала логарифмічна. Сірий — доступна, але не використана клітина.')
add('Очікувані бої: виходи дворів, проходи між кімнатами LEFT, поворот під ринковою аркою та вузька бічна галерея RIGHT. Частини задніх дворів лишаються обхідними/лутовими місцями; найкоротші шляхи не є симуляцією реальної гри з предметами, суперниками й цілями.')
add()
add('## Контраст 33 персонажів')
add('CIE76 / Lab D65 між головним кольором тіла та трьома найпоширенішими кольорами поверхонь кожної з 10 зон. Площа — видимі верхні/бічні площини, обрізані зоною; спільна прихована базова підлога не рахується. ΔE<15 позначено `!`. Персонажі не змінювались. Таблиці нижче показують найменшу ΔE з трьох кольорів; CSV містять усі 990 порівнянь кожної комбінації.')
for r in reports:
 c=r['contrast'];add('### '+r['left']+'/'+r['right'])
 table(['Зона','Три найпоширеніші кольори'],[[z['name'],', '.join(v['hex'] for v in z['colors'])]for z in c['zones']])
 zones=[z['name']for z in c['zones']];ids=list(dict.fromkeys(row['id']for row in c['rows']));by={(p['id'],p['zone']):p for p in c['rows']}
 table(['id','Колір']+zones,[[id,by[id,zones[0]]['body']]+[f(min(p['deltaE']for p in by[id,z]['pairs']))+(' !'if any(p['lowContrast']for p in by[id,z]['pairs'])else'')for z in zones]for id in ids])
 with (OUT/(r['id']+'-contrast-990.csv')).open('w',encoding='utf-8-sig',newline='')as file:
  w=csv.writer(file);w.writerow(['id','name','body','zone','mapColor','deltaE','lowContrast'])
  for row in c['rows']:
   for p in row['pairs']:w.writerow([row['id'],row['name'],row['body'],row['zone'],p['hex'],p['deltaE'],p['lowContrast']])
 flagged=list(dict.fromkeys(p['id']for p in c['flags']));add(f"Прапорців: {len(c['flags'])} пар; персонажі: "+', '.join(flagged)+'.')
 add()
add('## PNG')
add('![Чотири тривимірні огляди](overview-comparison.png)')
add('![Чотири плани](option-comparison.png)')
add('![Чотири місця](beat-comparison.png)')
for r in reports:
 id=r['id'];add('### '+r['left']+'/'+r['right'])
 add(f'[План]({id}-plan.png) · [Огляд]({id}-overview.png) · [10 точок огляду]({id}-contact.png) · [Теплокарта]({id}-heatmap.png)')
 add(f'![Теплокарта {id}]({id}-heatmap.png)');add()
add('## Що лишається невизначеним')
add('Головний ризик — ранні простріли з повторного M2-аудиту вище. Перед остаточним прийняттям потрібен ігровий тест з рухом, зброєю та кількома гравцями: heatmap не моделює вибір луту/цілей. Найближчі до ліміту sampled LOS — 24,98 м; перевірка дискретна. Низькоконтрастні пари перелічено без зміни схвалених персонажів. LEFT/RIGHT у цьому пакеті — маршрути +Z/−Z, а не командні половини X.')
add()
add('## Відтворення')
add('Змінені групи файлів: `src/maps/index.ts` (реєстр), чотири `data/toy-town-l*-r*.json` і `m3-options.json`, `audit.ts`, новий `lanes.ts`, `verify.mjs` / `verify-m3.mjs`, `preview/{index.html,main.ts,plan.ts,style.css}`, генератор/захист/звіт у `tools/`, M3 SHA-базові значення та звіти. `types.ts`, `boxes.ts`, `buildMap.ts`, Vite config і package не змінювались. Персонажі та зброя не змінювались.')
add('Нові PNG-камери — FOV 70 на рівні очей; початкові чотири — FOV 42. Shadow normalBias прев’ю 0,08 прибирає self-shadow acne, не змінюючи дані освітлення карти. Зображення — прямі експорти Three.js / Canvas; колажі лише компонують ці PNG.')
add()
add('```text\npython src/maps/tools/design_m3.py\nnode src/maps/verify.mjs\nnpm run build\n```')
add('Для свідомої зміни геометрії: `node src/maps/verify-m3.mjs --write-baseline`. Без прапорця будь-яке відхилення SHA завершується помилкою. Реєстр не змінює M2 за замовчуванням у грі; прев’ю за замовчуванням показує L1/R1. Після вибору власником можна окремо погодити заміну основного id. На цьому етапі всі чотири альтернативи залишені для порівняння.')
(OUT/'REPORT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print('M3 review report and 8 CSV tables written. All pass:',all(r['pass']for r in reports))
