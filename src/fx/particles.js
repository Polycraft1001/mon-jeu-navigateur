// =====================================================
//  PARTICULES (fumée, étincelles, feu) ET TRACES DE PNEUS
// =====================================================
import * as THREE from 'three';
import { scene } from '../render/engine.js';
import { dummy, isMobile } from '../core/utils.js';
import { smokeTex } from '../world/textures.js';

const parts = [];
for (let i = 0; i < (isMobile ? 200 : 320); i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
  s.visible = false;
  scene.add(s);
  parts.push({ s, life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 1, grow: 1, op: 1 });
}
let partIdx = 0;
export function emit(x, y, z, vx, vy, vz, color, size, life, grow, additive, op = 0.6) {
  const P = parts[partIdx]; partIdx = (partIdx + 1) % parts.length;
  P.s.visible = true; P.s.position.set(x, y, z);
  P.vx = vx; P.vy = vy; P.vz = vz;
  P.s.material.color.set(color);
  P.s.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  P.size = size; P.grow = grow; P.life = P.max = life; P.op = op;
  P.s.scale.setScalar(size);
}
export function updateParticles(dt) {
  for (const P of parts) {
    if (P.life <= 0) continue;
    P.life -= dt;
    if (P.life <= 0) { P.s.visible = false; continue; }
    P.s.position.x += P.vx * dt; P.s.position.y += P.vy * dt; P.s.position.z += P.vz * dt;
    P.vx *= 0.96; P.vz *= 0.96;
    P.size = Math.max(0.01, P.size + P.grow * dt);
    P.s.scale.setScalar(P.size);
    P.s.material.opacity = (P.life / P.max) * P.op;
  }
}
export function burst(x, y, z, color, n = 14, speed = 8, additive = true) {
  for (let i = 0; i < n; i++) emit(x, y, z, (Math.random() - 0.5) * speed, Math.random() * speed * 0.7, (Math.random() - 0.5) * speed, color, 0.5, 0.5 + Math.random() * 0.3, -0.4, additive, 1);
}
// fumée qui monte (voiture abîmée ou en feu)
export function smoke(x, y, z, dark, fire) {
  emit(x + (Math.random() - 0.5), y, z + (Math.random() - 0.5), (Math.random() - 0.5), 2 + Math.random() * 2, (Math.random() - 0.5), dark ? '#2a2a2a' : '#9a9a9a', 1, 1.6, 2.2, false, dark ? 0.7 : 0.45);
  if (fire) emit(x + (Math.random() - 0.5) * 1.5, y, z + (Math.random() - 0.5) * 1.5, 0, 2.5 + Math.random() * 2, 0, Math.random() < 0.5 ? '#ff7a1a' : '#ffcf40', 1.1, 0.45, -1, true, 1);
}

// ----- Traces de pneus -----
const MAX_MARKS = 1200;
const markGeo = new THREE.PlaneGeometry(0.32, 1); markGeo.rotateX(-Math.PI / 2);
const marks = new THREE.InstancedMesh(markGeo, new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), MAX_MARKS);
marks.frustumCulled = false;
marks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
dummy.position.set(0, -10, 0); dummy.scale.set(0, 0, 0); dummy.updateMatrix();
for (let i = 0; i < MAX_MARKS; i++) marks.setMatrixAt(i, dummy.matrix);
dummy.scale.set(1, 1, 1);
scene.add(marks);
let markIdx = 0;
export function addMark(a, b, y) {
  const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
  if (len < 0.05 || len > 5) return;
  dummy.position.set((a.x + b.x) / 2, y + 0.04, (a.z + b.z) / 2);
  dummy.rotation.set(0, Math.atan2(dx, dz), 0);
  dummy.scale.set(1, 1, len + 0.05);
  dummy.updateMatrix();
  marks.setMatrixAt(markIdx, dummy.matrix);
  markIdx = (markIdx + 1) % MAX_MARKS;
  marks.instanceMatrix.needsUpdate = true;
  dummy.scale.set(1, 1, 1);
}
