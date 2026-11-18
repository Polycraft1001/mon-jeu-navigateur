// =====================================================
//  DÉCOR « DIRECTION ARTISTIQUE »
//  Style : ville colorée et chaleureuse, un peu « dessin animé »
//  - boutiques au rez-de-chaussée : vitrines, auvents rayés, enseignes
//  - terrasses de café avec parasols, jardinières fleuries
//  - abribus, panneaux publicitaires sur les murs et les toits
//  - arbres bien ronds, dirigeable et montgolfières dans le ciel
//  Toutes les images sont dessinées par le code (canvas) et
//  regroupées en très peu d'objets 3D pour garder le jeu fluide.
// =====================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scene } from '../render/engine.js';
import { makeRng, dummy, isMobile } from '../core/utils.js';
import { colliders, blocks, trees, propParts, propMeshes, windowMats, neonMats, BLOCK, CELL, HALF, ROAD, blockCenter } from './city.js';

const R = makeRng(4242); // hasard à part : la ville elle-même ne change pas
const pick = (a) => a[Math.floor(R() * a.length)];
const Y0 = 0.24;         // hauteur du trottoir

// ----- Petits outils de dessin -----
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
// zone d'une image dans une grande planche (atlas) -> coordonnées de texture
const cellUV = (x, y, w, h, W, H) => [x / W, 1 - (y + h) / H, (x + w) / W, 1 - y / H];
const FONT = '"Trebuchet MS", "Segoe UI", Arial, sans-serif';
function fitText(g, text, maxW, size) {
  let s = size;
  do { g.font = 'bold ' + s + 'px ' + FONT; s -= 2; } while (g.measureText(text).width > maxW && s > 10);
}
function title(g, text, x, y, size, color, maxW = 300) {
  g.textAlign = 'center'; g.textBaseline = 'middle';
  fitText(g, text, maxW, size);
  g.lineJoin = 'round';
  g.lineWidth = Math.max(3, size / 7); g.strokeStyle = 'rgba(0,0,0,0.45)'; g.strokeText(text, x, y);
  g.fillStyle = color; g.fillText(text, x, y);
}

// ----- Les boutiques -----
const SHOPS = [
  { t: '☕ Café', bg: '#3b2418', fg: '#ffe7b3', aw: 0, food: true },
  { t: '🍕 Pizza', bg: '#b3202a', fg: '#fff4d6', aw: 1, food: true },
  { t: '🥖 Boulangerie', bg: '#f3e2c0', fg: '#7a4a1e', aw: 2 },
  { t: '🌷 Fleurs', bg: '#2f7d4a', fg: '#ffffff', aw: 3 },
  { t: '🍦 Glaces', bg: '#ff8fb8', fg: '#ffffff', aw: 4, food: true },
  { t: '🍣 Sushi', bg: '#1d1d1d', fg: '#ff6b6b', aw: 5, food: true },
  { t: '🍔 Burger', bg: '#ffb300', fg: '#5a2a00', aw: 1, food: true },
  { t: '📚 Librairie', bg: '#24476b', fg: '#f6e7c1', aw: 6 },
  { t: '🎵 Musique', bg: '#5b2a86', fg: '#ffe066', aw: 7 },
  { t: '👗 Mode', bg: '#ffffff', fg: '#222222', aw: 6 },
  { t: '✚ Pharmacie', bg: '#11a650', fg: '#ffffff', aw: 3 },
  { t: '🔧 Garage', bg: '#30343b', fg: '#ffcc00', aw: 7 },
  { t: '🎬 Cinéma', bg: '#7a0d18', fg: '#ffd76a', aw: 5 },
  { t: '🍷 Bistrot', bg: '#5a1e2b', fg: '#f3d9a4', aw: 0, food: true },
  { t: '⚽ Sport', bg: '#0b63c4', fg: '#ffffff', aw: 2 },
  { t: '🍬 Bonbons', bg: '#ffd3ec', fg: '#d6267a', aw: 4 },
];
const AWNINGS = [['#2f6b3a', '#f4ecd8'], ['#c62828', '#ffffff'], ['#1f4e8c', '#ffffff'], ['#2e7d32', '#e8f5e9'],
  ['#ff7aa8', '#fff0f6'], ['#222222', '#e53935'], ['#7a5230', '#f1e3c8'], ['#6a1b9a', '#ffd54f']];
const FRAMES = ['#2b2b2b', '#5a3a22', '#1f3d2b', '#1c2c4a'];
const FLOWERS = ['#ff5d8f', '#c77dff', '#ffd60a', '#ff4d4d', '#ffffff', '#ff9f1c'];

// Enseignes (16 noms sur une seule image)
const signTex = canvasTex(1024, 512, (g) => {
  SHOPS.forEach((s, k) => {
    const x = (k % 2) * 512, y = Math.floor(k / 2) * 64;
    g.fillStyle = s.bg; roundRect(g, x + 4, y + 4, 504, 56, 12); g.fill();
    g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.stroke();
    g.fillStyle = s.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    fitText(g, s.t, 470, 40); g.fillText(s.t, x + 256, y + 34);
    s.uv = cellUV(x, y, 512, 64, 1024, 512);
  });
});
// Toiles d'auvent rayées
const awTex = canvasTex(512, 64, (g) => {
  AWNINGS.forEach(([a, b], k) => {
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(k * 64 + i * 16, 0, 16, 64); }
    const sh = g.createLinearGradient(0, 0, 0, 64);
    sh.addColorStop(0, 'rgba(0,0,0,0.22)'); sh.addColorStop(0.35, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = sh; g.fillRect(k * 64, 0, 64, 64);
  });
});
const AW_UV = AWNINGS.map((_, k) => cellUV(k * 64 + 1, 0, 62, 64, 512, 64));
// Vitrines éclairées (étagères, porte, reflets)
const storeTex = canvasTex(1024, 256, (g) => {
  FRAMES.forEach((f, k) => {
    const x = k * 256;
    g.fillStyle = f; g.fillRect(x, 0, 256, 256);
    const gl = g.createLinearGradient(0, 26, 0, 226);
    gl.addColorStop(0, '#fff0c8'); gl.addColorStop(1, '#d0904f');
    g.fillStyle = gl; g.fillRect(x + 14, 26, 160, 200);
    for (let s = 0; s < 3; s++) {
      const yy = 80 + s * 50;
      g.fillStyle = 'rgba(90,50,20,0.7)'; g.fillRect(x + 18, yy, 152, 5);
      for (let p = 0; p < 7; p++) {
        g.fillStyle = ['#e85d75', '#4fb3d9', '#ffd166', '#7bc67b', '#b38cd9'][(p + s + k) % 5];
        g.fillRect(x + 24 + p * 21, yy - 16, 13, 16);
      }
    }
    g.fillStyle = '#9ec7d6'; g.fillRect(x + 188, 40, 56, 216);
    g.fillStyle = 'rgba(255,230,170,0.7)'; g.fillRect(x + 192, 44, 48, 212);
    g.fillStyle = '#d4af37'; g.fillRect(x + 194, 140, 6, 24);
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 10;
    g.beginPath(); g.moveTo(x + 40, 222); g.lineTo(x + 110, 30); g.moveTo(x + 80, 222); g.lineTo(x + 150, 40); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, 226, 180, 30);
  });
});
const STORE_UV = FRAMES.map((_, k) => cellUV(k * 256, 0, 256, 256, 1024, 256));

// ----- Affiches publicitaires (8 pubs sur une seule image) -----
function mountains(g, x, base, col, hgt, seed) {
  g.fillStyle = col; g.beginPath(); g.moveTo(x, base);
  for (let i = 0; i <= 8; i++) g.lineTo(x + i * 64, base - hgt * (0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + seed))));
  g.lineTo(x + 512, base); g.closePath(); g.fill();
}
function drawCar(g, x, y, s, col) {
  g.fillStyle = col;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 * s, y - 18 * s); g.lineTo(x + 70 * s, y - 30 * s); g.lineTo(x + 120 * s, y - 30 * s);
  g.lineTo(x + 160 * s, y - 14 * s); g.lineTo(x + 200 * s, y - 10 * s); g.lineTo(x + 205 * s, y); g.closePath(); g.fill();
  g.fillStyle = 'rgba(160,220,255,0.9)';
  g.beginPath(); g.moveTo(x + 78 * s, y - 27 * s); g.lineTo(x + 116 * s, y - 27 * s); g.lineTo(x + 140 * s, y - 15 * s); g.lineTo(x + 66 * s, y - 15 * s); g.closePath(); g.fill();
  for (const wx of [45, 160]) {
    g.fillStyle = '#111'; g.beginPath(); g.arc(x + wx * s, y, 17 * s, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#bbb'; g.beginPath(); g.arc(x + wx * s, y, 8 * s, 0, Math.PI * 2); g.fill();
  }
}
function grad(g, x, y, a, b) {
  const gr = g.createLinearGradient(x, y, x + 200, y + 256);
  gr.addColorStop(0, a); gr.addColorStop(1, b);
  g.fillStyle = gr; g.fillRect(x, y, 512, 256);
}
const POSTERS = [
  (g, x, y) => { // montagnes au coucher du soleil (sans texte : sert aussi aux abribus)
    const sk = g.createLinearGradient(0, y, 0, y + 256);
    sk.addColorStop(0, '#2b1055'); sk.addColorStop(0.55, '#d9437a'); sk.addColorStop(1, '#ffb35c');
    g.fillStyle = sk; g.fillRect(x, y, 512, 256);
    g.fillStyle = '#ffe08a'; g.beginPath(); g.arc(x + 256, y + 140, 50, 0, Math.PI * 2); g.fill();
    mountains(g, x, y + 256, '#7a3577', 130, 1); mountains(g, x, y + 256, '#3a1450', 80, 2.5);
  },
  (g, x, y) => { // pub du jeu
    grad(g, x, y, '#0d1b2a', '#1b6f9c');
    g.fillStyle = '#333a44'; g.fillRect(x, y + 200, 512, 56);
    g.fillStyle = '#ffd23f'; for (let i = 0; i < 6; i++) g.fillRect(x + 20 + i * 90, y + 226, 50, 6);
    drawCar(g, x + 260, y + 205, 1.1, '#ff3b3b');
    title(g, 'TURBO CITY', x + 150, y + 70, 64, '#ffd23f', 270);
    title(g, 'La ville à fond !', x + 150, y + 140, 30, '#ffffff', 260);
  },
  (g, x, y) => { // soda
    grad(g, x, y, '#ff5e62', '#ff9966');
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(x + 30 + ((i * 97) % 470), y + 20 + ((i * 53) % 220), 5 + (i % 4) * 4, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#2ec4b6'; roundRect(g, x + 70, y + 60, 70, 175, 20); g.fill(); g.fillRect(x + 92, y + 30, 26, 40);
    g.fillStyle = '#ffffff'; g.fillRect(x + 70, y + 120, 70, 40);
    title(g, 'SODA FIZZ', x + 330, y + 105, 64, '#ffffff', 300);
    title(g, 'Trop frais !', x + 330, y + 170, 34, '#fff3b0', 280);
  },
  (g, x, y) => { // radio
    grad(g, x, y, '#6a11cb', '#2575fc');
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 8;
    for (let r = 30; r <= 110; r += 26) { g.beginPath(); g.arc(x + 100, y + 128, r, -0.8, 0.8); g.stroke(); }
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + 100, y + 128, 14, 0, Math.PI * 2); g.fill();
    title(g, 'RADIO TURBO', x + 330, y + 100, 56, '#ffffff', 300);
    title(g, '101.5 FM', x + 330, y + 170, 44, '#7cf7ff', 280);
  },
  (g, x, y) => { // pizza
    grad(g, x, y, '#1f6f3a', '#3fa055');
    g.fillStyle = '#f4c26b'; g.beginPath(); g.arc(x + 120, y + 128, 92, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d9442b'; g.beginPath(); g.arc(x + 120, y + 128, 76, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffe9a8'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(x + 120 + Math.cos(i * 2.4) * 45, y + 128 + Math.sin(i * 2.4) * 45, 12, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#8b1a1a'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(x + 120 + Math.cos(i * 1.1 + 0.5) * 28, y + 128 + Math.sin(i * 1.1 + 0.5) * 28, 11, 0, Math.PI * 2); g.fill(); }
    title(g, 'PIZZA ROMA', x + 350, y + 100, 56, '#ffffff', 280);
    title(g, 'Livrée en 10 min', x + 350, y + 170, 30, '#fff3b0', 270);
  },
  (g, x, y) => { // grand prix
    g.fillStyle = '#111111'; g.fillRect(x, y, 512, 256);
    for (let i = 0; i < 32; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#ffffff' : '#111111';
      g.fillRect(x + i * 16, y + j * 16, 16, 16); g.fillRect(x + i * 16, y + 224 + j * 16, 16, 16);
    }
    title(g, 'GRAND PRIX', x + 256, y + 105, 72, '#ff2e2e', 440);
    title(g, 'Dimanche • Circuit Turbo', x + 256, y + 170, 30, '#ffffff', 420);
  },
  (g, x, y) => { // cinéma
    grad(g, x, y, '#120c2c', '#3a1d6e');
    g.fillStyle = '#ffffff'; for (let i = 0; i < 40; i++) g.fillRect(x + ((i * 131) % 510), y + ((i * 71) % 250), 2, 2);
    title(g, 'CINÉ NUIT', x + 256, y + 100, 72, '#ffd76a', 440);
    title(g, 'Ce soir : Turbo 3', x + 256, y + 170, 34, '#ffffff', 420);
  },
  (g, x, y) => { // glaces
    grad(g, x, y, '#ffd6e8', '#ffb3d1');
    g.fillStyle = '#e0a458'; g.beginPath(); g.moveTo(x + 80, y + 120); g.lineTo(x + 150, y + 120); g.lineTo(x + 115, y + 240); g.closePath(); g.fill();
    for (const [cx, cy, c] of [[100, 100, '#ff6fa5'], [130, 100, '#8fd3ff'], [115, 72, '#fff1a8']]) { g.fillStyle = c; g.beginPath(); g.arc(x + cx, y + cy, 28, 0, Math.PI * 2); g.fill(); }
    title(g, 'GLACES MIAM', x + 330, y + 105, 56, '#ff4f9a', 300);
    title(g, '2 boules = 1 €', x + 330, y + 170, 34, '#7a3cff', 280);
  },
];
const posterTex = canvasTex(1024, 1024, (g) => {
  POSTERS.forEach((draw, k) => {
    const x = (k % 2) * 512, y = Math.floor(k / 2) * 256;
    g.save(); g.beginPath(); g.rect(x, y, 512, 256); g.clip();
    draw(g, x, y);
    g.restore();
  });
});
const POSTER_UV = POSTERS.map((_, k) => cellUV((k % 2) * 512 + 2, Math.floor(k / 2) * 256 + 2, 508, 252, 1024, 1024));
const BUS_UV = cellUV(166, 0, 180, 256, 1024, 1024); // morceau « montagnes » en format vertical

// ----- Matériaux -----
const storeMat = new THREE.MeshStandardMaterial({ map: storeTex, emissiveMap: storeTex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.35, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2 });
windowMats.push(storeMat);   // s'allume le soir et la nuit
const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: 0x777777, roughness: 0.6 });
const posterMat = new THREE.MeshStandardMaterial({ map: posterTex, emissiveMap: posterTex, emissive: 0x999999, roughness: 0.5 });
neonMats.push(signMat, posterMat); // brillent comme des néons
const awMat = new THREE.MeshStandardMaterial({ map: awTex, roughness: 0.85, side: THREE.DoubleSide });
const metalMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.6, roughness: 0.45 });
const woodMat = new THREE.MeshStandardMaterial({ color: 0xa8743f, roughness: 0.8 });
const tableMat = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.5 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.3, roughness: 0.1, metalness: 0.2, depthWrite: false });
const planterMat = new THREE.MeshStandardMaterial({ color: 0x5b554e, roughness: 0.9 });
const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e2228, metalness: 0.5, roughness: 0.5 });

// ----- Regroupement : beaucoup de petits morceaux -> quelques gros objets -----
const BOX = new THREE.BoxGeometry(1, 1, 1);
const PLANE = new THREE.PlaneGeometry(1, 1);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const batches = new Map();
function put(mat, geo, m, uv) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(m);
  if (uv) {
    const a = g.attributes.uv;
    for (let i = 0; i < a.count; i++) a.setXY(i, uv[0] + a.getX(i) * (uv[2] - uv[0]), uv[1] + a.getY(i) * (uv[3] - uv[1]));
  }
  if (!batches.has(mat)) batches.set(mat, []);
  batches.get(mat).push(g);
}
function flush(parent, shadowMats) {
  for (const [mat, list] of batches) {
    if (!list.length) continue;
    const geo = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = shadowMats.includes(mat);
    mesh.receiveShadow = true;
    parent.add(mesh);
  }
  batches.clear();
}
const M = new THREE.Matrix4(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function place(x, y, z, r, u, n, sx, sy, sz) {
  M.makeBasis(r, u, n); M.scale(S.set(sx, sy, sz)); M.setPosition(x, y, z);
  return M;
}
// Une « façade » : point de départ + direction vers la rue (n) + direction le long du mur (r)
function face(x, z, nx, nz) { return { x, z, n: new THREE.Vector3(nx, 0, nz), r: new THREE.Vector3(nz, 0, -nx) }; }
const px = (F, a, b) => F.x + F.r.x * a + F.n.x * b;
const pz = (F, a, b) => F.z + F.r.z * a + F.n.z * b;
function quadAt(mat, F, a, y, b, w, h, uv) { put(mat, PLANE, place(px(F, a, b), y, pz(F, a, b), F.r, UP, F.n, w, h, 1), uv); }
function boxAt(mat, F, a, y, b, w, h, d) { put(mat, BOX, place(px(F, a, b), y, pz(F, a, b), F.r, UP, F.n, w, h, d)); }
function cylAt(mat, F, a, y, b, dia, h) { put(mat, CYL, place(px(F, a, b), y, pz(F, a, b), F.r, UP, F.n, dia, h, dia)); }
const tmpR = new THREE.Vector3();
function quadN(mat, x, y, z, n, w, h, uv) { tmpR.set(n.z, 0, -n.x); put(mat, PLANE, place(x, y, z, tmpR, UP, n, w, h, 1), uv); }

// petites choses répétées (fleurs, buissons, parasols)
const bushes = [], flowers = [], parasols = [];
function instanced(geo, mat, list, shadow) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  m.count = list.length;
  const col = new THREE.Color();
  list.forEach(([x, y, z, s, c], k) => {
    dummy.position.set(x, y, z); dummy.rotation.set(0, k, 0); dummy.scale.setScalar(s); dummy.updateMatrix();
    m.setMatrixAt(k, dummy.matrix);
    if (c) m.setColorAt(k, col.set(c));
  });
  dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
  m.castShadow = shadow; m.receiveShadow = true;
  return m;
}

// ----- Une boutique sur une façade -----
function addPlanter(F, a, b) {
  boxAt(planterMat, F, a, Y0 + 0.28, b, 1.5, 0.56, 0.6);
  for (let i = -1; i <= 1; i++) {
    const x = px(F, a + i * 0.45, b), z = pz(F, a + i * 0.45, b);
    bushes.push([x, Y0 + 0.7, z, 0.36]);
    flowers.push([x, Y0 + 0.98, z, 0.2, pick(FLOWERS)]);
  }
}
function addTable(F, a, b, color) {
  cylAt(tableMat, F, a, Y0 + 0.76, b, 0.9, 0.05);
  cylAt(metalMat, F, a, Y0 + 0.37, b, 0.07, 0.74);
  for (const s of [-1, 1]) {
    const ca = a + s * 0.8;
    boxAt(woodMat, F, ca, Y0 + 0.46, b, 0.45, 0.06, 0.45);
    boxAt(woodMat, F, ca + s * 0.22, Y0 + 0.72, b, 0.05, 0.5, 0.45);
    boxAt(metalMat, F, ca, Y0 + 0.22, b, 0.06, 0.44, 0.06);
  }
  cylAt(metalMat, F, a, Y0 + 1.6, b, 0.05, 1.7);
  parasols.push([px(F, a, b), Y0 + 2.5, pz(F, a, b), 1, color]);
}
function addShop(F, W, room) {
  const shop = pick(SHOPS);
  const sw = Math.min(W * 0.78, 10);
  quadAt(storeMat, F, 0, Y0 + 1.55, 0.08, sw, 3.1, pick(STORE_UV));           // vitrine
  // auvent incliné + bande qui pend devant
  const uv = AW_UV[shop.aw], out = 1.9, drop = 0.7, len = Math.hypot(out, drop);
  const u = new THREE.Vector3(-F.n.x * out / len, drop / len, -F.n.z * out / len);
  const nn = new THREE.Vector3().crossVectors(F.r, u);
  put(awMat, PLANE, place(px(F, 0, out / 2 + 0.08), Y0 + 3.75, pz(F, 0, out / 2 + 0.08), F.r, u, nn, sw + 0.4, len, 1), uv);
  quadAt(awMat, F, 0, Y0 + 3.18, out + 0.08, sw + 0.4, 0.45, uv);
  // enseigne
  const signW = Math.min(sw * 0.8, 6.5);
  boxAt(frameMat, F, 0, Y0 + 4.75, 0.05, signW + 0.2, 1.0, 0.1);
  quadAt(signMat, F, 0, Y0 + 4.75, 0.11, signW, 0.85, shop.uv);
  // jardinières de chaque côté
  for (const s of [-1, 1]) {
    if (sw / 2 + 1.8 < W / 2) addPlanter(F, s * (sw / 2 + 1), 0.45);
    else if (R() < 0.5) addPlanter(F, s * (sw / 2 - 0.9), 0.5);
  }
  // terrasse si c'est un café / resto et qu'il y a de la place
  if (shop.food && room > 5.5) {
    const col = AWNINGS[shop.aw][0];
    addTable(F, -2.3, 3.2, col);
    addTable(F, 2.3, 3.2, col);
  }
}
function addWallPoster(F, h) {
  const y = Math.max(10, Math.min(h * 0.55, h - 6, 26));
  boxAt(frameMat, F, 0, y, 0.15, 12.8, 6.8, 0.3);
  quadAt(posterMat, F, 0, y, 0.31, 12, 6, pick(POSTER_UV));
}
function addRoofPoster(F, h) {
  for (const a of [-3.6, 3.6]) boxAt(metalMat, F, a, h + 2, -1.4, 0.3, 4, 0.3);
  boxAt(frameMat, F, 0, h + 4.4, -1.4, 10.6, 5.4, 0.3);
  quadAt(posterMat, F, 0, h + 4.4, -1.24, 10, 5, pick(POSTER_UV));
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function decorateBuildings() {
  for (const c of colliders) {
    if (c.kind !== 'b' || c.h0 < 12) continue; // seulement les immeubles (pas les maisons)
    const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2, w = c.maxX - c.minX, d = c.maxZ - c.minZ;
    if (Math.abs(cx) > HALF - ROAD || Math.abs(cz) > HALF - ROAD) continue; // pas l'aéroport
    const bx = blockCenter(Math.round((cx - blockCenter(0)) / CELL));
    const bz = blockCenter(Math.round((cz - blockCenter(0)) / CELL));
    const big = Math.abs(cx - bx) < 4 && Math.abs(cz - bz) < 4;
    let poster = false;
    for (const [nx, nz] of DIRS) {
      const off = (cx - bx) * nx + (cz - bz) * nz;
      if (!big && off < 3) continue;            // façade tournée vers l'intérieur du pâté
      const half = nx ? w / 2 : d / 2, W = nx ? d : w;
      const room = BLOCK / 2 - (off + half);    // place sur le trottoir devant
      if (room < 2.5 || W < 8) continue;
      const F = face(cx + nx * half, cz + nz * half, nx, nz);
      if (R() < 0.85) addShop(F, W, room);
      if (!poster && c.h0 > 26 && W >= 14 && R() < 0.3) { poster = true; addWallPoster(F, c.h0); }
      else if (!poster && c.h0 < 40 && W >= 12 && R() < 0.12) { poster = true; addRoofPoster(F, c.h0); }
    }
  }
}

// ----- Abribus -----
function addBusStops() {
  for (const b of blocks) {
    if ((b.type !== 'downtown' && b.type !== 'mid') || R() < 0.45) continue;
    const [nx, nz] = pick(DIRS);
    const E = BLOCK / 2 - 1.9, tx = -nz, tz = nx;
    const F = face(b.cx + nx * E + tx * 17, b.cz + nz * E + tz * 17, nx, nz);
    boxAt(frameMat, F, 0, Y0 + 2.55, -0.05, 4.0, 0.14, 1.8);                 // toit
    for (const a of [-1.9, 1.9]) for (const bb of [-0.8, 0.7]) boxAt(metalMat, F, a, Y0 + 1.25, bb, 0.09, 2.5, 0.09);
    boxAt(glassMat, F, 0, Y0 + 1.35, -0.8, 3.7, 2.0, 0.04);                    // vitre du fond
    boxAt(frameMat, F, 1.9, Y0 + 1.3, -0.05, 0.1, 2.2, 1.45);                 // panneau de pub
    for (const s of [1, -1]) {
      const n = F.r.clone().multiplyScalar(s);
      quadN(posterMat, px(F, 1.9 + s * 0.06, -0.05), Y0 + 1.3, pz(F, 1.9 + s * 0.06, -0.05), n, 1.3, 1.9, BUS_UV);
    }
    boxAt(woodMat, F, 0, Y0 + 0.48, -0.5, 2.6, 0.07, 0.45);                   // banc
    for (const a of [-1.1, 1.1]) boxAt(metalMat, F, a, Y0 + 0.24, -0.5, 0.06, 0.48, 0.4);
    boxAt(metalMat, F, -2.6, Y0 + 1.4, 0.6, 0.08, 2.8, 0.08);                 // panneau « BUS »
    boxAt(signMat, F, -2.6, Y0 + 2.7, 0.6, 0.7, 0.7, 0.05);
  }
}

// ----- Arbres plus ronds et plus verts -----
function restyleTrees() {
  const L = propMeshes.leaves;
  if (!L) return;
  const geo = mergeGeometries([
    new THREE.IcosahedronGeometry(2.0, 1).translate(0, 3.9, 0),
    new THREE.IcosahedronGeometry(1.5, 1).translate(1.2, 3.4, 0.5),
    new THREE.IcosahedronGeometry(1.4, 1).translate(-1.1, 3.5, -0.6),
    new THREE.IcosahedronGeometry(1.3, 1).translate(0.2, 5.0, -0.3),
  ]);
  if (!geo) return;
  propParts.leafGeo = geo;
  L.geometry = geo;
  propParts.leafMat.flatShading = false;
  propParts.leafMat.needsUpdate = true;
  trees.forEach((t, k) => {
    if (!t.color) return;
    t.color.setHSL(0.24 + R() * 0.08, 0.58, 0.33 + R() * 0.1);
    L.setColorAt(k, t.color);
  });
  if (L.instanceColor) L.instanceColor.needsUpdate = true;
}

// ----- Le ciel : dirigeable et montgolfières -----
let blimp = null;
const balloons = [];
function stripeTex(cols) {
  const t = canvasTex(256, 64, (g) => {
    const w = 256 / cols.length;
    cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(i * w, 0, w + 1, 64); });
  });
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1);
  return t;
}
function buildSky() {
  const sky = new THREE.Group();
  scene.add(sky);
  blimp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshStandardMaterial({ color: 0xe9edf2, roughness: 0.4, metalness: 0.1 }));
  body.scale.set(18, 5.5, 5.5);
  const red = new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.6 });
  const fin1 = new THREE.Mesh(BOX, red); fin1.scale.set(5, 10, 0.3); fin1.position.set(-15, 0, 0);
  const fin2 = new THREE.Mesh(BOX, red); fin2.scale.set(5, 0.3, 10); fin2.position.set(-15, 0, 0);
  const gond = new THREE.Mesh(BOX, frameMat); gond.scale.set(6, 1.6, 2.2); gond.position.set(2, -6, 0);
  blimp.add(body, fin1, fin2, gond);
  const bannerTex = canvasTex(512, 128, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#1d3b8f'); gr.addColorStop(1, '#0e1f52');
    g.fillStyle = gr; roundRect(g, 4, 4, 504, 120, 30); g.fill();
    title(g, 'TURBO CITY', 256, 66, 80, '#ffd23f', 470);
  });
  const bMat = new THREE.MeshStandardMaterial({ map: bannerTex, emissiveMap: bannerTex, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.5, transparent: true });
  neonMats.push(bMat);
  for (const s of [1, -1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(17, 4.2), bMat);
    p.position.set(0, 0.5, s * 5.65);
    if (s < 0) p.rotation.y = Math.PI;
    blimp.add(p);
  }
  sky.add(blimp);

  const BAL = [['#ff595e', '#ffca3a'], ['#1982c4', '#8ac926'], ['#6a4c93', '#ff924c']];
  BAL.forEach((cols, i) => {
    const m = new THREE.Group();
    const env = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), new THREE.MeshStandardMaterial({ map: stripeTex([cols[0], cols[1], cols[0], cols[1]]), roughness: 0.7 }));
    env.scale.y = 1.2;
    const basket = new THREE.Mesh(BOX, woodMat); basket.scale.set(2, 1.6, 2); basket.position.y = -11.5;
    m.add(env, basket);
    for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
      const r = new THREE.Mesh(BOX, metalMat); r.scale.set(0.06, 3.6, 0.06); r.position.set(x, -9, z); m.add(r);
    }
    sky.add(m);
    balloons.push({ mesh: m, a0: i * 2.1, r: 380 + i * 90, y: 120 + i * 22, sp: 0.01 + i * 0.004 });
  });
}

// ----- À appeler une fois, après buildCity() -----
export function initDecor() {
  restyleTrees();
  decorateBuildings();
  addBusStops();
  const group = new THREE.Group();
  group.name = 'decor';
  scene.add(group);
  flush(group, [awMat, metalMat, woodMat, tableMat, planterMat, frameMat]);
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x3f8f3a, roughness: 0.9 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  const parasolGeo = new THREE.ConeGeometry(1.5, 0.6, 10);
  group.add(
    instanced(new THREE.IcosahedronGeometry(1, 1), bushMat, bushes, !isMobile),
    instanced(new THREE.IcosahedronGeometry(1, 1), whiteMat, flowers, false),
    instanced(parasolGeo, whiteMat, parasols, true),
  );
  buildSky();
}

// ----- À chaque image : le dirigeable et les montgolfières bougent -----
let tSky = 0;
export function updateDecor(dt) {
  if (!blimp) return;
  tSky += dt;
  const a = tSky * 0.025;
  blimp.position.set(Math.cos(a) * 420, 165 + Math.sin(tSky * 0.3) * 3, Math.sin(a) * 420);
  blimp.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)); // le nez dans le sens du vol
  for (const b of balloons) {
    const ang = b.a0 + tSky * b.sp;
    b.mesh.position.set(Math.cos(ang) * b.r, b.y + Math.sin(tSky * 0.5 + b.a0) * 4, Math.sin(ang) * b.r);
    b.mesh.rotation.y += dt * 0.05;
  }
}
