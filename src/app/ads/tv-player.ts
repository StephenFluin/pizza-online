import { Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, viewChild } from '@angular/core';
import type { Application, Graphics, Text } from 'pixi.js';
import { TvCommercial } from '../game/advertising';
import { TV_H, TV_W, drawCommercial } from './tv-art';

/** A wooden TV set playing a commercial in a loop with PixiJS. */
@Component({
  selector: 'app-tv-player',
  template: `
    <div class="tv">
      <div class="screen" #screen role="img" [attr.aria-label]="'Commercial: ' + commercial().title"></div>
      <div class="knobs" aria-hidden="true"><span></span><span></span></div>
    </div>
  `,
  styles: `
    .tv { display: grid; grid-template-columns: 1fr 44px; gap: 10px; padding: 16px; border-radius: 18px; background: linear-gradient(160deg, #8b5a2b, #5c3a21); box-shadow: inset 0 0 0 4px #3e1f0e, 0 6px 18px #0006; max-width: 440px; }
    .screen { border-radius: 26px / 18px; overflow: hidden; background: #111; aspect-ratio: ${TV_W} / ${TV_H}; box-shadow: inset 0 0 18px #000; }
    .knobs { display: grid; align-content: start; gap: 12px; padding-top: 10px; }
    .knobs span { width: 34px; height: 34px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #ddd, #777); box-shadow: 0 2px 0 #3e1f0e; }
  `,
})
export class TvPlayerComponent {
  readonly commercial = input.required<TvCommercial>();
  private readonly screen = viewChild.required<ElementRef<HTMLDivElement>>('screen');
  private app: Application | null = null;
  private g: Graphics | null = null;
  private caption: Text | null = null;
  private started = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.init().catch((err) => console.error('TV failed', err));
    });
    destroyRef.onDestroy(() => this.app?.destroy({ removeView: true }, { children: true }));
    // Restart the clip when another commercial is chosen.
    effect(() => {
      const ad = this.commercial();
      this.started = performance.now();
      if (this.caption) this.caption.text = ad.title.toUpperCase();
    });
  }

  private async init(): Promise<void> {
    const PIXI = await import('pixi.js');
    const app = new PIXI.Application();
    await app.init({ width: TV_W, height: TV_H, background: 0x000000, antialias: true });
    app.canvas.style.width = '100%';
    app.canvas.style.height = '100%';
    app.canvas.setAttribute('aria-hidden', 'true');
    this.screen().nativeElement.appendChild(app.canvas);
    this.app = app;
    this.g = new PIXI.Graphics();
    this.caption = new PIXI.Text({
      text: this.commercial().title.toUpperCase(),
      style: { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: 16, fill: 0xffffff, stroke: { color: 0x000000, width: 4 } },
    });
    this.caption.position.set(10, TV_H - 28);
    app.stage.addChild(this.g, this.caption);
    app.ticker.add(() => {
      const t = (performance.now() - this.started) / 1000;
      if (this.g) drawCommercial(this.g, this.commercial(), t);
      // The title card fades in after the opening seconds.
      if (this.caption) this.caption.alpha = Math.min(1, Math.max(0, t - 1.5));
    });
  }
}
