// =====================================================
//  GRANDE CARTE 🗺️ : tout le monde d'un coup d'œil
//  (la grande ville, l'aéroport, les 3 autres villes,
//  les routes, les boutiques, les pièces, toi et ta voiture)
//  M ou bouton 🗺️ ou clic sur la mini-carte = ouvrir
//  M / Échap / clic = fermer
// =====================================================
import { G } from '../core/ctx.js';
import { isMobile } from '../core/utils.js';
import { HALF, LIMIT, CITY, BLOCK, blocks, colliders, ponds, coins } from '../world/city.js';
import { terrainHeight, AIRPORT, TOWNS } from '../world/terrain.js';
import { player } from '../vehicles/driving.js';
import { whereAmI } from '../gameplay/where.js';
import { mission, MISSION_START } from '../gameplay/mission.js';
import { shops } from '../gameplay/shops.js';
import { openOverlay, closeOverlay } from './overlay.js';

const W = LIMIT, PX = 1000, S = PX / (2 * W);
const T = (v) => (v + W) * S; // mètres → pixels
const TOWN_LOOK = {
  candy: { icon: '🍭', fill: '#ffd9ec' },
  west: { icon: '🌵', fill: '#f6dcae' },
  snow: { icon: '❄️', fill: '#f4f8ff' },
};
let base = null, box = null, cv = null;

function label(m, text, x, y, size) {
  m.font = 'bold ' + size + 'px system-ui, sans-serif';
  m.textAlign = 'center'; m.textBaseline = 'middle';
  m.lineWidth = 5; m.strokeStyle = 'rgba(40,20,60,0.85)'; m.strokeText(text, x, y);
  m.fillStyle = '#ffffff'; m.fillText(text, x, y);
}

// Le fond (relief, villes, routes) n'est dessiné qu'une fois
function drawBase() {
  base = document.createElement('canvas');
  base.width = base.height = PX;
  const m = base.getContext('2d');
  // relief : herbe → collines → roche → neige (+ sable et neige près des villes)
  const STEP = 8;
  for (let py = 0; py < PX; py += STEP) for (let px = 0; px < PX; px += STEP) {
    const x = (px + STEP / 2) / S - W, z = (py + STEP / 2) / S - W, h = terrainHeight(x, z);
    let col = h > 95 ? '#f3f5fb' : h > 50 ? '#b4a89b' : h > 22 ? '#8cc46a' : '#7fd068';
    for (const t of TOWNS) {
      if (!t.tint || h > 50) continue;
      if (Math.max(Math.abs(x - t.x), Math.abs(z - t.z)) < t.hw + 260) col = t.tint === 'snow' ? '#e9f1fb' : '#f1d9a0';
    }
    m.fillStyle = col; m.fillRect(px, py, STEP, STEP);
  }
  // routes entre les villes
  m.fillStyle = '#8d8a9c';
  for (const t of TOWNS) if (t.road) { const r = t.road; m.fillRect(T(r.x - r.hw), T(r.z - r.hd), 2 * r.hw * S, 2 * r.hd * S); }
  // aéroport
  const A = AIRPORT;
  m.fillStyle = '#cbc6d8'; m.fillRect(T(A.x - A.hw), T(A.z - A.hd), 2 * A.hw * S, 2 * A.hd * S);
  m.fillStyle = '#6f6c7c'; m.fillRect(T(A.x - A.hw + 15), T(A.z - 9), 2 * (A.hw - 15) * S, 18 * S);
  // les 3 autres villes
  for (const t of TOWNS) {
    const L = TOWN_LOOK[t.id] || { fill: '#eeeeee' };
    m.fillStyle = L.fill; m.fillRect(T(t.x - t.hw), T(t.z - t.hd), 2 * t.hw * S, 2 * t.hd * S);
    m.strokeStyle = '#ffffff'; m.lineWidth = 3; m.strokeRect(T(t.x - t.hw), T(t.z - t.hd), 2 * t.hw * S, 2 * t.hd * S);
  }
  // la grande ville
  m.fillStyle = '#8f8ca0'; m.fillRect(T(-HALF), T(-HALF), CITY * S, CITY * S);
  const BC = { downtown: '#f6c8dc', mid: '#dcd1f7', suburb: '#cdeec4', park: '#8fd47c', stunt: '#f5dd8f' };
  for (const b of blocks) { m.fillStyle = BC[b.type] || '#cccccc'; m.fillRect(T(b.cx - BLOCK / 2), T(b.cz - BLOCK / 2), BLOCK * S, BLOCK * S); }
  // bâtiments (partout, aussi dans les autres villes)
  m.fillStyle = 'rgba(255,255,255,0.9)';
  for (const c of colliders) {
    if (c.prop || c.maxX - c.minX < 3) continue;
    m.fillRect(T(c.minX), T(c.minZ), Math.max(1, (c.maxX - c.minX) * S), Math.max(1, (c.maxZ - c.minZ) * S));
  }
  m.fillStyle = '#3d8be0';
  for (const p of ponds) { m.beginPath(); m.arc(T(p.x), T(p.z), Math.max(2, p.r * S), 0, Math.PI * 2); m.fill(); }
  // noms
  label(m, '🏙️ TURBO CITY', T(0), T(-HALF) - 18, 26);
  label(m, '✈️ AÉROPORT', T(A.x), T(A.z + A.hd) + 18, 20);
  for (const t of TOWNS) {
    const L = TOWN_LOOK[t.id] || { icon: '' };
    label(m, L.icon + ' ' + t.name, T(t.x), T(t.z - t.hd) - 18, 24);
  }
}

function pin(m, x, y, color, text) {
  m.fillStyle = color; m.strokeStyle = '#ffffff'; m.lineWidth = 3;
  m.beginPath(); m.arc(x, y, 13, 0, Math.PI * 2); m.fill(); m.stroke();
  if (text) { m.font = '15px system-ui, sans-serif'; m.textAlign = 'center'; m.textBaseline = 'middle'; m.fillStyle = '#000'; m.fillText(text, x, y + 1); }
}

// Ce qui bouge (dessiné à chaque ouverture)
function draw() {
  const m = cv.getContext('2d');
  m.clearRect(0, 0, PX, PX);
  m.drawImage(base, 0, 0);
  m.fillStyle = '#ffd23a';
  for (const c of coins) { if (c.taken) continue; m.beginPath(); m.arc(T(c.x), T(c.z), 3, 0, Math.PI * 2); m.fill(); }
  for (const s of shops) pin(m, T(s.mx), T(s.mz), s.kind.color, s.kind.icon);
  if (!mission.active) pin(m, T(MISSION_START.x), T(MISSION_START.z), '#ffd23a', '★');
  else { const cp = mission.cps[mission.idx]; if (cp) pin(m, T(cp.x), T(cp.z), '#3dff7a', '🏁'); }
  if (G.car && G.mode !== 'car') { // ta voiture
    m.fillStyle = player.wrecked ? '#ff5a3c' : '#4fc3ff'; m.strokeStyle = '#000'; m.lineWidth = 2;
    m.fillRect(T(player.pos.x) - 6, T(player.pos.z) - 6, 12, 12); m.strokeRect(T(player.pos.x) - 6, T(player.pos.z) - 6, 12, 12);
  }
  // toi (la flèche montre ta direction)
  const me = whereAmI();
  m.save();
  m.translate(T(me.x), T(me.z)); m.rotate(-me.h);
  m.beginPath(); m.moveTo(0, -16); m.lineTo(12, 12); m.lineTo(0, 5); m.lineTo(-12, 12); m.closePath();
  m.fillStyle = G.mode === 'foot' ? '#00e5ff' : '#ff3b6b'; m.fill();
  m.strokeStyle = '#ffffff'; m.lineWidth = 3; m.stroke();
  m.restore();
}

export function openBigMap() {
  if (G.state !== 'play' || !box) return;
  if (!base) drawBase();
  draw();
  openOverlay(box);
}

export function initBigMap() {
  box = document.createElement('div');
  box.dataset.map = '1';
  box.style.cssText = 'position:fixed;inset:0;z-index:9999;display:none;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:rgba(30,16,50,.8);font-family:system-ui,sans-serif;color:#fff;cursor:pointer';
  box.innerHTML = '<div style="font-weight:900;font-size:22px">🗺️ CARTE DU MONDE</div>'
    + '<canvas width="' + PX + '" height="' + PX + '" style="width:min(92vw,80vh);height:min(92vw,80vh);border-radius:18px;border:4px solid #fff;box-shadow:0 10px 40px rgba(0,0,0,.5)"></canvas>'
    + '<div style="font-size:13px;opacity:.9;text-align:center">🔺 toi · 🟦 ta voiture · 🟡 pièces · 👕 🔫 🍔 boutiques · ★ mission<br>M, Échap ou clic pour fermer</div>';
  cv = box.querySelector('canvas');
  document.body.appendChild(box);
  box.addEventListener('click', () => closeOverlay());

  // bouton 🗺️ (pratique sur téléphone)
  const btn = document.createElement('button');
  btn.textContent = '🗺️';
  btn.title = 'Carte (M)';
  btn.style.cssText = 'position:fixed;left:12px;top:38%;z-index:40;width:48px;height:48px;border-radius:50%;border:3px solid #fff;background:#ff7eb6;font-size:22px;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.35);display:none;padding:0';
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); openBigMap(); });
  document.body.appendChild(btn);
  setInterval(() => { btn.style.display = G.state === 'play' && !document.pointerLockElement ? 'block' : 'none'; }, 300);

  // clic sur la mini-carte (ordinateur)
  const mini = document.getElementById('minimap');
  if (mini && !isMobile) {
    mini.style.pointerEvents = 'auto'; mini.style.cursor = 'pointer';
    mini.addEventListener('pointerdown', (e) => { e.preventDefault(); openBigMap(); });
  }
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyM' && !e.repeat) openBigMap(); });
}
