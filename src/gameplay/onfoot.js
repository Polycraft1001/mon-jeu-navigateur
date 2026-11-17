// =====================================================
//  À PIED : sortir de la voiture, marcher, courir, sauter,
//  voler une voiture, se faire renverser, K.O. ...
//  F / Entrée = sortir ou monter (ou voler la voiture la plus proche)
//  Maj = courir · Espace = sauter
//  R = appeler sa voiture (ou une neuve si elle est détruite)
// =====================================================
import * as THREE from 'three';
import { scene } from '../render/engine.js';
import { G } from '../core/ctx.js';
import { save, persist } from '../core/save.js';
import { STOLEN_CAR, WEAPONS } from '../core/config.js';
import { clamp, lerp, damp } from '../core/utils.js';
import { SPAWN, HALF, LIMIT, colliders, floorY, groundHeight } from '../world/city.js';
import { player, placeCar, nearestRoad, setPlayerCar, takeCar, localToWorld } from '../vehicles/driving.js';
import { traffic, parkCar, removeTraffic, nearestCar, TRAFFIC_HP } from '../vehicles/traffic.js';
import { makePlayable } from '../vehicles/models.js';
import { showMessage, refreshStats } from '../ui/hud.js';
import { sfx } from '../ui/audio.js';

const NO_INPUT = { up: false, down: false, steer: 0, sprint: false, jump: false };
const R = 0.4; // rayon du héros pour les collisions
const ground = (x, z) => Math.max(floorY(x, z), groundHeight(x, z));

// ----- Le héros : petit personnage low-poly fait de boîtes -----
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });
const M = {
  skin: mat(0xe0ac69), jacket: mat(0x1f2a44), shirt: mat(0xe63946), jeans: mat(0x3a5a8c), shoe: mat(0x1a1a1a),
  hair: mat(0x2b1a10, { roughness: 0.95 }), eye: mat(0x111111), metal: mat(0x2a2c30, { roughness: 0.35, metalness: 0.8 }),
  wood: mat(0x7a4a26), green: mat(0x4b5d33), orange: mat(0xff7a1a, { emissive: 0x552200 }),
};
function part(w, h, d, m, x, y, z, parent) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z); o.castShadow = true;
  parent.add(o);
  return o;
}
// un membre qui tourne autour de son articulation (hanche, épaule)
function limb(x, y, w, len, d, m, parent) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, 0);
  parent.add(pivot);
  part(w, len, d, m, 0, -len / 2, 0, pivot);
  return pivot;
}
const root = new THREE.Group(); root.rotation.order = 'YXZ';
const body = new THREE.Group(); root.add(body);
const legL = limb(-0.13, 0.92, 0.21, 0.88, 0.23, M.jeans, body);
const legR = limb(0.13, 0.92, 0.21, 0.88, 0.23, M.jeans, body);
for (const l of [legL, legR]) part(0.23, 0.12, 0.34, M.shoe, 0, -0.86, -0.05, l);
part(0.54, 0.64, 0.3, M.jacket, 0, 1.23, 0, body); // veste
part(0.2, 0.5, 0.02, M.shirt, 0, 1.25, -0.16, body); // t-shirt (devant = -z)
part(0.14, 0.08, 0.14, M.skin, 0, 1.58, 0, body); // cou
part(0.3, 0.32, 0.3, M.skin, 0, 1.76, 0, body); // tête
part(0.33, 0.1, 0.33, M.hair, 0, 1.94, 0.01, body); // cheveux
part(0.33, 0.24, 0.07, M.hair, 0, 1.82, 0.15, body);
for (const sx of [-1, 1]) part(0.05, 0.05, 0.02, M.eye, sx * 0.07, 1.78, -0.155, body);
const armL = limb(-0.35, 1.5, 0.15, 0.6, 0.17, M.jacket, body);
const armR = limb(0.35, 1.5, 0.15, 0.6, 0.17, M.jacket, body);
for (const a of [armL, armR]) part(0.13, 0.13, 0.13, M.skin, 0, -0.66, 0, a);

// ----- Les armes dans la main droite (le canon pointe vers -y du bras) -----
// ➜ Nouvelle arme : ajoute son modèle ici avec le même id que dans config.js
const hand = new THREE.Group(); hand.position.set(0, -0.66, 0); armR.add(hand);
const guns = {};
const GUN_LEN = { pistol: 0.3, smg: 0.45, shotgun: 0.85, rocket: 0.8 };
function gun(id, build) { const g = new THREE.Group(); build(g); g.visible = false; hand.add(g); guns[id] = g; }
gun('pistol', (g) => { part(0.07, 0.3, 0.1, M.metal, 0, -0.1, -0.03, g); part(0.06, 0.07, 0.16, M.metal, 0, 0.02, 0.07, g); });
gun('smg', (g) => { part(0.08, 0.46, 0.12, M.metal, 0, -0.16, -0.02, g); part(0.05, 0.07, 0.22, M.metal, 0, -0.1, 0.13, g); part(0.06, 0.06, 0.16, M.metal, 0, 0.04, 0.07, g); });
gun('shotgun', (g) => { part(0.07, 0.85, 0.08, M.metal, 0, -0.3, -0.03, g); part(0.09, 0.25, 0.1, M.wood, 0, -0.38, 0.06, g); part(0.08, 0.34, 0.13, M.wood, 0, 0.22, 0.04, g); });
gun('rocket', (g) => {
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.15, 10), M.green);
  t.position.set(-0.05, -0.15, -0.14); t.castShadow = true; g.add(t);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 10), M.orange);
  tip.rotation.x = Math.PI; tip.position.set(-0.05, -0.83, -0.14); g.add(tip);
});
export function showWeapon(id) { for (const k in guns) guns[k].visible = k === id; }
showWeapon((WEAPONS[save.weapon] || WEAPONS[0]).id);
root.visible = false;
scene.add(root);

export const hero = {
  pos: new THREE.Vector3(SPAWN.x, 0, SPAWN.z), h: 0, vy: 0, grounded: true, speed: 0,
  hp: 100, maxHp: 100, state: 'ok', downT: 0, kvx: 0, kvz: 0, regenT: 0, hurtT: 0,
  phase: 0, punchT: 0, aimT: 0, mesh: root,
};
G.hero = hero;

export const focusPos = () => (G.mode === 'foot' ? hero.pos : player.pos);

// Position du bout du canon (pour les tirs et les flammes)
const _mz = new THREE.Vector3();
export function heroMuzzle() {
  const w = WEAPONS[save.weapon] || WEAPONS[0];
  const lx = 0.33, lz = -(0.72 + (GUN_LEN[w.id] || 0.2));
  const c = Math.cos(hero.h), s = Math.sin(hero.h);
  return _mz.set(hero.pos.x + lx * c + lz * s, hero.pos.y + 1.45, hero.pos.z - lx * s + lz * c);
}

// ----- Collisions -----
function pushBoxes() {
  const p = hero.pos;
  for (const b of colliders) {
    if (b.h <= 0 || p.y >= b.h - 0.05) continue;
    if (p.x < b.minX - R || p.x > b.maxX + R || p.z < b.minZ - R || p.z > b.maxZ + R) continue;
    const cx = clamp(p.x, b.minX, b.maxX), cz = clamp(p.z, b.minZ, b.maxZ);
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= R * R) continue;
    if (d2 < 1e-8) { // à l'intérieur : on sort par le côté le plus proche
      const l = p.x - b.minX, r = b.maxX - p.x, t = p.z - b.minZ, bo = b.maxZ - p.z, m = Math.min(l, r, t, bo);
      if (m === l) p.x = b.minX - R; else if (m === r) p.x = b.maxX + R;
      else if (m === t) p.z = b.minZ - R; else p.z = b.maxZ + R;
    } else { const d = Math.sqrt(d2); p.x = cx + dx / d * R; p.z = cz + dz / d * R; }
  }
}
// une voiture = rectangle tourné. Renvoie true si on la touchait
function pushCar(x, z, h, S, y0, top) {
  const p = hero.pos;
  if (p.y > y0 + top) return false; // on est au-dessus
  const dx = p.x - x, dz = p.z - z;
  if (dx * dx + dz * dz > 30) return false;
  const cs = Math.cos(h), sn = Math.sin(h);
  const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
  const hw = S.W / 2 + R, hl = S.L / 2 + R;
  if (Math.abs(lx) >= hw || Math.abs(lz) >= hl) return false;
  let nlx = lx, nlz = lz;
  if (hw - Math.abs(lx) < hl - Math.abs(lz)) nlx = (lx >= 0 ? 1 : -1) * hw; else nlz = (lz >= 0 ? 1 : -1) * hl;
  p.x = x + nlx * cs + nlz * sn; p.z = z - nlx * sn + nlz * cs;
  return true;
}
function pushCars() {
  for (const o of traffic) {
    const hit = pushCar(o.vx, o.vz, o.heading, o.car.S, o.y, o.car.top || 1.5);
    if (hit && !o.parked && !o.dead && o.speed > 4 && hero.state === 'ok') {
      hurtHero(o.speed * 2.2, o.dir.x, o.dir.z, o.speed * 0.8); // renversé !
      o.stun = 2;
    }
  }
  if (G.car) {
    const hit = pushCar(player.pos.x, player.pos.z, player.h, G.car.S, player.y, G.car.top || 1.4);
    if (hit && Math.abs(player.speed) > 4 && hero.state === 'ok') {
      const sg = Math.sign(player.speed);
      hurtHero(Math.abs(player.speed) * 2, -Math.sin(player.vh) * sg, -Math.cos(player.vh) * sg, Math.abs(player.speed) * 0.8);
    }
  }
}
function move(dx, dz) {
  const p = hero.pos, ox = p.x, oz = p.z;
  p.x += dx; p.z += dz;
  if (ground(p.x, p.z) - p.y > 0.6) { p.x = ox; p.z = oz; } // marche trop haute
  pushBoxes();
  pushCars();
  p.x = clamp(p.x, -LIMIT, LIMIT); p.z = clamp(p.z, -LIMIT, LIMIT);
}
function blocked(x, z) {
  return colliders.some((b) => b.h > 0.5 && x > b.minX - R && x < b.maxX + R && z > b.minZ - R && z < b.maxZ + R);
}

// ----- Dégâts -----
function regen(dt) {
  if (hero.regenT > 0) hero.regenT -= dt;
  else if (hero.hp < hero.maxHp) hero.hp = Math.min(hero.maxHp, hero.hp + 6 * dt);
}
function knockDir(dx, dz, force) {
  const l = Math.hypot(dx, dz);
  if (l > 0.001) { hero.kvx = dx / l * force; hero.kvz = dz / l * force; hero.h = Math.atan2(dx / l, dz / l); }
  hero.vy = Math.min(9, force * 0.4); hero.grounded = false; hero.speed = 0;
}
// dx, dz = direction du choc · force = puissance (au-dessus de 5, on tombe)
export function hurtHero(dmg, dx = 0, dz = 0, force = 0) {
  if (G.mode !== 'foot' || G.state !== 'play' || hero.state === 'ko' || dmg <= 0) return;
  hero.hp -= dmg; hero.regenT = 4; hero.hurtT = 0.35;
  G.shake = Math.max(G.shake, Math.min(0.8, dmg / 40));
  if (hero.hp <= 0) {
    hero.hp = 0; hero.state = 'ko'; hero.downT = 3.5;
    knockDir(dx, dz, Math.max(force, 4));
    showMessage('💫 K.O. ! Tu vas te réveiller...', '#ff5050', 3);
  } else if (force > 5) {
    hero.state = 'down'; hero.downT = 1.2 + Math.min(1.5, force * 0.05);
    knockDir(dx, dz, force);
  }
}

// ----- Entrer / sortir / voler -----
const DEF_S = { W: 2, L: 4.4 };
function putHeroBesideCar() {
  const S = (G.car && G.car.S) || DEF_S, off = S.W / 2 + 0.9;
  const spots = [localToWorld(-off, 0), localToWorld(off, 0), localToWorld(0, S.L / 2 + 1), localToWorld(0, -S.L / 2 - 1)];
  const s = spots.find((q) => !blocked(q.x, q.z)) || spots[0];
  hero.pos.set(s.x, ground(s.x, s.z), s.z);
  hero.h = player.h; hero.vy = 0; hero.speed = 0; hero.state = 'ok';
}
function enterOwnCar() {
  G.mode = 'car';
  G.camHeading = player.h;
  hero.speed = 0;
  root.visible = false;
}
// on laisse notre voiture sur place (garée ou en épave)
function parkMine() {
  if (!G.car) return;
  const max = player.def.hp || 100;
  const o = parkCar(G.car, player.pos.x, player.pos.z, player.h, Math.max(1, TRAFFIC_HP * player.hp / max), player.wrecked);
  o.def = player.def; // on pourra la reprendre avec ses vraies qualités
  if (player.wrecked && player.burn > 0) { o.exploded = false; o.burn = player.burn; } // elle va exploser
  G.car = null;
}
function ensureSpot(car) { // phares de nuit
  if (car.spot) return;
  const spot = new THREE.SpotLight(0xfff2d0, 0, 70, 0.55, 0.5, 1.3);
  spot.position.set(0, 1, -car.S.L / 2);
  spot.target.position.set(0, 0, -car.S.L / 2 - 20);
  car.root.add(spot, spot.target);
  car.spot = spot;
}
function stealCar(o) {
  const def = o.def || STOLEN_CAR;
  const hp = Math.round((def.hp || 100) * clamp(o.hp / TRAFFIC_HP, 0.15, 1));
  const x = o.vx, z = o.vz, h = o.heading, mine = !!o.def;
  parkMine();
  const car = removeTraffic(o);
  makePlayable(car);
  ensureSpot(car);
  takeCar(car, def, hp, x, z, h);
  enterOwnCar();
  if (G.peds) G.peds.scare(x, z, 25);
  sfx('click', 0.6);
  if (!mine) showMessage('🚗 Voiture volée !', '#ff9d2e', 1.5);
}

export function exitCar() {
  if (G.mode !== 'car' || !G.car) return;
  if (Math.abs(player.speed) > 9) { showMessage('Ralentis pour sortir !', '#ffd23a', 1); return; }
  putHeroBesideCar();
  G.mode = 'foot';
  sfx('click', 0.5);
  showMessage('🚶 À pied ! F = monter · clic = tirer', '#7df9ff', 1.8);
}
export function enterCar() {
  if (G.mode !== 'foot' || hero.state !== 'ok') return;
  const p = hero.pos;
  if (G.car && !player.wrecked && Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < 4) { enterOwnCar(); sfx('click', 0.5); return; }
  const o = nearestCar(p.x, p.z, 4.5);
  if (o) { stealCar(o); return; }
  showMessage(G.car && player.wrecked ? 'Ta voiture est détruite · R = nouvelle voiture' : 'Approche-toi d\'une voiture', '#ffd23a', 1.5);
}
export const toggleCar = () => (G.mode === 'car' ? exitCar() : enterCar());

// Ce que fera la touche F (pour l'aide à l'écran)
export function enterHint() {
  if (G.mode !== 'foot' || hero.state !== 'ok') return null;
  const p = hero.pos;
  if (G.car && !player.wrecked && Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < 4) return 'F : monter';
  if (nearestCar(p.x, p.z, 4.5)) return 'F : voler la voiture';
  return null;
}

// Sortie forcée (voiture qui explose)
export function ejectHero(fromExplosion) {
  if (G.mode !== 'car' || !G.car) return;
  putHeroBesideCar();
  G.mode = 'foot';
  if (fromExplosion) hurtHero(30, hero.pos.x - player.pos.x, hero.pos.z - player.pos.z, 12);
}

// Remplace la voiture détruite par une neuve
function replaceCar() {
  parkMine();
  setPlayerCar();
}
function roadNear(x, z) {
  const r = nearestRoad(x, z);
  // un peu plus loin sur la route, pour ne pas tomber sur le héros
  if (r.h === 0) r.z = clamp(r.z - 7, -HALF + 10, HALF - 10);
  else r.x = clamp(r.x + 7, -HALF + 10, HALF - 10);
  return r;
}
export function callCar() {
  if (G.mode !== 'foot' || hero.state !== 'ok') return;
  const p = hero.pos;
  if (G.car && !player.wrecked) {
    if (Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < 40) { showMessage('Ta voiture est juste là ! (F pour monter)', '#7df9ff', 1.5); return; }
  } else replaceCar();
  placeCar(roadNear(p.x, p.z));
  sfx('horn', 0.5);
  showMessage('🚗 Ta voiture est arrivée !', '#7df9ff', 1.6);
}

function respawn() {
  hero.hp = hero.maxHp; hero.state = 'ok'; hero.kvx = hero.kvz = 0;
  body.rotation.x = 0; body.position.y = 0;
  const fee = Math.min(save.money, 100);
  save.money -= fee; persist(); refreshStats();
  if (!G.car || player.wrecked) replaceCar();
  placeCar(SPAWN);
  enterOwnCar();
  showMessage('🏥 Te revoilà ! Frais de soins : -' + fee + ' $', '#7df9ff', 3);
}

// Nouvelle partie / retour au menu
export function resetHero() {
  G.mode = 'car';
  Object.assign(hero, { state: 'ok', hp: hero.maxHp, speed: 0, vy: 0, kvx: 0, kvz: 0, regenT: 0, hurtT: 0, downT: 0 });
  body.rotation.x = 0; body.position.y = 0;
  root.visible = false;
}

// ----- Animation -----
function animate(dt) {
  root.position.copy(hero.pos);
  root.rotation.y = hero.h;
  const down = hero.state !== 'ok';
  body.rotation.x = lerp(body.rotation.x, down ? 1.45 : 0, damp(down ? 9 : 5, dt)); // tombe sur le dos
  body.position.y = lerp(body.position.y, down ? 0.18 : 0, damp(8, dt));
  const sp = Math.abs(hero.speed);
  hero.phase += dt * sp * 2.3;
  const amp = down ? 0 : Math.min(1, sp / 4) * 0.75;
  const sw = Math.sin(hero.phase) * amp;
  legL.rotation.x = hero.grounded || down ? sw : 0.5;
  legR.rotation.x = hero.grounded || down ? -sw : -0.3;
  const w = WEAPONS[save.weapon] || WEAPONS[0];
  const armed = !w.melee, aiming = armed && hero.aimT > 0 && !down, twoHands = armed && w.id !== 'pistol';
  let ar = -sw * 0.8, al = sw * 0.8; // balancement des bras
  if (armed) ar = aiming ? 1.5 : 0.35;
  if (aiming && twoHands) al = 1.35;
  if (hero.punchT > 0) ar = Math.sin((1 - hero.punchT / 0.25) * Math.PI) * 1.6;
  if (down) ar = al = 2.6; // bras en l'air quand il tombe
  armR.rotation.x = lerp(armR.rotation.x, ar, damp(18, dt));
  armL.rotation.x = lerp(armL.rotation.x, al, damp(18, dt));
  armL.rotation.z = aiming && twoHands ? 0.45 : 0;
}

// ----- Mise à jour (inp = commandes, ou null en pause) -----
export function updateHero(dt, inp) {
  if (hero.hurtT > 0) hero.hurtT -= dt;
  if (G.mode !== 'foot') { root.visible = false; regen(dt); return; }
  root.visible = true;
  const p = hero.pos;
  if (hero.punchT > 0) hero.punchT -= dt;
  if (hero.aimT > 0) hero.aimT -= dt;
  if (hero.state === 'ok') {
    regen(dt);
    const i = inp || NO_INPUT;
    hero.h += i.steer * 3.2 * dt;
    const target = i.up ? (i.sprint ? 8.5 : 4.6) : i.down ? -2.6 : 0;
    hero.speed = lerp(hero.speed, target, damp(12, dt));
    if (i.jump && hero.grounded) { hero.vy = 7.2; hero.grounded = false; }
    move(-Math.sin(hero.h) * hero.speed * dt, -Math.cos(hero.h) * hero.speed * dt);
  } else {
    // à terre : il glisse puis se relève
    const fr = Math.max(0, 1 - dt * (hero.grounded ? 5 : 0.3));
    hero.kvx *= fr; hero.kvz *= fr; hero.speed = 0;
    move(hero.kvx * dt, hero.kvz * dt);
    hero.downT -= dt;
    if (hero.downT <= 0) {
      if (hero.state === 'ko') { respawn(); return; }
      hero.state = 'ok';
    }
  }
  // gravité et sol (trottoirs, tremplins)
  const g = ground(p.x, p.z);
  hero.vy -= 22 * dt;
  p.y += hero.vy * dt;
  if (p.y <= g) { p.y = g; hero.vy = 0; hero.grounded = true; }
  else if (p.y > g + 0.3) hero.grounded = false;
  animate(dt);
}
