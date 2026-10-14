import { Injectable, signal } from '@angular/core';
import type { Application, Container } from 'pixi.js';

type Pixi = typeof import('pixi.js');

/**
 * Renders static PixiJS artwork once with a shared offscreen renderer and caches
 * it as an image URL, so screens can show many pictures (posters, previews)
 * without creating a WebGL context for each.
 */
@Injectable({ providedIn: 'root' })
export class ArtCacheService {
  readonly images = signal<Record<string, string>>({});
  private app: Promise<Application> | null = null;
  private readonly pending = new Set<string>();

  /** Returns the cached image URL, or starts rendering it and returns null. */
  get(key: string, width: number, height: number, build: (pixi: Pixi) => Container): string | null {
    const ready = this.images()[key];
    if (ready) return ready;
    if (typeof window !== 'undefined' && !this.pending.has(key)) {
      this.pending.add(key);
      // Rendering writes a signal, so defer it out of the current change detection pass.
      queueMicrotask(() => this.render(key, width, height, build).catch((err) => console.error('Art render failed', err)));
    }
    return null;
  }

  private async render(key: string, width: number, height: number, build: (pixi: Pixi) => Container): Promise<void> {
    const app = await this.renderer();
    const PIXI = await import('pixi.js');
    const content = build(PIXI);
    const mask = new PIXI.Graphics().rect(0, 0, width, height).fill(0xffffff);
    content.mask = mask;
    const root = new PIXI.Container();
    root.addChild(content, mask);
    const url = await app.renderer.extract.base64({ target: root, frame: new PIXI.Rectangle(0, 0, width, height), resolution: 2 });
    root.destroy({ children: true });
    this.pending.delete(key);
    this.images.update((m) => ({ ...m, [key]: url }));
  }

  private renderer(): Promise<Application> {
    this.app ??= (async () => {
      const PIXI = await import('pixi.js');
      const app = new PIXI.Application();
      await app.init({ width: 64, height: 64, antialias: true, autoStart: false, backgroundAlpha: 0 });
      return app;
    })();
    return this.app;
  }
}
