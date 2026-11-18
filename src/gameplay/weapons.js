// =====================================================
//  ARMES : poings, pistolet, mitraillette, fusil à pompe,
//  lance-roquettes.
//   - en voiture, en avion et sur téléphone : visée
//     automatique (anneau rouge sur la cible la plus proche)
//   - à pied sur ordinateur (souris capturée) : on vise à la
//     souris, avec le viseur au centre de l'écran (voir aim.js)
//  Tirs instantanés (rayons) et roquettes qui explosent.
//  Au début on a seulement les poings et le pistolet :
//  les autres armes s'achètent à l'armurerie 🔫 (shops.js).
//  Attention : tirer en ville ou toucher quelqu'un
//  fait venir la police (gameplay/police.js) !
//  ➜ Ajouter une arme : core/config.js (WEAPONS)
//     + son modèle 3D dans gameplay/onfoot.js (gun(...))
//     + son prix dans gameplay/shops.js (GUN_PRICES)
// =====================================================
import * as THREE from 'three';
import { scene, camera } from '../render/engine.js';
import { G } from '../core/ctx.js';
import { WEAPONS, POLICE } from '../core/config.js';
import { save, persist } from '../core/save.js';
import { clamp } from '../core/utils.js';
import { colliders } from '../world/city.js';
import { traffic, damageTraffic } from '../vehicles/traffic.js';
import { player, damageCar, localToWorld } from '../vehicles/driving.js';
import { emit, burst } from '../fx/particles.js';
import { muzzleFlash, explode, breakProp } from '../fx/destruction.js';
import { hero, heroMuzzle, showWeapon } from './onfoot.js';
import { cops, rayCops, hitCop, blastCops, crime, reportShot } from './police.js';
import { mouseLook } from './aim.js';
import { sfx } from '../ui/audio.js';
import { showMessage } from '../ui/hud.js';

export const arms = { cool: 0, trigger: false, target: null, mouse: false };
const ROCKET_SPEED = 60;

// ----- Les armes qu'on possède (gardées dans la sauvegarde) -----
if (!Array.isArray(save.guns)) save.guns = WEAPONS.filter((w) => w.melee || w.id === 'pistol').map((w) => w.id);
export const ownsWeapon = (i) => {
  const w = WEAPONS[i];
  return !!w && (w.melee || w.id === 'pistol' || save.guns.includes(w.id));
};
export function giveWeapon(i) {
  const w = WEAPONS[i];
  if (!w || save.guns.includes(w.id)) return;
  save.guns.push(w.id);
  persist();
}
// l'arme en main n'est pas (encore) achetée : on reprend le pistolet
if (WEAPONS[save.weapon] && !ownsWeapon(save.weapon)) {
  const p = WEAPONS.findIndex((w) => w.id === 'pistol');
  save.weapon = p >= 0 ? p : 0;
  persist();
  showWeapon(WEAPONS[save.weapon].id);
}

export const currentWeapon = () => WEAPONS[save.weapon] || WEAPONS[0];
// en voiture on ne peut pas donner de coups de poing : on tire au pistolet
const usedWeapon = () => { const w = currentWeapon(); return G.mode === 'car' && w.melee ? WEAPONS[1] : w; };

export function selectWeapon(i) {
  const n = WEAPONS.length;
  i = ((i % n) + n) % n;
  if (i === save.weapon) return true;
  if (!ownsWeapon(i)) { // pas encore achetée
    const w = WEAPONS[i];
    showMessage('🔒 ' + w.icon + ' ' + w.name + ' : en vente à l\'armurerie 🔫', '#ffd23a', 1.8);
    sfx('click', 0.25);
    return false;
  }
  save.weapon = i; persist();
  arms.cool = Math.max(arms.cool, 0.15);
  showWeapon(WEAPONS[i].id);
  sfx('click', 0.4);
  showMessage(WEAPONS[i].icon + ' ' + WEAPONS[i].name, '#ffffff', 0.9);
  return true;
}
// arme suivante / précédente (on saute celles qu'on n'a pas)
export function nextWeapon(d = 1) {
  const n = WEAPONS.length, s = d < 0 ? -1 : 1;
  for (let k = 1; k < n; k++) {
    const i = (((save.weapon + s * k) % n) + n) % n;
    if (ownsWeapon(i)) { selectWeapon(i); return; }
  }
}
export const setTrigger = (on) => { arms.trigger = !!on; };

// ----- Lancer de rayon (les balles vont tout droit, instantanément) -----
const T = [0, 0];
function slab(o, d, mn, mx) {
  if (Math.abs(d) < 1e-9) return o >= mn && o <= mx;
  let a = (mn - o) / d, b = (mx - o) / d;
  if (a > b) { const c = a; a = b; b = c; }
  if (a > T[0]) T[0] = a;
  if (b < T[1]) T[1] = b;
  return T[0] <= T[1];
}
function rayBox(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1, maxT) {
  T[0] = 0; T[1] = maxT;
  if (!slab(ox, dx, x0, x1) || !slab(oy, dy, y0, y1) || !slab(oz, dz, z0, z1)) return -1;
  return T[0];
}
// voiture = boîte tournée : on passe dans le repère de la voiture
function rayCar(o, d, x, y, z, h, S, top, maxT) {
  const qx = o.x - x, qz = o.z - z, r = maxT + 6;
  if (qx * qx + qz * qz > r * r) return -1;
  const cs = Math.cos(h), sn = Math.sin(h);
  return rayBox(qx * cs - qz * sn, o.y, qx * sn + qz * cs, d.x * cs - d.z * sn, d.y, d.x * sn + d.z * cs,
    -S.W / 2, y, -S.L / 2, S.W / 2, y + top, S.L / 2, maxT);
}
// Renvoie ce que le rayon touche en premier : sol, mur, voiture, piéton, policier...
function castRay(o, d, maxT, skipMyCar) {
  let best = maxT, kind = 'none', ref = null;
  if (d.y < -1e-4) { const t = (0.03 - o.y) / d.y; if (t > 0 && t < best) { best = t; kind = 'ground'; } }
  for (const b of colliders) {
    if (b.h <= 0) continue;
    const t = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, b.minX, 0, b.minZ, b.maxX, b.h, b.maxZ, best);
    if (t >= 0 && t < best) { best = t; kind = 'wall'; ref = b; }
  }
  for (const c of traffic) {
    const t = rayCar(o, d, c.vx, c.y, c.vz, c.heading, c.car.S, c.car.top || 1.5, best);
    if (t >= 0 && t < best) { best = t; kind = 'car'; ref = c; }
  }
  if (!skipMyCar && G.car) {
    const t = rayCar(o, d, player.pos.x, player.y, player.pos.z, player.h, G.car.S, G.car.top || 1.4, best);
    if (t >= 0 && t < best) { best = t; kind = 'mycar'; ref = null; }
  }
  if (G.peds) { const r = G.peds.raycast(o, d, best); if (r) { best = r.t; kind = 'ped'; ref = r.p; } }
  const k = rayCops(o, d, best);
  if (k) { best = k.t; kind = 'cop'; ref = k.cop; }
  return { kind, ref, t: best, x: o.x + d.x * best, y: o.y + d.y * best, z: o.z + d.z * best };
}
function clearShot(o, x, y, z) { // rien entre nous et la cible ?
  const dx = x - o.x, dy = y - o.y, dz = z - o.z, L = Math.hypot(dx, dy, dz) || 1;
  for (const b of colliders) {
    if (b.h <= 0) continue;
    if (rayBox(o.x, o.y, o.z, dx / L, dy / L, dz / L, b.minX, 0, b.minZ, b.maxX, b.h, b.maxZ, L - 0.5) >= 0) return false;
  }
  return true;
}

// ----- Visée automatique : la cible la plus proche du centre -----
const cands = [];
const _c = new THREE.Vector3();
function findTarget(o, h, range, cone) {
  const fx = -Math.sin(h), fz = -Math.cos(h);
  cands.length = 0;
  const add = (x, y, z) => {
    const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz);
    if (d < 0.8 || d > range) return;
    const a = Math.acos(clamp((dx * fx + dz * fz) / d, -1, 1));
    if (a < cone) cands.push({ x, y, z, s: a * 40 + d });
  };
  if (G.peds) for (const p of G.peds.list) if (p.mode === 'walk') { G.peds.center(p, _c); add(_c.x, _c.y - 0.1, _c.z); }
  for (const c of cops) if (c.state === 'ok') add(c.x, c.y + 1.1, c.z);
  for (const c of traffic) if (!c.exploded) add(c.vx, c.y + 0.9, c.vz);
  cands.sort((a, b) => a.s - b.s);
  for (let i = 0; i < Math.min(4, cands.length); i++) if (clearShot(o, cands[i].x, cands[i].y, cands[i].z)) return cands[i];
  return null;
}
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.5, 0.64, 32),
  new THREE.MeshBasicMaterial({ color: 0xff3040, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, fog: false })
);
ring.renderOrder = 999; ring.visible = false;
scene.add(ring);

// ----- Visée à la souris : ce qu'il y a au centre de l'écran -----
const LIVE = { ped: true, cop: true, car: true }; // cibles qui font rougir le viseur
const _cam = new THREE.Vector3();
const _so = { x: 0, y: 0, z: 0 };
const _st = { x: 0, y: 0, z: 0, kind: 'none' };
function screenTarget() {
  camera.getWorldDirection(_cam);
  const p = camera.position;
  // le rayon suit la ligne de visée de la caméra, mais part à hauteur du héros
  // (on ignore ce qui se trouve entre la caméra et le héros)
  const k = Math.max(0, (hero.pos.x - p.x) * _cam.x + (hero.pos.y + 1.4 - p.y) * _cam.y + (hero.pos.z - p.z) * _cam.z);
  _so.x = p.x + _cam.x * k; _so.y = p.y + _cam.y * k; _so.z = p.z + _cam.z * k;
  const h = castRay(_so, _cam, 250, false);
  _st.x = h.x; _st.y = h.y; _st.z = h.z; _st.kind = h.kind;
  return _st;
}

// ----- Viseur au centre de l'écran (blanc, rouge sur une cible) -----
const cross = document.createElement('div');
cross.style.cssText = 'position:fixed;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;pointer-events:none;z-index:40;display:none;color:#ffffff;filter:drop-shadow(0 0 2px rgba(0,0,0,.9))';
cross.innerHTML = '<svg viewBox="0 0 26 26" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">'
  + '<circle cx="13" cy="13" r="8"/><path d="M13 1v5M13 20v5M1 13h5M20 13h5"/>'
  + '<circle cx="13" cy="13" r="1.4" fill="currentColor" stroke="none"/></svg>';
document.body.appendChild(cross);
let crossOn = false, crossRed = false;
function setCross(on, red) {
  if (on !== crossOn) { crossOn = on; cross.style.display = on ? 'block' : 'none'; }
  if (on && red !== crossRed) { crossRed = red; cross.style.color = red ? '#ff3040' : '#ffffff'; }
}
// souris libérée (Échap, pause, boutique...) : on cache le viseur
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) setCross(false, false); });

// ----- Traînées des balles -----
const tracerGeo = new THREE.BoxGeometry(1, 1, 1); tracerGeo.translate(0, 0, 0.5);
const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const tracers = [];
for (let i = 0; i < 20; i++) {
  const m = new THREE.Mesh(tracerGeo, tracerMat);
  m.visible = false; m.frustumCulled = false;
  scene.add(m);
  tracers.push({ m, life: 0 });
}
let tracerIdx = 0;
const _from = new THREE.Vector3(), _to = new THREE.Vector3();
function tracer(a, b) {
  _from.set(a.x, a.y, a.z); _to.set(b.x, b.y, b.z);
  const len = _from.distanceTo(_to);
  if (len < 0.3) return;
  const t = tracers[tracerIdx]; tracerIdx = (tracerIdx + 1) % tracers.length;
  t.m.position.copy(_from); t.m.lookAt(_to); t.m.scale.set(0.035, 0.035, len);
  t.m.visible = true; t.life = 0.05;
}

// ----- Roquettes -----
const rocketGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.8, 8); rocketGeo.rotateX(Math.PI / 2);
const rocketMat = new THREE.MeshStandardMaterial({ color: 0x4b5d33, emissive: 0xff7a1a, emissiveIntensity: 0.6 });
const rockets = [];
for (let i = 0; i < 8; i++) {
  const m = new THREE.Mesh(rocketGeo, rocketMat);
  m.visible = false;
  scene.add(m);
  rockets.push({ m, on: false, x: 0, y: 0, z: 0, d: new THREE.Vector3(), dist: 0, fromCar: false });
}
function launchRocket(from, d, fromCar) {
  const r = rockets.find((q) => !q.on) || rockets[0];
  r.on = true; r.x = from.x; r.y = from.y; r.z = from.z; r.d.copy(d); r.dist = 0; r.fromCar = fromCar;
  r.m.visible = true; r.m.position.set(r.x, r.y, r.z);
  r.m.lookAt(_to.set(r.x + d.x, r.y + d.y, r.z + d.z));
}
const _o = { x: 0, y: 0, z: 0 };
function updateRockets(dt) {
  for (const r of rockets) {
    if (!r.on) continue;
    const step = ROCKET_SPEED * dt;
    _o.x = r.x; _o.y = r.y; _o.z = r.z;
    const hit = castRay(_o, r.d, step, r.fromCar && r.dist < 8);
    r.dist += step;
    if (hit.kind !== 'none' || r.dist > 220) {
      r.on = false; r.m.visible = false;
      explode(hit.x, Math.max(0, hit.y - 0.5), hit.z, 1.1);
      blastCops(hit.x, hit.z, 7); // les policiers autour tombent
      continue;
    }
    r.x = hit.x; r.y = hit.y; r.z = hit.z;
    r.m.position.set(r.x, r.y, r.z);
    emit(r.x, r.y, r.z, (Math.random() - 0.5) * 0.6, 0.4, (Math.random() - 0.5) * 0.6, '#cfcfcf', 0.55, 0.9, 2.5, false, 0.45);
    emit(r.x, r.y, r.z, -r.d.x * 3, -r.d.y * 3, -r.d.z * 3, '#ffb347', 0.35, 0.12, -0.5, true, 1);
  }
}

// ----- Effets d'un impact -----
function hitEffect(h, d, w) {
  const dmg = w.dmg || 0;
  if (h.kind === 'ped') {
    G.peds.shoot(h.ref, d, w.force + 3); burst(h.x, h.y, h.z, '#ffffff', 4, 2.5, false);
    crime(POLICE.crime.pedShot);
  } else if (h.kind === 'cop') { // toucher un policier : la police s'énerve beaucoup !
    hitCop(h.ref, dmg || 10, d.x, d.z, w.force + 3);
    burst(h.x, h.y, h.z, '#ffffff', 4, 2.5, false);
  }
  else if (h.kind === 'car') { damageTraffic(h.ref, dmg); burst(h.x, h.y, h.z, '#ffd27a', 6, 6, true); }
  else if (h.kind === 'mycar') { damageCar(dmg * 0.6); burst(h.x, h.y, h.z, '#ffd27a', 6, 6, true); }
  else if (h.kind === 'wall') {
    const b = h.ref;
    if (b.prop) { // arbre ou lampadaire : il finit par tomber
      b.hits = (b.hits || 0) + dmg;
      burst(h.x, h.y, h.z, b.kind === 't' ? '#6f9a45' : '#ffd27a', 5, 4, b.kind !== 't');
      if (b.hits >= (b.kind === 't' ? 100 : 50)) { b.hits = 0; breakProp(b, d.x, d.z, 8); }
    } else burst(h.x, h.y, h.z, '#cfc6b8', 5, 3, false);
  } else if (h.kind === 'ground') burst(h.x, h.y + 0.05, h.z, '#b8b0a0', 4, 2.5, false);
}

// ----- D'où part le tir ? -----
function shooter() {
  if (G.mode === 'car') {
    if (!G.car || player.wrecked) return null;
    const f = localToWorld(0, -G.car.S.L / 2 - 0.7);
    return { car: true, h: player.h, x: f.x, y: player.y + 0.95, z: f.z };
  }
  if (hero.state !== 'ok') return null;
  return { car: false, h: hero.h, x: hero.pos.x, y: hero.pos.y + 1.4, z: hero.pos.z };
}

const _d = new THREE.Vector3();
function fire(w, s) {
  const t = arms.target;
  if (t) _d.set(t.x - s.x, t.y - s.y, t.z - s.z);
  if (!t || _d.lengthSq() < 1) { // pas de cible (ou collée à nous) : tout droit
    if (arms.mouse) camera.getWorldDirection(_d);
    else _d.set(-Math.sin(s.h), s.car ? 0 : -0.02, -Math.cos(s.h));
  }
  _d.normalize();
  if (!s.car) { // le héros se tourne vers la cible (à la souris, c'est la souris qui le tourne)
    if (!arms.mouse) hero.h = Math.atan2(-_d.x, -_d.z);
    hero.aimT = 1.5;
  }
  const m = s.car ? s : heroMuzzle();
  const n = w.pellets || 1;
  for (let i = 0; i < n; i++) {
    const d = _d.clone();
    if (w.spread) {
      d.x += (Math.random() - 0.5) * 2 * w.spread; d.y += (Math.random() - 0.5) * w.spread; d.z += (Math.random() - 0.5) * 2 * w.spread;
      d.normalize();
    }
    if (w.rocket) { launchRocket(m, d, s.car); break; }
    const hit = castRay(s, d, w.range, s.car);
    hitEffect(hit, d, w);
    tracer(m, hit);
  }
  muzzleFlash(m.x, m.y, m.z);
  sfx(w.id, 0.55);
  if (G.peds) G.peds.scare(s.x, s.z, 45);
  reportShot(s.x, s.z); // un coup de feu en ville : la police l'entend
  G.shake = Math.max(G.shake, w.rocket || w.pellets ? 0.25 : 0.05);
}

function punch(w) {
  hero.punchT = 0.25;
  let fx = -Math.sin(hero.h), fz = -Math.cos(hero.h);
  // un policier juste devant ? (ça énerve la police !)
  let cop = null, cd = 2.4;
  for (const c of cops) {
    if (c.state !== 'ok') continue;
    const dx = c.x - hero.pos.x, dz = c.z - hero.pos.z, d = Math.hypot(dx, dz);
    if (d < cd && (dx * fx + dz * fz) / (d || 1) > 0.3) { cd = d; cop = c; }
  }
  if (cop) {
    const dx = cop.x - hero.pos.x, dz = cop.z - hero.pos.z, L = Math.hypot(dx, dz) || 1;
    if (!arms.mouse) hero.h = Math.atan2(-dx, -dz);
    hitCop(cop, w.dmg || 10, dx / L, dz / L, w.force);
    burst(cop.x, cop.y + 1.3, cop.z, '#ffffff', 4, 2, false);
    sfx('punch', 0.6);
    return;
  }
  // on vise le piéton le plus proche devant soi
  if (G.peds) {
    let best = null, bd = 2.6;
    for (const p of G.peds.list) {
      if (p.mode !== 'walk') continue;
      const dx = p.x - hero.pos.x, dz = p.z - hero.pos.z, d = Math.hypot(dx, dz);
      if (d < bd && (dx * fx + dz * fz) / (d || 1) > 0.4) { bd = d; best = p; }
    }
    if (best) {
      const a = Math.atan2(-(best.x - hero.pos.x), -(best.z - hero.pos.z));
      if (!arms.mouse) hero.h = a;
      fx = -Math.sin(a); fz = -Math.cos(a);
    }
  }
  _d.set(fx, 0, fz);
  const o = { x: hero.pos.x, y: hero.pos.y + 1.2, z: hero.pos.z };
  const r = G.peds ? G.peds.raycast(o, _d, w.range, true) : null;
  if (r) {
    G.peds.shoot(r.p, _d, w.force);
    crime(POLICE.crime.pedShot * 0.5);
    burst(o.x + fx * r.t, o.y, o.z + fz * r.t, '#ffffff', 4, 2, false);
    sfx('punch', 0.6);
    G.peds.scare(o.x, o.z, 15);
    return;
  }
  const hit = castRay(o, _d, w.range, false);
  if (hit.kind === 'cop') { hitCop(hit.ref, w.dmg || 10, _d.x, _d.z, w.force); sfx('punch', 0.6); }
  else if (hit.kind === 'car') { damageTraffic(hit.ref, w.dmg * 0.5); sfx('punch', 0.6); }
  else if (hit.kind === 'mycar') { damageCar(w.dmg * 0.3); sfx('punch', 0.6); }
  else if (hit.kind === 'wall') sfx('punch', 0.3);
}

// ----- Mise à jour (chaque image) -----
export function updateWeapons(dt) {
  if (arms.cool > 0) arms.cool -= dt;
  for (const t of tracers) if (t.life > 0) { t.life -= dt; if (t.life <= 0) t.m.visible = false; }
  updateRockets(dt);
  const s = G.state === 'play' ? shooter() : null;
  const w = usedWeapon();
  arms.mouse = !!s && !s.car && mouseLook(); // à pied + souris capturée
  let locked = false;
  if (arms.mouse) {
    // on tire là où pointe le viseur (centre de l'écran)
    arms.target = w.melee ? null : screenTarget();
    locked = !!arms.target && !!LIVE[arms.target.kind];
    if (!w.melee) hero.aimT = Math.max(hero.aimT, 0.15); // il garde son arme levée
  } else {
    arms.target = s && !w.melee ? findTarget(s, s.h, Math.min(w.range, 90), s.car ? 0.2 : 0.32) : null;
    locked = !!arms.target;
  }
  if (locked) {
    const t = arms.target;
    ring.visible = true;
    ring.position.set(t.x, t.y, t.z);
    ring.quaternion.copy(camera.quaternion);
    ring.scale.setScalar((arms.mouse ? 0.6 : 1) + 0.12 * Math.sin(performance.now() / 90));
  } else ring.visible = false;
  setCross(arms.mouse, locked);
  if (s && arms.trigger && arms.cool <= 0) {
    arms.cool = w.rate;
    if (w.melee) punch(w); else fire(w, s);
  }
}

export function resetWeapons() {
  arms.trigger = false; arms.cool = 0; arms.target = null; arms.mouse = false;
  ring.visible = false;
  setCross(false, false);
  for (const t of tracers) { t.life = 0; t.m.visible = false; }
  for (const r of rockets) { r.on = false; r.m.visible = false; }
}
