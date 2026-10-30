import { Group, Mesh, Object3D } from 'three';
import type { Vec3 } from '../characters/types';
import { weapons } from './weapons';
import { canonical, disposeSharedResources, materials, mergedBoxes, mergedPanes, lensMaterial } from './resources';
import type { AnimatedPart, WeaponConfig, WeaponId, WeaponOptions, WeaponPalette, WeaponRuntime } from './types';
import { createSniperViewWeapon, disposeSniperViewSkeletons } from './sniperViewmodel';

const configs = new Map(weapons.map(w=>[w.id,w]));
const cache = new Map<string, { config:WeaponConfig; palette:WeaponPalette }>();
const animated: readonly AnimatedPart[] = ['mag','slide','bolt','pump'];
function socket(name: string, at: Vec3, parent: Group): Object3D {
  const o=new Object3D(); o.name=name; o.position.set(...at); parent.add(o); return o;
}
/** Origin is the main grip centre. Use a parent placement group for game-owned offsets. */
export function createWeapon(id: WeaponId, options: WeaponOptions = {}): Group {
  const config=configs.get(id); if(!config) throw new Error(`Unknown weapon: ${id}`);
  const palette={...config.palette,...options.palette};
  for(const [key,value] of Object.entries(palette)) if(!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`Invalid weapon palette ${key}`);
  const key=canonical({config,options:{...options,palette}});
  let cached=cache.get(key); if(!cached){cached={config,palette};cache.set(key,cached);}
  if(id==='sniper'&&options.viewmodel)return createSniperViewWeapon(cached.config,cached.palette);
  const [solid,glow]=materials();
  const group=new Group();group.name=`weapon-${id}`;
  socket('mainGrip',[0,0,0],group);
  const body=new Mesh(mergedBoxes(config.body.filter(b=>!b.glow),cached.palette,`${id}-body`),solid);
  body.name='body';body.castShadow=true;group.add(body);
  const lights=config.body.filter(b=>b.glow);
  if(lights.length){const mesh=new Mesh(mergedBoxes(lights,cached.palette,`${id}-glow`),glow);mesh.name='glow';group.add(mesh);}
  const data:WeaponRuntime={weaponId:id,kind:config.kind,muzzle:socket('muzzle',config.muzzle,group),
    foregrip:config.foregrip?socket('foregrip',config.foregrip,group):null,
    supportGrip:null, sightAxis:null, adsFovHint:config.adsFovHint??null,
    ejectPort:config.ejectPort?socket('ejectPort',config.ejectPort,group):null,
    mag:null,slide:null,bolt:null,pump:null,rest:{},palette:cached.palette};
  for(const name of animated){
    const spec=config.parts[name];if(!spec)continue;
    const pivot=new Group();pivot.name=name;pivot.position.set(...spec.position);
    const mesh=new Mesh(mergedBoxes(spec.boxes,cached.palette,`${id}-${name}`),solid);
    mesh.name=`${name}-boxes`;mesh.castShadow=true;pivot.add(mesh);group.add(pivot);
    data[name]=pivot;data.rest[name]=spec.position;
  }
  if(data.foregrip)data.supportGrip=socket('supportGrip',[0,0,0],data.foregrip as Group);
  else if(config.supportGrip)data.supportGrip=socket('supportGrip',config.supportGrip,group);
  if(config.sight)data.sightAxis=socket('sightAxis',config.sight.position,
    config.sight.part?data[config.sight.part]!:group);
  for(const spec of config.lenses??[]){
    const lens=new Mesh(mergedPanes(spec.boxes,cached.palette,`${id}-lens-${spec.id}`),lensMaterial());
    lens.name=`lens-${spec.id}`;lens.renderOrder=2;lens.userData.viewmodelHidden=spec.viewmodelHidden??false;
    (spec.part?data[spec.part]!:group).add(lens);
  }
  group.userData=data;return group;
}
/** Call only after removing all world weapons and viewmodels. */
export function disposeWeaponResources(): void { cache.clear();disposeSniperViewSkeletons();disposeSharedResources(); }
