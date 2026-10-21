import type { Graphics } from 'pixi.js';
import { Look } from '../game/characters';

function shade(color: number, f: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) * f);
  const g = Math.min(255, ((color >> 8) & 0xff) * f);
  const b = Math.min(255, (color & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}

/**
 * Draws a head-and-shoulders portrait from simple shapes on an S×S canvas.
 * Every face is assembled from parts, so the cast stays original and varied.
 */
export function drawPortrait(g: Graphics, look: Look, S: number, background: number): void {
  const cx = S / 2;
  const u = S / 100;
  g.rect(0, 0, S, S).fill(background);
  g.circle(cx, S * 0.42, S * 0.42).fill({ color: 0xffffff, alpha: 0.18 });

  // Shoulders and shirt with a collar.
  g.ellipse(cx, S * 1.02, 44 * u, 30 * u).fill(look.shirt);
  g.poly([cx - 9 * u, 74 * u, cx, 86 * u, cx + 9 * u, 74 * u]).fill(shade(look.shirt, 0.75));
  g.rect(cx - 7 * u, 64 * u, 14 * u, 12 * u).fill(shade(look.skin, 0.9));

  const faceW = [26, 23, 26][look.faceShape] * u;
  const faceH = [29, 33, 30][look.faceShape] * u;
  const faceY = 45 * u;

  // Hair that sits behind the head.
  if (look.hairStyle === 'long')
    g.roundRect(cx - faceW - 4 * u, faceY - 22 * u, (faceW + 4 * u) * 2, 56 * u, 18 * u).fill(
      look.hair,
    );
  if (look.hairStyle === 'bob')
    g.roundRect(cx - faceW - 3 * u, faceY - 24 * u, (faceW + 3 * u) * 2, 42 * u, 14 * u).fill(
      look.hair,
    );
  if (look.hairStyle === 'curly')
    for (let i = 0; i < 12; i++) {
      const a = Math.PI + (i / 11) * Math.PI;
      g.circle(
        cx + Math.cos(a) * (faceW + 2 * u),
        faceY - 4 * u + Math.sin(a) * (faceH + 2 * u),
        9 * u,
      ).fill(look.hair);
    }

  // Ears and face.
  g.ellipse(cx - faceW, faceY + 2 * u, 5 * u, 7 * u).fill(shade(look.skin, 0.92));
  g.ellipse(cx + faceW, faceY + 2 * u, 5 * u, 7 * u).fill(shade(look.skin, 0.92));
  if (look.faceShape === 2)
    g.roundRect(cx - faceW, faceY - faceH, faceW * 2, faceH * 2, 14 * u).fill(look.skin);
  else g.ellipse(cx, faceY, faceW, faceH).fill(look.skin);
  if (look.accessory === 'earrings') {
    g.circle(cx - faceW, faceY + 10 * u, 2.5 * u).fill(0xffd166);
    g.circle(cx + faceW, faceY + 10 * u, 2.5 * u).fill(0xffd166);
  }

  // Hair on top of the head.
  switch (look.hairStyle) {
    case 'short':
      g.ellipse(cx, faceY - faceH + 6 * u, faceW + 1 * u, 12 * u).fill(look.hair);
      break;
    case 'side':
      g.ellipse(cx, faceY - faceH + 6 * u, faceW + 2 * u, 12 * u).fill(look.hair);
      g.poly([
        cx - faceW,
        faceY - faceH + 8 * u,
        cx + 4 * u,
        faceY - faceH + 4 * u,
        cx - faceW + 2 * u,
        faceY - 8 * u,
      ]).fill(look.hair);
      break;
    case 'bun':
      g.ellipse(cx, faceY - faceH + 6 * u, faceW + 1 * u, 11 * u).fill(look.hair);
      g.circle(cx, faceY - faceH - 6 * u, 9 * u).fill(look.hair);
      break;
    case 'mohawk':
      g.roundRect(cx - 5 * u, faceY - faceH - 12 * u, 10 * u, 24 * u, 4 * u).fill(look.hair);
      break;
    case 'long':
    case 'bob':
      g.ellipse(cx, faceY - faceH + 7 * u, faceW + 3 * u, 13 * u).fill(look.hair);
      break;
    case 'curly':
      for (let i = 0; i < 7; i++)
        g.circle(cx - faceW + (i * faceW * 2) / 6, faceY - faceH + 4 * u, 8 * u).fill(look.hair);
      break;
    case 'bald':
      g.ellipse(cx - faceW + 2 * u, faceY - 4 * u, 3 * u, 8 * u).fill(look.hair);
      g.ellipse(cx + faceW - 2 * u, faceY - 4 * u, 3 * u, 8 * u).fill(look.hair);
      g.ellipse(cx - 6 * u, faceY - faceH + 8 * u, 6 * u, 3 * u).fill({
        color: 0xffffff,
        alpha: 0.35,
      });
      break;
  }

  // Eyebrows, eyes, nose, mouth.
  const eyeY = faceY - 2 * u;
  const browColor = look.hairStyle === 'bald' ? shade(look.hair, 0.8) : shade(look.hair, 0.9);
  g.roundRect(cx - 15 * u, eyeY - 8 * u, 10 * u, 2.5 * u, 1 * u).fill(browColor);
  g.roundRect(cx + 5 * u, eyeY - 8 * u, 10 * u, 2.5 * u, 1 * u).fill(browColor);
  g.ellipse(cx - 10 * u, eyeY, 4.5 * u, 3.5 * u).fill(0xffffff);
  g.ellipse(cx + 10 * u, eyeY, 4.5 * u, 3.5 * u).fill(0xffffff);
  g.circle(cx - 9.5 * u, eyeY + 0.5 * u, 2.4 * u).fill(look.eyes);
  g.circle(cx + 10.5 * u, eyeY + 0.5 * u, 2.4 * u).fill(look.eyes);
  if (look.age === 'old') {
    g.moveTo(cx - 15 * u, eyeY + 5 * u)
      .lineTo(cx - 11 * u, eyeY + 6 * u)
      .stroke({ width: 1 * u, color: shade(look.skin, 0.75) });
    g.moveTo(cx + 15 * u, eyeY + 5 * u)
      .lineTo(cx + 11 * u, eyeY + 6 * u)
      .stroke({ width: 1 * u, color: shade(look.skin, 0.75) });
  }
  g.poly([cx, eyeY + 2 * u, cx - 4 * u, eyeY + 12 * u, cx + 3 * u, eyeY + 12 * u]).fill(
    shade(look.skin, 0.82),
  );
  g.ellipse(cx - 15 * u, eyeY + 12 * u, 4 * u, 2.5 * u).fill({ color: 0xe5737a, alpha: 0.35 });
  g.ellipse(cx + 15 * u, eyeY + 12 * u, 4 * u, 2.5 * u).fill({ color: 0xe5737a, alpha: 0.35 });

  // Facial hair before the mouth so a moustache sits above the lips.
  if (look.facialHair === 'beard') {
    g.ellipse(cx, faceY + faceH - 8 * u, faceW - 2 * u, 12 * u).fill(look.hair);
    g.ellipse(cx, eyeY + 19 * u, 7 * u, 3 * u).fill(look.skin);
  } else if (look.facialHair === 'stubble') {
    g.ellipse(cx, faceY + faceH - 8 * u, faceW - 4 * u, 10 * u).fill({
      color: look.hair,
      alpha: 0.25,
    });
  }
  // Smile.
  g.moveTo(cx - 7 * u, eyeY + 18 * u)
    .quadraticCurveTo(cx, eyeY + 24 * u, cx + 7 * u, eyeY + 18 * u)
    .stroke({ width: 2 * u, color: 0x7a2e2e });
  if (look.facialHair === 'moustache') {
    g.ellipse(cx - 5 * u, eyeY + 15 * u, 6 * u, 2.6 * u).fill(look.hair);
    g.ellipse(cx + 5 * u, eyeY + 15 * u, 6 * u, 2.6 * u).fill(look.hair);
  }

  // Accessories on top.
  switch (look.accessory) {
    case 'glasses':
      g.circle(cx - 10 * u, eyeY, 6 * u).stroke({ width: 1.6 * u, color: 0x222222 });
      g.circle(cx + 10 * u, eyeY, 6 * u).stroke({ width: 1.6 * u, color: 0x222222 });
      g.moveTo(cx - 4 * u, eyeY)
        .lineTo(cx + 4 * u, eyeY)
        .stroke({ width: 1.6 * u, color: 0x222222 });
      break;
    case 'sunglasses':
      g.roundRect(cx - 17 * u, eyeY - 4 * u, 14 * u, 9 * u, 3 * u).fill(0x111111);
      g.roundRect(cx + 3 * u, eyeY - 4 * u, 14 * u, 9 * u, 3 * u).fill(0x111111);
      g.rect(cx - 3 * u, eyeY - 2 * u, 6 * u, 2 * u).fill(0x111111);
      break;
    case 'hat':
      g.ellipse(cx, faceY - faceH + 4 * u, faceW + 10 * u, 5 * u).fill(0x2b2b2b);
      g.roundRect(
        cx - faceW + 2 * u,
        faceY - faceH - 14 * u,
        (faceW - 2 * u) * 2,
        18 * u,
        4 * u,
      ).fill(0x2b2b2b);
      g.rect(cx - faceW + 2 * u, faceY - faceH - 2 * u, (faceW - 2 * u) * 2, 3 * u).fill(0x9d0208);
      break;
    case 'chef-hat':
      g.rect(cx - faceW + 4 * u, faceY - faceH - 4 * u, (faceW - 4 * u) * 2, 10 * u).fill(0xffffff);
      for (const dx of [-12, 0, 12])
        g.circle(cx + dx * u, faceY - faceH - 12 * u, 11 * u).fill(0xffffff);
      g.rect(cx - faceW + 4 * u, faceY - faceH + 2 * u, (faceW - 4 * u) * 2, 2 * u).fill(0xdddddd);
      break;
    case 'bow':
      g.poly([
        cx + 8 * u,
        faceY - faceH + 2 * u,
        cx + 20 * u,
        faceY - faceH - 6 * u,
        cx + 20 * u,
        faceY - faceH + 8 * u,
      ]).fill(0xe63946);
      g.poly([
        cx + 8 * u,
        faceY - faceH + 2 * u,
        cx - 4 * u,
        faceY - faceH - 6 * u,
        cx - 4 * u,
        faceY - faceH + 8 * u,
      ]).fill(0xe63946);
      g.circle(cx + 8 * u, faceY - faceH + 2 * u, 3 * u).fill(0xb3261e);
      break;
    case 'headband':
      g.rect(cx - faceW, faceY - faceH + 9 * u, faceW * 2, 4 * u).fill(0xffd166);
      break;
    default:
      break;
  }
}
