// =====================================================
//  RELIEF : la ville est plate, puis des collines
//  et des montagnes l'entourent.
//  Au sud de la ville : l'AÉROPORT, une grande zone plate ✈️
//  Autour : 3 AUTRES VILLES (TOWNS) reliées par des routes 🗺️
//  terrainHeight(x, z) = hauteur du sol (en mètres)
// =====================================================
import * as THREE from 'three';

let FLAT = 440;          // jusqu'ici : plat (la ville)
let FAR = 330;           // à partir d'ici : grandes montagnes (bord du monde)
const RISE = 140;        // distance pour que les collines montent
const TOWN_DIST = 900;   // distance entre le centre de la grande ville et les autres villes

// L'aéroport : rectangle tout plat (hw, hd = demi-largeur, demi-profondeur)
// m = distance sur laquelle les collines redescendent doucement autour
export const AIRPORT = { x: 0, z: 0, hw: 300, hd: 55, m: 90 };

// Les autres villes (construites dans world/towns.js)
// dx, dz = direction depuis la grande ville · tint = couleur du sol autour
export const TOWNS = [
  { id: 'candy', name: 'SUCREVILLE', dx: 1, dz: 0, x: 0, z: 0, hw: 150, hd: 150, tint: null },
  { id: 'west', name: 'CACTUS CITY', dx: -1, dz: 0, x: 0, z: 0, hw: 150, hd: 150, tint: 'sand' },
  { id: 'snow', name: 'NEIGEVILLE', dx: 0, dz: -1, x: 0, z: 0, hw: 150, hd: 150, tint: 'snow' },
];

// zones toutes plates : aéroport, villes, routes entre les villes
const ZONES = [AIRPORT];

export function initTerrain(half, limit = half + 420) {
  FLAT = half + 30;
  FAR = Math.max(330, limit - 80 - FLAT);
  AIRPORT.z = half + 87; // juste au sud de la ville
  ZONES.length = 0;
  ZONES.push(AIRPORT);
  for (const t of TOWNS) {
    t.x = t.dx * TOWN_DIST; t.z = t.dz * TOWN_DIST;
    ZONES.push({ x: t.x, z: t.z, hw: t.hw + 30, hd: t.hd + 30, m: 110 });
    // la route part du bord de la grande ville (sur la route du milieu, x=0 ou z=0)
    const edge = TOWN_DIST - t.hw, mid = (half + edge) / 2, len = (edge - half) / 2 + 12;
    t.road = t.dx
      ? { x: t.dx * mid, z: 0, hw: len, hd: 10, m: 60, alongX: true, from: half, to: edge }
      : { x: 0, z: t.dz * mid, hw: 10, hd: len, m: 60, alongX: false, from: half, to: edge };
    ZONES.push(t.road);
  }
}

const smooth = (t) => t * t * (3 - 2 * t);

// distance (en mètres) jusqu'à une zone rectangulaire (0 = dedans)
function zoneDist(Z, x, z) {
  return Math.max(Math.abs(x - Z.x) - Z.hw, Math.abs(z - Z.z) - Z.hd, 0);
}
export const inAirport = (x, z, extra = 0) => zoneDist(AIRPORT, x, z) <= extra;
export const inFlatZone = (x, z, extra = 0) => ZONES.some((Z) => zoneDist(Z, x, z) <= extra);
// près d'une ville qui a sa propre végétation (cactus, sapins) ?
export const wildTown = (x, z) => TOWNS.some((t) => t.tint && Math.max(Math.abs(x - t.x), Math.abs(z - t.z)) < t.hw + 420);

// collines et montagnes (sans les zones plates)
function hills(x, z) {
  const d = Math.max(Math.abs(x), Math.abs(z)) - FLAT;
  if (d <= 0) return 0;
  const t = d >= RISE ? 1 : smooth(d / RISE);
  // collines = plusieurs vagues mélangées
  const n = 13 + 9 * Math.sin(x * 0.011 + 1.3) * Math.cos(z * 0.009 - 0.7)
    + 5 * Math.sin(x * 0.027 + z * 0.019) + 2.5 * Math.sin(z * 0.05 - x * 0.031);
  const far = Math.max(0, d - FAR); // grandes montagnes au bord du monde
  return t * Math.max(0.5, n) + Math.min(far * far * 0.004, 150);
}

export function terrainHeight(x, z) {
  const h = hills(x, z);
  if (h <= 0) return 0;
  let f = 1;
  for (let i = 0; i < ZONES.length; i++) {
    const Z = ZONES[i], a = zoneDist(Z, x, z);
    if (a < Z.m) { const s = smooth(a / Z.m); if (s < f) f = s; }
  }
  return h * f; // aplati autour des zones plates
}

// Pente sous un objet (voiture) : tangage (avant/arrière) et roulis (gauche/droite)
export function slopeTilt(x, z, h, L, W, out) {
  const fx = -Math.sin(h), fz = -Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
  const a = L / 2, b = W / 2;
  out.pitch = Math.atan2(terrainHeight(x + fx * a, z + fz * a) - terrainHeight(x - fx * a, z - fz * a), L);
  out.roll = Math.atan2(terrainHeight(x + rx * b, z + rz * b) - terrainHeight(x - rx * b, z - rz * b), W);
  return out;
}

// Le grand sol en relief (herbe, sable ou neige près des villes, roche, neige en haut)
const ROCK = new THREE.Color(0.62, 0.55, 0.47), SNOW = new THREE.Color(1.6, 1.6, 1.7), SAND = new THREE.Color(1.75, 1.42, 0.78);
export function buildTerrain(mat, limit) {
  const size = (limit + 700) * 2, seg = 400;
  const g = new THREE.PlaneGeometry(size, size, seg, seg);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const h = terrainHeight(x, z);
    p.setY(i, h - 0.05);
    c.setRGB(1, 1, 1);
    for (const t of TOWNS) {
      if (!t.tint) continue;
      const dd = Math.max(Math.abs(x - t.x), Math.abs(z - t.z)) - t.hw;
      const w = 1 - THREE.MathUtils.smoothstep(dd, 60, 420);
      if (w > 0) c.lerp(t.tint === 'snow' ? SNOW : SAND, w);
    }
    c.lerp(ROCK, THREE.MathUtils.smoothstep(h, 28, 70))
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
