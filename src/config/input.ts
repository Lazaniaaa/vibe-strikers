// Controls and mouse settings. Key names are KeyboardEvent.code values.

export const KEYS = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  walk: 'ShiftLeft',
  crouch: 'ControlLeft',
  crouchAlt: 'KeyC',
  reload: 'KeyR',
  /** Second-person view (GAME.md 5). */
  secondPerson: 'KeyV',
  /** Pick up / use an item on the ground. */
  use: 'KeyE',
  slot1: 'Digit1',
  slot2: 'Digit2',
  slot3: 'Digit3',
  /** Primary for the next round (online): rifle, shotgun, sniper. */
  primaryKeys: ['Digit7', 'Digit8', 'Digit9'] as readonly string[],
  scoreboard: 'Tab',
} as const;

export const MOUSE = {
  /** Radians per pixel of mouse movement. */
  sensitivity: 0.0022,
  maxPitchDeg: 89,
} as const;
