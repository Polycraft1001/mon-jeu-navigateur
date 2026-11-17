import * as THREE from 'three';

// ================= Réglages =================
const LAPS = 3;
const HALF_W = 9;           // demi-largeur de la route
const N = 500;              // points d'échantillonnage du circuit
const MAX_SPEED = 46;       // m/s (~165 km/h)
const BOOST_SPEED = 64;     // vitesse max pendant le turbo (~230 km/h)
const MAX_REVERSE = 10;
const ACCEL = 20, BRAKE = 38, DRAG = 0.3;
const GRASS_MAX = 15;
const LIMIT = HALF_W + 20;
const BEST_KEY = 'voiture3d-best';
const DRIFT_KEY = 'voiture3d-drift';
const DRIFT_LEVELS = [0, 0.8, 1.8, 3.0];   // secondes de drift pour atteindre chaque niveau
const BOOST_TIME = [0, 0.7, 1.3, 2.2];     // durée du turbo selon le niveau
const SPARK_COLORS = [null, [0.3, 0.8, 1.0], [1.0, 0.55, 0.1], [0.8, 0.4, 1.0]];
const MOBILE = matchMedia('(pointer: coarse)').matches;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const rnd = s => (Math.random() - 0.5) * s;

// ================= Rendu =================
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const HORIZON = new THREE.Color(0xcfe3f5);
scene.fog = new THREE.Fog(HORIZON, 160, 900);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.5, 2000);

// ---- Ciel en dégradé avec soleil ----
const SUN_DIR = new THREE.Vector3(0.45, 0.6, 0.35).normalize();
function makeSky() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(900, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x2f6fd0) },
        horizon: { value: HORIZON.clone() },
        sunDir: { value: SUN_DIR },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = max(d.y, 0.0);
          vec3 col = mix(horizon, top, pow(h, 0.6));
          float s = max(dot(d, sunDir), 0.0);
          col += vec3(1.0, 0.9, 0.7) * (pow(s, 400.0) * 4.0 + pow(s, 12.0) * 0.25);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    })
  );
}
const sky = makeSky();
sky.renderOrder = -1;
scene.add(sky);

// Reflets : l'environnement est généré à partir du ciel
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
envScene.add(makeSky());
scene.environment = pmrem.fromScene(envScene, 0.02, 0.1, 2000).texture;

// ---- Lumières ----
scene.add(new THREE.HemisphereLight(0xdbeafe, 0x3d5a2a, 0.6));
const sun = new THREE.DirectionalLight(0xfff1dc, 3.0);
sun.castShadow = true;
sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 400 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// ================= Textures générées =================
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

const grassTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#4a8f3a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 7000; i++) {
    g.fillStyle = `hsl(${95 + Math.random() * 25},45%,${28 + Math.random() * 22}%)`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2 + Math.random() * 3);
  }
});
grassTex.repeat.set(200, 200);

const roadTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#3a3a3e'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) {
    const v = 40 + Math.random() * 40 | 0;
    g.fillStyle = `rgb(${v},${v},${v + 4})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
  }
  g.fillStyle = '#eeeeee';
  g.fillRect(w * 0.03, 0, w * 0.025, h);   // ligne de bord
  g.fillRect(w * 0.945, 0, w * 0.025, h);  // ligne de bord
  g.fillRect(w * 0.49, 0, w * 0.02, h * 0.5); // pointillés au centre
});

const curbTex = canvasTex(32, 64, (g, w, h) => {
  g.fillStyle = '#d62828'; g.fillRect(0, 0, w, h / 2);
  g.fillStyle = '#f5f5f5'; g.fillRect(0, h / 2, w, h / 2);
});

const puffTex = canvasTex(64, 64, (g) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.4, 'rgba(255,255,255,.6)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
});

// ================= Décor =================
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(2000, 2000),
  new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ---- Circuit ----
const ctrl = [
  [0, -120], [80, -110], [125, -50], [90, 0], [115, 60], [60, 115],
  [-20, 100], [-60, 40], [-115, 30], [-125, -40], [-80, -100]
].map(([x, z]) => new THREE.Vector3(x, 0, z));
const curve = new THREE.CatmullRomCurve3(ctrl, true);
const pts = curve.getSpacedPoints(N);
pts.pop();
const tangents = pts.map((_, i) => curve.getTangentAt(i / N));
const dist = [0];
for (let i = 1; i <= N; i++) dist.push(dist[i - 1] + pts[i % N].distanceTo(pts[i - 1]));
const normalAt = i => { const t = tangents[i % N]; return new THREE.Vector2(-t.z, t.x); };

function strip(offIn, offOut, y, mat, tile) {
  const verts = [], uvs = [], normals = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const p = pts[i % N], t = tangents[i % N];
    const nx = -t.z, nz = t.x, v = dist[i] / tile;
    verts.push(p.x + nx * offIn, y, p.z + nz * offIn, p.x + nx * offOut, y, p.z + nz * offOut);
    uvs.push(0, v, 1, v);
    normals.push(0, 1, 0, 0, 1, 0);
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  scene.add(m);
}
const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85, side: THREE.DoubleSide });
const curbMat = new THREE.MeshStandardMaterial({ map: curbTex, roughness: 0.7, side: THREE.DoubleSide });
strip(-HALF_W, HALF_W, 0.05, roadMat, 12);
strip(HALF_W, HALF_W + 1.4, 0.05, curbMat, 4);
strip(-HALF_W - 1.4, -HALF_W, 0.05, curbMat, 4);

// ---- Ligne de départ ----
const checkerTex = canvasTex(64, 16, (g) => {
  for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) {
    g.fillStyle = (x + y) % 2 ? '#000' : '#fff';
    g.fillRect(x * 4, y * 4, 4, 4);
  }
});
checkerTex.magFilter = THREE.NearestFilter;
const lineGeo = new THREE.PlaneGeometry(HALF_W * 2, HALF_W / 2);
lineGeo.rotateX(-Math.PI / 2);
const startLine = new THREE.Mesh(lineGeo, new THREE.MeshStandardMaterial({ map: checkerTex, roughness: 0.8 }));
startLine.position.set(pts[0].x, 0.08, pts[0].z);
const ang0 = Math.atan2(tangents[0].x, tangents[0].z);
startLine.rotation.y = ang0;
startLine.receiveShadow = true;
scene.add(startLine);

// ---- Portique de départ ----
const bannerTex = canvasTex(512, 64, (g, w, h) => {
  g.fillStyle = '#111'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < 8; x++) for (let y = 0; y < 4; y++) {
    g.fillStyle = (x + y) % 2 ? '#000' : '#fff';
    g.fillRect(x * 8, y * 16, 8, 16);
    g.fillRect(w - 64 + x * 8, y * 16, 8, 16);
  }
  g.fillStyle = '#fff';
  g.font = 'bold italic 40px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('GRAND PRIX', w / 2, h / 2 + 2);
});
const metal = new THREE.MeshStandardMaterial({ color: 0x2b2d42, metalness: 0.7, roughness: 0.35 });
const gantry = new THREE.Group();
for (const s of [-1, 1]) {
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 8, 0.7), metal);
  post.position.set(s * (HALF_W + 2.2), 4, 0);
  post.castShadow = true;
  gantry.add(post);
}
const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.6 });
const beam = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 2 + 5.1, 1.6, 0.5), [metal, metal, metal, metal, bannerMat, bannerMat]);
beam.position.y = 7.6;
beam.castShadow = true;
gantry.add(beam);
gantry.position.set(pts[0].x, 0, pts[0].z);
gantry.rotation.y = ang0;
scene.add(gantry);

// ---- Tribune avec public ----
const STAND_I = 30;
const sn = normalAt(STAND_I).multiplyScalar(-1), sp = pts[STAND_I];
const standPos = new THREE.Vector3(sp.x + sn.x * (LIMIT + 9), 0, sp.z + sn.y * (LIMIT + 9));
const stand = new THREE.Group();
const concrete = new THREE.MeshStandardMaterial({ color: 0xb8b8b8, roughness: 0.9 });
const crowdList = [];
for (let k = 0; k < 6; k++) {
  const h = 0.8 + k * 1.1;
  const step = new THREE.Mesh(new THREE.BoxGeometry(40, h, 2), concrete);
  step.position.set(0, h / 2, -5 + k * 2);
  step.castShadow = step.receiveShadow = true;
  stand.add(step);
  for (let x = -19; x <= 19; x += 0.9) if (Math.random() < 0.75) crowdList.push([x + rnd(0.3), h + 0.4, -5 + k * 2 + rnd(0.4)]);
}
const crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.8, 0.4), new THREE.MeshStandardMaterial({ roughness: 0.8 }), crowdList.length);
const dummy = new THREE.Object3D();
crowdList.forEach(([x, y, z], i) => {
  dummy.position.set(x, y, z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1);
  dummy.updateMatrix();
  crowd.setMatrixAt(i, dummy.matrix);
  crowd.setColorAt(i, new THREE.Color().setHSL(Math.random(), 0.7, 0.55));
});
stand.add(crowd);
const roof = new THREE.Mesh(new THREE.BoxGeometry(42, 0.3, 14), new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.5 }));
roof.position.set(0, 10.5, 0);
roof.castShadow = true;
stand.add(roof);
for (const x of [-20, -7, 7, 20]) {
  const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 10.5, 0.4), metal);
  p.position.set(x, 5.25, 6.5);
  stand.add(p);
}
stand.position.copy(standPos);
stand.rotation.y = Math.atan2(sn.x, sn.y);
scene.add(stand);

// ---- Arbres (instanciés pour la performance) ----
function distToTrack(x, z) {
  let best = Infinity;
  for (let i = 0; i < N; i += 2) {
    const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
const pines = [], rounds = [];
for (let tries = 0; pines.length + rounds.length < 260 && tries < 6000; tries++) {
  const x = rnd(640), z = rnd(640);
  if (distToTrack(x, z) < LIMIT + 4) continue;
  if (Math.hypot(x - standPos.x, z - standPos.z) < 32) continue;
  const t = { x, z, s: 0.7 + Math.random() * 0.8, r: Math.random() * 6.28 };
  (Math.random() < 0.6 ? pines : rounds).push(t);
}
function instanced(geo, mat, list, y, colorFn) {
  const m = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((t, i) => {
    dummy.position.set(t.x, y * t.s, t.z);
    dummy.rotation.set(0, t.r, 0);
    dummy.scale.setScalar(t.s);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
    if (colorFn) m.setColorAt(i, colorFn());
  });
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
}
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 1 });
const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
const trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 2.4, 6);
instanced(trunkGeo, trunkMat, pines, 1.2);
instanced(new THREE.ConeGeometry(2.6, 7, 7), leafMat, pines, 5.5,
  () => new THREE.Color().setHSL(0.3 + Math.random() * 0.06, 0.55, 0.18 + Math.random() * 0.08));
instanced(trunkGeo, trunkMat, rounds, 1.2);
instanced(new THREE.IcosahedronGeometry(2.8, 1), leafMat, rounds, 4.6,
  () => new THREE.Color().setHSL(0.22 + Math.random() * 0.1, 0.6, 0.28 + Math.random() * 0.1));

// ---- Montagnes au loin ----
const mountMat = new THREE.MeshStandardMaterial({ color: 0x5f7d6a, roughness: 1, flatShading: true });
const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true });
for (let i = 0; i < 36; i++) {
  const a = i / 36 * Math.PI * 2 + Math.random() * 0.1;
  const r = 520 + Math.random() * 120, h = 80 + Math.random() * 120, w = 70 + Math.random() * 60;
  const seg = 6 + (Math.random() * 3 | 0), rot = Math.random() * 3;
  const m = new THREE.Mesh(new THREE.ConeGeometry(w, h, seg), mountMat);
  m.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r);
  m.rotation.y = rot;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.3 * 1.02, h * 0.3, seg), snowMat);
  cap.position.set(m.position.x, h - 2 - h * 0.15 + 0.3, m.position.z);
  cap.rotation.y = rot;
  scene.add(m, cap);
}

// ---- Nuages ----
const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0x8899aa, emissiveIntensity: 0.4, flatShading: true });
const cloudGeo = new THREE.IcosahedronGeometry(1, 1);
const clouds = [];
for (let i = 0; i < 16; i++) {
  const c = new THREE.Group();
  for (let k = 0; k < 5; k++) {
    const m = new THREE.Mesh(cloudGeo, cloudMat);
    m.position.set(rnd(30), rnd(5), rnd(14));
    m.scale.setScalar(8 + Math.random() * 8);
    c.add(m);
  }
  c.position.set(rnd(900), 140 + Math.random() * 60, rnd(900));
  c.scale.y = 0.6;
  scene.add(c);
  clouds.push(c);
}

// ================= Voiture =================
const car = new THREE.Group();
const chassis = new THREE.Group(); // penche dans les virages
car.add(chassis);

const PAINTS = [0xe63946, 0x1d4ed8, 0xf59e0b, 0x10b981, 0x9333ea, 0x111111, 0xf1f1f1];
let paintIdx = 0;
const paint = new THREE.MeshStandardMaterial({ color: PAINTS[0], metalness: 0.55, roughness: 0.28 });
const blackMat = new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.6 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x0b1320, metalness: 0.9, roughness: 0.08 });
const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf1f1f1, metalness: 0.3, roughness: 0.35 });
const chrome = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.2 });
const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 3 });
const tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 1.5 });

function part(geo, mat, x, y, z, parent = chassis) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}
part(new THREE.BoxGeometry(2.0, 0.45, 4.4), paint, 0, 0.55, 0);                // caisse
part(new THREE.BoxGeometry(1.9, 0.25, 1.6), paint, 0, 0.86, 1.25).rotation.x = 0.08; // capot
const cabGeo = new THREE.BoxGeometry(1.7, 0.55, 2.2);
{
  const p = cabGeo.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) {
    p.setX(i, p.getX(i) * 0.82);
    p.setZ(i, p.getZ(i) * 0.62 - 0.15);
  }
  cabGeo.computeVertexNormals();
}
part(cabGeo, glassMat, 0, 1.05, -0.3);                                         // cockpit vitré
part(new THREE.BoxGeometry(1.3, 0.05, 1.15), paint, 0, 1.345, -0.45);          // toit
part(new THREE.BoxGeometry(0.35, 0.02, 1.6), stripeMat, 0, 0.995, 1.25).rotation.x = 0.08; // bandes
part(new THREE.BoxGeometry(0.35, 0.02, 1.15), stripeMat, 0, 1.375, -0.45);
part(new THREE.BoxGeometry(0.35, 0.02, 1.0), stripeMat, 0, 0.785, -1.7);
for (const s of [-1, 1]) {
  part(new THREE.BoxGeometry(0.1, 0.35, 0.1), blackMat, s * 0.6, 0.95, -2.0);    // supports d'aileron
  part(new THREE.BoxGeometry(0.06, 0.3, 0.6), blackMat, s * 0.95, 1.17, -2.05);  // dérives
  part(new THREE.BoxGeometry(0.1, 0.18, 3.2), blackMat, s * 1.02, 0.38, 0);      // bas de caisse
  part(new THREE.BoxGeometry(0.5, 0.14, 0.05), headMat, s * 0.62, 0.68, 2.21);   // phares
  part(new THREE.BoxGeometry(0.55, 0.14, 0.05), tailMat, s * 0.62, 0.68, -2.21); // feux arrière
  const ex = part(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 10), chrome, s * 0.45, 0.4, -2.25);
  ex.rotation.x = Math.PI / 2;
}
part(new THREE.BoxGeometry(1.9, 0.07, 0.5), blackMat, 0, 1.15, -2.05);           // aileron
part(new THREE.BoxGeometry(2.0, 0.08, 0.4), blackMat, 0, 0.33, 2.25);            // lame avant

// Flammes du turbo
const flameGeo = new THREE.ConeGeometry(0.14, 0.9, 8);
flameGeo.translate(0, 0.45, 0);
flameGeo.rotateX(-Math.PI / 2);
const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.6, 0.4), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
const flames = [-1, 1].map(s => {
  const f = new THREE.Mesh(flameGeo, flameMat);
  f.position.set(s * 0.45, 0.4, -2.4);
  f.visible = false;
  chassis.add(f);
  return f;
});

// Roues
const tireGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 24); tireGeo.rotateZ(Math.PI / 2);
const rimGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.36, 12); rimGeo.rotateZ(Math.PI / 2);
const spokeGeo = new THREE.BoxGeometry(0.37, 0.46, 0.08);
const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
const wheels = [];
for (const [x, z] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.4], [0.95, -1.4]]) {
  const w = new THREE.Group();
  w.rotation.order = 'YXZ';
  w.position.set(x, 0.42, z);
  const tire = new THREE.Mesh(tireGeo, tireMat); tire.castShadow = true;
  w.add(tire, new THREE.Mesh(rimGeo, chrome));
  const s1 = new THREE.Mesh(spokeGeo, blackMat), s2 = new THREE.Mesh(spokeGeo, blackMat);
  s2.rotation.x = Math.PI / 2;
  w.add(s1, s2);
  car.add(w);
  wheels.push(w);
}
scene.add(car);

function nextColor() {
  paintIdx = (paintIdx + 1) % PAINTS.length;
  paint.color.set(PAINTS[paintIdx]);
}

// ================= Effets : fumée, étincelles, traces =================
class Particles {
  constructor(count, blending) {
    this.items = [];
    this.i = 0;
    for (let k = 0; k < count; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, blending }));
      s.visible = false;
      scene.add(s);
      this.items.push({ s, life: 0, max: 1, vel: new THREE.Vector3(), s0: 1, s1: 1, op: 1, grav: 0 });
    }
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, op, grav = 0) {
    const p = this.items[this.i];
    this.i = (this.i + 1) % this.items.length;
    p.s.position.set(x, y, z);
    p.vel.set(vx, vy, vz);
    p.life = p.max = life;
    Object.assign(p, { s0, s1, op, grav });
    p.s.material.color.setRGB(r, g, b);
    p.s.material.rotation = Math.random() * 6.28;
    p.s.visible = true;
  }
  update(dt) {
    for (const p of this.items) {
      if (!p.s.visible) continue;
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; continue; }
      const k = 1 - p.life / p.max;
      p.vel.y += p.grav * dt;
      p.s.position.addScaledVector(p.vel, dt);
      if (p.s.position.y < 0.1) { p.s.position.y = 0.1; p.vel.y *= -0.3; }
      p.s.scale.setScalar(p.s0 + (p.s1 - p.s0) * k);
      p.s.material.opacity = p.op * (1 - k);
    }
  }
  clear() { for (const p of this.items) p.s.visible = false; }
}
const smoke = new Particles(MOBILE ? 80 : 160, THREE.NormalBlending);
const sparks = new Particles(MOBILE ? 60 : 120, THREE.AdditiveBlending);

// Traces de pneus
const SKID_MAX = 1500;
const skidGeo = new THREE.PlaneGeometry(0.32, 1);
skidGeo.rotateX(-Math.PI / 2);
const skids = new THREE.InstancedMesh(skidGeo,
  new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
  SKID_MAX);
skids.count = 0;
skids.frustumCulled = false;
scene.add(skids);
let skidNext = 0, skidTotal = 0;
const lastSkid = [null, null];
function addSkid(i, x, z) {
  const prev = lastSkid[i];
  lastSkid[i] = { x, z };
  if (!prev) return;
  const dx = x - prev.x, dz = z - prev.z, len = Math.hypot(dx, dz);
  if (len < 0.05 || len > 3) return;
  dummy.position.set((x + prev.x) / 2, 0.07, (z + prev.z) / 2);
  dummy.rotation.set(0, Math.atan2(dx, dz), 0);
  dummy.scale.set(1, 1, len + 0.05);
  dummy.updateMatrix();
  skids.setMatrixAt(skidNext, dummy.matrix);
  skidNext = (skidNext + 1) % SKID_MAX;
  skidTotal = Math.min(SKID_MAX, skidTotal + 1);
  skids.count = skidTotal;
  skids.instanceMatrix.needsUpdate = true;
}
function clearSkids() {
  skidNext = skidTotal = 0;
  skids.count = 0;
  lastSkid[0] = lastSkid[1] = null;
}

// ================= Lueur (bloom) sur ordinateur =================
let composer = null;
async function setupBloom() {
  try {
    const base = 'https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/';
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all(
      ['EffectComposer.js', 'RenderPass.js', 'UnrealBloomPass.js', 'OutputPass.js'].map(f => import(base + f)));
    const c = new EffectComposer(renderer);
    c.addPass(new RenderPass(scene, camera));
    c.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.4, 1.6));
    c.addPass(new OutputPass());
    composer = c;
  } catch (e) {
    console.warn('Bloom indisponible, rendu simple.', e);
  }
}
if (!MOBILE) setupBloom();

// ================= Contrôles =================
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyR') reset();
  if (e.code === 'KeyC' && !e.repeat) nextColor();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });

const touch = {};
document.querySelectorAll('[data-k]').forEach(b => {
  const k = b.dataset.k;
  const on = e => { e.preventDefault(); touch[k] = true; };
  const off = e => { e.preventDefault(); touch[k] = false; };
  b.addEventListener('pointerdown', on);
  b.addEventListener('pointerup', off);
  b.addEventListener('pointerleave', off);
  b.addEventListener('pointercancel', off);
});

// e.code = touche physique : KeyW/KeyA = Z/Q sur AZERTY
const input = () => ({
  up: keys.ArrowUp || keys.KeyW || touch.up,
  down: keys.ArrowDown || keys.KeyS || touch.down,
  left: keys.ArrowLeft || keys.KeyA || touch.left,
  right: keys.ArrowRight || keys.KeyD || touch.right,
  hand: keys.Space || touch.hand,
});

// ================= Interface =================
const $ = id => document.getElementById(id);
const fmt = t => {
  if (!isFinite(t)) return '--';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
};
const getBest = () => parseFloat(localStorage.getItem(BEST_KEY)) || Infinity;
$('best').textContent = fmt(getBest());

let msgTimer = 0;
function showMsg(text, ms) {
  const el = $('msg');
  el.textContent = text;
  el.style.opacity = 1;
  clearTimeout(msgTimer);
  if (ms) msgTimer = setTimeout(() => { el.style.opacity = 0; }, ms);
}
$('restart').addEventListener('click', () => reset());

// ================= État =================
const pos = new THREE.Vector3();
const _v = new THREE.Vector3();
let state, countdown, raceTime, speed, heading, moveAng, steer, diff;
let progress, lastIdx, lapsDone, lapStart, lapTimes;
let drifting, driftDir, driftTime, driftPts, driftTotal, combo, comboTimer, superShown;
let boost, boostLvl, hopY, hopV, roll, pitch, smokeAcc;
let driftHideTimer = 0;

function reset() {
  const startIdx = N - 6;
  state = 'countdown';
  countdown = 3;
  raceTime = 0; speed = 0; steer = 0; diff = 0;
  lastIdx = startIdx; progress = -6;
  lapsDone = 0; lapStart = 0; lapTimes = [];
  drifting = false; driftDir = 0; driftTime = 0; driftPts = 0; driftTotal = 0;
  combo = 1; comboTimer = 0; superShown = false;
  boost = 0; boostLvl = 0; hopY = 0; hopV = 0; roll = 0; pitch = 0; smokeAcc = 0;
  pos.set(pts[startIdx].x, 0, pts[startIdx].z);
  heading = moveAng = Math.atan2(tangents[startIdx].x, tangents[startIdx].z);
  camera.position.set(pos.x - Math.sin(heading) * 9, 4.5, pos.z - Math.cos(heading) * 9);
  clearSkids(); smoke.clear(); sparks.clear();
  clearTimeout(driftHideTimer);
  $('drift').className = 'hidden';
  $('end').classList.add('hidden');
  $('lap').textContent = `1/${LAPS}`;
  $('time').textContent = fmt(0);
  $('dscore').textContent = '0';
}

function nearest() {
  let best = -1, bd = Infinity;
  for (let k = -40; k <= 40; k++) {
    const i = ((lastIdx + k) % N + N) % N;
    const d = (pts[i].x - pos.x) ** 2 + (pts[i].z - pos.z) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return { i: best, d: Math.sqrt(bd) };
}

const driftLevel = () => driftTime >= DRIFT_LEVELS[3] ? 3 : driftTime >= DRIFT_LEVELS[2] ? 2 : driftTime >= DRIFT_LEVELS[1] ? 1 : 0;

function endDrift(ok) {
  drifting = false;
  const lvl = driftLevel();
  const pts = Math.round(driftPts);
  const el = $('drift');
  clearTimeout(driftHideTimer);
  if (ok) {
    driftTotal += pts;
    $('dscore').textContent = Math.round(driftTotal);
    if (lvl > 0) { boost = BOOST_TIME[lvl]; boostLvl = lvl; }
    el.className = 'done';
    $('driftTitle').textContent = ['DRIFT', 'TURBO !', 'TURBO !!', 'SUPER TURBO !!!'][lvl];
    $('driftPts').textContent = '+' + pts;
    comboTimer = 2.5;
  } else {
    el.className = 'fail';
    $('driftTitle').textContent = 'DRIFT RATÉ';
    $('driftPts').textContent = '0';
    comboTimer = 0; combo = 1;
  }
  driftHideTimer = setTimeout(() => { if (!drifting) el.className = 'hidden'; }, 1300);
}

function driftUI() {
  if (!drifting) return;
  const lvl = driftLevel();
  $('drift').className = 'lvl' + lvl;
  $('driftTitle').textContent = lvl === 3 ? 'SUPER DRIFT !' : 'DRIFT' + (combo > 1 ? ` x${combo}` : '');
  $('driftPts').textContent = Math.round(driftPts);
  const frac = lvl >= 3 ? 1 : (driftTime - DRIFT_LEVELS[lvl]) / (DRIFT_LEVELS[lvl + 1] - DRIFT_LEVELS[lvl]);
  $('driftBar').firstElementChild.style.width = (frac * 100) + '%';
}

function finish() {
  if (drifting) endDrift(true);
  state = 'finished';
  const best = getBest();
  const record = raceTime < best;
  if (record) localStorage.setItem(BEST_KEY, raceTime);
  const bestD = parseFloat(localStorage.getItem(DRIFT_KEY)) || 0;
  const dRecord = driftTotal > bestD;
  if (dRecord) localStorage.setItem(DRIFT_KEY, Math.round(driftTotal));
  $('best').textContent = fmt(Math.min(best, raceTime));
  $('endTitle').textContent = record ? 'Nouveau record ! 🏆' : 'Arrivée ! 🏁';
  $('results').innerHTML =
    lapTimes.map((t, i) => `Tour ${i + 1} : ${fmt(t)}`).join('<br>') +
    `<br><b>Total : ${fmt(raceTime)}</b>` +
    `<br>Score drift : <b>${Math.round(driftTotal)}</b> ` +
    (dRecord ? '🔥 record !' : `(record : ${Math.round(bestD)})`);
  $('end').classList.remove('hidden');
}

// Fumée, étincelles et traces aux roues arrière
function effects(dt, a, off, hand) {
  const sliding = a > 5 && (drifting || Math.abs(diff) > 0.28 || (hand && a > 8));
  const dusty = off && a > 6;
  if (!sliding && !dusty) { lastSkid[0] = lastSkid[1] = null; return; }
  const sh = Math.sin(heading), ch = Math.cos(heading);
  const vx = Math.sin(moveAng) * speed, vz = Math.cos(moveAng) * speed;
  smokeAcc += dt;
  const puff = smokeAcc >= (MOBILE ? 0.05 : 0.025);
  if (puff) smokeAcc = 0;
  const lvl = drifting ? driftLevel() : 0;
  for (let w = 0; w < 2; w++) {
    const lx = w ? 1.0 : -1.0, lz = -1.4;
    const wx = pos.x + lx * ch + lz * sh;
    const wz = pos.z - lx * sh + lz * ch;
    if (sliding && !off) addSkid(w, wx, wz); else lastSkid[w] = null;
    if (puff) {
      if (dusty) smoke.spawn(wx, 0.4, wz, rnd(2), 1 + Math.random(), rnd(2), 1.0, 1, 4, 0.5, 0.4, 0.28, 0.5);
      else smoke.spawn(wx, 0.4, wz, vx * 0.15 + rnd(2), 1.2 + Math.random(), vz * 0.15 + rnd(2), 1.3, 1.2, 5.5, 0.85, 0.85, 0.88, 0.45);
    }
    if (lvl > 0 && !off) {
      const c = SPARK_COLORS[lvl];
      for (let k = 0; k < 2; k++) {
        sparks.spawn(wx, 0.2, wz, vx * 0.5 + rnd(6), 2 + Math.random() * 4, vz * 0.5 + rnd(6),
          0.35, 0.5, 0.08, c[0] * 5, c[1] * 5, c[2] * 5, 1, -18);
      }
    }
  }
}

// ================= Boucle de jeu =================
function update(dt) {
  const inp = input();

  if (state === 'countdown') {
    countdown -= dt;
    if (countdown <= 0) { state = 'race'; showMsg('GO !', 800); }
    else showMsg(String(Math.ceil(countdown)));
  }
  const racing = state === 'race';

  const here = nearest();
  const off = here.d > HALF_W + 1.4;

  if (boost > 0) boost -= dt;
  const boosting = boost > 0;
  if (!drifting && comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 1; }

  // --- Moteur et freins ---
  const maxS = off ? GRASS_MAX : boosting ? BOOST_SPEED : MAX_SPEED;
  if (racing && (inp.up || boosting)) speed += (ACCEL + (boosting ? 28 : 0)) * dt;
  if (racing && inp.down) speed -= (speed > 0 ? BRAKE : ACCEL * 0.6) * dt;
  if (inp.hand && !drifting) speed -= Math.sign(speed) * Math.min(Math.abs(speed), 14 * dt);
  if (state === 'finished') speed *= 1 - Math.min(1, 2 * dt);
  speed -= speed * (DRAG + (off ? 1.2 : 0) + (drifting ? 0.1 : 0)) * dt;
  if (speed > maxS) speed = Math.max(maxS, speed - 30 * dt);
  if (speed < -MAX_REVERSE) speed = -MAX_REVERSE;
  const a = Math.abs(speed);

  // --- Volant ---
  const target = racing ? (inp.left ? 1 : 0) - (inp.right ? 1 : 0) : 0;
  steer += (target - steer) * Math.min(1, dt * 10);

  // --- Drift : Espace + virage à plus de ~50 km/h ---
  if (!drifting && racing && inp.hand && target !== 0 && speed > 14 && !off) {
    drifting = true;
    driftDir = target;
    driftTime = 0; driftPts = 0; superShown = false;
    combo = comboTimer > 0 ? Math.min(combo + 1, 5) : 1;
    hopV = 3.2; // petit saut au début du drift
    clearTimeout(driftHideTimer);
  }
  if (drifting) {
    if (!racing || !inp.hand || speed < 9) endDrift(true);
    else if (off) endDrift(false);
  }

  if (drifting) {
    driftTime += dt;
    // Même sens que le drift = virage serré, sens opposé = contre-braquage (virage large)
    const mod = 1 + 0.75 * steer * driftDir;
    heading += driftDir * mod * 1.6 * Math.min(1, a / 18) * dt;
  } else {
    const sf = Math.min(1, a / 10) * (1 - Math.min(a, MAX_SPEED) / MAX_SPEED * 0.35);
    heading += steer * 1.9 * sf * Math.sign(speed) * (inp.hand ? 1.5 : 1) * dt;
  }

  // --- Adhérence : la direction de déplacement rattrape l'orientation de la voiture ---
  const grip = drifting ? 2.0 : off ? 4 : 7;
  diff = wrap(heading - moveAng) * Math.exp(-grip * dt);
  diff = clamp(diff, drifting ? -0.95 : -1.2, drifting ? 0.95 : 1.2);
  moveAng = heading - diff;

  if (drifting) {
    driftPts += a * Math.abs(diff) * dt * 8 * combo;
    if (driftLevel() === 3 && !superShown) { superShown = true; showMsg('SUPER DRIFT !', 900); }
  }

  pos.x += Math.sin(moveAng) * speed * dt;
  pos.z += Math.cos(moveAng) * speed * dt;

  // Limite autour de la route
  const n2 = nearest();
  if (n2.d > LIMIT) {
    const p = pts[n2.i];
    const dx = pos.x - p.x, dz = pos.z - p.z, len = Math.hypot(dx, dz);
    pos.x = p.x + dx / len * LIMIT;
    pos.z = p.z + dz / len * LIMIT;
    speed *= 0.5;
    if (drifting) endDrift(false);
  }

  // --- Tours ---
  let delta = n2.i - lastIdx;
  if (delta > N / 2) delta -= N;
  if (delta < -N / 2) delta += N;
  progress += delta;
  lastIdx = n2.i;

  if (racing) {
    raceTime += dt;
    if (progress >= (lapsDone + 1) * N) {
      lapTimes.push(raceTime - lapStart);
      lapStart = raceTime;
      lapsDone++;
      if (lapsDone >= LAPS) finish();
      else showMsg(lapsDone === LAPS - 1 ? 'Dernier tour !' : `Tour ${lapsDone + 1}/${LAPS}`, 1200);
    }
  }

  // --- Voiture ---
  hopV -= 22 * dt;
  hopY = Math.max(0, hopY + hopV * dt);
  if (hopY === 0 && hopV < 0) hopV = 0;
  car.position.set(pos.x, hopY, pos.z);
  car.rotation.y = heading;
  const rollT = clamp(steer * a / MAX_SPEED * 0.07 + (drifting ? driftDir * 0.05 : 0), -0.1, 0.1);
  roll += (rollT - roll) * Math.min(1, dt * 6);
  const pitchT = (racing && inp.up ? -0.025 : 0) + (inp.down && speed > 1 ? 0.04 : 0) + (boosting ? -0.03 : 0);
  pitch += (pitchT - pitch) * Math.min(1, dt * 5);
  chassis.rotation.set(pitch, 0, roll);

  for (const w of wheels) w.rotation.x += speed * dt / 0.42;
  wheels[0].rotation.y = wheels[1].rotation.y = clamp(steer * 0.45 - diff * 0.8, -0.7, 0.7);

  tailMat.emissiveIntensity = (inp.down && speed > 0) || inp.hand ? 5 : 1.5;
  for (const f of flames) {
    f.visible = boosting;
    if (boosting) f.scale.set(1, 1, (0.7 + Math.random() * 0.6) * (0.8 + boostLvl * 0.3));
  }
  if (boostLvl === 3) flameMat.color.setRGB(2.5, 1.2, 4);
  else flameMat.color.setRGB(4, 1.6, 0.4);

  effects(dt, a, off, inp.hand);
  smoke.update(dt);
  sparks.update(dt);

  // --- Caméra : suit la trajectoire pour bien voir la voiture de travers ---
  const camAng = heading - diff * 0.7;
  const back = 8.5 + a * 0.035, up = 3.4 + a * 0.02;
  _v.set(pos.x - Math.sin(camAng) * back, up, pos.z - Math.cos(camAng) * back);
  camera.position.lerp(_v, 1 - Math.exp(-dt * 6));
  if (boosting || (drifting && driftLevel() === 3)) {
    camera.position.x += rnd(0.08); camera.position.y += rnd(0.08); camera.position.z += rnd(0.08);
  }
  camera.lookAt(pos.x + Math.sin(camAng) * 5, 1.2 + hopY * 0.5, pos.z + Math.cos(camAng) * 5);
  const fovT = 62 + a * 0.3 + (boosting ? 12 : 0);
  camera.fov += (fovT - camera.fov) * Math.min(1, dt * 4);
  camera.updateProjectionMatrix();

  // --- Soleil (ombres autour de la voiture), ciel, nuages ---
  sun.position.set(pos.x + SUN_DIR.x * 150, SUN_DIR.y * 150, pos.z + SUN_DIR.z * 150);
  sun.target.position.set(pos.x, 0, pos.z);
  sky.position.copy(camera.position);
  for (const c of clouds) { c.position.x += dt * 3; if (c.position.x > 500) c.position.x = -500; }

  // --- HUD ---
  $('speed').innerHTML = `${Math.round(a * 3.6)} <small>km/h</small>`;
  $('speed').classList.toggle('boost', boosting);
  $('lap').textContent = `${Math.min(lapsDone + 1, LAPS)}/${LAPS}`;
  $('time').textContent = fmt(raceTime);
  driftUI();
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (composer) composer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  update(Math.min(clock.getDelta(), 0.05));
  if (composer) composer.render();
  else renderer.render(scene, camera);
}

reset();
loop();
