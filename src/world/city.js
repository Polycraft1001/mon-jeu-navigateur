// =====================================================
//  LA VILLE : routes, immeubles, maisons, parcs, arbres,
//  lampadaires, tremplins, lacs, pièces, bancs, poubelles
//  et bouches d'incendie
//  + le relief tout autour (voir world/terrain.js)
//  + 3 AUTRES VILLES plus loin (voir world/towns.js) 🍭🌵❄️
//  🍬 Style « bonbon » : immeubles aux coins arrondis et aux
//    couleurs pastel, toits gourmands (dômes, sucettes,
//    cupcakes, flèches en sucre d'orge), arbres tout ronds,
//    lampadaires en sucre d'orge, maisons à toits bonbons
//  ➜ Les arbres et lampadaires sont des "props" qu'on peut
//    renverser (voir fx/destruction.js)
// =====================================================
import * as THREE from 'three';
import { scene, envMats, getEnvMap } from '../render/engine.js';
import { rand, rr, pick, dummy, box } from '../core/utils.js';
import { asphaltTex, sidewalkTex, grassTex, concreteTex, rampTex, FACADES, facadeTex, houseTex, houseEm, groundTex, roofTex, waterNormal } from './textures.js';
import { initTerrain, terrainHeight, buildTerrain, inFlatZone, wildTown } from './terrain.js';
import { buildTowns } from './towns.js';
import { roundBox, candyMat, stripeTex, swirlTex } from '../core/shapes.js';

// ----- Dimensions -----
export const N = 10;                // nombre de pâtés de maisons par côté
export const BLOCK = 64, ROAD = 16, CELL = BLOCK + ROAD;
export const CITY = N * CELL + ROAD, HALF = CITY / 2, LANE = 3.8;
export const LIMIT = HALF + 1000;   // bord du monde (collines + les 3 autres villes)
export const rc = (i) => -HALF + ROAD / 2 + i * CELL;   // centre de la route n° i
export const blockCenter = (j) => rc(j) + CELL / 2;
export const SPAWN = { x: LANE, z: 40, h: 0 };
initTerrain(HALF, LIMIT);

export const city = new THREE.Group();
scene.add(city);
export const colliders = [];   // boîtes contre lesquelles on se cogne
export const blocks = [], trees = [], lamps = [], houses = [], ramps = [], ponds = [], coins = [];
export const windowMats = [], neonMats = [];
export const propMeshes = { trunks: null, leaves: null, poles: null, heads: null, pools: null };
export let pools = null;
const matCache = {};

// kind : 'b' = bâtiment, 't' = arbre, 'l' = lampadaire
// h0 = hauteur d'origine (h passe à -1 quand l'objet est cassé)
export function addCollider(x, z, w, d, h, kind = 'b') {
  const c = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h, h0: h, kind, prop: null };
  colliders.push(c);
  return c;
}

// ----- Matériaux -----
// (bumpMap = petit relief : joints, gravier, briques...)
const roofMat = new THREE.MeshStandardMaterial({ color: 0xf6eaff, map: roofTex, bumpMap: roofTex, bumpScale: 1.5, roughness: 0.9 });
export const antennaMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2020, emissiveIntensity: 1 });
const sidewalkMat = new THREE.MeshStandardMaterial({ color: '#ffe9f1', map: sidewalkTex, bumpMap: sidewalkTex, bumpScale: 2, roughness: 0.95 });
sidewalkTex.repeat.set(16, 16);
export const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 });
grassTex.repeat.set(10, 10);
export const groundMat = new THREE.MeshStandardMaterial({ color: 0x6fbf55, map: groundTex, roughness: 1 });
groundTex.repeat.set(190, 190);
const concreteMat = new THREE.MeshStandardMaterial({ map: concreteTex, bumpMap: concreteTex, bumpScale: 1.5, roughness: 0.9 });
concreteTex.repeat.set(8, 8);
waterNormal.repeat.set(3, 3);
export const waterMat = new THREE.MeshStandardMaterial({
  color: 0x2f6fc0, roughness: 0.08, metalness: 0.3, envMap: getEnvMap(),
  normalMap: waterNormal, normalScale: new THREE.Vector2(0.5, 0.5),
});
envMats.push(waterMat);
// l'eau bouge doucement
const animWater = () => { const t = performance.now() * 0.00002; waterNormal.offset.set(t, t * 0.7); };
const rampMat = new THREE.MeshStandardMaterial({ map: rampTex, roughness: 0.7 });
export const lampHeadMat = new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffd28a, emissiveIntensity: 0.2 });
export const poolMat = new THREE.MeshBasicMaterial({ color: 0xffb85a, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });

// Morceaux des arbres et lampadaires (réutilisés quand ils tombent)
// arbres tout ronds 🌳 + lampadaires en sucre d'orge 🍭
export const propParts = (() => {
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.4, 8); trunkGeo.translate(0, 1.2, 0);
  const leafGeo = new THREE.SphereGeometry(2.3, 14, 10); leafGeo.translate(0, 3.9, 0);
  const poleGeo = new THREE.CylinderGeometry(0.15, 0.19, 7, 10); poleGeo.translate(0, 3.5, 0);
  const headGeo = new THREE.SphereGeometry(0.55, 14, 10); headGeo.translate(0, 7.1, 0);
  const poolGeo = new THREE.CircleGeometry(6, 20); poolGeo.rotateX(-Math.PI / 2);
  const caneTex = stripeTex('#ffffff', '#ff4f7b', 4); caneTex.repeat.set(1, 5);
  return {
    trunkGeo, leafGeo, poleGeo, headGeo, poolGeo,
    trunkMat: new THREE.MeshStandardMaterial({ color: 0x9a6b45, roughness: 0.9 }),
    leafMat: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
    poleMat: new THREE.MeshStandardMaterial({ map: caneTex, roughness: 0.35 }),
  };
})();

// Teintes pastel des immeubles (mélangées avec la texture de façade)
const TINTS = ['#ffffff', '#ffd9ea', '#d4f1ff', '#e9ddff', '#fff1c4', '#d6ffe9', '#ffe2d0'];
function facadeMaterial(fi, w, d, h, ti = 0) {
  const f = FACADES[fi];
  const across = Math.max(1, Math.round(Math.max(w, d) / (f.glassy ? 3 : 4)));
  const floors = Math.max(1, Math.round(h / 3.5));
  const key = fi + '_' + across + '_' + floors + '_' + ti;
  if (matCache[key]) return matCache[key];
  const map = facadeTex[fi].map.clone(); map.repeat.set(across / 8, floors / 8); map.needsUpdate = true;
  const em = facadeTex[fi].em.clone(); em.repeat.set(across / 8, floors / 8); em.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({
    color: TINTS[ti], map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0,
    bumpMap: f.glassy ? null : map, bumpScale: 1.2,
    roughness: f.glassy ? 0.25 : 0.7, metalness: f.glassy ? 0.3 : 0.02,
    envMap: f.glassy ? getEnvMap() : null,
  });
  windowMats.push(m);
  if (f.glassy) envMats.push(m);
  matCache[key] = m;
  return m;
}

const NEON_COLORS = ['#ff2d95', '#00e5ff', '#ffe600', '#7cff4f', '#b14dff', '#ff7a00'];
const neonMatByColor = {};
function neonMat(col) {
  if (!neonMatByColor[col]) {
    neonMatByColor[col] = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1 });
    neonMats.push(neonMatByColor[col]);
  }
  return neonMatByColor[col];
}

// ----- Décorations « bonbon » sur les toits 🧁🍭 -----
// (rangées dans des listes, puis dessinées d'un coup = rapide)
const POP = ['#ff7eb6', '#7fe0c4', '#b79bff', '#ffd84d', '#6fc3ff', '#ff9f6e', '#ffc2dc'];
const CREAMS = ['#fff3f8', '#ffc2dc', '#d9ccff', '#c8f3e2', '#fff1b8'];
const deco = { ball: [], dome: [], spire: [], stick: [], pop: [] };
// x, z = centre du toit · y = hauteur du toit · s = largeur du toit
function roofDeco(x, y, z, s) {
  const k = rand(), c = pick(POP);
  if (k < 0.28) {                 // dôme en guimauve + bonbon au sommet
    const r = s * 0.36, b = Math.max(0.7, s * 0.06);
    deco.dome.push([x, y - 0.3, z, r, r * 0.75, r, c]);
    deco.ball.push([x, y - 0.3 + r * 0.75 + b * 0.7, z, b, b, b, pick(POP)]);
  } else if (k < 0.52) {          // flèche en sucre d'orge
    const r = s * 0.2, hh = s * 0.9;
    deco.spire.push([x, y - 0.3, z, r, hh, r]);
    deco.ball.push([x, y - 0.3 + hh, z, r * 0.28, r * 0.28, r * 0.28, c]);
  } else if (k < 0.78) {          // chapeau de cupcake + cerise
    const r = s * 0.3, cr = pick(CREAMS);
    deco.ball.push([x, y + r * 0.1, z, r * 1.15, r * 0.5, r * 1.15, cr]);
    deco.ball.push([x, y + r * 0.55, z, r * 0.8, r * 0.4, r * 0.8, cr]);
    deco.ball.push([x, y + r * 0.9, z, r * 0.45, r * 0.3, r * 0.45, cr]);
    deco.ball.push([x, y + r * 1.32, z, r * 0.2, r * 0.2, r * 0.2, '#e8203f']);
  } else {                        // sucette géante
    const hh = s * 0.5, r = s * 0.24, st = Math.max(0.25, s * 0.015);
    deco.stick.push([x, y, z, st, hh, st, '#ffffff']);
    deco.pop.push([x, y + hh + r * 0.85, z, r, r, r, pick(['#ffffff', '#ffd1e8', '#c9f0ff', '#fff3b0', '#e6dbff']), rand() * Math.PI]);
  }
}
function buildDecos() {
  const ballGeo = new THREE.SphereGeometry(1, 18, 12);
  const domeGeo = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const spireGeo = new THREE.ConeGeometry(1, 1, 18); spireGeo.translate(0, 0.5, 0);
  const stickGeo = new THREE.CylinderGeometry(1, 1, 1, 8); stickGeo.translate(0, 0.5, 0);
  const popGeo = new THREE.CylinderGeometry(1, 1, 0.22, 28); popGeo.rotateX(Math.PI / 2);
  const spireTex = stripeTex('#ffffff', '#ff4f7b', 4); spireTex.repeat.set(2, 2);
  const shiny = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
  const kinds = [
    [ballGeo, shiny, deco.ball],
    [domeGeo, shiny, deco.dome],
    [spireGeo, new THREE.MeshStandardMaterial({ map: spireTex, roughness: 0.35 }), deco.spire],
    [stickGeo, shiny, deco.stick],
    [popGeo, new THREE.MeshStandardMaterial({ map: swirlTex('#ffffff', '#ff4f8b'), roughness: 0.3 }), deco.pop],
  ];
  const col = new THREE.Color();
  for (const [geo, mat, list] of kinds) {
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([x, y, z, sx, sy, sz, c, ry], k) => {
      dummy.position.set(x, y, z); dummy.rotation.set(0, ry || 0, 0); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
      im.setMatrixAt(k, dummy.matrix);
      im.setColorAt(k, col.set(c || '#ffffff'));
    });
    im.castShadow = im.receiveShadow = true;
    im.frustumCulled = false;
    city.add(im);
  }
  dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
}

// ----- Un immeuble aux coins arrondis -----
function addBuilding(x, z, w, d, h, fi) {
  const ti = Math.floor(rand() * TINTS.length);
  const m = facadeMaterial(fi, w, d, h, ti);
  const mesh = new THREE.Mesh(roundBox(w, h, d, Math.min(w, d) * 0.13), [m, m, roofMat, roofMat, m, m]);
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  city.add(mesh);
  addCollider(x, z, w, d, h);
  let top = h, s = Math.min(w, d);
  if (h > 70 && rand() < 0.5) { // étage en retrait au sommet (arrondi lui aussi)
    const cw = w * 0.65, cd = d * 0.65, ch = h * rr(0.12, 0.22);
    const cm = facadeMaterial(fi, cw, cd, ch, ti);
    const crown = new THREE.Mesh(roundBox(cw, ch, cd, Math.min(cw, cd) * 0.18), [cm, cm, roofMat, roofMat, cm, cm]);
    crown.position.set(x, h + ch / 2, z); crown.castShadow = true;
    city.add(crown);
    top = h + ch; s = Math.min(cw, cd);
  }
  let decorated = false;
  if (h > 14 && rand() < 0.55) { // toit gourmand !
    roofDeco(x, top, z, Math.min(s, 30));
    decorated = true;
  } else if (top === h && h > 20 && rand() < 0.6) { // climatiseurs tout ronds
    const ac = new THREE.Mesh(roundBox(w * rr(0.25, 0.45), 2.4, d * rr(0.25, 0.45), 0.7), candyMat(pick(['#ffffff', '#ffd6e8', '#c8f3e2', '#e2d8ff'])));
    ac.position.set(x + rr(-w / 5, w / 5), h + 1.2, z + rr(-d / 5, d / 5)); ac.castShadow = true;
    city.add(ac);
  }
  if (!decorated && h > 60 && rand() < 0.6) { // antenne avec lumière rouge
    box(0.4, 12, 0.4, roofMat, x, top + 6, z, city, false);
    box(0.9, 0.9, 0.9, antennaMat, x, top + 12.4, z, city, false);
  }
  if (h > 10 && rand() < 0.35) { // enseigne lumineuse
    const mat = neonMat(pick(NEON_COLORS));
    const y = Math.min(h - 3, h * rr(0.5, 0.85));
    const side = Math.floor(rand() * 4);
    if (side < 2) box(Math.min(w * 0.6, 14), 2.4, 0.4, mat, x, y, z + (side ? 1 : -1) * (d / 2 + 0.25), city, false);
    else box(0.4, 2.4, Math.min(d * 0.6, 14), mat, x + (side === 3 ? 1 : -1) * (w / 2 + 0.25), y, z, city, false);
  }
}

export function addTree(x, z, s = rr(0.8, 1.3)) {
  const c = addCollider(x, z, 1.1, 1.1, 8 * s, 't');
  const t = { type: 'tree', x, z, s, rot: 0, color: null, k: trees.length, c };
  c.prop = t;
  trees.push(t);
}

function addRamp(x, z, rot, W = 8, L = 14, H = 3.5) {
  const g = new THREE.BoxGeometry(W, H, L);
  g.translate(0, H / 2, 0);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > H * 0.5 && pos.getZ(i) > 0) pos.setY(i, 0.02);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, rampMat);
  m.position.set(x, 0, z); m.rotation.y = rot;
  m.castShadow = true; m.receiveShadow = true;
  city.add(m);
  ramps.push({ x, z, W, L, H, c: Math.cos(rot), s: Math.sin(rot), R: Math.max(W, L) });
}

const coinGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.25, 24);
coinGeo.rotateX(Math.PI / 2);
const coinMat = new THREE.MeshStandardMaterial({ color: 0xffc83a, metalness: 0.9, roughness: 0.25, emissive: 0x6a4300, emissiveIntensity: 0.7, envMap: getEnvMap() });
envMats.push(coinMat);
export function addCoin(x, y, z) {
  const m = new THREE.Mesh(coinGeo, coinMat);
  m.position.set(x, y, z);
  m.castShadow = true;
  city.add(m);
  coins.push({ mesh: m, x, y, z, taken: false });
}

// ----- Afficher / cacher un arbre ou un lampadaire (objets "instanciés") -----
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
export function setPropVisible(p, show) {
  const M = propMeshes;
  dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
  if (p.type === 'tree') {
    if (show) { dummy.position.set(p.x, 0.2 + terrainHeight(p.x, p.z), p.z); dummy.rotation.set(0, p.rot, 0); dummy.scale.setScalar(p.s); dummy.updateMatrix(); }
    const m = show ? dummy.matrix : ZERO;
    M.trunks.setMatrixAt(p.k, m); M.leaves.setMatrixAt(p.k, m);
    M.trunks.instanceMatrix.needsUpdate = true; M.leaves.instanceMatrix.needsUpdate = true;
  } else {
    if (show) { dummy.position.set(p.x, 0, p.z); dummy.updateMatrix(); }
    const m = show ? dummy.matrix : ZERO;
    M.poles.setMatrixAt(p.k, m); M.heads.setMatrixAt(p.k, m);
    if (show) { dummy.position.set(p.x - p.sx * 2.5, 0.04, p.z - p.sz * 2.5); dummy.updateMatrix(); }
    M.pools.setMatrixAt(p.k, show ? dummy.matrix : ZERO);
    M.poles.instanceMatrix.needsUpdate = true; M.heads.instanceMatrix.needsUpdate = true; M.pools.instanceMatrix.needsUpdate = true;
  }
  dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
}

// ----- Remplissage des pâtés de maisons -----
const HOUSE_COLORS = ['#ffd6e8', '#d6f0ff', '#fff1b8', '#d9ffe4', '#eadcff', '#ffe0cc', '#ffffff'];
const ROOF_COLORS = ['#ff7eb6', '#7fe0c4', '#b79bff', '#ffd84d', '#6fc3ff', '#ff9f6e', '#ff5c8a'];

function fillDowntown(b) {
  if (rand() < 0.25) addBuilding(b.cx, b.cz, rr(34, 46), rr(34, 46), rr(80, 150), pick([0, 1]));
  else for (const qx of [-1, 1]) for (const qz of [-1, 1])
    addBuilding(b.cx + qx * 14, b.cz + qz * 14, rr(17, 24), rr(17, 24), rr(30, 110), pick([0, 1, 1, 2, 4]));
}
function fillMid(b) {
  for (const qx of [-1, 1]) for (const qz of [-1, 1]) {
    const x = b.cx + qx * 14, z = b.cz + qz * 14;
    if (rand() < 0.12) { addTree(x - 4, z - 4); addTree(x + 4, z + 3); addTree(x - 2, z + 6); }
    else addBuilding(x, z, rr(18, 25), rr(18, 25), rr(12, 38), pick([2, 3, 4, 1]));
  }
}
function fillSuburb(b) {
  for (const gx of [-1, 0, 1]) for (const gz of [-1, 0, 1]) {
    const x = b.cx + gx * 18, z = b.cz + gz * 18;
    if (gx === 0 && gz === 0) { addTree(x, z, 1.4); continue; }
    const w = rr(9, 12), d = rr(9, 12), h = rr(4.5, 6.5);
    houses.push({ x, z, w, d, h, roofH: rr(2.5, 4), color: pick(HOUSE_COLORS), roof: pick(ROOF_COLORS), rot: rand() < 0.5 ? 0 : Math.PI / 2, dome: rand() < 0.5 });
    addCollider(x, z, w, d, h + 3);
    if (rand() < 0.5) addTree(x + (rand() < 0.5 ? -1 : 1) * 8, z + rr(-5, 5));
  }
}
function fillPark(b) {
  const pond = new THREE.Mesh(new THREE.CircleGeometry(9, 32), waterMat);
  pond.rotation.x = -Math.PI / 2; pond.position.set(b.cx, 0.27, b.cz);
  pond.onBeforeRender = animWater;
  city.add(pond);
  ponds.push({ x: b.cx, z: b.cz, r: 9 });
  for (let i = 0; i < 24; i++) {
    const x = b.cx + rr(-26, 26), z = b.cz + rr(-26, 26);
    if (Math.hypot(x - b.cx, z - b.cz) < 13) continue;
    addTree(x, z);
  }
}
function fillStunt(b) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK - 6, BLOCK - 6), concreteMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(b.cx, 0.255, b.cz); floor.receiveShadow = true;
  city.add(floor);
  const list = [
    [b.cx - 14, b.cz + 14, 0, 8, 14, 3.5],
    [b.cx + 14, b.cz - 14, Math.PI, 8, 14, 3.5],
    [b.cx + 16, b.cz + 12, Math.PI / 2, 9, 18, 5],
    [b.cx - 16, b.cz - 12, -Math.PI / 2, 7, 10, 2.2],
  ];
  for (const [x, z, rot, W, L, H] of list) {
    addRamp(x, z, rot, W, L, H);
    const fx = -Math.sin(rot), fz = -Math.cos(rot);
    addCoin(x + fx * (L / 2 + 10), H + 3, z + fz * (L / 2 + 10));
  }
}

// ----- Mobilier urbain : bancs, poubelles, bouches d'incendie -----
// Assemble plusieurs boîtes [largeur, hauteur, profondeur, x, y, z] en une seule forme
function mergeBoxes(parts) {
  const pos = [], nor = [];
  for (const [w, h, d, x, y, z] of parts) {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    g.translate(x, y, z);
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}
function addStreetFurniture() {
  const benches = [], bins = [], hydrants = [];
  const E = BLOCK / 2 - 2.6; // près du bord du trottoir
  for (const b of blocks) {
    if (b.type === 'stunt') continue;
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const tx = -nz, tz = nx; // direction le long du trottoir
      const x = b.cx + nx * E, z = b.cz + nz * E;
      if (b.type !== 'suburb' && rand() < 0.75) {
        benches.push([x, z, Math.atan2(nx, nz)]); // le banc regarde la route
        bins.push([x + tx * 2.3, z + tz * 2.3]);
      }
      if (rand() < 0.35) hydrants.push([b.cx + nx * (BLOCK / 2 - 1.4) + tx * 12, b.cz + nz * (BLOCK / 2 - 1.4) + tz * 12]);
    }
  }
  const benchGeo = mergeBoxes([
    [2, 0.1, 0.55, 0, 0.55, 0.05],      // assise
    [2, 0.45, 0.08, 0, 0.95, -0.24],    // dossier
    [0.1, 0.55, 0.5, -0.85, 0.275, 0.05], // pieds
    [0.1, 0.55, 0.5, 0.85, 0.275, 0.05],
    [0.1, 0.5, 0.08, -0.85, 0.85, -0.24],
    [0.1, 0.5, 0.08, 0.85, 0.85, -0.24],
  ]);
  const binGeo = new THREE.CylinderGeometry(0.32, 0.27, 0.95, 12); binGeo.translate(0, 0.475 + 0.24, 0);
  const hydGeo = new THREE.CylinderGeometry(0.16, 0.21, 0.75, 10); hydGeo.translate(0, 0.375 + 0.24, 0);
  const benchMesh = new THREE.InstancedMesh(benchGeo, new THREE.MeshStandardMaterial({ color: 0xff8fb8, roughness: 0.5 }), benches.length);
  const binMesh = new THREE.InstancedMesh(binGeo, new THREE.MeshStandardMaterial({ color: 0x6fdcc0, roughness: 0.45 }), bins.length);
  const hydMesh = new THREE.InstancedMesh(hydGeo, new THREE.MeshStandardMaterial({ color: 0xff4f6b, roughness: 0.45 }), hydrants.length);
  benches.forEach(([x, z, rot], k) => {
    dummy.position.set(x, 0.24, z); dummy.rotation.set(0, rot, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
    benchMesh.setMatrixAt(k, dummy.matrix);
  });
  dummy.rotation.set(0, 0, 0);
  bins.forEach(([x, z], k) => { dummy.position.set(x, 0, z); dummy.updateMatrix(); binMesh.setMatrixAt(k, dummy.matrix); });
  hydrants.forEach(([x, z], k) => { dummy.position.set(x, 0, z); dummy.updateMatrix(); hydMesh.setMatrixAt(k, dummy.matrix); });
  benchMesh.castShadow = binMesh.castShadow = hydMesh.castShadow = true;
  city.add(benchMesh, binMesh, hydMesh);
}

// ----- Construction de toute la ville -----
export function buildCity() {
  // Sol en relief (collines et montagnes autour de la ville) et routes
  scene.add(buildTerrain(groundMat, LIMIT));
  asphaltTex.repeat.set(CITY / 8, CITY / 8);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(CITY, CITY), new THREE.MeshStandardMaterial({ map: asphaltTex, bumpMap: asphaltTex, bumpScale: 1, roughness: 0.92 }));
  road.rotation.x = -Math.PI / 2; road.receiveShadow = true;
  city.add(road);

  // Types de quartiers
  const SPECIAL = { '4,3': 'park', '2,5': 'park', '6,1': 'park', '1,6': 'park', '8,8': 'park', '3,8': 'park', '8,2': 'park', '6,5': 'stunt', '1,2': 'stunt', '8,6': 'stunt' };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const cx = blockCenter(i), cz = blockCenter(j);
    const d = Math.max(Math.abs(cx), Math.abs(cz)) / HALF;
    let type = SPECIAL[i + ',' + j] || (d < 0.4 ? 'downtown' : d < 0.66 ? 'mid' : 'suburb');
    if (type === 'suburb' && rand() < 0.1) type = 'park';
    blocks.push({ i, j, cx, cz, type });
  }

  // Trottoirs (un seul objet pour tous)
  const sw = new THREE.InstancedMesh(new THREE.BoxGeometry(BLOCK, 0.24, BLOCK), sidewalkMat, blocks.length);
  blocks.forEach((b, k) => { dummy.position.set(b.cx, 0.12, b.cz); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); sw.setMatrixAt(k, dummy.matrix); });
  sw.receiveShadow = true;
  city.add(sw);

  const innerGeo = new THREE.PlaneGeometry(BLOCK - 8, BLOCK - 8);
  for (const b of blocks) {
    if (b.type === 'park' || b.type === 'suburb') {
      const g = new THREE.Mesh(innerGeo, grassMat);
      g.rotation.x = -Math.PI / 2; g.position.set(b.cx, 0.25, b.cz); g.receiveShadow = true;
      city.add(g);
    }
    if (b.type === 'downtown') fillDowntown(b);
    else if (b.type === 'mid') fillMid(b);
    else if (b.type === 'suburb') fillSuburb(b);
    else if (b.type === 'park') fillPark(b);
    else if (b.type === 'stunt') fillStunt(b);
  }

  // Toits gourmands (dômes, flèches, cupcakes, sucettes)
  buildDecos();

  // Forêts sur les collines (pas sur les sommets enneigés,
  // ni sur l'aéroport, les routes ou les autres villes)
  let nT = 0, guardT = 0;
  while (nT < 1300 && guardT++ < 9000) {
    const x = rr(-LIMIT + 10, LIMIT - 10), z = rr(-LIMIT + 10, LIMIT - 10);
    if (Math.max(Math.abs(x), Math.abs(z)) < HALF + 14) continue;
    if (inFlatZone(x, z, 12) || wildTown(x, z)) continue; // le désert et la neige ont leurs cactus / sapins
    if (terrainHeight(x, z) > 85) continue;
    addTree(x, z, rr(1, 1.9));
    nT++;
  }

  // Les 3 autres villes 🍭🌵❄️ (world/towns.js)
  try {
    buildTowns({ group: city, addCollider, addTree, addCoin, windowMats, neonMats, half: HALF, limit: LIMIT });
  } catch (e) { console.warn('Autres villes :', e); }

  // Maisons pastel (instanciées = rapide) : murs arrondis + toits bonbons
  const houseMat = new THREE.MeshStandardMaterial({ map: houseTex, bumpMap: houseTex, bumpScale: 1, emissiveMap: houseEm, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.75 });
  windowMats.push(houseMat);
  const col = new THREE.Color();
  const instanced = (geo, mat, list, place) => {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((h, k) => {
      const c = place(h);
      dummy.updateMatrix();
      im.setMatrixAt(k, dummy.matrix);
      im.setColorAt(k, col.set(c));
    });
    im.castShadow = im.receiveShadow = true;
    city.add(im);
    return im;
  };
  instanced(roundBox(1, 1, 1, 0.1), houseMat, houses, (h) => {
    dummy.position.set(h.x, h.h / 2, h.z); dummy.rotation.set(0, h.rot, 0); dummy.scale.set(h.w, h.h, h.d);
    return h.color;
  });
  const roofCandy = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 });
  const domeGeo = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const coneGeo = new THREE.ConeGeometry(1, 1, 20); coneGeo.translate(0, 0.5, 0);
  const domes = houses.filter((h) => h.dome), cones = houses.filter((h) => !h.dome);
  instanced(domeGeo, roofCandy, domes, (h) => {   // toit en dôme (comme une guimauve)
    dummy.position.set(h.x, h.h - 0.15, h.z); dummy.rotation.set(0, h.rot, 0); dummy.scale.set(h.w * 0.68, h.roofH * 1.15, h.d * 0.68);
    return h.roof;
  });
  instanced(coneGeo, roofCandy, cones, (h) => {   // toit pointu tout rond (chapeau de lutin)
    dummy.position.set(h.x, h.h - 0.15, h.z); dummy.rotation.set(0, h.rot, 0); dummy.scale.set(h.w * 0.72, h.roofH * 1.5, h.d * 0.72);
    return h.roof;
  });
  instanced(new THREE.SphereGeometry(1, 12, 8), roofCandy, cones, (h) => {   // petite boule au sommet
    dummy.position.set(h.x, h.h - 0.15 + h.roofH * 1.5, h.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(0.5, 0.5, 0.5);
    return '#ffffff';
  });
  dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);

  // Arbres tout ronds (instanciés, on peut les renverser)
  // 78 % vert vif · 14 % rose barbe à papa · 8 % orange
  const trunks = new THREE.InstancedMesh(propParts.trunkGeo, propParts.trunkMat, trees.length);
  const leaves = new THREE.InstancedMesh(propParts.leafGeo, propParts.leafMat, trees.length);
  propMeshes.trunks = trunks; propMeshes.leaves = leaves;
  trees.forEach((t, k) => {
    t.rot = rand() * 6;
    const r = rand();
    t.color = new THREE.Color();
    if (r < 0.78) t.color.setHSL(0.27 + rr(-0.04, 0.05), 0.62, 0.43 + rr(-0.06, 0.06), THREE.SRGBColorSpace);
    else if (r < 0.92) t.color.setHSL(0.94 + rr(-0.02, 0.03), 0.75, 0.77, THREE.SRGBColorSpace);
    else t.color.setHSL(0.075 + rr(-0.01, 0.02), 0.9, 0.62, THREE.SRGBColorSpace);
    setPropVisible(t, true);
    leaves.setColorAt(k, t.color);
  });
  trunks.castShadow = leaves.castShadow = true;
  city.add(trunks, leaves);

  // Lampadaires en sucre d'orge (on peut les renverser) + halos de lumière la nuit
  for (let i = 0; i <= N; i++) for (let k = 0; k <= N; k++) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = rc(i) + sx * (ROAD / 2 + 1.3), z = rc(k) + sz * (ROAD / 2 + 1.3);
    if (Math.abs(x) > HALF || Math.abs(z) > HALF) continue;
    const c = addCollider(x, z, 0.5, 0.5, 7, 'l');
    const l = { type: 'lamp', x, z, sx, sz, k: lamps.length, c };
    c.prop = l;
    lamps.push(l);
  }
  const poles = new THREE.InstancedMesh(propParts.poleGeo, propParts.poleMat, lamps.length);
  const heads = new THREE.InstancedMesh(propParts.headGeo, lampHeadMat, lamps.length);
  const poolMesh = new THREE.InstancedMesh(propParts.poolGeo, poolMat, lamps.length);
  propMeshes.poles = poles; propMeshes.heads = heads; propMeshes.pools = poolMesh;
  lamps.forEach((l) => setPropVisible(l, true));
  poles.castShadow = true;
  city.add(poles, heads, poolMesh);
  pools = poolMesh;

  // Marquages au sol : pointillés jaunes + passages piétons
  const flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);
  const dashes = [], zebra = [];
  for (let r = 0; r <= N; r++) for (let k = 0; k < N; k++) {
    const a = rc(k) + ROAD / 2 + 5, bEnd = rc(k + 1) - ROAD / 2 - 5;
    for (let t = a + 1.5; t < bEnd - 1.5; t += 6) {
      dashes.push([t, rc(r), true]);
      dashes.push([rc(r), t, false]);
    }
  }
  for (let i = 0; i <= N; i++) for (let k = 0; k <= N; k++) {
    const cx = rc(i), cz = rc(k), off = ROAD / 2 + 2.2;
    for (let s = -6; s <= 6; s += 2.4) {
      if (k > 0) zebra.push([cx + s, cz - off, false]);
      if (k < N) zebra.push([cx + s, cz + off, false]);
      if (i > 0) zebra.push([cx - off, cz + s, true]);
      if (i < N) zebra.push([cx + off, cz + s, true]);
    }
  }
  const dashMesh = new THREE.InstancedMesh(flat, new THREE.MeshStandardMaterial({ color: 0xf2d14b, roughness: 0.6 }), dashes.length);
  dashes.forEach(([x, z, alongX], k) => {
    dummy.position.set(x, 0.02, z); dummy.rotation.set(0, alongX ? Math.PI / 2 : 0, 0); dummy.scale.set(0.35, 1, 3); dummy.updateMatrix();
    dashMesh.setMatrixAt(k, dummy.matrix);
  });
  const zebraMesh = new THREE.InstancedMesh(flat, new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.6 }), zebra.length);
  zebra.forEach(([x, z, alongX], k) => {
    dummy.position.set(x, 0.02, z); dummy.rotation.set(0, alongX ? Math.PI / 2 : 0, 0); dummy.scale.set(1.2, 1, 3.6); dummy.updateMatrix();
    zebraMesh.setMatrixAt(k, dummy.matrix);
  });
  dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
  dashMesh.receiveShadow = zebraMesh.receiveShadow = true;
  city.add(dashMesh, zebraMesh);

  // Pièces sur les routes
  let placed = 0, guard = 0;
  while (placed < 46 && guard++ < 700) {
    const alongX = rand() < 0.5, r = Math.floor(rand() * (N + 1)), k = Math.floor(rand() * N);
    const t = rr(rc(k) + ROAD / 2 + 6, rc(k + 1) - ROAD / 2 - 6);
    const lane = (rand() < 0.5 ? -1 : 1) * LANE;
    const x = alongX ? t : rc(r) + lane, z = alongX ? rc(r) + lane : t;
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 30) continue;
    addCoin(x, 1.6, z);
    placed++;
  }

  // Bancs, poubelles et bouches d'incendie sur les trottoirs
  addStreetFurniture();
}

// ----- Hauteur du sol -----
// relief + tremplins (pour les voitures)
export function groundHeight(x, z) {
  let h = terrainHeight(x, z);
  for (const r of ramps) {
    const dx = x - r.x, dz = z - r.z;
    if (Math.abs(dx) > r.R || Math.abs(dz) > r.R) continue;
    const lx = dx * r.c - dz * r.s, lz = dx * r.s + dz * r.c;
    if (Math.abs(lx) < r.W / 2 && Math.abs(lz) < r.L / 2) h = Math.max(h, r.H * (r.L / 2 - lz) / r.L);
  }
  return h;
}
// est-ce qu'on est sur un trottoir / dans un pâté de maisons ?
export function onBlock(x, z) {
  const u = x + HALF - ROAD, v = z + HALF - ROAD;
  if (u < 0 || v < 0) return false;
  const i = Math.floor(u / CELL), j = Math.floor(v / CELL);
  return i < N && j < N && u - i * CELL < BLOCK && v - j * CELL < BLOCK;
}
// hauteur du sol pour le héros à pied (trottoirs + tremplins + relief)
export function floorY(x, z) {
  return Math.max(onBlock(x, z) ? 0.24 : 0, groundHeight(x, z));
}
