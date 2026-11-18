// =====================================================
//  AVIONS ✈️ : un aéroport au sud de la ville, des avions
//  à piloter, et des avions de ligne qui passent dans le ciel.
//  F = monter / descendre (en plein vol : saut en parachute 🪂)
//  ↑ = gaz · ↓ = ralentir · ← → = tourner
//  Espace = monter (cabrer) · Maj = descendre (piquer)
//  R = remettre l'avion sur la piste · C = changer de vue
//  ➜ Nouvel avion : ajoute un type dans TYPES puis une place dans SPOTS
// =====================================================
import * as THREE from 'three';
import { scene, camera } from '../render/engine.js';
import { G } from '../core/ctx.js';
import { save, persist } from '../core/save.js';
import { clamp, lerp, damp, angleDiff, isMobile } from '../core/utils.js';
import { HALF, LIMIT, rc, colliders, addCollider, trees, setPropVisible } from '../world/city.js';
import { terrainHeight, AIRPORT, inAirport } from '../world/terrain.js';
import { hero, toggleCar, hurtHero } from '../gameplay/onfoot.js';
import { explode, breakProp } from '../fx/destruction.js';
import { showMessage, refreshStats } from '../ui/hud.js';
import { sfx } from '../ui/audio.js';

// ----- Matériaux -----
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.25, ...o });
const M = {
  white: mat(0xf4f4f4), glass: mat(0x1e2c3c, { roughness: 0.1, metalness: 0.8 }),
  dark: mat(0x2a2c30, { roughness: 0.6 }), tire: mat(0x151515, { roughness: 0.9, metalness: 0 }),
  metal: mat(0xb8bcc2, { roughness: 0.3, metalness: 0.8 }),
  tarmac: new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.95 }),
  apron: new THREE.MeshStandardMaterial({ color: 0x5c5f64, roughness: 0.95 }),
  paint: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7 }),
  hangar: mat(0x9aa3ad, { roughness: 0.7 }), wall: mat(0xd9d4c7, { roughness: 0.9, metalness: 0 }),
  silk: new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.8, side: THREE.DoubleSide }),
};
const lampMat = (c) => new THREE.MeshBasicMaterial({ color: c });

// ----- Petites briques pour construire les avions -----
function bx(w, h, d, m, x, y, z, p, shadow = true) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z); o.castShadow = shadow;
  p.add(o);
  return o;
}
// cylindre couché le long de l'axe z (r1 = rayon à l'arrière, r2 = à l'avant)
function tube(r1, r2, len, m, x, y, z, p, seg = 14) {
  const g = new THREE.CylinderGeometry(r1, r2, len, seg); g.rotateX(Math.PI / 2);
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z); o.castShadow = true;
  p.add(o);
  return o;
}
// cône couché : pointe vers l'avant (-z) si front = true
function cone(r, len, m, x, y, z, p, front) {
  const g = new THREE.ConeGeometry(r, len, 14); g.rotateX(front ? -Math.PI / 2 : Math.PI / 2);
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z); o.castShadow = true;
  p.add(o);
  return o;
}
function wheel(x, y, z, p, r = 0.3) {
  const g = new THREE.CylinderGeometry(r, r, 0.22, 12); g.rotateZ(Math.PI / 2);
  const o = new THREE.Mesh(g, M.tire);
  o.position.set(x, y, z); o.castShadow = true;
  p.add(o);
}

// ----- Les modèles (l'avant de l'avion = -z, les roues touchent y = 0) -----
function buildCessna(color) {
  const root = new THREE.Group(), accent = mat(color);
  bx(1.3, 1.4, 6, M.white, 0, 1.5, -0.4, root);          // carlingue
  tube(0.25, 0.65, 3, M.white, 0, 1.7, 3.8, root);       // queue
  bx(1.32, 0.22, 6, accent, 0, 1.25, -0.4, root);        // bande de couleur
  bx(1.34, 0.5, 1.7, M.glass, 0, 2.0, -1.3, root);       // vitres
  bx(11, 0.16, 1.5, M.white, 0, 2.3, -0.9, root);        // aile (en haut)
  bx(0.7, 0.18, 1.52, accent, -5.2, 2.3, -0.9, root);    // bouts d'ailes
  bx(0.7, 0.18, 1.52, accent, 5.2, 2.3, -0.9, root);
  bx(3.8, 0.1, 0.9, M.white, 0, 1.8, 5.0, root);         // stabilisateur
  bx(0.1, 1.5, 1.1, accent, 0, 2.5, 5.0, root);          // dérive
  cone(0.32, 0.6, M.dark, 0, 1.45, -3.75, root, true);   // nez
  const prop = new THREE.Group(); prop.position.set(0, 1.45, -3.85); root.add(prop);
  bx(0.16, 2.2, 0.06, M.dark, 0, 0, 0, prop);            // hélice
  bx(2.3, 0.08, 0.12, M.dark, 0, 0.7, -0.3, root);       // train d'atterrissage
  bx(0.08, 0.9, 0.08, M.dark, 0, 0.75, -3.0, root);
  wheel(-1.15, 0.3, -0.3, root); wheel(1.15, 0.3, -0.3, root); wheel(0, 0.25, -3.0, root, 0.25);
  return { root, prop };
}
function buildJet(color) {
  const root = new THREE.Group(), accent = mat(color);
  tube(0.95, 0.95, 10, M.white, 0, 1.9, 0, root, 18);    // carlingue
  cone(0.95, 2.6, M.white, 0, 1.9, -6.3, root, true);    // nez
  tube(0.3, 0.95, 3, M.white, 0, 2.0, 6.5, root, 18);    // queue
  bx(1.4, 0.4, 1.0, M.glass, 0, 2.55, -4.6, root);       // pare-brise
  bx(1.93, 0.28, 7, M.glass, 0, 2.2, -0.5, root);        // hublots
  bx(1.95, 0.25, 10, accent, 0, 1.45, 0, root);          // bande
  const wl = bx(6.2, 0.18, 2.2, M.white, -3.6, 1.35, 1.4, root); wl.rotation.y = 0.32; // ailes en flèche
  const wr = bx(6.2, 0.18, 2.2, M.white, 3.6, 1.35, 1.4, root); wr.rotation.y = -0.32;
  for (const s of [-1, 1]) {
    tube(0.45, 0.5, 2.6, M.metal, s * 1.55, 2.4, 4.6, root); // réacteurs
    bx(0.9, 0.2, 1.2, M.white, s * 1.1, 2.3, 4.6, root);
  }
  const fin = bx(0.18, 2.6, 2.0, accent, 0, 3.6, 6.6, root); fin.rotation.x = 0.35; // dérive
  bx(4.8, 0.14, 1.2, M.white, 0, 4.85, 7.1, root);       // stabilisateur en T
  for (const s of [-1, 1]) { bx(0.1, 0.7, 0.1, M.dark, s * 1.5, 0.75, 1.2, root); wheel(s * 1.5, 0.35, 1.2, root, 0.35); }
  bx(0.1, 0.8, 0.1, M.dark, 0, 0.85, -4.3, root); wheel(0, 0.3, -4.3, root);
  return { root, prop: null };
}
// gros avion de ligne (décor, il vole tout seul très haut)
function buildAirliner(tail) {
  const root = new THREE.Group(), T = mat(tail);
  tube(2, 2, 26, M.white, 0, 0, 0, root, 16);
  cone(2, 5, M.white, 0, 0, -15.5, root, true);
  tube(0.6, 2, 7, M.white, 0, 0.6, 16.5, root, 16);
  bx(4.04, 0.6, 26, T, 0, -0.5, 0, root);
  const wl = bx(15, 0.5, 5, M.white, -8.5, -0.8, 1, root); wl.rotation.y = 0.4;
  const wr = bx(15, 0.5, 5, M.white, 8.5, -0.8, 1, root); wr.rotation.y = -0.4;
  for (const s of [-1, 1]) tube(1, 1.1, 4, M.metal, s * 6.5, -2, -1.5, root);
  const fin = bx(0.4, 7, 5, T, 0, 4.5, 16.5, root); fin.rotation.x = 0.4;
  bx(11, 0.3, 3, M.white, 0, 1, 18, root);
  bx(0.6, 0.6, 0.6, lampMat(0xff2020), -15.4, -0.8, 3.9, root, false); // feu rouge à gauche
  bx(0.6, 0.6, 0.6, lampMat(0x20ff40), 15.4, -0.8, 3.9, root, false);  // feu vert à droite
  const strobe = bx(0.7, 0.7, 0.7, lampMat(0xffffff), 0, 8.2, 19, root, false); // flash blanc
  root.traverse((o) => { o.castShadow = false; });
  return { root, strobe };
}

// ----- Les types d'avions pilotables -----
// maxSpeed, takeoff (vitesse pour décoller) en m/s · eye = place de la caméra « cockpit »
const TYPES = {
  cessna: { label: 'l\'avion de tourisme', maxSpeed: 55, accel: 9, takeoff: 24, turn: 0.95, eye: [2.65, -1.0], build: buildCessna },
  jet: { label: 'le jet privé', maxSpeed: 110, accel: 16, takeoff: 40, turn: 0.7, eye: [3.15, -4.0], build: buildJet },
};
// places au début de la piste (dx, dz = décalage depuis le centre de l'aéroport), tournés vers l'est
const SPOTS = [
  { type: 'cessna', color: 0xd62828, dx: -255, dz: 8, h: -Math.PI / 2 },
  { type: 'jet', color: 0x1d4e89, dx: -255, dz: 23, h: -Math.PI / 2 },
  { type: 'cessna', color: 0xffb703, dx: -215, dz: -14, h: -Math.PI / 2 },
];
// avions de ligne : cercle (centre, rayon R), altitude, vitesse (négative = dans l'autre sens)
const LINERS = [
  { cx: 0, cz: 0, R: 760, alt: 240, v: 70, a: 0, tail: 0x1d4e89, off: 0 },
  { cx: 250, cz: -150, R: 520, alt: 320, v: -62, a: 2, tail: 0xd62828, off: 0.4 },
  { cx: -300, cz: 250, R: 600, alt: 200, v: 66, a: 4, tail: 0x2a9d8f, off: 0.8 },
];

export const planes = [];
const liners = [];
let active = null;        // l'avion qu'on pilote
let chute = false;        // parachute ouvert ?
let canopy = null, hud = null, hudText = '';
let snapCam = false, warnT = 0, hinted = null;
const NO_INPUT = { up: false, down: false, steer: 0, drift: false, jump: false };

// ----- Construction de l'aéroport -----
function slab(w, d, m, x, y, z) {
  const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2);
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z); o.receiveShadow = true;
  scene.add(o);
}
function buildAirport() {
  const ax = AIRPORT.x, az = AIRPORT.z;
  slab(560, 30, M.tarmac, ax, 0.05, az + 15);                 // la piste
  slab(130, 50, M.apron, ax - 235, 0.04, az - 20);            // le parking des avions
  const r = rc(2), zEnd = az - 44;                             // route depuis la ville
  slab(14, zEnd - HALF + 2, M.tarmac, r, 0.04, (HALF + zEnd) / 2);
  for (let x = -255; x <= 255; x += 24) slab(12, 0.8, M.paint, ax + x, 0.07, az + 15); // pointillés
  slab(560, 0.6, M.paint, ax, 0.07, az + 0.8);                // bords de piste
  slab(560, 0.6, M.paint, ax, 0.07, az + 29.2);
  for (const e of [-1, 1]) for (let k = -4; k <= 4; k++) {
    if (k === 0) continue;
    slab(12, 1.4, M.paint, ax + e * 266, 0.07, az + 15 + k * 3); // bandes au bout de la piste
  }
  const blue = lampMat(0x3aa0ff);                               // petites lumières bleues
  for (let x = -270; x <= 270; x += 45) for (const zz of [0.2, 29.8]) bx(0.5, 0.4, 0.5, blue, ax + x, 0.2, az + zz, scene, false);
  // hangar
  bx(40, 13, 26, M.hangar, ax - 255, 6.5, az - 52, scene);
  bx(30, 10, 0.3, M.dark, ax - 255, 5, az - 38.9, scene, false);
  addCollider(ax - 255, az - 52, 40, 26, 13);
  // tour de contrôle
  bx(7, 22, 7, M.wall, ax - 150, 11, az - 30, scene);
  bx(10, 4, 10, M.glass, ax - 150, 24, az - 30, scene);
  bx(11, 0.6, 11, M.dark, ax - 150, 26.3, az - 30, scene);
  addCollider(ax - 150, az - 30, 10, 10, 26.6);
}
// les arbres de la forêt qui poussaient sur l'aéroport sont replantés ailleurs
function clearTrees() {
  for (const t of trees) {
    if (!inAirport(t.x, t.z, 20)) continue;
    for (let k = 0; k < 40; k++) {
      const x = (Math.random() * 2 - 1) * (LIMIT - 10), z = (Math.random() * 2 - 1) * (LIMIT - 10);
      if (Math.max(Math.abs(x), Math.abs(z)) < HALF + 14 || inAirport(x, z, 20) || terrainHeight(x, z) > 85) continue;
      const c = t.c, hw = (c.maxX - c.minX) / 2, hd = (c.maxZ - c.minZ) / 2;
      t.x = x; t.z = z;
      c.minX = x - hw; c.maxX = x + hw; c.minZ = z - hd; c.maxZ = z + hd;
      setPropVisible(t, true);
      break;
    }
  }
}

// ----- Avions pilotables -----
function place(p) {
  p.root.position.set(p.x, p.y, p.z);
  p.root.rotation.set(p.pitch, p.h, p.roll);
}
function homePlane(p) {
  p.x = p.home.x; p.z = p.home.z; p.h = p.home.h; p.y = terrainHeight(p.x, p.z);
  p.pitch = p.roll = p.speed = p.vy = 0;
  p.grounded = true; p.state = 'idle'; p.pilotless = false; p.air = 0;
  p.root.visible = true;
  place(p);
}
function makePlane(s) {
  const T = TYPES[s.type], m = T.build(s.color);
  m.root.rotation.order = 'YXZ';
  scene.add(m.root);
  const p = {
    T, root: m.root, prop: m.prop, home: { x: AIRPORT.x + s.dx, z: AIRPORT.z + s.dz, h: s.h },
    x: 0, y: 0, z: 0, h: 0, pitch: 0, roll: 0, speed: 0, vy: 0,
    grounded: true, state: 'idle', pilotless: false, timer: 0, air: 0,
  };
  homePlane(p);
  planes.push(p);
}
function nearPlane(x, z, r) {
  let best = null, bd = r;
  for (const p of planes) {
    if (p.state !== 'idle') continue;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

// est-ce qu'on rentre dans un immeuble, un arbre, un lampadaire ?
function hitWall(p) {
  if (p.y > 200) return null;
  const r = 1.5;
  for (const c of colliders) {
    if (c.h <= 0 || p.y > c.h) continue;
    if (p.x > c.minX - r && p.x < c.maxX + r && p.z > c.minZ - r && p.z < c.maxZ + r) return c;
  }
  return null;
}

function crash(p) {
  explode(p.x, p.y + 1, p.z, 1.8);
  G.shake = Math.max(G.shake, 0.9);
  p.state = 'wreck'; p.timer = 10; p.root.visible = false; p.pilotless = false;
  if (p === active) {
    active = null;
    const x = p.x + Math.cos(p.h) * 4, z = p.z - Math.sin(p.h) * 4;
    hero.pos.set(x, terrainHeight(x, z), z);
    hero.vy = 0; hero.speed = 0; hero.state = 'ok';
    G.mode = 'foot';
    hurtHero(45, -Math.sin(p.h), -Math.cos(p.h), 14);
    showMessage('💥 CRASH ! L\'avion revient à l\'aéroport dans 10 s', '#ff5050', 3);
  }
}
function landed(p) {
  if (p.air > 6) {
    save.money += 50; persist(); refreshStats();
    showMessage('🛬 Atterrissage réussi ! +50 $', '#7dff7d', 2.5);
    sfx('click', 0.6);
  }
  p.air = 0;
}

// Le vol (version « jeu vidéo », pas un vrai simulateur !)
function fly(p, dt, i) {
  const T = p.T, climb = i.jump, dive = i.drift && !i.jump;
  // gaz et freins
  if (i.up && p.speed < T.maxSpeed) p.speed += T.accel * dt;
  else if (i.down) p.speed -= (p.grounded ? 22 : 9) * dt;
  else if (p.grounded) p.speed -= 3 * dt;
  if (!p.grounded) p.speed -= Math.sin(p.pitch) * 9.8 * dt; // monter ralentit, piquer accélère
  if (p.speed > T.maxSpeed && p.pitch > -0.1) p.speed = lerp(p.speed, T.maxSpeed, damp(1, dt));
  p.speed = clamp(p.speed, 0, T.maxSpeed * 1.4);
  // nez en haut / en bas
  let tp = 0;
  if (p.pilotless) tp = -0.7; // personne aux commandes : il pique vers le sol
  else if (climb && (!p.grounded || p.speed > T.takeoff)) tp = 0.42;
  else if (dive && !p.grounded) tp = -0.5;
  p.pitch = lerp(p.pitch, tp, damp(2.2, dt));
  if (p.grounded && p.pitch < 0) p.pitch = 0;
  // virages (l'avion penche sur le côté en vol)
  const turn = p.grounded ? T.turn * 0.7 * clamp(p.speed / 8, 0.35, 1) : T.turn * (0.6 + 0.4 * clamp(p.speed / T.maxSpeed, 0, 1));
  p.h += i.steer * turn * dt;
  p.roll = lerp(p.roll, p.grounded ? 0 : i.steer * 0.7, damp(3, dt));
  // on avance
  let vy = p.speed * Math.sin(p.pitch);
  if (!p.grounded && p.speed < T.takeoff) vy -= (T.takeoff - p.speed) * 0.8; // trop lent : décrochage !
  p.vy = vy;
  const hs = p.speed * Math.cos(p.pitch), ox = p.x, oz = p.z;
  p.x += -Math.sin(p.h) * hs * dt; p.z += -Math.cos(p.h) * hs * dt; p.y += vy * dt;
  if (!p.grounded) p.air += dt;
  // bord du monde : l'avion fait demi-tour tout seul
  const B = LIMIT + 450;
  if (Math.abs(p.x) > B || Math.abs(p.z) > B) {
    p.h += angleDiff(p.h, Math.atan2(p.x, p.z)) * damp(1.5, dt);
    if (p === active && warnT <= 0) { showMessage('↩️ Bord du monde : demi-tour !', '#ffd23a', 1.5); warnT = 3; }
  }
  if (p.y > 650) { p.y = 650; if (p.pitch > 0) p.pitch *= 0.9; }
  // le sol
  const g = terrainHeight(p.x, p.z);
  if (p.y <= g) {
    if (!p.grounded) {
      if (vy < -11 || p.pilotless) { crash(p); return; } // trop vite vers le sol !
      p.grounded = true; p.pitch = 0;
      if (p === active) landed(p);
    }
    p.y = g;
  } else if (p.grounded && p.y > g + 0.4) {
    p.grounded = false; p.air = 0;
    if (p === active) showMessage('🛫 Décollage !', '#7df9ff', 1.5);
  }
  // immeubles, arbres, lampadaires
  const c = hitWall(p);
  if (c) {
    if (c.prop) { breakProp(c, -Math.sin(p.h), -Math.cos(p.h), 10); p.speed *= 0.8; }
    else if (p.grounded && p.speed < 15 && !p.pilotless) { p.x = ox; p.z = oz; p.speed = 0; }
    else { crash(p); return; }
  }
  if (p.prop) p.prop.rotation.z += dt * (8 + p.speed * 1.2); // l'hélice tourne
  place(p);
}

// ----- Monter, descendre, sauter en parachute -----
function enterPlane(p) {
  active = p; p.state = 'pilot'; p.pilotless = false; p.air = 0;
  G.mode = 'plane'; G.camHeading = p.h; snapCam = true;
  hero.speed = 0; chute = false;
  sfx('click', 0.6);
  showMessage(isMobile
    ? '✈️ Accélère, puis bouton saut = monter · lâche les gaz pour descendre'
    : '✈️ ↑ gaz · Espace = monter · Maj = descendre · F = sortir', '#7df9ff', 4);
}
export function exitPlane() {
  const p = active;
  if (!p) return;
  if (!p.grounded) {
    if (p.y - terrainHeight(p.x, p.z) < 25) { showMessage('Trop bas pour sauter ! Pose-toi d\'abord 🛬', '#ffd23a', 1.5); return; }
    active = null; p.state = 'falling'; p.pilotless = true;
    hero.pos.set(p.x, p.y - 1.5, p.z); hero.h = p.h;
    hero.vy = 0; hero.speed = 0; hero.grounded = false; hero.state = 'ok';
    G.mode = 'foot'; G.camHeading = p.h; chute = true;
    showMessage('🪂 Saut en parachute ! (l\'avion va s\'écraser...)', '#ff9d2e', 3);
    sfx('click', 0.5);
    return;
  }
  if (p.speed > 8) { showMessage('Ralentis pour sortir ! (↓)', '#ffd23a', 1.2); return; }
  active = null; p.state = 'idle'; p.speed = 0; p.pitch = 0; p.roll = 0;
  place(p);
  const lx = -2.2, lz = 2.5, cs = Math.cos(p.h), sn = Math.sin(p.h); // à côté de la carlingue
  const x = p.x + lx * cs + lz * sn, z = p.z - lx * sn + lz * cs;
  hero.pos.set(x, terrainHeight(x, z), z); hero.h = p.h;
  hero.vy = 0; hero.speed = 0; hero.state = 'ok';
  G.mode = 'foot';
  sfx('click', 0.5);
  showMessage('🚶 Tu es descendu de l\'avion', '#7df9ff', 1.5);
}
// Touche F : avion si on est juste à côté, sinon voiture
export function toggleVehicle() {
  if (G.mode === 'plane') { exitPlane(); return; }
  if (G.mode === 'foot' && hero.state === 'ok') {
    const p = nearPlane(hero.pos.x, hero.pos.z, 10);
    if (p) { enterPlane(p); return; }
  }
  toggleCar();
}
// Touche R en avion : retour au début de la piste
export function resetPlane() {
  const p = active;
  if (!p) return;
  homePlane(p);
  p.state = 'pilot';
  G.camHeading = p.h; snapCam = true;
  showMessage('✈️ Avion remis sur la piste', '#ffffff', 1.2);
}

// ----- Parachute -----
function buildCanopy() {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.4), M.silk);
  dome.position.y = 3.5; dome.castShadow = true;
  g.add(dome);
  const pts = [];
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2;
    pts.push(Math.cos(a) * 3.04, 4.49, Math.sin(a) * 3.04, 0, 0.3, 0);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x333333 })));
  g.visible = false;
  scene.add(g);
  return g;
}
function updateChute() {
  if (chute && (G.mode !== 'foot' || hero.grounded || hero.state !== 'ok')) chute = false;
  canopy.visible = chute;
  if (!chute) return;
  if (hero.vy < -5) hero.vy = -5; // on descend doucement
  canopy.position.set(hero.pos.x, hero.pos.y + 1.3, hero.pos.z);
  canopy.rotation.y = hero.h;
}

// ----- Affichage en vol (vitesse, altitude) -----
function makeHud() {
  hud = document.createElement('div');
  hud.id = 'planeHud';
  hud.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:20;padding:6px 14px;'
    + 'border-radius:12px;background:rgba(10,20,40,.65);color:#fff;font:600 15px system-ui,sans-serif;'
    + 'text-align:center;pointer-events:none;display:none;white-space:nowrap';
  document.body.appendChild(hud);
}
function updateHud() {
  const show = G.state === 'play' && !!active;
  hud.style.display = show ? 'block' : 'none';
  if (!show) return;
  const p = active, alt = Math.max(0, Math.round(p.y - terrainHeight(p.x, p.z)));
  let txt = '✈️ ' + Math.round(p.speed * 3.6) + ' km/h &nbsp; ⛰️ ' + alt + ' m';
  if (p.grounded && p.speed < p.T.takeoff) txt += '<br><small>↑ pour accélérer, puis ' + (isMobile ? 'bouton saut' : 'Espace') + ' pour décoller</small>';
  else if (!p.grounded && p.speed < p.T.takeoff) txt += '<br><b style="color:#ff6060">⚠️ DÉCROCHAGE ! Accélère !</b>';
  if (txt !== hudText) { hud.innerHTML = txt; hudText = txt; }
}

// ----- Avions de ligne -----
function updateLiners(t, dt) {
  for (const L of liners) {
    L.a += L.v / L.R * dt;
    const sg = Math.sign(L.v), vx = -Math.sin(L.a) * sg, vz = Math.cos(L.a) * sg;
    L.root.position.set(L.cx + Math.cos(L.a) * L.R, L.alt, L.cz + Math.sin(L.a) * L.R);
    L.root.rotation.set(0, Math.atan2(-vx, -vz), sg > 0 ? -0.12 : 0.12);
    L.strobe.visible = ((t + L.off) % 1.3) < 0.1;
  }
}

// ----- Démarrage (après buildCity) -----
export function initPlanes() {
  buildAirport();
  clearTrees();
  for (const s of SPOTS) makePlane(s);
  for (const L of LINERS) {
    const m = buildAirliner(L.tail);
    m.root.rotation.order = 'YXZ';
    scene.add(m.root);
    liners.push({ ...L, root: m.root, strobe: m.strobe });
  }
  canopy = buildCanopy();
  makeHud();
}

// ----- Chaque image (inp = commandes si on pilote, sinon null) -----
export function updatePlanes(dt, inp) {
  updateLiners(performance.now() / 1000, dt);
  if (warnT > 0) warnT -= dt;
  // nouvelle partie, retour au menu... : l'avion retourne à l'aéroport
  if (active && G.mode !== 'plane') { homePlane(active); active = null; }
  if (G.state === 'play' && G.mode === 'plane' && !active) G.mode = 'foot';
  for (const p of planes) {
    if (p.state === 'wreck') { p.timer -= dt; if (p.timer <= 0) homePlane(p); continue; }
    if (G.state !== 'play') { if (p.state === 'falling') homePlane(p); continue; }
    if (p === active) fly(p, dt, inp || NO_INPUT);
    else if (p.state === 'falling') fly(p, dt, NO_INPUT);
  }
  if (active) { // le héros est dans l'avion (pour les tirs, le soleil...)
    hero.pos.set(active.x, active.y, active.z);
    hero.h = active.h; hero.speed = active.speed; hero.vy = 0;
  }
  updateChute();
  // petit rappel quand on s'approche d'un avion
  if (G.state === 'play' && G.mode === 'foot' && hero.state === 'ok') {
    const p = nearPlane(hero.pos.x, hero.pos.z, 10);
    if (p && p !== hinted) showMessage('✈️ F : piloter ' + p.T.label, '#7df9ff', 2.5);
    hinted = p;
  } else hinted = null;
  updateHud();
}

// ----- Caméra en avion (C = derrière, loin, cockpit) -----
const VIEWS = [{ d: 17, h: 5 }, { d: 32, h: 10 }];
const _v = new THREE.Vector3();
export function updatePlaneCamera(dt) {
  const p = active;
  if (!p) return;
  G.camHeading += angleDiff(G.camHeading, p.h) * damp(3, dt);
  if (G.camMode % 3 === 2) { // vue cockpit
    p.root.updateMatrixWorld(true);
    _v.set(0, p.T.eye[0], p.T.eye[1]);
    p.root.localToWorld(_v);
    camera.position.copy(_v);
    camera.quaternion.copy(p.root.quaternion);
  } else {
    const V = VIEWS[G.camMode % 3], s = Math.sin(G.camHeading), c = Math.cos(G.camHeading);
    _v.set(p.x + s * V.d, p.y + V.h - Math.sin(p.pitch) * V.d * 0.5, p.z + c * V.d);
    _v.y = Math.max(_v.y, terrainHeight(_v.x, _v.z) + 1.5);
    if (snapCam) camera.position.copy(_v); else camera.position.lerp(_v, damp(5, dt));
    camera.lookAt(p.x - s * 12, p.y + 2 + Math.sin(p.pitch) * 12, p.z - c * 12);
  }
  snapCam = false;
  const fovT = 66 + clamp(p.speed / p.T.maxSpeed, 0, 1.3) * 12;
  camera.fov = lerp(camera.fov, fovT, damp(3, dt));
  if (G.shake > 0.01) {
    camera.position.x += (Math.random() - 0.5) * G.shake;
    camera.position.y += (Math.random() - 0.5) * G.shake;
    G.shake *= Math.exp(-5 * dt);
  }
  camera.updateProjectionMatrix();
}
