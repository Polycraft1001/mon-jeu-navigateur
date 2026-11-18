// =====================================================
//  PERSONNAGES 3D ANIMÉS — style « dessin animé » 🍬
//  Modèle « Soldier » (libre, exemples officiels de three.js)
//  avec ses animations : Idle (immobile), Walk (marche), Run (course).
//  - rendu « cartoon » : ombres en aplats (MeshToonMaterial)
//  - style CHIBI : grosse tête, grosses mains, un peu plus dodu
//  - le héros : on garde ses armes « en boîtes », collées dans sa main
//  - les policiers : uniforme bleu, casquette et pistolet
//  Si le modèle ne se charge pas, on garde des persos simples
//  (tête ronde, corps en gélule).
// =====================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { WEAPONS } from '../core/config.js';
import { save } from '../core/save.js';
import { clamp, lerp, damp, isMobile } from '../core/utils.js';
import { toonGradient } from '../core/shapes.js';

const BASES = [
  'https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/',
  'https://threejs.org/examples/',
];
const MODEL = 'models/gltf/Soldier.glb';
const HEIGHT = 1.8;   // taille d'un perso (en mètres)
const FACE = 0;       // si les persos marchent à reculons, mets Math.PI
const SHADOWS = !isMobile;
// style chibi : taille de certains os (1 = normal)
const CHIBI = { Head: 1.45, LeftHand: 1.2, RightHand: 1.2 };
const WIDE = 1.12;    // persos un peu plus larges (plus « mignons »)

let src = null;       // le modèle chargé (on le copie pour chaque perso)
const clips = { idle: null, walk: null, run: null };
let modelScale = 1, modelLift = 0;
export const charactersReady = () => !!src;

function loadGLTF(path) {
  const loader = new GLTFLoader();
  return new Promise((resolve) => {
    let i = 0;
    const next = () => {
      if (i >= BASES.length) { console.warn('Modèle introuvable :', path); resolve(null); return; }
      loader.load(BASES[i++] + path, resolve, undefined, next);
    };
    next();
  });
}

// Charge le modèle une seule fois. Renvoie true si c'est bon.
export async function loadCharacters() {
  const g = await loadGLTF(MODEL);
  if (!g) return false;
  const find = (k) => g.animations.find((a) => a.name.toLowerCase().includes(k)) || null;
  clips.idle = find('idle'); clips.walk = find('walk'); clips.run = find('run');
  src = g.scene;
  // mise à l'échelle : 1,80 m et les pieds posés au sol
  src.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(src);
  const h = box.max.y - box.min.y;
  if (h > 0.3 && h < 1000) { modelScale = HEIGHT / h; modelLift = -box.min.y * modelScale; }
  if (!(Math.abs(modelLift) < 1)) modelLift = 0;
  return true;
}

// ----- Petits objets : casquette de police et pistolet -----
const SM = {
  skin: new THREE.MeshToonMaterial({ color: 0xffc9a0, gradientMap: toonGradient }),
  dark: new THREE.MeshToonMaterial({ color: 0x24366a, gradientMap: toonGradient }),
  metal: new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 0.4, metalness: 0.7 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xffd23a, emissive: 0x553300, roughness: 0.3, metalness: 0.8 }),
  eye: new THREE.MeshBasicMaterial({ color: 0x1a1a24 }),
};
const G_CAP = new THREE.CylinderGeometry(0.115, 0.125, 0.1, 14);
const G_BRIM = new THREE.CylinderGeometry(0.17, 0.17, 0.02, 16);
const G_BADGE = new THREE.BoxGeometry(0.05, 0.05, 0.05);
const G_GUN1 = new THREE.BoxGeometry(0.06, 0.26, 0.09);
const G_GUN2 = new THREE.BoxGeometry(0.05, 0.07, 0.14);
function makeCap() {
  const g = new THREE.Group();
  const top = new THREE.Mesh(G_CAP, SM.dark); top.position.y = 0.05;
  const brim = new THREE.Mesh(G_BRIM, SM.dark);
  const badge = new THREE.Mesh(G_BADGE, SM.gold); badge.position.set(0, 0.06, 0.12);
  g.add(top, brim, badge);
  return g;
}
// le canon pointe vers -y (comme les armes du héros)
function makePistol() {
  const g = new THREE.Group();
  const a = new THREE.Mesh(G_GUN1, SM.metal); a.position.set(0, -0.09, -0.03);
  const b = new THREE.Mesh(G_GUN2, SM.metal); b.position.set(0, 0.02, 0.06);
  g.add(a, b);
  return g;
}

// ----- Viser : on tend le bras dans une direction (en coordonnées du monde) -----
const _qp = new THREE.Quaternion(), _qw = new THREE.Quaternion();
const _s = new THREE.Vector3(), _side = new THREE.Vector3(), _dl = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), ID = new THREE.Quaternion();
function pointBone(bone, dir, w) {
  if (!bone || !bone.parent) return;
  bone.parent.getWorldQuaternion(_qp).invert();
  _qw.setFromUnitVectors(UP, dir).premultiply(_qp); // les os du modèle sont dans le sens +y
  bone.quaternion.slerp(_qw, w);
}
const straighten = (bone, w) => { if (bone) bone.quaternion.slerp(ID, w); };

// colle un objet sur un os (en annulant l'échelle du modèle)
function attach(bone, obj, along, flip) {
  bone.getWorldScale(_s);
  const k = 1 / (_s.x || 1);
  obj.scale.multiplyScalar(k);
  obj.position.set(0, along * k, 0);
  if (flip) obj.rotation.set(Math.PI, 0, 0); // le canon part dans le sens des doigts
  bone.add(obj);
}

// ----- Matériaux « dessin animé » -----
// (les persos sans couleur partagent les mêmes matériaux)
const toonShared = new Map();
function toToon(m, tint) {
  const c = new THREE.MeshToonMaterial({
    map: m.map || null,
    color: tint != null ? new THREE.Color(tint) : new THREE.Color(1.15, 1.15, 1.15),
    gradientMap: toonGradient,
    transparent: !!m.transparent,
    opacity: m.opacity != null ? m.opacity : 1,
    alphaTest: m.alphaTest || 0,
    side: m.side != null ? m.side : THREE.FrontSide,
  });
  c.name = m.name || '';
  return c;
}

// ----- Un perso animé (copie du modèle) -----
function makeRigged(root, opt) {
  const model = cloneSkinned(src);
  model.scale.multiplyScalar(modelScale);
  model.scale.x *= WIDE; model.scale.z *= WIDE;   // un peu plus dodu
  model.position.y += modelLift;
  model.rotation.y += FACE;
  root.add(model);
  const bones = {}, mats = [];
  const toon = (m) => {
    if (opt.tint != null) { const c = toToon(m, opt.tint); mats.push(c); return c; }
    if (!toonShared.has(m)) toonShared.set(m, toToon(m, null));
    return toonShared.get(m);
  };
  model.traverse((o) => {
    if (o.isBone) bones[o.name.replace(/^mixamorig[:_]?/, '')] = o;
    if (o.isMesh) {
      o.castShadow = SHADOWS; o.frustumCulled = false;
      o.material = Array.isArray(o.material) ? o.material.map(toon) : toon(o.material);
    }
  });
  root.updateMatrixWorld(true);
  if (opt.cap && bones.Head) attach(bones.Head, makeCap(), 0.17, false);
  if (opt.gun && bones.RightHand) attach(bones.RightHand, makePistol(), 0.07, true);
  // style chibi (après avoir collé la casquette : elle grossit avec la tête)
  const chibi = () => { for (const k in CHIBI) if (bones[k]) bones[k].scale.setScalar(CHIBI[k]); };
  chibi();

  const mixer = new THREE.AnimationMixer(model);
  const acts = {};
  for (const k in clips) if (clips[k]) acts[k] = mixer.clipAction(clips[k]);
  let cur = null;
  function play(name, ts) {
    const a = acts[name] || acts.idle;
    if (!a) return;
    if (a !== cur) {
      a.reset().setEffectiveWeight(1).fadeIn(0.25).play();
      if (cur) cur.fadeOut(0.25);
      cur = a;
    }
    a.timeScale = ts;
  }
  let aimW = 0, two = false;
  const aimDir = new THREE.Vector3(0, 0, -1);
  function aimArms() {
    pointBone(bones.RightArm, aimDir, aimW);
    straighten(bones.RightForeArm, aimW); straighten(bones.RightHand, aimW);
    if (two) { // l'autre main vient tenir l'arme
      _side.set(-aimDir.z, 0, aimDir.x).normalize();
      _dl.copy(aimDir).addScaledVector(_side, 0.55).normalize();
      pointBone(bones.LeftArm, _dl, aimW);
      straighten(bones.LeftForeArm, aimW); straighten(bones.LeftHand, aimW);
    }
  }
  return {
    root, bones,
    // speed en m/s (négatif = à reculons) · aim = direction de visée ou null
    update(dt, speed, aim, twoHands) {
      const sp = Math.abs(speed);
      if (sp < 0.35) play('idle', 1);
      else if (sp < 3.4 || !acts.run) play('walk', (speed < 0 ? -1 : 1) * clamp(sp / 1.7, 0.6, 2.4));
      else play('run', clamp(sp / 5.2, 0.8, 1.7));
      mixer.update(dt);
      chibi(); // l'animation peut remettre la taille des os à 1
      aimW = lerp(aimW, aim ? 1 : 0, damp(14, dt));
      if (aim) aimDir.copy(aim);
      two = !!twoHands;
      if (aimW > 0.02) aimArms();
    },
    dispose() {
      mixer.stopAllAction(); mixer.uncacheRoot(model);
      for (const m of mats) m.dispose();
    },
  };
}

// ----- Perso de secours (si le modèle n'est pas chargé) -----
// tête toute ronde, corps en gélule, bras et jambes arrondis
const G_LEG = new THREE.CapsuleGeometry(0.11, 0.62, 4, 10); G_LEG.translate(0, -0.42, 0);
const G_TORSO = new THREE.CapsuleGeometry(0.25, 0.22, 6, 14);
const G_HEAD = new THREE.SphereGeometry(0.27, 18, 14);
const G_ARM = new THREE.CapsuleGeometry(0.075, 0.48, 4, 10); G_ARM.translate(0, -0.31, 0);
const G_EYE = new THREE.SphereGeometry(0.04, 8, 6);
function makeSimple(root, opt) {
  const cloth = new THREE.MeshToonMaterial({ color: opt.tint != null ? opt.tint : 0x3a5a8c, gradientMap: toonGradient });
  const body = new THREE.Group(); root.add(body);
  const mk = (geo, m, parent, y = 0) => { const o = new THREE.Mesh(geo, m); o.position.y = y; o.castShadow = SHADOWS; parent.add(o); return o; };
  const pivot = (x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); body.add(p); return p; };
  const legL = pivot(-0.13, 0.88), legR = pivot(0.13, 0.88), armL = pivot(-0.33, 1.48), armR = pivot(0.33, 1.48);
  mk(G_LEG, SM.dark, legL); mk(G_LEG, SM.dark, legR);
  mk(G_TORSO, cloth, body, 1.2); mk(G_HEAD, SM.skin, body, 1.74);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(G_EYE, SM.eye); e.position.set(s * 0.09, 1.78, -0.25); body.add(e); }
  mk(G_ARM, cloth, armL); mk(G_ARM, cloth, armR);
  if (opt.cap) { const cap = makeCap(); cap.position.y = 1.98; cap.scale.setScalar(1.7); body.add(cap); }
  if (opt.gun) { const g = makePistol(); g.position.y = -0.66; armR.add(g); }
  let phase = 0, aimW = 0;
  return {
    root, bones: null,
    update(dt, speed, aim) {
      const sp = Math.abs(speed);
      phase += dt * sp * 2.3;
      const sw = Math.sin(phase) * Math.min(1, sp / 4) * 0.75;
      legL.rotation.x = sw; legR.rotation.x = -sw;
      aimW = lerp(aimW, aim ? 1 : 0, damp(14, dt));
      armR.rotation.x = lerp(-sw * 0.8, 1.5, aimW);
      armL.rotation.x = sw * 0.8;
    },
    dispose() { cloth.dispose(); },
  };
}

// opt = { tint: couleur des habits, cap: casquette, gun: pistolet }
export function makeCharacter(opt = {}) {
  const root = new THREE.Group();
  return src ? makeRigged(root, opt) : makeSimple(root, opt);
}

// =====================================================
//  LE HÉROS : on cache ses boîtes et on met le perso 3D à la place.
//  Ses armes (le groupe « main ») sont collées dans la vraie main.
// =====================================================
let heroC = null;
export function attachHero(heroRoot) {
  if (!src || heroC || !heroRoot) return false;
  const body = heroRoot.children[0];
  if (!body) return false;
  // la main = le groupe dont tous les enfants sont des armes (des groupes)
  let hand = null;
  body.traverse((o) => {
    if (!hand && o !== body && o.isGroup && o.children.length >= 4 && o.children.every((c) => c.isGroup)) hand = o;
  });
  const keep = new Set();
  if (hand) hand.traverse((o) => keep.add(o));
  body.traverse((o) => { if (o.isMesh && !keep.has(o)) o.visible = false; });
  heroC = makeCharacter({});
  body.add(heroC.root);
  heroRoot.updateMatrixWorld(true);
  const bone = heroC.bones && heroC.bones.RightHand;
  if (hand && bone) {
    hand.scale.set(1, 1, 1);
    attach(bone, hand, 0.08, true);
  }
  return true;
}

const _dir = new THREE.Vector3();
export function updateHeroModel(dt, h) {
  if (!heroC || !h.mesh.visible) return;
  const w = WEAPONS[save.weapon] || WEAPONS[0];
  const down = h.state !== 'ok';
  const armed = !w.melee;
  const aiming = !down && ((armed && h.aimT > 0) || h.punchT > 0);
  if (aiming) _dir.set(-Math.sin(h.h), 0, -Math.cos(h.h));
  heroC.update(dt, down ? 0 : h.speed, aiming ? _dir : null, armed && w.id !== 'pistol');
}
