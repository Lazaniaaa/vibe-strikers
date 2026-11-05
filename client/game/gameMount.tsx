import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { unmountComponentAtNode } from '@react-three/fiber';
import { Scene, type Mesh, type PerspectiveCamera, type ShaderMaterial } from 'three';
import type { GameApp, GameOptions } from './GameApp';
import type { OnlineApp } from './OnlineApp';

// React and R3F stay out of the first-paint menu entry. No StrictMode: physics worlds have one owner.
const root = createRoot(document.getElementById('root')!);
let releaseSkyGuard: (() => void) | null = null;

/**
 * R3F can draw a concurrent, partially committed game scene before its priority-one frame subscriber exists.
 * The existing sky factory leaves this uniform null until that subscriber's first update. Initialise only
 * that missing value through Three's before-render hook during mount; restore the hook on ready/teardown.
 * No game/sky source changes, new frame objects, swallowed errors or steady-state render interception.
 */
function guardInitialSky(): void {
  releaseSkyGuard?.();
  const original = Scene.prototype.onBeforeRender;
  const guard: typeof original = function(this: Scene, renderer, scene, camera, geometry, material, group) {
    original.call(this, renderer, scene, camera, geometry, material, group);
    const sky = scene.getObjectByName('gradient-sky') as Mesh | undefined;
    const skyMaterial = sky?.material as ShaderMaterial | undefined;
    const uniform = skyMaterial?.uniforms?.projectionMatrixInverse;
    if (uniform && uniform.value === null) uniform.value = (camera as PerspectiveCamera).projectionMatrixInverse;
  };
  Scene.prototype.onBeforeRender = guard;
  releaseSkyGuard = () => { if (Scene.prototype.onBeforeRender === guard) Scene.prototype.onBeforeRender = original; releaseSkyGuard = null; };
}
export function mountOffline(App: typeof GameApp, options: GameOptions): void {
  guardInitialSky();
  flushSync(() => root.render(<App options={{ ...options, onReady: () => { releaseSkyGuard?.(); options.onReady?.(); } }} />));
}
export function mountOnline(App: typeof OnlineApp, props: Parameters<typeof OnlineApp>[0]): void {
  guardInitialSky();
  flushSync(() => root.render(<App {...props} onReady={() => { releaseSkyGuard?.(); props.onReady?.(); }} />));
}
export async function unmountGame(): Promise<void> {
  releaseSkyGuard?.();
  const canvas = document.querySelector<HTMLCanvasElement>('#root canvas');
  // R3F owns a separate reconciler. Await its public teardown callback, then remove the outer React root.
  if (canvas) await new Promise<void>(resolve => unmountComponentAtNode(canvas, () => resolve()));
  flushSync(() => root.render(null));
}
