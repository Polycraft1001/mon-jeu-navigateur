// =====================================================
//  TEXTURES
//  1) Dessinées par le code (toujours disponibles)
//  2) Quelques PHOTOS chargées en ligne (textures officielles
//     de three.js, via jsDelivr) qui remplacent le dessin
//     quand elles arrivent. Sans Internet : on garde le dessin.
// =====================================================
import * as THREE from 'three';
import { clamp } from '../core/utils.js';

const R = Math.random;
const rnd = (a, b) => a + R() * (b - a);
const pickOne = (a) => a[Math.floor(R() * a.length)];
const rgb = (a, d = 0) => `rgb(${clamp(a[0] + d, 0, 255) | 0},${clamp(a[1] + d, 0, 255) | 0},${clamp(a[2] + d, 0, 255) | 0})`;

// color = false pour les textures "techniques" (relief, normales)
export function canvasTex(w, h, draw, color = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

// ----- Petits outils de dessin -----
function noise(ctx, w, h, base, amp) {
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const n = (R() - 0.5) * amp;
    img.data[i * 4] = clamp(base[0] + n, 0, 255);
    img.data[i * 4 + 1] = clamp(base[1] + n, 0, 255);
    img.data[i * 4 + 2] = clamp(base[2] + n, 0, 255);
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
// dessine aussi de l'autre côté des bords => pas de raccord visible
function wrapDraw(w, h, x, y, r, fn) {
  for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
    const X = x + dx, Y = y + dy;
    if (X + r < 0 || X - r > w || Y + r < 0 || Y - r > h) continue;
    fn(X, Y);
  }
}
// grosses taches floues (usure, saleté, humidité)
function blotches(c, w, h, n, col, aMax, rMin, rMax) {
  for (let i = 0; i < n; i++) {
    const x = R() * w, y = R() * h, r = rnd(rMin, rMax), a = rnd(aMax * 0.3, aMax);
    wrapDraw(w, h, x, y, r, (X, Y) => {
      const g = c.createRadialGradient(X, Y, 0, X, Y, r);
      g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g; c.fillRect(X - r, Y - r, r * 2, r * 2);
    });
  }
}
// petits points (gravier, poussière)
function speckle(c, w, h, n, colors, sMax = 2) {
  for (let i = 0; i < n; i++) {
    c.fillStyle = pickOne(colors);
    const s = rnd(0.6, sMax);
    c.fillRect(R() * w, R() * h, s, s);
  }
}
// fissure dans le goudron
function crack(c, w, h, steps) {
  let x = rnd(50, w - 50), y = rnd(50, h - 50), a = R() * 6.28;
  c.lineWidth = rnd(0.6, 1.4);
  c.strokeStyle = 'rgba(15,15,18,0.55)';
  c.beginPath(); c.moveTo(x, y);
  for (let i = 0; i < steps; i++) {
    a += rnd(-0.6, 0.6); x += Math.cos(a) * 4; y += Math.sin(a) * 4;
    c.lineTo(x, y);
  }
  c.stroke();
}
// brins d'herbe
function blades(c, w, h, n, colors) {
  c.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const x = R() * w, y = R() * h, l = rnd(2, 6), a = rnd(-0.5, 0.5);
    c.strokeStyle = pickOne(colors); c.globalAlpha = rnd(0.4, 0.9);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l); c.stroke();
  }
  c.globalAlpha = 1;
}

// ----- Sols -----
// Goudron : grain, gravillons, taches d'huile, fissures
export const asphaltTex = canvasTex(256, 256, (c, w, h) => {
  noise(c, w, h, [60, 62, 66], 26);
  speckle(c, w, h, 2500, ['rgba(125,125,130,0.6)', 'rgba(25,25,28,0.6)', 'rgba(150,145,135,0.4)'], 1.8);
  blotches(c, w, h, 10, '18,18,22', 0.28, 10, 40);
  blotches(c, w, h, 6, '110,110,115', 0.12, 20, 60);
  for (let i = 0; i < 3; i++) crack(c, w, h, 10);
});

// Trottoir : dalles de 1 m avec joints
export const sidewalkTex = canvasTex(256, 256, (c, w, h) => {
  noise(c, w, h, [176, 174, 168], 16);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const v = rnd(-14, 14);
    c.fillStyle = v > 0 ? `rgba(255,255,250,${v / 100})` : `rgba(40,38,35,${-v / 100})`;
    c.fillRect(x * 64, y * 64, 64, 64);
  }
  speckle(c, w, h, 900, ['rgba(90,90,90,0.4)', 'rgba(230,230,225,0.5)'], 1.6);
  blotches(c, w, h, 5, '60,55,50', 0.12, 8, 24);
  c.fillStyle = 'rgba(60,58,55,0.55)';
  for (let i = 0; i < 256; i += 64) { c.fillRect(i, 0, 2, 256); c.fillRect(0, i, 256, 2); }
  c.fillStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 256; i += 64) { c.fillRect(i + 2, 0, 1, 256); c.fillRect(0, i + 2, 256, 1); }
});

// Herbe des parcs (remplacée par une photo si possible)
export const grassTex = canvasTex(256, 256, (c, w, h) => {
  noise(c, w, h, [78, 122, 58], 26);
  blotches(c, w, h, 14, '40,70,25', 0.25, 12, 40);
  blotches(c, w, h, 10, '140,170,80', 0.15, 12, 36);
  blades(c, w, h, 3500, ['#3f6b2a', '#5a8f3a', '#6fa648', '#4d7f33', '#87b85a']);
  speckle(c, w, h, 30, ['#ffffff', '#ffe14a', '#ff9ad5'], 2.5); // petites fleurs
});

// Détails du sol des collines (en gris : la couleur vient du relief)
export const groundTex = canvasTex(256, 256, (c, w, h) => {
  noise(c, w, h, [215, 215, 215], 50);
  blotches(c, w, h, 18, '110,110,110', 0.3, 15, 50);
  blotches(c, w, h, 12, '255,255,255', 0.25, 15, 50);
  blades(c, w, h, 2500, ['#8a8a8a', '#bdbdbd', '#ffffff', '#6e6e6e']);
});

// Béton (zone des cascades)
export const concreteTex = canvasTex(256, 256, (c, w, h) => {
  noise(c, w, h, [150, 150, 152], 22);
  blotches(c, w, h, 8, '70,70,72', 0.18, 15, 45);
  blotches(c, w, h, 6, '210,210,210', 0.15, 15, 45);
  speckle(c, w, h, 600, ['rgba(40,40,40,0.6)'], 1.5);
  c.fillStyle = 'rgba(0,0,0,0.28)';
  for (let i = 0; i < 256; i += 128) { c.fillRect(i, 0, 2, 256); c.fillRect(0, i, 256, 2); }
});

// Toit plat des immeubles : gravier + rebord + trappes
export const roofTex = canvasTex(256, 256, (c, w, h) => {
  noise(c, w, h, [92, 95, 100], 38);
  speckle(c, w, h, 3000, ['rgba(140,140,140,0.6)', 'rgba(40,40,45,0.6)'], 2);
  blotches(c, w, h, 6, '30,30,35', 0.25, 15, 45);
  c.strokeStyle = '#b9b6ae'; c.lineWidth = 10; c.strokeRect(5, 5, 246, 246);
  c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 2; c.strokeRect(11, 11, 234, 234);
  for (let i = 0; i < 3; i++) {
    const x = rnd(40, 190), y = rnd(40, 190);
    c.fillStyle = '#6d7178'; c.fillRect(x, y, 18, 18);
    c.strokeStyle = '#2a2c30'; c.lineWidth = 2; c.strokeRect(x, y, 18, 18);
  }
});

// Tuiles des maisons (claires : la couleur du toit s'ajoute dessus)
export const roofTileTex = canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = '#e8e8e8'; c.fillRect(0, 0, w, h);
  for (let row = 0; row < 8; row++) {
    const y = row * 16, off = (row % 2) * 8;
    for (let x = -16; x < w + 16; x += 16) {
      const v = rnd(195, 250) | 0;
      c.fillStyle = `rgb(${v},${v},${v})`;
      c.beginPath();
      c.moveTo(x + off, y); c.lineTo(x + off + 16, y); c.lineTo(x + off + 16, y + 12);
      c.quadraticCurveTo(x + off + 8, y + 18, x + off, y + 12); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1.5; c.stroke();
    }
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, y + 13, w, 3);
  }
});

// Vaguelettes de l'eau (carte de normales, remplacée par une photo si possible)
export const waterNormal = canvasTex(256, 256, (c, w, h) => {
  const img = c.createImageData(w, h);
  const waves = [];
  for (let i = 0; i < 7; i++) {
    waves.push({ kx: Math.round(rnd(-6, 6)) || 1, ky: Math.round(rnd(-6, 6)) || 2, a: rnd(0.015, 0.05), p: R() * 6.28 });
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let dx = 0, dy = 0;
    for (const v of waves) {
      const d = v.a * Math.cos(6.2832 * (v.kx * x / w + v.ky * y / h) + v.p);
      dx += d * v.kx; dy += d * v.ky;
    }
    const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255;
    img.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255;
    img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
}, false);

// ----- Tremplin, fumée, traces -----
export const rampTex = canvasTex(64, 64, (c) => {
  c.fillStyle = '#f2c230'; c.fillRect(0, 0, 64, 64);
  c.fillStyle = '#222';
  for (let i = -64; i < 128; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 16, 0); c.lineTo(i + 80, 64); c.lineTo(i + 64, 64); c.fill(); }
});
export const smokeTex = canvasTex(64, 64, (c) => {
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
});
// trace noire laissée au sol par une explosion
export const scorchTex = canvasTex(64, 64, (c) => {
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(10,10,10,0.9)'); g.addColorStop(0.6, 'rgba(20,20,20,0.6)'); g.addColorStop(1, 'rgba(20,20,20,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
});

// =====================================================
//  FAÇADES D'IMMEUBLES (8 x 8 fenêtres par texture)
//  0 = tour en verre, 1 = bureaux, 2 = pierre,
//  3 = briques rouges, 4 = immeuble blanc avec balcons
// =====================================================
export const FACADES = [
  { kind: 'glass', glassy: true },
  { kind: 'office', glassy: true },
  { kind: 'stone', glassy: false },
  { kind: 'brick', glassy: false },
  { kind: 'plaster', glassy: false },
];
const S = 512, C = 64; // taille de la texture, taille d'une case (1 fenêtre)
// position de la fenêtre dans sa case : x, y, largeur, hauteur
const WIN = { glass: [3, 7, 58, 51], office: [8, 12, 48, 40], stone: [16, 12, 32, 42], brick: [16, 14, 32, 40], plaster: [12, 12, 40, 36] };

function drawWall(c, kind) {
  if (kind === 'glass') { noise(c, S, S, [34, 46, 58], 8); return; }
  if (kind === 'office') {
    noise(c, S, S, [168, 174, 180], 16);
    c.fillStyle = 'rgba(0,0,0,0.16)';
    for (let i = 0; i < S; i += C) { c.fillRect(i, 0, 1, S); c.fillRect(0, i, S, 1); }
    return;
  }
  if (kind === 'stone') {
    noise(c, S, S, [204, 192, 172], 16);
    c.fillStyle = 'rgba(95,82,62,0.30)';
    for (let y = 0, r = 0; y < S; y += 16, r++) {
      c.fillRect(0, y, S, 1);
      for (let x = (r % 2) * 32; x < S; x += 64) c.fillRect(x, y, 1, 16);
    }
    blotches(c, S, S, 10, '120,105,85', 0.12, 20, 60);
    return;
  }
  if (kind === 'brick') {
    c.fillStyle = '#a99d90'; c.fillRect(0, 0, S, S); // mortier
    for (let y = 0, r = 0; y < S; y += 8, r++) for (let x = -(r % 2) * 8; x < S; x += 16) {
      const v = rnd(-24, 24);
      c.fillStyle = rgb([150 + v, 72 + v * 0.5, 52 + v * 0.4]);
      c.fillRect(x + 1, y + 1, 15, 6);
    }
    blotches(c, S, S, 10, '40,25,20', 0.15, 20, 60);
    return;
  }
  // enduit blanc
  noise(c, S, S, [232, 228, 220], 10);
  blotches(c, S, S, 12, '150,145,135', 0.12, 20, 70);
}

function drawWindow(c, kind, X, Y, w, h, col) {
  const glassy = kind === 'glass' || kind === 'office';
  const tint = glassy ? pickOne([[92, 138, 182], [108, 152, 196], [78, 118, 160]]) : pickOne([[52, 66, 82], [62, 78, 96], [44, 56, 70]]);
  // linteau et appui de fenêtre
  if (kind === 'stone' || kind === 'brick') {
    c.fillStyle = kind === 'stone' ? '#e3d8c2' : '#d6cdbf';
    c.fillRect(X - 4, Y - 6, w + 8, 5);
    c.fillRect(X - 4, Y + h + 1, w + 8, 4);
  }
  if (kind === 'office') { c.fillStyle = '#e4e7ea'; c.fillRect(X - 2, Y + h, w + 4, 3); }
  // vitre : dégradé = reflet du ciel
  const g = c.createLinearGradient(X, Y, X + w * 0.5, Y + h);
  g.addColorStop(0, rgb(tint, 45)); g.addColorStop(0.55, rgb(tint)); g.addColorStop(1, rgb(tint, -28));
  c.fillStyle = g; c.fillRect(X, Y, w, h);
  c.save(); c.beginPath(); c.rect(X, Y, w, h); c.clip();
  // reflet en diagonale
  c.fillStyle = 'rgba(255,255,255,0.13)';
  const o = rnd(0, w);
  c.beginPath(); c.moveTo(X + o, Y); c.lineTo(X + o + w * 0.25, Y); c.lineTo(X + o - w * 0.3, Y + h); c.lineTo(X + o - w * 0.55, Y + h); c.fill();
  // rideaux / stores
  if (!glassy && R() < 0.35) {
    c.fillStyle = pickOne(['rgba(235,228,210,0.85)', 'rgba(200,170,140,0.8)', 'rgba(170,190,205,0.8)']);
    c.fillRect(X, Y, w, h * rnd(0.2, 0.6));
  }
  c.restore();
  // cadre et montants
  c.strokeStyle = kind === 'plaster' ? '#3a3f45' : kind === 'glass' ? '#1c252e' : kind === 'office' ? '#c9ced4' : '#f2f0ea';
  c.lineWidth = kind === 'glass' ? 2 : 3;
  c.strokeRect(X, Y, w, h);
  c.beginPath(); c.moveTo(X + w / 2, Y); c.lineTo(X + w / 2, Y + h);
  if (kind === 'stone' || kind === 'brick') { c.moveTo(X, Y + h * 0.38); c.lineTo(X + w, Y + h * 0.38); }
  c.stroke();
  // balcons (une colonne sur deux)
  if (kind === 'plaster' && col % 2 === 0) {
    c.fillStyle = '#cfcac0'; c.fillRect(X - 6, Y + h + 4, w + 12, 4);
    c.fillStyle = '#4a4f55'; c.fillRect(X - 6, Y + h - 8, w + 12, 2);
    for (let bx = X - 6; bx <= X + w + 6; bx += 4) c.fillRect(bx, Y + h - 8, 1, 12);
  }
}

export const facadeTex = FACADES.map((f) => {
  const [ix, iy, ww, wh] = WIN[f.kind];
  const lit = [];
  const map = canvasTex(S, S, (c) => {
    drawWall(c, f.kind);
    for (let y = 0; y < 8; y++) {
      if (f.kind === 'glass') { // dalle entre les étages
        c.fillStyle = '#18212a'; c.fillRect(0, y * C, S, 6);
        c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(0, y * C + 6, S, 1);
      }
      for (let x = 0; x < 8; x++) {
        drawWindow(c, f.kind, x * C + ix, y * C + iy, ww, wh, x);
        lit.push(R() < 0.38);
      }
    }
  });
  // fenêtres allumées la nuit
  const em = canvasTex(S, S, (c) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, S, S);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      if (!lit[y * 8 + x]) continue;
      const X = x * C + ix, Y = y * C + iy;
      c.fillStyle = pickOne(['#ffd27a', '#ffd27a', '#ffbf66', '#cfe6ff']);
      c.fillRect(X, Y, ww, wh);
      const g = c.createLinearGradient(X, Y, X, Y + wh);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
      c.fillStyle = g; c.fillRect(X, Y, ww, wh);
      c.fillStyle = '#000'; c.fillRect(X + ww / 2 - 1, Y, 2, wh);
    }
  });
  return { map, em };
});

// ----- Maisons : bardage, volets, porte en bois -----
const HOUSE_WIN = [28, 176];
export const houseTex = canvasTex(256, 128, (c, w, h) => {
  c.fillStyle = '#f4f4f4'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 8) {
    c.fillStyle = 'rgba(0,0,0,0.10)'; c.fillRect(0, y + 6, w, 2);
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(0, y, w, 1);
  }
  c.fillStyle = '#8d8a85'; c.fillRect(0, h - 10, w, 10); // soubassement
  for (const X of HOUSE_WIN) {
    c.fillStyle = '#4f6b4a'; c.fillRect(X - 14, 31, 11, 54); c.fillRect(X + 55, 31, 11, 54); // volets
    c.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 35; y < 84; y += 5) { c.fillRect(X - 13, y, 9, 1); c.fillRect(X + 56, y, 9, 1); }
    c.fillStyle = '#ffffff'; c.fillRect(X - 3, 31, 58, 54);
    const g = c.createLinearGradient(X, 34, X + 30, 82);
    g.addColorStop(0, '#7e9cb8'); g.addColorStop(1, '#2f3d4c');
    c.fillStyle = g; c.fillRect(X, 34, 52, 48);
    c.fillStyle = '#ffffff'; c.fillRect(X + 24, 34, 3, 48); c.fillRect(X, 56, 52, 3);
    c.fillStyle = '#dddddd'; c.fillRect(X - 5, 85, 62, 4);
  }
  c.fillStyle = '#ffffff'; c.fillRect(105, 52, 46, 66);
  c.fillStyle = '#7a4f2e'; c.fillRect(108, 55, 40, 63);
  c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 2;
  c.strokeRect(113, 60, 13, 22); c.strokeRect(130, 60, 13, 22); c.strokeRect(113, 88, 13, 24); c.strokeRect(130, 88, 13, 24);
  c.fillStyle = '#d8b04a'; c.beginPath(); c.arc(141, 88, 2.5, 0, 6.3); c.fill();
  c.fillStyle = '#9a9690'; c.fillRect(100, 118, 56, 10);
});
export const houseEm = canvasTex(256, 128, (c) => {
  c.fillStyle = '#000'; c.fillRect(0, 0, 256, 128);
  for (const X of HOUSE_WIN) {
    c.fillStyle = '#ffcf80'; c.fillRect(X, 34, 52, 48);
    c.fillStyle = '#000'; c.fillRect(X + 24, 34, 3, 48); c.fillRect(X, 56, 52, 3);
  }
});

// =====================================================
//  PHOTOS EN LIGNE (textures officielles de three.js)
//  Elles remplacent le dessin dès qu'elles sont chargées.
// =====================================================
const PHOTO_URL = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/';
const loader = new THREE.TextureLoader();
loader.setCrossOrigin('anonymous');
export function upgradeWithPhoto(tex, file) {
  loader.load(PHOTO_URL + file, (photo) => {
    tex.source = photo.source; // nouvelle image, mêmes réglages (répétition...)
    tex.needsUpdate = true;
  }, undefined, () => console.info('Photo non chargée, on garde le dessin :', file));
}
upgradeWithPhoto(grassTex, 'terrain/grasslight-big.jpg');
upgradeWithPhoto(waterNormal, 'waternormals.jpg');
