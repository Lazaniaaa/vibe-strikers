// Settings panel (plain DOM): sensitivity, FOV, master volume, crosshair colour and size, ADS mode.
// Changes apply at once and are saved in the browser (src/ui/settings.ts).
import { SETTINGS_DEFAULTS, SETTINGS_LIMITS } from '../config/settings.ts';
import { saveSettings, settings } from './settings.ts';

/** Sensitivity is shown x1000 so the slider reads 0.5 .. 6.0. */
const SENS_SCALE = 1000;

export class SettingsPanel {
  readonly root: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'settings';
    const L = SETTINGS_LIMITS;
    this.root.innerHTML = `
      <div class="settings-card">
        <div class="settings-title">Settings</div>
        <label>Mouse sensitivity <span data-out="sensitivity"></span>
          <input type="range" data-key="sensitivity" min="${L.sensitivity.min * SENS_SCALE}" max="${L.sensitivity.max * SENS_SCALE}" step="${L.sensitivity.step * SENS_SCALE}"></label>
        <label>Field of view <span data-out="fov"></span>
          <input type="range" data-key="fov" min="${L.fov.min}" max="${L.fov.max}" step="${L.fov.step}"></label>
        <label>Master volume <span data-out="volume"></span>
          <input type="range" data-key="volume" min="${L.volume.min}" max="${L.volume.max}" step="${L.volume.step}"></label>
        <label>Music volume <span data-out="musicVolume"></span>
          <input type="range" data-key="musicVolume" min="${L.musicVolume.min}" max="${L.musicVolume.max}" step="${L.musicVolume.step}"></label>
        <label>Crosshair colour <input type="color" data-key="crosshairColor"></label>
        <label>Crosshair size <span data-out="crosshairSize"></span>
          <input type="range" data-key="crosshairSize" min="${L.crosshairSize.min}" max="${L.crosshairSize.max}" step="${L.crosshairSize.step}"></label>
        <label>Aim (right mouse) <select data-key="adsMode"><option value="toggle">toggle (click on / off)</option><option value="hold">hold</option></select></label>
        <label>Second-person view (V) <select data-key="secondPersonMode"><option value="toggle">toggle</option><option value="hold">hold</option></select></label>
        <label>Screen shake when hit <select data-key="screenShake"><option value="on">on</option><option value="off">off</option></select></label>
        <label>Ambient occlusion <select data-key="ambientOcclusion"><option value="on">on</option><option value="off">off</option></select></label>
        <div class="settings-row"><button class="settings-reset">Defaults</button><button class="settings-close">Close</button></div>
      </div>`;
    parent.appendChild(this.root);
    this.root.addEventListener('mousedown', (e) => e.stopPropagation());
    for (const el of this.root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-key]')) {
      el.addEventListener('input', () => this.read(el));
      el.addEventListener('change', () => this.read(el));
    }
    this.root.querySelector('.settings-close')!.addEventListener('click', () => this.close());
    this.root.querySelector('.settings-reset')!.addEventListener('click', () => { Object.assign(settings, SETTINGS_DEFAULTS); saveSettings(); this.fill(); });
    this.fill();
  }

  private read(el: HTMLInputElement | HTMLSelectElement): void {
    const key = el.dataset.key as keyof typeof settings;
    if (key === 'sensitivity') settings.sensitivity = Number(el.value) / SENS_SCALE;
    else if (key === 'fov' || key === 'volume' || key === 'musicVolume' || key === 'crosshairSize') settings[key] = Number(el.value);
    else if (key === 'crosshairColor') settings.crosshairColor = el.value;
    else if (key === 'adsMode') settings.adsMode = el.value === 'hold' ? 'hold' : 'toggle';
    else if (key === 'secondPersonMode') settings.secondPersonMode = el.value === 'hold' ? 'hold' : 'toggle';
    else if (key === 'ambientOcclusion') settings.ambientOcclusion = el.value === 'on' ? 'on' : 'off';
    else if (key === 'screenShake') settings.screenShake = el.value === 'off' ? 'off' : 'on';
    saveSettings();
    this.fillOutputs();
  }

  private fill(): void {
    for (const el of this.root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-key]')) {
      const key = el.dataset.key as keyof typeof settings;
      el.value = key === 'sensitivity' ? String(settings.sensitivity * SENS_SCALE) : String(settings[key]);
    }
    this.fillOutputs();
  }

  private fillOutputs(): void {
    const out = (k: string, text: string) => { this.root.querySelector(`[data-out="${k}"]`)!.textContent = text; };
    out('sensitivity', (settings.sensitivity * SENS_SCALE).toFixed(1));
    out('fov', `${settings.fov}°`);
    out('volume', `${Math.round(settings.volume * 100)}%`);
    out('musicVolume', `${Math.round(settings.musicVolume * 100)}%`);
    out('crosshairSize', `${settings.crosshairSize}px`);
  }

  open(): void { this.fill(); this.root.style.display = 'flex'; }
  close(): void { this.root.style.display = 'none'; }
  get isOpen(): boolean { return this.root.style.display === 'flex'; }
}

/** A "Settings" button that opens the (shared) panel. */
export function settingsButton(parent: HTMLElement, panel: SettingsPanel, className: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = className; b.textContent = 'Settings';
  b.addEventListener('mousedown', (e) => e.stopPropagation());
  b.addEventListener('click', (e) => { e.stopPropagation(); panel.open(); });
  parent.appendChild(b);
  return b;
}

let shared: SettingsPanel | null = null;

/** One panel for the whole page (menu and in-game). */
export function getSettingsPanel(): SettingsPanel {
  if (!shared) shared = new SettingsPanel(document.body);
  return shared;
}
