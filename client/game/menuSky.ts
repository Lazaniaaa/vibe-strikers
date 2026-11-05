import { Color, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { MENU } from '../../src/config/game';

/** Menu-only screen gradient: a downward rooftop camera still sees blue above the horizon. */
export function createMenuSky() {
  const geometry = new PlaneGeometry(MENU.sky.size, MENU.sky.size);
  const material = new ShaderMaterial({ depthWrite: false, depthTest: false, fog: false, toneMapped: false,
    uniforms: { horizon: { value: new Color(MENU.sky.horizon) }, zenith: { value: new Color(MENU.sky.top) } },
    vertexShader: 'varying vec2 skyUv; void main(){skyUv=uv; gl_Position=vec4(position.xy,1.,1.);}',
    fragmentShader: `varying vec2 skyUv; uniform vec3 horizon; uniform vec3 zenith;
      void main(){gl_FragColor=vec4(mix(horizon,zenith,skyUv.y),1.);
      #include <colorspace_fragment>
      }`,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'lobby-gradient-sky'; mesh.frustumCulled = false; mesh.renderOrder = -Infinity;
  return { mesh, dispose(){geometry.dispose();material.dispose();} };
}
