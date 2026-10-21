import type { Container, Graphics } from 'pixi.js';
import { PosterDesign } from '../game/advertising';

type Pixi = typeof import('pixi.js');

export const POSTER_W = 240;
export const POSTER_H = 340;

/** A small pizza used as the hero image on several posters. */
function pizza(g: Graphics, x: number, y: number, r: number): void {
  g.circle(x, y, r).fill(0xe2b46c);
  g.circle(x, y, r * 0.86).fill(0xc8371f);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4;
    g.circle(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, r * 0.22).fill({
      color: 0xf7e3a1,
      alpha: 0.85,
    });
  }
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05 + 0.4;
    g.circle(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.1).fill(0xa3283a);
  }
}

/** Builds an original poster: a bold background motif, a pizza illustration, title and tagline. */
export function buildPoster(PIXI: Pixi, d: PosterDesign, company: string): Container {
  const root = new PIXI.Container();
  const g = new PIXI.Graphics();
  const [bg, accent, ink] = d.colors;
  const W = POSTER_W;
  const H = POSTER_H;
  g.rect(0, 0, W, H).fill(bg);

  switch (d.layout) {
    case 'sunburst':
      for (let i = 0; i < 18; i++) {
        const a0 = (i / 18) * Math.PI * 2;
        const a1 = a0 + Math.PI / 18;
        if (i % 2 === 0)
          g.poly([
            W / 2,
            150,
            W / 2 + Math.cos(a0) * 400,
            150 + Math.sin(a0) * 400,
            W / 2 + Math.cos(a1) * 400,
            150 + Math.sin(a1) * 400,
          ]).fill({ color: accent, alpha: 0.35 });
      }
      pizza(g, W / 2, 150, 70);
      break;
    case 'slice':
      g.circle(W / 2, 150, 95).fill({ color: accent, alpha: 0.25 });
      g.poly([W / 2 - 70, 90, W / 2 + 70, 90, W / 2, 240]).fill(0xc8371f);
      g.rect(W / 2 - 74, 80, 148, 16).fill(0xe2b46c);
      for (const [x, y] of [
        [-30, 110],
        [20, 120],
        [-5, 160],
        [10, 200],
      ])
        g.circle(W / 2 + x, y, 9).fill(0xa3283a);
      break;
    case 'stripes':
      for (let i = 0; i < 12; i++) g.rect(0, i * 34, W, 17).fill({ color: accent, alpha: 0.18 });
      pizza(g, W / 2 - 45, 150, 55);
      pizza(g, W / 2 + 45, 150, 55);
      break;
    case 'stack':
      for (let i = 0; i < 5; i++)
        g.roundRect(W / 2 - 80 + i * 4, 210 - i * 26, 160 - i * 8, 22, 6)
          .fill(i % 2 ? 0xffffff : 0xd9a55b)
          .stroke({ width: 2, color: ink });
      g.poly([W / 2, 50, W / 2 + 10, 80, W / 2 - 10, 80]).fill(accent);
      break;
    case 'chef':
      g.circle(W / 2, 140, 48).fill(0xf1c27d);
      g.rect(W / 2 - 40, 70, 80, 30).fill(0xffffff);
      for (const dx of [-26, 0, 26]) g.circle(W / 2 + dx, 62, 24).fill(0xffffff);
      g.ellipse(W / 2 - 14, 160, 16, 6).fill(0x3d2b1f);
      g.ellipse(W / 2 + 14, 160, 16, 6).fill(0x3d2b1f);
      g.circle(W / 2 - 16, 134, 4)
        .fill(0x2b1a10)
        .circle(W / 2 + 16, 134, 4)
        .fill(0x2b1a10);
      g.rect(W / 2 - 60, 190, 120, 50).fill(accent);
      break;
    case 'moon':
      for (let i = 0; i < 30; i++) g.circle((i * 53) % W, (i * 31) % 180, 1.5).fill(0xffffff);
      g.circle(W - 60, 70, 34).fill(accent);
      g.circle(W - 46, 60, 30).fill(bg);
      pizza(g, W / 2 - 20, 175, 60);
      break;
    case 'heart': {
      const hx = W / 2;
      const hy = 150;
      g.circle(hx - 40, hy - 25, 48).fill(accent);
      g.circle(hx + 40, hy - 25, 48).fill(accent);
      g.poly([hx - 86, hy - 10, hx + 86, hy - 10, hx, hy + 90]).fill(accent);
      pizza(g, hx, hy - 5, 40);
      break;
    }
    case 'flame':
      for (let i = 0; i < 7; i++) {
        const x = 20 + i * 34;
        g.poly([x - 22, 260, x, 90 + (i % 3) * 30, x + 22, 260]).fill({
          color: i % 2 ? accent : 0xffba08,
          alpha: 0.85,
        });
      }
      pizza(g, W / 2, 200, 55);
      break;
    case 'leaf':
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.ellipse(W / 2 + Math.cos(a) * 85, 150 + Math.sin(a) * 85, 30, 14).fill({
          color: accent,
          alpha: 0.7,
        });
      }
      pizza(g, W / 2, 150, 62);
      break;
  }

  // Bottom band with the company name.
  g.rect(0, H - 56, W, 56).fill(ink);
  g.rect(8, 8, W - 16, H - 16).stroke({ width: 3, color: ink, alpha: 0.6 });
  root.addChild(g);

  const title = new PIXI.Text({
    text: d.title.toUpperCase(),
    style: {
      fontFamily: 'Georgia, serif',
      fontSize: 26,
      fontWeight: '700',
      fill: ink,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: W - 30,
      stroke: { color: bg, width: 4 },
    },
  });
  title.anchor.set(0.5, 0);
  title.position.set(W / 2, 254);
  const tagline = new PIXI.Text({
    text: d.tagline,
    style: {
      fontFamily: 'Georgia, serif',
      fontSize: 15,
      fontStyle: 'italic',
      fill: ink,
      align: 'center',
    },
  });
  tagline.anchor.set(0.5, 0);
  tagline.position.set(W / 2, 22);
  const name = new PIXI.Text({
    text: company.toUpperCase(),
    style: {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: 18,
      fill: bg,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: W - 20,
    },
  });
  name.anchor.set(0.5, 0.5);
  name.position.set(W / 2, H - 28);
  root.addChild(title, tagline, name);
  return root;
}
