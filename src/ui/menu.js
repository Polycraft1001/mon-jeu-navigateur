// =====================================================
//  MENU PRINCIPAL, PAUSE, nouvelle partie
//  (aucun emoji : les icônes viennent de Font Awesome)
// =====================================================
import { $, isMobile } from '../core/utils.js';
import { G } from '../core/ctx.js';
import { save, persist } from '../core/save.js';
import { CARS, COLORS, STAT_NAMES, TIMES, TRAFFIC, ASSISTS } from '../core/config.js';
import { camera } from '../render/engine.js';
import { applyTime } from '../world/time.js';
import { hasFerrari } from '../vehicles/models.js';
import { spawnTraffic } from '../vehicles/traffic.js';
import { player, D, setPlayerCar, resetPlayer, syncCarMesh } from '../vehicles/driving.js';
import { resetHero } from '../gameplay/onfoot.js';
import { resetWeapons } from '../gameplay/weapons.js';
import { resetDestruction } from '../fx/destruction.js';
import { resetCoins } from '../gameplay/coins.js';
import { mission, cancelMission } from '../gameplay/mission.js';
import { refreshStats, showHint, icon } from './hud.js';
import { clearInput } from './input.js';

const ferrariReady = () => (typeof hasFerrari === 'function' ? hasFerrari() : !!hasFerrari);
const fmt = (n) => (n || 0).toLocaleString('fr-FR');

// ----- Plein écran + mode paysage (téléphone) -----
function goFullscreen() {
  if (!isMobile) return;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req || document.fullscreenElement || document.webkitFullscreenElement) return;
  const lock = () => {
    try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* rien */ }
  };
  try {
    const pr = req.call(el);
    if (pr && pr.then) pr.then(lock).catch(() => {}); else lock();
  } catch (e) { /* rien */ }
}

// ----- Téléphone tenu debout : on propose de le tourner -----
const portraitMQ = window.matchMedia('(orientation: portrait)');
export function checkRotate() {
  const show = isMobile && G.state !== 'menu' && portraitMQ.matches && !document.body.classList.contains('portraitOK');
  $('rotate').classList.toggle('hidden', !show);
}
$('rotateBtn').onclick = () => { document.body.classList.add('portraitOK'); checkRotate(); };
window.addEventListener('resize', checkRotate);

// ----- Construction du menu -----
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

export function buildMenu() {
  const list = $('carList'); list.innerHTML = '';
  CARS.forEach((c, i) => {
    const d = document.createElement('div');
    d.className = 'card' + (i === save.car ? ' selected' : '');
    const desc = c.style === 'ferrari' && !ferrariReady() ? c.desc + ' (chargement…)' : c.desc;
    d.innerHTML = '<div class="cardTitle">' + c.name + '</div><div class="cardDesc">' + desc + '</div>' +
      STAT_NAMES.map((n, k) => '<div class="stat"><span>' + n + '</span><div class="bar"><div style="width:' + c.stats[k] * 20 + '%"></div></div></div>').join('');
    d.onclick = () => { save.car = i; persist(); setPlayerCar(); syncCarMesh(0); buildMenu(); };
    list.appendChild(d);
  });
  const cl = $('colorList'); cl.innerHTML = '';
  COLORS.forEach((col, i) => {
    const s = document.createElement('div');
    s.className = 'swatch' + (i === save.color ? ' selected' : '');
    s.style.background = col;
    s.title = col;
    s.onclick = () => { save.color = i; persist(); if (G.car && G.car.paint) G.car.paint.color.set(col); buildMenu(); };
    cl.appendChild(s);
  });
  makeChoices('timeChoices', TIMES, 'time', () => applyTime(save.time));
  makeChoices('trafficChoices', TRAFFIC, 'traffic', spawnTraffic);
  makeChoices('assistChoices', ASSISTS, 'assist');
  $('records').innerHTML =
    '<span>' + icon('fa-trophy') + 'Record de drift : <b>' + fmt(save.bestDrift) + '</b> pts</span>' +
    '<span>' + icon('fa-star') + 'Missions réussies : <b>' + fmt(save.missions) + '</b></span>' +
    '<span>' + icon('fa-sack-dollar') + 'Argent : <b>' + fmt(save.money) + ' $</b></span>';
}

// ----- Remet le monde à neuf (nouvelle partie / retour au menu) -----
function newRound() {
  resetHero();          // le héros remonte dans sa voiture
  resetDestruction();   // débris, arbres et lampadaires réparés
  resetWeapons();
  setPlayerCar();       // sa propre voiture, toute neuve
  player.hp = player.def.hp || 100; player.wrecked = false; player.burn = 0;
  resetPlayer(true);
  spawnTraffic();       // nouvelles voitures (les épaves disparaissent)
  resetCoins();
  cancelMission();
  mission.cooldown = 1;
  D.mult = 1; D.combo = 0; D.show = 0;
}

const HINT_MOBILE =
  'Joystick = tourner · ' + icon('fa-caret-up') + ' ' + icon('fa-caret-down') + ' · DRIFT · ' +
  icon('fa-door-open') + ' sortir / monter / voler · ' + icon('fa-crosshairs') + ' tirer · ' +
  icon('fa-rotate') + ' arme · ' + icon('fa-arrow-rotate-left') + ' replacer · ' + icon('fa-star') + ' = mission';
const HINT_DESKTOP =
  '<kbd>Flèches</kbd>/<kbd>ZQSD</kbd> conduire · <kbd>Espace</kbd> drift · <kbd>F</kbd> sortir / monter / voler · ' +
  '<kbd>Clic</kbd>/<kbd>X</kbd> tirer · <kbd>1-5</kbd> armes · <kbd>R</kbd> replacer · <kbd>H</kbd> klaxon · ' +
  icon('fa-star') + ' = mission';

export function startGame() {
  goFullscreen();
  G.state = 'play';
  document.body.classList.add('playing');
  $('menu').classList.add('hidden');
  $('hud').classList.remove('hidden');
  if (isMobile) $('touch').classList.remove('hidden');
  newRound();
  camera.position.set(player.pos.x, 4, player.pos.z + 9);
  showHint(isMobile ? HINT_MOBILE : HINT_DESKTOP);
  refreshStats();
  checkRotate();
  if (G.clock) G.clock.getDelta();
}

export function toMenu() {
  G.state = 'menu';
  document.body.classList.remove('playing', 'onfoot');
  $('pause').classList.add('hidden');
  $('hud').classList.add('hidden');
  $('touch').classList.add('hidden');
  $('menu').classList.remove('hidden');
  clearInput();
  newRound();
  syncCarMesh(0);
  buildMenu();
  checkRotate();
}

export function togglePause() {
  if (G.state === 'play') { G.state = 'pause'; clearInput(); $('pause').classList.remove('hidden'); }
  else if (G.state === 'pause') { G.state = 'play'; $('pause').classList.add('hidden'); if (G.clock) G.clock.getDelta(); }
}

$('playBtn').onclick = startGame;
$('resumeBtn').onclick = togglePause;
$('menuBtn').onclick = toMenu;
$('pauseBtn').onclick = togglePause;
