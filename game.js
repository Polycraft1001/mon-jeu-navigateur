// =============================================================
//  TURBO DRIFT 3D - jeu de course 3D dans le navigateur (Three.js)
// =============================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = id => document.getElementById(id);
const V3 = THREE.Vector3;
const isTouch = matchMedia('(pointer: coarse)').matches;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (k, dt) => 1 - Math.exp(-k * dt);
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = s * 16807 % 2147483647) / 2147483647; }
const fmt = t => { if (!isFinite(t)) return '--'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };
const LS = {
  get(k, d) { try { const v = localStorage.getItem('td3d_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('td3d_' + k, JSON.stringify(v)); } catch (e) {} }
};

// =============================================================
//  CIRCUITS
// =============================================================
const MAPS = [
  { id: 'gp', name: 'Grand Prix', emoji: '🏁', desc: 'Circuit classique au soleil',
    pts: [[0,0],[150,0],[255,50],[285,155],[210,235],[80,220],[0,285],[-130,285],[-235,210],[-235,80],[-145,25]],
    width: 16, skyTop: 0x2f7fd8, skyBottom: 0xcfe8ff, fog: 0xcfe8ff, fogNear: 200, fogFar: 1200,
    ground: 'grass', asphalt: '#3b3b40', line: '#ffffff', kerb: ['#d81e1e', '#ffffff'], barrier: ['#1f4fd1', '#ffffff'],
    sun: 0xffffff, sunI: 2.6, hemiSky: 0xbfdfff, hemiGround: 0x4a6b2a, hemiI: 0.9, night: false, grip: 1,
    smoke: '#e6e6e6', dust: '#8a7a50', sunSprite: ['#fff4d6', 260], bloom: 0.35, scenery: 'gp', sign: 'GRAND PRIX', seed: 11 },
  { id: 'desert', name: 'Canyon du Désert', emoji: '🌵', desc: 'Longues courbes, idéal pour drifter',
    pts: [[0,0],[200,-25],[320,60],[300,200],[195,250],[130,175],[40,225],[-90,250],[-190,160],[-165,45]],
    width: 18, skyTop: 0xd9773a, skyBottom: 0xffdcaa, fog: 0xf2c58c, fogNear: 160, fogFar: 1100,
    ground: 'sand', asphalt: '#4a4038', line: '#ffe3b0', kerb: ['#ff8c1a', '#ffffff'], barrier: ['#8a4b22', '#e8c9a0'],
    sun: 0xffe0b0, sunI: 2.8, hemiSky: 0xffd7a8, hemiGround: 0x9a6a3a, hemiI: 1.0, night: false, grip: 0.95,
    smoke: '#e8d2a8', dust: '#d9b27a', sunSprite: ['#ffd08a', 320], bloom: 0.3, scenery: 'desert', sign: 'CANYON', seed: 23 },
  { id: 'neon', name: 'Neon City', emoji: '🌃', desc: 'Course de nuit en pleine ville',
    pts: [[0,0],[170,0],[225,50],[225,160],[175,210],[70,210],[25,260],[-90,260],[-140,210],[-140,50],[-90,0]],
    width: 16, skyTop: 0x05010f, skyBottom: 0x2a0b4a, fog: 0x1a0833, fogNear: 80, fogFar: 650,
    ground: 'city', asphalt: '#202028', line: '#20e8ff', kerb: ['#ff2bd6', '#20e8ff'], barrier: ['#ff2bd6', '#20e8ff'],
    sun: 0x8a7dff, sunI: 0.6, hemiSky: 0x6a4bff, hemiGround: 0x110022, hemiI: 0.6, night: true, grip: 1,
    smoke: '#c9c2ff', dust: '#555566', sunSprite: ['#cfd8ff', 110], bloom: 1.1, scenery: 'city', sign: 'NEON CITY', seed: 37 },
  { id: 'snow', name: 'Pic Enneigé', emoji: '❄️', desc: 'Route glissante : drifts faciles !',
    pts: [[0,0],[150,35],[245,0],[315,90],[250,185],[135,150],[50,215],[-65,185],[-135,95],[-90,25]],
    width: 17, skyTop: 0x7fa6c9, skyBottom: 0xeaf3fb, fog: 0xe6eef6, fogNear: 120, fogFar: 950,
    ground: 'snow', asphalt: '#4a4f57', line: '#ffffff', kerb: ['#1e6ad8', '#ffffff'], barrier: ['#c0392b', '#ffffff'],
    sun: 0xffffff, sunI: 2.0, hemiSky: 0xe0f0ff, hemiGround: 0x9ab0c4, hemiI: 1.1, night: false, grip: 0.8,
    smoke: '#ffffff', dust: '#ffffff', sunSprite: ['#ffffff', 220], bloom: 0.3, scenery: 'snow', sign: 'PIC ENNEIGÉ', seed: 51 }
];

// =============================================================
//  VOITURES  (maxS en m/s, stats sur 5 pour le menu)
// =============================================================
const CARS = [
  { id: 'gt', name: 'GT Sprint', desc: 'Équilibrée, parfaite pour débuter', maxS: 58, accel: 15, steer: 2.3, grip: 10, drift: 1.0,
    color: '#e8202a', stripe: '#ffffff', body: { w: 2.0, l: 4.4, h: 0.55 }, cabin: { w: 1.5, l: 1.9, h: 0.5, z: -0.3 }, spoiler: 0.35, stats: [4, 4, 4, 4] },
  { id: 'drift', name: 'Drift King', desc: 'Faite pour glisser', maxS: 55, accel: 14, steer: 2.5, grip: 8, drift: 1.25,
    color: '#f2f2f2', stripe: '#e8202a', body: { w: 1.95, l: 4.5, h: 0.5 }, cabin: { w: 1.45, l: 1.8, h: 0.48, z: -0.2 }, spoiler: 0.55, stats: [3, 3, 4, 5] },
  { id: 'muscle', name: 'Muscle V8', desc: 'Très rapide mais lourde', maxS: 66, accel: 13, steer: 1.9, grip: 9, drift: 0.9,
    color: '#1f2a44', stripe: '#ffd000', body: { w: 2.2, l: 4.8, h: 0.68 }, cabin: { w: 1.6, l: 1.7, h: 0.45, z: -0.5 }, spoiler: 0, scoop: true, stats: [5, 3, 2, 3] },
  { id: 'rally', name: 'Rally Mini', desc: 'Agile, accélère très fort', maxS: 50, accel: 20, steer: 2.9, grip: 12, drift: 1.1,
    color: '#ffcc00', stripe: '#111111', body: { w: 1.8, l: 3.6, h: 0.7 }, cabin: { w: 1.55, l: 1.7, h: 0.62, z: -0.2 }, spoiler: 0.2, stats: [2, 5, 5, 4] }
];
const COLORS = ['#e8202a', '#ff7a00', '#ffcc00', '#22c55e', '#1e90ff', '#1f2a44', '#8b5cf6', '#ff2bd6', '#f2f2f2', '#111111'];

// =============================================================
//  ETAT
// =============================================================
const saved = LS.get('settings', {});
const S = {
  mode: 'menu',
  mapI: clamp(saved.mapI ?? 0, 0, MAPS.length - 1),
  carI: clamp(saved.carI ?? 0, 0, CARS.length - 1),
  color: saved.color ?? null,
  laps: [1, 3, 5].includes(saved.laps) ? saved.laps : 3,
  assist: [0, 1, 2].includes(saved.assist) ? saved.assist : 2
};
const saveSettings = () => LS.set('settings', { mapI: S.mapI, carI: S.carI, color: S.color, laps: S.laps, assist: S.assist });
const curColor = () => S.color || CARS[S.carI].color;

const car = {
  pos: new V3(), heading: 0, moveDir: 0, prevMove: 0, speed: 0, prevSpeed: 0,
  drifting: false, driftDir: 0, driftAngle: 0, driftTime: 0, driftPts: 0, level: 0,
  boost: 0, hop: 0, steerVis: 0, roll: 0, pitch: 0, idx: 0, quarters: 0, offroad: false, skidAcc: 0, wallHit: false
};
const race = { t: 0, lapStart: 0, lapsDone: 0, bestLap: Infinity, driftTotal: 0, chain: 1, chainTimer: 0, countdown: 0, finished: false, shake: 0, firstDrift: false };
const cam = { yaw: 0, dist: 7, fov: 62, orbit: 0 };
const keys = { up: false, down: false, left: false, right: false, drift: false };

// =============================================================
//  RENDU
// =============================================================
const renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.5, 2200);

let composer = null, bloom = null;
if (!isTouch) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.5, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.castShadow = true;
sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 320 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);
const SUN_OFF = new V3(80, 120, 40);
const SUN_DIR = SUN_OFF.clone().normalize();

// Ciel en dégradé
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y * 1.8 + 0.05, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.8)), 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1600, 32, 16), skyMat);
sky.renderOrder = -1;
scene.add(sky);

// =============================================================
//  TEXTURES (dessinées en canvas)
// =============================================================
const maxAniso = renderer.capabilities.getMaxAnisotropy();
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  return t;
}
function speckle(g, w, h, n, alpha, size = 2) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${Math.random() * alpha})` : `rgba(0,0,0,${Math.random() * alpha})`;
    g.fillRect(Math.random() * w, Math.random() * h, size, size);
  }
}
const smokeTex = canvasTex(64, 64, (g) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
});
smokeTex.userData.keep = true;
const glowTex = canvasTex(128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(255,255,255,.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
glowTex.userData.keep = true;

function groundTex(type) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = { grass: '#4a7a2c', sand: '#d8b27a', city: '#15151d', snow: '#e9f0f7' }[type];
    g.fillRect(0, 0, w, h);
    if (type === 'grass') {
      speckle(g, w, h, 5000, 0.18);
      for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${60 + Math.random() * 40 | 0},${110 + Math.random() * 60 | 0},40,.6)`; g.fillRect(Math.random() * w, Math.random() * h, 1, 4); }
    }
    if (type === 'sand') { speckle(g, w, h, 6000, 0.12); g.strokeStyle = 'rgba(160,110,60,.15)'; for (let y = 10; y < h; y += 22) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y - 8, 160, y + 8, 256, y); g.stroke(); } }
    if (type === 'snow') speckle(g, w, h, 3000, 0.06, 3);
    if (type === 'city') { speckle(g, w, h, 3000, 0.12); g.strokeStyle = 'rgba(140,90,255,.35)'; g.lineWidth = 3; g.strokeRect(1, 1, w - 2, h - 2); }
  });
}
const roadTex = M => canvasTex(256, 512, (g, w, h) => {
  g.fillStyle = M.asphalt; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 9000, 0.22);
  g.fillStyle = M.line; g.fillRect(10, 0, 8, h); g.fillRect(w - 18, 0, 8, h); g.fillRect(w / 2 - 4, 0, 8, h / 2);
});
const stripeTex = (a, b) => canvasTex(32, 64, (g) => { g.fillStyle = a; g.fillRect(0, 0, 32, 32); g.fillStyle = b; g.fillRect(0, 32, 32, 32); });
const windowTex = () => canvasTex(64, 128, (g, w, h) => {
  g.fillStyle = '#0b0b14'; g.fillRect(0, 0, w, h);
  const cols = ['#ffd27a', '#7af0ff', '#ff7ad9', '#ffffff'];
  for (let y = 4; y < h; y += 8) for (let x = 4; x < w; x += 8) if (Math.random() < 0.45) {
    g.globalAlpha = 0.5 + Math.random() * 0.5; g.fillStyle = cols[Math.random() * 4 | 0]; g.fillRect(x, y, 4, 5);
  }
  g.globalAlpha = 1;
});
const signTex = (text, night) => canvasTex(512, 96, (g, w, h) => {
  g.fillStyle = night ? '#120024' : '#141414'; g.fillRect(0, 0, w, h);
  g.fillStyle = night ? '#ff2bd6' : '#ff6a00'; g.fillRect(0, 0, w, 8); g.fillRect(0, h - 8, w, 8);
  g.font = 'italic bold 52px Segoe UI, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#ffffff'; g.fillText(text, w / 2, h / 2 + 2);
});
const checkerTex = () => canvasTex(256, 32, (g) => {
  for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 16, y * 16, 16, 16); }
});

// =============================================================
//  PARTICULES (fumée, étincelles, poussière) + traces de pneus
// =============================================================
const MAXP = 320, parts = [];
let pI = 0;
for (let i = 0; i < MAXP; i++) {
  const m = new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 });
  const s = new THREE.Sprite(m); s.visible = false; scene.add(s);
  parts.push({ s, m, life: 0, max: 1, vel: new V3(), size: 1, grow: 1, op: 1 });
}
function emit(x, y, z, vx, vy, vz, color, size, life, grow, op, additive) {
  const p = parts[pI]; pI = (pI + 1) % MAXP;
  p.s.position.set(x, y, z); p.vel.set(vx, vy, vz);
  p.life = p.max = life; p.size = size; p.grow = grow; p.op = op;
  p.m.color.set(color); p.m.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  p.s.scale.setScalar(size); p.s.visible = true;
}
function updateParticles(dt) {
  for (const p of parts) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.s.visible = false; continue; }
    const t = 1 - p.life / p.max;
    p.s.position.addScaledVector(p.vel, dt);
    p.vel.multiplyScalar(1 - damp(1.5, dt));
    p.s.scale.setScalar(p.size * (1 + p.grow * t));
    p.m.opacity = p.op * (1 - t);
  }
}

const dummy = new THREE.Object3D();
const SKMAX = 1600;
const skids = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(0.32, 0.7).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  SKMAX);
skids.frustumCulled = false;
scene.add(skids);
let skI = 0;
const zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
function clearSkids() { for (let i = 0; i < SKMAX; i++) skids.setMatrixAt(i, zeroM); skids.instanceMatrix.needsUpdate = true; }
function addSkid(x, z, yaw) {
  dummy.position.set(x, 0.045, z); dummy.rotation.set(0, yaw, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
  skids.setMatrixAt(skI, dummy.matrix); skI = (skI + 1) % SKMAX; skids.instanceMatrix.needsUpdate = true;
}
clearSkids();

const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
scene.add(sunSprite);

// =============================================================
//  CONSTRUCTION DU CIRCUIT ET DU DECOR
// =============================================================
let track = null, world = null, BR = 17;

function buildTrackData(M) {
  const curve = new THREE.CatmullRomCurve3(M.pts.map(p => new V3(p[0], 0, p[1])), true, 'centripetal');
  const N = 800;
  const pts = curve.getSpacedPoints(N); pts.pop();
  const tan = [], nor = [], yaw = [], dist = [0];
  let len = 0;
  const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (let i = 0; i < N; i++) {
    const t = pts[(i + 1) % N].clone().sub(pts[(i - 1 + N) % N]).normalize();
    tan.push(t); nor.push(new V3(t.z, 0, -t.x)); yaw.push(Math.atan2(t.x, t.z));
    if (i > 0) { len += pts[i].distanceTo(pts[i - 1]); dist.push(len); }
    const p = pts[i];
    bounds.minX = Math.min(bounds.minX, p.x); bounds.maxX = Math.max(bounds.maxX, p.x);
    bounds.minZ = Math.min(bounds.minZ, p.z); bounds.maxZ = Math.max(bounds.maxZ, p.z);
  }
  len += pts[N - 1].distanceTo(pts[0]);
  return { pts, tan, nor, yaw, dist, len, N, bounds, halfW: M.width / 2 };
}

// Bande qui suit le circuit (route, bordures, barrières)
function ribbon(offA, offB, yA, yB, mat, vScale) {
  const N = track.N, pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const k = i % N, p = track.pts[k], n = track.nor[k], d = i === N ? track.len : track.dist[k];
    pos.push(p.x + n.x * offA, yA, p.z + n.z * offA, p.x + n.x * offB, yB, p.z + n.z * offB);
    uv.push(0, d / vScale, 1, d / vScale);
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; world.add(m);
  return m;
}

function farFromTrack(x, z, min) {
  const m2 = min * min;
  for (let i = 0; i < track.N; i += 4) { const p = track.pts[i]; if ((p.x - x) ** 2 + (p.z - z) ** 2 < m2) return false; }
  return true;
}
function scatter(r, count, minD, extra, avoid) {
  const b = track.bounds, out = [];
  let tries = 0;
  while (out.length < count && tries++ < count * 8) {
    const x = b.minX - extra + r() * (b.maxX - b.minX + 2 * extra);
    const z = b.minZ - extra + r() * (b.maxZ - b.minZ + 2 * extra);
    if (avoid && avoid(x, z)) continue;
    if (farFromTrack(x, z, minD + r() * 30)) out.push({ x, z });
  }
  return out;
}
function inst(geo, mat, list, shadow = true) {
  if (!list.length) return null;
  const m = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((o, i) => {
    dummy.position.set(o.x, o.y || 0, o.z);
    dummy.rotation.set(0, o.r || 0, 0);
    dummy.scale.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1);
    dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    if (o.c) m.setColorAt(i, o.c);
  });
  m.castShadow = shadow; m.receiveShadow = true;
  world.add(m); return m;
}
function disposeObj(o) {
  o.traverse(c => {
    if (c.geometry) c.geometry.dispose();
    const ms = c.material ? (Array.isArray(c.material) ? c.material : [c.material]) : [];
    ms.forEach(m => { ['map', 'emissiveMap'].forEach(k => { if (m[k] && !m[k].userData.keep) m[k].dispose(); }); m.dispose(); });
  });
}

function buildWorld() {
  if (world) { scene.remove(world); disposeObj(world); }
  world = new THREE.Group(); scene.add(world);
  const M = MAPS[S.mapI];
  track = buildTrackData(M);
  const hw = track.halfW; BR = hw + 9;
  const r = rng(M.seed);

  // Ambiance
  skyMat.uniforms.top.value.set(M.skyTop); skyMat.uniforms.bottom.value.set(M.skyBottom);
  scene.fog = new THREE.Fog(M.fog, M.fogNear, M.fogFar);
  hemi.color.set(M.hemiSky); hemi.groundColor.set(M.hemiGround); hemi.intensity = M.hemiI;
  sun.color.set(M.sun); sun.intensity = M.sunI;
  sunSprite.material.color.set(M.sunSprite[0]); sunSprite.scale.setScalar(M.sunSprite[1]);
  renderer.toneMappingExposure = M.night ? 1.15 : 1.0;
  if (bloom) { bloom.strength = M.bloom; bloom.threshold = M.night ? 0.25 : 0.9; }

  // Sol
  const gt = groundTex(M.ground); gt.repeat.set(400, 400);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: gt, roughness: M.ground === 'snow' ? 0.7 : 1 }));
  ground.position.y = -0.02; ground.receiveShadow = true; world.add(ground);

  // Route, bordures, barrières
  ribbon(hw, -hw, 0.02, 0.02, new THREE.MeshStandardMaterial({ map: roadTex(M), roughness: 0.85 }), 32);
  const kerbMat = new THREE.MeshStandardMaterial({ map: stripeTex(M.kerb[0], M.kerb[1]), roughness: 0.6, side: THREE.DoubleSide });
  if (M.night) { kerbMat.emissiveMap = kerbMat.map; kerbMat.emissive.set(0xffffff); kerbMat.emissiveIntensity = 0.6; }
  ribbon(hw + 1.4, hw - 0.1, 0.04, 0.04, kerbMat, 3);
  ribbon(-hw + 0.1, -hw - 1.4, 0.04, 0.04, kerbMat, 3);
  const barMat = new THREE.MeshStandardMaterial({ map: stripeTex(M.barrier[0], M.barrier[1]), roughness: 0.5, side: THREE.DoubleSide });
  if (M.night) { barMat.emissiveMap = barMat.map; barMat.emissive.set(0xffffff); barMat.emissiveIntensity = 1.2; }
  ribbon(BR, BR, 0, 1.3, barMat, 6);
  ribbon(-BR, -BR, 0, 1.3, barMat, 6);

  // Ligne de départ + portique
  const start = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 2.5).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: checkerTex(), roughness: 0.8 }));
  start.position.copy(track.pts[0]).setY(0.035); start.rotation.y = track.yaw[0]; start.receiveShadow = true; world.add(start);
  const gant = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x888c94, metalness: 0.7, roughness: 0.35 });
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), metal); p.position.set(s * (hw + 3), 4, 0); p.castShadow = true; gant.add(p); }
  const st = signTex(M.sign, M.night);
  const signMat = new THREE.MeshStandardMaterial({ map: st, emissiveMap: st, emissive: 0xffffff, emissiveIntensity: M.night ? 1.5 : 0.35 });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2 * (hw + 3) + 0.8, 2.2, 0.8), [metal, metal, metal, metal, signMat, signMat]);
  beam.position.y = 8.6; beam.castShadow = true; gant.add(beam);
  gant.position.copy(track.pts[0]); gant.rotation.y = track.yaw[0]; world.add(gant);

  buildScenery(M, r);
  buildMini();
  clearSkids();
}

function buildScenery(M, r) {
  const b = track.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const col = (h, s, l) => new THREE.Color().setHSL(h, s, l);
  const ring = (n, d0, d1) => Array.from({ length: n }, (_, i) => { const a = i / n * TAU + r() * 0.3, d = d0 + r() * (d1 - d0); return { x: cx + Math.sin(a) * d, z: cz + Math.cos(a) * d }; });

  const mountains = (n, color, capColor) => {
    const list = ring(n, 560, 720).map(p => { const rad = 90 + r() * 90, h = 110 + r() * 160; return { ...p, r: r() * TAU, sx: rad, sy: h, sz: rad }; });
    inst(new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 }), list, false);
    if (capColor) inst(new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: capColor, flatShading: true, roughness: 0.9 }),
      list.map(m => ({ x: m.x, z: m.z, r: m.r, y: m.sy * 0.62, sx: m.sx * 0.39, sy: m.sy * 0.39, sz: m.sx * 0.39 })), false);
  };
  const clouds = n => {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff }), geo = new THREE.IcosahedronGeometry(1, 1);
    const list = [];
    for (let i = 0; i < n; i++) {
      const c = new THREE.Group();
      for (let j = 0; j < 4; j++) { const m = new THREE.Mesh(geo, mat); m.position.set((j - 1.5) * 14 + r() * 6, r() * 5, r() * 8); m.scale.set(12 + r() * 8, 7 + r() * 4, 10 + r() * 6); c.add(m); }
      c.position.set(cx + (r() - 0.5) * 1400, 120 + r() * 60, cz + (r() - 0.5) * 1400);
      world.add(c); list.push(c);
    }
    world.userData.clouds = list; world.userData.cx = cx;
  };
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 2, 6).translate(0, 1, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 1 });

  if (M.scenery === 'gp') {
    // Tribune avec public
    const k = 18, n = track.nor[k], p = track.pts[k];
    const stand = new THREE.Group();
    stand.position.set(p.x + n.x * (BR + 4), 0, p.z + n.z * (BR + 4));
    stand.rotation.y = Math.atan2(n.x, n.z);
    const concrete = new THREE.MeshStandardMaterial({ color: 0xbfc3c9, roughness: 0.9 });
    for (let t = 0; t < 4; t++) { const s = new THREE.Mesh(new THREE.BoxGeometry(40, t + 1, 3), concrete); s.position.set(0, (t + 1) / 2, t * 3 + 1.5); s.castShadow = s.receiveShadow = true; stand.add(s); }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(42, 0.3, 13), new THREE.MeshStandardMaterial({ color: 0xd81e1e, roughness: 0.6 }));
    roof.position.set(0, 7.5, 6); roof.castShadow = true; stand.add(roof);
    for (const x of [-20, 20]) { const pl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7.5, 0.4), concrete); pl.position.set(x, 3.75, 12); stand.add(pl); }
    const people = [];
    for (let t = 0; t < 4; t++) for (let x = -19; x <= 19; x += 0.8) if (r() < 0.85) people.push({ x: x + (r() - 0.5) * 0.3, y: t + 1, z: t * 3 + 1.5 + (r() - 0.5), c: col(r(), 0.7, 0.5) });
    const crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.9, 0.4).translate(0, 0.45, 0), new THREE.MeshStandardMaterial({ color: 0xffffff }), people.length);
    people.forEach((o, i) => { dummy.position.set(o.x, o.y, o.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); crowd.setMatrixAt(i, dummy.matrix); crowd.setColorAt(i, o.c); });
    stand.add(crowd); world.add(stand);
    const sp = stand.position;

    const trees = scatter(r, 260, BR + 6, 170, (x, z) => (x - sp.x) ** 2 + (z - sp.z) ** 2 < 45 * 45);
    const cones = [], rounds = [];
    trees.forEach(p => (r() < 0.5 ? cones : rounds).push({ ...p, s: 0.8 + r() * 0.8, r: r() * TAU, c: col(0.25 + r() * 0.1, 0.55, 0.22 + r() * 0.1) }));
    inst(trunkGeo, trunkMat, trees.map((p, i) => ({ ...p, s: 1 + (i % 3) * 0.2 })));
    const leaf = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.9 });
    inst(new THREE.ConeGeometry(2, 5, 7).translate(0, 4.4, 0), leaf, cones);
    inst(new THREE.IcosahedronGeometry(2.4, 0).translate(0, 3.8, 0), leaf, rounds);
    mountains(16, 0x5f7a5a, 0xffffff);
    clouds(18);
  }

  if (M.scenery === 'desert') {
    const cacti = scatter(r, 140, BR + 5, 170).map(p => ({ ...p, sy: 3 + r() * 4, r: r() * TAU }));
    const cactusMat = new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 0.8 });
    inst(new THREE.CylinderGeometry(0.45, 0.5, 1, 8).translate(0, 0.5, 0), cactusMat, cacti);
    inst(new THREE.CylinderGeometry(0.3, 0.3, 1.8, 8).translate(0.85, 2.4, 0), cactusMat, cacti.map(c => ({ ...c, sy: 1 })));
    inst(new THREE.BoxGeometry(0.9, 0.4, 0.4).translate(0.45, 1.6, 0), cactusMat, cacti.map(c => ({ ...c, sy: 1 })));
    const rocks = scatter(r, 110, BR + 4, 170).map(p => ({ ...p, sx: 1 + r() * 3, sy: 0.8 + r() * 2, sz: 1 + r() * 3, r: r() * TAU, c: col(0.06 + r() * 0.03, 0.45, 0.35 + r() * 0.15) }));
    inst(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1 }), rocks);
    const mesas = ring(10, 520, 680).map(p => { const rad = 60 + r() * 70; return { ...p, sx: rad, sy: 40 + r() * 60, sz: rad, r: r() * TAU }; });
    inst(new THREE.CylinderGeometry(1, 1.2, 1, 9).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0xb5562b, flatShading: true, roughness: 1 }), mesas, false);
    clouds(5);
  }

  if (M.scenery === 'city') {
    const blds = [];
    let tries = 0;
    while (blds.length < 200 && tries++ < 2000) {
      const w = 12 + r() * 18, d = 12 + r() * 18, h = 15 + r() * 80;
      const x = b.minX - 220 + r() * (b.maxX - b.minX + 440), z = b.minZ - 220 + r() * (b.maxZ - b.minZ + 440);
      if (farFromTrack(x, z, BR + 6 + Math.max(w, d) * 0.75)) blds.push({ x, z, sx: w, sy: h, sz: d, r: 0 });
    }
    const wt = windowTex(); wt.repeat.set(2, 3);
    inst(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      new THREE.MeshStandardMaterial({ color: 0x2a2a3a, map: wt, emissiveMap: wt, emissive: 0xffffff, emissiveIntensity: 1.4, roughness: 0.6, metalness: 0.3 }), blds);
    const poles = [], heads = [];
    for (let k = 0; k < track.N; k += 16) for (const s of [-1, 1]) {
      const p = track.pts[k], n = track.nor[k];
      const x = p.x + n.x * s * (BR + 1.5), z = p.z + n.z * s * (BR + 1.5);
      poles.push({ x, z }); heads.push({ x, z, y: 8, c: new THREE.Color(k % 32 ? 0xff2bd6 : 0x20e8ff) });
    }
    inst(new THREE.CylinderGeometry(0.12, 0.16, 8, 6).translate(0, 4, 0), new THREE.MeshStandardMaterial({ color: 0x333344, metalness: 0.8, roughness: 0.4 }), poles);
    const hm = inst(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.5 }), heads, false);
    if (hm) hm.material.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive * vColor;'); };
    // Arches néon
    for (let i = 0; i < 10; i++) {
      const k = Math.floor(i * track.N / 10) + 40, kk = k % track.N;
      const c = i % 2 ? 0x20e8ff : 0xff2bd6;
      const a = new THREE.Mesh(new THREE.TorusGeometry(hw + 4, 0.3, 8, 48, Math.PI), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 3 }));
      a.position.copy(track.pts[kk]); a.rotation.y = track.yaw[kk]; world.add(a);
    }
    // Etoiles
    const sp = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) { const a = Math.random() * TAU, e = Math.random() * 1.3 + 0.12; sp[i * 3] = Math.cos(e) * Math.sin(a) * 1400; sp[i * 3 + 1] = Math.sin(e) * 1400; sp[i * 3 + 2] = Math.cos(e) * Math.cos(a) * 1400; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false }));
    stars.frustumCulled = false; world.add(stars); world.userData.stars = stars;
  }

  if (M.scenery === 'snow') {
    const pines = scatter(r, 300, BR + 5, 170).map(p => ({ ...p, s: 0.8 + r() * 0.9, r: r() * TAU }));
    inst(trunkGeo, trunkMat, pines);
    inst(new THREE.ConeGeometry(2.4, 6, 7).translate(0, 4.5, 0), new THREE.MeshStandardMaterial({ color: 0x1f4a2e, flatShading: true, roughness: 0.9 }), pines);
    inst(new THREE.ConeGeometry(1.3, 2.6, 7).translate(0, 6.8, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.8 }), pines);
    mountains(18, 0x8d9db0, 0xffffff);
    clouds(10);
    const n = 2500, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = (Math.random() - 0.5) * 160; arr[i * 3 + 1] = Math.random() * 40; arr[i * 3 + 2] = (Math.random() - 0.5) * 160; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const snow = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.45, map: smokeTex, transparent: true, depthWrite: false }));
    snow.frustumCulled = false; world.add(snow); world.userData.snow = snow;
  }
}

let animT = 0;
function updateWorldAnim(dt) {
  animT += dt;
  const u = world.userData;
  if (u.clouds) for (const c of u.clouds) { c.position.x += dt * 3; if (c.position.x > u.cx + 700) c.position.x -= 1400; }
  if (u.stars) u.stars.position.copy(camera.position);
  if (u.snow) {
    const a = u.snow.geometry.attributes.position, arr = a.array, cx = camera.position.x, cz = camera.position.z;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] -= dt * (3 + (i % 5)); arr[i] += Math.sin(animT + i) * dt * 0.8;
      if (arr[i + 1] < 0) arr[i + 1] += 40;
      if (arr[i] - cx > 80) arr[i] -= 160; else if (arr[i] - cx < -80) arr[i] += 160;
      if (arr[i + 2] - cz > 80) arr[i + 2] -= 160; else if (arr[i + 2] - cz < -80) arr[i + 2] += 160;
    }
    a.needsUpdate = true;
  }
}

// =============================================================
//  MODELE DE VOITURE
// =============================================================
let carObj = null;
function makeCar(def, color) {
  const g = new THREE.Group(), ch = new THREE.Group(); g.add(ch);
  const B = def.body, C = def.cabin, R = 0.4, base = R + 0.05;
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 });
  const black = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.7 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a1622, metalness: 0.3, roughness: 0.05, clearcoat: 1 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xcfd3da, metalness: 1, roughness: 0.2 });
  const add = (geo, mat, x, y, z, parent = ch) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };

  add(new THREE.BoxGeometry(B.w, B.h, B.l), paint, 0, base + B.h / 2, 0);
  add(new THREE.BoxGeometry(B.w * 0.98, B.h * 0.55, 0.6), paint, 0, base + B.h * 0.28, B.l / 2 + 0.28);
  add(new THREE.BoxGeometry(B.w * 1.02, 0.18, B.l * 0.98), black, 0, base + 0.05, 0);
  add(new THREE.BoxGeometry(C.w, C.h, C.l), glass, 0, base + B.h + C.h / 2, C.z);
  add(new THREE.BoxGeometry(C.w * 0.92, 0.06, C.l * 0.75), paint, 0, base + B.h + C.h + 0.02, C.z);
  add(new THREE.BoxGeometry(0.32, 0.02, B.l), new THREE.MeshStandardMaterial({ color: def.stripe, roughness: 0.4 }), 0, base + B.h + 0.012, 0);
  if (def.scoop) add(new THREE.BoxGeometry(0.7, 0.18, 1.0), black, 0, base + B.h + 0.09, B.l / 2 - 0.9);
  if (def.spoiler > 0) {
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.08, def.spoiler, 0.15), black, s * 0.6, base + B.h + def.spoiler / 2, -B.l / 2 + 0.3);
    add(new THREE.BoxGeometry(B.w * 0.95, 0.06, 0.5), paint, 0, base + B.h + def.spoiler, -B.l / 2 + 0.3);
  }
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 2 });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1010, emissiveIntensity: 0.6 });
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.42, 0.14, 0.05), headMat, s * (B.w / 2 - 0.35), base + B.h * 0.4, B.l / 2 + 0.58);
    add(new THREE.BoxGeometry(0.5, 0.12, 0.05), brakeMat, s * (B.w / 2 - 0.35), base + B.h * 0.7, -B.l / 2 - 0.02);
  }
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const flames = [];
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8).rotateX(Math.PI / 2), chrome, s * 0.45, base + 0.15, -B.l / 2 - 0.1);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.9, 8).rotateX(-Math.PI / 2), flameMat);
    f.position.set(s * 0.45, base + 0.15, -B.l / 2 - 0.65); f.visible = false; ch.add(f); flames.push(f);
  }
  const tireGeo = new THREE.CylinderGeometry(R, R, 0.34, 22).rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(R * 0.62, R * 0.62, 0.36, 10).rotateZ(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.37, 0.1, R * 1.1);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  const wheels = [], fronts = [];
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * (B.w / 2 - 0.08), R, sz * (B.l / 2 - 0.8)); g.add(pivot);
    const w = new THREE.Group(); pivot.add(w);
    const t = new THREE.Mesh(tireGeo, tireMat); t.castShadow = true; w.add(t);
    w.add(new THREE.Mesh(rimGeo, chrome)); w.add(new THREE.Mesh(spokeGeo, chrome));
    wheels.push(w); if (sz > 0) fronts.push(pivot);
  }
  const spot = new THREE.SpotLight(0xfff2d0, 0, 90, 0.55, 0.5, 1.2);
  spot.position.set(0, base + 0.5, B.l / 2); spot.target.position.set(0, 0, 25); g.add(spot, spot.target);
  return { g, ch, wheels, fronts, brakeMat, flames, spot, R, paint };
}
function rebuildCar() {
  if (carObj) { scene.remove(carObj.g); disposeObj(carObj.g); }
  carObj = makeCar(CARS[S.carI], curColor());
  carObj.spot.intensity = MAPS[S.mapI].night ? 60 : 0;
  scene.add(carObj.g);
  syncCarMesh();
}
function syncCarMesh() {
  carObj.g.position.set(car.pos.x, 0, car.pos.z);
  carObj.g.rotation.y = car.heading;
}

// =============================================================
//  PHYSIQUE ET DRIFT (style arcade, facile à prendre en main)
// =============================================================
function trackLocate(full) {
  const N = track.N; let best = car.idx, bd = Infinity;
  const from = full ? 0 : -40, to = full ? N - 1 : 40;
  for (let j = from; j <= to; j++) {
    const k = full ? j : (car.idx + j + N) % N, p = track.pts[k];
    const d = (p.x - car.pos.x) ** 2 + (p.z - car.pos.z) ** 2;
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}
const lateral = () => { const p = track.pts[car.idx], n = track.nor[car.idx]; return (car.pos.x - p.x) * n.x + (car.pos.z - p.z) * n.z; };
const levelTimes = () => [0.55, 1.4, 2.4].map(v => v * [1.15, 1, 0.8][S.assist]);

function startDrift(steer) {
  car.drifting = true; car.driftDir = Math.sign(steer); car.driftTime = 0; car.driftPts = 0; car.level = 0; car.hop = 0.22;
  if (!race.firstDrift) { race.firstDrift = true; hint(''); }
}
function endDrift(ok) {
  car.drifting = false;
  const pts = Math.round(car.driftPts * race.chain);
  if (ok && pts > 0) {
    race.driftTotal += pts;
    if (car.level > 0) {
      car.boost = Math.max(car.boost, [0, 0.8, 1.3, 2.0][car.level]);
      flash((car.level === 3 ? 'TURBO MAX ! +' : 'TURBO ! +') + pts, 900, 'boost' + car.level);
      race.shake = Math.max(race.shake, 0.15);
    }
    race.chain = Math.min(5, race.chain + 1); race.chainTimer = 3;
  } else if (!ok && pts > 50) { flash('Drift raté…', 900, 'fail'); race.chain = 1; }
  car.driftPts = 0; car.level = 0; car.driftTime = 0;
}

function updateCar(dt) {
  const D = CARS[S.carI], M = MAPS[S.mapI], A = S.assist;
  const canDrive = race.countdown <= 0 && !race.finished;
  const up = canDrive && keys.up, down = canDrive && keys.down;
  const steer = canDrive ? (keys.left ? 1 : 0) - (keys.right ? 1 : 0) : 0;
  car.offroad = Math.abs(lateral()) > track.halfW + 1.4;
  const boostOn = car.boost > 0;
  const maxS = D.maxS * (boostOn ? 1.22 : 1) * (car.offroad ? 0.55 : 1);
  const grip = D.grip * M.grip * (car.offroad ? 0.6 : 1);

  // Début / fin du drift
  if (canDrive && keys.drift && !car.drifting && car.speed > 11 && steer !== 0) startDrift(steer);
  if (car.drifting) {
    if (!canDrive) endDrift(true);
    else if (down) { car.level = 0; endDrift(true); }
    else if (!keys.drift || car.speed < 7) endDrift(true);
  }

  if (car.drifting) {
    const inner = steer * car.driftDir; // 1 = vers l'intérieur, -1 = contre-braquage
    const sf = 0.75 + 0.25 * clamp(car.speed / 30, 0, 1);
    const turn = car.driftDir * (A === 0 ? 0.55 + 0.65 * inner : 0.62 + 0.5 * inner) * D.drift * sf;
    car.moveDir += turn * dt;
    if (A === 2) { // aide forte : la trajectoire suit la route
      const err = angDiff(track.yaw[(car.idx + 12) % track.N], car.moveDir);
      car.moveDir += clamp(err, -0.6, 0.6) * 1.6 * dt;
    }
    const target = car.driftDir * (A === 0 ? 0.5 + 0.3 * inner : 0.48 + 0.18 * inner);
    car.driftAngle += (target - car.driftAngle) * damp(A === 0 ? 4 : 6, dt);
    car.heading = car.moveDir + car.driftAngle;
    if (up) car.speed += D.accel * 0.6 * dt; else car.speed -= 4 * dt;
    car.speed = Math.min(car.speed, maxS * 0.96);
    if (!car.offroad) {
      car.driftTime += dt;
      car.driftPts += car.speed * Math.abs(car.driftAngle) * dt * 6 * (A === 0 ? 1.5 : 1);
    }
    const th = levelTimes();
    if (car.level < 3 && car.driftTime >= th[car.level]) {
      car.level++;
      if (car.level === 3) { flash('SUPER DRIFT !', 900, 'super'); race.shake = 0.3; }
    }
  } else {
    if (up) car.speed += (boostOn ? D.accel * 1.8 : D.accel) * (1 - 0.6 * Math.max(0, car.speed) / maxS) * dt;
    else if (down) car.speed -= (car.speed > 0.5 ? 28 : D.accel * 0.6) * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), (3.5 + 0.004 * car.speed * car.speed) * dt);
    if (car.speed > maxS) car.speed -= Math.min(car.speed - maxS, 25 * dt);
    car.speed = Math.max(car.speed, -D.maxS * 0.3);
    const sp = Math.abs(car.speed);
    const sf = clamp(sp / 10, 0, 1) * (1 - 0.4 * clamp(sp / D.maxS, 0, 1));
    car.heading += steer * D.steer * sf * (car.speed < 0 ? -1 : 1) * dt;
    const slip = angDiff(car.heading, car.moveDir);
    car.moveDir += slip * damp(grip, dt);
    car.heading -= slip * damp(grip * 0.15, dt);
    car.driftAngle *= 1 - damp(8, dt);
  }
  car.boost = Math.max(0, car.boost - dt);

  // Déplacement
  car.pos.x += Math.sin(car.moveDir) * car.speed * dt;
  car.pos.z += Math.cos(car.moveDir) * car.speed * dt;
  const prev = car.idx;
  car.idx = trackLocate(false);

  // Barrières
  const lat = lateral(), lim = BR - 1.2;
  if (Math.abs(lat) > lim) {
    const n = track.nor[car.idx], push = lat - Math.sign(lat) * lim;
    car.pos.x -= n.x * push; car.pos.z -= n.z * push;
    let ty = track.yaw[car.idx];
    if (Math.abs(angDiff(ty, car.moveDir)) > Math.PI / 2) ty += Math.PI;
    car.moveDir += angDiff(ty, car.moveDir) * 0.5;
    car.heading += angDiff(car.moveDir, car.heading) * 0.3;
    car.speed *= 1 - damp(2.5, dt);
    if (!car.wallHit) { car.wallHit = true; car.speed *= 0.8; race.shake = Math.max(race.shake, 0.25); if (car.drifting) { car.driftPts = Math.min(car.driftPts, 0); car.level = 0; } }
  } else car.wallHit = false;

  // Tours
  const N = track.N;
  car.quarters |= 1 << Math.floor(car.idx * 4 / N);
  if (prev > N * 0.75 && car.idx < N * 0.25) { if (car.quarters === 15 && canDrive) lapDone(); car.quarters = 1; }
  else if (prev < N * 0.25 && car.idx > N * 0.75) car.quarters = 0;

  effects(dt, M);
}

const toWorld = (lx, lz) => { const c = Math.cos(car.heading), s = Math.sin(car.heading); return [car.pos.x + lx * c + lz * s, car.pos.z - lx * s + lz * c]; };
function effects(dt, M) {
  const sp = Math.abs(car.speed), slip = Math.abs(angDiff(car.heading, car.moveDir));
  const B = CARS[S.carI].body;
  const rl = toWorld(B.w / 2 - 0.1, -B.l / 2 + 0.8), rr = toWorld(-B.w / 2 + 0.1, -B.l / 2 + 0.8);
  const sliding = (car.drifting || slip > 0.15) && sp > 7;
  if (sliding && !car.offroad) {
    car.skidAcc += sp * dt;
    if (car.skidAcc > 0.55) { car.skidAcc = 0; addSkid(rl[0], rl[1], car.heading); addSkid(rr[0], rr[1], car.heading); }
    for (const w of [rl, rr]) if (Math.random() < 0.6) emit(w[0], 0.4, w[1], (Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2, M.smoke, 1.2, 1.1, 2.5, 0.45, false);
  }
  if (car.offroad && sp > 5) for (const w of [rl, rr]) if (Math.random() < 0.5) emit(w[0], 0.3, w[1], (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, M.dust, 1, 0.9, 2, 0.6, false);
  if (car.drifting && car.level > 0) {
    const colr = ['#ffffff', '#3ab0ff', '#ff8a00', '#c04bff'][car.level];
    for (const w of [rl, rr]) for (let i = 0; i < car.level; i++) emit(w[0], 0.25, w[1], (Math.random() - 0.5) * 6, 1 + Math.random() * 3, (Math.random() - 0.5) * 6, colr, 0.35, 0.3, -0.5, 1, true);
  }
  if (car.boost > 0) { const ex = toWorld(0, -B.l / 2 - 0.8); emit(ex[0], 0.6, ex[1], 0, 0.5, 0, '#ff7a1a', 0.6, 0.25, 1, 0.8, true); }
}

// =============================================================
//  COURSE
// =============================================================
function lapDone() {
  const lt = race.t - race.lapStart;
  race.lapStart = race.t; race.lapsDone++;
  if (lt < race.bestLap) race.bestLap = lt;
  if (race.lapsDone >= S.laps) finish();
  else flash(race.lapsDone === S.laps - 1 ? 'DERNIER TOUR !' : `TOUR ${race.lapsDone + 1}/${S.laps}`, 1400, 'lap');
}
function finish() {
  if (car.drifting) endDrift(true);
  race.finished = true;
  const M = MAPS[S.mapI], tk = `time_${M.id}_${S.laps}`, dk = 'drift_' + M.id;
  const bt = LS.get(tk, null), bd = LS.get(dk, 0);
  const newT = bt === null || race.t < bt, newD = race.driftTotal > bd;
  if (newT) LS.set(tk, race.t);
  if (newD) LS.set(dk, race.driftTotal);
  flash('ARRIVÉE !', 1500, 'go');
  const myRace = race.id;
  setTimeout(() => { if (race.id === myRace && race.finished && S.mode === 'race') showEnd(newT, newD); }, 1600);
}
function showEnd(newT, newD) {
  const rec = ' <em>RECORD !</em>';
  $('endStats').innerHTML =
    `<div><span>Circuit</span><b>${MAPS[S.mapI].name}</b></div>` +
    `<div><span>Voiture</span><b>${CARS[S.carI].name}</b></div>` +
    `<div><span>Temps total</span><b>${fmt(race.t)}${newT ? rec : ''}</b></div>` +
    `<div><span>Meilleur tour</span><b>${fmt(race.bestLap)}</b></div>` +
    `<div><span>Score drift</span><b>${race.driftTotal}${newD ? rec : ''}</b></div>`;
  $('end').classList.remove('hidden'); $('touch').classList.add('hidden');
}

function resetCarPos() {
  const k = track.N - 10;
  car.idx = k; car.pos.copy(track.pts[k]);
  car.heading = car.moveDir = car.prevMove = track.yaw[k];
  Object.assign(car, { speed: 0, prevSpeed: 0, drifting: false, driftAngle: 0, driftTime: 0, driftPts: 0, level: 0, boost: 0, hop: 0, steerVis: 0, roll: 0, pitch: 0, quarters: 0, skidAcc: 0, wallHit: false });
  cam.yaw = car.heading; cam.dist = 7;
  clearSkids();
  if (carObj) syncCarMesh();
}
function resetRace() {
  resetCarPos();
  Object.assign(race, { id: (race.id || 0) + 1, t: 0, lapStart: 0, lapsDone: 0, bestLap: Infinity, driftTotal: 0, chain: 1, chainTimer: 0, countdown: 3, finished: false, shake: 0 });
  $('driftBest').textContent = LS.get('drift_' + MAPS[S.mapI].id, 0);
  flash('3', 900, 'cd');
  if (!race.firstDrift) hint(isTouch ? 'Astuce : tourne + maintiens DRIFT dans les virages, lâche pour le turbo !' : 'Astuce : tourne + maintiens ESPACE dans les virages, lâche pour le turbo !');
}

function updateRace(dt) {
  if (race.countdown > 0) {
    const before = Math.ceil(race.countdown);
    race.countdown -= dt;
    if (race.countdown <= 0) flash('GO !', 800, 'go');
    else if (Math.ceil(race.countdown) !== before) flash(String(Math.ceil(race.countdown)), 900, 'cd');
  } else if (!race.finished) race.t += dt;
  updateCar(dt);
  if (race.chainTimer > 0 && !car.drifting) { race.chainTimer -= dt; if (race.chainTimer <= 0) race.chain = 1; }
  updateCarVisual(dt);
  updateCamera(dt);
  updateHUD(dt);
}

function updateCarVisual(dt) {
  const o = carObj, D = CARS[S.carI];
  let y = 0;
  if (car.hop > 0) { car.hop -= dt; y = Math.sin(Math.PI * (1 - Math.max(car.hop, 0) / 0.22)) * 0.35; }
  o.g.position.set(car.pos.x, y, car.pos.z);
  o.g.rotation.y = car.heading;
  const yawRate = angDiff(car.moveDir, car.prevMove) / Math.max(dt, 1e-4); car.prevMove = car.moveDir;
  const acc = (car.speed - car.prevSpeed) / Math.max(dt, 1e-4); car.prevSpeed = car.speed;
  car.roll += (clamp(yawRate * Math.abs(car.speed) * 0.0035, -0.09, 0.09) - car.roll) * damp(6, dt);
  car.pitch += (clamp(-acc * 0.004, -0.05, 0.05) - car.pitch) * damp(6, dt);
  o.ch.rotation.set(car.pitch, 0, car.roll);
  const spin = car.speed * dt / o.R;
  o.wheels.forEach(w => w.rotation.x += spin);
  const canDrive = race.countdown <= 0 && !race.finished;
  const steer = canDrive ? (keys.left ? 1 : 0) - (keys.right ? 1 : 0) : 0;
  const st = car.drifting ? -car.driftAngle * 0.8 + steer * 0.1 : steer * 0.42;
  car.steerVis += (st - car.steerVis) * damp(10, dt);
  o.fronts.forEach(p => p.rotation.y = car.steerVis);
  o.brakeMat.emissiveIntensity = canDrive && keys.down ? 3 : 0.6;
  o.flames.forEach(f => { f.visible = car.boost > 0; f.scale.set(1, 1, 0.7 + Math.random() * 0.7); });
}

const look = new V3();
function updateCamera(dt) {
  const sp = Math.abs(car.speed);
  cam.yaw += angDiff(car.moveDir + car.driftAngle * 0.3, cam.yaw) * damp(car.drifting ? 3 : 5, dt);
  cam.dist += (7 + sp * 0.035 + (car.boost > 0 ? 1.2 : 0) - cam.dist) * damp(3, dt);
  camera.position.set(car.pos.x - Math.sin(cam.yaw) * cam.dist, 2.6 + sp * 0.012, car.pos.z - Math.cos(cam.yaw) * cam.dist);
  if (race.shake > 0) { race.shake -= dt; const s = Math.max(race.shake, 0) * 0.6; camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s; }
  look.set(car.pos.x + Math.sin(cam.yaw) * 4, 1.1, car.pos.z + Math.cos(cam.yaw) * 4);
  camera.lookAt(look);
  cam.fov += (62 + sp * 0.12 + (car.boost > 0 ? 8 : 0) - cam.fov) * damp(4, dt);
  camera.fov = cam.fov; camera.updateProjectionMatrix();
}
function menuCam(dt) {
  cam.orbit += dt * 0.25;
  camera.position.set(car.pos.x + Math.sin(cam.orbit) * 9, 3.2, car.pos.z + Math.cos(cam.orbit) * 9);
  camera.lookAt(car.pos.x, 0.8, car.pos.z);
  camera.fov = 50; camera.updateProjectionMatrix();
  carObj.g.position.set(car.pos.x, 0, car.pos.z); carObj.ch.rotation.set(0, 0, 0);
}

// =============================================================
//  HUD, MINI-CARTE, MESSAGES
// =============================================================
const mini = { path: null, s: 1, mx: 0, mz: 0 }, mctx = $('minimap').getContext('2d');
const mm = (x, z) => [90 - (x - mini.mx) * mini.s, 90 - (z - mini.mz) * mini.s];
function buildMini() {
  const b = track.bounds;
  mini.s = 150 / Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
  mini.mx = (b.minX + b.maxX) / 2; mini.mz = (b.minZ + b.maxZ) / 2;
  const p = new Path2D();
  track.pts.forEach((q, i) => { const [x, y] = mm(q.x, q.z); i ? p.lineTo(x, y) : p.moveTo(x, y); });
  p.closePath(); mini.path = p;
}
function drawMini() {
  mctx.clearRect(0, 0, 180, 180);
  mctx.fillStyle = 'rgba(0,0,0,.45)'; mctx.beginPath(); mctx.arc(90, 90, 89, 0, TAU); mctx.fill();
  mctx.lineJoin = 'round';
  mctx.strokeStyle = 'rgba(255,255,255,.25)'; mctx.lineWidth = 9; mctx.stroke(mini.path);
  mctx.strokeStyle = '#fff'; mctx.lineWidth = 3; mctx.stroke(mini.path);
  const [sx, sy] = mm(track.pts[0].x, track.pts[0].z);
  mctx.fillStyle = '#3dff6a'; mctx.fillRect(sx - 4, sy - 4, 8, 8);
  const [x, y] = mm(car.pos.x, car.pos.z);
  mctx.fillStyle = curColor(); mctx.strokeStyle = '#000'; mctx.lineWidth = 2;
  mctx.beginPath(); mctx.arc(x, y, 6, 0, TAU); mctx.fill(); mctx.stroke();
}
let msgT = 0;
function flash(text, ms = 1000, cls = '') { const m = $('msg'); m.textContent = text; m.className = ''; void m.offsetWidth; m.className = 'show ' + cls; msgT = ms / 1000; }
let hintT = 0;
function hint(text) { const h = $('hint'); h.textContent = text; h.classList.toggle('show', !!text); hintT = text ? 8 : 0; }
function updateHUD(dt) {
  $('lap').textContent = `${Math.min(race.lapsDone + 1, S.laps)}/${S.laps}`;
  $('time').textContent = fmt(race.t);
  $('bestLap').textContent = fmt(race.bestLap);
  $('driftTotal').textContent = race.driftTotal;
  $('speed').textContent = Math.round(Math.abs(car.speed) * 3.6);
  $('boostFill').style.width = Math.min(100, car.boost / 2 * 100) + '%';
  const dp = $('driftPop');
  if (car.drifting) {
    dp.classList.add('show'); dp.dataset.lvl = car.level;
    $('driftPts').textContent = Math.round(car.driftPts);
    $('driftMul').textContent = 'x' + race.chain;
    $('driftLvl').textContent = ['DRIFT', 'NIVEAU 1', 'NIVEAU 2', 'SUPER DRIFT'][car.level];
  } else dp.classList.remove('show');
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('msg').className = ''; }
  if (hintT > 0) { hintT -= dt; if (hintT <= 0) hint(''); }
  drawMini();
}

// =============================================================
//  MENU ET NAVIGATION
// =============================================================
function buildMenu() {
  $('mapList').innerHTML = MAPS.map((m, i) => {
    const bt = LS.get(`time_${m.id}_${S.laps}`, null), bd = LS.get('drift_' + m.id, 0);
    return `<button class="card${i === S.mapI ? ' on' : ''}" data-i="${i}"><span class="emo">${m.emoji}</span><b>${m.name}</b><small>${m.desc}</small><small class="rec">🏆 ${bt === null ? '--' : fmt(bt)} · 💨 ${bd}</small></button>`;
  }).join('');
  const labels = ['Vitesse', 'Accélération', 'Maniabilité', 'Drift'];
  $('carList').innerHTML = CARS.map((c, i) =>
    `<button class="card${i === S.carI ? ' on' : ''}" data-i="${i}"><b>${c.name}</b><small>${c.desc}</small>` +
    labels.map((l, k) => `<div class="stat"><span>${l}</span><i><b style="width:${c.stats[k] * 20}%"></b></i></div>`).join('') + '</button>').join('');
  $('colorList').innerHTML = COLORS.map(c => `<button class="sw${c === curColor() ? ' on' : ''}" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('');
  for (const [id, v] of [['lapsSeg', S.laps], ['assistSeg', S.assist]])
    $(id).querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.v === v));
}
$('mapList').addEventListener('click', e => {
  const b = e.target.closest('.card'); if (!b) return;
  S.mapI = +b.dataset.i; saveSettings(); buildWorld(); resetCarPos(); rebuildCar(); buildMenu();
});
$('carList').addEventListener('click', e => {
  const b = e.target.closest('.card'); if (!b) return;
  S.carI = +b.dataset.i; S.color = null; saveSettings(); rebuildCar(); buildMenu();
});
$('colorList').addEventListener('click', e => {
  const b = e.target.closest('.sw'); if (!b) return;
  S.color = b.dataset.c; saveSettings(); rebuildCar(); buildMenu();
});
$('lapsSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.laps = +b.dataset.v; saveSettings(); buildMenu(); });
$('assistSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.assist = +b.dataset.v; saveSettings(); buildMenu(); });

function startRace() {
  S.mode = 'race';
  ['menu', 'end', 'pause'].forEach(id => $(id).classList.add('hidden'));
  $('hud').classList.remove('hidden');
  $('touch').classList.toggle('hidden', !isTouch);
  document.activeElement?.blur();
  resetRace();
}
function toMenu() {
  S.mode = 'menu';
  ['hud', 'touch', 'pause', 'end'].forEach(id => $(id).classList.add('hidden'));
  $('menu').classList.remove('hidden');
  race.finished = true; resetCarPos(); buildMenu();
}
function togglePause() {
  if (S.mode === 'race' && !race.finished) { S.mode = 'pause'; $('pause').classList.remove('hidden'); }
  else if (S.mode === 'pause') { S.mode = 'race'; $('pause').classList.add('hidden'); }
}
$('playBtn').onclick = startRace;
$('resumeBtn').onclick = togglePause;
$('restartBtn').onclick = startRace;
$('menuBtn').onclick = toMenu;
$('againBtn').onclick = startRace;
$('endMenuBtn').onclick = toMenu;
$('pauseBtn').onclick = togglePause;

// Clavier (e.code : marche en AZERTY avec ZQSD et en QWERTY avec WASD)
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'drift', ShiftLeft: 'drift', ShiftRight: 'drift' };
addEventListener('keydown', e => {
  const k = KEYMAP[e.code];
  if (k) { keys[k] = true; if (S.mode !== 'menu') e.preventDefault(); }
  if (e.repeat) return;
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (S.mode === 'race' || S.mode === 'pause')) startRace();
  if (e.code === 'KeyC' && S.mode === 'race') { const i = (COLORS.indexOf(curColor()) + 1) % COLORS.length; S.color = COLORS[i]; saveSettings(); rebuildCar(); }
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// Tactile
document.querySelectorAll('#touch [data-k]').forEach(b => {
  const k = b.dataset.k;
  const on = e => { e.preventDefault(); keys[k] = true; b.classList.add('on'); };
  const off = e => { e.preventDefault(); keys[k] = false; b.classList.remove('on'); };
  b.addEventListener('pointerdown', on);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, off));
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (composer) { composer.setSize(innerWidth, innerHeight); bloom.resolution.set(innerWidth, innerHeight); }
});

// =============================================================
//  BOUCLE PRINCIPALE
// =============================================================
buildWorld();
resetCarPos();
rebuildCar();
buildMenu();
$('loading').classList.add('hidden');

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (S.mode === 'race') updateRace(dt);
  else if (S.mode === 'menu') menuCam(dt);
  updateParticles(S.mode === 'pause' ? 0 : dt);
  updateWorldAnim(S.mode === 'pause' ? 0 : dt);
  sky.position.copy(camera.position);
  sunSprite.position.copy(camera.position).addScaledVector(SUN_DIR, 1300);
  sun.position.copy(car.pos).add(SUN_OFF); sun.target.position.copy(car.pos);
  if (composer) composer.render(); else renderer.render(scene, camera);
}
requestAnimationFrame(frame);
