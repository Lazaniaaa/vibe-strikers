// Name tags (plain DOM over the canvas). The game projects positions; this only places and styles the labels.
import { TEAM_COLORS } from '../config/game.ts';

interface Tag { el: HTMLElement; x: number; y: number; scale: number; opacity: number; shown: boolean }

export class NameTags {
  private root: HTMLElement;
  private tags = new Map<number, Tag>();

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'name-tags';
    parent.appendChild(this.root);
  }

  /** Show / move one tag (screen pixels, anchor = bottom centre). Cheap when nothing changed. */
  show(id: number, name: string, ally: boolean, x: number, y: number, scale: number, opacity: number): void {
    let t = this.tags.get(id);
    if (!t) {
      const el = document.createElement('div');
      el.className = 'name-tag';
      this.root.appendChild(el);
      t = { el, x: NaN, y: NaN, scale: NaN, opacity: NaN, shown: false };
      this.tags.set(id, t);
    }
    if (t.el.textContent !== name) t.el.textContent = name;
    const color = ally ? TEAM_COLORS.ally : TEAM_COLORS.enemy;
    if (t.el.style.color !== color) t.el.style.color = color;
    const rx = Math.round(x), ry = Math.round(y), rs = Math.round(scale * 100) / 100, ro = Math.round(opacity * 100) / 100;
    if (rx !== t.x || ry !== t.y || rs !== t.scale) {
      t.x = rx; t.y = ry; t.scale = rs;
      t.el.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -100%) scale(${rs})`;
    }
    if (ro !== t.opacity) { t.opacity = ro; t.el.style.opacity = String(ro); }
    if (!t.shown) { t.shown = true; t.el.style.display = ''; }
  }

  hide(id: number): void {
    const t = this.tags.get(id);
    if (t && t.shown) { t.shown = false; t.el.style.display = 'none'; }
  }

  remove(id: number): void {
    const t = this.tags.get(id);
    if (t) { t.el.remove(); this.tags.delete(id); }
  }

  /** Ids of visible tags with their colour (tests). */
  visible(): { id: number; name: string; ally: boolean; opacity: number }[] {
    return [...this.tags.entries()].filter(([, t]) => t.shown)
      .map(([id, t]) => ({ id, name: t.el.textContent ?? '', ally: t.el.style.color === hexToRgb(TEAM_COLORS.ally), opacity: t.opacity }));
  }

  dispose(): void { this.root.remove(); }
}

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}
