// =====================================================
//  RELIEF : la ville est plate, puis des collines
//  et des montagnes l'entourent.
//  terrainHeight(x, z) = hauteur du sol (en mètres)
// =====================================================
import * as THREE from 'three';

let FLAT = 440;          // jusqu'ici : plat (la ville)
const RISE = 140;        // distance pour que les collines montent
export function initTerrain(half) { FLAT = half + 30; }

const smooth = (t) => t * t * (3 - 2 * t);
export function terrainHeight(x, z) {
  const d = Math.max(Math.abs(x), Math.abs(z)) - FLAT;
  if (d <= 0) return 0;
  const t = d >= RISE ? 1 : smooth(d / RISE);
  // collines = plusieurs vagues mélangées
  const n = 13 + 9 * Math.sin(x * 0.011 + 1.3) * Math.cos(z * 0.009 - 0.7)
    + 5 * Math.sin(x * 0.027 + z * 0.019) + 2.5 * Math.sin(z * 0.05 - x * 0.031);
  const far = Math.max(0, d - 330); // grandes montagnes au bord du monde
  return t * Math.max(0.5, n) + Math.min(far * far * 0.004, 150);
}

// Pente sous un objet (voiture) : tangage (avant/arrière) et roulis (gauche/droite)
export function slopeTilt(x, z, h, L, W, out) {
  const fx = -Math.sin(h), fz = -Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
  const a = L / 2, b = W / 2;
  out.pitch = Math.atan2(terrainHeight(x + fx * a, z + fz * a) - terrainHeight(x - fx * a, z - fz * a), L);
  out.roll = Math.atan2(terrainHeight(x + rx * b, z + rz * b) - terrainHeight(x - rx * b, z - rz * b), W);
  return out;
}

// Le grand sol en relief (herbe, puis roche, puis neige en haut)
const ROCK = new THREE.Color(0.62, 0.55, 0.47), SNOW = new THREE.Color(1.6, 1.6, 1.7);
export function buildTerrain(mat, limit) {
  const size = (limit + 700) * 2, seg = 300;
  const g = new THREE.PlaneGeometry(size, size, seg, seg);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const h = terrainHeight(p.getX(i), p.getZ(i));
    p.setY(i, h - 0.05);
    c.setRGB(1, 1, 1)
      .lerp(ROCK, THREE.MathUtils.smoothstep(h, 28, 70))
      .lerp(SNOW, THREE.MathUtils.smoothstep(h, 95, 130));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  mat.vertexColors = true;
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}
