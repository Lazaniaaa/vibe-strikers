import { Color, Mesh, PlaneGeometry, ShaderMaterial, type PerspectiveCamera } from 'three';
import { LIGHTING } from '../../src/config/game';
/** One full-screen triangle-pair; camera-centred, depth at far plane, no fog/AO depth. */
export function createSky(horizon: string, top: string) {
  const material = new ShaderMaterial({ depthWrite: false, depthTest: false, toneMapped: true,
    uniforms: { horizon: { value: new Color(horizon) }, zenith: { value: new Color(top) }, rise: { value: LIGHTING.skyRise } },
    vertexShader: 'uniform mat4 projectionMatrixInverse; varying vec3 ray; void main(){ vec4 p=projectionMatrixInverse*vec4(position.xy,1.,1.); ray=mat3(inverse(viewMatrix))*p.xyz; gl_Position=vec4(position.xy,1.,1.); }',
    fragmentShader: `uniform vec3 horizon; uniform vec3 zenith; uniform float rise; varying vec3 ray;
      void main(){ float t=clamp(normalize(ray).y/rise,0.,1.); gl_FragColor=vec4(mix(horizon,zenith,t),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  // Projection inverse is supplied explicitly (not a built-in ShaderMaterial uniform).
  material.uniforms.projectionMatrixInverse = { value: null };
  const mesh = new Mesh(new PlaneGeometry(LIGHTING.skySize,LIGHTING.skySize),material);
  mesh.name='gradient-sky';mesh.frustumCulled=false;mesh.renderOrder=-Infinity;
  return { mesh, update(camera: PerspectiveCamera){mesh.position.copy(camera.position);material.uniforms.projectionMatrixInverse.value=camera.projectionMatrixInverse;}, dispose(){mesh.geometry.dispose();material.dispose();} };
}
