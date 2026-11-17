// =====================================================
//  DESTRUCTION : explosions, débris, arbres et
//  lampadaires qui tombent, traces noires au sol
// =====================================================
import * as THREE from 'three';
import { scene, camera } from '../render/engine.js';
import { G } from '../core/ctx.js';
import { dummy, unitBox, clamp } from '../core/utils.js';
import { scorchTex } from '../world/textures.js';
import { colliders, propParts, lampHeadMat, setPropVisible, floorY } from '../world/city.js';
import { emit, burst } from './particles.js';
import { traffic, damageTraffic } from '../vehicles/traffic.js';
import { player, damageCar } from '../vehicles/driving.js';
import { hurtHero } from '../gameplay/onfoot.js';
import { sfx } from '../ui/audio.js';

// ----- Lumières des explosions et des tirs (créées dès le début : ajouter
//       une lumière en cours de jeu ferait ramer le navigateur) -----
const boomLight = new THREE.PointLight(0xff9a40, 0, 70, 2);
const muzzleLight = new THREE.PointLight(0xffd080, 0, 16, 2);
scene.add(boomLight, muzzleLight);
let boomT = 0, boomMax = 0, muzzleT = 0;

export function muzzleFlash(x, y, z) {
  muzzleLight.position.set(x, y, z);
  muzzleT = 0.06;
  emit(x, y, z, 0, 0.5, 0, '#ffd27a', 0.5, 0.06, 4, true, 1);
}

// ----- Débris (petits cubes qui volent) -----
const chunkMat = new THREE.MeshStandardMaterial({ color: 0x2b2826, roughness: 1 });
const chunks = [];
for (let i = 0; i < 48; i++) {
  const m = new THREE.Mesh(unitBox, chunkMat);
  m.visible = false; m.castShadow = true;
  scene.add(m);
  chunks.push({ m, life: 0, vx: 0, vy: 0, vz: 0, r: 0, s: 0.3 });
}
let chunkIdx = 0;
export function debris(x, y, z, n = 6, speed = 10) {
  for (let i = 0; i < n; i++) {
    const c = chunks[chunkIdx]; chunkIdx = (chunkIdx + 1) % chunks.length;
    c.s = 0.15 + Math.random() * 0.35;
    c.m.visible = true; c.m.position.set(x, y, z);
    c.m.scale.set(c.s, c.s * (0.5 + Math.random()), c.s);
    c.vx = (Math.random() - 0.5) * speed; c.vy = 3 + Math.random() * speed * 0.8; c.vz = (Math.random() - 0.5) * speed;
    c.r = (Math.random() - 0.5) * 14; c.life = 2.5 + Math.random();
  }
}

// ----- Traces noires d'explosion au sol -----
const MAX_SCORCH = 30;
const scorchGeo = new THREE.PlaneGeometry(1, 1); scorchGeo.rotateX(-Math.PI / 2);
const scorch = new THREE.InstancedMesh(scorchGeo, new THREE.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }), MAX_SCORCH);
scorch.frustumCulled = false;
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
for (let i = 0; i < MAX_SCORCH; i++) scorch.setMatrixAt(i, ZERO);
scene.add(scorch);
let scorchIdx = 0;
function addScorch(x, z, size) {
  dummy.position.set(x, floorY(x, z) + 0.03, z);
  dummy.rotation.set(0, Math.random() * 6, 0);
  dummy.scale.set(size, 1, size);
  dummy.updateMatrix();
  scorch.setMatrixAt(scorchIdx, dummy.matrix);
  scorchIdx = (scorchIdx + 1) % MAX_SCORCH;
  scorch.instanceMatrix.needsUpdate = true;
  dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
}

// ----- Arbres et lampadaires qui tombent -----
const fallers = [];
function spawnFaller(p, dx, dz, force) {
  const outer = new THREE.Group(), inner = new THREE.Group();
  outer.add(inner);
  if (p.type === 'tree') {
    const leafMat = new THREE.MeshStandardMaterial({ color: p.color || 0x4a7a35, roughness: 0.9, flatShading: true });
    const a = new THREE.Mesh(propParts.trunkGeo, propParts.trunkMat), b = new THREE.Mesh(propParts.leafGeo, leafMat);
    a.castShadow = b.castShadow = true;
    inner.add(a, b); inner.rotation.y = p.rot; inner.scale.setScalar(p.s);
    outer.position.set(p.x, 0.2, p.z);
    outer.userData.mat = leafMat;
  } else {
    const a = new THREE.Mesh(propParts.poleGeo, propParts.poleMat), b = new THREE.Mesh(propParts.headGeo, lampHeadMat);
    a.castShadow = true;
    inner.add(a, b);
    outer.position.set(p.x, 0, p.z);
  }
  scene.add(outer);
  const l = Math.hypot(dx, dz) || 1;
  fallers.push({
    g: outer, axis: new THREE.Vector3(dz / l, 0, -dx / l), dirX: dx / l, dirZ: dz / l,
    ang: 0, vel: 0.5 + Math.min(force, 40) * 0.05, max: p.type === 'tree' ? 1.15 : Math.PI / 2 - 0.03,
    life: 20, landed: false, len: p.type === 'tree' ? 4 * p.s : 6,
  });
}

// Casse un arbre / lampadaire. dx,dz = direction de la poussée
export function breakProp(c, dx, dz, force = 10) {
  if (!c.prop || c.h <= 0) return false;
  c.h = -1;
  const p = c.prop;
  setPropVisible(p, false);
  spawnFaller(p, dx, dz, force);
  if (p.type === 'tree') burst(p.x, 2, p.z, '#5f8f3a', 12, 7, false);
  else burst(p.x, 1, p.z, '#ffd27a', 12, 8, true);
  sfx('crash', 0.5);
  return true;
}

// ----- EXPLOSION -----
// power ~1 = voiture. ignore = l'objet qui explose (pour ne pas le compter 2 fois)
export function explode(x, y, z, power = 1, ignore = null) {
  const R = 11 * power;
  boomLight.position.set(x, y + 1.5, z);
  boomT = boomMax = 0.45; boomLight.userData.power = 3000 * power;
  for (let i = 0; i < 28; i++) emit(x, y + 0.5, z, (Math.random() - 0.5) * 14 * power, Math.random() * 9 * power, (Math.random() - 0.5) * 14 * power, Math.random() < 0.5 ? '#ff7a1a' : '#ffd040', 1.6 * power, 0.5 + Math.random() * 0.4, 1.5, true, 1);
  for (let i = 0; i < 14; i++) emit(x, y + 1, z, (Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 6, '#2b2b2b', 2.2 * power, 1.8 + Math.random(), 3, false, 0.6);
  debris(x, y + 0.5, z, 10, 14 * power);
  addScorch(x, z, 5 * power);
  const camD = camera.position.distanceTo(new THREE.Vector3(x, y, z));
  G.shake = Math.max(G.shake, clamp(1.4 * power * (1 - camD / 90), 0, 1.4));
  sfx('boom', clamp(1.2 - camD / 150, 0.15, 1));

  // voitures de la circulation (réaction en chaîne !)
  for (const o of traffic) {
    if (o === ignore) continue;
    const d = Math.hypot(o.vx - x, o.vz - z);
    if (d < R) damageTraffic(o, 140 * power * (1 - d / R) + 10);
  }
  // notre voiture
  if (ignore !== 'player' && G.car) {
    const d = Math.hypot(player.pos.x - x, player.pos.z - z);
    if (d < R) {
      damageCar(110 * power * (1 - d / R) + 5);
      if (d < R * 0.6 && player.grounded) { player.vy = 8 * (1 - d / R); player.grounded = false; player.air = 0; }
    }
  }
  // le héros à pied
  if (G.mode === 'foot' && G.hero) {
    const hx = G.hero.pos.x - x, hz = G.hero.pos.z - z, d = Math.hypot(hx, hz);
    if (d < R) hurtHero(80 * power * (1 - d / R) + 5, hx / (d || 1), hz / (d || 1), 14 * (1 - d / R));
  }
  // piétons (ils sont projetés puis se relèvent)
  if (G.peds) { G.peds.blast(x, y, z, R * 1.2, 18 * power); G.peds.scare(x, z, 60); }
  // arbres et lampadaires
  for (const c of colliders) {
    if (!c.prop || c.h <= 0) continue;
    const px = c.prop.x - x, pz = c.prop.z - z, d = Math.hypot(px, pz);
    if (d < R * 0.8) breakProp(c, px, pz, 25);
  }
}

// ----- Mise à jour -----
export function updateDestruction(dt) {
  if (boomT > 0) { boomT -= dt; boomLight.intensity = Math.max(0, boomT / boomMax) * (boomLight.userData.power || 3000); }
  else boomLight.intensity = 0;
  if (muzzleT > 0) { muzzleT -= dt; muzzleLight.intensity = 150; } else muzzleLight.intensity = 0;

  for (const c of chunks) {
    if (c.life <= 0) continue;
    c.life -= dt;
    if (c.life <= 0) { c.m.visible = false; continue; }
    c.vy -= 25 * dt;
    const m = c.m.position;
    m.x += c.vx * dt; m.y += c.vy * dt; m.z += c.vz * dt;
    if (m.y < c.s / 2) { m.y = c.s / 2; c.vy *= -0.3; c.vx *= 0.6; c.vz *= 0.6; c.r *= 0.6; }
    c.m.rotation.x += c.r * dt; c.m.rotation.z += c.r * 0.7 * dt;
  }

  for (let i = fallers.length - 1; i >= 0; i--) {
    const f = fallers[i];
    if (!f.landed) {
      f.vel += (3 + f.ang * 6) * dt;
      f.ang += f.vel * dt;
      if (f.ang >= f.max) {
        f.ang = f.max; f.landed = true;
        const tx = f.g.position.x + f.dirX * f.len, tz = f.g.position.z + f.dirZ * f.len;
        for (let k = 0; k < 8; k++) emit(tx, 0.5, tz, (Math.random() - 0.5) * 6, 1 + Math.random() * 2, (Math.random() - 0.5) * 6, '#b9ad9a', 1.2, 0.9, 2.5, false, 0.5);
        sfx('crash', 0.35);
      }
      f.g.quaternion.setFromAxisAngle(f.axis, f.ang);
    }
    f.life -= dt;
    if (f.life < 1.5) f.g.position.y -= dt * 1.5;
    if (f.life <= 0) {
      scene.remove(f.g);
      if (f.g.userData.mat) f.g.userData.mat.dispose();
      fallers.splice(i, 1);
    }
  }
}

// Remet tout en place (nouvelle partie)
export function resetDestruction() {
  for (const c of colliders) if (c.prop && c.h !== c.h0) { c.h = c.h0; setPropVisible(c.prop, true); }
  for (const f of fallers) { scene.remove(f.g); if (f.g.userData.mat) f.g.userData.mat.dispose(); }
  fallers.length = 0;
  for (const c of chunks) { c.life = 0; c.m.visible = false; }
  for (let i = 0; i < MAX_SCORCH; i++) scorch.setMatrixAt(i, ZERO);
  scorch.instanceMatrix.needsUpdate = true;
  boomT = 0; muzzleT = 0;
}
