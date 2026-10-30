/// <reference types="vite/client" />
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { characters } from './characters';
import { createCharacter, disposeCharacterResources } from './createCharacter';
import { poseCharacter, restoreReferencePose } from './poseCharacter';
import type { CharacterRuntime, PoseState } from './types';
import './preview.css';

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const viewport = $('#viewport');
const stage = $('.stage');
const grid = $('#character-grid');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.domElement.setAttribute('aria-label', '3D персонажі: сітка або обертовий перегляд вибраної моделі.');
renderer.domElement.tabIndex = 0;
viewport.append(renderer.domElement);
$('#loading').remove();

const scene = new THREE.Scene();
scene.background = new THREE.Color('#EEECE5');
scene.fog = new THREE.Fog('#EEECE5', 8, 18);
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
const gridCamera = new THREE.OrthographicCamera(-1.5, 1.5, 1.5, -1.5, 0.1, 40);
gridCamera.position.set(-4.0, 3.2, -6.6);
gridCamera.lookAt(0, 1.03, 0);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.98, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.09;
controls.enablePan = false;
controls.minDistance = 2.7;
controls.maxDistance = 8;
controls.maxPolarAngle = Math.PI / 2 + 0.04;
controls.autoRotateSpeed = 1.1;
// Lambert's 1/PI factor: PI ambient reproduces sampled sRGB colors.
const ambient = new THREE.AmbientLight(0xffffff, Math.PI);
scene.add(ambient);
const key = new THREE.DirectionalLight(0xfff5e8, 0);
key.position.set(-3, 7, -4);
key.castShadow = false;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -3; key.shadow.camera.right = 3;
key.shadow.camera.top = 3; key.shadow.camera.bottom = -3;
key.shadow.normalBias = 0.025;
scene.add(key);
const groundMaterial = new THREE.MeshLambertMaterial({ color: '#E4E2D9' });
const ground = new THREE.Mesh(new THREE.BoxGeometry(30, 0.025, 30), groundMaterial);
ground.position.y = -0.0675; ground.receiveShadow = true; scene.add(ground);
const floorGrid = new THREE.GridHelper(18, 60, '#C3C8B8', '#D1D5C6');
floorGrid.position.y = -0.053;
(floorGrid.material as THREE.Material).transparent = true;
(floorGrid.material as THREE.Material).opacity = 0.25;
scene.add(floorGrid);
const platformMaterial = new THREE.MeshLambertMaterial({ color: '#F6F4EB' });
const platform = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.05, 2.0), platformMaterial);
platform.position.y = -0.027; platform.receiveShadow = true; scene.add(platform);
const guide = new THREE.Group();
const guideMaterial = new THREE.MeshLambertMaterial({ color: '#B9C1AA' });
for (const [w, h, x, y] of [[0.004, 1.8, -1.02, 0.9], [0.08, 0.004, -0.98, 1.8], [0.08, 0.004, -0.98, 0]]) {
  const tick = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.004), guideMaterial);
  tick.position.set(x, y, 0); guide.add(tick);
}
scene.add(guide);
const labelPosition = new THREE.Vector3();
const heightLabel = $('#height-label');
const instances = characters.map(createCharacter);
for (const character of instances) scene.add(character);
const baseline = (instances[0].userData as CharacterRuntime).bodyExtents;
let selected = 0;
let gridMode = true;
let referenceMode = true;
let activePose = 'reference';
let activeView = 'perspective';
let paletteLight = true;
let paused = false;
const state: PoseState = { speed: 0, moveDir: { x: 0, z: -1 }, aimPitch: 0,
  shooting: false, crouching: false, grounded: true, dead: false };
const select = $<HTMLSelectElement>('#character-select');
select.replaceChildren(); grid.replaceChildren();
const cards: HTMLButtonElement[] = [];
const cardViews: HTMLElement[] = [];
const meshStats = instances.map((g) => {
  let meshes = 0, triangles = 0, glows = 0;
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      meshes++; triangles += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3;
      if (o.material instanceof THREE.MeshBasicMaterial) glows++;
    }
  });
  return { meshes, triangles, glows };
});
for (let i = 0; i < characters.length; i++) {
  const config = characters[i];
  const option = document.createElement('option');
  option.value = String(i);
  option.textContent = `${String(i + 1).padStart(2, '0')} — ${config.name}`;
  select.append(option);
  const card = document.createElement('button');
  card.className = 'grid-card';
  card.dataset.characterId = config.id;
  card.dataset.meshes = String(meshStats[i].meshes);
  card.setAttribute('aria-label', `Відкрити ${config.name}`);
  const view = document.createElement('span'); view.className = 'card-viewport';
  const number = document.createElement('span'); number.className = 'card-number'; number.textContent = String(i + 1).padStart(2, '0');
  const open = document.createElement('span'); open.className = 'card-open'; open.textContent = '↗';
  const caption = document.createElement('span'); caption.className = 'card-caption';
  const name = document.createElement('span'); name.className = 'card-name'; name.textContent = config.name;
  const meta = document.createElement('span'); meta.className = 'card-meta';
  const verified = document.createElement('span'); verified.className = 'verified'; verified.textContent = i === 0 ? '01 · БЕЗ ЗМІН' : '1,80 м';
  const count = document.createElement('span'); count.textContent = `${meshStats[i].meshes} мешів`;
  const extra = document.createElement('span'); extra.textContent = meshStats[i].glows ? `${meshStats[i].glows} glow` : config.flags?.length ? 'Є припущення' : 'Baseline';
  meta.append(verified, count, extra); caption.append(name, meta);
  card.append(view, number, open, caption); grid.append(card);
  card.addEventListener('click', () => selectCharacter(i));
  cards.push(card); cardViews.push(view);
}
$('#collection-count').textContent = `${characters.length} ГОТОВІ`;
$('#built-count').textContent = `${characters.length} ГОТОВІ / ${33 - characters.length} ОЧІКУЮТЬ`;

const labels: Record<string, string> = { body: 'Корпус', top: 'Верх', outline: 'Контур', lens: 'Лінзи',
  frame: 'Оправа', eye: 'Очі', eyes: 'Очі', antenna: 'Антени', antennaTop: 'Верх антен', glove: 'Рукавиці',
  gloveTop: 'Верх рукавиць', chest: 'Нагрудник', side: 'Бік', dark: 'Темний', light: 'Світлий',
  lightSide: 'Світлий бік', trim: 'Акцент', hat: 'Шапка', hatTop: 'Верх шапки', hatSide: 'Бік шапки',
  glowChest: 'Світні груди', headObserved: 'Голова (зразок)', headTopObserved: 'Верх (зразок)', noseTopObserved: 'Верх накладки' };
function updateDetails(): void {
  const config = characters[selected];
  const data = instances[selected].userData as CharacterRuntime;
  const ext = data.bodyExtents;
  const palette = $('#palette'); palette.replaceChildren();
  const shown = new Set<string>();
  for (const [key, color] of Object.entries(config.colors)) {
    if (shown.has(color)) continue; shown.add(color);
    const row = document.createElement('div'); row.className = 'swatch-row';
    const swatch = document.createElement('span'); swatch.className = 'swatch'; swatch.style.backgroundColor = color;
    const label = document.createElement('span'); label.className = 'swatch-label'; label.textContent = labels[key] ?? key; label.title = label.textContent;
    const hex = document.createElement('span'); hex.className = 'swatch-hex'; hex.textContent = color;
    row.append(swatch, label, hex); palette.append(row);
  }
  $('#body-width').textContent = `${(ext.total.width / baseline.total.width).toFixed(3)}×`;
  $('#body-depth').textContent = `${(ext.total.depth / baseline.total.depth).toFixed(3)}×`;
  $('#head-width').textContent = `${ext.headBox.width.toFixed(3)} м`;
  $('#head-depth').textContent = `${ext.headBox.depth.toFixed(3)} м`;
  $('#mesh-count').textContent = String(meshStats[selected].meshes);
  $('#triangle-count').textContent = meshStats[selected].triangles.toLocaleString('uk-UA');
  $('#flags').replaceChildren();
  for (const flag of config.flags ?? []) {
    const li = document.createElement('li'); li.textContent = flag; $('#flags').append(li);
  }
  $('#flag-summary').textContent = selected === 0 ? '01: хеші геометрії збережені' : `Припущення: ${config.flags?.length ?? 0}`;
  cards.forEach((card, i) => card.classList.toggle('selected', i === selected));
}
function title(): void {
  $('#stage-eyebrow').textContent = gridMode ? 'ПОВНА КОЛЕКЦІЯ / ФАЗА 2' : `ПЕРСОНАЖ / ${String(selected + 1).padStart(3, '0')}`;
  const name = $('#stage-name');
  name.textContent = gridMode ? `${characters.length} силуети.` : characters[selected].name;
  name.classList.toggle('long-name', !gridMode && selected !== 0);
  $('#stage-description').textContent = gridMode ? 'Один зріст. Різні пропорції. Натисніть на модель.' : 'Потягніть, щоб обертати. Перевірте всі ракурси.';
}
function setGrid(value: boolean): void {
  gridMode = value;
  stage.classList.toggle('grid-mode', value);
  $('#show-grid').setAttribute('aria-pressed', String(value));
  controls.enabled = !value;
  controls.autoRotate = false;
  $('#auto-rotate').setAttribute('aria-pressed', 'false');
  $('#auto-rotate').classList.remove('active');
  title(); resize();
}
function selectCharacter(i: number): void {
  selected = i; select.value = String(i);
  setGrid(false); setPose('reference'); updateDetails(); setView('perspective');
}
select.addEventListener('change', () => selectCharacter(Number(select.value)));
$('#show-grid').addEventListener('click', () => setGrid(!gridMode));
function updateUI(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-pose]').forEach((button) => {
    const active = button.dataset.pose === activePose;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  });
  $<HTMLInputElement>('#speed').value = String(state.speed);
  $('#speed-value').textContent = state.speed.toFixed(2);
  const degrees = Math.round(THREE.MathUtils.radToDeg(state.aimPitch));
  $<HTMLInputElement>('#aim').value = String(degrees); $('#aim-value').textContent = `${degrees}°`;
  $('#shoot').setAttribute('aria-pressed', String(state.shooting));
  $('#pose-label').textContent = referenceMode ? 'REF' : state.dead ? 'DEAD' : 'LIVE';
  $('#animation-status').textContent = referenceMode ? 'Нерухома поза для звірки' : gridMode ? 'Спільний стан усіх моделей' : 'Поза через poseCharacter()';
  document.querySelectorAll<HTMLButtonElement>('[data-dir]').forEach((button) => {
    const dir = button.dataset.dir;
    const active = dir === 'left' ? state.moveDir.x < 0 : dir === 'right' ? state.moveDir.x > 0 : dir === 'forward' ? state.moveDir.z < 0 : state.moveDir.z > 0;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  });
}
function setPose(pose: string): void {
  activePose = pose; referenceMode = pose === 'reference';
  state.speed = 0; state.moveDir.x = 0; state.moveDir.z = -1;
  state.crouching = false; state.grounded = true; state.dead = false; state.shooting = false;
  if (referenceMode) state.aimPitch = 0;
  if (pose === 'run') state.speed = 1;
  if (pose === 'strafe') { state.speed = 0.8; state.moveDir.x = 1; state.moveDir.z = 0; }
  if (pose === 'backward') { state.speed = 0.75; state.moveDir.z = 1; }
  if (pose === 'crouch') state.crouching = true;
  if (pose === 'jump') state.grounded = false;
  if (pose === 'dead') state.dead = true;
  for (const g of instances) {
    g.position.set(0, 0, 0);
    if (referenceMode) restoreReferencePose(g); else poseCharacter(g, state, 0);
  }
  controls.target.x = state.dead ? 0.65 : 0;
  gridCamera.lookAt(state.dead ? 0.65 : 0, 1.03, 0);
  updateUI();
}
document.querySelectorAll<HTMLButtonElement>('[data-pose]').forEach((button) => button.addEventListener('click', () => setPose(button.dataset.pose!)));
$('#shoot').addEventListener('click', () => {
  if (referenceMode || state.dead) setPose('idle'); state.shooting = !state.shooting; updateUI();
});
$('#speed').addEventListener('input', (event) => {
  const speed = Number((event.target as HTMLInputElement).value);
  if (referenceMode || state.dead) setPose('idle'); state.speed = speed; updateUI();
});
$('#aim').addEventListener('input', (event) => {
  const pitch = Number((event.target as HTMLInputElement).value);
  if (referenceMode) setPose('idle'); state.aimPitch = THREE.MathUtils.degToRad(pitch); updateUI();
});
document.querySelectorAll<HTMLButtonElement>('[data-dir]').forEach((button) => button.addEventListener('click', () => {
  if (referenceMode || state.dead) setPose('run');
  const direction = button.dataset.dir;
  state.moveDir.x = direction === 'right' ? 1 : direction === 'left' ? -1 : 0;
  state.moveDir.z = direction === 'backward' ? 1 : direction === 'forward' ? -1 : 0; updateUI();
}));
function setView(view: string): void {
  activeView = view;
  controls.autoRotate = false;
  $('#auto-rotate').setAttribute('aria-pressed', 'false'); $('#auto-rotate').classList.remove('active');
  controls.target.set(state.dead ? 0.65 : 0, 0.98, 0);
  if (view === 'front') camera.position.set(0, 2.95, -4.45);
  else if (view === 'back') camera.position.set(0, 2.95, 4.45);
  else if (view === 'left') camera.position.set(-4.45, 2.95, 0);
  else if (view === 'right') camera.position.set(4.45, 2.95, 0);
  else if (view === 'top') camera.position.set(0, 5.3, -0.001);
  else camera.position.set(-2.75, 2.75, -4.25);
  controls.update();
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === view); button.setAttribute('aria-pressed', String(button.dataset.view === view));
  });
}
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view!)));
controls.addEventListener('start', () => {
  activeView = 'orbit'; document.querySelectorAll('[data-view]').forEach((button) => button.classList.remove('active'));
});
$('#auto-rotate').addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  $('#auto-rotate').setAttribute('aria-pressed', String(controls.autoRotate)); $('#auto-rotate').classList.toggle('active', controls.autoRotate);
});
$('#palette-light').addEventListener('click', () => {
  paletteLight = !paletteLight;
  ambient.intensity = paletteLight ? Math.PI : 1.85; key.intensity = paletteLight ? 0 : 2.3;
  key.castShadow = !paletteLight;
  $('#palette-light').classList.toggle('active', paletteLight); $('#palette-light').setAttribute('aria-pressed', String(paletteLight));
});
function resize(): void {
  const { width, height } = viewport.getBoundingClientRect();
  const maxSize = renderer.capabilities.maxTextureSize;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5, maxSize / Math.max(width, height)));
  renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
}
const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(viewport);
let renderCalls = 0;
function renderScene(): void {
  const rect = viewport.getBoundingClientRect();
  renderer.setScissorTest(false); renderer.setViewport(0, 0, rect.width, rect.height); renderer.clear();
  renderCalls = 0;
  if (gridMode) {
    guide.visible = false; heightLabel.hidden = true;
    renderer.setScissorTest(true);
    for (let i = 0; i < instances.length; i++) {
      for (let j = 0; j < instances.length; j++) instances[j].visible = i === j;
      const r = cardViews[i].getBoundingClientRect();
      const x = r.left - rect.left, y = rect.bottom - r.bottom;
      renderer.setViewport(x, y, r.width, r.height); renderer.setScissor(x, y, r.width, r.height);
      const halfH = 1.6 + Math.abs(state.aimPitch) * 0.16, aspect = r.width / r.height;
      gridCamera.left = -halfH * aspect; gridCamera.right = halfH * aspect;
      gridCamera.top = halfH; gridCamera.bottom = -halfH; gridCamera.updateProjectionMatrix();
      renderer.render(scene, gridCamera); renderCalls += renderer.info.render.calls;
    }
    renderer.setScissorTest(false);
  } else {
    for (let j = 0; j < instances.length; j++) instances[j].visible = j === selected;
    guide.visible = !state.dead && !state.crouching && state.grounded && activeView !== 'top';
    heightLabel.hidden = !guide.visible;
    if (guide.visible) {
      labelPosition.set(-1.06, 0.90, 0).project(camera);
      heightLabel.style.left = `${(labelPosition.x * 0.5 + 0.5) * rect.width - 8}px`;
      heightLabel.style.top = `${(-labelPosition.y * 0.5 + 0.5) * rect.height}px`;
    }
    renderer.render(scene, camera); renderCalls = renderer.info.render.calls;
  }
}
// Actual WebGL renders in a compact export layout, independent of window width.
$('#export-grid').addEventListener('click', () => {
  setGrid(true);
  const columns = 6, cardW = 300, viewH = 280, captionH = 86, gap = 16, margin = 28, header = 126;
  const canvas = document.createElement('canvas');
  canvas.width = margin * 2 + cardW * columns + gap * (columns - 1);
  canvas.height = header + Math.ceil(characters.length / columns) * (viewH + captionH + gap) + margin;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#EEECE5'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#292B29'; context.font = '600 32px Segoe UI, sans-serif';
  context.fillText(`Контрольна сітка · ${characters.length} моделей`, margin, 49);
  context.fillStyle = '#7D8570'; context.font = '13px Segoe UI, sans-serif';
  context.fillText('01 без змін · усі 32 оригінали побудовані · до 8 мешів на персонажа', margin + 1, 77);
  context.fillText('1,80 м від стоп до head-box · extras не входять у габарити тіла', margin + 1, 99);
  renderer.setScissorTest(false); renderer.setPixelRatio(1.5); renderer.setSize(cardW, viewH, false);
  guide.visible = false;
  const halfH = 1.6 + Math.abs(state.aimPitch) * 0.16;
  gridCamera.left = -halfH * cardW / viewH; gridCamera.right = halfH * cardW / viewH;
  gridCamera.top = halfH; gridCamera.bottom = -halfH; gridCamera.updateProjectionMatrix();
  for (let i = 0; i < cards.length; i++) {
    for (let j = 0; j < instances.length; j++) instances[j].visible = i === j;
    renderer.setViewport(0, 0, cardW, viewH); renderer.render(scene, gridCamera);
    const x = margin + i % columns * (cardW + gap), y = header + Math.floor(i / columns) * (viewH + captionH + gap);
    context.drawImage(renderer.domElement, x, y, cardW, viewH);
    const captionY = y + viewH;
    context.fillStyle = '#FAF9F5'; context.fillRect(x, captionY, cardW, captionH);
    context.strokeStyle = '#D3D7C9'; context.strokeRect(x, y, cardW, viewH + captionH);
    context.font = '600 12px Segoe UI, sans-serif'; context.fillStyle = '#343B2E';
    context.fillText(characters[i].name, x + 16, captionY + 26);
    context.font = '12px Segoe UI, sans-serif'; context.fillStyle = '#7A856B';
    context.fillText(`${meshStats[i].meshes} мешів · ${meshStats[i].glows} glow · ${i ? 'є припущення' : 'baseline збережено'}`, x + 16, captionY + 49);
    const body = (instances[i].userData as CharacterRuntime).bodyExtents;
    context.font = '11px Consolas, monospace';
    context.fillText(`W/01 ${(body.total.width / baseline.total.width).toFixed(3)}x   D/01 ${(body.total.depth / baseline.total.depth).toFixed(3)}x`, x + 16, captionY + 69);
  }
  resize(); renderScene();
  let anchor = document.querySelector<HTMLAnchorElement>('#export-result');
  if (!anchor) {
    anchor = document.createElement('a'); anchor.id = 'export-result'; anchor.className = 'icon-button';
    anchor.textContent = 'PNG готовий ↗'; $('.viewport-top-actions').append(anchor);
  }
  anchor.download = 'voxel-full-collection.png'; anchor.href = canvas.toDataURL('image/png');
});
let previousTime = 0, statsTime = 0, frames = 0;
function frame(time: number): void {
  const dt = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0; previousTime = time;
  if (!referenceMode && !paused) for (const g of instances) {
    poseCharacter(g, state, dt); g.position.y = !state.grounded && !state.dead ? 0.18 : 0;
  }
  if (!gridMode) controls.update(dt);
  renderScene(); frames++;
  if (time - statsTime > 1000) {
    $('#runtime-stats').textContent = `${Math.round(frames * 1000 / (time - statsTime))} FPS · ${renderCalls} DRAW CALLS`;
    frames = 0; statsTime = time;
  }
}
setView('perspective'); setGrid(new URLSearchParams(location.search).get('grid') !== '0');
updateDetails(); updateUI(); resize();
renderer.setAnimationLoop(frame);
Object.assign(window, { characterPreview: {
  get character() { return instances[selected]; }, instances, state, scene, camera, renderer, controls,
  setPose, setView, setGrid, selectCharacter, setPaused(value: boolean) { paused = value; }, render: renderScene,
  get data() { return instances[selected].userData as CharacterRuntime; },
} });
if (import.meta.hot) import.meta.hot.dispose(() => {
  renderer.setAnimationLoop(null); resizeObserver.disconnect(); controls.dispose();
  ground.geometry.dispose(); platform.geometry.dispose(); floorGrid.geometry.dispose();
  (floorGrid.material as THREE.Material).dispose();
  guide.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
  groundMaterial.dispose(); platformMaterial.dispose(); guideMaterial.dispose();
  disposeCharacterResources(); renderer.dispose(); renderer.domElement.remove();
});
