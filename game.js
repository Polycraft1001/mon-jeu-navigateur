import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// =====================================================
//  OUTILS
// =====================================================
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (k, dt) => 1 - Math.exp(-k * dt);
function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function makeRng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = makeRng(2026); // la ville est toujours la même
const rr = (a, b) => a + rand() * (b - a);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const isMobile = window.matchMedia('(pointer: coarse)').matches || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const dummy = new THREE.Object3D();

// =====================================================
//  DONNÉES DU JEU
// =====================================================
const CARS = [
  { name: 'GT Sprint', desc: 'Équilibrée, parfaite pour commencer', style: 'gt', maxSpeed: 52, accel: 20, turn: 2.2, drift: 1.0, stats: [4, 3, 4, 3] },
  { name: 'Drift King', desc: 'La reine de la glisse', style: 'drift', maxSpeed: 49, accel: 19, turn: 2.35, drift: 1.3, stats: [3, 3, 4, 5] },
  { name: 'Muscle V8', desc: 'Très rapide mais lourde', style: 'muscle', maxSpeed: 60, accel: 17, turn: 1.9, drift: 0.9, stats: [5, 3, 2, 3] },
  { name: 'Rally Mini', desc: 'Petite, agile et nerveuse', style: 'mini', maxSpeed: 46, accel: 24, turn: 2.7, drift: 1.1, stats: [2, 5, 5, 3] },
];
const STAT_NAMES = ['Vitesse', 'Accélération', 'Maniabilité', 'Drift'];
const COLORS = ['#e63946', '#f77f00', '#ffd60a', '#2ec4b6', '#3a86ff', '#8338ec', '#ff4fa3', '#f4f4f4', '#222222', '#7cb518'];
const TIMES = [{ id: 'day', name: '☀️ Jour' }, { id: 'sunset', name: '🌇 Soir' }, { id: 'night', name: '🌙 Nuit' }];
const TRAFFIC = [{ id: 0, name: 'Aucune' }, { id: 1, name: 'Normale' }, { id: 2, name: 'Beaucoup' }];
const TRAFFIC_COUNT = [0, 26, 50];
const ASSISTS = [{ id: 'strong', name: 'Forte' }, { id: 'normal', name: 'Normale' }, { id: 'pro', name: 'Pro (x1,5)' }];
const ASSIST = {
  strong: { rate: 1.25, slip: 0.42, th: [0.7, 1.6, 2.7], pts: 1 },
  normal: { rate: 1.0, slip: 0.5, th: [1.0, 2.2, 3.5], pts: 1 },
  pro: { rate: 0.9, slip: 0.6, th: [1.2, 2.6, 4.2], pts: 1.5 },
};
const LEVEL_COLORS = ['#ffffff', '#4fc3ff', '#ff9d2e', '#c46bff'];
const LEVEL_NAMES = ['DRIFT', 'DRIFT BLEU', 'DRIFT ORANGE', 'SUPER DRIFT'];
const TURBO_TIME = [0, 0.9, 1.5, 2.3];

const TIME_SET = {
  day: { skyTop: '#2f7fe0', skyBot: '#d7ecff', fog: '#cddff0', fogNear: 200, fogFar: 1400, hemi: 1.0, hemiSky: '#dcecff', hemiGround: '#5b6a4c', sun: 2.6, sunColor: '#fff3e0', sunPos: [90, 160, 60], win: 0, neon: 0.5, lamp: 0.2, pool: 0, head: 0.8, spot: 0, env: 1, exposure: 1.0, bloom: [0.2, 0.4, 0.92], stars: false, clouds: true, cloud: '#ffffff', mountain: '#7f93a3' },
  sunset: { skyTop: '#2a3a78', skyBot: '#ff9457', fog: '#e7a07a', fogNear: 150, fogFar: 1200, hemi: 0.65, hemiSky: '#ffcfb0', hemiGround: '#4a3a44', sun: 2.2, sunColor: '#ffa860', sunPos: [160, 45, -70], win: 0.7, neon: 1.5, lamp: 2, pool: 0.08, head: 1.5, spot: 20, env: 0.6, exposure: 1.05, bloom: [0.45, 0.5, 0.8], stars: false, clouds: true, cloud: '#ffc7a8', mountain: '#5d4c66' },
  night: { skyTop: '#020512', skyBot: '#18214a', fog: '#0b1028', fogNear: 90, fogFar: 750, hemi: 0.5, hemiSky: '#7088d0', hemiGround: '#1a1a2a', sun: 0.4, sunColor: '#a8bcff', sunPos: [-70, 130, 40], win: 1.4, neon: 2.5, lamp: 3, pool: 0.2, head: 3, spot: 60, env: 0.2, exposure: 1.15, bloom: [0.8, 0.5, 0.7], stars: true, clouds: false, cloud: '#ffffff', mountain: '#121828' },
};
let currentTime = TIME_SET.day;

// ----- Sauvegarde -----
const SAVE_KEY = 'turboCity3d';
const save = { car: 0, color: 0, time: 'day', traffic: 1, assist: 'normal', bestDrift: 0, missions: 0, money: 0 };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { /* rien */ }
if (!CARS[save.car]) save.car = 0;
if (!COLORS[save.color]) save.color = 0;
if (!TIME_SET[save.time]) save.time = 'day';
if (!ASSIST[save.assist]) save.assist = 'normal';
if (TRAFFIC_COUNT[save.traffic] === undefined) save.traffic = 1;
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* rien */ } };

// =====================================================
//  RENDU / SCÈNE
// =====================================================
const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcddff0, 200, 1400);
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.3, 3000);

let composer = null, bloom = null;
if (!isMobile) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.3, 0.4, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
});

const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const envMats = [];

// ----- Lumières -----
const hemi = new THREE.HemisphereLight(0xdcecff, 0x5b6a4c, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 450 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);
const sunOffset = new THREE.Vector3(90, 160, 60);

// ----- Ciel -----
const skyUniforms = { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } };
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(1500, 32, 16),
  new THREE.ShaderMaterial({
    uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y * 1.6 + 0.1, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0); #include <colorspace_fragment> }'.replace('#include <colorspace_fragment>', '\n#include <colorspace_fragment>\n'),
  })
);
sky.renderOrder = -1;
scene.add(sky);

const starGeo = new THREE.BufferGeometry();
{
  const sp = [];
  for (let i = 0; i < 1500; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.random() * 1.4, r = 1400;
    sp.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
}
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false }));
scene.add(stars);

const clouds = new THREE.Group();
const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, fog: false });
{
  const cg = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 25; i++) {
    const c = new THREE.Group();
    for (let j = 0; j < 5; j++) {
      const m = new THREE.Mesh(cg, cloudMat);
      m.scale.set(rr(25, 45), rr(12, 20), rr(20, 35));
      m.position.set(j * 28 - 56 + rr(-10, 10), rr(-5, 5), rr(-15, 15));
      c.add(m);
    }
    c.position.set(rr(-1200, 1200), rr(280, 380), rr(-1200, 1200));
    clouds.add(c);
  }
}
scene.add(clouds);

const mountainMat = new THREE.MeshLambertMaterial({ color: 0x7f93a3, flatShading: true });
for (let i = 0; i < 40; i++) {
  const a = (i / 40) * Math.PI * 2 + rr(-0.05, 0.05), d = rr(850, 1100), h = rr(150, 380);
  const m = new THREE.Mesh(new THREE.ConeGeometry(rr(150, 280), h, 6), mountainMat);
  m.position.set(Math.cos(a) * d, h / 2 - 10, Math.sin(a) * d);
  scene.add(m);
}

// =====================================================
//  TEXTURES
// =====================================================
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function noise(ctx, w, h, base, amp) {
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const n = (Math.random() - 0.5) * amp;
    img.data[i * 4] = clamp(base[0] + n, 0, 255);
    img.data[i * 4 + 1] = clamp(base[1] + n, 0, 255);
    img.data[i * 4 + 2] = clamp(base[2] + n, 0, 255);
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
const asphaltTex = canvasTex(128, 128, (c, w, h) => noise(c, w, h, [62, 64, 68], 22));
const sidewalkTex = canvasTex(128, 128, (c, w, h) => {
  noise(c, w, h, [178, 176, 170], 18);
  c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 2;
  for (let i = 0; i <= 128; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 128); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(128, i); c.stroke(); }
});
const grassTex = canvasTex(128, 128, (c, w, h) => noise(c, w, h, [78, 122, 58], 30));
const concreteTex = canvasTex(128, 128, (c, w, h) => noise(c, w, h, [150, 150, 152], 25));
const rampTex = canvasTex(64, 64, (c) => {
  c.fillStyle = '#f2c230'; c.fillRect(0, 0, 64, 64);
  c.fillStyle = '#222';
  for (let i = -64; i < 128; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 16, 0); c.lineTo(i + 80, 64); c.lineTo(i + 64, 64); c.fill(); }
});
const smokeTex = canvasTex(64, 64, (c) => {
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
});

// Façades d'immeubles (8 x 8 fenêtres par texture)
const FACADES = [
  { wall: '#2b3a4a', glass: ['#5d86b0', '#6f9cc8', '#4a729a'], inset: 2, glassy: true },
  { wall: '#9aa4ad', glass: ['#3d5a73', '#4f6f8a'], inset: 4, glassy: true },
  { wall: '#c9bfae', glass: ['#3b4654', '#56606d'], inset: 7, glassy: false },
  { wall: '#8c4a3a', glass: ['#2f3a44', '#45505a'], inset: 7, glassy: false },
  { wall: '#e6e2da', glass: ['#4a5866', '#5b6977'], inset: 7, glassy: false },
];
const facadeTex = FACADES.map((f) => {
  const lit = [];
  const map = canvasTex(256, 256, (c) => {
    c.fillStyle = f.wall; c.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      c.fillStyle = f.glass[Math.floor(Math.random() * f.glass.length)];
      c.fillRect(x * 32 + f.inset, y * 32 + f.inset + 2, 32 - f.inset * 2, 32 - f.inset * 2 - 2);
      lit.push(Math.random() < 0.38);
    }
  });
  const em = canvasTex(256, 256, (c) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      if (!lit[y * 8 + x]) continue;
      c.fillStyle = Math.random() < 0.7 ? '#ffd27a' : '#cfe6ff';
      c.fillRect(x * 32 + f.inset, y * 32 + f.inset + 2, 32 - f.inset * 2, 32 - f.inset * 2 - 2);
    }
  });
  return { map, em };
});
const houseTex = canvasTex(128, 64, (c) => {
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, 128, 64);
  c.fillStyle = '#3a4450';
  c.fillRect(14, 18, 26, 22); c.fillRect(88, 18, 26, 22);
  c.fillStyle = '#6b4a32'; c.fillRect(54, 28, 20, 36);
});
const houseEm = canvasTex(128, 64, (c) => {
  c.fillStyle = '#000'; c.fillRect(0, 0, 128, 64);
  c.fillStyle = '#ffcf80';
  c.fillRect(14, 18, 26, 22); c.fillRect(88, 18, 26, 22);
});

// =====================================================
//  LA VILLE
// =====================================================
const N = 8;                 // nombre de pâtés de maisons par côté
const BLOCK = 64, ROAD = 16, CELL = BLOCK + ROAD;
const CITY = N * CELL + ROAD, HALF = CITY / 2, LANE = 3.8;
const LIMIT = HALF + 190;    // bord du monde
const rc = (i) => -HALF + ROAD / 2 + i * CELL;   // centre de la route n° i
const blockCenter = (j) => rc(j) + CELL / 2;

const city = new THREE.Group();
scene.add(city);
const colliders = [];   // boîtes contre lesquelles on se cogne
const blocks = [];
const trees = [];
const houses = [];
const ramps = [];
const ponds = [];
const coins = [];
const windowMats = [];
const neonMats = [];
const matCache = {};

function addCollider(x, z, w, d, h, kind = 'b') {
  colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h, kind });
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const roofMat = new THREE.MeshStandardMaterial({ color: 0x5b6068, roughness: 0.9 });
const antennaMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2020, emissiveIntensity: 1 });
const sidewalkMat = new THREE.MeshStandardMaterial({ map: sidewalkTex, roughness: 0.95 });
sidewalkTex.repeat.set(16, 16);
const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 });
grassTex.repeat.set(10, 10);
const concreteMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.9 });
concreteTex.repeat.set(8, 8);
const waterMat = new THREE.MeshStandardMaterial({ color: 0x2f6fc0, roughness: 0.08, metalness: 0.3, envMap });
envMats.push(waterMat);
const rampMat = new THREE.MeshStandardMaterial({ map: rampTex, roughness: 0.7 });

function facadeMaterial(fi, w, d, h) {
  const f = FACADES[fi];
  const across = Math.max(1, Math.round(Math.max(w, d) / (f.glassy ? 3 : 4)));
  const floors = Math.max(1, Math.round(h / 3.5));
  const key = fi + '_' + across + '_' + floors;
  if (matCache[key]) return matCache[key];
  const map = facadeTex[fi].map.clone(); map.repeat.set(across / 8, floors / 8); map.needsUpdate = true;
  const em = facadeTex[fi].em.clone(); em.repeat.set(across / 8, floors / 8); em.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({
    map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0,
    roughness: f.glassy ? 0.25 : 0.85, metalness: f.glassy ? 0.3 : 0.02,
    envMap: f.glassy ? envMap : null,
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

function box(w, h, d, mat, x, y, z, parent = city, shadow = true) {
  const m = new THREE.Mesh(unitBox, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  parent.add(m);
  return m;
}

function addBuilding(x, z, w, d, h, fi) {
  const m = facadeMaterial(fi, w, d, h);
  const mesh = new THREE.Mesh(unitBox, [m, m, roofMat, roofMat, m, m]);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  city.add(mesh);
  addCollider(x, z, w, d, h);
  let top = h;
  if (h > 70 && rand() < 0.5) { // étage en retrait au sommet
    const cw = w * 0.65, cd = d * 0.65, ch = h * rr(0.12, 0.22);
    const cm = facadeMaterial(fi, cw, cd, ch);
    const crown = new THREE.Mesh(unitBox, [cm, cm, roofMat, roofMat, cm, cm]);
    crown.scale.set(cw, ch, cd); crown.position.set(x, h + ch / 2, z); crown.castShadow = true;
    city.add(crown);
    top = h + ch;
  } else if (h > 20 && rand() < 0.6) { // climatiseurs
    box(w * rr(0.25, 0.45), 2.4, d * rr(0.25, 0.45), roofMat, x + rr(-w / 5, w / 5), h + 1.2, z + rr(-d / 5, d / 5));
  }
  if (h > 60 && rand() < 0.6) { // antenne avec lumière rouge
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

function addTree(x, z, s = rr(0.8, 1.3)) {
  trees.push({ x, z, s });
  addCollider(x, z, 1.1, 1.1, 8 * s, 't');
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
const coinMat = new THREE.MeshStandardMaterial({ color: 0xffc83a, metalness: 0.9, roughness: 0.25, emissive: 0x6a4300, emissiveIntensity: 0.7, envMap });
envMats.push(coinMat);
function addCoin(x, y, z) {
  const m = new THREE.Mesh(coinGeo, coinMat);
  m.position.set(x, y, z);
  m.castShadow = true;
  city.add(m);
  coins.push({ mesh: m, x, y, z, taken: false });
}

// ----- Remplissage des pâtés de maisons -----
const HOUSE_COLORS = ['#f2e2c4', '#cfe3f0', '#f4c7b5', '#d9ead3', '#fff2a8', '#e8d5f2', '#ffffff'];
const ROOF_COLORS = ['#8b3a2e', '#4a4f57', '#6b4a32', '#3d5a73'];

function fillDowntown(b) {
  if (rand() < 0.25) addBuilding(b.cx, b.cz, rr(34, 46), rr(34, 46), rr(80, 140), pick([0, 1]));
  else for (const qx of [-1, 1]) for (const qz of [-1, 1])
    addBuilding(b.cx + qx * 14, b.cz + qz * 14, rr(17, 24), rr(17, 24), rr(30, 100), pick([0, 1, 1, 2, 4]));
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
    houses.push({ x, z, w, d, h, roofH: rr(2.5, 4), color: pick(HOUSE_COLORS), roof: pick(ROOF_COLORS), rot: rand() < 0.5 ? 0 : Math.PI / 2 });
    addCollider(x, z, w, d, h + 3);
    if (rand() < 0.5) addTree(x + (rand() < 0.5 ? -1 : 1) * 8, z + rr(-5, 5));
  }
}
function fillPark(b) {
  const pond = new THREE.Mesh(new THREE.CircleGeometry(9, 32), waterMat);
  pond.rotation.x = -Math.PI / 2; pond.position.set(b.cx, 0.27, b.cz);
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

function buildCity() {
  // Sol (herbe) et routes
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: 0x4f7d3a, roughness: 1 }));
  grass.rotation.x = -Math.PI / 2; grass.position.y = -0.05; grass.receiveShadow = true;
  scene.add(grass);
  asphaltTex.repeat.set(CITY / 8, CITY / 8);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(CITY, CITY), new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.92 }));
  road.rotation.x = -Math.PI / 2; road.receiveShadow = true;
  city.add(road);

  // Types de quartiers
  const SPECIAL = { '4,3': 'park', '2,5': 'park', '6,1': 'park', '1,6': 'park', '6,5': 'stunt', '1,2': 'stunt' };
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

  // Arbres autour de la ville
  for (let i = 0; i < 260; i++) {
    const x = rr(-LIMIT + 10, LIMIT - 10), z = rr(-LIMIT + 10, LIMIT - 10);
    if (Math.max(Math.abs(x), Math.abs(z)) < HALF + 14) continue;
    addTree(x, z, rr(1, 1.8));
  }

  // Maisons (instanciées = rapide)
  const houseMat = new THREE.MeshStandardMaterial({ map: houseTex, emissiveMap: houseEm, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.9 });
  windowMats.push(houseMat);
  const roofGeo = new THREE.ConeGeometry(1, 1, 4); roofGeo.rotateY(Math.PI / 4);
  const walls = new THREE.InstancedMesh(unitBox, houseMat, houses.length);
  const roofs = new THREE.InstancedMesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true }), houses.length);
  const col = new THREE.Color();
  houses.forEach((h, k) => {
    dummy.position.set(h.x, h.h / 2, h.z); dummy.rotation.set(0, h.rot, 0); dummy.scale.set(h.w, h.h, h.d); dummy.updateMatrix();
    walls.setMatrixAt(k, dummy.matrix); walls.setColorAt(k, col.set(h.color));
    dummy.position.set(h.x, h.h + h.roofH / 2, h.z); dummy.scale.set(h.w / 1.414 * 1.12, h.roofH, h.d / 1.414 * 1.12); dummy.updateMatrix();
    roofs.setMatrixAt(k, dummy.matrix); roofs.setColorAt(k, col.set(h.roof));
  });
  walls.castShadow = walls.receiveShadow = roofs.castShadow = true;
  city.add(walls, roofs);

  // Arbres (instanciés)
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6); trunkGeo.translate(0, 1.2, 0);
  const leafGeo = new THREE.IcosahedronGeometry(2.2, 0); leafGeo.translate(0, 3.9, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 }), trees.length);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), trees.length);
  trees.forEach((t, k) => {
    dummy.position.set(t.x, 0.2, t.z); dummy.rotation.set(0, rand() * 6, 0); dummy.scale.setScalar(t.s); dummy.updateMatrix();
    trunks.setMatrixAt(k, dummy.matrix); leaves.setMatrixAt(k, dummy.matrix);
    leaves.setColorAt(k, col.setHSL(0.27 + rr(-0.04, 0.05), 0.5, 0.28 + rr(-0.06, 0.06)));
  });
  trunks.castShadow = leaves.castShadow = true;
  city.add(trunks, leaves);

  // Lampadaires + halos de lumière la nuit
  const lampPos = [];
  for (let i = 0; i <= N; i++) for (let k = 0; k <= N; k++) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = rc(i) + sx * (ROAD / 2 + 1.3), z = rc(k) + sz * (ROAD / 2 + 1.3);
    if (Math.abs(x) > HALF || Math.abs(z) > HALF) continue;
    lampPos.push({ x, z, sx, sz });
  }
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7, 6); poleGeo.translate(0, 3.5, 0);
  const headGeo = new THREE.SphereGeometry(0.45, 10, 8); headGeo.translate(0, 7.1, 0);
  const poolGeo = new THREE.CircleGeometry(6, 20); poolGeo.rotateX(-Math.PI / 2);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0x33373d, metalness: 0.6, roughness: 0.5 }), lampPos.length);
  const heads = new THREE.InstancedMesh(headGeo, lampHeadMat, lampPos.length);
  const poolMesh = new THREE.InstancedMesh(poolGeo, poolMat, lampPos.length);
  lampPos.forEach((l, k) => {
    dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    dummy.position.set(l.x, 0, l.z); dummy.updateMatrix();
    poles.setMatrixAt(k, dummy.matrix); heads.setMatrixAt(k, dummy.matrix);
    dummy.position.set(l.x - l.sx * 2.5, 0.04, l.z - l.sz * 2.5); dummy.updateMatrix();
    poolMesh.setMatrixAt(k, dummy.matrix);
  });
  poles.castShadow = true;
  city.add(poles, heads, poolMesh);
  pools = poolMesh;

  // Marquages au sol : pointillés jaunes + passages piétons
  const flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);
  const dashes = [], zebra = [];
  for (let r = 0; r <= N; r++) for (let k = 0; k < N; k++) {
    const a = rc(k) + ROAD / 2 + 5, bEnd = rc(k + 1) - ROAD / 2 - 5;
    for (let t = a + 1.5; t < bEnd - 1.5; t += 6) {
      dashes.push([t, rc(r), true]);   // route horizontale (le long de x)
      dashes.push([rc(r), t, false]);  // route verticale (le long de z)
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
  dashMesh.receiveShadow = zebraMesh.receiveShadow = true;
  city.add(dashMesh, zebraMesh);

  // Pièces sur les routes
  let placed = 0, guard = 0;
  while (placed < 34 && guard++ < 500) {
    const alongX = rand() < 0.5, r = Math.floor(rand() * (N + 1)), k = Math.floor(rand() * N);
    const t = rr(rc(k) + ROAD / 2 + 6, rc(k + 1) - ROAD / 2 - 6);
    const lane = (rand() < 0.5 ? -1 : 1) * LANE;
    const x = alongX ? t : rc(r) + lane, z = alongX ? rc(r) + lane : t;
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 30) continue;
    addCoin(x, 1.6, z);
    placed++;
  }
}

const lampHeadMat = new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffd28a, emissiveIntensity: 0.2 });
const poolMat = new THREE.MeshBasicMaterial({ color: 0xffb85a, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
let pools = null;

function groundHeight(x, z) {
  let h = 0;
  for (const r of ramps) {
    const dx = x - r.x, dz = z - r.z;
    if (Math.abs(dx) > r.R || Math.abs(dz) > r.R) continue;
    const lx = dx * r.c - dz * r.s, lz = dx * r.s + dz * r.c;
    if (Math.abs(lx) < r.W / 2 && Math.abs(lz) < r.L / 2) h = Math.max(h, r.H * (r.L / 2 - lz) / r.L);
  }
  return h;
}

// =====================================================
//  VOITURES
// =====================================================
const CAR_SHAPES = {
  gt: { L: 4.4, W: 2.0, H: 0.55, cabL: 2.0, cabH: 0.52, cabW: 1.6, cabZ: 0.25, spoiler: 0.4 },
  drift: { L: 4.5, W: 2.0, H: 0.55, cabL: 1.9, cabH: 0.55, cabW: 1.55, cabZ: 0.3, spoiler: 1 },
  muscle: { L: 4.9, W: 2.15, H: 0.7, cabL: 2.0, cabH: 0.55, cabW: 1.65, cabZ: 0.45, spoiler: 0, scoop: true },
  mini: { L: 3.6, W: 1.85, H: 0.7, cabL: 2.1, cabH: 0.75, cabW: 1.65, cabZ: 0.15, spoiler: 0, roofLights: true },
};
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 20); wheelGeo.rotateZ(Math.PI / 2);
const rimGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.36, 10); rimGeo.rotateZ(Math.PI / 2);
const tireMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xcfd4da, metalness: 0.9, roughness: 0.3, envMap });
envMats.push(rimMat);
const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });

function buildCar(style, color) {
  const S = CAR_SHAPES[style];
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const chassis = new THREE.Group(); chassis.rotation.order = 'YXZ';
  root.add(chassis);
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.5, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, envMap });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0b1622, metalness: 0.3, roughness: 0.05, clearcoat: 1, envMap });
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
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * (S.W / 2 - 0.12), 0.42, sz * (S.L / 2 - 0.85));
    const spin = new THREE.Group();
    const t = new THREE.Mesh(wheelGeo, tireMat); t.castShadow = true;
    spin.add(t, new THREE.Mesh(rimGeo, rimMat));
    pivot.add(spin); root.add(pivot);
    wheels.push(spin);
    if (sz < 0) fronts.push(pivot);
  }
  const spot = new THREE.SpotLight(0xfff2d0, 0, 70, 0.55, 0.5, 1.3);
  spot.position.set(0, 1.0, -S.L / 2);
  spot.target.position.set(0, 0, -S.L / 2 - 20);
  root.add(spot, spot.target);
  return { root, chassis, wheels, fronts, paint, glass, headMat, tailMat, spot, S };
}

// ----- Voitures de la circulation -----
const TRAFFIC_COLORS = ['#c0392b', '#2c3e50', '#ecf0f1', '#7f8c8d', '#2980b9', '#16a085', '#8e44ad', '#d35400', '#111111'];
const trafficMats = TRAFFIC_COLORS.map((c) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.3, envMap }); envMats.push(m); return m; });
const taxiMat = new THREE.MeshStandardMaterial({ color: '#f5c518', roughness: 0.4, metalness: 0.3, envMap }); envMats.push(taxiMat);
const tGlass = new THREE.MeshStandardMaterial({ color: 0x101820, roughness: 0.1, metalness: 0.5, envMap }); envMats.push(tGlass);
const tHead = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0c0, emissiveIntensity: 0.8 });
const tTail = new THREE.MeshStandardMaterial({ color: 0x440000, emissive: 0xff2020, emissiveIntensity: 0.6 });

function buildTrafficCar() {
  const g = new THREE.Group();
  const r = Math.random();
  const van = r < 0.18, taxi = !van && r < 0.32;
  const mat = taxi ? taxiMat : trafficMats[Math.floor(Math.random() * trafficMats.length)];
  const L = van ? 5 : 4.3, W = van ? 2.1 : 1.9;
  if (van) {
    box(W, 1.9, L, mat, 0, 0.35 + 0.95, 0, g);
    box(W * 0.96, 0.6, 0.1, tGlass, 0, 1.75, -L / 2 - 0.01, g, false);
  } else {
    box(W, 0.7, L, mat, 0, 0.35 + 0.35, 0, g);
    box(W * 0.85, 0.6, 2.2, tGlass, 0, 1.35, 0.2, g);
    if (taxi) box(0.8, 0.25, 0.35, tHead, 0, 1.78, 0.2, g, false);
  }
  for (const sx of [-1, 1]) {
    box(0.4, 0.15, 0.05, tHead, sx * (W / 2 - 0.3), 0.85, -L / 2 - 0.02, g, false);
    box(0.4, 0.15, 0.05, tTail, sx * (W / 2 - 0.3), 0.85, L / 2 + 0.02, g, false);
    for (const sz of [-1, 1]) {
      const w = new THREE.Mesh(wheelGeo, tireMat);
      w.position.set(sx * (W / 2 - 0.1), 0.42, sz * (L / 2 - 0.8));
      g.add(w);
    }
  }
  return g;
}

const DIRS = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
const rightOf = (d) => ({ x: -d.z, z: d.x });
const validDir = (i, k, d) => i + d.x >= 0 && i + d.x <= N && k + d.z >= 0 && k + d.z <= N;
const traffic = [];

function planTurn(o) {
  const opts = DIRS.filter((d) => !(d.x === -o.dir.x && d.z === -o.dir.z) && validDir(o.ni, o.nk, d));
  const straight = opts.find((d) => d.x === o.dir.x && d.z === o.dir.z);
  const nd = (straight && Math.random() < 0.55) ? straight : opts[Math.floor(Math.random() * opts.length)];
  o.newDir = nd;
  const cx = rc(o.ni), cz = rc(o.nk), ro = rightOf(o.dir), rn = rightOf(nd);
  if (nd === straight) o.target = { x: cx + ro.x * LANE, z: cz + ro.z * LANE };
  else o.target = { x: cx + (ro.x + rn.x) * LANE, z: cz + (ro.z + rn.z) * LANE };
}

function makeTraffic() {
  for (let tries = 0; tries < 20; tries++) {
    const i = Math.floor(Math.random() * (N + 1)), k = Math.floor(Math.random() * (N + 1));
    const opts = DIRS.filter((d) => validDir(i, k, d));
    const dir = opts[Math.floor(Math.random() * opts.length)];
    const r = rightOf(dir), t = 10 + Math.random() * (CELL - 20);
    const x = rc(i) + r.x * LANE + dir.x * t, z = rc(k) + r.z * LANE + dir.z * t;
    if (Math.hypot(x - player.pos.x, z - player.pos.z) < 25) continue;
    if (traffic.some((o) => Math.hypot(o.x - x, o.z - z) < 10)) continue;
    const o = { mesh: buildTrafficCar(), x, z, vx: x, vz: z, dir, ni: i + dir.x, nk: k + dir.z, speed: 0, cruise: 9 + Math.random() * 6, stun: 0, heading: Math.atan2(-dir.x, -dir.z) };
    planTurn(o);
    o.mesh.position.set(x, 0, z); o.mesh.rotation.y = o.heading;
    scene.add(o.mesh);
    traffic.push(o);
    return;
  }
}

function spawnTraffic() {
  for (const o of traffic) scene.remove(o.mesh);
  traffic.length = 0;
  const n = TRAFFIC_COUNT[save.traffic] || 0;
  for (let i = 0; i < n; i++) makeTraffic();
}

function updateTraffic(dt) {
  for (const o of traffic) {
    let target = o.cruise;
    let f = Infinity;
    const look = (x, z) => {
      const rx = x - o.x, rz = z - o.z;
      const ahead = rx * o.dir.x + rz * o.dir.z;
      if (ahead <= 0 || ahead > 16) return;
      if (Math.abs(rx * o.dir.z - rz * o.dir.x) < 2.6) f = Math.min(f, ahead);
    };
    if (state !== 'menu') look(player.pos.x, player.pos.z);
    for (const q of traffic) if (q !== o) look(q.x, q.z);
    if (f < Infinity) target = Math.min(target, Math.max(0, f - 6.5) * 1.5);
    if (o.stun > 0) { o.stun -= dt; target = 0; }
    o.speed = lerp(o.speed, target, damp(target < o.speed ? 5 : 1.5, dt));
    let move = o.speed * dt, guard = 0;
    while (move > 0 && guard++ < 4) {
      const dist = (o.target.x - o.x) * o.dir.x + (o.target.z - o.z) * o.dir.z;
      if (dist > move) { o.x += o.dir.x * move; o.z += o.dir.z * move; move = 0; }
      else {
        o.x = o.target.x; o.z = o.target.z; move -= Math.max(dist, 0);
        o.dir = o.newDir; o.ni += o.dir.x; o.nk += o.dir.z;
        planTurn(o);
      }
    }
    o.vx = lerp(o.vx, o.x, damp(8, dt));
    o.vz = lerp(o.vz, o.z, damp(8, dt));
    o.heading += angleDiff(o.heading, Math.atan2(-o.dir.x, -o.dir.z)) * damp(7, dt);
    o.mesh.position.set(o.vx, 0, o.vz);
    o.mesh.rotation.y = o.heading;
  }
}

// =====================================================
//  PARTICULES ET TRACES DE PNEUS
// =====================================================
const parts = [];
for (let i = 0; i < 180; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
  s.visible = false;
  scene.add(s);
  parts.push({ s, life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 1, grow: 1, op: 1 });
}
let partIdx = 0;
function emit(x, y, z, vx, vy, vz, color, size, life, grow, additive, op = 0.6) {
  const P = parts[partIdx]; partIdx = (partIdx + 1) % parts.length;
  P.s.visible = true; P.s.position.set(x, y, z);
  P.vx = vx; P.vy = vy; P.vz = vz;
  P.s.material.color.set(color);
  P.s.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  P.size = size; P.grow = grow; P.life = P.max = life; P.op = op;
  P.s.scale.setScalar(size);
}
function updateParticles(dt) {
  for (const P of parts) {
    if (P.life <= 0) continue;
    P.life -= dt;
    if (P.life <= 0) { P.s.visible = false; continue; }
    P.s.position.x += P.vx * dt; P.s.position.y += P.vy * dt; P.s.position.z += P.vz * dt;
    P.vx *= 0.96; P.vz *= 0.96;
    P.size += P.grow * dt;
    P.s.scale.setScalar(P.size);
    P.s.material.opacity = (P.life / P.max) * P.op;
  }
}
function burst(x, y, z, color, n = 14, speed = 8, additive = true) {
  for (let i = 0; i < n; i++) emit(x, y, z, (Math.random() - 0.5) * speed, Math.random() * speed * 0.7, (Math.random() - 0.5) * speed, color, 0.5, 0.5 + Math.random() * 0.3, -0.4, additive, 1);
}

const MAX_MARKS = 1200;
const markGeo = new THREE.PlaneGeometry(0.32, 1); markGeo.rotateX(-Math.PI / 2);
const marks = new THREE.InstancedMesh(markGeo, new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), MAX_MARKS);
marks.frustumCulled = false;
marks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
dummy.position.set(0, -10, 0); dummy.scale.set(0, 0, 0); dummy.updateMatrix();
for (let i = 0; i < MAX_MARKS; i++) marks.setMatrixAt(i, dummy.matrix);
scene.add(marks);
let markIdx = 0;
function addMark(a, b, y) {
  const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
  if (len < 0.05 || len > 5) return;
  dummy.position.set((a.x + b.x) / 2, y + 0.04, (a.z + b.z) / 2);
  dummy.rotation.set(0, Math.atan2(dx, dz), 0);
  dummy.scale.set(1, 1, len + 0.05);
  dummy.updateMatrix();
  marks.setMatrixAt(markIdx, dummy.matrix);
  markIdx = (markIdx + 1) % MAX_MARKS;
  marks.instanceMatrix.needsUpdate = true;
}

// =====================================================
//  MISSIONS
// =====================================================
const MISSION_START = { x: 0, z: -120 };
const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const marker = new THREE.Group();
{
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 8, 32, 1, true), markerMat); cyl.position.y = 4;
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.6, 5.4, 32), markerMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1;
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(1.2), new THREE.MeshStandardMaterial({ color: 0xffd23a, emissive: 0xffb000, emissiveIntensity: 1.5 }));
  star.position.y = 5; star.name = 'star';
  marker.add(cyl, ring, star);
}
marker.position.set(MISSION_START.x, 0, MISSION_START.z);
scene.add(marker);

const beamMat = new THREE.MeshBasicMaterial({ color: 0x3dff7a, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const beam = new THREE.Group();
{
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 80, 32, 1, true), beamMat); cyl.position.y = 40;
  const ring = new THREE.Mesh(new THREE.RingGeometry(5.5, 6.5, 32), beamMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1;
  beam.add(cyl, ring);
}
beam.visible = false;
scene.add(beam);

const arrowGeo = new THREE.ConeGeometry(0.6, 1.8, 12); arrowGeo.rotateX(-Math.PI / 2);
const arrow = new THREE.Mesh(arrowGeo, new THREE.MeshStandardMaterial({ color: 0x3dff7a, emissive: 0x1aff5a, emissiveIntensity: 1.2 }));
arrow.visible = false;
scene.add(arrow);

const mission = { active: false, cps: [], idx: 0, left: 0, elapsed: 0, cooldown: 0 };

function startMission() {
  mission.cps = [];
  let prev = { x: MISSION_START.x, z: MISSION_START.z }, total = 0;
  while (mission.cps.length < 6) {
    const p = { x: rc(Math.floor(Math.random() * (N + 1))), z: rc(Math.floor(Math.random() * (N + 1))) };
    const d = Math.hypot(p.x - prev.x, p.z - prev.z);
    if (d < 150 || d > 380) continue;
    mission.cps.push(p); total += d; prev = p;
  }
  mission.active = true; mission.idx = 0; mission.elapsed = 0;
  mission.left = Math.round(total / 17 + 10);
  marker.visible = false;
  placeBeam();
  $('missionPanel').classList.remove('hidden');
  showMessage('MISSION : passe par les 6 points verts !', '#3dff7a', 2.5);
}
function placeBeam() {
  const cp = mission.cps[mission.idx];
  beam.position.set(cp.x, 0, cp.z);
  beam.visible = true;
}
function finishMission(ok) {
  mission.active = false; mission.cooldown = 4;
  beam.visible = false; arrow.visible = false; marker.visible = true;
  $('missionPanel').classList.add('hidden');
  if (ok) {
    const reward = 500 + Math.floor(mission.left) * 20;
    save.money += reward; save.missions++;
    persist(); refreshStats();
    showMessage('MISSION RÉUSSIE ! +' + reward + ' $', '#3dff7a', 3);
  } else {
    showMessage('Temps écoulé… Mission ratée', '#ff5050', 2.5);
  }
}
function cancelMission() {
  mission.active = false; beam.visible = false; arrow.visible = false; marker.visible = true;
  $('missionPanel').classList.add('hidden');
}
const fmtTime = (t) => { t = Math.max(0, t); const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };

function updateMission(dt) {
  const p = player.pos;
  if (!mission.active) {
    mission.cooldown -= dt;
    if (mission.cooldown <= 0 && Math.hypot(p.x - MISSION_START.x, p.z - MISSION_START.z) < 5.5) startMission();
    return;
  }
  mission.left -= dt; mission.elapsed += dt;
  const cp = mission.cps[mission.idx];
  if (Math.hypot(p.x - cp.x, p.z - cp.z) < 9) {
    burst(cp.x, 2, cp.z, '#3dff7a', 24, 12);
    mission.idx++;
    if (mission.idx >= mission.cps.length) { finishMission(true); return; }
    placeBeam();
    showMessage('Point ' + mission.idx + '/6 ✓', '#3dff7a', 1);
  }
  if (mission.left <= 0) { finishMission(false); return; }
  const next = mission.cps[mission.idx];
  arrow.visible = true;
  arrow.position.set(p.x, player.y + 3.4, p.z);
  arrow.rotation.y = Math.atan2(-(next.x - p.x), -(next.z - p.z));
  $('missionText').textContent = 'Point ' + (mission.idx + 1) + '/6';
  $('missionTime').textContent = fmtTime(mission.left);
  $('missionTime').style.color = mission.left < 10 ? '#ff5050' : '#ffd23a';
}

// =====================================================
//  JOUEUR
// =====================================================
const SPAWN = { x: LANE, z: 40, h: 0 };
const player = { pos: new THREE.Vector3(SPAWN.x, 0, SPAWN.z), y: 0, vy: 0, vh: 0, h: 0, slip: 0, speed: 0, steer: 0, grounded: true, air: 0, def: CARS[0] };
const D = { drifting: false, dir: 0, time: 0, points: 0, mult: 1, combo: 0, level: 0, show: 0 };
let turboTime = 0, turboMax = 1, turboLevel = 0;
let car = null;
let braking = false;
let shake = 0;
let coinsTaken = 0;
let lastMarks = [null, null];

function setPlayerCar() {
  if (car) scene.remove(car.root);
  player.def = CARS[save.car];
  car = buildCar(player.def.style, COLORS[save.color]);
  scene.add(car.root);
  updateCarLights();
  syncCarMesh(0);
}
function updateCarLights() {
  if (!car) return;
  car.spot.intensity = currentTime.spot;
  car.headMat.emissiveIntensity = currentTime.head;
  car.paint.envMapIntensity = currentTime.env;
  car.glass.envMapIntensity = currentTime.env;
}

function nearestRoad(x, z) {
  const gi = clamp(Math.round((x - rc(0)) / CELL), 0, N), gk = clamp(Math.round((z - rc(0)) / CELL), 0, N);
  const rx = rc(gi), rz = rc(gk);
  if (Math.abs(x - rx) < Math.abs(z - rz)) return { x: rx + LANE, z: clamp(z, -HALF + 10, HALF - 10), h: 0 };
  return { x: clamp(x, -HALF + 10, HALF - 10), z: rz + LANE, h: -Math.PI / 2 };
}

function resetPlayer(toSpawn) {
  const p = toSpawn ? SPAWN : nearestRoad(player.pos.x, player.pos.z);
  player.pos.set(p.x, 0, p.z);
  player.vh = p.h; player.h = p.h; player.slip = 0; player.speed = 0;
  player.y = 0; player.vy = 0; player.grounded = true; player.air = 0;
  D.drifting = false; D.points = 0; D.level = 0;
  turboTime = 0; camHeading = p.h;
  lastMarks = [null, null];
}

function startDrift(dir) {
  D.drifting = true; D.dir = dir; D.time = 0; D.points = 0; D.level = 0; D.show = 0;
}
function endDrift(giveTurbo) {
  D.drifting = false;
  lastMarks = [null, null];
  if (giveTurbo && D.level > 0) {
    turboTime = turboMax = TURBO_TIME[D.level];
    turboLevel = D.level;
    showMessage(D.level === 3 ? 'SUPER DRIFT ! 🚀' : 'TURBO !', LEVEL_COLORS[D.level], 1.2);
  }
  const pts = Math.round(D.points);
  if (pts > 0) {
    save.money += Math.floor(pts / 10);
    if (pts > save.bestDrift) { save.bestDrift = pts; if (pts > 500) setTimeout(() => showMessage('NOUVEAU RECORD DE DRIFT !', '#ffd23a', 1.8), 1200); }
    D.combo = 3; D.mult = Math.min(5, D.mult + 1);
    persist(); refreshStats();
  }
  D.show = 1.5;
}
function crashDrift() {
  D.drifting = false; D.points = 0; D.mult = 1; D.combo = 0; D.show = 0;
  lastMarks = [null, null];
  showMessage('Drift raté 💥', '#ff5050', 1.2);
}

function hitResponse(nx, nz) {
  const fx = -Math.sin(player.vh), fz = -Math.cos(player.vh);
  const vx = fx * player.speed, vz = fz * player.speed;
  const vn = vx * nx + vz * nz;
  if (vn >= 0) return 0;
  const impact = -vn;
  const tx = vx - vn * nx, tz = vz - vn * nz, tl = Math.hypot(tx, tz);
  if (impact > Math.abs(player.speed) * 0.75) {
    player.speed = -Math.sign(player.speed) * Math.min(4, impact * 0.25);
  } else if (tl > 0.1) {
    const sg = Math.sign(player.speed) || 1;
    const nh = Math.atan2(-tx * sg, -tz * sg);
    const d = angleDiff(player.vh, nh);
    player.vh += d; player.slip -= d;
    player.speed = sg * tl * 0.92;
  }
  if (impact > 6) {
    shake = Math.min(1, impact / 25);
    burst(player.pos.x - nx * 1.8, player.y + 0.7, player.pos.z - nz * 1.8, '#ffcc55', 16, 10);
    if (D.drifting && impact > 7) crashDrift();
  }
  return impact;
}

function collide() {
  const p = player.pos, r = 1.9;
  for (const b of colliders) {
    if (player.y > b.h) continue;
    if (p.x < b.minX - r || p.x > b.maxX + r || p.z < b.minZ - r || p.z > b.maxZ + r) continue;
    const cx = clamp(p.x, b.minX, b.maxX), cz = clamp(p.z, b.minZ, b.maxZ);
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    let nx, nz;
    if (d2 < 1e-6) {
      const l = p.x - b.minX, ri = b.maxX - p.x, t = p.z - b.minZ, bo = b.maxZ - p.z, m = Math.min(l, ri, t, bo);
      if (m === l) { nx = -1; nz = 0; p.x = b.minX - r; }
      else if (m === ri) { nx = 1; nz = 0; p.x = b.maxX + r; }
      else if (m === t) { nx = 0; nz = -1; p.z = b.minZ - r; }
      else { nx = 0; nz = 1; p.z = b.maxZ + r; }
    } else {
      const d = Math.sqrt(d2); nx = dx / d; nz = dz / d;
      p.x = cx + nx * r; p.z = cz + nz * r;
    }
    hitResponse(nx, nz);
  }
  // circulation
  for (const o of traffic) {
    const dx = p.x - o.vx, dz = p.z - o.vz, d = Math.hypot(dx, dz);
    if (d < 4 && d > 0.01 && player.y < 2) {
      const nx = dx / d, nz = dz / d;
      p.x = o.vx + nx * 4; p.z = o.vz + nz * 4;
      const imp = hitResponse(nx, nz);
      o.stun = 2.5;
      if (imp > 3) o.heading += (Math.random() - 0.5) * 0.4;
    }
  }
  // bord du monde
  if (Math.abs(p.x) > LIMIT) { const s = Math.sign(p.x); p.x = s * LIMIT; hitResponse(-s, 0); }
  if (Math.abs(p.z) > LIMIT) { const s = Math.sign(p.z); p.z = s * LIMIT; hitResponse(0, -s); }
}

function localToWorld(lx, lz) {
  const c = Math.cos(player.h), s = Math.sin(player.h);
  return { x: player.pos.x + lx * c + lz * s, z: player.pos.z - lx * s + lz * c };
}

function updatePlayer(dt) {
  const inp = getInput();
  const c = player.def, A = ASSIST[save.assist] || ASSIST.normal;
  const steerIn = (inp.left ? 1 : 0) - (inp.right ? 1 : 0);
  player.steer = lerp(player.steer, steerIn, damp(10, dt));
  braking = inp.down && player.speed > 1;
  const p = player.pos;
  const offroad = Math.abs(p.x) > HALF || Math.abs(p.z) > HALF;
  const inWater = ponds.some((o) => Math.hypot(p.x - o.x, p.z - o.z) < o.r);
  let maxS = c.maxSpeed * (offroad ? 0.6 : 1) * (inWater ? 0.4 : 1);
  if (turboTime > 0) { turboTime -= dt; maxS *= 1.3; }

  // fin du drift
  if (D.drifting) {
    if (!inp.drift) endDrift(true);
    else if (inp.down) endDrift(false);
    else if (player.speed < 7) endDrift(false);
  }
  // début du drift (Espace + tourner, dans n'importe quel ordre)
  if (!D.drifting && player.grounded && inp.drift && steerIn !== 0 && player.speed > 11) startDrift(Math.sign(steerIn));

  if (player.grounded) {
    if (D.drifting) {
      const si = steerIn * D.dir; // +1 = vers l'intérieur, -1 = vers l'extérieur
      const rate = c.turn * 0.6 * A.rate * (0.72 + 0.45 * si) * clamp(player.speed / 18, 0.5, 1);
      player.vh += D.dir * rate * dt;
      const slipT = D.dir * (A.slip + 0.15 * si) * c.drift;
      player.slip = lerp(player.slip, slipT, damp(5, dt));
      if (inp.up || turboTime > 0) player.speed += (maxS * 0.9 - player.speed) * 0.7 * dt;
      else player.speed -= player.speed * 0.3 * dt;
      D.time += dt;
      D.points += player.speed * dt * (0.6 + Math.abs(player.slip)) * D.mult * A.pts * 1.5;
      const lvl = A.th.filter((t) => D.time >= t).length;
      if (lvl > D.level) { D.level = lvl; burst(p.x, 0.5, p.z, LEVEL_COLORS[lvl], 18, 9); }
    } else {
      if (inp.up) {
        if (player.speed < 0) player.speed += 30 * dt;
        else player.speed += c.accel * (1 - 0.65 * clamp(player.speed / maxS, 0, 1)) * dt;
      } else if (inp.down) {
        if (player.speed > 0.5) player.speed -= 34 * dt;
        else player.speed = Math.max(-15, player.speed - c.accel * 0.6 * dt);
      } else {
        const dec = (2.5 + Math.abs(player.speed) * 0.12) * dt;
        player.speed -= Math.sign(player.speed) * Math.min(Math.abs(player.speed), dec);
      }
      if (turboTime > 0) player.speed = Math.min(maxS, player.speed + 28 * dt);
      if (player.speed > maxS) player.speed = lerp(player.speed, maxS, damp(1.5, dt));
      const sp = Math.abs(player.speed);
      const turn = player.steer * c.turn * clamp(sp / 7, 0, 1) * (1 - 0.35 * clamp(sp / c.maxSpeed, 0, 1));
      player.vh += turn * Math.sign(player.speed) * dt;
      player.slip = lerp(player.slip, player.steer * 0.05 * clamp(sp / 25, 0, 1), damp(4, dt));
    }
  }
  player.h = player.vh + player.slip;

  // déplacement
  const fx = -Math.sin(player.vh), fz = -Math.cos(player.vh);
  const ox = p.x, oz = p.z;
  p.x += fx * player.speed * dt;
  p.z += fz * player.speed * dt;

  // sol, tremplins et sauts
  const g = groundHeight(p.x, p.z);
  if (player.grounded) {
    if (g - player.y > 1.0) { // on tape le côté haut d'un tremplin
      p.x = ox; p.z = oz;
      if (Math.abs(player.speed) > 8) { shake = 0.5; burst(p.x + fx * 2, 1, p.z + fz * 2, '#ffcc55', 12, 8); if (D.drifting) crashDrift(); }
      player.speed *= -0.25;
    } else if (g < player.y - 0.35) {
      player.grounded = false; player.air = 0;
    } else {
      player.vy = clamp((g - player.y) / Math.max(dt, 0.001), -5, 25);
      player.y = g;
    }
  }
  if (!player.grounded) {
    player.vy -= 28 * dt;
    player.y += player.vy * dt;
    player.air += dt;
    if (player.y <= g) {
      player.y = g; player.grounded = true;
      if (player.air > 0.45) {
        const pts = Math.round(player.air * 400);
        save.money += Math.round(pts / 10);
        persist(); refreshStats();
        showMessage('SAUT ! +' + pts + ' pts', '#7df9ff', 1.4);
      }
      shake = Math.min(0.8, -player.vy * 0.03);
      for (let i = 0; i < 10; i++) emit(p.x, 0.4, p.z, (Math.random() - 0.5) * 10, 1, (Math.random() - 0.5) * 10, '#cccccc', 1.2, 0.8, 2, false, 0.5);
      player.vy = 0;
    }
  }

  collide();

  // combo
  if (!D.drifting && D.combo > 0) { D.combo -= dt; if (D.combo <= 0) D.mult = 1; }
  if (D.show > 0) D.show -= dt;

  // effets : fumée, traces, étincelles, flammes du turbo
  const S = car.S;
  if (D.drifting && player.grounded) {
    const rear = [localToWorld(-(S.W / 2 - 0.12), S.L / 2 - 0.85), localToWorld(S.W / 2 - 0.12, S.L / 2 - 0.85)];
    rear.forEach((w, k) => {
      if (Math.random() < 0.6) emit(w.x, 0.4, w.z, (Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2, currentTime === TIME_SET.night ? '#8890a0' : '#e8e8e8', 1, 1.1, 3.2, false, 0.45);
      if (D.level > 0 && Math.random() < 0.5) emit(w.x, 0.3, w.z, (Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4, LEVEL_COLORS[D.level], 0.35, 0.35, -0.3, true, 1);
      if (lastMarks[k]) addMark(lastMarks[k], w, player.y);
      lastMarks[k] = w;
    });
  }
  if (turboTime > 0) {
    const ex = localToWorld(0.45, S.L / 2 + 0.3);
    emit(ex.x, player.y + 0.5, ex.z, fx * -6, 0.5, fz * -6, LEVEL_COLORS[turboLevel], 0.6, 0.25, 1.5, true, 0.9);
  }
  if (inWater && Math.abs(player.speed) > 5 && Math.random() < 0.5) emit(p.x, 0.5, p.z, (Math.random() - 0.5) * 6, 4, (Math.random() - 0.5) * 6, '#9fd0ff', 0.8, 0.6, 1, false, 0.7);

  syncCarMesh(dt);
}

function syncCarMesh(dt) {
  car.root.position.set(player.pos.x, player.y, player.pos.z);
  car.root.rotation.y = player.h;
  const pitchT = player.grounded ? 0 : clamp(-player.vy * 0.015, -0.3, 0.3);
  car.root.rotation.x = lerp(car.root.rotation.x, pitchT, damp(4, dt));
  const sp = Math.abs(player.speed);
  const rollT = D.drifting ? -D.dir * 0.06 : -player.steer * 0.045 * clamp(sp / 30, 0, 1);
  car.chassis.rotation.z = lerp(car.chassis.rotation.z, rollT, damp(6, dt));
  car.chassis.rotation.x = lerp(car.chassis.rotation.x, braking ? -0.03 : 0, damp(6, dt));
  for (const w of car.wheels) w.rotation.x -= player.speed * dt / 0.42;
  const steerA = D.drifting ? -D.dir * 0.3 + player.steer * 0.15 : player.steer * 0.45;
  for (const f of car.fronts) f.rotation.y = steerA;
  car.tailMat.emissiveIntensity = braking ? 3 : (currentTime === TIME_SET.day ? 0.4 : 1.2);
}

// =====================================================
//  PIÈCES
// =====================================================
function resetCoins() {
  coinsTaken = 0;
  for (const c of coins) { c.taken = false; c.mesh.visible = true; }
  refreshStats();
}
function updateCoins(dt, t) {
  for (const c of coins) {
    if (c.taken) continue;
    c.mesh.rotation.y += dt * 3;
    c.mesh.position.y = c.y + Math.sin(t * 3 + c.x) * 0.25;
    if (state !== 'play') continue;
    const dx = player.pos.x - c.x, dz = player.pos.z - c.z, dy = player.y + 0.8 - c.mesh.position.y;
    if (dx * dx + dz * dz < 10 && Math.abs(dy) < 3) {
      c.taken = true; c.mesh.visible = false; coinsTaken++;
      save.money += 100;
      burst(c.x, c.mesh.position.y, c.z, '#ffd23a', 16, 8);
      if (coinsTaken >= coins.length) {
        save.money += 2000;
        showMessage('TOUTES LES PIÈCES ! +2000 $', '#ffd23a', 3);
        setTimeout(resetCoins, 3000);
      } else showMessage('+100 $', '#ffd23a', 0.7);
      persist(); refreshStats();
    }
  }
}

// =====================================================
//  CONTRÔLES
// =====================================================
const keys = {};
const touch = { left: false, right: false, up: false, down: false, drift: false };
function getInput() {
  return {
    up: keys.ArrowUp || keys.KeyW || touch.up,
    down: keys.ArrowDown || keys.KeyS || touch.down,
    left: keys.ArrowLeft || keys.KeyA || touch.left,
    right: keys.ArrowRight || keys.KeyD || touch.right,
    drift: keys.Space || keys.ShiftLeft || keys.ShiftRight || touch.drift,
  };
}
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) { keys[e.code] = true; return; }
  keys[e.code] = true;
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (state !== 'play') return;
  if (e.code === 'KeyR') { resetPlayer(false); showMessage('Voiture replacée', '#ffffff', 0.8); }
  if (e.code === 'KeyC') { save.color = (save.color + 1) % COLORS.length; car.paint.color.set(COLORS[save.color]); persist(); }
  if (e.code === 'KeyV') camMode = (camMode + 1) % 3;
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (state === 'play') togglePause(); });

document.querySelectorAll('#touch button').forEach((b) => {
  const k = b.dataset.k;
  const on = (e) => { e.preventDefault(); touch[k] = true; b.classList.add('active'); };
  const off = (e) => { e.preventDefault(); touch[k] = false; b.classList.remove('active'); };
  b.addEventListener('pointerdown', on);
  b.addEventListener('pointerup', off);
  b.addEventListener('pointerleave', off);
  b.addEventListener('pointercancel', off);
});

// =====================================================
//  CAMÉRA
// =====================================================
let camHeading = 0, camMode = 0, menuAngle = 0;
function updateCamera(dt) {
  const p = player.pos;
  if (camMode < 2) {
    const M = camMode === 0 ? { d: 8.5, h: 3.4, look: 1.2 } : { d: 14, h: 6, look: 1.6 };
    const target = player.vh + player.slip * 0.35;
    camHeading += angleDiff(camHeading, target) * damp(4, dt);
    const cx = p.x + Math.sin(camHeading) * M.d, cz = p.z + Math.cos(camHeading) * M.d;
    camera.position.x = cx; camera.position.z = cz;
    camera.position.y = lerp(camera.position.y, player.y + M.h, damp(6, dt));
    camera.lookAt(p.x - Math.sin(camHeading) * 3, player.y + M.look, p.z - Math.cos(camHeading) * 3);
  } else {
    camHeading = player.h;
    const fx = -Math.sin(player.h), fz = -Math.cos(player.h);
    camera.position.set(p.x + fx * 0.3, player.y + 1.3, p.z + fz * 0.3);
    camera.lookAt(p.x + fx * 12, player.y + 1.0, p.z + fz * 12);
  }
  if (shake > 0.01) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake *= Math.exp(-5 * dt);
  }
  const fovT = 65 + clamp(Math.abs(player.speed) / player.def.maxSpeed, 0, 1.3) * 12 + (turboTime > 0 ? 8 : 0);
  camera.fov = lerp(camera.fov, fovT, damp(3, dt));
  camera.updateProjectionMatrix();
}
function updateMenuCamera(dt) {
  menuAngle += dt * 0.15;
  const p = player.pos;
  camera.position.set(p.x + Math.cos(menuAngle) * 11, 3.5, p.z + Math.sin(menuAngle) * 11);
  camera.lookAt(p.x, 1, p.z);
  if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
}

// =====================================================
//  MINI-CARTE
// =====================================================
const MAP_R = HALF + 80, MAP_PX = 700, MS = MAP_PX / (2 * MAP_R);
const mapCanvas = document.createElement('canvas');
mapCanvas.width = mapCanvas.height = MAP_PX;
function drawMapBase() {
  const m = mapCanvas.getContext('2d');
  const T = (v) => (v + MAP_R) * MS;
  m.fillStyle = '#355e2e'; m.fillRect(0, 0, MAP_PX, MAP_PX);
  m.fillStyle = '#4a4d55'; m.fillRect(T(-HALF), T(-HALF), CITY * MS, CITY * MS);
  const BC = { downtown: '#8a8f99', mid: '#9a9a92', suburb: '#7aa06a', park: '#4f9a45', stunt: '#c9b26a' };
  for (const b of blocks) { m.fillStyle = BC[b.type]; m.fillRect(T(b.cx - BLOCK / 2), T(b.cz - BLOCK / 2), BLOCK * MS, BLOCK * MS); }
  m.fillStyle = '#5a5f6b';
  for (const c of colliders) if (c.kind === 'b') m.fillRect(T(c.minX), T(c.minZ), (c.maxX - c.minX) * MS, (c.maxZ - c.minZ) * MS);
  m.fillStyle = '#3d8be0';
  for (const p of ponds) { m.beginPath(); m.arc(T(p.x), T(p.z), p.r * MS, 0, Math.PI * 2); m.fill(); }
  m.fillStyle = '#f2c230';
  for (const r of ramps) m.fillRect(T(r.x) - 3, T(r.z) - 3, 6, 6);
}
const mm = $('minimap').getContext('2d');
function drawMinimap() {
  const C = 100, R = 96, pm = 0.7, a = camHeading, px = player.pos.x, pz = player.pos.z;
  mm.clearRect(0, 0, 200, 200);
  mm.save();
  mm.beginPath(); mm.arc(C, C, R, 0, Math.PI * 2); mm.clip();
  mm.fillStyle = '#355e2e'; mm.fillRect(0, 0, 200, 200);
  mm.save();
  mm.translate(C, C); mm.rotate(a);
  const k = pm / MS; mm.scale(k, k);
  mm.translate(-(px + MAP_R) * MS, -(pz + MAP_R) * MS);
  mm.drawImage(mapCanvas, 0, 0);
  mm.restore();
  const ca = Math.cos(a), sa = Math.sin(a);
  const proj = (x, z) => { const rx = (x - px) * pm, rz = (z - pz) * pm; return [C + rx * ca - rz * sa, C + rx * sa + rz * ca]; };
  const edge = (x, z) => { let [u, v] = proj(x, z); const dx = u - C, dy = v - C, d = Math.hypot(dx, dy); if (d > R - 8) { u = C + dx / d * (R - 8); v = C + dy / d * (R - 8); } return [u, v]; };
  mm.fillStyle = '#ffd23a';
  for (const c of coins) { if (c.taken) continue; const [u, v] = proj(c.x, c.z); if (Math.hypot(u - C, v - C) < R) { mm.beginPath(); mm.arc(u, v, 2.5, 0, Math.PI * 2); mm.fill(); } }
  mm.fillStyle = '#ffffff';
  for (const o of traffic) { const [u, v] = proj(o.vx, o.vz); if (Math.hypot(u - C, v - C) < R) mm.fillRect(u - 1.5, v - 1.5, 3, 3); }
  if (!mission.active) {
    const [u, v] = edge(MISSION_START.x, MISSION_START.z);
    mm.fillStyle = '#ffd23a'; mm.strokeStyle = '#000'; mm.lineWidth = 2;
    mm.beginPath(); mm.arc(u, v, 7, 0, Math.PI * 2); mm.fill(); mm.stroke();
    mm.fillStyle = '#000'; mm.font = 'bold 10px sans-serif'; mm.textAlign = 'center'; mm.textBaseline = 'middle'; mm.fillText('★', u, v + 0.5);
  } else {
    const cp = mission.cps[mission.idx];
    const [u, v] = edge(cp.x, cp.z);
    mm.fillStyle = '#3dff7a'; mm.strokeStyle = '#000'; mm.lineWidth = 2;
    mm.beginPath(); mm.arc(u, v, 7, 0, Math.PI * 2); mm.fill(); mm.stroke();
  }
  mm.restore();
  mm.save();
  mm.translate(C, C); mm.rotate(a - player.h);
  mm.beginPath(); mm.moveTo(0, -9); mm.lineTo(7, 7); mm.lineTo(0, 3); mm.lineTo(-7, 7); mm.closePath();
  mm.fillStyle = '#ff3b3b'; mm.fill(); mm.strokeStyle = '#fff'; mm.lineWidth = 2; mm.stroke();
  mm.restore();
}

// =====================================================
//  HUD ET MESSAGES
// =====================================================
let msgTimer = 0, hintTimer = 0;
function showMessage(text, color = '#fff', time = 1.6) {
  const m = $('message');
  m.textContent = text; m.style.color = color;
  m.classList.add('show');
  msgTimer = time;
}
function refreshStats() {
  $('money').textContent = save.money.toLocaleString('fr-FR') + ' $';
  $('coins').textContent = coinsTaken + '/' + coins.length;
  $('bestDrift').textContent = save.bestDrift.toLocaleString('fr-FR');
}
function updateHUD(dt) {
  $('speed').textContent = Math.round(Math.abs(player.speed) * 3.6);
  const A = ASSIST[save.assist] || ASSIST.normal;
  const fill = $('turboFill');
  if (turboTime > 0) { fill.style.width = (turboTime / turboMax * 100) + '%'; fill.style.background = LEVEL_COLORS[turboLevel]; }
  else if (D.drifting) { fill.style.width = Math.min(100, D.time / A.th[2] * 100) + '%'; fill.style.background = LEVEL_COLORS[Math.max(1, D.level)]; }
  else fill.style.width = '0%';

  const box = $('driftBox');
  if (D.drifting || D.show > 0) {
    box.classList.remove('hidden');
    $('driftLevel').textContent = D.drifting ? LEVEL_NAMES[D.level] : 'BIEN JOUÉ !';
    $('driftLevel').style.color = LEVEL_COLORS[D.level];
    $('driftPoints').textContent = (D.drifting ? '' : '+') + Math.round(D.points).toLocaleString('fr-FR');
    $('driftPoints').style.color = D.drifting ? '#fff' : '#7dff9a';
    $('driftMult').textContent = D.mult > 1 ? 'COMBO x' + D.mult : '';
  } else box.classList.add('hidden');

  if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) $('message').classList.remove('show'); }
  if (hintTimer > 0) { hintTimer -= dt; if (hintTimer <= 0) $('hint').style.opacity = 0; }
}

// =====================================================
//  MOMENT DE LA JOURNÉE
// =====================================================
function applyTime(id) {
  const T = TIME_SET[id] || TIME_SET.day;
  currentTime = T;
  skyUniforms.top.value.set(T.skyTop);
  skyUniforms.bottom.value.set(T.skyBot);
  scene.fog.color.set(T.fog); scene.fog.near = T.fogNear; scene.fog.far = T.fogFar;
  hemi.intensity = T.hemi; hemi.color.set(T.hemiSky); hemi.groundColor.set(T.hemiGround);
  sun.intensity = T.sun; sun.color.set(T.sunColor); sunOffset.set(T.sunPos[0], T.sunPos[1], T.sunPos[2]);
  for (const m of windowMats) m.emissiveIntensity = T.win;
  for (const m of neonMats) m.emissiveIntensity = T.neon;
  for (const m of envMats) m.envMapIntensity = T.env;
  lampHeadMat.emissiveIntensity = T.lamp;
  antennaMat.emissiveIntensity = T.lamp > 1 ? 3 : 0.6;
  poolMat.opacity = T.pool;
  if (pools) pools.visible = T.pool > 0;
  tHead.emissiveIntensity = T.head;
  tTail.emissiveIntensity = T === TIME_SET.day ? 0.4 : 1.2;
  stars.visible = T.stars;
  clouds.visible = T.clouds; cloudMat.color.set(T.cloud);
  mountainMat.color.set(T.mountain);
  renderer.toneMappingExposure = T.exposure;
  if (bloom) { bloom.strength = T.bloom[0]; bloom.radius = T.bloom[1]; bloom.threshold = T.bloom[2]; }
  updateCarLights();
}

// =====================================================
//  MENU / ÉTATS DU JEU
// =====================================================
let state = 'menu';

function makeChoices(id, list, key, cb) {
  const el = $(id); el.innerHTML = '';
  list.forEach((o) => {
    const b = document.createElement('button');
    b.textContent = o.name;
    if (save[key] === o.id) b.className = 'selected';
    b.onclick = () => { save[key] = o.id; persist(); if (cb) cb(); buildMenu(); };
    el.appendChild(b);
  });
}
function buildMenu() {
  const list = $('carList'); list.innerHTML = '';
  CARS.forEach((c, i) => {
    const d = document.createElement('div');
    d.className = 'card' + (i === save.car ? ' selected' : '');
    d.innerHTML = '<div class="cardTitle">' + c.name + '</div><div class="cardDesc">' + c.desc + '</div>' +
      STAT_NAMES.map((n, k) => '<div class="stat"><span>' + n + '</span><div class="bar"><div style="width:' + c.stats[k] * 20 + '%"></div></div></div>').join('');
    d.onclick = () => { save.car = i; persist(); setPlayerCar(); buildMenu(); };
    list.appendChild(d);
  });
  const cl = $('colorList'); cl.innerHTML = '';
  COLORS.forEach((col, i) => {
    const s = document.createElement('div');
    s.className = 'swatch' + (i === save.color ? ' selected' : '');
    s.style.background = col;
    s.onclick = () => { save.color = i; persist(); car.paint.color.set(col); buildMenu(); };
    cl.appendChild(s);
  });
  makeChoices('timeChoices', TIMES, 'time', () => applyTime(save.time));
  makeChoices('trafficChoices', TRAFFIC, 'traffic', spawnTraffic);
  makeChoices('assistChoices', ASSISTS, 'assist');
  $('records').innerHTML = '🏆 Record de drift : <b>' + save.bestDrift.toLocaleString('fr-FR') + '</b> pts &nbsp;·&nbsp; ⭐ Missions réussies : <b>' + save.missions + '</b> &nbsp;·&nbsp; 💰 Argent : <b>' + save.money.toLocaleString('fr-FR') + ' $</b>';
}

function startGame() {
  state = 'play';
  $('menu').classList.add('hidden');
  $('hud').classList.remove('hidden');
  if (isMobile) $('touch').classList.remove('hidden');
  resetPlayer(true);
  resetCoins();
  cancelMission();
  mission.cooldown = 1;
  D.mult = 1; D.combo = 0; D.show = 0;
  camera.position.set(player.pos.x, 4, player.pos.z + 9);
  $('hint').innerHTML = isMobile
    ? '▲ accélérer · ◀ ▶ tourner · DRIFT en tournant · Va au marqueur jaune ⭐ pour une mission !'
    : 'Flèches/WASD = conduire · Espace en tournant = drift · Va au marqueur jaune ⭐ (tout droit) pour une mission · Ramasse les pièces 🪙';
  $('hint').style.opacity = 1;
  hintTimer = 9;
  refreshStats();
  clock.getDelta();
}
function toMenu() {
  state = 'menu';
  $('pause').classList.add('hidden');
  $('hud').classList.add('hidden');
  $('touch').classList.add('hidden');
  $('menu').classList.remove('hidden');
  cancelMission();
  resetPlayer(true);
  syncCarMesh(0);
  buildMenu();
}
function togglePause() {
  if (state === 'play') { state = 'pause'; $('pause').classList.remove('hidden'); }
  else if (state === 'pause') { state = 'play'; $('pause').classList.add('hidden'); clock.getDelta(); }
}
$('playBtn').onclick = startGame;
$('resumeBtn').onclick = togglePause;
$('menuBtn').onclick = toMenu;
$('pauseBtn').onclick = togglePause;

// =====================================================
//  DÉMARRAGE
// =====================================================
buildCity();
drawMapBase();
applyTime(save.time);
setPlayerCar();
resetPlayer(true);
syncCarMesh(0);
spawnTraffic();
buildMenu();

const clock = new THREE.Clock();
let elapsed = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (state !== 'pause') {
    elapsed += dt;
    if (state === 'play') {
      updatePlayer(dt);
      updateMission(dt);
      updateCamera(dt);
      updateHUD(dt);
      drawMinimap();
    } else {
      updateMenuCamera(dt);
    }
    updateTraffic(dt);
    updateCoins(dt, elapsed);
    updateParticles(dt);
    const star = marker.getObjectByName('star');
    star.rotation.y += dt * 2; star.position.y = 5 + Math.sin(elapsed * 2) * 0.4;
    markerMat.opacity = 0.28 + Math.sin(elapsed * 3) * 0.08;
    beamMat.opacity = 0.25 + Math.sin(elapsed * 4) * 0.08;
  }
  // le soleil (et ses ombres) suit la voiture
  sun.position.copy(player.pos).add(sunOffset);
  sun.target.position.copy(player.pos);
  sky.position.copy(camera.position);
  stars.position.copy(camera.position);
  if (composer) composer.render(); else renderer.render(scene, camera);
}
loop();
