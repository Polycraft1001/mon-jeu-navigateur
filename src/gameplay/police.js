// =====================================================
//  POLICE : niveau de recherche (1 à 5 étoiles), voitures de
//  police qui te poursuivent, policiers à pied qui tirent.
//  - Ce qui fait monter la recherche : core/config.js → POLICE.crime
//  - Semer la police : reste hors de vue (derrière les immeubles,
//    loin des voitures de police) : les étoiles finissent par baisser.
//  - « ARRÊTÉ » : un policier te touche alors que tu ne bouges plus
//    (ou une voiture de police te coince) → amende.
//  Les voitures de police sont rangées dans « traffic » (comme des
//  voitures garées) : on peut les percuter, les détruire… et les voler !
// =====================================================
import * as THREE from 'three';
import { scene } from '../render/engine.js';
import { G } from '../core/ctx.js';
import { save, persist } from '../core/save.js';
import { POLICE, POLICE_CAR, TIME_SET } from '../core/config.js';
import { clamp, lerp, damp, angleDiff, isMobile } from '../core/utils.js';
import { N, CELL, HALF, LIMIT, rc, colliders, floorY, groundHeight } from '../world/city.js';
import { buildPoliceCar } from '../vehicles/luxury.js';
import { traffic, parkCar } from '../vehicles/traffic.js';
import { player, damageCar } from '../vehicles/driving.js';
import { hero, hurtHero } from './onfoot.js';
import { makeCharacter } from '../npc/characters.js';
import { burst } from '../fx/particles.js';
import { muzzleFlash } from '../fx/destruction.js';
import { showMessage, refreshStats } from '../ui/hud.js';
import { sfx } from '../ui/audio.js';

export const wanted = { heat: 0, stars: 0, crimeT: 99, seenT: 99, bustT: 0 };
export const cops = [];     // policiers à pied
const cars = [];            // voitures de police (aussi dans « traffic »)
const MAX_CARS = isMobile ? [0, 1, 1, 2, 2, 3] : [0, 1, 2, 3, 4, 5]; // selon les étoiles
const MAX_COPS = isMobile ? 4 : 8;
const COP_HP = 40;
const CR = 0.4; // rayon d'un policier
const DIRS = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
const stolen = new WeakSet(); // voitures de police déjà volées (comptées une seule fois)
let spawnT = 0, seeT = 0, seeVal = false;
const focus = () => (G.mode === 'foot' ? hero.pos : player.pos);
const inCity = (x, z) => Math.abs(x) < HALF + 40 && Math.abs(z) < HALF + 40;

// =====================================================
//  NIVEAU DE RECHERCHE
// =====================================================
function countStars() {
  let s = 0;
  for (const t of POLICE.stars) if (wanted.heat >= t) s++;
  return s;
}
// Un délit ! pts = gravité (voir POLICE.crime dans config.js)
export function crime(pts) {
  if (G.state !== 'play' || !(pts > 0)) return;
  if (G.mode === 'foot' && hero.state === 'ko') return;
  const before = wanted.stars;
  wanted.heat = Math.min(wanted.heat + pts, POLICE.stars[POLICE.stars.length - 1] * 1.3);
  wanted.crimeT = 0;
  wanted.stars = countStars();
  if (wanted.stars > 0) { for (const c of cops) c.leave = false; for (const o of cars) o.patrol = false; }
  if (wanted.stars > before) {
    showMessage('🚨 RECHERCHÉ ' + '★'.repeat(wanted.stars), '#ff5050', 1.6);
    if (before === 0) spawnT = 1.5; // la première voiture arrive vite
  }
}
// Un coup de feu : la police l'entend en ville (ou si elle est tout près)
export function reportShot(x, z) {
  const near = cops.some((c) => Math.hypot(c.x - x, c.z - z) < 60) || cars.some((o) => Math.hypot(o.vx - x, o.vz - z) < 60);
  if (inCity(x, z) || near) crime(POLICE.crime.gunshot);
}
function clearWanted(msg, color) {
  wanted.heat = 0; wanted.stars = 0; wanted.bustT = 0;
  for (const c of cops) c.leave = true;   // les policiers s'en vont
  for (const o of cars) o.patrol = true;  // les voitures repartent
  if (msg) showMessage(msg, color, 2.5);
}
function busted() {
  const fine = Math.min(save.money, 50 + 50 * wanted.stars);
  save.money -= fine; persist(); refreshStats();
  G.shake = Math.max(G.shake, 0.3);
  clearWanted('🚔 ARRÊTÉ ! Amende : -' + fine + ' $', '#5aa0ff');
}

// =====================================================
//  AFFICHAGE DES ÉTOILES (créé ici, pas besoin de toucher index.html)
// =====================================================
let hudEl = null, hudKey = '';
function makeHud() {
  const st = document.createElement('style');
  st.textContent = '#wanted{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:30;pointer-events:none;'
    + 'font:700 28px system-ui,sans-serif;letter-spacing:3px;text-shadow:0 2px 5px #000;display:none;text-align:center}'
    + '#wanted .on{color:#ffd23a}#wanted .off{color:rgba(255,255,255,.25)}'
    + '#wanted.seen .on{animation:wantedBlink .5s steps(2) infinite}'
    + '@keyframes wantedBlink{50%{color:#ff4040}}'
    + '#wanted small{display:block;font-size:13px;letter-spacing:0;color:#fff;margin-top:-2px}';
  document.head.appendChild(st);
  hudEl = document.createElement('div');
  hudEl.id = 'wanted';
  document.body.appendChild(hudEl);
}
function drawHud() {
  if (!hudEl) return;
  const show = G.state === 'play' && wanted.stars > 0;
  const seen = wanted.seenT < 0.5, bust = wanted.bustT > 0.25, hidden = wanted.seenT > 6;
  const key = show + '|' + wanted.stars + '|' + seen + '|' + bust + '|' + hidden;
  if (key === hudKey) return;
  hudKey = key;
  hudEl.style.display = show ? 'block' : 'none';
  if (!show) return;
  let s = '';
  for (let i = 0; i < 5; i++) s += '<span class="' + (i < wanted.stars ? 'on' : 'off') + '">★</span>';
  hudEl.className = seen ? 'seen' : '';
  const txt = bust ? '🚔 Arrestation… bouge !' : seen ? 'La police te voit !' : hidden ? 'Caché… la recherche baisse' : 'Hors de vue…';
  hudEl.innerHTML = s + '<small>' + txt + '</small>';
}

// ----- Traînées des balles de la police -----
const tracers = [];
let trIdx = 0;
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
function tracer(ax, ay, az, bx, by, bz) {
  if (!tracers.length) return;
  _a.set(ax, ay, az); _b.set(bx, by, bz);
  const len = _a.distanceTo(_b);
  if (len < 0.3) return;
  const t = tracers[trIdx]; trIdx = (trIdx + 1) % tracers.length;
  t.m.position.copy(_a); t.m.lookAt(_b); t.m.scale.set(0.03, 0.03, len);
  t.m.visible = true; t.life = 0.05;
}

// ----- Gyrophares -----
let sirenLight = null;
function siren(car, on, t) {
  if (!car || !car.sirens) return;
  const a = Math.floor(t * 6) % 2 === 0;
  car.sirens[0].emissiveIntensity = on ? (a ? 4 : 0.2) : 0.1;
  car.sirens[1].emissiveIntensity = on ? (a ? 0.2 : 4) : 0.1;
}

// À appeler une fois au démarrage
export function initPolice() {
  makeHud();
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0, 0.5);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.visible = false; m.frustumCulled = false;
    scene.add(m);
    tracers.push({ m, life: 0 });
  }
  // une seule lumière rouge/bleue, posée sur la voiture de police la plus proche
  if (!isMobile) { sirenLight = new THREE.PointLight(0xff2020, 0, 26, 1.6); scene.add(sirenLight); }
}

// =====================================================
//  OUTILS : ligne de vue, collisions
// =====================================================
// true si aucun immeuble ne coupe la ligne entre A et B
function clearLine(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), z0 = Math.min(az, bz), z1 = Math.max(az, bz);
  for (const b of colliders) {
    if (b.h < 2.5 || b.prop) continue;
    if (b.maxX < x0 || b.minX > x1 || b.maxZ < z0 || b.minZ > z1) continue;
    let t0 = 0, t1 = 1;
    if (Math.abs(dx) > 1e-9) {
      let p = (b.minX - ax) / dx, q = (b.maxX - ax) / dx;
      if (p > q) { const s = p; p = q; q = s; }
      t0 = Math.max(t0, p); t1 = Math.min(t1, q);
    } else if (ax < b.minX || ax > b.maxX) continue;
    if (Math.abs(dz) > 1e-9) {
      let p = (b.minZ - az) / dz, q = (b.maxZ - az) / dz;
      if (p > q) { const s = p; p = q; q = s; }
      t0 = Math.max(t0, p); t1 = Math.min(t1, q);
    } else if (az < b.minZ || az > b.maxZ) continue;
    if (t0 <= t1) return false;
  }
  return true;
}
// sort un objet (x, z) d'une boîte de collision
function outOfBox(o, b, r) {
  const cx = clamp(o.x, b.minX, b.maxX), cz = clamp(o.z, b.minZ, b.maxZ);
  const dx = o.x - cx, dz = o.z - cz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 < 1e-8) {
    const l = o.x - b.minX, ri = b.maxX - o.x, t = o.z - b.minZ, bo = b.maxZ - o.z, m = Math.min(l, ri, t, bo);
    if (m === l) o.x = b.minX - r; else if (m === ri) o.x = b.maxX + r;
    else if (m === t) o.z = b.minZ - r; else o.z = b.maxZ + r;
  } else { const d = Math.sqrt(d2); o.x = cx + dx / d * r; o.z = cz + dz / d * r; }
  return true;
}
const _p = { x: 0, z: 0 };

// =====================================================
//  VOITURES DE POLICE
//  - sur les routes : à chaque carrefour, elles prennent la rue
//    qui les rapproche de toi
//  - à moins de 30 m : elles foncent droit sur toi
// =====================================================
function spawnCar(f) {
  let best = null, bs = Infinity;
  for (let n = 0; n < 40; n++) {
    const i = Math.floor(Math.random() * (N + 1)), k = Math.floor(Math.random() * (N + 1));
    const d = Math.hypot(rc(i) - f.x, rc(k) - f.z);
    const s = Math.abs(d - 110) + (d < 60 ? 1000 : 0); // ni trop près, ni trop loin
    if (s < bs) { bs = s; best = { i, k }; }
  }
  const car = buildPoliceCar();
  const o = parkCar(car, rc(best.i), rc(best.k), 0, 90);
  Object.assign(o, {
    police: true, def: POLICE_CAR, mode: 'road', gi: best.i, gk: best.k, ti: best.i, tk: best.k, pdir: null,
    pspeed: 0, stuckT: 0, ramT: 0, chaseCool: 0, empty: false, patrol: false, phase: Math.random(),
  });
  scene.add(car.root);
  cars.push(o);
}
function removeCar(o) {
  const i = traffic.indexOf(o);
  if (i < 0) return; // déjà partie (ou volée par le joueur : on n'y touche pas !)
  traffic.splice(i, 1);
  scene.remove(o.mesh);
}
const turnTo = (o, want, dt, rate) => { o.heading += angleDiff(o.heading, want) * damp(rate, dt); };

// au carrefour (gi, gk) : quelle rue prendre ?
function pickDir(o, tx, tz) {
  let best = null, bs = Infinity;
  for (const d of DIRS) {
    const i = o.gi + d.x, k = o.gk + d.z;
    if (i < 0 || i > N || k < 0 || k > N) continue;
    let s = Math.hypot(rc(i) - tx, rc(k) - tz) + Math.random() * CELL * 0.3;
    if (o.pdir && d.x === -o.pdir.x && d.z === -o.pdir.z) s += CELL * 0.7; // demi-tour : seulement si ça vaut le coup
    if (s < bs) { bs = s; best = d; }
  }
  o.pdir = best; o.ti = o.gi + best.x; o.tk = o.gk + best.z;
}
function driveRoad(o, dt, tx, tz, vmax) {
  if (!o.pdir) pickDir(o, tx, tz);
  o.pspeed = lerp(o.pspeed, vmax, damp(1.2, dt));
  let move = o.pspeed * dt, guard = 0;
  while (move > 0 && guard++ < 4) {
    const along = o.pdir.x !== 0 ? (rc(o.ti) - o.vx) * o.pdir.x : (rc(o.tk) - o.vz) * o.pdir.z;
    if (along > move) { o.vx += o.pdir.x * move; o.vz += o.pdir.z * move; move = 0; }
    else {
      if (o.pdir.x !== 0) o.vx = rc(o.ti); else o.vz = rc(o.tk);
      move -= Math.max(0, along);
      o.gi = o.ti; o.gk = o.tk;
      pickDir(o, tx, tz);
    }
  }
  // on se recale doucement au milieu de la route
  if (o.pdir.x !== 0) o.vz = lerp(o.vz, rc(o.tk), damp(2.5, dt));
  else o.vx = lerp(o.vx, rc(o.ti), damp(2.5, dt));
  turnTo(o, Math.atan2(-o.pdir.x, -o.pdir.z), dt, 6);
}
// retour sur la grille des routes (après une poursuite directe)
function toRoad(o, tx, tz) {
  const lo = rc(0), hi = rc(N);
  const gi = clamp(Math.round((o.vx - lo) / CELL), 0, N), gk = clamp(Math.round((o.vz - lo) / CELL), 0, N);
  if (Math.abs(o.vx - rc(gi)) <= Math.abs(o.vz - rc(gk))) { // route nord-sud
    o.vz = clamp(o.vz, lo, hi);
    const f = (o.vz - lo) / CELL, s = tz >= o.vz ? 1 : -1;
    o.pdir = s > 0 ? DIRS[2] : DIRS[3];
    o.ti = gi; o.tk = s > 0 ? Math.ceil(f) : Math.floor(f);
  } else { // route est-ouest
    o.vx = clamp(o.vx, lo, hi);
    const f = (o.vx - lo) / CELL, s = tx >= o.vx ? 1 : -1;
    o.pdir = s > 0 ? DIRS[0] : DIRS[1];
    o.tk = gk; o.ti = s > 0 ? Math.ceil(f) : Math.floor(f);
  }
  o.mode = 'road'; o.stuckT = 0;
}
function pushCarOut(o) {
  _p.x = o.vx; _p.z = o.vz;
  for (const b of colliders) {
    if (b.h <= 0.3) continue;
    if (_p.x < b.minX - 2.2 || _p.x > b.maxX + 2.2 || _p.z < b.minZ - 2.2 || _p.z > b.maxZ + 2.2) continue;
    if (outOfBox(_p, b, 2.2)) o.pspeed *= 0.97;
  }
  for (const q of traffic) {
    if (q === o) continue;
    const dx = _p.x - q.vx, dz = _p.z - q.vz, d2 = dx * dx + dz * dz;
    if (d2 < 16 && d2 > 1e-4) { const d = Math.sqrt(d2); _p.x = q.vx + dx / d * 4; _p.z = q.vz + dz / d * 4; }
  }
  o.vx = clamp(_p.x, -LIMIT + 3, LIMIT - 3); o.vz = clamp(_p.z, -LIMIT + 3, LIMIT - 3);
}
function driveChase(o, dt, tx, tz, vmax, stopDist) {
  const dx = tx - o.vx, dz = tz - o.vz, d = Math.hypot(dx, dz) || 0.001;
  turnTo(o, Math.atan2(-dx, -dz), dt, 3);
  const fx = -Math.sin(o.heading), fz = -Math.cos(o.heading);
  const align = Math.max(0, (dx * fx + dz * fz) / d); // 1 = la cible est droit devant
  const want = Math.min(vmax, Math.max(0, d - stopDist) * 1.5) * (0.3 + 0.7 * align);
  o.pspeed = lerp(o.pspeed, want, damp(want < o.pspeed ? 3 : 1.5, dt));
  const ox = o.vx, oz = o.vz;
  o.vx += fx * o.pspeed * dt; o.vz += fz * o.pspeed * dt;
  pushCarOut(o);
  const moved = Math.hypot(o.vx - ox, o.vz - oz);
  if (want > 4 && moved < want * dt * 0.3) o.stuckT += dt; // coincée contre un mur ?
  else o.stuckT = Math.max(0, o.stuckT - dt);
}
// Renvoie false quand la voiture n'est plus à nous
function updateCar(o, dt, f, t) {
  if (traffic.indexOf(o) < 0) return false; // volée par le joueur ou rangée par la circulation
  if (o.dead) { siren(o.car, false, t); return true; }
  siren(o.car, true, t + o.phase);
  if (o.empty) return true; // les policiers sont descendus
  const onFoot = G.mode === 'foot';
  const d = Math.hypot(f.x - o.vx, f.z - o.vz);
  if (o.patrol && d > 110) { removeCar(o); return false; }
  if (o.stun > 0) { o.stun -= dt * 2; o.pspeed *= Math.max(0, 1 - dt * 1.5); } // on vient de la percuter
  if (o.ramT > 0) o.ramT -= dt;
  if (o.chaseCool > 0) o.chaseCool -= dt;
  let tx = f.x, tz = f.z, vmax = POLICE.carSpeed[Math.max(1, wanted.stars)] || 30;
  if (o.patrol) { tx = o.vx + (o.vx - f.x) * 3; tz = o.vz + (o.vz - f.z) * 3; vmax = 13; } // elle s'éloigne
  const outside = Math.abs(f.x) > HALF + 4 || Math.abs(f.z) > HALF + 4; // tu es dans les collines
  if (!o.patrol && o.mode === 'road' && o.chaseCool <= 0 && (d < 30 || (outside && d < 170))) o.mode = 'chase';
  else if (o.mode === 'chase' && (o.patrol || (d > 50 && !outside) || o.stuckT > 2.5)) { toRoad(o, tx, tz); o.chaseCool = 3; }
  if (o.mode === 'chase') driveChase(o, dt, tx, tz, vmax, onFoot ? 9 : wanted.stars >= 3 ? 0 : 6.5);
  else driveRoad(o, dt, tx, tz, vmax);
  // la circulation affiche la voiture à partir de ces valeurs
  o.x = o.vx; o.z = o.vz; o.y = groundHeight(o.vx, o.vz);
  o.vy = 0; o.spin = 0; o.roll = 0; o.parkT = 0;
  const ws = (o.car.spin || 1) * o.pspeed * dt / 0.42;
  for (const w of o.car.wheels) w.rotation.x += ws;
  // tu es à pied et tout près : les policiers descendent
  if (onFoot && !o.patrol && wanted.stars > 0 && d < 26 && o.pspeed < 2.5 && cops.length < MAX_COPS) dropCops(o);
  // 3 étoiles et plus : elles te foncent dedans !
  if (!onFoot && G.car && !o.patrol && wanted.stars >= 3 && o.ramT <= 0 && d < 4.8 && o.pspeed > 6) {
    damageCar(o.pspeed * 0.45);
    o.ramT = 1.5; o.pspeed *= 0.35;
    G.shake = Math.max(G.shake, 0.45);
    burst((o.vx + f.x) / 2, player.y + 0.8, (o.vz + f.z) / 2, '#ffcc55', 14, 8, true);
  }
  return true;
}

// =====================================================
//  POLICIERS À PIED
// =====================================================
function addCop(x, z, h) {
  const ch = makeCharacter({ tint: 0x5577ee, cap: true, gun: true });
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  g.add(ch.root);
  scene.add(g);
  cops.push({
    ch, g, x, z, y: Math.max(floorY(x, z), groundHeight(x, z)), h, vy: 0, kvx: 0, kvz: 0, speed: 0,
    hp: COP_HP, state: 'ok', t: 0, fall: 0, hitT: 0, fireT: 0.8 + Math.random(), losT: 0, los: false, leave: wanted.stars === 0,
  });
}
function dropCops(o) {
  o.empty = true; o.pspeed = 0;
  const cs = Math.cos(o.heading), sn = Math.sin(o.heading), off = o.car.S.W / 2 + 0.7;
  for (const side of [-1, 1]) {
    if (cops.length >= MAX_COPS) break;
    addCop(o.vx + side * off * cs, o.vz - side * off * sn, o.heading);
  }
  sfx('click', 0.4);
}
function removeCop(i) {
  const c = cops[i];
  scene.remove(c.g);
  c.ch.dispose();
  cops.splice(i, 1);
}
function knockCop(c, dx, dz, force, ko) {
  const l = Math.hypot(dx, dz) || 1;
  c.kvx = dx / l * force; c.kvz = dz / l * force;
  c.vy = Math.min(8, force * 0.4);
  c.h = Math.atan2(dx / l, dz / l); // il tombe sur le dos
  c.state = ko ? 'ko' : 'down';
  c.t = ko ? 20 : 1.4 + Math.random() * 0.8;
  if (ko) burst(c.x, c.y + 1, c.z, '#ffe066', 8, 3, true); // petites étoiles : K.O.
}
// Un policier touché (balle, coup de poing…)
export function hitCop(c, dmg, dx, dz, force) {
  if (!c || c.state === 'ko') return;
  c.hp -= dmg;
  crime(POLICE.crime.copHit);
  if (c.hp <= 0) knockCop(c, dx, dz, Math.max(force, 5), true);
  else if (force > 7) knockCop(c, dx, dz, force, false);
}
// Explosion (roquette) : les policiers autour tombent
export function blastCops(x, z, r = 7) {
  for (const c of cops) {
    const dx = c.x - x, dz = c.z - z, d = Math.hypot(dx, dz);
    if (d < r) hitCop(c, 20 + 90 * (1 - d / r), dx, dz, 14);
  }
}
// Le rayon d'une balle touche-t-il un policier ? → { t, cop } ou null
export function rayCops(o, d, maxT) {
  let best = null, bt = maxT;
  const dd = d.x * d.x + d.z * d.z;
  if (dd < 1e-6) return null;
  for (const c of cops) {
    if (c.state === 'ko') continue;
    const fx = c.x - o.x, fz = c.z - o.z;
    const tc = (fx * d.x + fz * d.z) / dd; // moment où le rayon passe le plus près
    if (tc < 0 || tc > bt + 1) continue;
    const px = o.x + d.x * tc - c.x, pz = o.z + d.z * tc - c.z, r2 = px * px + pz * pz;
    if (r2 > CR * CR) continue;
    const t = Math.max(0, tc - Math.sqrt((CR * CR - r2) / dd));
    if (t >= bt) continue;
    const y = o.y + d.y * t, top = c.state === 'down' ? 0.6 : 1.85;
    if (y < c.y - 0.1 || y > c.y + top) continue;
    bt = t; best = c;
  }
  return best ? { t: bt, cop: best } : null;
}

function pushRect(c, x, z, h, S, y0, top) {
  if (c.y > y0 + top) return;
  const dx = c.x - x, dz = c.z - z;
  if (dx * dx + dz * dz > 30) return;
  const cs = Math.cos(h), sn = Math.sin(h);
  const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
  const hw = S.W / 2 + CR, hl = S.L / 2 + CR;
  if (Math.abs(lx) >= hw || Math.abs(lz) >= hl) return;
  let nlx = lx, nlz = lz;
  if (hw - Math.abs(lx) < hl - Math.abs(lz)) nlx = (lx >= 0 ? 1 : -1) * hw; else nlz = (lz >= 0 ? 1 : -1) * hl;
  c.x = x + nlx * cs + nlz * sn; c.z = z - nlx * sn + nlz * cs;
}
function pushCop(c) {
  for (const b of colliders) {
    if (b.h <= 0 || c.y >= b.h - 0.05) continue;
    if (c.x < b.minX - CR || c.x > b.maxX + CR || c.z < b.minZ - CR || c.z > b.maxZ + CR) continue;
    outOfBox(c, b, CR);
  }
  for (const o of traffic) pushRect(c, o.vx, o.vz, o.heading, o.car.S, o.y, o.car.top || 1.5);
  if (G.car) pushRect(c, player.pos.x, player.pos.z, player.h, G.car.S, player.y, G.car.top || 1.4);
  for (const q of cops) { // les policiers ne se marchent pas dessus
    if (q === c) continue;
    const dx = c.x - q.x, dz = c.z - q.z, d2 = dx * dx + dz * dz;
    if (d2 < 0.49 && d2 > 1e-6) { const d = Math.sqrt(d2), k = (0.7 - d) / 2 / d; c.x += dx * k; c.z += dz * k; }
  }
  if (G.mode === 'foot') { // ni sur le héros
    const dx = c.x - hero.pos.x, dz = c.z - hero.pos.z, d2 = dx * dx + dz * dz;
    if (d2 < 0.64 && d2 > 1e-6) { const d = Math.sqrt(d2); c.x = hero.pos.x + dx / d * 0.8; c.z = hero.pos.z + dz / d * 0.8; }
  }
  c.x = clamp(c.x, -LIMIT, LIMIT); c.z = clamp(c.z, -LIMIT, LIMIT);
}
// renversé par la voiture du joueur ?
function hitByCar(c) {
  if (G.mode !== 'car' || !G.car || c.state === 'ko' || c.hitT > 0) return;
  const sp = Math.abs(player.speed);
  if (sp < 6 || c.y > player.y + 1.6) return;
  if (Math.hypot(c.x - player.pos.x, c.z - player.pos.z) > 2.4) return;
  const sg = Math.sign(player.speed) || 1;
  c.hp -= sp * 3; c.hitT = 0.6;
  knockCop(c, -Math.sin(player.vh) * sg, -Math.cos(player.vh) * sg, sp * 0.8, c.hp <= 0);
  crime(POLICE.crime.copHit);
  G.shake = Math.max(G.shake, 0.3);
}
function copShoot(c, f, ty, d, onFoot) {
  const fx = -Math.sin(c.h), fz = -Math.cos(c.h), rx = Math.cos(c.h), rz = -Math.sin(c.h);
  const mx = c.x + fx * 0.7 + rx * 0.22, my = c.y + 1.4, mz = c.z + fz * 0.7 + rz * 0.22;
  muzzleFlash(mx, my, mz);
  sfx('pistol', clamp(0.4 - d / 80, 0.08, 0.35));
  let chance = 0.3 + 0.05 * wanted.stars;
  if (onFoot && Math.abs(hero.speed) > 6) chance -= 0.12;      // il court : plus dur à toucher
  if (!onFoot && Math.abs(player.speed) > 15) chance -= 0.15;  // voiture rapide aussi
  let ex = f.x, ey = ty, ez = f.z;
  if (Math.random() < chance) {
    if (onFoot) hurtHero(POLICE.copDamage, f.x - c.x, f.z - c.z, 0);
    else damageCar(POLICE.copDamage * 0.8);
    burst(ex, ey, ez, onFoot ? '#ffffff' : '#ffd27a', 5, 4, !onFoot);
  } else { // raté !
    ex += (Math.random() - 0.5) * 3; ez += (Math.random() - 0.5) * 3; ey = Math.max(0.05, ey - 1 - Math.random());
    burst(ex, ey, ez, '#cfc6b8', 3, 2, false);
  }
  tracer(mx, my, mz, ex, ey, ez);
}
const _aim = new THREE.Vector3();
function updateCop(c, dt, f, onFoot) {
  const ty = onFoot ? hero.pos.y + 1.1 : player.y + 0.8;
  const dx = f.x - c.x, dz = f.z - c.z, d = Math.hypot(dx, dz) || 0.001;
  let aim = null, want = 0;
  if (c.hitT > 0) c.hitT -= dt;
  if (c.state !== 'ok') { // à terre : il glisse puis se relève (sauf K.O.)
    const fr = Math.max(0, 1 - dt * 4);
    c.kvx *= fr; c.kvz *= fr;
    c.x += c.kvx * dt; c.z += c.kvz * dt;
    c.t -= dt;
    if (c.state === 'down' && c.t <= 0) c.state = 'ok';
    c.speed = 0;
  } else if (c.leave || wanted.stars === 0 || (onFoot && hero.state === 'ko')) {
    c.h += angleDiff(c.h, Math.atan2(dx, dz)) * damp(4, dt); // il s'en va tranquillement
    want = 2.2;
  } else {
    c.losT -= dt;
    if (c.losT <= 0) { c.losT = 0.3; c.los = clearLine(c.x, c.z, f.x, f.z); }
    const face = Math.atan2(-dx, -dz);
    c.h += angleDiff(c.h, face) * damp(8, dt);
    if (c.los && d < (onFoot ? 16 : 24) && d > 2.2) { // il s'arrête et tire
      _aim.set(dx, ty - (c.y + 1.4), dz).normalize();
      aim = _aim;
      c.fireT -= dt;
      if (c.fireT <= 0 && Math.abs(angleDiff(c.h, face)) < 0.35) {
        copShoot(c, f, ty, d, onFoot);
        c.fireT = Math.max(0.5, 1.5 - wanted.stars * 0.15) + Math.random() * 0.6;
      }
    } else if (d > 1.3) want = 5.8; // il court vers toi
  }
  c.speed = lerp(c.speed, want, damp(8, dt));
  if (c.speed > 0.01) { c.x -= Math.sin(c.h) * c.speed * dt; c.z -= Math.cos(c.h) * c.speed * dt; }
  hitByCar(c);
  pushCop(c);
  const g = Math.max(floorY(c.x, c.z), groundHeight(c.x, c.z));
  c.vy -= 22 * dt; c.y += c.vy * dt;
  if (c.y <= g) { c.y = g; c.vy = 0; }
  const down = c.state !== 'ok';
  c.fall = lerp(c.fall, down ? 1.45 : 0, damp(down ? 9 : 5, dt));
  c.g.position.set(c.x, c.y + 0.18 * c.fall / 1.45, c.z);
  c.g.rotation.set(c.fall, c.h, 0);
  c.ch.update(dt, down ? 0 : c.speed, aim, false);
}

// =====================================================
//  DÉLITS REPÉRÉS AUTOMATIQUEMENT
// =====================================================
function scanCrimes(f) {
  for (const o of traffic) {
    if (!o.dead || o.counted) continue;
    o.counted = true;
    if (o.def && !o.police) continue; // une de tes voitures garées : pas un délit
    if (Math.hypot(o.vx - f.x, o.vz - f.z) < 70) crime(o.police ? POLICE.crime.policeWreck : POLICE.crime.carWreck);
  }
  if (G.mode === 'car' && G.car && G.car.isPolice && !stolen.has(G.car)) {
    stolen.add(G.car);
    crime(POLICE.crime.policeCarStolen);
  }
}
// Est-ce que la police te voit ? (calculé 4 fois par seconde)
function policeSees(f, dt) {
  seeT -= dt;
  if (seeT > 0) return seeVal;
  seeT = 0.25; seeVal = false;
  for (const o of cars) {
    if (o.dead || o.empty || o.patrol) continue;
    const d = Math.hypot(o.vx - f.x, o.vz - f.z);
    if (d < 25 || (d < 70 && clearLine(o.vx, o.vz, f.x, f.z))) { seeVal = true; return true; }
  }
  for (const c of cops) {
    if (c.state === 'ko' || c.leave) continue;
    const d = Math.hypot(c.x - f.x, c.z - f.z);
    if (d < 8 || (d < 45 && c.los)) { seeVal = true; return true; }
  }
  return false;
}
function updateSirenLight(f, t) {
  if (!sirenLight) return;
  let best = null, bd = 45;
  for (const o of cars) {
    if (o.dead) continue;
    const d = Math.hypot(o.vx - f.x, o.vz - f.z);
    if (d < bd) { bd = d; best = o; }
  }
  let x, y, z;
  if (best) { x = best.vx; y = best.y + 2.2; z = best.vz; }
  else if (G.car && G.car.isPolice && G.mode === 'car') { x = player.pos.x; y = player.y + 2.2; z = player.pos.z; }
  else { sirenLight.intensity = 0; return; }
  const a = Math.floor(t * 6) % 2 === 0;
  sirenLight.color.setHex(a ? 0xff2020 : 0x2050ff);
  sirenLight.position.set(x, y, z);
  sirenLight.intensity = G.time === TIME_SET.night ? 60 : 18;
}

// Tout enlever (retour au menu)
export function resetPolice() {
  for (let i = cops.length - 1; i >= 0; i--) removeCop(i);
  for (const o of cars) removeCar(o);
  cars.length = 0;
  wanted.heat = 0; wanted.stars = 0; wanted.bustT = 0; wanted.seenT = 99; wanted.crimeT = 99;
  for (const o of traffic) if (o.dead) o.counted = true;
  for (const tr of tracers) { tr.life = 0; tr.m.visible = false; }
  if (sirenLight) sirenLight.intensity = 0;
}

// =====================================================
//  MISE À JOUR (chaque image, avant la circulation)
// =====================================================
export function updatePolice(dt) {
  const t = performance.now() / 1000;
  if (G.state !== 'play') {
    if (cars.length || cops.length || wanted.heat > 0) resetPolice();
    drawHud();
    return;
  }
  const onFoot = G.mode === 'foot';
  const f = focus();
  if (onFoot && hero.state === 'ko' && wanted.stars > 0) clearWanted('', ''); // à l'hôpital, la police laisse tomber
  scanCrimes(f);

  // la recherche baisse quand personne ne te voit
  wanted.crimeT += dt;
  const seen = wanted.stars > 0 && policeSees(f, dt);
  wanted.seenT = seen ? 0 : wanted.seenT + dt;
  if (wanted.heat > 0 && wanted.seenT > 6 && wanted.crimeT > 3) {
    const before = wanted.stars;
    wanted.heat = Math.max(0, wanted.heat - dt * (8 + wanted.heat * 0.06));
    wanted.stars = countStars();
    if (before > 0 && wanted.stars === 0) clearWanted('😎 Tu as semé la police !', '#7dff9a');
  }

  // renforts
  let active = 0;
  for (const o of cars) if (!o.empty && !o.dead && !o.patrol) active++;
  spawnT -= dt;
  if (wanted.stars > 0 && active < MAX_CARS[wanted.stars] && spawnT <= 0) { spawnCar(f); spawnT = 3; }

  for (let i = cars.length - 1; i >= 0; i--) if (!updateCar(cars[i], dt, f, t)) cars.splice(i, 1);
  for (let i = cops.length - 1; i >= 0; i--) {
    const c = cops[i];
    updateCop(c, dt, f, onFoot);
    const d = Math.hypot(c.x - f.x, c.z - f.z);
    if (d > 150 || (c.leave && d > 70) || (c.state === 'ko' && c.t <= 0)) removeCop(i);
  }

  // arrestation
  let busting = false;
  if (wanted.stars > 0) {
    if (onFoot) {
      if (hero.state !== 'ko' && Math.abs(hero.speed) < 1.5) busting = cops.some((c) => c.state === 'ok' && !c.leave && Math.hypot(c.x - f.x, c.z - f.z) < 1.9);
    } else if (Math.abs(player.speed) < 2.5) {
      busting = cars.some((o) => !o.empty && !o.dead && !o.patrol && Math.hypot(o.vx - f.x, o.vz - f.z) < 7.5);
    }
  }
  wanted.bustT = busting ? wanted.bustT + dt : Math.max(0, wanted.bustT - dt * 2);
  if (wanted.bustT > (onFoot ? 1.5 : 2.5)) busted();

  // gyrophares de la voiture de police que TU conduis
  if (G.car && G.car.isPolice) siren(G.car, G.mode === 'car', t);
  updateSirenLight(f, t);
  for (const tr of tracers) if (tr.life > 0) { tr.life -= dt; if (tr.life <= 0) tr.m.visible = false; }
  drawHud();
}
