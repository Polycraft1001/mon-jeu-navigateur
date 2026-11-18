// =====================================================
//  TURBO CITY 3D — POINT D'ENTRÉE DU JEU
//  1) construit le monde   2) charge les graphismes HD
//  3) fait tourner la boucle (environ 60 images / seconde)
//  ➜ Le plan de tout le code : docs/ARCHITECTURE.md
// =====================================================
import * as THREE from 'three';
import { $, isMobile } from './core/utils.js';
import { G } from './core/ctx.js';
import { save } from './core/save.js';
import { CARS, POLICE } from './core/config.js';
import { loadTexture, loadModel } from './assets.js';
import { renderer, scene, camera, render, sun, sunOffset, sky, stars } from './render/engine.js';
import { buildCity, N, BLOCK, CELL, blockCenter, colliders, grassMat, waterMat } from './world/city.js';
import { slopeTilt } from './world/terrain.js';
import { applyTime } from './world/time.js';
import { setFerrari } from './vehicles/models.js'; // à garder AVANT les autres véhicules
import { player, updatePlayer, setPlayerCar, resetPlayer, syncCarMesh } from './vehicles/driving.js';
import { traffic, spawnTraffic, updateTraffic } from './vehicles/traffic.js';
import { createPedestrians } from './npc/pedestrians.js';
import { loadCharacters, attachHero, updateHeroModel } from './npc/characters.js';
import { hero, focusPos, updateHero } from './gameplay/onfoot.js';
import { updateWeapons } from './gameplay/weapons.js';
import { initPolice, updatePolice, crime, wanted } from './gameplay/police.js';
import { updateParticles } from './fx/particles.js';
import { updateDestruction } from './fx/destruction.js';
import { resetCoins, updateCoins } from './gameplay/coins.js';
import { updateMission, animateMission } from './gameplay/mission.js';
import { updateCamera, updateMenuCamera } from './render/camera.js';
import { unlockAudio } from './ui/audio.js';
import { updateHUD, refreshStats } from './ui/hud.js';
import { readInput } from './ui/input.js';
import { buildMenu, checkRotate } from './ui/menu.js';
import { drawMapBase, drawMinimap } from './ui/minimap.js';

// =====================================================
//  1) DÉMARRAGE
// =====================================================
if (isMobile) document.body.classList.add('touchUI'); // interface pour écran tactile
G.clock = new THREE.Clock();

buildCity();
drawMapBase();
G.peds = createPedestrians({
  scene, N, BLOCK, CELL, blockCenter, colliders,
  count: isMobile ? 28 : 64,   // moins de piétons sur téléphone
  shadows: !isMobile,
});
initPolice();           // étoiles de recherche, voitures et policiers
setPlayerCar();
resetPlayer(true);
syncCarMesh(0);
const skyReady = applyTime(save.time); // couleurs du ciel + vrai ciel HDR en ligne
spawnTraffic();
resetCoins();
refreshStats();
buildMenu();
checkRotate();

// Le son ne peut démarrer qu'après un premier geste du joueur (règle des navigateurs)
const UNLOCK_EVENTS = ['pointerup', 'touchend', 'keydown'];
function unlockOnce() {
  unlockAudio();
  for (const ev of UNLOCK_EVENTS) window.removeEventListener(ev, unlockOnce);
}
for (const ev of UNLOCK_EVENTS) window.addEventListener(ev, unlockOnce);

// Pour bidouiller dans la console (F12) : TURBO.player.speed, TURBO.hero.hp = 999, TURBO.wanted.heat = 0 ...
window.TURBO = { G, player, hero, traffic, wanted };

// =====================================================
//  2) GRAPHISMES HD (chargés en ligne, en arrière-plan)
//  Si un fichier ne vient pas, le jeu garde ses textures de base.
// =====================================================
let waterNormal = null;
const status = $('assetStatus');

Promise.all([
  loadTexture('textures/terrain/grasslight-big.jpg'),
  loadTexture('textures/water/Water_1_M_Normal.jpg', false),
  loadModel('models/gltf/ferrari.glb'),
  loadTexture('models/gltf/ferrari_ao.png'),
  skyReady,
  loadCharacters().catch((e) => { console.warn(e); return false; }), // persos 3D animés
]).then(([grass, water, ferrari, ao, skyOk, chars]) => {
  if (grass) {
    grass.repeat.set(4, 4);
    grassMat.map = grass; grassMat.needsUpdate = true; // parcs
    // (le grand terrain en relief garde ses couleurs : herbe → roche → neige)
  }
  if (water) {
    water.repeat.set(3, 3);
    waterMat.normalMap = water;
    if (waterMat.normalScale) waterMat.normalScale.set(0.6, 0.6);
    waterMat.needsUpdate = true;
    waterNormal = water; // on fait bouger les vaguelettes dans la boucle
  }
  if (ferrari) {
    setFerrari(ferrari, ao);
    // la Ferrari était choisie : on remplace la voiture de secours par la vraie
    if (G.state === 'menu' && CARS[save.car] && CARS[save.car].style === 'ferrari') { setPlayerCar(); syncCarMesh(0); }
  }
  if (chars) attachHero(hero.mesh); // le héros devient un vrai perso 3D animé
  buildMenu(); // enlève le « (chargement…) » de la carte Ferrari
  const res = [grass, water, ferrari, ao, skyOk, chars];
  const ok = res.filter(Boolean).length;
  status.textContent = ok === res.length
    ? '✨ Graphismes HD chargés (' + ok + '/' + res.length + ')'
    : '⚠️ Graphismes HD : ' + ok + '/' + res.length + ' chargés (le jeu marche quand même)';
}).catch((e) => {
  console.warn(e);
  status.textContent = '⚠️ Graphismes HD non chargés (le jeu marche quand même)';
});

// =====================================================
//  Les « voitures » que les piétons doivent éviter.
//  On réutilise toujours les mêmes objets (pas de déchets mémoire).
// =====================================================
const pool = [];
const carList = [];
function slot(n) {
  if (!pool[n]) pool[n] = {};
  return pool[n];
}
function carsForPeds() {
  carList.length = 0;
  let n = 0;
  // la voiture du joueur (même quand il en est sorti : elle reste un obstacle)
  if (G.car) {
    const c = slot(n++), sp = player.speed;
    c.player = G.state === 'play' && G.mode === 'car'; // compte les piétons renversés
    c.soft = false;
    c.x = player.pos.x; c.z = player.pos.z; c.y = player.y || 0; c.h = player.h;
    c.vx = -Math.sin(player.vh) * sp; c.vz = -Math.cos(player.vh) * sp; c.speed = Math.abs(sp);
    c.W = G.car.S.W; c.L = G.car.S.L; c.top = G.car.top || 1.4;
    carList.push(c);
  }
  // la circulation (garées, en feu, épaves et voitures de police comprises)
  for (const o of traffic) {
    const c = slot(n++), still = o.parked || o.dead || !o.dir, sp = still ? 0 : o.speed;
    c.player = false; c.soft = false;
    c.x = o.vx; c.z = o.vz; c.y = o.y || 0; c.h = o.heading;
    c.vx = still ? 0 : o.dir.x * sp; c.vz = still ? 0 : o.dir.z * sp; c.speed = sp;
    c.W = o.car.S.W; c.L = o.car.S.L; c.top = o.car.top || 1.5;
    carList.push(c);
  }
  // le héros à pied : il bouscule les piétons sans les renverser
  if (G.mode === 'foot') {
    const c = slot(n++), sp = hero.speed;
    c.player = false; c.soft = true;
    c.x = hero.pos.x; c.z = hero.pos.z; c.y = hero.pos.y; c.h = hero.h;
    c.vx = -Math.sin(hero.h) * sp; c.vz = -Math.cos(hero.h) * sp; c.speed = Math.abs(sp);
    c.W = 0.7; c.L = 0.7; c.top = 1.8;
    carList.push(c);
  }
  return carList;
}

// =====================================================
//  La voiture penche avec la pente (collines, montagnes)
// =====================================================
const tilt = { pitch: 0, roll: 0 };
function tiltCar() {
  if (!G.car || player.wrecked || !player.grounded) return;
  const root = G.car.root;
  if (!root) return;
  if (root.rotation.order !== 'YXZ') root.rotation.order = 'YXZ';
  slopeTilt(player.pos.x, player.pos.z, player.h, G.car.S.L, G.car.S.W, tilt);
  root.rotation.x = tilt.pitch; // avant / arrière
  root.rotation.z = tilt.roll;  // gauche / droite
}

// =====================================================
//  3) LA BOUCLE DU JEU
//  L'ordre compte : commandes → joueur → monde → effets → caméra → écran
// =====================================================
function update(dt, t) {
  if (G.state === 'play') {
    G.elapsed += dt;
    const inp = readInput();
    const onFoot = G.mode === 'foot';
    updatePlayer(dt, onFoot ? null : inp); // la voiture (roule en roue libre si on est à pied)
    tiltCar();        // elle suit la pente du terrain
    updateHero(dt, onFoot ? inp : null);   // le héros à pied
    updateHeroModel(dt, hero);      // ses animations 3D (marche, course, visée)
    updateWeapons(dt);// tirs, balles, roquettes
    updatePolice(dt); // étoiles, voitures de police, policiers
    updateTraffic(dt);       // circulation, voitures en feu
    const hits = G.peds.update(dt, carsForPeds());
    if (hits) {
      G.shake = Math.max(G.shake, 0.25);
      crime(hits * POLICE.crime.pedHit);   // renverser des piétons : la police arrive !
    }
    updateDestruction(dt);   // explosions, débris, arbres qui tombent
    updateParticles(dt);     // fumée, étincelles, flammes
    updateCoins(dt, t);
    updateMission(dt);
    animateMission(dt, t);
    updateCamera(dt);
    updateHUD(dt);
    drawMinimap();
  } else if (G.state === 'menu') {
    // la ville continue de vivre derrière le menu
    updatePolice(dt);        // (range la police s'il en restait)
    updateTraffic(dt);
    G.peds.update(dt, carsForPeds());
    updateDestruction(dt);
    updateParticles(dt);
    animateMission(dt, t);
    updateMenuCamera(dt);
  }
  // en pause : rien ne bouge, on redessine juste l'image
}

// Une erreur ne doit pas figer tout le jeu : on l'affiche (une seule fois)
let lastError = '';
function report(e) {
  const msg = (e && e.message) || String(e);
  if (msg === lastError) return;
  lastError = msg;
  console.error(e);
  if (window.showGameError) window.showGameError(msg);
}

function frame() {
  const dt = Math.min(G.clock.getDelta(), 0.05); // jamais plus de 1/20 s (onglet en arrière-plan…)
  const t = G.clock.elapsedTime;
  try { update(dt, t); } catch (e) { report(e); }
  // le soleil (et donc les ombres) suit le joueur, le ciel suit la caméra
  const f = focusPos();
  sun.position.set(f.x + sunOffset.x, sunOffset.y, f.z + sunOffset.z);
  sun.target.position.set(f.x, 0, f.z);
  sky.position.copy(camera.position);
  stars.position.copy(camera.position);
  if (waterNormal) waterNormal.offset.set(t * 0.02, t * 0.013);
  render();
}
renderer.setAnimationLoop(frame);
