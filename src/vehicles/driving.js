// =====================================================
//  CONDUITE de la voiture du joueur : physique, drift,
//  turbo, sauts, collisions, dégâts et explosion
// =====================================================
import * as THREE from 'three';
import { scene } from '../render/engine.js';
import { G } from '../core/ctx.js';
import { save, persist } from '../core/save.js';
import { CARS, COLORS, ASSIST, LEVEL_COLORS, TURBO_TIME, TIME_SET } from '../core/config.js';
import { clamp, lerp, damp, angleDiff } from '../core/utils.js';
import { N, CELL, HALF, LIMIT, LANE, rc, SPAWN, colliders, ponds, groundHeight } from '../world/city.js';
import { buildCar, buildFerrari, hasFerrari, charMesh } from './models.js';
import { traffic, damageTraffic } from './traffic.js';
import { emit, burst, smoke, addMark } from '../fx/particles.js';
import { breakProp, explode } from '../fx/destruction.js';
import { showMessage, refreshStats } from '../ui/hud.js';
import { ejectHero } from '../gameplay/onfoot.js';

export const player = {
  pos: new THREE.Vector3(SPAWN.x, 0, SPAWN.z), y: 0, vy: 0, vh: 0, h: 0, slip: 0, speed: 0, steer: 0,
  grounded: true, air: 0, def: CARS[0], hp: 100, wrecked: false, burn: 0,
};
export const D = { drifting: false, dir: 0, time: 0, points: 0, mult: 1, combo: 0, level: 0, show: 0 };
export const drive = { turboTime: 0, turboMax: 1, turboLevel: 0, braking: false };
const NO_INPUT = { up: false, down: false, steer: 0, drift: false };
let lastMarks = [null, null];

// ----- Choisir / changer de voiture -----
export function setPlayerCar() {
  if (G.car) scene.remove(G.car.root);
  player.def = CARS[save.car] || CARS[0];
  const col = COLORS[save.color];
  G.car = (player.def.style === 'ferrari' && hasFerrari()) ? buildFerrari(col) : buildCar(player.def.style, col);
  scene.add(G.car.root);
  player.hp = player.def.hp || 100; player.wrecked = false; player.burn = 0;
  updateCarLights();
  syncCarMesh(0);
}
// on prend une autre voiture (volée ou retrouvée)
export function takeCar(car, def, hp, x, z, h) {
  G.car = car;
  player.def = def; player.hp = hp; player.wrecked = false; player.burn = 0;
  car.root.rotation.set(0, h, 0);
  placeCar({ x, z, h });
  updateCarLights();
}
export function updateCarLights() {
  const car = G.car, T = G.time;
  if (!car || !T) return;
  if (car.spot) car.spot.intensity = player.wrecked ? 0 : T.spot;
  car.headMat.emissiveIntensity = T.head;
  for (const m of car.envList) m.envMapIntensity = T.env;
}

export function nearestRoad(x, z) {
  const gi = clamp(Math.round((x - rc(0)) / CELL), 0, N), gk = clamp(Math.round((z - rc(0)) / CELL), 0, N);
  const rx = rc(gi), rz = rc(gk);
  if (Math.abs(x - rx) < Math.abs(z - rz)) return { x: rx + LANE, z: clamp(z, -HALF + 10, HALF - 10), h: 0 };
  return { x: clamp(x, -HALF + 10, HALF - 10), z: rz + LANE, h: -Math.PI / 2 };
}

export function placeCar(p) {
  player.pos.set(p.x, 0, p.z);
  player.vh = p.h; player.h = p.h; player.slip = 0; player.speed = 0; player.steer = 0;
  player.y = 0; player.vy = 0; player.grounded = true; player.air = 0;
  D.drifting = false; D.points = 0; D.level = 0;
  drive.turboTime = 0;
  if (G.mode === 'car') G.camHeading = p.h;
  lastMarks = [null, null];
  if (G.car) syncCarMesh(0);
}
export function resetPlayer(toSpawn) {
  placeCar(toSpawn ? SPAWN : nearestRoad(player.pos.x, player.pos.z));
}

// ----- Drift -----
function startDrift(dir) {
  D.drifting = true; D.dir = dir; D.time = 0; D.points = 0; D.level = 0; D.show = 0;
}
function endDrift(giveTurbo) {
  D.drifting = false;
  lastMarks = [null, null];
  if (giveTurbo && D.level > 0) {
    drive.turboTime = drive.turboMax = TURBO_TIME[D.level];
    drive.turboLevel = D.level;
    showMessage(D.level === 3 ? 'SUPER DRIFT ! 🚀' : 'TURBO !', LEVEL_COLORS[D.level], 1.2);
  }
  const pts = Math.round(D.points);
  if (pts > 0) {
    save.money += Math.floor(pts / 10);
    if (pts > save.bestDrift) { save.bestDrift = pts; if (pts > 500) setTimeout(() => showMessage('NOUVEAU RECORD DE DRIFT !', '#ffd23a', 1.8), 1200); }
    D.combo = 3; D.mult = Math.min(5, D.mult + 1);
    persist(); refreshStats();
  }
  D.show = 1.5;
}
function crashDrift() {
  D.drifting = false; D.points = 0; D.mult = 1; D.combo = 0; D.show = 0;
  lastMarks = [null, null];
  showMessage('Drift raté 💥', '#ff5050', 1.2);
}

// ----- Dégâts et explosion de NOTRE voiture -----
export function damageCar(dmg) {
  if (player.wrecked || G.state !== 'play' || dmg <= 0) return;
  player.hp -= dmg;
  if (player.hp <= 0) {
    player.hp = 0; player.wrecked = true; player.burn = 3.5;
    D.drifting = false; drive.turboTime = 0;
    showMessage(G.mode === 'car' ? '🔥 La voiture va exploser ! Sors vite (F) !' : '🔥 Ta voiture brûle !', '#ff5050', 2.5);
  }
}
function carExplode() {
  charMesh(G.car.root);
  if (G.car.spot) G.car.spot.intensity = 0;
  player.speed = 0; player.vy = 7; player.grounded = false; player.air = 0;
  explode(player.pos.x, player.y + 1, player.pos.z, 1.2, 'player');
  if (G.mode === 'car') ejectHero(true);
  showMessage('💥 BOUM ! Voiture détruite · R = nouvelle voiture', '#ff9d2e', 3);
}

// ----- Collisions -----
function hitResponse(nx, nz) {
  const fx = -Math.sin(player.vh), fz = -Math.cos(player.vh);
  const vx = fx * player.speed, vz = fz * player.speed;
  const vn = vx * nx + vz * nz;
  if (vn >= 0) return 0;
  const impact = -vn;
  const tx = vx - vn * nx, tz = vz - vn * nz, tl = Math.hypot(tx, tz);
  if (impact > Math.abs(player.speed) * 0.75) {
    player.speed = -Math.sign(player.speed) * Math.min(4, impact * 0.25);
  } else if (tl > 0.1) {
    const sg = Math.sign(player.speed) || 1;
    const nh = Math.atan2(-tx * sg, -tz * sg);
    const d = angleDiff(player.vh, nh);
    player.vh += d; player.slip -= d;
    player.speed = sg * tl * 0.92;
  }
  if (impact > 6) {
    G.shake = Math.max(G.shake, Math.min(1, impact / 25));
    burst(player.pos.x - nx * 1.8, player.y + 0.7, player.pos.z - nz * 1.8, '#ffcc55', 16, 10);
    if (D.drifting && impact > 7) crashDrift();
  }
  return impact;
}

function collide() {
  const p = player.pos, r = 1.9;
  const sg = Math.sign(player.speed) || 1;
  const fx = -Math.sin(player.vh) * sg, fz = -Math.cos(player.vh) * sg;
  for (const b of colliders) {
    if (b.h <= 0 || player.y > b.h) continue;
    if (p.x < b.minX - r || p.x > b.maxX + r || p.z < b.minZ - r || p.z > b.maxZ + r) continue;
    const cx = clamp(p.x, b.minX, b.maxX), cz = clamp(p.z, b.minZ, b.maxZ);
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    // arbre ou lampadaire percuté assez vite : il tombe !
    if (b.prop && Math.abs(player.speed) > 7) {
      breakProp(b, fx, fz, Math.abs(player.speed));
      player.speed *= b.kind === 't' ? 0.7 : 0.85;
      G.shake = Math.max(G.shake, 0.4);
      damageCar(b.kind === 't' ? 6 : 3);
      continue;
    }
    let nx, nz;
    if (d2 < 1e-6) {
      const l = p.x - b.minX, ri = b.maxX - p.x, t = p.z - b.minZ, bo = b.maxZ - p.z, m = Math.min(l, ri, t, bo);
      if (m === l) { nx = -1; nz = 0; p.x = b.minX - r; }
      else if (m === ri) { nx = 1; nz = 0; p.x = b.maxX + r; }
      else if (m === t) { nx = 0; nz = -1; p.z = b.minZ - r; }
      else { nx = 0; nz = 1; p.z = b.maxZ + r; }
    } else {
      const d = Math.sqrt(d2); nx = dx / d; nz = dz / d;
      p.x = cx + nx * r; p.z = cz + nz * r;
    }
    const imp = hitResponse(nx, nz);
    if (imp > 10) damageCar((imp - 10) * 1.2);
  }
  // circulation (et voitures garées / épaves)
  for (const o of traffic) {
    const dx = p.x - o.vx, dz = p.z - o.vz, d = Math.hypot(dx, dz);
    if (d < 4 && d > 0.01 && player.y < 2 + o.y) {
      const nx = dx / d, nz = dz / d;
      p.x = o.vx + nx * 4; p.z = o.vz + nz * 4;
      const imp = hitResponse(nx, nz);
      if (!o.dead) o.stun = 2.5;
      if (imp > 3 && !o.dead && !o.parked) o.heading += (Math.random() - 0.5) * 0.4;
      if (imp > 6) { damageTraffic(o, imp * 1.6); damageCar(imp * 0.5); }
    }
  }
  // bord du monde
  if (Math.abs(p.x) > LIMIT) { const s = Math.sign(p.x); p.x = s * LIMIT; hitResponse(-s, 0); }
  if (Math.abs(p.z) > LIMIT) { const s = Math.sign(p.z); p.z = s * LIMIT; hitResponse(0, -s); }
}

export function localToWorld(lx, lz) {
  const c = Math.cos(player.h), s = Math.sin(player.h);
  return { x: player.pos.x + lx * c + lz * s, z: player.pos.z - lx * s + lz * c };
}

// ----- Mise à jour (appelée aussi quand la voiture est garée, sans commandes) -----
export function updatePlayer(dt, inp) {
  const car = G.car;
  if (!car) return;
  const driving = !!inp && G.mode === 'car' && !player.wrecked;
  if (!driving) { inp = NO_INPUT; if (D.drifting) { D.drifting = false; lastMarks = [null, null]; } drive.turboTime = 0; }
  const c = player.def, A = ASSIST[save.assist] || ASSIST.normal;
  const steerIn = inp.steer; // de -1 (droite) à +1 (gauche)
  player.steer = lerp(player.steer, steerIn, damp(10, dt));
  drive.braking = inp.down && player.speed > 1;
  const p = player.pos;
  const offroad = Math.abs(p.x) > HALF || Math.abs(p.z) > HALF;
  const inWater = ponds.some((o) => Math.hypot(p.x - o.x, p.z - o.z) < o.r);
  let maxS = c.maxSpeed * (offroad ? 0.6 : 1) * (inWater ? 0.4 : 1);
  if (player.hp < (c.hp || 100) * 0.25) maxS *= 0.75; // très abîmée = moins rapide
  if (drive.turboTime > 0) { drive.turboTime -= dt; maxS *= 1.3; }

  if (D.drifting) {
    if (!inp.drift) endDrift(true);
    else if (inp.down) endDrift(false);
    else if (player.speed < 7) endDrift(false);
  }
  if (!D.drifting && player.grounded && inp.drift && Math.abs(steerIn) > 0.3 && player.speed > 11) startDrift(Math.sign(steerIn));

  if (player.grounded) {
    if (D.drifting) {
      const si = steerIn * D.dir;
      const rate = c.turn * 0.6 * A.rate * (0.72 + 0.45 * si) * clamp(player.speed / 18, 0.5, 1);
      player.vh += D.dir * rate * dt;
      const slipT = D.dir * (A.slip + 0.15 * si) * c.drift;
      player.slip = lerp(player.slip, slipT, damp(5, dt));
      if (inp.up || drive.turboTime > 0) player.speed += (maxS * 0.9 - player.speed) * 0.7 * dt;
      else player.speed -= player.speed * 0.3 * dt;
      D.time += dt;
      D.points += player.speed * dt * (0.6 + Math.abs(player.slip)) * D.mult * A.pts * 1.5;
      const lvl = A.th.filter((t) => D.time >= t).length;
      if (lvl > D.level) { D.level = lvl; burst(p.x, 0.5, p.z, LEVEL_COLORS[lvl], 18, 9); }
    } else {
      if (inp.up) {
        if (player.speed < 0) player.speed += 30 * dt;
        else player.speed += c.accel * (1 - 0.65 * clamp(player.speed / maxS, 0, 1)) * dt;
      } else if (inp.down) {
        if (player.speed > 0.5) player.speed -= 34 * dt;
        else player.speed = Math.max(-15, player.speed - c.accel * 0.6 * dt);
      } else {
        const dec = (2.5 + Math.abs(player.speed) * 0.12) * dt * (driving ? 1 : 3);
        player.speed -= Math.sign(player.speed) * Math.min(Math.abs(player.speed), dec);
      }
      if (drive.turboTime > 0) player.speed = Math.min(maxS, player.speed + 28 * dt);
      if (player.speed > maxS) player.speed = lerp(player.speed, maxS, damp(1.5, dt));
      const sp = Math.abs(player.speed);
      const turn = player.steer * c.turn * clamp(sp / 7, 0, 1) * (1 - 0.35 * clamp(sp / c.maxSpeed, 0, 1));
      player.vh += turn * Math.sign(player.speed) * dt;
      player.slip = lerp(player.slip, player.steer * 0.05 * clamp(sp / 25, 0, 1), damp(4, dt));
    }
  }
  player.h = player.vh + player.slip;

  // déplacement
  const fx = -Math.sin(player.vh), fz = -Math.cos(player.vh);
  const ox = p.x, oz = p.z;
  p.x += fx * player.speed * dt;
  p.z += fz * player.speed * dt;

  // sol, tremplins et sauts
  const g = groundHeight(p.x, p.z);
  if (player.grounded) {
    if (g - player.y > 1.0) {
      p.x = ox; p.z = oz;
      if (Math.abs(player.speed) > 8) { G.shake = 0.5; burst(p.x + fx * 2, 1, p.z + fz * 2, '#ffcc55', 12, 8); if (D.drifting) crashDrift(); damageCar(5); }
      player.speed *= -0.25;
    } else if (g < player.y - 0.35) {
      player.grounded = false; player.air = 0;
    } else {
      player.vy = clamp((g - player.y) / Math.max(dt, 0.001), -5, 25);
      player.y = g;
    }
  }
  if (!player.grounded) {
    player.vy -= 28 * dt;
    player.y += player.vy * dt;
    player.air += dt;
    if (player.y <= g) {
      player.y = g; player.grounded = true;
      if (player.air > 0.45 && driving) {
        const pts = Math.round(player.air * 400);
        save.money += Math.round(pts / 10);
        persist(); refreshStats();
        showMessage('SAUT ! +' + pts + ' pts', '#7df9ff', 1.4);
      }
      G.shake = Math.max(G.shake, Math.min(0.8, -player.vy * 0.03));
      for (let i = 0; i < 10; i++) emit(p.x, 0.4, p.z, (Math.random() - 0.5) * 10, 1, (Math.random() - 0.5) * 10, '#cccccc', 1.2, 0.8, 2, false, 0.5);
      player.vy = 0;
    }
  }

  collide();

  if (!D.drifting && D.combo > 0) { D.combo -= dt; if (D.combo <= 0) D.mult = 1; }
  if (D.show > 0) D.show -= dt;

  // effets : fumée, traces, flammes du turbo
  const S = car.S;
  if (D.drifting && player.grounded) {
    const rear = [localToWorld(-(S.W / 2 - 0.12), S.L / 2 - 0.85), localToWorld(S.W / 2 - 0.12, S.L / 2 - 0.85)];
    rear.forEach((w, k) => {
      if (Math.random() < 0.6) emit(w.x, 0.4, w.z, (Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2, G.time === TIME_SET.night ? '#8890a0' : '#e8e8e8', 1, 1.1, 3.2, false, 0.45);
      if (D.level > 0 && Math.random() < 0.5) emit(w.x, 0.3, w.z, (Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4, LEVEL_COLORS[D.level], 0.35, 0.35, -0.3, true, 1);
      if (lastMarks[k]) addMark(lastMarks[k], w, player.y);
      lastMarks[k] = w;
    });
  }
  if (drive.turboTime > 0) {
    const ex = localToWorld(0.45, S.L / 2 + 0.3);
    emit(ex.x, player.y + 0.5, ex.z, fx * -6, 0.5, fz * -6, LEVEL_COLORS[drive.turboLevel], 0.6, 0.25, 1.5, true, 0.9);
  }
  if (inWater && Math.abs(player.speed) > 5 && Math.random() < 0.5) emit(p.x, 0.5, p.z, (Math.random() - 0.5) * 6, 4, (Math.random() - 0.5) * 6, '#9fd0ff', 0.8, 0.6, 1, false, 0.7);

  // voiture abîmée : fumée, puis feu, puis BOUM
  if (player.wrecked) {
    if (player.burn > 0) {
      player.burn -= dt;
      smoke(p.x, player.y + 1.2, p.z, true, true);
      if (player.burn <= 0) carExplode();
    } else if (Math.random() < 0.3) smoke(p.x, player.y + 1, p.z, true, false);
  } else if (player.hp < (c.hp || 100) * 0.4 && Math.random() < 0.25) {
    const fr = localToWorld(0, -S.L / 2 + 0.6);
    smoke(fr.x, player.y + 1.1, fr.z, player.hp < (c.hp || 100) * 0.2, false);
  }

  syncCarMesh(dt);
}

export function syncCarMesh(dt) {
  const car = G.car;
  if (!car) return;
  car.root.position.set(player.pos.x, player.y, player.pos.z);
  car.root.rotation.y = player.h;
  const pitchT = player.grounded ? 0 : clamp(-player.vy * 0.015, -0.3, 0.3);
  car.root.rotation.x = lerp(car.root.rotation.x, pitchT, damp(4, dt));
  car.root.rotation.z = 0;
  const sp = Math.abs(player.speed);
  const rollT = D.drifting ? -D.dir * 0.06 : -player.steer * 0.045 * clamp(sp / 30, 0, 1);
  car.chassis.rotation.z = lerp(car.chassis.rotation.z, rollT, damp(6, dt));
  car.chassis.rotation.x = lerp(car.chassis.rotation.x, drive.braking ? -0.03 : 0, damp(6, dt));
  for (const w of car.wheels) w.rotation.x += car.spin * player.speed * dt / 0.42;
  const steerA = D.drifting ? -D.dir * 0.3 + player.steer * 0.15 : player.steer * 0.45;
  for (const f of car.fronts) {
    if (f.userData.up) f.quaternion.setFromAxisAngle(f.userData.up, steerA);
    else f.rotation.y = steerA;
  }
  car.tailMat.emissiveIntensity = drive.braking ? 3 : (G.time === TIME_SET.day ? 0.4 : 1.2);
}
