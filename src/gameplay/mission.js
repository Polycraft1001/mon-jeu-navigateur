// =====================================================
//  MISSIONS : va sur le marqueur jaune ⭐, puis passe par
//  les 6 points verts avant la fin du chrono.
//  ➜ Nouvelle mission : crée un autre type dans startMission()
// =====================================================
import * as THREE from 'three';
import { $ } from '../core/utils.js';
import { G } from '../core/ctx.js';
import { save, persist } from '../core/save.js';
import { scene } from '../render/engine.js';
import { N, rc } from '../world/city.js';
import { burst } from '../fx/particles.js';
import { whereAmI } from './where.js';
import { showMessage, refreshStats } from '../ui/hud.js';
import { sfx } from '../ui/audio.js';

export const MISSION_START = { x: 0, z: -120 };
const POINTS = 6;

// ----- Marqueur jaune (départ de mission) -----
const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const marker = new THREE.Group();
const star = new THREE.Mesh(new THREE.OctahedronGeometry(1.2), new THREE.MeshStandardMaterial({ color: 0xffd23a, emissive: 0xffb000, emissiveIntensity: 1.5 }));
{
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 8, 32, 1, true), markerMat); cyl.position.y = 4;
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.6, 5.4, 32), markerMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1;
  star.position.y = 5;
  marker.add(cyl, ring, star);
}
marker.position.set(MISSION_START.x, 0, MISSION_START.z);
scene.add(marker);

// ----- Colonne verte (point de passage) -----
const beamMat = new THREE.MeshBasicMaterial({ color: 0x3dff7a, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const beam = new THREE.Group();
{
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 80, 32, 1, true), beamMat); cyl.position.y = 40;
  const ring = new THREE.Mesh(new THREE.RingGeometry(5.5, 6.5, 32), beamMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1;
  beam.add(cyl, ring);
}
beam.visible = false;
scene.add(beam);

// ----- Flèche verte au-dessus du joueur -----
const arrowGeo = new THREE.ConeGeometry(0.6, 1.8, 12); arrowGeo.rotateX(-Math.PI / 2);
const arrow = new THREE.Mesh(arrowGeo, new THREE.MeshStandardMaterial({ color: 0x3dff7a, emissive: 0x1aff5a, emissiveIntensity: 1.2 }));
arrow.visible = false;
scene.add(arrow);

export const mission = { active: false, cps: [], idx: 0, left: 0, elapsed: 0, cooldown: 0 };

export const fmtTime = (t) => {
  t = Math.max(0, t);
  const m = Math.floor(t / 60), s = t - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
};

function placeBeam() {
  const cp = mission.cps[mission.idx];
  beam.position.set(cp.x, 0, cp.z);
  beam.visible = true;
}

export function startMission() {
  mission.cps = [];
  let prev = { x: MISSION_START.x, z: MISSION_START.z }, total = 0, guard = 0;
  while (mission.cps.length < POINTS && guard++ < 2000) {
    const p = { x: rc(Math.floor(Math.random() * (N + 1))), z: rc(Math.floor(Math.random() * (N + 1))) };
    const d = Math.hypot(p.x - prev.x, p.z - prev.z);
    if (d < 150 || d > 380) continue;
    mission.cps.push(p); total += d; prev = p;
  }
  if (mission.cps.length < POINTS) return;
  mission.active = true; mission.idx = 0; mission.elapsed = 0;
  mission.left = Math.round(total / 17 + 10);
  marker.visible = false;
  placeBeam();
  $('missionPanel').classList.remove('hidden');
  showMessage('MISSION : passe par les ' + POINTS + ' points verts !', '#3dff7a', 2.5);
}

export function finishMission(ok) {
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

export function cancelMission() {
  mission.active = false;
  beam.visible = false; arrow.visible = false; marker.visible = true;
  $('missionPanel').classList.add('hidden');
}

export function updateMission(dt) {
  const p = whereAmI();
  if (!mission.active) {
    mission.cooldown -= dt;
    if (mission.cooldown <= 0 && Math.hypot(p.x - MISSION_START.x, p.z - MISSION_START.z) < 5.5) startMission();
    return;
  }
  mission.left -= dt; mission.elapsed += dt;
  const cp = mission.cps[mission.idx];
  if (Math.hypot(p.x - cp.x, p.z - cp.z) < 9) {
    burst(cp.x, 2, cp.z, '#3dff7a', 24, 12);
    sfx('coin', 0.7);
    mission.idx++;
    if (mission.idx >= mission.cps.length) { finishMission(true); return; }
    placeBeam();
    showMessage('Point ' + mission.idx + '/' + POINTS + ' ✓', '#3dff7a', 1);
  }
  if (mission.left <= 0) { finishMission(false); return; }
  const next = mission.cps[mission.idx];
  arrow.visible = true;
  arrow.position.set(p.x, p.y + (G.mode === 'foot' ? 2.7 : 3.4), p.z);
  arrow.rotation.y = Math.atan2(-(next.x - p.x), -(next.z - p.z));
  $('missionText').textContent = 'Point ' + (mission.idx + 1) + '/' + POINTS;
  const tEl = $('missionTime');
  tEl.textContent = fmtTime(mission.left);
  tEl.style.color = mission.left < 10 ? '#ff5050' : '#ffd23a';
}

// petites animations (même dans le menu)
export function animateMission(dt, t) {
  star.rotation.y += dt * 2;
  star.position.y = 5 + Math.sin(t * 2) * 0.4;
  markerMat.opacity = 0.28 + Math.sin(t * 3) * 0.08;
  beamMat.opacity = 0.25 + Math.sin(t * 4) * 0.08;
}
