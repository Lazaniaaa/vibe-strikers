// Loading screen (plain DOM, no three.js): a bar that moves toward the current step's target while a chunk
// downloads (dynamic imports report no byte progress), then completes at the first rendered frame.
export class Loading {
  private root: HTMLElement;
  private bar: HTMLElement;
  private label: HTMLElement;
  private value = 0;
  private target = 0;
  private timer = 0;

  constructor(parent: HTMLElement = document.body) {
    this.root = document.createElement('div');
    this.root.className = 'loading';
    this.root.innerHTML = '<div class="loading-card"><div class="loading-title">Vibe Strikers</div>' +
      '<div class="loading-label"></div><div class="loading-track"><div class="loading-bar"></div></div></div>';
    parent.appendChild(this.root);
    this.bar = this.root.querySelector('.loading-bar')!;
    this.label = this.root.querySelector('.loading-label')!;
    // Ease toward the target, never reaching it until the step is done.
    this.timer = window.setInterval(() => {
      this.value += (this.target - this.value) * 0.08;
      this.bar.style.width = `${(this.value * 100).toFixed(1)}%`;
    }, 50);
  }

  /** Current step text, progress so far (0..1) and the progress this step will end at. */
  step(text: string, from: number, to: number): void {
    this.label.textContent = text;
    this.value = Math.max(this.value, from);
    this.target = to * 0.97 + from * 0.03;
  }

  error(text: string): void { this.label.textContent = text; this.root.classList.add('loading-error'); }

  done(): void {
    window.clearInterval(this.timer);
    this.bar.style.width = '100%';
    this.root.remove();
  }
}
