// =====================================================
//  TEXTURES dessinées par le code (remplacées par des
//  photos en ligne quand elles sont chargées)
// =====================================================
import * as THREE from 'three';
import { clamp } from '../core/utils.js';

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function noise(ctx, w, h, base, amp) {
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const n = (Math.random() - 0.5) * amp;
    img.data[i * 4] = clamp(base[0] + n, 0, 255);
    img.data[i * 4 + 1] = clamp(base[1] + n, 0, 255);
    img.data[i * 4 + 2] = clamp(base[2] + n, 0, 255);
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
export const asphaltTex = canvasTex(128, 128, (c, w, h) => noise(c, w, h, [62, 64, 68], 22));
export const sidewalkTex = canvasTex(128, 128, (c, w, h) => {
  noise(c, w, h, [178, 176, 170], 18);
  c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 2;
  for (let i = 0; i <= 128; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 128); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(128, i); c.stroke(); }
});
export const grassTex = canvasTex(128, 128, (c, w, h) => noise(c, w, h, [78, 122, 58], 30));
export const concreteTex = canvasTex(128, 128, (c, w, h) => noise(c, w, h, [150, 150, 152], 25));
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

// Façades d'immeubles (8 x 8 fenêtres par texture)
export const FACADES = [
  { wall: '#2b3a4a', glass: ['#5d86b0', '#6f9cc8', '#4a729a'], inset: 2, glassy: true },
  { wall: '#9aa4ad', glass: ['#3d5a73', '#4f6f8a'], inset: 4, glassy: true },
  { wall: '#c9bfae', glass: ['#3b4654', '#56606d'], inset: 7, glassy: false },
  { wall: '#8c4a3a', glass: ['#2f3a44', '#45505a'], inset: 7, glassy: false },
  { wall: '#e6e2da', glass: ['#4a5866', '#5b6977'], inset: 7, glassy: false },
];
export const facadeTex = FACADES.map((f) => {
  const lit = [];
  const map = canvasTex(256, 256, (c) => {
    c.fillStyle = f.wall; c.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      c.fillStyle = f.glass[Math.floor(Math.random() * f.glass.length)];
      c.fillRect(x * 32 + f.inset, y * 32 + f.inset + 2, 32 - f.inset * 2, 32 - f.inset * 2 - 2);
      lit.push(Math.random() < 0.38);
    }
  });
  const em = canvasTex(256, 256, (c) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      if (!lit[y * 8 + x]) continue;
      c.fillStyle = Math.random() < 0.7 ? '#ffd27a' : '#cfe6ff';
      c.fillRect(x * 32 + f.inset, y * 32 + f.inset + 2, 32 - f.inset * 2, 32 - f.inset * 2 - 2);
    }
  });
  return { map, em };
});
export const houseTex = canvasTex(128, 64, (c) => {
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, 128, 64);
  c.fillStyle = '#3a4450';
  c.fillRect(14, 18, 26, 22); c.fillRect(88, 18, 26, 22);
  c.fillStyle = '#6b4a32'; c.fillRect(54, 28, 20, 36);
});
export const houseEm = canvasTex(128, 64, (c) => {
  c.fillStyle = '#000'; c.fillRect(0, 0, 128, 64);
  c.fillStyle = '#ffcf80';
  c.fillRect(14, 18, 26, 22); c.fillRect(88, 18, 26, 22);
});
