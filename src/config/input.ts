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
  slot1: 'Digit1',
  slot2: 'Digit2',
  scoreboard: 'Tab',
} as const;

export const MOUSE = {
  /** Radians per pixel of mouse movement. */
  sensitivity: 0.0022,
  maxPitchDeg: 89,
} as const;
