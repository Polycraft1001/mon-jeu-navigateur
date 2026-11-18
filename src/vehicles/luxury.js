// =====================================================
//  VOITURES DE LUXE (+ voiture de police)
//  Chaque voiture est dessinée par son PROFIL vu de côté :
//  une liste de points [avant(+)/arrière(-), hauteur] qu'on
//  "extrude" sur la largeur. Ça donne de vraies silhouettes.
//  ➜ Nouvelle voiture de luxe : ajoute un profil ici,
//    puis une ligne dans CARS (core/config.js) avec style = son nom
// =====================================================
import * as THREE from 'three';
import { envMats, getEnvMap } from '../render/engine.js';
import { box } from '../core/utils.js';
import { addWheels, addSpot } from './models.js';

export const LUXURY = {
  lambo: { L: 4.6, W: 2.05, r: 1.05, wing: 0.22, vents: true,
    body: [[-2.3, 0.32], [2.25, 0.3], [2.32, 0.5], [1.0, 0.8], [-1.4, 0.92], [-2.3, 0.98]],
    cab: [[1.05, 0.78], [-0.15, 1.2], [-1.0, 1.18], [-1.75, 0.9]], cabW: 1.5 },
  hyper: { L: 4.6, W: 2.08, r: 1.08, wing: 0.32, grille: [0.55, 0.32], twoTone: '#15171c',
    body: [[-2.3, 0.3], [2.3, 0.3], [2.32, 0.56], [1.2, 0.8], [-1.6, 0.92], [-2.3, 0.86]],
    cab: [[1.0, 0.78], [0.0, 1.18], [-0.9, 1.16], [-1.8, 0.88]], cabW: 1.45 },
  porsche: { L: 4.4, W: 1.95, r: 1.0, wing: 0.1,
    body: [[-2.2, 0.33], [2.2, 0.33], [2.22, 0.6], [1.0, 0.8], [-1.4, 0.84], [-2.2, 0.72]],
    cab: [[0.95, 0.78], [0.05, 1.28], [-0.6, 1.28], [-2.05, 0.78]], cabW: 1.45 },
  rolls: { L: 5.6, W: 2.1, r: 1.15, grille: [0.75, 0.55], chrome: true,
    body: [[-2.8, 0.38], [2.8, 0.38], [2.8, 1.05], [1.2, 1.12], [-2.5, 1.1], [-2.8, 0.95]],
    cab: [[1.0, 1.1], [0.35, 1.64], [-1.6, 1.64], [-2.3, 1.08]], cabW: 1.75 },
  suv: { L: 4.9, W: 2.15, r: 1.3, grille: [0.95, 0.4], chrome: true, rack: true,
    body: [[-2.45, 0.5], [2.45, 0.5], [2.45, 1.22], [-2.45, 1.24]],
    cab: [[1.05, 1.2], [0.9, 2.02], [-2.35, 2.04], [-2.35, 1.2]], cabW: 1.95 },
  police: { L: 4.8, W: 2.0, r: 1.0, sirens: true,
    body: [[-2.4, 0.36], [2.4, 0.36], [2.4, 0.8], [1.3, 0.9], [-1.9, 0.92], [-2.4, 0.85]],
    cab: [[1.1, 0.88], [0.4, 1.45], [-1.1, 1.45], [-1.8, 0.9]], cabW: 1.65 },
};

// Formes 3D gardées en mémoire (une seule fois par modèle)
const geoCache = {};
function profile(pts, width, bevel) {
  const shape = new THREE.Shape(pts.map(([f, y]) => new THREE.Vector2(f, y)));
  const depth = width - bevel * 2;
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 1 });
  g.rotateY(Math.PI / 2);          // avant de la voiture = -z
  g.translate(-depth / 2, 0, 0);   // centrée
  return g;
}
function geos(style) {
  if (!geoCache[style]) {
    const D = LUXURY[style];
    geoCache[style] = { body: profile(D.body, D.W - 0.12, 0.07), cab: profile(D.cab, D.cabW, 0.05) };
  }
  return geoCache[style];
}
function mesh(geo, mat, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

const darkMat = new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.6 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe8ecf0, metalness: 1, roughness: 0.15, envMap: getEnvMap() });
envMats.push(chromeMat);

export function buildLuxury(style, color) {
  const D = LUXURY[style];
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const chassis = new THREE.Group(); chassis.rotation.order = 'YXZ';
  root.add(chassis);
  const env = getEnvMap();
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.6, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.05, envMap: env });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0d1620, metalness: 0.3, roughness: 0.04, clearcoat: 1, envMap: env });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeaf4ff, emissiveIntensity: 1 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 0.6 });
  const G = geos(style);
  mesh(G.body, paint, chassis);
  mesh(G.cab, glass, chassis);

  const front = Math.max(...D.body.map((p) => p[0])), rear = Math.min(...D.body.map((p) => p[0]));
  const frontTop = D.body.filter((p) => p[0] >= front - 0.1).reduce((m, p) => Math.max(m, p[1]), 0);
  const rearTop = D.body.filter((p) => p[0] <= rear + 0.1).reduce((m, p) => Math.max(m, p[1]), 0);
  const roofY = Math.max(...D.cab.map((p) => p[1]));
  // toit peint (entre les vitres)
  const roofPts = D.cab.filter((p) => p[1] > roofY - 0.06);
  if (roofPts.length >= 2) {
    const a = roofPts[0][0], b = roofPts[roofPts.length - 1][0];
    box(D.cabW * 0.92, 0.06, Math.abs(a - b) * 0.85, D.twoTone ? darkMat : paint, 0, roofY + 0.02, -(a + b) / 2, chassis);
  }
  // phares (fins, style LED) et bandeau de feux arrière
  for (const sx of [-1, 1]) box(0.45, 0.07, 0.08, headMat, sx * (D.W / 2 - 0.4), frontTop - 0.1, -front - 0.02, chassis, false);
  box(D.W * 0.85, 0.07, 0.06, tailMat, 0, rearTop - 0.12, -rear + 0.03, chassis, false);
  // calandre chromée
  if (D.grille) box(D.grille[0], D.grille[1], 0.06, D.chrome ? chromeMat : darkMat, 0, frontTop - D.grille[1] / 2 - 0.12, -front - 0.04, chassis, false);
  // bas de caisse foncé (deux tons)
  if (D.twoTone) {
    const tm = new THREE.MeshStandardMaterial({ color: D.twoTone, metalness: 0.5, roughness: 0.35, envMap: env });
    box(D.W + 0.01, 0.2, D.L * 0.55, tm, 0, 0.55, 0.15, chassis);
  }
  // aileron
  if (D.wing) {
    const y = rearTop + D.wing;
    box(D.W * 0.9, 0.06, 0.42, D.twoTone ? darkMat : paint, 0, y, -rear - 0.3, chassis);
    for (const sx of [-1, 1]) box(0.06, D.wing, 0.1, darkMat, sx * D.W * 0.3, rearTop + D.wing / 2, -rear - 0.3, chassis, false);
  }
  // prises d'air latérales (supercar)
  if (D.vents) for (const sx of [-1, 1]) box(0.04, 0.22, 0.7, darkMat, sx * (D.W / 2 - 0.02), 0.62, 0.6, chassis, false);
  // barres de toit (4x4)
  if (D.rack) for (const sx of [-1, 1]) box(0.06, 0.08, D.L * 0.55, chromeMat, sx * D.cabW * 0.4, roofY + 0.1, 0.6, chassis, false);
  // voiture de police : bas noir + gyrophares
  let sirens = null;
  if (D.sirens) {
    box(D.W + 0.01, 0.3, D.L * 0.42, darkMat, 0, 0.62, 0.1, chassis);
    box(1.3, 0.1, 0.3, darkMat, 0, roofY + 0.07, -0.35, chassis, false);
    const red = new THREE.MeshStandardMaterial({ color: 0x440000, emissive: 0xff1020, emissiveIntensity: 2 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x000844, emissive: 0x1050ff, emissiveIntensity: 2 });
    box(0.55, 0.14, 0.26, red, -0.32, roofY + 0.19, -0.35, chassis, false);
    box(0.55, 0.14, 0.26, blue, 0.32, roofY + 0.19, -0.35, chassis, false);
    sirens = [red, blue];
  }

  const wheels = [], fronts = [];
  addWheels(root, D.W, D.L, wheels, fronts, true, D.r);
  const spot = addSpot(root, 0.9, D.L);
  return {
    root, chassis, wheels, fronts, paint, glass, headMat, tailMat, spot, sirens,
    S: { L: D.L, W: D.W, H: frontTop }, spin: -1, envList: [paint, glass], top: roofY + (sirens ? 0.3 : 0.05),
    isPolice: !!sirens,
  };
}

export const buildPoliceCar = () => buildLuxury('police', '#f4f4f4');
