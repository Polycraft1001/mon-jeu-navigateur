import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// ---------- Réglages ----------
const LAPS = 3;           // nombre de tours
const HALF_W = 9;         // demi-largeur de la route
const N = 500;            // points d'échantillonnage du circuit
const MAX_SPEED = 45;     // m/s (~162 km/h)
const MAX_REVERSE = 10;
const ACCEL = 18, BRAKE = 35, DRAG = 0.35;
const GRASS_MAX = 15;     // vitesse max dans l'herbe
const LIMIT = HALF_W + 20; // distance max autorisée depuis le centre de la route
const BEST_KEY = 'voiture3d-best';

// ---------- Scène ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 150, 400);

const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 1000);

scene.add(new THREE.HemisphereLight(0xffffff, 0x447744, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(100, 200, 50);
scene.add(sun);

const grass = new THREE.Mesh(
  new THREE.PlaneGeometry(1000, 1000),
  new THREE.MeshLambertMaterial({ color: 0x3a8c3a })
);
grass.rotation.x = -Math.PI / 2;
scene.add(grass);

// ---------- Circuit ----------
const ctrl = [
  [0, -120], [80, -110], [125, -50], [90, 0], [115, 60], [60, 115],
  [-20, 100], [-60, 40], [-115, 30], [-125, -40], [-80, -100]
].map(([x, z]) => new THREE.Vector3(x, 0, z));
const curve = new THREE.CatmullRomCurve3(ctrl, true);
const pts = curve.getSpacedPoints(N);
pts.pop(); // le dernier point est identique au premier
const tangents = pts.map((_, i) => curve.getTangentAt(i / N));

// Bande le long du circuit (route, bordures)
function strip(offIn, offOut, y, color) {
  const pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const p = pts[i % N], t = tangents[i % N];
    const nx = -t.z, nz = t.x;
    pos.push(p.x + nx * offIn, y, p.z + nz * offIn, p.x + nx * offOut, y, p.z + nz * offOut);
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })));
}
strip(-HALF_W, HALF_W, 0.02, 0x333333);            // asphalte
strip(HALF_W, HALF_W + 1.2, 0.03, 0xcc2222);       // bordure
strip(-HALF_W - 1.2, -HALF_W, 0.03, 0xcc2222);     // bordure
strip(HALF_W - 0.6, HALF_W - 0.3, 0.035, 0xffffff); // ligne blanche
strip(-HALF_W + 0.3, -HALF_W + 0.6, 0.035, 0xffffff);

// Ligne de départ en damier
const cv = document.createElement('canvas');
cv.width = 64; cv.height = 16;
const cx = cv.getContext('2d');
for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) {
  cx.fillStyle = (x + y) % 2 ? '#000' : '#fff';
  cx.fillRect(x * 4, y * 4, 4, 4);
}
const checker = new THREE.CanvasTexture(cv);
checker.magFilter = THREE.NearestFilter;
checker.colorSpace = THREE.SRGBColorSpace;
const lineGeo = new THREE.PlaneGeometry(HALF_W * 2, HALF_W / 2);
lineGeo.rotateX(-Math.PI / 2);
const startLine = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ map: checker }));
startLine.position.set(pts[0].x, 0.04, pts[0].z);
startLine.rotation.y = Math.atan2(tangents[0].x, tangents[0].z);
scene.add(startLine);

// Arbres
function distToTrack(x, z) {
  let best = Infinity;
  for (let i = 0; i < N; i += 2) {
    const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
const trunkGeo = new THREE.CylinderGeometry(0.4, 0.5, 2);
const leafGeo = new THREE.ConeGeometry(2.5, 6, 8);
const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4226 });
const leafMat = new THREE.MeshLambertMaterial({ color: 0x1f6b2a });
for (let placed = 0, tries = 0; placed < 160 && tries < 3000; tries++) {
  const x = (Math.random() - 0.5) * 500, z = (Math.random() - 0.5) * 500;
  if (distToTrack(x, z) < LIMIT + 3) continue;
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.set(x, 1, z);
  const leaves = new THREE.Mesh(leafGeo, leafMat);
  leaves.position.set(x, 5, z);
  scene.add(trunk, leaves);
  placed++;
}

// ---------- Voiture ----------
const car = new THREE.Group();
const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 4), new THREE.MeshLambertMaterial({ color: 0xe63946 }));
body.position.y = 0.6;
const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2), new THREE.MeshLambertMaterial({ color: 0x222244 }));
cabin.position.set(0, 1.15, -0.3);
car.add(body, cabin);
const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
for (const x of [-0.6, 0.6]) {
  const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.05), lightMat);
  l.position.set(x, 0.7, 2.01);
  car.add(l);
}
const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
wheelGeo.rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
const wheels = [];
for (const [x, z] of [[-1, 1.3], [1, 1.3], [-1, -1.3], [1, -1.3]]) {
  const w = new THREE.Mesh(wheelGeo, wheelMat);
  w.rotation.order = 'YXZ'; // braquage (Y) puis rotation de la roue (X)
  w.position.set(x, 0.4, z);
  car.add(w);
  wheels.push(w);
}
scene.add(car);

// ---------- Contrôles ----------
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyR') reset();
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

// e.code = touche physique : KeyW/KeyA = Z/Q sur AZERTY, W/A sur QWERTY
const input = () => ({
  up: keys.ArrowUp || keys.KeyW || touch.up,
  down: keys.ArrowDown || keys.KeyS || touch.down,
  left: keys.ArrowLeft || keys.KeyA || touch.left,
  right: keys.ArrowRight || keys.KeyD || touch.right,
  hand: keys.Space || touch.hand,
});

// ---------- Interface ----------
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

// ---------- État de la course ----------
const pos = new THREE.Vector3();
let state, countdown, raceTime, speed, heading, steer, slip;
let progress, lastIdx, lapsDone, lapStart, lapTimes;

function reset() {
  const startIdx = N - 6; // un peu avant la ligne
  state = 'countdown';
  countdown = 3;
  raceTime = 0; speed = 0; steer = 0; slip = 0;
  lastIdx = startIdx; progress = -6;
  lapsDone = 0; lapStart = 0; lapTimes = [];
  pos.set(pts[startIdx].x, 0, pts[startIdx].z);
  heading = Math.atan2(tangents[startIdx].x, tangents[startIdx].z);
  camera.position.set(pos.x - Math.sin(heading) * 9, 4.5, pos.z - Math.cos(heading) * 9);
  $('end').classList.add('hidden');
  $('lap').textContent = `1/${LAPS}`;
  $('time').textContent = fmt(0);
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

function finish() {
  state = 'finished';
  const best = getBest();
  const record = raceTime < best;
  if (record) localStorage.setItem(BEST_KEY, raceTime);
  $('best').textContent = fmt(Math.min(best, raceTime));
  $('endTitle').textContent = record ? 'Nouveau record ! 🏆' : 'Arrivée ! 🏁';
  $('results').innerHTML =
    lapTimes.map((t, i) => `Tour ${i + 1} : ${fmt(t)}`).join('<br>') +
    `<br><b>Total : ${fmt(raceTime)}</b>`;
  $('end').classList.remove('hidden');
}

// ---------- Boucle de jeu ----------
function update(dt) {
  const inp = input();

  if (state === 'countdown') {
    countdown -= dt;
    if (countdown <= 0) { state = 'race'; showMsg('GO !', 800); }
    else showMsg(String(Math.ceil(countdown)));
  }
  const racing = state === 'race';

  // Physique
  const here = nearest();
  const off = here.d > HALF_W + 0.5;
  if (racing && inp.up) speed += ACCEL * dt;
  if (racing && inp.down) speed -= (speed > 0 ? BRAKE : ACCEL * 0.6) * dt;
  if (inp.hand) speed -= Math.sign(speed) * Math.min(Math.abs(speed), 20 * dt);
  if (state === 'finished') speed *= 1 - Math.min(1, 2 * dt);
  speed -= speed * (DRAG + (off ? 1.2 : 0)) * dt;
  const maxS = off ? GRASS_MAX : MAX_SPEED;
  if (speed > maxS) speed = Math.max(maxS, speed - 30 * dt);
  if (speed < -MAX_REVERSE) speed = -MAX_REVERSE;

  const target = racing ? (inp.left ? 1 : 0) - (inp.right ? 1 : 0) : 0;
  steer += (target - steer) * Math.min(1, dt * 8);
  const a = Math.abs(speed);
  const speedFactor = Math.min(1, a / 10) * (1 - Math.min(a, MAX_SPEED) / MAX_SPEED * 0.4);
  heading += steer * 1.9 * speedFactor * Math.sign(speed) * (inp.hand ? 1.6 : 1) * dt;

  // Effet de dérapage visuel avec le frein à main
  const slipTarget = inp.hand ? steer * 0.35 * speedFactor : 0;
  slip += (slipTarget - slip) * Math.min(1, dt * 5);

  pos.x += Math.sin(heading) * speed * dt;
  pos.z += Math.cos(heading) * speed * dt;

  // Limite : on ne peut pas trop s'éloigner de la route
  const n2 = nearest();
  if (n2.d > LIMIT) {
    const p = pts[n2.i];
    const dx = pos.x - p.x, dz = pos.z - p.z, len = Math.hypot(dx, dz);
    pos.x = p.x + dx / len * LIMIT;
    pos.z = p.z + dz / len * LIMIT;
    speed *= 0.5;
  }

  // Progression et tours
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

  // Mise à jour de la voiture
  car.position.copy(pos);
  car.rotation.y = heading + slip;
  for (const w of wheels) w.rotation.x += speed * dt / 0.4;
  wheels[0].rotation.y = wheels[1].rotation.y = steer * 0.45;

  // Caméra de poursuite
  const camTarget = new THREE.Vector3(pos.x - Math.sin(heading) * 9, 4.5, pos.z - Math.cos(heading) * 9);
  camera.position.lerp(camTarget, 1 - Math.exp(-dt * 5));
  camera.lookAt(pos.x + Math.sin(heading) * 4, 1, pos.z + Math.cos(heading) * 4);

  // HUD
  $('speed').innerHTML = `${Math.round(Math.abs(speed) * 3.6)} <small>km/h</small>`;
  $('lap').textContent = `${Math.min(lapsDone + 1, LAPS)}/${LAPS}`;
  $('time').textContent = fmt(raceTime);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  update(Math.min(clock.getDelta(), 0.05));
  renderer.render(scene, camera);
}

reset();
loop();
