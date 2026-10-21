import { Injectable, signal } from '@angular/core';
import type { Application } from 'pixi.js';
import { Look } from '../game/characters';
import { drawPortrait } from './portrait-art';

const SIZE = 160;

/**
 * Renders portraits once with a single shared offscreen PixiJS renderer and caches
 * them as image URLs, so pages can show many faces without one WebGL context each.
 */
@Injectable({ providedIn: 'root' })
export class PortraitService {
  /** Cache key -> data URL; a signal so templates update when a portrait finishes rendering. */
  readonly images = signal<Record<string, string>>({});
  private app: Promise<Application> | null = null;
  private readonly pending = new Set<string>();

  /** Returns the portrait URL if ready, and starts rendering it otherwise. */
  get(key: string, look: Look, background: number): string | null {
    const ready = this.images()[key];
    if (ready) return ready;
    if (typeof window !== 'undefined' && !this.pending.has(key)) {
      this.pending.add(key);
      // Rendering writes a signal, so defer it out of the current change detection pass.
      queueMicrotask(() =>
        this.render(key, look, background).catch((err) => console.error('Portrait failed', err)),
      );
    }
    return null;
  }

  private async render(key: string, look: Look, background: number): Promise<void> {
    const app = await this.renderer();
    const PIXI = await import('pixi.js');
    const g = new PIXI.Graphics();
    drawPortrait(g, look, SIZE, background);
    const mask = new PIXI.Graphics().rect(0, 0, SIZE, SIZE).fill(0xffffff);
    g.mask = mask;
    const container = new PIXI.Container();
    container.addChild(g, mask);
    const url = await app.renderer.extract.base64({
      target: container,
      frame: new PIXI.Rectangle(0, 0, SIZE, SIZE),
    });
    container.destroy({ children: true });
    this.pending.delete(key);
    this.images.update((m) => ({ ...m, [key]: url }));
  }

  private renderer(): Promise<Application> {
    this.app ??= (async () => {
      const PIXI = await import('pixi.js');
      const app = new PIXI.Application();
      await app.init({
        width: SIZE,
        height: SIZE,
        antialias: true,
        autoStart: false,
        backgroundAlpha: 0,
      });
      return app;
    })();
    return this.app;
  }
}
