// =====================================================
//  MOTEUR 3D : rendu, caméra, lumières, ciel, reflets
// =====================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { $, rr, isMobile } from '../core/utils.js';
import { G } from '../core/ctx.js';
import { loadHDR } from '../assets.js';

export const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = isMobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('game').appendChild(renderer.domElement);

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcddff0, 200, 1400);
export const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.3, 3000);

export let composer = null;
export let bloom = null;
if (!isMobile) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.3, 0.4, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}
export function render() {
  if (composer) composer.render(); else renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
});

// ----- Reflets : studio de base, puis vrais ciels HDR chargés en ligne -----
const pmrem = new THREE.PMREMGenerator(renderer);
export const roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
let envMap = roomEnv;
export const getEnvMap = () => envMap;
export const envMats = []; // matériaux qui reflètent le ciel
const HDR_FILES = {
  day: 'textures/equirectangular/royal_esplanade_1k.hdr',
  sunset: 'textures/equirectangular/venice_sunset_1k.hdr',
};
const hdrCache = {};
let envToken = 0;
export function setEnvMap(t) {
  if (envMap === t) return;
  envMap = t;
  const list = G.car ? envMats.concat(G.car.envList) : envMats;
  for (const m of list) { m.envMap = t; m.needsUpdate = true; }
}
export function refreshEnv(id) {
  const tok = ++envToken;
  const file = HDR_FILES[id];
  if (!file) { setEnvMap(roomEnv); return Promise.resolve(true); }
  if (!hdrCache[id]) {
    hdrCache[id] = loadHDR(file).then((t) => {
      if (!t) return null;
      const e = pmrem.fromEquirectangular(t).texture;
      t.dispose();
      return e;
    });
  }
  return hdrCache[id].then((e) => {
    if (tok === envToken) setEnvMap(e || roomEnv);
    return !!e;
  });
}

// ----- Lumières -----
export const hemi = new THREE.HemisphereLight(0xdcecff, 0x5b6a4c, 1.0);
scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xffffff, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 450 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);
export const sunOffset = new THREE.Vector3(90, 160, 60);

// ----- Ciel -----
export const skyUniforms = { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } };
export const sky = new THREE.Mesh(
  new THREE.SphereGeometry(1500, 32, 16),
  new THREE.ShaderMaterial({
    uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y * 1.6 + 0.1, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0);\n#include <colorspace_fragment>\n}',
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
export const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false }));
scene.add(stars);

export const clouds = new THREE.Group();
export const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, fog: false });
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

// Montagnes lointaines (décor) : placées AU-DELÀ du bord du monde,
// pour ne plus cacher les 3 autres villes (qui sont à ~900 m du centre)
export const mountainMat = new THREE.MeshLambertMaterial({ color: 0x7f93a3, flatShading: true });
for (let i = 0; i < 40; i++) {
  const a = (i / 40) * Math.PI * 2 + rr(-0.05, 0.05), d = rr(1600, 1900), h = rr(150, 380);
  const m = new THREE.Mesh(new THREE.ConeGeometry(rr(150, 280), h, 6), mountainMat);
  m.position.set(Math.cos(a) * d, h / 2 - 10, Math.sin(a) * d);
  scene.add(m);
}
