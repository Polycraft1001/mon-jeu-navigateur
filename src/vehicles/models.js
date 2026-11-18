// =====================================================
//  MODÈLES 3D DES VOITURES
//  ➜ Nouvelle forme de voiture : ajoute-la dans CAR_SHAPES
//    (formes en boîtes) ou dans LUXURY (vehicles/luxury.js,
//    vraies silhouettes), puis utilise son nom (style) dans core/config.js
// =====================================================
import * as THREE from 'three';
import { envMats, getEnvMap } from '../render/engine.js';
import { box } from '../core/utils.js';
import { LUXURY, buildLuxury } from './luxury.js';

export const CAR_SHAPES = {
  gt: { L: 4.4, W: 2.0, H: 0.55, cabL: 2.0, cabH: 0.52, cabW: 1.6, cabZ: 0.25, spoiler: 0.4 },
  drift: { L: 4.5, W: 2.0, H: 0.55, cabL: 1.9, cabH: 0.55, cabW: 1.55, cabZ: 0.3, spoiler: 1 },
  muscle: { L: 4.9, W: 2.15, H: 0.7, cabL: 2.0, cabH: 0.55, cabW: 1.65, cabZ: 0.45, spoiler: 0, scoop: true },
  mini: { L: 3.6, W: 1.85, H: 0.7, cabL: 2.1, cabH: 0.75, cabW: 1.65, cabZ: 0.15, spoiler: 0, roofLights: true },
  // forme de secours tant que le vrai modèle 3D n'est pas chargé
  ferrari: { L: 4.5, W: 1.95, H: 0.5, cabL: 1.8, cabH: 0.48, cabW: 1.5, cabZ: 0.35, spoiler: 0 },
};

const UP = new THREE.Vector3(0, 1, 0);
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 20); wheelGeo.rotateZ(Math.PI / 2);
const rimGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.36, 10); rimGeo.rotateZ(Math.PI / 2);
const tireMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xcfd4da, metalness: 0.9, roughness: 0.3, envMap: getEnvMap() });
envMats.push(rimMat);
const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
// carcasse brûlée (épave)
export const burntMat = new THREE.MeshStandardMaterial({ color: 0x1d1b1a, roughness: 1, metalness: 0.2 });

// Une voiture = { root, chassis, wheels, fronts, paint, glass, headMat, tailMat, spot, S, spin, envList }
// root bouge et tourne, chassis penche, wheels tournent, fronts braquent
// size = taille des roues (1 = normale, 1.3 = grosses roues de 4x4)
export function addWheels(root, W, L, wheels, fronts, detailed, size = 1) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * (W / 2 - 0.12), 0.42 * size, sz * (L / 2 - 0.85 * size));
    const spin = new THREE.Group();
    spin.scale.setScalar(size);
    const t = new THREE.Mesh(wheelGeo, tireMat);
    t.castShadow = detailed;
    spin.add(t);
    if (detailed) spin.add(new THREE.Mesh(rimGeo, rimMat));
    pivot.add(spin); root.add(pivot);
    wheels.push(spin);
    if (sz < 0) fronts.push(pivot);
  }
}
export function addSpot(root, y, L) {
  const spot = new THREE.SpotLight(0xfff2d0, 0, 70, 0.55, 0.5, 1.3);
  spot.position.set(0, y, -L / 2);
  spot.target.position.set(0, 0, -L / 2 - 20);
  root.add(spot, spot.target);
  return spot;
}

export function buildCar(style, color) {
  if (LUXURY[style]) return buildLuxury(style, color); // voitures de luxe
  const S = CAR_SHAPES[style] || CAR_SHAPES.gt;
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const chassis = new THREE.Group(); chassis.rotation.order = 'YXZ';
  root.add(chassis);
  const env = getEnvMap();
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.5, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, envMap: env });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0b1622, metalness: 0.3, roughness: 0.05, clearcoat: 1, envMap: env });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d6, emissiveIntensity: 1 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 0.6 });
  const b = 0.38;
  box(S.W, S.H, S.L, paint, 0, b + S.H / 2, 0, chassis);
  box(S.W * 0.98, 0.2, 0.3, darkMat, 0, b + 0.1, -S.L / 2 - 0.05, chassis);
  box(S.W * 0.98, 0.2, 0.3, darkMat, 0, b + 0.1, S.L / 2 + 0.05, chassis);
  const cabY = b + S.H + S.cabH / 2;
  box(S.cabW, S.cabH, S.cabL, glass, 0, cabY, S.cabZ, chassis);
  box(S.cabW * 0.98, 0.07, S.cabL * 0.7, paint, 0, cabY + S.cabH / 2 + 0.03, S.cabZ + 0.1, chassis);
  for (const sx of [-1, 1]) {
    box(0.5, 0.16, 0.06, headMat, sx * (S.W / 2 - 0.38), b + S.H * 0.62, -S.L / 2 - 0.02, chassis, false);
    box(0.5, 0.14, 0.06, tailMat, sx * (S.W / 2 - 0.38), b + S.H * 0.62, S.L / 2 + 0.02, chassis, false);
  }
  if (S.spoiler) {
    const sw = S.W * 0.95, sh = 0.35 + S.spoiler * 0.25;
    box(sw, 0.08, 0.45, paint, 0, b + S.H + sh, S.L / 2 - 0.25, chassis);
    for (const sx of [-1, 1]) box(0.08, sh, 0.12, darkMat, sx * sw * 0.35, b + S.H + sh / 2, S.L / 2 - 0.25, chassis);
  }
  if (S.scoop) box(0.7, 0.18, 0.9, darkMat, 0, b + S.H + 0.09, -S.L / 2 + 1.1, chassis);
  if (S.roofLights) for (const sx of [-0.45, -0.15, 0.15, 0.45]) box(0.22, 0.16, 0.12, headMat, sx, cabY + S.cabH / 2 + 0.15, S.cabZ - 0.5, chassis, false);
  const wheels = [], fronts = [];
  addWheels(root, S.W, S.L, wheels, fronts, true);
  const spot = addSpot(root, 1.0, S.L);
  return { root, chassis, wheels, fronts, paint, glass, headMat, tailMat, spot, S, spin: -1, envList: [paint, glass], top: b + S.H + S.cabH };
}

// ----- Voitures de la circulation (même structure, plus simples) -----
const TRAFFIC_COLORS = ['#c0392b', '#2c3e50', '#ecf0f1', '#7f8c8d', '#2980b9', '#16a085', '#8e44ad', '#d35400', '#111111'];
const trafficMats = TRAFFIC_COLORS.map((c) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.3, envMap: getEnvMap() }); envMats.push(m); return m; });
const taxiMat = new THREE.MeshStandardMaterial({ color: '#f5c518', roughness: 0.4, metalness: 0.3, envMap: getEnvMap() }); envMats.push(taxiMat);
const tGlass = new THREE.MeshStandardMaterial({ color: 0x101820, roughness: 0.1, metalness: 0.5, envMap: getEnvMap() }); envMats.push(tGlass);
export const tHead = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0c0, emissiveIntensity: 0.8 });
export const tTail = new THREE.MeshStandardMaterial({ color: 0x440000, emissive: 0xff2020, emissiveIntensity: 0.6 });

export function buildTrafficCar() {
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const chassis = new THREE.Group(); chassis.rotation.order = 'YXZ';
  root.add(chassis);
  const r = Math.random();
  const van = r < 0.18, taxi = !van && r < 0.32;
  const paint = taxi ? taxiMat : trafficMats[Math.floor(Math.random() * trafficMats.length)];
  const L = van ? 5 : 4.3, W = van ? 2.1 : 1.9;
  if (van) {
    box(W, 1.9, L, paint, 0, 1.3, 0, chassis);
    box(W * 0.96, 0.6, 0.1, tGlass, 0, 1.75, -L / 2 - 0.01, chassis, false);
  } else {
    box(W, 0.7, L, paint, 0, 0.7, 0, chassis);
    box(W * 0.85, 0.6, 2.2, tGlass, 0, 1.35, 0.2, chassis);
    if (taxi) box(0.8, 0.25, 0.35, tHead, 0, 1.78, 0.2, chassis, false);
  }
  for (const sx of [-1, 1]) {
    box(0.4, 0.15, 0.05, tHead, sx * (W / 2 - 0.3), 0.85, -L / 2 - 0.02, chassis, false);
    box(0.4, 0.15, 0.05, tTail, sx * (W / 2 - 0.3), 0.85, L / 2 + 0.02, chassis, false);
  }
  const wheels = [], fronts = [];
  addWheels(root, W, L, wheels, fronts, false);
  return { root, chassis, wheels, fronts, paint, glass: tGlass, headMat: tHead, tailMat: tTail, spot: null, S: { L, W, H: van ? 1.9 : 0.7 }, spin: -1, envList: [], traffic: true, top: van ? 2.25 : 1.6 };
}

// Une voiture volée devient "à nous" : ses matériaux deviennent uniques
// (sinon changer sa couleur changerait toutes les voitures) + phares
export function makePlayable(car) {
  if (!car.traffic) return car;
  const paint = car.paint.clone(), head = tHead.clone(), tail = tTail.clone();
  const swap = new Map([[car.paint, paint], [tHead, head], [tTail, tail]]);
  car.root.traverse((o) => { if (o.isMesh && swap.has(o.material)) o.material = swap.get(o.material); });
  car.paint = paint; car.headMat = head; car.tailMat = tail;
  car.envList = [paint];
  car.spot = addSpot(car.root, 1.0, car.S.L);
  car.traffic = false;
  return car;
}

// Transforme une voiture en carcasse brûlée
export function charMesh(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (Array.isArray(o.material)) o.material = o.material.map(() => burntMat);
    else if (!o.material.isMeshBasicMaterial) o.material = burntMat;
  });
}

// =====================================================
//  FERRARI : vrai modèle 3D (.glb) chargé en ligne
// =====================================================
let ferrariModel = null, ferrariAO = null;
export function setFerrari(model, ao) { ferrariModel = model; ferrariAO = ao || null; }
export const hasFerrari = () => !!ferrariModel;

function worldPos(model, name) {
  const o = model.getObjectByName(name);
  return o ? o.getWorldPosition(new THREE.Vector3()) : null;
}
// Le fichier .glb peut être tourné dans n'importe quel sens.
// On regarde OÙ SONT SES ROUES pour trouver le haut et l'avant,
// puis on tourne le modèle pour que : haut = +y et avant = -z (comme nos voitures).
function orientFerrari(model, orient) {
  model.updateMatrixWorld(true);
  const FL = worldPos(model, 'wheel_fl'), FR = worldPos(model, 'wheel_fr');
  const RL = worldPos(model, 'wheel_rl'), RR = worldPos(model, 'wheel_rr');
  if (!FL || !FR || !RL || !RR) { orient.rotation.y = Math.PI; return; }
  const F = FL.clone().add(FR).multiplyScalar(0.5);
  const R = RL.clone().add(RR).multiplyScalar(0.5);
  const fwd = F.clone().sub(R);                                   // de l'arrière vers l'avant
  const up = fwd.clone().cross(FR.clone().sub(FL)).normalize();  // perpendiculaire aux 4 roues
  if (up.lengthSq() < 0.5) up.set(0, 1, 0);
  const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
  const wheelsMid = F.clone().add(R).multiplyScalar(0.5);
  if (up.dot(center.sub(wheelsMid)) < 0) up.negate();            // la carrosserie est AU-DESSUS des roues
  const q1 = new THREE.Quaternion().setFromUnitVectors(up, UP);
  fwd.applyQuaternion(q1); fwd.y = 0;
  if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1);
  fwd.normalize();
  const q2 = new THREE.Quaternion().setFromUnitVectors(fwd, new THREE.Vector3(0, 0, -1));
  orient.quaternion.copy(q2).multiply(q1);
}

export function buildFerrari(color) {
  const S = CAR_SHAPES.ferrari;
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const chassis = new THREE.Group(); chassis.rotation.order = 'YXZ';
  root.add(chassis);
  const env = getEnvMap();
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.6, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.04, envMap: env });
  const detail = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 1, roughness: 0.3, envMap: env });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x1b2836, metalness: 0.2, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.6, envMap: env });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d6, emissiveIntensity: 1 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 0.6 });

  const model = ferrariModel.clone(true);
  const setMat = (name, mat) => { const o = model.getObjectByName(name); if (o) o.material = mat; };
  setMat('body', paint);
  for (const n of ['rim_fl', 'rim_fr', 'rim_rr', 'rim_rl', 'trim']) setMat(n, detail);
  setMat('glass', glass);
  model.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // on NE touche PAS à la rotation du modèle : on le met dans un groupe qu'on tourne
  const orient = new THREE.Group();
  orient.add(model);
  orientFerrari(model, orient);

  // roues : celles de devant vont dans un "pivot" pour pouvoir braquer
  const wheels = [], fronts = [];
  for (const n of ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']) {
    const w = model.getObjectByName(n);
    if (!w) continue;
    wheels.push(w);
    if ((n === 'wheel_fl' || n === 'wheel_fr') && w.parent) {
      const pivot = new THREE.Group();
      pivot.position.copy(w.position);
      w.parent.add(pivot);
      pivot.add(w);
      w.position.set(0, 0, 0);
      fronts.push(pivot);
    }
  }
  orient.updateMatrixWorld(true);
  // axe "vertical" vu depuis chaque pivot (pour braquer autour du bon axe)
  const q = new THREE.Quaternion();
  for (const f of fronts) { f.parent.getWorldQuaternion(q); f.userData.up = UP.clone().applyQuaternion(q.invert()); }
  // sens de rotation des roues : dépend de l'orientation de leur axe
  let spin = 1;
  if (wheels[0] && wheels[0].parent) {
    const ax = new THREE.Vector3(1, 0, 0).transformDirection(wheels[0].parent.matrixWorld);
    spin = ax.x > 0 ? -1 : 1;
  }

  // mise à la bonne taille et posée sur le sol
  const holder = new THREE.Group();
  holder.add(orient);
  holder.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(holder);
  const size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
  const k = S.L / Math.max(size.x, size.z, 0.01);
  if (ferrariAO) { // ombre douce sous la voiture (fournie avec le modèle)
    const sh = new THREE.Mesh(
      new THREE.PlaneGeometry(size.x * 1.3, size.z * 1.15),
      new THREE.MeshBasicMaterial({ map: ferrariAO, blending: THREE.MultiplyBlending, toneMapped: false, transparent: true, depthWrite: false, fog: false })
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(c.x, bb.min.y + 0.01 / k, c.z);
    sh.renderOrder = 2;
    holder.add(sh);
  }
  holder.scale.setScalar(k);
  holder.position.set(-c.x * k, 0.02 - bb.min.y * k, -c.z * k);
  chassis.add(holder);

  // petits phares et feux arrière (freinage et nuit)
  for (const sx of [-1, 1]) {
    box(0.34, 0.07, 0.12, headMat, sx * 0.66, 0.66, -S.L / 2 + 0.32, chassis, false);
    box(0.3, 0.08, 0.08, tailMat, sx * 0.62, 0.78, S.L / 2 - 0.12, chassis, false);
  }
  const spot = addSpot(root, 0.9, S.L);
  return { root, chassis, wheels, fronts, paint, glass, headMat, tailMat, spot, S, spin, envList: [paint, glass, detail], top: 1.25 };
}
