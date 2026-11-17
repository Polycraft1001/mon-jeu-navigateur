// =====================================================
//  CIRCULATION : voitures qui roulent, s'arrêtent,
//  prennent des dégâts, brûlent et explosent
//  (les voitures garées du joueur sont aussi rangées ici)
// =====================================================
import { scene } from '../render/engine.js';
import { G } from '../core/ctx.js';
import { save } from '../core/save.js';
import { TRAFFIC_COUNT } from '../core/config.js';
import { lerp, damp, angleDiff } from '../core/utils.js';
import { N, CELL, LANE, rc } from '../world/city.js';
import { buildTrafficCar, charMesh } from './models.js';
import { smoke } from '../fx/particles.js';
import { explode } from '../fx/destruction.js';
import { player } from './driving.js';

export const TRAFFIC_HP = 60;
const DIRS = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
const rightOf = (d) => ({ x: -d.z, z: d.x });
const validDir = (i, k, d) => i + d.x >= 0 && i + d.x <= N && k + d.z >= 0 && k + d.z <= N;
export const traffic = [];

const wanted = () => TRAFFIC_COUNT[save.traffic] || 0;
const aliveCount = () => traffic.reduce((n, o) => n + (!o.parked && !o.dead ? 1 : 0), 0);
const focus = () => (G.mode === 'foot' && G.hero ? G.hero.pos : player.pos);

function entry(car, x, z) {
  return {
    car, mesh: car.root, x, z, vx: x, vz: z, dir: null, ni: 0, nk: 0, target: null, newDir: null,
    speed: 0, cruise: 0, stun: 0, heading: 0,
    hp: TRAFFIC_HP, dead: false, exploded: false, burn: 0, deadT: 0,
    parked: false, parkT: 0, y: 0, vy: 0, spin: 0, roll: 0,
  };
}

function planTurn(o) {
  const opts = DIRS.filter((d) => !(d.x === -o.dir.x && d.z === -o.dir.z) && validDir(o.ni, o.nk, d));
  const straight = opts.find((d) => d.x === o.dir.x && d.z === o.dir.z);
  const nd = (straight && Math.random() < 0.55) ? straight : opts[Math.floor(Math.random() * opts.length)];
  o.newDir = nd;
  const cx = rc(o.ni), cz = rc(o.nk), ro = rightOf(o.dir), rn = rightOf(nd);
  if (nd === straight) o.target = { x: cx + ro.x * LANE, z: cz + ro.z * LANE };
  else o.target = { x: cx + (ro.x + rn.x) * LANE, z: cz + (ro.z + rn.z) * LANE };
}

function makeTraffic() {
  const f = focus();
  for (let tries = 0; tries < 20; tries++) {
    const i = Math.floor(Math.random() * (N + 1)), k = Math.floor(Math.random() * (N + 1));
    const opts = DIRS.filter((d) => validDir(i, k, d));
    const dir = opts[Math.floor(Math.random() * opts.length)];
    const r = rightOf(dir), t = 10 + Math.random() * (CELL - 20);
    const x = rc(i) + r.x * LANE + dir.x * t, z = rc(k) + r.z * LANE + dir.z * t;
    if (Math.hypot(x - f.x, z - f.z) < 25) continue;
    if (traffic.some((o) => Math.hypot(o.x - x, o.z - z) < 10)) continue;
    const o = entry(buildTrafficCar(), x, z);
    o.dir = dir; o.ni = i + dir.x; o.nk = k + dir.z;
    o.cruise = 9 + Math.random() * 6;
    o.heading = Math.atan2(-dir.x, -dir.z);
    planTurn(o);
    o.mesh.position.set(x, 0, z); o.mesh.rotation.set(0, o.heading, 0);
    scene.add(o.mesh);
    traffic.push(o);
    return o;
  }
  return null;
}

export function spawnTraffic() {
  for (const o of traffic) scene.remove(o.mesh);
  traffic.length = 0;
  const n = wanted();
  for (let i = 0; i < n; i++) makeTraffic();
}

// Une voiture du joueur qu'on laisse sur place (garée ou en épave)
export function parkCar(car, x, z, heading, hp = TRAFFIC_HP, dead = false) {
  if (car.spot) { car.root.remove(car.spot, car.spot.target); car.spot = null; }
  const o = entry(car, x, z);
  o.parked = true; o.heading = heading; o.hp = hp;
  o.dead = dead; o.exploded = dead;
  o.y = Math.max(0, car.root.position.y);
  traffic.push(o);
  return o;
}

// On retire une voiture de la circulation (quand on la vole)
export function removeTraffic(o) {
  const i = traffic.indexOf(o);
  if (i >= 0) traffic.splice(i, 1);
  if (aliveCount() < wanted()) makeTraffic();
  return o.car;
}

// La voiture la plus proche (pour la voler)
export function nearestCar(x, z, maxD) {
  let best = null, bd = maxD;
  for (const o of traffic) {
    if (o.dead) continue;
    const d = Math.hypot(o.vx - x, o.vz - z);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

// ----- Dégâts -----
export function damageTraffic(o, dmg) {
  if (o.exploded) return;
  o.hp -= dmg;
  o.stun = Math.max(o.stun, 3);
  const fast = 0.35 + Math.random() * 0.5;
  if (o.hp <= 0 && !o.dead) {
    o.dead = true; o.speed = 0;
    o.burn = dmg >= 40 ? fast : 2.5 + Math.random() * 1.5; // gros choc = explosion presque tout de suite
  } else if (o.dead && dmg >= 40) o.burn = Math.min(o.burn, fast);
}

function explodeCar(o) {
  o.exploded = true; o.deadT = 0;
  charMesh(o.mesh);
  o.vy = 10; o.roll = 0;
  o.spin = (Math.random() < 0.5 ? -1 : 1) * 7.85; // un tonneau complet en l'air
  explode(o.vx, 1, o.vz, 1, o);
}

// ----- Mise à jour -----
function driveAI(o, dt, pedObs) {
  let target = o.cruise;
  let f = Infinity;
  const look = (x, z) => {
    const rx = x - o.x, rz = z - o.z;
    const ahead = rx * o.dir.x + rz * o.dir.z;
    if (ahead <= 0 || ahead > 16) return;
    if (Math.abs(rx * o.dir.z - rz * o.dir.x) < 2.6) f = Math.min(f, ahead);
  };
  if (G.state !== 'menu') look(player.pos.x, player.pos.z);
  if (G.mode === 'foot' && G.hero) look(G.hero.pos.x, G.hero.pos.z);
  for (const q of traffic) if (q !== o) look(q.x, q.z);
  for (const q of pedObs) look(q.x, q.z); // on s'arrête pour les piétons
  if (f < Infinity) target = Math.min(target, Math.max(0, f - 6.5) * 1.5);
  if (o.stun > 0) { o.stun -= dt; target = 0; }
  o.speed = lerp(o.speed, target, damp(target < o.speed ? 5 : 1.5, dt));
  let move = o.speed * dt, guard = 0;
  while (move > 0 && guard++ < 4) {
    const dist = (o.target.x - o.x) * o.dir.x + (o.target.z - o.z) * o.dir.z;
    if (dist > move) { o.x += o.dir.x * move; o.z += o.dir.z * move; move = 0; }
    else {
      o.x = o.target.x; o.z = o.target.z; move -= Math.max(dist, 0);
      o.dir = o.newDir; o.ni += o.dir.x; o.nk += o.dir.z;
      planTurn(o);
    }
  }
  o.vx = lerp(o.vx, o.x, damp(8, dt));
  o.vz = lerp(o.vz, o.z, damp(8, dt));
  o.heading += angleDiff(o.heading, Math.atan2(-o.dir.x, -o.dir.z)) * damp(7, dt);
  o.mesh.position.set(o.vx, 0, o.vz);
  o.mesh.rotation.set(0, o.heading, 0);
  for (const w of o.car.wheels) w.rotation.x -= o.speed * dt / 0.42;
  if (o.hp < 30 && Math.random() < 0.15) smoke(o.vx, 1.3, o.vz, false, false);
}

// voiture arrêtée : garée, en feu ou en épave. Renvoie true s'il faut l'enlever
function updateStill(o, dt, f) {
  o.x = o.vx; o.z = o.vz;
  if (o.y > 0 || o.vy > 0) { // saut + tonneau après l'explosion
    o.vy -= 25 * dt; o.y += o.vy * dt; o.roll += o.spin * dt;
    if (o.y <= 0) { o.y = 0; o.vy = 0; o.spin = 0; o.roll = 0; }
  }
  o.mesh.position.set(o.vx, o.y + 0.8 * (1 - Math.cos(o.roll)), o.vz);
  o.mesh.rotation.set(0, o.heading, o.roll);
  const d = Math.hypot(o.vx - f.x, o.vz - f.z);
  if (o.dead) {
    if (!o.exploded) {
      o.burn -= dt;
      if (Math.random() < 0.6) smoke(o.vx, 1.4, o.vz, true, true);
      if (o.burn <= 0) explodeCar(o);
      return false;
    }
    o.deadT += dt;
    if (o.deadT < 10 && Math.random() < 0.35) smoke(o.vx, 1.2, o.vz, true, o.deadT < 5);
    return (o.deadT > 20 && d > 50) || o.deadT > 60;
  }
  o.parkT += dt;
  if (o.hp < 30 && Math.random() < 0.15) smoke(o.vx, 1.3, o.vz, false, false);
  return o.parkT > 30 && d > 160;
}

export function updateTraffic(dt) {
  const pedObs = G.peds ? G.peds.obstacles() : [];
  const f = focus();
  for (let n = traffic.length - 1; n >= 0; n--) {
    const o = traffic[n];
    if (o.parked || o.dead) {
      if (updateStill(o, dt, f)) {
        scene.remove(o.mesh);
        traffic.splice(n, 1);
        if (!o.parked && aliveCount() < wanted()) makeTraffic();
      }
      continue;
    }
    driveAI(o, dt, pedObs);
  }
}
