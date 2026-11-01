// Jump feel test: coyote time (jump shortly after running off a ledge) and jump buffering (a tap shortly
// before landing). Runs the game's Rapier KCC motor on a 2 m platform; every 30 Hz sample is checked with the
// server movement validation. Usage: node scripts/test-jump-feel.mjs
import { createServer } from 'vite';
import RAPIER from '@dimforge/rapier3d-compat';

const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false } });
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }
try {
  await RAPIER.init({});
  const { RapierMotor } = await vite.ssrLoadModule('/src/gameplay/rapierMotor.ts');
  const { createActor } = await vite.ssrLoadModule('/src/gameplay/actor.ts');
  const { ClientValidatedMovement } = await vite.ssrLoadModule('/src/gameplay/movementCheck.ts');
  const { MOVEMENT } = await vite.ssrLoadModule('/src/config/movement.ts');
  // Floor at y 0 and a 2 m high platform for z in [0, 5]; walking forward (yaw 0) goes toward -z, off the edge.
  const boxes = [
    { x: 0, y: -0.5, z: 0, w: 40, h: 1, d: 40 },
    { x: 0, y: 1, z: 2.5, w: 10, h: 2, d: 5 },
  ];
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  for (const b of boxes) world.createCollider(RAPIER.ColliderDesc.cuboid(b.w / 2, b.h / 2, b.d / 2).setTranslation(b.x, b.y, b.z));
  world.step();
  const motor = new RapierMotor(RAPIER, world);
  const actor = createActor(1, 'A', 'jumper', false, 0);
  motor.add(actor);
  const authority = new ClientValidatedMovement(boxes, { x: 20, z: 20 }, -10);
  const DT = 1 / 60;
  const intent = { forward: 0, right: 0, yaw: 0, pitch: 0, jump: false, crouch: false, walk: false, fire: false, reload: false, slot: -1 };
  let violations = 0, frames = 0, prev = null;

  function frame() {
    motor.step(actor, intent, DT, false, 1);
    world.step();
    const next = { x: actor.x, y: actor.y, z: actor.z, crouch: false, walk: false };
    if (++frames % 2 === 0) { if (prev && authority.check(prev, next, DT * 2, 1) !== 'ok') violations++; prev = next; }
  }
  /** Stand on the platform, then run forward; returns after `until()` is true or 4 s. */
  function reset() {
    motor.teleport(actor, 0, 2, 3); actor.yaw = 0; actor.jumpLatch = false;
    intent.forward = 0; intent.jump = false; prev = null;
    for (let i = 0; i < 30; i++) frame();
    intent.forward = 1;
  }
  const jumped = () => actor.vy > MOVEMENT.jumpVelocity * 0.5;

  /** Run off the ledge, tap jump `delay` s after leaving the ground. */
  function coyote(delay) {
    reset();
    while (actor.grounded) frame();
    for (let t = DT; t < delay; t += DT) frame();
    intent.jump = true; frame(); const ok = jumped(); intent.jump = false;
    for (let i = 0; i < 90; i++) frame();
    return ok;
  }
  // Frames from leaving the ledge to landing on the floor (no jump).
  reset();
  while (actor.grounded) frame();
  let fallFrames = 0;
  while (!actor.grounded && fallFrames < 240) { frame(); fallFrames++; }
  /** Fall off the ledge, tap jump `early` s before landing, then report whether a jump came within 0.3 s of landing. */
  function buffer(early) {
    reset();
    while (actor.grounded) frame();
    const tapAt = fallFrames - Math.round(early / DT);
    let ok = false;
    for (let i = 0; i < fallFrames + 18; i++) {
      intent.jump = i === tapAt;
      frame();
      if (i > tapAt && jumped()) ok = true;
    }
    intent.jump = false;
    for (let i = 0; i < 90; i++) frame();
    return ok;
  }

  console.log(`fall from the 2 m ledge: ${(fallFrames * DT).toFixed(2)} s`);
  const rows = [];
  for (const d of [0.03, 0.08, 0.15]) rows.push([`jump ${d.toFixed(2)} s after leaving the ledge`, coyote(d)]);
  for (const d of [0.03, 0.08, 0.15]) rows.push([`tap jump ${d.toFixed(2)} s before landing`, buffer(d)]);
  for (const [name, ok] of rows) console.log(`${ok ? 'JUMPS' : 'no jump'}  ${name}`);
  check(violations === 0, `server movement validation: ${violations} violations`);
  if (process.argv.includes('--expect-feel')) {
    check(rows[0][1] && rows[1][1] && !rows[2][1], 'coyote time: 0.03 / 0.08 s jump, 0.15 s does not');
    check(rows[3][1] && rows[4][1] && !rows[5][1], 'jump buffer: 0.03 / 0.08 s jump, 0.15 s does not');
  }
} finally {
  await vite.close();
}
if (failed) { console.log(`${failed} check(s) FAILED`); process.exit(1); }
