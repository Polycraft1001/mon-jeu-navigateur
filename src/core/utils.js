// =====================================================
//  OUTILS (petites fonctions utilisées partout)
// =====================================================
import * as THREE from 'three';

export const $ = (id) => document.getElementById(id);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (k, dt) => 1 - Math.exp(-k * dt);
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function makeRng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rand = makeRng(2026); // la ville est toujours la même
export const rr = (a, b) => a + rand() * (b - a);
export const pick = (arr) => arr[Math.floor(rand() * arr.length)];
export const isMobile = window.matchMedia('(pointer: coarse)').matches || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
export const dummy = new THREE.Object3D();
export const unitBox = new THREE.BoxGeometry(1, 1, 1);

// Ajoute une boîte (w x h x d) dans "parent"
export function box(w, h, d, mat, x, y, z, parent, shadow = true) {
  const m = new THREE.Mesh(unitBox, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  parent.add(m);
  return m;
}
