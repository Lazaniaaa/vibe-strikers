import { AmbientLight, Color, DirectionalLight, Fog, HemisphereLight, Mesh, Vector3,
  NeutralToneMapping, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer, WebGLRenderTarget,
  type Group } from 'three';
import { characterDisplayName } from '../../src/config/characterNames';
import { characters, createCharacter, disposeCharacterResources, poseCharacter, prepareLobbyAnimation, playEmote, updateAnimation, LOBBY_EMOTES, BODY_HEIGHT, type LobbyEmoteId } from '../../src/characters';
import { attachWeapon, createWeapon, poseWeapon, type WeaponId } from '../../src/weapons';
import type { PoseState } from '../../src/characters/types';
import { nftTraits } from './nftArt';
import { buildLobbyScene, disposeLobbySceneResources, loadLobbyScene } from '../../src/maps/lobby';
import { MENU, RENDER, TEAM_COLORS } from '../../src/config/game';
import { createMenuSky } from './menuSky';
import type { MenuCharacter } from '../../src/ui/menu';

// CPU image cache survives menu re-entry; all GPU resources belong to a single menu lifetime.
interface Portrait { url: string; pixels: number }
const portraits = new Map<number, Portrait>();
export function menuCharacters(): MenuCharacter[] {
  return characters.map(character => ({ name: characterDisplayName(character),
    body: character.colors.body, accent: character.colors.glove ?? character.colors.outline, unlock: true }));
}
export interface MenuSceneOptions {
  host: HTMLElement; selected: number; debug: boolean;
  onPortrait: (index: number, url: string, pixels: number) => void;
  onStatus: (message: string) => void;
}
export interface MenuScene { select(index: number): void; /** Put `weapon:<id>` or an NFT skin in the character's hand (null = none). */ previewSkin(ref: string | null): void; dispose(): void }

export function createMenuScene(options: MenuSceneOptions): MenuScene {
  const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  const data = loadLobbyScene();
  const world = new Scene(), portraitScene = new Scene();
  const worldCamera = new PerspectiveCamera(MENU.world.fov, 1, MENU.world.near, MENU.world.far);
  const portraitCamera = new PerspectiveCamera(MENU.portrait.fov, 1, MENU.portrait.near, MENU.portrait.far);
  const sky = createMenuSky();
  const target = new WebGLRenderTarget(MENU.portrait.size, MENU.portrait.size);
  target.texture.colorSpace = SRGBColorSpace;
  const pixels = new Uint8Array(MENU.portrait.size * MENU.portrait.size * 4);
  const imageCanvas = document.createElement('canvas');
  imageCanvas.width = imageCanvas.height = MENU.portrait.size;
  const context = imageCanvas.getContext('2d')!;
  const image = context.createImageData(MENU.portrait.size, MENU.portrait.size);
  const heroTop = new Vector3(), heroFeet = new Vector3();
  const metrics = { fps: 0, calls: 0, triangles: 0, frames: 0, portraits: portraits.size, active: true, maxCpuMs: 0 };
  const output = options.host.closest('.menu')!.querySelector<HTMLOutputElement>('.menu-perf')!;
  output.hidden = !options.debug;
  let disposed = false, character: Group | null = null, selected = -1;
  let elapsed = 0, previous = 0, frameCount = 0, metricTime = 0, metricFrames = 0, portraitIndex = 0;
  let portraitTimer = 0;
  let portraitModel: Group | null = null;
  // Explicit debug capture runs only on a click, outside the animation callback.
  const reviewButton = options.debug ? document.createElement('button') : null;
  const reviewFrames = options.debug ? document.createElement('div') : null;
  const animationButton=options.debug?document.createElement('button'):null;
  const animationSheets=options.debug?document.createElement('div'):null;
  if(animationButton&&animationSheets){
    animationButton.className='menu-small-action';animationButton.textContent='Capture animation sheets';animationSheets.className='menu-animation-sheets';animationSheets.hidden=true;
    Object.assign(animationButton.style,{position:'absolute',left:MENU.animationReview.buttonLeft+'px',bottom:MENU.animationReview.buttonBottom+'px'});
    options.host.parentElement!.append(animationButton,animationSheets);
    animationButton.addEventListener('click',async()=>{animationButton.disabled=true;try{const {captureAnimationSheets}=await import('./menuAnimationReview');if(!disposed)await captureAnimationSheets(renderer,portraitScene,animationSheets,()=>!disposed);}finally{animationButton.disabled=false;}});
  }
  if (reviewButton && reviewFrames) {
    reviewButton.className = 'menu-small-action'; reviewButton.textContent = 'Capture shadow check';
    Object.assign(reviewButton.style, { position: 'absolute', left: MENU.review.buttonLeft + 'px', bottom: MENU.review.buttonBottom + 'px' });
    reviewFrames.className = 'menu-shadow-frames'; reviewFrames.hidden = true;
    options.host.parentElement!.append(reviewButton, reviewFrames);
    reviewButton.addEventListener('click', async () => {
      reviewButton.disabled = true; reviewFrames.replaceChildren();
      const started = performance.now();
      for (let i = 0; i < MENU.review.frames; i++) {
        const wait = Math.max(0, started + i * MENU.review.intervalMs - performance.now());
        if (wait) await new Promise<void>(resolve => window.setTimeout(resolve, wait));
        if (disposed) return;
        renderer.setRenderTarget(null); renderer.clear(); renderer.render(world, worldCamera);
        const image = document.createElement('img'); image.dataset.elapsedMs = (performance.now() - started).toFixed(2);
        image.src = renderer.domElement.toDataURL('image/png'); reviewFrames.append(image);
      }
      reviewButton.disabled = false;
    });
  }

  renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio, MENU.minPixelRatio), RENDER.maxPixelRatio, MENU.maxPixelRatio));
  renderer.toneMapping = NeutralToneMapping; renderer.toneMappingExposure = MENU.exposure;
  renderer.outputColorSpace = SRGBColorSpace; renderer.autoClear = false; renderer.info.autoReset = false;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.domElement.className = 'menu-canvas'; renderer.domElement.setAttribute('aria-label', 'Selected character on the floating lobby island');
  options.host.appendChild(renderer.domElement);
  world.fog = new Fog(MENU.sky.horizon, data.fog.near, data.fog.far);
  const bakeStart = performance.now();
  const island = buildLobbyScene({ teamColors: TEAM_COLORS });
  options.host.dataset.bakeMs = (performance.now() - bakeStart).toFixed(2);
  const clouds = island.getObjectByName('clouds')!;
  world.add(sky.mesh, island);
  const sun = addLights(world, true);
  addHeroLights(world);
  addLights(portraitScene, false);
  addHeroLights(portraitScene);
  portraitScene.background = new Color(MENU.palette.portrait);
  worldCamera.position.set(...MENU.world.position); worldCamera.lookAt(...MENU.world.target);
  portraitCamera.position.set(...MENU.portrait.position); portraitCamera.lookAt(...MENU.portrait.target);

  // NFT skin held by the lobby character: the hold pose replaces the lobby animation while it is shown.
  let skinRef: string | null = null, skinWeapon: Group | null = null, skinRequest = 0, introPlayed = false;
  const skinPose: PoseState = { weapon: 'rifle', speed: 0, moveDir: { x: 0, z: -1 }, aimPitch: 0, shooting: false, crouching: false, grounded: true, dead: false, fire: 0, reload: null, cycle: null };
  const skinIdle = { fire: 0, reload: null, cycle: null, equip: 1 };
  // Dragging on the scene turns the character around its vertical axis, nothing else.
  let dragYaw = 0, dragX: number | null = null;
  const canvas = renderer.domElement;
  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', event => { if (event.button !== 0) return; dragX = event.clientX; canvas.setPointerCapture(event.pointerId); canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('pointermove', event => {
    if (dragX === null) return;
    dragYaw += (event.clientX - dragX) * MENU.dragYawPerPixel;
    dragX = event.clientX;
    options.host.dataset.dragYaw = dragYaw.toFixed(3);
  });
  const endDrag = () => { dragX = null; canvas.style.cursor = 'grab'; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  const intro=()=>{if(character){const id=LOBBY_EMOTES[Math.floor(Math.random()*LOBBY_EMOTES.length)].id;playEmote(character,id);options.host.dataset.lastEmote=id;}};
  const select = (index: number) => {
    if (disposed || selected === index) return;
    const initial=!introPlayed;introPlayed=true;
    if (character) world.remove(character);
    selected = index; character = createCharacter(characters[index]);
    character.rotation.y = MENU.initialYaw;
    prepareLobbyAnimation(character);
    if(initial)intro();
    character.traverse(object => { if (object instanceof Mesh) { object.castShadow = true; object.receiveShadow = false; } });
    if (skinWeapon) attachWeapon(character, skinWeapon);
    world.add(character);
  };
  /** A fresh character: nothing of the old hold or lobby pose stays on it. */
  const rebuildCharacter = () => { const index = selected; selected = -1; if (index >= 0) select(index); };
  const previewSkin = (ref: string | null) => {
    if (disposed || ref === skinRef) return;
    skinRef = ref;
    dragYaw = 0; // each try-on starts from the angle that shows the weapon
    const request = ++skinRequest;
    if (!ref) { skinWeapon = null; rebuildCharacter(); return; }
    const hold = (weapon: Group, id: string) => {
      skinWeapon = weapon;
      skinWeapon.traverse(object => { if (object instanceof Mesh) object.castShadow = true; });
      skinPose.weapon = id as PoseState['weapon'];
      rebuildCharacter();
    };
    if (ref.startsWith('weapon:')) { const id = ref.slice('weapon:'.length) as WeaponId; hold(createWeapon(id), id); return; }
    void nftTraits(ref).then(traits => {
      if (disposed || request !== skinRequest || !traits) return;
      hold(createWeapon(traits.weapon, { skin: traits }), traits.weapon);
    }).catch(e => console.warn('NFT preview failed', e));
  };
  const resize = () => {
    if (disposed) return;
    const width = Math.max(1, options.host.clientWidth), height = Math.max(1, options.host.clientHeight);
    renderer.setSize(width, height, false);
    worldCamera.aspect = width / height;
    worldCamera.updateProjectionMatrix(); worldCamera.updateMatrixWorld();
    heroTop.set(0, BODY_HEIGHT, 0).project(worldCamera); heroFeet.set(0, 0, 0).project(worldCamera);
    options.host.dataset.heroHeightFraction = (Math.abs(heroTop.y - heroFeet.y) / 2).toFixed(3);
  };
  const observer = new ResizeObserver(resize); observer.observe(options.host);
  const frame = (time: number) => {
    if (disposed) return;
    const cpuStart = performance.now();
    const realDelta = previous ? Math.max(0, (time - previous) * MENU.timeScale) : 0;
    const dt = Math.min(realDelta, MENU.maxDelta);
    previous = time; elapsed += dt;
    if (character) { character.rotation.y = (skinWeapon ? MENU.skinPreviewYaw : MENU.initialYaw) + dragYaw + Math.sin(elapsed * MENU.turntableSpeed) * MENU.idleYawRange; if (skinWeapon) { poseCharacter(character, skinPose, dt); poseWeapon(skinWeapon, skinIdle, dt); } else updateAnimation(character, dt); }
    worldCamera.position.x = MENU.world.position[0] + Math.sin(elapsed * MENU.world.driftSpeed) * MENU.world.driftX;
    worldCamera.position.y = MENU.world.position[1] + Math.sin(elapsed * MENU.world.driftSpeed) * MENU.world.driftY;
    worldCamera.position.z = MENU.world.position[2] + Math.cos(elapsed * MENU.world.driftSpeed) * MENU.world.driftZ;
    worldCamera.lookAt(...MENU.world.target);
    clouds.position.x = Math.sin(elapsed * MENU.clouds.speed) * MENU.clouds.driftX;
    clouds.position.z = Math.sin(elapsed * MENU.clouds.speed) * MENU.clouds.driftZ;
    renderer.info.reset(); renderer.setRenderTarget(null); renderer.clear();
    renderer.render(world, worldCamera);
    // Queue at most one bounded portrait batch after this paint, outside the frame callback.
    if (!portraitTimer && portraitIndex < characters.length) portraitTimer = window.setTimeout(buildPortraits, MENU.portrait.intervalMs);
    frameCount++;
    if (frameCount > MENU.metrics.warmupFrames && realDelta > 0) { metricTime += realDelta; metricFrames++; }
    metrics.maxCpuMs = Math.max(metrics.maxCpuMs, performance.now() - cpuStart);
    if (metricTime >= MENU.metrics.interval) {
      metrics.fps = metricFrames / metricTime; metrics.calls = renderer.info.render.calls;
      metrics.triangles = renderer.info.render.triangles; metrics.frames = frameCount; metrics.portraits = portraits.size;
      if (options.debug) output.textContent = `${metrics.fps.toFixed(0)} FPS | ${metrics.calls} calls | ${metrics.triangles.toLocaleString()} tris | ${metrics.portraits}/${characters.length} portraits`;
      options.host.dataset.fps = metrics.fps.toFixed(2); options.host.dataset.calls = String(metrics.calls);
      options.host.dataset.triangles = String(metrics.triangles); options.host.dataset.portraits = String(metrics.portraits);
      options.host.dataset.animation=character?.userData.lobbyAnimation?.emote??'idle';
      metricTime = 0; metricFrames = 0;
    }
  };
  // Portrait generation is a bounded task outside the animation callback. It never rebuilds the overlay/world.
  const buildPortraits = () => {
    portraitTimer = 0;
    if (disposed) return;
    for (let count = 0; count < MENU.portrait.perBatch && portraitIndex < characters.length; count++) {
      while (portraitIndex < characters.length && portraits.has(portraitIndex)) portraitIndex++;
      if (portraitIndex >= characters.length) break;
      const index = portraitIndex++;
      portraitModel = createCharacter(characters[index]); portraitModel.rotation.y = MENU.portrait.yaw;
      prepareLobbyAnimation(portraitModel); updateAnimation(portraitModel, 0); portraitScene.add(portraitModel);
      renderer.setRenderTarget(target); renderer.clear(); renderer.render(portraitScene, portraitCamera);
      renderer.readRenderTargetPixels(target, 0, 0, MENU.portrait.size, MENU.portrait.size, pixels);
      renderer.setRenderTarget(null);
      // WebGL's origin is bottom-left; Canvas image rows start at the top.
      let contentPixels = 0;
      for (let pixel = 0; pixel < pixels.length; pixel += 4) {
        if (Math.abs(pixels[pixel] - pixels[0]) + Math.abs(pixels[pixel + 1] - pixels[1]) + Math.abs(pixels[pixel + 2] - pixels[2]) > MENU.portrait.pixelDelta) contentPixels++;
      }
      if (contentPixels < MENU.portrait.minimumPixels) throw new Error('Empty character portrait: ' + characters[index].id);
      const rowBytes = MENU.portrait.size * 4;
      for (let row = 0; row < MENU.portrait.size; row++) {
        const source = (MENU.portrait.size - row - 1) * rowBytes, destination = row * rowBytes;
        for (let byte = 0; byte < rowBytes; byte++) image.data[destination + byte] = pixels[source + byte];
      }
      context.putImageData(image, 0, 0);
      const url = imageCanvas.toDataURL('image/png'); portraits.set(index, { url, pixels: contentPixels }); options.onPortrait(index, url, contentPixels);
      portraitScene.remove(portraitModel); portraitModel = null;
    }
    options.host.dataset.portraits = String(portraits.size);
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true; metrics.active = false; renderer.setAnimationLoop(null);
    window.clearTimeout(portraitTimer); observer.disconnect();
    reviewButton?.remove(); reviewFrames?.remove();
    animationButton?.remove();animationSheets?.remove();
    options.host.parentElement!.removeEventListener('lobby-emote',onEmote);
    options.host.parentElement!.removeEventListener('lobby-character-selected',onCharacterSelected);
    renderer.domElement.removeEventListener('webglcontextlost', contextLost);
    world.clear(); portraitScene.clear();
    target.dispose(); sky.dispose(); sun.shadow.dispose();
    disposeLobbySceneResources(); disposeCharacterResources(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    options.host.dataset.scene = 'disposed';
  };
  const contextLost = (event: Event) => { event.preventDefault(); dispose(); options.onStatus('3D preview unavailable. You can still play.'); };
  const onEmote=(event:Event)=>{if(character){const id=(event as CustomEvent<LobbyEmoteId>).detail;playEmote(character,id);options.host.dataset.lastEmote=id;}};
  const onCharacterSelected=(event:Event)=>{if((event as CustomEvent<number>).detail===selected)intro();};
  options.host.parentElement!.addEventListener('lobby-emote',onEmote);
  options.host.parentElement!.addEventListener('lobby-character-selected',onCharacterSelected);
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  for (const [index, portrait] of portraits) options.onPortrait(index, portrait.url, portrait.pixels);
  options.host.dataset.portraits = String(portraits.size);
  select(options.selected); resize(); options.onStatus(''); options.host.dataset.scene = 'ready';
  renderer.setAnimationLoop(frame);
  return { select, previewSkin, dispose };
}

function addLights(scene: Scene, shadows: boolean): DirectionalLight {
  const light = MENU.light;
  scene.add(new AmbientLight(light.ambient.color, light.ambient.intensity));
  scene.add(new HemisphereLight(light.hemisphere.sky, light.hemisphere.ground, light.hemisphere.intensity));
  const sun = new DirectionalLight(light.sun.color, light.sun.intensity);
  sun.position.set(...light.sun.position); sun.castShadow = shadows;
  const shadow = MENU.shadow;
  sun.shadow.mapSize.set(shadow.size, shadow.size);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -shadow.extent;
  sun.shadow.camera.right = sun.shadow.camera.top = shadow.extent;
  sun.shadow.camera.near = shadow.near; sun.shadow.camera.far = shadow.far;
  sun.shadow.bias = shadow.bias; sun.shadow.normalBias = shadow.normalBias;
  scene.add(sun, sun.target); return sun;
}

/** Front-facing key and cool rim keep the original NFT vertex colours legible at every idle angle. */
function addHeroLights(scene: Scene): void {
  const key = new DirectionalLight(MENU.palette.key, MENU.hero.keyIntensity);
  key.position.set(...MENU.hero.keyPosition);
  const rim = new DirectionalLight(MENU.palette.rim, MENU.hero.rimIntensity);
  rim.position.set(...MENU.hero.rimPosition);
  scene.add(key, key.target, rim, rim.target);
}
