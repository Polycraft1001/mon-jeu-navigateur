// =====================================================
//  MINI-CARTE (en bas à gauche) : tourne avec la caméra
//  Style « GPS » sombre, assorti à l'interface
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
let mm = null, vign = null;

// Couleurs de la carte
const COL = {
  outside: '#1d3326',  // campagne autour de la ville
  roads: '#262c3b',    // sol de la ville = les rues
  building: '#5d6782',
  water: '#2e86de',
  ramp: '#ffd23a',
  blocks: { downtown: '#3c4459', mid: '#444a5a', suburb: '#33503d', park: '#2c6a3c', stunt: '#6e5f36' },
};
const FONT = "'Exo 2', 'Segoe UI', sans-serif";

// Le fond de carte est dessiné une seule fois
export function drawMapBase() {
  const m = base.getContext('2d');
  const T = (v) => (v + MAP_R) * MS;
  m.fillStyle = COL.outside; m.fillRect(0, 0, MAP_PX, MAP_PX);
  m.fillStyle = COL.roads; m.fillRect(T(-HALF), T(-HALF), CITY * MS, CITY * MS);
  for (const b of blocks) {
    m.fillStyle = COL.blocks[b.type] || '#444a5a';
    m.fillRect(T(b.cx - BLOCK / 2), T(b.cz - BLOCK / 2), BLOCK * MS, BLOCK * MS);
  }
  m.fillStyle = COL.building;
  for (const c of colliders) {
    if (c.prop || c.maxX - c.minX < 3) continue; // pas les arbres ni les lampadaires
    m.fillRect(T(c.minX), T(c.minZ), (c.maxX - c.minX) * MS, (c.maxZ - c.minZ) * MS);
  }
  m.fillStyle = COL.water;
  for (const p of ponds) { m.beginPath(); m.arc(T(p.x), T(p.z), p.r * MS, 0, Math.PI * 2); m.fill(); }
  m.fillStyle = COL.ramp;
  for (const r of ramps) m.fillRect(T(r.x) - 3, T(r.z) - 3, 6, 6);
}

// une étoile à 5 branches (dessinée : pas de caractère qui deviendrait un emoji)
function starPath(cx, cy, r1, r2) {
  mm.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? r2 : r1, an = -Math.PI / 2 + i * Math.PI / 5;
    mm.lineTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r);
  }
  mm.closePath();
}

// repère lumineux (mission), avec une onde qui pulse
function pin(u, v, color, withStar) {
  const p = (performance.now() / 1000) % 1;
  mm.strokeStyle = color; mm.globalAlpha = 1 - p; mm.lineWidth = 2;
  mm.beginPath(); mm.arc(u, v, 7 + p * 9, 0, Math.PI * 2); mm.stroke();
  mm.globalAlpha = 1;
  mm.shadowColor = color; mm.shadowBlur = 10;
  mm.fillStyle = color;
  mm.beginPath(); mm.arc(u, v, 7.5, 0, Math.PI * 2); mm.fill();
  mm.shadowBlur = 0;
  mm.strokeStyle = 'rgba(5, 8, 20, 0.9)'; mm.lineWidth = 2; mm.stroke();
  if (withStar) { mm.fillStyle = '#1a1300'; starPath(u, v + 0.3, 4.4, 1.9); mm.fill(); }
}

export function drawMinimap() {
  if (!mm) {
    const c = $('minimap'); if (!c) return;
    mm = c.getContext('2d');
    vign = mm.createRadialGradient(100, 100, 56, 100, 100, 96);
    vign.addColorStop(0, 'rgba(5, 8, 20, 0)');
    vign.addColorStop(1, 'rgba(5, 8, 20, 0.6)');
  }
  const me = whereAmI();
  const C = 100, R = 96, pm = 0.7, a = G.camHeading, px = me.x, pz = me.z;
  mm.clearRect(0, 0, 200, 200);
  mm.save();
  mm.beginPath(); mm.arc(C, C, R, 0, Math.PI * 2); mm.clip();
  mm.fillStyle = COL.outside; mm.fillRect(0, 0, 200, 200);
  mm.save();
  mm.translate(C, C); mm.rotate(a);
  const k = pm / MS; mm.scale(k, k);
  mm.translate(-(px + MAP_R) * MS, -(pz + MAP_R) * MS);
  mm.drawImage(base, 0, 0);
  mm.restore();

  // anneau de distance + bord assombri (effet « écran de GPS »)
  mm.strokeStyle = 'rgba(255, 255, 255, 0.07)'; mm.lineWidth = 1;
  mm.beginPath(); mm.arc(C, C, R * 0.5, 0, Math.PI * 2); mm.stroke();
  mm.fillStyle = vign; mm.fillRect(0, 0, 200, 200);

  const ca = Math.cos(a), sa = Math.sin(a);
  const proj = (x, z) => { const rx = (x - px) * pm, rz = (z - pz) * pm; return [C + rx * ca - rz * sa, C + rx * sa + rz * ca]; };
  const inside = (u, v) => Math.hypot(u - C, v - C) < R;
  const edge = (x, z) => { let [u, v] = proj(x, z); const dx = u - C, dy = v - C, d = Math.hypot(dx, dy); if (d > R - 10) { u = C + dx / d * (R - 10); v = C + dy / d * (R - 10); } return [u, v]; };

  // pièces
  mm.fillStyle = '#ffd23a';
  for (const c of coins) { if (c.taken) continue; const [u, v] = proj(c.x, c.z); if (inside(u, v)) { mm.beginPath(); mm.arc(u, v, 2.3, 0, Math.PI * 2); mm.fill(); } }
  // voitures : blanches = roulent, grises = garées, rouges = épaves
  for (const o of traffic) {
    const [u, v] = proj(o.vx, o.vz);
    if (!inside(u, v)) continue;
    mm.fillStyle = o.dead ? '#ff5a3c' : o.parked ? '#7d8799' : '#e8eefc';
    mm.fillRect(u - 1.5, v - 1.5, 3, 3);
  }
  // ta voiture quand tu es à pied
  if (G.mode === 'foot' && G.car) {
    const [u, v] = edge(player.pos.x, player.pos.z);
    const col = player.wrecked ? '#ff5a3c' : '#4fc3ff';
    mm.shadowColor = col; mm.shadowBlur = 8;
    mm.fillStyle = col; mm.fillRect(u - 4.5, v - 4.5, 9, 9);
    mm.shadowBlur = 0;
    mm.strokeStyle = '#fff'; mm.lineWidth = 1.5; mm.strokeRect(u - 4.5, v - 4.5, 9, 9);
  }
  // mission
  if (!mission.active) { const [u, v] = edge(MISSION_START.x, MISSION_START.z); pin(u, v, '#ffd23a', true); }
  else { const cp = mission.cps[mission.idx]; const [u, v] = edge(cp.x, cp.z); pin(u, v, '#3ddc84', false); }
  mm.restore();

  // flèche du joueur (lumineuse)
  const arrow = G.mode === 'foot' ? '#7df9ff' : '#ff4d5e';
  mm.save();
  mm.translate(C, C); mm.rotate(a - me.h);
  mm.beginPath(); mm.moveTo(0, -10); mm.lineTo(7.5, 7.5); mm.lineTo(0, 3.5); mm.lineTo(-7.5, 7.5); mm.closePath();
  mm.shadowColor = arrow; mm.shadowBlur = 12;
  mm.fillStyle = arrow; mm.fill();
  mm.shadowBlur = 0;
  mm.strokeStyle = '#fff'; mm.lineWidth = 1.8; mm.lineJoin = 'round'; mm.stroke();
  mm.restore();

  // repère du Nord, qui tourne avec la carte
  const nx = C + Math.sin(a) * (R - 11), ny = C - Math.cos(a) * (R - 11);
  mm.fillStyle = 'rgba(5, 8, 20, 0.88)';
  mm.beginPath(); mm.arc(nx, ny, 8, 0, Math.PI * 2); mm.fill();
  mm.strokeStyle = '#ff4d5e'; mm.lineWidth = 1.5; mm.stroke();
  mm.fillStyle = '#fff'; mm.font = '800 10px ' + FONT; mm.textAlign = 'center'; mm.textBaseline = 'middle';
  mm.fillText('N', nx, ny + 0.5);
}
