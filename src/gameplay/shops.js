// =====================================================
//  BOUTIQUES 🛍️ : on y entre à pied en marchant dans le
//  cercle devant la porte.
//   👕 MODE BONBON     : tenues + chapeaux
//   🔫 ARMURERIE       : les armes (gardées pour toujours)
//   🍔 SNACK GOURMAND  : manger = reprendre de la vie
//  L'intérieur est une fenêtre par-dessus le jeu (jeu en pause).
//  ➜ Ajouter un article : OUTFITS, GUN_PRICES ou FOOD ci-dessous
// =====================================================
import * as THREE from 'three';
import { G } from '../core/ctx.js';
import { save, persist } from '../core/save.js';
import { WEAPONS } from '../core/config.js';
import { blocks, colliders, BLOCK, SPAWN, city } from '../world/city.js';
import { roundBox, candyMat } from '../core/shapes.js';
import { hero } from './onfoot.js';
import { selectWeapon, ownsWeapon, giveWeapon } from './weapons.js';
import { showMessage, refreshStats } from '../ui/hud.js';
import { sfx } from '../ui/audio.js';
import { openOverlay, closeOverlay } from '../ui/overlay.js';

// ----- Les articles -----
const KINDS = [
  { id: 'clothes', name: 'MODE BONBON', icon: '👕', color: '#ff7eb6', bg: 'linear-gradient(160deg,#ffe0ef,#e6dcff)', hello: 'Choisis ta tenue ! Une tenue achetée est à toi pour toujours.' },
  { id: 'guns', name: 'ARMURERIE', icon: '🔫', color: '#7b8cff', bg: 'linear-gradient(160deg,#dff3ff,#d3ccff)', hello: 'Une arme achetée est à toi pour toujours. Attention : tirer fait venir la police !' },
  { id: 'food', name: 'SNACK GOURMAND', icon: '🍔', color: '#ffad33', bg: 'linear-gradient(160deg,#fff4cc,#ffdcc8)', hello: 'Mange pour reprendre des forces !' },
];
export const OUTFITS = [
  { id: 'base', name: 'Tenue de base', icon: '🧥', price: 0, tint: null, hat: null },
  { id: 'pink', name: 'Survêt barbe à papa', icon: '🩷', price: 60, tint: '#ff9fd0', hat: null },
  { id: 'mint', name: 'Look menthe + casquette', icon: '🧢', price: 90, tint: '#8fe8c8', hat: { type: 'cap', color: '#ff5c8a' } },
  { id: 'snow', name: 'Bonnet des neiges', icon: '🧶', price: 120, tint: '#a9d0ff', hat: { type: 'beanie', color: '#ff4f6b' } },
  { id: 'cowboy', name: 'Look cowboy', icon: '🤠', price: 150, tint: '#ffc98a', hat: { type: 'cowboy', color: '#a0683e' } },
  { id: 'chic', name: 'Haut-de-forme chic', icon: '🎩', price: 250, tint: '#c3b0ff', hat: { type: 'tophat', color: '#2b2440' } },
  { id: 'king', name: 'Couronne de star', icon: '👑', price: 500, tint: '#ffe680', hat: { type: 'crown', color: '#ffd23a' } },
];
const GUN_PRICES = { pistol: 0, smg: 250, shotgun: 500, rocket: 1200 };
const FOOD = [
  { id: 'lolly', name: 'Sucette', icon: '🍭', price: 3, heal: 10 },
  { id: 'donut', name: 'Donut rose', icon: '🍩', price: 8, heal: 25 },
  { id: 'burger', name: 'Burger', icon: '🍔', price: 20, heal: 55 },
  { id: 'pizza', name: 'Pizza géante', icon: '🍕', price: 35, heal: 999 },
];
if (!Array.isArray(save.outfits)) save.outfits = ['base'];
if (!OUTFITS.some((o) => o.id === save.outfit)) save.outfit = 'base';

export const shops = [];

// ----- Petites images dessinées (enseigne, icône qui flotte) -----
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
const signTex = (k) => canvasTex(512, 128, (g, w, h) => {
  g.fillStyle = '#ffffff'; rrect(g, 0, 0, w, h, 44); g.fill();
  g.fillStyle = k.color; rrect(g, 8, 8, w - 16, h - 16, 38); g.fill();
  const text = k.icon + ' ' + k.name;
  let size = 56;
  do { g.font = 'bold ' + size + 'px system-ui, sans-serif'; size -= 2; } while (g.measureText(text).width > w - 50 && size > 20);
  g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 3);
});
const iconTex = (k) => canvasTex(128, 128, (g) => {
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
  g.lineWidth = 8; g.strokeStyle = k.color; g.stroke();
  g.font = '64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(k.icon, 64, 70);
});

// ----- Une devanture : cadre bonbon, porte, enseigne, cercle d'entrée -----
function buildShop(kind, x, face) {
  const add = (o) => { o.castShadow = true; city.add(o); return o; };
  add(new THREE.Mesh(roundBox(4.4, 4.8, 0.5, 0.22), candyMat(kind.color))).position.set(x, 0.24 + 2.4, face + 0.15);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x4a2f5c, emissive: 0xffc46b, emissiveIntensity: 0.25, roughness: 0.4 });
  add(new THREE.Mesh(roundBox(2.6, 3.5, 0.4, 0.15), doorMat)).position.set(x, 0.24 + 1.75, face + 0.35);
  add(new THREE.Mesh(roundBox(6.6, 0.4, 1.8, 0.18), candyMat('#ffffff'))).position.set(x, 4.95, face + 0.9); // auvent
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: signTex(kind), transparent: true }));
  sign.position.set(x, 6.1, face + 0.45);
  city.add(sign);
  const mx = x, mz = face + 2.9;
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.35, 32), new THREE.MeshBasicMaterial({ color: kind.color, transparent: true, opacity: 0.9, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(mx, 0.28, mz);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.0, 32), new THREE.MeshBasicMaterial({ color: kind.color, transparent: true, opacity: 0.25, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; disc.position.set(mx, 0.27, mz);
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex(kind) }));
  icon.scale.set(1.3, 1.3, 1); icon.position.set(mx, 2.3, mz);
  city.add(ring, disc, icon);
  shops.push({ kind, mx, mz, ring, icon, ready: true });
}

// Trouve la façade d'un immeuble côté rue (+z) dans ce pâté de maisons
function frontSpot(b) {
  for (const qx of [1, -1]) {
    const px = b.cx + qx * 14, pz = b.cz + 14;
    const c = colliders.find((k) => k.kind === 'b' && !k.prop && px > k.minX && px < k.maxX && pz > k.minZ && pz < k.maxZ);
    if (c && c.maxZ < b.cz + BLOCK / 2 - 4) return { x: px, face: c.maxZ };
  }
  return null;
}

export function initShops() {
  const d = (b) => Math.hypot(b.cx - SPAWN.x, b.cz - SPAWN.z);
  const list = blocks.filter((b) => b.type === 'mid' || b.type === 'downtown').sort((a, b) => d(a) - d(b));
  let k = 0;
  for (const b of list) {
    if (k >= KINDS.length) break;
    if (shops.some((s) => Math.hypot(s.mx - b.cx, s.mz - b.cz) < 140)) continue; // boutiques un peu éloignées
    const s = frontSpot(b);
    if (s) buildShop(KINDS[k++], s.x, s.face);
  }
}

// =====================================================
//  TENUES : couleur des habits + chapeau sur la tête
// =====================================================
const tintCache = new Map();
const _s = new THREE.Vector3();
let hatObj = null, lookDone = false, lookTimer = 0;
function makeHat(h) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: h.color, roughness: 0.5 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xff5c8a, roughness: 0.4 });
  const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; g.add(o); };
  const dome = (r) => new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const cyl = (rt, rb, hh, n = 20) => new THREE.CylinderGeometry(rt, rb, hh, n);
  if (h.type === 'cap') {
    add(dome(0.17), m, 0, 0, 0, 1, 0.8, 1);
    add(cyl(0.12, 0.12, 0.02), m, 0, 0.01, 0.15, 1, 1, 1.3);
  } else if (h.type === 'beanie') {
    add(dome(0.18), m, 0, -0.02, 0, 1, 1.15, 1);
    add(cyl(0.186, 0.186, 0.06), white, 0, 0, 0);
    add(new THREE.SphereGeometry(0.065, 12, 8), white, 0, 0.21, 0);
  } else if (h.type === 'cowboy') {
    add(cyl(0.32, 0.32, 0.025, 28), m, 0, 0.02, 0);
    add(cyl(0.13, 0.16, 0.17), m, 0, 0.11, 0);
    add(cyl(0.162, 0.162, 0.035), pink, 0, 0.05, 0);
  } else if (h.type === 'tophat') {
    add(cyl(0.24, 0.24, 0.02, 24), m, 0, 0.01, 0);
    add(cyl(0.14, 0.14, 0.3), m, 0, 0.16, 0);
    add(cyl(0.145, 0.145, 0.05), pink, 0, 0.05, 0);
  } else if (h.type === 'crown') {
    const gold = new THREE.MeshStandardMaterial({ color: h.color, emissive: 0x553300, metalness: 0.8, roughness: 0.3 });
    add(cyl(0.16, 0.14, 0.1, 8), gold, 0, 0.05, 0);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(new THREE.SphereGeometry(0.03, 8, 6), pink, Math.cos(a) * 0.155, 0.11, Math.sin(a) * 0.155); }
  }
  return g;
}
// Met la tenue sur le perso 3D (renvoie false s'il n'est pas encore chargé)
function applyLook() {
  const o = OUTFITS.find((x) => x.id === save.outfit) || OUTFITS[0];
  let head = null, found = false;
  hero.mesh.traverse((m) => {
    if (m.isBone && !head && /Head$/.test(m.name)) head = m;
    if (!m.isSkinnedMesh || Array.isArray(m.material)) return;
    found = true;
    if (!m.userData.baseMat) m.userData.baseMat = m.material;
    const b = m.userData.baseMat;
    if (!o.tint) { m.material = b; return; }
    const key = b.uuid + o.tint;
    if (!tintCache.has(key)) { const c = b.clone(); c.color.set(o.tint).multiplyScalar(1.1); tintCache.set(key, c); }
    m.material = tintCache.get(key);
  });
  if (!found) return false;
  if (hatObj && hatObj.parent) hatObj.parent.remove(hatObj);
  hatObj = null;
  if (o.hat && head) {
    hero.mesh.updateMatrixWorld(true);
    head.getWorldScale(_s);
    const k = 1 / (_s.y || 1); // on annule l'échelle du modèle : le chapeau garde sa taille en mètres
    hatObj = makeHat(o.hat);
    hatObj.scale.multiplyScalar(k);
    hatObj.position.set(0, 0.23 * k, 0);
    head.add(hatObj);
  }
  return true;
}

// =====================================================
//  L'INTÉRIEUR DE LA BOUTIQUE (fenêtre)
// =====================================================
let panel = null, cur = null, note = { text: '', color: '#3a2550' };
const CSS = `
.tcs-wrap{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(40,20,60,.55);font-family:system-ui,'Segoe UI',sans-serif}
.tcs-box{width:min(760px,94vw);max-height:90vh;overflow:auto;border-radius:24px;padding:18px 18px 14px;box-shadow:0 14px 50px rgba(0,0,0,.45);border:4px solid #fff;color:#3a2550}
.tcs-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.tcs-title{font-size:26px;font-weight:900;flex:1}
.tcs-pill{background:#fff;border-radius:999px;padding:6px 14px;font-weight:800}
.tcs-sub{margin:6px 0 12px;opacity:.8}
.tcs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.tcs-item{background:rgba(255,255,255,.85);border-radius:18px;padding:12px;text-align:center;display:flex;flex-direction:column;gap:6px}
.tcs-ico{font-size:40px;line-height:1.1}
.tcs-name{font-weight:800}
.tcs-desc{font-size:12px;opacity:.75;flex:1}
.tcs-btn{border:0;border-radius:999px;padding:9px 12px;font-weight:800;font-size:15px;cursor:pointer;color:#fff}
.tcs-btn:disabled{opacity:.55;cursor:default}
.tcs-note{min-height:22px;margin-top:10px;text-align:center;font-weight:800}
.tcs-exit{margin-top:6px;width:100%;background:#3a2550}`;

function items(kind) {
  if (kind.id === 'clothes') return OUTFITS.map((o) => {
    const owned = o.price === 0 || save.outfits.includes(o.id), on = save.outfit === o.id;
    return { key: o.id, icon: o.icon, name: o.name, desc: o.hat ? 'Habits colorés + chapeau' : o.tint ? 'Habits colorés' : 'Comme au début', label: on ? 'Porté ✓' : owned ? 'Mettre' : o.price + ' $', off: on };
  });
  if (kind.id === 'guns') return WEAPONS.map((w, i) => ({ w, i })).filter((q) => !q.w.melee).map(({ w, i }) => {
    const owned = ownsWeapon(i), on = save.weapon === i, price = GUN_PRICES[w.id] != null ? GUN_PRICES[w.id] : 400;
    return { key: String(i), icon: w.icon, name: w.name, desc: 'Dégâts : ' + (w.dmg || '💥'), label: on ? 'En main ✓' : owned ? 'Prendre' : price + ' $', off: on };
  });
  return FOOD.map((f) => ({ key: f.id, icon: f.icon, name: f.name, desc: f.heal >= 999 ? 'Toute ta vie ❤️' : '+' + f.heal + ' de vie ❤️', label: f.price + ' $', off: false }));
}

function render() {
  const k = cur.kind;
  const life = k.id === 'food' ? '<span class="tcs-pill">❤️ ' + Math.round(hero.hp) + ' / ' + hero.maxHp + '</span>' : '';
  let html = '<div class="tcs-box" style="background:' + k.bg + '">'
    + '<div class="tcs-head"><div class="tcs-title">' + k.icon + ' ' + k.name + '</div>' + life
    + '<span class="tcs-pill">💰 ' + save.money + ' $</span></div>'
    + '<div class="tcs-sub">' + k.hello + '</div><div class="tcs-grid">';
  for (const it of items(k)) {
    html += '<div class="tcs-item"><div class="tcs-ico">' + it.icon + '</div><div class="tcs-name">' + it.name + '</div>'
      + '<div class="tcs-desc">' + it.desc + '</div>'
      + '<button class="tcs-btn" style="background:' + k.color + '" data-buy="' + it.key + '"' + (it.off ? ' disabled' : '') + '>' + it.label + '</button></div>';
  }
  html += '</div><div class="tcs-note" style="color:' + note.color + '">' + note.text + '</div>'
    + '<button class="tcs-btn tcs-exit" data-exit="1">🚪 Sortir (Échap)</button></div>';
  panel.innerHTML = html;
}
const say = (text, color = '#2a9d55') => { note = { text, color }; };

// paye si on a assez d'argent
function pay(price) {
  if (save.money < price) {
    say('Il te manque ' + (price - save.money) + ' $ ! Ramasse des pièces 🪙 ou fais des missions ⭐', '#e0284f');
    sfx('click', 0.3);
    return false;
  }
  save.money -= price; persist(); refreshStats();
  sfx('click', 0.7);
  return true;
}

function buy(key) {
  const k = cur.kind.id;
  if (k === 'clothes') {
    const o = OUTFITS.find((x) => x.id === key);
    if (!o) return;
    const owned = o.price === 0 || save.outfits.includes(o.id);
    if (!owned) { if (!pay(o.price)) { render(); return; } save.outfits.push(o.id); }
    save.outfit = o.id; persist();
    lookDone = applyLook();
    say(owned ? 'Tu portes : ' + o.name + ' ' + o.icon : 'Super achat ! ' + o.icon + ' Tu es trop stylé !');
  } else if (k === 'guns') {
    const i = Number(key), w = WEAPONS[i];
    if (!w) return;
    const owned = ownsWeapon(i);
    if (!owned) {
      const price = GUN_PRICES[w.id] != null ? GUN_PRICES[w.id] : 400;
      if (!pay(price)) { render(); return; }
      giveWeapon(i);
    }
    selectWeapon(i);
    say(owned ? w.icon + ' ' + w.name + ' en main !' : 'Acheté : ' + w.icon + ' ' + w.name + ' ! Touche ' + (i + 1) + ' ou molette pour la prendre.');
  } else {
    const f = FOOD.find((x) => x.id === key);
    if (!f) return;
    if (hero.hp >= hero.maxHp) { say('Tu n\'as plus faim : ta vie est déjà au max ❤️', '#7b5a00'); render(); return; }
    if (!pay(f.price)) { render(); return; }
    hero.hp = Math.min(hero.maxHp, hero.hp + f.heal);
    say('Miam ! ' + f.icon + ' Vie : ' + Math.round(hero.hp) + ' / ' + hero.maxHp);
  }
  render();
}

function openShop(s) {
  if (!panel) {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    panel = document.createElement('div'); panel.className = 'tcs-wrap';
    document.body.appendChild(panel);
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-buy],[data-exit]');
      if (!b || b.disabled) return;
      if (b.dataset.exit) closeOverlay(); else buy(b.dataset.buy);
    });
  }
  cur = s; s.ready = false;
  say('');
  hero.speed = 0;
  render();
  sfx('click', 0.5);
  openOverlay(panel, () => {
    // on ressort sur le trottoir, dos à la porte
    hero.pos.x = s.mx; hero.pos.z = s.mz + 2.2;
    hero.h = Math.PI; G.camHeading = Math.PI;
    showMessage('À bientôt chez ' + s.kind.name + ' ' + s.kind.icon, '#ffffff', 1.5);
  });
}

// ----- Chaque image -----
let t = 0;
export function updateShops(dt) {
  t += dt;
  for (const s of shops) {
    s.icon.position.y = 2.3 + Math.sin(t * 2.5 + s.mx) * 0.2;
    s.ring.scale.setScalar(1 + Math.sin(t * 4) * 0.06);
  }
  if (!lookDone && (lookTimer -= dt) <= 0) { lookTimer = 1; lookDone = applyLook(); } // le perso 3D arrive en retard
  if (G.mode !== 'foot' || hero.state !== 'ok') return;
  for (const s of shops) {
    const d = Math.hypot(hero.pos.x - s.mx, hero.pos.z - s.mz);
    if (d > 3) s.ready = true;
    else if (d < 1.3 && s.ready) { openShop(s); break; }
  }
}
