import type { Graphics } from 'pixi.js';
import { TvCommercial } from '../game/advertising';

export const TV_W = 320;
export const TV_H = 220;

function pizza(g: Graphics, x: number, y: number, r: number, bites = 0): void {
  g.circle(x, y, r).fill(0xe2b46c);
  g.circle(x, y, r * 0.85).fill(0xc8371f);
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05;
    g.circle(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.16).fill(0xf7e3a1);
  }
  // Eaten slices are cut away as wedges of table colour.
  for (let i = 0; i < bites; i++) {
    const a0 = (i / 6) * Math.PI * 2;
    const a1 = a0 + Math.PI / 3;
    g.poly([x, y, x + Math.cos(a0) * (r + 1), y + Math.sin(a0) * (r + 1), x + Math.cos((a0 + a1) / 2) * (r + 2), y + Math.sin((a0 + a1) / 2) * (r + 2), x + Math.cos(a1) * (r + 1), y + Math.sin(a1) * (r + 1)]).fill(0x8b5a2b);
  }
}

function person(g: Graphics, x: number, y: number, shirt: number, skin: number, s = 1): void {
  g.roundRect(x - 14 * s, y, 28 * s, 34 * s, 8 * s).fill(shirt);
  g.circle(x, y - 10 * s, 12 * s).fill(skin);
  g.circle(x - 4 * s, y - 12 * s, 1.6 * s).fill(0x222222).circle(x + 4 * s, y - 12 * s, 1.6 * s).fill(0x222222);
}

/** Draws frame `t` (seconds) of an original commercial. Each loops every few seconds. */
export function drawCommercial(g: Graphics, ad: TvCommercial, t: number): void {
  const W = TV_W;
  const H = TV_H;
  g.clear();
  switch (ad.scene) {
    case 'oven': {
      g.rect(0, 0, W, H).fill(0x5c3a21);
      g.roundRect(60, 40, 200, 140, 60).fill(0x9c6644).stroke({ width: 6, color: 0x6b3b2a });
      g.ellipse(160, 130, 70, 38).fill(0x2b1d14);
      const flicker = 0.6 + 0.4 * Math.sin(t * 9);
      g.ellipse(160, 140, 50, 16).fill({ color: 0xff6b35, alpha: flicker });
      const out = Math.min(1, (t % 5) / 2.5);
      g.rect(150, 150 + out * 30, 120 * out, 6).fill(0x8b5a2b);
      pizza(g, 160 + out * 70, 140 + out * 30, 26);
      for (let i = 0; i < 3; i++) {
        const k = ((t * 0.6 + i / 3) % 1);
        g.circle(200 + i * 14 + Math.sin(t * 2 + i) * 6, 150 - k * 110, 8 + k * 10).fill({ color: 0xffffff, alpha: 0.4 * (1 - k) });
      }
      break;
    }
    case 'scooter': {
      g.rect(0, 0, W, H).fill(0x8ecae6);
      const scroll = (t * 80) % 80;
      for (let i = -1; i < 6; i++) {
        const x = i * 80 - scroll;
        g.rect(x, 60 + (i % 2) * 20, 60, 110).fill([0xb5838d, 0xe5989b, 0x9a8c98][(i + 6) % 3]);
        for (let w = 0; w < 3; w++) g.rect(x + 10, 75 + (i % 2) * 20 + w * 25, 12, 12).fill(0xfff3b0);
      }
      g.rect(0, 170, W, 50).fill(0x4f5359);
      for (let i = 0; i < 6; i++) g.rect(i * 70 - scroll, 192, 36, 4).fill(0xe8e2b0);
      const bob = Math.sin(t * 14) * 2;
      g.circle(120, 182, 14).fill(0x222222).circle(190, 182, 14).fill(0x222222);
      g.roundRect(112, 150 + bob, 90, 22, 8).fill(0xe63946);
      g.rect(170, 128 + bob, 34, 24).fill(0xf5e6c8).stroke({ width: 2, color: 0x8b5a2b });
      person(g, 140, 112 + bob, 0x1d3557, 0xe9b98f);
      g.circle(140, 100 + bob, 13).fill(0xe63946);
      break;
    }
    case 'toss': {
      g.rect(0, 0, W, H).fill(0xf4ecd8);
      g.rect(0, 160, W, 60).fill(0x8b5a2b);
      person(g, 160, 120, 0xffffff, 0xf1c27d, 1.4);
      g.rect(140, 78, 40, 14).fill(0xffffff);
      for (const dx of [-12, 0, 12]) g.circle(160 + dx, 72, 11).fill(0xffffff);
      const phase = (t % 1.6) / 1.6;
      const height = Math.sin(phase * Math.PI) * 70;
      const spin = Math.cos(t * 10);
      g.ellipse(160, 60 - height, 38, 10 + Math.abs(spin) * 18).fill(0xf1d39a).stroke({ width: 2, color: 0xd9a55b });
      break;
    }
    case 'family': {
      g.rect(0, 0, W, H).fill(0xffe8d6);
      g.rect(30, 30, 60, 50).fill(0xbfe3f2).stroke({ width: 4, color: 0x8b5a2b });
      person(g, 80, 110, 0x2a9d8f, 0xe9b98f, 1.1);
      person(g, 240, 110, 0xf4a261, 0xc68a5c, 1.1);
      person(g, 160, 90, 0x6a4c93, 0xf6d5b8, 0.8);
      g.ellipse(160, 165, 130, 34).fill(0x8b5a2b);
      pizza(g, 160, 160, 32, Math.floor((t % 7) / 1));
      break;
    }
    case 'rocket': {
      g.rect(0, 0, W, H).fill(0x0b132b);
      for (let i = 0; i < 40; i++) {
        const x = (i * 97 - t * 30 * ((i % 3) + 1)) % W;
        g.circle((x + W) % W, (i * 53) % H, i % 4 === 0 ? 1.8 : 1).fill(0xffffff);
      }
      g.circle(270, 50, 26).fill(0xe2b46c).circle(270, 50, 22).fill(0xc8371f);
      const x = ((t * 70) % (W + 120)) - 60;
      const y = 120 + Math.sin(t * 2) * 25;
      g.poly([x + 40, y, x - 30, y - 22, x - 30, y + 22]).fill(0xe2b46c);
      g.poly([x + 34, y, x - 24, y - 17, x - 24, y + 17]).fill(0xc8371f);
      g.circle(x - 8, y - 4, 4).fill(0xf7e3a1).circle(x + 8, y + 3, 3).fill(0xa3283a);
      g.poly([x - 30, y - 10, x - 55 - Math.sin(t * 20) * 8, y, x - 30, y + 10]).fill(0xffba08);
      break;
    }
    case 'moonlight': {
      g.rect(0, 0, W, H).fill(0x14213d);
      const rise = Math.min(1, (t % 8) / 4);
      g.circle(250, 110 - rise * 60, 28).fill(0xfdf0d5);
      g.rect(0, 150, W, 70).fill(0x3d2b1f);
      g.ellipse(160, 155, 110, 22).fill(0xf8f9fa);
      pizza(g, 160, 150, 26);
      for (const cx of [90, 230]) {
        g.rect(cx - 3, 120, 6, 30).fill(0xf1faee);
        const f = 1 + Math.sin(t * 12 + cx) * 0.25;
        g.ellipse(cx, 114, 4 * f, 8 * f).fill(0xffba08);
        g.circle(cx, 114, 22).fill({ color: 0xffba08, alpha: 0.12 });
      }
      break;
    }
  }
  // Scanlines for the old-TV look.
  for (let y = 0; y < H; y += 4) g.rect(0, y, W, 1).fill({ color: 0x000000, alpha: 0.08 });
}
