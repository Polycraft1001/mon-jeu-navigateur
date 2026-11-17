// =====================================================
//  CAMÉRA : derrière la voiture, derrière le héros,
//  ou qui tourne autour de la voiture dans le menu.
//  C / V / 🎥 = changer de vue (3 vues)
// =====================================================
import { camera } from './engine.js';
import { G } from '../core/ctx.js';
import { clamp, lerp, damp, angleDiff } from '../core/utils.js';
import { colliders } from '../world/city.js';
import { player, drive } from '../vehicles/driving.js';
import { hero } from '../gameplay/onfoot.js';

// d = distance derrière · h = hauteur · look = hauteur du regard · side = décalage épaule
const CAR_VIEWS = [{ d: 8.5, h: 3.4, look: 1.2 }, { d: 14, h: 6, look: 1.6 }]; // 3e vue = capot
const FOOT_VIEWS = [
  { d: 4.6, h: 2.3, look: 1.5, side: 0 },
  { d: 8, h: 4, look: 1.4, side: 0 },
  { d: 2.6, h: 1.9, look: 1.65, side: 0.7 },
];
let menuAngle = 0;

// est-ce que ce point est dans un immeuble ?
function inBuilding(x, y, z) {
  for (const b of colliders) {
    if (b.prop || y > b.h || b.maxX - b.minX < 3) continue;
    if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) return true;
  }
  return false;
}
// rapproche la caméra si un mur est entre elle et le héros (0..1)
function unblock(ax, ay, az, bx, by, bz) {
  const STEPS = 8;
  for (let k = 1; k <= STEPS; k++) {
    const t = k / STEPS;
    if (inBuilding(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t)) return Math.max(0.15, (k - 1) / STEPS - 0.04);
  }
  return 1;
}

function carCamera(dt) {
  const p = player.pos;
  if (G.camMode < 2) {
    const V = CAR_VIEWS[G.camMode];
    const target = player.vh + player.slip * 0.35;
    G.camHeading += angleDiff(G.camHeading, target) * damp(4, dt);
    const s = Math.sin(G.camHeading), c = Math.cos(G.camHeading);
    camera.position.x = p.x + s * V.d;
    camera.position.z = p.z + c * V.d;
    camera.position.y = lerp(camera.position.y, player.y + V.h, damp(6, dt));
    camera.lookAt(p.x - s * 3, player.y + V.look, p.z - c * 3);
  } else {
    G.camHeading = player.h;
    const fx = -Math.sin(player.h), fz = -Math.cos(player.h);
    camera.position.set(p.x + fx * 0.3, player.y + 1.3, p.z + fz * 0.3);
    camera.lookAt(p.x + fx * 12, player.y + 1.0, p.z + fz * 12);
  }
  const fovT = 65 + clamp(Math.abs(player.speed) / player.def.maxSpeed, 0, 1.3) * 12 + (drive.turboTime > 0 ? 8 : 0);
  camera.fov = lerp(camera.fov, fovT, damp(3, dt));
}

function footCamera(dt) {
  const V = FOOT_VIEWS[G.camMode % FOOT_VIEWS.length];
  const p = hero.pos;
  G.camHeading += angleDiff(G.camHeading, hero.h) * damp(hero.state === 'ok' ? 5 : 1.5, dt);
  const s = Math.sin(G.camHeading), c = Math.cos(G.camHeading);
  // point visé (épaule) puis position voulue derrière
  const ax = p.x + c * V.side, ay = p.y + V.look, az = p.z - s * V.side;
  const bx = ax + s * V.d, by = p.y + V.h, bz = az + c * V.d;
  const k = unblock(ax, ay, az, bx, by, bz);
  camera.position.x = ax + (bx - ax) * k;
  camera.position.z = az + (bz - az) * k;
  camera.position.y = lerp(camera.position.y, ay + (by - ay) * k, damp(8, dt));
  camera.lookAt(ax - s * 6, ay, az - c * 6);
  const fovT = 62 + (Math.abs(hero.speed) > 6 ? 5 : 0);
  camera.fov = lerp(camera.fov, fovT, damp(3, dt));
}

export function updateCamera(dt) {
  if (G.mode === 'foot') footCamera(dt); else carCamera(dt);
  if (G.shake > 0.01) {
    camera.position.x += (Math.random() - 0.5) * G.shake;
    camera.position.y += (Math.random() - 0.5) * G.shake;
    G.shake *= Math.exp(-5 * dt);
  }
  camera.updateProjectionMatrix();
}

export function updateMenuCamera(dt) {
  menuAngle += dt * 0.15;
  const p = player.pos;
  camera.position.set(p.x + Math.cos(menuAngle) * 11, 3.5, p.z + Math.sin(menuAngle) * 11);
  camera.lookAt(p.x, 1, p.z);
  if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
}
