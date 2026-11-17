// =====================================================
//  MINI-CARTE (en bas à gauche) : tourne avec la caméra
// =====================================================
import { $ } from '../core/utils.js';
import { G } from '../core/ctx.js';
import { HALF, CITY, BLOCK, blocks, colliders, ponds, ramps, coins } from '../world/city.js';
import { traffic } from '../vehicles/traffic.js';
import { player } from '../vehicles/driving.js';
import { whereAmI } from '../gameplay/where.js';
import { mission, MISSION_START } from '../gameplay/mission.js';

const MAP_R = HALF + 80, MAP_PX = 700, MS = MAP_PX / (2 * MAP_R);
const base = document.createElement('canvas');
base.width = base.height = MAP_PX;
let mm = null;

// Le fond de carte est dessiné une seule fois
export function drawMapBase() {
  const m = base.getContext('2d');
  const T = (v) => (v + MAP_R) * MS;
  m.fillStyle = '#355e2e'; m.fillRect(0, 0, MAP_PX, MAP_PX);
  m.fillStyle = '#4a4d55'; m.fillRect(T(-HALF), T(-HALF), CITY * MS, CITY * MS);
  const BC = { downtown: '#8a8f99', mid: '#9a9a92', suburb: '#7aa06a', park: '#4f9a45', stunt: '#c9b26a' };
  for (const b of blocks) { m.fillStyle = BC[b.type] || '#888'; m.fillRect(T(b.cx - BLOCK / 2), T(b.cz - BLOCK / 2), BLOCK * MS, BLOCK * MS); }
  m.fillStyle = '#5a5f6b';
  for (const c of colliders) {
    if (c.prop || c.maxX - c.minX < 3) continue; // pas les arbres ni les lampadaires
    m.fillRect(T(c.minX), T(c.minZ), (c.maxX - c.minX) * MS, (c.maxZ - c.minZ) * MS);
  }
  m.fillStyle = '#3d8be0';
  for (const p of ponds) { m.beginPath(); m.arc(T(p.x), T(p.z), p.r * MS, 0, Math.PI * 2); m.fill(); }
  m.fillStyle = '#f2c230';
  for (const r of ramps) m.fillRect(T(r.x) - 3, T(r.z) - 3, 6, 6);
}

function pin(u, v, color, label) {
  mm.fillStyle = color; mm.strokeStyle = '#000'; mm.lineWidth = 2;
  mm.beginPath(); mm.arc(u, v, 7, 0, Math.PI * 2); mm.fill(); mm.stroke();
  if (label) {
    mm.fillStyle = '#000'; mm.font = 'bold 10px sans-serif'; mm.textAlign = 'center'; mm.textBaseline = 'middle';
    mm.fillText(label, u, v + 0.5);
  }
}

export function drawMinimap() {
  if (!mm) { const c = $('minimap'); if (!c) return; mm = c.getContext('2d'); }
  const me = whereAmI();
  const C = 100, R = 96, pm = 0.7, a = G.camHeading, px = me.x, pz = me.z;
  mm.clearRect(0, 0, 200, 200);
  mm.save();
  mm.beginPath(); mm.arc(C, C, R, 0, Math.PI * 2); mm.clip();
  mm.fillStyle = '#355e2e'; mm.fillRect(0, 0, 200, 200);
  mm.save();
  mm.translate(C, C); mm.rotate(a);
  const k = pm / MS; mm.scale(k, k);
  mm.translate(-(px + MAP_R) * MS, -(pz + MAP_R) * MS);
  mm.drawImage(base, 0, 0);
  mm.restore();

  const ca = Math.cos(a), sa = Math.sin(a);
  const proj = (x, z) => { const rx = (x - px) * pm, rz = (z - pz) * pm; return [C + rx * ca - rz * sa, C + rx * sa + rz * ca]; };
  const inside = (u, v) => Math.hypot(u - C, v - C) < R;
  const edge = (x, z) => { let [u, v] = proj(x, z); const dx = u - C, dy = v - C, d = Math.hypot(dx, dy); if (d > R - 8) { u = C + dx / d * (R - 8); v = C + dy / d * (R - 8); } return [u, v]; };

  // pièces
  mm.fillStyle = '#ffd23a';
  for (const c of coins) { if (c.taken) continue; const [u, v] = proj(c.x, c.z); if (inside(u, v)) { mm.beginPath(); mm.arc(u, v, 2.5, 0, Math.PI * 2); mm.fill(); } }
  // voitures : blanches = roulent, grises = garées, rouges = épaves
  for (const o of traffic) {
    const [u, v] = proj(o.vx, o.vz);
    if (!inside(u, v)) continue;
    mm.fillStyle = o.dead ? '#ff5a3c' : o.parked ? '#a9b0ba' : '#ffffff';
    mm.fillRect(u - 1.5, v - 1.5, 3, 3);
  }
  // ta voiture quand tu es à pied
  if (G.mode === 'foot' && G.car) {
    const [u, v] = edge(player.pos.x, player.pos.z);
    mm.fillStyle = player.wrecked ? '#ff5a3c' : '#4fc3ff'; mm.strokeStyle = '#000'; mm.lineWidth = 1.5;
    mm.fillRect(u - 4, v - 4, 8, 8); mm.strokeRect(u - 4, v - 4, 8, 8);
  }
  // mission
  if (!mission.active) { const [u, v] = edge(MISSION_START.x, MISSION_START.z); pin(u, v, '#ffd23a', '★'); }
  else { const cp = mission.cps[mission.idx]; const [u, v] = edge(cp.x, cp.z); pin(u, v, '#3dff7a'); }
  mm.restore();

  // flèche du joueur
  mm.save();
  mm.translate(C, C); mm.rotate(a - me.h);
  mm.beginPath(); mm.moveTo(0, -9); mm.lineTo(7, 7); mm.lineTo(0, 3); mm.lineTo(-7, 7); mm.closePath();
  mm.fillStyle = G.mode === 'foot' ? '#7df9ff' : '#ff3b3b'; mm.fill();
  mm.strokeStyle = '#fff'; mm.lineWidth = 2; mm.stroke();
  mm.restore();
}
