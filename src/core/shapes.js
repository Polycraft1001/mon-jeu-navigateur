// =====================================================
//  FORMES « BONBON » 🍬
//  - roundBox : une boîte aux coins arrondis (immeubles, voitures...)
//  - stripeTex : rayures de sucre d'orge
//  - swirlTex : spirale de sucette
//  - labelTex : panneau avec un texte
//  - toonGradient : ombres « dessin animé » pour les persos
// =====================================================
import * as THREE from 'three';

const cache = new Map();
// w, h, d = taille · r = rayon des coins arrondis
export function roundBox(w, h, d, r, seg = 3) {
  r = Math.max(0, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01));
  const key = [w, h, d, r].map((v) => v.toFixed(2)).join('_') + '_' + seg;
  if (cache.has(key)) return cache.get(key);
  const n = 2 * seg + 2, H = n / 2;
  const g = new THREE.BoxGeometry(1, 1, 1, n, n, n);
  const P = g.attributes.position, N = g.attributes.normal;
  const half = [w / 2, h / 2, d / 2], p = [0, 0, 0], c = [0, 0, 0], s = [0, 0, 0];
  for (let i = 0; i < P.count; i++) {
    s[0] = P.getX(i); s[1] = P.getY(i); s[2] = P.getZ(i);
    for (let j = 0; j < 3; j++) {
      const k = Math.round(Math.abs(s[j]) * n);
      const lim = half[j] - r;
      const v = k === 0 ? 0 : lim + r * (k - 1) / (H - 1);
      p[j] = s[j] < 0 ? -v : v;
      c[j] = Math.max(-lim, Math.min(lim, p[j]));
    }
    const dx = p[0] - c[0], dy = p[1] - c[1], dz = p[2] - c[2], len = Math.hypot(dx, dy, dz);
    if (r > 0 && len > 1e-6) {
      const a = 1 / len;
      P.setXYZ(i, c[0] + dx * a * r, c[1] + dy * a * r, c[2] + dz * a * r);
      N.setXYZ(i, dx * a, dy * a, dz * a);
    } else P.setXYZ(i, p[0], p[1], p[2]);
  }
  g.computeBoundingBox(); g.computeBoundingSphere();
  cache.set(key, g);
  return g;
}

// comme box() de core/utils.js, mais arrondie
export function rbox(w, h, d, mat, x, y, z, parent, r = 0.25, shadow = true) {
  const m = new THREE.Mesh(roundBox(w, h, d, r), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

// ----- Couleurs bonbon -----
export const CANDY = ['#ff7eb6', '#ffc2dc', '#7fe0c4', '#b8f0d8', '#b79bff', '#ffd84d', '#ff9f6e', '#6fc3ff', '#ffffff'];
const matCache = {};
export function candyMat(color) {
  if (!matCache[color]) matCache[color] = new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.02 });
  return matCache[color];
}

// ----- Textures dessinées -----
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
// rayures en biais (sucre d'orge)
export function stripeTex(a = '#ffffff', b = '#ff4f7b', n = 4) {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = a; g.fillRect(0, 0, 128, 128);
    g.fillStyle = b;
    const P = 128 / n;
    for (let i = -n - 1; i <= n; i++) {
      const x = i * P;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + P / 2, 0); g.lineTo(x + P / 2 + 128, 128); g.lineTo(x + 128, 128); g.closePath(); g.fill();
    }
  });
}
// spirale (sucette)
export function swirlTex(a = '#ffffff', b = '#ff4f8b') {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = a; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = b; g.lineWidth = 18; g.lineCap = 'round';
    g.beginPath();
    for (let t = 0; t < 6 * Math.PI; t += 0.05) {
      const r = t / (6 * Math.PI) * 122, x = 128 + Math.cos(t) * r, y = 128 + Math.sin(t) * r;
      if (t === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  });
}
// panneau avec un texte
export function labelTex(text, bg = '#ff5c9a', fg = '#ffffff') {
  return canvasTex(512, 128, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = '#ffffff'; g.lineWidth = 10; g.strokeRect(10, 10, 492, 108);
    g.fillStyle = fg;
    g.font = 'bold 66px "Arial Rounded MT Bold", "Trebuchet MS", Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 68, 470);
  });
}

// ombres en 3 paliers (style dessin animé)
export const toonGradient = (() => {
  const t = new THREE.DataTexture(new Uint8Array([130, 205, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
